import { useEffect, useState } from 'react'
import { fetchRetentionMonths } from '../../../api/savedCustomersApi'

// How many months an unused saved customer is kept (the co-op's setting), or null until it is read
// or when it cannot be. The save tick's helper line never waits for it.
export function useRetentionMonths(): number | null {
  const [months, setMonths] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetchRetentionMonths().then((value) => {
      if (active) setMonths(value)
    })
    return () => {
      active = false
    }
  }, [])

  return months
}

// The helper line under the save tick (spec 0005, AC-1).
export function retentionHelperText(months: number | null): string {
  if (months === null) {
    return 'Only your restaurant sees it. It is deleted after a period unused that the co-op sets.'
  }
  return `Only your restaurant sees it. It is deleted after ${months} ${months === 1 ? 'month' : 'months'} unused.`
}
