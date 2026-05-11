import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSessionUser } from '@/lib/server-session'
import {
  deleteUserApiToken,
  getUserApiTokenSummary,
  isUserApiTokenError,
  upsertUserApiToken,
} from '@/lib/user-api-token-store'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })
  try {
    const token = await getUserApiTokenSummary(user.id)
    return NextResponse.json({ ok: true, token })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '接口 Token 加载失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })
  const body = await request.json().catch(() => null)
  try {
    const result = await upsertUserApiToken(user.id, body?.token)
    return NextResponse.json({ ok: true, token: result.summary, plainToken: result.token })
  } catch (error) {
    if (isUserApiTokenError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '接口 Token 保存失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })
  try {
    const token = await deleteUserApiToken(user.id)
    return NextResponse.json({ ok: true, token })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '接口 Token 删除失败') }, { status: 500 })
  }
}
