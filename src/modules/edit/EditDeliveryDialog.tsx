import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Textarea,
} from '../../admin-web-components'
import { fetchPartnerDelivery, useUpdateManualRequestDeliveryMutation } from '../../api/manualRequestApi'
import { PartnerDeliveryDto } from '../manual-request/types'
import { serverMessage } from '../../i18n/serverText'
import { keyMessage, showMessage, textMessage, type ShownMessage } from '../../i18n/shownMessage'

// Row 165: the server's three refusals of an edit that mean the order is not what this dialog shows (row 152's two,
// row 161's). Only these read the order again: a timeout, a validation 400 or any other failure says nothing about
// the order, so the restaurant's typed values stay (Fable review of row 165, major).
const ORDER_MOVED_ON_CODES = ['PARTNER_EDIT_ORDER_ENDED', 'PARTNER_EDIT_POINT_HELD', 'PARTNER_EDIT_CHANGED']

// The orders page's Edit dialog, moved out of src/pages (every file there is a route) so it can be tested.

interface EditDeliveryDialogProps {
  delivery: PartnerDeliveryDto
  onClose: () => void
  onSaved: () => void
}

// Row 168: a stored time (UTC text) as a date box's value, "2026-11-25T14:05", in the browser's own time, which is
// how the box reads what is typed. Cutting the UTC text instead showed 12:05 for 14:05 in Athens, and the save then
// moved the time by the offset.
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // padStart(2, '0'): 5 becomes "05", as the box expects.
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`
}

// A box's value (browser time) as UTC text for the server; an empty box is no time.
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

// Row 168: what a time box sends. A box the restaurant left as it was filled sends the stored time exactly (its
// seconds too, or none if there was none), so a save that changes only the notes changes no time, and the rider is
// not told the times changed (row 164). A changed box sends the time typed.
export function timeToSend(box: string, stored: string | null | undefined): string | null {
  if (box === toDatetimeLocal(stored)) return stored ?? null
  return fromDatetimeLocal(box)
}

export function EditDeliveryDialog({ delivery, onClose, onSaved }: EditDeliveryDialogProps) {
  const { t, i18n } = useTranslation()
  // The order as the dialog last read it: the one it opened with, or the one read again after a refusal (row 165).
  const [current, setCurrent] = useState(delivery)
  const [orderReference, setOrderReference] = useState(delivery.orderReference ?? '')
  const [pickupNotes, setPickupNotes] = useState(delivery.pickup?.pickupNotes ?? '')
  // The ready time moves only by the audited buttons on the order (spec 0023, decision 21.9); the update
  // route still wants the field, so the stored value goes back exactly as it came, never through a
  // local date box (which would read it as browser time and move it by the time zone's offset).
  const storedPickupReadyAt = current.pickupReadyAt ?? null
  const [pickupDeadlineAt, setPickupDeadlineAt] = useState(toDatetimeLocal(delivery.pickupDeadlineAt))
  const [dropoffNotes, setDropoffNotes] = useState(delivery.dropoff?.dropoffNotes ?? '')
  const [dropoffReadyAt, setDropoffReadyAt] = useState(toDatetimeLocal(delivery.dropoffReadyAt))
  const [dropoffDeadlineAt, setDropoffDeadlineAt] = useState(toDatetimeLocal(delivery.dropoffDeadlineAt))
  // A key or the server's words, translated where it is shown (src/i18n/shownMessage.ts).
  const [error, setError] = useState<ShownMessage | null>(null)
  // True once the boxes show the order as it is now, after the server refused a save (row 165).
  const [reloaded, setReloaded] = useState(false)
  // True while the order is read again, so Save waits for the boxes to show it (Fable review, minor 1).
  const [rereading, setRereading] = useState(false)

  // Puts the order's values into every box, the same way the dialog fills them when it opens.
  const fillFrom = (d: PartnerDeliveryDto) => {
    setCurrent(d)
    setOrderReference(d.orderReference ?? '')
    setPickupNotes(d.pickup?.pickupNotes ?? '')
    setPickupDeadlineAt(toDatetimeLocal(d.pickupDeadlineAt))
    setDropoffNotes(d.dropoff?.dropoffNotes ?? '')
    setDropoffReadyAt(toDatetimeLocal(d.dropoffReadyAt))
    setDropoffDeadlineAt(toDatetimeLocal(d.dropoffDeadlineAt))
  }

  const [updateDelivery, { isLoading }] = useUpdateManualRequestDeliveryMutation()

  const handleSave = async () => {
    setError(null)
    setReloaded(false)
    const dropoffLat = current.dropoff?.latitude
    const dropoffLon = current.dropoff?.longitude
    if (dropoffLat == null || dropoffLon == null) {
      setError(keyMessage('orders.editNoCoordinates'))
      return
    }
    try {
      await updateDelivery({
        deliveryId: current.id,
        orderReference,
        pickupNotes,
        pickupReadyAt: storedPickupReadyAt,
        // Row 168: each time as stored unless its box was changed (an empty one stays empty: no invented deadline).
        pickupDeadlineAt: timeToSend(pickupDeadlineAt, current.pickupDeadlineAt),
        dropoffNotes,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLon,
        dropoffReadyAt: timeToSend(dropoffReadyAt, current.dropoffReadyAt),
        dropoffDeadlineAt: timeToSend(dropoffDeadlineAt, current.dropoffDeadlineAt),
      })
      onSaved()
    } catch (err: any) {
      const refusal = serverMessage(err, i18n)
      setError(refusal ? textMessage(refusal) : keyMessage('orders.editFailed'))
      // Row 165: the server said no because the order is not what this dialog shows (it ended, a rider took it,
      // or it changed under the save). Read it again and show it as it is now, so a second save does not send
      // the same stale values. Only on those three refusals (see ORDER_MOVED_ON_CODES).
      if (ORDER_MOVED_ON_CODES.includes(err?.code)) {
        setRereading(true)
        try {
          fillFrom(await fetchPartnerDelivery(current.id))
          setReloaded(true)
        } catch {
          // The order could not be read again: the boxes keep the restaurant's values, and the refusal still shows.
        } finally {
          setRereading(false)
        }
      }
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
          {reloaded ? <p className="text-sm text-muted-foreground">{t('orders.editReloaded')}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || rereading}>
            {isLoading ? t('common.saving') : t('orders.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
