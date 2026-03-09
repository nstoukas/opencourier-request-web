import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from '../../../admin-web-components'
import {
  useCancelManualRequestDeliveryMutation,
  useGetManualRequestDeliveryQuery,
} from '../../../api/manualRequestApi'

export default function ManualRequestStatusPage() {
  const router = useRouter()
  const deliveryId = typeof router.query.deliveryId === 'string' ? router.query.deliveryId : ''

  const { data, isLoading, error, refetch } = useGetManualRequestDeliveryQuery(deliveryId, {
    skip: !deliveryId,
  })
  const [cancelDelivery, { isLoading: isCanceling }] = useCancelManualRequestDeliveryMutation()

  const handleCancel = async () => {
    if (!deliveryId) return
    await cancelDelivery(deliveryId)
    await refetch()
  }

  return (
    <>
      <Head>
        <title>Delivery Status</title>
      </Head>
      <main className="container py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Manual Request Status</h1>
          <Link href="/manual-request" className="text-sm underline">
            Back to request form
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery {deliveryId || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading delivery status...</p> : null}
            {error ? (
              <p className="text-sm text-destructive">Failed to load delivery status. Check token and backend.</p>
            ) : null}

            {data ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Status:</span> {data.status}
                </p>
                <p>
                  <span className="font-medium">Courier:</span> {data.courierId ?? 'Unassigned'}
                </p>
                <p>
                  <span className="font-medium">Dropoff ETA:</span> {data.dropoffEta ?? 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Updated:</span> {data.updatedAt}
                </p>
              </div>
            ) : null}

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                Refresh
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={isCanceling || !data}>
                {isCanceling ? 'Canceling...' : 'Cancel Delivery'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
