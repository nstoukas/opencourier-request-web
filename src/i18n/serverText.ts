// ─────────────────────────────────────────────────────────────────────────────────────────────
// SERVER ERROR CODES: the one place where a backend refusal becomes words (spec 0054, AC-6).
//
// Today the backend answers a refusal with a sentence in English (and a code that is often the
// generic ERROR), so this returns the server's own sentence, exactly as the portal showed it before
// row 47. When the backend part of row 47 lands, every refusal a person can see carries a specific
// `code` and, where it has numbers, `params`. Then this function looks the code up:
//
//     if (code && i18n.exists(`serverErrors.${code}`)) return t(`serverErrors.${code}`, params)
//
// and only falls back to the server's sentence for a code it does not know. Every caller already
// goes through here (restaurantErrorText and the order form's plainErrorMessage), so that change is
// made in this file alone, plus the `serverErrors` keys in both language files (decision 47.3).
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The shape a failed partner call throws (manualRequestFetch sets these). */
export interface ServerError {
  message?: string
  code?: string
  statusCode?: number
  params?: Record<string, unknown>
}

/** The words for a server's refusal, or undefined when it carried none. */
export function serverMessage(error: ServerError | null | undefined): string | undefined {
  const message = error?.message
  return typeof message === 'string' && message.length > 0 ? message : undefined
}
