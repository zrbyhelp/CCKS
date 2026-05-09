import { NextRequest, NextResponse } from 'next/server'
import { createUserProject, deleteUserProject, isProjectStoreError, listUserProjects } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const projects = await listUserProjects(user.id)
    return NextResponse.json({ ok: true, projects })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '项目加载失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await createUserProject(user.id, {
      name: body?.name,
      fileName: body?.fileName,
    })

    return NextResponse.json({ ok: true, project }, { status: 201 })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '项目创建失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await deleteUserProject(user.id, body?.projectId)
    return NextResponse.json({ ok: true, project })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '项目删除失败') }, { status: 500 })
  }
}
