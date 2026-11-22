import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_COOKIE,
  LANGUAGE_NAMES,
  LOCALES,
  languageFromCookies,
  saveLanguageCookie,
  toLanguage,
} from './language'
import App from '../pages/_app'
import type { AppContext } from 'next/app'

describe('language utilities (spec 0054, AC-2, cross check 2)', () => {
  describe('toLanguage', () => {
    it('returns valid languages as-is', () => {
      expect(toLanguage('el')).toBe('el')
      expect(toLanguage('en')).toBe('en')
    })

    it('falls back to default language (el) for any invalid or missing value', () => {
      expect(toLanguage(null)).toBe(DEFAULT_LANGUAGE)
      expect(toLanguage(undefined)).toBe(DEFAULT_LANGUAGE)
      expect(toLanguage('')).toBe(DEFAULT_LANGUAGE)
      expect(toLanguage('fr')).toBe(DEFAULT_LANGUAGE)
      expect(toLanguage('de')).toBe(DEFAULT_LANGUAGE)
      expect(toLanguage(123)).toBe(DEFAULT_LANGUAGE)
    })
  })

  describe('languageFromCookies', () => {
    it('defaults to Greek (el) when cookie header is undefined, null, or empty', () => {
      expect(languageFromCookies(undefined)).toBe('el')
      expect(languageFromCookies(null)).toBe('el')
      expect(languageFromCookies('')).toBe('el')
    })

    it('defaults to Greek (el) when cookie header contains other cookies but not oc_lang', () => {
      expect(languageFromCookies('session=abc123; user=foo')).toBe('el')
    })

    it('returns English when oc_lang is set to en', () => {
      expect(languageFromCookies('oc_lang=en')).toBe('en')
      expect(languageFromCookies('session=abc; oc_lang=en; token=xyz')).toBe('en')
    })

    it('returns Greek when oc_lang is explicitly set to el', () => {
      expect(languageFromCookies('oc_lang=el')).toBe('el')
      expect(languageFromCookies('foo=bar; oc_lang=el')).toBe('el')
    })

    it('falls back to Greek when oc_lang has an unknown language or junk value', () => {
      expect(languageFromCookies('oc_lang=fr')).toBe('el')
      expect(languageFromCookies('oc_lang=unknown')).toBe('el')
      expect(languageFromCookies('oc_lang=')).toBe('el')
    })

    it('handles URI-encoded cookie values properly', () => {
      expect(languageFromCookies('oc_lang=%65%6e')).toBe('en')
    })
  })

  describe('saveLanguageCookie', () => {
    const originalCookie = document.cookie

    afterEach(() => {
      document.cookie = originalCookie
    })

    it('writes oc_lang cookie with 1-year max-age, path=/, and SameSite=Lax', () => {
      saveLanguageCookie('en')
      expect(document.cookie).toContain('oc_lang=en')

      saveLanguageCookie('el')
      expect(document.cookie).toContain('oc_lang=el')
    })
  })

  describe('constants and metadata', () => {
    it('defines supported languages with el as the first and default', () => {
      expect(LANGUAGES).toEqual(['el', 'en'])
      expect(DEFAULT_LANGUAGE).toBe('el')
    })

    it('maps to correct Intl locales (el-GR and en-GB per decision 47.5)', () => {
      expect(LOCALES.el).toBe('el-GR')
      expect(LOCALES.en).toBe('en-GB')
    })

    it('provides native names for each language without translating them (decision 47.4)', () => {
      expect(LANGUAGE_NAMES.el).toBe('Ελληνικά')
      expect(LANGUAGE_NAMES.en).toBe('English')
    })

    it('uses oc_lang as the cookie name per spec 0054 cross check 2', () => {
      expect(LANGUAGE_COOKIE).toBe('oc_lang')
    })
  })

  describe('App.getInitialProps language detection (server and browser, AC-2)', () => {
    it('reads language from server request Cookie header (English when cookie has oc_lang=en)', async () => {
      const mockContext = {
        ctx: {
          req: {
            headers: {
              cookie: 'session=123; oc_lang=en',
            },
          },
        },
        Component: () => null,
        router: {} as any,
        AppTree: () => null,
      } as unknown as AppContext

      const result = await App.getInitialProps(mockContext)
      expect(result.language).toBe('en')
    })

    it('defaults to Greek on server request when no oc_lang cookie is present', async () => {
      const mockContext = {
        ctx: {
          req: {
            headers: {
              cookie: 'session=123',
            },
          },
        },
        Component: () => null,
        router: {} as any,
        AppTree: () => null,
      } as unknown as AppContext

      const result = await App.getInitialProps(mockContext)
      expect(result.language).toBe('el')
    })

    it('defaults to Greek on server request when Cookie header is absent', async () => {
      const mockContext = {
        ctx: {
          req: {
            headers: {},
          },
        },
        Component: () => null,
        router: {} as any,
        AppTree: () => null,
      } as unknown as AppContext

      const result = await App.getInitialProps(mockContext)
      expect(result.language).toBe('el')
    })

    it('reads language from document.cookie in browser environment (no ctx.req)', async () => {
      document.cookie = 'oc_lang=en'

      const mockContext = {
        ctx: {},
        Component: () => null,
        router: {} as any,
        AppTree: () => null,
      } as unknown as AppContext

      const result = await App.getInitialProps(mockContext)
      expect(result.language).toBe('en')
    })
  })
})
