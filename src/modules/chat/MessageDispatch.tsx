import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatCircle } from '@phosphor-icons/react'
import { fetchChatMessages, sendChatMessage, type ChatMessage } from '../../api/chatApi'
import { usePolledFetch } from '../../hooks/usePolledFetch'
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from '../../admin-web-components'
import { hasUnseen, markSeen, readChatSeen, type ChatSeen } from './chatSeen'

// Spec 0034 (chat), AC-14: the restaurant asks again every 5 s while the sheet is open, and every 30 s
// while it is closed (for the unread dot), only while the tab is visible (usePolledFetch).
export const OPEN_POLL_MS = 5_000
export const CLOSED_POLL_MS = 30_000
export const CHAT_MESSAGE_MAX_LENGTH = 1000

type Outgoing = { clientMessageId: string; body: string; state: 'sending' | 'failed' }

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hour12: false })

function newClientMessageId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `restaurant-${random}`
}

// Spec 0034 (chat), AC-14: Message Dispatch, in the signed in header. A side sheet with the restaurant's
// one conversation with the co-op's dispatch. No presets: those are for riders on the road.
export function MessageDispatch() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<ChatSeen | null>(null)
  useEffect(() => setSeen(readChatSeen()), [])

  const load = useCallback(() => fetchChatMessages(), [])
  const { data, error, isLoading, refetch } = usePolledFetch(load, {
    enabled: true,
    intervalMs: open ? OPEN_POLL_MS : CLOSED_POLL_MS,
  })

  // What is on screen while the sheet is open is seen, in this browser only.
  useEffect(() => {
    if (open && data) setSeen((current) => markSeen(data, current))
  }, [open, data])

  const unseen = !open && hasUnseen(data, seen)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        className="relative shrink-0 px-3"
        onClick={() => setOpen(true)}
        aria-label={unseen ? 'Message Dispatch, new message' : 'Message Dispatch'}
      >
        <ChatCircle aria-hidden="true" className="size-5 sm:mr-2 sm:size-4" />
        <span className="hidden sm:inline">Message Dispatch</span>
        {unseen ? (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-destructive" />
        ) : null}
      </Button>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>Dispatch</SheetTitle>
          <SheetDescription>Write to the co-op&apos;s dispatch about an order or anything else.</SheetDescription>
        </SheetHeader>
        <Conversation
          messages={data}
          loading={isLoading}
          failedToLoad={Boolean(error) && !data}
          onSent={() => void refetch()}
        />
      </SheetContent>
    </Sheet>
  )
}

function Conversation({
  messages,
  loading,
  failedToLoad,
  onSent,
}: {
  messages: ChatMessage[] | undefined
  loading: boolean
  failedToLoad: boolean
  onSent: () => void
}) {
  const [text, setText] = useState('')
  const [outgoing, setOutgoing] = useState<Outgoing[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  const shownClientIds = useMemo(
    () => new Set((messages ?? []).map((message) => message.clientMessageId).filter(Boolean)),
    [messages],
  )
  // A sent message leaves this list once the server's list holds it.
  const pending = outgoing.filter((item) => !shownClientIds.has(item.clientMessageId))

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length, pending.length])

  async function deliver(item: Outgoing) {
    setOutgoing((list) => list.map((entry) => (entry.clientMessageId === item.clientMessageId ? { ...entry, state: 'sending' } : entry)))
    try {
      // The same clientMessageId on a retry: the server never makes a second message (AC-19).
      await sendChatMessage({ body: item.body, clientMessageId: item.clientMessageId })
      onSent()
    } catch {
      setOutgoing((list) => list.map((entry) => (entry.clientMessageId === item.clientMessageId ? { ...entry, state: 'failed' } : entry)))
    }
  }

  function submit() {
    const body = text.trim()
    if (body.length === 0 || body.length > CHAT_MESSAGE_MAX_LENGTH) return
    const item: Outgoing = { clientMessageId: newClientMessageId(), body, state: 'sending' }
    setOutgoing((list) => [...list, item])
    setText('')
    void deliver(item)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {loading && !messages ? <p className="text-sm text-muted-foreground">Loading messages…</p> : null}
        {failedToLoad ? (
          <p role="status" className="text-sm text-destructive">
            Messages can&apos;t be reached right now. They will load again on their own.
          </p>
        ) : null}
        {messages && messages.length === 0 && pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Dispatch reads every message here.</p>
        ) : null}
        <ol className="space-y-4">
          {(messages ?? []).map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          {pending.map((item) => (
            <li key={item.clientMessageId} className="flex flex-col items-end gap-1">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary/70 px-4 py-2 text-primary-foreground">
                {item.body}
              </p>
              {item.state === 'failed' ? (
                <button
                  type="button"
                  onClick={() => void deliver(item)}
                  className="text-xs font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Not sent, tap to retry
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Sending…</span>
              )}
            </li>
          ))}
        </ol>
        <div ref={endRef} />
      </div>
      <form
        className="space-y-2 border-t p-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor="dispatch-message" className="sr-only">
          Message to Dispatch
        </label>
        <Textarea
          id="dispatch-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write to Dispatch"
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={text.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </>
  )
}

function MessageItem({ message }: { message: ChatMessage }) {
  const time = clock.format(new Date(message.createdAt))
  const order = message.orderReference ? ` · #${message.orderReference}` : ''
  const mine = message.senderKind === 'PARTNER'
  return (
    <li className={mine ? 'flex flex-col items-end gap-1' : 'flex flex-col items-start gap-1'}>
      <p
        className={
          mine
            ? 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-4 py-2 text-primary-foreground'
            : 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-4 py-2'
        }
      >
        {message.body}
      </p>
      <span className="text-xs text-muted-foreground">
        {/* AC-5: a restaurant sees dispatch as "Dispatch", never a person, whatever senderName says. */}
        {mine ? time : `Dispatch · ${time}`}
        {order}
        {/* AC-6: "read" once any dispatcher opened the thread after it. */}
        {mine && message.readByDispatch ? ' · read' : ''}
      </span>
    </li>
  )
}
