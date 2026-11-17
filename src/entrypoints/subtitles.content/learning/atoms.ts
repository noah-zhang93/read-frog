import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"

/** The word being looked up, by its place in the cue's tokens. The only lookup state. */
export const wordLookupAtom = atom<{ cueStart: number; index: number } | null>(null)

/** Whether the pointer is over the subtitles. */
export const subtitlesHoveredAtom = atom(false)

/**
 * Whether the subtitles hold still, while the pointer is on them or a lookup is
 * open: the box stays where it is. Whether the video pauses too is up to
 * `useHoldPlayback`, which also weighs the pause-on-hover setting.
 */
export const subtitlesHeldAtom = atom(
  (get) => get(subtitlesHoveredAtom) || get(wordLookupAtom) !== null,
)

/** The cue on screen, cut into words and the text between them. */
export const subtitleTokensAtom = atom((get) =>
  segmentWords(get(displaySubtitleAtom)?.text ?? "", get(sourceLanguageAtom) ?? undefined),
)

export const lookUpAtom = atom(null, (_get, set, _index: number | null) => {
  set(wordLookupAtom, null)
  set(customActionRequestAtom, null)
})
