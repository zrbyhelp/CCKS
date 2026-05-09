import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

const LOGIN_STATE_COOKIE = 'ccks_login_state'

export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') || '/'

  if (process.env.LOCAL_AUTH_BYPASS === 'true') {
    return NextResponse.redirect(new URL(next, request.url))
  }

  const portalUrl = process.env.NEXT_PUBLIC_ZR_PORTAL_URL
  const clientId = process.env.ZR_CLIENT_ID

  if (!portalUrl || !clientId) {
    return NextResponse.json({ ok: false, message: 'ZR portal login is not configured' }, { status: 500 })
  }

  const state = randomBytes(18).toString('base64url')
  const callback = process.env.ZR_CALLBACK_URL || new URL('/api/auth/callback', request.url).toString()
  const loginUrl = new URL('/login', portalUrl)

  loginUrl.searchParams.set('client_id', clientId)
  loginUrl.searchParams.set('callback', callback)
  loginUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(loginUrl)
  response.cookies.set(LOGIN_STATE_COOKIE, encodeState({ state, next }), {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/',
    sameSite: 'lax',
  })

  return response
}

function encodeState(value: { state: string; next: string }) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
