/**
 * useAgentViewSummaries — Hook to manage AI-generated row summaries for agent view.
 *
 * Polls agent summary service and updates task state with the latest summary.
 * This replaces the raw tool-name preview with a short natural-language description.
 */

import { useEffect, useRef } from 'react';
import { refreshPRStatus } from '../services/AgentPRStatus/prStatus.js';
import { isProcessEffectivelyAlive } from '../services/SessionLifecycle/sessionLifecycle.js';
import type { SetAppState } from '../Task.js';
import { isLocalAgentTask } from '../tasks/LocalAgentTask/LocalAgentTask.js';
import type { TaskState } from '../tasks/types.js';

const SUMMARY_POLL_INTERVAL_MS = 15_000; // 15 seconds as per official spec
const PR_STATUS_POLL_INTERVAL_MS = 30_000; // Every 30 seconds

interface UseAgentViewSummariesProps {
  tasks: Record<string, TaskState>;
  setAppState: SetAppState;
}

/**
 * Polls tasks periodically to:
 * 1. Update row summaries from AgentProgress
 * 2. Check PR status changes
 * 3. Update process-alive state
 */
export function useAgentViewSummaries({ tasks, setAppState }: UseAgentViewSummariesProps) {
  const summaryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Update summaries from task progress
    summaryTimerRef.current = setInterval(() => {
      setAppState(prev => {
        let changed = false;
        const newTasks = { ...prev.tasks };

        for (const [id, task] of Object.entries(newTasks)) {
          if (!isLocalAgentTask(task)) continue;

          const lt = task as any;
          if (lt.fromSupervisorRoster) continue;

          const newSummary = lt.progress?.summary ?? null;
          const currentSummary = lt.rowSummary ?? null;

          if (newSummary && newSummary !== currentSummary) {
            newTasks[id] = { ...task, rowSummary: newSummary, updatedAt: Date.now() } as any;
            changed = true;
          }

          // Update process-alive state
          const wasAlive = lt.processRunning !== false;
          const nowAlive = isProcessEffectivelyAlive(id, task);
          if (wasAlive !== nowAlive) {
            newTasks[id] = { ...newTasks[id], processRunning: nowAlive } as any;
            changed = true;
          }
        }

        return changed ? { ...prev, tasks: newTasks } : prev;
      });
    }, SUMMARY_POLL_INTERVAL_MS);

    // Poll PR statuses
    prTimerRef.current = setInterval(() => {
      setAppState(prev => {
        let changed = false;
        const newTasks = { ...prev.tasks };

        for (const [id, task] of Object.entries(newTasks)) {
          if (!isLocalAgentTask(task)) continue;

          const lt = task as any;
          if (lt.fromSupervisorRoster) continue;

          if (lt._prInfo) {
            const updated = refreshPRStatus(task as any);
            if (updated && updated.status !== lt._prInfo.status) {
              newTasks[id] = {
                ...task,
                _prInfo: updated,
                prUrl: updated.url,
                prStatus: updated.status,
              } as any;
              changed = true;
            }
          } else {
            // Check if this task has created a PR
            const newPR = refreshPRStatus(task as any);
            if (newPR) {
              newTasks[id] = {
                ...task,
                _prInfo: newPR,
                prUrl: newPR.url,
                prStatus: newPR.status,
              } as any;
              changed = true;
            }
          }
        }

        return changed ? { ...prev, tasks: newTasks } : prev;
      });
    }, PR_STATUS_POLL_INTERVAL_MS);

    return () => {
      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
      if (prTimerRef.current) clearInterval(prTimerRef.current);
    };
  }, [setAppState]);
}
