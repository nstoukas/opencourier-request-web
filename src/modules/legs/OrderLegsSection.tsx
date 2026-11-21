import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription, Button, Spinner, StatusBadge } from '../../admin-web-components'
import { createDelivery, fetchOrderLegs, requestQuote } from '../../api/manualRequestApi'
import { ChoicePills, ChoicePillOption } from '../manual-request/components/ChoicePills'
import {
  ManualRequestPackageSize,
  ManualRequestQuoteDto,
  PartnerDeliveryDto,
  PartnerOrderLegsDto,
} from '../manual-request/types'
import { legLabel, legsToCancel, retryQuoteInput } from '../manual-request/utils/legs'
import { formatMoney } from '../../utils/format'
import { CancelOrderLegsDialog } from './CancelOrderLegsDialog'

const SIZE_OPTIONS: ChoicePillOption[] = [
  { value: ManualRequestPackageSize.SMALL, label: 'Small' },
  { value: ManualRequestPackageSize.MEDIUM, label: 'Medium' },
  { value: ManualRequestPackageSize.LARGE, label: 'Large' },
]

function riderLine(leg: PartnerDeliveryDto): string {
  const name = [leg.courier?.firstName, leg.courier?.lastName].filter(Boolean).join(' ').trim()
  return name || 'No rider yet'
}

type Props = {
  // The delivery this page shows, one leg of the order.
  deliveryId: string
  // Bumped by the page after it changed something (a refresh, a cancel), so the legs are read again.
  version: number
  // Called after this section changed something, so the page reads its own delivery again.
  onChanged: () => void
  // The legs as read, so the page's ready buttons can apply to every leg (cross check 9).
  onLegs?: (legs: PartnerDeliveryDto[]) => void
}

/**
 * Spec 0046 (AC-3, AC-5, AC-6): the legs of a multi leg order on its page. Each leg with its status and rider;
 * a leg that was never sent, with a size to pick, a fresh price and Retry (cross check 4: an old quote has
 * expired by now, so it is always priced again); and Cancel all for the legs not yet ended.
 */
export function OrderLegsSection({ deliveryId, version, onChanged, onLegs }: Props) {
  const [order, setOrder] = useState<PartnerOrderLegsDto | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const answer = await fetchOrderLegs(deliveryId)
      setOrder(answer)
      onLegs?.(answer.legs)
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err?.message ?? 'The other legs of this order could not be loaded.')
    }
  }, [deliveryId, onLegs])

  useEffect(() => {
    void load()
  }, [load, version])

  if (loadError && !order) return <p className="text-sm text-destructive">{loadError}</p>
  if (!order || order.legs.length === 0) return null

  const legCount = order.legs[0].legCount ?? order.legs.length
  const toCancel = legsToCancel(order.legs)
  const refresh = () => {
    void load()
    onChanged()
  }

  return (
    <section className="space-y-3" data-testid="order-legs">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        This order goes as {legCount} deliveries
      </h2>
      <ul className="space-y-2">
        {order.legs.map((leg) => (
          <li key={leg.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{legLabel(leg.legNumber ?? 0, legCount)}</span>
            <span className="text-muted-foreground">{riderLine(leg)}</span>
            <StatusBadge status={leg.status} />
            {leg.id === deliveryId ? (
              <span className="text-xs text-muted-foreground">This page</span>
            ) : (
              <Link href={`/manual-request/${leg.id}/status`} className="underline">
                View
              </Link>
            )}
          </li>
        ))}
      </ul>

      {order.missingLegNumbers.map((legNumber) => (
        <MissingLeg
          key={legNumber}
          legNumber={legNumber}
          legCount={legCount}
          source={order.legs[0]}
          onSent={refresh}
        />
      ))}

      {toCancel.length > 0 ? (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          Cancel all legs
        </Button>
      ) : null}
      {cancelOpen ? (
        <CancelOrderLegsDialog legs={toCancel} onClose={() => setCancelOpen(false)} onDone={refresh} />
      ) : null}
    </section>
  )
}

// One leg never sent: pick its size, get a fresh price, send it with the order's reference and numbers.
function MissingLeg({
  legNumber,
  legCount,
  source,
  onSent,
}: {
  legNumber: number
  legCount: number
  source: PartnerDeliveryDto
  onSent: () => void
}) {
  const [size, setSize] = useState<ManualRequestPackageSize | ''>('')
  const [quote, setQuote] = useState<ManualRequestQuoteDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = legLabel(legNumber, legCount)

  // A ready time in the past would be refused or meaningless: now, or the order's own time if later.
  const quoteInput = () => {
    const input = retryQuoteInput(source)
    const readyAt = input.pickupReadyAt ? new Date(input.pickupReadyAt) : null
    return {
      ...input,
      pickupReadyAt: readyAt && readyAt.getTime() > Date.now() ? readyAt.toISOString() : new Date().toISOString(),
    }
  }

  const getPrice = async () => {
    setBusy(true)
    setError(null)
    try {
      setQuote(await requestQuote(quoteInput()))
    } catch (err: any) {
      setError(err?.message ?? 'The price could not be worked out. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    if (!quote || !size) return
    setBusy(true)
    setError(null)
    try {
      await createDelivery({
        ...quoteInput(),
        dropoffBusinessName: source.dropoff?.dropoffBusinessName ?? source.dropoff?.dropoffName ?? '',
        orderItems: (source.orderItems ?? []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          ...(item.size ? { size: item.size } : {}),
          ...(item.kind ? { kind: item.kind } : {}),
        })),
        quoteId: quote.id,
        // A new key: this is a new request with a new quote (cross check 4).
        idempotencyKey: `${quote.id}-${Date.now()}-${legNumber}`,
        boxSize: size,
        orderReference: source.orderReference,
        legNumber,
        legCount,
      })
      onSent()
    } catch (err: any) {
      setError(err?.message ?? `${label} could not be sent. Try again.`)
      setQuote(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 p-3" data-testid={`missing-leg-${legNumber}`}>
      <p className="text-sm font-medium">{label} was never sent</p>
      <ChoicePills
        label={`${label} size`}
        options={SIZE_OPTIONS}
        value={size}
        onValueChange={(value) => {
          setSize(value as ManualRequestPackageSize)
        }}
      />
      {quote ? (
        <p className="text-sm">
          Price for {label.toLowerCase()}: <span className="font-medium">{formatMoney(quote.quoteRangeFrom, quote.currency)}</span>
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {quote ? (
          <Button onClick={send} disabled={busy || !size}>
            {busy ? <Spinner className="mr-2" /> : null}
            Send {label.toLowerCase()}
          </Button>
        ) : (
          <Button variant="outline" onClick={getPrice} disabled={busy || !size}>
            {busy ? <Spinner className="mr-2" /> : null}
            Retry: get a price
          </Button>
        )}
      </div>
    </div>
  )
}
