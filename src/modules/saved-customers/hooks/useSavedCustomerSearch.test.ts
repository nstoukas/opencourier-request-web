import { renderHook, act } from '@testing-library/react'
import { useSavedCustomerSearch, SEARCH_PAUSE_MS } from './useSavedCustomerSearch'
import { listSavedCustomers } from '../../../api/savedCustomersApi'
import type { SavedCustomer } from '../types'

jest.mock('../../../api/savedCustomersApi', () => ({
  listSavedCustomers: jest.fn(),
}))

describe('useSavedCustomerSearch', () => {
  const sampleCustomer: SavedCustomer = {
    id: 'cust-1',
    name: 'Maria Papadopoulou',
    phone: '+306912345678',
    notes: null,
    addressLine1: 'Iasonos 45',
    addressLine2: null,
    city: 'Volos',
    zipCode: null,
    latitude: 39.36,
    longitude: 22.94,
    formattedAddress: 'Iasonos 45, Volos',
    lastUsedAt: '2026-10-26T12:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  }

  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('stays idle and does not search for queries under 2 characters', () => {
    const { result, rerender } = renderHook(({ q }) => useSavedCustomerSearch(q, 8), {
      initialProps: { q: '' },
    })

    expect(result.current).toEqual({ status: 'idle' })

    // 1 character
    rerender({ q: 'M' })
    act(() => {
      jest.advanceTimersByTime(SEARCH_PAUSE_MS + 100)
    })

    expect(result.current).toEqual({ status: 'idle' })
    expect(listSavedCustomers).not.toHaveBeenCalled()
  })

  it('searches after a 300 ms pause when query has 2 or more characters', async () => {
    ;(listSavedCustomers as jest.Mock).mockResolvedValue({
      items: [sampleCustomer],
      total: 1,
    })

    const { result } = renderHook(() => useSavedCustomerSearch('Mar', 8))

    expect(result.current).toEqual({ status: 'idle' })
    expect(listSavedCustomers).not.toHaveBeenCalled()

    // Advance 250ms (before pause)
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(listSavedCustomers).not.toHaveBeenCalled()

    // Advance remaining 50ms to reach 300ms
    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    expect(listSavedCustomers).toHaveBeenCalledWith(
      { q: 'Mar', perPage: 8 },
      expect.any(AbortSignal),
    )

    expect(result.current).toEqual({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })
  })

  it('ensures only the latest search answer wins (older answer arriving later is ignored)', async () => {
    let resolveFirst: any
    let resolveSecond: any

    const firstPromise = new Promise<{ items: SavedCustomer[]; total: number }>((res) => {
      resolveFirst = res
    })
    const secondPromise = new Promise<{ items: SavedCustomer[]; total: number }>((res) => {
      resolveSecond = res
    })

    ;(listSavedCustomers as jest.Mock)
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise)

    const { result, rerender } = renderHook(({ q }) => useSavedCustomerSearch(q, 8), {
      initialProps: { q: 'Ma' },
    })

    // Advance 300ms to trigger first search
    act(() => {
      jest.advanceTimersByTime(SEARCH_PAUSE_MS)
    })
    expect(listSavedCustomers).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ status: 'loading' })

    // User types more: "Maria"
    rerender({ q: 'Maria' })

    // Advance 300ms to trigger second search
    act(() => {
      jest.advanceTimersByTime(SEARCH_PAUSE_MS)
    })
    expect(listSavedCustomers).toHaveBeenCalledTimes(2)

    // Now suppose first search finally resolves late
    await act(async () => {
      resolveFirst({ items: [], total: 0 })
    })

    // Because the first search was aborted, result is still loading (waiting for second)
    expect(result.current).toEqual({ status: 'loading' })

    // Second search resolves with Maria
    await act(async () => {
      resolveSecond({ items: [sampleCustomer], total: 1 })
    })

    expect(result.current).toEqual({
      status: 'ready',
      items: [sampleCustomer],
      total: 1,
    })
  })

  it('sets status to error when listSavedCustomers fails', async () => {
    ;(listSavedCustomers as jest.Mock).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useSavedCustomerSearch('Alex', 8))

    await act(async () => {
      jest.advanceTimersByTime(SEARCH_PAUSE_MS)
    })

    expect(result.current).toEqual({ status: 'error' })
  })
})
