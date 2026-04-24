# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Claude Code** is a Bun-based TypeScript/React AI coding assistant with multi-provider support. It uses [Ink](https://github.com/vadimdemedes/ink) (React for CLI) for the terminal UI and [Vercel AI SDK](https://sdk.vercel.ai) for AI provider integration.

- **Runtime**: Bun 1.0+ (enforced in `package.json` engines)
- **Main entry**: `src/main.tsx`
- **Module system**: ESM (`"type": "module"` in `package.json`)

## Build and Development Commands

```bash
# Install dependencies
bun install

# Development mode with file watching
bun run dev

# Run CLI directly
bun run cli

# Build to dist/ (Bun runtime target)
bun run build

# Run tests
bun test

# Run specific test by pattern
bun test <pattern>

# Type-check without emit
npx tsc --noEmit
```

## Architecture

```
src/
├── main.tsx              # CLI bootstrap: Ink TUI, command loading, REPL
├── commands/            # CLI commands (provider-select, commit, diff, etc.)
│   └── provider-select/ # Provider selection (multi-provider config)
├── services/             # API clients and business logic
│   └── api/             # AI API integrations
├── components/          # Ink React UI components (StructuredDiff, etc.)
├── ink.ts               # Ink exports
└── types/               # TypeScript types
```

**Provider system**: Located in `src/commands/provider-select/provider-select.ts`. Providers are configured via CLI commands (`/provider list`, `/provider set`, `/provider key`, `/provider models`) and stored in `~/.claude-code-provider.json`.

## Provider Configuration

Available providers in `PROVIDERS` map:
- `openai` — OpenAI API (`OPENAI_API_KEY`)
- `anthropic` — Anthropic Claude (`ANTHROPIC_API_KEY`)
- `gemini` — Google Gemini (`GEMINI_API_KEY`)
- `openrouter` — OpenRouter.ai (`OPENROUTER_API_KEY`)
- `opencode` — OpenCode AI (`OPENCODE_API_KEY`)
- `groq` — Groq (`GROQ_API_KEY`)
- `xai` — xAI (`XAI_API_KEY`)
- `mistral` — Mistral (`MISTRAL_API_KEY`)
- `kilocode` — KiloCode Gateway (`KILOCODE_API_KEY`)
- `ollama` — Local Ollama (`OLLAMA_API_KEY`)

Provider selection flow:
1. `/provider list` — shows all available providers and their API key status
2. `/provider set <provider> <model>` — sets active provider and model
3. `/provider key <provider> <api-key>` — saves API key to config file

## Tool and Command Development

- **Add CLI command**: Create `src/commands/<name>/index.ts` or `src/commands/<name>.ts`, register via main command loader
- **Add AI tool**: Implement in `src/tools/`, expose validation (Zod schema) and execution logic
- **Provider changes**: Modify `src/commands/provider-select/provider-select.ts` for provider metadata, then update runtime routing in `src/services/api/claude.ts`

## Environment Variables

Core provider keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, plus provider-specific keys listed above.

## References

- `docs/ARCHITECTURE.md` — detailed architecture
- `CONTRIBUTING.md` — contribution workflow
- `README.md` — usage overview