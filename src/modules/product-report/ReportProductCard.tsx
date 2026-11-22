import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Textarea } from '../../admin-web-components'
import { reportDeliveryProduct } from '../../api/manualRequestApi'
import { PartnerDeliveryOrderItemDto } from '../manual-request/types'
import { serverMessage } from '../../i18n/serverText'

type Kind = 'WRONG_ITEM' | 'MISSING_ITEM'

const SOMETHING_ELSE = '__other__'

type Props = {
  deliveryId: string
  orderItems: PartnerDeliveryOrderItemDto[]
}

// Spec 0032 (AC-9): a delivered order's "Report a product". The server decides whether it may be
// reported, so a refusal shows its own sentence.
export function ReportProductCard({ deliveryId, orderItems }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('WRONG_ITEM')
  const [item, setItem] = useState<string>(orderItems[0]?.name ?? SOMETHING_ELSE)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (sent) return <p className="text-sm font-medium">{t('productReport.thanks')}</p>
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('productReport.open')}
      </Button>
    )
  }

  // The server refuses a report with neither item nor note; this says so before sending.
  const canSend = item !== SOMETHING_ELSE || note.trim() !== ''

  const send = async () => {
    setSending(true)
    setError('')
    try {
      await reportDeliveryProduct(deliveryId, {
        kind,
        itemName: item === SOMETHING_ELSE ? undefined : item,
        note: note.trim() || undefined,
      })
      setSent(true)
    } catch (err: any) {
      setError(serverMessage(err) || t('productReport.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="report-product">
      <div className="flex flex-wrap gap-2">
        {(['WRONG_ITEM', 'MISSING_ITEM'] as Kind[]).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={kind === value ? 'default' : 'outline'}
            onClick={() => setKind(value)}
          >
            {value === 'WRONG_ITEM' ? t('productReport.wrongItem') : t('productReport.missingItem')}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {/* The index keeps two lines with the same name apart. */}
        {orderItems.map((orderItem, index) => (
          <Button
            key={`${orderItem.name}-${index}`}
            type="button"
            size="sm"
            variant={item === orderItem.name ? 'default' : 'outline'}
            onClick={() => setItem(orderItem.name)}
          >
            {orderItem.name}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={item === SOMETHING_ELSE ? 'default' : 'outline'}
          onClick={() => setItem(SOMETHING_ELSE)}
        >
          {t('productReport.somethingElse')}
        </Button>
      </div>
      <Textarea
        aria-label={t('productReport.note')}
        placeholder={t('productReport.notePlaceholder')}
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" size="sm" disabled={sending || !canSend} onClick={send}>
        {t('productReport.send')}
      </Button>
    </div>
  )
}
