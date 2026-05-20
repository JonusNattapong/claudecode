# Sentry Error Reporting

Sentry is an **optional, opt-in** crash and error telemetry system for Ceph Code.

By **default, Sentry is completely disabled**. No telemetry, no network requests, no data leaves your machine unless you explicitly set `SENTRY_DSN`.

## Quick Start

### Self-hosted Sentry

```bash
SENTRY_DSN=https://public_key@your-sentry.example.com/123 cephcode
```

### Sentry Cloud

```bash
SENTRY_DSN=https://public_key@o123456.ingest.sentry.io/789 cephcode
```

### Disable (default)

```bash
cephcode
```

That's it. No config file, no setup. If `SENTRY_DSN` is not set, the entire Sentry SDK is never loaded.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | **yes** | — | Sentry DSN to enable error reporting. Without this, everything is no-op. |
| `SENTRY_ENVIRONMENT` | no | `NODE_ENV` or `production` | Environment tag in Sentry dashboard |
| `SENTRY_RELEASE` | no | auto from package.json | Release version tag |
| `SENTRY_SAMPLE_RATE` | no | `1.0` | Error sample rate (0.0–1.0). Only for volume control. |

## What Gets Sent

Only error metadata — **never prompts, responses, file contents, or command output**:

- Error name, message, and stack trace (without local variable values)
- Runtime info: OS platform, Node/Bun version
- Mode: REPL, non-interactive, MCP server
- Provider and model name (when applicable)
- Version and release tag

## What Does NOT Get Sent

| Category | Examples |
|----------|----------|
| **Prompts** | user input, AI system prompts |
| **Responses** | model output, streaming chunks |
| **File content** | Read/Edit/Write payload, command stdout/stderr |
| **Credentials** | API keys, tokens, passwords, cookies |
| **Auth headers** | Authorization, x-api-key, Cookie, Set-Cookie |
| **OAuth tokens** | access_token, refresh_token, id_token |
| **Environment dump** | entire env block (individual vars may appear as tags) |
| **Local paths** | home directory is anonymized to `[HOME]` |
| **Breadcrumbs** | user actions are not tracked |
| **User identity** | user field is stripped from all events |

## Privacy Scrubber

Every event passes through a `beforeSend` hook that:

1. **Scrubs strings** — removes API key patterns (`sk-*`, `Bearer` tokens), auth headers, cookie values
2. **Strips stack frame variables** — removes `vars`, `pre_context`, `context_line`, `post_context` from stack traces
3. **Removes breadcrumbs** — user actions are never tracked
4. **Cleans request data** — removes headers, cookies, query strings
5. **Anonymizes home directory** — replaces `/home/user` or `C:\Users\name` with `[HOME]`
6. **Drops oversized strings** — strings over 2000 chars are truncated
7. **Recursively scrubs nested objects** — drops keys named prompt, response, content, message, input, output, text, body, data, payload, token, key, secret, password, auth, cookie

## Checking Status

Use `/doctor` to check Sentry status:

```text
└ Sentry Telemetry: Disabled (set SENTRY_DSN to enable)
```

or when enabled:

```text
└ Sentry Telemetry: Enabled (https://abcd...xyz@o123.ingest.sentry.io/456)
```

The DSN is masked in the UI — only the first 8 and last 4 characters of the key are shown.

## Architecture

```
process.env.SENTRY_DSN
  → init.ts: initSentry()
     → @sentry/node (lazy import)
        → beforeSend scrubber
           → Sentry server
  → logError() → captureException() (when enabled)
  → SentryErrorBoundary → captureException() (on render crash)
  → gracefulShutdown → closeSentry(2000) (flush on exit)
```

## Files

| File | Purpose |
|------|---------|
| `src/utils/sentry.ts` | Core wrapper — init, capture, close, scrubber |
| `src/utils/sentry.test.ts` | Unit tests |
| `src/entrypoints/init.ts` | Calls `initSentry()` at startup |
| `src/utils/gracefulShutdown.ts` | Calls `closeSentry()` before exit |
| `src/utils/log.ts` | `logError()` sends to Sentry when enabled |
| `src/components/SentryErrorBoundary.tsx` | React error boundary for render crashes |
| `src/components/App.tsx` | Wraps app tree in `SentryErrorBoundary` |
| `src/utils/doctorDiagnostic.ts` | `/doctor` Sentry status |
