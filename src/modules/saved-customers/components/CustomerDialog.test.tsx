import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CustomerDialog } from './CustomerDialog'
import { geocodeCoordinatesFromAddress } from '../../manual-request/utils/geocode'
import {
  addSavedCustomer,
  updateSavedCustomer,
  listSavedCustomers,
} from '../../../api/savedCustomersApi'
import type { SavedCustomer } from '../types'

jest.mock('../../manual-request/utils/geocode', () => {
  const actual = jest.requireActual('../../manual-request/utils/geocode')
  return {
    ...actual,
    geocodeCoordinatesFromAddress: jest.fn(),
  }
})

jest.mock('../../../api/savedCustomersApi', () => ({
  addSavedCustomer: jest.fn(),
  updateSavedCustomer: jest.fn(),
  listSavedCustomers: jest.fn(),
}))

describe('CustomerDialog', () => {
  const onCloseMock = jest.fn()
  const onSavedMock = jest.fn()
  const onGoneMock = jest.fn()

  const existingCustomer: SavedCustomer = {
    id: 'cust-100',
    name: 'Eleni Foureira',
    phone: '+306912345678',
    notes: 'Apt 5',
    addressLine1: 'Iasonos 45',
    addressLine2: '5th floor',
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.362,
    longitude: 22.945,
    formattedAddress: 'Iasonos 45, Volos, 38221',
    lastUsedAt: '2026-10-26T12:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('looks up hand-typed address on Save and displays "Search the address and pick a result." if geocode fails (nothing is sent)', async () => {
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue(null)

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    // Type customer name, phone, street, and city by hand
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Kostas' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '6912345678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Unknown St 99' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    const saveBtn = screen.getByRole('button', { name: /^Save$/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledTimes(1)
    })

    // Expect validation message and no API call
    expect(await screen.findByText('Search the address and pick a result.')).toBeInTheDocument()
    expect(addSavedCustomer).not.toHaveBeenCalled()
    expect(updateSavedCustomer).not.toHaveBeenCalled()

    // Typed values are preserved
    expect(screen.getByLabelText(/^Name$/i)).toHaveValue('Kostas')
    expect(screen.getByLabelText(/^Phone$/i)).toHaveValue('6912345678')
    expect(screen.getByLabelText(/Street address or PO Box/i)).toHaveValue('Unknown St 99')
  })

  it('looks up hand-typed address on Save, adopts coordinates when geocode succeeds, and saves customer', async () => {
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue({
      latitude: 39.3628,
      longitude: 22.9435,
      displayName: 'Ermou 120, Volos, Thessaly, 38221, GR',
    })

    const savedResult: SavedCustomer = {
      ...existingCustomer,
      id: 'cust-new',
      name: 'Nikos',
      phone: '2421012345',
      addressLine1: 'Ermou 120',
      city: 'Volos',
      latitude: 39.3628,
      longitude: 22.9435,
      formattedAddress: 'Ermou 120, Volos, Thessaly, 38221, GR',
    }
    ;(addSavedCustomer as jest.Mock).mockResolvedValue(savedResult)

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Nikos' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '2421012345' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Ermou 120' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledTimes(1)
      expect(addSavedCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nikos',
          phone: '2421012345',
          addressLine1: 'Ermou 120',
          city: 'Volos',
          latitude: 39.3628,
          longitude: 22.9435,
          formattedAddress: 'Ermou 120, Volos, Thessaly, 38221, GR',
        }),
      )
      expect(onSavedMock).toHaveBeenCalledWith(savedResult)
    })
  })

  it('does not re-lookup address if already pinned unless street, city or zip changed', async () => {
    ;(updateSavedCustomer as jest.Mock).mockResolvedValue({
      ...existingCustomer,
      name: 'Eleni Foureira (Updated)',
    })

    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    // Edit only name and notes (street, city, zip untouched)
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Eleni Foureira (Updated)' } })
    fireEvent.change(screen.getByLabelText(/Notes for the rider/i), { target: { value: 'New note' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(updateSavedCustomer).toHaveBeenCalledTimes(1)
    })

    // geocodeCoordinatesFromAddress was NOT called because address did not change
    expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()
    expect(onSavedMock).toHaveBeenCalledTimes(1)

    // Now edit street: geocode should be called
    jest.clearAllMocks()
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue({
      latitude: 39.37,
      longitude: 22.95,
      displayName: 'New Street 5, Volos',
    })
    ;(updateSavedCustomer as jest.Mock).mockResolvedValue({
      ...existingCustomer,
      addressLine1: 'New Street 5',
      latitude: 39.37,
      longitude: 22.95,
    })

    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'New Street 5' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledTimes(1)
      expect(updateSavedCustomer).toHaveBeenCalledTimes(1)
    })
  })

  it('a lookup on Save that returns no display name saves formattedAddress null, never the previous pick text', async () => {
    ;(updateSavedCustomer as jest.Mock).mockResolvedValue({
      ...existingCustomer,
      addressLine1: 'Dimitriadis 99',
      latitude: 39.38,
      longitude: 22.96,
      formattedAddress: null,
    })

    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue({
      latitude: 39.38,
      longitude: 22.96,
      displayName: undefined,
    })

    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Dimitriadis 99' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledTimes(1)
      expect(updateSavedCustomer).toHaveBeenCalledTimes(1)
    })

    expect(updateSavedCustomer).toHaveBeenCalledWith(
      existingCustomer.id,
      expect.objectContaining({
        addressLine1: 'Dimitriadis 99',
        latitude: 39.38,
        longitude: 22.96,
        formattedAddress: null,
      }),
    )
  })

  it('shows "Another saved customer has this phone: <name>, <phone>." on 409 clash when conflicting customer is found', async () => {
    const error409 = Object.assign(new Error('Another saved customer has this phone'), {
      statusCode: 409,
      conflictingCustomerId: 'cust-clash-888',
    })
    ;(addSavedCustomer as jest.Mock).mockRejectedValue(error409)

    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'cust-clash-888',
          name: 'Stefanos Tsitsipas',
          phone: '+306912345678',
        },
      ],
      total: 1,
    })

    // Geocode returns valid point
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue({
      latitude: 39.36,
      longitude: 22.94,
    })

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'New Person' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '+30 691 234 5678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Ermou 1' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(
      await screen.findByText(
        'Another saved customer has this phone: Stefanos Tsitsipas, +306912345678.',
      ),
    ).toBeInTheDocument()

    // Dialog stays open with typed content preserved
    expect(screen.getByLabelText(/^Name$/i)).toHaveValue('New Person')
    expect(screen.getByLabelText(/^Phone$/i)).toHaveValue('+30 691 234 5678')
  })

  it('shows "Another saved customer has this phone." on 409 clash when conflicting customer is not found in list', async () => {
    const error409 = Object.assign(new Error('Another saved customer has this phone'), {
      statusCode: 409,
      conflictingCustomerId: 'cust-unknown-999',
    })
    ;(addSavedCustomer as jest.Mock).mockRejectedValue(error409)

    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
    })

    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue({
      latitude: 39.36,
      longitude: 22.94,
    })

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'New Person' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '6912345678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Ermou 1' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(
      await screen.findByText('Another saved customer has this phone.'),
    ).toBeInTheDocument()
  })

  it('shows the backend message on a 422 error and keeps what was typed', async () => {
    const error422 = Object.assign(new Error('This address is outside the area the co-op serves'), {
      statusCode: 422,
    })
    ;(addSavedCustomer as jest.Mock).mockRejectedValue(error422)

    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue({
      latitude: 40.0,
      longitude: 23.0,
    })

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Larissa Person' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '6912345678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Larissis 5' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Larissa' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(
      await screen.findByText('This address is outside the area the co-op serves'),
    ).toBeInTheDocument()

    expect(screen.getByLabelText(/^Name$/i)).toHaveValue('Larissa Person')
    expect(screen.getByLabelText(/Street address or PO Box/i)).toHaveValue('Larissis 5')
  })

  it('calls onGone when Edit answers 404', async () => {
    const error404 = Object.assign(new Error('Customer not found'), {
      statusCode: 404,
    })
    ;(updateSavedCustomer as jest.Mock).mockRejectedValue(error404)

    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(onGoneMock).toHaveBeenCalledWith('cust-100')
    })
  })
})
