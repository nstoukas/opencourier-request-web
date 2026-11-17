import type { ChatMessage } from '../../api/chatApi'
import {
  CHAT_SEEN_KEY,
  hasUnseen,
  markSeen,
  newestFromDispatch,
  readChatSeen,
  type ChatSeen,
} from './chatSeen'

// Spec 0034 (chat), AC-14: restaurant unread dot logic. Worked out in this browser, from the newest
// dispatch message on screen; dispatch never learns whether or when the restaurant read it (AC-6).
describe('chatSeen (spec 0034, AC-6, AC-14)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.restoreAllMocks()
  })

  describe('readChatSeen', () => {
    it('returns null when storage key is missing', () => {
      expect(readChatSeen()).toBeNull()
    })

    it('returns null for malformed JSON string', () => {
      window.localStorage.setItem(CHAT_SEEN_KEY, 'not-json')
      expect(readChatSeen()).toBeNull()
    })

    it('returns null when parsed object lacks a valid id or createdAt string', () => {
      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify({ id: 123, createdAt: '2026-11-17T12:00:00.000Z' }))
      expect(readChatSeen()).toBeNull()

      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify({ id: 'msg-1' }))
      expect(readChatSeen()).toBeNull()

      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify({ createdAt: '2026-11-17T12:00:00.000Z' }))
      expect(readChatSeen()).toBeNull()

      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(null))
      expect(readChatSeen()).toBeNull()
    })

    it('returns ChatSeen object when valid data is in storage', () => {
      const valid: ChatSeen = { id: 'msg-disp-1', createdAt: '2026-11-17T12:00:00.000Z' }
      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(valid))
      expect(readChatSeen()).toEqual(valid)
    })

    it('returns null if window.localStorage.getItem throws (e.g. private mode / storage blocked)', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Access denied to localStorage')
      })
      expect(readChatSeen()).toBeNull()
    })
  })

  describe('newestFromDispatch', () => {
    it('returns null when messages is undefined or empty', () => {
      expect(newestFromDispatch(undefined)).toBeNull()
      expect(newestFromDispatch([])).toBeNull()
    })

    it('ignores PARTNER, COURIER, and SYSTEM messages and returns null if no DISPATCH message exists', () => {
      const messages: ChatMessage[] = [
        {
          id: 'p-1',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Hello dispatch',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00.000Z',
        },
        {
          id: 'c-1',
          senderKind: 'COURIER',
          senderName: null,
          body: 'At the store',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:05:00.000Z',
        },
        {
          id: 's-1',
          senderKind: 'SYSTEM',
          senderName: null,
          body: 'System note',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:10:00.000Z',
        },
      ]
      expect(newestFromDispatch(messages)).toBeNull()
    })

    it('picks the newest DISPATCH message by createdAt timestamp', () => {
      const older: ChatMessage = {
        id: 'disp-old',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Older dispatch msg',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:00:00.000Z',
      }
      const newer: ChatMessage = {
        id: 'disp-new',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Newer dispatch msg',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:15:00.000Z',
      }
      expect(newestFromDispatch([older, newer])).toEqual(newer)
      expect(newestFromDispatch([newer, older])).toEqual(newer)
    })
  })

  describe('hasUnseen', () => {
    it('returns false when messages is empty or undefined', () => {
      expect(hasUnseen(undefined, null)).toBe(false)
      expect(hasUnseen([], null)).toBe(false)
    })

    it('returns true when a DISPATCH message exists and seen is null', () => {
      const msg: ChatMessage = {
        id: 'disp-1',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Rider assigned',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:00:00.000Z',
      }
      expect(hasUnseen([msg], null)).toBe(true)
    })

    it('returns true when the newest DISPATCH message is newer than stored seen', () => {
      const seen: ChatSeen = { id: 'disp-1', createdAt: '2026-11-17T12:00:00.000Z' }
      const newMsg: ChatMessage = {
        id: 'disp-2',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Rider delayed 5 mins',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:10:00.000Z',
      }
      expect(hasUnseen([newMsg], seen)).toBe(true)
    })

    it('returns false when the newest DISPATCH message is equal to or older than stored seen', () => {
      const seen: ChatSeen = { id: 'disp-2', createdAt: '2026-11-17T12:10:00.000Z' }
      const msg: ChatMessage = {
        id: 'disp-2',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Same message',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:10:00.000Z',
      }
      expect(hasUnseen([msg], seen)).toBe(false)

      const olderMsg: ChatMessage = {
        id: 'disp-1',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Older message',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:05:00.000Z',
      }
      expect(hasUnseen([olderMsg], seen)).toBe(false)
    })

    it('PARTNER, COURIER and SYSTEM messages never make it unseen', () => {
      // 1. Only PARTNER / COURIER / SYSTEM messages with seen = null: still false
      const partnerMsg: ChatMessage = {
        id: 'p-1',
        senderKind: 'PARTNER',
        senderName: null,
        body: 'My own outgoing message',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:00:00.000Z',
      }
      const systemMsg: ChatMessage = {
        id: 's-1',
        senderKind: 'SYSTEM',
        senderName: null,
        body: 'System event',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:05:00.000Z',
      }
      expect(hasUnseen([partnerMsg, systemMsg], null)).toBe(false)

      // 2. Dispatch message already seen, but a NEWER PARTNER or SYSTEM message arrived: still false
      const seenDispatch: ChatSeen = { id: 'disp-1', createdAt: '2026-11-17T12:00:00.000Z' }
      const dispMsg: ChatMessage = {
        id: 'disp-1',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Hello',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:00:00.000Z',
      }
      const newerPartnerMsg: ChatMessage = {
        id: 'p-2',
        senderKind: 'PARTNER',
        senderName: null,
        body: 'Understood thanks',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:20:00.000Z',
      }
      expect(hasUnseen([dispMsg, newerPartnerMsg], seenDispatch)).toBe(false)
    })
  })

  describe('markSeen', () => {
    it('stores the newest dispatch message in localStorage and returns it', () => {
      const msg: ChatMessage = {
        id: 'disp-10',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'New order coming',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:30:00.000Z',
      }
      const result = markSeen([msg], null)
      expect(result).toEqual({ id: 'disp-10', createdAt: '2026-11-17T12:30:00.000Z' })
      expect(JSON.parse(window.localStorage.getItem(CHAT_SEEN_KEY)!)).toEqual(result)
    })

    it('returns current and does not update storage if messages has no DISPATCH message', () => {
      const current: ChatSeen = { id: 'disp-1', createdAt: '2026-11-17T12:00:00.000Z' }
      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(current))

      const partnerOnly: ChatMessage[] = [
        {
          id: 'p-1',
          senderKind: 'PARTNER',
          senderName: null,
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:10:00.000Z',
        },
      ]

      const result = markSeen(partnerOnly, current)
      expect(result).toEqual(current)
      expect(JSON.parse(window.localStorage.getItem(CHAT_SEEN_KEY)!)).toEqual(current)
    })

    it('never moves backwards: does not overwrite if current seen is newer than newest dispatch message', () => {
      const current: ChatSeen = { id: 'disp-newer', createdAt: '2026-11-17T12:30:00.000Z' }
      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(current))

      const olderDispatch: ChatMessage = {
        id: 'disp-older',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Old message',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:15:00.000Z',
      }

      const result = markSeen([olderDispatch], current)
      expect(result).toEqual(current)
      // Storage still holds the newer one
      expect(JSON.parse(window.localStorage.getItem(CHAT_SEEN_KEY)!)).toEqual(current)
    })

    it('never moves backwards: does not overwrite if current seen has exact same timestamp', () => {
      const current: ChatSeen = { id: 'disp-1', createdAt: '2026-11-17T12:00:00.000Z' }
      window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(current))

      const sameTimestampMsg: ChatMessage = {
        id: 'disp-1',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Same timestamp',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:00:00.000Z',
      }

      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
      const result = markSeen([sameTimestampMsg], current)
      expect(result).toEqual(current)
      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('survives a throwing localStorage.setItem without crashing and returns the next ChatSeen', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError or private storage blocked')
      })

      const msg: ChatMessage = {
        id: 'disp-new',
        senderKind: 'DISPATCH',
        senderName: 'Dispatch',
        body: 'Hello',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:45:00.000Z',
      }

      // Does not throw
      expect(() => {
        const result = markSeen([msg], null)
        expect(result).toEqual({ id: 'disp-new', createdAt: '2026-11-17T12:45:00.000Z' })
      }).not.toThrow()
    })
  })
})
