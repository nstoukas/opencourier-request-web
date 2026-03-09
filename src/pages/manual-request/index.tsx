import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../../admin-web-components'
import { CreateDeliveryForm } from '../../modules/manual-request/components/CreateDeliveryForm'

const ACCESS_TOKEN_KEY = 'accessToken'

export default function ManualRequestPage() {
  const [accessToken, setAccessToken] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setAccessToken(window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? '')
  }, [])

  const isSaveDisabled = useMemo(() => !accessToken.trim(), [accessToken])

  const handleSaveToken = () => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken.trim())
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <>
      <Head>
        <title>Manual Request</title>
      </Head>
      <main className="container py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backend Access Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="access-token">JWT Access Token</Label>
              <Input
                id="access-token"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder="Paste backend admin JWT token"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveToken} disabled={isSaveDisabled}>
                Save Token
              </Button>
              {saved ? <span className="text-sm text-muted-foreground">Saved</span> : null}
            </div>
          </CardContent>
        </Card>

        <CreateDeliveryForm />
      </main>
    </>
  )
}
