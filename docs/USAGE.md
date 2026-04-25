# Claude Code CLI Usage Guide

Claude Code is a powerful AI coding assistant that runs in your terminal. This guide covers all the commands and features.

## Quick Start

```bash
# Run in development
bun run dev

# Or after building
bun run build
node dist/main.js

# Set your API key first (choose one)
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export OPENAI_API_KEY="sk-..."
# or
export GOOGLE_API_KEY="..."
```

## Configuration

### Setting API Keys

Claude Code supports multiple AI providers. Set the API key for your chosen provider:

```bash
# Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="..."

# OpenRouter
export OPENROUTER_API_KEY="..."

# KiloCode
export KILOCODE_API_KEY="..."

# Ollama (usually no key needed for local)
export OLLAMA_API_KEY=""
```

Or configure interactively:
```
/provider
```

### Selecting Provider and Model

#### Interactive Selection

```
/provider
```

This opens an interactive provider picker followed by model selection.

#### CLI Flags

```bash
# At startup
claude --provider openai --model gpt-4.1-mini
claude --provider anthropic --model claude-sonnet-4-20250514
claude --provider google --model gemini-2.5-flash
claude --provider ollama --model llama3.3
```

#### In-REPL Commands

```
/provider list                # List all providers and their status
/provider set <provider>      # Set active provider (prompts for model)
/provider set <provider> <model>  # Set provider and model
/provider key <provider> <key>    # Save API key for provider
/provider models <provider>   # List available models for provider
/provider reset               # Reset to default (openai/gpt-4.1-mini)
```

```
/model                        # Show current model
/model --list                 # List available models for current provider
/model <model-name>          # Switch to a different model
```

## Core Commands

### Chat / Prompt

Just type your question or request at the prompt. Claude Code has full context of your codebase.

```
.p            # Send message to AI (explicit command)
```

### File Operations

```
/files              # List files in current directory
/r <file>          # Read a file
/w <file>          # Write content to file
/edit <file>       # Open file in editor
/glob <pattern>    # Search files by pattern
```

### Git Integration

```
/git diff           # Show git diff
/git status         # Show git status
/git log            # Show commit history
/git branch         # List branches
/commit             # Create a commit with AI-generated message
/commit-push-pr     # Commit, push, and open a PR in one step
```

### Search & Edit

```
/grep <pattern>     # Search file contents
/replace <old> <new> # Replace text in files
```

### Tool Usage

Claude Code can use tools automatically. Some tools require approval:

- `Bash` — Execute shell commands
- `Glob` — Find files
- `Grep` — Search file contents
- `Read` — Read file contents
- `Write` — Write to files
- `Edit` — Edit files
- `MultiEdit` — Edit multiple files
- `Git` — Git operations
- `WebSearch` — Search the web
- `WebFetch` — Fetch URLs
- `Task` — Create sub-agents for parallel work

Configure permissions with `/permissions`.

### Session Management

```
/session save <name>      # Save current session
/session list             # List saved sessions
/session load <name>      # Load a session
/session delete <name>    # Delete a session
/clear                    # Clear conversation
```

### Context Management

Add files/directories to context:

```
/add <path>              # Add file/directory to context
/context                 # Show current context
/context clear           # Clear all context
```

### Cost & Usage

```
/cost                    # Show current session cost
/cost --reset            # Reset cost counter
/cost --json             # Output as JSON
```

## Settings

```
/settings                # Open settings dialog (TUI)
/config                  # Show current config
/effort                  # Set thinking effort (low/medium/high)
/model                   # Change model
/permissions             # Manage tool permissions
```

Key settings:
- `maxTokens` — Maximum response tokens
- `temperature` — Creativity (0-1)
- `effort` — Thinking effort (low/medium/high)
- `autoAcceptTools` — Auto-approve safe tools

## Advanced Features

### Task / Sub-agent Mode

Break complex work into parallel tasks:

```
/task build authentication system
/task refactor payment module
```

### Agent System

Create custom agents with specialized knowledge:

```
/agent create <name> --prompt "You are a..."
/agent list
/agent use <name>
/agent delete <name>
```

### MCP Servers

Connect external data sources and tools:

```
/mcp list          # List available MCP servers
/mcp add <url>     # Add MCP server
/mcp enable        # Enable all project MCP servers
/mcp disable       # Disable MCP
/mcp status        # Show MCP status
```

### Teleport / Remote Sessions

Collaborate with teammates:

```
/teleport invite <email>   # Invite user
/teleport join <session>   # Join remote session
/teleport status           # Show remote status
```

### Plugin Management

```
/plugin list                      # List installed plugins
/plugin install <name>            # Install from marketplace
/plugin uninstall <name>          # Remove plugin
/plugin marketplace               # Browse available plugins
/plugin settings                  # Plugin configuration
```

Bundled plugins are in `plugins/` directory and registered via `.claude-plugin/marketplace.json`.

### Custom Commands

Project-specific commands can be added in `.claude/commands/`:

- `commit-push-pr` — Commit, push, and open PR
- `dedupe` — Find duplicate GitHub issues
- `triage-issue` — Triage GitHub issues with labels

## Keyboard Shortcuts

- `Ctrl+C` — Exit/abort
- `Ctrl+R` — Reverse search history
- `↑/↓` — Navigate history
- `Tab` — Autocomplete commands
- `Ctrl+L` — Clear screen

## Troubleshooting

### "Provider not configured"

Use `/provider` to select a provider and ensure the corresponding API key is set (e.g., `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

### "Model not available"

Run `/model --list` to see available models for the current provider. Some models require access or are provider-specific.

### Tool failures

Check `/permissions` to ensure tools are allowed.

### High latency

Enable streaming mode in settings (`/settings`) for faster perceived response.

### Rate limits

Check your provider quota. Use `/provider` to switch to a different provider if needed.

### OAuth login issues

Ensure you're using a supported browser. Run `/auth logout` and try again. Check `CLAUDE_CODE_OAUTH_SCOPES` if using env var flow.

## Getting Help

```
/help               # Show general help
/help <command>     # Show command-specific help
/docs               # Open documentation
```

Or visit:
- GitHub Issues: https://github.com/JonusNattapong/ClaudeCode/issues
- Documentation: https://docs.claude.ai/claude-code
