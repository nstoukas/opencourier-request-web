import {
  DEFAULT_COUNTRY_CODE,
  customerFieldsFromOrder,
  orderValuesFromCustomer,
  phoneSearchDigits,
  customerStreet,
} from './fields'
import type { SavedCustomer } from '../types'

describe('fields.ts mapping utilities', () => {
  describe('customerFieldsFromOrder', () => {
    it('maps houseNumber to addressLine2, trims strings, and turns empty optional texts into null', () => {
      const orderValues = {
        dropoffName: '  Katerina Sakellaropoulou  ',
        dropoffPhoneNumber: '  +30 691 234 5678  ',
        dropoffNotes: '   Ring doorbell twice   ',
        dropoffAddress: {
          streetAddress: ['  Politechniou 12  '],
          houseNumber: '  Floor 2, Flat B  ',
          city: '  Volos  ',
          zipCode: '  38221  ',
          formattedAddress: '  Politechniou 12, Volos, 38221  ',
        },
        dropoffLatitude: 39.362,
        dropoffLongitude: 22.945,
      }

      const result = customerFieldsFromOrder(orderValues)

      expect(result).toEqual({
        name: 'Katerina Sakellaropoulou',
        phone: '+30 691 234 5678',
        notes: 'Ring doorbell twice',
        addressLine1: 'Politechniou 12',
        addressLine2: 'Floor 2, Flat B',
        city: 'Volos',
        zipCode: '38221',
        latitude: 39.362,
        longitude: 22.945,
        formattedAddress: 'Politechniou 12, Volos, 38221',
      })
    })

    it('turns whitespace-only or empty optional texts into null and never saves business name', () => {
      const orderValues: any = {
        dropoffName: 'Nikos',
        dropoffPhoneNumber: '2421012345',
        dropoffNotes: '   ',
        dropoffBusinessName: 'Nikos Bakery', // MUST NOT be saved
        dropoffAddress: {
          streetAddress: ['Iasonos 1'],
          houseNumber: '',
          city: 'Volos',
          zipCode: '   ',
          formattedAddress: '',
        },
      }

      const result = customerFieldsFromOrder(orderValues)

      expect(result.notes).toBeNull()
      expect(result.addressLine2).toBeNull()
      expect(result.zipCode).toBeNull()
      expect(result.formattedAddress).toBeNull()
      expect((result as any).businessName).toBeUndefined()
      expect((result as any).dropoffBusinessName).toBeUndefined()
      expect(result.latitude).toBe(0)
      expect(result.longitude).toBe(0)
    })

    it('handles completely empty or missing dropoff values safely', () => {
      const result = customerFieldsFromOrder({})
      expect(result).toEqual({
        name: '',
        phone: '',
        notes: null,
        addressLine1: '',
        addressLine2: null,
        city: '',
        zipCode: null,
        latitude: 0,
        longitude: 0,
        formattedAddress: null,
      })
    })
  })

  describe('orderValuesFromCustomer', () => {
    it('sets country GR, state empty string, coordinates, and maps fields back to form structure', () => {
      const customer: SavedCustomer = {
        id: 'cust-456',
        name: 'Dimitris Diamantidis',
        phone: '+306987654321',
        notes: 'Leave at front porch',
        addressLine1: 'Dimitriadis 150',
        addressLine2: 'Floor 3',
        city: 'Volos',
        zipCode: '38221',
        latitude: 39.358,
        longitude: 22.948,
        formattedAddress: 'Dimitriadis 150, Volos',
        lastUsedAt: '2026-10-26T14:00:00Z',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-26T14:00:00Z',
      }

      const orderValues = orderValuesFromCustomer(customer)

      expect(orderValues).toEqual({
        dropoffName: 'Dimitris Diamantidis',
        dropoffPhoneNumber: '+306987654321',
        dropoffNotes: 'Leave at front porch',
        dropoffAddress: {
          streetAddress: ['Dimitriadis 150'],
          houseNumber: 'Floor 3',
          city: 'Volos',
          state: '',
          zipCode: '38221',
          countryCode: DEFAULT_COUNTRY_CODE,
          formattedAddress: 'Dimitriadis 150, Volos',
        },
        dropoffLatitude: 39.358,
        dropoffLongitude: 22.948,
      })
      expect(DEFAULT_COUNTRY_CODE).toBe('GR')
    })

    it('falls back to empty strings when optional customer fields are null', () => {
      const customer: SavedCustomer = {
        id: 'cust-789',
        name: 'Anna',
        phone: '+306900000000',
        notes: null,
        addressLine1: 'Ermou 1',
        addressLine2: null,
        city: 'Volos',
        zipCode: null,
        latitude: 39.36,
        longitude: 22.94,
        formattedAddress: null,
        lastUsedAt: '2026-10-26T14:00:00Z',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-26T14:00:00Z',
      }

      const orderValues = orderValuesFromCustomer(customer)

      expect(orderValues.dropoffNotes).toBe('')
      expect(orderValues.dropoffAddress.houseNumber).toBe('')
      expect(orderValues.dropoffAddress.zipCode).toBe('')
      expect(orderValues.dropoffAddress.formattedAddress).toBe('')
      expect(orderValues.dropoffAddress.state).toBe('')
      expect(orderValues.dropoffAddress.countryCode).toBe('GR')
    })
  })

  describe('phoneSearchDigits', () => {
    it('strips non-digits and keeps only the last 10 digits', () => {
      expect(phoneSearchDigits('0030 691 234 5678')).toBe('6912345678')
      expect(phoneSearchDigits('+30 691-234-5678')).toBe('6912345678')
      expect(phoneSearchDigits('+30 (24210) 12345')).toBe('2421012345')
    })

    it('keeps all digits if there are fewer than 10', () => {
      expect(phoneSearchDigits('24210 1234')).toBe('242101234')
      expect(phoneSearchDigits('12')).toBe('12')
      expect(phoneSearchDigits('')).toBe('')
    })
  })

  describe('customerStreet', () => {
    it('returns formattedAddress when available and trimmed', () => {
      expect(
        customerStreet({
          formattedAddress: '  Ermou 45, Volos  ',
          addressLine1: 'Ermou 45',
        }),
      ).toBe('Ermou 45, Volos')
    })

    it('falls back to addressLine1 when formattedAddress is null, empty or only whitespace', () => {
      expect(
        customerStreet({
          formattedAddress: null,
          addressLine1: 'Iasonos 10',
        }),
      ).toBe('Iasonos 10')

      expect(
        customerStreet({
          formattedAddress: '   ',
          addressLine1: 'Iasonos 10',
        }),
      ).toBe('Iasonos 10')
    })
  })
})
