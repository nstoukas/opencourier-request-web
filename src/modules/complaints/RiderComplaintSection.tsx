import React, { useCallback, useEffect, useState } from 'react'
import { Button, Separator, Textarea } from '../../admin-web-components'
import {
  PartnerComplaint,
  RIDER_COMPLAINT_CATEGORIES,
  RiderComplaintCategory,
  fetchOrderComplaints,
  fileRiderComplaint,
} from '../../api/complaintsApi'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../i18n/useFormat'
import { restaurantErrorText } from '../../utils/restaurantError'
import { COMPLAINT_TEXT, complaintCategoryLabel } from './complaintText'
import { ChoicePills } from '../manual-request/components/ChoicePills'

// The backend keeps a complaint to 1000 characters.
export const COMPLAINT_TEXT_MAX_LENGTH = 1000

// AC-3: a restaurant complains about the rider once the order is delivered or cancelled.
const FILING_STATUSES = new Set(['DROPPED_OFF', 'CANCELED'])

type Props = {
  deliveryId: string
  status: string
}

// One complaint the restaurant filed, with its outcome once there is one (AC-7). Never the rider's
// reply and never who decided: the server does not send them.
function ComplaintLine({ complaint }: { complaint: PartnerComplaint }) {
  const { t } = useTranslation()
  const format = useFormat()
  return (
    <li className="space-y-1 rounded-md border p-3" data-testid="order-complaint">
      <p className="text-sm font-medium">
        {t(complaintCategoryLabel(complaint.category))}
        <span className="font-normal text-muted-foreground">
          {' · '}
          {t(COMPLAINT_TEXT.filedOn)} {format.dateTime(complaint.createdAt)}
        </span>
      </p>
      <p className="whitespace-pre-wrap text-sm">{complaint.text}</p>
      {complaint.status === 'OPEN' ? (
        <p className="text-sm text-muted-foreground">{t(COMPLAINT_TEXT.statusOpen)}</p>
      ) : null}
      {complaint.status === 'DECIDED' ? (
        <div className="border-l-2 pl-3">
          <p className="text-sm font-medium">
            {t(COMPLAINT_TEXT.statusDecided)}
            <span className="font-normal text-muted-foreground"> · {format.dateTime(complaint.decidedAt)}</span>
          </p>
          {complaint.outcome ? <p className="whitespace-pre-wrap text-sm">{complaint.outcome}</p> : null}
        </div>
      ) : null}
      {complaint.status === 'WITHDRAWN' ? (
        <div className="border-l-2 pl-3">
          <p className="text-sm font-medium">
            {t(COMPLAINT_TEXT.statusWithdrawn)}
            <span className="font-normal text-muted-foreground"> · {format.dateTime(complaint.withdrawnAt)}</span>
          </p>
          {complaint.withdrawnReason ? (
            <p className="whitespace-pre-wrap text-sm">{complaint.withdrawnReason}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

// Spec 0052 (AC-3, AC-7; cross check 10): on the order page, the restaurant's complaints about this
// order's rider and their outcomes, and the form to file one. The server decides whether one may be
// filed (an order that never had a rider, an open complaint already), so a refusal shows its sentence.
export function RiderComplaintSection({ deliveryId, status }: Props) {
  const { t, i18n } = useTranslation()
  const [complaints, setComplaints] = useState<PartnerComplaint[] | null>(null)
  const [listError, setListError] = useState('')
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<RiderComplaintCategory | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const load = useCallback(async () => {
    try {
      setComplaints(await fetchOrderComplaints(deliveryId))
      setListError('')
    } catch (err) {
      // A refusal's own sentence, else a plain one: never a timeout's or a 5xx's words (row 83 review).
      setListError(restaurantErrorText(err, t(COMPLAINT_TEXT.listFailed), i18n))
    }
  }, [deliveryId])

  useEffect(() => {
    void load()
  }, [load])

  const canFileNow = FILING_STATUSES.has(status)
  const hasOpen = (complaints ?? []).some((complaint) => complaint.status === 'OPEN')
  // Nothing to show on an order still running with no complaint: the section stays out of the way.
  if (!canFileNow && (complaints ?? []).length === 0) return null

  const trimmed = text.trim()
  const canSend = category !== null && trimmed.length > 0 && !sending

  const send = async () => {
    if (!category) return
    setSending(true)
    setError('')
    try {
      await fileRiderComplaint({ deliveryId, category, text: trimmed })
      setSent(true)
      setOpen(false)
      setCategory(null)
      setText('')
      await load()
    } catch (err) {
      setError(restaurantErrorText(err, t(COMPLAINT_TEXT.sendFailed), i18n))
      // Row 83 review: the complaint may have been saved even so (a timeout after the server stored it,
      // or a 409 for one already open), so read the list again; an open one then hides the form.
      await load()
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Separator />
      <section className="space-y-3" data-testid="rider-complaint">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t(COMPLAINT_TEXT.sectionTitle)}
        </h2>
        {listError ? <p className="text-sm text-muted-foreground">{listError}</p> : null}
        {complaints && complaints.length > 0 ? (
          <ul className="space-y-2">
            {complaints.map((complaint) => (
              <ComplaintLine key={complaint.id} complaint={complaint} />
            ))}
          </ul>
        ) : null}
        {sent ? (
          <p role="status" className="text-sm font-medium">
            {t(COMPLAINT_TEXT.sent)}
          </p>
        ) : null}
        {canFileNow && !hasOpen && !open ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t(COMPLAINT_TEXT.intro)}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(true)
                setSent(false)
              }}
            >
              {t(COMPLAINT_TEXT.open)}
            </Button>
          </div>
        ) : null}
        {open ? (
          <div className="space-y-3">
            {/* The order form's radio group (arrow keys move between choices, one tab stop), rather than
                buttons that only claimed the radio role (row 83 review). */}
            <ChoicePills
              label={t(COMPLAINT_TEXT.whatHappened)}
              options={RIDER_COMPLAINT_CATEGORIES.map((value) => ({ value, label: t(complaintCategoryLabel(value)) }))}
              value={category ?? ''}
              onValueChange={(value) => setCategory(value as RiderComplaintCategory)}
            />
            <Textarea
              aria-label={t(COMPLAINT_TEXT.textLabel)}
              placeholder={t(COMPLAINT_TEXT.textPlaceholder)}
              value={text}
              maxLength={COMPLAINT_TEXT_MAX_LENGTH}
              onChange={(event) => setText(event.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {text.length}/{COMPLAINT_TEXT_MAX_LENGTH}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={!canSend} onClick={send}>
                {t(COMPLAINT_TEXT.send)}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={sending}
                onClick={() => {
                  setOpen(false)
                  setError('')
                }}
              >
                {t(COMPLAINT_TEXT.cancel)}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  )
}
