import { NextRequest, NextResponse } from 'next/server'
import { isAiProviderStoreError, pullCommonAiProviderModels } from '@/lib/ai-provider-store'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSession } from '@/lib/server-session'

export const runtime = 'nodejs'

function requireAdmin(request: NextRequest) {
  const session = getSession(request)
  if (!session.user) return { ok: false as const, response: NextResponse.json({ ok: false, message: '未登录' }, { status: 401 }) }
  if (!session.admin) return { ok: false as const, response: NextResponse.json({ ok: false, message: '只有管理员可以管理通用供应商' }, { status: 403 }) }
  return { ok: true as const }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  try {
    const models = await pullCommonAiProviderModels({
      providerId: body?.providerId,
      providerType: body?.providerType,
      baseUrl: body?.baseUrl,
      apiKey: body?.apiKey,
    })

    return NextResponse.json({ ok: true, models })
  } catch (error) {
    if (isAiProviderStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '模型列表获取失败') }, { status: 500 })
  }
}
