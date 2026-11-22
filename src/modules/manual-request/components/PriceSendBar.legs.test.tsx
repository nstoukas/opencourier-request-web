// Spec 0046 (AC-2, cross check 7): the total before Confirm, in the price bar.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { PriceSendBar, BarPhase } from './PriceSendBar'
import { ManualRequestQuoteDto } from '../types'

const plain = (text: string | null | undefined) => (text ?? '').replace(/ /g, ' ')

const quote = (id: string, cents: number): ManualRequestQuoteDto => ({
  id,
  quoteRangeFrom: cents,
  quoteRangeTo: cents,
  currency: 'EUR',
  duration: 15,
  distance: 2.4,
  distanceUnit: 'km',
  expiresAt: '2026-11-21T12:30:00.000Z',
  dropoffEta: null,
  createdAt: '2026-11-21T12:00:00.000Z',
})

const props = {
  phase: 'priced' as BarPhase,
  pricedAddress: 'Iasonos 80, Volos',
  error: null,
  disabled: false,
  onSend: jest.fn(),
  onHeightChange: jest.fn(),
}

describe('PriceSendBar on a multi leg order (spec 0046, AC-2)', () => {
  it('two boxes at the same price show "2 deliveries × €3.80 = €7.60" with Send order', () => {
    const quotes = [quote('q1', 380), quote('q2', 380)]
    render(<PriceSendBar {...props} quote={quotes[0]} quotes={quotes} />)

    expect(plain(screen.getByTestId('leg-total').textContent)).toBe('2 deliveries × €3.80 = €7.60')
    expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
  })

  it('cross check 7: prices that differ show one line per leg and the total', () => {
    const quotes = [quote('q1', 356), quote('q2', 392)]
    render(<PriceSendBar {...props} quote={quotes[0]} quotes={quotes} />)

    const lines = within(screen.getByTestId('leg-total'))
      .getAllByText(/./)
      .map((line) => plain(line.textContent))
    expect(lines).toEqual(['Leg 1 of 2: €3.56', 'Leg 2 of 2: €3.92', 'Total €7.48'])
  })

  // Row 10 review (decision 10.4 changed): the big figure is what the customer pays.
  describe('the big price', () => {
    const bigPrice = () => plain(document.querySelector('.text-2xl')?.textContent)

    it('for two legs is the legs\' total', () => {
      const quotes = [quote('q1', 380), quote('q2', 380)]
      render(<PriceSendBar {...props} quote={quotes[0]} quotes={quotes} />)

      expect(bigPrice()).toBe('€7.60')
    })

    it('for legs priced differently is still their sum', () => {
      const quotes = [quote('q1', 356), quote('q2', 392), quote('q3', 400)]
      render(<PriceSendBar {...props} quote={quotes[0]} quotes={quotes} />)

      expect(bigPrice()).toBe('€11.48')
    })

    it('for one box is that delivery\'s own price', () => {
      const only = quote('q1', 380)
      render(<PriceSendBar {...props} quote={only} quotes={[only]} />)

      expect(bigPrice()).toBe('€3.80')
    })

    it('for a caller that passes no quotes is the single price, as before', () => {
      render(<PriceSendBar {...props} quote={quote('q1', 380)} />)

      expect(bigPrice()).toBe('€3.80')
    })

    it('a single delivery priced as a range still shows the range', () => {
      const ranged = { ...quote('q1', 350), quoteRangeTo: 450 }
      render(<PriceSendBar {...props} quote={ranged} quotes={[ranged]} />)

      expect(bigPrice()).toBe('€3.50 – €4.50')
    })
  })

  it('one box shows no total line', () => {
    const only = quote('q1', 380)
    render(<PriceSendBar {...props} quote={only} quotes={[only]} />)

    expect(screen.queryByTestId('leg-total')).not.toBeInTheDocument()
  })

  it('a caller that passes no quotes (a single box, as before) shows no total line', () => {
    render(<PriceSendBar {...props} quote={quote('q1', 380)} />)

    expect(screen.queryByTestId('leg-total')).not.toBeInTheDocument()
  })

  it('an expired price shows no total, only that it expired', () => {
    const quotes = [quote('q1', 380), quote('q2', 380)]
    render(<PriceSendBar {...props} phase="expired" quote={quotes[0]} quotes={quotes} />)

    expect(screen.getByText('This price has expired')).toBeInTheDocument()
    expect(screen.queryByTestId('leg-total')).not.toBeInTheDocument()
  })
})
