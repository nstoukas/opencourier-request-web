import { useCallback, useEffect, useState } from 'react'
import {
  ManualRequestDeliveryDto,
  ManualRequestDeliveryInput,
  ManualRequestQuoteDto,
  ManualRequestQuoteInput,
} from '../modules/manual-request/types'
import { EnumDeliveryEventType } from '../shared-types'

/**
 * Standalone fetch helper for request-web.
 * This app talks directly to opencourier-backend manual-request endpoints.
 */
const MANUAL_REQUEST_BASE_PATH = '/api/admin/v1/manual-request'

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

function getAccessToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('accessToken') ?? ''
}

async function manualRequestFetch<T>(
  path: string,
  options?: RequestInit & { accessToken?: string },
): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${MANUAL_REQUEST_BASE_PATH}${path}`
  const accessToken = options?.accessToken ?? getAccessToken()

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options?.headers ?? {}),
    },
  })

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

  const body = await response.json()
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

export function useCreateManualRequestQuoteMutation() {
  return useStandaloneMutation<ManualRequestQuoteInput, ManualRequestQuoteDto>((input) =>
    manualRequestFetch('/quote', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

export function useConfirmManualRequestDeliveryMutation() {
  return useStandaloneMutation<ManualRequestDeliveryInput, ManualRequestDeliveryDto>((input) =>
    manualRequestFetch('/delivery', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

export function useCancelManualRequestDeliveryMutation() {
  return useStandaloneMutation<string, ManualRequestDeliveryDto>((deliveryId) =>
    manualRequestFetch(`/delivery/${deliveryId}/cancel`, {
      method: 'POST',
    }),
  )
}

export function useSubmitManualRequestEventMutation() {
  return useStandaloneMutation<{ deliveryId: string; eventType: EnumDeliveryEventType }, ManualRequestDeliveryDto>(
    ({ deliveryId, eventType }) =>
      manualRequestFetch(`/delivery/${deliveryId}/event`, {
        method: 'POST',
        body: JSON.stringify({ deliveryId, eventType }),
      }),
  )
}

export function useGetManualRequestDeliveryQuery(
  deliveryId: string,
  options?: { skip?: boolean },
) {
  const [data, setData] = useState<ManualRequestDeliveryDto | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(!options?.skip)
  const [error, setError] = useState<unknown>(undefined)

  const fetchDelivery = useCallback(async () => {
    if (!deliveryId || options?.skip) return
    setIsLoading(true)
    setError(undefined)
    try {
      const response = await manualRequestFetch<ManualRequestDeliveryDto>(`/delivery/${deliveryId}`)
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
