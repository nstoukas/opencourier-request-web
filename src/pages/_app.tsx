import type { AppProps } from 'next/app'
import Head from 'next/head'
import { IconContext } from '@phosphor-icons/react'
import { Toaster } from '../admin-web-components'
import { PortalFrame } from '../modules/portal/components/PortalFrame'
import '../admin-web-components/styles/globals.css'

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

export default function App({ Component, pageProps }: AppProps) {
  return (
    // A React context Provider hands a value to every component below it without passing props.
    <IconContext.Provider value={ICON_DEFAULTS}>
      {/* The OpenCourier app icon, on every page (files in public/, made from the design system's app icon). */}
      <Head>
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
  )
}
