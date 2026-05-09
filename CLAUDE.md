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
bun test src/utils/kanban/    # Kanban tests only
bun test src/utils/kanban/kanban.test.ts  # Specific test file
```

## High-Level Architecture

```
┌───────────────────────────────────────┐
│           Terminal UI (Ink/React/TUI) │
├───────────────────────────────────────┤
│          Command Handler Layer        │
│   Files │ Git │ MCP │ Agent │ Kanban   │
├───────────────────────────────────────┤
│           AI Provider Layer            │
│   Anthropic │ OpenAI │ Google │ OpenRouter │ Ollama │ +more │
├───────────────────────────────────────┤
│           Core Services               │
│   ProviderRegistry │ SessionManager │ PermissionManager │ PluginManager │
└───────────────────────────────────────┘
```

### Provider System (`src/services/ai/`)
- `providerRegistry.ts` — Singleton registry for all providers
- `ProviderManager.ts` — Orchestrates API keys, model selection, streaming, token usage
- `providers/` — One file per provider (AnthropicAdapter, ChatGPTSessionProvider, OpenAICompatibleProvider, etc.)
- `providerModels.ts` — Model discovery with 5-minute cache
- Provider interface: `streamMsg()`, `nonStreamingMsg()`, `getModels()`, `getToolResultSchema()`

### Tool System (`src/infra/tools/`)
Each tool exports: `name`, `description`, `parameters` (Zod schema), `isEnabled()`, `userFacingName()`, `renderToolUse()`, `execute()`.

Built-in tools: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash`, `PowerShell`, `Git`, `WebFetch`, `WebSearch`, `Agent`, `Task`, `MCP`, `LSP`, `Skill`.

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

## Key Files & Entry Points

- `src/main.tsx` — Entry point & CLI bootstrap
- `src/cli/App.tsx` — Root React component
- `src/commands/` — 100+ slash commands
- `src/services/ai/` — Multi-provider system
- `src/infra/tools/` — 40+ built-in tools
- `src/utils/kanban/` — Kanban board system (see below)

## Kanban Board System (`src/utils/kanban/`)

The Kanban system is a persistent task board with HTTP dashboard and autonomous worker support.

| File | Purpose |
|------|---------|
| `kanban.ts` | Core CRUD operations (add, move, edit, block, delete) |
| `store.ts` | JSON file I/O (`tasks.json`, `events.json`) |
| `server.ts` | HTTP server with HTML dashboard + REST API |
| `types.ts` | Shared types (`Task`, `TaskEvent`, `TaskStatus`) |
| `worker.ts` | Worker runtime: claim, execute, verify, complete |
| `workers.ts` | Durable worker registry (`workers.json`) |
| `validation.ts` | Task validation (dependencies, cycles, blocks) |
| `markdown.ts` | Markdown rendering for task descriptions |
| `agentRuntime.ts` | Helper to expose Kanban as an agent runtime |
| `index.ts` | Barrel export |

### Dashboard & API
```bash
bun run src/utils/kanban/server.ts    # Start dashboard on http://localhost:3000
# or use /kanban server CLI command
```

API endpoints: `GET /api/tasks`, `POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `POST /api/tasks/:id/claim`, `POST /api/tasks/:id/events`, `POST /api/tasks/claim-next`, `GET /api/tasks/:id/artifacts`, `GET /api/tasks/:id/artifacts/current`, `POST /api/tasks/:id/artifacts` (generate), `POST /api/tasks/:id/artifacts/:artifactId` (select).

### Artifact System
Workers can generate artifacts (outputs, checkpoints, logs, etc.) on tasks. Artifacts are versioned, with one marked as `isCurrent`. CLI commands:
```bash
/kanban artifact list <taskId>       # List all artifacts (newest first)
/kanban artifact current <taskId>    # Show the current artifact
/kanban artifact select <taskId> <artifactId>  # Select a different version as current
```

The dashboard has an "Artifacts" button on task cards opening a modal with version, type, label, content preview, and a "Select as current" action.

### Worker System
Workers can run autonomously via `/kanban worker` CLI command. They register in `.kanban/workers.json`, send heartbeats, claim tasks, and report results.

```bash
/kanban worker --worker builder --loop --statuses ready,todo --cmd-argv '["bun","run","build"]'
/kanban workers                        # List registered workers
/kanban worker heartbeat <taskId> [workerId]   # Send heartbeat to extend lease
/kanban worker recover-stale           # Recover all stale/expired leases
/kanban worker fail <taskId> --reason "msg" [workerId]  # Fail a claimed task
/kanban worker --worker w1 --once --lease-minutes 5  # Custom lease TTL (5 min)
```

#### Lease System
Each claimed task gets a lease with a configurable TTL (default 120s). Workers send heartbeats to extend the lease. Key safety guarantees:
- **Active lease blocks other workers**: tasks with non-expired leases from another worker cannot be claimed
- **Same worker re-claim**: re-claiming your own lease extends it (heartbeat-like)
- **Expired leases**: can be reclaimed by any worker or recovered via `recover-stale`
- **Terminal state protection**: done/archived/fully-failed tasks cannot be claimed
- **Fail clears lease**: failing a task releases its lease and increments the retry attempt counter

#### Stale Recovery
```bash
/kanban worker recover-stale   # Find and clear all expired leases
```

Recovery is **idempotent** — running it multiple times on the same board gives the same result. It leaves active (non-expired) leases untouched, resets stale `running` tasks back to `ready`, and records `stale_recovered` events.

Workers are designed for **local-only** or **trusted shared storage** environments (filesystem-based coordination).

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun / Node.js |
| Language | TypeScript 5.x ESM |
| UI | React 19 + Ink 6 |
| AI SDK | Vercel AI SDK (`@ai-sdk/*`) |
| Validation | Zod 3, Valibot 0.42 |
| CLI | Commander.js 13 |
| Search | fuse.js |
| Diff | diff |
| Markdown | marked + highlight.js |

## Important Notes

### CRLF Line Ending Bug
On Windows, the Edit tool converts files to CRLF. Bun's QuickJS TS parser treats `\r\n` as a single terminator, corrupting template literals. If you see "Unexpected end of file" errors, use Python to strip `\r`:
```bash
python -c "import sys; data=open('file.ts','rb').read(); open('file.ts','wb').write(data.replace(b'\r',b''))"
```

### Template Literals in kanban.ts
The `kanban.ts` file has pre-existing `npx tsc --noEmit` errors on template literals (not introduced by recent changes). Tests still pass in Bun's test runner.

### Permissions
Multi-layer permission system: Policy → Project → User → Environment → Code. Modes: `auto`, `accept-edits`, `ask-first`, `bypass`.

### Kanban Root Directory
Kanban board is scoped to the project root directory (`getProjectRoot()`). Data stored in `.kanban/` subdirectory.

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

## Legal

This project has **extraordinary legal circumstances**: code derived from an Anthropic accidental npm disclosure (March 2026). Before using, read:
- `docs/NOTICE.md` — 2-minute summary of legal risks
- `docs/LEGAL.md` — Complete disclaimer, indemnification, and liability terms
- `RESEARCH_MISSION.md` — Academic goals and methodology
