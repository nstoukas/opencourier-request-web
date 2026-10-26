import type { SavedCustomer, SavedCustomerFields } from '../types'

// This instance serves Volos, so an address with no country is Greek (the backend reads phones the
// same way, DEFAULT_PHONE_REGION).
export const DEFAULT_COUNTRY_CODE = 'GR'

// The drop off side of the order form, as the save after an order reads it. Every field is optional
// because that is how the form's type comes out of zod in this repo (TypeScript's strict mode is off,
// and zod then marks every key optional); the form has validated them before an order is sent.
export interface OrderDropoffValues {
  dropoffName?: string
  dropoffPhoneNumber?: string
  // "Floor and doorbell" and "Note for the rider" (spec 0006)
  floorAndBell?: string
  note?: string
  dropoffAddress?: {
    streetAddress?: string[]
    houseNumber?: string
    city?: string
    zipCode?: string
    formattedAddress?: string
  }
  dropoffLatitude?: number
  dropoffLongitude?: number
}

// Trimmed text, or null when nothing is left.
function optional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

// The customer to save from an order's drop off details (spec 0005, the order flow's mapping).
// "Floor and doorbell" is the customer's addressLine2 and the rider note its notes (spec 0006, AC-9);
// the two line text sent to the rider is never saved.
export function customerFieldsFromOrder(values: OrderDropoffValues): SavedCustomerFields {
  const address = values.dropoffAddress ?? {}
  return {
    name: (values.dropoffName ?? '').trim(),
    phone: (values.dropoffPhoneNumber ?? '').trim(),
    notes: optional(values.note),
    addressLine1: (address.streetAddress?.[0] ?? '').trim(),
    addressLine2: optional(values.floorAndBell),
    city: (address.city ?? '').trim(),
    zipCode: optional(address.zipCode),
    latitude: values.dropoffLatitude ?? 0,
    longitude: values.dropoffLongitude ?? 0,
    formattedAddress: optional(address.formattedAddress),
  }
}

// The order form's drop off fields a picked customer fills in (AC-3). The coordinates come along, so
// the estimate needs no address search; the country is Greek and the state empty, as the backend
// stores neither. The delivery's houseNumber stays empty (spec 0006: the backend shares one address
// row per street and point, so a doorbell name there would show on other orders).
export function orderValuesFromCustomer(customer: SavedCustomer) {
  return {
    dropoffName: customer.name,
    dropoffPhoneNumber: customer.phone,
    floorAndBell: customer.addressLine2 ?? '',
    note: customer.notes ?? '',
    dropoffAddress: {
      streetAddress: [customer.addressLine1],
      houseNumber: '',
      city: customer.city,
      state: '',
      zipCode: customer.zipCode ?? '',
      countryCode: DEFAULT_COUNTRY_CODE,
      formattedAddress: customer.formattedAddress ?? '',
    },
    dropoffLatitude: customer.latitude,
    dropoffLongitude: customer.longitude,
  }
}

// The street a list row or picker row shows.
export function customerStreet(customer: Pick<SavedCustomer, 'formattedAddress' | 'addressLine1'>): string {
  return customer.formattedAddress?.trim() || customer.addressLine1
}

// The digits to search for to find the customer with this phone: the last 10 digits, since the
// backend matches typed digits inside the stored international number ("0030 691…" would not
// match "+30691…" whole). Shorter phones keep all their digits.
export function phoneSearchDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-10)
}
