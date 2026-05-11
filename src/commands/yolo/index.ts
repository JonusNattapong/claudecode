import type { Command } from '../../commands.js'

const yolo = {
  type: 'local-jsx',
  name: 'yolo',
  description: 'Choose YOLO level 1, 2, or 3',
  load: () => import('./yolo.js'),
} satisfies Command

export default yolo
