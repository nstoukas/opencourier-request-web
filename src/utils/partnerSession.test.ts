import {
  PARTNER_SESSION_COOKIE,
  buildClearedSessionCookie,
  buildSessionCookie,
  buildUpstreamPartnerPath,
  getBackendBaseUrl,
  getPartnerApiBasePath,
  sessionCookieMaxAge,
  unwrapBackendResult,
} from './partnerSession'

describe('partnerSession utils', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset process.env before each test to isolate env variable modifications
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('buildSessionCookie', () => {
    it('contains HttpOnly, Path=/, SameSite=Lax, Max-Age, and encoded token value', () => {
      ;(process.env as any).NODE_ENV = 'development'
      const cookie = buildSessionCookie('tok', 900)
      expect(cookie).toContain(`${PARTNER_SESSION_COOKIE}=tok`)
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Path=/')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).toContain('Max-Age=900')
    })

    it('omits Secure when NODE_ENV is not production', () => {
      ;(process.env as any).NODE_ENV = 'development'
      const cookie = buildSessionCookie('tok', 900)
      expect(cookie).not.toContain('Secure')
    })

    it('includes Secure when NODE_ENV is production', () => {
      ;(process.env as any).NODE_ENV = 'production'
      const cookie = buildSessionCookie('tok', 900)
      expect(cookie).toContain('Secure')
    })

    it('encodes special characters in token value', () => {
      ;(process.env as any).NODE_ENV = 'development'
      const cookie = buildSessionCookie('tok/123==', 900)
      expect(cookie).toContain(`${PARTNER_SESSION_COOKIE}=tok%2F123%3D%3D`)
    })
  })

  describe('buildClearedSessionCookie', () => {
    it('has Max-Age=0, empty value, and Path=/', () => {
      ;(process.env as any).NODE_ENV = 'development'
      const cookie = buildClearedSessionCookie()
      expect(cookie).toContain(`${PARTNER_SESSION_COOKIE}=`)
      expect(cookie).toContain('Max-Age=0')
      expect(cookie).toContain('Path=/')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).not.toContain('Secure')
    })

    it('includes Secure in production mode', () => {
      ;(process.env as any).NODE_ENV = 'production'
      const cookie = buildClearedSessionCookie()
      expect(cookie).toContain('Secure')
    })
  })

  describe('sessionCookieMaxAge', () => {
    it('returns 3600 fallback for invalid or non-positive maxAge values', () => {
      expect(sessionCookieMaxAge(undefined)).toBe(3600)
      expect(sessionCookieMaxAge(null)).toBe(3600)
      expect(sessionCookieMaxAge(0)).toBe(3600)
      expect(sessionCookieMaxAge(-5)).toBe(3600)
      expect(sessionCookieMaxAge('abc')).toBe(3600)
      expect(sessionCookieMaxAge(NaN)).toBe(3600)
    })

    it('converts real backend expiresIn value in milliseconds to seconds', () => {
      // Real backend returns 3,153,600,000 ms (~36.5 days in ms)
      expect(sessionCookieMaxAge(3153600000)).toBe(3153600)
    })

    it('guards against raw passthrough of millisecond values (must be under 2 years in seconds)', () => {
      const twoYearsInSeconds = 60 * 60 * 24 * 365 * 2
      // A raw passthrough of 3,153,600,000 would fail this assertion (~100 years vs 2 years)
      expect(sessionCookieMaxAge(3153600000)).toBeLessThan(twoYearsInSeconds)
    })

    it('converts ordinary millisecond values to seconds', () => {
      expect(sessionCookieMaxAge(900000)).toBe(900)
      expect(sessionCookieMaxAge(7200000)).toBe(7200)
    })

    it('rounds down fractional seconds so cookie never outlives the token', () => {
      // 1500 ms = 1.5 s -> Math.floor rounds down to 1 s
      expect(sessionCookieMaxAge(1500)).toBe(1)
    })

    it('returns at least 1 second for sub-second expiry to avoid Max-Age=0 cookie deletion', () => {
      // 500 ms = 0.5 s -> Math.max(1, Math.floor(0.5)) returns 1 second
      expect(sessionCookieMaxAge(500)).toBe(1)
    })
  })

  describe('buildUpstreamPartnerPath', () => {
    it('formats string array segments into a path string', () => {
      expect(buildUpstreamPartnerPath(['deliveries', 'abc', 'cancel'])).toBe('/deliveries/abc/cancel')
    })

    it('formats a single string segment into a path string', () => {
      expect(buildUpstreamPartnerPath('deliveries')).toBe('/deliveries')
    })

    it('returns null for missing, empty, or malicious traversal path segments', () => {
      expect(buildUpstreamPartnerPath(undefined)).toBeNull()
      expect(buildUpstreamPartnerPath([])).toBeNull()
      expect(buildUpstreamPartnerPath([''])).toBeNull()
      expect(buildUpstreamPartnerPath(['..', 'admin'])).toBeNull()
      expect(buildUpstreamPartnerPath(['a/b'])).toBeNull()
      expect(buildUpstreamPartnerPath(['a\\b'])).toBeNull()
      expect(buildUpstreamPartnerPath(['.'])).toBeNull()
    })

    it('returns null if any segment in array is not a string', () => {
      expect(buildUpstreamPartnerPath(['deliveries', null, 'cancel'])).toBeNull()
      expect(buildUpstreamPartnerPath(['deliveries', 123, 'cancel'])).toBeNull()
    })

    it('returns null if any segment contains ? or #', () => {
      expect(buildUpstreamPartnerPath(['deliveries?debug=true'])).toBeNull()
      expect(buildUpstreamPartnerPath(['deliveries#section'])).toBeNull()
    })
  })

  describe('getPartnerApiBasePath', () => {
    it('defaults to /api/partner/v1', () => {
      delete process.env.MANUAL_REQUEST_BASE_PATH
      expect(getPartnerApiBasePath()).toBe('/api/partner/v1')
    })

    it('honours MANUAL_REQUEST_BASE_PATH and trims trailing slashes', () => {
      process.env.MANUAL_REQUEST_BASE_PATH = '/custom/api/v1/'
      expect(getPartnerApiBasePath()).toBe('/custom/api/v1')
    })
  })

  describe('getBackendBaseUrl', () => {
    it('defaults to http://127.0.0.1:3000', () => {
      delete process.env.MANUAL_REQUEST_PROXY_TARGET
      expect(getBackendBaseUrl()).toBe('http://127.0.0.1:3000')
    })

    it('honours MANUAL_REQUEST_PROXY_TARGET and trims trailing slashes', () => {
      process.env.MANUAL_REQUEST_PROXY_TARGET = 'http://localhost:4000/'
      expect(getBackendBaseUrl()).toBe('http://localhost:4000')
    })
  })

  describe('unwrapBackendResult', () => {
    it('unwraps body.result if present', () => {
      expect(unwrapBackendResult({ result: { email: 'test@example.com' } })).toEqual({ email: 'test@example.com' })
    })

    it('returns body as-is if result field is missing', () => {
      expect(unwrapBackendResult({ email: 'test@example.com' })).toEqual({ email: 'test@example.com' })
    })

    it('handles null/undefined body safely', () => {
      expect(unwrapBackendResult(null)).toBeNull()
      expect(unwrapBackendResult(undefined)).toBeUndefined()
    })
  })
})
