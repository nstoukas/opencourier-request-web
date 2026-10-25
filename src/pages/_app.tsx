import type { AppProps } from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import { Button, Toaster } from '../admin-web-components'
import '../admin-web-components/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
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
    </>
  )
}
