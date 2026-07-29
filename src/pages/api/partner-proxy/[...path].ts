import type { NextApiRequest, NextApiResponse } from 'next'
import {
  PARTNER_SESSION_COOKIE,
  buildClearedSessionCookie,
  buildUpstreamPartnerPath,
  getBackendBaseUrl,
  getPartnerApiBasePath,
} from '../../../utils/partnerSession'

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

  // AIFLOW-NOTE: Bodyless DELETE requests would forward "{}" here because Next.js body-parser yields {} for JSON requests. Add an empty-object body check before adding any DELETE endpoint.
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const bodyPayload = hasBody ? JSON.stringify(req.body ?? {}) : undefined

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
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
