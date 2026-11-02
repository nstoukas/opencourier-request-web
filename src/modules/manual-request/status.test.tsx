import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
} from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'

// Mock next/router
const mockRouter = {
  query: { deliveryId: 'del-xyz-789' } as Record<string, any>,
}
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
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
}))

jest.mock('../../utils/manualRequestAuth', () => ({
  getManualRequestApiMode: jest.fn(),
}))

describe('DeliveryStatusPage (/manual-request/[deliveryId]/status.tsx)', () => {
  const mockCancel = jest.fn()
  const mockRefetch = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    mockRouter.query = { deliveryId: 'del-xyz-789' }
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

  it('AC-14: renders "New order" button that links to /manual-request to open an empty form', () => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'ACCEPTED',
        createdAt: '2026-09-30T10:00:00Z',
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveryStatusPage />)

    const newOrderLink = screen.getByRole('link', { name: 'New order' })
    expect(newOrderLink).toBeInTheDocument()
    expect(newOrderLink).toHaveAttribute('href', '/manual-request')
    // button styling asChild size="xl"
    expect(newOrderLink).toHaveClass('h-12')
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
    expect(screen.getByRole('button', { name: /Cancel delivery/i })).toBeDisabled()
  })

  it('renders StatusBadge and disables cancel button for FAILED status', () => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
      data: {
        id: 'del-xyz-789',
        status: 'FAILED',
        createdAt: '2026-09-30T10:00:00Z',
      },
      isLoading: false,
      error: undefined,
      refetch: mockRefetch,
    })

    render(<DeliveryStatusPage />)

    expect(screen.getByText('This delivery can no longer be cancelled.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel delivery/i })).toBeDisabled()
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

  it('calls cancel mutation when cancel button is clicked and confirmed in dialog', async () => {
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

    // 1. Clicking Cancel does NOT cancel at once: opens dialog instead
    fireEvent.click(cancelBtn)
    expect(mockCancel).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Cancel this delivery?')).toBeInTheDocument()

    // 2. Confirming inside dialog calls cancel mutation and refreshes
    const confirmBtn = within(dialog).getByRole('button', { name: /Cancel delivery/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith({
        deliveryId: 'del-xyz-789',
        cancelledBy: 'RESTAURANT',
      })
      expect(mockRefetch).toHaveBeenCalled()
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('clicking Cancel then Keep it closes the dialog without cancelling or refreshing', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Cancel delivery/i }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(mockCancel).not.toHaveBeenCalled()
    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('allows selecting customer cancellation and confirms with CUSTOMER', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Cancel delivery/i }))
    const dialog = screen.getByRole('alertdialog')

    // Select CUSTOMER option
    fireEvent.click(within(dialog).getByLabelText('The customer asked to cancel'))

    const confirmBtn = within(dialog).getByRole('button', { name: /Cancel delivery/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith({
        deliveryId: 'del-xyz-789',
        cancelledBy: 'CUSTOMER',
      })
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('CustomerSaveNotice integration via router.query.customerSave', () => {
    const defaultDeliveryData = {
      id: 'del-xyz-789',
      status: 'ACCEPTED',
      createdAt: '2026-09-30T10:00:00Z',
    }

    it('reads ?customerSave=clash from router and displays phone clash notice', () => {
      mockRouter.query = { deliveryId: 'del-xyz-789', customerSave: 'clash' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: defaultDeliveryData,
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      expect(
        screen.getByText('Order sent. The customer was not saved: another saved customer has this phone.'),
      ).toBeInTheDocument()
    })

    it('reads ?customerSave=invalid from router and displays details refused notice', () => {
      mockRouter.query = { deliveryId: 'del-xyz-789', customerSave: 'invalid' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: defaultDeliveryData,
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      expect(
        screen.getByText('Order sent. The customer was not saved: the details were refused.'),
      ).toBeInTheDocument()
    })

    it('reads ?customerSave=failed from router and displays server did not answer notice', () => {
      mockRouter.query = { deliveryId: 'del-xyz-789', customerSave: 'failed' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: defaultDeliveryData,
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      expect(
        screen.getByText("Order sent. The customer was not saved: the co-op's server did not answer."),
      ).toBeInTheDocument()
    })

    it('renders no notice when customerSave is absent or unrecognized', () => {
      mockRouter.query = { deliveryId: 'del-xyz-789', customerSave: 'random-junk' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: defaultDeliveryData,
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      expect(screen.queryByText(/The customer was not saved/i)).not.toBeInTheDocument()
    })
  })

  describe('spec 0016: Floor and Doorbell rows', () => {
    it('renders Floor and Doorbell values when present, and dash when absent', () => {
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: {
          id: 'del-xyz-789',
          status: 'ACCEPTED',
          createdAt: '2026-09-30T10:00:00Z',
          pickup: { pickupName: 'Nosh', addressLine1: 'Ermou 10', city: 'Volos' },
          dropoff: {
            dropoffName: 'Elena K.',
            dropoffPhoneNumber: '+306912345678',
            dropoffFloor: '3',
            dropoffDoorbell: 'Papadopoulou',
            dropoffNotes: 'Floor: 3 · Doorbell: Papadopoulou',
            dropoffSellerNotes: 'Ring twice',
            addressLine1: 'Dimitriadis 25',
            city: 'Volos',
          },
        },
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      const { rerender } = render(<DeliveryStatusPage />)

      expect(screen.getByText('Floor')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Doorbell')).toBeInTheDocument()
      expect(screen.getByText('Papadopoulou')).toBeInTheDocument()

      // When absent (null / undefined): renders '—'
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: {
          id: 'del-xyz-789',
          status: 'ACCEPTED',
          createdAt: '2026-09-30T10:00:00Z',
          pickup: { pickupName: 'Nosh', addressLine1: 'Ermou 10', city: 'Volos' },
          dropoff: {
            dropoffName: 'Elena K.',
            dropoffPhoneNumber: '+306912345678',
            dropoffFloor: null,
            dropoffDoorbell: null,
            addressLine1: 'Dimitriadis 25',
            city: 'Volos',
          },
        },
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      rerender(<DeliveryStatusPage />)
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('error messages and polling refresh failure (spec 0017, AC-4, review fix 9)', () => {
    it('shows the server message for a 4xx error (e.g. order older than period)', () => {
      const serverErr = {
        statusCode: 404,
        message: 'This order is older than 1 day. The co-op can look it up for you.',
      }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: serverErr,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      expect(
        screen.getByText('This order is older than 1 day. The co-op can look it up for you.')
      ).toBeInTheDocument()
    })

    it('shows general line for 500, generic Request failed HTTP 4xx, network errors, and timeouts', () => {
      const generalLine = 'The order could not be loaded. Try again in a moment.'

      // 500 status code
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { statusCode: 500, message: 'Request failed (HTTP 500)' },
        refetch: mockRefetch,
      })

      const { rerender } = render(<DeliveryStatusPage />)
      expect(screen.getByText(generalLine)).toBeInTheDocument()

      // 500 status code with server internal error text
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { statusCode: 500, message: 'Internal server error' },
        refetch: mockRefetch,
      })
      rerender(<DeliveryStatusPage />)
      expect(screen.getByText(generalLine)).toBeInTheDocument()

      // 404 status code with generic "Request failed (HTTP 404)" text
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { statusCode: 404, message: 'Request failed (HTTP 404)' },
        refetch: mockRefetch,
      })
      rerender(<DeliveryStatusPage />)
      expect(screen.getByText(generalLine)).toBeInTheDocument()

      // Network error without statusCode
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch'),
        refetch: mockRefetch,
      })
      rerender(<DeliveryStatusPage />)
      expect(screen.getByText(generalLine)).toBeInTheDocument()

      // Timeout error without statusCode
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Request timed out after 12s. Check backend availability and token.'),
        refetch: mockRefetch,
      })
      rerender(<DeliveryStatusPage />)
      expect(screen.getByText(generalLine)).toBeInTheDocument()
    })

    it('a failed refresh keeps order data on screen and shows "Could not refresh just now..."', () => {
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: {
          id: 'del-xyz-789',
          status: 'ACCEPTED',
          createdAt: '2026-09-30T10:00:00Z',
          pickup: { pickupName: 'Taverna Volos', addressLine1: 'Iasonos 10', city: 'Volos' },
          dropoff: { dropoffName: 'Elena K.', addressLine1: 'Dimitriadis 25', city: 'Volos' },
        },
        isLoading: false,
        error: new Error('Failed to fetch'),
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      // Order details remain on screen
      expect(screen.getByText('Accepted')).toBeInTheDocument()
      expect(screen.getByText('Taverna Volos')).toBeInTheDocument()
      expect(screen.getAllByText('Elena K.').length).toBeGreaterThanOrEqual(1)

      // Status role refresh notice is shown
      const notice = screen.getByRole('status')
      expect(notice).toHaveTextContent('Could not refresh just now. It tries again in 30 seconds.')
    })
  })

  describe('spec 0021 (AC-10): order code on status page', () => {
    it('renders the order code big (# plus last 6 chars) above the status card title with the full delivery id', () => {
      mockRouter.query = { deliveryId: 'cly123456789' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: {
          id: 'cly123456789',
          status: 'ACCEPTED',
          createdAt: '2026-09-30T10:00:00Z',
        },
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      // The order code is shown as '#' plus the last 6 characters with data-testid="order-code"
      const codeElement = screen.getByTestId('order-code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement).toHaveTextContent('#456789')
      expect(codeElement).toHaveClass('block', 'font-mono', 'text-4xl', 'font-bold')
      expect(screen.getByText(/Order code/)).toBeInTheDocument()

      // The status card's title still keeps the full delivery id
      const titleElement = screen.getByText('cly123456789')
      expect(titleElement).toBeInTheDocument()

      // Order code sits on its own line above the status card's title in the DOM
      expect(codeElement.compareDocumentPosition(titleElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('renders the order code for a standard delivery id prefix/suffix', () => {
      mockRouter.query = { deliveryId: 'del-xyz-789' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: {
          id: 'del-xyz-789',
          status: 'ACCEPTED',
          createdAt: '2026-09-30T10:00:00Z',
        },
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      const codeElement = screen.getByTestId('order-code')
      expect(codeElement).toHaveTextContent('#yz-789')
      expect(screen.getByText('del-xyz-789')).toBeInTheDocument()
    })

    it('shows nothing for order code when there is no delivery id in router query', () => {
      // Missing or empty deliveryId in router query
      mockRouter.query = { deliveryId: '' }
      ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })

      render(<DeliveryStatusPage />)

      // Neither the order code badge nor the "Order code" label should be rendered
      expect(screen.queryByTestId('order-code')).not.toBeInTheDocument()
      expect(screen.queryByText(/Order code/)).not.toBeInTheDocument()

      // CardTitle falls back to em dash when there is no id
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})
