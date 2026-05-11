'use client'

import { useEffect, useState } from 'react'
import { Bot, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AI_PROVIDER_PRESETS,
  aiModelSupportsReferenceFile,
  aiModelSupportsReferenceImage,
  aiModelSupportsThinking,
  applyAiModelPreset,
  createAiModelPresetRef,
  findAiModelPresetOption,
  getAiModelPresetOptionKeyForModel,
  inferAiProviderTypeFromBaseUrl,
  listAiModelPresetOptions,
  type AiProviderModel,
  type AiProviderPreset,
  type AiProviderSummary,
} from '@/lib/ai-presets'
import { cn } from '@/lib/utils'

type CommonAiProviderFormState = {
  id: string
  name: string
  providerType: string
  baseUrl: string
  apiKey: string
  models: AiProviderModel[]
}

const COPY = {
  sectionTitle: '通用供应商',
  sectionDesc: '由管理员维护，用户只能选择模型，不能查看密钥。',
  providerPreset: '常用网址',
  providerName: '供应商名称',
  providerBaseUrl: '供应商网址',
  providerApiKey: 'API Key',
  providerApiKeyPlaceholder: '留空则保留已保存密钥',
  providerModels: '模型列表',
  providerModelsHint: '保存前请先获取模型；模型参数可通过预设补齐。',
  providerModelsEmpty: '尚未获取模型。',
  pullModels: '获取模型',
  pullingModels: '获取中',
  saveAiProvider: '保存供应商',
  updateAiProvider: '更新供应商',
  addAiProvider: '新增供应商',
  edit: '编辑',
  delete: '删除',
  refresh: '刷新',
  loading: '加载中...',
  noAiProvider: '暂无通用供应商。',
  providerDeleteConfirm: '确认删除通用供应商「{name}」？',
  providerHasKey: '密钥已加密保存',
  providerNoKey: '未保存密钥',
  modelPreset: '模型预设',
  modelPresetPlaceholder: '选择模型预设',
  modelPresetMatched: '已匹配',
  capabilities: '能力',
  outputTypes: {
    text: '文本',
    image: '图片',
  },
  toolCalling: '工具',
  toolCallingStatus: {
    supported: '工具调用',
    unsupported: '无工具调用',
    unknown: '工具未知',
  },
  thinkingSupport: '思考',
  thinkingSupported: '支持',
  thinkingUnsupported: '不支持',
  referenceImage: '参考图',
  referenceFile: '参考文件',
}

export function CommonAiProviderManager({ onChanged }: { onChanged?: () => Promise<void> | void }) {
  const [providers, setProviders] = useState<AiProviderSummary[]>([])
  const [form, setForm] = useState<CommonAiProviderFormState>(() => createCommonProviderFormState(AI_PROVIDER_PRESETS[0]))
  const [loading, setLoading] = useState(false)
  const [pullingModels, setPullingModels] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const editing = Boolean(form.id)

  useEffect(() => {
    void loadProviders()
  }, [])

  async function loadProviders() {
    setLoading(true)
    setMessage('')
    const response = await fetch('/api/ai-providers/common')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setLoading(false))

    if (!response?.ok) {
      setProviders([])
      setMessage(response?.message || '通用供应商加载失败')
      return
    }

    setProviders(Array.isArray(response.providers) ? response.providers : [])
  }

  function applyPreset(providerType: string) {
    const preset = AI_PROVIDER_PRESETS.find((item) => item.providerType === providerType) || AI_PROVIDER_PRESETS[0]
    setForm((current) => ({
      ...current,
      name: current.id ? current.name : preset.name,
      providerType: preset.providerType,
      baseUrl: preset.baseUrl,
      models: [],
    }))
  }

  function updateBaseUrl(baseUrl: string) {
    setForm((current) => ({
      ...current,
      baseUrl,
      providerType: inferAiProviderTypeFromBaseUrl(baseUrl, 'custom'),
      models: baseUrl === current.baseUrl ? current.models : [],
    }))
  }

  function editProvider(provider: AiProviderSummary) {
    setMessage('')
    setForm({
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: '',
      models: provider.models,
    })
  }

  function resetForm() {
    setMessage('')
    setForm(createCommonProviderFormState(AI_PROVIDER_PRESETS[0]))
  }

  function applyModelPreset(index: number, presetKey: string) {
    const option = findAiModelPresetOption(presetKey)
    if (!option) return
    setForm((current) => ({
      ...current,
      models: current.models.map((model, modelIndex) => (modelIndex === index ? applyAiModelPreset(model, option.model, createAiModelPresetRef(option)) : model)),
    }))
  }

  async function pullModels() {
    setPullingModels(true)
    setMessage('')
    const response = await fetchJson('/api/ai-providers/common/models', {
      method: 'POST',
      body: {
        providerId: form.id,
        providerType: form.providerType,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
      },
    }).finally(() => setPullingModels(false))

    if (!response?.ok || !Array.isArray(response.models)) {
      setMessage(response?.message || '模型列表获取失败')
      return
    }

    setForm((current) => ({ ...current, models: response.models }))
  }

  async function submitProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.models.length) {
      setMessage('请先获取模型列表，再保存供应商。')
      return
    }

    setBusy(true)
    setMessage('')
    const response = await fetchJson('/api/ai-providers/common', {
      method: editing ? 'PATCH' : 'POST',
      body: {
        providerId: form.id,
        name: form.name,
        providerType: form.providerType,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models,
      },
    }).finally(() => setBusy(false))

    if (!response?.ok) {
      setMessage(response?.message || '通用供应商保存失败')
      return
    }

    resetForm()
    await loadProviders()
    await onChanged?.()
  }

  async function deleteProvider(provider: AiProviderSummary) {
    if (!window.confirm(COPY.providerDeleteConfirm.replace('{name}', provider.name))) return

    setBusy(true)
    setMessage('')
    const response = await fetchJson('/api/ai-providers/common', {
      method: 'DELETE',
      body: { providerId: provider.id },
    }).finally(() => setBusy(false))

    if (!response?.ok) {
      setMessage(response?.message || '通用供应商删除失败')
      return
    }

    if (form.id === provider.id) resetForm()
    await loadProviders()
    await onChanged?.()
  }

  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
      <form className="self-start rounded-md border border-slate-200 bg-white p-3" onSubmit={submitProvider}>
        <div className="mb-3 flex min-w-0 items-center gap-2 border-b border-slate-100 pb-3">
          <Bot className="h-4 w-4 shrink-0 text-[#d95a1b]" />
          <div className="min-w-0">
            <h3 className="truncate text-xs font-black text-slate-900">{COPY.sectionTitle}</h3>
            <p className="truncate text-[11px] font-semibold text-slate-500">{COPY.sectionDesc}</p>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="block text-xs font-semibold text-slate-600">
            {COPY.providerPreset}
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {AI_PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.providerType}
                  type="button"
                  className={cn(
                    'min-h-8 rounded-md border px-2 py-1 text-left text-[11px] font-bold transition',
                    form.providerType === preset.providerType && form.baseUrl === preset.baseUrl
                      ? 'border-[#d95a1b] bg-[#fff1e8] text-[#9a3412]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#f2b28d] hover:bg-[#fff7f2]',
                  )}
                  onClick={() => applyPreset(preset.providerType)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            {COPY.providerName}
            <Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            {COPY.providerBaseUrl}
            <Input className="mt-1" value={form.baseUrl} onChange={(event) => updateBaseUrl(event.target.value)} required />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            {COPY.providerApiKey}
            <Input
              className="mt-1"
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              placeholder={editing ? COPY.providerApiKeyPlaceholder : ''}
              required={!editing}
            />
          </label>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
              <span>{COPY.providerModels}</span>
              <Button
                className="h-7"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => void pullModels()}
                disabled={pullingModels || !form.baseUrl || (!editing && !form.apiKey)}
              >
                <RefreshCw className={cn('h-3 w-3', pullingModels && 'animate-spin')} />
                {pullingModels ? COPY.pullingModels : COPY.pullModels}
              </Button>
            </div>
            <ModelPreviewList models={form.models} providerType={form.providerType} onApplyPreset={applyModelPreset} />
            <span className="mt-1 block text-[10px] font-normal text-slate-500">{COPY.providerModelsHint}</span>
          </div>
        </div>

        {message ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{message}</p> : null}

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" type="submit" disabled={busy}>
            {editing ? COPY.updateAiProvider : COPY.saveAiProvider}
          </Button>
          {editing ? (
            <Button size="sm" type="button" variant="outline" onClick={resetForm} disabled={busy}>
              <Plus className="h-3 w-3" />
              {COPY.addAiProvider}
            </Button>
          ) : null}
        </div>
      </form>

      <div className="min-h-0 rounded-md border border-slate-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3">
          <span className="text-xs font-black text-slate-900">{COPY.sectionTitle}</span>
          <Button className="h-7" size="sm" variant="outline" type="button" onClick={() => void loadProviders()} disabled={loading}>
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            {COPY.refresh}
          </Button>
        </div>
        <div className="grid max-h-[520px] gap-2 overflow-auto p-3">
          {loading && !providers.length ? <p className="rounded-md border border-dashed border-slate-200 p-4 text-xs text-slate-500">{COPY.loading}</p> : null}
          {providers.map((provider) => (
            <article key={provider.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-black text-slate-900">{provider.name}</h4>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{provider.baseUrl}</p>
                </div>
                <Badge variant="outline">{provider.hasApiKey ? COPY.providerHasKey : COPY.providerNoKey}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {provider.models.map((model) => (
                  <div key={model.id} className="flex min-w-0 flex-wrap items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1">
                    <span className="max-w-48 truncate font-mono text-[10px] font-black text-slate-700">{model.id}</span>
                    <ModelTagBadges model={model} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => editProvider(provider)} disabled={busy}>
                  <Pencil className="h-3 w-3" />
                  {COPY.edit}
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={() => void deleteProvider(provider)} disabled={busy}>
                  <Trash2 className="h-3 w-3" />
                  {COPY.delete}
                </Button>
              </div>
            </article>
          ))}
          {!providers.length && !loading ? <p className="rounded-md border border-dashed border-slate-200 p-4 text-xs text-slate-500">{COPY.noAiProvider}</p> : null}
        </div>
      </div>
    </div>
  )
}

function ModelPreviewList({
  models,
  providerType,
  onApplyPreset,
}: {
  models: AiProviderModel[]
  providerType: string
  onApplyPreset: (index: number, presetKey: string) => void
}) {
  if (!models.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs font-semibold text-slate-500">
        {COPY.providerModelsEmpty}
      </div>
    )
  }

  return (
    <div className="grid max-h-52 gap-1.5 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
      {models.map((model, index) => {
        const presetKey = getAiModelPresetOptionKeyForModel(providerType, model)
        return (
          <div key={model.id} className="grid min-h-8 gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)]">
            <div className="min-w-0">
              <div className="truncate font-mono text-[11px] font-bold text-slate-900">{model.id}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <ModelTagBadges model={model} />
              </div>
            </div>
            <label className="grid min-w-0 gap-1 text-[10px] font-black text-slate-500">
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span>{COPY.modelPreset}</span>
                {presetKey ? <Badge variant="outline">{COPY.modelPresetMatched}</Badge> : null}
              </span>
              <select
                className="h-7 w-full max-w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-[#d95a1b] focus:ring-2 focus:ring-[#d95a1b]/15"
                value={presetKey}
                onChange={(event) => onApplyPreset(index, event.target.value)}
              >
                <option value="" disabled>{COPY.modelPresetPlaceholder}</option>
                {listAiModelPresetOptions(providerType).map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.providerName} / {option.model.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )
      })}
    </div>
  )
}

function ModelTagBadges({ model }: { model: AiProviderModel }) {
  return (
    <>
      {model.capabilities.map((capability) => (
        <Badge key={capability} variant="outline">
          {COPY.capabilities}:{COPY.outputTypes[capability]}
        </Badge>
      ))}
      <Badge variant={model.toolCalling === 'supported' ? 'default' : model.toolCalling === 'unsupported' ? 'danger' : 'outline'}>
        {COPY.toolCalling}:{COPY.toolCallingStatus[model.toolCalling]}
      </Badge>
      <Badge variant={aiModelSupportsThinking(model) ? 'default' : 'outline'}>
        {COPY.thinkingSupport}:{aiModelSupportsThinking(model) ? COPY.thinkingSupported : COPY.thinkingUnsupported}
      </Badge>
      <Badge variant={aiModelSupportsReferenceImage(model) ? 'default' : 'outline'}>
        {COPY.referenceImage}:{aiModelSupportsReferenceImage(model) ? COPY.thinkingSupported : COPY.thinkingUnsupported}
      </Badge>
      <Badge variant={aiModelSupportsReferenceFile(model) ? 'default' : 'outline'}>
        {COPY.referenceFile}:{aiModelSupportsReferenceFile(model) ? COPY.thinkingSupported : COPY.thinkingUnsupported}
      </Badge>
    </>
  )
}

function createCommonProviderFormState(preset: AiProviderPreset): CommonAiProviderFormState {
  return {
    id: '',
    name: preset.name,
    providerType: preset.providerType,
    baseUrl: preset.baseUrl,
    apiKey: '',
    models: [],
  }
}

function fetchJson(url: string, init: { method: string; body?: Record<string, unknown> }) {
  return fetch(url, {
    method: init.method,
    headers: { 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
    .then((result) => result.json().catch(() => null))
    .catch(() => null)
}
