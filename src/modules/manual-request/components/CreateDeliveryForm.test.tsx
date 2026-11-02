import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import {
  CreateDeliveryForm,
  CONFIRM_PIN_MESSAGE,
  MOVE_FALLBACK_FIRST,
} from './CreateDeliveryForm'
import {
  usePartnerProfileQuery,
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { ManualRequestPackageSize, PartnerProfileDto } from '../types'
import { saveCustomerAfterOrder } from '../../saved-customers/utils/saveAfterOrder'
import { useSavedCustomerSearch } from '../../saved-customers/hooks/useSavedCustomerSearch'
import {
  geocodeCoordinatesFromAddress,
  lookUpPinForAddress,
  ADDRESS_NOT_FOUND_ON_MAP,
} from '../utils/geocode'
import {
  FLOOR_MAX,
  DOORBELL_MAX,
  RIDER_NOTE_MAX,
  VOLOS_CENTRE,
} from '../utils/orderForm'

const actualGeocode = jest.requireActual('../utils/geocode')

jest.mock('../utils/geocode', () => {
  const actual = jest.requireActual('../utils/geocode')
  return {
    __esModule: true,
    ...actual,
    geocodeCoordinatesFromAddress: jest.fn((...args) => actual.geocodeCoordinatesFromAddress(...args)),
    lookUpPinForAddress: jest.fn((...args) => actual.lookUpPinForAddress(...args)),
  }
})

// Mock PinMapCanvas so react-leaflet ESM is not imported under jsdom
jest.mock('./PinMapCanvas', () => ({
  PinMapCanvas: ({ center, zoom, onUserMove }: any) => (
    <div
      data-testid="mock-pin-map-canvas"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      onClick={() => onUserMove({ latitude: 39.365, longitude: 22.945 })}
    >
      Canvas
    </div>
  ),
}))

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

describe('CreateDeliveryForm (spec 0006 & spec 0016)', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }

  // Helper to fill a typed address, show it on map, confirm the pin, and set ready time + total
  async function setupConfirmedTypedAddress(street = 'Iasonos 10') {
    fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
    fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
    fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: street } })

    ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
      point: { latitude: 39.36, longitude: 22.94 },
      formattedAddress: `${street}, Volos, 38221, GR`,
      message: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))
    const confirmBtn = await screen.findByRole('button', { name: 'Pin is on the entrance' })
    fireEvent.click(confirmBtn)
    expect(await screen.findByText('Pin confirmed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
    fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
      data: fixtureProfile,
      isLoading: false,
      error: undefined,
    })
    ;(useCreateManualRequestQuoteMutation as jest.Mock).mockReturnValue([mockCreateQuote, { isLoading: false }])
    ;(useConfirmManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockConfirmDelivery, { isLoading: false }])
    ;(useRequestPageNavigator as jest.Mock).mockReturnValue(mockNavigator)
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('none')
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'idle' })
    ;(geocodeCoordinatesFromAddress as jest.Mock).mockImplementation((...args) =>
      actualGeocode.geocodeCoordinatesFromAddress(...args),
    )
    ;(lookUpPinForAddress as jest.Mock).mockImplementation((...args) =>
      actualGeocode.lookUpPinForAddress(...args),
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

  // ── AC-1, AC-2, AC-3, AC-4, AC-6, AC-7: Happy path & payloads ──────────────
  describe('Happy path & payload mapping (spec 0016 AC-1, AC-2, AC-3, AC-4)', () => {
    it('AC-1 & AC-2: repeat order with saved customer, ready in pill, total, Get price, Send order', async () => {
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

      // Picked customer card renders with floor and doorbell line (spec 0016, AC-3)
      expect(screen.getByText('Vassilis Spanoulis')).toBeInTheDocument()
      expect(screen.getByText('Iasonos 80, Volos')).toBeInTheDocument()
      expect(screen.getByText('Floor 4 · Doorbell Spanoulis')).toBeInTheDocument()

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

      // 4. Tap "Get price" (picked customer counts as confirmed, spec 0016 AC-5)
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

      // Spec 0016 AC-2: seller notes = note only; dropoffNotes = composed admin note
      expect(quotePayload.dropoffSellerNotes).toBe('Ring twice')
      expect(quotePayload.dropoffNotes).toBe('Floor: 4 · Doorbell: Spanoulis\nRing twice')
      expect(quotePayload.dropoffFloor).toBe('4')
      expect(quotePayload.dropoffDoorbell).toBe('Spanoulis')

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
      expect(deliveryPayload.pickupReadyAt).toBe(pickupReadyAt)
      expect(deliveryPayload.orderTotalValue).toBe(1250)
      expect(deliveryPayload.pickupDeadlineAt).toBeNull()
      expect(deliveryPayload.dropoffReadyAt).toBeNull()
      expect(deliveryPayload.dropoffDeadlineAt).toBeNull()
      expect(deliveryPayload.dropoffAddress.houseNumber).toBe('')
      expect(deliveryPayload.dropoffSellerNotes).toBe('Ring twice')
      expect(deliveryPayload.dropoffNotes).toBe('Floor: 4 · Doorbell: Spanoulis\nRing twice')
      expect(deliveryPayload.dropoffFloor).toBe('4')
      expect(deliveryPayload.dropoffDoorbell).toBe('Spanoulis')
      expect(deliveryPayload.packageSize).toBe(ManualRequestPackageSize.SMALL)

      // Spec 0016 AC-3: Customer save receives floor and doorbell, never addressLine2
      expect(saveCustomerAfterOrder).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          name: 'Vassilis Spanoulis',
          phone: '+306911223344',
          floor: '4',
          doorbell: 'Spanoulis',
          notes: 'Ring twice',
        }),
        linkedCustomerId: 'cust-picked-1',
        saveTicked: true,
      })
      const savedFields = (saveCustomerAfterOrder as jest.Mock).mock.calls[0][0].fields
      expect(savedFields.addressLine2).toBeUndefined()

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

      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '0,29' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.orderTotalValue).toBe(29)

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
        ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
          status: 'ready',
          items: [sampleCustomer],
          total: 1,
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
          createdAt: new Date().toISOString(),
        })

        render(<CreateDeliveryForm />)

        fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
        fireEvent.click(screen.getByRole('radio', { name: '20 min' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
        const quotePayload = mockCreateQuote.mock.calls[0][0]
        expect(quotePayload.pickupReadyAt).toBe('2026-10-27T10:20:00.000Z')
      } finally {
        jest.useRealTimers()
      }
    })

    it('AC-6: ready in selection is required, else Get price refused with "Choose when the order is ready"', async () => {
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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      // Do NOT select any readyInMinutes pill
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

    it('spec 0016 AC-1: Floor (max 20) and Name on the doorbell (max 60) with counters and limit errors', async () => {
      render(<CreateDeliveryForm />)

      const floorInput = screen.getByLabelText(/Floor/i)
      const doorbellInput = screen.getByLabelText(/Name on the doorbell/i)
      const noteInput = screen.getByLabelText(/Note for the rider/i)
      const getPriceBtn = screen.getByRole('button', { name: 'Get price' })

      // Floor: limit 20. 15 chars: no counter. 16 chars: counter shows (80%). Over 20: red counter & error
      fireEvent.change(floorInput, { target: { value: '1'.repeat(15) } })
      expect(screen.queryByText(/15 \/ 20/)).not.toBeInTheDocument()

      fireEvent.change(floorInput, { target: { value: '1'.repeat(16) } })
      expect(screen.getByText('16 / 20')).toBeInTheDocument()

      fireEvent.change(floorInput, { target: { value: '1'.repeat(21) } })
      expect(screen.getByText('21 / 20')).toHaveClass('text-destructive')
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText(`Keep this to ${FLOOR_MAX} characters`)).toBeInTheDocument()

      // Reset floor to valid
      fireEvent.change(floorInput, { target: { value: '3' } })

      // Doorbell: limit 60. 47 chars: no counter. 48 chars: counter shows. Over 60: red counter & error
      fireEvent.change(doorbellInput, { target: { value: 'd'.repeat(47) } })
      expect(screen.queryByText(/47 \/ 60/)).not.toBeInTheDocument()

      fireEvent.change(doorbellInput, { target: { value: 'd'.repeat(48) } })
      expect(screen.getByText('48 / 60')).toBeInTheDocument()

      fireEvent.change(doorbellInput, { target: { value: 'd'.repeat(61) } })
      expect(screen.getByText('61 / 60')).toHaveClass('text-destructive')
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText(`Keep this to ${DOORBELL_MAX} characters`)).toBeInTheDocument()

      // Reset doorbell to valid
      fireEvent.change(doorbellInput, { target: { value: 'Papadopoulou' } })

      // Note: limit 250. 199 chars: no counter. 200 chars: counter shows. Over 250: red counter & error
      fireEvent.change(noteInput, { target: { value: 'n'.repeat(199) } })
      expect(screen.queryByText(/199 \/ 250/)).not.toBeInTheDocument()

      fireEvent.change(noteInput, { target: { value: 'n'.repeat(200) } })
      expect(screen.getByText('200 / 250')).toBeInTheDocument()

      fireEvent.change(noteInput, { target: { value: 'n'.repeat(251) } })
      expect(screen.getByText('251 / 250')).toHaveClass('text-destructive')
      fireEvent.click(getPriceBtn)
      expect(await screen.findByText(`Keep this to ${RIDER_NOTE_MAX} characters`)).toBeInTheDocument()
    })

    it('spec 0016 AC-1: picked customer with stored floor > 20 chars opens Edit and focuses with error', async () => {
      const longFloorCustomer = {
        ...sampleCustomer,
        floor: 'f'.repeat(21),
      }
      ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
        status: 'ready',
        items: [longFloorCustomer],
        total: 1,
      })

      render(<CreateDeliveryForm />)

      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(mockCreateQuote).not.toHaveBeenCalled()
      const floorInput = await screen.findByLabelText(/Floor/i)
      expect(floorInput).toBeInTheDocument()
      expect(floorInput).toHaveValue('f'.repeat(21))
      expect(await screen.findByText(`Keep this to ${FLOOR_MAX} characters`)).toBeInTheDocument()

      await waitFor(() => {
        expect(document.activeElement).toBe(floorInput)
      })
    })

    it('spec 0016 AC-1: picked customer with stored doorbell > 60 chars opens Edit and focuses with error', async () => {
      const longDoorbellCustomer = {
        ...sampleCustomer,
        doorbell: 'd'.repeat(61),
      }
      ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
        status: 'ready',
        items: [longDoorbellCustomer],
        total: 1,
      })

      render(<CreateDeliveryForm />)

      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(mockCreateQuote).not.toHaveBeenCalled()
      const doorbellInput = await screen.findByLabelText(/Name on the doorbell/i)
      expect(doorbellInput).toBeInTheDocument()
      expect(doorbellInput).toHaveValue('d'.repeat(61))
      expect(await screen.findByText(`Keep this to ${DOORBELL_MAX} characters`)).toBeInTheDocument()

      await waitFor(() => {
        expect(document.activeElement).toBe(doorbellInput)
      })
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
      expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Town/i)).toBeInTheDocument()
    })

    it('AC-13: first invalid field gets scrollIntoView({ block: "center" }) and focus', async () => {
      const scrollIntoViewMock = jest.fn()
      Element.prototype.scrollIntoView = scrollIntoViewMock

      render(<CreateDeliveryForm />)

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Customer name/i)
        expect(document.activeElement).toBe(nameInput)
      })

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'center' })
    })
  })

  // ── Spec 0016: PinMap, confirmation, and drop off point rules ───────────────
  describe('The drop off pin and confirmation (spec 0016, AC-4, AC-5)', () => {
    beforeEach(() => {
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: fixtureProfile,
        isLoading: false,
        error: undefined,
      })
    })

    it('AC-5: Get price with an unconfirmed pin is refused with "Confirm the pin on the map" and no quote call', async () => {
      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })

      // Click Show on map
      ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
        point: { latitude: 39.36, longitude: 22.94 },
        formattedAddress: 'Iasonos 10, Volos',
        message: null,
      })
      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

      // Map appears with confirm button "Pin is on the entrance"
      expect(await screen.findByRole('button', { name: 'Pin is on the entrance' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      // Do NOT confirm pin, click Get price
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText(CONFIRM_PIN_MESSAGE)).toBeInTheDocument()
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('AC-5: after confirm, Get price makes quote with exactly confirmed point and no Nominatim call for dropoff', async () => {
      mockCreateQuote.mockResolvedValueOnce({
        id: 'quote-confirmed-1',
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

      await setupConfirmedTypedAddress('Iasonos 10')

      ;(geocodeCoordinatesFromAddress as jest.Mock).mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.dropoffLatitude).toBe(39.36)
      expect(quotePayload.dropoffLongitude).toBe(22.94)
      expect(quotePayload.dropoffAddress.formattedAddress).toBe('Iasonos 10, Volos, 38221, GR')

      // geocodeCoordinatesFromAddress was NOT called for dropoff
      expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()
    })

    it('AC-5: a map move after a price drops the price (Send gone, Get price comes back)', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-move-drops',
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

      await setupConfirmedTypedAddress('Iasonos 10')

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Drag the map (click mock canvas)
      fireEvent.click(screen.getByTestId('mock-pin-map-canvas'))

      // Send order button is gone, Get price is back, and confirm button returns
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pin is on the entrance' })).toBeInTheDocument()
    })

    it('AC-5: editing the street after the point was set clears the map and shows Show on map', async () => {
      render(<CreateDeliveryForm />)

      await setupConfirmedTypedAddress('Iasonos 10')
      expect(screen.getByTestId('mock-pin-map-canvas')).toBeInTheDocument()

      // Edit the street input
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Kartali 50' } })

      // Map is removed, "Show on map" button reappears
      expect(screen.queryByTestId('mock-pin-map-canvas')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Show on map' })).toBeInTheDocument()
    })

    it('AC-4: Show on map not found opens map at restaurant pickup point, and at VOLOS_CENTRE when pickup not usable', async () => {
      ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
        point: { latitude: fixtureProfile.pickupAddress!.latitude, longitude: fixtureProfile.pickupAddress!.longitude },
        formattedAddress: null,
        message: ADDRESS_NOT_FOUND_ON_MAP,
      })

      const { unmount } = render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Unknown Alley' } })

      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

      expect(await screen.findByText(ADDRESS_NOT_FOUND_ON_MAP)).toBeInTheDocument()
      const canvas = screen.getByTestId('mock-pin-map-canvas')
      expect(canvas).toHaveAttribute(
        'data-center',
        JSON.stringify({
          latitude: fixtureProfile.pickupAddress!.latitude,
          longitude: fixtureProfile.pickupAddress!.longitude,
        }),
      )

      unmount()

      // When restaurant pickup is not usable (profile is undefined): opens at VOLOS_CENTRE
      ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
      })
      ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
        point: VOLOS_CENTRE,
        formattedAddress: null,
        message: ADDRESS_NOT_FOUND_ON_MAP,
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Unknown Alley' } })
      fireEvent.change(screen.getByLabelText(/Town/i), { target: { value: 'Volos' } })
      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

      expect(await screen.findByText(ADDRESS_NOT_FOUND_ON_MAP)).toBeInTheDocument()
      expect(screen.getByTestId('mock-pin-map-canvas')).toHaveAttribute(
        'data-center',
        JSON.stringify(VOLOS_CENTRE),
      )
    })

    it('spec 0016: a search pick (address and point together) does NOT clear the point', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              place_id: 1234,
              display_name: 'Iasonos 45, Volos, Thessaly, 38221, GR',
              lat: '39.362',
              lon: '22.945',
              address: { road: 'Iasonos', house_number: '45', city: 'Volos' },
            },
          ]),
      })

      render(<CreateDeliveryForm />)

      const searchInput = screen.getByPlaceholderText('e.g. Iasonos 12')
      fireEvent.change(searchInput, { target: { value: 'Iasonos 45' } })
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))

      const pickOption = await screen.findByText('Iasonos 45, Volos, Thessaly, 38221, GR')
      fireEvent.click(pickOption)

      // Map renders immediately on the picked point and is NOT cleared
      expect(await screen.findByTestId('mock-pin-map-canvas')).toBeInTheDocument()
      expect(screen.getByTestId('mock-pin-map-canvas')).toHaveAttribute(
        'data-center',
        JSON.stringify({ latitude: 39.362, longitude: 22.945 }),
      )
      expect(screen.getByRole('button', { name: 'Pin is on the entrance' })).toBeInTheDocument()
    })

    it('item 8: after a street edit clears point, dropoffAddress.formattedAddress is empty too', async () => {
      mockCreateQuote.mockResolvedValue({
        id: 'quote-stale-addr',
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
      mockConfirmDelivery.mockResolvedValue({ id: 'del-stale-1', status: 'ACCEPTED' })

      render(<CreateDeliveryForm />)

      // Start with confirmed address
      await setupConfirmedTypedAddress('Iasonos 10')

      // Edit the street: clears point and clears formattedAddress
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Kartali 5' } })

      // Show on map returns not found (formattedAddress null)
      ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
        point: { latitude: 39.3622, longitude: 22.9425 },
        formattedAddress: null,
        message: ADDRESS_NOT_FOUND_ON_MAP,
      })

      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))
      expect(await screen.findByText(ADDRESS_NOT_FOUND_ON_MAP)).toBeInTheDocument()

      // Move map and confirm
      fireEvent.click(screen.getByTestId('mock-pin-map-canvas'))
      fireEvent.click(screen.getByRole('button', { name: 'Pin is on the entrance' }))

      // Get price and Send
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
      })

      const deliveryPayload = mockConfirmDelivery.mock.calls[0][0]
      // Formatted address is built from the new typed street, NEVER carrying the old "Iasonos 10" text!
      expect(deliveryPayload.dropoffAddress.formattedAddress).toBe('Kartali 5, Volos, GR')
      expect(deliveryPayload.dropoffAddress.formattedAddress).not.toContain('Iasonos 10')
      expect(deliveryPayload.dropoffAddress.streetAddress[0]).toBe('Kartali 5')

      const savedFields = (saveCustomerAfterOrder as jest.Mock).mock.calls[0][0].fields
      expect(savedFields.formattedAddress).toBe('Kartali 5, Volos, GR')
      expect(savedFields.formattedAddress).not.toContain('Iasonos 10')
      expect(savedFields.addressLine1).toBe('Kartali 5')
    })

    it('item 9: an answer from Show on map that arrives after the street was edited is ignored', async () => {
      let resolveLookup!: (val: any) => void
      const pendingLookup = new Promise((resolve) => {
        resolveLookup = resolve
      })
      ;(lookUpPinForAddress as jest.Mock).mockReturnValue(pendingLookup)

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Street A' } })

      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

      await waitFor(() => {
        expect(lookUpPinForAddress).toHaveBeenCalled()
      })

      // Street edited while lookup in flight
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Street B' } })

      // Lookup completes for Street A
      act(() => {
        resolveLookup({
          point: { latitude: 39.39, longitude: 22.99 },
          formattedAddress: 'Street A, Volos',
          message: null,
        })
      })

      await waitFor(() => {
        // Map should NOT mount for Street A; "Show on map" button remains
        expect(screen.getByRole('button', { name: 'Show on map' })).toBeInTheDocument()
        expect(screen.queryByTestId('mock-pin-map-canvas')).not.toBeInTheDocument()
      })
    })

    it('item 10: after "Address not found", "Pin is on the entrance" is refused with MOVE_FALLBACK_FIRST until map is moved', async () => {
      ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
        point: { latitude: 39.3622, longitude: 22.9425 },
        formattedAddress: null,
        message: ADDRESS_NOT_FOUND_ON_MAP,
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Unknown Alley' } })

      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

      const confirmBtn = await screen.findByRole('button', { name: 'Pin is on the entrance' })
      expect(confirmBtn).toBeInTheDocument()

      // Tap confirm before moving map
      fireEvent.click(confirmBtn)

      expect(await screen.findByText(MOVE_FALLBACK_FIRST)).toBeInTheDocument()
      expect(screen.queryByText('Pin confirmed')).not.toBeInTheDocument()

      // Move the map
      fireEvent.click(screen.getByTestId('mock-pin-map-canvas'))

      // Now tap confirm: succeeds
      fireEvent.click(confirmBtn)
      expect(await screen.findByText('Pin confirmed')).toBeInTheDocument()
      expect(screen.queryByText(MOVE_FALLBACK_FIRST)).not.toBeInTheDocument()
    })
  })

  // ── Customer linking & PickedCustomerCard (AC-11, AC-15) ───────────────────
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
      expect(screen.getByLabelText(/Floor/i)).toHaveValue('4')
      expect(screen.getByLabelText(/Name on the doorbell/i)).toHaveValue('Spanoulis')

      // Click Change: unlinks, fields keep values, tick goes off
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      expect(tickCheckbox).not.toBeChecked()
      expect(screen.queryByText('Saved customer. Edit the details below.')).not.toBeInTheDocument()
      expect(screen.getByLabelText(/Customer name/i)).toHaveValue('Vassilis Spanoulis')
    })

    it('AC-11: Change keeps the address visible in the address search box and fresh form starts empty', () => {
      render(<CreateDeliveryForm />)

      const freshSearchInput = screen.getByPlaceholderText('e.g. Iasonos 12')
      expect(freshSearchInput).toHaveValue('')

      // Pick saved customer
      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      expect(screen.getByText('Vassilis Spanoulis')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('e.g. Iasonos 12')).not.toBeInTheDocument()

      // Tap Change
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      const searchBoxAfterChange = screen.getByPlaceholderText('e.g. Iasonos 12')
      expect(searchBoxAfterChange).toHaveValue(sampleCustomer.formattedAddress)
    })

    it('AC-10 & AC-11: pick saved customer, tap Change, tap Clear search, tap Get price: no quote is made, validation error shows and typed fields open', async () => {
      render(<CreateDeliveryForm />)

      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      const searchBox = screen.getByPlaceholderText('e.g. Iasonos 12')
      expect(searchBox).toHaveValue(sampleCustomer.formattedAddress)

      const clearBtn = screen.getByRole('button', { name: 'Clear search' })
      fireEvent.click(clearBtn)
      expect(searchBox).toHaveValue('')

      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      expect(mockCreateQuote).not.toHaveBeenCalled()
      expect(await screen.findByText('Search the address and pick a result, or type it')).toBeInTheDocument()
      expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Town/i)).toBeInTheDocument()
    })

    it('row 26: picked customer stored point is used without lookup', async () => {
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

      const customerItem = screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!
      fireEvent.click(customerItem)

      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      ;(geocodeCoordinatesFromAddress as jest.Mock).mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      expect(geocodeCoordinatesFromAddress).not.toHaveBeenCalled()

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload.dropoffLatitude).toBe(sampleCustomer.latitude)
      expect(quotePayload.dropoffLongitude).toBe(sampleCustomer.longitude)
      expect(quotePayload.dropoffAddress.formattedAddress).toBe(sampleCustomer.formattedAddress)
    })
  })

  // ── Price & Send state transitions (AC-12, AC-13) ──────────────────────────
  describe('Price & Send state transitions (AC-12, AC-13)', () => {
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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Toggling save tick does NOT drop the price
      const tickCheckbox = screen.getByRole('checkbox', {
        name: /Save this customer for next time \(they agreed\)/i,
      })
      fireEvent.click(tickCheckbox)
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // Changing order total drops the price back to Get price
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
          expiresAt: new Date(baseTime + 30_000).toISOString(),
          dropoffEta: null,
          createdAt: new Date(baseTime).toISOString(),
        })

        render(<CreateDeliveryForm />)

        fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
        fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // 1. Generic server failure (keeps Send order)
      mockConfirmDelivery.mockRejectedValueOnce(new Error('Network connection dropped'))
      fireEvent.click(screen.getByRole('button', { name: 'Send order' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network connection dropped')
      })
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

      // 2. Quote failure (QUOTE_HAS_EXPIRED: goes to expired)
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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The price could not be worked out. Try again.')
      expect(alert).not.toHaveTextContent('503')
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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      const sendBtn = await screen.findByRole('button', { name: 'Send order' })

      fireEvent.click(sendBtn)

      const sendingBtn = screen.getByRole('button', { name: /Sending…/i })
      expect(sendingBtn).toBeDisabled()

      fireEvent.click(sendingBtn)
      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)

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
          expiresAt: new Date(baseTime + 10_000).toISOString(),
          dropoffEta: null,
          createdAt: new Date(baseTime).toISOString(),
        })

        render(<CreateDeliveryForm />)

        fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
        fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        jest.setSystemTime(baseTime + 12_000)

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Send order' }))
        })

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

      await setupConfirmedTypedAddress('Iasonos 10')

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

      await setupConfirmedTypedAddress('Iasonos 10')

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      const sendBtn = await screen.findByRole('button', { name: 'Send order' })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-success-1')
      })
      expect(mockNavigator.goToManualRequestStatus.mock.calls[0]).toHaveLength(1)
    })

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
      const { unmount } = render(<CreateDeliveryForm />)

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()

      unmount()

      // 2. Picking a customer while priced on a typed address drops the price
      render(<CreateDeliveryForm />)

      await setupConfirmedTypedAddress('Iasonos 10')

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

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

      render(<CreateDeliveryForm />)

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      const totalInput = screen.getByLabelText(/Order total/i)
      fireEvent.change(totalInput, { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      })

      fireEvent.change(totalInput, { target: { value: '25' } })

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
          expiresAt: new Date(baseTime + 10_000).toISOString(),
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

        fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
        fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
        fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
        })

        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        act(() => {
          jest.advanceTimersByTime(16_000)
        })

        expect(screen.getByText('This price has expired')).toBeInTheDocument()
        const getNewPriceBtn = screen.getByRole('button', { name: 'Get a new price' })
        expect(getNewPriceBtn).toBeInTheDocument()

        await act(async () => {
          fireEvent.click(getNewPriceBtn)
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Get price' })).not.toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
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

      fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      const totalInput = screen.getByLabelText(/Order total/i)
      fireEvent.change(totalInput, { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)

      await act(async () => {
        fireEvent.submit(totalInput.closest('form')!)
      })

      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
    })

    it('Show on map: button reads "Finding the address…" and is disabled while lookup is pending', async () => {
      let resolveLookup!: (val: any) => void
      const lookupPromise = new Promise((resolve) => {
        resolveLookup = resolve
      })
      ;(lookUpPinForAddress as jest.Mock).mockReturnValue(lookupPromise)

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })

      const showOnMapBtn = screen.getByRole('button', { name: 'Show on map' })
      fireEvent.click(showOnMapBtn)

      const locatingBtn = await screen.findByRole('button', { name: /Finding the address…/i })
      expect(locatingBtn).toBeDisabled()

      await act(async () => {
        resolveLookup({
          point: { latitude: 39.36, longitude: 22.94 },
          formattedAddress: 'Iasonos 10, Volos',
          message: null,
        })
      })

      expect(await screen.findByRole('button', { name: 'Pin is on the entrance' })).toBeInTheDocument()
    })

    it('Show on map: displays error message when lookup fails', async () => {
      ;(lookUpPinForAddress as jest.Mock).mockResolvedValueOnce({
        error: 'The address lookup failed. Check your connection and try again.',
      })

      render(<CreateDeliveryForm />)

      fireEvent.change(screen.getByLabelText(/Customer name/i), { target: { value: 'Kostas' } })
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '6912345678' } })
      fireEvent.click(screen.getByRole('button', { name: "Can't find it? Type it" }))
      fireEvent.change(screen.getByLabelText(/Street and number/i), { target: { value: 'Iasonos 10' } })

      fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The address lookup failed. Check your connection and try again.')
      expect(screen.queryByTestId('mock-pin-map-canvas')).not.toBeInTheDocument()
    })
  })
})
