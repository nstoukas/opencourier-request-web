import { manualRequestFetch } from './manualRequestApi'

// Spec 0052 (row 83, AC-3, AC-7): a restaurant complains about the rider of one of its delivered or
// cancelled orders and reads the outcome, through the app's own partner proxy. The browser holds no
// credential; the server finds the restaurant from the session.

// The categories a restaurant can pick: the backend's list for a complaint about a rider.
export const RIDER_COMPLAINT_CATEGORIES = ['LATE', 'RUDE', 'FOOD_DAMAGED', 'OTHER'] as const
// `typeof X[number]` is "any one value of the list above", so the type follows the list.
export type RiderComplaintCategory = (typeof RIDER_COMPLAINT_CATEGORIES)[number]

// What the restaurant sees of its own complaint (the backend's ComplaintPartnerDto). Never the rider's
// reply and never who decided; the status reads OPEN until a decision, whether or not the rider replied.
export type PartnerComplaint = {
  id: string
  deliveryId: string
  category: string
  text: string
  status: 'OPEN' | 'DECIDED' | 'WITHDRAWN'
  createdAt: string
  outcome: string | null
  decidedAt: string | null
  withdrawnReason: string | null
  withdrawnAt: string | null
}

type Page<T> = { data: T[]; pagination?: { nextPage: number | null } }

// The complaints this restaurant filed on one order, newest first. One order has at most a few, so the
// first page is the whole list.
export async function fetchOrderComplaints(deliveryId: string): Promise<PartnerComplaint[]> {
  const page = await manualRequestFetch<Page<PartnerComplaint>>(
    `/complaints?deliveryId=${encodeURIComponent(deliveryId)}&perPage=100`,
  )
  return page.data
}

export async function fileRiderComplaint(input: {
  deliveryId: string
  category: RiderComplaintCategory
  text: string
}): Promise<PartnerComplaint> {
  return manualRequestFetch<PartnerComplaint>('/complaints', { method: 'POST', body: JSON.stringify(input) })
}
