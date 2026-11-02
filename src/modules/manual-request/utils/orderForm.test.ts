import {
  euroAmountToCents,
  orderTotalProblem,
  parseEuroAmount,
  readyAtFromMinutes,
  riderNoteText,
  composeAdminNote,
  isPinConfirmed,
  nearbyViewbox,
  isQuoteExpired,
  isQuoteFailure,
  ORDER_TOTAL_MAX,
  FLOOR_MAX,
  DOORBELL_MAX,
  RIDER_NOTE_MAX,
  DELIVERY_NOTE_COLUMN_MAX,
  COUNTER_FROM_SHARE,
  READY_IN_MINUTES,
  PIN_MAP_ZOOM,
  VOLOS_CENTRE,
  ConfirmedPin,
} from './orderForm'

describe('orderForm pure utilities (spec 0006 & 0016)', () => {
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

    it('AC-4: euroAmountToCents converts euro amounts to whole cents with rounding and handles refused text', () => {
      expect(euroAmountToCents('12,50')).toBe(1250)
      expect(euroAmountToCents('12.50')).toBe(1250)
      expect(euroAmountToCents('0')).toBe(0)
      expect(euroAmountToCents('1000')).toBe(100000)

      expect(euroAmountToCents('0,29')).toBe(29)
      expect(euroAmountToCents('1,15')).toBe(115)

      expect(euroAmountToCents('')).toBeNull()
      expect(euroAmountToCents('   ')).toBeNull()
      expect(euroAmountToCents('abc')).toBeNull()
      expect(euroAmountToCents('.5')).toBeNull()
      expect(euroAmountToCents('12.')).toBeNull()
      expect(euroAmountToCents('€12')).toBeNull()
      expect(euroAmountToCents('1000,01')).toBeNull()
    })
  })

  describe('riderNoteText (spec 0016, AC-2)', () => {
    it('trims note and cuts at 255 characters', () => {
      expect(riderNoteText('  Ring twice  ')).toBe('Ring twice')
      expect(riderNoteText(undefined)).toBe('')
      expect(riderNoteText('')).toBe('')
      expect(riderNoteText('   ')).toBe('')

      const longNote = 'a'.repeat(300)
      const result = riderNoteText(longNote)
      expect(result).toHaveLength(255)
      expect(result).toBe('a'.repeat(255))
    })

    it('never splits an emoji when cutting (cuts by character code points)', () => {
      // 🛵 is a surrogate pair (2 UTF-16 code units, 1 character code point)
      const prefix = 'a'.repeat(254)
      const text = prefix + '🛵'
      const result = riderNoteText(text)
      expect(result).toBe(prefix + '🛵')
      expect(Array.from(result)).toHaveLength(255)

      const textOver = prefix + '🛵🎉'
      const cut = riderNoteText(textOver)
      expect(cut).toBe(prefix + '🛵')
      expect(Array.from(cut)).toHaveLength(255)
    })
  })

  describe('composeAdminNote (spec 0016, AC-2)', () => {
    it('composes both floor and doorbell on first line, then note', () => {
      const result = composeAdminNote('3', 'Papadopoulou', 'Ring twice')
      expect(result).toBe('Floor: 3 · Doorbell: Papadopoulou\nRing twice')
    })

    it('composes floor only when doorbell is empty or undefined', () => {
      expect(composeAdminNote('3', '', 'Ring twice')).toBe('Floor: 3\nRing twice')
      expect(composeAdminNote('3', undefined, 'Ring twice')).toBe('Floor: 3\nRing twice')
      expect(composeAdminNote('3', '   ', 'Ring twice')).toBe('Floor: 3\nRing twice')
    })

    it('composes doorbell only when floor is empty or undefined', () => {
      expect(composeAdminNote('', 'Papadopoulou', 'Ring twice')).toBe('Doorbell: Papadopoulou\nRing twice')
      expect(composeAdminNote(undefined, 'Papadopoulou', 'Ring twice')).toBe('Doorbell: Papadopoulou\nRing twice')
      expect(composeAdminNote('   ', 'Papadopoulou', 'Ring twice')).toBe('Doorbell: Papadopoulou\nRing twice')
    })

    it('returns only the note when both floor and doorbell are empty or undefined', () => {
      expect(composeAdminNote('', '', 'Ring twice')).toBe('Ring twice')
      expect(composeAdminNote(undefined, undefined, 'Ring twice')).toBe('Ring twice')
      expect(composeAdminNote('   ', '   ', 'Ring twice')).toBe('Ring twice')
    })

    it('returns only the floor line when note is empty or undefined', () => {
      expect(composeAdminNote('3', 'Papadopoulou', '')).toBe('Floor: 3 · Doorbell: Papadopoulou')
      expect(composeAdminNote('3', 'Papadopoulou', undefined)).toBe('Floor: 3 · Doorbell: Papadopoulou')
      expect(composeAdminNote('3', 'Papadopoulou', '   ')).toBe('Floor: 3 · Doorbell: Papadopoulou')
    })

    it('returns empty string when floor, doorbell, and note are all empty or undefined', () => {
      expect(composeAdminNote('', '', '')).toBe('')
      expect(composeAdminNote(undefined, undefined, undefined)).toBe('')
      expect(composeAdminNote('   ', '   ', '   ')).toBe('')
    })

    it('cuts a long note so the whole is at most 255 chars, keeping the floor line whole', () => {
      const floor = '3'
      const doorbell = 'Papadopoulou'
      // firstLine: "Floor: 3 · Doorbell: Papadopoulou" = 33 chars.
      // separator '\n' = 1 char. Total prefix = 34 chars.
      // room for note = 255 - 33 - 1 = 221 chars.
      const longNote = 'x'.repeat(300)
      const result = composeAdminNote(floor, doorbell, longNote)
      expect(result.length).toBe(255)
      expect(result.startsWith('Floor: 3 · Doorbell: Papadopoulou\n')).toBe(true)
      expect(result).toBe(`Floor: 3 · Doorbell: Papadopoulou\n${'x'.repeat(221)}`)
    })

    it('handles longest possible first line with note truncation', () => {
      const maxFloor = 'f'.repeat(FLOOR_MAX) // 20 chars
      const maxDoorbell = 'd'.repeat(DOORBELL_MAX) // 60 chars
      // firstLine: "Floor: " (7) + 20 + " · Doorbell: " (13) + 60 = 100 chars.
      // room = 255 - 100 - 1 = 154 chars.
      const note = 'n'.repeat(200)
      const result = composeAdminNote(maxFloor, maxDoorbell, note)
      expect(result.length).toBe(255)
      expect(result.startsWith(`Floor: ${maxFloor} · Doorbell: ${maxDoorbell}\n`)).toBe(true)
      expect(result).toBe(`Floor: ${maxFloor} · Doorbell: ${maxDoorbell}\n${'n'.repeat(154)}`)
    })

    it('never splits an emoji when shortening the note', () => {
      const floor = '1'
      const doorbell = 'D'
      // firstLine = "Floor: 1 · Doorbell: D" (22 chars) + '\n' (1 char) = 23 chars.
      // room = 255 - 22 - 1 = 232 characters.
      const notePrefix = 'a'.repeat(231)
      const noteWithEmoji = notePrefix + '🛵🎉'
      const result = composeAdminNote(floor, doorbell, noteWithEmoji)
      expect(Array.from(result)).toHaveLength(255)
      expect(result.endsWith(notePrefix + '🛵')).toBe(true)
    })
  })

  describe('isPinConfirmed (spec 0016, AC-5)', () => {
    const confirmed: ConfirmedPin = {
      latitude: 39.3622,
      longitude: 22.9425,
      pinKey: 'iasonos 12|volos|38221',
    }

    it('returns true when coordinates and pinKey match exactly', () => {
      expect(isPinConfirmed(confirmed, 39.3622, 22.9425, 'iasonos 12|volos|38221')).toBe(true)
    })

    it('returns false when confirmed is null', () => {
      expect(isPinConfirmed(null, 39.3622, 22.9425, 'iasonos 12|volos|38221')).toBe(false)
    })

    it('returns false when latitude differs', () => {
      expect(isPinConfirmed(confirmed, 39.3623, 22.9425, 'iasonos 12|volos|38221')).toBe(false)
    })

    it('returns false when longitude differs', () => {
      expect(isPinConfirmed(confirmed, 39.3622, 22.9426, 'iasonos 12|volos|38221')).toBe(false)
    })

    it('returns false when pinKey differs', () => {
      expect(isPinConfirmed(confirmed, 39.3622, 22.9425, 'iasonos 14|volos|38221')).toBe(false)
      expect(isPinConfirmed(confirmed, 39.3622, 22.9425, 'iasonos 12|volos|')).toBe(false)
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
      expect(isQuoteFailure({ status: 404 })).toBe(false)
      expect(isQuoteFailure({ code: 'INTERNAL_ERROR' })).toBe(false)
      expect(isQuoteFailure({ statusCode: 500 })).toBe(false)
      expect(isQuoteFailure(null)).toBe(false)
    })
  })

  describe('constants', () => {
    it('matches spec limits and map constants', () => {
      expect(ORDER_TOTAL_MAX).toBe(1000)
      expect(FLOOR_MAX).toBe(20)
      expect(DOORBELL_MAX).toBe(60)
      expect(RIDER_NOTE_MAX).toBe(250)
      expect(DELIVERY_NOTE_COLUMN_MAX).toBe(255)
      expect(COUNTER_FROM_SHARE).toBe(0.8)
      expect(PIN_MAP_ZOOM).toBe(17)
      expect(VOLOS_CENTRE).toEqual({ latitude: 39.3622, longitude: 22.9425 })
    })
  })
})
