import { renderHook, act } from '@testing-library/react'
import { usePolledFetch } from './usePolledFetch'

describe('usePolledFetch hook (spec 0017, AC-4)', () => {
  let visibilityState: 'visible' | 'hidden' = 'visible'

  beforeEach(() => {
    jest.useFakeTimers()
    visibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('first load shows isLoading true, while a poll keeps isLoading false and keeps data on screen', async () => {
    let resolveFirst: (val: string) => void = () => {}
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })

    let resolvePoll: (val: string) => void = () => {}
    const pollPromise = new Promise<string>((resolve) => {
      resolvePoll = resolve
    })

    const loadMock = jest
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => pollPromise)

    const { result } = renderHook(() =>
      usePolledFetch(loadMock, { enabled: true, intervalMs: 30_000 })
    )

    // First load: isLoading is true
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    // Resolve initial load
    await act(async () => {
      resolveFirst('first-data')
      await firstPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBe('first-data')
    expect(loadMock).toHaveBeenCalledTimes(1)

    // Advance timer to trigger a poll tick
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })

    expect(loadMock).toHaveBeenCalledTimes(2)
    // While poll is in flight: isLoading remains false (no full page spinner), data stays on screen
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBe('first-data')

    // Resolve poll
    await act(async () => {
      resolvePoll('polled-data')
      await pollPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBe('polled-data')
  })

  it('polls every intervalMs while document.visibilityState is visible, and does not poll while hidden', async () => {
    const loadMock = jest.fn().mockResolvedValue('ok')

    renderHook(() =>
      usePolledFetch(loadMock, { enabled: true, intervalMs: 30_000 })
    )

    // First load executed immediately
    await act(async () => {
      await Promise.resolve()
    })
    expect(loadMock).toHaveBeenCalledTimes(1)

    // Visible: timer tick polls
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(2)

    // Switch tab to hidden
    visibilityState = 'hidden'

    // Timer tick while hidden: must not poll
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(2)
  })

  it('loads immediately on visibilitychange when transitioning to visible', async () => {
    visibilityState = 'hidden'
    const loadMock = jest.fn().mockResolvedValue('ok')

    renderHook(() =>
      usePolledFetch(loadMock, { enabled: true, intervalMs: 30_000 })
    )

    await act(async () => {
      await Promise.resolve()
    })
    // First load ran on mount
    expect(loadMock).toHaveBeenCalledTimes(1)

    // Transition tab to visible
    visibilityState = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(loadMock).toHaveBeenCalledTimes(2)
  })

  it('skips a poll while a fetch is already in flight', async () => {
    let resolveSlowFetch: (val: string) => void = () => {}
    const slowPromise = new Promise<string>((resolve) => {
      resolveSlowFetch = resolve
    })

    const loadMock = jest
      .fn()
      .mockResolvedValueOnce('initial')
      .mockImplementationOnce(() => slowPromise)

    renderHook(() =>
      usePolledFetch(loadMock, { enabled: true, intervalMs: 30_000 })
    )

    // Initial load resolves
    await act(async () => {
      await Promise.resolve()
    })
    expect(loadMock).toHaveBeenCalledTimes(1)

    // Poll 1 triggers slow fetch
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(2)

    // Advance another 30s while Poll 1 is still in flight -> skipped!
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(2)

    // Once slow fetch finishes, subsequent timer tick will poll again
    await act(async () => {
      resolveSlowFetch('slow-done')
      await slowPromise
    })

    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(3)
  })

  it('drops an older answer that arrives after a newer request (e.g. refetch)', async () => {
    let resolveFirstReq: (val: string) => void = () => {}
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirstReq = resolve
    })

    const loadMock = jest
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce('newer-answer')

    const { result } = renderHook(() =>
      usePolledFetch(loadMock, { enabled: true, intervalMs: 30_000 })
    )

    // First request is in flight. Now user triggers a refetch (e.g. after cancellation)
    let refetchPromise: Promise<void>
    act(() => {
      refetchPromise = result.current.refetch()
    })

    // The second request (refetch) resolves first with newer data
    await act(async () => {
      await refetchPromise
    })
    expect(result.current.data).toBe('newer-answer')

    // Now the older first request finally resolves: must be dropped
    await act(async () => {
      resolveFirstReq('stale-older-answer')
      await firstPromise
    })

    // Data must remain 'newer-answer', not overwritten by the stale answer
    expect(result.current.data).toBe('newer-answer')
  })

  it('keeps existing data and sets error when a poll fails', async () => {
    const loadMock = jest
      .fn()
      .mockResolvedValueOnce('good-data')
      .mockRejectedValueOnce(new Error('Network drop on poll'))

    const { result } = renderHook(() =>
      usePolledFetch(loadMock, { enabled: true, intervalMs: 30_000 })
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.data).toBe('good-data')
    expect(result.current.error).toBeUndefined()

    // Trigger poll tick that fails
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })

    // Existing data is kept on screen, error is set
    expect(result.current.data).toBe('good-data')
    expect(result.current.error).toEqual(new Error('Network drop on poll'))
    expect(result.current.isLoading).toBe(false)
  })

  it('ends polling when stop(data) returns true', async () => {
    const loadMock = jest
      .fn()
      .mockResolvedValueOnce({ id: '1', status: 'ACCEPTED' })
      .mockResolvedValueOnce({ id: '1', status: 'DROPPED_OFF' })

    const stopMock = jest.fn((item: { status: string }) => item.status === 'DROPPED_OFF')

    const { result } = renderHook(() =>
      usePolledFetch(loadMock, {
        enabled: true,
        intervalMs: 30_000,
        stop: stopMock,
      })
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(stopMock).toHaveBeenCalledWith({ id: '1', status: 'ACCEPTED' })

    // Poll tick 1: order updates to DROPPED_OFF
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(2)
    expect(stopMock).toHaveBeenCalledWith({ id: '1', status: 'DROPPED_OFF' })

    // Subsequent poll tick: polling must have stopped
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    expect(loadMock).toHaveBeenCalledTimes(2)

    // Visibility change must not trigger a poll either when stopped
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(loadMock).toHaveBeenCalledTimes(2)
  })

  it('fetches nothing and sets isLoading false when enabled is false', async () => {
    const loadMock = jest.fn().mockResolvedValue('data')

    const { result } = renderHook(() =>
      usePolledFetch(loadMock, { enabled: false, intervalMs: 30_000 })
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('clears old data and shows loading when the loader function changes (review fix 7)', async () => {
    const loadPage1 = jest.fn().mockResolvedValue('page-1-data')
    const loadPage2 = jest.fn().mockResolvedValue('page-2-data')

    const { result, rerender } = renderHook(
      ({ loader }) => usePolledFetch(loader, { enabled: true, intervalMs: 30_000 }),
      { initialProps: { loader: loadPage1 } }
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.data).toBe('page-1-data')
    expect(result.current.isLoading).toBe(false)

    // Change to loadPage2 (e.g. user navigated to page 2 or another order)
    rerender({ loader: loadPage2 })

    // Old data is cleared immediately and loading cue shows
    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.data).toBe('page-2-data')
    expect(result.current.isLoading).toBe(false)
  })
})
