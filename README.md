<p align="center">
  <img src="assets/claude-logo-long.png" alt="Claude Code" width="480" />
</p>

<p align="center">
  <strong>Languages:</strong>
  <a href="README.md"><strong>English</strong></a> ·
  <a href="readme/README.zh.md">中文 (简体)</a> ·
  <a href="readme/README.th.md">ไทย</a>
</p>

# Claude Code

Claude Code is an independent, research-oriented **reverse-engineered rebuild** of Anthropic's [Claude Code](https://claude.ai/code) CLI. The goal is a **runnable, buildable, and debuggable** terminal workflow from source—not a black-box binary—while extending the runtime with multi-provider routing, adapters, and engineering tooling.

> **Disclaimer:** This repository is not affiliated with, endorsed by, or sponsored by Anthropic PBC. The upstream Claude Code product is proprietary; this project reconstructs and extends behavior for research and self-hosted use. Review [LICENSE.md](LICENSE.md) before redistributing or deploying.

## Positioning

| Aspect | What Claude Code provides |
| --- | --- |
| **Source fidelity** | Reconstructed CLI aligned with Claude Code's terminal UX, tools, and extension points |
| **Build & debug** | Bun/TypeScript tree you can `bun run dev`, type-check, test, and patch locally |
| **Enterprise-style surface** | Bridge/remote sessions, MCP, plugins, skills, agents/supervisor, voice, session memory, LSP—without requiring Anthropic's hosted-only gates for every workflow |
| **Our differentiation** | Declarative **multi-provider** routing (`providers.json`, `/model`), provider adapters, and dev utilities (`preload`, `codeindex`, `session`) |

> This is a community rebuild for engineers who need transparency and provider choice—not an official Anthropic distribution.

## What It Does

Claude Code gives you an AI coding assistant that runs in your terminal, can inspect and edit a local codebase, execute tools, switch between model providers, and coordinate longer workflows through commands, agents, plugins, and project skills.

Highlights:

- **Multi-provider AI routing** through Anthropic, OpenAI, Google Gemini, OpenRouter, Ollama, GitHub Copilot, and other OpenAI-compatible providers.
- **Runtime model switching** with `/model` and provider configuration.
- **Tool-based coding workflow** for reading, editing, writing, searching, running shell commands, using LSP features, browsing, and working with MCP servers.
- **Plugin hooks** for intercepting prompts, shell commands, tool usage, and file edits.
- **Skill loading** from bundled skills and project-level `.claude/skills/` directories.
- **Agent and supervisor workflows** for delegating research, coding, and coordination tasks.
- **Durable Agent Runtime & Orchestrator** with offline-first execution, checkpoints, and interactive approvals.
- **24/7 Autonomous Mode** with persistent task queue, daemon process, health checks, auto-retry, dead-letter handling, and lease-based concurrency control.
- **Scheduled Tasks** from the interactive `/task` form for one-shot reminders and recurring checks, with optional durable storage in `.claude/scheduled_tasks.json`.
- **Session and bridge features** for saving context, restoring work, and supporting remote collaboration.

### Compatibility Namespace

Claude Code's command is `claude`, but parts of the runtime intentionally still read Claude-compatible project and user paths such as `.claude/settings.json`, `.claude/skills/`, and selected `CLAUDE_CODE_*` environment variables. This keeps existing Claude Code-style projects, plugins, skills, hooks, and settings reusable while the public CLI and docs use the Claude Code name.

## Quick Start

### Install Globally

```bash
npm install -g claudecode
```

or:

```bash
bun install -g claudecode
```

Run it from any project directory:

```bash
claude
```

### Run From Source

```bash
git clone https://github.com/ClaudeCore/claudecode.git
cd claudecode
bun install
bun run build
bun run start
```

## Requirements

- [Bun](https://bun.sh) 1.3 or later for local development.
- At least one provider credential, such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, or another supported provider key.
- Windows, macOS, Linux, or WSL2.

## Provider Setup

Set one or more provider keys in your shell or `.env` file:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...
export OPENROUTER_API_KEY=sk-or-...
export OLLAMA_HOST=http://localhost:11434
```

Inside Claude Code, switch models or providers with:

```text
/model
/model list
/model openai/gpt-4o
/model google/gemini-2.5-pro
```

See [docs/providers.html](docs/providers.html) for the provider overview.

## Common Commands

```text
/model          Switch model or provider
/status         Show session, provider, and context status
/doctor         Run diagnostics
/context        Inspect context usage
/compact        Compress conversation context
/mcp            Manage MCP servers
/plugin         Manage plugins
/plugin-details Show plugin component inventory, hooks, MCP servers, and token cost
/loop           Run a prompt on a recurring interval (e.g. /loop 5m /check-deploy)
/autofix-pr     Fix CI errors and review comments on a PR via Claude Code on the web
/bridge         Configure bridge mode
/agent      Manage local agent workflows (run, status, trace, approvals, report)
/daemon     Open the interactive 24/7 autonomous daemon control panel
/task       Create scheduled tasks or manage the autonomous task queue
```

Type `/` inside the CLI to discover available commands.

## Scheduled Tasks

Scheduled tasks can be created from an interactive `/task` form, so you do not need to remember cron syntax. Run `/task` with no arguments, fill in the name, schedule, prompt, and storage mode, then confirm.

| You do | Claude Code does |
| --- | --- |
| `/task` | Opens the interactive scheduled task form |
| Select `Daily` around `09:00` | Creates a recurring daily task |
| Select `Weekdays` around `09:00` | Creates a weekday cron such as `0 9 * * 1-5` |
| Select `In N minutes` with `10` | Creates a one-shot reminder for the next matching local time |
| Select `Custom cron` | Accepts a standard 5-field cron expression |
| `/task scheduled` | Opens the same form explicitly |
| `/task list` | Lists autonomous queue tasks |

Details:

- Uses standard 5-field cron in the machine's local timezone: `minute hour day-of-month month day-of-week`.
- `Durable` storage persists scheduled tasks to `.claude/scheduled_tasks.json` across sessions.
- `Session-only` storage keeps tasks in memory for the current session only.
- Recurring tasks auto-expire after 30 days unless they are system-created permanent tasks.
- One-shot tasks auto-delete after they fire.
- Natural language scheduling still works through the underlying `CronCreate`, `CronList`, and `CronDelete` tools when the model chooses to use them.

Examples:

```text
/task
Name: Server status
Schedule: Daily
Time: 20:00
Prompt: Check the server status
Storage: Durable

/task
Name: Commit reminder
Schedule: In N minutes
Delay: 10
Prompt: Don't forget to commit the code
Storage: Session-only
```

## Development

```bash
bun run dev              # Start development mode with watch
bun run start            # Run the CLI from source
bun run build            # Build to dist/
bun test                 # Run tests
bun x tsc --noEmit       # Type-check only
bun run lint:check       # Check lint rules
bun run format:check     # Check formatting
bun run check:ci         # Run Biome CI checks
```

Useful project utilities:

```bash
bun run preload <module>     # Preload module context before editing
bun run session <command>    # Save, list, or restore session context
bun run codeindex <command>  # Index and search the codebase
bun run codegraph            # Generate a module dependency graph
bun run ast-grep -- <args>   # Run AST-based search or rewrite
```

## Project Layout

```text
src/
├── main.tsx              CLI bootstrap and main runtime
├── query.ts              Core query processing
├── QueryEngine.ts        Query orchestration
├── agentRuntime/         Agent orchestration, run store, and tool gateway
├── commands/             Slash command implementations
├── tools/                Built-in tool implementations
├── services/
│   ├── ai/               Provider manager, adapters, model registry
│   ├── autonomous/       24/7 autonomous agent daemon & task queue
│   ├── mcp/              MCP client and transport support
│   ├── plugins/          Plugin lifecycle and hooks
│   ├── tools/            Tool execution services
│   ├── lsp/              Language Server Protocol integration
│   ├── Supervisor/       Agent supervision
│   └── SessionMemory/    Persistent session memory
├── skills/               Skill loading and bundled skills
├── cli/                  Ink/React CLI UI
├── components/           Terminal UI components
├── bridge/               Remote collaboration bridge
├── coordinator/          Multi-agent coordination
├── keybindings/          Custom keybinding engine
├── state/                Lightweight reactive stores
└── vim/                  Vim-style editing mode
```

## Architecture

Claude Code is built around a provider-agnostic tool execution loop:

```text
Terminal UI
  -> Command and keybinding layer
  -> Provider manager and adapters
  -> Query engine and streaming loop
  -> Tool executor
  -> Plugin hooks, MCP, LSP, agents, memory, and bridge services
```

Provider-specific SDKs are wrapped behind adapters so the rest of the runtime can process streaming responses, tool calls, usage metadata, and content blocks through a common interface.

## Documentation

- [Installation](docs/installation.html)
- [Quick Start](docs/quick-start.html)
- [Configuration](docs/configuration.html)
- [AI Providers](docs/providers.html)
- [Models](docs/models.html)
- [Commands](docs/commands.html)
- [Tools](docs/tools.html)
- [Plugins](docs/plugins.html)
- [Skills](docs/skills.html)
- [Architecture](docs/architecture.html)
- [Permission Model](docs/permission-model.html)
- [Bridge Mode](docs/features/bridge-mode.html)
- [SearXNG Search](docs/features/searxng-search.html)
- [Troubleshooting](docs/troubleshooting.html)
- [Evals](docs/features/evals.html)

## Debugging

Enable general debug output:

```bash
DEBUG=1 bun run src/main.tsx
```

Enable scoped provider logging:

```bash
DEBUG=provider:anthropic bun run src/main.tsx
```

## Platform Notes

### Windows

If dependencies or native modules get into a bad state:

```powershell
Remove-Item -Recurse -Force node_modules
bun install
bun run dev
```

Claude Code includes a bundled Windows `ripgrep` binary at `src/utils/vendor/ripgrep/x64-win32/rg.exe` for file search tools.

### Production Build

The production build externalizes several native and optional modules, including Electron, Chromium BiDi, Anthropic platform SDK variants, AWS SDK packages, Google auth libraries, Sharp, audio capture packages, and React DevTools.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run the relevant checks:

```bash
bun test
bun run lint:check
bun run format:check
bun x tsc --noEmit
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) for project guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

See [LICENSE.md](LICENSE.md).
