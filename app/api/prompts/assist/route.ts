import path from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { readProjectConfigCatalog } from '@/lib/project-config-files'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import {
  requestSystemAiJson,
  requestSystemAiJsonStream,
  requestSystemAiTextStream,
  type SystemAiContentPart,
  type SystemAiStreamEvent,
  type SystemAiToolDefinition,
} from '@/lib/system-ai-client'
import { getSystemAiRuntimeProvider, isSystemAiSettingError } from '@/lib/system-ai-settings-store'
import {
  createRecipeVariableSnapshot,
  findRecipeVariableBySourceId,
  flattenRecipeVariables,
  formatRecipeVariableSourceId,
  type RecipeVariableCategory,
  type RecipeVariableItem,
} from '@/lib/recipe-variables'
import {
  collectZpmtVariableDescriptors,
  parseZpmtContentForRuntime,
  validateZpmtDocumentForRuntime,
} from '@/lib/zpmt-document'

export const runtime = 'nodejs'

const MAX_DOC_BYTES = 160 * 1024
const MAX_DOC_RESULTS = 20
const DOC_EXTENSIONS = new Set(['.md', '.markdown', '.prompt', '.zpmt', '.zlex', '.json', '.txt'])
type ProjectConfigCatalog = Awaited<ReturnType<typeof readProjectConfigCatalog>>
type AssistIntent = { mode: 'modify' | 'answer'; summary: string; reason: string }
type AssistContextMessage = { role: 'user' | 'assistant'; content: string }
type AssistContext = {
  request: string
  project: { id: string; name: string }
  file: { path: string }
  currentValidation: ReturnType<typeof validateZpmtDocumentForRuntime>
  currentVariables: ReturnType<typeof collectZpmtVariableDescriptors>
  currentRecipeMetadata: unknown
  currentContent: string
  availableProviders: Array<Record<string, unknown>>
  recipeVariableCategoryCount: number
  contextMessages: AssistContextMessage[]
}
type AssistToolHandlers = Record<string, (args: Record<string, unknown>) => Promise<unknown>>

const SUPPORTED_VARIABLE_SYNTAX = [
  {
    type: 'str',
    name: '文本变量',
    syntax: '{{str:名称;length<120;default=默认内容}}',
    params: ['length<数字：长度约束', 'default=文本：默认值'],
    examples: ['{{str:主题;length<120}}', '{{str:参考资料;length<5000}}'],
  },
  {
    type: 'num',
    name: '数值变量',
    syntax: '{{num:名称;range=0..100;default=50}}',
    params: ['range=最小..最大：数值范围', 'default=数字：默认值'],
    examples: ['{{num:温度;range=0..2;default=0.7}}', '{{num:生成数量;range=1..8;default=3}}'],
  },
  {
    type: 'arr',
    name: '数组变量',
    syntax: '{{arr:名称;itemType=string;length<8;default=重点1,重点2}}',
    params: ['itemType=string|number|boolean|object：数组项类型', 'length<数字：数量约束', 'default=逗号分隔或 JSON 数组'],
    examples: ['{{arr:关键点;itemType=string;length<8}}', '{{arr:评分;itemType=number;length<5}}'],
  },
  {
    type: 'bool',
    name: '布尔变量',
    syntax: '{{bool:名称;default=false}}',
    params: ['default=true|false：默认开关'],
    examples: ['{{bool:是否联网;default=false}}', '{{bool:输出表格;default=true}}'],
  },
  {
    type: 'color',
    name: '颜色变量',
    syntax: '{{color:名称;default=#FB7E3D}}',
    params: ['default=#RRGGBB：默认颜色'],
    examples: ['{{color:品牌主色;default=#FB7E3D}}'],
  },
  {
    type: 'img',
    name: '图片变量',
    syntax: '{{img:名称;count<=3;size<10MB}}',
    params: ['count<=数字：图片数量上限', 'size<大小：单文件大小约束'],
    examples: ['{{img:参考图;count<=3;size<10MB}}', '{{img:主体人像;count<=1}}'],
  },
  {
    type: 'file',
    name: '文件变量',
    syntax: '{{file:名称;size<10MB}}',
    params: ['size<大小：单文件大小约束'],
    examples: ['{{file:需求文档;size<10MB}}'],
  },
  {
    type: 'recipe',
    name: '配方变量',
    syntax: '{{recipe:名称;source=system:变量ID;multi=true;default=候选1,候选2}}',
    params: ['source=来源ID：必须来自 get_recipe_variable 工具', 'multi=true|false：是否多选', 'default=候选值：默认候选'],
    examples: ['{{recipe:写作语气;source=system:writing-tone;multi=true}}'],
  },
  {
    type: 'const',
    name: '常量变量',
    syntax: '{{const:名称;kind=today}}',
    params: ['kind=today|time|weekday|iso|timestamp|uuid|shortId|now'],
    examples: ['{{const:今天;kind=today}}', '{{const:请求ID;kind=uuid}}'],
  },
]

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const wantsStream = body?.stream === true || request.headers.get('accept')?.includes('text/event-stream')
  const filePath = readString(body?.path)
  if (!filePath.toLowerCase().endsWith('.zpmt')) {
    return NextResponse.json({ ok: false, message: 'AI 辅助只支持 .zpmt 文件' }, { status: 400 })
  }
  const documentContent = readText(body?.content)
  const currentDocument = parseZpmtContentForRuntime(documentContent)
  if (!currentDocument) return NextResponse.json({ ok: false, message: '当前 .zpmt 文件结构无效，请先修复 JSON' }, { status: 400 })

  const startedAt = Date.now()
  try {
    const project = await getProjectWorkingDirectory(user.id, body?.projectId)
    const catalog = await readProjectConfigCatalog(project.localPath)
    const provider = await getSystemAiRuntimeProvider()
    const attachments = readArray(body?.attachments).flatMap(readAttachment)
    const tools = createAssistTools()
    const instruction = readText(body?.instruction).slice(0, 8000)
    const contextMessages = readAssistContextMessages(body?.contextMessages)
    const requirePreviousVariables = !isExplicitVariableRemovalRequest(instruction)
    const toolHandlers = {
      search_project_documents: async (args: Record<string, unknown>) => searchProjectDocuments(project.localPath, readString(args.query), readString(args.scope)),
      read_project_document: async (args: Record<string, unknown>) => readProjectDocument(project.localPath, readString(args.path)),
      search_recipe_variables: async (args: Record<string, unknown>) => searchRecipeVariables(catalog.recipeCategories, readString(args.query)),
      get_recipe_variable: async (args: Record<string, unknown>) => getRecipeVariableDetail(catalog.recipeCategories, {
        sourceId: readString(args.sourceId || args.source),
        id: readString(args.id),
        variableName: readString(args.variableName || args.name),
        tokenName: readString(args.tokenName),
      }),
      search_supported_variables: async (args: Record<string, unknown>) => searchSupportedVariables(readString(args.query)),
      check_zpmt_document: async (args: Record<string, unknown>) => {
        const content = typeof args.content === 'string' ? args.content : JSON.stringify(args.document || {}, null, 2)
        const document = parseZpmtContentForRuntime(content)
        return validateZpmtDocumentForRuntime({
          document,
          previousDocument: currentDocument,
          requirePreviousVariables,
          strictRecipeMetadata: true,
        })
      },
    }
    const baseContext = buildAssistContext({
      project: { id: project.id, name: project.name },
      filePath,
      instruction,
      documentContent,
      currentDocument,
      catalog,
      contextMessages,
    })
    const intent = await classifyAssistIntent({
      provider,
      context: baseContext,
      attachments,
      signal: request.signal,
    })

    if (wantsStream) {
      return createAssistStreamResponse({
        startedAt,
        provider,
        tools,
        toolHandlers,
        context: baseContext,
        intent,
        attachments,
        currentDocument,
        requirePreviousVariables,
        signal: request.signal,
      })
    }

    if (intent.mode === 'answer') {
      const result = await requestSystemAiTextStream({
        provider,
        tools,
        toolHandlers,
        maxToolRounds: provider.maxToolRounds,
        temperature: 0.3,
        maxTokens: 6000,
        signal: request.signal,
        onEvent: () => undefined,
        messages: createAssistAnswerMessages(baseContext, intent, attachments),
      })
      return NextResponse.json({
        ok: true,
        mode: 'answer',
        summary: intent.summary || 'AI 已回答',
        answer: result.output,
        thinking: result.thinking,
        toolRounds: result.toolRounds,
        toolCallCount: result.toolCallCount,
        toolEvents: result.toolEvents,
        durationMs: Date.now() - startedAt,
      })
    }

    const result = await requestSystemAiJson({
      provider,
      tools,
      toolHandlers,
      maxToolRounds: provider.maxToolRounds,
      temperature: 0.2,
      maxTokens: 12000,
      messages: createAssistModifyMessages(baseContext, intent, attachments),
    })
    const content = readText(result.json.content)
    const proposedDocument = parseZpmtContentForRuntime(content)
    const validation = withRequiredCheckToolIssue(
      validateZpmtDocumentForRuntime({
        document: proposedDocument,
        previousDocument: currentDocument,
        requirePreviousVariables,
        strictRecipeMetadata: true,
      }),
      result.toolEvents,
    )
    return NextResponse.json({
      ok: validation.ok,
      mode: 'modify',
      summary: readString(result.json.summary) || 'AI 已生成候选修改',
      content,
      notes: readArray(result.json.notes).map(readString).filter(Boolean),
      validation,
      thinking: result.thinking,
      toolRounds: result.toolRounds,
      toolCallCount: result.toolCallCount,
      toolEvents: result.toolEvents,
      message: validation.ok ? '' : 'AI 生成内容未通过 .zpmt 检查，请调整要求后重试',
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    if (wantsStream) return createAssistErrorStreamResponse(error, startedAt)
    if (isSystemAiSettingError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    if (isProjectStoreError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, 'AI 辅助失败') }, { status: 500 })
  }
}

async function classifyAssistIntent(input: {
  provider: Awaited<ReturnType<typeof getSystemAiRuntimeProvider>>
  context: AssistContext
  attachments: SystemAiContentPart[]
  signal: AbortSignal
}): Promise<AssistIntent> {
  const result = await requestSystemAiJson({
    provider: input.provider,
    temperature: 0,
    maxTokens: 800,
    messages: [
      {
        role: 'system',
        content: [
          '你是“从词开始”AI 辅助的路由判断 Agent。',
          '只判断用户这次请求应该进入哪条流程，不回答用户，也不修改文件。',
          '如果用户明确要求优化、修改、重写、补充、生成、替换、修复当前 .zpmt 内容或变量，mode=modify。',
          '如果用户是在询问、解释、查询、让你分析当前文件/项目/变量/模板、或只想得到建议，mode=answer。',
          '如果语义含糊但没有明确要求落到文件，优先 mode=answer。',
          '必须只输出 JSON object：{"mode":"modify|answer","summary":"一句话摘要","reason":"判断理由"}。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          request: input.context.request,
          file: input.context.file,
          currentVariables: input.context.currentVariables,
          hasAttachments: input.attachments.length > 0,
          recentContext: input.context.contextMessages,
          currentContentExcerpt: input.context.currentContent.slice(0, 4000),
        }),
      },
    ],
  })
  const rawMode = readString(result.json.mode)
  return {
    mode: rawMode === 'modify' ? 'modify' : 'answer',
    summary: readString(result.json.summary) || (rawMode === 'modify' ? '准备修改 .zpmt' : '准备回答问题'),
    reason: readString(result.json.reason),
  }
}

function createAssistStreamResponse(input: {
  startedAt: number
  provider: Awaited<ReturnType<typeof getSystemAiRuntimeProvider>>
  tools: SystemAiToolDefinition[]
  toolHandlers: AssistToolHandlers
  context: AssistContext
  intent: AssistIntent
  attachments: SystemAiContentPart[]
  currentDocument: NonNullable<ReturnType<typeof parseZpmtContentForRuntime>>
  requirePreviousVariables: boolean
  signal: AbortSignal
}) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        try {
          send({ type: 'start', mode: input.intent.mode, summary: input.intent.summary, reason: input.intent.reason })
          if (input.intent.mode === 'answer') {
            const result = await requestSystemAiTextStream({
              provider: input.provider,
              tools: input.tools,
              toolHandlers: input.toolHandlers,
              maxToolRounds: input.provider.maxToolRounds,
              temperature: 0.3,
              maxTokens: 7000,
              signal: input.signal,
              messages: createAssistAnswerMessages(input.context, input.intent, input.attachments),
              onEvent: (event) => send(mapSystemAiStreamEvent(event, 'answer')),
            })
            send({
              type: 'done',
              ok: true,
              mode: 'answer',
              summary: input.intent.summary || 'AI 已回答',
              answer: result.output,
              output: result.output,
              thinking: result.thinking,
              toolRounds: result.toolRounds,
              toolCallCount: result.toolCallCount,
              toolEvents: result.toolEvents,
              durationMs: Date.now() - input.startedAt,
            })
            return
          }

          const result = await requestSystemAiJsonStream({
            provider: input.provider,
            tools: input.tools,
            toolHandlers: input.toolHandlers,
            maxToolRounds: input.provider.maxToolRounds,
            temperature: 0.2,
            maxTokens: 12000,
            signal: input.signal,
            messages: createAssistModifyMessages(input.context, input.intent, input.attachments),
            onEvent: (event) => send(mapSystemAiStreamEvent(event, 'modify')),
          })
          const content = readText(result.json.content)
          const proposedDocument = parseZpmtContentForRuntime(content)
          const validation = withRequiredCheckToolIssue(
            validateZpmtDocumentForRuntime({
              document: proposedDocument,
              previousDocument: input.currentDocument,
              requirePreviousVariables: input.requirePreviousVariables,
              strictRecipeMetadata: true,
            }),
            result.toolEvents,
          )
          send({ type: 'validation', mode: 'modify', validation })
          send({
            type: 'done',
            ok: validation.ok,
            mode: 'modify',
            summary: readString(result.json.summary) || 'AI 已生成候选修改',
            content,
            notes: readArray(result.json.notes).map(readString).filter(Boolean),
            validation,
            thinking: result.thinking,
            toolRounds: result.toolRounds,
            toolCallCount: result.toolCallCount,
            toolEvents: result.toolEvents,
            message: validation.ok ? '' : 'AI 生成内容未通过 .zpmt 检查，请调整要求后重试',
            durationMs: Date.now() - input.startedAt,
          })
        } catch (error) {
          send(readAssistErrorEvent(error, input.startedAt))
        } finally {
          controller.close()
        }
      },
    }),
    {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    },
  )
}

function createAssistErrorStreamResponse(error: unknown, startedAt: number) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(readAssistErrorEvent(error, startedAt))}\n\n`))
        controller.close()
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
      },
    },
  )
}

function readAssistErrorEvent(error: unknown, startedAt: number) {
  if (isSystemAiSettingError(error) || isProjectStoreError(error)) {
    return { type: 'error', ok: false, code: error.code, message: error.message, durationMs: Date.now() - startedAt }
  }
  return { type: 'error', ok: false, message: apiErrorMessage(error, 'AI 辅助失败'), durationMs: Date.now() - startedAt }
}

function mapSystemAiStreamEvent(event: SystemAiStreamEvent, mode: AssistIntent['mode']) {
  if (event.type === 'tool_start') {
    return {
      type: 'tool',
      mode,
      status: 'start',
      toolName: event.event.toolName,
      args: event.event.args,
      message: event.event.message || '调用工具',
    }
  }
  if (event.type === 'tool_done') {
    return {
      type: 'tool',
      mode,
      status: 'done',
      toolName: event.event.toolName,
      args: event.event.args,
      result: event.event.result,
      message: event.event.message || '工具完成',
    }
  }
  return { ...event, mode }
}

function buildAssistContext(input: {
  project: { id: string; name: string }
  filePath: string
  instruction: string
  documentContent: string
  currentDocument: NonNullable<ReturnType<typeof parseZpmtContentForRuntime>>
  catalog: ProjectConfigCatalog
  contextMessages: AssistContextMessage[]
}): AssistContext {
  return {
    request: input.instruction,
    project: input.project,
    file: { path: input.filePath },
    currentValidation: validateZpmtDocumentForRuntime({ document: input.currentDocument }),
    currentVariables: collectZpmtVariableDescriptors(input.currentDocument),
    currentRecipeMetadata: input.currentDocument.metadata.recipeVariables.map((item) => ({
      tokenName: item.tokenName,
      sourceId: item.sourceId,
      variableName: item.variableName,
      name: item.name,
      candidates: item.candidates,
      defaultValues: item.defaultValues,
      multiple: item.multiple,
    })),
    currentContent: input.documentContent.slice(0, 90000),
    availableProviders: input.catalog.providers.map((item) => ({
      id: item.id,
      name: item.name,
      filePath: item.filePath,
      models: item.models.map((model) => ({ id: model.id, capabilities: model.capabilities, toolCalling: model.toolCalling })),
    })),
    recipeVariableCategoryCount: input.catalog.recipeCategories.length,
    contextMessages: input.contextMessages,
  }
}

function createAssistModifyMessages(context: AssistContext, intent: AssistIntent, attachments: SystemAiContentPart[]) {
  return [
    {
      role: 'system' as const,
      content: [
        '你是“从词开始”工作台的 .zpmt 文件编辑助手。',
        '你必须只输出 JSON object，不能输出 Markdown。',
        '输出格式：{"summary":"修改摘要","content":"完整的新 .zpmt JSON 字符串","notes":["注意事项"]}。',
        'content 必须是完整可解析 JSON，schema 必须保持 ccks.zpmt，不能只返回片段。',
        '必须保留当前文件已有变量 token、变量名和配方变量 metadata；除非用户明确要求删除变量。',
        '如果新增 {{recipe:...}}，必须先用 search_recipe_variables/get_recipe_variable 获取真实配方变量，并把返回的 snapshot 放入 metadata.recipeVariables。',
        '不要编造 recipe sourceId；不知道变量语法时先调用 search_supported_variables。',
        '需要查询项目文档、模板、配方变量或 README 时，必须调用工具，不要凭空猜测。',
        '完成修改前必须调用 check_zpmt_document 检查候选 .zpmt 内容，并根据检查结果修正。',
        '不要泄露、编造或请求供应商密钥、系统 AI 密钥、用户 Token。',
        `本轮路由判断：${intent.mode}，理由：${intent.reason || '未提供'}`,
      ].join('\n'),
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(context),
        },
        ...attachments,
      ],
    },
  ]
}

function createAssistAnswerMessages(context: AssistContext, intent: AssistIntent, attachments: SystemAiContentPart[]) {
  return [
    {
      role: 'system' as const,
      content: [
        '你是“从词开始”工作台的 .zpmt 文件问答助手。',
        '你现在处于“回答”流程，只返回自然语言文本，不返回候选 .zpmt 文件，不要求用户应用修改。',
        '回答要围绕当前文件、项目文档、变量语法和配方变量；需要事实依据时必须调用工具查询。',
        '可以调用 search_supported_variables、search_recipe_variables、get_recipe_variable、search_project_documents、read_project_document。',
        '不要泄露、编造或请求供应商密钥、系统 AI 密钥、用户 Token。',
        '如果用户的问题其实需要修改文件，说明可以改，并给出你建议的改法，但不要输出完整文件。',
        `本轮路由判断：${intent.mode}，理由：${intent.reason || '未提供'}`,
      ].join('\n'),
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            ...context,
            currentContent: context.currentContent.slice(0, 60000),
          }),
        },
        ...attachments,
      ],
    },
  ]
}

function withRequiredCheckToolIssue(
  validation: ReturnType<typeof validateZpmtDocumentForRuntime>,
  toolEvents: Array<{ toolName?: string; status?: string }>,
) {
  const checked = toolEvents.some((event) => event.toolName === 'check_zpmt_document' && event.status === 'done')
  if (checked) return validation
  const issues = [
    ...validation.issues,
    { level: 'error' as const, code: 'CHECK_TOOL_NOT_CALLED', message: 'AI 修改流程必须先调用 check_zpmt_document 检查候选 .zpmt 文件' },
  ]
  return { ok: false, issues }
}

function createAssistTools(): SystemAiToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'search_project_documents',
        description: '搜索当前项目内的 README、Markdown、prompt、zpmt、zlex、templates 等相关文档信息。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
            scope: { type: 'string', description: '可选目录范围，例如 templates、_global、pages' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_project_document',
        description: '读取当前项目内一个相关文档文件的内容。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '项目内相对路径' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_recipe_variables',
        description: '搜索当前项目可用的配方变量、系统词汇和用户词汇。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_recipe_variable',
        description: '根据 sourceId、id 或变量名读取单个配方变量详情，并返回可写入 .zpmt metadata.recipeVariables 的 snapshot。',
        parameters: {
          type: 'object',
          properties: {
            sourceId: { type: 'string', description: '配方变量来源 ID，例如 system:writing-tone' },
            id: { type: 'string', description: '配方变量 id，例如 writing-tone' },
            variableName: { type: 'string', description: '变量英文或中文名称' },
            tokenName: { type: 'string', description: '准备写入 token 的变量名，可用中文' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_supported_variables',
        description: '搜索 .zpmt 当前支持的变量语法、参数和示例。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '语法类型或关键词，例如 数组、图片、recipe、uuid、颜色' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'check_zpmt_document',
        description: '检查候选 .zpmt 文件是否可解析、结构是否正常。',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '完整 .zpmt JSON 字符串' },
            document: { type: 'object', description: '候选 .zpmt JSON 对象' },
          },
        },
      },
    },
  ]
}

async function searchProjectDocuments(projectRoot: string, query: string, scope: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return { ok: false, message: 'query 不能为空', results: [] }
  const files = await listProjectDocumentFiles(projectRoot, scope)
  const results: Array<{ path: string; score: number; excerpt: string }> = []
  for (const filePath of files) {
    const absolutePath = resolveProjectPath(projectRoot, filePath)
    const stats = await stat(absolutePath).catch(() => null)
    if (!stats?.isFile() || stats.size > MAX_DOC_BYTES) continue
    const content = await readFile(absolutePath, 'utf8').catch(() => '')
    const haystack = `${filePath}\n${content}`.toLowerCase()
    const index = haystack.indexOf(normalizedQuery)
    if (index < 0) continue
    const excerptStart = Math.max(0, index - 120)
    results.push({
      path: filePath,
      score: filePath.toLowerCase().includes(normalizedQuery) ? 2 : 1,
      excerpt: content.slice(excerptStart, excerptStart + 600),
    })
  }
  return {
    ok: true,
    results: results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path, 'zh-Hans-CN')).slice(0, MAX_DOC_RESULTS),
  }
}

async function readProjectDocument(projectRoot: string, filePath: string) {
  if (!filePath) return { ok: false, message: 'path 不能为空' }
  const absolutePath = resolveProjectPath(projectRoot, filePath)
  const stats = await stat(absolutePath).catch(() => null)
  if (!stats?.isFile()) return { ok: false, message: '文档不存在' }
  if (stats.size > MAX_DOC_BYTES) return { ok: false, message: '文档过大，无法读取' }
  const extension = path.extname(filePath).toLowerCase()
  if (!DOC_EXTENSIONS.has(extension)) return { ok: false, message: '该文件类型不在文档查询范围内' }
  return { ok: true, path: normalizeRelativePath(filePath), content: await readFile(absolutePath, 'utf8') }
}

function searchRecipeVariables(categories: Parameters<typeof flattenRecipeVariables>[0], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return { ok: false, message: 'query 不能为空', results: [] }
  const variables = flattenRecipeVariables(categories)
  return {
    ok: true,
    results: variables
      .map((variable) => ({
        variable,
        haystack: [
          variable.variable.variableName,
          variable.variable.name.zh,
          variable.variable.name.en,
          variable.variable.description.zh,
          variable.variable.content.zh,
          variable.variable.candidates.zh.join(' '),
        ].join('\n').toLowerCase(),
      }))
      .filter((item) => item.haystack.includes(normalizedQuery))
      .slice(0, 30)
      .map((item) => ({
        id: item.variable.variable.id,
        sourceId: formatRecipeVariableSourceId(item.variable.variable),
        categoryName: item.variable.category.name,
        name: item.variable.variable.name,
        variableName: item.variable.variable.variableName,
        content: item.variable.variable.content,
        candidates: item.variable.variable.candidates,
        defaultValues: item.variable.variable.defaultValues,
        multiple: item.variable.variable.multiple,
        tokenExample: createRecipeTokenExample(item.variable.variable),
      })),
  }
}

function getRecipeVariableDetail(
  categories: RecipeVariableCategory[],
  query: { sourceId: string; id: string; variableName: string; tokenName: string },
) {
  const flattened = flattenRecipeVariables(categories)
  const sourceMatch = query.sourceId ? findRecipeVariableBySourceId(categories, query.sourceId) : null
  const normalizedId = query.id.trim().toLowerCase()
  const normalizedName = query.variableName.trim().toLowerCase()
  const match = sourceMatch || flattened.find(({ variable }) => {
    if (normalizedId && variable.id.toLowerCase() === normalizedId) return true
    if (normalizedName && variable.variableName.toLowerCase() === normalizedName) return true
    if (normalizedName && variable.name.zh.toLowerCase() === normalizedName) return true
    if (normalizedName && variable.name.en.toLowerCase() === normalizedName) return true
    return false
  }) || null

  if (!match) return { ok: false, message: '未找到配方变量' }
  const sourceId = formatRecipeVariableSourceId(match.variable)
  const tokenName = normalizeTokenName(query.tokenName || match.variable.name.zh || match.variable.variableName)
  const snapshot = createRecipeVariableSnapshot({
    tokenName,
    sourceId,
    category: match.category,
    variable: match.variable,
  })
  return {
    ok: true,
    id: match.variable.id,
    sourceId,
    categoryName: match.category.name,
    name: match.variable.name,
    variableName: match.variable.variableName,
    description: match.variable.description,
    content: match.variable.content,
    candidates: match.variable.candidates,
    defaultValues: match.variable.defaultValues,
    multiple: match.variable.multiple,
    tokenName,
    tokenExample: createRecipeTokenExample(match.variable, tokenName),
    snapshot,
  }
}

function searchSupportedVariables(query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return { ok: true, results: SUPPORTED_VARIABLE_SYNTAX }
  return {
    ok: true,
    results: SUPPORTED_VARIABLE_SYNTAX.filter((item) => [
      item.type,
      item.name,
      item.syntax,
      item.params.join(' '),
      item.examples.join(' '),
    ].join('\n').toLowerCase().includes(normalizedQuery)).slice(0, 20),
  }
}

function createRecipeTokenExample(variable: Pick<RecipeVariableItem, 'name' | 'variableName' | 'multiple' | 'defaultValues' | 'id' | 'sourceId' | 'scope'>, tokenName?: string) {
  const sourceId = formatRecipeVariableSourceId(variable)
  const name = normalizeTokenName(tokenName || variable.name.zh || variable.variableName) || '配方变量'
  const parts = [`recipe:${name}`, `source=${sourceId}`, `multi=${String(variable.multiple)}`]
  if (variable.defaultValues.length) parts.push(`default=${variable.defaultValues.join(',')}`)
  return `{{${parts.join(';')}}}`
}

function normalizeTokenName(value: string) {
  return value
    .trim()
    .replace(/[{};:\s]+/g, '_')
    .replace(/[^\p{L}\p{N}_-]/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

async function listProjectDocumentFiles(projectRoot: string, scope: string) {
  const root = scope ? resolveProjectPath(projectRoot, scope) : projectRoot
  const rootStats = await stat(root).catch(() => null)
  if (!rootStats) return []
  const files: string[] = []
  async function visit(directory: string) {
    if (files.length > 300) return
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next') continue
      const absoluteEntryPath = path.resolve(directory, entry.name)
      const relativePath = normalizeRelativePath(path.relative(projectRoot, absoluteEntryPath))
      if (entry.isDirectory()) {
        await visit(absoluteEntryPath)
      } else if (entry.isFile() && DOC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(relativePath)
      }
    }
  }
  if (rootStats.isDirectory()) await visit(root)
  else if (rootStats.isFile()) files.push(normalizeRelativePath(path.relative(projectRoot, root)))
  return files
}

function resolveProjectPath(projectRoot: string, relativePath: string) {
  const normalized = normalizeRelativePath(relativePath)
  const target = path.resolve(projectRoot, normalized)
  const relative = path.relative(projectRoot, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('路径无效')
  return target
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function readAttachment(value: unknown): SystemAiContentPart[] {
  if (!isRecord(value)) return []
  const filename = readString(value.filename) || 'upload'
  const mimeType = readString(value.mimeType)
  const dataUrl = readString(value.dataUrl)
  if (!dataUrl) return []
  if (mimeType.startsWith('image/')) return [{ type: 'image_url', image_url: { url: dataUrl } }]
  return [{ type: 'file', file: { filename, file_data: dataUrl } }]
}

function readAssistContextMessages(value: unknown): AssistContextMessage[] {
  return readArray(value)
    .slice(-8)
    .flatMap((item): AssistContextMessage[] => {
      if (!isRecord(item)) return []
      const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null
      const content = readText(item.content || item.summary || item.message).slice(0, 3000)
      if (!role || !content) return []
      return [{ role, content }]
    })
}

function isExplicitVariableRemovalRequest(value: string) {
  return /删除变量|移除变量|去掉变量|删掉变量|删除.*\{\{|移除.*\{\{|去掉.*\{\{/i.test(value)
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function readText(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
