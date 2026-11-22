// Spec 0047 (AC-10): the history's order card says an order was split at pickup.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { OrderLegsCard } from './OrderLegsCard'
import { groupHistory } from '../manual-request/utils/legs'
import { PartnerDeliveryDto } from '../manual-request/types'
import { legFixture } from './legFixtures'
import { SPLIT_CHARGE_NOTE } from './splitOutcome'
import { createI18n } from '../../i18n/createI18n'

const t = createI18n('en').t

jest.mock('../../api/manualRequestApi', () => ({
  cancelDelivery: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
}))

// Draws the card for these legs, grouped the way the history page groups them.
function renderOrder(legs: PartnerDeliveryDto[]) {
  const order = groupHistory(legs).find((item) => item.kind === 'order')
  if (!order || order.kind !== 'order') throw new Error('the fixture is not a multi leg order')
  render(<OrderLegsCard order={order} onChanged={jest.fn()} />)
}

describe('OrderLegsCard after a split at pickup (spec 0047, AC-10)', () => {
  it('says "Split at pickup, now in 2 deliveries" when dispatch split the order in two', () => {
    renderOrder([
      legFixture('del-kept', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }),
      legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: 0 }),
    ])

    const card = within(screen.getByTestId('order-legs-card'))
    expect(card.getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 2 deliveries')
    // Once for the whole order, not once per leg.
    expect(card.getAllByTestId('split-outcome')).toHaveLength(1)
  })

  it('the number is the order\'s deliveries after the split, as the server sent it', () => {
    renderOrder([
      legFixture('del-1', 1, { legCount: 3, splitOutcome: 'SPLIT' }),
      legFixture('del-2', 2, { legCount: 3, splitOutcome: 'SPLIT' }),
      legFixture('del-3', 3, { legCount: 3, splitOutcome: 'SPLIT' }),
    ])

    expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 3 deliveries')
  })

  it('still says it when only one of its legs carries the mark (the other is on another page of the list)', () => {
    renderOrder([legFixture('del-kept', 1, { splitOutcome: 'SPLIT' }), legFixture('del-other', 2, { splitOutcome: null })])

    expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 2 deliveries')
  })

  // Row 11 review: an order sent as 2 deliveries whose leg 2 was split again is now 3. The sentence must be
  // true for it: split at pickup, and now in 3 deliveries (not "split into 3").
  it('an order sent as 2 with one leg split again reads "Split at pickup, now in 3 deliveries"', () => {
    renderOrder([
      legFixture('del-1', 1, { legCount: 3, splitOutcome: null }),
      legFixture('del-2', 2, { legCount: 3, splitOutcome: 'SPLIT' }),
      legFixture('del-3', 3, { legCount: 3, splitOutcome: 'SPLIT' }),
    ])

    expect(screen.getByTestId('split-outcome').textContent).toBe('Split at pickup, now in 3 deliveries')
    expect(screen.queryByText(/Split into/)).not.toBeInTheDocument()
  })

  describe('a leg the rider left because it did not fit one box (row 11 review)', () => {
    const LEFT_SENTENCE = "Cancelled: didn't fit one box, send it again with the right sizes"

    it('says the left sentence on that leg\'s own line', () => {
      renderOrder([
        legFixture('del-1', 1, { status: 'DROPPED_OFF' }),
        legFixture('del-2', 2, { status: 'CANCELED', splitOutcome: 'LEFT' }),
      ])

      const rows = within(screen.getByTestId('order-legs-card')).getAllByRole('listitem')
      // Leg 2's row carries the sentence; leg 1's does not.
      expect(within(rows[1]).getByTestId('split-outcome-left')).toHaveTextContent(LEFT_SENTENCE)
      expect(rows[1]).toHaveTextContent('Leg 2 of 2')
      expect(within(rows[0]).queryByTestId('split-outcome-left')).not.toBeInTheDocument()
      expect(screen.getAllByText(LEFT_SENTENCE)).toHaveLength(1)
    })

    it('says it once per left leg when two legs were left', () => {
      renderOrder([
        legFixture('del-1', 1, { status: 'CANCELED', splitOutcome: 'LEFT' }),
        legFixture('del-2', 2, { status: 'CANCELED', splitOutcome: 'LEFT' }),
      ])

      expect(screen.getAllByTestId('split-outcome-left')).toHaveLength(2)
    })

    it('does not call the whole order split because one leg was left', () => {
      renderOrder([legFixture('del-1', 1), legFixture('del-2', 2, { status: 'CANCELED', splitOutcome: 'LEFT' })])

      expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
      expect(screen.queryByText(/Split at pickup/)).not.toBeInTheDocument()
    })

    it('a split leg, a cancelled leg with no outcome and an ordinary leg show no left line', () => {
      renderOrder([
        legFixture('del-1', 1, { legCount: 3, splitOutcome: 'SPLIT' }),
        legFixture('del-2', 2, { legCount: 3, status: 'CANCELED', splitOutcome: null }),
        legFixture('del-3', 3, { legCount: 3 }),
      ])

      expect(screen.queryByTestId('split-outcome-left')).not.toBeInTheDocument()
    })

    it('an order with one leg split and another left says both, each in its place', () => {
      renderOrder([
        legFixture('del-1', 1, { legCount: 3, splitOutcome: 'SPLIT' }),
        legFixture('del-2', 2, { legCount: 3, splitOutcome: 'SPLIT' }),
        legFixture('del-3', 3, { legCount: 3, status: 'CANCELED', splitOutcome: 'LEFT' }),
      ])

      expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split at pickup, now in 3 deliveries')
      const rows = within(screen.getByTestId('order-legs-card')).getAllByRole('listitem')
      expect(within(rows[2]).getByTestId('split-outcome-left')).toHaveTextContent(LEFT_SENTENCE)
    })
  })

  it('says nothing for an order the restaurant sent as legs itself', () => {
    renderOrder([legFixture('del-1', 1), legFixture('del-2', 2)])

    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
    expect(screen.queryByText(/at pickup/)).not.toBeInTheDocument()
  })

  it('says nothing for an answer from an older server (no splitOutcome field)', () => {
    const first = legFixture('del-1', 1)
    const second = legFixture('del-2', 2)
    delete first.splitOutcome
    delete second.splitOutcome
    renderOrder([first, second])

    expect(screen.queryByTestId('split-outcome')).not.toBeInTheDocument()
  })

  it("the new leg costs the customer nothing more: the card's cost is the sum the server sent, 0 for the new leg", () => {
    renderOrder([
      legFixture('del-kept', 1, { splitOutcome: 'SPLIT', totalCost: 356 }),
      legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: 0 }),
    ])

    expect(screen.getByText(/Cost:/).textContent?.replace(/ /g, ' ')).toBe('Cost: €3.56')
  })

  // Decision 11.10 (operator, 2026-11-21): the card says a split brings a charge. Cross check 11: the charge
  // itself stays on the co-op's statement, so the card shows the sentence and no amount.
  describe('what the split costs the restaurant (decision 11.10)', () => {
    // Worded once, in splitOutcome.ts (its own test pins the sentence).
    const CHARGE_NOTE = t(SPLIT_CHARGE_NOTE)

    it('says the charge note once, right under the split line', () => {
      renderOrder([
        legFixture('del-kept', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }),
        legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: 0 }),
      ])

      const card = within(screen.getByTestId('order-legs-card'))
      expect(card.getAllByTestId('split-charge-note')).toHaveLength(1)
      const note = card.getByTestId('split-charge-note')
      expect(note.textContent).toBe(CHARGE_NOTE)
      // "Under the split line": the note is the very next thing after it.
      expect(card.getByTestId('split-outcome').nextElementSibling).toBe(note)
    })

    it('says it for an order sent as 2 with one leg split again', () => {
      renderOrder([
        legFixture('del-1', 1, { legCount: 3, splitOutcome: null }),
        legFixture('del-2', 2, { legCount: 3, splitOutcome: 'SPLIT' }),
        legFixture('del-3', 3, { legCount: 3, splitOutcome: 'SPLIT', totalCost: 0 }),
      ])

      expect(screen.getByTestId('split-charge-note').textContent).toBe(CHARGE_NOTE)
    })

    it('says it when the new leg has no cost yet (null, before its first offer)', () => {
      renderOrder([
        legFixture('del-kept', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }),
        legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: null }),
      ])

      expect(screen.getAllByTestId('split-charge-note')).toHaveLength(1)
      expect(screen.getByTestId('split-charge-note').textContent).toBe(CHARGE_NOTE)
    })

    it('says nothing for an order the restaurant sent as legs itself', () => {
      renderOrder([legFixture('del-1', 1), legFixture('del-2', 2)])

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      expect(screen.queryByText(/charged to you/)).not.toBeInTheDocument()
    })

    it('says nothing for an answer from an older server (no splitOutcome field)', () => {
      const first = legFixture('del-1', 1)
      const second = legFixture('del-2', 2)
      delete first.splitOutcome
      delete second.splitOutcome
      renderOrder([first, second])

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
    })

    it('says nothing when a leg was left: a left order was not split, so there is no charge to explain', () => {
      renderOrder([legFixture('del-1', 1), legFixture('del-2', 2, { status: 'CANCELED', splitOutcome: 'LEFT' })])

      expect(screen.queryByTestId('split-charge-note')).not.toBeInTheDocument()
      expect(screen.queryByText(/charged to you/)).not.toBeInTheDocument()
    })
  })
})
