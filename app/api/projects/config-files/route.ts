import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { listCommonAiProviders } from '@/lib/ai-provider-store'
import { readProjectConfigCatalog } from '@/lib/project-config-files'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  try {
    const project = await getProjectWorkingDirectory(user.id, request.nextUrl.searchParams.get('projectId'))
    const catalog = await readProjectConfigCatalog(project.localPath)
    const commonProviders = await listCommonAiProviders()
    return NextResponse.json({ ok: true, ...catalog, providers: [...catalog.providers, ...commonProviders] })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '项目配置文件读取失败') }, { status: 500 })
  }
}
