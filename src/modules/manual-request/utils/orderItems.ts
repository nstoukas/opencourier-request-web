import type { ManualRequestOrderItemInput, ManualRequestPackageSize } from '../types'

// Spec 0028 (row 103): the order form's optional item lines. A line can be marked as a drink or a side,
// the items riders most often leave behind; the rider's checklist lists those first.
export type OrderItemKind = 'DRINK' | 'SIDE'

export interface OrderItemLine {
  name: string
  quantity: number
  kind: OrderItemKind | null
}

export const ITEM_NAME_MAX = 60
export const ITEM_QUANTITY_MAX = 20
export const ITEM_LINES_MAX = 20
export const ITEM_NAME_REQUIRED = 'Name the item, or remove the line.'
export const ITEM_NAME_TOO_LONG = `Keep the item name to ${ITEM_NAME_MAX} characters.`

export const emptyItemLine = (): OrderItemLine => ({ name: '', quantity: 1, kind: null })

// What the delivery carries: nothing when there are no lines (the API then sends today's single
// "Package" item, spec 0006, byte for byte); otherwise the lines in order, names trimmed, a mark only
// when set, and the chosen size on the first line, where it has always been (orderItems[0].size).
// The form hands its lines back with every field typed as optional, hence the defaults.
export function orderItemsPayload(
  lines: Partial<OrderItemLine>[],
  size: ManualRequestPackageSize,
): ManualRequestOrderItemInput[] | undefined {
  if (lines.length === 0) return undefined
  return lines.map((line, index) => ({
    name: (line.name ?? '').trim(),
    quantity: line.quantity ?? 1,
    ...(line.kind ? { kind: line.kind } : {}),
    ...(index === 0 ? { size } : {}),
  }))
}
