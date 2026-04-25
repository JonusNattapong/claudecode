# Architecture

## System Overview

Claude Code is a terminal-based AI coding assistant built with a modular, service-oriented architecture. It combines a reactive UI (Ink + React) with a powerful AI orchestration layer supporting multiple LLM providers.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Terminal UI                          │
│                     (Ink / React / TUI)                     │
├─────────────────────────────────────────────────────────────┤
│                    Command Handler Layer                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Files   │ │   Git    │ │  MCP     │ │   Agent      │  │
│  │ Commands │ │Commands  │ │ Servers  │ │  System      │  │
├─────────────────────────────────────────────────────────────┤
│                    AI Provider Layer                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Anthropic │ │ OpenAI   │ │ Google   │ │  OpenRouter  │  │
│  │Provider  │ │Provider  │ │Provider  │ │   Provider   │  │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Provider  │ │Session   │ │Permission│ │   Plugin     │  │
│  │Registry  │ │Manager   │ │Manager   │ │   Manager    │  │
├─────────────────────────────────────────────────────────────┤
│                    Data & Storage                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │~/.claude/│ │Session   │ │Settings  │ │   Cache      │  │
│  │Sessions  │ │Transcript│ │(JSON)    │ │  (5-min)     │  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Main Entry Point (`src/main.tsx`)

The application entry point that:
- Initializes the TUI (Terminal User Interface)
- Sets up Ink/React renderer
- Bootstraps core services (ProviderRegistry, SessionManager, etc.)
- Handles CLI arguments and flags
- Registers all built-in commands
- Loads plugins and skills
- Starts the REPL loop

**Key responsibilities:**
- Process command-line options (`--provider`, `--model`, `--resume`, etc.)
- Initialize environment (API keys, config, settings)
- Construct and render the main App component

### 2. App Component (`src/cli/App.tsx`)

The root React component that:
- Manages global application state
- Coordinates between UI layout, input handling, and AI interactions
- Controls fullscreen/normal mode toggling
- Handles session lifecycle (create, resume, exit)
- Maintains conversation history and message list
- Displays the prompt input and response rendering

**State management:**
- `messages` — Array of conversation messages
- `inputValue` — Current prompt text
- `mode` — `Normal`, `Plan`, `Compact`, or `Fullscreen`
- `isResponding` — Loading state
- `providerManager` — Shared provider instance

### 3. Provider System (`src/services/ai/`)

Abstraction layer for AI model providers.

#### Provider Interface (`ProviderInterface.ts`)

All providers must implement:
- `streamMessage()` — Streaming responses
- `nonStreamingMessage()` — Non-streaming fallback
- `getModels()` — Model discovery
- `getToolResultSchema()` — Tool schema for function calling
- `normalize*()` — Normalization helpers for responses, tools, errors

#### Built-in Providers

| Provider | Adapter | Features |
|----------|---------|----------|
| Anthropic | `@ai-sdk/anthropic` | Native Claude models, native SSE streaming |
| OpenAI | `@ai-sdk/openai` | GPT-4, GPT-3.5-turbo, o1, o3 |
| Google | `@ai-sdk/google` | Gemini Pro, Gemini Flash |
| OpenRouter | `@openrouter/ai-sdk-provider` | 100+ models via unified API |
| KiloCode | `ai-sdk-provider-opencode-sdk` | Custom provider |
| Ollama | Custom HTTP | Local models, no API key |
| AWS Bedrock | `@aws-sdk/client-bedrock` | Claude on Bedrock, region support |
| Google Vertex AI | `@google/generative-ai` | Claude/Vertex models |
| Azure | `@azure/identity` | Azure-hosted models |

#### Provider Registry (`providerRegistry.ts`)

Singleton registry that:
- Registers all available providers
- Handles provider switching
- Provides access to current provider instance
- Persists provider/model selection in settings

#### Provider Manager (`ProviderManager.ts`)

Orchestrates:
- API key management (per-provider storage)
- Model selection and discovery
- Streaming response handling
- Token usage tracking
- Error normalization

### 4. Tools System (`src/infra/tools/`)

Tools extend Claude's capabilities by allowing it to perform actions.

#### Tool Categories

**Core System Tools:**
- `Read` — Read file contents
- `Edit` — Edit files with precise replacements
- `Write` — Write or create files
- `Glob` / `Grep` — File searching
- `Bash` / `PowerShell` — Command execution
- `Git` — Version control operations

**Integration Tools:**
- `WebFetch` — Fetch web pages
- `WebSearch` — Search the web
- `Task` — Create subagent tasks
- `Agent` — Invoke other agents
- `MCP` — Model Context Protocol integration

**Session Tools:**
- `Session` — Save/load sessions
- `Ask` — Ask follow-up questions
- `Feedback` — Send feedback

#### Tool Implementation Pattern

Each tool exports:
```typescript
{
  name: string,
  description: string,
  parameters: zod.Schema,
  isEnabled: (context) => boolean,
  userFacingName: () => string,
  renderToolUse: () => JSX.Element,
  renderResult: () => JSX.Element,
}
```

### 5. CLI Commands (`src/commands/`)

All slash commands (`/command`) are implemented as independent modules.

#### Command Structure

Each command directory contains:
- `index.ts` — Command handler (interactive mode)
- `*noninteractive.ts` — Non-interactive mode handler
- `*ui.tsx` — UI components (optional)

#### Command Registration

Commands register via:
```typescript
registerCommand({
  name: "command-name",
  description: "Description",
  symbol: "⚡",  // Optional emoji
  isEnabled: (context) => boolean,
  handler: async (context) => { ... },
});
```

**Built-in Commands** (partial list):
- `/model` — Switch AI model
- `/provider` — Manage providers
- `/config` — Settings editor
- `/buddy` — Configure AI companion
- `/cost` / `/usage` — Token usage and cost
- `/context` — Context window usage
- `/resume` / `/continue` — Resume sessions
- `/agents` — Agent management
- `/skills` — Skill management
- `/mcp` — MCP server management
- `/plugin` — Plugin marketplace
- `/status` — System status
- `/doctor` — Diagnostics

### 6. Plugin System (`src/plugins/`)

Plugins extend Claude Code with custom functionality.

#### Plugin Structure

```
plugin-name/
├── .claude-plugin/
│   ├── plugin.json      # Manifest (name, version, skills, hooks)
│   ├── skills/          # Skill implementations
│   ├── hooks/           # Hook handlers
│   └── tools/           # Custom tools (optional)
├── marketplace.json     # Marketplace metadata
└── README.md           # Plugin documentation
```

#### Plugin Loading Process

1. Discover plugins from:
   - Built-in plugins (`plugins/`)
   - User plugins (`~/.claude/plugins/`)
   - Marketplace entries
2. Validate `plugin.json` manifest
3. Resolve dependencies between plugins
4. Load skills and register slash commands
5. Register hooks
6. Start background monitors (if any)

**Plugin Types:**
- **Local** — Loaded from filesystem
- **Git** — Loaded from git repository
- **Marketplace** — Installed from plugin marketplace

#### Skill Definition

Skills are specialized commands or automation:

```json
{
  "name": "my-skill",
  "description": "Does something useful",
  "command": "my-skill",  // Slash command name
  "group": "Custom",
  "frontmatter": "---",
  "mcpServers": { ... }   // Optional MCP servers
}
```

#### Hook Types

Plugins can hook into lifecycle events:
- `PreToolUse` — Before tool execution
- `PostToolUse` — After tool execution
- `PreBash` — Before Bash command
- `PostPrompt` — After user prompt
- `PreAcceptEdit` — Before accepting edit
- And more...

### 7. Permissions System (`src/cli/permissions/`)

Security layer controlling what Claude can do.

#### Permission Hierarchy

1. **Policy** (highest) — Managed by organization admin
2. **Project** — `.claude/settings.json` in project root
3. **User** — `~/.claude/settings.json`
4. **Local** — `CLAUDE_CODE_LOCAL_*` env vars
5. **Environment** — `CLAUDE_CODE_*` env vars
6. **Code** (lowest) — Hardcoded defaults

#### Permission Modes

- `auto` — Automatically allow based on rules
- `accept-edits` — Allow file edits automatically, prompt for other tools
- `ask-first` — Always prompt for confirmation (default)
- `bypass` — Allow everything (warning: dangerous)

#### Permission Scopes

Permissions apply to:
- **Directories** — Filesystem access bounds
- **Tools** — Which tools are available
- **Environment** — Which env vars can be read
- **Network** — Allowed domains and ports

#### Sandboxing

Bash commands run in a sandbox when possible:
- Linux: PID namespace + seccomp-bpf
- macOS: Seatbelt sandbox
- Windows: Job objects + restricted token

### 8. Session Management (`src/cli/session/`)

Handles conversation persistence and lifecycle.

#### Session Files

Sessions stored in `~/.claude/sessions/`:
- `{id}.json` — Session metadata
- `{id}.txt` — Transcript (plaintext)
- `{id}.json` — Full JSON transcript

#### Session Modes

- **Normal** — Standard conversation
- **Plan** — Structured planning mode
- **Compact** — Context compression enabled
- **Focus** — Minimal UI, only conversation

#### Session Actions

- `--resume <id>` — Resume existing session
- `--continue` — Continue most recent session
- `--from-pr <url>` — Start from GitHub PR
- `/add-dir` — Add project directory to session

### 9. Bridge Mode (`src/bridge/`)

Enables remote collaboration features.

**Components:**
- `bridgeMain.ts` — Core bridge implementation
- `replBridge.ts` — REPL bridge for WebSocket transport
- `codeSessionApi.ts` — API client for claude.ai
- `bridgeConfig.ts` — Configuration loading

**Features:**
- Share session URL with teammates
- Remote control from web/desktop
- Live transcription
- Voice dictation sync

### 10. Agent System (`src/agents/`)

Agents are specialized AI instances with custom tools and behavior.

#### Agent Types

- **Subagent** — Spawned from main conversation
- **Parallel Agent** — Runs alongside main agent
- **Forked Agent** — Independent session fork

#### Agent Configuration

```typescript
interface Agent {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  MCP servers?: Record<string, any>;
  permissionMode?: PermissionMode;
  allowedPaths?: string[];
}
```

#### Agent Tool

The `/agent` tool allows:
- Spawning subagents for specific tasks
- Parallel execution
- Tool chaining
- Result aggregation

## Data Flow

### Request → Response Flow

```
User types prompt
      ↓
Input capture (keyboard handling)
      ↓
Message added to conversation
      ↓
Context window check (auto-compact if needed)
      ↓
Permission checks (PreToolUse hooks, sandbox)
      ↓
Build API request (tools, system prompt, context)
      ↓
Stream response (via SSE transport)
      ↓
Render UI (incremental updates)
      ↓
Tool calls extracted
      ↓
Permission prompts (if needed)
      ↓
Execute tools
      ↓
Tool results added to context
      ↓
Continue streaming (back to step 5)
      ↓
Response complete
      ↓
Post-processing (hooks, transcript save, telemetry)
```

### Tool Execution Flow

```
Model calls tool
      ↓
ToolUse message added
      ↓
PreToolUse hook (if registered)
      ↓
Permission check (sandbox, rule evaluation)
      ↓
Prompt user (if required)
      ↓
Execute tool implementation
      ↓
PostToolUse hook (if registered)
      ↓
ToolResult message added
      ↓
Continue conversation
```

## Extension Points

### 1. Custom Tools

Implement the Tool interface:
```typescript
import { Tool } from "./tool.tsx";

const myTool: Tool = {
  name: "my_tool",
  description: "Does something cool",
  parameters: z.object({
    input: z.string(),
  }),
  isEnabled: () => true,
  async *execute(args) {
    // Tool logic
    yield { type: "result", content: "Done!" };
  },
};
```

### 2. Custom Commands

Create a directory under `src/commands/`:
```typescript
import { registerCommand } from "../cli/commands.ts";

registerCommand({
  name: "mycommand",
  description: "My custom command",
  handler: async (session) => {
    session.ui.print("Hello from my command!");
  },
});
```

### 3. Plugins

Create a plugin manifest (`plugin.json`):
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A plugin for Claude Code",
  "skills": ["./skills/my-skill.ts"],
  "hooks": {
    "PreToolUse": ["./hooks/pre-tool.ts"]
  }
}
```

### 4. Hooks

Hooks allow intercepting tool execution:
```typescript
export default {
  name: "my-hook",
  version: "1.0.0",
  hooks: {
    PreToolUse: async (input) => {
      // Modify input, block tool, or request permission
      return input;
    },
  },
};
```

## Configuration

Settings are loaded from multiple sources:
1. Built-in defaults
2. Environment variables (`CLAUDE_CODE_*`)
3. Managed settings (enterprise policy)
4. Project settings (`.claude/settings.json`)
5. User settings (`~/.claude/settings.json`)

See [Configuration](CONFIGURATION.md) for complete details.

## Storage Layout

```
~/.claude/
├── sessions/            # Session files
│   ├── {id}.json       # Metadata
│   ├── {id}.txt        # Transcript
│   └── {id}.jsonl      # JSON transcript
├── settings.json       # User settings
├── credentials.json    # Stored API tokens
├── keybindings.json    # Custom keybindings
├── plugins/            # Installed plugins
│   └── {plugin-name}/
├── themes/             # Custom color themes
├── backups/            # Session backups
├── tasks/              # Scheduled tasks
├── shell-snapshots/    # Shell state snapshots
└── cache/
    ├── models/         # Model metadata cache
    └── providers/      # Provider responses
```

Project-specific:
```
.project/
├── .claude/
│   ├── settings.json   # Project settings
│   ├── contexts.json   # Git branch mappings
│   └── plugin-overrides.json
└── .git/
```

## Performance Optimizations

- **Model Cache** — 5-minute TTL for model lists
- **Session Index** — In-memory index for fast resume lookup
- **Lazy Loading** — Grammars and large dependencies loaded on-demand
- **Virtual Scroller** — Only visible messages rendered
- **Streaming SSE** — Real-time without buffering
- **Token Budgeting** — Preemptive compaction before overflow

## Security Considerations

- **Sandboxing** — All tool execution isolated
- **Permission Model** — Multi-layer approval system
- **Credential Storage** — Encrypted keychain (macOS Keychain, Windows Credential Manager, Secret Service on Linux)
- **Audit Trail** — All actions logged in session transcript
- **No Secret Logging** — API keys redacted from logs
- **Network Restrictions** — Configurable allowed domains
- **MCP OAuth** — Full OAuth 2.1 flow with PKCE

## OpenTelemetry & Observability

Claude Code exports traces, metrics, and logs:
- **Traces** — Request flows, tool execution chains
- **Metrics** — Token usage, latency, error rates
- **Logs** — Structured logs with context

Export endpoints configurable via:
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL` (grpc / http)
- `OTEL_SERVICE_NAME`

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for contribution guidelines.
