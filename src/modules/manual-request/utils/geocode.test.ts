import {
  addressPinKey,
  hasValidCoordinates,
  geocodeCoordinatesFromAddress,
  GEOCODE_TIMEOUT_MS,
  GeocodableAddress,
} from './geocode'

describe('geocode utils', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('addressPinKey', () => {
    it('trims whitespace and ignores case for street, city, and zip', () => {
      const addr1: GeocodableAddress = {
        streetAddress: ['  Iasonos 45  '],
        city: '  VoLoS  ',
        zipCode: ' 38221 ',
      }
      const addr2: GeocodableAddress = {
        streetAddress: ['iasonos 45'],
        city: 'volos',
        zipCode: '38221',
      }

      expect(addressPinKey(addr1)).toBe('iasonos 45|volos|38221')
      expect(addressPinKey(addr1)).toBe(addressPinKey(addr2))
    })

    it('reads street, city, and zip only (ignores houseNumber, state, and countryCode)', () => {
      const base: GeocodableAddress = {
        streetAddress: ['Iasonos 45'],
        city: 'Volos',
        zipCode: '38221',
      }
      const withExtra: GeocodableAddress = {
        ...base,
        houseNumber: 'Floor 3',
        state: 'Thessaly',
        countryCode: 'GR',
      }

      expect(addressPinKey(base)).toBe(addressPinKey(withExtra))
    })

    it('handles undefined address or missing fields gracefully', () => {
      expect(addressPinKey(undefined)).toBe('||')
      expect(addressPinKey({})).toBe('||')
      expect(addressPinKey({ streetAddress: ['Ermou 10'] })).toBe('ermou 10||')
    })
  })

  describe('hasValidCoordinates', () => {
    it('returns true for finite non-zero coordinates', () => {
      expect(hasValidCoordinates(39.3628, 22.9435)).toBe(true)
      expect(hasValidCoordinates(-12.34, 56.78)).toBe(true)
    })

    it('returns false for (0, 0) default coordinates', () => {
      expect(hasValidCoordinates(0, 0)).toBe(false)
    })

    it('returns false for non-finite numbers (NaN, Infinity)', () => {
      expect(hasValidCoordinates(NaN, 22.94)).toBe(false)
      expect(hasValidCoordinates(39.36, NaN)).toBe(false)
      expect(hasValidCoordinates(Infinity, 22.94)).toBe(false)
      expect(hasValidCoordinates(39.36, -Infinity)).toBe(false)
    })
  })

  describe('geocodeCoordinatesFromAddress', () => {
    it('defines GEOCODE_TIMEOUT_MS as 8000 ms', () => {
      expect(GEOCODE_TIMEOUT_MS).toBe(8000)
    })

    it('returns parsed coordinates and displayName on valid response, passing an AbortSignal with timeout', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            lat: '39.3628',
            lon: '22.9435',
            display_name: 'Ermou 120, Volos, Thessaly, 38221, Greece',
          },
        ]),
      })
      global.fetch = fetchSpy

      const address: GeocodableAddress = {
        streetAddress: ['Ermou 120'],
        city: 'Volos',
        countryCode: 'GR',
      }

      const result = await geocodeCoordinatesFromAddress(address)

      expect(result).toEqual({
        latitude: 39.3628,
        longitude: 22.9435,
        displayName: 'Ermou 120, Volos, Thessaly, 38221, Greece',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://nominatim.openstreetmap.org/search'),
        expect.objectContaining({
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'opencourier-request-web/1.0 (manual delivery form)',
          },
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('returns null on a non ok answer (e.g. 500 error)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      const result = await geocodeCoordinatesFromAddress({ streetAddress: ['Unknown St'] })
      expect(result).toBeNull()
    })

    it('returns null on an empty list answer', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      })

      const result = await geocodeCoordinatesFromAddress({ streetAddress: ['Nowhere St'] })
      expect(result).toBeNull()
    })

    it('returns null on non numeric coordinates', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { lat: 'not-a-number', lon: '22.9435', display_name: 'Invalid Lat' },
        ]),
      })

      const result = await geocodeCoordinatesFromAddress({ streetAddress: ['Ermou 120'] })
      expect(result).toBeNull()
    })
  })
})
