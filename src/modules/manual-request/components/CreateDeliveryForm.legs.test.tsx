// Spec 0046 (row 10, AC-2, AC-3, cross checks 1, 6, 7): "How many boxes?" on the order form. Above one
// box the order goes as that many ordinary deliveries ("legs"): one quote per leg, the total shown before
// Send, the legs created one after another with one shared reference, and a leg that fails after leg 1
// went is shown to the restaurant. Written from the spec by a Fable subagent standing in for agy (R.25).
import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CreateDeliveryForm, BOX_SIZE_REQUIRED } from './CreateDeliveryForm'
import {
  usePartnerProfileQuery,
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { PartnerProfileDto } from '../types'
import { saveCustomerAfterOrder } from '../../saved-customers/utils/saveAfterOrder'
import { useSavedCustomerSearch } from '../../saved-customers/hooks/useSavedCustomerSearch'
import { createI18n } from '../../../i18n/createI18n'

const t = createI18n('en').t

// The toast is how the form says which leg was not sent; the real hook is kept for everything else.
const mockToast = jest.fn()
jest.mock('../../../admin-web-components/components/molecules/toast/useToast', () => ({
  ...jest.requireActual('../../../admin-web-components/components/molecules/toast/useToast'),
  useToast: () => ({ toast: mockToast, toasts: [], dismiss: jest.fn() }),
}))

// Mock PinMapCanvas because react-leaflet ESM is not imported in JSDOM
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
  id: 'cust-box-1',
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

const plain = (text: string | null | undefined) => (text ?? '').replace(/ /g, ' ')

describe('CreateDeliveryForm: multi leg orders (spec 0046)', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }
  // Each quote asked gets its own id and may get its own price and expiry.
  let quotePrices: number[]
  let quoteExpiries: (string | null)[]
  let quoteCount: number

  beforeEach(() => {
    jest.resetAllMocks()
    quotePrices = []
    quoteExpiries = []
    quoteCount = 0
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({ data: fixtureProfile, isLoading: false, error: undefined })
    ;(useCreateManualRequestQuoteMutation as jest.Mock).mockReturnValue([mockCreateQuote, { isLoading: false }])
    ;(useConfirmManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockConfirmDelivery, { isLoading: false }])
    ;(useRequestPageNavigator as jest.Mock).mockReturnValue(mockNavigator)
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('none')
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'ready', items: [sampleCustomer], total: 1 })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ savedCustomerRetentionMonths: 12 }),
    })
    mockCreateQuote.mockImplementation(async () => {
      const index = quoteCount++
      const expiresAt = index in quoteExpiries ? quoteExpiries[index] : new Date(Date.now() + 600_000).toISOString()
      return {
        id: `quote-${index + 1}`,
        quoteRangeFrom: quotePrices[index] ?? 380,
        quoteRangeTo: quotePrices[index] ?? 380,
        currency: 'EUR',
        duration: 15,
        distance: 2.0,
        distanceUnit: 'km',
        expiresAt,
        dropoffEta: null,
        createdAt: new Date().toISOString(),
      }
    })
    mockConfirmDelivery.mockImplementation(async (input: any) => ({ id: `del-leg-${input.legNumber ?? 'single'}`, status: 'CREATED' }))
  })

  // The customer, the ready time and a 20,00 € total; the boxes are each test's own.
  function fillOrder() {
    fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
    fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
    fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '20' } })
  }
  const boxes = () => screen.getByRole('radiogroup', { name: 'How many boxes?' })
  const chooseBoxes = (count: number) => fireEvent.click(within(boxes()).getByRole('radio', { name: String(count) }))
  const chooseSize = (box: number, size: 'Small' | 'Medium' | 'Large') =>
    fireEvent.click(within(screen.getByRole('radiogroup', { name: `Box ${box} size` })).getByRole('radio', { name: size }))
  const getPrice = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
    })
  }
  const send = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send order' }))
    })
  }
  const twoBoxesPriced = async () => {
    render(<CreateDeliveryForm />)
    fillOrder()
    chooseBoxes(2)
    chooseSize(1, 'Large')
    chooseSize(2, 'Small')
    await getPrice()
  }

  describe('AC-2: "How many boxes?"', () => {
    it('offers 1 to 4, with 1 chosen when the form opens', () => {
      render(<CreateDeliveryForm />)

      const pills = within(boxes()).getAllByRole('radio')
      expect(pills.map((pill) => pill.textContent)).toEqual(['1', '2', '3', '4'])
      expect(pills.filter((pill) => pill.getAttribute('data-state') === 'checked').map((pill) => pill.textContent)).toEqual(['1'])
    })

    it('one box asks one size, labelled "Box size"', () => {
      render(<CreateDeliveryForm />)

      expect(screen.getByRole('radiogroup', { name: 'Box size' })).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Box 2 size' })).not.toBeInTheDocument()
    })

    it('three boxes ask a size for each box, none chosen for the new ones', () => {
      render(<CreateDeliveryForm />)
      chooseBoxes(3)

      for (const box of [1, 2, 3]) {
        const group = screen.getByRole('radiogroup', { name: `Box ${box} size` })
        expect(within(group).getAllByRole('radio').map((pill) => pill.textContent)).toEqual(['Small', 'Medium', 'Large'])
        expect(group.querySelectorAll('button[role="radio"][data-state="checked"]')).toHaveLength(0)
      }
      expect(screen.queryByRole('radiogroup', { name: 'Box 4 size' })).not.toBeInTheDocument()
    })

    it('says that each box is its own delivery with its own price, only above one box', () => {
      render(<CreateDeliveryForm />)
      expect(screen.queryByText(/Each box goes as its own delivery/)).not.toBeInTheDocument()

      chooseBoxes(2)

      expect(screen.getByText(/Each box goes as its own delivery with its own rider, and each is charged a delivery price/)).toBeInTheDocument()
    })

    it('going back to one box drops the extra sizes', () => {
      render(<CreateDeliveryForm />)
      chooseBoxes(3)
      chooseBoxes(1)

      expect(screen.queryByRole('radiogroup', { name: 'Box 2 size' })).not.toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Box size' })).toBeInTheDocument()
    })

    it('a box with no size refuses Get price and asks for no quote', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      chooseBoxes(2)
      chooseSize(1, 'Large')

      await getPrice()

      expect(await screen.findByText(t(BOX_SIZE_REQUIRED))).toBeInTheDocument()
      expect(mockCreateQuote).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
    })
  })

  describe('AC-2: one quote per leg and the total before Send', () => {
    it('two boxes ask two quotes for the same addresses, with no size and no leg label on them', async () => {
      await twoBoxesPriced()

      expect(mockCreateQuote).toHaveBeenCalledTimes(2)
      const [first, second] = mockCreateQuote.mock.calls.map((call) => call[0])
      expect(second).toEqual(first)
      expect(first.dropoffLatitude).toBe(39.361)
      expect(first).not.toHaveProperty('boxSize')
      expect(first).not.toHaveProperty('legNumber')
      expect(first).not.toHaveProperty('legCount')
    })

    it('four boxes ask four quotes', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      chooseBoxes(4)
      for (const box of [1, 2, 3, 4]) chooseSize(box, 'Medium')
      await getPrice()

      expect(mockCreateQuote).toHaveBeenCalledTimes(4)
    })

    it('shows "2 deliveries × 3,80 € = 7,60 €" before Send, and nothing is created yet', async () => {
      await twoBoxesPriced()

      expect(plain(screen.getByTestId('leg-total').textContent)).toBe('2 deliveries × €3.80 = €7.60')
      // Row 10 review: the big figure is what the customer pays, the legs' total.
      expect(plain(document.querySelector('.text-2xl')?.textContent)).toBe('€7.60')
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
      expect(mockConfirmDelivery).not.toHaveBeenCalled()
    })

    it('cross check 7: legs priced differently show one line per leg and the total', async () => {
      quotePrices = [356, 392]
      await twoBoxesPriced()

      const total = plain(screen.getByTestId('leg-total').textContent)
      expect(total).toContain('Leg 1 of 2: €3.56')
      expect(total).toContain('Leg 2 of 2: €3.92')
      expect(total).toContain('Total €7.48')
    })

    it('one box asks one quote and shows no total line', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Box size' })).getByRole('radio', { name: 'Medium' }))
      await getPrice()

      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('leg-total')).not.toBeInTheDocument()
    })

    it('changing the number of boxes after a price drops the price', async () => {
      await twoBoxesPriced()

      chooseBoxes(3)

      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()
    })

    it('changing a later box\'s size after a price drops the price, so Send never carries an old size', async () => {
      await twoBoxesPriced()

      chooseSize(2, 'Large')

      expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
    })
  })

  describe('AC-2, cross checks 1 and 6: Send creates the legs', () => {
    it('two boxes become two deliveries, leg 1 first, with their numbers, sizes and own quotes', async () => {
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(2))
      const [one, two] = mockConfirmDelivery.mock.calls.map((call) => call[0])
      expect(one).toMatchObject({ legNumber: 1, legCount: 2, boxSize: 'LARGE', quoteId: 'quote-1' })
      expect(two).toMatchObject({ legNumber: 2, legCount: 2, boxSize: 'SMALL', quoteId: 'quote-2' })
    })

    it('every leg shares one reference: the first leg\'s quote id', async () => {
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(2))
      const references = mockConfirmDelivery.mock.calls.map((call) => call[0].orderReference)
      expect(references).toEqual(['quote-1', 'quote-1'])
    })

    it('the order total is on leg 1 only; the other legs carry 0', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      chooseBoxes(3)
      chooseSize(1, 'Large')
      chooseSize(2, 'Medium')
      chooseSize(3, 'Small')
      await getPrice()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(3))
      expect(mockConfirmDelivery.mock.calls.map((call) => call[0].orderTotalValue)).toEqual([2000, 0, 0])
      expect(mockConfirmDelivery.mock.calls.map((call) => call[0].legNumber)).toEqual([1, 2, 3])
      expect(mockConfirmDelivery.mock.calls.map((call) => call[0].legCount)).toEqual([3, 3, 3])
      expect(mockConfirmDelivery.mock.calls.map((call) => call[0].boxSize)).toEqual(['LARGE', 'MEDIUM', 'SMALL'])
    })

    it('each leg has its own idempotency key', async () => {
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(2))
      const keys = mockConfirmDelivery.mock.calls.map((call) => call[0].idempotencyKey)
      expect(keys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true)
      expect(new Set(keys).size).toBe(2)
    })

    it('the customer and the notes go on every leg', async () => {
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(2))
      const [one, two] = mockConfirmDelivery.mock.calls.map((call) => call[0])
      expect(two.dropoffName).toBe(one.dropoffName)
      expect(two.dropoffPhoneNumber).toBe(one.dropoffPhoneNumber)
      expect(two.dropoffSellerNotes).toBe(one.dropoffSellerNotes)
      expect(two.dropoffNotes).toBe(one.dropoffNotes)
      expect(one.dropoffName).toBe('Vassilis Spanoulis')
    })

    it('when every leg went, the page moves to leg 1 and says the order went as 2 deliveries', async () => {
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-leg-1'))
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Order sent as 2 deliveries' }))
    })

    it('one box is still one ordinary delivery: no leg labels, one create', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Box size' })).getByRole('radio', { name: 'Medium' }))
      await getPrice()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))
      const only = mockConfirmDelivery.mock.calls[0][0]
      expect(only.legNumber).toBeUndefined()
      expect(only.legCount).toBeUndefined()
      expect(only.orderTotalValue).toBe(2000)
      expect(only.boxSize).toBe('MEDIUM')
    })
  })

  describe('AC-3: a leg that fails to create', () => {
    const threeBoxesPriced = async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      chooseBoxes(3)
      for (const box of [1, 2, 3]) chooseSize(box, 'Medium')
      await getPrice()
    }

    it('leg 2 failing after leg 1 went stops the sending: leg 3 is not tried', async () => {
      mockConfirmDelivery.mockImplementation(async (input: any) => {
        if (input.legNumber === 2) throw new Error('The server did not answer')
        return { id: `del-leg-${input.legNumber}`, status: 'CREATED' }
      })
      await threeBoxesPriced()
      await send()

      await waitFor(() => expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalled())
      expect(mockConfirmDelivery.mock.calls.map((call) => call[0].legNumber)).toEqual([1, 2])
    })

    it('the restaurant is told which leg was not sent and is taken to the order, where Retry and Cancel are', async () => {
      mockConfirmDelivery.mockImplementation(async (input: any) => {
        if (input.legNumber === 2) throw new Error('The server did not answer')
        return { id: `del-leg-${input.legNumber}`, status: 'CREATED' }
      })
      await threeBoxesPriced()
      await send()

      await waitFor(() => expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-leg-1'))
      expect(mockToast).toHaveBeenCalledTimes(1)
      const said = mockToast.mock.calls[0][0]
      expect(said.title).toBe('Leg 2 of 3 was not sent')
      expect(said.description).toMatch(/Try again or cancel/)
      // Never the success sentence for an order that is not whole.
      expect(JSON.stringify(mockToast.mock.calls)).not.toContain('Order sent as')
    })

    // Row 10 review: the backend's own reason, so the restaurant knows why before it retries.
    it('the toast carries the backend\'s reason for the leg, then what to do', async () => {
      mockConfirmDelivery.mockImplementation(async (input: any) => {
        if (input.legNumber === 2) {
          const err = new Error('No couriers are currently available') as any
          err.statusCode = 503
          throw err
        }
        return { id: `del-leg-${input.legNumber}`, status: 'CREATED' }
      })
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1))
      expect(mockToast.mock.calls[0][0]).toEqual({
        title: 'Leg 2 of 2 was not sent',
        description: 'No couriers are currently available Try again or cancel the legs already sent, on the order page.',
      })
    })

    it('a failure with no readable reason ("Request failed (HTTP 500)") shows only what to do', async () => {
      mockConfirmDelivery.mockImplementation(async (input: any) => {
        if (input.legNumber === 2) throw new Error('Request failed (HTTP 500)')
        return { id: `del-leg-${input.legNumber}`, status: 'CREATED' }
      })
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1))
      expect(mockToast.mock.calls[0][0].description).toBe('Try again or cancel the legs already sent, on the order page.')
    })

    it('the last leg failing is told the same way', async () => {
      mockConfirmDelivery.mockImplementation(async (input: any) => {
        if (input.legNumber === 2) throw new Error('The server did not answer')
        return { id: `del-leg-${input.legNumber}`, status: 'CREATED' }
      })
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-leg-1'))
      expect(mockToast.mock.calls[0][0].title).toBe('Leg 2 of 2 was not sent')
    })

    it('leg 1 failing sends nothing else, stays on the form with the reason and keeps the price', async () => {
      mockConfirmDelivery.mockRejectedValue(new Error('The server did not answer'))
      await twoBoxesPriced()
      await send()

      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))
      expect(mockConfirmDelivery.mock.calls[0][0].legNumber).toBe(1)
      expect(mockNavigator.goToManualRequestStatus).not.toHaveBeenCalled()
      expect(mockToast).not.toHaveBeenCalled()
      expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()
    })
  })

  describe('the price expiry looks at every leg\'s quote', () => {
    const BASE = new Date('2026-11-21T10:00:00.000Z').getTime()

    it('Send is refused when only the second leg\'s price has expired', async () => {
      jest.useFakeTimers()
      try {
        jest.setSystemTime(BASE)
        quoteExpiries = [new Date(BASE + 600_000).toISOString(), new Date(BASE + 10_000).toISOString()]
        await twoBoxesPriced()
        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        jest.setSystemTime(BASE + 12_000)
        await send()

        expect(mockConfirmDelivery).not.toHaveBeenCalled()
        expect(screen.getByText('This price has expired')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Get a new price' })).toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })

    it('the bar turns to "This price has expired" on its own when the second leg\'s price runs out', async () => {
      jest.useFakeTimers()
      try {
        jest.setSystemTime(BASE)
        quoteExpiries = [new Date(BASE + 600_000).toISOString(), new Date(BASE + 30_000).toISOString()]
        await twoBoxesPriced()
        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

        act(() => {
          jest.advanceTimersByTime(35_000)
        })

        expect(screen.getByText('This price has expired')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })

    it('prices still in time are not called expired (the check reads each quote\'s own time)', async () => {
      jest.useFakeTimers()
      try {
        jest.setSystemTime(BASE)
        quoteExpiries = [new Date(BASE + 600_000).toISOString(), new Date(BASE + 600_000).toISOString()]
        await twoBoxesPriced()

        act(() => {
          jest.advanceTimersByTime(35_000)
        })

        expect(screen.queryByText('This price has expired')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })
  })
})
