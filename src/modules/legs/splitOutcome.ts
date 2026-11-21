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
