export enum ManualRequestPackageSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
}

export interface ManualRequestAddressInput {
  streetAddress: string[]
  city: string
  state: string
  zipCode: string
  countryCode: string
  houseNumber?: string
}

export interface ManualRequestQuoteInput {
  partnerId?: string
  pickupName: string
  pickupPhoneNumber: string
  pickupBusinessName: string
  pickupNotes?: string | null
  pickupAddress: ManualRequestAddressInput
  pickupLatitude: number
  pickupLongitude: number
  pickupReadyAt?: string | null
  pickupDeadlineAt?: string | null
  dropoffName: string
  dropoffPhoneNumber: string
  dropoffBusinessName?: string | null
  dropoffNotes?: string | null
  dropoffAddress: ManualRequestAddressInput
  dropoffLatitude: number
  dropoffLongitude: number
  dropoffReadyAt?: string | null
  dropoffDeadlineAt?: string | null
  packageDescription?: string | null
  packageSize?: ManualRequestPackageSize | null
  specialInstructions?: string | null
  orderReference?: string | null
  orderTotalValue?: number | null
  metadata?: Record<string, unknown> | null
}

export interface ManualRequestOrderItemInput {
  name: string
  quantity: number
  size?: string
  dimensions?: {
    length: number
    height: number
    depth: number
  }
  price?: number
  weight?: number
  vatPercentage?: number
}

export interface ManualRequestDeliveryInput extends ManualRequestQuoteInput {
  quoteId: string
  idempotencyKey?: string
  orderItems?: ManualRequestOrderItemInput[]
}

export interface ManualRequestQuoteDto {
  id: string
  quoteRangeFrom: number
  quoteRangeTo: number
  currency: string
  duration: number
  distance: number
  distanceUnit: string
  expiresAt: string | null
  dropoffEta: string | null
  createdAt: string
}

export interface ManualRequestDeliveryDto {
  id: string
  status: string
  pickupName: string
  pickupPhoneNumber: string
  pickupBusinessName: string
  pickupNotes: string | null
  pickupLocationId: string
  pickupReadyAt: string | null
  pickupDeadlineAt: string | null
  dropoffName: string
  dropoffPhoneNumber: string
  dropoffBusinessName: string | null
  dropoffNotes: string | null
  dropoffLocationId: string
  dropoffReadyAt: string | null
  dropoffEta: string | null
  dropoffDeadlineAt: string | null
  deliverableAction: string
  undeliverableAction: string | null
  currencyCode: string
  totalCost: number | null
  pay: number | null
  fee: number | null
  deliveryQuoteId: string
  courierId: string | null
  partnerId: string | null
  orderReference: string | null
  createdAt: string
  updatedAt: string
}
