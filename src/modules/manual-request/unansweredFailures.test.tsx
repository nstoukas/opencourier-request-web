import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createI18n } from '../../i18n/createI18n'
import DeliveriesPage from '../../pages/manual-request/deliveries/index'
import { ReadyControls } from '../ready/ReadyControls'
import { OrderLegsSection } from '../legs/OrderLegsSection'
import {
  NO_ANSWER_CODE,
  REQUEST_TIMEOUT_CODE,
} from '../../i18n/serverText'
import {
  fetchPartnerDelivery,
  delayDeliveryReady,
  useListManualRequestDeliveriesQuery,
  useUpdateManualRequestDeliveryMutation,
  useCancelManualRequestDeliveryMutation,
  usePartnerAvailabilityQuery,
  useWaitRecordQuery,
  fetchOrderLegs,
  requestQuote,
  createDelivery,
} from '../../api/manualRequestApi'

// Mock next/head & next/link
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

// Mock API functions and hooks
jest.mock('../../api/manualRequestApi', () => ({
  fetchPartnerDelivery: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
  useListManualRequestDeliveriesQuery: jest.fn(),
  useUpdateManualRequestDeliveryMutation: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
  usePartnerAvailabilityQuery: jest.fn(),
  useWaitRecordQuery: jest.fn(),
  fetchOrderLegs: jest.fn(),
  requestQuote: jest.fn(),
  createDelivery: jest.fn(),
}))

describe('Unanswered failures in Greek (Row 151)', () => {
  const i18nEl = createI18n('el')
  const i18nEn = createI18n('en')

  const FORBIDDEN_DEVELOPER_WORDS = [
    'Request failed (HTTP 500)',
    'Backend unreachable.',
    'Internal server error',
  ]

  function assertNoDeveloperWords(container: HTMLElement = document.body) {
    for (const phrase of FORBIDDEN_DEVELOPER_WORDS) {
      expect(container.textContent).not.toContain(phrase)
    }
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(usePartnerAvailabilityQuery as jest.Mock).mockReturnValue({ availability: undefined, refetch: jest.fn() })
    ;(useWaitRecordQuery as jest.Mock).mockReturnValue({ data: undefined, error: undefined, isLoading: false, refetch: jest.fn() })
  })

  describe('1. Order list (/manual-request/deliveries)', () => {
    it('shows page sentence in Greek when list load fails with 500 no body (NO_ANSWER_CODE)', () => {
      const error500 = Object.assign(new Error('Request failed (HTTP 500)'), {
        statusCode: 500,
        code: NO_ANSWER_CODE,
      })

      ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: error500,
        refetch: jest.fn(),
      })

      render(
        <I18nextProvider i18n={i18nEl}>
          <DeliveriesPage />
        </I18nextProvider>,
      )

      expect(screen.getByText('Οι διανομές δεν φόρτωσαν. Ελέγξτε τα στοιχεία σύνδεσης και δοκιμάστε ξανά.')).toBeInTheDocument()
      assertNoDeveloperWords()
    })

    it('shows page sentence in Greek when list load fails with proxy 502 (NO_ANSWER_CODE)', () => {
      const error502 = Object.assign(new Error('Backend unreachable.'), {
        statusCode: 502,
        code: NO_ANSWER_CODE,
      })

      ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: error502,
        refetch: jest.fn(),
      })

      render(
        <I18nextProvider i18n={i18nEl}>
          <DeliveriesPage />
        </I18nextProvider>,
      )

      expect(screen.getByText('Οι διανομές δεν φόρτωσαν. Ελέγξτε τα στοιχεία σύνδεσης και δοκιμάστε ξανά.')).toBeInTheDocument()
      assertNoDeveloperWords()
    })

    it('shows timeout sentence in Greek when list load times out (REQUEST_TIMEOUT_CODE)', () => {
      const errorTimeout = Object.assign(new Error('Request timed out after 12s.'), {
        code: REQUEST_TIMEOUT_CODE,
      })

      ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: errorTimeout,
        refetch: jest.fn(),
      })

      render(
        <I18nextProvider i18n={i18nEl}>
          <DeliveriesPage />
        </I18nextProvider>,
      )

      expect(screen.getByText('Ο διακομιστής δεν απάντησε εγκαίρως. Δοκιμάστε ξανά σε λίγο.')).toBeInTheDocument()
      assertNoDeveloperWords()
    })
  })

  describe('2. Delivery Edit (load and save in DeliveriesPage)', () => {
    const singleDelivery = {
      id: 'del-1',
      orderReference: 'ORD-100',
      status: 'ACCEPTED',
      readyAt: '2026-11-24T12:00:00Z',
      foodReadyAt: null,
      createdAt: '2026-11-24T11:00:00Z',
      pickup: { pickupName: 'Nosh', city: 'Volos' },
      dropoff: { dropoffName: 'Customer', city: 'Volos', latitude: 39.36, longitude: 22.94 },
    }

    it('shows page sentence in Greek when edit load fails with NO_ANSWER_CODE', async () => {
      ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
        data: { data: [singleDelivery], pagination: { currentPage: 1, totalPages: 1 } },
        isLoading: false,
        error: undefined,
        refetch: jest.fn(),
      })

      const loadErr = Object.assign(new Error('Backend unreachable.'), {
        statusCode: 502,
        code: NO_ANSWER_CODE,
      })
      ;(fetchPartnerDelivery as jest.Mock).mockRejectedValue(loadErr)

      render(
        <I18nextProvider i18n={i18nEl}>
          <DeliveriesPage />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Επεξεργασία' }))

      expect(await screen.findByText('Τα στοιχεία της διανομής δεν φόρτωσαν.')).toBeInTheDocument()
      assertNoDeveloperWords()
    })

    it('shows page sentence in Greek when edit save fails with 500 no body (NO_ANSWER_CODE)', async () => {
      ;(useListManualRequestDeliveriesQuery as jest.Mock).mockReturnValue({
        data: { data: [singleDelivery], pagination: { currentPage: 1, totalPages: 1 } },
        isLoading: false,
        error: undefined,
        refetch: jest.fn(),
      })

      ;(fetchPartnerDelivery as jest.Mock).mockResolvedValue({
        ...singleDelivery,
        pickupDeadlineAt: '2026-11-24T13:00:00Z',
        dropoffReadyAt: null,
        dropoffDeadlineAt: '2026-11-24T14:00:00Z',
      })

      const saveErr = Object.assign(new Error('Internal server error'), {
        statusCode: 500,
        code: NO_ANSWER_CODE,
      })
      const mockUpdate = jest.fn().mockRejectedValue(saveErr)
      ;(useUpdateManualRequestDeliveryMutation as jest.Mock).mockReturnValue([mockUpdate, { isLoading: false }])

      render(
        <I18nextProvider i18n={i18nEl}>
          <DeliveriesPage />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Επεξεργασία' }))

      // Dialog opens
      const dialog = await screen.findByRole('dialog')
      const saveBtn = within(dialog).getByRole('button', { name: 'Αποθήκευση αλλαγών' })
      fireEvent.click(saveBtn)

      expect(await within(dialog).findByText('Η ενημέρωση απέτυχε.')).toBeInTheDocument()
      assertNoDeveloperWords(dialog)
    })
  })

  describe('3. Ready tap (ReadyControls)', () => {
    it('shows page sentence in Greek when ready delay fails with 500 / NO_ANSWER_CODE', async () => {
      const error500 = Object.assign(new Error('Request failed (HTTP 500)'), {
        statusCode: 500,
        code: NO_ANSWER_CODE,
      })
      ;(delayDeliveryReady as jest.Mock).mockRejectedValue(error500)

      render(
        <I18nextProvider i18n={i18nEl}>
          <ReadyControls
            deliveryId="del-1"
            order={{ status: 'ACCEPTED', readyAt: '2026-11-24T12:00:00Z', foodReadyAt: null }}
          />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: '+5' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Η ώρα ετοιμότητας δεν άλλαξε.')
      assertNoDeveloperWords(alert)
    })

    it('shows page sentence in Greek when ready delay fails with proxy 502 / NO_ANSWER_CODE', async () => {
      const error502 = Object.assign(new Error('Backend unreachable.'), {
        statusCode: 502,
        code: NO_ANSWER_CODE,
      })
      ;(delayDeliveryReady as jest.Mock).mockRejectedValue(error502)

      render(
        <I18nextProvider i18n={i18nEl}>
          <ReadyControls
            deliveryId="del-1"
            order={{ status: 'ACCEPTED', readyAt: '2026-11-24T12:00:00Z', foodReadyAt: null }}
          />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: '+10' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Η ώρα ετοιμότητας δεν άλλαξε.')
      assertNoDeveloperWords(alert)
    })
  })

  describe('4. Leg retry (OrderLegsSection)', () => {
    const legOne = {
      id: 'del-leg-1',
      orderReference: 'ORD-REF-1',
      legNumber: 1,
      legCount: 2,
      status: 'ACCEPTED',
      boxSize: 'MEDIUM',
      orderTotalValue: 1500,
      pickup: { name: 'Nosh', address: 'Ermou 1', latitude: 39.36, longitude: 22.94, notes: '' },
      dropoff: { name: 'Customer A', address: 'Iasonos 2', latitude: 39.361, longitude: 22.941, notes: '', phone: '+306912345678' },
    }

    it('shows page sentence in Greek when retry get price fails with NO_ANSWER_CODE', async () => {
      ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
        legs: [legOne],
        missingLegNumbers: [2],
      })

      const priceErr = Object.assign(new Error('Internal server error'), {
        statusCode: 500,
        code: NO_ANSWER_CODE,
      })
      ;(requestQuote as jest.Mock).mockRejectedValue(priceErr)

      render(
        <I18nextProvider i18n={i18nEl}>
          <OrderLegsSection deliveryId="del-leg-1" version={0} onChanged={jest.fn()} />
        </I18nextProvider>,
      )

      const missingSection = await screen.findByTestId('missing-leg-2')
      // Choose box size
      fireEvent.click(within(missingSection).getByRole('radio', { name: 'Μικρό' }))

      // Click retry price
      const retryBtn = within(missingSection).getByRole('button', { name: 'Ξανά: λήψη τιμής' })
      fireEvent.click(retryBtn)

      expect(await within(missingSection).findByText('Η τιμή δεν υπολογίστηκε. Δοκιμάστε ξανά.')).toBeInTheDocument()
      assertNoDeveloperWords(missingSection)
    })

    it('shows page sentence in Greek when retry send leg fails with proxy 502 / NO_ANSWER_CODE', async () => {
      ;(fetchOrderLegs as jest.Mock).mockResolvedValue({
        legs: [legOne],
        missingLegNumbers: [2],
      })

      ;(requestQuote as jest.Mock).mockResolvedValue({
        quoteId: 'quote-retry-2',
        feeCents: 350,
      })

      const sendErr = Object.assign(new Error('Backend unreachable.'), {
        statusCode: 502,
        code: NO_ANSWER_CODE,
      })
      ;(createDelivery as jest.Mock).mockRejectedValue(sendErr)

      render(
        <I18nextProvider i18n={i18nEl}>
          <OrderLegsSection deliveryId="del-leg-1" version={0} onChanged={jest.fn()} />
        </I18nextProvider>,
      )

      const missingSection = await screen.findByTestId('missing-leg-2')
      fireEvent.click(within(missingSection).getByRole('radio', { name: 'Μικρό' }))
      fireEvent.click(within(missingSection).getByRole('button', { name: 'Ξανά: λήψη τιμής' }))

      const sendBtn = await within(missingSection).findByRole('button', { name: /^Αποστολή:/ })
      fireEvent.click(sendBtn)

      expect(await within(missingSection).findByText('Σκέλος 2 από 2: δεν στάλθηκε. Δοκιμάστε ξανά.')).toBeInTheDocument()
      assertNoDeveloperWords(missingSection)
    })
  })
})
