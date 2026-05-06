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

// ─── Partner API delivery types (nested structure returned by partner endpoints) ──

export interface PartnerDeliveryCourierDto {
  id?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
  vehicleType?: string | null
}

export interface PartnerDeliveryPickupDto {
  id: string
  latitude: number | null
  longitude: number | null
  formattedAddress: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  street?: string | null
  city: string | null
  state: string | null
  zipCode?: string | null
  countryCode?: string | null
  stateCode?: string | null
  houseNumber?: string | null
  pickupName: string
  pickupPhoneNumber: string
  pickupBusinessName: string
  pickupNotes: string | null
  pickupTypes?: string[]
}

export interface PartnerDeliveryDropoffDto {
  id: string
  latitude: number | null
  longitude: number | null
  formattedAddress: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  street?: string | null
  city: string | null
  state: string | null
  zipCode?: string | null
  countryCode?: string | null
  stateCode?: string | null
  houseNumber?: string | null
  dropoffName: string
  dropoffPhoneNumber: string
  dropoffBusinessName: string | null
  dropoffNotes: string | null
  dropoffSellerNotes?: string | null
}

export interface PartnerDeliveryOrderItemDto {
  name: string
  quantity: number
  size?: string
}

export interface PartnerDeliveryDto {
  id: string
  quoteId?: string | null
  status: string
  pickup?: PartnerDeliveryPickupDto | null
  dropoff?: PartnerDeliveryDropoffDto | null
  courier?: PartnerDeliveryCourierDto | null
  orderReference: string | null
  currencyCode: string
  totalCost: number | null
  fee?: number | null
  tips?: number
  totalCompensation?: number | null
  createdAt: string
  pickupReadyAt: string | null
  pickupDeadlineAt: string | null
  dropoffEta: string | null
  dropoffReadyAt: string | null
  dropoffDeadlineAt: string | null
  deliverableAction?: string | null
  undeliverableAction?: string | null
  undeliverableReason?: string | null
  orderTotalValue?: number | null
  orderItems?: PartnerDeliveryOrderItemDto[]
  customerNotes?: unknown[] | null
  idempotencyKey?: string | null
  externalStoreId?: string | null
  externalUserInfo?: unknown | null
  externalId?: string | null
  requiresId?: boolean | null
  deliveryQuoteId?: string | null
}

export interface PartnerPaginationDto {
  perPage: number
  totalItems: number
  totalPages: number
  currentItems: number
  currentPage: number
  prevPage: number | null
  nextPage: number | null
}

export interface PartnerDeliveryPaginatedDto {
  data: PartnerDeliveryDto[]
  pagination?: PartnerPaginationDto
}

export interface ManualRequestUpdateDeliveryInput {
  deliveryId: string
  orderReference: string
  pickupNotes: string
  pickupReadyAt: string | null
  pickupDeadlineAt: string | null
  dropoffNotes: string
  dropoffLatitude: number
  dropoffLongitude: number
  dropoffReadyAt: string | null
  dropoffDeadlineAt: string | null
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

/** Response from GET `/deliveries/:id` (partner) or GET `/delivery/:id` (admin). */
export type ManualRequestDeliveryFetchResult = PartnerDeliveryDto | ManualRequestDeliveryDto

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
