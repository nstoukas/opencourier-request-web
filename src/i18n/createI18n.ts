// One i18next instance per page load (spec 0054, cross check 2). On the server many restaurants'
// pages render at once, so a single shared instance would let one request's language leak into
// another's page. Each render of _app makes its own and hands it down with I18nextProvider.
import i18next, { type i18n as I18n } from 'i18next'
import { en } from './resources/en'
import { el } from './resources/el'
import { serverEn } from './resources/serverEn'
import { serverEl } from './resources/serverEl'
import { DEFAULT_LANGUAGE, type Language } from './language'

// The texts, one set per language, under i18next's default namespace "translation". The server's own
// templates (`server.error.*`, `server.notice.*`, ...) sit beside the portal's, a copy of the backend's,
// rendered by src/i18n/serverText.ts. `...` spreads both objects' keys into one.
export const RESOURCES = {
  el: { translation: { ...el, ...serverEl } },
  en: { translation: { ...en, ...serverEn } },
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
