# Configuration

## Configuration Files

Claude Code loads configuration from multiple sources, with precedence order:

```
Built-in defaults
    ↓
Environment variables (CLAUDE_CODE_*)
    ↓
Managed settings (enterprise policy)
    ↓
Project settings (.claude/settings.json)
    ↓
User settings (~/.claude/settings.json) ← Highest precedence
```

## Settings Files

### User Settings

**Location:** `~/.claude/settings.json`

Global configuration for your user account.

**Example:**
```json
{
  "theme": "default",
  "editorMode": "vim",
  "permissionMode": "ask-first",
  "enableTelemetry": true,
  "autoCompact": true,
  "maxContextTokens": 200000,
  "verbose": false,
  "accentColor": "cyan"
}
```

### Project Settings

**Location:** `<project>/.claude/settings.json`

Project-specific overrides. Version-control these to share with team.

**Example:**
```json
{
  "project": {
    "name": "MyProject"
  },
  "permissions": {
    "additionalDirectories": ["../shared"],
    "allowedDomains": ["api.example.com"]
  },
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  }
}
```

### Managed Settings

Enterprise-managed configuration via organization policy. Overrides user settings.

Set `CLAUDE_CONFIG_DIR` to custom config directory:
```bash
export CLAUDE_CONFIG_DIR="/path/to/config"
```

## Configuration Schema

### Appearance

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | `string` | `"default"` | Color theme name |
| `accentColor` | `string` | `"cyan"` | Accent color for UI |
| `showIcons` | `boolean` | `true` | Show icons in UI |
| `animate` | `boolean` | `true` | Enable animations |
| `minimalMode` | `boolean` | `false` | Minimal UI chrome |

### Editor

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `editorMode` | `"vim" \| "emacs" \| "default"` | `"default"` | Keybinding mode |
| `autoIndent` | `boolean` | `true` | Auto-indent new lines |
| `pasteMultiLine` | `boolean` | `true` | Preserve line breaks on paste |
| `cursorBlink` | `boolean` | `true` | Blinking cursor |
| `vimUseHybrid` | `boolean` | `false` | Vim hybrid mode (normal+insert) |

### Behavior

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `permissionMode` | `"auto" \| "ask-first" \| "bypass-permissions"` | `"ask-first"` | Permission prompt behavior |
| `autoCompact` | `boolean` | `true` | Auto-compact when context near limit |
| `autoRun` | `boolean` | `false` | Auto-approve safe commands |
| `confirmExit` | `boolean` | `true` | Confirm before exiting |
| `enableRecap` | `boolean` | `true` | Show recap when returning to session |
| `maxContextTokens` | `number` | `200000` | Context window limit |

### Tools

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `bash` | `object` | `{}` | Bash-specific options |
| `bash.sandbox` | `boolean` | `true` | Enable sandboxing |
| `bash.timeout` | `number` | `30000` | Default timeout (ms) |
| `git` | `object` | `{}` | Git integration |
| `git.enabled` | `boolean` | `true` | Enable Git tools |
| `webFetch` | `object` | `{}` | WebFetch options |
| `webFetch.timeout` | `number` | `30000` | Timeout (ms) |

### Telemetry

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableTelemetry` | `boolean` | `true` | Send usage telemetry |
| `disableNonessentialTraffic` | `boolean` | `false` | Block non-API calls |
| `sendPrompts` | `boolean` | `false` | Send prompts (opt-in) |

**Note:** Telemetry is automatically disabled for:
- `DISABLE_TELEMETRY=1` environment variable
- Bedrock, Vertex, Foundry providers
- Enterprise deployments with `DISABLE_TELEMETRY`

### AI Provider

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `provider` | `"anthropic" \| "openai" \| "google" \| ...` | `"openai"` | Default provider |
| `model` | `string` | `"gpt-4o"` | Default model ID |
| `maxSteps` | `number` | `10` | Max agentic steps |
| `maxThinking` | `number` | `200000` | Max thinking tokens |
| `temperature` | `number` | `1.0` | Sampling temperature |
| `topP` | `number` | `1.0` | Top-p sampling |

### Advanced

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `debug` | `boolean` | `false` | Enable debug logging |
| `logLevel` | `"error" \| "warn" \| "info" \| "debug"` | `"info"` | Log verbosity |
| `pluginDir` | `string` | `"~/.claude/plugins"` | Plugin directory |
| `sessionDir` | `string` | `"~/.claude/sessions"` | Session storage |
| `cacheDir` | `string` | `"~/.claude/cache"` | Cache directory |
| `disableAutoUpdate` | `boolean` | `false` | Disable auto-update |
| `disablePromptCaching` | `boolean` | `false` | Disable prompt caching |
| `enableExperimental` | `boolean` | `false` | Enable experimental features |

## Environment Variables

### Provider API Keys

| Variable | Provider | Required | Example |
|----------|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic | Yes (if using Anthropic) | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI | Yes (if using OpenAI) | `sk-...` |
| `GOOGLE_API_KEY` | Google | Yes (if using Google) | `AIza...` |
| `OPENROUTER_API_KEY` | OpenRouter | Yes (if using OpenRouter) | `sk-or-...` |
| `KILOCODE_API_KEY` | KiloCode | Yes (if using KiloCode) | `kilo-...` |

### Base URLs (Custom Endpoints)

Override API endpoints (for gateways, proxies):

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_BASE_URL` | Anthropic API base URL | `https://api.example.com/v1` |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL | `http://localhost:8000/v1` |
| `GOOGLE_BASE_URL` | Google AI base URL | `https://us-east1-aiplatform.googleapis.com` |

### Platform-Specific

| Variable | Platform | Description |
|----------|----------|-------------|
| `AWS_PROFILE` | AWS | AWS credential profile |
| `AWS_REGION` | AWS | AWS region (default: us-east-1) |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP | Path to service account JSON |
| `VERTEX_PROJECT` | GCP Vertex | GCP project ID |
| `VERTEX_LOCATION` | GCP Vertex | GCP region |

### Feature Flags

Enable/disable optional features:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `BRIDGE_MODE` | `0\|1` | `0` | Enable bridge (remote collaboration) |
| `VOICE_MODE` | `0\|1` | `0` | Enable voice dictation |
| `ULTRAPLAN` | `0\|1` | `0` | Enable ultraplan mode |
| `KAIROS` | `0\|1` | `0` | Enable assistant/brief features |
| `DISABLE_TELEMETRY` | `0\|1` | `0` | Disable all telemetry |
| `DISABLE_AUTOUPDATER` | `0\|1` | `0` | Disable auto-update checks |
| `DISABLE_PROMPT_CACHING` | `0\|1` | `0` | Disable prompt caching |
| `ENABLE_PROMPT_CACHING_1H` | `0\|1` | `0` | Enable 1-hour cache TTL |
| `DISABLE_COMPACT` | `0\|1` | `0` | Disable auto-compaction |
| `CLAUDE_CODE_LOCAL` | `0\|1` | `0` | Force local-only mode |

### Performance & Debugging

| Variable | Default | Description |
|----------|---------|-------------|
| `API_TIMEOUT_MS` | `120000` | API request timeout |
| `MAX_RETRIES` | `3` | Max retry attempts |
| `DEBUG` | (unset) | Enable debug logging (any value) |
| `DEBUG_COLORS` | `1` | Colored debug output |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (unset) | OpenTelemetry endpoint |
| `OTEL_LOG_RAW_API_BODIES` | `0` | Log full API requests/responses |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | `0` | Scrub env vars in subprocesses |

### Security & Sandbox

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | `0` | Scrub environment in subprocess sandbox |
| `CLAUDE_CODE_SCRIPT_CAPS` | (unset) | Limit script capabilities (Linux) |
| `NO_PROXY` | (unset) | Bypass proxy for domains |
| `CLAUDE_CODE_CERT_STORE` | `system` | CA cert store (`system` or `bundled`) |

File:
- `CLAUDE_ENV_FILE` — Path to env file to load (e.g., `~/.zprofile`)

### UI & Display

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CODE_HIDE_CWD` | `0` | Hide CWD in startup banner |
| `NO_COLOR` | (unset) | Disable colors |
| `FORCE_COLOR` | `0` | Force color output (1-3) |
| `TERM` | (auto) | Terminal type |
| `COLORTERM` | (auto) | Color support |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | `0` | Don't set terminal title |

### Storage Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Config directory |
| `CLAUDE_CODE_SESSION_DIR` | `~/.claude/sessions` | Session storage |
| `CLAUDE_CODE_PLUGIN_DIR` | `~/.claude/plugins` | Plugin directory |
| `CLAUDE_CODE_CACHE_DIR` | `~/.claude/cache` | Cache directory |

## Permission Configuration

Permissions are configured in settings under the `permissions` key.

### Example Permission Settings

```json
{
  "permissions": {
    "mode": "ask-first",
    "scope": {
      "allowedDirectories": [
        ".",
        "src/",
        "../shared"
      ],
      "blockedPaths": [
        "~/.ssh",
        "/etc",
        "C:\\Windows"
      ],
      "allowedDomains": [
        "api.example.com",
        "*.github.com"
      ]
    },
    "tools": {
      "Bash": "ask",
      "Write": "auto",
      "Read": "allow",
      "Glob": "allow",
      "Grep": "allow"
    },
    "environment": {
      "allowedVariables": [
        "PATH",
        "HOME",
        "USER",
        "ANTHROPIC_API_KEY"
      ]
    },
    "autoAllowPatterns": [
      "ls *",
      "cat *",
      "git status",
      "git log --oneline"
    ]
  }
}
```

### Permission Modes

| Mode | Behavior |
|------|----------|
| `ask-first` | Prompt for each tool use (default, most secure) |
| `auto` | Auto-allow based on rules (balanced) |
| `accept-edits` | Auto-allow file edits, prompt for other tools |
| `bypass-permissions` | No prompts (least secure) |

**Danger Zone:** `--dangerously-skip-permissions` flag overrides all permissions. Use only in trusted environments.

### Permission Scopes

#### File System

Control which directories/files Claude can access:

```json
{
  "permissions": {
    "scope": {
      "additionalDirectories": [
        "../shared-lib",
        "/opt/tools"
      ],
      "blockedPaths": [
        "~/.ssh",
        "~/.aws",
        "~/.docker",
        "C:\\Program Files",
        "/etc/passwd",
        "/etc/shadow"
      ]
    }
  }
}
```

#### Environment Variables

Restrict which environment variables Claude can read:

```json
{
  "permissions": {
    "environment": {
      "allowedVariables": [
        "PATH",
        "HOME",
        "USER",
        "NODE_ENV",
        "RAILS_ENV",
        "DATABASE_URL"
      ]
    }
  }
}
```

#### Network

Control outbound network access:

```json
{
  "permissions": {
    "scope": {
      "allowedDomains": [
        "api.example.com",
        "docs.example.com",
        "*.npmjs.com"
      ],
      "deniedDomains": [
        "internal.api.company.secrets"
      ],
      "networkAccess": "restricted"  // "unrestricted" or "restricted"
    }
  }
}
```

#### Tool Allow/Deny Rules

Fine-grained tool control:

```json
{
  "permissions": {
    "tools": {
      "Bash": "ask",           // Always prompt
      "Write": "auto",         // Auto-allow
      "Read": "allow",         // Always allow
      "Edit": "suggest-only",  // Suggest but don't auto-apply
      "Git": "deny"            // Completely block
    }
  }
}
```

Tool permission levels:
- `allow` — Always allowed, no prompt
- `auto` — Allowed if matches safe pattern
- `ask` — Always prompt (default)
- `deny` — Always blocked
- `suggest-only` — Claude can suggest but user must manually execute

### Auto-Allow Patterns

Commands matching these patterns won't prompt in `auto` mode:

```json
{
  "permissions": {
    "autoAllowPatterns": [
      "ls *",
      "cat *",
      "head *",
      "tail *",
      "git status",
      "git log --oneline",
      "git diff",
      "find * -name '*.ts'",
      "grep -r *",
      "npm run",
      "yarn run"
    ]
  }
}
```

### Sandbox Configuration

Bash tool sandbox options:

```json
{
  "permissions": {
    "sandbox": {
      "enabled": true,
      "readonly": false,
      "network": true,
      "env": {
        "PATH": "/usr/bin:/bin",
        "HOME": "/tmp"
      },
      "mounts": {
        "/tmp": "/tmp"
      }
    }
  }
}
```

## Managed Settings (Enterprise)

Organizations can enforce configuration via managed settings.

### Configuration Hierarchy

```
Enterprise Policy (highest priority, cannot be overridden)
    ↓
Managed Settings (organization-level)
    ↓
Project Settings (repo-level)
    ↓
User Settings (personal)
    ↓
Defaults (lowest priority)
```

### Managed Settings File

Location determined by:
1. `CLAUDE_MANAGED_SETTINGS_PATH` environment variable
2. Organization policy (downloaded from claude.ai)
3. Default: `/etc/claude-code/managed-settings.json` (system-wide)

**Example (`managed-settings.json`):**
```json
{
  "$schema": "https://claude.ai/schemas/managed-settings-1.0.json",
  "version": 1,
  "pinned": {
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  },
  "policy": {
    "permissions": {
      "mode": "ask-first"
    },
    "blockedMarketplaces": [
      "untrusted.plugin.id"
    ],
    "strictKnownMarketplaces": true,
    "allowManagedHooksOnly": true
  },
  "plugins": {
    "required": [
      "company.security",
      "company.standards"
    ],
    "blocked": [
      "untrusted.plugin"
    ]
  }
}
```

### Managed Settings Keys

| Key | Type | Description |
|-----|------|-------------|
| `pinned.provider` | `string` | Locked AI provider |
| `pinned.model` | `string` | Locked model |
| `policy.permissions.mode` | `string` | Forced permission mode |
| `policy.plugins.required` | `string[]` | Must-have plugins |
| `policy.plugins.blocked` | `string[]` | Forbidden plugins |
| `policy.blockedMarketplaces` | `string[]` | Blocked marketplace IDs |
| `policy.allowedMarketplaces` | `string[]` | Whitelist of marketplaces |
| `policy.allowManagedHooksOnly` | `boolean` | Only allow hooks from managed plugins |
| `welcomeMessage` | `string` | Custom welcome text |

### Bypassing Managed Settings

Cannot override:
- `policy.*` keys
- `pinned.*` keys (only organization admins can change)

Can override (lower precedence than policy):
- User settings
- Project settings

## Plugin Configuration

### Plugin Manifest (`plugin.json`)

Every plugin requires a manifest:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A Claude Code plugin",
  "main": "index.ts",
  "files": ["skills/", "hooks/", "tools/"],
  "dependencies": {
    "other-plugin": "^1.2.0"
  },
  "skills": [
    "skills/my-skill.ts"
  ],
  "hooks": {
    "PreToolUse": [
      "hooks/pre-tool.ts"
    ]
  },
  "mcpServers": {
    "my-mcp": {
      "command": "node",
      "args": ["mcp-server.js"],
      "env": {
        "API_KEY": "${env:MY_API_KEY}"
      }
    }
  },
  "permissions": [
    "Bash",
    "Write",
    "Read"
  ]
}
```

### Plugin Settings

Plugins can define settings that appear in `/config`:

```json
{
  "name": "my-plugin",
  "settings": {
    "apiEndpoint": {
      "type": "string",
      "default": "https://api.example.com",
      "description": "API endpoint URL"
    },
    "enableFeatureX": {
      "type": "boolean",
      "default": false,
      "description": "Enable feature X"
    }
  }
}
```

Plugin settings appear under `plugins.my-plugin.*` in settings.

## Keybindings

Custom keybindings in `~/.claude/keybindings.json`:

```json
{
  "keybindings": {
    "ctrl+r": "resume",
    "ctrl+p": "command-palette",
    "ctrl+o": "toggle-focus",
    "ctrl+l": "clear-screen",
    "ctrl+u": "clear-input",
    "ctrl+k": "clear-line",
    "ctrl+f": "forward-char",
    "ctrl+b": "backward-char",
    "alt+enter": "newline",
    "tab": "complete",
    "escape": "cancel"
  }
}
```

**Keybinding names** (command palette):
- `resume` — `/resume`
- `command-palette` — Open command picker
- `toggle-focus` — Focus mode toggle
- `clear-screen` — `/clear`
- `clear-input` — Clear prompt
- `newline` — Insert newline
- `complete` — Tab completion

### Vim Mode Keybindings

In Vim mode, standard Vim keys are used:

| Mode | Keys |
|------|------|
| Normal | `h/j/k/l` navigation, `i` insert, `:` command |
| Insert | Standard typing |
| Visual | `v` char select, `V` line select |
| Command | `:` for `/commands` |

Custom Vim keybindings in settings:

```json
{
  "vimKeybindings": {
    "normal": {
      "leader": " ",
      "maps": {
        "leader r": "/resume",
        "leader c": "/compact"
      }
    }
  }
}
```

## Theme Configuration

### Built-in Themes

Located in `src/ui/themes/`:
- `default.ts` — Default dark
- `light.ts` — Light theme
- `oblivion.ts` — High-contrast
- `matrix.ts` — Matrix green
- `ocean.ts` — Ocean blue

### Custom Themes

Create `~/.claude/themes/my-theme.json`:

```json
{
  "name": "my-theme",
  "styles": {
    "background": "#0d1117",
    "foreground": "#c9d1d9",
    "accent": "#58a6ff",
    "success": "#3fb950",
    "error": "#f85149",
    "warning": "#d29922",
    "info": "#1f6feb",
    "dim": "#8b949e",
    "muted": "#6e7681"
  }
}
```

Or create a TypeScript theme (`my-theme.ts`):

```typescript
import { Theme } from "@/ui/themes/types.ts";

export const myTheme: Theme = {
  name: "my-theme",
  styles: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    // ...
  },
};
```

## Context Management

### Auto-Compaction

When context window approaches limit, old messages are automatically summarized.

```json
{
  "autoCompact": true,
  "compactThreshold": 0.8,      // Compact at 80% usage
  "compactStrategy": "summarize" // "summarize" | "truncate" | "elide"
}
```

### Context Directories

Directories added to context persist across sessions:

```bash
/add-dir ./src --remember
/add-dir ./tests --remember
```

Stored in `.claude/settings.json`:

```json
{
  "context": {
    "alwaysInclude": [
      "src/",
      "tests/"
    ]
  }
}
```

### Context Exclusions

Glob patterns for files to exclude:

```json
{
  "context": {
    "excludeGlobs": [
      "node_modules/**",
      "dist/**",
      "*.log",
      "*.tmp",
      ".git/**"
    ]
  }
}
```

## Proxy Configuration

Set proxy for API requests:

```bash
export HTTPS_PROXY="http://proxy.example.com:8080"
export HTTP_PROXY="http://proxy.example.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

Or in settings:

```json
{
  "proxy": {
    "enabled": true,
    "url": "http://proxy.example.com:8080",
    "noProxy": "localhost,127.0.0.1"
  }
}
```

## Network Settings

### MCP Server Configuration

MCP servers configured in `.claude/claude.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    },
    "github": {
      "type": "http",
      "url": "https://mcp.github.com",
      "headers": {
        "Authorization": "Bearer ${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

### MCP OAuth

OAuth-enabled MCP servers:

```json
{
  "mcpServers": {
    "server-with-oauth": {
      "command": "mcp-server",
      "oauth": {
        "clientId": "...",
        "clientSecret": "...",
        "scopes": ["read", "write"]
      }
    }
  }
}
```

The OAuth flow prompts user to authenticate in browser.

## Update Settings

Control auto-update behavior:

```json
{
  "updates": {
    "autoCheck": true,
    "autoInstall": "stable",     // "stable" | "nightly" | "none"
    "channel": "stable",          // "stable" | "nightly" | "rc"
    "checkOnStartup": true,
    "notifyOnUpdate": true
  }
}
```

Or via environment:

```bash
export CLAUDE_CODE_DISABLE_AUTOUPDATER=1  # Completely disable
export CLAUDE_CODE_UPDATE_CHANNEL=nightly
```

## Security Settings

**Security-critical settings**:

```json
{
  "security": {
    "allowArbitraryCodeExecution": false,  // Don't allow untrusted code
    "requirePermissionConfirmation": true,
    "logAllToolUse": true,                // Audit all tool usage
    "redactSensitiveData": true,          // Redact API keys, tokens
    "maxUploadSize": 10485760,            // 10MB max upload
    "allowedFileExtensions": [".ts", ".js", ".py", ".md", ".txt"]
  }
}
```

## Custom Status Line

Configure the status bar via `statusLine` setting:

```json
{
  "statusLine": {
    "left": ["provider", "model", "session"],
    "right": ["context", "cost", "effort"],
    "separator": " | "
  }
}
```

Available status items:
- `provider` — Current AI provider
- `model` — Current model
- `session` — Session ID/name
- `context` — Token usage percentage
- `cost` — Current session cost
- `effort` — Thinking effort level
- `time` — Current time
- `branch` — Git branch

## Troubleshooting Configuration

### Invalid Settings

If settings file has syntax errors, defaults are used and error logged. Fix with:

```bash
# Validate JSON
cat ~/.claude/settings.json | python -m json.tool

# Reset to defaults
rm ~/.claude/settings.json
# Next run will recreate with defaults
```

### Settings Not Applying

1. Check for typos (settings are camelCase)
2. Verify file location (`~/.claude/settings.json`)
3. Check file permissions (should be readable by you only)
4. Run `/doctor` to detect issues
5. Restart Claude Code

### Debug Settings Resolution

Enable config debug logging:

```bash
DEBUG=config:* bun run src/main.tsx session
```

Shows:
- Settings file paths checked
- Values loaded from each source
- Final merged configuration

## Reset Settings

### Reset to Defaults

```bash
# Backup current settings
cp ~/.claude/settings.json ~/.claude/settings.backup.json

# Remove (will be recreated with defaults)
rm ~/.claude/settings.json
```

### Reset Specific Section

Edit `~/.claude/settings.json` and remove specific keys, then restart.

### Factory Reset

Warning: Deletes all sessions, plugins, cache!

```bash
rm -rf ~/.claude/
```

## Export/Import Settings

### Export

```bash
# Export to file
bun run src/main.tsx --export-settings ~/settings-export.json

# Or via /config
/config --export ~/settings.json
```

### Import

```bash
# Import from file
bun run src/main.tsx --import-settings ~/settings.json
```

Settings are merged, not replaced.

## Settings Migration

When upgrading Claude Code, settings are automatically migrated. Old keys are deprecated but preserved for backwards compatibility.

Deprecated settings:
- `autoAcceptEdits` → Use `permissionMode: "accept-edits"`
- `enableAutoMode` → Removed (auto mode always available)
- `hideWelcomeBanner` → `showWelcomeBanner: false`

## FAQ

**Q: Where are settings stored?**
A: `~/.claude/settings.json` (platform-specific path on Windows).

**Q: Can I have per-project settings?**
A: Yes! Place `.claude/settings.json` in project root.

**Q: How do I reset a setting to default?**
A: Remove the key from settings file and restart.

**Q: Why aren't my settings applying?**
A: Check precedence order — user settings win over project, but managed settings (enterprise) can override.

**Q: How do I disable telemetry?**
A: Set `"enableTelemetry": false` in settings or `DISABLE_TELEMETRY=1` environment variable.

**Q: Can I use environment variables in settings?**
A: Yes — use `${env:VAR_NAME}` syntax in string fields:
```json
{
  "ai": {
    "apiKey": "${env:ANTHROPIC_API_KEY}"
  }
}
```

**Q: How do I configure MCP servers?**
A: Edit `~/.claude/claude.json` (see [MCP](MCP.md)).

**Q: Where are API keys stored?**
A: Encrypted in system keychain (Keychain on macOS, Windows Credential Manager, Secret Service on Linux). Not in plaintext settings file.
