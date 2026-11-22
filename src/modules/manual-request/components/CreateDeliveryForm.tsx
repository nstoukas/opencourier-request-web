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
import { useTranslation } from 'react-i18next'
// TFunction is the type of i18next's `t`, so the plain functions below can take it as a parameter.
import type { TFunction } from 'i18next'
import {
  Alert,
  AlertDescription,
  Button,
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
  lookUpPinForAddress,
  ADDRESS_NOT_FOUND_ON_MAP,
} from '../utils/geocode'
import {
  composeAdminNote,
  ConfirmedPin,
  DOORBELL_MAX,
  euroAmountToCents,
  FLOOR_MAX,
  GeoPoint,
  isPinConfirmed,
  isQuoteExpired,
  isQuoteFailure,
  orderTotalProblem,
  isReadyInMinutes,
  readyInOptions,
  readyAtFromMinutes,
  RIDER_NOTE_MAX,
  riderNoteText,
  VOLOS_CENTRE,
} from '../utils/orderForm'
import { AddressSection } from './AddressSection'
import { PinMap } from './PinMap'
import { LimitCounter } from './LimitCounter'
import { ChoicePillOption, ChoicePills } from './ChoicePills'
import { OrderItemsSection } from './OrderItemsSection'
import {
  ITEM_LINES_MAX,
  ITEM_NAME_MAX,
  ITEM_NAME_REQUIRED,
  ITEM_NAME_TOO_LONG,
  ITEM_QUANTITY_MAX,
  orderItemsPayload,
} from '../utils/orderItems'
import { cn } from '../../../ui-shared-utils'
import { BarPhase, PriceSendBar } from './PriceSendBar'
import { BOX_COUNTS, MAX_BOXES, legDeliveryInput, legLabel, orderReferenceForLegs } from '../utils/legs'
import { PartnerAvailability } from '../types'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import {
  checkPartnerPickupUsable,
  mapPartnerProfileToPickupValues,
} from '../../../utils/partnerProfilePickup'
import { serverMessage } from '../../../i18n/serverText'

// ─── Validation schema ────────────────────────────────────────────────────────

// The schema is built from `t`, so every refusal is worded in the reader's language (row 47). The form
// builds it once per language (useMemo below); the shape never changes, only the words.
const buildAddressSchema = (t: TFunction) => z.object({
  streetAddress: z
    .array(z.string().refine((value) => value.trim() !== '', t('form.streetRequired')))
    .min(1),
  city: z.string().refine((value) => value.trim() !== '', t('form.townRequired')),
  // Hidden: Volos addresses have none, and the backend accepts it empty (spec 0005).
  state: z.string(),
  zipCode: z.string().optional(),
  countryCode: z.string().length(2, t('form.countryCode')).transform((value) => value.toUpperCase()),
  // Hidden, and always sent empty for the drop off (spec 0006, Key invariants).
  houseNumber: z.string().optional(),
  /** OpenStreetMap Nominatim `display_name` when chosen from search or geocoder fallback. */
  formattedAddress: z.string().optional(),
})

// The translation key of the box size refusal. Spec 0043 (AC-4): the box size is the restaurant's choice
// every time; nothing is picked for it.
export const BOX_SIZE_REQUIRED = 'form.boxSizeRequired'

// A function that returns the schema: `t` turns each key into the reader's words.
function buildFormSchema(t: TFunction) {
  const addressSchema = buildAddressSchema(t)
  const readyInRequired = t('form.readyInRequired')
  const boxSizeRequired = t(BOX_SIZE_REQUIRED)
  const phoneRequired = t('form.phoneRequired')
  return z.object({
  // Pickup
  // WARNING: These fields are still in the Zod schema but have no rendered inputs. checkPartnerPickupUsable must mirror their constraints.
  pickupName: z.string().min(1, t('form.pickupNameRequired')),
  pickupPhoneNumber: z.string().min(7, phoneRequired),
  pickupBusinessName: z.string().min(1, t('form.pickupBusinessRequired')),
  pickupAddress: addressSchema,
  pickupLatitude: z.number({ invalid_type_error: t('form.latitudeInvalid') }),
  pickupLongitude: z.number({ invalid_type_error: t('form.longitudeInvalid') }),

  // The customer
  dropoffName: z.string().refine((value) => value.trim() !== '', t('form.customerNameRequired')),
  dropoffPhoneNumber: z.string().min(7, phoneRequired),
  dropoffAddress: addressSchema,
  dropoffLatitude: z.number({ invalid_type_error: t('form.latitudeInvalid') }),
  dropoffLongitude: z.number({ invalid_type_error: t('form.longitudeInvalid') }),
  // Form rules, not maxLength: a saved customer's longer text still shows, with a red counter (spec 0016, AC-1).
  floor: z.string().max(FLOOR_MAX, t('form.keepTo', { max: FLOOR_MAX })),
  doorbell: z.string().max(DOORBELL_MAX, t('form.keepTo', { max: DOORBELL_MAX })),
  note: z.string().max(RIDER_NOTE_MAX, t('form.keepTo', { max: RIDER_NOTE_MAX })),

  // The order
  readyInMinutes: z
    .number({ required_error: readyInRequired, invalid_type_error: readyInRequired })
    .refine((value) => isReadyInMinutes(value), readyInRequired),
  // Spec 0043 (AC-4): the box size, sent as boxSize. The co-op's settings turn it into box units, so a
  // rider is never sent with a box that is already too full.
  packageSize: z.nativeEnum(ManualRequestPackageSize, { errorMap: () => ({ message: boxSizeRequired }) }),
  // Spec 0046 (AC-2): "How many boxes?", 1 to 4. Above 1 the order goes as that many deliveries ("legs"),
  // each priced and paid in full; packageSize is box 1's size and moreBoxSizes holds boxes 2 onwards,
  // kept at boxCount - 1 entries when the count changes.
  boxCount: z.number().int().min(1).max(MAX_BOXES),
  moreBoxSizes: z.array(
    z.nativeEnum(ManualRequestPackageSize, { errorMap: () => ({ message: boxSizeRequired }) }),
  ),
  // Spec 0028: optional item lines, each named, with a quantity and an optional Drink or Side mark.
  items: z
    .array(
      z.object({
        name: z
          .string()
          .refine((value) => value.trim() !== '', t(ITEM_NAME_REQUIRED))
          .refine((value) => value.trim().length <= ITEM_NAME_MAX, t(ITEM_NAME_TOO_LONG, { max: ITEM_NAME_MAX })),
        quantity: z.number().int().min(1).max(ITEM_QUANTITY_MAX),
        kind: z.enum(['DRINK', 'SIDE']).nullable(),
      }),
    )
    .max(ITEM_LINES_MAX),
  // The text as typed; the number is worked out at Get price (AC-4).
  orderTotal: z.string().superRefine((value, ctx) => {
    const problem = orderTotalProblem(value)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: t(problem) })
  }),
  })
}

// `ReturnType<typeof buildFormSchema>` is the schema's type; z.infer turns it into the values' type.
export type CreateDeliveryFormValues = z.infer<ReturnType<typeof buildFormSchema>>

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
    floor: '',
    doorbell: '',
    note: '',
    // No pill is chosen at the start: the restaurant must say when the order is ready (AC-6).
    readyInMinutes: undefined,
    // No size is chosen at the start (spec 0043, AC-4): a preset Small would send a big bag as small.
    packageSize: undefined,
    // One box, the usual order (spec 0046, AC-2).
    boxCount: 1,
    moreBoxSizes: [],
    items: [],
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
  // The typed total in whole cents.
  orderTotalValue: number
  // Box 1's quote; the only one for a single box.
  quote: ManualRequestQuoteDto
  // Spec 0046 (AC-2): one quote per box, box 1's first. Each leg is priced on its own.
  quotes: ManualRequestQuoteDto[]
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

// The values a price depends on, the drop off point included: moving the pin drops the price (spec 0016,
// AC-5). Left out: the full address text, which the price step fills in for the payload, and the pickup
// values, which come from the profile.
function pricedValuesKey(values: CreateDeliveryFormValues): string {
  const {
    pickupName,
    pickupPhoneNumber,
    pickupBusinessName,
    pickupAddress,
    pickupLatitude,
    pickupLongitude,
    dropoffAddress,
    // Spec 0028: items are not on the quote, so editing them never drops a price; Send reads them live.
    items,
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
    // The rider app shows dropoffSellerNotes: the note alone, since floor and doorbell have their own
    // fields (spec 0016, AC-2). Admin shows dropoffNotes, which keeps them on a first line.
    dropoffNotes: composeAdminNote(values.floor, values.doorbell, values.note),
    dropoffSellerNotes: riderNoteText(values.note),
    dropoffFloor: values.floor?.trim() || null,
    dropoffDoorbell: values.doorbell?.trim() || null,
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

// A failed call's message in plain words: the backend's own sentence (through serverMessage, where its
// error codes will be translated, spec 0054 AC-6), never a status code. A failure with no status (a
// timeout, a dropped connection) has only the browser's or our own English words for developers, so the
// caller's sentence shows instead (decision 47.6).
function plainErrorMessage(err: any, fallback: string, t: TFunction) {
  const statusCode = err?.statusCode ?? err?.status
  if (statusCode === 401) {
    return t('form.sessionExpired')
  }
  if (statusCode === undefined) return fallback
  const message = serverMessage(err)
  return message && !/^Request failed \(HTTP \d+\)$/.test(message) ? message : fallback
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

// The fields Get price can refuse, in the order they appear on the page.
const FIELDS_IN_PAGE_ORDER = [
  'dropoffName',
  'dropoffPhoneNumber',
  'dropoffAddress.streetAddress.0',
  'dropoffAddress.city',
  'floor',
  'doorbell',
  'readyInMinutes',
  'packageSize',
  'orderTotal',
  'note',
] as const
type FocusableField = (typeof FIELDS_IN_PAGE_ORDER)[number]
// The fields hidden behind a picked customer's card until Edit.
const CUSTOMER_FIELDS: readonly FocusableField[] = FIELDS_IN_PAGE_ORDER.slice(0, 6)

// The translation keys of two pin sentences, exported for the tests.
export const CONFIRM_PIN_MESSAGE = 'form.confirmPin'
export const MOVE_FALLBACK_FIRST = 'form.moveFallbackFirst'

// The Ready in pills for a restaurant whose usual time is `usual` (spec 0023, AC-2).
function readyInPills(usual: number | null | undefined, t: TFunction): ChoicePillOption[] {
  return readyInOptions(usual).map((minutes) => ({
    value: String(minutes),
    label: minutes === 0 ? t('form.readyNow') : t('common.minutes', { count: minutes }),
  }))
}

// Spec 0046 (AC-2): "How many boxes?", 1 to 4.
const BOX_COUNT_OPTIONS: ChoicePillOption[] = BOX_COUNTS.map((count) => ({ value: String(count), label: String(count) }))

// The three box sizes, each with its label's translation key.
const SIZE_OPTIONS: { value: ManualRequestPackageSize; labelKey: string }[] = [
  { value: ManualRequestPackageSize.SMALL, labelKey: 'form.sizeSmall' },
  { value: ManualRequestPackageSize.MEDIUM, labelKey: 'form.sizeMedium' },
  { value: ManualRequestPackageSize.LARGE, labelKey: 'form.sizeLarge' },
]
const sizeOptions = (t: TFunction): ChoicePillOption[] =>
  SIZE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))

// Spec 0043 (AC-4, cross check 5): one line per size, fixed words (not co-op settings), as translation
// keys (row 47): `text` is the key, translated where it is shown.
export const BOX_SIZE_DESCRIPTIONS: { size: ManualRequestPackageSize; text: string }[] = [
  { size: ManualRequestPackageSize.SMALL, text: 'form.sizeSmallHint' },
  { size: ManualRequestPackageSize.MEDIUM, text: 'form.sizeMediumHint' },
  { size: ManualRequestPackageSize.LARGE, text: 'form.sizeLargeHint' },
]

// ─── Component ────────────────────────────────────────────────────────────────

// `availability`: the restaurant's busy mode and pause, read by the page (spec 0029). While it is loading
// the form behaves as before; the server refuses a paused order either way.
export function CreateDeliveryForm({ availability }: { availability?: PartnerAvailability } = {}) {
  const { t } = useTranslation()
  // The schema in the reader's language, built again only when the language changes.
  const formSchema = useMemo(() => buildFormSchema(t), [t])
  // The resolver below reads the schema through this ref, so a language switch reaches validation too
  // (react-hook-form keeps the resolver it was first given).
  const formSchemaRef = useRef(formSchema)
  formSchemaRef.current = formSchema
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
  const [fieldToFocus, setFieldToFocus] = useState<
    FocusableField | `items.${number}.name` | `moreBoxSizes.${number}` | null
  >(null)
  const [saveCustomer, setSaveCustomer] = useState(false)
  // True from Send until the page changes, so the customer save after the order cannot be
  // raced by a second Send (which would create a second delivery).
  const [isFinishing, setIsFinishing] = useState(false)
  // True for the whole of Get price, the address lookup included (the quote's own isLoading starts after it).
  const [isPricing, setIsPricing] = useState(false)

  const { data: profile, isLoading: isProfileLoading, error: profileError } = usePartnerProfileQuery()
  const [createQuote, { isLoading: isQuoting }] = useCreateManualRequestQuoteMutation()
  const [confirmDelivery, { isLoading: isConfirming }] = useConfirmManualRequestDeliveryMutation()

  const pickupMapped = useMemo(
    () => (profile ? mapPartnerProfileToPickupValues(profile) : null),
    [profile]
  )

  const form = useForm<CreateDeliveryFormValues>({
    resolver: (values, context, options) => zodResolver(formSchemaRef.current)(values, context, options),
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
    // Any leg's price past its time makes the whole order need new prices (spec 0046).
    const check = () => setIsExpired(priced.quotes.some((quote) => isQuoteExpired(quote)))
    check()
    const timer = setInterval(check, 15_000)
    return () => clearInterval(timer)
  }, [priced])

  // ── The drop off pin (spec 0016, AC-4 and AC-5) ──
  // The point the order goes to is the one the restaurant confirmed on the map. `confirmedPin` holds that
  // point and the address it was confirmed for; the pin counts as confirmed only while the form still
  // holds both, so a drag of the map or an edit of the street undoes it by itself.
  const dropoffLatitude = form.watch('dropoffLatitude')
  const dropoffLongitude = form.watch('dropoffLongitude')
  const currentPinKey = addressPinKey(form.watch('dropoffAddress'))
  const [confirmedPin, setConfirmedPin] = useState<ConfirmedPin | null>(null)
  const pinConfirmed = isPinConfirmed(confirmedPin, dropoffLatitude, dropoffLongitude, currentPinKey)
  const hasDropoffPoint = hasValidCoordinates(dropoffLatitude, dropoffLongitude)
  // The translation key of a sentence above the map (an address the lookup did not find), and "Show on
  // map" running.
  const [pinMessage, setPinMessage] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  // The map was opened at the restaurant (the address was not found) and not moved yet: that point is
  // the restaurant's own door, so confirming it as the customer's is refused until the map is moved.
  const [fallbackUnmoved, setFallbackUnmoved] = useState(false)
  const pinMapRef = useRef<HTMLDivElement>(null)

  // Which address the current point belongs to (street, town, postcode). A ref, set in the same pass of
  // effects as the check below, so a search pick (address and point together) never reads as an edit.
  const pointPinKeyRef = useRef('')
  useEffect(() => {
    pointPinKeyRef.current = addressPinKey(form.getValues('dropoffAddress'))
  }, [dropoffLatitude, dropoffLongitude, form])
  // The street, town or postcode changed after the point was set: the point belonged to the old address,
  // so it goes, and the map with it, until the new address is shown on the map (AC-5).
  useEffect(() => {
    if (currentPinKey === pointPinKeyRef.current) return
    if (!hasValidCoordinates(form.getValues('dropoffLatitude'), form.getValues('dropoffLongitude'))) return
    form.setValue('dropoffLatitude', 0, { shouldDirty: true })
    form.setValue('dropoffLongitude', 0, { shouldDirty: true })
    // The full address text belonged to the old point too: never send the old street's text beside a
    // new street (it would be saved on the customer, where it is the line shown first).
    form.setValue('dropoffAddress.formattedAddress', '', { shouldDirty: true })
    setPinMessage(null)
    setFallbackUnmoved(false)
  }, [currentPinKey, form])

  useEffect(() => {
    if (pickupMapped && checkPartnerPickupUsable(profile).usable) {
      form.reset({
        ...form.getValues(),
        ...pickupMapped,
      })
    }
  }, [pickupMapped, form, profile])

  // Ready in starts on the restaurant's usual time once its profile has answered (spec 0023, AC-2), and
  // again after each order is sent, unless the restaurant already chose.
  const usualPrepMinutes = profile?.usualPrepMinutes
  const readyInChosen = form.watch('readyInMinutes')
  useEffect(() => {
    if (typeof usualPrepMinutes === 'number' && readyInChosen === undefined) {
      form.setValue('readyInMinutes', usualPrepMinutes)
    }
  }, [usualPrepMinutes, readyInChosen, form])

  const pickupCheck = checkPartnerPickupUsable(profile)
  // Spec 0046: how many boxes, so the form shows a size per box.
  const boxCount = form.watch('boxCount') ?? 1

  // Get price as a whole, address lookup included, counts as "a call runs" (AC-12): the button reads
  // "Getting price…" and is disabled until it ends, however it ends.
  const handleGetPrice = async (values: CreateDeliveryFormValues) => {
    setIsPricing(true)
    try {
      await priceOrder(values)
    } finally {
      setIsPricing(false)
    }
  }

  const priceOrder = async (values: CreateDeliveryFormValues) => {
    setBarError(null)
    showPrice(null)

    if (!pickupCheck.usable) {
      setBarError(t(pickupCheck.reason ?? 'form.pickupNotUsable'))
      return
    }

    // Spec 0029 (agy review): pressing Enter submits the form even with the button off, so say why here.
    if (availability?.acceptingOrders === false) {
      setBarError(availability.notAcceptingReason ?? t('form.notAccepting'))
      return
    }

    // No price for a pin nobody checked on the map (spec 0016, AC-5).
    if (!pinConfirmed) {
      setBarError(t(CONFIRM_PIN_MESSAGE))
      if (linkedCustomer) setEditingCustomer(true)
      if (pinMapRef.current) {
        // `?.`: test browsers have no scrollIntoView.
        pinMapRef.current.scrollIntoView?.({ block: 'center' })
      } else {
        setFieldToFocus('dropoffAddress.streetAddress.0')
      }
      return
    }

    // Fixed here and reused at Send, so the delivery carries what the quote and its ETA used (AC-6).
    const pickupReadyAt = readyAtFromMinutes(values.readyInMinutes)
    const orderTotalValue = euroAmountToCents(values.orderTotal) ?? 0

    try {
      // The profile's pickup when it is usable (checked above); the form's own copy is only a fallback.
      const pickupAddressSource = pickupMapped?.pickupAddress ?? values.pickupAddress
      const pickupLatSource = pickupMapped?.pickupLatitude ?? values.pickupLatitude
      const pickupLngSource = pickupMapped?.pickupLongitude ?? values.pickupLongitude

      // The drop off point is the confirmed pin, never looked up here (spec 0016, AC-5); only the pickup
      // can still need a lookup. It gets its own catch: a timeout or a dropped connection there would
      // otherwise put the browser's own words ("signal timed out") in the bar.
      let pickupCoordinates: { latitude: number; longitude: number } | null
      try {
        pickupCoordinates = hasValidCoordinates(pickupLatSource, pickupLngSource)
          ? { latitude: pickupLatSource, longitude: pickupLngSource }
          : await geocodeCoordinatesFromAddress(pickupAddressSource)
      } catch (lookupError) {
        setBarError(
          (lookupError as Error | undefined)?.name === 'TimeoutError'
            ? t('pin.lookupTimedOut')
            : t('pin.lookupFailed'),
        )
        return
      }

      if (!pickupCoordinates) {
        setBarError(t('form.addressNotFound'))
        return
      }

      const pickupFormatted = resolveSubmittedFormattedAddress(pickupAddressSource, pickupCoordinates)
      const dropoffFormatted = resolveSubmittedFormattedAddress(values.dropoffAddress, null)

      // The values as priced: the live form with its confirmed drop off pin, and the pickup from the profile.
      const livePricedValues = copyValues(form.getValues())
      const pricedValues: CreateDeliveryFormValues = {
        ...livePricedValues,
        dropoffAddress: { ...livePricedValues.dropoffAddress, formattedAddress: dropoffFormatted },
        pickupName: pickupMapped?.pickupName ?? values.pickupName,
        pickupPhoneNumber: pickupMapped?.pickupPhoneNumber ?? values.pickupPhoneNumber,
        pickupBusinessName: pickupMapped?.pickupBusinessName ?? values.pickupBusinessName,
        pickupAddress: { ...pickupAddressSource, formattedAddress: pickupFormatted },
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
      }

      // Spec 0046 (AC-2): one quote per box, all for the same addresses, asked together. The size is not
      // on the quote (spec 0043, cross check 4), so the legs' quotes differ only if the price moved.
      const quotePayload = orderPayload(pricedValues, pickupReadyAt, orderTotalValue)
      const quotes = await Promise.all(
        Array.from({ length: pricedValues.boxCount || 1 }, () => createQuote(quotePayload)),
      )
      const quote = quotes[0]

      // The restaurant changed something while the price was on its way: it is not for these values.
      if (pricedValuesKey(pricedValues) !== pricedValuesKey(form.getValues())) {
        setBarError(t('form.changedWhilePricing'))
        return
      }
      showPrice({ values: pricedValues, pickupReadyAt, orderTotalValue, quote, quotes })
    } catch (err: any) {
      setBarError(plainErrorMessage(err, t('form.priceFailed'), t))
    }
  }

  const handleSend = async () => {
    const order = pricedRef.current
    if (!order) return
    if (order.quotes.some((quote) => isQuoteExpired(quote))) {
      setIsExpired(true)
      return
    }
    setBarError(null)

    // Spec 0028: the item lines are read from the live form (editing them never drops the price), so they
    // are checked again here. Checked without waiting, so the valid path reaches "Sending…" in the same
    // tick as before and a second tap stays guarded; only a refusal waits, to show its messages.
    if (!formSchema.shape.items.safeParse(form.getValues('items')).success) {
      void form.trigger('items').then(() => handleInvalid())
      return
    }
    const payload: ManualRequestDeliveryInput = {
      ...orderPayload(order.values, order.pickupReadyAt, order.orderTotalValue),
      orderItems: orderItemsPayload(form.getValues('items'), order.values.packageSize),
      // Spec 0043 (AC-4): on the delivery only, never the quote (cross check 4); a size change drops the
      // price, so the priced snapshot always holds the size the restaurant last chose.
      boxSize: order.values.packageSize,
      idempotencyKey: `${order.quote.id}-${Date.now()}`,
      quoteId: order.quote.id,
    }

    setIsFinishing(true)
    let deliveryId: string
    // Spec 0046 (AC-3): the first leg that could not be sent after leg 1 was, if any.
    let legNotSent: number | null = null
    let legNotSentReason = ''
    try {
      if (order.quotes.length > 1) {
        const sent = await sendLegs(order, payload)
        deliveryId = sent.firstLegId
        legNotSent = sent.legNotSent
        legNotSentReason = sent.reason
      } else {
        const delivery = await confirmDelivery(payload)
        deliveryId = delivery.id
      }
    } catch (err: any) {
      setIsFinishing(false)
      // Refused because of the quote (expired or unknown): ask for a new price. Anything else keeps the price.
      if (isQuoteFailure(err)) {
        setIsExpired(true)
      } else {
        setBarError(plainErrorMessage(err, t('form.sendFailed'), t))
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

    if (legNotSent !== null) {
      // Spec 0046 (AC-3): leg 1 went, a later leg did not. The order page lists the legs, says which was never
      // sent, and offers Retry for it and Cancel for the ones sent.
      toast({
        title: t('form.legNotSentTitle', { leg: legLabel(legNotSent, order.quotes.length, t) }),
        description: [legNotSentReason, t('form.legNotSentHint')]
          .filter(Boolean)
          .join(' '),
      })
    } else {
      toast({
        title: order.quotes.length > 1 ? t('form.sentAsLegs', { count: order.quotes.length }) : t('form.deliveryCreated'),
        description: t('form.deliveryProcessing', { id: deliveryId }),
      })
    }

    // `as readonly string[]`: lets `includes` take any outcome, not only the three failure codes.
    const saveFailed = (CUSTOMER_SAVE_FAILURES as readonly string[]).includes(outcome)
    if (saveFailed) {
      navigator.goToManualRequestStatus(deliveryId, { query: { customerSave: outcome } })
    } else {
      navigator.goToManualRequestStatus(deliveryId)
    }
  }

  // Spec 0046 (AC-2, AC-3): the legs, one after another, leg 1 first, sharing one reference. Leg 1 failing
  // throws, as a single delivery does (nothing was sent). A later leg failing stops there: the legs already
  // sent stay, and the order page shows the rest as never sent.
  const sendLegs = async (order: PricedOrder, base: ManualRequestDeliveryInput) => {
    const legCount = order.quotes.length
    const sizes = [order.values.packageSize, ...order.values.moreBoxSizes]
    const orderReference = orderReferenceForLegs(order.quotes[0].id)
    const legInput = (index: number) =>
      legDeliveryInput(base, {
        legNumber: index + 1,
        legCount,
        quote: order.quotes[index],
        boxSize: sizes[index],
        orderReference,
      })
    const first = await confirmDelivery(legInput(0))
    for (let index = 1; index < legCount; index++) {
      try {
        await confirmDelivery(legInput(index))
      } catch (legError: any) {
        // Row 10 review: the backend's reason, so the restaurant knows why before it retries.
        return { firstLegId: first.id, legNotSent: index + 1, reason: plainErrorMessage(legError, '', t) }
      }
    }
    return { firstLegId: first.id, legNotSent: null, reason: '' }
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
    form.setValue('floor', values.floor, options)
    form.setValue('doorbell', values.doorbell, options)
    form.setValue('note', values.note, options)
    form.setValue('dropoffAddress', values.dropoffAddress, options)
    form.setValue('dropoffLatitude', values.dropoffLatitude, options)
    form.setValue('dropoffLongitude', values.dropoffLongitude, options)
    // A saved customer's point was confirmed when it was saved, or moved there by a rider (AC-5).
    setConfirmedPin({
      latitude: values.dropoffLatitude,
      longitude: values.dropoffLongitude,
      pinKey: addressPinKey(values.dropoffAddress),
    })
    setPinMessage(null)
    setLinkedCustomer(customer)
    setEditingCustomer(false)
    setSaveCustomer(true)
    if (pricedRef.current) handleDiscard()
  }

  // "Show on map" for a typed address (AC-4): the lookup, near the restaurant; not found, the map opens at
  // the restaurant (or Volos centre) and asks the restaurant to move it to the entrance.
  const handleShowOnMap = async () => {
    const valid = await form.trigger(['dropoffAddress.streetAddress.0', 'dropoffAddress.city'])
    if (!valid) return
    setIsLocating(true)
    setPinMessage(null)
    const keyAtStart = addressPinKey(form.getValues('dropoffAddress'))
    try {
      const result = await lookUpPinForAddress(form.getValues('dropoffAddress'), pickupPoint, pickupPoint ?? VOLOS_CENTRE)
      // The street was edited while the lookup ran: its answer is for the old address.
      if (addressPinKey(form.getValues('dropoffAddress')) !== keyAtStart) return
      if ('error' in result) {
        setPinMessage(result.error)
        return
      }
      if (result.formattedAddress) {
        form.setValue('dropoffAddress.formattedAddress', result.formattedAddress, { shouldDirty: true })
      }
      form.setValue('dropoffLatitude', result.point.latitude, { shouldDirty: true })
      form.setValue('dropoffLongitude', result.point.longitude, { shouldDirty: true })
      setPinMessage(result.message)
      setFallbackUnmoved(result.message === ADDRESS_NOT_FOUND_ON_MAP)
    } finally {
      setIsLocating(false)
    }
  }

  // The restaurant dragged the map: the pin's point is the map's centre now, not yet confirmed.
  const handlePinMove = (center: GeoPoint) => {
    form.setValue('dropoffLatitude', center.latitude, { shouldDirty: true })
    form.setValue('dropoffLongitude', center.longitude, { shouldDirty: true })
    setFallbackUnmoved(false)
  }

  const handlePinConfirm = () => {
    if (fallbackUnmoved) {
      setPinMessage(MOVE_FALLBACK_FIRST)
      return
    }
    setConfirmedPin({ latitude: dropoffLatitude, longitude: dropoffLongitude, pinKey: currentPinKey })
    setPinMessage(null)
    if (barError === t(CONFIRM_PIN_MESSAGE)) setBarError(null)
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
      : isPricing || isQuoting
        ? 'pricing'
        : priced
          ? isExpired
            ? 'expired'
            : 'priced'
          : 'needs-price'

  // The first field Get price refused: shown (Edit opens for a picked customer's fields), scrolled to the
  // middle of the screen, never under the bar, and focused (AC-13).
  const handleInvalid = () => {
    // The item lines sit between Size and Order total (spec 0028).
    const itemNames = form.getValues('items').map((_line, index) => `items.${index}.name` as const)
    // Spec 0046: the sizes of boxes 2 onwards come right after box 1's size.
    const boxSizeNames = form.getValues('moreBoxSizes').map((_size, index) => `moreBoxSizes.${index}` as const)
    const inOrder = [...FIELDS_IN_PAGE_ORDER.slice(0, 8), ...boxSizeNames, ...itemNames, ...FIELDS_IN_PAGE_ORDER.slice(8)]
    const first = inOrder.find((name) => form.getFieldState(name).error)
    if (!first) return
    // An item line is never one of the picked customer's fields.
    if (linkedCustomer && (CUSTOMER_FIELDS as readonly string[]).includes(first)) setEditingCustomer(true)
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
            <p className="text-sm text-muted-foreground">{t('form.loadingProfile')}</p>
          ) : profileError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {profileError instanceof Error ? profileError.message : t('form.profileFailed')}
              </AlertDescription>
            </Alert>
          ) : !pickupCheck.usable ? (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="font-medium">{pickupCheck.reason ? t(pickupCheck.reason) : null}</p>
                <p>{t('form.pickupAdminOnly')}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground break-words">
              {t('form.fromLine', { name: profile?.name, address: pickupMapped?.pickupAddress.formattedAddress || '—' })}
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
                    <FormLabel>{t('form.customerName')}</FormLabel>
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
                    <FormLabel>{t('form.phone')}</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="off"
                        placeholder={t('form.phonePlaceholder')}
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
                label={t('form.address')}
                // The address the form holds, so it stays visible after Change too (empty on a new form).
                initialQuery={form.getValues('dropoffAddress.formattedAddress') ?? ''}
                near={pickupPoint}
                defaultTown={profile?.pickupAddress?.city ?? ''}
              />

              {/* The pin (spec 0016, AC-4): the map once there is a point, else "Show on map" for a typed street. */}
              {hasDropoffPoint ? (
                <PinMap
                  ref={pinMapRef}
                  center={{ latitude: dropoffLatitude, longitude: dropoffLongitude }}
                  confirmed={pinConfirmed}
                  onMove={handlePinMove}
                  onConfirm={handlePinConfirm}
                  message={pinMessage ? t(pinMessage) : null}
                  large
                />
              ) : (
                <div ref={pinMapRef} className="space-y-2">
                  {pinMessage ? (
                    <p role="alert" className="text-sm text-destructive">
                      {t(pinMessage)}
                    </p>
                  ) : null}
                  {form.watch('dropoffAddress.streetAddress.0')?.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full text-base"
                      onClick={handleShowOnMap}
                      disabled={isLocating}
                    >
                      {isLocating ? t('form.findingAddress') : t('form.showOnMap')}
                    </Button>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="floor"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>
                        {t('form.floor')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
                      </FormLabel>
                      <FormControl>
                        <Input autoComplete="off" placeholder={t('form.floorPlaceholder')} className="h-12 text-base" {...field} />
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
                        {t('form.doorbell')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
                      </FormLabel>
                      <FormControl>
                        <Input autoComplete="off" placeholder={t('form.doorbellPlaceholder')} className="h-12 text-base" {...field} />
                      </FormControl>
                      <LimitCounter length={field.value?.length ?? 0} limit={DOORBELL_MAX} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                  label={t('form.readyIn')}
                  options={readyInPills(profile?.usualPrepMinutes, t)}
                  value={field.value === undefined || field.value === null ? '' : String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Spec 0046 (AC-2): an order too big for one box goes as one delivery per box, each priced and
            paid in full, each to a different rider. */}
        <FormField
          control={form.control}
          name="boxCount"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ChoicePills
                  ref={field.ref}
                  label={t('form.boxCount')}
                  options={BOX_COUNT_OPTIONS}
                  value={String(field.value ?? 1)}
                  onValueChange={(value) => {
                    const count = Number(value)
                    field.onChange(count)
                    // Boxes 2 onwards keep the sizes already picked; a new box starts with none.
                    const kept = form.getValues('moreBoxSizes').slice(0, count - 1)
                    const padded = [...kept, ...Array(Math.max(0, count - 1 - kept.length)).fill(undefined)]
                    form.setValue('moreBoxSizes', padded as ManualRequestPackageSize[], { shouldDirty: true })
                  }}
                />
              </FormControl>
              {boxCount > 1 ? (
                <FormDescription>
                  {t('form.boxCountHint')}
                </FormDescription>
              ) : null}
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
                  label={boxCount > 1 ? t('form.boxNumberSize', { number: 1 }) : t('form.boxSize')}
                  options={sizeOptions(t)}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormDescription>
                {BOX_SIZE_DESCRIPTIONS.map((line) => (
                  <span key={line.size} className="block">
                    {t(line.text)}
                  </span>
                ))}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Spec 0046 (AC-2): a size for each further box. */}
        {Array.from({ length: Math.max(0, boxCount - 1) }, (_unused, index) => (
          <FormField
            key={`box-${index + 2}`}
            control={form.control}
            name={`moreBoxSizes.${index}`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ChoicePills
                    ref={field.ref}
                    label={t('form.boxNumberSize', { number: index + 2 })}
                    options={sizeOptions(t)}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {/* Spec 0028: optional items, a drink or a side marked in one tap. */}
        <OrderItemsSection form={form} />

        <FormField
          control={form.control}
          name="orderTotal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.orderTotal')}</FormLabel>
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
              <FormDescription>{t('form.orderTotalHint')}</FormDescription>
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
                {t('form.riderNote')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder={t('form.riderNotePlaceholder')}
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

        {/* Spec 0029 (AC-8): busy mode lengthens this order's ready time on the server. */}
        {availability?.busyExtraMinutes && availability.acceptingOrders ? (
          <p className="text-sm text-muted-foreground">{t('form.busyAdds', { minutes: availability.busyExtraMinutes })}</p>
        ) : null}

        <PriceSendBar
          phase={phase}
          quote={priced?.quote ?? null}
          quotes={priced?.quotes ?? []}
          pricedAddress={priced?.values.dropoffAddress.formattedAddress || null}
          error={barError}
          disabled={!pickupCheck.usable || availability?.acceptingOrders === false}
          onSend={handleSend}
          onHeightChange={setBarHeight}
        />
      </form>
    </Form>
  )
}
