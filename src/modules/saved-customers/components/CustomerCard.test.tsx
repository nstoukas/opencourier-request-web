import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { CustomerCard } from './CustomerCard'
import { formatDateTime } from '../../../utils/format'
import type { SavedCustomer } from '../types'

// Row 99 (decision 99.1): a restaurant sees on a saved customer that a rider moved its pin, and when.
describe('CustomerCard pin moved by a rider (row 99, spec 0016)', () => {
  const baseCustomer: SavedCustomer = {
    id: 'cust-99',
    name: 'Eleni Volou',
    phone: '+306912340099',
    notes: null,
    addressLine1: 'Iasonos 10',
    addressLine2: null,
    floor: '3',
    doorbell: 'Volou',
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.362,
    longitude: 22.945,
    formattedAddress: 'Iasonos 10, Volos',
    lastUsedAt: '2026-11-01T10:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-11-03T12:32:00.000Z',
  }

  function renderCard(customer: SavedCustomer) {
    return render(<CustomerCard customer={customer} onEdit={jest.fn()} onDelete={jest.fn()} />)
  }

  it('says "Pin moved by a rider on <date and time>" with a <time dateTime> when pinMovedByRiderAt is set', () => {
    const movedAt = '2026-11-03T12:32:00.000Z'

    renderCard({ ...baseCustomer, pinMovedByRiderAt: movedAt })

    const line = screen.getByText(/Pin moved by a rider on/)
    expect(line).toHaveTextContent(`Pin moved by a rider on ${formatDateTime(movedAt)}`)
    // Athens time, day first, 24 hour clock: 12:32 UTC on 3 November is 14:32 in Volos.
    expect(line).toHaveTextContent('Pin moved by a rider on 03/11/2026, 14:32')

    const time = line.querySelector('time')
    expect(time).not.toBeNull()
    expect(time).toHaveAttribute('dateTime', movedAt)
    expect(time).toHaveTextContent(formatDateTime(movedAt))
  })

  it('shows nothing about a moved pin when pinMovedByRiderAt is null', () => {
    renderCard({ ...baseCustomer, pinMovedByRiderAt: null })

    expect(screen.queryByText(/Pin moved/i)).toBeNull()
    expect(screen.queryByTestId('pin-moved-by-rider')).toBeNull()
  })

  it('shows nothing about a moved pin when pinMovedByRiderAt is absent (an older backend)', () => {
    renderCard(baseCustomer)

    expect(screen.queryByText(/Pin moved/i)).toBeNull()
    expect(screen.queryByTestId('pin-moved-by-rider')).toBeNull()
  })

  it('still shows the name, phone and last used line beside the moved pin line', () => {
    renderCard({ ...baseCustomer, pinMovedByRiderAt: '2026-11-03T12:32:00.000Z' })

    expect(screen.getByRole('heading', { name: 'Eleni Volou' })).toBeInTheDocument()
    expect(screen.getByText('+306912340099')).toBeInTheDocument()
    expect(screen.getByText(/^used /)).toBeInTheDocument()
  })
})
