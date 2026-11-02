import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { PinMap } from '../../manual-request/components/PinMap'
import { LimitCounter } from '../../manual-request/components/LimitCounter'
import {
  ADDRESS_NOT_FOUND_ON_MAP,
  addressPinKey,
  hasValidCoordinates,
  lookUpPinForAddress,
} from '../../manual-request/utils/geocode'
import {
  ConfirmedPin,
  DOORBELL_MAX,
  FLOOR_MAX,
  GeoPoint,
  isPinConfirmed,
  VOLOS_CENTRE,
} from '../../manual-request/utils/orderForm'
import { addSavedCustomer, listSavedCustomers, updateSavedCustomer } from '../../../api/savedCustomersApi'
import type { SavedCustomer, SavedCustomerError, SavedCustomerFields } from '../types'
import { DEFAULT_COUNTRY_CODE, phoneSearchDigits } from '../utils/fields'

// The dialog's own small form. The address uses the order form's field names (`dropoffAddress`,
// `dropoffLatitude`, `dropoffLongitude`) so AddressSection can be reused unchanged in its compact mode.
const dialogSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name"),
  phone: z.string().trim().min(1, "Enter the customer's phone"),
  notes: z.string().optional(),
  // Spec 0016: the floor and the name on the doorbell, the backend's column sizes.
  floor: z.string().max(FLOOR_MAX, `Keep this to ${FLOOR_MAX} characters`).optional(),
  doorbell: z.string().max(DOORBELL_MAX, `Keep this to ${DOORBELL_MAX} characters`).optional(),
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
    floor: customer?.floor ?? '',
    doorbell: customer?.doorbell ?? '',
    dropoffAddress: {
      streetAddress: [customer?.addressLine1 ?? ''],
      houseNumber: '',
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

export const CONFIRM_PIN_MESSAGE = 'Confirm the pin on the map'
export const MOVE_FALLBACK_FIRST = "The map shows Volos centre. Move it to the customer's entrance first."

// A customer as loaded counts as confirmed (spec 0016, AC-6): its point was confirmed when it was saved,
// or moved there by a rider. A new customer starts with nothing confirmed.
function loadedPin(customer: SavedCustomer | null): ConfirmedPin | null {
  if (!customer) return null
  return { latitude: customer.latitude, longitude: customer.longitude, pinKey: pinKey(initialValues(customer)) }
}

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

  // The pin (spec 0016, AC-6): confirmed only while the form holds exactly the confirmed point and address.
  const latitude = form.watch('dropoffLatitude')
  const longitude = form.watch('dropoffLongitude')
  const currentPinKey = addressPinKey(form.watch('dropoffAddress'))
  const [confirmedPin, setConfirmedPin] = useState<ConfirmedPin | null>(() => loadedPin(customer))
  const pinConfirmed = isPinConfirmed(confirmedPin, latitude, longitude, currentPinKey)
  const [pinMessage, setPinMessage] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  // The map was opened at Volos centre (the address was not found) and not moved yet: refused as a pin.
  const [fallbackUnmoved, setFallbackUnmoved] = useState(false)

  // Which address the current point belongs to: the customer as loaded, then each pick or lookup. A ref,
  // set in the same pass of effects as the check below, so a search pick never reads as an edit.
  const pointPinKeyRef = useRef(pinKey(initialValues(customer)))
  useEffect(() => {
    pointPinKeyRef.current = pinKey(form.getValues())
  }, [latitude, longitude, form])
  // The street, city or postcode changed after the point was set: the point belonged to the old address.
  useEffect(() => {
    if (currentPinKey === pointPinKeyRef.current) return
    if (!hasValidCoordinates(form.getValues('dropoffLatitude'), form.getValues('dropoffLongitude'))) return
    form.setValue('dropoffLatitude', 0)
    form.setValue('dropoffLongitude', 0)
    // The old point's full address text goes with it, so the old street is never saved beside a new one.
    form.setValue('dropoffAddress.formattedAddress', '')
    setPinMessage(null)
    setFallbackUnmoved(false)
  }, [currentPinKey, form])

  // "Show on map" for a typed address: the lookup near Volos; not found, the map opens at Volos centre.
  const showOnMap = async () => {
    const valid = await form.trigger(['dropoffAddress.streetAddress.0', 'dropoffAddress.city'])
    if (!valid) return
    setIsLocating(true)
    setPinMessage(null)
    const keyAtStart = pinKey(form.getValues())
    try {
      const result = await lookUpPinForAddress(form.getValues('dropoffAddress'), VOLOS_CENTRE, VOLOS_CENTRE)
      // The street was edited while the lookup ran: its answer is for the old address.
      if (pinKey(form.getValues()) !== keyAtStart) return
      if ('error' in result) {
        setPinMessage(result.error)
        return
      }
      if (result.formattedAddress) form.setValue('dropoffAddress.formattedAddress', result.formattedAddress)
      form.setValue('dropoffLatitude', result.point.latitude)
      form.setValue('dropoffLongitude', result.point.longitude)
      setPinMessage(result.message)
      setFallbackUnmoved(result.message === ADDRESS_NOT_FOUND_ON_MAP)
    } finally {
      setIsLocating(false)
    }
  }

  const movePin = (center: GeoPoint) => {
    form.setValue('dropoffLatitude', center.latitude)
    form.setValue('dropoffLongitude', center.longitude)
    setFallbackUnmoved(false)
  }

  const confirmPin = () => {
    if (fallbackUnmoved) {
      setPinMessage(MOVE_FALLBACK_FIRST)
      return
    }
    setConfirmedPin({ latitude, longitude, pinKey: currentPinKey })
    setPinMessage(null)
    if (error === CONFIRM_PIN_MESSAGE) setError(null)
  }

  const initialQuery = useMemo(() => customer?.formattedAddress ?? '', [customer])

  const save = async (values: DialogValues) => {
    // No save for a pin nobody checked on the map (spec 0016, AC-6). Save never looks an address up.
    if (!pinConfirmed) {
      setError(CONFIRM_PIN_MESSAGE)
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const fields: SavedCustomerFields = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        notes: optional(values.notes),
        addressLine1: values.dropoffAddress.streetAddress[0].trim(),
        floor: optional(values.floor),
        doorbell: optional(values.doorbell),
        city: values.dropoffAddress.city.trim(),
        zipCode: optional(values.dropoffAddress.zipCode),
        latitude: values.dropoffLatitude,
        longitude: values.dropoffLongitude,
        formattedAddress: optional(values.dropoffAddress.formattedAddress),
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

            {hasValidCoordinates(latitude, longitude) ? (
              <PinMap
                center={{ latitude, longitude }}
                confirmed={pinConfirmed}
                onMove={movePin}
                onConfirm={confirmPin}
                message={pinMessage}
              />
            ) : (
              <div className="space-y-2">
                {pinMessage ? (
                  <p role="alert" className="text-sm text-destructive">
                    {pinMessage}
                  </p>
                ) : null}
                <Button type="button" variant="outline" className="w-full" onClick={showOnMap} disabled={isLocating}>
                  {isLocating ? 'Finding the address…' : 'Show on map'}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>
                      Floor <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input autoComplete="off" placeholder="3" {...field} />
                    </FormControl>
                    <LimitCounter length={field.value?.length ?? 0} limit={FLOOR_MAX} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="doorbell"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>
                      Name on the doorbell <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input autoComplete="off" placeholder="Papadopoulou" {...field} />
                    </FormControl>
                    <LimitCounter length={field.value?.length ?? 0} limit={DOORBELL_MAX} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
