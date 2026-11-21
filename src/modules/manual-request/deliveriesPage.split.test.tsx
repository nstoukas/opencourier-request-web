// Spec 0047 (AC-8, AC-10): the order history tells the restaurant which orders were split at pickup, and
// which were left because they didn't fit one box. (Not under src/pages/: Next would treat it as a route.)
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import DeliveriesPage from '../../pages/manual-request/deliveries/index'
import {
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

describe('My Orders after a split at pickup (spec 0047, AC-8, AC-10)', () => {
  const LEFT_SENTENCE = "Cancelled: didn't fit one box, send it again with the right sizes"
  const single = (id: string, overrides: Parameters<typeof legFixture>[2] = {}) =>
    legFixture(id, 1, { legNumber: null, legCount: null, orderReference: `${id}-ref`, ...overrides })

  const showList = (deliveries: ReturnType<typeof legFixture>[]) => {
    ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
      data: { data: deliveries, pagination: { currentPage: 1, totalPages: 1 }, historyDays: 30 },
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    })
    render(<DeliveriesPage />)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(usePartnerAvailabilityQuery as jest.Mock).mockReturnValue({ availability: undefined, refetch: jest.fn() })
    ;(useWaitRecordQuery as jest.Mock).mockReturnValue({ data: undefined, error: undefined, isLoading: false, refetch: jest.fn() })
  })

  it('AC-8: an order the rider left shows the sentence on its own row', () => {
    showList([single('del-left-000001', { status: 'CANCELED', splitOutcome: 'LEFT' })])

    const outcome = screen.getByTestId('split-outcome')
    expect(outcome).toHaveTextContent(LEFT_SENTENCE)
    expect(screen.getAllByTestId('split-outcome')).toHaveLength(1)
  })

  it('only the order that was left gets the sentence, not the cancelled order beside it', () => {
    showList([
      single('del-left-000001', { status: 'CANCELED', splitOutcome: 'LEFT' }),
      single('del-cancelled-02', { status: 'CANCELED', splitOutcome: null }),
      single('del-ordinary-003', { status: 'ACCEPTED' }),
    ])

    expect(screen.getAllByTestId('split-outcome')).toHaveLength(1)
    expect(screen.getAllByText(LEFT_SENTENCE)).toHaveLength(1)
  })

  it('AC-10: an order split in two is one card that says "Split at pickup, now in 2 deliveries"', () => {
    showList([
      legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: 0 }),
      legFixture('del-kept', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }),
    ])

    const cards = screen.getAllByTestId('order-legs-card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 2 deliveries')
  })

  // Row 11 review: a left leg inside a legs order used to show nothing on the history card.
  it('a leg the rider left inside a legs order says so on the order card', () => {
    showList([
      legFixture('del-leg-1', 1, { status: 'DROPPED_OFF' }),
      legFixture('del-leg-2', 2, { status: 'CANCELED', splitOutcome: 'LEFT' }),
    ])

    const card = within(screen.getByTestId('order-legs-card'))
    expect(card.getAllByTestId('split-outcome-left')).toHaveLength(1)
    expect(card.getByTestId('split-outcome-left')).toHaveTextContent(
      "Cancelled: didn't fit one box, send it again with the right sizes"
    )
  })

  it('an order dispatch refused to split, and one never flagged, say nothing', () => {
    showList([single('del-refused-0001', { status: 'PICKED_UP', splitOutcome: null }), single('del-ordinary-002', { status: 'ACCEPTED' })])

    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
  })

  it('an order the restaurant sent as legs itself says nothing about a split', () => {
    showList([legFixture('del-leg-1', 1), legFixture('del-leg-2', 2)])

    expect(screen.getByTestId('order-legs-card')).toBeInTheDocument()
    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
  })
})
