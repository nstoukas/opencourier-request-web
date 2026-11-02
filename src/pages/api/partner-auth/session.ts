import type { NextApiRequest, NextApiResponse } from 'next'
import {
  PARTNER_SESSION_COOKIE,
  buildClearedSessionCookie,
  getBackendBaseUrl,
  getPartnerApiBasePath,
  unwrapBackendResult,
} from '../../../utils/partnerSession'

// Next.js API route to verify current partner session state using the httpOnly cookie.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  // Next.js automatically parses incoming request HTTP cookies into req.cookies.
  const token = req.cookies[PARTNER_SESSION_COOKIE]

  if (!token) {
    return res.status(200).json({ signedIn: false, email: null })
  }

  try {
    const upstreamUrl = `${getBackendBaseUrl()}${getPartnerApiBasePath()}/auth/me`
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15000),
    })

    // Only the backend saying the token is no good ends the session. Anything else (a 5xx, the backend
    // down) is a failed check: the cookie stays and the page says the check failed (spec 0017, AC-6),
    // so a backend outage never signs a restaurant out.
    if (upstreamRes.status === 401 || upstreamRes.status === 403) {
      res.setHeader('Set-Cookie', buildClearedSessionCookie())
      return res.status(200).json({ signedIn: false, email: null })
    }
    if (!upstreamRes.ok) {
      return res.status(502).json({ message: 'The sign in could not be checked.' })
    }

    const body = await upstreamRes.json().catch(() => ({}))
    const payload = unwrapBackendResult<{ email?: string }>(body)

    return res.status(200).json({
      signedIn: true,
      email: payload.email ?? null,
    })
  } catch {
    // No answer from the backend (down, or the 15 s timeout): a failed check, the cookie stays.
    return res.status(502).json({ message: 'The sign in could not be checked.' })
  }
}
