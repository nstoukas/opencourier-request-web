import type { NextApiRequest, NextApiResponse } from 'next'
import { PARTNER_SESSION_COOKIE } from '../../utils/partnerSession'
import handler from '../../pages/api/partner-auth/session'

function createMockReqRes(options: { method?: string; cookies?: Record<string, string> }) {
  const req = {
    method: options.method || 'GET',
    cookies: options.cookies || {},
  } as NextApiRequest

  const resState = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    jsonBody: undefined as any,
  }

  const res = {
    status(code: number) {
      resState.statusCode = code
      return res
    },
    setHeader(name: string, value: string) {
      resState.headers[name.toLowerCase()] = value
      return res
    },
    json(data: any) {
      resState.jsonBody = data
      return res
    },
  } as unknown as NextApiResponse

  return { req, res, resState }
}

describe('/api/partner-auth/session API Route (spec 0017, AC-6)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('rejects non-GET HTTP methods with 405 Method Not Allowed', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'POST' })
    await handler(req, res)

    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('GET')
    expect(resState.jsonBody).toEqual({ message: 'Method Not Allowed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns signedIn false and email null when session cookie is absent without calling upstream fetch', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'GET', cookies: {} })
    await handler(req, res)

    expect(resState.statusCode).toBe(200)
    expect(resState.jsonBody).toEqual({ signedIn: false, email: null })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls backend /auth/me with Bearer token and returns signedIn true when session cookie is valid', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ result: { email: 'restaurant@volos.test' } }),
    } as any)
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      cookies: { [PARTNER_SESSION_COOKIE]: 'VALID_SESSION_TOKEN' },
    })

    await handler(req, res)

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/partner/v1/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer VALID_SESSION_TOKEN' },
      }),
    )
    expect(resState.statusCode).toBe(200)
    expect(resState.jsonBody).toEqual({ signedIn: true, email: 'restaurant@volos.test' })
  })

  it('clears session cookie and returns 200 signedIn false when upstream returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      cookies: { [PARTNER_SESSION_COOKIE]: 'EXPIRED_SESSION_TOKEN' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(200)
    expect(resState.jsonBody).toEqual({ signedIn: false, email: null })
    expect(resState.headers['set-cookie']).toContain('Max-Age=0')
  })

  it('clears session cookie and returns 200 signedIn false when upstream returns 403 (review fix 10)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      cookies: { [PARTNER_SESSION_COOKIE]: 'REVOKED_SESSION_TOKEN' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(200)
    expect(resState.jsonBody).toEqual({ signedIn: false, email: null })
    expect(resState.headers['set-cookie']).toContain('Max-Age=0')
  })

  it('returns 502 with no Set-Cookie when upstream returns 500 (cookie kept, spec 0017 AC-6)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      cookies: { [PARTNER_SESSION_COOKIE]: 'VALID_TOKEN_DURING_OUTAGE' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'The sign in could not be checked.' })
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('returns 502 with no Set-Cookie when upstream fetch rejects or times out (spec 0017 AC-6)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused / timeout'))

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      cookies: { [PARTNER_SESSION_COOKIE]: 'VALID_TOKEN_OFFLINE' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'The sign in could not be checked.' })
    expect(resState.headers['set-cookie']).toBeUndefined()
  })
})
