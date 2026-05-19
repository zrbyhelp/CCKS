import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSessionUser } from '@/lib/server-session'
import { readZflowPromptVariables } from '@/lib/zflow-runtime'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })
  try {
    const result = await readZflowPromptVariables(
      user.id,
      request.nextUrl.searchParams.get('projectId') || '',
      request.nextUrl.searchParams.get('path') || '',
    )
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '提示词变量读取失败') }, { status: 500 })
  }
}
