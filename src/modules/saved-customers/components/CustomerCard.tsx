import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { Button, Card, CardContent } from '../../../admin-web-components'
import type { SavedCustomer } from '../types'
import { customerStreet } from '../utils/fields'

interface CustomerCardProps {
  customer: SavedCustomer
  onEdit: (customer: SavedCustomer) => void
  onDelete: (customer: SavedCustomer) => void
}

/** One saved customer on the Customers page: name, phone, street and when an order last used it. */
export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
  const lastUsed = new Date(customer.lastUsedAt)

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
            <time dateTime={customer.lastUsedAt}>used {formatDistanceToNow(lastUsed, { addSuffix: true })}</time>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(customer)}
            // Every card has an Edit button, so the name says whose; it starts with the visible word.
            aria-label={`Edit ${customer.name}`}
          >
            <PencilSimple className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDelete(customer)}
            // The button shows only an icon, so this is the name a screen reader says.
            aria-label={`Delete ${customer.name}`}
          >
            <Trash className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
