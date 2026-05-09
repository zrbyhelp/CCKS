import crypto from 'crypto'
import type { AiModelCapability, AiProviderModel, AiProviderSummary } from '@/lib/ai-presets'
import {
  createAiProviderModel,
  inferAiModelParameterSchema,
  normalizeAiModelParameterSchema,
  normalizeAiResponseConfig,
  normalizeToolCallingSupport,
  ZPMT_OUTPUT_TYPES,
} from '@/lib/ai-presets'
import { prisma } from '@/lib/prisma'

type AiProviderRecord = {
  id: string
  userId: string
  name: string
  providerType: string
  baseUrl: string
  apiKeyEncrypted: string
  models: unknown
  createdAt: Date
  updatedAt: Date
}

const VALID_CAPABILITIES: AiModelCapability[] = ZPMT_OUTPUT_TYPES
const ENCRYPTION_PREFIX = 'v1'

export async function listAiProviders(userId: string): Promise<AiProviderSummary[]> {
  const providers = await prisma.aiProvider.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  return providers.map(readProvider)
}

export async function createAiProvider(
  userId: string,
  input: { name: unknown; providerType: unknown; baseUrl: unknown; apiKey: unknown; models: unknown },
) {
  const name = normalizeProviderName(input.name)
  const providerType = normalizeProviderType(input.providerType)
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const apiKey = readString(input.apiKey)
  const models = normalizeModels(input.models, providerType)

  if (!name) throw new AiProviderStoreError('PROVIDER_NAME_REQUIRED', '供应商名称不能为空')
  if (!baseUrl) throw new AiProviderStoreError('PROVIDER_BASE_URL_INVALID', '供应商 Base URL 无效')
  if (!apiKey) throw new AiProviderStoreError('PROVIDER_API_KEY_REQUIRED', 'API Key 不能为空')
  if (!models.length) throw new AiProviderStoreError('PROVIDER_MODELS_REQUIRED', '至少需要配置一个模型')

  const record = await prisma.aiProvider.create({
    data: {
      userId,
      name,
      providerType,
      baseUrl,
      apiKeyEncrypted: encryptSecret(apiKey),
      models,
    },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) throw new AiProviderStoreError('PROVIDER_EXISTS', '同名 AI 供应商已存在')
    throw error
  })

  return readProvider(record)
}

export async function updateAiProvider(
  userId: string,
  input: { providerId: unknown; name: unknown; providerType: unknown; baseUrl: unknown; apiKey: unknown; models: unknown },
) {
  const providerId = readString(input.providerId)
  const name = normalizeProviderName(input.name)
  const providerType = normalizeProviderType(input.providerType)
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const apiKey = readString(input.apiKey)
  const models = normalizeModels(input.models, providerType)

  if (!providerId) throw new AiProviderStoreError('PROVIDER_NOT_FOUND', 'AI 供应商不存在')
  if (!name) throw new AiProviderStoreError('PROVIDER_NAME_REQUIRED', '供应商名称不能为空')
  if (!baseUrl) throw new AiProviderStoreError('PROVIDER_BASE_URL_INVALID', '供应商 Base URL 无效')
  if (!models.length) throw new AiProviderStoreError('PROVIDER_MODELS_REQUIRED', '至少需要配置一个模型')

  await requireProvider(userId, providerId)
  const record = await prisma.aiProvider.update({
    where: { id: providerId },
    data: {
      name,
      providerType,
      baseUrl,
      ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}),
      models,
    },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) throw new AiProviderStoreError('PROVIDER_EXISTS', '同名 AI 供应商已存在')
    throw error
  })

  return readProvider(record)
}

export async function deleteAiProvider(userId: string, providerIdInput: unknown) {
  const providerId = readString(providerIdInput)
  if (!providerId) throw new AiProviderStoreError('PROVIDER_NOT_FOUND', 'AI 供应商不存在')

  const provider = await requireProvider(userId, providerId)
  await prisma.aiProvider.delete({ where: { id: provider.id } })

  return {
    id: provider.id,
    name: provider.name,
  }
}

export async function pullAiProviderModels(
  userId: string,
  input: { providerId?: unknown; providerType: unknown; baseUrl: unknown; apiKey?: unknown },
) {
  const providerId = readString(input.providerId)
  let providerType = normalizeProviderType(input.providerType)
  let baseUrl = normalizeBaseUrl(input.baseUrl)
  let apiKey = readString(input.apiKey)

  if (providerId) {
    const provider = await requireProvider(userId, providerId)
    providerType = normalizeProviderType(input.providerType) || provider.providerType
    baseUrl = normalizeBaseUrl(input.baseUrl) || provider.baseUrl
    apiKey = apiKey || decryptSecret(provider.apiKeyEncrypted)
  }

  if (!baseUrl) throw new AiProviderStoreError('PROVIDER_BASE_URL_INVALID', '供应商 Base URL 无效')
  if (!apiKey) throw new AiProviderStoreError('PROVIDER_API_KEY_REQUIRED', 'API Key 不能为空')

  const payload = await fetchModelList(baseUrl, apiKey)
  const ids = extractModelIds(payload)
  if (!ids.length) throw new AiProviderStoreError('PROVIDER_MODELS_EMPTY', '未从供应商返回结果中识别到模型')

  return ids.map((id) => ({
    ...createAiProviderModel(providerType, id),
  }))
}

export function isAiProviderStoreError(error: unknown): error is AiProviderStoreError {
  return error instanceof AiProviderStoreError
}

export class AiProviderStoreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AiProviderStoreError'
  }
}

async function requireProvider(userId: string, providerId: string) {
  const provider = await prisma.aiProvider.findFirst({ where: { id: providerId, userId } })
  if (!provider) throw new AiProviderStoreError('PROVIDER_NOT_FOUND', 'AI 供应商不存在')
  return provider
}

function readProvider(provider: AiProviderRecord): AiProviderSummary {
  return {
    id: provider.id,
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    models: normalizeModels(provider.models, provider.providerType),
    hasApiKey: Boolean(provider.apiKeyEncrypted),
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  }
}

function normalizeProviderName(value: unknown) {
  return readString(value).slice(0, 64)
}

function normalizeProviderType(value: unknown) {
  const normalized = readString(value).toLowerCase()
  return /^[a-z][a-z0-9_-]{0,31}$/.test(normalized) ? normalized : 'custom'
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

function normalizeModels(value: unknown, providerType: string): AiProviderModel[] {
  const source = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const id = readString(raw.id).slice(0, 96)
    if (!id || seen.has(id)) return []
    seen.add(id)
    const capabilities = normalizeCapabilities(raw.capabilities)
    const inferred = createAiProviderModel(providerType, id, capabilities.length ? capabilities : undefined)
    const schema = normalizeAiModelParameterSchema(raw.parameterSchema, inferred.parameterSchema || inferAiModelParameterSchema(providerType, id, inferred.capabilities))
    const toolCalling = normalizeToolCallingSupport(raw.toolCalling, inferred.toolCalling)
    const model: AiProviderModel = { ...inferred, toolCalling, parameterSchema: schema }
    if (isRecord(raw.defaultResponseConfig)) {
      model.defaultResponseConfig = normalizeAiResponseConfig(schema.kind, raw.defaultResponseConfig, providerType, id, model)
    }
    return [model]
  })
}

function normalizeCapabilities(value: unknown): AiModelCapability[] {
  const source = Array.isArray(value) ? value : []
  return VALID_CAPABILITIES.filter((capability) => source.includes(capability))
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
    throw new AiProviderStoreError('PROVIDER_API_KEY_INVALID', '已保存的 API Key 无法解密')
  }

  try {
    const key = readEncryptionKey()
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(rawIv, 'base64url'))
    decipher.setAuthTag(Buffer.from(rawTag, 'base64url'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(rawEncrypted, 'base64url')), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new AiProviderStoreError('PROVIDER_API_KEY_INVALID', '已保存的 API Key 无法解密')
  }
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

    if (!response.ok) {
      throw new AiProviderStoreError('PROVIDER_MODELS_FETCH_FAILED', readProviderErrorMessage(data) || `模型列表拉取失败 (${response.status})`)
    }

    return data
  } catch (error) {
    if (isAiProviderStoreError(error)) throw error
    throw new AiProviderStoreError('PROVIDER_MODELS_FETCH_FAILED', '模型列表拉取失败，请检查 Base URL 和 API Key')
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

function readEncryptionKey() {
  const raw = process.env.AI_PROVIDER_SECRET_KEY || ''
  if (!raw) {
    throw new AiProviderStoreError('AI_PROVIDER_SECRET_KEY_MISSING', '未配置 AI_PROVIDER_SECRET_KEY，无法加密保存 API Key')
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  const decoded = Buffer.from(raw, 'base64')
  if (decoded.length === 32) return decoded
  return crypto.createHash('sha256').update(raw).digest()
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002')
}
