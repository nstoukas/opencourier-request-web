/**
 * CreateDeliveryForm
 *
 * The restaurant's order form (spec 0006): pick or type the customer, say when the order is ready,
 * type the total, Get price (a quote), then Send order (the delivery, from the same priced values).
 */
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Alert,
  AlertDescription,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
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
import { SavedCustomerPicker } from '../../saved-customers/components/SavedCustomerPicker'
import { PickedCustomerCard } from '../../saved-customers/components/PickedCustomerCard'
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
import {
  composeRiderNote,
  COUNTER_FROM_SHARE,
  FLOOR_AND_BELL_MAX,
  isQuoteExpired,
  isQuoteFailure,
  orderTotalProblem,
  parseEuroAmount,
  READY_IN_MINUTES,
  readyAtFromMinutes,
  RIDER_NOTE_MAX,
} from '../utils/orderForm'
import { AddressSection } from './AddressSection'
import { ChoicePillOption, ChoicePills } from './ChoicePills'
import { cn } from '../../../ui-shared-utils'
import { BarPhase, PriceSendBar } from './PriceSendBar'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import {
  checkPartnerPickupUsable,
  mapPartnerProfileToPickupValues,
} from '../../../utils/partnerProfilePickup'

// ─── Validation schema ────────────────────────────────────────────────────────

const addressSchema = z.object({
  streetAddress: z
    .array(z.string().refine((value) => value.trim() !== '', 'Search the address and pick a result, or type it'))
    .min(1),
  city: z.string().refine((value) => value.trim() !== '', 'Enter the town'),
  // Hidden: Volos addresses have none, and the backend accepts it empty (spec 0005).
  state: z.string(),
  zipCode: z.string().optional(),
  countryCode: z.string().length(2, 'Use 2-letter country code').transform((value) => value.toUpperCase()),
  // Hidden, and always sent empty for the drop off (spec 0006, Key invariants).
  houseNumber: z.string().optional(),
  /** OpenStreetMap Nominatim `display_name` when chosen from search or geocoder fallback. */
  formattedAddress: z.string().optional(),
})

const READY_IN_REQUIRED = 'Choose when the order is ready'

const formSchema = z.object({
  // Pickup
  // WARNING: These fields are still in the Zod schema but have no rendered inputs. checkPartnerPickupUsable must mirror their constraints.
  pickupName: z.string().min(1, 'Pickup contact name is required'),
  pickupPhoneNumber: z.string().min(7, 'Valid phone number required'),
  pickupBusinessName: z.string().min(1, 'Pickup business name is required'),
  pickupAddress: addressSchema,
  pickupLatitude: z.number({ invalid_type_error: 'Enter a valid latitude' }),
  pickupLongitude: z.number({ invalid_type_error: 'Enter a valid longitude' }),

  // The customer
  dropoffName: z.string().refine((value) => value.trim() !== '', 'Enter the customer name'),
  dropoffPhoneNumber: z.string().min(7, 'Valid phone number required'),
  dropoffAddress: addressSchema,
  dropoffLatitude: z.number({ invalid_type_error: 'Enter a valid latitude' }),
  dropoffLongitude: z.number({ invalid_type_error: 'Enter a valid longitude' }),
  // A form rule, not maxLength: a saved customer's longer text still shows, with a red counter (AC-8).
  floorAndBell: z.string().max(FLOOR_AND_BELL_MAX, `Keep this to ${FLOOR_AND_BELL_MAX} characters`),
  note: z.string().max(RIDER_NOTE_MAX, `Keep this to ${RIDER_NOTE_MAX} characters`),

  // The order
  readyInMinutes: z
    .number({ required_error: READY_IN_REQUIRED, invalid_type_error: READY_IN_REQUIRED })
    .refine((value) => (READY_IN_MINUTES as readonly number[]).includes(value), READY_IN_REQUIRED),
  packageSize: z.nativeEnum(ManualRequestPackageSize, { errorMap: () => ({ message: 'Select a package size' }) }),
  // The text as typed; the number is worked out at Get price (AC-4).
  orderTotal: z.string().superRefine((value, ctx) => {
    const problem = orderTotalProblem(value)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
  }),
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

function buildDefaultValues(): CreateDeliveryFormValues {
  return {
    pickupName: 'Pickup Contact',
    pickupPhoneNumber: '+10000000000',
    pickupBusinessName: 'Pickup Location',
    pickupAddress: defaultAddress,
    pickupLatitude: 0,
    pickupLongitude: 0,
    dropoffName: '',
    dropoffPhoneNumber: '',
    dropoffAddress: defaultAddress,
    dropoffLatitude: 0,
    dropoffLongitude: 0,
    floorAndBell: '',
    note: '',
    // No pill is chosen at the start: the restaurant must say when the order is ready (AC-6).
    readyInMinutes: undefined,
    packageSize: ManualRequestPackageSize.SMALL,
    orderTotal: '',
  }
}

// ─── The priced order ─────────────────────────────────────────────────────────

// Everything a price was made from (spec 0006, "The priced snapshot"). Send reads only from this, never
// from the live form, so the quote and the delivery cannot differ.
interface PricedOrder {
  // The form values as priced, with the looked up map points and full address text written in.
  values: CreateDeliveryFormValues
  // The ISO time worked out at the Get price tap.
  pickupReadyAt: string
  orderTotalValue: number
  quote: ManualRequestQuoteDto
}

// JSON text of a value with object keys in a fixed order, so two objects holding the same values
// compare equal whatever order their keys were set in.
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  )
}

// The values a price depends on. Left out: what the price step writes itself (the drop off map point
// and full address text) and the pickup values, which come from the profile.
function pricedValuesKey(values: CreateDeliveryFormValues): string {
  const {
    pickupName,
    pickupPhoneNumber,
    pickupBusinessName,
    pickupAddress,
    pickupLatitude,
    pickupLongitude,
    dropoffLatitude,
    dropoffLongitude,
    dropoffAddress,
    ...rest
  } = values
  const { formattedAddress, ...address } = dropoffAddress ?? defaultAddress
  return stableJson({ ...rest, dropoffAddress: address })
}

// A deep copy: react-hook-form changes its nested values in place, so a shallow copy would follow
// the live form. The values are plain text and numbers, so JSON copies them whole.
function copyValues(values: CreateDeliveryFormValues): CreateDeliveryFormValues {
  return JSON.parse(JSON.stringify(values))
}

function addressPayload(address: CreateDeliveryFormValues['pickupAddress']) {
  return {
    streetAddress: [address.streetAddress[0] ?? ''],
    city: address.city,
    state: address.state,
    zipCode: address.zipCode || '',
    countryCode: address.countryCode,
    houseNumber: address.houseNumber,
    formattedAddress: address.formattedAddress?.trim() || buildManualRequestFormattedAddress(address),
  }
}

// The body of both calls, the quote and the delivery, built from the same priced values (Key invariants).
function orderPayload(values: CreateDeliveryFormValues, pickupReadyAt: string, orderTotalValue: number): ManualRequestQuoteInput {
  const riderNote = composeRiderNote(values.floorAndBell, values.note)
  return {
    pickupName: values.pickupName?.trim() || 'Pickup Contact',
    pickupPhoneNumber: values.pickupPhoneNumber?.trim() || '+10000000000',
    pickupBusinessName: values.pickupBusinessName?.trim() || 'Pickup Location',
    pickupAddress: addressPayload(values.pickupAddress),
    pickupLatitude: values.pickupLatitude,
    pickupLongitude: values.pickupLongitude,
    pickupReadyAt,
    pickupDeadlineAt: null,
    dropoffName: values.dropoffName.trim(),
    dropoffPhoneNumber: values.dropoffPhoneNumber.trim(),
    // The rider app shows dropoffSellerNotes, admin shows dropoffNotes: the same text in both.
    dropoffNotes: riderNote,
    dropoffSellerNotes: riderNote,
    // houseNumber always empty: the backend shares one address row per street and point, so a doorbell
    // name written there would show on other restaurants' orders to the same building.
    dropoffAddress: { ...addressPayload(values.dropoffAddress), houseNumber: '' },
    dropoffLatitude: values.dropoffLatitude,
    dropoffLongitude: values.dropoffLongitude,
    dropoffReadyAt: null,
    dropoffDeadlineAt: null,
    packageSize: values.packageSize,
    orderTotalValue,
  }
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

// A failed call's message in plain words: the backend's own sentence, never a status code.
function plainErrorMessage(err: any, fallback: string) {
  const statusCode = err?.statusCode ?? err?.status
  if (statusCode === 401) {
    return 'Your session has expired or is not valid. Please sign in again.'
  }
  const message: string | undefined = err?.message
  return message && !/^Request failed \(HTTP \d+\)$/.test(message) ? message : fallback
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

// The fields Get price can refuse, in the order they appear on the page.
const FIELDS_IN_PAGE_ORDER = [
  'dropoffName',
  'dropoffPhoneNumber',
  'dropoffAddress.streetAddress.0',
  'dropoffAddress.city',
  'floorAndBell',
  'readyInMinutes',
  'packageSize',
  'orderTotal',
  'note',
] as const
type FocusableField = (typeof FIELDS_IN_PAGE_ORDER)[number]
// The fields hidden behind a picked customer's card until Edit.
const CUSTOMER_FIELDS: readonly FocusableField[] = FIELDS_IN_PAGE_ORDER.slice(0, 5)

const READY_IN_OPTIONS: ChoicePillOption[] = READY_IN_MINUTES.map((minutes) => ({
  value: String(minutes),
  label: minutes === 0 ? 'Now' : `${minutes} min`,
}))

const SIZE_OPTIONS: ChoicePillOption[] = [
  { value: ManualRequestPackageSize.SMALL, label: 'Small' },
  { value: ManualRequestPackageSize.MEDIUM, label: 'Medium' },
  { value: ManualRequestPackageSize.LARGE, label: 'Large' },
]

// "48 / 60" under a field once 80% of its limit is used; red over the limit (AC-8). The limit is a
// form rule, not maxLength, so a saved customer's longer text still shows whole.
function LimitCounter({ length, limit }: { length: number; limit: number }) {
  if (length < Math.ceil(limit * COUNTER_FROM_SHARE)) return null
  return (
    <p className={cn('text-right text-sm tabular-nums', length > limit ? 'text-destructive' : 'text-muted-foreground')}>
      {length} / {limit}
    </p>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateDeliveryForm() {
  const { toast } = useToast()
  const navigator = useRequestPageNavigator()

  // The price shown, and whether it has passed its expiresAt.
  const [priced, setPriced] = useState<PricedOrder | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  // A failed price or send, shown in the bar above the button.
  const [barError, setBarError] = useState<string | null>(null)
  // Saved customers (spec 0005): the customer picked for this order, if any, and the save tick.
  const [linkedCustomer, setLinkedCustomer] = useState<SavedCustomer | null>(null)
  // The picked customer's fields opened with Edit (spec 0006, AC-11).
  const [editingCustomer, setEditingCustomer] = useState(false)
  // The picked customer card's Change button, which the picker focuses after a pick.
  const changeRef = useRef<HTMLButtonElement>(null)
  // The fixed bar's height, and the refused field to focus once it is on the page.
  const [barHeight, setBarHeight] = useState(0)
  const [fieldToFocus, setFieldToFocus] = useState<FocusableField | null>(null)
  const [saveCustomer, setSaveCustomer] = useState(false)
  // True from Send until the page changes, so the customer save after the order cannot be
  // raced by a second Send (which would create a second delivery).
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
    // The form focuses the first refused field itself (handleInvalid), after opening what hides it.
    shouldFocusError: false,
  })

  // Runs after the render that showed the field (Edit may just have opened it), so its ref is there.
  useEffect(() => {
    if (!fieldToFocus) return
    form.setFocus(fieldToFocus)
    // `?.`: test browsers have no scrollIntoView.
    ;(document.activeElement as HTMLElement | null)?.scrollIntoView?.({ block: 'center' })
    setFieldToFocus(null)
  }, [fieldToFocus, form])

  // The watcher below reads the price through a ref: it is set up once, so a state value read there
  // would stay at what it was then.
  const pricedRef = useRef<PricedOrder | null>(null)
  const showPrice = useCallback((next: PricedOrder | null) => {
    pricedRef.current = next
    setPriced(next)
    setIsExpired(false)
  }, [])

  // A change by the restaurant drops the price, so no price is ever shown for other values (AC-12).
  useEffect(() => {
    const subscription = form.watch(() => {
      const current = pricedRef.current
      if (current && pricedValuesKey(current.values) !== pricedValuesKey(form.getValues())) showPrice(null)
    })
    return () => subscription.unsubscribe()
  }, [form, showPrice])

  // A price past its expiresAt, checked every 15 s while one is shown (and again at the Send tap).
  useEffect(() => {
    if (!priced?.quote.expiresAt) return
    const check = () => setIsExpired(isQuoteExpired(priced.quote))
    check()
    const timer = setInterval(check, 15_000)
    return () => clearInterval(timer)
  }, [priced])

  // Which drop off address the current map point belongs to (street, city, zip). The point is set by a
  // search pick or a picked saved customer; typing in those fields afterwards does not move it, so the
  // price step looks the address up again when they changed (spec 0005: a picked customer stays editable).
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

  const handleGetPrice = async (values: CreateDeliveryFormValues) => {
    setBarError(null)
    showPrice(null)

    if (!pickupCheck.usable) {
      setBarError(pickupCheck.reason ?? 'Your restaurant profile pickup address is not usable.')
      return
    }

    // Fixed here and reused at Send, so the delivery carries what the quote and its ETA used (AC-6).
    const pickupReadyAt = readyAtFromMinutes(values.readyInMinutes)
    const orderTotalValue = parseEuroAmount(values.orderTotal) ?? 0

    try {
      // AIFLOW-NOTE: pickupMapped is non-null here via pickupCheck.usable guard; fallback to values.pickupAddress is retained defensively.
      const pickupAddressSource = pickupMapped?.pickupAddress ?? values.pickupAddress
      const pickupLatSource = pickupMapped?.pickupLatitude ?? values.pickupLatitude
      const pickupLngSource = pickupMapped?.pickupLongitude ?? values.pickupLongitude

      const pickupCoordinates = hasValidCoordinates(pickupLatSource, pickupLngSource)
        ? { latitude: pickupLatSource, longitude: pickupLngSource }
        : await geocodeCoordinatesFromAddress(pickupAddressSource)
      const dropoffPointStillFits =
        hasValidCoordinates(values.dropoffLatitude, values.dropoffLongitude) &&
        addressPinKey(values.dropoffAddress) === dropoffPinKey
      // A typed address is looked up near the restaurant first (AC-10).
      const dropoffCoordinates = dropoffPointStillFits
        ? { latitude: values.dropoffLatitude, longitude: values.dropoffLongitude }
        : await geocodeCoordinatesFromAddress(values.dropoffAddress, pickupCoordinates ?? undefined)

      if (!pickupCoordinates || !dropoffCoordinates) {
        setBarError('This address was not found on the map. Search for it and pick a result.')
        return
      }

      const pickupFormatted = resolveSubmittedFormattedAddress(pickupAddressSource, pickupCoordinates)
      // A point looked up again belongs to a new address: its old full text must not come along.
      const dropoffFormatted = resolveSubmittedFormattedAddress(
        dropoffPointStillFits ? values.dropoffAddress : { ...values.dropoffAddress, formattedAddress: '' },
        dropoffCoordinates,
      )

      form.setValue('dropoffLatitude', dropoffCoordinates.latitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('dropoffLongitude', dropoffCoordinates.longitude, { shouldDirty: true, shouldValidate: true })
      if (dropoffFormatted) {
        form.setValue('dropoffAddress.formattedAddress', dropoffFormatted, { shouldDirty: true, shouldValidate: true })
      }

      // The values as priced: the live form with the looked up points, and the pickup from the profile.
      const pricedValues: CreateDeliveryFormValues = {
        ...copyValues(form.getValues()),
        pickupName: pickupMapped?.pickupName ?? values.pickupName,
        pickupPhoneNumber: pickupMapped?.pickupPhoneNumber ?? values.pickupPhoneNumber,
        pickupBusinessName: pickupMapped?.pickupBusinessName ?? values.pickupBusinessName,
        pickupAddress: { ...pickupAddressSource, formattedAddress: pickupFormatted },
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
      }

      const quote = await createQuote(orderPayload(pricedValues, pickupReadyAt, orderTotalValue))

      // The restaurant changed something while the price was on its way: it is not for these values.
      if (pricedValuesKey(pricedValues) !== pricedValuesKey(form.getValues())) {
        setBarError('Something changed while the price was on its way. Get the price again.')
        return
      }
      showPrice({ values: pricedValues, pickupReadyAt, orderTotalValue, quote })
    } catch (err: any) {
      setBarError(plainErrorMessage(err, 'The price could not be worked out. Try again.'))
    }
  }

  const handleSend = async () => {
    const order = pricedRef.current
    if (!order) return
    if (isQuoteExpired(order.quote)) {
      setIsExpired(true)
      return
    }
    setBarError(null)

    const payload: ManualRequestDeliveryInput = {
      ...orderPayload(order.values, order.pickupReadyAt, order.orderTotalValue),
      idempotencyKey: `${order.quote.id}-${Date.now()}`,
      quoteId: order.quote.id,
    }

    setIsFinishing(true)
    let deliveryId: string
    try {
      const delivery = await confirmDelivery(payload)
      deliveryId = delivery.id
    } catch (err: any) {
      setIsFinishing(false)
      // Refused because of the quote (expired or unknown): ask for a new price. Anything else keeps the price.
      if (isQuoteFailure(err)) {
        setIsExpired(true)
      } else {
        setBarError(plainErrorMessage(err, 'The order could not be sent. Try again.'))
      }
      return
    }

    // The order is sent. Now the saved customer (spec 0005, the order flow's step 2), from the
    // details the delivery was created with; it never throws, and never undoes the order.
    const outcome = await saveCustomerAfterOrder({
      fields: customerFieldsFromOrder(order.values),
      linkedCustomerId: linkedCustomer?.id ?? null,
      saveTicked: saveCustomer,
    })

    toast({
      title: 'Delivery created',
      description: `Delivery ${deliveryId} is now being processed.`,
    })

    // `as readonly string[]`: lets `includes` take any outcome, not only the three failure codes.
    const saveFailed = (CUSTOMER_SAVE_FAILURES as readonly string[]).includes(outcome)
    if (saveFailed) {
      navigator.goToManualRequestStatus(deliveryId, { query: { customerSave: outcome } })
    } else {
      navigator.goToManualRequestStatus(deliveryId)
    }
  }

  const handleDiscard = () => {
    showPrice(null)
  }

  // A picked customer fills the drop off fields (AC-3), with the coordinates, so the price needs no
  // address search. A price already shown was made from other details, so it goes.
  const handlePickCustomer = (customer: SavedCustomer) => {
    const values = orderValuesFromCustomer(customer)
    const options = { shouldDirty: true, shouldValidate: true }
    form.setValue('dropoffName', values.dropoffName, options)
    form.setValue('dropoffPhoneNumber', values.dropoffPhoneNumber, options)
    form.setValue('floorAndBell', values.floorAndBell, options)
    form.setValue('note', values.note, options)
    form.setValue('dropoffAddress', values.dropoffAddress, options)
    form.setValue('dropoffLatitude', values.dropoffLatitude, options)
    form.setValue('dropoffLongitude', values.dropoffLongitude, options)
    setLinkedCustomer(customer)
    setEditingCustomer(false)
    setSaveCustomer(true)
    if (pricedRef.current) handleDiscard()
  }

  // `Change`: the fields stay as they are, the order becomes a typed customer, the tick goes off.
  const handleUnlinkCustomer = () => {
    setLinkedCustomer(null)
    setEditingCustomer(false)
    setSaveCustomer(false)
    if (pricedRef.current) handleDiscard()
  }

  const phase: BarPhase =
    isConfirming || isFinishing
      ? 'sending'
      : isQuoting
        ? 'pricing'
        : priced
          ? isExpired
            ? 'expired'
            : 'priced'
          : 'needs-price'

  // The first field Get price refused: shown (Edit opens for a picked customer's fields), scrolled to the
  // middle of the screen, never under the bar, and focused (AC-13).
  const handleInvalid = () => {
    const first = FIELDS_IN_PAGE_ORDER.find((name) => form.getFieldState(name).error)
    if (!first) return
    if (linkedCustomer && CUSTOMER_FIELDS.includes(first)) setEditingCustomer(true)
    setFieldToFocus(first)
  }

  // Enter in a field submits the form: it asks for a price, but never re-prices a price on show.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (phase === 'priced' || phase === 'sending' || phase === 'pricing') {
      event.preventDefault()
      return
    }
    return form.handleSubmit(handleGetPrice, handleInvalid)(event)
  }

  // The customer's own fields show with no customer picked, or after Edit on the picked card (AC-11).
  const showCustomerFields = !linkedCustomer || editingCustomer
  const pickupPoint =
    pickupMapped && hasValidCoordinates(pickupMapped.pickupLatitude, pickupMapped.pickupLongitude)
      ? { latitude: pickupMapped.pickupLatitude, longitude: pickupMapped.pickupLongitude }
      : undefined

  return (
    <Form {...form}>
      {/* Bottom padding as tall as the fixed bar, so the last field is never under it (below 768 px). */}
      <form
        noValidate
        onSubmit={handleSubmit}
        style={{ '--bar-height': `${barHeight}px` } as React.CSSProperties}
        className="space-y-6 pb-[var(--bar-height)] md:pb-0"
      >
        {/* ── From: the restaurant's pickup, from its profile (AC-5) ───────── */}
        <div data-testid="pickup-readonly">
          {isProfileLoading ? (
            <p className="text-sm text-muted-foreground">Loading your restaurant&apos;s details…</p>
          ) : profileError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {profileError instanceof Error ? profileError.message : 'Your restaurant’s details could not be loaded.'}
              </AlertDescription>
            </Alert>
          ) : !pickupCheck.usable ? (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="font-medium">{pickupCheck.reason}</p>
                <p>Only a co-op admin can set your restaurant&apos;s pickup details</p>
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground break-words">
              From: {profile?.name}, {pickupMapped?.pickupAddress.formattedAddress || '—'}
            </p>
          )}
        </div>

        {/* ── The customer ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <SavedCustomerPicker linked={linkedCustomer} onPick={handlePickCustomer} changeRef={changeRef} />

          {linkedCustomer ? (
            <PickedCustomerCard
              customer={linkedCustomer}
              editing={editingCustomer}
              onEdit={() => setEditingCustomer(true)}
              onChange={handleUnlinkCustomer}
              changeRef={changeRef}
            />
          ) : null}

          {showCustomerFields ? (
            <>
              <FormField
                control={form.control}
                name="dropoffName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer name</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" className="h-12 text-base" {...field} />
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="off"
                        placeholder="e.g. 691 234 5678"
                        className="h-12 text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Remounted when a saved customer is picked or unlinked, so its search box shows that
                  customer's address instead of what was typed there before. */}
              <AddressSection
                key={linkedCustomer?.id ?? 'typed'}
                control={form.control}
                prefix="dropoff"
                label="Address"
                initialQuery={linkedCustomer ? form.getValues('dropoffAddress.formattedAddress') ?? '' : ''}
                near={pickupPoint}
                defaultTown={profile?.pickupAddress?.city ?? ''}
              />

              <FormField
                control={form.control}
                name="floorAndBell"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Floor and doorbell <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="3rd floor, Papadopoulou"
                        className="h-12 text-base"
                        {...field}
                      />
                    </FormControl>
                    <LimitCounter length={field.value?.length ?? 0} limit={FLOOR_AND_BELL_MAX} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
        </div>

        {/* ── The order ───────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="readyInMinutes"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ChoicePills
                  ref={field.ref}
                  label="Ready in"
                  options={READY_IN_OPTIONS}
                  value={field.value === undefined || field.value === null ? '' : String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="packageSize"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ChoicePills
                  ref={field.ref}
                  label="Size"
                  options={SIZE_OPTIONS}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="orderTotal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order total</FormLabel>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground"
                >
                  €
                </span>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-12 pl-8 text-base"
                    {...field}
                  />
                </FormControl>
              </div>
              <FormDescription>0 if it is free</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Note for the rider <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Ring twice, dog in the yard"
                  className="resize-none text-base"
                  {...field}
                />
              </FormControl>
              <LimitCounter length={field.value?.length ?? 0} limit={RIDER_NOTE_MAX} />
              <FormMessage />
            </FormItem>
          )}
        />

        <SaveCustomerTick checked={saveCustomer} onCheckedChange={setSaveCustomer} />

        <PriceSendBar
          phase={phase}
          quote={priced?.quote ?? null}
          pricedAddress={priced?.values.dropoffAddress.formattedAddress || null}
          error={barError}
          disabled={!pickupCheck.usable}
          onSend={handleSend}
          onHeightChange={setBarHeight}
        />
      </form>
    </Form>
  )
}
