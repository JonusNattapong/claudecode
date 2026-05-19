import { APIError } from '@anthropic-ai/sdk';
import { normalizeUsage } from '../usageNormalizer.js';
import type { ProviderClient, ProviderInitOptions, ProviderInterface } from './ProviderInterface.js';

const CHAT_COMPLETIONS_PATH = '/chat/completions';

function safeParseErrorBody(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(body: Record<string, unknown> | undefined, fallback: string): string {
  const nestedError = body?.error;
  if (nestedError && typeof nestedError === 'object') {
    const message = (nestedError as Record<string, unknown>).message;
    if (typeof message === 'string' && message.length > 0) return message;
    if (typeof nestedError === 'string') return nestedError;
  }
  
  const bodyMessage = body?.message;
  if (typeof bodyMessage === 'string') return bodyMessage;
  
  const bodyDetail = body?.detail;
  if (typeof bodyDetail === 'string') return bodyDetail;

  return fallback;
}

function getChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized.endsWith(CHAT_COMPLETIONS_PATH) ? normalized : `${normalized}${CHAT_COMPLETIONS_PATH}`;
}

export class GoogleProvider implements ProviderInterface {
  readonly providerId = 'google' as const;
  readonly label = 'Google';

  getProviderId() {
    return this.providerId;
  }

  getProviderLabel() {
    return this.label;
  }

  getProviderApiKeyEnvVar() {
    return 'GOOGLE_API_KEY';
  }

  async createClient(options: ProviderInitOptions): Promise<ProviderClient> {
    const apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY;
    const baseUrl = options.baseUrl ?? process.env.GOOGLE_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai';

    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is required for Google provider.');
    }

    return {
      chat: {
        completions: {
          create: async (params: {
            model: string;
            messages: unknown;
            max_tokens?: number;
            temperature?: number;
            stream?: boolean;
            [key: string]: unknown;
          }) => {
            const isStreaming = params.stream === true;
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            };

            const response = await fetch(getChatCompletionsUrl(baseUrl), {
              method: 'POST',
              headers,
              body: JSON.stringify({ ...params, stream: isStreaming }),
            });

            if (!response.ok) {
              const text = await response.text();
              const body = safeParseErrorBody(text);
              const message = extractErrorMessage(body, text || `${response.status} ${response.statusText}`);
              throw APIError.generate(response.status, body ?? { error: { message } }, message, response.headers);
            }

            if (isStreaming) {
              return this.handleStreamingResponse(response);
            }

            const data = await response.json();
            return this.normalizeResponse(data);
          },
        },
      },
    };
  }

  async listModels(options: ProviderInitOptions): Promise<Array<{ id: string; label: string }>> {
    const apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY;
    const baseUrl = options.baseUrl ?? process.env.GOOGLE_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai';

    if (!apiKey) return [];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const modelsUrl = normalizedBaseUrl.endsWith('/models') ? normalizedBaseUrl : `${normalizedBaseUrl}/models`;

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) return [];

      const data = await response.json();
      if (!data || !Array.isArray(data.data)) return [];

      return data.data.map((m: any) => ({
        id: m.id,
        label: m.id,
      }));
    } catch (error) {
      console.error(`[google] Failed to list models:`, error);
      return [];
    }
  }

  protected async *handleStreamingResponse(response: Response): AsyncGenerator<unknown, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          yield this.normalizeStreamChunk(parsed);
        } catch { /* Skip invalid JSON */ }
      }
    }
  }

  protected normalizeResponse(data: unknown): unknown {
    return {
      ...(data as Record<string, unknown>),
      _normalized: true,
      _provider: this.providerId,
      usage: normalizeUsage(data, this.providerId),
    };
  }

  protected normalizeStreamChunk(chunk: unknown): unknown {
    return {
      ...(chunk as Record<string, unknown>),
      _provider: this.providerId,
    };
  }
}
