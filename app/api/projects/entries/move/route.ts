import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { isProjectStoreError, moveProjectEntries } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const result = await moveProjectEntries(user.id, {
      projectId: body?.projectId,
      entryPaths: body?.paths,
      targetPath: body?.targetPath,
      overwrite: body?.overwrite,
    })
    if (result.conflicts.length) {
      return NextResponse.json({ ok: false, code: 'MOVE_CONFLICT', message: '目标目录存在同名文件或文件夹', conflicts: result.conflicts, project: result.project }, { status: 409 })
    }
    return NextResponse.json({ ok: true, project: result.project, moved: result.moved })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '文件移动失败') }, { status: 500 })
  }
}
