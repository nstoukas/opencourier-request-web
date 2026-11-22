import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Spinner,
} from '../../admin-web-components'
import { useCancelManualRequestDeliveryMutation, type PartnerCancelledBy } from '../../api/manualRequestApi'
import { serverMessage } from '../../i18n/serverText'

interface CancelDeliveryDialogProps {
  deliveryId: string
  onClose: () => void
  // Called once the backend has cancelled it.
  onCancelled: () => void
}

// Who wants to cancel, each with its label's translation key.
const CHOICES: { value: PartnerCancelledBy; labelKey: string }[] = [
  { value: 'RESTAURANT', labelKey: 'cancel.byRestaurant' },
  { value: 'CUSTOMER', labelKey: 'cancel.byCustomer' },
]

/**
 * Asks first, and asks who wanted the cancellation (spec 0015, AC-5): a restaurant's own cancellation
 * after a rider accepted is charged to it; the rider who took the job is paid either way.
 */
export function CancelDeliveryDialog({ deliveryId, onClose, onCancelled }: CancelDeliveryDialogProps) {
  const { t, i18n } = useTranslation()
  const [cancelledBy, setCancelledBy] = useState<PartnerCancelledBy>('RESTAURANT')
  const [error, setError] = useState<string | null>(null)
  const [cancelDelivery, { isLoading }] = useCancelManualRequestDeliveryMutation()

  const confirm = async () => {
    setError(null)
    try {
      await cancelDelivery({ deliveryId, cancelledBy })
      onCancelled()
    } catch (err: any) {
      setError(serverMessage(err, i18n) ?? t('cancel.failed'))
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !isLoading && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('cancel.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('cancel.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-1">{t('cancel.whoWants')}</legend>
          {CHOICES.map((choice) => (
            <label key={choice.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cancelledBy"
                value={choice.value}
                checked={cancelledBy === choice.value}
                onChange={() => setCancelledBy(choice.value)}
              />
              {t(choice.labelKey)}
            </label>
          ))}
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t('cancel.keepIt')}</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction, so the dialog stays open until the cancel is done. */}
          <Button variant="destructive" onClick={confirm} disabled={isLoading}>
            {isLoading ? <Spinner className="mr-2" label={t('cancelLegs.cancelling')} /> : null}
            {t('cancel.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
