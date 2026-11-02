import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import {
  CustomerDialog,
  CONFIRM_PIN_MESSAGE,
  MOVE_FALLBACK_FIRST,
} from './CustomerDialog'
import {
  lookUpPinForAddress,
  ADDRESS_NOT_FOUND_ON_MAP,
  geocodeCoordinatesFromAddress,
} from '../../manual-request/utils/geocode'
import {
  addSavedCustomer,
  updateSavedCustomer,
  listSavedCustomers,
} from '../../../api/savedCustomersApi'
import type { SavedCustomer } from '../types'
import { FLOOR_MAX, DOORBELL_MAX } from '../../manual-request/utils/orderForm'

// Mock geocode utilities
jest.mock('../../manual-request/utils/geocode', () => {
  const actual = jest.requireActual('../../manual-request/utils/geocode')
  return {
    ...actual,
    lookUpPinForAddress: jest.fn(),
    geocodeCoordinatesFromAddress: jest.fn(),
  }
})

// Mock PinMapCanvas so Leaflet ESM is not imported under jsdom
jest.mock('../../manual-request/components/PinMapCanvas', () => ({
  PinMapCanvas: ({ center, onUserMove }: any) => (
    <div
      data-testid="mock-pin-map-canvas"
      data-center={JSON.stringify(center)}
      onClick={() => onUserMove({ latitude: 39.365, longitude: 22.945 })}
    >
      Canvas
    </div>
  ),
}))

jest.mock('../../../api/savedCustomersApi', () => ({
  addSavedCustomer: jest.fn(),
  updateSavedCustomer: jest.fn(),
  listSavedCustomers: jest.fn(),
}))

describe('CustomerDialog (spec 0016, AC-1, AC-3, AC-6 & review fixes)', () => {
  const onCloseMock = jest.fn()
  const onSavedMock = jest.fn()
  const onGoneMock = jest.fn()

  const existingCustomer: SavedCustomer = {
    id: 'cust-100',
    name: 'Eleni Foureira',
    phone: '+306912345678',
    notes: 'Apt 5',
    addressLine1: 'Iasonos 45',
    addressLine2: null,
    floor: '5',
    doorbell: 'Foureira',
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
    jest.clearAllMocks()
  })

  it('Add customer: Save is refused with "Confirm the pin on the map" until confirmed and never calls backend before', async () => {
    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Kostas' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '6912345678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Ermou 120' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    // Save attempted without map pin
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(await screen.findByText(CONFIRM_PIN_MESSAGE)).toBeInTheDocument()
    expect(addSavedCustomer).not.toHaveBeenCalled()
    expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()

    // Click Show on map
    ;(lookUpPinForAddress as jest.Mock).mockResolvedValue({
      point: { latitude: 39.3628, longitude: 22.9435 },
      formattedAddress: 'Ermou 120, Volos',
      message: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

    // PinMap appears with confirm button
    const confirmBtn = await screen.findByRole('button', { name: 'Pin is on the entrance' })
    expect(confirmBtn).toBeInTheDocument()

    // Save still refused before clicking confirm
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    expect(await screen.findByText(CONFIRM_PIN_MESSAGE)).toBeInTheDocument()
    expect(addSavedCustomer).not.toHaveBeenCalled()

    // Confirm the pin
    fireEvent.click(confirmBtn)
    expect(await screen.findByText('Pin confirmed')).toBeInTheDocument()

    // Now Save succeeds
    const savedCustomer: SavedCustomer = {
      ...existingCustomer,
      id: 'cust-new-1',
      name: 'Kostas',
      phone: '6912345678',
      addressLine1: 'Ermou 120',
      floor: null,
      doorbell: null,
      latitude: 39.3628,
      longitude: 22.9435,
    }
    ;(addSavedCustomer as jest.Mock).mockResolvedValue(savedCustomer)

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(addSavedCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kostas',
          phone: '6912345678',
          addressLine1: 'Ermou 120',
          city: 'Volos',
          latitude: 39.3628,
          longitude: 22.9435,
          floor: null,
          doorbell: null,
        }),
      )
    })
    expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()
    expect(onSavedMock).toHaveBeenCalledWith(savedCustomer)
  })

  it('Edit customer: unchanged customer saves without confirming and never calls Nominatim', async () => {
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

    // Initially loads confirmed
    expect(screen.getByText('Pin confirmed')).toBeInTheDocument()

    // Edit only name
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Eleni Foureira (Updated)' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(updateSavedCustomer).toHaveBeenCalledWith(
        existingCustomer.id,
        expect.objectContaining({
          name: 'Eleni Foureira (Updated)',
          addressLine1: 'Iasonos 45',
          latitude: 39.362,
          longitude: 22.945,
          floor: '5',
          doorbell: 'Foureira',
        }),
      )
    })
    expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()
    expect(onSavedMock).toHaveBeenCalledTimes(1)
  })

  it('Edit customer: changing street clears point and formattedAddress, requiring new lookup and confirm', async () => {
    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    expect(screen.getByText('Pin confirmed')).toBeInTheDocument()

    // Change street: map disappears and Show on map button reappears
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Kartali 5' } })

    expect(screen.queryByText('Pin confirmed')).not.toBeInTheDocument()
    const showOnMapBtn = await screen.findByRole('button', { name: 'Show on map' })
    expect(showOnMapBtn).toBeInTheDocument()

    // Attempt Save: refused
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    expect(await screen.findByText(CONFIRM_PIN_MESSAGE)).toBeInTheDocument()
    expect(updateSavedCustomer).not.toHaveBeenCalled()

    // Lookup not found path (item 8: stale address text cleared)
    ;(lookUpPinForAddress as jest.Mock).mockResolvedValue({
      point: { latitude: 39.3622, longitude: 22.9425 },
      formattedAddress: null,
      message: ADDRESS_NOT_FOUND_ON_MAP,
    })

    fireEvent.click(showOnMapBtn)

    // Map opens at fallback with ADDRESS_NOT_FOUND_ON_MAP
    expect(await screen.findByText(ADDRESS_NOT_FOUND_ON_MAP)).toBeInTheDocument()

    // Move map
    fireEvent.click(screen.getByTestId('mock-pin-map-canvas'))

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: 'Pin is on the entrance' }))
    expect(await screen.findByText('Pin confirmed')).toBeInTheDocument()

    ;(updateSavedCustomer as jest.Mock).mockResolvedValue({ ...existingCustomer, addressLine1: 'Kartali 5' })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(updateSavedCustomer).toHaveBeenCalledWith(
        existingCustomer.id,
        expect.objectContaining({
          addressLine1: 'Kartali 5',
          formattedAddress: null, // item 8: stale formattedAddress was cleared, not carried over!
        }),
      )
    })
  })

  it('item 9: an answer from Show on map that arrives after the street was edited is ignored', async () => {
    let resolveLookup: (val: any) => void
    const lookupPromise = new Promise((resolve) => {
      resolveLookup = resolve
    })
    ;(lookUpPinForAddress as jest.Mock).mockReturnValue(lookupPromise)

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'User' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '6912345678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Street A' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

    await waitFor(() => {
      expect(lookUpPinForAddress).toHaveBeenCalled()
    })

    // While lookup is running, user edits street to 'Street B'
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Street B' } })

    // Lookup finishes for Street A
    act(() => {
      resolveLookup!({
        point: { latitude: 39.38, longitude: 22.98 },
        formattedAddress: 'Street A, Volos',
        message: null,
      })
    })

    await waitFor(() => {
      // PinMap should NOT have mounted for Street A's point; Show on map button stays
      expect(screen.getByRole('button', { name: 'Show on map' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Pin is on the entrance' })).not.toBeInTheDocument()
    })
  })

  it('item 10: after "Address not found", confirming is refused with MOVE_FALLBACK_FIRST until the map is moved', async () => {
    ;(lookUpPinForAddress as jest.Mock).mockResolvedValue({
      point: { latitude: 39.3622, longitude: 22.9425 },
      formattedAddress: null,
      message: ADDRESS_NOT_FOUND_ON_MAP,
    })

    render(
      <CustomerDialog
        customer={null}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Nikos' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '6912345678' } })
    fireEvent.change(screen.getByLabelText(/Street address or PO Box/i), { target: { value: 'Nowhere' } })
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Volos' } })

    fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

    const confirmBtn = await screen.findByRole('button', { name: 'Pin is on the entrance' })
    expect(confirmBtn).toBeInTheDocument()

    // Click confirm before moving the map
    fireEvent.click(confirmBtn)

    expect(await screen.findByText(MOVE_FALLBACK_FIRST)).toBeInTheDocument()
    expect(screen.queryByText('Pin confirmed')).not.toBeInTheDocument()

    // Move the map
    fireEvent.click(screen.getByTestId('mock-pin-map-canvas'))

    // Now confirm succeeds
    fireEvent.click(confirmBtn)
    expect(await screen.findByText('Pin confirmed')).toBeInTheDocument()
    expect(screen.queryByText(MOVE_FALLBACK_FIRST)).not.toBeInTheDocument()
  })

  it('item 11: Floor and Name on the doorbell show LimitCounter and refuse lengths over limits', async () => {
    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    // Floor counter (limit 20, shown at 80% = 16)
    const floorInput = screen.getByLabelText(/Floor/i)
    fireEvent.change(floorInput, { target: { value: '1234567890123456' } }) // 16 chars
    expect(screen.getByText('16 / 20')).toBeInTheDocument()

    fireEvent.change(floorInput, { target: { value: '123456789012345678901' } }) // 21 chars
    const overLimitCounter = screen.getByText('21 / 20')
    expect(overLimitCounter).toBeInTheDocument()
    expect(overLimitCounter).toHaveClass('text-destructive')

    // Doorbell counter (limit 60, shown at 80% = 48)
    const doorbellInput = screen.getByLabelText(/Name on the doorbell/i)
    fireEvent.change(doorbellInput, { target: { value: 'd'.repeat(50) } })
    expect(screen.getByText('50 / 60')).toBeInTheDocument()

    // Save with over-limit fields
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(await screen.findByText(`Keep this to ${FLOOR_MAX} characters`)).toBeInTheDocument()
    expect(updateSavedCustomer).not.toHaveBeenCalled()
  })

  it('shows 409 clash message when phone is taken by another saved customer', async () => {
    const error409 = Object.assign(new Error('Another saved customer has this phone'), {
      statusCode: 409,
      conflictingCustomerId: 'cust-clash-888',
    })
    ;(updateSavedCustomer as jest.Mock).mockRejectedValue(error409)

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

    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(
      await screen.findByText(
        'Another saved customer has this phone: Stefanos Tsitsipas, +306912345678.',
      ),
    ).toBeInTheDocument()
  })

  it('shows 422 server message and keeps what was typed', async () => {
    const error422 = Object.assign(new Error('This address is outside the area the co-op serves'), {
      statusCode: 422,
    })
    ;(updateSavedCustomer as jest.Mock).mockRejectedValue(error422)

    render(
      <CustomerDialog
        customer={existingCustomer}
        onClose={onCloseMock}
        onSaved={onSavedMock}
        onGone={onGoneMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    expect(
      await screen.findByText('This address is outside the area the co-op serves'),
    ).toBeInTheDocument()

    expect(screen.getByLabelText(/^Name$/i)).toHaveValue('Eleni Foureira')
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
