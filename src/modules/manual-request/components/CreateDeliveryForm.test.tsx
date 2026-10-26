import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateDeliveryForm, defaultDeadlineDatetimeLocal } from './CreateDeliveryForm'
import {
  usePartnerProfileQuery,
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { PartnerProfileDto } from '../types'
import { saveCustomerAfterOrder } from '../../saved-customers/utils/saveAfterOrder'
import { useSavedCustomerSearch } from '../../saved-customers/hooks/useSavedCustomerSearch'
import { fetchRetentionMonths } from '../../../api/savedCustomersApi'
import { geocodeCoordinatesFromAddress } from '../utils/geocode'

const actualGeocode = jest.requireActual('../utils/geocode')

jest.mock('../utils/geocode', () => {
  const actual = jest.requireActual('../utils/geocode')
  return {
    __esModule: true,
    ...actual,
    geocodeCoordinatesFromAddress: jest.fn((...args) => actual.geocodeCoordinatesFromAddress(...args)),
  }
})

// Mock manualRequestApi queries and mutations
jest.mock('../../../api/manualRequestApi', () => ({
  usePartnerProfileQuery: jest.fn(),
  useCreateManualRequestQuoteMutation: jest.fn(),
  useConfirmManualRequestDeliveryMutation: jest.fn(),
}))

// Mock request page navigator hook
jest.mock('../../../hooks/useRequestPageNavigator', () => ({
  useRequestPageNavigator: jest.fn(),
}))

jest.mock('../../saved-customers/utils/saveAfterOrder', () => ({
  CUSTOMER_SAVE_FAILURES: ['clash', 'invalid', 'failed'],
  saveCustomerAfterOrder: jest.fn().mockResolvedValue('none'),
}))

jest.mock('../../saved-customers/hooks/useSavedCustomerSearch', () => ({
  useSavedCustomerSearch: jest.fn().mockReturnValue({ status: 'idle' }),
}))

jest.mock('../../saved-customers/hooks/useRetentionMonths', () => ({
  useRetentionMonths: jest.fn().mockReturnValue(12),
  retentionHelperText: (months: number | null) =>
    months === null
      ? 'Only your restaurant sees it. It is deleted after a period unused that the co-op sets.'
      : `Only your restaurant sees it. It is deleted after ${months} months unused.`,
}))

// Real fixture from opencourier-backend/scripts/seedPartnerPickupLocation.ts
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

describe('CreateDeliveryForm', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useCreateManualRequestQuoteMutation as jest.Mock).mockReturnValue([mockCreateQuote, { isLoading: false }])
    ;(useConfirmManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockConfirmDelivery, { isLoading: false }])
    ;(useRequestPageNavigator as jest.Mock).mockReturnValue(mockNavigator)
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('none')
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'idle' })
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockImplementation((...args) =>
      actualGeocode.geocodeCoordinatesFromAddress(...args),
    )
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('partner-metadata')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ savedCustomerRetentionMonths: 12 }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { lat: '39.3600', lon: '22.9400', display_name: 'Test Street 10, Volos, Thessaly, 38221, GR' },
          ]),
      })
    })
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  // Test Plan case 7: pickup-readonly container has literal restaurant name and address
  it('renders read-only pickup block containing restaurant name and formatted address', () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    render(<CreateDeliveryForm />)

    const readonlyBlock = screen.getByTestId('pickup-readonly')
    expect(readonlyBlock).toBeInTheDocument()
    expect(readonlyBlock).toHaveTextContent('Nosh')
    expect(readonlyBlock).toHaveTextContent('Ermou 120, Volos, Thessaly, 38221, GR')
  })

  // Test Plan case 8: pickup inputs are read-only / removed, no default pickup buttons
  it('ensures pickup address fields are not editable form controls and default pickup buttons are removed', () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    render(<CreateDeliveryForm />)

    // Street address form label only exists once for dropoff
    expect(screen.getAllByLabelText(/Street address/i)).toHaveLength(1)

    // Pickup business name input label does not exist
    expect(screen.queryByLabelText(/Business or building name$/i)).not.toBeInTheDocument()

    // Default pickup button from previous localStorage feature is removed
    expect(screen.queryByText(/Save pickup as default/i)).toBeNull()
  })

  // Test Plan case 9: pickupNotes, pickupReadyAt, pickupDeadlineAt remain present and editable
  it('renders pickup notes and timing inputs as editable controls', () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    render(<CreateDeliveryForm />)

    const notesInput = screen.getByLabelText(/Pickup Notes/i)
    expect(notesInput).toBeInTheDocument()
    fireEvent.change(notesInput, { target: { value: 'Call upon arrival' } })
    expect(notesInput).toHaveValue('Call upon arrival')

    const readyInputs = screen.getAllByLabelText(/Ready At \(optional\)/i)
    expect(readyInputs.length).toBeGreaterThanOrEqual(1)
  })

  // Test Plan case 10: submitting calls createQuote with mapped profile values and NO partnerId
  it('submits form with mapped pickup profile details and no partnerId key', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    mockCreateQuote.mockResolvedValue({
      id: 'quote-123',
      quoteRangeFrom: 350,
      quoteRangeTo: 350,
      currency: 'EUR',
      duration: 15,
      distance: 2.5,
      distanceUnit: 'km',
      expiresAt: null,
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })

    // Mock Nominatim geocoding fetch for dropoff address search fallback
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        { lat: '39.3600', lon: '22.9400', display_name: 'Iasonos 45, Volos, Thessaly, 38221, GR' },
      ]),
    } as any)

    render(<CreateDeliveryForm />)

    // Fill in required dropoff details
    fireEvent.change(screen.getByLabelText(/Recipient name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+306912345678' } })

    const streetInput = screen.getAllByLabelText(/Street address/i)[0]
    fireEvent.change(streetInput, { target: { value: 'Iasonos 45' } })

    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Volos' } })
    fireEvent.change(screen.getByLabelText(/State \/ Province/i), { target: { value: 'Thessaly' } })
    fireEvent.change(screen.getByLabelText(/Country/i), { target: { value: 'GR' } })

    const submitBtn = screen.getByRole('button', { name: /Get Estimate/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
    })

    // Assert argument properties value by value and verify no partnerId property exists
    const payload = mockCreateQuote.mock.calls[0][0]
    expect(payload.pickupBusinessName).toBe('Nosh')
    expect(payload.pickupAddress.streetAddress[0]).toBe('Ermou 120')
    expect(payload.pickupAddress.countryCode).toBe('GR')
    expect(payload.pickupLatitude).toBe(39.3628)
    expect(payload.pickupLongitude).toBe(22.9435)
    expect(payload).not.toHaveProperty('partnerId')
  })

  // Test Plan case 11: pickupAddress: null -> renders "ask a co-op admin", disables button, does not call createQuote
  it('disables submit button and prevents quoting when pickup address is null in profile', () => {
    const profileNoAddress: PartnerProfileDto = {
      name: 'Nosh',
      phoneNumber: '+302421012345',
      pickupAddress: null,
    }

    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: profileNoAddress,
      isLoading: false,
      error: undefined,
    })

    render(<CreateDeliveryForm />)

    expect(
      screen.getByText(/Only a co-op admin can set your restaurant's pickup details — please contact them\./i),
    ).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: /Get Estimate/i })
    expect(submitBtn).toBeDisabled()

    fireEvent.click(submitBtn)
    expect(mockCreateQuote).not.toHaveBeenCalled()
  })

  // Test Plan case 12: query error -> displays error message and prevents quoting
  it('displays profile loading error and prevents quoting when profile query fails', () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not signed in.'),
    })

    render(<CreateDeliveryForm />)

    expect(screen.getByText('Not signed in.')).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: /Get Estimate/i })
    expect(submitBtn).toBeDisabled()
    fireEvent.click(submitBtn)

    expect(mockCreateQuote).not.toHaveBeenCalled()
  })

  // T1 — renders loading state when profile is loading and disables submit button
  it('renders loading state when profile is loading and disables submit button', () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    })

    render(<CreateDeliveryForm />)

    expect(screen.getByText(/Loading your restaurant's details…/i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /Get Estimate/i })
    expect(submitBtn).toBeDisabled()
  })

  // T2 — dropoff values typed before profile load survive form.reset
  it('preserves pre-filled dropoff values when profile finishes loading and form resets', async () => {
    let setProfileState: ((val: any) => void) | undefined

    ;(usePartnerProfileQuery as jest.Mock).mockImplementation(() => {
      const [state, setState] = React.useState({
        data: undefined as PartnerProfileDto | undefined,
        isLoading: true,
        error: undefined as any,
      })
      setProfileState = setState
      return state
    })

    render(<CreateDeliveryForm />)

    const recipientInput = screen.getByLabelText(/Recipient name/i)
    fireEvent.change(recipientInput, { target: { value: 'Early Recipient' } })
    expect(recipientInput).toHaveValue('Early Recipient')

    React.act(() => {
      if (setProfileState) {
        setProfileState({
          data: fixtureProfile,
          isLoading: false,
          error: undefined,
        })
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('pickup-readonly')).toHaveTextContent('Nosh')
    })

    expect(screen.getByLabelText(/Recipient name/i)).toHaveValue('Early Recipient')
  })

  // T3 — handleConfirm calls confirmDelivery mutation and navigates to status
  it('calls confirmDelivery mutation with mapped values and navigates when confirming quote', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    mockCreateQuote.mockResolvedValue({
      id: 'quote-456',
      quoteRangeFrom: 500,
      quoteRangeTo: 500,
      currency: 'EUR',
      duration: 20,
      distance: 3.0,
      distanceUnit: 'km',
      expiresAt: null,
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })

    mockConfirmDelivery.mockResolvedValue({
      id: 'del-789',
      status: 'ACCEPTED',
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        { lat: '39.3600', lon: '22.9400', display_name: 'Iasonos 45, Volos, Thessaly, 38221, GR' },
      ]),
    } as any)

    render(<CreateDeliveryForm />)

    fireEvent.change(screen.getByLabelText(/Recipient name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+306912345678' } })

    const streetInput = screen.getAllByLabelText(/Street address/i)[0]
    fireEvent.change(streetInput, { target: { value: 'Iasonos 45' } })
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Volos' } })
    fireEvent.change(screen.getByLabelText(/State \/ Province/i), { target: { value: 'Thessaly' } })
    fireEvent.change(screen.getByLabelText(/Country/i), { target: { value: 'GR' } })

    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Delivery/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Confirm Delivery/i }))

    await waitFor(() => {
      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
    })

    const payload = mockConfirmDelivery.mock.calls[0][0]
    expect(payload.quoteId).toBe('quote-456')
    expect(payload.pickupBusinessName).toBe('Nosh')
    expect(payload.pickupAddress.streetAddress[0]).toBe('Ermou 120')
    expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-789')
  })

  // Asserting a literal like '2026-08-04T14:00' would only hold in UTC+3: assigning
  // process.env.TZ inside a test does not move the clock, because Node has already cached
  // the zone. So assert the property instead — a datetime-local string is read back as
  // LOCAL time, and must land exactly one hour ahead in whatever zone the suite runs in.
  // The old toISOString() version fails this anywhere the UTC offset is not zero.
  it('defaultDeadlineDatetimeLocal returns local wall-clock time one hour ahead, not the UTC instant', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-04T10:00:00.000Z'))
    try {
      const result = defaultDeadlineDatetimeLocal()

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      // No trailing Z, so this parses as local time — the same way the input element reads it.
      expect(new Date(result).getTime()).toBe(Date.now() + 60 * 60 * 1000)
    } finally {
      jest.useRealTimers()
    }
  })

  const sampleCustomer = {
    id: 'cust-picked-1',
    name: 'Vassilis Spanoulis',
    phone: '+306911223344',
    notes: 'Ring twice',
    addressLine1: 'Iasonos 80',
    addressLine2: 'Floor 4',
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.361,
    longitude: 22.942,
    formattedAddress: 'Iasonos 80, Volos',
    lastUsedAt: '2026-10-26T10:00:00Z',
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-26T10:00:00Z',
  }

  it('picking a saved customer fills dropoff name, phone, address with coordinates and notes, ticks the save checkbox, and Change unlinks and unticks', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })

    render(<CreateDeliveryForm />)

    // Save checkbox is off by default for a typed customer
    const tickCheckbox = screen.getByRole('checkbox', {
      name: /Save this customer for next time \(they agreed\)/i,
    })
    expect(tickCheckbox).not.toBeChecked()

    // Pick customer from picker
    const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
    fireEvent.click(customerItem)

    // Form fields are auto-filled with customer details
    expect(screen.getByLabelText(/Recipient name/i)).toHaveValue('Vassilis Spanoulis')
    expect(screen.getByLabelText(/Phone number/i)).toHaveValue('+306911223344')
    expect(screen.getAllByLabelText(/Street address/i)[0]).toHaveValue('Iasonos 80')
    expect(screen.getByLabelText(/Floor or flat/i)).toHaveValue('Floor 4')
    expect(screen.getByLabelText(/City/i)).toHaveValue('Volos')
    expect(screen.getByLabelText(/Dropoff Notes/i)).toHaveValue('Ring twice')

    // Tick turns on when a customer is picked
    expect(tickCheckbox).toBeChecked()

    // Picker now shows linked customer line with Change button
    expect(screen.getAllByText(/Saved customer:/i).length).toBeGreaterThanOrEqual(1)
    const changeBtn = screen.getByRole('button', { name: 'Change' })
    expect(changeBtn).toBeInTheDocument()

    // Clicking Change unlinks customer and unticks the checkbox, while leaving field values in place
    fireEvent.click(changeBtn)

    expect(tickCheckbox).not.toBeChecked()
    expect(screen.queryByText(/Saved customer:/i)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Saved customer' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Recipient name/i)).toHaveValue('Vassilis Spanoulis')
  })

  it('picking a customer or clicking Change while an estimate is shown clears the estimate', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    mockCreateQuote.mockResolvedValue({
      id: 'quote-active-1',
      quoteRangeFrom: 400,
      quoteRangeTo: 400,
      currency: 'EUR',
      duration: 15,
      distance: 2.0,
      distanceUnit: 'km',
      expiresAt: null,
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })

    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })

    render(<CreateDeliveryForm />)

    // Fill minimum required fields and get estimate
    fireEvent.change(screen.getByLabelText(/Recipient name/i), { target: { value: 'Original' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+306911111111' } })
    fireEvent.change(screen.getAllByLabelText(/Street address/i)[0], { target: { value: 'Ermou 10' } })
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Volos' } })
    fireEvent.change(screen.getByLabelText(/Country/i), { target: { value: 'GR' } })

    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Delivery/i })).toBeInTheDocument()
    })

    // Picking a customer clears the active quote/estimate
    const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
    fireEvent.click(customerItem)

    expect(screen.queryByRole('button', { name: /Confirm Delivery/i })).not.toBeInTheDocument()

    // Get estimate again with the picked customer
    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Delivery/i })).toBeInTheDocument()
    })

    // Clicking Change also clears the estimate
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.queryByRole('button', { name: /Confirm Delivery/i })).not.toBeInTheDocument()
  })

  it('AC-3: picking a saved customer and editing street triggers lookup and quote carries new point and new formattedAddress, while unchanged street uses picked point without lookup', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    mockCreateQuote.mockResolvedValue({
      id: 'quote-active-1',
      quoteRangeFrom: 400,
      quoteRangeTo: 400,
      currency: 'EUR',
      duration: 15,
      distance: 2.0,
      distanceUnit: 'km',
      expiresAt: null,
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })

    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })

    render(<CreateDeliveryForm />)

    // Pick customer
    const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
    fireEvent.click(customerItem)

    // Unchanged street: Get Estimate uses picked customer point and no lookup runs
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockClear()
    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))

    await waitFor(() => {
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
    })

    expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()
    const firstQuotePayload = mockCreateQuote.mock.calls[0][0]
    expect(firstQuotePayload.dropoffLatitude).toBe(sampleCustomer.latitude)
    expect(firstQuotePayload.dropoffLongitude).toBe(sampleCustomer.longitude)
    expect(firstQuotePayload.dropoffAddress.formattedAddress).toBe(sampleCustomer.formattedAddress)

    // Clear active estimate so we can edit and re-estimate
    mockCreateQuote.mockClear()
    // Lookup returns coordinates with NO displayName: quote's formattedAddress must be built from edited fields
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValueOnce({
      latitude: 39.375,
      longitude: 22.955,
    })

    // Edit street address by typing
    const streetInput = screen.getAllByLabelText(/Street address/i)[0]
    fireEvent.change(streetInput, { target: { value: 'Dimitriadis 50' } })

    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))

    await waitFor(() => {
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
    })

    expect(geocodeCoordinatesFromAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        streetAddress: ['Dimitriadis 50'],
        city: 'Volos',
      }),
    )
    const secondQuotePayload = mockCreateQuote.mock.calls[0][0]
    expect(secondQuotePayload.dropoffLatitude).toBe(39.375)
    expect(secondQuotePayload.dropoffLongitude).toBe(22.955)
    expect(secondQuotePayload.dropoffLatitude).not.toBe(sampleCustomer.latitude)
    expect(secondQuotePayload.dropoffAddress.formattedAddress).not.toBe(sampleCustomer.formattedAddress)
    expect(secondQuotePayload.dropoffAddress.formattedAddress).toBe('Floor 4 Dimitriadis 50, Volos, 38221 GR')
  })

  it('runs saveCustomerAfterOrder with formSnapshot values and passes ?customerSave only on failure', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    mockCreateQuote.mockResolvedValue({
      id: 'quote-snap-1',
      quoteRangeFrom: 350,
      quoteRangeTo: 350,
      currency: 'EUR',
      duration: 10,
      distance: 1.5,
      distanceUnit: 'km',
      expiresAt: null,
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })

    let resolveConfirm: (value: any) => void = () => {}
    mockConfirmDelivery.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve
        }),
    )

    render(<CreateDeliveryForm />)

    fireEvent.change(screen.getByLabelText(/Recipient name/i), { target: { value: 'Snapshot Name' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+306912345678' } })
    fireEvent.change(screen.getAllByLabelText(/Street address/i)[0], { target: { value: 'Iasonos 10' } })
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Volos' } })
    fireEvent.change(screen.getByLabelText(/Dropoff Notes/i), { target: { value: 'Snapshot Notes' } })
    fireEvent.change(screen.getByLabelText(/Country/i), { target: { value: 'GR' } })

    // Tick the save customer checkbox
    const tickCheckbox = screen.getByRole('checkbox', {
      name: /Save this customer for next time \(they agreed\)/i,
    })
    fireEvent.click(tickCheckbox)

    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Delivery/i })).toBeInTheDocument()
    })

    // Edit notes AFTER estimate is taken
    fireEvent.change(screen.getByLabelText(/Dropoff Notes/i), { target: { value: 'Edited After Estimate' } })

    // Simulate clash failure
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('clash')

    const confirmBtn = screen.getByRole('button', { name: /Confirm Delivery/i })
    fireEvent.click(confirmBtn)

    // Confirm button becomes disabled while confirming and saving
    expect(confirmBtn).toBeDisabled()

    // Resolve delivery confirmation
    resolveConfirm({ id: 'del-clash-1', status: 'ACCEPTED' })

    await waitFor(() => {
      expect(saveCustomerAfterOrder).toHaveBeenCalledTimes(1)
    })

    // Assert saveCustomerAfterOrder was called with the formSnapshot values, not the edited ones
    const saveCallArgs = (saveCustomerAfterOrder as jest.Mock).mock.calls[0][0]
    expect(saveCallArgs.fields.notes).toBe('Snapshot Notes')
    expect(saveCallArgs.saveTicked).toBe(true)
    expect(saveCallArgs.linkedCustomerId).toBeNull()

    // Navigator gets ?customerSave=clash
    await waitFor(() => {
      expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-clash-1', {
        query: { customerSave: 'clash' },
      })
    })
  })

  it('navigates with no second argument when customer save succeeds ("saved" outcome)', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })

    mockCreateQuote.mockResolvedValue({
      id: 'quote-success-1',
      quoteRangeFrom: 350,
      quoteRangeTo: 350,
      currency: 'EUR',
      duration: 10,
      distance: 1.5,
      distanceUnit: 'km',
      expiresAt: null,
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })

    mockConfirmDelivery.mockResolvedValue({ id: 'del-success-1', status: 'ACCEPTED' })
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('saved')

    render(<CreateDeliveryForm />)

    fireEvent.change(screen.getByLabelText(/Recipient name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+306912345678' } })
    fireEvent.change(screen.getAllByLabelText(/Street address/i)[0], { target: { value: 'Iasonos 10' } })
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Volos' } })
    fireEvent.change(screen.getByLabelText(/Country/i), { target: { value: 'GR' } })

    fireEvent.click(screen.getByRole('button', { name: /Get Estimate/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Delivery/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Confirm Delivery/i }))

    await waitFor(() => {
      expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-success-1')
    })
    expect(mockNavigator.goToManualRequestStatus.mock.calls[0]).toHaveLength(1)
  })
})
