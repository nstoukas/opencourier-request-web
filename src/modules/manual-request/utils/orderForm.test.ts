import {
  orderTotalProblem,
  parseEuroAmount,
  readyAtFromMinutes,
  composeRiderNote,
  nearbyViewbox,
  isQuoteExpired,
  isQuoteFailure,
  ORDER_TOTAL_MAX,
  FLOOR_AND_BELL_MAX,
  RIDER_NOTE_MAX,
  COUNTER_FROM_SHARE,
  READY_IN_MINUTES,
} from './orderForm'

describe('orderForm pure utilities (spec 0006)', () => {
  describe('orderTotalProblem and parseEuroAmount (AC-4)', () => {
    it('accepts valid amounts including 0, integers, decimal comma and dot, and trims whitespace', () => {
      expect(orderTotalProblem('0')).toBeNull()
      expect(parseEuroAmount('0')).toBe(0)

      expect(orderTotalProblem('0,00')).toBeNull()
      expect(parseEuroAmount('0,00')).toBe(0)

      expect(orderTotalProblem('0.0')).toBeNull()
      expect(parseEuroAmount('0.0')).toBe(0)

      expect(orderTotalProblem('12,50')).toBeNull()
      expect(parseEuroAmount('12,50')).toBe(12.5)

      expect(orderTotalProblem('12.50')).toBeNull()
      expect(parseEuroAmount('12.50')).toBe(12.5)

      expect(orderTotalProblem(' 12,50 ')).toBeNull()
      expect(parseEuroAmount(' 12,50 ')).toBe(12.5)

      expect(orderTotalProblem('12.5')).toBeNull()
      expect(parseEuroAmount('12.5')).toBe(12.5)

      expect(orderTotalProblem('1000')).toBeNull()
      expect(parseEuroAmount('1000')).toBe(1000)

      expect(orderTotalProblem('1000,00')).toBeNull()
      expect(parseEuroAmount('1000,00')).toBe(1000)
    })

    it('refuses empty string or only whitespace with exact message', () => {
      const expectedMessage = 'Enter the order total (0 if it is free)'
      expect(orderTotalProblem('')).toBe(expectedMessage)
      expect(parseEuroAmount('')).toBeNull()

      expect(orderTotalProblem('   ')).toBe(expectedMessage)
      expect(parseEuroAmount('   ')).toBeNull()
    })

    it('refuses invalid formats (.5, 12., 1.000, €12, -3, etc.) with exact message', () => {
      const expectedMessage = 'Use an amount like 12,50'
      const invalidInputs = ['.5', '12.', '1.000', '1.000,50', '€12', '-3', 'abc', '12,505']
      for (const input of invalidInputs) {
        expect(orderTotalProblem(input)).toBe(expectedMessage)
        expect(parseEuroAmount(input)).toBeNull()
      }
    })

    it('refuses amounts over 1000 with exact message', () => {
      const expectedMessage = 'That is over 1000 €, check the amount'
      expect(orderTotalProblem('1000,01')).toBe(expectedMessage)
      expect(parseEuroAmount('1000,01')).toBeNull()

      expect(orderTotalProblem('1001')).toBe(expectedMessage)
      expect(parseEuroAmount('1001')).toBeNull()

      expect(orderTotalProblem('2500,50')).toBe(expectedMessage)
      expect(parseEuroAmount('2500,50')).toBeNull()
    })
  })

  describe('composeRiderNote (AC-8, AC-9)', () => {
    it('composes both floorAndBell and note as a two-line text', () => {
      const result = composeRiderNote('3rd floor, Papadopoulou', 'Ring twice, dog in the yard')
      expect(result).toBe('Floor and doorbell: 3rd floor, Papadopoulou\nRing twice, dog in the yard')
    })

    it('leaves out second line when note is empty or undefined', () => {
      expect(composeRiderNote('3rd floor, Papadopoulou', '')).toBe('Floor and doorbell: 3rd floor, Papadopoulou')
      expect(composeRiderNote('  2nd floor  ', undefined)).toBe('Floor and doorbell: 2nd floor')
      expect(composeRiderNote('2nd floor', '   ')).toBe('Floor and doorbell: 2nd floor')
    })

    it('leaves out first line when floorAndBell is empty or undefined', () => {
      expect(composeRiderNote('', 'Ring twice')).toBe('Ring twice')
      expect(composeRiderNote(undefined, '  Ring twice  ')).toBe('Ring twice')
      expect(composeRiderNote('   ', 'Ring twice')).toBe('Ring twice')
    })

    it('returns empty string when both are empty or undefined', () => {
      expect(composeRiderNote('', '')).toBe('')
      expect(composeRiderNote(undefined, undefined)).toBe('')
      expect(composeRiderNote('   ', '   ')).toBe('')
    })
  })

  describe('readyAtFromMinutes (AC-6)', () => {
    it('computes ISO time string from now plus chosen minutes', () => {
      const baseTime = new Date('2026-10-27T10:00:00.000Z')
      expect(readyAtFromMinutes(0, baseTime)).toBe('2026-10-27T10:00:00.000Z')
      expect(readyAtFromMinutes(10, baseTime)).toBe('2026-10-27T10:10:00.000Z')
      expect(readyAtFromMinutes(15, baseTime)).toBe('2026-10-27T10:15:00.000Z')
      expect(readyAtFromMinutes(20, baseTime)).toBe('2026-10-27T10:20:00.000Z')
      expect(readyAtFromMinutes(30, baseTime)).toBe('2026-10-27T10:30:00.000Z')
    })

    it('supports READY_IN_MINUTES options', () => {
      expect(READY_IN_MINUTES).toEqual([0, 10, 15, 20, 30])
    })
  })

  describe('nearbyViewbox (AC-10)', () => {
    it('creates a ~15 km viewbox string (left, top, right, bottom) formatted to 5 decimals', () => {
      const point = { latitude: 39.3628, longitude: 22.9435 }
      const viewbox = nearbyViewbox(point)
      // longitude - 0.18 = 22.76350, latitude + 0.14 = 39.50280
      // longitude + 0.18 = 23.12350, latitude - 0.14 = 39.22280
      expect(viewbox).toBe('22.76350,39.50280,23.12350,39.22280')
    })
  })

  describe('isQuoteExpired and isQuoteFailure (AC-12)', () => {
    it('isQuoteExpired returns false when expiresAt is null or in the future', () => {
      expect(isQuoteExpired({ expiresAt: null }, 1000)).toBe(false)

      const futureIso = new Date(Date.now() + 60_000).toISOString()
      expect(isQuoteExpired({ expiresAt: futureIso })).toBe(false)
    })

    it('isQuoteExpired returns true when expiresAt is in the past', () => {
      const pastIso = new Date(Date.now() - 1_000).toISOString()
      expect(isQuoteExpired({ expiresAt: pastIso })).toBe(true)
    })

    it('isQuoteFailure recognizes expired quote and not found errors', () => {
      expect(isQuoteFailure({ code: 'QUOTE_HAS_EXPIRED' })).toBe(true)
      expect(isQuoteFailure({ code: 'NOT_FOUND' })).toBe(true)
      expect(isQuoteFailure({ statusCode: 404 })).toBe(true)
      expect(isQuoteFailure({ status: 404 })).toBe(false) // only statusCode: 404 or code
      expect(isQuoteFailure({ code: 'INTERNAL_ERROR' })).toBe(false)
      expect(isQuoteFailure({ statusCode: 500 })).toBe(false)
      expect(isQuoteFailure(null)).toBe(false)
    })
  })

  describe('constants', () => {
    it('matches spec limits', () => {
      expect(ORDER_TOTAL_MAX).toBe(1000)
      expect(FLOOR_AND_BELL_MAX).toBe(60)
      expect(RIDER_NOTE_MAX).toBe(250)
      expect(COUNTER_FROM_SHARE).toBe(0.8)
    })
  })
})
