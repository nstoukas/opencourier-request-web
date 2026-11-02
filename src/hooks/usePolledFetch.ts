import { useCallback, useEffect, useRef, useState } from 'react'

// Spec 0017 (AC-4). Loads once, then again every `intervalMs` while the tab is visible, and when the tab
// comes back into view. Only the first load shows as loading: a poll keeps the data on screen. A poll
// is skipped while a fetch is in flight, and an answer older than the latest request is dropped, so a
// slow poll can never overwrite the fresh answer a refetch (after a cancel, say) brought.
// `stop(data)` ends the polling once the data says nothing will change (an ended order).
export function usePolledFetch<T>(
  load: () => Promise<T>,
  options: { enabled: boolean; intervalMs?: number; stop?: (data: T) => boolean },
) {
  const { enabled, intervalMs = 30_000, stop } = options
  const [data, setData] = useState<T | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<unknown>(undefined)

  // useRef = a value that survives renders without causing one: the latest request's number, whether
  // a fetch is running, and whether polling has stopped.
  const latest = useRef(0)
  const inFlight = useRef(false)
  const stopped = useRef(false)
  const hasData = useRef(false)

  const run = useCallback(
    async (kind: 'first' | 'poll' | 'refetch') => {
      if (!enabled) return
      if (kind === 'poll' && (inFlight.current || stopped.current)) return
      const request = ++latest.current
      inFlight.current = true
      if (kind !== 'poll' && !hasData.current) setIsLoading(true)
      try {
        const answer = await load()
        if (request !== latest.current) return
        hasData.current = true
        setData(answer)
        setError(undefined)
        stopped.current = stop ? stop(answer) : false
      } catch (err) {
        if (request !== latest.current) return
        setError(err)
      } finally {
        if (request === latest.current) {
          inFlight.current = false
          setIsLoading(false)
        }
      }
    },
    // `load` and `stop` come from the caller; it keeps them stable with useCallback.
    [enabled, load, stop],
  )

  useEffect(() => {
    stopped.current = false
    hasData.current = false
    void run('first')
    if (!enabled) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void run('poll')
    }, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run('poll')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [run, enabled, intervalMs])

  const refetch = useCallback(() => run('refetch'), [run])

  return { data, isLoading, error, refetch }
}
