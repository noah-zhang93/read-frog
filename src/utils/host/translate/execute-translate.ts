import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { TranslationTextFormat } from "@/types/config/translate"
import type { MatchedTerm } from "@/utils/glossary/types"
import { isNonAPIProvider, isPureAPIProvider } from "@/types/config/provider"
import { deeplTranslate } from "./api/deepl"
import { deeplxTranslate } from "./api/deeplx"
import { googleTranslate } from "./api/google"
import {
  toGoogleLanguageCode,
  toGoogleSourceCode,
  toMicrosoftLanguageCode,
  toMicrosoftSourceCode,
} from "./api/language-codes"
import { microsoftTranslate } from "./api/microsoft"
import { prepareTranslationText } from "./text-preparation"
import { normalizeTranslationOutput } from "./translation-output-normalization"

export async function executeTranslate(
  text: string,
  langConfig: Config["language"],
  providerConfig: ProviderConfig,
  _promptResolver: unknown,
  options?: {
    isBatch?: boolean
    context?: unknown
    textFormat?: TranslationTextFormat
    // Only Google needs protection: its translateHtml transport collapses
    // "\n" as HTML whitespace. Microsoft preserves newlines in both textTypes
    // (live-verified); LLM prompts already mandate format preservation.
    preserveLineBreaks?: boolean
    signal?: AbortSignal
    glossaryTerms?: readonly MatchedTerm[]
  },
) {
  const preparedText = prepareTranslationText(text)
  if (preparedText === "") {
    return ""
  }

  const { provider } = providerConfig
  let translatedText = ""

  if (isNonAPIProvider(provider)) {
    const google = provider === "google-translate"
    const sourceLang = (google ? toGoogleSourceCode : toMicrosoftSourceCode)(langConfig.sourceCode)
    const targetLang = (google ? toGoogleLanguageCode : toMicrosoftLanguageCode)(
      langConfig.targetCode,
    )
    if (provider === "google-translate") {
      translatedText = await googleTranslate(preparedText, sourceLang, targetLang, {
        textFormat: options?.textFormat,
        preserveLineBreaks: options?.preserveLineBreaks,
        signal: options?.signal,
      })
    } else if (provider === "microsoft-translate") {
      translatedText = await microsoftTranslate(preparedText, sourceLang, targetLang, {
        textFormat: options?.textFormat,
        signal: options?.signal,
      })
    }
  } else if (isPureAPIProvider(provider)) {
    const { sourceCode, targetCode } = langConfig
    if (provider === "deeplx") {
      translatedText = await deeplxTranslate(preparedText, sourceCode, targetCode, providerConfig, {
        textFormat: options?.textFormat,
        signal: options?.signal,
      })
    } else if (provider === "deepl") {
      translatedText = await deeplTranslate(text, sourceCode, targetCode, providerConfig, {
        textFormat: options?.textFormat,
        signal: options?.signal,
      })
    }
  } else {
    throw new Error(`Unsupported provider: ${provider}`)
  }

  return normalizeTranslationOutput(providerConfig, translatedText).trim()
}
