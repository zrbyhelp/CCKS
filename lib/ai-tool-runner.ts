import {
  AI_TOOL_SCHEMA_VERSION,
  coerceAiToolRuntimeInput,
  getAiToolDefinition,
  type AiToolConfig,
} from '@/lib/tool-definitions'

type AiToolRunContext = {
  projectId?: unknown
  path?: unknown
}

type AiToolRunInput = {
  toolId: unknown
  input: unknown
  context?: AiToolRunContext
}

type BatchItem<T> = {
  input: string
  result?: T
  error?: string
}

const DEFAULT_BATCH_LIMIT = 5
const MAX_GENERATED_FILE_BYTES = 5 * 1024 * 1024

export async function runAiTool(userId: string, request: AiToolRunInput) {
  const toolId = readString(request.toolId)
  const definition = getAiToolDefinition(toolId)
  if (!definition) throw new AiToolRunnerError('TOOL_NOT_FOUND', '工具不存在')

  const sourceInput = isRecord(request.input) ? request.input : {}
  const input = coerceAiToolRuntimeInput(toolId, sourceInput)
  if (toolId === 'file.generate' && !input.filename && sourceInput.filePath) {
    input.filename = readString(sourceInput.filePath)
  }

  switch (toolId) {
    case 'system.current_time':
      return readCurrentTime(input)
    case 'system.timezone':
      return readTimezoneInfo(input)
    case 'web.search':
      return runBatch(input, 'queries', 'query', searchWeb)
    case 'web.fetch':
      return runBatch(input, 'urls', 'url', fetchWebContent)
    case 'wiki.search':
      return runBatch(input, 'queries', 'query', searchWikipedia)
    case 'weather.forecast':
      return runBatch(input, 'locations', 'location', fetchWeather)
    case 'geo.geocode':
      return geocode(input)
    case 'email.temp_create':
      return createTempEmail(input)
    case 'email.temp_get':
      return getTempEmail(input)
    case 'email.send':
      return sendEmail(input)
    case 'file.generate':
      return generateDownloadFile(input)
    default:
      throw new AiToolRunnerError('TOOL_NOT_IMPLEMENTED', '工具暂未实现')
  }
}

export function isAiToolRunnerError(error: unknown): error is AiToolRunnerError {
  return error instanceof AiToolRunnerError
}

export class AiToolRunnerError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AiToolRunnerError'
  }
}

function readCurrentTime(input: AiToolConfig) {
  const date = new Date()
  const timezone = readTimezone(input.timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone
  const locale = readLocale(input.locale)
  const formatter = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: timezone,
  })

  return {
    schemaVersion: AI_TOOL_SCHEMA_VERSION,
    timezone,
    iso: date.toISOString(),
    timestamp: date.getTime(),
    formatted: formatter.format(date),
    weekday: new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', timeZone: timezone }).format(date),
  }
}

function readTimezoneInfo(input: AiToolConfig) {
  const timezone = readTimezone(input.timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date()
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, now)
  const januaryOffset = getTimezoneOffsetMinutes(timezone, new Date(Date.UTC(now.getUTCFullYear(), 0, 1)))
  const julyOffset = getTimezoneOffsetMinutes(timezone, new Date(Date.UTC(now.getUTCFullYear(), 6, 1)))

  return {
    schemaVersion: AI_TOOL_SCHEMA_VERSION,
    timezone,
    runtimeTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffset: formatUtcOffset(offsetMinutes),
    utcOffsetMinutes: offsetMinutes,
    observesDst: januaryOffset !== julyOffset,
    isDstLikely: offsetMinutes !== Math.min(januaryOffset, julyOffset),
  }
}

async function searchWeb(input: AiToolConfig, queryOverride?: string) {
  const apiKey = readRequiredString(input.braveSearchApiKey, '请在工具运行配置中填写 Brave Search API Key')
  const query = readRequiredString(queryOverride || input.query, '搜索关键词不能为空')
  const count = clamp(readNumber(input.count, 5), 1, 20)
  const language = readLocale(input.language)
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(count))
  url.searchParams.set('country', readString(input.country) || 'US')
  url.searchParams.set('search_lang', language)

  const data = await fetchJson(url.toString(), {
    headers: {
      accept: 'application/json',
      'x-subscription-token': apiKey,
    },
    errorMessage: 'Web 搜索失败',
  })
  const web = readRecord(readRecord(data).web)
  const results = readArray(web.results).slice(0, count).map((item) => {
    const record = readRecord(item)
    return {
      title: readString(record.title),
      url: readString(record.url),
      description: readString(record.description),
      age: readString(record.age),
    }
  })

  return { query, results, rawCount: results.length }
}

async function fetchWebContent(input: AiToolConfig, urlOverride?: string) {
  const targetUrl = readRequiredString(urlOverride || input.url, 'URL 不能为空')
  validateHttpUrl(targetUrl, 'URL 无效')
  const maxChars = clamp(readNumber(input.maxChars, 12000), 1000, 60000)
  const readerUrl = `https://r.jina.ai/${targetUrl}`
  const headers: Record<string, string> = { accept: 'text/plain' }
  const jinaApiKey = readString(input.jinaApiKey)
  if (jinaApiKey) headers.authorization = `Bearer ${jinaApiKey}`

  const text = await fetchText(readerUrl, { headers, errorMessage: '网页内容获取失败' })
  return {
    url: targetUrl,
    content: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    length: text.length,
  }
}

async function searchWikipedia(input: AiToolConfig, queryOverride?: string) {
  const query = readRequiredString(queryOverride || input.query, '维基百科关键词不能为空')
  const language = readLocale(input.language)
  const limit = clamp(readNumber(input.limit, 5), 1, 20)
  const url = new URL(`https://api.wikimedia.org/core/v1/wikipedia/${language}/search/page`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))
  const headers: Record<string, string> = {
    accept: 'application/json',
    'api-user-agent': readString(input.wikimediaUserAgent) || 'ccks/1.0 (https://localhost)',
  }
  const wikimediaAccessToken = readString(input.wikimediaAccessToken)
  if (wikimediaAccessToken) headers.authorization = `Bearer ${wikimediaAccessToken}`

  const data = await fetchJson(url.toString(), { headers, errorMessage: '维基百科查询失败' })
  const pages = readArray(readRecord(data).pages).slice(0, limit).map((item) => {
    const record = readRecord(item)
    return {
      id: record.id,
      key: readString(record.key),
      title: readString(record.title),
      excerpt: stripHtml(readString(record.excerpt)),
      description: readString(record.description),
      url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(readString(record.key) || readString(record.title))}`,
    }
  })

  return { query, language, pages }
}

async function fetchWeather(input: AiToolConfig, locationOverride?: string) {
  const location = readRequiredString(locationOverride || input.location, '地点不能为空')
  const language = readLocale(input.language)
  const forecastDays = clamp(readNumber(input.forecastDays, 3), 1, 7)
  const temperatureUnit = readString(input.temperatureUnit) === 'fahrenheit' ? 'fahrenheit' : 'celsius'
  const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geocodeUrl.searchParams.set('name', location)
  geocodeUrl.searchParams.set('count', '1')
  geocodeUrl.searchParams.set('language', language)
  geocodeUrl.searchParams.set('format', 'json')

  const geo = await fetchJson(geocodeUrl.toString(), { errorMessage: '天气地点解析失败' })
  const place = readArray(readRecord(geo).results)[0]
  const placeRecord = readRecord(place)
  const latitude = readNumber(placeRecord.latitude)
  const longitude = readNumber(placeRecord.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new AiToolRunnerError('WEATHER_LOCATION_NOT_FOUND', `未找到地点：${location}`)
  }

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast')
  weatherUrl.searchParams.set('latitude', String(latitude))
  weatherUrl.searchParams.set('longitude', String(longitude))
  weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m')
  weatherUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum')
  weatherUrl.searchParams.set('forecast_days', String(forecastDays))
  weatherUrl.searchParams.set('timezone', 'auto')
  weatherUrl.searchParams.set('temperature_unit', temperatureUnit)

  const weather = readRecord(await fetchJson(weatherUrl.toString(), { errorMessage: '天气查询失败' }))
  return {
    location: {
      query: location,
      name: readString(placeRecord.name),
      country: readString(placeRecord.country),
      admin1: readString(placeRecord.admin1),
      latitude,
      longitude,
    },
    current: weather.current,
    daily: weather.daily,
    units: { current: weather.current_units, daily: weather.daily_units },
  }
}

async function geocode(input: AiToolConfig) {
  const token = readRequiredString(input.mapboxAccessToken, '请在工具运行配置中填写 Mapbox Access Token')
  const mode = readString(input.mode) === 'reverse' ? 'reverse' : 'forward'
  const language = readLocale(input.language)
  const limit = clamp(readNumber(input.limit, 5), 1, 10)
  const url = new URL(`https://api.mapbox.com/search/geocode/v6/${mode}`)
  url.searchParams.set('access_token', token)
  url.searchParams.set('language', language)
  url.searchParams.set('limit', String(limit))

  if (mode === 'reverse') {
    const longitude = readNumber(input.longitude)
    const latitude = readNumber(input.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new AiToolRunnerError('GEOCODE_COORDINATES_REQUIRED', '反向地理编码需要经度和纬度')
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('latitude', String(latitude))
  } else {
    url.searchParams.set('q', readRequiredString(input.query, '地址 / 地点不能为空'))
  }

  const data = readRecord(await fetchJson(url.toString(), { errorMessage: '地图 / 地理查询失败' }))
  const features = readArray(data.features).map((item) => {
    const feature = readRecord(item)
    const properties = readRecord(feature.properties)
    const geometry = readRecord(feature.geometry)
    return {
      id: readString(feature.id),
      name: readString(properties.name),
      fullAddress: readString(properties.full_address),
      placeFormatted: readString(properties.place_formatted),
      coordinates: readArray(geometry.coordinates),
      mapboxId: readString(properties.mapbox_id),
    }
  })

  return { mode, features }
}

async function createTempEmail(input: AiToolConfig) {
  const baseUrl = readRequiredString(input.tempEmailBaseUrl, '请在工具运行配置中填写临时邮箱服务地址')
  const adminAuth = readString(input.tempEmailAdminAuth)
  const customAuth = readString(input.tempEmailCustomAuth)
  const endpoint = adminAuth ? '/admin/new_address' : '/api/new_address'
  const response = await fetchJson(`${trimTrailingSlash(baseUrl)}${endpoint}`, {
    method: 'POST',
    headers: {
      ...tempEmailHeaders('', customAuth),
      ...(adminAuth ? { 'x-admin-auth': adminAuth } : {}),
    },
    body: {
      enablePrefix: true,
      name: readString(input.name) || undefined,
      domain: readString(input.domain) || undefined,
    },
    errorMessage: '临时邮箱创建失败',
  })

  return response
}

async function getTempEmail(input: AiToolConfig) {
  const baseUrl = readRequiredString(input.tempEmailBaseUrl, '请在工具运行配置中填写临时邮箱服务地址')
  const customAuth = readString(input.tempEmailCustomAuth)
  const address = readRequiredString(input.address, '邮箱地址不能为空')
  const addressJwt = readRequiredString(input.addressJwt, 'Address JWT 不能为空')
  const mailId = readString(input.mailId)
  if (mailId) {
    const parsedUrl = `${trimTrailingSlash(baseUrl)}/api/parsed_mail/${encodeURIComponent(mailId)}`
    return fetchJson(parsedUrl, { headers: tempEmailHeaders(addressJwt, customAuth), errorMessage: '邮件详情读取失败' }).catch((error) => {
      if (!isNotFoundToolError(error)) throw error
      return fetchJson(`${trimTrailingSlash(baseUrl)}/api/mail/${encodeURIComponent(mailId)}`, {
        headers: tempEmailHeaders(addressJwt, customAuth),
        errorMessage: '邮件详情读取失败',
      })
    })
  }

  const parsedUrl = new URL(`${trimTrailingSlash(baseUrl)}/api/parsed_mails`)
  parsedUrl.searchParams.set('limit', String(clamp(readNumber(input.limit, 10), 1, 50)))
  parsedUrl.searchParams.set('offset', '0')
  return fetchJson(parsedUrl.toString(), { headers: tempEmailHeaders(addressJwt, customAuth), errorMessage: '临时邮箱读取失败' }).catch((error) => {
    if (!isNotFoundToolError(error)) throw error
    const rawUrl = new URL(`${trimTrailingSlash(baseUrl)}/api/mails`)
    rawUrl.searchParams.set('limit', String(clamp(readNumber(input.limit, 10), 1, 50)))
    rawUrl.searchParams.set('offset', '0')
    rawUrl.searchParams.set('address', address)
    return fetchJson(rawUrl.toString(), { headers: tempEmailHeaders(addressJwt, customAuth), errorMessage: '临时邮箱读取失败' })
  })
}

async function sendEmail(input: AiToolConfig) {
  const apiKey = readRequiredString(input.resendApiKey, '请在工具运行配置中填写 Resend API Key')
  const from = readRequiredString(input.resendFromEmail, '请在工具运行配置中填写发件人邮箱')
  const to = splitValues(readRequiredString(input.to, '收件人不能为空'))
  const subject = readRequiredString(input.subject, '邮件主题不能为空')
  const text = readRequiredString(input.text, '邮件正文不能为空')
  const html = readString(input.html)
  const replyTo = readString(input.replyTo)

  return fetchJson('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: {
      from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    },
    errorMessage: '邮件发送失败',
  })
}

function generateDownloadFile(input: AiToolConfig) {
  const filename = normalizeDownloadFilename(readRequiredString(input.filename, '文件名不能为空'))
  const content = readString(input.content)
  const mimeType = normalizeMimeType(input.mimeType)
  const contentBuffer = Buffer.from(content, 'utf8')
  if (contentBuffer.byteLength > MAX_GENERATED_FILE_BYTES) {
    throw new AiToolRunnerError('FILE_TOO_LARGE', '生成文件超过 5MB，暂不支持下载')
  }

  return {
    artifact: {
      kind: 'download',
      filename,
      mimeType,
      encoding: 'base64',
      contentBase64: contentBuffer.toString('base64'),
      size: contentBuffer.byteLength,
    },
  }
}

async function runBatch<T>(
  input: AiToolConfig,
  batchKey: string,
  singleKey: string,
  runner: (input: AiToolConfig, item?: string) => Promise<T>,
) {
  const items = splitLines(input[batchKey]).slice(0, DEFAULT_BATCH_LIMIT)
  if (!items.length) return runner(input)

  const settled = await Promise.allSettled(items.map((item) => runner(input, item)))
  const results: BatchItem<T>[] = settled.map((item, index) =>
    item.status === 'fulfilled'
      ? { input: items[index], result: item.value }
      : { input: items[index], error: readErrorMessage(item.reason) },
  )

  return {
    batch: true,
    inputKey: singleKey,
    limit: DEFAULT_BATCH_LIMIT,
    results,
  }
}

async function fetchJson(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    errorMessage: string
  },
) {
  const text = await fetchText(url, {
    method: options.method,
    headers: {
      accept: 'application/json',
      ...(options.headers || {}),
      ...(options.body && !options.headers?.['content-type'] ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    errorMessage: options.errorMessage,
  })

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AiToolRunnerError('TOOL_RESPONSE_INVALID', `${options.errorMessage}：响应不是 JSON`)
  }
}

async function fetchText(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    errorMessage: string
  },
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new AiToolRunnerError('TOOL_REQUEST_FAILED', `${options.errorMessage} (${response.status})：${readRemoteError(text)}`)
    }
    return text
  } catch (error) {
    if (isAiToolRunnerError(error)) throw error
    throw new AiToolRunnerError('TOOL_REQUEST_FAILED', `${options.errorMessage}：${readErrorMessage(error)}`)
  } finally {
    clearTimeout(timeout)
  }
}

function tempEmailHeaders(addressJwt = '', customAuth = '') {
  return {
    accept: 'application/json',
    ...(addressJwt ? { authorization: `Bearer ${addressJwt}` } : {}),
    ...(customAuth ? { 'x-custom-auth': customAuth } : {}),
  }
}

function getTimezoneOffsetMinutes(timezone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )
  return Math.round((asUtc - date.getTime()) / 60000)
}

function formatUtcOffset(minutes: number) {
  const sign = minutes >= 0 ? '+' : '-'
  const absolute = Math.abs(minutes)
  const hours = Math.floor(absolute / 60)
  const mins = absolute % 60
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function readRemoteError(text: string) {
  try {
    const parsed = JSON.parse(text)
    if (isRecord(parsed.error)) return readString(parsed.error.message || parsed.error.code) || text.slice(0, 240)
    return readString(parsed.message || parsed.error) || text.slice(0, 240)
  } catch {
    return text.slice(0, 240)
  }
}

function isNotFoundToolError(error: unknown) {
  return error instanceof AiToolRunnerError && error.message.includes('(404)')
}

function normalizeDownloadFilename(value: string) {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const filename = normalized.split('/').filter(Boolean).pop() || ''
  if (!filename || filename === '.' || filename === '..' || /[\\/:*?"<>|]/.test(filename)) {
    throw new AiToolRunnerError('FILE_NAME_INVALID', '文件名无效')
  }
  return filename.slice(0, 160)
}

function normalizeMimeType(value: unknown) {
  const mimeType = readString(value) || 'text/plain;charset=utf-8'
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[a-z0-9.+_-]+=[a-z0-9.+_-]+)?$/i.test(mimeType)) {
    throw new AiToolRunnerError('MIME_TYPE_INVALID', '文件类型无效')
  }
  return mimeType
}

function validateHttpUrl(value: string, message: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid protocol')
  } catch {
    throw new AiToolRunnerError('URL_INVALID', message)
  }
}

function readRequiredString(value: unknown, message: string) {
  const text = readString(value)
  if (!text) throw new AiToolRunnerError('TOOL_INPUT_REQUIRED', message)
  return text
}

function readTimezone(value: unknown) {
  const timezone = readString(value)
  if (!timezone) return ''
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return timezone
  } catch {
    throw new AiToolRunnerError('TIMEZONE_INVALID', '时区无效')
  }
}

function readLocale(value: unknown) {
  return readString(value) === 'en' ? 'en' : 'zh'
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function readNumber(value: unknown, fallback = Number.NaN) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value.trim())
  return fallback
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function splitLines(value: unknown) {
  return readString(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitValues(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return readString(error) || '未知错误'
}
