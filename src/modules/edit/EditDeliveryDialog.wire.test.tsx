import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditDeliveryDialog } from './EditDeliveryDialog'
import { PartnerDeliveryDto, PartnerDeliveryDropoffDto, PartnerDeliveryPickupDto } from '../manual-request/types'

// Test the EditDeliveryDialog using the REAL useUpdateManualRequestDeliveryMutation hook,
// intercepting global.fetch to assert the exact wire payload and raw JSON body.

function mockPickup(fields: Partial<PartnerDeliveryPickupDto> = {}): PartnerDeliveryPickupDto {
  return {
    id: 'pic-w1',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Volos',
    city: 'Volos',
    state: 'Magnesia',
    pickupName: 'Restaurant',
    pickupPhoneNumber: '2421000000',
    pickupBusinessName: 'Restaurant Co',
    pickupNotes: 'Stored pickup note',
    ...fields,
  }
}

function mockDropoff(fields: Partial<PartnerDeliveryDropoffDto> = {}): PartnerDeliveryDropoffDto {
  return {
    id: 'drp-w1',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Volos',
    city: 'Volos',
    state: 'Magnesia',
    dropoffName: 'Customer',
    dropoffPhoneNumber: '6900000000',
    dropoffBusinessName: '',
    dropoffNotes: 'Stored dropoff note',
    ...fields,
  }
}

function mockDelivery(fields: Partial<PartnerDeliveryDto> = {}): PartnerDeliveryDto {
  return {
    id: 'del-wire-1',
    status: 'ACCEPTED',
    orderReference: 'ORD-WIRE-1',
    currencyCode: 'EUR',
    totalCost: 500,
    createdAt: '2026-11-25T10:00:00.000Z',
    pickupReadyAt: '2026-11-25T10:15:00.000Z',
    readyAt: null,
    foodReadyAt: null,
    dropoffEta: null,
    pickupDeadlineAt: '2026-11-25T11:00:00.000Z',
    dropoffReadyAt: '2026-11-25T10:30:00.000Z',
    dropoffDeadlineAt: '2026-11-25T11:30:00.000Z',
    pickup: mockPickup(),
    dropoff: mockDropoff(),
    ...fields,
  }
}

describe('Row 178: EditDeliveryDialog with REAL hook on the wire (Requirement b raw body)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE
  const onClose = jest.fn()
  const onSaved = jest.fn()

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    jest.resetAllMocks()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ result: { id: 'del-wire-1', status: 'ACCEPTED' } }),
      ),
    } as any)
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('Requirement b: opening and saving with nothing touched sends raw body "{}" through the real hook', async () => {
    const delivery = mockDelivery()

    render(<EditDeliveryDialog delivery={delivery} onClose={onClose} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[0]).toBe('/api/partner-proxy/deliveries/del-wire-1')
    expect(fetchCall[1]?.method).toBe('POST')

    const rawBody = fetchCall[1]?.body
    const sentBody = JSON.parse(rawBody)

    // The raw body is exactly {} because all fields are undefined and dropped by JSON.stringify
    expect(rawBody).toBe('{}')
    expect(sentBody).toEqual({})
    expect(Object.keys(sentBody)).toHaveLength(0)

    // No field of any kind was sent on the wire
    expect('orderReference' in sentBody).toBe(false)
    expect('pickupNotes' in sentBody).toBe(false)
    expect('dropoffNotes' in sentBody).toBe(false)
    expect('pickupDeadlineAt' in sentBody).toBe(false)
    expect('dropoffReadyAt' in sentBody).toBe(false)
    expect('dropoffDeadlineAt' in sentBody).toBe(false)
    expect('dropoffLatitude' in sentBody).toBe(false)
    expect('dropoffLongitude' in sentBody).toBe(false)
    expect('pickupVerification' in sentBody).toBe(false)
    expect('dropoffVerification' in sentBody).toBe(false)
    expect('tipByCustomer' in sentBody).toBe(false)
    expect('pickupReadyAt' in sentBody).toBe(false)

    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('Requirement b & c: changing only orderReference sends exactly {"orderReference":"ORD-WIRE-CHANGE"} on the wire', async () => {
    const delivery = mockDelivery()

    render(<EditDeliveryDialog delivery={delivery} onClose={onClose} onSaved={onSaved} />)

    const orderRefInput = document.querySelector('#edit-order-ref') as HTMLInputElement
    fireEvent.change(orderRefInput, { target: { value: 'ORD-WIRE-CHANGE' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const rawBody = fetchCall[1]?.body
    const sentBody = JSON.parse(rawBody)

    expect(rawBody).toBe(JSON.stringify({ orderReference: 'ORD-WIRE-CHANGE' }))
    expect(sentBody).toEqual({ orderReference: 'ORD-WIRE-CHANGE' })

    // Other fields omitted
    expect('pickupNotes' in sentBody).toBe(false)
    expect('dropoffNotes' in sentBody).toBe(false)
    expect('pickupDeadlineAt' in sentBody).toBe(false)
    expect('dropoffReadyAt' in sentBody).toBe(false)
    expect('dropoffDeadlineAt' in sentBody).toBe(false)
    expect('dropoffLatitude' in sentBody).toBe(false)
    expect('dropoffLongitude' in sentBody).toBe(false)
    expect('pickupVerification' in sentBody).toBe(false)
    expect('dropoffVerification' in sentBody).toBe(false)
    expect('tipByCustomer' in sentBody).toBe(false)

    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
