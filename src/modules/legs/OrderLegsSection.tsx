import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
import { useFormat } from '../../i18n/useFormat'
import { serverMessage } from '../../i18n/serverText'
import { usePolledFetch } from '../../hooks/usePolledFetch'
import { CancelOrderLegsDialog } from './CancelOrderLegsDialog'

// Row 140 review: a real business name for the new leg, else empty. Before row 140 this app copied the
// customer's name into the business name, so a value equal to the customer's name is that copy.
type LegDropoffNames = { dropoffBusinessName?: string | null; dropoffName?: string | null }

function legBusinessName(dropoff: LegDropoffNames | null | undefined): string {
  const business = dropoff?.dropoffBusinessName?.trim() ?? ''
  return business !== '' && business !== dropoff?.dropoffName?.trim() ? business : ''
}

// The three box sizes, labelled in the reader's language (the same words as the order form's).
const sizeOptions = (t: TFunction): ChoicePillOption[] => [
  { value: ManualRequestPackageSize.SMALL, label: t('form.sizeSmall') },
  { value: ManualRequestPackageSize.MEDIUM, label: t('form.sizeMedium') },
  { value: ManualRequestPackageSize.LARGE, label: t('form.sizeLarge') },
]

function riderLine(leg: PartnerDeliveryDto, t: TFunction): string {
  const name = [leg.courier?.firstName, leg.courier?.lastName].filter(Boolean).join(' ').trim()
  return name || t('orderLegs.noRiderYet')
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
  const { t, i18n } = useTranslation()
  const [cancelOpen, setCancelOpen] = useState(false)

  // agy's review of row 10: the legs are read again every 30 s while the tab is visible, like the page
  // itself (usePolledFetch, the rule in this repo's AGENTS.md), so another leg's new status and rider show
  // without a reload. `version` stays as the page's way to ask for a read at once.
  const load = useCallback((): Promise<PartnerOrderLegsDto> => fetchOrderLegs(deliveryId), [deliveryId])
  const { data, error, refetch } = usePolledFetch(load, { enabled: Boolean(deliveryId) })
  const order = data ?? null
  const loadError = error ? (serverMessage(error as any, i18n) ?? t('orderLegs.loadFailed')) : null

  // A bump of `version` after the first render: read again now. useRef keeps the last version seen
  // without causing a render.
  const versionSeen = useRef(version)
  useEffect(() => {
    if (version === versionSeen.current) return
    versionSeen.current = version
    void refetch()
  }, [version, refetch])

  // Hand the page each answer. Only an answer holding this page's own leg: right after a move to another
  // leg, `data` is still the previous order's until the new read lands.
  useEffect(() => {
    if (order && order.legs.some((leg) => leg.id === deliveryId)) onLegs?.(order.legs)
  }, [order, deliveryId, onLegs])

  if (loadError && !order) return <p className="text-sm text-destructive">{loadError}</p>
  if (!order || order.legs.length === 0) return null

  const legCount = order.legs[0].legCount ?? order.legs.length
  const toCancel = legsToCancel(order.legs)
  // Row 10 review: an order whose sent legs were all cancelled or failed is over; a missing leg is not sent
  // after it. A delivered leg still counts as live: the customer is waiting for the rest.
  const orderEnded = order.legs.every((leg) => leg.status === 'CANCELED' || leg.status === 'FAILED')
  const refresh = () => {
    void refetch()
    onChanged()
  }

  return (
    <section className="space-y-3" data-testid="order-legs">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('orderLegs.heading', { count: legCount })}
      </h2>
      <ul className="space-y-2">
        {order.legs.map((leg) => (
          <li key={leg.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{legLabel(leg.legNumber ?? 0, legCount, t)}</span>
            <span className="text-muted-foreground">{riderLine(leg, t)}</span>
            <StatusBadge status={leg.status} />
            {leg.id === deliveryId ? (
              <span className="text-xs text-muted-foreground">{t('orderLegs.thisPage')}</span>
            ) : (
              <Link href={`/manual-request/${leg.id}/status`} className="underline">
                {t('orderLegs.view')}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {orderEnded && order.missingLegNumbers.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('orderLegs.neverSentRestCancelled', {
            legs: order.missingLegNumbers.map((number) => legLabel(number, legCount, t)).join(', '),
            count: order.missingLegNumbers.length,
          })}
        </p>
      ) : null}
      {(orderEnded ? [] : order.missingLegNumbers).map((legNumber) => (
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
          {t('orderLegs.cancelAll')}
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
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const [error, setError] = useState<string | null>(null)
  const label = legLabel(legNumber, legCount, t)
  // The label inside a sentence ("Send leg 2 of 3"), lower case by the reader's language's rules.
  const labelInSentence = label.toLocaleLowerCase(format.language)

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
      setError(serverMessage(err, i18n) ?? t('form.priceFailed'))
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
        // Row 140: the source's own business name or empty, never the customer's name. An order made
        // before row 140 holds the customer's name there, copied in by this app; that copy is not carried on.
        dropoffBusinessName: legBusinessName(source.dropoff),
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
      setError(serverMessage(err, i18n) ?? t('orderLegs.legSendFailed', { leg: label }))
      setQuote(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 p-3" data-testid={`missing-leg-${legNumber}`}>
      <p className="text-sm font-medium">{t('orderLegs.neverSent', { leg: label })}</p>
      <ChoicePills
        label={t('orderLegs.legSize', { leg: label })}
        options={sizeOptions(t)}
        value={size}
        onValueChange={(value) => {
          setSize(value as ManualRequestPackageSize)
        }}
      />
      {quote ? (
        <p className="text-sm">
          {t('orderLegs.priceFor', { leg: labelInSentence })}{' '}
          <span className="font-medium">{format.money(quote.quoteRangeFrom, quote.currency)}</span>
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
            {t('orderLegs.sendLeg', { leg: labelInSentence })}
          </Button>
        ) : (
          <Button variant="outline" onClick={getPrice} disabled={busy || !size}>
            {busy ? <Spinner className="mr-2" /> : null}
            {t('orderLegs.retryGetPrice')}
          </Button>
        )}
      </div>
    </div>
  )
}
