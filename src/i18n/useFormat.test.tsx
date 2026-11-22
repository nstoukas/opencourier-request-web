import React from 'react'
import { renderHook } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { useFormat } from './useFormat'
import { createI18n } from './createI18n'

describe('useFormat hook (spec 0054, AC-3)', () => {
  it('formats values in Greek when language is el', () => {
    const i18n = createI18n('el')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    )

    const { result } = renderHook(() => useFormat(), { wrapper })

    expect(result.current.language).toBe('el')
    // Greek money format: "12,50 €"
    expect(result.current.money(1250, 'EUR').replace(/[\u00a0\u202f]/g, ' ')).toBe('12,50 €')
    // Greek distance format: decimal comma
    expect(result.current.distance(3.4, 'KM')).toBe('3,4 km')
    // Athens time: 2026-09-30T20:25:00Z -> 23:25 (UTC+3 summer)
    expect(result.current.dateTime('2026-09-30T20:25:00Z')).toBe('30/09/2026, 23:25')
    expect(result.current.time('2026-09-30T20:25:00Z')).toBe('23:25')
    expect(result.current.date('2026-09-30T20:25:00Z')).toBe('30/09/2026')
    // Greek atTime (Finding 5, decision 47.16): "στη" at 01:00-01:59 (22:05 UTC summer = 01:05 Athens), "στις" otherwise
    expect(result.current.atTime('2026-09-30T22:05:00Z')).toBe('στη 01:05')
    expect(result.current.atTime('2026-09-30T20:25:00Z')).toBe('στις 23:25')
  })

  it('formats values in English when language is en', () => {
    const i18n = createI18n('en')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    )

    const { result } = renderHook(() => useFormat(), { wrapper })

    expect(result.current.language).toBe('en')
    // English money format: "€12.50"
    expect(result.current.money(1250, 'EUR').replace(/[\u00a0\u202f]/g, ' ')).toBe('€12.50')
    // English distance format: decimal dot
    expect(result.current.distance(3.4, 'KM')).toBe('3.4 km')
    // Athens time: 2026-09-30T20:25:00Z -> 23:25 (24-hour clock preserved)
    expect(result.current.dateTime('2026-09-30T20:25:00Z')).toBe('30/09/2026, 23:25')
    expect(result.current.time('2026-09-30T20:25:00Z')).toBe('23:25')
    expect(result.current.date('2026-09-30T20:25:00Z')).toBe('30/09/2026')
    // English atTime: always "at"
    expect(result.current.atTime('2026-09-30T22:05:00Z')).toBe('at 01:05')
    expect(result.current.atTime('2026-09-30T20:25:00Z')).toBe('at 23:25')
  })

  it('returns em dash for missing or null values in both languages', () => {
    const i18n = createI18n('el')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    )

    const { result } = renderHook(() => useFormat(), { wrapper })

    expect(result.current.money(null, 'EUR')).toBe('—')
    expect(result.current.money(undefined, 'EUR')).toBe('—')
    expect(result.current.distance(null, 'KM')).toBe('—')
    expect(result.current.distance(undefined, 'KM')).toBe('—')
    expect(result.current.dateTime(null)).toBe('—')
    expect(result.current.time(null)).toBe('—')
    expect(result.current.date(null)).toBe('—')
  })
})
