import { Tags } from '@/api/utils/tags'
import { api as baseApi } from '@/api'
import { AppState } from '@/redux/store'
import { handleBackendError } from '@/api/utils/api'
import {
  ManualRequestDeliveryDto,
  ManualRequestDeliveryInput,
  ManualRequestQuoteDto,
  ManualRequestQuoteInput,
} from '@/modules/manual-request/types'
import { EnumDeliveryEventType } from '@/shared-types'

const MANUAL_REQUEST_TAG = 'ManualRequest'

/**
 * Raw fetch helper that reuses the same base URL as the admin SDK
 * but calls the new manual-request endpoints directly (they are not
 * yet code-generated into the admin SDK).
 */
async function manualRequestFetch<T>(
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL?.replace('/v1', '')?.replace(/\/$/, '') ?? ''
  const url = `${baseUrl}/api/admin/v1/manual-request${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
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

export const manualRequestApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    // Step 1 – get estimate
    createManualRequestQuote: build.mutation<ManualRequestQuoteDto, ManualRequestQuoteInput>({
      queryFn: async (input, api) => {
        try {
          const { accessToken } = (api.getState() as AppState).auth
          const data = await manualRequestFetch<ManualRequestQuoteDto>(
            accessToken ?? '',
            '/quote',
            { method: 'POST', body: JSON.stringify(input) },
          )
          return { data }
        } catch (error) {
          return { error: handleBackendError(error, api) }
        }
      },
    }),

    // Step 2 – confirm delivery
    confirmManualRequestDelivery: build.mutation<ManualRequestDeliveryDto, ManualRequestDeliveryInput>({
      queryFn: async (input, api) => {
        try {
          const { accessToken } = (api.getState() as AppState).auth
          const data = await manualRequestFetch<ManualRequestDeliveryDto>(
            accessToken ?? '',
            '/delivery',
            { method: 'POST', body: JSON.stringify(input) },
          )
          return { data }
        } catch (error) {
          return { error: handleBackendError(error, api) }
        }
      },
      invalidatesTags: [Tags.deliveries],
    }),

    // Status polling
    getManualRequestDelivery: build.query<ManualRequestDeliveryDto, string>({
      queryFn: async (deliveryId, api) => {
        try {
          const { accessToken } = (api.getState() as AppState).auth
          const data = await manualRequestFetch<ManualRequestDeliveryDto>(
            accessToken ?? '',
            `/delivery/${deliveryId}`,
          )
          return { data }
        } catch (error) {
          return { error: handleBackendError(error, api) }
        }
      },
      providesTags: [Tags.deliveries],
    }),

    // Cancel
    cancelManualRequestDelivery: build.mutation<ManualRequestDeliveryDto, string>({
      queryFn: async (deliveryId, api) => {
        try {
          const { accessToken } = (api.getState() as AppState).auth
          const data = await manualRequestFetch<ManualRequestDeliveryDto>(
            accessToken ?? '',
            `/delivery/${deliveryId}/cancel`,
            { method: 'POST' },
          )
          return { data }
        } catch (error) {
          return { error: handleBackendError(error, api) }
        }
      },
      invalidatesTags: [Tags.deliveries],
    }),

    // Submit lifecycle event
    submitManualRequestEvent: build.mutation<
      ManualRequestDeliveryDto,
      { deliveryId: string; eventType: EnumDeliveryEventType }
    >({
      queryFn: async ({ deliveryId, eventType }, api) => {
        try {
          const { accessToken } = (api.getState() as AppState).auth
          const data = await manualRequestFetch<ManualRequestDeliveryDto>(
            accessToken ?? '',
            `/delivery/${deliveryId}/event`,
            {
              method: 'POST',
              body: JSON.stringify({ deliveryId, eventType }),
            },
          )
          return { data }
        } catch (error) {
          return { error: handleBackendError(error, api) }
        }
      },
      invalidatesTags: [Tags.deliveries],
    }),
  }),
})

export const {
  useCreateManualRequestQuoteMutation,
  useConfirmManualRequestDeliveryMutation,
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
  useSubmitManualRequestEventMutation,
} = manualRequestApi
