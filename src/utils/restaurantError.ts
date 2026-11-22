// The words a restaurant reads when a call fails: the server's own sentence for a refusal (a 4xx, such
// as the 404 "This order is older than 30 days..." for an old order, spec 0017, or a complaint's 409),
// else the caller's general line. A timeout's or the browser's own words, and a 5xx's text, are not for
// restaurants. Shared by the order page and its complaint section (row 83 review). `fallback` comes
// already translated; the server's sentence comes through serverMessage, the one place its error codes
// will be translated (spec 0054, AC-6).
import { serverMessage } from '../i18n/serverText'

export function restaurantErrorText(error: unknown, fallback: string): string {
  const status: number | undefined = (error as any)?.statusCode
  const message = serverMessage(error as any)
  return status !== undefined &&
    status >= 400 &&
    status < 500 &&
    message &&
    !/^Request failed \(HTTP \d+\)$/.test(message)
    ? message
    : fallback
}
