import {
  markSavedCustomerUsed,
  saveCustomerFromOrder,
  updateSavedCustomer,
} from '../../../api/savedCustomersApi'
import type { SavedCustomerError, SavedCustomerFields } from '../types'

// What happened to the customer after an order was sent. Only the three failures reach the status
// page, as `?customerSave=<code>` (a short code, so no customer detail ever sits in a URL).
export type CustomerSaveOutcome = 'none' | 'saved' | 'clash' | 'invalid' | 'failed'
export const CUSTOMER_SAVE_FAILURES = ['clash', 'invalid', 'failed'] as const
export type CustomerSaveFailure = (typeof CUSTOMER_SAVE_FAILURES)[number]

// The status page's notice for each failure (spec 0005, the order flow's step 3).
export const CUSTOMER_SAVE_NOTICES: Record<CustomerSaveFailure, string> = {
  clash: 'Order sent. The customer was not saved: another saved customer has this phone.',
  invalid: 'Order sent. The customer was not saved: the details were refused.',
  failed: "Order sent. The customer was not saved: the co-op's server did not answer.",
}

const statusOf = (error: unknown) => (error as SavedCustomerError | undefined)?.statusCode

function failureOf(error: unknown): CustomerSaveFailure {
  const status = statusOf(error)
  if (status === 409) return 'clash'
  if (status === 422) return 'invalid'
  return 'failed'
}

// Step 2 of the order flow, run after the delivery was created. It never throws: the order stands
// whatever happens here (AC-8).
//   typed customer, tick on   → save it (a new customer, or the one with this phone updated), used now
//   picked customer, tick on  → update that customer by id, used now; deleted meanwhile → saved as new
//   picked customer, tick off → only mark it used; a failure here is not shown (nothing was to be saved)
//   typed customer, tick off  → nothing
export async function saveCustomerAfterOrder(args: {
  fields: SavedCustomerFields
  linkedCustomerId: string | null
  saveTicked: boolean
}): Promise<CustomerSaveOutcome> {
  const { fields, linkedCustomerId, saveTicked } = args

  if (!saveTicked) {
    if (linkedCustomerId !== null) {
      await markSavedCustomerUsed(linkedCustomerId).catch(() => undefined)
    }
    return 'none'
  }

  try {
    if (linkedCustomerId === null) {
      await saveCustomerFromOrder(fields)
      return 'saved'
    }
    try {
      await updateSavedCustomer(linkedCustomerId, fields, { markUsed: true })
    } catch (error) {
      if (statusOf(error) !== 404) throw error
      // Deleted while the order was being made: save the details as a new customer, no error.
      await saveCustomerFromOrder(fields)
    }
    return 'saved'
  } catch (error) {
    return failureOf(error)
  }
}
