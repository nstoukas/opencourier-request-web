// Turning a typed address into a map point. Shared by the order form and the saved customer dialog
// (spec 0005), so both look an address up the same way. Moved here from CreateDeliveryForm.tsx.

import { GeoPoint, nearbyViewbox } from './orderForm'

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

// `near` (optional): the restaurant's pickup point, so a street name found in several towns gives the
// one near the restaurant first (spec 0006, AC-10).
export async function geocodeCoordinatesFromAddress(
  address: GeocodableAddress,
  near?: GeoPoint,
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

  const viewbox = near && hasValidCoordinates(near.latitude, near.longitude) ? `&viewbox=${nearbyViewbox(near)}` : ''
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1${viewbox}`
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

// ─── "Show on map" (spec 0016, AC-4) ──────────────────────────────────────────

export const ADDRESS_NOT_FOUND_ON_MAP = "Address not found. Move the map to the customer's entrance."

// Where to put the pin for a typed address: the lookup's point, or, when the lookup finds nothing,
// `fallback` (the restaurant's own point, else Volos centre) with a sentence asking the restaurant to
// move the map. A lookup that fails or does not answer is an error, in plain words.
export type PinLookupResult =
  | { point: GeoPoint; formattedAddress: string | null; message: string | null }
  | { error: string }

export async function lookUpPinForAddress(
  address: GeocodableAddress,
  near: GeoPoint | undefined,
  fallback: GeoPoint,
): Promise<PinLookupResult> {
  let found: GeocodeCoordinatesResult | null
  try {
    found = await geocodeCoordinatesFromAddress(address, near)
  } catch (lookupError) {
    return {
      error:
        (lookupError as Error | undefined)?.name === 'TimeoutError'
          ? 'The address lookup did not answer. Try again, or search the address and pick a result.'
          : 'The address lookup failed. Check your connection and try again.',
    }
  }
  if (!found) {
    return { point: fallback, formattedAddress: null, message: ADDRESS_NOT_FOUND_ON_MAP }
  }
  return {
    point: { latitude: found.latitude, longitude: found.longitude },
    formattedAddress: found.displayName ?? null,
    message: null,
  }
}
