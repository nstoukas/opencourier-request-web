// Spec 0023 (AC-2): the order form's "Ready in" starts on the restaurant's usual prep time, read from the
// partner profile the form already loads (decision 21.13). Nothing is chosen until the profile answers.
import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateDeliveryForm } from './CreateDeliveryForm'
import {
  usePartnerProfileQuery,
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { PartnerProfileDto } from '../types'
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

// The seeded pickup (opencourier-backend/scripts/seedPartnerPickupLocation.ts), with a usual time.
function profileWith(usualPrepMinutes: number | null | undefined): PartnerProfileDto {
  return {
    name: 'Nosh',
    phoneNumber: '+302421012345',
    usualPrepMinutes,
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
}

const sampleCustomer = {
  id: 'cust-ready-in-1',
  name: 'Eleni Ready',
  phone: '+306955500011',
  notes: '',
  addressLine1: 'Iasonos 80',
  addressLine2: null,
  floor: '',
  doorbell: '',
  city: 'Volos',
  zipCode: '38221',
  latitude: 39.361,
  longitude: 22.942,
  formattedAddress: 'Iasonos 80, Volos',
  lastUsedAt: '2026-10-26T10:00:00Z',
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
}

// The Ready in pills in the order they are drawn.
function readyInPillLabels(): string[] {
  const group = screen.getByRole('radiogroup', { name: 'Ready in' })
  return Array.from(group.querySelectorAll('button[role="radio"]')).map((pill) => pill.textContent ?? '')
}

function checkedReadyInPills(): string[] {
  const group = screen.getByRole('radiogroup', { name: 'Ready in' })
  return Array.from(group.querySelectorAll('button[role="radio"][data-state="checked"]')).map(
    (pill) => pill.textContent ?? '',
  )
}

// A profile query the test answers by hand: loading first, then the profile.
function profileAnsweredLater() {
  let answer: ((profile: PartnerProfileDto) => void) | undefined
  ;(usePartnerProfileQuery as jest.Mock).mockImplementation(() => {
    const [state, setState] = React.useState({
      data: undefined as PartnerProfileDto | undefined,
      isLoading: true,
      error: undefined as any,
    })
    answer = (profile) => setState({ data: profile, isLoading: false, error: undefined })
    return state
  })
  return (profile: PartnerProfileDto) => {
    act(() => {
      answer?.(profile)
    })
  }
}

describe('CreateDeliveryForm Ready in (spec 0023, AC-2)', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useCreateManualRequestQuoteMutation as jest.Mock).mockReturnValue([mockCreateQuote, { isLoading: false }])
    ;(useConfirmManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockConfirmDelivery, { isLoading: false }])
    ;(useRequestPageNavigator as jest.Mock).mockReturnValue(mockNavigator)
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('none')
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'idle' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ savedCustomerRetentionMonths: 12 }),
    })
  })

  it('preselects the usual time once the profile answers, not before (Get price disabled meanwhile)', async () => {
    const answerProfile = profileAnsweredLater()

    render(<CreateDeliveryForm />)

    // Loading: the fixed pills, none chosen, and the button cannot be pressed.
    expect(readyInPillLabels()).toEqual(['Now', '10 min', '15 min', '20 min', '30 min'])
    expect(checkedReadyInPills()).toEqual([])
    expect(screen.getByRole('button', { name: 'Get price' })).toBeDisabled()

    answerProfile(profileWith(25))

    // The usual time joins the pills in order, and is the one chosen.
    await waitFor(() => {
      expect(checkedReadyInPills()).toEqual(['25 min'])
    })
    expect(readyInPillLabels()).toEqual(['Now', '10 min', '15 min', '20 min', '25 min', '30 min'])
    expect(screen.getByRole('button', { name: 'Get price' })).toBeEnabled()
  })

  it('never overrides a choice the restaurant made before the profile answered', async () => {
    const answerProfile = profileAnsweredLater()

    render(<CreateDeliveryForm />)

    fireEvent.click(screen.getByRole('radio', { name: '10 min' }))
    expect(checkedReadyInPills()).toEqual(['10 min'])

    answerProfile(profileWith(25))

    await waitFor(() => {
      expect(screen.getByTestId('pickup-readonly')).toHaveTextContent('Nosh')
    })
    // The 25 pill is offered, but the restaurant's own 10 stays chosen.
    expect(screen.getByRole('radio', { name: '25 min' })).toBeInTheDocument()
    expect(checkedReadyInPills()).toEqual(['10 min'])
  })

  it('a choice made after the preselection stays', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({ data: profileWith(25), isLoading: false, error: undefined })

    render(<CreateDeliveryForm />)

    await waitFor(() => {
      expect(checkedReadyInPills()).toEqual(['25 min'])
    })

    fireEvent.click(screen.getByRole('radio', { name: '15 min' }))

    await waitFor(() => {
      expect(checkedReadyInPills()).toEqual(['15 min'])
    })
  })

  it('a usual time of 0 preselects "Now", with no duplicate pill', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({ data: profileWith(0), isLoading: false, error: undefined })

    render(<CreateDeliveryForm />)

    await waitFor(() => {
      expect(checkedReadyInPills()).toEqual(['Now'])
    })
    expect(readyInPillLabels()).toEqual(['Now', '10 min', '15 min', '20 min', '30 min'])
  })

  it('a usual time among the fixed ones (15) preselects that pill, with no duplicate', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({ data: profileWith(15), isLoading: false, error: undefined })

    render(<CreateDeliveryForm />)

    await waitFor(() => {
      expect(checkedReadyInPills()).toEqual(['15 min'])
    })
    expect(readyInPillLabels()).toEqual(['Now', '10 min', '15 min', '20 min', '30 min'])
  })

  it('a profile with no usual time preselects nothing, and Get price is refused until a choice is made', async () => {
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: profileWith(undefined),
      isLoading: false,
      error: undefined,
    })
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'ready', items: [sampleCustomer], total: 1 })

    render(<CreateDeliveryForm />)

    expect(checkedReadyInPills()).toEqual([])
    fireEvent.click(screen.getByText('Eleni Ready').closest('[role="option"]')!)
    fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

    expect(await screen.findByText('Choose when the order is ready')).toBeInTheDocument()
    expect(mockCreateQuote).not.toHaveBeenCalled()
  })

  it('the preselected usual time (25) is sent: pickupReadyAt is now plus 25 minutes, on the quote and the order', async () => {
    jest.useFakeTimers()
    try {
      jest.setSystemTime(new Date('2026-11-03T12:00:00.000Z'))
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({ data: profileWith(25), isLoading: false, error: undefined })
      ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'ready', items: [sampleCustomer], total: 1 })
      mockCreateQuote.mockResolvedValue({
        id: 'quote-usual-25',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: null,
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })
      mockConfirmDelivery.mockResolvedValue({ id: 'del-usual-25', status: 'CREATED' })

      render(<CreateDeliveryForm />)

      // No pill is tapped: the usual time is what goes.
      fireEvent.click(screen.getByText('Eleni Ready').closest('[role="option"]')!)
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })
      expect(checkedReadyInPills()).toEqual(['25 min'])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      })

      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      expect(mockCreateQuote.mock.calls[0][0].pickupReadyAt).toBe('2026-11-03T12:25:00.000Z')

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Send order' }))
      })

      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
      expect(mockConfirmDelivery.mock.calls[0][0].pickupReadyAt).toBe('2026-11-03T12:25:00.000Z')
      expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-usual-25')
    } finally {
      jest.useRealTimers()
    }
  })
})
