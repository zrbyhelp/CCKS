import { NextRequest, NextResponse } from 'next/server'
import { isAiProviderStoreError, pullAiProviderModels } from '@/lib/ai-provider-store'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const models = await pullAiProviderModels(user.id, {
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
