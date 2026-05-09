import { NextRequest, NextResponse } from 'next/server'

const GITHUB_STATE_COOKIE = 'ccks_github_state'

type GitHubState = {
  state: string
  next: string
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const storedState = decodeState(request.cookies.get(GITHUB_STATE_COOKIE)?.value)

  if (!code || !state || !storedState || storedState.state !== state) {
    return NextResponse.json({ ok: false, message: 'Invalid GitHub callback' }, { status: 400 })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, message: 'GitHub OAuth credentials are not configured' }, { status: 500 })
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    cache: 'no-store',
  }).catch(() => null)

  if (!tokenResponse?.ok) {
    return NextResponse.json({ ok: false, message: 'Failed to exchange GitHub code' }, { status: 502 })
  }

  const payload = await tokenResponse.json().catch(() => null)
  const accessToken = typeof payload?.access_token === 'string' ? payload.access_token : ''
  if (!accessToken) return NextResponse.json({ ok: false, message: 'GitHub access token missing' }, { status: 502 })

  const profile = await fetch('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/vnd.github+json',
    },
    cache: 'no-store',
  })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)

  const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>GitHub connected</title></head>
<body>
<script>
  localStorage.setItem('ccks-github-session', ${JSON.stringify(
    JSON.stringify({
      accessToken,
      tokenType: payload?.token_type || 'bearer',
      scope: payload?.scope || '',
      user: {
        id: profile?.id || null,
        login: profile?.login || '',
        avatarUrl: profile?.avatar_url || '',
      },
      connectedAt: new Date().toISOString(),
    }),
  )});
  location.replace(${JSON.stringify(storedState.next || '/')});
</script>
GitHub 已连接，正在返回...
</body>
</html>`

  const response = new NextResponse(html, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    },
  })
  response.cookies.delete(GITHUB_STATE_COOKIE)
  return response
}

function decodeState(value: string | undefined): GitHubState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed?.state === 'string' && typeof parsed?.next === 'string') return parsed
  } catch {
    return null
  }
  return null
}
