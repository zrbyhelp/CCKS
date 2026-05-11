import { resolveAiModelPromptSurface, type AiProviderModel, type ReferenceInputSupport, type ZpmtResponseConfig } from '@/lib/ai-presets'
import type { ProjectAiProviderSummary } from '@/lib/project-config-types'
import { findRecipeVariableSnapshot, type ZpmtRecipeVariableMetadata } from '@/lib/recipe-variables'

export type ZpmtPromptKind = 'chat' | 'agent' | 'image'

export type ZpmtToolBinding = {
  id: string
  toolId: string
  config: Record<string, unknown>
}

export type ZpmtDocumentForRuntime = {
  schema: 'ccks.zpmt'
  version: number
  kind: ZpmtPromptKind
  config: {
    outputType: 'text' | 'image'
    providerFile: string
    providerId: string
    providerName: string
    model: string
    responseConfig: Record<string, unknown>
  }
  messages: Array<{ role: 'system' | 'user'; content: string }>
  system: string
  user: string
  prompt: string
  negativePrompt: string
  style: { mode: string; value: string; extraText: string }
  tools: ZpmtToolBinding[]
  metadata: ZpmtRecipeVariableMetadata
}

export type ZpmtMediaFile = {
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}

export type ZpmtVariableDescriptor = {
  key: string
  token: string
  name: string
  tokenType: string
  variableType: string
  mediaKind: 'image' | 'file' | null
  defaultValue: string
  sourceId: string
  required: boolean
  recipe?: {
    candidates: string[]
    defaultValues: string[]
    multiple: boolean
  }
  params: Record<string, string>
}

const DEFAULT_MEDIA_FILE_LIMIT = 10 * 1024 * 1024
const MAX_MEDIA_REQUEST_BYTES = 50 * 1024 * 1024

export function parseZpmtDocumentForRuntime(value: unknown): ZpmtDocumentForRuntime | null {
  if (!isRecord(value)) return null
  const config = isRecord(value.config) ? value.config : {}
  const rawKind = readString(value.kind)
  const rawOutputType = readString(config.outputType)
  const kind = normalizeZpmtKind(rawKind, rawOutputType, value)
  const outputType = kind === 'image' ? 'image' : 'text'
  return {
    schema: 'ccks.zpmt',
    version: Math.max(1, Math.round(readFiniteNumber(value.version, 3))),
    kind,
    config: {
      outputType,
      providerFile: readString(config.providerFile),
      providerId: readString(config.providerId),
      providerName: readString(config.providerName),
      model: readString(config.model),
      responseConfig: isRecord(config.responseConfig) ? config.responseConfig : {},
    },
    messages: readMessages(value.messages),
    system: readZpmtMessageContent(value.messages, 'system') || readText(value.system),
    user: readZpmtMessageContent(value.messages, 'user') || readText(value.user),
    prompt: readText(value.prompt) || (outputType === 'image' ? readText(value.user) : ''),
    negativePrompt: readText(value.negativePrompt),
    style: readImageStyle(value.style),
    tools: readArray(value.tools).flatMap(readToolBinding),
    metadata: readRecipeMetadata(value.metadata),
  }
}

export function parseZpmtContentForRuntime(content: string): ZpmtDocumentForRuntime | null {
  try {
    return parseZpmtDocumentForRuntime(JSON.parse(content))
  } catch {
    return null
  }
}

export function validateZpmtDocumentForRuntime(input: {
  document: ZpmtDocumentForRuntime | null
  provider?: ProjectAiProviderSummary | null
  model?: AiProviderModel | null
  previousDocument?: ZpmtDocumentForRuntime | null
  requirePreviousVariables?: boolean
  strictRecipeMetadata?: boolean
}) {
  const issues: Array<{ level: 'error' | 'warning'; code: string; message: string }> = []
  const document = input.document
  if (!document) {
    issues.push({ level: 'error', code: 'DOCUMENT_PARSE_FAILED', message: '.zpmt 文件不是有效 JSON 或结构无效' })
    return { ok: false, issues }
  }
  if (document.schema !== 'ccks.zpmt') issues.push({ level: 'error', code: 'SCHEMA_INVALID', message: 'schema 必须是 ccks.zpmt' })
  if (!['chat', 'agent', 'image'].includes(document.kind)) issues.push({ level: 'error', code: 'KIND_INVALID', message: 'kind 必须是 chat、agent 或 image' })
  if (!document.config.providerId && !document.config.providerFile) issues.push({ level: 'warning', code: 'PROVIDER_EMPTY', message: '尚未绑定供应商，运行前需要选择供应商' })
  if (!document.config.model) issues.push({ level: 'warning', code: 'MODEL_EMPTY', message: '尚未选择模型，运行前需要选择模型' })
  if (input.provider && document.config.model && !input.model) issues.push({ level: 'error', code: 'MODEL_NOT_FOUND', message: '当前供应商中找不到 .zpmt 绑定的模型' })
  if (document.kind === 'image') {
    if (!document.prompt.trim()) issues.push({ level: 'error', code: 'PROMPT_EMPTY', message: '图片提示词不能为空' })
  } else {
    const userPrompt = document.messages.find((message) => message.role === 'user')?.content || document.user
    if (!userPrompt.trim()) issues.push({ level: 'error', code: 'USER_PROMPT_EMPTY', message: '用户提示词不能为空' })
  }
  const unsupportedTokens = collectInvalidPromptTokens(document)
  issues.push(...unsupportedTokens.map((token) => ({ level: 'error' as const, code: 'TOKEN_INVALID', message: `变量语法无效：${token}` })))
  issues.push(...validateRecipeVariableMetadata(document, input.strictRecipeMetadata === true))
  if (input.requirePreviousVariables && input.previousDocument) {
    issues.push(...validatePreviousVariablesPreserved(input.previousDocument, document))
  }
  if (document.kind !== 'agent' && document.tools.length) issues.push({ level: 'warning', code: 'TOOLS_IGNORED', message: '非 Agent 提示词中的工具配置不会被使用' })
  if (document.kind === 'agent' && document.tools.some((tool) => !tool.toolId && !tool.id)) {
    issues.push({ level: 'error', code: 'TOOL_INVALID', message: '工具配置缺少 toolId' })
  }
  return { ok: !issues.some((issue) => issue.level === 'error'), issues }
}

function validateRecipeVariableMetadata(document: ZpmtDocumentForRuntime, strict: boolean) {
  const issues: Array<{ level: 'error' | 'warning'; code: string; message: string }> = []
  const recipeDescriptors = collectZpmtVariableDescriptors(document).filter((descriptor) => descriptor.tokenType === 'recipe')
  const usedSnapshotKeys = new Set<string>()
  for (const descriptor of recipeDescriptors) {
    const level = strict ? 'error' : 'warning'
    if (!descriptor.sourceId) {
      issues.push({ level, code: 'RECIPE_SOURCE_MISSING', message: `配方变量「${descriptor.name}」缺少 source 参数` })
      continue
    }
    usedSnapshotKeys.add(`${descriptor.name}:${descriptor.sourceId}`)
    if (!findRecipeVariableSnapshot(document.metadata, descriptor.name, descriptor.sourceId)) {
      issues.push({ level, code: 'RECIPE_METADATA_MISSING', message: `配方变量「${descriptor.name}」缺少 metadata 快照，用户运行时可能无法看到候选值` })
    }
  }

  for (const snapshot of document.metadata.recipeVariables) {
    const key = `${snapshot.tokenName}:${snapshot.sourceId}`
    if (!usedSnapshotKeys.has(key)) {
      issues.push({ level: 'warning', code: 'RECIPE_METADATA_UNUSED', message: `metadata 中存在未使用的配方变量快照：${snapshot.tokenName}` })
    }
  }

  return issues
}

function validatePreviousVariablesPreserved(previousDocument: ZpmtDocumentForRuntime, document: ZpmtDocumentForRuntime) {
  const nextKeys = new Set(collectZpmtVariableDescriptors(document).map((descriptor) => descriptor.key))
  return collectZpmtVariableDescriptors(previousDocument)
    .filter((descriptor) => !nextKeys.has(descriptor.key))
    .map((descriptor) => ({
      level: 'error' as const,
      code: 'VARIABLE_REMOVED',
      message: `当前文件已有变量「${descriptor.name}」在候选内容中丢失；如需删除，请在要求中明确说明`,
    }))
}

export function collectZpmtVariableDescriptors(document: ZpmtDocumentForRuntime): ZpmtVariableDescriptor[] {
  const text = collectPromptTexts(document).join('\n')
  const seen = new Set<string>()
  return findPromptTokenRanges(text).flatMap((tokenRange) => {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed || parsed.tokenType === 'const') return []
    const params = getPromptTokenParamMap(parsed.params)
    const key = getZpmtVariableKey(tokenRange.token)
    if (!key || seen.has(key)) return []
    seen.add(key)
    const mediaKind = getPromptTokenMediaKind(parsed)
    const recipeSnapshot = parsed.tokenType === 'recipe' ? findRecipeVariableSnapshot(document.metadata, parsed.name, params.source || '') : null
    const recipeDefaults = parsed.tokenType === 'recipe'
      ? parseListValue(params.default || '').length
        ? parseListValue(params.default || '')
        : recipeSnapshot?.defaultValues || []
      : []
    return [{
      key,
      token: tokenRange.token,
      name: parsed.name,
      tokenType: parsed.tokenType,
      variableType: tokenTypeToVariableType(parsed.tokenType),
      mediaKind,
      defaultValue: parsed.tokenType === 'recipe' ? recipeDefaults.join(', ') : params.default || '',
      sourceId: params.source || '',
      required: true,
      recipe: parsed.tokenType === 'recipe'
        ? {
            candidates: recipeSnapshot?.candidates.zh || [],
            defaultValues: recipeDefaults,
            multiple: recipeSnapshot?.multiple ?? params.multi === 'true',
          }
        : undefined,
      params,
    }]
  })
}

export function normalizeZpmtVariableValues(
  document: ZpmtDocumentForRuntime,
  variablesInput: unknown,
  recipeVariablesInput?: unknown,
) {
  const descriptors = collectZpmtVariableDescriptors(document)
  const rawVariables = isRecord(variablesInput) ? variablesInput : {}
  const rawRecipes = isRecord(recipeVariablesInput) ? recipeVariablesInput : {}
  const values: Record<string, string> = {}

  for (const descriptor of descriptors) {
    if (descriptor.mediaKind) continue
    const source = descriptor.tokenType === 'recipe' ? rawRecipes : rawVariables
    const value = source[descriptor.key] ?? source[descriptor.name] ?? rawVariables[descriptor.key] ?? rawVariables[descriptor.name]
    values[descriptor.key] = normalizeVariableValue(value, descriptor.defaultValue)
  }
  return values
}

export function normalizeZpmtMediaVariables(document: ZpmtDocumentForRuntime, mediaVariablesInput: unknown) {
  const descriptors = collectZpmtVariableDescriptors(document).filter((item) => item.mediaKind)
  const rawMedia = isRecord(mediaVariablesInput) ? mediaVariablesInput : {}
  const values: Record<string, ZpmtMediaFile[]> = {}
  for (const descriptor of descriptors) {
    const input = rawMedia[descriptor.key] ?? rawMedia[descriptor.name]
    values[descriptor.key] = readArray(input).flatMap(readMediaFile)
  }
  return values
}

export function renderZpmtTextPrompt(text: string, values: Record<string, string>) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtVariableKey(token)
    if (!key) return token
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    return values[key] ?? params.default ?? ''
  })
}

export function renderZpmtImagePrompt(text: string, values: Record<string, string>, mediaVariables: Record<string, ZpmtMediaFile[]>) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtVariableKey(token)
    if (!key) return token
    const mediaKind = getPromptTokenMediaKind(parsed)
    if (parsed && mediaKind) return formatMediaAnchor(parsed.name, mediaVariables[key] || [])
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    return values[key] ?? params.default ?? ''
  })
}

export function getZpmtPromptMessages(document: ZpmtDocumentForRuntime) {
  return document.messages.length
    ? document.messages
    : [
        ...(document.system.trim() ? [{ role: 'system' as const, content: document.system }] : []),
        { role: 'user' as const, content: document.user },
      ]
}

export function getZpmtImageStyleText(style: ZpmtDocumentForRuntime['style']) {
  return [style.value, style.extraText].map((item) => item.trim()).filter(Boolean).join('\n')
}

export function validateZpmtMediaVariables(input: {
  document: ZpmtDocumentForRuntime
  mediaVariables: Record<string, ZpmtMediaFile[]>
  model: AiProviderModel | null
  provider: ProjectAiProviderSummary
}) {
  if (input.document.kind === 'image') {
    const promptSurface = resolveAiModelPromptSurface('image', input.provider.providerType, input.document.config.model, input.model)
    const includeNegativePrompt = promptSurface.kind !== 'image-prompt' || promptSurface.negativePrompt
    const ranges = [
      ...findPromptTokenRanges(input.document.prompt),
      ...(includeNegativePrompt ? findPromptTokenRanges(input.document.negativePrompt) : []),
      ...findPromptTokenRanges(getZpmtImageStyleText(input.document.style)),
    ]
    validateMediaTokenList(ranges, input.mediaVariables, { image: readModelReferenceInputSupport(input.model).image === true, file: false })
    return
  }

  const messages = getZpmtPromptMessages(input.document)
  const systemText = messages.find((message) => message.role === 'system')?.content || ''
  const userText = messages.find((message) => message.role === 'user')?.content || ''
  const systemMediaToken = findPromptTokenRanges(systemText).find((tokenRange) => getPromptTokenMediaKind(parsePromptToken(tokenRange.token)))
  if (systemMediaToken) throw new ZpmtDocumentError('MEDIA_SYSTEM_UNSUPPORTED', '图片/文件变量只能放在用户提示词中')
  validateMediaTokenList(findPromptTokenRanges(userText), input.mediaVariables, readModelReferenceInputSupport(input.model))
}

export function getZpmtVariableKey(token: string) {
  const parsed = parsePromptToken(token)
  if (!parsed || parsed.tokenType === 'const') return ''
  const params = getPromptTokenParamMap(parsed.params)
  return `${parsed.tokenType}:${parsed.name}:${params.source || ''}`
}

export function getPromptTokenMediaKind(parsed: ReturnType<typeof parsePromptToken>): 'image' | 'file' | null {
  if (parsed?.tokenType === 'img') return 'image'
  if (parsed?.tokenType === 'file') return 'file'
  return null
}

export function findPromptTokenRanges(text: string) {
  return Array.from(text.matchAll(/\{\{[^{}\n]+\}\}/g), (match) => ({
    token: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

export function parsePromptToken(token: string) {
  if (!token.startsWith('{{') || !token.endsWith('}}')) return null
  const content = token.slice(2, -2).trim()
  const parts = content.split(';').map((part) => part.trim()).filter(Boolean)
  const [head, ...params] = parts
  const separatorIndex = (head || '').indexOf(':')
  if (separatorIndex <= 0) return null
  const tokenType = (head || '').slice(0, separatorIndex).trim()
  const name = (head || '').slice(separatorIndex + 1).trim()
  if (!/^[a-z]+$/.test(tokenType) || !/^[\p{L}\p{N}_-]{1,64}$/u.test(name)) return null
  return { tokenType, name, params }
}

export function getPromptTokenParamMap(params: string[]) {
  const result: Record<string, string> = {}
  for (const param of params) {
    const parsed = parsePromptTokenParam(param)
    if (parsed) result[parsed.key] = parsed.value
  }
  return result
}

export class ZpmtDocumentError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ZpmtDocumentError'
  }
}

function normalizeZpmtKind(value: string, outputType: string, source: Record<string, unknown>): ZpmtPromptKind {
  if (value === 'chat' || value === 'agent' || value === 'image') return value
  if (outputType === 'image') return 'image'
  if (readText(source.system).trim() || readMessages(source.messages).some((message) => message.role === 'system' && message.content.trim())) return 'agent'
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

function readZpmtMessageContent(value: unknown, role: 'system' | 'user') {
  const message = readMessages(value).find((item) => item.role === role)
  return message?.content || ''
}

function readImageStyle(value: unknown): ZpmtDocumentForRuntime['style'] {
  if (typeof value === 'string') return { mode: 'free-text', value, extraText: '' }
  if (!isRecord(value)) return { mode: 'free-text', value: '', extraText: '' }
  return {
    mode: readString(value.mode) || 'free-text',
    value: readText(value.value || value.text),
    extraText: readText(value.extraText),
  }
}

function readToolBinding(value: unknown): ZpmtToolBinding[] {
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

function readRecipeMetadata(value: unknown): ZpmtRecipeVariableMetadata {
  if (!isRecord(value)) return { schemaVersion: 2, recipeVariables: [] }
  return {
    schemaVersion: 2,
    recipeVariables: readArray(value.recipeVariables).flatMap((item) => {
      if (!isRecord(item)) return []
      return [{
        tokenName: readString(item.tokenName) || readString(item.variableName),
        id: readString(item.id),
        sourceId: readString(item.sourceId),
        sourceFilePath: readString(item.sourceFilePath),
        scope: item.scope === 'personal' || item.scope === 'community' ? item.scope : 'system',
        categoryId: readString(item.categoryId) || readString(isRecord(item.category) ? item.category.id : ''),
        categoryName: readLocalizedText(item.categoryName || (isRecord(item.category) ? item.category.name : undefined), ''),
        variableName: readString(item.variableName),
        name: readLocalizedText(item.name, readString(item.variableName)),
        description: readLocalizedText(item.description, ''),
        content: readLocalizedText(item.content, ''),
        candidates: readLocalizedCandidates(item.candidates),
        defaultValues: readStringArray(item.defaultValues),
        multiple: item.multiple === true,
        updatedAt: readString(item.updatedAt),
        changeLog: readChangeLog(item.changeLog),
      }]
    }),
  }
}

function readLocalizedText(value: unknown, fallback: string) {
  if (typeof value === 'string') return { zh: value, en: value }
  if (!isRecord(value)) return { zh: fallback, en: fallback }
  return {
    zh: readString(value.zh) || fallback,
    en: readString(value.en) || readString(value.zh) || fallback,
  }
}

function readLocalizedCandidates(value: unknown) {
  if (Array.isArray(value)) {
    const items = readStringArray(value)
    return { zh: items, en: items }
  }
  if (!isRecord(value)) return { zh: [], en: [] }
  return { zh: readStringArray(value.zh), en: readStringArray(value.en) }
}

function readChangeLog(value: unknown) {
  return readArray(value).flatMap((item) => {
    if (!isRecord(item)) return []
    return [{
      version: readString(item.version),
      date: readString(item.date),
      note: readLocalizedText(item.note, ''),
    }]
  })
}

function collectPromptTexts(document: ZpmtDocumentForRuntime) {
  if (document.kind === 'image') return [document.prompt, document.negativePrompt, getZpmtImageStyleText(document.style)]
  return getZpmtPromptMessages(document).map((message) => message.content)
}

function collectInvalidPromptTokens(document: ZpmtDocumentForRuntime) {
  const invalid: string[] = []
  for (const text of collectPromptTexts(document)) {
    for (const match of text.match(/\{\{[^{}\n]+\}\}/g) || []) {
      if (!parsePromptToken(match)) invalid.push(match)
    }
  }
  return invalid
}

function tokenTypeToVariableType(tokenType: string) {
  if (tokenType === 'str') return 'string'
  if (tokenType === 'num') return 'number'
  if (tokenType === 'arr') return 'array'
  if (tokenType === 'bool') return 'boolean'
  if (tokenType === 'img') return 'image'
  if (tokenType === 'file') return 'file'
  if (tokenType === 'color') return 'color'
  if (tokenType === 'recipe') return 'recipe'
  return 'string'
}

function normalizeVariableValue(value: unknown, defaultValue: string) {
  if (Array.isArray(value)) return JSON.stringify(value.map(readText).filter(Boolean))
  const text = readText(value)
  return text.trim() ? text : defaultValue
}

function validateMediaTokenList(
  tokenRanges: Array<{ token: string; start: number; end: number }>,
  mediaVariables: Record<string, ZpmtMediaFile[]>,
  support: ReferenceInputSupport,
) {
  let totalBytes = 0
  const seen = new Set<string>()
  for (const tokenRange of tokenRanges) {
    const parsed = parsePromptToken(tokenRange.token)
    const kind = getPromptTokenMediaKind(parsed)
    if (!parsed || !kind) continue
    const key = getZpmtVariableKey(tokenRange.token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (kind === 'image' && support.image !== true) throw new ZpmtDocumentError('MODEL_MEDIA_UNSUPPORTED', `当前模型不支持图片变量：${parsed.name}`)
    if (kind === 'file' && support.file !== true) throw new ZpmtDocumentError('MODEL_MEDIA_UNSUPPORTED', `当前模型不支持文件变量：${parsed.name}`)
    const params = getPromptTokenParamMap(parsed.params)
    const files = mediaVariables[key] || []
    if (!files.length) throw new ZpmtDocumentError('MEDIA_VARIABLE_REQUIRED', `请上传变量「${parsed.name}」需要的${kind === 'image' ? '图片' : '文件'}`)
    const countLimit = kind === 'image' ? readMediaCountLimit(params.count) : 1
    if (files.length > countLimit) throw new ZpmtDocumentError('MEDIA_COUNT_EXCEEDED', `变量「${parsed.name}」最多上传 ${countLimit} 个文件`)
    const sizeLimit = parseByteSize(String(params.size || '')) || DEFAULT_MEDIA_FILE_LIMIT
    for (const file of files) {
      if (!isValidDataUrl(file.dataUrl)) throw new ZpmtDocumentError('MEDIA_DATA_INVALID', `文件数据无效：${file.filename}`)
      if (kind === 'image' && !file.mimeType.startsWith('image/')) throw new ZpmtDocumentError('MEDIA_TYPE_INVALID', `变量「${parsed.name}」需要图片文件`)
      if (file.size > sizeLimit) throw new ZpmtDocumentError('MEDIA_FILE_TOO_LARGE', `文件超过变量大小限制：${file.filename}`)
      totalBytes += file.size
    }
  }
  if (totalBytes > MAX_MEDIA_REQUEST_BYTES) throw new ZpmtDocumentError('MEDIA_REQUEST_TOO_LARGE', '本次请求上传文件总量超过 50MB')
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

function readMediaFile(value: unknown): ZpmtMediaFile[] {
  if (!isRecord(value)) return []
  const filename = readString(value.filename) || 'upload'
  const mimeType = readString(value.mimeType) || 'application/octet-stream'
  const size = readFiniteNumber(value.size, Number.NaN)
  const dataUrl = readString(value.dataUrl)
  if (!dataUrl || !Number.isFinite(size) || size < 0) return []
  return [{ filename, mimeType, size, dataUrl }]
}

function formatMediaAnchor(variableName: string, files: ZpmtMediaFile[]) {
  if (!files.length) return '[未上传]'
  return files.map((file, index) => `[${createMediaAlias(variableName, index, file.filename)}]`).join('\n')
}

function createMediaAlias(variableName: string, index: number, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload'
  return `${variableName}_${index + 1}_${safeName}`
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

function parseListValue(value: string) {
  const raw = value.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(readString).filter(Boolean)
  } catch {
    // Fall back to comma-separated values.
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean)
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(readString).filter(Boolean)
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

function readFiniteNumber(value: unknown, fallback = Number.NaN) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback
  return Number.isFinite(numberValue) ? numberValue : fallback
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
