import React, { useRef } from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { PickedCustomerCard } from './PickedCustomerCard'
import type { SavedCustomer } from '../types'

describe('PickedCustomerCard (spec 0006, AC-11)', () => {
  const sampleCustomer: SavedCustomer = {
    id: 'cust-10',
    name: 'Katerina Sakellaropoulou',
    phone: '+306912345678',
    notes: 'Do not knock',
    addressLine1: 'Politechniou 12',
    addressLine2: 'Floor 2, Flat B',
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.362,
    longitude: 22.945,
    formattedAddress: 'Politechniou 12, Volos, 38221',
    lastUsedAt: '2026-10-26T12:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  }

  it('renders customer name, phone, street, floorAndBell, and Edit and Change buttons', () => {
    const onEdit = jest.fn()
    const onChange = jest.fn()

    render(
      <PickedCustomerCard
        customer={sampleCustomer}
        editing={false}
        onEdit={onEdit}
        onChange={onChange}
      />,
    )

    expect(screen.getByText('Katerina Sakellaropoulou')).toBeInTheDocument()
    expect(screen.getByText('+306912345678')).toBeInTheDocument()
    expect(screen.getByText('Politechniou 12, Volos, 38221')).toBeInTheDocument()
    expect(screen.getByText('Floor 2, Flat B')).toBeInTheDocument()

    const editBtn = screen.getByRole('button', { name: 'Edit' })
    const changeBtn = screen.getByRole('button', { name: 'Change' })
    expect(editBtn).toBeInTheDocument()
    expect(changeBtn).toBeInTheDocument()

    fireEvent.click(editBtn)
    expect(onEdit).toHaveBeenCalledTimes(1)

    fireEvent.click(changeBtn)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('when editing is true: shows "Saved customer. Edit the details below.", hides details and Edit button', () => {
    render(
      <PickedCustomerCard
        customer={sampleCustomer}
        editing={true}
        onEdit={jest.fn()}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByText('Katerina Sakellaropoulou')).toBeInTheDocument()
    expect(screen.getByText('Saved customer. Edit the details below.')).toBeInTheDocument()

    // Details are hidden
    expect(screen.queryByText('+306912345678')).not.toBeInTheDocument()
    expect(screen.queryByText('Politechniou 12, Volos, 38221')).not.toBeInTheDocument()
    expect(screen.queryByText('Floor 2, Flat B')).not.toBeInTheDocument()

    // Edit button is hidden, Change button remains
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
  })

  it('forwards changeRef to Change button so it can receive focus (AC-11)', () => {
    function TestWrapper() {
      const changeRef = useRef<HTMLButtonElement>(null)
      return (
        <div>
          <PickedCustomerCard
            customer={sampleCustomer}
            editing={false}
            onEdit={jest.fn()}
            onChange={jest.fn()}
            changeRef={changeRef}
          />
          <button type="button" onClick={() => changeRef.current?.focus()}>
            Focus Change
          </button>
        </div>
      )
    }

    render(<TestWrapper />)
    const changeBtn = screen.getByRole('button', { name: 'Change' })
    expect(changeBtn).not.toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Focus Change' }))
    expect(changeBtn).toHaveFocus()
  })
})
