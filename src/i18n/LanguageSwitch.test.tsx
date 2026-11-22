import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { LanguageSwitch } from './LanguageSwitch'
import { createI18n } from './createI18n'
import * as api from '../api/manualRequestApi'
import { toast } from '../admin-web-components'
import {
  forgetChosenBeforeSignIn,
  wasChosenBeforeSignIn,
} from './languageChoice'

// Mock api.saveAccountLanguage so we can spy on server calls
jest.mock('../api/manualRequestApi', () => ({
  ...jest.requireActual('../api/manualRequestApi'),
  saveAccountLanguage: jest.fn(),
}))

// Mock toast to verify notifications
jest.mock('../admin-web-components', () => ({
  ...jest.requireActual('../admin-web-components'),
  toast: jest.fn(),
}))

describe('LanguageSwitch component (spec 0054, AC-2, decisions 47.2, 47.4 & 47.55)', () => {
  const originalCookie = document.cookie
  const originalLang = document.documentElement.lang

  beforeEach(() => {
    jest.clearAllMocks()
    forgetChosenBeforeSignIn()
  })

  afterEach(() => {
    document.cookie = originalCookie
    document.documentElement.lang = originalLang
    forgetChosenBeforeSignIn()
  })

  it('renders switch with buttons for Greek and English, marking active language as pressed', () => {
    const i18n = createI18n('el')
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitch />
      </I18nextProvider>,
    )

    const elBtn = screen.getByRole('button', { name: 'Ελληνικά' })
    const enBtn = screen.getByRole('button', { name: 'English' })

    expect(elBtn).toHaveTextContent('ΕΛ')
    expect(enBtn).toHaveTextContent('EN')
    expect(elBtn).toHaveAttribute('aria-pressed', 'true')
    expect(enBtn).toHaveAttribute('aria-pressed', 'false')
  })

  describe('when not signed in (signedIn=false, e.g. on sign in card)', () => {
    it('clicking English switches language, marks chosenBeforeSignIn, and does NOT call saveAccountLanguage', () => {
      const i18n = createI18n('el')
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitch signedIn={false} />
        </I18nextProvider>,
      )

      const enBtn = screen.getByRole('button', { name: 'English' })
      fireEvent.click(enBtn)

      // Saves choice in oc_lang cookie and updates html lang
      expect(document.cookie).toContain('oc_lang=en')
      expect(document.documentElement.lang).toBe('en')
      expect(i18n.language).toBe('en')

      // Marks choice so subsequent sign in will save it to the account
      expect(wasChosenBeforeSignIn()).toBe(true)

      // Must not call server API when not signed in
      expect(api.saveAccountLanguage).not.toHaveBeenCalled()
    })

    it('clicking Greek button when in English switches back to Greek and saves cookie', () => {
      const i18n = createI18n('en')
      document.documentElement.lang = 'en'
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitch />
        </I18nextProvider>,
      )

      const elBtn = screen.getByRole('button', { name: 'Ελληνικά' })
      const enBtn = screen.getByRole('button', { name: 'English' })

      expect(enBtn).toHaveAttribute('aria-pressed', 'true')

      fireEvent.click(elBtn)

      expect(document.cookie).toContain('oc_lang=el')
      expect(document.documentElement.lang).toBe('el')
      expect(i18n.language).toBe('el')
      expect(elBtn).toHaveAttribute('aria-pressed', 'true')
      expect(enBtn).toHaveAttribute('aria-pressed', 'false')
      expect(wasChosenBeforeSignIn()).toBe(true)
      expect(api.saveAccountLanguage).not.toHaveBeenCalled()
    })

    it('clicking the already active language is a no-op', () => {
      const i18n = createI18n('el')
      const cookieSpy = jest.spyOn(document, 'cookie', 'set')
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitch />
        </I18nextProvider>,
      )

      const elBtn = screen.getByRole('button', { name: 'Ελληνικά' })
      fireEvent.click(elBtn)

      expect(cookieSpy).not.toHaveBeenCalled()
      expect(i18n.language).toBe('el')
      expect(wasChosenBeforeSignIn()).toBe(false)
      cookieSpy.mockRestore()
    })
  })

  describe('when signed in (signedIn=true, e.g. in PortalHeader)', () => {
    it('switches language and calls saveAccountLanguage to persist choice to account (decision 47.55)', async () => {
      ;(api.saveAccountLanguage as jest.Mock).mockResolvedValue(undefined)
      const i18n = createI18n('el')

      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitch signedIn={true} />
        </I18nextProvider>,
      )

      const enBtn = screen.getByRole('button', { name: 'English' })
      fireEvent.click(enBtn)

      // Switches page immediately
      expect(document.cookie).toContain('oc_lang=en')
      expect(document.documentElement.lang).toBe('en')
      expect(i18n.language).toBe('en')

      // Calls server API to persist choice on account
      expect(api.saveAccountLanguage).toHaveBeenCalledWith('en')
      // Does not mark chosenBeforeSignIn because user is already signed in
      expect(wasChosenBeforeSignIn()).toBe(false)
      expect(toast).not.toHaveBeenCalled()
    })

    it('shows destructive toast when saveAccountLanguage rejects, keeping the page switched', async () => {
      ;(api.saveAccountLanguage as jest.Mock).mockRejectedValue(new Error('Network error'))
      const i18n = createI18n('el')

      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitch signedIn={true} />
        </I18nextProvider>,
      )

      const enBtn = screen.getByRole('button', { name: 'English' })
      fireEvent.click(enBtn)

      // Page still switches locally
      expect(i18n.language).toBe('en')
      expect(document.documentElement.lang).toBe('en')

      // Error toast shown
      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: i18n.t('language.saveFailed'),
          variant: 'destructive',
        })
      })
    })

    it('clicking the already active language when signed in is a no-op', () => {
      const i18n = createI18n('el')
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitch signedIn={true} />
        </I18nextProvider>,
      )

      const elBtn = screen.getByRole('button', { name: 'Ελληνικά' })
      fireEvent.click(elBtn)

      expect(api.saveAccountLanguage).not.toHaveBeenCalled()
      expect(toast).not.toHaveBeenCalled()
    })
  })
})
