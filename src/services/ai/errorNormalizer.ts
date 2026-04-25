import type { ProviderId } from './providers/ProviderInterface.js'

export type NormalizedProviderErrorCode =
  | 'missing_api_key'
  | 'authentication_failed'
  | 'rate_limited'
  | 'model_not_found'
  | 'tool_call_failed'
  | 'service_unavailable'
  | 'bad_request'
  | 'unknown'

export interface NormalizedProviderError {
  code: NormalizedProviderErrorCode
  message: string
  provider?: ProviderId
  raw?: unknown
}

export function normalizeProviderError(
  error: unknown,
  provider?: ProviderId,
): NormalizedProviderError {
  const message = getErrorMessage(error)
  const lower = message.toLowerCase()

  if (/invalid\s*x[-_]?api[-_]?key|missing\s*api\s*key|authentication_error|invalid token|401/.test(lower)) {
    return {
      code: 'missing_api_key',
      message,
      provider,
      raw: error,
    }
  }

  if (/rate\s*limit|429|too many requests|throttled/.test(lower)) {
    return {
      code: 'rate_limited',
      message,
      provider,
      raw: error,
    }
  }

  if (/model\s*not\s*found|unsupported\s*model|unknown\s*model|model.*invalid/.test(lower)) {
    return {
      code: 'model_not_found',
      message,
      provider,
      raw: error,
    }
  }

  if (/tool.*call|function.*call|tool_call|tool.*error/.test(lower)) {
    return {
      code: 'tool_call_failed',
      message,
      provider,
      raw: error,
    }
  }

  if (/service.*unavailable|503|gateway timeout|timeout/.test(lower)) {
    return {
      code: 'service_unavailable',
      message,
      provider,
      raw: error,
    }
  }

  if (/bad request|400/.test(lower)) {
    return {
      code: 'bad_request',
      message,
      provider,
      raw: error,
    }
  }

  return {
    code: 'unknown',
    message,
    provider,
    raw: error,
  }
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}
