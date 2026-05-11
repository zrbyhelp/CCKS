import type { SystemAiRuntimeProvider } from '@/lib/system-ai-settings-store'

export type SystemAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | SystemAiContentPart[] | null
  tool_calls?: SystemAiToolCall[]
  tool_call_id?: string
  name?: string
}

export type SystemAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

export type SystemAiToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type SystemAiToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type SystemAiToolHandler = (args: Record<string, unknown>) => Promise<unknown>
export type SystemAiToolEvent = {
  id: string
  toolName: string
  status: 'start' | 'done'
  args?: Record<string, unknown>
  result?: unknown
  message?: string
}
export type SystemAiStreamEvent =
  | { type: 'start' }
  | { type: 'thinking'; delta: string }
  | { type: 'content'; delta: string }
  | { type: 'tool_start'; event: SystemAiToolEvent }
  | { type: 'tool_done'; event: SystemAiToolEvent }

export async function requestSystemAiJson(input: {
  provider: SystemAiRuntimeProvider
  messages: SystemAiMessage[]
  temperature?: number
  maxTokens?: number
  tools?: SystemAiToolDefinition[]
  toolHandlers?: Record<string, SystemAiToolHandler>
  maxToolRounds?: number
}) {
  const messages = [...input.messages]
  const tools = input.tools || []
  const toolHandlers = input.toolHandlers || {}
  const maxToolRounds = Math.max(0, Math.min(20, Math.round(input.maxToolRounds ?? input.provider.maxToolRounds)))
  let toolRounds = 0
  let toolCallCount = 0
  let thinking = ''
  const toolEvents: SystemAiToolEvent[] = []

  while (true) {
    const message = await requestSystemAiCompletion({
      provider: input.provider,
      messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      tools,
      jsonMode: true,
    })
    thinking += readAssistantThinking(message)
    const toolCalls = normalizeToolCalls(message.tool_calls)
    if (!toolCalls.length || !tools.length) {
      const output = readAssistantContent(message.content)
      return {
        output,
        json: parseJsonObject(output),
        thinking,
        toolRounds,
        toolCallCount,
        toolEvents,
      }
    }
    if (toolRounds >= maxToolRounds) throw new SystemAiClientError('SYSTEM_AI_TOOL_ROUNDS_EXCEEDED', `系统 AI 工具调用超过最大轮数：${maxToolRounds}`)
    messages.push({
      role: 'assistant',
      content: readAssistantContent(message.content) || null,
      tool_calls: toolCalls,
    })
    for (const toolCall of toolCalls) {
      toolCallCount += 1
      const handler = toolHandlers[toolCall.function.name]
      const args = readJsonObject(toolCall.function.arguments)
      toolEvents.push({ id: toolCall.id, toolName: toolCall.function.name, status: 'start', args })
      const result = handler
        ? await handler(args).catch((error) => ({ ok: false, message: error instanceof Error ? error.message : '工具执行失败' }))
        : { ok: false, message: `工具不存在：${toolCall.function.name}` }
      toolEvents.push({ id: toolCall.id, toolName: toolCall.function.name, status: 'done', args, result, message: summarizeToolResult(result) })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result).slice(0, 60000),
      })
    }
    toolRounds += 1
  }
}

export async function requestSystemAiJsonStream(input: {
  provider: SystemAiRuntimeProvider
  messages: SystemAiMessage[]
  temperature?: number
  maxTokens?: number
  tools?: SystemAiToolDefinition[]
  toolHandlers?: Record<string, SystemAiToolHandler>
  maxToolRounds?: number
  onEvent: (event: SystemAiStreamEvent) => void
  signal?: AbortSignal
}) {
  input.onEvent({ type: 'start' })
  const messages = [...input.messages]
  const tools = input.tools || []
  const toolHandlers = input.toolHandlers || {}
  const maxToolRounds = Math.max(0, Math.min(20, Math.round(input.maxToolRounds ?? input.provider.maxToolRounds)))
  let toolRounds = 0
  let toolCallCount = 0
  let thinking = ''
  let finalOutput = ''
  const toolEvents: SystemAiToolEvent[] = []

  while (true) {
    const message = await requestSystemAiCompletionStream({
      provider: input.provider,
      messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      tools,
      jsonMode: true,
      signal: input.signal,
      onThinking: (delta) => {
        thinking += delta
        input.onEvent({ type: 'thinking', delta })
      },
      onContent: (delta) => {
        finalOutput += delta
        input.onEvent({ type: 'content', delta })
      },
    })
    const toolCalls = normalizeToolCalls(message.tool_calls)
    if (!toolCalls.length || !tools.length) {
      const output = finalOutput || readAssistantContent(message.content)
      return {
        output,
        json: parseJsonObject(output),
        thinking,
        toolRounds,
        toolCallCount,
        toolEvents,
      }
    }
    if (toolRounds >= maxToolRounds) throw new SystemAiClientError('SYSTEM_AI_TOOL_ROUNDS_EXCEEDED', `系统 AI 工具调用超过最大轮数：${maxToolRounds}`)
    messages.push({
      role: 'assistant',
      content: readAssistantContent(message.content) || null,
      tool_calls: toolCalls,
    })
    finalOutput = ''
    for (const toolCall of toolCalls) {
      toolCallCount += 1
      const args = readJsonObject(toolCall.function.arguments)
      const startEvent: SystemAiToolEvent = { id: toolCall.id, toolName: toolCall.function.name, status: 'start', args }
      toolEvents.push(startEvent)
      input.onEvent({ type: 'tool_start', event: startEvent })
      const handler = toolHandlers[toolCall.function.name]
      const result = handler
        ? await handler(args).catch((error) => ({ ok: false, message: error instanceof Error ? error.message : '工具执行失败' }))
        : { ok: false, message: `工具不存在：${toolCall.function.name}` }
      const doneEvent: SystemAiToolEvent = { id: toolCall.id, toolName: toolCall.function.name, status: 'done', args, result, message: summarizeToolResult(result) }
      toolEvents.push(doneEvent)
      input.onEvent({ type: 'tool_done', event: doneEvent })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result).slice(0, 60000),
      })
    }
    toolRounds += 1
  }
}

export async function requestSystemAiTextStream(input: {
  provider: SystemAiRuntimeProvider
  messages: SystemAiMessage[]
  temperature?: number
  maxTokens?: number
  tools?: SystemAiToolDefinition[]
  toolHandlers?: Record<string, SystemAiToolHandler>
  maxToolRounds?: number
  onEvent: (event: SystemAiStreamEvent) => void
  signal?: AbortSignal
}) {
  input.onEvent({ type: 'start' })
  const messages = [...input.messages]
  const tools = input.tools || []
  const toolHandlers = input.toolHandlers || {}
  const maxToolRounds = Math.max(0, Math.min(20, Math.round(input.maxToolRounds ?? input.provider.maxToolRounds)))
  let toolRounds = 0
  let toolCallCount = 0
  let thinking = ''
  let finalOutput = ''
  const toolEvents: SystemAiToolEvent[] = []

  while (true) {
    const message = await requestSystemAiCompletionStream({
      provider: input.provider,
      messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      tools,
      jsonMode: false,
      signal: input.signal,
      onThinking: (delta) => {
        thinking += delta
        input.onEvent({ type: 'thinking', delta })
      },
      onContent: (delta) => {
        finalOutput += delta
        input.onEvent({ type: 'content', delta })
      },
    })
    const toolCalls = normalizeToolCalls(message.tool_calls)
    if (!toolCalls.length || !tools.length) {
      const output = finalOutput || readAssistantContent(message.content)
      return {
        output,
        thinking,
        toolRounds,
        toolCallCount,
        toolEvents,
      }
    }
    if (toolRounds >= maxToolRounds) throw new SystemAiClientError('SYSTEM_AI_TOOL_ROUNDS_EXCEEDED', `系统 AI 工具调用超过最大轮数：${maxToolRounds}`)
    messages.push({
      role: 'assistant',
      content: readAssistantContent(message.content) || null,
      tool_calls: toolCalls,
    })
    finalOutput = ''
    for (const toolCall of toolCalls) {
      toolCallCount += 1
      const args = readJsonObject(toolCall.function.arguments)
      const startEvent: SystemAiToolEvent = { id: toolCall.id, toolName: toolCall.function.name, status: 'start', args }
      toolEvents.push(startEvent)
      input.onEvent({ type: 'tool_start', event: startEvent })
      const handler = toolHandlers[toolCall.function.name]
      const result = handler
        ? await handler(args).catch((error) => ({ ok: false, message: error instanceof Error ? error.message : '工具执行失败' }))
        : { ok: false, message: `工具不存在：${toolCall.function.name}` }
      const doneEvent: SystemAiToolEvent = { id: toolCall.id, toolName: toolCall.function.name, status: 'done', args, result, message: summarizeToolResult(result) }
      toolEvents.push(doneEvent)
      input.onEvent({ type: 'tool_done', event: doneEvent })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result).slice(0, 60000),
      })
    }
    toolRounds += 1
  }
}

async function requestSystemAiCompletion(input: {
  provider: SystemAiRuntimeProvider
  messages: SystemAiMessage[]
  temperature?: number
  maxTokens?: number
  tools: SystemAiToolDefinition[]
  jsonMode?: boolean
}) {
  const response = await fetch(`${input.provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${input.provider.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.provider.model,
      messages: input.messages,
      temperature: typeof input.temperature === 'number' ? input.temperature : 0.2,
      ...(input.jsonMode === false ? {} : { response_format: { type: 'json_object' } }),
      ...(typeof input.maxTokens === 'number' ? { max_tokens: Math.round(input.maxTokens) } : {}),
      ...(input.provider.reasoningEffort && !['auto', 'none'].includes(input.provider.reasoningEffort)
        ? { reasoning_effort: input.provider.reasoningEffort }
        : {}),
      ...(input.tools.length ? { tools: input.tools, tool_choice: 'auto' } : {}),
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new SystemAiClientError('SYSTEM_AI_REQUEST_FAILED', readRemoteError(data) || `系统 AI 请求失败 (${response.status})`)
  const choice = readArray(readRecord(data).choices)[0]
  const message = readRecord(readRecord(choice).message)
  return {
    content: message.content,
    reasoning_content: message.reasoning_content || message.reasoning || message.thinking,
    tool_calls: message.tool_calls,
  }
}

async function requestSystemAiCompletionStream(input: {
  provider: SystemAiRuntimeProvider
  messages: SystemAiMessage[]
  temperature?: number
  maxTokens?: number
  tools: SystemAiToolDefinition[]
  jsonMode?: boolean
  signal?: AbortSignal
  onThinking: (delta: string) => void
  onContent: (delta: string) => void
}) {
  const response = await fetch(`${input.provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${input.provider.apiKey}`,
      'content-type': 'application/json',
    },
    signal: input.signal,
    body: JSON.stringify({
      model: input.provider.model,
      messages: input.messages,
      temperature: typeof input.temperature === 'number' ? input.temperature : 0.2,
      stream: true,
      ...(input.jsonMode === false ? {} : { response_format: { type: 'json_object' } }),
      ...(typeof input.maxTokens === 'number' ? { max_tokens: Math.round(input.maxTokens) } : {}),
      ...(input.provider.reasoningEffort && !['auto', 'none'].includes(input.provider.reasoningEffort)
        ? { reasoning_effort: input.provider.reasoningEffort }
        : {}),
      ...(input.tools.length ? { tools: input.tools, tool_choice: 'auto' } : {}),
    }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new SystemAiClientError('SYSTEM_AI_REQUEST_FAILED', readRemoteError(data) || `系统 AI 请求失败 (${response.status})`)
  }
  if (!response.body) throw new SystemAiClientError('SYSTEM_AI_STREAM_UNAVAILABLE', '系统 AI 没有返回流式内容')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const toolCalls = new Map<number, SystemAiToolCall>()
  let buffer = ''
  let content = ''
  let reasoning = ''

  function applyDelta(delta: Record<string, unknown>) {
    const contentDelta = readText(delta.content)
    if (contentDelta) {
      content += contentDelta
      input.onContent(contentDelta)
    }
    const thinkingDelta = readText(delta.reasoning_content || delta.reasoning || delta.thinking)
    if (thinkingDelta) {
      reasoning += thinkingDelta
      input.onThinking(thinkingDelta)
    }
    for (const item of readArray(delta.tool_calls)) {
      const record = readRecord(item)
      const index = Number.isFinite(record.index) ? Number(record.index) : toolCalls.size
      const existing = toolCalls.get(index) || { id: '', type: 'function' as const, function: { name: '', arguments: '' } }
      const fn = readRecord(record.function)
      toolCalls.set(index, {
        id: readString(record.id) || existing.id || `tool_call_${index}`,
        type: 'function',
        function: {
          name: existing.function.name + readString(fn.name),
          arguments: existing.function.arguments + readText(fn.arguments),
        },
      })
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split(/\n\n/)
    buffer = chunks.pop() || ''
    for (const chunk of chunks) {
      const dataLines = chunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())
      const data = dataLines.join('\n')
      if (!data || data === '[DONE]') continue
      const parsed = JSON.parse(data)
      const choice = readArray(readRecord(parsed).choices)[0]
      const delta = readRecord(readRecord(choice).delta)
      applyDelta(delta)
    }
  }

  return {
    content,
    reasoning_content: reasoning,
    tool_calls: Array.from(toolCalls.values()).filter((toolCall) => toolCall.function.name),
  }
}

function normalizeToolCalls(value: unknown): SystemAiToolCall[] {
  return readArray(value).flatMap((item, index): SystemAiToolCall[] => {
    const record = readRecord(item)
    const fn = readRecord(record.function)
    const name = readString(fn.name)
    if (!name) return []
    return [{
      id: readString(record.id) || `tool_call_${index}`,
      type: 'function',
      function: {
        name,
        arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(isRecord(fn.arguments) ? fn.arguments : {}),
      },
    }]
  })
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value)
    if (isRecord(parsed)) return parsed
  } catch {
    const match = value.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (isRecord(parsed)) return parsed
      } catch {
        // Fall through.
      }
    }
  }
  throw new SystemAiClientError('SYSTEM_AI_JSON_INVALID', '系统 AI 没有返回有效 JSON')
}

function readAssistantContent(value: unknown) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!isRecord(item)) return ''
    return readText(item.text || item.content)
  }).filter(Boolean).join('\n')
}

function readAssistantThinking(message: Record<string, unknown>) {
  const direct = readText(message.reasoning_content || message.reasoning || message.thinking)
  if (direct) return direct
  const content = message.content
  if (!Array.isArray(content)) return ''
  return content.map((item) => {
    if (!isRecord(item)) return ''
    return readText(item.reasoning || item.thinking || item.reasoning_content)
  }).filter(Boolean).join('\n')
}

function readJsonObject(value: unknown) {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readRemoteError(value: unknown) {
  const record = readRecord(value)
  const error = readRecord(record.error)
  return readString(error.message || error.code) || readString(record.message || record.error) || (Object.keys(record).length ? JSON.stringify(record).slice(0, 1000) : '')
}

function summarizeToolResult(value: unknown) {
  if (!isRecord(value)) return readString(value) || JSON.stringify(value).slice(0, 300)
  const message = readString(value.message)
  if (message) return message
  const results = readArray(value.results)
  if (results.length) return `返回 ${results.length} 条结果`
  if (value.ok === true) return '工具执行成功'
  if (value.ok === false) return '工具执行失败'
  return JSON.stringify(value).slice(0, 300)
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
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

export class SystemAiClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SystemAiClientError'
  }
}
