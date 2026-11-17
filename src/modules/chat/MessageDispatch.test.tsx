import React from 'react'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MessageDispatch, OPEN_POLL_MS, CLOSED_POLL_MS } from './MessageDispatch'
import { fetchChatMessages, sendChatMessage, type ChatMessage } from '../../api/chatApi'
import { formatDateTime, formatTime } from '../../utils/format'
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

    it('focuses the message box (id dispatch-message) on open, and restores focus to Message Dispatch button on Escape', async () => {
      render(<MessageDispatch />)

      const triggerBtn = screen.getByRole('button', { name: 'Message Dispatch' })
      fireEvent.click(triggerBtn)

      // On open, focus goes straight into the message box (id dispatch-message)
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText('Write to Dispatch')
      expect(textarea.id).toBe('dispatch-message')
      expect(document.activeElement).toBe(textarea)

      // Press Escape to close the sheet
      fireEvent.keyDown(textarea, { key: 'Escape', code: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 2, name: 'Dispatch' })).not.toBeInTheDocument()
      })

      // After the sheet closes with Escape, document.activeElement is the Message Dispatch button
      expect(document.activeElement).toBe(triggerBtn)
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
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

      const messages: ChatMessage[] = [
        {
          id: 'partner-unread',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Order #42 is ready',
          deliveryId: 'cuid000042',
          orderReference: '42',
          readByDispatch: false,
          createdAt: `${todayAthens}T12:00:00.000Z`,
        },
        {
          id: 'partner-read',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Order #43 has drinks',
          deliveryId: 'cuid000043',
          orderReference: '43',
          readByDispatch: true,
          createdAt: `${todayAthens}T12:05:00.000Z`,
        },
        {
          id: 'partner-absent',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Order #44 extra napkins',
          deliveryId: null,
          orderReference: '44',
          // readByDispatch is absent / undefined
          createdAt: `${todayAthens}T12:10:00.000Z`,
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
          createdAt: `${todayAthens}T12:15:00.000Z`,
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/i }))

      expect(await screen.findByText('Order #42 is ready')).toBeInTheDocument()

      // Exactly one " · read" mark should appear in the document (for partner-read)
      const readMarks = screen.getAllByText(/· read/)
      expect(readMarks.length).toBe(1)
      expect(readMarks[0]).toHaveTextContent('· #000043 · read')

      // partner-unread shows order code (#000042) but not read
      expect(screen.getByText(/· #000042$/)).toBeInTheDocument()

      // partner-absent has deliveryId null, so no order code tag is shown (orderReference is ignored)
      expect(screen.queryByText(/· #44/)).not.toBeInTheDocument()
      expect(screen.queryByText(/· #000044/)).not.toBeInTheDocument()

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
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

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
            createdAt: `${todayAthens}T12:25:00.000Z`,
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

    it('shows "Messages can\'t be reached right now. They will load again on their own." when initial fetch fails', async () => {
      ;(fetchChatMessages as jest.Mock).mockRejectedValue(new Error('Backend offline'))

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: 'Message Dispatch' }))

      expect(
        await screen.findByText("Messages can't be reached right now. They will load again on their own.")
      ).toBeInTheDocument()
    })
  })

  describe('Lost on close and draft preservation (AC-19)', () => {
    it('draft typed, closed and reopened is still in the box', async () => {
      render(<MessageDispatch />)
      const button = screen.getByRole('button', { name: 'Message Dispatch' })
      fireEvent.click(button)

      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText('Write to Dispatch') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Draft text for dispatch' } })
      expect(textarea.value).toBe('Draft text for dispatch')

      // Close the sheet via Close button
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 2, name: 'Dispatch' })).not.toBeInTheDocument()
      })

      // Reopen sheet: draft is still in the box
      fireEvent.click(screen.getByRole('button', { name: 'Message Dispatch' }))
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()
      const reopenedTextarea = screen.getByPlaceholderText('Write to Dispatch') as HTMLTextAreaElement
      expect(reopenedTextarea.value).toBe('Draft text for dispatch')
    })

    it('type and send, close sheet while send is pending, send rejects: "Not sent, tap to retry" is there and retry sends the same clientMessageId; while closed button says "Message Dispatch, a message was not sent" and dot shows', async () => {
      let rejectSend!: (err: Error) => void
      const pendingPromise = new Promise<{ id: string }>((_, reject) => {
        rejectSend = reject
      })
      ;(sendChatMessage as jest.Mock).mockImplementationOnce(() => pendingPromise)

      render(<MessageDispatch />)
      const openBtn = screen.getByRole('button', { name: 'Message Dispatch' })
      fireEvent.click(openBtn)

      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText('Write to Dispatch')
      fireEvent.change(textarea, { target: { value: 'Delay on order #12' } })

      // Send the message
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(sendChatMessage).toHaveBeenCalledTimes(1)
      const capturedClientId = (sendChatMessage as jest.Mock).mock.calls[0][0].clientMessageId
      expect(capturedClientId).toMatch(/^restaurant-/)

      // While send is pending, close the sheet
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 2, name: 'Dispatch' })).not.toBeInTheDocument()
      })

      // Send rejects while closed (e.g. network timeout or drop)
      await act(async () => {
        rejectSend(new Error('Connection lost'))
      })

      // While closed with a failed message, button's accessible name is "Message Dispatch, a message was not sent" and dot shows
      const failedButton = await screen.findByRole('button', {
        name: 'Message Dispatch, a message was not sent',
      })
      expect(failedButton).toBeInTheDocument()
      const redDot = failedButton.querySelector('.bg-destructive')
      expect(redDot).toBeInTheDocument()
      expect(redDot).toHaveAttribute('aria-hidden', 'true')

      // Reopen sheet: "Not sent, tap to retry" is there
      fireEvent.click(failedButton)
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()
      expect(screen.getByText('Delay on order #12')).toBeInTheDocument()
      const retryBtn = await screen.findByRole('button', { name: 'Not sent, tap to retry' })
      expect(retryBtn).toBeInTheDocument()

      // Tap retry sends the same clientMessageId
      ;(sendChatMessage as jest.Mock).mockResolvedValueOnce({
        id: 'server-confirmed-after-retry',
        senderKind: 'PARTNER',
        senderName: null,
        body: 'Delay on order #12',
        clientMessageId: capturedClientId,
        deliveryId: null,
        orderReference: null,
        createdAt: new Date().toISOString(),
      })

      fireEvent.click(retryBtn)
      await waitFor(() => {
        expect(sendChatMessage).toHaveBeenCalledTimes(2)
      })
      expect((sendChatMessage as jest.Mock).mock.calls[1][0]).toEqual({
        body: 'Delay on order #12',
        clientMessageId: capturedClientId,
      })
    })
  })

  describe('Refusal reasons and retry targets', () => {
    it('refusal with 400 shows backend sentence plus retry; network failure (no statusCode) or 401 shows no sentence only retry', async () => {
      // 1. 400 with "Body too long"
      const err400 = Object.assign(new Error('Body too long'), { statusCode: 400 })
      ;(sendChatMessage as jest.Mock).mockRejectedValueOnce(err400)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: 'Message Dispatch' }))
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText('Write to Dispatch')
      fireEvent.change(textarea, { target: { value: 'Too long message...' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))

      // Shows backend sentence and retry button (min-h-8)
      expect(await screen.findByText('Body too long')).toBeInTheDocument()
      const retryBtn = screen.getByRole('button', { name: 'Not sent, tap to retry' })
      expect(retryBtn).toBeInTheDocument()
      expect(retryBtn).toHaveClass('min-h-8')

      // 2. Network failure (no statusCode)
      ;(sendChatMessage as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))
      fireEvent.change(textarea, { target: { value: 'Network fail test' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Not sent, tap to retry' })).toHaveLength(2)
      })
      // Does not show "Failed to fetch"
      expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()

      // 3. 401 unauthorized (handled by frame/auth recheck, no sentence shown in chat)
      const err401 = Object.assign(new Error('Unauthorized'), { statusCode: 401 })
      ;(sendChatMessage as jest.Mock).mockRejectedValueOnce(err401)
      fireEvent.change(textarea, { target: { value: 'Auth fail test' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Not sent, tap to retry' })).toHaveLength(3)
      })
      expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument()
    })
  })

  describe('Screen reader "You" and timestamps', () => {
    it('restaurant PARTNER messages carry visually hidden "You," before time; dispatch DISPATCH messages do not', async () => {
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

      const messages: ChatMessage[] = [
        {
          id: 'partner-1',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Restaurant note',
          deliveryId: null,
          orderReference: null,
          createdAt: `${todayAthens}T12:00:00.000Z`,
        },
        {
          id: 'dispatch-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Dispatch reply',
          deliveryId: null,
          orderReference: null,
          createdAt: `${todayAthens}T12:05:00.000Z`,
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: 'Message Dispatch' }))
      expect(await screen.findByText('Restaurant note')).toBeInTheDocument()

      // The sr-only "You, " is present for the partner message
      const youSpans = screen.getAllByText('You,')
      expect(youSpans).toHaveLength(1)
      expect(youSpans[0]).toHaveClass('sr-only')

      // Find the metadata container for the dispatch message
      const dispatchMeta = screen.getByText(/^Dispatch ·/)
      expect(dispatchMeta.querySelector('.sr-only')).toBeNull()
      expect(dispatchMeta).not.toHaveTextContent('You')
    })

    it('today messages show formatTime; messages from earlier days show formatDateTime (date and time)', async () => {
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

      const oldIso = '2026-10-15T09:30:00.000Z'
      const todayIso = `${todayAthens}T09:30:00.000Z`

      const messages: ChatMessage[] = [
        {
          id: 'msg-old',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Message from last month',
          deliveryId: null,
          orderReference: null,
          createdAt: oldIso,
        },
        {
          id: 'msg-today',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Message from today',
          deliveryId: null,
          orderReference: null,
          createdAt: todayIso,
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/ }))

      expect(await screen.findByText('Message from last month')).toBeInTheDocument()
      expect(screen.getByText('Message from today')).toBeInTheDocument()

      // Older message shows formatDateTime (date and time)
      expect(screen.getByText(new RegExp(formatDateTime(oldIso)))).toBeInTheDocument()

      // Today's message shows formatTime (time only, without date)
      expect(screen.getByText(new RegExp(`Dispatch · ${formatTime(todayIso)}$`))).toBeInTheDocument()
    })
  })

  describe('Seen per restaurant isolation', () => {
    it('MessageDispatch with email A marking seen does not hide the dot for email B', async () => {
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

      const messages: ChatMessage[] = [
        {
          id: 'disp-msg-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Dispatch to restaurants',
          deliveryId: null,
          orderReference: null,
          createdAt: `${todayAthens}T12:00:00.000Z`,
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      // 1. Restaurant A opens sheet: marks seen under A's key
      const { unmount } = render(<MessageDispatch email="restaurant-a@volos.gr" />)
      const btnA = await screen.findByRole('button', { name: 'Message Dispatch, new message' })
      expect(btnA).toBeInTheDocument()

      fireEvent.click(btnA)
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()

      // Close sheet for A
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Message Dispatch' })).toBeInTheDocument()
      })
      unmount()

      // 2. Restaurant B renders on the same browser
      render(<MessageDispatch email="restaurant-b@volos.gr" />)

      // Restaurant B has NOT seen this message yet: button accessible name has "new message" and dot shows
      const btnB = await screen.findByRole('button', { name: 'Message Dispatch, new message' })
      expect(btnB).toBeInTheDocument()
      expect(btnB.querySelector('.bg-destructive')).toBeInTheDocument()
    })
  })

  describe('Opening sheet refetches immediately and keeps loaded messages', () => {
    it('opening sheet calls fetchChatMessages at once and messages already loaded stay on screen (no Loading messages…)', async () => {
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

      const messages: ChatMessage[] = [
        {
          id: 'disp-preloaded',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Preloaded dispatch conversation',
          deliveryId: null,
          orderReference: null,
          createdAt: `${todayAthens}T12:00:00.000Z`,
        },
      ]
      ;(fetchChatMessages as jest.Mock).mockResolvedValue(messages)

      render(<MessageDispatch />)

      // Wait for initial background poll to finish
      await waitFor(() => {
        expect(fetchChatMessages).toHaveBeenCalledTimes(1)
      })

      // Clicking opens the sheet
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/ }))

      // Opening calls fetchChatMessages at once
      expect(fetchChatMessages).toHaveBeenCalledTimes(2)

      // The preloaded messages are on screen immediately; "Loading messages…" is NOT shown
      expect(screen.getByText('Preloaded dispatch conversation')).toBeInTheDocument()
      expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument()
    })
  })

  describe('Screen reader announcements', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.clearAllTimers()
      jest.useRealTimers()
    })

    it('the message list has no aria-live; first load on open announces nothing; a new DISPATCH message puts "New message from Dispatch" in role=status', async () => {
      const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
      const todayAthens = athensDay.format(new Date())

      const initialMessages: ChatMessage[] = [
        {
          id: 'disp-first',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Initial dispatch note',
          deliveryId: null,
          orderReference: null,
          createdAt: `${todayAthens}T12:00:00.000Z`,
        },
      ]
      let currentMessages = initialMessages
      ;(fetchChatMessages as jest.Mock).mockImplementation(async () => currentMessages)

      render(<MessageDispatch />)

      // Resolve initial poll
      await act(async () => {
        await Promise.resolve()
      })

      // Click to open sheet
      fireEvent.click(screen.getByRole('button', { name: /Message Dispatch/ }))

      await act(async () => {
        await Promise.resolve()
      })

      // 1. Neither the message list nor any ancestor of a message inside the sheet has aria-live (other than "off") or role log/status/alert
      const sheet = screen.getByRole('dialog')
      const list = screen.getByRole('list')
      const message = screen.getByText('Initial dispatch note')

      // Walk from the message up through its ancestors inside the sheet (message -> li -> ol -> scrolling wrapper div -> dialog)
      const messageAncestors: HTMLElement[] = []
      let current: HTMLElement | null = message
      while (current && current !== sheet) {
        messageAncestors.push(current)
        current = current.parentElement
      }
      messageAncestors.push(sheet)

      expect(messageAncestors).toContain(list)

      for (const el of messageAncestors) {
        const ariaLive = el.getAttribute('aria-live')
        if (ariaLive !== null) {
          expect(ariaLive).toBe('off')
        }
        const role = el.getAttribute('role')
        expect(['log', 'status', 'alert']).not.toContain(role)
      }

      // 2. Separate role=status announcement line still exists, outside message tree, and on first load announces nothing
      const statusEl = screen.getByRole('status')
      expect(statusEl).toBeInTheDocument()
      expect(statusEl).toBeEmptyDOMElement()
      expect(statusEl).toHaveClass('sr-only')
      expect(statusEl).toHaveAttribute('aria-live', 'polite')
      expect(messageAncestors).not.toContain(statusEl)

      // 3. A new DISPATCH message arrives while sheet is open (via 5s poll)
      currentMessages = [
        ...initialMessages,
        {
          id: 'disp-second',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Rider is outside',
          deliveryId: null,
          orderReference: null,
          createdAt: `${todayAthens}T12:05:00.000Z`,
        },
      ]

      await act(async () => {
        jest.advanceTimersByTime(OPEN_POLL_MS)
      })

      expect(screen.getByText('Rider is outside')).toBeInTheDocument()
      expect(statusEl).toHaveTextContent('New message from Dispatch')

      // 4. Closing the sheet unmounts SheetContent (and resets announcement)
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('Keyboard handling and input constraints', () => {
    it('Enter submits message; Shift+Enter does not submit; IME composition guard stops submit; whitespace cannot be sent', async () => {
      render(<MessageDispatch />)
      fireEvent.click(screen.getByRole('button', { name: 'Message Dispatch' }))
      expect(await screen.findByRole('heading', { level: 2, name: 'Dispatch' })).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText('Write to Dispatch')
      const sendBtn = screen.getByRole('button', { name: 'Send' })

      // 1. Whitespace only: Send button disabled, Enter does not send
      fireEvent.change(textarea, { target: { value: '   ' } })
      expect(sendBtn).toBeDisabled()
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
      expect(sendChatMessage).not.toHaveBeenCalled()

      // 2. Shift+Enter does not submit
      fireEvent.change(textarea, { target: { value: 'Multi-line message' } })
      expect(sendBtn).not.toBeDisabled()
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true })
      expect(sendChatMessage).not.toHaveBeenCalled()

      // 3. IME composition guard: Enter with isComposing true does not submit
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', isComposing: true })
      expect(sendChatMessage).not.toHaveBeenCalled()

      // 4. Plain Enter submits
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
      expect(sendChatMessage).toHaveBeenCalledTimes(1)
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Multi-line message' })
      )
    })
  })
})
