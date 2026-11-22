// Spec 0052 (row 83, AC-3, AC-7): the "Complaint about the rider" section on the order page.
// Allows the restaurant to view complaints and their outcomes on an order, and to file
// a complaint (category + text, at most 1000 characters) on a delivered or cancelled order.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { RiderComplaintSection } from './RiderComplaintSection'
import {
  fetchOrderComplaints,
  fileRiderComplaint,
  PartnerComplaint,
} from '../../api/complaintsApi'
import { createI18n } from '../../i18n/createI18n'
import { COMPLAINT_TEXT as RAW_COMPLAINT_TEXT } from './complaintText'

const t = createI18n('en').t
const COMPLAINT_TEXT = new Proxy(RAW_COMPLAINT_TEXT, {
  get(target: any, prop: string) {
    const val = target[prop]
    return typeof val === 'string' ? t(val) : val
  },
})

jest.mock('../../api/complaintsApi', () => ({
  ...jest.requireActual('../../api/complaintsApi'),
  fetchOrderComplaints: jest.fn(),
  fileRiderComplaint: jest.fn(),
}))

const mockFetchOrderComplaints = fetchOrderComplaints as jest.MockedFunction<typeof fetchOrderComplaints>
const mockFileRiderComplaint = fileRiderComplaint as jest.MockedFunction<typeof fileRiderComplaint>

describe('RiderComplaintSection (spec 0052, AC-3, AC-7)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchOrderComplaints.mockResolvedValue([])
  })

  describe('Visibility and lifecycle', () => {
    it('renders nothing when order is still in-flight (e.g. ACCEPTED) and has no complaints', async () => {
      mockFetchOrderComplaints.mockResolvedValue([])

      const { container } = render(<RiderComplaintSection deliveryId="del-active" status="ACCEPTED" />)

      await waitFor(() => expect(mockFetchOrderComplaints).toHaveBeenCalledWith('del-active'))
      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByTestId('rider-complaint')).not.toBeInTheDocument()
    })

    it('renders existing complaints even if order status is still in-flight', async () => {
      const existing: PartnerComplaint = {
        id: 'c-1',
        deliveryId: 'del-active',
        category: 'LATE',
        text: 'Courier running late',
        status: 'OPEN',
        createdAt: '2026-11-22T01:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }
      mockFetchOrderComplaints.mockResolvedValue([existing])

      render(<RiderComplaintSection deliveryId="del-active" status="ACCEPTED" />)

      await waitFor(() => expect(screen.getByTestId('rider-complaint')).toBeInTheDocument())
      expect(screen.getByText('Courier running late')).toBeInTheDocument()
      // In-flight status cannot file new complaints
      expect(screen.queryByRole('button', { name: COMPLAINT_TEXT.open })).not.toBeInTheDocument()
    })

    it('renders filing trigger when order status is DROPPED_OFF and no complaint is open', async () => {
      mockFetchOrderComplaints.mockResolvedValue([])

      render(<RiderComplaintSection deliveryId="del-done" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('rider-complaint')).toBeInTheDocument())
      expect(screen.getByText(COMPLAINT_TEXT.sectionTitle)).toBeInTheDocument()
      expect(screen.getByText(COMPLAINT_TEXT.intro)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument()
    })

    it('allows filing when order status is CANCELED', async () => {
      mockFetchOrderComplaints.mockResolvedValue([])

      render(<RiderComplaintSection deliveryId="del-canc" status="CANCELED" />)

      await waitFor(() => expect(screen.getByTestId('rider-complaint')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument()
    })

    it('hides the "Complain about the rider" trigger when an open complaint exists', async () => {
      // AC-3 & cross check 6: one open complaint per filer per delivery
      const openComplaint: PartnerComplaint = {
        id: 'c-open',
        deliveryId: 'del-done',
        category: 'RUDE',
        text: 'Rider was rude',
        status: 'OPEN',
        createdAt: '2026-11-22T01:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }
      mockFetchOrderComplaints.mockResolvedValue([openComplaint])

      render(<RiderComplaintSection deliveryId="del-done" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('rider-complaint')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: COMPLAINT_TEXT.open })).not.toBeInTheDocument()
      expect(screen.getByText(COMPLAINT_TEXT.statusOpen)).toBeInTheDocument()
    })

    it('shows server refusal sentence when loading complaints fails with a 4xx error (Ruling 1)', async () => {
      // 4xx client errors (e.g. 404 order past retention) display the server's specific message
      mockFetchOrderComplaints.mockRejectedValue({
        statusCode: 404,
        message: 'This order is older than 30 days and can no longer be viewed.',
      })

      render(<RiderComplaintSection deliveryId="del-err" status="DROPPED_OFF" />)

      await waitFor(() =>
        expect(
          screen.getByText('This order is older than 30 days and can no longer be viewed.'),
        ).toBeInTheDocument(),
      )
    })

    it('shows fallback listFailed message when loading complaints fails with a network or 5xx error (Ruling 1)', async () => {
      // Raw network errors or timeouts must not leak internal transport words to the restaurant
      mockFetchOrderComplaints.mockRejectedValue(new Error('Backend history unreachable'))

      render(<RiderComplaintSection deliveryId="del-err" status="DROPPED_OFF" />)

      await waitFor(() =>
        expect(screen.getByText(COMPLAINT_TEXT.listFailed)).toBeInTheDocument(),
      )
      expect(screen.queryByText('Backend history unreachable')).not.toBeInTheDocument()
    })
  })

  describe('Displaying existing complaints and outcomes (AC-1, AC-7)', () => {
    it('renders an OPEN complaint with category label, creation date, text, and pending message', async () => {
      const complaint: PartnerComplaint = {
        id: 'c-open-1',
        deliveryId: 'del-1',
        category: 'FOOD_DAMAGED',
        text: 'Pizza was inverted in box',
        status: 'OPEN',
        createdAt: '2026-11-22T02:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }
      mockFetchOrderComplaints.mockResolvedValue([complaint])

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('order-complaint')).toBeInTheDocument())
      expect(screen.getByText(/Food damaged/)).toBeInTheDocument()
      expect(screen.getByText('Pizza was inverted in box')).toBeInTheDocument()
      expect(screen.getByText(COMPLAINT_TEXT.statusOpen)).toBeInTheDocument()
    })

    it('renders outcome and decision date when complaint status is DECIDED', async () => {
      const decidedComplaint: PartnerComplaint = {
        id: 'c-decided-1',
        deliveryId: 'del-1',
        category: 'LATE',
        text: '30 minutes late',
        status: 'DECIDED',
        createdAt: '2026-11-20T10:00:00Z',
        outcome: 'Co-op spoke with rider regarding flat tyre delay.',
        decidedAt: '2026-11-21T12:00:00Z',
        withdrawnReason: null,
        withdrawnAt: null,
      }
      mockFetchOrderComplaints.mockResolvedValue([decidedComplaint])

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('order-complaint')).toBeInTheDocument())
      expect(screen.getByText(/Outcome/)).toBeInTheDocument()
      expect(
        screen.getByText('Co-op spoke with rider regarding flat tyre delay.'),
      ).toBeInTheDocument()
      // Once decided, a restaurant can file another complaint if needed
      expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument()
    })

    it('renders withdrawn notice and reason when complaint status is WITHDRAWN', async () => {
      const withdrawnComplaint: PartnerComplaint = {
        id: 'c-withdrawn-1',
        deliveryId: 'del-1',
        category: 'OTHER',
        text: 'Wrong rider complaint',
        status: 'WITHDRAWN',
        createdAt: '2026-11-20T10:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: 'Restaurant called and confirmed mistake',
        withdrawnAt: '2026-11-21T09:00:00Z',
      }
      mockFetchOrderComplaints.mockResolvedValue([withdrawnComplaint])

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('order-complaint')).toBeInTheDocument())
      expect(screen.getByText(/Withdrawn by the co-op/)).toBeInTheDocument()
      expect(screen.getByText('Restaurant called and confirmed mistake')).toBeInTheDocument()
    })

    it('falls back to "Something else" for an unrecognized category code', async () => {
      const futureComplaint: PartnerComplaint = {
        id: 'c-fut',
        deliveryId: 'del-1',
        category: 'FUTURE_CATEGORY_CODE',
        text: 'Some issue',
        status: 'OPEN',
        createdAt: '2026-11-22T02:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }
      mockFetchOrderComplaints.mockResolvedValue([futureComplaint])

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('order-complaint')).toBeInTheDocument())
      expect(screen.getByText(/Something else/)).toBeInTheDocument()
      expect(screen.queryByText(/FUTURE_CATEGORY_CODE/)).not.toBeInTheDocument()
    })

    it('renders multiple complaints on the order newest first', async () => {
      const complaints: PartnerComplaint[] = [
        {
          id: 'c-2',
          deliveryId: 'del-1',
          category: 'RUDE',
          text: 'Second complaint text',
          status: 'OPEN',
          createdAt: '2026-11-22T02:00:00Z',
          outcome: null,
          decidedAt: null,
          withdrawnReason: null,
          withdrawnAt: null,
        },
        {
          id: 'c-1',
          deliveryId: 'del-1',
          category: 'LATE',
          text: 'First complaint text',
          status: 'DECIDED',
          createdAt: '2026-11-21T02:00:00Z',
          outcome: 'Settled',
          decidedAt: '2026-11-21T05:00:00Z',
          withdrawnReason: null,
          withdrawnAt: null,
        },
      ]
      mockFetchOrderComplaints.mockResolvedValue(complaints)

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getAllByTestId('order-complaint')).toHaveLength(2))
      const items = screen.getAllByTestId('order-complaint')
      expect(items[0]).toHaveTextContent('Second complaint text')
      expect(items[1]).toHaveTextContent('First complaint text')
    })
  })

  describe('Filing form interactions and validation (AC-3)', () => {
    it('opens form on clicking "Complain about the rider" and hides the trigger', async () => {
      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open }))

      expect(screen.getByText(COMPLAINT_TEXT.whatHappened)).toBeInTheDocument()
      expect(screen.getByLabelText(COMPLAINT_TEXT.textLabel)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: COMPLAINT_TEXT.send })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: COMPLAINT_TEXT.cancel })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: COMPLAINT_TEXT.open })).not.toBeInTheDocument()
    })

    it('renders the 4 category choices as a radiogroup', async () => {
      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      const radiogroup = screen.getByRole('radiogroup', { name: COMPLAINT_TEXT.whatHappened })
      expect(radiogroup).toBeInTheDocument()

      const lateBtn = within(radiogroup).getByRole('radio', { name: 'Late' })
      const rudeBtn = within(radiogroup).getByRole('radio', { name: 'Rude' })
      const damagedBtn = within(radiogroup).getByRole('radio', { name: 'Food damaged' })
      const otherBtn = within(radiogroup).getByRole('radio', { name: 'Something else' })

      expect(lateBtn).toHaveAttribute('aria-checked', 'false')
      expect(rudeBtn).toHaveAttribute('aria-checked', 'false')
      expect(damagedBtn).toHaveAttribute('aria-checked', 'false')
      expect(otherBtn).toHaveAttribute('aria-checked', 'false')

      // Select 'Late'
      fireEvent.click(lateBtn)
      expect(lateBtn).toHaveAttribute('aria-checked', 'true')
      expect(rudeBtn).toHaveAttribute('aria-checked', 'false')

      // Switch to 'Food damaged'
      fireEvent.click(damagedBtn)
      expect(damagedBtn).toHaveAttribute('aria-checked', 'true')
      expect(lateBtn).toHaveAttribute('aria-checked', 'false')
    })

    it('keeps "Send complaint" disabled until both category and non-whitespace text are present', async () => {
      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      const sendBtn = screen.getByRole('button', { name: COMPLAINT_TEXT.send })
      const textarea = screen.getByLabelText(COMPLAINT_TEXT.textLabel)
      const lateBtn = screen.getByRole('radio', { name: 'Late' })

      // Initially disabled
      expect(sendBtn).toBeDisabled()

      // Category only -> still disabled
      fireEvent.click(lateBtn)
      expect(sendBtn).toBeDisabled()

      // Whitespace only -> still disabled
      fireEvent.change(textarea, { target: { value: '   ' } })
      expect(sendBtn).toBeDisabled()

      // Real text with category -> enabled
      fireEvent.change(textarea, { target: { value: 'Rider took wrong turn' } })
      expect(sendBtn).toBeEnabled()
    })

    it('enforces character counter and max length of 1000', async () => {
      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      const textarea = screen.getByLabelText(COMPLAINT_TEXT.textLabel)
      expect(textarea).toHaveAttribute('maxLength', '1000')
      expect(screen.getByText('0/1000')).toBeInTheDocument()

      fireEvent.change(textarea, { target: { value: 'Soup was cold' } })
      expect(screen.getByText('13/1000')).toBeInTheDocument()
    })

    it('cancels the form and resets errors when Cancel is clicked', async () => {
      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.cancel }))

      expect(screen.queryByText(COMPLAINT_TEXT.whatHappened)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument()
    })
  })

  describe('Submitting a complaint (AC-3, AC-10)', () => {
    it('submits trimmed text when filing a complaint and reloads complaints on success', async () => {
      const createdComplaint: PartnerComplaint = {
        id: 'c-new-1',
        deliveryId: 'del-1',
        category: 'FOOD_DAMAGED',
        text: 'The soup container opened in bag',
        status: 'OPEN',
        createdAt: '2026-11-22T03:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }
      mockFileRiderComplaint.mockResolvedValue(createdComplaint)
      // First load: empty. Second load (after send): contains new complaint.
      mockFetchOrderComplaints
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([createdComplaint])

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('radio', { name: 'Food damaged' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: '  The soup container opened in bag  ' },
      })

      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      await waitFor(() => {
        expect(mockFileRiderComplaint).toHaveBeenCalledWith({
          deliveryId: 'del-1',
          category: 'FOOD_DAMAGED',
          text: 'The soup container opened in bag',
        })
      })

      // Success status is shown
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(COMPLAINT_TEXT.sent)
      })

      // Form is closed and complaints reloaded
      expect(screen.queryByLabelText(COMPLAINT_TEXT.textLabel)).not.toBeInTheDocument()
      expect(mockFetchOrderComplaints).toHaveBeenCalledTimes(2)
      expect(screen.getByText('The soup container opened in bag')).toBeInTheDocument()
    })

    it('displays backend error sentence when filing is refused with 4xx (Ruling 1)', async () => {
      // AC-3 / Ruling 1: 409 "This order had no rider" or 409 "One open complaint per filer per delivery"
      mockFileRiderComplaint.mockRejectedValue(
        Object.assign(new Error('This order had no rider'), { statusCode: 409 }),
      )

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('radio', { name: 'Late' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: 'Order took 2 hours' },
      })
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('This order had no rider')
      // Form stays open so user sees what happened
      expect(screen.getByLabelText(COMPLAINT_TEXT.textLabel)).toBeInTheDocument()
    })

    it('masks 5xx server errors and displays fallback sendFailed sentence (Ruling 1)', async () => {
      // Ruling 1: live 502 Bad Gateway should show "The complaint could not be sent.", not raw error
      mockFileRiderComplaint.mockRejectedValue({
        statusCode: 502,
        message: 'Backend unreachable.',
      })

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('radio', { name: 'Late' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: 'Order took 2 hours' },
      })
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(COMPLAINT_TEXT.sendFailed)
      expect(screen.queryByText('Backend unreachable.')).not.toBeInTheDocument()
    })

    it('masks client timeout errors and displays fallback sendFailed sentence (Ruling 1)', async () => {
      // Ruling 1: 12s client timeout should show "The complaint could not be sent.", not timeout words
      mockFileRiderComplaint.mockRejectedValue(
        new Error('Request timed out after 12s. Check backend availability and token.'),
      )

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('radio', { name: 'Late' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: 'Order took 2 hours' },
      })
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(COMPLAINT_TEXT.sendFailed)
      expect(
        screen.queryByText(/Request timed out after 12s/),
      ).not.toBeInTheDocument()
    })

    it('falls back to default sendFailed message when backend error has no message', async () => {
      mockFileRiderComplaint.mockRejectedValue({})

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('radio', { name: 'Rude' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: 'Rider shouting' },
      })
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(COMPLAINT_TEXT.sendFailed)
    })

    it('rereads complaints list after a failed send (Ruling 2)', async () => {
      // Initial load: 1 fetch. On failed send: load() is called in catch block -> 2 fetches total.
      mockFileRiderComplaint.mockRejectedValue({
        statusCode: 502,
        message: 'Backend unreachable.',
      })

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))
      expect(mockFetchOrderComplaints).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('radio', { name: 'Late' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: 'Delivery delayed' },
      })
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      await screen.findByRole('alert')
      // Ruling 2: fetchOrderComplaints must be called again in catch block
      expect(mockFetchOrderComplaints).toHaveBeenCalledTimes(2)
    })

    it('updates complaints list when a failed send (e.g. timeout or 409) reloads a saved open complaint (Ruling 2)', async () => {
      // Ruling 2: If POST timed out after the backend saved it, or returned 409 because one is open,
      // rereading the list brings the open complaint into the list on screen.
      const savedComplaint: PartnerComplaint = {
        id: 'c-saved-1',
        deliveryId: 'del-1',
        category: 'LATE',
        text: 'Courier arrived 40 min late',
        status: 'OPEN',
        createdAt: '2026-11-22T04:00:00Z',
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      }

      mockFetchOrderComplaints
        .mockResolvedValueOnce([]) // initial load: empty
        .mockResolvedValueOnce([savedComplaint]) // reload in catch block: complaint was actually saved

      mockFileRiderComplaint.mockRejectedValue(
        new Error('Request timed out after 12s. Check backend availability and token.'),
      )

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.open })))

      fireEvent.click(screen.getByRole('radio', { name: 'Late' }))
      fireEvent.change(screen.getByLabelText(COMPLAINT_TEXT.textLabel), {
        target: { value: 'Courier arrived 40 min late' },
      })
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.send }))

      // Shows fallback error message while form stays open so restaurant sees failure alert
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(COMPLAINT_TEXT.sendFailed)
      expect(screen.getByLabelText(COMPLAINT_TEXT.textLabel)).toBeInTheDocument()

      // Complaints list was reloaded and now renders the open complaint
      expect(mockFetchOrderComplaints).toHaveBeenCalledTimes(2)
      await waitFor(() => {
        const item = screen.getByTestId('order-complaint')
        expect(within(item).getByText('Courier arrived 40 min late')).toBeInTheDocument()
      })

      // Once user cancels form, hasOpen prevents the "Complain about the rider" button from re-appearing
      fireEvent.click(screen.getByRole('button', { name: COMPLAINT_TEXT.cancel }))
      expect(screen.queryByLabelText(COMPLAINT_TEXT.textLabel)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: COMPLAINT_TEXT.open })).not.toBeInTheDocument()
    })
  })

  describe('Value 5 privacy and rating protection (AC-7, AC-8)', () => {
    it('never renders rider reply, admin ID, or decider ID from complaint data', async () => {
      // Even if raw object somehow contained extra backend fields, UI must not render them
      const extraData = {
        id: 'c-priv-1',
        deliveryId: 'del-1',
        category: 'LATE',
        text: 'Customer waited too long',
        status: 'DECIDED',
        createdAt: '2026-11-20T10:00:00Z',
        outcome: 'Addressed',
        decidedAt: '2026-11-21T10:00:00Z',
        withdrawnReason: null,
        withdrawnAt: null,
        riderReply: 'Secret rider defense statement',
        decidedByUserId: 'admin-user-secret-999',
        filerAdminId: 'admin-filer-secret-888',
      } as any
      mockFetchOrderComplaints.mockResolvedValue([extraData])

      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('order-complaint')).toBeInTheDocument())
      expect(screen.queryByText(/Secret rider defense statement/)).not.toBeInTheDocument()
      expect(screen.queryByText(/admin-user-secret-999/)).not.toBeInTheDocument()
      expect(screen.queryByText(/admin-filer-secret-888/)).not.toBeInTheDocument()
    })

    it('never contains ratings, star indicators, or scores for riders (Binding value 5)', async () => {
      render(<RiderComplaintSection deliveryId="del-1" status="DROPPED_OFF" />)

      await waitFor(() => expect(screen.getByTestId('rider-complaint')).toBeInTheDocument())
      expect(screen.queryByText(/rating/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/score/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/stars/i)).not.toBeInTheDocument()
    })
  })
})
