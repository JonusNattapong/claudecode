# Claude Code

A powerful AI-powered coding assistant with multi-provider support.

## About

Claude Code is an AI coding assistant that supports multiple AI providers including Anthropic Claude, OpenAI GPT, Google Gemini, OpenRouter, KiloCode, and local Ollama. This fork provides unified routing, provider-specific adapters, and extensible architecture.

## Features

### Core Features
- **Multi-Provider Support** - Switch between Anthropic, OpenAI, Google Gemini, OpenRouter, KiloCode, Ollama
- **Provider-Specific Adapters** - Specialized adapters for Ollama (no API key), OpenRouter (custom headers), and other providers
- **SSE Streaming** - Full SSE streaming parser for OpenAI-compatible providers
- **Model Discovery** - Fetch models from provider APIs with 5-minute cache
- **Integrated Normalizers** - Tool call parsing, usage normalization, and error normalization

### CLI Features
- **Terminal Interface** - Fast terminal-based workflow with Ink/React
- **40+ Built-in Tools** - File operations, git integration, web search, MCP, LSP
- **Agent System** - Create and manage custom AI agents
- **Plugin System** - Extensible architecture with skills and plugins
- **Session Management** - Resume conversations, teleport, remote collaboration
- **Cost Tracking** - Monitor token usage and costs across providers

### Commands
- `/model` - Switch AI model
- `/provider` - Manage AI provider
- `/buddy` - Configure AI companion
- `/help`, `/config`, `/mcp`, `/skills`, `/plugin`, `/status`, `/doctor`

## Installation

```bash
# Clone repository
git clone https://github.com/JonusNattapong/ClaudeCode.git
cd ClaudeCode

# Install dependencies
bun install

# Build
bun run build
```

## Quick Start

```bash
# Run CLI
bun run src/main.tsx session

# Run in development mode (with file watching)
bun run dev
```

## Configuration

### Environment Variables

```bash
# Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI GPT
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="AIza..."

# OpenRouter
export OPENROUTER_API_KEY="sk-or-..."

# KiloCode
export KILOCODE_API_KEY="kilo-..."

# Ollama (local, no API key required)
# Ensure Ollama is running on http://localhost:11434
```

### Provider Selection

```bash
# Interactive (in session)
/provider

# CLI flags
--provider openai --model gpt-4o
--provider anthropic --model claude-sonnet-4-6
--provider google --model gemini-2.0-flash
```

## Feature Flags

Enable additional features:

```bash
# Enable features
KAIROS=1 BRIDGE_MODE=1 ULTRAPLAN=1 VOICE_MODE=1 bun run src/main.tsx session
```

| Feature | Command | Description |
|---------|---------|-------------|
| `KAIROS` | `/assistant`, `/brief` | AI assistant features |
| `BRIDGE_MODE` | `/bridge` | Bridge mode |
| `ULTRAPLAN` | `/ultraplan` | Ultra planning |
| `VOICE_MODE` | `/voice` | Voice mode |

## Project Structure

```
ClaudeCode/
├── src/
│   ├── main.tsx              # Entry point
│   ├── commands/            # CLI commands
│   │   ├── model/           # /model
│   │   ├── provider-select/ # /provider
│   │   ├── buddy/           # /buddy
│   │   ├── bridge/          # /bridge
│   │   ├── voice/          # /voice
│   │   └── ultraplan.tsx    # /ultraplan
│   ├── services/ai/         # AI provider system
│   │   ├── providers/      # Provider implementations
│   │   ├── providerRegistry.ts
│   │   └── providerModels.ts
│   ├── tools/              # AI tools
│   └── utils/              # Utilities
├── dist/                   # Build output
├── README.md
├── CHANGELOG.md
└── package.json
```

## Development

```bash
# Install
bun install

# Build
bun run build

# Run tests
bun test

# Type check
bun x tsc --noEmit
```

## License

Copyright © Anthropic PBC. All rights reserved.

## Links

- [GitHub](https://github.com/JonusNattapong/ClaudeCode)
- [Issues](https://github.com/JonusNattapong/ClaudeCode/issues)