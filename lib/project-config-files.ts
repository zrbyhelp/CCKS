import path from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import {
  AI_PROVIDER_PRESETS,
  createAiProviderModel,
  inferAiModelParameterSchema,
  inferAiProviderTypeFromBaseUrl,
  normalizeAiModelPresetRef,
  normalizeAiModelParameterSchema,
  normalizeAiResponseConfig,
  normalizeToolCallingSupport,
  type AiModelCapability,
  type AiProviderModel,
  type AiProviderPreset,
} from '@/lib/ai-presets'
import {
  SYSTEM_RECIPE_VARIABLE_CATEGORIES,
  type Locale,
  type LocalizedText,
  type RecipeVariableCategory,
  type RecipeVariableChangeLog,
  type RecipeVariableItem,
  type RecipeVariableScope,
} from '@/lib/recipe-variables'
import {
  isZamfFilePath,
  isZlexFilePath,
  type ProjectAiProviderSummary,
  type ProjectConfigCatalog,
  type ProjectConfigDiagnostic,
} from '@/lib/project-config-types'

const MAX_CONFIG_FILE_BYTES = 1024 * 1024
const VALID_CAPABILITIES: AiModelCapability[] = ['text', 'image']
const DEFAULT_UPDATED_AT = '2026-05-09T00:00:00.000Z'

type ScannedConfigFile = {
  path: string
  absolutePath: string
  kind: 'zlex' | 'zamf'
}

export async function readProjectConfigCatalog(projectRoot: string): Promise<ProjectConfigCatalog> {
  const files = await scanProjectConfigFiles(projectRoot)
  const providers: ProjectAiProviderSummary[] = []
  const recipeCategories: RecipeVariableCategory[] = []
  const diagnostics: ProjectConfigDiagnostic[] = []

  for (const file of files) {
    const result = await readConfigFile(projectRoot, file)
    if (!result.ok) {
      diagnostics.push({ path: file.path, kind: file.kind, message: result.message })
      continue
    }

    if (file.kind === 'zamf') {
      const provider = normalizeZamfProvider(result.value, file.path)
      if (provider) providers.push(provider)
      else diagnostics.push({ path: file.path, kind: file.kind, message: '供应商模型文件结构无效' })
      continue
    }

    if (!isZlexRoot(result.value)) {
      diagnostics.push({ path: file.path, kind: file.kind, message: '词汇变量文件结构无效' })
      continue
    }

    recipeCategories.push(...normalizeZlexCategories(result.value, file.path))
  }

  return {
    providers,
    recipeCategories,
    diagnostics,
  }
}

export function createSystemZlexContent() {
  return `${JSON.stringify(
    {
      schema: 'ccks.zlex',
      version: 1,
      categories: SYSTEM_RECIPE_VARIABLE_CATEGORIES.map((category) => ({
        name: category.name.zh || category.name.en || category.id,
        description: category.description.zh || category.description.en || '',
        variables: category.variables.map((variable) => ({
          variableName: variable.name.zh || variable.name.en || variable.variableName,
          description: variable.description.zh || variable.description.en || '',
          candidates: variable.candidates.zh.length ? variable.candidates.zh : variable.candidates.en,
          multiple: variable.multiple,
        })),
      })),
    },
    null,
    2,
  )}\n`
}

export function createZamfContentFromPreset(preset: AiProviderPreset) {
  return `${JSON.stringify(
    {
      schema: 'ccks.zamf',
      version: 1,
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: '',
      models: preset.models,
    },
    null,
    2,
  )}\n`
}

export function getDefaultZamfFiles() {
  return [
    { fileName: 'OpenAI.zamf', content: createZamfContentFromPreset(AI_PROVIDER_PRESETS[0]) },
    { fileName: 'DeepSeek.zamf', content: createZamfContentFromPreset(AI_PROVIDER_PRESETS[1]) },
    { fileName: '火山引擎.zamf', content: createZamfContentFromPreset(AI_PROVIDER_PRESETS[2]) },
    { fileName: '自定义.zamf', content: createZamfContentFromPreset(AI_PROVIDER_PRESETS[3]) },
  ]
}

async function scanProjectConfigFiles(projectRoot: string) {
  const files: ScannedConfigFile[] = []

  async function visit(relativePath: string) {
    const directory = path.resolve(projectRoot, relativePath)
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '.git') continue
      const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await visit(entryPath)
        continue
      }

      if (entry.isFile() && (isZlexFilePath(entry.name) || isZamfFilePath(entry.name))) {
        files.push({
          path: entryPath,
          absolutePath: path.resolve(projectRoot, entryPath),
          kind: isZlexFilePath(entry.name) ? 'zlex' : 'zamf',
        })
      }
    }
  }

  await visit('')
  return files.sort((left, right) => left.path.localeCompare(right.path, 'zh-Hans-CN'))
}

async function readConfigFile(projectRoot: string, file: ScannedConfigFile): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  const relative = path.relative(projectRoot, file.absolutePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return { ok: false, message: '配置文件路径无效' }

  const stats = await stat(file.absolutePath).catch(() => null)
  if (!stats?.isFile()) return { ok: false, message: '配置文件不存在' }
  if (stats.size > MAX_CONFIG_FILE_BYTES) return { ok: false, message: '配置文件超过 1MB，已跳过' }

  try {
    return { ok: true, value: JSON.parse(await readFile(file.absolutePath, 'utf8')) }
  } catch {
    return { ok: false, message: 'JSON 解析失败' }
  }
}

function normalizeZamfProvider(value: unknown, filePath: string): ProjectAiProviderSummary | null {
  if (!isRecord(value)) return null
  const baseUrl = normalizeBaseUrl(value.baseUrl)
  const providerType = normalizeProviderType(value.providerType || value.id) || inferAiProviderTypeFromBaseUrl(baseUrl, 'custom')
  const name = readString(value.name) || providerType || path.basename(filePath, '.zamf')
  const models = normalizeModels(value.models, providerType)
  if (!name || !providerType || !baseUrl || !models.length) return null

  return {
    id: readString(value.id) || (providerType !== 'custom' ? providerType : normalizeId(path.basename(filePath, '.zamf')) || providerType),
    name,
    providerType,
    baseUrl,
    apiKey: readString(value.apiKey),
    filePath,
    hasApiKey: Boolean(readString(value.apiKey)),
    models,
    schemaVersion: Math.max(1, Math.round(readFiniteNumber(value.version, 1))),
  }
}

function normalizeZlexCategories(value: unknown, filePath: string): RecipeVariableCategory[] {
  if (!isRecord(value)) return []
  const fileScope = normalizeScope(value.scope, inferZlexFileScope(filePath))
  const categories = Array.isArray(value.categories) ? value.categories : []

  return categories.flatMap((category, categoryIndex): RecipeVariableCategory[] => {
    if (!isRecord(category)) return []
    const categoryName = readPlainText(category.name, readString(category.id) || `分类 ${categoryIndex + 1}`)
    const categoryId = normalizeId(category.id) || normalizeId(categoryName) || `category-${categoryIndex + 1}`
    const variables = Array.isArray(category.variables) ? category.variables : []
    const normalizedVariables = variables.flatMap((variable, variableIndex) =>
      normalizeZlexVariable(variable, filePath, categoryId, fileScope, variableIndex),
    )
    if (!normalizedVariables.length) return []

    const createdAt = readString(category.createdAt) || DEFAULT_UPDATED_AT
    const updatedAt = readString(category.updatedAt) || createdAt
    return [
      {
        id: categoryId,
        scope: normalizeScope(category.scope, fileScope),
        icon: normalizeIcon(category.icon),
        name: readLocalizedText(category.name, categoryName || categoryId),
        description: readLocalizedText(category.description, ''),
        tip: readLocalizedText(category.tip, ''),
        createdAt,
        updatedAt,
        changeLog: normalizeChangeLog(category.changeLog),
        variables: normalizedVariables,
      },
    ]
  })
}

function isZlexRoot(value: unknown) {
  if (!isRecord(value)) return false
  const schema = readString(value.schema)
  return (!schema || schema === 'ccks.zlex') && Array.isArray(value.categories)
}

function normalizeZlexVariable(
  value: unknown,
  filePath: string,
  categoryId: string,
  fileScope: RecipeVariableScope,
  variableIndex: number,
): RecipeVariableItem[] {
  if (!isRecord(value)) return []
  const rawVariableName = readString(value.variableName) || readPlainText(value.name, '')
  const id = normalizeId(value.id) || normalizeId(rawVariableName) || `variable-${variableIndex + 1}`
  const variableName = normalizeVariableName(rawVariableName) || normalizeVariableName(id) || `recipeVariable${variableIndex + 1}`
  const description = readLocalizedText(value.description, readPlainText(value.content, ''))
  const name = readLocalizedText(value.name, rawVariableName || variableName)
  const content = readLocalizedText(value.content, description.zh)
  if (!name.zh || !description.zh) return []
  const createdAt = readString(value.createdAt) || DEFAULT_UPDATED_AT
  const updatedAt = readString(value.updatedAt) || createdAt

  return [
    {
      id,
      sourceId: `${filePath}#${categoryId}/${id}`,
      sourceFilePath: filePath,
      scope: normalizeScope(value.scope, fileScope),
      variableName,
      name,
      description,
      content,
      candidates: readPlainCandidates(value.candidates),
      defaultValues: [],
      multiple: value.multiple === true,
      createdAt,
      updatedAt,
      changeLog: normalizeChangeLog(value.changeLog),
    },
  ]
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
    const model: AiProviderModel = {
      ...inferred,
      toolCalling: normalizeToolCallingSupport(item.toolCalling, inferred.toolCalling),
      parameterSchema: schema,
    }
    if (isRecord(item.defaultResponseConfig)) {
      model.defaultResponseConfig = normalizeAiResponseConfig(schema.kind, item.defaultResponseConfig, providerType, id, model)
    }
    const presetRef = normalizeAiModelPresetRef(item.presetRef)
    if (presetRef) model.presetRef = presetRef
    return [model]
  })
}

function normalizeCapabilities(value: unknown): AiModelCapability[] {
  const source = Array.isArray(value) ? value : []
  return VALID_CAPABILITIES.filter((capability) => source.includes(capability))
}

function normalizeProviderType(value: unknown) {
  const normalized = readString(value).toLowerCase()
  return /^[a-z][a-z0-9_-]{0,31}$/.test(normalized) ? normalized : ''
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

function normalizeScope(value: unknown, fallback: RecipeVariableScope = 'system'): RecipeVariableScope {
  return value === 'personal' || value === 'community' || value === 'system' ? value : fallback
}

function inferZlexFileScope(filePath: string): RecipeVariableScope {
  const normalized = filePath.toLowerCase()
  if (normalized.includes('community') || filePath.includes('社区')) return 'community'
  if (normalized.includes('system') || filePath.includes('系统')) return 'system'
  return 'personal'
}

function normalizeId(value: unknown) {
  const normalized = readString(value).replace(/\s+/g, '-').slice(0, 96)
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(normalized) ? normalized : ''
}

function normalizeVariableName(value: unknown) {
  const normalized = readString(value).slice(0, 64)
  return /^[a-z][a-zA-Z0-9_]{0,63}$/.test(normalized) ? normalized : ''
}

function normalizeIcon(value: unknown) {
  const icon = readString(value).toLowerCase()
  return /^[a-z0-9-]{2,32}$/.test(icon) ? icon : 'boxes'
}

function normalizeChangeLog(value: unknown): RecipeVariableChangeLog[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const version = readString(item.version)
    const date = readString(item.date)
    const note = readLocalizedText(item.note, '')
    if (!version && !date && !note.zh && !note.en) return []
    return [{ version, date, note }]
  })
}

function readLocalizedText(value: unknown, fallback: string): LocalizedText {
  if (typeof value === 'string') return { zh: value, en: value }
  if (!isRecord(value)) return { zh: fallback, en: fallback }
  const zh = readString(value.zh)
  const en = readString(value.en)
  return {
    zh: zh || en || fallback,
    en: en || zh || fallback,
  }
}

function readPlainText(value: unknown, fallback: string) {
  if (typeof value === 'string') return value.trim() || fallback
  if (!isRecord(value)) return fallback
  const zh = readString(value.zh)
  const en = readString(value.en)
  return zh || en || fallback
}

function readPlainCandidates(value: unknown): Record<Locale, string[]> {
  if (Array.isArray(value)) {
    const values = readStringArray(value)
    return { zh: values, en: values }
  }
  if (typeof value === 'string') {
    const values = readStringArray(value)
    return { zh: values, en: values }
  }
  return readLocalizedCandidates(value)
}

function readLocalizedCandidates(value: unknown): Record<Locale, string[]> {
  if (!isRecord(value)) return { zh: [], en: [] }
  return {
    zh: readStringArray(value.zh),
    en: readStringArray(value.en),
  }
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(readString).filter(Boolean).map((item) => item.slice(0, 160))
  if (typeof value === 'string') {
    return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).map((item) => item.slice(0, 160))
  }
  return []
}

function readFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
