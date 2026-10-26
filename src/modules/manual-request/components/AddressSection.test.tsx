import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { AddressSection } from './AddressSection'
import { GeoPoint } from '../utils/orderForm'

describe('AddressSection (/src/modules/manual-request/components/AddressSection.tsx)', () => {
  function AddressSectionWrapper({
    prefix = 'dropoff',
    label = 'Dropoff Address',
    compact = false,
    initialQuery = '',
    near,
    defaultTown = '',
    onFormReady,
  }: {
    prefix?: 'pickup' | 'dropoff'
    label?: string
    compact?: boolean
    initialQuery?: string
    near?: GeoPoint
    defaultTown?: string
    onFormReady?: (methods: any) => void
  }) {
    const methods = useForm({
      defaultValues: {
        [`${prefix}Address`]: {
          streetAddress: [''],
          houseNumber: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: '',
          formattedAddress: '',
        },
        [`${prefix}Latitude`]: undefined,
        [`${prefix}Longitude`]: undefined,
      },
    })

    React.useEffect(() => {
      if (onFormReady) onFormReady(methods)
    }, [methods, onFormReady])

    return (
      <FormProvider {...methods}>
        <AddressSection
          control={methods.control as any}
          prefix={prefix}
          label={label}
          compact={compact}
          initialQuery={initialQuery}
          near={near}
          defaultTown={defaultTown}
        />
      </FormProvider>
    )
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('orderForm mode (compact=false)', () => {
    it('does not render the clear button when the search input is empty', () => {
      render(<AddressSectionWrapper />)
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    })

    it('displays the clear button with accessible name "Clear search" once search box has text', () => {
      render(<AddressSectionWrapper />)
      const searchInput = screen.getByPlaceholderText('e.g. Iasonos 12')

      fireEvent.change(searchInput, { target: { value: 'Ermou 120, Volos' } })

      const clearButton = screen.getByRole('button', { name: 'Clear search' })
      expect(clearButton).toBeInTheDocument()
    })

    it('empties the search input and hides the clear button when clicked', () => {
      render(<AddressSectionWrapper />)
      const searchInput = screen.getByPlaceholderText('e.g. Iasonos 12')

      fireEvent.change(searchInput, { target: { value: 'Dimitriados 50' } })
      const clearButton = screen.getByRole('button', { name: 'Clear search' })
      expect(clearButton).toBeInTheDocument()

      fireEvent.click(clearButton)

      expect(searchInput).toHaveValue('')
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    })

    it('AC-10: picking a search result fills the street in Greek order (name then number: "Iasonos 12")', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve([
            {
              place_id: 1234,
              display_name: 'Iasonos 12, Volos 38221, Greece',
              lat: '39.362',
              lon: '22.945',
              address: { road: 'Iasonos', house_number: '12', city: 'Volos', postcode: '38221', country_code: 'gr' },
            },
          ]),
      })

      let formMethods: any
      render(<AddressSectionWrapper onFormReady={(m) => (formMethods = m)} />)

      const searchInput = screen.getByPlaceholderText('e.g. Iasonos 12')
      fireEvent.change(searchInput, { target: { value: 'Iasonos 12' } })
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))

      const resultButton = await screen.findByText('Iasonos 12, Volos 38221, Greece')
      await act(async () => {
        fireEvent.click(resultButton)
      })

      expect(formMethods.getValues('dropoffAddress.streetAddress.0')).toBe('Iasonos 12')
      expect(formMethods.getValues('dropoffAddress.houseNumber')).toBe('')
      expect(formMethods.getValues('dropoffAddress.city')).toBe('Volos')
      expect(formMethods.getValues('dropoffAddress.zipCode')).toBe('38221')
      expect(formMethods.getValues('dropoffAddress.countryCode')).toBe('GR')
      expect(formMethods.getValues('dropoffLatitude')).toBe(39.362)
      expect(formMethods.getValues('dropoffLongitude')).toBe(22.945)
    })

    it('AC-10: "Can\'t find it? Type it" opens Street and number plus Town prefilled from defaultTown', () => {
      let formMethods: any
      render(<AddressSectionWrapper defaultTown="Volos" onFormReady={(m) => (formMethods = m)} />)

      expect(screen.queryByLabelText(/Street and number/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Town/i)).not.toBeInTheDocument()

      const typeLink = screen.getByRole('button', { name: "Can't find it? Type it" })
      act(() => {
        fireEvent.click(typeLink)
      })

      expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument()
      const townInput = screen.getByLabelText(/Town/i)
      expect(townInput).toBeInTheDocument()
      expect(townInput).toHaveValue('Volos')
      expect(formMethods.getValues('dropoffAddress.city')).toBe('Volos')
    })

    it('AC-10: search sends viewbox around pickup point and does not send bounded', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        json: () => Promise.resolve([]),
      })
      global.fetch = fetchMock

      const nearPoint = { latitude: 39.3628, longitude: 22.9435 }
      render(<AddressSectionWrapper near={nearPoint} />)

      const searchInput = screen.getByPlaceholderText('e.g. Iasonos 12')
      fireEvent.change(searchInput, { target: { value: 'Iasonos' } })
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const url = fetchMock.mock.calls[0][0] as string

      expect(url).toContain('viewbox=')
      // ~15 km box around 39.3628, 22.9435: minLon, maxLat, maxLon, minLat
      expect(url).toContain('22.76350,39.50280,23.12350,39.22280')
      expect(url).not.toContain('bounded=')
    })

    it('AC-10: search timeout displays exact message "Search did not answer. Try again, or type the address."', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout')
      timeoutError.name = 'TimeoutError'
      global.fetch = jest.fn().mockRejectedValue(timeoutError)

      render(<AddressSectionWrapper />)

      const searchInput = screen.getByPlaceholderText('e.g. Iasonos 12')
      fireEvent.change(searchInput, { target: { value: 'Timeout Street' } })
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))

      const errorText = await screen.findByText('Search did not answer. Try again, or type the address.')
      expect(errorText).toBeInTheDocument()
    })

    it('AC-10 & AC-13: street validation error displays message and automatically opens typed fields', async () => {
      function WrapperWithTrigger() {
        const methods = useForm({
          defaultValues: {
            dropoffAddress: {
              streetAddress: [''],
              houseNumber: '',
              city: '',
              state: '',
              zipCode: '',
              countryCode: '',
              formattedAddress: '',
            },
          },
        })

        return (
          <FormProvider {...methods}>
            <AddressSection control={methods.control as any} prefix="dropoff" label="Address" />
            <button
              type="button"
              onClick={() => {
                act(() => {
                  methods.setError('dropoffAddress.streetAddress.0', {
                    type: 'manual',
                    message: 'Search the address and pick a result, or type it',
                  })
                })
              }}
            >
              Trigger Error
            </button>
          </FormProvider>
        )
      }

      render(<WrapperWithTrigger />)

      // Initially typed fields are closed
      expect(screen.queryByLabelText(/Street and number/i)).not.toBeInTheDocument()

      // Trigger street error (e.g. Get price with empty street)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }))
      })

      // Shows sentence under the search box
      expect(screen.getByText('Search the address and pick a result, or type it')).toBeInTheDocument()

      // Typed fields automatically open
      expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument()
    })
  })

  describe('compact mode (compact=true, for Customers dialog)', () => {
    it('labels houseNumber as "Floor and doorbell"', () => {
      render(<AddressSectionWrapper compact={true} />)
      expect(screen.getByLabelText(/Floor and doorbell/i)).toBeInTheDocument()
    })

    it('hides State and Country inputs and the helper lines, and starts with initialQuery', () => {
      render(<AddressSectionWrapper compact={true} initialQuery="Iasonos 45, Volos" />)

      const searchInput = screen.getByPlaceholderText('Search address to auto-fill')
      expect(searchInput).toHaveValue('Iasonos 45, Volos')

      expect(screen.queryByLabelText(/State \/ Province/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Country/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Autofill uses OpenStreetMap geocoding/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Coordinates are captured automatically/i)).not.toBeInTheDocument()
    })

    it('renders search results in the page flow (relative, not absolute)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve([
            {
              place_id: 1234,
              display_name: 'Iasonos 45, Volos, GR',
              lat: '39.362',
              lon: '22.945',
              address: { road: 'Iasonos', house_number: '45', city: 'Volos' },
            },
          ]),
      })

      const { container } = render(<AddressSectionWrapper compact={true} initialQuery="Iasonos 45" />)

      fireEvent.click(screen.getByRole('button', { name: 'Search' }))

      const resultItem = await screen.findByText('Iasonos 45, Volos, GR')
      expect(resultItem).toBeInTheDocument()

      const resultsList = container.querySelector('ul')
      expect(resultsList).toHaveClass('relative')
      expect(resultsList).not.toHaveClass('absolute')
    })
  })
})
