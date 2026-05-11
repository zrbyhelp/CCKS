import crypto from 'crypto'
import type { AiModelCapability, AiProviderModel, AiProviderSummary } from '@/lib/ai-presets'
import {
  createAiProviderModel,
  inferAiModelParameterSchema,
  inferAiModelPromptSurface,
  inferAiProviderTypeFromBaseUrl,
  normalizeAiModelPresetRef,
  normalizeAiModelParameterSchema,
  normalizeAiModelPromptSurface,
  normalizeAiResponseConfig,
  normalizeToolCallingSupport,
  ZPMT_OUTPUT_TYPES,
} from '@/lib/ai-presets'
import { prisma } from '@/lib/prisma'

export const COMMON_AI_PROVIDER_USER_ID = '__ccks_common_ai_providers__'
export const COMMON_AI_PROVIDER_ID_PREFIX = 'common:'

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

type ReadProviderOptions = {
  idPrefix?: string
  hideBaseUrl?: boolean
}

export async function listAiProviders(userId: string): Promise<AiProviderSummary[]> {
  const providers = await prisma.aiProvider.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  return providers.map((provider) => readProvider(provider))
}

export async function listCommonAiProviders(options: { revealBaseUrl?: boolean } = {}): Promise<AiProviderSummary[]> {
  const providers = await prisma.aiProvider.findMany({
    where: { userId: COMMON_AI_PROVIDER_USER_ID },
    orderBy: { updatedAt: 'desc' },
  })

  return providers.map((provider) =>
    readProvider(provider, {
      idPrefix: COMMON_AI_PROVIDER_ID_PREFIX,
      hideBaseUrl: options.revealBaseUrl !== true,
    }),
  )
}

export async function createAiProvider(
  userId: string,
  input: { name: unknown; providerType?: unknown; baseUrl: unknown; apiKey: unknown; models: unknown },
) {
  const name = normalizeProviderName(input.name)
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const providerType = resolveProviderType(input.providerType, baseUrl)
  const apiKey = readString(input.apiKey)
  const models = normalizeModels(input.models, providerType)

  if (!name) throw new AiProviderStoreError('PROVIDER_NAME_REQUIRED', '供应商名称不能为空')
  if (!baseUrl) throw new AiProviderStoreError('PROVIDER_BASE_URL_INVALID', '供应商网址无效')
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

export async function createCommonAiProvider(input: { name: unknown; providerType?: unknown; baseUrl: unknown; apiKey: unknown; models: unknown }) {
  const provider = await createAiProvider(COMMON_AI_PROVIDER_USER_ID, input)
  return {
    ...provider,
    id: toCommonAiProviderRef(provider.id),
  }
}

export async function updateAiProvider(
  userId: string,
  input: { providerId: unknown; name: unknown; providerType?: unknown; baseUrl: unknown; apiKey: unknown; models: unknown },
) {
  const providerId = readString(input.providerId)
  const name = normalizeProviderName(input.name)
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const apiKey = readString(input.apiKey)

  if (!providerId) throw new AiProviderStoreError('PROVIDER_NOT_FOUND', 'AI 供应商不存在')
  if (!name) throw new AiProviderStoreError('PROVIDER_NAME_REQUIRED', '供应商名称不能为空')
  if (!baseUrl) throw new AiProviderStoreError('PROVIDER_BASE_URL_INVALID', '供应商网址无效')

  const existingProvider = await requireProvider(userId, providerId)
  const providerType = resolveProviderType(
    input.providerType,
    baseUrl,
    baseUrl === existingProvider.baseUrl ? existingProvider.providerType : 'custom',
  )
  const models = normalizeModels(input.models, providerType)
  if (!models.length) throw new AiProviderStoreError('PROVIDER_MODELS_REQUIRED', '至少需要配置一个模型')

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

export async function updateCommonAiProvider(
  input: { providerId: unknown; name: unknown; providerType?: unknown; baseUrl: unknown; apiKey: unknown; models: unknown },
) {
  const provider = await updateAiProvider(COMMON_AI_PROVIDER_USER_ID, {
    ...input,
    providerId: readCommonAiProviderId(input.providerId),
  })
  return {
    ...provider,
    id: toCommonAiProviderRef(provider.id),
  }
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

export async function deleteCommonAiProvider(providerIdInput: unknown) {
  const provider = await deleteAiProvider(COMMON_AI_PROVIDER_USER_ID, readCommonAiProviderId(providerIdInput))
  return {
    ...provider,
    id: toCommonAiProviderRef(provider.id),
  }
}

export async function pullAiProviderModels(
  userId: string,
  input: { providerId?: unknown; providerType?: unknown; baseUrl: unknown; apiKey?: unknown },
) {
  const providerId = readString(input.providerId)
  let baseUrl = normalizeBaseUrl(input.baseUrl)
  let apiKey = readString(input.apiKey)
  let providerType = resolveProviderType(input.providerType, baseUrl)

  if (providerId) {
    const provider = await requireProvider(userId, providerId)
    baseUrl = normalizeBaseUrl(input.baseUrl) || provider.baseUrl
    providerType = resolveProviderType(input.providerType, baseUrl, baseUrl === provider.baseUrl ? provider.providerType : 'custom')
    apiKey = apiKey || decryptSecret(provider.apiKeyEncrypted)
  }

  if (!baseUrl) throw new AiProviderStoreError('PROVIDER_BASE_URL_INVALID', '供应商网址无效')
  if (!apiKey) throw new AiProviderStoreError('PROVIDER_API_KEY_REQUIRED', 'API Key 不能为空')

  const payload = await fetchModelList(baseUrl, apiKey)
  const ids = extractModelIds(payload)
  if (!ids.length) throw new AiProviderStoreError('PROVIDER_MODELS_EMPTY', '未从供应商返回结果中识别到模型')

  return ids.map((id) => ({
    ...createAiProviderModel(providerType, id),
  }))
}

export async function pullCommonAiProviderModels(input: { providerId?: unknown; providerType?: unknown; baseUrl: unknown; apiKey?: unknown }) {
  return pullAiProviderModels(COMMON_AI_PROVIDER_USER_ID, {
    ...input,
    providerId: readCommonAiProviderId(input.providerId),
  })
}

export async function getCommonAiProviderForRuntime(providerIdInput: unknown) {
  const providerId = readCommonAiProviderId(providerIdInput)
  if (!providerId) return null
  const provider = await prisma.aiProvider.findFirst({ where: { id: providerId, userId: COMMON_AI_PROVIDER_USER_ID } })
  if (!provider) return null

  return {
    ...readProvider(provider, { idPrefix: COMMON_AI_PROVIDER_ID_PREFIX }),
    filePath: '',
    apiKey: decryptSecret(provider.apiKeyEncrypted),
    schemaVersion: 1,
  }
}

export function isCommonAiProviderRef(value: unknown) {
  return readString(value).startsWith(COMMON_AI_PROVIDER_ID_PREFIX)
}

export function toCommonAiProviderRef(providerId: string) {
  return `${COMMON_AI_PROVIDER_ID_PREFIX}${providerId}`
}

export function readCommonAiProviderId(value: unknown) {
  const raw = readString(value)
  return raw.startsWith(COMMON_AI_PROVIDER_ID_PREFIX) ? raw.slice(COMMON_AI_PROVIDER_ID_PREFIX.length) : raw
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

function readProvider(provider: AiProviderRecord, options: ReadProviderOptions = {}): AiProviderSummary {
  return {
    id: options.idPrefix ? `${options.idPrefix}${provider.id}` : provider.id,
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: options.hideBaseUrl ? '' : provider.baseUrl,
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
  return /^[a-z][a-z0-9_-]{0,31}$/.test(normalized) ? normalized : ''
}

function resolveProviderType(value: unknown, baseUrl: string, fallback = 'custom') {
  return normalizeProviderType(value) || inferAiProviderTypeFromBaseUrl(baseUrl, fallback)
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
    const promptSurface = normalizeAiModelPromptSurface(raw.promptSurface, inferred.promptSurface || inferAiModelPromptSurface(providerType, id, inferred.capabilities))
    const toolCalling = normalizeToolCallingSupport(raw.toolCalling, inferred.toolCalling)
    const model: AiProviderModel = { ...inferred, toolCalling, parameterSchema: schema, promptSurface }
    if (isRecord(raw.defaultResponseConfig)) {
      model.defaultResponseConfig = normalizeAiResponseConfig(schema.kind, raw.defaultResponseConfig, providerType, id, model)
    }
    const presetRef = normalizeAiModelPresetRef(raw.presetRef)
    if (presetRef) model.presetRef = presetRef
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
    throw new AiProviderStoreError('PROVIDER_MODELS_FETCH_FAILED', readProviderErrorMessage(data) || `模型列表获取失败 (${response.status})`)
    }

    return data
  } catch (error) {
    if (isAiProviderStoreError(error)) throw error
    throw new AiProviderStoreError('PROVIDER_MODELS_FETCH_FAILED', '模型列表获取失败，请检查供应商网址和 API Key')
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
