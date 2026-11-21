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
import { cancelDelivery, type PartnerCancelledBy } from '../../api/manualRequestApi'
import { PartnerDeliveryDto } from '../manual-request/types'
import { legLabel } from '../manual-request/utils/legs'

const CHOICES: { value: PartnerCancelledBy; label: string }[] = [
  { value: 'RESTAURANT', label: 'We need to cancel it' },
  { value: 'CUSTOMER', label: 'The customer asked to cancel' },
]

type Props = {
  // The legs still to cancel (legsToCancel: one delivered, cancelled or failed is left out).
  legs: PartnerDeliveryDto[]
  onClose: () => void
  // Called after every call has answered, whatever each answered.
  onDone: () => void
}

/**
 * Spec 0046 (AC-5, cross check 8): cancels a multi leg order. One question for who wanted it, then one cancel
 * per leg through the usual cancellation (each leg's own pay rules apply: a rider who accepted is paid, and
 * a restaurant's own cancellation is charged per accepted leg). Each leg's answer is shown.
 */
export function CancelOrderLegsDialog({ legs, onClose, onDone }: Props) {
  const [cancelledBy, setCancelledBy] = useState<PartnerCancelledBy>('RESTAURANT')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<{ label: string; ok: boolean; message: string }[] | null>(null)

  const confirm = async () => {
    setRunning(true)
    const answers: { label: string; ok: boolean; message: string }[] = []
    for (const leg of legs) {
      const label = legLabel(leg.legNumber ?? 0, leg.legCount ?? 0)
      try {
        await cancelDelivery(leg.id, cancelledBy)
        answers.push({ label, ok: true, message: 'Cancelled' })
      } catch (err: any) {
        answers.push({ label, ok: false, message: err?.message ?? 'Could not be cancelled. Try again in a moment.' })
      }
    }
    setResults(answers)
    setRunning(false)
    onDone()
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !running && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel all {legs.length} legs of this order?</AlertDialogTitle>
          <AlertDialogDescription>
            Each leg is cancelled on its own. A rider who already accepted a leg is still paid for it. A
            cancellation you make after a rider accepted is charged to you for that leg; one your customer asked
            for is not.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {results ? (
          <ul className="space-y-1 text-sm" data-testid="cancel-results">
            {results.map((result) => (
              <li key={result.label} className={result.ok ? '' : 'text-destructive'}>
                {result.label}: {result.message}
              </li>
            ))}
          </ul>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Who wants to cancel?</legend>
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
        )}
        <AlertDialogFooter>
          {results ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <AlertDialogCancel disabled={running}>Keep them</AlertDialogCancel>
              {/* A plain Button, so the dialog stays open until every leg has answered. */}
              <Button variant="destructive" onClick={confirm} disabled={running}>
                {running ? <Spinner className="mr-2" label="Cancelling" /> : null}
                Cancel all legs
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
