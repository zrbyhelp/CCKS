import { prisma } from '@/lib/prisma'
import {
  COMMUNITY_RECIPE_VARIABLE_CATEGORIES,
  SYSTEM_RECIPE_VARIABLE_CATEGORIES,
  cloneRecipeVariableCategories,
  findRecipeVariableBySourceId,
  getRecipeVariableStats,
  type Locale,
  type LocalizedText,
  type RecipeVariableCategory,
  type RecipeVariableChangeLog,
  type RecipeVariableItem,
} from '@/lib/recipe-variables'

type PersonalCategoryRecord = {
  id: string
  userId: string
  nameZh: string
  nameEn: string
  icon: string
  descriptionZh: string
  descriptionEn: string
  tipZh: string
  tipEn: string
  changeLog: unknown
  createdAt: Date
  updatedAt: Date
  variables?: PersonalVariableRecord[]
}

type PersonalVariableRecord = {
  id: string
  userId: string
  categoryId: string
  variableName: string
  nameZh: string
  nameEn: string
  contentZh: string
  contentEn: string
  candidates: unknown
  defaultValues: unknown
  multiple: boolean
  changeLog: unknown
  createdAt: Date
  updatedAt: Date
}

type RecipeVariableCatalog = {
  categories: RecipeVariableCategory[]
  stats: ReturnType<typeof getRecipeVariableStats>
}

const TAG_NAME_PATTERN = /^[\p{L}\p{N}_-]{1,64}$/u

export async function listRecipeVariableCatalog(userId: string): Promise<RecipeVariableCatalog> {
  const personal = await prisma.recipeVariableCategory.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      variables: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  const categories = [
    ...cloneRecipeVariableCategories(SYSTEM_RECIPE_VARIABLE_CATEGORIES),
    ...personal.map(readPersonalCategory),
    ...cloneRecipeVariableCategories(COMMUNITY_RECIPE_VARIABLE_CATEGORIES),
  ]

  return {
    categories,
    stats: getRecipeVariableStats(categories),
  }
}

export async function createPersonalRecipeVariableCategory(userId: string, input: { name?: unknown; description?: unknown; tip?: unknown; icon?: unknown }) {
  const name = normalizeLocalizedText(input.name, '未命名分类')
  const description = normalizeLocalizedText(input.description, '')
  const tip = normalizeLocalizedText(input.tip, '')
  const icon = normalizeIcon(input.icon)
  if (!name.zh) throw new RecipeVariableStoreError('CATEGORY_NAME_REQUIRED', '分类名称不能为空')

  const record = await prisma.recipeVariableCategory.create({
    data: {
      userId,
      nameZh: name.zh,
      nameEn: name.en,
      icon,
      descriptionZh: description.zh,
      descriptionEn: description.en,
      tipZh: tip.zh,
      tipEn: tip.en,
      changeLog: createChangeLog('创建个人变量分类', 'Created personal variable category'),
    },
    include: { variables: true },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) throw new RecipeVariableStoreError('CATEGORY_EXISTS', '同名个人分类已存在')
    throw error
  })

  return readPersonalCategory(record)
}

export async function updatePersonalRecipeVariableCategory(
  userId: string,
  input: { categoryId?: unknown; name?: unknown; description?: unknown; tip?: unknown; icon?: unknown },
) {
  const categoryId = readString(input.categoryId)
  if (!categoryId) throw new RecipeVariableStoreError('CATEGORY_NOT_FOUND', '个人分类不存在')
  await requirePersonalCategory(userId, categoryId)

  const name = normalizeLocalizedText(input.name, '未命名分类')
  const description = normalizeLocalizedText(input.description, '')
  const tip = normalizeLocalizedText(input.tip, '')
  if (!name.zh) throw new RecipeVariableStoreError('CATEGORY_NAME_REQUIRED', '分类名称不能为空')

  const record = await prisma.recipeVariableCategory.update({
    where: { id: categoryId },
    data: {
      nameZh: name.zh,
      nameEn: name.en,
      icon: normalizeIcon(input.icon),
      descriptionZh: description.zh,
      descriptionEn: description.en,
      tipZh: tip.zh,
      tipEn: tip.en,
      changeLog: createChangeLog('更新个人变量分类', 'Updated personal variable category'),
    },
    include: { variables: { orderBy: { updatedAt: 'desc' } } },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) throw new RecipeVariableStoreError('CATEGORY_EXISTS', '同名个人分类已存在')
    throw error
  })

  return readPersonalCategory(record)
}

export async function deletePersonalRecipeVariableCategory(userId: string, categoryIdInput: unknown) {
  const categoryId = readString(categoryIdInput)
  if (!categoryId) throw new RecipeVariableStoreError('CATEGORY_NOT_FOUND', '个人分类不存在')
  const category = await requirePersonalCategory(userId, categoryId)
  await prisma.recipeVariableCategory.delete({ where: { id: category.id } })
  return { id: category.id, name: category.nameZh }
}

export async function createPersonalRecipeVariable(userId: string, input: RecipeVariableInput) {
  const categoryId = readString(input.categoryId)
  if (!categoryId) throw new RecipeVariableStoreError('CATEGORY_NOT_FOUND', '请先选择个人分类')
  await requirePersonalCategory(userId, categoryId)
  const normalized = normalizeVariableInput(input)

  const record = await prisma.recipeVariable.create({
    data: {
      userId,
      categoryId,
      ...normalized,
      changeLog: createChangeLog('创建个人变量', 'Created personal variable'),
    },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) throw new RecipeVariableStoreError('VARIABLE_EXISTS', '同名变量名已存在')
    throw error
  })

  return readPersonalVariable(record)
}

export async function updatePersonalRecipeVariable(userId: string, input: RecipeVariableInput & { variableId?: unknown }) {
  const variableId = readString(input.variableId)
  if (!variableId) throw new RecipeVariableStoreError('VARIABLE_NOT_FOUND', '个人变量不存在')
  const current = await requirePersonalVariable(userId, variableId)
  const categoryId = readString(input.categoryId) || current.categoryId
  await requirePersonalCategory(userId, categoryId)
  const normalized = normalizeVariableInput({ ...input, categoryId })

  const record = await prisma.recipeVariable.update({
    where: { id: variableId },
    data: {
      categoryId,
      ...normalized,
      changeLog: createChangeLog('更新个人变量', 'Updated personal variable'),
    },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) throw new RecipeVariableStoreError('VARIABLE_EXISTS', '同名变量名已存在')
    throw error
  })

  return readPersonalVariable(record)
}

export async function deletePersonalRecipeVariable(userId: string, variableIdInput: unknown) {
  const variableId = readString(variableIdInput)
  if (!variableId) throw new RecipeVariableStoreError('VARIABLE_NOT_FOUND', '个人变量不存在')
  const variable = await requirePersonalVariable(userId, variableId)
  await prisma.recipeVariable.delete({ where: { id: variable.id } })
  return { id: variable.id, name: variable.nameZh }
}

export async function copyRecipeVariableToPersonal(
  userId: string,
  input: { sourceId?: unknown; categoryId?: unknown },
) {
  const sourceId = readString(input.sourceId)
  const source = findRecipeVariableBySourceId(
    [...SYSTEM_RECIPE_VARIABLE_CATEGORIES, ...COMMUNITY_RECIPE_VARIABLE_CATEGORIES],
    sourceId,
  )
  if (!source) throw new RecipeVariableStoreError('VARIABLE_SOURCE_NOT_FOUND', '配方变量来源不存在')

  const categoryId = readString(input.categoryId) || await ensurePersonalCopyCategory(userId, source.category)
  const variableName = await createAvailableVariableName(userId, source.variable.variableName)
  const record = await prisma.recipeVariable.create({
    data: {
      userId,
      categoryId,
      variableName,
      nameZh: source.variable.name.zh,
      nameEn: source.variable.name.en,
      contentZh: source.variable.content.zh,
      contentEn: source.variable.content.en,
      candidates: source.variable.candidates,
      defaultValues: source.variable.defaultValues,
      multiple: source.variable.multiple,
      changeLog: createChangeLog('从只读变量复制', 'Copied from read-only variable'),
    },
  })

  return readPersonalVariable(record)
}

export function isRecipeVariableStoreError(error: unknown): error is RecipeVariableStoreError {
  return error instanceof RecipeVariableStoreError
}

export class RecipeVariableStoreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RecipeVariableStoreError'
  }
}

type RecipeVariableInput = {
  categoryId?: unknown
  variableName?: unknown
  name?: unknown
  content?: unknown
  description?: unknown
  candidates?: unknown
  defaultValues?: unknown
  multiple?: unknown
}

async function requirePersonalCategory(userId: string, categoryId: string) {
  const category = await prisma.recipeVariableCategory.findFirst({ where: { id: categoryId, userId } })
  if (!category) throw new RecipeVariableStoreError('CATEGORY_NOT_FOUND', '个人分类不存在')
  return category
}

async function requirePersonalVariable(userId: string, variableId: string) {
  const variable = await prisma.recipeVariable.findFirst({ where: { id: variableId, userId } })
  if (!variable) throw new RecipeVariableStoreError('VARIABLE_NOT_FOUND', '个人变量不存在')
  return variable
}

async function ensurePersonalCopyCategory(userId: string, source: RecipeVariableCategory) {
  const nameZh = `${source.name.zh}（个人）`
  const existing = await prisma.recipeVariableCategory.findFirst({ where: { userId, nameZh } })
  if (existing) return existing.id
  const created = await prisma.recipeVariableCategory.create({
    data: {
      userId,
      nameZh,
      nameEn: `${source.name.en} Personal`,
      icon: source.icon,
      descriptionZh: source.description.zh,
      descriptionEn: source.description.en,
      tipZh: '从只读变量复制，可按个人工作流维护。',
      tipEn: 'Copied from read-only variables and editable for personal workflows.',
      changeLog: createChangeLog('创建复制分类', 'Created copied category'),
    },
  })
  return created.id
}

async function createAvailableVariableName(userId: string, preferred: string) {
  const base = TAG_NAME_PATTERN.test(preferred) ? preferred : '配方变量'
  const existing = await prisma.recipeVariable.findMany({
    where: { userId, variableName: { startsWith: base } },
    select: { variableName: true },
  })
  const taken = new Set(existing.map((item) => item.variableName))
  if (!taken.has(base)) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}${index}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}${Date.now()}`
}

function readPersonalCategory(record: PersonalCategoryRecord): RecipeVariableCategory {
  return {
    id: record.id,
    scope: 'personal',
    icon: record.icon || 'boxes',
    name: { zh: record.nameZh, en: record.nameEn || record.nameZh },
    description: { zh: record.descriptionZh, en: record.descriptionEn || record.descriptionZh },
    tip: { zh: record.tipZh, en: record.tipEn || record.tipZh },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    changeLog: normalizeChangeLog(record.changeLog),
    variables: (record.variables || []).map(readPersonalVariable),
  }
}

function readPersonalVariable(record: PersonalVariableRecord): RecipeVariableItem {
  return {
    id: record.id,
    scope: 'personal',
    variableName: record.variableName,
    name: { zh: record.nameZh, en: record.nameEn || record.nameZh },
    description: { zh: record.contentZh, en: record.contentEn || record.contentZh },
    content: { zh: record.contentZh, en: record.contentEn || record.contentZh },
    candidates: normalizeCandidates(record.candidates),
    defaultValues: readStringArray(record.defaultValues),
    multiple: record.multiple,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    changeLog: normalizeChangeLog(record.changeLog),
  }
}

function normalizeVariableInput(input: RecipeVariableInput) {
  const variableName = readString(input.variableName)
  const name = normalizeLocalizedText(input.name, '')
  const content = normalizeLocalizedText(input.content, '')
  const description = normalizeLocalizedText(input.description, content.zh)
  const candidates = normalizeCandidates(input.candidates)
  const defaultValues = readStringArray(input.defaultValues)

  if (!TAG_NAME_PATTERN.test(variableName)) {
    throw new RecipeVariableStoreError('VARIABLE_NAME_INVALID', '名称可使用中文、英文、数字、下划线或连字符，长度 1-64 个字符')
  }
  if (!name.zh) throw new RecipeVariableStoreError('VARIABLE_TITLE_REQUIRED', '变量名称不能为空')
  if (!content.zh) throw new RecipeVariableStoreError('VARIABLE_CONTENT_REQUIRED', '变量内容不能为空')

  return {
    variableName,
    nameZh: name.zh,
    nameEn: name.en,
    contentZh: content.zh || description.zh,
    contentEn: content.en || description.en,
    candidates,
    defaultValues,
    multiple: input.multiple === true,
  }
}

function normalizeLocalizedText(value: unknown, fallback: string): LocalizedText {
  if (typeof value === 'string') {
    const text = value.trim().slice(0, 3000)
    return { zh: text || fallback, en: text || fallback }
  }
  if (!isRecord(value)) return { zh: fallback, en: fallback }
  const zh = readString(value.zh).slice(0, 3000)
  const en = readString(value.en).slice(0, 3000)
  return {
    zh: zh || en || fallback,
    en: en || zh || fallback,
  }
}

function normalizeCandidates(value: unknown): Record<Locale, string[]> {
  if (!isRecord(value)) return { zh: [], en: [] }
  return {
    zh: readStringArray(value.zh).slice(0, 64),
    en: readStringArray(value.en).slice(0, 64),
  }
}

function normalizeChangeLog(value: unknown): RecipeVariableChangeLog[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const version = readString(item.version)
    const date = readString(item.date)
    const note = normalizeLocalizedText(item.note, '')
    if (!version && !date && !note.zh) return []
    return [{ version, date, note }]
  })
}

function createChangeLog(zh: string, en: string): RecipeVariableChangeLog[] {
  const date = new Date().toISOString().slice(0, 10)
  return [{ version: '1.0.0', date, note: { zh, en } }]
}

function normalizeIcon(value: unknown) {
  const icon = readString(value).toLowerCase()
  return /^[a-z0-9-]{2,32}$/.test(icon) ? icon : 'boxes'
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(readString).filter(Boolean).map((item) => item.slice(0, 160))
  if (typeof value === 'string') {
    return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).map((item) => item.slice(0, 160))
  }
  return []
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
