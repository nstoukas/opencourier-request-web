import { useEffect, useState } from 'react'
import { listSavedCustomers } from '../../../api/savedCustomersApi'
import type { SavedCustomer } from '../types'

// How long typing must pause before a search goes out (spec 0005, AC-3).
export const SEARCH_PAUSE_MS = 300
// The backend refuses shorter searches, and they would match nearly everyone.
export const MIN_SEARCH_LENGTH = 2

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: SavedCustomer[]; total: number }
  | { status: 'error' }

// The order form picker's search: after a 300 ms pause, up to `perPage` customers matching `query`.
// Only the latest search counts: each new one aborts the one before, so an older answer arriving
// late can never replace a newer one. A query under 2 characters searches nothing ('idle').
export function useSavedCustomerSearch(query: string, perPage: number): SearchState {
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setState({ status: 'idle' })
      return
    }
    // AbortController lets this effect cancel its own request when the query changes again.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState({ status: 'loading' })
      try {
        const result = await listSavedCustomers({ q: trimmed, perPage }, controller.signal)
        if (!controller.signal.aborted) {
          setState({ status: 'ready', items: result.items, total: result.total })
        }
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }, SEARCH_PAUSE_MS)

    // React runs this when the query changes or the component goes away: no stale timer, no stale answer.
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, perPage])

  return state
}
