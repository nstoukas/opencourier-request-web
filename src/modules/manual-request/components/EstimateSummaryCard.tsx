/**
 * Card shown after a successful quote response.
 * Displays price range, ETA, and distance before the operator confirms.
 */
import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from '../../../admin-web-components'
import { ManualRequestQuoteDto } from '../types'
import dayjs from 'dayjs'
import { Check, Clock, Path, X } from '@phosphor-icons/react'
import { formatDistance, formatMoney, formatTime } from '../../../utils/format'

interface EstimateSummaryCardProps {
  quote: ManualRequestQuoteDto
  isConfirming: boolean
  onConfirm: () => void
  onDiscard: () => void
}

export function EstimateSummaryCard({
  quote,
  isConfirming,
  onConfirm,
  onDiscard,
}: EstimateSummaryCardProps) {
  const priceFrom = formatMoney(quote.quoteRangeFrom, quote.currency)
  const priceTo = formatMoney(quote.quoteRangeTo, quote.currency)
  const isSinglePrice = quote.quoteRangeFrom === quote.quoteRangeTo
  const etaLabel = quote.dropoffEta
    ? formatTime(quote.dropoffEta)
    : `~${quote.duration} min`

  const expiresAt = quote.expiresAt ? dayjs(quote.expiresAt) : null
  const isExpired = expiresAt ? dayjs().isAfter(expiresAt) : false

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span>Delivery Estimate</span>
          {isExpired && (
            <span className="text-xs text-destructive font-normal">(Expired – request a new quote)</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Price */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Price</p>
            <p className="text-2xl font-bold tabular-nums">
              {isSinglePrice ? (
                priceFrom
              ) : (
                <>
                  {priceFrom}
                  <span className="text-base font-normal text-muted-foreground"> – {priceTo}</span>
                </>
              )}
            </p>

          </div>

          {/* ETA */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden="true" />
              ETA
            </p>
            <p className="text-2xl font-bold">{etaLabel}</p>
            {/* <p className="text-xs text-muted-foreground">{quote.duration} min delivery window</p> */}
          </div>

          {/* Distance */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Path className="w-3 h-3" aria-hidden="true" />
              Distance
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {formatDistance(quote.distance, quote.distanceUnit)}
            </p>
          </div>
        </div>

        {expiresAt && !isExpired && (
          <p className="text-xs text-muted-foreground">
            Quote valid until {formatTime(quote.expiresAt)}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={onConfirm}
            disabled={isConfirming || isExpired}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {isConfirming ? 'Confirming…' : 'Confirm Delivery'}
          </Button>
          <Button variant="outline" onClick={onDiscard} disabled={isConfirming}>
            <X className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Discard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
