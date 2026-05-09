import { feature } from 'bun:bundle';
import chalk from 'chalk';
import * as React from 'react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { logEvent } from 'src/services/analytics/index.js';
import { getProviderRegistryEntry } from 'src/services/ai/providerRegistry.js';
import { useAppState, useSetAppState } from 'src/state/AppState.js';
import type { PermissionMode } from 'src/utils/permissions/PermissionMode.js';
import { getKairosActive, getMainThreadAgentType, getOriginalCwd, getSdkBetas, getSessionId } from '../bootstrap/state.js';
import { DEFAULT_OUTPUT_STYLE_NAME } from '../constants/outputStyles.js';
import { useNotifications } from '../context/notifications.js';
import { getTotalAPIDuration, getTotalCost, getTotalDuration, getTotalInputTokens, getTotalLinesAdded, getTotalLinesRemoved, getTotalOutputTokens } from '../cost-tracker.js';
import { useMainLoopModel } from '../hooks/useMainLoopModel.js';
import { type ReadonlySettings, useSettings } from '../hooks/useSettings.js';
import { Ansi, Box, Text } from '../ink.js';
import { getRawUtilization } from '../services/claudeAiLimits.js';
import type { Message } from '../types/message.js';
import type { StatusLineCommandInput } from '../types/statusLine.js';
import type { VimMode } from '../types/textInputTypes.js';
import { checkHasTrustDialogAccepted } from '../utils/config.js';
import { calculateContextPercentages, getContextWindowForModel } from '../utils/context.js';
import { getCwd } from '../utils/cwd.js';
import { logForDebugging } from '../utils/debug.js';
import { isFullscreenEnvEnabled } from '../utils/fullscreen.js';
import { createBaseHookInput, executeStatusLineCommand } from '../utils/hooks.js';
import { getLastAssistantMessage } from '../utils/messages.js';
import { getRuntimeMainLoopModel, type ModelName, renderModelName } from '../utils/model/model.js';
import { getCurrentSessionTitle } from '../utils/sessionStorage.js';
import { doesMostRecentAssistantMessageExceed200k, getCurrentUsage } from '../utils/tokens.js';
import { roughTokenCountEstimationForMessages } from '../services/tokenEstimation.js';
import { getCurrentWorktreeSession } from '../utils/worktree.js';
import { isVimModeEnabled } from './PromptInput/utils.js';
import { getBranch } from '../utils/git.js';

export function statusLineShouldDisplay(settings: ReadonlySettings): boolean {
  if (feature('KAIROS') && getKairosActive()) return false;
  return true;
}

function buildStatusLineCommandInput(
  permissionMode: PermissionMode,
  exceeds200kTokens: boolean,
  settings: ReadonlySettings,
  messages: Message[],
  addedDirs: string[],
  mainLoopModel: ModelName,
  vimMode?: VimMode,
  providerOverride?: string
): StatusLineCommandInput {
  const agentType = getMainThreadAgentType();
  const worktreeSession = getCurrentWorktreeSession();
  const runtimeModel = getRuntimeMainLoopModel({
    permissionMode,
    mainLoopModel,
    exceeds200kTokens
  });
  const outputStyleName = settings?.outputStyle || DEFAULT_OUTPUT_STYLE_NAME;
  const currentUsage = getCurrentUsage(messages);
  const contextWindowSize = getContextWindowForModel(runtimeModel, getSdkBetas());
  const contextPercentages = calculateContextPercentages(currentUsage, contextWindowSize);
  const sessionId = getSessionId();
  const sessionName = getCurrentSessionTitle(sessionId);
  const rawUtil = getRawUtilization();
  const rateLimits: StatusLineCommandInput['rate_limits'] = {
    ...(rawUtil.five_hour && {
      five_hour: {
        used_percentage: rawUtil.five_hour.utilization * 100,
        resets_at: rawUtil.five_hour.resets_at
      }
    }),
    ...(rawUtil.seven_day && {
      seven_day: {
        used_percentage: rawUtil.seven_day.utilization * 100,
        resets_at: rawUtil.seven_day.resets_at
      }
    })
  };
  return {
    ...createBaseHookInput(),
    ...(sessionName && {
      session_name: sessionName
    }),
    model: {
      id: runtimeModel,
      display_name: renderModelName(runtimeModel, providerOverride).replace(/^[^:]+:\s*/, '')
    },
    workspace: {
      current_dir: getCwd(),
      project_dir: getOriginalCwd(),
      added_dirs: addedDirs,
      git_worktree: getCurrentWorktreeSession() !== null
    },
    version: MACRO.VERSION,
    output_style: {
      name: outputStyleName
    },
    cost: {
      total_cost_usd: getTotalCost(),
      total_duration_ms: getTotalDuration(),
      total_api_duration_ms: getTotalAPIDuration(),
      total_lines_added: getTotalLinesAdded(),
      total_lines_removed: getTotalLinesRemoved()
    },
    context_window: {
      total_input_tokens: getTotalInputTokens(),
      total_output_tokens: getTotalOutputTokens(),
      context_window_size: contextWindowSize,
      current_usage: currentUsage,
      used_percentage: contextPercentages.used,
      remaining_percentage: contextPercentages.remaining
    },
    exceeds_200k_tokens: exceeds200kTokens,
    ...((rateLimits.five_hour || rateLimits.seven_day) && {
      rate_limits: rateLimits
    }),
    ...(isVimModeEnabled() && {
      vim: {
        mode: vimMode ?? 'INSERT'
      }
    }),
    ...(agentType && {
      agent: {
        name: agentType
      }
    }),
    ...(worktreeSession && {
      worktree: {
        name: worktreeSession.worktreeName,
        path: worktreeSession.worktreePath,
        branch: worktreeSession.worktreeBranch,
        original_cwd: worktreeSession.originalCwd,
        original_branch: worktreeSession.originalBranch
      }
    })
  };
}

type Props = {
  messagesRef: React.RefObject<Message[]>;
  lastAssistantMessageId: string | null;
  vimMode?: VimMode;
};

export function getLastAssistantMessageId(messages: Message[]): string | null {
  return getLastAssistantMessage(messages)?.uuid ?? null;
}

// ─── Claude-HUD-inspired helpers ───────────────────────────────────────────

/** Visual context bar like claude-hud's coloredBar */
function coloredBar(percent: number, width: number = 10): string {
  const safePercent = Math.min(100, Math.max(0, percent));
  const filled = Math.round((safePercent / 100) * width);
  const empty = width - filled;

  let colorFn: typeof chalk.hex;
  if (percent > 85) colorFn = chalk.hex('#ff4444');       // red
  else if (percent > 70) colorFn = chalk.hex('#ffaa00');  // yellow/warning
  else colorFn = chalk.hex('#44aa44');                      // green

  const emptyFn = chalk.hex('#555555');
  return colorFn('█'.repeat(filled)) + emptyFn('░'.repeat(empty));
}

interface ToolActivity {
  id: string;
  name: string;
  target?: string;
  status: 'running' | 'completed' | 'error';
}

interface AgentActivity {
  id: string;
  type: string;
  description?: string;
  status: 'running' | 'completed';
}

interface TodoState {
  inProgress: string | null;
  completed: number;
  total: number;
}

function extractTarget(toolName: string, input?: Record<string, unknown>): string | undefined {
  if (!input) return undefined;
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return (input.file_path as string) ?? (input.path as string);
    case 'Glob':
      return input.pattern as string;
    case 'Grep':
      return input.pattern as string;
    case 'Bash': {
      const cmd = input.command as string;
      return cmd ? cmd.slice(0, 30) + (cmd.length > 30 ? '...' : '') : undefined;
    }
  }
  return undefined;
}

/** Block shape for tool_use/tool_result parsing — subset of actual message content blocks */
interface ActivityBlock {
  type: string;
  id?: string;
  name?: string;
  tool_use_id?: string;
  input?: Record<string, unknown>;
  is_error?: boolean;
  subagent_type?: string;
  description?: string;
  subject?: string;
  status?: string;
  taskId?: string | number;
  todos?: Array<{ content: string; status: string }>;
}

/** Extract tool activity and agent state from all messages.
 *  Mirrors claude-hud's transcript.ts processEntry logic. */
function extractActivity(messages: Message[]): {
  tools: ToolActivity[];
  agents: AgentActivity[];
  todos: TodoState | null;
} {
  const toolMap = new Map<string, ToolActivity>();
  const agentMap = new Map<string, AgentActivity>();
  const taskIdToIndex = new Map<string, number>();
  let latestTodos: Array<{ content: string; status: string }> = [];

  for (const msg of messages) {
    const content = (msg as any).content;
    if (!Array.isArray(content)) continue;

    for (const block of content as ActivityBlock[]) {
      // Tool use => running tool
      if (block.type === 'tool_use' && block.id && block.name) {
        const toolEntry: ToolActivity = {
          id: block.id,
          name: block.name,
          target: extractTarget(block.name, block.input),
          status: 'running',
        };

        if (block.name === 'Task' || block.name === 'Agent') {
          const input = (block.input ?? {}) as Record<string, unknown>;
          agentMap.set(block.id, {
            id: block.id,
            type: (input.subagent_type as string) ?? 'agent',
            description: (input.description as string) ?? undefined,
            status: 'running',
          });
        } else if (block.name === 'TodoWrite') {
          const input = (block.input ?? {}) as { todos?: Array<{ content: string; status: string }> };
          if (input.todos && Array.isArray(input.todos)) {
            // Preserve task IDs by content matching (same as claude-hud)
            const contentToTaskIds = new Map<string, string[]>();
            for (const [taskId, idx] of taskIdToIndex) {
              if (idx < latestTodos.length) {
                const existingContent = latestTodos[idx].content;
                const ids = contentToTaskIds.get(existingContent) ?? [];
                ids.push(taskId);
                contentToTaskIds.set(existingContent, ids);
              }
            }
            latestTodos = input.todos.map(t => ({ content: t.content, status: t.status }));
            taskIdToIndex.clear();
            for (let i = 0; i < latestTodos.length; i++) {
              const ids = contentToTaskIds.get(latestTodos[i].content);
              if (ids && ids.length > 0) {
                taskIdToIndex.set(ids.shift()!, i);
                if (ids.length === 0) contentToTaskIds.delete(latestTodos[i].content);
              }
            }
          }
        } else if (block.name === 'TaskCreate') {
          const input = (block.input ?? {}) as Record<string, unknown>;
          const subject = typeof input.subject === 'string' ? input.subject : '';
          const desc = typeof input.description === 'string' ? input.description : '';
          const todoContent = subject || desc || 'Untitled task';
          const status = input.status === 'in_progress' ? 'in_progress' :
                         input.status === 'completed' ? 'completed' : 'pending';
          latestTodos.push({ content: todoContent, status });
          const taskId = input.taskId ?? block.id;
          if (taskId) taskIdToIndex.set(String(taskId), latestTodos.length - 1);
        } else if (block.name === 'TaskUpdate') {
          const input = (block.input ?? {}) as Record<string, unknown>;
          const tid = input.taskId;
          let idx: number | null = null;
          if (typeof tid === 'string' || typeof tid === 'number') {
            const key = String(tid);
            idx = taskIdToIndex.get(key) ?? null;
            if (idx === null && /^\d+$/.test(key)) {
              const n = parseInt(key, 10) - 1;
              if (n >= 0 && n < latestTodos.length) idx = n;
            }
          }
          if (idx !== null && idx < latestTodos.length) {
            if (input.status) {
              const s = String(input.status);
              latestTodos[idx].status = s === 'completed' ? 'completed' :
                                        s === 'in_progress' ? 'in_progress' : 'pending';
            }
            const newSubject = typeof input.subject === 'string' ? input.subject : '';
            const newDesc = typeof input.description === 'string' ? input.description : '';
            if (newSubject || newDesc) latestTodos[idx].content = newSubject || newDesc;
          }
        } else {
          toolMap.set(block.id, toolEntry);
        }
      }

      // Tool result => completed/error
      if (block.type === 'tool_result' && block.tool_use_id) {
        const tool = toolMap.get(block.tool_use_id);
        if (tool) {
          tool.status = block.is_error ? 'error' : 'completed';
        }
        const agent = agentMap.get(block.tool_use_id);
        if (agent) {
          agent.status = 'completed';
        }
      }
    }
  }

  const tools = Array.from(toolMap.values());
  const agents = Array.from(agentMap.values());

  // Build todo state
  let todos: TodoState | null = null;
  if (latestTodos.length > 0) {
    const inProgress = latestTodos.find(t => t.status === 'in_progress');
    const completed = latestTodos.filter(t => t.status === 'completed').length;
    todos = {
      inProgress: inProgress ? inProgress.content : null,
      completed,
      total: latestTodos.length,
    };
  }

  return { tools, agents, todos };
}

function truncate(str: string, maxLen: number = 40): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ─── StatusLine component ──────────────────────────────────────────────────

function StatusLineInner({
  messagesRef,
  lastAssistantMessageId,
  vimMode
}: Props): React.ReactNode {
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const permissionMode = useAppState(s => s.toolPermissionContext.mode);
  const additionalWorkingDirectories = useAppState(s => s.toolPermissionContext.additionalWorkingDirectories);
  const statusLineText = useAppState(s => s.statusLineText);
  const setAppState = useSetAppState();
  const settings = useSettings();
  const { addNotification } = useNotifications();
  const mainLoopModel = useMainLoopModel();
  const [currentBranch, setCurrentBranch] = React.useState<string | null>(null);
  const mcpCount = useAppState(s => s.mcp.clients.length) as number;
  const thinkingEnabled = useAppState(s => s.thinkingEnabled);
  const mainLoopProvider = useAppState(s => s.mainLoopProvider);
  const mainLoopProviderForSession = useAppState(s => s.mainLoopProviderForSession);
  const [currentCwd, setCurrentCwd] = React.useState(getCwd());

  // Poll for CWD changes to update status line when /setpath is used
  React.useEffect(() => {
    const checkCwd = () => {
      const newCwd = getCwd();
      setCurrentCwd(prev => prev !== newCwd ? newCwd : prev);
    };
    const timer = setInterval(checkCwd, 500);
    return () => clearInterval(timer);
  }, []);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const vimModeRef = useRef(vimMode);
  vimModeRef.current = vimMode;
  const permissionModeRef = useRef(permissionMode);
  permissionModeRef.current = permissionMode;
  const addedDirsRef = useRef(additionalWorkingDirectories);
  addedDirsRef.current = additionalWorkingDirectories;
  const mainLoopModelRef = useRef(mainLoopModel);
  mainLoopModelRef.current = mainLoopModel;

  const previousStateRef = useRef<{
    messageId: string | null;
    exceeds200kTokens: boolean;
    permissionMode: PermissionMode;
    vimMode: VimMode | undefined;
    mainLoopModel: ModelName;
    provider?: string;
  }>({
    messageId: null,
    exceeds200kTokens: false,
    permissionMode,
    vimMode,
    mainLoopModel,
    provider: mainLoopProviderForSession ?? mainLoopProvider
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logNextResultRef = useRef(true);

  const doUpdate = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const msgs = messagesRef.current;
    const logResult = logNextResultRef.current;
    logNextResultRef.current = false;
    try {
      let exceeds200kTokens = previousStateRef.current.exceeds200kTokens;
      const currentMessageId = getLastAssistantMessageId(msgs);
      if (currentMessageId !== previousStateRef.current.messageId) {
        exceeds200kTokens = doesMostRecentAssistantMessageExceed200k(msgs);
        previousStateRef.current.messageId = currentMessageId;
        previousStateRef.current.exceeds200kTokens = exceeds200kTokens;
      }
      const branch = await getBranch();
      setCurrentBranch(branch);
      const activeProvider = mainLoopProviderForSession ?? mainLoopProvider;
      const statusInput = buildStatusLineCommandInput(permissionModeRef.current, exceeds200kTokens, settingsRef.current, msgs, Array.from(addedDirsRef.current.keys()), mainLoopModelRef.current, vimModeRef.current, activeProvider);
      const text = await executeStatusLineCommand(statusInput, controller.signal, undefined, logResult);
      if (!controller.signal.aborted) {
        setAppState(prev => {
          if (prev.statusLineText === text) return prev;
          return { ...prev, statusLineText: text };
        });
      }
    } catch { /* ignore */ }
  }, [messagesRef, setAppState]);

  const scheduleUpdate = useCallback(() => {
    if (debounceTimerRef.current !== undefined) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = undefined;
      void doUpdate();
    }, 300);
  }, [doUpdate]);

  useEffect(() => {
    const activeProvider = mainLoopProviderForSession ?? mainLoopProvider;
    if (lastAssistantMessageId !== previousStateRef.current.messageId || permissionMode !== previousStateRef.current.permissionMode || vimMode !== previousStateRef.current.vimMode || mainLoopModel !== previousStateRef.current.mainLoopModel || activeProvider !== previousStateRef.current.provider) {
      previousStateRef.current.permissionMode = permissionMode;
      previousStateRef.current.vimMode = vimMode;
      previousStateRef.current.mainLoopModel = mainLoopModel;
      previousStateRef.current.provider = activeProvider;
      scheduleUpdate();
    }
  }, [lastAssistantMessageId, permissionMode, vimMode, mainLoopModel, mainLoopProvider, mainLoopProviderForSession, scheduleUpdate]);

  useEffect(() => {
    const statusLine = settings?.statusLine;
    if (statusLine) {
      logEvent('tengu_status_line_mount', {
        command_length: statusLine.command.length,
        padding: statusLine.padding
      });
      if (settings.disableAllHooks === true) {
        logForDebugging('Status line is configured but disableAllHooks is true', { level: 'warn' });
      }
      if (!checkHasTrustDialogAccepted()) {
        addNotification({
          key: 'statusline-trust-blocked',
          text: 'statusline skipped · restart to fix',
          color: 'warning',
          priority: 'low'
        });
      }
    }
  }, []);

  useEffect(() => {
    void doUpdate();
    return () => {
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current !== undefined) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const paddingX = settings?.statusLine?.padding ?? 0;
  const filteredStatusLineText = statusLineText && /mode on \([^)]*cycle\)/i.test(statusLineText) ? undefined : statusLineText;

  const defaultStatusLine = !filteredStatusLineText ? (() => {
    const runtimeModel = getRuntimeMainLoopModel({
      permissionMode,
      mainLoopModel,
      exceeds200kTokens: previousStateRef.current.exceeds200kTokens
    });
    const currentUsage = getCurrentUsage(messagesRef.current);
    let inputTokens = currentUsage?.input_tokens ?? 0;
    let outputTokens = currentUsage?.output_tokens ?? 0;

    if (!currentUsage && messagesRef.current.length > 0) {
      const estimatedTokens = roughTokenCountEstimationForMessages(messagesRef.current);
      inputTokens = Math.round(estimatedTokens * 0.7);
      outputTokens = Math.round(estimatedTokens * 0.3);
    }

    const usageForContext = currentUsage ?? {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };

    const contextWindowSize = getContextWindowForModel(runtimeModel, getSdkBetas());
    const contextPercentages = calculateContextPercentages(usageForContext, contextWindowSize);
    const cacheReadTokens = usageForContext.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = usageForContext.cache_creation_input_tokens ?? 0;
    const cwd = currentCwd;
    const projectName = cwd.split(/[/\\]/).pop() || cwd;
    const gitBranch = currentBranch;
    const cost = getTotalCost();
    const duration = getTotalDuration();

    const formatDuration = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    };

    const formatCost = (usd: number): string => usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`;
    const usedPercentage = contextPercentages.used ?? 0;
    const approxContextTokens = inputTokens + cacheReadTokens + cacheWriteTokens;
    const rawModelName = renderModelName(runtimeModel, mainLoopProviderForSession ?? mainLoopProvider);
    // Strip provider prefix (e.g., "KiloCode: ") when showing in status line,
    // since the provider is already displayed separately in brackets below
    const modelName = rawModelName.replace(/^[^:]+:\s*/, '');
    const branchText = gitBranch ? chalk.dim(`(${gitBranch})`) : '';
    const statusText = thinkingEnabled ? 'THINKING' : 'IDLE';

    // Context bar (claude-hud style)
    const bar = coloredBar(usedPercentage, 10);

    // Extract tool/agent/todo activity
    const { tools, agents, todos } = extractActivity(messagesRef.current);
    const runningTools = tools.filter(t => t.status === 'running');
    const completedTools = tools.filter(t => t.status === 'completed' || t.status === 'error');
    const runningAgents = agents.filter(a => a.status === 'running');

    // Build tool count summary for completed tools
    const toolCounts = new Map<string, number>();
    for (const t of completedTools) {
      toolCounts.set(t.name, (toolCounts.get(t.name) ?? 0) + 1);
    }
    const sortedCompletedTools = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const showActivity = runningTools.length > 0 || runningAgents.length > 0 || sortedCompletedTools.length > 0;

    // ── Provider label for non-default providers ──
    const activeProvider = mainLoopProviderForSession ?? mainLoopProvider;
    let providerLabel = '';
    if (activeProvider && activeProvider !== 'anthropic') {
      const entry = getProviderRegistryEntry(activeProvider);
      if (entry) providerLabel = chalk.dim(`[${entry.label}]`);
    }

    // ── Line 1: Identity — model, provider, project, branch ──
    const line1 =
      (thinkingEnabled
        ? chalk.hex('#44ff44')(`● ${statusText}`)
        : chalk.hex('#666666')(`● ${statusText}`)) +
      '  ' +
      chalk.cyan(modelName) +
      (providerLabel ? ' ' + providerLabel : '') +
      '  ' +
      chalk.white(projectName) +
      ' ' + branchText;

    // ── Line 2: Status — context bar, tokens, rate limits, cost, duration ──
    const contextTokStr = usedPercentage > 80
      ? chalk.hex('#ff4444')(`${(approxContextTokens / 1000).toFixed(0)}k ${usedPercentage.toFixed(0)}%`)
      : usedPercentage > 60
        ? chalk.hex('#ffaa00')(`${(approxContextTokens / 1000).toFixed(0)}k ${usedPercentage.toFixed(0)}%`)
        : chalk.hex('#aaaaaa')(`${(approxContextTokens / 1000).toFixed(0)}k ${usedPercentage.toFixed(0)}%`);

    const rawUtil = getRawUtilization();
    const rateParts: string[] = [];
    if (rawUtil.five_hour) {
      rateParts.push(
        chalk.dim('5h:') +
        (rawUtil.five_hour.utilization > 0.7
          ? chalk.hex('#ff4444')(`${(rawUtil.five_hour.utilization * 100).toFixed(0)}%`)
          : rawUtil.five_hour.utilization > 0.4
            ? chalk.hex('#ffaa00')(`${(rawUtil.five_hour.utilization * 100).toFixed(0)}%`)
            : chalk.hex('#44aa44')(`${(rawUtil.five_hour.utilization * 100).toFixed(0)}%`))
      );
    }
    if (rawUtil.seven_day) {
      rateParts.push(
        chalk.dim('7d:') +
        (rawUtil.seven_day.utilization > 0.7
          ? chalk.hex('#ff4444')(`${(rawUtil.seven_day.utilization * 100).toFixed(0)}%`)
          : rawUtil.seven_day.utilization > 0.4
            ? chalk.hex('#ffaa00')(`${(rawUtil.seven_day.utilization * 100).toFixed(0)}%`)
            : chalk.hex('#44aa44')(`${(rawUtil.seven_day.utilization * 100).toFixed(0)}%`))
      );
    }
    const rateLimitStr = rateParts.length > 0 ? '  │  ' + rateParts.join('  ') : '';

    // Color for ● on line 2 based on context usage
    let line2BulletColor: typeof chalk.hex;
    if (usedPercentage > 85) line2BulletColor = chalk.hex('#ff4444');
    else if (usedPercentage > 70) line2BulletColor = chalk.hex('#ffaa00');
    else line2BulletColor = chalk.hex('#44aa44');

    const line2 =
      line2BulletColor('●') +
      ' ' +
      bar +
      ' ' +
      contextTokStr +
      rateLimitStr +
      '  │  ' +
      chalk.green(formatCost(cost)) +
      '  ' +
      chalk.dim(formatDuration(duration)) +
      (mcpCount > 0 ? '  ' + chalk.hex('#AA88FF')(`MCP:${mcpCount}`) : '');

    // ── Build activity line string ──
    let activityLine = '';
    if (showActivity) {
      const parts: string[] = [];
      for (const t of runningTools.slice(-3)) {
        parts.push(
          chalk.yellow('◐') + ' ' + chalk.cyan(t.name) +
          (t.target ? chalk.dim(`: ${truncate(t.target.replace(/\\/g, '/'), 25)}`) : '')
        );
      }
      if ((runningTools.length > 0 || runningAgents.length > 0) && sortedCompletedTools.length > 0) {
        parts.push('  │  ');
      }
      for (const [name, count] of sortedCompletedTools) {
        parts.push(chalk.green('✓') + ' ' + name + ' ' + chalk.dim(`×${count}`) + '  ');
      }
      for (const a of runningAgents.slice(0, 2)) {
        parts.push(
          chalk.yellow('◐') + ' ' + chalk.magenta(a.type) +
          (a.description ? chalk.dim(`: ${truncate(a.description, 30)}`) : '') + '  '
        );
      }
      activityLine = parts.join('');
    }

    // ── Build todo line string ──
    const todoLine = (todos && todos.inProgress)
      ? chalk.yellow('▸') + ' ' + truncate(todos.inProgress, 60) + ' ' + chalk.dim(`(${todos.completed}/${todos.total})`)
      : '';

    return (
      <Box flexDirection="column" gap={0} marginTop={0}>
        {/* Line 1 — Identity: model, provider, project, branch */}
        <Box>
          <Text>
            <Ansi>{line1}</Ansi>
          </Text>
        </Box>

        {/* Line 2 — Status: context bar, tokens, rate limits, cost, duration */}
        <Box>
          <Text>
            <Ansi>{line2}</Ansi>
          </Text>
        </Box>

        {/* Activity line — tools & agents (claude-hud style) */}
        {activityLine && (
          <Box>
            <Text>
              <Ansi>{activityLine}</Ansi>
            </Text>
          </Box>
        )}

        {/* Todo progress line */}
        {todoLine && (
          <Box>
            <Text>
              <Ansi>{todoLine}</Ansi>
            </Text>
          </Box>
        )}
      </Box>
    );
  })() : null;

  return (
    <Box paddingX={paddingX} flexDirection="column" gap={0} marginTop={0}>
      {filteredStatusLineText && (
        <Box paddingLeft={1} marginBottom={0} justifyContent="flex-start">
          <Ansi>{chalk.gray.dim(filteredStatusLineText)}</Ansi>
        </Box>
      )}
      {defaultStatusLine || (isFullscreenEnvEnabled() ? <Text> </Text> : null)}
    </Box>
  );
}

export const StatusLine = memo(StatusLineInner);
