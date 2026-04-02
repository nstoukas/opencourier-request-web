import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Textarea,
} from '../../../admin-web-components'
import {
  fetchPartnerDelivery,
  useListManualRequestDeliveriesQuery,
  useUpdateManualRequestDeliveryMutation,
  useCancelManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { PartnerDeliveryDto } from '../../../modules/manual-request/types'
import { getManualRequestAuthCredential } from '../../../utils/manualRequestAuth'

// Statuses where cancel is no longer possible
const TERMINAL_STATUSES = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'DROPPED_OFF') return 'default'
  if (status === 'CANCELED' || status === 'FAILED') return 'destructive'
  return 'secondary'
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function formatCurrency(amount: number | null, currency: string) {
  if (amount == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

interface EditDialogProps {
  delivery: PartnerDeliveryDto
  onClose: () => void
  onSaved: () => void
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function defaultDeadline(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  return toDatetimeLocal(d.toISOString())
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

function EditDialog({ delivery, onClose, onSaved }: EditDialogProps) {
  const [orderReference, setOrderReference] = useState(delivery.orderReference ?? '')
  const [pickupNotes, setPickupNotes] = useState(delivery.pickup?.pickupNotes ?? '')
  const [pickupReadyAt, setPickupReadyAt] = useState(toDatetimeLocal(delivery.pickupReadyAt))
  const [pickupDeadlineAt, setPickupDeadlineAt] = useState(toDatetimeLocal(delivery.pickupDeadlineAt) || defaultDeadline())
  const [dropoffNotes, setDropoffNotes] = useState(delivery.dropoff?.dropoffNotes ?? '')
  const [dropoffReadyAt, setDropoffReadyAt] = useState(toDatetimeLocal(delivery.dropoffReadyAt))
  const [dropoffDeadlineAt, setDropoffDeadlineAt] = useState(toDatetimeLocal(delivery.dropoffDeadlineAt) || defaultDeadline())
  const [error, setError] = useState('')

  const [updateDelivery, { isLoading }] = useUpdateManualRequestDeliveryMutation()

  const handleSave = async () => {
    setError('')
    const dropoffLat = delivery.dropoff?.latitude
    const dropoffLon = delivery.dropoff?.longitude
    if (dropoffLat == null || dropoffLon == null) {
      setError('Dropoff coordinates are missing — cannot update this delivery.')
      return
    }
    try {
      await updateDelivery({
        deliveryId: delivery.id,
        orderReference,
        pickupNotes,
        pickupReadyAt: fromDatetimeLocal(pickupReadyAt),
        pickupDeadlineAt: fromDatetimeLocal(pickupDeadlineAt),
        dropoffNotes,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLon,
        dropoffReadyAt: fromDatetimeLocal(dropoffReadyAt),
        dropoffDeadlineAt: fromDatetimeLocal(dropoffDeadlineAt),
      })
      onSaved()
    } catch (err: any) {
      setError(err?.message ?? 'Update failed.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Delivery</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-order-ref">Order Reference</Label>
            <Input
              id="edit-order-ref"
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder="e.g. ORD-12345"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pickup</p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pickup-notes">Notes</Label>
              <Textarea
                id="edit-pickup-notes"
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder="Instructions for the courier at pickup"
                rows={2}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-pickup-ready">
                  Ready At <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="edit-pickup-ready"
                  type="datetime-local"
                  value={pickupReadyAt}
                  onChange={(e) => setPickupReadyAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-pickup-deadline">
                  Deadline <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="edit-pickup-deadline"
                  type="datetime-local"
                  value={pickupDeadlineAt}
                  onChange={(e) => setPickupDeadlineAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dropoff</p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dropoff-notes">Notes</Label>
              <Textarea
                id="edit-dropoff-notes"
                value={dropoffNotes}
                onChange={(e) => setDropoffNotes(e.target.value)}
                placeholder="Instructions for the courier at dropoff"
                rows={2}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dropoff-ready">
                  Ready At <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="edit-dropoff-ready"
                  type="datetime-local"
                  value={dropoffReadyAt}
                  onChange={(e) => setDropoffReadyAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-dropoff-deadline">
                  Deadline <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="edit-dropoff-deadline"
                  type="datetime-local"
                  value={dropoffDeadlineAt}
                  onChange={(e) => setDropoffDeadlineAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DeliveriesPage() {
  const [page, setPage] = useState(1)
  const PER_PAGE = 20
  const [isSignedIn, setIsSignedIn] = useState(false)

  useEffect(() => {
    setIsSignedIn(Boolean(getManualRequestAuthCredential()))

    const handleTokenUpdate = () => setIsSignedIn(Boolean(getManualRequestAuthCredential()))
    window.addEventListener('opencourier-token-updated', handleTokenUpdate)
    window.addEventListener('storage', handleTokenUpdate)
    return () => {
      window.removeEventListener('opencourier-token-updated', handleTokenUpdate)
      window.removeEventListener('storage', handleTokenUpdate)
    }
  }, [])

  const { data, isLoading, error, refetch } = useListManualRequestDeliveriesQuery({
    page,
    perPage: PER_PAGE,
    skip: !isSignedIn,
  })

  const [cancelDelivery, { isLoading: isCanceling }] = useCancelManualRequestDeliveryMutation()
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [editingDelivery, setEditingDelivery] = useState<PartnerDeliveryDto | null>(null)
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const handleEdit = async (deliveryId: string) => {
    setLoadingEditId(deliveryId)
    try {
      const full = await fetchPartnerDelivery(deliveryId)
      setEditingDelivery(full)
    } catch (err: any) {
      setStatusMessage(err?.message ?? 'Failed to load delivery details.')
    } finally {
      setLoadingEditId(null)
    }
  }

  const handleCancel = async (deliveryId: string) => {
    setCancelingId(deliveryId)
    setStatusMessage('')
    try {
      await cancelDelivery(deliveryId)
      setStatusMessage('Delivery cancelled.')
      await refetch()
    } catch (err: any) {
      setStatusMessage(err?.message ?? 'Cancel failed.')
    } finally {
      setCancelingId(null)
    }
  }

  const pagination = data?.pagination
  const deliveries = data?.data ?? []

  return (
    <>
      <Head>
        <title>Deliveries</title>
      </Head>
      <main className="container py-6 space-y-4">
        <h1 className="text-xl font-semibold">Deliveries</h1>

        {!isSignedIn ? (
          <p className="text-sm text-muted-foreground">
            Please{' '}
            <Link href="/manual-request" className="underline">
              sign in
            </Link>{' '}
            to view your deliveries.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading deliveries...</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {(error as any)?.message ?? 'Failed to load deliveries. Check your credentials and try again.'}
          </p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries found.</p>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery) => {
              const isTerminal = TERMINAL_STATUSES.has(delivery.status)
              const isCancelingThis = cancelingId === delivery.id

              return (
                <Card key={delivery.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-mono text-muted-foreground">
                          {delivery.id}
                        </CardTitle>
                        {delivery.orderReference ? (
                          <p className="text-sm font-medium">{delivery.orderReference}</p>
                        ) : null}
                      </div>
                      <Badge variant={statusVariant(delivery.status)}>
                        {formatStatus(delivery.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      {delivery.pickup ? (
                        <div>
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Pickup</p>
                          <p>{delivery.pickup.pickupName}</p>
                          <p className="text-muted-foreground">
                            {delivery.pickup.formattedAddress ?? delivery.pickup.city ?? '—'}
                          </p>
                        </div>
                      ) : null}
                      {delivery.dropoff ? (
                        <div>
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Dropoff</p>
                          <p>{delivery.dropoff.dropoffName}</p>
                          <p className="text-muted-foreground">
                            {delivery.dropoff.formattedAddress ?? delivery.dropoff.city ?? '—'}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Cost: {formatCurrency(delivery.totalCost, delivery.currencyCode)}</span>
                      {delivery.dropoffEta ? (
                        <span>ETA: {formatDate(delivery.dropoffEta)}</span>
                      ) : null}
                      <span>Created: {formatDate(delivery.createdAt)}</span>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/manual-request/${delivery.id}/status`}>
                        <Button variant="outline" size="sm">View Status</Button>
                      </Link>
                      {!isTerminal ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(delivery.id)}
                            disabled={loadingEditId === delivery.id}
                          >
                            {loadingEditId === delivery.id ? 'Loading...' : 'Edit'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(delivery.id)}
                            disabled={isCancelingThis || isCanceling}
                          >
                            {isCancelingThis ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {isSignedIn && statusMessage ? (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        ) : null}

        {isSignedIn && pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.prevPage}
              onClick={() => setPage(pagination.prevPage!)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.nextPage}
              onClick={() => setPage(pagination.nextPage!)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </main>

      {editingDelivery ? (
        <EditDialog
          delivery={editingDelivery}
          onClose={() => setEditingDelivery(null)}
          onSaved={() => {
            setEditingDelivery(null)
            setStatusMessage('Delivery updated.')
            refetch()
          }}
        />
      ) : null}
    </>
  )
}
