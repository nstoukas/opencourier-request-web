import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardPasswordReset } from '../../../utils/forwardPasswordReset'

// Row 153: asks the backend to email a reset code. Always 202 from the backend, whatever the email.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return forwardPasswordReset(req, res, 'forgot-password', ['email'])
}
