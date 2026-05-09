'use client'

import dynamic from 'next/dynamic'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BeforeMount } from '@monaco-editor/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import ReactGridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import type { LayoutConstraint } from 'react-grid-layout/core'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tree } from 'react-arborist'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  AlertCircle,
  Bot,
  Copy,
  Download,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Home,
  LogOut,
  Maximize2,
  Minus,
  MessageSquareWarning,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AppHeader } from '@/components/app-header'
import { PortalBackground } from '@/components/portal-background'
import { cn } from '@/lib/utils'
import {
  aiModelSupportsReferenceFile,
  aiModelSupportsReferenceImage,
  aiModelSupportsThinking,
  applyAiModelPreset,
  createAiModelPresetRef,
  defaultAiResponseConfig,
  findAiModelPresetOption,
  getAiModelPresetOptionKey,
  getImageAspectRatioOptions,
  getImageSizeForResolution,
  hasAiModelPreset,
  inferAiProviderTypeFromBaseUrl,
  listAiModelPresetOptions,
  normalizeAiResponseConfig,
  normalizeAiModelPresetRef,
  resolveAiModelParameterSchema,
  ZPMT_OUTPUT_TYPES,
  type AiModelParameterSchema,
  type AiModelPresetRef,
  type AiProviderModel,
  type AiProviderSummary,
  type ZpmtOutputType,
  type ZpmtResponseConfig,
} from '@/lib/ai-presets'
import {
  AI_TOOL_CATEGORIES,
  AI_TOOL_SCHEMA_VERSION,
  coerceAiToolConfig,
  getAiToolDefinition,
  getAiToolFieldDefaults,
  summarizeAiToolConfig,
  type AiToolConfig,
  type AiToolField,
} from '@/lib/tool-definitions'
import {
  createRecipeVariableSnapshot,
  findRecipeVariableBySourceId,
  findRecipeVariableSnapshot,
  formatRecipeVariableSourceId,
  getDefaultRecipeVariableCategories,
  normalizeRecipeVariableMetadata,
  sourceIdsEqual,
  type RecipeVariableCategory as CatalogRecipeVariableCategory,
  type RecipeVariableChangeLog,
  type RecipeVariableItem as CatalogRecipeVariableItem,
  type RecipeVariableSnapshot,
  type ZpmtRecipeVariableMetadata,
} from '@/lib/recipe-variables'
import { isProjectConfigFilePath, isZamfFilePath, isZlexFilePath, type ProjectConfigDiagnostic } from '@/lib/project-config-types'
import type { GitChange, GitChangeGroupId, GitChangeKind, GitDecoration, SourceControlStatus } from '@/lib/git-source-control'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })
const MonacoDiffEditor = dynamic(() => import('@monaco-editor/react').then((module) => module.DiffEditor), { ssr: false })
const WorkbenchGridLayout = WidthProvider(ReactGridLayout)
const MONACO_LIGHT_THEME = 'ccks-transparent-light'
const MONACO_DARK_THEME = 'ccks-transparent-dark'

const defineTransparentMonacoTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(MONACO_LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#00000000',
      'editorGutter.background': '#00000000',
      'editorLineNumber.foreground': '#8b91a8',
      'editorLineNumber.activeForeground': '#d95a1b',
      'editor.lineHighlightBackground': '#00000000',
      'editor.selectionBackground': '#fb7e3d30',
      'editor.inactiveSelectionBackground': '#fb7e3d1f',
      'editorCursor.foreground': '#d95a1b',
      'minimap.background': '#00000000',
      'scrollbar.shadow': '#00000000',
    },
  })
  monaco.editor.defineTheme(MONACO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#e5e7f2',
      'editorGutter.background': '#00000000',
      'editorLineNumber.foreground': '#758096',
      'editorLineNumber.activeForeground': '#ffb087',
      'editor.lineHighlightBackground': '#00000000',
      'editor.selectionBackground': '#fb7e3d42',
      'editor.inactiveSelectionBackground': '#fb7e3d26',
      'editorCursor.foreground': '#ffb087',
      'minimap.background': '#00000000',
      'scrollbar.shadow': '#00000000',
    },
  })
}

type TreeNode = {
  id: string
  name: string
  kind?: 'folder' | 'file'
  path?: string
  projectId?: string
  children?: TreeNode[]
}

type VariableType = 'string' | 'number' | 'array' | 'color' | 'boolean' | 'image' | 'file'
type VariableTokenType = 'str' | 'num' | 'arr' | 'color' | 'bool' | 'img' | 'file'
type PromptTokenStyleKey = VariableType | 'recipe' | 'unknown'

type ThemeMode = 'light' | 'dark'
type Locale = 'zh' | 'en'
type LocalizedText = Record<Locale, string>
type RecipeVariableItem = CatalogRecipeVariableItem
type RecipeVariableCategory = CatalogRecipeVariableCategory
type InstructionCatalogItem = {
  id: string
  name: LocalizedText
  description?: LocalizedText
  candidates: Record<Locale, string[]>
  multiple: boolean
}
type InstructionCatalogCategory = {
  id: string
  name: LocalizedText
  description: LocalizedText
  variables: InstructionCatalogItem[]
}
type InstructionCategoryKind = 'recipe' | 'tool'
type EditorMode = 'normal' | 'preview' | 'assist' | 'source'
type PromptFileType = 'simple' | 'agent'
type ZpmtSectionKey = 'config' | 'system' | 'user'
type ZpmtPromptSectionKey = Extract<ZpmtSectionKey, 'system' | 'user'>
type ZpmtCollapsedSections = Partial<Record<ZpmtSectionKey, boolean>>
type ZpmtToolInstruction = InstructionCatalogItem & {
  categoryId: string
  toolId: string
  description?: LocalizedText
  config: AiToolConfig
  schemaVersion: number
}
type InstructionDragPayload =
  | { kind: 'variable'; variableType: VariableType }
  | { kind: 'recipe'; categoryId: string; item: RecipeVariableItem }
  | { kind: 'tool'; categoryId: string; item: InstructionCatalogItem }
type ProviderFileDragPayload = {
  kind: 'provider-file'
  projectId: string
  path: string
  provider: AiProviderSummary
}
type PendingZpmtTagInsertion = {
  mode: 'insert'
  payload: Extract<InstructionDragPayload, { kind: 'variable' | 'recipe' }>
  sectionKey: ZpmtPromptSectionKey
  offset: number
}
type PendingZpmtTagEdit = {
  mode: 'edit'
  payload: Extract<InstructionDragPayload, { kind: 'variable' | 'recipe' }>
  sectionKey: ZpmtPromptSectionKey
  start: number
  end: number
  token: string
  originalName: string
}
type PendingZpmtTagDialog = PendingZpmtTagInsertion | PendingZpmtTagEdit
type PendingZpmtToolDialog =
  | { mode: 'add'; payload: Extract<InstructionDragPayload, { kind: 'tool' }> }
  | { mode: 'edit'; tool: ZpmtToolInstruction }
type ZpmtPromptTokenEditorHandle = {
  setCaretAtPoint: (point: ZpmtDropPoint, showDropCursor?: boolean) => number
  clearDropCursor: () => void
}
type WorkbenchActivity = 'explorer' | 'sourceControl'
type Announcement = {
  id: string
  title: string
  content?: string
  updatedAt?: string | null
}
type AppAlert = {
  id: number
  title: string
  description: string
}
type SourceControlDiffView = {
  path: string
  originalPath?: string
  original: string
  modified: string
  staged: boolean
  language: string
}
type GithubSession = {
  accessToken: string
  scope: string
  user: unknown
}
type SessionUser = {
  id: string
  name: string
  email: string | null
  avatar: string | null
}
type ProjectFileReference = {
  projectId: string
  path: string
  name: string
}
type ProjectSummary = {
  id: string
  name: string
  fileName: string
  source: string
  repositoryUrl: string | null
  tree: TreeNode
}
type EditorFileTab = ProjectFileReference & {
  id: string
  content: string
  savedContent: string
  language: string
  dirty: boolean
  saving: boolean
  savedAt: string
  error?: string
}

type WindowId = 'files' | 'editor' | 'tests' | 'inspector'
type ResizeHandle = 's' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'
type GridLayoutItem = {
  i: WindowId
  x: number
  y: number
  w: number
  h: number
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
  moved?: boolean
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
  resizeHandles?: ResizeHandle[]
  constraints?: LayoutConstraint[]
  isBounded?: boolean
}
type MinimizedState = Record<WindowId, boolean>
type EntryDialogState =
  | { mode: 'folder'; folder: TreeNode; name: string }
  | { mode: 'lexicon'; folder: TreeNode; name: string }
  | { mode: 'provider'; folder: TreeNode; name: string }
  | {
      mode: 'prompt'
      folder: TreeNode
      name: string
      promptType: PromptFileType
      outputType: ZpmtOutputType
      providerId: string
      model: string
      responseConfig: ZpmtResponseConfig
    }
  | { mode: 'rename'; node: TreeNode; name: string }

type ZpmtDocument = {
  config: {
    outputType: ZpmtOutputType
    providerFile: string
    providerId: string
    providerName: string
    model: string
    responseConfig: ZpmtResponseConfig
  }
  system: string
  user: string
  tools: ZpmtToolInstruction[]
  metadata: ZpmtRecipeVariableMetadata
}
type ZpmtTestVariable = {
  key: string
  token: string
  name: string
  label: string
  typeLabel: string
  defaultValue: string
  source?: string
}
type ZpmtModelCapabilityGate = {
  supportsTools: boolean
  supportsReferenceImage: boolean
  supportsReferenceFile: boolean
}
type ZlexVariable = {
  variableName: string
  description: string
  candidates: string[]
  multiple: boolean
  createdAt?: string
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
}
type ZlexCategory = {
  name: string
  description: string
  createdAt?: string
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
  variables: ZlexVariable[]
}
type ZlexDocument = {
  schema: 'ccks.zlex'
  version: number
  categories: ZlexCategory[]
}
type ZamfModel = {
  id: string
  capabilities: ZpmtOutputType[]
  toolCalling: AiProviderModel['toolCalling']
  parameterSchema?: unknown
  defaultResponseConfig?: unknown
  presetRef?: AiModelPresetRef
}
type ZamfDocument = {
  schema: 'ccks.zamf'
  version: number
  id: string
  name: string
  providerType: string
  baseUrl: string
  apiKey: string
  models: ZamfModel[]
}
type ProjectConfigParseResult<T> =
  | { ok: true; document: T }
  | { ok: false; message: string }

const STORAGE_KEYS = {
  theme: 'ccks-theme',
  locale: 'ccks-locale',
  announcements: 'ccks-dismissed-announcements',
  workbenchLayout: 'ccks-workbench-layout-v4',
  githubSession: 'ccks-github-session',
}
const SOURCE_CONTROL_REFRESH_EVENT = 'ccks-source-control-refresh'
const ZPMT_INSTRUCTION_DRAG_EVENT = 'ccks-zpmt-instruction-drag'
const ZPMT_INSTRUCTION_DROP_EVENT = 'ccks-zpmt-instruction-drop'
const ZPMT_CLEAR_DRAG_CARET_EVENT = 'ccks-zpmt-clear-drag-caret'
const TAG_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]*$/
const ALL_ZPMT_MODEL_CAPABILITIES: ZpmtModelCapabilityGate = {
  supportsTools: true,
  supportsReferenceImage: true,
  supportsReferenceFile: true,
}

type ZpmtDropPoint = { x: number; y: number }
type ZpmtInstructionPointEventDetail = {
  payload: InstructionDragPayload
  point: ZpmtDropPoint
  handled: boolean
}
type ZpmtDroppableData = {
  kind: 'zpmt-root' | 'zpmt-prompt' | 'zpmt-config'
  onDropInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => void
  onDropProviderFile?: (payload: ProviderFileDragPayload, point: ZpmtDropPoint) => void
  onDragInstruction?: (payload: InstructionDragPayload, point: ZpmtDropPoint) => void
}

const GRID_COLS = 24
const DEFAULT_GRID_ROWS = 25
const GRID_ROW_HEIGHT = 18
const GRID_MARGIN: [number, number] = [8, 8]
const GRID_PADDING: [number, number] = [8, 8]
const RESIZE_HANDLES: ResizeHandle[] = ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']
const WINDOW_IDS: WindowId[] = ['files', 'editor', 'tests', 'inspector']
const PROMPT_FILE_TYPES: PromptFileType[] = ['simple', 'agent']
const ZPMT_PROMPT_EDITOR_MIN_HEIGHT = 160

const DEFAULT_MINIMIZED: MinimizedState = {
  files: false,
  editor: false,
  tests: false,
  inspector: false,
}

const DEFAULT_WORKBENCH_LAYOUT: GridLayoutItem[] = createDefaultWorkbenchLayout(DEFAULT_GRID_ROWS)

const MINIMIZED_LAYOUT: Record<WindowId, Pick<GridLayoutItem, 'w' | 'h' | 'minW' | 'minH'>> = {
  files: { w: 2, h: 4, minW: 2, minH: 3 },
  editor: { w: 5, h: 3, minW: 4, minH: 3 },
  tests: { w: 2, h: 4, minW: 2, minH: 3 },
  inspector: { w: 5, h: 3, minW: 4, minH: 3 },
}

const UI_COPY = {
  zh: {
    nav: ['网页管理', '变量管理', '社区', '配置中心'],
    settings: '系统设置',
    themeToDark: '暗色模式',
    themeToLight: '亮色模式',
    language: 'English',
    announcement: '公告',
    noAnnouncement: '暂无公告',
    feedback: '投诉建议',
    errorTitle: '操作失败',
    login: '登录',
    logout: '退出',
    project: '网站项目',
    projectSelect: '示例网站 (v1.2.0)',
    newProject: '新增项目',
    deleteProject: '删除项目',
    deleteProjectConfirm: '确认永久删除项目「{name}」？这会删除数据库记录和本地项目文件夹。',
    localProject: '本地新建',
    githubImport: '从 GitHub 导入',
    projectName: '项目名称',
    projectFileName: '文件名称（英文）',
    repositoryUrl: 'GitHub 仓库地址',
    projectNameRequired: '项目名称不能为空',
    projectFileNameInvalid: '文件名称只能使用英文、数字、下划线或连字符，并且必须以英文字母开头',
    repositoryUrlRequired: 'GitHub 仓库地址不能为空',
    githubLoginRequired: '请先连接 GitHub',
    createProject: '创建项目',
    importProject: '导入项目',
    fileList: '文件列表',
    sourceControl: '源代码管理',
    activity: {
      explorer: '文件列表',
      sourceControl: '源代码管理',
    },
    newFolder: '新建文件夹',
    newPromptFile: '新建提示词文件',
    promptFileType: '提示词类型',
    simplePrompt: '简单提示词',
    agentPrompt: 'Agent 提示词',
    outputType: '输出类型',
    aiProvider: 'AI 供应商',
    aiModel: '模型',
    responseConfig: '响应配置',
    noAiProvider: '暂无 .zamf 供应商文件，请先在文件树创建',
    noModelForOutput: '当前输出类型没有可用模型',
    unsupportedByModel: '当前模型不支持',
    aiProviderConfig: 'AI 供应商配置',
    addAiProvider: '新增供应商',
    saveAiProvider: '保存供应商',
    updateAiProvider: '更新供应商',
    providerPreset: '供应商预设',
    providerName: '供应商名称',
    providerBaseUrl: '供应商网址',
    providerApiKey: 'API Key',
    providerApiKeyPlaceholder: '留空则保留已保存密钥',
    providerModels: '模型列表',
    providerModelsHint: '模型列表通过供应商接口获取；保存前请先获取模型。',
    pullModels: '获取模型',
    pullingModels: '获取中',
    modelFetchApiKeyRequired: '请先填写供应商网址和 API Key。',
    modelFetchFailed: '模型列表获取失败',
    providerDeleteConfirm: '确认删除 AI 供应商「{name}」？',
    providerHasKey: '密钥已加密保存',
    providerNoKey: '未保存密钥',
    toolCalling: '工具调用',
    toolCallingStatus: {
      supported: '支持',
      unsupported: '不支持',
      unknown: '未配置',
    },
    temperature: '温度',
    maxTokens: '最大 Token',
    thinkingMode: '思考模式',
    reasoningEffort: '思考强度',
    responseFormat: '响应格式',
    imageSize: '图片尺寸',
    imageResolution: '分辨率',
    imageAspectRatio: '图片比例',
    customImageSize: '自定义尺寸',
    imageQuality: '图片质量',
    imageOutputFormat: '生成图片类型',
    imageOutputCompression: '输出压缩',
    imageResponseFormat: '图片返回方式',
    imageBackground: '背景',
    imageModeration: '审核强度',
    imageStyle: '图片风格',
    watermark: '添加水印',
    imageOutputFormats: {
      png: 'PNG',
      jpeg: 'JPEG',
      webp: 'WebP',
    },
    imageResponseFormats: {
      url: 'URL 链接',
      b64_json: 'Base64 JSON',
    },
    imageBackgrounds: {
      auto: '自动',
      opaque: '不透明',
      transparent: '透明',
    },
    imageModerations: {
      auto: '自动',
      low: '低',
    },
    imageStyles: {
      vivid: '鲜明',
      natural: '自然',
    },
    outputTypes: {
      image: '图片',
      text: '文本',
    },
    thinkingModes: {
      enabled: '开启',
      disabled: '关闭',
      auto: '自动',
    },
    reasoningEfforts: {
      none: '无',
      low: '低',
      medium: '中',
      high: '高',
      xhigh: '极高',
      max: '最大',
    },
    fileConfig: '文件配置',
    providerFile: '供应商文件',
    dropProviderFile: '拖拽 .zamf 到这里替换供应商',
    newLexiconFile: '新建词汇变量文件',
    newProviderModelFile: '新建供应商模型文件',
    configDiagnostics: '配置文件解析问题',
    zlexEditor: '词汇变量编辑',
    zamfEditor: '供应商模型编辑',
    lexiconName: '词库名称',
    scope: '来源范围',
    categoryId: '分类 ID',
    categoryIcon: '图标',
    categoryManagement: '分类管理',
    categoryInfo: '分类信息',
    categoryName: '分类名称',
    categoryDescription: '分类描述',
    categories: '分类',
    categoryTip: '分类提示',
    addCategory: '新增分类',
    deleteCategory: '删除分类',
    addRecipeVariable: '新增变量',
    deleteVariable: '删除变量',
    variableList: '变量列表',
    actions: '操作',
    variableId: '变量 ID',
    variableName: '变量名',
    content: '内容',
    description: '描述',
    candidates: '候选值',
    addCandidate: '添加项',
    removeCandidate: '删除项',
    editCandidates: '编辑候选值',
    candidateEditor: '候选值编辑',
    candidateCountSuffix: '项',
    done: '完成',
    defaultValues: '默认值',
    multiple: '多选',
    modelId: '模型 ID',
    capabilities: '能力',
    addModel: '新增模型',
    deleteModel: '删除模型',
    showApiKey: '显示 Key',
    hideApiKey: '隐藏 Key',
    parseFailed: '文件解析失败',
    sourceRepair: '切到源码修复',
    emptyVariables: '当前分类没有变量',
    emptyModels: '当前供应商没有模型',
    modelPreset: '模型预设',
    modelPresetPlaceholder: '选择模型预设',
    modelPresetMatched: '已匹配预设',
    thinkingSupport: '思考',
    thinkingSupported: '支持',
    thinkingUnsupported: '不支持',
    referenceImage: '参考图',
    referenceFile: '参考文件',
    systemPrompt: 'System 提示词',
    userPrompt: 'User 提示词',
    openFile: '打开文件',
    rename: '重命名',
    delete: '删除',
    copyPath: '复制路径',
    fileName: '文件名称',
    createFile: '创建文件',
    renameTo: '新名称',
    folderName: '文件夹名称',
    createFolder: '创建文件夹',
    githubConnect: '连接 GitHub',
    githubConnected: 'GitHub 已连接',
    scmNoRepo: '当前项目未绑定 Git 仓库',
    scmNoChanges: '没有源代码变更',
    scmChanges: '项变更',
    scmInitTitle: '初始化 Git 仓库',
    scmInitDesc: '当前项目还没有 .git 目录。初始化后，源代码管理只会跟踪这个项目文件夹。',
    scmInitAction: '初始化仓库',
    scmRemoteTitle: '连接 GitHub 远程仓库',
    scmRemoteDesc: '当前仓库还没有 origin。可以发布到 GitHub，或填写已有仓库地址。',
    scmPublish: '发布到 GitHub',
    scmSetRemote: '设置远程仓库',
    scmRepositoryName: '仓库名称',
    scmPrivateRepo: '私有仓库',
    scmSync: '同步',
    scmPull: '拉取',
    scmPush: '推送',
    scmFetch: '获取',
    scmStage: '暂存',
    scmStageAll: '全部暂存',
    scmUnstage: '取消暂存',
    scmUnstageAll: '全部取消暂存',
    scmDiscard: '丢弃更改',
    scmCommit: '提交',
    scmCommitAll: '全部提交',
    scmCommitAndPush: '提交并推送',
    scmCommitAndSync: '提交并同步',
    scmRefresh: '刷新',
    scmBranch: '分支',
    scmNewBranch: '新建分支',
    scmCheckoutBranch: '切换分支',
    scmBranchPickerTitle: '切换分支',
    scmBranchSearch: '搜索分支',
    scmNoBranches: '没有匹配的分支',
    scmCurrentBranch: '当前',
    scmLocalBranch: '本地',
    scmRemoteBranch: '远程',
    scmCreateBranchFromInput: '从输入创建分支',
    scmOpenDiff: '查看差异',
    scmDiscardConfirm: '确认丢弃所选更改？此操作无法撤销。',
    scmRemoteOverwriteConfirm: '当前已存在 origin 远程仓库，确认覆盖为新的地址？',
    scmConflictHint: '存在合并冲突，请先解决冲突后再提交。',
    githubScopeMissing: 'GitHub 授权缺少 repo 权限，请重新连接 GitHub。',
    githubRequired: '请先连接 GitHub',
    diffTitle: '文件差异',
    diffOriginal: '原始内容',
    diffModified: '当前内容',
    scmGroups: {
      staged: '暂存的更改',
      unstaged: '更改',
      untracked: '未跟踪',
      conflicts: '合并冲突',
    },
    commitMessage: '提交信息',
    commitAndPush: '提交并推送',
    loading: '加载中...',
    tabs: ['首页.prompt', '产品页.prompt', '博客文章.prompt'],
    saved: '✓ 已保存 10:24:18',
    save: '保存',
    saving: '保存中',
    unsaved: '未保存',
    saveFailed: '保存失败',
    closeTab: '关闭标签',
    closeUnsavedTabConfirm: '「{name}」有未保存更改，确认关闭？',
    noOpenFile: '从左侧文件列表选择文件开始编辑',
    format: '格式化',
    run: '运行 (⌘+↵)',
    editorModes: {
      normal: '正常',
      preview: '预览',
      assist: 'AI辅助',
      source: '源码',
    },
    markdownPreview: 'Markdown 阅览',
    sourceCode: 'ZPMT 源码',
    aiAssist: {
      title: 'AI辅助',
      status: '基于当前提示词草稿生成建议',
      items: ['补充变量默认值说明', '检查 CTA 链接是否存在', '为核心能力增加结构化输出约束'],
      action: '生成优化建议',
    },
    bottomTabs: ['测试面板', '运行结果', '测试用例', '性能分析'],
    success: '成功',
    tokens: '令牌 1,245（输入 528 / 输出 717）',
    heroTitle: 'ZPMT',
    heroDesc: '新时代 AI 代码编辑工具以及编辑框架',
    coreTitle: '核心能力',
    coreItems: [
      '智能生成：通过自然语言生成高质量网页内容与结构',
      '可视化管理：页面、内容、数据一站式管理',
      '强大集成：丰富的工具与API，扩展无限可能',
    ],
    cta: '立即体验',
    inspectorTabs: ['变量', '配方变量', '工具'],
    variables: '变量',
    addVariable: '新增变量',
    variableTypes: {
      string: '字符串变量',
      number: '数值变量',
      array: '数组变量',
      color: '颜色变量',
      boolean: '布尔变量',
      image: '图片变量',
      file: '文件变量',
    },
    recipeVariableLabel: '配方变量',
    insertInstructionTag: '插入指令标签',
    instructionName: '英文名称',
    instructionNamePlaceholder: '例如 heroTitle',
    defaultValue: '默认值',
    noDefaultValue: '不设置默认值',
    editTag: '编辑标签',
    saveTag: '保存标签',
    textLength: '文本长度',
    numberRange: '数值范围',
    arrayLength: '数组长度',
    imageCount: '图片数量',
    fileSize: '文件大小',
    recipeSource: '配方来源',
    candidateValues: '候选值',
    promptTokenParams: {
      source: '来源',
      multi: '多选',
      default: '默认值',
      range: '范围',
      length: '长度',
      count: '数量',
      size: '文件大小',
    },
    booleanText: {
      true: '是',
      false: '否',
    },
    cancel: '取消',
    insertTag: '插入标签',
    tagNameInvalid: '名称必须以小写英文字母开头，只能包含英文、数字和下划线',
    tagNameDuplicate: '名称已存在，请重新输入',
    tagInfoRequired: '请填写必要信息',
    fixedTools: '已绑定工具',
    configureTool: '绑定工具',
    bindTool: '绑定工具',
    toolBindingConfig: '系统上限',
    toolBindingNoConfig: '该工具没有需要配置的系统上限。确认后，AI 会在调用时提供参数。',
    editTool: '编辑工具',
    addTool: '添加工具',
    saveTool: '保存工具',
    runTool: '运行工具',
    toolRunSelect: '选择工具',
    toolRunInput: '运行输入',
    toolRunResult: '运行结果',
    toolRunNoFile: '打开 .zpmt 文件后可运行固定工具',
    toolRunNoTools: '请先从指令集拖拽工具到当前提示词',
    toolRunSuccess: '工具运行成功',
    toolRunFailed: '工具运行失败',
    toolConfigRequired: '请填写必填工具参数',
    downloadFile: '下载文件',
    generatedFile: '生成文件',
    duration: '耗时',
    runAgent: '运行 Agent',
    runningAgent: '运行中',
    agentRunNoFile: '打开 .zpmt 文件后可运行测试',
    agentRunNoProvider: '请先绑定供应商和模型',
    agentRunSuccess: 'Agent 运行成功',
    agentRunFailed: 'Agent 运行失败',
    testVariables: '测试变量',
    testVariableEmpty: '当前提示词没有变量',
    testValue: '测试值',
    runSettings: '运行设置',
    maxToolRounds: '工具调用最大循环',
    maxToolRoundsHint: '0 表示不执行工具调用；运行时可调整。',
    assistantOutput: 'AI 输出',
    noAgentOutput: '暂无运行结果',
    renderedPrompt: '渲染后的提示词',
    removeTool: '移除工具',
    recipeVariableSearch: '搜索分类、变量或候选字段',
    recipeVariableEmpty: '没有匹配的配方变量',
    recipeVariableModes: {
      multi: '可多选',
      single: '单选',
    },
    tools: '工具',
    toolInstructionSearch: '搜索分类、工具或指令字段',
    toolInstructionEmpty: '没有匹配的工具指令',
    viewAll: '查看全部',
    toolDescriptions: ['时间变量', '公式计算', '网页抓取', '数据查询', 'AI 生成'],
    windows: {
      files: '文件',
      editor: '代码编辑',
      tests: '测试面板',
      inspector: '指令集',
      config: '配置中心',
      minimize: '最小化',
      restore: '还原',
      resetLayout: '还原布局',
    },
    contextText: '当前上下文包含站点配置、页面变量、运行结果与最近一次版本说明。',
    feedbackUnavailable: '未配置统一门户地址，设置 NEXT_PUBLIC_ZR_PORTAL_URL 后可打开投诉建议。',
    status: {
      ready: '就绪',
      branch: 'main',
      saved: '已保存',
      activeFile: '首页.prompt',
      hint: 'ZPMT 工作台 · 当前为本地 mock 数据',
      portalReady: '门户已配置',
      portalMissing: '门户未配置',
      lineColumn: '行 1, 列 1',
      encoding: 'UTF-8',
      mode: 'Markdown',
    },
  },
  en: {
    nav: ['Sites', 'Variables', 'Community', 'Config'],
    settings: 'Settings',
    themeToDark: 'Dark mode',
    themeToLight: 'Light mode',
    language: '中文',
    announcement: 'Announcements',
    noAnnouncement: 'No announcements',
    feedback: 'Feedback',
    errorTitle: 'Action failed',
    login: 'Sign in',
    logout: 'Sign out',
    project: 'Site Project',
    projectSelect: 'Demo site (v1.2.0)',
    newProject: 'New project',
    deleteProject: 'Delete project',
    deleteProjectConfirm: 'Permanently delete project "{name}"? This removes its database record and local project folder.',
    localProject: 'Local',
    githubImport: 'Import GitHub',
    projectName: 'Project name',
    projectFileName: 'File name',
    repositoryUrl: 'GitHub repository URL',
    projectNameRequired: 'Project name is required',
    projectFileNameInvalid: 'File name must start with a letter and only include letters, numbers, underscores, or hyphens',
    repositoryUrlRequired: 'GitHub repository URL is required',
    githubLoginRequired: 'Connect GitHub first',
    createProject: 'Create project',
    importProject: 'Import project',
    fileList: 'Files',
    sourceControl: 'Source Control',
    activity: {
      explorer: 'Files',
      sourceControl: 'Source Control',
    },
    newFolder: 'New folder',
    newPromptFile: 'New prompt file',
    promptFileType: 'Prompt type',
    simplePrompt: 'Simple prompt',
    agentPrompt: 'Agent prompt',
    outputType: 'Output type',
    aiProvider: 'AI provider',
    aiModel: 'Model',
    responseConfig: 'Response config',
    noAiProvider: 'No .zamf provider files. Create one in the file tree.',
    noModelForOutput: 'No available model for this output type',
    unsupportedByModel: 'Not supported by the current model',
    aiProviderConfig: 'AI provider config',
    addAiProvider: 'Add provider',
    saveAiProvider: 'Save provider',
    updateAiProvider: 'Update provider',
    providerPreset: 'Provider preset',
    providerName: 'Provider name',
    providerBaseUrl: 'Provider URL',
    providerApiKey: 'API Key',
    providerApiKeyPlaceholder: 'Leave blank to keep saved key',
    providerModels: 'Models',
    providerModelsHint: 'Fetch models from the provider API before saving.',
    pullModels: 'Fetch models',
    pullingModels: 'Fetching',
    modelFetchApiKeyRequired: 'Enter the provider URL and API Key first.',
    modelFetchFailed: 'Failed to fetch models',
    providerDeleteConfirm: 'Delete AI provider "{name}"?',
    providerHasKey: 'Key encrypted',
    providerNoKey: 'No key saved',
    toolCalling: 'Tool calling',
    toolCallingStatus: {
      supported: 'Supported',
      unsupported: 'Unsupported',
      unknown: 'Unknown',
    },
    temperature: 'Temperature',
    maxTokens: 'Max tokens',
    thinkingMode: 'Thinking',
    reasoningEffort: 'Reasoning effort',
    responseFormat: 'Response format',
    imageSize: 'Image size',
    imageResolution: 'Resolution',
    imageAspectRatio: 'Aspect ratio',
    customImageSize: 'Custom size',
    imageQuality: 'Image quality',
    imageOutputFormat: 'Generated image type',
    imageOutputCompression: 'Output compression',
    imageResponseFormat: 'Image response',
    imageBackground: 'Background',
    imageModeration: 'Moderation',
    imageStyle: 'Image style',
    watermark: 'Watermark',
    imageOutputFormats: {
      png: 'PNG',
      jpeg: 'JPEG',
      webp: 'WebP',
    },
    imageResponseFormats: {
      url: 'URL',
      b64_json: 'Base64 JSON',
    },
    imageBackgrounds: {
      auto: 'Auto',
      opaque: 'Opaque',
      transparent: 'Transparent',
    },
    imageModerations: {
      auto: 'Auto',
      low: 'Low',
    },
    imageStyles: {
      vivid: 'Vivid',
      natural: 'Natural',
    },
    outputTypes: {
      image: 'Image',
      text: 'Text',
    },
    thinkingModes: {
      enabled: 'On',
      disabled: 'Off',
      auto: 'Auto',
    },
    reasoningEfforts: {
      none: 'None',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      xhigh: 'Extra high',
      max: 'Max',
    },
    fileConfig: 'File config',
    providerFile: 'Provider file',
    dropProviderFile: 'Drop a .zamf file here to replace the provider',
    newLexiconFile: 'New lexicon file',
    newProviderModelFile: 'New provider model file',
    configDiagnostics: 'Config file diagnostics',
    zlexEditor: 'Lexicon editor',
    zamfEditor: 'Provider model editor',
    lexiconName: 'Lexicon name',
    scope: 'Scope',
    categoryId: 'Category ID',
    categoryIcon: 'Icon',
    categoryManagement: 'Categories',
    categoryInfo: 'Category info',
    categoryName: 'Category name',
    categoryDescription: 'Category description',
    categories: 'Categories',
    categoryTip: 'Category tip',
    addCategory: 'Add category',
    deleteCategory: 'Delete category',
    addRecipeVariable: 'Add variable',
    deleteVariable: 'Delete variable',
    variableList: 'Variables',
    actions: 'Actions',
    variableId: 'Variable ID',
    variableName: 'Variable name',
    content: 'Content',
    description: 'Description',
    candidates: 'Candidates',
    addCandidate: 'Add item',
    removeCandidate: 'Remove item',
    editCandidates: 'Edit candidates',
    candidateEditor: 'Candidate editor',
    candidateCountSuffix: 'items',
    done: 'Done',
    defaultValues: 'Default values',
    multiple: 'Multi-select',
    modelId: 'Model ID',
    capabilities: 'Capabilities',
    addModel: 'Add model',
    deleteModel: 'Delete model',
    showApiKey: 'Show key',
    hideApiKey: 'Hide key',
    parseFailed: 'File parse failed',
    sourceRepair: 'Switch to source',
    emptyVariables: 'No variables in this category',
    emptyModels: 'No models in this provider',
    modelPreset: 'Model preset',
    modelPresetPlaceholder: 'Choose preset',
    modelPresetMatched: 'Preset matched',
    thinkingSupport: 'Thinking',
    thinkingSupported: 'Supported',
    thinkingUnsupported: 'Unsupported',
    referenceImage: 'Reference image',
    referenceFile: 'Reference file',
    systemPrompt: 'System prompt',
    userPrompt: 'User prompt',
    openFile: 'Open file',
    rename: 'Rename',
    delete: 'Delete',
    copyPath: 'Copy path',
    fileName: 'File name',
    createFile: 'Create file',
    renameTo: 'New name',
    folderName: 'Folder name',
    createFolder: 'Create folder',
    githubConnect: 'Connect GitHub',
    githubConnected: 'GitHub connected',
    scmNoRepo: 'This project is not a Git repository',
    scmNoChanges: 'No source control changes',
    scmChanges: 'changes',
    scmInitTitle: 'Initialize Git repository',
    scmInitDesc: 'This project has no .git directory. After initialization, source control tracks only this project folder.',
    scmInitAction: 'Initialize repository',
    scmRemoteTitle: 'Connect GitHub remote',
    scmRemoteDesc: 'This repository has no origin. Publish it to GitHub or set an existing repository URL.',
    scmPublish: 'Publish to GitHub',
    scmSetRemote: 'Set remote',
    scmRepositoryName: 'Repository name',
    scmPrivateRepo: 'Private repository',
    scmSync: 'Sync',
    scmPull: 'Pull',
    scmPush: 'Push',
    scmFetch: 'Fetch',
    scmStage: 'Stage',
    scmStageAll: 'Stage all',
    scmUnstage: 'Unstage',
    scmUnstageAll: 'Unstage all',
    scmDiscard: 'Discard changes',
    scmCommit: 'Commit',
    scmCommitAll: 'Commit all',
    scmCommitAndPush: 'Commit and push',
    scmCommitAndSync: 'Commit and sync',
    scmRefresh: 'Refresh',
    scmBranch: 'Branch',
    scmNewBranch: 'New branch',
    scmCheckoutBranch: 'Checkout branch',
    scmBranchPickerTitle: 'Switch branch',
    scmBranchSearch: 'Search branches',
    scmNoBranches: 'No matching branches',
    scmCurrentBranch: 'Current',
    scmLocalBranch: 'Local',
    scmRemoteBranch: 'Remote',
    scmCreateBranchFromInput: 'Create branch from input',
    scmOpenDiff: 'Open diff',
    scmDiscardConfirm: 'Discard selected changes? This cannot be undone.',
    scmRemoteOverwriteConfirm: 'Origin already exists. Replace it with the new URL?',
    scmConflictHint: 'Merge conflicts exist. Resolve conflicts before committing.',
    githubScopeMissing: 'GitHub authorization is missing repo scope. Reconnect GitHub.',
    githubRequired: 'Connect GitHub first',
    diffTitle: 'File Diff',
    diffOriginal: 'Original',
    diffModified: 'Current',
    scmGroups: {
      staged: 'Staged Changes',
      unstaged: 'Changes',
      untracked: 'Untracked',
      conflicts: 'Merge Changes',
    },
    commitMessage: 'Commit message',
    commitAndPush: 'Commit and push',
    loading: 'Loading...',
    tabs: ['Home.prompt', 'Product.prompt', 'Blog.prompt'],
    saved: '✓ Saved 10:24:18',
    save: 'Save',
    saving: 'Saving',
    unsaved: 'Unsaved',
    saveFailed: 'Save failed',
    closeTab: 'Close tab',
    closeUnsavedTabConfirm: '"{name}" has unsaved changes. Close it?',
    noOpenFile: 'Select a file from the file list to start editing',
    format: 'Format',
    run: 'Run (⌘+↵)',
    editorModes: {
      normal: 'Normal',
      preview: 'Preview',
      assist: 'AI Assist',
      source: 'Source',
    },
    markdownPreview: 'Markdown Preview',
    sourceCode: 'ZPMT Source',
    aiAssist: {
      title: 'AI Assist',
      status: 'Suggestions based on the current prompt draft',
      items: ['Document variable defaults', 'Check whether CTA links exist', 'Add structured output rules to capabilities'],
      action: 'Generate suggestions',
    },
    bottomTabs: ['Test', 'Result', 'Cases', 'Performance'],
    success: 'Success',
    tokens: 'Tokens 1,245 (input 528 / output 717)',
    heroTitle: 'Start From Words - every idea gets an echo',
    heroDesc: 'A next-generation AI website generation and content management platform',
    coreTitle: 'Core capabilities',
    coreItems: [
      'AI generation: create high-quality page content and structure from natural language',
      'Visual management: manage pages, content, and data in one workspace',
      'Integrations: extend workflows with tools and APIs',
    ],
    cta: 'Start',
    inspectorTabs: ['Variables', 'Recipes', 'Tools'],
    variables: 'Variables',
    addVariable: 'Add variable',
    variableTypes: {
      string: 'String',
      number: 'Number',
      array: 'Array',
      color: 'Color',
      boolean: 'Boolean',
      image: 'Image',
      file: 'File',
    },
    recipeVariableLabel: 'Recipe',
    insertInstructionTag: 'Insert instruction tag',
    instructionName: 'English name',
    instructionNamePlaceholder: 'e.g. heroTitle',
    defaultValue: 'Default value',
    noDefaultValue: 'No default',
    editTag: 'Edit tag',
    saveTag: 'Save tag',
    textLength: 'Text length',
    numberRange: 'Number range',
    arrayLength: 'Array length',
    imageCount: 'Image count',
    fileSize: 'File size',
    recipeSource: 'Recipe source',
    candidateValues: 'Candidates',
    promptTokenParams: {
      source: 'Source',
      multi: 'Multi-select',
      default: 'Default',
      range: 'Range',
      length: 'Length',
      count: 'Count',
      size: 'File size',
    },
    booleanText: {
      true: 'Yes',
      false: 'No',
    },
    cancel: 'Cancel',
    insertTag: 'Insert tag',
    tagNameInvalid: 'Name must start with a lowercase letter and only include letters, numbers, and underscores',
    tagNameDuplicate: 'Name already exists. Enter another name.',
    tagInfoRequired: 'Fill in the required information',
    fixedTools: 'Bound tools',
    configureTool: 'Bind tool',
    bindTool: 'Bind tool',
    toolBindingConfig: 'System limits',
    toolBindingNoConfig: 'This tool has no system limits to configure. After binding, the AI supplies call arguments at runtime.',
    editTool: 'Edit tool',
    addTool: 'Add tool',
    saveTool: 'Save tool',
    runTool: 'Run tool',
    toolRunSelect: 'Select tool',
    toolRunInput: 'Run input',
    toolRunResult: 'Run result',
    toolRunNoFile: 'Open a .zpmt file to run fixed tools',
    toolRunNoTools: 'Drag tools from the instruction set into the current prompt first',
    toolRunSuccess: 'Tool run succeeded',
    toolRunFailed: 'Tool run failed',
    toolConfigRequired: 'Fill in required tool parameters',
    downloadFile: 'Download file',
    generatedFile: 'Generated file',
    duration: 'Duration',
    runAgent: 'Run Agent',
    runningAgent: 'Running',
    agentRunNoFile: 'Open a .zpmt file to run tests',
    agentRunNoProvider: 'Bind a provider and model first',
    agentRunSuccess: 'Agent run succeeded',
    agentRunFailed: 'Agent run failed',
    testVariables: 'Test variables',
    testVariableEmpty: 'The current prompt has no variables',
    testValue: 'Test value',
    runSettings: 'Run settings',
    maxToolRounds: 'Max tool-call loops',
    maxToolRoundsHint: '0 disables tool calls; adjustable per run.',
    assistantOutput: 'AI output',
    noAgentOutput: 'No run result yet',
    renderedPrompt: 'Rendered prompt',
    removeTool: 'Remove tool',
    recipeVariableSearch: 'Search categories, variables, or candidates',
    recipeVariableEmpty: 'No matching recipe variables',
    recipeVariableModes: {
      multi: 'Multi-select',
      single: 'Single-select',
    },
    tools: 'Tools',
    toolInstructionSearch: 'Search categories, tools, or instruction fields',
    toolInstructionEmpty: 'No matching tool instructions',
    viewAll: 'View all',
    toolDescriptions: ['Time variable', 'Formula', 'Web fetch', 'Data query', 'AI generate'],
    windows: {
      files: 'Files',
      editor: 'Editor',
      tests: 'Tests',
      inspector: 'Instruction Set',
      config: 'Config',
      minimize: 'Minimize',
      restore: 'Restore',
      resetLayout: 'Reset layout',
    },
    contextText: 'The current context includes site settings, page variables, run output, and the latest version note.',
    feedbackUnavailable: 'Portal URL is not configured. Set NEXT_PUBLIC_ZR_PORTAL_URL to open feedback.',
    status: {
      ready: 'Ready',
      branch: 'main',
      saved: 'Saved',
      activeFile: 'Home.prompt',
      hint: 'ZPMT workbench · local mock data',
      portalReady: 'Portal configured',
      portalMissing: 'Portal missing',
      lineColumn: 'Ln 1, Col 1',
      encoding: 'UTF-8',
      mode: 'Markdown',
    },
  },
}

type WorkbenchCopy = (typeof UI_COPY)['zh']

const promptCode = `---
title: "ZPMT"
description: "新时代 AI 代码编辑工具以及编辑框架"
layout: "base"
version: "1.2.0"
updated_at: "{{ now }}"
tags: ["首页", "营销"]
---

# {{ site.title }}
### {{ site.description }}

ZPMT，帮助团队以更高效率创建、编辑和管理 AI 代码项目。

## 核心能力

- **智能生成**：通过自然语言生成高质量网页内容与结构
- **可视化管理**：页面、内容、数据一站式管理
- **强大集成**：丰富的工具与API，扩展无限可能

## 开始使用
\`\`\`json
{
  "cta_text": "立即体验",
  "cta_url": "{{ links.getStarted }}",
  "primary_color": "{{ theme.primary }}"
}
\`\`\`
`

const EXAMPLE_PROJECT_ID = 'example-site'

const treeData: TreeNode[] = [
  {
    id: 'root',
    name: 'example-site/',
    children: [
      {
        id: 'global',
        name: '_global',
        children: [
          { id: 'settings', name: '全局设置.prompt' },
          { id: 'nav', name: '导航.prompt' },
        ],
      },
      {
        id: 'pages',
        name: 'pages',
        children: [
          { id: 'home', name: '首页.prompt' },
          { id: 'product', name: '产品页.prompt' },
          { id: 'pricing', name: '定价页.prompt' },
          { id: 'about', name: '关于我们.prompt' },
        ],
      },
      {
        id: 'blog',
        name: 'blog',
        children: [
          { id: 'list', name: '列表页.prompt' },
          {
            id: 'article',
            name: '文章',
            children: [
              { id: 'post', name: '博客文章.prompt' },
              { id: 'detail', name: '文章详情.prompt' },
            ],
          },
        ],
      },
      {
        id: 'api',
        name: 'api',
        children: [
          { id: 'search', name: '搜索.prompt' },
          { id: 'subscribe', name: '订阅.prompt' },
        ],
      },
      {
        id: 'components',
        name: 'components',
        children: [
          { id: 'header', name: '页头.prompt' },
          { id: 'footer', name: '页脚.prompt' },
          { id: 'cta', name: 'CTA.prompt' },
        ],
      },
      {
        id: 'templates',
        name: 'templates',
        children: [{ id: 'base', name: '基础模板.prompt' }],
      },
    ],
  },
]

const VARIABLE_TYPE_ORDER: VariableType[] = ['string', 'number', 'array', 'color', 'boolean', 'image', 'file']

const VARIABLE_TOKEN_TYPES: Record<VariableType, VariableTokenType> = {
  string: 'str',
  number: 'num',
  array: 'arr',
  color: 'color',
  boolean: 'bool',
  image: 'img',
  file: 'file',
}

const VARIABLE_TYPES_BY_TOKEN = Object.fromEntries(
  Object.entries(VARIABLE_TOKEN_TYPES).map(([variableType, tokenType]) => [tokenType, variableType]),
) as Record<VariableTokenType, VariableType>

const DEFAULT_RECIPE_VARIABLE_CATEGORIES = getDefaultRecipeVariableCategories()

const toolInstructionCategories: InstructionCatalogCategory[] = AI_TOOL_CATEGORIES

const inputSchema = z.object({
  siteTitle: z.string().min(1),
  description: z.string().min(1),
  getStarted: z.string().min(1),
  primary: z.string().min(1),
})

type InputForm = z.infer<typeof inputSchema>

function getFileIconMeta(filePath: string): { icon: LucideIcon; className: string; badge?: string } {
  if (isZpmtFilePath(filePath)) return { icon: WandSparkles, className: 'text-[#d95a1b]', badge: 'ZPMT' }
  if (isZlexFilePath(filePath)) return { icon: Boxes, className: 'text-amber-600', badge: 'ZLEX' }
  if (isZamfFilePath(filePath)) return { icon: Bot, className: 'text-sky-500', badge: 'ZAMF' }
  if (filePath.toLowerCase().endsWith('.json')) return { icon: FileJson, className: 'text-slate-400' }
  return { icon: FileText, className: 'text-slate-400' }
}

function createNodeRenderer({
  activeFile,
  aiProviders,
  decorations,
  onOpenFile,
  onNodeContextMenu,
}: {
  activeFile: ProjectFileReference | null
  aiProviders: AiProviderSummary[]
  decorations: Record<string, GitDecoration>
  onOpenFile: (file: ProjectFileReference) => void
  onNodeContextMenu: (node: TreeNode, event: React.MouseEvent<HTMLElement>) => void
}) {
  return function NodeRenderer({
    node,
    style,
  }: {
    node: { data: TreeNode; isOpen: boolean; isInternal: boolean; toggle: () => void }
    style: React.CSSProperties
  }) {
    const data = node.data as TreeNode
    const isFile = data.kind === 'file'
    const filePath = data.path || data.name
    const isZamfFile = isFile && Boolean(filePath && isZamfFilePath(filePath))
    const fileIcon = getFileIconMeta(filePath)
    const isActive = isFile && activeFile?.projectId === data.projectId && activeFile?.path === data.path
    const decoration = decorations[data.path || '']
    const provider = isZamfFile ? aiProviders.find((item) => item.filePath === data.path) || null : null
    const draggable = useDraggable({
      id: `provider-file:${data.projectId || 'project'}:${data.path || data.id}`,
      disabled: !isZamfFile || !data.projectId || !data.path || !provider,
      data: provider && data.projectId && data.path
        ? {
            providerFile: {
              kind: 'provider-file',
              projectId: data.projectId,
              path: data.path,
              provider,
            } satisfies ProviderFileDragPayload,
          }
        : undefined,
    })
    const FileIcon = fileIcon.icon

    function handleClick() {
      if (isFile && data.projectId && data.path) {
        onOpenFile({ projectId: data.projectId, path: data.path, name: data.name })
        return
      }
      node.toggle()
    }

    return (
      <div
        ref={draggable.setNodeRef}
        style={style}
        className={cn(
          'group flex cursor-default items-center gap-1.5 rounded px-2 text-xs',
          isActive ? 'bg-[#fff2ea] text-[#d95a1b]' : 'text-slate-700 hover:bg-slate-100',
          isZamfFile && provider ? 'cursor-grab active:cursor-grabbing' : '',
          draggable.isDragging ? 'opacity-45' : '',
          decoration && !isActive ? getGitDecorationTextClass(decoration.kind) : '',
        )}
        onClick={handleClick}
        onContextMenu={(event) => {
          event.preventDefault()
          onNodeContextMenu(data, event)
        }}
        {...draggable.listeners}
        {...draggable.attributes}
      >
        {isFile ? (
          <span className="h-3.5 w-3.5 shrink-0" />
        ) : node.isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        {isFile ? (
          <FileIcon className={cn('h-3.5 w-3.5', fileIcon.className)} />
        ) : (
          <Folder className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span className="min-w-0 flex-1 truncate">{data.name}</span>
        {fileIcon.badge ? <span className={cn('shrink-0 text-[10px] font-black', fileIcon.className)}>{fileIcon.badge}</span> : null}
        {decoration ? (
          <span className={cn('ml-auto text-[10px] font-black', getGitDecorationTextClass(decoration.kind))}>
            {decoration.status}
          </span>
        ) : null}
      </div>
    )
  }
}

function getGitDecorationTextClass(kind?: GitChangeKind) {
  const classes: Record<GitChangeKind, string> = {
    modified: 'text-[#d95a1b]',
    added: 'text-emerald-600',
    deleted: 'text-red-600',
    renamed: 'text-sky-600',
    copied: 'text-cyan-600',
    untracked: 'text-emerald-600',
    ignored: 'text-slate-400',
    conflict: 'text-red-700 font-black',
  }
  return kind ? classes[kind] : ''
}

function getGitDecorationBgClass(kind?: GitChangeKind) {
  const classes: Record<GitChangeKind, string> = {
    modified: 'bg-[#fff2ea] text-[#d95a1b]',
    added: 'bg-emerald-50 text-emerald-700',
    deleted: 'bg-red-50 text-red-700',
    renamed: 'bg-sky-50 text-sky-700',
    copied: 'bg-cyan-50 text-cyan-700',
    untracked: 'bg-emerald-50 text-emerald-700',
    ignored: 'bg-slate-100 text-slate-500',
    conflict: 'bg-red-100 text-red-800',
  }
  return kind ? classes[kind] : classes.modified
}

type FloatingTooltipState = {
  text: string
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>
} | null

function FloatingTooltip({ tooltip }: { tooltip: FloatingTooltipState }) {
  if (!tooltip || typeof document === 'undefined') return null

  const width = 260
  const margin = 10
  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
  const preferTop = tooltip.rect.top > 120
  const left = Math.min(Math.max(tooltip.rect.left + tooltip.rect.width / 2 - width / 2, margin), viewportWidth - width - margin)
  const top = preferTop
    ? Math.max(margin, tooltip.rect.top - margin)
    : Math.min(viewportHeight - margin, tooltip.rect.bottom + margin)

  return createPortal(
    <div
      className={cn('zpmt-floating-tooltip', preferTop ? 'zpmt-floating-tooltip--top' : 'zpmt-floating-tooltip--bottom')}
      style={{ left, top, width }}
    >
      {tooltip.text.split('\n').map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>,
    document.body,
  )
}

function TooltipAnchor({
  tooltip,
  children,
  className,
}: {
  tooltip: string
  children: React.ReactNode
  className?: string
}) {
  const [floatingTooltip, setFloatingTooltip] = useState<FloatingTooltipState>(null)

  function showTooltip(target: HTMLElement) {
    setFloatingTooltip({ text: tooltip, rect: target.getBoundingClientRect() })
  }

  return (
    <span
      className={className}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseMove={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => setFloatingTooltip(null)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={() => setFloatingTooltip(null)}
    >
      {children}
      <FloatingTooltip tooltip={floatingTooltip} />
    </span>
  )
}

function VariableTagsPanel({
  t,
  modelCapabilities,
}: {
  t: WorkbenchCopy
  modelCapabilities: ZpmtModelCapabilityGate
}) {
  return (
    <div className="flex flex-wrap gap-2 p-3">
      {VARIABLE_TYPE_ORDER.map((type) => {
        const typeLabel = t.variableTypes[type]
        const payload: InstructionDragPayload = { kind: 'variable', variableType: type }
        const disabled = !canUseInstructionPayload(payload, modelCapabilities)
        const tooltip = disabled ? `${typeLabel}\n${t.unsupportedByModel}` : typeLabel

        return (
          <TooltipAnchor key={type} tooltip={tooltip} className="inline-flex">
            <DraggableInstructionTag
              id={`variable:${type}`}
              payload={payload}
              title={typeLabel}
              disabled={disabled}
              className={cn('prompt-token-chip h-7 cursor-grab outline-none transition active:cursor-grabbing focus:ring-2 focus:ring-[#FB7E3D]/20', getPromptTokenStyleClass(type))}
            >
              <span className="truncate">{typeLabel}</span>
            </DraggableInstructionTag>
          </TooltipAnchor>
        )
      })}
    </div>
  )
}

function DraggableInstructionTag({
  id,
  payload,
  title,
  disabled,
  className,
  children,
}: {
  id: string
  payload: InstructionDragPayload
  title: string
  disabled?: boolean
  className: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { payload },
    attributes: { roleDescription: title },
    disabled,
  })
  const style: React.CSSProperties | undefined = isDragging ? { opacity: 0.45 } : undefined
  const dragAttributes = disabled ? {} : attributes
  const dragListeners = disabled ? {} : listeners

  return (
    <span
      ref={setNodeRef}
      aria-label={title}
      aria-disabled={disabled || undefined}
      className={cn(
        className,
        disabled
          ? 'zpmt-token-chip--unsupported !cursor-not-allowed opacity-80'
          : 'cursor-grab touch-none active:cursor-grabbing',
      )}
      style={style}
      {...dragListeners}
      {...dragAttributes}
    >
      {children}
    </span>
  )
}

function InstructionDragOverlay({ payload, t, locale }: { payload: InstructionDragPayload; t: WorkbenchCopy; locale: Locale }) {
  const label =
    payload.kind === 'variable'
      ? t.variableTypes[payload.variableType]
      : payload.item.name[locale]
  const styleKey: PromptTokenStyleKey = payload.kind === 'variable' ? payload.variableType : payload.kind === 'recipe' ? 'recipe' : 'unknown'

  return (
    <span className={cn('prompt-token-chip h-7 max-w-[220px] opacity-[0.35] shadow-lg', getPromptTokenStyleClass(styleKey))}>
      <span className="truncate">{label}</span>
    </span>
  )
}

function ProviderFileDragOverlay({ payload }: { payload: ProviderFileDragPayload }) {
  return (
    <span className="prompt-token-chip h-7 max-w-[240px] border-sky-300 bg-sky-50 text-sky-700 opacity-[0.55] shadow-lg">
      <FileJson className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{payload.provider.name}</span>
    </span>
  )
}

function readDndInstructionPayload(value: unknown): InstructionDragPayload | null {
  if (!isRecord(value)) return null
  return isInstructionDragPayload(value.payload) ? value.payload : null
}

function readDndProviderFilePayload(value: unknown): ProviderFileDragPayload | null {
  if (!isRecord(value)) return null
  const payload = value.providerFile
  if (!isRecord(payload)) return null
  if (payload.kind !== 'provider-file') return null
  if (typeof payload.projectId !== 'string' || typeof payload.path !== 'string' || !isRecord(payload.provider)) return null
  return payload as ProviderFileDragPayload
}

function isInstructionDragPayload(value: unknown): value is InstructionDragPayload {
  if (!isRecord(value)) return false
  if (value.kind === 'variable') return typeof value.variableType === 'string' && VARIABLE_TYPE_ORDER.includes(value.variableType as VariableType)
  if (value.kind !== 'recipe' && value.kind !== 'tool') return false
  return typeof value.categoryId === 'string' && isRecord(value.item) && typeof value.item.id === 'string'
}

function readZpmtDroppableData(value: unknown): ZpmtDroppableData | null {
  if (!isRecord(value)) return null
  if (value.kind !== 'zpmt-root' && value.kind !== 'zpmt-prompt' && value.kind !== 'zpmt-config') return null
  return typeof value.onDropInstruction === 'function' ? value as ZpmtDroppableData : null
}

function getDragClientPoint(event: DragMoveEvent | DragEndEvent): ZpmtDropPoint | null {
  const start = getClientPointFromEvent(event.activatorEvent)
  if (!start) return null
  return {
    x: start.x + event.delta.x,
    y: start.y + event.delta.y,
  }
}

function getClientPointFromEvent(event: Event): ZpmtDropPoint | null {
  if ('clientX' in event && typeof event.clientX === 'number' && 'clientY' in event && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY }
  }

  if (typeof TouchList !== 'undefined' && 'touches' in event && event.touches instanceof TouchList && event.touches[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  return null
}

function dispatchZpmtInstructionPointEvent(eventName: string, payload: InstructionDragPayload, point: ZpmtDropPoint) {
  const detail: ZpmtInstructionPointEventDetail = { payload, point, handled: false }
  window.dispatchEvent(new CustomEvent<ZpmtInstructionPointEventDetail>(eventName, { detail }))
  return detail.handled
}

function InputPanel() {
  const form = useForm<InputForm>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      siteTitle: 'ZPMT',
      description: '新时代 AI 代码编辑工具以及编辑框架',
      getStarted: '/pricing',
      primary: '#FB7E3D',
    },
  })

  return (
    <form className="space-y-2.5 p-3">
      <label className="block text-xs font-semibold text-slate-600">
        site.title
        <Input className="mt-1" {...form.register('siteTitle')} />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        site.description
        <Input className="mt-1" {...form.register('description')} />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        links.getStarted
        <Input className="mt-1" {...form.register('getStarted')} />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        theme.primary
        <Input className="mt-1" {...form.register('primary')} />
      </label>
      <button type="button" className="text-xs font-semibold text-[#d95a1b]">
        显示更多变量（4）
      </button>
    </form>
  )
}

function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateHeight = () => setHeight(Math.max(160, Math.floor(element.getBoundingClientRect().height)))
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, height] as const
}

function WorkbenchWindow({
  id,
  title,
  icon: Icon,
  active,
  minimized,
  minimizeLabel,
  restoreLabel,
  children,
  onFocus,
  onMinimize,
  onRestore,
}: {
  id: WindowId
  title: string
  icon: typeof Home
  active: boolean
  minimized: boolean
  minimizeLabel: string
  restoreLabel: string
  children: React.ReactNode
  onFocus: (id: WindowId) => void
  onMinimize: (id: WindowId) => void
  onRestore: (id: WindowId) => void
}) {
  function handleDoubleClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('.workbench-window__control')) return

    if (minimized) {
      event.stopPropagation()
      onRestore(id)
      return
    }
  }

  return (
    <section
      className={`workbench-window workbench-window--${id} ${active ? 'workbench-window--active' : ''} ${
        minimized ? 'workbench-window--minimized' : ''
      }`}
      onMouseDown={() => onFocus(id)}
      onDoubleClick={handleDoubleClick}
    >
      <div className="workbench-window__title">
        <div className="workbench-window__label">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
          <span className="truncate">{title}</span>
        </div>
        <button
          type="button"
          className="workbench-window__control"
          aria-label={minimized ? restoreLabel : minimizeLabel}
          title={minimized ? restoreLabel : minimizeLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (minimized) {
              onRestore(id)
            } else {
              onMinimize(id)
            }
          }}
        >
          {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        </button>
      </div>
      {minimized ? null : <div className="workbench-window__content">{children}</div>}
    </section>
  )
}

function ProjectWorkspacePanel({
  t,
  activity,
  projects,
  activeProject,
  activeProjectId,
  projectsLoading,
  activeFile,
  aiProviders,
  configDiagnostics,
  sourceControlStatus,
  sourceControlLoading,
  sourceControlBusyAction,
  onActivityChange,
  onSelectProject,
  onRefreshProjects,
  onRefreshSourceControl,
  onSourceControlAction,
  onOpenFile,
  onOpenDiff,
  onOpenNewProject,
  onProjectDeleted,
  onEntryDeleted,
  onEntryRenamed,
  onNotify,
}: {
  t: WorkbenchCopy
  activity: WorkbenchActivity
  projects: ProjectSummary[]
  activeProject: ProjectSummary | null
  activeProjectId: string
  projectsLoading: boolean
  activeFile: ProjectFileReference | null
  aiProviders: AiProviderSummary[]
  configDiagnostics: ProjectConfigDiagnostic[]
  sourceControlStatus: SourceControlStatus | null
  sourceControlLoading: boolean
  sourceControlBusyAction: string
  onActivityChange: (activity: WorkbenchActivity) => void
  onSelectProject: (projectId: string) => void
  onRefreshProjects: (nextActiveProjectId?: string) => Promise<void>
  onRefreshSourceControl: () => Promise<void>
  onSourceControlAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean | void>
  onOpenFile: (file: ProjectFileReference) => void
  onOpenDiff: (input: { path: string; staged: boolean }) => Promise<void>
  onOpenNewProject: () => void
  onProjectDeleted: (projectId: string) => void
  onEntryDeleted: (projectId: string, entryPath: string) => void
  onEntryRenamed: (projectId: string, oldPath: string, nextName: string) => void
  onNotify: (description: string, title?: string) => void
}) {
  const changeCount = getSourceControlChangeCount(sourceControlStatus)

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="activity-bar">
        <ActivityBarButton
          icon={Boxes}
          label={t.activity.explorer}
          active={activity === 'explorer'}
          onClick={() => onActivityChange('explorer')}
        />
        <ActivityBarButton
          icon={GitBranch}
          label={t.activity.sourceControl}
          active={activity === 'sourceControl'}
          badge={changeCount}
          onClick={() => onActivityChange('sourceControl')}
        />
      </aside>
      <div className="min-w-0 flex-1">
        {activity === 'explorer' ? (
          <ProjectFilesPanel
            t={t}
            projects={projects}
            activeProject={activeProject}
            activeProjectId={activeProjectId}
            loading={projectsLoading}
            activeFile={activeFile}
            aiProviders={aiProviders}
            configDiagnostics={configDiagnostics}
            decorations={sourceControlStatus?.decorations || {}}
            sourceControlConnected={Boolean(sourceControlStatus?.connected)}
            sourceControlBusyAction={sourceControlBusyAction}
            onOpenFile={onOpenFile}
            onNotify={onNotify}
            onSelectProject={onSelectProject}
            onRefreshProjects={onRefreshProjects}
            onSourceControlAction={onSourceControlAction}
            onProjectDeleted={onProjectDeleted}
            onEntryDeleted={onEntryDeleted}
            onEntryRenamed={onEntryRenamed}
            onOpenNewProject={onOpenNewProject}
          />
        ) : (
          <SourceControlPanel
            t={t}
            project={activeProject}
            status={sourceControlStatus}
            loading={sourceControlLoading}
            busyAction={sourceControlBusyAction}
            onNotify={onNotify}
            onOpenFile={onOpenFile}
            onAction={onSourceControlAction}
            onRefresh={onRefreshSourceControl}
            onOpenDiff={onOpenDiff}
          />
        )}
      </div>
    </div>
  )
}

function ActivityBarButton({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: typeof Home
  label: string
  active: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button type="button" className={cn('activity-bar__button', active && 'activity-bar__button--active')} title={label} aria-label={label} onClick={onClick}>
      <Icon className="h-4 w-4" />
      {badge ? <span className="activity-bar__badge">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  )
}

function ProjectFilesPanel({
  t,
  projects,
  activeProject,
  activeProjectId,
  loading,
  activeFile,
  aiProviders,
  configDiagnostics,
  decorations,
  sourceControlConnected,
  sourceControlBusyAction,
  onOpenFile,
  onNotify,
  onSelectProject,
  onRefreshProjects,
  onSourceControlAction,
  onOpenNewProject,
  onProjectDeleted,
  onEntryDeleted,
  onEntryRenamed,
}: {
  t: WorkbenchCopy
  projects: ProjectSummary[]
  activeProject: ProjectSummary | null
  activeProjectId: string
  loading: boolean
  activeFile: ProjectFileReference | null
  aiProviders: AiProviderSummary[]
  configDiagnostics: ProjectConfigDiagnostic[]
  decorations: Record<string, GitDecoration>
  sourceControlConnected: boolean
  sourceControlBusyAction: string
  onOpenFile: (file: ProjectFileReference) => void
  onNotify: (description: string, title?: string) => void
  onSelectProject: (projectId: string) => void
  onRefreshProjects: (nextActiveProjectId?: string) => Promise<void>
  onSourceControlAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean | void>
  onOpenNewProject: () => void
  onProjectDeleted: (projectId: string) => void
  onEntryDeleted: (projectId: string, entryPath: string) => void
  onEntryRenamed: (projectId: string, oldPath: string, nextName: string) => void
}) {
  const [fileTreeViewportRef, fileTreeViewportHeight] = useMeasuredHeight<HTMLDivElement>()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)
  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null)
  const fileTree = activeProject?.tree ? [activeProject.tree] : []
  const fileTreeHeight = Math.max(160, (fileTreeViewportHeight || 360) - 16)
  const gitActionBusy = Boolean(sourceControlBusyAction)
  const showGitActions = sourceControlConnected
  const NodeRenderer = useMemo(
    () =>
      createNodeRenderer({
        activeFile,
        aiProviders,
        decorations,
        onOpenFile,
        onNodeContextMenu: (node, event) => {
          setContextMenu({ x: event.clientX, y: event.clientY, node })
        },
      }),
    [activeFile, aiProviders, decorations, onOpenFile],
  )

  async function submitEntryDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!entryDialog || !activeProject) return

    const response = await submitEntryOperation(activeProject.id, entryDialog)
    if (!response?.ok || !response.project) {
      onNotify(response?.message || '文件操作失败')
      return
    }

    setEntryDialog(null)
    if (entryDialog.mode === 'rename') {
      onEntryRenamed(activeProject.id, entryDialog.node.path || '', entryDialog.name)
    }
    await onRefreshProjects(response.project.id)
    dispatchSourceControlRefresh()
  }

  async function submitEntryOperation(projectId: string, dialog: EntryDialogState) {
    if (dialog.mode === 'folder') {
      return fetchJson('/api/projects/folders', {
        method: 'POST',
        body: {
          projectId,
          parentPath: dialog.folder.path || '',
          folderName: dialog.name,
        },
      })
    }

    if (dialog.mode === 'prompt') {
      const fileName = ensureZpmtFileName(dialog.name)
      const provider = findAiProvider(aiProviders, dialog.providerId) || null
      return fetchJson('/api/projects/files', {
        method: 'POST',
        body: {
          projectId,
          parentPath: dialog.folder.path || '',
          fileName,
          content: createZpmtContent({
            promptType: dialog.promptType,
            outputType: dialog.outputType,
            provider,
            model: dialog.model,
            responseConfig: dialog.responseConfig,
          }),
        },
      })
    }

    if (dialog.mode === 'lexicon' || dialog.mode === 'provider') {
      const fileName = dialog.mode === 'lexicon' ? ensureZlexFileName(dialog.name) : ensureZamfFileName(dialog.name)
      return fetchJson('/api/projects/files', {
        method: 'POST',
        body: {
          projectId,
          parentPath: dialog.folder.path || '',
          fileName,
          content: dialog.mode === 'lexicon' ? createZlexTemplate(fileName) : createZamfTemplate(fileName),
        },
      })
    }

    return fetchJson('/api/projects/files', {
      method: 'PATCH',
      body: {
        projectId,
        path: dialog.node.path || '',
        nextName: dialog.name,
      },
    })
  }

  async function deleteEntry(node: TreeNode) {
    if (!activeProject || !node.path) return
    if (!window.confirm(`${t.delete}: ${node.name}`)) return

    const response = await fetchJson('/api/projects/files', {
      method: 'DELETE',
      body: {
        projectId: activeProject.id,
        path: node.path,
      },
    })
    if (!response?.ok || !response.project) {
      onNotify(response?.message || '删除失败')
      return
    }

    onEntryDeleted(activeProject.id, node.path)
    await onRefreshProjects(response.project.id)
    dispatchSourceControlRefresh()
  }

  async function deleteProject() {
    if (!activeProject || loading) return
    const confirmMessage = t.deleteProjectConfirm.replace('{name}', activeProject.name)
    if (!window.confirm(confirmMessage)) return

    const projectId = activeProject.id
    const nextActiveProjectId = projects.find((project) => project.id !== projectId)?.id
    const response = await fetchJson('/api/projects', {
      method: 'DELETE',
      body: { projectId },
    })

    if (!response?.ok) {
      onNotify(response?.message || '项目删除失败')
      return
    }

    onProjectDeleted(projectId)
    await onRefreshProjects(nextActiveProjectId)
    dispatchSourceControlRefresh()
  }

  function copyEntryPath(node: TreeNode) {
    if (!node.path) return
    navigator.clipboard?.writeText(node.path).catch(() => undefined)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200 px-3">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-bold">
          <Boxes className="h-3.5 w-3.5 text-slate-500" />
          <select
            className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none"
            value={activeProjectId}
            onChange={(event) => onSelectProject(event.target.value)}
            title={activeProject?.name || t.project}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1.5 text-slate-500">
          <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100" title={t.newProject} onClick={onOpenNewProject}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100" title={t.scmRefresh} onClick={() => onRefreshProjects(activeProject?.id)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-current"
            title={t.deleteProject}
            aria-label={t.deleteProject}
            disabled={!activeProject || loading}
            onClick={() => void deleteProject()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {configDiagnostics.length ? (
        <div
          className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800"
          title={configDiagnostics.map((item) => `${item.path}: ${item.message}`).join('\n')}
        >
          {t.configDiagnostics}：{configDiagnostics.length}
        </div>
      ) : null}

      <div ref={fileTreeViewportRef} className="min-h-0 flex-1 overflow-hidden p-2">
        {loading ? (
          <div className="p-2 text-xs text-slate-500">{t.loading}</div>
        ) : fileTree.length ? (
          <Tree data={fileTree} openByDefault width="100%" height={fileTreeHeight} indent={16} rowHeight={24}>
            {NodeRenderer}
          </Tree>
        ) : (
          <div className="p-2 text-xs text-slate-500">{t.noOpenFile}</div>
        )}
      </div>

      {contextMenu ? (
        <WorkbenchContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.node.kind === 'file' ? (
            <ContextMenuButton
              icon={FileText}
              label={t.openFile}
              onClick={() => {
                if (contextMenu.node.projectId && contextMenu.node.path) {
                  onOpenFile({ projectId: contextMenu.node.projectId, path: contextMenu.node.path, name: contextMenu.node.name })
                }
                setContextMenu(null)
              }}
            />
          ) : null}
          {contextMenu.node.kind !== 'file' ? (
            <>
              <ContextMenuButton
                icon={FolderPlus}
                label={t.newFolder}
                onClick={() => {
                  setEntryDialog({ mode: 'folder', folder: contextMenu.node, name: '' })
                  setContextMenu(null)
                }}
              />
              <ContextMenuButton
                icon={FilePlus2}
                label={t.newPromptFile}
                onClick={() => {
                  setEntryDialog(createPromptEntryDialog(contextMenu.node, aiProviders))
                  setContextMenu(null)
                }}
              />
              <ContextMenuButton
                icon={FileJson}
                label={t.newLexiconFile}
                onClick={() => {
                  setEntryDialog({ mode: 'lexicon', folder: contextMenu.node, name: '词汇变量.zlex' })
                  setContextMenu(null)
                }}
              />
              <ContextMenuButton
                icon={FileJson}
                label={t.newProviderModelFile}
                onClick={() => {
                  setEntryDialog({ mode: 'provider', folder: contextMenu.node, name: '供应商模型.zamf' })
                  setContextMenu(null)
                }}
              />
            </>
          ) : null}
          {contextMenu.node.path ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuButton
                icon={Pencil}
                label={t.rename}
                onClick={() => {
                  setEntryDialog({ mode: 'rename', node: contextMenu.node, name: contextMenu.node.name })
                  setContextMenu(null)
                }}
              />
              <ContextMenuButton
                icon={Trash2}
                label={t.delete}
                danger
                onClick={() => {
                  const node = contextMenu.node
                  setContextMenu(null)
                  void deleteEntry(node)
                }}
              />
              <ContextMenuButton
                icon={Copy}
                label={t.copyPath}
                onClick={() => {
                  copyEntryPath(contextMenu.node)
                  setContextMenu(null)
                }}
              />
            </>
          ) : null}
          {showGitActions ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuButton
                icon={sourceControlBusyAction === 'stage' || sourceControlBusyAction === 'stageAll' ? RefreshCw : Plus}
                label={contextMenu.node.path ? t.scmStage : t.scmStageAll}
                disabled={gitActionBusy}
                onClick={() => {
                  const path = contextMenu.node.path || ''
                  setContextMenu(null)
                  void onSourceControlAction(path ? 'stage' : 'stageAll', path ? { path } : undefined)
                }}
              />
              <ContextMenuButton
                icon={sourceControlBusyAction === 'unstage' || sourceControlBusyAction === 'unstageAll' ? RefreshCw : Minus}
                label={contextMenu.node.path ? t.scmUnstage : t.scmUnstageAll}
                disabled={gitActionBusy}
                onClick={() => {
                  const path = contextMenu.node.path || ''
                  setContextMenu(null)
                  void onSourceControlAction(path ? 'unstage' : 'unstageAll', path ? { path } : undefined)
                }}
              />
              {contextMenu.node.path ? (
                <ContextMenuButton
                  icon={sourceControlBusyAction === 'discard' ? RefreshCw : RotateCcw}
                  label={t.scmDiscard}
                  danger
                  disabled={gitActionBusy}
                  onClick={() => {
                    const path = contextMenu.node.path || ''
                    setContextMenu(null)
                    void onSourceControlAction('discard', { path })
                  }}
                />
              ) : null}
            </>
          ) : null}
        </WorkbenchContextMenu>
      ) : null}

      {entryDialog ? (
        <EntryDialogOverlay
          t={t}
          dialog={entryDialog}
          aiProviders={aiProviders}
          onChange={setEntryDialog}
          onClose={() => setEntryDialog(null)}
          onSubmit={submitEntryDialog}
        />
      ) : null}
    </div>
  )
}

function WorkbenchContextMenu({
  x,
  y,
  children,
  onClose,
}: {
  x: number
  y: number
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="workbench-context-menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  )
}

function ContextMenuButton({
  icon: Icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: typeof Home
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn('workbench-context-menu__item disabled:cursor-not-allowed disabled:opacity-50', danger && 'workbench-context-menu__item--danger')}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-slate-100" />
}

function ProjectQuickCreateDialog({
  t,
  projectMode,
  projectName,
  projectFileName,
  repositoryUrl,
  onProjectModeChange,
  onProjectNameChange,
  onProjectFileNameChange,
  onRepositoryUrlChange,
  onClose,
  onSubmit,
}: {
  t: WorkbenchCopy
  projectMode: 'local' | 'github'
  projectName: string
  projectFileName: string
  repositoryUrl: string
  onProjectModeChange: (mode: 'local' | 'github') => void
  onProjectNameChange: (value: string) => void
  onProjectFileNameChange: (value: string) => void
  onRepositoryUrlChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <section
        className="absolute left-1/2 top-16 flex max-h-[72vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.newProject}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Boxes className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">{t.newProject}</p>
              <p className="truncate text-[10px] text-slate-500">
                {projectMode === 'github' ? t.githubImport : t.localProject}
              </p>
            </div>
          </div>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-auto p-3" onSubmit={onSubmit}>
          <ToggleGroup
            type="single"
            value={projectMode}
            className="mb-3 inline-flex h-7 w-fit max-w-full justify-start overflow-hidden rounded-md border border-border bg-card"
            onValueChange={(value) => {
              if (value === 'local' || value === 'github') onProjectModeChange(value)
            }}
          >
            <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="local">{t.localProject}</ToggleGroupItem>
            <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="github">{t.githubImport}</ToggleGroupItem>
          </ToggleGroup>
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            {t.projectName}
            <Input autoFocus className="mt-1" value={projectName} onChange={(event) => onProjectNameChange(event.target.value)} />
          </label>
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            {t.projectFileName}
            <Input className="mt-1" value={projectFileName} onChange={(event) => onProjectFileNameChange(event.target.value)} placeholder="my-project" />
          </label>
          {projectMode === 'github' ? (
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              {t.repositoryUrl}
              <Input className="mt-1" value={repositoryUrl} onChange={(event) => onRepositoryUrlChange(event.target.value)} placeholder="https://github.com/owner/repo.git" />
            </label>
          ) : null}
          <Button className="mt-2 w-full" size="sm" type="submit">
            {projectMode === 'github' ? t.importProject : t.createProject}
          </Button>
        </form>
      </section>
    </div>
  )
}

function EntryDialogOverlay({
  t,
  dialog,
  aiProviders,
  onChange,
  onClose,
  onSubmit,
}: {
  t: WorkbenchCopy
  dialog: EntryDialogState
  aiProviders: AiProviderSummary[]
  onChange: (dialog: EntryDialogState) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [mounted, setMounted] = useState(false)
  const title =
    dialog.mode === 'folder'
      ? t.newFolder
      : dialog.mode === 'prompt'
        ? t.newPromptFile
        : dialog.mode === 'lexicon'
          ? t.newLexiconFile
          : dialog.mode === 'provider'
            ? t.newProviderModelFile
            : t.rename
  const label = dialog.mode === 'folder' ? t.folderName : dialog.mode === 'rename' ? t.renameTo : t.fileName
  const submitLabel = dialog.mode === 'folder' ? t.createFolder : dialog.mode === 'rename' ? t.rename : t.createFile
  const Icon = dialog.mode === 'folder' ? FolderPlus : dialog.mode === 'rename' ? Pencil : dialog.mode === 'prompt' ? FilePlus2 : FileJson
  const compatibleModels = dialog.mode === 'prompt' ? listCompatibleModelsForProvider(aiProviders, dialog.providerId, dialog.outputType) : []
  const selectedModelContext = dialog.mode === 'prompt' ? getSelectedAiModelContext(aiProviders, dialog.providerId, dialog.model) : null
  const responseSchema =
    dialog.mode === 'prompt'
      ? resolveAiModelParameterSchema(
          dialog.outputType,
          selectedModelContext?.provider?.providerType,
          dialog.model,
          selectedModelContext?.model,
        )
      : null

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <form
        className="absolute left-1/2 top-16 flex max-h-[72vh] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
            <p className="truncate text-xs font-black text-slate-900">{title}</p>
          </div>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          <label className="block text-xs font-semibold text-slate-600">
            {label}
            <Input autoFocus className="mt-1" value={dialog.name} onChange={(event) => onChange({ ...dialog, name: event.target.value } as EntryDialogState)} required />
          </label>
          {dialog.mode === 'prompt' ? (
            <>
              <div className="mt-3">
                <span className="block text-xs font-semibold text-slate-600">{t.promptFileType}</span>
                <ToggleGroup
                  type="single"
                  value={dialog.promptType}
                  className="mt-1 inline-flex h-7 w-fit max-w-full justify-start overflow-hidden rounded-md border border-border bg-card"
                  onValueChange={(value) => {
                    if (value === 'simple' || value === 'agent') onChange({ ...dialog, promptType: value })
                  }}
                >
                  <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="simple">{t.simplePrompt}</ToggleGroupItem>
                  <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="agent">{t.agentPrompt}</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="mt-3">
                <span className="block text-xs font-semibold text-slate-600">{t.outputType}</span>
                <ToggleGroup
                  type="single"
                  value={dialog.outputType}
                  className="mt-1 inline-flex h-7 w-fit max-w-full justify-start overflow-hidden rounded-md border border-border bg-card"
                  onValueChange={(value) => {
                    if (value === 'image' || value === 'text') {
                      const nextSelection = selectDefaultAiModel(aiProviders, value)
                      onChange({
                        ...dialog,
                        outputType: value,
                        providerId: nextSelection.providerRef,
                        model: nextSelection.model,
                        responseConfig: defaultResponseConfig(value, nextSelection.providerType, nextSelection.model, nextSelection.modelEntry),
                      })
                    }
                  }}
                >
                  {ZPMT_OUTPUT_TYPES.map((type) => (
                    <ToggleGroupItem className="shrink-0 whitespace-nowrap" key={type} value={type}>
                      {t.outputTypes[type]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <label className="mt-3 block text-xs font-semibold text-slate-600">
                {t.aiProvider}
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={dialog.providerId}
                  disabled={!aiProviders.length}
                  onChange={(event) => {
                    const provider = findAiProvider(aiProviders, event.target.value)
                    const model = findCompatibleModelForProvider(provider, dialog.outputType)
                    onChange({
                      ...dialog,
                      providerId: event.target.value,
                      model: model?.id || '',
                      responseConfig: defaultResponseConfig(dialog.outputType, provider?.providerType, model?.id, model),
                    })
                  }}
                >
                  {aiProviders.length ? null : <option value="">{t.noAiProvider}</option>}
                  {aiProviders.map((provider) => (
                    <option key={getAiProviderRef(provider)} value={getAiProviderRef(provider)}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  {t.aiModel}
                  {selectedModelContext?.model ? <ToolCallingBadge t={t} model={selectedModelContext.model} /> : null}
                </span>
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={dialog.model}
                  disabled={!compatibleModels.length}
                  onChange={(event) => {
                    const model = compatibleModels.find((item) => item.id === event.target.value) || null
                    const provider = findAiProvider(aiProviders, dialog.providerId) || null
                    onChange({
                      ...dialog,
                      model: model?.id || event.target.value,
                      responseConfig: defaultResponseConfig(dialog.outputType, provider?.providerType, model?.id || event.target.value, model),
                    })
                  }}
                >
                  {compatibleModels.length ? null : <option value="">{t.noModelForOutput}</option>}
                  {compatibleModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}
                    </option>
                  ))}
                </select>
              </label>
              {responseSchema ? (
                <ResponseConfigFields
                  t={t}
                  schema={responseSchema}
                  value={dialog.responseConfig}
                  onChange={(responseConfig) => onChange({ ...dialog, responseConfig })}
                />
              ) : null}
            </>
          ) : null}
          <Button className="mt-3 w-full" size="sm" type="submit">
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function ToolCallingBadge({
  t,
  model,
  className,
}: {
  t: WorkbenchCopy
  model: AiProviderModel
  className?: string
}) {
  const variant = model.toolCalling === 'supported' ? 'default' : model.toolCalling === 'unsupported' ? 'danger' : 'outline'
  return (
    <Badge variant={variant} className={className}>
      {t.toolCalling}：{t.toolCallingStatus[model.toolCalling]}
    </Badge>
  )
}

function ResponseConfigFields({
  t,
  schema,
  value,
  containerClassName,
  fieldClassName,
  controlClassName,
  onChange,
}: {
  t: WorkbenchCopy
  schema: AiModelParameterSchema
  value: ZpmtResponseConfig
  containerClassName?: string
  fieldClassName?: string
  controlClassName?: string
  onChange: (value: ZpmtResponseConfig) => void
}) {
  const labelClassName = fieldClassName || 'block text-xs font-semibold text-slate-600'
  const selectClassName =
    controlClassName ||
    'mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'

  if (schema.kind === 'image') {
    const sizeIsCustom = Boolean(schema.allowCustomSize && value.imageSize && !schema.sizeOptions.includes(value.imageSize))
    const selectedSize = sizeIsCustom ? '__custom__' : value.imageSize || schema.defaultImageSize
    const selectedOutputFormat = value.imageOutputFormat || schema.defaultOutputFormat || schema.outputFormats?.[0]
    const checkboxClassName = fieldClassName
      ? `${fieldClassName} zpmt-config-field--inline`
      : 'mt-1 flex items-center gap-2 text-xs font-semibold text-slate-600'
    return (
      <div className={cn('mt-3 grid gap-3 sm:grid-cols-2', containerClassName)}>
        {schema.sizeMode === 'resolution_ratio' && schema.resolutionOptions?.length ? (
          <>
            <label className={labelClassName}>
              {t.imageResolution}
              <select
                className={selectClassName}
                value={value.imageResolution || schema.defaultImageResolution || schema.resolutionOptions[0].resolution}
                onChange={(event) => {
                  const nextResolution = event.target.value
                  const aspectOptions = getImageAspectRatioOptions(schema, nextResolution)
                  const nextAspectRatio = aspectOptions.some((item) => item.aspectRatio === value.imageAspectRatio)
                    ? value.imageAspectRatio
                    : schema.defaultImageAspectRatio || aspectOptions[0]?.aspectRatio || ''
                  onChange({
                    ...value,
                    imageResolution: nextResolution,
                    imageAspectRatio: nextAspectRatio,
                    imageSize: getImageSizeForResolution(schema, nextResolution, nextAspectRatio),
                  })
                }}
              >
                {schema.resolutionOptions.map((option) => (
                  <option key={option.resolution} value={option.resolution}>
                    {option.resolution}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              {t.imageAspectRatio}
              <select
                className={selectClassName}
                value={
                  value.imageAspectRatio ||
                  schema.defaultImageAspectRatio ||
                  getImageAspectRatioOptions(schema, value.imageResolution || schema.defaultImageResolution)[0]?.aspectRatio ||
                  ''
                }
                onChange={(event) => {
                  const nextAspectRatio = event.target.value
                  const nextResolution = value.imageResolution || schema.defaultImageResolution || schema.resolutionOptions?.[0]?.resolution || ''
                  onChange({
                    ...value,
                    imageResolution: nextResolution,
                    imageAspectRatio: nextAspectRatio,
                    imageSize: getImageSizeForResolution(schema, nextResolution, nextAspectRatio),
                  })
                }}
              >
                {getImageAspectRatioOptions(schema, value.imageResolution || schema.defaultImageResolution).map((option) => (
                  <option key={`${option.aspectRatio}:${option.size}`} value={option.aspectRatio}>
                    {option.aspectRatio} / {option.size}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : schema.sizeOptions.length ? (
          <label className={labelClassName}>
            {t.imageSize}
            <select
              className={selectClassName}
              value={selectedSize}
              onChange={(event) => {
                if (event.target.value === '__custom__') {
                  onChange({ ...value, imageSize: '' })
                  return
                }
                onChange({ ...value, imageSize: event.target.value })
              }}
            >
              {schema.sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              {schema.allowCustomSize ? <option value="__custom__">{t.customImageSize}</option> : null}
            </select>
          </label>
        ) : null}
        {schema.allowCustomSize && (selectedSize === '__custom__' || (schema.sizeMode === 'custom_constraints' && sizeIsCustom)) ? (
          <label className={labelClassName}>
            {t.customImageSize}
            <Input
              className={controlClassName || 'mt-1'}
              value={value.imageSize || ''}
              placeholder={schema.customSizePlaceholder || '1024x1024'}
              onChange={(event) => onChange({ ...value, imageSize: event.target.value.trim() })}
            />
          </label>
        ) : null}
        {schema.imageQualities.length ? (
          <label className={labelClassName}>
            {t.imageQuality}
            <select
              className={selectClassName}
              value={value.imageQuality || schema.defaultImageQuality || schema.imageQualities[0]}
              onChange={(event) => onChange({ ...value, imageQuality: event.target.value })}
            >
              {schema.imageQualities.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schema.outputFormats?.length ? (
          <label className={labelClassName}>
            {t.imageOutputFormat}
            <select
              className={selectClassName}
              value={selectedOutputFormat || schema.outputFormats[0]}
              disabled={schema.outputFormats.length === 1}
              onChange={(event) => onChange({ ...value, imageOutputFormat: event.target.value as ZpmtResponseConfig['imageOutputFormat'] })}
            >
              {schema.outputFormats.map((format) => (
                <option key={format} value={format}>
                  {t.imageOutputFormats[format]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schema.outputCompression && (selectedOutputFormat === 'jpeg' || selectedOutputFormat === 'webp') ? (
          <label className={labelClassName}>
            {t.imageOutputCompression}
            <Input
              className={controlClassName || 'mt-1'}
              type="number"
              min={schema.outputCompression.min}
              max={schema.outputCompression.max}
              step={schema.outputCompression.step}
              value={String(value.imageOutputCompression ?? schema.outputCompression.defaultValue)}
              onChange={(event) =>
                onChange({
                  ...value,
                  imageOutputCompression: readNumberInput(event.target.value, schema.outputCompression?.defaultValue || 0),
                })
              }
            />
          </label>
        ) : null}
        {schema.responseFormats?.length ? (
          <label className={labelClassName}>
            {t.imageResponseFormat}
            <select
              className={selectClassName}
              value={value.imageResponseFormat || schema.defaultImageResponseFormat || schema.responseFormats[0]}
              onChange={(event) => onChange({ ...value, imageResponseFormat: event.target.value as ZpmtResponseConfig['imageResponseFormat'] })}
            >
              {schema.responseFormats.map((format) => (
                <option key={format} value={format}>
                  {t.imageResponseFormats[format]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schema.backgroundOptions?.length ? (
          <label className={labelClassName}>
            {t.imageBackground}
            <select
              className={selectClassName}
              value={value.imageBackground || schema.defaultBackground || schema.backgroundOptions[0]}
              onChange={(event) => onChange({ ...value, imageBackground: event.target.value as ZpmtResponseConfig['imageBackground'] })}
            >
              {schema.backgroundOptions.map((background) => (
                <option key={background} value={background}>
                  {t.imageBackgrounds[background]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schema.moderationOptions?.length ? (
          <label className={labelClassName}>
            {t.imageModeration}
            <select
              className={selectClassName}
              value={value.imageModeration || schema.defaultModeration || schema.moderationOptions[0]}
              onChange={(event) => onChange({ ...value, imageModeration: event.target.value as ZpmtResponseConfig['imageModeration'] })}
            >
              {schema.moderationOptions.map((moderation) => (
                <option key={moderation} value={moderation}>
                  {t.imageModerations[moderation]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schema.imageStyles?.length ? (
          <label className={labelClassName}>
            {t.imageStyle}
            <select
              className={selectClassName}
              value={value.imageStyle || schema.defaultImageStyle || schema.imageStyles[0]}
              onChange={(event) => onChange({ ...value, imageStyle: event.target.value as ZpmtResponseConfig['imageStyle'] })}
            >
              {schema.imageStyles.map((style) => (
                <option key={style} value={style}>
                  {t.imageStyles[style]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schema.watermark ? (
          <label className={checkboxClassName}>
            <input
              type="checkbox"
              checked={value.watermark ?? schema.watermark.defaultValue}
              onChange={(event) => onChange({ ...value, watermark: event.target.checked })}
            />
            <span>{t.watermark}</span>
          </label>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('mt-3 grid gap-3 sm:grid-cols-2', containerClassName)}>
      <label className={labelClassName}>
        {t.temperature}
        <Input
          className={controlClassName || 'mt-1'}
          type="number"
          min={schema.temperature.min}
          max={schema.temperature.max}
          step={schema.temperature.step}
          value={String(value.temperature ?? schema.temperature.defaultValue)}
          onChange={(event) => onChange({ ...value, temperature: readNumberInput(event.target.value, schema.temperature.defaultValue) })}
        />
      </label>
      <label className={labelClassName}>
        {t.maxTokens}
        <Input
          className={controlClassName || 'mt-1'}
          type="number"
          min={schema.maxTokens.min}
          max={schema.maxTokens.max}
          step={schema.maxTokens.step}
          value={String(value.maxTokens ?? schema.maxTokens.defaultValue)}
          onChange={(event) => onChange({ ...value, maxTokens: readNumberInput(event.target.value, schema.maxTokens.defaultValue) })}
        />
      </label>
      <label className={cn(labelClassName, !containerClassName && 'sm:col-span-2')}>
        {t.responseFormat}
        <select
          className={selectClassName}
          value={value.responseFormat || schema.responseFormats[0] || 'text'}
          onChange={(event) => onChange({ ...value, responseFormat: event.target.value === 'json_object' ? 'json_object' : 'text' })}
        >
          {schema.responseFormats.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </select>
      </label>
      {schema.thinking ? (
        <label className={labelClassName}>
          {t.thinkingMode}
          <select
            className={selectClassName}
            value={value.thinkingMode || schema.thinking.defaultMode}
            onChange={(event) => onChange({ ...value, thinkingMode: event.target.value === 'auto' ? 'auto' : event.target.value === 'disabled' ? 'disabled' : 'enabled' })}
          >
            {schema.thinking.modes.map((mode) => (
              <option key={mode} value={mode}>
                {t.thinkingModes[mode]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {schema.thinking?.efforts?.length ? (
        <label className={labelClassName}>
          {t.reasoningEffort}
          <select
            className={selectClassName}
            value={value.reasoningEffort || schema.thinking.defaultEffort || schema.thinking.efforts[0]}
            onChange={(event) => {
              const effort = event.target.value
              onChange({
                ...value,
                reasoningEffort:
                  effort === 'none' || effort === 'low' || effort === 'medium' || effort === 'high' || effort === 'xhigh' || effort === 'max'
                    ? effort
                    : schema.thinking?.defaultEffort || 'medium',
              })
            }}
          >
            {schema.thinking.efforts.map((effort) => (
              <option key={effort} value={effort}>
                {t.reasoningEfforts[effort]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}

function PanelSection({
  title,
  open,
  children,
  className,
  bodyClassName,
  onToggle,
}: {
  title: string
  open: boolean
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  onToggle: () => void
}) {
  return (
    <section className={cn('border-b border-slate-200', className)}>
      <button className="flex h-8 shrink-0 w-full items-center gap-1.5 px-3 text-left text-[11px] font-black uppercase text-slate-600" onClick={onToggle}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>
      {open ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  )
}

function SourceControlPanel({
  t,
  project,
  status,
  loading,
  busyAction,
  onNotify,
  onOpenFile,
  onAction,
  onRefresh,
  onOpenDiff,
}: {
  t: WorkbenchCopy
  project: ProjectSummary | null
  status: SourceControlStatus | null
  loading: boolean
  busyAction: string
  onNotify: (description: string, title?: string) => void
  onOpenFile: (file: ProjectFileReference) => void
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean | void>
  onRefresh: () => Promise<void>
  onOpenDiff: (input: { path: string; staged: boolean }) => Promise<void>
}) {
  const [commitMessage, setCommitMessage] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [publishName, setPublishName] = useState('')
  const [privateRepository, setPrivateRepository] = useState(true)
  const [commitMenu, setCommitMenu] = useState<{ x: number; y: number } | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<GitChangeGroupId, boolean>>({
    staged: true,
    unstaged: true,
    untracked: true,
    conflicts: true,
  })
  const githubSession = readGithubSession()
  const groups = status?.groups || { staged: [], unstaged: [], untracked: [], conflicts: [] }
  const hasChanges = getSourceControlChangeCount(status) > 0
  const hasStagedChanges = groups.staged.length > 0
  const hasConflicts = groups.conflicts.length > 0
  const canUseRemote = Boolean(status?.hasRemote)
  const githubReady = hasGithubRepoScope(githubSession)
  const actionBusy = Boolean(busyAction)
  const commitBusy = ['commit', 'push', 'sync'].includes(busyAction)
  const commitDisabled = !commitMessage.trim() || !hasChanges || hasConflicts || Boolean(busyAction)
  const commitButtonLabel = hasStagedChanges ? t.scmCommit : t.scmCommitAll

  useEffect(() => {
    setPublishName(project?.fileName || '')
    setRemoteUrl(project?.repositoryUrl || status?.repositoryUrl || '')
  }, [project?.id, project?.fileName, project?.repositoryUrl, status?.repositoryUrl])

  async function runAction(action: string, payload?: Record<string, unknown>) {
    if (!project) return false
    if (['push', 'sync', 'publish'].includes(action) && !githubReady) {
      onNotify(githubSession ? t.githubScopeMissing : t.githubRequired)
      return false
    }
    try {
      const result = await onAction(action, payload)
      return result !== false
    } catch {
      return false
    }
  }

  function toggleCommitMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (commitDisabled) return
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 190
    const x = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)
    setCommitMenu((current) => (current ? null : { x, y: rect.bottom + 4 }))
  }

  async function commitWithFollowUp(followUp?: 'push' | 'sync') {
    const message = commitMessage.trim()
    if (!message) return
    setCommitMenu(null)
    const mode = hasStagedChanges ? 'staged' : 'all'
    const ok = await runAction('commit', { message, mode })
    if (!ok) return
    setCommitMessage('')
    if (followUp) await runAction(followUp)
  }

  function toggleGroup(group: GitChangeGroupId) {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200 px-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-800">{t.sourceControl}</p>
          <p className="truncate text-[10px] text-slate-500">{project?.name || t.project}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => void onRefresh()} disabled={!project || loading || actionBusy} title={t.scmRefresh}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void runAction('fetch')} disabled={!project || !canUseRemote || actionBusy} title={t.scmFetch}>
            {busyAction === 'fetch' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" title={githubSession ? t.githubConnected : t.githubConnect} onClick={() => connectGitHub()}>
            <Cloud className={cn('h-3.5 w-3.5', githubReady ? 'text-emerald-600' : 'text-slate-500')} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!project ? (
          <p className="p-2 text-xs text-slate-500">{t.noOpenFile}</p>
        ) : loading ? (
          <p className="p-2 text-xs text-slate-500">{t.loading}</p>
        ) : !status?.connected ? (
          <div className="rounded-md border border-[#ffd8c4] bg-[#fff7f2] p-2 text-[11px] text-slate-700">
            <div className="flex items-start gap-2">
              <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900">{t.scmInitTitle}</p>
                <p className="mt-1 leading-4 text-slate-600">{t.scmInitDesc}</p>
              </div>
            </div>
            <Button className="mt-2 w-full" size="sm" onClick={() => void runAction('initialize')} disabled={actionBusy}>
              {busyAction === 'initialize' ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
              {busyAction === 'initialize' ? t.loading : t.scmInitAction}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {!canUseRemote ? (
              <div className="rounded-md border border-[#ffd8c4] bg-[#fff7f2] p-2 text-[11px] text-slate-700">
                <p className="font-black text-slate-900">{t.scmRemoteTitle}</p>
                <p className="mt-1 leading-4 text-slate-600">{t.scmRemoteDesc}</p>
                <label className="mt-2 block font-semibold text-slate-600">
                  {t.scmRepositoryName}
                  <Input className="mt-1" value={publishName} onChange={(event) => setPublishName(event.target.value)} placeholder={project.fileName} />
                </label>
                <label className="mt-2 flex items-center gap-2 font-semibold text-slate-600">
                  <input className="h-3.5 w-3.5 accent-[#FB7E3D]" type="checkbox" checked={privateRepository} onChange={(event) => setPrivateRepository(event.target.checked)} />
                  {t.scmPrivateRepo}
                </label>
                <Button className="mt-2 w-full" size="sm" onClick={() => void runAction('publish', { repositoryName: publishName || project.fileName, privateRepository })} disabled={!githubReady || actionBusy}>
                  {busyAction === 'publish' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {busyAction === 'publish' ? t.loading : t.scmPublish}
                </Button>
                <label className="mt-3 block font-semibold text-slate-600">
                  {t.repositoryUrl}
                  <Input className="mt-1" value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://github.com/owner/repo.git" />
                </label>
                <Button className="mt-2 w-full" variant="outline" size="sm" onClick={() => void runAction('setRemote', { repositoryUrl: remoteUrl })} disabled={!remoteUrl.trim() || actionBusy}>
                  {busyAction === 'setRemote' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
                  {busyAction === 'setRemote' ? t.loading : t.scmSetRemote}
                </Button>
              </div>
            ) : null}

            <div className="rounded-md border border-slate-200 bg-white p-2">
              {hasConflicts ? <p className="mb-2 rounded bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700">{t.scmConflictHint}</p> : null}
              <Textarea
                className="min-h-16"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder={t.commitMessage}
              />
              <div className="mt-2">
                <div className="inline-flex max-w-full rounded-md shadow-sm">
                  <Button size="sm" className="rounded-r-none" onClick={() => void commitWithFollowUp()} disabled={commitDisabled}>
                    {commitBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {commitBusy ? t.loading : commitButtonLabel}
                  </Button>
                  <Button
                    size="sm"
                    className="w-7 rounded-l-none border-l border-white/30 px-0"
                    onClick={toggleCommitMenu}
                    disabled={commitDisabled}
                    aria-label={t.scmCommit}
                    aria-expanded={Boolean(commitMenu)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {commitMenu ? (
                  <WorkbenchContextMenu x={commitMenu.x} y={commitMenu.y} onClose={() => setCommitMenu(null)}>
                    <ContextMenuButton
                      icon={Save}
                      label={t.scmCommit}
                      disabled={commitDisabled}
                      onClick={() => {
                        void commitWithFollowUp()
                      }}
                    />
                    <ContextMenuButton
                      icon={Upload}
                      label={t.scmCommitAndPush}
                      disabled={commitDisabled}
                      onClick={() => {
                        void commitWithFollowUp('push')
                      }}
                    />
                    <ContextMenuButton
                      icon={RefreshCw}
                      label={t.scmCommitAndSync}
                      disabled={commitDisabled}
                      onClick={() => {
                        void commitWithFollowUp('sync')
                      }}
                    />
                  </WorkbenchContextMenu>
                ) : null}
              </div>
            </div>

            {(['conflicts', 'staged', 'unstaged', 'untracked'] as GitChangeGroupId[]).map((group) => (
              <SourceControlGroup
                key={group}
                projectId={project.id}
                group={group}
                title={t.scmGroups[group]}
                changes={groups[group]}
                open={openGroups[group]}
                busyAction={busyAction}
                onToggle={() => toggleGroup(group)}
                onOpenFile={onOpenFile}
                onAction={runAction}
                onOpenDiff={onOpenDiff}
                labels={{ stage: t.scmStage, unstage: t.scmUnstage, discard: t.scmDiscard, stageAll: t.scmStageAll, unstageAll: t.scmUnstageAll, openFile: t.openFile }}
                openDiffLabel={t.scmOpenDiff}
              />
            ))}
            {!hasChanges ? <p className="rounded-md border border-slate-200 bg-white px-2 py-3 text-[11px] text-slate-500">{t.scmNoChanges}</p> : null}
          </div>
        )}
      </div>
    </div>
  )
}

function SourceControlGroup({
  projectId,
  group,
  title,
  changes,
  open,
  busyAction,
  onToggle,
  onOpenFile,
  onAction,
  onOpenDiff,
  labels,
  openDiffLabel,
}: {
  projectId: string
  group: GitChangeGroupId
  title: string
  changes: GitChange[]
  open: boolean
  busyAction: string
  onToggle: () => void
  onOpenFile: (file: ProjectFileReference) => void
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean | void>
  onOpenDiff: (input: { path: string; staged: boolean }) => Promise<void>
  labels: { stage: string; unstage: string; discard: string; stageAll: string; unstageAll: string; openFile: string }
  openDiffLabel: string
}) {
  if (!changes.length) return null

  const groupAction = group === 'staged' ? 'unstageAll' : 'stageAll'
  const groupIcon = group === 'staged' ? Minus : Plus
  const GroupIcon = groupIcon
  const actionBusy = Boolean(busyAction)
  const groupActionBusy = busyAction === groupAction

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex h-8 items-center gap-1.5 border-b border-slate-100 px-2">
        <button className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100" onClick={onToggle}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase text-slate-600">{title}</span>
        <Badge variant="outline">{changes.length}</Badge>
        {group !== 'conflicts' ? (
          <Button variant="ghost" size="icon" onClick={() => void onAction(groupAction)} disabled={actionBusy} title={group === 'staged' ? labels.unstageAll : labels.stageAll}>
            {groupActionBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <GroupIcon className="h-3.5 w-3.5" />}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="divide-y divide-slate-100">
          {changes.map((change) => (
            <SourceControlChangeRow
              key={`${group}:${change.statusCode}:${change.path}:${change.originalPath || ''}`}
              projectId={projectId}
              group={group}
              change={change}
              busyAction={busyAction}
              onOpenFile={onOpenFile}
              onAction={onAction}
              onOpenDiff={onOpenDiff}
              labels={labels}
              openDiffLabel={openDiffLabel}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function SourceControlChangeRow({
  projectId,
  group,
  change,
  busyAction,
  onOpenFile,
  onAction,
  onOpenDiff,
  labels,
  openDiffLabel,
}: {
  projectId: string
  group: GitChangeGroupId
  change: GitChange
  busyAction: string
  onOpenFile: (file: ProjectFileReference) => void
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean | void>
  onOpenDiff: (input: { path: string; staged: boolean }) => Promise<void>
  labels: { stage: string; unstage: string; discard: string; openFile: string }
  openDiffLabel: string
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const fileName = change.path.split('/').pop() || change.path
  const parentPath = change.path.includes('/') ? change.path.split('/').slice(0, -1).join('/') : ''

  function openFile() {
    if (change.kind === 'deleted') return
    onOpenFile({ projectId, path: change.path, name: fileName })
  }

  function openDiff() {
    void onOpenDiff({ path: change.path, staged: group === 'staged' })
  }

  const stageAction = group === 'staged' ? 'unstage' : 'stage'
  const StageIcon = group === 'staged' ? Minus : Plus
  const actionBusy = Boolean(busyAction)
  const stageActionBusy = busyAction === stageAction
  const discardBusy = busyAction === 'discard'

  return (
    <div
      className="group relative flex min-h-8 items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-slate-50"
      onDoubleClick={openDiff}
      onContextMenu={(event) => {
        event.preventDefault()
        setContextMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      <span className={cn('w-5 shrink-0 text-center text-[10px] font-black', getGitDecorationTextClass(change.kind))}>{change.statusCode}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold', getGitDecorationTextClass(change.kind))} title={change.originalPath ? `${change.originalPath} -> ${change.path}` : change.path}>
          {fileName}
        </p>
        {parentPath ? <p className="truncate text-[10px] text-slate-400">{parentPath}</p> : null}
      </div>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        {group !== 'conflicts' ? (
          <Button variant="ghost" size="icon" onClick={() => void onAction(stageAction, { path: change.path })} disabled={actionBusy}>
            {stageActionBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <StageIcon className="h-3.5 w-3.5" />}
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" onClick={openDiff}>
          <FileText className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void onAction('discard', { path: change.path })} disabled={actionBusy}>
          {discardBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {contextMenu ? (
        <WorkbenchContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {group !== 'conflicts' ? (
            <ContextMenuButton
              icon={StageIcon}
              label={group === 'staged' ? labels.unstage : labels.stage}
              disabled={actionBusy}
              onClick={() => {
                setContextMenu(null)
                void onAction(stageAction, { path: change.path })
              }}
            />
          ) : null}
          <ContextMenuButton
            icon={FileText}
            label={openDiffLabel}
            onClick={() => {
              setContextMenu(null)
              openDiff()
            }}
          />
          {change.kind !== 'deleted' ? (
            <ContextMenuButton
              icon={FileText}
              label={labels.openFile}
              onClick={() => {
                setContextMenu(null)
                openFile()
              }}
            />
          ) : null}
          <ContextMenuButton
            icon={RotateCcw}
            label={labels.discard}
            danger
            disabled={actionBusy}
            onClick={() => {
              setContextMenu(null)
              void onAction('discard', { path: change.path })
            }}
          />
        </WorkbenchContextMenu>
      ) : null}
    </div>
  )
}

const EDITOR_MODES: EditorMode[] = ['preview', 'assist', 'source', 'normal']

function EditorModeSwitch({
  mode,
  t,
  onChange,
}: {
  mode: EditorMode
  t: WorkbenchCopy
  onChange: (mode: EditorMode) => void
}) {
  return (
    <ToggleGroup
      type="single"
      value={mode}
      className="h-7 overflow-hidden rounded-md border border-border bg-card"
      aria-label="editor mode"
      onValueChange={(value) => {
        if (value) onChange(value as EditorMode)
      }}
    >
      {EDITOR_MODES.map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          aria-label={t.editorModes[item]}
        >
          {t.editorModes[item]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function MarkdownPreviewPanel({
  markdown,
  title,
  t,
  locale,
  recipeVariableCategories,
  metadata,
  modelCapabilities = ALL_ZPMT_MODEL_CAPABILITIES,
}: {
  markdown: string
  title: string
  t: WorkbenchCopy
  locale: Locale
  recipeVariableCategories: RecipeVariableCategory[]
  metadata?: ZpmtRecipeVariableMetadata
  modelCapabilities?: ZpmtModelCapabilityGate
}) {
  const content = useMemo(
    () => decoratePromptTokensForMarkdown(stripPromptFrontmatter(markdown), t, locale, recipeVariableCategories, metadata, modelCapabilities),
    [locale, markdown, metadata, modelCapabilities, recipeVariableCategories, t],
  )
  const [tooltip, setTooltip] = useState<FloatingTooltipState>(null)

  function showTokenTooltip(target: HTMLElement, text: string) {
    setTooltip({ text, rect: target.getBoundingClientRect() })
  }

  return (
    <aside className="markdown-preview-panel">
      <div className="markdown-preview-panel__header">
        <FileText className="h-3.5 w-3.5 text-[#d95a1b]" />
        <span>{title}</span>
      </div>
      <div className="markdown-preview-panel__body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={(url) => url}
          components={{
            a: ({ href, children }) => {
              if (typeof href === 'string' && href.startsWith('ccks-token:')) {
                const token = decodeURIComponent(href.slice('ccks-token:'.length))
                const presentation = resolvePromptTokenPresentation(token, t, locale, recipeVariableCategories, metadata, modelCapabilities)
                return (
                  <span
                    className={cn(
                      'prompt-token-chip',
                      getPromptTokenStyleClass(presentation.styleKey),
                      presentation.unsupported && 'zpmt-token-chip--unsupported',
                    )}
                    onMouseEnter={(event) => showTokenTooltip(event.currentTarget, presentation.tooltip)}
                    onMouseMove={(event) => showTokenTooltip(event.currentTarget, presentation.tooltip)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {presentation.label || children}
                  </span>
                )
              }

              return <a href={href}>{children}</a>
            },
          }}
        >
          {content}
        </ReactMarkdown>
        <FloatingTooltip tooltip={tooltip} />
      </div>
    </aside>
  )
}

function AiAssistPanel({ t }: { t: WorkbenchCopy }) {
  return (
    <aside className="ai-assist-panel">
      <div className="ai-assist-panel__header">
        <Bot className="h-3.5 w-3.5 text-[#d95a1b]" />
        <span>{t.aiAssist.title}</span>
      </div>
      <div className="ai-assist-panel__body">
        <p>{t.aiAssist.status}</p>
        <div className="mt-3 space-y-2">
          {t.aiAssist.items.map((item) => (
            <div key={item} className="ai-assist-panel__item">
              <WandSparkles className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <Button className="mt-4" size="sm">
          <WandSparkles className="h-3 w-3" />
          {t.aiAssist.action}
        </Button>
      </div>
    </aside>
  )
}

function SourceCodePanel({
  source,
  language,
  title,
  monacoTheme,
}: {
  source: string
  language: string
  title: string
  monacoTheme: string
}) {
  return (
    <aside className="source-code-panel">
      <div className="source-code-panel__header">
        <Code2 className="h-3.5 w-3.5 text-[#d95a1b]" />
        <span>{title}</span>
      </div>
      <div className="source-code-panel__body">
        <MonacoEditor
          height="100%"
          theme={monacoTheme}
          beforeMount={defineTransparentMonacoTheme}
          language={language}
          value={source}
          options={{
            automaticLayout: true,
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineHeight: 19,
            wordWrap: 'on',
            padding: { top: 10, bottom: 10 },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none',
            scrollbar: {
              arrowSize: 0,
              horizontalScrollbarSize: 10,
              useShadows: false,
              verticalScrollbarSize: 10,
            },
          }}
        />
      </div>
    </aside>
  )
}

function buildEditorTabId(projectId: string, filePath: string) {
  return `${projectId}:${filePath}`
}

function getEditorLanguage(filePath: string) {
  const normalized = filePath.toLowerCase()
  if (normalized.endsWith('.json') || normalized.endsWith('.zpmt') || isProjectConfigFilePath(normalized)) return 'json'
  if (normalized.endsWith('.md') || normalized.endsWith('.markdown') || normalized.endsWith('.prompt')) return 'markdown'
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return 'typescript'
  if (normalized.endsWith('.js') || normalized.endsWith('.jsx')) return 'javascript'
  if (normalized.endsWith('.css')) return 'css'
  if (normalized.endsWith('.html')) return 'html'
  return 'plaintext'
}

function createEditorFileTab(file: ProjectFileReference, content: string): EditorFileTab {
  return {
    ...file,
    id: buildEditorTabId(file.projectId, file.path),
    content,
    savedContent: content,
    language: getEditorLanguage(file.path),
    dirty: false,
    saving: false,
    savedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  }
}

function createDefaultEditorTab() {
  return createEditorFileTab(
    {
      projectId: EXAMPLE_PROJECT_ID,
      path: 'pages/首页.prompt',
      name: '首页.prompt',
    },
    promptCode,
  )
}

function EditorPanel({
  t,
  locale,
  monacoTheme,
  aiProviders,
  recipeVariableCategories,
  tabs,
  activeTab,
  onActivateTab,
  onCloseTab,
  onChangeActiveContent,
  onSaveActive,
}: {
  t: WorkbenchCopy
  locale: Locale
  monacoTheme: string
  aiProviders: AiProviderSummary[]
  recipeVariableCategories: RecipeVariableCategory[]
  tabs: EditorFileTab[]
  activeTab: EditorFileTab | null
  onActivateTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onChangeActiveContent: (value: string) => void
  onSaveActive: () => void
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>('normal')
  const [zpmtPromptModes, setZpmtPromptModes] = useState<Record<string, PromptFileType>>({})
  const [zpmtCollapsedSections, setZpmtCollapsedSections] = useState<Record<string, ZpmtCollapsedSections>>({})
  const isSourceMode = editorMode === 'source'
  const hasSidePanel = editorMode === 'preview' || editorMode === 'assist'
  const editorValue = activeTab?.content || ''
  const activeZpmtDocument = activeTab && isZpmtFilePath(activeTab.path) ? parseZpmtContent(editorValue, aiProviders) : null
  const activeZpmtModelContext = activeZpmtDocument
    ? getSelectedAiModelContext(aiProviders, activeZpmtDocument.config.providerId, activeZpmtDocument.config.model, activeZpmtDocument.config.providerFile)
    : null
  const activeZpmtModelCapabilities = useMemo(() => getZpmtModelCapabilityGate(activeZpmtModelContext?.model), [activeZpmtModelContext?.model])
  const activeZlexResult = activeTab && isZlexFilePath(activeTab.path) ? parseZlexContent(editorValue) : null
  const activeZamfResult = activeTab && isZamfFilePath(activeTab.path) ? parseZamfContent(editorValue) : null
  const activeZpmtInitialMode = activeZpmtDocument ? getZpmtPromptMode(activeZpmtDocument) : 'simple'
  const activeZpmtPromptMode = activeTab && activeZpmtDocument ? zpmtPromptModes[activeTab.id] || activeZpmtInitialMode : 'simple'
  const activeZpmtTabId = activeTab && activeZpmtDocument ? activeTab.id : ''
  const activeZpmtCollapsedSections = activeZpmtTabId ? zpmtCollapsedSections[activeZpmtTabId] || {} : {}
  const previewMarkdown = activeZpmtDocument ? buildZpmtPreviewMarkdown(activeZpmtDocument, activeZpmtPromptMode) : editorValue
  const saveText = activeTab?.saving ? t.saving : t.save
  const savedText = activeTab?.dirty
    ? t.unsaved
    : activeTab?.error
      ? t.saveFailed
      : activeTab?.savedAt
        ? `✓ ${t.status.saved} ${activeTab.savedAt}`
        : t.saved

  useEffect(() => {
    if (!activeZpmtTabId) return
    setZpmtPromptModes((current) => (current[activeZpmtTabId] ? current : { ...current, [activeZpmtTabId]: activeZpmtInitialMode }))
  }, [activeZpmtInitialMode, activeZpmtTabId])

  function toggleActiveZpmtSection(section: ZpmtSectionKey) {
    if (!activeZpmtTabId) return
    setZpmtCollapsedSections((current) => {
      const currentSections = current[activeZpmtTabId] || {}
      return {
        ...current,
        [activeZpmtTabId]: {
          ...currentSections,
          [section]: !currentSections[section],
        },
      }
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200 bg-white">
        <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden">
          {tabs.map((tab) => {
            const fileIcon = getFileIconMeta(tab.path)
            const FileIcon = fileIcon.icon
            return (
              <div
                key={tab.id}
                title={tab.path}
                className={`group flex h-full w-40 shrink-0 items-center border-r border-slate-200 text-[11px] ${
                  activeTab?.id === tab.id ? 'border-b-2 border-b-[#FB7E3D] text-[#d95a1b]' : 'text-slate-600'
                }`}
              >
                <button
                  type="button"
                  className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left"
                  onClick={() => onActivateTab(tab.id)}
                >
                  <FileIcon className={cn('h-3.5 w-3.5 shrink-0', fileIcon.className)} />
                  <span className="truncate">{tab.name}</span>
                  {tab.dirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FB7E3D]" /> : null}
                </button>
                <button
                  type="button"
                  aria-label={`${t.closeTab}: ${tab.name}`}
                  title={`${t.closeTab}: ${tab.name}`}
                  className="mx-1 grid h-5 w-5 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 px-2 text-[11px] text-slate-500">
          <span className={`hidden xl:inline ${activeTab?.dirty || activeTab?.error ? 'text-[#d95a1b]' : 'text-emerald-600'}`}>
            {savedText}
          </span>
          <Button variant="outline" size="sm" disabled={!activeTab || activeTab.saving} onClick={onSaveActive}>
            <Save className="h-3 w-3" /> {saveText}
          </Button>
          <EditorModeSwitch mode={editorMode} t={t} onChange={setEditorMode} />
        </div>
      </div>

      <div className={hasSidePanel ? 'editor-workspace editor-workspace--split' : 'editor-workspace'}>
        <div className="editor-surface min-h-0">
          {activeTab ? (
            isSourceMode ? (
              <MonacoEditor
                key={`${activeTab.id}:source`}
                height="100%"
                theme={monacoTheme}
                beforeMount={defineTransparentMonacoTheme}
                language={activeTab.language}
                value={editorValue}
                onChange={(value) => onChangeActiveContent(value || '')}
                options={{
                  automaticLayout: true,
                  minimap: {
                    enabled: true,
                    renderCharacters: true,
                    scale: 1,
                    showSlider: 'always',
                    side: 'right',
                  },
                  fontSize: 13,
                  lineHeight: 20,
                  wordWrap: 'on',
                  padding: { top: 10 },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: 'none',
                  scrollbar: {
                    arrowSize: 0,
                    horizontalScrollbarSize: 10,
                    useShadows: false,
                    verticalScrollbarSize: 10,
                  },
                }}
              />
            ) : activeZpmtDocument ? (
              <ZpmtStructuredEditor
                key={activeTab.id}
                t={t}
                locale={locale}
                document={activeZpmtDocument}
                promptMode={activeZpmtPromptMode}
                collapsedSections={activeZpmtCollapsedSections}
                aiProviders={aiProviders}
                recipeVariableCategories={recipeVariableCategories}
                onToggleSection={toggleActiveZpmtSection}
                onChange={(nextDocument) => onChangeActiveContent(serializeZpmtDocument(nextDocument, aiProviders, recipeVariableCategories))}
              />
            ) : activeZlexResult ? (
              activeZlexResult.ok ? (
                <ZlexStructuredEditor
                  t={t}
                  document={activeZlexResult.document}
                  onChange={(nextDocument) => onChangeActiveContent(serializeZlexDocument(nextDocument))}
                />
              ) : (
                <ConfigParseErrorPanel t={t} filePath={activeTab.path} message={activeZlexResult.message} onOpenSource={() => setEditorMode('source')} />
              )
            ) : activeZamfResult ? (
              activeZamfResult.ok ? (
                <ZamfStructuredEditor
                  t={t}
                  document={activeZamfResult.document}
                  onChange={(nextDocument) => onChangeActiveContent(serializeZamfDocument(nextDocument))}
                />
              ) : (
                <ConfigParseErrorPanel t={t} filePath={activeTab.path} message={activeZamfResult.message} onOpenSource={() => setEditorMode('source')} />
              )
            ) : (
              <MonacoEditor
                key={activeTab.id}
                height="100%"
                theme={monacoTheme}
                beforeMount={defineTransparentMonacoTheme}
                language={activeTab.language}
                value={editorValue}
                onChange={(value) => onChangeActiveContent(value || '')}
                options={{
                  automaticLayout: true,
                  minimap: {
                    enabled: true,
                    renderCharacters: true,
                    scale: 1,
                    showSlider: 'always',
                    side: 'right',
                  },
                  fontSize: 13,
                  lineHeight: 20,
                  wordWrap: 'on',
                  padding: { top: 10 },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: 'none',
                  scrollbar: {
                    arrowSize: 0,
                    horizontalScrollbarSize: 10,
                    useShadows: false,
                    verticalScrollbarSize: 10,
                  },
                }}
              />
            )
          ) : (
            <div className="grid h-full place-items-center text-xs text-slate-500">{t.noOpenFile}</div>
          )}
        </div>
        {editorMode === 'preview' ? (
          <MarkdownPreviewPanel
            markdown={previewMarkdown}
            title={t.markdownPreview}
            t={t}
            locale={locale}
            recipeVariableCategories={recipeVariableCategories}
            metadata={activeZpmtDocument?.metadata}
            modelCapabilities={activeZpmtModelCapabilities}
          />
        ) : null}
        {editorMode === 'assist' ? <AiAssistPanel t={t} /> : null}
      </div>
    </div>
  )
}

function ConfigParseErrorPanel({
  t,
  filePath,
  message,
  onOpenSource,
}: {
  t: WorkbenchCopy
  filePath: string
  message: string
  onOpenSource: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-white p-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-amber-900">{t.parseFailed}</h2>
            <p className="mt-1 break-words text-xs font-semibold text-amber-800">{filePath}</p>
            <p className="mt-2 text-xs text-amber-700">{message}</p>
            <Button className="mt-3" size="sm" variant="outline" type="button" onClick={onOpenSource}>
              <Code2 className="h-3.5 w-3.5" />
              {t.sourceRepair}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZlexStructuredEditor({
  t,
  document,
  onChange,
}: {
  t: WorkbenchCopy
  document: ZlexDocument
  onChange: (document: ZlexDocument) => void
}) {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0)
  const [candidateDialog, setCandidateDialog] = useState<{ categoryIndex: number; variableIndex: number } | null>(null)
  const selectedCategoryIndex = document.categories[activeCategoryIndex] ? activeCategoryIndex : 0
  const selectedCategory = document.categories[selectedCategoryIndex] || null
  const variableCount = document.categories.reduce((total, category) => total + category.variables.length, 0)
  const candidateDialogVariable = candidateDialog
    ? document.categories[candidateDialog.categoryIndex]?.variables[candidateDialog.variableIndex] || null
    : null
  const candidateDialogTarget = typeof window === 'undefined' ? null : window.document.body

  useEffect(() => {
    if (activeCategoryIndex <= document.categories.length - 1) return
    setActiveCategoryIndex(Math.max(0, document.categories.length - 1))
  }, [activeCategoryIndex, document.categories.length])

  useEffect(() => {
    if (!candidateDialog) return
    if (document.categories[candidateDialog.categoryIndex]?.variables[candidateDialog.variableIndex]) return
    setCandidateDialog(null)
  }, [candidateDialog, document.categories])

  function updateDocument(next: Partial<ZlexDocument>) {
    onChange({ ...document, ...next })
  }

  function updateCategory(index: number, next: Partial<ZlexCategory>) {
    onChange({
      ...document,
      categories: document.categories.map((category, categoryIndex) => (categoryIndex === index ? { ...category, ...next } : category)),
    })
  }

  function updateVariable(categoryIndex: number, variableIndex: number, next: Partial<ZlexVariable>) {
    onChange({
      ...document,
      categories: document.categories.map((category, currentCategoryIndex) =>
        currentCategoryIndex === categoryIndex
          ? {
              ...category,
              variables: category.variables.map((variable, currentVariableIndex) =>
                currentVariableIndex === variableIndex ? { ...variable, ...next } : variable,
              ),
            }
          : category,
      ),
    })
  }

  function addCategory() {
    const index = document.categories.length + 1
    updateDocument({ categories: [...document.categories, createEmptyZlexCategory(`category-${index}`)] })
    setActiveCategoryIndex(index - 1)
  }

  function deleteCategory(index: number) {
    setActiveCategoryIndex((current) => {
      if (document.categories.length <= 1) return 0
      if (index < current) return current - 1
      if (index === current) return Math.min(current, document.categories.length - 2)
      return current
    })
    updateDocument({ categories: document.categories.filter((_, categoryIndex) => categoryIndex !== index) })
  }

  function addVariable(categoryIndex: number) {
    const category = document.categories[categoryIndex]
    if (!category) return
    const index = category.variables.length + 1
    updateCategory(categoryIndex, { variables: [createEmptyZlexVariable(`variable-${index}`), ...category.variables] })
  }

  function deleteVariable(categoryIndex: number, variableIndex: number) {
    const category = document.categories[categoryIndex]
    if (!category) return
    updateCategory(categoryIndex, { variables: category.variables.filter((_, index) => index !== variableIndex) })
  }

  function addCandidate(categoryIndex: number, variableIndex: number) {
    const variable = document.categories[categoryIndex]?.variables[variableIndex]
    if (!variable) return
    updateVariable(categoryIndex, variableIndex, { candidates: [...variable.candidates, ''] })
  }

  function updateCandidate(categoryIndex: number, variableIndex: number, candidateIndex: number, value: string) {
    const variable = document.categories[categoryIndex]?.variables[variableIndex]
    if (!variable) return
    updateVariable(categoryIndex, variableIndex, {
      candidates: variable.candidates.map((candidate, index) => (index === candidateIndex ? value : candidate)),
    })
  }

  function deleteCandidate(categoryIndex: number, variableIndex: number, candidateIndex: number) {
    const variable = document.categories[categoryIndex]?.variables[variableIndex]
    if (!variable) return
    updateVariable(categoryIndex, variableIndex, {
      candidates: variable.candidates.filter((_, index) => index !== candidateIndex),
    })
  }

  return (
    <div className="zpmt-editor zlex-editor">
      <aside className="zlex-sidebar">
        <div className="zlex-sidebar__header">
          <span>{t.categoryManagement}</span>
          <button type="button" title={t.addCategory} aria-label={t.addCategory} onClick={addCategory}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="zlex-category-nav">
          {document.categories.map((category, categoryIndex) => (
            <button
              key={`category-${categoryIndex}`}
              type="button"
              className={cn('zlex-category-nav__item', categoryIndex === selectedCategoryIndex && 'zlex-category-nav__item--active')}
              onClick={() => setActiveCategoryIndex(categoryIndex)}
            >
              <span className="truncate">{category.name || `${t.categoryName} ${categoryIndex + 1}`}</span>
              <Badge variant="outline" className="zlex-category-nav__count">{category.variables.length}</Badge>
            </button>
          ))}
          {document.categories.length ? null : (
            <button type="button" className="zlex-category-nav__empty" onClick={addCategory}>
              <Plus className="h-3.5 w-3.5" />
              {t.addCategory}
            </button>
          )}
        </div>
      </aside>

      <div className="zlex-workspace">
        <div className="zlex-editor__toolbar">
          <div className="flex min-w-0 items-center gap-2">
            <Boxes className="h-4 w-4 shrink-0 text-[#d95a1b]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">{t.zlexEditor}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                {document.categories.length} {t.categories} / {variableCount} {t.variables}
              </p>
            </div>
          </div>
          <Button className="zlex-header-action" size="sm" type="button" onClick={() => selectedCategory && addVariable(selectedCategoryIndex)} disabled={!selectedCategory}>
            <Plus className="h-3.5 w-3.5" />
            {t.addRecipeVariable}
          </Button>
        </div>

        {selectedCategory ? (
          <>
            <section className="zlex-panel">
              <div className="zlex-panel__header">
                <div className="min-w-0">
                  <p>{t.categoryInfo}</p>
                  <span>{selectedCategory.name || `${t.categoryName} ${selectedCategoryIndex + 1}`}</span>
                </div>
                <Badge variant="outline" className="zlex-panel__count">{selectedCategory.variables.length}</Badge>
                <button
                  type="button"
                  title={t.deleteCategory}
                  aria-label={t.deleteCategory}
                  onClick={() => deleteCategory(selectedCategoryIndex)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="zlex-category__fields">
                <label className="zpmt-config-field">
                  <span>{t.categoryName}</span>
                  <input value={selectedCategory.name} onChange={(event) => updateCategory(selectedCategoryIndex, { name: event.target.value })} />
                </label>
                <label className="zpmt-config-field">
                  <span>{t.categoryDescription}</span>
                  <input value={selectedCategory.description} onChange={(event) => updateCategory(selectedCategoryIndex, { description: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="zlex-panel zlex-variable-list">
              <div className="zlex-panel__header">
                <div className="min-w-0">
                  <p>{t.variableList}</p>
                  <span>{selectedCategory.variables.length} {t.variables}</span>
                </div>
              </div>
              {selectedCategory.variables.length ? (
                <div className="zlex-variable-table">
                  <div className="zlex-variable-table__head">
                    <span>{t.variableName}</span>
                    <span>{t.description}</span>
                    <span>{t.candidates}</span>
                    <span>{t.actions}</span>
                  </div>
                  {selectedCategory.variables.map((variable, variableIndex) => (
                    <div key={`variable-${variableIndex}`} className="zlex-variable-row">
                      <div className="zlex-variable-row__name">
                        <input value={variable.variableName} onChange={(event) => updateVariable(selectedCategoryIndex, variableIndex, { variableName: event.target.value.trim() })} />
                        <label className="zlex-inline-check">
                          <input type="checkbox" checked={variable.multiple} onChange={(event) => updateVariable(selectedCategoryIndex, variableIndex, { multiple: event.target.checked })} />
                          <span>{t.multiple}</span>
                        </label>
                      </div>
                      <textarea value={variable.description} onChange={(event) => updateVariable(selectedCategoryIndex, variableIndex, { description: event.target.value })} />
                      <div className="zlex-candidate-summary">
                        <span>{variable.candidates.length} {t.candidateCountSuffix}</span>
                        <button
                          type="button"
                          onClick={() => setCandidateDialog({ categoryIndex: selectedCategoryIndex, variableIndex })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t.editCandidates}
                        </button>
                      </div>
                      <div className="zlex-variable-row__actions">
                        <button
                          type="button"
                          title={t.deleteVariable}
                          aria-label={t.deleteVariable}
                          onClick={() => deleteVariable(selectedCategoryIndex, variableIndex)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="zlex-empty">
                  <Button size="sm" variant="outline" type="button" onClick={() => addVariable(selectedCategoryIndex)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t.addRecipeVariable}
                  </Button>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="zlex-empty zlex-empty--page">
            <Button size="sm" type="button" onClick={addCategory}>
              <Plus className="h-3.5 w-3.5" />
              {t.addCategory}
            </Button>
          </div>
        )}
      </div>
      {candidateDialog && candidateDialogVariable && candidateDialogTarget ? createPortal(
        <div className="zlex-candidate-dialog" onMouseDown={() => setCandidateDialog(null)}>
          <div className="zlex-candidate-dialog__panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="zlex-candidate-dialog__header">
              <div className="min-w-0">
                <p>{t.candidateEditor}</p>
                <span>{candidateDialogVariable.variableName || t.variableName}</span>
              </div>
              <button type="button" title={t.cancel} aria-label={t.cancel} onClick={() => setCandidateDialog(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="zlex-candidate-dialog__body">
              {candidateDialogVariable.candidates.length ? (
                candidateDialogVariable.candidates.map((candidate, candidateIndex) => (
                  <div key={candidateIndex} className="zlex-candidate-dialog__row">
                    <span>{candidateIndex + 1}</span>
                    <input
                      value={candidate}
                      placeholder={`${t.candidates} ${candidateIndex + 1}`}
                      onChange={(event) => updateCandidate(candidateDialog.categoryIndex, candidateDialog.variableIndex, candidateIndex, event.target.value)}
                    />
                    <button
                      type="button"
                      title={t.removeCandidate}
                      aria-label={t.removeCandidate}
                      onClick={() => deleteCandidate(candidateDialog.categoryIndex, candidateDialog.variableIndex, candidateIndex)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="zlex-candidate-dialog__empty">
                  {t.candidates}
                </div>
              )}
            </div>
            <div className="zlex-candidate-dialog__footer">
              <Button size="sm" variant="outline" type="button" onClick={() => addCandidate(candidateDialog.categoryIndex, candidateDialog.variableIndex)}>
                <Plus className="h-3.5 w-3.5" />
                {t.addCandidate}
              </Button>
              <Button size="sm" type="button" onClick={() => setCandidateDialog(null)}>
                {t.done}
              </Button>
            </div>
          </div>
        </div>,
        candidateDialogTarget,
      ) : null}
    </div>
  )
}

function ZamfStructuredEditor({
  t,
  document,
  onChange,
}: {
  t: WorkbenchCopy
  document: ZamfDocument
  onChange: (document: ZamfDocument) => void
}) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [pullingModels, setPullingModels] = useState(false)
  const [modelFetchError, setModelFetchError] = useState('')

  function updateDocument(next: Partial<ZamfDocument>) {
    onChange({ ...document, ...next })
  }

  function updateBaseUrl(baseUrl: string) {
    updateDocument({
      baseUrl,
      providerType: inferAiProviderTypeFromBaseUrl(baseUrl, 'custom'),
    })
  }

  async function pullModels() {
    if (!document.baseUrl || !document.apiKey) {
      setModelFetchError(t.modelFetchApiKeyRequired)
      return
    }

    setPullingModels(true)
    setModelFetchError('')
    const response = await fetchJson('/api/ai-providers/models', {
      method: 'POST',
      body: {
        baseUrl: document.baseUrl,
        apiKey: document.apiKey,
      },
    }).finally(() => setPullingModels(false))

    if (!response?.ok || !Array.isArray(response.models)) {
      setModelFetchError(response?.message || t.modelFetchFailed)
      return
    }

    updateDocument({
      providerType: inferAiProviderTypeFromBaseUrl(document.baseUrl, document.providerType || 'custom'),
      models: response.models.map((model: unknown, index: number) => normalizeZamfModelForEditor(model, index)),
    })
  }

  function applyModelPreset(index: number, presetKey: string) {
    const option = findAiModelPresetOption(presetKey)
    const currentModel = document.models[index]
    if (!option || !currentModel) return
    onChange({
      ...document,
      models: document.models.map((model, modelIndex) => (modelIndex === index ? applyAiModelPreset(model, option.model, createAiModelPresetRef(option)) : model)),
    })
  }

  return (
    <div className="zpmt-editor">
      <section className="zpmt-section">
        <div className="zpmt-section__header cursor-default hover:bg-transparent hover:text-slate-700">
          <Bot className="h-3.5 w-3.5 text-sky-500" />
          <span>{t.zamfEditor}</span>
          <Badge variant="outline" className="ml-auto">{document.models.length}</Badge>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          <label className="zpmt-config-field">
            <span>{t.providerName}</span>
            <input value={document.name} onChange={(event) => updateDocument({ name: event.target.value })} />
          </label>
          <label className="zpmt-config-field md:col-span-2">
            <span>{t.providerBaseUrl}</span>
            <input value={document.baseUrl} onChange={(event) => updateBaseUrl(event.target.value.trim())} />
          </label>
          <label className="zpmt-config-field md:col-span-3">
            <span>{t.providerApiKey}</span>
            <input type={showApiKey ? 'text' : 'password'} value={document.apiKey} onChange={(event) => updateDocument({ apiKey: event.target.value })} />
          </label>
          <div className="flex items-end">
            <Button size="sm" variant="outline" type="button" onClick={() => setShowApiKey((current) => !current)}>
              {showApiKey ? t.hideApiKey : t.showApiKey}
            </Button>
          </div>
        </div>
      </section>

      <section className="zpmt-section">
        <div className="zpmt-section__header cursor-default hover:bg-transparent hover:text-slate-700">
          <Code2 className="h-3.5 w-3.5 text-sky-500" />
          <span>{t.providerModels}</span>
          <Button
            className="ml-auto h-7"
            size="sm"
            variant="outline"
            type="button"
            onClick={() => void pullModels()}
            disabled={pullingModels}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', pullingModels && 'animate-spin')} />
            {pullingModels ? t.pullingModels : t.pullModels}
          </Button>
        </div>
        <div className="space-y-2 p-3">
          <p className="text-[11px] font-semibold text-slate-500">{t.providerModelsHint}</p>
          {modelFetchError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {modelFetchError}
            </div>
          ) : null}
          {document.models.length ? (
            document.models.map((model, index) => (
              <div key={`${model.id}-${index}`} className="rounded-md border border-slate-200 bg-white p-2">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{t.modelId}</div>
                    <div className="mt-1 truncate font-mono text-xs font-black text-slate-900">{model.id}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ZamfModelTags t={t} model={model} />
                    </div>
                  </div>
                  {!hasAiModelPreset(document.providerType, model.id) ? (
                    <label className="grid min-w-0 gap-1 text-[10px] font-black text-slate-500">
                      {t.modelPreset}
                      <select
                        className="h-8 w-full max-w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                        value={getAiModelPresetOptionKey(model.presetRef)}
                        onChange={(event) => applyModelPreset(index, event.target.value)}
                      >
                        <option value="">{t.modelPresetPlaceholder}</option>
                        {listAiModelPresetOptions(document.providerType).map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.providerName} / {option.model.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <Badge variant="outline">{t.modelPresetMatched}</Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
              {t.emptyModels}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ZamfModelTags({ t, model }: { t: WorkbenchCopy; model: ZamfModel }) {
  const thinking = aiModelSupportsThinking(model)

  return (
    <>
      {model.capabilities.map((capability) => (
        <Badge key={capability} variant="outline">
          {t.capabilities}:{t.outputTypes[capability]}
        </Badge>
      ))}
      <Badge variant={model.toolCalling === 'supported' ? 'default' : model.toolCalling === 'unsupported' ? 'danger' : 'outline'}>
        {t.toolCalling}:{t.toolCallingStatus[model.toolCalling]}
      </Badge>
      <Badge variant={thinking ? 'default' : 'outline'}>
        {t.thinkingSupport}:{thinking ? t.thinkingSupported : t.thinkingUnsupported}
      </Badge>
      <Badge variant={aiModelSupportsReferenceImage(model) ? 'default' : 'outline'}>
        {t.referenceImage}:{aiModelSupportsReferenceImage(model) ? t.thinkingSupported : t.thinkingUnsupported}
      </Badge>
      <Badge variant={aiModelSupportsReferenceFile(model) ? 'default' : 'outline'}>
        {t.referenceFile}:{aiModelSupportsReferenceFile(model) ? t.thinkingSupported : t.thinkingUnsupported}
      </Badge>
    </>
  )
}

function ZpmtStructuredEditor({
  t,
  locale,
  document,
  promptMode,
  collapsedSections,
  aiProviders,
  recipeVariableCategories,
  onToggleSection,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  document: ZpmtDocument
  promptMode: PromptFileType
  collapsedSections: ZpmtCollapsedSections
  aiProviders: AiProviderSummary[]
  recipeVariableCategories: RecipeVariableCategory[]
  onToggleSection: (section: ZpmtSectionKey) => void
  onChange: (document: ZpmtDocument) => void
}) {
  const showSystemPrompt = promptMode === 'agent'
  const selectedModelContext = getSelectedAiModelContext(aiProviders, document.config.providerId, document.config.model, document.config.providerFile)
  const responseSchema = resolveAiModelParameterSchema(
    document.config.outputType,
    selectedModelContext?.provider?.providerType,
    document.config.model,
    selectedModelContext?.model,
  )
  const compatibleModels = listCompatibleModelsForProvider(aiProviders, document.config.providerFile || document.config.providerId, document.config.outputType)
  const modelCapabilities = useMemo(() => getZpmtModelCapabilityGate(selectedModelContext?.model), [selectedModelContext?.model])
  const { supportsTools } = modelCapabilities

  function updateDocument(next: Partial<Omit<ZpmtDocument, 'config'>> & { config?: Partial<ZpmtDocument['config']> }) {
    onChange({
      ...document,
      ...next,
      config: next.config ? { ...document.config, ...next.config } : document.config,
    })
  }

  const [pendingTagDialog, setPendingTagDialog] = useState<PendingZpmtTagDialog | null>(null)
  const [pendingToolDialog, setPendingToolDialog] = useState<PendingZpmtToolDialog | null>(null)
  const existingTagNames = useMemo(() => extractZpmtTagNames(document.system, document.user), [document.system, document.user])

  function applyProviderFile(provider: AiProviderSummary) {
    const model = findCompatibleModelForProvider(provider, document.config.outputType)
    updateDocument({
      config: {
        providerFile: provider.filePath || '',
        providerId: provider.id,
        providerName: provider.name,
        model: model?.id || '',
        responseConfig: defaultResponseConfig(document.config.outputType, provider.providerType, model?.id, model),
      },
    })
  }

  function insertPromptToken(sectionKey: ZpmtPromptSectionKey, offset: number, token: string) {
    if (sectionKey === 'system') {
      updateDocument({ system: insertTextAtOffset(document.system, offset, token) })
      return
    }

    updateDocument({ user: insertTextAtOffset(document.user, offset, token) })
  }

  function replacePromptToken(sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) {
    const currentValue = sectionKey === 'system' ? document.system : document.user
    const nextValue = replaceTextRange(currentValue, start, end, token)
    if (sectionKey === 'system') {
      updateDocument({ system: nextValue })
      return
    }
    updateDocument({ user: nextValue })
  }

  function handleInstructionDrop(payload: InstructionDragPayload, sectionKey: ZpmtPromptSectionKey, offset: number) {
    if (!canUseInstructionPayload(payload, modelCapabilities)) return
    if (payload.kind === 'tool') {
      handleToolDrop(payload)
      return
    }

    setPendingTagDialog({ mode: 'insert', payload, sectionKey, offset })
  }

  function handleTokenEdit(sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) {
    const dialog = createPendingZpmtTagEdit(sectionKey, start, end, token, recipeVariableCategories, document.metadata)
    if (dialog) setPendingTagDialog(dialog)
  }

  function removeTool(tool: ZpmtToolInstruction) {
    updateDocument({
      tools: document.tools.filter((item) => !(item.categoryId === tool.categoryId && item.id === tool.id)),
    })
  }

  function handleToolDrop(payload: Extract<InstructionDragPayload, { kind: 'tool' }>) {
    if (!supportsTools) return
    setPendingToolDialog({ mode: 'add', payload })
  }

  function editTool(tool: ZpmtToolInstruction) {
    setPendingToolDialog({ mode: 'edit', tool })
  }

  function addToolFromPayload(payload: Extract<InstructionDragPayload, { kind: 'tool' }>, config?: AiToolConfig) {
    if (!supportsTools) return
    const tool = createZpmtToolInstruction(payload, config)
    const exists = document.tools.some((item) => item.categoryId === tool.categoryId && item.id === tool.id)
    if (exists) {
      updateDocument({
        tools: document.tools.map((item) => (item.categoryId === tool.categoryId && item.id === tool.id ? tool : item)),
      })
      return
    }
    updateDocument({ tools: [...document.tools, tool] })
  }

  function updateToolConfig(tool: ZpmtToolInstruction, config: AiToolConfig) {
    updateDocument({
      tools: document.tools.map((item) =>
        item.categoryId === tool.categoryId && item.id === tool.id
          ? { ...item, config: coerceAiToolConfig(item.id, config), schemaVersion: AI_TOOL_SCHEMA_VERSION }
          : item,
      ),
    })
  }

  const { setNodeRef: setEditorDropRef } = useDroppable({
    id: 'zpmt-editor-root',
    data: {
      kind: 'zpmt-root',
      onDropInstruction: (payload: InstructionDragPayload) => {
        if (payload.kind === 'tool' && canUseInstructionPayload(payload, modelCapabilities)) handleToolDrop(payload)
      },
    } satisfies ZpmtDroppableData,
  })
  const { setNodeRef: setConfigDropRef, isOver: providerFileOverConfig } = useDroppable({
    id: 'zpmt-config-provider-drop',
    data: {
      kind: 'zpmt-config',
      onDropInstruction: () => undefined,
      onDropProviderFile: (payload: ProviderFileDragPayload) => {
        applyProviderFile(payload.provider)
      },
    } satisfies ZpmtDroppableData,
  })

  return (
    <div
      ref={setEditorDropRef}
      className={cn('zpmt-editor', showSystemPrompt ? 'zpmt-editor--agent' : 'zpmt-editor--simple')}
    >
      <ZpmtSection
        title={t.fileConfig}
        sectionKey="config"
        icon={Settings}
        collapsed={Boolean(collapsedSections.config)}
        onToggle={onToggleSection}
      >
        <div
          ref={setConfigDropRef}
          className={cn('zpmt-section__body--config', providerFileOverConfig && 'zpmt-section__body--drop-target')}
        >
          <label className="zpmt-config-field">
            <span>{t.providerFile}</span>
            <input className="zpmt-config-control" value={document.config.providerFile || t.dropProviderFile} readOnly />
          </label>
          <label className="zpmt-config-field">
            <span>{t.outputType}</span>
            <select
              value={document.config.outputType}
              onChange={(event) => {
                const outputType = normalizeZpmtOutputType(event.target.value)
                const currentProvider = findAiProvider(aiProviders, document.config.providerFile || document.config.providerId)
                const currentModel = findCompatibleModelForProvider(currentProvider, outputType)
                const selection = currentProvider && currentModel
                  ? {
                      providerFile: currentProvider.filePath || '',
                      providerId: currentProvider.id,
                      providerName: currentProvider.name,
                      providerType: currentProvider.providerType,
                      model: currentModel.id,
                      modelEntry: currentModel,
                    }
                  : selectDefaultAiModel(aiProviders, outputType)
                updateDocument({
                  config: {
                    outputType,
                    providerFile: selection.providerFile,
                    providerId: selection.providerId,
                    providerName: selection.providerName,
                    model: selection.model,
                    responseConfig: defaultResponseConfig(outputType, selection.providerType, selection.model, selection.modelEntry),
                  },
                })
              }}
            >
              {ZPMT_OUTPUT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.outputTypes[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="zpmt-config-field">
            <span className="flex items-center gap-1.5">
              {t.aiModel}
              {selectedModelContext?.model ? <ToolCallingBadge t={t} model={selectedModelContext.model} /> : null}
            </span>
            <select
              value={document.config.model}
              onChange={(event) => {
                const provider = findAiProvider(aiProviders, document.config.providerFile || document.config.providerId) || null
                const model = compatibleModels.find((item) => item.id === event.target.value) || null
                updateDocument({
                  config: {
                    model: model?.id || event.target.value,
                    responseConfig: defaultResponseConfig(document.config.outputType, provider?.providerType, model?.id || event.target.value, model),
                  },
                })
              }}
            >
              {compatibleModels.length ? null : <option value="">{t.noModelForOutput}</option>}
              {document.config.model && !compatibleModels.some((model) => model.id === document.config.model) ? (
                <option value={document.config.model}>{document.config.model}</option>
              ) : null}
              {compatibleModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
          </label>
          <ResponseConfigFields
            t={t}
            schema={responseSchema}
            value={document.config.responseConfig}
            containerClassName="zpmt-config-response-fields"
            fieldClassName="zpmt-config-field"
            controlClassName="zpmt-config-control"
            onChange={(responseConfig) => updateDocument({ config: { responseConfig } })}
          />
        </div>
      </ZpmtSection>

      {showSystemPrompt ? (
        <ZpmtPromptSection
          t={t}
          locale={locale}
          recipeVariableCategories={recipeVariableCategories}
          metadata={document.metadata}
          sectionKey="system"
          title={t.systemPrompt}
          value={document.system}
          collapsed={Boolean(collapsedSections.system)}
          onToggle={onToggleSection}
          modelCapabilities={modelCapabilities}
          onInstructionDrop={handleInstructionDrop}
          onTokenEdit={handleTokenEdit}
          onChange={(value) => updateDocument({ system: value })}
        />
      ) : null}

      <ZpmtPromptSection
        t={t}
        locale={locale}
        recipeVariableCategories={recipeVariableCategories}
        metadata={document.metadata}
        sectionKey="user"
        title={t.userPrompt}
        value={document.user}
        collapsed={Boolean(collapsedSections.user)}
        onToggle={onToggleSection}
        modelCapabilities={modelCapabilities}
        onInstructionDrop={handleInstructionDrop}
        onTokenEdit={handleTokenEdit}
        onChange={(value) => updateDocument({ user: value })}
      />
      <ZpmtToolsDock t={t} locale={locale} tools={document.tools} supportsTools={supportsTools} onEdit={editTool} onRemove={removeTool} />
      {pendingTagDialog ? (
        <ZpmtTagInsertionDialog
          key={
            pendingTagDialog.mode === 'insert'
              ? `${pendingTagDialog.sectionKey}-${pendingTagDialog.offset}-${pendingTagDialog.payload.kind}`
              : `${pendingTagDialog.sectionKey}-${pendingTagDialog.start}-${pendingTagDialog.end}`
          }
          t={t}
          locale={locale}
          dialog={pendingTagDialog}
          existingNames={existingTagNames}
          onClose={() => setPendingTagDialog(null)}
          onInsert={(token) => {
            if (pendingTagDialog.mode === 'insert') {
              insertPromptToken(pendingTagDialog.sectionKey, pendingTagDialog.offset, token)
            } else {
              replacePromptToken(pendingTagDialog.sectionKey, pendingTagDialog.start, pendingTagDialog.end, token)
            }
            setPendingTagDialog(null)
          }}
        />
      ) : null}
      {pendingToolDialog ? (
        <ZpmtToolConfigDialog
          key={pendingToolDialog.mode === 'add' ? `add-${pendingToolDialog.payload.item.id}` : `edit-${pendingToolDialog.tool.id}`}
          t={t}
          locale={locale}
          dialog={pendingToolDialog}
          onClose={() => setPendingToolDialog(null)}
          onSubmit={(config) => {
            if (pendingToolDialog.mode === 'add') {
              addToolFromPayload(pendingToolDialog.payload, config)
            } else {
              updateToolConfig(pendingToolDialog.tool, config)
            }
            setPendingToolDialog(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ZpmtSection({
  title,
  sectionKey,
  icon: Icon,
  collapsed,
  children,
  onToggle,
}: {
  title: string
  sectionKey: ZpmtSectionKey
  icon: typeof Home
  collapsed: boolean
  children: React.ReactNode
  onToggle: (section: ZpmtSectionKey) => void
}) {
  return (
    <section className={cn('zpmt-section', collapsed && 'zpmt-section--collapsed')}>
      <button
        type="button"
        className="zpmt-section__header"
        aria-expanded={!collapsed}
        onClick={() => onToggle(sectionKey)}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
        <span className="truncate">{title}</span>
      </button>
      {collapsed ? null : <div className="zpmt-section__body">{children}</div>}
    </section>
  )
}

function ZpmtPromptSection({
  t,
  locale,
  recipeVariableCategories,
  metadata,
  sectionKey,
  title,
  value,
  collapsed,
  onToggle,
  modelCapabilities,
  onInstructionDrop,
  onTokenEdit,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  recipeVariableCategories: RecipeVariableCategory[]
  metadata: ZpmtRecipeVariableMetadata
  sectionKey: ZpmtSectionKey
  title: string
  value: string
  collapsed: boolean
  onToggle: (section: ZpmtSectionKey) => void
  modelCapabilities: ZpmtModelCapabilityGate
  onInstructionDrop: (payload: InstructionDragPayload, sectionKey: ZpmtPromptSectionKey, offset: number) => void
  onTokenEdit: (sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) => void
  onChange: (value: string) => void
}) {
  const editorRef = useRef<ZpmtPromptTokenEditorHandle | null>(null)
  const promptDropElementRef = useRef<HTMLDivElement | null>(null)
  const editorHeight = estimateZpmtPromptEditorHeight(value)

  const { setNodeRef: setPromptDropRef, isOver } = useDroppable({
    id: `zpmt-prompt:${sectionKey}`,
    data: {
      kind: 'zpmt-prompt',
      onDragInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => {
        if (!canUseInstructionPayload(payload, modelCapabilities)) return
        if (payload.kind === 'tool') return
        editorRef.current?.setCaretAtPoint(point, true)
      },
      onDropInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => {
        if (!canUseInstructionPayload(payload, modelCapabilities)) return
        if (sectionKey !== 'system' && sectionKey !== 'user') return
        const offset = payload.kind === 'tool' ? value.length : editorRef.current?.setCaretAtPoint(point, false) ?? value.length
        editorRef.current?.clearDropCursor()
        onInstructionDrop(payload, sectionKey, offset)
      },
    } satisfies ZpmtDroppableData,
  })

  useEffect(() => {
    function isPointInsidePrompt(point: ZpmtDropPoint) {
      const element = promptDropElementRef.current
      if (!element) return false
      const rect = element.getBoundingClientRect()
      return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    }

    function handleInstructionDrag(event: Event) {
      const detail = (event as CustomEvent<ZpmtInstructionPointEventDetail>).detail
      if (!detail || !canUseInstructionPayload(detail.payload, modelCapabilities) || detail.payload.kind === 'tool') return
      if (!isPointInsidePrompt(detail.point)) {
        editorRef.current?.clearDropCursor()
        return
      }
      editorRef.current?.setCaretAtPoint(detail.point, true)
      detail.handled = true
    }

    function handleInstructionDrop(event: Event) {
      const detail = (event as CustomEvent<ZpmtInstructionPointEventDetail>).detail
      if (!detail || !canUseInstructionPayload(detail.payload, modelCapabilities) || detail.payload.kind === 'tool') return
      if (!isPointInsidePrompt(detail.point)) return
      const offset = editorRef.current?.setCaretAtPoint(detail.point, false) ?? value.length
      editorRef.current?.clearDropCursor()
      if (sectionKey === 'system' || sectionKey === 'user') onInstructionDrop(detail.payload, sectionKey, offset)
      detail.handled = true
    }

    window.addEventListener(ZPMT_INSTRUCTION_DRAG_EVENT, handleInstructionDrag)
    window.addEventListener(ZPMT_INSTRUCTION_DROP_EVENT, handleInstructionDrop)
    return () => {
      window.removeEventListener(ZPMT_INSTRUCTION_DRAG_EVENT, handleInstructionDrag)
      window.removeEventListener(ZPMT_INSTRUCTION_DROP_EVENT, handleInstructionDrop)
    }
  }, [modelCapabilities, onInstructionDrop, sectionKey, value.length])

  return (
    <ZpmtSection
      title={title}
      sectionKey={sectionKey}
      icon={FileText}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div
        ref={(node) => {
          promptDropElementRef.current = node
          setPromptDropRef(node)
        }}
        className={cn('zpmt-section__body--prompt', isOver && 'zpmt-section__body--drop-target')}
        style={{ minHeight: editorHeight }}
      >
        <ZpmtPromptTokenEditor
          ref={editorRef}
          t={t}
          locale={locale}
          recipeVariableCategories={recipeVariableCategories}
          metadata={metadata}
          modelCapabilities={modelCapabilities}
          value={value}
          minHeight={editorHeight}
          onChange={onChange}
          onTokenEdit={(start, end, token) => {
            if (sectionKey === 'system' || sectionKey === 'user') onTokenEdit(sectionKey, start, end, token)
          }}
        />
      </div>
    </ZpmtSection>
  )
}

const ZpmtPromptTokenEditor = forwardRef<ZpmtPromptTokenEditorHandle, {
  t: WorkbenchCopy
  locale: Locale
  recipeVariableCategories: RecipeVariableCategory[]
  metadata: ZpmtRecipeVariableMetadata
  modelCapabilities: ZpmtModelCapabilityGate
  value: string
  minHeight: number
  onChange: (value: string) => void
  onTokenEdit: (start: number, end: number, token: string) => void
}>(function ZpmtPromptTokenEditor({ t, locale, recipeVariableCategories, metadata, modelCapabilities, value, minHeight, onChange, onTokenEdit }, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const latestValueRef = useRef(value)
  const renderKeyRef = useRef('')
  const lastCaretOffsetRef = useRef<number | null>(null)
  const [tooltip, setTooltip] = useState<FloatingTooltipState>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const renderKey = `${locale}:${metadata.recipeVariables.length}:${getZpmtCapabilityRenderKey(modelCapabilities)}:${value}`
    if (isPromptEditorFocused(root) && renderKeyRef.current === renderKey && latestValueRef.current === value) {
      return
    }
    const currentValue = serializePromptTokenEditorDom(root)
    if (renderKeyRef.current !== renderKey || currentValue !== value) {
      const caretOffset = isPromptEditorFocused(root) ? lastCaretOffsetRef.current ?? getPromptEditorCaretOffset(root) : null
      renderPromptTokenEditorDom(root, value, t, locale, recipeVariableCategories, metadata, modelCapabilities)
      if (caretOffset !== null) setPromptEditorCaretAtOffset(root, Math.min(caretOffset, value.length))
      renderKeyRef.current = renderKey
    }
    latestValueRef.current = value
  }, [locale, metadata, modelCapabilities, recipeVariableCategories, t, value])

  useEffect(() => {
    function clearCursor() {
      clearPromptEditorDropCursor(rootRef.current)
    }

    window.addEventListener(ZPMT_CLEAR_DRAG_CARET_EVENT, clearCursor)
    return () => window.removeEventListener(ZPMT_CLEAR_DRAG_CARET_EVENT, clearCursor)
  }, [])

  useImperativeHandle(ref, () => ({
    setCaretAtPoint(point, showDropCursor = false) {
      const root = rootRef.current
      if (!root) return latestValueRef.current.length
      clearPromptEditorDropCursor(root)
      const range = getPromptEditorRangeFromPoint(root, point) || createPromptEditorEndRange(root)
      setPromptEditorSelection(root, range)
      if (showDropCursor) showPromptEditorDropCursor(root, range)
      return getPromptEditorOffsetFromRange(root, range)
    },
    clearDropCursor() {
      clearPromptEditorDropCursor(rootRef.current)
    },
  }), [])

  function commitDomChange() {
    const root = rootRef.current
    if (!root) return
    clearPromptEditorDropCursor(root)
    const nextValue = serializePromptTokenEditorDom(root)
    latestValueRef.current = nextValue
    lastCaretOffsetRef.current = getPromptEditorCaretOffset(root)
    renderKeyRef.current = `${locale}:${metadata.recipeVariables.length}:${getZpmtCapabilityRenderKey(modelCapabilities)}:${nextValue}`
    onChange(nextValue)
  }

  function renderAndPlaceCaret(nextValue: string, offset: number) {
    const root = rootRef.current
    if (!root) return
    latestValueRef.current = nextValue
    renderPromptTokenEditorDom(root, nextValue, t, locale, recipeVariableCategories, metadata, modelCapabilities)
    renderKeyRef.current = `${locale}:${metadata.recipeVariables.length}:${getZpmtCapabilityRenderKey(modelCapabilities)}:${nextValue}`
    lastCaretOffsetRef.current = offset
    setPromptEditorCaretAtOffset(root, offset)
    onChange(nextValue)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const root = rootRef.current
    if (!root) return

    if (event.key === 'Enter') {
      event.preventDefault()
      insertPromptEditorTextAtSelection(root, '\n')
      commitDomChange()
      return
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      const deletion = getPromptTokenDeletion(latestValueRef.current, root, event.key === 'Delete')
      if (!deletion) return
      event.preventDefault()
      renderAndPlaceCaret(deletion.value, deletion.offset)
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    insertPromptEditorTextAtSelection(event.currentTarget, text)
    commitDomChange()
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const tokenElement = findPromptTokenElement(event.target)
    if (!tokenElement || !rootRef.current) return
    event.preventDefault()
    const token = tokenElement.dataset.zpmtToken || ''
    const start = getPromptEditorElementOffset(rootRef.current, tokenElement)
    onTokenEdit(start, start + token.length, token)
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const tokenElement = findPromptTokenElement(event.target)
    if (!tokenElement) {
      setTooltip(null)
      return
    }
    const tooltipText = tokenElement.dataset.zpmtTooltip || ''
    if (!tooltipText) return
    setTooltip({ text: tooltipText, rect: tokenElement.getBoundingClientRect() })
  }

  return (
    <>
      <div
        ref={rootRef}
        className="zpmt-token-editor"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        style={{ minHeight }}
        onInput={commitDomChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      <FloatingTooltip tooltip={tooltip} />
    </>
  )
})

function renderPromptTokenEditorDom(
  root: HTMLElement,
  value: string,
  t: WorkbenchCopy,
  locale: Locale,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
  metadata?: ZpmtRecipeVariableMetadata,
  modelCapabilities: ZpmtModelCapabilityGate = ALL_ZPMT_MODEL_CAPABILITIES,
) {
  clearPromptEditorDropCursor(root)
  const nodes: Node[] = []
  let cursor = 0

  for (const tokenRange of findPromptTokenRanges(value)) {
    if (tokenRange.start > cursor) nodes.push(...createPromptEditorTextNodes(root.ownerDocument, value.slice(cursor, tokenRange.start)))
    nodes.push(createPromptTokenEditorNode(root.ownerDocument, tokenRange.token, t, locale, categories, metadata, modelCapabilities))
    cursor = tokenRange.end
  }

  if (cursor < value.length) nodes.push(...createPromptEditorTextNodes(root.ownerDocument, value.slice(cursor)))
  root.replaceChildren(...nodes)
}

function createPromptEditorTextNodes(documentRef: Document, text: string) {
  const nodes: Node[] = []
  const lines = text.split('\n')

  lines.forEach((line, index) => {
    if (line) nodes.push(documentRef.createTextNode(line))
    if (index < lines.length - 1) nodes.push(documentRef.createElement('br'))
  })

  return nodes
}

function createPromptTokenEditorNode(
  documentRef: Document,
  token: string,
  t: WorkbenchCopy,
  locale: Locale,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
  metadata?: ZpmtRecipeVariableMetadata,
  modelCapabilities: ZpmtModelCapabilityGate = ALL_ZPMT_MODEL_CAPABILITIES,
) {
  const presentation = resolvePromptTokenPresentation(token, t, locale, categories, metadata, modelCapabilities)
  const tokenElement = documentRef.createElement('span')
  tokenElement.className = cn(
    'prompt-token-chip zpmt-token-editor__token',
    getPromptTokenStyleClass(presentation.styleKey),
    presentation.unsupported && 'zpmt-token-chip--unsupported',
  )
  tokenElement.contentEditable = 'false'
  tokenElement.dataset.zpmtToken = token
  tokenElement.dataset.zpmtTooltip = presentation.tooltip
  tokenElement.textContent = presentation.label
  return tokenElement
}

function serializePromptTokenEditorDom(root: HTMLElement | null) {
  if (!root) return ''
  return Array.from(root.childNodes).map(serializePromptTokenEditorNode).join('')
}

function serializePromptTokenEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').replace(/\u00a0/g, ' ')
  if (!(node instanceof HTMLElement)) return ''
  if (node.dataset.zpmtDropCursor === 'true') return ''
  if (node.dataset.zpmtToken) return node.dataset.zpmtToken
  if (node.tagName === 'BR') return '\n'
  return Array.from(node.childNodes).map(serializePromptTokenEditorNode).join('')
}

function findPromptTokenElement(target: EventTarget | null) {
  if (target instanceof HTMLElement) return target.closest<HTMLElement>('[data-zpmt-token]')
  if (target instanceof Node) return target.parentElement?.closest<HTMLElement>('[data-zpmt-token]') || null
  return null
}

function getPromptEditorRangeFromPoint(root: HTMLElement, point: ZpmtDropPoint) {
  const documentRef = root.ownerDocument as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  let range = documentRef.caretRangeFromPoint?.(point.x, point.y) || null

  if (!range && documentRef.caretPositionFromPoint) {
    const position = documentRef.caretPositionFromPoint(point.x, point.y)
    if (position) {
      range = documentRef.createRange()
      range.setStart(position.offsetNode, position.offset)
      range.collapse(true)
    }
  }

  if (!range || !root.contains(range.startContainer)) return findPromptEditorRangeByGeometry(root, point)
  return normalizePromptEditorRange(root, range, point)
}

function normalizePromptEditorRange(root: HTMLElement, range: Range, point?: ZpmtDropPoint) {
  const tokenElement = findPromptTokenElement(range.startContainer)
  if (!tokenElement || !root.contains(tokenElement)) return range

  const normalized = root.ownerDocument.createRange()
  if (point) {
    const rect = tokenElement.getBoundingClientRect()
    if (point.x > rect.left + rect.width / 2) normalized.setStartAfter(tokenElement)
    else normalized.setStartBefore(tokenElement)
  } else {
    normalized.setStartAfter(tokenElement)
  }
  normalized.collapse(true)
  return normalized
}

function findPromptEditorRangeByGeometry(root: HTMLElement, point: ZpmtDropPoint) {
  const candidates: Array<{ range: Range; distance: number }> = []
  const documentRef = root.ownerDocument

  function addCandidate(range: Range, rect: DOMRect | null) {
    if (!rect) return
    candidates.push({ range, distance: getPointRectDistance(point, rect) })
  }

  function addRangeForElement(element: HTMLElement) {
    if (element.dataset.zpmtDropCursor === 'true') return
    const rect = element.getBoundingClientRect()
    const before = documentRef.createRange()
    before.setStartBefore(element)
    before.collapse(true)
    const after = documentRef.createRange()
    after.setStartAfter(element)
    after.collapse(true)
    addCandidate(before, new DOMRect(rect.left, rect.top, 1, rect.height || 20))
    addCandidate(after, new DOMRect(rect.right, rect.top, 1, rect.height || 20))
  }

  function addRangesForTextNode(node: Text) {
    const text = node.nodeValue || ''
    if (!text.length) return
    for (let index = 0; index <= text.length; index += 1) {
      const range = documentRef.createRange()
      range.setStart(node, index)
      range.collapse(true)
      addCandidate(range, getTextCaretRect(node, index))
    }
  }

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      addRangesForTextNode(node as Text)
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.zpmtToken || node.dataset.zpmtDropCursor === 'true' || node.tagName === 'BR') {
      addRangeForElement(node)
      return
    }
    node.childNodes.forEach(walk)
  }

  root.childNodes.forEach(walk)

  if (!candidates.length) return createPromptEditorEndRange(root)
  candidates.sort((left, right) => left.distance - right.distance)
  return candidates[0].range
}

function getTextCaretRect(node: Text, offset: number) {
  const documentRef = node.ownerDocument
  const textLength = (node.nodeValue || '').length

  if (!textLength) return null

  if (offset < textLength) {
    const range = documentRef.createRange()
    range.setStart(node, offset)
    range.setEnd(node, offset + 1)
    const rect = range.getBoundingClientRect()
    if (rect.width || rect.height) return new DOMRect(rect.left, rect.top, 1, rect.height || 20)
  }

  const previousOffset = Math.max(0, offset - 1)
  const range = documentRef.createRange()
  range.setStart(node, previousOffset)
  range.setEnd(node, Math.min(textLength, previousOffset + 1))
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  return new DOMRect(offset >= textLength ? rect.right : rect.left, rect.top, 1, rect.height || 20)
}

function getPointRectDistance(point: ZpmtDropPoint, rect: DOMRect) {
  const dx = point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0
  const dy = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0
  return dx * dx + dy * dy
}

function createPromptEditorEndRange(root: HTMLElement) {
  const range = root.ownerDocument.createRange()
  range.setStart(root, root.childNodes.length)
  range.collapse(true)
  return range
}

function setPromptEditorSelection(root: HTMLElement, range: Range) {
  root.focus()
  const selection = root.ownerDocument.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

function isPromptEditorFocused(root: HTMLElement) {
  const activeElement = root.ownerDocument.activeElement
  return activeElement === root || Boolean(activeElement && root.contains(activeElement))
}

function getPromptEditorCaretOffset(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null
  return getPromptEditorOffsetFromDomPosition(root, range.startContainer, range.startOffset)
}

function showPromptEditorDropCursor(root: HTMLElement, range: Range) {
  clearPromptEditorDropCursor(root)
  const cursor = root.ownerDocument.createElement('span')
  cursor.className = 'zpmt-token-editor__drop-caret'
  cursor.contentEditable = 'false'
  cursor.dataset.zpmtDropCursor = 'true'
  const insertionRange = range.cloneRange()
  insertionRange.insertNode(cursor)
}

function clearPromptEditorDropCursor(root: HTMLElement | null) {
  root?.querySelectorAll('[data-zpmt-drop-cursor="true"]').forEach((node) => node.remove())
}

function getPromptEditorOffsetFromRange(root: HTMLElement, range: Range) {
  return getPromptEditorOffsetFromDomPosition(root, range.startContainer, range.startOffset)
}

function getPromptEditorElementOffset(root: HTMLElement, element: HTMLElement) {
  const parent = element.parentNode
  if (!parent) return 0
  return getPromptEditorOffsetFromDomPosition(root, parent, Array.from(parent.childNodes).indexOf(element))
}

function getPromptEditorOffsetFromDomPosition(root: HTMLElement, container: Node, domOffset: number) {
  let offset = 0
  let found = false

  function visit(node: Node) {
    if (found) return

    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += Math.min(domOffset, getPromptEditorNodeLength(node))
      } else {
        const children = Array.from(node.childNodes).slice(0, domOffset)
        offset += children.reduce((sum, child) => sum + getPromptEditorNodeLength(child), 0)
      }
      found = true
      return
    }

    if (node.nodeType === Node.TEXT_NODE || node instanceof HTMLElement && (node.dataset.zpmtToken || node.dataset.zpmtDropCursor === 'true' || node.tagName === 'BR')) {
      offset += getPromptEditorNodeLength(node)
      return
    }

    node.childNodes.forEach(visit)
  }

  visit(root)
  return offset
}

function getPromptEditorNodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').replace(/\u00a0/g, ' ').length
  if (!(node instanceof HTMLElement)) return 0
  if (node.dataset.zpmtDropCursor === 'true') return 0
  if (node.dataset.zpmtToken) return node.dataset.zpmtToken.length
  if (node.tagName === 'BR') return 1
  return Array.from(node.childNodes).reduce((sum, child) => sum + getPromptEditorNodeLength(child), 0)
}

function setPromptEditorCaretAtOffset(root: HTMLElement, targetOffset: number) {
  const range = root.ownerDocument.createRange()
  let offset = 0
  let placed = false

  function placeBefore(node: Node) {
    range.setStartBefore(node)
    range.collapse(true)
    placed = true
  }

  function placeAfter(node: Node) {
    range.setStartAfter(node)
    range.collapse(true)
    placed = true
  }

  function visit(node: Node) {
    if (placed) return
    if (node.nodeType === Node.TEXT_NODE) {
      const length = getPromptEditorNodeLength(node)
      if (targetOffset <= offset + length) {
        range.setStart(node, Math.max(0, Math.min(length, targetOffset - offset)))
        range.collapse(true)
        placed = true
        return
      }
      offset += length
      return
    }

    if (node instanceof HTMLElement && node.dataset.zpmtToken) {
      const length = node.dataset.zpmtToken.length
      if (targetOffset <= offset) placeBefore(node)
      else if (targetOffset <= offset + length) placeAfter(node)
      offset += length
      return
    }

    if (node instanceof HTMLElement && node.tagName === 'BR') {
      if (targetOffset <= offset) placeBefore(node)
      else if (targetOffset <= offset + 1) placeAfter(node)
      offset += 1
      return
    }

    node.childNodes.forEach(visit)
  }

  root.childNodes.forEach(visit)
  if (!placed) range.setStart(root, root.childNodes.length)
  range.collapse(true)
  setPromptEditorSelection(root, range)
}

function insertPromptEditorTextAtSelection(root: HTMLElement, text: string) {
  const selection = root.ownerDocument.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : createPromptEditorEndRange(root)
  const targetRange = root.contains(range.startContainer) ? normalizePromptEditorRange(root, range) : createPromptEditorEndRange(root)
  targetRange.deleteContents()
  const nodes = createPromptEditorTextNodes(root.ownerDocument, text)
  if (!nodes.length) return
  const fragment = root.ownerDocument.createDocumentFragment()
  nodes.forEach((node) => fragment.appendChild(node))
  targetRange.insertNode(fragment)
  const lastNode = nodes[nodes.length - 1]
  const nextRange = root.ownerDocument.createRange()
  if (lastNode.nodeType === Node.TEXT_NODE) {
    nextRange.setStart(lastNode, (lastNode.nodeValue || '').length)
  } else {
    nextRange.setStartAfter(lastNode)
  }
  nextRange.collapse(true)
  setPromptEditorSelection(root, nextRange)
}

function getPromptTokenDeletion(value: string, root: HTMLElement, forward: boolean) {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return null
  const range = normalizePromptEditorRange(root, selection.getRangeAt(0))
  const selectionStart = getPromptEditorOffsetFromDomPosition(root, range.startContainer, range.startOffset)
  const selectionEnd = getPromptEditorOffsetFromDomPosition(root, range.endContainer, range.endOffset)
  const tokenRanges = findPromptTokenRanges(value)
  if (!tokenRanges.length) return null
  let deleteStart = selectionStart
  let deleteEnd = selectionEnd

  if (selectionStart === selectionEnd) {
    const target = tokenRanges.find((tokenRange) =>
      forward
        ? tokenRange.start <= selectionStart && selectionStart < tokenRange.end
        : tokenRange.start < selectionStart && selectionStart <= tokenRange.end,
    )
    const boundaryTarget = target || tokenRanges.find((tokenRange) => forward ? tokenRange.start === selectionStart : tokenRange.end === selectionStart)
    if (!boundaryTarget) return null
    deleteStart = boundaryTarget.start
    deleteEnd = boundaryTarget.end
  } else {
    const touchedTokens = tokenRanges.filter((tokenRange) => selectionStart < tokenRange.end && selectionEnd > tokenRange.start)
    if (!touchedTokens.length) return null
    deleteStart = Math.min(selectionStart, ...touchedTokens.map((tokenRange) => tokenRange.start))
    deleteEnd = Math.max(selectionEnd, ...touchedTokens.map((tokenRange) => tokenRange.end))
  }

  return {
    value: replaceTextRange(value, deleteStart, deleteEnd, ''),
    offset: deleteStart,
  }
}

function ZpmtToolsDock({
  t,
  locale,
  tools,
  supportsTools,
  onEdit,
  onRemove,
}: {
  t: WorkbenchCopy
  locale: Locale
  tools: ZpmtToolInstruction[]
  supportsTools: boolean
  onEdit: (tool: ZpmtToolInstruction) => void
  onRemove: (tool: ZpmtToolInstruction) => void
}) {
  if (!tools.length) return null

  return (
    <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-10px_24px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-600">
        <Boxes className="h-3.5 w-3.5 text-[#d95a1b]" />
        <span>{t.fixedTools}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => {
          const toolName = tool.name[locale]
          const configSummary = summarizeAiToolConfig(tool.id, tool.config, locale)
          const candidateText = configSummary || tool.candidates[locale].join(' / ')
          const title = supportsTools ? candidateText : [t.unsupportedByModel, candidateText].filter(Boolean).join('\n')

          return (
            <span
              key={`${tool.categoryId}:${tool.id}`}
              title={title}
              className={cn(
                'inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-[#ffd8c4] bg-[#fff8f4] px-2 text-[11px] font-black text-[#b94712]',
                !supportsTools && 'zpmt-token-chip--unsupported',
              )}
            >
              <span className="truncate">{toolName}</span>
              <button
                type="button"
                className="grid h-4 w-4 shrink-0 place-items-center rounded text-inherit opacity-70 hover:bg-slate-200/70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35"
                title={t.editTool}
                disabled={!supportsTools}
                onClick={() => onEdit(tool)}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="grid h-4 w-4 shrink-0 place-items-center rounded text-inherit opacity-70 hover:bg-slate-200/70 hover:opacity-100"
                title={t.removeTool}
                onClick={() => onRemove(tool)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function ZpmtToolConfigDialog({
  t,
  locale,
  dialog,
  onClose,
  onSubmit,
}: {
  t: WorkbenchCopy
  locale: Locale
  dialog: PendingZpmtToolDialog
  onClose: () => void
  onSubmit: (config: AiToolConfig) => void
}) {
  const toolItem = dialog.mode === 'add' ? dialog.payload.item : dialog.tool
  const definition = getAiToolDefinition(toolItem.id)
  const [config, setConfig] = useState<AiToolConfig>(() =>
    coerceAiToolConfig(toolItem.id, dialog.mode === 'edit' ? dialog.tool.config : getAiToolFieldDefaults(toolItem.id)),
  )
  const [error, setError] = useState('')

  if (!definition) return null
  const toolDefinition = definition

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (toolDefinition.fields.some((field) => isAiToolRequiredMissing(field, config[field.name]))) {
      setError(t.toolConfigRequired)
      return
    }
    onSubmit(coerceAiToolConfig(toolDefinition.id, config))
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        className="w-[min(520px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-slate-900">
              {dialog.mode === 'edit' ? t.editTool : t.bindTool} · {definition.name[locale]}
            </h2>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{definition.description[locale]}</p>
          </div>
          <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-2 text-[11px] font-black uppercase text-slate-500">{t.toolBindingConfig}</div>
        {definition.fields.length ? (
          <AiToolConfigFields
            fields={definition.fields}
            config={config}
            locale={locale}
            onChange={(nextConfig) => {
              setConfig(nextConfig)
              setError('')
            }}
          />
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
            {t.toolBindingNoConfig}
          </div>
        )}
        {error ? <p className="mt-3 text-xs font-semibold text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" size="sm">
            {dialog.mode === 'edit' ? t.saveTool : t.addTool}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function AiToolConfigFields({
  fields,
  config,
  locale,
  disabled,
  onChange,
}: {
  fields: AiToolField[]
  config: AiToolConfig
  locale: Locale
  disabled?: boolean
  onChange: (config: AiToolConfig) => void
}) {
  function updateField(field: AiToolField, value: string | number | boolean) {
    onChange({ ...config, [field.name]: value })
  }

  return (
    <div className="grid gap-3">
      {fields.map((field) => {
        const value = config[field.name] ?? ''
        const label = `${field.label[locale]}${field.required ? ' *' : ''}`

        if (field.type === 'textarea') {
          return (
            <label key={field.name} className="block text-xs font-bold text-slate-600">
              {label}
              <Textarea
                className="mt-1 min-h-20"
                value={String(value)}
                disabled={disabled}
                placeholder={field.placeholder?.[locale]}
                onChange={(event) => updateField(field, event.target.value)}
              />
              {field.helper ? <span className="mt-1 block text-[11px] font-semibold text-slate-400">{field.helper[locale]}</span> : null}
            </label>
          )
        }

        if (field.type === 'select') {
          return (
            <label key={field.name} className="block text-xs font-bold text-slate-600">
              {label}
              <select
                className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={String(value)}
                disabled={disabled}
                onChange={(event) => updateField(field, event.target.value)}
              >
                {(field.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[locale]}
                  </option>
                ))}
              </select>
            </label>
          )
        }

        if (field.type === 'boolean') {
          return (
            <label key={field.name} className="flex min-h-8 items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#d95a1b] focus:ring-[#FB7E3D]/30"
                checked={Boolean(value)}
                disabled={disabled}
                onChange={(event) => updateField(field, event.target.checked)}
              />
              {label}
            </label>
          )
        }

        return (
          <label key={field.name} className="block text-xs font-bold text-slate-600">
            {label}
            <Input
              className="mt-1"
              type={field.type === 'number' ? 'number' : 'text'}
              value={String(value)}
              disabled={disabled}
              placeholder={field.placeholder?.[locale]}
              onChange={(event) => updateField(field, field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)}
            />
          </label>
        )
      })}
    </div>
  )
}

function isAiToolRequiredMissing(field: AiToolField, value: unknown) {
  return Boolean(field.required && field.type !== 'boolean' && !String(value ?? '').trim())
}

function ZpmtTagInsertionDialog({
  t,
  locale,
  dialog,
  existingNames,
  onClose,
  onInsert,
}: {
  t: WorkbenchCopy
  locale: Locale
  dialog: PendingZpmtTagDialog
  existingNames: Set<string>
  onClose: () => void
  onInsert: (token: string) => void
}) {
  const initialValues = useMemo(() => getZpmtTagDialogInitialValues(dialog), [dialog])
  const variableType = dialog.payload.kind === 'variable' ? dialog.payload.variableType : null
  const recipeItem = dialog.payload.kind === 'recipe' ? dialog.payload.item : null
  const detailConfig = variableType ? getVariableDetailConfig(variableType, t) : null
  const [name, setName] = useState(() => initialValues.name || createIdentifierSeed(recipeItem?.variableName || recipeItem?.id || variableType || ''))
  const [detailValue, setDetailValue] = useState(() => initialValues.detailValue || detailConfig?.defaultValue || '')
  const [defaultValue, setDefaultValue] = useState(() => initialValues.defaultValue)
  const [recipeDefaultValues, setRecipeDefaultValues] = useState<string[]>(() => initialValues.recipeDefaultValues)
  const [error, setError] = useState('')
  const title =
    dialog.payload.kind === 'variable'
      ? `${dialog.mode === 'edit' ? t.editTag : t.insertInstructionTag} · ${t.variableTypes[dialog.payload.variableType]}`
      : `${dialog.mode === 'edit' ? t.editTag : t.insertInstructionTag} · ${recipeItem?.name[locale] || ''}`
  const candidateText = recipeItem ? recipeItem.candidates[locale].join(' / ') : ''
  const candidateValues = recipeItem ? recipeItem.candidates[locale] : []

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    const normalizedDetail = detailValue.trim()

    if (!TAG_NAME_PATTERN.test(normalizedName)) {
      setError(t.tagNameInvalid)
      return
    }
    if (normalizedName !== initialValues.originalName && existingNames.has(normalizedName)) {
      setError(t.tagNameDuplicate)
      return
    }
    if (detailConfig && !normalizedDetail) {
      setError(t.tagInfoRequired)
      return
    }

    const token =
      dialog.payload.kind === 'variable'
        ? createVariableToken(dialog.payload.variableType, normalizedName, normalizedDetail, defaultValue)
        : createRecipeToken(dialog.payload.item, normalizedName, recipeDefaultValues)
    onInsert(token)
  }

  function toggleRecipeDefaultValue(candidate: string) {
    setRecipeDefaultValues((current) =>
      current.includes(candidate) ? current.filter((item) => item !== candidate) : [...current, candidate],
    )
    setError('')
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        className="w-[min(420px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate text-sm font-black text-slate-900">{title}</h2>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-600">
            {t.instructionName}
            <Input
              autoFocus
              className="mt-1"
              value={name}
              placeholder={t.instructionNamePlaceholder}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
            />
          </label>

          {detailConfig ? (
            <label className="block text-xs font-bold text-slate-600">
              {detailConfig.label}
              {variableType === 'boolean' ? (
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={detailValue}
                  onChange={(event) => {
                    setDetailValue(event.target.value)
                    setError('')
                  }}
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : (
                <Input
                  className="mt-1"
                  value={detailValue}
                  placeholder={detailConfig.placeholder}
                  onChange={(event) => {
                    setDetailValue(event.target.value)
                    setError('')
                  }}
                />
              )}
            </label>
          ) : null}

          {variableType && variableType !== 'color' && variableType !== 'boolean' ? (
            <label className="block text-xs font-bold text-slate-600">
              {t.defaultValue}
              <Input className="mt-1" value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} />
            </label>
          ) : null}

          {recipeItem ? (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-black text-slate-800">{t.recipeSource}: {recipeItem.name[locale]}</p>
                <p className="mt-1 break-words">{t.candidateValues}: {candidateText}</p>
              </div>
              <label className="block text-xs font-bold text-slate-600">
                {t.defaultValue}
                {recipeItem.multiple ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {candidateValues.map((candidate) => {
                      const selected = recipeDefaultValues.includes(candidate)

                      return (
                        <label
                          key={candidate}
                          className={cn(
                            'inline-flex min-h-7 cursor-pointer items-center rounded-md border px-2 text-[11px] font-black transition',
                            selected
                              ? 'border-[#FB7E3D] bg-[#fff2ea] text-[#b94712]'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-[#ffd8c4] hover:bg-[#fff8f4]',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            onChange={() => toggleRecipeDefaultValue(candidate)}
                          />
                          {candidate}
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <select
                    className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    value={recipeDefaultValues[0] || ''}
                    onChange={(event) => {
                      setRecipeDefaultValues(event.target.value ? [event.target.value] : [])
                      setError('')
                    }}
                  >
                    <option value="">{t.noDefaultValue}</option>
                    {candidateValues.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </>
          ) : null}

          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" size="sm">
            {dialog.mode === 'edit' ? t.saveTag : t.insertTag}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function estimateZpmtPromptEditorHeight(value: string) {
  const lineCount = Math.max(1, value.split(/\r\n|\r|\n/).length)
  return Math.max(ZPMT_PROMPT_EDITOR_MIN_HEIGHT, lineCount * 20 + 34)
}

function TestPanel({
  t,
  locale,
  document,
  activeFile,
  supportsTools,
}: {
  t: WorkbenchCopy
  locale: Locale
  document: ZpmtDocument | null
  activeFile: ProjectFileReference | null
  supportsTools: boolean
}) {
  const variables = useMemo(() => (document ? collectZpmtTestVariables(document, t, locale) : []), [document, locale, t])
  const variablesKey = variables.map((variable) => `${variable.key}:${variable.defaultValue}`).join('|')
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [maxToolRounds, setMaxToolRounds] = useState(5)
  const [runLoading, setRunLoading] = useState(false)
  const [runResponse, setRunResponse] = useState<Record<string, unknown> | null>(null)
  const canRun = Boolean(document && activeFile?.projectId && document.config.providerId && document.config.model)
  const renderedSystem = document ? renderZpmtPromptForTest(document.system, variableValues) : ''
  const renderedUser = document ? renderZpmtPromptForTest(document.user, variableValues) : ''

  useEffect(() => {
    setVariableValues((current) => {
      const next: Record<string, string> = {}
      for (const variable of variables) {
        next[variable.key] = current[variable.key] ?? variable.defaultValue
      }
      return next
    })
  }, [variablesKey, variables])

  async function runAgentTest() {
    if (!document || !activeFile?.projectId || runLoading) return
    setRunLoading(true)
    setRunResponse(null)
    const response = await fetchJson('/api/agents/test', {
      method: 'POST',
      body: {
        document,
        variables: variableValues,
        maxToolRounds,
        context: {
          projectId: activeFile?.projectId || '',
          path: activeFile?.path || '',
        },
      },
    }).finally(() => setRunLoading(false))
    setRunResponse((response && typeof response === 'object' ? response : { ok: false, message: t.agentRunFailed }) as Record<string, unknown>)
  }

  function updateVariableValue(variable: ZpmtTestVariable, value: string) {
    setVariableValues((current) => ({ ...current, [variable.key]: value }))
  }

  function updateMaxToolRounds(value: string) {
    const parsed = Math.round(Number(value))
    if (!Number.isFinite(parsed)) {
      setMaxToolRounds(0)
      return
    }
    setMaxToolRounds(Math.min(20, Math.max(0, parsed)))
  }

  return (
    <Tabs defaultValue="test" className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200">
        <TabsList className="min-w-0 overflow-x-auto px-1">
          <TabsTrigger value="test">{t.bottomTabs[0]}</TabsTrigger>
          <TabsTrigger value="result">{t.bottomTabs[1]}</TabsTrigger>
          <TabsTrigger value="cases">{t.bottomTabs[2]}</TabsTrigger>
          <TabsTrigger value="perf">{t.bottomTabs[3]}</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" className="mr-1 shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
      <TabsContent value="test" className="min-h-0 flex-1 overflow-auto p-3">
        {!document ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
            {t.agentRunNoFile}
          </div>
        ) : (
          <section className="rounded-md border border-slate-200 bg-white">
            <div className="flex h-9 items-center justify-between border-b border-slate-200 px-3">
              <h3 className="text-xs font-black">{t.testVariables}</h3>
              <Button variant="outline" size="sm" onClick={() => void runAgentTest()} disabled={!canRun || runLoading}>
                <Play className="h-3 w-3" /> {runLoading ? t.runningAgent : t.runAgent}
              </Button>
            </div>
            <div className="space-y-3 p-3">
              {!canRun ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{t.agentRunNoProvider}</div> : null}
              {variables.length ? (
                <div className="space-y-2">
                  {variables.map((variable) => (
                    <label key={variable.key} className="block rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-600">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{variable.label}</span>
                        <Badge variant="outline" className="shrink-0">{variable.typeLabel}</Badge>
                      </span>
                      {variable.source ? <span className="mt-1 block truncate text-[11px] font-semibold text-slate-400">{variable.source}</span> : null}
                      <Input
                        className="mt-2 bg-white"
                        value={variableValues[variable.key] ?? variable.defaultValue}
                        placeholder={t.testValue}
                        onChange={(event) => updateVariableValue(variable, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
                  {t.testVariableEmpty}
                </div>
              )}
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-black uppercase text-slate-500">{t.runSettings}</div>
                <label className="block text-xs font-bold text-slate-600">
                  {t.maxToolRounds}
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={20}
                    value={String(maxToolRounds)}
                    onChange={(event) => updateMaxToolRounds(event.target.value)}
                  />
                  <span className="mt-1 block text-[11px] font-semibold text-slate-400">{t.maxToolRoundsHint}</span>
                </label>
              </div>
            </div>
          </section>
        )}
        {runResponse ? <AgentTestResultCard t={t} response={runResponse} /> : null}
      </TabsContent>
      <TabsContent value="result" className="min-h-0 flex-1 overflow-auto p-3">
        {runResponse ? (
          <AgentTestResultCard t={t} response={runResponse} />
        ) : (
          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">{t.noAgentOutput}</div>
        )}
      </TabsContent>
      <TabsContent value="cases" className="min-h-0 flex-1 overflow-auto p-3">
        <div className="space-y-3">
          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <p className="mb-2 font-black text-slate-900">{t.renderedPrompt}</p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] leading-5">{[renderedSystem, renderedUser].filter(Boolean).join('\n\n')}</pre>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="perf" className="min-h-0 flex-1 overflow-auto p-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
          {runResponse?.durationMs ? `${t.duration}: ${runResponse.durationMs}ms` : t.noAgentOutput}
        </div>
      </TabsContent>
    </Tabs>
  )
}

function AgentTestResultCard({ t, response }: { t: WorkbenchCopy; response: Record<string, unknown> }) {
  const ok = response.ok === true
  const output = typeof response.output === 'string' ? response.output : ''
  const message = typeof response.message === 'string' ? response.message : ''

  return (
    <div className={cn('mt-3 rounded-md border bg-white p-3 text-xs', ok ? 'border-emerald-200' : 'border-red-200')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn('font-black', ok ? 'text-emerald-700' : 'text-red-700')}>
          {ok ? t.agentRunSuccess : t.agentRunFailed}
        </span>
        {response.durationMs ? <span className="text-slate-400">{t.duration}: {String(response.durationMs)}ms</span> : null}
      </div>
      <div className="text-[11px] font-black uppercase text-slate-500">{t.assistantOutput}</div>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] leading-5 text-slate-700">
        {output || message || JSON.stringify(response, null, 2)}
      </pre>
    </div>
  )
}

function collectZpmtTestVariables(document: ZpmtDocument, t: WorkbenchCopy, locale: Locale): ZpmtTestVariable[] {
  const variables = new Map<string, ZpmtTestVariable>()
  for (const tokenRange of [...findPromptTokenRanges(document.system), ...findPromptTokenRanges(document.user)]) {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed) continue
    const params = getPromptTokenParamMap(parsed.params)
    const key = getZpmtTestVariableKey(tokenRange.token)
    if (!key || variables.has(key)) continue
    const isRecipe = parsed.tokenType === 'recipe'
    const typeLabel = parsed.variableType
      ? t.variableTypes[parsed.variableType]
      : isRecipe
        ? t.recipeVariableLabel
        : parsed.tokenType
    const source = isRecipe ? resolveRecipeVariableSourceLabel(params.source || '', DEFAULT_RECIPE_VARIABLE_CATEGORIES, document.metadata, locale) || params.source : ''
    variables.set(key, {
      key,
      token: tokenRange.token,
      name: parsed.name,
      label: `${typeLabel}:${parsed.name}`,
      typeLabel,
      defaultValue: params.default || '',
      source,
    })
  }
  return [...variables.values()]
}

function renderZpmtPromptForTest(text: string, values: Record<string, string>) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const key = getZpmtTestVariableKey(token)
    if (!key) return token
    const parsed = parsePromptToken(token)
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    return values[key] ?? params.default ?? ''
  })
}

function getZpmtTestVariableKey(token: string) {
  const parsed = parsePromptToken(token)
  if (!parsed) return ''
  const params = getPromptTokenParamMap(parsed.params)
  return `${parsed.tokenType}:${parsed.name}:${params.source || ''}`
}

function ToolRunResultCard({ t, response }: { t: WorkbenchCopy; response: Record<string, unknown> }) {
  const ok = response.ok === true
  const artifact = getToolDownloadArtifact(response)
  return (
    <section className="mt-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
        <span className={cn('rounded-full px-2 py-1 font-semibold', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
          {ok ? t.toolRunSuccess : t.toolRunFailed}
        </span>
        {response.durationMs ? <span>{t.duration}: {String(response.durationMs)}ms</span> : null}
      </div>
      {artifact ? <ToolDownloadArtifactCard t={t} artifact={artifact} /> : null}
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
        {formatToolRunResponse(response)}
      </pre>
    </section>
  )
}

type ToolDownloadArtifact = {
  kind: 'download'
  filename: string
  mimeType: string
  encoding: 'base64'
  contentBase64: string
  size: number
}

function ToolDownloadArtifactCard({ t, artifact }: { t: WorkbenchCopy; artifact: ToolDownloadArtifact }) {
  const [downloadUrl, setDownloadUrl] = useState('')

  useEffect(() => {
    const blob = base64ToBlob(artifact.contentBase64, artifact.mimeType)
    const nextUrl = URL.createObjectURL(blob)
    setDownloadUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [artifact.contentBase64, artifact.mimeType])

  return (
    <div className="mb-3 rounded-md border border-[#ffd8c4] bg-[#fff8f4] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-900">{t.generatedFile}: {artifact.filename}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">{artifact.mimeType} · {formatBytes(artifact.size)}</p>
        </div>
        <Button asChild size="sm" disabled={!downloadUrl}>
          <a href={downloadUrl || undefined} download={artifact.filename}>
            <Download className="h-3 w-3" /> {t.downloadFile}
          </a>
        </Button>
      </div>
    </div>
  )
}

function getToolDownloadArtifact(response: Record<string, unknown>): ToolDownloadArtifact | null {
  const result = isRecord(response.result) ? response.result : null
  const artifact = result && isRecord(result.artifact) ? result.artifact : null
  if (!artifact) return null
  if (artifact.kind !== 'download' || artifact.encoding !== 'base64') return null
  const filename = typeof artifact.filename === 'string' ? artifact.filename : ''
  const mimeType = typeof artifact.mimeType === 'string' ? artifact.mimeType : ''
  const contentBase64 = typeof artifact.contentBase64 === 'string' ? artifact.contentBase64 : ''
  const size = typeof artifact.size === 'number' && Number.isFinite(artifact.size) ? artifact.size : 0
  if (!filename || !mimeType) return null
  return { kind: 'download', filename, mimeType, encoding: 'base64', contentBase64, size }
}

function formatToolRunResponse(response: Record<string, unknown>) {
  const artifact = getToolDownloadArtifact(response)
  if (!artifact || !isRecord(response.result)) return JSON.stringify(response.result ?? response, null, 2)

  return JSON.stringify(
    {
      ...response,
      result: {
        ...response.result,
        artifact: {
          ...artifact,
          contentBase64: `[base64 omitted, ${formatBytes(artifact.size)}]`,
        },
      },
    },
    null,
    2,
  )
}

function base64ToBlob(contentBase64: string, mimeType: string) {
  const binary = window.atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function InspectorToolsPanel({
  t,
  locale,
  disabled,
}: {
  t: WorkbenchCopy
  locale: Locale
  disabled?: boolean
}) {
  return (
    <InstructionTagCategoriesPanel
      categories={toolInstructionCategories}
      dragKind="tool"
      disabled={disabled}
      emptyText={t.toolInstructionEmpty}
      locale={locale}
      searchPlaceholder={t.toolInstructionSearch}
      t={t}
    />
  )
}

function InstructionTagCategoriesPanel({
  categories,
  dragKind,
  disabled = false,
  emptyText,
  locale,
  searchPlaceholder,
  t,
}: {
  categories: InstructionCatalogCategory[]
  dragKind: InstructionCategoryKind
  disabled?: boolean
  emptyText: string
  locale: Locale
  searchPlaceholder: string
  t: WorkbenchCopy
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((category) => [category.id, true])),
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const searchActive = normalizedSearch.length > 0
  const filteredCategories = useMemo<InstructionCatalogCategory[]>(() => {
    if (!searchActive) return categories

    return categories
      .map((category) => {
        const categoryMatches = Object.values(category.name).some((value) =>
          value.toLocaleLowerCase().includes(normalizedSearch),
        )
        const matchingVariables = category.variables.filter((variable) => {
          const nameMatches = Object.values(variable.name).some((value) =>
            value.toLocaleLowerCase().includes(normalizedSearch),
          )
          const candidateMatches = Object.values(variable.candidates)
            .flat()
            .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))

          return categoryMatches || nameMatches || candidateMatches
        })

        return matchingVariables.length ? { ...category, variables: matchingVariables } : null
      })
      .filter((category): category is InstructionCatalogCategory => category !== null)
  }, [categories, normalizedSearch, searchActive])

  return (
    <section className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-7"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="space-y-2.5">
        {filteredCategories.length ? (
          filteredCategories.map((category) => {
            const open = searchActive || expanded[category.id] !== false
            const categoryName = category.name[locale]
            const categoryDescription = category.description[locale]

            return (
              <section key={category.id} className="rounded-md border border-slate-200 bg-white">
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                  aria-expanded={open}
                  onClick={() => setExpanded((current) => ({ ...current, [category.id]: !open }))}
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-slate-900">{categoryName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{categoryDescription}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {category.variables.length}
                  </Badge>
                </button>

                {open ? (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
                    {category.variables.map((variable) => {
                      const variableName = variable.name[locale]
                      const candidateText = variable.candidates[locale].join(' / ')
                      const modeText = variable.multiple ? t.recipeVariableModes.multi : t.recipeVariableModes.single
                      const tooltipText = [disabled ? t.unsupportedByModel : '', candidateText, modeText].filter(Boolean).join('\n')

                      return (
                        <TooltipAnchor key={variable.id} tooltip={tooltipText || variableName} className="inline-flex">
                          <DraggableInstructionTag
                            id={`${dragKind}:${category.id}:${variable.id}`}
                            payload={{
                              kind: dragKind,
                              categoryId: category.id,
                              item: variable as RecipeVariableItem & InstructionCatalogItem,
                            } as InstructionDragPayload}
                            title={variableName}
                            disabled={disabled}
                            className={cn(
                              'prompt-token-chip h-7 max-w-full cursor-grab outline-none transition active:cursor-grabbing focus:ring-2 focus:ring-[#FB7E3D]/20',
                              dragKind === 'recipe'
                                ? getPromptTokenStyleClass('recipe')
                                : getPromptTokenStyleClass('unknown'),
                            )}
                          >
                            <span className="truncate">{variableName}</span>
                          </DraggableInstructionTag>
                        </TooltipAnchor>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  )
}

function RecipeVariablesPanel({ t, locale, categories }: { t: WorkbenchCopy; locale: Locale; categories: RecipeVariableCategory[] }) {
  return (
    <InstructionTagCategoriesPanel
      categories={categories}
      dragKind="recipe"
      emptyText={t.recipeVariableEmpty}
      locale={locale}
      searchPlaceholder={t.recipeVariableSearch}
      t={t}
    />
  )
}

function InspectorPanel({
  t,
  locale,
  recipeVariableCategories,
  modelCapabilities,
}: {
  t: WorkbenchCopy
  locale: Locale
  recipeVariableCategories: RecipeVariableCategory[]
  modelCapabilities: ZpmtModelCapabilityGate
}) {
  const { supportsTools } = modelCapabilities

  return (
    <Tabs defaultValue="variables" className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200">
        <TabsList className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="variables" className="px-2">{t.inspectorTabs[0]}</TabsTrigger>
          <TabsTrigger value="recipe" className="px-2">{t.inspectorTabs[1]}</TabsTrigger>
          <TabsTrigger value="tools" className={cn('px-2', !supportsTools && 'text-slate-400')}>{t.inspectorTabs[2]}</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" className="mr-1 shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
      <TabsContent value="variables" className="min-h-0 flex-1 overflow-auto">
        <VariableTagsPanel t={t} modelCapabilities={modelCapabilities} />
      </TabsContent>
      <TabsContent value="recipe" className="min-h-0 flex-1 overflow-auto p-3">
        <RecipeVariablesPanel t={t} locale={locale} categories={recipeVariableCategories} />
      </TabsContent>
      <TabsContent value="tools" className="min-h-0 flex-1 overflow-auto p-3">
        <InspectorToolsPanel t={t} locale={locale} disabled={!supportsTools} />
      </TabsContent>
    </Tabs>
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

export function WorkbenchShell() {
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [locale, setLocale] = useState<Locale>('zh')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(() => new Set())
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [layout, setLayout] = useState<GridLayoutItem[]>(() => cloneDefaultWorkbenchLayout())
  const [minimized, setMinimized] = useState<MinimizedState>(DEFAULT_MINIMIZED)
  const [activeWindow, setActiveWindow] = useState<WindowId>('editor')
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [editorTabs, setEditorTabs] = useState<EditorFileTab[]>([])
  const [activeEditorTabId, setActiveEditorTabId] = useState('')
  const [appAlert, setAppAlert] = useState<AppAlert | null>(null)
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkbenchActivity>('explorer')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeProjectId, setActiveProjectId] = useState('')
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [aiProviders, setAiProviders] = useState<AiProviderSummary[]>([])
  const [recipeVariableCategories, setRecipeVariableCategories] = useState<RecipeVariableCategory[]>([])
  const [configDiagnostics, setConfigDiagnostics] = useState<ProjectConfigDiagnostic[]>([])
  const [sourceControlStatus, setSourceControlStatus] = useState<SourceControlStatus | null>(null)
  const [sourceControlLoading, setSourceControlLoading] = useState(false)
  const [sourceControlDiff, setSourceControlDiff] = useState<SourceControlDiffView | null>(null)
  const [sourceControlBusyAction, setSourceControlBusyAction] = useState('')
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)
  const [branchQuery, setBranchQuery] = useState('')
  const [branchCreateName, setBranchCreateName] = useState('')
  const [branchBusyName, setBranchBusyName] = useState('')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [projectMode, setProjectMode] = useState<'local' | 'github'>('local')
  const [projectName, setProjectName] = useState('')
  const [projectFileName, setProjectFileName] = useState('')
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [activeInstructionDragPayload, setActiveInstructionDragPayload] = useState<InstructionDragPayload | null>(null)
  const [activeProviderFileDragPayload, setActiveProviderFileDragPayload] = useState<ProviderFileDragPayload | null>(null)
  const [workbenchRef, workbenchHeight] = useMeasuredHeight<HTMLElement>()
  const sourceControlBusyRef = useRef(false)
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const t = UI_COPY[locale]
  const monacoTheme = theme === 'dark' ? MONACO_DARK_THEME : MONACO_LIGHT_THEME
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || projects[0] || null,
    [activeProjectId, projects],
  )
  const activeEditorTab = useMemo(
    () => editorTabs.find((tab) => tab.id === activeEditorTabId) || editorTabs[0] || null,
    [activeEditorTabId, editorTabs],
  )
  const activeProjectFile = activeEditorTab
    ? { projectId: activeEditorTab.projectId, path: activeEditorTab.path, name: activeEditorTab.name }
    : null
  const activeZpmtDocument = activeEditorTab && isZpmtFilePath(activeEditorTab.path) ? parseZpmtContent(activeEditorTab.content, aiProviders) : null
  const activeZpmtModelContext = activeZpmtDocument
    ? getSelectedAiModelContext(aiProviders, activeZpmtDocument.config.providerId, activeZpmtDocument.config.model, activeZpmtDocument.config.providerFile)
    : null
  const activeZpmtModelCapabilities = useMemo(() => getZpmtModelCapabilityGate(activeZpmtModelContext?.model), [activeZpmtModelContext?.model])
  const visibleAnnouncements = announcements.filter((announcement) => !dismissedAnnouncements.has(dismissAnnouncementKey(announcement)))
  const feedbackUrl = useMemo(() => buildFeedbackUrl(), [])
  const gridMaxRows = useMemo(() => calculateGridRows(workbenchHeight), [workbenchHeight])
  const renderLayout = useMemo(() => buildRenderableLayout(layout, minimized), [layout, minimized])
  const layoutChanged = useMemo(
    () => layoutLoaded && !isDefaultWorkbenchState(layout, minimized, gridMaxRows),
    [gridMaxRows, layout, layoutLoaded, minimized],
  )

  function handleInstructionDragStart(event: DragStartEvent) {
    setActiveInstructionDragPayload(readDndInstructionPayload(event.active.data.current))
    setActiveProviderFileDragPayload(readDndProviderFilePayload(event.active.data.current))
  }

  function clearZpmtDragCarets() {
    window.dispatchEvent(new Event(ZPMT_CLEAR_DRAG_CARET_EVENT))
  }

  function handleInstructionDragMove(event: DragMoveEvent | DragOverEvent) {
    const payload = readDndInstructionPayload(event.active.data.current)
    const dropTarget = readZpmtDroppableData(event.over?.data.current)
    const point = getDragClientPoint(event)
    if (!payload || !point) return
    const handled = dispatchZpmtInstructionPointEvent(ZPMT_INSTRUCTION_DRAG_EVENT, payload, point)
    if (handled) return
    dropTarget?.onDragInstruction?.(payload, point)
  }

  function handleInstructionDragEnd(event: DragEndEvent) {
    const payload = readDndInstructionPayload(event.active.data.current)
    const providerPayload = readDndProviderFilePayload(event.active.data.current)
    const dropTarget = readZpmtDroppableData(event.over?.data.current)
    const point = getDragClientPoint(event)
    setActiveInstructionDragPayload(null)
    setActiveProviderFileDragPayload(null)
    clearZpmtDragCarets()
    if (providerPayload && point) {
      dropTarget?.onDropProviderFile?.(providerPayload, point)
      setActiveWindow('editor')
      return
    }
    if (!payload || !point) return
    if (payload.kind !== 'tool') {
      const handled = dispatchZpmtInstructionPointEvent(ZPMT_INSTRUCTION_DROP_EVENT, payload, point)
      if (handled) {
        setActiveWindow('editor')
        return
      }
    }
    dropTarget?.onDropInstruction(payload, point)
    setActiveWindow('editor')
  }

  useEffect(() => {
    const storedTheme = readStorageValue(STORAGE_KEYS.theme)
    const storedLocale = readStorageValue(STORAGE_KEYS.locale)
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
    } else if (prefersDark) {
      setTheme('dark')
    }

    if (storedLocale === 'zh' || storedLocale === 'en') {
      setLocale(storedLocale)
    }

    setDismissedAnnouncements(readDismissedAnnouncementKeys())
  }, [])

  useEffect(() => {
    const storedLayout = readWorkbenchLayoutState()
    if (storedLayout) {
      setLayout(storedLayout.layout)
      setMinimized(storedLayout.minimized)
    }
    setLayoutLoaded(true)
  }, [])

  useEffect(() => {
    if (!layoutLoaded || !workbenchHeight) return
    if (!areMinimizedStatesEqual(minimized, DEFAULT_MINIMIZED)) return

    const defaultLayout = cloneDefaultWorkbenchLayout(gridMaxRows)
    setLayout((current) => {
      if (areLayoutsEqual(current, defaultLayout)) return current
      return isDefaultWorkbenchLayout(current) ? defaultLayout : current
    })
  }, [gridMaxRows, layoutLoaded, minimized, workbenchHeight])

  useEffect(() => {
    if (!layoutLoaded) return
    writeStorageValue(STORAGE_KEYS.workbenchLayout, JSON.stringify({ layout, minimized }))
  }, [layout, layoutLoaded, minimized])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStorageValue(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    writeStorageValue(STORAGE_KEYS.locale, locale)
  }, [locale])

  useEffect(() => {
    if (!appAlert) return
    const timer = window.setTimeout(() => {
      setAppAlert((current) => (current?.id === appAlert.id ? null : current))
    }, 6500)

    return () => window.clearTimeout(timer)
  }, [appAlert])

  useEffect(() => {
    let cancelled = false

    fetch('/api/announcements')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { announcements?: Announcement[] } | null) => {
        if (cancelled) return
        const incoming = Array.isArray(data?.announcements) ? data.announcements : []
        setAnnouncements(incoming)
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch('/api/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: SessionUser | null } | null) => {
        if (cancelled) return
        const user = data?.user || null
        setSessionUser(user)
        setSessionChecked(true)
        if (!user) redirectToLogin()
      })
      .catch(() => {
        if (cancelled) return
        setSessionUser(null)
        setSessionChecked(true)
        redirectToLogin()
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sessionUser) return
    void loadProjects()
  }, [sessionUser?.id])

  useEffect(() => {
    if (!activeProject?.id) {
      setSourceControlStatus(null)
      return
    }
    void refreshSourceControlStatus(activeProject.id)
  }, [activeProject?.id])

  useEffect(() => {
    void loadProjectConfigFiles(activeProject?.id || '')
  }, [activeProject?.id])

  useEffect(() => {
    const handleRefresh = () => {
      void refreshSourceControlStatus(activeProject?.id)
    }
    window.addEventListener(SOURCE_CONTROL_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(SOURCE_CONTROL_REFRESH_EVENT, handleRefresh)
  }, [activeProject?.id])

  useEffect(() => {
    if (sourceControlStatus?.connected) return
    closeBranchPicker()
  }, [activeProject?.id, sourceControlStatus?.connected])

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  function toggleLocale() {
    setLocale((current) => (current === 'zh' ? 'en' : 'zh'))
  }

  function redirectToLogin() {
    const next = `${window.location.pathname}${window.location.search}`
    window.location.href = `/api/auth/login?next=${encodeURIComponent(next || '/')}`
  }

  function logout() {
    window.location.href = '/api/auth/logout'
  }

  function showAppAlert(description: string, title = t.errorTitle) {
    setAppAlert({
      id: Date.now(),
      title,
      description,
    })
  }

  function closeBranchPicker() {
    setBranchPickerOpen(false)
    setBranchQuery('')
    setBranchCreateName('')
  }

  function openNewProjectDialog() {
    closeBranchPicker()
    setNewProjectOpen(true)
  }

  function closeNewProjectDialog() {
    setNewProjectOpen(false)
  }

  async function submitProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const githubSession = readGithubSession()
    const endpoint = projectMode === 'github' ? '/api/projects/import-github' : '/api/projects'
    const normalizedName = projectName.trim()
    const normalizedFileName = projectFileName.trim().toLowerCase()
    const normalizedRepositoryUrl = repositoryUrl.trim()

    if (!normalizedName && projectMode === 'local') {
      showAppAlert(t.projectNameRequired)
      return
    }
    if (projectMode === 'local' && !isValidProjectFileName(normalizedFileName)) {
      showAppAlert(t.projectFileNameInvalid)
      return
    }
    if (projectMode === 'github' && !normalizedRepositoryUrl) {
      showAppAlert(t.repositoryUrlRequired)
      return
    }
    if (projectMode === 'github' && !githubSession?.accessToken) {
      showAppAlert(t.githubLoginRequired)
      return
    }

    const payload =
      projectMode === 'github'
        ? {
            name: normalizedName || normalizedFileName,
            fileName: normalizedFileName,
            repositoryUrl: normalizedRepositoryUrl,
            githubToken: githubSession?.accessToken || '',
          }
        : {
            name: normalizedName,
            fileName: normalizedFileName,
          }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((result) => result.json().catch(() => null))
      .catch(() => null)

    if (!response?.ok || !response.project) {
      showAppAlert(response?.message || '项目创建失败')
      return
    }

    setNewProjectOpen(false)
    setProjectName('')
    setProjectFileName('')
    setRepositoryUrl('')
    await loadProjects(response.project.id)
  }

  async function checkoutBranchFromPicker(branchName: string) {
    if (!activeProject || !sourceControlStatus?.connected || sourceControlBusyRef.current) return
    if (branchName === sourceControlStatus.branch) {
      closeBranchPicker()
      return
    }

    setBranchBusyName(branchName)
    try {
      const ok = await runSourceControlAction('checkoutBranch', { branchName })
      if (ok !== false) closeBranchPicker()
    } catch {
      // runSourceControlAction already shows the page-level alert.
    } finally {
      setBranchBusyName('')
    }
  }

  async function createBranchFromPicker() {
    const branchName = branchCreateName.trim()
    if (!activeProject || !sourceControlStatus?.connected || !branchName || sourceControlBusyRef.current) return

    setBranchBusyName(branchName)
    try {
      const ok = await runSourceControlAction('createBranch', { branchName })
      if (ok !== false) closeBranchPicker()
    } catch {
      // runSourceControlAction already shows the page-level alert.
    } finally {
      setBranchBusyName('')
    }
  }

  function dismissAnnouncement(announcement: Announcement) {
    const key = dismissAnnouncementKey(announcement)
    const next = new Set(dismissedAnnouncements)
    next.add(key)
    setDismissedAnnouncements(next)
    writeDismissedAnnouncementKeys(next)
  }

  async function loadProjects(nextActiveProjectId?: string) {
    setProjectsLoading(true)
    const response = await fetch('/api/projects')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setProjectsLoading(false))

    if (!response?.ok) {
      showAppAlert(response?.message || '项目加载失败')
      return
    }

    const incoming = Array.isArray(response.projects) ? response.projects : []
    setProjects(incoming)
    const preferredId = nextActiveProjectId || activeProjectId
    const nextId = incoming.find((project: ProjectSummary) => project.id === preferredId)?.id || incoming[0]?.id || ''
    setActiveProjectId(nextId)
    if (nextId) {
      await loadProjectConfigFiles(nextId)
      await refreshSourceControlStatus(nextId)
    } else {
      await loadProjectConfigFiles('')
      setSourceControlStatus(null)
    }
  }

  async function loadProjectConfigFiles(projectId = activeProject?.id) {
    if (!projectId) {
      setAiProviders([])
      setRecipeVariableCategories([])
      setConfigDiagnostics([])
      return
    }

    const query = new URLSearchParams({ projectId })
    const response = await fetch(`/api/projects/config-files?${query.toString()}`)
      .then((result) => result.json().catch(() => null))
      .catch(() => null)

    if (!response?.ok) {
      setAiProviders([])
      setRecipeVariableCategories([])
      setConfigDiagnostics([])
      showAppAlert(response?.message || '项目配置文件读取失败')
      return
    }

    setAiProviders(Array.isArray(response.providers) ? response.providers : [])
    const incoming = Array.isArray(response.recipeCategories) ? response.recipeCategories : []
    setRecipeVariableCategories(incoming)
    setConfigDiagnostics(Array.isArray(response.diagnostics) ? response.diagnostics : [])
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId)
  }

  async function refreshSourceControlStatus(projectId = activeProject?.id) {
    if (!projectId) {
      setSourceControlStatus(null)
      return
    }

    setSourceControlLoading(true)
    const response = await fetch(`/api/projects/source-control?projectId=${encodeURIComponent(projectId)}`)
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setSourceControlLoading(false))

    if (!response?.ok) {
      setSourceControlStatus(null)
      showAppAlert(response?.message || '源代码管理状态读取失败')
      return
    }

    setSourceControlStatus(response.status as SourceControlStatus)
  }

  async function runSourceControlAction(action: string, payload: Record<string, unknown> = {}) {
    if (!activeProject || sourceControlBusyRef.current) return false
    if (action === 'discard' && !window.confirm(t.scmDiscardConfirm)) return false
    if (
      action === 'setRemote' &&
      sourceControlStatus?.repositoryUrl &&
      typeof payload.repositoryUrl === 'string' &&
      payload.repositoryUrl.trim() &&
      payload.repositoryUrl.trim() !== sourceControlStatus.repositoryUrl &&
      !window.confirm(t.scmRemoteOverwriteConfirm)
    ) {
      return false
    }

    sourceControlBusyRef.current = true
    setSourceControlBusyAction(action)
    const githubSession = readGithubSession()
    try {
      const response = await fetchJson('/api/projects/source-control/actions', {
        method: 'POST',
        body: {
          projectId: activeProject.id,
          action,
          githubToken: githubSession?.accessToken || '',
          ...payload,
        },
      })

      if (!response?.ok) {
        const message = response?.message || '源代码管理操作失败'
        showAppAlert(message)
        throw new Error(message)
      }

      setSourceControlStatus(response.status as SourceControlStatus)
      if (['discard', 'publish', 'setRemote'].includes(action)) {
        await loadProjects(activeProject.id)
      }
      return true
    } finally {
      sourceControlBusyRef.current = false
      setSourceControlBusyAction('')
    }
  }

  async function openSourceControlDiff(input: { path: string; staged: boolean }) {
    if (!activeProject) return
    const query = new URLSearchParams({
      projectId: activeProject.id,
      path: input.path,
      staged: input.staged ? '1' : '0',
    })
    const response = await fetch(`/api/projects/source-control/diff?${query.toString()}`)
      .then((result) => result.json().catch(() => null))
      .catch(() => null)

    if (!response?.ok || !response.diff) {
      showAppAlert(response?.message || '差异内容读取失败')
      return
    }

    setSourceControlDiff(response.diff as SourceControlDiffView)
  }

  function handleProjectEntryDeleted(projectId: string, entryPath: string) {
    setEditorTabs((current) => {
      const next = current.filter((tab) => tab.projectId !== projectId || !isPathOrDescendant(tab.path, entryPath))
      if (next.some((tab) => tab.id === activeEditorTabId)) return next
      setActiveEditorTabId(next[0]?.id || '')
      return next
    })
  }

  function handleProjectDeleted(projectId: string) {
    setEditorTabs((current) => {
      const next = current.filter((tab) => tab.projectId !== projectId)
      if (next.some((tab) => tab.id === activeEditorTabId)) return next
      setActiveEditorTabId(next[0]?.id || '')
      return next
    })
    if (projectId === activeProject?.id) {
      setSourceControlStatus(null)
      setSourceControlDiff(null)
      closeBranchPicker()
    }
  }

  function handleProjectEntryRenamed(projectId: string, oldPath: string, nextName: string) {
    const parentPath = oldPath.includes('/') ? oldPath.split('/').slice(0, -1).join('/') : ''
    const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName
    let nextActiveTabId = activeEditorTabId

    setEditorTabs((current) =>
      current.map((tab) => {
        if (tab.projectId !== projectId || !isPathOrDescendant(tab.path, oldPath)) return tab
        const updatedPath = tab.path === oldPath ? nextPath : `${nextPath}/${tab.path.slice(oldPath.length + 1)}`
        const updated = {
          ...tab,
          id: buildEditorTabId(projectId, updatedPath),
          path: updatedPath,
          name: tab.path === oldPath ? nextName : tab.name,
        }
        if (tab.id === activeEditorTabId) nextActiveTabId = updated.id
        return updated
      }),
    )
    setActiveEditorTabId(nextActiveTabId)
  }

  async function openProjectFile(file: ProjectFileReference) {
    const tabId = buildEditorTabId(file.projectId, file.path)
    setActiveWindow('editor')

    if (editorTabs.some((tab) => tab.id === tabId)) {
      setActiveEditorTabId(tabId)
      return
    }

    const query = new URLSearchParams({ projectId: file.projectId, path: file.path })
    const response = await fetch(`/api/projects/files?${query.toString()}`)
      .then((result) => (result.ok ? result.json() : result.json().catch(() => null)))
      .catch(() => null)

    if (!response?.ok || !response.file) {
      showAppAlert(response?.message || '文件读取失败')
      return
    }

    const nextTab = createEditorFileTab(
      {
        projectId: response.file.projectId || file.projectId,
        path: response.file.path || file.path,
        name: response.file.name || file.name,
      },
      response.file.content || '',
    )

    setEditorTabs((current) => (current.some((tab) => tab.id === nextTab.id) ? current : [...current, nextTab]))
    setActiveEditorTabId(nextTab.id)
  }

  function changeActiveEditorContent(value: string) {
    setEditorTabs((current) =>
      current.map((tab) =>
        tab.id === activeEditorTabId
          ? {
              ...tab,
              content: value,
              dirty: value !== tab.savedContent,
              error: undefined,
            }
          : tab,
        ),
    )
    dispatchSourceControlRefresh()
  }

  function closeEditorTab(tabId: string) {
    const targetTab = editorTabs.find((tab) => tab.id === tabId)
    if (!targetTab) return
    if (targetTab.dirty && !window.confirm(t.closeUnsavedTabConfirm.replace('{name}', targetTab.name))) return

    setEditorTabs((current) => {
      const closingIndex = current.findIndex((tab) => tab.id === tabId)
      if (closingIndex < 0) return current

      const next = current.filter((tab) => tab.id !== tabId)
      if (activeEditorTabId === tabId || !next.some((tab) => tab.id === activeEditorTabId)) {
        const nextActiveTab = next[closingIndex] || next[closingIndex - 1] || next[0]
        setActiveEditorTabId(nextActiveTab?.id || '')
      }

      return next
    })
  }

  async function saveActiveEditorFile() {
    const currentTab = activeEditorTab
    if (!currentTab || currentTab.saving) return

    const savingContent = currentTab.content
    setEditorTabs((current) => current.map((tab) => (tab.id === currentTab.id ? { ...tab, saving: true, error: undefined } : tab)))

    const response = await fetch('/api/projects/files', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: currentTab.projectId,
        path: currentTab.path,
        content: savingContent,
      }),
    })
      .then((result) => result.json().catch(() => null))
      .catch(() => null)

    if (!response?.ok) {
      showAppAlert(response?.message || t.saveFailed)
      setEditorTabs((current) =>
        current.map((tab) =>
          tab.id === currentTab.id
            ? {
                ...tab,
                saving: false,
                error: response?.message || t.saveFailed,
              }
            : tab,
        ),
      )
      return
    }

    const savedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setEditorTabs((current) =>
      current.map((tab) =>
        tab.id === currentTab.id
          ? {
              ...tab,
              savedContent: savingContent,
              dirty: tab.content !== savingContent,
              saving: false,
              savedAt,
              error: undefined,
            }
          : tab,
        ),
    )
    dispatchSourceControlRefresh()
    if (isProjectConfigFilePath(currentTab.path)) {
      await loadProjectConfigFiles(currentTab.projectId)
    }
  }

  function commitRuntimeLayout(nextLayout: Array<Partial<GridLayoutItem> & { i: string }>) {
    setLayout((current) => {
      const next = sanitizeRuntimeLayout(nextLayout, minimized)
      return areLayoutsEqual(current, next) ? current : next
    })
  }

  function minimizeWindow(id: WindowId) {
    setActiveWindow(id)
    setMinimized((current) => ({ ...current, [id]: true }))
    setLayout((current) => applyMinimizedLayout(current, id))
  }

  function restoreWindow(id: WindowId) {
    setActiveWindow(id)
    setMinimized((current) => ({ ...current, [id]: false }))
    setLayout((current) => restoreLayoutItem(current, id, gridMaxRows))
  }

  function resetWorkbenchLayout() {
    setActiveWindow('editor')
    setMinimized({ ...DEFAULT_MINIMIZED })
    setLayout(cloneDefaultWorkbenchLayout(gridMaxRows))
  }

  function fitWindowFromResizeHandle(id: WindowId, handle: ResizeHandle) {
    setActiveWindow(id)
    if (minimized[id]) {
      restoreWindow(id)
      return
    }
    setLayout((current) => fitLayoutItemFromResizeHandle(current, id, handle, gridMaxRows))
  }

  function handleResizeHandleDoubleClick(event: React.MouseEvent<HTMLElement>) {
    const handleElement = (event.target as HTMLElement).closest('.react-resizable-handle')
    if (!(handleElement instanceof HTMLElement)) return

    const windowElement = handleElement.closest('[data-window-id]')
    const id = windowElement?.getAttribute('data-window-id')
    const handle = getResizeHandleFromElement(handleElement)
    if (!id || !isWindowId(id) || !handle) return

    event.preventDefault()
    event.stopPropagation()
    fitWindowFromResizeHandle(id, handle)
  }

  return (
    <div
      className={`relative flex h-screen min-w-[1180px] flex-col overflow-hidden bg-transparent text-slate-900 ${
        theme === 'dark' ? 'theme-dark' : 'theme-light'
      }`}
    >
      <PortalBackground />
      <TopCenterAlert alert={appAlert} onDismiss={() => setAppAlert(null)} />
      <AppHeader
        activeItem="workbench"
        labels={{ workbench: t.nav[0], variables: t.nav[1], community: t.nav[2], config: t.nav[3] }}
        onWorkbenchClick={() => setActiveWindow('editor')}
        rightContent={
          <>
            {layoutChanged ? (
              <button
                className="flex h-7 items-center gap-1 rounded-md border border-[#ffd8c4] bg-[#fff2ea] px-2 text-[11px] font-bold text-[#d95a1b] hover:bg-[#ffe5d7]"
                aria-label={t.windows.resetLayout}
                title={t.windows.resetLayout}
                onClick={resetWorkbenchLayout}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.windows.resetLayout}
              </button>
            ) : null}
            <button className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t.settings} title={t.settings}>
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={t.feedback}
              title={t.feedback}
              onClick={() => setFeedbackOpen(true)}
            >
              <MessageSquareWarning className="h-3.5 w-3.5" />
            </button>
            {sessionUser ? (
              <button
                className="flex h-7 max-w-32 items-center gap-1 rounded-md bg-slate-100 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                title={`${sessionUser.name} / ${t.logout}`}
                onClick={logout}
              >
                {sessionUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="h-4 w-4 rounded-full" src={sessionUser.avatar} alt="" />
                ) : (
                  <UserRound className="h-3.5 w-3.5" />
                )}
                <span className="truncate">{sessionUser.name}</span>
                <LogOut className="h-3 w-3 shrink-0" />
              </button>
            ) : sessionChecked ? null : (
              <span className="h-7 w-16 rounded-md bg-slate-100/70" aria-hidden="true" />
            )}
          </>
        }
      />

      {visibleAnnouncements.length ? (
        <section className="relative z-20 shrink-0 border-b border-slate-200 bg-white px-3 py-2">
          <div className="mx-auto flex max-w-[1500px] items-start gap-2 rounded-md border border-[#ffd8c4] bg-[#fff2ea] px-3 py-2 text-xs text-slate-700 shadow-sm">
            <span className="mt-0.5 shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-black text-[#d95a1b]">{t.announcement}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{visibleAnnouncements[0].title}</p>
              {visibleAnnouncements[0].content ? (
                <p className="mt-0.5 truncate text-[11px] text-slate-600">{visibleAnnouncements[0].content}</p>
              ) : null}
            </div>
            <button className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-500 hover:bg-white" onClick={() => dismissAnnouncement(visibleAnnouncements[0])}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      ) : null}

      <DndContext
        sensors={dndSensors}
        collisionDetection={pointerWithin}
        onDragStart={handleInstructionDragStart}
        onDragMove={handleInstructionDragMove}
        onDragOver={handleInstructionDragMove}
        onDragEnd={handleInstructionDragEnd}
        onDragCancel={() => {
          setActiveInstructionDragPayload(null)
          setActiveProviderFileDragPayload(null)
          clearZpmtDragCarets()
        }}
      >
        <main
          ref={workbenchRef}
          className="relative z-10 min-h-0 flex-1 overflow-hidden"
          onDoubleClickCapture={handleResizeHandleDoubleClick}
        >
          <WorkbenchGridLayout
          className="workbench-grid"
          layout={renderLayout}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          maxRows={gridMaxRows}
          margin={GRID_MARGIN}
          containerPadding={GRID_PADDING}
          autoSize={false}
          compactType={null}
          preventCollision={false}
          allowOverlap
          isBounded
          resizeHandles={RESIZE_HANDLES}
          draggableHandle=".workbench-window__title"
          draggableCancel=".workbench-window__control"
          onDragStop={(nextLayout) => commitRuntimeLayout(nextLayout as Array<Partial<GridLayoutItem> & { i: string }>)}
          onResizeStop={(nextLayout) => commitRuntimeLayout(nextLayout as Array<Partial<GridLayoutItem> & { i: string }>)}
        >
          <div
            key="files"
            className={minimized.files ? 'is-window-minimized' : undefined}
            data-window-id="files"
            style={{ zIndex: activeWindow === 'files' ? 20 : 1 }}
          >
            <WorkbenchWindow
              id="files"
              title={workspaceActivity === 'explorer' ? t.activity.explorer : t.activity.sourceControl}
              icon={workspaceActivity === 'explorer' ? Boxes : GitBranch}
              active={activeWindow === 'files'}
              minimized={minimized.files}
              minimizeLabel={t.windows.minimize}
              restoreLabel={t.windows.restore}
              onFocus={setActiveWindow}
              onMinimize={minimizeWindow}
              onRestore={restoreWindow}
            >
              <ProjectWorkspacePanel
                t={t}
                activity={workspaceActivity}
                projects={projects}
                activeProject={activeProject}
                activeProjectId={activeProject?.id || activeProjectId}
                projectsLoading={projectsLoading}
                activeFile={activeProjectFile}
                aiProviders={aiProviders}
                configDiagnostics={configDiagnostics}
                sourceControlStatus={sourceControlStatus}
                sourceControlLoading={sourceControlLoading}
                sourceControlBusyAction={sourceControlBusyAction}
                onActivityChange={setWorkspaceActivity}
                onSelectProject={selectProject}
                onRefreshProjects={loadProjects}
                onRefreshSourceControl={() => refreshSourceControlStatus()}
                onSourceControlAction={runSourceControlAction}
                onOpenFile={openProjectFile}
                onOpenDiff={openSourceControlDiff}
                onOpenNewProject={openNewProjectDialog}
                onProjectDeleted={handleProjectDeleted}
                onEntryDeleted={handleProjectEntryDeleted}
                onEntryRenamed={handleProjectEntryRenamed}
                onNotify={showAppAlert}
              />
            </WorkbenchWindow>
          </div>
          <div
            key="editor"
            className={minimized.editor ? 'is-window-minimized' : undefined}
            data-window-id="editor"
            style={{ zIndex: activeWindow === 'editor' ? 20 : 1 }}
          >
            <WorkbenchWindow
              id="editor"
              title={t.windows.editor}
              icon={FileText}
              active={activeWindow === 'editor'}
              minimized={minimized.editor}
              minimizeLabel={t.windows.minimize}
              restoreLabel={t.windows.restore}
              onFocus={setActiveWindow}
              onMinimize={minimizeWindow}
              onRestore={restoreWindow}
            >
              <EditorPanel
                t={t}
                locale={locale}
                monacoTheme={monacoTheme}
                aiProviders={aiProviders}
                recipeVariableCategories={recipeVariableCategories}
                tabs={editorTabs}
                activeTab={activeEditorTab}
                onActivateTab={setActiveEditorTabId}
                onCloseTab={closeEditorTab}
                onChangeActiveContent={changeActiveEditorContent}
                onSaveActive={saveActiveEditorFile}
              />
            </WorkbenchWindow>
          </div>
          <div
            key="tests"
            className={minimized.tests ? 'is-window-minimized' : undefined}
            data-window-id="tests"
            style={{ zIndex: activeWindow === 'tests' ? 20 : 1 }}
          >
            <WorkbenchWindow
              id="tests"
              title={t.windows.tests}
              icon={Play}
              active={activeWindow === 'tests'}
              minimized={minimized.tests}
              minimizeLabel={t.windows.minimize}
              restoreLabel={t.windows.restore}
              onFocus={setActiveWindow}
              onMinimize={minimizeWindow}
              onRestore={restoreWindow}
            >
              <TestPanel
                t={t}
                locale={locale}
                document={activeZpmtDocument}
                activeFile={activeProjectFile}
                supportsTools={activeZpmtModelCapabilities.supportsTools}
              />
            </WorkbenchWindow>
          </div>
          <div
            key="inspector"
            className={minimized.inspector ? 'is-window-minimized' : undefined}
            data-window-id="inspector"
            style={{ zIndex: activeWindow === 'inspector' ? 20 : 1 }}
          >
            <WorkbenchWindow
              id="inspector"
              title={t.windows.inspector}
              icon={Settings}
              active={activeWindow === 'inspector'}
              minimized={minimized.inspector}
              minimizeLabel={t.windows.minimize}
              restoreLabel={t.windows.restore}
              onFocus={setActiveWindow}
              onMinimize={minimizeWindow}
              onRestore={restoreWindow}
            >
              <InspectorPanel
                t={t}
                locale={locale}
                recipeVariableCategories={recipeVariableCategories}
                modelCapabilities={activeZpmtModelCapabilities}
              />
            </WorkbenchWindow>
          </div>
          </WorkbenchGridLayout>
        </main>
        <DragOverlay>
          {activeInstructionDragPayload ? (
            <InstructionDragOverlay payload={activeInstructionDragPayload} t={t} locale={locale} />
          ) : activeProviderFileDragPayload ? (
            <ProviderFileDragOverlay payload={activeProviderFileDragPayload} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <footer className="relative z-20 flex h-7 shrink-0 items-center justify-between border-t border-[#ef8a55] bg-[#ff985f] px-3 text-[11px] font-semibold text-white shadow-[0_-1px_10px_rgba(15,23,42,0.08)]">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            className="flex h-6 max-w-48 items-center gap-1 rounded px-2 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!activeProject || sourceControlLoading || !sourceControlStatus?.connected}
            title={t.scmCheckoutBranch}
            aria-label={t.scmCheckoutBranch}
            aria-expanded={branchPickerOpen}
            aria-haspopup="dialog"
            onClick={() => setBranchPickerOpen(true)}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate">{sourceControlStatus?.branch || t.status.branch}</span>
            {sourceControlStatus?.ahead || sourceControlStatus?.behind ? (
              <span className="shrink-0 text-[10px] text-white/85">
                {sourceControlStatus.ahead ? `↑${sourceControlStatus.ahead}` : ''}
                {sourceControlStatus.behind ? ` ↓${sourceControlStatus.behind}` : ''}
              </span>
            ) : null}
          </button>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {activeEditorTab?.dirty ? t.unsaved : t.status.saved}
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{activeEditorTab?.path || t.status.activeFile}</span>
          </span>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 whitespace-nowrap" title={feedbackUrl ? t.status.portalReady : t.status.portalMissing}>
            <Cloud className="h-3.5 w-3.5" />
            {feedbackUrl ? t.status.portalReady : t.status.portalMissing}
          </span>
          <button
            type="button"
            className="h-6 rounded px-2 text-white hover:bg-white/20"
            aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}
            title={theme === 'dark' ? t.themeToLight : t.themeToDark}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? t.themeToLight : t.themeToDark}
          </button>
          <button
            type="button"
            className="relative h-6 rounded px-2 text-white hover:bg-white/20"
            aria-label={t.announcement}
            title={t.announcement}
            aria-expanded={announcementOpen}
            aria-haspopup="dialog"
            onClick={() => setAnnouncementOpen((open) => !open)}
          >
            {t.announcement}
            {visibleAnnouncements.length ? (
              <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-rose-600 ring-1 ring-white" />
            ) : null}
          </button>
          <button
            type="button"
            className="h-6 rounded px-2 text-white hover:bg-white/20"
            aria-label={t.language}
            title={t.language}
            onClick={toggleLocale}
          >
            {locale === 'zh' ? '中文' : 'English'}
          </button>
          <span className="whitespace-nowrap">{t.status.lineColumn}</span>
          <span className="whitespace-nowrap">{t.status.encoding}</span>
          <span className="whitespace-nowrap">{t.status.mode}</span>
          <span className="whitespace-nowrap">{t.status.ready}</span>
        </div>
      </footer>

      {announcementOpen ? (
        <div
          className="fixed bottom-8 right-3 z-[90] w-80 rounded-md border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl"
          role="dialog"
          aria-label={t.announcement}
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-800">{t.announcement}</span>
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100"
              aria-label="关闭"
              onClick={() => setAnnouncementOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {visibleAnnouncements.length ? (
            <div className="max-h-64 space-y-2 overflow-auto">
              {visibleAnnouncements.map((announcement) => (
                <article key={dismissAnnouncementKey(announcement)} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{announcement.title}</h4>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="关闭"
                      onClick={() => dismissAnnouncement(announcement)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {announcement.content ? <p className="mt-1 text-[11px] leading-5 text-slate-600">{announcement.content}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="px-1 py-3 text-xs text-slate-500">{t.noAnnouncement}</p>
          )}
        </div>
      ) : null}

      {newProjectOpen ? (
        <ProjectQuickCreateDialog
          t={t}
          projectMode={projectMode}
          projectName={projectName}
          projectFileName={projectFileName}
          repositoryUrl={repositoryUrl}
          onProjectModeChange={setProjectMode}
          onProjectNameChange={setProjectName}
          onProjectFileNameChange={setProjectFileName}
          onRepositoryUrlChange={setRepositoryUrl}
          onClose={closeNewProjectDialog}
          onSubmit={submitProject}
        />
      ) : null}

      {branchPickerOpen && sourceControlStatus?.connected ? (
        <BranchQuickPick
          t={t}
          status={sourceControlStatus}
          query={branchQuery}
          createName={branchCreateName}
          busyAction={sourceControlBusyAction}
          busyBranchName={branchBusyName}
          onQueryChange={setBranchQuery}
          onCreateNameChange={setBranchCreateName}
          onCheckout={checkoutBranchFromPicker}
          onCreate={createBranchFromPicker}
          onClose={closeBranchPicker}
        />
      ) : null}

      {feedbackOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-6 backdrop-blur-sm" onClick={() => setFeedbackOpen(false)}>
          <div className="flex h-[72vh] w-[min(920px,100%)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <MessageSquareWarning className="h-3.5 w-3.5 text-[#d95a1b]" />
                {t.feedback}
              </div>
              <button className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setFeedbackOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {feedbackUrl ? (
              <iframe className="min-h-0 flex-1 bg-white" src={feedbackUrl} title={t.feedback} />
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-center text-xs text-slate-500">
                {t.feedbackUnavailable}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {sourceControlDiff ? (
        <SourceControlDiffModal
          t={t}
          diff={sourceControlDiff}
          monacoTheme={monacoTheme}
          onClose={() => setSourceControlDiff(null)}
        />
      ) : null}
    </div>
  )
}

function BranchQuickPick({
  t,
  status,
  query,
  createName,
  busyAction,
  busyBranchName,
  onQueryChange,
  onCreateNameChange,
  onCheckout,
  onCreate,
  onClose,
}: {
  t: WorkbenchCopy
  status: SourceControlStatus
  query: string
  createName: string
  busyAction: string
  busyBranchName: string
  onQueryChange: (value: string) => void
  onCreateNameChange: (value: string) => void
  onCheckout: (branchName: string) => Promise<void>
  onCreate: () => Promise<void>
  onClose: () => void
}) {
  const busy = Boolean(busyAction)
  const creatingBranch = busyAction === 'createBranch'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const branches = useMemo(() => {
    const incoming = status.branches.length
      ? status.branches
      : status.branch
        ? [{ name: status.branch, current: true, remote: false }]
        : []

    return [...incoming].sort((first, second) => {
      if (first.current !== second.current) return first.current ? -1 : 1
      if (first.remote !== second.remote) return first.remote ? 1 : -1
      return first.name.localeCompare(second.name)
    })
  }, [status.branch, status.branches])

  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return branches
    return branches.filter((branch) => branch.name.toLowerCase().includes(normalizedQuery))
  }, [branches, query])

  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <section
        className="absolute left-1/2 top-16 flex max-h-[72vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.scmBranchPickerTitle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">{t.scmBranchPickerTitle}</p>
              <p className="truncate text-[10px] text-slate-500">{status.repositoryUrl || status.workingDirectory}</p>
            </div>
          </div>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t.scmBranchSearch}
            aria-label={t.scmBranchSearch}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-1">
          {filteredBranches.length ? (
            filteredBranches.map((branch) => {
              const branchIsBusy = busyAction === 'checkoutBranch' && busyBranchName === branch.name
              return (
              <button
                key={branch.name}
                type="button"
                className={cn(
                  'flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition hover:bg-[#fff2ea] hover:text-[#d95a1b] disabled:cursor-not-allowed disabled:opacity-60',
                  branch.current && 'bg-[#fff7f2] text-[#d95a1b]',
                )}
                disabled={busy}
                onClick={() => void onCheckout(branch.name)}
              >
                {branchIsBusy ? (
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : branch.current ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <span className="min-w-0 flex-1 truncate font-bold">{branch.name}</span>
                <Badge variant={branch.current ? 'default' : 'outline'}>
                  {branch.current ? t.scmCurrentBranch : branch.remote ? t.scmRemoteBranch : t.scmLocalBranch}
                </Badge>
              </button>
              )
            })
          ) : (
            <p className="px-3 py-6 text-center text-xs text-slate-500">{t.scmNoBranches}</p>
          )}
        </div>

        <form
          className="flex shrink-0 items-center gap-2 border-t border-slate-200 p-2"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate()
          }}
        >
          <Input
            className="min-w-0 flex-1"
            value={createName}
            onChange={(event) => onCreateNameChange(event.target.value)}
            placeholder={t.scmNewBranch}
            aria-label={t.scmNewBranch}
            disabled={busy}
          />
          <Button type="submit" size="sm" className="min-w-24 shrink-0 whitespace-nowrap" disabled={!createName.trim() || busy} title={t.scmCreateBranchFromInput}>
            {creatingBranch ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {t.scmNewBranch}
          </Button>
        </form>
      </section>
    </div>
  )
}

function SourceControlDiffModal({
  t,
  diff,
  monacoTheme,
  onClose,
}: {
  t: WorkbenchCopy
  diff: SourceControlDiffView
  monacoTheme: string
  onClose: () => void
}) {
  const title = diff.originalPath && diff.originalPath !== diff.path ? `${diff.originalPath} -> ${diff.path}` : diff.path

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[78vh] w-[min(1180px,100%)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900">
              <GitBranch className="h-3.5 w-3.5 text-[#d95a1b]" />
              {t.diffTitle}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">{title}</p>
          </div>
          <button className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid h-7 shrink-0 grid-cols-2 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
          <div className="flex items-center border-r border-slate-200 px-3">{t.diffOriginal}</div>
          <div className="flex items-center px-3">{t.diffModified}</div>
        </div>
        <div className="min-h-0 flex-1">
          <MonacoDiffEditor
            height="100%"
            theme={monacoTheme}
            beforeMount={defineTransparentMonacoTheme}
            language={diff.language}
            original={diff.original}
            modified={diff.modified}
            options={{
              automaticLayout: true,
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineHeight: 20,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function dismissAnnouncementKey(announcement: Announcement) {
  return `${announcement.id}:${announcement.updatedAt || ''}`
}

function readStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Local storage is optional for this static prototype.
  }
}

function connectGitHub() {
  window.location.href = `/api/github/login?next=${encodeURIComponent(window.location.pathname)}`
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

function ensureZpmtFileName(value: string) {
  const normalized = value.trim()
  if (!normalized) return 'untitled.zpmt'
  return /\.zpmt$/i.test(normalized) ? normalized : `${normalized.replace(/\.[a-z0-9]+$/i, '')}.zpmt`
}

function ensureZlexFileName(value: string) {
  const normalized = value.trim()
  if (!normalized) return 'lexicon.zlex'
  return /\.zlex$/i.test(normalized) ? normalized : `${normalized.replace(/\.[a-z0-9]+$/i, '')}.zlex`
}

function ensureZamfFileName(value: string) {
  const normalized = value.trim()
  if (!normalized) return 'provider.zamf'
  return /\.zamf$/i.test(normalized) ? normalized : `${normalized.replace(/\.[a-z0-9]+$/i, '')}.zamf`
}

function createZlexTemplate(fileName: string) {
  const title = fileName.replace(/\.zlex$/i, '') || '词汇变量'
  return `${JSON.stringify(
    {
      schema: 'ccks.zlex',
      version: 1,
      categories: [
        {
          name: title,
          description: '',
          variables: [],
        },
      ],
    },
    null,
    2,
  )}\n`
}

function createZamfTemplate(fileName: string) {
  const title = fileName.replace(/\.zamf$/i, '') || 'Custom Provider'
  return `${JSON.stringify(
    {
      schema: 'ccks.zamf',
      version: 1,
      name: title,
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      models: [],
    },
    null,
    2,
  )}\n`
}

function createZpmtContent(input: {
  promptType: PromptFileType
  outputType: ZpmtOutputType
  provider: AiProviderSummary | null
  model: string
  responseConfig: ZpmtResponseConfig
}) {
  const modelEntry = input.provider?.models.find((model) => model.id === input.model) || null
  return serializeZpmtDocument(
    {
      config: {
        outputType: input.outputType,
        providerFile: input.provider?.filePath || '',
        providerId: input.provider?.id || '',
        providerName: input.provider?.name || '',
        model: input.model,
        responseConfig: normalizeResponseConfig(input.outputType, input.responseConfig, input.provider?.providerType, input.model, modelEntry),
      },
      system: input.promptType === 'agent' ? '\n' : '',
      user: '',
      tools: [],
      metadata: { schemaVersion: 2, recipeVariables: [] },
    },
    input.provider ? [input.provider] : [],
  )
}

function isZpmtFilePath(filePath: string) {
  return filePath.toLowerCase().endsWith('.zpmt')
}

function parseZlexContent(content: string): ProjectConfigParseResult<ZlexDocument> {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!isRecord(parsed)) return { ok: false, message: '文件不是 JSON 对象' }
    const schema = readString(parsed.schema)
    if (schema && schema !== 'ccks.zlex') return { ok: false, message: 'schema 不是 ccks.zlex' }
    return {
      ok: true,
      document: {
        schema: 'ccks.zlex',
        version: Math.max(1, Math.round(readFiniteNumber(parsed.version, 1))),
        categories: Array.isArray(parsed.categories) ? parsed.categories.map(normalizeZlexCategoryForEditor) : [],
      },
    }
  } catch {
    return { ok: false, message: 'JSON 解析失败' }
  }
}

function serializeZlexDocument(document: ZlexDocument) {
  return `${JSON.stringify(
    {
      schema: 'ccks.zlex',
      version: document.version || 1,
      categories: document.categories.map((category) => ({
        name: category.name,
        description: category.description,
        ...(category.createdAt ? { createdAt: category.createdAt } : {}),
        ...(category.updatedAt ? { updatedAt: category.updatedAt } : {}),
        ...(category.changeLog.length ? { changeLog: category.changeLog } : {}),
        variables: category.variables.map((variable) => ({
          variableName: variable.variableName,
          description: variable.description,
          candidates: variable.candidates,
          multiple: variable.multiple,
          ...(variable.createdAt ? { createdAt: variable.createdAt } : {}),
          ...(variable.updatedAt ? { updatedAt: variable.updatedAt } : {}),
          ...(variable.changeLog.length ? { changeLog: variable.changeLog } : {}),
        })),
      })),
    },
    null,
    2,
  )}\n`
}

function parseZamfContent(content: string): ProjectConfigParseResult<ZamfDocument> {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!isRecord(parsed)) return { ok: false, message: '文件不是 JSON 对象' }
    const schema = readString(parsed.schema)
    if (schema && schema !== 'ccks.zamf') return { ok: false, message: 'schema 不是 ccks.zamf' }
    const name = readString(parsed.name) || 'Custom Provider'
    const baseUrl = readString(parsed.baseUrl)
    const providerType = readString(parsed.providerType) || inferAiProviderTypeFromBaseUrl(baseUrl, 'custom')
    return {
      ok: true,
      document: {
        schema: 'ccks.zamf',
        version: Math.max(1, Math.round(readFiniteNumber(parsed.version, 1))),
        id: readString(parsed.id) || (providerType !== 'custom' ? providerType : createIdentifierSeed(name)?.toLowerCase() || providerType),
        name,
        providerType,
        baseUrl,
        apiKey: readString(parsed.apiKey),
        models: Array.isArray(parsed.models) ? parsed.models.map(normalizeZamfModelForEditor) : [],
      },
    }
  } catch {
    return { ok: false, message: 'JSON 解析失败' }
  }
}

function serializeZamfDocument(document: ZamfDocument) {
  return `${JSON.stringify(
    {
      schema: 'ccks.zamf',
      version: document.version || 1,
      name: document.name,
      baseUrl: document.baseUrl,
      apiKey: document.apiKey,
      models: document.models.map((model) => ({
        id: model.id,
        capabilities: model.capabilities,
        toolCalling: model.toolCalling,
        ...(model.parameterSchema === undefined || model.parameterSchema === '' ? {} : { parameterSchema: model.parameterSchema }),
        ...(model.defaultResponseConfig === undefined || model.defaultResponseConfig === '' ? {} : { defaultResponseConfig: model.defaultResponseConfig }),
        ...(model.presetRef ? { presetRef: model.presetRef } : {}),
      })),
    },
    null,
    2,
  )}\n`
}

function parseZpmtContent(content: string, providers: AiProviderSummary[] = []): ZpmtDocument | null {
  try {
    const parsed = JSON.parse(content) as Partial<ZpmtDocument> | null
    if (!parsed || typeof parsed !== 'object') return null
    const config = parsed.config && typeof parsed.config === 'object' ? parsed.config : {}
    const rawOutputType = (config as { outputType?: unknown }).outputType
    const outputType = normalizeZpmtOutputType(rawOutputType)
    const providerFile = readString((config as { providerFile?: unknown }).providerFile)
    const providerId = readString((config as { providerId?: unknown }).providerId)
    const providerName = readString((config as { providerName?: unknown }).providerName)
    const modelId = readString((config as { model?: unknown }).model)
    const selectedModelContext = getSelectedAiModelContext(providers, providerId, modelId, providerFile)
    const rawResponseConfig = (config as { responseConfig?: unknown }).responseConfig
    const legacyJsonResponseConfig =
      readString(rawOutputType) === 'json'
        ? { ...(isRecord(rawResponseConfig) ? rawResponseConfig : {}), responseFormat: 'json_object' }
        : rawResponseConfig

    return {
      config: {
        outputType,
        providerFile,
        providerId,
        providerName,
        model: modelId,
        responseConfig: normalizeResponseConfig(outputType, legacyJsonResponseConfig, selectedModelContext?.provider.providerType, modelId, selectedModelContext?.model),
      },
      system: typeof parsed.system === 'string' ? parsed.system : '',
      user: typeof parsed.user === 'string' ? parsed.user : '',
      tools: normalizeZpmtTools((parsed as { tools?: unknown }).tools),
      metadata: normalizeRecipeVariableMetadata((parsed as { metadata?: unknown }).metadata),
    }
  } catch {
    return null
  }
}

function serializeZpmtDocument(
  document: ZpmtDocument,
  providers: AiProviderSummary[] = [],
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
) {
  const selectedModelContext = getSelectedAiModelContext(providers, document.config.providerId, document.config.model, document.config.providerFile)
  const metadata = buildZpmtRecipeVariableMetadata(document, categories)
  return `${JSON.stringify(
    {
      config: {
        outputType: normalizeZpmtOutputType(document.config.outputType),
        providerFile: document.config.providerFile,
        providerId: document.config.providerId,
        providerName: document.config.providerName,
        model: document.config.model,
        responseConfig: normalizeResponseConfig(
          document.config.outputType,
          document.config.responseConfig,
          selectedModelContext?.provider.providerType,
          document.config.model,
          selectedModelContext?.model,
        ),
      },
      system: document.system,
      user: document.user,
      tools: document.tools.map((tool) => ({
        id: tool.id,
        toolId: tool.toolId || tool.id,
        categoryId: tool.categoryId,
        name: tool.name,
        description: tool.description,
        candidates: tool.candidates,
        multiple: tool.multiple,
        config: tool.config,
        schemaVersion: tool.schemaVersion || AI_TOOL_SCHEMA_VERSION,
      })),
      metadata,
    },
    null,
    2,
  )}\n`
}

function buildZpmtRecipeVariableMetadata(
  document: ZpmtDocument,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
): ZpmtRecipeVariableMetadata {
  const seen = new Set<string>()
  const recipeVariables: RecipeVariableSnapshot[] = []

  for (const tokenRange of [...findPromptTokenRanges(document.system), ...findPromptTokenRanges(document.user)]) {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed || parsed.tokenType !== 'recipe') continue
    const params = getPromptTokenParamMap(parsed.params)
    const sourceId = params.source || ''
    if (!sourceId) continue
    const key = `${parsed.name}:${sourceId}`
    if (seen.has(key)) continue
    seen.add(key)

    const current = findRecipeVariableBySourceId(categories, sourceId)
    if (current) {
      recipeVariables.push(
        createRecipeVariableSnapshot({
          tokenName: parsed.name,
          sourceId,
          category: current.category,
          variable: current.variable,
        }),
      )
      continue
    }

    const existing = findRecipeVariableSnapshot(document.metadata, parsed.name, sourceId)
    if (existing) recipeVariables.push(existing)
  }

  return {
    schemaVersion: 2,
    recipeVariables,
  }
}

function normalizeZpmtOutputType(value: unknown): ZpmtOutputType {
  return value === 'image' || value === 'text' ? value : 'text'
}

function normalizeResponseConfig(
  outputType: ZpmtOutputType,
  value: unknown,
  providerType?: string,
  modelId?: string,
  model?: AiProviderModel | null,
): ZpmtResponseConfig {
  return normalizeAiResponseConfig(outputType, value, providerType, modelId, model)
}

function defaultResponseConfig(outputType: ZpmtOutputType, providerType?: string, modelId?: string, model?: AiProviderModel | null): ZpmtResponseConfig {
  return defaultAiResponseConfig(outputType, providerType, modelId, model)
}

function createPromptEntryDialog(folder: TreeNode, providers: AiProviderSummary[]): EntryDialogState {
  const outputType: ZpmtOutputType = 'text'
  const selection = selectDefaultAiModel(providers, outputType)
  return {
    mode: 'prompt',
    folder,
    name: '',
    promptType: 'simple',
    outputType,
    providerId: selection.providerRef,
    model: selection.model,
    responseConfig: defaultResponseConfig(outputType, selection.providerType, selection.model, selection.modelEntry),
  }
}

function selectDefaultAiModel(providers: AiProviderSummary[], outputType: ZpmtOutputType) {
  for (const provider of providers) {
    const model = findCompatibleModelForProvider(provider, outputType)
    if (model) {
      return {
        providerFile: provider.filePath || '',
        providerId: provider.id,
        providerRef: getAiProviderRef(provider),
        providerName: provider.name,
        providerType: provider.providerType,
        model: model.id,
        modelEntry: model,
      }
    }
  }

  return { providerFile: '', providerId: '', providerRef: '', providerName: '', providerType: '', model: '', modelEntry: null }
}

function getAiProviderRef(provider: AiProviderSummary) {
  return provider.filePath || provider.id
}

function findAiProvider(providers: AiProviderSummary[], providerRef: string, providerFile = '') {
  if (providerFile) return providers.find((item) => item.filePath === providerFile) || null
  return providers.find((item) => item.filePath === providerRef || item.id === providerRef) || null
}

function listCompatibleModelsForProvider(providers: AiProviderSummary[], providerId: string, outputType: ZpmtOutputType) {
  const provider = findAiProvider(providers, providerId)
  return provider?.models.filter((model) => model.capabilities.includes(outputType)) || []
}

function findCompatibleModelForProvider(provider: AiProviderSummary | null | undefined, outputType: ZpmtOutputType) {
  return provider?.models.find((item) => item.capabilities.includes(outputType)) || null
}

function getSelectedAiModelContext(providers: AiProviderSummary[], providerId: string, modelId: string, providerFile = '') {
  const provider = findAiProvider(providers, providerId, providerFile)
  const model = provider?.models.find((item) => item.id === modelId) || null
  return provider && model ? { provider, model } : null
}

function getZpmtModelCapabilityGate(model: AiProviderModel | null | undefined): ZpmtModelCapabilityGate {
  if (!model) return ALL_ZPMT_MODEL_CAPABILITIES
  return {
    supportsTools: model.toolCalling === 'supported',
    supportsReferenceImage: aiModelSupportsReferenceImage(model),
    supportsReferenceFile: aiModelSupportsReferenceFile(model),
  }
}

function canUseInstructionPayload(payload: InstructionDragPayload, capabilities: ZpmtModelCapabilityGate) {
  if (payload.kind === 'tool') return capabilities.supportsTools
  if (payload.kind === 'variable' && payload.variableType === 'image') return capabilities.supportsReferenceImage
  if (payload.kind === 'variable' && payload.variableType === 'file') return capabilities.supportsReferenceFile
  return true
}

function isPromptTokenUnsupported(parsed: { variableType?: VariableType } | null, capabilities: ZpmtModelCapabilityGate) {
  if (!parsed?.variableType) return false
  return !canUseInstructionPayload({ kind: 'variable', variableType: parsed.variableType }, capabilities)
}

function getZpmtCapabilityRenderKey(capabilities: ZpmtModelCapabilityGate) {
  return [
    capabilities.supportsTools ? 'tools' : 'no-tools',
    capabilities.supportsReferenceImage ? 'image' : 'no-image',
    capabilities.supportsReferenceFile ? 'file' : 'no-file',
  ].join(':')
}

function readNumberInput(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(readString).filter(Boolean)
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

function readPlainText(value: unknown, fallback: string) {
  if (typeof value === 'string') return value.trim() || fallback
  if (!isRecord(value)) return fallback
  const zh = readString(value.zh)
  const en = readString(value.en)
  return zh || en || fallback
}

function readPlainCandidates(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item : readString(item)))
  if (typeof value === 'string') return splitLines(value)
  if (!isRecord(value)) return []
  const zh = Array.isArray(value.zh) ? value.zh.map((item) => (typeof item === 'string' ? item : readString(item))) : []
  if (zh.length) return zh
  return Array.isArray(value.en) ? value.en.map((item) => (typeof item === 'string' ? item : readString(item))) : []
}

function readLocalizedCandidates(value: unknown): Record<Locale, string[]> {
  if (!isRecord(value)) return { zh: [], en: [] }
  return {
    zh: readStringArray(value.zh),
    en: readStringArray(value.en),
  }
}

function normalizeZlexCategoryForEditor(value: unknown, index: number): ZlexCategory {
  const source = isRecord(value) ? value : {}
  const name = readPlainText(source.name, readString(source.id) || `分类 ${index + 1}`)
  return {
    name,
    description: readPlainText(source.description, ''),
    createdAt: readString(source.createdAt) || undefined,
    updatedAt: readString(source.updatedAt) || undefined,
    changeLog: normalizeRecipeChangeLog(source.changeLog),
    variables: Array.isArray(source.variables) ? source.variables.map(normalizeZlexVariableForEditor) : [],
  }
}

function normalizeZlexVariableForEditor(value: unknown, index: number): ZlexVariable {
  const source = isRecord(value) ? value : {}
  const id = readString(source.id) || `variable-${index + 1}`
  const variableName = readString(source.variableName) || createIdentifierSeed(id) || `variable${index + 1}`
  return {
    variableName,
    description: readPlainText(source.description, readPlainText(source.content, '')),
    candidates: readPlainCandidates(source.candidates),
    multiple: source.multiple === true,
    createdAt: readString(source.createdAt) || undefined,
    updatedAt: readString(source.updatedAt) || undefined,
    changeLog: normalizeRecipeChangeLog(source.changeLog),
  }
}

function normalizeZamfModelForEditor(value: unknown, index: number): ZamfModel {
  const source = isRecord(value) ? value : {}
  const rawCapabilities = Array.isArray(source.capabilities) ? source.capabilities : typeof source.capabilities === 'string' ? source.capabilities.split(',') : []
  const capabilities = ZPMT_OUTPUT_TYPES.filter((type) => rawCapabilities.map(readString).includes(type))
  return {
    id: readString(source.id) || `model-${index + 1}`,
    capabilities: capabilities.length ? capabilities : ['text'],
    toolCalling: normalizeToolCallingOption(source.toolCalling),
    parameterSchema: source.parameterSchema,
    defaultResponseConfig: source.defaultResponseConfig,
    presetRef: normalizeAiModelPresetRef(source.presetRef),
  }
}

function normalizeToolCallingOption(value: unknown): AiProviderModel['toolCalling'] {
  const normalized = readString(value).toLowerCase()
  if (normalized === 'supported' || normalized === 'tools' || normalized === 'true') return 'supported'
  if (normalized === 'unsupported' || normalized === 'no-tools' || normalized === 'false') return 'unsupported'
  return 'unknown'
}

function normalizeRecipeChangeLog(value: unknown): RecipeVariableChangeLog[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): RecipeVariableChangeLog[] => {
    if (!isRecord(item)) return []
    const version = readString(item.version)
    const date = readString(item.date)
    const note = readLocalizedText(item.note, '')
    if (!version && !date && !note.zh && !note.en) return []
    return [{ version, date, note }]
  })
}

function createEmptyZlexCategory(id: string): ZlexCategory {
  return {
    name: '新分类',
    description: '',
    changeLog: [],
    variables: [],
  }
}

function createEmptyZlexVariable(id: string): ZlexVariable {
  return {
    variableName: createIdentifierSeed(id) || 'recipeVariable',
    description: '',
    candidates: [],
    multiple: false,
    changeLog: [],
  }
}

function splitLines(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeZpmtTools(value: unknown): ZpmtToolInstruction[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ZpmtToolInstruction | null => {
      if (!isRecord(item)) return null
      const id = readString(item.id)
      if (!id) return null
      const definition = getAiToolDefinition(id)
      const config = coerceAiToolConfig(id, isRecord(item.config) ? item.config : {})
      if (definition) {
        return {
          id: definition.id,
          toolId: definition.id,
          categoryId: definition.categoryId,
          name: definition.name,
          description: definition.description,
          candidates: definition.candidates,
          multiple: definition.multiple,
          config,
          schemaVersion: readFiniteNumber(item.schemaVersion, AI_TOOL_SCHEMA_VERSION),
        }
      }
      return {
        id,
        toolId: readString(item.toolId) || id,
        categoryId: readString(item.categoryId),
        name: readLocalizedText(item.name, id),
        description: readLocalizedText(item.description, ''),
        candidates: readLocalizedCandidates(item.candidates),
        multiple: item.multiple === true,
        config,
        schemaVersion: readFiniteNumber(item.schemaVersion, AI_TOOL_SCHEMA_VERSION),
      }
    })
    .filter((item): item is ZpmtToolInstruction => item !== null)
}

function getVariableDetailConfig(type: VariableType, t: WorkbenchCopy) {
  const configs: Record<VariableType, { label: string; placeholder: string; defaultValue: string; tokenKey: string; tokenMode: 'prefix' | 'equals' }> = {
    string: { label: t.textLength, placeholder: '<10', defaultValue: '<10', tokenKey: 'length', tokenMode: 'prefix' },
    number: { label: t.numberRange, placeholder: '0..100', defaultValue: '0..100', tokenKey: 'range', tokenMode: 'equals' },
    array: { label: t.arrayLength, placeholder: '<5', defaultValue: '<5', tokenKey: 'length', tokenMode: 'prefix' },
    color: { label: t.defaultValue, placeholder: '#FB7E3D', defaultValue: '#FB7E3D', tokenKey: 'default', tokenMode: 'equals' },
    boolean: { label: t.defaultValue, placeholder: 'false', defaultValue: 'false', tokenKey: 'default', tokenMode: 'equals' },
    image: { label: t.imageCount, placeholder: '<=1', defaultValue: '<=1', tokenKey: 'count', tokenMode: 'prefix' },
    file: { label: t.fileSize, placeholder: '<10MB', defaultValue: '<10MB', tokenKey: 'size', tokenMode: 'prefix' },
  }
  return configs[type]
}

function createVariableToken(type: VariableType, name: string, detailValue: string, defaultValue: string) {
  const tokenType = VARIABLE_TOKEN_TYPES[type]
  const parts = [`${tokenType}:${name}`]
  const detail = detailValue.trim()
  const defaultText = defaultValue.trim()

  if (detail) {
    if (type === 'number') parts.push(formatEqualsTagParam('range', detail))
    else if (type === 'color' || type === 'boolean') parts.push(formatEqualsTagParam('default', detail))
    else if (type === 'image') parts.push(formatPrefixTagParam('count', detail))
    else if (type === 'file') parts.push(formatPrefixTagParam('size', detail))
    else parts.push(formatPrefixTagParam('length', detail))
  }

  if (defaultText && type !== 'color' && type !== 'boolean') {
    parts.push(formatEqualsTagParam('default', defaultText))
  }

  return `{{${parts.join(';')}}}`
}

function createRecipeToken(item: RecipeVariableItem, name: string, defaultValue: string | string[]) {
  const parts = [`recipe:${name}`, formatEqualsTagParam('source', formatRecipeVariableSourceId(item)), formatEqualsTagParam('multi', String(item.multiple))]
  const defaultText = (Array.isArray(defaultValue) ? defaultValue : [defaultValue])
    .map((value) => value.trim())
    .filter(Boolean)
    .join(',')
  if (defaultText) parts.push(formatEqualsTagParam('default', defaultText))
  return `{{${parts.join(';')}}}`
}

function formatPrefixTagParam(key: string, value: string) {
  const trimmed = sanitizeTagParamValue(value)
  return trimmed.startsWith(key) ? trimmed : `${key}${trimmed}`
}

function formatEqualsTagParam(key: string, value: string) {
  const trimmed = sanitizeTagParamValue(value)
  return trimmed.startsWith(`${key}=`) ? trimmed : `${key}=${trimmed}`
}

function sanitizeTagParamValue(value: string) {
  return value.trim().replace(/[{};]/g, '_')
}

function insertTextAtOffset(value: string, offset: number, insertion: string) {
  const safeOffset = Math.max(0, Math.min(value.length, offset))
  return `${value.slice(0, safeOffset)}${insertion}${value.slice(safeOffset)}`
}

function replaceTextRange(value: string, start: number, end: number, replacement: string) {
  const safeStart = Math.max(0, Math.min(value.length, start))
  const safeEnd = Math.max(safeStart, Math.min(value.length, end))
  return `${value.slice(0, safeStart)}${replacement}${value.slice(safeEnd)}`
}

function extractZpmtTagNames(...texts: string[]) {
  const names = new Set<string>()
  const tokenPattern = /\{\{\s*([a-z]+):([a-z][a-zA-Z0-9_]*)/g
  for (const text of texts) {
    for (const match of text.matchAll(tokenPattern)) {
      names.add(match[2])
    }
  }
  return names
}

function createZpmtToolInstruction(payload: Extract<InstructionDragPayload, { kind: 'tool' }>, config?: AiToolConfig): ZpmtToolInstruction {
  const definition = getAiToolDefinition(payload.item.id)
  if (definition) {
    return {
      id: definition.id,
      toolId: definition.id,
      categoryId: definition.categoryId,
      name: definition.name,
      description: definition.description,
      candidates: definition.candidates,
      multiple: definition.multiple,
      config: coerceAiToolConfig(definition.id, config || getAiToolFieldDefaults(definition.id)),
      schemaVersion: AI_TOOL_SCHEMA_VERSION,
    }
  }

  return {
    ...payload.item,
    categoryId: payload.categoryId,
    toolId: payload.item.id,
    config: config || {},
    schemaVersion: AI_TOOL_SCHEMA_VERSION,
  }
}

function createPendingZpmtTagEdit(
  sectionKey: ZpmtPromptSectionKey,
  start: number,
  end: number,
  token: string,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
  metadata?: ZpmtRecipeVariableMetadata,
): PendingZpmtTagEdit | null {
  const parsed = parsePromptToken(token)
  if (!parsed) return null

  if (parsed.variableType) {
    return {
      mode: 'edit',
      payload: { kind: 'variable', variableType: parsed.variableType },
      sectionKey,
      start,
      end,
      token,
      originalName: parsed.name,
    }
  }

  if (parsed.tokenType === 'recipe') {
    const params = getPromptTokenParamMap(parsed.params)
    const sourceId = params.source || ''
    const snapshot = findRecipeVariableSnapshot(metadata, parsed.name, sourceId)
    const item = findRecipeVariableItemById(sourceId, categories) || createRecipeVariableItemFromSnapshot(snapshot) || createFallbackRecipeVariableItem(sourceId || parsed.name, params.multi === 'true')
    return {
      mode: 'edit',
      payload: { kind: 'recipe', categoryId: findRecipeVariableCategoryId(sourceId, categories) || snapshot?.categoryId || 'recipe', item },
      sectionKey,
      start,
      end,
      token,
      originalName: parsed.name,
    }
  }

  return null
}

function getZpmtTagDialogInitialValues(dialog: PendingZpmtTagDialog) {
  if (dialog.mode === 'insert') {
    return {
      name: '',
      originalName: '',
      detailValue: '',
      defaultValue: '',
      recipeDefaultValues: [] as string[],
    }
  }

  const parsed = parsePromptToken(dialog.token)
  if (!parsed) {
    return {
      name: '',
      originalName: '',
      detailValue: '',
      defaultValue: '',
      recipeDefaultValues: [] as string[],
    }
  }

  const params = getPromptTokenParamMap(parsed.params)
  const variableType = parsed.variableType
  const detailValue =
    variableType === 'number'
      ? params.range || ''
      : variableType === 'color' || variableType === 'boolean'
        ? params.default || ''
        : variableType === 'image'
          ? params.count || ''
          : variableType === 'file'
            ? params.size || ''
            : variableType
              ? params.length || ''
              : ''

  return {
    name: parsed.name,
    originalName: parsed.name,
    detailValue,
    defaultValue: variableType && variableType !== 'color' && variableType !== 'boolean' ? params.default || '' : '',
    recipeDefaultValues: parsed.tokenType === 'recipe' && params.default ? params.default.split(',').map((item) => item.trim()).filter(Boolean) : [],
  }
}

function findRecipeVariableCategoryId(
  sourceId: string,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
) {
  return findRecipeVariableBySourceId(categories, sourceId)?.category.id || ''
}

function findRecipeVariableItemById(
  sourceId: string,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
) {
  return findRecipeVariableBySourceId(categories, sourceId)?.variable || null
}

function createFallbackRecipeVariableItem(id: string, multiple: boolean): RecipeVariableItem {
  return {
    id,
    scope: 'system',
    variableName: createIdentifierSeed(id) || id.replace(/[^a-zA-Z0-9_]/g, '_') || 'recipeVariable',
    name: { zh: id, en: id },
    description: { zh: '', en: '' },
    content: { zh: '', en: '' },
    candidates: { zh: [], en: [] },
    defaultValues: [],
    multiple,
    changeLog: [],
  }
}

function createRecipeVariableItemFromSnapshot(snapshot: RecipeVariableSnapshot | null): RecipeVariableItem | null {
  if (!snapshot) return null
  return {
    id: snapshot.id,
    sourceId: snapshot.sourceId,
    sourceFilePath: snapshot.sourceFilePath,
    scope: snapshot.scope,
    variableName: snapshot.variableName,
    name: snapshot.name,
    description: snapshot.description,
    content: snapshot.content,
    candidates: snapshot.candidates,
    defaultValues: snapshot.defaultValues,
    multiple: snapshot.multiple,
    updatedAt: snapshot.updatedAt,
    changeLog: snapshot.changeLog,
  }
}

function createIdentifierSeed(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const seed = words
    .map((word, index) => {
      const normalized = word.replace(/^[^a-zA-Z]+/, '')
      if (!normalized) return ''
      const lower = normalized.charAt(0).toLowerCase() + normalized.slice(1)
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
  return TAG_NAME_PATTERN.test(seed) ? seed : ''
}

function findPromptTokenRanges(text: string) {
  return Array.from(text.matchAll(/\{\{[^{}\n]+\}\}/g), (match) => ({
    token: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

function decoratePromptTokensForMarkdown(
  markdown: string,
  t: WorkbenchCopy,
  locale: Locale,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
  metadata?: ZpmtRecipeVariableMetadata,
  modelCapabilities: ZpmtModelCapabilityGate = ALL_ZPMT_MODEL_CAPABILITIES,
) {
  return markdown.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const label = resolvePromptTokenPresentation(token, t, locale, categories, metadata, modelCapabilities).label
    return `[${escapeMarkdownLinkLabel(label)}](ccks-token:${encodeURIComponent(token)})`
  })
}

function resolvePromptTokenPresentation(
  token: string,
  t: WorkbenchCopy,
  locale: Locale,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
  metadata?: ZpmtRecipeVariableMetadata,
  modelCapabilities: ZpmtModelCapabilityGate = ALL_ZPMT_MODEL_CAPABILITIES,
) {
  const parsed = parsePromptToken(token)
  if (!parsed) {
    return {
      label: token,
      tooltip: token,
      styleKey: 'unknown' as PromptTokenStyleKey,
      unsupported: false,
    }
  }

  const styleKey = parsed.variableType || (parsed.tokenType === 'recipe' ? 'recipe' : 'unknown')
  const unsupported = isPromptTokenUnsupported(parsed, modelCapabilities)
  const params = getPromptTokenParamMap(parsed.params)
  const recipeItem = parsed.tokenType === 'recipe' ? findRecipeVariableItemById(params.source || '', categories) : null
  const recipeSnapshot = parsed.tokenType === 'recipe' ? findRecipeVariableSnapshot(metadata, parsed.name, params.source || '') : null
  const typeLabel = parsed.variableType
    ? t.variableTypes[parsed.variableType]
    : parsed.tokenType === 'recipe'
      ? recipeItem?.name[locale] || recipeSnapshot?.name[locale] || t.recipeVariableLabel
      : parsed.tokenType
  const label = `${typeLabel}:${parsed.name}`
  const detailLines = parsed.params.map((param) => formatPromptTokenParam(param, t, locale, categories, metadata)).filter(Boolean)
  if (unsupported) detailLines.unshift(t.unsupportedByModel)
  if (recipeItem?.content[locale] || recipeSnapshot?.content[locale]) {
    detailLines.push(recipeItem?.content[locale] || recipeSnapshot?.content[locale] || '')
  }

  return {
    label,
    tooltip: [label, ...detailLines].join('\n'),
    styleKey,
    unsupported,
  }
}

function parsePromptToken(token: string) {
  if (!token.startsWith('{{') || !token.endsWith('}}')) return null
  const content = token.slice(2, -2).trim()
  const parts = content
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  const [head, ...params] = parts
  const match = /^([a-z]+):([a-z][a-zA-Z0-9_]*)$/.exec(head || '')
  if (!match) return null
  const tokenType = match[1]
  const variableType = VARIABLE_TYPES_BY_TOKEN[tokenType as VariableTokenType]

  return {
    tokenType,
    name: match[2],
    variableType,
    params,
  }
}

function formatPromptTokenParam(
  param: string,
  t: WorkbenchCopy,
  locale: Locale,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
  metadata?: ZpmtRecipeVariableMetadata,
) {
  const parsed = parsePromptTokenParam(param)
  if (!parsed) return param
  const label = t.promptTokenParams[parsed.key as keyof WorkbenchCopy['promptTokenParams']] || parsed.key
  const value =
    parsed.key === 'multi' && (parsed.value === 'true' || parsed.value === 'false')
      ? t.booleanText[parsed.value]
      : parsed.key === 'source'
        ? resolveRecipeVariableSourceLabel(parsed.value, categories, metadata, locale) || parsed.value
      : parsed.value
  return `${label}: ${value}`
}

function getPromptTokenParamMap(params: string[]) {
  return Object.fromEntries(
    params
      .map(parsePromptTokenParam)
      .filter((param): param is { key: string; value: string } => Boolean(param))
      .map((param) => [param.key, param.value]),
  )
}

function resolveRecipeVariableSourceLabel(
  sourceId: string,
  categories: RecipeVariableCategory[],
  metadata: ZpmtRecipeVariableMetadata | undefined,
  locale: Locale,
) {
  const current = findRecipeVariableItemById(sourceId, categories)
  if (current) return current.name[locale]
  const snapshot = metadata?.recipeVariables.find((item) => sourceIdsEqual(item.sourceId, sourceId))
  return snapshot?.name[locale] || ''
}

function parsePromptTokenParam(param: string) {
  const equalsIndex = param.indexOf('=')
  if (equalsIndex > 0) {
    return {
      key: param.slice(0, equalsIndex).trim(),
      value: param.slice(equalsIndex + 1).trim(),
    }
  }

  const prefixMatch = /^(length|count|size)(.+)$/.exec(param)
  if (!prefixMatch) return null
  return {
    key: prefixMatch[1],
    value: prefixMatch[2].trim(),
  }
}

function getPromptTokenStyleClass(styleKey: PromptTokenStyleKey) {
  return `zpmt-token-chip--${styleKey}`
}

function escapeMarkdownLinkLabel(value: string) {
  return value.replace(/([\\[\]])/g, '\\$1')
}

function getZpmtPromptMode(document: ZpmtDocument): PromptFileType {
  return document.system.length > 0 ? 'agent' : 'simple'
}

function buildZpmtPreviewMarkdown(document: ZpmtDocument, promptMode: PromptFileType) {
  if (promptMode === 'agent') {
    return [`## System`, document.system.trim(), `## User`, document.user.trim()].filter(Boolean).join('\n\n')
  }

  return document.user
}

function getSourceControlChangeCount(status: SourceControlStatus | null) {
  return status?.changes?.length || 0
}

function isPathOrDescendant(filePath: string, entryPath: string) {
  return filePath === entryPath || filePath.startsWith(`${entryPath}/`)
}

function dispatchSourceControlRefresh() {
  try {
    window.dispatchEvent(new Event(SOURCE_CONTROL_REFRESH_EVENT))
  } catch {
    // Source control status can still be refreshed manually.
  }
}

function readGithubSession(): GithubSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.githubSession)
    const parsed = raw ? JSON.parse(raw) : null
    if (typeof parsed?.accessToken === 'string' && parsed.accessToken) {
      return {
        accessToken: parsed.accessToken as string,
        scope: typeof parsed.scope === 'string' ? parsed.scope : '',
        user: parsed.user || null,
      }
    }
  } catch {
    return null
  }
  return null
}

function hasGithubRepoScope(session: GithubSession | null) {
  if (!session?.accessToken) return false
  const scopes = session.scope.split(',').map((scope: string) => scope.trim()).filter(Boolean)
  return scopes.includes('repo')
}

function isValidProjectFileName(value: string) {
  return /^[a-z][a-z0-9_-]{0,63}$/.test(value)
}

function readDismissedAnnouncementKeys() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.announcements)
    const values = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function writeDismissedAnnouncementKeys(keys: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.announcements, JSON.stringify([...keys]))
  } catch {
    // Dismissing should still work in memory if storage is unavailable.
  }
}

function stripPromptFrontmatter(markdown: string) {
  return markdown.replace(/^---[\s\S]*?---\s*/, '').trim()
}

function createDefaultWorkbenchLayout(rowCount = DEFAULT_GRID_ROWS): GridLayoutItem[] {
  const rows = Math.max(DEFAULT_GRID_ROWS, rowCount)
  const instructionRows = Math.max(9, Math.round(rows * 0.56))
  const testRows = Math.max(6, rows - instructionRows)

  return [
    { i: 'files', x: 0, y: 0, w: 5, h: rows, minW: 3, minH: 8 },
    { i: 'editor', x: 5, y: 0, w: 14, h: rows, minW: 8, minH: 9 },
    { i: 'inspector', x: 19, y: 0, w: 5, h: instructionRows, minW: 4, minH: 6 },
    { i: 'tests', x: 19, y: instructionRows, w: 5, h: testRows, minW: 4, minH: 6 },
  ]
}

function cloneDefaultWorkbenchLayout(rowCount = DEFAULT_GRID_ROWS) {
  return createDefaultWorkbenchLayout(rowCount).map((item) => clampLayoutItem({ ...item, resizeHandles: RESIZE_HANDLES }))
}

function isWindowId(value: string): value is WindowId {
  return WINDOW_IDS.includes(value as WindowId)
}

function calculateGridRows(height: number) {
  if (!height) return 40
  return Math.max(DEFAULT_GRID_ROWS, Math.ceil((height - GRID_PADDING[1] * 2 + GRID_MARGIN[1]) / (GRID_ROW_HEIGHT + GRID_MARGIN[1])))
}

function buildRenderableLayout(layout: GridLayoutItem[], minimized: MinimizedState) {
  return layout.map((item) =>
    createReactGridLayoutItem({
      ...item,
      isResizable: !minimized[item.i],
      resizeHandles: minimized[item.i] ? [] : RESIZE_HANDLES,
    }),
  )
}

function sanitizeRuntimeLayout(layout: Array<Partial<GridLayoutItem> & { i: string }>, minimized: MinimizedState) {
  return sanitizeWorkbenchLayout(layout).map((item) => {
    const base = minimized[item.i] ? MINIMIZED_LAYOUT[item.i] : getDefaultLayoutItem(item.i)
    return clampLayoutItem({
      ...item,
      minW: base.minW,
      minH: base.minH,
      resizeHandles: RESIZE_HANDLES,
    })
  })
}

function sanitizeWorkbenchLayout(layout: unknown): GridLayoutItem[] {
  const items = Array.isArray(layout) ? layout : []

  return WINDOW_IDS.map((id) => {
    const fallback = getDefaultLayoutItem(id)
    const candidate = items.find((item) => isRecord(item) && item.i === id)
    if (!isRecord(candidate)) return fallback

    return clampLayoutItem({
      ...fallback,
      x: readFiniteNumber(candidate.x, fallback.x),
      y: readFiniteNumber(candidate.y, fallback.y),
      w: readFiniteNumber(candidate.w, fallback.w),
      h: readFiniteNumber(candidate.h, fallback.h),
      minW: readFiniteNumber(candidate.minW, fallback.minW || 1),
      minH: readFiniteNumber(candidate.minH, fallback.minH || 1),
      resizeHandles: RESIZE_HANDLES,
    })
  })
}

function getDefaultLayoutItem(id: WindowId, rowCount = DEFAULT_GRID_ROWS) {
  const defaultLayout = cloneDefaultWorkbenchLayout(rowCount)
  const item = defaultLayout.find((layoutItem) => layoutItem.i === id)
  return { ...(item || defaultLayout[0]), resizeHandles: RESIZE_HANDLES }
}

function clampLayoutItem(item: GridLayoutItem) {
  const minW = Math.max(1, item.minW || 1)
  const minH = Math.max(1, item.minH || 1)
  const w = Math.min(GRID_COLS, Math.max(minW, Math.round(item.w)))
  const h = Math.max(minH, Math.round(item.h))
  const x = Math.max(0, Math.min(Math.round(item.x), GRID_COLS - w))
  const y = Math.max(0, Math.round(item.y))

  return createReactGridLayoutItem({
    ...item,
    x,
    y,
    w,
    h,
    minW,
    minH,
    resizeHandles: RESIZE_HANDLES,
  })
}

function createReactGridLayoutItem(item: GridLayoutItem): GridLayoutItem {
  return {
    ...item,
    maxW: item.maxW,
    maxH: item.maxH,
    moved: Boolean(item.moved),
    static: Boolean(item.static),
    isDraggable: item.isDraggable,
    isResizable: item.isResizable,
    resizeHandles: item.resizeHandles,
    constraints: item.constraints,
    isBounded: item.isBounded,
  }
}

function applyMinimizedLayout(layout: GridLayoutItem[], id: WindowId) {
  return layout.map((item) => {
    if (item.i !== id) return item
    const minimized = MINIMIZED_LAYOUT[id]
    return clampLayoutItem({
      ...item,
      ...minimized,
      x: Math.min(item.x, GRID_COLS - minimized.w),
      resizeHandles: RESIZE_HANDLES,
    })
  })
}

function restoreLayoutItem(layout: GridLayoutItem[], id: WindowId, rowCount = DEFAULT_GRID_ROWS) {
  return layout.map((item) => {
    if (item.i !== id) return item
    const restored = getDefaultLayoutItem(id, rowCount)
    return clampLayoutItem({
      ...restored,
      x: Math.min(item.x, GRID_COLS - restored.w),
      y: item.y,
    })
  })
}

function getResizeHandleFromElement(element: HTMLElement): ResizeHandle | null {
  const handle = RESIZE_HANDLES.find((axis) => element.classList.contains(`react-resizable-handle-${axis}`))
  return handle || null
}

function fitLayoutItemFromResizeHandle(layout: GridLayoutItem[], id: WindowId, handle: ResizeHandle, maxRows: number) {
  const item = layout.find((layoutItem) => layoutItem.i === id)
  if (!item) return layout

  let nextItem = { ...item }
  if (handle.includes('w')) nextItem = fitLayoutItemToLeft(nextItem, layout)
  if (handle.includes('e')) nextItem = fitLayoutItemToRight(nextItem, layout)
  if (handle.includes('n')) nextItem = fitLayoutItemToTop(nextItem, layout)
  if (handle.includes('s')) nextItem = fitLayoutItemToBottom(nextItem, layout, maxRows)

  const clamped = clampLayoutItem(nextItem)
  if (areLayoutItemsEqual(item, clamped)) return layout

  return layout.map((layoutItem) => (layoutItem.i === id ? clamped : layoutItem))
}

function fitLayoutItemToLeft(item: GridLayoutItem, layout: GridLayoutItem[]) {
  const blockerRight = layout
    .filter((other) => other.i !== item.i && rangesOverlap(item.y, item.y + item.h, other.y, other.y + other.h))
    .filter((other) => other.x + other.w <= item.x)
    .reduce((nearest, other) => Math.max(nearest, other.x + other.w), 0)
  const right = item.x + item.w
  const nextX = Math.min(item.x, blockerRight)
  return { ...item, x: nextX, w: Math.max(item.minW || 1, right - nextX) }
}

function fitLayoutItemToRight(item: GridLayoutItem, layout: GridLayoutItem[]) {
  const blockerLeft = layout
    .filter((other) => other.i !== item.i && rangesOverlap(item.y, item.y + item.h, other.y, other.y + other.h))
    .filter((other) => other.x >= item.x + item.w)
    .reduce((nearest, other) => Math.min(nearest, other.x), GRID_COLS)
  return { ...item, w: Math.max(item.minW || 1, blockerLeft - item.x) }
}

function fitLayoutItemToTop(item: GridLayoutItem, layout: GridLayoutItem[]) {
  const blockerBottom = layout
    .filter((other) => other.i !== item.i && rangesOverlap(item.x, item.x + item.w, other.x, other.x + other.w))
    .filter((other) => other.y + other.h <= item.y)
    .reduce((nearest, other) => Math.max(nearest, other.y + other.h), 0)
  const bottom = item.y + item.h
  const nextY = Math.min(item.y, blockerBottom)
  return { ...item, y: nextY, h: Math.max(item.minH || 1, bottom - nextY) }
}

function fitLayoutItemToBottom(item: GridLayoutItem, layout: GridLayoutItem[], maxRows: number) {
  const blockerTop = layout
    .filter((other) => other.i !== item.i && rangesOverlap(item.x, item.x + item.w, other.x, other.x + other.w))
    .filter((other) => other.y >= item.y + item.h)
    .reduce((nearest, other) => Math.min(nearest, other.y), maxRows)
  return { ...item, h: Math.max(item.minH || 1, blockerTop - item.y) }
}

function rangesOverlap(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && otherStart < end
}

function areLayoutItemsEqual(current: GridLayoutItem, next: GridLayoutItem) {
  return current.x === next.x && current.y === next.y && current.w === next.w && current.h === next.h
}

function areLayoutsEqual(current: GridLayoutItem[], next: GridLayoutItem[]) {
  if (current.length !== next.length) return false

  return current.every((item, index) => {
    const other = next[index]
    return (
      other &&
      item.i === other.i &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h &&
      item.minW === other.minW &&
      item.minH === other.minH
    )
  })
}

function areMinimizedStatesEqual(current: MinimizedState, next: MinimizedState) {
  return WINDOW_IDS.every((id) => current[id] === next[id])
}

function isDefaultWorkbenchLayout(layout: GridLayoutItem[], rowCount = DEFAULT_GRID_ROWS) {
  if (areLayoutsEqual(layout, cloneDefaultWorkbenchLayout(rowCount)) || areLayoutsEqual(layout, cloneDefaultWorkbenchLayout())) {
    return true
  }

  const files = layout.find((item) => item.i === 'files')
  const editor = layout.find((item) => item.i === 'editor')
  const tests = layout.find((item) => item.i === 'tests')
  const inspector = layout.find((item) => item.i === 'inspector')
  if (!files || !editor || !tests || !inspector) return false

  return (
    files.x === 0 &&
    files.y === 0 &&
    files.w === 5 &&
    editor.x === 5 &&
    editor.y === 0 &&
    editor.w === 14 &&
    editor.h === files.h &&
    inspector.x === 19 &&
    inspector.y === 0 &&
    inspector.w === 5 &&
    tests.x === 19 &&
    tests.y === inspector.h &&
    tests.w === 5 &&
    inspector.h + tests.h === files.h
  )
}

function isDefaultWorkbenchState(layout: GridLayoutItem[], minimized: MinimizedState, rowCount = DEFAULT_GRID_ROWS) {
  return isDefaultWorkbenchLayout(layout, rowCount) && areMinimizedStatesEqual(minimized, DEFAULT_MINIMIZED)
}

function readWorkbenchLayoutState() {
  const raw = readStorageValue(STORAGE_KEYS.workbenchLayout)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const minimized = sanitizeMinimizedState(parsed.minimized)
    let layout: GridLayoutItem[] = sanitizeRuntimeLayout(
      parsed.layout as Array<Partial<GridLayoutItem> & { i: string }>,
      minimized,
    )

    WINDOW_IDS.forEach((id) => {
      if (minimized[id]) layout = applyMinimizedLayout(layout, id)
    })

    return { layout, minimized }
  } catch {
    return null
  }
}

function sanitizeMinimizedState(value: unknown): MinimizedState {
  if (!isRecord(value)) return { ...DEFAULT_MINIMIZED }

  return WINDOW_IDS.reduce<MinimizedState>(
    (state, id) => ({
      ...state,
      [id]: value[id] === true,
    }),
    { ...DEFAULT_MINIMIZED },
  )
}

function readFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function buildFeedbackUrl() {
  const portalUrl = process.env.NEXT_PUBLIC_ZR_PORTAL_URL
  if (!portalUrl) return ''

  try {
    const url = new URL('/feedback', portalUrl)
    const serviceSlug = process.env.NEXT_PUBLIC_ZR_SERVICE_SLUG
    if (serviceSlug) url.searchParams.set('service_slug', serviceSlug)
    url.searchParams.set('embed', '1')
    return url.toString()
  } catch {
    return ''
  }
}
