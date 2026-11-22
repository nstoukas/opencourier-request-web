// Spec 0043 (row 9, AC-4, cross checks 4 & 5): box size on the order form.
// Every delivery carries a required box size (Small, Medium, Large) picked by the restaurant.
// No default is chosen at open; descriptions appear under the pills and are linked by aria-describedby.
// boxSize is sent on the delivery creation payload only, never on the quote request.
// Changing box size after pricing drops the price back to "Get price".
import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  CreateDeliveryForm,
  BOX_SIZE_REQUIRED,
  BOX_SIZE_DESCRIPTIONS,
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
import { createI18n } from '../../../i18n/createI18n'

const t = createI18n('en').t

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

describe('CreateDeliveryForm box size (spec 0043, row 9, AC-4)', () => {
  const mockCreateQuote = jest.fn()
  const mockConfirmDelivery = jest.fn()
  const mockNavigator = { goToManualRequestStatus: jest.fn() }

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
    ;(useSavedCustomerSearch as jest.Mock).mockReturnValue({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ savedCustomerRetentionMonths: 12 }),
    })
    mockCreateQuote.mockResolvedValue({
      id: 'quote-box-test',
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
    mockConfirmDelivery.mockResolvedValue({ id: 'del-box-test', status: 'ACCEPTED' })
  })

  // Fill customer, prep time, and total, but leave box size untouched
  function fillFormExceptBoxSize() {
    fireEvent.click(screen.getByText('Vassilis Spanoulis').closest('[role="option"]')!)
    fireEvent.click(screen.getByRole('radio', { name: 'Now' }))
    fireEvent.change(screen.getByLabelText(/Order total/i), { target: { value: '15' } })
  }

  it('the pills read "Box size" with Small, Medium, Large and none is chosen when the form opens (a preset would make the test fail)', () => {
    render(<CreateDeliveryForm />)

    const group = screen.getByRole('radiogroup', { name: 'Box size' })
    expect(group).toBeInTheDocument()

    const pills = within(group).getAllByRole('radio')
    expect(pills.map((pill) => pill.textContent)).toEqual(['Small', 'Medium', 'Large'])

    // No pill is chosen at the start: decision 9.7 (a preset Small would quietly send a big bag as small)
    const checkedPills = group.querySelectorAll('button[role="radio"][data-state="checked"]')
    expect(checkedPills).toHaveLength(0)
  })

  it('Get price without a size shows "Choose the box size", focuses the size pills, and asks for no quote', async () => {
    const scrollIntoView = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<CreateDeliveryForm />)
    fillFormExceptBoxSize()

    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

    // Refusal sentence shown
    expect(await screen.findByText(t(BOX_SIZE_REQUIRED))).toBeInTheDocument()
    expect(screen.getByText('Choose the box size')).toBeInTheDocument()

    // No quote requested
    expect(mockCreateQuote).not.toHaveBeenCalled()

    // Focuses the size pills (ChoicePills focuses the first pill when none is chosen)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Small' }))
    })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  it('the three description lines show under the pills, linked to the group by aria-describedby', () => {
    render(<CreateDeliveryForm />)

    // Three fixed description lines defined by spec 0043 cross check 5
    expect(screen.getByText('Small: one meal or a coffee')).toBeInTheDocument()
    expect(screen.getByText('Medium: a full bag')).toBeInTheDocument()
    expect(screen.getByText('Large: fills the box')).toBeInTheDocument()

    const group = screen.getByRole('radiogroup', { name: 'Box size' })
    const describedBy = group.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()

    // The element identified by aria-describedby contains the descriptions
    const descElement = document.getElementById(describedBy!)
    expect(descElement).toBeInTheDocument()
    expect(descElement).toHaveTextContent('Small: one meal or a coffee')
    expect(descElement).toHaveTextContent('Medium: a full bag')
    expect(descElement).toHaveTextContent('Large: fills the box')
  })

  it('Send carries boxSize equal to the chosen size on the delivery request; the quote request never carries boxSize', async () => {
    render(<CreateDeliveryForm />)
    fillFormExceptBoxSize()

    // Choose Medium box size
    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }))

    // Get price
    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledTimes(1))

    // Cross check 4: boxSize rides on the create body, not on the quote
    const quotePayload = mockCreateQuote.mock.calls[0][0]
    expect(quotePayload.boxSize).toBeUndefined()
    expect(quotePayload).not.toHaveProperty('boxSize')

    // Send order
    const sendBtn = await screen.findByRole('button', { name: 'Send order' })
    fireEvent.click(sendBtn)

    await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))

    // AC-4: delivery carries boxSize
    const deliveryPayload = mockConfirmDelivery.mock.calls[0][0]
    expect(deliveryPayload.boxSize).toBe(ManualRequestPackageSize.MEDIUM)
  })

  it('changing the size after a price drops the price (back to Get price), so Send can never carry an old size', async () => {
    render(<CreateDeliveryForm />)
    fillFormExceptBoxSize()

    // Initially choose Small
    fireEvent.click(screen.getByRole('radio', { name: 'Small' }))

    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
    expect(await screen.findByRole('button', { name: 'Send order' })).toBeInTheDocument()

    // Changing box size to Large drops the price immediately
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }))

    expect(screen.queryByRole('button', { name: 'Send order' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get price' })).toBeInTheDocument()

    // Re-pricing and sending carries the new size (Large), never the old size (Small)
    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))
    const sendBtn = await screen.findByRole('button', { name: 'Send order' })
    fireEvent.click(sendBtn)

    await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledTimes(1))
    expect(mockConfirmDelivery.mock.calls[0][0].boxSize).toBe(ManualRequestPackageSize.LARGE)
  })

  it('after a successful Send the next order starts with no size chosen', async () => {
    const { unmount } = render(<CreateDeliveryForm />)
    fillFormExceptBoxSize()

    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }))
    fireEvent.click(screen.getByRole('button', { name: 'Get price' }))

    const sendBtn = await screen.findByRole('button', { name: 'Send order' })
    fireEvent.click(sendBtn)

    await waitFor(() => expect(mockNavigator.goToManualRequestStatus).toHaveBeenCalledWith('del-box-test'))

    // The app never shows that form again after Send: the page moves to the order's status page.
    // The next order is a fresh form, which must start with no size chosen.
    unmount()
    render(<CreateDeliveryForm />)

    const group = screen.getByRole('radiogroup', { name: 'Box size' })
    const checkedPills = group.querySelectorAll('button[role="radio"][data-state="checked"]')
    expect(checkedPills).toHaveLength(0)
  })

  it('BOX_SIZE_DESCRIPTIONS exports the fixed strings for all three sizes in order', () => {
    expect(BOX_SIZE_DESCRIPTIONS).toEqual([
      { size: ManualRequestPackageSize.SMALL, text: 'form.sizeSmallHint' },
      { size: ManualRequestPackageSize.MEDIUM, text: 'form.sizeMediumHint' },
      { size: ManualRequestPackageSize.LARGE, text: 'form.sizeLargeHint' },
    ])
    expect(BOX_SIZE_DESCRIPTIONS.map((d) => ({ size: d.size, text: t(d.text) }))).toEqual([
      { size: ManualRequestPackageSize.SMALL, text: 'Small: one meal or a coffee' },
      { size: ManualRequestPackageSize.MEDIUM, text: 'Medium: a full bag' },
      { size: ManualRequestPackageSize.LARGE, text: 'Large: fills the box' },
    ])
  })
})
