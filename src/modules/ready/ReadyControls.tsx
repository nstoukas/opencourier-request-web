import React, { useEffect, useState } from 'react'
import { Button } from '../../admin-web-components'
import { delayDeliveryReady, markDeliveryFoodReady } from '../../api/manualRequestApi'
import { formatTime } from '../../utils/format'
import { READY_DELAY_OPTIONS, ReadyFields, readyView } from './readyState'

type Props = {
  deliveryId: string
  order: ReadyFields
  // Called after a change went through, so the page can fetch its list again.
  onChanged?: () => void
}

// Spec 0023 (AC-8): the ready time with "+5", "+10", "+15" and "Food ready". The answer of a tap is
// shown at once, not at the next 30 s poll; a newer order from the page (a poll) replaces it.
export function ReadyControls({ deliveryId, order, onChanged }: Props) {
  const [shown, setShown] = useState<ReadyFields>(order)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // The page's own copy moved on (a poll, another tab): show that.
  useEffect(() => {
    setShown(order)
  }, [order.status, order.readyAt, order.foodReadyAt])

  const run = async (request: () => Promise<ReadyFields>) => {
    setSending(true)
    setError('')
    try {
      const updated = await request()
      setShown({ status: updated.status, readyAt: updated.readyAt, foodReadyAt: updated.foodReadyAt })
      onChanged?.()
    } catch (err: any) {
      // The backend's own sentence ("The ready time just changed. Look again."), and a fresh copy at
      // once, so "look again" shows the current time rather than waiting for the next poll.
      setError(err?.message || 'The ready time could not be changed.')
      onChanged?.()
    } finally {
      setSending(false)
    }
  }

  const view = readyView(shown)
  if (view === 'none' && !shown.readyAt) return null

  return (
    <div className="space-y-2" data-testid="ready-controls">
      <p className="text-sm font-medium">
        {view === 'ready'
          ? `Food ready at ${formatTime(shown.foodReadyAt)}`
          : `Ready at ${formatTime(shown.readyAt)}`}
      </p>
      {view === 'actions' ? (
        <div className="flex flex-wrap gap-2">
          {READY_DELAY_OPTIONS.map((minutes) => (
            <Button
              key={minutes}
              type="button"
              variant="outline"
              size="sm"
              disabled={sending}
              onClick={() => run(() => delayDeliveryReady(deliveryId, minutes, shown.readyAt))}
            >
              +{minutes}
            </Button>
          ))}
          <Button type="button" size="sm" disabled={sending} onClick={() => run(() => markDeliveryFoodReady(deliveryId))}>
            Food ready
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
