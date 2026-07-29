import {
  loginPartner,
  logoutPartner,
  fetchPartnerSession,
  fetchPartnerDelivery,
} from './manualRequestApi'

describe('manualRequestApi helper functions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('loginPartner', () => {
    it('calls /api/partner-auth/login and returns email on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
      } as any)

      const res = await loginPartner('test@example.com', 'secret123')
      expect(global.fetch).toHaveBeenCalledWith('/api/partner-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'secret123' }),
      })
      expect(res).toEqual({ email: 'test@example.com' })
    })

    it('throws error with server message when sign-in fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ message: 'Invalid credentials' }),
      } as any)

      await expect(loginPartner('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('logoutPartner', () => {
    it('calls /api/partner-auth/logout with POST method', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as any)

      await logoutPartner()
      expect(global.fetch).toHaveBeenCalledWith('/api/partner-auth/logout', {
        method: 'POST',
      })
    })

    it('handles logout network failures silently without crashing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'))

      await expect(logoutPartner()).resolves.toBeUndefined()
    })
  })

  describe('fetchPartnerSession', () => {
    it('returns session data from /api/partner-auth/session on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ signedIn: true, email: 'user@volos.test' }),
      } as any)

      const session = await fetchPartnerSession()
      expect(session).toEqual({ signedIn: true, email: 'user@volos.test' })
    })

    it('returns signedIn false and email null on HTTP error (e.g. 500 response)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ message: 'Internal Server Error' }),
      } as any)

      const session = await fetchPartnerSession()
      expect(session).toEqual({ signedIn: false, email: null })
    })

    it('returns signedIn false and email null on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const session = await fetchPartnerSession()
      expect(session).toEqual({ signedIn: false, email: null })
    })
  })

  describe('fetchPartnerDelivery', () => {
    it('calls proxy deliveries endpoint with credentials same-origin and unwraps result', async () => {
      const mockDelivery = { id: 'del-123', status: 'ACCEPTED' }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockDelivery })),
      } as any)

      const result = await fetchPartnerDelivery('del-123')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/deliveries/del-123',
        expect.objectContaining({
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(result).toEqual(mockDelivery)
    })
  })
})
