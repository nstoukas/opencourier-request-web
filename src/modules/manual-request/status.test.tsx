import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
} from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { deliveryId: 'del-xyz-789' },
  }),
}))

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

// Mock API and auth mode
jest.mock('../../api/manualRequestApi', () => ({
  useGetManualRequestDeliveryQuery: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
}))

jest.mock('../../utils/manualRequestAuth', () => ({
  getManualRequestApiMode: jest.fn(),
}))

describe('DeliveryStatusPage (/manual-request/[deliveryId]/status.tsx)', () => {
  const mockCancel = jest.fn()
  const mockRefetch = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockCancel, { isLoading: false }])
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('partner')
  })

  it('renders status through StatusBadge and schedule facts through DetailList in partner mode', () => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'ACCEPTED',
        orderReference: 'ORD-555',
        createdAt: '2026-09-30T10:00:00Z',
        pickupReadyAt: '2026-09-30T10:15:00Z',
        pickupDeadlineAt: '2026-09-30T10:30:00Z',
        dropoffReadyAt: null,
        dropoffEta: '2026-09-30T10:45:00Z',
        dropoffDeadlineAt: '2026-09-30T11:00:00Z',
        courier: {
          id: 'courier-42',
          firstName: 'Dimitris',
          lastName: 'P.',
          phoneNumber: '+30 6900000000',
        },
        pickup: {
          pickupName: 'Taverna Volos',
          addressLine1: 'Iasonos 10',
          city: 'Volos',
        },
        dropoff: {
          dropoffName: 'Elena K.',
          addressLine1: 'Dimitriadis 25',
          city: 'Volos',
        },
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    const { container } = render(<DeliveryStatusPage />)

    // Clause 2 assertion: StatusBadge renders "Accepted" with data-status="ACCEPTED" and secondary variant
    expect(screen.getByText('Accepted')).toBeInTheDocument()
    const badge = container.querySelector('[data-status="ACCEPTED"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-secondary')
    // Raw enum text ACCEPTED should not appear bare
    expect(screen.queryByText('ACCEPTED')).not.toBeInTheDocument()

    // Schedule rendered through DetailList
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Pickup ready')).toBeInTheDocument()
    expect(screen.getByText('Dropoff ready')).toBeInTheDocument()

    // Courier details rendered through DetailList with mono for courier ID
    expect(screen.getByText('Courier')).toBeInTheDocument()
    expect(screen.getByText('Dimitris P.')).toBeInTheDocument()
    const courierIdElem = screen.getByText('courier-42')
    expect(courierIdElem).toHaveClass('font-mono')

    // Cancel delivery button is enabled for non-terminal status
    const cancelBtn = screen.getByRole('button', { name: /Cancel delivery/i })
    expect(cancelBtn).toBeEnabled()
  })

  it('renders StatusBadge and disables cancel button for terminal status (DROPPED_OFF)', () => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'DROPPED_OFF',
        createdAt: '2026-09-30T10:00:00Z',
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    const { container } = render(<DeliveryStatusPage />)

    // StatusBadge renders "Dropped Off" with bg-primary (default variant)
    expect(screen.getByText('Dropped Off')).toBeInTheDocument()
    const badge = container.querySelector('[data-status="DROPPED_OFF"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-primary')

    // Terminal status message and disabled button
    expect(screen.getByText('This delivery can no longer be cancelled.')).toBeInTheDocument()
    const cancelBtn = screen.getByRole('button', { name: /Cancel delivery/i })
    expect(cancelBtn).toBeDisabled()
  })

  it('renders StatusBadge with destructive variant for CANCELED status', () => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'CANCELED',
        createdAt: '2026-09-30T10:00:00Z',
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    const { container } = render(<DeliveryStatusPage />)

    expect(screen.getByText('Canceled')).toBeInTheDocument()
    const badge = container.querySelector('[data-status="CANCELED"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-destructive')
    expect(screen.getByText('This delivery can no longer be cancelled.')).toBeInTheDocument()
  })

  it('renders StatusBadge in admin mode when mode is admin', () => {
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('admin')
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'DISPATCHED',
        pickupName: 'Taverna',
        dropoffName: 'Customer',
        deliverableAction: 'HAND_TO_CUSTOMER',
        createdAt: '2026-09-30T10:00:00Z',
        updatedAt: '2026-09-30T10:05:00Z',
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    const { container } = render(<DeliveryStatusPage />)

    expect(screen.getByText('Dispatched')).toBeInTheDocument()
    const badge = container.querySelector('[data-status="DISPATCHED"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-secondary')
  })

  it('calls cancel mutation when cancel button is clicked', async () => {
    mockCancel.mockResolvedValue({})
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'ASSIGNING_COURIER',
        createdAt: '2026-09-30T10:00:00Z',
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveryStatusPage />)

    const cancelBtn = screen.getByRole('button', { name: /Cancel delivery/i })
    expect(cancelBtn).toBeEnabled()

    fireEvent.click(cancelBtn)
    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith('del-xyz-789')
      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
