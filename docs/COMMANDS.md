# Commands Reference

## Overview

Claude Code provides a comprehensive set of slash commands (`/command`) for controlling the assistant, managing sessions, configuring settings, and accessing tools.

Commands are invoked by typing `/` followed by the command name in the prompt input.

## Command Categories

### 🏠 **Session & Model Commands**

Manage conversation sessions and AI models.

| Command | Description |
|---------|-------------|
| `/model` | Switch AI model (opens model picker) |
| `/provider` | Manage AI provider (list, set, configure keys) |
| `/resume` | Resume a previous session |
| `/continue` | Continue the most recent session |
| `/new` | Start a fresh conversation |
| `/exit` | Exit the current session |
| `/rename` | Rename the current session |
| `/fork` | Fork current conversation into a new session |
| `/save` | Save current session with custom name |

### ⚙️ **Configuration Commands**

Configure Claude Code behavior.

| Command | Description |
|---------|-------------|
| `/config` | Open settings editor |
| `/theme` | Change color theme |
| `/color` | Change session accent color |
| `/help` | Show help & keybindings |
| `/status` | Show system status |
| `/doctor` | Run diagnostics & fix issues |
| `/compact` | Manually trigger context compaction |
| `/effort` | Adjust thinking effort level |
| `/buddy` | Configure AI companion (Buddy) |

### 🔧 **Tool Commands**

Access built-in tools and integrations.

| Command | Description |
|---------|-------------|
| `/cost` | Show token usage & cost (alias: `/usage`) |
| `/context` | Show context window usage |
| `/diff` | View git diff of current changes |
| `/commit` | Create a git commit |
| `/commit-push-pr` | Commit, push, and create PR |
| `/branch` | Create a new git branch with session |
| `/files` | Browse project files |
| `/add-dir` | Add directory to session context |

### 🤖 **Agent Commands**

Control AI agents and sub-agents.

| Command | Description |
|---------|-------------|
| `/agents` | Manage AI agents |
| `/agent` | Spawn a sub-agent for a task |
| `/advisor` | Request AI advice on current task |
| `/ultraplan` | Ultra-deep planning mode |
| `/ultrareview` | Comprehensive code review |

### 📦 **Plugin & Skill Commands**

Extend functionality with plugins.

| Command | Description |
|---------|-------------|
| `/plugin` | Plugin marketplace & management |
| `/plugins` | (alias) Plugin management |
| `/skills` | Skills management |
| `/skill` | (alias) Skills management |
| `/reload-plugins` | Reload all plugins |
| `/update` | Check for & apply updates |

### 🔗 **Bridge & Remote Commands**

Remote collaboration features.

| Command | Description |
|---------|-------------|
| `/bridge` | Enter bridge mode (remote collaboration) |
| `/remote-control` | Enable remote control from web |
| `/team-onboarding` | Generate team onboarding guide |

### 🌐 **MCP Commands**

Model Context Protocol server integration.

| Command | Description |
|---------|-------------|
| `/mcp` | MCP server management |
| `/mcp-serve` | Start an MCP server |

### 📊 **Monitoring & Debugging**

System monitoring and diagnostics.

| Command | Description |
|---------|-------------|
| `/insights` | Session insights & analytics |
| `/feedback` | Send feedback to Anthropic |
| `/btw` | Report bugs or issues |
| `/heapdump` | Generate heap dump (debug) |
| `/extra-usage` | Extended usage statistics |

### 🎯 **Feature-Gated Commands**

These commands require environment variables to enable.

| Command | Feature Flag | Description |
|---------|--------------|-------------|
| `/assistant` | `KAIROS` | AI assistant features |
| `/brief` | `KAIROS` | Brief mode |
| `/voice` | `VOICE_MODE` | Voice dictation mode |
| `/loop` | `ULTRAPLAN` | Continuous operation loop |

## Command Syntax

### Basic Usage

```
/command-name [arguments] [options]
```

Example:
```
/model claude-sonnet-4
/provider set openai gpt-4o
```

### Command Arguments

Commands may accept positional or named arguments.

```
/provider set <provider-name> [model-name]
/effort [level]
/model [model-name]
```

### Command Options

Some commands support flags:

```
--verbose          # Enable verbose output
--from-pr <url>    # Start from pull request
--agent <name>     # Use specific agent
--print            # Non-interactive output
```

## Detailed Command Reference

### `/model`

Switch the AI model used for the conversation.

**Usage:**
```
/model                       # Open model picker (interactive)
/model <model-name>          # Switch to specific model
/model --list                # List available models
```

**Examples:**
```
/model claude-sonnet-4
/model gpt-4o
/model gemini-2.0-flash
```

**Provider-specific behavior:**
- When using Anthropic: shows Claude models
- When using OpenAI: shows GPT models
- When using OpenRouter: fetches available models from API

---

### `/provider`

Manage AI provider configuration.

**Usage:**
```
/provider list                           # List all providers with models
/provider get                            # Show current provider & model
/provider set <provider> [model]         # Switch provider, optionally set model
/provider models <provider>              # Fetch models from provider API
/provider key <provider> <api-key>       # Save API key for provider
/provider reset                          # Reset to default (OpenAI)
/provider clear-keys                     # Clear all saved API keys
```

**Examples:**
```
/provider set anthropic claude-sonnet-4
/provider key anthropic sk-ant-...
/provider list
```

---

### `/resume`

Resume a previously saved session.

**Usage:**
```
/resume                     # Open session picker
/resume <session-id>        # Resume specific session by ID
/resume <search-term>       # Search sessions by name/description
```

**Filters:**
- Press `Ctrl+A` to show all projects
- Type to filter by session name, project, or branch
- Shows session age, message count, context size

**Examples:**
```
/resume my-feature-branch
/resume 5f3e8a9b
```

---

### `/continue`

Continue the most recent session.

**Usage:**
```
/continue
/continue --print      # Non-interactive continuation
```

Equivalent to `/resume` with the latest session pre-selected.

---

### `/config`

Open the interactive settings editor.

**Usage:**
```
/config                        # Open config editor
/config <setting-name>         # Jump to specific setting
/config --export               # Export current config to JSON
/config --reset                # Reset to defaults
```

**Settings categories:**
- **Appearance** — Theme, colors, rendering
- **Editor** — Vim mode, keybindings, auto-indent
- **Behavior** — Auto-compact, auto-run, permissions mode
- **Tools** — Tool-specific settings (Bash, Git, etc.)
- **Telemetry** — Usage reporting
- **Advanced** — Debug flags, experimental features

**Example:**
```
/config  # Navigate to "Editor mode" and change to "vim"
```

---

### `/theme`

Change the color theme.

**Usage:**
```
/theme                    # List available themes
/theme <name>             # Switch to theme
/theme auto               # Match terminal dark/light mode
/theme random             # Random theme
/theme custom <path>      # Load custom theme JSON
```

**Built-in themes:**
- `default` — Default dark theme
- `light` — Light theme
- `oblivion` — High-contrast dark
- `matrix` — Green on black
- `ocean` — Blue-tinted dark

---

### `/color`

Change session accent color.

**Usage:**
```
/color                    # Color picker
/color <color-name>       # Set specific color
/color random             # Random color
```

**Available colors:**
`red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`, plus bright variants.

---

### `/cost` / `/usage`

Show token usage and cost statistics.

**Usage:**
```
/cost                     # Show current session usage
/cost --all               # Show all sessions
/cost --reset             # Reset counter
/usage                    # Alias for /cost
```

**Output:**
- Input tokens
- Output tokens
- Total cost (USD)
- Cached tokens (if applicable)
- Model breakdown

---

### `/context`

Display context window usage.

**Usage:**
```
/context                  # Show context percentage
/context --compact        # Show after last compaction
/context --verbose        # Detailed token breakdown
```

Shows:
- **Total tokens** vs context limit
- Messages count
- Tool results size
- Approximated tokens (if exact count unavailable)
- Compaction history

---

### `/effort`

Adjust thinking effort level.

**Usage:**
```
/effort                         # Interactive slider
/effort auto                    # Auto (let Claude decide)
/effort low                     # Minimal thinking
/effort medium                  # Balanced (default)
/effort high                    # Deep thinking
/effort max                     # Maximum thinking
/effort xhigh                   # Extra high (Opus 4.7+ only)
```

**Note:** Effort levels may not be supported by all models. Unsupported models fall back to `high`.

---

### `/buddy`

Configure your AI companion (Buddy).

**Usage:**
```
/buddy                        # Open buddy config UI
/buddy --disable              # Disable buddy
/buddy --enable               # Enable buddy
/buddy reset                  # Reset to default
```

**Buddy features:**
- Custom greeting messages
- Personality customization
- Quick actions
- Status indicators

---

### `/help`

Display help information and keybindings.

**Usage:**
```
/help                       # Show help
/help <command-name>        # Show help for specific command
/help keybindings           # Show all keybindings
```

---

### `/status`

Show system status.

**Usage:**
```
/status                     # Show full status
/status --json              # Machine-readable output
/status --minimal           # One-line summary
```

Displays:
- Current provider & model
- Session ID
- Context usage
- Connected MCP servers
- Plugin status
- Permission mode

---

### `/doctor`

Run diagnostics and auto-fix issues.

**Usage:**
```
/doctor                     # Run full diagnostics
/doctor --fix               # Auto-fix detected issues
/doctor --json              # JSON output
```

Checks:
- API key validity
- Configuration syntax
- Plugin health
- MCP server connectivity
- Permission conflicts
- Disk space

---

### `/diff`

Show git diff of current changes.

**Usage:**
```
/diff                       # Show unstaged changes
/diff --cached              # Show staged changes
/diff <file>                # Show diff for specific file
/diff --stat                # Show statistics only
/diff --unified=3           # Context lines
```

---

### `/commit`

Create a git commit.

**Usage:**
```
/commit                     # Launch commit wizard
/commit --all               # Include all changes (git commit -a)
/commit --amend             # Amend last commit
/commit --no-edit           # Keep existing message
/commit --empty             # Allow empty commit
```

Interactive workflow:
1. Reviews changed files
2. Generates commit message
3. Allows editing
4. Creates commit

---

### `/commit-push-pr`

Commit, push, and create a pull request in one flow.

**Usage:**
```
/commit-push-pr             # Start wizard
/commit-push-pr --draft     # Create draft PR
/commit-push-pr --base main # Specify base branch
```

---

### `/branch`

Create a new git branch and associate session.

**Usage:**
```
/branch <branch-name>       # Create and switch branch
/branch -D <branch>         # Delete branch
/branch -m <new-name>       # Rename branch
```

---

### `/files`

Browse project files.

**Usage:**
```
/files                      # Open file browser
/files <path>               # Start at specific directory
/files --search <pattern>   # Search files
```

**Navigation:**
- `↑/↓` — Navigate
- `Enter` — Open file
- `Ctrl+F` — Search
- `Esc` — Close

---

### `/add-dir`

Add a directory to the session context.

**Usage:**
```
/add-dir <path>             # Add directory
/add-dir --remember         # Persist to project settings
/add-dir --remove <path>    # Remove directory
/add-dir --list             # List all added directories
```

---

### `/agents`

Manage AI agents.

**Usage:**
```
/agents                     # List running agents
/agents --library           # Show agent library
/agents --running           # Show active agents only
/agent <name>               # Spawn agent for task
/agent stop <id>            # Stop specific agent
```

---

### `/plugin`

Plugin marketplace and management.

**Usage:**
```
/plugin                               # Open plugin UI
/plugin install <name>                # Install plugin
/plugin update <name>                 # Update plugin
/plugin uninstall <name>              # Remove plugin
/plugin list                          # List installed
/plugin marketplace                   # Browse marketplace
/plugin search <query>                # Search plugins
/plugin disable <name>                # Disable plugin
/plugin enable <name>                 # Enable plugin
/plugin create <name>                 # Create new plugin
/plugin tag <version>                 # Create release tag
/plugin doctor                        # Diagnose plugin issues
```

---

### `/skills`

Manage skills (specialized commands).

**Usage:**
```
/skills                    # List all skills
/skills --enabled          # Show enabled only
/skills --disabled         # Show disabled
/skills <name>             # Invoke skill directly
```

---

### `/mcp`

Manage Model Context Protocol servers.

**Usage:**
```
/mcp                       # Open MCP management UI
/mcp list                  # List configured servers
/mcp add <name> <command>  # Add stdio server
/mcp add-http <name> <url> # Add HTTP/SSE server
/mcp remove <name>         # Remove server
/mcp enable <name>         # Enable disabled server
/mcp disable <name>        # Disable server
/mcp status                # Show connection status
/mcp auth <name>           # Run OAuth flow
/mcp test <name>           # Test connection
/mcp reauth <name>         # Re-authenticate
```

---

### `/reload-plugins`

Reload all plugins without restarting.

**Usage:**
```
/reload-plugins            # Reload all plugins
/reload-plugins <name>     # Reload specific plugin
/reload-plugins --force    # Force reload even if unchanged
```

---

### `/update`

Check for and apply updates.

**Usage:**
```
/update                    # Check and update
/update --check            # Just check, don't install
/update --channel stable   # Stable channel
/update --channel nightly  # Nightly builds
```

---

### `/compact`

Manually trigger context compaction.

**Usage:**
```
/compact                   # Compact immediately
/compact --dry-run         # Show what would be compacted
/compact --threshold 0.8  # Custom threshold
```

---

### `/clear`

Clear conversation or caches.

**Usage:**
```
/clear message             # Clear current message input
/clear context             # Clear context (start fresh)
/clear conversation        # Clear entire conversation
/clear cache               # Clear caches
/clear all                 # Full reset
```

---

### `/feedback`

Send feedback to Anthropic.

**Usage:**
```
/feedback                  # Open feedback form
/feedback --bug            # Report bug
/feedback --feature        # Request feature
/feedback --rating <1-5>   # Rate experience
```

---

### `/btw`

Report issues or bugs.

**Usage:**
```
/btw <description>         # Report issue
/btw --include-log         # Attach log
/btw --anonymous           # Anonymous report
```

---

### `/insights`

Get session insights and analytics.

**Usage:**
```
/insights                  # Show insights
/insights --export <path>  # Export report
/insights --json           # JSON format
```

---

### `/undo` / `/rewind`

Undo the last assistant message.

**Usage:**
```
/undo                     # Remove last assistant response
/rewind                   # Alias
/undo <n>                 # Undo N messages
/rewind --to <message-id> # Rewind to specific message
```

---

### `/export`

Export session to file.

**Usage:**
```
/export                    # Open export dialog
/export --format markdown  # Export as Markdown
/export --format json      # Export as JSON
/export --format txt       # Plain text
/export --include-cost     # Include cost data
/export <path>             # Export to specific location
```

---

### `/copy`

Copy content to clipboard.

**Usage:**
```
/copy                      # Copy last response
/copy <range>              # Copy specific message(s)
/copy --all                # Copy entire conversation
/copy --code               # Copy code blocks only
```

---

### `/paste`

Paste from clipboard.

**Usage:**
```
/paste                     # Paste clipboard content
/paste --file              # Paste as file attachment
```

---

### `/web-search`

Search the web (if tool available).

**Usage:**
```
/web-search <query>        # Search web
/web-search --num 5        # Number of results
/web-search --site <url>   # Search specific site
```

---

### `/task`

Create a sub-agent task.

**Usage:**
```
/task <description>        # Create background task
/task --agent <name>       # Use specific agent
/task --wait               # Wait for completion
/task --background         # Run in background
```

---

### `/loop`

Enable continuous operation loop.

**Usage:**
```
/loop                      # Start loop mode
/loop --interval <seconds> # Custom interval
/loop stop                 # Stop looping
/loop status               # Show loop status
```

---

### `/voice`

Enter voice dictation mode.

**Usage:**
```
/voice                     # Start voice input
/voice --push-to-talk      # Push-to-talk mode
/voice --continuous        # Continuous listening
/voice --language <code>   # Set language (en, th, …)
```

Requires `VOICE_MODE=1` environment flag.

---

### `/bridge`

Enter Bridge Mode for remote collaboration.

**Usage:**
```
/bridge                    # Start bridge session
/bridge --share            # Share session URL
/bridge --remote           # Connect to remote session
/bridge --control          # Enable remote control
```

Requires `BRIDGE_MODE=1` environment flag.

---

### `/ultraplan`

Enable ultra-deep planning mode.

**Usage:**
```
/ultraplan                 # Start ultraplan
/ultraplan --depth <n>     # Planning depth (1-5)
/ultraplan --width <n>     # Parallel branches
```

Requires `ULTRAPLAN=1` environment flag.

---

### `/ultrareview`

Run comprehensive code review.

**Usage:**
```
/ultrareview               # Review current branch
/ultrareview <PR#>         # Review specific PR
/ultrareview --all-files   # Review all files
/ultrareview --focus <area> # Focus on specific area
```

---

## Command Aliases

Many commands have shorter aliases:

| Command | Aliases |
|---------|---------|
| `/continue` | `/c`, `--continue` |
| `/resume` | `/r` |
| `/config` | `/cfg`, `/settings` |
| `/cost` | `/usage`, `/tokens` |
| `/plugin` | `/plugins` |
| `/skill` | `/skills` |
| `/undo` | `/rewind`, `/u` |
| `/help` | `/h`, `--help` |
| `/exit` | `/quit`, `/q` |
| `/branch` | `/b` |
| `/diff` | `/d` |
| `/status` | `/st` |
| `/agents` | `/agent` |

## Command Availability

Some commands are **feature-gated**:

| Command | Required Flag | Default |
|---------|---------------|---------|
| `/assistant` | `KAIROS=1` | Disabled |
| `/brief` | `KAIROS=1` | Disabled |
| `/voice` | `VOICE_MODE=1` | Disabled |
| `/bridge` | `BRIDGE_MODE=1` | Disabled |
| `/ultraplan` | `ULTRAPLAN=1` | Disabled |

Enable via environment:
```bash
KAIROS=1 BRIDGE_MODE=1 bun run src/main.tsx session
```

## Command History

Access recent commands with:

- `↑`/`↓` — Navigate command history
- `Ctrl+R` — Reverse search through history
- History is stored per-project in `~/.claude/command-history`

## Custom Commands (Plugins)

Plugins can register custom slash commands. Installed plugin commands appear in the command palette alongside built-in commands.

Use `/plugin` to manage plugin-provided commands.

## Non-Interactive Mode

Commands can be invoked from the command line without entering a session:

```bash
# Non-interactive model switching
bun run src/main.tsx --model claude-sonnet-4 --print "Explain this code"

# Continue session and print output
bun run src/main.tsx --continue --print "Summarize"

# Run specific command
bun run src/main.tsx --command "/cost --all"
```

## Command Output Formats

Some commands support output formatting:

| Command | Formats |
|---------|---------|
| `/cost` | `table` (default), `json`, `csv` |
| `/status` | `normal`, `json`, `minimal` |
| `/context` | `normal`, `verbose`, `json` |
| `/export` | `markdown`, `json`, `txt`, `html` |

Set format with `--format` or via settings.

## Permissions & Command Execution

Commands may require permissions based on:
- **Filesystem access** (`/add-dir`, `/files`)
- **Git operations** (`/commit`, `/branch`)
- **Network calls** (`/web-search`, `/mcp`)
- **Subprocess spawning** (`/bash` within commands)

Permission prompts appear when:
- Command accesses restricted resources
- Running in `ask-first` mode
- Tool use requires user approval

## Keyboard Shortcuts for Commands

Shortcuts for common commands:

| Shortcut | Command |
|----------|---------|
| `Ctrl+R` | `/resume` |
| `Ctrl+P` | Command palette (any /command) |
| `Ctrl+O` | Toggle focus mode |
| `Ctrl+L` | Clear screen |
| `Esc` | Cancel current operation |
| `Ctrl+C` | Interrupt (SIGINT) |

Command palette (`Ctrl+P`):
- Type to fuzzy-search commands
- `Enter` to execute
- `Tab` to see command arguments
- `↑/↓` to navigate

## Troubleshooting

### Command Not Found

If a command is unavailable:
1. Check if it's feature-gated (requires env var)
2. Verify plugin is loaded (`/plugin list`)
3. Check permissions (some commands restricted)
4. Run `/doctor` for diagnostics

### Command Errors

If a command fails:
1. Check session logs (`~/.claude/sessions/`)
2. Run `/status` for system health
3. Check API keys (`/provider key`)
4. Try `/doctor --fix`

### Command Hangs

- `Ctrl+C` to interrupt
- Check network connectivity
- Disable slow plugins
- Reduce context size

## See Also

- [Configuration](CONFIGURATION.md) — Settings for command behavior
- [Permissions](PERMISSIONS.md) — Security model
- [Plugins](PLUGINS.md) — Extending with custom commands
- [Skills](SKILLS.md) — Skill system for automation
