import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPartnerSession } from '../api/manualRequestApi'

// The restaurant's session as the portal frame needs it (spec 0017, AC-5 and AC-6):
// - `refresh` checks with the full page spinner (the first check, Try again, after signing in);
// - `recheck` checks quietly after a 401, one check shared by every 401 that arrives meanwhile, and only
//   marks the session as ended (`sessionEnded`) when it was signed in and now is not;
// - `checkFailed` means the last full check could not be made (no connection, backend down): the frame
//   shows that, never the sign in form, because the session may well still be alive.
export function usePartnerSession() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [checkFailed, setCheckFailed] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const signedInRef = useRef(false)
  const recheckRef = useRef<Promise<void> | null>(null)

  const apply = (session: { signedIn: boolean; email: string | null }) => {
    signedInRef.current = session.signedIn
    setIsSignedIn(session.signedIn)
    setEmail(session.email)
  }

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      apply(await fetchPartnerSession())
      setCheckFailed(false)
    } catch {
      setCheckFailed(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const recheck = useCallback((): Promise<void> => {
    if (recheckRef.current) return recheckRef.current
    recheckRef.current = (async () => {
      try {
        const wasSignedIn = signedInRef.current
        const session = await fetchPartnerSession()
        if (wasSignedIn && !session.signedIn) setSessionEnded(true)
        apply(session)
      } catch {
        // The check itself failed: keep the page as it is; the call that got the 401 shows its own error.
      } finally {
        recheckRef.current = null
      }
    })()
    return recheckRef.current
  }, [])

  // After a successful sign in: the "session ended" sentence has done its job.
  const signedIn = useCallback(async () => {
    setSessionEnded(false)
    await refresh()
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { isSignedIn, email, isLoading, checkFailed, sessionEnded, refresh, recheck, signedIn }
}
