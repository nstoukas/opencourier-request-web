import type { NextApiRequest, NextApiResponse } from 'next'
import {
  PARTNER_SESSION_COOKIE,
  buildClearedSessionCookie,
  buildUpstreamPartnerPath,
  getBackendBaseUrl,
  getPartnerApiBasePath,
} from '../../../utils/partnerSession'

// The body to send on, or undefined for none. Next.js's body parser turns a request with no body into
// `{}` (or `''`), so without this a DELETE or a bodyless POST (`/customers/:id/used`) would arrive at
// the backend with a body it never asked for. Only POST, PATCH and PUT carry one, and only a real one:
// a PATCH sent as `{}` also goes bodyless (no caller sends one today; the backend reads it as no change).
// Exported so it can be tested without a request.
export function forwardedBody(method: string | undefined, body: unknown): string | undefined {
  if (method !== 'POST' && method !== 'PATCH' && method !== 'PUT') return undefined
  if (body === undefined || body === null || body === '') return undefined
  if (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) return undefined
  return typeof body === 'string' ? body : JSON.stringify(body)
}

// Next.js catch-all API route matches /api/partner-proxy/* and extracts path segments into req.query.path.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowedMethods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  if (!req.method || !allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods.join(', '))
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const upstreamPath = buildUpstreamPartnerPath(req.query.path)
  if (!upstreamPath) {
    return res.status(400).json({ message: 'Invalid API path.' })
  }

  const token = req.cookies[PARTNER_SESSION_COOKIE]
  if (!token) {
    return res.status(401).json({ message: 'Not signed in.' })
  }

  const search = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const targetUrl = `${getBackendBaseUrl()}${getPartnerApiBasePath()}${upstreamPath}${search}`

  const bodyPayload = forwardedBody(req.method, req.body)

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        // Only a request that carries a body says what kind it is.
        ...(bodyPayload !== undefined && { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: bodyPayload,
      signal: AbortSignal.timeout(15000),
    })

    const text = await upstreamRes.text()
    const contentType = upstreamRes.headers.get('content-type')

    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    if (upstreamRes.status === 401) {
      res.setHeader('Set-Cookie', buildClearedSessionCookie())
    }

    return res.status(upstreamRes.status).send(text)
  } catch {
    return res.status(502).json({ message: 'Backend unreachable.' })
  }
}
