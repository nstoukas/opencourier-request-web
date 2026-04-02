import type { AppProps } from 'next/app'
import Link from 'next/link'
import { Button, Toaster } from '../admin-web-components'
import '../admin-web-components/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <Link href="/manual-request" className="font-semibold text-base">
            Open Courier
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/manual-request">
              <Button variant="ghost" size="sm">New Delivery</Button>
            </Link>
            <Link href="/manual-request/deliveries">
              <Button variant="outline" size="sm">Deliveries</Button>
            </Link>
          </nav>
        </div>
      </header>
      <Component {...pageProps} />
      <Toaster />
    </>
  )
}
