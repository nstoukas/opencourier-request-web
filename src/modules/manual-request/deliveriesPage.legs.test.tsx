// Spec 0046 (AC-6): the order history groups the legs of one order under one card, each leg with its status.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DeliveriesPage from '../../pages/manual-request/deliveries/index'
import {
  markDeliveryFoodReady,
  useListManualRequestDeliveriesQuery,
  useUpdateManualRequestDeliveryMutation,
  useCancelManualRequestDeliveryMutation,
  usePartnerAvailabilityQuery,
  useWaitRecordQuery,
} from '../../api/manualRequestApi'
import { legFixture } from '../legs/legFixtures'

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

jest.mock('../../hooks/usePartnerSession', () => ({
  usePartnerSession: jest.fn(),
}))

jest.mock('../../api/manualRequestApi', () => ({
  fetchPartnerDelivery: jest.fn(),
  cancelDelivery: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
  useListManualRequestDeliveriesQuery: jest.fn(),
  useUpdateManualRequestDeliveryMutation: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
  usePartnerAvailabilityQuery: jest.fn(),
  useWaitRecordQuery: jest.fn(),
}))

describe('My Orders with a multi leg order (spec 0046, AC-6)', () => {
  const refetch = jest.fn()
  const single = legFixture('del-single-000001', 1, { legNumber: null, legCount: null, orderReference: 'single-ref', status: 'ACCEPTED' })

  const showList = (deliveries: ReturnType<typeof legFixture>[]) => {
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: { data: deliveries, pagination: { currentPage: 1, totalPages: 1 }, historyDays: 30 },
      isLoading: false,
      error: undefined,
      refetch,
    })
    render(<DeliveriesPage />)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(usePartnerAvailabilityQuery as jest.Mock).mockReturnValue({ availability: undefined, refetch: jest.fn() })
    ;(useWaitRecordQuery as jest.Mock).mockReturnValue({ data: undefined, error: undefined, isLoading: false, refetch: jest.fn() })
    ;(markDeliveryFoodReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ASSIGNING_COURIER',
      readyAt: '2026-11-21T10:20:00.000Z',
      foodReadyAt: '2026-11-21T10:18:00.000Z',
    }))
  })

  it('two legs of one order show as one card holding both legs with their statuses', () => {
    showList([legFixture('del-leg-2', 2), single, legFixture('del-leg-1', 1, { status: 'ACCEPTED' })])

    const cards = screen.getAllByTestId('order-legs-card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByText('Order in 2 deliveries')).toBeInTheDocument()
    const rows = within(cards[0]).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Leg 1 of 2'),
      expect.stringContaining('Leg 2 of 2'),
    ])
    expect(rows[0].querySelector('[data-status="ACCEPTED"]')).not.toBeNull()
    expect(rows[1].querySelector('[data-status="ASSIGNING_COURIER"]')).not.toBeNull()
  })

  it('a single delivery keeps its own card, outside the order\'s card', () => {
    showList([legFixture('del-leg-1', 1), legFixture('del-leg-2', 2), single])

    const idLine = screen.getByText('del-single-000001')
    expect(idLine).toBeInTheDocument()
    expect(screen.getByTestId('order-legs-card')).not.toContainElement(idLine)
    // The legs are not also listed as cards of their own.
    expect(screen.queryByText('del-leg-1')).not.toBeInTheDocument()
    expect(screen.queryByText('del-leg-2')).not.toBeInTheDocument()
  })

  it('cross check 4: an order with fewer legs than its count says which leg was never sent', () => {
    showList([legFixture('del-leg-1', 1)])

    expect(within(screen.getByTestId('order-legs-card')).getByText(/Leg 2 of 2 was never sent/)).toBeInTheDocument()
  })

  it('cross check 9: Food ready on the order\'s card marks every leg and refreshes the list', async () => {
    showList([legFixture('del-leg-1', 1), legFixture('del-leg-2', 2)])

    fireEvent.click(within(screen.getByTestId('order-legs-card')).getByRole('button', { name: 'Food ready' }))

    await waitFor(() => expect(refetch).toHaveBeenCalled())
    expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-leg-1', 'del-leg-2'])
  })

  it('a list with no legs shows no order card', () => {
    showList([single])

    expect(screen.queryByTestId('order-legs-card')).not.toBeInTheDocument()
  })
})
