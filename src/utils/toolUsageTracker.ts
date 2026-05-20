/**
 * Tool usage tracker — records call count and estimated token cost per tool.
 */

type ToolUsage = {
  name: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastCalledAt: number;
};

const usageMap = new Map<string, ToolUsage>();

export function recordToolUsage(name: string, inputTokens = 0, outputTokens = 0): void {
  const existing = usageMap.get(name) ?? {
    name,
    callCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    lastCalledAt: 0,
  };
  existing.callCount++;
  existing.totalInputTokens += inputTokens;
  existing.totalOutputTokens += outputTokens;
  existing.lastCalledAt = Date.now();
  usageMap.set(name, existing);
}

export function getAllToolUsage(): ToolUsage[] {
  return [...usageMap.values()].sort((a, b) => b.callCount - a.callCount);
}

export function getToolUsage(name: string): ToolUsage | undefined {
  return usageMap.get(name);
}

export function resetToolUsage(): void {
  usageMap.clear();
}

export function formatLastCalled(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
