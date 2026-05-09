import { NextRequest, NextResponse } from 'next/server'
import {
  createProjectFile,
  deleteProjectEntry,
  isProjectStoreError,
  readProjectFile,
  renameProjectEntry,
  writeProjectFile,
} from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const file = await readProjectFile(user.id, {
      projectId: request.nextUrl.searchParams.get('projectId'),
      filePath: request.nextUrl.searchParams.get('path'),
    })

    return NextResponse.json({ ok: true, file })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '文件读取失败') }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const file = await writeProjectFile(user.id, {
      projectId: body?.projectId,
      filePath: body?.path,
      content: body?.content,
    })

    return NextResponse.json({ ok: true, file })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '文件保存失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await createProjectFile(user.id, {
      projectId: body?.projectId,
      parentPath: body?.parentPath,
      fileName: body?.fileName,
      content: body?.content,
    })

    return NextResponse.json({ ok: true, project }, { status: 201 })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '文件创建失败') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await renameProjectEntry(user.id, {
      projectId: body?.projectId,
      entryPath: body?.path,
      nextName: body?.nextName,
    })

    return NextResponse.json({ ok: true, project })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '重命名失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await deleteProjectEntry(user.id, {
      projectId: body?.projectId,
      entryPath: body?.path,
    })

    return NextResponse.json({ ok: true, project })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '删除失败') }, { status: 500 })
  }
}
