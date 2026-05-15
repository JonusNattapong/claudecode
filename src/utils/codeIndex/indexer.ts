/**
 * Code index builder
 *
 * Scans project files and builds an in-memory code index.
 * Supports incremental updates and persistence.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { basename, join, relative } from 'path'
import type { CodeChunk, CodeIndexConfig, SearchResult } from './types.js'
import { DEFAULT_INDEX_CONFIG } from './types.js'
import { chunkFile, getLanguage, getSupportedExtensions } from './tokenizer.js'
import { createCodeSearch, searchCode, searchCodeExact } from './search.js'
import Fuse from 'fuse.js'

const INDEX_DIR = '.claude/code-index'
const INDEX_FILE = 'index.json'
const FILE_META_FILE = 'file-meta.json'

// Files to exclude by default
const DEFAULT_EXCLUDE_PATTERNS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.tmp',
  '.temp',
  '__pycache__',
  '.next',
  '.nuxt',
  'vendor',
  'third_party',
])

// Max file size to index (1MB)
const MAX_FILE_SIZE = 1024 * 1024

interface FileMetadata {
  mtimeMs: number
  size: number
}

interface PersistedIndex {
  version: number
  chunks: CodeChunk[]
  lastIndexed: string
  fileMeta: Record<string, FileMetadata>
}

export class CodeIndex {
  private chunks: CodeChunk[] = []
  private searcher: Fuse<CodeChunk> | null = null
  private config: CodeIndexConfig
  private lastIndexed: Date | null = null
  private fileMeta: Record<string, FileMetadata> = {}
  private indexPath: string = ''

  constructor(config: Partial<CodeIndexConfig> = {}, basePath?: string) {
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config }
    this.indexPath = basePath || INDEX_DIR
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.chunks = []
    this.searcher = null
    this.lastIndexed = null
  }

  /**
   * Get chunk count
   */
  get size(): number {
    return this.chunks.length
  }

  /**
   * Check if index is ready
   */
  get isIndexed(): boolean {
    return this.searcher !== null && this.chunks.length > 0
  }

  /**
   * Get last indexing time
   */
  get lastUpdate(): Date | null {
    return this.lastIndexed
  }

  /**
   * Index a single file
   */
  indexFile(filePath: string, content: string): number {
    const chunks = chunkFile(content, filePath, this.config)
    this.chunks.push(...chunks)
    this.searcher = null // Invalidate searcher
    return chunks.length
  }

  /**
   * Index multiple files
   */
  async indexFiles(files: Array<{ path: string; content: string }>): Promise<number> {
    let totalChunks = 0
    for (const file of files) {
      totalChunks += this.indexFile(file.path, file.content)
    }
    this.rebuildSearcher()
    this.lastIndexed = new Date()
    return totalChunks
  }

  /**
   * Index all files in a directory recursively
   */
  async indexDirectory(
    dirPath: string,
    onProgress?: (indexed: number, total: number, current: string) => void,
  ): Promise<number> {
    const files = await this.discoverFiles(dirPath)
    const total = files.length
    let indexed = 0

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const chunksAdded = this.indexFile(filePath, content)
        
        // Store file metadata
        const stat = statSync(filePath)
        this.fileMeta[filePath] = { mtimeMs: stat.mtimeMs, size: stat.size }
        
        indexed += chunksAdded
        onProgress?.(indexed, total, filePath)
      } catch (error) {
        // Skip unreadable files
      }
    }

    this.rebuildSearcher()
    this.lastIndexed = new Date()

    // Auto-save after indexing
    this.save(dirPath)

    return this.chunks.length
  }

  /**
   * Discover all indexable files in a directory
   */
  async discoverFiles(dirPath: string): Promise<string[]> {
    const files: string[] = []
    const supportedExts = new Set(getSupportedExtensions())

    const scan = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          if (DEFAULT_EXCLUDE_PATTERNS.has(entry.name)) continue

          const fullPath = join(dir, entry.name)

          if (entry.isDirectory()) {
            scan(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()!.toLowerCase() : ''
            if (supportedExts.has(ext) || entry.name.endsWith('.md')) {
              try {
                const stat = statSync(fullPath)
                if (stat.size <= MAX_FILE_SIZE) {
                  files.push(fullPath)
                }
              } catch { /* skip */ }
            }
          }
        }
      } catch { /* skip inaccessible dirs */ }
    }

    scan(dirPath)
    return files
  }

  /**
   * Rebuild the search index
   */
  private rebuildSearcher(): void {
    if (this.chunks.length === 0) {
      this.searcher = null
      return
    }

    // Limit chunks if needed
    const chunks = this.chunks.length > this.config.maxChunks
      ? this.chunks.slice(0, this.config.maxChunks)
      : this.chunks

    this.searcher = createCodeSearch(chunks)
  }

  /**
   * Search the index
   */
  search(query: string, limit = 10, useExact = false): SearchResult[] {
    if (!this.searcher || this.chunks.length === 0) {
      return []
    }

    if (useExact) {
      return searchCodeExact(this.chunks, query, limit)
    }

    return searchCode(this.searcher, query, limit)
  }

  /**
   * Get chunks for a specific file
   */
  getFileChunks(filePath: string): CodeChunk[] {
    return this.chunks.filter(c => c.filePath === filePath)
  }

  /**
   * Export index stats
   */
  getStats(): {
    totalChunks: number
    indexedFiles: number
    languageBreakdown: Record<string, number>
    lastIndexed: Date | null
  } {
    const files = new Set(this.chunks.map(c => c.filePath))
    const languageBreakdown: Record<string, number> = {}

    for (const chunk of this.chunks) {
      languageBreakdown[chunk.language] = (languageBreakdown[chunk.language] || 0) + 1
    }

    return {
      totalChunks: this.chunks.length,
      indexedFiles: files.size,
      languageBreakdown,
      lastIndexed: this.lastIndexed,
    }
  }

  /**
   * Save index to disk
   */
  save(dirPath?: string): boolean {
    try {
      const targetDir = dirPath || this.indexPath
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      const data: PersistedIndex = {
        version: 1,
        chunks: this.chunks,
        lastIndexed: this.lastIndexed?.toISOString() || '',
        fileMeta: this.fileMeta,
      }

      writeFileSync(join(targetDir, INDEX_FILE), JSON.stringify(data, null, 2))
      return true
    } catch (error) {
      console.error('Failed to save index:', error)
      return false
    }
  }

  /**
   * Load index from disk
   */
  load(dirPath?: string): boolean {
    try {
      const targetDir = dirPath || this.indexPath
      const indexPath = join(targetDir, INDEX_FILE)

      if (!existsSync(indexPath)) {
        return false
      }

      const data: PersistedIndex = JSON.parse(readFileSync(indexPath, 'utf8'))

      if (data.version !== 1 || !data.chunks || data.chunks.length === 0) {
        return false
      }

      this.chunks = data.chunks
      this.fileMeta = data.fileMeta || {}
      this.lastIndexed = data.lastIndexed ? new Date(data.lastIndexed) : null
      this.rebuildSearcher()

      return true
    } catch (error) {
      console.error('Failed to load index:', error)
      return false
    }
  }

  /**
   * Check which files have changed and need reindexing
   */
  getChangedFiles(dirPath: string): string[] {
    const changed: string[] = []
    const currentFiles = new Set<string>()

    const scan = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          if (DEFAULT_EXCLUDE_PATTERNS.has(entry.name)) continue

          const fullPath = join(dir, entry.name)

          if (entry.isDirectory()) {
            scan(fullPath)
          } else if (entry.isFile()) {
            currentFiles.add(fullPath)
            const savedMeta = this.fileMeta[fullPath]
            try {
              const stat = statSync(fullPath)
              if (!savedMeta || stat.mtimeMs !== savedMeta.mtimeMs || stat.size !== savedMeta.size) {
                changed.push(fullPath)
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }

    scan(dirPath)

    // Check for deleted files
    for (const savedPath of Object.keys(this.fileMeta)) {
      if (!currentFiles.has(savedPath)) {
        // File was deleted, remove its chunks
        this.chunks = this.chunks.filter(c => c.filePath !== savedPath)
      }
    }

    return changed
  }

  /**
   * Update index with changed files only
   */
  async updateIndex(dirPath: string): Promise<number> {
    const changedFiles = this.getChangedFiles(dirPath)
    let updated = 0

    for (const filePath of changedFiles) {
      try {
        // Remove old chunks for this file
        this.chunks = this.chunks.filter(c => c.filePath !== filePath)

        // Add new chunks
        const content = readFileSync(filePath, 'utf-8')
        const chunksAdded = this.indexFile(filePath, content)

        // Update file metadata
        const stat = statSync(filePath)
        this.fileMeta[filePath] = { mtimeMs: stat.mtimeMs, size: stat.size }
        updated += chunksAdded
      } catch { /* skip unreadable files */ }
    }

    if (updated > 0) {
      this.rebuildSearcher()
      this.lastIndexed = new Date()
    }

    return updated
  }
}

// Singleton instance
let globalIndex: CodeIndex | null = null
let globalBasePath: string | undefined = undefined

export function getCodeIndex(config?: Partial<CodeIndexConfig>, basePath?: string): CodeIndex {
  if (!globalIndex) {
    globalIndex = new CodeIndex(config, basePath)
    globalBasePath = basePath

    // Try to load persisted index on startup
    if (basePath) {
      globalIndex.load(basePath)
    }
  }
  return globalIndex
}

export function resetCodeIndex(): void {
  globalIndex = null
  globalBasePath = undefined
}