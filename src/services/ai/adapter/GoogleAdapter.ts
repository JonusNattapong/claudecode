/**
 * Google Gemini adapter — wraps `@google/generative-ai` SDK into the
 * Anthropic-compatible `beta.messages.create()` shape so the main
 * streaming loop in claude.ts can treat it like any other provider.
 *
 * J8: Added safety rating detection, streamTimeoutMs, better normalizeError.
 */

import type {
  BetaMessage,
  BetaMessageStreamParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

import type { ProviderAdapter } from './AnthropicAdapter.js'
import { registerAdapter, withStreamWatchdog } from './AnthropicAdapter.js'

/** Gemini safety categories that indicate harmful content. */
const BLOCKED_SAFETY_CATEGORIES = new Set([
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
])

/** Check Gemini response for blocked safety ratings. */
function checkSafetyRatings(response: any): string | null {
  const candidates = response?.candidates
  if (!candidates) return 'No candidates in Gemini response'
  for (const candidate of candidates) {
    if (candidate?.finishReason === 'SAFETY') {
      const ratings = candidate?.safetyRatings
        ?.filter((r: any) => r.blocked)
        .map((r: any) => r.category)
        .join(', ') ?? 'unknown'
      return `Content blocked by Google safety settings: ${ratings}`
    }
  }
  return null
}

class GoogleAdapter implements ProviderAdapter {
  readonly label = 'Google Gemini'
  private client: any
  /** Gemini streams can be slow for large responses — 60s watchdog. */
  readonly streamTimeoutMs = 60_000

  constructor(client: any) {
    this.client = client
  }

  async createMessage(
    params: BetaMessageStreamParams,
    _options?: { signal?: AbortSignal },
  ): Promise<BetaMessage> {
    const model = this.client.getGenerativeModel({ model: params.model ?? 'gemini-3.1-flash' })
    const result = await model.generateContent(this.buildGoogleContents(params))
    const response = result.response

    // Safety check before extracting text
    const safetyBlock = checkSafetyRatings(response)
    if (safetyBlock) {
      const err = new Error(`[${this.label}] ${safetyBlock}`)
      ;(err as any)._providerError = { category: 'content_filter', status: 400 }
      throw err
    }

    const text = response.text?.() ?? ''
    return {
      id: `google-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: params.model ?? 'gemini',
      content: text ? [{ type: 'text', text }] : [],
      stop_reason: response.candidates?.[0]?.finishReason === 'STOP' ? 'end_turn' : 'max_tokens',
      stop_sequence: null,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    } as BetaMessage
  }

  async *streamMessage(
    params: BetaMessageStreamParams,
    _options?: { signal?: AbortSignal },
  ): AsyncGenerator<unknown, void, undefined> {
    const model = this.client.getGenerativeModel({ model: params.model ?? 'gemini-3.1-flash' })
    const result = await model.generateContentStream(this.buildGoogleContents(params))

    yield {
      type: 'message_start',
      message: {
        id: `google-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: params.model ?? 'gemini',
        content: [],
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    }

    let index = 0
    let hasYieldedBlockStart = false

    for await (const chunk of result.stream) {
      // Safety check on each chunk (candidates may accumulate safety ratings)
      const safetyBlock = checkSafetyRatings(chunk)
      if (safetyBlock) {
        if (hasYieldedBlockStart) {
          yield { type: 'content_block_stop', index }
        }
        const err = new Error(`[${this.label}] ${safetyBlock}`)
        ;(err as any)._providerError = { category: 'content_filter', status: 400 }
        throw err
      }

      const text = chunk.text?.() ?? ''
      if (!text) continue

      if (!hasYieldedBlockStart) {
        yield {
          type: 'content_block_start',
          index,
          content_block: { type: 'text', text: '' },
        }
        hasYieldedBlockStart = true
      }

      yield {
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text },
      }
    }

    if (hasYieldedBlockStart) {
      yield { type: 'content_block_stop', index }
    }

    yield {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 0 },
    }
    yield { type: 'message_stop' }
  }

  normalizeError(error: unknown): Error {
    if (error && typeof error === 'object') {
      const e = error as any
      const status = e.status ?? e.code
      const message = e.message ?? String(error)

      if (status === 429 || message?.includes('RATE_LIMIT_EXCEEDED')) {
        const err = new Error(`[${this.label}] Rate limited: ${message}`)
        ;(err as any)._providerError = { category: 'rate_limit', retryAfter: undefined, status: 429 }
        return err
      }

      if (status === 401 || status === 403 || message?.includes('API key')) {
        const err = new Error(`[${this.label}] Authentication failed: ${message}`)
        ;(err as any)._providerError = { category: 'auth', status: 401 }
        return err
      }
    }

    if (error instanceof Error) {
      if ((error as any)._providerError) return error
      const wrapped = new Error(`[${this.label}] ${error.message}`)
      ;(wrapped as any)._providerError = { category: 'server_error', status: undefined }
      return wrapped
    }

    return new Error(`[${this.label}] ${String(error)}`)
  }

  private buildGoogleContents(params: BetaMessageStreamParams): any {
    // Simple conversion: concatenate all text content from messages
    const contents: { role: string; parts: { text: string }[] }[] = []
    let systemText = ''

    if (params.system) {
      systemText = Array.isArray(params.system)
        ? params.system.map((s: any) => s.text ?? '').join('\n')
        : String(params.system)
    }

    for (const m of params.messages) {
      const role = m.role === 'assistant' ? 'model' : 'user'
      const text = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
          : ''
      if (text) {
        if (role === 'user' && systemText) {
          // Prepend system as first user message (Gemini doesn't have system role)
          contents.push({ role: 'user', parts: [{ text: systemText + '\n\n' + text }] })
          systemText = ''
        } else {
          contents.push({ role, parts: [{ text }] })
        }
      }
    }

    return { contents }
  }
}

// Register for both 'google' and 'gemini' IDs
registerAdapter('google', (client: any, _providerId: string) => new GoogleAdapter(client))
