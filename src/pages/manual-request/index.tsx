import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '../../admin-web-components'
import { CreateDeliveryForm } from '../../modules/manual-request/components/CreateDeliveryForm'
import { fetchPartnerMe } from '../../api/manualRequestApi'
import {
  clearManualRequestAccessToken,
  clearManualRequestApiKey,
  getManualRequestApiBaseUrl,
  getManualRequestAuthCredential,
  setManualRequestAccessToken,
  setManualRequestApiKey,
} from '../../utils/manualRequestAuth'

export default function ManualRequestPage() {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string>('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRegisteringPartner, setIsRegisteringPartner] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)

  const apiBaseUrl = useMemo(
    () => getManualRequestApiBaseUrl().replace(/\/v1$/, ''),
    [],
  )

  useEffect(() => {
    if (getManualRequestAuthCredential()) {
      setIsSignedIn(true)
      fetchPartnerMe().then((me) => setSignedInAs(me.email)).catch(() => {})
    }
  }, [])

  const notifyTokenUpdated = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('opencourier-token-updated'))
  }

  const handlePartnerAuth = async (mode: 'login' | 'register') => {
    if (!partnerEmail.trim() || !password.trim()) {
      setStatus('Enter partner email and password first.')
      return
    }

    const isRegister = mode === 'register'
    if (isRegister) {
      setIsRegisteringPartner(true)
    } else {
      setIsSigningIn(true)
    }

    const authUrl = `${apiBaseUrl}/api/partner/v1/auth/${isRegister ? 'register' : 'login'}`
    setStatus(`POST ${authUrl} ...`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRegister
            ? {
                email: partnerEmail.trim(),
                password,
                partnerName: partnerName.trim() || undefined,
              }
            : { email: partnerEmail.trim(), password },
        ),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const body = await response.json().catch(() => ({}))
      const payload = body?.result ?? body
      const apiKey = payload?.apiKey
      const accessToken = payload?.session?.accessToken

      if (!response.ok || !apiKey) {
        const rawMessage = body?.result?.[0]?.message ?? body?.message ?? `${isRegister ? 'Sign up' : 'Sign in'} failed.`
        const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : String(rawMessage)
        setStatus(`${isRegister ? 'Sign up' : 'Sign in'} failed: ${message}`)
        return
      }

      setManualRequestApiKey(apiKey)

      if (accessToken) {
        setManualRequestAccessToken(accessToken)
      }

      notifyTokenUpdated()
      setIsSignedIn(true)
      setSignedInAs(partnerEmail.trim())
      setStatus('')
    } catch (error: any) {
      const msg =
        error?.name === 'AbortError'
          ? `Timed out after 10s - is ${apiBaseUrl} reachable?`
          : (error?.message ?? 'Unknown error')
      setStatus(`${isRegister ? 'Sign up' : 'Sign in'} request failed: ${msg}`)
    } finally {
      if (isRegister) {
        setIsRegisteringPartner(false)
      } else {
        setIsSigningIn(false)
      }
    }
  }

  const handleClearCredential = () => {
    clearManualRequestApiKey()
    clearManualRequestAccessToken()
    notifyTokenUpdated()
    setIsSignedIn(false)
    setSignedInAs(null)
    setStatus('')
  }

  return (
    <>
      <Head>
        <title>Open Courier Manual Request</title>
      </Head>
      <main className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Manual Request Form</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manually create and submit a delivery request to OpenCourier.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSignedIn ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Signed in{signedInAs ? ` as ${signedInAs}` : ''}.
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearCredential}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Sign in with your partner account. If you don't have an account yet, use Sign Up to create one.
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="partner-email">Email</Label>
                    <Input
                      id="partner-email"
                      type="email"
                      value={partnerEmail}
                      onChange={(event) => setPartnerEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="partner-password">Password</Label>
                    <Input
                      id="partner-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="partner-name">Display Name (sign up only)</Label>
                    <Input
                      id="partner-name"
                      value={partnerName}
                      onChange={(event) => setPartnerName(event.target.value)}
                      placeholder="Optional name for your partner account"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => handlePartnerAuth('login')}
                    disabled={isSigningIn}
                  >
                    {isSigningIn ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePartnerAuth('register')}
                    disabled={isRegisteringPartner}
                  >
                    {isRegisteringPartner ? 'Signing up...' : 'Sign Up'}
                  </Button>
                </div>

                {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
              </>
            )}
          </CardContent>
        </Card>

        {isSignedIn && <CreateDeliveryForm requireAccessToken={true} />}
      </main>
    </>
  )
}
