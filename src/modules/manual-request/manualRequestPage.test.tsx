import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import ManualRequestPage from '../../pages/manual-request'

// Mock CreateDeliveryForm to isolate page wrapper rendering
jest.mock('./components/CreateDeliveryForm', () => ({
  CreateDeliveryForm: () => <div data-testid="create-delivery-form">Mocked Create Delivery Form</div>,
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
})
