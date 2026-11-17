import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { computeProviderFallbacksAfterDeletion } from "../helpers"

describe("feature providers", () => {
  describe("buildFeatureProviderPatch", () => {
    it("builds patch for a single feature assignment", () => {
      const patch = buildFeatureProviderPatch({
        pageTranslation: "google-translate-default",
      })

      expect(patch).toEqual({
        pageTranslation: {
          providerId: "google-translate-default",
        },
      })
    })

    it("builds patch for multiple feature assignments", () => {
      const patch = buildFeatureProviderPatch({
        pageTranslation: "google-translate-default",
        selectionTranslation: "microsoft-translate-default",
      })

      expect(patch).toEqual({
        pageTranslation: {
          providerId: "google-translate-default",
        },
        selectionToolbar: {
          features: {
            translate: {
              providerId: "microsoft-translate-default",
            },
          },
        },
      })
    })
  })

  describe("getSelectableProvidersForCapability", () => {
    it("returns no providers for disabled AI capabilities", () => {
      expect(
        getSelectableProvidersForCapability("customAction", DEFAULT_CONFIG.providersConfig),
      ).toEqual([])
      expect(
        getSelectableProvidersForCapability("noteSuggestion", DEFAULT_CONFIG.providersConfig),
      ).toEqual([])
      expect(
        getSelectableProvidersForCapability("languageDetection", DEFAULT_CONFIG.providersConfig),
      ).toEqual([])
    })

    it("returns only non-AI translate providers for translation capabilities", () => {
      const providers = getSelectableProvidersForCapability(
        "pageTranslation",
        DEFAULT_CONFIG.providersConfig,
      )
      expect(providers.map((p) => p.id)).toEqual([
        "google-translate-default",
        "microsoft-translate-default",
      ])
    })
  })

  describe("computeProviderFallbacksAfterDeletion", () => {
    it("returns fallback assignments for affected translate features when candidates exist", () => {
      const config = {
        ...DEFAULT_CONFIG,
        pageTranslation: {
          ...DEFAULT_CONFIG.pageTranslation,
          providerId: "deleted-provider",
        },
      }
      const nextProviders = DEFAULT_CONFIG.providersConfig

      const fallback = computeProviderFallbacksAfterDeletion(
        "deleted-provider",
        config,
        nextProviders,
      )

      expect(fallback).toEqual({
        pageTranslation: "google-translate-default",
      })
    })
  })
})
