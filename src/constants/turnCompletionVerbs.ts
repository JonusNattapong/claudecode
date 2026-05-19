// Past tense verbs for turn completion messages
// These verbs work naturally with "for [duration]" (e.g., "Worked for 5s")

/**
 * Returns the list of turn-completion verbs.
 * Always uses the hardcoded built-in list — custom spinnerVerbs only affect the
 * spinner animation, not the post-turn duration message (e.g. "Worked for 5s").
 */
export function getTurnCompletionVerbs(): string[] {
  return TURN_COMPLETION_VERBS;
}

export const TURN_COMPLETION_VERBS = [
  'Baked',
  'Brewed',
  'Churned',
  'Cogitated',
  'Cooked',
  'Crunched',
  'Sautéed',
  'Worked',
];
