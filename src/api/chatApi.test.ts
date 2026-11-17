import fs from 'fs'
import path from 'path'
import { fetchChatMessages, sendChatMessage, type ChatMessage } from './chatApi'

// Spec 0034 (chat), AC-14, AC-21: the restaurant's one conversation with dispatch.
// Calls go through manualRequestFetch to /chat/messages (GET) and /chat/messages (POST),
// which reaches /api/partner-proxy/chat/messages. The browser holds no credential.
describe('chatApi (spec 0034, AC-14, AC-21)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('fetchChatMessages', () => {
    it('calls GET /api/partner-proxy/chat/messages and unwraps answer.messages', async () => {
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello restaurant',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00.000Z',
        },
      ]

      let capturedUrl = ''
      let capturedOptions: RequestInit | undefined
      global.fetch = jest.fn().mockImplementation((url, options) => {
        capturedUrl = url.toString()
        capturedOptions = options
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ messages: mockMessages })),
        } as Response)
      })

      const result = await fetchChatMessages()

      expect(result).toEqual(mockMessages)
      expect(capturedUrl).toBe('/api/partner-proxy/chat/messages')
      // No method override means GET
      expect(capturedOptions?.method).toBeUndefined()
    })
  })

  describe('sendChatMessage', () => {
    it('calls POST /api/partner-proxy/chat/messages with JSON body { body, clientMessageId }', async () => {
      const input = { body: 'Ready for pickup', clientMessageId: 'restaurant-uuid-123' }
      const returnedMessage: ChatMessage = {
        id: 'msg-partner-1',
        senderKind: 'PARTNER',
        senderName: null,
        body: 'Ready for pickup',
        clientMessageId: 'restaurant-uuid-123',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:05:00.000Z',
      }

      let capturedUrl = ''
      let capturedOptions: RequestInit | undefined
      global.fetch = jest.fn().mockImplementation((url, options) => {
        capturedUrl = url.toString()
        capturedOptions = options
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(returnedMessage)),
        } as Response)
      })

      const result = await sendChatMessage(input)

      expect(result).toEqual(returnedMessage)
      expect(capturedUrl).toBe('/api/partner-proxy/chat/messages')
      expect(capturedOptions?.method).toBe('POST')
      expect(capturedOptions?.body).toBe(JSON.stringify(input))
      expect((capturedOptions?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json')
    })
  })

  describe('No credential in the browser (AC-14, AC-21, AGENTS.md locked decision)', () => {
    it('sends credentials: "same-origin" and no Authorization or API key headers on the wire', async () => {
      let capturedOptions: RequestInit | undefined
      global.fetch = jest.fn().mockImplementation((_url, options) => {
        capturedOptions = options
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ messages: [] })),
        } as Response)
      })

      await fetchChatMessages()

      expect(capturedOptions?.credentials).toBe('same-origin')
      const headers = (capturedOptions?.headers ?? {}) as Record<string, string>
      const headerKeys = Object.keys(headers).map((k) => k.toLowerCase())

      // No bearer token or api keys on wire
      expect(headerKeys).not.toContain('authorization')
      expect(headerKeys).not.toContain('x-api-key')
      expect(headerKeys).not.toContain('apikey')
      expect(headerKeys).not.toContain('api-key')
    })

    it('neither chatApi.ts nor any file in src/modules/chat reads an API key or NEXT_PUBLIC_* credential', () => {
      const chatApiSource = fs.readFileSync(path.resolve(__dirname, 'chatApi.ts'), 'utf-8')
      const chatDir = path.resolve(__dirname, '../modules/chat')
      const chatFiles = fs.readdirSync(chatDir).filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))

      const sourcesToCheck = [
        { name: 'src/api/chatApi.ts', content: chatApiSource },
        ...chatFiles.map((file) => ({
          name: `src/modules/chat/${file}`,
          content: fs.readFileSync(path.join(chatDir, file), 'utf-8'),
        })),
      ]

      for (const { name, content } of sourcesToCheck) {
        // Assert no reading of API keys or environment secrets
        expect(content).not.toMatch(/API_KEY/i)
        expect(content).not.toMatch(/NEXT_PUBLIC_.*KEY/i)
        expect(content).not.toMatch(/Bearer/i)
        expect(content).not.toMatch(/process\.env/i)
      }
    })
  })
})
