// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { ContextMenuPreview } from "../context-menu-preview"

const { selectionToolbarAtom, testState } = vi.hoisted(() => ({
  selectionToolbarAtom: {},
  testState: {
    selectionToolbar: null as Config["selectionToolbar"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtomValue: (atom: object) => {
    if (atom !== selectionToolbarAtom || !testState.selectionToolbar) {
      throw new Error("Unexpected atom")
    }
    return testState.selectionToolbar
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    selectionToolbar: selectionToolbarAtom,
  },
}))

describe("context menu preview", () => {
  beforeEach(() => {
    testState.selectionToolbar = structuredClone(DEFAULT_CONFIG.selectionToolbar)
    i18n.t = vi.fn<(...args: any[]) => any>(
      (key: string) =>
        ({
          "contextMenu.translateSelection": 'Translate "%s"',
          "contextMenu.readAloudSelection": 'Read aloud "%s"',
        })[key] ?? key,
    ) as typeof i18n.t
    // The extension's name in the browser's language, as the manifest gets it.
    vi.spyOn(browser.i18n, "getMessage").mockReturnValue("Read Frog - AI Translation & Flashcards")
  })

  it("names Read Frog's submenu as the browser does, in the browser's language", () => {
    const getMessage = vi.spyOn(browser.i18n, "getMessage").mockReturnValue("Read Frog (browser)")

    render(<ContextMenuPreview />)

    expect(getMessage).toHaveBeenCalledWith("extName")
    expect(screen.getByRole("img")).toHaveTextContent("Read Frog (browser)")
  })

  it("keeps the stage at baseline height with translate and read-aloud items", () => {
    render(<ContextMenuPreview />)
    expect(screen.getByRole("img").firstElementChild).toHaveStyle({ height: "330px" })
  })

  it("fills the selection into the translate and read-aloud items", () => {
    render(<ContextMenuPreview />)

    const preview = screen.getByRole("img")
    expect(preview).toHaveTextContent('Translate "Mr. Kamiya"')
    expect(preview).toHaveTextContent('Read aloud "Mr. Kamiya"')
    expect(preview).not.toHaveTextContent("%s")
  })

  it("is one labelled image to assistive technology", () => {
    render(<ContextMenuPreview />)

    expect(screen.getByRole("img")).toHaveAccessibleName("options.contextMenu.demoImageAlt")
  })
})
