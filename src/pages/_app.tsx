import type { AppProps } from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import { IconContext } from '@phosphor-icons/react'
import { Button, Toaster } from '../admin-web-components'
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
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <Link href="/manual-request" className="font-semibold text-base">
            OpenCourier
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/manual-request">
              <Button variant="ghost" size="sm">New Delivery</Button>
            </Link>
            <Link href="/manual-request/deliveries">
              <Button variant="outline" size="sm">My Orders</Button>
            </Link>
          </nav>
        </div>
      </header>
      <Component {...pageProps} />
      <Toaster />
    </IconContext.Provider>
  )
}
