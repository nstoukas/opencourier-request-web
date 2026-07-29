import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './login'

// Helper to construct lightweight mock req and res objects for Next.js API routes.
function createMockReqRes(options: { method?: string; body?: any }) {
  const req = {
    method: options.method || 'POST',
    body: options.body,
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

describe('/api/partner-auth/login API Route', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('rejects non-POST HTTP methods with 405 Method Not Allowed and sets Allow header without calling upstream fetch', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    await handler(req, res)

    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('POST')
    expect(resState.jsonBody).toEqual({ message: 'Method Not Allowed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects invalid request bodies with 400 Bad Request and does not call upstream fetch', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    // Case 1: Empty body
    const test1 = createMockReqRes({ method: 'POST', body: {} })
    await handler(test1.req, test1.res)
    expect(test1.resState.statusCode).toBe(400)
    expect(test1.resState.jsonBody).toEqual({ message: 'Enter a valid email and password.' })

    // Case 2: Invalid email address format
    const test2 = createMockReqRes({ method: 'POST', body: { email: 'not-an-email', password: 'secret' } })
    await handler(test2.req, test2.res)
    expect(test2.resState.statusCode).toBe(400)
    expect(test2.resState.jsonBody).toEqual({ message: 'Enter a valid email and password.' })

    // Case 3: Empty password string
    const test3 = createMockReqRes({ method: 'POST', body: { email: 'partner@example.com', password: '' } })
    await handler(test3.req, test3.res)
    expect(test3.resState.statusCode).toBe(400)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('handles successful login by setting HttpOnly cookie and returning only email', async () => {
    const mockUpstreamResponse = {
      result: {
        id: 'partner-123',
        email: 'restaurant@volos.test',
        apiKey: 'SECRET_API_KEY_DO_NOT_EXPOSE',
        session: {
          accessToken: 'JWT_ACCESS_TOKEN_SECRET',
          tokenType: 'Bearer',
          expiresIn: 3153600000,
        },
      },
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockUpstreamResponse),
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: { email: 'restaurant@volos.test', password: 'correctpassword' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(200)

    // Assert that Set-Cookie header contains HttpOnly and the session access token with Max-Age in seconds
    const cookieHeader = resState.headers['set-cookie']
    expect(cookieHeader).toBeDefined()
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('oc_partner_session=JWT_ACCESS_TOKEN_SECRET')
    expect(cookieHeader).toContain('Max-Age=3153600')
    expect(cookieHeader).not.toContain('Max-Age=3153600000')

    // CRITICAL SECURITY REGRESSION ASSERTION: Response body MUST contain ONLY email
    expect(resState.jsonBody).toEqual({ email: 'restaurant@volos.test' })
    const serializedBody = JSON.stringify(resState.jsonBody)
    expect(serializedBody).not.toContain('accessToken')
    expect(serializedBody).not.toContain('apiKey')
    expect(serializedBody).not.toContain('session')
    expect(serializedBody).not.toContain('JWT_ACCESS_TOKEN_SECRET')
    expect(serializedBody).not.toContain('SECRET_API_KEY_DO_NOT_EXPOSE')
  })

  it('relays upstream 401 Unauthorized status and error message without setting a cookie', async () => {
    const mockErrorEnvelope = {
      result: [{ message: 'Invalid credentials provided.', code: 'UNAUTHORIZED' }],
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue(mockErrorEnvelope),
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: { email: 'restaurant@volos.test', password: 'wrongpassword' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(401)
    expect(resState.jsonBody).toEqual({ message: 'Invalid credentials provided.' })
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('returns 502 Bad Gateway when backend response is missing session accessToken', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ result: { email: 'test@example.com' } }),
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: { email: 'partner@example.com', password: 'validpassword' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'Backend did not return a session.' })
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('returns 502 Bad Gateway when upstream fetch throws a network exception', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network connection failed'))

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: { email: 'partner@example.com', password: 'validpassword' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'Backend unreachable.' })
    expect(resState.headers['set-cookie']).toBeUndefined()
  })
})
