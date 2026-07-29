import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './logout'

function createMockReqRes(options: { method?: string }) {
  const req = {
    method: options.method || 'POST',
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

describe('/api/partner-auth/logout API Route', () => {
  it('rejects non-POST methods with 405 Method Not Allowed', () => {
    const { req, res, resState } = createMockReqRes({ method: 'GET' })
    handler(req, res)

    expect(resState.statusCode).toBe(405)
    expect(resState.headers['allow']).toBe('POST')
    expect(resState.jsonBody).toEqual({ message: 'Method Not Allowed' })
  })

  it('sets cleared cookie header and returns signedIn false on POST', () => {
    const { req, res, resState } = createMockReqRes({ method: 'POST' })
    handler(req, res)

    expect(resState.statusCode).toBe(200)
    expect(resState.jsonBody).toEqual({ signedIn: false })
    const cookieHeader = resState.headers['set-cookie']
    expect(cookieHeader).toContain('Max-Age=0')
    expect(cookieHeader).toContain('oc_partner_session=')
    expect(cookieHeader).toContain('HttpOnly')
  })
})
