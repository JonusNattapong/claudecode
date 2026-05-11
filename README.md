# Claude Code

A research-focused fork of Anthropic's Claude Code CLI with **multi-provider routing**, **provider-specific adapters**, and an **extensible plugin architecture**.

## ⚠️ Legal Notice

Before using, read:
- [NOTICE.md](docs/NOTICE.md) — 2-minute summary of legal risks
- [LEGAL.md](docs/LEGAL.md) — Complete disclaimer and indemnification

---

## Features

### 🤖 11 AI Providers
- **Anthropic** (default) - claude-sonnet-4, claude-opus-4, claude-3-haiku
- **OpenAI** - gpt-4o, gpt-4o-mini, gpt-4-turbo
- **Google Gemini** - gemini-2.0-flash, gemini-1.5-pro
- **OpenRouter** - 100+ models (Llama, Mistral, Claude via API)
- **Ollama** - Local models (Llama3, Mistral, CodeLlama)
- **xAI Grok** - grok-2, grok-2-vision
- **Mistral** - mistral-large, codestral
- **OpenAI Compatible** - Any OpenAI-compatible API
- **ChatGPT OAuth** - Use ChatGPT Plus/Pro subscription
- **Copilot** - GitHub Copilot integration
- **KiloCode** - Specialized provider

### ⚡️ 90+ Commands
| Category | Commands |
|----------|----------|
| **File Ops** | read, write, edit, glob, grep, add-dir, path, rename |
| **Git** | git, branch, diff, commit, enter, exit (worktree) |
| **Dev** | test, build, npm, agent, agents, resume, tasks, capabilities |
| **Search** | search, fetch, ls, find, mcp |
| **AI** | model, provider, cost, usage, extra-usage |
| **Permissions** | yolo, yolo-lite, yolo-max, yolo-god, permissions, plan |
| **Session** | session, clear, context, compact, rewind, resume, export, memory |
| **Settings** | config, theme, color, keybindings, hooks, mcp, privacy |
| **Collab** | bridge, remote-env, remote-setup, sticker, btw |
| **Utils** | help, stats, status, doctor, skill, skills, files, tag, ide |

### 🔌 Plugin System (12+ Plugins)
- **plugin-dev** - Plugin development toolkit
- **feature-dev** - Feature development workflow
- **code-review** - Automated code review
- **hookify** - Git hooks integration
- **commit-commands** - Enhanced git commits
- **frontend-design** - UI/UX assistance
- **pr-review-toolkit** - PR review automation
- **agent-sdk-dev** - Agent SDK development
- And more...

### 🛡️ YOLO Permission Modes
- **yoloLite** - Auto-approve read-only (Glob, Grep, Read)
- **yolo** - Auto-approve most tools
- **yoloMax** - Full auto including destructive
- **yoloGod** - Complete autonomy + autonomous web search

### Other Features
- **40+ Built-in Tools** - Read, Edit, Write, Bash, WebSearch, Agent, MCP, LSP
- **Subagents** - Background AI agents for parallel work
- **Bridge Mode** - Remote collaboration via session URLs
- **Skills** - Specialized instruction sets for tasks

---

## Quick Start

```bash
# Install
bun install

# Build
bun run build

# Run
bun run src/main.tsx session

# Or dev mode
bun run dev
```

### Set API Key

```bash
# Environment variable
export ANTHROPIC_API_KEY=sk-ant-...

# Or use .env file
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

### Switch Models

```bash
/model claude-sonnet-4-20250514
/model openai/gpt-4o
/model google/gemini-2.0-flash-exp
/model openrouter/anthropic/claude-3-5-sonnet
```

---

## Documentation

Full docs at [docs/](docs/):

| Page | Description |
|------|-------------|
| [Installation](docs/installation.html) | Setup guide |
| [Configuration](docs/configuration.html) | Settings reference |
| [Commands](docs/commands.html) | 90+ commands |
| [Tools](docs/tools.html) | 40+ built-in tools |
| [Providers](docs/providers.html) | 11 AI providers |
| [Agents](docs/agents.html) | Subagent system |
| [Plugins](docs/plugins.html) | Plugin directory |
| [Skills](docs/skills.html) | Skill reference |
| [Permissions](docs/permissions.html) | YOLO modes |
| [FAQ](docs/faq.html) | Common questions |
| [Troubleshooting](docs/troubleshooting.html) | Problem solving |

---

## Development

```bash
bun run dev        # Dev mode with --watch
bun test           # Run all tests
bun x tsc --noEmit # TypeScript check
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| UI | React 19 + Ink 6 |
| AI SDK | Vercel AI SDK |
| Validation | Zod 3, Valibot |
| CLI | Commander.js |

---

## Environment Variables

```bash
# Required (at least one)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_API_KEY=...
OPENROUTER_API_KEY=sk-or-...

# Optional
OLLAMA_HOST=http://localhost:11434
XAI_API_KEY=...
MISTRAL_API_KEY=...
GITHUB_TOKEN=...
CHATGPT_SESSION_TOKEN=...

# Settings
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

---

## License

See [LICENSE.md](LICENSE.md)

---

Built by **Dek1milliontoken**  
[GitHub](https://github.com/anomalyco/claude-code) • [Docs](docs/)