import { mkdir } from 'fs/promises';
import { join } from 'path';
import { getFsImplementation } from '../utils/fsOperations.js';

export async function initWorkspace(cwd: string): Promise<void> {
  const fsImpl = getFsImplementation();
  const dirs = [
    join(cwd, '.ceph'),
    join(cwd, '.ceph', 'research'),
    join(cwd, '.ceph', 'research', 'runs'),
    join(cwd, '.ceph', 'wiki'),
    join(cwd, '.ceph', 'wiki', 'Research'),
    join(cwd, '.ceph', 'memory'),
    join(cwd, '.ceph', 'memory', 'pending'),
    join(cwd, '.ceph', 'index'),
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
  const researchDir = join(cwd, '.ceph', 'research');
  const runsDir = join(cwd, '.ceph', 'research', 'runs');
  const wikiResearchDir = join(cwd, '.ceph', 'wiki', 'Research');
  const pendingMemoryDir = join(cwd, '.ceph', 'memory', 'pending');
  const indexDir = join(cwd, '.ceph', 'index');

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
