import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SavedCustomerPicker } from './SavedCustomerPicker'
import { useSavedCustomerSearch } from '../hooks/useSavedCustomerSearch'
import type { SavedCustomer } from '../types'

jest.mock('../hooks/useSavedCustomerSearch', () => ({
  useSavedCustomerSearch: jest.fn(),
  SEARCH_PAUSE_MS: 300,
  MIN_SEARCH_LENGTH: 2,
}))

describe('SavedCustomerPicker', () => {
  const onPickMock = jest.fn()
  const onUnlinkMock = jest.fn()

  const sampleCustomers: SavedCustomer[] = [
    {
      id: 'cust-1',
      name: 'Maria Papadopoulou',
      phone: '+306912345678',
      notes: null,
      addressLine1: 'Iasonos 45',
      addressLine2: null,
      city: 'Volos',
      zipCode: null,
      latitude: 39.36,
      longitude: 22.94,
      formattedAddress: 'Iasonos 45, Volos',
      lastUsedAt: '2026-10-26T12:00:00.000Z',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
    },
    {
      id: 'cust-2',
      name: 'Kostas Kostopoulos',
      phone: '+306987654321',
      notes: null,
      addressLine1: 'Dimitriadis 12',
      addressLine2: null,
      city: 'Volos',
      zipCode: null,
      latitude: 39.35,
      longitude: 22.95,
      formattedAddress: null,
      lastUsedAt: '2026-10-25T12:00:00.000Z',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-25T12:00:00.000Z',
    },
  ]

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'idle' })
  })

  it('renders input with accessible name "Saved customer"', () => {
    render(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    // Command sets label="Saved customer", so accessible name of combobox/input is "Saved customer"
    const input = screen.getByRole('combobox', { name: 'Saved customer' })
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Type a name or phone')
  })

  it('renders linked state with "Saved customer: <name>" and Change button which calls onUnlink', () => {
    render(
      <SavedCustomerPicker
        linked={{ id: 'cust-1', name: 'Maria Papadopoulou' }}
        onPick={onPickMock}
        onUnlink={onUnlinkMock}
      />,
    )

    expect(screen.getByText(/Saved customer:/i)).toBeInTheDocument()
    expect(screen.getByText('Maria Papadopoulou')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Type a name or phone')).not.toBeInTheDocument()

    const changeButton = screen.getByRole('button', { name: 'Change' })
    fireEvent.click(changeButton)
    expect(onUnlinkMock).toHaveBeenCalledTimes(1)
  })

  it('displays loading spinner when search status is loading', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'loading' })

    render(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    expect(screen.getByRole('status', { name: 'Searching saved customers' })).toBeInTheDocument()
    expect(screen.getByText('Searching…')).toBeInTheDocument()
  })

  it('displays "No saved customer matches. Fill in the fields below." when no customers match', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [],
      total: 0,
    })

    render(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    expect(
      screen.getByText('No saved customer matches. Fill in the fields below.'),
    ).toBeInTheDocument()
  })

  it('displays "Search is not available. Fill in the fields below." when search errors', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'error' })

    render(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    expect(
      screen.getByText('Search is not available. Fill in the fields below.'),
    ).toBeInTheDocument()
  })

  it('renders up to 8 rows formatted as "name · phone · street" and clicking picks customer', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: sampleCustomers,
      total: 2,
    })

    render(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    // First customer row has formattedAddress
    expect(screen.getByText('Maria Papadopoulou')).toBeInTheDocument()
    expect(screen.getByText('· +306912345678')).toBeInTheDocument()
    expect(screen.getByText('· Iasonos 45, Volos')).toBeInTheDocument()

    // Second customer row falls back to addressLine1
    expect(screen.getByText('Kostas Kostopoulos')).toBeInTheDocument()
    expect(screen.getByText('· +306987654321')).toBeInTheDocument()
    expect(screen.getByText('· Dimitriadis 12')).toBeInTheDocument()

    // Click on Maria's item
    const firstItem = screen.getByText('Maria Papadopoulou').closest('[role="option"]')!
    fireEvent.click(firstItem)

    expect(onPickMock).toHaveBeenCalledWith(sampleCustomers[0])
  })

  it('Enter picks the first row and does not submit a surrounding form', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: sampleCustomers,
      total: 2,
    })

    const onFormSubmit = jest.fn((e) => e.preventDefault())

    render(
      <form onSubmit={onFormSubmit}>
        <SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />
      </form>,
    )

    const input = screen.getByRole('combobox', { name: 'Saved customer' })

    // Press Enter on the input
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // cmdk captures Enter and triggers onSelect for highlighted first item
    expect(onPickMock).toHaveBeenCalledWith(sampleCustomers[0])
    expect(onFormSubmit).not.toHaveBeenCalled()
  })

  it('Escape closes the search results list', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: sampleCustomers,
      total: 2,
    })

    render(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    expect(screen.getByText('Maria Papadopoulou')).toBeInTheDocument()

    const input = screen.getByRole('combobox', { name: 'Saved customer' })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    expect(screen.queryByText('Maria Papadopoulou')).not.toBeInTheDocument()
  })
})
