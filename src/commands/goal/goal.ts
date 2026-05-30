import { parseGoalBounds } from '../../services/goal/goalEvaluator.js';
import type { ToolUseContext } from '../../Tool.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import { type GoalState, getFullGoalState, setFullGoalState } from '../../utils/sessionGoalState.js';
import { getSettings_DEPRECATED } from '../../utils/settings/settings.js';

/**
 * /goal command — sets a session goal that is shown in the footer status line.
 *
 * Usage:
 *   /goal              — show current goal with progress
 *   /goal <text>       — set goal
 *   /goal clear        — remove goal
 *   /goal ""           — remove goal
 *   /goal pause        — pause goal (restore permissions, keep state)
 *   /goal resume       — resume a paused goal
 */

/** Build a text-based mini progress bar for terminal display */
function renderTextProgressBar(ratio: number, width: number = 16): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = Math.round(clamped * 100);
  return `${bar} ${pct}%`;
}

/** Format elapsed time in a human readable way */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const trimmed = args?.trim() ?? '';
  const clearAliases = ['clear', 'stop', 'off', 'reset', 'none', 'cancel'];

  // Check if hooks are disabled — goal turn tracking depends on hooks for
  // counting, and a missing hook can cause the indicator to hang instead of
  // resolving. Show a clear message rather than silently stalling.
  if (
    trimmed &&
    !clearAliases.includes(trimmed.toLowerCase()) &&
    trimmed.toLowerCase() !== 'pause' &&
    trimmed.toLowerCase() !== 'resume'
  ) {
    const settings = getSettings_DEPRECATED();
    if (settings.disableAllHooks || settings.allowManagedHooksOnly) {
      onDone(
        `Goal '${trimmed}' cannot be tracked: hooks are disabled (${settings.disableAllHooks ? 'disableAllHooks' : 'allowManagedHooksOnly'}). Goal-based turn tracking requires hooks to be enabled.`,
        { display: 'system' },
      );
      return null;
    }
  }

  const state = context.getAppState();

  // ── Pause goal ──────────────────────────────────────────────────────────
  if (trimmed.toLowerCase() === 'pause') {
    const goalState = getFullGoalState();
    if (!goalState?.goal) {
      onDone('No active goal to pause.', { display: 'system' });
      return null;
    }
    if (goalState.paused) {
      onDone('Goal is already paused. Use /goal resume to continue.', { display: 'system' });
      return null;
    }

    const restoredMode = goalState.preGoalMode;
    goalState.paused = true;
    goalState.pausedAt = Date.now();
    setFullGoalState(goalState);

    context.setAppState(prev => ({
      ...prev,
      sessionGoalPaused: true,
      toolPermissionContext: restoredMode
        ? { ...prev.toolPermissionContext, mode: restoredMode }
        : prev.toolPermissionContext,
    }));

    const restoreMsg = restoredMode ? ` Permission mode restored to '${restoredMode}'.` : '';
    onDone(`⏸ Goal paused: "${goalState.goal}"${restoreMsg}\nUse /goal resume to continue.`, { display: 'system' });
    return null;
  }

  // ── Resume goal ─────────────────────────────────────────────────────────
  if (trimmed.toLowerCase() === 'resume') {
    const goalState = getFullGoalState();
    if (!goalState?.goal) {
      onDone('No goal to resume. Set one with /goal <text>.', { display: 'system' });
      return null;
    }
    if (!goalState.paused) {
      onDone('Goal is not paused — it is already active.', { display: 'system' });
      return null;
    }

    // Accumulate paused time
    const pausedMs = goalState.pausedAt ? Date.now() - goalState.pausedAt : 0;
    goalState.totalPausedMs = (goalState.totalPausedMs ?? 0) + pausedMs;
    goalState.paused = false;
    goalState.pausedAt = undefined;
    setFullGoalState(goalState);

    context.setAppState(prev => ({
      ...prev,
      sessionGoalPaused: false,
      toolPermissionContext: {
        ...prev.toolPermissionContext,
        mode: 'bypassPermissions',
      },
    }));

    const elapsed = goalState.setAt ? formatElapsed(Date.now() - goalState.setAt - (goalState.totalPausedMs ?? 0)) : '';
    const turns = goalState.turnCount ?? 0;
    onDone(
      `▶ Goal resumed: "${goalState.goal}"\nElapsed: ${elapsed} · ${turns} turns · Permissions: bypassPermissions`,
      {
        display: 'system',
        shouldQuery: true,
        metaMessages: [
          `Autonomous Agent Mode re-activated. Your active goal is: "${goalState.goal}". Please continue working autonomously toward this goal. Permissions are automatically bypassed for execution.`,
        ],
      },
    );
    return null;
  }

  // ── Show current goal with enhanced stats ───────────────────────────────
  if (!trimmed) {
    const currentGoal = state.sessionGoal;
    if (currentGoal) {
      const goalState = getFullGoalState();
      const now = Date.now();
      const totalPausedMs = goalState?.totalPausedMs ?? 0;
      const rawElapsed = state.sessionGoalStartTime ? now - state.sessionGoalStartTime : 0;
      const activeElapsed = rawElapsed - totalPausedMs;
      const turns = state.sessionGoalTurnCount ?? 0;
      const elapsedStr = formatElapsed(activeElapsed);
      const tokens = goalState?.evalTokens ?? 0;
      const isPaused = goalState?.paused ?? false;

      // Build output lines
      const lines: string[] = [];

      // Header
      const statusIcon = isPaused ? '⏸' : '◎';
      const statusLabel = isPaused ? 'PAUSED' : 'ACTIVE';
      lines.push(`${statusIcon} Goal [${statusLabel}]`);
      lines.push(`  "${currentGoal}"`);
      lines.push('');

      // Progress section
      lines.push(`  ⏱ Elapsed: ${elapsedStr}  ·  🔄 Turns: ${turns}`);

      // Turn progress bar
      if (goalState?.maxTurns) {
        const ratio = turns / goalState.maxTurns;
        lines.push(`  Turns:   ${renderTextProgressBar(ratio)}  (${turns}/${goalState.maxTurns})`);
      }

      // Time progress bar
      if (goalState?.maxMinutes) {
        const elapsedMinutes = activeElapsed / 60_000;
        const ratio = elapsedMinutes / goalState.maxMinutes;
        lines.push(
          `  Time:    ${renderTextProgressBar(ratio)}  (${Math.round(elapsedMinutes)}/${goalState.maxMinutes} min)`,
        );
      }

      // Eval stats
      if (tokens > 0) {
        lines.push(`  📊 Eval tokens: ${tokens.toLocaleString()}`);
      }

      // Last evaluator feedback
      if (goalState?.lastReason) {
        lines.push('');
        lines.push(`  💬 Last check: ${goalState.lastReason}`);
      }

      // Bounds summary
      const bounds: string[] = [];
      if (goalState?.maxTurns) bounds.push(`${goalState.maxTurns} turns`);
      if (goalState?.maxMinutes) bounds.push(`${goalState.maxMinutes} min`);
      if (bounds.length > 0) {
        lines.push(`  ⛔ Limits: ${bounds.join(', ')}`);
      }

      // Permission mode
      lines.push('');
      lines.push(`  🔓 Permission mode: ${state.toolPermissionContext?.mode ?? 'unknown'}`);

      onDone(lines.join('\n'), { display: 'system' });
    } else {
      onDone(
        'No goal set.\n\nUsage:\n  /goal <text>              Set a goal\n  /goal <text> or stop after 20 turns   Set with turn limit\n  /goal clear               Remove goal\n  /goal pause               Pause goal\n  /goal resume              Resume paused goal',
        { display: 'system' },
      );
    }
    return null;
  }

  // ── Clear goal ──────────────────────────────────────────────────────────
  if (clearAliases.includes(trimmed.toLowerCase())) {
    const goalState = getFullGoalState();
    const restoredMode = goalState?.preGoalMode;
    const turns = goalState?.turnCount ?? state.sessionGoalTurnCount ?? 0;
    const elapsed = goalState?.setAt ? formatElapsed(Date.now() - goalState.setAt) : '0s';
    const tokens = goalState?.evalTokens ?? 0;

    context.setAppState(prev => ({
      ...prev,
      sessionGoal: undefined,
      sessionGoalStartTime: undefined,
      sessionGoalTurnCount: undefined,
      sessionGoalPaused: undefined,
      toolPermissionContext: restoredMode
        ? { ...prev.toolPermissionContext, mode: restoredMode }
        : prev.toolPermissionContext,
    }));
    setFullGoalState(null);

    const statsLine = `${elapsed} · ${turns} turns${tokens > 0 ? ` · ${tokens.toLocaleString()} eval tokens` : ''}`;
    const restoreMsg = restoredMode ? `\n  🔒 Permission mode restored to '${restoredMode}'` : '';
    onDone(`◎ Goal cleared.\n  📊 Stats: ${statsLine}${restoreMsg}`, { display: 'system' });
    return null;
  }

  // ── Parse goal condition and bounds ─────────────────────────────────────
  const { condition, maxTurns, maxMinutes } = parseGoalBounds(trimmed);

  // ── Set goal ────────────────────────────────────────────────────────────
  const goalState: GoalState = {
    goal: trimmed,
    condition,
    maxTurns,
    maxMinutes,
    setAt: Date.now(),
    turnCount: 0,
    evalTokens: 0,
    lastReason: undefined,
    achieved: false,
    preGoalMode: state.toolPermissionContext?.mode,
    paused: false,
    totalPausedMs: 0,
  };

  context.setAppState(prev => ({
    ...prev,
    sessionGoal: trimmed,
    sessionGoalStartTime: Date.now(),
    sessionGoalTurnCount: 0,
    sessionGoalPaused: false,
    standaloneAgentContext: prev.standaloneAgentContext ? { ...prev.standaloneAgentContext } : undefined,
    toolPermissionContext: {
      ...prev.toolPermissionContext,
      mode: 'bypassPermissions',
    },
  }));
  setFullGoalState(goalState);

  // Build structured confirmation
  const lines: string[] = [];
  lines.push('◎ Goal activated');
  lines.push(`  "${trimmed}"`);
  lines.push('');

  // Show parsed condition if different from raw input
  if (condition !== trimmed) {
    lines.push(`  📋 Condition: "${condition}"`);
  }

  // Show bounds
  const bounds: string[] = [];
  if (maxTurns) bounds.push(`⏱ Stop after ${maxTurns} turns`);
  if (maxMinutes) bounds.push(`⏱ Stop after ${maxMinutes} min`);
  if (bounds.length > 0) {
    lines.push(`  ${bounds.join('  ·  ')}`);
  }

  // Show permission change
  const prevMode = state.toolPermissionContext?.mode ?? 'default';
  lines.push(`  🔓 Permissions: ${prevMode} → bypassPermissions`);
  lines.push('');
  lines.push('  Claude will work autonomously toward this goal.');
  lines.push('  Use /goal to check progress, /goal pause to pause, /goal clear to stop.');

  onDone(lines.join('\n'), {
    display: 'system',
    shouldQuery: true,
    metaMessages: [
      `Autonomous Agent Mode activated. Your active goal is: "${trimmed}"${bounds.length > 0 ? ` (${bounds.join(', ')})` : ''}. Please proceed autonomously with the tools available to achieve this goal. Permissions are automatically bypassed for execution.`,
    ],
  });
  return null;
}
