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
// split made shows a cost of 0. The charge itself is on the co-op's statement (spec 0036), not here.
export const SPLIT_CHARGE_NOTE =
  "Each extra box's rider pay is charged to you on the co-op's statement. The customer pays nothing more."
export const SPLIT_LEG_COST_NOTE =
  "Cost 0 for the customer: this delivery was made by the split. Its rider's pay is charged to you on the co-op's statement."

// The backend takes a leg's charge back when it ends before any rider accepted it (spec 0047, cross check
// 5). This page cannot tell whether one did (a rider taken off later leaves no rider on the leg either), so an
// ended leg states the rule rather than guess.
export const SPLIT_LEG_ENDED_NOTE =
  'Cost 0 for the customer: this delivery was made by the split. It ended; if no rider had accepted it, nothing is charged for it.'

const ENDED = new Set(['CANCELED', 'FAILED'])

// A leg the split made carries a quote with customer price 0 (the kept leg keeps its own price).
export function splitChargeNote(
  delivery: Pick<PartnerDeliveryDto, 'splitOutcome' | 'totalCost' | 'status'>
): string | null {
  if (delivery.splitOutcome !== 'SPLIT') return null
  if (delivery.totalCost !== 0) return SPLIT_CHARGE_NOTE
  return ENDED.has(delivery.status) ? SPLIT_LEG_ENDED_NOTE : SPLIT_LEG_COST_NOTE
}
