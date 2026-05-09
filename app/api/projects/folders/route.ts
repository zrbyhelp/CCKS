import { NextRequest, NextResponse } from 'next/server'
import { createProjectFolder, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await createProjectFolder(user.id, {
      projectId: body?.projectId,
      parentPath: body?.parentPath,
      folderName: body?.folderName,
    })

    return NextResponse.json({ ok: true, project }, { status: 201 })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '文件夹创建失败') }, { status: 500 })
  }
}
