// Voice shortcut type definitions for Phase 3.

export type ShortcutActionType =
  | 'command'   // execute a slash command: "/compact"
  | 'insert'    // insert template text into prompt
  | 'model'     // switch AI model
  | 'provider'  // switch AI provider
  | 'script'    // run a shell script (requires confirm)
  | 'prompt';   // execute with predefined prompt

export type ShortcutAction =
  | { type: 'command'; value: string }
  | { type: 'insert'; value: string }
  | { type: 'model'; value: string }
  | { type: 'provider'; value: string }
  | { type: 'script'; value: string }
  | { type: 'prompt'; value: string };

export interface VoiceShortcut {
  /** Unique identifier */
  id: string;
  /** Display name shown in /voice shortcut list */
  name: string;
  /** Trigger phrases — any of these match to fire the action */
  phrases: string[];
  /** What to do when matched */
  action: ShortcutAction;
  /** Restrict to specific language; 'any' means all languages */
  language?: string;
  /** Ask confirmation before executing */
  confirm?: boolean;
  /** Enable/disable without removing */
  enabled: boolean;
}

export type MatchStrategy = 'exact' | 'keyword' | 'fuzzy';

export interface MatchResult {
  shortcut: VoiceShortcut;
  /** 0.0 - 1.0 confidence score */
  confidence: number;
  /** Which strategy produced the match */
  strategy: MatchStrategy;
  /** The phrase that matched */
  matchedPhrase: string;
}

export interface ShortcutMatchOptions {
  strategy: MatchStrategy;
  /** Minimum confidence threshold (0.0-1.0). Default 0.7 */
  threshold: number;
}

export const DEFAULT_SHORTCUT_MATCH_OPTIONS: ShortcutMatchOptions = {
  strategy: 'keyword',
  threshold: 0.7,
};
