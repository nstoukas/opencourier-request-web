// Spec 0030 (AC-8): WaitRecordCard displays the restaurant's wait record on My Orders,
// showing period choices (7, 30, 90 days with 30 as default), average wait, late share,
// and real prep time, with "Not enough orders yet" for null figures, and no adopt button.
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { WaitRecordCard } from './WaitRecordCard'
import { useWaitRecordQuery } from '../../api/manualRequestApi'
import { WaitRecord } from '../manual-request/types'

// Mock useWaitRecordQuery to isolate the card's presentation and interaction logic
jest.mock('../../api/manualRequestApi', () => ({
  useWaitRecordQuery: jest.fn(),
}))

const mockUseWaitRecordQuery = useWaitRecordQuery as jest.MockedFunction<typeof useWaitRecordQuery>

const sampleWaitRecord: WaitRecord = {
  days: 30,
  orderCount: 42,
  waitSamples: 38,
  averageWaitMinutes: 4.2,
  lateShare: 0.15,
  prepSamples: 40,
  medianPrepMinutes: 18,
  usualPrepMinutes: 15,
}

describe('WaitRecordCard (spec 0030, AC-8)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders card with title "Your record" and 7, 30, 90 days period buttons (defaulting to 30 days)', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: sampleWaitRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // Card container and title
    expect(screen.getByTestId('wait-record')).toBeInTheDocument()
    expect(screen.getByText('Your record')).toBeInTheDocument()

    // Query should initially be called with 30 days default
    expect(mockUseWaitRecordQuery).toHaveBeenCalledWith(30)

    // Period buttons exist
    const btn7 = screen.getByRole('button', { name: '7 days' })
    const btn30 = screen.getByRole('button', { name: '30 days' })
    const btn90 = screen.getByRole('button', { name: '90 days' })

    expect(btn7).toBeInTheDocument()
    expect(btn30).toBeInTheDocument()
    expect(btn90).toBeInTheDocument()

    // 30 days has default variant (bg-primary), others have outline variant (border-input)
    expect(btn30).toHaveClass('bg-primary')
    expect(btn7).toHaveClass('border-input')
    expect(btn90).toHaveClass('border-input')
  })

  it('clicking 7 days or 90 days switches the active period button and refetches query with that period', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: sampleWaitRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // Click "7 days"
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(mockUseWaitRecordQuery).toHaveBeenCalledWith(7)
    expect(screen.getByRole('button', { name: '7 days' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: '30 days' })).toHaveClass('border-input')
    expect(screen.getByRole('button', { name: '90 days' })).toHaveClass('border-input')

    // Click "90 days"
    fireEvent.click(screen.getByRole('button', { name: '90 days' }))
    expect(mockUseWaitRecordQuery).toHaveBeenCalledWith(90)
    expect(screen.getByRole('button', { name: '90 days' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: '7 days' })).toHaveClass('border-input')
    expect(screen.getByRole('button', { name: '30 days' })).toHaveClass('border-input')
  })

  it('shows figures only while the answer days equals the chosen period (hides figures when data.days !== days)', () => {
    // When the API response days (7) does not match the chosen period (default 30),
    // the figures must not be displayed under the mismatched period button.
    mockUseWaitRecordQuery.mockReturnValue({
      data: {
        ...sampleWaitRecord,
        days: 7,
      },
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // The card header and period buttons are rendered
    expect(screen.getByText('Your record')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30 days' })).toBeInTheDocument()

    // Figures must NOT be rendered because data.days (7) !== chosen period (30)
    expect(screen.queryByText('Riders waited past ready')).not.toBeInTheDocument()
    expect(screen.queryByText('4.2 min on average')).not.toBeInTheDocument()
    expect(screen.queryByText('Orders that ran late')).not.toBeInTheDocument()
    expect(screen.queryByText('Real prep time')).not.toBeInTheDocument()
  })

  it('keeps old figures hidden after switching to a new period until the matching answer lands', () => {
    const record30Days: WaitRecord = {
      days: 30,
      orderCount: 42,
      waitSamples: 38,
      averageWaitMinutes: 4.2,
      lateShare: 0.15,
      prepSamples: 40,
      medianPrepMinutes: 18,
      usualPrepMinutes: 15,
    }

    const record7Days: WaitRecord = {
      days: 7,
      orderCount: 14,
      waitSamples: 12,
      averageWaitMinutes: 2.1,
      lateShare: 0.07,
      prepSamples: 14,
      medianPrepMinutes: 12,
      usualPrepMinutes: 15,
    }

    // Step 1: 30 days is chosen by default and its answer is loaded
    let currentData: WaitRecord | undefined = record30Days
    mockUseWaitRecordQuery.mockImplementation(() => ({
      data: currentData,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    }))

    const { rerender } = render(<WaitRecordCard />)

    // 30-day figures match the API response
    expect(screen.getByText('Riders waited past ready')).toBeInTheDocument()
    expect(screen.getByText('4.2 min on average')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('18 min')).toBeInTheDocument()

    // Step 2: User clicks "7 days". While the new request is in flight,
    // usePolledFetch keeps the cached previous data (days: 30).
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))

    // The old 30-day figures must stay hidden under the new "7 days" button
    expect(screen.queryByText('Riders waited past ready')).not.toBeInTheDocument()
    expect(screen.queryByText('4.2 min on average')).not.toBeInTheDocument()
    expect(screen.queryByText('15%')).not.toBeInTheDocument()
    expect(screen.queryByText('18 min')).not.toBeInTheDocument()

    // Step 3: The new 7-day data lands from the backend
    currentData = record7Days
    rerender(<WaitRecordCard />)

    // The new 7-day figures are now shown and match the 7-day API response
    expect(screen.getByText('Riders waited past ready')).toBeInTheDocument()
    expect(screen.getByText('2.1 min on average')).toBeInTheDocument()
    expect(screen.getByText('7%')).toBeInTheDocument()
    expect(screen.getByText('12 min')).toBeInTheDocument()
  })

  it('keeps old figures hidden and shows error if query fails after switching period', () => {
    let queryState: { data?: WaitRecord; error?: Error; isLoading: boolean; refetch: () => void } = {
      data: sampleWaitRecord, // 30-day record
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    }
    mockUseWaitRecordQuery.mockImplementation(() => queryState as never)

    const { rerender } = render(<WaitRecordCard />)
    expect(screen.getByText('4.2 min on average')).toBeInTheDocument()

    // User switches to 90 days; query fails with error, keeping stale 30-day data in cache
    queryState = {
      data: sampleWaitRecord, // still has days: 30
      error: new Error('Failed to fetch wait record'),
      isLoading: false,
      refetch: jest.fn(),
    }
    fireEvent.click(screen.getByRole('button', { name: '90 days' }))
    rerender(<WaitRecordCard />)

    expect(screen.getByText('Your record could not be loaded.')).toBeInTheDocument()
    // Stale 30-day figures must not be displayed alongside the error
    expect(screen.queryByText('Riders waited past ready')).not.toBeInTheDocument()
    expect(screen.queryByText('4.2 min on average')).not.toBeInTheDocument()
  })

  it('renders all three performance metrics when data is returned by the API', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: sampleWaitRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // Average wait
    expect(screen.getByText('Riders waited past ready')).toBeInTheDocument()
    expect(screen.getByText('4.2 min on average')).toBeInTheDocument()

    // Late share (0.15 -> 15%)
    expect(screen.getByText('Orders that ran late')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()

    // Real prep time
    expect(screen.getByText('Real prep time')).toBeInTheDocument()
    expect(screen.getByText('18 min')).toBeInTheDocument()
  })

  it('renders boundary and zero values correctly (0 min wait, 0% late, 100% late, 0 min prep)', () => {
    const boundaryRecord: WaitRecord = {
      days: 30,
      orderCount: 10,
      waitSamples: 10,
      averageWaitMinutes: 0,
      lateShare: 0,
      prepSamples: 10,
      medianPrepMinutes: 0,
      usualPrepMinutes: 15,
    }

    mockUseWaitRecordQuery.mockReturnValue({
      data: boundaryRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    const { rerender } = render(<WaitRecordCard />)

    expect(screen.getByText('0 min on average')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0 min')).toBeInTheDocument()

    // Also verify lateShare 1.0 renders as 100% and rounding (0.054 -> 5%)
    mockUseWaitRecordQuery.mockReturnValue({
      data: {
        ...boundaryRecord,
        lateShare: 1,
      },
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })
    rerender(<WaitRecordCard />)
    expect(screen.getByText('100%')).toBeInTheDocument()

    mockUseWaitRecordQuery.mockReturnValue({
      data: {
        ...boundaryRecord,
        lateShare: 0.054,
      },
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })
    rerender(<WaitRecordCard />)
    expect(screen.getByText('5%')).toBeInTheDocument()
  })

  it('renders "Not enough orders yet" for all null metrics when orders are insufficient', () => {
    const emptyRecord: WaitRecord = {
      days: 30,
      orderCount: 0,
      waitSamples: 0,
      averageWaitMinutes: null,
      lateShare: null,
      prepSamples: 0,
      medianPrepMinutes: null,
      usualPrepMinutes: 15,
    }

    mockUseWaitRecordQuery.mockReturnValue({
      data: emptyRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // All three metrics show "Not enough orders yet"
    const notEnoughElements = screen.getAllByText('Not enough orders yet')
    expect(notEnoughElements).toHaveLength(3)

    // And verify labels are still visible above each fallback
    expect(screen.getByText('Riders waited past ready')).toBeInTheDocument()
    expect(screen.getByText('Orders that ran late')).toBeInTheDocument()
    expect(screen.getByText('Real prep time')).toBeInTheDocument()
  })

  it('renders "Not enough orders yet" only for specific null metrics when partially available', () => {
    const partialRecord: WaitRecord = {
      days: 30,
      orderCount: 5,
      waitSamples: 5,
      averageWaitMinutes: 2.1,
      lateShare: null,
      prepSamples: 0,
      medianPrepMinutes: null,
      usualPrepMinutes: 15,
    }

    mockUseWaitRecordQuery.mockReturnValue({
      data: partialRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // Average wait has real figure
    expect(screen.getByText('2.1 min on average')).toBeInTheDocument()

    // Late share and prep time have fallback
    const notEnoughElements = screen.getAllByText('Not enough orders yet')
    expect(notEnoughElements).toHaveLength(2)
  })

  it('renders error message "Your record could not be loaded." when query encounters an error', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: undefined,
      error: new Error('Failed to fetch wait record'),
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    const errorMsg = screen.getByText('Your record could not be loaded.')
    expect(errorMsg).toBeInTheDocument()
    expect(errorMsg).toHaveClass('text-destructive')

    // No metrics dl is rendered when data is undefined
    expect(screen.queryByText('Riders waited past ready')).not.toBeInTheDocument()
  })

  it('does not render metrics definition list when data is undefined', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    expect(screen.getByText('Your record')).toBeInTheDocument()
    expect(screen.queryByText('Riders waited past ready')).not.toBeInTheDocument()
    expect(screen.queryByText('Orders that ran late')).not.toBeInTheDocument()
    expect(screen.queryByText('Real prep time')).not.toBeInTheDocument()
  })

  it('does NOT render an adopt button or any action button (spec 0030, AC-8)', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: {
        ...sampleWaitRecord,
        medianPrepMinutes: 25,
        usualPrepMinutes: 15,
      },
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    render(<WaitRecordCard />)

    // Only the 3 period buttons exist. There is NO adopt button on request-web.
    const allButtons = screen.getAllByRole('button')
    expect(allButtons).toHaveLength(3)
    expect(screen.queryByText(/use.*as the usual prep time/i)).not.toBeInTheDocument()
  })

  it('does not display rider names, rider IDs, or per-rider statistics (spec 0030, AC-6)', () => {
    mockUseWaitRecordQuery.mockReturnValue({
      data: sampleWaitRecord,
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    })

    const { container } = render(<WaitRecordCard />)

    // No rider id or courier fields
    expect(container.textContent).not.toMatch(/courier/i)
    expect(container.textContent).not.toMatch(/rider\s+[a-z0-9]/i)
  })
})
