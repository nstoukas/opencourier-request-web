// Which language the portal speaks (spec 0054, row 47): Greek by default, English available.
// The choice lives in a cookie, `oc_lang`, so the server can read it and send the first page
// already in that language (no flash of the wrong language, no hydration mismatch).
// This file has no i18next import, so the server only pages (_document) can use it cheaply.

// The two languages, Greek first because it is the default. `as const` keeps the exact strings,
// so `Language` below is the type 'el' | 'en' rather than any string.
export const LANGUAGES = ['el', 'en'] as const

// An indexed access type: "the type of any item of LANGUAGES", here 'el' | 'en'.
export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'el'

// The cookie's name and life (one year), as cross check 2 of spec 0054 sets them.
export const LANGUAGE_COOKIE = 'oc_lang'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Each language's own name, written in that language, so a reader who cannot read the other one
// still finds theirs. Deliberately not translated (decision 47.4).
export const LANGUAGE_NAMES: Record<Language, string> = {
  el: 'Ελληνικά',
  en: 'English',
}

// The locale Intl uses for numbers and dates in each language. English is en-GB: day first dates,
// the 24 hour clock and "€1,234.56", closest to what a reader in Greece expects (decision 47.5).
export const LOCALES: Record<Language, string> = {
  el: 'el-GR',
  en: 'en-GB',
}

/** Any value to a language we speak; anything else (missing, "fr", junk) is the default, Greek. */
export function toLanguage(value: unknown): Language {
  return value === 'el' || value === 'en' ? value : DEFAULT_LANGUAGE
}

/**
 * The language saved in a Cookie header ("a=1; oc_lang=en; b=2") or in `document.cookie`, which
 * has the same shape. No cookie, or a value we do not know, is Greek.
 */
export function languageFromCookies(cookieHeader: string | undefined | null): Language {
  if (!cookieHeader) return DEFAULT_LANGUAGE
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === LANGUAGE_COOKIE) return toLanguage(decodeURIComponent(rest.join('=')))
  }
  return DEFAULT_LANGUAGE
}

/** Saves the choice in the browser for a year, readable by the server on the next page load. */
export function saveLanguageCookie(language: Language): void {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
}
