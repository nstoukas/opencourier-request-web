import { createI18n } from './createI18n'
import {
  applyLanguage,
  forgetChosenBeforeSignIn,
  markChosenBeforeSignIn,
  wasChosenBeforeSignIn,
} from './languageChoice'

describe('languageChoice helpers (spec 0054, AC-2, decision 47.55)', () => {
  const originalCookie = document.cookie
  const originalLang = document.documentElement.lang

  beforeEach(() => {
    forgetChosenBeforeSignIn()
  })

  afterEach(() => {
    document.cookie = originalCookie
    document.documentElement.lang = originalLang
    forgetChosenBeforeSignIn()
  })

  describe('sign-in language choice tracking', () => {
    it('wasChosenBeforeSignIn returns false initially', () => {
      expect(wasChosenBeforeSignIn()).toBe(false)
    })

    it('markChosenBeforeSignIn sets the flag to true', () => {
      markChosenBeforeSignIn()
      expect(wasChosenBeforeSignIn()).toBe(true)
    })

    it('forgetChosenBeforeSignIn resets the flag back to false', () => {
      markChosenBeforeSignIn()
      expect(wasChosenBeforeSignIn()).toBe(true)
      forgetChosenBeforeSignIn()
      expect(wasChosenBeforeSignIn()).toBe(false)
    })
  })

  describe('applyLanguage', () => {
    it('sets cookie, updates document.documentElement.lang, and changes i18n language', () => {
      const i18n = createI18n('el')
      document.documentElement.lang = 'el'

      applyLanguage(i18n, 'en')

      // Verifies cookie is written
      expect(document.cookie).toContain('oc_lang=en')
      // Verifies html lang attribute is updated for accessibility
      expect(document.documentElement.lang).toBe('en')
      // Verifies i18n language changed
      expect(i18n.language).toBe('en')
    })

    it('does not re-trigger changeLanguage if i18n is already in the requested language', () => {
      const i18n = createI18n('el')
      const changeSpy = jest.spyOn(i18n, 'changeLanguage')

      applyLanguage(i18n, 'el')

      expect(changeSpy).not.toHaveBeenCalled()
      expect(document.cookie).toContain('oc_lang=el')
      expect(document.documentElement.lang).toBe('el')
      changeSpy.mockRestore()
    })
  })
})
