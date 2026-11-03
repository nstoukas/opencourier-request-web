// Spec 0023: what the restaurant may do about an order's ready time, from the partner API's own fields.

// The statuses in which the ready time can still move or be marked: before the rider has the food.
// The same list as the backend's READY_ACTION_STATUSES (src/domains/delivery/ready-signals.ts).
export const READY_ACTION_STATUSES: readonly string[] = [
  'CREATED',
  'ASSIGNING_COURIER',
  'ACCEPTED',
  'DISPATCHED',
  'COURIER_ARRIVED_AT_PICKUP_LOCATION',
]

export const READY_DELAY_OPTIONS = [5, 10, 15] as const

export type ReadyFields = {
  status: string
  readyAt: string | null
  foodReadyAt: string | null
}

// 'actions': show the ready time and the four buttons; 'ready': "Food ready at …", no buttons;
// 'none': nothing to press (picked up, ended, or an order made before ready times existed).
export function readyView(order: ReadyFields): 'actions' | 'ready' | 'none' {
  if (order.foodReadyAt) return 'ready'
  // An order made before ready times existed has none to move (spec 0023, AC-7's rule on the phone).
  if (!order.readyAt) return 'none'
  if (!READY_ACTION_STATUSES.includes(order.status)) return 'none'
  return 'actions'
}
