import { ReadyControls } from '../../../modules/ready/ReadyControls'
import { AvailabilityStrip } from '../../../modules/availability/AvailabilityStrip'
import { WaitRecordCard } from '../../../modules/availability/WaitRecordCard'
import { useState } from 'react'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import {
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
  StatusBadge,
  Textarea,
} from '../../../admin-web-components'
import {
  usePartnerAvailabilityQuery,
  fetchPartnerDelivery,
  useListManualRequestDeliveriesQuery,
  useUpdateManualRequestDeliveryMutation,
} from '../../../api/manualRequestApi'
import { PartnerDeliveryDto } from '../../../modules/manual-request/types'
import { useFormat } from '../../../i18n/useFormat'
import { serverMessage } from '../../../i18n/serverText'
import { keyMessage, showMessage, textMessage, type ShownMessage } from '../../../i18n/shownMessage'
import { PageHeader } from '../../../modules/portal/components/PortalFrame'
import { CancelDeliveryDialog } from '../../../modules/cancel/CancelDeliveryDialog'
import { OrderLegsCard } from '../../../modules/legs/OrderLegsCard'
import { groupHistory } from '../../../modules/manual-request/utils/legs'
import { splitChargeNote, splitOutcomeLine } from '../../../modules/legs/splitOutcome'

// Statuses where cancel is no longer possible
const TERMINAL_STATUSES = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

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
  const { t, i18n } = useTranslation()
  const [orderReference, setOrderReference] = useState(delivery.orderReference ?? '')
  const [pickupNotes, setPickupNotes] = useState(delivery.pickup?.pickupNotes ?? '')
  // The ready time moves only by the audited buttons on the order (spec 0023, decision 21.9); the update
  // route still wants the field, so the stored value goes back exactly as it came, never through a
  // local date box (which would read it as browser time and move it by the time zone's offset).
  const storedPickupReadyAt = delivery.pickupReadyAt ?? null
  const [pickupDeadlineAt, setPickupDeadlineAt] = useState(toDatetimeLocal(delivery.pickupDeadlineAt) || defaultDeadline())
  const [dropoffNotes, setDropoffNotes] = useState(delivery.dropoff?.dropoffNotes ?? '')
  const [dropoffReadyAt, setDropoffReadyAt] = useState(toDatetimeLocal(delivery.dropoffReadyAt))
  const [dropoffDeadlineAt, setDropoffDeadlineAt] = useState(toDatetimeLocal(delivery.dropoffDeadlineAt) || defaultDeadline())
  // A key or the server's words, translated where it is shown (src/i18n/shownMessage.ts).
  const [error, setError] = useState<ShownMessage | null>(null)

  const [updateDelivery, { isLoading }] = useUpdateManualRequestDeliveryMutation()

  const handleSave = async () => {
    setError(null)
    const dropoffLat = delivery.dropoff?.latitude
    const dropoffLon = delivery.dropoff?.longitude
    if (dropoffLat == null || dropoffLon == null) {
      setError(keyMessage('orders.editNoCoordinates'))
      return
    }
    try {
      await updateDelivery({
        deliveryId: delivery.id,
        orderReference,
        pickupNotes,
        pickupReadyAt: storedPickupReadyAt,
        pickupDeadlineAt: fromDatetimeLocal(pickupDeadlineAt),
        dropoffNotes,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLon,
        dropoffReadyAt: fromDatetimeLocal(dropoffReadyAt),
        dropoffDeadlineAt: fromDatetimeLocal(dropoffDeadlineAt),
      })
      onSaved()
    } catch (err: any) {
      const refusal = serverMessage(err, i18n)
      setError(refusal ? textMessage(refusal) : keyMessage('orders.editFailed'))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('orders.editTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-order-ref">{t('orders.editOrderReference')}</Label>
            <Input
              id="edit-order-ref"
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder={t('orders.editOrderReferencePlaceholder')}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('orderPage.pickup')}</p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pickup-notes">{t('orderPage.notes')}</Label>
              <Textarea
                id="edit-pickup-notes"
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder={t('orders.editPickupNotesPlaceholder')}
                rows={2}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-pickup-deadline">
                  {t('orderPage.deadline')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span>
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('orderPage.dropoff')}</p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dropoff-notes">{t('orderPage.notes')}</Label>
              <Textarea
                id="edit-dropoff-notes"
                value={dropoffNotes}
                onChange={(e) => setDropoffNotes(e.target.value)}
                placeholder={t('orders.editDropoffNotesPlaceholder')}
                rows={2}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dropoff-ready">
                  {t('orders.editReadyAt')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span>
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
                  {t('orderPage.deadline')} <span className="text-muted-foreground font-normal">{t('common.optional')}</span>
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

          {error ? <p className="text-sm text-destructive">{showMessage(error, t)}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? t('common.saving') : t('orders.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DeliveriesPage() {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const [page, setPage] = useState(1)
  const PER_PAGE = 20
  // The frame (PortalFrame) shows this page only once the restaurant is signed in, and handles a session
  // that ends mid visit (spec 0017, AC-5). The list refreshes every 30 s while the tab is visible (AC-4).
  const { data, isLoading, error, refetch } = useListManualRequestDeliveriesQuery({
    page,
    perPage: PER_PAGE,
  })

  // The delivery whose cancel dialog is open (spec 0015: it asks first, and who wanted it).
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [editingDelivery, setEditingDelivery] = useState<PartnerDeliveryDto | null>(null)
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null)
  // A key or the server's words, translated where it is shown (src/i18n/shownMessage.ts).
  const [statusMessage, setStatusMessage] = useState<ShownMessage | null>(null)

  const handleEdit = async (deliveryId: string) => {
    setLoadingEditId(deliveryId)
    try {
      const full = await fetchPartnerDelivery(deliveryId)
      setEditingDelivery(full)
    } catch (err: any) {
      const refusal = serverMessage(err, i18n)
      setStatusMessage(refusal ? textMessage(refusal) : keyMessage('orders.editLoadFailed'))
    } finally {
      setLoadingEditId(null)
    }
  }

  const handleCancel = (deliveryId: string) => {
    setStatusMessage(null)
    setCancelingId(deliveryId)
  }

  const pagination = data?.pagination
  const deliveries = data?.data ?? []
  // Busy mode and pause (spec 0029).
  const availabilityQuery = usePartnerAvailabilityQuery()

  return (
    <>
      <Head>
        <title>{t('orders.documentTitle')}</title>
      </Head>
      {/* The frame (PortalFrame) supplies <main> and the 768px column; this is the page inside it. */}
      <div className="space-y-6">
        <PageHeader
          title={t('orders.title')}
          description={
            data?.historyDays
              ? t('orders.historyDays', { count: data.historyDays })
              : t('orders.onlyYours')
          }
        />
        <AvailabilityStrip availability={availabilityQuery.availability} onChanged={availabilityQuery.refetch} />
        {/* The restaurant's own record (spec 0030). */}
        <WaitRecordCard />

        {/* A poll that fails keeps the list on screen and says so; only a first load that fails shows the error alone. */}
        {error && data ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('orders.refreshFailed')}
          </p>
        ) : null}

        {isLoading && !data ? (
          <p className="text-sm text-muted-foreground">{t('orders.loading')}</p>
        ) : error && !data ? (
          <p className="text-sm text-destructive">
            {serverMessage(error as any, i18n) ?? t('orders.loadFailed')}
          </p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('orders.empty')}</p>
        ) : (
          <div className="space-y-3">
            {groupHistory(deliveries).map((item) => {
              // Spec 0046 (AC-6): the legs of one order show together, in one card.
              if (item.kind === 'order') {
                return <OrderLegsCard key={item.key} order={item} onChanged={refetch} />
              }
              const delivery = item.delivery
              const isTerminal = TERMINAL_STATUSES.has(delivery.status)
              const isCancelingThis = cancelingId === delivery.id

              return (
                <Card key={delivery.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      {/* min-w-0 lets this column shrink, so a long id wraps instead of pushing the badge out of the card on a phone. */}
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="break-all text-sm font-mono text-muted-foreground">
                          {delivery.id}
                        </CardTitle>
                        {delivery.orderReference ? (
                          <p className="text-sm font-medium">{delivery.orderReference}</p>
                        ) : null}
                        {/* Spec 0047 (AC-8): left at the restaurant because it didn't fit one box. */}
                        {(() => {
                          const line = splitOutcomeLine(delivery, t)
                          const noteKey = splitChargeNote(delivery)
                          return line ? (
                            <>
                              <p className="text-sm font-medium" data-testid="split-outcome">
                                {line}
                              </p>
                              {/* Decision 11.10: what the split costs the restaurant, and why a cost reads 0. */}
                              {noteKey ? (
                                <p className="text-xs text-muted-foreground" data-testid="split-charge-note">
                                  {t(noteKey)}
                                </p>
                              ) : null}
                            </>
                          ) : null
                        })()}
                      </div>
                      <StatusBadge status={delivery.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      {delivery.pickup ? (
                        <div>
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t('orderPage.pickup')}</p>
                          <p>{delivery.pickup.pickupName}</p>
                          <p className="text-muted-foreground">
                            {delivery.pickup.formattedAddress ?? delivery.pickup.city ?? '—'}
                          </p>
                        </div>
                      ) : null}
                      {delivery.dropoff ? (
                        <div>
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t('orderPage.dropoff')}</p>
                          <p>{delivery.dropoff.dropoffName}</p>
                          <p className="text-muted-foreground">
                            {delivery.dropoff.formattedAddress ?? delivery.dropoff.city ?? '—'}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t('orders.cost', { amount: format.money(delivery.totalCost, delivery.currencyCode) })}</span>
                      {delivery.dropoffEta ? (
                        <span>{t('orders.eta', { time: format.dateTime(delivery.dropoffEta) })}</span>
                      ) : null}
                      <span>{t('orders.created', { time: format.dateTime(delivery.createdAt) })}</span>
                    </div>

                    <ReadyControls
                      deliveryId={delivery.id}
                      order={{ status: delivery.status, readyAt: delivery.readyAt, foodReadyAt: delivery.foodReadyAt }}
                      onChanged={refetch}
                    />

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/manual-request/${delivery.id}/status`}>
                        <Button variant="outline" size="sm">{t('orders.viewStatus')}</Button>
                      </Link>
                      {!isTerminal ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(delivery.id)}
                            disabled={loadingEditId === delivery.id}
                          >
                            {loadingEditId === delivery.id ? t('common.loading') : t('orders.edit')}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(delivery.id)}
                            disabled={isCancelingThis}
                          >
                            {t('orders.cancel')}
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

        {statusMessage ? (
          <p className="text-sm text-muted-foreground">{showMessage(statusMessage, t)}</p>
        ) : null}

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.prevPage}
              onClick={() => setPage(pagination.prevPage!)}
            >
              {t('orders.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('orders.pageOf', { page: pagination.currentPage, total: pagination.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.nextPage}
              onClick={() => setPage(pagination.nextPage!)}
            >
              {t('orders.next')}
            </Button>
          </div>
        ) : null}
      </div>

      {editingDelivery ? (
        <EditDialog
          delivery={editingDelivery}
          onClose={() => setEditingDelivery(null)}
          onSaved={() => {
            setEditingDelivery(null)
            setStatusMessage(keyMessage('orders.updated'))
            refetch()
          }}
        />
      ) : null}

      {cancelingId ? (
        <CancelDeliveryDialog
          deliveryId={cancelingId}
          onClose={() => setCancelingId(null)}
          onCancelled={() => {
            setCancelingId(null)
            setStatusMessage(keyMessage('orders.cancelled'))
            refetch()
          }}
        />
      ) : null}
    </>
  )
}
