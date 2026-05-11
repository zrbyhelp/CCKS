import { NextRequest, NextResponse } from 'next/server'
import { apiErrorMessage } from '@/lib/api-errors'
import { getSessionUser } from '@/lib/server-session'
import { requestSystemAiJson } from '@/lib/system-ai-client'
import { getSystemAiRuntimeProvider, isSystemAiSettingError } from '@/lib/system-ai-settings-store'

export const runtime = 'nodejs'

type RandomVariableDescriptor = {
  key: string
  name: string
  variableType: string
  defaultValue?: string
  detail?: string
  itemType?: string
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const descriptors = readArray(body?.variables).flatMap(readDescriptor).filter((item) => isStringLikeVariable(item.variableType))
  if (!descriptors.length) return NextResponse.json({ ok: true, values: {} })

  try {
    const provider = await getSystemAiRuntimeProvider()
    const result = await requestSystemAiJson({
      provider,
      temperature: 0.8,
      maxTokens: 2000,
      messages: [
        {
          role: 'system',
          content: [
            '你是提示词变量随机参数生成器。',
            '必须只输出 JSON object，格式为 {"values":{"变量key":"随机值"}}。',
            '随机值要具体、可直接填入提示词，不要解释，不要 Markdown。',
            'string 变量返回自然文本字符串；array 变量返回真实 JSON array，不要返回空数组。',
            'array.itemType=string 时生成 2-5 条短文本；array.itemType=object 时生成 2-4 个结构清晰的对象。',
            '如果变量名是中文，理解中文语义后生成自然中文内容。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            promptContext: readText(body?.promptContext).slice(0, 12000),
            variables: descriptors,
          }),
        },
      ],
    })
    const values = readRecord(result.json.values)
    return NextResponse.json({
      ok: true,
      values: Object.fromEntries(
        descriptors
          .map((descriptor) => [descriptor.key, normalizeRandomValue(values[descriptor.key], descriptor)] as const)
          .filter(([, value]) => value),
      ),
      thinking: result.thinking,
    })
  } catch (error) {
    if (isSystemAiSettingError(error)) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, message: apiErrorMessage(error, '随机参数生成失败') }, { status: 500 })
  }
}

function readDescriptor(value: unknown): RandomVariableDescriptor[] {
  if (!isRecord(value)) return []
  const key = readString(value.key)
  const name = readString(value.name || value.label)
  const variableType = readString(value.variableType || value.type)
  if (!key || !name) return []
  return [{
      key,
      name,
      variableType,
      defaultValue: readString(value.defaultValue),
      detail: readText(value.detail).slice(0, 1000),
      itemType: readString(value.itemType),
    }]
}

function isStringLikeVariable(value: string) {
  return value === 'string' || value === 'array' || !['number', 'boolean', 'color', 'image', 'file', 'recipe'].includes(value)
}

function normalizeRandomValue(value: unknown, descriptor: RandomVariableDescriptor) {
  if (descriptor.variableType === 'array') {
    const arrayValue = normalizeRandomArray(value)
    return arrayValue.length ? JSON.stringify(arrayValue) : ''
  }
  return readText(value).trim()
}

function normalizeRandomArray(value: unknown) {
  if (Array.isArray(value)) return value.filter(isNonEmptyArrayItem)
  const text = readText(value).trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.filter(isNonEmptyArrayItem)
  } catch {
    // Fall back to simple splitting.
  }
  return text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
}

function isNonEmptyArrayItem(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === 'object') return Object.keys(readRecord(value)).length > 0
  return readText(value).trim() !== ''
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
