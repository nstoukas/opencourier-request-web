/**
 * CreateDeliveryForm
 *
 * Full form for creating a manual delivery request.
 * Flow: Fill form → Get Estimate (quote) → Review EstimateSummaryCard → Confirm
 */
'use client'

import React, { useEffect, useState } from 'react'
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
  Separator,
  Textarea,
  useToast,
} from '../../../admin-web-components'
import { Loader2Icon } from 'lucide-react'
import { useCreateManualRequestQuoteMutation, useConfirmManualRequestDeliveryMutation } from '../../../api/manualRequestApi'
import {
  ManualRequestDeliveryInput,
  ManualRequestPackageSize,
  ManualRequestQuoteDto,
  ManualRequestQuoteInput,
} from '../types'
import { EstimateSummaryCard } from './EstimateSummaryCard'
import { AddressSection } from './AddressSection'
import { ErrorBanner } from './ErrorBanner'
import { useRequestPageNavigator } from '../../../hooks/useRequestPageNavigator'
import { getManualRequestAuthCredential, getManualRequestAuthMode } from '../../../utils/manualRequestAuth'

// ─── Validation schema ────────────────────────────────────────────────────────

const addressSchema = z.object({
  streetAddress: z.array(z.string().min(1, 'Required')).min(1),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State / province / region is required'),
  zipCode: z.string().optional(),
  countryCode: z.string().length(2, 'Use 2-letter country code').transform((value) => value.toUpperCase()),
  houseNumber: z.string().optional(),
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
  partnerId: z.string().optional(),

  // Pickup
  pickupName: z.string().min(1, 'Pickup contact name is required'),
  pickupPhoneNumber: z.string().min(7, 'Valid phone number required'),
  pickupBusinessName: z.string().min(1, 'Pickup business name is required'),
  pickupNotes: z.string().optional(),
  pickupAddress: addressSchema,
  pickupLatitude: z.number({ invalid_type_error: 'Enter a valid latitude' }),
  pickupLongitude: z.number({ invalid_type_error: 'Enter a valid longitude' }),

  // Dropoff
  dropoffName: z.string().min(1, 'Dropoff contact name is required'),
  dropoffPhoneNumber: z.string().min(7, 'Valid phone number required'),
  dropoffBusinessName: z.string().optional(),
  dropoffNotes: z.string().optional(),
  dropoffAddress: addressSchema,
  dropoffLatitude: z.number({ invalid_type_error: 'Enter a valid latitude' }),
  dropoffLongitude: z.number({ invalid_type_error: 'Enter a valid longitude' }),

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
  countryCode: 'US',
  houseNumber: '',
}

const defaultValues: CreateDeliveryFormValues = {
  partnerId: process.env.NEXT_PUBLIC_MANUAL_REQUEST_DEFAULT_PARTNER_ID?.trim() ?? '',
  pickupName: 'Pickup Contact',
  pickupPhoneNumber: '+10000000000',
  pickupBusinessName: 'Pickup Location',
  pickupNotes: '',
  pickupAddress: defaultAddress,
  pickupLatitude: 0,
  pickupLongitude: 0,
  dropoffName: '',
  dropoffPhoneNumber: '',
  dropoffBusinessName: '',
  dropoffNotes: '',
  dropoffAddress: defaultAddress,
  dropoffLatitude: 0,
  dropoffLongitude: 0,
  packageType: 'DOCUMENTS',
  packageTypeOther: '',
  packageDescription: '',
  packageSize: ManualRequestPackageSize.SMALL,
  specialInstructions: '',
  orderReference: '',
}


// ─── Component ────────────────────────────────────────────────────────────────

interface CreateDeliveryFormProps {
  requireAccessToken?: boolean
}

function resolvePackageDescription(values: CreateDeliveryFormValues) {
  if (values.packageType === 'OTHER') {
    return values.packageTypeOther?.trim() || values.packageDescription?.trim() || undefined
  }

  const match = packageTypeOptions.find((item) => item.value === values.packageType)
  return match?.label ?? values.packageType
}

function hasValidCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0)
}

async function geocodeCoordinatesFromAddress(address: CreateDeliveryFormValues['pickupAddress']) {
  const query = [
    address.streetAddress?.[0],
    address.city,
    address.state,
    address.zipCode,
    address.countryCode,
  ]
    .filter(Boolean)
    .join(', ')

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
  const response = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!response.ok) return null

  const result = (await response.json()) as Array<{ lat: string; lon: string }>
  const first = result[0]
  if (!first) return null

  const latitude = parseFloat(first.lat)
  const longitude = parseFloat(first.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}

export function CreateDeliveryForm({ requireAccessToken = true }: CreateDeliveryFormProps) {
  const { toast } = useToast()
  const navigator = useRequestPageNavigator()
  const authMode = getManualRequestAuthMode()
  const isApiKeyAuth = authMode === 'api-key'

  const [activeQuote, setActiveQuote] = useState<ManualRequestQuoteDto | null>(null)
  const [formSnapshot, setFormSnapshot] = useState<CreateDeliveryFormValues | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasAccessToken, setHasAccessToken] = useState(true)

  const [createQuote, { isLoading: isQuoting }] = useCreateManualRequestQuoteMutation()
  const [confirmDelivery, { isLoading: isConfirming }] = useConfirmManualRequestDeliveryMutation()

  const form = useForm<CreateDeliveryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  useEffect(() => {
    const updateTokenState = () => {
      const credential = getManualRequestAuthCredential()
      setHasAccessToken(Boolean(credential))
    }

    updateTokenState()
    window.addEventListener('storage', updateTokenState)
    window.addEventListener('focus', updateTokenState)
    window.addEventListener('opencourier-token-updated', updateTokenState)

    return () => {
      window.removeEventListener('storage', updateTokenState)
      window.removeEventListener('focus', updateTokenState)
      window.removeEventListener('opencourier-token-updated', updateTokenState)
    }
  }, [])

  const getDebugErrorMessage = (err: any, fallback: string) => {
    const statusCode = err?.statusCode ?? err?.status
    if (statusCode === 401 && requireAccessToken) {
      return isApiKeyAuth
        ? 'Unauthorized (401). Missing or invalid API key. Set manualRequestApiKey in localStorage or NEXT_PUBLIC_MANUAL_REQUEST_API_KEY.'
        : 'Unauthorized (401). Missing or invalid JWT token. Set accessToken in localStorage or NEXT_PUBLIC_MANUAL_REQUEST_ACCESS_TOKEN.'
    }
    return err?.message ?? fallback
  }

  const handleGetEstimate = async (values: CreateDeliveryFormValues) => {
    setErrorMessage(null)
    setActiveQuote(null)
    try {
      const packageDescription = resolvePackageDescription(values)
      const pickupCoordinates = hasValidCoordinates(values.pickupLatitude, values.pickupLongitude)
        ? { latitude: values.pickupLatitude, longitude: values.pickupLongitude }
        : await geocodeCoordinatesFromAddress(values.pickupAddress)
      const dropoffCoordinates = hasValidCoordinates(values.dropoffLatitude, values.dropoffLongitude)
        ? { latitude: values.dropoffLatitude, longitude: values.dropoffLongitude }
        : await geocodeCoordinatesFromAddress(values.dropoffAddress)

      if (!pickupCoordinates || !dropoffCoordinates) {
        setErrorMessage('Could not determine coordinates from one or more addresses. Use address search and select a result.')
        return
      }

      form.setValue('pickupLatitude', pickupCoordinates.latitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('pickupLongitude', pickupCoordinates.longitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('dropoffLatitude', dropoffCoordinates.latitude, { shouldDirty: true, shouldValidate: true })
      form.setValue('dropoffLongitude', dropoffCoordinates.longitude, { shouldDirty: true, shouldValidate: true })

      const payload: ManualRequestQuoteInput = {
        partnerId: values.partnerId ?? '',
        pickupName: values.pickupName?.trim() || 'Pickup Contact',
        pickupPhoneNumber: values.pickupPhoneNumber?.trim() || '+10000000000',
        pickupBusinessName: values.pickupBusinessName?.trim() || 'Pickup Location',
        pickupNotes: values.pickupNotes,
        pickupAddress: {
          streetAddress: [values.pickupAddress.streetAddress[0] ?? ''],
          city: values.pickupAddress.city,
          state: values.pickupAddress.state,
          zipCode: values.pickupAddress.zipCode || '',
          countryCode: values.pickupAddress.countryCode,
          houseNumber: values.pickupAddress.houseNumber,
        },
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
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
        },
        dropoffLatitude: dropoffCoordinates.latitude,
        dropoffLongitude: dropoffCoordinates.longitude,
        packageDescription,
        packageSize: values.packageSize,
        specialInstructions: values.specialInstructions,
        orderReference: values.orderReference,
      }

      const quote = await createQuote(payload)
      setActiveQuote(quote)
      setFormSnapshot({
        ...values,
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
        dropoffLatitude: dropoffCoordinates.latitude,
        dropoffLongitude: dropoffCoordinates.longitude,
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
        partnerId: formSnapshot.partnerId ?? '',
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
        },
        pickupLatitude: formSnapshot.pickupLatitude,
        pickupLongitude: formSnapshot.pickupLongitude,
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
        },
        dropoffLatitude: formSnapshot.dropoffLatitude,
        dropoffLongitude: formSnapshot.dropoffLongitude,
        packageDescription,
        packageSize: formSnapshot.packageSize,
        specialInstructions: formSnapshot.specialInstructions,
        orderReference: formSnapshot.orderReference,
        idempotencyKey: formSnapshot.orderReference?.trim() || `${activeQuote.id}-${Date.now()}`,
        quoteId: activeQuote.id,
      }

      const delivery = await confirmDelivery(payload)

      toast({
        title: 'Delivery created',
        description: `Delivery ${delivery.id} is now being processed.`,
      })

      navigator.goToManualRequestStatus(delivery.id)
    } catch (err: any) {
      setErrorMessage(getDebugErrorMessage(err, 'Failed to confirm delivery. The quote may have expired.'))
    }
  }

  const handleDiscard = () => {
    setActiveQuote(null)
    setFormSnapshot(null)
  }

  const selectedPackageType = form.watch('packageType') as PackageTypeValue

  return (
    <div className="space-y-6 max-w-3xl">
      {requireAccessToken && !hasAccessToken && (
        <ErrorBanner
          title={isApiKeyAuth ? 'Missing API key' : 'Missing access token'}
          message={isApiKeyAuth
            ? 'No API key is configured. API requests will fail with Unauthorized until a key is provided.'
            : 'No JWT token is configured. API requests will fail with Unauthorized until a token is provided.'}
          detail={isApiKeyAuth
            ? 'Set localStorage key manualRequestApiKey or configure NEXT_PUBLIC_MANUAL_REQUEST_API_KEY in local.env and restart request-web.'
            : 'Set localStorage key accessToken or configure NEXT_PUBLIC_MANUAL_REQUEST_ACCESS_TOKEN in local.env and restart request-web.'}
        />
      )}

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
          isConfirming={isConfirming}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
        />
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleGetEstimate)} className="space-y-6">

          {/* ── Request Details ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Partner ID from backend" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Required. Use a valid partner ID from your instance database or Postman environment.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orderReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Reference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ORD-12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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
              <CardTitle className="text-base">Pickup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddressSection control={form.control} prefix="pickup" label="Pickup Address" />

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
            </CardContent>
          </Card>

          {/* ── Dropoff ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dropoff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="dropoffName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                      <FormLabel>Phone Number</FormLabel>
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
                      <FormLabel>Business Name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Company or building name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <AddressSection control={form.control} prefix="dropoff" label="Dropoff Address" />

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
            </CardContent>
          </Card>

          {/* ── Submit ──────────────────────────────────────────────────── */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isQuoting} size="lg">
              {isQuoting && <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />}
              {isQuoting ? 'Getting Estimate…' : 'Get Estimate'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
