import { NextRequest, NextResponse } from 'next/server'
import { initializeProjectRepository, isGitSourceControlError } from '@/lib/git-source-control'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const project = await getProjectWorkingDirectory(user.id, body?.projectId)
    const status = await initializeProjectRepository(project.localPath)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    if (isProjectStoreError(error) || isGitSourceControlError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'Git 仓库初始化失败') }, { status: 500 })
  }
}
