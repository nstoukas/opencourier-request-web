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
  PartnerOrderLegsDto,
  PartnerDeliveryPaginatedDto,
  PartnerAvailability,
  PartnerProfileDto,
  WaitRecord,
} from '../modules/manual-request/types'
import { EnumDeliveryEventType } from '../shared-types'
import { notifyPartnerUnauthorized } from './partnerSessionEvents'
import { usePolledFetch } from '../hooks/usePolledFetch'
import type { Language } from '../i18n/language'
import { NO_ANSWER_CODE, REQUEST_TIMEOUT_CODE } from '../i18n/serverText'
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

// Row 151 (closing decision 124.2's KNOWN GAP): true when a failed answer holds no words meant for the
// restaurant, so the page shows its own sentence in their language instead of developer English:
//   - no message in the body (an empty 5xx; the message is then our "Request failed (HTTP n)"),
//   - the partner proxy's own 502 ("Backend unreachable."), which sends NO_ANSWER_CODE beside it,
//   - the backend's catch all 500 ("Internal server error", with no code or UNKNOWN or INTERNAL_ERROR, or ERROR:
//     ResponseFormatMiddleware fills a missing code with 'ERROR', review of row 151).
// A coded refusal, and any 4xx or 503 the server worded (a dispatch stop, no rider free), keeps its words.
const CATCH_ALL_500_CODES = [undefined, 'UNKNOWN', 'INTERNAL_ERROR', 'ERROR']
export function noWordsForTheRestaurant(statusCode: number, code: unknown, said: unknown): boolean {
  if (code === NO_ANSWER_CODE) return true
  if (said === undefined || said === null || said === '') return true
  return statusCode === 500 && CATCH_ALL_500_CODES.includes(code as string | undefined)
}

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
      // The English stays for developers and logs; the code lets serverMessage word it for the restaurant,
      // in their language (row 124 review, decision 124.10).
      const timeout: any = new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check backend availability and token.`)
      timeout.code = REQUEST_TIMEOUT_CODE
      throw timeout
    }
    // No connection at all (fetch itself failed): no words from the server, so the page says it in its own
    // (row 151). The error keeps its message for developers and logs.
    if (typeof error === 'object' && error !== null && error.code === undefined) error.code = NO_ANSWER_CODE
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
    err.code = noWordsForTheRestaurant(err.statusCode, wrapped?.code ?? body?.code, wrapped?.message ?? body?.message)
      ? NO_ANSWER_CODE
      : wrapped?.code
    // A refusal with a number, a time or a name in it sends them here, so the portal can word it in its
    // reader's language (spec 0054, AC-6; src/i18n/serverText.ts).
    err.params = wrapped?.params
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
    // Row 140: only a business name the restaurant typed, else empty (the backend accepts ''). Copying the
    // customer's name here put it in every rider's offer as the "business", before they accepted.
    dropoffBusinessName: input.dropoffBusinessName?.trim() ?? '',
    dropoffNotes: input.dropoffNotes ?? '',
    dropoffSellerNotes: input.dropoffSellerNotes ?? '',
    // Spec 0016: their own fields; left out when empty (the backend stores none).
    ...(input.dropoffFloor?.trim() ? { dropoffFloor: input.dropoffFloor.trim() } : {}),
    ...(input.dropoffDoorbell?.trim() ? { dropoffDoorbell: input.dropoffDoorbell.trim() } : {}),
    // Spec 0043 (AC-4): the box size the restaurant picked. This mapper copies fields one by one, so a
    // field not named here never reaches the backend (review blocker: every order arrived as an
    // assumed Medium). Left out when absent, so the backend's default size applies and is recorded.
    ...(input.boxSize ? { boxSize: input.boxSize } : {}),
    // Spec 0046 (AC-2): the leg labels, named here like every field (see boxSize above). Left out for a
    // single delivery.
    ...(input.legNumber && input.legCount ? { legNumber: input.legNumber, legCount: input.legCount } : {}),
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

// A price for one delivery. Plain functions as well as the hooks below, so a page can ask for one per leg
// of a multi leg order (spec 0046) without a hook per call.
export function requestQuote(input: ManualRequestQuoteInput): Promise<ManualRequestQuoteDto> {
  const apiMode = getManualRequestApiMode()
  const path = apiMode === 'partner' ? '/delivery-quotes' : '/quote'
  const ready = withRootLocationFormattedAddresses(input)
  const body = apiMode === 'partner' ? mapQuoteInputForPartner(ready) : ready

  return manualRequestFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createDelivery(input: ManualRequestDeliveryInput): Promise<ManualRequestDeliveryDto> {
  const apiMode = getManualRequestApiMode()
  const path = apiMode === 'partner' ? '/deliveries' : '/delivery'
  const ready = withRootLocationFormattedAddresses(input)
  const body = apiMode === 'partner' ? mapDeliveryInputForPartner(ready) : ready

  return manualRequestFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function useCreateManualRequestQuoteMutation() {
  return useStandaloneMutation<ManualRequestQuoteInput, ManualRequestQuoteDto>(requestQuote)
}

export function useConfirmManualRequestDeliveryMutation() {
  return useStandaloneMutation<ManualRequestDeliveryInput, ManualRequestDeliveryDto>(createDelivery)
}

// Who asked for a cancellation (spec 0015): the restaurant itself, or its customer through it. A
// restaurant's own cancellation after a rider accepted is charged to it; the rider is paid either way.
export type PartnerCancelledBy = 'RESTAURANT' | 'CUSTOMER'

// The cancel of one delivery, as a plain function too, for "Cancel all legs" (spec 0046, AC-5).
export function cancelDelivery(deliveryId: string, cancelledBy: PartnerCancelledBy): Promise<ManualRequestDeliveryDto> {
  return manualRequestFetch(`/deliveries/${deliveryId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancelledBy }),
  })
}

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

// Spec 0046 (AC-3, AC-6): the legs of the order this delivery is a leg of, and any never sent.
export async function fetchOrderLegs(deliveryId: string): Promise<PartnerOrderLegsDto> {
  return manualRequestFetch<PartnerOrderLegsDto>(`/deliveries/${deliveryId}/order-legs`)
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

// Spec 0032: a wrong or missing product on a delivered order.
export async function reportDeliveryProduct(
  deliveryId: string,
  body: { kind: 'WRONG_ITEM' | 'MISSING_ITEM'; itemName?: string; note?: string },
): Promise<{ id: string }> {
  return manualRequestFetch<{ id: string }>(`/deliveries/${deliveryId}/product-reports`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
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
  // A record moves slowly, and the 90 day figure is the heaviest read here: every 5 minutes is plenty.
  return usePolledFetch(load, { enabled: true, intervalMs: 300_000 })
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

// Spec 0054 (AC-2): saves the language on the signed in restaurant user's account, so the next sign in and
// the backend's mails use it. The backend answers 400 for anything but 'el' or 'en'.
export async function saveAccountLanguage(language: Language): Promise<void> {
  await manualRequestFetch<{ language: Language }>('/auth/language', {
    method: 'PUT',
    body: JSON.stringify({ language }),
  })
}

// `language` is the one stored on the account ('el' or 'en'), or null when the server sent none.
export async function loginPartner(
  email: string,
  password: string,
): Promise<{ email: string | null; language: Language | null }> {
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
  return { email: body?.email ?? null, language: body?.language === 'el' || body?.language === 'en' ? body.language : null }
}

// Row 153: a restaurant resets its own forgotten password by an emailed code. Both calls go to request-web's own
// server routes (src/pages/api/partner-auth/), which forward them to the backend. A failure throws the shape
// manualRequestFetch throws (`statusCode`, `code`, `params`), so the page words it with serverMessage; no answer at
// all gets NO_ANSWER_CODE (row 151).
async function postPasswordReset<T>(path: 'forgot-password' | 'reset-password', body: object): Promise<T | undefined> {
  let response: Response
  try {
    response = await fetch(`${PARTNER_AUTH_BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error: any) {
    if (typeof error === 'object' && error !== null) error.code = NO_ANSWER_CODE
    throw error
  }
  const text = await response.text()
  // `as any`: the body is whatever the server sent, read field by field below.
  let parsed: any
  try { parsed = text ? JSON.parse(text) : undefined } catch { parsed = undefined }
  if (!response.ok) {
    const wrapped = Array.isArray(parsed?.result) ? parsed.result[0] : null
    const said = wrapped?.message ?? parsed?.message
    // A validation refusal sends a list of sentences: joined, as manualRequestFetch does.
    const saidText = Array.isArray(said) ? said.join('; ') : said
    const err: any = new Error(typeof saidText === 'string' && saidText ? saidText : `Request failed (HTTP ${response.status})`)
    err.statusCode = wrapped?.statusCode ?? response.status
    // Review of row 153: the same no words rule as every other call (row 151), so a 500 or an empty answer gets
    // the page's own sentence.
    err.code = noWordsForTheRestaurant(err.statusCode, wrapped?.code ?? parsed?.code, said)
      ? NO_ANSWER_CODE
      : wrapped?.code
    err.params = wrapped?.params
    throw err
  }
  return (parsed?.result ?? parsed) as T | undefined
}

/** Asks for a reset code by email. The server answers the same whether or not the email has a login. */
export async function requestPasswordResetCode(email: string): Promise<void> {
  await postPasswordReset('forgot-password', { email })
}

/** Sets a new password with the emailed code. `apiKeyRemoved`: the restaurant's API key was switched off. */
export async function resetPartnerPassword(email: string, code: string, password: string): Promise<{ apiKeyRemoved: boolean }> {
  const answer = await postPasswordReset<{ apiKeyRemoved?: boolean }>('reset-password', { email, code, password })
  return { apiKeyRemoved: answer?.apiKeyRemoved === true }
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
// backend wrote for restaurants. `next` is a stop starting within 12 hours. `messageCode` (a key of
// `server.notice`) and `messageParams` are the same sentence by code (spec 0054), for the reader's language.
export type DispatchStopView = {
  reason: 'HEAT' | 'STORM' | 'OTHER'
  startsAt: string
  endsAt: string | null
  message: string
  messageCode?: string | null
  messageParams?: Record<string, unknown> | null
}
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

