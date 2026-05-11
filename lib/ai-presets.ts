export type ZpmtOutputType = 'text' | 'image'
export type AiModelCapability = ZpmtOutputType
export type ZpmtResponseFormat = 'text' | 'json_object'
export type ThinkingMode = 'enabled' | 'disabled' | 'auto'
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type ImageSizeMode = 'fixed_options' | 'custom_constraints' | 'resolution_ratio' | 'adaptive'
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp'
export type ImageResponseFormat = 'url' | 'b64_json'
export type ImageBackground = 'auto' | 'opaque' | 'transparent'
export type ImageModeration = 'auto' | 'low'
export type ImageStyle = 'vivid' | 'natural'
export type ToolCallingSupport = 'supported' | 'unsupported' | 'unknown'
export type PromptMessageRole = 'system' | 'user' | 'assistant' | 'tool'
export type ImageStyleInputType = 'free-text' | 'preset' | 'preset-with-extra-text'

export type ImageStyleOption = {
  label: string
  value: string
}

export type AiModelPromptSurface =
  | {
      kind: 'messages'
      supportedRoles: PromptMessageRole[]
    }
  | {
      kind: 'image-prompt'
      negativePrompt: boolean
      styleInput: {
        type: ImageStyleInputType
        options?: ImageStyleOption[]
      }
    }
type TextPromptSurface = Extract<AiModelPromptSurface, { kind: 'messages' }>
type ImagePromptSurface = Extract<AiModelPromptSurface, { kind: 'image-prompt' }>

export type ReferenceInputSupport = {
  image?: boolean
  file?: boolean
}

export type NumericParameterSchema = {
  min: number
  max: number
  step: number
  defaultValue: number
}

export type TextModelParameterSchema = {
  kind: 'text'
  temperature: NumericParameterSchema
  maxTokens: NumericParameterSchema
  responseFormats: ZpmtResponseFormat[]
  thinking?: ThinkingParameterSchema
  referenceInput?: ReferenceInputSupport
}

export type ThinkingParameterSchema = {
  modes: ThinkingMode[]
  defaultMode: ThinkingMode
  efforts?: ReasoningEffort[]
  defaultEffort?: ReasoningEffort
  apiStyle: 'openai_reasoning' | 'deepseek_thinking' | 'volcengine_thinking'
}

export type ImageAspectRatioSize = {
  aspectRatio: string
  size: string
}

export type ImageResolutionOption = {
  resolution: string
  sizes: ImageAspectRatioSize[]
}

export type ImageSizeConstraints = {
  minPixels?: number
  maxPixels?: number
  maxEdge?: number
  minEdge?: number
  multipleOf?: number
  maxLongShortRatio?: number
}

export type ImageModelParameterSchema = {
  kind: 'image'
  sizeMode: ImageSizeMode
  sizeOptions: string[]
  defaultImageSize: string
  imageCount?: NumericParameterSchema
  allowCustomSize?: boolean
  customSizePlaceholder?: string
  sizeConstraints?: ImageSizeConstraints
  resolutionOptions?: ImageResolutionOption[]
  defaultImageResolution?: string
  defaultImageAspectRatio?: string
  imageQualities: string[]
  defaultImageQuality?: string
  outputFormats?: ImageOutputFormat[]
  defaultOutputFormat?: ImageOutputFormat
  outputCompression?: NumericParameterSchema
  responseFormats?: ImageResponseFormat[]
  defaultImageResponseFormat?: ImageResponseFormat
  backgroundOptions?: ImageBackground[]
  defaultBackground?: ImageBackground
  moderationOptions?: ImageModeration[]
  defaultModeration?: ImageModeration
  watermark?: {
    defaultValue: boolean
  }
  imageStyles?: ImageStyle[]
  defaultImageStyle?: ImageStyle
  referenceInput?: ReferenceInputSupport
}

export type AiModelParameterSchema = TextModelParameterSchema | ImageModelParameterSchema

export type ZpmtResponseConfig = {
  temperature?: number
  maxTokens?: number
  responseFormat?: ZpmtResponseFormat
  thinkingMode?: ThinkingMode
  reasoningEffort?: ReasoningEffort
  imageSize?: string
  imageResolution?: string
  imageAspectRatio?: string
  imageCount?: number
  imageQuality?: string
  imageOutputFormat?: ImageOutputFormat
  imageOutputCompression?: number
  imageResponseFormat?: ImageResponseFormat
  imageBackground?: ImageBackground
  imageModeration?: ImageModeration
  watermark?: boolean
  imageStyle?: ImageStyle
}

export type AiProviderModel = {
  id: string
  capabilities: AiModelCapability[]
  toolCalling: ToolCallingSupport
  parameterSchema?: AiModelParameterSchema
  promptSurface?: AiModelPromptSurface
  defaultResponseConfig?: ZpmtResponseConfig
  presetRef?: AiModelPresetRef
}

export type AiProviderSummary = {
  id: string
  name: string
  providerType: string
  baseUrl: string
  filePath?: string
  apiKey?: string
  schemaVersion?: number
  models: AiProviderModel[]
  hasApiKey: boolean
  createdAt?: string
  updatedAt?: string
}

export type AiProviderPreset = {
  providerType: string
  name: string
  baseUrl: string
  models: AiProviderModel[]
}

export type AiModelPresetOption = {
  key: string
  providerType: string
  providerName: string
  model: AiProviderModel
}

export type AiModelPresetRef = {
  providerType: string
  providerName?: string
  modelId: string
}

export const ZPMT_OUTPUT_TYPES: ZpmtOutputType[] = ['text', 'image']

const DEFAULT_TEXT_PROMPT_SURFACE: TextPromptSurface = {
  kind: 'messages',
  supportedRoles: ['system', 'user', 'assistant', 'tool'],
}

const DEFAULT_IMAGE_PROMPT_SURFACE: ImagePromptSurface = {
  kind: 'image-prompt',
  negativePrompt: false,
  styleInput: { type: 'free-text' },
}

const DEFAULT_TEXT_SCHEMA: TextModelParameterSchema = {
  kind: 'text',
  temperature: { min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
  maxTokens: { min: 1, max: 8192, step: 1, defaultValue: 2048 },
  responseFormats: ['text', 'json_object'],
}

const OPENAI_REASONING_SCHEMA: ThinkingParameterSchema = {
  modes: ['disabled', 'enabled'],
  defaultMode: 'enabled',
  efforts: ['none', 'low', 'medium', 'high', 'xhigh'],
  defaultEffort: 'medium',
  apiStyle: 'openai_reasoning',
}

const OPENAI_LONG_CONTEXT_TEXT_SCHEMA: TextModelParameterSchema = {
  kind: 'text',
  temperature: { min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
  maxTokens: { min: 1, max: 128000, step: 1, defaultValue: 4096 },
  responseFormats: ['text', 'json_object'],
  thinking: OPENAI_REASONING_SCHEMA,
  referenceInput: { image: true, file: true },
}

const DEEPSEEK_THINKING_SCHEMA: ThinkingParameterSchema = {
  modes: ['enabled', 'disabled'],
  defaultMode: 'enabled',
  efforts: ['high', 'max'],
  defaultEffort: 'high',
  apiStyle: 'deepseek_thinking',
}

const DEEPSEEK_V4_TEXT_SCHEMA: TextModelParameterSchema = {
  kind: 'text',
  temperature: { min: 0, max: 2, step: 0.1, defaultValue: 1 },
  maxTokens: { min: 1, max: 384000, step: 1, defaultValue: 32768 },
  responseFormats: ['text', 'json_object'],
  thinking: DEEPSEEK_THINKING_SCHEMA,
}

const VOLCENGINE_THINKING_SCHEMA: ThinkingParameterSchema = {
  modes: ['enabled', 'disabled', 'auto'],
  defaultMode: 'enabled',
  apiStyle: 'volcengine_thinking',
}

const VOLCENGINE_TEXT_SCHEMA: TextModelParameterSchema = {
  kind: 'text',
  temperature: { min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
  maxTokens: { min: 1, max: 32768, step: 1, defaultValue: 4096 },
  responseFormats: ['text', 'json_object'],
  thinking: VOLCENGINE_THINKING_SCHEMA,
  referenceInput: { image: true },
}

const VOLCENGINE_CODE_TEXT_SCHEMA: TextModelParameterSchema = {
  kind: 'text',
  temperature: { min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
  maxTokens: { min: 1, max: 32000, step: 1, defaultValue: 4000 },
  responseFormats: ['text', 'json_object'],
  thinking: VOLCENGINE_THINKING_SCHEMA,
}

const OPENAI_OUTPUT_COMPRESSION: NumericParameterSchema = { min: 0, max: 100, step: 1, defaultValue: 0 }
const IMAGE_COUNT_1_TO_10: NumericParameterSchema = { min: 1, max: 10, step: 1, defaultValue: 1 }
const IMAGE_COUNT_SINGLE: NumericParameterSchema = { min: 1, max: 1, step: 1, defaultValue: 1 }

const OPENAI_GPT_IMAGE_2_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'custom_constraints',
  sizeOptions: ['auto'],
  defaultImageSize: 'auto',
  imageCount: IMAGE_COUNT_1_TO_10,
  allowCustomSize: true,
  customSizePlaceholder: '1536x1024',
  sizeConstraints: {
    minPixels: 655360,
    maxPixels: 8294400,
    maxEdge: 3840,
    multipleOf: 16,
    maxLongShortRatio: 3,
  },
  imageQualities: ['auto', 'low', 'medium', 'high'],
  defaultImageQuality: 'auto',
  outputFormats: ['png', 'jpeg', 'webp'],
  defaultOutputFormat: 'png',
  outputCompression: OPENAI_OUTPUT_COMPRESSION,
  backgroundOptions: ['auto', 'opaque'],
  defaultBackground: 'auto',
  moderationOptions: ['auto', 'low'],
  defaultModeration: 'auto',
  referenceInput: { image: true },
}

const OPENAI_GPT_IMAGE_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'fixed_options',
  sizeOptions: ['auto', '1024x1024', '1536x1024', '1024x1536'],
  defaultImageSize: 'auto',
  imageCount: IMAGE_COUNT_1_TO_10,
  imageQualities: ['auto', 'low', 'medium', 'high'],
  defaultImageQuality: 'auto',
  outputFormats: ['png', 'jpeg', 'webp'],
  defaultOutputFormat: 'png',
  outputCompression: OPENAI_OUTPUT_COMPRESSION,
  backgroundOptions: ['auto', 'transparent', 'opaque'],
  defaultBackground: 'auto',
  moderationOptions: ['auto', 'low'],
  defaultModeration: 'auto',
  referenceInput: { image: true },
}

const OPENAI_DALLE_3_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'fixed_options',
  sizeOptions: ['1024x1024', '1792x1024', '1024x1792'],
  defaultImageSize: '1024x1024',
  imageCount: IMAGE_COUNT_SINGLE,
  imageQualities: ['standard', 'hd'],
  defaultImageQuality: 'standard',
  responseFormats: ['url', 'b64_json'],
  defaultImageResponseFormat: 'url',
  imageStyles: ['vivid', 'natural'],
  defaultImageStyle: 'vivid',
}

const OPENAI_DALLE_2_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'fixed_options',
  sizeOptions: ['256x256', '512x512', '1024x1024'],
  defaultImageSize: '1024x1024',
  imageCount: IMAGE_COUNT_1_TO_10,
  imageQualities: [],
  responseFormats: ['url', 'b64_json'],
  defaultImageResponseFormat: 'url',
  referenceInput: { image: true },
}

const VOLCENGINE_SEEDREAM_COMMON = {
  imageCount: IMAGE_COUNT_1_TO_10,
  imageQualities: [],
  responseFormats: ['url', 'b64_json'] as ImageResponseFormat[],
  defaultImageResponseFormat: 'url' as ImageResponseFormat,
  watermark: { defaultValue: true },
  referenceInput: { image: true },
}

const VOLCENGINE_1K_SIZES: ImageAspectRatioSize[] = [
  { aspectRatio: '1:1', size: '1024x1024' },
  { aspectRatio: '4:3', size: '1152x864' },
  { aspectRatio: '3:4', size: '864x1152' },
  { aspectRatio: '16:9', size: '1280x720' },
  { aspectRatio: '9:16', size: '720x1280' },
  { aspectRatio: '3:2', size: '1248x832' },
  { aspectRatio: '2:3', size: '832x1248' },
  { aspectRatio: '21:9', size: '1512x648' },
]

const VOLCENGINE_2K_SIZES: ImageAspectRatioSize[] = [
  { aspectRatio: '1:1', size: '2048x2048' },
  { aspectRatio: '4:3', size: '2304x1728' },
  { aspectRatio: '3:4', size: '1728x2304' },
  { aspectRatio: '16:9', size: '2848x1600' },
  { aspectRatio: '9:16', size: '1600x2848' },
  { aspectRatio: '3:2', size: '2496x1664' },
  { aspectRatio: '2:3', size: '1664x2496' },
  { aspectRatio: '21:9', size: '3136x1344' },
]

const VOLCENGINE_3K_SIZES: ImageAspectRatioSize[] = [
  { aspectRatio: '1:1', size: '3072x3072' },
  { aspectRatio: '4:3', size: '3456x2592' },
  { aspectRatio: '3:4', size: '2592x3456' },
  { aspectRatio: '16:9', size: '4096x2304' },
  { aspectRatio: '9:16', size: '2304x4096' },
  { aspectRatio: '3:2', size: '3744x2496' },
  { aspectRatio: '2:3', size: '2496x3744' },
  { aspectRatio: '21:9', size: '4704x2016' },
]

const VOLCENGINE_4K_SIZES: ImageAspectRatioSize[] = [
  { aspectRatio: '1:1', size: '4096x4096' },
  { aspectRatio: '4:3', size: '4704x3520' },
  { aspectRatio: '3:4', size: '3520x4704' },
  { aspectRatio: '16:9', size: '5504x3040' },
  { aspectRatio: '9:16', size: '3040x5504' },
  { aspectRatio: '3:2', size: '4992x3328' },
  { aspectRatio: '2:3', size: '3328x4992' },
  { aspectRatio: '21:9', size: '6240x2656' },
]

const VOLCENGINE_SEEDREAM_50_IMAGE_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'resolution_ratio',
  sizeOptions: [],
  defaultImageSize: '2048x2048',
  resolutionOptions: [
    { resolution: '2K', sizes: VOLCENGINE_2K_SIZES },
    { resolution: '3K', sizes: VOLCENGINE_3K_SIZES },
    { resolution: '4K', sizes: VOLCENGINE_4K_SIZES },
  ],
  defaultImageResolution: '2K',
  defaultImageAspectRatio: '1:1',
  outputFormats: ['png', 'jpeg'],
  defaultOutputFormat: 'jpeg',
  ...VOLCENGINE_SEEDREAM_COMMON,
}

const VOLCENGINE_SEEDREAM_45_IMAGE_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'resolution_ratio',
  sizeOptions: [],
  defaultImageSize: '2048x2048',
  resolutionOptions: [
    { resolution: '2K', sizes: VOLCENGINE_2K_SIZES },
    { resolution: '4K', sizes: VOLCENGINE_4K_SIZES },
  ],
  defaultImageResolution: '2K',
  defaultImageAspectRatio: '1:1',
  outputFormats: ['jpeg'],
  defaultOutputFormat: 'jpeg',
  ...VOLCENGINE_SEEDREAM_COMMON,
}

const VOLCENGINE_SEEDREAM_40_IMAGE_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'resolution_ratio',
  sizeOptions: [],
  defaultImageSize: '2048x2048',
  resolutionOptions: [
    { resolution: '1K', sizes: VOLCENGINE_1K_SIZES },
    { resolution: '2K', sizes: VOLCENGINE_2K_SIZES },
    { resolution: '4K', sizes: VOLCENGINE_4K_SIZES },
  ],
  defaultImageResolution: '2K',
  defaultImageAspectRatio: '1:1',
  outputFormats: ['jpeg'],
  defaultOutputFormat: 'jpeg',
  ...VOLCENGINE_SEEDREAM_COMMON,
}

const VOLCENGINE_SEEDEDIT_30_IMAGE_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'adaptive',
  sizeOptions: ['adaptive'],
  defaultImageSize: 'adaptive',
  imageCount: IMAGE_COUNT_1_TO_10,
  imageQualities: [],
  responseFormats: ['url', 'b64_json'],
  defaultImageResponseFormat: 'url',
  watermark: { defaultValue: true },
  referenceInput: { image: true },
}

const DEFAULT_IMAGE_SCHEMA: ImageModelParameterSchema = {
  kind: 'image',
  sizeMode: 'fixed_options',
  sizeOptions: ['1024x1024', '1024x1536', '1536x1024'],
  defaultImageSize: '1024x1024',
  imageCount: IMAGE_COUNT_1_TO_10,
  imageQualities: [],
}

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    providerType: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.5', capabilities: ['text'], toolCalling: 'supported', parameterSchema: OPENAI_LONG_CONTEXT_TEXT_SCHEMA },
      { id: 'gpt-5.4', capabilities: ['text'], toolCalling: 'supported', parameterSchema: OPENAI_LONG_CONTEXT_TEXT_SCHEMA },
      { id: 'gpt-5.4-mini', capabilities: ['text'], toolCalling: 'supported', parameterSchema: OPENAI_LONG_CONTEXT_TEXT_SCHEMA },
      { id: 'gpt-5.4-nano', capabilities: ['text'], toolCalling: 'supported', parameterSchema: OPENAI_LONG_CONTEXT_TEXT_SCHEMA },
      { id: 'gpt-image-2', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: OPENAI_GPT_IMAGE_2_SCHEMA },
      { id: 'gpt-image-1.5', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: OPENAI_GPT_IMAGE_SCHEMA },
      { id: 'gpt-image-1', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: OPENAI_GPT_IMAGE_SCHEMA },
      { id: 'dall-e-3', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: OPENAI_DALLE_3_SCHEMA },
      { id: 'dall-e-2', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: OPENAI_DALLE_2_SCHEMA },
    ],
  },
  {
    providerType: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-v4-flash', capabilities: ['text'], toolCalling: 'supported', parameterSchema: DEEPSEEK_V4_TEXT_SCHEMA },
      { id: 'deepseek-v4-pro', capabilities: ['text'], toolCalling: 'supported', parameterSchema: DEEPSEEK_V4_TEXT_SCHEMA },
    ],
  },
  {
    providerType: 'volcengine',
    name: '火山引擎（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-seed-1-6-251015', capabilities: ['text'], toolCalling: 'supported', parameterSchema: VOLCENGINE_TEXT_SCHEMA },
      { id: 'doubao-seed-code-preview-251028', capabilities: ['text'], toolCalling: 'unknown', parameterSchema: VOLCENGINE_CODE_TEXT_SCHEMA },
      { id: 'doubao-seedream-5-0-260128', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: VOLCENGINE_SEEDREAM_50_IMAGE_SCHEMA },
      { id: 'doubao-seedream-4-5-251128', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: VOLCENGINE_SEEDREAM_45_IMAGE_SCHEMA },
      { id: 'doubao-seedream-4-0-250828', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: VOLCENGINE_SEEDREAM_40_IMAGE_SCHEMA },
      { id: 'doubao-seededit-3-0-i2i-250628', capabilities: ['image'], toolCalling: 'unsupported', parameterSchema: VOLCENGINE_SEEDEDIT_30_IMAGE_SCHEMA },
    ],
  },
  {
    providerType: 'custom',
    name: '自定义 OpenAI 兼容',
    baseUrl: 'https://api.example.com/v1',
    models: [{ id: 'custom-model', capabilities: ['text'], toolCalling: 'unknown', parameterSchema: DEFAULT_TEXT_SCHEMA }],
  },
]

export function inferAiProviderTypeFromBaseUrl(value: unknown, fallback = 'custom') {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback

  const normalized = raw.toLowerCase()
  let hostname = ''
  try {
    hostname = new URL(raw).hostname.toLowerCase()
  } catch {
    hostname = normalized
  }

  const source = `${hostname} ${normalized}`
  if (source.includes('openai.com')) return 'openai'
  if (source.includes('deepseek.com')) return 'deepseek'
  if (source.includes('volces.com') || source.includes('volcengine')) return 'volcengine'

  return fallback
}

export function modelsToText(models: AiProviderModel[]) {
  return models.map((model) => `${model.id} | ${model.capabilities.join(',')} | ${serializeToolCalling(model.toolCalling)}`).join('\n')
}

export function parseModelsText(value: string, providerType = 'custom'): AiProviderModel[] {
  const seen = new Set<string>()
  return value.split(/\r?\n/).flatMap((line) => {
    const [rawId, rawCapabilities = 'text', rawToolCalling] = line.split('|')
    const id = rawId.trim()
    if (!id || seen.has(id)) return []
    seen.add(id)
    const capabilityTokens = rawCapabilities.split(',').map((item) => item.trim())
    const capabilities = ZPMT_OUTPUT_TYPES.filter((type) => capabilityTokens.includes(type))
    return [createAiProviderModel(providerType, id, capabilities.length ? capabilities : undefined, parseToolCalling(rawToolCalling))]
  })
}

export function createAiProviderModel(
  providerType: string,
  id: string,
  capabilities?: AiModelCapability[],
  toolCalling?: ToolCallingSupport,
): AiProviderModel {
  const normalizedCapabilities = capabilities?.length ? capabilities : inferAiModelCapabilities(providerType, id)
  return {
    id,
    capabilities: normalizedCapabilities,
    toolCalling: toolCalling || inferToolCallingSupport(providerType, id, normalizedCapabilities),
    parameterSchema: inferAiModelParameterSchema(providerType, id, normalizedCapabilities),
    promptSurface: inferAiModelPromptSurface(providerType, id, normalizedCapabilities),
  }
}

export function inferAiModelPromptSurface(
  providerType: string,
  modelId: string,
  capabilities: AiModelCapability[] = inferAiModelCapabilities(providerType, modelId),
): AiModelPromptSurface {
  const preset = findAiModelPreset(providerType, modelId)
  if (preset?.promptSurface) return preset.promptSurface
  return capabilities.includes('image') ? DEFAULT_IMAGE_PROMPT_SURFACE : DEFAULT_TEXT_PROMPT_SURFACE
}

export function inferToolCallingSupport(
  providerType: string,
  modelId: string,
  capabilities: AiModelCapability[] = inferAiModelCapabilities(providerType, modelId),
): ToolCallingSupport {
  const preset = findAiModelPreset(providerType, modelId)
  if (preset?.toolCalling) return preset.toolCalling
  if (capabilities.includes('image')) return 'unsupported'

  const normalizedProvider = providerType.toLowerCase()
  const normalizedModel = modelId.toLowerCase()
  if (normalizedProvider === 'openai' || normalizedModel.startsWith('gpt-') || normalizedModel.startsWith('o')) return 'supported'
  if (normalizedProvider === 'deepseek' || normalizedModel.includes('deepseek')) return 'supported'
  if (normalizedProvider === 'volcengine' || normalizedProvider === 'volcano' || normalizedProvider === 'ark' || normalizedModel.includes('doubao')) {
    if (normalizedModel.includes('seed-1-6')) return 'supported'
    return 'unknown'
  }
  return 'unknown'
}

export function inferAiModelCapabilities(providerType: string, modelId: string): AiModelCapability[] {
  const preset = findAiModelPreset(providerType, modelId)
  if (preset?.capabilities.length) return preset.capabilities

  const normalized = modelId.toLowerCase()
  const imageTokens = ['image', 'img', 'gpt-image', 'dall-e', 'flux', 'kolors', 'seedream', 'seededit', 'stable-diffusion', 'sdxl', 'wanx', 'midjourney']
  if (imageTokens.some((token) => normalized.includes(token))) return ['image']
  return ['text']
}

export function inferAiModelParameterSchema(
  providerType: string,
  modelId: string,
  capabilities: AiModelCapability[] = inferAiModelCapabilities(providerType, modelId),
): AiModelParameterSchema {
  const preset = findAiModelPreset(providerType, modelId)
  if (preset?.parameterSchema) return preset.parameterSchema

  const normalizedProvider = providerType.toLowerCase()
  const normalizedModel = modelId.toLowerCase()
  if (capabilities.includes('image')) {
    if (normalizedProvider === 'volcengine' || normalizedProvider === 'volcano' || normalizedProvider === 'ark' || normalizedModel.includes('seedream') || normalizedModel.includes('seededit')) {
      if (normalizedModel.includes('seededit')) return VOLCENGINE_SEEDEDIT_30_IMAGE_SCHEMA
      if (normalizedModel.includes('5-0') || normalizedModel.includes('5.0')) return VOLCENGINE_SEEDREAM_50_IMAGE_SCHEMA
      if (normalizedModel.includes('4-0') || normalizedModel.includes('4.0')) return VOLCENGINE_SEEDREAM_40_IMAGE_SCHEMA
      return VOLCENGINE_SEEDREAM_45_IMAGE_SCHEMA
    }
    if (normalizedProvider === 'openai' || normalizedModel.includes('gpt-image') || normalizedModel.includes('dall-e')) {
      if (normalizedModel.includes('dall-e-2')) return OPENAI_DALLE_2_SCHEMA
      if (normalizedModel.includes('dall-e-3')) return OPENAI_DALLE_3_SCHEMA
      if (normalizedModel.includes('gpt-image-2')) return OPENAI_GPT_IMAGE_2_SCHEMA
      return OPENAI_GPT_IMAGE_SCHEMA
    }
    return DEFAULT_IMAGE_SCHEMA
  }

  if (normalizedProvider === 'deepseek' || normalizedModel.includes('deepseek')) return DEEPSEEK_V4_TEXT_SCHEMA
  if (normalizedProvider === 'volcengine' || normalizedProvider === 'volcano' || normalizedProvider === 'ark' || normalizedModel.includes('doubao')) {
    if (normalizedModel.includes('code')) return VOLCENGINE_CODE_TEXT_SCHEMA
    return VOLCENGINE_TEXT_SCHEMA
  }
  if (normalizedProvider === 'openai' || normalizedModel.startsWith('gpt-') || normalizedModel.startsWith('o')) return OPENAI_LONG_CONTEXT_TEXT_SCHEMA
  return DEFAULT_TEXT_SCHEMA
}

export function normalizeAiModelParameterSchema(value: unknown, fallback: AiModelParameterSchema): AiModelParameterSchema {
  if (!isRecord(value)) return fallback

  if (value.kind === 'image') {
    const imageFallback = fallback.kind === 'image' ? fallback : DEFAULT_IMAGE_SCHEMA
    if (!isImageSizeMode(value.sizeMode)) return imageFallback
    const sizeOptions = readStringArray(value.sizeOptions)
    const imageQualities = readStringArray(value.imageQualities)
    const outputFormats = normalizeImageOutputFormats(value.outputFormats, imageFallback.outputFormats)
    const responseFormats = normalizeImageResponseFormats(value.responseFormats, imageFallback.responseFormats)
    const backgroundOptions = normalizeBackgroundOptions(value.backgroundOptions, imageFallback.backgroundOptions)
    const moderationOptions = normalizeModerationOptions(value.moderationOptions, imageFallback.moderationOptions)
    const imageStyles = normalizeImageStyles(value.imageStyles, imageFallback.imageStyles)
    const resolutionOptions = normalizeResolutionOptions(value.resolutionOptions, imageFallback.resolutionOptions)
    const defaultImageResolution = readString(value.defaultImageResolution) || imageFallback.defaultImageResolution
    const defaultImageAspectRatio = readString(value.defaultImageAspectRatio) || imageFallback.defaultImageAspectRatio
    const defaultImageSize = readString(value.defaultImageSize) || imageFallback.defaultImageSize
    const imageCount = normalizeNumericParameterSchema(value.imageCount, imageFallback.imageCount || IMAGE_COUNT_1_TO_10)
    const referenceInput = normalizeReferenceInputSupport(value.referenceInput, imageFallback.referenceInput)

    return {
      kind: 'image',
      sizeMode: value.sizeMode,
      sizeOptions: sizeOptions.length ? sizeOptions : imageFallback.sizeOptions,
      defaultImageSize,
      imageCount,
      ...(value.allowCustomSize === true || imageFallback.allowCustomSize ? { allowCustomSize: true } : {}),
      ...(readString(value.customSizePlaceholder) || imageFallback.customSizePlaceholder
        ? { customSizePlaceholder: readString(value.customSizePlaceholder) || imageFallback.customSizePlaceholder }
        : {}),
      ...(isRecord(value.sizeConstraints) || imageFallback.sizeConstraints
        ? { sizeConstraints: normalizeImageSizeConstraints(value.sizeConstraints, imageFallback.sizeConstraints) }
        : {}),
      ...(resolutionOptions.length ? { resolutionOptions } : {}),
      ...(defaultImageResolution ? { defaultImageResolution } : {}),
      ...(defaultImageAspectRatio ? { defaultImageAspectRatio } : {}),
      imageQualities: imageQualities.length ? imageQualities : imageFallback.imageQualities,
      ...(readString(value.defaultImageQuality) || imageFallback.defaultImageQuality
        ? { defaultImageQuality: readString(value.defaultImageQuality) || imageFallback.defaultImageQuality }
        : {}),
      ...(outputFormats?.length ? { outputFormats } : {}),
      ...(normalizeImageOutputFormat(value.defaultOutputFormat, outputFormats || imageFallback.outputFormats) ? { defaultOutputFormat: normalizeImageOutputFormat(value.defaultOutputFormat, outputFormats || imageFallback.outputFormats) } : {}),
      ...(isRecord(value.outputCompression) || imageFallback.outputCompression
        ? { outputCompression: normalizeNumericParameterSchema(value.outputCompression, imageFallback.outputCompression || OPENAI_OUTPUT_COMPRESSION) }
        : {}),
      ...(responseFormats?.length ? { responseFormats } : {}),
      ...(normalizeImageResponseFormat(value.defaultImageResponseFormat, responseFormats || imageFallback.responseFormats) ? { defaultImageResponseFormat: normalizeImageResponseFormat(value.defaultImageResponseFormat, responseFormats || imageFallback.responseFormats) } : {}),
      ...(backgroundOptions?.length ? { backgroundOptions } : {}),
      ...(normalizeBackground(value.defaultBackground, backgroundOptions || imageFallback.backgroundOptions) ? { defaultBackground: normalizeBackground(value.defaultBackground, backgroundOptions || imageFallback.backgroundOptions) } : {}),
      ...(moderationOptions?.length ? { moderationOptions } : {}),
      ...(normalizeModeration(value.defaultModeration, moderationOptions || imageFallback.moderationOptions) ? { defaultModeration: normalizeModeration(value.defaultModeration, moderationOptions || imageFallback.moderationOptions) } : {}),
      ...(isRecord(value.watermark) || imageFallback.watermark ? { watermark: { defaultValue: readBoolean((isRecord(value.watermark) ? value.watermark.defaultValue : undefined), imageFallback.watermark?.defaultValue ?? true) } } : {}),
      ...(imageStyles?.length ? { imageStyles } : {}),
      ...(normalizeImageStyle(value.defaultImageStyle, imageStyles || imageFallback.imageStyles) ? { defaultImageStyle: normalizeImageStyle(value.defaultImageStyle, imageStyles || imageFallback.imageStyles) } : {}),
      ...(referenceInput ? { referenceInput } : {}),
    }
  }

  if (value.kind === 'text') {
    const textFallback = fallback.kind === 'text' ? fallback : DEFAULT_TEXT_SCHEMA
    const referenceInput = normalizeReferenceInputSupport(value.referenceInput, textFallback.referenceInput)
    return {
      kind: 'text',
      temperature: normalizeNumericParameterSchema(value.temperature, textFallback.temperature),
      maxTokens: normalizeNumericParameterSchema(value.maxTokens, textFallback.maxTokens),
      responseFormats: normalizeTextResponseFormats(value.responseFormats, textFallback.responseFormats),
      ...(textFallback.thinking ? { thinking: normalizeThinkingParameterSchema(value.thinking, textFallback.thinking) } : {}),
      ...(referenceInput ? { referenceInput } : {}),
    }
  }

  return fallback
}

export function normalizeAiModelPromptSurface(value: unknown, fallback: AiModelPromptSurface): AiModelPromptSurface {
  if (!isRecord(value)) return fallback

  if (value.kind === 'messages') {
    const supportedRoles = readStringArray(value.supportedRoles).filter((role): role is PromptMessageRole =>
      role === 'system' || role === 'user' || role === 'assistant' || role === 'tool',
    )
    const messageFallback = fallback.kind === 'messages' ? fallback : DEFAULT_TEXT_PROMPT_SURFACE
    return {
      kind: 'messages',
      supportedRoles: supportedRoles.length ? supportedRoles : messageFallback.supportedRoles,
    }
  }

  if (value.kind === 'image-prompt') {
    const imageFallback = fallback.kind === 'image-prompt' ? fallback : DEFAULT_IMAGE_PROMPT_SURFACE
    const styleInput = isRecord(value.styleInput) ? value.styleInput : {}
    const rawStyleType = readString(styleInput.type)
    const styleType: ImageStyleInputType =
      rawStyleType === 'preset' || rawStyleType === 'preset-with-extra-text' || rawStyleType === 'free-text'
        ? rawStyleType
        : imageFallback.styleInput.type
    const sourceOptions = Array.isArray(styleInput.options) ? styleInput.options : []
    const options = sourceOptions.flatMap((item): ImageStyleOption[] => {
      if (!isRecord(item)) return []
      const label = readString(item.label)
      const optionValue = readString(item.value)
      return label && optionValue ? [{ label, value: optionValue }] : []
    })
    return {
      kind: 'image-prompt',
      negativePrompt: value.negativePrompt === true || imageFallback.negativePrompt,
      styleInput: {
        type: styleType,
        ...(options.length ? { options } : imageFallback.styleInput.options?.length ? { options: imageFallback.styleInput.options } : {}),
      },
    }
  }

  return fallback
}

export function resolveAiModelParameterSchema(
  outputType: ZpmtOutputType,
  providerType?: string,
  modelId?: string,
  model?: AiProviderModel | null,
): AiModelParameterSchema {
  const preset = findAiModelPreset(providerType, modelId)
  const schema = model?.parameterSchema || preset?.parameterSchema
  if (schema?.kind === outputType) return schema
  return outputType === 'image' ? inferAiModelParameterSchema(providerType || '', modelId || '', ['image']) : DEFAULT_TEXT_SCHEMA
}

export function resolveAiModelPromptSurface(
  outputType: ZpmtOutputType,
  providerType?: string,
  modelId?: string,
  model?: AiProviderModel | null,
): AiModelPromptSurface {
  const preset = findAiModelPreset(providerType, modelId)
  const surface = model?.promptSurface || preset?.promptSurface
  if (surface && surface.kind === (outputType === 'image' ? 'image-prompt' : 'messages')) return surface
  return inferAiModelPromptSurface(providerType || '', modelId || '', [outputType])
}

export function defaultAiResponseConfig(
  outputType: ZpmtOutputType,
  providerType?: string,
  modelId?: string,
  model?: AiProviderModel | null,
): ZpmtResponseConfig {
  const schema = resolveAiModelParameterSchema(outputType, providerType, modelId, model)
  const preset = findAiModelPreset(providerType, modelId)
  const defaultConfig = model?.defaultResponseConfig || preset?.defaultResponseConfig || {}
  return normalizeAiResponseConfig(outputType, defaultConfig, providerType, modelId, model)
}

export function normalizeAiResponseConfig(
  outputType: ZpmtOutputType,
  value: unknown,
  providerType?: string,
  modelId?: string,
  model?: AiProviderModel | null,
): ZpmtResponseConfig {
  const schema = resolveAiModelParameterSchema(outputType, providerType, modelId, model)
  const source = isRecord(value) ? value : {}

  if (schema.kind === 'image') return normalizeImageResponseConfig(schema, source)

  const responseFormat = readString(source.responseFormat) === 'json_object' ? 'json_object' : 'text'
  return {
    temperature: clampNumber(readFiniteNumber(source.temperature, schema.temperature.defaultValue), schema.temperature.min, schema.temperature.max),
    maxTokens: Math.round(clampNumber(readFiniteNumber(source.maxTokens, schema.maxTokens.defaultValue), schema.maxTokens.min, schema.maxTokens.max)),
    responseFormat: schema.responseFormats.includes(responseFormat) ? responseFormat : schema.responseFormats[0] || 'text',
    ...(schema.thinking
      ? {
          thinkingMode: normalizeThinkingMode(source.thinkingMode, schema.thinking),
          ...(schema.thinking.efforts?.length
            ? { reasoningEffort: normalizeReasoningEffort(source.reasoningEffort, schema.thinking) }
            : {}),
        }
      : {}),
  }
}

export function getImageAspectRatioOptions(schema: ImageModelParameterSchema, resolution?: string) {
  const option = schema.resolutionOptions?.find((item) => item.resolution === resolution) || schema.resolutionOptions?.[0]
  return option?.sizes || []
}

export function getImageSizeForResolution(schema: ImageModelParameterSchema, resolution?: string, aspectRatio?: string) {
  const resolutionOption = schema.resolutionOptions?.find((item) => item.resolution === resolution) || schema.resolutionOptions?.[0]
  if (!resolutionOption) return schema.defaultImageSize
  const aspectOption =
    resolutionOption.sizes.find((item) => item.aspectRatio === aspectRatio) ||
    resolutionOption.sizes.find((item) => item.aspectRatio === schema.defaultImageAspectRatio) ||
    resolutionOption.sizes[0]
  return aspectOption?.size || schema.defaultImageSize
}

export function isCustomImageSize(value: string | undefined, schema: ImageModelParameterSchema) {
  if (!value) return false
  return !schema.sizeOptions.includes(value) && !findResolutionSizeBySize(schema, value) && isValidCustomImageSize(value, schema)
}

export function findAiModelPreset(providerType?: string, modelId?: string) {
  if (!modelId) return null
  const providerMatches = providerType ? AI_PROVIDER_PRESETS.filter((provider) => provider.providerType === providerType) : AI_PROVIDER_PRESETS
  for (const provider of providerMatches) {
    const model = provider.models.find((item) => item.id === modelId)
    if (model) return model
  }
  return null
}

export function listAiModelPresetOptions(preferredProviderType?: string): AiModelPresetOption[] {
  const preferred = preferredProviderType ? AI_PROVIDER_PRESETS.filter((provider) => provider.providerType === preferredProviderType) : []
  const remaining = AI_PROVIDER_PRESETS.filter((provider) => provider.providerType !== preferredProviderType)
  const seen = new Set<string>()

  return [...preferred, ...remaining].flatMap((provider) =>
    provider.models.flatMap((model) => {
      const key = `${provider.providerType}:${model.id}`
      if (seen.has(key)) return []
      seen.add(key)
      return [{ key, providerType: provider.providerType, providerName: provider.name, model }]
    }),
  )
}

export function findAiModelPresetOption(key: string) {
  return listAiModelPresetOptions().find((option) => option.key === key) || null
}

export function getAiModelPresetOptionKey(ref: AiModelPresetRef | null | undefined) {
  return ref?.providerType && ref.modelId ? `${ref.providerType}:${ref.modelId}` : ''
}

export function getAiModelPresetOptionKeyForModel(
  providerType: string | undefined,
  model: { id?: string; presetRef?: AiModelPresetRef | null } | null | undefined,
) {
  const explicitKey = getAiModelPresetOptionKey(model?.presetRef)
  if (explicitKey && findAiModelPresetOption(explicitKey)) return explicitKey
  const modelId = readString(model?.id)
  if (!modelId) return ''
  return listAiModelPresetOptions(providerType).find((option) => option.model.id === modelId)?.key || ''
}

export function createAiModelPresetRef(option: AiModelPresetOption): AiModelPresetRef {
  return {
    providerType: option.providerType,
    providerName: option.providerName,
    modelId: option.model.id,
  }
}

export function normalizeAiModelPresetRef(value: unknown): AiModelPresetRef | undefined {
  if (!isRecord(value)) return undefined
  const providerType = readString(value.providerType).toLowerCase()
  const modelId = readString(value.modelId)
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(providerType) || !modelId) return undefined
  return {
    providerType,
    ...(readString(value.providerName) ? { providerName: readString(value.providerName) } : {}),
    modelId: modelId.slice(0, 96),
  }
}

export function hasAiModelPreset(providerType: string | undefined, modelId: string) {
  return Boolean(findAiModelPreset(providerType, modelId) || findAiModelPreset(undefined, modelId))
}

export function applyAiModelPreset<
  T extends {
    id: string
    capabilities: AiModelCapability[]
    toolCalling: ToolCallingSupport
    parameterSchema?: unknown
    promptSurface?: unknown
    defaultResponseConfig?: unknown
    presetRef?: AiModelPresetRef
  },
>(model: T, preset: AiProviderModel, presetRef?: AiModelPresetRef): T {
  const promptSurface = preset.promptSurface || inferAiModelPromptSurface(presetRef?.providerType || '', preset.id, preset.capabilities)
  const next = {
    ...model,
    capabilities: [...preset.capabilities],
    toolCalling: preset.toolCalling,
    parameterSchema: preset.parameterSchema,
    promptSurface,
    ...(presetRef ? { presetRef } : {}),
  } as T

  if (preset.defaultResponseConfig) {
    next.defaultResponseConfig = preset.defaultResponseConfig
  } else {
    delete next.defaultResponseConfig
  }

  return next as T
}

export function aiModelSupportsThinking(model: { parameterSchema?: unknown } | null | undefined) {
  const schema = model?.parameterSchema
  return isRecord(schema) && schema.kind === 'text' && Boolean(schema.thinking)
}

export function aiModelSupportsReferenceImage(model: { parameterSchema?: unknown } | null | undefined) {
  return readReferenceInputSupport(model).image === true
}

export function aiModelSupportsReferenceFile(model: { parameterSchema?: unknown } | null | undefined) {
  return readReferenceInputSupport(model).file === true
}

function readReferenceInputSupport(model: { parameterSchema?: unknown } | null | undefined): ReferenceInputSupport {
  const schema = model?.parameterSchema
  const referenceInput = isRecord(schema) ? schema.referenceInput : undefined
  return normalizeReferenceInputSupport(referenceInput) || {}
}

function normalizeImageResponseConfig(schema: ImageModelParameterSchema, source: Record<string, unknown>): ZpmtResponseConfig {
  const sizeConfig = normalizeImageSizeConfig(schema, source)
  const imageCount = schema.imageCount || IMAGE_COUNT_1_TO_10
  const outputFormat = normalizeImageOutputFormat(source.imageOutputFormat, schema.outputFormats) || schema.defaultOutputFormat || schema.outputFormats?.[0]
  const responseFormat =
    normalizeImageResponseFormat(source.imageResponseFormat, schema.responseFormats) ||
    schema.defaultImageResponseFormat ||
    schema.responseFormats?.[0]
  const background = normalizeBackground(source.imageBackground, schema.backgroundOptions) || schema.defaultBackground || schema.backgroundOptions?.[0]
  const moderation = normalizeModeration(source.imageModeration, schema.moderationOptions) || schema.defaultModeration || schema.moderationOptions?.[0]
  const imageStyle = normalizeImageStyle(source.imageStyle, schema.imageStyles) || schema.defaultImageStyle || schema.imageStyles?.[0]
  const imageQuality = normalizeStringOption(source.imageQuality, schema.imageQualities, schema.defaultImageQuality || schema.imageQualities[0])

  return {
    ...sizeConfig,
    imageCount: Math.round(clampNumber(readFiniteNumber(source.imageCount, imageCount.defaultValue), imageCount.min, imageCount.max)),
    ...(imageQuality ? { imageQuality } : {}),
    ...(outputFormat ? { imageOutputFormat: outputFormat } : {}),
    ...(schema.outputCompression && outputFormat && isCompressibleImageFormat(outputFormat)
      ? {
          imageOutputCompression: Math.round(
            clampNumber(
              readFiniteNumber(source.imageOutputCompression, schema.outputCompression.defaultValue),
              schema.outputCompression.min,
              schema.outputCompression.max,
            ),
          ),
        }
      : {}),
    ...(responseFormat ? { imageResponseFormat: responseFormat } : {}),
    ...(background ? { imageBackground: background } : {}),
    ...(moderation ? { imageModeration: moderation } : {}),
    ...(schema.watermark ? { watermark: readBoolean(source.watermark, schema.watermark.defaultValue) } : {}),
    ...(imageStyle ? { imageStyle } : {}),
  }
}

function normalizeImageSizeConfig(schema: ImageModelParameterSchema, source: Record<string, unknown>): ZpmtResponseConfig {
  const rawSize = readString(source.imageSize)

  if (schema.sizeMode === 'resolution_ratio') {
    const defaultResolution = schema.defaultImageResolution || schema.resolutionOptions?.[0]?.resolution || ''
    const defaultAspectRatio =
      schema.defaultImageAspectRatio ||
      schema.resolutionOptions?.find((item) => item.resolution === defaultResolution)?.sizes[0]?.aspectRatio ||
      schema.resolutionOptions?.[0]?.sizes[0]?.aspectRatio ||
      ''
    const fromResolution = findResolutionSize(schema, readString(source.imageResolution), readString(source.imageAspectRatio))
    const fromSize = rawSize ? findResolutionSizeBySize(schema, rawSize) : null
    const fromLegacyResolution = rawSize ? findResolutionSize(schema, rawSize, readString(source.imageAspectRatio) || defaultAspectRatio) : null
    const selected = fromResolution || fromSize || fromLegacyResolution || findResolutionSize(schema, defaultResolution, defaultAspectRatio)
    return {
      imageResolution: selected?.resolution || defaultResolution,
      imageAspectRatio: selected?.aspectRatio || defaultAspectRatio,
      imageSize: selected?.size || schema.defaultImageSize,
    }
  }

  if (rawSize && schema.sizeOptions.includes(rawSize)) return { imageSize: rawSize }
  if (rawSize && isValidCustomImageSize(rawSize, schema)) return { imageSize: rawSize }
  return { imageSize: schema.defaultImageSize || schema.sizeOptions[0] || '' }
}

function findResolutionSize(schema: ImageModelParameterSchema, resolution: string, aspectRatio: string) {
  const resolutionOption = schema.resolutionOptions?.find((item) => item.resolution === resolution)
  const sizeOption = resolutionOption?.sizes.find((item) => item.aspectRatio === aspectRatio)
  return resolutionOption && sizeOption
    ? { resolution: resolutionOption.resolution, aspectRatio: sizeOption.aspectRatio, size: sizeOption.size }
    : null
}

function findResolutionSizeBySize(schema: ImageModelParameterSchema, size: string) {
  for (const resolutionOption of schema.resolutionOptions || []) {
    for (const sizeOption of resolutionOption.sizes) {
      if (sizeOption.size === size) return { resolution: resolutionOption.resolution, aspectRatio: sizeOption.aspectRatio, size: sizeOption.size }
    }
  }
  return null
}

function isValidCustomImageSize(value: string, schema: ImageModelParameterSchema) {
  if (!schema.allowCustomSize || !value) return false
  const dimensions = parseDimensions(value)
  if (!dimensions) return false
  const { width, height } = dimensions
  const constraints = schema.sizeConstraints
  if (!constraints) return true
  const pixels = width * height
  const longSide = Math.max(width, height)
  const shortSide = Math.min(width, height)
  if (constraints.minPixels && pixels < constraints.minPixels) return false
  if (constraints.maxPixels && pixels > constraints.maxPixels) return false
  if (constraints.maxEdge && longSide > constraints.maxEdge) return false
  if (constraints.minEdge && shortSide < constraints.minEdge) return false
  if (constraints.multipleOf && (width % constraints.multipleOf !== 0 || height % constraints.multipleOf !== 0)) return false
  if (constraints.maxLongShortRatio && longSide / shortSide > constraints.maxLongShortRatio) return false
  return true
}

function parseDimensions(value: string) {
  const match = value.match(/^(\d{2,5})x(\d{2,5})$/i)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

function isCompressibleImageFormat(format: ImageOutputFormat) {
  return format === 'jpeg' || format === 'webp'
}

function readFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeNumericParameterSchema(value: unknown, fallback: NumericParameterSchema): NumericParameterSchema {
  const source = isRecord(value) ? value : {}
  const min = readFiniteNumber(source.min, fallback.min)
  const max = readFiniteNumber(source.max, fallback.max)
  return {
    min,
    max,
    step: readFiniteNumber(source.step, fallback.step),
    defaultValue: clampNumber(readFiniteNumber(source.defaultValue, fallback.defaultValue), min, max),
  }
}

function normalizeImageSizeConstraints(value: unknown, fallback?: ImageSizeConstraints): ImageSizeConstraints {
  const source = isRecord(value) ? value : {}
  return {
    ...(readFiniteNumber(source.minPixels, fallback?.minPixels || 0) ? { minPixels: readFiniteNumber(source.minPixels, fallback?.minPixels || 0) } : {}),
    ...(readFiniteNumber(source.maxPixels, fallback?.maxPixels || 0) ? { maxPixels: readFiniteNumber(source.maxPixels, fallback?.maxPixels || 0) } : {}),
    ...(readFiniteNumber(source.maxEdge, fallback?.maxEdge || 0) ? { maxEdge: readFiniteNumber(source.maxEdge, fallback?.maxEdge || 0) } : {}),
    ...(readFiniteNumber(source.minEdge, fallback?.minEdge || 0) ? { minEdge: readFiniteNumber(source.minEdge, fallback?.minEdge || 0) } : {}),
    ...(readFiniteNumber(source.multipleOf, fallback?.multipleOf || 0) ? { multipleOf: readFiniteNumber(source.multipleOf, fallback?.multipleOf || 0) } : {}),
    ...(readFiniteNumber(source.maxLongShortRatio, fallback?.maxLongShortRatio || 0)
      ? { maxLongShortRatio: readFiniteNumber(source.maxLongShortRatio, fallback?.maxLongShortRatio || 0) }
      : {}),
  }
}

function normalizeTextResponseFormats(value: unknown, fallback: ZpmtResponseFormat[]) {
  const formats = Array.isArray(value)
    ? value.filter((item): item is ZpmtResponseFormat => item === 'text' || item === 'json_object')
    : []
  return formats.length ? formats : fallback
}

function normalizeReferenceInputSupport(value: unknown, fallback?: ReferenceInputSupport): ReferenceInputSupport | undefined {
  const source = isRecord(value) ? value : {}
  const image = typeof source.image === 'boolean' ? source.image : fallback?.image
  const file = typeof source.file === 'boolean' ? source.file : fallback?.file
  if (image === undefined && file === undefined) return undefined
  return {
    ...(image !== undefined ? { image } : {}),
    ...(file !== undefined ? { file } : {}),
  }
}

function normalizeThinkingParameterSchema(value: unknown, fallback: ThinkingParameterSchema): ThinkingParameterSchema {
  const source = isRecord(value) ? value : {}
  const modes = Array.isArray(source.modes)
    ? source.modes.filter((item): item is ThinkingMode => item === 'enabled' || item === 'disabled' || item === 'auto')
    : []
  const efforts = Array.isArray(source.efforts)
    ? source.efforts.filter((item): item is ReasoningEffort =>
        item === 'none' || item === 'low' || item === 'medium' || item === 'high' || item === 'xhigh' || item === 'max',
      )
    : []
  const defaultMode = source.defaultMode === 'enabled' || source.defaultMode === 'disabled' || source.defaultMode === 'auto'
    ? source.defaultMode
    : fallback.defaultMode
  const defaultEffort =
    source.defaultEffort === 'none' ||
    source.defaultEffort === 'low' ||
    source.defaultEffort === 'medium' ||
    source.defaultEffort === 'high' ||
    source.defaultEffort === 'xhigh' ||
    source.defaultEffort === 'max'
      ? source.defaultEffort
      : fallback.defaultEffort

  return {
    modes: modes.length ? modes : fallback.modes,
    defaultMode,
    ...(efforts.length || fallback.efforts?.length ? { efforts: efforts.length ? efforts : fallback.efforts } : {}),
    ...(defaultEffort ? { defaultEffort } : {}),
    apiStyle:
      source.apiStyle === 'openai_reasoning' || source.apiStyle === 'deepseek_thinking' || source.apiStyle === 'volcengine_thinking'
        ? source.apiStyle
        : fallback.apiStyle,
  }
}

function normalizeThinkingMode(value: unknown, schema: ThinkingParameterSchema): ThinkingMode {
  return schema.modes.includes(value as ThinkingMode) ? (value as ThinkingMode) : schema.defaultMode
}

function normalizeReasoningEffort(value: unknown, schema: ThinkingParameterSchema): ReasoningEffort {
  const fallback = schema.defaultEffort || schema.efforts?.[0] || 'medium'
  return schema.efforts?.includes(value as ReasoningEffort) ? (value as ReasoningEffort) : fallback
}

function normalizeImageOutputFormats(value: unknown, fallback?: ImageOutputFormat[]) {
  const formats = Array.isArray(value)
    ? value.filter((item): item is ImageOutputFormat => item === 'png' || item === 'jpeg' || item === 'webp')
    : []
  return formats.length ? formats : fallback
}

export function normalizeToolCallingSupport(value: unknown, fallback: ToolCallingSupport = 'unknown'): ToolCallingSupport {
  const normalized = readString(value).toLowerCase()
  if (normalized === 'supported' || normalized === 'tools' || normalized === 'tool' || normalized === 'true') return 'supported'
  if (normalized === 'unsupported' || normalized === 'no-tools' || normalized === 'none' || normalized === 'false') return 'unsupported'
  if (normalized === 'unknown' || normalized === 'auto') return 'unknown'
  return fallback
}

function parseToolCalling(value: unknown): ToolCallingSupport | undefined {
  const normalized = readString(value)
  if (!normalized) return undefined
  return normalizeToolCallingSupport(normalized)
}

function serializeToolCalling(value: ToolCallingSupport) {
  if (value === 'supported') return 'tools'
  if (value === 'unsupported') return 'no-tools'
  return 'unknown'
}

function normalizeImageResponseFormats(value: unknown, fallback?: ImageResponseFormat[]) {
  const formats = Array.isArray(value)
    ? value.filter((item): item is ImageResponseFormat => item === 'url' || item === 'b64_json')
    : []
  return formats.length ? formats : fallback
}

function normalizeBackgroundOptions(value: unknown, fallback?: ImageBackground[]) {
  const options = Array.isArray(value)
    ? value.filter((item): item is ImageBackground => item === 'auto' || item === 'opaque' || item === 'transparent')
    : []
  return options.length ? options : fallback
}

function normalizeModerationOptions(value: unknown, fallback?: ImageModeration[]) {
  const options = Array.isArray(value) ? value.filter((item): item is ImageModeration => item === 'auto' || item === 'low') : []
  return options.length ? options : fallback
}

function normalizeImageStyles(value: unknown, fallback?: ImageStyle[]) {
  const options = Array.isArray(value) ? value.filter((item): item is ImageStyle => item === 'vivid' || item === 'natural') : []
  return options.length ? options : fallback
}

function normalizeResolutionOptions(value: unknown, fallback?: ImageResolutionOption[]) {
  const options = Array.isArray(value)
    ? value.flatMap((item): ImageResolutionOption[] => {
        if (!isRecord(item)) return []
        const resolution = readString(item.resolution)
        const sizes = Array.isArray(item.sizes)
          ? item.sizes.flatMap((sizeItem): ImageAspectRatioSize[] => {
              if (!isRecord(sizeItem)) return []
              const aspectRatio = readString(sizeItem.aspectRatio)
              const size = readString(sizeItem.size)
              return aspectRatio && parseDimensions(size) ? [{ aspectRatio, size }] : []
            })
          : []
        return resolution && sizes.length ? [{ resolution, sizes }] : []
      })
    : []
  return options.length ? options : fallback || []
}

function normalizeImageOutputFormat(value: unknown, options?: ImageOutputFormat[]) {
  const normalized = readString(value)
  return options?.includes(normalized as ImageOutputFormat) ? (normalized as ImageOutputFormat) : undefined
}

function normalizeImageResponseFormat(value: unknown, options?: ImageResponseFormat[]) {
  const normalized = readString(value)
  return options?.includes(normalized as ImageResponseFormat) ? (normalized as ImageResponseFormat) : undefined
}

function normalizeBackground(value: unknown, options?: ImageBackground[]) {
  const normalized = readString(value)
  return options?.includes(normalized as ImageBackground) ? (normalized as ImageBackground) : undefined
}

function normalizeModeration(value: unknown, options?: ImageModeration[]) {
  const normalized = readString(value)
  return options?.includes(normalized as ImageModeration) ? (normalized as ImageModeration) : undefined
}

function normalizeImageStyle(value: unknown, options?: ImageStyle[]) {
  const normalized = readString(value)
  return options?.includes(normalized as ImageStyle) ? (normalized as ImageStyle) : undefined
}

function normalizeStringOption(value: unknown, options: string[] | undefined, fallback?: string) {
  const normalized = readString(value)
  if (normalized && options?.includes(normalized)) return normalized
  return fallback && options?.includes(fallback) ? fallback : undefined
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : []
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return fallback
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isImageSizeMode(value: unknown): value is ImageSizeMode {
  return value === 'fixed_options' || value === 'custom_constraints' || value === 'resolution_ratio' || value === 'adaptive'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
