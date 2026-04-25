import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ProviderId, ProviderInitOptions, ProviderInterface } from './providers/ProviderInterface.js'
import {
  createProviderInstance,
  DEFAULT_PROVIDER,
  getProviderOptions,
  PROVIDER_REGISTRY,
} from './providerRegistry.js'

const PROVIDER_CONFIG_PATH = join(process.env.HOME || process.env.USERPROFILE || '', '.claude-code-provider.json')

export type ProviderConfigFile = {
  provider?: ProviderId
  model?: string
  apiKeys?: Partial<Record<ProviderId, string>>
  providerConfig?: Record<string, unknown>
}

export class ProviderManager {
  private static instance: ProviderManager | null = null
  private cachedConfig: ProviderConfigFile | null = null

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager()
    }
    return ProviderManager.instance
  }

  getProviderConfigPath(): string {
    return PROVIDER_CONFIG_PATH
  }

  invalidateConfigCache(): void {
    this.cachedConfig = null
  }

  getSelectedProviderConfig(forceReload = false): ProviderConfigFile {
    if (this.cachedConfig && !forceReload) {
      return this.cachedConfig
    }

    try {
      const content = readFileSync(this.getProviderConfigPath(), 'utf8')
      this.cachedConfig = JSON.parse(content) as ProviderConfigFile
      return this.cachedConfig
    } catch {
      this.cachedConfig = {}
      return {}
    }
  }

  saveSelectedProviderConfig(config: ProviderConfigFile): void {
    writeFileSync(
      this.getProviderConfigPath(),
      JSON.stringify(config, null, 2),
      'utf8',
    )
    this.cachedConfig = config
  }

  getActiveProviderName(): ProviderId {
    const forcedProvider = process.env.AI_PROVIDER?.toLowerCase() as ProviderId | undefined
    if (forcedProvider && PROVIDER_REGISTRY[forcedProvider]) {
      return forcedProvider
    }

    const config = this.getSelectedProviderConfig(true)
    if (config.provider && PROVIDER_REGISTRY[config.provider]) {
      return config.provider
    }

    return DEFAULT_PROVIDER
  }

  getProvider(provider?: ProviderId): ProviderInterface {
    const providerName = provider ?? this.getActiveProviderName()
    const providerEntry = PROVIDER_REGISTRY[providerName]
    if (!providerEntry) {
      throw new Error(`Unsupported provider: ${providerName}`)
    }
    return providerEntry.provider
  }

  getApiKeyForProvider(provider?: ProviderId): string | undefined {
    const providerName = provider ?? this.getActiveProviderName()
    const providerEntry = PROVIDER_REGISTRY[providerName]
    const config = this.getSelectedProviderConfig(true)
    return config.apiKeys?.[providerName] || process.env[providerEntry.envKey] || undefined
  }

  getBaseUrlForProvider(provider?: ProviderId): string | undefined {
    const config = this.getSelectedProviderConfig(true)
    const providerConfig = config.providerConfig
    if (providerConfig && typeof providerConfig.baseUrl === 'string') {
      return providerConfig.baseUrl
    }
    const providerName = provider ?? this.getActiveProviderName()
    return getProviderOptions(providerName).baseUrl
  }

  getModelForProvider(provider?: ProviderId): string | undefined {
    const config = this.getSelectedProviderConfig(true)
    return config.model
  }

  async createClient(provider?: ProviderId, options: ProviderInitOptions = {}): Promise<unknown> {
    const effectiveProvider = provider ?? this.getActiveProviderName()
    const providerInstance = this.getProvider(effectiveProvider)

    const apiKey = options.apiKey ?? this.getApiKeyForProvider(effectiveProvider)
    const baseUrl = options.baseUrl ?? this.getBaseUrlForProvider(effectiveProvider)
    const model = options.model ?? this.getModelForProvider(effectiveProvider)

    return providerInstance.createClient({
      ...options,
      apiKey,
      baseUrl,
      model,
    })
  }
}
