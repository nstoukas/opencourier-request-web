import { renderHook, act } from '@testing-library/react'
import {
  useConfirmManualRequestDeliveryMutation,
  useCreateManualRequestQuoteMutation,
} from './manualRequestApi'
import {
  ManualRequestDeliveryInput,
  ManualRequestPackageSize,
  ManualRequestQuoteInput,
} from '../modules/manual-request/types'

// Spec 0043 (row 9, AC-4, cross check 4): boxSize on the wire.
// The delivery request built from ManualRequestDeliveryInput with boxSize LARGE carries "boxSize":"LARGE"
// in the body sent through the partner proxy; with no boxSize the body has no boxSize key (the backend
// assumes Medium and records the BOX_SIZE_ASSUMED event); the quote request never carries boxSize.
describe('manualRequestApi boxSize on the wire (spec 0043, AC-4)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-wire-test', status: 'ACCEPTED' } })),
    } as any)
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const baseDeliveryInput: ManualRequestDeliveryInput = {
    quoteId: 'quote-box-wire',
    idempotencyKey: 'idem-box-wire',
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
    orderTotalValue: 1500,
  }

  const baseQuoteInput: ManualRequestQuoteInput = {
    pickupName: baseDeliveryInput.pickupName,
    pickupBusinessName: baseDeliveryInput.pickupBusinessName,
    dropoffName: baseDeliveryInput.dropoffName,
    pickupAddress: baseDeliveryInput.pickupAddress,
    pickupLatitude: baseDeliveryInput.pickupLatitude,
    pickupLongitude: baseDeliveryInput.pickupLongitude,
    dropoffAddress: baseDeliveryInput.dropoffAddress,
    dropoffLatitude: baseDeliveryInput.dropoffLatitude,
    dropoffLongitude: baseDeliveryInput.dropoffLongitude,
    pickupPhoneNumber: baseDeliveryInput.pickupPhoneNumber,
    dropoffPhoneNumber: baseDeliveryInput.dropoffPhoneNumber,
    orderTotalValue: 1500,
  }

  async function getSentDeliveryBody(input: ManualRequestDeliveryInput): Promise<Record<string, any>> {
    const { result } = renderHook(() => useConfirmManualRequestDeliveryMutation())
    const [confirmDelivery] = result.current
    await act(async () => {
      await confirmDelivery(input)
    })
    return JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
  }

  async function getSentQuoteBody(input: ManualRequestQuoteInput): Promise<Record<string, any>> {
    const { result } = renderHook(() => useCreateManualRequestQuoteMutation())
    const [createQuote] = result.current
    await act(async () => {
      await createQuote(input)
    })
    return JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
  }

  it('delivery request with boxSize LARGE carries "boxSize":"LARGE" in the body sent through partner proxy', async () => {
    const body = await getSentDeliveryBody({
      ...baseDeliveryInput,
      boxSize: ManualRequestPackageSize.LARGE,
    })
    expect(body.boxSize).toBe('LARGE')
  })

  it('delivery request with no boxSize has no boxSize key in the body', async () => {
    const body = await getSentDeliveryBody({
      ...baseDeliveryInput,
      boxSize: undefined,
    })
    expect(body).not.toHaveProperty('boxSize')
    expect(body.boxSize).toBeUndefined()
  })

  it('the quote request never carries boxSize in the body, even if boxSize is passed', async () => {
    const body = await getSentQuoteBody({
      ...baseQuoteInput,
      ...( { boxSize: ManualRequestPackageSize.LARGE } as any ),
    })
    expect(body).not.toHaveProperty('boxSize')
    expect(body.boxSize).toBeUndefined()
  })
})
