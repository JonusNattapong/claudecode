<p align="center">
  <img src="assets/claude-logo-long.png" alt="Claude Code" width="480" />
</p>

<p align="center">
  <strong>Language:</strong>
  <a href="README.md"><strong>English</strong></a> ·
  <a href="readme/README.zh.md">中文 (简体)</a> ·
  <a href="readme/README.th.md">ไทย</a>
</p>

---

# Claude Code

Claude Code is an independent, research-oriented **source-built reverse engineering and reconstruction** of Anthropic's official [Claude Code](https://claude.ai/code) CLI. 

This project aims to provide a **fully runnable, buildable, and debuggable** terminal-first AI coding workflow directly from source code—liberating developers from closed-source binaries. In addition, it extends the experience with native multi-provider routing, agent orchestrations, scheduled automation, custom plugin hooks, and advanced developer utilities.

> [!IMPORTANT]
> **Disclaimer:** This project is not affiliated with, endorsed by, or sponsored by Anthropic PBC. The original Claude Code CLI is a proprietary product. This repository reconstructs and extends its behaviors strictly for educational, research, and self-hosted development environments. Please read [LICENSE.md](LICENSE.md) before distributing or using this codebase in enterprise settings.

---

## Core Philosophy & Positioning

| Dimension | What This Rebuild Provides |
| :--- | :--- |
| **Source-Level Transparency** | A CLI reconstructed from the ground up to match the original Claude Code terminal UX, tools, and extensibility. |
| **Build & Debug** | Written in modern Bun and TypeScript. You can typecheck, test, customize, and run `bun run dev` completely locally. |
| **Enterprise & Offline Autonomy** | Local session memory, multi-agent Supervisor-worker structures, local MCP/LSP integration, voice support, and remote session bridging without forcing hosted-only Anthropic APIs. |
| **Our Superpowers** | Declarative **multi-provider** routing (`providers.json`, `/model`), provider-specific adapters, and custom developer utilities (`preload`, `codeindex`, `session`). |

> This is a community-driven rebuild designed for software engineers who require maximum control, privacy, transparency, and provider choice.

---

## Key Highlights & Features

Claude Code acts as an autonomous AI software engineer in your terminal. It reads and writes local codebases, executes shell commands, invokes local tools, interacts with MCP servers, and coordinates multi-step development workflows.

- 🤖 **Multi-Provider AI Routing**: Seamlessly route LLM calls to Anthropic, OpenAI, Google Gemini, OpenRouter, Ollama, DeepSeek, xAI/Grok, Mistral, Groq, GitHub Copilot, or any OpenAI-compatible custom endpoint.
- 🔄 **Runtime Model Swapping**: Toggle models and providers on-the-fly inside the active terminal session using `/model <provider/model>`.
- 🛠️ **Tool-Driven Coding Loop**: Automated reading, surgical editing, searching, shell execution, browser automation, and MCP tool usage.
- 🎛️ **Plugin Hooks System**: Intercept and hook into prompts, shell commands, tool invocations, and file edits (`PreToolUse`, `PostToolUse`, `PreBash`, `PostPrompt`, `PreAcceptEdit`).
- 🧠 **Project Skills**: Programmatic skills loaded from local bundled locations and custom project-level `.claude/skills/` directories.
- 🛡️ **Durable Agent Runtime & Orchestrator (PLAN I)**: A highly resilient agent execution framework that is 100% offline-friendly, featuring automated checkpoint recovery and interactive user approvals for sensitive shell or file actions.
- ⏰ **Scheduled Tasks & Autonomy**: Set up one-shot reminders or recurring cron schedules via the interactive `/task` panel. Task queue is backed by durable, file-based JSON storage (`.claude/scheduled_tasks.json`).
- 👥 **Session Bridging**: Persist terminal context, pause/resume tasks across sessions, and enable remote multi-agent or developer collaboration.

---

## Quick Start

### 1. Global Installation

You can install the stable package globally via **NPM**:

```bash
npm install -g claudecode
```

Or using **Bun**:

```bash
bun install -g claudecode
```

Run the assistant in any of your project directories:

```bash
claude
```

---

### 2. Running From Source

To develop, customize, and build the CLI locally:

```bash
# Clone the repository
git clone https://github.com/ClaudeCore/claudecode.git
cd claudecode

# Install dependencies (requires Bun 1.3+)
bun install

# Run type checks and build
bun run build

# Start the source-built CLI
bun run start
```

---

## System Requirements

- **Runtime**: [Bun](https://bun.sh) 1.3 or higher for local development and execution.
- **API Keys**: At least one valid provider credential configured in your environment (e.g., `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`).
- **Operating Systems**: Windows (native or WSL2), macOS, or Linux.

---

## Provider & Environment Configuration

Set up your provider credentials in your terminal session or save them inside a local `.env` file at the root of your workspace:

```bash
# Provider API Keys
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-proj-...
export GOOGLE_API_KEY=AIzaSy...
export OPENROUTER_API_KEY=sk-or-...
export DEEPSEEK_API_KEY=sk-...
export XAI_API_KEY=xai-...
export MISTRAL_API_KEY=...
export GROQ_API_KEY=gsk_...
export COPILOT_GITHUB_TOKEN=ghu_...

# Local / Self-Hosted
export OLLAMA_HOST=http://localhost:11434
```

To switch models dynamically during a live session, type `/model` in the prompt:

```text
/model list                      # View available models and providers
/model google/gemini-2.5-pro     # Switch to Google Gemini Pro
/model openai/gpt-4o             # Switch to OpenAI GPT-4o
/model anthropic/claude-3-5-sonnet  # Switch back to Claude 3.5 Sonnet
```

For custom endpoint configurations and capability flags, see the declarative registry in [src/services/ai/providers.json](src/services/ai/providers.json).

---

## Slash Commands

Claude Code features a set of intuitive slash commands to control the runtime environment:

| Slash Command | Description |
| :--- | :--- |
| `/model` | Query, list, and switch AI providers/models dynamically. |
| `/status` | Display the active model, provider connection, and context token utilization. |
| `/doctor` | Run diagnostic tests and resolve local configuration issues. |
| `/context` | Inspect detail of the active LLM context window. |
| `/compact` | Compress and prune conversation history to free up context tokens. |
| `/mcp` | List, add, configure, or remove Model Context Protocol (MCP) servers. |
| `/plugin` | Manage custom lifecycle plugins and hooks. |
| `/bridge` | Start and manage bridge mode for remote workspace collaboration. |
| `/agent` | Orchestrate and inspect background agent sessions (`run`, `status`, `approvals`, `report`). |
| `/daemon` | Launch an interactive dashboard to control autonomous background daemons. |
| `/task` | Launch an interactive panel to create or schedule background tasks and reminders. |

> Type `/` in the CLI prompt at any time to see the autocomplete list of all supported commands.

---

## Scheduled Tasks (`/task`)

The Scheduled Tasks system is powered by an interactive prompt form—eliminating the need to memorize complex cron expressions. Type `/task` with no arguments, fill in the fields, and submit.

```text
/task
Name: Daily Health Check
Schedule: Daily
Time: 09:00
Prompt: Run the project tests and generate a status report.
Storage: Durable
```

### Scheduling Options:
- **Daily / Weekly / Weekdays**: Interactive calendar selectors. For instance, Weekdays auto-maps to `0 9 * * 1-5`.
- **In N Minutes**: Sets a one-shot delay (e.g., 10 minutes) relative to your local timezone.
- **Custom Cron**: Accepts standard 5-field cron syntax (`minute hour day-of-month month day-of-week`).
- **Durable Storage**: Permanently records the task to `.claude/scheduled_tasks.json` so it survives across terminal restarts.
- **Session-only**: Keeps the task registered strictly in volatile memory for the active terminal shell.

---

## Developer Utilities

This repository packages several custom workflow utilities to accelerate large codebase edits:

```bash
bun run preload <module>     # Code Preloader: Generates comprehensive module contexts (exports, TODOs, history) into .claude/context/
bun run session <command>    # Session Bridge: Save, list, or restore terminal context across distinct sessions
bun run codeindex <command>  # CodeIndex: Generate high-speed fuzzy indexing and query local files
bun run codegraph            # CodeGraph: Visualize module dependency structures
bun run ast-grep -- <args>   # ast-grep: Highly accurate AST-based code searches and refactoring
```

---

## Project Structure

```text
src/
├── main.tsx              # Ink React terminal UI bootstrap & main loop
├── entrypoints/          # Entry hooks: CLI, Init/REPL, MCP Server
├── query.ts              # Query processor: constructs system instructions and maps tool cycles
├── QueryEngine.ts        # Orchestration layer (caching, deduping, and rate limiting)
├── agentRuntime/         # Durable Agent orchestrators, run storage, and gateways
├── commands/             # Slash command implementations
├── tools/                # Built-in developer tools (files, search, terminal shells)
├── services/
│   ├── ai/               # ProviderManager, adapters, normalizers, and providers.json
│   ├── autonomous/       # Persistent task queues, background daemon loops, and supervisor
│   ├── mcp/              # Model Context Protocol clients
│   ├── plugins/          # Plugin lifecycle hooks and interceptors
│   ├── lsp/              # Language Server Protocol integration
│   ├── Supervisor/       # Autonomous agent supervisor
│   └── SessionMemory/    # Long-term session persistence
├── skills/               # Dynamic project-level skills loader
├── cli/                  # React terminal UI context
├── components/           # Terminal UI rendering blocks
├── bridge/               # WebSocket bridge for remote pairing
├── coordinator/          # Multi-agent worker orchestration
└── state/                # Lightweight observable global stores
```

---

## Local Development Commands

During development, use the following scripts to check code quality and correctness:

```bash
bun run dev              # Dev mode with hot reload/watch enabled
bun run start            # Run source code CLI
bun run build            # Compile and bundle project into /dist
bun test                 # Execute the test suite
bun x tsc --noEmit       # Compile-time TypeScript check
bun run check            # Biome lint, format, and organize imports with auto-fixes
bun run lint:check       # Validate Biome lint rules
bun run format:check     # Validate Biome code formatting
bun run check:ci         # Run strict validation for CI pipelines
```

### Biome Code Style
This codebase utilizes [Biome](https://biomejs.dev) for formatting and linting. The rules are defined in `biome.json`:
- Line width limit: 120 characters
- Indentation: 2 spaces
- LF line endings, single quotes, mandatory trailing commas, and semicolons.

---

## Platform Notes

### Windows Development
- Clean node modules and rebuild safely:
  ```powershell
  Remove-Item -Recurse -Force node_modules
  bun install
  bun run dev
  ```
- **Ripgrep**: A precompiled `rg.exe` for Windows is bundled under `src/utils/vendor/ripgrep/x64-win32/rg.exe` to guarantee lightning-fast filesystem searches.
- **PowerShell Support**: Windows launches a dedicated `PowerShellTool` parallel to the standard `BashTool` to support native cmdlets.

---

## Contributing

We welcome community contributions, feature ideas, and pull requests! Please review our [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) guidelines.

---

## License

This project is distributed under the terms defined in [LICENSE.md](LICENSE.md).
