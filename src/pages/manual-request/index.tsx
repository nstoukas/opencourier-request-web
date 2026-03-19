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
import {
  clearManualRequestAccessToken,
  clearManualRequestApiKey,
  getEnvManualRequestApiKey,
  getLocalManualRequestApiKey,
  getManualRequestApiKey,
  getManualRequestApiBaseUrl,
  getManualRequestApiMode,
  getManualRequestAuthMode,
  getManualRequestTokenSource,
  setManualRequestAccessToken,
  setManualRequestApiKey,
} from '../../utils/manualRequestAuth'

export default function ManualRequestPage() {
  const [partnerUsername, setPartnerUsername] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string>('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRegisteringPartner, setIsRegisteringPartner] = useState(false)
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const hasEnvApiKey = useMemo(() => Boolean(getEnvManualRequestApiKey()), [])
  const apiMode = useMemo(() => getManualRequestApiMode(), [])
  const authMode = useMemo(() => getManualRequestAuthMode(), [])
  const isConfiguredForPartner = authMode === 'api-key' && apiMode === 'partner'
  const [tokenUiVersion, setTokenUiVersion] = useState(0)

  const apiBaseUrl = useMemo(
    () => getManualRequestApiBaseUrl().replace(/\/v1$/, ''),
    [],
  )

  const activeApiKey = useMemo(
    () => (isMounted ? getManualRequestApiKey() : ''),
    [tokenUiVersion, isMounted],
  )

  const localApiKey = useMemo(() => (isMounted ? getLocalManualRequestApiKey() : ''), [tokenUiVersion, isMounted])
  const tokenSource = useMemo(() => (isMounted ? getManualRequestTokenSource() : 'none'), [tokenUiVersion, isMounted])

  const notifyTokenUpdated = () => {
    if (typeof window === 'undefined') return
    setTokenUiVersion((value) => value + 1)
    window.dispatchEvent(new Event('opencourier-token-updated'))
  }

  const handlePartnerAuth = async (mode: 'login' | 'register') => {
    if (!partnerUsername.trim() || !password.trim()) {
      setStatus('Enter partner username and password first.')
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
                username: partnerUsername.trim(),
                password,
                partnerName: partnerName.trim() || undefined,
              }
            : { username: partnerUsername.trim(), password },
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
      setStatus(
        `${isRegister ? 'Partner account created' : 'Signed in'} as ${partnerUsername.trim()}. Partner API key is saved and associated with this account.`,
      )
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

  const handleUseEnvApiKey = () => {
    const envApiKey = getEnvManualRequestApiKey()
    if (!envApiKey) {
      setStatus('No NEXT_PUBLIC_MANUAL_REQUEST_API_KEY found in local.env.')
      return
    }

    setManualRequestApiKey(envApiKey)
    notifyTokenUpdated()
    setStatus('Partner API key from local.env copied into localStorage.')
  }

  const handleClearCredential = () => {
    clearManualRequestApiKey()
    clearManualRequestAccessToken()
    notifyTokenUpdated()
    setStatus('Partner credentials cleared from localStorage.')
  }

  const handleValidateApiKey = async () => {
    const apiKey = getManualRequestApiKey()
    if (!apiKey) {
      setStatus('No API key available. Sign in or sign up first.')
      return
    }

    setIsValidatingApiKey(true)
    const meUrl = `${apiBaseUrl}/api/partner/v1/auth/me`
    setStatus(`GET ${meUrl} …`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(meUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const body = await response.json().catch(() => ({}))
      const payload = body?.result ?? body

      if (!response.ok) {
        const rawMessage = body?.result?.[0]?.message ?? body?.message ?? 'Token validation failed.'
        const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : String(rawMessage)
        setStatus(`Token invalid: ${message}`)
        return
      }

      const userEmail = payload?.email ?? 'unknown user'
      setStatus(`API key valid for ${userEmail}.`)
    } catch (error: any) {
      const msg = error?.name === 'AbortError' ? `Timed out after 10s — is ${apiBaseUrl} reachable?` : (error?.message ?? 'Unknown error')
      setStatus(`Credential validation failed: ${msg}`)
    } finally {
      setIsValidatingApiKey(false)
    }
  }

  return (
    <>
      <Head>
        <title>Open Courier Manual Request</title>
      </Head>
      <main className="container py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Open Courier Manual Request</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create and submit a manual delivery request.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Partner Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in as partner with username and password. If account does not exist, use Sign Up Partner.
                The returned partner API key is persisted and used for manual request APIs.
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="partner-username">Partner Username</Label>
                  <Input
                    id="partner-username"
                    value={partnerUsername}
                    onChange={(event) => setPartnerUsername(event.target.value)}
                    placeholder="partner-username"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="partner-password">Partner Password</Label>
                  <Input
                    id="partner-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="partner-name">Partner Name (sign up only)</Label>
                  <Input
                    id="partner-name"
                    value={partnerName}
                    onChange={(event) => setPartnerName(event.target.value)}
                    placeholder="Optional display name for new partner account"
                  />
                </div>
              </div>

              {!isConfiguredForPartner && (
                <p className="text-sm text-destructive">
                  local.env should use NEXT_PUBLIC_MANUAL_REQUEST_API_MODE=partner and NEXT_PUBLIC_MANUAL_REQUEST_AUTH_MODE=api-key for partner auth.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => handlePartnerAuth('login')}
                  disabled={isSigningIn}
                >
                  {isSigningIn ? 'Signing in...' : 'Sign In Partner'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePartnerAuth('register')}
                  disabled={isRegisteringPartner}
                >
                  {isRegisteringPartner ? 'Signing up...' : 'Sign Up Partner'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseEnvApiKey}
                  disabled={!hasEnvApiKey}
                >
                  Use Env API Key
                </Button>
                <Button type="button" variant="outline" onClick={handleValidateApiKey} disabled={isValidatingApiKey}>
                  {isValidatingApiKey ? 'Validating...' : 'Validate API Key'}
                </Button>
                <Button type="button" variant="ghost" onClick={handleClearCredential}>
                  Clear Credential
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>API Mode: {apiMode}</p>
                <p>Auth Mode: {authMode}</p>
                <p>Token Source: {tokenSource}</p>
                <p>
                  Active API Key: {activeApiKey ? `${activeApiKey.slice(0, 12)}…` : 'none'}
                  {tokenSource === 'localStorage' && localApiKey ? ' (local override)' : ''}
                </p>
                <p>
                  Keep NEXT_PUBLIC_MANUAL_REQUEST_API_KEY in local.env in sync with the partner account key returned on sign in or sign up.
                </p>
              </div>

            {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          </CardContent>
        </Card>

        <CreateDeliveryForm requireAccessToken={true} />
      </main>
    </>
  )
}
