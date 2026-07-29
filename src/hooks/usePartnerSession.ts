import { useCallback, useEffect, useState } from 'react'
import { fetchPartnerSession } from '../api/manualRequestApi'

export function usePartnerSession() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const session = await fetchPartnerSession()
      setIsSignedIn(session.signedIn)
      setEmail(session.email)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { isSignedIn, email, isLoading, refresh }
}
