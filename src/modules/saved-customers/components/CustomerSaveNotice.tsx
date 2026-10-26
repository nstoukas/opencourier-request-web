import React from 'react'
import { Warning } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '../../../admin-web-components'
import { CUSTOMER_SAVE_FAILURES, CUSTOMER_SAVE_NOTICES, CustomerSaveFailure } from '../utils/saveAfterOrder'

// `value is CustomerSaveFailure` is a type guard: where it returns true, TypeScript knows the code
// is one of the three failures.
function isFailure(value: unknown): value is CustomerSaveFailure {
  return typeof value === 'string' && (CUSTOMER_SAVE_FAILURES as readonly string[]).includes(value)
}

/**
 * On the status page after an order: the order went through, but the customer could not be saved
 * (spec 0005, the order flow's step 3). `code` is the `customerSave` value in the page's address; any
 * other value (or none) shows nothing.
 */
export function CustomerSaveNotice({ code }: { code: unknown }) {
  if (!isFailure(code)) return null
  return (
    <Alert variant="warning">
      <Warning className="size-4" aria-hidden="true" />
      <AlertDescription>{CUSTOMER_SAVE_NOTICES[code]}</AlertDescription>
    </Alert>
  )
}
