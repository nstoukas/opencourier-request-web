import { manualRequestFetch } from './manualRequestApi'

// Spec 0034 (chat), AC-14: the restaurant's one conversation with the co-op's dispatch, through the
// app's own partner proxy. The browser holds no credential; the server finds the thread from the session.

export type ChatSenderKind = 'DISPATCH' | 'COURIER' | 'PARTNER' | 'SYSTEM'

export type ChatMessage = {
  id: string
  senderKind: ChatSenderKind
  // "Dispatch" on dispatch's messages (AC-5). The sheet does not read it: it writes "Dispatch" itself.
  senderName: string | null
  body: string
  deliveryId: string | null
  orderReference: string | null
  clientMessageId?: string
  createdAt: string
  // On the restaurant's own messages only: true once any dispatcher opened the thread after it (AC-6).
  readByDispatch?: boolean
}

export async function fetchChatMessages(): Promise<ChatMessage[]> {
  const answer = await manualRequestFetch<{ messages: ChatMessage[] }>('/chat/messages')
  return answer.messages
}

export async function sendChatMessage(input: { body: string; clientMessageId: string }): Promise<ChatMessage> {
  return manualRequestFetch<ChatMessage>('/chat/messages', { method: 'POST', body: JSON.stringify(input) })
}
