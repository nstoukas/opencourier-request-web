import { manualRequestFetch } from './manualRequestApi'
import type { SavedCustomer, SavedCustomerFields, SavedCustomerList } from '../modules/saved-customers/types'

// The restaurant's saved customers (spec 0005). Every call goes through request-web's own proxy,
// which adds the restaurant's login; the backend scopes everything to that restaurant.

export async function listSavedCustomers(
  args: { q?: string; page?: number; perPage?: number },
  signal?: AbortSignal,
): Promise<SavedCustomerList> {
  const params = new URLSearchParams()
  if (args.q) params.set('q', args.q)
  if (args.page) params.set('page', String(args.page))
  if (args.perPage) params.set('perPage', String(args.perPage))
  const query = params.toString()
  return manualRequestFetch<SavedCustomerList>(`/customers${query ? `?${query}` : ''}`, { signal })
}

// From the Customers page's Add: a phone the restaurant already has is refused (409).
export async function addSavedCustomer(fields: SavedCustomerFields): Promise<SavedCustomer> {
  const result = await manualRequestFetch<{ customer: SavedCustomer }>('/customers', {
    method: 'POST',
    body: JSON.stringify({ ...fields, onPhoneClash: 'refuse' }),
  })
  return result.customer
}

// From an order: a new customer, or the one with this phone updated, and marked used (AC-1).
export async function saveCustomerFromOrder(fields: SavedCustomerFields): Promise<SavedCustomer> {
  const result = await manualRequestFetch<{ customer: SavedCustomer }>('/customers', {
    method: 'POST',
    body: JSON.stringify({ ...fields, onPhoneClash: 'update', markUsed: true }),
  })
  return result.customer
}

export async function updateSavedCustomer(
  id: string,
  fields: Partial<SavedCustomerFields>,
  options: { markUsed?: boolean } = {},
): Promise<SavedCustomer> {
  const result = await manualRequestFetch<{ customer: SavedCustomer }>(`/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...fields, ...(options.markUsed && { markUsed: true }) }),
  })
  return result.customer
}

// An order used this customer without saving its details again (the tick off, AC-3).
export async function markSavedCustomerUsed(id: string): Promise<void> {
  await manualRequestFetch<void>(`/customers/${encodeURIComponent(id)}/used`, { method: 'POST' })
}

export async function deleteSavedCustomer(id: string): Promise<void> {
  await manualRequestFetch<void>(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// How many months an unused customer is kept, from request-web's own server route (it reads the
// backend's public /metadata). Null when it cannot be read.
export async function fetchRetentionMonths(): Promise<number | null> {
  try {
    const response = await fetch('/api/partner-metadata')
    if (!response.ok) return null
    const body = await response.json()
    return typeof body?.savedCustomerRetentionMonths === 'number' ? body.savedCustomerRetentionMonths : null
  } catch {
    return null
  }
}
