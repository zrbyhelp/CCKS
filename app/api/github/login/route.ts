import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { buildPublicUrl } from '@/lib/public-url'

const GITHUB_STATE_COOKIE = 'ccks_github_state'

export function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return NextResponse.json({ ok: false, message: 'GITHUB_CLIENT_ID 未配置' }, { status: 500 })

  const state = randomUUID()
  const callback = process.env.GITHUB_CALLBACK_URL || buildPublicUrl(request, '/api/github/callback').toString()
  const next = request.nextUrl.searchParams.get('next') || '/'
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', callback)
  authorizeUrl.searchParams.set('scope', 'repo')
  authorizeUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(GITHUB_STATE_COOKIE, encodeState({ state, next }), {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/',
    secure: process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
  })
  return response
}

function encodeState(value: { state: string; next: string }) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
