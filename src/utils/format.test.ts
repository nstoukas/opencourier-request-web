import { formatMoney, formatDateTime, formatTime, formatDistance } from './format'

describe('format utilities (Greek formats per decision D6)', () => {
  describe('formatMoney', () => {
    it('formats cents in EUR with Greek separators and euro symbol', () => {
      // 338 cents = 3.38 EUR -> Greek format "3,38 €"
      const formatted = formatMoney(338, 'EUR')
      // Intl in some environments may emit a narrow no-break space (\u202f) or regular no-break space (\u00a0)
      const normalized = formatted.replace(/[\u00a0\u202f]/g, ' ')
      expect(normalized).toBe('3,38 €')
    })

    it('formats large numbers with Greek thousands separator (dot)', () => {
      const formatted = formatMoney(125050, 'EUR')
      const normalized = formatted.replace(/[\u00a0\u202f]/g, ' ')
      expect(normalized).toBe('1.250,50 €')
    })

    it('returns an em dash when amount is null or undefined', () => {
      expect(formatMoney(null, 'EUR')).toBe('—')
      expect(formatMoney(undefined, 'EUR')).toBe('—')
    })
  })

  describe('formatDateTime', () => {
    // Tests use fixed UTC instants to ensure Greek time (Europe/Athens) is formatted
    // correctly regardless of machine time zone.
    it('formats summer instant on Greek time (UTC+3, day first and 24-hour clock)', () => {
      // 20:25 UTC in summer -> 23:25 in Athens
      expect(formatDateTime('2026-09-30T20:25:00Z')).toBe('30/09/2026, 23:25')
    })

    it('formats winter instant on Greek time (UTC+2)', () => {
      // 10:05 UTC in winter -> 12:05 in Athens
      expect(formatDateTime('2026-01-15T10:05:00Z')).toBe('15/01/2026, 12:05')
    })

    it('rolls over day at midnight and formats midnight hour as 00 (h23 clock)', () => {
      // 21:05 UTC on 30 Sep -> 00:05 on 1 Oct in Athens
      expect(formatDateTime('2026-09-30T21:05:00Z')).toBe('01/10/2026, 00:05')
    })

    it('returns an em dash when ISO date is null, undefined, or empty', () => {
      expect(formatDateTime(null)).toBe('—')
      expect(formatDateTime(undefined)).toBe('—')
      expect(formatDateTime('')).toBe('—')
    })
  })

  describe('formatTime', () => {
    // Tests use fixed UTC instants to ensure Greek time (Europe/Athens) is formatted
    // correctly regardless of machine time zone.
    it('formats summer instant on Greek time (UTC+3, 23:25 style)', () => {
      // 20:25 UTC in summer -> 23:25 in Athens
      expect(formatTime('2026-09-30T20:25:00Z')).toBe('23:25')
    })

    it('formats winter instant on Greek time (UTC+2)', () => {
      // 10:05 UTC in winter -> 12:05 in Athens
      expect(formatTime('2026-01-15T10:05:00Z')).toBe('12:05')
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
    it('formats distance in km with decimal comma and lowercase unit', () => {
      expect(formatDistance(2.43, 'KM')).toBe('2,4 km')
    })

    it('formats distance without unit if unit is omitted', () => {
      expect(formatDistance(2.43, null)).toBe('2,4')
    })

    it('returns an em dash when distance is null or undefined', () => {
      expect(formatDistance(null, 'KM')).toBe('—')
      expect(formatDistance(undefined, 'KM')).toBe('—')
    })
  })
})
