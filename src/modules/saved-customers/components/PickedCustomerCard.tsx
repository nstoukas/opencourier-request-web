import React from 'react'
import { UserCircle } from '@phosphor-icons/react'
import { Button, Card } from '../../../admin-web-components'
import type { SavedCustomer } from '../types'
import { customerStreet } from '../utils/fields'

interface PickedCustomerCardProps {
  customer: SavedCustomer
  // The detail fields are open below the card (after Edit): the card then shows only the name and Change.
  editing: boolean
  onEdit: () => void
  // `Change`: the order goes back to a typed customer (today's unlink).
  onChange: () => void
  // The picker moves focus here after a pick, as it did to its own Change button (spec 0005).
  changeRef?: React.Ref<HTMLButtonElement>
}

/**
 * The order form's customer part once a saved customer is picked (spec 0006, AC-11): one short card
 * with the name, phone, street, and floor and doorbell, and Edit and Change. It owns the only Change
 * button on the page while a customer is linked.
 */
export function PickedCustomerCard({ customer, editing, onEdit, onChange, changeRef }: PickedCustomerCardProps) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <UserCircle className="mt-0.5 size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-0.5 break-words">
          <p className="font-medium">{customer.name}</p>
          {editing ? (
            <p className="text-sm text-muted-foreground">Saved customer. Edit the details below.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{customer.phone}</p>
              <p className="text-sm">{customerStreet(customer)}</p>
              {customer.addressLine2?.trim() ? <p className="text-sm">{customer.addressLine2}</p> : null}
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {editing ? null : (
          <Button type="button" variant="outline" size="xl" className="flex-1" onClick={onEdit}>
            Edit
          </Button>
        )}
        <Button ref={changeRef} type="button" variant="outline" size="xl" className="flex-1" onClick={onChange}>
          Change
        </Button>
      </div>
    </Card>
  )
}
