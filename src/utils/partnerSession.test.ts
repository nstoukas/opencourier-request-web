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

    it('passes through valid positive numeric expiresIn values', () => {
      expect(sessionCookieMaxAge(900)).toBe(900)
      expect(sessionCookieMaxAge(7200)).toBe(7200)
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
