import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'ccks_session'

export type SessionUser = {
  id: string
  name: string
  email: string | null
  avatar: string | null
}

export function getSessionUser(request: NextRequest): SessionUser | null {
  if (process.env.LOCAL_AUTH_BYPASS === 'true') {
    return {
      id: 'local-user',
      name: 'Local User',
      email: null,
      avatar: null,
    }
  }

  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value)
  return normalizeSessionUser(session?.user)
}

function decodeSession(value: string | undefined) {
  if (!value) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch {
    return null
  }

  return null
}

function normalizeSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const id = readString(source.id)
  if (!id) return null

  return {
    id,
    name: readString(source.name) || '已登录用户',
    email: readNullableString(source.email),
    avatar: readNullableString(source.avatar),
  }
}

function readNullableString(value: unknown) {
  return readString(value) || null
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}
