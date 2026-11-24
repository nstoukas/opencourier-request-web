import {
  noWordsForTheRestaurant,
  manualRequestFetch,
} from './manualRequestApi'
import { NO_ANSWER_CODE, REQUEST_TIMEOUT_CODE } from '../i18n/serverText'

// Row 151: tests for noWordsForTheRestaurant and manualRequestFetch error classification.
// Failures that have no words for the restaurant (empty 5xx, backend 500 catch-all, proxy 502, network throw)
// receive NO_ANSWER_CODE so pages can show their own sentence in Greek/English.
describe('manualRequestApi unanswered failures classification (Row 151)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('noWordsForTheRestaurant helper', () => {
    it('returns true when code is already NO_ANSWER_CODE', () => {
      expect(noWordsForTheRestaurant(502, NO_ANSWER_CODE, 'Backend unreachable.')).toBe(true)
      expect(noWordsForTheRestaurant(500, NO_ANSWER_CODE, '')).toBe(true)
    })

    it('returns true when said is undefined, null, or empty string', () => {
      expect(noWordsForTheRestaurant(500, undefined, undefined)).toBe(true)
      expect(noWordsForTheRestaurant(500, undefined, null)).toBe(true)
      expect(noWordsForTheRestaurant(500, undefined, '')).toBe(true)
      expect(noWordsForTheRestaurant(502, undefined, '')).toBe(true)
    })

    it('returns true for 500 with catch-all codes (undefined, UNKNOWN, INTERNAL_ERROR, ERROR)', () => {
      // Missing code
      expect(noWordsForTheRestaurant(500, undefined, 'Internal server error')).toBe(true)
      // UNKNOWN
      expect(noWordsForTheRestaurant(500, 'UNKNOWN', 'Internal server error')).toBe(true)
      // INTERNAL_ERROR
      expect(noWordsForTheRestaurant(500, 'INTERNAL_ERROR', 'Internal server error')).toBe(true)
      // ERROR: ResponseFormatMiddleware fills missing code with 'ERROR' (review of row 151)
      expect(noWordsForTheRestaurant(500, 'ERROR', 'Internal server error')).toBe(true)
    })

    it('returns false for 500 with a specific domain refusal code', () => {
      expect(noWordsForTheRestaurant(500, 'DELIVERY_CANNOT_PROCEED', 'Specific message')).toBe(false)
    })

    it('returns false for 503 worded by the server (e.g. no couriers available)', () => {
      expect(noWordsForTheRestaurant(503, 'SERVICE_UNAVAILABLE', 'No couriers are currently available.')).toBe(false)
      expect(noWordsForTheRestaurant(503, undefined, 'No couriers are currently available.')).toBe(false)
    })

    it('returns false for 4xx client errors that have words', () => {
      expect(noWordsForTheRestaurant(400, 'INVALID_INPUT', 'Bad request: missing field')).toBe(false)
      expect(noWordsForTheRestaurant(404, 'NOT_FOUND', 'Delivery not found')).toBe(false)
      expect(noWordsForTheRestaurant(422, 'LEG_TAKEN', 'Leg already taken')).toBe(false)
    })
  })

  describe('manualRequestFetch error handling', () => {
    it('assigns NO_ANSWER_CODE when response is 500 with empty body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(''),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(500)
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('assigns NO_ANSWER_CODE when response is 500 with code ERROR', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          statusCode: 500,
          code: 'ERROR',
          message: 'Internal server error',
        })),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(500)
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('assigns NO_ANSWER_CODE when response is 500 with code UNKNOWN', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          statusCode: 500,
          code: 'UNKNOWN',
          message: 'Internal server error',
        })),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(500)
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('assigns NO_ANSWER_CODE when response is 500 with code INTERNAL_ERROR', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        })),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(500)
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('assigns NO_ANSWER_CODE when partner proxy returns 502 with NO_ANSWER', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          message: 'Backend unreachable.',
          code: 'NO_ANSWER',
        })),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(502)
      expect(caught.code).toBe(NO_ANSWER_CODE)
    })

    it('assigns NO_ANSWER_CODE when fetch itself throws (network offline, no connection)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.code).toBe(NO_ANSWER_CODE)
      // Keeps developer message for debugging
      expect(caught.message).toBe('Failed to fetch')
    })

    it('preserves code and words for a worded 503 from the backend', async () => {
      const responseEnvelope = {
        result: [{
          statusCode: 503,
          code: 'NO_COURIERS',
          message: 'No couriers are currently available in this area.',
        }],
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValue(responseEnvelope),
        text: jest.fn().mockResolvedValue(JSON.stringify(responseEnvelope)),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(503)
      expect(caught.code).toBe('NO_COURIERS')
      expect(caught.message).toBe('No couriers are currently available in this area.')
    })

    it('preserves code and words for a coded 4xx refusal', async () => {
      const responseEnvelope = {
        result: [{
          statusCode: 409,
          code: 'LEG_TAKEN',
          message: 'Leg 2 of 3 was already sent.',
          params: { legNumber: 2, legCount: 3 },
        }],
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: jest.fn().mockResolvedValue(responseEnvelope),
        text: jest.fn().mockResolvedValue(JSON.stringify(responseEnvelope)),
      } as any)

      let caught: any
      try {
        await manualRequestFetch('/deliveries/1/order-legs')
      } catch (err) {
        caught = err
      }

      expect(caught).toBeDefined()
      expect(caught.statusCode).toBe(409)
      expect(caught.code).toBe('LEG_TAKEN')
      expect(caught.params).toEqual({ legNumber: 2, legCount: 3 })
    })
  })
})
