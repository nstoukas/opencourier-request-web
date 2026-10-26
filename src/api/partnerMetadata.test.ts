import type { NextApiRequest, NextApiResponse } from 'next'
import handler, { clearRetentionCache } from '../pages/api/partner-metadata'

function createMockReqRes(options: {
  method?: string
  body?: any
}) {
  const req = {
    method: options.method || 'GET',
    url: '/api/partner-metadata',
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

describe('/api/partner-metadata route handler', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
    clearRetentionCache()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('rejects non-GET HTTP methods with 405 and sets Allow header', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'POST' })
    await handler(req, res)

    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('GET')
    expect(resState.jsonBody).toEqual({ message: 'Method Not Allowed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches /metadata from backend and returns only { savedCustomerRetentionMonths }', async () => {
    const mockBackendResponse = {
      result: {
        config: {
          savedCustomerRetentionMonths: 18,
          anotherSetting: 'someValue',
          region: { type: 'Polygon', coordinates: [] },
        },
      },
    }

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockBackendResponse),
    } as any)
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    await handler(req, res)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/metadata',
      expect.objectContaining({
        signal: expect.any(Object),
      }),
    )

    expect(resState.statusCode).toBe(200)
    expect(resState.jsonBody).toEqual({ savedCustomerRetentionMonths: 18 })
  })

  it('caches the value in memory for 5 minutes (one upstream call for two requests)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        result: {
          config: { savedCustomerRetentionMonths: 12 },
        },
      }),
    } as any)
    global.fetch = fetchSpy

    // First request fetches from upstream
    const first = createMockReqRes({ method: 'GET' })
    await handler(first.req, first.res)
    expect(first.resState.statusCode).toBe(200)
    expect(first.resState.jsonBody).toEqual({ savedCustomerRetentionMonths: 12 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Second request within 5 minutes returns cached value without upstream fetch
    const second = createMockReqRes({ method: 'GET' })
    await handler(second.req, second.res)
    expect(second.resState.statusCode).toBe(200)
    expect(second.resState.jsonBody).toEqual({ savedCustomerRetentionMonths: 12 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // clearRetentionCache forces a new fetch
    clearRetentionCache()
    const third = createMockReqRes({ method: 'GET' })
    await handler(third.req, third.res)
    expect(third.resState.statusCode).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('returns 502 when backend responds with error or missing retention months value', async () => {
    // 1. Missing savedCustomerRetentionMonths in config
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ result: { config: {} } }),
    } as any)

    const first = createMockReqRes({ method: 'GET' })
    await handler(first.req, first.res)
    expect(first.resState.statusCode).toBe(502)
    expect(first.resState.jsonBody).toEqual({ message: 'The co-op setting could not be read.' })

    // 2. Upstream response not ok (500)
    clearRetentionCache()
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: 'Internal Server Error' }),
    } as any)

    const second = createMockReqRes({ method: 'GET' })
    await handler(second.req, second.res)
    expect(second.resState.statusCode).toBe(502)
    expect(second.resState.jsonBody).toEqual({ message: 'The co-op setting could not be read.' })
  })

  it('returns 502 when upstream fetch throws or times out', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'))

    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    await handler(req, res)

    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'Backend unreachable.' })
  })

  it('answers 502 for a non ok backend answer without reading it as JSON', async () => {
    const jsonSpy = jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON at position 0'))
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: jsonSpy,
    } as any)

    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    await handler(req, res)

    // Upstream body must not be read when response is not ok
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(resState.statusCode).toBe(502)
    expect(resState.jsonBody).toEqual({ message: 'The co-op setting could not be read.' })
  })
})
