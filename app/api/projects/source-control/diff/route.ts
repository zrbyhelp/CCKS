import { NextRequest, NextResponse } from 'next/server'
import { isGitSourceControlError, readProjectDiff } from '@/lib/git-source-control'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const project = await getProjectWorkingDirectory(user.id, request.nextUrl.searchParams.get('projectId'))
    const diff = await readProjectDiff(project.localPath, request.nextUrl.searchParams.get('path'), request.nextUrl.searchParams.get('staged') === '1')
    return NextResponse.json({ ok: true, diff })
  } catch (error) {
    if (isProjectStoreError(error) || isGitSourceControlError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '差异内容读取失败') }, { status: 500 })
  }
}
