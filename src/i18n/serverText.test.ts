import { createI18n } from './createI18n'
import {
  codedSentenceText,
  serverMessage,
  REQUEST_TIMEOUT_CODE,
  ServerError,
} from './serverText'

describe('serverText (Row 124, spec 0054 AC-6, decisions 124.1, 124.9, 124.10)', () => {
  const i18nEl = createI18n('el')
  const i18nEn = createI18n('en')

  describe('serverMessage', () => {
    it('renders server refusals by code in Greek and English with params (pause ordering, re-sent leg)', () => {
      // 1. Pause ordering refusal: PARTNER_PAUSED (2026-11-23T19:30:00.000Z -> 21:30 in Athens)
      const pausedError: ServerError = {
        code: 'PARTNER_PAUSED',
        message: 'Ordering is paused until 21:30.',
        params: { until: '2026-11-23T19:30:00.000Z' },
      }
      expect(serverMessage(pausedError, i18nEl)).toBe('Οι παραγγελίες έχουν παυθεί έως τις 21:30.')
      expect(serverMessage(pausedError, i18nEn)).toBe('Ordering is paused until 21:30.')

      // 2. Re-sent leg refusal: LEG_TAKEN
      const legTakenError: ServerError = {
        code: 'LEG_TAKEN',
        message: 'Leg 2 of 3 of this order was already sent.',
        params: { legNumber: 2, legCount: 3 },
      }
      expect(serverMessage(legTakenError, i18nEl)).toBe(
        'Το σκέλος 2 από 3 αυτής της παραγγελίας έχει ήδη σταλεί.',
      )
      expect(serverMessage(legTakenError, i18nEn)).toBe(
        'Leg 2 of 3 of this order was already sent.',
      )

      // 3. Leg count mismatch: LEG_COUNT_MISMATCH
      const legCountMismatchError: ServerError = {
        code: 'LEG_COUNT_MISMATCH',
        message: 'This order was sent as 2 legs; leg 3 of 3 does not match.',
        params: { sentCount: 2, legNumber: 3, legCount: 3 },
      }
      expect(serverMessage(legCountMismatchError, i18nEl)).toBe(
        'Αυτή η παραγγελία στάλθηκε σε 2 σκέλη· το σκέλος 3 από 3 δεν ταιριάζει.',
      )
      expect(serverMessage(legCountMismatchError, i18nEn)).toBe(
        'This order was sent as 2 legs; leg 3 of 3 does not match.',
      )

      // 4. Partner disabled: PARTNER_DISABLED
      const partnerDisabledError: ServerError = {
        code: 'PARTNER_DISABLED',
        message: 'The co-op has disabled this restaurant: audit pending',
        params: { reason: 'audit pending' },
      }
      expect(serverMessage(partnerDisabledError, i18nEl)).toBe(
        'Ο συνεταιρισμός έχει απενεργοποιήσει αυτό το κατάστημα: audit pending',
      )
      expect(serverMessage(partnerDisabledError, i18nEn)).toBe(
        'The co-op has disabled this restaurant: audit pending',
      )
    })

    it('falls back to the server English message when code is missing from templates', () => {
      const unknownCodeError: ServerError = {
        code: 'NEW_UNMAPPED_SERVER_REFUSAL_CODE',
        message: 'Specific English refusal sentence from newer server.',
      }
      expect(serverMessage(unknownCodeError, i18nEl)).toBe(
        'Specific English refusal sentence from newer server.',
      )
      expect(serverMessage(unknownCodeError, i18nEn)).toBe(
        'Specific English refusal sentence from newer server.',
      )
    })

    it('keeps its own message when an error has no code', () => {
      const uncodedError: ServerError = {
        message: 'A custom error sentence with no refusal code.',
      }
      expect(serverMessage(uncodedError, i18nEl)).toBe(
        'A custom error sentence with no refusal code.',
      )
      expect(serverMessage(uncodedError, i18nEn)).toBe(
        'A custom error sentence with no refusal code.',
      )
    })

    it('returns undefined when error is null, undefined, empty, or has no non-empty message', () => {
      expect(serverMessage(null, i18nEl)).toBeUndefined()
      expect(serverMessage(undefined, i18nEl)).toBeUndefined()
      expect(serverMessage({}, i18nEl)).toBeUndefined()
      expect(serverMessage({ message: '' }, i18nEl)).toBeUndefined()
      expect(serverMessage('non-object' as any, i18nEl)).toBeUndefined()
    })

    it('shows common.requestTimedOut in the reader’s language for a timeout (decision 124.10)', () => {
      const timeoutError: ServerError = {
        code: REQUEST_TIMEOUT_CODE,
        message: 'Request timed out after 15s. Check backend availability and token.',
      }
      // Greek: Greek portal sentence
      expect(serverMessage(timeoutError, i18nEl)).toBe(
        'Ο διακομιστής δεν απάντησε εγκαίρως. Δοκιμάστε ξανά σε λίγο.',
      )
      // English: English portal sentence
      expect(serverMessage(timeoutError, i18nEn)).toBe(
        'The server did not answer in time. Please try again in a moment.',
      )
    })

    it('falls back to the English message when rendering throws (safeRender, decision 124.9)', () => {
      // A param property whose getter throws simulates an unexpected runtime error inside render()
      const throwingParams = {}
      Object.defineProperty(throwingParams, 'until', {
        get() {
          throw new Error('Simulation of unexpected throw during interpolation')
        },
      })

      const throwingError: ServerError = {
        code: 'PARTNER_PAUSED',
        message: 'Fallback English message for paused ordering.',
        params: throwingParams as any,
      }

      expect(serverMessage(throwingError, i18nEl)).toBe(
        'Fallback English message for paused ordering.',
      )
      expect(serverMessage(throwingError, i18nEn)).toBe(
        'Fallback English message for paused ordering.',
      )
    })
  })

  describe('codedSentenceText', () => {
    it('renders dispatch stop banner sentences in Greek and English with nested reason enum ($t)', () => {
      // Notice group: DISPATCH_STOPPED_RESTAURANT
      const greekBanner = codedSentenceText(
        i18nEl,
        'notice',
        'DISPATCH_STOPPED_RESTAURANT',
        { until: '2026-11-23T19:30:00.000Z', reason: 'HEAT' },
        'Delivery is stopped until 21:30 (heat).',
      )
      expect(greekBanner).toContain('Οι διανομές έχουν σταματήσει')
      expect(greekBanner).toContain('21:30')
      expect(greekBanner).toContain('(καύσωνας)')

      const englishBanner = codedSentenceText(
        i18nEn,
        'notice',
        'DISPATCH_STOPPED_RESTAURANT',
        { until: '2026-11-23T19:30:00.000Z', reason: 'HEAT' },
        'Delivery is stopped until 21:30 (heat).',
      )
      expect(englishBanner).toContain('Delivery is stopped until 21:30')
      expect(englishBanner).toContain('(heat)')

      // Notice group: DISPATCH_STOPPED_RESTAURANT_OPEN (no end time)
      const greekOpenBanner = codedSentenceText(
        i18nEl,
        'notice',
        'DISPATCH_STOPPED_RESTAURANT_OPEN',
        { reason: 'STORM' },
        'Delivery is stopped until dispatch restarts (storm).',
      )
      expect(greekOpenBanner).toBe(
        'Οι διανομές έχουν σταματήσει μέχρι να ξαναρχίσουν (καταιγίδα).',
      )

      const englishOpenBanner = codedSentenceText(
        i18nEn,
        'notice',
        'DISPATCH_STOPPED_RESTAURANT_OPEN',
        { reason: 'STORM' },
        'Delivery is stopped until dispatch restarts (storm).',
      )
      expect(englishOpenBanner).toBe(
        'Delivery is stopped until dispatch restarts (storm).',
      )
    })

    it('renders the not accepting line (error group) in Greek and English', () => {
      const fallbackEnglish = 'Ordering is paused until 21:30.'
      const greekNotAccepting = codedSentenceText(
        i18nEl,
        'error',
        'PARTNER_PAUSED',
        { until: '2026-11-23T19:30:00.000Z' },
        fallbackEnglish,
      )
      expect(greekNotAccepting).toBe('Οι παραγγελίες έχουν παυθεί έως τις 21:30.')

      const englishNotAccepting = codedSentenceText(
        i18nEn,
        'error',
        'PARTNER_PAUSED',
        { until: '2026-11-23T19:30:00.000Z' },
        fallbackEnglish,
      )
      expect(englishNotAccepting).toBe('Ordering is paused until 21:30.')
    })

    it('falls back to the server English when code is missing, null, undefined, or unknown', () => {
      const fallbackEnglish = 'Original English sentence sent by server.'

      // Null code
      expect(codedSentenceText(i18nEl, 'notice', null, {}, fallbackEnglish)).toBe(fallbackEnglish)

      // Undefined code
      expect(codedSentenceText(i18nEl, 'notice', undefined, {}, fallbackEnglish)).toBe(fallbackEnglish)

      // Empty string code
      expect(codedSentenceText(i18nEl, 'notice', '', {}, fallbackEnglish)).toBe(fallbackEnglish)

      // Unknown code not in templates
      expect(
        codedSentenceText(i18nEl, 'notice', 'UNKNOWN_NOTICE_CODE_999', {}, fallbackEnglish),
      ).toBe(fallbackEnglish)
    })

    it('falls back to the English sentence when rendering throws (safeRender)', () => {
      const fallbackEnglish = 'Delivery is stopped until 21:30 (heat).'
      const throwingParams = {}
      Object.defineProperty(throwingParams, 'until', {
        get() {
          throw new Error('Explode during format')
        },
      })

      const result = codedSentenceText(
        i18nEl,
        'notice',
        'DISPATCH_STOPPED_RESTAURANT',
        throwingParams,
        fallbackEnglish,
      )

      expect(result).toBe(fallbackEnglish)
    })
  })
})
