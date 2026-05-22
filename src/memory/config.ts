import { join } from 'path';

export interface ClaudeMemoryConfig {
  enabled: boolean;
  rootDir: string;
  memoryDir: string;
  wikiDir: string;
  indexDir: string;
  runsDir: string;
  maxChunkTokens: number;
  redactSecrets: boolean;
  autoCapture: boolean;
  autoSync: boolean;
  includeGitHistory: boolean;
  includeGithub: boolean;
  includeLogs: boolean;
  excludeGlobs: string[];
}

export function getDefaultConfig(rootDir: string): ClaudeMemoryConfig {
  return {
    enabled: true,
    rootDir,
    memoryDir: join(rootDir, '.claude', 'memory'),
    wikiDir: join(rootDir, '.claude', 'wiki'),
    indexDir: join(rootDir, '.claude', 'index'),
    runsDir: join(rootDir, '.claude', 'runs'),
    maxChunkTokens: 3000,
    redactSecrets: true,
    autoCapture: true,
    autoSync: false,
    includeGitHistory: false,
    includeGithub: false,
    includeLogs: true,
    excludeGlobs: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/*.pem',
      '**/*.key',
      '**/*.p12',
      '**/*.pfx',
      '**/id_rsa',
      '**/id_ed25519',
      '**/.env',
      '**/.env.*',
    ],
  };
}
