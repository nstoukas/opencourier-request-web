// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE SERVER'S WORDS, in the reader's language (spec 0054, AC-6; row 124).
//
// The backend answers a refusal with an English sentence AND a `code` (plus `params` when the sentence
// has numbers, a time or a name in it). It also sends a dispatch stop's banner and the "not accepting
// orders" line by code (`messageCode`, `notAcceptingCode`) beside their English. This file turns a code
// into a sentence in the reader's language, from the templates in resources/serverEn.ts and serverEl.ts
// (a copy of the backend's own src/localization files), and falls back to the server's English for a
// code it does not know (a code newer than this copy, or a refusal that carries none).
//
// The templates use the subset of i18next syntax the backend's own renderer reads (its
// src/localization/translate.ts); this file renders them exactly as the backend and adminweb do
// (adminweb's src/i18n/serverText.ts is the same code, decision 47.31), rather than through i18next's
// own interpolation, whose nesting and list handling differ:
//   {{name}}            the value
//   {{name, clock}}     an ISO time shown as HH:mm on Greek time
//   {{name, list}}      a list of parts, "a, b and c" (Greek "a, b και c")
//   {{name, comma}}     a list of parts joined with ", "
//   {{name, money}}     cents, with the sibling `currency` value, as the language writes money ("3,50 €")
//   {{name, decimal}}   a number with the language's decimal mark, at most one decimal ("1,2")
//   {{name, day}}       an ISO time's day on Greek time, seen from now: "today", "tomorrow", "on 3 August"
//   {{name, when}}      an ISO time as HH:mm, and its day when that is not today ("09:00 tomorrow")
//   $t(server.enum.x.{{name}})   another key, looked up after the value is filled in
//
// A timeout is worded here too (row 124 review, decision 124.10): manualRequestFetch gives it the code
// REQUEST_TIMEOUT_CODE, and serverMessage shows the portal's own `common.requestTimedOut` for it.
//
// KNOWN GAP, left as it was (row 47 review, finding 4, ruled pre-existing; decision 124.2): any other
// failure the server never answered ("Request failed (HTTP 500)", the proxy's "Backend unreachable.")
// has no code, so its message, our developer English, still comes back from serverMessage, and the places
// that call `serverMessage(err, i18n) ?? t(...)` with no status check show it: deliveries/index.tsx (edit
// save, edit load, list load), AvailabilityStrip, ReadyControls, OrderLegsSection, CancelOrderLegsDialog,
// CancelDeliveryDialog, ReportProductCard and CreateDeliveryForm's profile load line. adminweb returns
// undefined for an error with no `statusCode` (its serverErrorText); doing the same here changes what a
// dozen existing tests expect, so it is its own small change.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import type { i18n as I18n } from 'i18next'
import { formatMoney, formatTime } from '../utils/format'
import { LOCALES, toLanguage, type Language } from './language'

const TIME_ZONE = 'Europe/Athens'

/**
 * The code manualRequestFetch gives a call the server did not answer in time. Not a server code: no
 * `server.error` template has it, so serverMessage words it from the portal's own `common.requestTimedOut`.
 */
export const REQUEST_TIMEOUT_CODE = 'REQUEST_TIMEOUT'

// A value the server sends inside `params`. A "part" is a piece of sentence with its own template
// (only delivery records use them; refusals and banners send plain values), kept so the renderer
// stays line for line the backend's.
type ServerPart = { part: string; params: ServerParams }
type ServerParamValue = string | number | boolean | null | ServerPart | ServerPart[]
/** The values a coded sentence fills in, by name. */
export type ServerParams = { [name: string]: ServerParamValue }

// Each language's word for the last "and" of a list (no comma before it in either), as the backend has it.
const LIST_AND: Record<Language, string> = { el: 'και', en: 'and' }

// Each language's words for a day seen from today, as the backend's renderer has them.
const DAY_WORDS: Record<Language, { today: string; tomorrow: string; on: string }> = {
  el: { today: 'σήμερα', tomorrow: 'αύριο', on: 'στις' },
  en: { today: 'today', tomorrow: 'tomorrow', on: 'on' },
}

// Built once, since building a formatter is slow.
const GREEK_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

// The YYYY-MM-DD day of a valid date on Greek time. formatToParts hands back the year, month and day as
// separate pieces, so the result never depends on how a locale orders or separates them (row 124 review).
function greekDay(date: Date): string {
  const parts = GREEK_DATE.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// "today", "tomorrow", or "on 3 August" (Greek "στις 3 Αυγούστου"), seen from now on Greek time.
function dayText(language: Language, date: Date): string {
  const words = DAY_WORDS[language]
  const now = new Date()
  if (greekDay(date) === greekDay(now)) return words.today
  // Noon plus a day lands on tomorrow's date whatever the clock change does.
  const tomorrow = new Date(`${greekDay(now)}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (greekDay(date) === tomorrow.toISOString().slice(0, 10)) return words.tomorrow
  const dayMonth = new Intl.DateTimeFormat(LOCALES[language], { day: 'numeric', month: 'long', timeZone: TIME_ZONE })
  return `${words.on} ${dayMonth.format(date)}`
}

function listOf(language: Language, texts: string[]): string {
  if (texts.length <= 1) return texts.join('')
  return `${texts.slice(0, -1).join(', ')} ${LIST_AND[language]} ${texts[texts.length - 1]}`
}

// The raw template of `key` in a language, or null. getResource reads the texts as stored, before
// i18next fills anything in.
function lookup(i18n: I18n, language: Language, key: string): string | null {
  const value: unknown = i18n.getResource(language, 'translation', key)
  return typeof value === 'string' ? value : null
}

// A type predicate: inside `if (isPart(value))` TypeScript knows the value is a ServerPart.
function isPart(value: ServerParamValue): value is ServerPart {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatValue(
  i18n: I18n,
  language: Language,
  value: ServerParamValue | undefined,
  format: string | undefined,
  params: ServerParams,
): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) {
    const texts = value.map((part) => render(i18n, language, `server.eventPart.${part.part}`, part.params))
    if (format === 'list') return listOf(language, texts)
    if (format === 'comma') return texts.join(', ')
    return texts.join('')
  }
  if (isPart(value)) return render(i18n, language, `server.eventPart.${value.part}`, value.params)
  if ((format === 'clock' || format === 'day' || format === 'when') && typeof value === 'string') {
    const date = new Date(value)
    // A value that is not a time is shown as it came (Intl would throw on an invalid date).
    if (Number.isNaN(date.getTime())) return value
    const time = formatTime(value, language)
    if (format === 'clock') return time
    const day = dayText(language, date)
    if (format === 'day') return day
    return day === DAY_WORDS[language].today ? time : `${time} ${day}`
  }
  if (format === 'money' && typeof value === 'number') {
    return formatMoney(value, typeof params.currency === 'string' ? params.currency : 'EUR', language)
  }
  if (format === 'decimal' && typeof value === 'number') {
    return new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 1 }).format(value)
  }
  return String(value)
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*(?:,\s*(\w+)\s*)?\}\}/g

function render(i18n: I18n, language: Language, key: string, params: ServerParams): string {
  const template = lookup(i18n, language, key) ?? lookup(i18n, 'en', key)
  if (template === null) return key
  const fill = (text: string) =>
    text.replace(PLACEHOLDER, (_match, name: string, format?: string) =>
      formatValue(i18n, language, params[name], format, params),
    )
  // Nested keys first, filling only the placeholders inside the key, so a value (an admin's reason, say)
  // is never read as a key itself.
  const nested = template.replace(/\$t\(([^)]*)\)/g, (_match, nestedKey: string) => {
    const resolved = fill(nestedKey)
    return lookup(i18n, language, resolved) ?? lookup(i18n, 'en', resolved) ?? resolved
  })
  return fill(nested)
}

function hasServerText(i18n: I18n, key: string): boolean {
  return lookup(i18n, 'en', key) !== null
}

// The template of `key` filled in, in the reader's language, or null if rendering throws (Intl on a value
// it cannot read, say). These sentences are drawn during render, in the dispatch banner and the order bar
// among others, and a throw there would take the page down; the callers show the server's English
// instead (row 124 review).
function safeRender(i18n: I18n, key: string, params: ServerParams): string | null {
  try {
    return render(i18n, toLanguage(i18n.language), key, params)
  } catch {
    return null
  }
}

// `typeof x === 'object'` is also true for null, hence the second check.
function asParams(value: unknown): ServerParams {
  return typeof value === 'object' && value !== null ? (value as ServerParams) : {}
}

/**
 * A sentence the server sends as a code with values beside its English (a dispatch stop's
 * `messageCode`, a restaurant's `notAcceptingCode`): the text of `server.<group>.<code>` in the
 * reader's language, else the server's English as sent (no code, or a code newer than this copy).
 */
export function codedSentenceText(
  i18n: I18n,
  group: 'error' | 'notice',
  code: string | null | undefined,
  params: unknown,
  english: string,
): string {
  const key = `server.${group}.${code}`
  return code && hasServerText(i18n, key) ? (safeRender(i18n, key, asParams(params)) ?? english) : english
}

// ── Refusals (AC-6) ──────────────────────────────────────────────────────────────────────────

/** The shape a failed partner call throws (manualRequestFetch sets these). */
export interface ServerError {
  message?: string
  code?: string
  statusCode?: number
  params?: Record<string, unknown>
}

/**
 * The words for a server's refusal in the reader's language, or undefined when it carried none (then
 * the caller shows its own sentence). A code with a template here wins; otherwise the error's own
 * message, which is the server's English (see KNOWN GAP above for errors the server never answered).
 * `i18n` is the page's i18next instance: `const { t, i18n } = useTranslation()` in a component.
 */
export function serverMessage(error: ServerError | null | undefined, i18n: I18n): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const message = typeof error.message === 'string' && error.message.length > 0 ? error.message : undefined
  // No answer in time: the portal's own sentence in the reader's language, not the developer English.
  if (error.code === REQUEST_TIMEOUT_CODE) return i18n.t('common.requestTimedOut')
  if (typeof error.code === 'string' && hasServerText(i18n, `server.error.${error.code}`)) {
    // A throw while rendering shows the server's English instead (or, with none, the caller's sentence).
    return safeRender(i18n, `server.error.${error.code}`, asParams(error.params)) ?? message
  }
  return message
}
