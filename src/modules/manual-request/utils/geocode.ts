// Turning a typed address into a map point. Shared by the order form and the saved customer dialog
// (spec 0005), so both look an address up the same way. Moved here from CreateDeliveryForm.tsx.

// The address fields a lookup reads. Any address form value with these fields fits.
export interface GeocodableAddress {
  streetAddress?: string[]
  houseNumber?: string
  city?: string
  state?: string
  zipCode?: string
  countryCode?: string
}

export const GEOCODE_TIMEOUT_MS = 8000

export type GeocodeCoordinatesResult = { latitude: number; longitude: number; displayName?: string }

// The part of an address that decides where its map point is. When it changes after the point was set
// (a pick from the address search, a picked saved customer, a customer as loaded), the point belongs to
// another address and must be looked up again (spec 0005; the order form and the customer dialog).
export function addressPinKey(address: GeocodableAddress | undefined): string {
  return [address?.streetAddress?.[0], address?.city, address?.zipCode]
    .map((part) => (part ?? '').trim().toLowerCase())
    .join('|')
}

// 0,0 is what an empty form holds, never a real Volos address.
export function hasValidCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0)
}

export async function geocodeCoordinatesFromAddress(
  address: GeocodableAddress,
): Promise<GeocodeCoordinatesResult | null> {
  const query = [
    address.streetAddress?.[0],
    address.houseNumber,
    address.city,
    address.state,
    address.zipCode,
    address.countryCode,
  ]
    .filter(Boolean)
    .join(', ')

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`
  // A public service that may stall: after 8 s the lookup gives up (the fetch throws), so Save or Get
  // Estimate never spins for ever.
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'opencourier-request-web/1.0 (manual delivery form)',
    },
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  })
  if (!response.ok) return null

  const result = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>
  const first = result[0]
  if (!first) return null

  const latitude = parseFloat(first.lat)
  const longitude = parseFloat(first.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    latitude,
    longitude,
    displayName: first.display_name?.trim() || undefined,
  }
}
