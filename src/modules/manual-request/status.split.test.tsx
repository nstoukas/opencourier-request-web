// Spec 0047 (AC-8, AC-10): the order page tells the restaurant its order was split at pickup, or was left
// because it didn't fit one box. (This file is not under src/pages/: Next would treat it as a route.)
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import { fetchOrderLegs, useCancelManualRequestDeliveryMutation, useGetManualRequestDeliveryQuery } from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'
import { legFixture } from '../legs/legFixtures'
import { SPLIT_CHARGE_NOTE, SPLIT_LEG_COST_NOTE, SPLIT_LEG_ENDED_NOTE } from '../legs/splitOutcome'

const mockRouter = { query: { deliveryId: 'del-1' } as Record<string, any> }
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

jest.mock('../../api/manualRequestApi', () => ({
  useGetManualRequestDeliveryQuery: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
  fetchOrderLegs: jest.fn(),
  cancelDelivery: jest.fn(),
  createDelivery: jest.fn(),
  requestQuote: jest.fn(),
}))

jest.mock('../../utils/manualRequestAuth', () => ({
  getManualRequestApiMode: jest.fn(),
}))

jest.mock('../complaints/RiderComplaintSection', () => ({
  RiderComplaintSection: () => null,
}))

describe('the order page after a split at pickup (spec 0047, AC-8, AC-10)', () => {
  // Draws the page for one delivery, as the partner API answered it.
  const showPage = (data: ReturnType<typeof legFixture>) => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({ data, isLoading: false, error: undefined, refetch: jest.fn() })
    render(<DeliveryStatusPage />)
  }
  const single = (overrides: Parameters<typeof legFixture>[2] = {}) =>
    legFixture('del-1', 1, { legNumber: null, legCount: null, ...overrides })

  beforeEach(() => {
    jest.resetAllMocks()
    mockRouter.query = { deliveryId: 'del-1' }
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('partner')
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({ legs: [], missingLegNumbers: [] })
  })

  it('AC-10: the kept leg says "Split at pickup, now in 2 deliveries" under "Leg 1 of 2"', async () => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [legFixture('del-1', 1, { splitOutcome: 'SPLIT' }), legFixture('del-2', 2, { splitOutcome: 'SPLIT' })],
      missingLegNumbers: [],
    })
    showPage(legFixture('del-1', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }))

    expect(screen.getByTestId('leg-label')).toHaveTextContent('Leg 1 of 2')
    expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 2 deliveries')
    await screen.findByTestId('order-legs')
  })

  it('AC-10: the leg the split made says it too, with the count the server sent', async () => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [
        legFixture('del-a', 1, { legCount: 3, splitOutcome: 'SPLIT' }),
        legFixture('del-1', 2, { legCount: 3, splitOutcome: 'SPLIT' }),
        legFixture('del-c', 3, { legCount: 3, splitOutcome: 'SPLIT' }),
      ],
      missingLegNumbers: [],
    })
    showPage(legFixture('del-1', 2, { legCount: 3, splitOutcome: 'SPLIT', totalCost: 0 }))

    expect(screen.getByTestId('leg-label')).toHaveTextContent('Leg 2 of 3')
    expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 3 deliveries')
    await screen.findByTestId('order-legs')
  })

  it('AC-8: an order the rider left says "Cancelled: didn\'t fit one box, send it again with the right sizes"', () => {
    showPage(single({ status: 'CANCELED', splitOutcome: 'LEFT' }))

    expect(screen.getByTestId('split-outcome')).toHaveTextContent(
      "Cancelled: didn't fit one box, send it again with the right sizes"
    )
  })

  it('an order dispatch refused to split ("It fits") says nothing about a split', () => {
    showPage(single({ status: 'PICKED_UP', splitOutcome: null }))

    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
  })

  it('an ordinary cancelled order does not get the "didn\'t fit" sentence', () => {
    showPage(single({ status: 'CANCELED', splitOutcome: null }))

    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
    expect(screen.queryByText(/didn't fit one box/)).not.toBeInTheDocument()
  })

  it('an order the restaurant sent as legs itself has its leg label and no split sentence', async () => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [legFixture('del-1', 1), legFixture('del-2', 2)],
      missingLegNumbers: [],
    })
    showPage(legFixture('del-1', 1))

    expect(screen.getByTestId('leg-label')).toHaveTextContent('Leg 1 of 2')
    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
    await screen.findByTestId('order-legs')
  })

  // Decision 11.10 (operator, 2026-11-21): the order page says what a split costs the restaurant, and why
  // a delivery the split made shows no cost (null before its first offer, 0 after). Spec 0047 cross check 5: the charge is taken back when that
  // delivery ends with no rider ever accepting it, so an ended one states the rule and claims no charge.
  describe('what the split costs the restaurant (decision 11.10)', () => {
    // The sentences are worded once, in splitOutcome.ts (its own test pins them); a page must show that one.
    const CHARGE_NOTE = SPLIT_CHARGE_NOTE
    const COST_0_NOTE = SPLIT_LEG_COST_NOTE
    const ENDED_NOTE = SPLIT_LEG_ENDED_NOTE

    // The page asks for the order's other legs; these tests only read the lines above them.
    const twoLegs = () =>
      (fetchOrderLegs as jest.Mock).mockResolvedValue({
        legs: [legFixture('del-1', 1, { splitOutcome: 'SPLIT' }), legFixture('del-2', 2, { splitOutcome: 'SPLIT' })],
        missingLegNumbers: [],
      })

    it('the kept leg (its own price) says the charge note, right under the split line', async () => {
      twoLegs()
      showPage(legFixture('del-1', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT', totalCost: 356 }))

      const note = screen.getByTestId('split-charge-note')
      expect(note.textContent).toBe(CHARGE_NOTE)
      expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
      expect(screen.getAllByTestId('split-charge-note')).toHaveLength(1)
      await screen.findByTestId('order-legs')
    })

    it('the leg the split made (cost 0, still open) says why it shows no cost and that its rider is paid by the restaurant', async () => {
      twoLegs()
      showPage(legFixture('del-1', 2, { status: 'ASSIGNING_COURIER', splitOutcome: 'SPLIT', totalCost: 0 }))

      const note = screen.getByTestId('split-charge-note')
      expect(note.textContent).toBe(COST_0_NOTE)
      expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
      await screen.findByTestId('order-legs')
    })

    it('a delivered leg the split made still says the cost 0 note', async () => {
      twoLegs()
      showPage(legFixture('del-1', 2, { status: 'DROPPED_OFF', splitOutcome: 'SPLIT', totalCost: 0 }))

      expect(screen.getByTestId('split-charge-note').textContent).toBe(COST_0_NOTE)
      await screen.findByTestId('order-legs')
    })

    it.each(['CANCELED', 'FAILED'])(
      'a leg the split made that ended (%s) states the rule and never claims a charge',
      async (status) => {
        twoLegs()
        showPage(legFixture('del-1', 2, { status, splitOutcome: 'SPLIT', totalCost: 0 }))

        const note = screen.getByTestId('split-charge-note')
        expect(note.textContent).toBe(ENDED_NOTE)
        expect(note).not.toHaveTextContent(/is charged to you/)
        expect(screen.queryByText(/is charged to you/)).not.toBeInTheDocument()
        expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
        await screen.findByTestId('order-legs')
      }
    )

    // Before its first offer the backend has written no amounts yet: the cost is null, not 0.
    it('the leg the split made, not offered yet (cost null), says the same leg note, not the kept leg\'s', async () => {
      twoLegs()
      showPage(legFixture('del-1', 2, { status: 'ASSIGNING_COURIER', splitOutcome: 'SPLIT', totalCost: null }))

      const note = screen.getByTestId('split-charge-note')
      expect(note.textContent).toBe(COST_0_NOTE)
      expect(note.textContent).not.toBe(CHARGE_NOTE)
      expect(screen.getByTestId('split-outcome').nextElementSibling).toBe(note)
      await screen.findByTestId('order-legs')
    })

    it.each(['CANCELED', 'FAILED'])(
      'a leg the split made that ended before any offer (cost null, %s) states the rule and never claims a charge',
      async (status) => {
        twoLegs()
        showPage(legFixture('del-1', 2, { status, splitOutcome: 'SPLIT', totalCost: null }))

        const note = screen.getByTestId('split-charge-note')
        expect(note.textContent).toBe(ENDED_NOTE)
        expect(screen.queryByText(/is charged to you/)).not.toBeInTheDocument()
        await screen.findByTestId('order-legs')
      }
    )

    it('an ordinary order says nothing about a charge', () => {
      showPage(single({ status: 'PICKED_UP', splitOutcome: null }))

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      expect(screen.queryByText(/charged to you/)).not.toBeInTheDocument()
    })

    it.each([0, null])('an order dispatch refused to split whose cost is %p gets no note', (totalCost) => {
      showPage(single({ status: 'PICKED_UP', splitOutcome: null, totalCost }))

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
    })

    it('an order the rider left has its sentence and no charge note', () => {
      showPage(single({ status: 'CANCELED', splitOutcome: 'LEFT' }))

      expect(screen.getByTestId('split-outcome')).toBeInTheDocument()
      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      expect(screen.queryByText(/charged to you/)).not.toBeInTheDocument()
    })

    it('an order the restaurant sent as legs itself has no charge note', async () => {
      ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
        legs: [legFixture('del-1', 1), legFixture('del-2', 2)],
        missingLegNumbers: [],
      })
      showPage(legFixture('del-1', 1))

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      await screen.findByTestId('order-legs')
    })
  })
})
