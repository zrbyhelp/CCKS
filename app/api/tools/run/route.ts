import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { isAiToolRunnerError, runAiTool } from '@/lib/ai-tool-runner'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const startedAt = Date.now()

  try {
    const result = await runAiTool(user.id, {
      toolId: body?.toolId,
      input: body?.input,
      context: body?.context,
    })

    return NextResponse.json({
      ok: true,
      toolId: body?.toolId,
      result,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    if (isAiToolRunnerError(error)) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, durationMs: Date.now() - startedAt },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { ok: false, message: apiErrorMessage(error, '工具执行失败'), durationMs: Date.now() - startedAt },
      { status: 500 },
    )
  }
}
