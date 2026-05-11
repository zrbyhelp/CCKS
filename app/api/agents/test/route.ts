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
import type { AiProviderModel, ReferenceInputSupport, ZpmtResponseConfig } from '@/lib/ai-presets'

export const runtime = 'nodejs'

type AgentTestToolBinding = {
  id: string
  toolId: string
  config: Record<string, unknown>
}

type AgentTestDocument = {
  config: {
    outputType: string
    providerFile: string
    providerId: string
    model: string
    responseConfig: Record<string, unknown>
  }
  system: string
  user: string
  tools: AgentTestToolBinding[]
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

const MAX_TOOL_ROUNDS_LIMIT = 20
const DEFAULT_MEDIA_FILE_LIMIT = 10 * 1024 * 1024
const MAX_MEDIA_REQUEST_BYTES = 50 * 1024 * 1024

type AgentTestMediaFile = {
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })

  const startedAt = Date.now()
  const body = await request.json().catch(() => null)

  try {
    const context = isRecord(body?.context) ? body.context : {}
    const project = await getProjectWorkingDirectory(user.id, context.projectId)
    const catalog = await readProjectConfigCatalog(project.localPath)
    const document = readAgentTestDocument(body?.document)
    const provider = await resolveProvider(catalog.providers, document.config.providerFile, document.config.providerId)
    if (!provider) throw new AgentTestError('PROVIDER_NOT_FOUND', '未找到当前 .zpmt 绑定的供应商')
    if (!provider.apiKey) throw new AgentTestError('PROVIDER_API_KEY_MISSING', '当前供应商未配置 API Key')
    if (!document.config.model) throw new AgentTestError('MODEL_REQUIRED', '请先选择模型')
    if (document.config.outputType !== 'text') throw new AgentTestError('OUTPUT_TYPE_UNSUPPORTED', 'Agent 测试当前仅支持文本模型')

    const model = provider.models.find((item) => item.id === document.config.model) || null
    const maxToolRounds = clampInteger(body?.maxToolRounds, 5, 0, MAX_TOOL_ROUNDS_LIMIT)
    const toolSchemas = maxToolRounds > 0 ? buildBoundToolSchemas(document.tools) : []
    if (toolSchemas.length && model?.toolCalling !== 'supported') {
      throw new AgentTestError('MODEL_TOOLS_UNSUPPORTED', '当前模型不支持工具调用')
    }

    const variableValues = readVariableValues(body?.variables)
    const mediaVariables = readMediaVariables(body?.mediaVariables)
    validateMediaVariables(document, mediaVariables, model)
    const messages: ChatMessage[] = []
    const systemPrompt = renderZpmtPromptForTest(document.system, variableValues)
    const userContent = renderZpmtPromptForTestParts(document.user, variableValues, mediaVariables)
    if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt })
    messages.push({ role: 'user', content: userContent })

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
      ...result,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    if (error instanceof AgentTestError) {
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
      { ok: false, message: apiErrorMessage(error, 'Agent 测试运行失败'), durationMs: Date.now() - startedAt },
      { status: 500 },
    )
  }
}

async function runAgentCompletion(input: {
  userId: string
  provider: ProjectAiProviderSummary
  document: AgentTestDocument
  messages: ChatMessage[]
  toolSchemas: AiToolFunctionSchema[]
  maxToolRounds: number
  context: { projectId: string; path: string }
}) {
  const messages = [...input.messages]
  let toolRounds = 0
  let toolCallCount = 0

  while (true) {
    const message = await requestChatCompletion(input.provider, input.document, messages, input.toolSchemas)
    const toolCalls = normalizeToolCalls(message.tool_calls)
    const output = readAssistantContent(message.content)

    if (!toolCalls.length || !input.toolSchemas.length) {
      return { output, toolRounds, toolCallCount }
    }

    if (toolRounds >= input.maxToolRounds) {
      throw new AgentTestError('TOOL_ROUNDS_EXCEEDED', `工具调用超过最大循环次数：${input.maxToolRounds}`)
    }

    messages.push({
      role: 'assistant',
      content: output || null,
      tool_calls: toolCalls,
    })

    for (const toolCall of toolCalls) {
      toolCallCount += 1
      const result = await runBoundTool(input.userId, input.document.tools, toolCall, input.context)
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

async function requestChatCompletion(
  provider: ProjectAiProviderSummary,
  document: AgentTestDocument,
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
    throw new AgentTestError('MODEL_REQUEST_FAILED', readRemoteError(data) || `模型请求失败 (${response.status})`)
  }

  const choice = readArray(readRecord(data).choices)[0]
  const message = readRecord(readRecord(choice).message)
  return {
    content: message.content,
    tool_calls: message.tool_calls,
  }
}

function buildProviderChatRequestBody(
  provider: ProjectAiProviderSummary,
  document: AgentTestDocument,
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
  tools: AgentTestToolBinding[],
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

function buildBoundToolSchemas(tools: AgentTestToolBinding[]) {
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

function readAgentTestDocument(value: unknown): AgentTestDocument {
  if (!isRecord(value)) throw new AgentTestError('DOCUMENT_INVALID', '测试文档无效')
  const config = isRecord(value.config) ? value.config : {}
  return {
    config: {
      outputType: readString(config.outputType) || 'text',
      providerFile: readString(config.providerFile),
      providerId: readString(config.providerId),
      model: readString(config.model),
      responseConfig: isRecord(config.responseConfig) ? config.responseConfig : {},
    },
    system: readText(value.system),
    user: readText(value.user),
    tools: readArray(value.tools).flatMap(readToolBinding),
  }
}

function readToolBinding(value: unknown): AgentTestToolBinding[] {
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

function renderZpmtPromptForTestParts(
  text: string,
  values: Record<string, string>,
  mediaVariables: Record<string, AgentTestMediaFile[]>,
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

function createMediaContentPart(kind: 'image' | 'file', variableName: string, index: number, file: AgentTestMediaFile): ChatContentPart {
  if (kind === 'image') return { type: 'image_url', image_url: { url: file.dataUrl } }
  return { type: 'file', file: { filename: createMediaAlias(variableName, index, file.filename), file_data: file.dataUrl } }
}

function formatMediaAnchor(variableName: string, files: AgentTestMediaFile[]) {
  if (!files.length) return '[未上传]'
  return files.map((file, index) => `[${createMediaAlias(variableName, index, file.filename)}]`).join('\n')
}

function createMediaAlias(variableName: string, index: number, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload'
  return `${variableName}_${index + 1}_${safeName}`
}

function validateMediaVariables(
  document: AgentTestDocument,
  mediaVariables: Record<string, AgentTestMediaFile[]>,
  model: AiProviderModel | null,
) {
  const systemMediaToken = findPromptTokenRanges(document.system).find((tokenRange) => getPromptTokenMediaKind(parsePromptToken(tokenRange.token)))
  if (systemMediaToken) throw new AgentTestError('MEDIA_SYSTEM_UNSUPPORTED', '图片/文件变量只能放在用户提示词中')

  const support = readModelReferenceInputSupport(model)
  let totalBytes = 0
  const seen = new Set<string>()
  for (const tokenRange of findPromptTokenRanges(document.user)) {
    const parsed = parsePromptToken(tokenRange.token)
    const kind = getPromptTokenMediaKind(parsed)
    if (!parsed || !kind) continue
    const key = getZpmtTestVariableKey(tokenRange.token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (kind === 'image' && support.image !== true) throw new AgentTestError('MODEL_MEDIA_UNSUPPORTED', `当前模型不支持图片变量：${parsed.name}`)
    if (kind === 'file' && support.file !== true) throw new AgentTestError('MODEL_MEDIA_UNSUPPORTED', `当前模型不支持文件变量：${parsed.name}`)

    const params = getPromptTokenParamMap(parsed.params)
    const files = mediaVariables[key] || []
    if (!files.length) throw new AgentTestError('MEDIA_VARIABLE_REQUIRED', `请上传变量「${parsed.name}」需要的${kind === 'image' ? '图片' : '文件'}`)
    const countLimit = kind === 'image' ? readMediaCountLimit(params.count) : 1
    if (files.length > countLimit) throw new AgentTestError('MEDIA_COUNT_EXCEEDED', `变量「${parsed.name}」最多上传 ${countLimit} 个文件`)
    const sizeLimit = parseByteSize(String(params.size || '')) || DEFAULT_MEDIA_FILE_LIMIT
    for (const file of files) {
      if (!isValidDataUrl(file.dataUrl)) throw new AgentTestError('MEDIA_DATA_INVALID', `文件数据无效：${file.filename}`)
      if (kind === 'image' && !file.mimeType.startsWith('image/')) throw new AgentTestError('MEDIA_TYPE_INVALID', `变量「${parsed.name}」需要图片文件`)
      if (file.size > sizeLimit) throw new AgentTestError('MEDIA_FILE_TOO_LARGE', `文件超过变量大小限制：${file.filename}`)
      totalBytes += file.size
    }
  }

  if (totalBytes > MAX_MEDIA_REQUEST_BYTES) throw new AgentTestError('MEDIA_REQUEST_TOO_LARGE', '本次测试上传文件总量超过 50MB')
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
  return Object.fromEntries(params.map(parsePromptTokenParam).filter((param): param is { key: string; value: string } => Boolean(param)).map((param) => [param.key, param.value]))
}

function parsePromptTokenParam(param: string) {
  const equalsIndex = param.indexOf('=')
  if (equalsIndex > 0) return { key: param.slice(0, equalsIndex).trim(), value: param.slice(equalsIndex + 1).trim() }
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
    Object.entries(source).map(([key, item]) => [key, typeof item === 'string' ? item : typeof item === 'number' || typeof item === 'boolean' ? String(item) : '']),
  )
}

function readMediaVariables(value: unknown): Record<string, AgentTestMediaFile[]> {
  const source = isRecord(value) ? value : {}
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, readArray(item).flatMap(readMediaFile)]),
  )
}

function readMediaFile(value: unknown): AgentTestMediaFile[] {
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
  return readString(error.message || error.code) || readString(record.message || record.error)
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

class AgentTestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AgentTestError'
  }
}
