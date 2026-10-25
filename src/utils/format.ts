// How money and times read in the restaurant portal: Greek formats, the euro after the
// number with a decimal comma (3,38 €), dates day first, and the 24 hour clock (23:25).
// One place for these, so every page shows the same thing.
// Times are shown on Greek time (Europe/Athens) whatever the computer's own time zone is:
// the co-op serves Volos, so a laptop left on another zone must not shift an ETA.
const TIME_ZONE = 'Europe/Athens'

// Intl.NumberFormat and Intl.DateTimeFormat are built into every browser and Node; the
// 'el-GR' locale gives the Greek separators and order. Built once, reused on every call.
const DATE_TIME = new Intl.DateTimeFormat('el-GR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})

const TIME = new Intl.DateTimeFormat('el-GR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})

/** Money stored as cents, for example 338 with 'EUR' reads "3,38 €". Missing reads "—". */
export function formatMoney(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(cents / 100)
}

/** A date and time, for example "30/09/2026, 23:25". Missing reads "—". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return DATE_TIME.format(new Date(iso))
}

/** Only the time of day, for example "23:25". Missing reads "—". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return TIME.format(new Date(iso))
}

/** A distance with its unit, one decimal, for example 2.43 and 'KM' read "2,4 km". */
export function formatDistance(value: number | null | undefined, unit: string | null | undefined): string {
  if (value == null) return '—'
  const number = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 1 }).format(value)
  return unit ? `${number} ${unit.toLowerCase()}` : number
}
