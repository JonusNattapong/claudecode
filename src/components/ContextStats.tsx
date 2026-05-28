import type React from "react";
import { useMemo } from "react";
import { Box, Text, useInput } from "../ink.js";
import type { LocalJSXCommandOnDone } from "../types/command.js";
import type { ContextData } from "../utils/analyzeContext.js";
import { formatTokens } from "../utils/format.js";

type Props = {
  data: ContextData;
  onClose: LocalJSXCommandOnDone;
};

type Category = ContextData["categories"][number];

type UsageRow = {
  key: string;
  label: string;
  tokens: number;
  color: string;
  marker: string;
  priority: number;
};

type GridCell = {
  char: string;
  color: string;
};

const GRID_COLUMNS = 10;
const GRID_ROWS = 10;
const GRID_CELLS = GRID_COLUMNS * GRID_ROWS;
const RESERVED_CATEGORY_NAME = "Autocompact buffer";

const CATEGORY_ORDER: Record<string, number> = {
  "System prompt": 10,
  "System tools": 20,
  "Custom agents": 30,
  "Memory files": 40,
  Skills: 50,
  Messages: 60,
  "Free space": 70,
  [RESERVED_CATEGORY_NAME]: 80,
};

const CATEGORY_COLORS: Record<string, string> = {
  "System prompt": "#9CA3AF",
  "System tools": "#9CA3AF",
  "Custom agents": "#B7C4FF",
  "Memory files": "#F59E7A",
  Skills: "#FBBF24",
  Messages: "#7C3AED",
  "Free space": "#9CA3AF",
  [RESERVED_CATEGORY_NAME]: "#9CA3AF",
};

function canonicalCategoryName(name: string): string {
  switch (name) {
    case "[ANT-ONLY] System tools":
    case "System tools (deferred)":
      return "System tools";
    case "MCP tools":
    case "MCP tools (deferred)":
      return "MCP tools";
    default:
      return name;
  }
}

function displayModelName(modelId: string): string {
  const normalized = modelId.toLowerCase();

  if (normalized.includes("sonnet") && normalized.includes("4-6")) {
    return "Sonnet 4.6";
  }

  if (normalized.includes("sonnet")) {
    return "Sonnet";
  }

  if (normalized.includes("opus")) {
    return "Opus";
  }

  if (normalized.includes("haiku")) {
    return "Haiku";
  }

  return "Context Window";
}

function getModelInfo(data: ContextData): { title: string; id: string } {
  const rawData = data as Record<string, unknown>;
  const explicitTitle =
    rawData.modelDisplayName ?? rawData.displayModelName ?? rawData.modelTitle;
  const explicitId =
    rawData.modelId ??
    rawData.model ??
    rawData.modelName ??
    rawData.currentModel;

  const id =
    typeof explicitId === "string" && explicitId.length > 0
      ? explicitId
      : "active model";
  const title =
    typeof explicitTitle === "string" && explicitTitle.length > 0
      ? explicitTitle
      : displayModelName(id);

  return { title, id };
}

const CATEGORY_MARKERS: Record<string, string> = {
  "System prompt": "⬡",
  "System tools": "⬢",
  "Custom agents": "⬣",
  "Memory files": "◆",
  Skills: "◇",
  Messages: "●",
  "MCP tools": "◈",
  "Free space": "▢",
  [RESERVED_CATEGORY_NAME]: "▣",
};

function markerFor(label: string): string {
  return CATEGORY_MARKERS[label] ?? "◉";
}

function colorFor(category: Category, label: string): string {
  return CATEGORY_COLORS[label] ?? category.color ?? "#9CA3AF";
}

function buildUsageRows(
  categories: Category[],
  freeTokens: number,
): UsageRow[] {
  const rowsByLabel = new Map<string, UsageRow>();

  for (const category of categories) {
    if (category.tokens <= 0 || category.isDeferred) {
      continue;
    }

    const label = canonicalCategoryName(category.name);
    const current = rowsByLabel.get(label);

    rowsByLabel.set(label, {
      key: label,
      label,
      tokens: (current?.tokens ?? 0) + category.tokens,
      color: current?.color ?? colorFor(category, label),
      marker: markerFor(label),
      priority: CATEGORY_ORDER[label] ?? 500,
    });
  }

  if (!rowsByLabel.has("Free space") && freeTokens > 0) {
    rowsByLabel.set("Free space", {
      key: "Free space",
      label: "Free space",
      tokens: freeTokens,
      color: CATEGORY_COLORS["Free space"],
      marker: markerFor("Free space"),
      priority: CATEGORY_ORDER["Free space"],
    });
  }

  return Array.from(rowsByLabel.values()).sort(
    (a, b) => a.priority - b.priority || a.label.localeCompare(b.label),
  );
}

function buildGrid(rows: UsageRow[], maxTokens: number): GridCell[] {
  const cells: GridCell[] = Array.from({ length: GRID_CELLS }, () => ({
    char: "▢",
    color: CATEGORY_COLORS["Free space"],
  }));

  if (maxTokens <= 0) {
    return cells;
  }

  let cursor = 0;
  let cumulativeTokens = 0;

  for (const row of rows) {
    cumulativeTokens += row.tokens;
    const nextCursor = Math.min(
      GRID_CELLS,
      Math.round((cumulativeTokens / maxTokens) * GRID_CELLS),
    );

    for (let index = cursor; index < nextCursor; index += 1) {
      cells[index] = {
        char: row.marker,
        color: row.color,
      };
    }

    cursor = nextCursor;
  }

  return cells;
}

function CategoryUsageRow({
  row,
  maxTokens,
}: {
  row: UsageRow;
  maxTokens: number;
}): React.ReactNode {
  const percentage = maxTokens > 0 ? (row.tokens / maxTokens) * 100 : 0;

  return (
    <Box flexDirection="row">
      <Text color={row.color}>{row.marker}</Text>
      <Text> </Text>
      <Text bold>{row.label}:</Text>
      <Text dimColor> {formatTokens(row.tokens)} tokens </Text>
      <Text dimColor>({percentage.toFixed(1)}%)</Text>
    </Box>
  );
}

function UsageGrid({ cells }: { cells: GridCell[] }): React.ReactNode {
  return (
    <Box flexDirection="column">
      {Array.from({ length: GRID_ROWS }).map((_, rowIndex) => {
        const rowCells = cells.slice(
          rowIndex * GRID_COLUMNS,
          (rowIndex + 1) * GRID_COLUMNS,
        );

        return (
          <Box key={rowIndex} flexDirection="row" gap={1}>
            {rowCells.map((cell, cellIndex) => (
              <Text key={`${rowIndex}-${cellIndex}`} color={cell.color}>
                {cell.char}
              </Text>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

export function ContextStats({ data, onClose }: Props): React.ReactNode {
  const { categories, totalTokens, rawMaxTokens, percentage } = data;

  useInput((input, key) => {
    if (
      key.escape ||
      input === "q" ||
      (key.ctrl && (input === "c" || input === "d"))
    ) {
      onClose("Context usage dismissed", { display: "system" });
    }
  });

  const freeTokens = useMemo(() => {
    const freeCategory = categories.find(
      (category) => category.name === "Free space",
    );
    return freeCategory?.tokens ?? Math.max(rawMaxTokens - totalTokens, 0);
  }, [categories, rawMaxTokens, totalTokens]);

  const usageRows = useMemo(
    () => buildUsageRows(categories, freeTokens),
    [categories, freeTokens],
  );
  const gridCells = useMemo(
    () => buildGrid(usageRows, rawMaxTokens),
    [usageRows, rawMaxTokens],
  );
  const modelInfo = useMemo(() => getModelInfo(data), [data]);

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Box flexDirection="row">
        <Text dimColor>└ </Text>
        <Text bold>Context Usage</Text>
      </Box>

      <Box flexDirection="row" gap={4} marginLeft={2}>
        <UsageGrid cells={gridCells} />

        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            <Text bold>{modelInfo.title}</Text>
            <Text dimColor>{modelInfo.id}</Text>
            <Text dimColor>
              {formatTokens(totalTokens)}/{formatTokens(rawMaxTokens)} tokens (
              {percentage.toFixed(0)}%)
            </Text>
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text italic dimColor>
              Estimated usage by category
            </Text>

            <Box flexDirection="column" marginTop={1}>
              {usageRows.map((row) => (
                <CategoryUsageRow
                  key={row.key}
                  row={row}
                  maxTokens={rawMaxTokens}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box marginLeft={2}>
        <Text dimColor>Esc/q close</Text>
      </Box>
    </Box>
  );
}
