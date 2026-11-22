import { useEffect, useState } from 'react'
// NextApp is Next's own App component; its getInitialProps runs each page's own getInitialProps.
import NextApp, { type AppContext, type AppProps } from 'next/app'
import Head from 'next/head'
// I18nextProvider hands one i18next instance to every component below it (spec 0054, AC-2).
import { I18nextProvider } from 'react-i18next'
import { IconContext } from '@phosphor-icons/react'
import { Toaster } from '../admin-web-components'
import { PortalFrame } from '../modules/portal/components/PortalFrame'
import '../admin-web-components/styles/globals.css'
import { createI18n } from '../i18n/createI18n'
import { DEFAULT_LANGUAGE, languageFromCookies, type Language } from '../i18n/language'

// Phosphor icons are pictures beside words, so screen readers should skip them. lucide did
// this on its own; Phosphor does not, so every icon gets aria-hidden here by default. An icon
// that carries meaning alone (the Spinner) passes aria-hidden={false}, and an icon only button
// needs its own words (an sr-only span or aria-label).
// The value replaces Phosphor's defaults rather than adding to them, so they are repeated here.
const ICON_DEFAULTS = {
  color: 'currentColor',
  size: '1em',
  weight: 'regular',
  mirrored: false,
  'aria-hidden': true,
} as const

// AppProps plus the language getInitialProps read from the `oc_lang` cookie. `&` joins two types;
// `?` lets a caller leave it out (Greek then, the default).
type PortalAppProps = AppProps & { language?: Language }

export default function App({ Component, pageProps, language = DEFAULT_LANGUAGE }: PortalAppProps) {
  // One i18next instance for this page load, made once in the language the server read (cross
  // check 2 of spec 0054). useState with a function runs it on the first render only.
  const [i18n] = useState(() => createI18n(language))

  // The cookie changed under us (another tab switched language) and a page change read it again:
  // follow it, so the page and the cookie never disagree.
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language)
  }, [i18n, language])

  return (
    <I18nextProvider i18n={i18n}>
      {/* A React context Provider hands a value to every component below it without passing props. */}
      <IconContext.Provider value={ICON_DEFAULTS}>
        {/* The OpenCourier app icon, on every page (files in public/, made from the design system's app icon). */}
        <Head>
          {/* Phone width layout. viewport-fit=cover lets the order form's fixed bar pad itself clear of
              a phone's home indicator (env(safe-area-inset-bottom), spec 0006). */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="icon" href="/favicon.ico" sizes="48x48" />
          <link rel="icon" type="image/png" href="/icon-192.png" sizes="192x192" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </Head>
        {/* The sticky header, the 768px column and the sign in gate, around every page. */}
        <PortalFrame>
          <Component {...pageProps} />
        </PortalFrame>
        <Toaster />
      </IconContext.Provider>
    </I18nextProvider>
  )
}

// getInitialProps runs on the server for the first page load (with the request's Cookie header)
// and in the browser for each later page change (with document.cookie). Reading the language
// here, not in a useEffect, is what lets the first HTML already be in the right language with no
// flash and no hydration mismatch (spec 0054, AC-2). It also turns off Next's static pages for
// this app, which is fine: every page sits behind the sign in anyway.
App.getInitialProps = async (context: AppContext) => {
  const appProps = await NextApp.getInitialProps(context)
  const cookies = context.ctx.req
    ? context.ctx.req.headers.cookie
    : typeof document !== 'undefined'
      ? document.cookie
      : undefined
  return { ...appProps, language: languageFromCookies(cookies) }
}
