import type { NextApiRequest, NextApiResponse } from 'next'
import { PARTNER_SESSION_COOKIE } from '../../../utils/partnerSession'
import handler from './[...path]'

function createMockReqRes(options: {
  method?: string
  query?: Record<string, any>
  url?: string
  cookies?: Record<string, string>
  body?: any
}) {
  const req = {
    method: options.method || 'GET',
    query: options.query || {},
    url: options.url || '/api/partner-proxy',
    cookies: options.cookies || {},
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

describe('/api/partner-proxy/[...path] API Route', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('rejects unsupported HTTP methods with 405 Method Not Allowed and sets Allow header', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'OPTIONS' })
    await handler(req, res)

    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('GET, POST, PATCH, PUT, DELETE')
    expect(resState.jsonBody).toEqual({ message: 'Method Not Allowed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects path traversal attempts with 400 Bad Request and does not call upstream fetch', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      query: { path: ['..', 'admin', 'v1', 'deliveries'] },
    })
    await handler(req, res)

    expect(resState.statusCode).toBe(400)
    expect(resState.jsonBody).toEqual({ message: 'Invalid API path.' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 401 Unauthorized when session cookie is missing and does not call upstream fetch', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      query: { path: ['deliveries'] },
      cookies: {},
    })
    await handler(req, res)

    expect(resState.statusCode).toBe(401)
    expect(resState.jsonBody).toEqual({ message: 'Not signed in.' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('proxies GET request with query params and Authorization header containing session token', async () => {
    const mockUpstreamHeaders = new Map([['content-type', 'application/json']])
    const fetchSpy = jest.fn().mockResolvedValue({
      status: 200,
      headers: mockUpstreamHeaders,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: { items: [] } })),
    } as any)
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      query: { path: ['deliveries'] },
      url: '/api/partner-proxy/deliveries?page=2&perPage=20',
      cookies: { [PARTNER_SESSION_COOKIE]: 'COOKIE_ACCESS_TOKEN' },
    })

    await handler(req, res)

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/partner/v1/deliveries?page=2&perPage=20',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer COOKIE_ACCESS_TOKEN',
        },
        body: undefined,
      }),
    )

    expect(resState.statusCode).toBe(200)
    expect(resState.headers['content-type']).toBe('application/json')
    expect(resState.sentText).toBe(JSON.stringify({ result: { items: [] } }))
  })

  it('proxies POST request body and relays upstream status and response body verbatim', async () => {
    const mockPayload = { quoteId: 'q-123', orderTotalValue: 15.5 }
    const responseBodyText = JSON.stringify({ result: { id: 'del-456', status: 'ACCEPTED' } })

    const fetchSpy = jest.fn().mockResolvedValue({
      status: 201,
      headers: new Map([['content-type', 'application/json']]),
      text: jest.fn().mockResolvedValue(responseBodyText),
    } as any)
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      query: { path: ['deliveries'] },
      url: '/api/partner-proxy/deliveries',
      cookies: { [PARTNER_SESSION_COOKIE]: 'COOKIE_ACCESS_TOKEN' },
      body: mockPayload,
    })

    await handler(req, res)

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/partner/v1/deliveries',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer COOKIE_ACCESS_TOKEN',
        },
        body: JSON.stringify(mockPayload),
      }),
    )

    expect(resState.statusCode).toBe(201)
    expect(resState.sentText).toBe(responseBodyText)
  })

  it('relays upstream 401 Unauthorized status and attaches cleared session cookie header', async () => {
    const errorText = JSON.stringify({ message: 'Token expired' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      headers: new Map([['content-type', 'application/json']]),
      text: jest.fn().mockResolvedValue(errorText),
    } as any)

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      query: { path: ['deliveries'] },
      url: '/api/partner-proxy/deliveries',
      cookies: { [PARTNER_SESSION_COOKIE]: 'EXPIRED_TOKEN' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(401)
    expect(resState.sentText).toBe(errorText)
    expect(resState.headers['set-cookie']).toContain('Max-Age=0')
  })

  it('returns 502 Bad Gateway when upstream fetch throws an error or times out', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'))

    const { req, res, resState } = createMockReqRes({
      method: 'GET',
      query: { path: ['deliveries'] },
      url: '/api/partner-proxy/deliveries',
      cookies: { [PARTNER_SESSION_COOKIE]: 'SOME_TOKEN' },
    })

    await handler(req, res)

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'Backend unreachable.' })
  })
})
