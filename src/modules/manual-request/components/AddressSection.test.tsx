import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { AddressSection } from './AddressSection'

describe('AddressSection (/src/modules/manual-request/components/AddressSection.tsx)', () => {
  function AddressSectionWrapper({
    prefix = 'dropoff',
    label = 'Dropoff Address',
    compact = false,
    initialQuery = '',
  }: {
    prefix?: 'pickup' | 'dropoff'
    label?: string
    compact?: boolean
    initialQuery?: string
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

    return (
      <FormProvider {...methods}>
        <AddressSection
          control={methods.control as any}
          prefix={prefix}
          label={label}
          compact={compact}
          initialQuery={initialQuery}
        />
      </FormProvider>
    )
  }

  it('does not render the clear button when the search input is empty', () => {
    render(<AddressSectionWrapper />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('displays the clear button with accessible name "Clear search" once search box has text', () => {
    render(<AddressSectionWrapper />)
    const searchInput = screen.getByPlaceholderText('Search address to auto-fill')

    fireEvent.change(searchInput, { target: { value: 'Ermou 120, Volos' } })

    const clearButton = screen.getByRole('button', { name: 'Clear search' })
    expect(clearButton).toBeInTheDocument()
  })

  it('empties the search input and hides the clear button when clicked', () => {
    render(<AddressSectionWrapper />)
    const searchInput = screen.getByPlaceholderText('Search address to auto-fill')

    fireEvent.change(searchInput, { target: { value: 'Dimitriados 50' } })
    const clearButton = screen.getByRole('button', { name: 'Clear search' })
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)

    expect(searchInput).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('labels the houseNumber field as "Floor or flat"', () => {
    render(<AddressSectionWrapper />)
    expect(screen.getByLabelText(/Floor or flat/i)).toBeInTheDocument()
  })

  it('compact mode hides State and Country inputs and the helper lines, and starts with initialQuery', () => {
    render(<AddressSectionWrapper compact={true} initialQuery="Iasonos 45, Volos" />)

    // Starts search box with initialQuery
    const searchInput = screen.getByPlaceholderText('Search address to auto-fill')
    expect(searchInput).toHaveValue('Iasonos 45, Volos')

    // Hides State and Country inputs
    expect(screen.queryByLabelText(/State \/ Province/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Country/i)).not.toBeInTheDocument()

    // Hides helper lines
    expect(screen.queryByText(/Autofill uses OpenStreetMap geocoding/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Coordinates are captured automatically/i)).not.toBeInTheDocument()
  })

  it('compact mode renders search results in the page flow (relative, not absolute)', async () => {
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
