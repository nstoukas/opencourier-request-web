import { formatMoney, formatDateTime, formatTime, formatDistance, formatDate, isOneOClock } from './format'

describe('format utilities (Greek and English formats per spec 0054 AC-3 and decision 47.5)', () => {
  describe('formatMoney', () => {
    it('formats cents in EUR with Greek separators and euro symbol', () => {
      // 338 cents = 3.38 EUR -> Greek format "3,38 €"
      const formatted = formatMoney(338, 'EUR', 'el')
      // Intl in some environments may emit a narrow no-break space (\u202f) or regular no-break space (\u00a0)
      const normalized = formatted.replace(/[\u00a0\u202f]/g, ' ')
      expect(normalized).toBe('3,38 €')
    })

    it('formats large numbers with Greek thousands separator (dot)', () => {
      const formatted = formatMoney(125050, 'EUR', 'el')
      const normalized = formatted.replace(/[\u00a0\u202f]/g, ' ')
      expect(normalized).toBe('1.250,50 €')
    })

    it('formats English currency with en-GB convention (€ symbol before number, decimal dot, comma thousands)', () => {
      const formatted = formatMoney(125050, 'EUR', 'en')
      const normalized = formatted.replace(/[\u00a0\u202f]/g, ' ')
      expect(normalized).toBe('€1,250.50')

      const small = formatMoney(338, 'EUR', 'en')
      expect(small.replace(/[\u00a0\u202f]/g, ' ')).toBe('€3.38')
    })

    it('defaults to Greek format when language parameter is omitted', () => {
      const formatted = formatMoney(125050, 'EUR')
      const normalized = formatted.replace(/[\u00a0\u202f]/g, ' ')
      expect(normalized).toBe('1.250,50 €')
    })

    it('returns an em dash when amount is null or undefined in both languages', () => {
      expect(formatMoney(null, 'EUR', 'el')).toBe('—')
      expect(formatMoney(undefined, 'EUR', 'el')).toBe('—')
      expect(formatMoney(null, 'EUR', 'en')).toBe('—')
      expect(formatMoney(undefined, 'EUR', 'en')).toBe('—')
    })
  })

  describe('formatDateTime', () => {
    // Tests use fixed UTC instants to ensure Greek time (Europe/Athens) is formatted
    // correctly regardless of machine time zone.
    it('formats summer instant on Greek time (UTC+3, day first and 24-hour clock)', () => {
      // 20:25 UTC in summer -> 23:25 in Athens
      expect(formatDateTime('2026-09-30T20:25:00Z', 'el')).toBe('30/09/2026, 23:25')
      expect(formatDateTime('2026-09-30T20:25:00Z', 'en')).toBe('30/09/2026, 23:25')
    })

    it('formats winter instant on Greek time (UTC+2)', () => {
      // 10:05 UTC in winter -> 12:05 in Athens
      expect(formatDateTime('2026-01-15T10:05:00Z', 'el')).toBe('15/01/2026, 12:05')
      expect(formatDateTime('2026-01-15T10:05:00Z', 'en')).toBe('15/01/2026, 12:05')
    })

    it('rolls over day at midnight and formats midnight hour as 00 (h23 clock)', () => {
      // 21:05 UTC on 30 Sep -> 00:05 on 1 Oct in Athens
      expect(formatDateTime('2026-09-30T21:05:00Z', 'el')).toBe('01/10/2026, 00:05')
      expect(formatDateTime('2026-09-30T21:05:00Z', 'en')).toBe('01/10/2026, 00:05')
    })

    it('returns an em dash when ISO date is null, undefined, or empty', () => {
      expect(formatDateTime(null)).toBe('—')
      expect(formatDateTime(undefined)).toBe('—')
      expect(formatDateTime('')).toBe('—')
    })
  })

  describe('formatDate', () => {
    it('formats whole date on Greek time in day-first format (DD/MM/YYYY)', () => {
      expect(formatDate('2026-09-30T20:25:00Z', 'el')).toBe('30/09/2026')
      expect(formatDate('2026-09-30T20:25:00Z', 'en')).toBe('30/09/2026')
    })

    it('returns an em dash when date is null, undefined, or empty', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate(undefined)).toBe('—')
      expect(formatDate('')).toBe('—')
    })
  })

  describe('formatTime', () => {
    // Tests use fixed UTC instants to ensure Greek time (Europe/Athens) is formatted
    // correctly regardless of machine time zone.
    it('formats summer instant on Greek time (UTC+3, 23:25 style)', () => {
      // 20:25 UTC in summer -> 23:25 in Athens
      expect(formatTime('2026-09-30T20:25:00Z', 'el')).toBe('23:25')
      expect(formatTime('2026-09-30T20:25:00Z', 'en')).toBe('23:25')
    })

    it('formats winter instant on Greek time (UTC+2)', () => {
      // 10:05 UTC in winter -> 12:05 in Athens
      expect(formatTime('2026-01-15T10:05:00Z', 'el')).toBe('12:05')
      expect(formatTime('2026-01-15T10:05:00Z', 'en')).toBe('12:05')
    })

    it('formats midnight as 00 (h23 clock, not 24)', () => {
      // 21:05 UTC -> 00:05 in Athens
      expect(formatTime('2026-09-30T21:05:00Z')).toBe('00:05')
    })

    it('returns an em dash when time is null, undefined, or empty', () => {
      expect(formatTime(null)).toBe('—')
      expect(formatTime(undefined)).toBe('—')
      expect(formatTime('')).toBe('—')
    })
  })

  describe('formatDistance', () => {
    it('formats distance in Greek with decimal comma and symbol km', () => {
      expect(formatDistance(2.43, 'KM', 'el')).toBe('2,4 km')
      expect(formatDistance(2.43, 'KILOMETERS', 'el')).toBe('2,4 km')
    })

    it('formats distance in English with decimal dot and symbol km', () => {
      expect(formatDistance(2.43, 'KM', 'en')).toBe('2.4 km')
      expect(formatDistance(2.43, 'KILOMETERS', 'en')).toBe('2.4 km')
    })

    it('formats distance without unit if unit is omitted', () => {
      expect(formatDistance(2.43, null, 'el')).toBe('2,4')
      expect(formatDistance(2.43, null, 'en')).toBe('2.4')
    })

    it('handles miles unit correctly', () => {
      expect(formatDistance(3.14, 'MI', 'el')).toBe('3,1 mi')
      expect(formatDistance(3.14, 'MILES', 'en')).toBe('3.1 mi')
    })

    it('returns an em dash when distance is null or undefined', () => {
      expect(formatDistance(null, 'KM')).toBe('—')
      expect(formatDistance(undefined, 'KM')).toBe('—')
    })
  })

  describe('isOneOClock (Finding 5, decision 47.16)', () => {
    it('returns true when time is 01:00-01:59 on Greek time in summer (UTC+3)', () => {
      // 22:05 UTC in summer -> 01:05 in Athens
      expect(isOneOClock('2026-09-30T22:05:00Z')).toBe(true)
      // 22:00 UTC in summer -> 01:00 in Athens
      expect(isOneOClock('2026-09-30T22:00:00Z')).toBe(true)
      // 22:59 UTC in summer -> 01:59 in Athens
      expect(isOneOClock('2026-09-30T22:59:00Z')).toBe(true)
    })

    it('returns true when time is 01:00-01:59 on Greek time in winter (UTC+2)', () => {
      // 23:05 UTC in winter -> 01:05 in Athens
      expect(isOneOClock('2026-01-15T23:05:00Z')).toBe(true)
    })

    it('returns false for hours other than 01:00-01:59 in Athens time', () => {
      // 21:59 UTC in summer -> 00:59 in Athens
      expect(isOneOClock('2026-09-30T21:59:00Z')).toBe(false)
      // 23:00 UTC in summer -> 02:00 in Athens
      expect(isOneOClock('2026-09-30T23:00:00Z')).toBe(false)
      // 10:05 UTC in summer -> 13:05 in Athens
      expect(isOneOClock('2026-09-30T10:05:00Z')).toBe(false)
    })

    it('returns false for null, undefined, or empty string', () => {
      expect(isOneOClock(null)).toBe(false)
      expect(isOneOClock(undefined)).toBe(false)
      expect(isOneOClock('')).toBe(false)
    })
  })
})
