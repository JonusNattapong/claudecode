/**
 * /daemon command implementation.
 */

import { createElement, type ReactNode } from 'react';
import {
  getAutonomousStatus,
  startAutonomousAgent,
  stopAutonomousAgent,
} from '../../services/autonomous/supervisorIntegration.js';
import type { ToolUseContext } from '../../Tool.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import { DaemonMenu } from './DaemonMenu.js';
import { formatDaemonStatus } from './daemonStatus.js';

function parseArgs(args: string): string[] {
  const result: string[] = [];
  let current = '';
  const inQuotes = false;
  for (let i = 0; i < args.length; i++) {
    const char = args[i]!;
    if (char === ' ' && !inQuotes) {
      if (current.trim().length > 0) result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) result.push(current.trim());
  return result;
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<ReactNode | null> {
  const tokens = parseArgs(args || '');
  const subcommand = tokens[0]?.toLowerCase();

  if (!subcommand) {
    return createElement(DaemonMenu, { onDone });
  }

  switch (subcommand) {
    case 'start': {
      const ok = await startAutonomousAgent();
      if (ok) {
        onDone('24/7 autonomous agent started. Use `/daemon status` to check.', { display: 'system' });
      } else {
        onDone('Failed to start autonomous agent.', { display: 'system' });
      }
      break;
    }

    case 'stop': {
      const ok = await stopAutonomousAgent();
      if (ok) {
        onDone('Autonomous agent stopped.', { display: 'system' });
      } else {
        onDone('Autonomous agent was not running.', { display: 'system' });
      }
      break;
    }

    case 'restart': {
      await stopAutonomousAgent();
      await new Promise(r => setTimeout(r, 1000));
      const ok = await startAutonomousAgent();
      if (ok) {
        onDone('Autonomous agent restarted.', { display: 'system' });
      } else {
        onDone('Failed to restart autonomous agent.', { display: 'system' });
      }
      break;
    }

    case 'status':
    default: {
      const status = await getAutonomousStatus();
      onDone(formatDaemonStatus(status), { display: 'system' });
      break;
    }
  }

  return null;
}
