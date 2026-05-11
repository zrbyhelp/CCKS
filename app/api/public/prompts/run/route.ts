import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { getCommonAiProviderForRuntime, isCommonAiProviderRef } from '@/lib/ai-provider-store'
import { runAiTool } from '@/lib/ai-tool-runner'
import { readProjectConfigCatalog } from '@/lib/project-config-files'
import type { ProjectAiProviderSummary } from '@/lib/project-config-types'
import { getProjectWorkingDirectory, isProjectStoreError, readProjectFile } from '@/lib/project-store'
import {
  createAiToolFunctionSchema,
  getAiToolDefinition,
  getAiToolDefinitionByFunctionName,
  getAiToolFunctionName,
  type AiToolFunctionSchema,
} from '@/lib/tool-definitions'
import { authenticateUserApiToken } from '@/lib/user-api-token-store'
import { resolveAiModelPromptSurface, type AiProviderModel, type ZpmtResponseConfig } from '@/lib/ai-presets'
import {
  getPromptTokenMediaKind,
  getPromptTokenParamMap,
  getZpmtImageStyleText,
  getZpmtPromptMessages,
  getZpmtVariableKey,
  normalizeZpmtMediaVariables,
  normalizeZpmtVariableValues,
  parsePromptToken,
  parseZpmtContentForRuntime,
  renderZpmtImagePrompt,
  renderZpmtTextPrompt,
  validateZpmtDocumentForRuntime,
  validateZpmtMediaVariables,
  findPromptTokenRanges,
  type ZpmtDocumentForRuntime,
  type ZpmtMediaFile,
  type ZpmtToolBinding,
} from '@/lib/zpmt-document'

export const runtime = 'nodejs'

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
  function: { name: string; arguments: string }
}

const MAX_TOOL_ROUNDS_LIMIT = 20

export async function POST(request: NextRequest) {
  const auth = await authenticateUserApiToken(request.headers.get('authorization'))
  if (!auth) return NextResponse.json({ ok: false, message: 'Token 无效或已撤销' }, { status: 401 })
  const startedAt = Date.now()
  const body = await request.json().catch(() => null)
  try {
    const project = await getProjectWorkingDirectory(auth.userId, body?.projectId)
    const file = await readProjectFile(auth.userId, { projectId: project.id, filePath: body?.path })
    if (!file.path.toLowerCase().endsWith('.zpmt')) throw new PublicPromptRunError('FILE_UNSUPPORTED', '只支持调用 .zpmt 文件')
    const document = parseZpmtContentForRuntime(file.content)
    const catalog = await readProjectConfigCatalog(project.localPath)
    if (!document) throw new PublicPromptRunError('DOCUMENT_INVALID', '.zpmt 文件结构无效')
    const provider = await resolveProvider(catalog.providers, document.config.providerFile, document.config.providerId)
    if (!provider) throw new PublicPromptRunError('PROVIDER_NOT_FOUND', '未找到 .zpmt 绑定的供应商')
    if (!provider.apiKey) throw new PublicPromptRunError('PROVIDER_API_KEY_MISSING', '当前供应商未配置 API Key')
    const model = provider.models.find((item) => item.id === document.config.model) || null
    const validation = validateZpmtDocumentForRuntime({ document, provider, model })
    if (!validation.ok) throw new PublicPromptRunError('DOCUMENT_CHECK_FAILED', validation.issues.map((issue) => issue.message).join('；'))

    const variableValues = normalizeZpmtVariableValues(document, body?.variables, body?.recipeVariables)
    const mediaVariables = normalizeZpmtMediaVariables(document, body?.mediaVariables)

    if (document.kind === 'image' || document.config.outputType === 'image') {
      const result = await runImageGeneration({ provider, document, model, variableValues, mediaVariables })
      return NextResponse.json({ ok: true, outputType: 'image', ...result, durationMs: Date.now() - startedAt })
    }

    const maxToolRounds = clampInteger(body?.options?.maxToolRounds ?? body?.maxToolRounds, 5, 0, MAX_TOOL_ROUNDS_LIMIT)
    const toolSchemas = document.kind === 'agent' && maxToolRounds > 0 ? buildBoundToolSchemas(document.tools) : []
    if (toolSchemas.length && model?.toolCalling !== 'supported') throw new PublicPromptRunError('MODEL_TOOLS_UNSUPPORTED', '当前模型不支持工具调用')
    validateZpmtMediaVariables({ document, mediaVariables, model, provider })
    const messages = buildChatMessages(document, variableValues, mediaVariables)
    const result = await runAgentCompletion({
      userId: auth.userId,
      provider,
      document,
      messages,
      toolSchemas,
      maxToolRounds,
      context: { projectId: project.id, path: file.path },
    })
    return NextResponse.json({ ok: true, outputType: 'text', ...result, durationMs: Date.now() - startedAt })
  } catch (error) {
    const status = error instanceof PublicPromptRunError || isProjectStoreError(error) ? 400 : 500
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof PublicPromptRunError ? error.code : isProjectStoreError(error) ? error.code : 'INTERNAL_ERROR',
        message: error instanceof PublicPromptRunError || isProjectStoreError(error) ? error.message : apiErrorMessage(error, '提示词接口调用失败'),
        durationMs: Date.now() - startedAt,
      },
      { status },
    )
  }
}

async function runImageGeneration(input: {
  provider: ProjectAiProviderSummary
  document: ZpmtDocumentForRuntime
  model: AiProviderModel | null
  variableValues: Record<string, string>
  mediaVariables: Record<string, ZpmtMediaFile[]>
}) {
  const promptSurface = resolveAiModelPromptSurface('image', input.provider.providerType, input.document.config.model, input.model)
  validateZpmtMediaVariables({ document: input.document, mediaVariables: input.mediaVariables, model: input.model, provider: input.provider })
  const prompt = renderZpmtImagePrompt(input.document.prompt, input.variableValues, input.mediaVariables)
  if (!prompt.trim()) throw new PublicPromptRunError('IMAGE_PROMPT_REQUIRED', '图片提示词不能为空')
  const negativePrompt = promptSurface.kind === 'image-prompt' && promptSurface.negativePrompt
    ? renderZpmtImagePrompt(input.document.negativePrompt, input.variableValues, input.mediaVariables)
    : ''
  const styleText = renderZpmtImagePrompt(getZpmtImageStyleText(input.document.style), input.variableValues, input.mediaVariables)
  const finalPrompt = [prompt.trim(), styleText.trim() ? `Style: ${styleText.trim()}` : ''].filter(Boolean).join('\n\n')
  const requestBody = buildProviderImageRequestBody(input.document, finalPrompt, negativePrompt, promptSurface)
  const referenceImages = collectImagePromptReferenceImages(input.document, input.mediaVariables, promptSurface)
  const endpoint = `${input.provider.baseUrl.replace(/\/+$/, '')}/${referenceImages.length ? 'images/edits' : 'images/generations'}`
  const response = await fetch(endpoint, referenceImages.length
    ? buildProviderImageEditRequestInit(input.provider, requestBody, referenceImages)
    : {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${input.provider.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new PublicPromptRunError('MODEL_REQUEST_FAILED', readRemoteError(data) || `图片模型请求失败 (${response.status})`)
  const images = normalizeImageGenerationResults(data, input.document.config.responseConfig)
  if (!images.length) throw new PublicPromptRunError('IMAGE_RESULT_EMPTY', '图片模型没有返回可展示的图片')
  return {
    images,
    requestPreview: referenceImages.length
      ? { ...requestBody, referenceImages: referenceImages.map((file) => ({ filename: file.filename, mimeType: file.mimeType, size: file.size })) }
      : requestBody,
    usage: readRecord(data).usage || null,
  }
}

async function runAgentCompletion(input: {
  userId: string
  provider: ProjectAiProviderSummary
  document: ZpmtDocumentForRuntime
  messages: ChatMessage[]
  toolSchemas: AiToolFunctionSchema[]
  maxToolRounds: number
  context: { projectId: string; path: string }
}) {
  const messages = [...input.messages]
  let toolRounds = 0
  let toolCallCount = 0
  let finalThinking = ''
  while (true) {
    const message = await requestChatCompletion(input.provider, input.document, messages, input.toolSchemas)
    const toolCalls = normalizeToolCalls(message.tool_calls)
    const output = readAssistantContent(message.content)
    finalThinking += readAssistantThinking(message)
    if (!toolCalls.length || !input.toolSchemas.length) return { output, thinking: finalThinking, toolRounds, toolCallCount }
    if (toolRounds >= input.maxToolRounds) throw new PublicPromptRunError('TOOL_ROUNDS_EXCEEDED', `工具调用超过最大循环次数：${input.maxToolRounds}`)
    messages.push({ role: 'assistant', content: output || null, tool_calls: toolCalls })
    for (const toolCall of toolCalls) {
      toolCallCount += 1
      const result = await runBoundTool(input.userId, input.document.tools, toolCall, input.context)
      messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(result).slice(0, 60000) })
    }
    toolRounds += 1
  }
}

async function requestChatCompletion(provider: ProjectAiProviderSummary, document: ZpmtDocumentForRuntime, messages: ChatMessage[], toolSchemas: AiToolFunctionSchema[]) {
  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${provider.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: document.config.model,
      messages,
      ...createChatResponseConfig(document.config.responseConfig),
      ...(toolSchemas.length ? { tools: toolSchemas, tool_choice: 'auto' } : {}),
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new PublicPromptRunError('MODEL_REQUEST_FAILED', readRemoteError(data) || `模型请求失败 (${response.status})`)
  const choice = readArray(readRecord(data).choices)[0]
  const message = readRecord(readRecord(choice).message)
  return {
    content: message.content,
    reasoning_content: message.reasoning_content || message.reasoning || message.thinking,
    tool_calls: message.tool_calls,
  }
}

function buildChatMessages(document: ZpmtDocumentForRuntime, variableValues: Record<string, string>, mediaVariables: Record<string, ZpmtMediaFile[]>): ChatMessage[] {
  return getZpmtPromptMessages(document).flatMap((message): ChatMessage[] => {
    if (message.role === 'system') return [{ role: 'system', content: renderZpmtTextPrompt(message.content, variableValues) }]
    return [{ role: 'user', content: renderZpmtPromptForParts(message.content, variableValues, mediaVariables) }]
  })
}

function renderZpmtPromptForParts(text: string, values: Record<string, string>, mediaVariables: Record<string, ZpmtMediaFile[]>): string | ChatContentPart[] {
  const parts: ChatContentPart[] = []
  let cursor = 0
  let hasMedia = false
  const appendText = (value: string) => {
    if (!value) return
    const lastPart = parts[parts.length - 1]
    if (lastPart?.type === 'text') lastPart.text += value
    else parts.push({ type: 'text', text: value })
  }
  for (const tokenRange of findPromptTokenRanges(text)) {
    appendText(text.slice(cursor, tokenRange.start))
    const parsed = parsePromptToken(tokenRange.token)
    const key = getZpmtVariableKey(tokenRange.token)
    const mediaKind = getPromptTokenMediaKind(parsed)
    if (parsed?.tokenType === 'const') {
      appendText(renderZpmtTextPrompt(tokenRange.token, values))
    } else if (parsed && key && mediaKind) {
      const files = mediaVariables[key] || []
      appendText(files.length ? files.map((file, index) => `[${createMediaAlias(parsed.name, index, file.filename)}]`).join('\n') : '[未上传]')
      for (const [index, file] of files.entries()) {
        hasMedia = true
        parts.push(mediaKind === 'image'
          ? { type: 'image_url', image_url: { url: file.dataUrl } }
          : { type: 'file', file: { filename: createMediaAlias(parsed.name, index, file.filename), file_data: file.dataUrl } })
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

function buildProviderImageRequestBody(document: ZpmtDocumentForRuntime, prompt: string, negativePrompt: string, promptSurface: ReturnType<typeof resolveAiModelPromptSurface>) {
  const config = document.config.responseConfig as Partial<ZpmtResponseConfig>
  const body: Record<string, unknown> = { model: document.config.model, prompt }
  if (promptSurface.kind === 'image-prompt' && promptSurface.negativePrompt && negativePrompt.trim()) body.negative_prompt = negativePrompt.trim()
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

function buildProviderImageEditRequestInit(provider: ProjectAiProviderSummary, body: Record<string, unknown>, referenceImages: ZpmtMediaFile[]): RequestInit {
  const formData = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') continue
    formData.append(key, typeof value === 'string' ? value : String(value))
  }
  for (const file of referenceImages) formData.append('image', dataUrlToBlob(file.dataUrl, file.mimeType), file.filename)
  return { method: 'POST', headers: { accept: 'application/json', authorization: `Bearer ${provider.apiKey}` }, body: formData }
}

function collectImagePromptReferenceImages(document: ZpmtDocumentForRuntime, mediaVariables: Record<string, ZpmtMediaFile[]>, promptSurface: ReturnType<typeof resolveAiModelPromptSurface>) {
  const includeNegativePrompt = promptSurface.kind !== 'image-prompt' || promptSurface.negativePrompt
  const ranges = [
    ...findPromptTokenRanges(document.prompt),
    ...(includeNegativePrompt ? findPromptTokenRanges(document.negativePrompt) : []),
    ...findPromptTokenRanges(getZpmtImageStyleText(document.style)),
  ]
  const seen = new Set<string>()
  const files: ZpmtMediaFile[] = []
  for (const tokenRange of ranges) {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed || getPromptTokenMediaKind(parsed) !== 'image') continue
    const key = getZpmtVariableKey(tokenRange.token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    files.push(...(mediaVariables[key] || []).map((file, index) => ({ ...file, filename: createMediaAlias(parsed.name, index, file.filename) })))
  }
  return files
}

function buildBoundToolSchemas(tools: ZpmtToolBinding[]) {
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

async function runBoundTool(userId: string, tools: ZpmtToolBinding[], toolCall: ChatToolCall, context: { projectId: string; path: string }) {
  const definition = getAiToolDefinitionByFunctionName(toolCall.function.name)
  if (!definition) return { ok: false, message: `工具不存在：${toolCall.function.name}` }
  const binding = tools.find((tool) => (tool.toolId || tool.id) === definition.id || getAiToolFunctionName(tool.toolId || tool.id) === toolCall.function.name)
  if (!binding) return { ok: false, message: `当前 Agent 未绑定工具：${toolCall.function.name}` }
  try {
    const result = await runAiTool(userId, { toolId: definition.id, input: { ...readJsonObject(toolCall.function.arguments), ...binding.config }, context })
    return { ok: true, result }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '工具执行失败' }
  }
}

async function resolveProvider(providers: ProjectAiProviderSummary[], providerFile: string, providerId: string) {
  if (!providerFile && isCommonAiProviderRef(providerId)) return getCommonAiProviderForRuntime(providerId)
  if (providerFile) return providers.find((provider) => provider.filePath === providerFile) || null
  return providers.find((provider) => provider.id === providerId) || null
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

function normalizeImageGenerationResults(value: unknown, config: Record<string, unknown>) {
  const outputFormat = readString(config.imageOutputFormat) || 'png'
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png'
  return readArray(readRecord(value).data).flatMap((item): Array<{ src: string; revisedPrompt?: string }> => {
    const record = readRecord(item)
    const url = readString(record.url)
    const b64 = readString(record.b64_json)
    const revisedPrompt = readString(record.revised_prompt)
    const src = url || (b64 ? `data:${mimeType};base64,${b64}` : '')
    return src ? [{ src, ...(revisedPrompt ? { revisedPrompt } : {}) }] : []
  })
}

function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const base64 = dataUrl.split(',')[1] || ''
  return new Blob([Buffer.from(base64, 'base64')], { type: mimeType || 'application/octet-stream' })
}

function createMediaAlias(variableName: string, index: number, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload'
  return `${variableName}_${index + 1}_${safeName}`
}

function normalizeToolCalls(value: unknown): ChatToolCall[] {
  return readArray(value).flatMap((item, index): ChatToolCall[] => {
    const record = readRecord(item)
    const fn = readRecord(record.function)
    const name = readString(fn.name)
    if (!name) return []
    return [{ id: readString(record.id) || `tool_call_${index}`, type: 'function', function: { name, arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(isRecord(fn.arguments) ? fn.arguments : {}) } }]
  })
}

function readAssistantContent(value: unknown) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!isRecord(item)) return ''
    return readString(item.text || item.content)
  }).filter(Boolean).join('\n')
}

function readAssistantThinking(message: Record<string, unknown>) {
  return readString(message.reasoning_content || message.reasoning || message.thinking)
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
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

class PublicPromptRunError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'PublicPromptRunError'
  }
}
