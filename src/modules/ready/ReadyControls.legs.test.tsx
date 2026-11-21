// Spec 0046 (cross check 9): on a grouped order, Food ready and the "+ minutes" delay apply to every leg,
// one call per leg.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReadyControls } from './ReadyControls'
import { delayDeliveryReady, markDeliveryFoodReady } from '../../api/manualRequestApi'

jest.mock('../../api/manualRequestApi', () => ({
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
}))

const READY_ONE = '2026-11-03T12:32:00.000Z' // 14:32 in Athens
const READY_TWO = '2026-11-03T12:35:00.000Z'
const READY_THREE = '2026-11-03T12:40:00.000Z'

const order = { status: 'ACCEPTED', readyAt: READY_ONE, foodReadyAt: null }
const otherLegs = [
  { id: 'del-2', readyAt: READY_TWO, legLabel: 'Leg 2 of 3' },
  { id: 'del-3', readyAt: READY_THREE, legLabel: 'Leg 3 of 3' },
]

describe('ReadyControls on a multi leg order (spec 0046, cross check 9)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ACCEPTED',
      readyAt: '2026-11-03T12:42:00.000Z',
      foodReadyAt: null,
    }))
    ;(markDeliveryFoodReady as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      status: 'ACCEPTED',
      readyAt: READY_ONE,
      foodReadyAt: '2026-11-03T12:30:00.000Z',
    }))
  })

  it('Food ready marks this leg and every other leg, one call each', async () => {
    const onChanged = jest.fn()
    render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-1', 'del-2', 'del-3'])
    expect(delayDeliveryReady).not.toHaveBeenCalled()
  })

  it('+10 delays this leg and every other leg, each with its own ready time', async () => {
    const onChanged = jest.fn()
    render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: '+10' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect((delayDeliveryReady as jest.Mock).mock.calls).toEqual([
      ['del-1', 10, READY_ONE],
      ['del-2', 10, READY_TWO],
      ['del-3', 10, READY_THREE],
    ])
  })

  it('a leg that refuses is named with the reason, and the legs after it still go', async () => {
    ;(markDeliveryFoodReady as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'del-2') throw new Error('This order was already picked up.')
      return { id, status: 'ACCEPTED', readyAt: READY_ONE, foodReadyAt: '2026-11-03T12:30:00.000Z' }
    })
    const onChanged = jest.fn()
    render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    expect(await screen.findByText(/Leg 2 of 3: This order was already picked up\./)).toBeInTheDocument()
    expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-1', 'del-2', 'del-3'])
    expect(screen.queryByText(/Leg 3 of 3:/)).not.toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  // Row 10 review: the first leg refusing used to stop the whole tap, leaving the other legs unmarked.
  it('when this delivery itself refuses, every other leg is still tried', async () => {
    ;(markDeliveryFoodReady as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'del-1') throw new Error('The ready time just changed. Look again.')
      return { id, status: 'ACCEPTED', readyAt: READY_ONE, foodReadyAt: '2026-11-03T12:30:00.000Z' }
    })
    const onChanged = jest.fn()
    render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect((markDeliveryFoodReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-1', 'del-2', 'del-3'])
    expect(await screen.findByText(/The ready time just changed\. Look again\./)).toBeInTheDocument()
    // The buttons come back, so the restaurant can look again and tap again.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Food ready' })).toBeEnabled())
  })

  it('when this delivery and another leg both refuse, both reasons are shown', async () => {
    ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'del-1') throw new Error('The ready time just changed. Look again.')
      if (id === 'del-3') throw new Error('This order was already picked up.')
      return { id, status: 'ACCEPTED', readyAt: '2026-11-03T12:42:00.000Z', foodReadyAt: null }
    })
    render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} />)

    fireEvent.click(screen.getByRole('button', { name: '+10' }))

    const shown = await screen.findByText(/The ready time just changed\. Look again\./)
    expect(shown).toHaveTextContent('Leg 3 of 3: This order was already picked up.')
    expect(shown).not.toHaveTextContent('Leg 2 of 3')
    expect((delayDeliveryReady as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-1', 'del-2', 'del-3'])
  })

  it('a single delivery (no other legs) makes exactly one call, as before', async () => {
    const onChanged = jest.fn()
    render(<ReadyControls deliveryId="del-1" order={order} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect((markDeliveryFoodReady as jest.Mock).mock.calls).toEqual([['del-1']])
  })
})
