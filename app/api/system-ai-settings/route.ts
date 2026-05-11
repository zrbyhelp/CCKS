import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSession } from '@/lib/server-session'
import {
  getSystemAiSetting,
  isSystemAiSettingError,
  saveSystemAiSetting,
} from '@/lib/system-ai-settings-store'

export const runtime = 'nodejs'

function requireAdmin(request: NextRequest) {
  const session = getSession(request)
  if (!session.user) return { ok: false as const, response: NextResponse.json({ ok: false, message: '未登录' }, { status: 401 }) }
  if (!session.admin) return { ok: false as const, response: NextResponse.json({ ok: false, message: '只有管理员可以配置系统 LLM AI' }, { status: 403 }) }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response
  try {
    const setting = await getSystemAiSetting()
    return NextResponse.json({ ok: true, setting })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '系统 AI 设置加载失败') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  try {
    const setting = await saveSystemAiSetting({
      providerType: body?.providerType,
      baseUrl: body?.baseUrl,
      apiKey: body?.apiKey,
      clearApiKey: body?.clearApiKey,
      models: body?.models,
      model: body?.model,
      reasoningEffort: body?.reasoningEffort,
      maxToolRounds: body?.maxToolRounds,
    })
    return NextResponse.json({ ok: true, setting })
  } catch (error) {
    if (isSystemAiSettingError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '系统 AI 设置保存失败') }, { status: 500 })
  }
}
