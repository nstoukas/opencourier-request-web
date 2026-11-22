// One i18next instance per page load (spec 0054, cross check 2). On the server many restaurants'
// pages render at once, so a single shared instance would let one request's language leak into
// another's page. Each render of _app makes its own and hands it down with I18nextProvider.
import i18next, { type i18n as I18n } from 'i18next'
import { en } from './resources/en'
import { el } from './resources/el'
import { DEFAULT_LANGUAGE, type Language } from './language'

// The texts, one set per language, under i18next's default namespace "translation".
export const RESOURCES = {
  el: { translation: el },
  en: { translation: en },
}

/** A ready to use i18next instance in `language`. Synchronous: the texts are bundled, nothing loads. */
export function createI18n(language: Language = DEFAULT_LANGUAGE): I18n {
  const instance = i18next.createInstance()
  // init returns a promise, but with bundled resources and initAsync false the instance is ready
  // when init returns, so the server can render with it straight away. `void` says we ignore it.
  void instance.init({
    resources: RESOURCES,
    lng: language,
    // A key missing in Greek would show English rather than the bare key (TypeScript already
    // refuses a missing key, see el.ts, so this is only a safety net).
    fallbackLng: 'en',
    initAsync: false,
    // React already escapes text it renders, so i18next must not escape it a second time.
    interpolation: { escapeValue: false },
    // No Suspense: the texts are already here, there is nothing to wait for.
    react: { useSuspense: false },
  })
  return instance
}
