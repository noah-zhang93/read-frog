import type { NoteSuggestionProviderRef } from "../atoms"
import type { FeatureProviderAnalytics } from "@/types/analytics"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { ValidatedNoteSuggestion } from "@/utils/note-suggestion/types"
import { useAtomValue } from "jotai"
import { useCallback, useRef, useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export interface NoteSuggestionSessionResult {
  /** Composite key: popoverSessionKey:translateRequestKey:rerunNonce. */
  sessionKey: string
  validated: ValidatedNoteSuggestion
  /** The configured Note suggestion action as of fire time. */
  actionSnapshot: SelectionToolbarCustomAction
  /** When the request was fired (for latency analytics). */
  firedAt: number
  /** Analytics classification of the provider that generated this suggestion. */
  analyticsProvider: FeatureProviderAnalytics
}

export interface NoteSuggestionFireInput {
  sessionKey: string
  selectionText: string
  /**
   * The selection as a custom action run saves it (normalizeSelectedText),
   * which every note keeps in the action's selection fields. selectionText is
   * prepared for translation and may have lost a few invisible characters.
   */
  savedSelectionText: string
  paragraphsText: string
  /** English name of the target language. */
  targetLangName: string
  webTitle: string
  /**
   * The suggestion's own resolved provider (config.selectionToolbar
   * .noteSuggestion.providerId) — local guaranteed enabled + LLM by the
   * caller; system refs are availability-gated inside via hosted status.
   */
  provider: NoteSuggestionProviderRef
}

/**
 * Owns the "guess you want to save" AI request lifecycle, running on the save
 * suggestion's own provider — a local LLM or hosted Built-in AI. Fired when a
 * translation run starts; the card renders the result only after the
 * translation finishes. Every eligible fire attempts a request (no failure
 * backoff — selection translation is human-paced, and a failed LLM call is
 * near-free): failures are silent, at most once per popover session. The one
 * pre-request gate is hosted status: a Built-in provider whose tier is
 * explicitly unavailable (not signed in, needs Ultra, quota exhausted,
 * service down) skips without issuing the doomed stream call. A valid
 * response with zero notes is a success (nothing worth saving) that renders
 * no card.
 */
export function useNoteSuggestion() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [suggestion, setSuggestion] = useState<NoteSuggestionSessionResult | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // Sets rather than single slots so an A→B→A key round-trip inside one
  // popover (e.g. peeking at another target language) neither re-fires a
  // completed request nor double-counts the shown analytics event. Cleared
  // when the popover closes to keep them bounded.
  const completedSessionKeysRef = useRef<Set<string>>(new Set())
  const shownSessionKeysRef = useRef<Set<string>>(new Set())
  const latestRef = useRef(selectionToolbar)
  // oxlint-disable-next-line react/refs -- latest-value ref: writing it during render is what keeps callbacks in sync
  latestRef.current = selectionToolbar

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const resetSession = useCallback(() => {
    cancel()
    completedSessionKeysRef.current.clear()
    shownSessionKeysRef.current.clear()
    setSuggestion(null)
  }, [cancel])

  /** Returns true only the first time it is called for a session. */
  const markShownOnce = useCallback((sessionKey: string) => {
    if (shownSessionKeysRef.current.has(sessionKey)) {
      return false
    }
    shownSessionKeysRef.current.add(sessionKey)
    return true
  }, [])

  const maybeFire = useCallback((_input: NoteSuggestionFireInput) => {
    // AI note suggestion is disabled
  }, [])

  return {
    suggestion,
    maybeFire,
    cancel,
    resetSession,
    markShownOnce,
  }
}
