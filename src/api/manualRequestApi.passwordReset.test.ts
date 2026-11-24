import {
  requestPasswordResetCode,
  resetPartnerPassword,
} from './manualRequestApi'
import { NO_ANSWER_CODE } from '../i18n/serverText'

describe('manualRequestApi password reset helpers (Row 153)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('requestPasswordResetCode', () => {
    it('calls /api/partner-auth/forgot-password with email and resolves on 202', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        text: jest.fn().mockResolvedValue(''),
      } as any)

      await requestPasswordResetCode('chef@restaurant.gr')

      expect(global.fetch).toHaveBeenCalledWith('/api/partner-auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'chef@restaurant.gr' }),
      })
    })

    it('throws with NO_ANSWER_CODE when network throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      let caught: any
      try {
        await requestPasswordResetCode('chef@restaurant.gr')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('throws with NO_ANSWER_CODE when server answers 500 with no message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(''),
      } as any)

      let caught: any
      try {
        await requestPasswordResetCode('chef@restaurant.gr')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(500)
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('relays coded refusal from server (e.g. 400 validation error with joined messages)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          result: [{
            statusCode: 400,
            message: ['email must be an email', 'email must not be empty'],
            code: 'VALIDATION_ERROR',
          }],
        })),
      } as any)

      let caught: any
      try {
        await requestPasswordResetCode('bad-email')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(400)
      expect(caught.code).toBe('VALIDATION_ERROR')
      expect(caught.message).toBe('email must be an email; email must not be empty')
    })
  })

  describe('resetPartnerPassword', () => {
    it('calls /api/partner-auth/reset-password with email, code, and password and returns apiKeyRemoved', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { apiKeyRemoved: true } })),
      } as any)

      const result = await resetPartnerPassword('chef@restaurant.gr', '123456', 'newPass1234')

      expect(global.fetch).toHaveBeenCalledWith('/api/partner-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'chef@restaurant.gr',
          code: '123456',
          password: 'newPass1234',
        }),
      })

      expect(result).toEqual({ apiKeyRemoved: true })
    })

    it('returns apiKeyRemoved: false when apiKeyRemoved is missing or false in response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: {} })),
      } as any)

      const result = await resetPartnerPassword('chef@restaurant.gr', '123456', 'newPass1234')
      expect(result).toEqual({ apiKeyRemoved: false })
    })

    it('relays refusal code from server (e.g. 400 INVALID_RESET_CODE)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          result: [{
            statusCode: 400,
            code: 'INVALID_RESET_CODE',
            message: 'The reset code is invalid or has expired.',
          }],
        })),
      } as any)

      let caught: any
      try {
        await resetPartnerPassword('chef@restaurant.gr', '111111', 'newPass1234')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(400)
      expect(caught.code).toBe('INVALID_RESET_CODE')
      expect(caught.message).toBe('The reset code is invalid or has expired.')
    })
  })
})
