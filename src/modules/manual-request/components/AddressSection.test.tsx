import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { AddressSection } from './AddressSection'

describe('AddressSection (/src/modules/manual-request/components/AddressSection.tsx)', () => {
  function AddressSectionWrapper({ prefix = 'dropoff', label = 'Dropoff Address' }: { prefix?: 'pickup' | 'dropoff'; label?: string }) {
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
        <AddressSection control={methods.control as any} prefix={prefix} label={label} />
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
})
