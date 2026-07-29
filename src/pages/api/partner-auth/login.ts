import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import {
  buildSessionCookie,
  getBackendBaseUrl,
  getPartnerApiBasePath,
  sessionCookieMaxAge,
  unwrapBackendResult,
} from '../../../utils/partnerSession'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Next.js API route running exclusively on the Node server to handle partner authentication.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const parseResult = loginSchema.safeParse(req.body)
  if (!parseResult.success) {
    return res.status(400).json({ message: 'Enter a valid email and password.' })
  }

  const { email, password } = parseResult.data

  try {
    const upstreamUrl = `${getBackendBaseUrl()}${getPartnerApiBasePath()}/auth/login`
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    })

    const body = await upstreamRes.json().catch(() => ({}))

    if (!upstreamRes.ok) {
      const rawMessage = body?.result?.[0]?.message ?? body?.message ?? 'Sign in failed.'
      const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : String(rawMessage)
      return res.status(upstreamRes.status).json({ message })
    }

    const payload = unwrapBackendResult<{
      email?: string
      session?: { accessToken?: string; expiresIn?: number }
    }>(body)

    const accessToken = payload?.session?.accessToken
    const expiresIn = payload?.session?.expiresIn

    if (!accessToken) {
      return res.status(502).json({ message: 'Backend did not return a session.' })
    }

    const maxAge = sessionCookieMaxAge(expiresIn)
    const cookie = buildSessionCookie(accessToken, maxAge)

    res.setHeader('Set-Cookie', cookie)

    // The response body must contain ONLY email (never accessToken, apiKey, or session credentials).
    return res.status(200).json({ email: payload.email ?? null })
  } catch {
    return res.status(502).json({ message: 'Backend unreachable.' })
  }
}
