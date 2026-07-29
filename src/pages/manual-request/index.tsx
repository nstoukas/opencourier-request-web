import { useState } from 'react'
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
import { loginPartner, logoutPartner } from '../../api/manualRequestApi'
import { usePartnerSession } from '../../hooks/usePartnerSession'

export default function ManualRequestPage() {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string>('')
  const [isSigningIn, setIsSigningIn] = useState(false)

  const { isSignedIn, email, isLoading, refresh } = usePartnerSession()

  const handleSignIn = async () => {
    if (!partnerEmail.trim() || !password.trim()) {
      setStatus('Enter partner email and password first.')
      return
    }

    setIsSigningIn(true)
    setStatus('')

    try {
      await loginPartner(partnerEmail.trim(), password)
      setPassword('')
      await refresh()
      setStatus('')
    } catch (error: any) {
      setStatus(error?.message ?? 'Sign in failed.')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    await logoutPartner()
    await refresh()
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
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Checking sign-in…</p>
            ) : isSignedIn ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Signed in{email ? ` as ${email}` : ''}.
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Sign in with the partner account the co-op issued you.
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
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                  >
                    {isSigningIn ? 'Signing in...' : 'Sign In'}
                  </Button>
                </div>

                {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
              </>
            )}
          </CardContent>
        </Card>

        {isSignedIn && <CreateDeliveryForm />}
      </main>
    </>
  )
}
