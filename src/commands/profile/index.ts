import type { Command } from '../../commands.js';

const profile = {
  type: 'local-jsx' as const,
  name: 'profile',
  aliases: ['profiles'],
  description: 'Manage profiles — switch, create, delete, or rename isolated configurations',
  argumentHint: '[switch|create|delete|rename|current] [name]',
  load: () => import('./profile.jsx'),
} satisfies Command;

export default profile;
