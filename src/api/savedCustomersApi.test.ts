import {
  listSavedCustomers,
  addSavedCustomer,
  saveCustomerFromOrder,
  updateSavedCustomer,
  markSavedCustomerUsed,
  deleteSavedCustomer,
  fetchRetentionMonths,
} from './savedCustomersApi'
import type { SavedCustomer, SavedCustomerFields } from '../modules/saved-customers/types'

describe('savedCustomersApi', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const sampleFields: SavedCustomerFields = {
    name: 'Maria Papadopoulou',
    phone: '+306912345678',
    notes: '2nd floor',
    addressLine1: 'Iasonos 45',
    addressLine2: 'Apt 4',
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Iasonos 45, Volos',
  }

  const sampleCustomer: SavedCustomer = {
    id: 'cust-123',
    ...sampleFields,
    lastUsedAt: '2026-10-26T12:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  }

  describe('listSavedCustomers', () => {
    it('calls GET /customers with query params and optional signal', async () => {
      const mockResult = { items: [sampleCustomer], total: 1 }
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: mockResult })),
      } as any)
      global.fetch = fetchSpy

      const controller = new AbortController()
      const result = await listSavedCustomers({ q: 'Maria', page: 2, perPage: 10 }, controller.signal)

      expect(result).toEqual(mockResult)
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/partner-proxy/customers?q=Maria&page=2&perPage=10',
        expect.objectContaining({
          credentials: 'same-origin',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      )
    })
  })

  describe('addSavedCustomer', () => {
    it('sends POST to /customers with onPhoneClash "refuse" and no markUsed', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { customer: sampleCustomer } })),
      } as any)
      global.fetch = fetchSpy

      const created = await addSavedCustomer(sampleFields)

      expect(created).toEqual(sampleCustomer)
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/partner-proxy/customers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ...sampleFields, onPhoneClash: 'refuse' }),
        }),
      )
      const parsedBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(parsedBody.onPhoneClash).toBe('refuse')
      expect(parsedBody.markUsed).toBeUndefined()
    })
  })

  describe('saveCustomerFromOrder', () => {
    it('sends POST to /customers with onPhoneClash "update" and markUsed true', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { customer: sampleCustomer } })),
      } as any)
      global.fetch = fetchSpy

      const saved = await saveCustomerFromOrder(sampleFields)

      expect(saved).toEqual(sampleCustomer)
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/partner-proxy/customers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ...sampleFields, onPhoneClash: 'update', markUsed: true }),
        }),
      )
      const parsedBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(parsedBody.onPhoneClash).toBe('update')
      expect(parsedBody.markUsed).toBe(true)
    })
  })

  describe('updateSavedCustomer', () => {
    it('sends PATCH to /customers/:id and includes markUsed only when requested', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ result: { customer: sampleCustomer } })),
      } as any)
      global.fetch = fetchSpy

      // 1. Without markUsed
      await updateSavedCustomer('cust/123', { name: 'Maria Updated' })
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/partner-proxy/customers/cust%2F123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Maria Updated' }),
        }),
      )
      let parsedBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(parsedBody.markUsed).toBeUndefined()

      // 2. With markUsed: true
      await updateSavedCustomer('cust-123', { name: 'Maria Updated' }, { markUsed: true })
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/partner-proxy/customers/cust-123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Maria Updated', markUsed: true }),
        }),
      )
      parsedBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(parsedBody.markUsed).toBe(true)
    })
  })

  describe('markSavedCustomerUsed and deleteSavedCustomer', () => {
    it('markSavedCustomerUsed sends POST to /customers/:id/used with no body', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: jest.fn().mockResolvedValue(''),
      } as any)
      global.fetch = fetchSpy

      await markSavedCustomerUsed('cust-123')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/partner-proxy/customers/cust-123/used',
        expect.objectContaining({
          method: 'POST',
        }),
      )
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined()
    })

    it('deleteSavedCustomer sends DELETE to /customers/:id with no body', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: jest.fn().mockResolvedValue(''),
      } as any)
      global.fetch = fetchSpy

      await deleteSavedCustomer('cust-123')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/partner-proxy/customers/cust-123',
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined()
    })
  })

  describe('fetchRetentionMonths', () => {
    it('returns the retention months number when /api/partner-metadata succeeds', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ savedCustomerRetentionMonths: 24 }),
      } as any)

      const months = await fetchRetentionMonths()
      expect(months).toBe(24)
    })

    it('returns null on any failure (network error, 502, not ok, or invalid payload)', async () => {
      // 1. Rejected fetch
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'))
      expect(await fetchRetentionMonths()).toBeNull()

      // 2. HTTP not ok (502)
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn().mockResolvedValue({ message: 'Backend unreachable.' }),
      } as any)
      expect(await fetchRetentionMonths()).toBeNull()

      // 3. Payload missing savedCustomerRetentionMonths
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ other: 123 }),
      } as any)
      expect(await fetchRetentionMonths()).toBeNull()
    })
  })

  describe('409 error propagation', () => {
    it('propagates conflictingCustomerId and statusCode 409 from backend error envelope', async () => {
      const errorResponse = {
        error: true,
        result: [
          {
            message: 'Another saved customer has this phone',
            statusCode: 409,
            code: 'PHONE_CLASH',
            conflictingCustomerId: 'cust-clash-999',
          },
        ],
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any)

      await expect(addSavedCustomer(sampleFields)).rejects.toMatchObject({
        message: 'Another saved customer has this phone',
        statusCode: 409,
        conflictingCustomerId: 'cust-clash-999',
      })
    })
  })
})
