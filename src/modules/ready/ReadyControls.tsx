import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../admin-web-components'
import { delayDeliveryReady, markDeliveryFoodReady } from '../../api/manualRequestApi'
import { useFormat } from '../../i18n/useFormat'
import { serverMessage } from '../../i18n/serverText'
import { READY_DELAY_OPTIONS, ReadyFields, readyView } from './readyState'

type Props = {
  deliveryId: string
  order: ReadyFields
  // Called after a change went through, so the page can fetch its list again.
  onChanged?: () => void
  // Spec 0046 (cross check 9): the other legs of a multi leg order. A tap applies to every one of them too,
  // one call per leg, each with its own ready time. Absent for a single delivery.
  otherLegs?: { id: string; readyAt: string | null; legLabel: string }[]
}

type ReadyAction = (deliveryId: string, readyAt: string | null) => Promise<ReadyFields>

// Spec 0023 (AC-8): the ready time with "+5", "+10", "+15" and "Food ready". The answer of a tap is
// shown at once, not at the next 30 s poll; a newer order from the page (a poll) replaces it.
export function ReadyControls({ deliveryId, order, onChanged, otherLegs = [] }: Props) {
  const { t } = useTranslation()
  const format = useFormat()
  const [shown, setShown] = useState<ReadyFields>(order)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // agy's review of row 10: each other leg's ready time as our last tap left it, with the time the page
  // showed for that leg then. Until the page reads the legs again, the next tap sends the answer, not the
  // old time (which the backend refuses, so the legs' times drift apart and a leg rider waits, charged to
  // the restaurant as wait pay). A `Record<string, X>` is an object keyed by the leg's id.
  const [legAnswers, setLegAnswers] = useState<Record<string, { pageHad: string | null; readyAt: string | null }>>({})

  // The time to send for a leg: our own last answer while the page still shows what it showed at that tap
  // (a reread that has not landed, or a slow poll that started before it); the page's time once it moved.
  const readyAtToSend = (leg: { id: string; readyAt: string | null }): string | null => {
    const answer = legAnswers[leg.id]
    return answer && answer.pageHad === leg.readyAt ? answer.readyAt : leg.readyAt
  }

  // The page's own copy moved on (a poll, another tab): show that.
  useEffect(() => {
    setShown(order)
  }, [order.status, order.readyAt, order.foodReadyAt])

  const run = async (action: ReadyAction) => {
    setSending(true)
    setError('')
    // The backend's own sentence ("The ready time just changed. Look again.") when this delivery refuses.
    let ownError = ''
    try {
      const updated = await action(deliveryId, shown.readyAt)
      setShown({ status: updated.status, readyAt: updated.readyAt, foodReadyAt: updated.foodReadyAt })
    } catch (err: any) {
      ownError = serverMessage(err) || t('ready.changeFailed')
    }
    // Spec 0046: then each other leg, so the whole order moves together, even when the first refused (row 10
    // review). A leg that refuses (already picked up, say) is named; the others still go.
    const refused: string[] = []
    const answers: Record<string, { pageHad: string | null; readyAt: string | null }> = {}
    for (const leg of otherLegs) {
      try {
        const updated = await action(leg.id, readyAtToSend(leg))
        answers[leg.id] = { pageHad: leg.readyAt, readyAt: updated.readyAt }
      } catch (legError: any) {
        refused.push(`${leg.legLabel}: ${serverMessage(legError) || t('ready.notChanged')}`)
      }
    }
    // `{ ...a, ...b }` copies both objects into a new one, b's entries winning.
    setLegAnswers((before) => ({ ...before, ...answers }))
    setError([ownError, ...refused].filter(Boolean).join(' · '))
    // A fresh copy at once, so "look again" shows the current time rather than waiting for the next poll.
    onChanged?.()
    setSending(false)
  }

  const view = readyView(shown)
  if (view === 'none' && !shown.readyAt) return null

  return (
    <div className="space-y-2" data-testid="ready-controls">
      <p className="text-sm font-medium">
        {view === 'ready'
          ? t('ready.foodReadyAt', { atTime: format.atTime(shown.foodReadyAt) })
          : t('ready.readyAt', { atTime: format.atTime(shown.readyAt) })}
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
              onClick={() => run((id, readyAt) => delayDeliveryReady(id, minutes, readyAt))}
            >
              +{minutes}
            </Button>
          ))}
          <Button type="button" size="sm" disabled={sending} onClick={() => run((id) => markDeliveryFoodReady(id))}>
            {t('ready.foodReady')}
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
