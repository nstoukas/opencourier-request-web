import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createI18n } from '../../../i18n/createI18n'
import { useRetentionMonths, retentionHelperText } from './useRetentionMonths'
import { fetchRetentionMonths } from '../../../api/savedCustomersApi'

const t = createI18n('en').t

jest.mock('../../../api/savedCustomersApi', () => ({
  fetchRetentionMonths: jest.fn(),
}))

describe('useRetentionMonths and retentionHelperText', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetAllMocks()
  })

  describe('retentionHelperText', () => {
    it('returns generic wording when months is null', () => {
      expect(retentionHelperText(null, t)).toBe(
        'Only your restaurant sees it. It is deleted after a period unused that the co-op sets.',
      )
    })

    it('uses singular "month" for 1 month', () => {
      expect(retentionHelperText(1, t)).toBe(
        'Only your restaurant sees it. It is deleted after 1 month unused.',
      )
    })

    it('uses plural "months" for N months', () => {
      expect(retentionHelperText(12, t)).toBe(
        'Only your restaurant sees it. It is deleted after 12 months unused.',
      )
    })
  })

  describe('useRetentionMonths', () => {
    it('returns retention months fetched from API', async () => {
      ;(fetchRetentionMonths as jest.Mock).mockResolvedValue(18)

      const { result } = renderHook(() => useRetentionMonths())

      expect(result.current).toBeNull()

      await waitFor(() => {
        expect(result.current).toBe(18)
      })
    })

    it('does not set state after unmount when fetch resolves late', async () => {
      let resolveFetch!: (val: number | null) => void
      const pendingPromise = new Promise<number | null>((resolve) => {
        resolveFetch = resolve
      })
      ;(fetchRetentionMonths as jest.Mock).mockReturnValue(pendingPromise)

      const setStateMock = jest.fn()
      const realUseState = React.useState
      ;(jest.spyOn(React, 'useState') as jest.SpyInstance).mockImplementation(((init?: any) => {
        const [val] = realUseState(init)
        return [val, setStateMock]
      }) as any)

      const { unmount } = renderHook(() => useRetentionMonths())

      // Unmount while fetch is still in flight
      unmount()

      // Resolve the fetch after unmount
      await act(async () => {
        resolveFetch(12)
        await pendingPromise
      })

      // State setter must NOT have been called because active was false
      expect(setStateMock).not.toHaveBeenCalled()
    })
  })
})
