import React, { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { WarningCircle } from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Spinner,
  Textarea,
} from '../../../admin-web-components'
import { AddressSection } from '../../manual-request/components/AddressSection'
import { addressPinKey, geocodeCoordinatesFromAddress, hasValidCoordinates } from '../../manual-request/utils/geocode'
import { addSavedCustomer, listSavedCustomers, updateSavedCustomer } from '../../../api/savedCustomersApi'
import type { SavedCustomer, SavedCustomerError, SavedCustomerFields } from '../types'
import { DEFAULT_COUNTRY_CODE, phoneSearchDigits } from '../utils/fields'

// The dialog's own small form. The address uses the order form's field names (`dropoffAddress`,
// `dropoffLatitude`, `dropoffLongitude`) so AddressSection can be reused unchanged in its compact mode.
const dialogSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name"),
  phone: z.string().trim().min(1, "Enter the customer's phone"),
  notes: z.string().optional(),
  dropoffAddress: z.object({
    streetAddress: z.array(z.string().trim().min(1, 'Enter the street and number')).min(1),
    houseNumber: z.string().optional(),
    city: z.string().trim().min(1, 'Enter the city'),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    countryCode: z.string().optional(),
    formattedAddress: z.string().optional(),
  }),
  dropoffLatitude: z.number(),
  dropoffLongitude: z.number(),
})
type DialogValues = z.infer<typeof dialogSchema>

function initialValues(customer: SavedCustomer | null): DialogValues {
  return {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    notes: customer?.notes ?? '',
    dropoffAddress: {
      streetAddress: [customer?.addressLine1 ?? ''],
      houseNumber: customer?.addressLine2 ?? '',
      city: customer?.city ?? '',
      state: '',
      zipCode: customer?.zipCode ?? '',
      countryCode: DEFAULT_COUNTRY_CODE,
      formattedAddress: customer?.formattedAddress ?? '',
    },
    dropoffLatitude: customer?.latitude ?? 0,
    dropoffLongitude: customer?.longitude ?? 0,
  }
}

// Where the map point came from: see addressPinKey.
const pinKey = (values: Pick<DialogValues, 'dropoffAddress'>) => addressPinKey(values.dropoffAddress)

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

interface CustomerDialogProps {
  // Null adds a customer; a customer edits it.
  customer: SavedCustomer | null
  onClose: () => void
  onSaved: (customer: SavedCustomer) => void
  // An edit answered 404: the customer was deleted elsewhere.
  onGone: (id: string) => void
}

/**
 * Add or edit a saved customer on the Customers page (spec 0005, AC-2 and AC-4). Refusals are shown
 * in the dialog and keep what was typed; a phone another saved customer has names that customer.
 */
export function CustomerDialog({ customer, onClose, onSaved, onGone }: CustomerDialogProps) {
  const isEdit = customer !== null
  const form = useForm<DialogValues>({
    resolver: zodResolver(dialogSchema),
    defaultValues: initialValues(customer),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Where the map point came from: the customer as loaded, then each pick from the address search.
  const latitude = form.watch('dropoffLatitude')
  const longitude = form.watch('dropoffLongitude')
  const [pinnedKey, setPinnedKey] = useState(() => pinKey(initialValues(customer)))
  useEffect(() => {
    // A new point (a pick) belongs to the address as it is now.
    setPinnedKey(pinKey(form.getValues()))
  }, [latitude, longitude, form])

  const initialQuery = useMemo(() => customer?.formattedAddress ?? '', [customer])

  const save = async (values: DialogValues) => {
    setError(null)
    setIsSaving(true)
    try {
      let { dropoffLatitude: lat, dropoffLongitude: lng } = values
      let formattedAddress = optional(values.dropoffAddress.formattedAddress)
      // Typed by hand, or changed since the point was set: look the address up, as the order form does.
      if (!hasValidCoordinates(lat, lng) || pinKey(values) !== pinnedKey) {
        const found = await geocodeCoordinatesFromAddress(values.dropoffAddress).catch(() => null)
        if (!found) {
          setError('Search the address and pick a result.')
          return
        }
        lat = found.latitude
        lng = found.longitude
        // A new lookup's own text, or none: never the old address's text beside a new street.
        formattedAddress = found.displayName ?? null
      }

      const fields: SavedCustomerFields = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        notes: optional(values.notes),
        addressLine1: values.dropoffAddress.streetAddress[0].trim(),
        addressLine2: optional(values.dropoffAddress.houseNumber),
        city: values.dropoffAddress.city.trim(),
        zipCode: optional(values.dropoffAddress.zipCode),
        latitude: lat,
        longitude: lng,
        formattedAddress,
      }
      const saved = isEdit ? await updateSavedCustomer(customer.id, fields) : await addSavedCustomer(fields)
      onSaved(saved)
    } catch (err) {
      const failure = err as SavedCustomerError
      if (isEdit && failure.statusCode === 404) {
        onGone(customer.id)
        return
      }
      if (failure.statusCode === 409) {
        setError(await clashMessage(values.phone, failure.conflictingCustomerId))
        return
      }
      // A 422's message is a plain sentence written for the restaurant; anything else gets a general one.
      setError(
        failure.statusCode === 422 && failure.message
          ? failure.message
          : 'The customer could not be saved. Try again in a moment.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    // onOpenChange(false) is Radix closing the dialog (Escape, the X, a click outside).
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit customer' : 'Add customer'}</DialogTitle>
          <DialogDescription>Only your restaurant sees saved customers.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="off" placeholder="e.g. 691 234 5678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AddressSection control={form.control} prefix="dropoff" label="Address" compact initialQuery={initialQuery} />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notes for the rider <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={2} className="resize-none" placeholder="e.g. Ring twice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error ? (
              <Alert variant="destructive">
                <WarningCircle className="size-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Spinner className="mr-2" label="Saving" /> : null}
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// The 409's sentence: the other customer by name and phone when the list can find them (spec 0005).
async function clashMessage(typedPhone: string, conflictingCustomerId: string | undefined): Promise<string> {
  const base = 'Another saved customer has this phone'
  const digits = phoneSearchDigits(typedPhone)
  if (!conflictingCustomerId || digits.length < 2) return `${base}.`
  try {
    const result = await listSavedCustomers({ q: digits, perPage: 50 })
    const other = result.items.find((item) => item.id === conflictingCustomerId)
    return other ? `${base}: ${other.name}, ${other.phone}.` : `${base}.`
  } catch {
    return `${base}.`
  }
}
