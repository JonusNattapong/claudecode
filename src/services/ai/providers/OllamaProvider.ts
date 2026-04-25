import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'
import type { ProviderId } from './ProviderInterface.js'

export class OllamaProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      'ollama' as ProviderId,
      'Ollama (Local)',
      'OLLAMA_API_KEY',
      'http://localhost:11434/v1',
      false, // requiresApiKey = false
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
    const baseUrl =
      options.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
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
            const response = await fetch(
              `${baseUrl.replace(/\/$/, '')}/chat/completions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...params, stream: isStreaming }),
              },
            )

            if (!response.ok) {
              const text = await response.text()
              throw new Error(
                `Ollama request failed: ${response.status} ${response.statusText} - ${text}`,
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
