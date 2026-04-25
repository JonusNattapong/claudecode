# API Reference — Current Implementation

The current implementation supports multiple AI providers through a provider abstraction layer in `src/services/ai/`. Supported providers include Anthropic Claude, OpenAI, Google Gemini, OpenRouter, KiloCode, Ollama, and other OpenAI-compatible APIs.

## Current Architecture

The system uses a provider abstraction layer with `ProviderInterface` implementations for each provider:
- `AnthropicProvider` - Native Anthropic SDK integration
- `OpenAIProvider` - Native OpenAI SDK integration
- `GoogleProvider` - Native Google Gemini SDK integration
- `OpenAICompatibleProvider` - Base class for OpenAI-compatible providers
- Provider-specific adapters: `OllamaProvider`, `OpenRouterProvider`

The main API client is in `src/services/api/client.ts` with provider registry in `src/services/ai/providerRegistry.ts`.

### Message Types

```typescript
// Based on @anthropic-ai/sdk types

import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageStreamParams,
  BetaStopReason,
  BetaToolUnion,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isDangerous?: boolean;
  permissions?: string[];
}
```

### API Client

The main client function creates an Anthropic SDK instance:

```typescript
// src/services/api/client.ts

import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';

export async function getAnthropicClient({
  apiKey,
  maxRetries,
  model,
  fetchOverride,
  source,
}: {
  apiKey?: string;
  maxRetries: number;
  model?: string;
  fetchOverride?: ClientOptions['fetch'];
  source?: string;
}): Promise<Anthropic> {
  // Returns Anthropic SDK client
  // Supports: Direct API, AWS Bedrock, Azure Foundry, Google Vertex AI
}
```

### Supported Deployment Options

The Anthropic client supports multiple deployment options through environment variables:

#### Direct API (Default)
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

#### AWS Bedrock
```bash
export CLAUDE_CODE_USE_BEDROCK=true
# Uses AWS credentials from environment or ~/.aws/credentials
```

#### Azure Foundry (Azure OpenAI)
```bash
export CLAUDE_CODE_USE_FOUNDRY=true
export ANTHROPIC_FOUNDRY_RESOURCE="your-resource"
# Or: export ANTHROPIC_FOUNDRY_BASE_URL="https://your-resource.services.ai.azure.com"
# Authentication: ANTHROPIC_FOUNDRY_API_KEY or Azure AD
```

#### Google Vertex AI
```bash
export CLAUDE_CODE_USE_VERTEX=true
export ANTHROPIC_VERTEX_PROJECT_ID="your-gcp-project"
# Uses Google Application Default Credentials
```

### Provider Configuration

The runtime supports multiple providers. Configure via CLI or environment variables:

```bash
# Configure provider and model
claude --provider openai --model gpt-5.5
claude --provider anthropic --model claude-sonnet-4-6
claude --provider google --model gemini-3.1-flash
```

Available providers:
- **Anthropic**: Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 (native SDK)
- **OpenAI**: GPT-5.5, GPT-5.5 Pro (native SDK)
- **Google**: Gemini 3.1 Pro/Flash via native SDK or OpenAI-compatible endpoint
- **OpenRouter**: 100+ models (OpenAI-compatible)
- **KiloCode**: KiloCode AI Gateway with 500+ models
- **Ollama**: Local models (OpenAI-compatible, no API key required)
- **Cline**: Cline API (OpenAI-compatible)
- **OpenCode**: OpenCode AI Gateway (OpenAI-compatible)
- **Groq**: Llama 3.3, Mixtral (OpenAI-compatible)
- **xAI**: Grok 4, Grok 4.20 (OpenAI-compatible)
- **Mistral**: Mistral Large, Small (OpenAI-compatible)

Use `/provider` command in CLI for interactive provider management.

### Tool System

The system includes 40+ built-in tools that can be used by the AI:

```typescript
import { getTools } from './tools.js';

const tools = getTools(permissionContext);
// Returns: Array of Tool objects with execute methods
```

Available tools include:
- File operations (Read, Write, Edit)
- Shell execution (Bash, PowerShell)
- Search (Grep, Glob, WebSearch)
- Git operations
- Agent management
- MCP server integration
- And more...

### Multi-Provider Support (Implemented)

The codebase now includes full multi-provider support through a provider abstraction layer:

- Provider registry in `src/services/ai/providerRegistry.ts`
- Provider interface: `src/services/ai/providers/ProviderInterface.ts`
- Provider-specific implementations in `src/services/ai/providers/`
- Streaming support with SSE parsing for OpenAI-compatible providers
- Model discovery with caching and fallback to hardcoded registry
- Normalized error handling, usage tracking, and tool call parsing

### Provider Capabilities

Each provider has declared capabilities in the registry:
- **Tool calling**: Native, JSON-text fallback, or none
- **Streaming**: Full, partial, or none
- **Vision**: Supported or not
- **Reasoning**: Supported or not
- **Context length**: Varies by model