// TextEncoder and TextDecoder polyfill for react-dom/server in jsdom environment
const { TextEncoder, TextDecoder } = require('util')
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}
const { renderToString } = require('react-dom/server')
import React from 'react'
import { render } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import type { AppContext } from 'next/app'
import App from '../pages/_app'

// Mock next/head so head elements render safely in server render
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <div data-testid="head-mock">{children}</div>,
}))

// Mock next/router for PortalFrame's header navigation
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/manual-request',
  }),
}))

// Mock partner session as signed in so PortalFrame renders Component without gate blocking
jest.mock('../hooks/usePartnerSession', () => ({
  usePartnerSession: () => ({
    isSignedIn: true,
    email: 'test@example.com',
    isLoading: false,
    refresh: jest.fn(),
  }),
}))

function TestPageComponent() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 data-testid="order-title">{t('bar.getPrice')}</h1>
      <p data-testid="loading-status">{t('common.loading')}</p>
    </div>
  )
}

describe('Server-side rendering and initial HTML language (spec 0054, AC-2, decision 47.30 gap)', () => {
  it('renders initial server HTML in English when server reads oc_lang=en cookie, before any useEffect runs', async () => {
    // 1. App.getInitialProps runs on server with cookie header containing oc_lang=en
    const mockContext = {
      ctx: {
        req: {
          headers: {
            cookie: 'oc_lang=en; session=abc123',
          },
        },
      },
      Component: TestPageComponent,
      router: {} as any,
      AppTree: () => null,
    } as unknown as AppContext

    const initialProps = await App.getInitialProps(mockContext)
    expect(initialProps.language).toBe('en')

    // 2. Server renders HTML via renderToString (which never executes useEffect)
    const html = renderToString(
      <App
        Component={TestPageComponent}
        pageProps={{}}
        router={{} as any}
        language={initialProps.language}
      />,
    )

    // The initial HTML must be in English
    expect(html).toContain('Get price')
    expect(html).toContain('Loading…')
    // Must NOT contain Greek translations
    expect(html).not.toContain('Λήψη τιμής')
    expect(html).not.toContain('Φόρτωση…')
  })

  it('renders initial server HTML in Greek (the default) when no oc_lang cookie is present on server request', async () => {
    const mockContext = {
      ctx: {
        req: {
          headers: {},
        },
      },
      Component: TestPageComponent,
      router: {} as any,
      AppTree: () => null,
    } as unknown as AppContext

    const initialProps = await App.getInitialProps(mockContext)
    expect(initialProps.language).toBe('el')

    const html = renderToString(
      <App
        Component={TestPageComponent}
        pageProps={{}}
        router={{} as any}
        language={initialProps.language}
      />,
    )

    // The initial HTML must be in Greek
    expect(html).toContain('Λήψη τιμής')
    expect(html).toContain('Φόρτωση…')
    // Must NOT contain English translations
    expect(html).not.toContain('Get price')
  })

  it('renders initial server HTML in Greek when server reads a malformed oc_lang cookie (%E0%A4%A)', async () => {
    const mockContext = {
      ctx: {
        req: {
          headers: {
            cookie: 'oc_lang=%E0%A4%A',
          },
        },
      },
      Component: TestPageComponent,
      router: {} as any,
      AppTree: () => null,
    } as unknown as AppContext

    const initialProps = await App.getInitialProps(mockContext)
    expect(initialProps.language).toBe('el')

    const html = renderToString(
      <App
        Component={TestPageComponent}
        pageProps={{}}
        router={{} as any}
        language={initialProps.language}
      />,
    )

    // The initial HTML falls back to Greek without failing
    expect(html).toContain('Λήψη τιμής')
    expect(html).toContain('Φόρτωση…')
  })

  it('updates document.documentElement.lang when language prop changes after cross-tab switch (nit finding on _app.tsx)', () => {
    const originalLang = document.documentElement.lang
    try {
      document.documentElement.lang = 'el'
      const { rerender } = render(
        <App Component={TestPageComponent} pageProps={{}} router={{} as any} language="el" />,
      )
      expect(document.documentElement.lang).toBe('el')

      // Another tab switches cookie to English and Next page navigation passes language="en"
      rerender(<App Component={TestPageComponent} pageProps={{}} router={{} as any} language="en" />)
      expect(document.documentElement.lang).toBe('en')
    } finally {
      document.documentElement.lang = originalLang
    }
  })
})
