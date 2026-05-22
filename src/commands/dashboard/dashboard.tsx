import React, { useCallback, useEffect, useState } from 'react';
import { Orchestrator } from '../../agentRuntime/orchestrator.js';
import { RunStore } from '../../agentRuntime/runStore.js';
import type { AgentRun, AgentState } from '../../agentRuntime/types.js';
import {
  formatCost,
  getTotalCacheCreationInputTokens,
  getTotalCacheReadInputTokens,
  getTotalCost,
  getTotalInputTokens,
} from '../../cost-tracker.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text, useInput } from '../../ink.js';
import {
  getAutonomousStatus,
  startAutonomousAgent,
  stopAutonomousAgent,
} from '../../services/autonomous/supervisorIntegration.js';
import { listTasks, loadQueue, type TaskQueueEntry } from '../../services/autonomous/taskQueue.js';
import { useAppState } from '../../state/AppState.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { renderModelName } from '../../utils/model/model.js';
import { getFullGoalState } from '../../utils/sessionGoalState.js';

interface DashboardProps {
  onDone: LocalJSXCommandOnDone;
}

function drawProgressBar(ratio: number, width = 30): string {
  const filledWidth = Math.round(Math.min(1, Math.max(0, ratio)) * width);
  const emptyWidth = width - filledWidth;
  return '▓'.repeat(filledWidth) + '░'.repeat(emptyWidth);
}

export function DashboardComponent({ onDone }: DashboardProps): React.ReactNode {
  const terminalSize = useTerminalSize();
  const model = useAppState(s => s.mainLoopModelForSession || s.mainLoopModel);
  const mcpClients = useAppState(s => s.mcp.clients);
  const mcpTools = useAppState(s => s.mcp.tools);

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runStates, setRunStates] = useState<Record<string, AgentState>>({});
  const [tasks, setTasks] = useState<TaskQueueEntry[]>([]);
  const [daemonStatus, setDaemonStatus] = useState<any>(null);

  const [selectedRunIdx, setSelectedRunIdx] = useState(0);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);
  const [focusedPane, setFocusedPane] = useState(0); // 0 = Swarm, 1 = Daemons, 2 = Goals & Tasks
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cost and cache metrics
  const totalCost = getTotalCost();
  const inputTokens = getTotalInputTokens();
  const cacheReadTokens = getTotalCacheReadInputTokens();
  const cacheCreationTokens = getTotalCacheCreationInputTokens();
  const totalTokens = inputTokens + cacheReadTokens + cacheCreationTokens;
  const cacheHitRate = totalTokens > 0 ? ((cacheReadTokens / totalTokens) * 100).toFixed(1) : '0.0';

  // Goals
  const sessionGoal = useAppState(s => s.sessionGoal);
  const sessionGoalTurnCount = useAppState(s => s.sessionGoalTurnCount) ?? 0;
  const goalState = getFullGoalState();

  const refreshData = useCallback(async () => {
    try {
      const workspaceRoot = process.cwd();
      const runStore = new RunStore(workspaceRoot);
      const fetchedRuns = await runStore.listRuns();
      setRuns(fetchedRuns);

      // Load agent states for active runs
      const states: Record<string, AgentState> = {};
      for (const run of fetchedRuns.slice(0, 10)) {
        try {
          const stateObj = await runStore.loadState(run.id);
          states[run.id] = stateObj;
        } catch {
          // ignore
        }
      }
      setRunStates(states);

      // Load tasks
      await loadQueue();
      const fetchedTasks = listTasks();
      setTasks(fetchedTasks);

      // Load daemon status
      const ds = await getAutonomousStatus();
      setDaemonStatus(ds);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshData();
    const timer = setInterval(() => {
      void refreshData();
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshData]);

  // Keyboard navigation & controls
  useInput(
    async (input, key) => {
      if (busy) return;

      // Close
      if (key.escape || input === 'q') {
        onDone('Dashboard closed.', { display: 'system' });
        return;
      }

      // Switch Pane
      if (key.tab) {
        setFocusedPane(p => (p + 1) % 3);
        return;
      }

      // Pane specific actions
      if (focusedPane === 0) {
        // Active Swarm pane
        if (key.upArrow) {
          setSelectedRunIdx(i => Math.max(0, i - 1));
          return;
        }
        if (key.downArrow) {
          setSelectedRunIdx(i => Math.min(runs.length - 1, i + 1));
          return;
        }

        // 'k' to Kill/Cancel selected run
        if (input === 'k' && runs.length > 0) {
          const selectedRun = runs[selectedRunIdx];
          if (
            selectedRun &&
            selectedRun.status !== 'completed' &&
            selectedRun.status !== 'failed' &&
            selectedRun.status !== 'cancelled'
          ) {
            setBusy(true);
            setStatusMsg(`Cancelling agent run ${selectedRun.id}...`);
            try {
              const orchestrator = new Orchestrator(process.cwd());
              await orchestrator.cancelRun(selectedRun.id);
              setStatusMsg(`Run ${selectedRun.id} cancelled successfully.`);
            } catch (err: any) {
              setStatusMsg(`Failed to cancel run: ${err.message}`);
            } finally {
              setBusy(false);
              void refreshData();
            }
          }
        }
      } else if (focusedPane === 1) {
        // Background Daemons pane
        // 'r' to Restart autonomous agent
        if (input === 'r') {
          setBusy(true);
          setStatusMsg('Restarting background autonomous agent...');
          try {
            await stopAutonomousAgent();
            await new Promise(r => setTimeout(r, 1000));
            await startAutonomousAgent();
            setStatusMsg('Autonomous agent restarted successfully.');
          } catch (err: any) {
            setStatusMsg(`Failed to restart agent: ${err.message}`);
          } finally {
            setBusy(false);
            void refreshData();
          }
        }
      } else if (focusedPane === 2) {
        // Goals & Tasks pane
        if (key.upArrow) {
          setSelectedTaskIdx(i => Math.max(0, i - 1));
          return;
        }
        if (key.downArrow) {
          setSelectedTaskIdx(i => Math.min(tasks.length - 1, i + 1));
          return;
        }
      }
    },
    { isActive: true },
  );

  // Screen constraints
  const minColumns = 80;
  const minRows = 20;
  if (terminalSize.columns < minColumns || terminalSize.rows < minRows) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="error"
        padding={1}
        alignItems="center"
        justifyContent="center"
      >
        <Text color="error" bold>
          ⚠️ VIEWPORT TOO SMALL
        </Text>
        <Text>
          Please resize your terminal to at least {minColumns}x{minRows}.
        </Text>
        <Text dimColor>
          Current size: {terminalSize.columns}x{terminalSize.rows}
        </Text>
        <Text marginTop={1} color="cyan">
          Press Esc or 'q' to close
        </Text>
      </Box>
    );
  }

  // Active runs counter
  const activeRuns = runs.filter(r => r.status !== 'completed' && r.status !== 'failed' && r.status !== 'cancelled');

  // Render components
  return (
    <Box flexDirection="column" height={terminalSize.rows - 1} width={terminalSize.columns}>
      {/* Header Panel */}
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">
            📊 CEPHCODE SYSTEM DASHBOARD
          </Text>
          <Text color="dim">{new Date().toLocaleTimeString()}</Text>
        </Box>
        <Box gap={4} marginTop={0}>
          <Text>
            [MODEL]:{' '}
            <Text color="suggestion" bold>
              {renderModelName(model)}
            </Text>
          </Text>
          <Text>
            [SESSION COST]:{' '}
            <Text color="success" bold>
              {formatCost(totalCost)}
            </Text>
          </Text>
          <Text>
            [SAVED CACHE]:{' '}
            <Text color="info" bold>
              {cacheHitRate}%
            </Text>
          </Text>
        </Box>
      </Box>

      {/* Middle Panels: Grid Layout */}
      <Box flexDirection="row" flexGrow={1} gap={1} marginTop={0}>
        {/* Left Pane: Active Swarm */}
        <Box
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
          borderStyle="round"
          borderColor={focusedPane === 0 ? 'cyan' : 'gray'}
          paddingX={1}
        >
          <Text bold color={focusedPane === 0 ? 'cyan' : undefined}>
            🤖 ACTIVE SWARM ({activeRuns.length} active)
          </Text>
          <Box flexDirection="column" marginTop={1} flexGrow={1}>
            {runs.length === 0 ? (
              <Text dimColor>No subagent runs found.</Text>
            ) : (
              runs.slice(0, 6).map((run, idx) => {
                const isSelected = focusedPane === 0 && idx === selectedRunIdx;
                const stateObj = runStates[run.id];
                const bulletColor =
                  run.status === 'running' || run.status === 'testing'
                    ? 'success'
                    : run.status === 'planning' || run.status === 'reviewing'
                      ? 'warning'
                      : run.status === 'waiting_approval'
                        ? 'error'
                        : 'gray';

                const statusSymbol = run.status === 'completed' ? '✓' : run.status === 'failed' ? '🔴' : '●';

                return (
                  <Box key={run.id} flexDirection="column" marginTop={idx > 0 ? 1 : 0}>
                    <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
                      {isSelected ? '> ' : '  '}
                      <Text color={bulletColor}>{statusSymbol}</Text> {run.activeAgent || 'Coordinator'}{' '}
                      <Text dimColor>({run.id.slice(-8)})</Text>
                      <Text bold color={bulletColor}>
                        {' '}
                        [{run.status.toUpperCase()}]
                      </Text>
                    </Text>
                    {stateObj && (
                      <Box flexDirection="column" marginLeft={4}>
                        <Text dimColor>
                          └─ Step: {stateObj.step}/{run.budget.maxSteps}
                        </Text>
                        {stateObj.taskSummary && (
                          <Text dimColor numberOfLines={1}>
                            └─ {stateObj.taskSummary}
                          </Text>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* Right Pane: Background Daemons */}
        <Box
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
          borderStyle="round"
          borderColor={focusedPane === 1 ? 'cyan' : 'gray'}
          paddingX={1}
        >
          <Text bold color={focusedPane === 1 ? 'cyan' : undefined}>
            🖥️ BACKGROUND DAEMONS
          </Text>

          {/* Autonomous Daemon Status */}
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="cyan">
              ● cephcoded (Autonomous Agent)
            </Text>
            {daemonStatus ? (
              <Box flexDirection="column" marginLeft={2}>
                <Text>
                  Status:{' '}
                  <Text color={daemonStatus.running ? 'success' : 'error'}>
                    {daemonStatus.running ? 'Running' : 'Stopped'}
                  </Text>
                </Text>
                {daemonStatus.agent && (
                  <>
                    <Text dimColor>PID: {daemonStatus.agent.workerPid ?? 'N/A'}</Text>
                    <Text dimColor>Uptime: {Math.round(daemonStatus.agent.uptime / 1000)}s</Text>
                    <Text dimColor>
                      Processed: {daemonStatus.agent.tasksProcessed} · Failed: {daemonStatus.agent.tasksFailed}
                    </Text>
                  </>
                )}
              </Box>
            ) : (
              <Text dimColor marginLeft={2}>
                Loading daemon status...
              </Text>
            )}
          </Box>

          {/* MCP Servers Connection Status */}
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="cyan">
              🔌 MCP SERVERS ({mcpClients.length})
            </Text>
            {mcpClients.length === 0 ? (
              <Text dimColor marginLeft={2}>
                No active MCP servers.
              </Text>
            ) : (
              mcpClients.slice(0, 4).map(client => {
                const activeTools = mcpTools.filter(t => t.mcpInfo?.serverName === client.name).length;
                return (
                  <Box key={client.name} flexDirection="column" marginLeft={2} marginTop={0}>
                    <Text>
                      ● {client.name}{' '}
                      <Text color={client.status === 'connected' ? 'success' : 'error'}>({client.status})</Text>
                    </Text>
                    <Text dimColor marginLeft={2}>
                      └─ Tools: {activeTools} active
                    </Text>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Panel: Goals & Tasks */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={focusedPane === 2 ? 'cyan' : 'gray'}
        paddingX={1}
        marginTop={0}
        minHeight={6}
      >
        <Text bold color={focusedPane === 2 ? 'cyan' : undefined}>
          🎯 ACTIVE GOALS & TASKS
        </Text>
        <Box flexDirection="column" marginTop={0}>
          {/* Active Goal */}
          {sessionGoal ? (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color="warning">
                🔘 [GOAL]: {sessionGoal}
              </Text>
              <Box flexDirection="column" marginLeft={4}>
                <Text dimColor>
                  Turns taken: {sessionGoalTurnCount}
                  {goalState?.maxTurns ? ` / ${goalState.maxTurns}` : ''}
                </Text>
                {goalState?.maxTurns && (
                  <Box flexDirection="row" alignItems="center">
                    <Text dimColor>[</Text>
                    <Text color="success">{drawProgressBar(sessionGoalTurnCount / goalState.maxTurns, 40)}</Text>
                    <Text dimColor>] {Math.round((sessionGoalTurnCount / goalState.maxTurns) * 100)}% Complete</Text>
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            <Text dimColor>No active session goal. Set one via `/goal &lt;description&gt;`.</Text>
          )}

          {/* Scheduled / Autonomous Tasks list */}
          {tasks.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>📋 Task Queue List:</Text>
              {tasks.slice(0, 3).map((task, idx) => {
                const isSelected = focusedPane === 2 && idx === selectedTaskIdx;
                const statusColor =
                  task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'warning' : 'gray';
                return (
                  <Text key={task.id} bold={isSelected} color={isSelected ? 'cyan' : undefined} marginLeft={2}>
                    {isSelected ? '> ' : '  '}
                    <Text color={statusColor}>[{task.status.toUpperCase()}]</Text> {task.title}{' '}
                    <Text dimColor>({task.id})</Text>
                  </Text>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer / Control Instructions */}
      <Box justifyContent="space-between" marginTop={0} paddingX={1}>
        <Box gap={3}>
          <Text dimColor>[Tab] Switch Pane</Text>
          {focusedPane === 0 && runs.length > 0 && <Text color="warning">[k] Kill Selected Run</Text>}
          {focusedPane === 1 && <Text color="warning">[r] Restart Daemon</Text>}
        </Box>
        {statusMsg ? (
          <Text color="info" bold>
            {statusMsg}
          </Text>
        ) : (
          <Text color="cyan">[Esc/q] Close Dashboard</Text>
        )}
      </Box>
    </Box>
  );
}

export async function call(onDone: LocalJSXCommandOnDone, _context: any, _args: string): Promise<React.ReactNode> {
  return React.createElement(DashboardComponent, { onDone });
}
