# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A research-focused fork of Anthropic's Claude Code CLI with **unified multi-provider routing**, **provider-specific adapters**, and an **extensible plugin architecture**. Supports switching between Anthropic Claude, OpenAI GPT, Google Gemini, OpenRouter, local Ollama, and more — all from one terminal interface.

## Development Commands

```bash
bun install              # Install dependencies
bun run build            # Production build -> dist/
bun run dev              # Dev mode with --watch
bun test                 # Run all tests
bun x tsc --noEmit       # TypeScript type check
```

### Running Tests
```bash
bun test                 # All tests
bun test src/utils/codeIndex/    # Code index tests
```

## High-Level Architecture

```
┌───────────────────────────────────────┐
│           Terminal UI (Ink/React/TUI) │
├───────────────────────────────────────┤
│          Command Handler Layer        │
│   Files │ Git │ MCP │ Agent │ Skills │
├───────────────────────────────────────┤
│           AI Provider Layer            │
│   Anthropic │ OpenAI │ Google │ OpenRouter │ Ollama │ +more │
├───────────────────────────────────────┤
│           Core Services               │
│   ProviderRegistry │ SessionManager │ PermissionManager │ PluginManager │
└───────────────────────────────────────┘
```

### Provider System (`src/services/ai/`)
- `ProviderManager.ts` — Singleton orchestrating API keys, model selection, streaming, token usage
- `providerRegistry.ts` — Registry of all available providers
- `providerModels.ts` — Model discovery with 5-minute cache
- `providers/` — One file per provider (Anthropic, OpenAI, Google, OpenRouter, Ollama, OpenAICompatible, ChatGPTSession, Copilot, KiloCode)
- Provider interface: `streamMsg()`, `nonStreamingMsg()`, `getModels()`, `getToolResultSchema()`

### Tool System (`src/tools/`)
Each tool is a subdirectory (e.g., `src/tools/BashTool/`, `src/tools/Read/`) with `*.ts` or `*.tsx` files. Built-in tools: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash`, `PowerShell`, `Git`, `WebFetch`, `WebSearch`, `Agent`, `Task`, `MCP`, `LSP`, `Skill`, `CodeIndex`.

### Skill System (`src/skills/`)
- `bundled/` — Skills compiled into the binary (claudeInChrome, debug, scrapling, simplify, skillify, webSearch, remember, scheduleRemoteAgents, etc.)
- `bundledSkills.ts` — Registry of bundled skill activation messages
- Project skills loaded from `.claude/skills/` at startup

### CLI Commands (`src/commands/`)
100+ slash commands. Each command is a directory with `index.ts` (interactive) and optional `*noninteractive.ts` + `*ui.tsx`. Commands register via `registerCommand()`.

### Plugin System (`src/plugins/`)
```
plugin-name/
├── .claude-plugin/
│   ├── plugin.json     # Manifest
│   ├── skills/        # Skill implementations
│   └── hooks/          # Hook handlers
├── marketplace.json
└── README.md
```

Hook points: `PreToolUse`, `PostToolUse`, `PreBash`, `PostPrompt`, `PreAcceptEdit`.

### Bridge Mode (`src/bridge/`)
Remote collaboration via WebSocket. Enables sharing session URLs with teammates and remote control.

### Native TypeScript Replacements (`src/native-ts/`)
TypeScript ports of native/C++ modules for portability:
- `color-diff/` — Color diffing for structured diff rendering
- `file-index/` — File indexing utilities
- `yoga-layout/` — Yoga layout engine port

## Key Files & Entry Points

- `src/main.tsx` — Entry point & CLI bootstrap
- `src/cli/App.tsx` — Root React component
- `src/state/store.ts` — Minimal reactive state store (`createStore<T>()`)
- `src/services/ai/ProviderManager.ts` — Provider singleton
- `src/bridge/bridgeMain.ts` — Bridge mode server
- `src/tools/` — 40+ built-in tools
- `src/commands/` — 100+ slash commands

## Browser & Claude in Chrome

The Chrome extension integration lives in `src/utils/claudeInChrome/` and `src/skills/bundled/claudeInChrome.ts`. The MCP server dynamically imports `@ant/claude-for-chrome-mcp`. Tool names are hardcoded in `src/skills/bundled/claudeInChrome.ts` as `BROWSER_TOOL_NAMES`.

## Code Index

`src/utils/codeIndex/` provides a tokenizer, indexer, and search for the codebase. Exposed via `CodeIndexTool`.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3+ |
| Language | TypeScript 5.x ESM |
| UI | React 19 + Ink 6 |
| AI SDK | Verci AI SDK (`@ai-sdk/*`) + `@anthropic-ai/sdk` |
| Validation | Zod 3, Valibot 0.42 |
| CLI | Commander.js 13 |
| Search | fuse.js |
| Diff | diff |
| Markdown | marked + highlight.js |

## Important Notes

### ripgrep Vendor
`src/utils/vendor/ripgrep/x64-win32/rg.exe` is bundled for Windows. If missing, `Glob` and `Grep` tools will fail. Restore by reinstalling dependencies.

### Claude in Chrome
The `@ant/claude-for-chrome-mcp` package is dynamically imported at runtime in `mcpServer.ts`. Tool names are maintained as a static array in `claudeInChrome.ts` to avoid runtime dependency issues.

### State Management
Uses a minimal custom store (`src/state/store.ts`) — a reactive state pattern with `getState()`, `setState()`, and `subscribe()`.

## Troubleshooting

```bash
# Debug logging
DEBUG=1 bun run src/main.tsx session
DEBUG=provider:anthropic bun run src/main.tsx session

# In-session diagnostics
/status    # Show internal state
/doctor    # Run diagnostics & auto-fix
/context   # View context window usage
```

## Contributing

Follow [conventional commits](https://www.conventionalcommits.org/):
```
feat(provider): add OpenRouter provider support
fix(command): handle null input in /model picker
docs(readme): update API key setup instructions
```

Scopes: `provider`, `command`, `tool`, `ui`, `permissions`, `mcp`, `plugin`, `bridge`, `session`, `config`
