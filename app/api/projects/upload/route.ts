import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { isProjectStoreError, uploadProjectFiles, type ProjectUploadFile } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ ok: false, message: '上传数据无效' }, { status: 400 })
  const projectId = formData.get('projectId')
  const targetPath = formData.get('targetPath')
  const overwrite = formData.get('overwrite') === 'true'
  const files = formData.getAll('files').filter((item): item is File => item instanceof File)
  const paths = formData.getAll('paths').map((item) => String(item || ''))
  if (!files.length) return NextResponse.json({ ok: false, message: '没有可上传的文件' }, { status: 400 })

  try {
    const uploadFiles: ProjectUploadFile[] = await Promise.all(files.map(async (file, index) => ({
      relativePath: paths[index] || file.name,
      data: new Uint8Array(await file.arrayBuffer()),
    })))
    const result = await uploadProjectFiles(user.id, {
      projectId,
      targetPath,
      files: uploadFiles,
      overwrite,
    })
    if (result.conflicts.length) {
      return NextResponse.json({ ok: false, code: 'UPLOAD_CONFLICT', message: '存在同名文件或文件夹', conflicts: result.conflicts, project: result.project }, { status: 409 })
    }
    return NextResponse.json({ ok: true, project: result.project, uploaded: result.uploaded })
  } catch (error) {
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '文件上传失败') }, { status: 500 })
  }
}
