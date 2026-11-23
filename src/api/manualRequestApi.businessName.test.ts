import { renderHook, act } from '@testing-library/react'
import {
  createDelivery,
  useConfirmManualRequestDeliveryMutation,
} from './manualRequestApi'
import {
  ManualRequestDeliveryInput,
  ManualRequestPackageSize,
} from '../modules/manual-request/types'

// Row 140 (decision 140.2): dropoffBusinessName on the wire.
// request-web stops copying the customer's name into dropoffBusinessName: it sends only what
// the restaurant typed (trimmed), or an empty string. A delivery with no business name sends '',
// never the customer's name (which would expose the customer's name in offers before accept).
describe('manualRequestApi dropoffBusinessName on the wire (row 140, decision 140.2)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-biz-test', status: 'ACCEPTED' } })),
    } as any)
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const baseDeliveryInput: ManualRequestDeliveryInput = {
    quoteId: 'quote-biz-wire',
    idempotencyKey: 'idem-biz-wire',
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
    boxSize: ManualRequestPackageSize.SMALL,
  }

  async function getSentDeliveryBody(input: ManualRequestDeliveryInput): Promise<Record<string, any>> {
    await createDelivery(input)
    const calls = (global.fetch as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1]
    return JSON.parse(lastCall[1].body)
  }

  it('(a) createDelivery in partner mode with no dropoffBusinessName sends "" and not the dropoffName', async () => {
    const body = await getSentDeliveryBody({
      ...baseDeliveryInput,
      dropoffBusinessName: undefined,
    })
    expect(body.dropoffBusinessName).toBe('')
    expect(body.dropoffBusinessName).not.toBe(baseDeliveryInput.dropoffName)
  })

  it('(b) with a business name of only spaces, sends ""', async () => {
    const body = await getSentDeliveryBody({
      ...baseDeliveryInput,
      dropoffBusinessName: '   ',
    })
    expect(body.dropoffBusinessName).toBe('')
    expect(body.dropoffBusinessName).not.toBe('   ')
    expect(body.dropoffBusinessName).not.toBe(baseDeliveryInput.dropoffName)
  })

  it('(c) with a real business name, it is sent (trimmed)', async () => {
    const body = await getSentDeliveryBody({
      ...baseDeliveryInput,
      dropoffBusinessName: '  Acme Corp  ',
    })
    expect(body.dropoffBusinessName).toBe('Acme Corp')
  })

  it('hook useConfirmManualRequestDeliveryMutation also sends "" when dropoffBusinessName is omitted', async () => {
    const { result } = renderHook(() => useConfirmManualRequestDeliveryMutation())
    const [confirmDelivery] = result.current
    await act(async () => {
      await confirmDelivery({
        ...baseDeliveryInput,
        dropoffBusinessName: undefined,
      })
    })
    const calls = (global.fetch as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1]
    const body = JSON.parse(lastCall[1].body)
    expect(body.dropoffBusinessName).toBe('')
    expect(body.dropoffBusinessName).not.toBe(baseDeliveryInput.dropoffName)
  })
})
