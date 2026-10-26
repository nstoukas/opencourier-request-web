import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CustomersPage } from './CustomersPage'
import { listSavedCustomers, deleteSavedCustomer } from '../../../api/savedCustomersApi'
import type { SavedCustomer } from '../types'

const mockToast = jest.fn()
jest.mock('../../../admin-web-components', () => {
  const actual = jest.requireActual('../../../admin-web-components')
  return {
    ...actual,
    useToast: () => ({ toast: mockToast, toasts: [] }),
  }
})

jest.mock('../../../api/savedCustomersApi', () => ({
  listSavedCustomers: jest.fn(),
  deleteSavedCustomer: jest.fn(),
}))

// Mock CustomerDialog to cleanly test CustomersPage's state transitions on save and gone (404)
jest.mock('./CustomerDialog', () => ({
  CustomerDialog: ({ customer, onClose, onSaved, onGone }: any) => (
    <div data-testid="mock-customer-dialog">
      <span>{customer ? `Edit: ${customer.name}` : 'Add New Customer'}</span>
      <button
        type="button"
        onClick={() =>
          onSaved(
            customer
              ? { ...customer, name: `${customer.name} (Edited)` }
              : {
                  id: 'cust-new-999',
                  name: 'New Added Customer',
                  phone: '+306999999999',
                  notes: null,
                  addressLine1: 'Nikis 1',
                  addressLine2: null,
                  city: 'Volos',
                  zipCode: null,
                  latitude: 39.36,
                  longitude: 22.94,
                  formattedAddress: 'Nikis 1, Volos',
                  lastUsedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
          )
        }
      >
        Simulate Save
      </button>
      <button type="button" onClick={() => onGone(customer?.id)}>
        Simulate 404 Gone
      </button>
      <button type="button" onClick={onClose}>
        Close Dialog
      </button>
    </div>
  ),
}))

describe('CustomersPage', () => {
  const customer1: SavedCustomer = {
    id: 'cust-1',
    name: 'Giannis Antetokounmpo',
    phone: '+306911111111',
    notes: 'Doorbell A',
    addressLine1: 'Iasonos 10',
    addressLine2: null,
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Iasonos 10, Volos',
    lastUsedAt: '2026-10-26T12:00:00.000Z', // More recent
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  }

  const customer2: SavedCustomer = {
    id: 'cust-2',
    name: 'Kostas Sloukas',
    phone: '+306922222222',
    notes: null,
    addressLine1: 'Dimitriadis 20',
    addressLine2: null,
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.35,
    longitude: 22.95,
    formattedAddress: null,
    lastUsedAt: '2026-10-20T10:00:00.000Z', // Older
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  }

  const customer3: SavedCustomer = {
    id: 'cust-3',
    name: 'Nikos Galis',
    phone: '+306933333333',
    notes: null,
    addressLine1: 'Ermou 30',
    addressLine2: null,
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Ermou 30, Volos',
    lastUsedAt: '2026-10-15T10:00:00.000Z',
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
  }

  const mariaCustomer: SavedCustomer = {
    id: 'cust-maria',
    name: 'Maria Papadopoulou',
    phone: '+306944444444',
    notes: null,
    addressLine1: 'Dimitriadis 15',
    addressLine2: null,
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Dimitriadis 15, Volos',
    lastUsedAt: '2026-10-18T10:00:00.000Z',
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders loading skeletons while fetching customers', () => {
    ;(listSavedCustomers as jest.Mock).mockReturnValue(new Promise(() => {}))

    render(<CustomersPage />)

    expect(screen.getByLabelText('Loading customers')).toBeInTheDocument()
  })

  it('renders error state when fetch fails, and clicking Try again retries load', async () => {
    ;(listSavedCustomers as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<CustomersPage />)

    expect(await screen.findByText('Your saved customers could not be loaded.')).toBeInTheDocument()

    // Second call will succeed
    ;(listSavedCustomers as jest.Mock).mockResolvedValueOnce({
      items: [customer1],
      total: 1,
    })

    const tryAgainBtn = screen.getByRole('button', { name: 'Try again' })
    fireEvent.click(tryAgainBtn)

    expect(await screen.findByText('Giannis Antetokounmpo')).toBeInTheDocument()
  })

  it('renders empty state when there are no saved customers yet and not searching', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
    })

    render(<CustomersPage />)

    expect(
      await screen.findByText(/Customers you save from an order appear here\./i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add a customer/i })).toBeInTheDocument()
  })

  it('renders no match state when searching yields no results', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
    })

    render(<CustomersPage />)

    // Type in search query with >= 2 characters
    const searchInput = screen.getByRole('searchbox', { name: /Search saved customers/i })
    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } })

    // Wait for debounce (300ms)
    await waitFor(
      () => {
        expect(screen.getByText('No saved customer matches.')).toBeInTheDocument()
      },
      { timeout: 1000 },
    )
  })

  it('displays customers in order (most recently used first as returned by backend)', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [customer1, customer2],
      total: 2,
    })

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')

    const customerHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(customerHeadings[0]).toHaveTextContent('Giannis Antetokounmpo')
    expect(customerHeadings[1]).toHaveTextContent('Kostas Sloukas')
  })

  it('handles "Show more": appends next page, drops already shown ids, and updates "N of M"', async () => {
    // Page 1 returns customer1 and customer2, total 3
    ;(listSavedCustomers as jest.Mock).mockResolvedValueOnce({
      items: [customer1, customer2],
      total: 3,
    })

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')
    expect(screen.getByText('2 of 3')).toBeInTheDocument()

    const showMoreBtn = screen.getByRole('button', { name: 'Show more' })
    expect(showMoreBtn).toBeInTheDocument()

    // Page 2 returns customer2 (duplicate) and customer3
    ;(listSavedCustomers as jest.Mock).mockResolvedValueOnce({
      items: [customer2, customer3],
      total: 3,
    })

    fireEvent.click(showMoreBtn)

    await waitFor(() => {
      expect(screen.getByText('Nikos Galis')).toBeInTheDocument()
    })

    // Deduplication: customer2 should only appear once in list
    const customerHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(customerHeadings).toHaveLength(3)
    expect(customerHeadings[0]).toHaveTextContent('Giannis Antetokounmpo')
    expect(customerHeadings[1]).toHaveTextContent('Kostas Sloukas')
    expect(customerHeadings[2]).toHaveTextContent('Nikos Galis')

    expect(screen.getByText('3 of 3')).toBeInTheDocument()
    // Show more button disappears when all items are shown
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    // When the last page arrives focus moves to the count line
    await waitFor(() => {
      expect(screen.getByText('3 of 3')).toHaveFocus()
    })
  })

  it('a Show more answer that arrives after a newer search started is dropped (the new search rows only, its own total)', async () => {
    // Initial load: 1 customer of 3
    ;(listSavedCustomers as jest.Mock).mockResolvedValueOnce({
      items: [customer1],
      total: 3,
    })

    render(<CustomersPage />)
    await screen.findByText('Giannis Antetokounmpo')
    expect(screen.getByText('1 of 3')).toBeInTheDocument()

    // Setup: showMore promise is pending
    let resolveShowMore!: (value: any) => void
    const showMorePromise = new Promise((resolve) => {
      resolveShowMore = resolve
    })
    ;(listSavedCustomers as jest.Mock).mockImplementationOnce(() => showMorePromise)

    // Click Show more (requests page 2 of initial search)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))

    // Now start a new search for "Sloukas" before showMore resolves
    ;(listSavedCustomers as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        items: [customer2],
        total: 1,
      }),
    )

    const searchInput = screen.getByRole('searchbox', { name: /Search saved customers/i })
    fireEvent.change(searchInput, { target: { value: 'Sloukas' } })

    // Wait for the new search results to arrive
    await screen.findByText('Kostas Sloukas')
    expect(screen.queryByText('Giannis Antetokounmpo')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()

    // Now the old search's showMore resolves
    await act(async () => {
      resolveShowMore({
        items: [customer3],
        total: 3,
      })
      await showMorePromise
    })

    // The late showMore response must be dropped: only new search's rows and count remain
    expect(screen.queryByText('Nikos Galis')).not.toBeInTheDocument()
    expect(screen.getByText('Kostas Sloukas')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
    expect(screen.queryByText('3 of 3')).not.toBeInTheDocument()
  })

  it('Add customer reloads the first page and shows toast', async () => {
    const newCustomer: SavedCustomer = {
      ...customer1,
      id: 'cust-new-999',
      name: 'New Added Customer',
      lastUsedAt: '2026-10-26T14:00:00.000Z',
    }

    ;(listSavedCustomers as jest.Mock)
      .mockResolvedValueOnce({
        items: [customer1],
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [newCustomer, customer1],
        total: 2,
      })

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')

    // Click Add button
    const addBtn = screen.getByRole('button', { name: /^Add$/i })
    fireEvent.click(addBtn)

    expect(screen.getByTestId('mock-customer-dialog')).toHaveTextContent('Add New Customer')

    // Simulate saving new customer
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Save' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Customer saved',
        description: 'New Added Customer',
      })
    })

    expect(await screen.findByText('New Added Customer')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-customer-dialog')).not.toBeInTheDocument()
  })

  it("each Edit button's accessible name is 'Edit <that customer's name>', differs per card, and clicking opens that customer's edit dialog", async () => {
    // When two or more customers are listed, each card's Edit button must uniquely identify the customer for screen readers
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [customer1, mariaCustomer],
      total: 2,
    })

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')
    await screen.findByText('Maria Papadopoulou')

    // Each Edit button has an accessible name of 'Edit <customer name>'
    const editGiannisBtn = screen.getByRole('button', { name: 'Edit Giannis Antetokounmpo' })
    const editMariaBtn = screen.getByRole('button', { name: 'Edit Maria Papadopoulou' })

    expect(editGiannisBtn).toBeInTheDocument()
    expect(editMariaBtn).toBeInTheDocument()

    // Accessible names differ per card (no ambiguity)
    expect(editGiannisBtn).not.toBe(editMariaBtn)

    // A generic query for exact accessible name 'Edit' matches nothing
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    // Clicking an Edit button opens that specific customer's edit dialog
    fireEvent.click(editMariaBtn)
    expect(screen.getByTestId('mock-customer-dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit: Maria Papadopoulou')).toBeInTheDocument()

    // Closing dialog and clicking the other customer's Edit button opens their dialog
    fireEvent.click(screen.getByRole('button', { name: 'Close Dialog' }))
    expect(screen.queryByTestId('mock-customer-dialog')).not.toBeInTheDocument()

    fireEvent.click(editGiannisBtn)
    expect(screen.getByTestId('mock-customer-dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit: Giannis Antetokounmpo')).toBeInTheDocument()
  })

  it('Edit replaces the card in place without reordering list', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [customer1, customer2],
      total: 2,
    })

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')

    // Click Edit on second card (Kostas Sloukas) using accessible name 'Edit <name>'
    const editBtn = screen.getByRole('button', { name: 'Edit Kostas Sloukas' })
    fireEvent.click(editBtn)

    expect(screen.getByTestId('mock-customer-dialog')).toHaveTextContent('Edit: Kostas Sloukas')

    // Save edited customer
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Save' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Changes saved',
        description: 'Kostas Sloukas (Edited)',
      })
    })

    // Card replaced in place at index 1
    const customerHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(customerHeadings[0]).toHaveTextContent('Giannis Antetokounmpo')
    expect(customerHeadings[1]).toHaveTextContent('Kostas Sloukas (Edited)')
  })

  it('an Edit answered 404 removes the card with "This customer was already deleted."', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [customer1, customer2],
      total: 2,
    })

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')

    // Click Edit on first card (Giannis Antetokounmpo) using accessible name 'Edit <name>'
    const editBtn = screen.getByRole('button', { name: 'Edit Giannis Antetokounmpo' })
    fireEvent.click(editBtn)

    // Simulate 404 response in dialog
    fireEvent.click(screen.getByRole('button', { name: 'Simulate 404 Gone' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'This customer was already deleted.',
      })
    })

    // Giannis card removed, only Kostas remains
    expect(screen.queryByText('Giannis Antetokounmpo')).not.toBeInTheDocument()
    expect(screen.getByText('Kostas Sloukas')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
  })

  it('Delete asks with customer name, removes card, and lowers total count', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [customer1, customer2],
      total: 2,
    })
    ;(deleteSavedCustomer as jest.Mock).mockResolvedValue(undefined)

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')

    // Click delete on Giannis (aria-label="Delete Giannis Antetokounmpo")
    const deleteBtn = screen.getByRole('button', { name: 'Delete Giannis Antetokounmpo' })
    fireEvent.click(deleteBtn)

    // AlertDialog appears asking with customer name
    expect(screen.getByRole('heading', { name: 'Delete Giannis Antetokounmpo?' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Their saved name, phone and address are removed for good. Past orders keep their own copy.',
      ),
    ).toBeInTheDocument()

    // Confirm deletion
    const confirmDeleteBtn = screen.getByRole('button', { name: /^Delete$/i })
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(deleteSavedCustomer).toHaveBeenCalledWith('cust-1')
      expect(mockToast).toHaveBeenCalledWith({ title: 'Customer deleted' })
    })

    // Card removed and total lowered
    expect(screen.queryByText('Giannis Antetokounmpo')).not.toBeInTheDocument()
    expect(screen.getByText('Kostas Sloukas')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
  })

  it('a 404 on delete also removes the card and lowers total count', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [customer1],
      total: 1,
    })
    const error404 = Object.assign(new Error('Already deleted'), { statusCode: 404 })
    ;(deleteSavedCustomer as jest.Mock).mockRejectedValue(error404)

    render(<CustomersPage />)

    await screen.findByText('Giannis Antetokounmpo')

    const deleteBtn = screen.getByRole('button', { name: 'Delete Giannis Antetokounmpo' })
    fireEvent.click(deleteBtn)

    const confirmDeleteBtn = screen.getByRole('button', { name: /^Delete$/i })
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Customer deleted' })
    })

    expect(screen.queryByText('Giannis Antetokounmpo')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Customers you save from an order appear here\./i),
    ).toBeInTheDocument()
  })
})
