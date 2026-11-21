// Spec 0046 (AC-5, cross check 8): "Cancel all" on a multi leg order. One question for who wanted it,
// then one cancel call per leg through the usual cancellation, each leg's answer shown.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CancelOrderLegsDialog } from './CancelOrderLegsDialog'
import { cancelDelivery } from '../../api/manualRequestApi'
import { legFixture } from './legFixtures'

jest.mock('../../api/manualRequestApi', () => ({
  cancelDelivery: jest.fn(),
}))

describe('CancelOrderLegsDialog (spec 0046, AC-5)', () => {
  const legs = [legFixture('del-1', 1, { status: 'ACCEPTED' }), legFixture('del-2', 2)]
  const onClose = jest.fn()
  const onDone = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    ;(cancelDelivery as jest.Mock).mockResolvedValue({ id: 'x', status: 'CANCELED' })
  })

  it('asks one question for the whole order, the restaurant chosen at first, and cancels nothing yet', () => {
    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Cancel all 2 legs of this order?' })).toBeInTheDocument()
    expect(screen.getAllByText('Who wants to cancel?')).toHaveLength(1)
    expect(screen.getByLabelText('We need to cancel it')).toBeChecked()
    expect(screen.getByLabelText('The customer asked to cancel')).not.toBeChecked()
    expect(cancelDelivery).not.toHaveBeenCalled()
  })

  it('says what a cancellation costs per leg (spec 0015: a rider who accepted is paid; the restaurant is charged for its own)', () => {
    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)

    expect(screen.getByText(/A rider who already accepted a leg is still paid for it/)).toBeInTheDocument()
    expect(screen.getByText(/charged to you for that leg/)).toBeInTheDocument()
  })

  it('one cancel call per leg, in leg order, each with the one answer given (RESTAURANT)', async () => {
    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect((cancelDelivery as jest.Mock).mock.calls).toEqual([
      ['del-1', 'RESTAURANT'],
      ['del-2', 'RESTAURANT'],
    ])
  })

  it('"The customer asked" goes to every leg', async () => {
    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)

    fireEvent.click(screen.getByLabelText('The customer asked to cancel'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect((cancelDelivery as jest.Mock).mock.calls).toEqual([
      ['del-1', 'CUSTOMER'],
      ['del-2', 'CUSTOMER'],
    ])
  })

  it('shows each leg\'s result, and a leg that could not be cancelled does not stop the next one', async () => {
    ;(cancelDelivery as jest.Mock)
      .mockRejectedValueOnce(new Error('This delivery was already picked up.'))
      .mockResolvedValueOnce({ id: 'del-2', status: 'CANCELED' })

    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))

    const results = await screen.findByTestId('cancel-results')
    const lines = within(results).getAllByRole('listitem').map((line) => line.textContent)
    expect(lines).toEqual(['Leg 1 of 2: This delivery was already picked up.', 'Leg 2 of 2: Cancelled'])
    expect(cancelDelivery).toHaveBeenCalledTimes(2)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('stays open with the results until Close', async () => {
    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))

    await screen.findByTestId('cancel-results')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Cancel all legs' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Row 10 review: onDone makes the page read the legs again, and the cancelled ones drop out of the list
  // the dialog is given. The title must still say what was asked.
  it('keeps the count it opened with after the page hands it fewer legs', async () => {
    const { rerender } = render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))
    await screen.findByTestId('cancel-results')

    rerender(<CancelOrderLegsDialog legs={[]} onClose={onClose} onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Cancel all 2 legs of this order?' })).toBeInTheDocument()
    expect(within(screen.getByTestId('cancel-results')).getAllByRole('listitem')).toHaveLength(2)
  })

  it('cancels the legs it opened with, even if the page changes its list before Confirm', async () => {
    const { rerender } = render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)

    rerender(<CancelOrderLegsDialog legs={[legs[0]]} onClose={onClose} onDone={onDone} />)
    expect(screen.getByRole('heading', { name: 'Cancel all 2 legs of this order?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all legs' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect((cancelDelivery as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['del-1', 'del-2'])
  })

  it('"Keep them" cancels nothing', () => {
    render(<CancelOrderLegsDialog legs={legs} onClose={onClose} onDone={onDone} />)

    fireEvent.click(screen.getByRole('button', { name: 'Keep them' }))

    expect(cancelDelivery).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
