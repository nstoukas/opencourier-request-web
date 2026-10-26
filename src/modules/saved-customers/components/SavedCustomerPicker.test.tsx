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

    expect(screen.getAllByText(/Saved customer:/i).length).toBeGreaterThanOrEqual(1)
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
    expect(screen.getByText('Searching saved customers…')).toBeInTheDocument()
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

  it('announces pick with status line and focuses Change button; announces clear and returns focus to search input', () => {
    const { rerender } = render(
      <SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />,
    )

    // Initially unlinked, combobox exists
    const input = screen.getByRole('combobox', { name: 'Saved customer' })
    expect(input).toBeInTheDocument()

    // Pick a customer: rerender with linked
    rerender(
      <SavedCustomerPicker
        linked={{ id: 'cust-1', name: 'Maria Papadopoulou' }}
        onPick={onPickMock}
        onUnlink={onUnlinkMock}
      />,
    )

    // Status line announces pick
    const statusElements = screen.getAllByRole('status')
    const srAnnouncement = statusElements.find((el) =>
      el.textContent?.includes('Saved customer: Maria Papadopoulou. The drop off fields are filled in.'),
    )
    expect(srAnnouncement).toBeInTheDocument()

    // Focus is on Change button
    const changeBtn = screen.getByRole('button', { name: 'Change' })
    expect(changeBtn).toHaveFocus()

    // Clear link: rerender with null
    rerender(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)

    // Status line announces clear
    expect(
      screen.getByText('Saved customer cleared. The fields keep what they hold.'),
    ).toBeInTheDocument()

    // Focus is back on the search input
    const inputAfter = screen.getByRole('combobox', { name: 'Saved customer' })
    expect(inputAfter).toHaveFocus()
  })

  it('searching, no match, and error messages are in a role=status element outside the listbox', () => {
    // 1. Loading state
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'loading' })
    const { rerender } = render(
      <SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />,
    )
    const loadingStatus = screen.getByText('Searching saved customers…').closest('[role="status"]')
    expect(loadingStatus).toBeInTheDocument()
    expect(loadingStatus?.closest('[role="listbox"]')).toBeNull()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    // 2. No match state
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [],
      total: 0,
    })
    rerender(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)
    const noMatchStatus = screen
      .getByText('No saved customer matches. Fill in the fields below.')
      .closest('[role="status"]')
    expect(noMatchStatus).toBeInTheDocument()
    expect(noMatchStatus?.closest('[role="listbox"]')).toBeNull()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    // 3. Error state
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'error' })
    rerender(<SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />)
    const errorStatus = screen
      .getByText('Search is not available. Fill in the fields below.')
      .closest('[role="status"]')
    expect(errorStatus).toBeInTheDocument()
    expect(errorStatus?.closest('[role="listbox"]')).toBeNull()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('focus leaving the picker closes the list, while clicking a row still picks it', () => {
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: sampleCustomers,
      total: 2,
    })

    render(
      <div>
        <SavedCustomerPicker linked={null} onPick={onPickMock} onUnlink={onUnlinkMock} />
        <button type="button" data-testid="outside-button">
          Outside
        </button>
      </div>,
    )

    // Results list is visible
    expect(screen.getByText('Maria Papadopoulou')).toBeInTheDocument()

    // Blur from the combobox to an element outside the Command container
    const input = screen.getByRole('combobox', { name: 'Saved customer' })
    const outsideBtn = screen.getByTestId('outside-button')

    fireEvent.blur(input, { relatedTarget: outsideBtn })

    // List is closed
    expect(screen.queryByText('Maria Papadopoulou')).not.toBeInTheDocument()

    // Type in input to re-open
    fireEvent.change(input, { target: { value: 'Kostas' } })
    expect(screen.getByText('Maria Papadopoulou')).toBeInTheDocument()

    // Blurring the input with relatedTarget set to an element inside the picker (a row) keeps the list shown
    const row = screen.getByText('Maria Papadopoulou').closest('[role="option"]')!
    fireEvent.blur(input, { relatedTarget: row })
    expect(screen.getByText('Maria Papadopoulou')).toBeInTheDocument()

    // Clicking a row still picks it
    fireEvent.click(row)
    expect(onPickMock).toHaveBeenCalledWith(sampleCustomers[0])
  })
})
