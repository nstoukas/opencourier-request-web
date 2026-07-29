import {
  buildManualRequestFormattedAddress,
  PartnerProfileDto,
} from '../modules/manual-request/types'

export interface PartnerPickupFormValues {
  pickupName: string
  pickupPhoneNumber: string
  pickupBusinessName: string
  pickupAddress: {
    streetAddress: string[]
    city: string
    state: string
    zipCode: string
    countryCode: string
    houseNumber: string
    formattedAddress: string
  }
  pickupLatitude: number
  pickupLongitude: number
}

export function mapPartnerProfileToPickupValues(profile: PartnerProfileDto): PartnerPickupFormValues | null {
  if (!profile.pickupAddress) {
    return null
  }

  const { street, houseNumber, city, state, zipCode, countryCode, latitude, longitude, formattedAddress } = profile.pickupAddress
  const streetCombined = [street, houseNumber].filter(Boolean).join(' ').trim()
  const upperCountryCode = (countryCode ?? '').toUpperCase()
  const finalCity = city ?? ''
  const finalState = state ?? ''
  const finalZipCode = zipCode ?? ''

  const mappedAddress = {
    streetAddress: streetCombined ? [streetCombined] : [''],
    city: finalCity,
    state: finalState,
    zipCode: finalZipCode,
    countryCode: upperCountryCode,
    houseNumber: '',
  }

  // Use profile name for contact name since profile has no separate contact name field
  const resolvedFormattedAddress =
    formattedAddress?.trim() || buildManualRequestFormattedAddress(mappedAddress)

  return {
    pickupBusinessName: profile.name,
    pickupName: profile.name,
    pickupPhoneNumber: profile.phoneNumber ?? '',
    pickupAddress: {
      ...mappedAddress,
      formattedAddress: resolvedFormattedAddress,
    },
    pickupLatitude: latitude,
    pickupLongitude: longitude,
  }
}

export function checkPartnerPickupUsable(profile: PartnerProfileDto | undefined): { usable: boolean; reason: string | null } {
  if (!profile) {
    return { usable: false, reason: 'Profile data is unavailable.' }
  }

  if (!profile.name || !profile.name.trim()) {
    return { usable: false, reason: 'Your restaurant profile is missing a name.' }
  }

  if (!profile.phoneNumber || profile.phoneNumber.trim().length < 7) {
    return { usable: false, reason: 'Your restaurant profile is missing a valid phone number.' }
  }

  if (!profile.pickupAddress) {
    return { usable: false, reason: 'Your restaurant does not have a pickup address on file.' }
  }

  const { street, houseNumber, city, state, latitude, longitude } = profile.pickupAddress

  const streetCombined = [street, houseNumber].filter(Boolean).join(' ').trim()
  if (!streetCombined) {
    return { usable: false, reason: 'Your restaurant pickup address is missing a street.' }
  }

  if (!city || !city.trim() || !state || !state.trim()) {
    return { usable: false, reason: 'Your restaurant pickup address is missing city or state.' }
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    return { usable: false, reason: 'Your restaurant pickup address is missing valid coordinates.' }
  }

  return { usable: true, reason: null }
}
