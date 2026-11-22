import type { i18n as I18n } from 'i18next'
import { saveLanguageCookie, type Language } from './language'

// Whether the restaurant picked a language on this page load before signing in (the switch on the sign in
// card). Then that choice is what they want, and sign in saves it to their account; otherwise the language
// stored on their account wins at sign in (spec 0054, cross check 2; the same rule as adminweb, decision
// 47.32). Module state: it only has to last until the sign in finishes, and a reload starts over from the
// cookie anyway.
let chosenBeforeSignIn = false

export function markChosenBeforeSignIn(): void {
  chosenBeforeSignIn = true
}

export function wasChosenBeforeSignIn(): boolean {
  return chosenBeforeSignIn
}

// Forgets the choice once a sign in has used it, and on sign out: signing out does not reload the page, so
// without this the next person to sign in on the same tab would have their stored language overwritten.
export function forgetChosenBeforeSignIn(): void {
  chosenBeforeSignIn = false
}

/** Shows the page in `language` now and remembers it in this browser (cookie and <html lang>). */
export function applyLanguage(i18n: I18n, language: Language): void {
  saveLanguageCookie(language)
  if (i18n.language !== language) void i18n.changeLanguage(language)
  // Screen readers and the browser's own spell check read the page's language from <html lang>.
  document.documentElement.lang = language
}
