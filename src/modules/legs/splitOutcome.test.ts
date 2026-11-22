// Spec 0047 (AC-8, AC-10): the one function that words what the backend decided about a split at pickup,
// so the order page, the history card and a single row can never disagree.
import { createI18n } from '../../i18n/createI18n'
import {
  LEFT_UNSPLIT_TEXT,
  SPLIT_CHARGE_NOTE,
  SPLIT_LEG_COST_NOTE,
  SPLIT_LEG_ENDED_NOTE,
  splitChargeNote,
  splitOutcomeLine,
} from './splitOutcome'

const enI18n = createI18n('en')
const t = enI18n.t

describe('splitOutcomeLine (spec 0047, AC-8, AC-10)', () => {
  describe('an order split by dispatch (AC-10)', () => {
    it('says "Split at pickup, now in 2 deliveries" for an order that is now 2 deliveries', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: 2 }, t)).toBe('Split at pickup, now in 2 deliveries')
    })

    it.each([3, 4])('the number is the legCount the server sent: %i', (legCount) => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount }, t)).toBe(`Split at pickup, now in ${legCount} deliveries`)
    })

    it('says nothing rather than a sentence with no number when the count is missing', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: null }, t)).toBeNull()
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: undefined } as any, t)).toBeNull()
    })

    it('never says "now in 1 deliveries"', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: 1 }, t)).toBeNull()
    })

    // Row 11 review (decision 11.8): "Split into 3" was untrue for an order sent as 2 with one leg split
    // again, so the sentence no longer claims the split itself made N.
    it('no longer says "Split into N"', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: 3 }, t)).not.toMatch(/Split into/)
    })
  })

  describe('an order the rider left because nobody answered in time (AC-8)', () => {
    it("says the spec's sentence, word for word", () => {
      expect(LEFT_UNSPLIT_TEXT).toBe('split.leftUnsplit')
      expect(t(LEFT_UNSPLIT_TEXT)).toBe("Cancelled: didn't fit one box, send it again with the right sizes")
      expect(splitOutcomeLine({ splitOutcome: 'LEFT', legCount: null }, t)).toBe(
        "Cancelled: didn't fit one box, send it again with the right sizes"
      )
    })

    it('says the same for an order that was already a leg', () => {
      expect(splitOutcomeLine({ splitOutcome: 'LEFT', legCount: 2 }, t)).toBe(t(LEFT_UNSPLIT_TEXT))
    })
  })

  describe('everything else says nothing', () => {
    it('an order that was never split (null)', () => {
      expect(splitOutcomeLine({ splitOutcome: null, legCount: null }, t)).toBeNull()
    })

    it('an ordinary multi leg order the restaurant sent as legs itself', () => {
      expect(splitOutcomeLine({ splitOutcome: null, legCount: 2 }, t)).toBeNull()
    })

    it('an answer from an older server, with no splitOutcome at all', () => {
      expect(splitOutcomeLine({ legCount: 2 } as any, t)).toBeNull()
      expect(splitOutcomeLine({ legCount: null } as any, t)).toBeNull()
    })
  })
})

// Decision 11.10 (operator, 2026-11-21): the restaurant is told a split brings a charge, and why a delivery
// the split made shows no cost. Such a delivery has totalCost null until its first offer and 0 after. Spec 0047 cross check 5: that charge is taken back when the new delivery
// ends without any rider ever accepting it, so an ended one must not be told it is charged.
describe('splitChargeNote (row 11, decision 11.10)', () => {
  // A sentence that tells the restaurant, as a fact, that it is charged.
  const CLAIMS_A_CHARGE = /is charged to you/

  describe('the three sentences', () => {
    it('the split order: a charge, where it shows, and nothing more for the customer', () => {
      expect(SPLIT_CHARGE_NOTE).toBe('split.chargeNote')
      expect(t(SPLIT_CHARGE_NOTE)).toBe(
        "Each extra box a rider takes is charged to you at its rider's pay, and the rider's wait while dispatch decided when the co-op pays waits, on the co-op's statement. The customer pays nothing more."
      )
      expect(t(SPLIT_CHARGE_NOTE)).toMatch(CLAIMS_A_CHARGE)
      // Cross check 11: the charge itself is on the co-op's statement, not on this page.
      expect(t(SPLIT_CHARGE_NOTE)).toMatch(/co-op's statement/)
      expect(t(SPLIT_CHARGE_NOTE)).toMatch(/customer pays nothing more/i)
    })

    it('the delivery the split made: why it shows no cost, and that its rider is still paid by the restaurant', () => {
      expect(SPLIT_LEG_COST_NOTE).toBe('split.legCostNote')
      expect(t(SPLIT_LEG_COST_NOTE)).toMatch(/^No cost to the customer:/)
      expect(t(SPLIT_LEG_COST_NOTE)).toMatch(/made by the split/)
      expect(t(SPLIT_LEG_COST_NOTE)).toMatch(CLAIMS_A_CHARGE)
      expect(t(SPLIT_LEG_COST_NOTE)).toMatch(/co-op's statement/)
    })

    it('the one that ended: why it shows no cost, and the rule, never a claim that it is charged', () => {
      expect(SPLIT_LEG_ENDED_NOTE).toBe('split.legEndedNote')
      expect(t(SPLIT_LEG_ENDED_NOTE)).toMatch(/^No cost to the customer:/)
      expect(t(SPLIT_LEG_ENDED_NOTE)).toMatch(/made by the split/)
      expect(t(SPLIT_LEG_ENDED_NOTE)).toMatch(/if no rider had accepted it, nothing is charged/)
      expect(t(SPLIT_LEG_ENDED_NOTE)).not.toMatch(CLAIMS_A_CHARGE)
    })

    it('are three different sentences', () => {
      expect(new Set([SPLIT_CHARGE_NOTE, SPLIT_LEG_COST_NOTE, SPLIT_LEG_ENDED_NOTE]).size).toBe(3)
    })
  })

  describe('no split, no note', () => {
    it.each(['ASSIGNING_COURIER', 'PICKED_UP', 'DROPPED_OFF', 'CANCELED'])('an order never split, %s', (status) => {
      expect(splitChargeNote({ splitOutcome: null, totalCost: 356, status })).toBeNull()
    })

    it.each([0, null])('an order never split whose cost is %p', (totalCost) => {
      expect(splitChargeNote({ splitOutcome: null, totalCost, status: 'ASSIGNING_COURIER' })).toBeNull()
      expect(splitChargeNote({ splitOutcome: null, totalCost, status: 'CANCELED' })).toBeNull()
    })

    it('an answer from an older server, with no splitOutcome at all', () => {
      expect(splitChargeNote({ totalCost: 356, status: 'ACCEPTED' } as any)).toBeNull()
      expect(splitChargeNote({ totalCost: 0, status: 'ACCEPTED' } as any)).toBeNull()
    })

    // A left order was never split: there is no extra delivery and no charge to explain.
    it('an order the rider left (LEFT), whatever its cost', () => {
      expect(splitChargeNote({ splitOutcome: 'LEFT', totalCost: 356, status: 'CANCELED' })).toBeNull()
      expect(splitChargeNote({ splitOutcome: 'LEFT', totalCost: 0, status: 'CANCELED' })).toBeNull()
      expect(splitChargeNote({ splitOutcome: 'LEFT', totalCost: null, status: 'CANCELED' })).toBeNull()
    })
  })

  describe('a split delivery that kept its own price', () => {
    it.each(['ASSIGNING_COURIER', 'ACCEPTED', 'PICKED_UP', 'DROPPED_OFF'])('says the charge note, %s', (status) => {
      expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost: 356, status })).toBe(SPLIT_CHARGE_NOTE)
    })

    it('does not explain a missing cost when it has one, however small', () => {
      expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost: 1, status: 'PICKED_UP' })).toBe(SPLIT_CHARGE_NOTE)
      expect(t(splitChargeNote({ splitOutcome: 'SPLIT', totalCost: 1, status: 'PICKED_UP' })!)).not.toMatch(/No cost to the customer/)
    })

    // The kept leg has its own price, so even ended it is not "a delivery made by the split".
    it.each(['CANCELED', 'FAILED'])('still says the charge note when it ended, %s', (status) => {
      expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost: 356, status })).toBe(SPLIT_CHARGE_NOTE)
    })
  })

  // null: the backend has not written the amounts yet (no offer so far). 0: its quote's price is 0.
  describe.each([
    ['0 (after its first offer)', 0],
    ['null (before its first offer)', null],
  ])('a delivery the split made, cost %s', (_label, totalCost) => {
    it.each(['ASSIGNING_COURIER', 'ACCEPTED', 'DISPATCHED', 'PICKED_UP', 'DROPPED_OFF'])(
      'open or delivered (%s): says why it shows no cost and that its rider is paid by the restaurant',
      (status) => {
        expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost, status })).toBe(SPLIT_LEG_COST_NOTE)
      }
    )

    // Cross check 5: the charge is taken back if it ended with no rider ever accepting it.
    it.each(['CANCELED', 'FAILED'])('ended (%s): states the rule', (status) => {
      expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost, status })).toBe(SPLIT_LEG_ENDED_NOTE)
    })

    it.each(['CANCELED', 'FAILED'])('ended (%s): never claims a charge the backend may have taken back', (status) => {
      const note = splitChargeNote({ splitOutcome: 'SPLIT', totalCost, status })
      expect(note).not.toBeNull()
      expect(t(note!)).not.toMatch(CLAIMS_A_CHARGE)
      expect(t(note!)).toMatch(/nothing is charged/)
    })

    it('never gets the plain charge note, which is the kept delivery\'s', () => {
      expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost, status: 'ASSIGNING_COURIER' })).not.toBe(SPLIT_CHARGE_NOTE)
      expect(splitChargeNote({ splitOutcome: 'SPLIT', totalCost, status: 'CANCELED' })).not.toBe(SPLIT_CHARGE_NOTE)
    })
  })
})
