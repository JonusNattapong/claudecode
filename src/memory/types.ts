export type MemoryType = 'user' | 'project' | 'feedback' | 'agent' | 'pending' | 'wiki' | 'run' | 'index';

export interface MemoryMetadata {
  id: string;
  type: MemoryType;
  scope?: string;
  visibility?: 'local' | 'remote';
  confidence?: 'low' | 'medium' | 'high';
  source?: string;
  created?: string;
  updated?: string;
  tags?: string[];
  suggested_target?: string;
  source_run?: string;
}

export interface SourceDocument {
  id: string;
  sourceType: string;
  uri: string;
  title?: string;
  sourcePath?: string;
  contentHash: string;
  truthPriority: number;
  editable: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

export interface MemoryChunk {
  id: string;
  sourceId: string;
  chunkIndex: number;
  markdown: string;
  tokenCount: number;
  contentHash: string;
  parentHash?: string;
  truthPriority: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

export interface MemorySearchResult {
  id: string;
  title?: string;
  sourcePath: string;
  sourceType: string;
  excerpt: string;
  score: number;
  contentHash: string;
  lastSeenAt: string;
  stale: boolean;
}
