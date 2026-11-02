import React from 'react'
import { cn } from '../../../ui-shared-utils'
import { COUNTER_FROM_SHARE } from '../utils/orderForm'

// "48 / 60" under a field once 80% of its limit is used; red over the limit (spec 0006 AC-8, spec 0016
// AC-1). The limit is a form rule, not maxLength, so a saved customer's longer text still shows whole.
// Moved here from CreateDeliveryForm.tsx so the saved customer dialog shows the same counter.
export function LimitCounter({ length, limit }: { length: number; limit: number }) {
  if (length < Math.ceil(limit * COUNTER_FROM_SHARE)) return null
  return (
    <p className={cn('text-right text-sm tabular-nums', length > limit ? 'text-destructive' : 'text-muted-foreground')}>
      {length} / {limit}
    </p>
  )
}
