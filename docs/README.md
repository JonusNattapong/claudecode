# Claude Code Documentation

Official documentation for Claude Code — the AI-powered coding assistant CLI from Anthropic.

## 📚 Documentation Index

### Getting Started
- **[README](../README.md)** - Quick start guide, features, installation, and basic usage
- **[Configuration](CONFIGURATION.md)** - Complete configuration reference including settings, permissions, and environment variables
- **[Installation](INSTALLATION.md)** - Detailed installation instructions for all platforms

### Development & Contribution
- **[Architecture](ARCHITECTURE.md)** - System design, component overview, and technical architecture
- **[Development Guide](DEVELOPMENT.md)** - Setting up a development environment, building, testing, and contributing
- **[Plugin Development](PLUGINS.md)** - Creating, publishing, and managing plugins and skills
- **[API Reference](API_REFERENCE.md)** - Internal APIs, interfaces, and extension points

### Usage & Features
- **[Commands Reference](COMMANDS.md)** - Complete list of slash commands and their usage
- **[Provider System](PROVIDERS.md)** - Multi-provider AI setup (Anthropic, OpenAI, Google, OpenRouter, Ollama)
- **[Permissions System](PERMISSIONS.md)** - Security model, permission rules, and sandboxing
- **[MCP Integration](MCP.md)** - Model Context Protocol server integration
- **[Bridge Mode](BRIDGE_MODE.md)** - Remote collaboration and session sharing
- **[Agents System](AGENTS.md)** - Creating and managing AI agents
- **[Skills System](SKILLS.md)** - Skills (built-in commands) architecture and creation

### Troubleshooting & Support
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues, debugging, and solutions
- **[Changelog](../CHANGELOG.md)** - Version history and release notes

## 🚀 Quick Overview

Claude Code is a terminal-based AI coding assistant that helps you write, review, and debug code directly from your command line.

### Key Features
- **40+ Built-in Tools** — File operations, Git integration, web search, LSP, MCP
- **Multi-Provider Support** — Anthropic Claude, OpenAI GPT, Google Gemini, OpenRouter, Ollama
- **Session Management** — Resume, rename, branch worktrees, remote collaboration
- **Plugin Architecture** — Extensible via plugins with custom skills and tools
- **Agent System** — Create specialized AI agents for specific tasks
- **Full SSE Streaming** — Real-time streaming responses
- **Model Discovery** — Automatic model fetching from provider APIs
- **Security-First** — Granular permissions, sandboxing, and safety controls

## 💻 Installation

```bash
# Using Bun (recommended)
bun install
bun run build
bun run src/main.tsx session

# Or in development mode
bun run dev
```

## 🔑 Configuration

Set up your API key:

```bash
# Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI GPT
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="AIza..."

# OpenRouter
export OPENROUTER_API_KEY="sk-or-..."
```

## 📖 License

Copyright © Anthropic PBC. All rights reserved.

See [LICENSE.md](../LICENSE.md) for details.
