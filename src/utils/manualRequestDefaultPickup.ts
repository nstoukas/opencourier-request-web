/**
 * Persists default pickup contact + address in localStorage for the manual request form.
 */

export const MANUAL_REQUEST_DEFAULT_PICKUP_STORAGE_KEY = 'opencourier-manual-request-default-pickup'

const STORAGE_VERSION = 1 as const

export interface ManualRequestDefaultPickupSnapshot {
  pickupName: string
  pickupPhoneNumber: string
  pickupBusinessName: string
  pickupNotes: string
  pickupAddress: {
    streetAddress: string[]
    city: string
    state: string
    zipCode: string
    countryCode: string
    houseNumber?: string
    formattedAddress?: string
  }
  pickupLatitude: number
  pickupLongitude: number
  pickupReadyAt: string
  pickupDeadlineAt: string
}

interface StoredEnvelope {
  v: typeof STORAGE_VERSION
  data: ManualRequestDefaultPickupSnapshot
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function normalizeAddress(
  raw: unknown,
): ManualRequestDefaultPickupSnapshot['pickupAddress'] | null {
  if (!isRecord(raw)) return null
  const street = raw.streetAddress
  const lines = Array.isArray(street)
    ? street.filter((s): s is string => typeof s === 'string')
    : typeof street === 'string'
      ? [street]
      : []
  const country =
    typeof raw.countryCode === 'string' && raw.countryCode.length >= 2
      ? raw.countryCode.slice(0, 2).toUpperCase()
      : 'US'
  const city = typeof raw.city === 'string' ? raw.city : ''
  const state = typeof raw.state === 'string' ? raw.state : ''
  const zipCode = typeof raw.zipCode === 'string' ? raw.zipCode : ''
  const houseNumber = typeof raw.houseNumber === 'string' ? raw.houseNumber : ''
  const formattedAddress =
    typeof raw.formattedAddress === 'string' ? raw.formattedAddress : ''
  return {
    streetAddress: lines.length > 0 ? lines : [''],
    city,
    state,
    zipCode,
    countryCode: country,
    houseNumber,
    formattedAddress,
  }
}

/** Returns null if missing or invalid. */
export function readManualRequestDefaultPickup(): ManualRequestDefaultPickupSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MANUAL_REQUEST_DEFAULT_PICKUP_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.v !== STORAGE_VERSION) return null
    const data = parsed.data
    if (!isRecord(data)) return null

    const addr = normalizeAddress(data.pickupAddress)
    if (!addr || !addr.city.trim() || !addr.state.trim()) return null

    const nameOk = typeof data.pickupName === 'string' && data.pickupName.trim().length > 0
    const phoneOk =
      typeof data.pickupPhoneNumber === 'string' && data.pickupPhoneNumber.trim().length >= 7
    const businessOk =
      typeof data.pickupBusinessName === 'string' && data.pickupBusinessName.trim().length > 0
    if (!nameOk || !phoneOk || !businessOk) return null

    const lat = Number(data.pickupLatitude)
    const lon = Number(data.pickupLongitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

    return {
      pickupName: data.pickupName as string,
      pickupPhoneNumber: data.pickupPhoneNumber as string,
      pickupBusinessName: data.pickupBusinessName as string,
      pickupNotes: typeof data.pickupNotes === 'string' ? data.pickupNotes : '',
      pickupAddress: addr,
      pickupLatitude: lat,
      pickupLongitude: lon,
      pickupReadyAt: typeof data.pickupReadyAt === 'string' ? data.pickupReadyAt : '',
      pickupDeadlineAt: typeof data.pickupDeadlineAt === 'string' ? data.pickupDeadlineAt : '',
    }
  } catch {
    return null
  }
}

export function writeManualRequestDefaultPickup(snapshot: ManualRequestDefaultPickupSnapshot): void {
  const envelope: StoredEnvelope = { v: STORAGE_VERSION, data: snapshot }
  localStorage.setItem(MANUAL_REQUEST_DEFAULT_PICKUP_STORAGE_KEY, JSON.stringify(envelope))
}

export function clearManualRequestDefaultPickup(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(MANUAL_REQUEST_DEFAULT_PICKUP_STORAGE_KEY)
}
