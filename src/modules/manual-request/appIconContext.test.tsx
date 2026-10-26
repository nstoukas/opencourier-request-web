import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { X } from '@phosphor-icons/react'
import App from '../../pages/_app'
import { Spinner } from '../../admin-web-components/components/atoms/Spinner'
import {
  ToastProvider,
  Toast,
  ToastClose,
  ToastViewport,
} from '../../admin-web-components/components/molecules/toast/Toast'

// Mock next/head so head elements render safely in jsdom
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
jest.mock('../../hooks/usePartnerSession', () => ({
  usePartnerSession: () => ({
    isSignedIn: true,
    email: 'test@example.com',
    isLoading: false,
    refresh: jest.fn(),
  }),
}))

describe('Phosphor icon accessibility defaults and IconContext in _app.tsx (Ruling 1)', () => {
  function SmallPage() {
    return (
      <div>
        <X data-testid="page-icon" />
        <Spinner data-testid="default-spinner" />
        <Spinner data-testid="custom-spinner" label="Calculating quote" />
        <ToastProvider>
          <Toast open={true}>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      </div>
    )
  }

  function renderAppWithPage() {
    return render(<App Component={SmallPage} pageProps={{}} router={{} as any} />)
  }

  it('marks decorative Phosphor icons as aria-hidden="true" by default', () => {
    renderAppWithPage()
    const icon = screen.getByTestId('page-icon')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('preserves Phosphor default size (width and height "1em") via provider defaults', () => {
    renderAppWithPage()
    const icon = screen.getByTestId('page-icon')
    expect(icon).toHaveAttribute('width', '1em')
    expect(icon).toHaveAttribute('height', '1em')
  })

  it('keeps role="status" and aria-label on Spinner and ensures it is NOT aria-hidden inside provider', () => {
    renderAppWithPage()

    // Default label ("Loading")
    const defaultSpinner = screen.getByTestId('default-spinner')
    expect(defaultSpinner).toHaveAttribute('role', 'status')
    expect(defaultSpinner).toHaveAttribute('aria-label', 'Loading')
    expect(defaultSpinner.getAttribute('aria-hidden')).not.toBe('true')
    expect(defaultSpinner).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByRole('status', { name: 'Loading' })).toBe(defaultSpinner)

    // Custom label ("Calculating quote")
    const customSpinner = screen.getByTestId('custom-spinner')
    expect(customSpinner).toHaveAttribute('role', 'status')
    expect(customSpinner).toHaveAttribute('aria-label', 'Calculating quote')
    expect(customSpinner.getAttribute('aria-hidden')).not.toBe('true')
    expect(customSpinner).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByRole('status', { name: 'Calculating quote' })).toBe(customSpinner)
  })

  it('ensures toast close button has the accessible name "Close"', () => {
    renderAppWithPage()
    const closeButton = screen.getByRole('button', { name: 'Close' })
    expect(closeButton).toBeInTheDocument()
  })
})
