import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import ManualRequestPage from '../../pages/manual-request'

// Mock CreateDeliveryForm to isolate page wrapper rendering
jest.mock('./components/CreateDeliveryForm', () => ({
  CreateDeliveryForm: () => <div data-testid="create-delivery-form">Mocked Create Delivery Form</div>,
}))

// Mock DispatchBanner to isolate page wrapper rendering and check placement (spec 0014, AC-6)
jest.mock('./components/DispatchBanner', () => ({
  DispatchBanner: () => <div data-testid="dispatch-banner">Mocked Dispatch Banner</div>,
}))

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

describe('ManualRequestPage (/manual-request/index.tsx)', () => {
  it('renders PageHeader with "New Delivery" title and CreateDeliveryForm in portal frame layout', () => {
    render(<ManualRequestPage />)

    // Design system 30px h1 title and description
    expect(screen.getByRole('heading', { level: 1, name: 'New Delivery' })).toBeInTheDocument()
    expect(
      screen.getByText('Ask the co-op for a rider to take an order to your customer.')
    ).toBeInTheDocument()

    // Form is directly rendered (sign-in gate is now owned by PortalFrame)
    expect(screen.getByTestId('create-delivery-form')).toBeInTheDocument()
  })

  it('renders DispatchBanner above CreateDeliveryForm', () => {
    render(<ManualRequestPage />)

    const banner = screen.getByTestId('dispatch-banner')
    const form = screen.getByTestId('create-delivery-form')

    expect(banner).toBeInTheDocument()
    expect(form).toBeInTheDocument()

    // DispatchBanner is positioned above CreateDeliveryForm in the DOM flow
    expect(banner.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const container = banner.parentElement
    expect(container).toBe(form.parentElement)
    const children = Array.from(container?.children ?? [])
    expect(children.indexOf(banner)).toBeLessThan(children.indexOf(form))
  })
})
