import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import * as React from 'react'
import { Select } from '../../components/CustomSelect/select.js'
import TextInput from '../../components/TextInput.js'
import { Box, Text } from '../../ink.js'
import { useSetAppState } from '../../state/AppState.js'
import type {
  LocalCommandResult,
  LocalJSXCommandCall,
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import {
  PROVIDER_IDS,
  getProviderRegistryEntry,
  type ProviderRegistryEntry,
} from '../../services/ai/providerRegistry.js'
import { clearProviderModelsCache, fetchProviderModels } from '../../services/ai/providerModels.js'

type SerializableProviderRegistryEntry = Omit<ProviderRegistryEntry, 'provider'>

type ProviderConfig = {
  provider: typeof PROVIDER_IDS[number]
  model: string
  apiKeys?: Partial<Record<typeof PROVIDER_IDS[number], string>>
  providerConfig?: SerializableProviderRegistryEntry
}

const PROVIDER_KEYS = PROVIDER_IDS

type ProviderKey = (typeof PROVIDER_KEYS)[number]

function isProviderKey(provider: string): provider is ProviderKey {
  return PROVIDER_KEYS.includes(provider as ProviderKey)
}

function getProviderInfo(provider: ProviderKey): ProviderRegistryEntry {
  return getProviderRegistryEntry(provider)
}

function getSerializableProviderInfo(
  provider: ProviderKey,
): SerializableProviderRegistryEntry {
  const { provider: _provider, ...serializable } = getProviderInfo(provider)
  return serializable
}

const CONFIG_PATH = join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.claude-code-provider.json',
)

async function loadConfig(): Promise<ProviderConfig | null> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as ProviderConfig
  } catch {
    return null
  }
}

async function saveConfig(config: ProviderConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

function help(): string {
  return [
    'Usage:',
    '  /providers',
    '  /providers list',
    '  /providers key <provider> <api-key>',
    '  /providers set <provider> [model]',
    '  /providers reset',
    '  /providers models <provider>',
    '',
    `Available providers: ${PROVIDER_KEYS.join(', ')}`,
  ].join('\n')
}

async function fetchModels(provider: ProviderKey): Promise<string[]> {
  return (await fetchModelInfos(provider)).map(model => model.id)
}

async function fetchModelInfos(
  provider: ProviderKey,
): Promise<Array<{ id: string; supportsToolCalling: boolean | undefined }>> {
  const models = await fetchProviderModels(provider)
  return models.map(model => ({
    id: model.id,
    supportsToolCalling: model.capabilities.toolCalling !== 'none',
  }))
}

async function providerList(): Promise<string> {
  const config = await loadConfig()
  const entries = await Promise.all(
    PROVIDER_KEYS.map(async provider => {
      const info = getProviderInfo(provider)
      const hasKey = Boolean(config?.apiKeys?.[provider] || process.env[info.envKey])

      try {
        const models = await fetchModelInfos(provider)
        const visible = models
          .slice(0, 12)
          .map(model =>
            `${model.id}${model.supportsToolCalling === false ? ' (no tools)' : ''}`,
          )
          .join('\n    ')
        const suffix =
          models.length > 12 ? `\n    ... and ${models.length - 12} more` : ''

        return [
          `${provider} (${info.label})`,
          `  key: ${hasKey ? 'saved' : info.isLocal ? 'not required' : `missing ${info.envKey}`}`,
          `  models from API (${models.length}):`,
          `    ${visible || '(none returned)'}`,
          suffix,
        ]
          .filter(Boolean)
          .join('\n')
      } catch (error) {
        return [
          `${provider} (${info.label})`,
          `  key: ${hasKey ? 'saved' : info.isLocal ? 'not required' : `missing ${info.envKey}`}`,
          `  models: unavailable (${(error as Error).message})`,
        ].join('\n')
      }
    }),
  )

  return entries.join('\n\n')
}

type ProviderCommandRunResult = {
  result: LocalCommandResult
  appliedConfig?: ProviderConfig
}

function getDefaultModelForProvider(provider: ProviderKey): string {
  return getProviderInfo(provider).defaultModel ?? ''
}

function applyProviderSelectionToSession(
  setAppState: ReturnType<typeof useSetAppState>,
  config: Pick<ProviderConfig, 'model'>,
): void {
  if (!config.model) {
    return
  }

  setAppState(prev => ({
    ...prev,
    mainLoopModel: config.model,
    mainLoopModelForSession: null,
  }))
}

async function runProviderCommand(args: string): Promise<ProviderCommandRunResult> {
  const parts = args.trim() ? args.trim().split(/\s+/) : []
  const [subcommand = 'get', providerArg, ...modelParts] = parts
  const command = subcommand.toLowerCase()

  if (command === 'help' || command === '--help' || command === '-h') {
    return { result: { type: 'text', value: help() } }
  }

  if (command === 'list' || command === '--list' || command === '-l') {
    return { result: { type: 'text', value: await providerList() } }
  }

  if (command === 'get' || command === '--get' || command === '-g') {
    const config = await loadConfig()
    if (!config) {
      return {
        result: {
          type: 'text',
          value: `No provider configuration found.\n\n${help()}`,
        },
      }
    }
    return {
      result: {
        type: 'text',
        value: `Current provider: ${config.provider}\nCurrent model: ${config.model}\nSaved API keys: ${Object.keys(config.apiKeys ?? {}).join(', ') || 'none'}\nConfig: ${CONFIG_PATH}`,
      },
    }
  }

  if (command === 'key') {
    const provider = providerArg?.toLowerCase()
    if (!provider || !isProviderKey(provider)) {
      return {
        result: {
          type: 'text',
          value: `Unknown provider: ${provider ?? '(missing)'}\n\n${help()}`,
        },
      }
    }
    const setIndex = modelParts.findIndex(part => part.toLowerCase() === 'set')
    const apiKeyParts = setIndex === -1 ? modelParts : modelParts.slice(0, setIndex)
    const apiKey = apiKeyParts.join(' ')
    if (!apiKey) {
      return {
        result: {
          type: 'text',
          value: `Missing API key.\n\nUsage: /providers key ${provider} <api-key>`,
        },
      }
    }
    const setParts = setIndex === -1 ? [] : modelParts.slice(setIndex + 1)
    const setProvider = setParts[0]?.toLowerCase()
    const setModel = setParts.slice(1).join(' ')
    if (setParts.length > 0 && (!setProvider || !isProviderKey(setProvider))) {
      return {
        result: {
          type: 'text',
          value: `Unknown provider in set: ${setProvider ?? '(missing)'}`,
        },
      }
    }

    const currentConfig = await loadConfig()
    const nextProvider = (setProvider ?? currentConfig?.provider ?? provider) as ProviderKey
    const nextModel =
      setModel ||
      (nextProvider === currentConfig?.provider
        ? currentConfig?.model
        : getDefaultModelForProvider(nextProvider)) ||
      getDefaultModelForProvider(nextProvider)
    const nextConfig: ProviderConfig = {
      provider: nextProvider,
      model: nextModel,
      providerConfig:
        getSerializableProviderInfo(nextProvider) ??
        currentConfig?.providerConfig ??
        getSerializableProviderInfo(provider),
      apiKeys: {
        ...(currentConfig?.apiKeys ?? {}),
        [provider]: apiKey,
      },
    }
    await saveConfig(nextConfig)
    clearProviderModelsCache(nextProvider)

    return {
      result: {
        type: 'text',
        value: setProvider
          ? `Saved API key for ${provider}\nSet provider to ${nextProvider}\nSet model to ${nextModel}\nConfig: ${CONFIG_PATH}`
          : `Saved API key for ${provider} to ${CONFIG_PATH}`,
      },
      appliedConfig: setProvider ? nextConfig : undefined,
    }
  }

  if (command === 'reset' || command === '--reset' || command === '-r') {
    const currentConfig = await loadConfig()
    const defaultProviderInfo = getSerializableProviderInfo('openai')
    const config: ProviderConfig = {
      provider: 'openai',
      model: defaultProviderInfo.defaultModel ?? '',
      providerConfig: defaultProviderInfo,
      apiKeys: currentConfig?.apiKeys,
    }
    await saveConfig(config)
    clearProviderModelsCache(config.provider)
    return {
      result: {
        type: 'text',
        value: `Reset provider to ${config.provider} (${config.model})\nConfig: ${CONFIG_PATH}`,
      },
      appliedConfig: config,
    }
  }

  if (command === 'set' || command === '--set' || command === '-s') {
    const provider = providerArg?.toLowerCase()
    if (!provider || !isProviderKey(provider)) {
      return {
        result: {
          type: 'text',
          value: `Unknown provider: ${provider ?? '(missing)'}\n\n${help()}`,
        },
      }
    }

    let model = modelParts.join(' ')
    if (!model) {
      try {
        model = (await fetchModels(provider))[0] ?? ''
      } catch {
        model = ''
      }
    }
    if (!model) {
      return {
        result: {
          type: 'text',
          value: `No model was provided and ${getProviderInfo(provider).label} did not return models from its API.`,
        },
      }
    }
    const currentConfig = await loadConfig()
    const config: ProviderConfig = {
      provider,
      model,
      providerConfig: getSerializableProviderInfo(provider),
      apiKeys: currentConfig?.apiKeys,
    }
    await saveConfig(config)
    clearProviderModelsCache(provider)

    return {
      result: {
        type: 'text',
        value: `Set provider to ${provider}\nSet model to ${model}\nConfig: ${CONFIG_PATH}`,
      },
      appliedConfig: config,
    }
  }

  if (command === 'models' || command === '--models' || command === '-m') {
    const provider = providerArg?.toLowerCase()
    if (!provider || !isProviderKey(provider)) {
      return {
        result: {
          type: 'text',
          value: `Unknown provider: ${provider ?? '(missing)'}\n\n${help()}`,
        },
      }
    }

    try {
      const models = await fetchModelInfos(provider)
      const visible = models
        .slice(0, 30)
        .map(model =>
          `${model.id}${model.supportsToolCalling === false ? ' (no tools)' : ''}`,
        )
        .join('\n')
      const suffix =
        models.length > 30 ? `\n... and ${models.length - 30} more` : ''
      return {
        result: {
          type: 'text',
          value: `Models from ${getProviderInfo(provider).label}:\n${visible || '(none returned)'}${suffix}`,
        },
      }
    } catch (error) {
      return {
        result: {
          type: 'text',
          value: `Failed to fetch models: ${(error as Error).message}`,
        },
      }
    }
  }

  return {
    result: {
      type: 'text',
      value: `Unknown provider command: ${subcommand}\n\n${help()}`,
    },
  }
}

function ProviderPicker({
  onDone,
}: {
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const [provider, setProvider] = React.useState<ProviderKey | null>(null)
  const [models, setModels] = React.useState<string[] | null>(null)
  const [selectedModel, setSelectedModel] = React.useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = React.useState('')
  const [apiKeyCursorOffset, setApiKeyCursorOffset] = React.useState(0)
  const [apiKeyError, setApiKeyError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [config, setConfig] = React.useState<ProviderConfig | null>(null)
  const setAppState = useSetAppState()

  React.useEffect(() => {
    void loadConfig().then(setConfig)
  }, [])

  React.useEffect(() => {
    if (!provider) return

    let cancelled = false
    setModels(null)
    setError(null)

    void fetchModelInfos(provider)
      .then(nextModels => {
        if (!cancelled) setModels(nextModels.map(model => model.id))
      })
      .catch(err => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => {
      cancelled = true
    }
  }, [provider])

  async function saveProviderSelection(apiKey?: string) {
    if (!provider || !selectedModel) return

    const trimmedApiKey = apiKey?.trim()
    const nextApiKeys = {
      ...(config?.apiKeys ?? {}),
      ...(trimmedApiKey ? { [provider]: trimmedApiKey } : {}),
    }

    const providerInfo = getSerializableProviderInfo(provider)
    const newConfig: ProviderConfig = {
      provider,
      model: selectedModel,
      providerConfig: providerInfo,
      apiKeys: nextApiKeys,
    }
    await saveConfig(newConfig)
    clearProviderModelsCache(provider)

    setConfig(newConfig)

    applyProviderSelectionToSession(setAppState, newConfig)

    onDone(
      `Set provider to ${provider}\nSet model to ${selectedModel}${
        trimmedApiKey ? `\nSaved API key for ${provider}` : ''
      }`,
    )
  }

  if (!provider) {
    const options = PROVIDER_KEYS.map(key => {
      const info = getProviderInfo(key)
      return {
        label: `${info.label} (${key})`,
        value: key,
        description: config?.apiKeys?.[key] || process.env[info.envKey]
          ? chalk.green(`${info.envKey} - ACTIVE ✔`)
          : info.isLocal
            ? 'local provider'
            : `${info.envKey} - MISSING  𐄂`,
      }
    })

    return React.createElement(Select, {
      options,
      visibleOptionCount: 10,
      onChange: value => {
        setProvider(value as ProviderKey)
        setSelectedModel(null)
        setApiKeyInput('')
        setApiKeyCursorOffset(0)
        setApiKeyError(null)
      },
      onCancel: () => onDone('Provider selection cancelled', { display: 'system' }),
    })
  }

  if (selectedModel) {
    const info = getProviderInfo(provider)
    const hasExistingKey = Boolean(config?.apiKeys?.[provider] || process.env[info.envKey])

    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Text,
        null,
        `API key for ${info.label} (${info.envKey})`,
      ),
      hasExistingKey
        ? React.createElement(
            Text,
            { dimColor: true },
            'Press Enter without typing to keep the existing key.',
          )
        : null,
      apiKeyError
        ? React.createElement(Text, { color: 'error' }, apiKeyError)
        : null,
      React.createElement(TextInput, {
        value: apiKeyInput,
        onChange: value => {
          setApiKeyInput(value)
          setApiKeyError(null)
        },
        onSubmit: async value => {
          const trimmed = value.trim()
          if (!trimmed && !hasExistingKey) {
            setApiKeyError(`Enter ${info.envKey} or cancel to go back.`)
            return
          }

          await saveProviderSelection(trimmed || undefined)
        },
        onExit: () => {
          setSelectedModel(null)
          setApiKeyInput('')
          setApiKeyCursorOffset(0)
          setApiKeyError(null)
        },
        placeholder: `Paste ${info.envKey}`,
        mask: '*',
        focus: true,
        showCursor: true,
        columns: 80,
        cursorOffset: apiKeyCursorOffset,
        onChangeCursorOffset: setApiKeyCursorOffset,
      }),
    )
  }

  if (error) {
    return React.createElement(Select, {
      options: [
        {
          label: `Back to providers (${error})`,
          value: 'back',
        },
      ],
      onChange: () => setProvider(null),
      onCancel: () => onDone('Provider selection cancelled', { display: 'system' }),
    })
  }

  if (!models) {
    return React.createElement(Select, {
      options: [
        {
          label: `Loading models from ${getProviderInfo(provider).label}...`,
          value: 'loading',
        },
      ],
      disableSelection: true,
    })
  }

  const options = models.map(model => ({
    label: model,
    value: model,
  }))

  return React.createElement(Select, {
    options,
    visibleOptionCount: 12,
    onChange: async value => {
      const model = String(value)
      const info = getProviderInfo(provider)
      if (info.isLocal) {
        await saveConfig({
          provider,
          model,
          providerConfig: getSerializableProviderInfo(provider),
          apiKeys: config?.apiKeys,
        })
        onDone(`Set provider to ${provider}\nSet model to ${model}`)
        return
      }

      setSelectedModel(model)
      setApiKeyInput('')
      setApiKeyCursorOffset(0)
      setApiKeyError(null)
    },
    onCancel: () => setProvider(null),
  })
}

function ProviderCommandRunner({
  args,
  onDone,
}: {
  args: string
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const setAppState = useSetAppState()

  React.useEffect(() => {
    void runProviderCommand(args)
      .then(({ result, appliedConfig }) => {
        if (appliedConfig) {
          applyProviderSelectionToSession(setAppState, appliedConfig)
        }
        if (result.type === 'text') {
          onDone(result.value)
        } else {
          onDone(undefined, { display: 'skip' })
        }
      })
      .catch(err => {
        onDone(`Provider command failed: ${(err as Error).message}`, {
          display: 'system',
        })
      })
  }, [args, onDone, setAppState])

  return null
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  if (args.trim()) {
    return React.createElement(ProviderCommandRunner, { args, onDone })
  }

  return React.createElement(ProviderPicker, { onDone })
}
