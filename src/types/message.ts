/**
 * Core message types used across the CLI, bridge, and assistant subsystems.
 */

export interface Message {
  type: string;
  [key: string]: unknown;
}

export interface AssistantMessage {
  type: 'assistant';
  message: unknown;
  uuid: string;
  session_id: string;
  error?: string;
  parent_tool_use_id?: string | null;
}

export interface UserMessage {
  type: 'user';
  text: string;
  uuid: string;
  session_id?: string;
}

export interface AttachmentMessage {
  type: 'attachment';
  uuid: string;
  name: string;
  content: unknown;
  session_id?: string;
}

export interface SystemMessage {
  type: 'system';
  content: unknown;
  uuid: string;
}

export interface SystemAPIErrorMessage {
  type: 'system_api_error';
  error: string;
  uuid: string;
}

export interface SystemFileSnapshotMessage {
  type: 'system_file_snapshot';
  uuid: string;
  session_id?: string;
  files?: string[];
}

export interface SystemLocalCommandMessage {
  type: 'system_local_command';
  uuid: string;
  command: string;
  output: string;
  exit_code: number;
}

export interface ProgressMessage {
  type: 'progress';
  uuid: string;
  label: string;
  progress: number;
  total?: number;
}

export interface StreamEvent {
  type: 'stream_event';
  event: string;
  data: unknown;
  uuid: string;
}

export interface CompactMetadata {
  sourceLength: number;
  targetLength: number;
  originalTokens?: number;
  compactedTokens?: number;
}
