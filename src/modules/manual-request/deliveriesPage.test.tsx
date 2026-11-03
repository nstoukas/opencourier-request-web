import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DeliveriesPage from '../../pages/manual-request/deliveries/index'
import { usePartnerSession } from '../../hooks/usePartnerSession'
import {
  fetchPartnerDelivery,
  delayDeliveryReady,
  markDeliveryFoodReady,
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
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
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

  describe('spec 0023 (AC-8): ready time on My Orders, and the edit dialog', () => {
    const card = (fields: Record<string, unknown>) => ({
      id: 'del-ready-1',
      status: 'ACCEPTED',
      orderReference: 'ORD-R1',
      totalCost: 500,
      currencyCode: 'EUR',
      createdAt: '2026-11-03T12:00:00Z',
      pickupReadyAt: '2026-11-03T12:15:00Z',
      readyAt: '2026-11-03T12:32:00Z',
      foodReadyAt: null,
      pickup: { pickupName: 'Nosh', city: 'Volos' },
      dropoff: { dropoffName: 'Customer R', city: 'Volos' },
      ...fields,
    })

    function listOf(...deliveries: Record<string, unknown>[]) {
      ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
        data: { data: deliveries, pagination: { currentPage: 1, totalPages: 1 } },
        isLoading: false,
        error: undefined,
        refetch: mockRefetch,
      })
    }

    function cardOf(orderReference: string): HTMLElement {
      // The card is the nearest ancestor holding both the reference and the ready controls.
      let node: HTMLElement | null = screen.getByText(orderReference)
      while (node && !node.querySelector('[data-testid="ready-controls"]')) node = node.parentElement
      if (!node) throw new Error(`no card with ready controls for ${orderReference}`)
      return node
    }

    it('each card shows its own ready line: buttons before pickup, "Food ready at" once marked, none after pickup', () => {
      listOf(
        card({ id: 'del-a', orderReference: 'ORD-A' }),
        card({ id: 'del-b', orderReference: 'ORD-B', foodReadyAt: '2026-11-03T12:30:00Z' }),
        card({ id: 'del-c', orderReference: 'ORD-C', status: 'ON_THE_WAY' }),
      )

      render(<DeliveriesPage />)

      const a = cardOf('ORD-A')
      expect(within(a).getByText('Ready at 14:32')).toBeInTheDocument()
      for (const name of ['+5', '+10', '+15', 'Food ready']) {
        expect(within(a).getByRole('button', { name })).toBeEnabled()
      }

      const b = cardOf('ORD-B')
      expect(within(b).getByText('Food ready at 14:30')).toBeInTheDocument()
      expect(within(b).queryByRole('button', { name: '+10' })).not.toBeInTheDocument()
      expect(within(b).queryByRole('button', { name: 'Food ready' })).not.toBeInTheDocument()

      const c = cardOf('ORD-C')
      expect(within(c).queryByRole('button', { name: '+10' })).not.toBeInTheDocument()
      expect(within(c).queryByRole('button', { name: 'Food ready' })).not.toBeInTheDocument()
    })

    it('+10 on a card sends that order\'s id and readyAt, shows the answer at once, then asks for the list again', async () => {
      listOf(card({ id: 'del-a', orderReference: 'ORD-A' }), card({ id: 'del-b', orderReference: 'ORD-B' }))
      ;(delayDeliveryReady as jest.Mock).mockResolvedValue({
        id: 'del-b',
        status: 'ACCEPTED',
        readyAt: '2026-11-03T12:42:00Z',
        foodReadyAt: null,
      })

      render(<DeliveriesPage />)

      fireEvent.click(within(cardOf('ORD-B')).getByRole('button', { name: '+10' }))

      expect(delayDeliveryReady).toHaveBeenCalledWith('del-b', 10, '2026-11-03T12:32:00Z')
      expect(await within(cardOf('ORD-B')).findByText('Ready at 14:42')).toBeInTheDocument()
      // The other card is untouched.
      expect(within(cardOf('ORD-A')).getByText('Ready at 14:32')).toBeInTheDocument()
      await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1))
    })

    it('Food ready on a card calls markDeliveryFoodReady with that order\'s id', async () => {
      listOf(card({ id: 'del-a', orderReference: 'ORD-A' }))
      ;(markDeliveryFoodReady as jest.Mock).mockResolvedValue({
        id: 'del-a',
        status: 'ACCEPTED',
        readyAt: '2026-11-03T12:32:00Z',
        foodReadyAt: '2026-11-03T12:30:00Z',
      })

      render(<DeliveriesPage />)

      fireEvent.click(within(cardOf('ORD-A')).getByRole('button', { name: 'Food ready' }))

      expect(markDeliveryFoodReady).toHaveBeenCalledWith('del-a')
      expect(await within(cardOf('ORD-A')).findByText('Food ready at 14:30')).toBeInTheDocument()
    })

    async function openEditDialog(stored: Record<string, unknown>) {
      listOf(card({ id: 'del-edit', orderReference: 'ORD-EDIT' }))
      ;(fetchPartnerDelivery as jest.Mock).mockResolvedValue(
        card({
          id: 'del-edit',
          orderReference: 'ORD-EDIT',
          pickupDeadlineAt: '2026-11-03T13:00:00Z',
          dropoffReadyAt: null,
          dropoffDeadlineAt: '2026-11-03T14:00:00Z',
          pickup: { pickupName: 'Nosh', city: 'Volos', pickupNotes: '' },
          dropoff: { dropoffName: 'Customer R', city: 'Volos', dropoffNotes: '', latitude: 39.36, longitude: 22.94 },
          ...stored,
        }),
      )
      render(<DeliveriesPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      return screen.findByRole('dialog')
    }

    it('the edit dialog offers no pickup "Ready At" field (the dropoff one stays)', async () => {
      const dialog = await openEditDialog({})

      expect(dialog.querySelector('#edit-pickup-ready')).toBeNull()
      // The only "Ready At" left is the dropoff one.
      const readyAtLabels = within(dialog).getAllByText(/Ready At/)
      expect(readyAtLabels).toHaveLength(1)
      expect(readyAtLabels[0].closest('label')).toHaveAttribute('for', 'edit-dropoff-ready')
      expect(within(dialog).getByLabelText(/Deadline/, { selector: '#edit-pickup-deadline' })).toBeInTheDocument()
    })

    it('Save still sends the stored pickupReadyAt, as the same moment (in the co-op\'s own time zone)', async () => {
      // The restaurants' browsers run on Athens time; pin it so the result does not depend on the
      // machine running the test. Node reads process.env.TZ again whenever it is assigned.
      const originalTz = process.env.TZ
      process.env.TZ = 'Europe/Athens'
      try {
        const mockUpdate = jest.fn().mockResolvedValue({})
        ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockUpdate, { isLoading: false }])

        // As the form stores it: Get price time plus the chosen minutes, seconds included.
        const stored = '2026-11-03T12:15:42.123Z'
        const dialog = await openEditDialog({ pickupReadyAt: stored })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
        const sent = mockUpdate.mock.calls[0][0]
        expect(sent.deliveryId).toBe('del-edit')
        // Decision 21.9: the field is gone from the dialog, but the update route wants it, so the stored
        // value goes back unchanged. Compared as instants, so the text's format does not matter.
        expect(sent.pickupReadyAt).not.toBeNull()
        expect(new Date(sent.pickupReadyAt).toISOString()).toBe(stored)
      } finally {
        if (originalTz === undefined) delete process.env.TZ
        else process.env.TZ = originalTz
      }
    })

    it('Save sends pickupReadyAt null when none was stored', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({})
      ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockUpdate, { isLoading: false }])

      const dialog = await openEditDialog({ pickupReadyAt: null })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
      expect(mockUpdate.mock.calls[0][0].pickupReadyAt).toBeNull()
    })
  })
})
