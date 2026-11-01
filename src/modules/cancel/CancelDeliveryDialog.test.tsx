import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CancelDeliveryDialog } from './CancelDeliveryDialog'
import { useCancelManualRequestDeliveryMutation } from '../../api/manualRequestApi'

// Mock the cancel mutation hook so we can control loading, errors and assertions.
const mockCancelDelivery = jest.fn()

jest.mock('../../api/manualRequestApi', () => ({
  useCancelManualRequestDeliveryMutation: () => {
    const [isLoading, setIsLoading] = React.useState(false)
    const trigger = React.useCallback(async (vars: any) => {
      setIsLoading(true)
      try {
        return await mockCancelDelivery(vars)
      } finally {
        setIsLoading(false)
      }
    }, [])
    return [trigger, { isLoading }]
  },
}))

describe('CancelDeliveryDialog (spec 0015, AC-5)', () => {
  const onClose = jest.fn()
  const onCancelled = jest.fn()
  const deliveryId = 'del-test-123'

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders title, explanation, and defaults who wants to cancel to RESTAURANT', () => {
    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    // Heading and explanation of cancellation policy (AC-5, AC-6)
    expect(screen.getByRole('heading', { name: 'Cancel this delivery?' })).toBeInTheDocument()
    expect(
      screen.getByText(
        /If a rider has already accepted it, they are still paid for the job. A cancellation you make after a rider accepted is charged to you; one your customer asked for is not./i,
      ),
    ).toBeInTheDocument()

    // Who wants to cancel options
    expect(screen.getByText('Who wants to cancel?')).toBeInTheDocument()
    const restaurantRadio = screen.getByLabelText('We need to cancel it')
    const customerRadio = screen.getByLabelText('The customer asked to cancel')

    expect(restaurantRadio).toBeInTheDocument()
    expect(customerRadio).toBeInTheDocument()

    // RESTAURANT is selected at first
    expect(restaurantRadio).toBeChecked()
    expect(customerRadio).not.toBeChecked()
  })

  it('confirming with default selection sends RESTAURANT and triggers onCancelled', async () => {
    mockCancelDelivery.mockResolvedValueOnce({ id: deliveryId, status: 'CANCELED' })

    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    // Confirm cancellation without altering the radio selection
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delivery' }))

    await waitFor(() => {
      expect(mockCancelDelivery).toHaveBeenCalledWith({
        deliveryId,
        cancelledBy: 'RESTAURANT',
      })
      expect(onCancelled).toHaveBeenCalledTimes(1)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('choosing "The customer asked to cancel" and confirming sends CUSTOMER', async () => {
    mockCancelDelivery.mockResolvedValueOnce({ id: deliveryId, status: 'CANCELED' })

    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    const customerRadio = screen.getByLabelText('The customer asked to cancel')
    fireEvent.click(customerRadio)
    expect(customerRadio).toBeChecked()
    expect(screen.getByLabelText('We need to cancel it')).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel delivery' }))

    await waitFor(() => {
      expect(mockCancelDelivery).toHaveBeenCalledWith({
        deliveryId,
        cancelledBy: 'CUSTOMER',
      })
      expect(onCancelled).toHaveBeenCalledTimes(1)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clicking Keep it closes the dialog without cancelling', () => {
    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    const keepBtn = screen.getByRole('button', { name: 'Keep it' })
    fireEvent.click(keepBtn)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockCancelDelivery).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
  })

  it('while cancelling, the buttons are disabled, spinner appears and dialog stays open', async () => {
    let resolvePromise: (val?: any) => void = () => {}
    mockCancelDelivery.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
    )

    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    // Click confirm to start cancellation in-flight
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delivery' }))

    // While in-flight:
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Keep it' })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Cancel delivery/i })).toBeDisabled()
    })
    expect(screen.getByLabelText('Cancelling')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // Resolve the mutation
    resolvePromise({ id: deliveryId, status: 'CANCELED' })

    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error in role="alert" when mutation fails and keeps dialog open with buttons re-enabled', async () => {
    mockCancelDelivery.mockRejectedValueOnce(new Error('Backend error: lock timeout'))

    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel delivery' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Backend error: lock timeout')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancelled).not.toHaveBeenCalled()

    // Buttons are re-enabled for retry
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel delivery' })).toBeEnabled()
  })

  it('falls back to default error message if error does not provide a message', async () => {
    mockCancelDelivery.mockRejectedValueOnce({})

    render(
      <CancelDeliveryDialog
        deliveryId={deliveryId}
        onClose={onClose}
        onCancelled={onCancelled}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel delivery' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The delivery could not be cancelled. Try again in a moment.')
    expect(onCancelled).not.toHaveBeenCalled()
  })
})
