// Spec 0023 (AC-8): the ready time and its buttons, as My Orders and the order page show them.
// Times are Athens time (src/utils/format.ts): 12:32Z on 3 November 2026 reads 14:32.
import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReadyControls } from './ReadyControls'
import { delayDeliveryReady, markDeliveryFoodReady } from '../../api/manualRequestApi'
import { READY_ACTION_STATUSES } from './readyState'

jest.mock('../../api/manualRequestApi', () => ({
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
}))

const READY_AT = '2026-11-03T12:32:00.000Z' // 14:32 in Athens
const LATER_READY_AT = '2026-11-03T12:42:00.000Z' // 14:42
const FOOD_READY_AT = '2026-11-03T12:30:00.000Z' // 14:30

const BUTTON_NAMES = ['+5', '+10', '+15', 'Food ready']

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('ReadyControls (spec 0023, AC-8)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('a pre pickup order with a ready time shows "Ready at 14:32" and +5, +10, +15, Food ready', () => {
    render(<ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }} />)

    expect(screen.getByText('Ready at 14:32')).toBeInTheDocument()
    for (const name of BUTTON_NAMES) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
  })

  it.each(['CREATED', 'ASSIGNING_COURIER', 'DISPATCHED', 'COURIER_ARRIVED_AT_PICKUP_LOCATION'])(
    'shows the four buttons for %s too',
    (status) => {
      render(<ReadyControls deliveryId="del-1" order={{ status, readyAt: READY_AT, foodReadyAt: null }} />)
      for (const name of BUTTON_NAMES) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument()
      }
    },
  )

  it('once foodReadyAt is set: "Food ready at 14:30" and no buttons', () => {
    render(
      <ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: FOOD_READY_AT }} />,
    )

    expect(screen.getByText('Food ready at 14:30')).toBeInTheDocument()
    expect(screen.queryByText(/^Ready at/)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it.each(['PICKED_UP', 'ON_THE_WAY', 'COURIER_ARRIVED_AT_DROPOFF_LOCATION', 'DROPPED_OFF', 'CANCELED', 'FAILED'])(
    '%s (picked up or ended): no buttons',
    (status) => {
      render(<ReadyControls deliveryId="del-1" order={{ status, readyAt: READY_AT, foodReadyAt: null }} />)
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    },
  )

  it('picked up or ended with no ready time (an order from before ready times): renders nothing', () => {
    const { container } = render(
      <ReadyControls deliveryId="del-1" order={{ status: 'DROPPED_OFF', readyAt: null, foodReadyAt: null }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it.each([...READY_ACTION_STATUSES])(
    '%s with no ready time (an order from before ready times): renders nothing, no "Ready at", no buttons',
    (status) => {
      const { container } = render(
        <ReadyControls deliveryId="del-old" order={{ status, readyAt: null, foodReadyAt: null }} />,
      )
      expect(screen.queryByText(/Ready at/)).not.toBeInTheDocument()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(container).toBeEmptyDOMElement()
    },
  )

  it('+10 sends (id, 10, the shown readyAt), shows the answer\'s time at once and calls onChanged', async () => {
    ;(delayDeliveryReady as jest.Mock).mockResolvedValue({
      id: 'del-1',
      status: 'ACCEPTED',
      readyAt: LATER_READY_AT,
      foodReadyAt: null,
    })
    const onChanged = jest.fn()

    render(
      <ReadyControls
        deliveryId="del-1"
        order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }}
        onChanged={onChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '+10' }))

    expect(delayDeliveryReady).toHaveBeenCalledTimes(1)
    expect(delayDeliveryReady).toHaveBeenCalledWith('del-1', 10, READY_AT)
    // The answer is shown without waiting for the page's poll (the order prop never changed here).
    expect(await screen.findByText('Ready at 14:42')).toBeInTheDocument()
    expect(screen.queryByText('Ready at 14:32')).not.toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('a second tap sends the readyAt the restaurant now sees (the first answer), not the page\'s old copy', async () => {
    ;(delayDeliveryReady as jest.Mock)
      .mockResolvedValueOnce({ id: 'del-1', status: 'ACCEPTED', readyAt: LATER_READY_AT, foodReadyAt: null })
      .mockResolvedValueOnce({ id: 'del-1', status: 'ACCEPTED', readyAt: '2026-11-03T12:47:00.000Z', foodReadyAt: null })

    render(<ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }} />)

    fireEvent.click(screen.getByRole('button', { name: '+10' }))
    await screen.findByText('Ready at 14:42')

    fireEvent.click(screen.getByRole('button', { name: '+5' }))
    await screen.findByText('Ready at 14:47')

    expect(delayDeliveryReady).toHaveBeenNthCalledWith(2, 'del-1', 5, LATER_READY_AT)
  })

  it('Food ready calls markDeliveryFoodReady(id), then shows "Food ready at" and drops the buttons', async () => {
    ;(markDeliveryFoodReady as jest.Mock).mockResolvedValue({
      id: 'del-1',
      status: 'ACCEPTED',
      readyAt: READY_AT,
      foodReadyAt: FOOD_READY_AT,
    })
    const onChanged = jest.fn()

    render(
      <ReadyControls
        deliveryId="del-1"
        order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }}
        onChanged={onChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    expect(markDeliveryFoodReady).toHaveBeenCalledWith('del-1')
    expect(delayDeliveryReady).not.toHaveBeenCalled()
    expect(await screen.findByText('Food ready at 14:30')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('a refusal shows the server\'s own sentence in role=alert, keeps the shown time, and calls onChanged once (a fresh copy at once)', async () => {
    ;(delayDeliveryReady as jest.Mock).mockRejectedValue(new Error('The ready time just changed. Look again.'))
    const onChanged = jest.fn()

    render(
      <ReadyControls
        deliveryId="del-1"
        order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }}
        onChanged={onChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '+15' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The ready time just changed. Look again.')
    expect(screen.getByText('Ready at 14:32')).toBeInTheDocument()
    // The page fetches the current time at once, so "Look again" can be acted on without waiting for a poll.
    expect(onChanged).toHaveBeenCalledTimes(1)
    // The buttons come back so the restaurant can look again and retry.
    for (const name of BUTTON_NAMES) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
  })

  it('a food ready refusal shows the server\'s sentence too', async () => {
    ;(markDeliveryFoodReady as jest.Mock).mockRejectedValue(new Error('The rider has already picked this order up.'))

    render(<ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The rider has already picked this order up.')
  })

  it('every button is disabled while a request is in flight, and enabled again after it ends', async () => {
    const pending = deferred<any>()
    ;(delayDeliveryReady as jest.Mock).mockReturnValue(pending.promise)

    render(<ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }} />)

    fireEvent.click(screen.getByRole('button', { name: '+5' }))

    for (const name of BUTTON_NAMES) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    // A second tap while disabled sends nothing.
    fireEvent.click(screen.getByRole('button', { name: '+5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Food ready' }))
    expect(delayDeliveryReady).toHaveBeenCalledTimes(1)
    expect(markDeliveryFoodReady).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve({ id: 'del-1', status: 'ACCEPTED', readyAt: LATER_READY_AT, foodReadyAt: null })
    })

    await waitFor(() => {
      for (const name of BUTTON_NAMES) {
        expect(screen.getByRole('button', { name })).toBeEnabled()
      }
    })
  })

  it('a new order from the page (a poll) replaces what is shown', () => {
    const { rerender } = render(
      <ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: READY_AT, foodReadyAt: null }} />,
    )
    expect(screen.getByText('Ready at 14:32')).toBeInTheDocument()

    // Another tab delayed it.
    rerender(<ReadyControls deliveryId="del-1" order={{ status: 'ACCEPTED', readyAt: LATER_READY_AT, foodReadyAt: null }} />)
    expect(screen.getByText('Ready at 14:42')).toBeInTheDocument()

    // Another tab marked it ready.
    rerender(
      <ReadyControls
        deliveryId="del-1"
        order={{ status: 'ACCEPTED', readyAt: LATER_READY_AT, foodReadyAt: FOOD_READY_AT }}
      />,
    )
    expect(screen.getByText('Food ready at 14:30')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('a poll after the rider picked up removes the buttons', () => {
    const { rerender } = render(
      <ReadyControls deliveryId="del-1" order={{ status: 'DISPATCHED', readyAt: READY_AT, foodReadyAt: null }} />,
    )
    expect(screen.getByRole('button', { name: '+10' })).toBeInTheDocument()

    rerender(<ReadyControls deliveryId="del-1" order={{ status: 'PICKED_UP', readyAt: READY_AT, foodReadyAt: null }} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
