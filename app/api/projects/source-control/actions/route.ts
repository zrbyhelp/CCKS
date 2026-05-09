import { NextRequest, NextResponse } from 'next/server'
import {
  checkoutProjectBranch,
  commitProjectChanges,
  createProjectBranch,
  discardProjectPath,
  fetchProjectRepository,
  initializeProjectRepository,
  isGitSourceControlError,
  publishProjectRepository,
  pullProjectRepository,
  pushProjectRepository,
  setProjectRemote,
  stageProjectPath,
  syncProjectRepository,
  unstageProjectPath,
} from '@/lib/git-source-control'
import { getProjectWorkingDirectory, isProjectStoreError, updateProjectRepositoryUrl } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { apiErrorMessage } from '@/lib/api-errors'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = typeof body?.action === 'string' ? body.action : ''
  const githubToken = typeof body?.githubToken === 'string' ? body.githubToken.trim() : ''

  try {
    const project = await getProjectWorkingDirectory(user.id, body?.projectId)
    let status
    let repositoryUrl = ''

    switch (action) {
      case 'initialize':
        status = await initializeProjectRepository(project.localPath)
        break
      case 'stage':
        status = await stageProjectPath(project.localPath, body?.path)
        break
      case 'stageAll':
        status = await stageProjectPath(project.localPath)
        break
      case 'unstage':
        status = await unstageProjectPath(project.localPath, body?.path)
        break
      case 'unstageAll':
        status = await unstageProjectPath(project.localPath)
        break
      case 'discard':
        status = await discardProjectPath(project.localPath, body?.path)
        break
      case 'commit':
        status = await commitProjectChanges(project.localPath, body?.message || '', body?.mode === 'all' ? 'all' : 'staged')
        break
      case 'pull':
        status = await pullProjectRepository(project.localPath, githubToken)
        break
      case 'fetch':
        status = await fetchProjectRepository(project.localPath, githubToken)
        break
      case 'push':
        status = await pushProjectRepository(project.localPath, githubToken)
        break
      case 'sync':
        status = await syncProjectRepository(project.localPath, githubToken)
        break
      case 'setRemote':
        status = await setProjectRemote(project.localPath, body?.repositoryUrl || '')
        repositoryUrl = status.repositoryUrl
        await updateProjectRepositoryUrl(user.id, project.id, repositoryUrl)
        break
      case 'checkoutBranch':
        status = await checkoutProjectBranch(project.localPath, body?.branchName || '')
        break
      case 'createBranch':
        status = await createProjectBranch(project.localPath, body?.branchName || '')
        break
      case 'publish': {
        const result = await publishProjectRepository(project.localPath, {
          repositoryName: body?.repositoryName || project.fileName,
          privateRepository: body?.privateRepository,
          token: githubToken,
        })
        repositoryUrl = result.repositoryUrl
        await updateProjectRepositoryUrl(user.id, project.id, repositoryUrl)
        status = result.status
        break
      }
      default:
        return NextResponse.json({ ok: false, message: '未知的源代码管理操作' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, status, repositoryUrl })
  } catch (error) {
    if (isProjectStoreError(error) || isGitSourceControlError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '源代码管理操作失败') }, { status: 500 })
  }
}
