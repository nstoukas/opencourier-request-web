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

// The typed total in whole cents, as the backend keeps money ("12,50" is 1250; decision 27.5), or null
// when the text is refused. Rounded because 0.29 * 100 is 28.999… in floating point, not 29.
export function euroAmountToCents(text: string): number | null {
  const euros = parseEuroAmount(text)
  return euros === null ? null : Math.round(euros * 100)
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

// ─── Floor, doorbell and the note (spec 0016, AC-1 and AC-2) ──────────────────

// The backend's column sizes (Delivery.dropoffFloor and dropoffDoorbell, SavedCustomer.floor and doorbell).
export const FLOOR_MAX = 20
export const DOORBELL_MAX = 60
export const RIDER_NOTE_MAX = 250
// Delivery.dropoffNotes and dropoffSellerNotes are 255 characters in the database.
export const DELIVERY_NOTE_COLUMN_MAX = 255

// The counter shows once this share of the limit is used (16 of 20, 48 of 60, 200 of 250).
export const COUNTER_FROM_SHARE = 0.8

// The note the rider app shows (dropoffSellerNotes): only the restaurant's note now. Floor and doorbell
// travel in their own fields (spec 0016, AC-2).
export function riderNoteText(note: string | undefined): string {
  return cutToCharacters((note ?? '').trim(), DELIVERY_NOTE_COLUMN_MAX)
}

// The note admin shows (dropoffNotes): "Floor: 3 · Doorbell: Papadopoulou" on the first line (each part
// left out when empty, the line left out when both are), then the note. Admin pages read floor and
// doorbell only here until they show the new fields. Cut to the column's 255 characters by shortening
// the note, never the floor line. Built only at sending, never written back into the form.
export function composeAdminNote(
  floor: string | undefined,
  doorbell: string | undefined,
  note: string | undefined,
): string {
  const floorText = (floor ?? '').trim()
  const doorbellText = (doorbell ?? '').trim()
  const noteText = (note ?? '').trim()
  const firstLine = [floorText ? `Floor: ${floorText}` : '', doorbellText ? `Doorbell: ${doorbellText}` : '']
    .filter(Boolean)
    .join(' · ')
  if (!firstLine) return cutToCharacters(noteText, DELIVERY_NOTE_COLUMN_MAX)
  if (!noteText) return firstLine
  const room = DELIVERY_NOTE_COLUMN_MAX - firstLine.length - 1
  return room > 0 ? `${firstLine}\n${cutToCharacters(noteText, room)}` : firstLine
}

// The first `max` characters of a text. `Array.from` splits by character (code point), the way
// Postgres counts a VarChar, so an emoji is never cut in half (`slice` counts UTF-16 units, and half an
// emoji arrives as a replacement character).
function cutToCharacters(text: string, max: number): string {
  const characters = Array.from(text)
  return characters.length <= max ? text : characters.slice(0, max).join('')
}

// ─── The drop off pin (spec 0016, AC-4) ───────────────────────────────────────

// The zoom the pin map opens at: about one building across a phone screen.
export const PIN_MAP_ZOOM = 17

// Where the map opens when a typed address is not found and the restaurant's own pickup point is not
// usable: Volos centre (the instance this page serves).
export const VOLOS_CENTRE = { latitude: 39.3622, longitude: 22.9425 }

// A drop off point the restaurant confirmed, and the address it was confirmed for (`addressPinKey`).
// The pin counts as confirmed only while the form still holds exactly this point and this address.
export interface ConfirmedPin {
  latitude: number
  longitude: number
  pinKey: string
}

export function isPinConfirmed(
  confirmed: ConfirmedPin | null,
  latitude: number,
  longitude: number,
  pinKey: string,
): boolean {
  return (
    confirmed !== null &&
    confirmed.latitude === latitude &&
    confirmed.longitude === longitude &&
    confirmed.pinKey === pinKey
  )
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
