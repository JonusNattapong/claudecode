import { createAnthropicClient } from '../../api/anthropicClient.js';
import type { ProviderClient, ProviderInitOptions, ProviderInterface } from './ProviderInterface.js';

export class AnthropicProvider implements ProviderInterface {
  readonly providerId = 'anthropic' as const;
  readonly label = 'Anthropic';

  getProviderId() {
    return this.providerId;
  }

  getProviderLabel() {
    return this.label;
  }

  getProviderApiKeyEnvVar() {
    return 'ANTHROPIC_API_KEY';
  }

  async createClient(options: ProviderInitOptions): Promise<ProviderClient> {
    return createAnthropicClient({
      ...options,
      maxRetries: options.maxRetries ?? 2,
    } as any);
  }

  async listModels(options: ProviderInitOptions): Promise<Array<{ id: string; label: string }>> {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      if (!data || !Array.isArray(data.data)) return [];

      return data.data.map((m: any) => ({
        id: m.id,
        label: m.display_name || m.id,
      }));
    } catch (error) {
      console.error('[anthropic] Failed to list models:', error);
      return [];
    }
  }
}
