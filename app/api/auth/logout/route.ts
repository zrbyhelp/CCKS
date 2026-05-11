import { NextRequest, NextResponse } from 'next/server'
import { buildPublicUrl } from '@/lib/public-url'

const SESSION_COOKIE = 'ccks_session'

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(buildPublicUrl(request, '/'))
  response.cookies.delete(SESSION_COOKIE)
  return response
}

export function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
