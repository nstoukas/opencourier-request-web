import React, { useState } from 'react'
import { Button, Textarea } from '../../admin-web-components'
import { reportDeliveryProduct } from '../../api/manualRequestApi'
import { PartnerDeliveryOrderItemDto } from '../manual-request/types'

type Kind = 'WRONG_ITEM' | 'MISSING_ITEM'

const SOMETHING_ELSE = '__other__'

type Props = {
  deliveryId: string
  orderItems: PartnerDeliveryOrderItemDto[]
}

// Spec 0032 (AC-9): a delivered order's "Report a product". The server decides whether it may be
// reported, so a refusal shows its own sentence.
export function ReportProductCard({ deliveryId, orderItems }: Props) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('WRONG_ITEM')
  const [item, setItem] = useState<string>(orderItems[0]?.name ?? SOMETHING_ELSE)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (sent) return <p className="text-sm font-medium">Thank you. The co-op has your report.</p>
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Report a product
      </Button>
    )
  }

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
      setError(err?.message || 'The report could not be sent.')
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
            {value === 'WRONG_ITEM' ? 'Wrong item' : 'Missing item'}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {orderItems.map((orderItem) => (
          <Button
            key={orderItem.name}
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
          Something else
        </Button>
      </div>
      <Textarea
        aria-label="Note"
        placeholder="Add a note"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" size="sm" disabled={sending} onClick={send}>
        Send report
      </Button>
    </div>
  )
}
