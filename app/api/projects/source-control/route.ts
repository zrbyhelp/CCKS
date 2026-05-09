import { NextRequest, NextResponse } from 'next/server'
import { readSourceControlStatus } from '@/lib/git-source-control'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const project = await getProjectWorkingDirectory(user.id, request.nextUrl.searchParams.get('projectId'))
    const status = await readSourceControlStatus(project.localPath)
    return NextResponse.json({
      ok: true,
      status: {
        ...status,
        repositoryUrl: status.repositoryUrl || project.repositoryUrl || '',
      },
    })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '源代码管理状态读取失败') }, { status: 500 })
  }
}
