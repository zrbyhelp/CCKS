import crypto from 'crypto'
import {
  createAiProviderModel,
  inferAiModelParameterSchema,
  inferAiModelPromptSurface,
  inferAiProviderTypeFromBaseUrl,
  normalizeAiModelParameterSchema,
  normalizeAiModelPromptSurface,
  normalizeAiResponseConfig,
  normalizeToolCallingSupport,
  type AiModelCapability,
  type AiProviderModel,
} from '@/lib/ai-presets'
import { prisma } from '@/lib/prisma'

const SYSTEM_AI_SETTING_ID = 'global'
const ENCRYPTION_PREFIX = 'v1'
const VALID_CAPABILITIES: AiModelCapability[] = ['text', 'image']

export type SystemAiSettingSummary = {
  providerType: string
  baseUrl: string
  hasApiKey: boolean
  models: AiProviderModel[]
  model: string
  reasoningEffort: string
  maxToolRounds: number
  updatedAt: string | null
}

export type SystemAiRuntimeProvider = {
  providerType: string
  baseUrl: string
  apiKey: string
  models: AiProviderModel[]
  model: string
  reasoningEffort: string
  maxToolRounds: number
}

type SystemAiSettingRecord = {
  providerType: string
  baseUrl: string
  apiKeyEncrypted: string | null
  models: unknown
  model: string
  reasoningEffort: string
  maxToolRounds: number
  updatedAt: Date
}

export async function getSystemAiSetting(): Promise<SystemAiSettingSummary> {
  const systemAiSetting = getSystemAiSettingDelegate()
  const record = await systemAiSetting.findUnique({ where: { id: SYSTEM_AI_SETTING_ID } })
  return readSetting(record)
}

export async function saveSystemAiSetting(input: {
  providerType?: unknown
  baseUrl?: unknown
  apiKey?: unknown
  clearApiKey?: unknown
  models?: unknown
  model?: unknown
  reasoningEffort?: unknown
  maxToolRounds?: unknown
}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const providerType = resolveProviderType(input.providerType, baseUrl)
  const apiKey = readString(input.apiKey)
  const models = normalizeModels(input.models, providerType)
  const model = readString(input.model)
  const selectedModel = model && models.some((item) => item.id === model) ? model : models[0]?.id || ''
  const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort)
  const maxToolRounds = clampInteger(input.maxToolRounds, 5, 0, 20)

  if (!baseUrl) throw new SystemAiSettingError('SYSTEM_AI_BASE_URL_INVALID', '系统 AI 供应商网址无效')
  if (!models.length) throw new SystemAiSettingError('SYSTEM_AI_MODELS_REQUIRED', '请至少配置一个系统 AI 模型')

  const systemAiSetting = getSystemAiSettingDelegate()
  const existing = await systemAiSetting.findUnique({ where: { id: SYSTEM_AI_SETTING_ID } })
  const apiKeyEncrypted = apiKey
    ? encryptSecret(apiKey)
    : input.clearApiKey === true
      ? null
      : existing?.apiKeyEncrypted || null

  const record = await systemAiSetting.upsert({
    where: { id: SYSTEM_AI_SETTING_ID },
    create: {
      id: SYSTEM_AI_SETTING_ID,
      providerType,
      baseUrl,
      apiKeyEncrypted,
      models,
      model: selectedModel,
      reasoningEffort,
      maxToolRounds,
    },
    update: {
      providerType,
      baseUrl,
      apiKeyEncrypted,
      models,
      model: selectedModel,
      reasoningEffort,
      maxToolRounds,
    },
  })

  return readSetting(record)
}

export async function pullSystemAiModels(input: {
  providerType?: unknown
  baseUrl?: unknown
  apiKey?: unknown
}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const providerType = resolveProviderType(input.providerType, baseUrl)
  const apiKey = readString(input.apiKey)
  if (!baseUrl) throw new SystemAiSettingError('SYSTEM_AI_BASE_URL_INVALID', '系统 AI 供应商网址无效')
  if (!apiKey) throw new SystemAiSettingError('SYSTEM_AI_API_KEY_REQUIRED', '系统 AI API Key 不能为空')

  const payload = await fetchModelList(baseUrl, apiKey)
  const ids = extractModelIds(payload)
  if (!ids.length) throw new SystemAiSettingError('SYSTEM_AI_MODELS_EMPTY', '未从供应商返回结果中识别到模型')
  return ids.map((id) => createAiProviderModel(providerType, id))
}

export async function getSystemAiRuntimeProvider(): Promise<SystemAiRuntimeProvider> {
  const systemAiSetting = getSystemAiSettingDelegate()
  const record = await systemAiSetting.findUnique({ where: { id: SYSTEM_AI_SETTING_ID } })
  if (!record) throw new SystemAiSettingError('SYSTEM_AI_NOT_CONFIGURED', '管理员尚未配置系统 LLM AI')
  const setting = readSettingRecord(record)
  if (!setting.baseUrl || !record.apiKeyEncrypted) throw new SystemAiSettingError('SYSTEM_AI_NOT_CONFIGURED', '管理员尚未配置系统 LLM AI')
  if (!setting.model) throw new SystemAiSettingError('SYSTEM_AI_MODEL_REQUIRED', '系统 AI 未选择模型')
  return {
    providerType: setting.providerType,
    baseUrl: setting.baseUrl,
    apiKey: decryptSecret(record.apiKeyEncrypted),
    models: setting.models,
    model: setting.model,
    reasoningEffort: setting.reasoningEffort,
    maxToolRounds: setting.maxToolRounds,
  }
}

export function isSystemAiSettingError(error: unknown): error is SystemAiSettingError {
  return error instanceof SystemAiSettingError
}

export class SystemAiSettingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SystemAiSettingError'
  }
}

function getSystemAiSettingDelegate() {
  const delegate = (prisma as unknown as { systemAiSetting?: { findUnique: Function; upsert: Function } }).systemAiSetting
  if (!delegate) {
    throw new SystemAiSettingError(
      'PRISMA_CLIENT_STALE',
      'Prisma Client 尚未包含系统 AI 设置模型。请执行 npm run db:generate / npm run db:push 后重启服务。',
    )
  }
  return delegate
}

function readSetting(record: SystemAiSettingRecord | null): SystemAiSettingSummary {
  if (!record) {
    return {
      providerType: 'custom',
      baseUrl: '',
      hasApiKey: false,
      models: [],
      model: '',
      reasoningEffort: 'auto',
      maxToolRounds: 5,
      updatedAt: null,
    }
  }
  const normalized = readSettingRecord(record)
  return {
    providerType: normalized.providerType,
    baseUrl: normalized.baseUrl,
    hasApiKey: Boolean(record.apiKeyEncrypted),
    models: normalized.models,
    model: normalized.model,
    reasoningEffort: normalized.reasoningEffort,
    maxToolRounds: normalized.maxToolRounds,
    updatedAt: record.updatedAt.toISOString(),
  }
}

function readSettingRecord(record: SystemAiSettingRecord) {
  const providerType = normalizeProviderType(record.providerType) || 'custom'
  const models = normalizeModels(record.models, providerType)
  const model = readString(record.model)
  return {
    providerType,
    baseUrl: normalizeBaseUrl(record.baseUrl),
    models,
    model: model && models.some((item) => item.id === model) ? model : models[0]?.id || '',
    reasoningEffort: normalizeReasoningEffort(record.reasoningEffort),
    maxToolRounds: clampInteger(record.maxToolRounds, 5, 0, 20),
  }
}

function normalizeModels(value: unknown, providerType: string): AiProviderModel[] {
  const source = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  return source.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = readString(item.id).slice(0, 96)
    if (!id || seen.has(id)) return []
    seen.add(id)
    const capabilities = normalizeCapabilities(item.capabilities)
    const inferred = createAiProviderModel(providerType, id, capabilities.length ? capabilities : undefined)
    const schema = normalizeAiModelParameterSchema(item.parameterSchema, inferred.parameterSchema || inferAiModelParameterSchema(providerType, id, inferred.capabilities))
    const promptSurface = normalizeAiModelPromptSurface(item.promptSurface, inferred.promptSurface || inferAiModelPromptSurface(providerType, id, inferred.capabilities))
    const model: AiProviderModel = {
      ...inferred,
      toolCalling: normalizeToolCallingSupport(item.toolCalling, inferred.toolCalling),
      parameterSchema: schema,
      promptSurface,
    }
    if (isRecord(item.defaultResponseConfig)) {
      model.defaultResponseConfig = normalizeAiResponseConfig(schema.kind, item.defaultResponseConfig, providerType, id, model)
    }
    return [model]
  })
}

function normalizeCapabilities(value: unknown): AiModelCapability[] {
  const source = Array.isArray(value) ? value : []
  return VALID_CAPABILITIES.filter((capability) => source.includes(capability))
}

async function fetchModelList(baseUrl: string, apiKey: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new SystemAiSettingError('SYSTEM_AI_MODELS_FETCH_FAILED', readProviderErrorMessage(data) || `模型列表获取失败 (${response.status})`)
    return data
  } catch (error) {
    if (isSystemAiSettingError(error)) throw error
    throw new SystemAiSettingError('SYSTEM_AI_MODELS_FETCH_FAILED', '模型列表获取失败，请检查供应商网址和 API Key')
  } finally {
    clearTimeout(timeout)
  }
}

function extractModelIds(value: unknown): string[] {
  const candidates = readModelCandidateArray(value)
  const seen = new Set<string>()
  return candidates.flatMap((item) => {
    const id = typeof item === 'string' ? readString(item) : isRecord(item) ? readString(item.id || item.name || item.model) : ''
    if (!id || seen.has(id)) return []
    seen.add(id)
    return [id.slice(0, 96)]
  })
}

function readModelCandidateArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  if (Array.isArray(value.data)) return value.data
  if (Array.isArray(value.models)) return value.models
  if (Array.isArray(value.result)) return value.result
  return []
}

function readProviderErrorMessage(value: unknown) {
  if (!isRecord(value)) return ''
  const error = value.error
  if (typeof error === 'string') return error
  if (isRecord(error)) return readString(error.message || error.code)
  return readString(value.message)
}

function normalizeBaseUrl(value: unknown) {
  const raw = readString(value).replace(/\/+$/, '')
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function resolveProviderType(value: unknown, baseUrl: string) {
  return normalizeProviderType(value) || inferAiProviderTypeFromBaseUrl(baseUrl, 'custom')
}

function normalizeProviderType(value: unknown) {
  const normalized = readString(value).toLowerCase()
  return /^[a-z][a-z0-9_-]{0,31}$/.test(normalized) ? normalized : ''
}

function normalizeReasoningEffort(value: unknown) {
  const normalized = readString(value).toLowerCase()
  return ['auto', 'none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(normalized) ? normalized : 'auto'
}

function encryptSecret(secret: string) {
  const key = readEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENCRYPTION_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

function decryptSecret(encrypted: string) {
  const [version, rawIv, rawTag, rawEncrypted] = encrypted.split(':')
  if (version !== ENCRYPTION_PREFIX || !rawIv || !rawTag || !rawEncrypted) {
    throw new SystemAiSettingError('SYSTEM_AI_API_KEY_INVALID', '已保存的系统 AI API Key 无法解密')
  }
  try {
    const key = readEncryptionKey()
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(rawIv, 'base64url'))
    decipher.setAuthTag(Buffer.from(rawTag, 'base64url'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(rawEncrypted, 'base64url')), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new SystemAiSettingError('SYSTEM_AI_API_KEY_INVALID', '已保存的系统 AI API Key 无法解密')
  }
}

function readEncryptionKey() {
  const raw = process.env.AI_PROVIDER_SECRET_KEY || ''
  if (!raw) throw new SystemAiSettingError('AI_PROVIDER_SECRET_KEY_MISSING', '未配置 AI_PROVIDER_SECRET_KEY，无法加密保存系统 AI API Key')
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  const decoded = Buffer.from(raw, 'base64')
  if (decoded.length === 32) return decoded
  return crypto.createHash('sha256').update(raw).digest()
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback
  if (!Number.isFinite(numberValue)) return fallback
  return Math.min(max, Math.max(min, Math.round(numberValue)))
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
