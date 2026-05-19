/**
 * ANT-only CLI handlers (stub).
 * These commands are only available in the Ant build and are dynamically imported.
 */

export async function logHandler(_logId: string | number | undefined): Promise<void> {
  throw new Error('logHandler is not available in this build');
}

export async function errorHandler(_number: number | undefined): Promise<void> {
  throw new Error('errorHandler is not available in this build');
}

export async function exportHandler(_source: string, _outputFile: string): Promise<void> {
  throw new Error('exportHandler is not available in this build');
}
