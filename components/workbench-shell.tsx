'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
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
  AlertCircle,
  Bot,
  Copy,
  Download,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Home,
  LayoutDashboard,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PortalBackground } from '@/components/portal-background'
import { cn } from '@/lib/utils'
import {
  defaultAiResponseConfig,
  getImageAspectRatioOptions,
  getImageSizeForResolution,
  normalizeAiResponseConfig,
  resolveAiModelParameterSchema,
  ZPMT_OUTPUT_TYPES,
  type AiModelParameterSchema,
  type AiProviderModel,
  type AiProviderSummary,
  type ZpmtOutputType,
  type ZpmtResponseConfig,
} from '@/lib/ai-presets'
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
type RecipeVariableItem = {
  id: string
  name: LocalizedText
  candidates: Record<Locale, string[]>
  multiple: boolean
}
type RecipeVariableCategory = {
  id: string
  name: LocalizedText
  description: LocalizedText
  variables: RecipeVariableItem[]
}
type InstructionCategoryKind = 'recipe' | 'tool'
type EditorMode = 'normal' | 'preview' | 'assist'
type PromptFileType = 'simple' | 'agent'
type ZpmtSectionKey = 'config' | 'system' | 'user'
type ZpmtPromptSectionKey = Extract<ZpmtSectionKey, 'system' | 'user'>
type ZpmtCollapsedSections = Partial<Record<ZpmtSectionKey, boolean>>
type ZpmtToolInstruction = RecipeVariableItem & {
  categoryId: string
}
type InstructionDragPayload =
  | { kind: 'variable'; variableType: VariableType }
  | { kind: 'recipe'; categoryId: string; item: RecipeVariableItem }
  | { kind: 'tool'; categoryId: string; item: RecipeVariableItem }
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
  minH?: number
  isResizable?: boolean
  resizeHandles?: ResizeHandle[]
}
type MinimizedState = Record<WindowId, boolean>
type EntryDialogState =
  | { mode: 'folder'; folder: TreeNode; name: string }
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
    providerId: string
    providerName: string
    model: string
    responseConfig: ZpmtResponseConfig
  }
  system: string
  user: string
  tools: ZpmtToolInstruction[]
}

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

type ZpmtDropPoint = { x: number; y: number }
type ZpmtInstructionPointEventDetail = {
  payload: InstructionDragPayload
  point: ZpmtDropPoint
  handled: boolean
}
type ZpmtDroppableData = {
  kind: 'zpmt-root' | 'zpmt-prompt'
  onDropInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => void
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
    nav: ['网页管理', '配置中心'],
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
    noAiProvider: '暂无 AI 供应商，请先在配置中心添加',
    noModelForOutput: '当前输出类型没有可用模型',
    aiProviderConfig: 'AI 供应商配置',
    addAiProvider: '新增供应商',
    saveAiProvider: '保存供应商',
    updateAiProvider: '更新供应商',
    providerPreset: '供应商预设',
    providerName: '供应商名称',
    providerBaseUrl: 'Base URL',
    providerApiKey: 'API Key',
    providerApiKeyPlaceholder: '留空则保留已保存密钥',
    providerModels: '模型列表',
    providerModelsHint: '每行一个模型，格式：模型ID | text,image | tools',
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
    noOpenFile: '从左侧文件列表选择文件开始编辑',
    format: '格式化',
    run: '运行 (⌘+↵)',
    editorModes: {
      normal: '正常',
      preview: '预览',
      assist: 'AI辅助',
    },
    markdownPreview: 'Markdown 阅览',
    aiAssist: {
      title: 'AI辅助',
      status: '基于当前提示词草稿生成建议',
      items: ['补充变量默认值说明', '检查 CTA 链接是否存在', '为核心能力增加结构化输出约束'],
      action: '生成优化建议',
    },
    bottomTabs: ['测试面板', '运行结果', '测试用例', '性能分析'],
    success: '成功',
    tokens: '令牌 1,245（输入 528 / 输出 717）',
    heroTitle: '从词开始 - 让每个想法都有回响',
    heroDesc: '新一代AI驱动的网站生成与内容管理平台',
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
    fixedTools: '固定工具',
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
      hint: '提示词工作台原型 · 当前为本地 mock 数据',
      portalReady: '门户已配置',
      portalMissing: '门户未配置',
      lineColumn: '行 1, 列 1',
      encoding: 'UTF-8',
      mode: 'Markdown',
    },
  },
  en: {
    nav: ['Sites', 'Config'],
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
    noAiProvider: 'No AI providers. Add one in Config first.',
    noModelForOutput: 'No available model for this output type',
    aiProviderConfig: 'AI provider config',
    addAiProvider: 'Add provider',
    saveAiProvider: 'Save provider',
    updateAiProvider: 'Update provider',
    providerPreset: 'Provider preset',
    providerName: 'Provider name',
    providerBaseUrl: 'Base URL',
    providerApiKey: 'API Key',
    providerApiKeyPlaceholder: 'Leave blank to keep saved key',
    providerModels: 'Models',
    providerModelsHint: 'One model per line: model-id | text,image | tools',
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
    noOpenFile: 'Select a file from the file list to start editing',
    format: 'Format',
    run: 'Run (⌘+↵)',
    editorModes: {
      normal: 'Normal',
      preview: 'Preview',
      assist: 'AI Assist',
    },
    markdownPreview: 'Markdown Preview',
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
    fixedTools: 'Fixed tools',
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
      hint: 'Prompt workbench prototype · local mock data',
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
title: "从词开始 - 让每个想法都有回响"
description: "从词开始是一个新一代AI驱动的网站生成与内容管理平台"
layout: "base"
version: "1.2.0"
updated_at: "{{ now }}"
tags: ["首页", "营销"]
---

# {{ site.title }}
### {{ site.description }}

从词开始，帮助团队以更快的速度创建、管理和优化网站。

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

const recipeVariableCategories: RecipeVariableCategory[] = [
  {
    id: 'camera',
    name: { zh: '镜头语言', en: 'Camera Language' },
    description: { zh: '画面视角、镜头和景别控制', en: 'Perspective, lens, and framing controls' },
    variables: [
      {
        id: 'focal-length',
        name: { zh: '焦段', en: 'Focal length' },
        candidates: { zh: ['18mm', '35mm', '50mm', '85mm'], en: ['18mm', '35mm', '50mm', '85mm'] },
        multiple: false,
      },
      {
        id: 'lens-type',
        name: { zh: '镜头类型', en: 'Lens type' },
        candidates: { zh: ['广角镜头', '定焦镜头', '长焦镜头', '微距镜头'], en: ['Wide-angle', 'Prime', 'Telephoto', 'Macro'] },
        multiple: false,
      },
      {
        id: 'shot-size',
        name: { zh: '景别', en: 'Shot size' },
        candidates: { zh: ['特写', '中景', '全景', '远景'], en: ['Close-up', 'Medium shot', 'Full shot', 'Wide shot'] },
        multiple: false,
      },
    ],
  },
  {
    id: 'visual-style',
    name: { zh: '视觉风格', en: 'Visual Style' },
    description: { zh: '光线、色调和构图倾向', en: 'Lighting, tone, and composition direction' },
    variables: [
      {
        id: 'lighting',
        name: { zh: '光线', en: 'Lighting' },
        candidates: { zh: ['自然光', '逆光', '柔光', '霓虹光'], en: ['Natural light', 'Backlight', 'Soft light', 'Neon light'] },
        multiple: true,
      },
      {
        id: 'color-tone',
        name: { zh: '色调', en: 'Color tone' },
        candidates: { zh: ['冷色', '暖色', '高饱和', '低饱和'], en: ['Cool', 'Warm', 'High saturation', 'Low saturation'] },
        multiple: false,
      },
      {
        id: 'composition',
        name: { zh: '构图', en: 'Composition' },
        candidates: { zh: ['居中构图', '三分法', '对角线', '留白'], en: ['Centered', 'Rule of thirds', 'Diagonal', 'Negative space'] },
        multiple: true,
      },
    ],
  },
  {
    id: 'subject',
    name: { zh: '主体设定', en: 'Subject Setup' },
    description: { zh: '主体姿态、材质与情绪氛围', en: 'Pose, material, and mood presets' },
    variables: [
      {
        id: 'pose',
        name: { zh: '主体姿态', en: 'Subject pose' },
        candidates: { zh: ['站立', '坐姿', '奔跑', '回头'], en: ['Standing', 'Seated', 'Running', 'Looking back'] },
        multiple: false,
      },
      {
        id: 'material',
        name: { zh: '材质风格', en: 'Material style' },
        candidates: { zh: ['金属', '玻璃', '织物', '陶瓷'], en: ['Metal', 'Glass', 'Fabric', 'Ceramic'] },
        multiple: true,
      },
      {
        id: 'mood',
        name: { zh: '情绪氛围', en: 'Mood' },
        candidates: { zh: ['安静', '紧张', '梦幻', '未来感'], en: ['Quiet', 'Tense', 'Dreamlike', 'Futuristic'] },
        multiple: true,
      },
    ],
  },
]

const toolInstructionCategories: RecipeVariableCategory[] = [
  {
    id: 'context-tools',
    name: { zh: '上下文工具', en: 'Context Tools' },
    description: { zh: '读取当前环境、时间和会话上下文', en: 'Read environment, time, and session context' },
    variables: [
      {
        id: 'now',
        name: { zh: '当前时间', en: 'Current time' },
        candidates: { zh: ['now', 'today', 'weekday', 'timezone'], en: ['now', 'today', 'weekday', 'timezone'] },
        multiple: false,
      },
      {
        id: 'date-format',
        name: { zh: '日期格式化', en: 'Date format' },
        candidates: { zh: ['YYYY-MM-DD', '相对日期', '时间范围', '本地时区'], en: ['YYYY-MM-DD', 'relative date', 'time range', 'local timezone'] },
        multiple: false,
      },
      {
        id: 'session-context',
        name: { zh: '会话上下文', en: 'Session context' },
        candidates: { zh: ['用户语言', '项目名称', '当前文件', '打开标签'], en: ['user locale', 'project name', 'active file', 'open tabs'] },
        multiple: true,
      },
    ],
  },
  {
    id: 'data-tools',
    name: { zh: '数据与网络', en: 'Data and Web' },
    description: { zh: '抓取网页、查询数据和提取结构化字段', en: 'Fetch pages, query data, and extract structured fields' },
    variables: [
      {
        id: 'fetch-url',
        name: { zh: '网页抓取', en: 'Web fetch' },
        candidates: { zh: ['URL', '选择器', '正文摘要', '链接列表'], en: ['URL', 'selector', 'body summary', 'link list'] },
        multiple: true,
      },
      {
        id: 'db-query',
        name: { zh: '数据查询', en: 'Data query' },
        candidates: { zh: ['表名', '筛选条件', '排序', '限制条数'], en: ['table', 'filters', 'sort', 'limit'] },
        multiple: true,
      },
      {
        id: 'json-pick',
        name: { zh: 'JSON 提取', en: 'JSON pick' },
        candidates: { zh: ['字段路径', '数组项', '默认值', '类型转换'], en: ['field path', 'array item', 'fallback', 'type cast'] },
        multiple: true,
      },
    ],
  },
  {
    id: 'ai-tools',
    name: { zh: 'AI 生成', en: 'AI Generation' },
    description: { zh: '生成、改写、翻译和图像提示词扩展', en: 'Generate, rewrite, translate, and expand image prompts' },
    variables: [
      {
        id: 'ai-generate',
        name: { zh: '文本生成', en: 'Text generate' },
        candidates: { zh: ['模型', '温度', '最大长度', '输出格式'], en: ['model', 'temperature', 'max length', 'output format'] },
        multiple: true,
      },
      {
        id: 'ai-rewrite',
        name: { zh: '内容改写', en: 'Rewrite' },
        candidates: { zh: ['语气', '长度', '受众', '禁用词'], en: ['tone', 'length', 'audience', 'blocked words'] },
        multiple: true,
      },
      {
        id: 'image-prompt',
        name: { zh: '图像提示词', en: 'Image prompt' },
        candidates: { zh: ['主体', '风格', '比例', '负面提示词'], en: ['subject', 'style', 'ratio', 'negative prompt'] },
        multiple: true,
      },
    ],
  },
  {
    id: 'project-tools',
    name: { zh: '项目与版本', en: 'Project and Version' },
    description: { zh: '读取文件、生成差异摘要和辅助提交', en: 'Read files, summarize diffs, and assist commits' },
    variables: [
      {
        id: 'file-read',
        name: { zh: '文件读取', en: 'File read' },
        candidates: { zh: ['路径', '编码', '片段', '最近修改'], en: ['path', 'encoding', 'snippet', 'last modified'] },
        multiple: true,
      },
      {
        id: 'git-diff',
        name: { zh: '变更摘要', en: 'Diff summary' },
        candidates: { zh: ['已暂存', '未暂存', '新增文件', '删除文件'], en: ['staged', 'unstaged', 'added files', 'deleted files'] },
        multiple: true,
      },
      {
        id: 'commit-message',
        name: { zh: '提交文案', en: 'Commit message' },
        candidates: { zh: ['功能', '修复', '重构', '文档'], en: ['feature', 'fix', 'refactor', 'docs'] },
        multiple: false,
      },
    ],
  },
]

const inputSchema = z.object({
  siteTitle: z.string().min(1),
  description: z.string().min(1),
  getStarted: z.string().min(1),
  primary: z.string().min(1),
})

type InputForm = z.infer<typeof inputSchema>

function NavItem({ icon: Icon, label, active = false, onClick }: { icon: typeof Home; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition ${
        active
          ? 'border-[#FB7E3D] bg-[#fff2ea] text-[#d95a1b]'
          : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function createNodeRenderer({
  activeFile,
  decorations,
  onOpenFile,
  onNodeContextMenu,
}: {
  activeFile: ProjectFileReference | null
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
    const isActive = isFile && activeFile?.projectId === data.projectId && activeFile?.path === data.path
    const decoration = decorations[data.path || '']

    function handleClick() {
      if (isFile && data.projectId && data.path) {
        onOpenFile({ projectId: data.projectId, path: data.path, name: data.name })
        return
      }
      node.toggle()
    }

    return (
      <div
        style={style}
        className={cn(
          'group flex cursor-default items-center gap-1.5 rounded px-2 text-xs',
          isActive ? 'bg-[#fff2ea] text-[#d95a1b]' : 'text-slate-700 hover:bg-slate-100',
          decoration && !isActive ? getGitDecorationTextClass(decoration.kind) : '',
        )}
        onClick={handleClick}
        onContextMenu={(event) => {
          event.preventDefault()
          onNodeContextMenu(data, event)
        }}
      >
        {isFile ? (
          <span className="h-3.5 w-3.5 shrink-0" />
        ) : node.isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        {isFile ? <FileText className="h-3.5 w-3.5 text-slate-400" /> : <Folder className="h-3.5 w-3.5 text-amber-500" />}
        <span className="min-w-0 flex-1 truncate">{data.name}</span>
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

function VariableTagsPanel({ t }: { t: WorkbenchCopy }) {
  return (
    <div className="flex flex-wrap gap-2 p-3">
      {VARIABLE_TYPE_ORDER.map((type) => {
        const typeLabel = t.variableTypes[type]

        return (
          <TooltipAnchor key={type} tooltip={typeLabel} className="inline-flex">
            <DraggableInstructionTag
              id={`variable:${type}`}
              payload={{ kind: 'variable', variableType: type }}
              title={typeLabel}
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
  className,
  children,
}: {
  id: string
  payload: InstructionDragPayload
  title: string
  className: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { payload },
    attributes: { roleDescription: title },
  })
  const style: React.CSSProperties | undefined = isDragging ? { opacity: 0.45 } : undefined

  return (
    <span
      ref={setNodeRef}
      aria-label={title}
      className={cn('cursor-grab touch-none active:cursor-grabbing', className)}
      style={style}
      {...listeners}
      {...attributes}
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

function readDndInstructionPayload(value: unknown): InstructionDragPayload | null {
  if (!isRecord(value)) return null
  return isInstructionDragPayload(value.payload) ? value.payload : null
}

function isInstructionDragPayload(value: unknown): value is InstructionDragPayload {
  if (!isRecord(value)) return false
  if (value.kind === 'variable') return typeof value.variableType === 'string' && VARIABLE_TYPE_ORDER.includes(value.variableType as VariableType)
  if (value.kind !== 'recipe' && value.kind !== 'tool') return false
  return typeof value.categoryId === 'string' && isRecord(value.item) && typeof value.item.id === 'string'
}

function readZpmtDroppableData(value: unknown): ZpmtDroppableData | null {
  if (!isRecord(value)) return null
  if (value.kind !== 'zpmt-root' && value.kind !== 'zpmt-prompt') return null
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
      siteTitle: '从词开始',
      description: '新一代AI驱动的网站生成与内容管理平台',
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
        decorations,
        onOpenFile,
        onNodeContextMenu: (node, event) => {
          setContextMenu({ x: event.clientX, y: event.clientY, node })
        },
      }),
    [activeFile, decorations, onOpenFile],
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
      const provider = aiProviders.find((item) => item.id === dialog.providerId) || null
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
  const title = dialog.mode === 'folder' ? t.newFolder : dialog.mode === 'prompt' ? t.newPromptFile : t.rename
  const label = dialog.mode === 'folder' ? t.folderName : dialog.mode === 'prompt' ? t.fileName : t.renameTo
  const submitLabel = dialog.mode === 'folder' ? t.createFolder : dialog.mode === 'prompt' ? t.createFile : t.rename
  const Icon = dialog.mode === 'folder' ? FolderPlus : dialog.mode === 'prompt' ? FilePlus2 : Pencil
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
                        providerId: nextSelection.providerId,
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
                    const provider = aiProviders.find((item) => item.id === event.target.value)
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
                    <option key={provider.id} value={provider.id}>
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
                    const provider = aiProviders.find((item) => item.id === dialog.providerId) || null
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

const EDITOR_MODES: EditorMode[] = ['preview', 'assist', 'normal']

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
}: {
  markdown: string
  title: string
  t: WorkbenchCopy
  locale: Locale
}) {
  const content = useMemo(() => decoratePromptTokensForMarkdown(stripPromptFrontmatter(markdown), t, locale), [locale, markdown, t])
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
                const presentation = resolvePromptTokenPresentation(token, t, locale)
                return (
                  <span
                    className={cn('prompt-token-chip', getPromptTokenStyleClass(presentation.styleKey))}
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

function buildEditorTabId(projectId: string, filePath: string) {
  return `${projectId}:${filePath}`
}

function getEditorLanguage(filePath: string) {
  const normalized = filePath.toLowerCase()
  if (normalized.endsWith('.json') || normalized.endsWith('.zpmt')) return 'json'
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
  tabs,
  activeTab,
  onActivateTab,
  onChangeActiveContent,
  onSaveActive,
}: {
  t: WorkbenchCopy
  locale: Locale
  monacoTheme: string
  aiProviders: AiProviderSummary[]
  tabs: EditorFileTab[]
  activeTab: EditorFileTab | null
  onActivateTab: (tabId: string) => void
  onChangeActiveContent: (value: string) => void
  onSaveActive: () => void
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>('normal')
  const [zpmtPromptModes, setZpmtPromptModes] = useState<Record<string, PromptFileType>>({})
  const [zpmtCollapsedSections, setZpmtCollapsedSections] = useState<Record<string, ZpmtCollapsedSections>>({})
  const hasSidePanel = editorMode !== 'normal'
  const editorValue = activeTab?.content || ''
  const activeZpmtDocument = activeTab && isZpmtFilePath(activeTab.path) ? parseZpmtContent(editorValue, aiProviders) : null
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
        <div className="flex h-full min-w-0 items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              title={tab.path}
              onClick={() => onActivateTab(tab.id)}
              className={`flex h-full min-w-24 max-w-36 items-center gap-1.5 border-r border-slate-200 px-2.5 text-[11px] ${
                activeTab?.id === tab.id ? 'border-b-2 border-b-[#FB7E3D] text-[#d95a1b]' : 'text-slate-600'
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{tab.name}</span>
              {tab.dirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FB7E3D]" /> : null}
            </button>
          ))}
          <Button variant="ghost" size="icon">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 px-2 text-[11px] text-slate-500">
          <span className={`hidden xl:inline ${activeTab?.dirty || activeTab?.error ? 'text-[#d95a1b]' : 'text-emerald-600'}`}>
            {savedText}
          </span>
          <Button variant="outline" size="sm" disabled={!activeTab || activeTab.saving} onClick={onSaveActive}>
            <Save className="h-3 w-3" /> {saveText}
          </Button>
          <Button variant="outline" size="sm">{t.format}</Button>
          <EditorModeSwitch mode={editorMode} t={t} onChange={setEditorMode} />
        </div>
      </div>

      <div className={hasSidePanel ? 'editor-workspace editor-workspace--split' : 'editor-workspace'}>
        <div className="editor-surface min-h-0">
          {activeTab ? (
            activeZpmtDocument ? (
              <ZpmtStructuredEditor
                key={activeTab.id}
                t={t}
                locale={locale}
                document={activeZpmtDocument}
                promptMode={activeZpmtPromptMode}
                collapsedSections={activeZpmtCollapsedSections}
                aiProviders={aiProviders}
                onToggleSection={toggleActiveZpmtSection}
                onChange={(nextDocument) => onChangeActiveContent(serializeZpmtDocument(nextDocument, aiProviders))}
              />
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
        {editorMode === 'preview' ? <MarkdownPreviewPanel markdown={previewMarkdown} title={t.markdownPreview} t={t} locale={locale} /> : null}
        {editorMode === 'assist' ? <AiAssistPanel t={t} /> : null}
      </div>
    </div>
  )
}

function ZpmtStructuredEditor({
  t,
  locale,
  document,
  promptMode,
  collapsedSections,
  aiProviders,
  onToggleSection,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  document: ZpmtDocument
  promptMode: PromptFileType
  collapsedSections: ZpmtCollapsedSections
  aiProviders: AiProviderSummary[]
  onToggleSection: (section: ZpmtSectionKey) => void
  onChange: (document: ZpmtDocument) => void
}) {
  const showSystemPrompt = promptMode === 'agent'
  const selectedModelContext = getSelectedAiModelContext(aiProviders, document.config.providerId, document.config.model)
  const responseSchema = resolveAiModelParameterSchema(
    document.config.outputType,
    selectedModelContext?.provider?.providerType,
    document.config.model,
    selectedModelContext?.model,
  )
  const compatibleModels = listCompatibleModelsForProvider(aiProviders, document.config.providerId, document.config.outputType)

  function updateDocument(next: Partial<Omit<ZpmtDocument, 'config'>> & { config?: Partial<ZpmtDocument['config']> }) {
    onChange({
      ...document,
      ...next,
      config: next.config ? { ...document.config, ...next.config } : document.config,
    })
  }

  const [pendingTagDialog, setPendingTagDialog] = useState<PendingZpmtTagDialog | null>(null)
  const existingTagNames = useMemo(() => extractZpmtTagNames(document.system, document.user), [document.system, document.user])

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
    if (payload.kind === 'tool') {
      addToolFromPayload(payload)
      return
    }

    setPendingTagDialog({ mode: 'insert', payload, sectionKey, offset })
  }

  function handleTokenEdit(sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) {
    const dialog = createPendingZpmtTagEdit(sectionKey, start, end, token)
    if (dialog) setPendingTagDialog(dialog)
  }

  function removeTool(tool: ZpmtToolInstruction) {
    updateDocument({
      tools: document.tools.filter((item) => !(item.categoryId === tool.categoryId && item.id === tool.id)),
    })
  }

  function addToolFromPayload(payload: Extract<InstructionDragPayload, { kind: 'tool' }>) {
    const tool = createZpmtToolInstruction(payload)
    const exists = document.tools.some((item) => item.categoryId === tool.categoryId && item.id === tool.id)
    if (!exists) updateDocument({ tools: [...document.tools, tool] })
  }

  const { setNodeRef: setEditorDropRef } = useDroppable({
    id: 'zpmt-editor-root',
    data: {
      kind: 'zpmt-root',
      onDropInstruction: (payload: InstructionDragPayload) => {
        if (payload.kind === 'tool') addToolFromPayload(payload)
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
        <div className="zpmt-section__body--config">
          <label className="zpmt-config-field">
            <span>{t.outputType}</span>
            <select
              value={document.config.outputType}
              onChange={(event) => {
                const outputType = normalizeZpmtOutputType(event.target.value)
                const selection = selectDefaultAiModel(aiProviders, outputType)
                updateDocument({
                  config: {
                    outputType,
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
            <span>{t.aiProvider}</span>
            <select
              value={document.config.providerId}
              onChange={(event) => {
                const provider = aiProviders.find((item) => item.id === event.target.value)
                const model = findCompatibleModelForProvider(provider, document.config.outputType)
                updateDocument({
                  config: {
                    providerId: event.target.value,
                    providerName: provider?.name || '',
                    model: model?.id || '',
                    responseConfig: defaultResponseConfig(document.config.outputType, provider?.providerType, model?.id, model),
                  },
                })
              }}
            >
              {aiProviders.length ? null : <option value="">{t.noAiProvider}</option>}
              {document.config.providerId && !aiProviders.some((provider) => provider.id === document.config.providerId) ? (
                <option value={document.config.providerId}>{document.config.providerName || document.config.providerId}</option>
              ) : null}
              {aiProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
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
                const provider = aiProviders.find((item) => item.id === document.config.providerId) || null
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
          sectionKey="system"
          title={t.systemPrompt}
          value={document.system}
          collapsed={Boolean(collapsedSections.system)}
          onToggle={onToggleSection}
          onInstructionDrop={handleInstructionDrop}
          onTokenEdit={handleTokenEdit}
          onChange={(value) => updateDocument({ system: value })}
        />
      ) : null}

      <ZpmtPromptSection
        t={t}
        locale={locale}
        sectionKey="user"
        title={t.userPrompt}
        value={document.user}
        collapsed={Boolean(collapsedSections.user)}
        onToggle={onToggleSection}
        onInstructionDrop={handleInstructionDrop}
        onTokenEdit={handleTokenEdit}
        onChange={(value) => updateDocument({ user: value })}
      />
      <ZpmtToolsDock t={t} locale={locale} tools={document.tools} onRemove={removeTool} />
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
  sectionKey,
  title,
  value,
  collapsed,
  onToggle,
  onInstructionDrop,
  onTokenEdit,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  sectionKey: ZpmtSectionKey
  title: string
  value: string
  collapsed: boolean
  onToggle: (section: ZpmtSectionKey) => void
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
        if (payload.kind === 'tool') return
        editorRef.current?.setCaretAtPoint(point, true)
      },
      onDropInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => {
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
      if (!detail || detail.payload.kind === 'tool') return
      if (!isPointInsidePrompt(detail.point)) {
        editorRef.current?.clearDropCursor()
        return
      }
      editorRef.current?.setCaretAtPoint(detail.point, true)
      detail.handled = true
    }

    function handleInstructionDrop(event: Event) {
      const detail = (event as CustomEvent<ZpmtInstructionPointEventDetail>).detail
      if (!detail || detail.payload.kind === 'tool') return
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
  }, [onInstructionDrop, sectionKey, value.length])

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
  value: string
  minHeight: number
  onChange: (value: string) => void
  onTokenEdit: (start: number, end: number, token: string) => void
}>(function ZpmtPromptTokenEditor({ t, locale, value, minHeight, onChange, onTokenEdit }, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const latestValueRef = useRef(value)
  const renderKeyRef = useRef('')
  const [tooltip, setTooltip] = useState<FloatingTooltipState>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const renderKey = `${locale}:${value}`
    const currentValue = serializePromptTokenEditorDom(root)
    if (renderKeyRef.current !== renderKey || currentValue !== value) {
      renderPromptTokenEditorDom(root, value, t, locale)
      renderKeyRef.current = renderKey
    }
    latestValueRef.current = value
  }, [locale, t, value])

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
    renderKeyRef.current = `${locale}:${nextValue}`
    onChange(nextValue)
  }

  function renderAndPlaceCaret(nextValue: string, offset: number) {
    const root = rootRef.current
    if (!root) return
    latestValueRef.current = nextValue
    renderPromptTokenEditorDom(root, nextValue, t, locale)
    renderKeyRef.current = `${locale}:${nextValue}`
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

function renderPromptTokenEditorDom(root: HTMLElement, value: string, t: WorkbenchCopy, locale: Locale) {
  clearPromptEditorDropCursor(root)
  const nodes: Node[] = []
  let cursor = 0

  for (const tokenRange of findPromptTokenRanges(value)) {
    if (tokenRange.start > cursor) nodes.push(root.ownerDocument.createTextNode(value.slice(cursor, tokenRange.start)))
    nodes.push(createPromptTokenEditorNode(root.ownerDocument, tokenRange.token, t, locale))
    cursor = tokenRange.end
  }

  if (cursor < value.length) nodes.push(root.ownerDocument.createTextNode(value.slice(cursor)))
  root.replaceChildren(...nodes)
}

function createPromptTokenEditorNode(documentRef: Document, token: string, t: WorkbenchCopy, locale: Locale) {
  const presentation = resolvePromptTokenPresentation(token, t, locale)
  const tokenElement = documentRef.createElement('span')
  tokenElement.className = cn('prompt-token-chip zpmt-token-editor__token', getPromptTokenStyleClass(presentation.styleKey))
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
  const textNode = root.ownerDocument.createTextNode(text)
  targetRange.insertNode(textNode)
  const nextRange = root.ownerDocument.createRange()
  nextRange.setStart(textNode, text.length)
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
  onRemove,
}: {
  t: WorkbenchCopy
  locale: Locale
  tools: ZpmtToolInstruction[]
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
          const candidateText = tool.candidates[locale].join(' / ')

          return (
            <span
              key={`${tool.categoryId}:${tool.id}`}
              title={candidateText}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-[#ffd8c4] bg-[#fff8f4] px-2 text-[11px] font-black text-[#b94712]"
            >
              <span className="truncate">{toolName}</span>
              <button
                type="button"
                className="grid h-4 w-4 shrink-0 place-items-center rounded text-[#b94712]/70 hover:bg-[#ffe5d7] hover:text-[#9a3412]"
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
  const [name, setName] = useState(() => initialValues.name || createIdentifierSeed(recipeItem?.id || variableType || ''))
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

function TestPanel({ t }: { t: WorkbenchCopy }) {
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
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 px-3">
            <h3 className="text-xs font-black">{t.bottomTabs[0]}</h3>
            <Button variant="outline" size="sm">
              <Play className="h-3 w-3" /> {t.run}
            </Button>
          </div>
          <InputPanel />
        </section>
        <section className="mt-3 rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{t.success}</span>
            <span>{t.tokens}</span>
          </div>
          <h2 className="text-sm font-black text-slate-900">{t.heroTitle}</h2>
          <p className="mt-1.5 text-xs text-slate-600">{t.heroDesc}</p>
          <h3 className="mt-3 text-xs font-black">{t.coreTitle}</h3>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
            {t.coreItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button className="mt-3" size="sm">{t.cta}</Button>
        </section>
      </TabsContent>
      <TabsContent value="result" className="min-h-0 flex-1 overflow-auto p-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">{t.tokens}</div>
      </TabsContent>
      <TabsContent value="cases" className="min-h-0 flex-1 overflow-auto p-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">{t.contextText}</div>
      </TabsContent>
      <TabsContent value="perf" className="min-h-0 flex-1 overflow-auto p-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">{t.success}</div>
      </TabsContent>
    </Tabs>
  )
}

function InspectorToolsPanel({ t, locale }: { t: WorkbenchCopy; locale: Locale }) {
  return (
    <InstructionTagCategoriesPanel
      categories={toolInstructionCategories}
      dragKind="tool"
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
  emptyText,
  locale,
  searchPlaceholder,
  t,
}: {
  categories: RecipeVariableCategory[]
  dragKind: InstructionCategoryKind
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
  const filteredCategories = useMemo<RecipeVariableCategory[]>(() => {
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
      .filter((category): category is RecipeVariableCategory => category !== null)
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
                      const tooltipText = [candidateText, modeText].filter(Boolean).join('\n')

                      return (
                        <TooltipAnchor key={variable.id} tooltip={tooltipText || variableName} className="inline-flex">
                          <DraggableInstructionTag
                            id={`${dragKind}:${category.id}:${variable.id}`}
                            payload={{
                              kind: dragKind,
                              categoryId: category.id,
                              item: variable,
                            }}
                            title={variableName}
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

function RecipeVariablesPanel({ t, locale }: { t: WorkbenchCopy; locale: Locale }) {
  return (
    <InstructionTagCategoriesPanel
      categories={recipeVariableCategories}
      dragKind="recipe"
      emptyText={t.recipeVariableEmpty}
      locale={locale}
      searchPlaceholder={t.recipeVariableSearch}
      t={t}
    />
  )
}

function InspectorPanel({ t, locale }: { t: WorkbenchCopy; locale: Locale }) {
  return (
    <Tabs defaultValue="variables" className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200">
        <TabsList className="min-w-0 flex-1 overflow-hidden">
          <TabsTrigger value="variables" className="px-2">{t.inspectorTabs[0]}</TabsTrigger>
          <TabsTrigger value="recipe" className="px-2">{t.inspectorTabs[1]}</TabsTrigger>
          <TabsTrigger value="tools" className="px-2">{t.inspectorTabs[2]}</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" className="mr-1 shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
      <TabsContent value="variables" className="min-h-0 flex-1 overflow-auto">
        <VariableTagsPanel t={t} />
      </TabsContent>
      <TabsContent value="recipe" className="min-h-0 flex-1 overflow-auto p-3">
        <RecipeVariablesPanel t={t} locale={locale} />
      </TabsContent>
      <TabsContent value="tools" className="min-h-0 flex-1 overflow-auto p-3">
        <InspectorToolsPanel t={t} locale={locale} />
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
  const router = useRouter()
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
  const [aiProvidersLoading, setAiProvidersLoading] = useState(false)
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
    const dropTarget = readZpmtDroppableData(event.over?.data.current)
    const point = getDragClientPoint(event)
    setActiveInstructionDragPayload(null)
    clearZpmtDragCarets()
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
    void loadAiProviders()
  }, [sessionUser?.id])

  useEffect(() => {
    if (!activeProject?.id) {
      setSourceControlStatus(null)
      return
    }
    void refreshSourceControlStatus(activeProject.id)
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
      await refreshSourceControlStatus(nextId)
    } else {
      setSourceControlStatus(null)
    }
  }

  async function loadAiProviders() {
    setAiProvidersLoading(true)
    const response = await fetch('/api/ai-providers')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setAiProvidersLoading(false))

    if (!response?.ok) {
      showAppAlert(response?.message || 'AI 供应商加载失败')
      return
    }

    setAiProviders(Array.isArray(response.providers) ? response.providers : [])
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
  }

  function updateLayout(nextLayout: Array<Partial<GridLayoutItem> & { i: string }>) {
    setLayout((current) => {
      const next = sanitizeRuntimeLayout(nextLayout, minimized)
      return areLayoutsEqual(current, next) ? current : next
    })
  }

  function handleResizeStop(nextLayout: Array<Partial<GridLayoutItem> & { i: string }>) {
    const next = sanitizeRuntimeLayout(nextLayout, minimized)
    setLayout((current) => (areLayoutsEqual(current, next) ? current : next))
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
      <header className="relative z-10 flex h-12 shrink-0 items-center border-b border-slate-200/80 bg-white shadow-[0_1px_20px_rgba(15,23,42,0.04)]">
        <div className="flex w-[190px] items-center gap-2 px-4">
          <div className="grid h-7 w-7 place-items-center">
            <Image src="/zr-logo.png" alt="从词开始" width={24} height={24} />
          </div>
          <span className="text-[15px] font-black text-[#d95a1b]">从词开始</span>
        </div>
        <nav className="flex h-full flex-1 items-center">
          <NavItem icon={LayoutDashboard} label={t.nav[0]} active={activeWindow === 'files' || activeWindow === 'editor' || activeWindow === 'inspector'} onClick={() => setActiveWindow('editor')} />
          <NavItem
            icon={Settings}
            label={t.nav[1]}
            onClick={() => {
              router.push('/config')
            }}
          />
        </nav>
        <div className="flex items-center gap-2 px-4">
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
        </div>
      </header>

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
          onLayoutChange={(nextLayout) => updateLayout(nextLayout as Array<Partial<GridLayoutItem> & { i: string }>)}
          onResizeStop={(nextLayout) => handleResizeStop(nextLayout as Array<Partial<GridLayoutItem> & { i: string }>)}
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
                tabs={editorTabs}
                activeTab={activeEditorTab}
                onActivateTab={setActiveEditorTabId}
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
              <TestPanel t={t} />
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
              <InspectorPanel t={t} locale={locale} />
            </WorkbenchWindow>
          </div>
          </WorkbenchGridLayout>
        </main>
        <DragOverlay>
          {activeInstructionDragPayload ? (
            <InstructionDragOverlay payload={activeInstructionDragPayload} t={t} locale={locale} />
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
        providerId: input.provider?.id || '',
        providerName: input.provider?.name || '',
        model: input.model,
        responseConfig: normalizeResponseConfig(input.outputType, input.responseConfig, input.provider?.providerType, input.model, modelEntry),
      },
      system: input.promptType === 'agent' ? '\n' : '',
      user: '',
      tools: [],
    },
    input.provider ? [input.provider] : [],
  )
}

function isZpmtFilePath(filePath: string) {
  return filePath.toLowerCase().endsWith('.zpmt')
}

function parseZpmtContent(content: string, providers: AiProviderSummary[] = []): ZpmtDocument | null {
  try {
    const parsed = JSON.parse(content) as Partial<ZpmtDocument> | null
    if (!parsed || typeof parsed !== 'object') return null
    const config = parsed.config && typeof parsed.config === 'object' ? parsed.config : {}
    const rawOutputType = (config as { outputType?: unknown }).outputType
    const outputType = normalizeZpmtOutputType(rawOutputType)
    const providerId = readString((config as { providerId?: unknown }).providerId)
    const providerName = readString((config as { providerName?: unknown }).providerName)
    const modelId = readString((config as { model?: unknown }).model)
    const selectedModelContext = getSelectedAiModelContext(providers, providerId, modelId)
    const rawResponseConfig = (config as { responseConfig?: unknown }).responseConfig
    const legacyJsonResponseConfig =
      readString(rawOutputType) === 'json'
        ? { ...(isRecord(rawResponseConfig) ? rawResponseConfig : {}), responseFormat: 'json_object' }
        : rawResponseConfig

    return {
      config: {
        outputType,
        providerId,
        providerName,
        model: modelId,
        responseConfig: normalizeResponseConfig(outputType, legacyJsonResponseConfig, selectedModelContext?.provider.providerType, modelId, selectedModelContext?.model),
      },
      system: typeof parsed.system === 'string' ? parsed.system : '',
      user: typeof parsed.user === 'string' ? parsed.user : '',
      tools: normalizeZpmtTools((parsed as { tools?: unknown }).tools),
    }
  } catch {
    return null
  }
}

function serializeZpmtDocument(document: ZpmtDocument, providers: AiProviderSummary[] = []) {
  const selectedModelContext = getSelectedAiModelContext(providers, document.config.providerId, document.config.model)
  return `${JSON.stringify(
    {
      config: {
        outputType: normalizeZpmtOutputType(document.config.outputType),
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
        categoryId: tool.categoryId,
        name: tool.name,
        candidates: tool.candidates,
        multiple: tool.multiple,
      })),
    },
    null,
    2,
  )}\n`
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
    providerId: selection.providerId,
    model: selection.model,
    responseConfig: defaultResponseConfig(outputType, selection.providerType, selection.model, selection.modelEntry),
  }
}

function selectDefaultAiModel(providers: AiProviderSummary[], outputType: ZpmtOutputType) {
  for (const provider of providers) {
    const model = findCompatibleModelForProvider(provider, outputType)
    if (model) {
      return {
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.providerType,
        model: model.id,
        modelEntry: model,
      }
    }
  }

  return { providerId: '', providerName: '', providerType: '', model: '', modelEntry: null }
}

function listCompatibleModelsForProvider(providers: AiProviderSummary[], providerId: string, outputType: ZpmtOutputType) {
  const provider = providers.find((item) => item.id === providerId)
  return provider?.models.filter((model) => model.capabilities.includes(outputType)) || []
}

function findCompatibleModelForProvider(provider: AiProviderSummary | undefined, outputType: ZpmtOutputType) {
  return provider?.models.find((item) => item.capabilities.includes(outputType)) || null
}

function getSelectedAiModelContext(providers: AiProviderSummary[], providerId: string, modelId: string) {
  const provider = providers.find((item) => item.id === providerId) || null
  const model = provider?.models.find((item) => item.id === modelId) || null
  return provider && model ? { provider, model } : null
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

function readLocalizedCandidates(value: unknown): Record<Locale, string[]> {
  if (!isRecord(value)) return { zh: [], en: [] }
  return {
    zh: readStringArray(value.zh),
    en: readStringArray(value.en),
  }
}

function normalizeZpmtTools(value: unknown): ZpmtToolInstruction[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ZpmtToolInstruction | null => {
      if (!isRecord(item)) return null
      const id = readString(item.id)
      if (!id) return null
      return {
        id,
        categoryId: readString(item.categoryId),
        name: readLocalizedText(item.name, id),
        candidates: readLocalizedCandidates(item.candidates),
        multiple: item.multiple === true,
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
  const parts = [`recipe:${name}`, formatEqualsTagParam('source', item.id), formatEqualsTagParam('multi', String(item.multiple))]
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

function createZpmtToolInstruction(payload: Extract<InstructionDragPayload, { kind: 'tool' }>): ZpmtToolInstruction {
  return {
    ...payload.item,
    categoryId: payload.categoryId,
  }
}

function createPendingZpmtTagEdit(sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string): PendingZpmtTagEdit | null {
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
    const item = findRecipeVariableItemById(sourceId) || createFallbackRecipeVariableItem(sourceId || parsed.name, params.multi === 'true')
    return {
      mode: 'edit',
      payload: { kind: 'recipe', categoryId: findRecipeVariableCategoryId(sourceId) || 'recipe', item },
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

function findRecipeVariableCategoryId(itemId: string) {
  return recipeVariableCategories.find((category) => category.variables.some((item) => item.id === itemId))?.id || ''
}

function findRecipeVariableItemById(itemId: string) {
  return recipeVariableCategories.flatMap((category) => category.variables).find((item) => item.id === itemId) || null
}

function createFallbackRecipeVariableItem(id: string, multiple: boolean): RecipeVariableItem {
  return {
    id,
    name: { zh: id, en: id },
    candidates: { zh: [], en: [] },
    multiple,
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

function decoratePromptTokensForMarkdown(markdown: string, t: WorkbenchCopy, locale: Locale) {
  return markdown.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const label = resolvePromptTokenPresentation(token, t, locale).label
    return `[${escapeMarkdownLinkLabel(label)}](ccks-token:${encodeURIComponent(token)})`
  })
}

function resolvePromptTokenPresentation(token: string, t: WorkbenchCopy, locale: Locale) {
  const parsed = parsePromptToken(token)
  if (!parsed) {
    return {
      label: token,
      tooltip: token,
      styleKey: 'unknown' as PromptTokenStyleKey,
    }
  }

  const styleKey = parsed.variableType || (parsed.tokenType === 'recipe' ? 'recipe' : 'unknown')
  const params = getPromptTokenParamMap(parsed.params)
  const recipeItem = parsed.tokenType === 'recipe' ? findRecipeVariableItemById(params.source || '') : null
  const typeLabel = parsed.variableType
    ? t.variableTypes[parsed.variableType]
    : parsed.tokenType === 'recipe'
      ? recipeItem?.name[locale] || t.recipeVariableLabel
      : parsed.tokenType
  const label = `${typeLabel}:${parsed.name}`
  const detailLines = parsed.params.map((param) => formatPromptTokenParam(param, t, locale)).filter(Boolean)

  return {
    label,
    tooltip: [label, ...detailLines].join('\n'),
    styleKey,
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

function formatPromptTokenParam(param: string, t: WorkbenchCopy, locale: Locale) {
  const parsed = parsePromptTokenParam(param)
  if (!parsed) return param
  const label = t.promptTokenParams[parsed.key as keyof WorkbenchCopy['promptTokenParams']] || parsed.key
  const value =
    parsed.key === 'multi' && (parsed.value === 'true' || parsed.value === 'false')
      ? t.booleanText[parsed.value]
      : parsed.key === 'source'
        ? findRecipeVariableItemById(parsed.value)?.name[locale] || parsed.value
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
  return createDefaultWorkbenchLayout(rowCount).map((item) => ({ ...item, resizeHandles: RESIZE_HANDLES }))
}

function isWindowId(value: string): value is WindowId {
  return WINDOW_IDS.includes(value as WindowId)
}

function calculateGridRows(height: number) {
  if (!height) return 40
  return Math.max(DEFAULT_GRID_ROWS, Math.ceil((height - GRID_PADDING[1] * 2 + GRID_MARGIN[1]) / (GRID_ROW_HEIGHT + GRID_MARGIN[1])))
}

function buildRenderableLayout(layout: GridLayoutItem[], minimized: MinimizedState) {
  return layout.map((item) => ({
    ...item,
    isResizable: !minimized[item.i],
    resizeHandles: minimized[item.i] ? [] : RESIZE_HANDLES,
  }))
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

  return {
    ...item,
    x,
    y,
    w,
    h,
    minW,
    minH,
    resizeHandles: RESIZE_HANDLES,
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
