// Spec 0047 (AC-10): the history's order card says an order was split at pickup.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { OrderLegsCard } from './OrderLegsCard'
import { groupHistory } from '../manual-request/utils/legs'
import { PartnerDeliveryDto } from '../manual-request/types'
import { legFixture } from './legFixtures'

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
  it('says "Split into 2 at pickup" when dispatch split the order in two', () => {
    renderOrder([
      legFixture('del-kept', 1, { status: 'PICKED_UP', splitOutcome: 'SPLIT' }),
      legFixture('del-new', 2, { splitOutcome: 'SPLIT', totalCost: 0 }),
    ])

    const card = within(screen.getByTestId('order-legs-card'))
    expect(card.getByTestId('split-outcome')).toHaveTextContent('Split into 2 at pickup')
    // Once for the whole order, not once per leg.
    expect(card.getAllByTestId('split-outcome')).toHaveLength(1)
  })

  it('the number is the order\'s deliveries after the split, as the server sent it', () => {
    renderOrder([
      legFixture('del-1', 1, { legCount: 3, splitOutcome: 'SPLIT' }),
      legFixture('del-2', 2, { legCount: 3, splitOutcome: 'SPLIT' }),
      legFixture('del-3', 3, { legCount: 3, splitOutcome: 'SPLIT' }),
    ])

    expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split into 3 at pickup')
  })

  it('still says it when only one of its legs carries the mark (the other is on another page of the list)', () => {
    renderOrder([legFixture('del-kept', 1, { splitOutcome: 'SPLIT' }), legFixture('del-other', 2, { splitOutcome: null })])

    expect(screen.getByTestId('split-outcome')).toHaveTextContent('Split into 2 at pickup')
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

    expect(screen.getByText(/Cost:/).textContent?.replace(/ /g, ' ')).toBe('Cost: 3,56 €')
  })
})
