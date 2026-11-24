import type { NextApiRequest, NextApiResponse } from 'next'
import { getBackendBaseUrl, getPartnerApiBasePath } from './partnerSession'

// Row 153: the two public password reset routes (forgot-password, reset-password) are forwarded from request-web's
// own server to the backend's partner API, so the browser keeps talking only to its own origin. They carry no
// session and set no cookie. The backend's answer goes back as it came (its status, and its refusal with a code),
// so the page can word a refusal in the restaurant's language. Only the named fields are sent on.
export async function forwardPasswordReset(
  req: NextApiRequest,
  res: NextApiResponse,
  backendPath: 'forgot-password' | 'reset-password',
  fields: string[],
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method Not Allowed' })
  }
  const sent: Record<string, unknown> = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const body: Record<string, unknown> = {}
  for (const field of fields) body[field] = sent[field]

  try {
    const upstreamRes = await fetch(`${getBackendBaseUrl()}${getPartnerApiBasePath()}/auth/${backendPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const text = await upstreamRes.text()
    const contentType = upstreamRes.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    return res.status(upstreamRes.status).send(text)
  } catch {
    // The same code the partner proxy sends (row 151), so the page shows its own sentence.
    return res.status(502).json({ message: 'Backend unreachable.', code: 'NO_ANSWER' })
  }
}
