import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { readProjectFile } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import {
  parseZflowLangGraphContent,
  validateZflowLangGraphDocument,
  type ZflowLangGraphDocument,
} from '@/lib/zflow-runtime'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const document = await resolveDocument(user.id, body)
    if (!document) {
      return NextResponse.json({
        ok: false,
        diagnostics: [{ level: 'error', code: 'DOCUMENT_INVALID', message: '.zflow 文件不是 ccks.zflow.langgraph 新格式' }],
      }, { status: 400 })
    }
    const diagnostics = validateZflowLangGraphDocument(document)
    return NextResponse.json({
      ok: !diagnostics.some((item) => item.level === 'error'),
      document,
      diagnostics,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '流程编译失败') }, { status: 500 })
  }
}

async function resolveDocument(userId: string, body: Record<string, unknown> | null): Promise<ZflowLangGraphDocument | null> {
  if (body?.document) return body.document as ZflowLangGraphDocument
  const projectId = body?.projectId
  const path = body?.path
  const file = await readProjectFile(userId, { projectId, filePath: path })
  return parseZflowLangGraphContent(file.content)
}
