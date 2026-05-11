import { rm } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { extractProjectZipToDirectory, isProjectArchiveError } from '@/lib/project-archive'
import {
  finalizeZipImportedProject,
  isProjectStoreError,
  normalizeProjectFileName,
  prepareImportedProjectTarget,
} from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  const rawFileName = typeof formData?.get('fileName') === 'string' ? String(formData.get('fileName')) : ''
  const fileName = normalizeProjectFileName(rawFileName) || normalizeProjectFileName(readZipBaseName(file instanceof File ? file.name : ''))
  const name = typeof formData?.get('name') === 'string' && String(formData.get('name')).trim()
    ? String(formData.get('name')).trim()
    : fileName

  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: '请上传 ZIP 文件' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.zip')) return NextResponse.json({ ok: false, message: '只支持 .zip 文件' }, { status: 400 })
  if (!fileName) return NextResponse.json({ ok: false, message: '项目文件名只能使用英文、数字、下划线或连字符，并且必须以英文字母开头' }, { status: 400 })

  let temporaryRoot = ''
  try {
    const target = await prepareImportedProjectTarget(user.id, { fileName })
    temporaryRoot = target.temporaryRoot
    await extractProjectZipToDirectory(new Uint8Array(await file.arrayBuffer()), target.temporaryRoot)
    const project = await finalizeZipImportedProject(user.id, {
      name,
      fileName,
      temporaryRoot: target.temporaryRoot,
    })
    temporaryRoot = ''
    return NextResponse.json({ ok: true, project }, { status: 201 })
  } catch (error) {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined)
    if (isProjectStoreError(error) || isProjectArchiveError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'ZIP 项目导入失败') }, { status: 500 })
  }
}

function readZipBaseName(value: string) {
  return value.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-')
}
