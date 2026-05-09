export type Locale = 'zh' | 'en'
export type LocalizedText = Record<Locale, string>
export type RecipeVariableScope = 'system' | 'personal' | 'community'

export type RecipeVariableChangeLog = {
  version: string
  date: string
  note: LocalizedText
}

export type RecipeVariableItem = {
  id: string
  sourceId?: string
  sourceFilePath?: string
  scope: RecipeVariableScope
  variableName: string
  name: LocalizedText
  description: LocalizedText
  content: LocalizedText
  candidates: Record<Locale, string[]>
  defaultValues: string[]
  multiple: boolean
  createdAt?: string
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
}

export type RecipeVariableCategory = {
  id: string
  scope: RecipeVariableScope
  icon: string
  name: LocalizedText
  description: LocalizedText
  tip: LocalizedText
  createdAt?: string
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
  variables: RecipeVariableItem[]
}

export type RecipeVariableStats = Record<RecipeVariableScope, number>

export type RecipeVariableSnapshot = {
  tokenName: string
  sourceId: string
  sourceFilePath?: string
  scope: RecipeVariableScope
  id: string
  categoryId: string
  categoryName: LocalizedText
  variableName: string
  name: LocalizedText
  description: LocalizedText
  content: LocalizedText
  candidates: Record<Locale, string[]>
  defaultValues: string[]
  multiple: boolean
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
}

export type ZpmtRecipeVariableMetadata = {
  schemaVersion: 2
  recipeVariables: RecipeVariableSnapshot[]
}

const SYSTEM_UPDATED_AT = '2026-05-09T00:00:00.000Z'
const COMMUNITY_UPDATED_AT = '2026-05-09T00:00:00.000Z'

export const SYSTEM_RECIPE_VARIABLE_CATEGORIES: RecipeVariableCategory[] = [
  {
    id: 'camera',
    scope: 'system',
    icon: 'aperture',
    name: { zh: '镜头语言', en: 'Camera Language' },
    description: { zh: '画面视角、镜头和景别控制', en: 'Perspective, lens, and framing controls' },
    tip: { zh: '常用于图片生成提示词的视觉基础层。', en: 'Useful as the visual base layer for image prompts.' },
    updatedAt: SYSTEM_UPDATED_AT,
    changeLog: [
      { version: '1.0.0', date: '2026-05-09', note: { zh: '初始化镜头类变量。', en: 'Initialized camera variables.' } },
    ],
    variables: [
      createSeedVariable({
        id: 'focal-length',
        scope: 'system',
        variableName: 'focalLength',
        name: { zh: '焦段', en: 'Focal length' },
        description: { zh: '控制画面透视和空间压缩程度。', en: 'Controls perspective and spatial compression.' },
        content: { zh: '摄影镜头焦段，例如 35mm 或 85mm。', en: 'Camera focal length, such as 35mm or 85mm.' },
        candidates: { zh: ['18mm', '35mm', '50mm', '85mm'], en: ['18mm', '35mm', '50mm', '85mm'] },
        defaultValues: ['35mm'],
        multiple: false,
      }),
      createSeedVariable({
        id: 'lens-type',
        scope: 'system',
        variableName: 'lensType',
        name: { zh: '镜头类型', en: 'Lens type' },
        description: { zh: '定义镜头特性和画面畸变倾向。', en: 'Defines lens character and distortion tendency.' },
        content: { zh: '镜头类型，如广角、定焦、长焦或微距。', en: 'Lens type, such as wide-angle, prime, telephoto, or macro.' },
        candidates: { zh: ['广角镜头', '定焦镜头', '长焦镜头', '微距镜头'], en: ['Wide-angle', 'Prime', 'Telephoto', 'Macro'] },
        defaultValues: ['定焦镜头'],
        multiple: false,
      }),
      createSeedVariable({
        id: 'shot-size',
        scope: 'system',
        variableName: 'shotSize',
        name: { zh: '景别', en: 'Shot size' },
        description: { zh: '定义主体在画面中的占比。', en: 'Defines how much space the subject occupies in frame.' },
        content: { zh: '景别设置，如特写、中景、全景或远景。', en: 'Framing scale, such as close-up, medium, full, or wide shot.' },
        candidates: { zh: ['特写', '中景', '全景', '远景'], en: ['Close-up', 'Medium shot', 'Full shot', 'Wide shot'] },
        defaultValues: ['中景'],
        multiple: false,
      }),
    ],
  },
  {
    id: 'visual-style',
    scope: 'system',
    icon: 'palette',
    name: { zh: '视觉风格', en: 'Visual Style' },
    description: { zh: '光线、色调和构图倾向', en: 'Lighting, tone, and composition direction' },
    tip: { zh: '多选变量适合叠加风格，但要避免过度堆叠。', en: 'Multi-select variables work well for style layering, but avoid overstacking.' },
    updatedAt: SYSTEM_UPDATED_AT,
    changeLog: [
      { version: '1.0.0', date: '2026-05-09', note: { zh: '初始化视觉风格变量。', en: 'Initialized visual style variables.' } },
    ],
    variables: [
      createSeedVariable({
        id: 'lighting',
        scope: 'system',
        variableName: 'lighting',
        name: { zh: '光线', en: 'Lighting' },
        description: { zh: '控制光源类型和明暗关系。', en: 'Controls light source and contrast relationship.' },
        content: { zh: '画面光线类型，可组合自然光、逆光、柔光和霓虹光。', en: 'Lighting style, can combine natural, backlight, soft, and neon light.' },
        candidates: { zh: ['自然光', '逆光', '柔光', '霓虹光'], en: ['Natural light', 'Backlight', 'Soft light', 'Neon light'] },
        defaultValues: ['自然光'],
        multiple: true,
      }),
      createSeedVariable({
        id: 'color-tone',
        scope: 'system',
        variableName: 'colorTone',
        name: { zh: '色调', en: 'Color tone' },
        description: { zh: '定义整体颜色温度和饱和倾向。', en: 'Defines overall color temperature and saturation tendency.' },
        content: { zh: '整体色调方向，如冷色、暖色、高饱和或低饱和。', en: 'Overall tone direction, such as cool, warm, high saturation, or low saturation.' },
        candidates: { zh: ['冷色', '暖色', '高饱和', '低饱和'], en: ['Cool', 'Warm', 'High saturation', 'Low saturation'] },
        defaultValues: ['暖色'],
        multiple: false,
      }),
      createSeedVariable({
        id: 'composition',
        scope: 'system',
        variableName: 'composition',
        name: { zh: '构图', en: 'Composition' },
        description: { zh: '约束主体、空间和视觉动线。', en: 'Constrains subject placement, space, and visual flow.' },
        content: { zh: '构图方式，可组合居中构图、三分法、对角线和留白。', en: 'Composition style, can combine centered, rule of thirds, diagonal, and negative space.' },
        candidates: { zh: ['居中构图', '三分法', '对角线', '留白'], en: ['Centered', 'Rule of thirds', 'Diagonal', 'Negative space'] },
        defaultValues: ['三分法'],
        multiple: true,
      }),
    ],
  },
  {
    id: 'subject',
    scope: 'system',
    icon: 'user-round',
    name: { zh: '主体设定', en: 'Subject Setup' },
    description: { zh: '主体姿态、材质与情绪氛围', en: 'Pose, material, and mood presets' },
    tip: { zh: '适合在角色、产品和场景生成中复用。', en: 'Reusable across character, product, and scene generation.' },
    updatedAt: SYSTEM_UPDATED_AT,
    changeLog: [
      { version: '1.0.0', date: '2026-05-09', note: { zh: '初始化主体设定变量。', en: 'Initialized subject setup variables.' } },
    ],
    variables: [
      createSeedVariable({
        id: 'pose',
        scope: 'system',
        variableName: 'pose',
        name: { zh: '主体姿态', en: 'Subject pose' },
        description: { zh: '控制主体动作和身体状态。', en: 'Controls subject action and body state.' },
        content: { zh: '主体姿态，如站立、坐姿、奔跑或回头。', en: 'Subject pose, such as standing, seated, running, or looking back.' },
        candidates: { zh: ['站立', '坐姿', '奔跑', '回头'], en: ['Standing', 'Seated', 'Running', 'Looking back'] },
        defaultValues: ['站立'],
        multiple: false,
      }),
      createSeedVariable({
        id: 'material',
        scope: 'system',
        variableName: 'material',
        name: { zh: '材质风格', en: 'Material style' },
        description: { zh: '描述主体或关键物件的材质表现。', en: 'Describes material rendering for the subject or key objects.' },
        content: { zh: '材质风格，可组合金属、玻璃、织物和陶瓷。', en: 'Material style, can combine metal, glass, fabric, and ceramic.' },
        candidates: { zh: ['金属', '玻璃', '织物', '陶瓷'], en: ['Metal', 'Glass', 'Fabric', 'Ceramic'] },
        defaultValues: ['织物'],
        multiple: true,
      }),
      createSeedVariable({
        id: 'mood',
        scope: 'system',
        variableName: 'mood',
        name: { zh: '情绪氛围', en: 'Mood' },
        description: { zh: '控制画面情绪和叙事气质。', en: 'Controls mood and narrative atmosphere.' },
        content: { zh: '情绪氛围，可组合安静、紧张、梦幻和未来感。', en: 'Mood, can combine quiet, tense, dreamlike, and futuristic.' },
        candidates: { zh: ['安静', '紧张', '梦幻', '未来感'], en: ['Quiet', 'Tense', 'Dreamlike', 'Futuristic'] },
        defaultValues: ['梦幻'],
        multiple: true,
      }),
    ],
  },
]

export const COMMUNITY_RECIPE_VARIABLE_CATEGORIES: RecipeVariableCategory[] = [
  {
    id: 'commerce',
    scope: 'community',
    icon: 'store',
    name: { zh: '电商转化', en: 'Commerce Conversion' },
    description: { zh: '商品卖点、促销语气和购买动机', en: 'Product selling points, campaign tone, and buying motives' },
    tip: { zh: '社区精选变量，适合商品详情页和广告图。', en: 'Community picks for product pages and ad images.' },
    updatedAt: COMMUNITY_UPDATED_AT,
    changeLog: [
      { version: '1.0.0', date: '2026-05-09', note: { zh: '引入社区电商变量。', en: 'Added community commerce variables.' } },
    ],
    variables: [
      createSeedVariable({
        id: 'selling-point',
        scope: 'community',
        variableName: 'sellingPoint',
        name: { zh: '核心卖点', en: 'Selling point' },
        description: { zh: '指定最优先强调的商品价值。', en: 'Specifies the product value to emphasize first.' },
        content: { zh: '商品核心卖点，如耐用、轻量、环保或高端质感。', en: 'Core selling point, such as durable, lightweight, eco-friendly, or premium texture.' },
        candidates: { zh: ['耐用', '轻量', '环保', '高端质感'], en: ['Durable', 'Lightweight', 'Eco-friendly', 'Premium texture'] },
        defaultValues: ['高端质感'],
        multiple: true,
      }),
      createSeedVariable({
        id: 'campaign-tone',
        scope: 'community',
        variableName: 'campaignTone',
        name: { zh: '促销语气', en: 'Campaign tone' },
        description: { zh: '控制转化文案的促销强度。', en: 'Controls promotion intensity for conversion copy.' },
        content: { zh: '促销表达语气，如限时、会员专属、新品首发或礼赠。', en: 'Campaign tone, such as limited-time, members-only, launch, or gift-with-purchase.' },
        candidates: { zh: ['限时', '会员专属', '新品首发', '礼赠'], en: ['Limited-time', 'Members-only', 'Launch', 'Gift-with-purchase'] },
        defaultValues: ['新品首发'],
        multiple: false,
      }),
    ],
  },
  {
    id: 'agent-output',
    scope: 'community',
    icon: 'bot',
    name: { zh: 'Agent 输出', en: 'Agent Output' },
    description: { zh: 'Agent 结构化响应与协作语气', en: 'Structured responses and collaboration tone for agents' },
    tip: { zh: '适合在 Agent 提示词中统一响应规范。', en: 'Useful for standardizing agent responses.' },
    updatedAt: COMMUNITY_UPDATED_AT,
    changeLog: [
      { version: '1.0.0', date: '2026-05-09', note: { zh: '引入社区 Agent 变量。', en: 'Added community agent variables.' } },
    ],
    variables: [
      createSeedVariable({
        id: 'answer-shape',
        scope: 'community',
        variableName: 'answerShape',
        name: { zh: '回答结构', en: 'Answer shape' },
        description: { zh: '约束 Agent 输出结构。', en: 'Constrains the structure of agent output.' },
        content: { zh: '回答结构，如摘要优先、步骤列表、表格对比或结论后置。', en: 'Answer shape, such as summary first, steps, comparison table, or conclusion last.' },
        candidates: { zh: ['摘要优先', '步骤列表', '表格对比', '结论后置'], en: ['Summary first', 'Steps', 'Comparison table', 'Conclusion last'] },
        defaultValues: ['摘要优先'],
        multiple: false,
      }),
      createSeedVariable({
        id: 'review-depth',
        scope: 'community',
        variableName: 'reviewDepth',
        name: { zh: '审阅深度', en: 'Review depth' },
        description: { zh: '设置检查或评审的严格程度。', en: 'Sets the strictness of review or inspection.' },
        content: { zh: '审阅深度，如快速检查、逐段审阅、风险优先或验收清单。', en: 'Review depth, such as quick check, paragraph review, risk first, or acceptance checklist.' },
        candidates: { zh: ['快速检查', '逐段审阅', '风险优先', '验收清单'], en: ['Quick check', 'Paragraph review', 'Risk first', 'Acceptance checklist'] },
        defaultValues: ['风险优先'],
        multiple: true,
      }),
    ],
  },
]

export function cloneRecipeVariableCategories(categories: RecipeVariableCategory[]) {
  return categories.map((category) => ({
    ...category,
    name: { ...category.name },
    description: { ...category.description },
    tip: { ...category.tip },
    changeLog: category.changeLog.map(cloneRecipeVariableChangeLog),
    variables: category.variables.map(cloneRecipeVariableItem),
  }))
}

export function getDefaultRecipeVariableCategories() {
  return cloneRecipeVariableCategories([...SYSTEM_RECIPE_VARIABLE_CATEGORIES, ...COMMUNITY_RECIPE_VARIABLE_CATEGORIES])
}

export function flattenRecipeVariables(categories: RecipeVariableCategory[]) {
  return categories.flatMap((category) => category.variables.map((variable) => ({ category, variable })))
}

export function getRecipeVariableStats(categories: RecipeVariableCategory[]): RecipeVariableStats {
  return categories.reduce<RecipeVariableStats>(
    (stats, category) => {
      stats[category.scope] += category.variables.length
      return stats
    },
    { system: 0, personal: 0, community: 0 },
  )
}

export function formatRecipeVariableSourceId(variable: Pick<RecipeVariableItem, 'id' | 'scope' | 'sourceId'>) {
  if ('sourceId' in variable && typeof variable.sourceId === 'string' && variable.sourceId) return variable.sourceId
  return `${variable.scope}:${variable.id}`
}

export function parseRecipeVariableSourceId(value: string): { scope: RecipeVariableScope; id: string } {
  const [rawScope, ...rest] = value.split(':')
  const id = rest.join(':').trim()
  if ((rawScope === 'system' || rawScope === 'personal' || rawScope === 'community') && id) {
    return { scope: rawScope, id }
  }
  return { scope: 'system', id: value.trim() }
}

export function findRecipeVariableBySourceId(categories: RecipeVariableCategory[], sourceId: string) {
  const parsed = parseRecipeVariableSourceId(sourceId)
  return flattenRecipeVariables(categories).find(({ variable }) => {
    if (variable.sourceId && sourceIdsEqual(variable.sourceId, sourceId)) return true
    if (variable.scope === parsed.scope && variable.id === parsed.id) return true
    return !sourceId.includes(':') && variable.scope === 'system' && variable.id === sourceId
  }) || null
}

export function createRecipeVariableSnapshot(input: {
  tokenName: string
  sourceId: string
  category: RecipeVariableCategory
  variable: RecipeVariableItem
}): RecipeVariableSnapshot {
  const { tokenName, sourceId, category, variable } = input
  return {
    tokenName,
    sourceId,
    sourceFilePath: variable.sourceFilePath,
    scope: variable.scope,
    id: variable.id,
    categoryId: category.id,
    categoryName: { ...category.name },
    variableName: variable.variableName,
    name: { ...variable.name },
    description: { ...variable.description },
    content: { ...variable.content },
    candidates: cloneCandidates(variable.candidates),
    defaultValues: [...variable.defaultValues],
    multiple: variable.multiple,
    updatedAt: variable.updatedAt,
    changeLog: variable.changeLog.map(cloneRecipeVariableChangeLog),
  }
}

export function normalizeRecipeVariableMetadata(value: unknown): ZpmtRecipeVariableMetadata {
  if (!isRecord(value)) return { schemaVersion: 2, recipeVariables: [] }
  const snapshots = Array.isArray(value.recipeVariables) ? value.recipeVariables : []
  return {
    schemaVersion: 2,
    recipeVariables: snapshots.map(normalizeRecipeVariableSnapshot).filter((item): item is RecipeVariableSnapshot => Boolean(item)),
  }
}

export function findRecipeVariableSnapshot(
  metadata: ZpmtRecipeVariableMetadata | undefined,
  tokenName: string,
  sourceId: string,
) {
  if (!metadata) return null
  return metadata.recipeVariables.find((snapshot) => snapshot.tokenName === tokenName && sourceIdsEqual(snapshot.sourceId, sourceId)) || null
}

export function sourceIdsEqual(left: string, right: string) {
  if (left === right) return true
  if (left.includes('#') || right.includes('#')) return false
  const parsedLeft = parseRecipeVariableSourceId(left)
  const parsedRight = parseRecipeVariableSourceId(right)
  return parsedLeft.scope === parsedRight.scope && parsedLeft.id === parsedRight.id
}

function createSeedVariable(input: Omit<RecipeVariableItem, 'createdAt' | 'updatedAt' | 'changeLog'>): RecipeVariableItem {
  return {
    ...input,
    createdAt: input.scope === 'community' ? COMMUNITY_UPDATED_AT : SYSTEM_UPDATED_AT,
    updatedAt: input.scope === 'community' ? COMMUNITY_UPDATED_AT : SYSTEM_UPDATED_AT,
    changeLog: [
      {
        version: '1.0.0',
        date: '2026-05-09',
        note: { zh: `初始化「${input.name.zh}」变量。`, en: `Initialized "${input.name.en}" variable.` },
      },
    ],
  }
}

function cloneRecipeVariableItem(variable: RecipeVariableItem): RecipeVariableItem {
  return {
    ...variable,
    name: { ...variable.name },
    description: { ...variable.description },
    content: { ...variable.content },
    candidates: cloneCandidates(variable.candidates),
    defaultValues: [...variable.defaultValues],
    changeLog: variable.changeLog.map(cloneRecipeVariableChangeLog),
  }
}

function cloneRecipeVariableChangeLog(item: RecipeVariableChangeLog): RecipeVariableChangeLog {
  return {
    version: item.version,
    date: item.date,
    note: { ...item.note },
  }
}

function cloneCandidates(value: Record<Locale, string[]>) {
  return {
    zh: [...value.zh],
    en: [...value.en],
  }
}

function normalizeRecipeVariableSnapshot(value: unknown): RecipeVariableSnapshot | null {
  if (!isRecord(value)) return null
  const id = readString(value.id)
  const tokenName = readString(value.tokenName)
  const sourceId = readString(value.sourceId)
  const scope = normalizeScope(value.scope)
  if (!id || !tokenName || !sourceId) return null

  return {
    tokenName,
    sourceId,
    sourceFilePath: readString(value.sourceFilePath) || undefined,
    scope,
    id,
    categoryId: readString(value.categoryId),
    categoryName: readLocalizedText(value.categoryName, ''),
    variableName: readString(value.variableName) || tokenName,
    name: readLocalizedText(value.name, tokenName),
    description: readLocalizedText(value.description, ''),
    content: readLocalizedText(value.content, ''),
    candidates: readLocalizedCandidates(value.candidates),
    defaultValues: readStringArray(value.defaultValues),
    multiple: value.multiple === true,
    updatedAt: readString(value.updatedAt) || undefined,
    changeLog: normalizeChangeLog(value.changeLog),
  }
}

function normalizeScope(value: unknown): RecipeVariableScope {
  return value === 'personal' || value === 'community' ? value : 'system'
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

function readLocalizedCandidates(value: unknown): Record<Locale, string[]> {
  if (!isRecord(value)) return { zh: [], en: [] }
  return {
    zh: readStringArray(value.zh),
    en: readStringArray(value.en),
  }
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(readString).filter(Boolean)
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
