import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardPasswordReset } from './forwardPasswordReset'

function createMockReqRes(options: {
  method?: string
  body?: any
}) {
  const req = {
    method: options.method || 'POST',
    body: options.body,
  } as NextApiRequest

  const resState = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    sentText: undefined as any,
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
    send(text: any) {
      resState.sentText = text
      return res
    },
    json(data: any) {
      resState.jsonBody = data
      return res
    },
  } as unknown as NextApiResponse

  return { req, res, resState }
}

describe('forwardPasswordReset helper (Row 153)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('rejects non-POST HTTP methods with 405 Method Not Allowed and sets Allow: POST', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    await forwardPasswordReset(req, res, 'forgot-password', ['email'])

    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('POST')
    expect(resState.jsonBody).toEqual({ message: 'Method Not Allowed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('forwards ONLY the named fields and strips all other body properties (proof check 5)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      status: 202,
      text: jest.fn().mockResolvedValue(''),
      headers: new Map(),
    } as any)
    global.fetch = fetchSpy

    // Input body contains extra keys, admin flags, or malicious injections
    const incomingBody = {
      email: 'restaurant@volos.gr',
      extraField: 'should-be-stripped',
      role: 'ADMIN',
      injectedCode: '123456',
    }

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: incomingBody,
    })

    // Forwarding for forgot-password: only 'email' should be kept
    await forwardPasswordReset(req, res, 'forgot-password', ['email'])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
    expect(calledUrl).toContain('/auth/forgot-password')
    expect(calledInit.method).toBe('POST')
    expect(calledInit.headers).toEqual({ 'Content-Type': 'application/json' })

    const forwardedJson = JSON.parse(calledInit.body)
    expect(forwardedJson).toEqual({ email: 'restaurant@volos.gr' })
    // Proof check 5: Assert that extra fields are NOT present
    expect(forwardedJson).not.toHaveProperty('extraField')
    expect(forwardedJson).not.toHaveProperty('role')
    expect(forwardedJson).not.toHaveProperty('injectedCode')

    expect(resState.statusCode).toBe(202)
    // Proof: sets NO cookie header
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('forwards email, code, and password for reset-password and strips extra properties', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ apiKeyRemoved: true })),
      headers: new Map([['content-type', 'application/json']]),
    } as any)
    global.fetch = fetchSpy

    const incomingBody = {
      email: 'restaurant@volos.gr',
      code: '654321',
      password: 'newSecurePassword99',
      extraUnwanted: 'strip-me',
    }

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: incomingBody,
    })

    await forwardPasswordReset(req, res, 'reset-password', ['email', 'code', 'password'])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
    expect(calledUrl).toContain('/auth/reset-password')

    const forwardedJson = JSON.parse(calledInit.body)
    expect(forwardedJson).toEqual({
      email: 'restaurant@volos.gr',
      code: '654321',
      password: 'newSecurePassword99',
    })
    expect(forwardedJson).not.toHaveProperty('extraUnwanted')

    expect(resState.statusCode).toBe(200)
    expect(resState.sentText).toBe(JSON.stringify({ apiKeyRemoved: true }))
    expect(resState.headers['content-type']).toBe('application/json')
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('returns 502 with NO_ANSWER code when upstream fetch throws or times out', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'))

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: { email: 'restaurant@volos.gr' },
    })

    await forwardPasswordReset(req, res, 'forgot-password', ['email'])

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({
      message: 'Backend unreachable.',
      code: 'NO_ANSWER',
    })
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('handles non-object req.body gracefully as empty object', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      status: 400,
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'email must be an email' })),
      headers: new Map([['content-type', 'application/json']]),
    } as any)
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: null,
    })

    await forwardPasswordReset(req, res, 'forgot-password', ['email'])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const forwardedJson = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(forwardedJson).toEqual({ email: undefined })
    expect(resState.statusCode).toBe(400)
  })
})
