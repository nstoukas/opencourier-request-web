import { isMessageKey, keyMessage, showMessage, textMessage, type ShownMessage } from './shownMessage'
import { createI18n } from './createI18n'

describe('shownMessage utilities (row 47 review finding 3, decision 47.17)', () => {
  const i18n = createI18n('en')
  const t = i18n.t

  describe('keyMessage and textMessage constructors', () => {
    it('creates a key message with key and optional values', () => {
      const msgWithoutValues = keyMessage('form.confirmPin')
      expect(msgWithoutValues).toEqual({ key: 'form.confirmPin', values: undefined })

      const msgWithValues = keyMessage('common.minutes', { count: 5 })
      expect(msgWithValues).toEqual({ key: 'common.minutes', values: { count: 5 } })
    })

    it('creates a text message with raw string', () => {
      const msg = textMessage('Server error occurred')
      expect(msg).toEqual({ text: 'Server error occurred' })
    })
  })

  describe('showMessage', () => {
    it('translates key message using provided t function', () => {
      const msg = keyMessage('form.confirmPin')
      expect(showMessage(msg, t)).toBe('Confirm the pin on the map')

      const elI18n = createI18n('el')
      expect(showMessage(msg, elI18n.t)).toBe('Επιβεβαιώστε την πινέζα στον χάρτη')
    })

    it('interpolates values when translating key message', () => {
      const msg = keyMessage('common.minutes', { count: 3 })
      expect(showMessage(msg, t)).toBe('3 min')

      const elI18n = createI18n('el')
      expect(showMessage(msg, elI18n.t)).toBe('3 λεπτά')
    })

    it('returns raw text unchanged for text messages without passing to t', () => {
      const rawText = 'Unique server refusal sentence from backend'
      const msg = textMessage(rawText)
      expect(showMessage(msg, t)).toBe(rawText)

      const elI18n = createI18n('el')
      expect(showMessage(msg, elI18n.t)).toBe(rawText)
    })
  })

  describe('isMessageKey', () => {
    it('returns true when message has a key matching the queried key', () => {
      const msg = keyMessage('form.confirmPin')
      expect(isMessageKey(msg, 'form.confirmPin')).toBe(true)
    })

    it('returns false when key message has a different key', () => {
      const msg = keyMessage('form.confirmPin')
      expect(isMessageKey(msg, 'other.key')).toBe(false)
    })

    it('returns false for text messages', () => {
      const msg = textMessage('form.confirmPin')
      expect(isMessageKey(msg, 'form.confirmPin')).toBe(false)
    })

    it('returns false when message is null', () => {
      expect(isMessageKey(null, 'form.confirmPin')).toBe(false)
    })
  })
})
