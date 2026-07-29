export const PARTNER_SESSION_COOKIE = 'oc_partner_session'

export function getBackendBaseUrl(): string {
  return (process.env.MANUAL_REQUEST_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '')
}

export function getPartnerApiBasePath(): string {
  return process.env.MANUAL_REQUEST_BASE_PATH?.trim().replace(/\/$/, '') || '/api/partner/v1'
}

// The backend returns `expiresIn` in MILLISECONDS, but a cookie's Max-Age is defined in
// SECONDS. Verified 2026-07-29 against a live backend: POST /auth/login returned
// expiresIn 3153600000 for a JWT whose exp - iat was 3153600 seconds (36.5 days).
// We convert here rather than in the backend because the backend is shared by other
// clients (Path A: the storefront adapts, the core does not change).
export function sessionCookieMaxAge(expiresInMs: unknown): number {
  if (typeof expiresInMs === 'number' && Number.isFinite(expiresInMs) && expiresInMs > 0) {
    // Math.floor so the cookie never outlives the token it carries.
    // Math.max(1, ...) so a sub-second expiry cannot floor to 0 — browsers read
    // Max-Age=0 as "delete this cookie immediately".
    return Math.max(1, Math.floor(expiresInMs / 1000))
  }
  // Fallback for a missing or nonsensical value: one hour, already in seconds.
  return 3600
}

export function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const encodedToken = encodeURIComponent(token)
  // HttpOnly prevents document.cookie access so JavaScript/XSS cannot steal the session credential.
  // Path=/ ensures the cookie applies to all routes on the domain.
  // SameSite=Lax prevents cross-site POST requests from attaching the cookie to guard against CSRF.
  // Max-Age specifies the validity period of the session cookie in seconds.
  const parts = [
    `${PARTNER_SESSION_COOKIE}=${encodedToken}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]

  // Secure ensures the cookie is only transmitted over HTTPS in production deployments.
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function buildClearedSessionCookie(): string {
  const parts = [
    `${PARTNER_SESSION_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ]

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function buildUpstreamPartnerPath(segments: unknown): string | null {
  let segList: string[] = []
  if (typeof segments === 'string') {
    segList = [segments]
  } else if (Array.isArray(segments)) {
    for (const item of segments) {
      if (typeof item !== 'string') {
        return null
      }
      segList.push(item)
    }
  } else {
    return null
  }

  if (segList.length === 0) {
    return null
  }

  for (const seg of segList) {
    if (
      !seg ||
      seg === '.' ||
      seg === '..' ||
      seg.includes('/') ||
      seg.includes('\\') ||
      seg.includes('?') ||
      seg.includes('#')
    ) {
      return null
    }
  }

  return `/${segList.join('/')}`
}

export function unwrapBackendResult<T>(body: any): T {
  return body?.result ?? body
}
