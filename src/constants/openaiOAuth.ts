// OpenAI Codex-style OAuth configuration.
//
// This flow lets users sign in with a ChatGPT account for Codex/agent-style
// features. It is not OpenAI Platform API-key authentication, and it does not
// turn a ChatGPT Plus/Pro subscription into general API billing access.

const DEFAULT_OPENAI_CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const DEFAULT_CALLBACK_PORT = 1455

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : fallback
}

function readCallbackPort(): number {
  const raw = process.env.OPENAI_OAUTH_CALLBACK_PORT?.trim()

  if (!raw) {
    return DEFAULT_CALLBACK_PORT
  }

  const port = Number.parseInt(raw, 10)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid OPENAI_OAUTH_CALLBACK_PORT: ${raw}. Expected a port between 1 and 65535.`,
    )
  }

  return port
}

const callbackPort = readCallbackPort()

// OpenAI OAuth endpoints and parameters.
export const OPENAI_OAUTH_CONFIG = {
  AUTHORIZE_URL: 'https://auth.openai.com/oauth/authorize',
  TOKEN_URL: 'https://auth.openai.com/oauth/token',

  // Public client id used for Codex-style ChatGPT sign-in.
  // Override only if you have your own registered OAuth client.
  CLIENT_ID: envOrDefault(
    'OPENAI_OAUTH_CLIENT_ID',
    DEFAULT_OPENAI_CODEX_CLIENT_ID,
  ),

  // Local browser callback URI. This must match the redirect URI used when
  // starting the local callback server.
  REDIRECT_URI: `http://localhost:${callbackPort}/auth/callback`,

  // Optional manual/headless callback URI. Use this only for a manual
  // copy-paste code flow, not for the local browser callback flow.
  MANUAL_REDIRECT_URI: envOrDefault(
    'OPENAI_OAUTH_MANUAL_REDIRECT_URI',
    'https://platform.openai.com/oauth/callback',
  ),

  // OIDC scopes. offline_access is needed when you want refresh tokens.
  SCOPES: ['openid', 'profile', 'email', 'offline_access'],

  // Extra parameters used by Codex-style ChatGPT sign-in flows.
  EXTRA_AUTHORIZE_PARAMS: {
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    origin: envOrDefault('OPENAI_OAUTH_ORIGIN', 'opencode'),
  },
} as const

// PKCE code challenge method.
export const CODE_CHALLENGE_METHOD = 'S256' as const

// Storage key for ChatGPT/Codex OAuth tokens.
// Store the actual token payload in secure storage, not plain JSON.
export const OPENAI_TOKEN_STORAGE_KEY = 'openai_codex_oauth_tokens'