import React, { useState } from 'react'
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

interface CancelDeliveryDialogProps {
  deliveryId: string
  onClose: () => void
  // Called once the backend has cancelled it.
  onCancelled: () => void
}

const CHOICES: { value: PartnerCancelledBy; label: string }[] = [
  { value: 'RESTAURANT', label: 'We need to cancel it' },
  { value: 'CUSTOMER', label: 'The customer asked to cancel' },
]

/**
 * Asks first, and asks who wanted the cancellation (spec 0015, AC-5): a restaurant's own cancellation
 * after a rider accepted is charged to it; the rider who took the job is paid either way.
 */
export function CancelDeliveryDialog({ deliveryId, onClose, onCancelled }: CancelDeliveryDialogProps) {
  const [cancelledBy, setCancelledBy] = useState<PartnerCancelledBy>('RESTAURANT')
  const [error, setError] = useState<string | null>(null)
  const [cancelDelivery, { isLoading }] = useCancelManualRequestDeliveryMutation()

  const confirm = async () => {
    setError(null)
    try {
      await cancelDelivery({ deliveryId, cancelledBy })
      onCancelled()
    } catch (err: any) {
      setError(err?.message ?? 'The delivery could not be cancelled. Try again in a moment.')
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !isLoading && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this delivery?</AlertDialogTitle>
          <AlertDialogDescription>
            If a rider has already accepted it, they are still paid for the job. A cancellation you make
            after a rider accepted is charged to you; one your customer asked for is not.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-1">Who wants to cancel?</legend>
          {CHOICES.map((choice) => (
            <label key={choice.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cancelledBy"
                value={choice.value}
                checked={cancelledBy === choice.value}
                onChange={() => setCancelledBy(choice.value)}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Keep it</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction, so the dialog stays open until the cancel is done. */}
          <Button variant="destructive" onClick={confirm} disabled={isLoading}>
            {isLoading ? <Spinner className="mr-2" label="Cancelling" /> : null}
            Cancel delivery
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
