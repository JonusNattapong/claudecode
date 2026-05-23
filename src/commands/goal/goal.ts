import { parseGoalBounds } from '../../services/goal/goalEvaluator.js';
import type { ToolUseContext } from '../../Tool.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import { type GoalState, getFullGoalState, setFullGoalState } from '../../utils/sessionGoalState.js';
import { getSettings_DEPRECATED } from '../../utils/settings/settings.js';

/**
 * /goal command — sets a session goal that is shown in the footer status line.
 *
 * Usage:
 *   /goal              — show current goal
 *   /goal <text>       — set goal
 *   /goal clear        — remove goal
 *   /goal ""           — remove goal
 */
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
  if (trimmed && !clearAliases.includes(trimmed.toLowerCase())) {
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

  // Show current goal with stats
  if (!trimmed) {
    const currentGoal = state.sessionGoal;
    if (currentGoal) {
      const goalState = getFullGoalState();
      const elapsed = state.sessionGoalStartTime ? Math.floor((Date.now() - state.sessionGoalStartTime) / 1000) : 0;
      const turns = state.sessionGoalTurnCount ?? 0;
      const elapsedStr = elapsed > 0 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : '0s';
      const tokens = goalState?.evalTokens ?? 0;
      const tokenStr = tokens > 0 ? ` · Eval tokens: ${tokens.toLocaleString()}` : '';
      const reason = goalState?.lastReason ? `\nLast check: ${goalState.lastReason}` : '';
      const bounds: string[] = [];
      if (goalState?.maxTurns) bounds.push(`${goalState.maxTurns} turns`);
      if (goalState?.maxMinutes) bounds.push(`${goalState.maxMinutes} min`);
      const boundsStr = bounds.length > 0 ? ` [limits: ${bounds.join(', ')}]` : '';
      onDone(`Goal: ${currentGoal}${boundsStr}\nElapsed: ${elapsedStr} · Turns: ${turns}${tokenStr}${reason}`, {
        display: 'system',
      });
    } else {
      onDone('No goal set. Usage: /goal <text> —or— /goal clear', { display: 'system' });
    }
    return null;
  }

  // Clear goal
  if (clearAliases.includes(trimmed.toLowerCase())) {
    const goalState = getFullGoalState();
    const restoredMode = goalState?.preGoalMode;
    context.setAppState(prev => ({
      ...prev,
      sessionGoal: undefined,
      sessionGoalStartTime: undefined,
      sessionGoalTurnCount: undefined,
      toolPermissionContext: restoredMode
        ? { ...prev.toolPermissionContext, mode: restoredMode }
        : prev.toolPermissionContext,
    }));
    setFullGoalState(null);

    const restoreMsg = restoredMode ? ` and restored permission mode to '${restoredMode}'` : '';
    onDone(`◎ Goal cleared${restoreMsg}.`, { display: 'system' });
    return null;
  }

  // Parse goal condition and bounds
  const { condition, maxTurns, maxMinutes } = parseGoalBounds(trimmed);

  // Set goal
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
  };

  context.setAppState(prev => ({
    ...prev,
    sessionGoal: trimmed,
    sessionGoalStartTime: Date.now(),
    sessionGoalTurnCount: 0,
    standaloneAgentContext: prev.standaloneAgentContext ? { ...prev.standaloneAgentContext } : undefined,
    toolPermissionContext: {
      ...prev.toolPermissionContext,
      mode: 'bypassPermissions',
    },
  }));
  setFullGoalState(goalState);

  const bounds: string[] = [];
  if (maxTurns) bounds.push(`stop after ${maxTurns} turns`);
  if (maxMinutes) bounds.push(`stop after ${maxMinutes} min`);
  const boundsStr = bounds.length > 0 ? ` (${bounds.join(', ')})` : '';
  onDone(`◎ Goal set: ${trimmed}${boundsStr}`, {
    display: 'system',
    shouldQuery: true,
    metaMessages: [
      `Autonomous Agent Mode activated. Your active goal is: "${trimmed}"${boundsStr}. Please proceed autonomously with the tools available to achieve this goal. Permissions are automatically bypassed for execution.`,
    ],
  });
  return null;
}
