/**
 * CreateDeliveryForm
 *
 * Full form for creating a manual delivery request.
 * Flow: Fill form → Get Estimate (quote) → Review EstimateSummaryCard → Confirm
 */
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  useToast,
} from '../../../admin-web-components'
import {
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
  usePartnerProfileQuery,
} from '../../../api/manualRequestApi'
import {
  buildManualRequestFormattedAddress,
  ManualRequestDeliveryInput,
  ManualRequestPackageSize,
  ManualRequestQuoteDto,
  ManualRequestQuoteInput,
} from '../types'
import { EstimateSummaryCard } from './EstimateSummaryCard'
import { SavedCustomerPicker, LinkedCustomer } from '../../saved-customers/components/SavedCustomerPicker'
import { SaveCustomerTick } from '../../saved-customers/components/SaveCustomerTick'
import type { SavedCustomer } from '../../saved-customers/types'
import {
  customerFieldsFromOrder,
  DEFAULT_COUNTRY_CODE,
  orderValuesFromCustomer,
} from '../../saved-customers/utils/fields'
import { CUSTOMER_SAVE_FAILURES, saveCustomerAfterOrder } from '../../saved-customers/utils/saveAfterOrder'
import {
  addressPinKey,
  geocodeCoordinatesFromAddress,
  GeocodeCoordinatesResult,
  hasValidCoordinates,
} from '../utils/geocode'
import { AddressSection } from './AddressSection'
import { ErrorBanner } from './ErrorBanner'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import {
  checkPartnerPickupUsable,
  mapPartnerProfileToPickupValues,
} from '../../../utils/partnerProfilePickup'

// ─── Validation schema ────────────────────────────────────────────────────────

const addressSchema = z.object({
  streetAddress: z.array(z.string().min(1, 'Required')).min(1),
  city: z.string().min(1, 'City is required'),
  // Optional: Volos addresses have none, and the backend accepts it empty (spec 0005).
  state: z.string(),
  zipCode: z.string().optional(),
  countryCode: z.string().length(2, 'Use 2-letter country code').transform((value) => value.toUpperCase()),
  houseNumber: z.string().optional(),
  /** OpenStreetMap Nominatim `display_name` when chosen from search or geocoder fallback. */
  formattedAddress: z.string().optional(),
})

const packageTypeOptions = [
  { value: 'DOCUMENTS', label: 'Documents' },
  { value: 'FOOD', label: 'Food' },
  { value: 'GROCERIES', label: 'Groceries' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'OTHER', label: 'Other' },
] as const

type PackageTypeValue = (typeof packageTypeOptions)[number]['value']

const formSchema = z.object({
  // Pickup
  // WARNING: These fields are still in the Zod schema but have no rendered inputs. checkPartnerPickupUsable must mirror their constraints.
  pickupName: z.string().min(1, 'Pickup contact name is required'),
  pickupPhoneNumber: z.string().min(7, 'Valid phone number required'),
  pickupBusinessName: z.string().min(1, 'Pickup business name is required'),
  pickupNotes: z.string().optional(),
  pickupAddress: addressSchema,
  pickupLatitude: z.number({ invalid_type_error: 'Enter a valid latitude' }),
  pickupLongitude: z.number({ invalid_type_error: 'Enter a valid longitude' }),
  pickupReadyAt: z.string().optional(),
  pickupDeadlineAt: z.string().optional(),

  // Dropoff
  dropoffName: z.string().min(1, 'Dropoff contact name is required'),
  dropoffPhoneNumber: z.string().min(7, 'Valid phone number required'),
  dropoffBusinessName: z.string().optional(),
  dropoffNotes: z.string().optional(),
  dropoffAddress: addressSchema,
  dropoffLatitude: z.number({ invalid_type_error: 'Enter a valid latitude' }),
  dropoffLongitude: z.number({ invalid_type_error: 'Enter a valid longitude' }),
  dropoffReadyAt: z.string().optional(),
  dropoffDeadlineAt: z.string().optional(),

  // Package
  packageType: z.enum(['DOCUMENTS', 'FOOD', 'GROCERIES', 'PHARMACY', 'RETAIL', 'OTHER']),
  packageTypeOther: z.string().optional(),
  packageDescription: z.string().optional(),
  packageSize: z.nativeEnum(ManualRequestPackageSize, { errorMap: () => ({ message: 'Select a package size' }) }),
  specialInstructions: z.string().optional(),
  orderReference: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.packageType === 'OTHER' && !value.packageTypeOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['packageTypeOther'],
      message: 'Please provide package type',
    })
  }
})

export type CreateDeliveryFormValues = z.infer<typeof formSchema>

// ─── Default values ───────────────────────────────────────────────────────────

const defaultAddress = {
  streetAddress: [''],
  city: '',
  state: '',
  zipCode: '',
  countryCode: DEFAULT_COUNTRY_CODE,
  houseNumber: '',
  formattedAddress: '',
}

// An <input type="datetime-local"> reads its value as LOCAL wall-clock time, but
// toISOString() converts to UTC first — so building the default that way subtracted
// the timezone offset and produced a deadline in the PAST (UTC+3 in Greece meant
// "one hour from now" rendered as two hours ago). Build the local fields by hand.
export function defaultDeadlineDatetimeLocal(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  // padStart keeps single digits two characters wide ("7" -> "07"), which the input requires.
  const pad = (n: number) => String(n).padStart(2, '0')
  // getMonth() counts from 0 (January), hence the + 1.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function buildDefaultValues(): CreateDeliveryFormValues {
  const deadline = defaultDeadlineDatetimeLocal()
  return {
    pickupName: 'Pickup Contact',
    pickupPhoneNumber: '+10000000000',
    pickupBusinessName: 'Pickup Location',
    pickupNotes: '',
    pickupAddress: defaultAddress,
    pickupLatitude: 0,
    pickupLongitude: 0,
    pickupReadyAt: '',
    pickupDeadlineAt: deadline,
    dropoffName: '',
    dropoffPhoneNumber: '',
    dropoffBusinessName: '',
    dropoffNotes: '',
    dropoffAddress: defaultAddress,
    dropoffLatitude: 0,
    dropoffLongitude: 0,
    dropoffReadyAt: '',
    dropoffDeadlineAt: deadline,
    packageType: 'DOCUMENTS',
    packageTypeOther: '',
    packageDescription: '',
    packageSize: ManualRequestPackageSize.SMALL,
    specialInstructions: '',
    orderReference: '',
  }
}


// ─── Component ────────────────────────────────────────────────────────────────

function resolvePackageDescription(values: CreateDeliveryFormValues) {
  if (values.packageType === 'OTHER') {
    return values.packageTypeOther?.trim() || values.packageDescription?.trim() || undefined
  }

  const match = packageTypeOptions.find((item) => item.value === values.packageType)
  return match?.label ?? values.packageType
}

function fromDatetimeLocal(value: string | undefined): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

/** Prefer Nominatim display line (same style as OSM search results). */
function resolveSubmittedFormattedAddress(
  addr: CreateDeliveryFormValues['pickupAddress'],
  geocode: GeocodeCoordinatesResult | null | undefined,
): string {
  return (
    geocode?.displayName?.trim() ||
    addr.formattedAddress?.trim() ||
    buildManualRequestFormattedAddress(addr)
  )
}

export function CreateDeliveryForm() {
  const { toast } = useToast()
  const navigator = useRequestPageNavigator()

  const [activeQuote, setActiveQuote] = useState<ManualRequestQuoteDto | null>(null)
  const [formSnapshot, setFormSnapshot] = useState<CreateDeliveryFormValues | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Saved customers (spec 0005): the customer picked for this order, if any, and the save tick.
  const [linkedCustomer, setLinkedCustomer] = useState<LinkedCustomer | null>(null)
  const [saveCustomer, setSaveCustomer] = useState(false)
  // True from Confirm until the page changes, so the customer save after the order cannot be
  // raced by a second Confirm (which would create a second delivery).
  const [isFinishing, setIsFinishing] = useState(false)

  const { data: profile, isLoading: isProfileLoading, error: profileError } = usePartnerProfileQuery()
  const [createQuote, { isLoading: isQuoting }] = useCreateManualRequestQuoteMutation()
  const [confirmDelivery, { isLoading: isConfirming }] = useConfirmManualRequestDeliveryMutation()

  const pickupMapped = useMemo(
    () => (profile ? mapPartnerProfileToPickupValues(profile) : null),
    [profile]
  )

  const form = useForm<CreateDeliveryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(),
  })

  // Which drop off address the current map point belongs to (street, city, zip). The point is set by a
  // search pick or a picked saved customer; typing in those fields afterwards does not move it, so the
  // estimate looks the address up again when they changed (spec 0005: a picked customer stays editable).
  const dropoffLatitude = form.watch('dropoffLatitude')
  const dropoffLongitude = form.watch('dropoffLongitude')
  const [dropoffPinKey, setDropoffPinKey] = useState('')
  useEffect(() => {
    setDropoffPinKey(addressPinKey(form.getValues('dropoffAddress')))
  }, [dropoffLatitude, dropoffLongitude, form])

  useEffect(() => {
    if (pickupMapped && checkPartnerPickupUsable(profile).usable) {
      form.reset({
        ...form.getValues(),
        ...pickupMapped,
      })
    }
  }, [pickupMapped, form, profile])

  const pickupCheck = checkPartnerPickupUsable(profile)

  const getDebugErrorMessage = (err: any, fallback: string) => {
    const statusCode = err?.statusCode ?? err?.status
    if (statusCode === 401) {
      return 'Your session has expired or is not valid. Please sign in again.'
    }
    return err?.message ?? fallback
  }

  const handleGetEstimate = async (values: CreateDeliveryFormValues) => {
    setErrorMessage(null)
    setActiveQuote(null)

    if (!pickupCheck.usable) {
      setErrorMessage(pickupCheck.reason ?? 'Your restaurant profile pickup address is not usable.')
      return
    }

    try {
      // AIFLOW-NOTE: pickupMapped is non-null here via pickupCheck.usable guard; fallback to values.pickupAddress is retained defensively.
      const pickupAddressSource = pickupMapped?.pickupAddress ?? values.pickupAddress
      const pickupLatSource = pickupMapped?.pickupLatitude ?? values.pickupLatitude
      const pickupLngSource = pickupMapped?.pickupLongitude ?? values.pickupLongitude
      const pickupNameSource = pickupMapped?.pickupName ?? values.pickupName
      const pickupPhoneSource = pickupMapped?.pickupPhoneNumber ?? values.pickupPhoneNumber
      const pickupBusinessSource = pickupMapped?.pickupBusinessName ?? values.pickupBusinessName

      const packageDescription = resolvePackageDescription(values)
      const pickupCoordinates = hasValidCoordinates(pickupLatSource, pickupLngSource)
        ? { latitude: pickupLatSource, longitude: pickupLngSource }
        : await geocodeCoordinatesFromAddress(pickupAddressSource)
      const dropoffPointStillFits =
        hasValidCoordinates(values.dropoffLatitude, values.dropoffLongitude) &&
        addressPinKey(values.dropoffAddress) === dropoffPinKey
      const dropoffCoordinates = dropoffPointStillFits
        ? { latitude: values.dropoffLatitude, longitude: values.dropoffLongitude }
        : await geocodeCoordinatesFromAddress(values.dropoffAddress)

      if (!pickupCoordinates || !dropoffCoordinates) {
        setErrorMessage('Could not determine coordinates from one or more addresses. Use address search and select a result.')
        return
      }

      const pickupFormatted = resolveSubmittedFormattedAddress(pickupAddressSource, pickupCoordinates)
      // A point looked up again belongs to a new address: its old full text must not come along.
      const dropoffFormatted = resolveSubmittedFormattedAddress(
        dropoffPointStillFits ? values.dropoffAddress : { ...values.dropoffAddress, formattedAddress: '' },
        dropoffCoordinates,
      )

      form.setValue('pickupLatitude', pickupCoordinates.latitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('pickupLongitude', pickupCoordinates.longitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('dropoffLatitude', dropoffCoordinates.latitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('dropoffLongitude', dropoffCoordinates.longitude, { shouldDirty: true, shouldValidate: true })
      if (pickupFormatted) {
        form.setValue('pickupAddress.formattedAddress', pickupFormatted, { shouldDirty: true, shouldValidate: true })
      }
      if (dropoffFormatted) {
        form.setValue('dropoffAddress.formattedAddress', dropoffFormatted, { shouldDirty: true, shouldValidate: true })
      }

      const payload: ManualRequestQuoteInput = {
        pickupName: pickupNameSource?.trim() || 'Pickup Contact',
        pickupPhoneNumber: pickupPhoneSource?.trim() || '+10000000000',
        pickupBusinessName: pickupBusinessSource?.trim() || 'Pickup Location',
        pickupNotes: values.pickupNotes,
        pickupAddress: {
          streetAddress: [pickupAddressSource.streetAddress[0] ?? ''],
          city: pickupAddressSource.city,
          state: pickupAddressSource.state,
          zipCode: pickupAddressSource.zipCode || '',
          countryCode: pickupAddressSource.countryCode,
          houseNumber: pickupAddressSource.houseNumber,
          formattedAddress: pickupFormatted,
        },
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
        pickupReadyAt: fromDatetimeLocal(values.pickupReadyAt),
        pickupDeadlineAt: fromDatetimeLocal(values.pickupDeadlineAt),
        dropoffName: values.dropoffName ?? '',
        dropoffPhoneNumber: values.dropoffPhoneNumber ?? '',
        dropoffBusinessName: values.dropoffBusinessName,
        dropoffNotes: values.dropoffNotes,
        dropoffAddress: {
          streetAddress: [values.dropoffAddress.streetAddress[0] ?? ''],
          city: values.dropoffAddress.city,
          state: values.dropoffAddress.state,
          zipCode: values.dropoffAddress.zipCode || '',
          countryCode: values.dropoffAddress.countryCode,
          houseNumber: values.dropoffAddress.houseNumber,
          formattedAddress: dropoffFormatted,
        },
        dropoffLatitude: dropoffCoordinates.latitude,
        dropoffLongitude: dropoffCoordinates.longitude,
        dropoffReadyAt: fromDatetimeLocal(values.dropoffReadyAt),
        dropoffDeadlineAt: fromDatetimeLocal(values.dropoffDeadlineAt),
        packageDescription,
        packageSize: values.packageSize,
        specialInstructions: values.specialInstructions,
        orderReference: values.orderReference,
      }

      const quote = await createQuote(payload)
      setActiveQuote(quote)
      setFormSnapshot({
        ...values,
        pickupName: pickupNameSource,
        pickupPhoneNumber: pickupPhoneSource,
        pickupBusinessName: pickupBusinessSource,
        pickupAddress: {
          ...pickupAddressSource,
          formattedAddress: pickupFormatted,
        },
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
        dropoffLatitude: dropoffCoordinates.latitude,
        dropoffLongitude: dropoffCoordinates.longitude,
        dropoffAddress: {
          ...values.dropoffAddress,
          formattedAddress: dropoffFormatted,
        },
      })
    } catch (err: any) {
      setErrorMessage(getDebugErrorMessage(err, 'Failed to get estimate. Check inputs and try again.'))
    }
  }

  const handleConfirm = async () => {
    if (!activeQuote || !formSnapshot) return
    setErrorMessage(null)
    try {
      const packageDescription = resolvePackageDescription(formSnapshot)

      const payload: ManualRequestDeliveryInput = {
        pickupName: formSnapshot.pickupName?.trim() || 'Pickup Contact',
        pickupPhoneNumber: formSnapshot.pickupPhoneNumber?.trim() || '+10000000000',
        pickupBusinessName: formSnapshot.pickupBusinessName?.trim() || 'Pickup Location',
        pickupNotes: formSnapshot.pickupNotes,
        pickupAddress: {
          streetAddress: [formSnapshot.pickupAddress.streetAddress[0] ?? ''],
          city: formSnapshot.pickupAddress.city,
          state: formSnapshot.pickupAddress.state,
          zipCode: formSnapshot.pickupAddress.zipCode || '',
          countryCode: formSnapshot.pickupAddress.countryCode,
          houseNumber: formSnapshot.pickupAddress.houseNumber,
          formattedAddress:
            formSnapshot.pickupAddress.formattedAddress?.trim() ||
            buildManualRequestFormattedAddress(formSnapshot.pickupAddress),
        },
        pickupLatitude: formSnapshot.pickupLatitude,
        pickupLongitude: formSnapshot.pickupLongitude,
        pickupReadyAt: fromDatetimeLocal(formSnapshot.pickupReadyAt),
        pickupDeadlineAt: fromDatetimeLocal(formSnapshot.pickupDeadlineAt),
        dropoffName: formSnapshot.dropoffName ?? '',
        dropoffPhoneNumber: formSnapshot.dropoffPhoneNumber ?? '',
        dropoffBusinessName: formSnapshot.dropoffBusinessName,
        dropoffNotes: formSnapshot.dropoffNotes,
        dropoffAddress: {
          streetAddress: [formSnapshot.dropoffAddress.streetAddress[0] ?? ''],
          city: formSnapshot.dropoffAddress.city,
          state: formSnapshot.dropoffAddress.state,
          zipCode: formSnapshot.dropoffAddress.zipCode || '',
          countryCode: formSnapshot.dropoffAddress.countryCode,
          houseNumber: formSnapshot.dropoffAddress.houseNumber,
          formattedAddress:
            formSnapshot.dropoffAddress.formattedAddress?.trim() ||
            buildManualRequestFormattedAddress(formSnapshot.dropoffAddress),
        },
        dropoffLatitude: formSnapshot.dropoffLatitude,
        dropoffLongitude: formSnapshot.dropoffLongitude,
        dropoffReadyAt: fromDatetimeLocal(formSnapshot.dropoffReadyAt),
        dropoffDeadlineAt: fromDatetimeLocal(formSnapshot.dropoffDeadlineAt),
        packageDescription,
        packageSize: formSnapshot.packageSize,
        specialInstructions: formSnapshot.specialInstructions,
        orderReference: formSnapshot.orderReference,
        idempotencyKey: formSnapshot.orderReference?.trim() || `${activeQuote.id}-${Date.now()}`,
        quoteId: activeQuote.id,
      }

      setIsFinishing(true)
      const delivery = await confirmDelivery(payload)

      // The order is sent. Now the saved customer (spec 0005, the order flow's step 2), from the
      // details the delivery was created with; it never throws, and never undoes the order.
      const outcome = await saveCustomerAfterOrder({
        fields: customerFieldsFromOrder(formSnapshot),
        linkedCustomerId: linkedCustomer?.id ?? null,
        saveTicked: saveCustomer,
      })

      toast({
        title: 'Delivery created',
        description: `Delivery ${delivery.id} is now being processed.`,
      })

      // `as readonly string[]`: lets `includes` take any outcome, not only the three failure codes.
      const saveFailed = (CUSTOMER_SAVE_FAILURES as readonly string[]).includes(outcome)
      if (saveFailed) {
        navigator.goToManualRequestStatus(delivery.id, { query: { customerSave: outcome } })
      } else {
        navigator.goToManualRequestStatus(delivery.id)
      }
    } catch (err: any) {
      setIsFinishing(false)
      setErrorMessage(getDebugErrorMessage(err, 'Failed to confirm delivery. The quote may have expired.'))
    }
  }

  const handleDiscard = () => {
    setActiveQuote(null)
    setFormSnapshot(null)
  }

  // A picked customer fills the drop off fields (AC-3), with the coordinates, so the estimate needs no
  // address search. An estimate already shown was made from other details, so it goes.
  const handlePickCustomer = (customer: SavedCustomer) => {
    const values = orderValuesFromCustomer(customer)
    const options = { shouldDirty: true, shouldValidate: true }
    form.setValue('dropoffName', values.dropoffName, options)
    form.setValue('dropoffPhoneNumber', values.dropoffPhoneNumber, options)
    form.setValue('dropoffNotes', values.dropoffNotes, options)
    form.setValue('dropoffAddress', values.dropoffAddress, options)
    form.setValue('dropoffLatitude', values.dropoffLatitude, options)
    form.setValue('dropoffLongitude', values.dropoffLongitude, options)
    setLinkedCustomer({ id: customer.id, name: customer.name })
    setSaveCustomer(true)
    if (activeQuote) handleDiscard()
  }

  // `Change`: the fields stay as they are, the order becomes a typed customer, the tick goes off.
  const handleUnlinkCustomer = () => {
    setLinkedCustomer(null)
    setSaveCustomer(false)
    if (activeQuote) handleDiscard()
  }

  const selectedPackageType = form.watch('packageType') as PackageTypeValue

  return (
    <div className="space-y-6 max-w-3xl">
      {errorMessage && (
        <ErrorBanner
          title="Could not process request"
          message={errorMessage}
          detail={errorMessage}
        />
      )}

      {/* Show estimate card when quote is ready */}
      {activeQuote && (
        <EstimateSummaryCard
          quote={activeQuote}
          isConfirming={isConfirming || isFinishing}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
        />
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleGetEstimate)} className="space-y-6">

          {/* ── Package ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="packageSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Size</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ManualRequestPackageSize.SMALL}>Small</SelectItem>
                          <SelectItem value={ManualRequestPackageSize.MEDIUM}>Medium</SelectItem>
                          <SelectItem value={ManualRequestPackageSize.LARGE}>Large</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="packageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select package type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {packageTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedPackageType === 'OTHER' && (
                <FormField
                  control={form.control}
                  name="packageTypeOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Package Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Short type name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="specialInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Handle with care"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="packageDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Package Details (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional short details" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Pickup ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pickup — your restaurant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div data-testid="pickup-readonly" className="rounded-md border p-4 text-sm bg-muted/30 space-y-3">
                {isProfileLoading ? (
                  <p className="text-muted-foreground">Loading your restaurant&apos;s details…</p>
                ) : profileError ? (
                  <ErrorBanner
                    title="Could not load profile"
                    message={profileError instanceof Error ? profileError.message : 'Failed to load profile.'}
                  />
                ) : !pickupCheck.usable ? (
                  <div className="space-y-1">
                    <p className="text-destructive font-medium">{pickupCheck.reason}</p>
                    <p className="text-muted-foreground">
                      Only a co-op admin can set your restaurant&apos;s pickup details — please contact them.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                          Restaurant
                        </span>
                        <span className="font-medium text-foreground">{profile?.name}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                          Phone
                        </span>
                        <span className="font-medium text-foreground">{profile?.phoneNumber || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                        Pickup address
                      </span>
                      <span className="font-medium text-foreground">
                        {pickupMapped?.pickupAddress.formattedAddress || '—'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      These come from your restaurant&apos;s profile. Only a co-op admin can change them.
                    </p>
                  </>
                )}
              </div>

              <FormField
                control={form.control}
                name="pickupNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ring bell, ask for front desk"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="pickupReadyAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ready At (optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pickupDeadlineAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline (optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Dropoff ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dropoff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SavedCustomerPicker
                linked={linkedCustomer}
                onPick={handlePickCustomer}
                onUnlink={handleUnlinkCustomer}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="dropoffName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. JOHN DOE" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dropoffPhoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+1 555 000 0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dropoffBusinessName"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Business or building name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Company or building name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Remounted when a saved customer is picked or unlinked, so its search box shows that
                  customer's address instead of what was typed there before. */}
              <AddressSection
                key={linkedCustomer?.id ?? 'typed'}
                control={form.control}
                prefix="dropoff"
                label="Dropoff address"
                initialQuery={linkedCustomer ? form.getValues('dropoffAddress.formattedAddress') ?? '' : ''}
              />

              <FormField
                control={form.control}
                name="dropoffNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dropoff Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Leave at reception" className="resize-none" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="dropoffReadyAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ready At (optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dropoffDeadlineAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline (optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <SaveCustomerTick checked={saveCustomer} onCheckedChange={setSaveCustomer} />
            </CardContent>
          </Card>

          {/* ── Submit ──────────────────────────────────────────────────── */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isQuoting || !pickupCheck.usable} size="lg">
              {isQuoting && <Spinner className="mr-2" />}
              {isQuoting ? 'Getting Estimate…' : 'Get Estimate'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
