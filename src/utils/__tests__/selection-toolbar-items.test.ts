import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  getSelectionToolbarItems,
  reorderSelectionToolbarItems,
  setSelectionToolbarItemPinned,
} from "../selection-toolbar-items"

describe("getSelectionToolbarItems", () => {
  it("lists only non-AI selection toolbar features in order", () => {
    const items = getSelectionToolbarItems(DEFAULT_CONFIG.selectionToolbar)

    expect(items.map((item) => item.id)).toEqual(["translate", "speak"])
  })

  it("follows the saved order across features", () => {
    const selectionToolbar = {
      ...structuredClone(DEFAULT_CONFIG.selectionToolbar),
      order: ["speak", "translate"],
    }

    expect(getSelectionToolbarItems(selectionToolbar).map((item) => item.id)).toEqual([
      "speak",
      "translate",
    ])
  })

  it("reads each item's enabled switch, and pins everything the unpinned list does not name", () => {
    const selectionToolbar = {
      ...structuredClone(DEFAULT_CONFIG.selectionToolbar),
      features: {
        ...DEFAULT_CONFIG.selectionToolbar.features,
        speak: { ...DEFAULT_CONFIG.selectionToolbar.features.speak, enabled: false },
      },
      unpinned: ["translate"],
    }

    const items = getSelectionToolbarItems(selectionToolbar)
    expect(items).toEqual([
      { kind: "feature", id: "translate", enabled: true, pinned: false },
      { kind: "feature", id: "speak", enabled: false, pinned: true },
    ])
  })
})

describe("reorderSelectionToolbarItems", () => {
  it("saves the new order", () => {
    const next = reorderSelectionToolbarItems(DEFAULT_CONFIG.selectionToolbar, [
      "speak",
      "translate",
    ])
    expect(getSelectionToolbarItems(next).map((item) => item.id)).toEqual(["speak", "translate"])
  })
})

describe("setSelectionToolbarItemPinned", () => {
  it("leaves the item's enabled switch alone, so the pin outlives turning it off and on", () => {
    const unpinned = setSelectionToolbarItemPinned(
      DEFAULT_CONFIG.selectionToolbar,
      "translate",
      false,
    )
    expect(unpinned.unpinned).toContain("translate")
    expect(unpinned.features.translate.enabled).toBe(true)

    const repinned = setSelectionToolbarItemPinned(unpinned, "translate", true)
    expect(repinned.unpinned).not.toContain("translate")
  })
})
