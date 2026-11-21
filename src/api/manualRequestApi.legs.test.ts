// Spec 0046 (row 10, AC-2, AC-3, AC-5): the leg labels on the wire. mapDeliveryInputForPartner builds the
// partner body field by field, so a field not named there never reaches the backend while every test that
// mocks the hook stays green (row 9 lost boxSize that way). These tests read the body fetch was given.
import { renderHook, act } from '@testing-library/react'
import {
  cancelDelivery,
  createDelivery,
  fetchOrderLegs,
  requestQuote,
  useConfirmManualRequestDeliveryMutation,
} from './manualRequestApi'
import { ManualRequestDeliveryInput, ManualRequestPackageSize } from '../modules/manual-request/types'

describe('manualRequestApi: multi leg orders on the wire (spec 0046)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-wire', status: 'CREATED' } })),
    } as any)
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const base: ManualRequestDeliveryInput = {
    quoteId: 'quote-leg-2',
    idempotencyKey: 'quote-leg-2-1-2',
    pickupName: 'Nosh',
    pickupPhoneNumber: '+302421012345',
    pickupBusinessName: 'Nosh',
    pickupAddress: { streetAddress: ['Ermou 120'], city: 'Volos', state: 'Thessaly', zipCode: '38221', countryCode: 'GR' },
    pickupLatitude: 39.3628,
    pickupLongitude: 22.9435,
    dropoffName: 'Vassilis Spanoulis',
    dropoffPhoneNumber: '+306911223344',
    dropoffAddress: {
      streetAddress: ['Iasonos 80'],
      houseNumber: '',
      city: 'Volos',
      state: 'Thessaly',
      zipCode: '38221',
      countryCode: 'GR',
    },
    dropoffLatitude: 39.361,
    dropoffLongitude: 22.942,
    orderTotalValue: 0,
    boxSize: ManualRequestPackageSize.SMALL,
    orderReference: 'quote-leg-1',
  }

  const call = (index = 0) => (global.fetch as jest.Mock).mock.calls[index]
  const sentBody = (index = 0): Record<string, any> => JSON.parse(call(index)[1].body)

  it('a leg\'s create carries legNumber, legCount and the shared orderReference in the partner body', async () => {
    await createDelivery({ ...base, legNumber: 2, legCount: 2 })

    expect(String(call()[0])).toMatch(/\/deliveries$/)
    expect(call()[1].method).toBe('POST')
    expect(sentBody()).toMatchObject({
      legNumber: 2,
      legCount: 2,
      orderReference: 'quote-leg-1',
      quoteId: 'quote-leg-2',
      idempotencyKey: 'quote-leg-2-1-2',
      boxSize: 'SMALL',
      orderTotalValue: 0,
    })
  })

  it('the hook the form uses sends the same labels', async () => {
    const { result } = renderHook(() => useConfirmManualRequestDeliveryMutation())
    await act(async () => {
      await result.current[0]({ ...base, legNumber: 1, legCount: 3 })
    })

    expect(sentBody()).toMatchObject({ legNumber: 1, legCount: 3 })
  })

  it('a single delivery has neither key in its body', async () => {
    await createDelivery(base)

    expect(sentBody()).not.toHaveProperty('legNumber')
    expect(sentBody()).not.toHaveProperty('legCount')
  })

  it('a quote never carries the labels (each leg is priced as an ordinary delivery)', async () => {
    await requestQuote({ ...base, ...({ legNumber: 1, legCount: 2 } as any) })

    expect(String(call()[0])).toMatch(/\/delivery-quotes$/)
    expect(sentBody()).not.toHaveProperty('legNumber')
    expect(sentBody()).not.toHaveProperty('legCount')
  })

  it('AC-5: cancelDelivery posts to that leg\'s own cancel route with who asked', async () => {
    await cancelDelivery('del-leg-2', 'CUSTOMER')

    expect(String(call()[0])).toMatch(/\/deliveries\/del-leg-2\/cancel$/)
    expect(call()[1].method).toBe('POST')
    expect(sentBody()).toEqual({ cancelledBy: 'CUSTOMER' })
  })

  it('AC-3, AC-6: fetchOrderLegs reads GET /deliveries/:id/order-legs', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: { legs: [{ id: 'del-1' }], missingLegNumbers: [2] } })),
    })

    const answer = await fetchOrderLegs('del-1')

    expect(String(call()[0])).toMatch(/\/deliveries\/del-1\/order-legs$/)
    expect(call()[1]?.method ?? 'GET').toBe('GET')
    expect(answer).toEqual({ legs: [{ id: 'del-1' }], missingLegNumbers: [2] })
  })
})
