import { renderHook, act } from '@testing-library/react'
import {
  loginPartner,
  logoutPartner,
  fetchPartnerSession,
  fetchPartnerDelivery,
  fetchPartnerProfile,
  fetchWaitRecord,
  useWaitRecordQuery,
  delayDeliveryReady,
  markDeliveryFoodReady,
  setPartnerBusy,
  clearPartnerBusy,
  pausePartner,
  resumePartner,
  usePartnerAvailabilityQuery,
  fetchDispatchState,
  useDispatchStateQuery,
  useConfirmManualRequestDeliveryMutation,
  useCreateManualRequestQuoteMutation,
  useCancelManualRequestDeliveryMutation,
  useListManualRequestDeliveriesQuery,
  useGetManualRequestDeliveryQuery,
  manualRequestFetch,
  ENDED_DELIVERY_STATUSES,
  DispatchState,
} from './manualRequestApi'
import { onPartnerUnauthorized } from './partnerSessionEvents'
import { ManualRequestDeliveryInput, WaitRecord } from '../modules/manual-request/types'

describe('manualRequestApi helper functions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('loginPartner', () => {
    it('calls /api/partner-auth/login and returns email on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
      } as any)

      const res = await loginPartner('test@example.com', 'secret123')
      expect(global.fetch).toHaveBeenCalledWith('/api/partner-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'secret123' }),
      })
      expect(res).toEqual({ email: 'test@example.com' })
    })

    it('throws error with server message and sets error.status when sign-in fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ message: 'Invalid credentials' }),
      } as any)

      try {
        await loginPartner('test@example.com', 'wrong')
        fail('Should have thrown an error')
      } catch (err: any) {
        expect(err.message).toBe('Invalid credentials')
        expect(err.status).toBe(401)
      }
    })

    it('falls back to default message and preserves HTTP status on failed response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn().mockRejectedValue(new Error('Bad Gateway')),
      } as any)

      try {
        await loginPartner('test@example.com', 'wrong')
        fail('Should have thrown an error')
      } catch (err: any) {
        expect(err.message).toBe('Sign in failed.')
        expect(err.status).toBe(502)
      }
    })
  })

  describe('logoutPartner', () => {
    it('calls /api/partner-auth/logout with POST method', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any)

      await logoutPartner()
      expect(global.fetch).toHaveBeenCalledWith('/api/partner-auth/logout', {
        method: 'POST',
      })
    })

    it('throws when logout request fails with non-ok status (spec 0017, AC-6)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as any)

      await expect(logoutPartner()).rejects.toThrow('Sign out failed (HTTP 500)')
    })

    it('throws when logout encounters network failure (spec 0017, AC-6)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'))

      await expect(logoutPartner()).rejects.toThrow('Network offline')
    })
  })

  describe('fetchPartnerSession', () => {
    it('returns session data from /api/partner-auth/session on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ signedIn: true, email: 'user@volos.test' }),
      } as any)

      const session = await fetchPartnerSession()
      expect(session).toEqual({ signedIn: true, email: 'user@volos.test' })
    })

    it('throws on non-200 HTTP response (spec 0017, AC-6)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn().mockResolvedValue({ message: 'The sign in could not be checked.' }),
      } as any)

      await expect(fetchPartnerSession()).rejects.toThrow('Session check failed (HTTP 502)')
    })

    it('throws on network failure (spec 0017, AC-6)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      await expect(fetchPartnerSession()).rejects.toThrow('Network error')
    })
  })

  describe('fetchPartnerDelivery', () => {
    it('calls proxy deliveries endpoint with credentials same-origin and unwraps result', async () => {
      const mockDelivery = { id: 'del-123', status: 'ACCEPTED' }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockDelivery })),
      } as any)

      const result = await fetchPartnerDelivery('del-123')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/deliveries/del-123',
        expect.objectContaining({
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(result).toEqual(mockDelivery)
    })
  })

  describe('fetchPartnerProfile', () => {
    // Test Plan case 5: fetchPartnerProfile calls exact literal path /api/partner-proxy/partner/profile with credentials same-origin and no extra headers
    it('calls proxy profile endpoint with exact literal path /api/partner-proxy/partner/profile and no credentials/keys in headers', async () => {
      const mockFixture = {
        name: 'Nosh',
        phoneNumber: '+302421012345',
        pickupAddress: {
          street: 'Ermou',
          houseNumber: '120',
          city: 'Volos',
          state: 'Thessaly',
          zipCode: '38221',
          countryCode: 'GR',
          latitude: 39.3628,
          longitude: 22.9435,
          formattedAddress: 'Ermou 120, Volos, Thessaly, 38221, GR',
        },
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockFixture })),
      } as any)

      await fetchPartnerProfile()

      // Exact assertion on URL literal and exact headers object to prove no Authorization/API key headers are sent
      expect(global.fetch).toHaveBeenCalledWith('/api/partner-proxy/partner/profile', {
        credentials: 'same-origin',
        signal: expect.any(Object),
        headers: { 'Content-Type': 'application/json' },
      })
    })

    // Test Plan case 6: fetchPartnerProfile unwraps the { result: ... } envelope and preserves numbers
    it('unwraps profile response envelope and preserves coordinates', async () => {
      const mockFixture = {
        name: 'Nosh',
        phoneNumber: '+302421012345',
        pickupAddress: {
          street: 'Ermou',
          houseNumber: '120',
          city: 'Volos',
          state: 'Thessaly',
          zipCode: '38221',
          countryCode: 'GR',
          latitude: 39.3628,
          longitude: 22.9435,
          formattedAddress: 'Ermou 120, Volos, Thessaly, 38221, GR',
        },
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockFixture })),
      } as any)

      const profile = await fetchPartnerProfile()

      expect(profile).toEqual(mockFixture)
      expect(profile.pickupAddress?.latitude).toBe(39.3628)
      expect(profile.pickupAddress?.longitude).toBe(22.9435)
    })
  })

  describe('ready signals (spec 0023, AC-3, AC-4, AC-8)', () => {
    const answered = {
      id: 'del-123',
      status: 'ACCEPTED',
      readyAt: '2026-11-03T12:42:00.000Z',
      foodReadyAt: null,
    }

    it('delayDeliveryReady POSTs {minutes, expectedReadyAt} to /deliveries/:id/ready-delay through the partner proxy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: answered })),
      } as any)

      const result = await delayDeliveryReady('del-123', 10, '2026-11-03T12:32:00.000Z')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/partner-proxy/deliveries/del-123/ready-delay')
      expect(init.method).toBe('POST')
      expect(init.credentials).toBe('same-origin')
      expect(JSON.parse(init.body)).toEqual({ minutes: 10, expectedReadyAt: '2026-11-03T12:32:00.000Z' })
      // minutes goes as a JSON number, never text (the backend refuses one not sent as a number).
      expect(init.body).toContain('"minutes":10')
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
      // The answer is unwrapped from its envelope.
      expect(result).toEqual(answered)
    })

    it('markDeliveryFoodReady POSTs to /deliveries/:id/food-ready with no body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { ...answered, foodReadyAt: '2026-11-03T12:30:00.000Z' } })),
      } as any)

      const result = await markDeliveryFoodReady('del-123')

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/partner-proxy/deliveries/del-123/food-ready')
      expect(init.method).toBe('POST')
      expect(init.credentials).toBe('same-origin')
      expect(init.body).toBeUndefined()
      expect(result.foodReadyAt).toBe('2026-11-03T12:30:00.000Z')
    })

    it('a 409 rejects with the server\'s own sentence', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: jest.fn().mockResolvedValue({
          error: true,
          result: [{ message: 'The ready time just changed. Look again.', statusCode: 409 }],
        }),
      } as any)

      await expect(delayDeliveryReady('del-123', 5, '2026-11-03T12:32:00.000Z')).rejects.toThrow(
        'The ready time just changed. Look again.',
      )

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: jest.fn().mockResolvedValue({
          error: true,
          result: [{ message: 'This order has ended.', statusCode: 409 }],
        }),
      } as any)

      await expect(markDeliveryFoodReady('del-123')).rejects.toThrow('This order has ended.')
    })
  })

  describe('restaurant availability (spec 0029, AC-1, AC-3, AC-8)', () => {
    const answeredAvailability = {
      busyExtraMinutes: 15,
      pausedUntil: null,
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: true,
      notAcceptingReason: null,
    }

    it('setPartnerBusy POSTs {extraMinutes} to /partner/availability/busy through partner proxy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: answeredAvailability })),
      } as any)

      const result = await setPartnerBusy(15)

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/partner-proxy/partner/availability/busy')
      expect(init.method).toBe('POST')
      expect(init.credentials).toBe('same-origin')
      expect(JSON.parse(init.body)).toEqual({ extraMinutes: 15 })
      expect(init.body).toContain('"extraMinutes":15')
      expect(result).toEqual(answeredAvailability)
    })

    it('clearPartnerBusy sends DELETE to /partner/availability/busy with no body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({ result: { ...answeredAvailability, busyExtraMinutes: null } }),
        ),
      } as any)

      const result = await clearPartnerBusy()

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/partner-proxy/partner/availability/busy')
      expect(init.method).toBe('DELETE')
      expect(init.credentials).toBe('same-origin')
      expect(init.body).toBeUndefined()
      expect(result.busyExtraMinutes).toBeNull()
    })

    it('pausePartner POSTs {minutes} to /partner/availability/pause through partner proxy', async () => {
      const pausedResult = {
        ...answeredAvailability,
        pausedUntil: '2026-11-09T14:30:00.000Z',
        acceptingOrders: false,
        notAcceptingReason: 'Ordering is paused until 14:30.',
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: pausedResult })),
      } as any)

      const result = await pausePartner(30)

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/partner-proxy/partner/availability/pause')
      expect(init.method).toBe('POST')
      expect(init.credentials).toBe('same-origin')
      expect(JSON.parse(init.body)).toEqual({ minutes: 30 })
      expect(init.body).toContain('"minutes":30')
      expect(result).toEqual(pausedResult)
    })

    it('resumePartner sends DELETE to /partner/availability/pause with no body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: answeredAvailability })),
      } as any)

      const result = await resumePartner()

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/partner-proxy/partner/availability/pause')
      expect(init.method).toBe('DELETE')
      expect(init.credentials).toBe('same-origin')
      expect(init.body).toBeUndefined()
      expect(result).toEqual(answeredAvailability)
    })

    it('a 409 refusal rejects with the server\'s own sentence', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: jest.fn().mockResolvedValue({
          error: true,
          result: [{ message: 'The co-op has disabled this restaurant: Inactive', statusCode: 409 }],
        }),
      } as any)

      await expect(setPartnerBusy(10)).rejects.toThrow('The co-op has disabled this restaurant: Inactive')

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: jest.fn().mockResolvedValue({
          error: true,
          result: [{ message: 'The co-op has disabled this restaurant: Inactive', statusCode: 409 }],
        }),
      } as any)

      await expect(pausePartner(15)).rejects.toThrow('The co-op has disabled this restaurant: Inactive')
    })

    it('usePartnerAvailabilityQuery polls partner profile and returns availability and refetch', async () => {
      const mockProfile = {
        name: 'Nosh',
        phoneNumber: null,
        pickupAddress: null,
        availability: answeredAvailability,
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockProfile })),
      } as any)

      const { result } = renderHook(() => usePartnerAvailabilityQuery())

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.availability).toEqual(answeredAvailability)
      expect(typeof result.current.refetch).toBe('function')
    })
  })

  describe('fetchWaitRecord and useWaitRecordQuery (spec 0030, AC-8)', () => {
    it('calls proxy wait-record endpoint with days query parameter and returns WaitRecord', async () => {
      const mockRecord: WaitRecord = {
        days: 30,
        orderCount: 20,
        waitSamples: 18,
        averageWaitMinutes: 3.5,
        lateShare: 0.1,
        prepSamples: 19,
        medianPrepMinutes: 15,
        usualPrepMinutes: 15,
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockRecord })),
      } as any)

      const result = await fetchWaitRecord(30)

      expect(global.fetch).toHaveBeenCalledWith('/api/partner-proxy/partner/wait-record?days=30', {
        credentials: 'same-origin',
        signal: expect.any(Object),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(result).toEqual(mockRecord)
    })

    it('propagates errors when fetchWaitRecord encounters non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Invalid days parameter' }),
      } as any)

      await expect(fetchWaitRecord(15)).rejects.toThrow('Invalid days parameter')
    })

    it('useWaitRecordQuery fetches wait record with polled fetch', async () => {
      const mockRecord: WaitRecord = {
        days: 7,
        orderCount: 5,
        waitSamples: 5,
        averageWaitMinutes: 2.0,
        lateShare: 0,
        prepSamples: 5,
        medianPrepMinutes: 12,
        usualPrepMinutes: 15,
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockRecord })),
      } as any)

      const { result } = renderHook(() => useWaitRecordQuery(7))

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.data).toEqual(mockRecord)
      expect(global.fetch).toHaveBeenCalledWith('/api/partner-proxy/partner/wait-record?days=7', expect.any(Object))
    })
  })

  describe('useConfirmManualRequestDeliveryMutation', () => {
    const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

    beforeEach(() => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    })

    afterEach(() => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
    })

    it('sends dropoffSellerNotes, dropoffNotes and orderTotalValue to the wire via partner proxy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-confirm-123', status: 'ACCEPTED' } })),
      } as any)

      const { result } = renderHook(() => useConfirmManualRequestDeliveryMutation())
      const [confirmDelivery] = result.current

      const deliveryInput: ManualRequestDeliveryInput = {
        quoteId: 'quote-abc',
        idempotencyKey: 'idem-xyz',
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
        dropoffFloor: '  4  ',
        dropoffDoorbell: '  Papadopoulou  ',
        dropoffSellerNotes: 'Ring twice',
        dropoffNotes: 'Floor: 4 · Doorbell: Papadopoulou\nRing twice',
        orderTotalValue: 1250,
      }

      let response: any
      await act(async () => {
        response = await confirmDelivery(deliveryInput)
      })

      expect(response).toEqual({ id: 'del-confirm-123', status: 'ACCEPTED' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/deliveries',
        expect.objectContaining({
          method: 'POST',
        }),
      )

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const wireBody = JSON.parse(fetchCall[1].body)

      expect(wireBody.dropoffFloor).toBe('4')
      expect(wireBody.dropoffDoorbell).toBe('Papadopoulou')
      expect(wireBody.dropoffSellerNotes).toBe('Ring twice')
      expect(wireBody.dropoffNotes).toBe('Floor: 4 · Doorbell: Papadopoulou\nRing twice')
      expect(wireBody.orderTotalValue).toBe(1250)
      expect(wireBody.quoteId).toBe('quote-abc')
    })

    it('spec 0016: omits dropoffFloor and dropoffDoorbell when empty, whitespace, or undefined', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-confirm-456', status: 'ACCEPTED' } })),
      } as any)

      const { result } = renderHook(() => useConfirmManualRequestDeliveryMutation())
      const [confirmDelivery] = result.current

      const deliveryInput: ManualRequestDeliveryInput = {
        quoteId: 'quote-abc',
        idempotencyKey: 'idem-xyz',
        pickupName: 'Nosh',
        pickupPhoneNumber: '+302421012345',
        pickupBusinessName: 'Nosh',
        pickupLatitude: 39.36,
        pickupLongitude: 22.94,
        dropoffLatitude: 39.37,
        dropoffLongitude: 22.95,
        pickupAddress: {
          streetAddress: ['Ermou 120'],
          city: 'Volos',
          state: '',
          zipCode: '',
          countryCode: 'GR',
        },
        dropoffName: 'Vassilis Spanoulis',
        dropoffPhoneNumber: '+306911223344',
        dropoffAddress: {
          streetAddress: ['Iasonos 80'],
          city: 'Volos',
          state: '',
          zipCode: '',
          countryCode: 'GR',
        },
        dropoffFloor: '   ',
        dropoffDoorbell: undefined,
        dropoffSellerNotes: 'Leave outside',
        dropoffNotes: 'Leave outside',
      }

      await act(async () => {
        await confirmDelivery(deliveryInput)
      })

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const wireBody = JSON.parse(fetchCall[1].body)

      expect('dropoffFloor' in wireBody).toBe(false)
      expect('dropoffDoorbell' in wireBody).toBe(false)
      expect(wireBody.dropoffSellerNotes).toBe('Leave outside')
      expect(wireBody.dropoffNotes).toBe('Leave outside')
    })
  })

  describe('useCreateManualRequestQuoteMutation (spec 0016, AC-2 & API table)', () => {
    const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

    beforeEach(() => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    })

    afterEach(() => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
    })

    it('quote mapping never sends dropoffFloor or dropoffDoorbell on the wire', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            result: {
              quoteId: 'quote-xyz-123',
              fee: 350,
              currency: 'EUR',
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            },
          }),
        ),
      } as any)

      const { result } = renderHook(() => useCreateManualRequestQuoteMutation())
      const [createQuote] = result.current

      // Pass input with dropoffFloor and dropoffDoorbell populated
      const quoteInput: any = {
        pickupName: 'Nosh',
        pickupPhoneNumber: '+302421012345',
        pickupAddress: {
          streetAddress: ['Ermou 120'],
          city: 'Volos',
          state: 'Thessaly',
          zipCode: '38221',
          countryCode: 'GR',
        },
        pickupLatitude: 39.3628,
        pickupLongitude: 22.9435,
        dropoffName: 'Elena K.',
        dropoffPhoneNumber: '+306911223344',
        dropoffAddress: {
          streetAddress: ['Iasonos 80'],
          city: 'Volos',
          state: 'Thessaly',
          zipCode: '38221',
          countryCode: 'GR',
        },
        dropoffLatitude: 39.361,
        dropoffLongitude: 22.942,
        dropoffFloor: '3',
        dropoffDoorbell: 'Kiriakou',
        dropoffNotes: 'Floor: 3 · Doorbell: Kiriakou\nRing twice',
        dropoffSellerNotes: 'Ring twice',
      }

      await act(async () => {
        await createQuote(quoteInput)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/delivery-quotes',
        expect.objectContaining({
          method: 'POST',
        }),
      )

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const wireBody = JSON.parse(fetchCall[1].body)

      expect('dropoffFloor' in wireBody).toBe(false)
      expect('dropoffDoorbell' in wireBody).toBe(false)
      expect(wireBody.dropoffLatitude).toBe(39.361)
      expect(wireBody.dropoffLongitude).toBe(22.942)
    })
  })

  describe('useCancelManualRequestDeliveryMutation (spec 0015, AC-5)', () => {
    const originalApiMode = process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE

    beforeEach(() => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'partner'
    })

    afterEach(() => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = originalApiMode
    })

    it('in partner mode, sends POST to /deliveries/:id/cancel with body {"cancelledBy":"CUSTOMER"} for CUSTOMER', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-123', status: 'CANCELED' } })),
      } as any)

      const { result } = renderHook(() => useCancelManualRequestDeliveryMutation())
      const [cancelDelivery] = result.current

      let response: any
      await act(async () => {
        response = await cancelDelivery({ deliveryId: 'del-123', cancelledBy: 'CUSTOMER' })
      })

      expect(response).toEqual({ id: 'del-123', status: 'CANCELED' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/deliveries/del-123/cancel',
        expect.objectContaining({
          method: 'POST',
        }),
      )

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      expect(fetchCall[1].body).toBe(JSON.stringify({ cancelledBy: 'CUSTOMER' }))
    })

    it('in partner mode, sends POST to /deliveries/:id/cancel with body {"cancelledBy":"RESTAURANT"} for RESTAURANT', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-456', status: 'CANCELED' } })),
      } as any)

      const { result } = renderHook(() => useCancelManualRequestDeliveryMutation())
      const [cancelDelivery] = result.current

      let response: any
      await act(async () => {
        response = await cancelDelivery({ deliveryId: 'del-456', cancelledBy: 'RESTAURANT' })
      })

      expect(response).toEqual({ id: 'del-456', status: 'CANCELED' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/deliveries/del-456/cancel',
        expect.objectContaining({
          method: 'POST',
        }),
      )

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      expect(fetchCall[1].body).toBe(JSON.stringify({ cancelledBy: 'RESTAURANT' }))
    })

    it('in admin mode, sends POST to /delivery/:id/cancel with no body', async () => {
      process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE = 'admin'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { id: 'del-789', status: 'CANCELED' } })),
      } as any)

      const { result } = renderHook(() => useCancelManualRequestDeliveryMutation())
      const [cancelDelivery] = result.current

      let response: any
      await act(async () => {
        response = await cancelDelivery({ deliveryId: 'del-789', cancelledBy: 'CUSTOMER' })
      })

      expect(response).toEqual({ id: 'del-789', status: 'CANCELED' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/delivery/del-789/cancel',
        expect.objectContaining({
          method: 'POST',
        }),
      )

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      expect(fetchCall[1].body).toBeUndefined()
    })

    it('propagates server errors when cancel fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          result: [{ message: 'Delivery cannot be cancelled in terminal status', statusCode: 400 }],
        }),
      } as any)

      const { result } = renderHook(() => useCancelManualRequestDeliveryMutation())
      const [cancelDelivery] = result.current

      await act(async () => {
        await expect(
          cancelDelivery({ deliveryId: 'del-123', cancelledBy: 'RESTAURANT' }),
        ).rejects.toThrow('Delivery cannot be cancelled in terminal status')
      })
    })
  })

  describe('fetchDispatchState (spec 0014, AC-6)', () => {
    it('GETs /dispatch-state through the partner proxy and unwraps DispatchState', async () => {
      const mockDispatchState: DispatchState = {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T10:00:00.000Z',
          endsAt: '2026-11-01T15:00:00.000Z',
          message: 'Delivery is stopped until 17:00 (heat).',
        },
        next: {
          reason: 'STORM',
          startsAt: '2026-11-01T18:00:00.000Z',
          endsAt: '2026-11-01T22:00:00.000Z',
          message: 'Delivery stops today 20:00 to 00:00 (storm).',
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockDispatchState)),
      } as any)

      const result = await fetchDispatchState()

      // Exact assertion that it routes through /api/partner-proxy/dispatch-state with same-origin credentials
      // and not a custom route handler like /api/dispatch-state
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/dispatch-state',
        expect.objectContaining({
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(result).toEqual(mockDispatchState)
    })

    it('unwraps response when payload is enclosed in a result envelope', async () => {
      const mockDispatchState: DispatchState = {
        current: null,
        next: null,
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockDispatchState })),
      } as any)

      const result = await fetchDispatchState()
      expect(result).toEqual(mockDispatchState)
    })

    it('throws error when manualRequestFetch encounters HTTP failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValue({ message: 'Dispatch service unavailable' }),
      } as any)

      await expect(fetchDispatchState()).rejects.toThrow('Dispatch service unavailable')
    })
  })

  describe('useDispatchStateQuery (spec 0014, AC-6)', () => {
    let visibilitySpy: jest.SpyInstance<DocumentVisibilityState, []>

    beforeEach(() => {
      jest.useFakeTimers()
      visibilitySpy = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    })

    afterEach(() => {
      jest.useRealTimers()
      visibilitySpy.mockRestore()
    })

    it('reads on mount and updates data when request succeeds', async () => {
      const stateOnMount: DispatchState = {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T10:00:00.000Z',
          endsAt: null,
          message: 'Delivery is stopped until dispatch restarts (heat).',
        },
        next: null,
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: stateOnMount })),
      } as any)

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner-proxy/dispatch-state',
        expect.anything(),
      )
      expect(hook.result.current.data).toEqual(stateOnMount)
    })

    it('polls again every 60000 ms while document.visibilityState is "visible"', async () => {
      const state1: DispatchState = { current: null, next: null }
      const state2: DispatchState = {
        current: {
          reason: 'STORM',
          startsAt: '2026-11-01T14:00:00.000Z',
          endsAt: '2026-11-01T18:00:00.000Z',
          message: 'Delivery is stopped until 20:00 (storm).',
        },
        next: null,
      }

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(JSON.stringify({ result: state1 })),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(JSON.stringify({ result: state2 })),
        } as any)

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })

      expect(hook.result.current.data).toEqual(state1)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Advance 60000ms while visible
      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(hook.result.current.data).toEqual(state2)
    })

    it('does NOT poll when document.visibilityState is "hidden"', async () => {
      const state1: DispatchState = { current: null, next: null }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: state1 })),
      } as any)

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Tab is hidden
      visibilitySpy.mockReturnValue('hidden')

      // Advance 60000ms while hidden
      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })

      // Fetch must not have been triggered by interval while hidden
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Advance another 60000ms while still hidden
      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('reads immediately on visibilitychange when transitioning to visible', async () => {
      const state1: DispatchState = { current: null, next: null }
      const state2: DispatchState = {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T11:00:00.000Z',
          endsAt: '2026-11-01T15:00:00.000Z',
          message: 'Delivery is stopped until 17:00 (heat).',
        },
        next: null,
      }

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(JSON.stringify({ result: state1 })),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(JSON.stringify({ result: state2 })),
        } as any)

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Tab is hidden and visibilitychange fires
      visibilitySpy.mockReturnValue('hidden')
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      // Transitioning to hidden does NOT trigger load
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Tab becomes visible again and visibilitychange fires
      visibilitySpy.mockReturnValue('visible')
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Read is triggered immediately on visibilitychange to visible without waiting 60s
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(hook.result.current.data).toEqual(state2)
    })

    it('keeps the last answer and throws nothing when a subsequent read fails', async () => {
      const state1: DispatchState = {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T10:00:00.000Z',
          endsAt: '2026-11-01T15:00:00.000Z',
          message: 'Delivery is stopped until 17:00 (heat).',
        },
        next: null,
      }

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: state1 })),
      } as any)

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })
      expect(hook.result.current.data).toEqual(state1)

      // Subsequent fetch fails
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'))

      // Advance 60s while visible
      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })

      // Must keep last answer and not throw
      expect(hook.result.current.data).toEqual(state1)

      // Visibility change to visible also fails
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Retains the previous good answer
      expect(hook.result.current.data).toEqual(state1)
    })

    it('leaves data undefined and throws nothing when initial mount read fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Server unavailable'))

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })

      expect(hook.result.current.data).toBeUndefined()
    })

    it('cleans up interval timer and visibilitychange listener on unmount', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { current: null, next: null } })),
      } as any)

      let hook: any
      await act(async () => {
        hook = renderHook(() => useDispatchStateQuery())
      })
      expect(global.fetch).toHaveBeenCalledTimes(1)

      hook.unmount()

      // Advancing timer and dispatching visibilitychange after unmount
      await act(async () => {
        jest.advanceTimersByTime(60_000)
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // No new fetch calls occur
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('manualRequestFetch 401 notification (spec 0017, AC-5)', () => {
    it('calls unauthorized listeners on 401 response only (not on 404 or 500)', async () => {
      const listener = jest.fn()
      const unsubscribe = onPartnerUnauthorized(listener)

      // 401 response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Unauthorized' })),
      } as any)

      await expect(manualRequestFetch('/deliveries')).rejects.toThrow()
      expect(listener).toHaveBeenCalledTimes(1)

      // 404 response does NOT notify
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Not found' })),
      } as any)

      await expect(manualRequestFetch('/deliveries/missing')).rejects.toThrow()
      expect(listener).toHaveBeenCalledTimes(1)

      // 500 response does NOT notify
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Server error' })),
      } as any)

      await expect(manualRequestFetch('/deliveries')).rejects.toThrow()
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })
  })

  describe('delivery query hooks and ENDED_DELIVERY_STATUSES (spec 0017, AC-4)', () => {
    it('defines ENDED_DELIVERY_STATUSES as DROPPED_OFF, CANCELED, FAILED', () => {
      expect(ENDED_DELIVERY_STATUSES).toEqual(['DROPPED_OFF', 'CANCELED', 'FAILED'])
    })

    it('useGetManualRequestDeliveryQuery stops polling once delivery status is terminal', async () => {
      jest.useFakeTimers()
      try {
        const fetchDeliveryMock = jest
          .fn()
          .mockResolvedValueOnce({ id: 'del-1', status: 'IN_TRANSIT' })
          .mockResolvedValueOnce({ id: 'del-1', status: 'DROPPED_OFF' })

        global.fetch = jest.fn().mockImplementation(async () => ({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify({ result: await fetchDeliveryMock() })),
        }))

        const { result } = renderHook(() =>
          useGetManualRequestDeliveryQuery('del-1', { pollMs: 30_000 })
        )

        await act(async () => {
          await Promise.resolve()
        })
        expect(result.current.data?.status).toBe('IN_TRANSIT')
        expect(fetchDeliveryMock).toHaveBeenCalledTimes(1)

        // Poll 1: delivery updates to DROPPED_OFF
        await act(async () => {
          jest.advanceTimersByTime(30_000)
        })
        expect(result.current.data?.status).toBe('DROPPED_OFF')
        expect(fetchDeliveryMock).toHaveBeenCalledTimes(2)

        // Poll 2: timer advances, but polling has stopped!
        await act(async () => {
          jest.advanceTimersByTime(30_000)
        })
        expect(fetchDeliveryMock).toHaveBeenCalledTimes(2)
      } finally {
        jest.clearAllTimers()
        jest.useRealTimers()
      }
    })
  })
})
