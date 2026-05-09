import { rm } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { cloneGitHubRepository, isGitSourceControlError } from '@/lib/git-source-control'
import {
  deriveProjectFileNameFromRepository,
  finalizeImportedProject,
  isProjectStoreError,
  normalizeProjectFileName,
  prepareImportedProjectTarget,
} from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const repositoryUrl = typeof body?.repositoryUrl === 'string' ? body.repositoryUrl.trim() : ''
  const githubToken = typeof body?.githubToken === 'string' ? body.githubToken.trim() : ''
  const fileName = normalizeProjectFileName(body?.fileName) || deriveProjectFileNameFromRepository(repositoryUrl)
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : fileName

  if (!githubToken) return NextResponse.json({ ok: false, message: '请先连接 GitHub' }, { status: 400 })
  if (!repositoryUrl) return NextResponse.json({ ok: false, message: 'GitHub 仓库地址不能为空' }, { status: 400 })
  if (!fileName) return NextResponse.json({ ok: false, message: '无法从仓库地址识别英文文件名' }, { status: 400 })

  let temporaryRoot = ''
  try {
    const target = await prepareImportedProjectTarget(user.id, { fileName })
    temporaryRoot = target.temporaryRoot
    await cloneGitHubRepository(repositoryUrl, githubToken, target.temporaryRoot)
    const project = await finalizeImportedProject(user.id, {
      name,
      fileName,
      repositoryUrl,
      temporaryRoot: target.temporaryRoot,
    })
    return NextResponse.json({ ok: true, project }, { status: 201 })
  } catch (error) {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined)
    if (isProjectStoreError(error) || isGitSourceControlError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'GitHub 项目导入失败') }, { status: 500 })
  }
}
