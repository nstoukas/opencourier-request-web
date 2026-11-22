import React from 'react'
import { formatDistanceToNow } from 'date-fns'
// date-fns' own Greek and British English words for "3 days ago".
import { el as dateFnsGreek, enGB as dateFnsEnglish } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { Button, Card, CardContent } from '../../../admin-web-components'
import type { SavedCustomer } from '../types'
import { customerStreet } from '../utils/fields'
import { useFormat } from '../../../i18n/useFormat'

interface CustomerCardProps {
  customer: SavedCustomer
  onEdit: (customer: SavedCustomer) => void
  onDelete: (customer: SavedCustomer) => void
}

/** One saved customer on the Customers page: name, phone, street and when an order last used it. */
export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const lastUsed = new Date(customer.lastUsedAt)
  const ago = formatDistanceToNow(lastUsed, {
    addSuffix: true,
    locale: format.language === 'el' ? dateFnsGreek : dateFnsEnglish,
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h2 className="truncate text-base font-semibold">{customer.name}</h2>
          <p className="text-sm">{customer.phone}</p>
          <p className="text-sm text-muted-foreground">
            <span className="break-words">{customerStreet(customer)}</span>
            {' · '}
            {/* <time> gives the exact moment to assistive tech and tools; the text is the friendly form. */}
            <time dateTime={customer.lastUsedAt}>{t('customers.usedAgo', { ago })}</time>
          </p>
          {customer.pinMovedByRiderAt ? (
            // Row 99: a rider stood at the door and moved the pin there (spec 0016). The restaurant sees
            // it, and setting a different point itself clears it.
            <p className="text-sm text-muted-foreground" data-testid="pin-moved-by-rider">
              {t('customers.pinMovedByRider')}{' '}
              <time dateTime={customer.pinMovedByRiderAt}>{format.dateTime(customer.pinMovedByRiderAt)}</time>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(customer)}
            // Every card has an Edit button, so the name says whose; it starts with the visible word.
            aria-label={t('customers.editNamed', { name: customer.name })}
          >
            <PencilSimple className="mr-1.5 size-4" aria-hidden="true" />
            {t('customers.edit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDelete(customer)}
            // The button shows only an icon, so this is the name a screen reader says.
            aria-label={t('customers.deleteNamed', { name: customer.name })}
          >
            <Trash className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
