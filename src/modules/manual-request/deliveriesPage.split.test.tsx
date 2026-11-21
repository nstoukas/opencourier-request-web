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
import { SPLIT_CHARGE_NOTE, SPLIT_LEG_COST_NOTE, SPLIT_LEG_ENDED_NOTE } from '../legs/splitOutcome'

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

  // Decision 11.10 (operator, 2026-11-21): the history says what a split costs the restaurant, and why a
  // delivery the split made shows no cost (spec 0047 cross check 5 for one that ended).
  describe('what the split costs the restaurant (decision 11.10)', () => {
    // The sentences are worded once, in splitOutcome.ts (its own test pins them); a page must show that one.
    const CHARGE_NOTE = SPLIT_CHARGE_NOTE
    const COST_0_NOTE = SPLIT_LEG_COST_NOTE
    const ENDED_NOTE = SPLIT_LEG_ENDED_NOTE

    // A split delivery the list shows as a row of its own, not inside an order card: the list only makes a
    // card when a delivery carries its order's reference, so this one has none.
    const splitRow = (id: string, overrides: Parameters<typeof legFixture>[2] = {}) =>
      legFixture(id, 2, { legCount: 2, orderReference: null, splitOutcome: 'SPLIT', ...overrides })

    it('the order card of a split order says the charge note once, under the split line', () => {
      showList([
        legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: 0 }),
        legFixture('del-kept', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }),
      ])

      const card = within(screen.getByTestId('order-legs-card'))
      const note = card.getByTestId('split-charge-note')
      expect(note.textContent).toBe(CHARGE_NOTE)
      expect(card.getByTestId('split-outcome').nextElementSibling).toBe(note)
      expect(screen.getAllByTestId('split-charge-note')).toHaveLength(1)
    })

    it('a single row that kept its own price says the charge note under its split line', () => {
      showList([splitRow('del-row-kept-001', { status: 'PICKED_UP', totalCost: 356 })])

      expect(screen.queryByTestId('order-legs-card')).not.toBeInTheDocument()
      const note = screen.getByTestId('split-charge-note')
      expect(note.textContent).toBe(CHARGE_NOTE)
      expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
    })

    it('a single row the split made (cost 0, still open) says why it shows no cost', () => {
      showList([splitRow('del-row-new-0001', { status: 'ASSIGNING_COURIER', totalCost: 0 })])

      const note = screen.getByTestId('split-charge-note')
      expect(note.textContent).toBe(COST_0_NOTE)
      expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
    })

    it.each(['CANCELED', 'FAILED'])(
      'a single row the split made that ended (%s) states the rule and never claims a charge',
      (status) => {
        showList([splitRow('del-row-ended-01', { status, totalCost: 0 })])

        const note = screen.getByTestId('split-charge-note')
        expect(note.textContent).toBe(ENDED_NOTE)
        expect(screen.queryByText(/is charged to you/)).not.toBeInTheDocument()
      }
    )

    // Before its first offer the backend has written no amounts yet: the cost is null, not 0.
    it('a single row the split made, not offered yet (cost null), says the leg note, not the kept leg\'s', () => {
      showList([splitRow('del-row-null-0001', { status: 'ASSIGNING_COURIER', totalCost: null })])

      const note = screen.getByTestId('split-charge-note')
      expect(note.textContent).toBe(COST_0_NOTE)
      expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
    })

    it.each(['CANCELED', 'FAILED'])(
      'a single row the split made that ended before any offer (cost null, %s) never claims a charge',
      (status) => {
        showList([splitRow('del-row-null-0002', { status, totalCost: null })])

        expect(screen.getByTestId('split-charge-note').textContent).toBe(ENDED_NOTE)
        expect(screen.queryByText(/is charged to you/)).not.toBeInTheDocument()
      }
    )

    it('each row gets its own note, and the ordinary row beside them gets none', () => {
      showList([
        splitRow('del-row-kept-001', { status: 'PICKED_UP', totalCost: 356 }),
        splitRow('del-row-new-0001', { status: 'ASSIGNING_COURIER', totalCost: 0 }),
        single('del-ordinary-003', { status: 'ACCEPTED' }),
      ])

      const notes = screen.getAllByTestId('split-charge-note').map((note) => note.textContent)
      expect(notes).toEqual([CHARGE_NOTE, COST_0_NOTE])
    })

    it('ordinary orders, cancelled or not, and one whose cost is 0 say nothing about a charge', () => {
      showList([
        single('del-ordinary-001', { status: 'ACCEPTED' }),
        single('del-cancelled-02', { status: 'CANCELED', splitOutcome: null }),
        single('del-free-0000003', { status: 'ACCEPTED', totalCost: 0 }),
      ])

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      expect(screen.queryByText(/charged to you/)).not.toBeInTheDocument()
    })

    it('an order the rider left has its sentence and no charge note', () => {
      showList([single('del-left-000001', { status: 'CANCELED', splitOutcome: 'LEFT' })])

      expect(screen.getByTestId('split-outcome')).toBeInTheDocument()
      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      expect(screen.queryByText(/charged to you/)).not.toBeInTheDocument()
    })

    it('an order the restaurant sent as legs itself, and one with a left leg, have no charge note', () => {
      showList([
        legFixture('del-leg-1', 1),
        legFixture('del-leg-2', 2),
        legFixture('del-b-1', 1, { orderReference: 'quote-second', status: 'DROPPED_OFF' }),
        legFixture('del-b-2', 2, { orderReference: 'quote-second', status: 'CANCELED', splitOutcome: 'LEFT' }),
      ])

      expect(screen.getAllByTestId('order-legs-card')).toHaveLength(2)
      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
    })
  })
})
