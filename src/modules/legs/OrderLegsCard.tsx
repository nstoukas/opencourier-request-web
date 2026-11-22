import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, StatusBadge } from '../../admin-web-components'
import { HistoryItem, absentLegNumbers, legLabel, legsToCancel } from '../manual-request/utils/legs'
import { useFormat } from '../../i18n/useFormat'
import { ReadyControls } from '../ready/ReadyControls'
import { CancelOrderLegsDialog } from './CancelOrderLegsDialog'
import { LEFT_UNSPLIT_TEXT, SPLIT_CHARGE_NOTE, splitOutcomeLine } from './splitOutcome'

const ENDED = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

/**
 * Spec 0046 (AC-6): one order sent as legs, as one card in the order history. Each leg with its status and a
 * link to its page; a leg this page does not hold says so and points to the order page, which knows whether
 * it was never sent (it may only be on another page of the list) and offers Retry there (cross check 4);
 * the ready buttons apply to every open leg (cross check 9); Cancel all cancels each leg. Both only when
 * every leg is here; otherwise the order page offers them.
 */
export function OrderLegsCard({
  order,
  onChanged,
}: {
  order: Extract<HistoryItem, { kind: 'order' }>
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const [cancelOpen, setCancelOpen] = useState(false)
  const first = order.legs[0]
  const open = order.legs.filter((leg) => !ENDED.has(leg.status))
  const toCancel = legsToCancel(order.legs)
  const total = order.legs.reduce((sum, leg) => sum + (leg.totalCost ?? 0), 0)
  const missing = absentLegNumbers(order.legCount, order.legs)
  // Spec 0047 (AC-10): an order a rider found too big for one box, split by dispatch at pickup.
  const splitLine = order.legs.some((leg) => leg.splitOutcome === 'SPLIT')
    ? splitOutcomeLine({ splitOutcome: 'SPLIT', legCount: order.legCount }, t)
    : null

  return (
    <Card data-testid="order-legs-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('orderLegs.cardTitle', { count: order.legCount })}</CardTitle>
        {splitLine ? (
          <>
            <p className="text-sm font-medium" data-testid="split-outcome">
              {splitLine}
            </p>
            {/* Decision 11.10: what the split costs the restaurant (the order's cost below leaves it out). */}
            <p className="text-xs text-muted-foreground" data-testid="split-charge-note">
              {t(SPLIT_CHARGE_NOTE)}
            </p>
          </>
        ) : null}
        {first.dropoff ? (
          <p className="text-sm">
            {first.dropoff.dropoffName} · <span className="text-muted-foreground">{first.dropoff.formattedAddress ?? first.dropoff.city ?? '—'}</span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {order.legs.map((leg) => (
            <li key={leg.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{legLabel(leg.legNumber ?? 0, order.legCount, t)}</span>
              <StatusBadge status={leg.status} />
              <Link href={`/manual-request/${leg.id}/status`} className="underline">
                {t('orderLegs.viewStatus')}
              </Link>
              {/* Row 11 review: a leg the rider left because it didn't fit one box says so on its own line. */}
              {leg.splitOutcome === 'LEFT' ? (
                <span className="basis-full text-muted-foreground" data-testid="split-outcome-left">
                  {t(LEFT_UNSPLIT_TEXT)}
                </span>
              ) : null}
            </li>
          ))}
          {missing.map((legNumber) => (
            <li key={`missing-${legNumber}`} className="text-sm text-muted-foreground">
              {t('orderLegs.notInList', { leg: legLabel(legNumber, order.legCount, t) })}{' '}
              <Link href={`/manual-request/${first.id}/status`} className="underline">
                {t('orderLegs.openTheOrder')}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t('orders.cost', { amount: format.money(total, first.currencyCode) })}</span>
          <span>{t('orders.created', { time: format.dateTime(first.createdAt) })}</span>
        </div>

        {/* agy's review of row 10: with a leg missing from this list (it may be on another page of it), the
            ready buttons and Cancel all would act on the legs here only, and a live leg left out would still
            be dispatched, paying its rider and charging the restaurant for an order it meant to cancel. The
            order page reads every leg, so both are offered there instead. */}
        {missing.length > 0 && (open.length > 0 || toCancel.length > 0) ? (
          <p className="text-sm" data-testid="order-legs-open-order">
            {/* Trans drops the text of a Next Link (seen in row 47's tests), so the sentence is split at the [link] marker:
                the words before and after come from the translation, the link label is its own key. */}
            {(() => {
              const [before, after = ''] = t('orderLegs.openOrderToChange').split('[link]')
              return (
                <>
                  {before}
                  <Link href={`/manual-request/${first.id}/status`} className="underline">
                    {t('orderLegs.openOrderLink')}
                  </Link>
                  {after}
                </>
              )
            })()}
          </p>
        ) : null}

        {missing.length === 0 && open.length > 0 ? (
          <ReadyControls
            deliveryId={open[0].id}
            order={{ status: open[0].status, readyAt: open[0].readyAt, foodReadyAt: open[0].foodReadyAt }}
            onChanged={onChanged}
            otherLegs={open.slice(1).map((leg) => ({
              id: leg.id,
              readyAt: leg.readyAt,
              legLabel: legLabel(leg.legNumber ?? 0, order.legCount, t),
            }))}
          />
        ) : null}

        {missing.length === 0 && toCancel.length > 0 ? (
          <>
            <Separator />
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              {t('orderLegs.cancelAll')}
            </Button>
          </>
        ) : null}
        {cancelOpen ? (
          <CancelOrderLegsDialog legs={toCancel} onClose={() => setCancelOpen(false)} onDone={onChanged} />
        ) : null}
      </CardContent>
    </Card>
  )
}
