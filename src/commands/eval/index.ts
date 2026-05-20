import type { Command } from '../../commands.js';

const evalCmd: Command = {
  type: 'local-jsx',
  name: 'eval',
  description: 'Evaluate AI agent performance with the verification harness',
  load: () => import('./eval.js'),
};

export default evalCmd;
