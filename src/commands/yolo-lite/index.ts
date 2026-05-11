import type { Command } from '../../commands.js'

const yoloLite = {
  type: 'local-jsx',
  name: 'yolo-lite',
  description: 'Enable YOLO Lite mode (auto-allow with guardian checks)',
  load: () => import('./yolo-lite.js'),
} satisfies Command

export default yoloLite
