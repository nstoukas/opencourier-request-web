import { renderHook, act } from '@testing-library/react'
import { useConfirmManualRequestDeliveryMutation } from './manualRequestApi'
import { ManualRequestDeliveryInput, ManualRequestPackageSize } from '../modules/manual-request/types'

// Spec 0028 (row 103), AC-3 and its key invariant: an order with no item lines sends today's single
// "Package" item byte for byte; one with lines sends them as given.
describe('manualRequestApi orderItems on the wire (spec 0028)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-103', status: 'ACCEPTED' } })),
    } as any)
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const baseInput: ManualRequestDeliveryInput = {
    quoteId: 'quote-103',
    idempotencyKey: 'idem-103',
    pickupName: 'Nosh',
    pickupPhoneNumber: '+302421012345',
    pickupBusinessName: 'Nosh',
    pickupAddress: {
      streetAddress: ['Ermou 120'],
      city: 'Volos',
      state: 'Thessaly',
      zipCode: '38221',
      countryCode: 'GR',
    },
    pickupLatitude: 39.3628,
    pickupLongitude: 22.9435,
    dropoffName: 'Eleni Markou',
    dropoffPhoneNumber: '+306911000103',
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
    orderTotalValue: 1500,
  }

  async function sentOrderItems(input: ManualRequestDeliveryInput) {
    const { result } = renderHook(() => useConfirmManualRequestDeliveryMutation())
    const [confirmDelivery] = result.current
    await act(async () => {
      await confirmDelivery(input)
    })
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    return body.orderItems
  }

  it('with no orderItems, sends the single Package item with the chosen size (unchanged default)', async () => {
    const items = await sentOrderItems({ ...baseInput, packageSize: ManualRequestPackageSize.MEDIUM })
    expect(items).toEqual([{ name: 'Package', quantity: 1, size: 'MEDIUM' }])
  })

  it('with orderItems undefined (the form with no lines), still sends the Package item', async () => {
    const items = await sentOrderItems({
      ...baseInput,
      packageSize: ManualRequestPackageSize.LARGE,
      orderItems: undefined,
    })
    expect(items).toEqual([{ name: 'Package', quantity: 1, size: 'LARGE' }])
  })

  it('with no size, the Package item is SMALL, as before', async () => {
    const items = await sentOrderItems(baseInput)
    expect(items).toEqual([{ name: 'Package', quantity: 1, size: 'SMALL' }])
  })

  it('with lines, sends them as given, kind included', async () => {
    const lines = [
      { name: 'Souvlaki', quantity: 2, size: 'SMALL' },
      { name: 'Cola', quantity: 1, kind: 'DRINK' as const },
      { name: 'Fries', quantity: 1, kind: 'SIDE' as const },
    ]
    const items = await sentOrderItems({ ...baseInput, packageSize: ManualRequestPackageSize.SMALL, orderItems: lines })
    expect(items).toEqual(lines)
  })
})
