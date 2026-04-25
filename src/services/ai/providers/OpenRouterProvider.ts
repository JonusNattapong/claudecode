import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'
import type { ProviderId } from './ProviderInterface.js'

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      'openrouter' as ProviderId,
      'OpenRouter',
      'OPENROUTER_API_KEY',
      'https://openrouter.ai/api/v1',
    )
  }

  async createClient(options: {
    apiKey?: string
    baseUrl?: string
    model?: string
    fetchOverride?: any
    source?: string
    maxRetries?: number
  }): Promise<unknown> {
    const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY
    const baseUrl =
      options.baseUrl ??
      process.env.OPENROUTER_BASE_URL ??
      this.defaultBaseUrl

    if (!apiKey) {
      throw new Error(
        'Missing API key for OpenRouter. Set OPENROUTER_API_KEY.',
      )
    }

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
            const response = await fetch(
              `${baseUrl.replace(/\/$/, '')}/chat/completions`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://github.com/claude-code',
                  'X-Title': 'Claude Code',
                },
                body: JSON.stringify({ ...params, stream: isStreaming }),
              },
            )

            if (!response.ok) {
              const text = await response.text()
              throw new Error(
                `OpenRouter request failed: ${response.status} ${response.statusText} - ${text}`,
              )
            }

            if (isStreaming) {
              return this.handleStreamingResponse(response)
            }

            return response.json()
          },
        },
      },
    }
  }
}
