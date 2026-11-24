import { manualRequestFetch, fetchPartnerDelivery } from './manualRequestApi'
import { NO_ANSWER_CODE, REQUEST_TIMEOUT_CODE, serverMessage } from '../i18n/serverText'
import { createI18n } from '../i18n/createI18n'

// Decisions 124.10 and 124.15: A request that times out must reject with an error whose code is
// REQUEST_TIMEOUT_CODE so that serverMessage words it in the reader's language (Greek / English),
// while preserving the developer English error message for logs.
describe('manualRequestFetch timeout (decisions 124.10, 124.15)', () => {
  const originalFetch = global.fetch
  const i18nEl = createI18n('el')
  const i18nEn = createI18n('en')

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  /**
   * Helper that mocks fetch with a request that hangs indefinitely until its AbortSignal fires.
   * When aborted, it rejects with an AbortError like real browser fetch does.
   */
  function mockHangingFetch() {
    global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          if (init.signal.aborted) {
            const error = new Error('The operation was aborted.')
            error.name = 'AbortError'
            reject(error)
            return
          }
          init.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted.')
            error.name = 'AbortError'
            reject(error)
          })
        }
      })
    })
  }

  it('rejects with REQUEST_TIMEOUT_CODE and serverMessage renders common.requestTimedOut in Greek when request times out', async () => {
    mockHangingFetch()

    // Start request: 12-second timeout timer is scheduled internally
    const requestPromise = manualRequestFetch('/deliveries')

    // Advance fake timers past the 12-second timeout threshold (12,000 ms)
    jest.advanceTimersByTime(12_000)

    let caughtError: any
    try {
      await requestPromise
    } catch (err: any) {
      caughtError = err
    }

    // Assert error shape and developer English message
    expect(caughtError).toBeDefined()
    expect(caughtError).toBeInstanceOf(Error)
    expect(caughtError.code).toBe(REQUEST_TIMEOUT_CODE)
    expect(caughtError.message).toBe('Request timed out after 12s. Check backend availability and token.')

    // Assert that serverMessage translates the timeout error to Greek
    const greekMessage = serverMessage(caughtError, i18nEl)
    expect(greekMessage).toBe('Ο διακομιστής δεν απάντησε εγκαίρως. Δοκιμάστε ξανά σε λίγο.')
    expect(greekMessage).toBe(i18nEl.t('common.requestTimedOut'))

    // Also assert that serverMessage translates to English when user language is en
    const englishMessage = serverMessage(caughtError, i18nEn)
    expect(englishMessage).toBe('The server did not answer in time. Please try again in a moment.')
    expect(englishMessage).toBe(i18nEn.t('common.requestTimedOut'))
  })

  it('translates timeout error when a higher-level partner API function times out', async () => {
    mockHangingFetch()

    // fetchPartnerDelivery calls manualRequestFetch under the hood
    const deliveryPromise = fetchPartnerDelivery('del-test-timeout')

    // Advance fake timers past timeout threshold
    jest.advanceTimersByTime(12_000)

    let caughtError: any
    try {
      await deliveryPromise
    } catch (err: any) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError.code).toBe(REQUEST_TIMEOUT_CODE)
    expect(serverMessage(caughtError, i18nEl)).toBe(i18nEl.t('common.requestTimedOut'))
  })

  it('rejects with REQUEST_TIMEOUT_CODE when caller aborts signal before the 12s timeout', async () => {
    mockHangingFetch()

    const callerController = new AbortController()
    const requestPromise = manualRequestFetch('/deliveries', { signal: callerController.signal })

    // Caller aborts early after 3 seconds
    jest.advanceTimersByTime(3_000)
    callerController.abort()

    let caughtError: any
    try {
      await requestPromise
    } catch (err: any) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError.code).toBe(REQUEST_TIMEOUT_CODE)
    expect(serverMessage(caughtError, i18nEl)).toBe('Ο διακομιστής δεν απάντησε εγκαίρως. Δοκιμάστε ξανά σε λίγο.')
  })

  it('resolves successfully and clears timeout timer when fetch answers before 12s', async () => {
    // Happy path: response returns within 500ms
    global.fetch = jest.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { id: 'del-success', status: 'ACCEPTED' } }),
      } as any
    })

    const requestPromise = manualRequestFetch('/deliveries/del-success')
    jest.advanceTimersByTime(500)
    const result = await requestPromise

    expect(result).toEqual({ id: 'del-success', status: 'ACCEPTED' })

    // Advance past 12s to ensure no timeout error is thrown after successful resolution
    jest.advanceTimersByTime(15_000)
  })

  it('rethrows original non-abort error with NO_ANSWER_CODE when fetch fails with network error (row 151)', async () => {
    // Failure case: network error (e.g., DNS failure, offline)
    const networkError = new TypeError('Failed to fetch')
    global.fetch = jest.fn().mockRejectedValue(networkError)

    let caughtError: any
    try {
      await manualRequestFetch('/deliveries')
    } catch (err: any) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError).toBe(networkError)
    // Row 151: fetch errors with no code get NO_ANSWER_CODE so callers show their own words
    expect(caughtError.code).toBe(NO_ANSWER_CODE)
    expect(caughtError.code).not.toBe(REQUEST_TIMEOUT_CODE)

    // serverMessage returns undefined for NO_ANSWER_CODE
    expect(serverMessage(caughtError, i18nEl)).toBeUndefined()
  })
})
