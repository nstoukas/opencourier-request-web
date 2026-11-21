// Spec 0046 (AC-3, AC-5, AC-6, cross check 4): the legs of a multi leg order on its page. Each leg with its
// status and rider; a leg that was never sent, with Retry (decision 10.4: Retry asks for the leg's size
// again, then a fresh price, then sends it with a new key); and Cancel all.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { OrderLegsSection } from './OrderLegsSection'
import { cancelDelivery, createDelivery, fetchOrderLegs, requestQuote } from '../../api/manualRequestApi'
import { legFixture } from './legFixtures'

jest.mock('../../api/manualRequestApi', () => ({
  cancelDelivery: jest.fn(),
  createDelivery: jest.fn(),
  fetchOrderLegs: jest.fn(),
  requestQuote: jest.fn(),
}))

const plain = (text: string | null | undefined) => (text ?? '').replace(/ /g, ' ')

const freshQuote = {
  id: 'quote-fresh',
  quoteRangeFrom: 392,
  quoteRangeTo: 392,
  currency: 'EUR',
  duration: 15,
  distance: 2,
  distanceUnit: 'km',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  dropoffEta: null,
  createdAt: new Date().toISOString(),
}

describe('OrderLegsSection (spec 0046)', () => {
  const onChanged = jest.fn()
  const onLegs = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    ;(requestQuote as jest.Mock).mockResolvedValue(freshQuote)
    ;(createDelivery as jest.Mock).mockResolvedValue({ id: 'del-2', status: 'CREATED' })
    ;(cancelDelivery as jest.Mock).mockResolvedValue({ id: 'x', status: 'CANCELED' })
  })

  const show = async (answer: { legs: ReturnType<typeof legFixture>[]; missingLegNumbers: number[] }, deliveryId = 'del-1') => {
    ;(fetchOrderLegs as jest.Mock).mockResolvedValue(answer)
    render(<OrderLegsSection deliveryId={deliveryId} version={0} onChanged={onChanged} onLegs={onLegs} />)
    return screen.findByTestId('order-legs')
  }

  describe('AC-6: the legs with their status and rider', () => {
    it('reads the order of the delivery on the page, and lists each leg', async () => {
      const section = await show({
        legs: [
          legFixture('del-1', 1, { status: 'ACCEPTED', courier: { id: 'c-1', firstName: 'Maria', lastName: 'Papadopoulou' } }),
          legFixture('del-2', 2),
        ],
        missingLegNumbers: [],
      })

      expect(fetchOrderLegs).toHaveBeenCalledWith('del-1')
      expect(within(section).getByText('This order goes as 2 deliveries')).toBeInTheDocument()
      const rows = within(section).getAllByRole('listitem')
      expect(rows).toHaveLength(2)
      expect(rows[0]).toHaveTextContent('Leg 1 of 2')
      expect(rows[0]).toHaveTextContent('Maria Papadopoulou')
      expect(rows[0].querySelector('[data-status="ACCEPTED"]')).not.toBeNull()
      expect(rows[0]).toHaveTextContent('This page')
      expect(rows[1]).toHaveTextContent('Leg 2 of 2')
      expect(rows[1]).toHaveTextContent('No rider yet')
      expect(rows[1].querySelector('[data-status="ASSIGNING_COURIER"]')).not.toBeNull()
      expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/manual-request/del-2/status')
    })

    it('hands the legs to the page (so its ready buttons can reach every leg)', async () => {
      const legs = [legFixture('del-1', 1), legFixture('del-2', 2)]
      await show({ legs, missingLegNumbers: [] })

      expect(onLegs).toHaveBeenCalledWith(legs)
    })

    it('a complete order shows no leg as never sent', async () => {
      await show({ legs: [legFixture('del-1', 1), legFixture('del-2', 2)], missingLegNumbers: [] })

      expect(screen.queryByText(/was never sent/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
    })

    it('a single delivery (no legs) renders nothing', async () => {
      ;(fetchOrderLegs as jest.Mock).mockResolvedValue({ legs: [], missingLegNumbers: [] })
      const { container } = render(<OrderLegsSection deliveryId="del-1" version={0} onChanged={onChanged} />)

      await waitFor(() => expect(fetchOrderLegs).toHaveBeenCalled())
      expect(container).toBeEmptyDOMElement()
    })

    it('reads the legs again when the page bumps the version', async () => {
      ;(fetchOrderLegs as jest.Mock).mockResolvedValue({ legs: [legFixture('del-1', 1), legFixture('del-2', 2)], missingLegNumbers: [] })
      const { rerender } = render(<OrderLegsSection deliveryId="del-1" version={0} onChanged={onChanged} />)
      await screen.findByTestId('order-legs')
      expect(fetchOrderLegs).toHaveBeenCalledTimes(1)

      rerender(<OrderLegsSection deliveryId="del-1" version={1} onChanged={onChanged} />)

      await waitFor(() => expect(fetchOrderLegs).toHaveBeenCalledTimes(2))
    })
  })

  describe('AC-3, cross check 4: a leg that was never sent', () => {
    const lostLegTwo = () => show({ legs: [legFixture('del-1', 1, { orderTotalValue: 2000 })], missingLegNumbers: [2] })

    it('says "Leg 2 of 2 was never sent"', async () => {
      await lostLegTwo()

      expect(within(screen.getByTestId('missing-leg-2')).getByText('Leg 2 of 2 was never sent')).toBeInTheDocument()
    })

    it('a 3 leg order with only leg 1 shows legs 2 and 3 as never sent', async () => {
      await show({ legs: [legFixture('del-1', 1, { legCount: 3 })], missingLegNumbers: [2, 3] })

      expect(screen.getByText('Leg 2 of 3 was never sent')).toBeInTheDocument()
      expect(screen.getByText('Leg 3 of 3 was never sent')).toBeInTheDocument()
    })

    it('Retry waits for the leg\'s size (decision 10.4), then asks a fresh price for the same addresses', async () => {
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      const retry = within(missing).getByRole('button', { name: 'Retry: get a price' })
      expect(retry).toBeDisabled()

      fireEvent.click(within(missing).getByRole('radio', { name: 'Small' }))
      expect(retry).toBeEnabled()
      fireEvent.click(retry)

      await waitFor(() => expect(requestQuote).toHaveBeenCalledTimes(1))
      const asked = (requestQuote as jest.Mock).mock.calls[0][0]
      expect(asked).toMatchObject({
        pickupLatitude: 39.3628,
        pickupLongitude: 22.9435,
        dropoffLatitude: 39.361,
        dropoffLongitude: 22.942,
        dropoffName: 'Vassilis Spanoulis',
        dropoffPhoneNumber: '+306911223344',
      })
      expect(asked.dropoffAddress).toMatchObject({ streetAddress: ['Iasonos 80'], city: 'Volos' })
      // Nothing is sent before the restaurant has seen the new price.
      expect(createDelivery).not.toHaveBeenCalled()
    })

    it('never asks for a ready time in the past', async () => {
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      fireEvent.click(within(missing).getByRole('radio', { name: 'Small' }))
      const before = Date.now()
      fireEvent.click(within(missing).getByRole('button', { name: 'Retry: get a price' }))

      await waitFor(() => expect(requestQuote).toHaveBeenCalledTimes(1))
      const readyAt = Date.parse((requestQuote as jest.Mock).mock.calls[0][0].pickupReadyAt)
      expect(readyAt).toBeGreaterThanOrEqual(before - 1000)
    })

    it('shows the new price before anything is sent', async () => {
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      fireEvent.click(within(missing).getByRole('radio', { name: 'Small' }))
      fireEvent.click(within(missing).getByRole('button', { name: 'Retry: get a price' }))

      const send = await within(missing).findByRole('button', { name: 'Send leg 2 of 2' })
      expect(plain(missing.textContent)).toContain('Price for leg 2 of 2: 3,92 €')
      expect(send).toBeEnabled()
      expect(createDelivery).not.toHaveBeenCalled()
    })

    it('Send creates the leg with the same reference and numbers, the fresh quote, the picked size and a new key', async () => {
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      fireEvent.click(within(missing).getByRole('radio', { name: 'Small' }))
      fireEvent.click(within(missing).getByRole('button', { name: 'Retry: get a price' }))
      fireEvent.click(await within(missing).findByRole('button', { name: 'Send leg 2 of 2' }))

      await waitFor(() => expect(createDelivery).toHaveBeenCalledTimes(1))
      const body = (createDelivery as jest.Mock).mock.calls[0][0]
      expect(body).toMatchObject({
        orderReference: 'quote-first',
        legNumber: 2,
        legCount: 2,
        quoteId: 'quote-fresh',
        boxSize: 'SMALL',
        dropoffName: 'Vassilis Spanoulis',
        dropoffSellerNotes: 'Ring twice',
        dropoffNotes: 'Floor: 4 · Doorbell: Spanoulis',
      })
      // Cross check 4: a new request with a new quote has a new idempotency key.
      expect(body.idempotencyKey).toEqual(expect.stringContaining('quote-fresh'))
      // Cross check 6: the items go on every leg; the order total stays on leg 1.
      expect(body.orderItems).toEqual([{ name: 'Souvlaki', quantity: 3, kind: 'SIDE' }])
      expect(body.orderTotalValue).toBe(0)
    })

    it('after the leg is sent, the legs are read again and the page is told', async () => {
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      fireEvent.click(within(missing).getByRole('radio', { name: 'Large' }))
      fireEvent.click(within(missing).getByRole('button', { name: 'Retry: get a price' }))
      ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
        legs: [legFixture('del-1', 1), legFixture('del-2', 2, { status: 'CREATED' })],
        missingLegNumbers: [],
      })
      fireEvent.click(await within(missing).findByRole('button', { name: 'Send leg 2 of 2' }))

      await waitFor(() => expect(screen.queryByTestId('missing-leg-2')).not.toBeInTheDocument())
      expect(onChanged).toHaveBeenCalled()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('a price that cannot be worked out says why, and sends nothing', async () => {
      ;(requestQuote as jest.Mock).mockRejectedValue(new Error('No couriers are currently available'))
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      fireEvent.click(within(missing).getByRole('radio', { name: 'Small' }))
      fireEvent.click(within(missing).getByRole('button', { name: 'Retry: get a price' }))

      expect(await within(missing).findByText('No couriers are currently available')).toBeInTheDocument()
      expect(createDelivery).not.toHaveBeenCalled()
      expect(within(missing).getByRole('button', { name: 'Retry: get a price' })).toBeEnabled()
    })

    it('a send the backend refuses says why and goes back to asking a price', async () => {
      ;(createDelivery as jest.Mock).mockRejectedValue(new Error('Leg 2 of 2 of this order was already sent.'))
      await lostLegTwo()
      const missing = screen.getByTestId('missing-leg-2')
      fireEvent.click(within(missing).getByRole('radio', { name: 'Small' }))
      fireEvent.click(within(missing).getByRole('button', { name: 'Retry: get a price' }))
      fireEvent.click(await within(missing).findByRole('button', { name: 'Send leg 2 of 2' }))

      expect(await within(missing).findByText('Leg 2 of 2 of this order was already sent.')).toBeInTheDocument()
      expect(within(missing).getByRole('button', { name: 'Retry: get a price' })).toBeInTheDocument()
      expect(onChanged).not.toHaveBeenCalled()
    })
  })

  describe('AC-5, cross check 8: Cancel all', () => {
    it('cancels each leg not yet ended and skips the ended ones', async () => {
      const section = await show({
        legs: [legFixture('del-1', 1, { status: 'DROPPED_OFF', legCount: 3 }), legFixture('del-2', 2, { legCount: 3 }), legFixture('del-3', 3, { legCount: 3, status: 'ACCEPTED' })],
        missingLegNumbers: [],
      })

      fireEvent.click(within(section).getByRole('button', { name: 'Cancel all legs' }))
      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(within(dialog).getByLabelText('The customer asked to cancel'))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel all legs' }))

      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect((cancelDelivery as jest.Mock).mock.calls).toEqual([
        ['del-2', 'CUSTOMER'],
        ['del-3', 'CUSTOMER'],
      ])
    })

    it('no Cancel all once every leg has ended', async () => {
      const section = await show({
        legs: [legFixture('del-1', 1, { status: 'CANCELED' }), legFixture('del-2', 2, { status: 'FAILED' })],
        missingLegNumbers: [],
      })

      expect(within(section).queryByRole('button', { name: 'Cancel all legs' })).not.toBeInTheDocument()
    })
  })
})
