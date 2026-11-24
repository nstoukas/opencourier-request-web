import { createI18n } from './createI18n'
import {
  serverMessage,
  NO_ANSWER_CODE,
  REQUEST_TIMEOUT_CODE,
  ServerError,
} from './serverText'
import * as fs from 'fs'
import * as path from 'path'

// Row 151: serverMessage answers undefined for NO_ANSWER_CODE, so each caller shows its own
// sentence in the restaurant's language (adminweb's rule) instead of developer English like
// "Request failed (HTTP 500)", "Backend unreachable." or "Internal server error".
describe('serverText unanswered failures (Row 151, decision 124.2, 151.1)', () => {
  const i18nEl = createI18n('el')
  const i18nEn = createI18n('en')

  it('answers undefined for NO_ANSWER_CODE so callers fall back to their own sentence', () => {
    const noAnswerError: ServerError = {
      code: NO_ANSWER_CODE,
      message: 'Request failed (HTTP 500)',
    }

    // Must return undefined in both Greek and English so `serverMessage(err, i18n) ?? t(...)` falls through
    expect(serverMessage(noAnswerError, i18nEl)).toBeUndefined()
    expect(serverMessage(noAnswerError, i18nEn)).toBeUndefined()

    // Even if message was "Backend unreachable." or "Internal server error"
    const proxyError: ServerError = {
      code: NO_ANSWER_CODE,
      message: 'Backend unreachable.',
    }
    expect(serverMessage(proxyError, i18nEl)).toBeUndefined()
    expect(serverMessage(proxyError, i18nEn)).toBeUndefined()
  })

  it('still renders common.requestTimedOut for REQUEST_TIMEOUT_CODE', () => {
    const timeoutError: ServerError = {
      code: REQUEST_TIMEOUT_CODE,
      message: 'Request timed out after 12s.',
    }

    expect(serverMessage(timeoutError, i18nEl)).toBe(
      'Ο διακομιστής δεν απάντησε εγκαίρως. Δοκιμάστε ξανά σε λίγο.',
    )
    expect(serverMessage(timeoutError, i18nEn)).toBe(
      'The server did not answer in time. Please try again in a moment.',
    )
  })

  it('still renders coded server refusals with templates (e.g. PARTNER_PAUSED)', () => {
    const pausedError: ServerError = {
      code: 'PARTNER_PAUSED',
      message: 'Ordering is paused until 21:30.',
      params: { until: '2026-11-23T19:30:00.000Z' },
    }

    expect(serverMessage(pausedError, i18nEl)).toBe('Οι παραγγελίες έχουν παυθεί έως τις 21:30.')
    expect(serverMessage(pausedError, i18nEn)).toBe('Ordering is paused until 21:30.')
  })

  it('still keeps the server message when error has an unknown or unmapped refusal code', () => {
    const customError: ServerError = {
      code: 'SOME_NEW_SERVER_CODE',
      message: 'Specific English refusal sentence.',
    }

    expect(serverMessage(customError, i18nEl)).toBe('Specific English refusal sentence.')
    expect(serverMessage(customError, i18nEn)).toBe('Specific English refusal sentence.')
  })

  it('proves the KNOWN GAP block is removed from serverText.ts (Row 151)', () => {
    const sourceFilePath = path.join(__dirname, 'serverText.ts')
    const sourceContent = fs.readFileSync(sourceFilePath, 'utf-8')

    // The KNOWN GAP comment block was decision 124.2's placeholder, which row 151 resolves.
    expect(sourceContent).not.toContain('// KNOWN GAP')
    expect(sourceContent).not.toContain('KNOWN GAP, left as it was')
  })
})
