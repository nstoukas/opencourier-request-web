import { useCallback, useEffect, useState } from 'react'
import {
  buildManualRequestFormattedAddress,
  ManualRequestDeliveryDto,
  ManualRequestDeliveryFetchResult,
  ManualRequestDeliveryInput,
  ManualRequestQuoteDto,
  ManualRequestQuoteInput,
  ManualRequestUpdateDeliveryInput,
  PartnerDeliveryDto,
  PartnerDeliveryPaginatedDto,
  PartnerProfileDto,
} from '../modules/manual-request/types'
import { EnumDeliveryEventType } from '../shared-types'
import {
  getManualRequestApiMode,
  PARTNER_AUTH_BASE_URL,
  PARTNER_PROXY_BASE_URL,
} from '../utils/manualRequestAuth'

/**
 * Standalone fetch helper for request-web.
 * This app talks directly to opencourier-backend manual-request endpoints via server proxy.
 */
const REQUEST_TIMEOUT_MS = 12000

async function manualRequestFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${PARTNER_PROXY_BASE_URL}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort()
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      // Same-origin credentials send our httpOnly cookie to authenticate requests via server proxy.
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check backend availability and token.`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    let body: any
    try { body = await response.json() } catch { /* ignore */ }
    // ResponseFormatMiddleware wraps errors as { error: true, result: [{ message, code, statusCode }] }
    const wrapped = Array.isArray(body?.result) ? body.result[0] : null
    const raw = wrapped?.message ?? body?.message ?? response.statusText
    const message = Array.isArray(raw)
      ? raw.join('; ')
      : typeof raw === 'string' && raw.length > 0
      ? raw
      : `Request failed (HTTP ${response.status})`
    const err: any = new Error(message)
    err.statusCode = wrapped?.statusCode ?? response.status
    err.code = wrapped?.code
    throw err
  }

  const text = await response.text()
  if (!text) return undefined as T
  const body = JSON.parse(text)
  // Backend wraps in { result: ... } envelope
  return (body?.result ?? body) as T
}

type MutationResult = { isLoading: boolean }

function useStandaloneMutation<TInput, TOutput>(
  request: (input: TInput) => Promise<TOutput>,
): [(input: TInput) => Promise<TOutput>, MutationResult] {
  const [isLoading, setIsLoading] = useState(false)

  const trigger = useCallback(
    async (input: TInput) => {
      setIsLoading(true)
      try {
        return await request(input)
      } finally {
        setIsLoading(false)
      }
    },
    [request],
  )

  return [trigger, { isLoading }]
}

function toPartnerAddress(input: ManualRequestQuoteInput['pickupAddress']) {
  const formattedAddress =
    (input.formattedAddress?.trim() || buildManualRequestFormattedAddress(input)) || ''
  return {
    streetAddress: [input.streetAddress?.[0] ?? ''],
    city: input.city,
    state: input.state,
    zipCode: input.zipCode || '',
    countryCode: (input.countryCode || 'US').toUpperCase(),
    houseNumber: input.houseNumber,
    formattedAddress,
  }
}

/** Aligns with backend fields that populate order + location `formattedAddress`. */
function withRootLocationFormattedAddresses<T extends ManualRequestQuoteInput>(input: T) {
  const pickupLocationFormattedAddress =
    input.pickupLocationFormattedAddress?.trim() ||
    input.pickupAddress.formattedAddress?.trim() ||
    buildManualRequestFormattedAddress(input.pickupAddress)
  const dropoffLocationFormattedAddress =
    input.dropoffLocationFormattedAddress?.trim() ||
    input.dropoffAddress.formattedAddress?.trim() ||
    buildManualRequestFormattedAddress(input.dropoffAddress)
  return {
    ...input,
    pickupAddress: {
      ...input.pickupAddress,
      formattedAddress: pickupLocationFormattedAddress,
    },
    dropoffAddress: {
      ...input.dropoffAddress,
      formattedAddress: dropoffLocationFormattedAddress,
    },
    pickupLocationFormattedAddress,
    dropoffLocationFormattedAddress,
  }
}

function mapQuoteInputForPartner(input: ManualRequestQuoteInput) {
  return {
    pickupLocationFormattedAddress: input.pickupLocationFormattedAddress ?? '',
    dropoffLocationFormattedAddress: input.dropoffLocationFormattedAddress ?? '',
    pickupAddress: toPartnerAddress(input.pickupAddress),
    dropoffAddress: toPartnerAddress(input.dropoffAddress),
    pickupLatitude: input.pickupLatitude,
    pickupLongitude: input.pickupLongitude,
    dropoffLatitude: input.dropoffLatitude,
    dropoffLongitude: input.dropoffLongitude,
    pickupReadyAt: input.pickupReadyAt,
    pickupDeadlineAt: input.pickupDeadlineAt,
    dropoffReadyAt: input.dropoffReadyAt,
    dropoffDeadlineAt: input.dropoffDeadlineAt,
    pickupPhoneNumber: input.pickupPhoneNumber,
    dropoffPhoneNumber: input.dropoffPhoneNumber,
    orderTotalValue: input.orderTotalValue,
  }
}

function mapDeliveryInputForPartner(input: ManualRequestDeliveryInput) {
  return {
    pickupLocationFormattedAddress: input.pickupLocationFormattedAddress ?? '',
    dropoffLocationFormattedAddress: input.dropoffLocationFormattedAddress ?? '',
    quoteId: input.quoteId,
    idempotencyKey: input.idempotencyKey,
    pickupAddress: toPartnerAddress(input.pickupAddress),
    dropoffAddress: toPartnerAddress(input.dropoffAddress),
    pickupLatitude: input.pickupLatitude,
    pickupLongitude: input.pickupLongitude,
    dropoffLatitude: input.dropoffLatitude,
    dropoffLongitude: input.dropoffLongitude,
    pickupName: input.pickupName,
    pickupPhoneNumber: input.pickupPhoneNumber,
    dropoffName: input.dropoffName,
    dropoffPhoneNumber: input.dropoffPhoneNumber,
    orderItems: input.orderItems ?? [
      {
        name: input.packageDescription || 'Package',
        quantity: 1,
        size: input.packageSize || 'SMALL',
      },
    ],
    pickupBusinessName: input.pickupBusinessName,
    pickupNotes: input.pickupNotes ?? '',
    dropoffBusinessName: input.dropoffBusinessName || input.dropoffName,
    dropoffNotes: input.dropoffNotes ?? '',
    dropoffSellerNotes: input.specialInstructions ?? '',
    deliverableAction: 'MEET_AT_DOOR',
    orderReference: input.orderReference || input.quoteId,
    orderTotalValue: input.orderTotalValue ?? 0,
    pickupReadyAt: input.pickupReadyAt,
    pickupDeadlineAt: input.pickupDeadlineAt,
    dropoffReadyAt: input.dropoffReadyAt,
    dropoffDeadlineAt: input.dropoffDeadlineAt,
    requiresDropoffSignature: false,
    requiresId: false,
    tip: 0,
  }
}

export function useCreateManualRequestQuoteMutation() {
  return useStandaloneMutation<ManualRequestQuoteInput, ManualRequestQuoteDto>((input) => {
    const apiMode = getManualRequestApiMode()
    const path = apiMode === 'partner' ? '/delivery-quotes' : '/quote'
    const ready = withRootLocationFormattedAddresses(input)
    const body = apiMode === 'partner' ? mapQuoteInputForPartner(ready) : ready

    return manualRequestFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  })
}

export function useConfirmManualRequestDeliveryMutation() {
  return useStandaloneMutation<ManualRequestDeliveryInput, ManualRequestDeliveryDto>((input) => {
    const apiMode = getManualRequestApiMode()
    const path = apiMode === 'partner' ? '/deliveries' : '/delivery'
    const ready = withRootLocationFormattedAddresses(input)
    const body = apiMode === 'partner' ? mapDeliveryInputForPartner(ready) : ready

    return manualRequestFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  })
}

export function useCancelManualRequestDeliveryMutation() {
  return useStandaloneMutation<string, ManualRequestDeliveryDto>((deliveryId) => {
    const apiMode = getManualRequestApiMode()
    const path = apiMode === 'partner'
      ? `/deliveries/${deliveryId}/cancel`
      : `/delivery/${deliveryId}/cancel`

    return manualRequestFetch(path, {
      method: 'POST',
    })
  })
}

export function useSubmitManualRequestEventMutation() {
  return useStandaloneMutation<{ deliveryId: string; eventType: EnumDeliveryEventType }, ManualRequestDeliveryDto>(
    ({ deliveryId, eventType }) => {
      const apiMode = getManualRequestApiMode()
      if (apiMode === 'partner') {
        throw new Error('Delivery lifecycle event endpoint is not available in partner API mode.')
      }

      return manualRequestFetch(`/delivery/${deliveryId}/event`, {
        method: 'POST',
        body: JSON.stringify({ deliveryId, eventType }),
      })
    },
  )
}

export async function fetchPartnerDelivery(deliveryId: string): Promise<PartnerDeliveryDto> {
  return manualRequestFetch<PartnerDeliveryDto>(`/deliveries/${deliveryId}`)
}

// The path is /partner/profile, so the full upstream URL is /api/partner/v1/partner/profile — the doubled partner is deliberate; /api/partner/v1/profile 404s.
export async function fetchPartnerProfile(): Promise<PartnerProfileDto> {
  return manualRequestFetch<PartnerProfileDto>('/partner/profile')
}

export function usePartnerProfileQuery() {
  const [data, setData] = useState<PartnerProfileDto | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<unknown>(undefined)

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)
    try {
      const apiMode = getManualRequestApiMode()
      if (apiMode !== 'partner') {
        throw new Error('Partner profile is only available in partner API mode.')
      }
      const response = await fetchPartnerProfile()
      setData(response)
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { data, isLoading, error, refetch: fetchProfile }
}


export async function loginPartner(email: string, password: string): Promise<{ email: string | null }> {
  const response = await fetch(`${PARTNER_AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.message ?? 'Sign in failed.')
  }
  return { email: body?.email ?? null }
}

export async function logoutPartner(): Promise<void> {
  await fetch(`${PARTNER_AUTH_BASE_URL}/logout`, {
    method: 'POST',
  }).catch(() => {})
}

export async function fetchPartnerSession(): Promise<{ signedIn: boolean; email: string | null }> {
  try {
    const response = await fetch(`${PARTNER_AUTH_BASE_URL}/session`)
    if (!response.ok) return { signedIn: false, email: null }
    const body = await response.json().catch(() => ({}))
    return {
      signedIn: Boolean(body?.signedIn),
      email: body?.email ?? null,
    }
  } catch {
    return { signedIn: false, email: null }
  }
}

export function useListManualRequestDeliveriesQuery(options?: { page?: number; perPage?: number; skip?: boolean }) {
  const [data, setData] = useState<PartnerDeliveryPaginatedDto | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(!options?.skip)
  const [error, setError] = useState<unknown>(undefined)

  const fetchDeliveries = useCallback(async () => {
    if (options?.skip) return
    setIsLoading(true)
    setError(undefined)
    try {
      const apiMode = getManualRequestApiMode()
      if (apiMode !== 'partner') {
        throw new Error('Listing deliveries is only supported in partner API mode.')
      }
      const params = new URLSearchParams()
      if (options?.page != null) params.set('page', String(options.page))
      if (options?.perPage != null) params.set('perPage', String(options.perPage))
      const query = params.toString() ? `?${params}` : ''
      const response = await manualRequestFetch<PartnerDeliveryPaginatedDto>(`/deliveries${query}`)
      setData(response)
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [options?.skip, options?.page, options?.perPage])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  return { data, isLoading, error, refetch: fetchDeliveries }
}

const SAFE_VERIFICATION_DEFAULT = {
  signature: false,
  signatureRequirement: { enabled: false, collectSignerName: false, collectSignerRelationship: false },
  barcodes: [],
  identification: { minAge: 0, noSobrietyCheck: true },
  picture: false,
}

export function useUpdateManualRequestDeliveryMutation() {
  return useStandaloneMutation<ManualRequestUpdateDeliveryInput, PartnerDeliveryDto>(
    ({ deliveryId, orderReference, pickupNotes, pickupReadyAt, pickupDeadlineAt,
       dropoffNotes, dropoffLatitude, dropoffLongitude, dropoffReadyAt, dropoffDeadlineAt }) => {
      const apiMode = getManualRequestApiMode()
      if (apiMode !== 'partner') {
        throw new Error('Updating deliveries is only supported in partner API mode.')
      }
      return manualRequestFetch(`/deliveries/${deliveryId}`, {
        method: 'POST',
        body: JSON.stringify({
          orderReference,
          pickupNotes,
          pickupReadyAt,
          pickupDeadlineAt,
          dropoffNotes,
          dropoffLatitude,
          dropoffLongitude,
          dropoffReadyAt,
          dropoffDeadlineAt,
          tipByCustomer: 0,
          pickupVerification: SAFE_VERIFICATION_DEFAULT,
          dropoffVerification: SAFE_VERIFICATION_DEFAULT,
        }),
      })
    },
  )
}

export function useGetManualRequestDeliveryQuery(
  deliveryId: string,
  options?: { skip?: boolean },
) {
  const [data, setData] = useState<ManualRequestDeliveryFetchResult | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(!options?.skip)
  const [error, setError] = useState<unknown>(undefined)

  const fetchDelivery = useCallback(async () => {
    if (!deliveryId || options?.skip) return
    setIsLoading(true)
    setError(undefined)
    try {
      const apiMode = getManualRequestApiMode()
      const path = apiMode === 'partner' ? `/deliveries/${deliveryId}` : `/delivery/${deliveryId}`
      const response = await manualRequestFetch<ManualRequestDeliveryFetchResult>(path)
      setData(response)
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [deliveryId, options?.skip])

  useEffect(() => {
    fetchDelivery()
  }, [fetchDelivery])

  return { data, isLoading, error, refetch: fetchDelivery }
}
