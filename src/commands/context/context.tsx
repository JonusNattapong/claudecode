import type * as React from 'react';
import { Box, Text } from '../../ink.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
import type { Message } from '../../types/message.js';
import { collectContextData } from './context-noninteractive.js';

type ContextStatsProps = {
  data: any;
  onClose?: () => void;
};

type UsageItem = {
  key: string;
  label: string;
  tokens: number;
  color: string;
};

type DetailItem = {
  name: string;
  path?: string;
  tokens: number;
};

const CELL = '◉';
const GRID_COLUMNS = 10;
const GRID_ROWS = 8;
const GRID_SIZE = GRID_COLUMNS * GRID_ROWS;

const COLORS = {
  prompt: '#9ca3af',
  tools: '#9ca3af',
  mcp: '#22d3ee',
  toolUse: '#818cf8',
  memory: '#fb923c',
  messages: '#c084fc',
  overflow: '#f87171',
};

function readNumber(data: any, paths: string[], fallback = 0): number {
  for (const path of paths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

function readString(data: any, paths: string[], fallback = ''): string {
  for (const path of paths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return fallback;
}

function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens)) return '0';

  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}m`;
  }

  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }

  return String(Math.round(tokens));
}

function formatPercent(tokens: number, limit: number): string {
  if (!limit) return '0%';
  return `${((tokens / limit) * 100).toFixed(1)}%`;
}

function detectLimit(data: any, model: string): number {
  const explicit = readNumber(data, [
    'contextLimit',
    'maxContextTokens',
    'modelLimit',
    'limit',
    'maxTokens',
  ]);

  if (explicit > 0) return explicit;

  const lower = model.toLowerCase();

  if (lower.includes('opus')) return 200_000;
  if (lower.includes('sonnet')) return 200_000;
  if (lower.includes('haiku')) return 200_000;

  return 200_000;
}

function buildUsage(data: any): UsageItem[] {
  return [
    {
      key: 'systemPrompt',
      label: 'System prompt',
      color: COLORS.prompt,
      tokens: readNumber(data, [
        'systemPromptTokens',
        'systemPrompt',
        'categories.systemPrompt.tokens',
        'breakdown.systemPrompt.tokens',
        'usage.systemPrompt.tokens',
      ]),
    },
    {
      key: 'systemTools',
      label: 'System tools',
      color: COLORS.tools,
      tokens: readNumber(data, [
        'systemToolsTokens',
        'systemTools',
        'categories.systemTools.tokens',
        'breakdown.systemTools.tokens',
        'usage.systemTools.tokens',
      ]),
    },
    {
      key: 'mcpTools',
      label: 'MCP tools',
      color: COLORS.mcp,
      tokens: readNumber(data, [
        'mcpToolsTokens',
        'mcpTools',
        'categories.mcpTools.tokens',
        'breakdown.mcpTools.tokens',
        'usage.mcpTools.tokens',
      ]),
    },
    {
      key: 'toolUse',
      label: 'Tool use & results',
      color: COLORS.toolUse,
      tokens: readNumber(data, [
        'toolUseTokens',
        'toolUseAndResultsTokens',
        'toolUseAndResults',
        'toolResultsTokens',
        'categories.toolUse.tokens',
        'categories.toolUseAndResults.tokens',
        'breakdown.toolUse.tokens',
        'breakdown.toolUseAndResults.tokens',
        'usage.toolUse.tokens',
      ]),
    },
    {
      key: 'memoryFiles',
      label: 'Memory files',
      color: COLORS.memory,
      tokens: readNumber(data, [
        'memoryFilesTokens',
        'memoryTokens',
        'memoryFiles',
        'categories.memoryFiles.tokens',
        'breakdown.memoryFiles.tokens',
        'usage.memoryFiles.tokens',
      ]),
    },
    {
      key: 'messages',
      label: 'Messages',
      color: COLORS.messages,
      tokens: readNumber(data, [
        'messageTokens',
        'messagesTokens',
        'messages',
        'categories.messages.tokens',
        'breakdown.messages.tokens',
        'usage.messages.tokens',
      ]),
    },
  ];
}

function normalizeDetails(value: any): DetailItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return {
          name: item,
          tokens: 0,
        };
      }

      const path = item.path ?? item.filePath ?? item.location ?? item.id;
      const name = item.name ?? item.label ?? path ?? 'Unknown';

      return {
        name,
        path,
        tokens:
          item.tokens ??
          item.tokenCount ??
          item.estimatedTokens ??
          item.count ??
          0,
      };
    })
    .filter((item) => item.name);
}

function readDetails(data: any, paths: string[]): DetailItem[] {
  for (const path of paths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    const details = normalizeDetails(value);

    if (details.length > 0) {
      return details;
    }
  }

  return [];
}

function makeCells(items: UsageItem[], total: number, limit: number): UsageItem[] {
  const cells: UsageItem[] = [];

  for (const item of items) {
    if (item.tokens <= 0) continue;

    const count = Math.max(1, Math.round((item.tokens / Math.max(total, limit)) * GRID_SIZE));

    for (let i = 0; i < count; i++) {
      cells.push(item);
    }
  }

  while (cells.length < GRID_SIZE) {
    cells.push({
      key: 'empty',
      label: 'Empty',
      tokens: 0,
      color: '#52525b',
    });
  }

  if (cells.length > GRID_SIZE) {
    cells.length = GRID_SIZE;
  }

  if (total > limit) {
    const overflowCells = Math.min(
      GRID_SIZE,
      Math.max(1, Math.round(((total - limit) / limit) * GRID_SIZE)),
    );

    for (let i = GRID_SIZE - overflowCells; i < GRID_SIZE; i++) {
      cells[i] = {
        key: 'overflow',
        label: 'Overflow',
        tokens: total - limit,
        color: COLORS.overflow,
      };
    }
  }

  return cells;
}

function TokenGrid({
  items,
  total,
  limit,
}: {
  items: UsageItem[];
  total: number;
  limit: number;
}): React.ReactNode {
  const cells = makeCells(items, total, limit);
  const rows = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    const rowCells = cells.slice(row * GRID_COLUMNS, row * GRID_COLUMNS + GRID_COLUMNS);

    rows.push(
      <Box key={row} flexDirection="row">
        {row === 0 ? (
          <Text color="#a1a1aa">└ </Text>
        ) : (
          <Text>  </Text>
        )}

        {rowCells.map((cell, index) => (
          <Text key={`${row}-${index}`} color={cell.color}>
            {CELL}{' '}
          </Text>
        ))}
      </Box>,
    );
  }

  return (
    <Box flexDirection="column">
      {rows}

      <Box marginLeft={2} marginTop={1}>
        <Text color="#a1a1aa">
          tokens ({Math.round((total / limit) * 100)}%)
        </Text>
      </Box>
    </Box>
  );
}

function UsageLine({
  item,
  limit,
}: {
  item: UsageItem;
  limit: number;
}): React.ReactNode {
  return (
    <Box>
      <Text color={item.color}>{CELL} </Text>
      <Text color="#d4d4d8">{item.label}: </Text>
      <Text color="#71717a">
        {formatTokens(item.tokens)} tokens ({formatPercent(item.tokens, limit)})
      </Text>
    </Box>
  );
}

function DetailSection({
  title,
  command,
  items,
}: {
  title: string;
  command: string;
  items: DetailItem[];
}): React.ReactNode {
  if (items.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={2}>
      <Box>
        <Text color="#d4d4d8" bold>
          {title}
        </Text>
        <Text color="#71717a"> · </Text>
        <Text color="#a1a1aa">{command}</Text>
      </Box>

      {items.map((item, index) => (
        <Box key={`${item.name}-${index}`} marginLeft={1}>
          <Text color="#71717a">└ </Text>
          <Text color="#a1a1aa">{item.name}</Text>

          {item.path && item.path !== item.name ? (
            <Text color="#71717a"> ({item.path})</Text>
          ) : null}

          {item.tokens > 0 ? (
            <Text color="#71717a">: {formatTokens(item.tokens)} tokens</Text>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function ContextStats({
  data,
}: ContextStatsProps): React.ReactNode {
  const model = readString(data, [
    'model',
    'modelName',
    'mainLoopModel',
    'metadata.model',
  ], 'claude-opus-4-1-20250805');

  const limit = detectLimit(data, model);
  const usage = buildUsage(data);

  const calculatedTotal = usage.reduce((sum, item) => sum + item.tokens, 0);

  const total = readNumber(data, [
    'totalTokens',
    'tokens',
    'usedTokens',
    'contextTokens',
    'currentTokens',
  ], calculatedTotal);

  const memoryFiles = readDetails(data, [
    'memoryFileDetails',
    'memoryFilesDetail',
    'memoryFilesDetails',
    'memoryFilesList',
    'files.memory',
    'details.memoryFiles',
  ]);

  const mcpTools = readDetails(data, [
    'mcpToolDetails',
    'mcpToolsDetails',
    'mcpToolsList',
    'tools.mcp',
    'details.mcpTools',
  ]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row">
        <Box width={33}>
          <TokenGrid items={usage} total={total} limit={limit} />
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          <Text color="#d4d4d8" bold>
            Context Usage
          </Text>

          <Box>
            <Text color="#71717a">
              {model} · {formatTokens(total)}/{formatTokens(limit)}
            </Text>
          </Box>

          <Box height={1} />

          {usage.map((item) => (
            <UsageLine key={item.key} item={item} limit={limit} />
          ))}
        </Box>
      </Box>

      <DetailSection
        title="Memory files"
        command="/memory"
        items={memoryFiles}
      />

      <DetailSection
        title="MCP tools"
        command="/mcp"
        items={mcpTools}
      />
    </Box>
  );
}

export const call: LocalJSXCommandCall = async (onDone, context, _args) => {
  const messages: Message[] = (context as any).messages ?? context.getAppState().messages ?? [];

  const contextData = await collectContextData({
    messages,
    getAppState: context.getAppState,
    options: {
      mainLoopModel: context.options.mainLoopModel,
      tools: context.options.tools,
      agentDefinitions: context.options.agentDefinitions,
      customSystemPrompt: context.options.customSystemPrompt,
      appendSystemPrompt: context.options.appendSystemPrompt,
    },
  });

  // Map ContextData categories array to flat object keys ContextStats expects
  const catMap: Record<string, { tokens: number }> = {};
  for (const cat of contextData.categories) {
    const key = cat.name.replace(/[\s&]+/g, '');
    catMap[key] = { tokens: cat.tokens };
  }

  const data = {
    model: contextData.model,
    totalTokens: contextData.totalTokens,
    categories: catMap,
    memoryFileDetails: contextData.memoryFiles,
    mcpToolDetails: contextData.mcpTools,
  };

  return (
    <Dialog
      title="Context Usage"
      onCancel={() => onDone('Context dismissed', { display: 'system' })}
      inputGuide={() => <Text>Press Esc to close</Text>}
    >
      <ContextStats data={data} />
    </Dialog>
  );
};