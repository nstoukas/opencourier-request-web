import type { AppProps } from 'next/app'
import { Toaster } from '../admin-web-components'
import '../admin-web-components/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster />
    </>
  )
}
