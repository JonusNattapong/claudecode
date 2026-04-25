# Development Guide

## Prerequisites

- **Node.js** 18+ or **Bun** 1.0+ (recommended for speed)
- **Git** for version control
- **TypeScript** knowledge (type-safe codebase)
- **React** knowledge (for UI components using Ink)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/JonusNattapong/ClaudeCode.git
cd claude-code

# Install dependencies (using Bun - fastest)
bun install

# Or use npm
npm install

# Build the project
bun run build

# Run in development mode (with file watching)
bun run dev

# Or run directly
bun run src/main.tsx session
```

## Project Structure

```
claude-code/
├── src/
│   ├── main.tsx                    # Entry point, CLI argument parsing
│   ├── cli/                        # CLI-specific code
│   │   ├── App.tsx                 # Main TUI application
│   │   ├── print.ts                # Output rendering utilities
│   │   ├── structuredIO.ts         # Structured input/output handling
│   │   ├── exit.ts                 # Exit handling
│   │   ├── handlers/               # Feature handlers
│   │   │   ├── auth.ts             # Authentication
│   │   │   ├── agents.ts           # Agent management
│   │   │   ├── plugins.ts          # Plugin lifecycle
│   │   │   └── autoMode.ts         # Auto mode logic
│   │   ├── transports/             # Transport layers (SSE, WebSocket, Hybrid)
│   │   │   ├── SSETransport.ts     # Server-Sent Events
│   │   │   ├── WebSocketTransport.ts
│   │   │   └── HybridTransport.ts  # Fallback to non-streaming
│   │   └── remoteIO.ts             # Remote control I/O
│   │
│   ├── commands/                   # Slash commands (/command)
│   │   ├── buddy/                  # /buddy - AI companion config
│   │   ├── config/                 # /config - settings editor
│   │   ├── cost/                   # /cost - token usage
│   │   ├── context/                # /context - context window usage
│   │   ├── diff/                   # /diff - diff viewer
│   │   ├── doctor/                 # /doctor - diagnostics
│   │   ├── effort/                 # /effort - thinking effort
│   │   ├── feedback/               # /feedback - send feedback
│   │   ├── files/                  # /files - file browser
│   │   ├── git-specific/           # Git-related commands
│   │   ├── mcp/                    # /mcp - MCP management
│   │   ├── model/                  # /model - model picker
│   │   ├── plugin/                 # /plugin - plugin marketplace
│   │   ├── provider-select/        # /provider - provider management
│   │   ├── skills/                 # /skills - skill management
│   │   └── ...                     # Many more
│   │
│   ├── services/                   # Business logic services
│   │   ├── ai/                     # AI provider system
│   │   │   ├── providers/          # Provider implementations
│   │   │   │   ├── anthropic.ts    # Anthropic/Claude
│   │   │   │   ├── openai.ts       # OpenAI GPT
│   │   │   │   ├── google.ts       # Google Gemini
│   │   │   │   ├── ollama.ts       # Ollama local
│   │   │   │   └── ...             # Other providers
│   │   │   ├── providerRegistry.ts # Provider registry singleton
│   │   │   ├── ProviderManager.ts  # Provider orchestration
│   │   │   ├── providerModels.ts   # Model discovery & caching
│   │   │   ├── ProviderInterface.ts # Base interface
│   │   │   └── toolResultNormalizers.ts # Tool result normalization
│   │   ├── session/                # Session management
│   │   │   ├── SessionManager.ts   # Session lifecycle
│   │   │   ├── sessionStore.ts     # Storage backend
│   │   │   ├── sessionIndex.ts     # Fast session lookup
│   │   │   └── contextCompacter.ts # Context window management
│   │   ├── config/                 # Configuration system
│   │   │   ├── configLoader.ts     # Multi-source config
│   │   │   ├── managed-settings.ts # Enterprise policy
│   │   │   └── configSchema.ts     # Zod validation schema
│   │   ├── permissions/            # Permission system
│   │   │   ├── permissions.ts      # Core permission logic
│   │   │   ├── PermissionManager.ts # Permission manager
│   │   │   ├── sandbox.ts          # Bash sandbox
│   │   │   ├── gitSafeList.ts      # Git allowlist
│   │   │   └── rules/              # Permission rules
│   │   ├── mcp/                    # MCP integration
│   │   │   ├── mcpManager.ts       # MCP server lifecycle
│   │   │   ├── mcpTransport.ts     # MCP over stdio/SSE/HTTP
│   │   │   └── mcpIntegration.ts   # MCP-to-tool bridging
│   │   ├── tools/                  # Tool implementations
│   │   │   ├── toolUse.ts          # Tool call handling
│   │   │   ├── toolsRegistry.ts    # Tool registry
│   │   │   ├── fileTools.ts        # Read, Write, Edit, Glob, Grep
│   │   │   ├── bashTool.ts         # Bash/PowerShell execution
│   │   │   ├── webTools.ts         # WebFetch, WebSearch
│   │   │   └── ...                 # Git, Task, Agent, etc.
│   │   │
│   │   ├── plugins/                # Plugin system
│   │   │   ├── pluginManager.ts    # Plugin lifecycle
│   │   │   ├── pluginResolver.ts   # Dependency resolution
│   │   │   ├── skillLoader.ts      # Skill loading
│   │   │   └── hookRunner.ts       # Hook execution
│   │   │
│   │   ├── ui/                     # UI components
│   │   │   ├── ChatInput.tsx       # Input component
│   │   │   ├── ResponseRenderer.tsx # Response display
│   │   │   ├── Modal.tsx           # Modal dialogs
│   │   │   ├── MiniDashboard.tsx   # Status bar
│   │   │   └── ...                 # Various UI widgets
│   │   │
│   │   └── ...                     # More services
│   │
│   ├── bridge/                     # Bridge mode (remote collaboration)
│   │   ├── bridgeMain.ts           # Bridge orchestrator
│   │   ├── codeSessionApi.ts       # claude.ai API client
│   │   ├── replBridge.ts           # REPL bridge implementation
│   │   ├── bridgeConfig.ts         # Configuration
│   │   └── ...                     # Bridge components
│   │
│   ├── infra/                      # Infrastructure & runtime
│   │   ├── tool.ts                 # Tool base class
│   │   ├── toolResult.ts           # Tool result types
│   │   ├── mcp.ts                  # MCP protocol types
│   │   ├── permissions.ts          # Permission types
│   │   ├── errors.ts               # Error types
│   │   ├── json.ts                 # JSON utilities
│   │   └── vendor/                 # Vendored dependencies
│   │
│   └── types/                      # TypeScript type definitions
│       ├── ai.ts                   # AI-related types
│       ├── config.ts               # Configuration types
│       ├── inventory.ts            # Plugin inventory
│       ├── messages.ts             # Message schema
│       └── platform.ts             # Platform-specific types
│
├── plugins/                        # Built-in plugins
│   ├── code-review/
│   ├── feature-dev/
│   ├── commit-commands/
│   └── ...                        # More plugins
│
├── scripts/                        # Build & utility scripts
│   ├── build.ts                   # Bun build script
│   ├── comment-on-duplicates.sh   # GitHub helper
│   ├── auto-close-duplicates.ts   # Duplicate detection
│   └── ...                        # More scripts
│
├── dist/                          # Build output (generated)
│   └── cli.js                    # Bundled CLI
│
├── examples/                      # Usage examples
│   ├── settings/                  # Settings examples
│   │   ├── settings-strict.json   # Strict mode config
│   │   ├── settings-lax.json      # Permissive config
│   │   └── settings-bash-sandbox.json
│   └── mdm/
│       └── managed-settings.json  # Enterprise policy
│
├── test/                          # Test suite
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── fixtures/                  # Test fixtures
│
├── .claude-plugin/                # Claude Code plugin metadata
│   └── marketplace.json
│
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript configuration
├── bunfig.toml                    # Bun configuration
├── AGENTS.md                      # Kilo agent instructions (this project)
├── CLAUDE.md                      # Claude-specific instructions
├── km.json                        # Kilo configuration
├── README.md                      # User-facing documentation
├── CHANGELOG.md                   # Version history
├── LICENSE.md                     # License (SEE LICENSE)
├── .gitignore                     # Git ignore rules
└── docs/                          # Project documentation (this folder)
```

## Technology Stack

### Core Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Bun / Node.js | JavaScript runtime |
| **Language** | TypeScript 5.x | Type-safe development |
| **UI Framework** | React 19 | Component library |
| **TUI Library** | Ink 6 | React for CLIs |
| **CLI Parser** | Commander.js | Argument parsing |
| **AI SDK** | Vercel AI SDK | Unified AI provider API |
| **Schema Validation** | Zod 4 | Runtime validation |
| **State Management** | React Context / useReducer | Global state |
| **HTTP Client** | Axios / Fetch | API requests |
| **File Watching** | chokidar | File system monitoring |

### AI Providers

- **Anthropic** — `@ai-sdk/anthropic` (Claude models)
- **OpenAI** — `@ai-sdk/openai` (GPT-4, GPT-3.5)
- **Google** — `@ai-sdk/google` (Gemini)
- **OpenRouter** — `@openrouter/ai-sdk-provider` (multi-provider gateway)
- **KiloCode** — `ai-sdk-provider-opencode-sdk`
- **Ollama** — Custom HTTP (local models)

### Key Libraries

- **ink** — React component renderer for CLIs
- **react** — UI component library
- **react-reconciler** — React rendering engine for Ink
- **chalk** — Terminal string styling
- **commander** — Command-line interface framework
- **zod** — TypeScript-first schema validation
- **ai** — Vercel AI SDK (streaming, providers)
- **diff** — Text diff algorithm
- **marked** — Markdown parser
- **highlight.js** — Syntax highlighting
- **fuse.js** — Fuzzy search
- **uuid** — UUID generation
- **ws** — WebSocket client
- **execa** — Process execution
- **chokidar** — File watcher
- **ignore** — .gitignore parsing
- **glob** — File globbing
- **yaml** — YAML parser
- **tree-kill** — Process tree termination
- **proper-lockfile** — File locking
- **open** — Open URLs in browser

## Build & Test

### Building

```bash
# Development build (no minification)
bun run build:dev

# Production build
bun run build

# Clean output directory
bun run clean
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test test/unit/tools/fileTools.test.ts

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
```

### Type Checking

```bash
# Type check all files
bun x tsc --noEmit

# Watch mode
bun x tsc --noEmit --watch
```

### Linting

```bash
# ESLint
bun x eslint src/

# Prettier
bun x prettier --write src/
```

### Development Workflow

1. **Make changes** to source files in `src/`
2. **Run dev server** — `bun run dev` auto-rebuilds on changes
3. **Test manually** — Launch `bun run src/main.tsx session` in another terminal
4. **Run tests** — `bun test` to ensure no regressions
5. **Type check** — `bun x tsc --noEmit`
6. **Commit** — Follow commit message conventions (see below)

## Adding a New Command

Commands are modular and self-contained.

### Step 1: Create Command Directory

```bash
mkdir -p src/commands/mycommand/
```

### Step 2: Implement `index.ts`

```typescript
// src/commands/mycommand/index.ts
import { registerCommand } from "../../cli/commands.ts";
import { z } from "zod";

export default () => {
  registerCommand({
    name: "mycommand",
    description: "What this command does",
    parameters: z.object({
      arg: z.string().optional(),
    }),
    isEnabled: () => true, // Optional: gating logic
    async handler(session, args) {
      // Command implementation
      session.ui.print("Hello from my command!");
    },
  });
};
```

### Step 3: Add to Command Loader

Commands are auto-loaded via `src/commands/index.ts`. Just ensure your file is imported:

```typescript
// src/commands/index.ts
import mycommand from "./mycommand/index.ts";
```

### Step 4: (Optional) Add Non-Interactive Handler

Create `mycommand-noninteractive.ts` for `--print` mode:

```typescript
export async function handleMyCommandNonInteractive(
  input: any,
  session: Session
): Promise<string> {
  return "Output for --print mode";
}
```

### Step 5: (Optional) Add UI Components

Create `mycommand-ui.tsx` for interactive UI:

```tsx
import { Fragment } from "react";
import { Box, Text } from "ink";

export function MyCommandUI() {
  return (
    <Box flexDirection="column">
      <Text>My custom UI</Text>
    </Box>
  );
}
```

## Adding a New Tool

Tools allow Claude to perform actions.

### Step 1: Create Tool File

```typescript
// src/infra/tools/myTool.ts
import { Tool } from "../infra/tool.ts";
import { z } from "zod";

export const myTool: Tool = {
  name: "my_tool",
  description: "Does something useful",
  parameters: z.object({
    path: z.string().describe("File path"),
    content: z.string().describe("Content to write"),
  }),
  isEnabled: (context) => {
    // Return false to disable in certain contexts
    return true;
  },
  userFacingName: (context) => "MyTool",
  renderToolUse: ({ args }) => (
    <Box>
      <Text>Writing to {args.path}...</Text>
    </Box>
  ),
  renderResult: ({ result }) => (
    <Box>
      <Text green>✓ Success</Text>
    </Box>
  ),
  async *execute(args, context) {
    // Tool implementation
    yield {
      type: "result",
      content: `Wrote ${args.content.length} bytes to ${args.path}`,
    };
  },
};
```

### Step 2: Register Tool

Add to the tools registry (`src/services/tools/toolsRegistry.ts`):

```typescript
import { myTool } from "../infra/tools/myTool.ts";

export function getTools(): Tool[] {
  return [
    readTool,
    editTool,
    writeTool,
    myTool,  // Add your tool here
    // ...
  ];
}
```

### Step 3: Permission Rules

Add permission prompts in `src/cli/permissions/permissions.ts`:

```typescript
case "my_tool": {
  session.permissionManager.requestPermission(
    `my_tool:${args.path}`,
    PermissionLevel.Ask,
    `Allow writing to ${args.path}?`
  );
}
```

## Adding a New Provider

Providers allow using different AI backends.

### Step 1: Implement Provider Interface

```typescript
// src/services/ai/providers/myProvider.ts
import { ProviderInterface } from "../ProviderInterface.ts";
import { streamText, generateText } from "ai";

export const myProvider: ProviderInterface = {
  name: "myprovider",

  async *streamMessage(request, options) {
    const result = streamText({
      model: myProviderModel(request.model),
      messages: request.messages,
      tools: request.tools,
      maxSteps: request.maxSteps,
    });

    for await (const chunk of result.textStream) {
      yield { type: "text-delta", textDelta: chunk };
    }
  },

  async nonStreamingMessage(request, options) {
    const result = await generateText({
      model: myProviderModel(request.model),
      messages: request.messages,
      tools: request.tools,
    });

    return normalizeResponse(result);
  },

  getModels() {
    return [
      { id: "my-model-1", name: "My Model 1", context: 200000 },
      { id: "my-model-2", name: "My Model 2", context: 128000 },
    ];
  },

  // Optional: implement normalize* methods for provider-specific formats
};
```

### Step 2: Register Provider

Add to `src/services/ai/providerRegistry.ts`:

```typescript
import { myProvider } from "./providers/myProvider.ts";

export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  registry.register("myprovider", myProvider);
  // ... other providers

  return registry;
}
```

### Step 3: Add Provider Selection UI

Update `/provider` command to include your provider:

```typescript
// src/commands/provider-select/index.ts
const PROVIDERS = [
  { id: "anthropic", name: "Anthropic (Claude)" },
  { id: "myprovider", name: "My Provider" }, // Add here
];
```

## Testing

### Unit Tests

Tests use Bun's built-in test runner.

```typescript
// test/unit/myFeature.test.ts
import { test, expect } from "bun:test";

test("my function works correctly", () => {
  expect(myFunction(1, 2)).toBe(3);
});
```

### Integration Tests

Integration tests spawn actual processes:

```typescript
import { $ } from "bun";

test("CLI starts successfully", async () => {
  const proc = $`bun run src/main.tsx --version`;
  const stdout = await proc.text();
  expect(stdout).toContain("2.1.");
});
```

### Test Fixtures

Fixtures in `test/fixtures/`:
- Sample session files
- Mock API responses
- Test repositories

### Running Tests in Watch Mode

```bash
bun test --watch
```

## Debugging

### Debug Flags

```bash
# Enable debug logging
DEBUG=1 bun run src/main.tsx session

# Verbose output
bun run src/main.tsx session --verbose

# Debug specific module
DEBUG=provider:anthropic bun run src/main.tsx session
```

### Log Files

Logs are written to:
- **STDOUT/STDERR** — Terminal output
- **Session transcripts** — `~/.claude/sessions/{id}.txt`
- **Crash logs** — `~/.claude/crash-logs/`

### Inspecting State

In the TUI, press `Ctrl+P` (or `/`) to open command palette, then use:
- `/status` — Show internal state
- `/doctor` — Run diagnostics
- `/context` — View context window usage

### Remote Debugging

Use Node.js inspector (when using Node instead of Bun):

```bash
node --inspect-brk src/main.tsx session
```

Then attach Chrome DevTools to `ws://localhost:9229`.

## Performance Profiling

```bash
# CPU profiling
node --cpu-prof src/main.tsx session

# Heap snapshot
node --heapsnapshot-near-heap-limit=10 src/main.tsx session
```

Profile files output to current directory. Analyze with Chrome DevTools or ` clinic `.

## Commit Guidelines

### Commit Message Format

```
[type](scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `style` — Formatting changes (no code change)
- `refactor` — Code restructuring
- `perf` — Performance improvements
- `test` — Test additions/changes
- `chore` — Build process, tooling
- `revert` — Revert commit

**Scopes:**
- `provider` — AI providers
- `command` — Slash commands
- `tool` — Tools
- `ui` — User interface
- `permissions` — Permissions system
- `mcp` — MCP integration
- `plugin` — Plugin system
- `bridge` — Bridge mode
- `session` — Session management
- `config` — Configuration

**Examples:**
```
feat(provider): add OpenRouter provider support
fix(command): handle null input in /model picker
docs(readme): update API key setup instructions
perf(tools): lazy-load file grammar on first use
```

### Conventional Commits

We follow [conventional commits](https://www.conventionalcommits.org/). This enables:
- Automatic changelog generation
- Semantic versioning inference
- Clear history

## Code Style

### TypeScript

- **Strict mode** — Enabled in `tsconfig.json`
- **No `any`** — Use `unknown` or specific types
- **Exported types** — Public API should have type declarations
- **No `console.log`** — Use `debug()` from `debug` library

### React/Ink

- **Functional components** — No class components
- **Hooks** — Use hooks for state, effects
- **Props interfaces** — Always define prop types

### Error Handling

- **Try/catch** for async operations
- **Graceful degradation** — Don't crash on single tool failure
- **User-friendly messages** — Explain what went wrong & how to fix

### Imports

```typescript
// Node built-ins
import { readFile } from "fs/promises";

// Third-party
import { z } from "zod";
import { Box, Text } from "ink";

// Internal - absolute paths
import { ProviderRegistry } from "@/services/ai/providerRegistry.ts";
```

### File Organization

- One export per file (unless closely related)
- Index files for barrel exports
- Co-locate tests: `file.ts` next to `file.test.ts`

## Release Process

Releases are automated via GitHub Actions:

1. **Version bump** — `bun run scripts/bump-version.ts [major|minor|patch]`
2. **Changelog** — Auto-generated from commit messages
3. **Build** — `bun run build`
4. **Publish** — `npm publish` (for npm distribution)
5. **GitHub Release** — Create release with assets
6. **Update documentation** — Auto-updates on merge to main

## Troubleshooting Development

### Build fails with "module not found"

```bash
# Clear Bun cache
bun pm cache rm

# Reinstall
rm -rf node_modules
bun install
```

### Tests failing intermittently

Check for race conditions. Use `--bail` to stop on first failure:

```bash
bun test --bail
```

### Type errors after dependency update

Some packages may need `@types/` packages. Check DefinitelyTyped or use `any` as temporary:

```typescript
// @ts-expect-error - waiting for type updates
const something = library.anything;
```

### TUI rendering glitches

May be terminal incompatibility. Try:
- `TERM=xterm-256color` — Standard 256-color mode
- `TERM=xterm` — Basic mode
- Disable font ligatures
- Update terminal emulator

### Permissions not working

Check effective permissions:

```bash
bun run src/main.tsx --doctor
```

### Plugin not loading

Check plugin logs:

```bash
# Enable plugin debug logging
DEBUG=plugin:* bun run src/main.tsx session
```

## Resources

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [React Documentation](https://react.dev/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Zod Documentation](https://zod.dev/)

## Community

- **GitHub Issues** — Bug reports, feature requests
- **GitHub Discussions** — Questions, ideas
- **Discord** — Community chat (invite in README)

## License

Proprietary — See [LICENSE.md](../../LICENSE.md).
