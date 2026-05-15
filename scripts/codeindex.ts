#!/usr/bin/env bun
/**
 * CodeIndex CLI Wrapper
 *
 * Direct usage of the built-in CodeIndex without needing feature flag.
 * Indexes codebase and provides fuzzy search.
 *
 * Usage:
 *   bun run scripts/codeindex.ts index     # build index
 *   bun run scripts/codeindex.ts search <q>  # search code
 *   bun run scripts/codeindex.ts stats     # show stats
 */

import { CodeIndex, getCodeIndex, resetCodeIndex } from '../src/utils/codeIndex/index.ts'

const cmd = process.argv[2]
const query = process.argv.slice(3).join(' ')

async function main() {
  const index = getCodeIndex({}, process.cwd())

  switch (cmd) {
    case 'index': {
      console.log('Indexing...')
      const files = await index.discoverFiles('./src')
      console.log(`Found ${files.length} files`)
      let indexed = 0
      for (let i = 0; i < files.length; i++) {
        try {
          const content = await Bun.file(files[i]).text()
          indexed += index.indexFile(files[i], content)
          if (i % 200 === 0) {
            await new Promise(r => setTimeout(r, 0))
            process.stdout.write(`\r  ${i}/${files.length} files, ${indexed} chunks`)
          }
        } catch { /* skip unreadable */ }
      }
      const saved = index.save(process.cwd())
      const stats = index.getStats()
      console.log(`\nDone: ${indexed} chunks from ${files.length} files`)
      console.log(`Index saved: ${saved}`)
      if (stats) {
        console.log(`Languages: ${Object.entries(stats.languageBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')}`)
      }
      break
    }

    case 'search': {
      if (!index.isIndexed) {
        // Try loading saved index first
        const loaded = index.load(process.cwd())
        if (!loaded) {
          console.log('No index found. Run `bun run scripts/codeindex.ts index` first.')
          process.exit(1)
        }
      }
      if (!query) { console.log('Usage: bun run scripts/codeindex.ts search <query>'); process.exit(1) }
      const results = index.search(query, 10)
      if (results.length === 0) { console.log(`No results for "${query}"`); process.exit(0) }
      console.log(`Found ${results.length} results for "${query}":\n`)
      for (const r of results) {
        const file = r.chunk.filePath.replace(/\\/g, '/')
        const lineRange = `${r.chunk.startLine}-${r.chunk.endLine}`
        const lines = r.chunk.content.split('\n')
        console.log(`[${file}:${lineRange}] (${(r.score * 100).toFixed(0)}%)`)
        // Show context: first line + last meaningful line
        const content = lines.slice(0, 4).join('\n').slice(0, 200)
        console.log(`  ${content.replace(/\n/g, '\n  ')}`)
        console.log('')
      }
      break
    }

    case 'stats': {
      if (!index.isIndexed) {
        const loaded = index.load(process.cwd())
        if (!loaded) { console.log('No index. Run `bun run scripts/codeindex.ts index` first.'); process.exit(1) }
      }
      const stats = index.getStats()
      if (stats) {
        console.log(`Total chunks: ${stats.totalChunks}`)
        console.log(`Indexed files: ${stats.indexedFiles}`)
        console.log(`Last indexed: ${stats.lastIndexed || 'never'}`)
        console.log('\nLanguages:')
        for (const [lang, count] of Object.entries(stats.languageBreakdown).sort((a, b) => b[1] - a[1])) {
          console.log(`  ${lang}: ${count} chunks`)
        }
      }
      break
    }

    default: {
      console.log(`
Usage:
  bun run scripts/codeindex.ts index        # build index
  bun run scripts/codeindex.ts search <q>   # search code
  bun run scripts/codeindex.ts stats        # show index stats
      `)
    }
  }
}

main().catch(console.error)
