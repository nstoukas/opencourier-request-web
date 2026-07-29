import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import DeliveriesPage from './index'
import { usePartnerSession } from '../../../hooks/usePartnerSession'
import {
  useListManualRequestDeliveriesQuery,
  useUpdateManualRequestDeliveryMutation,
  useCancelManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

// Mock custom hooks
jest.mock('../../../hooks/usePartnerSession', () => ({
  usePartnerSession: jest.fn(),
}))

jest.mock('../../../api/manualRequestApi', () => ({
  fetchPartnerDelivery: jest.fn(),
  useListManualRequestDeliveriesQuery: jest.fn(),
  useUpdateManualRequestDeliveryMutation: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
}))

describe('DeliveriesPage (/manual-request/deliveries/index.tsx)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
  })

  it('renders "Loading deliveries..." while session check is loading', () => {
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: false,
      isLoading: true,
    })
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    render(<DeliveriesPage />)

    expect(screen.getByText('Loading deliveries...')).toBeInTheDocument()
    expect(useListManualRequestDeliveriesQuery).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      skip: true,
    })
  })

  it('renders "Please sign in to view your deliveries." when user is signed out', () => {
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: false,
      isLoading: false,
    })
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    render(<DeliveriesPage />)

    expect(screen.getByText(/Please/i)).toBeInTheDocument()
    expect(screen.getByText('sign in')).toBeInTheDocument()
    expect(screen.getByText(/to view your deliveries\./i)).toBeInTheDocument()
    expect(useListManualRequestDeliveriesQuery).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      skip: true,
    })
  })

  // Test Plan case 13: Signed in heading is "My Orders" and query called with exact object { page: 1, perPage: 20, skip: false }
  // Test Plan case 14: Given two deliveries in mocked response, both render without browser-side filtering
  it('renders My Orders heading and all deliveries returned from partner API query', () => {
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: true,
      isLoading: false,
    })
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'del-001',
            status: 'ACCEPTED',
            orderReference: 'ORD-999',
            totalCost: 500,
            currencyCode: 'EUR',
            createdAt: '2026-07-29T10:00:00Z',
            pickup: { pickupName: 'Nosh', city: 'Volos' },
            dropoff: { dropoffName: 'Customer A', city: 'Volos' },
          },
          {
            id: 'del-002',
            status: 'IN_TRANSIT',
            orderReference: 'ORD-1000',
            totalCost: 750,
            currencyCode: 'EUR',
            createdAt: '2026-07-29T11:00:00Z',
            pickup: { pickupName: 'Nosh', city: 'Volos' },
            dropoff: { dropoffName: 'Customer B', city: 'Volos' },
          },
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    render(<DeliveriesPage />)

    // Case 13 assertions: "My Orders" heading and exact query argument (no partnerId)
    expect(screen.getByRole('heading', { name: 'My Orders' })).toBeInTheDocument()
    expect(screen.getByText("Only your restaurant's deliveries appear here.")).toBeInTheDocument()
    expect(useListManualRequestDeliveriesQuery).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      skip: false,
    })

    // Case 14 assertion: Both deliveries render (nothing filtered in browser)
    expect(screen.getByText('del-001')).toBeInTheDocument()
    expect(screen.getByText('ORD-999')).toBeInTheDocument()
    expect(screen.getByText('del-002')).toBeInTheDocument()
    expect(screen.getByText('ORD-1000')).toBeInTheDocument()
    expect(screen.getByText('Customer A')).toBeInTheDocument()
    expect(screen.getByText('Customer B')).toBeInTheDocument()
  })
})
