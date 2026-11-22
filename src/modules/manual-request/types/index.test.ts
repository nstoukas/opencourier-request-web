import { buildManualRequestFormattedAddress } from './index'

// The form emits partial snapshots while the user is still typing, which is why every
// field is optional/nullable. These cases pin that: half-filled input must format what
// is there rather than fail.

describe('buildManualRequestFormattedAddress (standard stored address order, decision 47.15)', () => {
  it('builds a full line in standard stored order (street and house, city, state, zip country, retaining GR)', () => {
    expect(
      buildManualRequestFormattedAddress({
        houseNumber: '12',
        streetAddress: ['Iasonos'],
        city: 'Volos',
        state: 'Thessaly',
        zipCode: '38221',
        countryCode: 'GR',
      }),
    ).toBe('12 Iasonos, Volos, Thessaly, 38221 GR')
  })

  it('includes country when it is not GR', () => {
    expect(
      buildManualRequestFormattedAddress({
        houseNumber: '12',
        streetAddress: ['Iasonos'],
        city: 'Volos',
        state: 'Thessaly',
        zipCode: '38221',
        countryCode: 'CY',
      }),
    ).toBe('12 Iasonos, Volos, Thessaly, 38221 CY')
  })

  it('does not repeat the house number when the street already starts with it', () => {
    expect(
      buildManualRequestFormattedAddress({
        houseNumber: '12',
        streetAddress: ['12 Iasonos'],
        city: 'Volos',
      }),
    ).toBe('12 Iasonos, Volos')
  })

  it('formats a half-filled address instead of failing', () => {
    expect(
      buildManualRequestFormattedAddress({ city: 'Volos', countryCode: 'GR' }),
    ).toBe('Volos, GR')

    expect(
      buildManualRequestFormattedAddress({ city: 'Volos', countryCode: 'FR' }),
    ).toBe('Volos, FR')
  })

  it('accepts nulls for every field', () => {
    expect(
      buildManualRequestFormattedAddress({
        streetAddress: null,
        city: null,
        state: null,
        zipCode: null,
        countryCode: null,
        houseNumber: null,
      }),
    ).toBe('')
  })

  it('returns an empty string for an empty object', () => {
    expect(buildManualRequestFormattedAddress({})).toBe('')
  })

  it('trims surrounding whitespace and drops blank segments', () => {
    expect(
      buildManualRequestFormattedAddress({
        streetAddress: ['  Iasonos  '],
        city: '  Volos  ',
        state: '   ',
      }),
    ).toBe('Iasonos, Volos')
  })

  it('uses the house number alone when no street is given', () => {
    expect(
      buildManualRequestFormattedAddress({ houseNumber: '12', city: 'Volos' }),
    ).toBe('12, Volos')
  })
})
