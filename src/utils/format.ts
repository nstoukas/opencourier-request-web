// How money, times and distances read in the restaurant portal, in the reader's language
// (spec 0054, AC-3). Greek: the euro after the number with a decimal comma (1.234,56 €), dates day
// first, the 24 hour clock (23:25). English: "€1,234.56", still day first and on the 24 hour clock.
// One place for these, so every page shows the same thing. Components get them already bound to
// the reader's language through `useFormat()` (src/i18n/useFormat.ts).
// Times are shown on Greek time (Europe/Athens) whatever the computer's own time zone is:
// the co-op serves Volos, so a laptop left on another zone must not shift an ETA.
import { DEFAULT_LANGUAGE, LOCALES, type Language } from '../i18n/language'

const TIME_ZONE = 'Europe/Athens'

// Intl.NumberFormat and Intl.DateTimeFormat are built into every browser and Node; the locale
// ('el-GR' or 'en-GB') gives the separators and order. Each language's formatter is built once.
// `Record<Language, ...>` is an object with one entry per language, 'el' and 'en'.
const DATE_TIME: Record<Language, Intl.DateTimeFormat> = {
  el: dateTimeFormat('el'),
  en: dateTimeFormat('en'),
}
const TIME: Record<Language, Intl.DateTimeFormat> = {
  el: timeFormat('el'),
  en: timeFormat('en'),
}

function dateTimeFormat(language: Language) {
  return new Intl.DateTimeFormat(LOCALES[language], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  })
}

function timeFormat(language: Language) {
  return new Intl.DateTimeFormat(LOCALES[language], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  })
}

// Every function below takes the language last, with Greek, the portal's default, when it is left
// out. Pages always pass the reader's language (through useFormat).

/** Money stored as cents, for example 338 with 'EUR' reads "3,38 €" (Greek) or "€3.38". Missing reads "—". */
export function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined,
  language: Language = DEFAULT_LANGUAGE,
): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat(LOCALES[language], {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(cents / 100)
}

/** A date and time, for example "30/09/2026, 23:25". Missing reads "—". */
export function formatDateTime(iso: string | null | undefined, language: Language = DEFAULT_LANGUAGE): string {
  if (!iso) return '—'
  return DATE_TIME[language].format(new Date(iso))
}

/** Only the time of day, for example "23:25". Missing reads "—". */
export function formatTime(iso: string | null | undefined, language: Language = DEFAULT_LANGUAGE): string {
  if (!iso) return '—'
  return TIME[language].format(new Date(iso))
}

/** A distance with its unit, one decimal, for example 2.43 and 'KM' read "2,4 km" (Greek) or "2.4 km". */
export function formatDistance(
  value: number | null | undefined,
  unit: string | null | undefined,
  language: Language = DEFAULT_LANGUAGE,
): string {
  if (value == null) return '—'
  const number = new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 1 }).format(value)
  return unit ? `${number} ${unit.toLowerCase()}` : number
}

/** A whole date with no time, for example "30/09/2026". Missing reads "—". */
export function formatDate(iso: string | null | undefined, language: Language = DEFAULT_LANGUAGE): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(LOCALES[language], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}
