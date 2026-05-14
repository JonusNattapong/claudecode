import { APIError } from '@anthropic-ai/sdk'
import type { ProviderClient, ProviderInitOptions, ProviderInterface } from './ProviderInterface.js'
import axios from 'axios'
import { normalizeUsage } from '../usageNormalizer.js'

function safeParseErrorBody(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function extractErrorMessage(body: Record<string, unknown> | undefined, fallback: string): string {
  const nestedError = body?.error
  if (nestedError && typeof nestedError === 'object') {
    const message = (nestedError as Record<string, unknown>).message
    if (typeof message === 'string' && message.length > 0) return message
  }

  const message = body?.message
  if (typeof message === 'string' && message.length > 0) return message

  const detail = body?.detail
  if (typeof detail === 'string' && detail.length > 0) return detail

  const error = body?.error
  if (typeof error === 'string' && error.length > 0) return error

  return fallback
}

const CHAT_COMPLETIONS_PATH = '/chat/completions'

function getChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '')
  return normalized.endsWith(CHAT_COMPLETIONS_PATH)
    ? normalized
    : `${normalized}${CHAT_COMPLETIONS_PATH}`
}

export class CopilotProvider implements ProviderInterface {
  readonly providerId = 'copilot' as const
  readonly label = 'GitHub Copilot'

  getProviderId() {
    return this.providerId
  }

  getProviderLabel() {
    return this.label
  }

  getProviderApiKeyEnvVar() {
    return 'COPILOT_GITHUB_TOKEN'
  }

  async createClient(options: ProviderInitOptions): Promise<ProviderClient> {
    const githubToken = options.apiKey ?? process.env.COPILOT_GITHUB_TOKEN

    if (!githubToken) {
      throw new Error(
        `Missing GitHub token for copilot. Set COPILOT_GITHUB_TOKEN or login via /providers command.`,
      )
    }

    // First, exchange GitHub token for a Copilot token
    const tokenResponse = await axios.get('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'ClaudeCode'
      }
    })

    const copilotToken = tokenResponse.data.token

    // Create the OpenAI-compatible client structure
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

            if (copilotToken) {
              headers.Authorization = `Bearer ${copilotToken}`
            }

            // Use mapped model ID
            const modelId = this.mapModel(params.model)
            const requestBody = { ...params, model: modelId, stream: isStreaming }

            const response = await fetch(getChatCompletionsUrl('https://api.githubcopilot.com'), {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
              const text = await response.text()
              const body = safeParseErrorBody(text)
              const message = extractErrorMessage(
                body,
                text || `${response.status} ${response.statusText}`,
              )
              throw APIError.generate(
                response.status,
                body ?? {
                  error: {
                    message,
                    type: response.status === 429 ? 'rate_limit_error' : 'api_error',
                  },
                },
                message,
                response.headers,
              )
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

  protected async *handleStreamingResponse(response: Response): AsyncGenerator<unknown, void, unknown> {
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

  /**
   * Map model IDs to Copilot's internal model names
   */
  private mapModel(model: string): string {
    const modelMap: Record<string, string> = {
      'claude-opus-4-7': 'claude-3.5-sonnet',
      'claude-sonnet-4-7': 'claude-3.5-sonnet',
      'gpt-5.5': 'gpt-5-preview',
      'gpt-4o': 'gpt-4o',
    }
    return modelMap[model] ?? model
  }
}
