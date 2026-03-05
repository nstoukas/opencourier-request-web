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
import { CheckIcon, XIcon, ClockIcon, RouterIcon } from 'lucide-react'

interface EstimateSummaryCardProps {
  quote: ManualRequestQuoteDto
  isConfirming: boolean
  onConfirm: () => void
  onDiscard: () => void
}

function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function EstimateSummaryCard({
  quote,
  isConfirming,
  onConfirm,
  onDiscard,
}: EstimateSummaryCardProps) {
  const priceFrom = formatCents(quote.quoteRangeFrom, quote.currency)
  const priceTo = formatCents(quote.quoteRangeTo, quote.currency)
  const etaLabel = quote.dropoffEta
    ? dayjs(quote.dropoffEta).format('h:mm A')
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
              {priceFrom}
              <span className="text-base font-normal text-muted-foreground"> – {priceTo}</span>
            </p>
          </div>

          {/* ETA */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              ETA
            </p>
            <p className="text-2xl font-bold">{etaLabel}</p>
            <p className="text-xs text-muted-foreground">{quote.duration} min delivery window</p>
          </div>

          {/* Distance */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <RouterIcon className="w-3 h-3" />
              Distance
            </p>
            <p className="text-2xl font-bold">
              {quote.distance.toFixed(1)}
              <span className="text-base font-normal text-muted-foreground ml-1 lowercase">
                {quote.distanceUnit}
              </span>
            </p>
          </div>
        </div>

        {expiresAt && !isExpired && (
          <p className="text-xs text-muted-foreground">
            Quote valid until {expiresAt.format('h:mm A')}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={onConfirm}
            disabled={isConfirming || isExpired}
            className="flex-1"
          >
            <CheckIcon className="w-4 h-4 mr-1.5" />
            {isConfirming ? 'Confirming…' : 'Confirm Delivery'}
          </Button>
          <Button variant="outline" onClick={onDiscard} disabled={isConfirming}>
            <XIcon className="w-4 h-4 mr-1.5" />
            Discard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
