// Spec 0046 (AC-5, AC-6, cross checks 4, 8, 9): one order sent as legs, as one card in the order history.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { OrderLegsCard } from './OrderLegsCard'
import { cancelDelivery, delayDeliveryReady, markDeliveryFoodReady } from '../../api/manualRequestApi'
import { groupHistory } from '../manual-request/utils/legs'
import { PartnerDeliveryDto } from '../manual-request/types'
import { legFixture } from './legFixtures'

jest.mock('../../api/manualRequestApi', () => ({
  cancelDelivery: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
}))

const READY_ONE = '2026-11-21T10:20:00.000Z'
const READY_TWO = '2026-11-21T10:25:00.000Z'

function renderOrder(legs: PartnerDeliveryDto[], onChanged = jest.fn()) {
  const items = groupHistory(legs)
  const order = items.find((item) => item.kind === 'order')
  if (!order || order.kind !== 'order') throw new Error('the fixture is not a multi leg order')
  render(<OrderLegsCard order={order} onChanged={onChanged} />)
  return { onChanged }
}

describe('OrderLegsCard (spec 0046, AC-6)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(cancelDelivery as jest.Mock).mockResolvedValue({ id: 'x', status: 'CANCELED' })
    ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ASSIGNING_COURIER',
      readyAt: '2026-11-21T10:30:00.000Z',
      foodReadyAt: null,
    }))
    ;(markDeliveryFoodReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ASSIGNING_COURIER',
      readyAt: READY_ONE,
      foodReadyAt: '2026-11-21T10:18:00.000Z',
    }))
  })

  it('one card for the order: each leg with its label, its status and a link to its page', () => {
    renderOrder([legFixture('del-1', 1, { status: 'ACCEPTED' }), legFixture('del-2', 2)])

    expect(screen.getAllByTestId('order-legs-card')).toHaveLength(1)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Leg 1 of 2')).toBeInTheDocument()
    expect(rows[0].querySelector('[data-status="ACCEPTED"]')).not.toBeNull()
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/manual-request/del-1/status')
    expect(within(rows[1]).getByText('Leg 2 of 2')).toBeInTheDocument()
    expect(rows[1].querySelector('[data-status="ASSIGNING_COURIER"]')).not.toBeNull()
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/manual-request/del-2/status')
  })

  it('names the customer once for the whole order', () => {
    renderOrder([legFixture('del-1', 1), legFixture('del-2', 2)])

    expect(screen.getAllByText(/Vassilis Spanoulis/)).toHaveLength(1)
  })

  it('the cost is the sum of the legs (each leg is charged a delivery price)', () => {
    renderOrder([legFixture('del-1', 1, { totalCost: 356 }), legFixture('del-2', 2, { totalCost: 392 })])

    expect(screen.getByText(/Cost:/).textContent?.replace(/ /g, ' ')).toBe('Cost: 7,48 €')
  })

  // Row 10 review: the list is a page, so the card cannot know a leg was never sent; it says the leg is not
  // in this list and points to the order page, which knows.
  it('cross check 4: fewer legs than legCount says "Leg 2 of 2 is not in this list" and points to the order page', () => {
    renderOrder([legFixture('del-1', 1)])

    const line = screen.getByText(/Leg 2 of 2 is not in this list\./)
    expect(line).toBeInTheDocument()
    const link = within(line).getByRole('link', { name: 'Open the order' })
    expect(link).toHaveAttribute('href', '/manual-request/del-1/status')
    expect(screen.queryByText(/was never sent/)).not.toBeInTheDocument()
  })

  it('a complete order says nothing about a leg not in the list', () => {
    renderOrder([legFixture('del-1', 1), legFixture('del-2', 2)])

    expect(screen.queryByText(/is not in this list/)).not.toBeInTheDocument()
    expect(screen.queryByText(/was never sent/)).not.toBeInTheDocument()
  })

  describe('cross check 9: the ready buttons apply to every open leg', () => {
    it('Food ready marks both legs, one call per leg', async () => {
      const { onChanged } = renderOrder([legFixture('del-1', 1), legFixture('del-2', 2)])

      fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-1', 'del-2'])
    })

    it('+10 delays both legs, each against its own ready time', async () => {
      const { onChanged } = renderOrder([
        legFixture('del-1', 1, { readyAt: READY_ONE }),
        legFixture('del-2', 2, { readyAt: READY_TWO }),
      ])

      fireEvent.click(screen.getByRole('button', { name: '+10' }))

      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect((delayDeliveryReady as jest.Mock).mock.calls).toEqual([
        ['del-1', 10, READY_ONE],
        ['del-2', 10, READY_TWO],
      ])
    })

    it('a leg already ended is left out of the ready calls', async () => {
      const { onChanged } = renderOrder([legFixture('del-1', 1, { status: 'CANCELED' }), legFixture('del-2', 2)])

      fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-2'])
    })
  })

  describe('AC-5, cross check 8: Cancel all', () => {
    it('cancels every leg not yet ended, one call per leg, after one question', async () => {
      const { onChanged } = renderOrder([legFixture('del-1', 1, { status: 'ACCEPTED' }), legFixture('del-2', 2)])

      fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))
      expect(cancelDelivery).not.toHaveBeenCalled()
      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel all legs' }))

      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect((cancelDelivery as jest.Mock).mock.calls).toEqual([
        ['del-1', 'RESTAURANT'],
        ['del-2', 'RESTAURANT'],
      ])
    })

    it.each(['DROPPED_OFF', 'CANCELED', 'FAILED'])('skips a leg already %s', async (status) => {
      const { onChanged } = renderOrder([legFixture('del-1', 1, { status }), legFixture('del-2', 2)])

      fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))
      const dialog = await screen.findByRole('alertdialog')
      expect(within(dialog).getByRole('heading')).toHaveTextContent('Cancel all 1 legs of this order?')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel all legs' }))

      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect((cancelDelivery as jest.Mock).mock.calls).toEqual([['del-2', 'RESTAURANT']])
    })

    it('an order whose legs have all ended has no Cancel all button', () => {
      renderOrder([legFixture('del-1', 1, { status: 'DROPPED_OFF' }), legFixture('del-2', 2, { status: 'CANCELED' })])

      expect(screen.queryByRole('button', { name: 'Cancel all legs' })).not.toBeInTheDocument()
    })
  })
})
