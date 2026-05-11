import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { getCommonAiProviderForRuntime, isCommonAiProviderRef } from '@/lib/ai-provider-store'
import { readProjectConfigCatalog } from '@/lib/project-config-files'
import { getProjectWorkingDirectory, isProjectStoreError } from '@/lib/project-store'
import { getSessionUser } from '@/lib/server-session'
import { runAiTool } from '@/lib/ai-tool-runner'
import {
  createAiToolFunctionSchema,
  getAiToolDefinition,
  getAiToolDefinitionByFunctionName,
  getAiToolFunctionName,
  type AiToolFunctionSchema,
} from '@/lib/tool-definitions'
import type { ProjectAiProviderSummary } from '@/lib/project-config-types'
import { resolveAiModelPromptSurface, type AiProviderModel, type ReferenceInputSupport, type ZpmtResponseConfig } from '@/lib/ai-presets'

export const runtime = 'nodejs'

type PromptDocumentKind = 'chat' | 'agent' | 'image'

type PromptTestToolBinding = {
  id: string
  toolId: string
  config: Record<string, unknown>
}

type PromptTestDocument = {
  kind: PromptDocumentKind
  config: {
    outputType: string
    providerFile: string
    providerId: string
    model: string
    responseConfig: Record<string, unknown>
  }
  messages: Array<{ role: 'system' | 'user'; content: string }>
  system: string
  user: string
  prompt: string
  negativePrompt: string
  style: { mode: string; value: string; extraText: string }
  tools: PromptTestToolBinding[]
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ChatContentPart[] | null
  tool_calls?: ChatToolCall[]
  tool_call_id?: string
  name?: string
}

type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

type ChatToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

type PromptTestMediaFile = {
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}

type PromptTestStreamEvent =
  | { type: 'start'; outputType: 'text' }
  | { type: 'thinking'; delta: string }
  | { type: 'content'; delta: string }
  | { type: 'tool'; status: 'start' | 'done'; toolName: string; message?: string }
  | { type: 'error'; code: string; message: string; durationMs: number }
  | { type: 'done'; outputType: 'text'; output: string; thinking: string; durationMs: number; toolRounds: number; toolCallCount: number }

type PromptTestStreamHandler = (event: PromptTestStreamEvent) => void

const MAX_TOOL_ROUNDS_LIMIT = 20
const DEFAULT_MEDIA_FILE_LIMIT = 10 * 1024 * 1024
const MAX_MEDIA_REQUEST_BYTES = 50 * 1024 * 1024

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const startedAt = Date.now()
  const body = await request.json().catch(() => null)
  const wantsStream = body?.stream === true || request.headers.get('accept')?.includes('text/event-stream')

  try {
    const context = isRecord(body?.context) ? body.context : {}
    const project = await getProjectWorkingDirectory(user.id, context.projectId)
    const catalog = await readProjectConfigCatalog(project.localPath)
    const document = readPromptTestDocument(body?.document)
    const provider = await resolveProvider(catalog.providers, document.config.providerFile, document.config.providerId)
    if (!provider) throw new PromptTestError('PROVIDER_NOT_FOUND', '未找到当前 .zpmt 绑定的供应商')
    if (!provider.apiKey) throw new PromptTestError('PROVIDER_API_KEY_MISSING', '当前供应商未配置 API Key')
    if (!document.config.model) throw new PromptTestError('MODEL_REQUIRED', '请先选择模型')

    const model = provider.models.find((item) => item.id === document.config.model) || null
    const variableValues = readVariableValues(body?.variables)
    const mediaVariables = readMediaVariables(body?.mediaVariables)

    if (document.kind === 'image' || document.config.outputType === 'image') {
      const result = await runImageGeneration({
        provider,
        document,
        model,
        variableValues,
        mediaVariables,
      })
      return NextResponse.json({
        ok: true,
        outputType: 'image',
        ...result,
        durationMs: Date.now() - startedAt,
      })
    }

    if (document.config.outputType !== 'text') throw new PromptTestError('OUTPUT_TYPE_UNSUPPORTED', '当前测试类型与模型输出类型不匹配')
    const maxToolRounds = clampInteger(body?.maxToolRounds, 5, 0, MAX_TOOL_ROUNDS_LIMIT)
    const toolSchemas = document.kind === 'agent' && maxToolRounds > 0 ? buildBoundToolSchemas(document.tools) : []
    if (toolSchemas.length && model?.toolCalling !== 'supported') {
      throw new PromptTestError('MODEL_TOOLS_UNSUPPORTED', '当前模型不支持工具调用')
    }

    validateTextMediaVariables(document, mediaVariables, model)
    const messages = buildChatMessages(document, variableValues, mediaVariables)

    if (wantsStream) {
      return createPromptTestStreamResponse({
        startedAt,
        userId: user.id,
        provider,
        document,
        messages,
        toolSchemas,
        maxToolRounds,
        context: {
          projectId: project.id,
          path: readString(context.path),
        },
      })
    }

    const result = await runAgentCompletion({
      userId: user.id,
      provider,
      document,
      messages,
      toolSchemas,
      maxToolRounds,
      context: {
        projectId: project.id,
        path: readString(context.path),
      },
    })

    return NextResponse.json({
      ok: true,
      outputType: 'text',
      ...result,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    if (wantsStream) return createPromptTestErrorStreamResponse(error, startedAt)
    if (error instanceof PromptTestError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, durationMs: Date.now() - startedAt },
        { status: 400 },
      )
    }
    if (isProjectStoreError(error)) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, durationMs: Date.now() - startedAt },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { ok: false, message: apiErrorMessage(error, '提示词测试运行失败'), durationMs: Date.now() - startedAt },
      { status: 500 },
    )
  }
}

async function runImageGeneration(input: {
  provider: ProjectAiProviderSummary
  document: PromptTestDocument
  model: AiProviderModel | null
  variableValues: Record<string, string>
  mediaVariables: Record<string, PromptTestMediaFile[]>
}) {
  const promptSurface = resolveAiModelPromptSurface('image', input.provider.providerType, input.document.config.model, input.model)
  validateImagePromptVariables(input.document, input.mediaVariables, input.model, promptSurface)
  const prompt = renderZpmtPromptForImageTest(input.document.prompt, input.variableValues, input.mediaVariables)
  if (!prompt.trim()) throw new PromptTestError('IMAGE_PROMPT_REQUIRED', '图片提示词不能为空')
  const negativePrompt = promptSurface.kind === 'image-prompt' && promptSurface.negativePrompt
    ? renderZpmtPromptForImageTest(input.document.negativePrompt, input.variableValues, input.mediaVariables)
    : ''
  const styleText = renderZpmtPromptForImageTest(getImageStyleText(input.document.style), input.variableValues, input.mediaVariables)
  const finalPrompt = [prompt.trim(), styleText.trim() ? `Style: ${styleText.trim()}` : ''].filter(Boolean).join('\n\n')
  const body = buildProviderImageRequestBody(input.document, finalPrompt, negativePrompt, promptSurface)
  const referenceImages = collectImagePromptReferenceImages(input.document, input.mediaVariables, promptSurface)
  const endpoint = `${input.provider.baseUrl.replace(/\/+$/, '')}/${referenceImages.length ? 'images/edits' : 'images/generations'}`
  const requestInit = referenceImages.length
    ? buildProviderImageEditRequestInit(input.provider, body, referenceImages)
    : {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${input.provider.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }

  const response = await fetch(endpoint, requestInit)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new PromptTestError('MODEL_REQUEST_FAILED', readRemoteError(data) || `图片模型请求失败 (${response.status})`)
  }

  const images = normalizeImageGenerationResults(data, input.document.config.responseConfig)
  if (!images.length) throw new PromptTestError('IMAGE_RESULT_EMPTY', '图片模型没有返回可展示的图片')

  return {
    images,
    requestPreview: referenceImages.length
      ? { ...body, referenceImages: referenceImages.map((file) => ({ filename: file.filename, mimeType: file.mimeType, size: file.size })) }
      : body,
    usage: readRecord(data).usage || null,
  }
}

function buildProviderImageRequestBody(
  document: PromptTestDocument,
  prompt: string,
  negativePrompt: string,
  promptSurface: ReturnType<typeof resolveAiModelPromptSurface>,
) {
  const config = document.config.responseConfig as Partial<ZpmtResponseConfig>
  const body: Record<string, unknown> = {
    model: document.config.model,
    prompt,
  }

  if (promptSurface.kind === 'image-prompt' && promptSurface.negativePrompt && negativePrompt.trim()) {
    body.negative_prompt = negativePrompt.trim()
  }
  if (config.imageSize && config.imageSize !== 'adaptive') body.size = config.imageSize
  if (Number.isFinite(config.imageCount)) body.n = Math.max(1, Math.min(10, Math.round(Number(config.imageCount))))
  if (config.imageQuality) body.quality = config.imageQuality
  if (config.imageOutputFormat) body.output_format = config.imageOutputFormat
  if (Number.isFinite(config.imageOutputCompression)) body.output_compression = config.imageOutputCompression
  if (config.imageResponseFormat) body.response_format = config.imageResponseFormat
  if (config.imageBackground) body.background = config.imageBackground
  if (config.imageModeration) body.moderation = config.imageModeration
  if (typeof config.watermark === 'boolean') body.watermark = config.watermark
  if (config.imageStyle) body.style = config.imageStyle

  return body
}

function buildProviderImageEditRequestInit(provider: ProjectAiProviderSummary, body: Record<string, unknown>, referenceImages: PromptTestMediaFile[]): RequestInit {
  const formData = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') continue
    formData.append(key, typeof value === 'string' ? value : String(value))
  }
  for (const file of referenceImages) {
    formData.append('image', dataUrlToBlob(file.dataUrl, file.mimeType), file.filename)
  }
  return {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: formData,
  }
}

function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const base64 = dataUrl.split(',')[1] || ''
  return new Blob([Buffer.from(base64, 'base64')], { type: mimeType || 'application/octet-stream' })
}

function normalizeImageGenerationResults(value: unknown, config: Record<string, unknown>) {
  const outputFormat = readString(config.imageOutputFormat) || 'png'
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png'
  const data = readArray(readRecord(value).data)
  return data.flatMap((item): Array<{ src: string; revisedPrompt?: string }> => {
    const record = readRecord(item)
    const url = readString(record.url)
    const b64 = readString(record.b64_json)
    const revisedPrompt = readText(record.revised_prompt)
    const src = url || (b64 ? `data:${mimeType};base64,${b64}` : '')
    return src ? [{ src, ...(revisedPrompt ? { revisedPrompt } : {}) }] : []
  })
}

async function runAgentCompletion(input: {
  userId: string
  provider: ProjectAiProviderSummary
  document: PromptTestDocument
  messages: ChatMessage[]
  toolSchemas: AiToolFunctionSchema[]
  maxToolRounds: number
  context: { projectId: string; path: string }
  onEvent?: PromptTestStreamHandler
}) {
  const messages = [...input.messages]
  let toolRounds = 0
  let toolCallCount = 0
  let finalThinking = ''

  while (true) {
    const message = input.onEvent
      ? await requestChatCompletionStream(input.provider, input.document, messages, input.toolSchemas, input.onEvent)
      : await requestChatCompletion(input.provider, input.document, messages, input.toolSchemas)
    const toolCalls = normalizeToolCalls(message.tool_calls)
    const output = readAssistantContent(message.content)
    const thinking = readAssistantThinking(message)
    finalThinking += thinking

    if (!toolCalls.length || !input.toolSchemas.length) {
      return { output, thinking: finalThinking, toolRounds, toolCallCount }
    }

    if (toolRounds >= input.maxToolRounds) {
      throw new PromptTestError('TOOL_ROUNDS_EXCEEDED', `工具调用超过最大循环次数：${input.maxToolRounds}`)
    }

    messages.push({
      role: 'assistant',
      content: output || null,
      tool_calls: toolCalls,
    })

    for (const toolCall of toolCalls) {
      toolCallCount += 1
      input.onEvent?.({ type: 'tool', status: 'start', toolName: toolCall.function.name })
      const result = await runBoundTool(input.userId, input.document.tools, toolCall, input.context)
      input.onEvent?.({ type: 'tool', status: 'done', toolName: toolCall.function.name, message: isRecord(result) ? readString(result.message) : '' })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result).slice(0, 60000),
      })
    }
    toolRounds += 1
  }
}

function createPromptTestStreamResponse(input: {
  startedAt: number
  userId: string
  provider: ProjectAiProviderSummary
  document: PromptTestDocument
  messages: ChatMessage[]
  toolSchemas: AiToolFunctionSchema[]
  maxToolRounds: number
  context: { projectId: string; path: string }
}) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PromptTestStreamEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
      }

      try {
        send({ type: 'start', outputType: 'text' })
        const result = await runAgentCompletion({
          userId: input.userId,
          provider: input.provider,
          document: input.document,
          messages: input.messages,
          toolSchemas: input.toolSchemas,
          maxToolRounds: input.maxToolRounds,
          context: input.context,
          onEvent: send,
        })
        send({
          type: 'done',
          outputType: 'text',
          output: result.output,
          thinking: result.thinking || '',
          durationMs: Date.now() - input.startedAt,
          toolRounds: result.toolRounds,
          toolCallCount: result.toolCallCount,
        })
      } catch (error) {
        const normalized = normalizePromptTestError(error)
        send({ type: 'error', code: normalized.code, message: normalized.message, durationMs: Date.now() - input.startedAt })
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
    },
  })
}

function createPromptTestErrorStreamResponse(error: unknown, startedAt: number) {
  const normalized = normalizePromptTestError(error)
  const body = `event: error\ndata: ${JSON.stringify({ type: 'error', code: normalized.code, message: normalized.message, durationMs: Date.now() - startedAt })}\n\n`
  return new NextResponse(body, {
    status: 200,
    headers: {
      'cache-control': 'no-cache, no-transform',
      'content-type': 'text/event-stream; charset=utf-8',
    },
  })
}

async function requestChatCompletion(
  provider: ProjectAiProviderSummary,
  document: PromptTestDocument,
  messages: ChatMessage[],
  toolSchemas: AiToolFunctionSchema[],
) {
  const chatBody = buildProviderChatRequestBody(provider, document, messages, toolSchemas)
  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${provider.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(chatBody),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new PromptTestError('MODEL_REQUEST_FAILED', readRemoteError(data) || `模型请求失败 (${response.status})`)
  }

  const choice = readArray(readRecord(data).choices)[0]
  const message = readRecord(readRecord(choice).message)
  return {
    content: message.content,
    reasoning_content: message.reasoning_content || message.reasoning || message.thinking,
    tool_calls: message.tool_calls,
  }
}

async function requestChatCompletionStream(
  provider: ProjectAiProviderSummary,
  document: PromptTestDocument,
  messages: ChatMessage[],
  toolSchemas: AiToolFunctionSchema[],
  onEvent: PromptTestStreamHandler,
) {
  const chatBody = { ...buildProviderChatRequestBody(provider, document, messages, toolSchemas), stream: true }
  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${provider.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(chatBody),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new PromptTestError('MODEL_REQUEST_FAILED', readRemoteError(data) || `模型请求失败 (${response.status})`)
  }
  if (!response.body) throw new PromptTestError('MODEL_STREAM_UNAVAILABLE', '模型没有返回流式内容')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const toolCalls = new Map<number, ChatToolCall>()
  let buffer = ''
  let content = ''
  let thinking = ''

  function applyDelta(delta: Record<string, unknown>) {
    const contentDelta = readText(delta.content)
    if (contentDelta) {
      content += contentDelta
      onEvent({ type: 'content', delta: contentDelta })
    }
    const thinkingDelta = readText(delta.reasoning_content || delta.reasoning || delta.thinking)
    if (thinkingDelta) {
      thinking += thinkingDelta
      onEvent({ type: 'thinking', delta: thinkingDelta })
    }

    for (const item of readArray(delta.tool_calls)) {
      const record = readRecord(item)
      const index = Number.isFinite(record.index) ? Number(record.index) : toolCalls.size
      const existing = toolCalls.get(index) || { id: '', type: 'function' as const, function: { name: '', arguments: '' } }
      const fn = readRecord(record.function)
      toolCalls.set(index, {
        id: readString(record.id) || existing.id || `tool_call_${index}`,
        type: 'function',
        function: {
          name: existing.function.name + readString(fn.name),
          arguments: existing.function.arguments + readText(fn.arguments),
        },
      })
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split(/\n\n/)
    buffer = chunks.pop() || ''
    for (const chunk of chunks) {
      const dataLines = chunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())
      const data = dataLines.join('\n')
      if (!data || data === '[DONE]') continue
      const parsed = JSON.parse(data)
      const choice = readArray(readRecord(parsed).choices)[0]
      const delta = readRecord(readRecord(choice).delta)
      applyDelta(delta)
    }
  }

  return {
    content,
    reasoning_content: thinking,
    tool_calls: Array.from(toolCalls.values()).filter((toolCall) => toolCall.function.name),
  }
}

function buildProviderChatRequestBody(
  provider: ProjectAiProviderSummary,
  document: PromptTestDocument,
  messages: ChatMessage[],
  toolSchemas: AiToolFunctionSchema[],
) {
  return {
    model: document.config.model,
    messages: messages.map((message) => ({
      ...message,
      content: Array.isArray(message.content)
        ? message.content.map((part) => adaptChatContentPartForProvider(provider, part))
        : message.content,
    })),
    ...createChatResponseConfig(document.config.responseConfig),
    ...(toolSchemas.length ? { tools: toolSchemas, tool_choice: 'auto' } : {}),
  }
}

function adaptChatContentPartForProvider(_provider: ProjectAiProviderSummary, part: ChatContentPart): ChatContentPart {
  return part
}

async function runBoundTool(
  userId: string,
  tools: PromptTestToolBinding[],
  toolCall: ChatToolCall,
  context: { projectId: string; path: string },
) {
  const definition = getAiToolDefinitionByFunctionName(toolCall.function.name)
  if (!definition) return { ok: false, message: `工具不存在：${toolCall.function.name}` }

  const binding = tools.find((tool) => (tool.toolId || tool.id) === definition.id || getAiToolFunctionName(tool.toolId || tool.id) === toolCall.function.name)
  if (!binding) return { ok: false, message: `当前 Agent 未绑定工具：${toolCall.function.name}` }

  const args = readJsonObject(toolCall.function.arguments)
  try {
    const result = await runAiTool(userId, {
      toolId: definition.id,
      input: { ...args, ...binding.config },
      context,
    })
    return { ok: true, result }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '工具执行失败' }
  }
}

function buildBoundToolSchemas(tools: PromptTestToolBinding[]) {
  const seen = new Set<string>()
  return tools.flatMap((tool) => {
    const toolId = tool.toolId || tool.id
    const definition = getAiToolDefinition(toolId)
    if (!definition || seen.has(definition.id)) return []
    const schema = createAiToolFunctionSchema(definition.id, 'zh')
    if (!schema) return []
    seen.add(definition.id)
    return [schema]
  })
}

function buildChatMessages(
  document: PromptTestDocument,
  variableValues: Record<string, string>,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
): ChatMessage[] {
  const sourceMessages = document.messages.length
    ? document.messages
    : [
        ...(document.system.trim() ? [{ role: 'system' as const, content: document.system }] : []),
        { role: 'user' as const, content: document.user },
      ]
  return sourceMessages.flatMap((message): ChatMessage[] => {
    if (message.role === 'system') return [{ role: 'system', content: renderZpmtPromptForTest(message.content, variableValues) }]
    return [{ role: 'user', content: renderZpmtPromptForTestParts(message.content, variableValues, mediaVariables) }]
  })
}

function readPromptTestDocument(value: unknown): PromptTestDocument {
  if (!isRecord(value)) throw new PromptTestError('DOCUMENT_INVALID', '测试文档无效')
  const config = isRecord(value.config) ? value.config : {}
  const outputType = readString(config.outputType) || 'text'
  const kind = normalizePromptKind(readString(value.kind), outputType, value)
  return {
    kind,
    config: {
      outputType: kind === 'image' ? 'image' : 'text',
      providerFile: readString(config.providerFile),
      providerId: readString(config.providerId),
      model: readString(config.model),
      responseConfig: isRecord(config.responseConfig) ? config.responseConfig : {},
    },
    messages: readMessages(value.messages),
    system: readText(value.system),
    user: readText(value.user),
    prompt: readText(value.prompt) || (outputType === 'image' ? readText(value.user) : ''),
    negativePrompt: readText(value.negativePrompt),
    style: readImageStyle(value.style),
    tools: readArray(value.tools).flatMap(readToolBinding),
  }
}

function normalizePromptKind(value: string, outputType: string, source: Record<string, unknown>): PromptDocumentKind {
  if (value === 'chat' || value === 'agent' || value === 'image') return value
  if (outputType === 'image') return 'image'
  if (readString(source.system)) return 'agent'
  return 'chat'
}

function readMessages(value: unknown): Array<{ role: 'system' | 'user'; content: string }> {
  return readArray(value).flatMap((item): Array<{ role: 'system' | 'user'; content: string }> => {
    if (!isRecord(item)) return []
    const role = item.role === 'system' ? 'system' : item.role === 'user' ? 'user' : null
    if (!role) return []
    return [{ role, content: readText(item.content) }]
  })
}

function readImageStyle(value: unknown): PromptTestDocument['style'] {
  if (typeof value === 'string') return { mode: 'free-text', value, extraText: '' }
  if (!isRecord(value)) return { mode: 'free-text', value: '', extraText: '' }
  return {
    mode: readString(value.mode) || 'free-text',
    value: readText(value.value),
    extraText: readText(value.extraText),
  }
}

function getImageStyleText(style: PromptTestDocument['style']) {
  return [style.value, style.extraText].map((item) => item.trim()).filter(Boolean).join('\n')
}

function readToolBinding(value: unknown): PromptTestToolBinding[] {
  if (!isRecord(value)) return []
  const id = readString(value.id)
  const toolId = readString(value.toolId) || id
  if (!id && !toolId) return []
  return [{
    id: id || toolId,
    toolId,
    config: isRecord(value.config) ? value.config : {},
  }]
}

function createChatResponseConfig(config: Record<string, unknown>) {
  const responseConfig = config as Partial<ZpmtResponseConfig>
  const next: Record<string, unknown> = {}
  const temperature = readFiniteNumber(responseConfig.temperature)
  const maxTokens = readFiniteNumber(responseConfig.maxTokens)
  if (Number.isFinite(temperature)) next.temperature = temperature
  if (Number.isFinite(maxTokens)) next.max_tokens = Math.round(maxTokens)
  if (responseConfig.responseFormat === 'json_object') next.response_format = { type: 'json_object' }
  if (typeof responseConfig.reasoningEffort === 'string' && responseConfig.reasoningEffort) next.reasoning_effort = responseConfig.reasoningEffort
  return next
}

function validateTextMediaVariables(
  document: PromptTestDocument,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
  model: AiProviderModel | null,
) {
  const systemText = document.messages.find((message) => message.role === 'system')?.content || document.system
  const userText = document.messages.find((message) => message.role === 'user')?.content || document.user
  const systemMediaToken = findPromptTokenRanges(systemText).find((tokenRange) => getPromptTokenMediaKind(parsePromptToken(tokenRange.token)))
  if (systemMediaToken) throw new PromptTestError('MEDIA_SYSTEM_UNSUPPORTED', '图片/文件变量只能放在用户提示词中')

  const support = readModelReferenceInputSupport(model)
  validateMediaTokenList(findPromptTokenRanges(userText), mediaVariables, support)
}

function validateImagePromptVariables(
  document: PromptTestDocument,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
  model: AiProviderModel | null,
  promptSurface: ReturnType<typeof resolveAiModelPromptSurface>,
) {
  const includeNegativePrompt = promptSurface.kind !== 'image-prompt' || promptSurface.negativePrompt
  const ranges = [
    ...findPromptTokenRanges(document.prompt),
    ...(includeNegativePrompt ? findPromptTokenRanges(document.negativePrompt) : []),
    ...findPromptTokenRanges(getImageStyleText(document.style)),
  ]
  const support = readModelReferenceInputSupport(model)
  validateMediaTokenList(ranges, mediaVariables, { image: support.image === true, file: false })
}

function validateMediaTokenList(
  tokenRanges: Array<{ token: string; start: number; end: number }>,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
  support: ReferenceInputSupport,
) {
  let totalBytes = 0
  const seen = new Set<string>()
  for (const tokenRange of tokenRanges) {
    const parsed = parsePromptToken(tokenRange.token)
    const kind = getPromptTokenMediaKind(parsed)
    if (!parsed || !kind) continue
    const key = getZpmtTestVariableKey(tokenRange.token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (kind === 'image' && support.image !== true) throw new PromptTestError('MODEL_MEDIA_UNSUPPORTED', `当前模型不支持图片变量：${parsed.name}`)
    if (kind === 'file' && support.file !== true) throw new PromptTestError('MODEL_MEDIA_UNSUPPORTED', `当前模型不支持文件变量：${parsed.name}`)

    const params = getPromptTokenParamMap(parsed.params)
    const files = mediaVariables[key] || []
    if (!files.length) throw new PromptTestError('MEDIA_VARIABLE_REQUIRED', `请上传变量「${parsed.name}」需要的${kind === 'image' ? '图片' : '文件'}`)
    const countLimit = kind === 'image' ? readMediaCountLimit(params.count) : 1
    if (files.length > countLimit) throw new PromptTestError('MEDIA_COUNT_EXCEEDED', `变量「${parsed.name}」最多上传 ${countLimit} 个文件`)
    const sizeLimit = parseByteSize(String(params.size || '')) || DEFAULT_MEDIA_FILE_LIMIT
    for (const file of files) {
      if (!isValidDataUrl(file.dataUrl)) throw new PromptTestError('MEDIA_DATA_INVALID', `文件数据无效：${file.filename}`)
      if (kind === 'image' && !file.mimeType.startsWith('image/')) throw new PromptTestError('MEDIA_TYPE_INVALID', `变量「${parsed.name}」需要图片文件`)
      if (file.size > sizeLimit) throw new PromptTestError('MEDIA_FILE_TOO_LARGE', `文件超过变量大小限制：${file.filename}`)
      totalBytes += file.size
    }
  }

  if (totalBytes > MAX_MEDIA_REQUEST_BYTES) throw new PromptTestError('MEDIA_REQUEST_TOO_LARGE', '本次测试上传文件总量超过 50MB')
}

function findProvider(providers: ProjectAiProviderSummary[], providerFile: string, providerId: string) {
  if (providerFile) return providers.find((provider) => provider.filePath === providerFile) || null
  return providers.find((provider) => provider.id === providerId) || null
}

async function resolveProvider(providers: ProjectAiProviderSummary[], providerFile: string, providerId: string) {
  if (!providerFile && isCommonAiProviderRef(providerId)) return getCommonAiProviderForRuntime(providerId)
  return findProvider(providers, providerFile, providerId)
}

function renderZpmtPromptForTest(text: string, values: Record<string, string>) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtTestVariableKey(token)
    if (!key) return token
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    return values[key] ?? params.default ?? ''
  })
}

function renderZpmtPromptForImageTest(
  text: string,
  values: Record<string, string>,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtTestVariableKey(token)
    if (!key) return token
    const mediaKind = getPromptTokenMediaKind(parsed)
    if (parsed && mediaKind) return formatMediaAnchor(parsed.name, mediaVariables[key] || [])
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    return values[key] ?? params.default ?? ''
  })
}

function collectImagePromptReferenceImages(
  document: PromptTestDocument,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
  promptSurface: ReturnType<typeof resolveAiModelPromptSurface>,
) {
  const includeNegativePrompt = promptSurface.kind !== 'image-prompt' || promptSurface.negativePrompt
  const ranges = [
    ...findPromptTokenRanges(document.prompt),
    ...(includeNegativePrompt ? findPromptTokenRanges(document.negativePrompt) : []),
    ...findPromptTokenRanges(getImageStyleText(document.style)),
  ]
  const seen = new Set<string>()
  const files: PromptTestMediaFile[] = []

  for (const tokenRange of ranges) {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed || getPromptTokenMediaKind(parsed) !== 'image') continue
    const key = getZpmtTestVariableKey(tokenRange.token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    files.push(...(mediaVariables[key] || []).map((file, index) => ({ ...file, filename: createMediaAlias(parsed.name, index, file.filename) })))
  }

  return files
}

function renderZpmtPromptForTestParts(
  text: string,
  values: Record<string, string>,
  mediaVariables: Record<string, PromptTestMediaFile[]>,
): string | ChatContentPart[] {
  const parts: ChatContentPart[] = []
  let cursor = 0
  let hasMedia = false

  function appendText(value: string) {
    if (!value) return
    const lastPart = parts[parts.length - 1]
    if (lastPart?.type === 'text') {
      lastPart.text += value
      return
    }
    parts.push({ type: 'text', text: value })
  }

  for (const tokenRange of findPromptTokenRanges(text)) {
    appendText(text.slice(cursor, tokenRange.start))
    const parsed = parsePromptToken(tokenRange.token)
    if (parsed?.tokenType === 'const') {
      appendText(resolveZpmtConstantValue(parsed))
      cursor = tokenRange.end
      continue
    }
    const key = getZpmtTestVariableKey(tokenRange.token)
    const mediaKind = getPromptTokenMediaKind(parsed)
    if (parsed && key && mediaKind) {
      const files = mediaVariables[key] || []
      appendText(formatMediaAnchor(parsed.name, files))
      for (const [index, file] of files.entries()) {
        hasMedia = true
        parts.push(createMediaContentPart(mediaKind, parsed.name, index, file))
      }
    } else if (key) {
      const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
      appendText(values[key] ?? params.default ?? '')
    } else {
      appendText(tokenRange.token)
    }
    cursor = tokenRange.end
  }

  appendText(text.slice(cursor))
  if (!hasMedia) return parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
  return parts
}

function createMediaContentPart(kind: 'image' | 'file', variableName: string, index: number, file: PromptTestMediaFile): ChatContentPart {
  if (kind === 'image') return { type: 'image_url', image_url: { url: file.dataUrl } }
  return { type: 'file', file: { filename: createMediaAlias(variableName, index, file.filename), file_data: file.dataUrl } }
}

function formatMediaAnchor(variableName: string, files: PromptTestMediaFile[]) {
  if (!files.length) return '[未上传]'
  return files.map((file, index) => `[${createMediaAlias(variableName, index, file.filename)}]`).join('\n')
}

function createMediaAlias(variableName: string, index: number, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload'
  return `${variableName}_${index + 1}_${safeName}`
}

function getZpmtTestVariableKey(token: string) {
  const parsed = parsePromptToken(token)
  if (!parsed) return ''
  if (parsed.tokenType === 'const') return ''
  const params = getPromptTokenParamMap(parsed.params)
  return `${parsed.tokenType}:${parsed.name}:${params.source || ''}`
}

function getPromptTokenMediaKind(parsed: ReturnType<typeof parsePromptToken>): 'image' | 'file' | null {
  if (parsed?.tokenType === 'img') return 'image'
  if (parsed?.tokenType === 'file') return 'file'
  return null
}

function findPromptTokenRanges(text: string) {
  return Array.from(text.matchAll(/\{\{[^{}\n]+\}\}/g), (match) => ({
    token: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

function parsePromptToken(token: string) {
  const content = token.replace(/^\{\{|\}\}$/g, '').trim()
  const parts = content.split(';').map((part) => part.trim()).filter(Boolean)
  const [head, ...params] = parts
  const separatorIndex = (head || '').indexOf(':')
  if (separatorIndex <= 0) return null
  const tokenType = (head || '').slice(0, separatorIndex).trim()
  const name = (head || '').slice(separatorIndex + 1).trim()
  if (!/^[a-z]+$/.test(tokenType) || !/^[\p{L}\p{N}_-]{1,64}$/u.test(name)) return null
  return { tokenType, name, params }
}

function getPromptTokenParamMap(params: string[]) {
  const result: Record<string, string> = {}
  for (const param of params) {
    const parsed = parsePromptTokenParam(param)
    if (parsed) result[parsed.key] = parsed.value
  }
  return result
}

function parsePromptTokenParam(param: string) {
  const equalsIndex = param.indexOf('=')
  if (equalsIndex > 0) {
    const key = param.slice(0, equalsIndex).trim()
    if (!key) return null
    return { key, value: param.slice(equalsIndex + 1).trim() }
  }
  const prefixMatch = /^(length|count|size)(.+)$/.exec(param)
  if (!prefixMatch) return null
  return { key: prefixMatch[1], value: prefixMatch[2].trim() }
}

function resolveZpmtConstantValue(parsed: { name: string; params: string[] }) {
  const params = getPromptTokenParamMap(parsed.params)
  const kind = params.kind || parsed.name
  const now = new Date()
  if (kind === 'today') return now.toLocaleDateString('zh-CN')
  if (kind === 'time') return now.toLocaleTimeString('zh-CN', { hour12: false })
  if (kind === 'weekday') return now.toLocaleDateString('zh-CN', { weekday: 'long' })
  if (kind === 'iso') return now.toISOString()
  if (kind === 'timestamp') return String(now.getTime())
  if (kind === 'uuid') return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)
  if (kind === 'shortId') return Math.random().toString(36).slice(2, 10)
  return now.toLocaleString('zh-CN', { hour12: false })
}

function readVariableValues(value: unknown) {
  const source = isRecord(value) ? value : {}
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, readText(item)]),
  )
}

function readMediaVariables(value: unknown): Record<string, PromptTestMediaFile[]> {
  const source = isRecord(value) ? value : {}
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, readArray(item).flatMap(readMediaFile)]),
  )
}

function readMediaFile(value: unknown): PromptTestMediaFile[] {
  if (!isRecord(value)) return []
  const filename = readString(value.filename) || 'upload'
  const mimeType = readString(value.mimeType) || 'application/octet-stream'
  const size = readFiniteNumber(value.size)
  const dataUrl = readString(value.dataUrl)
  if (!dataUrl || !Number.isFinite(size) || size < 0) return []
  return [{ filename, mimeType, size, dataUrl }]
}

function readModelReferenceInputSupport(model: AiProviderModel | null): ReferenceInputSupport {
  const schema = model?.parameterSchema
  if (!isRecord(schema)) return {}
  const referenceInput = isRecord(schema.referenceInput) ? schema.referenceInput : {}
  return {
    image: referenceInput.image === true,
    file: referenceInput.file === true,
  }
}

function readMediaCountLimit(value: unknown) {
  const match = String(value || '').match(/\d+/)
  const parsed = match ? Number(match[0]) : 1
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, Math.round(parsed))) : 1
}

function parseByteSize(value: string) {
  const match = /^\s*(?:[<>=~\s]*)?(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(value)
  if (!match) return 0
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const unit = (match[2] || 'b').toLowerCase()
  if (unit === 'gb') return Math.round(amount * 1024 * 1024 * 1024)
  if (unit === 'mb') return Math.round(amount * 1024 * 1024)
  if (unit === 'kb') return Math.round(amount * 1024)
  return Math.round(amount)
}

function isValidDataUrl(value: string) {
  return /^data:[^;,]+(?:;[^,]+)*;base64,[a-zA-Z0-9+/=\s]+$/.test(value)
}

function normalizeToolCalls(value: unknown): ChatToolCall[] {
  return readArray(value).flatMap((item, index): ChatToolCall[] => {
    const record = readRecord(item)
    const fn = readRecord(record.function)
    const name = readString(fn.name)
    if (!name) return []
    return [{
      id: readString(record.id) || `tool_call_${index}`,
      type: 'function',
      function: {
        name,
        arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(isRecord(fn.arguments) ? fn.arguments : {}),
      },
    }]
  })
}

function readAssistantContent(value: unknown) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!isRecord(item)) return ''
    return readText(item.text || item.content)
  }).filter(Boolean).join('\n')
}

function readAssistantThinking(message: Record<string, unknown>) {
  const direct = readText(message.reasoning_content || message.reasoning || message.thinking)
  if (direct) return direct
  const content = message.content
  if (!Array.isArray(content)) return ''
  return content.map((item) => {
    if (!isRecord(item)) return ''
    return readText(item.reasoning || item.thinking || item.reasoning_content)
  }).filter(Boolean).join('\n')
}

function readJsonObject(value: unknown) {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readRemoteError(value: unknown) {
  const record = readRecord(value)
  const error = readRecord(record.error)
  return readString(error.message || error.code) || readString(record.message || record.error) || (Object.keys(record).length ? JSON.stringify(record).slice(0, 1000) : '')
}

function normalizePromptTestError(error: unknown) {
  if (error instanceof PromptTestError) return { code: error.code, message: error.message }
  if (isProjectStoreError(error)) return { code: error.code, message: error.message }
  return { code: 'INTERNAL_ERROR', message: apiErrorMessage(error, '提示词测试运行失败') }
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback
  if (!Number.isFinite(numberValue)) return fallback
  return Math.min(max, Math.max(min, Math.round(numberValue)))
}

function readFiniteNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(numberValue) ? numberValue : Number.NaN
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
}

function readText(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

class PromptTestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'PromptTestError'
  }
}
