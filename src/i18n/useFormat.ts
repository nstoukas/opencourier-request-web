import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, formatDateTime, formatDistance, formatMoney, formatTime, isOneOClock } from '../utils/format'
import { toLanguage } from './language'

/**
 * The format helpers (src/utils/format.ts) already set to the reader's language (spec 0054, AC-3).
 * A custom hook: a function whose name starts with `use` and that calls other hooks, here
 * useTranslation, so it re-renders the page when the language changes.
 */
export function useFormat() {
  const { i18n, t } = useTranslation()
  const language = toLanguage(i18n.language)
  // useMemo keeps the same object between renders until the language changes.
  return useMemo(
    () => ({
      language,
      money: (cents: number | null | undefined, currency: string | null | undefined) =>
        formatMoney(cents, currency, language),
      dateTime: (iso: string | null | undefined) => formatDateTime(iso, language),
      date: (iso: string | null | undefined) => formatDate(iso, language),
      time: (iso: string | null | undefined) => formatTime(iso, language),
      // "at 13:05" with the right Greek word for "at": "στις 13:05", but "στη 01:05" at one o'clock.
      atTime: (iso: string | null | undefined) =>
        t(isOneOClock(iso) ? 'common.atOneOClock' : 'common.atTime', { time: formatTime(iso, language) }),
      distance: (value: number | null | undefined, unit: string | null | undefined) =>
        formatDistance(value, unit, language),
    }),
    [language, t],
  )
}
