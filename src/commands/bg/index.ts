import type { Command } from '../../commands.js';

const bg = {
  type: 'local',
  name: 'bg',
  description: 'Continue and run the active session in the background as a daemon session',
  supportsNonInteractive: true,
  load: () => import('./bg.js'),
} satisfies Command;

export default bg;
