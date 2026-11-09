// Spec 0029 (AC-8): CreateDeliveryForm integration with partner availability.
// While acceptingOrders is false, the order form's button is disabled and sends no price.
// While busy mode is on, the form shows "Busy mode adds X min to this order".
import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { CreateDeliveryForm } from './CreateDeliveryForm'
import {
  usePartnerProfileQuery,
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { PartnerAvailability, PartnerProfileDto } from '../types'
import { saveCustomerAfterOrder } from '../../saved-customers/utils/saveAfterOrder'
import { useSavedCustomerSearch } from '../../saved-customers/hooks/useSavedCustomerSearch'

// react-leaflet is ESM only; the form's map is not under test here.
jest.mock('./PinMapCanvas', () => ({
  PinMapCanvas: () => <div data-testid="mock-pin-map-canvas" />,
}))

jest.mock('../../../api/manualRequestApi', () => ({
  usePartnerProfileQuery: jest.fn(),
  useCreateManualRequestQuoteMutation: jest.fn(),
  useConfirmManualRequestDeliveryMutation: jest.fn(),
}))

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
  retentionHelperText: () => 'Only your restaurant sees it.',
}))

const seededProfile: PartnerProfileDto = {
  name: 'Nosh',
  phoneNumber: '+302421012345',
  usualPrepMinutes: 15,
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

// Saved customer fixture with valid coordinates so the pin is confirmed without opening map.
const sampleCustomer = {
  id: 'cust-picked-1',
  name: 'Vassilis Spanoulis',
  phone: '+306911223344',
  notes: 'Ring twice',
  addressLine1: 'Iasonos 80',
  addressLine2: null,
  floor: '4',
  doorbell: 'Spanoulis',
  city: 'Volos',
  zipCode: '38221',
  latitude: 39.361,
  longitude: 22.942,
  formattedAddress: 'Iasonos 80, Volos',
  lastUsedAt: '2026-10-26T10:00:00Z',
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
}

// Selects customer, prep time, and total so the form is valid and ready to ask for a price.
function fillValidOrderForm() {
  const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
  fireEvent.click(customerItem)
  fireEvent.click(screen.getByRole('radio', { name: '15 min' }))
  fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '12,50' } })
}

describe('CreateDeliveryForm availability integration (spec 0029, AC-8)', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: seededProfile,
      isLoading: false,
      error: undefined,
    })
    ;(useCreateManualRequestQuoteMutation as jest.Mock).mockReturnValue([mockCreateQuote, { isLoading: false }])
    ;(useConfirmManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockConfirmDelivery, { isLoading: false }])
    ;(useRequestPageNavigator as jest.Mock).mockReturnValue(mockNavigator)
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('none')
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'idle' })
    mockCreateQuote.mockResolvedValue({
      id: 'quote-test-1',
      quoteRangeFrom: 400,
      quoteRangeTo: 400,
      currency: 'EUR',
      duration: 15,
      distance: 2.2,
      distanceUnit: 'km',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      dropoffEta: null,
      createdAt: new Date().toISOString(),
    })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ savedCustomerRetentionMonths: 12 }),
    })
  })

  it('disables Get price button and sends no price while acceptingOrders is false', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    }

    render(<CreateDeliveryForm availability={availability} />)

    const button = screen.getByRole('button', { name: 'Get price' })
    expect(button).toBeDisabled()

    // Clicking a disabled button must not trigger quote creation
    fireEvent.click(button)
    expect(mockCreateQuote).not.toHaveBeenCalled()
  })

  it('disables button when restaurant is disabled outright (acceptingOrders: false)', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: null,
      disabledAt: '2026-11-09T10:00:00.000Z',
      disabledReason: 'Health inspection pending',
      acceptingOrders: false,
      notAcceptingReason: 'The co-op has disabled this restaurant: Health inspection pending',
    }

    render(<CreateDeliveryForm availability={availability} />)

    const button = screen.getByRole('button', { name: 'Get price' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mockCreateQuote).not.toHaveBeenCalled()
  })

  it('enables Get price button when acceptingOrders is true', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: null,
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: true,
      notAcceptingReason: null,
    }

    render(<CreateDeliveryForm availability={availability} />)

    expect(screen.getByRole('button', { name: 'Get price' })).toBeEnabled()
  })

  it('enables Get price button when availability is omitted (backward compatibility)', () => {
    render(<CreateDeliveryForm />)

    expect(screen.getByRole('button', { name: 'Get price' })).toBeEnabled()
  })

  it('shows "Busy mode adds 15 min to this order" when busyExtraMinutes is 15', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: 15,
      pausedUntil: null,
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: true,
      notAcceptingReason: null,
    }

    render(<CreateDeliveryForm availability={availability} />)

    expect(screen.getByText('Busy mode adds 15 min to this order')).toBeInTheDocument()
  })

  it('shows busy line with custom extra minutes (+20)', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: 20,
      pausedUntil: null,
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: true,
      notAcceptingReason: null,
    }

    render(<CreateDeliveryForm availability={availability} />)

    expect(screen.getByText('Busy mode adds 20 min to this order')).toBeInTheDocument()
  })

  it('does not show busy line when busyExtraMinutes is null', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: null,
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: true,
      notAcceptingReason: null,
    }

    render(<CreateDeliveryForm availability={availability} />)

    expect(screen.queryByText(/Busy mode adds/)).not.toBeInTheDocument()
  })

  it('does not show busy line when availability is undefined', () => {
    render(<CreateDeliveryForm availability={undefined} />)

    expect(screen.queryByText(/Busy mode adds/)).not.toBeInTheDocument()
  })

  it('asking for a price while paused (form submit via Enter) calls no quote and shows notAcceptingReason in bar', async () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    }

    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })

    render(<CreateDeliveryForm availability={availability} />)
    fillValidOrderForm()

    // Submitting the form (as Enter in an input field does) with the button disabled
    const form = screen.getByLabelText(/Order total/i).closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    // Calling priceOrder while acceptingOrders is false must call no quote and show server reason in bar
    expect(mockCreateQuote).not.toHaveBeenCalled()
    expect(await screen.findByText('Ordering is paused until 14:30.')).toBeInTheDocument()
  })

  it('asking for a price while disabled (form submit via Enter) calls no quote and shows notAcceptingReason in bar', async () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: null,
      disabledAt: '2026-11-09T10:00:00.000Z',
      disabledReason: 'Health inspection pending',
      acceptingOrders: false,
      notAcceptingReason: 'The co-op has disabled this restaurant: Health inspection pending',
    }

    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })

    render(<CreateDeliveryForm availability={availability} />)
    fillValidOrderForm()

    const form = screen.getByLabelText(/Order total/i).closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockCreateQuote).not.toHaveBeenCalled()
    expect(
      await screen.findByText('The co-op has disabled this restaurant: Health inspection pending'),
    ).toBeInTheDocument()
  })

  it('asking for a price while acceptingOrders is false without reason shows fallback message in bar', async () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: null,
      pausedUntil: null,
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: false,
      notAcceptingReason: null,
    }

    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })

    render(<CreateDeliveryForm availability={availability} />)
    fillValidOrderForm()

    const form = screen.getByLabelText(/Order total/i).closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockCreateQuote).not.toHaveBeenCalled()
    expect(
      await screen.findByText('This restaurant cannot place orders right now.'),
    ).toBeInTheDocument()
  })

  it('does not show busy line when paused (acceptingOrders: false) even with busyExtraMinutes set', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: 15,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      disabledAt: null,
      disabledReason: null,
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    }

    render(<CreateDeliveryForm availability={availability} />)

    expect(screen.queryByText(/Busy mode adds/)).not.toBeInTheDocument()
  })

  it('does not show busy line when disabled (acceptingOrders: false) even with busyExtraMinutes set', () => {
    const availability: PartnerAvailability = {
      busyExtraMinutes: 20,
      pausedUntil: null,
      disabledAt: '2026-11-09T10:00:00.000Z',
      disabledReason: 'Co-op decision',
      acceptingOrders: false,
      notAcceptingReason: 'The co-op has disabled this restaurant: Co-op decision',
    }

    render(<CreateDeliveryForm availability={availability} />)

    expect(screen.queryByText(/Busy mode adds/)).not.toBeInTheDocument()
  })
})
