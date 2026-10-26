import React from 'react'
import fs from 'fs'
import path from 'path'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import App from '../../pages/_app'

// Mock next/head to render children directly into the container
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <div data-testid="head-mock">{children}</div>,
}))

// Mock next/router for PortalFrame
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/manual-request',
  }),
}))

// Mock session hook as signed in so PortalFrame renders synchronously without act warning
jest.mock('../../hooks/usePartnerSession', () => ({
  usePartnerSession: () => ({
    isSignedIn: true,
    email: 'restaurant@volos.test',
    isLoading: false,
    refresh: jest.fn(),
  }),
}))

describe('favicon is the app icon (Clause 4)', () => {
  const rootDir = path.resolve(__dirname, '../../..')
  const publicDir = path.resolve(rootDir, 'public')
  const appFile = path.resolve(rootDir, 'src/pages/_app.tsx')

  it('verifies public icon files exist on disk and are not empty', () => {
    const faviconPath = path.join(publicDir, 'favicon.ico')
    const icon192Path = path.join(publicDir, 'icon-192.png')
    const appleIconPath = path.join(publicDir, 'apple-touch-icon.png')

    expect(fs.existsSync(faviconPath)).toBe(true)
    expect(fs.statSync(faviconPath).size).toBeGreaterThan(0)

    expect(fs.existsSync(icon192Path)).toBe(true)
    expect(fs.statSync(icon192Path).size).toBeGreaterThan(0)

    expect(fs.existsSync(appleIconPath)).toBe(true)
    expect(fs.statSync(appleIconPath).size).toBeGreaterThan(0)
  })

  it('renders favicon.ico, icon-192.png, and apple-touch-icon.png in <Head> of _app.tsx', () => {
    const DummyComponent = () => <div>Page Content</div>
    const { container } = render(<App Component={DummyComponent} pageProps={{}} router={{} as any} />)

    const head = container.querySelector('[data-testid="head-mock"]')
    expect(head).toBeInTheDocument()

    const faviconLink = head?.querySelector('link[href="/favicon.ico"]')
    expect(faviconLink).toBeInTheDocument()
    expect(faviconLink).toHaveAttribute('rel', 'icon')

    const icon192Link = head?.querySelector('link[href="/icon-192.png"]')
    expect(icon192Link).toBeInTheDocument()
    expect(icon192Link).toHaveAttribute('rel', 'icon')
    expect(icon192Link).toHaveAttribute('type', 'image/png')

    const appleLink = head?.querySelector('link[href="/apple-touch-icon.png"]')
    expect(appleLink).toBeInTheDocument()
    expect(appleLink).toHaveAttribute('rel', 'apple-touch-icon')
  })

  it('verifies static markup in src/pages/_app.tsx links the icons in <Head>', () => {
    const appContent = fs.readFileSync(appFile, 'utf8')
    expect(appContent).toMatch(/<link\s+rel="icon"\s+href="\/favicon\.ico"/)
    expect(appContent).toMatch(/<link\s+rel="icon"\s+type="image\/png"\s+href="\/icon-192\.png"/)
    expect(appContent).toMatch(/<link\s+rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"/)
  })
})
