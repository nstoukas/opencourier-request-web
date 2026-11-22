import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { LanguageSwitch } from './LanguageSwitch'
import { createI18n } from './createI18n'

describe('LanguageSwitch component (spec 0054, AC-2, decisions 47.2 & 47.4)', () => {
  const originalCookie = document.cookie
  const originalLang = document.documentElement.lang

  afterEach(() => {
    document.cookie = originalCookie
    document.documentElement.lang = originalLang
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

  it('clicking English button switches language, saves cookie, and updates <html lang>', () => {
    const i18n = createI18n('el')
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitch />
      </I18nextProvider>,
    )

    const elBtn = screen.getByRole('button', { name: 'Ελληνικά' })
    const enBtn = screen.getByRole('button', { name: 'English' })

    fireEvent.click(enBtn)

    // Saves choice in oc_lang cookie
    expect(document.cookie).toContain('oc_lang=en')
    // Updates document language attribute for accessibility
    expect(document.documentElement.lang).toBe('en')
    // Changes active language in i18n instance
    expect(i18n.language).toBe('en')
    // Updates pressed state on buttons
    expect(enBtn).toHaveAttribute('aria-pressed', 'true')
    expect(elBtn).toHaveAttribute('aria-pressed', 'false')
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
    cookieSpy.mockRestore()
  })
})
