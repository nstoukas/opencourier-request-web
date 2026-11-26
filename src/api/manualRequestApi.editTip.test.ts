// Row 169 (decision 169.1): the portal's edit keeps the tip as it is.
// The update body sent by useUpdateManualRequestDeliveryMutation must carry NO tipByCustomer
// key at all (not 0, not undefined serialised), so the backend keeps the stored tip.
// It also verifies that fields the edit does send still arrive on the wire.
import { renderHook, act } from '@testing-library/react'
import { useUpdateManualRequestDeliveryMutation } from './manualRequestApi'
import {
  ManualRequestUpdateDeliveryInput,
  PartnerDeliveryDto,
} from '../modules/manual-request/types'

describe('manualRequestApi: portal edit sends no tip on the wire (Row 169, decision 169.1)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    // Default mock response: partner API returns standard wrapped delivery result.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ result: { id: 'del-edit-123', status: 'ACCEPTED' } }),
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

  const baseUpdateInput: ManualRequestUpdateDeliveryInput = {
    deliveryId: 'del-edit-123',
    orderReference: 'ORD-123',
    pickupNotes: 'Pickup at side entrance',
    pickupReadyAt: '2026-11-25T14:30:00.000Z',
    pickupDeadlineAt: '2026-11-25T15:00:00.000Z',
    dropoffNotes: 'Floor 3, doorbell Papadopoulos',
    dropoffReadyAt: '2026-11-25T14:45:00.000Z',
    dropoffDeadlineAt: '2026-11-25T15:15:00.000Z',
  }

  async function callUpdateDelivery(input: ManualRequestUpdateDeliveryInput): Promise<{
    result: PartnerDeliveryDto
    sentUrl: string
    sentMethod: string
    sentBody: Record<string, any>
    rawBody: string
  }> {
    const { result } = renderHook(() => useUpdateManualRequestDeliveryMutation())
    const [updateDelivery] = result.current
    let output!: PartnerDeliveryDto
    await act(async () => {
      output = await updateDelivery(input)
    })
    const calls = (global.fetch as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1]
    const rawBody = lastCall[1]?.body
    return {
      result: output,
      sentUrl: lastCall[0],
      sentMethod: lastCall[1]?.method,
      sentBody: JSON.parse(rawBody),
      rawBody,
    }
  }

  it('portal edit sends NO tipByCustomer key at all in the JSON body (Row 169, decision 169.1)', async () => {
    const { sentUrl, sentMethod, sentBody, rawBody, result } = await callUpdateDelivery(baseUpdateInput)

    // Wire endpoint and method
    expect(sentUrl).toBe('/api/partner-proxy/deliveries/del-edit-123')
    expect(sentMethod).toBe('POST')

    // Pin row 169: tipByCustomer key must be completely absent from the parsed body
    expect('tipByCustomer' in sentBody).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(sentBody, 'tipByCustomer')).toBe(false)
    expect(Object.keys(sentBody)).not.toContain('tipByCustomer')
    expect(sentBody).not.toHaveProperty('tipByCustomer')
    expect(sentBody.tipByCustomer).toBeUndefined()

    // Also assert it is not in the raw serialized JSON string
    expect(rawBody).not.toMatch(/"tipByCustomer"/)

    // Returned result from the backend
    expect(result).toEqual({ id: 'del-edit-123', status: 'ACCEPTED' })
  })

  it('fields that the edit does send still arrive on the wire', async () => {
    const { sentBody } = await callUpdateDelivery(baseUpdateInput)

    expect(sentBody.orderReference).toBe('ORD-123')
    expect(sentBody.pickupNotes).toBe('Pickup at side entrance')
    expect(sentBody.dropoffNotes).toBe('Floor 3, doorbell Papadopoulos')
    expect(sentBody.pickupReadyAt).toBe('2026-11-25T14:30:00.000Z')
    expect(sentBody.pickupDeadlineAt).toBe('2026-11-25T15:00:00.000Z')
    expect(sentBody.dropoffReadyAt).toBe('2026-11-25T14:45:00.000Z')
    expect(sentBody.dropoffDeadlineAt).toBe('2026-11-25T15:15:00.000Z')

    // Row 178: no point and no verification rules sent on wire
    expect('dropoffLatitude' in sentBody).toBe(false)
    expect('dropoffLongitude' in sentBody).toBe(false)
    expect('pickupVerification' in sentBody).toBe(false)
    expect('dropoffVerification' in sentBody).toBe(false)
    expect('tipByCustomer' in sentBody).toBe(false)
  })

  it('untouched times (undefined) are omitted from the wire body while tip remains absent (Row 168 / 169)', async () => {
    const { sentBody, rawBody } = await callUpdateDelivery({
      ...baseUpdateInput,
      pickupReadyAt: undefined,
      pickupDeadlineAt: undefined,
      dropoffReadyAt: undefined,
      dropoffDeadlineAt: undefined,
    })

    // Untouched times are omitted from the wire body so the server keeps stored times
    expect('pickupReadyAt' in sentBody).toBe(false)
    expect('pickupDeadlineAt' in sentBody).toBe(false)
    expect('dropoffReadyAt' in sentBody).toBe(false)
    expect('dropoffDeadlineAt' in sentBody).toBe(false)
    expect(rawBody).not.toMatch(/"pickupReadyAt"/)
    expect(rawBody).not.toMatch(/"pickupDeadlineAt"/)
    expect(rawBody).not.toMatch(/"dropoffReadyAt"/)
    expect(rawBody).not.toMatch(/"dropoffDeadlineAt"/)

    // And tipByCustomer is still absent
    expect('tipByCustomer' in sentBody).toBe(false)
    expect(rawBody).not.toMatch(/"tipByCustomer"/)
  })

  it('cleared times (null) are sent as null on the wire while tip remains absent', async () => {
    const { sentBody } = await callUpdateDelivery({
      ...baseUpdateInput,
      pickupDeadlineAt: null,
      dropoffReadyAt: null,
      dropoffDeadlineAt: null,
    })

    // Cleared times explicitly send null so server removes deadline/time
    expect(sentBody.pickupDeadlineAt).toBeNull()
    expect(sentBody.dropoffReadyAt).toBeNull()
    expect(sentBody.dropoffDeadlineAt).toBeNull()

    // And tipByCustomer is still absent
    expect('tipByCustomer' in sentBody).toBe(false)
  })

  it('empty reference and notes are sent as empty strings and do not introduce tipByCustomer', async () => {
    const { sentBody } = await callUpdateDelivery({
      ...baseUpdateInput,
      orderReference: '',
      pickupNotes: '',
      dropoffNotes: '',
    })

    expect(sentBody.orderReference).toBe('')
    expect(sentBody.pickupNotes).toBe('')
    expect(sentBody.dropoffNotes).toBe('')
    expect('tipByCustomer' in sentBody).toBe(false)
  })

  it('tracks isLoading state transitions during execution', async () => {
    let resolveFetch: (val: any) => void
    const fetchPromise = new Promise(resolve => {
      resolveFetch = resolve
    })
    global.fetch = jest.fn().mockReturnValue(fetchPromise)

    const { result } = renderHook(() => useUpdateManualRequestDeliveryMutation())
    const [updateDelivery] = result.current
    expect(result.current[1].isLoading).toBe(false)

    let updatePromise: Promise<any>
    act(() => {
      updatePromise = updateDelivery(baseUpdateInput)
    })
    expect(result.current[1].isLoading).toBe(true)

    await act(async () => {
      resolveFetch!({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-edit-123', status: 'ACCEPTED' } })),
      })
      await updatePromise
    })
    expect(result.current[1].isLoading).toBe(false)
  })

  it('throws an error if apiMode is not partner', async () => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'direct'

    const { result } = renderHook(() => useUpdateManualRequestDeliveryMutation())
    const [updateDelivery] = result.current

    let caughtError: any
    await act(async () => {
      try {
        await updateDelivery(baseUpdateInput)
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeDefined()
    expect(caughtError.message).toBe('Updating deliveries is only supported in partner API mode.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('propagates server refusal error from the proxy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: jest.fn().mockResolvedValue({
        error: true,
        result: [{
          message: 'The order has changed.',
          code: 'PARTNER_EDIT_CHANGED',
          statusCode: 409,
        }],
      }),
    } as any)

    const { result } = renderHook(() => useUpdateManualRequestDeliveryMutation())
    const [updateDelivery] = result.current

    let caughtError: any
    await act(async () => {
      try {
        await updateDelivery(baseUpdateInput)
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeDefined()
    expect(caughtError.message).toBe('The order has changed.')
    expect(caughtError.code).toBe('PARTNER_EDIT_CHANGED')
    expect(caughtError.statusCode).toBe(409)
  })

  it('propagates network failure from fetch', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network connection lost'))

    const { result } = renderHook(() => useUpdateManualRequestDeliveryMutation())
    const [updateDelivery] = result.current

    let caughtError: any
    await act(async () => {
      try {
        await updateDelivery(baseUpdateInput)
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeDefined()
    expect(caughtError.message).toBe('Network connection lost')
  })
})

describe('manualRequestApi: portal edit sends only what changed on wire (Row 178)', () => {
  const originalFetch = global.fetch
  const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ result: { id: 'del-178', status: 'ACCEPTED' } }),
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

  async function callUpdateDelivery(input: ManualRequestUpdateDeliveryInput) {
    const { result } = renderHook(() => useUpdateManualRequestDeliveryMutation())
    const [updateDelivery] = result.current
    let output!: PartnerDeliveryDto
    await act(async () => {
      output = await updateDelivery(input)
    })
    const calls = (global.fetch as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1]
    const rawBody = lastCall[1]?.body
    return {
      result: output,
      sentUrl: lastCall[0],
      sentMethod: lastCall[1]?.method,
      sentBody: JSON.parse(rawBody),
      rawBody,
    }
  }

  it('Requirement a: wire JSON body has no pickupVerification, dropoffVerification, dropoffLatitude, dropoffLongitude or tipByCustomer key', async () => {
    const input: ManualRequestUpdateDeliveryInput = {
      deliveryId: 'del-178',
      orderReference: 'ORD-999',
      pickupNotes: 'Pickup note',
      dropoffNotes: 'Dropoff note',
      pickupDeadlineAt: '2026-11-26T12:00:00.000Z',
      dropoffReadyAt: '2026-11-26T12:30:00.000Z',
      dropoffDeadlineAt: '2026-11-26T13:00:00.000Z',
    }

    const { sentBody, rawBody } = await callUpdateDelivery(input)

    // Verification keys are never sent (deleted SAFE_VERIFICATION_DEFAULT)
    expect('pickupVerification' in sentBody).toBe(false)
    expect('dropoffVerification' in sentBody).toBe(false)
    expect(rawBody).not.toMatch(/"pickupVerification"/)
    expect(rawBody).not.toMatch(/"dropoffVerification"/)

    // Coordinates are never sent (deleted dropoff coordinates from edit)
    expect('dropoffLatitude' in sentBody).toBe(false)
    expect('dropoffLongitude' in sentBody).toBe(false)
    expect(rawBody).not.toMatch(/"dropoffLatitude"/)
    expect(rawBody).not.toMatch(/"dropoffLongitude"/)

    // Tip is never sent (row 169)
    expect('tipByCustomer' in sentBody).toBe(false)
    expect(rawBody).not.toMatch(/"tipByCustomer"/)
  })

  it('Requirement a: with orderReference/pickupNotes/dropoffNotes undefined the raw body has none of those keys', async () => {
    const input: ManualRequestUpdateDeliveryInput = {
      deliveryId: 'del-178',
      orderReference: undefined,
      pickupNotes: undefined,
      dropoffNotes: undefined,
      pickupDeadlineAt: '2026-11-26T12:00:00.000Z',
    }

    const { sentBody, rawBody } = await callUpdateDelivery(input)

    expect('orderReference' in sentBody).toBe(false)
    expect('pickupNotes' in sentBody).toBe(false)
    expect('dropoffNotes' in sentBody).toBe(false)
    expect(rawBody).not.toMatch(/"orderReference"/)
    expect(rawBody).not.toMatch(/"pickupNotes"/)
    expect(rawBody).not.toMatch(/"dropoffNotes"/)

    // Provided time still arrives
    expect(sentBody.pickupDeadlineAt).toBe('2026-11-26T12:00:00.000Z')
  })

  it('Requirement a: a save with nothing changed sends exactly {}', async () => {
    // Only deliveryId is required to identify the delivery; all editable fields left out / undefined
    const input: ManualRequestUpdateDeliveryInput = {
      deliveryId: 'del-178',
      orderReference: undefined,
      pickupNotes: undefined,
      pickupReadyAt: undefined,
      pickupDeadlineAt: undefined,
      dropoffNotes: undefined,
      dropoffReadyAt: undefined,
      dropoffDeadlineAt: undefined,
    }

    const { sentBody, rawBody, sentUrl, sentMethod } = await callUpdateDelivery(input)

    expect(sentUrl).toBe('/api/partner-proxy/deliveries/del-178')
    expect(sentMethod).toBe('POST')

    // Exact empty JSON object on wire: {}
    expect(rawBody).toBe('{}')
    expect(sentBody).toEqual({})
    expect(Object.keys(sentBody)).toHaveLength(0)
  })
})
