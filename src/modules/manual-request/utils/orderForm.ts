// Small rules of the order form (spec 0006), kept apart from the component so each one can be read
// and tested on its own.

// ─── Order total (AC-4) ───────────────────────────────────────────────────────

export const ORDER_TOTAL_MAX = 1000

// Digits, then optionally a comma or a point and one or two digits: "12,50", "12.50", "0", "1000".
// No thousands separators, no "€", no sign, no ".5" and no "12.".
const EURO_AMOUNT = /^\d{1,4}([.,]\d{1,2})?$/

// Why a typed total is refused, or null when it is fine.
export function orderTotalProblem(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return 'Enter the order total (0 if it is free)'
  if (!EURO_AMOUNT.test(trimmed)) return 'Use an amount like 12,50'
  if (Number(trimmed.replace(',', '.')) > ORDER_TOTAL_MAX) return 'That is over 1000 €, check the amount'
  return null
}

// The typed total as a number ("12,50" is 12.5), or null when the text is refused.
export function parseEuroAmount(text: string): number | null {
  if (orderTotalProblem(text) !== null) return null
  return Number(text.trim().replace(',', '.'))
}

// ─── Ready in (AC-6) ──────────────────────────────────────────────────────────

// `as const` keeps the exact numbers as the type (0 | 10 | 15 | 20 | 30), not just `number`.
export const READY_IN_MINUTES = [0, 10, 15, 20, 30] as const
export type ReadyInMinutes = (typeof READY_IN_MINUTES)[number]

// The moment the order is ready: now plus the chosen minutes ("Now" is plus 0), as ISO text.
export function readyAtFromMinutes(minutes: number, now: Date = new Date()): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}

// ─── The price (AC-12) ────────────────────────────────────────────────────────

// A price is past its `expiresAt`. A quote with no `expiresAt` never expires in the page.
export function isQuoteExpired(quote: { expiresAt: string | null }, now: number = Date.now()): boolean {
  if (!quote.expiresAt) return false
  return Date.parse(quote.expiresAt) <= now
}

// The backend refused to send because of the quote itself: expired (QUOTE_HAS_EXPIRED) or unknown
// (a 404). The page then asks for a new price instead of showing an error.
export function isQuoteFailure(error: unknown): boolean {
  const err = error as { code?: string; statusCode?: number } | undefined
  return err?.code === 'QUOTE_HAS_EXPIRED' || err?.code === 'NOT_FOUND' || err?.statusCode === 404
}

// ─── Floor and doorbell, and the note (AC-8) ──────────────────────────────────

export const FLOOR_AND_BELL_MAX = 60
export const RIDER_NOTE_MAX = 250

// The counter shows once this share of the limit is used (48 of 60, 200 of 250).
export const COUNTER_FROM_SHARE = 0.8

// The one text the rider reads: "Floor and doorbell: <value>" on the first line, the note on the
// second, either line left out when empty, an empty string when both are. Built only at sending,
// never written back into the form or the saved customer.
export function composeRiderNote(floorAndBell: string | undefined, note: string | undefined): string {
  const floor = (floorAndBell ?? '').trim()
  const rest = (note ?? '').trim()
  return [floor ? `Floor and doorbell: ${floor}` : '', rest].filter(Boolean).join('\n')
}

// ─── The address search's area preference (AC-10) ─────────────────────────────

export interface GeoPoint {
  latitude: number
  longitude: number
}

// About 15 km around a point at Volos's latitude (39.4°): 0.14° of latitude and 0.18° of longitude.
const VIEWBOX_HALF_LAT = 0.14
const VIEWBOX_HALF_LON = 0.18

// Nominatim's `viewbox` (left, top, right, bottom): it makes results near the point come first, without
// `bounded`, so an address further away can still be found.
export function nearbyViewbox(point: GeoPoint): string {
  const { latitude, longitude } = point
  return [
    longitude - VIEWBOX_HALF_LON,
    latitude + VIEWBOX_HALF_LAT,
    longitude + VIEWBOX_HALF_LON,
    latitude - VIEWBOX_HALF_LAT,
  ]
    .map((value) => value.toFixed(5))
    .join(',')
}
