import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CreateDeliveryForm } from './CreateDeliveryForm'
import {
  usePartnerProfileQuery,
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { ManualRequestPackageSize, PartnerProfileDto } from '../types'
import { saveCustomerAfterOrder } from '../../saved-customers/utils/saveAfterOrder'
import { useSavedCustomerSearch } from '../../saved-customers/hooks/useSavedCustomerSearch'
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

describe('CreateDeliveryForm (spec 0006)', () => {
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
            { lat: '39.3600', lon: '22.9400', display_name: 'Iasonos 45, Volos, Thessaly, 38221, GR' },
          ]),
      })
    })
  })

  // ── Profile states & AC-5: Removed fields ──────────────────────────────────
  describe('Profile and removed fields (AC-5)', () => {
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

    it('AC-5: does not render state, zip, country, building name, package type, notes or deadlines', () => {
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: fixtureProfile,
        isLoading: false,
        error: undefined,
      })

      render(<CreateDeliveryForm />)

      // AC-5 removed fields must not be present in document
      expect(screen.queryByLabelText(/State \/ Province/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/ZIP/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Country/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Business or building name/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Package type/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Package description/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Special instructions/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Pickup notes/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Pickup deadline/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Dropoff ready/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Dropoff deadline/i)).not.toBeInTheDocument()
    })

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
        screen.getByText(/Only a co-op admin can set your restaurant's pickup details/i),
      ).toBeInTheDocument()

      const submitBtn = screen.getByRole('button', { name: 'Get price' })
      expect(submitBtn).toBeDisabled()

      fireEvent.click(submitBtn)
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('displays profile loading error and prevents quoting when profile query fails', () => {
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Not signed in.'),
      })

      render(<CreateDeliveryForm />)

      expect(screen.getByText('Not signed in.')).toBeInTheDocument()

      const submitBtn = screen.getByRole('button', { name: 'Get price' })
      expect(submitBtn).toBeDisabled()
      fireEvent.click(submitBtn)

      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('renders loading state when profile is loading and disables submit button', () => {
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: undefined,
      })

      render(<CreateDeliveryForm />)

      expect(screen.getByText(/Loading your restaurant's details…/i)).toBeInTheDocument()
      const submitBtn = screen.getByRole('button', { name: 'Get price' })
      expect(submitBtn).toBeDisabled()
    })

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

      const recipientInput = screen.getByLabelText(/Customer name/i)
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

      expect(screen.getByLabelText(/Customer name/i)).toHaveValue('Early Recipient')
    })
  })

  // ── AC-1, AC-4, AC-6, AC-7, AC-8: Repeat order happy path & payloads ───────
  describe('Happy path & payload mapping (AC-1, AC-4, AC-6, AC-7, AC-8)', () => {
    it('AC-1: repeat order with saved customer, ready in pill, total, Get price, Send order', async () => {
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

      const quoteDto = {
        id: 'quote-repeat-1',
        quoteRangeFrom: 400,
        quoteRangeTo: 400,
        currency: 'EUR',
        duration: 15,
        distance: 2.2,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      }
      mockCreateQuote.mockResolvedValue(quoteDto)
      mockConfirmDelivery.mockResolvedValue({ id: 'del-repeat-1', status: 'ACCEPTED' })

      render(<CreateDeliveryForm />)

      // 1. Pick customer from picker
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      // Picked customer card renders; picker draws only its status line
      expect(screen.getByText('Vassilis Spanoulis')).toBeInTheDocument()
      expect(screen.getByText('Iasonos 80, Volos')).toBeInTheDocument()
      expect(screen.getByText('Floor 4')).toBeInTheDocument()

      // Small is preselected (AC-7)
      const smallPill = screen.getByRole('radio', { name: 'Small' })
      expect(smallPill).toHaveAttribute('data-state', 'checked')

      // 2. Tap Ready in "15 min" pill (AC-6)
      const pill15 = screen.getByRole('radio', { name: '15 min' })
      fireEvent.click(pill15)
      expect(pill15).toHaveAttribute('data-state', 'checked')

      // 3. Type total "12,50" (AC-4)
      const totalInput = screen.getByLabelText(/Order total/i)
      fireEvent.change(totalInput, { target: { value: '12,50' } })

      // 4. Tap "Get price"
      const getPriceBtn = screen.getByRole('button', { name: 'Get price' })
      fireEvent.click(getPriceBtn)

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.orderTotalValue).toBe(1250) // AC-4 (whole cents)
      expect(quotePayload.pickupDeadlineAt).toBeNull() // AC-6
      expect(quotePayload.dropoffReadyAt).toBeNull() // AC-6
      expect(quotePayload.dropoffDeadlineAt).toBeNull() // AC-6
      expect(quotePayload.dropoffAddress.houseNumber).toBe('') // AC-8 Key invariants
      expect(quotePayload.packageSize).toBe(ManualRequestPackageSize.SMALL) // AC-7
      // Composed 2-line text in both notes (AC-8)
      expect(quotePayload.dropoffSellerNotes).toBe('Floor and doorbell: Floor 4\nRing twice')
      expect(quotePayload.dropoffNotes).toBe('Floor and doorbell: Floor 4\nRing twice')

      const pickupReadyAt = quotePayload.pickupReadyAt
      expect(typeof pickupReadyAt).toBe('string')
      expect(pickupReadyAt).not.toBe('')

      // 5. Tap "Send order"
      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
      })

      const deliveryPayload = mockConfirmDelivery.mock.calls[0][0]
      expect(deliveryPayload.quoteId).toBe('quote-repeat-1')
      // Delivery reuses the exact same pickupReadyAt as the quote (AC-6)
      expect(deliveryPayload.pickupReadyAt).toBe(pickupReadyAt)
      expect(deliveryPayload.orderTotalValue).toBe(1250) // AC-4 (whole cents)
      expect(deliveryPayload.pickupDeadlineAt).toBeNull() // AC-6
      expect(deliveryPayload.dropoffReadyAt).toBeNull() // AC-6
      expect(deliveryPayload.dropoffDeadlineAt).toBeNull() // AC-6
      expect(deliveryPayload.dropoffAddress.houseNumber).toBe('') // AC-8
      expect(deliveryPayload.dropoffSellerNotes).toBe('Floor and doorbell: Floor 4\nRing twice') // AC-8
      expect(deliveryPayload.dropoffNotes).toBe('Floor and doorbell: Floor 4\nRing twice')
      expect(deliveryPayload.packageSize).toBe(ManualRequestPackageSize.SMALL) // AC-7

      // Customer save ran with individual fields, never composed note (AC-9)
      expect(saveCustomerAfterOrder).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          name: 'Vassilis Spanoulis',
          phone: '+306911223344',
          addressLine2: 'Floor 4',
          notes: 'Ring twice',
        }),
        linkedCustomerId: 'cust-picked-1',
        saveTicked: true,
      })
      const savedNotes = (saveCustomerAfterOrder as jest.Mock).mock.calls[0][0].fields.notes
      expect(savedNotes).not.toContain('Floor and doorbell:')

      expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-repeat-1')
    })

    it('AC-4: "0,29" typed sends orderTotalValue 29 on both the quote and the delivery', async () => {
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

      mockCreateQuote.mockResolvedValue({
        id: 'quote-cents-29',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })
      mockConfirmDelivery.mockResolvedValue({ id: 'del-cents-29', status: 'ACCEPTED' })

      render(<CreateDeliveryForm />)

      // Pick saved customer
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      // Choose ready in "Now"
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))

      // Type total "0,29"
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '0,29' } })

      // Tap "Get price"
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.orderTotalValue).toBe(29)

      // Tap "Send order"
      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
      })

      const deliveryPayload = mockConfirmDelivery.mock.calls[0][0]
      expect(deliveryPayload.orderTotalValue).toBe(29)
    })

    it('AC-6: chosen minutes reach pickupReadyAt (Get price moment plus chosen minutes)', async () => {
      jest.useFakeTimers()
      try {
        const fixedNow = new Date('2026-10-27T10:00:00.000Z')
        jest.setSystemTime(fixedNow)

        ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
          data: fixtureProfile,
          isLoading: false,
          error: undefined,
        })

        mockCreateQuote.mockResolvedValue({
          id: 'quote-ac6-minutes',
          quoteRangeFrom: 350,
          quoteRangeTo: 350,
          currency: 'EUR',
          duration: 15,
          distance: 2.0,
          distanceUnit: 'km',
          expiresAt: null,
          dropoffEta: null,
          createdAt: fixedNow.toISOString(),
        })

        render(<CreateDeliveryForm />)

        fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
        fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
        fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
        // Choose "15 min"
        fireEvent.click(screen.getByRole('radio', { name: '15 min' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
        const quotePayload = mockCreateQuote.mock.calls[0][0]
        const expectedReadyAt = new Date(fixedNow.getTime() + 15 * 60_000).toISOString()
        expect(quotePayload.pickupReadyAt).toBe(expectedReadyAt)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  // ── Validation and limits (AC-4, AC-6, AC-8, AC-10, AC-13) ─────────────────
  describe('Validation & Rules (AC-4, AC-6, AC-8, AC-10, AC-13)', () => {
    beforeEach(() => {
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: fixtureProfile,
        isLoading: false,
        error: undefined,
      })
    })

    it('AC-6: Get price with no Ready in pill chosen is refused with exact message', async () => {
      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Nikos' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '10' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText('Choose when the order is ready')).toBeInTheDocument()
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('AC-4: Order total validations (empty, invalid pattern, over 1000)', async () => {
      render(<CreateDeliveryForm />)

      const totalInput = screen.getByLabelText(/Order total/i)
      const getPriceBtn = screen.getByRole('button', { name: 'Get price' })

      // 1. Empty / whitespace
      fireEvent.change(totalInput, { target: { value: '   ' } })
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('Enter the order total (0 if it is free)')).toBeInTheDocument()

      // 2. Invalid patterns (.5, 12., €12, -3)
      fireEvent.change(totalInput, { target: { value: '.5' } })
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('Use an amount like 12,50')).toBeInTheDocument()

      fireEvent.change(totalInput, { target: { value: '12.' } })
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('Use an amount like 12,50')).toBeInTheDocument()

      fireEvent.change(totalInput, { target: { value: '€12' } })
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('Use an amount like 12,50')).toBeInTheDocument()

      // 3. Over 1000
      fireEvent.change(totalInput, { target: { value: '1000,01' } })
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('That is over 1000 €, check the amount')).toBeInTheDocument()
    })

    it('AC-8: counter appears at 80% and Get price is refused over limit with exact sentence', async () => {
      render(<CreateDeliveryForm />)

      const floorInput = screen.getByLabelText(/Floor and doorbell/i)
      const noteInput = screen.getByLabelText(/Note for the rider/i)
      const getPriceBtn = screen.getByRole('button', { name: 'Get price' })

      // 47 chars for floor: no counter
      fireEvent.change(floorInput, { target: { value: 'a'.repeat(47) } })
      expect(screen.queryByText(/47 \/ 60/)).not.toBeInTheDocument()

      // 48 chars (80% of 60): counter appears
      fireEvent.change(floorInput, { target: { value: 'a'.repeat(48) } })
      expect(screen.getByText('48 / 60')).toBeInTheDocument()

      // 61 chars (over 60): counter turns destructive, Get price refused
      fireEvent.change(floorInput, { target: { value: 'a'.repeat(61) } })
      expect(screen.getByText('61 / 60')).toHaveClass('text-destructive')
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('Keep this to 60 characters')).toBeInTheDocument()

      // 199 chars for note: no counter
      fireEvent.change(noteInput, { target: { value: 'b'.repeat(199) } })
      expect(screen.queryByText(/199 \/ 250/)).not.toBeInTheDocument()

      // 200 chars (80% of 250): counter appears
      fireEvent.change(noteInput, { target: { value: 'b'.repeat(200) } })
      expect(screen.getByText('200 / 250')).toBeInTheDocument()

      // 251 chars (over 250): counter turns destructive, Get price refused
      fireEvent.change(noteInput, { target: { value: 'b'.repeat(251) } })
      expect(screen.getByText('251 / 250')).toHaveClass('text-destructive')
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText('Keep this to 250 characters')).toBeInTheDocument()
    })

    it('AC-8: picked customer with stored note > 250 chars shows it whole with red counter', () => {
      const longNoteCustomer = {
        ...sampleCustomer,
        notes: 'c'.repeat(255),
      }
      ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
        status: 'ready',
        items: [longNoteCustomer],
        total: 1,
      })

      render(<CreateDeliveryForm />)

      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      const noteTextarea = screen.getByLabelText(/Note for the rider/i)
      expect(noteTextarea).toHaveValue('c'.repeat(255))
      const counter = screen.getByText('255 / 250')
      expect(counter).toBeInTheDocument()
      expect(counter).toHaveClass('text-destructive')
    })

    it('AC-10 & AC-13: Get price with no street shows sentence under search box and opens typed fields', async () => {
      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Nikos' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      // Street is empty
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(
        await screen.findByText('Search the address and pick a result, or type it'),
      ).toBeInTheDocument()
      // Typed fields opened
      expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Town/i)).toBeInTheDocument()
    })

    it('AC-13: first invalid field gets scrollIntoView({ block: "center" }) and focus', async () => {
      const scrollIntoViewMock = jest.fn()
      Element.prototype.scrollIntoView = scrollIntoViewMock

      render(<CreateDeliveryForm />)

      // Submit completely empty form
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        // First invalid field is Customer name (dropoffName)
        const nameInput = screen.getByLabelText(/Customer name/i)
        expect(document.activeElement).toBe(nameInput)
      })

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'center' })
    })

    it('AC-10: typed address is looked up near the restaurant pickup point', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-ac10-near',
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

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.change(screen.getByLabelText(/Town/i), { target: { value: 'Volos' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      ;(geocodeCoordinatesFromAddress as jest.Mock).mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          streetAddress: ['Iasonos 10'],
          city: 'Volos',
        }),
        {
          latitude: fixtureProfile.pickupAddress!.latitude,
          longitude: fixtureProfile.pickupAddress!.longitude,
        },
      )
    })
  })

  // ── AC-11, AC-15: PickedCustomerCard, Edit, Change ─────────────────────────
  describe('Customer linking & PickedCustomerCard (AC-11, AC-15)', () => {
    beforeEach(() => {
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
    })

    it('AC-11: picking customer focuses Change button, Edit opens fields still linked, Change unlinks and unticks', () => {
      render(<CreateDeliveryForm />)

      const tickCheckbox = screen.getByRole('checkbox', {
        name: /Save this customer for next time \(they agreed\)/i,
      })
      expect(tickCheckbox).not.toBeChecked()

      // Pick customer
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      // Card is shown, Change button receives focus
      const changeBtn = screen.getByRole('button', { name: 'Change' })
      expect(changeBtn).toBeInTheDocument()
      expect(document.activeElement).toBe(changeBtn)
      expect(tickCheckbox).toBeChecked()

      // Click Edit: fields open below card, still linked
      const editBtn = screen.getByRole('button', { name: 'Edit' })
      fireEvent.click(editBtn)

      expect(screen.getByText('Saved customer. Edit the details below.')).toBeInTheDocument()
      expect(screen.getByLabelText(/Customer name/i)).toHaveValue('Vassilis Spanoulis')
      expect(screen.getByLabelText(/Phone/i)).toHaveValue('+306911223344')
      expect(screen.getByLabelText(/Floor and doorbell/i)).toHaveValue('Floor 4')

      // Click Change: unlinks, fields keep values, tick goes off
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      expect(tickCheckbox).not.toBeChecked()
      expect(screen.queryByText('Saved customer. Edit the details below.')).not.toBeInTheDocument()
      expect(screen.getByLabelText(/Customer name/i)).toHaveValue('Vassilis Spanoulis')
    })

    it('AC-11: Change keeps the address visible in the address search box and fresh form starts empty', () => {
      render(<CreateDeliveryForm />)

      // On a fresh form, the search input is empty
      const freshSearchInput = screen.getByPlaceholderText('e.g. Iasonos 12')
      expect(freshSearchInput).toHaveValue('')

      // Pick saved customer
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      // Card is shown, search box is hidden
      expect(screen.getByText('Vassilis Spanoulis')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('e.g. Iasonos 12')).not.toBeInTheDocument()

      // Tap Change
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      // Address search box remounts with customer's formattedAddress (not empty)
      const searchBoxAfterChange = screen.getByPlaceholderText('e.g. Iasonos 12')
      expect(searchBoxAfterChange).toHaveValue(sampleCustomer.formattedAddress)
    })

    it('row 26 (spec 0005 AC-3, spec 0006 AC-11/AC-15): picked customer stored point is used without lookup', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-stored-point',
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

      render(<CreateDeliveryForm />)

      // Pick customer
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      // Choose ready in and order total
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      ;(geocodeCoordinatesFromAddress as jest.Mock).mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      // Stored point fits: no geocode lookup is performed
      expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.dropoffLatitude).toBe(sampleCustomer.latitude)
      expect(quotePayload.dropoffLongitude).toBe(sampleCustomer.longitude)
      expect(quotePayload.dropoffAddress.formattedAddress).toBe(sampleCustomer.formattedAddress)
    })

    it('AC-3: picking a saved customer and editing street triggers lookup and quote carries new point and new formattedAddress', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-edited-street',
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

      ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValueOnce({
        latitude: 39.375,
        longitude: 22.955,
        displayName: 'Dimitriadis 50, Volos, Thessaly, 38221, GR',
      })

      render(<CreateDeliveryForm />)

      // 1. Pick customer
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      // 2. Click Edit to open customer fields
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      // 3. Open typed address fields and edit street
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Dimitriadis 50' } })

      // 4. Fill required order fields
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      ;(geocodeCoordinatesFromAddress as jest.Mock).mockClear()

      // 5. Get price
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      // Lookup runs because street was edited
      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          streetAddress: ['Dimitriadis 50'],
        }),
        expect.any(Object),
      )

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.dropoffLatitude).toBe(39.375)
      expect(quotePayload.dropoffLongitude).toBe(22.955)
      expect(quotePayload.dropoffAddress.formattedAddress).toBe('Dimitriadis 50, Volos, Thessaly, 38221, GR')
    })
  })

  // ── AC-12: PriceSendBar state transitions ──────────────────────────────────
  describe('Price & Send state transitions (AC-12, AC-13)', () => {
    beforeEach(() => {
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: fixtureProfile,
        isLoading: false,
        error: undefined,
      })
    })

    it('AC-12: form change after a price drops it back to "Get price", but save tick does not', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-trans-1',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      // Get price
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Toggling save tick does NOT drop the price
      const tickCheckbox = screen.getByRole('checkbox', {
        name: /Save this customer for next time \(they agreed\)/i,
      })
      fireEvent.click(tickCheckbox)
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Changing a form value (order total) drops the price back to "Get price"
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '20' } })
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
    })

    it('AC-12: expired price shows "This price has expired" and "Get a new price"', async () => {
      jest.useFakeTimers()
      try {
        const baseTime = Date.now()
        mockCreateQuote.mockResolvedValue({
          id: 'quote-exp-1',
          quoteRangeFrom: 350,
          quoteRangeTo: 350,
          currency: 'EUR',
          duration: 15,
          distance: 2.0,
          distanceUnit: 'km',
          expiresAt: new Date(baseTime + 30_000).toISOString(), // expires in 30s
          dropoffEta: null,
          createdAt: new Date(baseTime).toISOString(),
        })

        render(<CreateDeliveryForm />)

        fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
        fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
        fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
        fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        // Advance fake timer past 30s and through the 15s check interval
        act(() => {
          jest.advanceTimersByTime(35_000)
        })

        expect(screen.getByText('This price has expired')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Get a new price' })).toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })

    it('AC-12: quote with no expiresAt shows no "valid until" and does not expire', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-no-exp',
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

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()
      expect(screen.queryByText(/Valid until/i)).not.toBeInTheDocument()
    })

    it('AC-12: send failure on quote goes to expired, any other send failure keeps "Send order"', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-fail-test',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // 1. Generic server failure (e.g. 500): keeps price and Send order, shows error
      mockConfirmDelivery.mockRejectedValueOnce(new Error('Network connection dropped'))
      fireEvent.click(screen.getByRole('button', { name: 'Send order' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network connection dropped')
      })
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // 2. Quote failure (QUOTE_HAS_EXPIRED): goes to expired
      const quoteExpiredError = new Error('Quote has expired')
      ;(quoteExpiredError as any).code = 'QUOTE_HAS_EXPIRED'
      mockConfirmDelivery.mockRejectedValueOnce(quoteExpiredError)

      fireEvent.click(screen.getByRole('button', { name: 'Send order' }))

      await waitFor(() => {
        expect(screen.getByText('This price has expired')).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: 'Get a new price' })).toBeInTheDocument()
    })

    it('AC-13: bar errors have role="alert" and show no status code; top error banner is gone', async () => {
      mockCreateQuote.mockRejectedValue({
        status: 503,
        statusCode: 503,
        message: 'Request failed (HTTP 503)',
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The price could not be worked out. Try again.')
      expect(alert).not.toHaveTextContent('503')
      // No top error banner
      expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument()
    })

    it('AC-15: second Send guard while customer save runs still holds', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-guard-test',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
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

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      const sendBtn = await screen.findByRole('button', { name: 'Send order' })

      fireEvent.click(sendBtn)

      // Button is disabled and reads Sending…
      const sendingBtn = screen.getByRole('button', { name: /Sending…/i })
      expect(sendingBtn).toBeDisabled()

      // Second click does nothing
      fireEvent.click(sendingBtn)
      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)

      // Resolve confirm
      await act(async () => {
        resolveConfirm({ id: 'del-guard-1', status: 'ACCEPTED' })
      })

      expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-guard-1')
    })

    it('AC-12: expiry check on Send tap prevents confirming delivery and shows expired bar', async () => {
      jest.useFakeTimers()
      try {
        const baseTime = new Date('2026-10-27T10:00:00.000Z').getTime()
        jest.setSystemTime(baseTime)

        mockCreateQuote.mockResolvedValue({
          id: 'quote-exp-ontap',
          quoteRangeFrom: 350,
          quoteRangeTo: 350,
          currency: 'EUR',
          duration: 15,
          distance: 2.0,
          distanceUnit: 'km',
          expiresAt: new Date(baseTime + 10_000).toISOString(), // expires in 10s (< 15s interval)
          dropoffEta: null,
          createdAt: new Date(baseTime).toISOString(),
        })

        render(<CreateDeliveryForm />)

        fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
        fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
        fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
        fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        // Move the clock past expiresAt WITHOUT letting the 15s interval tick (no advanceTimersByTime)
        jest.setSystemTime(baseTime + 12_000)

        // Tap Send order
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Send order' }))
        })

        // confirmDelivery is NOT called and the bar shows "This price has expired" and "Get a new price"
        expect(mockConfirmDelivery).not.toHaveBeenCalled()
        expect(screen.getByText('This price has expired')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Get a new price' })).toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })

    it('runs saveCustomerAfterOrder with formSnapshot values and passes ?customerSave only on failure', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-save-fail',
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

      mockConfirmDelivery.mockResolvedValue({ id: 'del-clash-1', status: 'ACCEPTED' })
      ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('clash')

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      // Tick the save customer checkbox
      const tickCheckbox = screen.getByRole('checkbox', {
        name: /Save this customer for next time \(they agreed\)/i,
      })
      fireEvent.click(tickCheckbox)

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(saveCustomerAfterOrder).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-clash-1', {
          query: { customerSave: 'clash' },
        })
      })
    })

    it('navigates with no second argument when customer save succeeds ("saved" outcome)', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-save-succ',
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

      mockConfirmDelivery.mockResolvedValue({ id: 'del-success-1', status: 'ACCEPTED' })
      ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('saved')

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Jane' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-success-1')
      })
      expect(mockNavigator.goToManualRequestStatus.mock.calls[0]).toHaveLength(1)
    })

    // ── AC-12 & AC-13: Address lookup states and error wording ───────────────────
    it('AC-12: bar button reads "Getting price…" and is disabled while address lookup is pending, ignores second tap, and continues to price once resolved', async () => {
      let resolveLookup!: (coords: { latitude: number; longitude: number } | null) => void
      ;(geocodeCoordinatesFromAddress as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveLookup = resolve
          }),
      )

      mockCreateQuote.mockResolvedValue({
        id: 'quote-lookup-resolves',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      // Tap Get price
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      // While lookup is pending, button reads "Getting price…" and is disabled
      const busyBtn = await screen.findByRole('button', { name: /Getting price…/i })
      expect(busyBtn).toBeDisabled()
      expect(busyBtn).toHaveTextContent('Getting price…')

      // Second tap does not start a second lookup or quote
      fireEvent.click(busyBtn)
      expect(geocodeCoordinatesFromAddress).toHaveBeenCalledTimes(1)
      expect(mockCreateQuote).not.toHaveBeenCalled()

      // Resolve the lookup promise
      await act(async () => {
        resolveLookup({ latitude: 39.362, longitude: 22.945 })
      })

      // Flow continues to the price
      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      expect(sendBtn).toBeInTheDocument()
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
    })

    it('AC-12: when address lookup throws, the button comes back to "Get price" enabled', async () => {
      let rejectLookup!: (err: any) => void
      ;(geocodeCoordinatesFromAddress as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectLookup = reject
          }),
      )

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const busyBtn = await screen.findByRole('button', { name: /Getting price…/i })
      expect(busyBtn).toBeDisabled()

      await act(async () => {
        rejectLookup(new Error('lookup network error'))
      })

      const getPriceBtn = await screen.findByRole('button', { name: 'Get price' })
      expect(getPriceBtn).toBeInTheDocument()
      expect(getPriceBtn).toBeEnabled()
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('AC-13: lookup rejection with TimeoutError shows exact plain sentence in the bar with role="alert", hides raw message, and makes no quote', async () => {
      const timeoutErr = new Error('signal timed out')
      timeoutErr.name = 'TimeoutError'
      ;(geocodeCoordinatesFromAddress as jest.Mock).mockRejectedValue(timeoutErr)

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'The address lookup did not answer. Try again, or search the address and pick a result.',
      )
      expect(screen.queryByText(/signal timed out/i)).not.toBeInTheDocument()
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('AC-13: lookup rejection with TypeError("Failed to fetch") shows connection error sentence in the bar with role="alert", hides raw message, and makes no quote', async () => {
      ;(geocodeCoordinatesFromAddress as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'))

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The address lookup failed. Check your connection and try again.')
      expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument()
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    // ── Review form-level gaps (pinning correct behavior) ──────────────────────
    it('review gap: picking a customer or tapping Change while a price is shown drops the price', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-drop-price',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })

      // 1. Tapping Change on a picked customer while priced drops the price
      ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
        status: 'ready',
        items: [sampleCustomer],
        total: 1,
      })
      const { unmount } = render(<CreateDeliveryForm />)

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Tapping Change drops the price back to Get price
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()

      unmount()

      // 2. Picking a customer while priced on a typed address drops the price
      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Typed Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Picking a customer drops the price back to Get price
      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
    })

    it('review gap: a change while the price is on its way shows exact sentence and no Send order', async () => {
      let resolveQuote!: (quote: any) => void
      mockCreateQuote.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveQuote = resolve
          }),
      )

      // Use saved customer so dropoff coordinates fit and createQuote starts immediately
      ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
        status: 'ready',
        items: [sampleCustomer],
        total: 1,
      })

      render(<CreateDeliveryForm />)

      // Pick customer
      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      const totalInput = screen.getByLabelText(/Order total/i)
      fireEvent.change(totalInput, { target: { value: '15' } })

      // Tap Get price
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      // Wait until createQuote is in flight
      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      // While quote is in flight, modify a field (e.g. order total)
      fireEvent.change(totalInput, { target: { value: '25' } })

      // Now resolve the quote
      await act(async () => {
        resolveQuote({
          id: 'quote-in-flight-stale',
          quoteRangeFrom: 350,
          quoteRangeTo: 350,
          currency: 'EUR',
          duration: 15,
          distance: 2.0,
          distanceUnit: 'km',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          dropoffEta: null,
          createdAt: new Date().toISOString(),
        })
      })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Something changed while the price was on its way. Get the price again.')
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
    })

    it('review gap: "Get a new price" on an expired quote ends priced ("Send order"), not at "Get price"', async () => {
      jest.useFakeTimers()
      try {
        const baseTime = new Date('2026-10-27T10:00:00.000Z').getTime()
        jest.setSystemTime(baseTime)

        const expiredQuote = {
          id: 'quote-exp-first',
          quoteRangeFrom: 350,
          quoteRangeTo: 350,
          currency: 'EUR',
          duration: 15,
          distance: 2.0,
          distanceUnit: 'km',
          expiresAt: new Date(baseTime + 10_000).toISOString(), // expires in 10s
          dropoffEta: null,
          createdAt: new Date(baseTime).toISOString(),
        }

        const freshQuote = {
          id: 'quote-fresh-second',
          quoteRangeFrom: 400,
          quoteRangeTo: 400,
          currency: 'EUR',
          duration: 15,
          distance: 2.0,
          distanceUnit: 'km',
          expiresAt: new Date(baseTime + 600_000).toISOString(),
          dropoffEta: null,
          createdAt: new Date(baseTime + 20_000).toISOString(),
        }

        mockCreateQuote.mockResolvedValueOnce(expiredQuote).mockResolvedValueOnce(freshQuote)

        render(<CreateDeliveryForm />)

        fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
        fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
        fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
        fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        // Advance system time past expiry and let the 15s interval tick
        act(() => {
          jest.advanceTimersByTime(16_000)
        })

        expect(screen.getByText('This price has expired')).toBeInTheDocument()
        const getNewPriceBtn = screen.getByRole('button', { name: 'Get a new price' })
        expect(getNewPriceBtn).toBeInTheDocument()

        // Tap "Get a new price"
        await act(async () => {
          fireEvent.click(getNewPriceBtn)
        })

        // Must end priced ("Send order"), not back at "Get price", and 2 quotes were made
        expect(mockCreateQuote).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Get price' })).not.toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })

    it('review gap: a lookup returning null shows exact error sentence and no quote is made', async () => {
      ;(geocodeCoordinatesFromAddress as jest.Mock).mockResolvedValue(null)

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Unknown Street 999' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('This address was not found on the map. Search for it and pick a result.')
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('review gap: Enter in a field while priced does not re-price (no second quote)', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-priced-enter',
        quoteRangeFrom: 350,
        quoteRangeTo: 350,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      const totalInput = screen.getByLabelText(/Order total/i)
      fireEvent.change(totalInput, { target: { value: '15' } })

      // Get price
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)

      // Press Enter in an input / submit form
      await act(async () => {
        fireEvent.submit(totalInput.closest('form')!)
      })

      // Guard blocks re-pricing: no second quote call and button remains "Send order"
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
    })
  })
})
