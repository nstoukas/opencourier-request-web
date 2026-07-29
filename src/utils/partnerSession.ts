export const PARTNER_SESSION_COOKIE = 'oc_partner_session'

export function getBackendBaseUrl(): string {
  return (process.env.MANUAL_REQUEST_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '')
}

export function getPartnerApiBasePath(): string {
  return process.env.MANUAL_REQUEST_BASE_PATH?.trim().replace(/\/$/, '') || '/api/partner/v1'
}

export function sessionCookieMaxAge(expiresIn: unknown): number {
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    return expiresIn
  }
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
