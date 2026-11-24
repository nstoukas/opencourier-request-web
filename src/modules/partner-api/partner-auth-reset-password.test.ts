import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/partner-auth/reset-password'

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

describe('/api/partner-auth/reset-password route (Row 153)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('forwards email, code, and password to upstream partner auth reset-password and sets no cookie', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ apiKeyRemoved: true })),
      headers: new Map([['content-type', 'application/json']]),
    } as any)
    global.fetch = fetchSpy

    const { req, res, resState } = createMockReqRes({
      method: 'POST',
      body: {
        email: 'chef@restaurant.gr',
        code: '123456',
        password: 'newPassword123',
        extra: 'drop-this',
      },
    })

    await handler(req, res)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/reset-password'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'chef@restaurant.gr',
          code: '123456',
          password: 'newPassword123',
        }),
      }),
    )

    expect(resState.statusCode).toBe(200)
    expect(resState.sentText).toBe(JSON.stringify({ apiKeyRemoved: true }))
    expect(resState.headers['set-cookie']).toBeUndefined()
  })

  it('rejects GET with 405 Method Not Allowed', async () => {
    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    await handler(req, res)
    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('POST')
  })
})
