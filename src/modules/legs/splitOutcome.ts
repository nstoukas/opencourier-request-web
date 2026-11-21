import type { PartnerDeliveryDto } from '../manual-request/types'

/**
 * Spec 0047 (row 11): what the restaurant is told when a rider found its order would not fit one box.
 * The backend decides the outcome (`splitOutcome`); this only words it, so every page says the same.
 */

// AC-8: the rider waited past the co-op's limit with no answer from dispatch and left; the order was
// cancelled as the restaurant's, so it is sent again with the right sizes.
export const LEFT_UNSPLIT_TEXT = "Cancelled: didn't fit one box, send it again with the right sizes"

// AC-10: "Split at pickup, now in 2 deliveries". The count is the order's deliveries after the split
// (`legCount`), so the sentence stays true when an order sent as 2 had one leg split again (row 11 review).
export function splitOutcomeLine(delivery: Pick<PartnerDeliveryDto, 'splitOutcome' | 'legCount'>): string | null {
  if (delivery.splitOutcome === 'LEFT') return LEFT_UNSPLIT_TEXT
  if (delivery.splitOutcome === 'SPLIT' && delivery.legCount && delivery.legCount > 1) {
    return `Split at pickup, now in ${delivery.legCount} deliveries`
  }
  return null
}

// Operator, 2026-11-21 (decision 11.10): the restaurant is told what a split costs it, and why a leg the
// split made shows no cost. The charges themselves are on the co-op's statement (spec 0036), not here.
// Each sentence must stay true whatever happened next: a new leg's charge is taken back if it ends before
// any rider accepted it (spec 0047, cross check 5), and the split wait is charged only when the co-op pays
// waits (cross check 1).
export const SPLIT_CHARGE_NOTE =
  "Each extra box a rider takes is charged to you at its rider's pay, and the rider's wait while dispatch decided when the co-op pays waits, on the co-op's statement. The customer pays nothing more."
export const SPLIT_LEG_COST_NOTE =
  "No cost to the customer: this delivery was made by the split. Once a rider takes it, its rider's pay is charged to you on the co-op's statement."
// This page cannot tell whether a rider ever accepted an ended leg (one taken off later leaves no rider on
// it either), so the ended leg states the rule rather than guess.
export const SPLIT_LEG_ENDED_NOTE =
  'No cost to the customer: this delivery was made by the split. It ended; if no rider had accepted it, nothing is charged for it.'

const ENDED = new Set(['CANCELED', 'FAILED'])

// A leg the split made has no customer cost: null until its first offer (the backend writes the amounts
// then), 0 after (its quote's price is 0). The kept leg always has its own cost, since a rider holds it.
export function splitChargeNote(
  delivery: Pick<PartnerDeliveryDto, 'splitOutcome' | 'totalCost' | 'status'>
): string | null {
  if (delivery.splitOutcome !== 'SPLIT') return null
  if (delivery.totalCost) return SPLIT_CHARGE_NOTE
  return ENDED.has(delivery.status) ? SPLIT_LEG_ENDED_NOTE : SPLIT_LEG_COST_NOTE
}
