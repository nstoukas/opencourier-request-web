import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteCustomerDialog } from './DeleteCustomerDialog'
import { deleteSavedCustomer } from '../../../api/savedCustomersApi'
import type { SavedCustomer } from '../types'

jest.mock('../../../api/savedCustomersApi', () => ({
  deleteSavedCustomer: jest.fn(),
}))

describe('DeleteCustomerDialog', () => {
  const onCloseMock = jest.fn()
  const onDeletedMock = jest.fn()

  const customer: SavedCustomer = {
    id: 'cust-del-1',
    name: 'Kostas Papanikolaou',
    phone: '+306933333333',
    notes: null,
    addressLine1: 'Iasonos 100',
    addressLine2: null,
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Iasonos 100, Volos',
    lastUsedAt: '2026-10-26T10:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('asks first naming the customer, and on 204 calls onDeleted', async () => {
    ;(deleteSavedCustomer as jest.Mock).mockResolvedValue(undefined)

    render(
      <DeleteCustomerDialog
        customer={customer}
        onClose={onCloseMock}
        onDeleted={onDeletedMock}
      />,
    )

    expect(screen.getByText('Delete Kostas Papanikolaou?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Their saved name, phone and address are removed for good. Past orders keep their own copy.',
      ),
    ).toBeInTheDocument()

    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(deleteSavedCustomer).toHaveBeenCalledWith('cust-del-1')
      expect(onDeletedMock).toHaveBeenCalledWith('cust-del-1')
    })
  })

  it('a 404 response on delete calls onDeleted (customer was already deleted elsewhere)', async () => {
    const error404 = Object.assign(new Error('Not found'), { statusCode: 404 })
    ;(deleteSavedCustomer as jest.Mock).mockRejectedValue(error404)

    render(
      <DeleteCustomerDialog
        customer={customer}
        onClose={onCloseMock}
        onDeleted={onDeletedMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deleteSavedCustomer).toHaveBeenCalledWith('cust-del-1')
      expect(onDeletedMock).toHaveBeenCalledWith('cust-del-1')
    })
  })

  it('a non 404 failure shows its message, does not call onDeleted, and Delete is enabled again', async () => {
    const error500 = Object.assign(new Error('Server error'), { statusCode: 500 })
    ;(deleteSavedCustomer as jest.Mock).mockRejectedValue(error500)

    render(
      <DeleteCustomerDialog
        customer={customer}
        onClose={onCloseMock}
        onDeleted={onDeletedMock}
      />,
    )

    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(deleteBtn)

    // Expect error alert message to appear
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The customer could not be deleted. Try again in a moment.')

    // onDeleted must NOT be called on a non-404 failure
    expect(onDeletedMock).not.toHaveBeenCalled()

    // Delete button is enabled again so user can retry
    expect(deleteBtn).toBeEnabled()
  })
})
