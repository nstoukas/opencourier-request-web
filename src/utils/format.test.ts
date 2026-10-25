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
    it('formats ISO string with day first and 24-hour clock', () => {
      // Construct a fixed local date: 30 September 2026, 23:25
      const d = new Date(2026, 8, 30, 23, 25)
      const iso = d.toISOString()
      const formatted = formatDateTime(iso)
      // Day first (30/09/2026) and 24-hour clock (23:25)
      expect(formatted).toContain('30/09/2026')
      expect(formatted).toContain('23:25')
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4},\s+\d{2}:\d{2}$/)
    })

    it('returns an em dash when ISO date is null or undefined', () => {
      expect(formatDateTime(null)).toBe('—')
      expect(formatDateTime(undefined)).toBe('—')
      expect(formatDateTime('')).toBe('—')
    })
  })

  describe('formatTime', () => {
    it('formats ISO string as time of day in 24-hour clock (23:25 style)', () => {
      const d = new Date(2026, 8, 30, 23, 25)
      const iso = d.toISOString()
      expect(formatTime(iso)).toBe('23:25')
    })

    it('returns an em dash when time is null or undefined', () => {
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
