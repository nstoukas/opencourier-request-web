// Spec 0032 (AC-9): "Report a product" on the order status page.
// The card is offered only once an order is delivered (DROPPED_OFF); earlier statuses
// (e.g. IN_TRANSIT, ACCEPTED) or terminal non-delivered statuses (CANCELED, FAILED) do not show it.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
  reportDeliveryProduct,
} from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({ query: { deliveryId: 'del-status-32' } }),
}))

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock API and auth mode
jest.mock('../../api/manualRequestApi', () => ({
  useGetManualRequestDeliveryQuery: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
  reportDeliveryProduct: jest.fn(),
}))

jest.mock('../../utils/manualRequestAuth', () => ({
  getManualRequestApiMode: jest.fn(),
}))

const mockUseGetDelivery = useGetManualRequestDeliveryQuery as jest.Mock
const mockUseCancelMutation = useCancelManualRequestDeliveryMutation as jest.Mock
const mockReportDeliveryProduct = reportDeliveryProduct as jest.Mock

function setupDelivery(status: string, orderItems: Array<{ name: string; quantity?: number }> = []) {
  mockUseGetDelivery.mockReturnValue({
    data: {
      id: 'del-status-32',
      status,
      orderReference: 'ORD-STATUS-32',
      createdAt: '2026-11-09T10:00:00Z',
      pickupAddress: { formattedAddress: 'Store A, Volos' },
      dropoffAddress: { formattedAddress: 'Customer B, Volos' },
      orderItems,
    },
    isLoading: false,
    error: undefined,
    refetch: jest.fn(),
  })
}

describe('DeliveryStatusPage product reporting (spec 0032, AC-9)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('partner')
    mockUseCancelMutation.mockReturnValue([jest.fn(), { isLoading: false }])
  })

  it('shows "Report a product" when the order status is DROPPED_OFF', () => {
    setupDelivery('DROPPED_OFF', [{ name: 'Burger', quantity: 1 }])

    render(<DeliveryStatusPage />)

    expect(screen.getByRole('button', { name: 'Report a product' })).toBeInTheDocument()
  })

  it.each([
    'CREATED',
    'ASSIGNING_COURIER',
    'ACCEPTED',
    'DISPATCHED',
    'COURIER_ARRIVED_AT_PICKUP_LOCATION',
    'PICKED_UP',
    'COURIER_ARRIVED_AT_DROPOFF_LOCATION',
    'CANCELED',
    'FAILED',
  ])('does not show "Report a product" when order status is %s', (status) => {
    setupDelivery(status, [{ name: 'Burger', quantity: 1 }])

    render(<DeliveryStatusPage />)

    expect(screen.queryByRole('button', { name: 'Report a product' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('report-product')).not.toBeInTheDocument()
  })

  it('allows reporting a product directly from the delivered order status page', async () => {
    mockReportDeliveryProduct.mockResolvedValue({ id: 'rep-delivered-1' })
    setupDelivery('DROPPED_OFF', [
      { name: 'Veggie Pizza', quantity: 1 },
      { name: 'Garlic Bread', quantity: 1 },
    ])

    render(<DeliveryStatusPage />)

    // Open card
    fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))
    expect(screen.getByTestId('report-product')).toBeInTheDocument()

    // Select Missing item and Garlic Bread
    fireEvent.click(screen.getByRole('button', { name: 'Missing item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Garlic Bread' }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Did not arrive with pizza' } })

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    await waitFor(() => {
      expect(mockReportDeliveryProduct).toHaveBeenCalledWith('del-status-32', {
        kind: 'MISSING_ITEM',
        itemName: 'Garlic Bread',
        note: 'Did not arrive with pizza',
      })
    })

    expect(screen.getByText('Thank you. The co-op has your report.')).toBeInTheDocument()
  })
})
