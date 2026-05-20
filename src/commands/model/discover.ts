/**
 * /model discover — fetch live model lists from configured provider APIs
 *
 * Usage:
 *   /model discover          — fetch all configured providers
 *   /model discover <pid>    — fetch specific provider
 *   /model discover --stats  — show cache status
 */

import { ModelDiscoveryService } from '../../services/ai/ModelDiscoveryService.js';

export async function discoverModels(providerId?: string): Promise<string> {
  const service = ModelDiscoveryService.getInstance();
  const now = Date.now();

  if (providerId === '--stats') {
    const age = service.getCacheAge();
    const configured = service.getConfiguredProviders();
    const cached = service.getAllCachedModels();
    const totalModels = cached.reduce((sum, r) => sum + r.models.length, 0);

    return [
      `Cache: ${age ?? 'empty'} | ${cached.length} providers | ${totalModels} models cached`,
      `Configured providers (keys in env): ${configured.length}`,
      configured.length ? `  ${configured.join(', ')}` : '  (none)',
      '',
      'Cached providers:',
      ...cached.map(r =>
        `  ${r.providerId.padEnd(16)} ${String(r.models.length).padStart(4)} models  ${r.error ? `(${r.error})` : `fetched ${formatTime(r.fetchedAt - now)}`}`
      ),
    ].join('\n');
  }

  if (providerId) {
    const result = await service.refreshProvider(providerId);
    if (result.error) {
      return `Discovery failed for ${providerId}: ${result.error}`;
    }
    return formatDiscoveryResult(result);
  }

  // Fetch all
  const results = await service.refreshAll();
  return results.map(formatDiscoveryResult).join('\n');
}

function formatDiscoveryResult(r: import('../../services/ai/ModelDiscoveryService.js').DiscoveryResult): string {
  const header = `${r.providerLabel} (${r.providerId}) — ${r.modelsUrl}`;
  if (r.error) return `${header}\n  ERROR: ${r.error}`;

  const lines = [header];
  for (const m of r.models.slice(0, 20)) {
    const ctx = m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}K ctx` : '';
    const price = m.pricing?.prompt ? `$${m.pricing.prompt}/M` : '';
    const tags = [
      m.supportsTools ? 'tools' : '',
      m.supportsVision ? 'vision' : '',
      m.reasoning ? 'reason' : '',
    ].filter(Boolean).join(',');
    lines.push(`  ${m.id.padEnd(50)} ${ctx.padEnd(12)} ${price.padEnd(12)} ${tags}`);
  }
  if (r.models.length > 20) {
    lines.push(`  ... and ${r.models.length - 20} more`);
  }
  return lines.join('\n');
}

function formatTime(ms: number): string {
  const m = Math.floor(Math.abs(ms) / 60000);
  return m < 1 ? 'just now' : `${m}m ago`;
}
