import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'ccks_session'

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url))
  response.cookies.delete(SESSION_COOKIE)
  return response
}

export function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
