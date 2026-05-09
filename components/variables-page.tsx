'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Aperture,
  Bot,
  Boxes,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileJson,
  Filter,
  Layers3,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { AppHeader } from '@/components/app-header'
import { PortalBackground } from '@/components/portal-background'
import { cn } from '@/lib/utils'
import {
  formatRecipeVariableSourceId,
  getRecipeVariableStats,
  type Locale,
  type RecipeVariableCategory,
  type RecipeVariableItem,
  type RecipeVariableScope,
  type RecipeVariableStats,
} from '@/lib/recipe-variables'

const COPY = {
  title: '变量管理',
  workbench: '网页管理',
  community: '社区',
  config: '配置中心',
  section: '配方变量管理',
  sectionDesc: '维护图片生成、文本生成和 Agent 提示词中可复用的配方变量。',
  loading: '加载中...',
  refresh: '刷新',
  import: '词库导入',
  export: '词库导出',
  createVariable: '创建变量',
  addCategory: '新增词库',
  editCategory: '编辑词库',
  addVariable: '新增个人变量',
  editVariable: '编辑变量',
  save: '保存',
  create: '创建',
  cancel: '取消',
  copyAsPersonal: '复制为个人变量',
  emptyCategory: '暂无匹配词库',
  emptyVariable: '当前词库没有匹配变量',
  multi: '多选',
  single: '单选',
  noDefault: '未设置',
  soon: '导入解析即将支持',
  categoryDeleteConfirm: '确认删除个人词库「{name}」？词库下的个人变量也会删除。',
  variableDeleteConfirm: '确认删除个人变量「{name}」？',
  errorTitle: '操作失败',
  tabs: {
    library: ['词库管理', '词库分组'],
    variable: ['变量管理', '变量分组'],
  },
  stats: {
    system: '系统配方变量',
    personal: '个人配方变量',
    community: '社区配方变量',
    multi: '支持多选变量',
    updated: '最近更新',
  },
  scopes: {
    all: '全部来源',
    system: '系统',
    personal: '个人',
    community: '社区',
  },
}

type AppAlert = {
  id: number
  title: string
  description: string
}

type CategoryFormState = {
  categoryId: string
  nameZh: string
  nameEn: string
  icon: string
  descriptionZh: string
  descriptionEn: string
  tipZh: string
  tipEn: string
}

type VariableFormState = {
  variableId: string
  categoryId: string
  variableName: string
  nameZh: string
  nameEn: string
  contentZh: string
  contentEn: string
  candidatesZh: string
  candidatesEn: string
  defaultValues: string
  multiple: boolean
}

type DialogState =
  | { kind: 'category'; value: CategoryFormState }
  | { kind: 'variable'; value: VariableFormState }

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  categoryId: '',
  nameZh: '',
  nameEn: '',
  icon: 'boxes',
  descriptionZh: '',
  descriptionEn: '',
  tipZh: '',
  tipEn: '',
}

const EMPTY_VARIABLE_FORM: VariableFormState = {
  variableId: '',
  categoryId: '',
  variableName: '',
  nameZh: '',
  nameEn: '',
  contentZh: '',
  contentEn: '',
  candidatesZh: '',
  candidatesEn: '',
  defaultValues: '',
  multiple: false,
}

const SCOPE_META: Record<RecipeVariableScope, { label: string; icon: LucideIcon; className: string; dotClassName: string }> = {
  system: {
    label: '系统',
    icon: Layers3,
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    dotClassName: 'bg-slate-400',
  },
  personal: {
    label: '个人',
    icon: UserRound,
    className: 'border-[#ffd8c4] bg-[#fff2ea] text-[#b94712]',
    dotClassName: 'bg-[#FB7E3D]',
  },
  community: {
    label: '社区',
    icon: Users,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-400',
  },
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  aperture: Aperture,
  palette: Palette,
  'user-round': UserRound,
  store: Store,
  bot: Bot,
  boxes: Boxes,
}

export function VariablesPage() {
  const [sessionChecked, setSessionChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [categories, setCategories] = useState<RecipeVariableCategory[]>([])
  const [stats, setStats] = useState<RecipeVariableStats>({ system: 0, personal: 0, community: 0 })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [appAlert, setAppAlert] = useState<AppAlert | null>(null)
  const [categoryScope, setCategoryScope] = useState<RecipeVariableScope | 'all'>('all')
  const [variableScope, setVariableScope] = useState<RecipeVariableScope | 'all'>('all')
  const [categorySearch, setCategorySearch] = useState('')
  const [variableSearch, setVariableSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [dialog, setDialog] = useState<DialogState | null>(null)

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
        setAuthorized(true)
        void loadCatalog()
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

  const flatVariables = useMemo(
    () => categories.flatMap((category) => category.variables.map((variable) => ({ category, variable }))),
    [categories],
  )
  const personalCategories = categories.filter((category) => category.scope === 'personal')
  const multiCount = flatVariables.filter(({ variable }) => variable.multiple).length
  const latestUpdated = findLatestUpdated(categories)

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLocaleLowerCase()
    return categories
      .filter((category) => categoryScope === 'all' || category.scope === categoryScope)
      .filter((category) => {
        if (!query) return true
        return (
          includesLocalized(category.name, query) ||
          includesLocalized(category.description, query) ||
          includesLocalized(category.tip, query) ||
          category.variables.some((variable) => matchesVariable(variable, query))
        )
      })
  }, [categories, categoryScope, categorySearch])

  const selectedCategory = filteredCategories.find((category) => category.id === selectedCategoryId) || filteredCategories[0] || null
  const filteredVariables = useMemo(() => {
    const query = variableSearch.trim().toLocaleLowerCase()
    const source = selectedCategory ? selectedCategory.variables : flatVariables.map(({ variable }) => variable)
    return source
      .filter((variable) => variableScope === 'all' || variable.scope === variableScope)
      .filter((variable) => !query || matchesVariable(variable, query))
  }, [flatVariables, selectedCategory, variableScope, variableSearch])

  useEffect(() => {
    if (!filteredCategories.length) {
      setSelectedCategoryId('')
      return
    }
    if (!selectedCategoryId || !filteredCategories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(filteredCategories[0].id)
    }
  }, [filteredCategories, selectedCategoryId])

  function showAppAlert(description: string, title = COPY.errorTitle) {
    setAppAlert({
      id: Date.now(),
      title,
      description,
    })
  }

  async function loadCatalog() {
    setLoading(true)
    const response = await fetch('/api/recipe-variables')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setLoading(false))

    if (!response?.ok) {
      showAppAlert(response?.message || '配方变量加载失败')
      return
    }

    const nextCategories = Array.isArray(response.categories) ? response.categories : []
    setCategories(nextCategories)
    setStats(response.stats || getRecipeVariableStats(nextCategories))
  }

  async function submitCategory(value: CategoryFormState) {
    if (saving) return
    setSaving(true)
    const editing = Boolean(value.categoryId)
    const response = await fetchJson('/api/recipe-variables', {
      method: editing ? 'PATCH' : 'POST',
      body: {
        kind: 'category',
        categoryId: value.categoryId,
        name: { zh: value.nameZh, en: value.nameEn },
        icon: value.icon,
        description: { zh: value.descriptionZh, en: value.descriptionEn },
        tip: { zh: value.tipZh, en: value.tipEn },
      },
    }).finally(() => setSaving(false))

    if (!response?.ok) {
      showAppAlert(response?.message || '词库保存失败')
      return
    }

    setDialog(null)
    await loadCatalog()
    if (response.category?.id) setSelectedCategoryId(response.category.id)
  }

  async function submitVariable(value: VariableFormState) {
    if (saving) return
    setSaving(true)
    const editing = Boolean(value.variableId)
    const response = await fetchJson('/api/recipe-variables', {
      method: editing ? 'PATCH' : 'POST',
      body: {
        variableId: value.variableId,
        categoryId: value.categoryId,
        variableName: value.variableName,
        name: { zh: value.nameZh, en: value.nameEn },
        content: { zh: value.contentZh, en: value.contentEn },
        candidates: {
          zh: splitList(value.candidatesZh),
          en: splitList(value.candidatesEn),
        },
        defaultValues: splitList(value.defaultValues),
        multiple: value.multiple,
      },
    }).finally(() => setSaving(false))

    if (!response?.ok) {
      showAppAlert(response?.message || '变量保存失败')
      return
    }

    setDialog(null)
    await loadCatalog()
  }

  async function deleteCategory(category: RecipeVariableCategory) {
    if (category.scope !== 'personal') return
    if (!window.confirm(COPY.categoryDeleteConfirm.replace('{name}', category.name.zh))) return
    const response = await fetchJson('/api/recipe-variables', {
      method: 'DELETE',
      body: { kind: 'category', categoryId: category.id },
    })
    if (!response?.ok) {
      showAppAlert(response?.message || '词库删除失败')
      return
    }
    await loadCatalog()
  }

  async function deleteVariable(variable: RecipeVariableItem) {
    if (variable.scope !== 'personal') return
    if (!window.confirm(COPY.variableDeleteConfirm.replace('{name}', variable.name.zh))) return
    const response = await fetchJson('/api/recipe-variables', {
      method: 'DELETE',
      body: { variableId: variable.id },
    })
    if (!response?.ok) {
      showAppAlert(response?.message || '变量删除失败')
      return
    }
    await loadCatalog()
  }

  async function copyVariable(variable: RecipeVariableItem) {
    const response = await fetchJson('/api/recipe-variables', {
      method: 'POST',
      body: { kind: 'copy', sourceId: formatRecipeVariableSourceId(variable) },
    })
    if (!response?.ok) {
      showAppAlert(response?.message || '变量复制失败')
      return
    }
    setVariableScope('personal')
    setCategoryScope('personal')
    await loadCatalog()
  }

  function startCreateVariable() {
    setDialog({
      kind: 'variable',
      value: {
        ...EMPTY_VARIABLE_FORM,
        categoryId: selectedCategory?.scope === 'personal' ? selectedCategory.id : personalCategories[0]?.id || '',
      },
    })
  }

  function exportCatalog() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), categories }, null, 2)
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ccks-recipe-variables-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative flex min-h-screen min-w-[1180px] flex-col overflow-hidden bg-transparent text-slate-900">
      <PortalBackground />
      <TopCenterAlert alert={appAlert} onDismiss={() => setAppAlert(null)} />
      <AppHeader
        activeItem="variables"
        labels={{ workbench: COPY.workbench, variables: COPY.title, community: COPY.community, config: COPY.config }}
      />

      <main className="relative z-10 min-h-0 flex-1 overflow-auto p-4">
        <section className="mx-auto flex max-w-[1500px] flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="grid min-w-0 flex-1 grid-cols-5 gap-3">
              <MetricCard icon={Layers3} label={COPY.stats.system} value={stats.system} hint="内置词库" />
              <MetricCard icon={UserRound} label={COPY.stats.personal} value={stats.personal} hint="可编辑维护" />
              <MetricCard icon={Users} label={COPY.stats.community} value={stats.community} hint="社区精选" />
              <MetricCard icon={CheckCircle2} label={COPY.stats.multi} value={multiCount} hint="支持默认多值" />
              <MetricCard icon={Clock3} label={COPY.stats.updated} value={latestUpdated.label} hint={latestUpdated.byline} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" title={COPY.soon} onClick={() => showAppAlert(COPY.soon, '提示')}>
                <Upload className="h-3.5 w-3.5" />
                {COPY.import}
              </Button>
              <Button variant="outline" size="sm" onClick={exportCatalog} disabled={!categories.length}>
                <Download className="h-3.5 w-3.5" />
                {COPY.export}
              </Button>
              <Button size="sm" onClick={startCreateVariable} disabled={!personalCategories.length}>
                <Plus className="h-3.5 w-3.5" />
                {COPY.createVariable}
              </Button>
            </div>
          </div>

          <div className="grid min-h-[650px] grid-cols-[minmax(430px,0.88fr)_minmax(620px,1.12fr)] gap-3">
            <PanelShell
              title={COPY.tabs.library[0]}
              inactiveTitle={COPY.tabs.library[1]}
              action={
                <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'category', value: EMPTY_CATEGORY_FORM })}>
                  <Plus className="h-3.5 w-3.5" />
                  {COPY.addCategory}
                </Button>
              }
            >
              <PanelToolbar>
                <SearchInput value={categorySearch} placeholder="搜索词库名称或变量" onChange={setCategorySearch} />
                <ScopeSelect value={categoryScope} onChange={setCategoryScope} />
                <Button variant="outline" size="sm" onClick={() => void loadCatalog()} disabled={loading || !authorized}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  {COPY.refresh}
                </Button>
              </PanelToolbar>

              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
                {filteredCategories.length ? (
                  filteredCategories.map((category) => (
                    <LibraryCard
                      key={`${category.scope}:${category.id}`}
                      category={category}
                      active={selectedCategory?.id === category.id}
                      onSelect={() => setSelectedCategoryId(category.id)}
                      onEdit={() => setDialog({ kind: 'category', value: createCategoryFormState(category) })}
                      onDelete={() => void deleteCategory(category)}
                    />
                  ))
                ) : (
                  <EmptyState text={sessionChecked && authorized ? COPY.emptyCategory : COPY.loading} />
                )}
              </div>
            </PanelShell>

            <PanelShell
              title={COPY.tabs.variable[0]}
              inactiveTitle={COPY.tabs.variable[1]}
              action={
                <Button size="sm" onClick={startCreateVariable} disabled={!personalCategories.length}>
                  <Plus className="h-3.5 w-3.5" />
                  {COPY.addVariable}
                </Button>
              }
            >
              <PanelToolbar>
                <SearchInput value={variableSearch} placeholder="搜索变量名、默认值或内容" onChange={setVariableSearch} />
                <ScopeSelect value={variableScope} onChange={setVariableScope} />
                <div className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  {selectedCategory?.name.zh || '全部词库'}
                </div>
              </PanelToolbar>

              <div className="min-h-0 flex-1 overflow-auto p-3 pt-0">
                <VariableTable
                  variables={filteredVariables}
                  selectedCategory={selectedCategory}
                  onEdit={(variable) => setDialog({ kind: 'variable', value: createVariableFormState(variable, selectedCategory?.id || '') })}
                  onDelete={(variable) => void deleteVariable(variable)}
                  onCopy={(variable) => void copyVariable(variable)}
                />
              </div>
            </PanelShell>
          </div>
        </section>
      </main>

      {dialog ? (
        <VariableDialog
          dialog={dialog}
          saving={saving}
          personalCategories={personalCategories}
          onChange={setDialog}
          onClose={() => setDialog(null)}
          onSubmitCategory={submitCategory}
          onSubmitVariable={submitVariable}
        />
      ) : null}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  hint: string
}) {
  return (
    <div className="flex h-[86px] items-center gap-3 rounded-md border border-slate-200 bg-white/95 px-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#fff2ea] text-[#d95a1b]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-black leading-none text-slate-950">{value}</p>
        <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{hint}</p>
      </div>
    </div>
  )
}

function PanelShell({
  title,
  inactiveTitle,
  action,
  children,
}: {
  title: string
  inactiveTitle: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white/95 shadow-[0_14px_38px_rgba(15,23,42,0.05)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-3">
        <div className="flex h-full min-w-0 items-center gap-5">
          <button type="button" className="h-full border-b-2 border-[#FB7E3D] px-1 text-xs font-black text-[#d95a1b]">
            {title}
          </button>
          <button type="button" className="h-full border-b-2 border-transparent px-1 text-xs font-black text-slate-500 hover:text-slate-800">
            {inactiveTitle}
          </button>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function PanelToolbar({ children }: { children: React.ReactNode }) {
  return <div className="grid shrink-0 grid-cols-[minmax(180px,1fr)_160px_auto] gap-2 border-b border-slate-100 p-3">{children}</div>
}

function SearchInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <Input className="pl-7" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function ScopeSelect({
  value,
  onChange,
}: {
  value: RecipeVariableScope | 'all'
  onChange: (value: RecipeVariableScope | 'all') => void
}) {
  return (
    <select
      className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-slate-600 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      value={value}
      onChange={(event) => onChange(event.target.value as RecipeVariableScope | 'all')}
    >
      <option value="all">{COPY.scopes.all}</option>
      <option value="system">{COPY.scopes.system}</option>
      <option value="personal">{COPY.scopes.personal}</option>
      <option value="community">{COPY.scopes.community}</option>
    </select>
  )
}

function LibraryCard({
  category,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  category: RecipeVariableCategory
  active: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = CATEGORY_ICONS[category.icon] || Boxes
  const previews = category.variables.slice(0, 5)
  const change = category.changeLog[0]
  const lastUpdated = formatDateTime(category.updatedAt)

  return (
    <button
      type="button"
      className={cn(
        'group w-full rounded-md border bg-white p-3 text-left transition hover:border-[#ffd8c4] hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)]',
        active ? 'border-[#FB7E3D] shadow-[0_0_0_2px_rgba(251,126,61,0.12)]' : 'border-slate-200',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#fff2ea] text-[#d95a1b]">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-slate-950">{category.name.zh}</p>
            <ScopeBadge scope={category.scope} />
          </div>
          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-slate-500">{category.description.zh}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previews.map((variable) => (
              <span key={variable.id} className="max-w-[110px] truncate rounded bg-[#fff2ea] px-1.5 py-0.5 text-[10px] font-black text-[#b94712]">
                {variable.name.zh}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-[11px] font-black text-[#d95a1b]">查看词条</span>
          <MoreVertical className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_86px_90px] items-center gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black text-slate-500">内部 Tip</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{category.tip.zh || '保持变量命名稳定，提示词可长期复用。'}</p>
        </div>
        <div className="border-l border-slate-100 pl-3">
          <p className="text-[11px] font-black text-slate-500">词条数量</p>
          <p className="mt-0.5 text-sm font-black text-slate-950">{category.variables.length}</p>
        </div>
        <div className="border-l border-slate-100 pl-3">
          <p className="text-[11px] font-black text-slate-500">最近更新</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-600">{lastUpdated}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
        <span className="truncate">{change?.note.zh || '暂无更新日志'}</span>
        {category.scope === 'personal' ? (
          <span className="flex shrink-0 opacity-0 transition group-hover:opacity-100">
            <span
              role="button"
              tabIndex={0}
              className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onEdit()
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </span>
            <span
              role="button"
              tabIndex={0}
              className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
          </span>
        ) : null}
      </div>
    </button>
  )
}

function VariableTable({
  variables,
  selectedCategory,
  onEdit,
  onDelete,
  onCopy,
}: {
  variables: RecipeVariableItem[]
  selectedCategory: RecipeVariableCategory | null
  onEdit: (variable: RecipeVariableItem) => void
  onDelete: (variable: RecipeVariableItem) => void
  onCopy: (variable: RecipeVariableItem) => void
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            <TableHead className="w-[22%]">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300" />
                名称
              </label>
            </TableHead>
            <TableHead className="w-[18%]">变量名</TableHead>
            <TableHead>默认值</TableHead>
            <TableHead className="w-24">多选</TableHead>
            <TableHead className="w-36">更新时间</TableHead>
            <TableHead className="w-28 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables.length ? (
            variables.map((variable) => (
              <VariableRow
                key={`${variable.scope}:${variable.id}`}
                variable={variable}
                selectedCategory={selectedCategory}
                onEdit={() => onEdit(variable)}
                onDelete={() => onDelete(variable)}
                onCopy={() => onCopy(variable)}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-xs font-bold text-slate-500">
                {COPY.emptyVariable}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function VariableRow({
  variable,
  selectedCategory,
  onEdit,
  onDelete,
  onCopy,
}: {
  variable: RecipeVariableItem
  selectedCategory: RecipeVariableCategory | null
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
}) {
  const defaultText = variable.defaultValues.length ? variable.defaultValues.join(' / ') : COPY.noDefault
  const candidateText = variable.candidates.zh.length ? variable.candidates.zh.join(' / ') : '未设置候选值'
  const change = variable.changeLog[0]

  return (
    <TableRow className="group relative">
      <TableCell className="relative">
        <div className="flex min-w-0 items-center gap-2">
          <input type="checkbox" className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
          <ScopeBadge scope={variable.scope} />
          <span className="truncate font-black text-[#d95a1b]">{variable.name.zh}</span>
        </div>
        <div className="pointer-events-none absolute left-8 top-9 z-20 hidden w-[420px] rounded-md border border-slate-200 bg-white p-3 text-left shadow-[0_22px_60px_rgba(15,23,42,0.16)] group-hover:block">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-950">{variable.name.zh}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-600">{variable.content.zh}</p>
            </div>
            <ScopeBadge scope={variable.scope} />
          </div>
          <div className="mt-2 grid gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
            <p><span className="font-black text-slate-700">候选值：</span>{candidateText}</p>
            <p><span className="font-black text-slate-700">所属词库：</span>{selectedCategory?.name.zh || '-'}</p>
            <p><span className="font-black text-slate-700">更新日志：</span>{change?.note.zh || '暂无更新日志'}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-700">{variable.variableName}</code>
      </TableCell>
      <TableCell className="max-w-[260px] truncate text-slate-600">{defaultText}</TableCell>
      <TableCell>
        <Badge variant={variable.multiple ? 'default' : 'outline'}>{variable.multiple ? COPY.multi : COPY.single}</Badge>
      </TableCell>
      <TableCell className="text-slate-500">{formatDateTime(variable.updatedAt)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {variable.scope === 'personal' ? (
            <>
              <Button variant="ghost" size="icon" title={COPY.editVariable} onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" title="删除" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" title={COPY.copyAsPersonal} onClick={onCopy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function VariableDialog({
  dialog,
  saving,
  personalCategories,
  onChange,
  onClose,
  onSubmitCategory,
  onSubmitVariable,
}: {
  dialog: DialogState
  saving: boolean
  personalCategories: RecipeVariableCategory[]
  onChange: (dialog: DialogState | null) => void
  onClose: () => void
  onSubmitCategory: (value: CategoryFormState) => Promise<void>
  onSubmitVariable: (value: VariableFormState) => Promise<void>
}) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/30 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="flex h-full w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {dialog.kind === 'category' ? <FileJson className="h-4 w-4 text-[#d95a1b]" /> : <Boxes className="h-4 w-4 text-[#d95a1b]" />}
            <h2 className="truncate text-sm font-black text-slate-950">
              {dialog.kind === 'category'
                ? dialog.value.categoryId
                  ? COPY.editCategory
                  : COPY.addCategory
                : dialog.value.variableId
                  ? COPY.editVariable
                  : COPY.addVariable}
            </h2>
          </div>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {dialog.kind === 'category' ? (
            <CategoryForm
              value={dialog.value}
              saving={saving}
              onChange={(value) => value && onChange({ kind: 'category', value })}
              onCancel={onClose}
              onSubmit={(value) => void onSubmitCategory(value)}
            />
          ) : (
            <VariableForm
              value={dialog.value}
              personalCategories={personalCategories}
              saving={saving}
              onChange={(value) => value && onChange({ kind: 'variable', value })}
              onCancel={onClose}
              onSubmit={(value) => void onSubmitVariable(value)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CategoryForm({
  value,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: CategoryFormState
  saving: boolean
  onChange: (value: CategoryFormState | null) => void
  onCancel: () => void
  onSubmit: (value: CategoryFormState) => void
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="中文名称">
          <Input value={value.nameZh} onChange={(event) => onChange({ ...value, nameZh: event.target.value })} />
        </Field>
        <Field label="英文名称">
          <Input value={value.nameEn} onChange={(event) => onChange({ ...value, nameEn: event.target.value })} />
        </Field>
      </div>
      <Field label="图标">
        <select
          className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={value.icon}
          onChange={(event) => onChange({ ...value, icon: event.target.value })}
        >
          {Object.keys(CATEGORY_ICONS).map((icon) => (
            <option key={icon} value={icon}>{icon}</option>
          ))}
        </select>
      </Field>
      <Field label="词库介绍">
        <Textarea className="min-h-24" value={value.descriptionZh} onChange={(event) => onChange({ ...value, descriptionZh: event.target.value })} />
      </Field>
      <Field label="内部配方变量 Tip">
        <Textarea className="min-h-20" value={value.tipZh} onChange={(event) => onChange({ ...value, tipZh: event.target.value })} />
      </Field>
      <DialogActions saving={saving} onCancel={onCancel} submitLabel={value.categoryId ? COPY.save : COPY.create} />
    </form>
  )
}

function VariableForm({
  value,
  personalCategories,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: VariableFormState
  personalCategories: RecipeVariableCategory[]
  saving: boolean
  onChange: (value: VariableFormState | null) => void
  onCancel: () => void
  onSubmit: (value: VariableFormState) => void
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <Field label="所属个人词库">
        <select
          className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={value.categoryId}
          onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
        >
          {personalCategories.length ? null : <option value="">请先新增个人词库</option>}
          {personalCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name.zh}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="词条名称">
          <Input value={value.nameZh} onChange={(event) => onChange({ ...value, nameZh: event.target.value })} />
        </Field>
        <Field label="变量名">
          <Input value={value.variableName} placeholder="focalLength" onChange={(event) => onChange({ ...value, variableName: event.target.value })} />
        </Field>
      </div>
      <Field label="配方变量具体内容">
        <Textarea className="min-h-28" value={value.contentZh} onChange={(event) => onChange({ ...value, contentZh: event.target.value })} />
      </Field>
      <Field label="候选值">
        <Textarea className="min-h-20" value={value.candidatesZh} placeholder="用逗号或换行分隔" onChange={(event) => onChange({ ...value, candidatesZh: event.target.value })} />
      </Field>
      <Field label="默认值">
        <Input value={value.defaultValues} placeholder="用逗号或换行分隔" onChange={(event) => onChange({ ...value, defaultValues: event.target.value })} />
      </Field>
      <label className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-700">
        <input type="checkbox" checked={value.multiple} onChange={(event) => onChange({ ...value, multiple: event.target.checked })} />
        支持多选
      </label>
      <DialogActions saving={saving || !personalCategories.length} onCancel={onCancel} submitLabel={value.variableId ? COPY.save : COPY.create} />
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-black text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function DialogActions({ saving, submitLabel, onCancel }: { saving: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>{COPY.cancel}</Button>
      <Button type="submit" size="sm" disabled={saving}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {submitLabel}
      </Button>
    </div>
  )
}

function ScopeBadge({ scope }: { scope: RecipeVariableScope }) {
  const meta = SCOPE_META[scope]
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded border px-1.5 text-[10px] font-black leading-none', meta.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClassName)} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-xs font-bold text-slate-500">
      {text}
    </div>
  )
}

function TopCenterAlert({ alert, onDismiss }: { alert: AppAlert | null; onDismiss: () => void }) {
  if (!alert) return null

  return (
    <div className="fixed left-1/2 top-3 z-[70] w-[min(520px,calc(100vw-32px))] -translate-x-1/2">
      <Alert variant="destructive" className="flex items-start gap-2 pr-9 shadow-[0_18px_42px_rgba(154,52,18,0.18)]">
        <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-[#d95a1b]" />
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

function createCategoryFormState(category: RecipeVariableCategory): CategoryFormState {
  return {
    categoryId: category.id,
    nameZh: category.name.zh,
    nameEn: category.name.en,
    icon: category.icon || 'boxes',
    descriptionZh: category.description.zh,
    descriptionEn: category.description.en,
    tipZh: category.tip.zh,
    tipEn: category.tip.en,
  }
}

function createVariableFormState(variable: RecipeVariableItem, categoryId: string): VariableFormState {
  return {
    variableId: variable.id,
    categoryId,
    variableName: variable.variableName,
    nameZh: variable.name.zh,
    nameEn: variable.name.en,
    contentZh: variable.content.zh,
    contentEn: variable.content.en,
    candidatesZh: variable.candidates.zh.join('\n'),
    candidatesEn: variable.candidates.en.join('\n'),
    defaultValues: variable.defaultValues.join('\n'),
    multiple: variable.multiple,
  }
}

function matchesVariable(variable: RecipeVariableItem, query: string) {
  return (
    includesLocalized(variable.name, query) ||
    includesLocalized(variable.content, query) ||
    variable.variableName.toLocaleLowerCase().includes(query) ||
    variable.defaultValues.some((value) => value.toLocaleLowerCase().includes(query)) ||
    Object.values(variable.candidates).flat().some((candidate) => candidate.toLocaleLowerCase().includes(query))
  )
}

function includesLocalized(value: Record<Locale, string>, query: string) {
  return Object.values(value).some((item) => item.toLocaleLowerCase().includes(query))
}

function splitList(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)
}

function findLatestUpdated(categories: RecipeVariableCategory[]) {
  const updates = categories
    .flatMap((category) => [category.updatedAt, ...category.variables.map((variable) => variable.updatedAt)])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())

  if (!updates[0]) return { label: '-', byline: '暂无更新' }
  return {
    label: updates[0].toLocaleDateString('zh-CN'),
    byline: updates[0].toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

function formatDateTime(value: string | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`
  window.location.href = `/api/auth/login?next=${encodeURIComponent(next || '/')}`
}

function fetchJson(url: string, init: { method: string; body?: unknown }) {
  return fetch(url, {
    method: init.method,
    headers: { 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
    .then((result) => result.json().catch(() => null))
    .catch(() => null)
}
