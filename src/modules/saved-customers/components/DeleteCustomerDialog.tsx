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
} from '../../../admin-web-components'
import { deleteSavedCustomer } from '../../../api/savedCustomersApi'
import type { SavedCustomer, SavedCustomerError } from '../types'

interface DeleteCustomerDialogProps {
  customer: SavedCustomer
  onClose: () => void
  // Called once the customer is gone (deleted now, or already deleted elsewhere: a 404).
  onDeleted: (id: string) => void
}

/** Asks first, naming the customer, then deletes for good (spec 0005, AC-2). */
export function DeleteCustomerDialog({ customer, onClose, onDeleted }: DeleteCustomerDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await deleteSavedCustomer(customer.id)
      onDeleted(customer.id)
    } catch (err) {
      if ((err as SavedCustomerError).statusCode === 404) {
        onDeleted(customer.id)
        return
      }
      setError('The customer could not be deleted. Try again in a moment.')
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {customer.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their saved name, phone and address are removed for good. Past orders keep their own copy.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction, so the dialog stays open until the delete is done. */}
          <Button variant="destructive" onClick={confirm} disabled={isDeleting}>
            {isDeleting ? <Spinner className="mr-2" label="Deleting" /> : null}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
