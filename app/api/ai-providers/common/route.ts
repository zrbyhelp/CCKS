import { NextRequest, NextResponse } from 'next/server'
import {
  createCommonAiProvider,
  deleteCommonAiProvider,
  isAiProviderStoreError,
  listCommonAiProviders,
  updateCommonAiProvider,
} from '@/lib/ai-provider-store'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSession } from '@/lib/server-session'

export const runtime = 'nodejs'

function requireAdmin(request: NextRequest) {
  const session = getSession(request)
  if (!session.user) return { ok: false as const, response: NextResponse.json({ ok: false, message: '未登录' }, { status: 401 }) }
  if (!session.admin) return { ok: false as const, response: NextResponse.json({ ok: false, message: '只有管理员可以管理通用供应商' }, { status: 403 }) }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const providers = await listCommonAiProviders({ revealBaseUrl: true })
    return NextResponse.json({ ok: true, providers })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '通用供应商加载失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  try {
    const provider = await createCommonAiProvider({
      name: body?.name,
      providerType: body?.providerType,
      baseUrl: body?.baseUrl,
      apiKey: body?.apiKey,
      models: body?.models,
    })

    return NextResponse.json({ ok: true, provider }, { status: 201 })
  } catch (error) {
    if (isAiProviderStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '通用供应商创建失败') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  try {
    const provider = await updateCommonAiProvider({
      providerId: body?.providerId,
      name: body?.name,
      providerType: body?.providerType,
      baseUrl: body?.baseUrl,
      apiKey: body?.apiKey,
      models: body?.models,
    })

    return NextResponse.json({ ok: true, provider })
  } catch (error) {
    if (isAiProviderStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '通用供应商保存失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  try {
    const provider = await deleteCommonAiProvider(body?.providerId)
    return NextResponse.json({ ok: true, provider })
  } catch (error) {
    if (isAiProviderStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '通用供应商删除失败') }, { status: 500 })
  }
}
