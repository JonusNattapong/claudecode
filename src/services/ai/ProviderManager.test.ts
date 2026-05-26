import { expect, test } from 'bun:test';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

test('defaults to OpenAI when no provider is configured', async () => {
  process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'claude-provider-test-'));
  delete process.env.AI_PROVIDER;
  delete process.env.CLAUDE_CODE_USE_BEDROCK;
  delete process.env.CLAUDE_CODE_USE_VERTEX;
  delete process.env.CLAUDE_CODE_USE_FOUNDRY;

  const cacheBust = Date.now();
  const [{ ProviderManager }, { DEFAULT_PROVIDER }] = await Promise.all([
    import(`./ProviderManager.js?default-provider-test=${cacheBust}`),
    import('./providerRegistry.js'),
  ]);
  const providerManager = ProviderManager.getInstance();
  providerManager.invalidateConfigCache();
  providerManager.setSessionProvider(null);

  expect(DEFAULT_PROVIDER).toBe('openai');
  expect(providerManager.getSelectedProviderConfig()).toEqual({});
  expect(providerManager.getActiveProviderName()).toBe('openai');
}, 15000);
