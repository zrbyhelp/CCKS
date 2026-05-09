import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  copyRecipeVariableToPersonal,
  createPersonalRecipeVariable,
  createPersonalRecipeVariableCategory,
  deletePersonalRecipeVariable,
  deletePersonalRecipeVariableCategory,
  isRecipeVariableStoreError,
  listRecipeVariableCatalog,
  updatePersonalRecipeVariable,
  updatePersonalRecipeVariableCategory,
} from '@/lib/recipe-variable-store'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const catalog = await listRecipeVariableCatalog(user.id)
    return NextResponse.json({ ok: true, ...catalog })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '配方变量加载失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    if (body?.kind === 'category') {
      const category = await createPersonalRecipeVariableCategory(user.id, body)
      return NextResponse.json({ ok: true, category }, { status: 201 })
    }

    if (body?.kind === 'copy') {
      const variable = await copyRecipeVariableToPersonal(user.id, body)
      return NextResponse.json({ ok: true, variable }, { status: 201 })
    }

    const variable = await createPersonalRecipeVariable(user.id, body || {})
    return NextResponse.json({ ok: true, variable }, { status: 201 })
  } catch (error) {
    if (isRecipeVariableStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '配方变量创建失败') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    if (body?.kind === 'category') {
      const category = await updatePersonalRecipeVariableCategory(user.id, body)
      return NextResponse.json({ ok: true, category })
    }

    const variable = await updatePersonalRecipeVariable(user.id, body || {})
    return NextResponse.json({ ok: true, variable })
  } catch (error) {
    if (isRecipeVariableStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '配方变量保存失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    if (body?.kind === 'category') {
      const category = await deletePersonalRecipeVariableCategory(user.id, body?.categoryId)
      return NextResponse.json({ ok: true, category })
    }

    const variable = await deletePersonalRecipeVariable(user.id, body?.variableId)
    return NextResponse.json({ ok: true, variable })
  } catch (error) {
    if (isRecipeVariableStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '配方变量删除失败') }, { status: 500 })
  }
}
