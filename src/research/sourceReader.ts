import { readFile } from 'fs/promises';
import { join } from 'path';
import { getFsImplementation } from '../utils/fsOperations.js';
import type { ResearchSource } from './types.js';

export async function readSourceDocument(cwd: string, source: ResearchSource, maxTokens = 25000): Promise<string> {
  const fsImpl = getFsImplementation();
  const filePath = source.path ? join(cwd, source.path) : '';

  if (!filePath || !fsImpl.existsSync(filePath)) {
    return `Source document at ${source.path || 'unknown path'} not found.`;
  }

  try {
    const content = await readFile(filePath, 'utf-8');

    // Basic token/character length estimation (approx. 4 chars per token)
    const maxChars = maxTokens * 4;
    let slicedContent = content;
    let truncated = false;

    if (content.length > maxChars) {
      slicedContent = content.slice(0, maxChars);
      truncated = true;
    }

    const fileExt = filePath.split('.').pop() || '';

    let formattedContent = '';
    if (['ts', 'tsx', 'js', 'jsx', 'json'].includes(fileExt)) {
      formattedContent = `### Source Code: ${source.path}\n\n\`\`\`${fileExt}\n${slicedContent}\n\`\`\``;
    } else {
      formattedContent = `### Document: ${source.path}\n\n${slicedContent}`;
    }

    if (truncated) {
      formattedContent += '\n\n*(Content truncated due to length limits)*';
    }

    return formattedContent;
  } catch (err: any) {
    return `Failed to read source document ${source.path}: ${err.message}`;
  }
}
