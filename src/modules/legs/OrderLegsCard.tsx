import React, { useState } from 'react'
import Link from 'next/link'
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, StatusBadge } from '../../admin-web-components'
import { HistoryItem, absentLegNumbers, legLabel, legsToCancel } from '../manual-request/utils/legs'
import { formatDateTime, formatMoney } from '../../utils/format'
import { ReadyControls } from '../ready/ReadyControls'
import { CancelOrderLegsDialog } from './CancelOrderLegsDialog'

const ENDED = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

/**
 * Spec 0046 (AC-6): one order sent as legs, as one card in the order history. Each leg with its status and a
 * link to its page; a leg this page does not hold says so and points to the order page, which knows whether
 * it was never sent (it may only be on another page of the list) and offers Retry there (cross check 4);
 * the ready buttons apply to every open leg (cross check 9); Cancel all cancels each leg.
 */
export function OrderLegsCard({
  order,
  onChanged,
}: {
  order: Extract<HistoryItem, { kind: 'order' }>
  onChanged: () => void
}) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const first = order.legs[0]
  const open = order.legs.filter((leg) => !ENDED.has(leg.status))
  const toCancel = legsToCancel(order.legs)
  const total = order.legs.reduce((sum, leg) => sum + (leg.totalCost ?? 0), 0)
  const missing = absentLegNumbers(order.legCount, order.legs)

  return (
    <Card data-testid="order-legs-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Order in {order.legCount} deliveries</CardTitle>
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
              <span className="font-medium">{legLabel(leg.legNumber ?? 0, order.legCount)}</span>
              <StatusBadge status={leg.status} />
              <Link href={`/manual-request/${leg.id}/status`} className="underline">
                View status
              </Link>
            </li>
          ))}
          {missing.map((legNumber) => (
            <li key={`missing-${legNumber}`} className="text-sm text-muted-foreground">
              {legLabel(legNumber, order.legCount)} is not in this list.{' '}
              <Link href={`/manual-request/${first.id}/status`} className="underline">
                Open the order
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Cost: {formatMoney(total, first.currencyCode)}</span>
          <span>Created: {formatDateTime(first.createdAt)}</span>
        </div>

        {open.length > 0 ? (
          <ReadyControls
            deliveryId={open[0].id}
            order={{ status: open[0].status, readyAt: open[0].readyAt, foodReadyAt: open[0].foodReadyAt }}
            onChanged={onChanged}
            otherLegs={open.slice(1).map((leg) => ({
              id: leg.id,
              readyAt: leg.readyAt,
              legLabel: legLabel(leg.legNumber ?? 0, order.legCount),
            }))}
          />
        ) : null}

        {toCancel.length > 0 ? (
          <>
            <Separator />
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel all legs
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
