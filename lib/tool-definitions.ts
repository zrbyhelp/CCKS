export type LocaleText = {
  zh: string
  en: string
}

export type AiToolFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select'

export type AiToolFieldOption = {
  value: string
  label: LocaleText
}

export type AiToolField = {
  name: string
  type: AiToolFieldType
  label: LocaleText
  placeholder?: LocaleText
  helper?: LocaleText
  required?: boolean
  secret?: boolean
  defaultValue?: string | number | boolean
  options?: AiToolFieldOption[]
}

export type AiToolConfigScope = 'binding' | 'input' | 'runtime'

export type AiToolDefinition = {
  id: string
  toolName: string
  name: LocaleText
  description: LocaleText
  candidates: Record<'zh' | 'en', string[]>
  multiple: boolean
  categoryId: string
  requiresConfig: boolean
  supportsBatch: boolean
  /**
   * System limits saved with the .zpmt binding.
   * AI-generated invocation arguments belong in inputFields.
   */
  fields: AiToolField[]
  inputFields: AiToolField[]
}

export type AiToolCategory = {
  id: string
  name: LocaleText
  description: LocaleText
  variables: AiToolDefinition[]
}

export type AiToolConfig = Record<string, string | number | boolean>

export type AiToolFunctionSchema = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, Record<string, unknown>>
      required: string[]
      additionalProperties: false
    }
  }
}

export const AI_TOOL_SCHEMA_VERSION = 1

const LANGUAGE_OPTIONS: AiToolFieldOption[] = [
  { value: 'zh', label: { zh: '中文', en: 'Chinese' } },
  { value: 'en', label: { zh: '英文', en: 'English' } },
]

const WEATHER_UNIT_OPTIONS: AiToolFieldOption[] = [
  { value: 'celsius', label: { zh: '摄氏度', en: 'Celsius' } },
  { value: 'fahrenheit', label: { zh: '华氏度', en: 'Fahrenheit' } },
]

export const AI_TOOL_CATEGORIES: AiToolCategory[] = [
  {
    id: 'system-info',
    name: { zh: '系统信息', en: 'System Info' },
    description: { zh: '提供 Agent 可调用的时间和时区工具', en: 'Time and timezone tools callable by the agent' },
    variables: [
      {
        id: 'system.current_time',
        toolName: 'get_current_time',
        categoryId: 'system-info',
        name: { zh: '当前日期和时间', en: 'Current date and time' },
        description: { zh: '让 Agent 获取指定时区的当前时间、星期和时间戳', en: 'Let the agent read current time, weekday, and timestamp for a timezone' },
        candidates: { zh: ['当前时间', '时区默认值', '星期', '时间戳'], en: ['current time', 'timezone default', 'weekday', 'timestamp'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [],
        inputFields: [
          {
            name: 'timezone',
            type: 'text',
            label: { zh: '时区', en: 'Timezone' },
            placeholder: { zh: 'Asia/Shanghai，留空使用服务端默认值', en: 'Asia/Shanghai, blank for server default' },
          },
          {
            name: 'locale',
            type: 'select',
            label: { zh: '语言', en: 'Language' },
            defaultValue: 'zh',
            options: LANGUAGE_OPTIONS,
          },
        ],
      },
      {
        id: 'system.timezone',
        toolName: 'get_timezone_info',
        categoryId: 'system-info',
        name: { zh: '时区信息', en: 'Timezone info' },
        description: { zh: '让 Agent 查询指定时区的 UTC 偏移和夏令时信息', en: 'Let the agent inspect UTC offset and DST information for a timezone' },
        candidates: { zh: ['IANA 时区', 'UTC 偏移', '夏令时', '运行环境'], en: ['IANA timezone', 'UTC offset', 'DST', 'runtime'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [],
        inputFields: [
          {
            name: 'timezone',
            type: 'text',
            label: { zh: '时区', en: 'Timezone' },
            placeholder: { zh: '留空自动检测', en: 'Blank for auto-detect' },
          },
        ],
      },
    ],
  },
  {
    id: 'network-search',
    name: { zh: '网络与数据', en: 'Network and Data' },
    description: { zh: '给 Agent 增加外部检索、网页读取、天气和地理能力', en: 'Give the agent search, fetch, weather, and geocoding capabilities' },
    variables: [
      {
        id: 'web.search',
        toolName: 'web_search',
        categoryId: 'network-search',
        name: { zh: 'Web 搜索', en: 'Web search' },
        description: { zh: '允许 Agent 通过 Brave Search 检索网页结果', en: 'Allow the agent to search web results through Brave Search' },
        candidates: { zh: ['Brave Search', '搜索关键词由 AI 生成', '标题', '摘要', 'URL'], en: ['Brave Search', 'AI supplies query', 'title', 'snippet', 'URL'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: true,
        fields: [
          { name: 'count', type: 'number', label: { zh: '最大结果数', en: 'Max result count' }, defaultValue: 5 },
          {
            name: 'braveSearchApiKey',
            type: 'text',
            label: { zh: 'Brave Search API Key', en: 'Brave Search API Key' },
            placeholder: { zh: '由用户在当前文件内填写', en: 'Filled by the user in this file' },
            required: true,
            secret: true,
          },
        ],
        inputFields: [
          {
            name: 'query',
            type: 'text',
            label: { zh: '搜索关键词', en: 'Search query' },
            placeholder: { zh: '由 Agent 生成，例如 Next.js App Router', en: 'Supplied by agent, e.g. Next.js App Router' },
            required: true,
          },
          {
            name: 'queries',
            type: 'textarea',
            label: { zh: '并发关键词', en: 'Batch queries' },
            placeholder: { zh: '每行一个关键词，填写后优先使用', en: 'One query per line; overrides single query' },
            helper: { zh: '调试或批量任务可用，最多并发 5 条。', en: 'Useful for debugging or batch tasks, up to 5 concurrent queries.' },
          },
          { name: 'country', type: 'text', label: { zh: '国家代码', en: 'Country' }, defaultValue: 'US' },
          { name: 'language', type: 'select', label: { zh: '语言', en: 'Language' }, defaultValue: 'zh', options: LANGUAGE_OPTIONS },
        ],
      },
      {
        id: 'web.fetch',
        toolName: 'fetch_web_content',
        categoryId: 'network-search',
        name: { zh: 'Web 内容获取', en: 'Web content fetch' },
        description: { zh: '允许 Agent 抽取指定网页正文内容', en: 'Allow the agent to extract readable text from a web page' },
        candidates: { zh: ['Jina Reader', 'URL 由 AI 生成', '网页正文', 'Markdown'], en: ['Jina Reader', 'AI supplies URL', 'page text', 'Markdown'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: true,
        fields: [
          { name: 'maxChars', type: 'number', label: { zh: '最大字符数', en: 'Max characters' }, defaultValue: 12000 },
          {
            name: 'jinaApiKey',
            type: 'text',
            label: { zh: 'Jina API Key', en: 'Jina API Key' },
            placeholder: { zh: '可选，使用 Jina Reader 鉴权时填写', en: 'Optional, for authenticated Jina Reader calls' },
            secret: true,
          },
        ],
        inputFields: [
          { name: 'url', type: 'text', label: { zh: 'URL', en: 'URL' }, placeholder: { zh: 'https://example.com', en: 'https://example.com' }, required: true },
          { name: 'urls', type: 'textarea', label: { zh: '并发 URL', en: 'Batch URLs' }, placeholder: { zh: '每行一个 URL，填写后优先使用', en: 'One URL per line; overrides single URL' } },
        ],
      },
      {
        id: 'wiki.search',
        toolName: 'wikipedia_search',
        categoryId: 'network-search',
        name: { zh: '并发维基百科', en: 'Concurrent Wikipedia' },
        description: { zh: '允许 Agent 通过 Wikimedia 搜索百科页面', en: 'Allow the agent to search Wikipedia pages through Wikimedia' },
        candidates: { zh: ['Wikipedia', '关键词由 AI 生成', '摘要', '页面链接'], en: ['Wikipedia', 'AI supplies query', 'summary', 'page URL'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: true,
        fields: [
          { name: 'limit', type: 'number', label: { zh: '最大结果数', en: 'Max result count' }, defaultValue: 5 },
          {
            name: 'wikimediaUserAgent',
            type: 'text',
            label: { zh: 'Wikimedia User-Agent', en: 'Wikimedia User-Agent' },
            placeholder: { zh: '例如 ccks/1.0 (contact@example.com)', en: 'e.g. ccks/1.0 (contact@example.com)' },
          },
          {
            name: 'wikimediaAccessToken',
            type: 'text',
            label: { zh: 'Wikimedia Access Token', en: 'Wikimedia Access Token' },
            placeholder: { zh: '可选', en: 'Optional' },
            secret: true,
          },
        ],
        inputFields: [
          { name: 'query', type: 'text', label: { zh: '关键词', en: 'Query' }, required: true },
          { name: 'queries', type: 'textarea', label: { zh: '并发关键词', en: 'Batch queries' }, placeholder: { zh: '每行一个关键词', en: 'One query per line' } },
          { name: 'language', type: 'select', label: { zh: '语言', en: 'Language' }, defaultValue: 'zh', options: LANGUAGE_OPTIONS },
        ],
      },
      {
        id: 'weather.forecast',
        toolName: 'get_weather_forecast',
        categoryId: 'network-search',
        name: { zh: '天气', en: 'Weather' },
        description: { zh: '允许 Agent 查询地点的当前天气和短期预报', en: 'Allow the agent to query current weather and short forecasts' },
        candidates: { zh: ['Open-Meteo', '地点由 AI 生成', '当前天气', '预报'], en: ['Open-Meteo', 'AI supplies location', 'current weather', 'forecast'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: true,
        fields: [
          { name: 'forecastDays', type: 'number', label: { zh: '最大预报天数', en: 'Max forecast days' }, defaultValue: 3 },
        ],
        inputFields: [
          { name: 'location', type: 'text', label: { zh: '地点', en: 'Location' }, placeholder: { zh: '上海 / San Francisco', en: 'Shanghai / San Francisco' }, required: true },
          { name: 'locations', type: 'textarea', label: { zh: '并发地点', en: 'Batch locations' }, placeholder: { zh: '每行一个地点，填写后优先使用', en: 'One location per line; overrides single location' } },
          { name: 'temperatureUnit', type: 'select', label: { zh: '温度单位', en: 'Temperature unit' }, defaultValue: 'celsius', options: WEATHER_UNIT_OPTIONS },
          { name: 'language', type: 'select', label: { zh: '语言', en: 'Language' }, defaultValue: 'zh', options: LANGUAGE_OPTIONS },
        ],
      },
      {
        id: 'geo.geocode',
        toolName: 'geocode_location',
        categoryId: 'network-search',
        name: { zh: '地图 / 地理', en: 'Map / geocoding' },
        description: { zh: '允许 Agent 通过 Mapbox 做地址转坐标或坐标反查', en: 'Allow the agent to use Mapbox for forward or reverse geocoding' },
        candidates: { zh: ['Mapbox', '地址由 AI 生成', '反向地理编码', '坐标'], en: ['Mapbox', 'AI supplies address', 'reverse geocoding', 'coordinates'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [
          { name: 'limit', type: 'number', label: { zh: '最大结果数', en: 'Max result count' }, defaultValue: 5 },
          {
            name: 'mapboxAccessToken',
            type: 'text',
            label: { zh: 'Mapbox Access Token', en: 'Mapbox Access Token' },
            placeholder: { zh: '由用户在当前文件内填写', en: 'Filled by the user in this file' },
            required: true,
            secret: true,
          },
        ],
        inputFields: [
          {
            name: 'mode',
            type: 'select',
            label: { zh: '模式', en: 'Mode' },
            defaultValue: 'forward',
            options: [
              { value: 'forward', label: { zh: '地址转坐标', en: 'Forward' } },
              { value: 'reverse', label: { zh: '坐标反查', en: 'Reverse' } },
            ],
          },
          { name: 'query', type: 'text', label: { zh: '地址 / 地点', en: 'Address / place' }, placeholder: { zh: '上海市黄浦区', en: 'San Francisco' } },
          { name: 'longitude', type: 'number', label: { zh: '经度', en: 'Longitude' } },
          { name: 'latitude', type: 'number', label: { zh: '纬度', en: 'Latitude' } },
          { name: 'language', type: 'select', label: { zh: '语言', en: 'Language' }, defaultValue: 'zh', options: LANGUAGE_OPTIONS },
        ],
      },
    ],
  },
  {
    id: 'external-tools',
    name: { zh: '外部动作', en: 'External Actions' },
    description: { zh: '给 Agent 增加邮箱、邮件发送和文件生成动作', en: 'Give the agent email and file generation actions' },
    variables: [
      {
        id: 'email.temp_create',
        toolName: 'create_temp_email',
        categoryId: 'external-tools',
        name: { zh: '临时邮箱创建', en: 'Create temp email' },
        description: { zh: '允许 Agent 创建临时收件地址', en: 'Allow the agent to create a temporary inbox address' },
        candidates: { zh: ['Cloudflare Temp Email', '邮箱前缀由 AI 生成', '域名默认值', '收件箱'], en: ['Cloudflare Temp Email', 'AI supplies prefix', 'domain default', 'inbox'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [
          {
            name: 'tempEmailBaseUrl',
            type: 'text',
            label: { zh: '临时邮箱服务地址', en: 'Temp email service URL' },
            placeholder: { zh: 'https://your-worker.example.com', en: 'https://your-worker.example.com' },
            required: true,
          },
          {
            name: 'tempEmailAdminAuth',
            type: 'text',
            label: { zh: 'Admin Auth', en: 'Admin Auth' },
            placeholder: { zh: '可选，创建邮箱走 admin 接口时填写', en: 'Optional, for admin create endpoint' },
            secret: true,
          },
          {
            name: 'tempEmailCustomAuth',
            type: 'text',
            label: { zh: 'Custom Auth', en: 'Custom Auth' },
            placeholder: { zh: '可选，服务要求自定义鉴权时填写', en: 'Optional, when the service requires custom auth' },
            secret: true,
          },
        ],
        inputFields: [
          { name: 'name', type: 'text', label: { zh: '邮箱前缀', en: 'Email prefix' }, placeholder: { zh: '留空随机生成', en: 'Blank for random' } },
          { name: 'domain', type: 'text', label: { zh: '域名', en: 'Domain' }, placeholder: { zh: '留空使用 Worker 默认域名', en: 'Blank for worker default' } },
        ],
      },
      {
        id: 'email.temp_get',
        toolName: 'read_temp_email',
        categoryId: 'external-tools',
        name: { zh: '临时邮箱获取', en: 'Read temp email' },
        description: { zh: '允许 Agent 读取临时邮箱收件箱或指定邮件详情', en: 'Allow the agent to read an inbox or message from a temporary email service' },
        candidates: { zh: ['收件箱', '邮件详情', 'Address JWT 由 AI 传入', '轮询'], en: ['inbox', 'message detail', 'AI supplies address JWT', 'polling'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [
          { name: 'limit', type: 'number', label: { zh: '最大列表数量', en: 'Max list limit' }, defaultValue: 10 },
          {
            name: 'tempEmailBaseUrl',
            type: 'text',
            label: { zh: '临时邮箱服务地址', en: 'Temp email service URL' },
            placeholder: { zh: 'https://your-worker.example.com', en: 'https://your-worker.example.com' },
            required: true,
          },
          {
            name: 'tempEmailCustomAuth',
            type: 'text',
            label: { zh: 'Custom Auth', en: 'Custom Auth' },
            placeholder: { zh: '可选，服务要求自定义鉴权时填写', en: 'Optional, when the service requires custom auth' },
            secret: true,
          },
        ],
        inputFields: [
          { name: 'address', type: 'text', label: { zh: '邮箱地址', en: 'Email address' }, required: true },
          { name: 'addressJwt', type: 'text', label: { zh: 'Address JWT', en: 'Address JWT' }, placeholder: { zh: '创建邮箱返回的 jwt', en: 'jwt returned when creating the mailbox' }, required: true },
          { name: 'mailId', type: 'text', label: { zh: '邮件 ID', en: 'Mail ID' }, placeholder: { zh: '留空返回列表', en: 'Blank to list inbox' } },
        ],
      },
      {
        id: 'email.send',
        toolName: 'send_email',
        categoryId: 'external-tools',
        name: { zh: '邮件发送', en: 'Send email' },
        description: { zh: '允许 Agent 通过 Resend 发送文本或 HTML 邮件', en: 'Allow the agent to send text or HTML email through Resend' },
        candidates: { zh: ['Resend', '收件人由 AI 生成', '主题', '正文'], en: ['Resend', 'AI supplies recipients', 'subject', 'body'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [
          {
            name: 'resendApiKey',
            type: 'text',
            label: { zh: 'Resend API Key', en: 'Resend API Key' },
            placeholder: { zh: '由用户在当前文件内填写', en: 'Filled by the user in this file' },
            required: true,
            secret: true,
          },
          {
            name: 'resendFromEmail',
            type: 'text',
            label: { zh: '发件人邮箱', en: 'From email' },
            placeholder: { zh: 'noreply@example.com', en: 'noreply@example.com' },
            required: true,
          },
        ],
        inputFields: [
          { name: 'to', type: 'text', label: { zh: '收件人', en: 'To' }, placeholder: { zh: 'a@example.com, b@example.com', en: 'a@example.com, b@example.com' }, required: true },
          { name: 'subject', type: 'text', label: { zh: '主题', en: 'Subject' }, required: true },
          { name: 'text', type: 'textarea', label: { zh: '文本正文', en: 'Text body' }, required: true },
          { name: 'html', type: 'textarea', label: { zh: 'HTML 正文', en: 'HTML body' }, placeholder: { zh: '可选', en: 'Optional' } },
          { name: 'replyTo', type: 'text', label: { zh: '回复地址', en: 'Reply-To' } },
        ],
      },
      {
        id: 'file.generate',
        toolName: 'generate_file',
        categoryId: 'external-tools',
        name: { zh: '文件生成', en: 'Generate file' },
        description: { zh: '允许 Agent 生成可下载文件，不直接写入本地项目', en: 'Allow the agent to generate a downloadable file without writing to the local project' },
        candidates: { zh: ['下载文件', '文件名由 AI 生成', 'Markdown', 'JSON'], en: ['download file', 'AI supplies filename', 'Markdown', 'JSON'] },
        multiple: true,
        requiresConfig: false,
        supportsBatch: false,
        fields: [],
        inputFields: [
          { name: 'filename', type: 'text', label: { zh: '文件名', en: 'Filename' }, placeholder: { zh: 'result.md', en: 'result.md' }, required: true },
          { name: 'content', type: 'textarea', label: { zh: '文件内容', en: 'Content' }, required: true },
          {
            name: 'mimeType',
            type: 'select',
            label: { zh: '文件类型', en: 'MIME type' },
            defaultValue: 'text/plain;charset=utf-8',
            options: [
              { value: 'text/plain;charset=utf-8', label: { zh: '纯文本', en: 'Plain text' } },
              { value: 'text/markdown;charset=utf-8', label: { zh: 'Markdown', en: 'Markdown' } },
              { value: 'application/json;charset=utf-8', label: { zh: 'JSON', en: 'JSON' } },
              { value: 'text/csv;charset=utf-8', label: { zh: 'CSV', en: 'CSV' } },
              { value: 'text/html;charset=utf-8', label: { zh: 'HTML', en: 'HTML' } },
              { value: 'application/xml;charset=utf-8', label: { zh: 'XML', en: 'XML' } },
              { value: 'application/javascript;charset=utf-8', label: { zh: 'JavaScript', en: 'JavaScript' } },
            ],
          },
        ],
      },
    ],
  },
]

const TOOL_DEFINITIONS = AI_TOOL_CATEGORIES.flatMap((category) => category.variables)

export function getAiToolDefinition(toolId: string) {
  return TOOL_DEFINITIONS.find((tool) => tool.id === toolId) || null
}

export function getAiToolDefinitionByFunctionName(functionName: string) {
  return TOOL_DEFINITIONS.find((tool) => getAiToolFunctionName(tool.id) === functionName) || null
}

export function getAiToolFunctionName(toolId: string) {
  const tool = getAiToolDefinition(toolId)
  return sanitizeToolFunctionName(tool?.toolName || toolId)
}

export function createAiToolFunctionSchema(toolId: string, locale: keyof LocaleText = 'zh'): AiToolFunctionSchema | null {
  const tool = getAiToolDefinition(toolId)
  if (!tool) return null
  const fields = getAiToolFields(toolId, 'input')
  return {
    type: 'function',
    function: {
      name: getAiToolFunctionName(toolId),
      description: tool.description[locale] || tool.description.zh || tool.description.en,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(fields.map((field) => [field.name, createJsonSchemaForToolField(field, locale)])),
        required: fields.filter((field) => field.required).map((field) => field.name),
        additionalProperties: false,
      },
    },
  }
}

export function getAiToolFieldDefaults(toolId: string): AiToolConfig {
  const tool = getAiToolDefinition(toolId)
  if (!tool) return {}

  return tool.fields.reduce<AiToolConfig>((config, field) => {
    if (field.defaultValue !== undefined) config[field.name] = field.defaultValue
    return config
  }, {})
}

export function summarizeAiToolConfig(toolId: string, config: Record<string, unknown> | undefined, locale: keyof LocaleText) {
  const tool = getAiToolDefinition(toolId)
  if (!tool) return ''

  const parts = tool.fields
    .map((field) => {
      const value = config?.[field.name]
      if (value === undefined || value === null || value === '') return ''
      if (field.secret) return `${field.label[locale]}: ${locale === 'zh' ? '已填写' : 'filled'}`
      return `${field.label[locale]}: ${String(value).slice(0, 48)}`
    })
    .filter(Boolean)

  return parts.join(' / ')
}

export function coerceAiToolConfig(toolId: string, source: Record<string, unknown> | undefined): AiToolConfig {
  const tool = getAiToolDefinition(toolId)
  if (!tool) return {}
  return coerceAiToolFields(tool.fields, source, getAiToolFieldDefaults(toolId), toolId)
}

export function coerceAiToolRuntimeInput(toolId: string, source: Record<string, unknown> | undefined): AiToolConfig {
  const tool = getAiToolDefinition(toolId)
  if (!tool) return {}
  const fields = getAiToolFields(toolId, 'runtime')
  const defaults = fields.reduce<AiToolConfig>((config, field) => {
    if (field.defaultValue !== undefined) config[field.name] = field.defaultValue
    return config
  }, {})
  return coerceAiToolFields(fields, source, defaults, toolId)
}

export function getAiToolFields(toolId: string, scope: AiToolConfigScope = 'binding') {
  const tool = getAiToolDefinition(toolId)
  if (!tool) return []
  if (scope === 'binding') return tool.fields
  if (scope === 'input') return tool.inputFields

  const seen = new Set<string>()
  return [...tool.fields, ...tool.inputFields].filter((field) => {
    if (seen.has(field.name)) return false
    seen.add(field.name)
    return true
  })
}

function coerceAiToolFields(
  fields: AiToolField[],
  source: Record<string, unknown> | undefined,
  defaults: AiToolConfig,
  toolId: string,
): AiToolConfig {
  const config = fields.reduce<AiToolConfig>((nextConfig, field) => {
    const raw = source?.[field.name]
    const value = raw === undefined ? defaults[field.name] : raw
    if (value === undefined || value === null) return nextConfig

    if (field.type === 'number') {
      const numberValue = typeof value === 'number' ? value : Number(String(value).trim())
      if (Number.isFinite(numberValue)) nextConfig[field.name] = numberValue
      return nextConfig
    }

    if (field.type === 'boolean') {
      nextConfig[field.name] = value === true || value === 'true'
      return nextConfig
    }

    nextConfig[field.name] = String(value)
    return nextConfig
  }, {})

  if (toolId === 'file.generate' && !config.filename && source?.filePath) {
    const legacyPath = String(source.filePath).replace(/\\/g, '/')
    config.filename = legacyPath.split('/').filter(Boolean).pop() || legacyPath
  }

  return config
}

function createJsonSchemaForToolField(field: AiToolField, locale: keyof LocaleText) {
  const description = [field.label[locale], field.helper?.[locale], field.placeholder?.[locale]].filter(Boolean).join('。')
  if (field.type === 'number') return { type: 'number', description }
  if (field.type === 'boolean') return { type: 'boolean', description }
  if (field.type === 'select') {
    return {
      type: 'string',
      description,
      enum: (field.options || []).map((option) => option.value),
    }
  }
  return { type: 'string', description }
}

function sanitizeToolFunctionName(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return normalized || 'agent_tool'
}
