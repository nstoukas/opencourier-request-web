// Spec 0029 (AC-8): AvailabilityStrip renders busy mode and pause controls on the
// order form page and My Orders, showing server refusal reasons and disabling buttons while sending.
import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AvailabilityStrip } from './AvailabilityStrip'
import {
  setPartnerBusy,
  clearPartnerBusy,
  pausePartner,
  resumePartner,
} from '../../api/manualRequestApi'
import { PartnerAvailability } from '../manual-request/types'

jest.mock('../../api/manualRequestApi', () => ({
  setPartnerBusy: jest.fn(),
  clearPartnerBusy: jest.fn(),
  pausePartner: jest.fn(),
  resumePartner: jest.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const defaultAvailability: PartnerAvailability = {
  busyExtraMinutes: null,
  pausedUntil: null,
  disabledAt: null,
  disabledReason: null,
  acceptingOrders: true,
  notAcceptingReason: null,
}

describe('AvailabilityStrip (spec 0029, AC-8)', () => {
  const mockOnChanged = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders nothing when availability is undefined', () => {
    const { container } = render(
      <AvailabilityStrip availability={undefined} onChanged={mockOnChanged} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('availability-strip')).not.toBeInTheDocument()
  })

  it('renders Busy options (+5 to +30) and Pause options (15 min to 2 h) when normal', () => {
    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    expect(screen.getByTestId('availability-strip')).toBeInTheDocument()

    // Busy section
    expect(screen.getByText('Busy')).toBeInTheDocument()
    for (const min of ['+5', '+10', '+15', '+20', '+30']) {
      expect(screen.getByRole('button', { name: min })).toBeEnabled()
    }

    // Pause section
    expect(screen.getByText('Pause')).toBeInTheDocument()
    for (const label of ['15 min', '30 min', '1 h', '2 h']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled()
    }

    // No alert or error
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('when busy mode is on: shows busy message with extra minutes and "Stop busy" button', () => {
    const availability: PartnerAvailability = {
      ...defaultAvailability,
      busyExtraMinutes: 15,
    }

    render(<AvailabilityStrip availability={availability} onChanged={mockOnChanged} />)

    expect(screen.getByText('Busy mode: +15 min on new orders')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop busy' })).toBeEnabled()

    // +5 .. +30 buttons should not be present
    for (const min of ['+5', '+10', '+15', '+20', '+30']) {
      expect(screen.queryByRole('button', { name: min })).not.toBeInTheDocument()
    }

    // Pause controls remain
    expect(screen.getByRole('button', { name: '30 min' })).toBeInTheDocument()
  })

  it('when paused: shows refusal sentence in alert and "Resume" button', () => {
    const availability: PartnerAvailability = {
      ...defaultAvailability,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    }

    render(<AvailabilityStrip availability={availability} onChanged={mockOnChanged} />)

    // Alert showing paused status
    const statusAlert = screen.getByRole('status')
    expect(statusAlert).toHaveTextContent('Ordering is paused')
    expect(statusAlert).toHaveTextContent('Ordering is paused until 14:30.')

    // Resume button
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled()

    // 15 min .. 2 h buttons should not be present
    for (const label of ['15 min', '30 min', '1 h', '2 h']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    }

    // Busy controls are still present
    expect(screen.getByRole('button', { name: '+10' })).toBeInTheDocument()
  })

  it('when disabled: shows disable reason alert and hides all busy and pause controls', () => {
    const availability: PartnerAvailability = {
      ...defaultAvailability,
      disabledAt: '2026-11-09T10:00:00.000Z',
      disabledReason: 'Co-op decision pending audit',
      acceptingOrders: false,
      notAcceptingReason: 'The co-op has disabled this restaurant: Co-op decision pending audit',
    }

    render(<AvailabilityStrip availability={availability} onChanged={mockOnChanged} />)

    // Alert showing disabled status
    const statusAlert = screen.getByRole('status')
    expect(statusAlert).toHaveTextContent('This restaurant is disabled')
    expect(statusAlert).toHaveTextContent('The co-op has disabled this restaurant: Co-op decision pending audit')

    // No buttons should be rendered while disabled
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryByText('Busy')).not.toBeInTheDocument()
    expect(screen.queryByText('Pause')).not.toBeInTheDocument()
  })

  it('clicking a busy option (+15) calls setPartnerBusy and triggers onChanged', async () => {
    ;(setPartnerBusy as jest.Mock).mockResolvedValue({
      ...defaultAvailability,
      busyExtraMinutes: 15,
    })

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+15' }))
    })

    expect(setPartnerBusy).toHaveBeenCalledTimes(1)
    expect(setPartnerBusy).toHaveBeenCalledWith(15)
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['+5', 5],
    ['+10', 10],
    ['+20', 20],
    ['+30', 30],
  ])('clicking busy option %s calls setPartnerBusy(%d)', async (name, min) => {
    ;(setPartnerBusy as jest.Mock).mockResolvedValue({
      ...defaultAvailability,
      busyExtraMinutes: min,
    })

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name }))
    })

    expect(setPartnerBusy).toHaveBeenCalledWith(min)
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('clicking "Stop busy" calls clearPartnerBusy and triggers onChanged', async () => {
    ;(clearPartnerBusy as jest.Mock).mockResolvedValue(defaultAvailability)

    const availability: PartnerAvailability = {
      ...defaultAvailability,
      busyExtraMinutes: 20,
    }

    render(<AvailabilityStrip availability={availability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop busy' }))
    })

    expect(clearPartnerBusy).toHaveBeenCalledTimes(1)
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['15 min', 15],
    ['30 min', 30],
    ['1 h', 60],
    ['2 h', 120],
  ])('clicking pause option "%s" calls pausePartner(%d) and triggers onChanged', async (label, min) => {
    ;(pausePartner as jest.Mock).mockResolvedValue({
      ...defaultAvailability,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    })

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: label }))
    })

    expect(pausePartner).toHaveBeenCalledTimes(1)
    expect(pausePartner).toHaveBeenCalledWith(min)
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('clicking "Resume" calls resumePartner and triggers onChanged', async () => {
    ;(resumePartner as jest.Mock).mockResolvedValue(defaultAvailability)

    const availability: PartnerAvailability = {
      ...defaultAvailability,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    }

    render(<AvailabilityStrip availability={availability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    })

    expect(resumePartner).toHaveBeenCalledTimes(1)
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('shows server sentence on a refusal and still calls onChanged', async () => {
    ;(setPartnerBusy as jest.Mock).mockRejectedValue(
      new Error('The co-op has disabled this restaurant: Temporarily closed'),
    )

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+10' }))
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The co-op has disabled this restaurant: Temporarily closed')
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('shows fallback error message when error has no message', async () => {
    ;(pausePartner as jest.Mock).mockRejectedValue({})

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '15 min' }))
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('That could not be changed.')
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('disables all buttons while a request is in flight and ignores extra clicks', async () => {
    const pending = deferred<PartnerAvailability>()
    ;(setPartnerBusy as jest.Mock).mockReturnValue(pending.promise)

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    // Click "+10" to start in-flight request
    fireEvent.click(screen.getByRole('button', { name: '+10' }))

    // All buttons should now be disabled
    for (const min of ['+5', '+10', '+15', '+20', '+30']) {
      expect(screen.getByRole('button', { name: min })).toBeDisabled()
    }
    for (const label of ['15 min', '30 min', '1 h', '2 h']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled()
    }

    // Tapping another button while disabled should not trigger extra requests
    fireEvent.click(screen.getByRole('button', { name: '+20' }))
    fireEvent.click(screen.getByRole('button', { name: '30 min' }))
    expect(setPartnerBusy).toHaveBeenCalledTimes(1)
    expect(pausePartner).not.toHaveBeenCalled()

    // Resolve the promise
    await act(async () => {
      pending.resolve({
        ...defaultAvailability,
        busyExtraMinutes: 10,
      })
    })

    // After settlement, onChanged is called and buttons are re-enabled
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
    for (const min of ['+5', '+10', '+15', '+20', '+30']) {
      expect(screen.getByRole('button', { name: min })).toBeEnabled()
    }
  })

  it('re-enables buttons when onChanged rejects after setting busy mode', async () => {
    ;(setPartnerBusy as jest.Mock).mockResolvedValue({
      ...defaultAvailability,
      busyExtraMinutes: 15,
    })
    mockOnChanged.mockRejectedValue(new Error('Network error on availability refetch'))

    render(<AvailabilityStrip availability={defaultAvailability} onChanged={mockOnChanged} />)

    const button = screen.getByRole('button', { name: '+15' })
    const reactPropsKey = Object.keys(button).find((k) => k.startsWith('__reactProps$'))!
    const onClick = (button as any)[reactPropsKey].onClick

    await act(async () => {
      try {
        await onClick()
      } catch (err: any) {
        expect(err.message).toBe('Network error on availability refetch')
      }
    })

    expect(mockOnChanged).toHaveBeenCalledTimes(1)
    for (const min of ['+5', '+10', '+15', '+20', '+30']) {
      expect(screen.getByRole('button', { name: min })).toBeEnabled()
    }
    for (const label of ['15 min', '30 min', '1 h', '2 h']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled()
    }
  })

  it('re-enables buttons when onChanged rejects after resume', async () => {
    ;(resumePartner as jest.Mock).mockResolvedValue(defaultAvailability)
    mockOnChanged.mockRejectedValue(new Error('Refetch failed'))

    const availability: PartnerAvailability = {
      ...defaultAvailability,
      pausedUntil: '2026-11-09T14:30:00.000Z',
      acceptingOrders: false,
      notAcceptingReason: 'Ordering is paused until 14:30.',
    }

    render(<AvailabilityStrip availability={availability} onChanged={mockOnChanged} />)

    const button = screen.getByRole('button', { name: 'Resume' })
    const reactPropsKey = Object.keys(button).find((k) => k.startsWith('__reactProps$'))!
    const onClick = (button as any)[reactPropsKey].onClick

    await act(async () => {
      try {
        await onClick()
      } catch (err: any) {
        expect(err.message).toBe('Refetch failed')
      }
    })

    expect(resumePartner).toHaveBeenCalledTimes(1)
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled()
  })
})
