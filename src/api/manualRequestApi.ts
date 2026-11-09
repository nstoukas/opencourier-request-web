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
  PartnerAvailability,
  PartnerProfileDto,
  WaitRecord,
} from '../modules/manual-request/types'
import { EnumDeliveryEventType } from '../shared-types'
import { notifyPartnerUnauthorized } from './partnerSessionEvents'
import { usePolledFetch } from '../hooks/usePolledFetch'
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

// Exported for the other API files (savedCustomersApi.ts), so every partner call shares one error shape.
export async function manualRequestFetch<T>(
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
    // A saved customer's phone clash (409) names the other customer by id (spec 0005, AC-4).
    err.conflictingCustomerId = wrapped?.conflictingCustomerId
    // The session may have ended mid visit: the portal frame checks it again (spec 0017, AC-5).
    if (response.status === 401) notifyPartnerUnauthorized()
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
    dropoffSellerNotes: input.dropoffSellerNotes ?? '',
    // Spec 0016: their own fields; left out when empty (the backend stores none).
    ...(input.dropoffFloor?.trim() ? { dropoffFloor: input.dropoffFloor.trim() } : {}),
    ...(input.dropoffDoorbell?.trim() ? { dropoffDoorbell: input.dropoffDoorbell.trim() } : {}),
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

// Who asked for a cancellation (spec 0015): the restaurant itself, or its customer through it. A
// restaurant's own cancellation after a rider accepted is charged to it; the rider is paid either way.
export type PartnerCancelledBy = 'RESTAURANT' | 'CUSTOMER'

export function useCancelManualRequestDeliveryMutation() {
  return useStandaloneMutation<{ deliveryId: string; cancelledBy: PartnerCancelledBy }, ManualRequestDeliveryDto>(
    ({ deliveryId, cancelledBy }) => {
      const apiMode = getManualRequestApiMode()
      if (apiMode === 'partner') {
        return manualRequestFetch(`/deliveries/${deliveryId}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ cancelledBy }),
        })
      }
      return manualRequestFetch(`/delivery/${deliveryId}/cancel`, {
        method: 'POST',
      })
    },
  )
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
// Spec 0023 (AC-3): move the ready time later. `expectedReadyAt` is the time the restaurant was looking
// at, so two taps on the same time add once.
export async function delayDeliveryReady(
  deliveryId: string,
  minutes: number,
  expectedReadyAt: string | null,
): Promise<PartnerDeliveryDto> {
  return manualRequestFetch<PartnerDeliveryDto>(`/deliveries/${deliveryId}/ready-delay`, {
    method: 'POST',
    body: JSON.stringify({ minutes, expectedReadyAt }),
  })
}

// Spec 0023 (AC-4): the food is ready. No body (the proxy forwards none).
export async function markDeliveryFoodReady(deliveryId: string): Promise<PartnerDeliveryDto> {
  return manualRequestFetch<PartnerDeliveryDto>(`/deliveries/${deliveryId}/food-ready`, { method: 'POST' })
}

export async function fetchPartnerProfile(): Promise<PartnerProfileDto> {
  return manualRequestFetch<PartnerProfileDto>('/partner/profile')
}

// Spec 0029: the restaurant's own busy mode and pause. Each answers the new availability.
export async function setPartnerBusy(extraMinutes: number): Promise<PartnerAvailability> {
  return manualRequestFetch<PartnerAvailability>('/partner/availability/busy', {
    method: 'POST',
    body: JSON.stringify({ extraMinutes }),
  })
}
export async function clearPartnerBusy(): Promise<PartnerAvailability> {
  return manualRequestFetch<PartnerAvailability>('/partner/availability/busy', { method: 'DELETE' })
}
export async function pausePartner(minutes: number): Promise<PartnerAvailability> {
  return manualRequestFetch<PartnerAvailability>('/partner/availability/pause', {
    method: 'POST',
    body: JSON.stringify({ minutes }),
  })
}
export async function resumePartner(): Promise<PartnerAvailability> {
  return manualRequestFetch<PartnerAvailability>('/partner/availability/pause', { method: 'DELETE' })
}

// Spec 0029 (AC-8): the availability, read again every 30 s while the tab is visible.
export function usePartnerAvailabilityQuery() {
  const { data, refetch } = usePolledFetch(fetchPartnerProfile, { enabled: true })
  return { availability: data?.availability, refetch }
}

// Spec 0030 (AC-8): the restaurant's own record over a period.
export async function fetchWaitRecord(days: number): Promise<WaitRecord> {
  return manualRequestFetch<WaitRecord>(`/partner/wait-record?days=${days}`)
}

export function useWaitRecordQuery(days: number) {
  const load = useCallback(() => fetchWaitRecord(days), [days])
  return usePolledFetch(load, { enabled: true })
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


// A failed sign in keeps the HTTP status beside the message, so the sign in screen can pick
// plain words for the restaurant ("That email and password don't match") instead of showing
// the server's own text or a code.
export type SignInError = Error & { status?: number }

export async function loginPartner(email: string, password: string): Promise<{ email: string | null }> {
  const response = await fetch(`${PARTNER_AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    // `as SignInError` tells TypeScript this Error may carry a status; we set it on the next line.
    const error = new Error(body?.message ?? 'Sign in failed.') as SignInError
    error.status = response.status
    throw error
  }
  return { email: body?.email ?? null }
}

// Throws when the sign out did not happen (no connection, or the page's server answered an error), so the
// frame keeps the restaurant signed in and says so instead of pretending (spec 0017, AC-6).
export async function logoutPartner(): Promise<void> {
  const response = await fetch(`${PARTNER_AUTH_BASE_URL}/logout`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Sign out failed (HTTP ${response.status})`)
  }
}

// Signed in or not, as the session route says. Throws when the check itself failed (no connection, or
// the backend could not be reached: the route then answers 502 and keeps the cookie), so a failed check
// is never shown as "signed out" (spec 0017, AC-6).
export async function fetchPartnerSession(): Promise<{ signedIn: boolean; email: string | null }> {
  const response = await fetch(`${PARTNER_AUTH_BASE_URL}/session`)
  if (response.status !== 200) {
    throw new Error(`Session check failed (HTTP ${response.status})`)
  }
  const body = await response.json().catch(() => ({}))
  return {
    signedIn: Boolean(body?.signedIn),
    email: body?.email ?? null,
  }
}

// My Orders (spec 0017, AC-4): read, then again every 30 s while the tab is visible.
export function useListManualRequestDeliveriesQuery(options?: {
  page?: number
  perPage?: number
  skip?: boolean
  pollMs?: number
}) {
  const page = options?.page
  const perPage = options?.perPage
  const load = useCallback(async () => {
    const apiMode = getManualRequestApiMode()
    if (apiMode !== 'partner') {
      throw new Error('Listing deliveries is only supported in partner API mode.')
    }
    const params = new URLSearchParams()
    if (page != null) params.set('page', String(page))
    if (perPage != null) params.set('perPage', String(perPage))
    const query = params.toString() ? `?${params}` : ''
    return manualRequestFetch<PartnerDeliveryPaginatedDto>(`/deliveries${query}`)
  }, [page, perPage])

  return usePolledFetch(load, { enabled: !options?.skip, intervalMs: options?.pollMs })
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

// The statuses after which an order never changes again (spec 0017: the status page stops polling).
export const ENDED_DELIVERY_STATUSES = ['DROPPED_OFF', 'CANCELED', 'FAILED']

const deliveryHasEnded = (delivery: ManualRequestDeliveryFetchResult) =>
  ENDED_DELIVERY_STATUSES.includes(delivery.status)

// The status page (spec 0017, AC-4): read, then every 30 s while visible, until the order has ended.
export function useGetManualRequestDeliveryQuery(
  deliveryId: string,
  options?: { skip?: boolean; pollMs?: number },
) {
  const load = useCallback(async () => {
    const apiMode = getManualRequestApiMode()
    const path = apiMode === 'partner' ? `/deliveries/${deliveryId}` : `/delivery/${deliveryId}`
    return manualRequestFetch<ManualRequestDeliveryFetchResult>(path)
  }, [deliveryId])

  return usePolledFetch(load, {
    enabled: Boolean(deliveryId) && !options?.skip,
    intervalMs: options?.pollMs,
    stop: deliveryHasEnded,
  })
}

// Spec 0014. Whether dispatch is stopped (heat or a storm) and until when, with the sentence the
// backend wrote for restaurants. `next` is a stop starting within 12 hours.
export type DispatchStopView = { reason: 'HEAT' | 'STORM' | 'OTHER'; startsAt: string; endsAt: string | null; message: string }
export type DispatchState = { current: DispatchStopView | null; next: DispatchStopView | null }

export async function fetchDispatchState(): Promise<DispatchState> {
  return manualRequestFetch<DispatchState>('/dispatch-state')
}

// Read on mount, then every 60 s while the tab is visible (spec 0014, AC-6). A failed read keeps the
// last answer and shows nothing new: the quote's own refusal still tells the restaurant.
export function useDispatchStateQuery(intervalMs = 60_000) {
  const [data, setData] = useState<DispatchState | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      setData(await fetchDispatchState())
    } catch {
      // Kept quiet on purpose; see above.
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, intervalMs])

  return { data }
}

