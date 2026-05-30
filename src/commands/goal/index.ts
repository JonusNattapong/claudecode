/**
 * Goal command - minimal metadata only.
 * Implementation is lazy-loaded from goal.ts to reduce startup time.
 */
import type { Command } from '../../commands.js';

const goal = {
  type: 'local-jsx',
  name: 'goal',
  description:
    'Set a session goal with autonomous execution. /goal to view, /goal <text> to set, /goal clear to remove, /goal pause/resume to pause/resume',
  immediate: true,
  argumentHint: '[text|clear|pause|resume]',
  load: () => import('./goal.js'),
} satisfies Command;

export default goal;
