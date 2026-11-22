import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle, Button } from '../../admin-web-components'
import { clearPartnerBusy, pausePartner, resumePartner, setPartnerBusy } from '../../api/manualRequestApi'
import { PartnerAvailability } from '../manual-request/types'
import { codedSentenceText, serverMessage } from '../../i18n/serverText'

const BUSY_OPTIONS = [5, 10, 15, 20, 30]
// Each pause length with its label's translation key and the number it shows.
const PAUSE_OPTIONS = [
  { minutes: 15, labelKey: 'availability.pauseMinutes', count: 15 },
  { minutes: 30, labelKey: 'availability.pauseMinutes', count: 30 },
  { minutes: 60, labelKey: 'availability.pauseHours', count: 1 },
  { minutes: 120, labelKey: 'availability.pauseHours', count: 2 },
]

type Props = {
  availability: PartnerAvailability | undefined
  // Called after any change, so the page can read the availability again at once.
  onChanged: () => void | Promise<unknown>
}

// Spec 0029 (AC-8): busy mode and pause, on the order form page and on My Orders. The sentence why
// ordering is off comes from the server, so it is the same words the refusal uses; it is worded from its
// code in the reader's language, else the server's English (spec 0054, row 124).
export function AvailabilityStrip({ availability, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  if (!availability) return null

  const run = async (request: () => Promise<unknown>) => {
    setSending(true)
    setError('')
    try {
      await request()
    } catch (err: any) {
      setError(serverMessage(err, i18n) || t('availability.changeFailed'))
    } finally {
      // Wait for the fresh availability before the buttons come back, so a second tap meets the new
      // state and does not record a second pause (Fable's review).
      try {
        await onChanged()
      } finally {
        setSending(false)
      }
    }
  }

  const busyOn = availability.busyExtraMinutes !== null
  const paused = availability.pausedUntil !== null
  const disabled = availability.disabledAt !== null

  return (
    <div className="space-y-3" data-testid="availability-strip">
      {!availability.acceptingOrders && availability.notAcceptingReason ? (
        <Alert variant="destructive" role="status">
          <AlertTitle>{disabled ? t('availability.disabled') : t('availability.paused')}</AlertTitle>
          <AlertDescription>
            {codedSentenceText(
              i18n,
              'error',
              availability.notAcceptingCode,
              availability.notAcceptingParams,
              availability.notAcceptingReason,
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {busyOn ? (
            <>
              <span className="text-sm font-medium">{t('availability.busyOn', { minutes: availability.busyExtraMinutes })}</span>
              <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => run(clearPartnerBusy)}>
                {t('availability.stopBusy')}
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">{t('availability.busy')}</span>
              {BUSY_OPTIONS.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={() => run(() => setPartnerBusy(minutes))}
                >
                  +{minutes}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {paused ? (
            <Button type="button" size="sm" disabled={sending} onClick={() => run(resumePartner)}>
              {t('availability.resume')}
            </Button>
          ) : (
            <>
              <span className="text-sm font-medium">{t('availability.pause')}</span>
              {PAUSE_OPTIONS.map((option) => (
                <Button
                  key={option.minutes}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={() => run(() => pausePartner(option.minutes))}
                >
                  {t(option.labelKey, { count: option.count })}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
