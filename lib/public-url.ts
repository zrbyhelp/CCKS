import type { NextRequest } from 'next/server'

const PUBLIC_URL_ENV_KEYS = ['CCKS_PUBLIC_URL', 'NEXT_PUBLIC_CCKS_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL', 'APP_URL'] as const

export function getPublicBaseUrl(request: NextRequest) {
  for (const key of PUBLIC_URL_ENV_KEYS) {
    const configuredUrl = normalizeBaseUrl(process.env[key])
    if (configuredUrl) return configuredUrl
  }

  const forwardedHost = readForwardedHeader(request.headers.get('x-forwarded-host'))
  const forwardedProto = readForwardedHeader(request.headers.get('x-forwarded-proto'))
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, '') || 'http'

  return `${protocol}://${host}`
}

export function buildPublicUrl(request: NextRequest, path: string) {
  return new URL(path, getPublicBaseUrl(request))
}

export function buildSameOriginRedirectUrl(request: NextRequest, target: string | null | undefined) {
  const baseUrl = getPublicBaseUrl(request)
  const fallbackUrl = new URL('/', baseUrl)

  if (!target) return fallbackUrl

  try {
    const url = new URL(target, baseUrl)
    if (url.origin !== fallbackUrl.origin) return fallbackUrl
    return url
  } catch {
    return fallbackUrl
  }
}

function normalizeBaseUrl(value: string | undefined) {
  const raw = value?.trim()
  if (!raw) return ''

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function readForwardedHeader(value: string | null) {
  return value?.split(',')[0]?.trim() || ''
}
