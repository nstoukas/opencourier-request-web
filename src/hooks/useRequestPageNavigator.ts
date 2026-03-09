import { useRouter } from 'next/router'

export enum ERequestRoutes {
  HOME = '/',
  LOGIN = '/login',
  MANUAL_REQUEST = '/manual-request',
  MANUAL_REQUEST_STATUS = '/manual-request/[deliveryId]/status',
}

export const RequestRoutes = Object.values(ERequestRoutes)

type NavigationArgs = {
  query?: Record<string, string>
  search?: string | null | undefined
}

/** Handle request-web app navigation. */
export const useRequestPageNavigator = () => {
  const router = useRouter()
  return {
    goHome: (args?: NavigationArgs) => router.push({ pathname: ERequestRoutes.HOME, ...args }),
    goToLogin: (args?: NavigationArgs) => router.push({ pathname: ERequestRoutes.LOGIN, ...args }),
    goToManualRequest: (args?: NavigationArgs) => router.push({ pathname: ERequestRoutes.MANUAL_REQUEST, ...args }),
    goToManualRequestStatus: (deliveryId: string, args?: NavigationArgs) => {
      const { query = {}, ...otherArgs } = args ?? {}
      return router.push({
        pathname: ERequestRoutes.MANUAL_REQUEST_STATUS,
        query: { deliveryId, ...query },
        ...otherArgs,
      })
    },
  }
}
