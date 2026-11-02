import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DeliveriesPage from '../../pages/manual-request/deliveries/index'
import { usePartnerSession } from '../../hooks/usePartnerSession'
import {
  useListManualRequestDeliveriesQuery,
  useUpdateManualRequestDeliveryMutation,
  useCancelManualRequestDeliveryMutation,
} from '../../api/manualRequestApi'

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
jest.mock('../../hooks/usePartnerSession', () => ({
  usePartnerSession: jest.fn(),
}))

jest.mock('../../api/manualRequestApi', () => ({
  fetchPartnerDelivery: jest.fn(),
  useListManualRequestDeliveriesQuery: jest.fn(),
  useUpdateManualRequestDeliveryMutation: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
}))

describe('DeliveriesPage (/manual-request/deliveries/index.tsx)', () => {
  const mockCancel = jest.fn()
  const mockRefetch = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockCancel, { isLoading: false }])
  })

  it('renders "Loading deliveries..." on initial load when data is not yet loaded', () => {
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    expect(screen.getByText('Loading deliveries...')).toBeInTheDocument()
    expect(useListManualRequestDeliveriesQuery).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
    })
  })

  it('renders My Orders description with historyDays ("30 days" and singular "1 day"), and fallback when missing (spec 0017, AC-4)', () => {
    // Case 1: historyDays = 30
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [],
        pagination: { currentPage: 1, totalPages: 1 },
        historyDays: 30,
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    const { rerender } = render(<DeliveriesPage />)
    expect(
      screen.getByText('Your orders from the last 30 days, and any still open.')
    ).toBeInTheDocument()

    // Case 2: historyDays = 1 (singular "1 day")
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [],
        pagination: { currentPage: 1, totalPages: 1 },
        historyDays: 1,
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    rerender(<DeliveriesPage />)
    expect(
      screen.getByText('Your orders from the last 1 day, and any still open.')
    ).toBeInTheDocument()

    // Case 3: historyDays missing / undefined
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    rerender(<DeliveriesPage />)
    expect(
      screen.getByText("Only your restaurant's deliveries appear here.")
    ).toBeInTheDocument()
  })

  it('renders My Orders heading and all deliveries returned from partner API query, with no sign in link branch', () => {
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
        historyDays: 30,
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    expect(screen.getByRole('heading', { name: 'My Orders' })).toBeInTheDocument()
    expect(useListManualRequestDeliveriesQuery).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
    })

    // Case 14 assertion: Both deliveries render (nothing filtered in browser)
    expect(screen.getByText('del-001')).toBeInTheDocument()
    expect(screen.getByText('ORD-999')).toBeInTheDocument()
    expect(screen.getByText('del-002')).toBeInTheDocument()
    expect(screen.getByText('ORD-1000')).toBeInTheDocument()
    expect(screen.getByText('Customer A')).toBeInTheDocument()
    expect(screen.getByText('Customer B')).toBeInTheDocument()

    // Spec 0017 AC-5: No sign-in link branch
    expect(screen.queryByText(/Please sign in/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('a failed poll keeps the list on screen and shows "Could not refresh the list just now..." (spec 0017, AC-4)', () => {
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
        ],
        pagination: { currentPage: 1, totalPages: 1 },
        historyDays: 30,
      },
      isLoading: false,
      error: new Error('Network error on poll'),
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    // List is kept on screen
    expect(screen.getByText('del-001')).toBeInTheDocument()
    expect(screen.getByText('ORD-999')).toBeInTheDocument()

    // Refresh failure notice is shown with role="status"
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Could not refresh the list just now. It tries again in 30 seconds.')
  })

  it('renders statuses through StatusBadge for terminal statuses (DROPPED_OFF and CANCELED)', () => {
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: true,
      isLoading: false,
    })
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'del-completed',
            status: 'DROPPED_OFF',
            orderReference: 'ORD-DONE',
            totalCost: 1200,
            currencyCode: 'EUR',
            createdAt: '2026-07-29T12:00:00Z',
            pickup: { pickupName: 'Nosh', city: 'Volos' },
            dropoff: { dropoffName: 'Customer C', city: 'Volos' },
          },
          {
            id: 'del-canceled',
            status: 'CANCELED',
            orderReference: 'ORD-CANCEL',
            totalCost: 800,
            currencyCode: 'EUR',
            createdAt: '2026-07-29T13:00:00Z',
            pickup: { pickupName: 'Nosh', city: 'Volos' },
            dropoff: { dropoffName: 'Customer D', city: 'Volos' },
          },
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    const { container } = render(<DeliveriesPage />)

    // Verify DROPPED_OFF renders as "Dropped Off" on default variant (bg-primary)
    expect(screen.getByText('Dropped Off')).toBeInTheDocument()
    const droppedOffBadge = container.querySelector('[data-status="DROPPED_OFF"]')
    expect(droppedOffBadge).toBeInTheDocument()
    expect(droppedOffBadge).toHaveClass('bg-primary')
    expect(screen.queryByText('DROPPED_OFF')).not.toBeInTheDocument()

    // Verify CANCELED renders as "Canceled" on destructive variant (bg-destructive)
    expect(screen.getByText('Canceled')).toBeInTheDocument()
    const canceledBadge = container.querySelector('[data-status="CANCELED"]')
    expect(canceledBadge).toBeInTheDocument()
    expect(canceledBadge).toHaveClass('bg-destructive')
    expect(screen.queryByText('CANCELED')).not.toBeInTheDocument()

    // Terminal statuses must not render a Cancel button
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('clicking Cancel does NOT cancel at once but opens dialog, and Keep it closes without cancelling', async () => {
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
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    expect(cancelBtn).toBeInTheDocument()

    // 1. Clicking Cancel does NOT cancel at once (no request until dialog confirm)
    fireEvent.click(cancelBtn)
    expect(mockCancel).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Cancel this delivery?')).toBeInTheDocument()

    // 2. Keep it dismisses dialog without cancelling
    const keepBtn = within(dialog).getByRole('button', { name: 'Keep it' })
    fireEvent.click(keepBtn)

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(mockCancel).not.toHaveBeenCalled()
    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('confirming cancellation in dialog cancels, updates status message and refreshes', async () => {
    mockCancel.mockResolvedValueOnce({ id: 'del-001', status: 'CANCELED' })
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
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    const dialog = screen.getByRole('alertdialog')

    // Confirm with default RESTAURANT selection
    const confirmBtn = within(dialog).getByRole('button', { name: /Cancel delivery/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith({
        deliveryId: 'del-001',
        cancelledBy: 'RESTAURANT',
      })
      expect(mockRefetch).toHaveBeenCalled()
      expect(screen.getByText('Delivery cancelled.')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('allows choosing customer cancellation and confirms with CUSTOMER', async () => {
    mockCancel.mockResolvedValueOnce({ id: 'del-001', status: 'CANCELED' })
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
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    const dialog = screen.getByRole('alertdialog')

    // Select CUSTOMER option
    fireEvent.click(within(dialog).getByLabelText('The customer asked to cancel'))

    const confirmBtn = within(dialog).getByRole('button', { name: /Cancel delivery/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith({
        deliveryId: 'del-001',
        cancelledBy: 'CUSTOMER',
      })
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('does not render Cancel button for FAILED terminal status', () => {
    ;(usePartnerSession as jest.Mock).mockReturnValue({
      isSignedIn: true,
      isLoading: false,
    })
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'del-failed',
            status: 'FAILED',
            orderReference: 'ORD-FAIL',
            totalCost: 500,
            currencyCode: 'EUR',
            createdAt: '2026-07-29T10:00:00Z',
            pickup: { pickupName: 'Nosh', city: 'Volos' },
            dropoff: { dropoffName: 'Customer X', city: 'Volos' },
          },
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveriesPage />)

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })
})
