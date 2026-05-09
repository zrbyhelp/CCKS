import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'ccks_session'

export function GET(request: NextRequest) {
  if (process.env.LOCAL_AUTH_BYPASS === 'true') {
    return NextResponse.json({
      user: {
        id: 'local-user',
        name: 'Local User',
        email: null,
        avatar: null,
      },
      admin: null,
    })
  }

  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value)
  return NextResponse.json(session || { user: null, admin: null })
}

function decodeSession(value: string | undefined) {
  if (!value) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    return null
  }

  return null
}
