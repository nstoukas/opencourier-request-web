// Spec 0047 (AC-8, AC-10): the one function that words what the backend decided about a split at pickup,
// so the order page, the history card and a single row can never disagree.
import { LEFT_UNSPLIT_TEXT, splitOutcomeLine } from './splitOutcome'

describe('splitOutcomeLine (spec 0047, AC-8, AC-10)', () => {
  describe('an order split by dispatch (AC-10)', () => {
    it('says "Split at pickup, now in 2 deliveries" for an order that is now 2 deliveries', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: 2 })).toBe('Split at pickup, now in 2 deliveries')
    })

    it.each([3, 4])('the number is the legCount the server sent: %i', (legCount) => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount })).toBe(`Split at pickup, now in ${legCount} deliveries`)
    })

    it('says nothing rather than a sentence with no number when the count is missing', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: null })).toBeNull()
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: undefined } as any)).toBeNull()
    })

    it('never says "now in 1 deliveries"', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: 1 })).toBeNull()
    })

    // Row 11 review (decision 11.8): "Split into 3" was untrue for an order sent as 2 with one leg split
    // again, so the sentence no longer claims the split itself made N.
    it('no longer says "Split into N"', () => {
      expect(splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: 3 })).not.toMatch(/Split into/)
    })
  })

  describe('an order the rider left because nobody answered in time (AC-8)', () => {
    it("says the spec's sentence, word for word", () => {
      expect(LEFT_UNSPLIT_TEXT).toBe("Cancelled: didn't fit one box, send it again with the right sizes")
      expect(splitOutcomeLine({ splitOutcome: 'LEFT', legCount: null })).toBe(
        "Cancelled: didn't fit one box, send it again with the right sizes"
      )
    })

    it('says the same for an order that was already a leg', () => {
      expect(splitOutcomeLine({ splitOutcome: 'LEFT', legCount: 2 })).toBe(LEFT_UNSPLIT_TEXT)
    })
  })

  describe('everything else says nothing', () => {
    it('an order that was never split (null)', () => {
      expect(splitOutcomeLine({ splitOutcome: null, legCount: null })).toBeNull()
    })

    it('an ordinary multi leg order the restaurant sent as legs itself', () => {
      expect(splitOutcomeLine({ splitOutcome: null, legCount: 2 })).toBeNull()
    })

    it('an answer from an older server, with no splitOutcome at all', () => {
      expect(splitOutcomeLine({ legCount: 2 } as any)).toBeNull()
      expect(splitOutcomeLine({ legCount: null } as any)).toBeNull()
    })
  })
})
