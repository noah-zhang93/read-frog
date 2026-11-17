import type { Config as SeedConfig } from "@/types/config/config"
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import {
  BuiltInProviderEditor,
  ProviderEditor,
  useProviderEditor,
} from "../api-providers/providers-config/provider-editor"

function seedConfig(store: ReturnType<typeof createStore>, config: SeedConfig) {
  void fakeBrowser.storage.local.set({ config })
  store.set(configAtom, config)
}

function ProviderContextProbe() {
  useProviderEditor()
  return null
}

function createConfigStore() {
  const store = createStore()
  seedConfig(store, structuredClone(DEFAULT_CONFIG))
  return store
}

describe("editor compound component contexts", () => {
  it("fails fast when a ProviderEditor component is outside its provider", () => {
    expect(() => render(<ProviderContextProbe />)).toThrow(
      "ProviderEditor components must be rendered inside a ProviderEditor Provider",
    )
  })

  it("fails fast when Duplicate is composed for the built-in provider", () => {
    const store = createConfigStore()

    expect(() =>
      render(
        <Provider store={store}>
          <BuiltInProviderEditor.Provider providerId={BUILT_IN_AI_PROVIDER_ID}>
            <ProviderEditor.DuplicateButton />
          </BuiltInProviderEditor.Provider>
        </Provider>,
      ),
    ).toThrow("ProviderEditor.duplicate is unavailable in this composition")
  })
})
