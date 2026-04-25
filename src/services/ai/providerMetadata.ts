import { PROVIDER_REGISTRY } from './providerRegistry.js'
import type { ProviderId } from './providers/ProviderInterface.js'
import type { ProviderCapabilities } from './providerRegistry.js'

export type ProviderMetadata = {
  label: string
  envKey: string
  baseUrl: string
  defaultModel?: string
  defaultModelVerified?: boolean
  note?: string
  capabilities: ProviderCapabilities
}

export const PROVIDER_METADATA: Record<ProviderId, ProviderMetadata> = Object.fromEntries(
  Object.entries(PROVIDER_REGISTRY).map(([providerId, entry]) => [
    providerId,
    {
      label: entry.label,
      envKey: entry.envKey,
      baseUrl: entry.defaultBaseUrl,
      defaultModel: entry.defaultModel,
      defaultModelVerified: entry.defaultModelVerified,
      note: entry.note,
      capabilities: entry.capabilities,
    },
  ]),
) as Record<ProviderId, ProviderMetadata>
