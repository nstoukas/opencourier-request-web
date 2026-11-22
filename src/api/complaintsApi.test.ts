import {
  RIDER_COMPLAINT_CATEGORIES,
  fetchOrderComplaints,
  fileRiderComplaint,
  type PartnerComplaint,
} from './complaintsApi'

// Spec 0052 (row 83, AC-3, AC-7): a restaurant files a complaint about the rider of one of its
// delivered or cancelled orders, and reads its own complaints and outcomes on that order.
// Calls go through manualRequestFetch to /complaints via /api/partner-proxy. The browser holds no credential.
describe('complaintsApi (spec 0052, AC-3, AC-7)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('RIDER_COMPLAINT_CATEGORIES (AC-1, AC-3)', () => {
    it('defines the four allowed categories for a complaint about a rider', () => {
      // AC-1: categories for rider are late, rude, food damaged, other
      expect(RIDER_COMPLAINT_CATEGORIES).toEqual(['LATE', 'RUDE', 'FOOD_DAMAGED', 'OTHER'])
    })
  })

  describe('fetchOrderComplaints', () => {
    it('calls GET /api/partner-proxy/complaints with encoded deliveryId and perPage=100 and unwraps page.data', async () => {
      const mockComplaints: PartnerComplaint[] = [
        {
          id: 'complaint-1',
          deliveryId: 'del-100',
          category: 'LATE',
          text: 'Rider was 45 minutes late',
          status: 'OPEN',
          createdAt: '2026-11-22T02:00:00.000Z',
          outcome: null,
          decidedAt: null,
          withdrawnReason: null,
          withdrawnAt: null,
        },
      ]

      let capturedUrl = ''
      let capturedOptions: RequestInit | undefined
      global.fetch = jest.fn().mockImplementation((url, options) => {
        capturedUrl = url.toString()
        capturedOptions = options
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: mockComplaints })),
        } as Response)
      })

      const result = await fetchOrderComplaints('del-100')

      expect(result).toEqual(mockComplaints)
      expect(capturedUrl).toBe('/api/partner-proxy/complaints?deliveryId=del-100&perPage=100')
      // No method override means GET
      expect(capturedOptions?.method).toBeUndefined()
    })

    it('URL-encodes deliveryId containing special characters', async () => {
      let capturedUrl = ''
      global.fetch = jest.fn().mockImplementation((url) => {
        capturedUrl = url.toString()
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: [] })),
        } as Response)
      })

      await fetchOrderComplaints('del/special#123')

      expect(capturedUrl).toBe('/api/partner-proxy/complaints?deliveryId=del%2Fspecial%23123&perPage=100')
    })

    it('throws with the backend error message when the request fails', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ message: 'Delivery not found' }),
          text: () => Promise.resolve(JSON.stringify({ message: 'Delivery not found' })),
        } as Response),
      )

      await expect(fetchOrderComplaints('del-unknown')).rejects.toThrow('Delivery not found')
    })
  })

  describe('fileRiderComplaint', () => {
    it('calls POST /api/partner-proxy/complaints with JSON body { deliveryId, category, text }', async () => {
      const input = {
        deliveryId: 'del-200',
        category: 'FOOD_DAMAGED' as const,
        text: 'The box was crushed and soup spilled',
      }
      const returnedComplaint: PartnerComplaint = {
        id: 'complaint-2',
        deliveryId: 'del-200',
        category: 'FOOD_DAMAGED',
        text: 'The box was crushed and soup spilled',
        status: 'OPEN',
        createdAt: '2026-11-22T02:30:00.000Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }

      let capturedUrl = ''
      let capturedOptions: RequestInit | undefined
      global.fetch = jest.fn().mockImplementation((url, options) => {
        capturedUrl = url.toString()
        capturedOptions = options
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(returnedComplaint)),
        } as Response)
      })

      const result = await fileRiderComplaint(input)

      expect(result).toEqual(returnedComplaint)
      expect(capturedUrl).toBe('/api/partner-proxy/complaints')
      expect(capturedOptions?.method).toBe('POST')
      expect(capturedOptions?.body).toBe(JSON.stringify(input))
      expect((capturedOptions?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json')
    })

    it('throws the backend error message on refusal (e.g. 409 "This order had no rider")', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          statusText: 'Conflict',
          json: () => Promise.resolve({ message: 'This order had no rider' }),
          text: () => Promise.resolve(JSON.stringify({ message: 'This order had no rider' })),
        } as Response),
      )

      await expect(
        fileRiderComplaint({
          deliveryId: 'del-no-rider',
          category: 'OTHER',
          text: 'No rider took this order',
        }),
      ).rejects.toThrow('This order had no rider')
    })
  })

  describe('Browser security and value 5 privacy (AC-3, AC-8, AC-9, AGENTS.md)', () => {
    it('never sends Authorization or API key headers on the wire', async () => {
      let capturedOptions: RequestInit | undefined
      global.fetch = jest.fn().mockImplementation((_url, options) => {
        capturedOptions = options
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: [] })),
        } as Response)
      })

      await fetchOrderComplaints('del-sec-1')

      // AGENTS.md: browser never holds a credential, talks only to same-origin partner proxy
      expect(capturedOptions?.credentials).toBe('same-origin')
      const headers = (capturedOptions?.headers ?? {}) as Record<string, string>
      expect(headers['Authorization']).toBeUndefined()
      expect(headers['x-api-key']).toBeUndefined()
      expect(headers['X-API-KEY']).toBeUndefined()
    })

    it('never sends photo data in partner filing payload (AC-3, AC-9 text only for restaurants)', async () => {
      let capturedBody: any
      global.fetch = jest.fn().mockImplementation((_url, options) => {
        capturedBody = JSON.parse(options?.body as string)
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 'comp-1',
                deliveryId: 'del-300',
                category: 'LATE',
                text: 'Late delivery',
                status: 'OPEN',
                createdAt: '2026-11-22T02:00:00Z',
                outcome: null,
                decidedAt: null,
                withdrawnReason: null,
                withdrawnAt: null,
              }),
            ),
        } as Response)
      })

      await fileRiderComplaint({
        deliveryId: 'del-300',
        category: 'LATE',
        text: 'Late delivery',
      })

      // Restaurant filing is strictly text and category only (decision 83.16)
      expect(capturedBody).toHaveProperty('deliveryId', 'del-300')
      expect(capturedBody).toHaveProperty('category', 'LATE')
      expect(capturedBody).toHaveProperty('text', 'Late delivery')
      expect(capturedBody).not.toHaveProperty('photo')
      expect(capturedBody).not.toHaveProperty('photoKey')
    })
  })
})
