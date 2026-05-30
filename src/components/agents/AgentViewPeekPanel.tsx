/**
 * AgentViewPeekPanel — Peek panel shown when Space is pressed on a session row.
 * Shows session state, recent activity, permissions, and a reply input.
 */

import figures from 'figures';
import * as React from 'react';
import { Box, Text } from '../../ink.js';
import type { ToolUseConfirm } from '../../Tool.js';
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js';
import { Divider } from '../design-system/Divider.js';
import { PermissionRequest } from '../permissions/PermissionRequest.js';
import TextInput from '../TextInput.js';
import { formatTimeAgo, getActivityPreview, getPRStatusLabel } from './AgentViewRow.js';
import { isWaitingForInput } from './utils.js';

type Props = {
  task: LocalAgentTaskState;
  pendingPermissions: ToolUseConfirm[];
  replyText: string;
  onReplyChange: (text: string) => void;
  onReplySubmit: (text: string) => void;
  cursorOffset: number;
  onCursorOffsetChange: (offset: number) => void;
};

export function AgentViewPeekPanel({
  task,
  pendingPermissions,
  replyText,
  onReplyChange,
  onReplySubmit,
  cursorOffset,
  onCursorOffsetChange,
}: Props) {
  const activityPreviewLines = React.useMemo(() => {
    const activities = (task.progress as any)?.recentActivities ?? [];
    if (activities.length === 0) return [];
    return activities
      .slice(-5)
      .map(
        (act: any, i: number) =>
          act.activityDescription ?? `${act.toolName} ${JSON.stringify(act.input)?.slice(0, 40)}`,
      );
  }, [task.progress]);

  const needsInput = isWaitingForInput(task);

  return (
    <Box flexDirection="column" gap={0}>
      <Divider />
      <Box flexDirection="column" padding={1} borderStyle="single" borderColor="dim">
        {/* Header: name + ID + PR info */}
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" gap={2}>
            <Text bold>{(task as any).customName ?? task.agentType ?? 'Agent'}</Text>
            {(task as any)._prInfo && (
              <Text dimColor>
                {figures.arrowRight} PR #{((task as any)._prInfo as any)?.number ?? ''}{' '}
                {getPRStatusLabel(((task as any)._prInfo as any)?.status ?? 'pending_checks')}
              </Text>
            )}
          </Box>
          <Text dimColor>ID: {task.id.slice(0, 8)}</Text>
        </Box>

        {/* Prompt / description */}
        <Box marginY={1}>
          <Text wrap="wrap">{task.prompt ?? getActivityPreview(task)}</Text>
        </Box>

        {/* Row summary (AI-generated) */}
        {(task as any).rowSummary && (
          <Box flexDirection="row" gap={1} marginBottom={1}>
            <Text bold dimColor>
              Status:
            </Text>
            <Text wrap="wrap">{(task as any).rowSummary}</Text>
          </Box>
        )}

        {/* Recent activity */}
        {activityPreviewLines.length > 0 && (
          <Box flexDirection="column" gap={0} marginBottom={1}>
            <Text bold dimColor>
              Recent Activity:
            </Text>
            {activityPreviewLines.map((line: string, i: number) => (
              <Box key={i} paddingLeft={1}>
                <Text dimColor wrap="truncate-end">
                  {figures.bullet} {line}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Pending permissions */}
        {pendingPermissions.length > 0 && (
          <Box flexDirection="column" marginY={1} padding={1} borderStyle="double" borderColor="warning">
            <Text color="warning" bold>
              Pending Permission: {pendingPermissions[0]!.tool.name}
            </Text>
            <Box marginTop={1}>
              <PermissionRequest
                toolUseConfirm={pendingPermissions[0]!}
                toolUseContext={pendingPermissions[0]!.toolUseContext}
                onDone={() => {}}
                onReject={() => {}}
                verbose={true}
                workerBadge={pendingPermissions[0]!.workerBadge}
              />
            </Box>
          </Box>
        )}

        {/* Needs input indicator */}
        {needsInput && (
          <Box flexDirection="column" marginTop={1} padding={1} borderStyle="single" borderColor="yellow">
            <Text color="yellow">This agent needs your input.</Text>
          </Box>
        )}

        {/* Run count for loop sessions */}
        {(task as any).runCount !== undefined && (
          <Box flexDirection="row" gap={1} marginTop={1}>
            <Text dimColor>
              Run {(task as any).runCount} {(task as any).runCount === 1 ? 'iteration' : 'iterations'}
            </Text>
            {(task as any).nextRunIn && <Text dimColor>· next in {(task as any).nextRunIn}</Text>}
          </Box>
        )}

        {/* Timing info */}
        <Box flexDirection="row" gap={2} marginTop={1}>
          {task.startTime && <Text dimColor>Started {formatTimeAgo(task.startTime)} ago</Text>}
          {(task as any).updatedAt && task.startTime !== (task as any).updatedAt && (
            <Text dimColor>· Updated {formatTimeAgo((task as any).updatedAt)} ago</Text>
          )}
        </Box>
      </Box>

      {/* Reply input (shown when needs input) */}
      {needsInput && (
        <Box>
          <Divider />
          <Box flexDirection="row" gap={1} marginTop={1}>
            <Text color="suggestion">&gt;</Text>
            <TextInput
              value={replyText}
              onChange={onReplyChange}
              onSubmit={onReplySubmit}
              columns={80}
              cursorOffset={cursorOffset}
              onChangeCursorOffset={onCursorOffsetChange}
            />
          </Box>
          <Box marginTop={1} justifyContent="center">
            <Text dimColor>Enter to send · Tab to fill suggestion · Esc to close</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
