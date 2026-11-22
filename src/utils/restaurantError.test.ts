// Spec 0052 / Row 83 review: restaurantErrorText ensures restaurant sees server sentences
// for 4xx client refusals (e.g. 404 order history, 409 complaint clashes), but never raw 5xx
// errors, timeouts, or generic "Request failed (HTTP n)" strings.
import { restaurantErrorText } from './restaurantError'

describe('restaurantErrorText (Row 83 review)', () => {
  const fallback = 'Something went wrong. Try again in a moment.'

  it('returns the server message for 4xx client errors with a specific sentence', () => {
    // 404 order history message (spec 0017)
    expect(
      restaurantErrorText(
        { statusCode: 404, message: 'This order is older than 30 days and can no longer be viewed.' },
        fallback,
      ),
    ).toBe('This order is older than 30 days and can no longer be viewed.')

    // 409 complaint refusal (spec 0052, AC-3)
    expect(
      restaurantErrorText(
        { statusCode: 409, message: 'This order had no rider' },
        fallback,
      ),
    ).toBe('This order had no rider')

    // 409 open complaint clash
    expect(
      restaurantErrorText(
        { statusCode: 409, message: 'You already have an open complaint about this order.' },
        fallback,
      ),
    ).toBe('You already have an open complaint about this order.')

    // 400 validation error
    expect(
      restaurantErrorText(
        { statusCode: 400, message: 'Category is required' },
        fallback,
      ),
    ).toBe('Category is required')
  })

  it('returns fallback for 5xx server errors, hiding internal server text', () => {
    // 500 internal server error
    expect(
      restaurantErrorText(
        { statusCode: 500, message: 'Internal server error: DB connection pool exhausted' },
        fallback,
      ),
    ).toBe(fallback)

    // 502 proxy / backend unreachable error
    expect(
      restaurantErrorText(
        { statusCode: 502, message: 'Backend unreachable.' },
        fallback,
      ),
    ).toBe(fallback)

    // 503 service unavailable
    expect(
      restaurantErrorText(
        { statusCode: 503, message: 'Service Unavailable' },
        fallback,
      ),
    ).toBe(fallback)
  })

  it('returns fallback for generic "Request failed (HTTP ...)" messages even on 4xx', () => {
    expect(
      restaurantErrorText(
        { statusCode: 400, message: 'Request failed (HTTP 400)' },
        fallback,
      ),
    ).toBe(fallback)

    expect(
      restaurantErrorText(
        { statusCode: 404, message: 'Request failed (HTTP 404)' },
        fallback,
      ),
    ).toBe(fallback)

    expect(
      restaurantErrorText(
        { statusCode: 409, message: 'Request failed (HTTP 409)' },
        fallback,
      ),
    ).toBe(fallback)
  })

  it('returns fallback for timeouts, network failures, and errors without statusCode', () => {
    // Client timeout error from manualRequestFetch
    expect(
      restaurantErrorText(
        new Error('Request timed out after 12s. Check backend availability and token.'),
        fallback,
      ),
    ).toBe(fallback)

    // Network / fetch error
    expect(
      restaurantErrorText(
        new Error('Failed to fetch'),
        fallback,
      ),
    ).toBe(fallback)
  })

  it('returns fallback for null, undefined, or empty error values', () => {
    expect(restaurantErrorText(null, fallback)).toBe(fallback)
    expect(restaurantErrorText(undefined, fallback)).toBe(fallback)
    expect(restaurantErrorText({}, fallback)).toBe(fallback)
    expect(restaurantErrorText({ statusCode: 404, message: '' }, fallback)).toBe(fallback)
  })

  it('returns fallback for status codes outside 400-499', () => {
    // 200 / 300 should not be treated as a refusal message
    expect(restaurantErrorText({ statusCode: 200, message: 'OK' }, fallback)).toBe(fallback)
    expect(restaurantErrorText({ statusCode: 302, message: 'Found' }, fallback)).toBe(fallback)
  })
})
