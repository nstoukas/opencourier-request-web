/**
 * Spec 0046 (row 10): an order too big for one box goes as N ordinary deliveries ("legs") sharing one
 * order reference, each labelled "Leg 1 of 2", each priced and paid in full on its own. The storefront
 * (this app) works the legs out; the backend only stores the labels. These are the pure rules the order
 * form, the order page and the history share.
 */
import { formatMoney } from '../../../utils/format'
import {
  ManualRequestDeliveryInput,
  ManualRequestPackageSize,
  ManualRequestQuoteDto,
  ManualRequestQuoteInput,
  PartnerDeliveryDto,
} from '../types'

// "How many boxes?" goes from 1 to 4 (AC-2; the backend refuses more than 4 legs).
export const MAX_BOXES = 4
export const BOX_COUNTS = [1, 2, 3, 4] as const

export function legLabel(legNumber: number, legCount: number): string {
  return `Leg ${legNumber} of ${legCount}`
}

// The price a quote shows: its single figure, or the lower end of a range (the delivery is charged its
// quote, which the backend keeps; a range only appears with the old random pricing).
function quoteCents(quote: ManualRequestQuoteDto): number {
  return quote.quoteRangeFrom
}

// AC-2 and cross check 7: the total before Confirm. The same price on every leg reads
// "2 deliveries × 3,80 € = 7,60 €"; prices that differ get one line per leg, then the total.
export function legPriceLines(quotes: ManualRequestQuoteDto[]): string[] {
  if (quotes.length < 2) return []
  const currency = quotes[0].currency
  const prices = quotes.map(quoteCents)
  const total = prices.reduce((sum, cents) => sum + cents, 0)
  if (prices.every((cents) => cents === prices[0])) {
    return [`${quotes.length} deliveries × ${formatMoney(prices[0], currency)} = ${formatMoney(total, currency)}`]
  }
  return [
    ...prices.map((cents, index) => `${legLabel(index + 1, quotes.length)}: ${formatMoney(cents, currency)}`),
    `Total ${formatMoney(total, currency)}`,
  ]
}

// Cross check 1: the reference every leg shares. The form has no typed reference, so it is the first
// leg's quote id (the same rule a single delivery already follows); a typed one would be `typed#quoteId`.
export function orderReferenceForLegs(firstQuoteId: string, typed?: string | null): string {
  const trimmed = typed?.trim()
  return trimmed ? `${trimmed}#${firstQuoteId}` : firstQuoteId
}

// AC-2 and cross check 6: one leg's delivery body. Every leg carries the items and notes; the order total
// goes on leg 1 only, so a report adding the legs up does not count it twice. Each leg has its own key.
export function legDeliveryInput(
  base: ManualRequestDeliveryInput,
  leg: { legNumber: number; legCount: number; quote: ManualRequestQuoteDto; boxSize: ManualRequestPackageSize; orderReference: string },
): ManualRequestDeliveryInput {
  return {
    ...base,
    quoteId: leg.quote.id,
    idempotencyKey: `${leg.quote.id}-${Date.now()}-${leg.legNumber}`,
    boxSize: leg.boxSize,
    orderReference: leg.orderReference,
    legNumber: leg.legNumber,
    legCount: leg.legCount,
    orderTotalValue: leg.legNumber === 1 ? base.orderTotalValue : 0,
  }
}

// Cross check 8: the legs "Cancel all" still cancels; one already delivered, cancelled or failed is skipped.
const ENDED_STATUSES = new Set(['DROPPED_OFF', 'DELIVERED', 'CANCELED', 'FAILED'])
export function legsToCancel(legs: PartnerDeliveryDto[]): PartnerDeliveryDto[] {
  return legs.filter((leg) => !ENDED_STATUSES.has(leg.status))
}

// One row of the order history: a single delivery, or the legs of one order together (AC-6).
export type HistoryItem =
  | { kind: 'single'; delivery: PartnerDeliveryDto }
  | { kind: 'order'; key: string; legCount: number; legs: PartnerDeliveryDto[] }

// AC-6: groups the legs of one order (same reference, both labels set) at the place of its first leg in the
// list, legs by number. A single delivery stays as it is. The list is a page, so an order whose legs fall on
// two pages shows on each with the legs that page holds.
export function groupHistory(deliveries: PartnerDeliveryDto[]): HistoryItem[] {
  const items: HistoryItem[] = []
  const orders = new Map<string, Extract<HistoryItem, { kind: 'order' }>>()
  for (const delivery of deliveries) {
    if (!delivery.legCount || !delivery.legNumber || !delivery.orderReference) {
      items.push({ kind: 'single', delivery })
      continue
    }
    const existing = orders.get(delivery.orderReference)
    if (existing) {
      existing.legs.push(delivery)
      existing.legs.sort((a, b) => (a.legNumber ?? 0) - (b.legNumber ?? 0))
      continue
    }
    const order = { kind: 'order' as const, key: delivery.orderReference, legCount: delivery.legCount, legs: [delivery] }
    orders.set(delivery.orderReference, order)
    items.push(order)
  }
  return items
}

// The leg numbers of an order that the list or the page does not hold (cross check 4).
export function absentLegNumbers(legCount: number, legs: PartnerDeliveryDto[]): number[] {
  const present = new Set(legs.map((leg) => leg.legNumber))
  return Array.from({ length: legCount }, (_, index) => index + 1).filter((number) => !present.has(number))
}

// AC-3 and cross check 4: a missing leg is sent again from a leg that was sent: the same customer, address,
// notes and items, a fresh quote, and the size the restaurant picks now (the page never knew the lost leg's).
export function retryQuoteInput(sent: PartnerDeliveryDto): ManualRequestQuoteInput {
  const pickup = sent.pickup
  const dropoff = sent.dropoff
  const address = (location: typeof pickup | typeof dropoff) => ({
    streetAddress: [location?.street ?? location?.addressLine1 ?? ''],
    city: location?.city ?? '',
    state: location?.state ?? '',
    zipCode: location?.zipCode ?? '',
    countryCode: location?.countryCode ?? 'GR',
    // Empty, as the form sends it: the backend shares one address row per street and point.
    houseNumber: '',
    formattedAddress: location?.formattedAddress ?? '',
  })
  return {
    pickupName: pickup?.pickupName ?? '',
    pickupPhoneNumber: pickup?.pickupPhoneNumber ?? '',
    pickupBusinessName: pickup?.pickupBusinessName ?? '',
    pickupAddress: address(pickup),
    pickupLatitude: pickup?.latitude ?? 0,
    pickupLongitude: pickup?.longitude ?? 0,
    pickupReadyAt: sent.readyAt ?? sent.pickupReadyAt ?? null,
    pickupDeadlineAt: null,
    dropoffName: dropoff?.dropoffName ?? '',
    dropoffPhoneNumber: dropoff?.dropoffPhoneNumber ?? '',
    dropoffNotes: dropoff?.dropoffNotes ?? '',
    dropoffSellerNotes: dropoff?.dropoffSellerNotes ?? '',
    dropoffFloor: dropoff?.dropoffFloor ?? null,
    dropoffDoorbell: dropoff?.dropoffDoorbell ?? null,
    dropoffAddress: address(dropoff),
    dropoffLatitude: dropoff?.latitude ?? 0,
    dropoffLongitude: dropoff?.longitude ?? 0,
    dropoffReadyAt: null,
    dropoffDeadlineAt: null,
    orderTotalValue: 0,
  }
}
