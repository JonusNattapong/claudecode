import { mkdir } from 'fs/promises';
import { join } from 'path';
import { getFsImplementation } from '../utils/fsOperations.js';

export async function initWorkspace(cwd: string): Promise<void> {
  const fsImpl = getFsImplementation();
  const dirs = [
    join(cwd, '.claude'),
    join(cwd, '.claude', 'research'),
    join(cwd, '.claude', 'research', 'runs'),
    join(cwd, '.claude', 'wiki'),
    join(cwd, '.claude', 'wiki', 'Research'),
    join(cwd, '.claude', 'memory'),
    join(cwd, '.claude', 'memory', 'pending'),
    join(cwd, '.claude', 'index'),
  ];

  for (const dir of dirs) {
    if (!fsImpl.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

export async function getResearchWorkspaceStatus(cwd: string): Promise<{
  initialized: boolean;
  researchDir: string;
  runsDir: string;
  wikiResearchDir: string;
  pendingMemoryDir: string;
  indexDir: string;
}> {
  const fsImpl = getFsImplementation();
  const researchDir = join(cwd, '.claude', 'research');
  const runsDir = join(cwd, '.claude', 'research', 'runs');
  const wikiResearchDir = join(cwd, '.claude', 'wiki', 'Research');
  const pendingMemoryDir = join(cwd, '.claude', 'memory', 'pending');
  const indexDir = join(cwd, '.claude', 'index');

  const initialized =
    fsImpl.existsSync(researchDir) &&
    fsImpl.existsSync(runsDir) &&
    fsImpl.existsSync(wikiResearchDir) &&
    fsImpl.existsSync(pendingMemoryDir) &&
    fsImpl.existsSync(indexDir);

  return {
    initialized,
    researchDir,
    runsDir,
    wikiResearchDir,
    pendingMemoryDir,
    indexDir,
  };
}
