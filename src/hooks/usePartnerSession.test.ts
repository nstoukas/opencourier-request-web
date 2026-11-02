import { renderHook, act, waitFor } from '@testing-library/react'
import { usePartnerSession } from './usePartnerSession'
import * as api from '../api/manualRequestApi'

jest.mock('../api/manualRequestApi', () => ({
  fetchPartnerSession: jest.fn(),
}))

describe('usePartnerSession hook (spec 0017, AC-5 & AC-6)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('initializes with isLoading true, then fetches session on mount', async () => {
    ;(api.fetchPartnerSession as jest.Mock).mockResolvedValue({
      signedIn: true,
      email: 'partner@example.com',
    })

    const { result } = renderHook(() => usePartnerSession())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isSignedIn).toBe(true)
    expect(result.current.email).toBe('partner@example.com')
    expect(result.current.checkFailed).toBe(false)
    expect(result.current.sessionEnded).toBe(false)
  })

  it('sets checkFailed true when initial session check fails (network failure / 502)', async () => {
    ;(api.fetchPartnerSession as jest.Mock).mockRejectedValue(new Error('Session check failed (HTTP 502)'))

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.checkFailed).toBe(true)
    expect(result.current.isSignedIn).toBe(false)
  })

  it('shares one session check between multiple recheck calls at once (two 401s at once)', async () => {
    let resolveRecheck: (val: any) => void = () => {}
    const recheckPromise = new Promise((resolve) => {
      resolveRecheck = resolve
    })

    ;(api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: true, email: 'restaurant@volos.test' })
      .mockImplementationOnce(() => recheckPromise)

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isSignedIn).toBe(true)
    })
    expect(api.fetchPartnerSession).toHaveBeenCalledTimes(1)

    // Fire two recheck calls simultaneously
    let p1: Promise<void>
    let p2: Promise<void>
    act(() => {
      p1 = result.current.recheck()
      p2 = result.current.recheck()
    })

    // Both promises should be identical
    expect(p1!).toBe(p2!)
    expect(api.fetchPartnerSession).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveRecheck({ signedIn: false, email: null })
      await p1!
    })

    // Session ended mid visit: sessionEnded is set to true
    expect(result.current.isSignedIn).toBe(false)
    expect(result.current.sessionEnded).toBe(true)
  })

  it('a first visit signed out does not set sessionEnded on recheck', async () => {
    ;(api.fetchPartnerSession as jest.Mock).mockResolvedValue({
      signedIn: false,
      email: null,
    })

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.isSignedIn).toBe(false)
    expect(result.current.sessionEnded).toBe(false)

    // Recheck while already signed out
    await act(async () => {
      await result.current.recheck()
    })

    expect(result.current.sessionEnded).toBe(false)
  })

  it('a recheck that throws leaves page as it was without setting sessionEnded', async () => {
    ;(api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: true, email: 'restaurant@volos.test' })
      .mockRejectedValueOnce(new Error('Session check failed (HTTP 502)'))

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isSignedIn).toBe(true)
    })

    // Recheck fails
    await act(async () => {
      await result.current.recheck()
    })

    // State remains signed in, sessionEnded is false
    expect(result.current.isSignedIn).toBe(true)
    expect(result.current.email).toBe('restaurant@volos.test')
    expect(result.current.sessionEnded).toBe(false)
  })

  it('signedIn clears sessionEnded and refreshes session', async () => {
    ;(api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: true, email: 'restaurant@volos.test' })
      .mockResolvedValueOnce({ signedIn: false, email: null })
      .mockResolvedValueOnce({ signedIn: true, email: 'restaurant@volos.test' })

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isSignedIn).toBe(true)
    })

    // Recheck marks sessionEnded
    await act(async () => {
      await result.current.recheck()
    })
    expect(result.current.sessionEnded).toBe(true)

    // User logs in again: signedIn() is called
    await act(async () => {
      await result.current.signedIn()
    })

    expect(result.current.sessionEnded).toBe(false)
    expect(result.current.isSignedIn).toBe(true)
  })

  it('signedOut marks session signed out before refresh, so a 401 does not set sessionEnded (review fix 8)', async () => {
    let resolveRefresh: (val: any) => void = () => {}
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve
    })

    ;(api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: true, email: 'restaurant@volos.test' })
      .mockImplementationOnce(() => refreshPromise)
      .mockResolvedValue({ signedIn: false, email: null })

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isSignedIn).toBe(true)
    })

    // Sign out requested by restaurant - refresh is now in flight
    let signOutPromise: Promise<void>
    act(() => {
      signOutPromise = result.current.signedOut()
    })

    // An in-flight poll lands meanwhile with 401, triggering recheck() while refresh is in flight
    let recheckPromise: Promise<void>
    act(() => {
      recheckPromise = result.current.recheck()
    })

    await act(async () => {
      // Recheck sees signedInRef.current is already false because signedOut set it
      resolveRefresh({ signedIn: false, email: null })
      await signOutPromise!
      await recheckPromise!
    })

    // Must NOT show sessionEnded because user signed out deliberately!
    expect(result.current.isSignedIn).toBe(false)
    expect(result.current.sessionEnded).toBe(false)
  })
})
