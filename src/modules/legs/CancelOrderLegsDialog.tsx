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
import { cancelDelivery, type PartnerCancelledBy } from '../../api/manualRequestApi'
import { PartnerDeliveryDto } from '../manual-request/types'
import { legLabel } from '../manual-request/utils/legs'
import { serverMessage } from '../../i18n/serverText'

// Who wants to cancel, each with its label's translation key (the same two as a single delivery's dialog).
const CHOICES: { value: PartnerCancelledBy; labelKey: string }[] = [
  { value: 'RESTAURANT', labelKey: 'cancel.byRestaurant' },
  { value: 'CUSTOMER', labelKey: 'cancel.byCustomer' },
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
  const { t } = useTranslation()
  const [cancelledBy, setCancelledBy] = useState<PartnerCancelledBy>('RESTAURANT')
  // The legs as the dialog opened: the page reads the legs again after the cancels (row 10 review).
  const [openedWith] = useState(legs)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<{ label: string; ok: boolean; message: string }[] | null>(null)

  const confirm = async () => {
    setRunning(true)
    const answers: { label: string; ok: boolean; message: string }[] = []
    for (const leg of openedWith) {
      const label = legLabel(leg.legNumber ?? 0, leg.legCount ?? 0, t)
      try {
        await cancelDelivery(leg.id, cancelledBy)
        answers.push({ label, ok: true, message: t('cancelLegs.cancelled') })
      } catch (err: any) {
        answers.push({ label, ok: false, message: serverMessage(err) ?? t('cancelLegs.failed') })
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
          <AlertDialogTitle>{t('cancelLegs.title', { count: openedWith.length })}</AlertDialogTitle>
          <AlertDialogDescription>{t('cancelLegs.description')}</AlertDialogDescription>
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
            <legend className="mb-1 text-sm font-medium">{t('cancel.whoWants')}</legend>
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
        )}
        <AlertDialogFooter>
          {results ? (
            <Button onClick={onClose}>{t('common.close')}</Button>
          ) : (
            <>
              <AlertDialogCancel disabled={running}>{t('cancelLegs.keepThem')}</AlertDialogCancel>
              {/* A plain Button, so the dialog stays open until every leg has answered. */}
              <Button variant="destructive" onClick={confirm} disabled={running}>
                {running ? <Spinner className="mr-2" label={t('cancelLegs.cancelling')} /> : null}
                {t('orderLegs.cancelAll')}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
