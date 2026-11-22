// Spec 0046 (AC-3, AC-5, AC-6, cross check 9): the order page of one leg of a multi leg order.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
  delayDeliveryReady,
  fetchOrderLegs,
  markDeliveryFoodReady,
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
} from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'
import { legFixture } from '../legs/legFixtures'

const mockRouter = { query: { deliveryId: 'del-leg-1' } as Record<string, any> }
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

describe('the order page of a leg (spec 0046)', () => {
  const refetch = jest.fn()
  const showPage = (data: ReturnType<typeof legFixture>) => {
    ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({ data, isLoading: false, error: undefined, refetch })
    render(<DeliveryStatusPage />)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    mockRouter.query = { deliveryId: 'del-leg-1' }
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('partner')
    ;(markDeliveryFoodReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ASSIGNING_COURIER',
      readyAt: '2026-11-21T10:20:00.000Z',
      foodReadyAt: '2026-11-21T10:18:00.000Z',
    }))
  })

  it('AC-6: says "Leg 1 of 2" and lists the order\'s legs', async () => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [legFixture('del-leg-1', 1), legFixture('del-leg-2', 2, { status: 'ACCEPTED' })],
      missingLegNumbers: [],
    })
    showPage(legFixture('del-leg-1', 1))

    expect(screen.getByTestId('leg-label')).toHaveTextContent('Leg 1 of 2')
    const section = await screen.findByTestId('order-legs')
    expect(fetchOrderLegs).toHaveBeenCalledWith('del-leg-1')
    expect(within(section).getAllByRole('listitem')).toHaveLength(2)
    expect(within(section).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manual-request/del-leg-2/status')
  })

  // Row 10 review (decision OR.8): a leg's page renders ready controls only after the order's legs have
  // loaded, preventing actions on this leg alone before the other legs are known.
  it('row 10 review (decision OR.8): before the order\'s legs are loaded, no ready buttons show and a placeholder is displayed', async () => {
    let resolveLegs: (val: any) => void = () => {}
    ;(fetchOrderLegs as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLegs = resolve
        }),
    )

    showPage(legFixture('del-leg-1', 1, { legCount: 2 }))

    // Legs have not loaded yet: ready controls are NOT shown, waiting message is shown
    expect(screen.getByTestId('ready-waiting-for-legs')).toHaveTextContent(
      "The ready time shows once the order's legs are loaded.",
    )
    expect(screen.queryByTestId('ready-controls')).not.toBeInTheDocument()

    // Now resolve the fetchOrderLegs request
    resolveLegs({
      legs: [legFixture('del-leg-1', 1), legFixture('del-leg-2', 2)],
      missingLegNumbers: [],
    })

    // Ready controls appear once the legs have loaded
    await waitFor(() => expect(screen.getByTestId('ready-controls')).toBeInTheDocument())
    expect(screen.queryByTestId('ready-waiting-for-legs')).not.toBeInTheDocument()
  })

  it('AC-3: a leg never sent is shown on the page with Retry', async () => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({ legs: [legFixture('del-leg-1', 1)], missingLegNumbers: [2] })
    showPage(legFixture('del-leg-1', 1))

    const missing = await screen.findByTestId('missing-leg-2')
    expect(within(missing).getByText('Leg 2 of 2 was never sent')).toBeInTheDocument()
    expect(within(missing).getByRole('button', { name: 'Retry: get a price' })).toBeInTheDocument()
  })

  it('cross check 9: Food ready on the page marks this leg and every other open leg', async () => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [
        legFixture('del-leg-1', 1, { legCount: 3 }),
        legFixture('del-leg-2', 2, { legCount: 3 }),
        legFixture('del-leg-3', 3, { legCount: 3, status: 'CANCELED' }),
      ],
      missingLegNumbers: [],
    })
    showPage(legFixture('del-leg-1', 1, { legCount: 3 }))
    await screen.findByTestId('order-legs')

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    await waitFor(() => expect(refetch).toHaveBeenCalled())
    expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-leg-1', 'del-leg-2'])
  })

  // Row 10 review: the other legs' ready times moved too, so the next tap must send their new times.
  it('a ready tap reads the legs again, and the next tap sends each other leg its new ready time', async () => {
    const NEW_READY = '2026-11-21T10:30:00.000Z'
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [legFixture('del-leg-1', 1), legFixture('del-leg-2', 2, { readyAt: '2026-11-21T10:20:00.000Z' })],
      missingLegNumbers: [],
    })
    ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ASSIGNING_COURIER',
      readyAt: NEW_READY,
      foodReadyAt: null,
    }))
    showPage(legFixture('del-leg-1', 1))
    await screen.findByTestId('order-legs')
    expect(fetchOrderLegs).toHaveBeenCalledTimes(1)
    // What the server holds after the first tap.
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
      legs: [legFixture('del-leg-1', 1, { readyAt: NEW_READY }), legFixture('del-leg-2', 2, { readyAt: NEW_READY })],
      missingLegNumbers: [],
    })

    fireEvent.click(screen.getByRole('button', { name: '+10' }))

    await waitFor(() => expect(fetchOrderLegs).toHaveBeenCalledTimes(2))
    expect((delayDeliveryReady as jest.Mock).mock.calls[1]).toEqual(['del-leg-2', 10, '2026-11-21T10:20:00.000Z'])

    await waitFor(() => expect(screen.getByRole('button', { name: '+5' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '+5' }))

    await waitFor(() => expect(delayDeliveryReady).toHaveBeenCalledTimes(4))
    expect((delayDeliveryReady as jest.Mock).mock.calls[3]).toEqual(['del-leg-2', 5, NEW_READY])
  })

  // Row 10 review (decision OR.8): when fetchOrderLegs never resolves after the first load, ReadyControls
  // remembers the returned readyAt and sends it on subsequent taps rather than the stale initial time.
  it('row 10 review (decision OR.8): when fetchOrderLegs never resolves after first load, second tap carries returned readyAt for leg 2', async () => {
    const INITIAL_READY = '2026-11-21T10:20:00.000Z'
    const FIRST_UPDATED_READY = '2026-11-21T10:30:00.000Z'

    // Initial load resolves with initial ready times
    ;(fetchOrderLegs as jest.Mock).mockResolvedValueOnce({
      legs: [
        legFixture('del-leg-1', 1, { readyAt: INITIAL_READY }),
        legFixture('del-leg-2', 2, { readyAt: INITIAL_READY }),
      ],
      missingLegNumbers: [],
    })

    // Subsequent fetchOrderLegs calls hang (never resolve), simulating slow network / pending poll
    ;(fetchOrderLegs as jest.Mock).mockImplementation(() => new Promise(() => {}))

    ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ASSIGNING_COURIER',
      readyAt: FIRST_UPDATED_READY,
      foodReadyAt: null,
    }))

    showPage(legFixture('del-leg-1', 1, { readyAt: INITIAL_READY }))
    await screen.findByTestId('order-legs')
    expect(fetchOrderLegs).toHaveBeenCalledTimes(1)

    // First tap: +10 sends INITIAL_READY
    fireEvent.click(screen.getByRole('button', { name: '+10' }))

    await waitFor(() => expect(delayDeliveryReady).toHaveBeenCalledTimes(2))
    expect((delayDeliveryReady as jest.Mock).mock.calls[0]).toEqual(['del-leg-1', 10, INITIAL_READY])
    expect((delayDeliveryReady as jest.Mock).mock.calls[1]).toEqual(['del-leg-2', 10, INITIAL_READY])

    // Wait until buttons become enabled again
    await waitFor(() => expect(screen.getByRole('button', { name: '+5' })).toBeEnabled())

    // Second tap: +5 without fetchOrderLegs having updated the parent's props
    fireEvent.click(screen.getByRole('button', { name: '+5' }))

    await waitFor(() => expect(delayDeliveryReady).toHaveBeenCalledTimes(4))
    // Crucial: second call for leg 2 carries FIRST_UPDATED_READY from the first tap, not INITIAL_READY!
    expect((delayDeliveryReady as jest.Mock).mock.calls[2]).toEqual(['del-leg-1', 5, FIRST_UPDATED_READY])
    expect((delayDeliveryReady as jest.Mock).mock.calls[3]).toEqual(['del-leg-2', 5, FIRST_UPDATED_READY])
  })

  it('a single delivery has no leg label, reads no legs, and Food ready is one call', async () => {
    showPage(legFixture('del-leg-1', 1, { legNumber: null, legCount: null }))

    expect(screen.queryByTestId('leg-label')).not.toBeInTheDocument()
    expect(screen.queryByTestId('order-legs')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    await waitFor(() => expect(refetch).toHaveBeenCalled())
    expect(fetchOrderLegs).not.toHaveBeenCalled()
    expect((markDeliveryFoodReady as jest.Mock).mock.calls).toEqual([['del-leg-1']])
  })
})
