# CLAUDE.md

Operational guide for coding agents working in this repository.

## Repository Purpose

This repository is a research-oriented fork of Anthropic's Claude Code CLI. The binary is renamed to `claudevil` to avoid conflicts with the official package. It keeps the terminal-first coding-agent workflow while adding:

- unified multi-provider model routing
- provider-specific adapters
- built-in tools and slash commands
- plugin and skill systems
- MCP, LSP, bridge, supervisor, session, daemon, research, and memory infrastructure

Treat the project as a large TypeScript/Bun CLI app with React/Ink terminal UI and a provider-agnostic AI execution layer.

This is an independent research and development project. Do not imply affiliation, endorsement, or sponsorship by Anthropic unless the repository explicitly says so elsewhere.

## Core Working Rules

- Make surgical changes. Touch only files needed for the task.
- Prefer simple fixes over new abstractions.
- Preserve existing APIs, command names, config names, aliases, env vars, and file layout unless asked to change them.
- Keep terminal output concise and consistent with the existing UI style.
- Do not edit generated build output in `dist/` as the source of truth.
- Do not remove compatibility code only because it appears unused. This repo supports multiple providers, platforms, commands, shells, and runtime modes.
- Do not hardcode API keys, secrets, local machine paths, or user-specific paths.
- Do not bypass `ProviderManager`, tool hooks, permission checks, or command registries.
- Do not add dependencies unless existing utilities are insufficient and the benefit is clear.

## Before Editing

1. Identify the affected layer: UI, command, provider, adapter, query loop, tool execution, plugin, skill, config, bridge, daemon, memory, or infrastructure.
2. Search for existing patterns before adding a new implementation.
3. Check nearby tests and related call sites.
4. For provider/tool/query changes, inspect normalization, streaming, error handling, retries, and usage accounting.
5. For command changes, verify registration in `src/commands.ts` or the relevant registry.
6. For risky modules, preload context before editing:

```bash
bun run preload bridge
bun run preload query
bun run preload commands
bun run preload services/ai
bun run preload src/bridge
```

The preloader writes `.claude/context/<module>.md`. Read it before changing that module.

## After Editing

Run the smallest useful validation first:

```bash
bun x tsc --noEmit
bun test <path>
```

For broader changes:

```bash
bun test
bun run build
bun run check
```

If validation cannot run in the environment, state what should be run and why.

## Development Commands

```bash
bun install                # install dependencies
bun run dev                # dev mode with watch
bun run start              # run CLI without watch
bun run build              # build production bundle into dist/
bun test                   # run all tests
bun test <path>            # run targeted tests
bun x tsc --noEmit         # type check only
bun run check              # Biome lint + format + organize imports
bun run lint               # Biome lint with safe fixes
bun run lint:check         # Biome lint check, no writes
bun run format             # Biome format
bun run format:check       # format check, no writes
bun run check:ci           # CI check, no writes
bun run ast-grep -- <args> # AST-based search/rewrite
bun run preload <module>   # create module context
bun run codegraph          # code intelligence graph queries
bun run session <cmd>      # save/list/restore session context
```

## Useful Runtime Commands

```text
/status     Show model, provider, context, and internal state
/doctor     Run diagnostics and possible auto-fixes
/context    Show context window usage
/model      Switch provider or model at runtime
/compact    Compress session context
/mcp        Manage MCP servers
/plugin     Manage plugins
/bridge     Configure remote collaboration mode
```

## Architecture Map

```text
Terminal UI
  src/cli/App.tsx
  src/components/
  src/context/
  src/buddy/

Command Layer
  src/commands.ts
  src/commands/
  src/keybindings/
  src/vim/

AI Provider + Adapter Layer
  src/services/ai/ProviderManager.ts
  src/services/ai/providerRegistry.ts
  src/services/ai/providers.json
  src/services/ai/providers/
  src/services/ai/adapter/
  src/services/ai/contentBlockUtils.ts
  src/services/ai/toolCallParser.ts
  src/services/ai/errorNormalizer.ts
  src/services/ai/usageNormalizer.ts

Core Query + Streaming
  src/main.tsx
  src/query.ts
  src/QueryEngine.ts
  src/query/

Tool System
  src/Tool.ts
  src/tools.ts
  src/tools/
  src/services/tools/

State
  src/state/store.ts
  src/state/AppState.tsx
  src/state/AppStateStore.ts
  src/state/selectors.ts

Agent Runtime + Autonomous
  src/agentRuntime/
  src/services/autonomous/
  src/coordinator/

Research + Memory
  src/research/
  src/memdir/

Infrastructure
  src/services/mcp/
  src/services/plugins/
  src/services/lsp/
  src/services/Supervisor/
  src/services/SessionLifecycle/
  src/services/SessionMemory/
  src/services/settingsSync/
  src/bridge/
  src/voice/
```

## Key Files

| File | Role |
| --- | --- |
| `src/main.tsx` | Main CLI bootstrap, Ink app setup, streaming loop |
| `src/entrypoints/cli.tsx` | Commander-based CLI entry |
| `src/entrypoints/init.ts` | Init/repl entry |
| `src/entrypoints/mcp.ts` | MCP server entry |
| `src/query.ts` | Core query processing, message building, context, tool loop |
| `src/QueryEngine.ts` | Query orchestration, caching, dedupe, rate limiting |
| `src/commands.ts` | Slash command registry |
| `src/tools.ts` | Built-in tool registry |
| `src/Tool.ts` | Base tool types and schemas |
| `src/services/ai/ProviderManager.ts` | Provider/model selection, API keys, config migration |
| `src/services/ai/providerRegistry.ts` | Provider metadata and capability resolution |
| `src/services/ai/providers.json` | Declarative provider config |
| `src/services/ai/adapter/AnthropicAdapter.ts` | Anthropic-compatible adapter |
| `src/services/ai/adapter/GoogleAdapter.ts` | Gemini adapter |
| `src/services/ai/contentBlockUtils.ts` | Content block conversion |
| `src/services/ai/toolCallParser.ts` | Tool call normalization |
| `src/services/tools/StreamingToolExecutor.ts` | Streaming tool execution |
| `src/services/tools/toolHooks.ts` | Pre/post tool hooks |
| `src/bridge/bridgeMain.ts` | WebSocket bridge and remote collaboration |
| `src/state/store.ts` | Lightweight observable store |
| `src/services/autonomous/taskQueue.ts` | File-backed queue with priorities, leases, dead-letter |
| `src/services/autonomous/agentLoop.ts` | Continuous autonomous loop |
| `src/services/autonomous/daemonMode.ts` | Daemon entrypoint |
| `src/services/autonomous/supervisorIntegration.ts` | Health checks and respawn |

## Multi-Provider Flow

1. User selects provider/model through `/model` or config.
2. `ProviderManager` resolves provider, API key, model, and migrations.
3. `providerRegistry` loads capabilities and model metadata.
4. Non-Anthropic providers use adapter layer.
5. `contentBlockUtils` normalizes content blocks.
6. `toolCallParser` normalizes tool calls.
7. Core query/streaming loop processes the response uniformly.
8. Usage, errors, and tool results are normalized before display or persistence.

When modifying this flow, check streaming chunks, tool parsing, thinking/text blocks, content conversion, normalized errors, token accounting, retries/rate limits, provider capability flags, and model discovery fallbacks.

## Tool System Rules

When adding or editing a tool:

- define strict schemas with Zod
- validate input early
- keep output stable and machine-readable when possible
- avoid hidden side effects
- preserve permission checks and hooks
- add or update nearby tests when available

Typical tool structure:

| File | Purpose |
| --- | --- |
| `<ToolName>.ts` or `index.ts` | Tool class, schema, execute logic |
| `prompt.ts` | Tool prompt injected into system prompt |
| `UI.tsx` | Ink output component |
| `constants.ts` | Shared defaults and limits |
| `types.ts` | Tool-specific types |

Register tools in `src/tools.ts`.

## Slash Command Rules

Slash commands live under `src/commands/` and are registered through the command registry.

When changing a command:

- keep interactive and non-interactive behavior consistent
- update registration
- preserve aliases
- avoid breaking scripts that call command names directly
- keep terminal UI output short
- test parser or non-interactive logic when possible

## Plugin and Skill Rules

Plugins load from user and bundled plugin locations. Hook points include:

- `PreToolUse`
- `PostToolUse`
- `PreBash`
- `PostPrompt`
- `PreAcceptEdit`

When changing plugin or skill behavior:

- preserve manifest compatibility
- avoid hook payload shape changes without migration
- keep bundled skills independent from local user config
- do not assume a plugin is installed unless the path guarantees it

## State Management

The app uses lightweight observable stores through `createStore<T>` in `src/state/store.ts`.

```ts
type Store<T> = {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: Listener) => () => void;
};
```

Stores are plain functions. React components subscribe through `AppState`. Prefer extending an existing store or adding a small store over adding a new state management library.

## Agent Runtime and Daemon

Agent runtime:

- `src/agentRuntime/orchestrator.ts` coordinates agent sessions.
- `src/agentRuntime/runStore.ts` persists run data.
- `src/agentRuntime/toolGateway.ts` routes tools.
- `src/agentRuntime/workflowRegistry.ts` declares workflows.
- `src/agentRuntime/agentRegistry.ts` registers agents.

Autonomous system:

- `taskQueue.ts` stores tasks with priorities, leases, retries, and dead-letter handling.
- `agentLoop.ts` dequeues, spawns workers, monitors, and retries.
- `daemonMode.ts` runs under supervisor.
- `supervisorIntegration.ts` handles health checks and respawn.

Coordinator:

- `coordinatorMode.ts` delegates work to sub-agents.
- `workerAgent.ts` runs delegated subtasks.

## Research and Memory

- `src/research/` handles deep research, citation extraction, claim verification, dossier generation, truth checking, and source ranking.
- `src/memdir/` handles semantic memory search, memory age tracking, and cross-session recall.

## Platform and Build Notes

- Runtime: Bun 1.3+
- Language: TypeScript 5.x, ESM, `moduleResolution: "bundler"`, alias `src/*` -> `src/*`
- UI: React 19 + Ink 6
- Validation: Zod 3 and Valibot 0.42
- CLI: Commander.js 13
- Code search: ast-grep, bundled ripgrep
- Markdown: marked, highlight.js, turndown
- Lint/format: Biome 2.4
- Terminal: chalk, ora, ink-spinner, ink-text-input

Platform constraints:

- Windows uses bundled ripgrep at `src/utils/vendor/ripgrep/x64-win32/rg.exe`.
- Windows has a `PowerShellTool` alongside `BashTool`; test both when shell behavior changes.
- `src/main.tsx` contains Windows PowerShell/Ink TTY workarounds.
- Claude-in-Chrome MCP is dynamically imported at runtime.
- Native TypeScript ports live in `src/native-ts/`.
- Some native or external packages are intentionally externalized during build.

## Biome Conventions

- 120 char line width
- 2-space indent
- LF line endings
- single quotes
- semicolons always
- trailing commas
- organize imports enabled
- git integration respects `.gitignore`
- `noUnusedVariables` and `noUnusedImports` are warnings
- `noExplicitAny` and `noNonNullAssertion` are off

`.claude/settings.json` auto-runs Biome after edits by `FileEditTool` or `FileWriteTool`; no manual format step is needed for touched files unless broader formatting is intended.

## Feature Flags

Build uses Bun `--define` flags in `dev` and `build` scripts.

| Flag | Purpose |
| --- | --- |
| `TRANSCRIPT_CLASSIFIER` | Auto mode / permission cycling |
| `CHICAGO_MCP` | MCP server enhancements |
| `VOICE_MODE` | Voice input support |

Add new compile-time flags to both scripts in `package.json`.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic provider key |
| `OPENAI_API_KEY` | OpenAI provider key |
| `GOOGLE_API_KEY` | Google/Gemini provider key |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `DEEPSEEK_API_KEY` | DeepSeek key |
| `XAI_API_KEY` | xAI/Grok key |
| `MISTRAL_API_KEY` | Mistral key |
| `GROQ_API_KEY` | Groq key |
| `COPILOT_GITHUB_TOKEN` | GitHub Copilot token |
| `OLLAMA_HOST` | Local Ollama host |
| `DEBUG` | Debug logging, e.g. `1` or `provider:anthropic` |
| `NO_COLOR` / `FORCE_COLOR` | Terminal color control |
| `NODE_OPTIONS` | Node/Bun runtime options |

Check `src/services/ai/providers.json` before adding provider-specific env keys.

## ast-grep Examples

```bash
bun run ast-grep run -p 'console.log($_)' src/
bun run ast-grep run -p 'try { $$$ } catch($ERR) {}'
bun run ast-grep run -p 'function $F($$$) { $$$ }'
bun run ast-grep run -p 'import { $A } from "$B"' --glob '**/*.ts'
bun run ast-grep run -p '$X.catch($F)' -r 'await $X.catch($F)' src/
bun run ast-grep scan
```

## Session

```bash
bun run session save "adding auth middleware to bridge"
bun run session list
bun run session restore
```

## Debugging

```bash
DEBUG=1 bun run src/main.tsx
DEBUG=provider:anthropic bun run src/main.tsx
```

## Testing Strategy

Tests use Bun's built-in test runner. Prefer colocated `*.test.ts` files and targeted tests during active development. Run full tests and build before finalizing broad changes.

Useful targeted checks:

```bash
bun test src/utils/codeIndex/
bun test src/utils/agentSwarmsEnabled.test.ts
bun x tsc --noEmit
bun run build
```

## Risk Checklist

Provider or adapter changes:

- streaming still works
- text blocks, tool calls, thinking blocks, and errors normalize correctly
- usage tokens are counted correctly
- model discovery falls back to `providers.json`
- capability flags are accurate

Tool changes:

- schemas are strict
- permission checks remain intact
- hooks still fire
- results remain compatible with the query loop
- failures return structured errors

Command/UI changes:

- command remains registered
- interactive and non-interactive paths work
- output remains stable and readable
- keybindings and aliases remain intact

Autonomous/daemon changes:

- task queue format remains backward-compatible
- leases, dead-letter, and retry semantics remain valid
- supervisor health check and respawn still work

State/store changes:

- store shape remains backward-compatible
- React subscribers re-render correctly
- serialized state contains no functions or circular refs

Build/runtime changes:

- Windows, macOS, Linux, and WSL2 remain supported
- PowerShellTool and BashTool behavior remain correct
- native dependencies are externalized or bundled correctly
- Bun ESM / `NodeNext` resolution remains valid
- feature flags are added where needed

## Preferred Work Report

```text
Summary
- What changed

Validation
- Commands run and results

Notes
- Risks, skipped checks, or follow-up work
```
