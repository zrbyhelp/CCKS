import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { authenticateUserApiToken } from '@/lib/user-api-token-store'
import { readProjectFile } from '@/lib/project-store'
import {
  collectZpmtVariableDescriptors,
  parseZpmtContentForRuntime,
  validateZpmtDocumentForRuntime,
} from '@/lib/zpmt-document'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await authenticateUserApiToken(request.headers.get('authorization'))
  if (!auth) return NextResponse.json({ ok: false, message: 'Token 无效或已撤销' }, { status: 401 })
  try {
    const file = await readProjectFile(auth.userId, {
      projectId: request.nextUrl.searchParams.get('projectId'),
      filePath: request.nextUrl.searchParams.get('path'),
    })
    if (!file.path.toLowerCase().endsWith('.zpmt')) {
      return NextResponse.json({ ok: false, message: '只支持 .zpmt 文件' }, { status: 400 })
    }
    const document = parseZpmtContentForRuntime(file.content)
    const validation = validateZpmtDocumentForRuntime({ document })
    if (!document) return NextResponse.json({ ok: false, validation }, { status: 400 })
    return NextResponse.json({
      ok: true,
      projectId: file.projectId,
      path: file.path,
      kind: document.kind,
      outputType: document.config.outputType,
      variables: collectZpmtVariableDescriptors(document),
      validation,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '提示词变量列表读取失败') }, { status: 500 })
  }
}
