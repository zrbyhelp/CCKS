import { NextRequest, NextResponse } from 'next/server'
import { commitAndPush, isGitSourceControlError } from '@/lib/git-source-control'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const githubToken = typeof body?.githubToken === 'string' ? body.githubToken.trim() : ''
  if (!githubToken) return NextResponse.json({ ok: false, message: '请先连接 GitHub' }, { status: 400 })

  try {
    const project = await getProjectWorkingDirectory(user.id, body?.projectId)
    const status = await commitAndPush(project.localPath, body?.message || '', githubToken)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    if (isProjectStoreError(error) || isGitSourceControlError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '提交推送失败') }, { status: 500 })
  }
}
