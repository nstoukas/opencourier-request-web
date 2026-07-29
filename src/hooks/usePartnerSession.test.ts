import { renderHook, act, waitFor } from '@testing-library/react'
import { usePartnerSession } from './usePartnerSession'
import * as api from '../api/manualRequestApi'

jest.mock('../api/manualRequestApi', () => ({
  fetchPartnerSession: jest.fn(),
}))

describe('usePartnerSession hook', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('initializes with isLoading true, then fetches session on mount', async () => {
    (api.fetchPartnerSession as jest.Mock).mockResolvedValue({
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
  })

  it('sets signedIn false and email null when session check returns signedIn false', async () => {
    (api.fetchPartnerSession as jest.Mock).mockResolvedValue({
      signedIn: false,
      email: null,
    })

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isSignedIn).toBe(false)
    expect(result.current.email).toBeNull()
  })

  it('re-fetches session when refresh is invoked and manages isLoading transitions', async () => {
    let resolveSecondFetch: (val: any) => void = () => {}
    const secondFetchPromise = new Promise((resolve) => {
      resolveSecondFetch = resolve
    })

    ;(api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: false, email: null })
      .mockImplementationOnce(() => secondFetchPromise)

    const { result } = renderHook(() => usePartnerSession())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.isSignedIn).toBe(false)

    let refreshPromise: Promise<void>
    act(() => {
      refreshPromise = result.current.refresh()
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolveSecondFetch({ signedIn: true, email: 'refreshed@example.com' })
      await refreshPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSignedIn).toBe(true)
    expect(result.current.email).toBe('refreshed@example.com')
    expect(api.fetchPartnerSession).toHaveBeenCalledTimes(2)
  })
})
