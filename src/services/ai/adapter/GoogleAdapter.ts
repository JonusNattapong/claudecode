/**
 * Google Gemini adapter — wraps `@google/generative-ai` SDK into the
 * Anthropic-compatible `beta.messages.create()` shape so the main
 * streaming loop in claude.ts can treat it like any other provider.
 *
 * Supports:
 *  - text generation
 *  - streaming
 *  - tool calling (functionCall / functionResponse)
 *  - system instructions
 *  - usage metadata mapping
 *
 * J8: Added safety rating detection, streamTimeoutMs, better normalizeError.
 * M9: Added tool call support (functionCall → tool_use, tool_result → functionResponse).
 */

import type { BetaMessage, BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';

import type { ProviderAdapter } from './AnthropicAdapter.js';
import { registerAdapter, withStreamWatchdog } from './AnthropicAdapter.js';

/** Gemini safety categories that indicate harmful content. */
const BLOCKED_SAFETY_CATEGORIES = new Set([
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
]);

/** Check Gemini response for blocked safety ratings. */
function checkSafetyRatings(response: any): string | null {
  const candidates = response?.candidates;
  if (!candidates) return 'No candidates in Gemini response';
  for (const candidate of candidates) {
    if (candidate?.finishReason === 'SAFETY') {
      const ratings =
        candidate?.safetyRatings
          ?.filter((r: any) => r.blocked)
          .map((r: any) => r.category)
          .join(', ') ?? 'unknown';
      return `Content blocked by Google safety settings: ${ratings}`;
    }
  }
  return null;
}

/**
 * Convert Anthropic tool definitions → Gemini Tool[].
 */
function buildGeminiTools(tools: BetaMessageStreamParams['tools']): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return (tools as any[]).map(t => ({
    functionDeclarations: [
      {
        name: t.name,
        description: t.description ?? '',
        parameters: t.input_schema,
      },
    ],
  }));
}

class GoogleAdapter implements ProviderAdapter {
  readonly label = 'Google Gemini';
  private client: any;
  /** Gemini streams can be slow for large responses — 60s watchdog. */
  readonly streamTimeoutMs = 60_000;

  constructor(client: any) {
    this.client = client;
  }

  async createMessage(params: BetaMessageStreamParams, _options?: { signal?: AbortSignal }): Promise<BetaMessage> {
    const model = this.client.getGenerativeModel({
      model: params.model ?? 'gemini-3.1-flash',
    });

    const request = this.buildRequest(params);
    const result = await model.generateContent(request);
    const response = result.response;

    // Safety check before extracting content
    const safetyBlock = checkSafetyRatings(response);
    if (safetyBlock) {
      const err = new Error(`[${this.label}] ${safetyBlock}`);
      (err as any)._providerError = { category: 'content_filter', status: 400 };
      throw err;
    }

    const content = this.responseToContent(response);
    const finishReason = this.mapFinishReason(response.candidates?.[0]?.finishReason);

    return {
      id: `google-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: params.model ?? 'gemini',
      content,
      stop_reason: finishReason,
      stop_sequence: null,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    } as BetaMessage;
  }

  async *streamMessage(
    params: BetaMessageStreamParams,
    _options?: { signal?: AbortSignal },
  ): AsyncGenerator<unknown, void, undefined> {
    const model = this.client.getGenerativeModel({
      model: params.model ?? 'gemini-3.1-flash',
    });

    const request = this.buildRequest(params);
    const result = await model.generateContentStream(request);

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
    };

    let activeBlockType: 'thinking' | 'text' | null = null;
    let activeBlockIndex = 0;
    let seenFunctionCall = false;

    for await (const chunk of result.stream) {
      // Safety check on each chunk
      const safetyBlock = checkSafetyRatings(chunk);
      if (safetyBlock) {
        if (activeBlockType !== null) {
          yield { type: 'content_block_stop', index: activeBlockIndex };
        }
        const err = new Error(`[${this.label}] ${safetyBlock}`);
        (err as any)._providerError = { category: 'content_filter', status: 400 };
        throw err;
      }

      const parts = chunk.candidates?.[0]?.content?.parts ?? [];

      for (const part of parts) {
        if (!part || typeof part !== 'object') continue;

        // ── Thought/reasoning part → thinking block ──────────────────────
        if (part.thought === true && part.text) {
          if (activeBlockType !== 'thinking') {
            if (activeBlockType !== null) {
              yield { type: 'content_block_stop', index: activeBlockIndex };
            }
            yield {
              type: 'content_block_start',
              index: 0,
              content_block: {
                type: 'thinking',
                thinking: '',
                signature: part.thoughtSignature ?? '',
              },
            };
            activeBlockType = 'thinking';
            activeBlockIndex = 0;
          }
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'thinking_delta', thinking: part.text },
          };
          continue;
        }

        // ── Regular text part → text block ──────────────────────────────
        if (part.text) {
          const textIndex = activeBlockType === 'thinking' ? 1 : 0;
          if (activeBlockType !== 'text') {
            if (activeBlockType !== null) {
              yield { type: 'content_block_stop', index: activeBlockIndex };
            }
            yield {
              type: 'content_block_start',
              index: textIndex,
              content_block: { type: 'text', text: '' },
            };
            activeBlockType = 'text';
            activeBlockIndex = textIndex;
          }
          yield {
            type: 'content_block_delta',
            index: textIndex,
            delta: { type: 'text_delta', text: part.text },
          };
          continue;
        }

        // ── Function call part ──────────────────────────────────────────
        if (part.functionCall) {
          seenFunctionCall = true;
        }
      }
    }

    // Close active block
    if (activeBlockType !== null) {
      yield { type: 'content_block_stop', index: activeBlockIndex };
    }

    // Get the aggregated response for function calls (Gemini often sends
    // functionCall parts in the final aggregated response, not in individual chunks)
    const aggregatedResponse = await result.response;
    const functionCalls = aggregatedResponse.functionCalls?.() ?? [];

    if (functionCalls.length > 0) {
      // Calculate starting tool index: thinking(0) + text(1) = next index
      const hasThinking = activeBlockType === 'thinking';
      const toolStart = activeBlockType !== null ? (hasThinking ? 2 : 1) : 0;
      let toolIndex = toolStart;
      for (const fc of functionCalls) {
        yield {
          type: 'content_block_start',
          index: toolIndex,
          content_block: {
            type: 'tool_use',
            id: `toolu_${fc.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: fc.name,
            input: '',
          },
        };
        yield {
          type: 'content_block_delta',
          index: toolIndex,
          delta: { type: 'input_json_delta', partial_json: JSON.stringify(fc.args) },
        };
        yield { type: 'content_block_stop', index: toolIndex };
        toolIndex++;
      }
    } else if (activeBlockType === null && !seenFunctionCall) {
      // No text, no function calls — emit empty text so response isn't blank
      yield {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      };
      yield { type: 'content_block_stop', index: 0 };
    }

    const usage = aggregatedResponse.usageMetadata;
    yield {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: {
        input_tokens: usage?.promptTokenCount ?? 0,
        output_tokens: usage?.candidatesTokenCount ?? 0,
      },
    };
    yield { type: 'message_stop' };
  }

  normalizeError(error: unknown): Error {
    if (error && typeof error === 'object') {
      const e = error as any;
      const status = e.status ?? e.code;
      const message = e.message ?? String(error);

      if (status === 429 || message?.includes('RATE_LIMIT_EXCEEDED')) {
        const err = new Error(`[${this.label}] Rate limited: ${message}`);
        (err as any)._providerError = { category: 'rate_limit', retryAfter: undefined, status: 429 };
        return err;
      }

      if (status === 401 || status === 403 || message?.includes('API key')) {
        const err = new Error(`[${this.label}] Authentication failed: ${message}`);
        (err as any)._providerError = { category: 'auth', status: 401 };
        return err;
      }
    }

    if (error instanceof Error) {
      if ((error as any)._providerError) return error;
      const wrapped = new Error(`[${this.label}] ${error.message}`);
      (wrapped as any)._providerError = { category: 'server_error', status: undefined };
      return wrapped;
    }

    return new Error(`[${this.label}] ${String(error)}`);
  }

  /**
   * Build the Gemini GenerateContentRequest from Anthropic params.
   * Converts tool_use blocks → functionCall parts, tool_result → functionResponse parts.
   */
  private buildRequest(params: BetaMessageStreamParams): any {
    // Build a map of tool_use_id → function name from assistant messages
    const toolNameMap = new Map<string, string>();
    for (const m of params.messages) {
      if (m.role === 'assistant' && Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c.type === 'tool_use') {
            toolNameMap.set(c.id, c.name);
          }
        }
      }
    }

    // Build Gemini contents array
    const geminiContents: { role: string; parts: any[] }[] = [];

    for (const m of params.messages) {
      const parts: any[] = [];
      const role = m.role === 'assistant' ? 'model' : 'user';

      if (typeof m.content === 'string') {
        if (m.role === 'user') {
          parts.push({ text: m.content });
        }
      } else if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input as object,
              },
            });
          } else if (block.type === 'tool_result') {
            const funcName = toolNameMap.get(block.tool_use_id) ?? block.tool_use_id;
            const text =
              typeof block.content === 'string'
                ? block.content
                : Array.isArray(block.content)
                  ? block.content
                      .map((b: any) => (b.type === 'text' ? b.text : ''))
                      .filter(Boolean)
                      .join('\n')
                  : JSON.stringify(block.content);
            parts.push({
              functionResponse: {
                name: funcName,
                response: typeof text === 'object' ? text : { output: text },
              },
            });
          } else if (block.type === 'thinking') {
            // Send as Gemini thought part with thought flag
            parts.push({
              text: block.thinking,
              thought: true,
              thoughtSignature: (block as any).signature ?? '',
            });
          }
        }
      }

      if (parts.length > 0) {
        geminiContents.push({ role, parts });
      }
    }

    // System instruction
    let systemInstruction: string | undefined;
    if (params.system) {
      systemInstruction = Array.isArray(params.system)
        ? params.system.map((s: any) => (typeof s === 'string' ? s : (s.text ?? ''))).join('\n')
        : String(params.system);
    }

    // Convert tools
    const geminiTools = buildGeminiTools(params.tools);

    const request: any = { contents: geminiContents };
    if (systemInstruction) request.systemInstruction = systemInstruction;
    if (geminiTools) request.tools = geminiTools;

    // Build generation config
    const generationConfig: Record<string, unknown> = {};
    if (params.max_tokens) generationConfig.maxOutputTokens = params.max_tokens;

    // Map structured output format (output_config.format) → Gemini response schema
    const outputConfig = (params as any).output_config as
      | { format?: { type: string; json_schema?: Record<string, unknown> } }
      | undefined;
    if (outputConfig?.format?.type === 'json_schema' && outputConfig.format.json_schema) {
      generationConfig.response_mime_type = 'application/json';
      generationConfig.response_schema = outputConfig.format.json_schema;
    }

    if (Object.keys(generationConfig).length > 0) {
      request.generationConfig = generationConfig;
    }

    // Map Anthropic thinking config → Gemini thinkingConfig
    const anthropicThinking = (params as any).thinking;
    if (anthropicThinking?.type === 'enabled') {
      request.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget:
          typeof anthropicThinking.budget_tokens === 'number' ? anthropicThinking.budget_tokens : undefined,
      };
    }

    return request;
  }

  /**
   * Convert a Gemini response into Anthropic content blocks.
   * Handles thought (thinking), text, and functionCall parts.
   * Gemini's text() method excludes thought parts, so we iterate raw parts.
   */
  private responseToContent(response: any): any[] {
    const content: any[] = [];
    const parts = response.candidates?.[0]?.content?.parts ?? [];

    let textBuffer = '';

    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;

      // Thought/reasoning part — map to Anthropic thinking block
      if (part.thought === true && part.text) {
        content.push({
          type: 'thinking',
          thinking: part.text,
          signature: part.thoughtSignature ?? '',
        });
        continue;
      }

      // Regular text part
      if (part.text) {
        textBuffer += part.text;
      }
    }

    if (textBuffer) {
      content.push({ type: 'text', text: textBuffer });
    }

    // Extract function calls via SDK method (already excludes thoughts)
    let functionCalls: any[] | undefined;
    try {
      functionCalls = response.functionCalls?.() ?? undefined;
    } catch {
      // No function calls
    }

    if (functionCalls) {
      for (const fc of functionCalls) {
        content.push({
          type: 'tool_use',
          id: `toolu_${fc.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: fc.name,
          input: fc.args as object,
        });
      }
    }

    return content;
  }

  /**
   * Map Gemini finishReason to Anthropic stop_reason.
   */
  private mapFinishReason(reason: string | undefined | null): string {
    switch (reason) {
      case 'STOP':
        return 'end_turn';
      case 'MAX_TOKENS':
        return 'max_tokens';
      case 'SAFETY':
      case 'RECITATION':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}

// Register for the 'google' provider ID
// registerAdapter('google', (client: any, _providerId: string) => new GoogleAdapter(client));
