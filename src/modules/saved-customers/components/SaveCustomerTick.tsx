import React, { useId } from 'react'
import { Checkbox } from '../../../admin-web-components'
import { retentionHelperText, useRetentionMonths } from '../hooks/useRetentionMonths'

interface SaveCustomerTickProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * "Save this customer for next time (they agreed)" near the end of the order form
 * (spec 0005, AC-1). The restaurant asks the customer; the line under it says who sees the details
 * and how long they are kept.
 */
export function SaveCustomerTick({ checked, onCheckedChange }: SaveCustomerTickProps) {
  const id = useId()
  const helperId = `${id}-helper`
  const months = useRetentionMonths()

  const labelId = `${id}-label`

  // The whole row is the label, so a tap anywhere on it ticks the box (a 48 px target, spec 0006,
  // AC-3). The box's name is only the first line (aria-labelledby), the helper line its description.
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border p-3">
      <Checkbox
        id={id}
        checked={checked}
        // Radix gives `true`, `false` or 'indeterminate'; only a real true ticks it.
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-labelledby={labelId}
        aria-describedby={helperId}
        className="mt-0.5 size-5"
      />
      <span className="space-y-1">
        <span id={labelId} className="block text-base font-medium leading-snug">
          Save this customer for next time (they agreed)
        </span>
        <span id={helperId} className="block text-sm text-muted-foreground">
          {retentionHelperText(months)}
        </span>
      </span>
    </label>
  )
}
