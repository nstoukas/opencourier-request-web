// The order code a rider shows when collecting (spec 0021, AC-10): the last 6 characters of the
// delivery id. The same rule as adminweb's `shortId` and the courier app's `orderCodeOf`, so the
// restaurant, the rider and the co-op all read the same code. Ids are cuids, so the end is the most
// varied part. '' when there is no id yet.
export function orderCodeOf(deliveryId: string | null | undefined): string {
  return deliveryId ? deliveryId.slice(-6) : ''
}
