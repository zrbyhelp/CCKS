'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Bot, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppHeader } from '@/components/app-header'
import { PortalBackground } from '@/components/portal-background'
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

type AiProviderFormState = {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: AiProviderModel[]
}

type AppAlert = {
  id: number
  title: string
  description: string
}

const COPY = {
  title: '配置中心',
  workbench: '网页管理',
  variables: '变量管理',
  community: '社区',
  section: 'AI 供应商配置',
  sectionDesc: '维护供应商网址、接口获取的模型列表和加密保存的 API Key。',
  providerPreset: '常用网址',
  providerName: '供应商名称',
  providerBaseUrl: '供应商网址',
  providerApiKey: 'API Key',
  providerApiKeyPlaceholder: '留空则保留已保存密钥',
  providerModels: '模型列表',
  providerModelsHint: '模型列表从供应商接口获取；保存前请先获取模型。',
  providerModelsEmpty: '尚未获取模型，请填写供应商网址和 API Key 后获取。',
  capabilities: '能力',
  toolCalling: '工具',
  thinkingSupport: '思考',
  thinkingSupported: '支持',
  thinkingUnsupported: '不支持',
  referenceImage: '参考图',
  referenceFile: '参考文件',
  modelPreset: '模型预设',
  modelPresetPlaceholder: '选择模型预设',
  modelPresetMatched: '已匹配',
  outputTypes: {
    text: '文本',
    image: '图片',
  },
  toolCallingStatus: {
    supported: '工具调用',
    unsupported: '无工具调用',
    unknown: '工具未知',
  },
  pullModels: '获取模型',
  pullingModels: '获取中',
  addAiProvider: '新增供应商',
  saveAiProvider: '保存供应商',
  updateAiProvider: '更新供应商',
  edit: '编辑',
  delete: '删除',
  refresh: '刷新',
  noAiProvider: '暂无 AI 供应商，请先添加一个供应商。',
  providerDeleteConfirm: '确认删除 AI 供应商「{name}」？',
  providerHasKey: '密钥已加密保存',
  providerNoKey: '未保存密钥',
  loading: '加载中...',
  errorTitle: '操作失败',
}

export function ConfigCenterPage() {
  const [providers, setProviders] = useState<AiProviderSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [appAlert, setAppAlert] = useState<AppAlert | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: unknown } | null) => {
        if (cancelled) return
        setSessionChecked(true)
        if (!data?.user) {
          redirectToLogin()
          return
        }
        void loadAiProviders()
      })
      .catch(() => {
        if (cancelled) return
        setSessionChecked(true)
        redirectToLogin()
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!appAlert) return
    const timer = window.setTimeout(() => {
      setAppAlert((current) => (current?.id === appAlert.id ? null : current))
    }, 6500)

    return () => window.clearTimeout(timer)
  }, [appAlert])

  function showAppAlert(description: string, title = COPY.errorTitle) {
    setAppAlert({
      id: Date.now(),
      title,
      description,
    })
  }

  async function loadAiProviders() {
    setLoading(true)
    const response = await fetch('/api/ai-providers')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setLoading(false))

    if (!response?.ok) {
      showAppAlert(response?.message || 'AI 供应商加载失败')
      return
    }

    setProviders(Array.isArray(response.providers) ? response.providers : [])
  }

  return (
    <div className="relative flex min-h-screen min-w-[1080px] flex-col overflow-hidden bg-transparent text-slate-900">
      <PortalBackground />
      <TopCenterAlert alert={appAlert} onDismiss={() => setAppAlert(null)} />

      <AppHeader
        activeItem="config"
        labels={{ workbench: COPY.workbench, variables: COPY.variables, community: COPY.community, config: COPY.title }}
      />

      <main className="relative z-10 min-h-0 flex-1 overflow-auto p-4">
        <section className="mx-auto flex max-w-[1380px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 text-[#d95a1b]" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black text-slate-950">{COPY.section}</h1>
                <p className="truncate text-[11px] text-slate-500">{COPY.sectionDesc}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadAiProviders()} disabled={loading || !sessionChecked}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {COPY.refresh}
            </Button>
          </div>

          <div className="grid min-h-0 gap-3 p-3 lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
            <AiProviderForm providers={providers} onRefresh={loadAiProviders} onNotify={showAppAlert} />
            <AiProviderList providers={providers} loading={loading} onEditNotify={showAppAlert} onRefresh={loadAiProviders} />
          </div>
        </section>
      </main>
    </div>
  )
}

function AiProviderForm({
  providers,
  onRefresh,
  onNotify,
}: {
  providers: AiProviderSummary[]
  onRefresh: () => Promise<void>
  onNotify: (description: string, title?: string) => void
}) {
  const [form, setForm] = useState<AiProviderFormState>(() => createAiProviderFormState(AI_PROVIDER_PRESETS[0]))
  const [pullingModels, setPullingModels] = useState(false)
  const editing = Boolean(form.id)

  function applyPreset(providerType: string) {
    const preset = AI_PROVIDER_PRESETS.find((item) => item.providerType === providerType) || AI_PROVIDER_PRESETS[0]
    setForm((current) => ({
      ...current,
      name: current.id ? current.name : preset.name,
      baseUrl: preset.baseUrl,
      models: [],
    }))
  }

  function updateBaseUrl(baseUrl: string) {
    setForm((current) => ({ ...current, baseUrl, models: baseUrl === current.baseUrl ? current.models : [] }))
  }

  function applyModelPreset(index: number, presetKey: string) {
    const option = findAiModelPresetOption(presetKey)
    if (!option) return
    setForm((current) => ({
      ...current,
      models: current.models.map((model, modelIndex) => (modelIndex === index ? applyAiModelPreset(model, option.model, createAiModelPresetRef(option)) : model)),
    }))
  }

  async function submitProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.models.length) {
      onNotify('请先获取模型列表，再保存供应商。')
      return
    }

    const response = await fetchJson('/api/ai-providers', {
      method: editing ? 'PATCH' : 'POST',
      body: {
        providerId: form.id,
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models,
      },
    })

    if (!response?.ok) {
      onNotify(response?.message || 'AI 供应商保存失败')
      return
    }

    setForm(createAiProviderFormState(AI_PROVIDER_PRESETS[0]))
    await onRefresh()
  }

  async function pullModels() {
    setPullingModels(true)
    const response = await fetchJson('/api/ai-providers/models', {
      method: 'POST',
      body: {
        providerId: form.id,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
      },
    }).finally(() => setPullingModels(false))

    if (!response?.ok || !Array.isArray(response.models)) {
      onNotify(response?.message || '模型列表获取失败')
      return
    }

    setForm((current) => ({ ...current, models: response.models }))
  }

  useEffect(() => {
    const editingProvider = providers.find((provider) => provider.id === form.id)
    if (!form.id || editingProvider) return
    setForm(createAiProviderFormState(AI_PROVIDER_PRESETS[0]))
  }, [form.id, providers])

  return (
    <form className="rounded-md border border-slate-200 bg-white p-3" onSubmit={submitProvider}>
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
                  form.baseUrl === preset.baseUrl ? 'border-[#d95a1b] bg-[#fff1e8] text-[#9a3412]' : 'border-slate-200 bg-white text-slate-600 hover:border-[#f2b28d] hover:bg-[#fff7f2]',
                )}
                onClick={() => applyPreset(preset.providerType)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            {COPY.providerName}
            <Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            {COPY.providerBaseUrl}
            <Input className="mt-1" value={form.baseUrl} onChange={(event) => updateBaseUrl(event.target.value)} required />
          </label>
        </div>
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
        <label className="block text-xs font-semibold text-slate-600">
          <span className="flex items-center justify-between gap-2">
            {COPY.providerModels}
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
          </span>
          <ModelPreviewList
            models={form.models}
            emptyText={COPY.providerModelsEmpty}
            providerType={inferAiProviderTypeFromBaseUrl(form.baseUrl)}
            onApplyPreset={applyModelPreset}
          />
          <span className="mt-1 block text-[10px] font-normal text-slate-500">{COPY.providerModelsHint}</span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" type="submit">
          {editing ? COPY.updateAiProvider : COPY.saveAiProvider}
        </Button>
        {editing ? (
          <Button size="sm" type="button" variant="outline" onClick={() => setForm(createAiProviderFormState(AI_PROVIDER_PRESETS[0]))}>
            <Plus className="h-3 w-3" />
            {COPY.addAiProvider}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function AiProviderList({
  providers,
  loading,
  onEditNotify,
  onRefresh,
}: {
  providers: AiProviderSummary[]
  loading: boolean
  onEditNotify: (description: string, title?: string) => void
  onRefresh: () => Promise<void>
}) {
  const [editingProviderId, setEditingProviderId] = useState('')

  async function deleteProvider(provider: AiProviderSummary) {
    if (!window.confirm(COPY.providerDeleteConfirm.replace('{name}', provider.name))) return
    const response = await fetchJson('/api/ai-providers', {
      method: 'DELETE',
      body: { providerId: provider.id },
    })

    if (!response?.ok) {
      onEditNotify(response?.message || 'AI 供应商删除失败')
      return
    }

    await onRefresh()
  }

  if (loading && !providers.length) {
    return <div className="rounded-md border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">{COPY.loading}</div>
  }

  return (
    <div className="grid content-start gap-2">
      {providers.map((provider) => (
        <article key={provider.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-xs font-black text-slate-900">{provider.name}</h2>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{provider.baseUrl}</p>
            </div>
            <Badge variant="outline">{provider.hasApiKey ? COPY.providerHasKey : COPY.providerNoKey}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {provider.models.map((model) => (
              <div key={model.id} className="flex min-w-0 flex-wrap items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
                <span className="max-w-48 truncate font-mono text-[10px] font-black text-slate-700">{model.id}</span>
                <ModelTagBadges model={model} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" type="button" onClick={() => setEditingProviderId(editingProviderId === provider.id ? '' : provider.id)}>
              <Pencil className="h-3 w-3" />
              {COPY.edit}
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => void deleteProvider(provider)}>
              <Trash2 className="h-3 w-3" />
              {COPY.delete}
            </Button>
          </div>
          {editingProviderId === provider.id ? <InlineProviderEditor provider={provider} onClose={() => setEditingProviderId('')} onNotify={onEditNotify} onRefresh={onRefresh} /> : null}
        </article>
      ))}
      {!providers.length ? <p className="rounded-md border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">{COPY.noAiProvider}</p> : null}
    </div>
  )
}

function InlineProviderEditor({
  provider,
  onClose,
  onNotify,
  onRefresh,
}: {
  provider: AiProviderSummary
  onClose: () => void
  onNotify: (description: string, title?: string) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState<AiProviderFormState>({
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: '',
    models: provider.models,
  })
  const [pullingModels, setPullingModels] = useState(false)

  function updateBaseUrl(baseUrl: string) {
    setForm((current) => ({ ...current, baseUrl, models: baseUrl === current.baseUrl ? current.models : [] }))
  }

  function applyModelPreset(index: number, presetKey: string) {
    const option = findAiModelPresetOption(presetKey)
    if (!option) return
    setForm((current) => ({
      ...current,
      models: current.models.map((model, modelIndex) => (modelIndex === index ? applyAiModelPreset(model, option.model, createAiModelPresetRef(option)) : model)),
    }))
  }

  async function submitProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.models.length) {
      onNotify('请先获取模型列表，再保存供应商。')
      return
    }

    const response = await fetchJson('/api/ai-providers', {
      method: 'PATCH',
      body: {
        providerId: form.id,
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models,
      },
    })

    if (!response?.ok) {
      onNotify(response?.message || 'AI 供应商保存失败')
      return
    }

    onClose()
    await onRefresh()
  }

  async function pullModels() {
    setPullingModels(true)
    const response = await fetchJson('/api/ai-providers/models', {
      method: 'POST',
      body: {
        providerId: form.id,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
      },
    }).finally(() => setPullingModels(false))

    if (!response?.ok || !Array.isArray(response.models)) {
      onNotify(response?.message || '模型列表获取失败')
      return
    }

    setForm((current) => ({ ...current, models: response.models }))
  }

  return (
    <form className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2" onSubmit={submitProvider}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <Input value={form.baseUrl} onChange={(event) => updateBaseUrl(event.target.value)} required />
      </div>
      <Input
        type="password"
        value={form.apiKey}
        onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
        placeholder={COPY.providerApiKeyPlaceholder}
      />
      <div>
        <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
          <span>{COPY.providerModels}</span>
          <Button className="h-7" size="sm" type="button" variant="outline" onClick={() => void pullModels()} disabled={pullingModels || !form.baseUrl}>
            <RefreshCw className={cn('h-3 w-3', pullingModels && 'animate-spin')} />
            {pullingModels ? COPY.pullingModels : COPY.pullModels}
          </Button>
        </div>
        <ModelPreviewList
          models={form.models}
          emptyText={COPY.providerModelsEmpty}
          providerType={inferAiProviderTypeFromBaseUrl(form.baseUrl, provider.providerType)}
          onApplyPreset={applyModelPreset}
          compact
        />
        <span className="mt-1 block text-[10px] font-normal text-slate-500">{COPY.providerModelsHint}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          {COPY.updateAiProvider}
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
      </div>
    </form>
  )
}

function getToolCallingBadgeVariant(model: AiProviderModel) {
  if (model.toolCalling === 'supported') return 'default'
  if (model.toolCalling === 'unsupported') return 'danger'
  return 'outline'
}

function ModelPreviewList({
  models,
  emptyText,
  providerType,
  onApplyPreset,
  compact = false,
}: {
  models: AiProviderModel[]
  emptyText: string
  providerType: string
  onApplyPreset?: (index: number, presetKey: string) => void
  compact?: boolean
}) {
  if (!models.length) {
    return (
      <div className={cn('mt-1 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500', compact ? 'py-4' : 'py-8 text-center')}>
        {emptyText}
      </div>
    )
  }

  return (
    <div className={cn('mt-1 grid max-h-52 gap-1.5 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2', compact ? 'max-h-36' : '')}>
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
          {onApplyPreset ? (
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
          ) : null}
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
      <Badge variant={getToolCallingBadgeVariant(model)}>
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

function TopCenterAlert({
  alert,
  onDismiss,
}: {
  alert: AppAlert | null
  onDismiss: () => void
}) {
  if (!alert) return null

  return (
    <div className="fixed left-1/2 top-3 z-[70] w-[min(520px,calc(100vw-32px))] -translate-x-1/2">
      <Alert variant="destructive" className="flex items-start gap-2 pr-9 shadow-[0_18px_42px_rgba(154,52,18,0.18)]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d95a1b]" />
        <div className="min-w-0 flex-1">
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.description}</AlertDescription>
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-[#9a3412]/70 hover:bg-[#ffe5d7] hover:text-[#9a3412]"
          aria-label="关闭"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </Alert>
    </div>
  )
}

function createAiProviderFormState(preset: AiProviderPreset): AiProviderFormState {
  return {
    id: '',
    name: preset.name,
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

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`
  window.location.href = `/api/auth/login?next=${encodeURIComponent(next || '/')}`
}
