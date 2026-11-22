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
// and only falls back to the server's sentence for a code it does not know. Every place that shows a
// server's sentence already goes through here (restaurantErrorText, the order form's plainErrorMessage,
// and the dialogs, cards and sections that show a refusal), so that change is made in this file, plus
// the `serverErrors` keys in both language files (decision 47.3). The function will then need `t`: its
// callers all have one at hand.
//
// KNOWN GAP, wired with the codes (row 47 review, finding 4, ruled pre-existing): several places call
// `serverMessage(err) ?? t(...)` with no status check, so a failure the server never answered (a
// timeout, "Request failed (HTTP 500)", the proxy's "Backend unreachable.") shows our developer English
// and the Greek fallback never appears. They are: deliveries/index.tsx (edit save, edit load, list
// load), AvailabilityStrip, ReadyControls, OrderLegsSection, CancelOrderLegsDialog,
// CancelDeliveryDialog, ReportProductCard, and CreateDeliveryForm's profile load line. When the codes land,
// this function should return undefined for an error with no `statusCode` (or those places should use
// restaurantErrorText, which already does), so only a real refusal's words reach the page.
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
