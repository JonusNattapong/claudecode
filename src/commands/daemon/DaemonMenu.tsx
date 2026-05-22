import type * as React from 'react';
import { useEffect, useState } from 'react';
import { AutonomousExecutionAccordion } from '../../components/AutonomousExecutionAccordion.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Box, Text, useInput } from '../../ink.js';
import {
  getAutonomousStatus,
  startAutonomousAgent,
  stopAutonomousAgent,
} from '../../services/autonomous/supervisorIntegration.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { type DaemonStatus, formatDaemonStatus } from './daemonStatus.js';

type Action = 'start' | 'stop' | 'restart' | 'refresh' | 'status' | 'task' | 'list' | 'close';

const ACTIONS: Array<{ value: Action; label: string; description: string }> = [
  { value: 'start', label: 'Start daemon', description: 'Enable and start the autonomous agent' },
  { value: 'stop', label: 'Stop daemon', description: 'Stop the autonomous agent and disable auto-start' },
  { value: 'restart', label: 'Restart daemon', description: 'Stop, then start the autonomous agent' },
  { value: 'refresh', label: 'Refresh status', description: 'Reload daemon and queue status' },
  { value: 'status', label: 'Print status', description: 'Close this menu and print the full status block' },
  { value: 'task', label: 'New scheduled task', description: 'Open the /task scheduled task form' },
  { value: 'list', label: 'List queue tasks', description: 'Run /task list' },
  { value: 'close', label: 'Close', description: 'Leave daemon settings unchanged' },
];

function statusColor(status: DaemonStatus | null): 'success' | 'warning' | 'error' | undefined {
  if (!status) return undefined;
  if (status.running) return 'success';
  return status.enabled ? 'warning' : 'error';
}

function StatusSummary({ status }: { status: DaemonStatus | null }) {
  if (!status) {
    return <Text dimColor>Loading daemon status...</Text>;
  }

  const agent = status.agent;
  const tasks = status.tasks;
  const uptime = agent?.running ? Math.round((Date.now() - agent.startedAt) / 1000) : 0;

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={statusColor(status)}>{status.running ? 'Running' : status.enabled ? 'Enabled' : 'Disabled'}</Text>
        <Text dimColor> · auto-start {status.autoStart ? 'on' : 'off'}</Text>
      </Text>
      <Text dimColor>
        PID {agent?.workerPid ?? 'N/A'} · uptime {uptime}s · processed {agent?.tasksProcessed ?? 0} · failed{' '}
        {agent?.tasksFailed ?? 0}
      </Text>
      {tasks && (
        <Text dimColor>
          Queue {tasks.total} total · {tasks.pending} pending · {tasks.inProgress} running · {tasks.deadLetter}{' '}
          dead-letter
        </Text>
      )}
      {agent?.lastErrorMessage && <Text color="error">Last error: {agent.lastErrorMessage}</Text>}
      {agent?.currentTaskTitle && <Text color="suggestion">Current task: {agent.currentTaskTitle}</Text>}
    </Box>
  );
}

export function DaemonMenu({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [focused, setFocused] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const next = await getAutonomousStatus();
    setStatus(next);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runAction = async (action: Action) => {
    setMessage(null);
    switch (action) {
      case 'start': {
        setBusy(true);
        const ok = await startAutonomousAgent();
        await refresh();
        setBusy(false);
        setMessage(ok ? 'Autonomous agent started.' : 'Failed to start autonomous agent.');
        return;
      }
      case 'stop': {
        setBusy(true);
        const ok = await stopAutonomousAgent();
        await refresh();
        setBusy(false);
        setMessage(ok ? 'Autonomous agent stopped.' : 'Autonomous agent was not running.');
        return;
      }
      case 'restart': {
        setBusy(true);
        await stopAutonomousAgent();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const ok = await startAutonomousAgent();
        await refresh();
        setBusy(false);
        setMessage(ok ? 'Autonomous agent restarted.' : 'Failed to restart autonomous agent.');
        return;
      }
      case 'refresh':
        setBusy(true);
        await refresh();
        setBusy(false);
        setMessage('Status refreshed.');
        return;
      case 'status':
        onDone(formatDaemonStatus(status ?? (await getAutonomousStatus())), { display: 'system' });
        return;
      case 'task':
        onDone(undefined, { display: 'skip', nextInput: '/task', submitNextInput: true });
        return;
      case 'list':
        onDone(undefined, { display: 'skip', nextInput: '/task list', submitNextInput: true });
        return;
      case 'close':
        onDone('Daemon unchanged.', { display: 'system' });
        return;
    }
  };

  useInput(
    (_input, key) => {
      if (busy) return;
      if (key.escape) {
        onDone('Daemon unchanged.', { display: 'system' });
        return;
      }
      if (key.upArrow) {
        setFocused(i => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || key.tab) {
        setFocused(i => Math.min(ACTIONS.length - 1, i + 1));
        return;
      }
      if (key.return) {
        void runAction(ACTIONS[focused]!.value);
      }
    },
    { isActive: true },
  );

  return (
    <Dialog
      title="24/7 Autonomous Daemon"
      subtitle="Use arrows to choose an action. Enter runs it."
      onCancel={() => onDone('Daemon unchanged.', { display: 'system' })}
      hideInputGuide
    >
      <Box flexDirection="column" gap={1}>
        <StatusSummary status={status} />
        <AutonomousExecutionAccordion isLoading={busy} />
        <Box flexDirection="column">
          {ACTIONS.map((action, index) => {
            const isFocused = index === focused;
            return (
              <Text key={action.value}>
                <Text color={isFocused ? 'suggestion' : undefined}>{isFocused ? '> ' : '  '}</Text>
                <Text bold={isFocused}>{action.label.padEnd(20)}</Text>
                <Text dimColor>{action.description}</Text>
              </Text>
            );
          })}
        </Box>
        {busy && <Text color="suggestion">Working...</Text>}
        {message && <Text color="success">{message}</Text>}
        <Text dimColor>Esc close · Enter select</Text>
      </Box>
    </Dialog>
  );
}
