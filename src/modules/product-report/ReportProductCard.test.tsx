// Spec 0032 (AC-9): the "Report a product" card on a delivered order.
// Allows the restaurant to report a wrong or missing item, either by picking
// an item from the order or selecting "Something else" with an explanatory note.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReportProductCard } from './ReportProductCard'
import { reportDeliveryProduct } from '../../api/manualRequestApi'

// Mock the manualRequestApi function so we can assert on payloads and simulate responses.
jest.mock('../../api/manualRequestApi', () => ({
  reportDeliveryProduct: jest.fn(),
}))

const mockReportDeliveryProduct = reportDeliveryProduct as jest.MockedFunction<typeof reportDeliveryProduct>

const SAMPLE_ITEMS = [
  { name: 'Souvlaki', quantity: 2 },
  { name: 'Greek Salad', quantity: 1 },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('ReportProductCard (spec 0032, AC-9)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('card opening and collapsing', () => {
    it('initially renders only the "Report a product" button', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)

      expect(screen.getByRole('button', { name: 'Report a product' })).toBeInTheDocument()
      expect(screen.queryByTestId('report-product')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument()
    })

    it('clicking "Report a product" opens the form and hides the trigger button', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)

      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      expect(screen.getByTestId('report-product')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Report a product' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send report' })).toBeInTheDocument()
    })
  })

  describe('kind and item selection', () => {
    it('defaults to "Wrong item" and the first item of the order', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      // Kind buttons: Wrong item has default variant (bg-primary), Missing item has outline variant
      const wrongItemBtn = screen.getByRole('button', { name: 'Wrong item' })
      const missingItemBtn = screen.getByRole('button', { name: 'Missing item' })
      expect(wrongItemBtn).toHaveClass('bg-primary')
      expect(missingItemBtn).not.toHaveClass('bg-primary')

      // First item is selected by default
      const souvlakiBtn = screen.getByRole('button', { name: 'Souvlaki' })
      const saladBtn = screen.getByRole('button', { name: 'Greek Salad' })
      const somethingElseBtn = screen.getByRole('button', { name: 'Something else' })
      expect(souvlakiBtn).toHaveClass('bg-primary')
      expect(saladBtn).not.toHaveClass('bg-primary')
      expect(somethingElseBtn).not.toHaveClass('bg-primary')
    })

    it('allows toggling between "Wrong item" and "Missing item"', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      const wrongItemBtn = screen.getByRole('button', { name: 'Wrong item' })
      const missingItemBtn = screen.getByRole('button', { name: 'Missing item' })

      fireEvent.click(missingItemBtn)
      expect(missingItemBtn).toHaveClass('bg-primary')
      expect(wrongItemBtn).not.toHaveClass('bg-primary')

      fireEvent.click(wrongItemBtn)
      expect(wrongItemBtn).toHaveClass('bg-primary')
      expect(missingItemBtn).not.toHaveClass('bg-primary')
    })

    it('defaults to "Something else" when the order has no items', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={[]} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      const somethingElseBtn = screen.getByRole('button', { name: 'Something else' })
      expect(somethingElseBtn).toBeInTheDocument()
      expect(somethingElseBtn).toHaveClass('bg-primary')
    })

    it('handles multiple items with identical names without collision', () => {
      const duplicateItems = [
        { name: 'Pita Gyros', quantity: 1 },
        { name: 'Pita Gyros', quantity: 1 },
      ]
      render(<ReportProductCard deliveryId="del-101" orderItems={duplicateItems} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      const itemButtons = screen.getAllByRole('button', { name: 'Pita Gyros' })
      expect(itemButtons).toHaveLength(2)
    })
  })

  describe('send button enable/disable rules (AC-1, Fable review)', () => {
    it('is enabled when an order item is selected even without a note', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      // Souvlaki is selected by default; note is empty
      expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled()
    })

    it('is disabled when "Something else" is selected and note is empty or whitespace only', () => {
      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      fireEvent.click(screen.getByRole('button', { name: 'Something else' }))
      const sendBtn = screen.getByRole('button', { name: 'Send report' })
      const noteInput = screen.getByLabelText('Note')

      // Empty note: disabled
      expect(sendBtn).toBeDisabled()

      // Whitespace-only note: still disabled
      fireEvent.change(noteInput, { target: { value: '   ' } })
      expect(sendBtn).toBeDisabled()

      // Non-empty note: enabled
      fireEvent.change(noteInput, { target: { value: 'Extra sauce missing' } })
      expect(sendBtn).toBeEnabled()

      // Cleared back: disabled again
      fireEvent.change(noteInput, { target: { value: '' } })
      expect(sendBtn).toBeDisabled()
    })

    it('is disabled while the report request is in flight', async () => {
      const pending = deferred<{ id: string }>()
      mockReportDeliveryProduct.mockReturnValue(pending.promise)

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      const sendBtn = screen.getByRole('button', { name: 'Send report' })
      expect(sendBtn).toBeEnabled()

      fireEvent.click(sendBtn)
      expect(sendBtn).toBeDisabled()

      pending.resolve({ id: 'report-1' })
      await waitFor(() => {
        expect(screen.getByText('Thank you. The co-op has your report.')).toBeInTheDocument()
      })
    })
  })

  describe('sending report payloads (AC-1, AC-9)', () => {
    it('submits a wrong item report with an item and a note', async () => {
      mockReportDeliveryProduct.mockResolvedValue({ id: 'report-1' })

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      fireEvent.click(screen.getByRole('button', { name: 'Greek Salad' }))
      fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Came with onions despite note  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

      await waitFor(() => {
        expect(mockReportDeliveryProduct).toHaveBeenCalledWith('del-101', {
          kind: 'WRONG_ITEM',
          itemName: 'Greek Salad',
          note: 'Came with onions despite note', // trimmed
        })
      })

      expect(screen.getByText('Thank you. The co-op has your report.')).toBeInTheDocument()
      expect(screen.queryByTestId('report-product')).not.toBeInTheDocument()
    })

    it('submits a missing item report with an item and no note (note is undefined)', async () => {
      mockReportDeliveryProduct.mockResolvedValue({ id: 'report-2' })

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      fireEvent.click(screen.getByRole('button', { name: 'Missing item' }))
      fireEvent.click(screen.getByRole('button', { name: 'Souvlaki' }))
      // Note is left empty
      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

      await waitFor(() => {
        expect(mockReportDeliveryProduct).toHaveBeenCalledWith('del-101', {
          kind: 'MISSING_ITEM',
          itemName: 'Souvlaki',
          note: undefined,
        })
      })

      expect(screen.getByText('Thank you. The co-op has your report.')).toBeInTheDocument()
    })

    it('submits a report for "Something else" with note (itemName is undefined)', async () => {
      mockReportDeliveryProduct.mockResolvedValue({ id: 'report-3' })

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      fireEvent.click(screen.getByRole('button', { name: 'Missing item' }))
      fireEvent.click(screen.getByRole('button', { name: 'Something else' }))
      fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Cutlery and napkins missing' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

      await waitFor(() => {
        expect(mockReportDeliveryProduct).toHaveBeenCalledWith('del-101', {
          kind: 'MISSING_ITEM',
          itemName: undefined,
          note: 'Cutlery and napkins missing',
        })
      })

      expect(screen.getByText('Thank you. The co-op has your report.')).toBeInTheDocument()
    })
  })

  describe('server refusal and error handling (AC-3, AC-9)', () => {
    it('shows the server sentence on refusal (e.g. 409 order not delivered)', async () => {
      mockReportDeliveryProduct.mockRejectedValue(
        new Error('You can report this once the order is delivered.'),
      )

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('You can report this once the order is delivered.')
      })

      // Form remains visible so user can retry
      expect(screen.getByTestId('report-product')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled()
    })

    it('falls back to default message if refusal has no message', async () => {
      mockReportDeliveryProduct.mockRejectedValue({})

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('The report could not be sent.')
      })
    })

    it('clears the error message when a retry succeeds', async () => {
      mockReportDeliveryProduct
        .mockRejectedValueOnce(new Error('Network temporary glitch'))
        .mockResolvedValueOnce({ id: 'report-retry' })

      render(<ReportProductCard deliveryId="del-101" orderItems={SAMPLE_ITEMS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Report a product' }))

      // First attempt fails
      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network temporary glitch')
      })

      // Retry succeeds
      fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByText('Thank you. The co-op has your report.')).toBeInTheDocument()
      })
    })
  })
})
