import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PortalFrame, PageHeader } from './PortalFrame'
import { usePartnerSession } from '../../../hooks/usePartnerSession'
import * as api from '../../../api/manualRequestApi'

// Mock next/router
const mockRouter = {
  pathname: '/manual-request',
  push: jest.fn(),
  replace: jest.fn(),
}

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

// Mock next/link to render clean anchor
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => {
    return <a href={href} {...rest}>{children}</a>
  },
}))

// Mock custom hook usePartnerSession
jest.mock('../../../hooks/usePartnerSession', () => ({
  usePartnerSession: jest.fn(),
}))

// Mock manualRequestApi logoutPartner
jest.mock('../../../api/manualRequestApi', () => {
  const actual = jest.requireActual('../../../api/manualRequestApi')
  return {
    ...actual,
    logoutPartner: jest.fn(),
  }
})

describe('PortalFrame gate and frame layout', () => {
  const refreshMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockRouter.pathname = '/manual-request'
  })

  it('renders spinner while checking partner session, gate blocking page content', () => {
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: false,
      email: null,
      isLoading: true,
      refresh: refreshMock,
    })

    render(
      <PortalFrame>
        <div data-testid="page-content">Protected restaurant page</div>
      </PortalFrame>
    )

    // Spinner with status role and accessible label
    const spinner = screen.getByRole('status', { name: 'Checking your sign in' })
    expect(spinner).toBeInTheDocument()

    // Page content and header are NOT rendered while loading
    expect(screen.queryByTestId('page-content')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })

  it('signed out at /manual-request/deliveries shows sign in, and after success shows that page', async () => {
    mockRouter.pathname = '/manual-request/deliveries'

    // Initially signed out
    let sessionState = {
      isSignedIn: false,
      email: null,
      isLoading: false,
      refresh: refreshMock,
    }
    ;(usePartnerSession as jest.Mock).mockImplementation(() => sessionState)

    const { rerender } = render(
      <PortalFrame>
        <div data-testid="my-orders-page">My Orders Page Content</div>
      </PortalFrame>
    )

    // Shows SignInScreen at /manual-request/deliveries
    expect(screen.getByRole('heading', { name: 'Restaurant Portal' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument()
    expect(screen.queryByTestId('my-orders-page')).not.toBeInTheDocument()

    // Simulate successful sign in: onSignedIn calls refresh
    sessionState = {
      isSignedIn: true,
      email: 'volos-kitchen@coop.gr',
      isLoading: false,
      refresh: refreshMock,
    }

    rerender(
      <PortalFrame>
        <div data-testid="my-orders-page">My Orders Page Content</div>
      </PortalFrame>
    )

    // After success, shows that page without having navigated away
    expect(screen.getByTestId('my-orders-page')).toBeInTheDocument()
    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('signed in renders sticky 56px header and centered column at most 768px (max-w-3xl)', () => {
    mockRouter.pathname = '/manual-request'
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: true,
      email: 'restaurant@volos.test',
      isLoading: false,
      refresh: refreshMock,
    })

    render(
      <PortalFrame>
        <div data-testid="order-form">Order Form Content</div>
      </PortalFrame>
    )

    // Sticky 56px header (h-14 is 56px)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('sticky', 'top-0', 'h-14', 'border-b', 'bg-background')

    // Header max 768px container (max-w-3xl is 768px)
    const headerContainer = header.querySelector('.max-w-3xl')
    expect(headerContainer).toBeInTheDocument()

    // Header icon and branding with phone-friendly sr-only classes
    const brandLink = screen.getByRole('link', { name: /OpenCourier/i })
    expect(brandLink).toHaveAttribute('href', '/manual-request')
    const appIcon = brandLink.querySelector('img')
    expect(appIcon).toHaveAttribute('src', '/icon-192.png')

    // Email displayed in header
    expect(screen.getByText('restaurant@volos.test')).toBeInTheDocument()

    // Nav links: New Delivery and My Orders
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const newDeliveryLink = screen.getByRole('link', { name: 'New Delivery' })
    const myOrdersLink = screen.getByRole('link', { name: 'My Orders' })
    expect(nav).toContainElement(newDeliveryLink)
    expect(nav).toContainElement(myOrdersLink)

    // Current page: /manual-request has aria-current="page" and shading
    expect(newDeliveryLink).toHaveAttribute('aria-current', 'page')
    expect(newDeliveryLink).toHaveClass('bg-secondary')
    expect(myOrdersLink).not.toHaveAttribute('aria-current')

    // Centered column max 768px (<main id="main" class="mx-auto w-full max-w-3xl...">)
    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main')
    expect(main).toHaveClass('mx-auto', 'w-full', 'max-w-3xl')
    expect(screen.getByTestId('order-form')).toBeInTheDocument()

    // Skip to content accessible jump link
    const skipLink = screen.getByRole('link', { name: 'Skip to content' })
    expect(skipLink).toHaveAttribute('href', '#main')
  })

  it('sets aria-current="page" and shading on My Orders when pathname is /manual-request/deliveries', () => {
    mockRouter.pathname = '/manual-request/deliveries'
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: true,
      email: 'restaurant@volos.test',
      isLoading: false,
      refresh: refreshMock,
    })

    render(
      <PortalFrame>
        <div>Deliveries content</div>
      </PortalFrame>
    )

    const newDeliveryLink = screen.getByRole('link', { name: 'New Delivery' })
    const myOrdersLink = screen.getByRole('link', { name: 'My Orders' })

    expect(myOrdersLink).toHaveAttribute('aria-current', 'page')
    expect(myOrdersLink).toHaveClass('bg-secondary')
    expect(newDeliveryLink).not.toHaveAttribute('aria-current')
  })

  it('Sign Out calls logoutPartner and refresh, and stays on the current address', async () => {
    mockRouter.pathname = '/manual-request/deliveries'
    ;(api.logoutPartner as jest.Mock).mockResolvedValue(undefined)
    refreshMock.mockResolvedValue(undefined)

    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: true,
      email: 'restaurant@volos.test',
      isLoading: false,
      refresh: refreshMock,
    })

    render(
      <PortalFrame>
        <div>Deliveries content</div>
      </PortalFrame>
    )

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i })
    fireEvent.click(signOutBtn)

    await waitFor(() => {
      expect(api.logoutPartner).toHaveBeenCalledTimes(1)
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })

    // PINNED: Sign Out keeps the address (does not router.push or router.replace)
    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })
})

describe('PageHeader component', () => {
  it('renders design system 30px title, description, and optional actions', () => {
    render(
      <PageHeader
        title="New Delivery"
        description="Ask the co-op for a rider to take an order to your customer."
        actions={<a href="/manual-request/deliveries">All deliveries</a>}
      />
    )

    const h1 = screen.getByRole('heading', { level: 1, name: 'New Delivery' })
    expect(h1).toHaveClass('text-3xl', 'font-bold')
    expect(
      screen.getByText('Ask the co-op for a rider to take an order to your customer.')
    ).toHaveClass('text-muted-foreground')
    expect(screen.getByRole('link', { name: 'All deliveries' })).toBeInTheDocument()
  })
})
