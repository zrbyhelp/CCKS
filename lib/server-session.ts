import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'ccks_session'
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export type SessionUser = {
  id: string
  name: string
  account: string | null
  email: string | null
  avatar: string | null
}

export type AdminUser = {
  name: string
  account: string | null
  email: string | null
  userId: string
}

export type AppSession = {
  user: SessionUser | null
  admin: AdminUser | null
}

const LOCAL_USER: SessionUser = {
  id: 'local-user',
  name: 'Local User',
  account: 'local',
  email: 'local@example.local',
  avatar: null,
}

export function getSessionUser(request: NextRequest): SessionUser | null {
  return getSession(request).user
}

export function getAdminSession(request: NextRequest): AdminUser | null {
  return getSession(request).admin
}

export function getSession(request: NextRequest): AppSession {
  if (isLocalAuthBypassEnabled()) {
    return {
      user: { ...LOCAL_USER },
      admin: createAdminUser(LOCAL_USER),
    }
  }

  const session = decodeSessionCookie(request.cookies.get(SESSION_COOKIE)?.value)
  const user = normalizeSessionUser(session?.user)
  return {
    user,
    admin: session?.trusted ? getAdminForUser(user) : null,
  }
}

export function isAdminUser(user: SessionUser | null | undefined) {
  return Boolean(getAdminForUser(user))
}

export function encodeSession(value: { user: SessionUser }) {
  const payload = Buffer.from(JSON.stringify({ value, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })).toString('base64url')
  return `${payload}.${hmac(payload)}`
}

function decodeSessionCookie(value: string | undefined): { user: unknown; trusted: boolean } | null {
  if (!value) return null

  const signed = decodeSignedSession(value)
  if (signed) return { user: signed.user, trusted: true }

  const legacy = decodeLegacySession(value)
  if (legacy) return { user: legacy.user, trusted: false }

  return null
}

function decodeSignedSession(value: string) {
  const [payload, signature] = value.split('.')
  if (!payload || !signature || !verifyHmac(payload, signature)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    const source = parsed as Record<string, unknown>
    if (typeof source.exp !== 'number' || source.exp < Date.now()) return null
    if (!isRecord(source.value)) return null
    return source.value as Record<string, unknown>
  } catch {
    return null
  }
}

function decodeLegacySession(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (isRecord(parsed)) return parsed as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

function normalizeSessionUser(value: unknown): SessionUser | null {
  if (!isRecord(value)) return null
  const source = value as Record<string, unknown>
  const id = readString(source.id)
  if (!id) return null

  return {
    id,
    name: readString(source.name) || '已登录用户',
    account: readNullableString(source.account),
    email: readNullableString(source.email),
    avatar: readNullableString(source.avatar),
  }
}

function getAdminForUser(user: SessionUser | null | undefined): AdminUser | null {
  if (!user) return null

  const accounts = splitEnvList(process.env.CCKS_ADMIN_ACCOUNTS || process.env.ADMIN_ACCOUNTS || process.env.NUXT_ADMIN_ACCOUNTS)
  const emails = splitEnvList(process.env.CCKS_ADMIN_EMAILS || process.env.ADMIN_EMAILS || process.env.NUXT_ADMIN_EMAILS)
  const account = normalizeIdentifier(user.account)
  const email = normalizeIdentifier(user.email)
  const matched = Boolean((account && accounts.includes(account)) || (email && emails.includes(email)))

  return matched ? createAdminUser(user) : null
}

function createAdminUser(user: SessionUser): AdminUser {
  return {
    name: user.name || user.account || user.email || user.id,
    account: user.account || null,
    email: user.email || null,
    userId: user.id,
  }
}

function isLocalAuthBypassEnabled() {
  return readBooleanFlag(process.env.LOCAL_AUTH_BYPASS, false)
}

function splitEnvList(value: unknown) {
  return String(value || '')
    .split(',')
    .map(normalizeIdentifier)
    .filter(Boolean)
}

function normalizeIdentifier(value: unknown) {
  return readString(value).toLowerCase()
}

function hmac(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function verifyHmac(payload: string, signature: string) {
  const expected = hmac(payload)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

function getSessionSecret() {
  return process.env.CCKS_SESSION_SECRET || process.env.SESSION_SECRET || 'dev-session-secret-change-me'
}

function readBooleanFlag(value: unknown, fallback: boolean) {
  const normalized = readString(value).toLowerCase()
  if (!normalized) return fallback
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function readNullableString(value: unknown) {
  return readString(value) || null
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS }
