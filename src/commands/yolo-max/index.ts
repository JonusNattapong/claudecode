import type { Command } from '../../commands.js'

const yoloMax = {
  type: 'local-jsx',
  name: 'yolo-max',
  description: 'Enable YOLO MAX mode (autonomous + bypass sandbox when available)',
  load: () => import('./yolo-max.js'),
} satisfies Command

export default yoloMax
