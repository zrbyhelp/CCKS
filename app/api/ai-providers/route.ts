import { NextRequest, NextResponse } from 'next/server'
import {
  createAiProvider,
  deleteAiProvider,
  isAiProviderStoreError,
  listAiProviders,
  updateAiProvider,
} from '@/lib/ai-provider-store'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const providers = await listAiProviders(user.id)
    return NextResponse.json({ ok: true, providers })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'AI 供应商加载失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const provider = await createAiProvider(user.id, {
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

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'AI 供应商创建失败') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const provider = await updateAiProvider(user.id, {
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

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'AI 供应商保存失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const provider = await deleteAiProvider(user.id, body?.providerId)
    return NextResponse.json({ ok: true, provider })
  } catch (error) {
    if (isAiProviderStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'AI 供应商删除失败') }, { status: 500 })
  }
}
