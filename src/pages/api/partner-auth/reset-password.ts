import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardPasswordReset } from '../../../utils/forwardPasswordReset'

// Row 153: sets a new password with the emailed code. Sets no cookie: the restaurant then signs in.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return forwardPasswordReset(req, res, 'reset-password', ['email', 'code', 'password'])
}
