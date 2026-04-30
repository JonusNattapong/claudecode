<div align="center">

# Claude Code: Agentic Coding

> **An Experimental Study on Multi-Provider Agentic Architectures**

[![Research Status](https://img.shields.io/badge/Status-Research--Only-blueviolet)](RESEARCH_MISSION.md)
[![Educational Content](https://img.shields.io/badge/License-Educational--Use-green)](docs/LEGAL.md)
[![Bun](https://img.shields.io/badge/runtime-Bun%20%7C%20Node.js-ffdf00.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

</div>

> **CRITICAL LEGAL NOTICE**: Before using this research framework, you **MUST** read:
> - **[NOTICE.md](docs/NOTICE.md)** — 2-minute summary of legal risks
> - **[LEGAL.md](docs/LEGAL.md)** — Complete disclaimer & liability terms
> - **[RESEARCH_MISSION.md](RESEARCH_MISSION.md)** — Academic goals and methodology

---

## Table of Contents

- [Quick Start](#quick-start)
- [What is Claude Code](#what-is-claude-code-by-dek1milliontoken)
- [Supported Providers](#supported-providers)
- [Installation](#installation)
- [Commands](#commands)
- [Built-in Tools](#built-in-tools)
- [Configuration](#configuration)
- [Plugin System](#plugin-system)
- [Security](#security)
- [Project Structure](#project-structure)
- [Development](#development)
- [Technology Stack](#technology-stack)
- [Documentation](#documentation)
- [Legal & Compliance](#legal--compliance)
- [License & Links](#license--links)
- [Research Mission](#-research--education-mission)

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.0+ (recommended) or [Node.js](https://nodejs.org/) 18+
- Git

### Install & Run

```bash
# Clone and install
git clone https://github.com/JonusNattapong/ClaudeCode.git
cd ClaudeCode
bun install

# Start a session
bun run src/main.tsx session

# Or with specific provider
bun run src/main.tsx session --provider openai --model gpt-4o
```

### Set API Keys

```bash
# Core providers
export ANTHROPIC_API_KEY="sk-ant-..."      # Anthropic Claude
export OPENAI_API_KEY="sk-..."             # OpenAI GPT
export DEEPSEEK_API_KEY="sk-..."          # DeepSeek

# Gateways & Aggregators
export OPENROUTER_API_KEY="sk-or-..."     # OpenRouter (100+ models)
export KILOCODE_API_KEY="kilo-..."       # KiloCode (500+ models)
export OPENCODE_API_KEY="oc-..."         # OpenCode

# Specialized providers
export GROQ_API_KEY="gpro..."            # Groq
export XAI_API_KEY="xai-..."             # xAI Grok
export MISTRAL_API_KEY="mistral-..."      # Mistral

# Ollama: no API key needed (run on http://localhost:11434)
```

---

## What is Claude Code By Dek1MillionToken?

A research-focused evolution of the Claude Code CLI with **unified multi-provider routing**, **provider-specific adapters**, and an **extensible plugin architecture**.

Switch between Anthropic Claude, OpenAI GPT, Google Gemini, OpenRouter, local Ollama, and more — all from one terminal interface.

### Why Claude Code By Dek1MillionToken?

| Feature | Benefit |
|---------|---------|
| **One CLI, every provider** | No more switching tools for different AI models |
| **Provider-native adapters** | Each provider gets optimized handling, not just OpenAI-compatible wrappers |
| **Real-time model discovery** | Fetches available models from provider APIs with 5-minute cache |
| **Unified normalizers** | Tool calls, token usage, and errors are normalized across all providers |
| **40+ built-in tools** | File ops, shell execution, web search, MCP, LSP, git, and more |
| **Plugin system** | Extend with custom commands, skills, and lifecycle hooks |

> **Legal Notice**: Please review the [Legal Disclaimer & Attribution](docs/LEGAL.md) for important information about third-party components, licensing, and liability limitations before using this software.

---

## Supported Providers

| Provider | Models | API Key | Tool Calling | Streaming |
|----------|--------|---------|-------------|-----------|
| **Anthropic** | Claude Sonnet 4, Claude Opus 4.1, Haiku 3.5 | `ANTHROPIC_API_KEY` | Native | Full SSE |
| **OpenAI** | GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano | `OPENAI_API_KEY` | Native | Full SSE |
| **DeepSeek** | DeepSeek V3, V4 | `DEEPSEEK_API_KEY` | Native | Full SSE |
| **OpenRouter** | 100+ models | `OPENROUTER_API_KEY` | Native | Partial |
| **OpenCode** | Claude, GPT, Gemini, Kimi, GLM | `OPENCODE_API_KEY` | Native | Partial |
| **Cline** | Claude, GPT, Gemini | `CLINE_API_KEY` | Native | Partial |
| **Groq** | Llama 3.3, Mixtral | `GROQ_API_KEY` | Native | Partial |
| **xAI** | Grok 3, Grok 2 | `XAI_API_KEY` | Native | Partial |
| **Mistral** | Mistral Large 2, Codestral | `MISTRAL_API_KEY` | Native | Partial |
| **KiloCode** | 500+ models | `KILOCODE_API_KEY` | Native | Partial |
| **Ollama** | Local models (Llama, DeepSeek) | None required | Native | Partial |
| **Copilot** | GPT-4.1, GPT-4o | GitHub CLI | Native | Full |

---

## Installation

### Standard Install

```bash
# Clone the repository
git clone https://github.com/JonusNattapong/ClaudeCode.git
cd ClaudeCode

# Install dependencies
bun install

# Build
bun run build
```

### Run Options

```bash
# Development mode (auto-rebuild on changes)
bun run dev

# Specify provider and model
bun run src/main.tsx session --provider openai --model gpt-4o
bun run src/main.tsx session --provider anthropic --model claude-sonnet-4
bun run src/main.tsx session --provider ollama --model llama3
```

### Video Preview

<https://github.com/user-attachments/assets/f7d84050-a61c-4b20-a988-edaa93a4deb8>

---

## Commands

100+ slash commands available. Type `/` in the prompt to explore.

### Session & Model

| Command | Description |
|---------|-------------|
| `/model` | Switch AI model (interactive picker with dynamic model fetching) |
| `/provider` | Manage AI provider (set, list, key, models, reset) |
| `/provider set <provider>` | Set active provider |
| `/provider key <provider> <api-key>` | Save API key for provider |
| `/resume` | Resume a previous session |
| `/continue` | Continue most recent session |
| `/new` | Start a fresh conversation |
| `/fork` | Fork conversation into new session |
| `/save` | Save session with custom name |

### Configuration

| Command | Description |
|---------|-------------|
| `/config` | Open settings editor |
| `/theme` | Change color theme |
| `/color` | Change accent color |
| `/effort` | Adjust thinking effort (low -> max) |
| `/buddy` | Configure AI companion (Buddy) |
| `/status` | Show system status |
| `/doctor` | Run diagnostics & auto-fix |

### Tools & Integration

| Command | Description |
|---------|-------------|
| `/cost` | Show token usage & cost |
| `/context` | Show context window usage |
| `/diff` | View git diff |
| `/commit` | Git commit wizard |
| `/commit-push-pr` | Commit, push, create PR |
| `/mcp` | MCP server management |
| `/plugin` | Plugin marketplace |
| `/skills` | Skill management |
| `/files` | Browse project files |

### Feature-Gated Commands

Enable via environment variables:

| Flag | Commands | Description |
|------|----------|-------------|
| `KAIROS=1` | `/assistant`, `/brief` | AI assistant features |
| `BRIDGE_MODE=1` | `/bridge` | Remote collaboration |
| `ULTRAPLAN=1` | `/ultraplan`, `/loop` | Ultra-deep planning |
| `VOICE_MODE=1` | `/voice` | Voice dictation |

```bash
# Enable all features
KAIROS=1 BRIDGE_MODE=1 ULTRAPLAN=1 VOICE_MODE=1 bun run src/main.tsx session
```

---

## Built-in Tools

40+ tools that the AI can use to interact with your system:

| Category | Tools |
|----------|-------|
| **File Operations** | `Read`, `Edit`, `Write`, `Glob`, `Grep` |
| **Shell Execution** | `Bash` (sandboxed), `PowerShell` (sandboxed) |
| **Web** | `WebFetch`, `WebSearch` |
| **Git** | Git operations, diff, commit, branch |
| **Agent System** | `Agent`, `Task` create/get/list/stop/update |
| **MCP** | `MCP`, `ListMcpResources`, `ReadMcpResource`, `McpAuth` |
| **Planning** | `EnterPlanMode`, `ExitPlanMode`, `VerifyPlanExecution` |
| **Other** | `TodoWrite`, `Config`, `LSP`, `Skill`, `Workflow`, `NotebookEdit`, `Sleep` |

---

## Configuration

### Settings Hierarchy

Settings are loaded from multiple sources (lowest -> highest precedence):

1. Built-in defaults
2. Environment variables (`CLAUDE_CODE_*`)
3. Managed settings (enterprise policy)
4. Project settings (`.claude/settings.json`)
5. User settings (`~/.claude/settings.json`)

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI GPT API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `KILOCODE_API_KEY` | KiloCode API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `COPILOT_GITHUB_TOKEN` | GitHub Copilot token (use `gh auth login`) |
| `ANTHROPIC_BASE_URL` | Custom Anthropic endpoint |
| `OPENAI_BASE_URL` | Custom OpenAI-compatible endpoint |
| `BRIDGE_MODE=1` | Enable bridge commands |
| `VOICE_MODE=1` | Enable voice commands |
| `ULTRAPLAN=1` | Enable ultraplan commands |
| `KAIROS=1` | Enable assistant/brief commands |
| `DISABLE_TELEMETRY=1` | Disable telemetry |
| `DEBUG=1` | Enable debug logging |

### Provider Selection

```bash
# Interactive (in session)
/provider                    # List all providers
/provider set anthropic       # Set provider
/provider set openai         # Set provider
/provider set openrouter      # Set provider

# Save API key for provider
/provider key anthropic sk-ant-...
/provider key openai sk-...
/provider key openrouter sk-or-...

# GitHub Copilot: use GitHub CLI for authentication
gh auth login                 # Login to GitHub
/provider key copilot       # Will use gh auth token automatically

# CLI flags
bun run src/main.tsx session --provider openai --model gpt-4o
bun run src/main.tsx session --provider anthropic --model claude-sonnet-4
bun run src/main.tsx session --provider ollama --model llama3
```

### Model Selection

```bash
# Interactive model picker (fetches from provider API)
/model                       # Shows models for current provider
/model gpt-5.5              # Set specific model
/model claude-opus-4-7      # Set specific model

# Model picker automatically fetches available models from:
# - Anthropic: /v1/models
# - OpenAI: /v1/models
# - OpenRouter: /v1/models
# - KiloCode: /v1/models
# - OpenCode: /zen/v1/models
# - DeepSeek: /v1/models
# - And others with /models endpoint

# For providers without /models endpoint (Cline, Copilot):
# Model picker shows manual input option
```

### Custom Base URLs

Use custom API endpoints (gateways, proxies, local servers):

```bash
export OPENAI_BASE_URL="http://localhost:8000/v1"     # Local OpenAI-compatible server
export ANTHROPIC_BASE_URL="https://api.example.com/v1" # Proxy endpoint
```

### Enterprise Deployments

```bash
# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_REGION=us-east-1

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=true
export ANTHROPIC_VERTEX_PROJECT_ID="your-gcp-project"

# Azure Foundry
export CLAUDE_CODE_USE_FOUNDRY=true
export ANTHROPIC_FOUNDRY_RESOURCE="your-resource"
```

---

## Plugin System

Extend Claude Code with custom commands, skills, and lifecycle hooks.

### Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   ├── plugin.json      # Manifest (name, version, skills, hooks)
│   ├── skills/          # Skill implementations
│   └── hooks/           # Hook handlers
├── marketplace.json     # Marketplace metadata
└── README.md
```

### Hook Points

- `PreToolUse` — Intercept before tool execution (can block or modify)
- `PostToolUse` — After tool execution (includes `duration_ms`)
- `PreBash` — Before Bash command
- `PostPrompt` — After user prompt
- `PreAcceptEdit` — Before accepting edit

### Built-in Plugins

| Plugin | Description |
|--------|-------------|
| `agent-sdk-dev` | Agent SDK development tools |
| `claude-opus-4-5-migration` | Migration assistant |
| `code-review` | Code review commands |
| `commit-commands` | Commit workflow commands |

---

## Security

| Feature | Implementation |
|---------|---------------|
| **Sandboxed execution** | Bash/PowerShell run in platform-specific sandboxes (Linux: PID namespace + seccomp-bpf, macOS: Seatbelt, Windows: Job objects) |
| **Multi-layer permissions** | Policy -> Project -> User -> Environment -> Code |
| **Encrypted credentials** | API keys stored in system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) |
| **Audit trail** | All actions logged in session transcript |
| **No secret logging** | API keys are redacted from all logs |
| **Network restrictions** | Configurable allowed/denied domains |
| **MCP OAuth** | Full OAuth 2.1 flow with PKCE |

---

## Project Structure

```
ClaudeCode/
├── src/
│   ├── main.tsx                    # Entry point & CLI bootstrap
│   ├── cli/                        # App.tsx, transports, handlers
│   ├── commands/                   # 100+ slash commands
│   │   ├── model/                  # /model
│   │   ├── provider-select/        # /provider
│   │   ├── buddy/                  # /buddy
│   │   ├── config/                 # /config
│   │   ├── mcp/                    # /mcp
│   │   ├── plugin/                 # /plugin
│   │   └── ...                     # 80+ more
│   ├── services/
│   │   ├── ai/                     # Multi-provider system
│   │   │   ├── providers/          # 7 provider implementations
│   │   │   ├── providerRegistry.ts # Provider registry singleton
│   │   │   ├── ProviderManager.ts  # Provider orchestration
│   │   │   ├── providerModels.ts   # Model discovery (5-min cache)
│   │   │   ├── errorNormalizer.ts  # Error normalization
│   │   │   ├── usageNormalizer.ts  # Token usage normalization
│   │   │   └── toolCallParser.ts   # Tool call parsing
│   │   ├── api/                    # API client (Anthropic SDK, Bedrock, Vertex)
│   │   ├── mcp/                    # MCP integration
│   │   ├── compact/                # Context compaction
│   │   ├── oauth/                  # OAuth 2.1 flows
│   │   ├── plugins/                # Plugin lifecycle
│   │   └── lsp/                    # Language Server Protocol
│   ├── tools/                      # 40+ built-in AI tools
│   ├── bridge/                     # Remote collaboration (31 files)
│   ├── buddy/                      # AI companion system
│   ├── components/                 # React/Ink UI components
│   ├── hooks/                      # React hooks & lifecycle hooks
│   ├── utils/                      # Utility functions
│   └── types/                      # TypeScript type definitions
├── plugins/                        # Built-in plugins
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md             # System architecture
│   ├── DEVELOPMENT.md              # Development guide
│   ├── COMMANDS.md                 # Command reference
│   ├── CONFIGURATION.md            # Configuration reference
│   └── API.md                      # API reference
├── examples/                       # Usage examples
├── scripts/                        # Build & utility scripts
├── package.json
├── tsconfig.json
├── CHANGELOG.md
└── CLAUDE.md                       # AI assistant project guide
```

---

## Development

### Setup

```bash
bun install              # Install dependencies
bun run build            # Production build -> dist/
bun run dev              # Dev mode with --watch
bun test                 # Run tests
bun x tsc --noEmit       # Type check
```

### Debugging

```bash
DEBUG=1 bun run src/main.tsx session                # Debug logging
bun run src/main.tsx session --verbose              # Verbose output
DEBUG=provider:anthropic bun run src/main.tsx session  # Module-specific
```

In-session diagnostics:

- `/status` — Show internal state
- `/doctor` — Run diagnostics
- `/doctor --fix` — Auto-fix issues
- `/context` — View context window usage

### Run from another directory

You can run the project's scripts from a different directory in several ways:

- Use Bun's `--cwd` to run a script with a specified working directory:

```powershell
bun run --cwd "D:\path\to\project" dev
```

- Change directory (PowerShell):

```powershell
Set-Location -Path 'D:\path\to\project'; bun run dev
# or temporarily:
Push-Location 'D:\path\to\project'; bun run dev; Pop-Location
```

- Run in the background (PowerShell):

```powershell
Start-Process -FilePath bun -ArgumentList 'run','dev' -WorkingDirectory 'D:\path\to\project' -NoNewWindow
```

- Use package manager prefixes:

```powershell
pnpm --prefix 'D:\path\to\project' run dev
npm --prefix 'D:\path\to\project' run dev
```

- POSIX shells:

```bash
cd /path/to/project && bun run dev
# or
bun run --cwd /path/to/project dev
```

Tips:

- Quote paths on PowerShell to avoid globbing and to handle spaces.
- Use the `--cwd` flag when you need an atomic single-command invocation.

### Contributing

Follow [conventional commits](https://www.conventionalcommits.org/):

```
feat(provider): add OpenRouter provider support
fix(command): handle null input in /model picker
docs(readme): update API key setup instructions
```

Scopes: `provider`, `command`, `tool`, `ui`, `permissions`, `mcp`, `plugin`, `bridge`, `session`, `config`

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun / Node.js |
| Language | TypeScript 5.x |
| UI | React 19 + Ink 6 |
| AI SDK | Vercel AI SDK |
| Validation | Zod 4 |
| CLI | Commander.js |
| Search | fuse.js |
| Diff | diff |
| Markdown | marked + highlight.js |
| WebSocket | ws |
| Telemetry | OpenTelemetry |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture & data flow |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development guide & conventions |
| [COMMANDS.md](docs/COMMANDS.md) | Complete command reference |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Configuration & settings reference |
| [API.md](docs/API.md) | API & provider reference |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [CLAUDE.md](CLAUDE.md) | AI assistant project guide |

---

## Legal & Compliance

**CRITICAL LEGAL NOTICE**

This project operates under extraordinary legal circumstances:

- **Source Origin**: Code derived from Anthropic's **accidental npm disclosure** (March 31, 2026)
- **Legal Status**: Proprietary code accidentally made public — copyright enforcement uncertain
- **Risk**: Anthropic may pursue legal action to enjoin distribution at any time
- **No Warranty**: Provided AS-IS with NO liability protection for users

**Before using, you MUST read:**

1. **[NOTICE.md](docs/NOTICE.md)** — 2-minute summary of legal risks
2. **[LEGAL.md](docs/LEGAL.md)** — Complete disclaimer, indemnification, and liability terms

**By using this software, you agree to indemnify the maintainers** and assume all risk of copyright infringement claims.

### Key Takeaways

- **Not affiliated with Anthropic** — Independent project
- **No commercial use recommended** — High legal risk
- **May shut down suddenly** — If Anthropic enforces copyrights
- **You are liable** — Not the maintainers
- **Good faith defense** — Based on Anthropic's self-distribution error

---

## License & Links

Copyright  Anthropic PBC. All rights reserved. See [LICENSE.md](LICENSE.md) for details.

> **Final Note on Freedom**: This project is a fork of Anthropic's Claude Code. By using this software, you accept the [Legal Disclaimer & Attribution](docs/LEGAL.md) which covers third-party components, licensing, warranties, and liability limitations.

- **GitHub**: [https://github.com/JonusNattapong/ClaudeCode](https://github.com/JonusNattapong/ClaudeCode)
- **Issues**: [https://github.com/JonusNattapong/ClaudeCode/issues](https://github.com/JonusNattapong/ClaudeCode/issues)
- **Releases**: [https://github.com/JonusNattapong/ClaudeCode/releases](https://github.com/JonusNattapong/ClaudeCode/releases)

---

## Research & Education Mission

This project is an **academic fork** of the proprietary Claude Code CLI, serving as a case study for the **[RESEARCH_MISSION.md](RESEARCH_MISSION.md)**. We are exploring the boundaries of how different LLMs (Large Language Models) can be orchestrated to perform complex software engineering tasks.

### Key Research Areas

- **Provider Interoperability**: How models like GPT-4o, Gemini 1.5 Pro, and Groq Llama-3 handle tool-use calls designed for Claude.
- **Architectural Analysis**: A deep-dive into high-performance TUI and Agentic logic.
- **Fair Use Study**: Exploring the legal and technical implications of accidentally disclosed source code in the modern AI era.
