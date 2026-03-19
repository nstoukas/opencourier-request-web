const ACCESS_TOKEN_STORAGE_KEY = 'accessToken'
const API_KEY_STORAGE_KEY = 'manualRequestApiKey'

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '')
}

export function getManualRequestApiMode() {
  return (process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_MODE ?? 'admin').toLowerCase()
}

export function getManualRequestAuthMode() {
  const configured = process.env.NEXT_PUBLIC_MANUAL_REQUEST_AUTH_MODE?.trim()
  if (configured) return configured.toLowerCase()

  return getManualRequestApiMode() === 'partner' ? 'api-key' : 'bearer'
}

export function requiresManualRequestAuth() {
  return getManualRequestAuthMode() !== 'none'
}

export function getManualRequestApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

  if (!configuredUrl) {
    return '/backend-api'
  }

  if (configuredUrl.startsWith('/')) {
    return normalizeBaseUrl(configuredUrl)
  }

  try {
    const parsedUrl = new URL(configuredUrl)
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname)) {
      return '/backend-api'
    }
  } catch {
    return normalizeBaseUrl(configuredUrl)
  }

  return normalizeBaseUrl(configuredUrl)
}

export function getManualRequestBasePath() {
  const configuredPath = process.env.NEXT_PUBLIC_MANUAL_REQUEST_BASE_PATH?.trim()
  if (configuredPath) return configuredPath.replace(/\/$/, '')

  return getManualRequestApiMode() === 'partner'
    ? '/api/partner/v1'
    : '/api/admin/v1/manual-request'
}

export function getEnvManualRequestAccessToken() {
  return process.env.NEXT_PUBLIC_MANUAL_REQUEST_ACCESS_TOKEN?.trim() ?? ''
}

export function getEnvManualRequestApiKey() {
  return process.env.NEXT_PUBLIC_MANUAL_REQUEST_API_KEY?.trim() ?? ''
}

export function getLocalManualRequestAccessToken() {
  if (typeof window === 'undefined') return ''
  return (window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '').trim()
}

export function getLocalManualRequestApiKey() {
  if (typeof window === 'undefined') return ''
  return (window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? '').trim()
}

export function getManualRequestAccessToken() {
  const localToken = getLocalManualRequestAccessToken()
  if (localToken) return localToken
  return getEnvManualRequestAccessToken()
}

export function getManualRequestApiKey() {
  const localApiKey = getLocalManualRequestApiKey()
  if (localApiKey) return localApiKey
  return getEnvManualRequestApiKey()
}

export function getManualRequestAuthCredential() {
  return getManualRequestAuthMode() === 'api-key'
    ? getManualRequestApiKey()
    : getManualRequestAccessToken()
}

export function setManualRequestAccessToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
}

export function setManualRequestApiKey(apiKey: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
}

export function clearManualRequestAccessToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function clearManualRequestApiKey() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export function getManualRequestTokenSource() {
  if (getManualRequestAuthMode() === 'api-key') {
    if (getLocalManualRequestApiKey()) return 'localStorage'
    if (getEnvManualRequestApiKey()) return 'env'
    return 'none'
  }

  if (getLocalManualRequestAccessToken()) return 'localStorage'
  if (getEnvManualRequestAccessToken()) return 'env'
  return 'none'
}

export function getJwtExpiry(token: string): Date | null {
  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) return null

  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    const decoder = typeof atob === 'function' ? atob : null
    if (!decoder) return null
    const json = decoder(payload)
    const data = JSON.parse(json) as { exp?: number }
    if (!data.exp) return null
    return new Date(data.exp * 1000)
  } catch {
    return null
  }
}
