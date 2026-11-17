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
  SheetTrigger,
  Textarea,
} from '../../admin-web-components'
import { formatDateTime, formatTime } from '../../utils/format'
import { orderCodeOf } from '../../utils/orderCode'
import { chatSeenKey, hasUnseen, markSeen, newestFromDispatch, readChatSeen, type ChatSeen } from './chatSeen'

// Spec 0034 (chat), AC-14: the restaurant asks again every 5 s while the sheet is open, and every 30 s
// while it is closed (for the unread dot), only while the tab is visible (usePolledFetch).
export const OPEN_POLL_MS = 5_000
export const CLOSED_POLL_MS = 30_000
export const CHAT_MESSAGE_MAX_LENGTH = 1000

// A message on its way. `reason` is the backend's own sentence when it refused the message (a 4xx),
// so the restaurant knows a retry will not help; a network failure has none.
type Outgoing = { clientMessageId: string; body: string; state: 'sending' | 'failed'; reason?: string }

const MESSAGE_BOX_ID = 'dispatch-message'

const athensDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })

// Today's messages show the time; older ones the date too, since a thread lasts up to 90 days (AC-18).
function stampOf(iso: string): string {
  const sameDay = athensDay.format(new Date(iso)) === athensDay.format(new Date())
  return sameDay ? formatTime(iso) : formatDateTime(iso)
}

function newClientMessageId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `restaurant-${random}`
}

// The backend's sentence for a refusal (4xx), or nothing for a network failure or a 401 (the frame
// handles a 401 by checking the session again).
function refusalOf(error: unknown): string | undefined {
  const status = (error as { statusCode?: number } | null)?.statusCode
  if (typeof status !== 'number' || status < 400 || status >= 500 || status === 401) return undefined
  return error instanceof Error && error.message ? error.message : undefined
}

// Spec 0034 (chat), AC-14: Message Dispatch, in the signed in header. A side sheet with the restaurant's
// one conversation with the co-op's dispatch. No presets: those are for riders on the road.
// What is being sent lives here, not in the sheet, so closing the sheet never loses it (AC-19).
export function MessageDispatch({ email = null }: { email?: string | null }) {
  const [open, setOpen] = useState(false)
  const seenKey = chatSeenKey(email)
  const [seen, setSeen] = useState<ChatSeen | null>(null)
  useEffect(() => setSeen(readChatSeen(seenKey)), [seenKey])

  const load = useCallback(() => fetchChatMessages(), [])
  const { data, error, isLoading, refetch } = usePolledFetch(load, {
    enabled: true,
    intervalMs: open ? OPEN_POLL_MS : CLOSED_POLL_MS,
  })

  // Opening asks at once, instead of waiting up to 5 s; the answer already on screen stays meanwhile.
  useEffect(() => {
    if (open) void refetch()
  }, [open, refetch])

  // What is on screen while the sheet is open is seen, in this browser only.
  useEffect(() => {
    if (open && data) setSeen((current) => markSeen(data, current, seenKey))
  }, [open, data, seenKey])

  // A screen reader hears a new message from dispatch that arrives while the sheet is open, and not
  // the whole conversation again each time it loads.
  const [announcement, setAnnouncement] = useState('')
  const newestDispatchId = newestFromDispatch(data)?.id ?? null
  const lastDispatchId = useRef<string | null>(null)
  useEffect(() => {
    if (open && lastDispatchId.current && newestDispatchId && newestDispatchId !== lastDispatchId.current) {
      setAnnouncement('New message from Dispatch')
    }
    lastDispatchId.current = newestDispatchId
  }, [open, newestDispatchId])
  useEffect(() => {
    if (!open) setAnnouncement('')
  }, [open])

  const [text, setText] = useState('')
  const [outgoing, setOutgoing] = useState<Outgoing[]>([])
  const shownClientIds = useMemo(
    () => new Set((data ?? []).map((message) => message.clientMessageId).filter(Boolean)),
    [data],
  )
  // A sent message leaves this list once the server's list holds it.
  const pending = outgoing.filter((item) => !shownClientIds.has(item.clientMessageId))
  const notSent = pending.some((item) => item.state === 'failed')

  async function deliver(item: Outgoing) {
    setOutgoing((list) =>
      list.map((entry) => (entry.clientMessageId === item.clientMessageId ? { ...entry, state: 'sending', reason: undefined } : entry)),
    )
    try {
      // The same clientMessageId on a retry: the server never makes a second message (AC-19).
      await sendChatMessage({ body: item.body, clientMessageId: item.clientMessageId })
      void refetch()
    } catch (sendError) {
      const reason = refusalOf(sendError)
      setOutgoing((list) =>
        list.map((entry) => (entry.clientMessageId === item.clientMessageId ? { ...entry, state: 'failed', reason } : entry)),
      )
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

  const unseen = !open && hasUnseen(data, seen)
  const showDot = !open && (unseen || notSent)
  const buttonName = !open && notSent
    ? 'Message Dispatch, a message was not sent'
    : unseen
      ? 'Message Dispatch, new message'
      : 'Message Dispatch'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* SheetTrigger: Radix gives focus back to its trigger when the sheet closes (WCAG 2.4.3). */}
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" className="relative shrink-0 px-3" aria-label={buttonName}>
          <ChatCircle aria-hidden="true" className="size-5 sm:mr-2 sm:size-4" />
          <span className="hidden sm:inline">Message Dispatch</span>
          {showDot ? (
            <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-destructive" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => {
          // Straight into the message box, the reason the sheet was opened.
          event.preventDefault()
          document.getElementById(MESSAGE_BOX_ID)?.focus()
        }}
      >
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>Dispatch</SheetTitle>
          <SheetDescription>Write to the co-op&apos;s dispatch about an order or anything else.</SheetDescription>
        </SheetHeader>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <Conversation
          messages={data}
          loading={isLoading}
          failedToLoad={Boolean(error) && !data}
          pending={pending}
          text={text}
          onTextChange={setText}
          onSubmit={submit}
          onRetry={(item) => void deliver(item)}
        />
      </SheetContent>
    </Sheet>
  )
}

function Conversation({
  messages,
  loading,
  failedToLoad,
  pending,
  text,
  onTextChange,
  onSubmit,
  onRetry,
}: {
  messages: ChatMessage[] | undefined
  loading: boolean
  failedToLoad: boolean
  pending: Outgoing[]
  text: string
  onTextChange: (text: string) => void
  onSubmit: () => void
  onRetry: (item: Outgoing) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length, pending.length])

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
                {item.body}
              </p>
              {item.state === 'failed' ? (
                <>
                  {item.reason ? <span className="text-xs text-destructive">{item.reason}</span> : null}
                  <button
                    type="button"
                    onClick={() => onRetry(item)}
                    className="min-h-8 px-1 text-xs font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Not sent, tap to retry
                  </button>
                </>
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
          onSubmit()
        }}
      >
        <label htmlFor={MESSAGE_BOX_ID} className="sr-only">
          Message to Dispatch
        </label>
        <Textarea
          id={MESSAGE_BOX_ID}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
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
  const stamp = stampOf(message.createdAt)
  // The order code the rider and dispatch also read (spec 0021), not the restaurant's free text reference.
  const code = orderCodeOf(message.deliveryId)
  const order = code ? ` · #${code}` : ''
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
        {/* "You" for a screen reader, so it can tell the restaurant's messages from dispatch's. */}
        {mine ? <span className="sr-only">You, </span> : null}
        {/* AC-5: a restaurant sees dispatch as "Dispatch", never a person, whatever senderName says. */}
        {mine ? stamp : `Dispatch · ${stamp}`}
        {order}
        {/* AC-6: "read" once any dispatcher opened the thread after it. */}
        {mine && message.readByDispatch ? ' · read' : ''}
      </span>
    </li>
  )
}
