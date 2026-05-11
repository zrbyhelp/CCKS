import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  createProjectZip,
  isProjectArchiveError,
  readProjectDownloadFile,
  sanitizeDownloadFilename,
} from '@/lib/project-archive'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const projectId = request.nextUrl.searchParams.get('projectId')
  const paths = request.nextUrl.searchParams.getAll('paths')
  const raw = request.nextUrl.searchParams.get('raw') === '1'

  try {
    const project = await getProjectWorkingDirectory(user.id, projectId)
    if (raw && paths.length === 1) {
      const file = await readProjectDownloadFile(project.localPath, paths[0])
      return new Response(toArrayBuffer(file.data), {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(file.size),
          'content-disposition': createAttachmentHeader(file.filename),
        },
      })
    }

    const archive = await createProjectZip(project.localPath, paths)
    const baseName = paths.length ? `${project.fileName}-selection.zip` : `${project.fileName}.zip`
    return new Response(toArrayBuffer(archive.data), {
      headers: {
        'content-type': 'application/zip',
        'content-length': String(archive.data.byteLength),
        'content-disposition': createAttachmentHeader(baseName),
        'x-ccks-archive-files': String(archive.fileCount),
      },
    })
  } catch (error) {
    if (isProjectStoreError(error) || isProjectArchiveError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '项目打包下载失败') }, { status: 500 })
  }
}

function createAttachmentHeader(filename: string) {
  const safeName = sanitizeDownloadFilename(filename, 'download.zip')
  return `attachment; filename="${encodeURIComponent(safeName).replace(/%/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
}

function toArrayBuffer(data: Uint8Array) {
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)
  return buffer
}
