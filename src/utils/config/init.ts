import type { Config } from "@/types/config/config"
import type { ConfigMeta } from "@/types/config/meta"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { isAPIProviderConfig, isPureTranslateProviderConfig } from "@/types/config/provider"
import { initI18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import {
  buildFreshDefaultConfig,
  CONFIG_SCHEMA_VERSION,
  CONFIG_STORAGE_KEY,
  DEFAULT_CONFIG,
} from "../constants/config"
import { MICROSOFT_TRANSLATE_PROVIDER_ID } from "../constants/providers"
import { runMigration } from "./migration"

const log = createLogger("config/init")

export interface InitializeConfigResult {
  /**
   * The config was created from defaults in this run — either no stored value existed, or the
   * stored value failed validation and was rebuilt. Callers use it to run one-time setup that
   * only makes sense on untouched defaults (see `selectFreshTranslateProviders`).
   */
  isFreshInstall: boolean
}

/**
 * Initialize the config, this function should only be called once in the background script
 * @returns The extension config
 */
export async function initializeConfig(): Promise<InitializeConfigResult> {
  const [storedConfig, configMeta] = await Promise.all([
    storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`),
    storage.getMeta<ConfigMeta>(`local:${CONFIG_STORAGE_KEY}`),
  ])

  let config: Config
  let currentVersion: number
  let didConfigChange = false
  let isFreshInstall = false

  if (!storedConfig) {
    // Initialize locale before building defaults used by this browser context.
    await initI18n(DEFAULT_CONFIG.uiLanguage)
    config = buildFreshDefaultConfig()
    currentVersion = CONFIG_SCHEMA_VERSION
    didConfigChange = true
    isFreshInstall = true
  } else {
    config = storedConfig
    currentVersion = configMeta?.schemaVersion ?? 1
  }

  while (currentVersion < CONFIG_SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1
    try {
      config = await runMigration(nextVersion, config)
      didConfigChange = true
      currentVersion = nextVersion
    } catch (error) {
      log.error("Config migration failed", { version: nextVersion, error })
      currentVersion = nextVersion
    }
  }

  const sanitized = sanitizeDisabledAiConfig(config)
  if (sanitized.changed) {
    config = sanitized.config
    didConfigChange = true
  }

  const parsedConfig = configSchema.safeParse(config)
  if (parsedConfig.success) {
    // Stored as every reader gets it: defaults filled in, the selection
    // toolbar's order and pins in step with its actions.
    config = parsedConfig.data
  } else {
    log.warn("Config is invalid, using default config")
    await initI18n(DEFAULT_CONFIG.uiLanguage)
    config = buildFreshDefaultConfig()
    currentVersion = CONFIG_SCHEMA_VERSION
    didConfigChange = true
    // The rebuilt config is untouched defaults, so recovered users get the
    // same one-time provider selection a genuine fresh install does.
    isFreshInstall = true
  }

  if (import.meta.env.DEV) {
    const apiKeyResult = applyAPIKeysFromEnv(config)
    config = apiKeyResult.config
    didConfigChange = didConfigChange || apiKeyResult.changed

    const betaResult = applyDevBetaExperience(config)
    config = betaResult.config
    didConfigChange = didConfigChange || betaResult.changed
  }

  const didMetaNeedUpdate =
    configMeta?.schemaVersion !== currentVersion || configMeta?.lastModifiedAt === undefined

  if (didConfigChange) {
    await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, config)
  }

  if (didConfigChange || didMetaNeedUpdate) {
    await storage.setMeta<ConfigMeta>(`local:${CONFIG_STORAGE_KEY}`, {
      schemaVersion: currentVersion,
      lastModifiedAt: configMeta?.lastModifiedAt ?? Date.now(),
    })
  }

  return { isFreshInstall }
}

function applyAPIKeysFromEnv(config: Config): { config: Config; changed: boolean } {
  let changed = false

  const providersConfig = config.providersConfig.map((providerConfig) => {
    if (!isAPIProviderConfig(providerConfig)) {
      return providerConfig
    }

    const apiKeyEnvName = `WXT_${providerConfig.provider.toUpperCase()}_API_KEY`
    const envApiKey = import.meta.env[apiKeyEnvName] as string | undefined
    if (!envApiKey || providerConfig.apiKey === envApiKey) {
      return providerConfig
    }

    changed = true
    return {
      ...providerConfig,
      apiKey: envApiKey,
    }
  })

  if (!changed) {
    return { config, changed: false }
  }

  return {
    config: {
      ...config,
      providersConfig,
    },
    changed: true,
  }
}

function applyDevBetaExperience(config: Config): { config: Config; changed: boolean } {
  if (config.betaExperience.enabled) {
    return { config, changed: false }
  }

  return {
    config: {
      ...config,
      betaExperience: {
        ...config.betaExperience,
        enabled: true,
      },
    },
    changed: true,
  }
}

/**
 * Ensure any previously stored AI-only settings or AI provider selections are
 * disabled/reassigned to a non-AI translate provider without discarding the
 * user's other settings.
 */
function sanitizeDisabledAiConfig(config: Config): { config: Config; changed: boolean } {
  const providers = Array.isArray(config.providersConfig) ? config.providersConfig : []
  const fallbackTranslateProviderId =
    providers.find((p) => p.enabled && isPureTranslateProviderConfig(p))?.id ??
    MICROSOFT_TRANSLATE_PROVIDER_ID

  const isAllowedTranslateProviderId = (id: string) =>
    providers.some((p) => p.id === id && p.enabled && isPureTranslateProviderConfig(p))

  let changed = false
  let nextConfig = config

  if (
    nextConfig.pageTranslation &&
    !isAllowedTranslateProviderId(nextConfig.pageTranslation.providerId)
  ) {
    nextConfig = {
      ...nextConfig,
      pageTranslation: { ...nextConfig.pageTranslation, providerId: fallbackTranslateProviderId },
    }
    changed = true
  }
  if (nextConfig.pageTranslation?.enableAIContentAware) {
    nextConfig = {
      ...nextConfig,
      pageTranslation: { ...nextConfig.pageTranslation, enableAIContentAware: false },
    }
    changed = true
  }
  if (
    nextConfig.videoSubtitles &&
    !isAllowedTranslateProviderId(nextConfig.videoSubtitles.providerId)
  ) {
    nextConfig = {
      ...nextConfig,
      videoSubtitles: { ...nextConfig.videoSubtitles, providerId: fallbackTranslateProviderId },
    }
    changed = true
  }
  if (nextConfig.videoSubtitles?.aiSegmentation) {
    nextConfig = {
      ...nextConfig,
      videoSubtitles: { ...nextConfig.videoSubtitles, aiSegmentation: false },
    }
    changed = true
  }
  if (
    nextConfig.selectionToolbar?.features?.translate &&
    !isAllowedTranslateProviderId(nextConfig.selectionToolbar.features.translate.providerId)
  ) {
    nextConfig = {
      ...nextConfig,
      selectionToolbar: {
        ...nextConfig.selectionToolbar,
        features: {
          ...nextConfig.selectionToolbar.features,
          translate: {
            ...nextConfig.selectionToolbar.features.translate,
            providerId: fallbackTranslateProviderId,
          },
        },
      },
    }
    changed = true
  }
  if (
    nextConfig.inputTranslation &&
    !isAllowedTranslateProviderId(nextConfig.inputTranslation.providerId)
  ) {
    nextConfig = {
      ...nextConfig,
      inputTranslation: { ...nextConfig.inputTranslation, providerId: fallbackTranslateProviderId },
    }
    changed = true
  }
  if (nextConfig.languageDetection?.mode === "llm") {
    nextConfig = {
      ...nextConfig,
      languageDetection: { ...nextConfig.languageDetection, mode: "basic" },
    }
    changed = true
  }
  if (nextConfig.selectionToolbar?.noteSuggestion?.enabled) {
    nextConfig = {
      ...nextConfig,
      selectionToolbar: {
        ...nextConfig.selectionToolbar,
        noteSuggestion: { ...nextConfig.selectionToolbar.noteSuggestion, enabled: false },
      },
    }
    changed = true
  }
  if (nextConfig.glossary?.enabled) {
    nextConfig = {
      ...nextConfig,
      glossary: { ...nextConfig.glossary, enabled: false },
    }
    changed = true
  }

  return { config: nextConfig, changed }
}
