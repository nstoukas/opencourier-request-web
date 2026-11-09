import React, { useState } from 'react'
import { Alert, AlertDescription, AlertTitle, Button } from '../../admin-web-components'
import { clearPartnerBusy, pausePartner, resumePartner, setPartnerBusy } from '../../api/manualRequestApi'
import { PartnerAvailability } from '../manual-request/types'

const BUSY_OPTIONS = [5, 10, 15, 20, 30]
const PAUSE_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
]

type Props = {
  availability: PartnerAvailability | undefined
  // Called after any change, so the page can read the availability again at once.
  onChanged: () => void | Promise<unknown>
}

// Spec 0029 (AC-8): busy mode and pause, on the order form page and on My Orders. The sentence why
// ordering is off comes from the server, so it is the same words the refusal uses.
export function AvailabilityStrip({ availability, onChanged }: Props) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  if (!availability) return null

  const run = async (request: () => Promise<unknown>) => {
    setSending(true)
    setError('')
    try {
      await request()
    } catch (err: any) {
      setError(err?.message || 'That could not be changed.')
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
          <AlertTitle>{disabled ? 'This restaurant is disabled' : 'Ordering is paused'}</AlertTitle>
          <AlertDescription>{availability.notAcceptingReason}</AlertDescription>
        </Alert>
      ) : null}

      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {busyOn ? (
            <>
              <span className="text-sm font-medium">Busy mode: +{availability.busyExtraMinutes} min on new orders</span>
              <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => run(clearPartnerBusy)}>
                Stop busy
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Busy</span>
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
              Resume
            </Button>
          ) : (
            <>
              <span className="text-sm font-medium">Pause</span>
              {PAUSE_OPTIONS.map((option) => (
                <Button
                  key={option.minutes}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={() => run(() => pausePartner(option.minutes))}
                >
                  {option.label}
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
