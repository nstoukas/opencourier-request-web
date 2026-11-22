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

  // Row 10 review (decision OR.8): ReadyControls caches the latest returned readyAt for each other leg
  // and sends it on consecutive taps while the parent page still displays the previous time.
  describe('sending latest returned ready times for other legs across taps (decision OR.8)', () => {
    it('consecutive delay taps without parent re-render send the updated readyAt returned by the first tap', async () => {
      const NEW_READY_ONE = '2026-11-03T12:42:00.000Z'
      const NEW_READY_TWO = '2026-11-03T12:45:00.000Z'
      const NEW_READY_THREE = '2026-11-03T12:50:00.000Z'

      // Return updated ready times for each leg
      ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string, minutes: number, readyAt: string | null) => {
        const date = new Date(readyAt ? Date.parse(readyAt) : Date.now())
        date.setMinutes(date.getMinutes() + minutes)
        return {
          id,
          status: 'ACCEPTED',
          readyAt: date.toISOString(),
          foodReadyAt: null,
        }
      })

      const onChanged = jest.fn()
      render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} onChanged={onChanged} />)

      // First tap: +10
      fireEvent.click(screen.getByRole('button', { name: '+10' }))
      await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))

      expect((delayDeliveryReady as jest.Mock).mock.calls).toEqual([
        ['del-1', 10, READY_ONE],
        ['del-2', 10, READY_TWO],
        ['del-3', 10, READY_THREE],
      ])

      // Wait until buttons are re-enabled
      await waitFor(() => expect(screen.getByRole('button', { name: '+5' })).toBeEnabled())

      // Second tap: +5 without the parent component having updated otherLegs prop
      fireEvent.click(screen.getByRole('button', { name: '+5' }))
      await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2))

      // Crucial: second calls for del-2 and del-3 carry NEW_READY_TWO and NEW_READY_THREE from the first tap!
      expect((delayDeliveryReady as jest.Mock).mock.calls.slice(3)).toEqual([
        ['del-1', 5, NEW_READY_ONE],
        ['del-2', 5, NEW_READY_TWO],
        ['del-3', 5, NEW_READY_THREE],
      ])
    })

    it('when otherLegs prop moves to a newer time from the page, the next tap sends the page time', async () => {
      const MOVED_READY_TWO = '2026-11-03T13:00:00.000Z'
      ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => ({
        id,
        status: 'ACCEPTED',
        readyAt: '2026-11-03T12:42:00.000Z',
        foodReadyAt: null,
      }))

      const { rerender } = render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} />)

      // First tap
      fireEvent.click(screen.getByRole('button', { name: '+10' }))
      await waitFor(() => expect(delayDeliveryReady).toHaveBeenCalledTimes(3))

      // Now parent page re-renders with fresh otherLegs having MOVED_READY_TWO
      rerender(
        <ReadyControls
          deliveryId="del-1"
          order={order}
          otherLegs={[
            { id: 'del-2', readyAt: MOVED_READY_TWO, legLabel: 'Leg 2 of 3' },
            { id: 'del-3', readyAt: READY_THREE, legLabel: 'Leg 3 of 3' },
          ]}
        />
      )

      await waitFor(() => expect(screen.getByRole('button', { name: '+5' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: '+5' }))

      await waitFor(() => expect(delayDeliveryReady).toHaveBeenCalledTimes(6))
      // For del-2, since page moved to MOVED_READY_TWO, it sent the page's time
      expect((delayDeliveryReady as jest.Mock).mock.calls[4]).toEqual(['del-2', 5, MOVED_READY_TWO])
    })

    it('when an other leg fails on the first tap, its ready time is not cached and the next tap uses the prop time', async () => {
      ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => {
        if (id === 'del-2') throw new Error('Failed to update leg 2')
        return {
          id,
          status: 'ACCEPTED',
          readyAt: '2026-11-03T12:42:00.000Z',
          foodReadyAt: null,
        }
      })

      render(<ReadyControls deliveryId="del-1" order={order} otherLegs={otherLegs} />)

      // First tap: del-2 will fail
      fireEvent.click(screen.getByRole('button', { name: '+10' }))
      await screen.findByRole('alert')
      expect((delayDeliveryReady as jest.Mock).mock.calls).toEqual([
        ['del-1', 10, READY_ONE],
        ['del-2', 10, READY_TWO],
        ['del-3', 10, READY_THREE],
      ])

      // Next tap: del-2 should still receive READY_TWO (not cached as updated)
      ;(delayDeliveryReady as jest.Mock).mockImplementation(async (id: string) => ({
        id,
        status: 'ACCEPTED',
        readyAt: '2026-11-03T12:47:00.000Z',
        foodReadyAt: null,
      }))

      fireEvent.click(screen.getByRole('button', { name: '+5' }))
      await waitFor(() => expect(delayDeliveryReady).toHaveBeenCalledTimes(6))
      expect((delayDeliveryReady as jest.Mock).mock.calls[4]).toEqual(['del-2', 5, READY_TWO])
    })
  })
})
