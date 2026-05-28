/**
 * /reload-skills — Re-scan skill directories without restarting the session.
 * Implementation lazy-loaded.
 */
import type { Command } from '../../commands.js';

const reloadSkills = {
  type: 'local-jsx',
  name: 'reload-skills',
  description: 'Re-scan skill directories to pick up newly added or changed skills',
  supportsNonInteractive: false,
  load: () => import('./reload-skills.js'),
} satisfies Command;

export default reloadSkills;
