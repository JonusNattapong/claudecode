import { getSettingsForSource } from '../settings/settings.js';

/**
 * Check if a plugin is force-disabled by org policy (managed-settings.json).
 * Policy-blocked plugins cannot be installed or enabled by the user at any
 * scope. Used as the single source of truth for policy blocking across the
 * install chokepoint, enable op, and UI filters.
 */
export function isPluginBlockedByPolicy(pluginId: string): boolean {
  const policyEnabled = getSettingsForSource('policySettings')?.enabledPlugins;
  return policyEnabled?.[pluginId] === false;
}

/**
 * Get the allowed marketplaces for plugin suggestions from managed settings.
 * Returns null if no restrictions are in place.
 */
export function getPluginSuggestionMarketplaces(): string[] | null {
  const policySettings = getSettingsForSource('policySettings');
  return policySettings?.pluginSuggestionMarketplaces ?? null;
}

/**
 * Check if a marketplace is allowed for plugin suggestions.
 */
export function isMarketplaceAllowedForSuggestions(marketplaceName: string): boolean {
  const allowed = getPluginSuggestionMarketplaces();
  if (!allowed) {
    return true; // No restrictions
  }
  return allowed.includes(marketplaceName);
}
