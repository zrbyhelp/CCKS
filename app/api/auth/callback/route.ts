import { NextRequest, NextResponse } from 'next/server'

const LOGIN_STATE_COOKIE = 'ccks_login_state'
const SESSION_COOKIE = 'ccks_session'

type LoginState = {
  state: string
  next: string
}

type SessionUser = {
  id: string
  name: string
  email: string | null
  avatar: string | null
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const storedState = decodeState(request.cookies.get(LOGIN_STATE_COOKIE)?.value)

  if (!code || !state || !storedState || storedState.state !== state) {
    return NextResponse.json({ ok: false, message: 'Invalid login callback' }, { status: 400 })
  }

  const portalUrl = process.env.NEXT_PUBLIC_ZR_PORTAL_URL
  const clientId = process.env.ZR_CLIENT_ID
  const clientSecret = process.env.ZR_CLIENT_SECRET

  if (!portalUrl || !clientId || !clientSecret) {
    return NextResponse.json({ ok: false, message: 'ZR portal credentials are not configured' }, { status: 500 })
  }

  const tokenUrl = new URL('/api/service-auth/token', portalUrl)
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret, code }),
    cache: 'no-store',
  }).catch(() => null)

  if (!tokenResponse?.ok) {
    return NextResponse.json({ ok: false, message: 'Failed to exchange login code' }, { status: 502 })
  }

  const payload = await tokenResponse.json().catch(() => null)
  const user = normalizeUser(payload)
  const response = NextResponse.redirect(new URL(storedState.next || '/', request.url))

  response.cookies.delete(LOGIN_STATE_COOKIE)
  response.cookies.set(SESSION_COOKIE, encodeSession({ user }), {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
  })

  return response
}

function normalizeUser(payload: any): SessionUser {
  const source = payload?.user || payload?.data?.user || payload?.profile || payload?.data || payload || {}
  const id = readString(source.id, source.userId, source.uuid, source.account, source.email) || 'portal-user'

  return {
    id,
    name: readString(source.name, source.userName, source.nickname, source.username, source.account) || '已登录用户',
    email: readNullableString(source.email, source.mail),
    avatar: readNullableString(source.avatar, source.avatarUrl, source.picture),
  }
}

function decodeState(value: string | undefined): LoginState | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed?.state === 'string' && typeof parsed?.next === 'string') return parsed
  } catch {
    return null
  }

  return null
}

function encodeSession(value: { user: SessionUser }) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function readNullableString(...values: unknown[]) {
  const value = readString(...values)
  return value || null
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized) return normalized
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}
