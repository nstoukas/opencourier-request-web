// Every partner API call goes to our own server first; it attaches the token from the
// httpOnly cookie. The browser therefore needs no base URL and no credential of its own.
export const PARTNER_PROXY_BASE_URL = '/api/partner-proxy'
export const PARTNER_AUTH_BASE_URL = '/api/partner-auth'

export function getManualRequestApiMode() {
  return (process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE ?? 'admin').toLowerCase()
}
