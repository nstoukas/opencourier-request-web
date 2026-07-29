import type { NextApiRequest, NextApiResponse } from 'next'
import { buildClearedSessionCookie } from '../../../utils/partnerSession'

// Next.js API route to clear the httpOnly partner session cookie on sign out.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  res.setHeader('Set-Cookie', buildClearedSessionCookie())
  return res.status(200).json({ signedIn: false })
}
