import { NextRequest } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { readProjectFile } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import {
  parseZflowLangGraphContent,
  runZflowLangGraph,
  type ZflowLangGraphDocument,
  type ZflowRuntimeEvent,
} from '@/lib/zflow-runtime'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return Response.json({ ok: false, message: '未登录' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ZflowRuntimeEvent | { type: 'diagnostic'; message: string }) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const document = await resolveDocument(user.id, body)
        if (!document) {
          send({ type: 'diagnostic', message: '.zflow 文件不是 ccks.zflow.langgraph 新格式' })
          controller.close()
          return
        }
        await runZflowLangGraph({
          userId: user.id,
          projectId: String(body?.projectId || ''),
          document,
          input: isRecord(body?.input) ? body.input : {},
          threadId: typeof body?.threadId === 'string' ? body.threadId : undefined,
          maxSteps: body?.maxSteps,
          onEvent: send,
        })
      } catch (error) {
        send({ type: 'diagnostic', message: apiErrorMessage(error, '流程运行失败') })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}

async function resolveDocument(userId: string, body: Record<string, unknown> | null): Promise<ZflowLangGraphDocument | null> {
  if (body?.document) return body.document as ZflowLangGraphDocument
  const file = await readProjectFile(userId, { projectId: body?.projectId, filePath: body?.path })
  return parseZflowLangGraphContent(file.content)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
