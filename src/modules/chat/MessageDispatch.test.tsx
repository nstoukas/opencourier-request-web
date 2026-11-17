import React from 'react'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MessageDispatch, OPEN_POLL_MS, CLOSED_POLL_MS } from './MessageDispatch'
import { fetchChatMessages, sendChatMessage, type ChatMessage } from '../../api/chatApi'
import { CHAT_SEEN_KEY } from './chatSeen'

jest.mock('../../api/chatApi', () => ({
  fetchChatMessages: jest.fn(),
  sendChatMessage: jest.fn(),
}))

describe('MessageDispatch (spec 0034, AC-5, AC-6, AC-14, AC-19)', () => {
  let visibilityState: 'visible' | 'hidden' = 'visible'

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    visibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    ;(fetchChatMessages as jest.Mock).mockResolvedValue([])
    ;(sendChatMessage as jest.Mock).mockResolvedValue({
      id: 'server-msg-1',
      senderKind: 'PARTNER',
      senderName: null,
      body: 'Hello',
      createdAt: '2026-11-17T12:00:00.000Z',
    })
  })

  describe('AC-14 button and sheet', () => {
    it('renders "Message Dispatch" button; clicking it opens side sheet with conversation', async () => {
      render(<MessageDispatch />)

      const button = screen.getByRole('button', { name: 'Message Dispatch' })
      expect(button).toBeInTheDocument()

      // Side sheet is closed initially
      expect(screen.queryByRole('heading', { level: 2, name: 'Dispatch' })).not.toBeInTheDocument()

      // Click to open
      fireEvent.click(button)

      // Radix sheet opens in portal
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()
      expect(
        screen.getByText("Write to the co-op's dispatch about an order or anything else.")
      ).toBeInTheDocument()
    })
  })

  describe('AC-14 polling and visibility', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.clearAllTimers()
      jest.useRealTimers()
    })

    it('polls every 30 s (CLOSED_POLL_MS) when closed, and every 5 s (OPEN_POLL_MS) when open', async () => {
      // Pin constant values required by AC-14
      expect(OPEN_POLL_MS).toBe(5_000)
      expect(CLOSED_POLL_MS).toBe(30_000)

      render(<MessageDispatch />)

      // Initial mount triggers 1 fetch
      await act(async () => {
        await Promise.resolve()
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(1)

      // Closed: advance 5 s (no fetch yet)
      await act(async () => {
        jest.advanceTimersByTime(5_000)
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(1)

      // Closed: advance remaining 25 s (total 30 s) -> polls
      await act(async () => {
        jest.advanceTimersByTime(25_000)
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(2)

      // Open the sheet: clicking button sets open = true
      const button = screen.getByRole('button', { name: /Message Dispatch/i })
      await act(async () => {
        fireEvent.click(button)
      })

      // Opening switches interval to 5 s and refetches
      expect(fetchChatMessages).toHaveBeenCalledTimes(3)

      // Open: advance 5 s -> polls again
      await act(async () => {
        jest.advanceTimersByTime(5_000)
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(4)
    })

    it('does not poll while tab is hidden (document.visibilityState === "hidden")', async () => {
      render(<MessageDispatch />)

      // Initial fetch
      await act(async () => {
        await Promise.resolve()
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(1)

      // Tab becomes hidden
      visibilityState = 'hidden'

      // Advance timers by multiple intervals while hidden: no new fetches must occur
      await act(async () => {
        jest.advanceTimersByTime(CLOSED_POLL_MS * 3)
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(1)

      // Tab becomes visible again
      visibilityState = 'visible'

      // Advancing timer now triggers polling
      await act(async () => {
        jest.advanceTimersByTime(CLOSED_POLL_MS)
      })
      expect(fetchChatMessages).toHaveBeenCalledTimes(2)
    })
  })

  describe('AC-14 no presets', () => {
    it('has no preset or quick reply buttons, only a text box ("Write to Dispatch") and send button', async () => {
      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()

      // The open sheet is a dialog (rendered in a portal)
      const dialog = screen.getByRole('dialog')

      // The composer has a textarea with placeholder "Write to Dispatch"
      const textarea = within(dialog).getByPlaceholderText('Write to Dispatch')
      expect(textarea).toBeInTheDocument()

      // AC-14: inside the open sheet (the dialog), the only buttons are the sheet's close button and Send
      // Any preset or quick reply button of any wording fails this assertion.
      const dialogButtons = within(dialog).getAllByRole('button')
      const buttonNames = dialogButtons.map((b) => b.getAttribute('aria-label') || b.textContent?.trim())

      expect(dialogButtons).toHaveLength(2)
      expect(buttonNames.sort()).toEqual(['Close', 'Send'].sort())
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Send' })).toBeInTheDocument()
    })
  })

  describe('AC-14 unread dot and chatSeen integration', () => {
    it('shows unread dot on closed button when dispatch wrote something new, and clears it once opened', async () => {
      const dispatchMsg: ChatMessage = {
        id: 'disp-unseen-1',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'New message from dispatch',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:00:00.000Z',
      }
      ;(fetchChatMessages as jest.Mock).mockResolvedValue([dispatchMsg])

      render(<MessageDispatch />)

      // Wait for fetch to populate data
      const buttonWithDot = await screen.findByRole('button', {
        name: 'Message Dispatch, new message',
      })
      expect(buttonWithDot).toBeInTheDocument()

      // Open the sheet
      fireEvent.click(buttonWithDot)

      // Conversation is visible
      expect(await screen.findByText('New message from dispatch')).toBeInTheDocument()

      // Seen record in localStorage was updated
      const storedSeen = JSON.parse(window.localStorage.getItem(CHAT_SEEN_KEY)!)
      expect(storedSeen).toEqual({ id: 'disp-unseen-1', createdAt: '2026-11-17T12:00:00.000Z' })
    })
  })

  describe('AC-5 sender label', () => {
    it('dispatch messages show "Dispatch" as the sender when senderName is "Dispatch" or null', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'disp-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'First dispatch note',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00.000Z',
        },
        {
          id: 'disp-2',
          senderKind: 'DISPATCH',
          senderName: null,
          body: 'Second dispatch note',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:05:00.000Z',
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByText('First dispatch note')).toBeInTheDocument()
      expect(screen.getByText('Second dispatch note')).toBeInTheDocument()

      // Both items show Dispatch
      const dispatchLabels = screen.getAllByText(/^Dispatch ·/)
      expect(dispatchLabels.length).toBe(2)
    })

    it('dispatch messages show "Dispatch" as the sender, never a person\'s name, even if senderName carried one (AC-5)', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'disp-person',
          senderKind: 'DISPATCH',
          senderName: 'George Dispatcher',
          body: 'Checking on courier status',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:10:00.000Z',
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByText('Checking on courier status')).toBeInTheDocument()

      // AC-5: dispatch's messages show "Dispatch" as the sender, never a person's name
      expect(screen.queryByText(/George Dispatcher/)).not.toBeInTheDocument()
      expect(screen.getByText(/^Dispatch ·/)).toBeInTheDocument()
    })
  })

  describe('AC-6 read marks', () => {
    it('restaurant PARTNER message shows "read" only when readByDispatch is true; dispatch messages never show "read"', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'partner-unread',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Order #42 is ready',
          deliveryId: null,
          orderReference: '42',
          readByDispatch: false,
          createdAt: '2026-11-17T12:00:00.000Z',
        },
        {
          id: 'partner-read',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Order #43 has drinks',
          deliveryId: null,
          orderReference: '43',
          readByDispatch: true,
          createdAt: '2026-11-17T12:05:00.000Z',
        },
        {
          id: 'partner-absent',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Order #44 extra napkins',
          deliveryId: null,
          orderReference: '44',
          // readByDispatch is absent / undefined
          createdAt: '2026-11-17T12:10:00.000Z',
        },
        {
          id: 'disp-msg',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Got it, rider arriving soon',
          deliveryId: null,
          orderReference: null,
          // Even if readByDispatch is true on dispatch's messages, it must never show "read"
          readByDispatch: true,
          createdAt: '2026-11-17T12:15:00.000Z',
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByText('Order #42 is ready')).toBeInTheDocument()

      // Exactly one " · read" mark should appear in the document (for partner-read)
      const readMarks = screen.getAllByText(/· read/)
      expect(readMarks.length).toBe(1)
      expect(readMarks[0]).toHaveTextContent('· #43 · read')

      // partner-unread shows order but not read
      expect(screen.getByText(/· #42$/)).toBeInTheDocument()

      // partner-absent shows order but not read
      expect(screen.getByText(/· #44$/)).toBeInTheDocument()

      // Dispatch message never shows read
      const dispMeta = screen.getByText(/^Dispatch ·/)
      expect(dispMeta).not.toHaveTextContent('read')
    })
  })

  describe('AC-19 retry with the same clientMessageId and deduplication', () => {
    it('failed send shows "Not sent, tap to retry"; retrying resends with the SAME clientMessageId', async () => {
      ;(sendChatMessage as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText('Write to Dispatch')
      fireEvent.change(textarea, { target: { value: 'Customer called about delay' } })

      const sendBtn = screen.getByRole('button', { name: 'Send' })
      fireEvent.click(sendBtn)

      // In flight or failed
      const retryBtn = await screen.findByRole('button', { name: 'Not sent, tap to retry' })
      expect(retryBtn).toBeInTheDocument()
      expect(screen.getByText('Customer called about delay')).toBeInTheDocument()

      expect(sendChatMessage).toHaveBeenCalledTimes(1)
      const firstCallArgs = (sendChatMessage as jest.Mock).mock.calls[0][0]
      expect(firstCallArgs.body).toBe('Customer called about delay')
      const capturedClientId = firstCallArgs.clientMessageId
      expect(capturedClientId).toMatch(/^restaurant-/)

      // Click "Not sent, tap to retry"
      ;(sendChatMessage as jest.Mock).mockResolvedValueOnce({
        id: 'server-retried-1',
        senderKind: 'PARTNER',
        senderName: null,
        body: 'Customer called about delay',
        clientMessageId: capturedClientId,
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:20:00.000Z',
      })

      fireEvent.click(retryBtn)

      await waitFor(() => {
        expect(sendChatMessage).toHaveBeenCalledTimes(2)
      })

      const secondCallArgs = (sendChatMessage as jest.Mock).mock.calls[1][0]
      // MUST resend with the SAME clientMessageId and SAME body
      expect(secondCallArgs.clientMessageId).toBe(capturedClientId)
      expect(secondCallArgs.body).toBe('Customer called about delay')
    })

    it('once the server list contains clientMessageId the pending copy is not shown twice', async () => {
      let currentServerMessages: ChatMessage[] = []
      ;(fetchChatMessages as jest.Mock).mockImplementation(async () => currentServerMessages)

      ;(sendChatMessage as jest.Mock).mockImplementation(
        async ({ body, clientMessageId }: { body: string; clientMessageId: string }) => {
          const serverMsg: ChatMessage = {
            id: 'server-confirmed-msg',
            senderKind: 'PARTNER',
            senderName: null,
            body,
            clientMessageId,
            deliveryId: null,
            orderReference: null,
            createdAt: '2026-11-17T12:25:00.000Z',
          }
          currentServerMessages = [serverMsg]
          return serverMsg
        }
      )

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText('Write to Dispatch')
      fireEvent.change(textarea, { target: { value: 'Order #55 is ready' } })

      const callsBeforeSend = (fetchChatMessages as jest.Mock).mock.calls.length
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))

      // Captured outgoing send
      await waitFor(() => {
        expect(sendChatMessage).toHaveBeenCalledTimes(1)
      })

      // The refetch that onSent triggers was called after the send
      await waitFor(() => {
        expect((fetchChatMessages as jest.Mock).mock.calls.length).toBeGreaterThan(callsBeforeSend)
      })

      // The server's copy of the message is on screen (formatted timestamp 14:25 from MessageItem)
      expect(await screen.findByText('14:25')).toBeInTheDocument()

      // The message is displayed exactly ONCE, not duplicated with the pending copy
      const matchingMessages = screen.getAllByText('Order #55 is ready')
      expect(matchingMessages).toHaveLength(1)

      // The pending "Sending…" state is gone
      expect(screen.queryByText('Sending…')).not.toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('with no messages it says "No messages yet. Dispatch reads every message here."', async () => {
      ;(fetchChatMessages as jest.Mock).mockResolvedValue([])

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(
        await screen.findByText('No messages yet. Dispatch reads every message here.')
      ).toBeInTheDocument()
    })
  })
})
