<p align="center">
  <img src="assets/claude-logo-long.png" alt="Clew" width="480" />
</p>

<p align="center">
  <strong>Language:</strong>
  <a href="README.md"><strong>English</strong></a> ·
  <a href="readme/README.zh.md">中文 (简体)</a> ·
  <a href="readme/README.th.md">ไทย</a>
</p>

<p align="center">
  <a href="#installation"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJonusNattapong%2Fclaudecode%2Fmain%2Fpackage.json&query=%24.version&label=version&color=%238b5cf6" alt="Version"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-%238b5cf6" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-%238b5cf6" alt="Node"></a>
</p>

**Clew** is a terminal-based AI coding assistant that works with any LLM provider. Read code, edit files, run commands, and orchestrate multi-agent workflows — all from your terminal.

> **Disclaimer:** This project is independently rebuilt from Anthropic's Claude Code CLI for research and self-hosted development. Not affiliated with or endorsed by Anthropic PBC. See [LICENSE.md](LICENSE.md).

---

## Install

```bash
npm install -g @jonusnattapong/claudecode
```

Requires [Bun](https://bun.sh) 1.3+ at runtime. Then run `clew` in any project directory.

### From source

```bash
git clone https://github.com/JonusNattapong/claudecode.git
cd claudecode
bun install
bun run build
bun run start
```

## Quick start

```bash
export OPENAI_API_KEY=sk-...
clew
```

```text
> "explain the codebase structure"
> /model deepseek-v4-pro
> /status
```

Press `/` in the CLI to discover all commands. See the [quick start](docs/quick-start.html) guide.

## What makes it different

- **27+ providers** — Anthropic, OpenAI, Google Gemini, DeepSeek, OpenRouter, Ollama, xAI, Mistral, Groq, GitHub Copilot, and any OpenAI-compatible endpoint. Switch at runtime with `/model`.
- **90+ commands** — `/edit`, `/glob`, `/grep`, `/commit`, `/compact`, `/color`, `/task`, and more.
- **65+ tools** — file read/write/search, shell, web search, LSP, MCP, agent orchestration, scheduled tasks.
- **Plugin system** — lifecycle hooks (PreToolUse, PostToolUse, PreBash), marketplace, custom commands.
- **Agent runtime** — multi-agent orchestration, 24/7 daemon mode, worktree isolation, autonomous task queue.
- **Research & memory** — deep research, semantic cross-session memory, auto-memory capture.
- **Remote collaboration** — WebSocket bridge, session sharing, QR code pairing.
- **Voice mode** — always available via `/voice`.

## Documentation

| Topic | |
|---|---|
| Getting started | [Quick Start](docs/quick-start.html) · [Installation](docs/installation.html) · [Configuration](docs/configuration.html) |
| Providers | [Providers](docs/providers.html) · [Models](docs/models.html) |
| CLI | [Commands](docs/commands.html) · [Cli Reference](docs/cli-reference.html) · [Tools](docs/tools.html) |
| Context & sessions | [Context Window](docs/context-window.html) · [Sessions](docs/sessions.html) |
| Extending | [Plugins](docs/plugins.html) · [Skills](docs/skills.html) · [Hooks](docs/hooks.html) · [MCP](docs/mcp.html) |
| Autonomous | [Daemon](docs/daemon.html) · [Worktrees](docs/worktrees.html) · [Agent Teams](docs/agent-teams.html) |
| Reference | [Keybindings](docs/keybindings.html) · [Env Vars](docs/env-vars.html) · [Errors](docs/errors.html) · [Troubleshooting](docs/troubleshooting.html) |

## Development

```bash
bun run dev       # hot-reload dev mode
bun run start     # run from source
bun run build     # build to dist/
bun test          # run tests
bun x tsc --noEmit  # typecheck
bun run check     # biome lint + format
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE.md)
