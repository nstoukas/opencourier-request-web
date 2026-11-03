import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
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

// Spec 0028 (row 103): the order form's optional item lines (AC-2, AC-3) and how they meet Get price and
// Send. The mocks are the same as CreateDeliveryForm.test.tsx's.

jest.mock('./PinMapCanvas', () => ({
  PinMapCanvas: () => <div data-testid="mock-pin-map-canvas">Canvas</div>,
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
  id: 'cust-items-1',
  name: 'Eleni Markou',
  phone: '+306911000103',
  notes: '',
  addressLine1: 'Iasonos 80',
  addressLine2: null,
  floor: '2',
  doorbell: 'Markou',
  city: 'Volos',
  zipCode: '38221',
  latitude: 39.361,
  longitude: 22.942,
  formattedAddress: 'Iasonos 80, Volos',
  lastUsedAt: '2026-11-01T10:00:00Z',
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
}

const quote = (id: string) => ({
  id,
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

describe('CreateDeliveryForm item lines (spec 0028)', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(usePartnerProfileQuery as jest.Mock).mockReturnValue({ data: fixtureProfile, isLoading: false, error: undefined })
    ;(useCreateManualRequestQuoteMutation as jest.Mock).mockReturnValue([mockCreateQuote, { isLoading: false }])
    ;(useConfirmManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockConfirmDelivery, { isLoading: false }])
    ;(useRequestPageNavigator as jest.Mock).mockReturnValue(mockNavigator)
    ;(saveCustomerAfterOrder as jest.Mock).mockResolvedValue('none')
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({ status: 'ready', items: [sampleCustomer], total: 1 })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    mockCreateQuote.mockResolvedValue(quote('quote-items-1'))
    mockConfirmDelivery.mockResolvedValue({ id: 'del-items-1', status: 'ACCEPTED' })
  })

  // The fast path: a picked customer (its pin counts as confirmed), Ready "Now", a total.
  function fillOrder() {
    fireEvent.click(screen.getByText('Eleni Markou').closest('[role="option"]')!)
    fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
    fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })
  }

  const nameInput = (n: number) => screen.getByRole('textbox', { name: `Item ${n} name` })

  function addLine(name: string, kind?: 'Drink' | 'Side', extraQuantity = 0) {
    const addButton =
      screen.queryByRole('button', { name: 'Add items (optional)' }) ??
      screen.getByRole('button', { name: 'Add another item' })
    fireEvent.click(addButton)
    const count = screen.getAllByRole('textbox', { name: /Item \d+ name/ }).length
    // The first tap on "Add items (optional)" opens with one line; a later "Add another item" appends one.
    const line = screen.getByTestId(`item-line-${count - 1}`)
    fireEvent.change(within(line).getByRole('textbox'), { target: { value: name } })
    for (let i = 0; i < extraQuantity; i++) {
      fireEvent.click(within(line).getByRole('button', { name: 'One more' }))
    }
    if (kind) fireEvent.click(within(line).getByRole('button', { name: kind }))
  }

  // A real tap moves the focus to the button it hits; fireEvent.click does not, and react-hook-form's
  // append focuses the new line, so without this a focus check could pass on the focus left by the add.
  function tap(button: HTMLElement) {
    act(() => button.focus())
    fireEvent.click(button)
  }

  async function getPrice() {
    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
    return screen.findByRole('button', { name: 'Send order' })
  }

  describe('the payload (AC-3)', () => {
    it('with no lines, the delivery carries no orderItems (the API then sends the Package item)', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      fireEvent.click(screen.getByRole('radio', { name: 'Medium' }))

      fireEvent.click(await getPrice())
      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))

      const payload = mockConfirmDelivery.mock.calls[0][0]
      expect(payload.orderItems).toBeUndefined()
      expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('orderItems')
      expect(payload.packageSize).toBe(ManualRequestPackageSize.MEDIUM)
    })

    it('opening the section and removing its only line sends no orderItems either', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      fireEvent.click(screen.getByRole('button', { name: 'Add items (optional)' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }))

      fireEvent.click(await getPrice())
      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))

      expect(mockConfirmDelivery.mock.calls[0][0].orderItems).toBeUndefined()
    })

    it('with lines, sends [{ name, quantity, kind? }] in order, names trimmed, the size on [0] only', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
      addLine('  Souvlaki pita ', undefined, 1)
      addLine('Cola', 'Drink', 2)
      addLine('Fries', 'Side')

      fireEvent.click(await getPrice())
      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))

      const payload = mockConfirmDelivery.mock.calls[0][0]
      expect(JSON.parse(JSON.stringify(payload.orderItems))).toEqual([
        { name: 'Souvlaki pita', quantity: 2, size: ManualRequestPackageSize.LARGE },
        { name: 'Cola', quantity: 3, kind: 'DRINK' },
        { name: 'Fries', quantity: 1, kind: 'SIDE' },
      ])
      expect(payload.orderItems[0]).not.toHaveProperty('kind')
      expect(payload.orderItems[1]).not.toHaveProperty('size')
      expect(payload.orderItems[2]).not.toHaveProperty('size')
    })

    it('a mark cleared before Send is not sent', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')
      fireEvent.click(within(screen.getByTestId('item-line-0')).getByRole('button', { name: 'Drink' }))

      fireEvent.click(await getPrice())
      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))

      const sent = mockConfirmDelivery.mock.calls[0][0].orderItems
      expect(sent).toEqual([{ name: 'Cola', quantity: 1, size: ManualRequestPackageSize.SMALL }])
      expect(sent[0]).not.toHaveProperty('kind')
    })

    it('the quote request never carries the items', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')

      await getPrice()

      const quotePayload = mockCreateQuote.mock.calls[0][0]
      expect(quotePayload).not.toHaveProperty('orderItems')
      expect(quotePayload).not.toHaveProperty('items')
    })
  })

  describe('items are not on the quote (editing keeps the price)', () => {
    it('editing a line after Get price keeps the price, and Send sends the edited lines', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')

      await getPrice()

      fireEvent.change(nameInput(1), { target: { value: 'Orange juice' } })
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Get price' })).not.toBeInTheDocument()

      fireEvent.click(within(screen.getByTestId('item-line-0')).getByRole('button', { name: 'Side' }))
      fireEvent.click(within(screen.getByTestId('item-line-0')).getByRole('button', { name: 'One more' }))
      addLine('Tzatziki', 'Side')
      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Send order' }))
      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))

      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
      expect(mockConfirmDelivery.mock.calls[0][0].orderItems).toEqual([
        { name: 'Orange juice', quantity: 2, kind: 'SIDE', size: ManualRequestPackageSize.SMALL },
        { name: 'Tzatziki', quantity: 1, kind: 'SIDE' },
      ])
    })

    it('opening the section after Get price keeps the price', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      await getPrice()

      fireEvent.click(screen.getByRole('button', { name: 'Add items (optional)' }))

      expect(screen.getByRole('button', { name: 'Send order' })).toBeInTheDocument()
    })
  })

  describe('refusals and focus', () => {
    it('an empty name at Get price shows the sentence, focuses that line\'s name, and makes no quote', async () => {
      const scrollIntoView = jest.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')
      addLine('   ')

      tap(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText('Name the item, or remove the line.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).toBe(nameInput(2)))
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('a line left wholly empty (just opened) blocks Get price, never dropped silently', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      fireEvent.click(screen.getByRole('button', { name: 'Add items (optional)' }))

      tap(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText('Name the item, or remove the line.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).toBe(nameInput(1)))
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('a name over 60 characters shows "Keep the item name to 60 characters."', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('A'.repeat(61))

      tap(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText('Keep the item name to 60 characters.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).toBe(nameInput(1)))
      expect(mockCreateQuote).not.toHaveBeenCalled()
    })

    it('a name of exactly 60 characters is accepted', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('B'.repeat(60))

      await getPrice()

      expect(screen.queryByText('Keep the item name to 60 characters.')).not.toBeInTheDocument()
      expect(mockCreateQuote).toHaveBeenCalledTimes(1)
    })

    it('the item name comes before Order total in the focus order', async () => {
      render(<CreateDeliveryForm />)
      fireEvent.click(screen.getByText('Eleni Markou').closest('[role="option"]')!)
      fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
      // Order total left empty: refused too, but it sits after the items.
      addLine('')

      tap(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText('Name the item, or remove the line.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).toBe(nameInput(1)))
    })

    it('Ready in (before the items) still wins the focus over an empty item name', async () => {
      render(<CreateDeliveryForm />)
      fireEvent.click(screen.getByText('Eleni Markou').closest('[role="option"]')!)
      fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })
      addLine('')

      tap(screen.getByRole('button', { name: 'Get price' }))

      expect(await screen.findByText('Name the item, or remove the line.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).not.toBe(nameInput(1)))
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Now' }))
    })

    it('a line made empty after pricing is refused at Send, shows the sentence and is focused', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')
      addLine('Fries', 'Side')
      await getPrice()

      fireEvent.change(nameInput(2), { target: { value: '  ' } })
      // Still priced: items are not on the quote.
      tap(screen.getByRole('button', { name: 'Send order' }))

      expect(await screen.findByText('Name the item, or remove the line.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).toBe(nameInput(2)))
      expect(mockConfirmDelivery).not.toHaveBeenCalled()
      // The price stays, so fixing the line and sending again works.
      fireEvent.change(nameInput(2), { target: { value: 'Chips' } })
      tap(screen.getByRole('button', { name: 'Send order' }))
      await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))
      expect(mockConfirmDelivery.mock.calls[0][0].orderItems[1]).toEqual({ name: 'Chips', quantity: 1, kind: 'SIDE' })
    })

    it('an empty line added after pricing is refused at Send too', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      await getPrice()

      fireEvent.click(screen.getByRole('button', { name: 'Add items (optional)' }))
      tap(screen.getByRole('button', { name: 'Send order' }))

      expect(await screen.findByText('Name the item, or remove the line.')).toBeInTheDocument()
      await waitFor(() => expect(document.activeElement).toBe(nameInput(1)))
      expect(mockConfirmDelivery).not.toHaveBeenCalled()
    })
  })

  describe('the second Send guard (spec 0006 AC-15) with item lines', () => {
    it('Send shows "Sending…" disabled in the same tick, and a second tap sends nothing', async () => {
      let resolveConfirm: (value: any) => void = () => {}
      mockConfirmDelivery.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfirm = resolve
          }),
      )
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')
      const sendBtn = await getPrice()

      fireEvent.click(sendBtn)
      const sending = screen.getByRole('button', { name: /Sending…/i })
      expect(sending).toBeDisabled()
      fireEvent.click(sending)
      fireEvent.click(sendBtn)

      await act(async () => {
        await Promise.resolve()
      })
      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveConfirm({ id: 'del-items-guard', status: 'ACCEPTED' })
      })
      expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-items-guard')
      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
    })

    it('two taps on Send in a row create one delivery', async () => {
      render(<CreateDeliveryForm />)
      fillOrder()
      addLine('Cola', 'Drink')
      const sendBtn = await getPrice()

      fireEvent.click(sendBtn)
      fireEvent.click(sendBtn)

      await waitFor(() => expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalled())
      expect(mockConfirmDelivery).toHaveBeenCalledTimes(1)
    })
  })
})
