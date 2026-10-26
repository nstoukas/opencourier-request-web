import React, { useId } from 'react'
import { Checkbox } from '../../../admin-web-components'
import { retentionHelperText, useRetentionMonths } from '../hooks/useRetentionMonths'

interface SaveCustomerTickProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * "Save this customer for next time (they agreed)" at the end of the order form's Drop off card
 * (spec 0005, AC-1). The restaurant asks the customer; the line under it says who sees the details
 * and how long they are kept.
 */
export function SaveCustomerTick({ checked, onCheckedChange }: SaveCustomerTickProps) {
  const id = useId()
  const helperId = `${id}-helper`
  const months = useRetentionMonths()

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Checkbox
        id={id}
        checked={checked}
        // Radix gives `true`, `false` or 'indeterminate'; only a real true ticks it.
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-describedby={helperId}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium leading-snug">
          Save this customer for next time (they agreed)
        </label>
        <p id={helperId} className="text-sm text-muted-foreground">
          {retentionHelperText(months)}
        </p>
      </div>
    </div>
  )
}
