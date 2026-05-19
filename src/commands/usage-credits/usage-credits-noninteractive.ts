import { runUsageCredits } from './usage-credits-core.js';

export async function call(): Promise<{ type: 'text'; value: string }> {
  const result = await runUsageCredits();

  if (result.type === 'message') {
    return { type: 'text', value: result.value };
  }

  return {
    type: 'text',
    value: result.opened
      ? `Browser opened to manage usage credits. If it didn't open, visit: ${result.url}`
      : `Please visit ${result.url} to manage usage credits.`,
  };
}
