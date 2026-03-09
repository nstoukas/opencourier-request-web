/**
 * CreateDeliveryForm
 *
 * Full form for creating a manual delivery request.
 * Flow: Fill form → Get Estimate (quote) → Review EstimateSummaryCard → Confirm
 */
'use client'

import React, { useState } from 'react'
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

// ─── Validation schema ────────────────────────────────────────────────────────

const addressSchema = z.object({
  streetAddress: z.array(z.string().min(1, 'Required')).min(1),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required').max(2, 'Use 2-letter state code'),
  zipCode: z.string().min(4, 'Zip code is required'),
  countryCode: z.literal('US'),
  houseNumber: z.string().optional(),
})

const formSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),

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
  packageDescription: z.string().min(1, 'Package description is required'),
  packageSize: z.nativeEnum(ManualRequestPackageSize, { errorMap: () => ({ message: 'Select a package size' }) }),
  specialInstructions: z.string().optional(),
  orderReference: z.string().optional(),
})

export type CreateDeliveryFormValues = z.infer<typeof formSchema>

// ─── Default values ───────────────────────────────────────────────────────────

const defaultAddress = {
  streetAddress: [''],
  city: '',
  state: '',
  zipCode: '',
  countryCode: 'US' as const,
  houseNumber: '',
}

const defaultValues: CreateDeliveryFormValues = {
  partnerId: '',
  pickupName: '',
  pickupPhoneNumber: '',
  pickupBusinessName: '',
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
  packageDescription: '',
  packageSize: ManualRequestPackageSize.SMALL,
  specialInstructions: '',
  orderReference: '',
}


// ─── Component ────────────────────────────────────────────────────────────────

export function CreateDeliveryForm() {
  const { toast } = useToast()
  const navigator = useRequestPageNavigator()

  const [activeQuote, setActiveQuote] = useState<ManualRequestQuoteDto | null>(null)
  const [formSnapshot, setFormSnapshot] = useState<CreateDeliveryFormValues | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [createQuote, { isLoading: isQuoting }] = useCreateManualRequestQuoteMutation()
  const [confirmDelivery, { isLoading: isConfirming }] = useConfirmManualRequestDeliveryMutation()

  const form = useForm<CreateDeliveryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const handleGetEstimate = async (values: CreateDeliveryFormValues) => {
    setErrorMessage(null)
    setActiveQuote(null)
    try {
      const payload: ManualRequestQuoteInput = {
        partnerId: values.partnerId ?? '',
        pickupName: values.pickupName ?? '',
        pickupPhoneNumber: values.pickupPhoneNumber ?? '',
        pickupBusinessName: values.pickupBusinessName ?? '',
        pickupNotes: values.pickupNotes,
        pickupAddress: {
          streetAddress: [values.pickupAddress.streetAddress[0] ?? ''],
          city: values.pickupAddress.city,
          state: values.pickupAddress.state,
          zipCode: values.pickupAddress.zipCode,
          countryCode: 'US',
          houseNumber: values.pickupAddress.houseNumber,
        },
        pickupLatitude: values.pickupLatitude,
        pickupLongitude: values.pickupLongitude,
        dropoffName: values.dropoffName ?? '',
        dropoffPhoneNumber: values.dropoffPhoneNumber ?? '',
        dropoffBusinessName: values.dropoffBusinessName,
        dropoffNotes: values.dropoffNotes,
        dropoffAddress: {
          streetAddress: [values.dropoffAddress.streetAddress[0] ?? ''],
          city: values.dropoffAddress.city,
          state: values.dropoffAddress.state,
          zipCode: values.dropoffAddress.zipCode,
          countryCode: 'US',
          houseNumber: values.dropoffAddress.houseNumber,
        },
        dropoffLatitude: values.dropoffLatitude,
        dropoffLongitude: values.dropoffLongitude,
        packageDescription: values.packageDescription,
        packageSize: values.packageSize,
        specialInstructions: values.specialInstructions,
        orderReference: values.orderReference,
      }

      const quote = await createQuote(payload)
      setActiveQuote(quote)
      setFormSnapshot(values)
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to get estimate. Check inputs and try again.')
    }
  }

  const handleConfirm = async () => {
    if (!activeQuote || !formSnapshot) return
    setErrorMessage(null)
    try {
      const payload: ManualRequestDeliveryInput = {
        partnerId: formSnapshot.partnerId ?? '',
        pickupName: formSnapshot.pickupName ?? '',
        pickupPhoneNumber: formSnapshot.pickupPhoneNumber ?? '',
        pickupBusinessName: formSnapshot.pickupBusinessName ?? '',
        pickupNotes: formSnapshot.pickupNotes,
        pickupAddress: {
          streetAddress: [formSnapshot.pickupAddress.streetAddress[0] ?? ''],
          city: formSnapshot.pickupAddress.city,
          state: formSnapshot.pickupAddress.state,
          zipCode: formSnapshot.pickupAddress.zipCode,
          countryCode: 'US',
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
          zipCode: formSnapshot.dropoffAddress.zipCode,
          countryCode: 'US',
          houseNumber: formSnapshot.dropoffAddress.houseNumber,
        },
        dropoffLatitude: formSnapshot.dropoffLatitude,
        dropoffLongitude: formSnapshot.dropoffLongitude,
        packageDescription: formSnapshot.packageDescription,
        packageSize: formSnapshot.packageSize,
        specialInstructions: formSnapshot.specialInstructions,
        orderReference: formSnapshot.orderReference,
        quoteId: activeQuote.id,
      }

      const delivery = await confirmDelivery(payload)

      toast({
        title: 'Delivery created',
        description: `Delivery ${delivery.id} is now being processed.`,
      })

      navigator.goToManualRequestStatus(delivery.id)
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to confirm delivery. The quote may have expired.')
    }
  }

  const handleDiscard = () => {
    setActiveQuote(null)
    setFormSnapshot(null)
  }

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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="packageDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Prescription medication" {...field} />
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
              </div>

              <FormField
                control={form.control}
                name="specialInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Keep upright, handle with care"
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
                name="orderReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Reference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. ORD-12345" {...field} />
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
              <CardTitle className="text-base">Pickup Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="pickupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pickupPhoneNumber"
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
                  name="pickupBusinessName"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Pharmacy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <AddressSection control={form.control} prefix="pickup" label="Pickup Address" />

              <FormField
                control={form.control}
                name="pickupNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. Ring doorbell, ask for Mark" className="resize-none" rows={2} {...field} />
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
              <CardTitle className="text-base">Dropoff Information</CardTitle>
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
                        <Input type="tel" placeholder="+1 555 000 0001" {...field} />
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
                        <Input placeholder="e.g. Customer home" {...field} />
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
                      <Textarea placeholder="e.g. Leave at front desk" className="resize-none" rows={2} {...field} />
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
