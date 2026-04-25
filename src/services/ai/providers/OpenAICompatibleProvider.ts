import type {
  ProviderClient,
  ProviderInitOptions,
  ProviderInterface,
  ProviderId,
} from './ProviderInterface.js'
import { normalizeProviderError } from '../errorNormalizer.js'
import { normalizeUsage } from '../usageNormalizer.js'

const CHAT_COMPLETIONS_PATH = '/chat/completions'

function getChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '')
  return normalized.endsWith(CHAT_COMPLETIONS_PATH)
    ? normalized
    : `${normalized}${CHAT_COMPLETIONS_PATH}`
}

export class OpenAICompatibleProvider implements ProviderInterface {
  readonly providerId: ProviderId
  readonly label: string
  readonly envKey: string
  readonly defaultBaseUrl: string
  protected requiresApiKey: boolean

  constructor(
    providerId: ProviderId,
    label: string,
    envKey: string,
    defaultBaseUrl: string,
    requiresApiKey = true,
  ) {
    this.providerId = providerId
    this.label = label
    this.envKey = envKey
    this.defaultBaseUrl = defaultBaseUrl
    this.requiresApiKey = requiresApiKey
  }

  getProviderId() {
    return this.providerId
  }

  getProviderLabel() {
    return this.label
  }

  getProviderApiKeyEnvVar() {
    return this.envKey
  }

  async createClient(options: ProviderInitOptions): Promise<ProviderClient> {
    const apiKey = this.requiresApiKey
      ? (options.apiKey ?? process.env[this.envKey])
      : undefined

    if (this.requiresApiKey && !apiKey) {
      throw new Error(
        `Missing API key for provider ${this.providerId}. Set ${this.envKey}.`,
      )
    }

    const baseUrl =
      options.baseUrl ??
      process.env[`${this.providerId.toUpperCase()}_BASE_URL`] ??
      this.defaultBaseUrl

    return {
      chat: {
        completions: {
          create: async (params: {
            model: string
            messages: unknown
            max_tokens?: number
            temperature?: number
            stream?: boolean
            [key: string]: unknown
          }) => {
            const isStreaming = params.stream === true
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }

            if (apiKey) {
              headers.Authorization = `Bearer ${apiKey}`
            }

            const response = await fetch(getChatCompletionsUrl(baseUrl), {
              method: 'POST',
              headers,
              body: JSON.stringify({ ...params, stream: isStreaming }),
            })

            if (!response.ok) {
              const text = await response.text()
              const error = new Error(
                `${this.providerId} request failed: ${response.status} ${response.statusText} - ${text}`,
              )
              throw normalizeProviderError(error, this.providerId)
            }

            if (isStreaming) {
              return this.handleStreamingResponse(response)
            }

            const data = await response.json()
            return this.normalizeResponse(data)
          },
        },
      },
    }
  }

  protected async *handleStreamingResponse(
    response: Response,
  ): AsyncGenerator<unknown, void, unknown> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body for streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          yield this.normalizeStreamChunk(parsed)
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  protected normalizeResponse(data: unknown): unknown {
    return {
      ...(data as Record<string, unknown>),
      _normalized: true,
      _provider: this.providerId,
      usage: normalizeUsage(data, this.providerId),
    }
  }

  protected normalizeStreamChunk(chunk: unknown): unknown {
    return {
      ...(chunk as Record<string, unknown>),
      _provider: this.providerId,
    }
  }
}
