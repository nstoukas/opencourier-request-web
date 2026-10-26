/**
 * The order form's one button, Get price then Send order, with what it needs above it: the price, or
 * that the price expired, or why a call failed (spec 0006, AC-12 and AC-13). Fixed to the bottom of
 * the screen below 768 px, so it is always under the thumb; at the end of the column from 768 px.
 */
import React, { useEffect, useRef } from 'react'
import { Alert, AlertDescription, Button, Spinner } from '../../../admin-web-components'
import { formatDistance, formatMoney, formatTime } from '../../../utils/format'
import { ManualRequestQuoteDto } from '../types'

// needs price → pricing → priced → sending; a priced order can also become expired.
export type BarPhase = 'needs-price' | 'pricing' | 'priced' | 'expired' | 'sending'

const BUTTON_TEXT: Record<BarPhase, string> = {
  'needs-price': 'Get price',
  pricing: 'Getting price…',
  priced: 'Send order',
  expired: 'Get a new price',
  sending: 'Sending…',
}

interface PriceSendBarProps {
  phase: BarPhase
  // The price shown, with the drop off address it was made for.
  quote: ManualRequestQuoteDto | null
  pricedAddress: string | null
  // A failed price or send, in plain words.
  error: string | null
  // True when no price can be asked for at all (the restaurant's pickup is not usable).
  disabled: boolean
  onSend: () => void
  // The bar's height, so the form can keep its last field clear of a fixed bar.
  onHeightChange: (height: number) => void
}

export function PriceSendBar({ phase, quote, pricedAddress, error, disabled, onSend, onHeightChange }: PriceSendBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  // ResizeObserver: tells us whenever the bar's size changes (a price or an error appears). Older test
  // browsers have none, and then the form simply gets no extra padding.
  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => onHeightChange(bar.offsetHeight))
    observer.observe(bar)
    return () => observer.disconnect()
  }, [onHeightChange])

  // Get price and Get a new price submit the form (so its rules run); Send order sends the priced order.
  const sends = phase === 'priced' || phase === 'sending'
  const busy = phase === 'pricing' || phase === 'sending'
  const showsPrice = quote && (phase === 'priced' || phase === 'sending')

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:pb-0"
    >
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-3 md:px-0">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* aria-live: a screen reader says the price when it arrives, and says when it expired. */}
        <div aria-live="polite">
          {phase === 'expired' ? (
            <p className="text-base font-medium text-destructive">This price has expired</p>
          ) : showsPrice ? (
            <PriceSummary quote={quote} pricedAddress={pricedAddress} />
          ) : null}
        </div>

        <Button
          type={sends ? 'button' : 'submit'}
          size="xl"
          className="w-full"
          disabled={disabled || busy}
          onClick={sends ? onSend : undefined}
        >
          {busy ? <Spinner className="mr-2" /> : null}
          {BUTTON_TEXT[phase]}
        </Button>
      </div>
    </div>
  )
}

function PriceSummary({ quote, pricedAddress }: { quote: ManualRequestQuoteDto; pricedAddress: string | null }) {
  const priceFrom = formatMoney(quote.quoteRangeFrom, quote.currency)
  const priceTo = formatMoney(quote.quoteRangeTo, quote.currency)
  const price = quote.quoteRangeFrom === quote.quoteRangeTo ? priceFrom : `${priceFrom} – ${priceTo}`
  const eta = quote.dropoffEta ? formatTime(quote.dropoffEta) : `~${quote.duration} min`

  return (
    <div className="space-y-0.5 break-words">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-2xl font-bold tabular-nums">{price}</span>
        <span className="text-sm text-muted-foreground">
          ETA {eta} · {formatDistance(quote.distance, quote.distanceUnit)}
        </span>
      </p>
      {/* The address the price was made for, so a wrong search match is caught before sending. */}
      {pricedAddress ? <p className="text-sm">To: {pricedAddress}</p> : null}
      {quote.expiresAt ? (
        <p className="text-sm text-muted-foreground">Valid until {formatTime(quote.expiresAt)}</p>
      ) : null}
    </div>
  )
}
