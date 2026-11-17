import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { configSchema } from "../config"

function getIssuePaths(input: unknown) {
  const result = configSchema.safeParse(input)
  if (result.success) {
    return []
  }

  return result.error.issues.map((issue) => issue.path.join("."))
}

describe("config provider enabled validation", () => {
  it("fails when a built-in feature uses a disabled provider", () => {
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === "google-translate-default") {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
    })

    expect(issuePaths).toContain("pageTranslation.providerId")
  })

  it("rejects an unknown provider for selection toolbar translation", () => {
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        features: {
          ...DEFAULT_CONFIG.selectionToolbar.features,
          translate: {
            ...DEFAULT_CONFIG.selectionToolbar.features.translate,
            providerId: "nonexistent-provider",
          },
        },
      },
    })

    expect(issuePaths).toContain("selectionToolbar.features.translate.providerId")
  })

  it("rejects a disabled local provider for selection toolbar translation", () => {
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) =>
      provider.id === "google-translate-default" ? { ...provider, enabled: false } : provider,
    )
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        features: {
          ...DEFAULT_CONFIG.selectionToolbar.features,
          translate: {
            ...DEFAULT_CONFIG.selectionToolbar.features.translate,
            providerId: "google-translate-default",
          },
        },
      },
    })

    expect(issuePaths).toContain("selectionToolbar.features.translate.providerId")
  })

  it("still rejects a provider id no capability covers", () => {
    expect(
      getIssuePaths({
        ...DEFAULT_CONFIG,
        inputTranslation: { ...DEFAULT_CONFIG.inputTranslation, providerId: "does-not-exist" },
      }),
    ).toContain("inputTranslation.providerId")
  })
})
