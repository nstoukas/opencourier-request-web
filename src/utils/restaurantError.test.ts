// Spec 0052 / Row 83 review: restaurantErrorText ensures restaurant sees server sentences
// for 4xx client refusals (e.g. 404 order history, 409 complaint clashes), but never raw 5xx
// errors, timeouts, or generic "Request failed (HTTP n)" strings.
// Spec 0054 / Row 124: a known refusal code is worded in the reader's language via serverMessage.
import { restaurantErrorText } from './restaurantError'
import { createI18n } from '../i18n/createI18n'

describe('restaurantErrorText (Row 83 review & Row 124)', () => {
  const fallback = 'Something went wrong. Try again in a moment.'
  const i18nEn = createI18n('en')
  const i18nEl = createI18n('el')

  it('returns the server message for 4xx client errors with a specific sentence', () => {
    // 404 order history message (spec 0017)
    expect(
      restaurantErrorText(
        { statusCode: 404, message: 'This order is older than 30 days and can no longer be viewed.' },
        fallback,
        i18nEn,
      ),
    ).toBe('This order is older than 30 days and can no longer be viewed.')

    // 409 complaint refusal (spec 0052, AC-3)
    expect(
      restaurantErrorText(
        { statusCode: 409, message: 'This order had no rider' },
        fallback,
        i18nEn,
      ),
    ).toBe('This order had no rider')

    // 409 open complaint clash
    expect(
      restaurantErrorText(
        { statusCode: 409, message: 'You already have an open complaint about this order.' },
        fallback,
        i18nEn,
      ),
    ).toBe('You already have an open complaint about this order.')

    // 400 validation error
    expect(
      restaurantErrorText(
        { statusCode: 400, message: 'Category is required' },
        fallback,
        i18nEn,
      ),
    ).toBe('Category is required')
  })

  it('words a 4xx refusal by code and params in the reader’s language (Row 124)', () => {
    // PARTNER_PAUSED in Greek and English (decision 124.1, spec 0054 AC-6)
    // 2026-11-23T19:30:00.000Z is 21:30 in Europe/Athens
    const pausedError = {
      statusCode: 400,
      code: 'PARTNER_PAUSED',
      message: 'Ordering is paused until 21:30.',
      params: { until: '2026-11-23T19:30:00.000Z' },
    }

    expect(restaurantErrorText(pausedError, fallback, i18nEl)).toBe(
      'Οι παραγγελίες έχουν παυθεί έως τις 21:30.',
    )
    expect(restaurantErrorText(pausedError, fallback, i18nEn)).toBe(
      'Ordering is paused until 21:30.',
    )

    // LEG_TAKEN in Greek and English
    const legTakenError = {
      statusCode: 409,
      code: 'LEG_TAKEN',
      message: 'Leg 2 of 3 of this order was already sent.',
      params: { legNumber: 2, legCount: 3 },
    }

    expect(restaurantErrorText(legTakenError, fallback, i18nEl)).toBe(
      'Το σκέλος 2 από 3 αυτής της παραγγελίας έχει ήδη σταλεί.',
    )
    expect(restaurantErrorText(legTakenError, fallback, i18nEn)).toBe(
      'Leg 2 of 3 of this order was already sent.',
    )
  })

  it('falls back to server’s English message when refusal code is unknown (Row 124)', () => {
    const unknownCodeError = {
      statusCode: 400,
      code: 'FUTURE_REFUSAL_CODE_UNKNOWN_TO_CLIENT',
      message: 'Specific English refusal from newer backend.',
    }

    expect(restaurantErrorText(unknownCodeError, fallback, i18nEl)).toBe(
      'Specific English refusal from newer backend.',
    )
  })

  it('returns fallback for 5xx server errors, hiding internal server text', () => {
    // 500 internal server error
    expect(
      restaurantErrorText(
        { statusCode: 500, message: 'Internal server error: DB connection pool exhausted' },
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)

    // 502 proxy / backend unreachable error
    expect(
      restaurantErrorText(
        { statusCode: 502, message: 'Backend unreachable.' },
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)

    // 503 service unavailable
    expect(
      restaurantErrorText(
        { statusCode: 503, message: 'Service Unavailable' },
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)
  })

  it('returns fallback for generic "Request failed (HTTP ...)" messages even on 4xx', () => {
    expect(
      restaurantErrorText(
        { statusCode: 400, message: 'Request failed (HTTP 400)' },
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)

    expect(
      restaurantErrorText(
        { statusCode: 404, message: 'Request failed (HTTP 404)' },
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)

    expect(
      restaurantErrorText(
        { statusCode: 409, message: 'Request failed (HTTP 409)' },
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)
  })

  it('returns fallback for timeouts, network failures, and errors without statusCode', () => {
    // Client timeout error from manualRequestFetch
    expect(
      restaurantErrorText(
        new Error('Request timed out after 12s. Check backend availability and token.'),
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)

    // Network / fetch error
    expect(
      restaurantErrorText(
        new Error('Failed to fetch'),
        fallback,
        i18nEn,
      ),
    ).toBe(fallback)
  })

  it('returns fallback for null, undefined, or empty error values', () => {
    expect(restaurantErrorText(null, fallback, i18nEn)).toBe(fallback)
    expect(restaurantErrorText(undefined, fallback, i18nEn)).toBe(fallback)
    expect(restaurantErrorText({}, fallback, i18nEn)).toBe(fallback)
    expect(restaurantErrorText({ statusCode: 404, message: '' }, fallback, i18nEn)).toBe(fallback)
  })

  it('returns fallback for status codes outside 400-499', () => {
    // 200 / 300 should not be treated as a refusal message
    expect(restaurantErrorText({ statusCode: 200, message: 'OK' }, fallback, i18nEn)).toBe(fallback)
    expect(restaurantErrorText({ statusCode: 302, message: 'Found' }, fallback, i18nEn)).toBe(fallback)
  })
})
