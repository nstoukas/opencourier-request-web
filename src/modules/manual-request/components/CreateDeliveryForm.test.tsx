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
})
