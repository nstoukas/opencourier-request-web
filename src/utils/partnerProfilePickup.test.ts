import { createI18n } from '../i18n/createI18n'
import {
  mapPartnerProfileToPickupValues,
  checkPartnerPickupUsable,
} from './partnerProfilePickup'
import {
  PartnerProfileDto,
  buildManualRequestFormattedAddress,
} from '../modules/manual-request/types'

const t = createI18n('en').t

// Real fixture values from opencourier-backend/scripts/seedPartnerPickupLocation.ts
const fixtureProfile: PartnerProfileDto = {
  name: 'Nosh',
  phoneNumber: '+302421012345',
  pickupAddress: {
    street: 'Ermou',
    houseNumber: '120',
    city: 'Volos',
    state: 'Thessaly',
    zipCode: '38221',
    countryCode: 'GR',
    latitude: 39.3628,
    longitude: 22.9435,
    formattedAddress: 'Ermou 120, Volos, Thessaly, 38221, GR',
  },
}

describe('partnerProfilePickup utils', () => {
  // Test Plan case 1: mapPartnerProfileToPickupValues on fixture returns exact structure
  it('maps partner profile to form pickup values matching fixture exactly', () => {
    const mapped = mapPartnerProfileToPickupValues(fixtureProfile)
    expect(mapped).toEqual({
      pickupBusinessName: 'Nosh',
      pickupName: 'Nosh',
      pickupPhoneNumber: '+302421012345',
      pickupAddress: {
        streetAddress: ['Ermou 120'],
        city: 'Volos',
        state: 'Thessaly',
        zipCode: '38221',
        countryCode: 'GR',
        houseNumber: '',
        formattedAddress: 'Ermou 120, Volos, Thessaly, 38221, GR',
      },
      pickupLatitude: 39.3628,
      pickupLongitude: 22.9435,
    })
  })

  // Test Plan case 2: formattedAddress: null -> mapper uses buildManualRequestFormattedAddress
  it('builds formatted address when formattedAddress is null in input profile', () => {
    const profileWithNullFormatted: PartnerProfileDto = {
      ...fixtureProfile,
      pickupAddress: {
        ...fixtureProfile.pickupAddress!,
        formattedAddress: null,
      },
    }
    const mapped = mapPartnerProfileToPickupValues(profileWithNullFormatted)
    const expectedFormatted = buildManualRequestFormattedAddress({
      streetAddress: ['Ermou 120'],
      city: 'Volos',
      state: 'Thessaly',
      zipCode: '38221',
      countryCode: 'GR',
      houseNumber: '',
    })
    expect(mapped?.pickupAddress.formattedAddress).toBe(expectedFormatted)
    expect(mapped?.pickupAddress.formattedAddress).toBe('Ermou 120, Volos, Thessaly, 38221 GR')
  })

  // Test Plan case 3: pickupAddress: null -> returns null and flags unusable with reason
  it('returns null and flags pickup as unusable when pickupAddress is null', () => {
    const profileNoAddress: PartnerProfileDto = {
      name: 'Nosh',
      phoneNumber: '+302421012345',
      pickupAddress: null,
    }

    expect(mapPartnerProfileToPickupValues(profileNoAddress)).toBeNull()

    const usableCheck = checkPartnerPickupUsable(profileNoAddress)
    expect(usableCheck.usable).toBe(false)
    expect(usableCheck.reason).toBe('pickup.missingAddress')
    expect(t(usableCheck.reason!)).toBe('Your restaurant does not have a pickup address on file.')
  })

  // Test Plan case 4: checkPartnerPickupUsable validation cases
  it('validates usability for incomplete or invalid pickup profiles', () => {
    // Full fixture should be usable
    expect(checkPartnerPickupUsable(fixtureProfile)).toEqual({
      usable: true,
      reason: null,
    })

    // Missing state -> unusable
    const missingState: PartnerProfileDto = {
      ...fixtureProfile,
      pickupAddress: { ...fixtureProfile.pickupAddress!, state: '' },
    }
    const missingStateCheck = checkPartnerPickupUsable(missingState)
    expect(missingStateCheck.usable).toBe(false)
    expect(missingStateCheck.reason).toBe('pickup.missingCity')
    expect(t(missingStateCheck.reason!)).toBe('Your restaurant pickup address is missing city or state.')

    // Null city -> unusable
    const nullCity: PartnerProfileDto = {
      ...fixtureProfile,
      pickupAddress: { ...fixtureProfile.pickupAddress!, city: null },
    }
    const nullCityCheck = checkPartnerPickupUsable(nullCity)
    expect(nullCityCheck.usable).toBe(false)
    expect(nullCityCheck.reason).toBe('pickup.missingCity')
    expect(t(nullCityCheck.reason!)).toBe('Your restaurant pickup address is missing city or state.')

    // Phone number shorter than 7 chars -> unusable
    const shortPhone: PartnerProfileDto = {
      ...fixtureProfile,
      phoneNumber: '123',
    }
    const shortPhoneCheck = checkPartnerPickupUsable(shortPhone)
    expect(shortPhoneCheck.usable).toBe(false)
    expect(shortPhoneCheck.reason).toBe('pickup.missingPhone')
    expect(t(shortPhoneCheck.reason!)).toBe('Your restaurant profile is missing a valid phone number.')

    // Coordinates both zero -> unusable
    const zeroCoords: PartnerProfileDto = {
      ...fixtureProfile,
      pickupAddress: { ...fixtureProfile.pickupAddress!, latitude: 0, longitude: 0 },
    }
    const zeroCoordsCheck = checkPartnerPickupUsable(zeroCoords)
    expect(zeroCoordsCheck.usable).toBe(false)
    expect(zeroCoordsCheck.reason).toBe('pickup.missingCoordinates')
    expect(t(zeroCoordsCheck.reason!)).toBe('Your restaurant pickup address is missing valid coordinates.')

    // Missing street & houseNumber -> unusable, and mapper emits fallback ['']
    const missingStreet: PartnerProfileDto = {
      ...fixtureProfile,
      pickupAddress: { ...fixtureProfile.pickupAddress!, street: null, houseNumber: null },
    }
    const missingStreetCheck = checkPartnerPickupUsable(missingStreet)
    expect(missingStreetCheck.usable).toBe(false)
    expect(missingStreetCheck.reason).toBe('pickup.missingStreet')
    expect(t(missingStreetCheck.reason!)).toBe('Your restaurant pickup address is missing a street.')
    expect(mapPartnerProfileToPickupValues(missingStreet)?.pickupAddress.streetAddress).toEqual([''])
  })
})
