// Spec 0046 (AC-3, AC-5, AC-6, cross check 9): the order page of one leg of a multi leg order.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
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
