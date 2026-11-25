import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createI18n } from '../../i18n/createI18n'
import { EditDeliveryDialog } from './EditDeliveryDialog'
import { fetchPartnerDelivery, useUpdateManualRequestDeliveryMutation } from '../../api/manualRequestApi'
import { REQUEST_TIMEOUT_CODE } from '../../i18n/serverText'
import { PartnerDeliveryDto, PartnerDeliveryDropoffDto, PartnerDeliveryPickupDto } from '../manual-request/types'

// Mock the manualRequestApi functions used by EditDeliveryDialog.
const mockUpdateDelivery = jest.fn()
const mockFetchPartnerDelivery = jest.fn()

function mockPickup(fields: Partial<PartnerDeliveryPickupDto> = {}): PartnerDeliveryPickupDto {
  return {
    id: 'pic-1',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Volos',
    city: 'Volos',
    state: 'Magnesia',
    pickupName: 'Restaurant',
    pickupPhoneNumber: '2421000000',
    pickupBusinessName: 'Restaurant Co',
    pickupNotes: '',
    ...fields,
  }
}

function mockDropoff(fields: Partial<PartnerDeliveryDropoffDto> = {}): PartnerDeliveryDropoffDto {
  return {
    id: 'drp-1',
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Volos',
    city: 'Volos',
    state: 'Magnesia',
    dropoffName: 'Customer',
    dropoffPhoneNumber: '6900000000',
    dropoffBusinessName: '',
    dropoffNotes: '',
    ...fields,
  }
}

jest.mock('../../api/manualRequestApi', () => ({
  fetchPartnerDelivery: (...args: any[]) => mockFetchPartnerDelivery(...args),
  useUpdateManualRequestDeliveryMutation: () => {
    const [isLoading, setIsLoading] = React.useState(false)
    const trigger = React.useCallback(async (vars: any) => {
      setIsLoading(true)
      try {
        return await mockUpdateDelivery(vars)
      } finally {
        setIsLoading(false)
      }
    }, [])
    return [trigger, { isLoading }]
  },
}))

function mockDelivery(fields: Partial<PartnerDeliveryDto> = {}): PartnerDeliveryDto {
  return {
    id: 'del-1',
    status: 'ACCEPTED',
    orderReference: 'ORD-1',
    currencyCode: 'EUR',
    totalCost: 500,
    createdAt: '2026-11-25T10:00:00.000Z',
    pickupReadyAt: '2026-11-25T10:15:00.000Z',
    readyAt: null,
    foodReadyAt: null,
    dropoffEta: null,
    pickupDeadlineAt: '2026-11-25T11:00:00.000Z',
    dropoffReadyAt: '2026-11-25T10:30:00.000Z',
    dropoffDeadlineAt: '2026-11-25T11:30:00.000Z',
    pickup: mockPickup(),
    dropoff: mockDropoff(),
    ...fields,
  }
}

describe('EditDeliveryDialog (Row 165: after a refused edit, the portal shows the order as it is now)', () => {
  const onClose = jest.fn()
  const onSaved = jest.fn()

  const initialDelivery: PartnerDeliveryDto = mockDelivery({
    id: 'del-old-1',
    orderReference: 'ORD-OLD-REF',
    pickupReadyAt: '2026-11-25T10:15:00.000Z',
    pickupDeadlineAt: '2026-11-25T11:00:00.000Z',
    dropoffReadyAt: '2026-11-25T10:30:00.000Z',
    dropoffDeadlineAt: '2026-11-25T11:30:00.000Z',
    pickup: mockPickup({
      pickupNotes: 'Old pickup instructions',
    }),
    dropoff: mockDropoff({
      dropoffNotes: 'Old dropoff instructions',
      latitude: 39.361,
      longitude: 22.941,
    }),
  })

  const reloadedDelivery: PartnerDeliveryDto = mockDelivery({
    id: 'del-reloaded-2',
    orderReference: 'ORD-RELOADED-REF',
    totalCost: 650,
    pickupReadyAt: '2026-11-25T10:45:00.000Z',
    pickupDeadlineAt: '2026-11-25T12:00:00.000Z',
    dropoffReadyAt: '2026-11-25T11:45:00.000Z',
    dropoffDeadlineAt: '2026-11-25T12:45:00.000Z',
    pickup: mockPickup({
      pickupNotes: 'Current pickup instructions from backend',
    }),
    dropoff: mockDropoff({
      dropoffNotes: 'Current dropoff instructions from backend',
      latitude: 39.385,
      longitude: 22.965,
    }),
  })

  beforeEach(() => {
    jest.resetAllMocks()
  })

  // Helper to query all edit inputs from the dialog DOM (rendered via portal into document.body)
  function getInputs() {
    return {
      orderRef: document.querySelector('#edit-order-ref') as HTMLInputElement,
      pickupNotes: document.querySelector('#edit-pickup-notes') as HTMLTextAreaElement,
      pickupDeadline: document.querySelector('#edit-pickup-deadline') as HTMLInputElement,
      dropoffNotes: document.querySelector('#edit-dropoff-notes') as HTMLTextAreaElement,
      dropoffReady: document.querySelector('#edit-dropoff-ready') as HTMLInputElement,
      dropoffDeadline: document.querySelector('#edit-dropoff-deadline') as HTMLInputElement,
    }
  }

  describe('Clause 1: reload on each of the three server refusals (PARTNER_EDIT_ORDER_ENDED, PARTNER_EDIT_POINT_HELD, PARTNER_EDIT_CHANGED)', () => {
    it('after PARTNER_EDIT_ORDER_ENDED refusal, rereads order and fills boxes with current values, showing refusal and editReloaded in English', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_ORDER_ENDED',
        message: 'This order has ended, so it can no longer be changed.',
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      const { container } = render(
        <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />,
      )

      const inputsBefore = getInputs()
      expect(inputsBefore.orderRef.value).toBe('ORD-OLD-REF')
      expect(inputsBefore.pickupNotes.value).toBe('Old pickup instructions')

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      // Refusal sentence stays shown
      expect(
        screen.getByText('This order has ended, so it can no longer be changed.'),
      ).toBeInTheDocument()

      // The line orders.editReloaded shows
      expect(screen.getByText('The boxes now show the order as it is.')).toBeInTheDocument()

      // The boxes now show the current values read again with fetchPartnerDelivery
      const inputsAfter = getInputs()
      expect(inputsAfter.orderRef.value).toBe('ORD-RELOADED-REF')
      expect(inputsAfter.pickupNotes.value).toBe('Current pickup instructions from backend')
      expect(inputsAfter.pickupDeadline.value).toBe('2026-11-25T12:00')
      expect(inputsAfter.dropoffNotes.value).toBe('Current dropoff instructions from backend')
      expect(inputsAfter.dropoffReady.value).toBe('2026-11-25T11:45')
      expect(inputsAfter.dropoffDeadline.value).toBe('2026-11-25T12:45')

      // Assert they are not the old values
      expect(inputsAfter.orderRef.value).not.toBe('ORD-OLD-REF')
      expect(inputsAfter.pickupNotes.value).not.toBe('Old pickup instructions')
      expect(inputsAfter.pickupDeadline.value).not.toBe('2026-11-25T11:00')
      expect(inputsAfter.dropoffNotes.value).not.toBe('Old dropoff instructions')
      expect(inputsAfter.dropoffReady.value).not.toBe('2026-11-25T10:30')
      expect(inputsAfter.dropoffDeadline.value).not.toBe('2026-11-25T11:30')
    })

    it('after PARTNER_EDIT_POINT_HELD refusal, rereads order and fills boxes with current values, showing refusal and editReloaded in English', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_POINT_HELD',
        message: "A rider is already on this order, so its drop off point can't move. Message dispatch to change it.",
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      const { container } = render(
        <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      expect(
        screen.getByText(
          "A rider is already on this order, so its drop off point can't move. Message dispatch to change it.",
        ),
      ).toBeInTheDocument()
      expect(screen.getByText('The boxes now show the order as it is.')).toBeInTheDocument()

      const inputs = getInputs()
      expect(inputs.orderRef.value).toBe('ORD-RELOADED-REF')
      expect(inputs.pickupNotes.value).toBe('Current pickup instructions from backend')
      expect(inputs.pickupDeadline.value).toBe('2026-11-25T12:00')
      expect(inputs.dropoffNotes.value).toBe('Current dropoff instructions from backend')
      expect(inputs.dropoffReady.value).toBe('2026-11-25T11:45')
      expect(inputs.dropoffDeadline.value).toBe('2026-11-25T12:45')
    })

    it('after PARTNER_EDIT_CHANGED refusal, rereads order and fills boxes with current values, showing refusal and editReloaded in English', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_CHANGED',
        message: 'This order just changed. Look again before you save.',
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      const { container } = render(
        <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      expect(
        screen.getByText('This order just changed. Look again before you save.'),
      ).toBeInTheDocument()
      expect(screen.getByText('The boxes now show the order as it is.')).toBeInTheDocument()

      const inputs = getInputs()
      expect(inputs.orderRef.value).toBe('ORD-RELOADED-REF')
      expect(inputs.pickupNotes.value).toBe('Current pickup instructions from backend')
      expect(inputs.pickupDeadline.value).toBe('2026-11-25T12:00')
      expect(inputs.dropoffNotes.value).toBe('Current dropoff instructions from backend')
      expect(inputs.dropoffReady.value).toBe('2026-11-25T11:45')
      expect(inputs.dropoffDeadline.value).toBe('2026-11-25T12:45')
    })

    it('renders the refusal message and orders.editReloaded in Greek for each refusal code', async () => {
      const i18nEl = createI18n('el')

      // 1. PARTNER_EDIT_CHANGED in Greek
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_CHANGED',
        message: 'This order just changed. Look again before you save.',
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      const { unmount } = render(
        <I18nextProvider i18n={i18nEl}>
          <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση αλλαγών' }))

      await waitFor(() => {
        expect(
          screen.getByText('Η παραγγελία μόλις άλλαξε. Δείτε την ξανά πριν αποθηκεύσετε.'),
        ).toBeInTheDocument()
      })
      expect(
        screen.getByText('Τα πεδία δείχνουν τώρα την παραγγελία όπως είναι.'),
      ).toBeInTheDocument()
      unmount()

      // 2. PARTNER_EDIT_ORDER_ENDED in Greek
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_ORDER_ENDED',
        message: 'This order has ended, so it can no longer be changed.',
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      const render2 = render(
        <I18nextProvider i18n={i18nEl}>
          <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση αλλαγών' }))

      await waitFor(() => {
        expect(
          screen.getByText('Αυτή η παραγγελία έχει ολοκληρωθεί, οπότε δεν αλλάζει πια.'),
        ).toBeInTheDocument()
      })
      expect(
        screen.getByText('Τα πεδία δείχνουν τώρα την παραγγελία όπως είναι.'),
      ).toBeInTheDocument()
      render2.unmount()

      // 3. PARTNER_EDIT_POINT_HELD in Greek
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_POINT_HELD',
        message: "A rider is already on this order, so its drop off point can't move. Message dispatch to change it.",
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      render(
        <I18nextProvider i18n={i18nEl}>
          <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση αλλαγών' }))

      await waitFor(() => {
        expect(
          screen.getByText(
            'Ένας διανομέας έχει ήδη αναλάβει αυτή την παραγγελία, οπότε το σημείο παράδοσης δεν μετακινείται. Στείλτε μήνυμα στη διανομή για να το αλλάξετε.',
          ),
        ).toBeInTheDocument()
      })
      expect(
        screen.getByText('Τα πεδία δείχνουν τώρα την παραγγελία όπως είναι.'),
      ).toBeInTheDocument()
    })
  })

  describe('Clause 2: second save after reload sends reloaded order values (id, coordinates, stored pickupReadyAt)', () => {
    it('sends the reloaded order’s id, dropoff coordinates and stored pickupReadyAt on a second save', async () => {
      // First save fails with refusal
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_CHANGED',
        message: 'This order just changed. Look again before you save.',
      })
      mockFetchPartnerDelivery.mockResolvedValueOnce(reloadedDelivery)

      const { container } = render(
        <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />,
      )

      // First click -> refusal -> reload
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      // The boxes are updated to reloaded values
      const inputs = getInputs()
      expect(inputs.orderRef.value).toBe('ORD-RELOADED-REF')

      // Second save succeeds
      mockUpdateDelivery.mockResolvedValueOnce({ id: 'del-reloaded-2', status: 'ACCEPTED' })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(2)
      })

      // Check first save sent initial delivery values
      expect(mockUpdateDelivery).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          deliveryId: 'del-old-1',
          dropoffLatitude: 39.361,
          dropoffLongitude: 22.941,
          pickupReadyAt: '2026-11-25T10:15:00.000Z',
          orderReference: 'ORD-OLD-REF',
        }),
      )

      // Check second save sent RELOADED delivery values:
      // - reloaded delivery id ('del-reloaded-2')
      // - reloaded dropoff coordinates (39.385, 22.965)
      // - reloaded stored pickupReadyAt ('2026-11-25T10:45:00.000Z')
      // - reloaded order reference and notes
      expect(mockUpdateDelivery).toHaveBeenNthCalledWith(2, {
        deliveryId: 'del-reloaded-2',
        orderReference: 'ORD-RELOADED-REF',
        pickupNotes: 'Current pickup instructions from backend',
        pickupReadyAt: '2026-11-25T10:45:00.000Z',
        pickupDeadlineAt: new Date('2026-11-25T12:00').toISOString(),
        dropoffNotes: 'Current dropoff instructions from backend',
        dropoffLatitude: 39.385,
        dropoffLongitude: 22.965,
        dropoffReadyAt: new Date('2026-11-25T11:45').toISOString(),
        dropoffDeadlineAt: new Date('2026-11-25T12:45').toISOString(),
      })

      expect(onSaved).toHaveBeenCalledTimes(1)
    })
  })

  describe('Clause 3: successful save, network failure, and failed reread', () => {
    it('a successful save calls onSaved and does not reread the order', async () => {
      mockUpdateDelivery.mockResolvedValueOnce({ id: 'del-old-1', status: 'ACCEPTED' })

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
    })

    it('a network failure (no server sentence) keeps typed values and does not reread', async () => {
      // Simulating a network error or failure with NO_ANSWER_CODE
      mockUpdateDelivery.mockRejectedValueOnce({
        code: 'NO_ANSWER',
        message: '',
      })

      const { container } = render(
        <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />,
      )

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-123' } })
      fireEvent.change(inputs.pickupNotes, { target: { value: 'Custom typed pickup note' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      // Update failed message is shown
      expect(screen.getByText('Update failed.')).toBeInTheDocument()

      // Does not reread
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()

      // Keeps restaurant's typed values
      expect(inputs.orderRef.value).toBe('TYPED-REF-123')
      expect(inputs.pickupNotes.value).toBe('Custom typed pickup note')
      expect(onSaved).not.toHaveBeenCalled()
    })

    it('a failed reread keeps the typed values and the refusal stays shown', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_CHANGED',
        message: 'This order just changed. Look again before you save.',
      })
      // Reread fails (e.g. network timeout or 500)
      mockFetchPartnerDelivery.mockRejectedValueOnce(new Error('Reread failed'))

      const { container } = render(
        <EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />,
      )

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-456' } })
      fireEvent.change(inputs.dropoffNotes, { target: { value: 'Custom typed dropoff note' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      // Refusal shows
      expect(
        screen.getByText('This order just changed. Look again before you save.'),
      ).toBeInTheDocument()

      // Reload line does not show because reload failed
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()

      // Typed values are preserved
      expect(inputs.orderRef.value).toBe('TYPED-REF-456')
      expect(inputs.dropoffNotes.value).toBe('Custom typed dropoff note')
      expect(onSaved).not.toHaveBeenCalled()
    })
  })

  describe('Clause 4: non-reread failures (timeout, uncoded 409, validation 400, coded refusal outside the three) keep typed values and do not reread', () => {
    it('a timeout (REQUEST_TIMEOUT) shows common.requestTimedOut, keeps typed values, and does not reread', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        code: REQUEST_TIMEOUT_CODE,
        message: 'Request timed out after 12s. Check backend availability and token.',
      })

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-TIMEOUT' } })
      fireEvent.change(inputs.pickupNotes, { target: { value: 'Custom pickup note during timeout' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      // Timeout message from common.requestTimedOut shows
      expect(
        screen.getByText('The server did not answer in time. Please try again in a moment.'),
      ).toBeInTheDocument()

      // fetchPartnerDelivery is NOT called
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()

      // Typed values stay intact
      expect(inputs.orderRef.value).toBe('TYPED-REF-TIMEOUT')
      expect(inputs.pickupNotes.value).toBe('Custom pickup note during timeout')

      // Reloaded line does not show
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
      expect(onSaved).not.toHaveBeenCalled()
    })

    it('an uncoded 409 error shows the error message, keeps typed values, and does not reread', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        message: 'Conflict: some other operation is in progress.',
      })

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-UNCODED-409' } })
      fireEvent.change(inputs.dropoffNotes, { target: { value: 'Custom dropoff note for 409' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      // The server's uncoded message shows
      expect(
        screen.getByText('Conflict: some other operation is in progress.'),
      ).toBeInTheDocument()

      // fetchPartnerDelivery is NOT called
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()

      // Typed values stay intact
      expect(inputs.orderRef.value).toBe('TYPED-REF-UNCODED-409')
      expect(inputs.dropoffNotes.value).toBe('Custom dropoff note for 409')

      // Reloaded line does not show
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
      expect(onSaved).not.toHaveBeenCalled()
    })

    it('a validation 400 with a sentence shows the message, keeps typed values, and does not reread', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 400,
        message: 'pickupDeadlineAt must be a Date instance',
      })

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-VAL-400' } })
      fireEvent.change(inputs.pickupNotes, { target: { value: 'Custom pickup note for 400' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      // Validation error message shows
      expect(screen.getByText('pickupDeadlineAt must be a Date instance')).toBeInTheDocument()

      // fetchPartnerDelivery is NOT called
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()

      // Typed values stay intact
      expect(inputs.orderRef.value).toBe('TYPED-REF-VAL-400')
      expect(inputs.pickupNotes.value).toBe('Custom pickup note for 400')

      // Reloaded line does not show
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
      expect(onSaved).not.toHaveBeenCalled()
    })

    it('a coded refusal not in the three (drift refusal) shows the message, keeps typed values, and does not reread', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 400,
        code: 'DELIVERY_DROPOFF_LOCATION_DRIFT',
        message: "Delivery dropoff location doesn't match quote location",
      })

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-DRIFT' } })
      fireEvent.change(inputs.dropoffNotes, { target: { value: 'Custom dropoff note for drift' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      // Refusal message shows
      expect(
        screen.getByText("Delivery dropoff location doesn't match quote location"),
      ).toBeInTheDocument()

      // fetchPartnerDelivery is NOT called
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()

      // Typed values stay intact
      expect(inputs.orderRef.value).toBe('TYPED-REF-DRIFT')
      expect(inputs.dropoffNotes.value).toBe('Custom dropoff note for drift')

      // Reloaded line does not show
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
      expect(onSaved).not.toHaveBeenCalled()
    })

    it('a coded 409 refusal outside the three (LEG_LABELS_LOCKED) shows the message, keeps typed values, and does not reread', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'LEG_LABELS_LOCKED',
        message: 'This delivery is one leg of an order: its order reference and leg numbers cannot change.',
      })

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const inputs = getInputs()
      fireEvent.change(inputs.orderRef, { target: { value: 'TYPED-REF-LOCKED' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateDelivery).toHaveBeenCalledTimes(1)
      })

      // Refusal message shows
      expect(
        screen.getByText(
          'This delivery is one leg of an order: its order reference and leg numbers cannot change.',
        ),
      ).toBeInTheDocument()

      // fetchPartnerDelivery is NOT called
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()

      // Typed values stay intact
      expect(inputs.orderRef.value).toBe('TYPED-REF-LOCKED')

      // Reloaded line does not show
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
      expect(onSaved).not.toHaveBeenCalled()
    })
  })

  describe('Clause 5: Save button disabled while reread is pending after refusal', () => {
    it('Save button is disabled while fetchPartnerDelivery is pending after refusal, and re-enabled after it resolves', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_CHANGED',
        message: 'This order just changed. Look again before you save.',
      })

      // A deferred promise so we can control when fetchPartnerDelivery finishes
      let resolveReread!: (value: PartnerDeliveryDto) => void
      const rereadPromise = new Promise<PartnerDeliveryDto>((resolve) => {
        resolveReread = resolve
      })
      mockFetchPartnerDelivery.mockReturnValueOnce(rereadPromise)

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const saveButton = screen.getByRole('button', { name: 'Save changes' })
      expect(saveButton).toBeEnabled()

      fireEvent.click(saveButton)

      // Wait until fetchPartnerDelivery has been triggered
      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      // While fetchPartnerDelivery is pending, Save button must be disabled
      expect(saveButton).toBeDisabled()

      // Settle the reread promise (resolve)
      resolveReread(reloadedDelivery)

      // Once reread settles, Save button is enabled again
      await waitFor(() => {
        expect(saveButton).toBeEnabled()
      })

      // Reloaded line shows
      expect(screen.getByText('The boxes now show the order as it is.')).toBeInTheDocument()
    })

    it('Save button is disabled while fetchPartnerDelivery is pending after refusal, and re-enabled after it rejects', async () => {
      mockUpdateDelivery.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PARTNER_EDIT_POINT_HELD',
        message: "A rider is already on this order, so its drop off point can't move. Message dispatch to change it.",
      })

      // A deferred promise for fetchPartnerDelivery that will reject
      let rejectReread!: (err: any) => void
      const rereadPromise = new Promise<PartnerDeliveryDto>((_resolve, reject) => {
        rejectReread = reject
      })
      mockFetchPartnerDelivery.mockReturnValueOnce(rereadPromise)

      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      const saveButton = screen.getByRole('button', { name: 'Save changes' })
      expect(saveButton).toBeEnabled()

      fireEvent.click(saveButton)

      // Wait until fetchPartnerDelivery has been triggered
      await waitFor(() => {
        expect(mockFetchPartnerDelivery).toHaveBeenCalledWith('del-old-1')
      })

      // While fetchPartnerDelivery is pending, Save button must be disabled
      expect(saveButton).toBeDisabled()

      // Settle the reread promise (reject)
      rejectReread(new Error('Network error during reread'))

      // Once reread settles (rejected), Save button is enabled again
      await waitFor(() => {
        expect(saveButton).toBeEnabled()
      })

      // Refusal stays shown, but reloaded line does not show
      expect(
        screen.getByText(
          "A rider is already on this order, so its drop off point can't move. Message dispatch to change it.",
        ),
      ).toBeInTheDocument()
      expect(screen.queryByText('The boxes now show the order as it is.')).not.toBeInTheDocument()
    })
  })

  describe('Dialog controls and validation', () => {
    it('clicking Cancel calls onClose without saving', () => {
      render(<EditDeliveryDialog delivery={initialDelivery} onClose={onClose} onSaved={onSaved} />)

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mockUpdateDelivery).not.toHaveBeenCalled()
      expect(onSaved).not.toHaveBeenCalled()
    })

    it('shows error if dropoff coordinates are missing and does not call updateDelivery', async () => {
      const deliveryWithoutCoords: PartnerDeliveryDto = {
        ...initialDelivery,
        dropoff: mockDropoff({
          dropoffNotes: 'Notes',
          latitude: null,
          longitude: null,
        }),
      }

      render(
        <EditDeliveryDialog delivery={deliveryWithoutCoords} onClose={onClose} onSaved={onSaved} />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(
        screen.getByText('Dropoff coordinates are missing — cannot update this delivery.'),
      ).toBeInTheDocument()
      expect(mockUpdateDelivery).not.toHaveBeenCalled()
      expect(mockFetchPartnerDelivery).not.toHaveBeenCalled()
    })
  })
})
