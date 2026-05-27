import type { Command } from '../../commands.js';

const reloadSkills = {
  type: 'local-jsx',
  name: 'reload-skills',
  description: 'Clear skill caches to force re-scan on next command invocation',
  supportsNonInteractive: false,
  load: () => import('./reload-skills.js'),
} satisfies Command;

export default reloadSkills;
