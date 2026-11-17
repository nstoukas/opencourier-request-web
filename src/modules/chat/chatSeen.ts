import type { ChatMessage } from '../../api/chatApi'

// Spec 0034 (chat), AC-14: whether dispatch wrote something new is worked out in this browser, from the
// newest dispatch message the restaurant had on screen. The server never learns it (AC-6).
export const CHAT_SEEN_KEY = 'oc_chat_last_seen'

export type ChatSeen = { id: string; createdAt: string }

export function readChatSeen(): ChatSeen | null {
  try {
    const raw = window.localStorage.getItem(CHAT_SEEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<ChatSeen>) : null
    return parsed && typeof parsed.id === 'string' && typeof parsed.createdAt === 'string'
      ? { id: parsed.id, createdAt: parsed.createdAt }
      : null
  } catch {
    // Storage blocked (a private window): nothing is remembered as seen.
    return null
  }
}

export function newestFromDispatch(messages: ChatMessage[] | undefined): ChatMessage | null {
  let newest: ChatMessage | null = null
  for (const message of messages ?? []) {
    if (message.senderKind === 'DISPATCH' && (!newest || message.createdAt > newest.createdAt)) newest = message
  }
  return newest
}

export function hasUnseen(messages: ChatMessage[] | undefined, seen: ChatSeen | null): boolean {
  const newest = newestFromDispatch(messages)
  if (!newest) return false
  return !seen || (newest.id !== seen.id && newest.createdAt > seen.createdAt)
}

// The sheet was open with these messages: all of dispatch's are seen. Returns what is stored now.
export function markSeen(messages: ChatMessage[] | undefined, current: ChatSeen | null): ChatSeen | null {
  const newest = newestFromDispatch(messages)
  if (!newest || (current && current.createdAt >= newest.createdAt)) return current
  const next = { id: newest.id, createdAt: newest.createdAt }
  try {
    window.localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(next))
  } catch {
    // Not remembered: the dot comes back after a reload.
  }
  return next
}
