import type { NextApiRequest, NextApiResponse } from 'next'
import { getBackendBaseUrl } from '../../utils/partnerSession'

// How long an unused saved customer is kept (spec 0005), for the order form's save tick. The
// backend's /metadata is public but sits outside the partner API the proxy forwards, and the browser
// does not know the backend's address, so this route reads it and passes on that one number only.
// Kept in memory for 5 minutes: a representative changes it rarely, and every order form asks.

const CACHE_MS = 5 * 60 * 1000
let cached: { months: number; at: number } | null = null

// Exported for the tests, which start each case with an empty cache.
export function clearRetentionCache() {
  cached = null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return res.status(200).json({ savedCustomerRetentionMonths: cached.months })
  }

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/metadata`, { signal: AbortSignal.timeout(5000) })
    const body = await upstream.json()
    // The backend wraps answers as { error, result }; the setting sits in result.config.
    const months = body?.result?.config?.savedCustomerRetentionMonths
    if (!upstream.ok || typeof months !== 'number') {
      return res.status(502).json({ message: 'The co-op setting could not be read.' })
    }
    cached = { months, at: Date.now() }
    return res.status(200).json({ savedCustomerRetentionMonths: months })
  } catch {
    return res.status(502).json({ message: 'Backend unreachable.' })
  }
}
