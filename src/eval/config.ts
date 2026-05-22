import { join } from 'path';
import type { EvalConfig } from './types.js';

export function getEvalConfig(cwd: string): EvalConfig {
  const evalsDir = join(cwd, '.claude', 'evals');
  return {
    tasksDir: join(evalsDir, 'tasks'),
    gradersDir: join(evalsDir, 'graders'),
    runsDir: join(evalsDir, 'runs'),
    baselinesDir: join(evalsDir, 'baselines'),
    reportsDir: join(evalsDir, 'reports'),
  };
}
