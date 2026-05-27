'use client'

import dynamic from 'next/dynamic'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
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
import {
  Background,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  SelectionMode,
  useNodeConnections,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge as ReactFlowEdge,
  type EdgeChange,
  type Node as ReactFlowNode,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tree } from 'react-arborist'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import dagre from '@dagrejs/dagre'
import {
  Bell,
  Boxes,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  AlertCircle,
  Bot,
  Copy,
  Database,
  Download,
  FileInput,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  GitMerge,
  Hand,
  Home,
  LayoutGrid,
  ListFilter,
  LogOut,
  Mail,
  Maximize2,
  Merge,
  MessageSquare,
  Minus,
  MessageSquareWarning,
  MousePointer2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Route,
  Save,
  Search,
  Send,
  Settings,
  Shuffle,
  Split,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  Timer,
  Variable,
  Webhook,
  Workflow,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
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
import { CommonAiProviderManager } from '@/components/common-ai-provider-manager'
import { PortalBackground } from '@/components/portal-background'
import { cn } from '@/lib/utils'
import {
  AI_PROVIDER_PRESETS,
  aiModelSupportsReferenceFile,
  aiModelSupportsReferenceImage,
  aiModelSupportsThinking,
  applyAiModelPreset,
  createAiModelPresetRef,
  defaultAiResponseConfig,
  findAiModelPresetOption,
  getAiModelPresetOptionKeyForModel,
  getImageAspectRatioOptions,
  getImageSizeForResolution,
  inferAiProviderTypeFromBaseUrl,
  listAiModelPresetOptions,
  normalizeAiModelPromptSurface,
  normalizeAiResponseConfig,
  normalizeAiModelPresetRef,
  resolveAiModelPromptSurface,
  resolveAiModelParameterSchema,
  ZPMT_OUTPUT_TYPES,
  type AiModelPromptSurface,
  type AiModelParameterSchema,
  type ImageStyleInputType,
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
  promptKind?: 'chat' | 'agent' | 'image'
  children?: TreeNode[]
}

type ProjectEntryConflict = {
  path: string
  targetPath: string
}
type ProjectEntryMove = {
  oldPath: string
  nextPath: string
}
type ProjectUploadEntry = {
  file: File
  relativePath: string
}
type ProjectEntryDragPayload = {
  kind: 'project-entry'
  projectId: string
  paths: string[]
}
type ZpmtFileDragEntry = {
  path: string
  promptKind?: ZpmtPromptKind
}
type ZpmtFileDragPayload = {
  kind: 'zpmt-files'
  projectId: string
  files: ZpmtFileDragEntry[]
  paths?: string[]
}
type ZipImportDialogState = {
  file: File
  name: string
  fileName: string
  busy: boolean
}
type ProjectConflictAction = 'overwrite' | 'skip' | 'cancel'

type BrowserFileSystemEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void
  createReader?: () => {
    readEntries: (successCallback: (entries: BrowserFileSystemEntry[]) => void, errorCallback?: (error: DOMException) => void) => void
  }
}

type VariableType = 'string' | 'number' | 'array' | 'color' | 'boolean' | 'image' | 'file'
type VariableTokenType = 'str' | 'num' | 'arr' | 'color' | 'bool' | 'img' | 'file'
const ARRAY_ITEM_TYPES = ['string', 'number', 'boolean', 'object'] as const
type ArrayItemType = (typeof ARRAY_ITEM_TYPES)[number]
type PromptTokenStyleKey = VariableType | 'recipe' | 'constant' | 'unknown'
type ZpmtPromptKind = 'chat' | 'agent' | 'image'

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
type ConstantInstructionItem = {
  id: ZpmtConstantKind
  name: LocalizedText
  description: LocalizedText
  tokenName: LocalizedText
}
type ZpmtConstantKind = 'now' | 'today' | 'time' | 'weekday' | 'iso' | 'timestamp' | 'uuid' | 'shortId'
type InstructionCategoryKind = 'recipe' | 'tool'
type PromptTemplateBuildContext = {
  categories: RecipeVariableCategory[]
}
type PromptTemplateContent = {
  system?: string
  user?: string
  prompt?: string
  negativePrompt?: string
  styleText?: string
}
type PromptTemplateDefinition = {
  id: string
  kind: ZpmtPromptKind
  categoryId: string
  categoryName: LocalizedText
  name: LocalizedText
  description: LocalizedText
  preview: LocalizedText
  build: (context: PromptTemplateBuildContext) => PromptTemplateContent
}
type EditorMode = 'normal' | 'preview' | 'assist' | 'source' | 'run'
type StandardEditorMode = Exclude<EditorMode, 'run'>
type PromptFileType = Extract<ZpmtPromptKind, 'chat' | 'agent'>
type ZpmtSectionKey = 'config' | 'system' | 'user' | 'prompt' | 'negativePrompt' | 'style'
type ZpmtPromptSectionKey = Extract<ZpmtSectionKey, 'system' | 'user' | 'prompt' | 'negativePrompt' | 'style'>
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
  | { kind: 'constant'; item: ConstantInstructionItem }
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
  account?: string | null
  email: string | null
  avatar: string | null
}
type AdminSession = {
  name: string
  account: string | null
  email: string | null
  userId: string
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
  | { mode: 'zflow'; folder: TreeNode; name: string }
  | { mode: 'lexicon'; folder: TreeNode; name: string }
  | { mode: 'provider'; folder: TreeNode; name: string }
  | {
      mode: 'prompt'
      folder: TreeNode
      name: string
      promptKind: ZpmtPromptKind
      outputType: ZpmtOutputType
      providerId: string
      model: string
      responseConfig: ZpmtResponseConfig
    }
  | { mode: 'rename'; node: TreeNode; name: string }

type ZpmtDocument = {
  schema: 'ccks.zpmt'
  version: 3
  kind: ZpmtPromptKind
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
  prompt: string
  negativePrompt: string
  style: ZpmtImageStyle
  tools: ZpmtToolInstruction[]
  metadata: ZpmtRecipeVariableMetadata
}
type ZpmtImageStyle = {
  mode: ImageStyleInputType
  value: string
  extraText: string
}
type ZpmtTestVariable = {
  key: string
  token: string
  name: string
  label: string
  typeLabel: string
  variableType?: VariableType
  mediaKind?: 'image' | 'file'
  defaultValue: string
  source?: string
  recipe?: {
    candidates: string[]
    defaultValues: string[]
    multiple: boolean
  }
}
type ZpmtTestMediaFile = {
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}
type PromptTestPanelState = {
  activeTab: string
  variableValues: Record<string, string>
  variableErrors: Record<string, string>
  mediaVariableValues: Record<string, ZpmtTestMediaFile[]>
  maxToolRounds: number
  runLoading: boolean
  randomLoading: boolean
  runResponse: Record<string, unknown> | null
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
  promptSurface?: unknown
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
type ZflowNodeCategoryId = 'control' | 'integration' | 'notification' | 'start'
type ZflowNodeRuntime = 'branch' | 'transform' | 'notify' | 'start' | 'terminal'
type ZflowPortValueType = 'any' | 'string' | 'number' | 'text' | 'object' | 'array' | 'color' | 'boolean' | 'image' | 'file' | 'error'
type ZflowNodePort = {
  id: string
  label: string
  valueType?: ZflowPortValueType
}
type ZflowNodeData = Record<string, unknown> & {
  label: string
  description?: string
  category?: ZflowNodeCategoryId
  nodeType?: string
  kind?: string
  icon?: string
  runtime?: ZflowNodeRuntime
  inputs?: ZflowNodePort[]
  outputs?: ZflowNodePort[]
  inputPorts?: ZflowNodePort[]
  outputPorts?: ZflowNodePort[]
  outputData?: ZflowNodePort[]
  config?: Record<string, unknown>
}
type ZflowInputBindingMode = 'value' | 'source'
type ZflowInputBinding = {
  mode?: ZflowInputBindingMode
  value?: string
  values?: string[]
  sourceNodeId?: string
  sourceHandle?: string
  sourceOutputId?: string
  sourcePath?: string
  valueType?: ZflowPortValueType
}
type ZflowConditionMode = 'all' | 'any'
type ZflowConditionOperator = 'eq' | 'neq' | 'empty' | 'notEmpty' | 'gt' | 'gte' | 'lt' | 'lte'
type ZflowConditionRule = {
  id: string
  sourceNodeId: string
  sourceOutputId: string
  operator: ZflowConditionOperator
  value: string
}
type ZflowConditionConfig = {
  conditionMode: ZflowConditionMode
  conditions: ZflowConditionRule[]
}
type ZflowInputBindingItem = {
  key: string
  label: string
  typeLabel: string
  valueType: ZflowPortValueType
  defaultValue: string
  recipe?: { candidates: string[]; defaultValues: string[]; multiple: boolean }
}
type ZflowInputBindingStatusKind = 'loading' | 'error' | 'empty'
type ZflowInputBindingView = {
  items: ZflowInputBindingItem[]
  status?: ZflowInputBindingStatusKind
}
type ZflowPromptRunVariableSnapshot =
  | { status: 'ready'; items: ZflowInputBindingItem[] }
  | { status: ZflowInputBindingStatusKind; items: [] }
type ZflowUpstreamOutputOption = {
  id: string
  nodeId: string
  outputId: string
  sourcePath: string
  nodeLabel: string
  label: string
  valueType: ZflowPortValueType
  imageCollection?: boolean
}
type ZflowPromptFileCacheEntry = {
  content?: string
  error?: string
}
type ZflowNode = ReactFlowNode<ZflowNodeData>
type ZflowEdgeData = Record<string, unknown> & {
  invalid?: boolean
  invalidReason?: string
  sourceType?: ZflowPortValueType
  targetType?: ZflowPortValueType
}
type ZflowEdge = ReactFlowEdge<ZflowEdgeData>
type ZflowDocument = {
  schema: 'ccks.zflow.langgraph'
  version: number
  nodes: ZflowNode[]
  edges: ZflowEdge[]
  viewport: Viewport
}
const ZFLOW_NODE_WIDTH = 188
const ZFLOW_NODE_HEIGHT = 88
const ZFLOW_SNAP_GRID: [number, number] = [24, 24]
const ZFLOW_ALIGNMENT_THRESHOLD_PX = 8
const ZFLOW_START_NODE_ID = 'start'
const ZFLOW_START_NODE_TYPE = 'start'
const ZFLOW_SCHEMA = 'ccks.zflow.langgraph'
const ZFLOW_START_OUTPUT_TYPES: ZflowPortValueType[] = ['string', 'number', 'array', 'color', 'boolean', 'image', 'file']
const ZFLOW_START_FLOW_PORT: ZflowNodePort = { id: 'out', label: '输出', valueType: 'any' }
const ZFLOW_CONDITION_OUTPUT_PORTS: ZflowNodePort[] = [
  { id: 'true', label: '符合条件 true', valueType: 'any' },
  { id: 'false', label: '不符合条件 false', valueType: 'any' },
]
const ZFLOW_CONDITION_OPERATORS: ZflowConditionOperator[] = ['eq', 'neq', 'empty', 'notEmpty', 'gt', 'gte', 'lt', 'lte']
type ZflowNodeTemplatePort = {
  id: string
  label: LocalizedText
  valueType?: ZflowPortValueType
}
type ZflowNodeTemplate = {
  id: string
  category: ZflowNodeCategoryId
  label: LocalizedText
  description: LocalizedText
  icon: LucideIcon
  iconName: string
  runtime: ZflowNodeRuntime
  inputs: ZflowNodeTemplatePort[]
  outputs: ZflowNodeTemplatePort[]
  config?: Record<string, unknown>
}
type ZflowNodeCategoryDefinition = {
  id: ZflowNodeCategoryId
  label: LocalizedText
  icon: LucideIcon
}
type ZflowInteractionMode = 'pan' | 'select'
type ZflowAlignmentGuide = {
  id: string
  axis: 'x' | 'y'
  position: number
  start: number
  end: number
}
type ZflowPromptKindByPath = Record<string, ZpmtPromptKind | undefined>
type ZflowClipboardPayload = {
  nodes: ZflowNode[]
  edges: ZflowEdge[]
  pasteCount: number
}
type ZflowRunPanelTab = 'input' | 'monitor'
type ZflowRunNodeStatus = 'running' | 'success' | 'error'
type ZflowRunInputValues = Record<string, string | ZpmtTestMediaFile[]>
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
const TAG_NAME_PATTERN = /^[\p{L}\p{N}_-]{1,64}$/u
const ALL_ZPMT_MODEL_CAPABILITIES: ZpmtModelCapabilityGate = {
  supportsTools: true,
  supportsReferenceImage: true,
  supportsReferenceFile: true,
}

const ZPMT_CONSTANTS: ConstantInstructionItem[] = [
  {
    id: 'now',
    name: { zh: '当前日期时间', en: 'Current date and time' },
    tokenName: { zh: '当前时间', en: 'currentTime' },
    description: { zh: '自动渲染为当前本地日期和时间。', en: 'Automatically renders the current local date and time.' },
  },
  {
    id: 'today',
    name: { zh: '当前日期', en: 'Current date' },
    tokenName: { zh: '当前日期', en: 'currentDate' },
    description: { zh: '自动渲染为当前本地日期。', en: 'Automatically renders the current local date.' },
  },
  {
    id: 'time',
    name: { zh: '当前时间', en: 'Current time' },
    tokenName: { zh: '当前时刻', en: 'currentClock' },
    description: { zh: '自动渲染为当前本地时分秒。', en: 'Automatically renders the current local clock time.' },
  },
  {
    id: 'weekday',
    name: { zh: '当前星期', en: 'Current weekday' },
    tokenName: { zh: '当前星期', en: 'currentWeekday' },
    description: { zh: '自动渲染为当前星期。', en: 'Automatically renders the current weekday.' },
  },
  {
    id: 'iso',
    name: { zh: 'ISO 时间', en: 'ISO time' },
    tokenName: { zh: 'ISO时间', en: 'isoTime' },
    description: { zh: '自动渲染为 ISO 8601 时间戳。', en: 'Automatically renders an ISO 8601 timestamp.' },
  },
  {
    id: 'timestamp',
    name: { zh: 'Unix 时间戳', en: 'Unix timestamp' },
    tokenName: { zh: '时间戳', en: 'timestamp' },
    description: { zh: '自动渲染为毫秒级时间戳。', en: 'Automatically renders the millisecond timestamp.' },
  },
  {
    id: 'uuid',
    name: { zh: 'UUID', en: 'UUID' },
    tokenName: { zh: 'UUID', en: 'uuid' },
    description: { zh: '每次测试渲染时生成一个 UUID。', en: 'Generates a UUID on each test render.' },
  },
  {
    id: 'shortId',
    name: { zh: '短随机 ID', en: 'Short random ID' },
    tokenName: { zh: '短ID', en: 'shortId' },
    description: { zh: '每次测试渲染时生成一个短随机标识。', en: 'Generates a short random id on each test render.' },
  },
]

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
const PROMPT_FILE_TYPES: PromptFileType[] = ['chat', 'agent']
const ZPMT_PROMPT_EDITOR_MIN_HEIGHT = 160
const COMMON_AI_PROVIDER_ID_PREFIX = 'common:'
const PROJECT_ENTRY_DRAG_MIME = 'application/x-ccks-project-entry'
const ZPMT_FILE_DRAG_MIME = 'application/x-ccks-zpmt-file'
const PROJECT_ARCHIVE_MIME = 'application/zip'
const ZFLOW_NODE_DRAG_MIME = 'application/x-ccks-zflow-node'

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
    settingsGeneral: '通用',
    settingsGeneralDesc: '管理工作台主题、语言和基础偏好。',
    commonProviderManagement: '通用供应商管理',
    commonProviderManagementDesc: '管理员维护的供应商可被所有用户选择，密钥只在服务端使用。',
    themeToDark: '暗色模式',
    themeToLight: '亮色模式',
    language: 'English',
    announcement: '公告',
    noAnnouncement: '暂无公告',
    feedback: '投诉建议',
    admin: '管理员',
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
    importZipProject: '导入 ZIP 项目',
    exportProjectZip: '导出项目 ZIP',
    downloadArchive: '打包下载',
    downloadSelected: '下载所选',
    uploadFiles: '上传文件',
    dropFilesHere: '拖入文件或文件夹上传到这里',
    moveHere: '移动到这里',
    zipImportTitle: '导入 ZIP 项目',
    zipFile: 'ZIP 文件',
    conflictCount: '发现 {count} 个同名冲突。',
    conflictOverwritePrompt: '确定覆盖冲突项？取消后可选择跳过冲突项。',
    conflictSkipPrompt: '是否跳过冲突项并继续处理其余内容？',
    uploadSuccess: '文件已上传',
    moveSuccess: '文件位置已更新',
    archiveDownloadFailed: '打包下载失败',
    zipImportSuccess: 'ZIP 项目已导入',
    noFilesToUpload: '没有可上传的文件',
    dragDownloadHint: '可拖到桌面下载；浏览器不支持时请使用右键打包下载。',
    fileList: '文件列表',
    sourceControl: '源代码管理',
    activity: {
      explorer: '文件列表',
      sourceControl: '源代码管理',
    },
    newFolder: '新建文件夹',
    newPromptFile: '新建提示词文件',
    newZflowFile: '新建流程画板',
    promptFileType: '提示词类型',
    simplePrompt: '文本提示词',
    agentPrompt: 'Agent 提示词',
    imagePromptFile: '图片提示词',
    outputType: '输出类型',
    aiProvider: 'AI 供应商',
    aiModel: '模型',
    responseConfig: '响应配置',
    noAiProvider: '暂无可用供应商，请先创建 .zamf 或联系管理员配置通用供应商',
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
    imageGenerateCount: '生成张数',
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
    projectProviderGroup: '项目供应商',
    commonProviderGroup: '通用供应商',
    providerUnavailable: '当前绑定的供应商不可用',
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
    variableName: '名称',
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
    imagePrompt: '主提示词',
    negativePrompt: '负面提示词',
    promptStyle: '风格描述',
    promptStylePreset: '风格预设',
    promptStyleExtra: '风格补充',
    unsupportedFieldUnused: '当前模型不支持，测试请求不会发送该字段',
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
    sourceCode: 'ccks 源码',
    zflowCanvas: '流程画板',
    zflowNodeCount: '{count} 个节点',
    zflowEdgeCount: '{count} 条连线',
    zflowNodePanel: '节点面板',
    zflowNodeList: '节点列表',
    zflowNodeEditor: '节点编辑',
    zflowNodeName: '节点名称',
    zflowNodeDescription: '节点说明',
    zflowNodeInputs: '输入',
    zflowNodeOutputs: '输出',
    zflowNodeInputPorts: '输入端点',
    zflowNodeOutputPorts: '输出端点',
    zflowNodeOutputData: '输出数据',
    zflowConditionRules: '判断条件',
    zflowConditionModeAll: '全部满足',
    zflowConditionModeAny: '任一满足',
    zflowConditionAddRule: '新增条件',
    zflowConditionSourceNode: '前置节点',
    zflowConditionSourceVariable: '变量',
    zflowConditionValue: '比较值',
    zflowConditionOperators: {
      eq: '等于',
      neq: '不等于',
      empty: '为空',
      notEmpty: '不为空',
      gt: '大于',
      gte: '大于等于',
      lt: '小于',
      lte: '小于等于',
    },
    zflowStartNode: '起点',
    zflowStartNodeDescription: '流程自带起点，不能删除。通过输出定义用户提交给流程的输入变量。',
    zflowStartAddOutput: '新增输出',
    zflowBranchAddPort: '新增端点',
    zflowOutputName: '输出名称',
    zflowOutputType: '输出类型',
    zflowStats: '{nodes} 节点 / {edges} 连线',
    zflowToolbarMove: '移动画布',
    zflowToolbarSelect: '框选节点',
    zflowToolbarAutoLayout: '自动整理',
    zflowToolbarFitView: '适配视图',
    zflowToolbarZoomIn: '放大',
    zflowToolbarZoomOut: '缩小',
    zflowEdgeInvalid: '类型不兼容，无法连接',
    zflowTypeLabels: {
      any: '任意',
      string: '字符串',
      number: '数值',
      text: '文本',
      object: '对象',
      array: '数组',
      color: '颜色',
      boolean: '布尔',
      image: '图片',
      file: '文件',
      error: '错误',
    },
    aiAssist: {
      title: 'AI辅助',
      status: '开发中，敬请期待',
      items: ['补充变量默认值说明', '检查 CTA 链接是否存在', '为核心能力增加结构化输出约束'],
      action: '生成优化建议',
    },
    bottomTabs: ['测试面板', '运行结果', '测试用例', '性能分析'],
    success: '成功',
    tokens: '令牌 1,245（输入 528 / 输出 717）',
    heroTitle: 'ccks',
    heroDesc: '新时代 AI 代码编辑工具以及编辑框架',
    coreTitle: '核心能力',
    coreItems: [
      '智能生成：通过自然语言生成高质量网页内容与结构',
      '可视化管理：页面、内容、数据一站式管理',
      '强大集成：丰富的工具与API，扩展无限可能',
    ],
    cta: '立即体验',
    inspectorTabs: ['变量', '配方变量', '模板', '工具'],
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
    constantVariableLabel: '常量',
    constantVariables: '常量',
    constantVariableEmpty: '没有可用常量',
    constantVariableHint: '拖拽后自动渲染，不会出现在测试变量里。',
    insertInstructionTag: '插入指令标签',
    instructionName: '名称',
    instructionNamePlaceholder: '例如 标题 / heroTitle',
    defaultValue: '默认值',
    noDefaultValue: '不设置默认值',
    editTag: '编辑标签',
    saveTag: '保存标签',
    textLength: '文本长度',
    numberRange: '数值范围',
    arrayType: '数组类型',
    selectArrayType: '选择数组类型',
    arrayTypeRequired: '请选择数组类型',
    arrayItemTypes: {
      string: '字符串数组',
      number: '数值数组',
      boolean: '布尔数组',
      object: '对象数组',
    },
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
      itemType: '数组类型',
      count: '数量',
      size: '文件大小',
      kind: '类型',
    },
    booleanText: {
      true: '是',
      false: '否',
    },
    cancel: '取消',
    close: '关闭',
    insertTag: '插入标签',
    tagNameInvalid: '名称可使用中文、英文、数字、下划线或连字符，长度 1-64 个字符',
    tagNameDuplicate: '名称已存在，请重新输入',
    tagInfoRequired: '请填写必要信息',
    fixedTools: '已绑定工具',
    configureTool: '绑定工具',
    bindTool: '绑定工具',
    toolBindingConfig: '运行配置',
    toolBindingNoConfig: '该工具没有需要预先填写的运行配置。确认后，AI 会在调用时提供参数。',
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
    toolConfigRequired: '请填写必填运行配置',
    downloadFile: '下载文件',
    generatedFile: '生成文件',
    duration: '耗时',
    runAgent: '运行测试',
    generateImage: '生成图片',
    runningAgent: '运行中',
    agentRunNoFile: '打开 .zpmt 文件后可运行测试',
    agentRunNoProvider: '请先绑定供应商和模型',
    agentRunSuccess: '测试运行成功',
    agentRunFailed: '测试运行失败',
    testVariables: '测试变量',
    testVariableEmpty: '当前提示词没有变量',
    testValue: '测试值',
    requiredVariable: '必填',
    addArrayItem: '添加一项',
    removeArrayItem: '删除项',
    arrayItemPlaceholder: '数组项',
    compactEdit: '点击编辑',
    selectedCount: '已选 {count} 项',
    emptySelected: '未选择',
    editArrayValues: '编辑数组值',
    editMultiValues: '编辑多选值',
    extractPromptContent: '提取提示词内容',
    extractPromptContentTitle: '提取提示词内容',
    extractPromptContentHint: '复制内容包含当前区域完整提示词和识别到的变量清单。',
    copyExtractedPromptContent: '复制内容',
    copiedToClipboard: '已复制到剪切板',
    extractionVariables: '变量清单',
    extractionNoVariables: '未识别到变量',
    generatingImage: '图片生成中',
    thinkingOutput: '思考内容',
    toolEvents: '工具过程',
    runFailedReason: '失败原因',
    streamDisconnected: '流式连接中断',
    uploadMedia: '上传文件',
    replaceMedia: '重新选择',
    removeMedia: '移除',
    uploadedMedia: '已上传',
    mediaUploadHint: '仅用于本次测试，不会保存到项目。',
    mediaReadFailed: '文件读取失败，请重新选择',
    mediaInvalidType: '请选择图片文件',
    mediaTooLarge: '文件超过变量大小限制',
    mediaCountExceeded: '选择的文件数量超过变量限制',
    mediaUnsupportedByModel: '当前模型不支持该媒体变量',
    runSettings: '运行设置',
    maxToolRounds: '工具调用最大循环',
    maxToolRoundsHint: '0 表示不执行工具调用；运行时可调整。',
    assistantOutput: 'AI 输出',
    generatedImages: '生成图片',
    previewImage: '放大预览',
    downloadImage: '下载图片',
    requestPreview: '请求预览',
    noAgentOutput: '暂无运行结果',
    renderedPrompt: '渲染后的提示词',
    removeTool: '移除工具',
    recipeVariableSearch: '搜索分类、变量或候选字段',
    recipeVariableEmpty: '没有匹配的配方变量',
    recipeVariableModes: {
      multi: '可多选',
      single: '单选',
    },
    promptTemplateSearch: '搜索分类、模板或说明',
    promptTemplateEmpty: '没有匹配的模板',
    promptTemplateNoFile: '打开 .zpmt 文件后可使用模板',
    promptTemplateReplaceConfirm: '确认用模板「{name}」替换当前编辑区内容？当前文件会变为未保存状态。',
    promptTemplateApply: '使用模板',
    promptTemplatePreview: '替换内容',
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
      hint: 'ccks 工作台 · 当前为本地 mock 数据',
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
    settingsGeneral: 'General',
    settingsGeneralDesc: 'Manage workbench theme, language, and basic preferences.',
    commonProviderManagement: 'Common provider management',
    commonProviderManagementDesc: 'Admin-managed providers are available to all users. Secrets stay server-side.',
    themeToDark: 'Dark mode',
    themeToLight: 'Light mode',
    language: '中文',
    announcement: 'Announcements',
    noAnnouncement: 'No announcements',
    feedback: 'Feedback',
    admin: 'Admin',
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
    importZipProject: 'Import ZIP project',
    exportProjectZip: 'Export project ZIP',
    downloadArchive: 'Download archive',
    downloadSelected: 'Download selected',
    uploadFiles: 'Upload files',
    dropFilesHere: 'Drop files or folders here to upload',
    moveHere: 'Move here',
    zipImportTitle: 'Import ZIP project',
    zipFile: 'ZIP file',
    conflictCount: '{count} name conflicts found.',
    conflictOverwritePrompt: 'Overwrite conflicting items? Cancel to choose whether to skip them.',
    conflictSkipPrompt: 'Skip conflicting items and continue with the rest?',
    uploadSuccess: 'Files uploaded',
    moveSuccess: 'File locations updated',
    archiveDownloadFailed: 'Archive download failed',
    zipImportSuccess: 'ZIP project imported',
    noFilesToUpload: 'No files to upload',
    dragDownloadHint: 'Drag to desktop to download; use right-click archive download if unsupported by your browser.',
    fileList: 'Files',
    sourceControl: 'Source Control',
    activity: {
      explorer: 'Files',
      sourceControl: 'Source Control',
    },
    newFolder: 'New folder',
    newPromptFile: 'New prompt file',
    newZflowFile: 'New flow canvas',
    promptFileType: 'Prompt type',
    simplePrompt: 'Text prompt',
    agentPrompt: 'Agent prompt',
    imagePromptFile: 'Image prompt',
    outputType: 'Output type',
    aiProvider: 'AI provider',
    aiModel: 'Model',
    responseConfig: 'Response config',
    noAiProvider: 'No providers available. Create a .zamf file or ask an admin to configure a common provider.',
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
    imageGenerateCount: 'Image count',
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
    projectProviderGroup: 'Project providers',
    commonProviderGroup: 'Common providers',
    providerUnavailable: 'The bound provider is unavailable',
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
    variableName: 'Name',
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
    imagePrompt: 'Main prompt',
    negativePrompt: 'Negative prompt',
    promptStyle: 'Style notes',
    promptStylePreset: 'Style preset',
    promptStyleExtra: 'Style extra',
    unsupportedFieldUnused: 'The current model does not support this field; it will not be sent in tests.',
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
    sourceCode: 'ccks Source',
    zflowCanvas: 'Flow canvas',
    zflowNodeCount: '{count} nodes',
    zflowEdgeCount: '{count} edges',
    zflowNodePanel: 'Node panel',
    zflowNodeList: 'Node list',
    zflowNodeEditor: 'Node editor',
    zflowNodeName: 'Node name',
    zflowNodeDescription: 'Description',
    zflowNodeInputs: 'Inputs',
    zflowNodeOutputs: 'Outputs',
    zflowNodeInputPorts: 'Input ports',
    zflowNodeOutputPorts: 'Output ports',
    zflowNodeOutputData: 'Output data',
    zflowConditionRules: 'Conditions',
    zflowConditionModeAll: 'All',
    zflowConditionModeAny: 'Any',
    zflowConditionAddRule: 'Add condition',
    zflowConditionSourceNode: 'Upstream node',
    zflowConditionSourceVariable: 'Variable',
    zflowConditionValue: 'Compare value',
    zflowConditionOperators: {
      eq: 'Equals',
      neq: 'Not equals',
      empty: 'Is empty',
      notEmpty: 'Is not empty',
      gt: 'Greater than',
      gte: 'Greater or equal',
      lt: 'Less than',
      lte: 'Less or equal',
    },
    zflowStartNode: 'Start',
    zflowStartNodeDescription: 'Built-in flow start node. It cannot be deleted. Use outputs to define user input variables.',
    zflowStartAddOutput: 'Add output',
    zflowBranchAddPort: 'Add port',
    zflowOutputName: 'Output name',
    zflowOutputType: 'Output type',
    zflowStats: '{nodes} nodes / {edges} edges',
    zflowToolbarMove: 'Pan canvas',
    zflowToolbarSelect: 'Box select',
    zflowToolbarAutoLayout: 'Auto layout',
    zflowToolbarFitView: 'Fit view',
    zflowToolbarZoomIn: 'Zoom in',
    zflowToolbarZoomOut: 'Zoom out',
    zflowEdgeInvalid: 'Incompatible types. Connection blocked.',
    zflowTypeLabels: {
      any: 'Any',
      string: 'String',
      number: 'Number',
      text: 'Text',
      object: 'Object',
      array: 'Array',
      color: 'Color',
      boolean: 'Boolean',
      image: 'Image',
      file: 'File',
      error: 'Error',
    },
    aiAssist: {
      title: 'AI Assist',
      status: 'In development. Stay tuned.',
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
    inspectorTabs: ['Variables', 'Recipes', 'Templates', 'Tools'],
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
    constantVariableLabel: 'Constant',
    constantVariables: 'Constants',
    constantVariableEmpty: 'No constants available',
    constantVariableHint: 'Constants render automatically and are not shown as test variables.',
    insertInstructionTag: 'Insert instruction tag',
    instructionName: 'Name',
    instructionNamePlaceholder: 'e.g. 标题 / heroTitle',
    defaultValue: 'Default value',
    noDefaultValue: 'No default',
    editTag: 'Edit tag',
    saveTag: 'Save tag',
    textLength: 'Text length',
    numberRange: 'Number range',
    arrayType: 'Array type',
    selectArrayType: 'Select array type',
    arrayTypeRequired: 'Select an array type',
    arrayItemTypes: {
      string: 'String array',
      number: 'Number array',
      boolean: 'Boolean array',
      object: 'Object array',
    },
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
      itemType: 'Array type',
      count: 'Count',
      size: 'File size',
      kind: 'Kind',
    },
    booleanText: {
      true: 'Yes',
      false: 'No',
    },
    cancel: 'Cancel',
    close: 'Close',
    insertTag: 'Insert tag',
    tagNameInvalid: 'Use Chinese, English, numbers, underscores, or hyphens; 1-64 characters',
    tagNameDuplicate: 'Name already exists. Enter another name.',
    tagInfoRequired: 'Fill in the required information',
    fixedTools: 'Bound tools',
    configureTool: 'Bind tool',
    bindTool: 'Bind tool',
    toolBindingConfig: 'Run config',
    toolBindingNoConfig: 'This tool has no run config to fill in. After binding, the AI supplies call arguments at runtime.',
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
    toolConfigRequired: 'Fill in required run config',
    downloadFile: 'Download file',
    generatedFile: 'Generated file',
    duration: 'Duration',
    runAgent: 'Run test',
    generateImage: 'Generate image',
    runningAgent: 'Running',
    agentRunNoFile: 'Open a .zpmt file to run tests',
    agentRunNoProvider: 'Bind a provider and model first',
    agentRunSuccess: 'Test run succeeded',
    agentRunFailed: 'Test run failed',
    testVariables: 'Test variables',
    testVariableEmpty: 'The current prompt has no variables',
    testValue: 'Test value',
    requiredVariable: 'Required',
    addArrayItem: 'Add item',
    removeArrayItem: 'Remove item',
    arrayItemPlaceholder: 'Array item',
    compactEdit: 'Click to edit',
    selectedCount: '{count} selected',
    emptySelected: 'None selected',
    editArrayValues: 'Edit array values',
    editMultiValues: 'Edit multi-select values',
    extractPromptContent: 'Extract prompt content',
    extractPromptContentTitle: 'Extract prompt content',
    extractPromptContentHint: 'The copy includes this full prompt section and the detected variable list.',
    copyExtractedPromptContent: 'Copy content',
    copiedToClipboard: 'Copied to clipboard',
    extractionVariables: 'Variables',
    extractionNoVariables: 'No variables detected',
    generatingImage: 'Generating image',
    thinkingOutput: 'Thinking',
    toolEvents: 'Tool events',
    runFailedReason: 'Failure reason',
    streamDisconnected: 'Stream disconnected',
    uploadMedia: 'Upload file',
    replaceMedia: 'Choose again',
    removeMedia: 'Remove',
    uploadedMedia: 'Uploaded',
    mediaUploadHint: 'Used only for this test run; not saved to the project.',
    mediaReadFailed: 'Failed to read the file. Choose it again.',
    mediaInvalidType: 'Choose an image file',
    mediaTooLarge: 'File exceeds the variable size limit',
    mediaCountExceeded: 'Selected files exceed the variable limit',
    mediaUnsupportedByModel: 'The current model does not support this media variable',
    runSettings: 'Run settings',
    maxToolRounds: 'Max tool-call loops',
    maxToolRoundsHint: '0 disables tool calls; adjustable per run.',
    assistantOutput: 'AI output',
    generatedImages: 'Generated images',
    previewImage: 'Preview image',
    downloadImage: 'Download image',
    requestPreview: 'Request preview',
    noAgentOutput: 'No run result yet',
    renderedPrompt: 'Rendered prompt',
    removeTool: 'Remove tool',
    recipeVariableSearch: 'Search categories, variables, or candidates',
    recipeVariableEmpty: 'No matching recipe variables',
    recipeVariableModes: {
      multi: 'Multi-select',
      single: 'Single-select',
    },
    promptTemplateSearch: 'Search categories, templates, or descriptions',
    promptTemplateEmpty: 'No matching templates',
    promptTemplateNoFile: 'Open a .zpmt file to use templates',
    promptTemplateReplaceConfirm: 'Replace the current editor content with "{name}"? The current file will become unsaved.',
    promptTemplateApply: 'Use template',
    promptTemplatePreview: 'Replacement content',
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
      hint: 'ccks workbench · local mock data',
      portalReady: 'Portal configured',
      portalMissing: 'Portal missing',
      lineColumn: 'Ln 1, Col 1',
      encoding: 'UTF-8',
      mode: 'Markdown',
    },
  },
}

type WorkbenchCopy = (typeof UI_COPY)['zh']

const ZFLOW_INPUT_PORT: ZflowNodeTemplatePort = { id: 'in', label: { zh: '输入', en: 'Input' }, valueType: 'any' }
const ZFLOW_OUTPUT_PORT: ZflowNodeTemplatePort = { id: 'out', label: { zh: '输出', en: 'Output' }, valueType: 'any' }

const ZFLOW_NODE_CATEGORY_DEFINITIONS: ZflowNodeCategoryDefinition[] = [
  { id: 'control', label: { zh: '流程控制', en: 'Flow control' }, icon: Route },
  { id: 'integration', label: { zh: '提示词/接口', en: 'Prompts & APIs' }, icon: Webhook },
]

const ZFLOW_NODE_TEMPLATES: ZflowNodeTemplate[] = [
  {
    id: 'prompt',
    category: 'integration',
    label: { zh: '提示词执行', en: 'Prompt' },
    description: { zh: '引用 .zpmt 并把变量绑定到 state。', en: 'Runs a .zpmt prompt with state bindings.' },
    icon: MessageSquare,
    iconName: 'message-square',
    runtime: 'transform',
    inputs: [{ ...ZFLOW_INPUT_PORT, valueType: 'any' }],
    outputs: [{ ...ZFLOW_OUTPUT_PORT, valueType: 'text' }],
    config: { filePath: '', outputPath: 'result', bindings: {} },
  },
  {
    id: 'http',
    category: 'integration',
    label: { zh: '接口请求', en: 'HTTP API' },
    description: { zh: '定义 GET/POST URL、输入和输出变量。', en: 'Defines GET/POST URL, input and output.' },
    icon: Webhook,
    iconName: 'webhook',
    runtime: 'transform',
    inputs: [{ ...ZFLOW_INPUT_PORT, valueType: 'any' }],
    outputs: [{ ...ZFLOW_OUTPUT_PORT, valueType: 'object' }],
    config: { method: 'GET', url: '', headers: '', body: '', outputPath: 'response' },
  },
  {
    id: 'router',
    category: 'control',
    label: { zh: '条件路由', en: 'Router' },
    description: { zh: '按 state 条件路由到 true 或 false 分支。', en: 'Routes to true or false by state condition.' },
    icon: Route,
    iconName: 'route',
    runtime: 'branch',
    inputs: [{ ...ZFLOW_INPUT_PORT, valueType: 'any' }],
    outputs: [
      { id: 'true', label: { zh: '符合条件 true', en: 'Matched true' }, valueType: 'any' },
      { id: 'false', label: { zh: '不符合条件 false', en: 'Unmatched false' }, valueType: 'any' },
    ],
    config: { left: '{{result}}', operator: 'notEmpty', right: '' },
  },
  {
    id: 'parallel-merge',
    category: 'control',
    label: { zh: '并发合并', en: 'Parallel merge' },
    description: { zh: '等待多个上游分支全部完成后继续。', en: 'Waits for all upstream branches before continuing.' },
    icon: GitMerge,
    iconName: 'git-merge',
    runtime: 'branch',
    inputs: [{ ...ZFLOW_INPUT_PORT, valueType: 'any' }],
    outputs: [{ ...ZFLOW_OUTPUT_PORT, valueType: 'any' }],
    config: { outputPath: '' },
  },
  {
    id: 'end',
    category: 'control',
    label: { zh: '结束节点', en: 'End' },
    description: { zh: '流程终点，接收输入后结束当前流程。', en: 'Terminates the current flow after receiving input.' },
    icon: CheckCircle2,
    iconName: 'check-circle',
    runtime: 'terminal',
    inputs: [{ ...ZFLOW_INPUT_PORT, valueType: 'any' }],
    outputs: [],
    config: {},
  },
]

const ZFLOW_NODE_ICON_MAP: Record<string, LucideIcon> = {
  alert: MessageSquareWarning,
  bell: Bell,
  braces: Braces,
  'check-circle': CheckCircle2,
  database: Database,
  'file-input': FileInput,
  'git-merge': GitMerge,
  'list-filter': ListFilter,
  mail: Mail,
  merge: Merge,
  'message-square': MessageSquare,
  'message-warning': MessageSquareWarning,
  play: Play,
  repeat: Repeat2,
  route: Route,
  send: Send,
  shuffle: Shuffle,
  split: Split,
  timer: Timer,
  'user-round': UserRound,
  variable: Variable,
  webhook: Webhook,
  workflow: Workflow,
  'wand-sparkles': WandSparkles,
  zap: Zap,
}

const ZFLOW_LEGACY_KIND_TEMPLATE_IDS: Record<string, string> = {
  input: ZFLOW_START_NODE_TYPE,
  'manual-trigger': ZFLOW_START_NODE_TYPE,
  'user-input-trigger': ZFLOW_START_NODE_TYPE,
  'schedule-trigger': ZFLOW_START_NODE_TYPE,
  'file-trigger': ZFLOW_START_NODE_TYPE,
  'api-trigger': ZFLOW_START_NODE_TYPE,
  prompt: 'prompt',
  variable: 'state',
  test: ZFLOW_START_NODE_TYPE,
  review: 'notify-inapp',
}

const promptCode = `---
title: "ccks"
description: "新时代 AI 代码编辑工具以及编辑框架"
layout: "base"
version: "1.2.0"
updated_at: "{{ now }}"
tags: ["首页", "营销"]
---

# {{ site.title }}
### {{ site.description }}

ccks，帮助团队以更高效率创建、编辑和管理 AI 代码项目。

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

const PROMPT_TEMPLATES: PromptTemplateDefinition[] = [
  {
    id: 'text-long-article',
    kind: 'chat',
    categoryId: 'text-writing',
    categoryName: { zh: '内容写作', en: 'Content Writing' },
    name: { zh: '长文文章', en: 'Long-form article' },
    description: { zh: '适合公众号、博客、知识文章和观点稿。', en: 'For WeChat articles, blogs, knowledge posts, and opinion pieces.' },
    preview: { zh: '含标题、导语、正文、结尾、摘要和事实边界。', en: 'Includes title, lead, body, ending, abstract, and factual boundaries.' },
    build: (context) => ({
      system: `你是一名资深中文长文编辑，负责把零散主题和资料整理成可直接发布的完整文章。你必须先判断资料可信度，再组织观点和叙事，不得编造未提供的数据、人物、案例或引用。\n\n写作变量：\n- 文本类型：${templateRecipeToken(context, 'text-type')}\n- 目标读者：${templateRecipeToken(context, 'target-audience')}\n- 写作语气：${templateRecipeToken(context, 'writing-tone')}\n- 内容结构：${templateRecipeToken(context, 'content-structure')}\n- 长度密度：${templateRecipeToken(context, 'length-density')}\n- 信息来源：${templateRecipeToken(context, 'source-handling')}\n- 输出格式：${templateRecipeToken(context, 'text-output-format')}\n- 禁用项：${templateRecipeToken(context, 'text-avoidance')}\n\n工作要求：\n1. 先提炼中心论点和读者收益，再展开正文。\n2. 事实、推断、建议要分开表达；资料不足时写明“待补充”。\n3. 每个小节都要有清晰主题句，避免空泛形容词堆叠。\n4. 保留可直接发布的标题、导语、正文和结尾，不输出写作过程。`,
      user: `请根据以下信息写一篇完整长文。\n\n主题：{{str:主题;length<120}}\n核心观点：{{str:核心观点;length<240}}\n目标读者补充：{{str:读者背景;length<300}}\n参考资料：{{str:素材资料;length<5000}}\n必须覆盖的要点：{{arr:关键点;itemType=string;length<10}}\n需要避免的表达：{{arr:避免表达;itemType=string;length<8}}\n\n输出结构：\n1. 标题备选 3 个。\n2. 一段 80-150 字导语，直接说明读者为什么要看。\n3. 正文，按 3-6 个二级标题组织，每节有结论和论据。\n4. 结尾，给出可执行建议或明确判断。\n5. 发布摘要，80 字以内。\n6. 事实边界，列出资料不足或需要核实的点。`,
    }),
  },
  {
    id: 'text-summary',
    kind: 'chat',
    categoryId: 'text-writing',
    categoryName: { zh: '内容写作', en: 'Content Writing' },
    name: { zh: '摘要提炼', en: 'Summary extraction' },
    description: { zh: '从长材料中提炼重点、结论和下一步。', en: 'Extracts key points, conclusions, and next steps from long material.' },
    preview: { zh: '输出 TL;DR、事实清单、行动项、风险和证据定位。', en: 'Outputs TL;DR, facts, actions, risks, and evidence pointers.' },
    build: (context) => ({
      system: `你是一名信息压缩与结构化整理助手。你只能基于用户提供的材料总结，不能补充外部知识或猜测事实。遇到材料冲突、缺失或无法判断的信息，必须单独标注。\n\n整理约束：\n- 信息来源：${templateRecipeToken(context, 'source-handling')}\n- 内容结构：${templateRecipeToken(context, 'content-structure')}\n- 长度密度：${templateRecipeToken(context, 'length-density')}\n- 输出格式：${templateRecipeToken(context, 'text-output-format')}\n- 文本禁用项：${templateRecipeToken(context, 'text-avoidance')}\n\n输出要求：保留高信息密度，删除重复铺垫；行动项必须包含负责人、动作和截止时间，缺失时写“待确认”。`,
      user: `请总结以下材料。\n\n材料标题：{{str:来源标题;length<120}}\n使用场景：{{str:总结目的;length<200}}\n原始材料：{{str:原始文本;length<8000}}\n重点关注：{{arr:关注点;itemType=string;length<8}}\n\n请按以下结构输出：\n1. TL;DR：用 1-2 句话说明核心结论。\n2. 关键事实：列出 5-10 条，只写材料中出现的信息。\n3. 结构化摘要：按主题分组，每组说明背景、结论、影响。\n4. 行动项表格：事项 / 负责人 / 截止时间 / 依赖 / 当前状态。\n5. 风险与不确定信息：标明冲突、缺失、待核实。\n6. 可追溯证据：为重要结论附上原文关键词或段落位置。`,
    }),
  },
  {
    id: 'text-product-copy',
    kind: 'chat',
    categoryId: 'marketing-copy',
    categoryName: { zh: '营销转化', en: 'Marketing Conversion' },
    name: { zh: '产品文案', en: 'Product copy' },
    description: { zh: '生成卖点清晰、面向转化的商品或服务文案。', en: 'Creates conversion-focused product or service copy.' },
    preview: { zh: '含标题、卖点、详情页、FAQ、CTA 和合规检查。', en: 'Includes headline, benefits, detail page, FAQ, CTA, and compliance check.' },
    build: (context) => ({
      system: `你是一名转化文案策划，擅长把产品参数、使用场景和用户痛点转成可信、具体、可直接上架的销售文案。不要使用绝对化承诺，不夸大功效，不编造认证、销量和评价。\n\n转化变量：\n- 核心卖点：${templateRecipeToken(context, 'selling-point')}\n- 购买动机：${templateRecipeToken(context, 'purchase-motivation')}\n- 促销语气：${templateRecipeToken(context, 'campaign-tone')}\n- 转化渠道：${templateRecipeToken(context, 'commerce-channel')}\n- 目标读者：${templateRecipeToken(context, 'target-audience')}\n- 文本禁用项：${templateRecipeToken(context, 'text-avoidance')}\n\n写作方法：先把参数翻译成用户收益，再把收益落到场景；每条卖点都要对应证据或使用理由。`,
      user: `请为以下产品生成可直接使用的转化文案。\n\n产品名称：{{str:产品名称;length<100}}\n目标人群：{{str:目标读者;length<200}}\n产品资料/参数：{{str:产品资料;length<2500}}\n核心卖点补充：{{arr:核心卖点;itemType=string;length<10}}\n使用场景：{{arr:使用场景;itemType=string;length<8}}\n价格/活动：{{str:优惠信息;length<200}}\n平台/渠道：{{str:发布渠道;length<120}}\n\n输出：\n1. 主标题 5 个，分别偏理性、场景、促销、品牌、短视频口播。\n2. 副标题 3 个，每个 20-35 字。\n3. 卖点卡片 5 条：卖点标题 / 用户收益 / 支撑证据。\n4. 详情页正文：开头痛点、产品方案、场景说明、购买理由。\n5. FAQ：至少 5 个真实购买疑问及回答。\n6. CTA：短按钮文案 5 个。\n7. 合规自检：列出可能夸大或缺证据的表达并给出替换建议。`,
    }),
  },
  {
    id: 'text-email-notice',
    kind: 'chat',
    categoryId: 'business-text',
    categoryName: { zh: '商务文本', en: 'Business Text' },
    name: { zh: '邮件通知', en: 'Email notice' },
    description: { zh: '生成清晰、礼貌、有行动指向的邮件或通知。', en: 'Creates clear, polite, action-oriented emails or notices.' },
    preview: { zh: '含邮件主题、正文、行动项、截止时间和跟进语。', en: 'Includes subject, body, action items, deadline, and follow-up text.' },
    build: (context) => ({
      system: `你是一名商务沟通编辑。你的邮件必须让收件人快速理解背景、影响、需要做什么、何时完成、如何反馈。语气礼貌但不绕弯，不使用情绪化表达。\n\n文本控制：\n- 目标读者：${templateRecipeToken(context, 'target-audience')}\n- 写作语气：${templateRecipeToken(context, 'writing-tone')}\n- 输出格式：${templateRecipeToken(context, 'text-output-format')}\n- 禁用项：${templateRecipeToken(context, 'text-avoidance')}\n\n要求：重要信息前置；复杂事项拆成清单；没有明确截止时间时标记“待确认”。`,
      user: `请撰写一封邮件/通知。\n\n邮件目的：{{str:用途;length<120}}\n收件人/对象：{{str:收件人;length<120}}\n背景：{{str:背景;length<1000}}\n需要对方完成的事项：{{arr:行动项;itemType=string;length<8}}\n截止时间：{{str:截止时间;length<80}}\n需要附带的资料/链接：{{arr:附件;itemType=string;length<6}}\n参考文件：{{file:参考文件;size<20MB}}\n补充说明：{{str:补充记录;length<1000}}\n\n输出：\n1. 邮件主题 3 个。\n2. 正文：称呼、背景、事项清单、截止时间、反馈方式、结束语。\n3. 极简版通知，适合发 IM 群。\n4. 跟进提醒文案，适合未回复时二次发送。`,
    }),
  },
  {
    id: 'text-prd-section',
    kind: 'chat',
    categoryId: 'business-text',
    categoryName: { zh: '商务文本', en: 'Business Text' },
    name: { zh: 'PRD 段落', en: 'PRD section' },
    description: { zh: '把需求描述整理为可评审的产品文档段落。', en: 'Turns requirements into reviewable product document sections.' },
    preview: { zh: '输出目标、范围、流程、字段、规则、异常和验收标准。', en: 'Outputs goal, scope, flow, fields, rules, failures, and acceptance criteria.' },
    build: (context) => ({
      system: `你是一名产品经理，负责把口语化需求整理成工程、设计和测试都能评审的 PRD 片段。不要擅自扩大范围；所有不确定信息必须显式标为“待确认”。\n\n结构偏好：${templateRecipeToken(context, 'content-structure')}\n信息来源：${templateRecipeToken(context, 'source-handling')}\n输出格式：${templateRecipeToken(context, 'text-output-format')}\n\n要求：\n1. 区分本期范围、非本期范围和后续扩展。\n2. 规则要写到可实现、可测试的颗粒度。\n3. 验收标准必须能被 QA 直接转成测试用例。`,
      user: `请整理以下需求为 PRD 段落。\n\n需求原文：{{str:需求原文;length<5000}}\n目标用户：{{str:用户角色;length<200}}\n业务目标：{{str:业务目标;length<300}}\n已有约束：{{arr:约束条件;itemType=string;length<10}}\n相关页面/模块：{{arr:相关模块;itemType=string;length<10}}\n\n输出结构：\n1. 背景与问题。\n2. 目标与成功指标。\n3. 本期范围 / 非本期范围。\n4. 用户故事。\n5. 主流程，按步骤描述触发、操作、系统响应和状态变化。\n6. 字段与规则表：字段 / 类型 / 必填 / 默认值 / 校验 / 权限。\n7. 边界与异常情况。\n8. 验收标准，使用 Given / When / Then。\n9. 待确认问题，按影响程度排序。`,
    }),
  },
  {
    id: 'text-meeting-notes',
    kind: 'chat',
    categoryId: 'business-text',
    categoryName: { zh: '商务文本', en: 'Business Text' },
    name: { zh: '会议纪要', en: 'Meeting notes' },
    description: { zh: '整理会议内容、决议、行动项和风险。', en: 'Organizes meeting content, decisions, action items, and risks.' },
    preview: { zh: '按议题、决议、行动项、风险、待确认问题整理。', en: 'Organizes topics, decisions, actions, risks, and open questions.' },
    build: (context) => ({
      system: `你是一名会议纪要助手。你只记录会议材料中出现的信息，不推断发言人意图，不补充不存在的决议。缺少负责人、截止时间或结论时写“待确认”。\n\n输出格式：${templateRecipeToken(context, 'text-output-format')}\n信息来源：${templateRecipeToken(context, 'source-handling')}\n长度密度：${templateRecipeToken(context, 'length-density')}\n\n要求：纪要要可执行，行动项必须从讨论内容中抽取，不要把普通讨论包装成决议。`,
      user: `请整理会议纪要。\n\n会议主题：{{str:会议主题;length<120}}\n参会人：{{arr:参会人;itemType=string;length<20}}\n会议记录/转写：{{str:会议记录;length<8000}}\n重点关注：{{arr:关注点;itemType=string;length<8}}\n\n输出结构：\n1. 会议概览：主题、时间、参会人、会议目的。\n2. 结论摘要：不超过 5 条。\n3. 议题记录：每个议题包含讨论要点、结论、分歧。\n4. 行动项表格：事项 / 负责人 / 协作人 / 截止时间 / 依赖 / 验收口径。\n5. 风险与阻塞。\n6. 待确认问题。\n7. 会后同步版：100 字以内，可直接发群。`,
    }),
  },
  {
    id: 'text-weekly-report',
    kind: 'chat',
    categoryId: 'business-text',
    categoryName: { zh: '商务文本', en: 'Business Text' },
    name: { zh: '周报', en: 'Weekly report' },
    description: { zh: '把零散进展整理为面向管理者的周报。', en: 'Turns scattered progress into a manager-facing weekly report.' },
    preview: { zh: '含本周成果、指标、风险、协同需求和下周计划。', en: 'Includes results, metrics, risks, collaboration needs, and next-week plan.' },
    build: (context) => ({
      system: `你是一名项目汇报编辑，负责把零散进展整理成管理者能快速判断进度、价值、风险和资源需求的周报。表达要具体，避免“持续推进、积极沟通”等空话。\n\n写作语气：${templateRecipeToken(context, 'writing-tone')}\n目标读者：${templateRecipeToken(context, 'target-audience')}\n文本禁用项：${templateRecipeToken(context, 'text-avoidance')}\n\n要求：成果要对应影响或数据；风险要说明影响、概率、责任人和缓解方案；下周计划要可验证。`,
      user: `请生成周报。\n\n汇报周期：{{str:周期;length<80}}\n本周完成：{{arr:已完成事项;itemType=string;length<12}}\n关键数据：{{str:指标;length<1200}}\n重要进展背景：{{str:背景;length<1000}}\n问题风险：{{arr:风险;itemType=string;length<10}}\n下周计划：{{arr:下步事项;itemType=string;length<10}}\n需要协同/决策：{{str:所需帮助;length<800}}\n\n输出：\n1. 一句话总览。\n2. 本周核心成果，按“事项 / 价值 / 证据”写。\n3. 数据变化，说明口径。\n4. 风险与阻塞，给出处理建议。\n5. 下周计划，按优先级排序。\n6. 需要上级或协作方支持的事项。\n7. 30 秒口头汇报版。`,
    }),
  },
  {
    id: 'text-storyboard-prompt-compiler',
    kind: 'chat',
    categoryId: 'visual-prompt',
    categoryName: { zh: '视觉提示词', en: 'Visual Prompts' },
    name: { zh: '故事转分镜提示词', en: 'Story to storyboard prompt' },
    description: { zh: '把故事梗概整理成可用于图片/视频关键帧生成的分镜提示词。', en: 'Turns a story brief into image/video keyframe prompts.' },
    preview: { zh: '从主体、环境、情绪弧线、镜头和关键帧输出分镜提示词。', en: 'Outputs storyboard prompts from subjects, setting, arc, camera, and keyframes.' },
    build: (context) => ({
      system: `你是一名预告片导演、摄影指导和分镜提示词编译器。你的任务不是直接生成图片，而是把故事、参考图和创意要求转成可执行的图像或视频关键帧提示词。\n\n视觉变量：\n- 画面风格：${templateRecipeToken(context, 'visual-style-direction')}\n- 镜头景别：${templateRecipeToken(context, 'shot-size')}\n- 拍摄角度：${templateRecipeToken(context, 'camera-angle')}\n- 光线：${templateRecipeToken(context, 'lighting')}\n- 色调：${templateRecipeToken(context, 'color-tone')}\n- 情绪氛围：${templateRecipeToken(context, 'mood')}\n- 质量描述：${templateRecipeToken(context, 'image-quality')}\n- 分镜流程：${templateRecipeToken(context, 'storyboard-workflow', ['场景拆解', '关键帧列表', '联络单输出'])}\n- 镜头字段：${templateRecipeToken(context, 'storyboard-shot-fields', ['镜头号', '建议时长', '镜头类型', '画面调度/动作'])}\n- 连续性约束：${templateRecipeToken(context, 'storyboard-continuity', ['角色身份一致', '服装道具一致', '轴线原则', '视线匹配'])}\n\n要求：\n1. 先拆解主体、环境、视觉锚点和叙事节拍。\n2. 每个关键帧必须有可画出来的动作、构图、镜头、光影和一致性要求。\n3. 不写无法视觉化的抽象句；需要抽象概念时转成可见符号。\n4. 输出的每帧提示词可以直接复制到图片模型或视频关键帧工作流。`,
      user: `请把以下故事整理成分镜提示词。\n\n故事梗概：{{str:故事梗概;length<3000}}\n参考图：{{img:参考图;count<=6}}\n参考图/角色说明：{{str:参考说明;length<1500}}\n目标时长或页数：{{str:目标时长或页数;length<120}}\n必须出现的元素：{{arr:必须出现;itemType=string;length<12}}\n需要避免的元素：{{arr:必须避免;itemType=string;length<12}}\n\n输出：\n1. 场景拆解：主体、环境、道具、光影、风格锚点。\n2. 故事主题和 4 段情绪弧线。\n3. 镜头策略：景别变化、相机运动、焦段和景深建议。\n4. 关键帧列表：默认 9-12 帧，每帧包含编号、时长、镜头类型、构图、动作、相机、光影、提示词。\n5. 一致性锁定：角色、服装、道具、背景、色调不能漂移的部分。\n6. 负面提示词：低质量、身份漂移、构图错误、文字错误等。`,
    }),
  },
  {
    id: 'text-image-prompt-optimizer',
    kind: 'chat',
    categoryId: 'visual-prompt',
    categoryName: { zh: '视觉提示词', en: 'Visual Prompts' },
    name: { zh: '图片提示词优化', en: 'Image prompt optimizer' },
    description: { zh: '把口语需求改写成结构完整、可直接使用的图片生成提示词。', en: 'Rewrites rough requests into complete image-generation prompts.' },
    preview: { zh: '输出主体、构图、材质、光影、用途、负面词和质量检查。', en: 'Outputs subject, composition, material, lighting, use, negatives, and QA.' },
    build: (context) => ({
      system: `你是一名图像提示词编译器和质量审查员。你要把用户的口语化需求整理成可直接提交给图片生成模型的提示词，并修复需求中的含糊、冲突和不可画内容。\n\n配方变量：\n- 主体类型：${templateRecipeToken(context, 'subject-type')}\n- 场景类型：${templateRecipeToken(context, 'scene-type')}\n- 构图：${templateRecipeToken(context, 'composition')}\n- 画面风格：${templateRecipeToken(context, 'visual-style-direction')}\n- 渲染方式：${templateRecipeToken(context, 'render-method')}\n- 质量描述：${templateRecipeToken(context, 'image-quality')}\n- 负面约束：${templateRecipeToken(context, 'negative-quality')}\n\n要求：输出必须可直接使用，不要只给建议；如果原始需求存在风险，先给“修正说明”，再给最终提示词。`,
      user: `请优化以下图片生成需求。\n\n原始需求：{{str:原始提示词;length<3000}}\n参考图：{{img:参考图;count<=4}}\n生成用途：{{str:使用方式;length<160}}\n画幅/比例：{{str:画幅比例;length<80}}\n必须保留：{{arr:必须保留;itemType=string;length<10}}\n需要去掉：{{arr:需要去掉;itemType=string;length<10}}\n\n输出：\n1. 修正说明：指出含糊、冲突或不可画内容。\n2. 最终正向提示词：按主体、动作、场景、构图、光影、材质、风格、质量排序。\n3. 负面提示词：质量问题、构图问题、身份漂移、文字错误等。\n4. 参数建议：比例、镜头、风格强度、参考图使用注意。\n5. 质量检查清单：生成后需要检查的 5-8 项。`,
    }),
  },
  {
    id: 'text-image-style-reverse-prompt',
    kind: 'chat',
    categoryId: 'visual-prompt',
    categoryName: { zh: '视觉提示词', en: 'Visual Prompts' },
    name: { zh: '参考图风格反推 Prompt', en: 'Reference style reverse prompt' },
    description: { zh: '人工整理自“提示词专家分析参考图并输出通用 Prompt”的样本。', en: 'Manually distilled from prompts that analyze a reference image and produce reusable prompts.' },
    preview: { zh: '先拆视觉风格、构图、色彩、材质和负面项，再输出可复用提示词。', en: 'Breaks down style, composition, color, material, and negatives, then outputs a reusable prompt.' },
    build: (context) => ({
      system: `你是一名顶级 AI 绘画提示词专家和视觉风格分析师。你要从用户提供的参考图、说明或旧提示词中提炼可复用的风格规律，而不是机械复述原文。必须区分“画面中实际存在的特征”和“可迁移的生成规则”。\n\n分析变量：\n- 信息来源：${templateRecipeToken(context, 'source-handling', ['仅基于提供材料', '区分事实与推断'])}\n- 画面风格：${templateRecipeToken(context, 'visual-style-direction')}\n- 构图：${templateRecipeToken(context, 'composition')}\n- 光线：${templateRecipeToken(context, 'lighting')}\n- 色调：${templateRecipeToken(context, 'color-tone')}\n- 材质：${templateRecipeToken(context, 'material')}\n- 纸张/印刷质感：${templateRecipeToken(context, 'print-texture', ['纸张颗粒', '印刷质感'])}\n- 负面约束：${templateRecipeToken(context, 'negative-quality')}\n\n要求：输出要能被直接复制用于新主题；保留风格方法，不绑定原图里不可迁移的具体对象，除非用户要求保留。`,
      user: `请分析参考图或旧提示词，并反推出一套可复用的图片生成 Prompt。\n\n参考图：{{img:参考图;count<=6}}\n旧提示词/说明：{{str:旧提示词或说明;length<5000}}\n新主题/主体：{{str:新主题;length<300}}\n必须保留的风格点：{{arr:必须保留风格;itemType=string;length<10}}\n不要继承的元素：{{arr:不要继承;itemType=string;length<10}}\n用途/比例：{{str:用途比例;length<160}}\n\n请输出：\n1. 视觉风格拆解：媒介、构图、镜头、光影、色彩、材质、细节密度。\n2. 可迁移规律：哪些表达可以换主题复用。\n3. 不应复用内容：原图特定人物、品牌、文字、水印、偶然缺陷等。\n4. 通用正向 Prompt：替换为新主题后可直接使用。\n5. 负面 Prompt：质量、构图、文字、身份漂移和风格跑偏项。\n6. 参数建议：比例、景别、参考图权重、文字使用策略。\n7. 质量检查清单。`,
    }),
  },
  {
    id: 'image-portrait',
    kind: 'image',
    categoryId: 'image-creation',
    categoryName: { zh: '图片生成', en: 'Image Creation' },
    name: { zh: '人物肖像', en: 'Portrait' },
    description: { zh: '生成角色、头像或人物宣传图。', en: 'Creates character, avatar, or people promo images.' },
    preview: { zh: '可直接生成头像、角色宣传照或人物视觉主图。', en: 'Directly creates avatar, character promo, or people hero visuals.' },
    build: (context) => ({
      prompt: `生成一张高完成度人物肖像图。主体为{{str:角色简述;length<800}}，${templateRecipeToken(context, 'subject-type')}，${templateRecipeToken(context, 'pose')}，${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}。人物应占据画面主视觉，脸部识别清晰，五官比例自然，姿态可信，服装与身份设定一致。\n\n画面风格：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'mood')}，${templateRecipeToken(context, 'color-tone')}。光线采用${templateRecipeToken(context, 'lighting')}，保留自然明暗层次和眼神光。细节要求：${templateRecipeToken(context, 'detail-level')}，皮肤、发丝、服饰纹理和边缘轮廓清晰。质量要求：${templateRecipeToken(context, 'image-quality')}。\n\n背景与构图：{{str:背景与构图;length<700}}\n补充要求：{{str:视觉要求;length<800}}\n\n最终效果应像一张可用于头像、角色宣传或人物主视觉的成片，而不是随手草图。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，脸部崩坏，手部错误，多余手指，不自然皮肤，眼神涣散，五官漂移，肢体比例错误，主体被裁切，背景抢主体`,
      styleText: '人物主体清晰，脸部和眼神优先，背景服务人物，整体适合头像、角色宣传或人物主视觉。',
    }),
  },
  {
    id: 'image-product-hero',
    kind: 'image',
    categoryId: 'image-creation',
    categoryName: { zh: '图片生成', en: 'Image Creation' },
    name: { zh: '产品主图', en: 'Product hero' },
    description: { zh: '生成电商主图、产品展示或广告物料。', en: 'Creates ecommerce hero images, product displays, or ad assets.' },
    preview: { zh: '适合电商主图、广告 KV、产品详情页首屏。', en: 'For ecommerce hero images, ad key visuals, and product detail hero sections.' },
    build: (context) => ({
      prompt: `生成一张商业级产品主图。产品主体：{{str:产品名称;length<120}}，产品资料：{{str:产品资料;length<1200}}。画面必须让产品第一眼可识别，主体边缘清晰，比例真实，材质表现准确：${templateRecipeToken(context, 'material')}，${templateRecipeToken(context, 'detail-level')}。\n\n商业表达：突出${templateRecipeToken(context, 'selling-point')}，适用于${templateRecipeToken(context, 'design-use')}。场景为${templateRecipeToken(context, 'scene-type')}，构图采用${templateRecipeToken(context, 'composition')}，主体占比合理，留出标题、卖点或价格信息的安全区域。\n\n视觉风格：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'render-method')}，${templateRecipeToken(context, 'image-quality')}。\n\n品牌/包装要求：{{str:品牌要求;length<500}}\n补充要求：{{str:产品补充要求;length<1000}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，杂乱背景，错误透视，产品变形，品牌标识错误，参数文字乱码，低质反光，主体过小，阴影脏乱，包装结构错误`,
      styleText: '商业棚拍和广告成片质感，产品可信、材质真实、信息区域清楚。',
    }),
  },
  {
    id: 'image-commercial-poster',
    kind: 'image',
    categoryId: 'image-creation',
    categoryName: { zh: '图片生成', en: 'Image Creation' },
    name: { zh: '商业海报', en: 'Commercial poster' },
    description: { zh: '生成活动、品牌或营销海报画面。', en: 'Creates campaign, brand, or marketing poster visuals.' },
    preview: { zh: '适合活动海报、品牌宣传图和营销 KV。', en: 'For campaign posters, brand promos, and marketing key visuals.' },
    build: (context) => ({
      prompt: `生成一张商业海报主视觉。活动/品牌主题：{{str:活动主题;length<160}}。核心信息：{{str:核心信息;length<260}}。必须出现的视觉元素：{{arr:视觉元素;itemType=string;length<10}}。\n\n画面用途：${templateRecipeToken(context, 'design-use')}，画幅：${templateRecipeToken(context, 'image-aspect-ratio')}。整体采用${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'composition')}，层级清晰：主视觉最强，标题区明确，辅助元素围绕主题展开，不能喧宾夺主。\n\n氛围与质感：${templateRecipeToken(context, 'mood')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'detail-level')}，${templateRecipeToken(context, 'image-quality')}。\n\n排版要求：{{str:排版要求;length<800}}\n如果需要文字，只保留短标题和少量关键信息，文字区域要干净、可读、不要生成大段小字。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，文字错误，排版混乱，标题被遮挡，信息拥挤，主体过小，低质素材拼贴，透视错误，色彩脏乱`,
      styleText: '海报式中心构图，主视觉强，标题安全区清楚，适合活动和品牌传播。',
    }),
  },
  {
    id: 'image-social-cover',
    kind: 'image',
    categoryId: 'image-creation',
    categoryName: { zh: '图片生成', en: 'Image Creation' },
    name: { zh: '社媒封面', en: 'Social cover' },
    description: { zh: '生成小红书、公众号、视频封面等首图。', en: 'Creates covers for social posts, articles, and videos.' },
    preview: { zh: '适合移动端首图，强调主体、标题区和点击吸引力。', en: 'For mobile covers with strong subject, title area, and click appeal.' },
    build: (context) => ({
      prompt: `生成一张社媒封面首图。封面主题：{{str:封面主题;length<140}}，目标读者：${templateRecipeToken(context, 'target-audience')}。视觉关键词：{{arr:关键词;itemType=string;length<10}}。\n\n用途和比例：${templateRecipeToken(context, 'design-use')}，${templateRecipeToken(context, 'image-aspect-ratio')}。画面需要在移动端小尺寸下仍然一眼可读：主体突出，标题区留白明确，背景不抢信息，色块和对比关系清楚。\n\n视觉方向：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'composition')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'image-quality')}。\n\n封面标题建议：{{str:封面标题;length<80}}\n补充要求：{{str:封面补充要求;length<700}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，主体过小，信息拥挤，标题区杂乱，小字过多，低对比，裁切关键信息，错别字`,
      styleText: '移动端第一眼可读，主体和标题区稳定，适合小红书、公众号、视频封面。',
    }),
  },
  {
    id: 'image-concept-scene',
    kind: 'image',
    categoryId: 'image-creation',
    categoryName: { zh: '图片生成', en: 'Image Creation' },
    name: { zh: '场景概念图', en: 'Concept scene' },
    description: { zh: '生成空间、环境、世界观或氛围概念图。', en: 'Creates space, environment, worldbuilding, or mood concept art.' },
    preview: { zh: '适合空间设定、世界观、电影感环境和无人场景。', en: 'For space design, worldbuilding, cinematic environments, and no-human scenes.' },
    build: (context) => ({
      prompt: `生成一张电影级场景概念图。场景描述：{{str:场景描述;length<1400}}。关键元素：{{arr:关键物件;itemType=string;length<12}}。画面以环境叙事为主，空间关系清晰，前景、中景、远景有层次。\n\n场景类型：${templateRecipeToken(context, 'scene-type')}，情绪氛围：${templateRecipeToken(context, 'mood')}。镜头语言：${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}，${templateRecipeToken(context, 'composition')}。光影与色彩：${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'color-tone')}。\n\n视觉风格：${templateRecipeToken(context, 'visual-style-direction')}，渲染方式：${templateRecipeToken(context, 'render-method')}，质量：${templateRecipeToken(context, 'image-quality')}。\n\n限制：{{str:场景限制;length<800}}\n如果要求无人物，画面必须保持 empty scene / no humans / landscape only，不能出现路人、剪影或拟人主体。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，透视错误，空间关系混乱，主体不明，人物误入，杂乱堆砌，低清晰度，画面过曝，构图失衡`,
      styleText: '空间层次清楚，环境氛围明确，可用于影视、美术、游戏和世界观概念设计。',
    }),
  },
  {
    id: 'image-character-sheet',
    kind: 'image',
    categoryId: 'image-creation',
    categoryName: { zh: '图片生成', en: 'Image Creation' },
    name: { zh: '角色设定图', en: 'Character sheet' },
    description: { zh: '生成角色设定、服装、姿态和视觉风格参考。', en: 'Creates character references for outfit, pose, and style.' },
    preview: { zh: '适合 IP、游戏、动画和虚拟人设定板。', en: 'For IP, game, animation, and virtual persona design sheets.' },
    build: (context) => ({
      prompt: `生成一张角色设定图，适合导演、建模师、插画师或游戏美术继续使用。角色设定：{{str:角色设定;length<1400}}。角色类型：${templateRecipeToken(context, 'subject-type')}，核心气质：{{str:核心气质;length<300}}。\n\n画面内容：至少包含主视图和 2-4 个辅助视图或局部细节，可包括正面、侧面、背面、表情、武器、道具、服装纹理。姿态：${templateRecipeToken(context, 'pose')}。服装/道具：{{arr:服装道具;itemType=string;length<12}}。\n\n视觉风格：${templateRecipeToken(context, 'visual-style-direction')}，材质：${templateRecipeToken(context, 'material')}，细节：${templateRecipeToken(context, 'detail-level')}，色调：${templateRecipeToken(context, 'color-tone')}，质量：${templateRecipeToken(context, 'image-quality')}。\n\n版式要求：干净设定板背景，角色轮廓清楚，细节标注区域不要遮挡主体；整体像高预算项目的角色 pitch board，不是普通立绘拼贴。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，比例错误，多余手指，服装结构混乱，视图不一致，身份漂移，设定元素缺失，低质草图，文字乱码`,
      styleText: '角色轮廓清晰，设定元素完整，适合 IP、游戏、动画和虚拟人后续延展。',
    }),
  },
  {
    id: 'image-chibi-transparent',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: 'Q 版透明背景角色', en: 'Chibi transparent character' },
    description: { zh: '从高频 Q 版透明背景样本蒸馏，适合表情包、头像贴纸和吉祥物。', en: 'Distilled from frequent chibi transparent-background samples.' },
    preview: { zh: 'Q 版可爱、动作夸张、透明背景、适合贴纸使用。', en: 'Cute chibi, exaggerated action, transparent background, sticker-ready.' },
    build: (context) => ({
      prompt: `绘制一个 Q 版可爱角色贴纸，透明背景。角色主体：{{str:角色主体;length<300}}。动作和情绪：{{str:动作情绪;length<300}}。画面要夸张、有记忆点，适合头像、表情包、贴纸或应用内插图。\n\n风格：动漫 Q 版可爱，${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'mood')}。主体姿态：${templateRecipeToken(context, 'pose')}，构图：居中构图，主体完整不裁切，轮廓清晰，边缘干净。\n\n细节：可加入少量道具、动作线、情绪符号或短文字气泡：{{str:短文字;length<80}}。如果没有明确要求，不要生成复杂背景，只保留透明背景或极简阴影。\n\n质量：${templateRecipeToken(context, 'detail-level')}，${templateRecipeToken(context, 'image-quality')}，高辨识度，适合抠图和复用。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，复杂背景，主体被裁切，边缘脏，文字乱码，低清晰度，过度写实，恐怖表情，手部错误，多余肢体`,
      styleText: 'Q 版透明背景贴纸，轮廓干净，动作表情夸张，适合表情包和头像复用。',
    }),
  },
  {
    id: 'image-ecommerce-russian',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '白底俄语电商图', en: 'Russian ecommerce image' },
    description: { zh: '适合白底商品主图、俄语卖点标签和跨境电商素材。', en: 'For white-background product images with Russian selling-point labels.' },
    preview: { zh: '白底产品图、俄语标签、参数卖点、清晰主体。', en: 'White product image, Russian labels, specs, clear subject.' },
    build: (context) => ({
      prompt: `生成一张白底俄语电商商品图。产品：{{str:产品名称;length<120}}。产品参数与特性：{{arr:产品特性;itemType=string;length<12}}。商品应清晰完整，主体占画面 65%-80%，白底干净，阴影自然，角度能展示关键结构。\n\n信息排版：左侧或右侧放置俄语短标签和参数模块，标签要简洁、可读，颜色与产品风格一致。俄语文案参考：{{arr:俄语标签;itemType=string;length<8}}。如果提供品牌或商标位置，保持原商标排版稳定：{{str:品牌锁定;length<300}}。\n\n视觉质量：${templateRecipeToken(context, 'design-use')}，${templateRecipeToken(context, 'composition')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'material')}，${templateRecipeToken(context, 'image-quality')}。比例：${templateRecipeToken(context, 'image-aspect-ratio')}。\n\n补充要求：{{str:电商补充要求;length<800}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，非白底，背景杂乱，俄语错别字，乱码文字，品牌变形，产品角度错误，参数堆太密，主体过小，阴影脏，低质抠图`,
      styleText: '白底跨境电商图，产品清楚，俄语标签短而醒目，参数模块不遮挡主体。',
    }),
  },
  {
    id: 'image-product-parameter-card',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '产品参数卖点图', en: 'Product spec card' },
    description: { zh: '适合详情页参数图、卖点图、功能说明图。', en: 'For detail-page spec cards, selling-point images, and feature explainers.' },
    preview: { zh: '商品主体 + 参数标签 + 功能说明 + 详情页版式。', en: 'Product subject, spec labels, feature callouts, detail-page layout.' },
    build: (context) => ({
      prompt: `生成一张产品参数卖点说明图。产品：{{str:产品名称;length<120}}。核心卖点：{{arr:核心卖点;itemType=string;length<8}}。参数：{{arr:参数清单;itemType=string;length<10}}。\n\n版式：产品主体放在{{str:产品位置;length<80}}，周围用清晰的信息模块说明功能、尺寸、材质、使用场景和优势。信息层级要像成熟电商详情页：主标题醒目，参数短标签清楚，辅助说明不拥挤。\n\n视觉风格：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'composition')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'material')}。用途：${templateRecipeToken(context, 'design-use')}。质量：${templateRecipeToken(context, 'image-quality')}。\n\n背景与场景：{{str:背景要求;length<700}}\n品牌/文字要求：{{str:文字要求;length<700}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，参数错误，文字乱码，小字过密，排版混乱，产品变形，品牌标识错误，信息遮挡主体，低端模板感`,
      styleText: '详情页参数图逻辑，主体和卖点标签清楚，适合产品功能说明和跨境电商素材。',
    }),
  },
  {
    id: 'image-reference-edit',
    kind: 'image',
    categoryId: 'image-editing',
    categoryName: { zh: '图生图修改', en: 'Image Editing' },
    name: { zh: '局部修改保留主体', en: 'Local edit preserving subject' },
    description: { zh: '适合换装、去物、修正局部、保持主体身份的图生图任务。', en: 'For outfit swaps, object removal, local fixes, and subject-preserving edits.' },
    preview: { zh: '明确保留不变区域，只修改指定局部。', en: 'Keeps locked areas unchanged and edits only specified regions.' },
    build: (context) => ({
      prompt: `基于参考图进行局部修改，只改指定区域，其他部分保持不变。参考图：{{img:参考图;count<=4}}。参考图说明：{{str:参考图说明;length<1000}}。\n\n必须保留：{{arr:必须保留;itemType=string;length<12}}。这些内容包括主体身份、脸部辨识度、身体比例、姿势、镜头角度、光线方向、背景结构、品牌/文字/包装位置等，除非修改要求明确涉及，不得改变。\n\n需要修改：{{arr:修改指令;itemType=string;length<12}}。修改要自然融入原图，透视、材质、阴影、边缘、颜色和清晰度必须匹配原始画面。\n\n目标效果：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'material')}，${templateRecipeToken(context, 'detail-level')}，${templateRecipeToken(context, 'image-quality')}。\n\n最终结果应像同一张照片/设计稿的自然编辑版本，而不是重新生成一张不同图片。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，改变主体身份，换脸，背景重绘，姿势改变，构图改变，品牌错位，边缘破损，局部修补痕迹，颜色不一致，透视不匹配`,
      styleText: '图生图局部编辑，保留主体和原图结构，只修改指定区域。',
    }),
  },
  {
    id: 'image-game-screenshot',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '游戏实机宣传截图', en: 'Game promo screenshot' },
    description: { zh: '适合次世代游戏实机感、宣传截图和官方概念画面。', en: 'For next-gen in-game-style promo screenshots and official concept visuals.' },
    preview: { zh: '强调实机演出、城市/场景识别、速度感、logo 和宣传文案区域。', en: 'Emphasizes gameplay staging, recognizable setting, motion, logo, and copy area.' },
    build: (context) => ({
      prompt: `创作一张像官方发布的游戏实机宣传截图，而不是普通海报。游戏/项目名：{{str:游戏名称;length<120}}。场景设定：{{str:游戏场景;length<1000}}。时代/地点/世界观：{{str:世界观背景;length<500}}。\n\n画面要体现真实次世代游戏实机演出效果：可玩空间、真实环境细节、动态瞬间、镜头运动感、物理材质和空气透视。主体：{{str:主体;length<400}}。关键元素：{{arr:关键元素;itemType=string;length<12}}。\n\n视觉：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'render-method')}，${templateRecipeToken(context, 'image-quality')}。\n\n宣传信息：在合适位置保留 logo 或标题区：{{str:标志文案要求;length<300}}，整体像官方概念宣传截图，画面高级、震撼、写实。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，普通海报感，UI 杂乱，logo 乱码，场景空洞，低端手游质感，车辆/角色变形，速度感不足，画面糊，透视错误`,
      styleText: '官方游戏宣传截图质感，实机场景可信，光影、材质和动态瞬间明确。',
    }),
  },
  {
    id: 'image-comic-story-page',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '漫画分镜故事页', en: 'Comic story page' },
    description: { zh: '适合单页漫画、故事书插画、多格分镜。', en: 'For single-page comics, storybook illustrations, and multi-panel storyboards.' },
    preview: { zh: '固定风格前缀、页面结构、主格和 inset panels。', en: 'Uses style prefix, page structure, main panel, and inset panels.' },
    build: (context) => ({
      prompt: `生成一页完整漫画/故事书分镜图。页码/场景：{{str:页码场景;length<180}}。故事内容：{{str:故事内容;length<1200}}。角色与身份锁定：{{str:角色锁定;length<1200}}。\n\n页面结构：{{str:页面结构;length<300}}，例如 single full-page panel、main panel + 3 inset panels、grid style。每个分格都要有清晰动作、视线方向、前中后景和叙事功能；分格之间保持同一角色、服装、时间、空间和光线逻辑。\n\n统一风格：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'mood')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'detail-level')}，${templateRecipeToken(context, 'image-quality')}。镜头：${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}。\n\n每格提示：{{arr:分格节拍;itemType=string;length<8}}\n补充要求：成熟、精致、电影感，线条和色彩统一，分镜信息清楚，不要生成无关旁白大段文字。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，分格混乱，角色不一致，服装漂移，文字乱码，脸部崩坏，手部错误，故事顺序错误，过度拥挤，低质草图`,
      styleText: '单页漫画或故事书分镜，角色和风格一致，主格与小格叙事清楚。',
    }),
  },
  {
    id: 'image-logo-typography',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '字体 Logo 概念图', en: 'Typography logo concept' },
    description: { zh: '适合品牌字标、字体美学概念和文字主视觉。', en: 'For wordmarks, typography concepts, and text-led key visuals.' },
    preview: { zh: '让目标字词成为最大、最醒目、最可读的主体。', en: 'Makes the target word the largest, clearest, most memorable subject.' },
    build: (context) => ({
      prompt: `请以「{{str:目标字词;length<80}}」为核心，生成一张顶级字体美学概念图像。首要原则：${templateRecipeToken(context, 'typography-role')}。目标字词必须成为画面中最强、最大、最醒目、最有记忆点的视觉主体，第一眼必须能被读懂。\n\n先理解词义，再生成画面。主题/品牌含义：{{str:品牌含义;length<1000}}。分析维度：${templateRecipeToken(context, 'word-meaning-analysis', ['字面含义', '情绪气质', '隐喻与象征', '空间感与力量感'])}。请把目标字词从表层含义推进到更深层视觉隐喻：${templateRecipeToken(context, 'semantic-metaphor')}。视觉隐喻逻辑：${templateRecipeToken(context, 'visual-metaphor-logic', ['空间关系', '尺度反差', '象征关系'])}。画面不是给词配背景，而是让文字本身成为视觉思想。\n\n字形必须表达含义，而不是普通字体贴图。字形互动方式：${templateRecipeToken(context, 'font-interaction')}。可以让笔画生长、断裂、被拉扯、被框架限制、形成负形或成为空间结构。字形可读性护栏：${templateRecipeToken(context, 'type-legibility-guardrails', ['中文结构准确', '英文拼写准确', '变形不破坏可读性'])}。\n\n画幅逻辑：${templateRecipeToken(context, 'adaptive-aspect')}。不要机械固定竖版；根据词义选择方形、竖版、横版、超宽或超竖比例，让画幅成为隐喻的一部分。构图：${templateRecipeToken(context, 'composition')}，文字层级始终高于背景和装饰。\n\n字体风格系统：${templateRecipeToken(context, 'typography-style-system', ['实验字体设计', '高级极简平面设计'])}。视觉方向：${templateRecipeToken(context, 'visual-style-direction')}，色彩：${templateRecipeToken(context, 'color-tone')}，光影：${templateRecipeToken(context, 'lighting')}，材质：${templateRecipeToken(context, 'material')}，文字清晰策略：${templateRecipeToken(context, 'text-clarity-policy')}，质量：${templateRecipeToken(context, 'image-quality')}。补充排版要求：{{str:字体要求;length<1200}}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，目标字词不可读，错别字，文字变形，背景抢主体，小字过多，低端模板，杂乱装饰，logo 被遮挡`,
      styleText: '文字是绝对主视觉，背景和装饰服务字标，适合品牌概念和字体美学探索。',
    }),
  },
  {
    id: 'image-world-map-lore',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '世界地图设定图', en: 'World map lore' },
    description: { zh: '适合奇幻/科幻世界地图、势力分布和地理设定。', en: 'For fantasy/sci-fi world maps, factions, and geography lore.' },
    preview: { zh: '含地理、政治、势力、标注和地图风格约束。', en: 'Includes geography, politics, factions, labels, and map style constraints.' },
    build: (context) => ({
      prompt: `生成一张完整世界地图设定图。世界名称：{{str:世界名称;length<120}}。世界观概括：{{str:世界观;length<2000}}。\n\n地图必须包含主要大陆、海洋、山脉、河流、城市、国家/势力边界、重要遗迹或资源点。地理设定：{{arr:地理元素;itemType=string;length<14}}。势力设定：{{arr:势力设定;itemType=string;length<12}}。重要标注：{{arr:地图标注;itemType=string;length<16}}。\n\n风格：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'detail-level')}，${templateRecipeToken(context, 'render-method')}，${templateRecipeToken(context, 'image-quality')}。构图：地图整体完整，边框、比例尺、罗盘、图例清楚，留有标题区。\n\n标注要求：地图文字尽量少而清晰，重点地名优先；如果文字生成不稳定，保持图形符号和区域分布准确。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，地图断裂，边界混乱，文字乱码，地理关系不合理，区域过度拥挤，主体被裁切，低清晰度，没有图例`,
      styleText: '完整世界地图设定图，地理和势力分布清楚，适合小说、游戏和桌游世界观。',
    }),
  },
  {
    id: 'image-video-keyframe-sheet',
    kind: 'image',
    categoryId: 'zrimgs-image',
    categoryName: { zh: 'ZrImgs 蒸馏模板', en: 'ZrImgs Templates' },
    name: { zh: '视频关键帧联络单', en: 'Video keyframe contact sheet' },
    description: { zh: '从视频分镜样本蒸馏，适合生成 3x3/4x3 关键帧索引图。', en: 'Distilled from video storyboard samples for 3x3/4x3 keyframe sheets.' },
    preview: { zh: '同一环境、同一主体、镜头连贯、每格标注 KF。', en: 'Same setting and subject, coherent camera sequence, KF labels per panel.' },
    build: (context) => ({
      prompt: `生成一张 AI 视频关键帧联络单，用于展示一个连贯短片序列。故事/需求：{{str:视频故事;length<1600}}。主体与身份锁定：{{str:主体锁定;length<1200}}。环境与视觉锚点：{{str:视觉锚点;length<1200}}。\n\n联络单结构：{{str:联络单结构;length<120}}，默认 3x3 或 4x3。分镜生产流程：${templateRecipeToken(context, 'storyboard-workflow', ['场景拆解', '关键帧列表', '联络单输出'])}。每一格代表一个关键帧，并在安全区域清晰标注 KF 编号、镜头类型和建议时长。分镜镜头字段：${templateRecipeToken(context, 'storyboard-shot-fields', ['镜头号', '建议时长', '镜头类型', '画面调度/动作'])}。\n\n所有关键帧必须在同一故事逻辑下连贯延续。连续性约束：${templateRecipeToken(context, 'storyboard-continuity', ['角色身份一致', '服装道具一致', '轴线原则', '视线匹配'])}。\n\n每帧要求：主体位置、前/中/背景、动作节拍、相机高度和角度、焦距/景深、光影调色一致。镜头语言：${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}。版式密度：${templateRecipeToken(context, 'production-board-density', ['结构清晰网格', '模块化排版'])}。风格：${templateRecipeToken(context, 'visual-style-direction')}，${templateRecipeToken(context, 'lighting')}，${templateRecipeToken(context, 'color-tone')}，${templateRecipeToken(context, 'image-quality')}。\n\n情绪弧线：{{arr:情绪节拍;itemType=string;length<6}}\n补充要求：{{str:关键帧要求;length<800}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，关键帧不连贯，角色漂移，服装变化，环境变化，KF 标注乱码，分格混乱，轴线错误，画面裁切，低质草图`,
      styleText: '视频关键帧联络单，3x3 或 4x3 分格，角色、环境、光影和镜头逻辑一致。',
    }),
  },
  {
    id: 'image-film-storyboard-production-board',
    kind: 'image',
    categoryId: 'storyboard-production',
    categoryName: { zh: '分镜与设定板', en: 'Storyboard and Production Boards' },
    name: { zh: '影视前期分镜设定板', en: 'Film storyboard production board' },
    description: { zh: '人工读取影视前期制作板样本后整理，适合中文电影分镜信息图。', en: 'Manually distilled from film preproduction board samples for Chinese storyboard infographics.' },
    preview: { zh: '顶部项目栏、角色/场景/调度图、8 镜头分镜、灯光声音摄影说明。', en: 'Project bar, character/scene/blocking panels, 8 shots, lighting, sound, and cinematography notes.' },
    build: (context) => ({
      prompt: `生成一张高度精细的中文电影分镜信息图海报，专业影视前期制作设定板。项目名称：{{str:项目名称;default=XXX;length<120}}，类型：{{str:影片类型;default=动作 / 爱情 / 科幻;length<120}}，时长：{{str:时长;default=2-3分钟;length<80}}，限制条件：{{str:限制条件;default=8个镜头 / 2个角色 / 1个场景;length<220}}。\n\n整体版式：${templateRecipeToken(context, 'infographic-layout', ['标题栏分区', '分区网格', '8镜头分镜区', '俯视镜头调度图'])}。设定板信息密度：${templateRecipeToken(context, 'production-board-density', ['信息密集但排版整洁', '结构清晰网格', '深色标题栏'])}。报告模块：${templateRecipeToken(context, 'report-sections', ['项目标题', '角色设计区', '场景设计区', '俯视镜头调度图', '分镜故事区', '灯光与风格', '情绪关键词', '声音设计', '摄影说明', '色彩方案'])}。\n\n【角色设计区】展示主要角色正面、背面、侧面、特写、动作姿态和服装道具。角色设定：{{str:角色设定;length<1200}}。角色在所有格子中保持一致，写实摄影风格，高细节面部。\n\n【场景设计区】展示电影级场景概念图，空间细节丰富，真实光影和电影剧照质感。主场景：{{str:场景设定;length<1000}}，关键道具：{{arr:关键道具;itemType=string;length<10}}。\n\n【俯视镜头调度图】生成场景俯视平面图，标注 1-8 编号镜头，用箭头表示人物移动与镜头运动轨迹，类似电影拍摄蓝图/建筑平面图。分镜连续性：${templateRecipeToken(context, 'storyboard-continuity', ['角色身份一致', '服装道具一致', '轴线原则', '视线匹配'])}。\n\n【分镜故事区】默认 8 镜头，每格需要包含：${templateRecipeToken(context, 'storyboard-shot-fields', ['镜头号', '建议时长', '镜头类型', '焦段', '运动方式', '画面调度/动作', '音效/音乐'])}。逐镜故事：{{arr:逐镜文案;itemType=string;length<8}}。\n\n【底部说明区】包含灯光与风格、情绪关键词、声音设计、摄影说明和统一色彩方案。风格标签：{{arr:风格标签;itemType=string;length<12}}。色彩方案：{{str:色彩方案;default=深蓝、灰黑、暖米色、冷青色点缀;length<220}}。文字清晰策略：${templateRecipeToken(context, 'text-clarity-policy', ['标题必须可读', '只保留短标签', '不要密集多行小字'])}。画幅：${templateRecipeToken(context, 'image-aspect-ratio', ['16:9 横版'])}，视觉风格：${templateRecipeToken(context, 'visual-style-direction', ['电影海报', '商业海报'])}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，漫画草图风，粗糙分镜，模块混乱，中文乱码，小字密集不可读，角色不一致，服装道具漂移，俯视调度图缺失，镜头编号错误，摄像机设备出现在镜头中，信息过满无层级`,
      styleText: '专业中文影视前期制作设定板，16:9 横版，模块化网格、角色设定、场景设定、俯视调度和 8 镜头分镜。',
    }),
  },
  {
    id: 'image-group-portrait-era',
    kind: 'image',
    categoryId: 'zrimgs-portrait',
    categoryName: { zh: '人物与叙事', en: 'People and Story' },
    name: { zh: '年代群像合影', en: 'Era group portrait' },
    description: { zh: '从多人合影、年代街景和亲密互动样本蒸馏。', en: 'Distilled from group portrait, era street, and relationship samples.' },
    preview: { zh: '控制人物数量、关系、站位、年代地点和背景建筑。', en: 'Controls people count, relationship, pose, era location, and background.' },
    build: (context) => ({
      prompt: `生成一张真实年代感多人合影。人物数量与关系：{{str:人物关系;length<500}}。站位与动作：{{str:站位姿态;length<600}}。年代地点：{{str:年代地点;length<500}}，背景建筑与街道细节：{{str:背景要求;length<900}}。\n\n人物应表情自然、互动可信、服装发型符合时代背景。构图：${templateRecipeToken(context, 'composition')}，景别：${templateRecipeToken(context, 'shot-size')}，拍摄角度：${templateRecipeToken(context, 'camera-angle')}，光线：${templateRecipeToken(context, 'lighting')}，色调：${templateRecipeToken(context, 'color-tone')}，质量：${templateRecipeToken(context, 'image-quality')}。\n\n必须保留/强调：{{arr:必须保留;itemType=string;length<10}}\n补充要求：{{str:视觉要求;length<800}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，人物数量错误，脸部崩坏，手部错误，年代错位，背景穿帮，表情僵硬，关系不清`,
      styleText: '真实年代感群像，人物关系和时代环境都要可信。',
    }),
  },
  {
    id: 'image-character-anime-game',
    kind: 'image',
    categoryId: 'zrimgs-portrait',
    categoryName: { zh: '人物与叙事', en: 'People and Story' },
    name: { zh: '动漫游戏角色主视觉', en: 'Anime game character key visual' },
    description: { zh: '适合游戏人物、民族风少女、东方玄幻和角色宣传图。', en: 'For game characters, ethnic styling, fantasy, and promo visuals.' },
    preview: { zh: '锁定角色身份、外观、服装道具、画风和场景主题。', en: 'Locks identity, appearance, outfit, style, and setting.' },
    build: (context) => ({
      prompt: `生成一张角色主视觉。角色身份：{{str:角色主体;length<500}}。外观特征：{{str:外观特征;length<800}}。服装、道具和配饰：{{arr:服装道具;itemType=string;length<12}}。场景主题：{{str:场景描述;length<900}}。\n\n人物辨识度要高，姿态：${templateRecipeToken(context, 'pose')}，景别：${templateRecipeToken(context, 'shot-size')}，角度：${templateRecipeToken(context, 'camera-angle')}。画风：${templateRecipeToken(context, 'visual-style-direction')}，材质：${templateRecipeToken(context, 'material')}，情绪：${templateRecipeToken(context, 'mood')}，质量：${templateRecipeToken(context, 'image-quality')}。\n\n补充要求：{{str:视觉要求;length<800}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，身份漂移，服装错误，比例错误，脸部崩坏，手部错误，低清晰度，廉价手游感`,
      styleText: '角色宣传主视觉，身份、服装和场景气质统一。',
    }),
  },
  {
    id: 'image-reference-cosplay',
    kind: 'image',
    categoryId: 'image-edit',
    categoryName: { zh: '图生图修改', en: 'Image Editing' },
    name: { zh: '参考图角色一致性 Cosplay', en: 'Reference identity cosplay' },
    description: { zh: '严格保持参考图发型、配饰、服装和身份识别点。', en: 'Strictly preserves hairstyle, accessories, outfit, and identity cues.' },
    preview: { zh: '适合参考图角色复刻、随拍和 Cosplay 场景。', en: 'For reference-character recreation, snapshots, and cosplay scenes.' },
    build: (context) => ({
      prompt: `基于参考图生成角色一致性照片。参考图：{{img:参考图;count<=4}}。身份锁定点：{{arr:身份锁定点;itemType=string;length<12}}。发型、发色、配饰、服装结构必须与参考图一致：{{str:参考说明;length<1500}}。\n\n拍摄方式/场景：{{str:拍摄场景;length<800}}。画面应像自然照片或随拍，但不能改变参考角色的核心识别特征。镜头：${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}；光线：${templateRecipeToken(context, 'lighting')}；质量：${templateRecipeToken(context, 'image-quality')}。\n\n禁止改变：{{arr:必须避免;itemType=string;length<10}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，身份不一致，发型错误，配饰缺失，服装漂移，脸部不一致，过度美化，不像随拍`,
      styleText: '参考图身份一致性优先，像真实拍摄而不是重新设计角色。',
    }),
  },
  {
    id: 'image-product-angle-lock',
    kind: 'image',
    categoryId: 'ecommerce-image',
    categoryName: { zh: '产品与电商', en: 'Product and Ecommerce' },
    name: { zh: '产品角度替换/模板锁定', en: 'Product angle with locked template' },
    description: { zh: '适合换产品角度、保持 logo/文字模板、尺寸标注和包装区域。', en: 'For changing product angle while locking logos, text templates, and package regions.' },
    preview: { zh: '明确哪些区域不动，哪些产品结构需要替换。', en: 'Declares locked regions and product structures to replace.' },
    build: (context) => ({
      prompt: `对产品图做角度或包装替换。参考图：{{img:参考图;count<=4}}。产品资料：{{str:产品资料;length<1200}}。目标角度/状态：{{str:目标角度;length<300}}。\n\n必须保持不变的区域：{{arr:必须保留;itemType=string;length<12}}，包括 logo、文字模板、包装位置、背景结构或尺寸标注。需要修改：{{arr:修改指令;itemType=string;length<10}}。产品透视、材质、阴影和边缘必须自然。\n\n材质：${templateRecipeToken(context, 'material')}，构图：${templateRecipeToken(context, 'composition')}，光线：${templateRecipeToken(context, 'lighting')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，模板改变，logo 变形，尺寸错误，产品透视错误，文字乱码，包装错位，整体重绘`,
      styleText: '产品角度替换但模板锁定，适合电商改图和包装修正。',
    }),
  },
  {
    id: 'image-camping-product',
    kind: 'image',
    categoryId: 'ecommerce-image',
    categoryName: { zh: '产品与电商', en: 'Product and Ecommerce' },
    name: { zh: '户外露营产品场景图', en: 'Outdoor camping product scene' },
    description: { zh: '适合露营灯、户外装备、功能标签和使用场景结合。', en: 'For camping lights, outdoor gear, feature labels, and usage scenes.' },
    preview: { zh: '突出工作时间、亮度、防水、供电等功能参数。', en: 'Highlights runtime, brightness, waterproofing, charging, and feature specs.' },
    build: (context) => ({
      prompt: `生成一张户外装备商品图。产品：{{str:产品名称;length<160}}。使用场景：{{str:使用场景;length<800}}。功能参数：{{arr:参数清单;itemType=string;length<10}}。标签文案：{{arr:标签文案;itemType=string;length<8}}。\n\n产品主体必须清晰完整，户外/露营元素真实可信，功能标签短而清楚，不能遮挡主体。视觉：${templateRecipeToken(context, 'visual-style-direction')}，构图：${templateRecipeToken(context, 'composition')}，光线：${templateRecipeToken(context, 'lighting')}，材质：${templateRecipeToken(context, 'material')}，用途：${templateRecipeToken(context, 'design-use')}，质量：${templateRecipeToken(context, 'image-quality')}。比例：${templateRecipeToken(context, 'image-aspect-ratio')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，场景不相关，参数错误，标签乱码，主体过小，低质抠图，材质不真实，背景杂乱`,
      styleText: '户外产品场景图，产品清楚、功能标签清楚、露营氛围可信。',
    }),
  },
  {
    id: 'image-marker-style',
    kind: 'image',
    categoryId: 'style-conversion',
    categoryName: { zh: '风格转换', en: 'Style Conversion' },
    name: { zh: '马克笔手绘风格转换', en: 'Marker sketch style conversion' },
    description: { zh: '适合把现有画面改成马克笔、手绘草图或设计表现图。', en: 'For marker, sketch, and design-rendering style conversion.' },
    preview: { zh: '保留主体构图，改变线条、色块和纸张质感。', en: 'Preserves subject layout while changing linework, color blocks, and paper texture.' },
    build: (context) => ({
      prompt: `将画面转换为马克笔/手绘设计表现风格。参考图：{{img:参考图;count<=4}}。原始画面说明：{{str:参考说明;length<1200}}。必须保留：{{arr:必须保留;itemType=string;length<10}}。\n\n线条要求：{{str:线条要求;length<300}}。上色方式：{{str:上色方式;length<300}}。整体要有清晰手绘线条、马克笔色块、适度纸张纹理和专业设计表现图完成度。风格：${templateRecipeToken(context, 'visual-style-direction')}，色调：${templateRecipeToken(context, 'color-tone')}，细节：${templateRecipeToken(context, 'detail-level')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，主体改变，线条杂乱，颜色脏，低完成度，过度写实，丢失原构图`,
      styleText: '马克笔手绘表现图，保留原主体和构图，只转换视觉语言。',
    }),
  },
  {
    id: 'image-industrial-cleanup',
    kind: 'image',
    categoryId: 'image-edit',
    categoryName: { zh: '图生图修改', en: 'Image Editing' },
    name: { zh: '工业产品局部校正', en: 'Industrial product local fix' },
    description: { zh: '适合零件歪斜修正、去除遮挡物和产品局部清理。', en: 'For fixing crooked parts, removing blockers, and local product cleanup.' },
    preview: { zh: '只改指定零件，整体产品、背景和品牌保持不动。', en: 'Changes only specified parts while keeping product, background, and branding.' },
    build: (context) => ({
      prompt: `对工业/商品图进行局部校正。参考图：{{img:参考图;count<=4}}。修正部位：{{str:修正部位;length<300}}。目标状态：{{str:目标状态;length<300}}。\n\n必须不动区域：{{arr:必须保留;itemType=string;length<12}}。只修改指定部位，其他区域全部保持不动。修正后的结构、材质、阴影、边缘和清晰度必须匹配原图。材质：${templateRecipeToken(context, 'material')}，细节：${templateRecipeToken(context, 'detail-level')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，整体重绘，产品变形，边缘破损，材质不一致，背景改变，品牌错位`,
      styleText: '局部修图优先，不重新生成整张图。',
    }),
  },
  {
    id: 'image-vehicle-racing',
    kind: 'image',
    categoryId: 'game-visual',
    categoryName: { zh: '游戏与载具', en: 'Games and Vehicles' },
    name: { zh: '赛车车辆速度场景', en: 'Racing vehicle speed scene' },
    description: { zh: '适合赛车游戏截图、车辆广告、城市道路和速度感画面。', en: 'For racing screenshots, car ads, city roads, and speed shots.' },
    preview: { zh: '强调车辆材质、道路环境、城市天际线和运动瞬间。', en: 'Emphasizes vehicle material, road setting, skyline, and motion.' },
    build: (context) => ({
      prompt: `生成一张车辆速度场景图。车辆主体：{{str:主体;length<500}}。城市/地点：{{str:场景描述;length<900}}。道路环境：{{str:道路环境;length<600}}。速度动作：{{str:动作情绪;length<300}}。\n\n画面要有真实可玩空间、动态瞬间、车漆反射、路面细节和空气透视。镜头：${templateRecipeToken(context, 'shot-size')}，${templateRecipeToken(context, 'camera-angle')}，构图：${templateRecipeToken(context, 'composition')}。光线：${templateRecipeToken(context, 'lighting')}，色调：${templateRecipeToken(context, 'color-tone')}，渲染：${templateRecipeToken(context, 'render-method')}，质量：${templateRecipeToken(context, 'image-quality')}。\n\n宣传/Logo 要求：{{str:标志文案要求;length<300}}`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，车辆变形，速度感不足，路面虚假，反射错误，透视错误，普通海报感，logo 乱码`,
      styleText: '车辆高速运动场景，真实材质和道路速度感优先。',
    }),
  },
  {
    id: 'image-fantasy-wuxia-promo',
    kind: 'image',
    categoryId: 'game-visual',
    categoryName: { zh: '游戏与载具', en: 'Games and Vehicles' },
    name: { zh: '东方玄幻宽屏宣传图', en: 'Eastern fantasy widescreen promo' },
    description: { zh: '适合黑神话风、东方玄幻、角色阵容和宽屏宣传图。', en: 'For dark mythic eastern fantasy, character lineups, and widescreen promos.' },
    preview: { zh: '控制世界观、角色阵容、形象一致性、宽屏比例和场景真实感。', en: 'Controls world, lineup, identity consistency, widescreen ratio, and realism.' },
    build: (context) => ({
      prompt: `生成一张东方玄幻游戏宣传图。作品/世界观：{{str:世界观背景;length<900}}。角色阵容：{{arr:角色阵容;itemType=string;length<8}}。角色一致性要求：{{str:角色锁定;length<1200}}。\n\n场景主题：{{str:场景描述;length<900}}。画幅：${templateRecipeToken(context, 'image-aspect-ratio', ['21:9 电影宽屏'])}。人物和场景要贴合世界观，质感超清，像官方宣传图。风格：${templateRecipeToken(context, 'visual-style-direction')}，光线：${templateRecipeToken(context, 'lighting')}，色调：${templateRecipeToken(context, 'color-tone')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，角色不像原设，阵容数量错误，低俗过度，场景不符，脸部崩坏，低清晰度，普通拼贴`,
      styleText: '东方玄幻宽屏宣传图，角色阵容和场景世界观统一。',
    }),
  },
  {
    id: 'image-ink-myth-bridge-poster',
    kind: 'image',
    categoryId: 'narrative-poster',
    categoryName: { zh: '收藏叙事海报', en: 'Collectible Narrative Posters' },
    name: { zh: '水墨神话孤行海报', en: 'Ink myth lone journey poster' },
    description: { zh: '从悟空石桥、佛面背景、黑白水墨和金红点缀中蒸馏。', en: 'Distilled from mythic bridge, Buddha-face backdrop, ink wash, and gold/red accents.' },
    preview: { zh: '适合神话人物、孤独前行、巨大精神象征和极简水墨海报。', en: 'For mythic figures, lone journey, massive spiritual symbols, and minimalist ink posters.' },
    build: (context) => ({
      prompt: `生成一张极简中国神话水墨数字艺术海报。画面尺寸/比例：{{str:画面尺寸;default=600x800 像素竖版;length<80}}。主体：{{str:神话角色;default=孙悟空;length<120}}，从侧面看正在沿一座狭窄古石桥向前行走，姿态孤独、坚定、带有离开巨大命运的感觉。\n\n角色用粗犷黑色水墨笔触表现，轮廓简洁但动态强。角色拖拽的标志性武器/道具：{{str:标志道具;default=金箍棒;length<160}}，道具擦过地面，留下火花、金色光迹和轻微烟尘。桥面无栏杆，漂浮在无尽白色虚空之上，空间安静、空旷、压迫。\n\n背景是一张占据整幅画面的巨大褪色水彩神性面孔或象征物：{{str:背景象征;default=闭眼佛面;length<240}}，表情宁静，但表面像旧墙漆一样开裂、剥落。叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['巨大精神象征背景', '桥梁行走动线'])}。海报层级：${templateRecipeToken(context, 'poster-hierarchy', ['主视觉最强', '大面积留白'])}。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['桥梁行走动线', '大面积白色虚空', '视线从主体走向背景象征'])}。\n\n色彩以白色、黑色水墨为主，只允许金色用于道具/火花/光迹，朱红用于少量血迹、印记或墨点。纸张质感：${templateRecipeToken(context, 'print-texture', ['墨迹晕染', '边缘飞白'])}。构图：${templateRecipeToken(context, 'composition')}，情绪：${templateRecipeToken(context, 'mood', ['孤独', '坚定', '宿命感'])}，细节：${templateRecipeToken(context, 'detail-level')}。\n\n署名：在底部中央加入小号黑色毛笔字作者名“{{str:作者署名;default=晚睡自愈丸;length<80}}”，笔触自然，不能喧宾夺主。除署名外不要出现其他文字。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，多余文字，彩色过多，廉价武侠游戏感，背景拥挤，佛面表情夸张，角色比例错误，火花过度，桥梁透视错误，卡通化，3D 塑料感`,
      styleText: '极简黑白水墨，金色和朱红只作点睛；孤独前行、巨大精神象征和海报留白优先。',
    }),
  },
  {
    id: 'image-city-summer-ribbon-poster',
    kind: 'image',
    categoryId: 'city-poster',
    categoryName: { zh: '城市与国潮海报', en: 'City and Guochao Posters' },
    name: { zh: '夏日城市绸带双曝海报', en: 'Summer city ribbon double exposure' },
    description: { zh: '从夏日城市宣传、S 型绸带河流、国潮手绘地标和大留白中蒸馏。', en: 'Distilled from summer city promotion, S-curve ribbon river, guochao landmarks, and large whitespace.' },
    preview: { zh: '适合城市文旅、节气海报、地标集合和清爽夏日宣传。', en: 'For city tourism, seasonal posters, landmark collages, and summer promotion.' },
    build: (context) => ({
      prompt: `生成一张高雅清爽的城市夏日宣传海报。城市：{{str:城市名称;default=武汉;length<120}}，年份：{{str:年份;default=2026;length<40}}，画幅：${templateRecipeToken(context, 'image-aspect-ratio', ['9:16 手机竖屏'])}。整体是纯白纹理纸背景，双重曝光构图，视觉动线保持优雅的 S 型流动感。叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['S形绸带河流'])}。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['S形流动感', '丝带变河流', '左下标题安全区'])}。\n\n画面右下角安排一个身穿轻盈中国传统夏季服饰的微缩人物：{{str:人物动作;default=挥舞翠绿色丝绸舞带;length<220}}。舞带在空中向左上方飘动，并在流动过程中奇幻地变形成一条波光粼粼的清澈河流。河流内部叠加城市手绘图，呈现国潮、水汽、云雾、夏日光泽和俯瞰式壮阔空间。双曝融合方式：${templateRecipeToken(context, 'double-exposure-fusion', ['边界雾化过渡', '水彩晕染过渡', '拼贴但不硬裁切'])}。\n\n城市地标：{{arr:城市地标;itemType=string;length<12;default=黄鹤楼,武汉长江大桥,江汉关钟楼,光谷马蹄莲,东湖荷花,珞珈山深绿森林}}。地标与河流、绿意、云雾自然融合，结构复杂但层级清楚，细节丰富但不拥挤。海报层级：${templateRecipeToken(context, 'poster-hierarchy', ['左下角宣传标题', '大面积留白'])}，纸张印刷质感：${templateRecipeToken(context, 'print-texture', ['纸张颗粒', '水彩刷痕'])}。\n\n左下角排版主标题“{{str:主标题;default=SUMMER 2026;length<80}}”和竖排宣传语“{{str:宣传语;default=江城夏日，万物生光;length<120}}”。文字排版优美、大方、清晰完整，文字策略：${templateRecipeToken(context, 'text-clarity-policy', ['标题必须可读', '少量关键信息'])}。视觉风格：${templateRecipeToken(context, 'visual-style-direction', ['国潮', '水彩', '商业海报'])}，色调：${templateRecipeToken(context, 'color-tone', ['清新明亮'])}，构图：${templateRecipeToken(context, 'composition')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，城市地标错误，文字乱码，文字断裂，留白不足，色彩浑浊，地标堆砌，绸带不像河流，河流透视混乱，人物过大，商业模板感`,
      styleText: '城市文旅竖版海报，S 型丝绸变河流，地标国潮手绘和大面积留白并重。',
    }),
  },
  {
    id: 'image-guochao-character-double-exposure',
    kind: 'image',
    categoryId: 'narrative-poster',
    categoryName: { zh: '收藏叙事海报', en: 'Collectible Narrative Posters' },
    name: { zh: '国风角色双曝主视觉', en: 'Guochao character double-exposure key visual' },
    description: { zh: '从上大下小人物层级、巨型头部剪影、内部叙事拼贴和流动线索中蒸馏。', en: 'Distilled from giant head silhouettes, lower full-body hero, narrative collage, and flowing motifs.' },
    preview: { zh: '适合 IP 角色、游戏人物、系列海报和东方留白叙事构图。', en: 'For IP characters, game heroes, series posters, and eastern whitespace narrative layouts.' },
    build: (context) => ({
      prompt: `生成一张竖版国风游戏人物宣传海报。角色主题：{{str:角色主题;length<180}}。统一采用上大下小的主视觉层级：${templateRecipeToken(context, 'poster-hierarchy', ['上大下小层级', '巨型轮廓第一主体', '完整人物第二主体'])}。画面上半部分以角色最具辨识度的头部轮廓、标志性帽饰/发型/表情作为巨大的剪影式主形，形成第一眼识别；中下部安排完整人物作为第二主体，身着与主题匹配的国风战袍或仪式服装，站姿自信或轻动作姿态，成为画面视觉核心。\n\n大轮廓内部以及角色周围采用双重曝光与拼贴式叙事构图，叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['巨型头部剪影'])}，双曝融合方式：${templateRecipeToken(context, 'double-exposure-fusion', ['轮廓内部生长', '剪影填充式叙事', '外轮廓保持清晰'])}，内部世界组织：${templateRecipeToken(context, 'inner-world-composition', ['标志性场景', '角色关系', '叙事拼贴但不杂乱'])}。融合角色能力释放、载具/阵营/伙伴羁绊、航行或冒险环境、辅助符号和世界观场景：{{arr:内部叙事元素;itemType=string;length<14}}。左右两侧安排呼应性辅景：{{arr:左右辅景;itemType=string;length<8}}。\n\n用一条贯穿画面上下的流动线索连接上方大轮廓、内部拼贴和中下部角色：{{str:流动线索;length<240}}。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['垂直上升动线', '边缘呼吸感'])}。边缘采用水墨晕染、云雾、虚化破碎和留白处理：${templateRecipeToken(context, 'print-texture', ['墨迹晕染', '边缘飞白'])}，形成东方美学的虚实关系。整体高级、克制、系列化，强调层次、叙事、主视觉冲击和呼吸感。\n\n视觉风格：${templateRecipeToken(context, 'visual-style-direction', ['国风', '商业海报', '游戏宣传'])}，构图：${templateRecipeToken(context, 'composition', ['海报式中心构图', '层次分明'])}，光线：${templateRecipeToken(context, 'lighting')}，色调：${templateRecipeToken(context, 'color-tone')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，角色身份漂移，轮廓不清，内部拼贴杂乱，留白不足，廉价手游感，文字乱码，脸部崩坏，手部错误，元素互相遮挡，普通背景拼接`,
      styleText: '国风角色系列海报，上方巨型识别轮廓和下方完整人物双主视觉，内部叙事拼贴但保持留白。',
    }),
  },
  {
    id: 'image-paper-cut-s-landscape',
    kind: 'image',
    categoryId: 'city-poster',
    categoryName: { zh: '城市与国潮海报', en: 'City and Guochao Posters' },
    name: { zh: '新中式撕纸 S 形山水', en: 'New Chinese paper-tear S landscape' },
    description: { zh: '从极简新中式、S 形撕纸裂口、内部东方山水和题字落款中蒸馏。', en: 'Distilled from minimalist new Chinese style, S-shaped paper tear, inner landscape, and inscription.' },
    preview: { zh: '适合东方美学、文旅、节气、城市山水和收藏版装饰画。', en: 'For eastern aesthetics, tourism, seasonal posters, city landscape, and collectible prints.' },
    build: (context) => ({
      prompt: `生成一张极简新中式纸艺山水海报。背景为淡雅灰白色纹理纸，具有纸艺剪影般的浅浮雕立体感。叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['S形撕纸裂口'])}。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['S形流动感', '撕纸裂口引导', '底部落款安全区'])}。画面由一条 S 形蜿蜒的撕纸裂痕边缘分割，像撕开表层纸面，露出内部色彩斑斓但克制的东方山水世界。\n\n裂口内部景观：{{str:内部景观;default=东方山水、河流、山丘、梯田、古风建筑和小船;length<700}}。内部世界组织：${templateRecipeToken(context, 'inner-world-composition', ['远中近景递进', '内部场景通透过渡'])}。一条蜿蜒河流自上而下贯穿构图，河水用深浅不一的蓝色渲染，像流动丝带。河岸两侧有青翠山丘、梯田、树木和柔和红绿点缀，展现田园宁静。古风建筑沿河错落，飞檐翘角、白墙黛瓦、光影古朴。\n\n整体构图保持 S 型韵律，自然与人文和谐共生。撕纸边缘要有真实纸张层次和浮雕阴影：${templateRecipeToken(context, 'print-texture', ['撕纸浮雕', '纸张颗粒'])}，内部风景细节丰富但外部留白干净。下方题字“{{str:主题题字;default=东方美学;length<80}}”使用黑色楷体或书法字体；日期“{{str:日期;default=2026/05/20;length<40}}”、红色印章“{{str:印章文字;default=追梦AI;length<60}}”和底部英文“{{str:底部英文;default=CHINA;length<80}}”低调排布，文字策略：${templateRecipeToken(context, 'text-clarity-policy', ['标题必须可读', '少量关键信息'])}。\n\n风格：${templateRecipeToken(context, 'visual-style-direction', ['国风', '水彩', '商业海报'])}，色调：${templateRecipeToken(context, 'color-tone', ['低饱和', '清新明亮'])}，细节：${templateRecipeToken(context, 'detail-level')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，撕纸效果不明显，S 形断裂，画面拥挤，文字乱码，题字过大，颜色廉价高饱和，透视混乱，纸张质感塑料化，山水像普通插画`,
      styleText: '极简新中式撕纸山水，外部灰白留白，内部 S 形河流和东方建筑景观。',
    }),
  },
  {
    id: 'image-anime-washi-double-exposure',
    kind: 'image',
    categoryId: 'narrative-poster',
    categoryName: { zh: '收藏叙事海报', en: 'Collectible Narrative Posters' },
    name: { zh: '和纸动漫双曝角色海报', en: 'Washi anime double-exposure poster' },
    description: { zh: '从暗黑奇幻动漫半身肖像、月夜山水、浮世绘和旧宣纸质感中蒸馏。', en: 'Distilled from dark fantasy anime portraits, moonlit landscapes, ukiyo-e, and aged washi texture.' },
    preview: { zh: '适合动漫角色、浪漫史诗感、发丝/身体轮廓内部世界叙事。', en: 'For anime characters, romantic epic mood, and inner-world silhouette storytelling.' },
    build: (context) => ({
      prompt: `生成一张高质量动漫插画收藏海报，9:16 竖版构图。角色：{{str:角色名称;length<120}}，人物为侧面仰头半身肖像，面向{{str:朝向;default=右侧;length<40}}，眼神温柔坚定。外观特征：{{str:角色外观;length<900}}，服装/武器/标志物：{{arr:服装道具;itemType=string;length<12}}。\n\n采用双重曝光构图：叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['人物侧脸剪影', '主题轮廓宇宙'])}。双曝融合方式：${templateRecipeToken(context, 'double-exposure-fusion', ['主体局部与场景融合', '边界雾化过渡', '轮廓内部生长'])}。人物的头发、肩部、衣服和身体轮廓内部融合一整片月夜和风山水世界。内部世界组织：${templateRecipeToken(context, 'inner-world-composition', ['内部场景通透过渡', '角色关系', '远中近景递进'])}。内部叙事元素：{{arr:内部叙事元素;itemType=string;length<16;default=巨大满月,樱花树,神社鸟居,雾气山峦,瀑布,传统楼阁,同伴剪影,小型战斗场景,山间灯火,花海,飘落花瓣}}。画面下方可以有动态战斗剪影，周围有樱花花瓣、蝴蝶、水墨飞白和烟雾流动。\n\n整体色调柔和、梦幻、忧伤但有史诗感：${templateRecipeToken(context, 'color-tone', ['粉彩色', '低饱和'])}。视觉融合细腻动漫线稿、水墨画、水彩晕染、浮世绘质感和旧宣纸背景：${templateRecipeToken(context, 'print-texture', ['旧宣纸', '水彩刷痕', '边缘飞白'])}，边缘保留大量留白。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['边缘呼吸感', '底部落款安全区'])}。左侧加入竖排毛笔书法装饰“{{str:竖排题字;length<120}}”、红色印章“{{str:印章文字;length<60}}”和小字题跋，文字必须克制、清晰：${templateRecipeToken(context, 'text-clarity-policy', ['标题必须可读', '少量关键信息'])}。\n\n风格：${templateRecipeToken(context, 'visual-style-direction', ['二次元', '国风', '水彩'])}，光线：${templateRecipeToken(context, 'lighting', ['暖色主光', '柔和光'])}，细节：${templateRecipeToken(context, 'detail-level')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，模糊，畸形脸，五官崩坏，手指错误，多余肢体，比例错误，头发杂乱成团，画面过暗，过度饱和，现代城市，科幻机械，3D 渲染，写实照片风，文字乱码，大面积脏污，水印，logo`,
      styleText: '和纸质感动漫双曝海报，人物轮廓内生长月夜山水世界，浪漫、忧伤、史诗。',
    }),
  },
  {
    id: 'image-realistic-cosplay-magazine-cover',
    kind: 'image',
    categoryId: 'portrait-cover',
    categoryName: { zh: '人物与封面', en: 'Portraits and Covers' },
    name: { zh: '真人化 Cosplay 杂志封面', en: 'Realistic cosplay magazine cover' },
    description: { zh: '从角色真人化、商业摄影、封面排版和高级定制服装中蒸馏。', en: 'Distilled from realistic character cosplay, commercial photography, cover typography, and couture costume translation.' },
    preview: { zh: '适合游戏/动漫角色真人化、写真封面、商业摄影和角色识别锁定。', en: 'For game/anime character realism, editorial covers, commercial photography, and identity locking.' },
    build: (context) => ({
      prompt: `生成一张电影级真人化 Cosplay 杂志封面。角色名称：{{str:角色名称;default=Chun-Li;length<120}}。参考图：{{img:角色参考图;count<=4}}。目标是保留原作识别特征，并转化为真实人类质感、高端写真出道氛围和克制的商业摄影张力。身份保真策略：${templateRecipeToken(context, 'identity-lock-policy', ['保留脸部辨识度', '保留五官比例', '不要网红脸'])}。角色真人化转译：${templateRecipeToken(context, 'character-realism-translation', ['保留原作识别特征', '真实人类皮肤质感', '服装高级定制转译'])}。\n\n角色识别锁定：{{arr:角色识别特征;itemType=string;length<14}}，包括五官气质、眼神、发型轮廓、发色、标志性服装轮廓、配色、饰品、道具或阵营符号。人物比例优雅修长，身体线条自然，真实皮肤质感，保留毛孔、柔和绒毛、自然高光和不过度磨皮的精修质感。姿态：${templateRecipeToken(context, 'pose')}，近景到中景，身体语言开放但不夸张，保持高级、干净、克制。\n\n服装将原作设计转译为高级定制质感：真实奢华面料、精致纹样、自然贴合身体结构，不做廉价 Cosplay 塑料感。发型像高端沙龙造型，符合真实重力和发丝重量。环境：{{str:世界观场景;length<900}}，应绑定角色所属作品、身份背景和气质，像高预算电影布景，包含相关建筑、符号、道具、阵营或世界观元素，轻微雾气和浅景深散景。\n\n封面排版：{{str:封面文字系统;default=日语主标题、罗马音名称、英文短标语、圆形徽章、虚构杂志名、期号、条形码和出版信息;length<900}}。版式：${templateRecipeToken(context, 'infographic-layout', ['杂志封面网格'])}，海报层级：${templateRecipeToken(context, 'poster-hierarchy', ['主视觉最强', '标题区低调清晰'])}，文字清晰策略：${templateRecipeToken(context, 'text-clarity-policy', ['英文拼写准确', '少量关键信息'])}。文字采用高端杂志网格系统，日语/罗马字/英文混排，字重递减，层级清晰；人物局部可遮挡文字形成真实封面层次。不要文字重复、阴影、描边和发光字效。构图：${templateRecipeToken(context, 'composition', ['海报式中心构图'])}，光线：${templateRecipeToken(context, 'lighting', ['工作室布光', '轮廓光'])}，色调：${templateRecipeToken(context, 'color-tone')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，低俗性感，过度暴露，廉价 Cosplay 服装，塑料质感，假发感，五官崩坏，身体比例错误，手指错误，文字重复，乱码文字，文字阴影，发光文字，描边文字，过度磨皮，AI 感皮肤，廉价玄幻背景，无关装饰堆砌，模板化背景，过度锐化，低清晰度`,
      styleText: '高端商业摄影和杂志封面排版，角色真人化但识别点稳定，服装材质高级克制。',
    }),
  },
  {
    id: 'image-face-feature-analysis-card',
    kind: 'image',
    categoryId: 'portrait-analysis',
    categoryName: { zh: '人像分析图卡', en: 'Portrait Analysis Cards' },
    name: { zh: '面部特征分析图卡', en: 'Face feature analysis card' },
    description: { zh: '根据上传人像自动分析脸型、五官和局部特征，生成标注式信息图。', en: 'Analyzes uploaded portraits and creates annotated face-feature infographics.' },
    preview: { zh: '中心人像、细箭头、圆角信息卡、短标签和 2-3 条真实特征要点。', en: 'Centered portrait, thin arrows, rounded cards, short labels, and 2-3 factual notes.' },
    build: (context) => ({
      prompt: `根据上传人像生成一张“面部特征分析”信息图卡。人像照片：{{img:人像照片;count<=1}}。参考图角色：${templateRecipeToken(context, 'reference-image-role', ['Image 1 唯一身份基准', '只识别最大最清晰主角色'])}。身份保真策略：${templateRecipeToken(context, 'identity-lock-policy', ['唯一身份锚点', '保留脸部辨识度', '保留五官比例'])}。必须严格保留主角真实五官、脸型、肤色、年龄感、发型和表情特征，不要美化成另一个人。\n\n构图：将人像置于画面中心位置，背景干净、现代、留白充足。自动分析面部特征，不要使用固定或预先写死的标签；分析维度：${templateRecipeToken(context, 'portrait-analysis-focus', ['脸型', '眼睛', '眉毛', '鼻子', '脸颊', '嘴唇'])}。根据实际图像检测并标注脸型、眼睛、眉毛、鼻子、脸颊和嘴唇。每个特征用细箭头指向准确位置，箭头轻薄、清晰、不遮挡五官。\n\n每个特征旁边使用小型圆角信息卡片，卡片内包含一个简单线性图标、一个简短标签，以及 2-3 个简短要点来描述真实可见特征。标签示例只作风格参考：柔和椭圆脸、杏仁眼、自然眉峰、立体鼻梁、饱满唇形；实际输出必须根据上传照片自动判断。\n\n版式要求：${templateRecipeToken(context, 'infographic-layout', ['中心人像环绕标注', '圆角信息卡', '细箭头标注'])}。标题“{{str:标题;default=面部特征分析;length<60}}”清晰完整；卡片排布有秩序，左右平衡，避免拥挤。文字清晰策略：${templateRecipeToken(context, 'text-clarity-policy', ['只保留短标签', '标题必须可读', '卡片文字最多两行'])}。整体像专业形象顾问报告或高级杂志信息图，极简、干净、视觉为主。风格：${templateRecipeToken(context, 'visual-style-direction', ['商业海报', '极简主义'])}，构图：${templateRecipeToken(context, 'composition', ['留白构图', '层次分明'])}，色调：${templateRecipeToken(context, 'color-tone', ['高端灰', '清新明亮'])}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，身份不一致，五官被改变，固定模板标签，箭头指错位置，卡片遮挡面部，文字乱码，长段文字，信息拥挤，低端医美广告感，过度磨皮，脸部变形`,
      styleText: '人像居中，自动识别真实面部特征，用细箭头和圆角信息卡做专业分析图卡。',
    }),
  },
  {
    id: 'image-glasses-fit-guide',
    kind: 'image',
    categoryId: 'portrait-analysis',
    categoryName: { zh: '人像分析图卡', en: 'Portrait Analysis Cards' },
    name: { zh: '眼镜搭配指南图卡', en: 'Glasses fit guide card' },
    description: { zh: '保留上传人像真实特征，自动分析脸型并生成适合/不适合眼镜试戴对比。', en: 'Preserves uploaded portrait identity, analyzes face shape, and compares suitable/unsuitable glasses.' },
    preview: { zh: '并排试戴、推荐/避免眼镜、极简杂志风信息图。', en: 'Side-by-side try-ons, recommended/avoid frames, and minimalist editorial infographic.' },
    build: (context) => ({
      prompt: `使用上传人像生成一张“眼镜搭配指南”信息图海报。人像照片：{{img:人像照片;count<=1}}。参考图角色：${templateRecipeToken(context, 'reference-image-role', ['Image 1 唯一身份基准', '忽略背景路人'])}。身份保真策略：${templateRecipeToken(context, 'identity-lock-policy', ['唯一身份锚点', '保留脸部辨识度', '只改变服装/配饰/场景'])}。主体必须 100% 还原上传人像的面部特征、脸型比例、肤色、发型、表情和身份识别点，只改变眼镜款式展示，不改变人物本身。\n\n自动分析脸型、五官比例、眉眼距离、鼻梁高度和面部线条：${templateRecipeToken(context, 'portrait-analysis-focus', ['脸型', '眉眼距离', '鼻梁高度', '脸宽比例'])}，然后生成适合与不适合的眼镜推荐。试穿试戴展示策略：${templateRecipeToken(context, 'tryon-display-policy', ['同一张脸并排对比', '只改变眼镜款式', '眼镜贴合鼻梁耳部'])}。使用同一张脸展示并排的眼镜试戴效果对比：${templateRecipeToken(context, 'infographic-layout', ['并排对比', '圆角信息卡'])}。对比标签：${templateRecipeToken(context, 'comparison-labels', ['推荐', '普通', '避免', '修饰脸型'])}。每组可展示 2-4 种镜框，镜框示例应根据实际脸型自动判断，包括圆框、方框、猫眼、飞行员、细金属框、粗框、半框或无框等。\n\n版面设计干净、现代、极简，以视觉呈现为主。标题“{{str:标题;default=眼镜搭配指南;length<60}}”清晰完整；使用圆角卡片、细线条、微妙阴影、清晰标签和高级杂志风排版。文字策略：${templateRecipeToken(context, 'text-clarity-policy', ['只保留短标签', '标题必须可读'])}，不要长段说明。\n\n必须让眼镜真实贴合脸部透视、鼻梁、耳部和脸宽，不要漂浮或遮挡眼睛。风格：${templateRecipeToken(context, 'visual-style-direction', ['极简主义', '商业海报'])}，构图：${templateRecipeToken(context, 'composition', ['对称构图', '层次分明'])}，色调：${templateRecipeToken(context, 'color-tone', ['高端灰', '清新明亮'])}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，人物不像原图，脸型改变，眼镜漂浮，镜框透视错误，镜腿缺失，遮挡眼睛，推荐不分组，文字乱码，长段文字，卡片拥挤，低端广告模板，过度美颜`,
      styleText: '同一张脸做眼镜试戴对比，适合/不适合分组清楚，极简高级信息图。',
    }),
  },
  {
    id: 'image-personal-color-analysis-card',
    kind: 'image',
    categoryId: 'portrait-analysis',
    categoryName: { zh: '人像分析图卡', en: 'Portrait Analysis Cards' },
    name: { zh: '个人色彩分析图卡', en: 'Personal color analysis card' },
    description: { zh: '根据上传人像保留真实特征，展示适合色与不适合色的服装上身对比。', en: 'Preserves portrait identity and compares flattering vs unflattering clothing colors.' },
    preview: { zh: '左右/并排对比、推荐/普通/避免短标签、专业形象顾问报告风。', en: 'Side-by-side comparison, recommendation labels, and professional image-consultant report style.' },
    build: (context) => ({
      prompt: `根据上传人像制作一张高质感个人色彩分析图卡。人像照片：{{img:人像照片;count<=1}}。参考图角色：${templateRecipeToken(context, 'reference-image-role', ['Image 1 唯一身份基准', '辅助图只校正光线角度', '多宫格同一张脸'])}。人像报告类型：${templateRecipeToken(context, 'portrait-report-type', ['个人色彩分析报告'])}。身份保真策略：${templateRecipeToken(context, 'identity-lock-policy', ['唯一身份锚点', '保留脸部辨识度', '多图保持同一张脸'])}。必须保留主角原本五官、肤色、脸型、真实气质、发型和身份识别点，不要改变成另一个人。\n\n自动分析主角肤色冷暖、明度、饱和度、发色和五官对比度：${templateRecipeToken(context, 'portrait-analysis-focus', ['肤色冷暖', '肤色明度', '发色', '瞳色', '面部对比度', '气质关键词'])}。色彩分析结果策略：${templateRecipeToken(context, 'color-analysis-result-policy', ['自动分析但标注维度', '展示个人季型', '推荐/普通/避免色'])}。通过左右或并排对比方式展示不同服装颜色穿在主角身上的效果。试穿展示策略：${templateRecipeToken(context, 'tryon-display-policy', ['同一张脸并排对比', '只改变衣服颜色', '头颈肩关系协调'])}。清楚区分对比标签：${templateRecipeToken(context, 'comparison-labels', ['最适合', '普通', '不建议', '显白', '显暗沉'])}，让人一眼看出哪些颜色最衬肤色、提升气色与整体质感，哪些颜色显暗沉、显疲惫或压低气质。\n\n画面主体可以使用同一人像的 3-6 个并排小试穿效果，也可以使用中心人像搭配两侧色彩推荐卡。版式：${templateRecipeToken(context, 'infographic-layout', ['并排对比', '色板矩阵', '竖版报告页'])}。报告模块：${templateRecipeToken(context, 'report-sections', ['个人特征分析', '色彩季型判断', '上身颜色对比', '专属色盘'])}。服装颜色由系统根据照片自动选择，也可参考用户指定色组：{{arr:指定色组;itemType=string;length<12}}。\n\n版面设计干净时尚，像专业形象顾问报告或高级社群分享图卡。使用清晰排版、圆角卡片、色板/色块、细线条和微妙阴影；信息以视觉呈现为主。标题“{{str:标题;default=个人色彩分析;length<80}}”清晰完整。文字策略：${templateRecipeToken(context, 'text-clarity-policy', ['只保留短标签', '标题必须可读', '色卡只写颜色名'])}。风格：${templateRecipeToken(context, 'visual-style-direction', ['商业海报', '极简主义'])}，构图：${templateRecipeToken(context, 'composition', ['层次分明', '留白构图'])}，色调：${templateRecipeToken(context, 'color-tone', ['清新明亮', '高端灰'])}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，人物不像原图，肤色被严重改变，脸型变化，服装颜色对比不明显，推荐和避免混乱，长段文字，文字乱码，卡片拥挤，低端模板感，过度美颜，色块脏乱`,
      styleText: '上传人像真实保留，做适合色/普通/避免色的服装上身对比，专业形象顾问图卡风。',
    }),
  },
  {
    id: 'image-personal-color-report-visualization',
    kind: 'image',
    categoryId: 'portrait-analysis',
    categoryName: { zh: '人像分析图卡', en: 'Portrait Analysis Cards' },
    name: { zh: '个人色彩报告结果可视化', en: 'Personal color report visualization' },
    description: { zh: '从已确认个人色彩报告样本人工整理，重点是结果排版而不是重新判断。', en: 'Manually distilled from confirmed personal color report samples, focusing on visualizing results rather than re-judging.' },
    preview: { zh: '身份保真、已确认季型、适合/普通/不建议色、妆发饰品建议和中文短标签。', en: 'Identity lock, confirmed season type, recommended/ordinary/avoid colors, styling advice, and short Chinese labels.' },
    build: (context) => ({
      prompt: `根据上传人像和已确认的个人色彩分析结果，生成一张高质感「个人色彩分析报告」海报。人像照片：{{img:人像照片;count<=3}}。已确认分析结果：{{str:已确认分析结果;length<7000}}。\n\n重点：这是结果可视化，不是重新分析。色彩分析结果策略：${templateRecipeToken(context, 'color-analysis-result-policy', ['结果可视化', '不要重新判断', '严格按已确认结果'])}。如果用户提供了季型、适合色、不建议色、妆发饰品建议，必须严格按用户内容排版，不要新增结论、不要自由发挥。\n\n参考图角色：${templateRecipeToken(context, 'reference-image-role', ['Image 1 唯一身份基准', '辅助图只校正光线角度', '多宫格同一张脸'])}。身份保真策略：${templateRecipeToken(context, 'identity-lock-policy', ['唯一身份锚点', '保留脸部辨识度', '保持脸型发际线眉眼距离'])}。只识别 Image 1 中最清晰、最大、最居中的主角色；剔除背景路人、镜面反射人物和屏幕/海报人像。所有主图、Before 小图、上身颜色对比和缩略图必须是同一张脸。允许自然调整头部角度以适配服装，但头、脖子、肩线和身体朝向要协调，不能硬贴原图头部。\n\n报告模块：${templateRecipeToken(context, 'report-sections', ['个人特征分析', '色彩季型判断', '上身颜色对比', '专属色盘', '最显白Top5', '最提气色Top5', '妆容色彩建议', '发色方向建议', '饰品材质建议'])}。人像分析维度：${templateRecipeToken(context, 'portrait-analysis-focus', ['肤色冷暖', '肤色明度', '发色', '瞳色', '面部对比度', '气质关键词'])}。上身颜色对比：${templateRecipeToken(context, 'tryon-display-policy', ['同一张脸并排对比', '只改变衣服颜色', '小图身份不稳则减少数量'])}。对比标签：${templateRecipeToken(context, 'comparison-labels', ['最适合', '普通', '不建议', '显白', '显疲惫', '显高级'])}。\n\n版面采用清新高级手绘手帐风 + 专业形象顾问报告感。纸张印刷质感：${templateRecipeToken(context, 'print-texture', ['纸张颗粒', '胶带拼贴', '拍立得边框', '手写感标题'])}。整体以米白、奶油白、浅杏色或用户指定配色为底：{{str:版面配色;default=米白、奶油白、浅杏色、冷灰蓝点缀;length<220}}。使用圆角卡片、色板矩阵、柔和阴影和高级留白。信息图布局：${templateRecipeToken(context, 'infographic-layout', ['竖版报告页', '色板矩阵', '并排对比', '图标+短标签'])}。\n\n文字清晰策略：${templateRecipeToken(context, 'text-clarity-policy', ['只保留短标签', '每行不超过8个汉字', '标题必须可读', '色卡只写颜色名'])}。必须可读文字优先保留：{{arr:必须可读文字;itemType=string;length<16;default=个人色彩分析报告,个人特征分析,色彩季型判断,上身颜色对比,专属色盘,最适合,普通,不建议,结论}}。不要把长段分析直接排进图里；无法保证清晰的小字用色块、短线、图标或留白替代。画幅：${templateRecipeToken(context, 'image-aspect-ratio', ['4:5 社媒竖图', 'A4 竖版'])}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，重新判断用户结论，新增未提供结论，人物不像原图，换脸，网红脸，肤色严重改变，多宫格不是同一人，长段正文，小字乱码，伪中文，淘宝详情页风，廉价模板感，过度花哨，高饱和脏色，卡片拥挤`,
      styleText: '个人色彩报告结果可视化，身份保真，严格按已确认结论排版，用短标签、色卡和试穿对比表达。',
    }),
  },
  {
    id: 'image-symbolic-outline-universe-poster',
    kind: 'image',
    categoryId: 'narrative-poster',
    categoryName: { zh: '收藏叙事海报', en: 'Collectible Narrative Posters' },
    name: { zh: '轮廓宇宙收藏海报', en: 'Symbolic outline universe poster' },
    description: { zh: '从“主题宇宙依附象征轮廓展开”的收藏版叙事海报中蒸馏。', en: 'Distilled from collectible narrative posters where a themed universe grows within a symbolic outline.' },
    preview: { zh: '自动选择最匹配主题的轮廓载体，内部生长完整叙事世界。', en: 'Chooses a theme-matched outline carrier and grows a full narrative world inside it.' },
    build: (context) => ({
      prompt: `根据主题“{{str:主题;default=权力的游戏;length<180}}”生成一张高审美的轮廓宇宙 / 收藏版叙事海报。叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['主题轮廓宇宙'])}。不要默认瓶子、沙漏、玻璃罩、怀表等常规容器；请根据主题自动选择最有象征意义、轮廓最强、最能承载完整叙事世界的主轮廓载体。\n\n主轮廓可以从器物、建筑、门、塔、拱门、穹顶、楼梯井、长廊、雕像、侧脸、眼睛、手掌、头骨、羽翼、面具、镜面、王座、圆环、裂缝、光幕、阴影、几何结构、空间切面、舞台框景或抽象符号中选择，也可以创造更贴合主题的结构。轮廓必须清晰、优雅、有辨识度，占据构图核心。海报层级：${templateRecipeToken(context, 'poster-hierarchy', ['巨型轮廓第一主体', '内部细节不拥挤', '大面积留白'])}。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['小人物放大空间尺度', '边缘呼吸感', '不要平均铺满'])}。\n\n轮廓内部或边界中自然生长完整主题世界：{{arr:主题叙事元素;itemType=string;length<18}}。双曝融合方式：${templateRecipeToken(context, 'double-exposure-fusion', ['轮廓内部生长', '符号沿边界生长', '不要素材堆叠'])}。内部世界组织：${templateRecipeToken(context, 'inner-world-composition', ['标志性场景', '核心建筑', '角色关系', '远中近景递进', '自然生长于轮廓'])}。内容应包含标志性场景、核心建筑/空间结构、象征符号、角色关系或文明痕迹、远中近景递进、命运感氛围，以及门、台阶、桥、水面、烟雾、路径、光源、遗迹、自然景观、生物或道具等叙事细节。所有元素必须统一、自然、有主次，像世界真实孕育在轮廓结构之中。\n\n整体风格融合收藏版电影海报、高级叙事视觉设计、梦幻水彩和纸张印刷品气质。纸张印刷质感：${templateRecipeToken(context, 'print-texture', ['纸张颗粒', '边缘飞白', '水彩刷痕'])}。色彩方向：{{str:色彩方向;default=低饱和黑金灰、冷蓝灰、雾白灰、暗铜与旧纸色;length<260}}。可低调加入标题、编号、签名或落款“{{str:落款;length<80}}”，文字策略：${templateRecipeToken(context, 'text-clarity-policy', ['少量关键信息', '标题必须可读'])}。构图：${templateRecipeToken(context, 'composition')}，细节：${templateRecipeToken(context, 'detail-level')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，普通容器套路，瓶子沙漏玻璃罩优先，背景拼接，生硬裁切，模板化奇幻素材，游戏宣传图感，过度卡通化，塑料数码感，高饱和廉价霓虹，形式大于内容，轮廓不清，内部世界杂乱`,
      styleText: '收藏版轮廓宇宙海报，强象征主轮廓内自然生长完整主题世界，安静宏大、纸张水彩质感。',
    }),
  },
  {
    id: 'image-side-face-silhouette-epic',
    kind: 'image',
    categoryId: 'narrative-poster',
    categoryName: { zh: '收藏叙事海报', en: 'Collectible Narrative Posters' },
    name: { zh: '侧脸剪影史诗叙事海报', en: 'Side-face silhouette epic poster' },
    description: { zh: '从巨大人物侧脸剪影、内部世界观填充、梦幻水彩和签名落款中蒸馏。', en: 'Distilled from giant side-face silhouettes filled with inner worlds, watercolor, and signature marks.' },
    preview: { zh: '适合时代篇章、人物群像、历史叙事和收藏版海报。', en: 'For era chapters, character ensembles, historical narratives, and collectible posters.' },
    build: (context) => ({
      prompt: `根据主题“{{str:主题;default=民国篇;length<180}}”生成一张收藏版史诗叙事海报。画面使用巨大、优雅的人物侧脸剪影作为外轮廓：{{str:侧脸身份;length<260}}。叙事载体：${templateRecipeToken(context, 'narrative-carrier', ['人物侧脸剪影'])}。侧脸轮廓必须清晰、安静、庄重，成为第一眼记忆点。\n\n剪影内部自动生长出最契合主题的完整世界观、标志性场景、角色关系、象征符号、关键建筑、生物/道具和氛围层次：{{arr:内部世界元素;itemType=string;length<18}}。双曝融合方式：${templateRecipeToken(context, 'double-exposure-fusion', ['剪影填充式叙事', '边界雾化过渡', '拼贴但不硬裁切'])}。内部世界组织：${templateRecipeToken(context, 'inner-world-composition', ['标志性场景', '角色关系', '文明痕迹', '远中近景递进'])}。这不是普通拼贴，而是高级的剪影轮廓填充式叙事合成，带有双重曝光联想，但更偏电影海报与梦幻水彩插画融合。内部世界需要有远景、中景、近景递进，角色关系和文明痕迹自然嵌入，不杂乱、不硬拼。\n\n整体使用柔和空气透视、轻雾化过渡、纸张颗粒、边缘飞白和刷痕，大面积留白，版式克制高级：${templateRecipeToken(context, 'print-texture', ['纸张颗粒', '边缘飞白', '水彩刷痕'])}，海报层级：${templateRecipeToken(context, 'poster-hierarchy', ['巨型轮廓第一主体', '大面积留白', '底部署名/印章'])}。动线与留白：${templateRecipeToken(context, 'visual-flow-whitespace', ['中心纪念碑稳定', '底部落款安全区', '边缘呼吸感'])}。氛围安静、宏大、神圣、怀旧、诗意、传说感强。色彩方向：{{str:色彩方向;default=旧纸米白、雾灰、褐红、暗铜、低饱和蓝灰;length<220}}。\n\n自然加入专属签名“{{str:专属签名;default=你的签名;length<80}}”，作为海报设计的一部分，位置低调但清晰，可在左下角、右下角或标题附近；文字策略：${templateRecipeToken(context, 'text-clarity-policy', ['少量关键信息', '标题必须可读'])}。构图：${templateRecipeToken(context, 'composition', ['留白构图', '层次分明'])}，细节：${templateRecipeToken(context, 'detail-level')}，质量：${templateRecipeToken(context, 'image-quality')}。`,
      negativePrompt: `${templateRecipeToken(context, 'negative-quality')}，剪影轮廓不清，普通拼贴，硬裁切，模板化背景，廉价奇幻素材，元素与主题无关，画面杂乱，签名突兀，文字乱码，过度写实失去艺术感，过度卡通化`,
      styleText: '巨大侧脸剪影内部生长时代叙事世界，梦幻水彩、纸张颗粒、低饱和怀旧色。',
    }),
  },
  {
    id: 'agent-research',
    kind: 'agent',
    categoryId: 'agent-workflow',
    categoryName: { zh: 'Agent 工作流', en: 'Agent Workflow' },
    name: { zh: '资料研究', en: 'Research agent' },
    description: { zh: '收集、核对、整理资料并输出结论。', en: 'Collects, verifies, organizes sources, and outputs conclusions.' },
    preview: { zh: '含研究计划、来源评估、结论、证据和残余风险。', en: 'Includes research plan, source evaluation, conclusions, evidence, and residual risks.' },
    build: (context) => ({
      system: `你是${templateRecipeToken(context, 'agent-role')}，负责围绕用户问题完成资料研究、交叉核验和结构化输出。你必须区分事实、推断和建议；不能把未经验证的信息写成确定结论。\n\n工作方式：\n- 执行流程：${templateRecipeToken(context, 'execution-flow')}\n- 工具策略：${templateRecipeToken(context, 'tool-use-policy')}\n- 澄清策略：${templateRecipeToken(context, 'clarification-policy')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n- 验收标准：${templateRecipeToken(context, 'acceptance-criteria')}\n\n执行规范：\n1. 先给研究范围和判断口径，再进入结论。\n2. 重要结论必须附证据或说明证据不足。\n3. 遇到时间敏感、法律、医疗、财务等高风险内容，要显式提示验证边界。\n4. 输出可执行下一步，不停留在泛泛总结。`,
      user: `研究主题：{{str:研究主题;length<200}}\n背景资料：{{str:背景;length<3000}}\n需要回答的问题：{{arr:待确认问题;itemType=string;length<10}}\n限制条件：{{arr:约束条件;itemType=string;length<8}}\n期望用途：{{str:交付用途;length<200}}\n\n请输出：\n1. 研究范围与判断口径。\n2. 核心结论，按可信度排序。\n3. 证据表：结论 / 证据 / 来源或材料位置 / 可信度 / 备注。\n4. 分歧、未知点和残余风险。\n5. 可执行建议和下一步资料需求。`,
    }),
  },
  {
    id: 'agent-code-review',
    kind: 'agent',
    categoryId: 'agent-workflow',
    categoryName: { zh: 'Agent 工作流', en: 'Agent Workflow' },
    name: { zh: '代码审阅', en: 'Code review agent' },
    description: { zh: '按风险优先审阅代码、变更和测试缺口。', en: 'Reviews code, changes, and test gaps by risk priority.' },
    preview: { zh: '按严重程度输出真实缺陷、影响、位置、修复和测试缺口。', en: 'Finds real defects by severity with impact, location, fix, and test gaps.' },
    build: (context) => ({
      system: `你是代码审阅 Agent。你的目标是发现会导致真实问题的缺陷，而不是泛泛评价代码风格。优先级依次为：数据丢失、安全风险、权限绕过、行为回归、并发/边界问题、性能退化、测试缺口。\n\n审阅设置：\n- 审阅深度：${templateRecipeToken(context, 'review-depth')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n- 工具策略：${templateRecipeToken(context, 'tool-use-policy')}\n- 验收标准：${templateRecipeToken(context, 'acceptance-criteria')}\n\n输出规范：发现必须包含文件/位置、触发条件、用户影响、修复建议和验证方式。没有发现问题时，明确说明审阅范围和剩余风险。`,
      user: `请审阅以下变更。\n\n变更目标：{{str:变更摘要;length<1500}}\n相关代码/差异：{{str:代码变更;length<9000}}\n运行环境/依赖：{{str:运行环境;length<800}}\n重点关注：{{arr:审阅重点;itemType=string;length<10}}\n已有测试：{{str:已有测试;length<1200}}\n\n请输出：\n1. Findings：按严重程度排序，每条包含位置、问题、影响、建议。\n2. Missing tests：指出最需要补的测试。\n3. Open questions：只有在影响判断时才列。\n4. Summary：简短说明变更总体风险。`,
    }),
  },
  {
    id: 'agent-requirements',
    kind: 'agent',
    categoryId: 'agent-workflow',
    categoryName: { zh: 'Agent 工作流', en: 'Agent Workflow' },
    name: { zh: '需求分析', en: 'Requirements agent' },
    description: { zh: '澄清需求、拆范围、列验收标准和风险。', en: 'Clarifies requirements, scopes work, lists acceptance criteria and risks.' },
    preview: { zh: '把模糊需求变成范围、流程、规则、风险和验收清单。', en: 'Turns vague requests into scope, flows, rules, risks, and acceptance criteria.' },
    build: (context) => ({
      system: `你是需求分析 Agent，负责把模糊需求转为可执行、可评审、可验收的规格。你要主动拆解范围、流程、状态、权限、边界和风险；只有关键歧义会改变方案时才先提问。\n\n工作约束：\n- 澄清策略：${templateRecipeToken(context, 'clarification-policy')}\n- 执行流程：${templateRecipeToken(context, 'execution-flow')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n- 验收标准：${templateRecipeToken(context, 'acceptance-criteria')}\n\n要求：不要只复述需求；必须给出可执行拆解。所有假设都要标明，并说明如果假设不成立会影响什么。`,
      user: `需求原文：{{str:需求;length<5000}}\n目标用户：{{str:用户群体;length<240}}\n业务目标：{{str:目标;length<400}}\n现有系统/约束：{{str:系统背景;length<2000}}\n优先级或截止时间：{{str:优先级截止时间;length<200}}\n\n请输出：\n1. 需求摘要和目标。\n2. 用户角色与使用场景。\n3. 本期范围 / 非本期范围 / 可能的后续扩展。\n4. 主流程和异常流程。\n5. 数据、状态、权限和配置规则。\n6. 边界情况与风险。\n7. 关键待确认问题，按阻塞程度排序。\n8. 验收标准，能直接交给开发和测试。`,
    }),
  },
  {
    id: 'agent-support',
    kind: 'agent',
    categoryId: 'agent-workflow',
    categoryName: { zh: 'Agent 工作流', en: 'Agent Workflow' },
    name: { zh: '客服问答', en: 'Support agent' },
    description: { zh: '面向用户问题给出稳妥、清晰、可执行答复。', en: 'Provides safe, clear, actionable answers to user questions.' },
    preview: { zh: '先分类问题，再给直接答复、排查步骤、补充信息和升级条件。', en: 'Classifies issue, then gives answer, troubleshooting, needed info, and escalation.' },
    build: (context) => ({
      system: `你是客服专家。你的答复要友好、准确、可执行，不承诺无法确认的信息，不把责任推给用户。先判断问题类型和紧急程度，再给最短可行解决路径。\n\n策略：\n- 澄清策略：${templateRecipeToken(context, 'clarification-policy')}\n- 信息来源：${templateRecipeToken(context, 'source-handling')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n- 文本禁用项：${templateRecipeToken(context, 'text-avoidance')}\n\n要求：当信息不足时，先给可尝试步骤，再列最少必要追问；涉及退款、隐私、安全、法律承诺时保持边界。`,
      user: `用户问题：{{str:用户问题;length<1800}}\n产品/服务背景：{{str:产品背景;length<3000}}\n用户已尝试操作：{{str:已尝试方案;length<1000}}\n账户/订单/设备信息：{{str:用户背景;length<1000}}\n内部处理规则：{{str:规则政策;length<1500}}\n\n请输出：\n1. 问题分类和优先级。\n2. 给用户的直接答复，语气自然，可直接发送。\n3. 排查步骤，按最可能有效的顺序。\n4. 需要用户补充的信息，最多 5 项。\n5. 升级条件和转人工说明。\n6. 内部备注：风险、证据和后续跟进。`,
    }),
  },
  {
    id: 'agent-test-plan',
    kind: 'agent',
    categoryId: 'agent-workflow',
    categoryName: { zh: 'Agent 工作流', en: 'Agent Workflow' },
    name: { zh: '测试计划', en: 'Test planning agent' },
    description: { zh: '把需求或变更转成测试场景和验收清单。', en: 'Turns requirements or changes into test scenarios and acceptance checklists.' },
    preview: { zh: '覆盖正常路径、边界、异常、权限、回归和验收清单。', en: 'Covers happy paths, boundaries, failures, permissions, regression, and acceptance.' },
    build: (context) => ({
      system: `你是测试工程师 Agent。你要把需求、代码变更或缺陷修复转成可执行测试计划，覆盖正向路径、边界、异常、权限、兼容性、数据一致性和回归风险。\n\n要求：\n- 审阅深度：${templateRecipeToken(context, 'review-depth')}\n- 内容结构：${templateRecipeToken(context, 'content-structure')}\n- 验收标准：${templateRecipeToken(context, 'acceptance-criteria')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n\n输出的测试场景必须能被 QA 或开发直接执行；缺少环境或数据时列出准备条件。`,
      user: `需求/变更说明：{{str:变更需求;length<5000}}\n关键流程：{{arr:关键流程;itemType=string;length<10}}\n风险点：{{arr:风险区域;itemType=string;length<10}}\n影响模块：{{arr:影响模块;itemType=string;length<12}}\n已有测试/历史问题：{{str:测试历史;length<1500}}\n\n请输出：\n1. 测试范围和不测范围。\n2. 测试前置条件和测试数据。\n3. 测试场景表：场景 / 步骤 / 预期结果 / 优先级 / 类型。\n4. 边界和异常场景。\n5. 权限、并发、兼容性和数据一致性检查。\n6. 回归测试点。\n7. 验收清单和上线风险。`,
    }),
  },
  {
    id: 'agent-project-execution',
    kind: 'agent',
    categoryId: 'agent-workflow',
    categoryName: { zh: 'Agent 工作流', en: 'Agent Workflow' },
    name: { zh: '项目执行', en: 'Project execution agent' },
    description: { zh: '把目标拆成计划、执行顺序、验证和交付说明。', en: 'Breaks goals into plan, execution order, validation, and delivery notes.' },
    preview: { zh: '含计划、执行顺序、风险控制、验证方式和交付说明。', en: 'Includes plan, execution order, risk control, validation, and delivery notes.' },
    build: (context) => ({
      system: `你是项目执行 Agent。你要把目标拆成可执行步骤，主动推进任务，及时暴露阻塞，完成后给出验证结果和交付说明。遇到关键歧义时先问；普通细节用明确假设继续推进。\n\n工作方式：\n- 执行流程：${templateRecipeToken(context, 'execution-flow')}\n- 工具策略：${templateRecipeToken(context, 'tool-use-policy')}\n- 澄清策略：${templateRecipeToken(context, 'clarification-policy')}\n- 验收标准：${templateRecipeToken(context, 'acceptance-criteria')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n\n要求：计划要体现先后依赖；执行要保留关键决策；验证要说明方法和结果；交付说明要让接手人知道改了什么、如何检查、剩余风险是什么。`,
      user: `任务目标：{{str:任务目标;length<800}}\n上下文：{{str:背景;length<5000}}\n约束：{{arr:约束条件;itemType=string;length<10}}\n可用资源/工具：{{arr:资源;itemType=string;length<10}}\n期望交付：{{str:交付物;length<800}}\n验收标准：{{arr:验收标准;itemType=string;length<10}}\n\n请输出并按此方式执行：\n1. 任务理解和关键假设。\n2. 分阶段计划，标明依赖和风险。\n3. 立即执行步骤，优先处理阻塞路径。\n4. 验证方式和结果记录。\n5. 最终交付说明：变更、使用方式、测试情况、剩余风险。`,
    }),
  },
  {
    id: 'agent-image-creative-director',
    kind: 'agent',
    categoryId: 'visual-agent',
    categoryName: { zh: '视觉 Agent', en: 'Visual Agent' },
    name: { zh: '图像创意总监', en: 'Image creative director' },
    description: { zh: '把创意需求转为可执行的图片生成方案、提示词和审查清单。', en: 'Turns visual briefs into image plans, prompts, and QA checklists.' },
    preview: { zh: '适合电商、海报、概念图、角色、图生图编辑前的提示词编译。', en: 'For ecommerce, posters, concept art, characters, and image edits.' },
    build: (context) => ({
      system: `你是图像创意总监、摄影指导、美术指导、构图师和提示词编译器。你要把用户需求转成可直接用于图片生成模型的生产级提示词，并给出质量审查清单。\n\n视觉变量：\n- 主体类型：${templateRecipeToken(context, 'subject-type')}\n- 场景类型：${templateRecipeToken(context, 'scene-type')}\n- 设计用途：${templateRecipeToken(context, 'design-use')}\n- 画面风格：${templateRecipeToken(context, 'visual-style-direction')}\n- 构图：${templateRecipeToken(context, 'composition')}\n- 光线：${templateRecipeToken(context, 'lighting')}\n- 质量：${templateRecipeToken(context, 'image-quality')}\n- 负面约束：${templateRecipeToken(context, 'negative-quality')}\n\n工作方式：\n- 执行流程：${templateRecipeToken(context, 'execution-flow')}\n- 澄清策略：${templateRecipeToken(context, 'clarification-policy')}\n- 验收标准：${templateRecipeToken(context, 'acceptance-criteria')}\n\n要求：先识别任务类型，再输出正向提示词、负面提示词、参数建议和验收清单。不要输出空泛审美建议。`,
      user: `视觉需求：{{str:视觉需求;length<3000}}\n用途/平台：{{str:使用平台;length<200}}\n参考图：{{img:参考图;count<=6}}\n参考图说明：{{str:参考说明;length<1500}}\n必须保留：{{arr:必须保留;itemType=string;length<12}}\n必须避免：{{arr:必须避免;itemType=string;length<12}}\n\n请输出：\n1. 任务类型判断和关键风险。\n2. 创意方向，说明主体、场景、构图、光影、色彩和风格。\n3. 可直接使用的正向提示词。\n4. 负面提示词。\n5. 图生图或参考图使用建议。\n6. 质量审查清单：身份、构图、材质、文字、品牌、分辨率、可商用风险。`,
    }),
  },
  {
    id: 'agent-storyboard-director',
    kind: 'agent',
    categoryId: 'visual-agent',
    categoryName: { zh: '视觉 Agent', en: 'Visual Agent' },
    name: { zh: '分镜导演 Agent', en: 'Storyboard director agent' },
    description: { zh: '将故事、参考图和视频需求拆成关键帧、镜头和联络单提示词。', en: 'Breaks stories, references, and video needs into keyframes and contact-sheet prompts.' },
    preview: { zh: '输出场景拆解、情绪弧线、镜头策略、关键帧提示词。', en: 'Outputs scene breakdown, emotional arc, camera plan, and keyframe prompts.' },
    build: (context) => ({
      system: `你是预告片导演、摄影指导和分镜 Agent。你负责把故事或参考图转成连贯的视频关键帧方案。输出必须可执行，所有镜头都要服务叙事节拍和视觉连续性。\n\n工作方式：\n- 执行流程：${templateRecipeToken(context, 'execution-flow')}\n- 工具策略：${templateRecipeToken(context, 'tool-use-policy')}\n- 澄清策略：${templateRecipeToken(context, 'clarification-policy')}\n- 回答结构：${templateRecipeToken(context, 'answer-shape')}\n\n分镜变量：\n- 分镜流程：${templateRecipeToken(context, 'storyboard-workflow', ['场景拆解', '主题与故事', '关键帧列表', '联络单输出'])}\n- 镜头字段：${templateRecipeToken(context, 'storyboard-shot-fields', ['镜头号', '建议时长', '镜头类型', '焦段', '画面调度/动作'])}\n- 连续性约束：${templateRecipeToken(context, 'storyboard-continuity', ['角色身份一致', '服装道具一致', '轴线原则', '视线匹配'])}\n\n视觉约束：镜头、光影、角色、服装、道具、环境和色调要保持连续；不能为了炫技牺牲故事逻辑。`,
      user: `故事/视频需求：{{str:故事或视频需求;length<4000}}\n参考图：{{img:参考图;count<=6}}\n参考图说明：{{str:参考说明;length<2000}}\n目标时长：{{str:目标时长;length<120}}\n关键情绪：{{arr:情绪;itemType=string;length<8}}\n必须出现的画面：{{arr:必备镜头;itemType=string;length<12}}\n\n请输出：\n1. 场景拆解：主体、环境、光影、视觉锚点。\n2. 主题、短梗概和情绪弧线。\n3. 镜头策略：景别演变、相机运动、焦段和景深。\n4. 关键帧表：编号、时长、镜头类型、构图、动作、相机、光影、提示词。\n5. 3x3 或 4x3 联络单提示词。\n6. 一致性锁定和负面约束。`,
    }),
  },
]

const inputSchema = z.object({
  siteTitle: z.string().min(1),
  description: z.string().min(1),
  getStarted: z.string().min(1),
  primary: z.string().min(1),
})

type InputForm = z.infer<typeof inputSchema>

function getZpmtPromptIconMeta(kind?: ZpmtPromptKind | null): { icon: LucideIcon; className: string; badge: string } {
  if (kind === 'chat') return { icon: MessageSquare, className: 'text-emerald-600', badge: 'CHAT' }
  if (kind === 'agent') return { icon: Workflow, className: 'text-cyan-600', badge: 'AGENT' }
  if (kind === 'image') return { icon: WandSparkles, className: 'text-[#d95a1b]', badge: 'IMG' }
  return { icon: WandSparkles, className: 'text-[#d95a1b]', badge: 'ccks' }
}

function getFileIconMeta(filePath: string, promptKind?: ZpmtPromptKind | null): { icon: LucideIcon; className: string; badge?: string } {
  if (isZpmtFilePath(filePath)) return getZpmtPromptIconMeta(promptKind)
  if (isZflowFilePath(filePath)) return { icon: Workflow, className: 'text-violet-600', badge: 'ZFLOW' }
  if (isZlexFilePath(filePath)) return { icon: Boxes, className: 'text-amber-600', badge: 'ZLEX' }
  if (isZamfFilePath(filePath)) return { icon: Bot, className: 'text-sky-500', badge: 'ZAMF' }
  if (filePath.toLowerCase().endsWith('.json')) return { icon: FileJson, className: 'text-slate-400' }
  return { icon: FileText, className: 'text-slate-400' }
}

function createNodeRenderer({
  activeFile,
  aiProviders,
  decorations,
  selectedPaths,
  dropTargetPath,
  onOpenFile,
  onNodeClick,
  onNodeContextMenu,
  onNodeDragStart,
  onNodeDragOver,
  onNodeDrop,
}: {
  activeFile: ProjectFileReference | null
  aiProviders: AiProviderSummary[]
  decorations: Record<string, GitDecoration>
  selectedPaths: string[]
  dropTargetPath: string | null
  onOpenFile: (file: ProjectFileReference) => void
  onNodeClick: (node: TreeNode, event: React.MouseEvent<HTMLElement>, actions: { toggle: () => void }) => void
  onNodeContextMenu: (node: TreeNode, event: React.MouseEvent<HTMLElement>) => void
  onNodeDragStart: (node: TreeNode, event: React.DragEvent<HTMLElement>) => void
  onNodeDragOver: (node: TreeNode, event: React.DragEvent<HTMLElement>) => void
  onNodeDrop: (node: TreeNode, event: React.DragEvent<HTMLElement>) => void
}) {
  const selectedPathSet = new Set(selectedPaths)
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
    const fileIcon = getFileIconMeta(filePath, data.promptKind)
    const isActive = isFile && activeFile?.projectId === data.projectId && activeFile?.path === data.path
    const isSelected = Boolean(data.path && selectedPathSet.has(data.path))
    const isDropTarget = !isFile && (data.path || '') === dropTargetPath
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

    function handleClick(event: React.MouseEvent<HTMLElement>) {
      onNodeClick(data, event, { toggle: node.toggle })
    }

    return (
      <div
        ref={draggable.setNodeRef}
        style={style}
        className={cn(
          'group flex cursor-default items-center gap-1.5 rounded px-2 text-xs',
          isActive ? 'bg-[#fff2ea] text-[#d95a1b]' : isSelected ? 'bg-slate-200/80 text-slate-900' : 'text-slate-700 hover:bg-slate-100',
          isDropTarget ? 'ring-1 ring-[#fb7e3d]/60 bg-[#fff2ea]' : '',
          isZamfFile && provider ? 'cursor-grab active:cursor-grabbing' : '',
          draggable.isDragging ? 'opacity-45' : '',
          decoration && !isActive ? getGitDecorationTextClass(decoration.kind) : '',
        )}
        title={data.path || data.name}
        draggable={Boolean(data.projectId && data.path && !(isZamfFile && provider))}
        onClick={handleClick}
        onContextMenu={(event) => {
          event.preventDefault()
          onNodeContextMenu(data, event)
        }}
        onDragStart={(event) => onNodeDragStart(data, event)}
        onDragOver={(event) => onNodeDragOver(data, event)}
        onDrop={(event) => onNodeDrop(data, event)}
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
  locale,
  modelCapabilities,
}: {
  t: WorkbenchCopy
  locale: Locale
  modelCapabilities: ZpmtModelCapabilityGate
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2">
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

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-slate-900">{t.constantVariables}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{t.constantVariableHint}</p>
          </div>
          <Badge variant="outline" className="shrink-0">{ZPMT_CONSTANTS.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {ZPMT_CONSTANTS.length ? (
            ZPMT_CONSTANTS.map((item) => {
              const payload: InstructionDragPayload = { kind: 'constant', item }
              return (
                <TooltipAnchor key={item.id} tooltip={item.description[locale]} className="inline-flex">
                  <DraggableInstructionTag
                    id={`constant:${item.id}`}
                    payload={payload}
                    title={item.name[locale]}
                    className={cn('prompt-token-chip h-7 cursor-grab outline-none transition active:cursor-grabbing focus:ring-2 focus:ring-[#FB7E3D]/20', getPromptTokenStyleClass('constant'))}
                  >
                    <span className="truncate">{item.name[locale]}</span>
                  </DraggableInstructionTag>
                </TooltipAnchor>
              )
            })
          ) : (
            <div className="text-xs font-semibold text-slate-500">{t.constantVariableEmpty}</div>
          )}
        </div>
      </section>
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
      : payload.kind === 'constant'
        ? payload.item.name[locale]
      : payload.item.name[locale]
  const styleKey: PromptTokenStyleKey = payload.kind === 'variable' ? payload.variableType : payload.kind === 'recipe' ? 'recipe' : payload.kind === 'constant' ? 'constant' : 'unknown'

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
  if (value.kind === 'constant') return isRecord(value.item) && typeof value.item.id === 'string'
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
      siteTitle: 'ccks',
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
  onEntriesMoved,
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
  onEntriesMoved: (projectId: string, moved: ProjectEntryMove[]) => void
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
            onEntriesMoved={onEntriesMoved}
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
  onEntriesMoved,
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
  onEntriesMoved: (projectId: string, moved: ProjectEntryMove[]) => void
}) {
  const [fileTreeViewportRef, fileTreeViewportHeight] = useMeasuredHeight<HTMLDivElement>()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const zipImportInputRef = useRef<HTMLInputElement | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)
  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null)
  const [zipImportDialog, setZipImportDialog] = useState<ZipImportDialogState | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [lastSelectedPath, setLastSelectedPath] = useState('')
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const [uploadTargetPath, setUploadTargetPath] = useState('')
  const fileTree = useMemo(() => (activeProject?.tree ? [activeProject.tree] : []), [activeProject?.tree])
  const flatFileTreePaths = useMemo(() => flattenProjectTreePaths(activeProject?.tree), [activeProject?.tree])
  const projectTreeNodeByPath = useMemo(() => buildProjectTreeNodeByPath(activeProject?.tree), [activeProject?.tree])
  const fileTreeHeight = Math.max(160, (fileTreeViewportHeight || 360) - 16)
  const gitActionBusy = Boolean(sourceControlBusyAction)
  const showGitActions = sourceControlConnected
  const NodeRenderer = useMemo(
    () =>
      createNodeRenderer({
        activeFile,
        aiProviders,
        decorations,
        selectedPaths,
        dropTargetPath,
        onOpenFile,
        onNodeClick: handleNodeClick,
        onNodeContextMenu: (node, event) => {
          updateSelectionForContextMenu(node)
          setContextMenu({ x: event.clientX, y: event.clientY, node })
        },
        onNodeDragStart: handleNodeDragStart,
        onNodeDragOver: handleNodeDragOver,
        onNodeDrop: handleNodeDrop,
      }),
    [activeFile, activeProject?.fileName, activeProject?.id, aiProviders, decorations, dropTargetPath, flatFileTreePaths, lastSelectedPath, onOpenFile, selectedPaths, t],
  )

  useEffect(() => {
    setSelectedPaths([])
    setLastSelectedPath('')
    setDropTargetPath(null)
  }, [activeProject?.id])

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
    if (response.file?.path && response.file?.projectId) {
      onOpenFile({
        projectId: String(response.file.projectId),
        path: String(response.file.path),
        name: String(response.file.name || entryDialog.name),
      })
    }
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
            promptKind: dialog.promptKind,
            outputType: dialog.outputType,
            provider,
            model: dialog.model,
            responseConfig: dialog.responseConfig,
          }),
        },
      })
    }

    if (dialog.mode === 'zflow') {
      const fileName = ensureZflowFileName(dialog.name)
      return fetchJson('/api/projects/files', {
        method: 'POST',
        body: {
          projectId,
          parentPath: dialog.folder.path || '',
          fileName,
          content: createZflowTemplate(fileName),
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

  function handleNodeClick(node: TreeNode, event: React.MouseEvent<HTMLElement>, actions: { toggle: () => void }) {
    const nodePath = node.path || ''
    const modifierSelection = event.shiftKey || event.ctrlKey || event.metaKey

    if (nodePath) {
      if (event.shiftKey && lastSelectedPath) {
        setSelectedPaths(selectProjectPathRange(flatFileTreePaths, lastSelectedPath, nodePath, selectedPaths))
        setLastSelectedPath(nodePath)
      } else if (event.ctrlKey || event.metaKey) {
        setSelectedPaths((current) => {
          const exists = current.includes(nodePath)
          return exists ? current.filter((item) => item !== nodePath) : uniqueProjectPaths([...current, nodePath])
        })
        setLastSelectedPath(nodePath)
      } else {
        setSelectedPaths([nodePath])
        setLastSelectedPath(nodePath)
      }
    } else if (!modifierSelection) {
      setSelectedPaths([])
      setLastSelectedPath('')
    }

    if (modifierSelection) return
    if (node.kind === 'file' && node.projectId && node.path) {
      onOpenFile({ projectId: node.projectId, path: node.path, name: node.name })
      return
    }
    actions.toggle()
  }

  function updateSelectionForContextMenu(node: TreeNode) {
    const nodePath = node.path || ''
    if (!nodePath) {
      setSelectedPaths([])
      setLastSelectedPath('')
      return
    }
    if (!selectedPaths.includes(nodePath)) {
      setSelectedPaths([nodePath])
      setLastSelectedPath(nodePath)
    }
  }

  function getActionPaths(node: TreeNode) {
    const nodePath = node.path || ''
    if (nodePath && selectedPaths.includes(nodePath)) return selectedPaths.filter(Boolean)
    return nodePath ? [nodePath] : []
  }

  function handleNodeDragStart(node: TreeNode, event: React.DragEvent<HTMLElement>) {
    if (!activeProject || !node.projectId || !node.path) {
      event.preventDefault()
      return
    }
    const paths = getActionPaths(node)
    if (!paths.length) {
      event.preventDefault()
      return
    }
    if (!paths.includes(node.path)) {
      setSelectedPaths([node.path])
      setLastSelectedPath(node.path)
    }

    const payload: ProjectEntryDragPayload = {
      kind: 'project-entry',
      projectId: activeProject.id,
      paths,
    }
    const rawDownload = paths.length === 1 && node.kind === 'file'
    const downloadUrl = buildProjectArchiveUrl(activeProject.id, paths, rawDownload)
    const downloadName = buildProjectDragDownloadName(activeProject.fileName, node, paths, rawDownload)
    const zpmtFiles = paths
      .filter(isZpmtFilePath)
      .map((path) => ({ path, promptKind: projectTreeNodeByPath[path]?.promptKind }))
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData(PROJECT_ENTRY_DRAG_MIME, JSON.stringify(payload))
    if (zpmtFiles.length) {
      event.dataTransfer.setData(
        ZPMT_FILE_DRAG_MIME,
        JSON.stringify({ kind: 'zpmt-files', projectId: activeProject.id, files: zpmtFiles, paths: zpmtFiles.map((file) => file.path) } satisfies ZpmtFileDragPayload),
      )
    }
    event.dataTransfer.setData('text/plain', paths.join('\n'))
    event.dataTransfer.setData('text/uri-list', downloadUrl)
    event.dataTransfer.setData('DownloadURL', `${rawDownload ? 'application/octet-stream' : PROJECT_ARCHIVE_MIME}:${downloadName}:${downloadUrl}`)
  }

  function handleNodeDragOver(node: TreeNode, event: React.DragEvent<HTMLElement>) {
    if (node.kind === 'file') return
    if (!hasProjectEntryDrag(event.dataTransfer) && !hasExternalFileDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = hasProjectEntryDrag(event.dataTransfer) ? 'move' : 'copy'
    setDropTargetPath(node.path || '')
  }

  function handleNodeDrop(node: TreeNode, event: React.DragEvent<HTMLElement>) {
    if (node.kind === 'file') return
    event.preventDefault()
    event.stopPropagation()
    setDropTargetPath(null)
    void handleProjectDrop(node.path || '', event.dataTransfer)
  }

  function handleProjectViewportDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasProjectEntryDrag(event.dataTransfer) && !hasExternalFileDrag(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = hasProjectEntryDrag(event.dataTransfer) ? 'move' : 'copy'
    setDropTargetPath('')
  }

  function handleProjectViewportDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!hasProjectEntryDrag(event.dataTransfer) && !hasExternalFileDrag(event.dataTransfer)) return
    event.preventDefault()
    setDropTargetPath(null)
    void handleProjectDrop('', event.dataTransfer)
  }

  async function handleProjectDrop(targetPath: string, dataTransfer: DataTransfer) {
    if (!activeProject) return
    const payload = readProjectEntryDragPayload(dataTransfer)
    if (payload?.projectId === activeProject.id) {
      await moveProjectPaths(payload.paths, targetPath)
      return
    }

    const files = await readDroppedProjectFiles(dataTransfer)
    if (!files.length) {
      onNotify(t.noFilesToUpload)
      return
    }
    await uploadProjectFilesToTarget(targetPath, files)
  }

  async function moveProjectPaths(paths: string[], targetPath: string, overwrite = false) {
    if (!activeProject) return
    const response = await fetchJson('/api/projects/entries/move', {
      method: 'PATCH',
      body: {
        projectId: activeProject.id,
        paths,
        targetPath,
        overwrite,
      },
    })

    if (response?.code === 'MOVE_CONFLICT' && Array.isArray(response.conflicts)) {
      const conflicts = normalizeProjectConflicts(response.conflicts)
      const action = resolveProjectConflictAction(conflicts)
      if (action === 'overwrite') {
        await moveProjectPaths(paths, targetPath, true)
      } else if (action === 'skip') {
        const conflictPaths = new Set(conflicts.map((item) => item.path))
        const rest = paths.filter((item) => !conflictPaths.has(item))
        if (rest.length) await moveProjectPaths(rest, targetPath, false)
      }
      return
    }

    if (!response?.ok || !response.project) {
      onNotify(response?.message || '文件移动失败')
      return
    }

    const moved = Array.isArray(response.moved) ? normalizeProjectMoves(response.moved) : []
    if (moved.length) {
      onEntriesMoved(activeProject.id, moved)
      setSelectedPaths(moved.map((item) => item.nextPath))
      setLastSelectedPath(moved[moved.length - 1]?.nextPath || '')
    }
    await onRefreshProjects(response.project.id)
    dispatchSourceControlRefresh()
    onNotify(t.moveSuccess, t.success)
  }

  function openUploadDialog(targetPath = '') {
    setUploadTargetPath(targetPath)
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
      uploadInputRef.current.click()
    }
  }

  async function handleUploadInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).map((file) => ({
      file,
      relativePath: normalizeBrowserRelativePath(file.webkitRelativePath || file.name),
    })).filter((item) => item.relativePath)
    event.target.value = ''
    await uploadProjectFilesToTarget(uploadTargetPath, files)
  }

  async function uploadProjectFilesToTarget(targetPath: string, files: ProjectUploadEntry[], overwrite = false) {
    if (!activeProject) return
    const normalizedFiles = files
      .map((item) => ({ ...item, relativePath: normalizeBrowserRelativePath(item.relativePath || item.file.name) }))
      .filter((item) => item.relativePath)
    if (!normalizedFiles.length) {
      onNotify(t.noFilesToUpload)
      return
    }

    const formData = new FormData()
    formData.append('projectId', activeProject.id)
    formData.append('targetPath', targetPath)
    formData.append('overwrite', overwrite ? 'true' : 'false')
    for (const item of normalizedFiles) {
      formData.append('files', item.file, item.file.name)
      formData.append('paths', item.relativePath)
    }

    const response = await fetch('/api/projects/upload', {
      method: 'POST',
      body: formData,
    })
      .then((result) => result.json().catch(() => null))
      .catch(() => null)

    if (response?.code === 'UPLOAD_CONFLICT' && Array.isArray(response.conflicts)) {
      const conflicts = normalizeProjectConflicts(response.conflicts)
      const action = resolveProjectConflictAction(conflicts)
      if (action === 'overwrite') {
        await uploadProjectFilesToTarget(targetPath, normalizedFiles, true)
      } else if (action === 'skip') {
        const conflictPaths = new Set(conflicts.map((item) => item.path))
        const rest = normalizedFiles.filter((item) => !conflictPaths.has(item.relativePath))
        if (rest.length) await uploadProjectFilesToTarget(targetPath, rest, false)
      }
      return
    }

    if (!response?.ok || !response.project) {
      onNotify(response?.message || '文件上传失败')
      return
    }

    await onRefreshProjects(response.project.id)
    dispatchSourceControlRefresh()
    onNotify(t.uploadSuccess, t.success)
  }

  function resolveProjectConflictAction(conflicts: ProjectEntryConflict[]): ProjectConflictAction {
    const countText = t.conflictCount.replace('{count}', String(conflicts.length))
    if (window.confirm(`${countText}\n${t.conflictOverwritePrompt}`)) return 'overwrite'
    if (window.confirm(`${countText}\n${t.conflictSkipPrompt}`)) return 'skip'
    return 'cancel'
  }

  async function downloadProjectArchive(paths: string[] = []) {
    if (!activeProject) return
    const response = await fetch(buildProjectArchiveUrl(activeProject.id, paths, false)).catch(() => null)
    if (!response?.ok) {
      const payload = await response?.json().catch(() => null)
      onNotify(payload?.message || t.archiveDownloadFailed)
      return
    }
    const blob = await response.blob()
    const filename = readDownloadFilename(response.headers.get('content-disposition')) || (paths.length ? `${activeProject.fileName}-selection.zip` : `${activeProject.fileName}.zip`)
    triggerBrowserDownload(blob, filename)
  }

  function handleZipInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const fileName = deriveProjectFileNameFromZip(file.name)
    setZipImportDialog({
      file,
      name: fileName || file.name.replace(/\.zip$/i, ''),
      fileName,
      busy: false,
    })
  }

  async function submitZipImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!zipImportDialog) return
    if (!isValidProjectFileName(zipImportDialog.fileName)) {
      onNotify(t.projectFileNameInvalid)
      return
    }
    if (!zipImportDialog.name.trim()) {
      onNotify(t.projectNameRequired)
      return
    }

    setZipImportDialog((current) => (current ? { ...current, busy: true } : current))
    const formData = new FormData()
    formData.append('file', zipImportDialog.file, zipImportDialog.file.name)
    formData.append('name', zipImportDialog.name.trim())
    formData.append('fileName', zipImportDialog.fileName.trim().toLowerCase())
    const response = await fetch('/api/projects/import-zip', {
      method: 'POST',
      body: formData,
    })
      .then((result) => result.json().catch(() => null))
      .catch(() => null)

    if (!response?.ok || !response.project) {
      setZipImportDialog((current) => (current ? { ...current, busy: false } : current))
      onNotify(response?.message || 'ZIP 项目导入失败')
      return
    }

    setZipImportDialog(null)
    await onRefreshProjects(response.project.id)
    dispatchSourceControlRefresh()
    onNotify(t.zipImportSuccess, t.success)
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

  const contextMenuPaths = contextMenu ? getActionPaths(contextMenu.node) : []

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
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            title={t.importZipProject}
            aria-label={t.importZipProject}
            disabled={loading}
            onClick={() => zipImportInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            title={t.exportProjectZip}
            aria-label={t.exportProjectZip}
            disabled={!activeProject || loading}
            onClick={() => void downloadProjectArchive()}
          >
            <Download className="h-3.5 w-3.5" />
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
      <input ref={zipImportInputRef} className="hidden" type="file" accept=".zip,application/zip" onChange={handleZipInputChange} />
      <input ref={uploadInputRef} className="hidden" type="file" multiple onChange={handleUploadInputChange} />

      {configDiagnostics.length ? (
        <div
          className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800"
          title={configDiagnostics.map((item) => `${item.path}: ${item.message}`).join('\n')}
        >
          {t.configDiagnostics}：{configDiagnostics.length}
        </div>
      ) : null}

      <div
        ref={fileTreeViewportRef}
        className={cn('relative min-h-0 flex-1 overflow-hidden p-2', dropTargetPath === '' && 'rounded-md bg-[#fff7f2] ring-1 ring-[#fb7e3d]/40')}
        onDragOver={handleProjectViewportDragOver}
        onDragLeave={() => setDropTargetPath(null)}
        onDrop={handleProjectViewportDrop}
      >
        {dropTargetPath === '' ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-md border border-dashed border-[#fb7e3d]/55 bg-white/90 px-2 py-1 text-[10px] font-bold text-[#d95a1b] shadow-sm">
            {t.dropFilesHere}
          </div>
        ) : null}
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
                icon={Workflow}
                label={t.newZflowFile}
                onClick={() => {
                  setEntryDialog({ mode: 'zflow', folder: contextMenu.node, name: '提示词流程.zflow' })
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
              <ContextMenuButton
                icon={Upload}
                label={t.uploadFiles}
                onClick={() => {
                  openUploadDialog(contextMenu.node.path || '')
                  setContextMenu(null)
                }}
              />
            </>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuButton
            icon={Download}
            label={contextMenuPaths.length > 1 ? t.downloadSelected : t.downloadArchive}
            onClick={() => {
              const paths = contextMenu.node.path ? contextMenuPaths : []
              setContextMenu(null)
              void downloadProjectArchive(paths)
            }}
          />
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

      {zipImportDialog ? (
        <ZipImportDialog
          t={t}
          dialog={zipImportDialog}
          onChange={setZipImportDialog}
          onClose={() => setZipImportDialog(null)}
          onSubmit={submitZipImport}
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

function ZipImportDialog({
  t,
  dialog,
  onChange,
  onClose,
  onSubmit,
}: {
  t: WorkbenchCopy
  dialog: ZipImportDialogState
  onChange: (dialog: ZipImportDialogState) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !dialog.busy) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog.busy, onClose])

  return (
    <div className="fixed inset-0 z-50" onMouseDown={() => !dialog.busy && onClose()}>
      <form
        className="absolute left-1/2 top-16 flex max-h-[72vh] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.zipImportTitle}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Upload className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">{t.zipImportTitle}</p>
              <p className="truncate text-[10px] text-slate-500">{dialog.file.name}</p>
            </div>
          </div>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={dialog.busy}
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            {t.zipFile}
            <Input className="mt-1" value={dialog.file.name} disabled />
          </label>
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            {t.projectName}
            <Input
              autoFocus
              className="mt-1"
              value={dialog.name}
              disabled={dialog.busy}
              onChange={(event) => onChange({ ...dialog, name: event.target.value })}
              required
            />
          </label>
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            {t.projectFileName}
            <Input
              className="mt-1"
              value={dialog.fileName}
              disabled={dialog.busy}
              onChange={(event) => onChange({ ...dialog, fileName: event.target.value.toLowerCase() })}
              placeholder="my-project"
              required
            />
          </label>
          <Button className="mt-2 w-full" size="sm" type="submit" disabled={dialog.busy}>
            {dialog.busy ? t.loading : t.importProject}
          </Button>
        </div>
      </form>
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
        : dialog.mode === 'zflow'
          ? t.newZflowFile
          : dialog.mode === 'lexicon'
            ? t.newLexiconFile
            : dialog.mode === 'provider'
              ? t.newProviderModelFile
              : t.rename
  const label = dialog.mode === 'folder' ? t.folderName : dialog.mode === 'rename' ? t.renameTo : t.fileName
  const submitLabel = dialog.mode === 'folder' ? t.createFolder : dialog.mode === 'rename' ? t.rename : t.createFile
  const Icon = dialog.mode === 'folder' ? FolderPlus : dialog.mode === 'rename' ? Pencil : dialog.mode === 'prompt' ? FilePlus2 : dialog.mode === 'zflow' ? Workflow : FileJson
  const compatibleModels = dialog.mode === 'prompt' ? listCompatibleModelsForProvider(aiProviders, dialog.providerId, dialog.outputType) : []
  const selectedModelContext = dialog.mode === 'prompt' ? getSelectedAiModelContext(aiProviders, dialog.providerId, dialog.model) : null
  const projectProviders = dialog.mode === 'prompt' ? aiProviders.filter((provider) => !isCommonAiProvider(provider)) : []
  const commonProviders = dialog.mode === 'prompt' ? aiProviders.filter(isCommonAiProvider) : []
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
                  value={dialog.promptKind}
                  className="mt-1 inline-flex h-7 w-fit max-w-full justify-start overflow-hidden rounded-md border border-border bg-card"
                  onValueChange={(value) => {
                    if (value === 'chat' || value === 'agent' || value === 'image') {
                      const outputType = value === 'image' ? 'image' : 'text'
                      const nextSelection = selectDefaultAiModel(aiProviders, outputType)
                      onChange({
                        ...dialog,
                        promptKind: value,
                        outputType,
                        providerId: nextSelection.providerRef,
                        model: nextSelection.model,
                        responseConfig: defaultResponseConfig(outputType, nextSelection.providerType, nextSelection.model, nextSelection.modelEntry),
                      })
                    }
                  }}
                >
                  <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="chat">{t.simplePrompt}</ToggleGroupItem>
                  <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="agent">{t.agentPrompt}</ToggleGroupItem>
                  <ToggleGroupItem className="shrink-0 whitespace-nowrap" value="image">{t.imagePromptFile}</ToggleGroupItem>
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
                  {projectProviders.length ? (
                    <optgroup label={t.projectProviderGroup}>
                      {projectProviders.map((provider) => (
                        <option key={getAiProviderRef(provider)} value={getAiProviderRef(provider)}>
                          {provider.filePath || provider.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {commonProviders.length ? (
                    <optgroup label={t.commonProviderGroup}>
                      {commonProviders.map((provider) => (
                        <option key={getAiProviderRef(provider)} value={getAiProviderRef(provider)}>
                          {provider.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
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

const EDITOR_MODES: StandardEditorMode[] = ['preview', 'assist', 'source', 'normal']

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

function ZflowModeSwitch({
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
      value={mode === 'source' ? 'source' : mode === 'run' ? 'run' : 'normal'}
      className="h-7 overflow-hidden rounded-md border border-border bg-card"
      aria-label="zflow mode"
      onValueChange={(value) => {
        if (value === 'source') onChange('source')
        if (value === 'normal') onChange('normal')
        if (value === 'run') onChange('run')
      }}
    >
      <ToggleGroupItem value="normal" aria-label={t.zflowCanvas}>
        {t.zflowCanvas}
      </ToggleGroupItem>
      <ToggleGroupItem value="source" aria-label={t.editorModes.source}>
        {t.editorModes.source}
      </ToggleGroupItem>
      <ToggleGroupItem value="run" aria-label={t.runningAgent}>
        运行
      </ToggleGroupItem>
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

  useEffect(() => {
    setTooltip(null)
  }, [content])

  useEffect(() => {
    function clearTooltip() {
      setTooltip(null)
    }
    window.addEventListener('blur', clearTooltip)
    return () => window.removeEventListener('blur', clearTooltip)
  }, [])

  function showTokenTooltip(target: HTMLElement, text: string) {
    setTooltip({ text, rect: target.getBoundingClientRect() })
  }

  return (
    <aside className="markdown-preview-panel">
      <div className="markdown-preview-panel__header">
        <FileText className="h-3.5 w-3.5 text-[#d95a1b]" />
        <span>{title}</span>
      </div>
      <div className="markdown-preview-panel__body" onMouseLeave={() => setTooltip(null)} onScroll={() => setTooltip(null)}>
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

type AiAssistAttachment = {
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}

type AiAssistToolEvent = {
  status?: string
  toolName?: string
  message?: string
  args?: unknown
  result?: unknown
}

type AiAssistTurn = {
  id: string
  instruction: string
  status: 'streaming' | 'success' | 'error'
  mode: 'modify' | 'answer' | ''
  summary: string
  reason: string
  answer: string
  content: string
  rawContent: string
  thinking: string
  message: string
  notes: string[]
  validation: Record<string, unknown> | null
  toolEvents: AiAssistToolEvent[]
  attachments: AiAssistAttachment[]
  durationMs?: number
  applied?: boolean
}

type AiAssistStreamEvent = {
  type: string
  mode?: 'modify' | 'answer'
  ok?: boolean
  summary?: string
  reason?: string
  answer?: string
  output?: string
  content?: string
  delta?: string
  thinking?: string
  message?: string
  notes?: unknown[]
  validation?: unknown
  status?: string
  toolName?: string
  args?: unknown
  result?: unknown
  durationMs?: number
  toolEvents?: unknown[]
}

function AiAssistPanel({
  t,
  activeFile,
  content,
  isZpmt,
  onApply,
}: {
  t: WorkbenchCopy
  activeFile: EditorFileTab | null
  content: string
  isZpmt: boolean
  onApply: (content: string) => void
}) {
  const [instruction, setInstruction] = useState('')
  const [attachments, setAttachments] = useState<AiAssistAttachment[]>([])
  const [turnsByFile, setTurnsByFile] = useState<Record<string, AiAssistTurn[]>>({})
  const [runningTurn, setRunningTurn] = useState<{ fileKey: string; turnId: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const outputRef = useRef<HTMLDivElement | null>(null)
  const fileKey = activeFile?.id || ''
  const turns = fileKey ? turnsByFile[fileKey] || [] : []
  const loading = Boolean(runningTurn && runningTurn.fileKey === fileKey)

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
  }, [turns])

  useEffect(() => () => abortRef.current?.abort(), [])

  function updateTurn(fileKeyValue: string, turnId: string, updater: (turn: AiAssistTurn) => AiAssistTurn) {
    setTurnsByFile((current) => ({
      ...current,
      [fileKeyValue]: (current[fileKeyValue] || []).map((turn) => (turn.id === turnId ? updater(turn) : turn)),
    }))
  }

  async function runAssist() {
    if (!activeFile || !isZpmt || loading || !instruction.trim()) return
    const currentFileKey = activeFile.id
    const turnId = `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const turn: AiAssistTurn = {
      id: turnId,
      instruction: instruction.trim(),
      status: 'streaming',
      mode: '',
      summary: '判断请求类型...',
      reason: '',
      answer: '',
      content: '',
      rawContent: '',
      thinking: '',
      message: '',
      notes: [],
      validation: null,
      toolEvents: [],
      attachments,
    }
    setTurnsByFile((current) => ({ ...current, [currentFileKey]: [...(current[currentFileKey] || []), turn] }))
    setInstruction('')
    setAttachments([])
    setRunningTurn({ fileKey: currentFileKey, turnId })
    const controller = new AbortController()
    abortRef.current = controller

    await runAiAssistStream(
      {
        projectId: activeFile.projectId,
        path: activeFile.path,
        content,
        instruction: turn.instruction,
        attachments,
        stream: true,
        contextMessages: buildAiAssistContextMessages(turns),
      },
      (event) => updateTurn(currentFileKey, turnId, (currentTurn) => applyAiAssistStreamEvent(currentTurn, event)),
      () => {
        setRunningTurn((current) => (current?.fileKey === currentFileKey && current.turnId === turnId ? null : current))
        if (abortRef.current === controller) abortRef.current = null
      },
      (message) => updateTurn(currentFileKey, turnId, (currentTurn) => ({ ...currentTurn, status: 'error', message })),
      controller.signal,
    )
  }

  function stopAssist() {
    if (!runningTurn) return
    abortRef.current?.abort()
    updateTurn(runningTurn.fileKey, runningTurn.turnId, (turn) => ({ ...turn, status: 'error', message: '已停止' }))
    setRunningTurn(null)
  }

  function clearContext() {
    if (!fileKey || loading) return
    setTurnsByFile((current) => ({ ...current, [fileKey]: [] }))
  }

  function applyTurn(turn: AiAssistTurn) {
    if (!fileKey || !turn.content) return
    onApply(turn.content)
    updateTurn(fileKey, turn.id, (currentTurn) => ({ ...currentTurn, applied: true }))
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return
    const nextFiles = await Promise.all(Array.from(files).slice(0, 6).map(readFileAsAiAssistAttachment))
    setAttachments((current) => [...current, ...nextFiles].slice(0, 8))
  }

  return (
    <aside className="ai-assist-panel">
      <div className="ai-assist-panel__header">
        <Bot className="h-3.5 w-3.5 text-[#d95a1b]" />
        <span>{t.aiAssist.title}</span>
        {turns.length ? (
          <button
            type="button"
            className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-black text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            disabled={loading}
            onClick={clearContext}
          >
            清空上下文
          </button>
        ) : null}
      </div>
      <div className="ai-assist-panel__body flex min-h-0 flex-col gap-0 overflow-hidden p-0">
        {!isZpmt ? (
          <div className="m-3 ai-assist-panel__item">
            <WandSparkles className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
            <span>AI 辅助仅支持 .zpmt 文件</span>
          </div>
        ) : (
          <>
            <div ref={outputRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
              {turns.length ? turns.map((turn) => {
                const validation = turn.validation
                const issues = Array.isArray(validation?.issues) ? validation.issues : []
                const canApply = turn.mode === 'modify' && turn.status === 'success' && validation?.ok === true && Boolean(turn.content)
                const modeLabel = turn.mode === 'modify' ? '修改' : turn.mode === 'answer' ? '回答' : '判断中'

                return (
                  <div key={turn.id} className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">{modeLabel}</span>
                          <span className={cn('text-[10px] font-black', turn.status === 'streaming' ? 'text-[#d95a1b]' : turn.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>
                            {turn.status === 'streaming' ? '处理中' : turn.status === 'success' ? '完成' : '失败'}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-xs font-semibold text-slate-800">{turn.instruction}</div>
                        {turn.summary ? <div className="mt-1 text-[11px] font-semibold text-slate-500">{turn.summary}</div> : null}
                      </div>
                      {canApply ? (
                        <Button type="button" size="sm" onClick={() => applyTurn(turn)} disabled={turn.applied}>
                          {turn.applied ? '已应用' : '应用'}
                        </Button>
                      ) : null}
                    </div>
                    {turn.answer ? (
                      <div className="whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50 p-2 text-xs leading-5 text-slate-700">{turn.answer}</div>
                    ) : null}
                    {turn.message && turn.status === 'error' ? (
                      <div className="rounded-md border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-700">{turn.message}</div>
                    ) : null}
                    {turn.toolEvents.length ? (
                      <details className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2" open={turn.status === 'streaming'}>
                        <summary className="cursor-pointer text-[11px] font-black text-slate-600">工具调用 · {turn.toolEvents.length}</summary>
                        <div className="mt-2 space-y-1">
                          {turn.toolEvents.map((event, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                              <span className="min-w-0 truncate">{event.toolName || 'tool'}</span>
                              <span className={cn('shrink-0', event.status === 'done' ? 'text-emerald-600' : 'text-[#d95a1b]')}>
                                {event.message || (event.status === 'done' ? '完成' : '调用中')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {turn.thinking ? (
                      <details className="mt-2 rounded-md border border-slate-100 bg-white p-2">
                        <summary className="cursor-pointer text-[11px] font-black text-slate-600">思考内容</summary>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[11px] leading-5 text-slate-100">{turn.thinking}</pre>
                      </details>
                    ) : null}
                    {issues.length ? (
                      <div className="mt-2 max-h-28 overflow-auto rounded bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
                        {issues.map((issue, index) => (
                          <div key={index}>{readString(isRecord(issue) ? issue.message : issue)}</div>
                        ))}
                      </div>
                    ) : null}
                    {turn.mode === 'modify' && turn.content ? (
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[11px] leading-5 text-slate-100">{turn.content}</pre>
                    ) : null}
                  </div>
                )
              }) : (
                <div className="ai-assist-panel__item">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
                  <span>输入问题或修改要求。AI 会先判断是回答还是修改，回答和修改都支持查询项目文档、变量语法和配方变量。</span>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-white p-2.5">
              <Textarea
                className="min-h-20 resize-none bg-white text-xs"
                value={instruction}
                disabled={loading}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="问：当前文件有哪些变量？或：把这个提示词改成更适合国风海报，并补充参考图变量。"
              />
              {attachments.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {attachments.map((file, index) => (
                    <button
                      key={`${file.filename}:${index}`}
                      type="button"
                      className="max-w-full truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      title="点击移除"
                      disabled={loading}
                      onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      {file.filename}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className={cn('inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-600 hover:bg-slate-50', loading && 'pointer-events-none opacity-60')}>
                  <Upload className="h-3.5 w-3.5" />
                  上传参考
                  <input className="sr-only" type="file" multiple disabled={loading} onChange={(event) => void addAttachments(event.target.files)} />
                </label>
                {loading ? (
                  <Button type="button" size="sm" variant="outline" onClick={stopAssist}>
                    <X className="h-3.5 w-3.5" />
                    停止
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => void runAssist()} disabled={!instruction.trim()}>
                    <WandSparkles className="h-3.5 w-3.5" />
                    发送
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

function buildAiAssistContextMessages(turns: AiAssistTurn[]) {
  return turns.slice(-6).flatMap((turn) => {
    const assistantText = turn.mode === 'answer'
      ? turn.answer
      : turn.content
        ? `${turn.summary || '已生成候选修改'}\n校验：${turn.validation?.ok === true ? '通过' : '未通过'}`
        : turn.summary || turn.message
    return [
      { role: 'user', content: turn.instruction },
      { role: 'assistant', content: assistantText.slice(0, 3000) },
    ].filter((item) => item.content.trim())
  })
}

function applyAiAssistStreamEvent(turn: AiAssistTurn, event: AiAssistStreamEvent): AiAssistTurn {
  if (event.type === 'start') {
    return {
      ...turn,
      mode: event.mode || turn.mode,
      summary: event.summary || turn.summary,
      reason: event.reason || turn.reason,
      message: '',
    }
  }
  if (event.type === 'thinking') return { ...turn, thinking: `${turn.thinking}${event.delta || ''}` }
  if (event.type === 'content') {
    if ((event.mode || turn.mode) === 'answer') return { ...turn, mode: 'answer', answer: `${turn.answer}${event.delta || ''}` }
    return { ...turn, mode: 'modify', rawContent: `${turn.rawContent}${event.delta || ''}` }
  }
  if (event.type === 'tool') {
    return {
      ...turn,
      mode: event.mode || turn.mode,
      toolEvents: [
        ...turn.toolEvents,
        { status: event.status, toolName: event.toolName, message: event.message, args: event.args, result: event.result },
      ],
    }
  }
  if (event.type === 'validation') return { ...turn, validation: isRecord(event.validation) ? event.validation : null }
  if (event.type === 'done') {
    const mode = event.mode || turn.mode
    return {
      ...turn,
      mode,
      status: event.ok === false ? 'error' : 'success',
      summary: event.summary || turn.summary,
      answer: mode === 'answer' ? readString(event.answer || event.output) || turn.answer : turn.answer,
      content: mode === 'modify' ? readString(event.content) : turn.content,
      thinking: readString(event.thinking) || turn.thinking,
      notes: Array.isArray(event.notes) ? event.notes.map(readString).filter(Boolean) : turn.notes,
      validation: isRecord(event.validation) ? event.validation : turn.validation,
      toolEvents: Array.isArray(event.toolEvents)
        ? event.toolEvents.filter(isRecord).map((item) => ({
            status: readString(item.status),
            toolName: readString(item.toolName),
            message: readString(item.message),
            args: item.args,
            result: item.result,
          }))
        : turn.toolEvents,
      message: readString(event.message),
      durationMs: event.durationMs,
    }
  }
  if (event.type === 'error') return { ...turn, status: 'error', message: event.message || 'AI 辅助失败' }
  return turn
}

async function runAiAssistStream(
  body: Record<string, unknown>,
  onEvent: (event: AiAssistStreamEvent) => void,
  onDone: () => void,
  onError: (message: string) => void,
  signal: AbortSignal,
) {
  try {
    const response = await fetch('/api/prompts/assist', {
      method: 'POST',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null)
      onError(readString(isRecord(data) ? data.message : '') || 'AI 辅助失败')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split(/\n\n/)
      buffer = chunks.pop() || ''
      for (const chunk of chunks) {
        const data = chunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
        if (!data) continue
        try {
          onEvent(JSON.parse(data) as AiAssistStreamEvent)
        } catch {
          // Ignore malformed stream events from intermediate proxies.
        }
      }
    }
  } catch (error) {
    if (signal.aborted) return
    onError(error instanceof Error ? error.message : 'AI 辅助失败')
  } finally {
    onDone()
  }
}

function PromptApiDialog({
  t,
  file,
  document: zpmtDocument,
  variables,
  onClose,
}: {
  t: WorkbenchCopy
  file: EditorFileTab
  document: ZpmtDocument
  variables: ZpmtTestVariable[]
  onClose: () => void
}) {
  const [tokenSummary, setTokenSummary] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetch('/api/user-api-token')
      .then((response) => response.json().catch(() => null))
      .then((response) => {
        if (response?.ok) setTokenSummary(response.token || null)
      })
      .catch(() => undefined)
  }, [])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const runUrl = `${origin}/api/public/prompts/run`
  const variablesUrl = `${origin}/api/public/prompts/variables?projectId=${encodeURIComponent(file.projectId)}&path=${encodeURIComponent(file.path)}`
  const requestBody = {
    projectId: file.projectId,
    path: file.path,
    variables: Object.fromEntries(variables.filter((variable) => !variable.mediaKind && !variable.recipe).map((variable) => [variable.key, variable.defaultValue || ''])),
    recipeVariables: Object.fromEntries(variables.filter((variable) => variable.recipe).map((variable) => [variable.key, variable.defaultValue || ''])),
    mediaVariables: Object.fromEntries(variables.filter((variable) => variable.mediaKind).map((variable) => [variable.key, []])),
    options: zpmtDocument.kind === 'agent' ? { maxToolRounds: 5 } : undefined,
  }
  const curl = [
    `curl -X POST "${runUrl}" \\`,
    `  -H "Authorization: Bearer <你的个人Token>" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(requestBody, null, 2).replace(/'/g, "'\\''")}'`,
  ].join('\n')

  async function copyApiText(kind: string, value: string) {
    await copyTextToClipboard(value)
    setCopied(kind)
    window.setTimeout(() => setCopied(''), 1200)
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[82vh] w-[min(920px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-slate-900">提示词调用接口</h2>
            <p className="truncate text-[11px] font-semibold text-slate-500">{file.path}</p>
          </div>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label={t.close} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-black text-slate-900">接口地址</div>
              <div className="space-y-2 text-[11px] font-semibold text-slate-600">
                <div>
                  <div className="font-black text-slate-500">运行提示词</div>
                  <code className="mt-1 block break-all rounded bg-white p-2">{runUrl}</code>
                </div>
                <div>
                  <div className="font-black text-slate-500">变量列表</div>
                  <code className="mt-1 block break-all rounded bg-white p-2">{variablesUrl}</code>
                </div>
                <div>
                  <div className="font-black text-slate-500">Token</div>
                  <div className="mt-1 rounded bg-white p-2">{tokenSummary?.exists ? `已配置：${String(tokenSummary.tokenMasked || '')}` : '未配置，请到设置 / 接口 Token 生成'}</div>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-black text-slate-900">变量</div>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyApiText('variables', JSON.stringify(variables, null, 2))}>
                  <Copy className="h-3.5 w-3.5" /> {copied === 'variables' ? '已复制' : '复制'}
                </Button>
              </div>
              <div className="max-h-52 overflow-auto rounded bg-white p-2 text-[11px]">
                {variables.length ? variables.map((variable) => (
                  <div key={variable.key} className="border-b border-slate-100 py-1 last:border-b-0">
                    <div className="font-black text-slate-700">{variable.label}</div>
                    <div className="break-all font-mono text-slate-500">{variable.key}</div>
                  </div>
                )) : <div className="text-slate-500">当前提示词没有变量</div>}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-black text-slate-900">请求示例</div>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyApiText('curl', curl)}>
                <Copy className="h-3.5 w-3.5" /> {copied === 'curl' ? '已复制' : '复制 curl'}
              </Button>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{curl}</pre>
          </div>
        </div>
      </div>
    </div>,
    window.document.body,
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
  if (normalized.endsWith('.json') || normalized.endsWith('.zpmt') || normalized.endsWith('.zflow') || isProjectConfigFilePath(normalized)) return 'json'
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
  promptKindByPath,
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
  promptKindByPath: ZflowPromptKindByPath
  recipeVariableCategories: RecipeVariableCategory[]
  tabs: EditorFileTab[]
  activeTab: EditorFileTab | null
  onActivateTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onChangeActiveContent: (value: string, options?: { refreshSourceControl?: boolean }) => void
  onSaveActive: () => void
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>('normal')
  const [zpmtPromptModes, setZpmtPromptModes] = useState<Record<string, PromptFileType>>({})
  const [zpmtCollapsedSections, setZpmtCollapsedSections] = useState<Record<string, ZpmtCollapsedSections>>({})
  const [apiDialogOpen, setApiDialogOpen] = useState(false)
  const isSourceMode = editorMode === 'source'
  const editorValue = activeTab?.content || ''
  const activeZflowResult = activeTab && isZflowFilePath(activeTab.path) ? parseZflowContent(editorValue) : null
  const hasSidePanel = !activeZflowResult && (editorMode === 'preview' || editorMode === 'assist')
  const autoSaveZflowCanvas = Boolean(activeZflowResult?.ok && activeTab?.dirty && !activeTab.saving && !isSourceMode)
  const showSaveButton = !activeZflowResult || isSourceMode
  const activeZpmtDocument = activeTab && isZpmtFilePath(activeTab.path) ? parseZpmtContent(editorValue, aiProviders) : null
  const activeZpmtModelContext = activeZpmtDocument
    ? getSelectedAiModelContext(aiProviders, activeZpmtDocument.config.providerId, activeZpmtDocument.config.model, activeZpmtDocument.config.providerFile)
    : null
  const activeZpmtPromptSurface = activeZpmtDocument
    ? resolveAiModelPromptSurface(
        activeZpmtDocument.config.outputType,
        activeZpmtModelContext?.provider.providerType,
        activeZpmtDocument.config.model,
        activeZpmtModelContext?.model,
      )
    : null
  const activeZpmtModelCapabilities = useMemo(() => getZpmtModelCapabilityGate(activeZpmtModelContext?.model), [activeZpmtModelContext?.model])
  const activeZlexResult = activeTab && isZlexFilePath(activeTab.path) ? parseZlexContent(editorValue) : null
  const activeZamfResult = activeTab && isZamfFilePath(activeTab.path) ? parseZamfContent(editorValue) : null
  const activeZpmtInitialMode = activeZpmtDocument ? getZpmtPromptMode(activeZpmtDocument) : 'chat'
  const activeZpmtPromptMode = activeTab && activeZpmtDocument ? zpmtPromptModes[activeTab.id] || activeZpmtInitialMode : 'chat'
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

  useEffect(() => {
    if (!autoSaveZflowCanvas) return
    const timer = window.setTimeout(() => {
      onSaveActive()
    }, 900)
    return () => window.clearTimeout(timer)
  }, [activeTab?.content, activeTab?.id, autoSaveZflowCanvas, onSaveActive])

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
            const tabZpmtKind = isZpmtFilePath(tab.path) ? parseZpmtContent(tab.content, aiProviders)?.kind : null
            const fileIcon = getFileIconMeta(tab.path, tabZpmtKind)
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
          {showSaveButton ? (
            <Button variant="outline" size="sm" disabled={!activeTab || activeTab.saving} onClick={onSaveActive}>
              <Save className="h-3 w-3" /> {saveText}
            </Button>
          ) : null}
          {activeZpmtDocument && activeTab ? (
            <Button variant="outline" size="sm" onClick={() => setApiDialogOpen(true)}>
              <Code2 className="h-3 w-3" /> 查看接口
            </Button>
          ) : null}
          {activeZflowResult ? (
            <ZflowModeSwitch mode={editorMode} t={t} onChange={setEditorMode} />
          ) : (
            <EditorModeSwitch mode={editorMode} t={t} onChange={setEditorMode} />
          )}
        </div>
      </div>

      <div className={hasSidePanel ? 'editor-workspace editor-workspace--split' : 'editor-workspace'}>
        <div className="editor-surface min-h-0">
          {activeTab ? (
            activeZflowResult && !isSourceMode ? (
              activeZflowResult.ok ? (
                <ZflowCanvasEditor
                  key={activeTab.id}
                  t={t}
                  locale={locale}
                  projectId={activeTab.projectId}
                  promptKindByPath={promptKindByPath}
                  aiProviders={aiProviders}
                  recipeVariableCategories={recipeVariableCategories}
                  editorTabs={tabs}
                  document={activeZflowResult.document}
                  mode={editorMode === 'run' ? 'run' : 'edit'}
                  onChange={(nextDocument) => onChangeActiveContent(serializeZflowDocument(nextDocument), { refreshSourceControl: false })}
                  onOpenSource={() => setEditorMode('source')}
                />
              ) : (
                <ConfigParseErrorPanel t={t} filePath={activeTab.path} message={activeZflowResult.message} onOpenSource={() => setEditorMode('source')} />
              )
            ) : isSourceMode ? (
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
        {editorMode === 'assist' ? (
          <AiAssistPanel
            t={t}
            activeFile={activeTab}
            content={editorValue}
            isZpmt={Boolean(activeZpmtDocument)}
            onApply={(content) => onChangeActiveContent(content)}
          />
        ) : null}
      </div>
      {apiDialogOpen && activeTab && activeZpmtDocument ? (
        <PromptApiDialog
          t={t}
          file={activeTab}
          document={activeZpmtDocument}
          variables={collectZpmtTestVariables(activeZpmtDocument, t, locale, activeZpmtPromptSurface, recipeVariableCategories)}
          onClose={() => setApiDialogOpen(false)}
        />
      ) : null}
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

function ZflowCanvasEditor({
  t,
  locale,
  projectId,
  promptKindByPath,
  aiProviders,
  recipeVariableCategories,
  editorTabs,
  document,
  mode,
  onChange,
  onOpenSource,
}: {
  t: WorkbenchCopy
  locale: Locale
  projectId: string
  promptKindByPath: ZflowPromptKindByPath
  aiProviders: AiProviderSummary[]
  recipeVariableCategories: RecipeVariableCategory[]
  editorTabs: EditorFileTab[]
  document: ZflowDocument
  mode: 'edit' | 'run'
  onChange: (document: ZflowDocument) => void
  onOpenSource: () => void
}) {
  const [nodes, setNodes, applyNodesChange] = useNodesState<ZflowNode>(document.nodes)
  const [edges, setEdges, applyEdgesChange] = useEdgesState<ZflowEdge>(document.edges)
  const [viewport, setViewport] = useState<Viewport>(() => document.viewport)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [promptFileCache, setPromptFileCache] = useState<Record<string, ZflowPromptFileCacheEntry>>({})
  const [panelTab, setPanelTab] = useState<'nodes' | 'editor'>('nodes')
  const [runPanelTab, setRunPanelTab] = useState<ZflowRunPanelTab>('input')
  const [runInputValues, setRunInputValues] = useState<ZflowRunInputValues>({})
  const [interactionMode, setInteractionMode] = useState<ZflowInteractionMode>('pan')
  const [alignmentGuides, setAlignmentGuides] = useState<ZflowAlignmentGuide[]>([])
  const [runEvents, setRunEvents] = useState<Array<Record<string, unknown>>>([])
  const [isRunning, setIsRunning] = useState(false)
  const isRunMode = mode === 'run'
  const [connectionLineStyle, setConnectionLineStyle] = useState<React.CSSProperties>({
    stroke: 'var(--zflow-edge-stroke)',
    strokeWidth: 2.25,
  })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reactFlowInstanceRef = useRef<ReactFlowInstance<ZflowNode, ZflowEdge> | null>(null)
  const documentRef = useRef(document)
  const latestStateRef = useRef({ nodes: document.nodes, edges: document.edges, viewport: document.viewport })
  const promptFileCacheRef = useRef<Record<string, ZflowPromptFileCacheEntry>>({})
  const promptFileRequestsRef = useRef<Set<string>>(new Set())
  const zflowSyncRef = useRef({ serialized: serializeZflowDocument(document), dirty: false })
  const syncTimerRef = useRef<number | null>(null)
  const runEventQueueRef = useRef<Array<Record<string, unknown>>>([])
  const runEventFlushFrameRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const alignmentGuidesRef = useRef<ZflowAlignmentGuide[]>([])
  const clipboardRef = useRef<ZflowClipboardPayload | null>(null)
  const nodeTypes = useMemo(() => ({ zflow: ZflowWorkflowNode }), [])
  const defaultEdgeOptions = useMemo(() => ({ type: 'smoothstep' }), [])
  const presentedEdges = useMemo(
    () => edges.map((edge) => decorateZflowEdge(edge, nodes, promptKindByPath)),
    [edges, nodes, promptKindByPath],
  )
  const runNodeStatuses = useMemo(() => getZflowRunNodeStatuses(runEvents), [runEvents])
  const presentedNodes = useMemo(
    () => nodes.map((node) => decorateZflowNodeWithRunStatus(decorateZflowNode(node, promptKindByPath), isRunMode ? runNodeStatuses[node.id] : undefined)),
    [isRunMode, nodes, promptKindByPath, runNodeStatuses],
  )
  const promptRunFilePaths = useMemo(
    () => Array.from(new Set(nodes.map(getZflowPromptRunFilePath).filter(Boolean))),
    [nodes],
  )
  const promptRunFilePathKey = promptRunFilePaths.join('\n')
  const openedPromptPathKey = useMemo(
    () => editorTabs.filter((tab) => tab.projectId === projectId && isZpmtFilePath(tab.path)).map((tab) => tab.path).sort().join('\n'),
    [editorTabs, projectId],
  )

  const flushQueuedRunEvents = useCallback(() => {
    if (runEventFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(runEventFlushFrameRef.current)
      runEventFlushFrameRef.current = null
    }
    const queuedEvents = runEventQueueRef.current
    if (!queuedEvents.length) return
    runEventQueueRef.current = []
    setRunEvents((current) => current.concat(queuedEvents).slice(-80))
  }, [])

  const enqueueRunEvent = useCallback((event: Record<string, unknown>) => {
    runEventQueueRef.current.push(event)
    if (runEventFlushFrameRef.current !== null) return
    runEventFlushFrameRef.current = window.requestAnimationFrame(() => {
      runEventFlushFrameRef.current = null
      const queuedEvents = runEventQueueRef.current
      if (!queuedEvents.length) return
      runEventQueueRef.current = []
      setRunEvents((current) => current.concat(queuedEvents).slice(-80))
    })
  }, [])
  const renderedGuides = useMemo(() => {
    if (!alignmentGuides.length || !reactFlowInstanceRef.current || !stageRef.current) return []
    const stageBounds = stageRef.current.getBoundingClientRect()
    return alignmentGuides.flatMap((guide) => {
      const start = guide.axis === 'x'
        ? reactFlowInstanceRef.current?.flowToScreenPosition({ x: guide.position, y: guide.start })
        : reactFlowInstanceRef.current?.flowToScreenPosition({ x: guide.start, y: guide.position })
      const end = guide.axis === 'x'
        ? reactFlowInstanceRef.current?.flowToScreenPosition({ x: guide.position, y: guide.end })
        : reactFlowInstanceRef.current?.flowToScreenPosition({ x: guide.end, y: guide.position })
      if (!start || !end) return []
      return [{
        id: guide.id,
        style: guide.axis === 'x'
          ? {
              left: Math.round(start.x - stageBounds.left),
              top: Math.round(start.y - stageBounds.top),
              height: Math.max(1, Math.round(end.y - start.y)),
            }
          : {
              left: Math.round(start.x - stageBounds.left),
              top: Math.round(start.y - stageBounds.top),
              width: Math.max(1, Math.round(end.x - start.x)),
            },
        axis: guide.axis,
      }]
    })
  }, [alignmentGuides, viewport])

  useEffect(() => {
    const serialized = serializeZflowDocument(document)
    documentRef.current = document
    if (serialized === zflowSyncRef.current.serialized) return
    zflowSyncRef.current = { serialized, dirty: false }
    setNodes(document.nodes)
    setEdges(document.edges)
    setViewport(document.viewport)
    setSelectedNodeId('')
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
    setAlignmentGuides([])
  }, [document, setEdges, setNodes])

  useEffect(() => {
    latestStateRef.current = { nodes, edges, viewport }
  }, [edges, nodes, viewport])

  useEffect(() => {
    promptFileCacheRef.current = promptFileCache
  }, [promptFileCache])

  useEffect(() => {
    alignmentGuidesRef.current = alignmentGuides
  }, [alignmentGuides])

  useEffect(() => () => {
    if (runEventFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(runEventFlushFrameRef.current)
      runEventFlushFrameRef.current = null
    }
  }, [])

  const flushZflowChange = useCallback(() => {
    if (!zflowSyncRef.current.dirty) return
    const nextDocument: ZflowDocument = { ...documentRef.current, ...latestStateRef.current }
    const serialized = serializeZflowDocument(nextDocument)
    if (serialized !== zflowSyncRef.current.serialized) {
      zflowSyncRef.current.serialized = serialized
      documentRef.current = nextDocument
      onChange(nextDocument)
    }
    zflowSyncRef.current.dirty = false
  }, [onChange])

  const scheduleZflowSync = useCallback(
    (delay = 420) => {
      if (!zflowSyncRef.current.dirty || draggingRef.current) return
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null
        if (!draggingRef.current) flushZflowChange()
      }, delay)
    },
    [flushZflowChange],
  )

  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current)
    }
  }, [])

  const handleNodesChange = useCallback(
    (changes: NodeChange<ZflowNode>[]) => {
      const safeChanges = changes.filter((change) => !(change.type === 'remove' && change.id === ZFLOW_START_NODE_ID))
      const hasPersistableChange = safeChanges.some(isPersistableZflowNodeChange)
      if (hasPersistableChange) zflowSyncRef.current.dirty = true
      applyNodesChange(safeChanges)
      if (hasPersistableChange) scheduleZflowSync()
    },
    [applyNodesChange, scheduleZflowSync],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<ZflowEdge>[]) => {
      const hasPersistableChange = changes.some(isPersistableZflowEdgeChange)
      if (hasPersistableChange) zflowSyncRef.current.dirty = true
      applyEdgesChange(changes)
      if (hasPersistableChange) scheduleZflowSync()
    },
    [applyEdgesChange, scheduleZflowSync],
  )

  const handleNodeDragStart = useCallback(() => {
    draggingRef.current = true
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
  }, [])

  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, node: ZflowNode, draggedNodes: ZflowNode[]) => {
      if (draggedNodes.length !== 1) {
        if (alignmentGuidesRef.current.length) {
          alignmentGuidesRef.current = []
          setAlignmentGuides([])
        }
        return
      }
      const result = getZflowNodeAlignmentResult(node, latestStateRef.current.nodes, latestStateRef.current.viewport.zoom)
      if (!areZflowAlignmentGuidesEqual(alignmentGuidesRef.current, result.guides)) {
        alignmentGuidesRef.current = result.guides
        setAlignmentGuides(result.guides)
      }
      if (!result.changed) return
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((currentNode) =>
          currentNode.id === node.id ? { ...currentNode, position: result.position } : currentNode,
        )
        latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
        return nextNodes
      })
    },
    [setNodes],
  )

  const handleNodeDragStop = useCallback(() => {
    draggingRef.current = false
    if (alignmentGuidesRef.current.length) {
      alignmentGuidesRef.current = []
      setAlignmentGuides([])
    }
    scheduleZflowSync(220)
  }, [scheduleZflowSync])

  const updateViewport = useCallback(
    (nextViewport: Viewport) => {
      if (areZflowViewportsEqual(latestStateRef.current.viewport, nextViewport)) return
      const normalizedViewport = normalizeZflowViewport(nextViewport)
      latestStateRef.current = { ...latestStateRef.current, viewport: normalizedViewport }
      zflowSyncRef.current.dirty = true
      setViewport(normalizedViewport)
      scheduleZflowSync()
    },
    [scheduleZflowSync],
  )

  const isValidConnection = useCallback(
    (connection: ZflowEdge | Connection) =>
      !isRunMode && canCreateZflowConnection(connection, latestStateRef.current.nodes, latestStateRef.current.edges, promptKindByPath),
    [isRunMode, promptKindByPath],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isRunMode) return
      if (!connection.source || !connection.target || connection.source === connection.target) return
      zflowSyncRef.current.dirty = true
      setEdges((currentEdges) => {
        if (!canCreateZflowConnection(connection, latestStateRef.current.nodes, currentEdges, promptKindByPath)) return currentEdges
        const nextEdge = createZflowEdgeFromConnection(connection, latestStateRef.current.nodes, currentEdges, promptKindByPath)
        if (!nextEdge) return currentEdges
        const duplicate = currentEdges.some(
          (edge) =>
            edge.source === nextEdge.source &&
            edge.target === nextEdge.target &&
            edge.sourceHandle === nextEdge.sourceHandle &&
            edge.targetHandle === nextEdge.targetHandle,
        )
        if (duplicate) return currentEdges
        const nextEdges = currentEdges.concat(nextEdge)
        latestStateRef.current = { ...latestStateRef.current, edges: nextEdges }
        return nextEdges
      })
      scheduleZflowSync(120)
    },
    [isRunMode, promptKindByPath, scheduleZflowSync, setEdges],
  )

  const handleBeforeDelete = useCallback(
    async ({ nodes: nodesToDelete, edges: edgesToDelete }: { nodes: ZflowNode[]; edges: ZflowEdge[] }) => {
      const filteredNodes = nodesToDelete.filter((node) => !isZflowStartNode(node))
      const blockedStartNodeIds = new Set(nodesToDelete.filter(isZflowStartNode).map((node) => node.id))
      const filteredEdges = edgesToDelete.filter((edge) => !blockedStartNodeIds.has(edge.source) && !blockedStartNodeIds.has(edge.target))
      return { nodes: filteredNodes, edges: filteredEdges }
    },
    [],
  )

  const updateZflowNodeData = useCallback(
    (nodeId: string, data: Partial<ZflowNodeData>) => {
      zflowSyncRef.current.dirty = true
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node))
        latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
        return nextNodes
      })
      scheduleZflowSync(160)
    },
    [scheduleZflowSync, setNodes],
  )

  const updateZflowNodeOutputData = useCallback(
    (nodeId: string, outputData: ZflowNodePort[]) => {
      zflowSyncRef.current.dirty = true
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, outputData } } : node))
        latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
        return nextNodes
      })
      scheduleZflowSync(120)
    },
    [scheduleZflowSync, setNodes],
  )

  const updateZflowNodeOutputPorts = useCallback(
    (nodeId: string, outputPorts: ZflowNodePort[], removedOutputPortIds: string[] = []) => {
      zflowSyncRef.current.dirty = true
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, outputPorts } } : node))
        latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
        return nextNodes
      })
      if (removedOutputPortIds.length) {
        const removed = new Set(removedOutputPortIds.map(normalizeZflowHandleId).filter((id): id is string => Boolean(id)))
        setEdges((currentEdges) => {
          const nextEdges = currentEdges.filter((edge) => edge.source !== nodeId || !removed.has(normalizeZflowHandleId(edge.sourceHandle) || ''))
          latestStateRef.current = { ...latestStateRef.current, edges: nextEdges }
          return nextEdges
        })
      }
      scheduleZflowSync(120)
    },
    [scheduleZflowSync, setEdges, setNodes],
  )

  const handleFlowNodeClick = useCallback((_: React.MouseEvent, node: ZflowNode) => {
    setSelectedNodeId(node.id)
    setSelectedNodeIds([node.id])
    setSelectedEdgeIds([])
    setPanelTab('editor')
  }, [])

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: ZflowNode[]; edges: ZflowEdge[] }) => {
    const ids = selectedNodes.map((node) => node.id)
    setSelectedEdgeIds(selectedEdges.map((edge) => edge.id))
    setSelectedNodeIds(ids)
    if (ids.length === 1) {
      setSelectedNodeId(ids[0] || '')
      setPanelTab('editor')
      return
    }
    setSelectedNodeId('')
    setPanelTab('nodes')
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId('')
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
    setAlignmentGuides([])
    setPanelTab('nodes')
  }, [])

  const handleCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types || [])
    if (!types.includes(ZFLOW_NODE_DRAG_MIME) && !hasZpmtFileDrag(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const templateId = event.dataTransfer.getData(ZFLOW_NODE_DRAG_MIME)
      const template = getZflowNodeTemplateById(templateId)
      const position = reactFlowInstanceRef.current
        ? reactFlowInstanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY }

      if (template) {
        event.preventDefault()
        zflowSyncRef.current.dirty = true
        setNodes((currentNodes) => {
          const nextNode = createZflowNodeFromTemplate(template, position, locale, currentNodes)
          const nextNodes = currentNodes.concat(nextNode)
          latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
          return nextNodes
        })
        scheduleZflowSync(80)
        return
      }

      const zpmtPayload = readZpmtFileDragPayload(event.dataTransfer)
      if (!zpmtPayload?.files.length) return
      event.preventDefault()
      if (zpmtPayload.projectId !== projectId) return
      zflowSyncRef.current.dirty = true
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.slice()
        zpmtPayload.files.forEach((file, index) => {
          nextNodes.push(createZflowNodeFromZpmtFile(file, { x: position.x + index * 36, y: position.y + index * 28 }, locale, nextNodes))
        })
        latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
        return nextNodes
      })
      scheduleZflowSync(80)
    },
    [locale, projectId, scheduleZflowSync, setNodes],
  )

  useEffect(() => {
    scheduleZflowSync()
  }, [nodes, edges, viewport, scheduleZflowSync])

  useEffect(() => {
    if (!selectedNodeId) return
    if (nodes.some((node) => node.id === selectedNodeId)) return
    setSelectedNodeId('')
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
    setPanelTab('nodes')
  }, [nodes, selectedNodeId])

  const copySelectedZflowNodes = useCallback(() => {
    const nodeIds = new Set(selectedNodeIds)
    const nodesToCopy = latestStateRef.current.nodes.filter((node) => nodeIds.has(node.id) && !isZflowStartNode(node))
    if (!nodesToCopy.length) return false
    const copyIds = new Set(nodesToCopy.map((node) => node.id))
    const edgesToCopy = latestStateRef.current.edges.filter((edge) => copyIds.has(edge.source) && copyIds.has(edge.target))
    clipboardRef.current = {
      nodes: nodesToCopy.map(cloneZflowNodeForClipboard),
      edges: edgesToCopy.map(cloneZflowEdgeForClipboard),
      pasteCount: 0,
    }
    return true
  }, [selectedNodeIds])

  const pasteZflowClipboard = useCallback(() => {
    const payload = clipboardRef.current
    if (!payload?.nodes.length) return false
    const pasteCount = payload.pasteCount + 1
    const offset = 36 * pasteCount
    const idMap = new Map<string, string>()
    const currentNodes = latestStateRef.current.nodes
    const currentEdges = latestStateRef.current.edges
    const nextNodesToAdd = payload.nodes.map((node) => {
      const nextId = createUniqueZflowNodeId(node.id, currentNodes.concat(Array.from(idMap.values()).map((id) => ({ id } as ZflowNode))))
      idMap.set(node.id, nextId)
      return cloneZflowNodeForPaste(node, nextId, offset)
    })
    const nextEdgesToAdd = payload.edges.flatMap((edge): ZflowEdge[] => {
      const source = idMap.get(edge.source)
      const target = idMap.get(edge.target)
      if (!source || !target) return []
      const nextConnection = { source, target, sourceHandle: edge.sourceHandle || 'out', targetHandle: edge.targetHandle || 'in' }
      return [{
        ...cloneZflowEdgeForClipboard(edge),
        id: createZflowEdgeId(nextConnection, currentEdges),
        source,
        target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        selected: true,
      }]
    })
    const pastedIds = nextNodesToAdd.map((node) => node.id)
    zflowSyncRef.current.dirty = true
    setNodes((current) => {
      const nextNodes: ZflowNode[] = [...current.map((node): ZflowNode => ({ ...node, selected: false })), ...nextNodesToAdd]
      latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
      return nextNodes
    })
    setEdges((current) => {
      const nextEdges: ZflowEdge[] = [...current.map((edge): ZflowEdge => ({ ...edge, selected: false })), ...nextEdgesToAdd]
      latestStateRef.current = { ...latestStateRef.current, edges: nextEdges }
      return nextEdges
    })
    clipboardRef.current = { ...payload, pasteCount }
    setSelectedNodeIds(pastedIds)
    setSelectedEdgeIds(nextEdgesToAdd.map((edge) => edge.id))
    setSelectedNodeId(pastedIds.length === 1 ? pastedIds[0] || '' : '')
    setPanelTab(pastedIds.length === 1 ? 'editor' : 'nodes')
    scheduleZflowSync(80)
    return true
  }, [scheduleZflowSync, setEdges, setNodes])

  const cutSelectedZflowNodes = useCallback(() => {
    if (!copySelectedZflowNodes()) return false
    const nodeIds = new Set(selectedNodeIds)
    const edgeIds = new Set(selectedEdgeIds)
    const removableNodeIds = new Set(latestStateRef.current.nodes.filter((node) => nodeIds.has(node.id) && !isZflowStartNode(node)).map((node) => node.id))
    if (!removableNodeIds.size && !edgeIds.size) return false
    zflowSyncRef.current.dirty = true
    setNodes((current) => {
      const nextNodes = current.filter((node) => !removableNodeIds.has(node.id))
      latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
      return nextNodes
    })
    setEdges((current) => {
      const nextEdges = current.filter((edge) => !edgeIds.has(edge.id) && !removableNodeIds.has(edge.source) && !removableNodeIds.has(edge.target))
      latestStateRef.current = { ...latestStateRef.current, edges: nextEdges }
      return nextEdges
    })
    setSelectedNodeId('')
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
    setPanelTab('nodes')
    scheduleZflowSync(80)
    return true
  }, [copySelectedZflowNodes, scheduleZflowSync, selectedEdgeIds, selectedNodeIds, setEdges, setNodes])

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (isRunMode) return
      if (!isZflowClipboardShortcutEvent(event)) return
      if (isEditableZflowShortcutTarget(event.target)) return
      const key = event.key.toLowerCase()
      const handled = key === 'c'
        ? copySelectedZflowNodes()
        : key === 'x'
          ? cutSelectedZflowNodes()
          : key === 'v'
            ? pasteZflowClipboard()
            : false
      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('keydown', handleKeyboardShortcut)
    return () => window.removeEventListener('keydown', handleKeyboardShortcut)
  }, [copySelectedZflowNodes, cutSelectedZflowNodes, isRunMode, pasteZflowClipboard])

  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType?: 'source' | 'target' | null }) => {
      if (!params.nodeId || params.handleType === 'target') return
      const node = latestStateRef.current.nodes.find((item) => item.id === params.nodeId)
      if (!node) return
      const valueType = resolveZflowNodePortValueType(node, 'source', params.handleId, promptKindByPath)
      setConnectionLineStyle({
        stroke: getZflowValueTypeColor(valueType),
        strokeWidth: 2.25,
      })
    },
    [promptKindByPath],
  )

  const handleConnectEnd = useCallback(() => {
    setConnectionLineStyle({
      stroke: 'var(--zflow-edge-stroke)',
      strokeWidth: 2.25,
    })
  }, [])

  const handleAutoLayout = useCallback(() => {
    const selectedIds = selectedNodeIds.length > 1 ? selectedNodeIds : undefined
    let fitNodes: ZflowNode[] = []
    zflowSyncRef.current.dirty = true
    setNodes((currentNodes) => {
      const nextNodes = layoutZflowNodes(currentNodes, latestStateRef.current.edges, selectedIds)
      fitNodes = selectedIds?.length ? nextNodes.filter((node) => selectedIds.includes(node.id)) : nextNodes.filter((node) => !node.hidden)
      latestStateRef.current = { ...latestStateRef.current, nodes: nextNodes }
      return nextNodes
    })
    scheduleZflowSync(120)
    window.requestAnimationFrame(() => {
      void reactFlowInstanceRef.current?.fitView({
        nodes: fitNodes,
        duration: 240,
        padding: 0.18,
        includeHiddenNodes: false,
      })
    })
  }, [scheduleZflowSync, selectedNodeIds, setNodes])

  const visibleNodeCount = presentedNodes.filter((node) => !node.hidden).length
  const visibleEdgeCount = presentedEdges.filter((edge) => !edge.hidden).length
  const selectedNode = selectedNodeId ? presentedNodes.find((node) => node.id === selectedNodeId) || null : null

  const handleRunFlow = useCallback(async (inputValues: ZflowRunInputValues = runInputValues) => {
    if (isRunning) return
    flushZflowChange()
    if (runEventFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(runEventFlushFrameRef.current)
      runEventFlushFrameRef.current = null
    }
    runEventQueueRef.current = []
    setIsRunning(true)
    setRunEvents([])
    setRunPanelTab('monitor')
    try {
      const startInputs = getZflowStartRunInput(latestStateRef.current.nodes, inputValues)
      const response = await fetch('/api/flows/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          document: { ...documentRef.current, ...latestStateRef.current },
          input: startInputs,
          maxSteps: 60,
        }),
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        flushQueuedRunEvents()
        setRunEvents([{ type: 'run:error', message: readString(data?.message) || '流程运行失败' }])
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '))
          if (!dataLine) continue
          const event = JSON.parse(dataLine.slice(6)) as Record<string, unknown>
          enqueueRunEvent(event)
        }
      }
      flushQueuedRunEvents()
    } catch (error) {
      flushQueuedRunEvents()
      setRunEvents([{ type: 'run:error', message: error instanceof Error ? error.message : '流程运行失败' }])
    } finally {
      setIsRunning(false)
    }
  }, [enqueueRunEvent, flushQueuedRunEvents, flushZflowChange, isRunning, projectId, runInputValues])

  useEffect(() => {
    if (!projectId || !promptRunFilePaths.length) return
    const openedPromptPaths = new Set(editorTabs.filter((tab) => tab.projectId === projectId && isZpmtFilePath(tab.path)).map((tab) => tab.path))
    const pathsToLoad = promptRunFilePaths.filter((filePath) => {
      if (openedPromptPaths.has(filePath)) return false
      const cached = promptFileCacheRef.current[createZflowPromptFileCacheKey(projectId, filePath)]
      return !cached?.content && !cached?.error && !promptFileRequestsRef.current.has(createZflowPromptFileCacheKey(projectId, filePath))
    })
    if (!pathsToLoad.length) return

    for (const filePath of pathsToLoad) {
      const cacheKey = createZflowPromptFileCacheKey(projectId, filePath)
      promptFileRequestsRef.current.add(cacheKey)
      const query = new URLSearchParams({ projectId, path: filePath })
      fetch(`/api/projects/files?${query.toString()}`)
        .then((response) => (response.ok ? response.json() : response.json().catch(() => null)))
        .then((response) => {
          if (!response?.ok || !response.file) {
            setPromptFileCache((current) => ({ ...current, [cacheKey]: { error: readString(response?.message) || '文件读取失败' } }))
            return
          }
          setPromptFileCache((current) => ({ ...current, [cacheKey]: { content: readString(response.file.content) } }))
        })
        .catch((error) => {
          setPromptFileCache((current) => ({ ...current, [cacheKey]: { error: error instanceof Error ? error.message : '文件读取失败' } }))
        })
        .finally(() => {
          promptFileRequestsRef.current.delete(cacheKey)
        })
    }
  }, [openedPromptPathKey, projectId, promptRunFilePathKey, promptRunFilePaths])

  return (
    <div className="zflow-canvas-editor">
      <div ref={stageRef} className="zflow-canvas-editor__stage" onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}>
        <ReactFlow
          nodes={presentedNodes}
          edges={presentedEdges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          defaultViewport={document.viewport}
          minZoom={0.25}
          maxZoom={2}
          snapToGrid
          snapGrid={ZFLOW_SNAP_GRID}
          nodesDraggable={!isRunMode}
          nodesConnectable={!isRunMode}
          elementsSelectable
          selectionOnDrag={interactionMode === 'select'}
          selectionMode={SelectionMode.Partial}
          panOnDrag={interactionMode === 'pan' ? true : [1, 2]}
          panOnScroll
          fitView={false}
        deleteKeyCode={isRunMode ? null : ['Backspace', 'Delete']}
        onlyRenderVisibleElements
        connectionLineStyle={connectionLineStyle}
          proOptions={{ hideAttribution: true }}
          isValidConnection={isValidConnection}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance
          }}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onConnect={handleConnect}
          onBeforeDelete={handleBeforeDelete}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onSelectionChange={handleSelectionChange}
          onNodeClick={handleFlowNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onMoveEnd={(_, nextViewport) => updateViewport(nextViewport)}
        >
          <Panel position="top-center">
            <div className="zflow-canvas-toolbar">
              <Button
                type="button"
                size="icon"
                variant={interactionMode === 'pan' ? 'secondary' : 'outline'}
                title={t.zflowToolbarMove}
                aria-label={t.zflowToolbarMove}
                onClick={() => setInteractionMode('pan')}
              >
                <Hand className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={interactionMode === 'select' ? 'secondary' : 'outline'}
                title={t.zflowToolbarSelect}
                aria-label={t.zflowToolbarSelect}
                onClick={() => setInteractionMode('select')}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
              </Button>
              <div className="zflow-canvas-toolbar__divider" />
              <Button type="button" size="icon" variant="outline" title={t.zflowToolbarAutoLayout} aria-label={t.zflowToolbarAutoLayout} onClick={handleAutoLayout}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                title={t.zflowToolbarFitView}
                aria-label={t.zflowToolbarFitView}
                onClick={() => void reactFlowInstanceRef.current?.fitView({ duration: 220, padding: 0.18, includeHiddenNodes: false })}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="outline" title={t.zflowToolbarZoomIn} aria-label={t.zflowToolbarZoomIn} onClick={() => void reactFlowInstanceRef.current?.zoomIn({ duration: 180 })}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="outline" title={t.zflowToolbarZoomOut} aria-label={t.zflowToolbarZoomOut} onClick={() => void reactFlowInstanceRef.current?.zoomOut({ duration: 180 })}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Panel>
          <Background gap={24} size={1.1} color="rgba(100,116,139,0.28)" />
          <MiniMap
            pannable
            zoomable
            bgColor="var(--zflow-minimap-bg)"
            nodeColor={(node) => getZflowMiniMapNodeColor(node as ZflowNode)}
            nodeStrokeColor="var(--zflow-minimap-node-stroke)"
            nodeStrokeWidth={1.5}
            nodeBorderRadius={6}
            maskColor="var(--zflow-minimap-mask)"
            maskStrokeColor="var(--zflow-minimap-mask-stroke)"
            maskStrokeWidth={1}
          />
        </ReactFlow>
        {renderedGuides.length ? (
          <div className="zflow-canvas-guides" aria-hidden="true">
            {renderedGuides.map((guide) => (
              <div
                key={guide.id}
                className={guide.axis === 'x' ? 'zflow-canvas-guide zflow-canvas-guide--vertical' : 'zflow-canvas-guide zflow-canvas-guide--horizontal'}
                style={guide.style}
              />
            ))}
          </div>
        ) : null}
      </div>
      <ZflowNodePanel
        t={t}
        locale={locale}
        nodeCount={visibleNodeCount}
        edgeCount={visibleEdgeCount}
        mode={mode}
        isRunning={isRunning}
        runPanelTab={runPanelTab}
        runInputValues={runInputValues}
        runEvents={runEvents}
        activeTab={selectedNode ? panelTab : 'nodes'}
        selectedNode={selectedNode}
        onTabChange={setPanelTab}
        onNodeDataChange={updateZflowNodeData}
        onOutputDataChange={updateZflowNodeOutputData}
        onOutputPortsChange={updateZflowNodeOutputPorts}
        nodes={presentedNodes}
        edges={presentedEdges}
        promptKindByPath={promptKindByPath}
        aiProviders={aiProviders}
        recipeVariableCategories={recipeVariableCategories}
        editorTabs={editorTabs}
        promptFileCache={promptFileCache}
        projectId={projectId}
        onOpenSource={onOpenSource}
        onRunPanelTabChange={setRunPanelTab}
        onRunInputChange={setRunInputValues}
        onRunFlow={() => void handleRunFlow()}
      />
    </div>
  )
}

function ZflowNodePanel({
  t,
  locale,
  nodeCount,
  edgeCount,
  mode,
  isRunning,
  runPanelTab,
  runInputValues,
  runEvents,
  activeTab,
  selectedNode,
  onTabChange,
  onNodeDataChange,
  onOutputDataChange,
  onOutputPortsChange,
  nodes,
  edges,
  promptKindByPath,
  aiProviders,
  recipeVariableCategories,
  editorTabs,
  promptFileCache,
  projectId,
  onOpenSource,
  onRunPanelTabChange,
  onRunInputChange,
  onRunFlow,
}: {
  t: WorkbenchCopy
  locale: Locale
  nodeCount: number
  edgeCount: number
  mode: 'edit' | 'run'
  isRunning: boolean
  runPanelTab: ZflowRunPanelTab
  runInputValues: ZflowRunInputValues
  runEvents: Array<Record<string, unknown>>
  activeTab: 'nodes' | 'editor'
  selectedNode: ZflowNode | null
  onTabChange: (tab: 'nodes' | 'editor') => void
  onNodeDataChange: (nodeId: string, data: Partial<ZflowNodeData>) => void
  onOutputDataChange: (nodeId: string, outputData: ZflowNodePort[]) => void
  onOutputPortsChange: (nodeId: string, outputPorts: ZflowNodePort[], removedOutputPortIds?: string[]) => void
  nodes: ZflowNode[]
  edges: ZflowEdge[]
  promptKindByPath: ZflowPromptKindByPath
  aiProviders: AiProviderSummary[]
  recipeVariableCategories: RecipeVariableCategory[]
  editorTabs: EditorFileTab[]
  promptFileCache: Record<string, ZflowPromptFileCacheEntry>
  projectId: string
  onOpenSource: () => void
  onRunPanelTabChange: (tab: ZflowRunPanelTab) => void
  onRunInputChange: (values: ZflowRunInputValues) => void
  onRunFlow: () => void
}) {
  const stats = t.zflowStats.replace('{nodes}', String(nodeCount)).replace('{edges}', String(edgeCount))
  const isRunMode = mode === 'run'

  return (
    <aside className="zflow-node-panel">
      <div className="zflow-node-panel__topbar">
        <div className="min-w-0">
          <div className="zflow-node-panel__title">{isRunMode ? (locale === 'en' ? 'Test panel' : '测试面板') : t.zflowNodePanel}</div>
          <div className="zflow-node-panel__stats">{stats}</div>
        </div>
        {!isRunMode ? <Button type="button" size="sm" variant="outline" onClick={onOpenSource}>
          <Code2 className="h-3.5 w-3.5" />
          {t.editorModes.source}
        </Button> : null}
      </div>
      {isRunMode ? (
        <ZflowRunPanel
          t={t}
          locale={locale}
          tab={runPanelTab}
          inputValues={runInputValues}
          runEvents={runEvents}
          isRunning={isRunning}
          nodes={nodes}
          onTabChange={onRunPanelTabChange}
          onInputChange={onRunInputChange}
          onRun={onRunFlow}
        />
      ) : (
      <Tabs
        value={selectedNode ? activeTab : 'nodes'}
        onValueChange={(value) => {
          if (value === 'nodes') onTabChange('nodes')
          if (value === 'editor' && selectedNode) onTabChange('editor')
        }}
        className="zflow-node-panel__tabs"
      >
        <TabsList className="zflow-node-panel__tablist">
          <TabsTrigger value="nodes" className="zflow-node-panel__tab">
            {t.zflowNodeList}
          </TabsTrigger>
          {selectedNode ? (
            <TabsTrigger value="editor" className="zflow-node-panel__tab">
              {t.zflowNodeEditor}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="nodes" className="zflow-node-panel__content">
          {ZFLOW_NODE_CATEGORY_DEFINITIONS.flatMap((category) => {
            const templates = ZFLOW_NODE_TEMPLATES.filter((template) => template.category === category.id)
            if (!templates.length) return []
            const CategoryIcon = category.icon
            return [(
              <section key={category.id} className="zflow-node-section">
                <div className="zflow-node-section__heading">
                  <span className={`zflow-node-section__icon zflow-node-section__icon--${category.id}`}>
                    <CategoryIcon className="h-3.5 w-3.5" />
                  </span>
                  <span>{localizeZflowText(category.label, locale)}</span>
                  <Badge variant="outline">{templates.length}</Badge>
                </div>
                <div className="zflow-node-section__grid">
                  {templates.map((template) => (
                    <ZflowNodeTemplateCard key={template.id} template={template} locale={locale} />
                  ))}
                </div>
              </section>
            )]
          })}
        </TabsContent>
        {selectedNode ? (
          <TabsContent value="editor" className="zflow-node-panel__content zflow-node-panel__content--editor">
            <ZflowNodeEditor
              t={t}
              locale={locale}
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              promptKindByPath={promptKindByPath}
              aiProviders={aiProviders}
              recipeVariableCategories={recipeVariableCategories}
              editorTabs={editorTabs}
              promptFileCache={promptFileCache}
              projectId={projectId}
              onChange={onNodeDataChange}
              onOutputDataChange={onOutputDataChange}
              onOutputPortsChange={onOutputPortsChange}
            />
          </TabsContent>
        ) : null}
      </Tabs>
      )}
    </aside>
  )
}

function ZflowRunPanel({
  t,
  locale,
  tab,
  inputValues,
  runEvents,
  isRunning,
  nodes,
  onTabChange,
  onInputChange,
  onRun,
}: {
  t: WorkbenchCopy
  locale: Locale
  tab: ZflowRunPanelTab
  inputValues: ZflowRunInputValues
  runEvents: Array<Record<string, unknown>>
  isRunning: boolean
  nodes: ZflowNode[]
  onTabChange: (tab: ZflowRunPanelTab) => void
  onInputChange: (values: ZflowRunInputValues) => void
  onRun: () => void
}) {
  const startNode = nodes.find(isZflowStartNode)
  const startInputs = startNode ? normalizeZflowNodeOutputData(startNode, locale) : []
  const [mediaInputError, setMediaInputError] = useState('')
  return (
    <Tabs value={tab} onValueChange={(value) => (value === 'input' || value === 'monitor') && onTabChange(value)} className="zflow-node-panel__tabs">
      <TabsList className="zflow-node-panel__tablist">
        <TabsTrigger value="input" className="zflow-node-panel__tab">
          {locale === 'en' ? 'Start input' : '起点输入'}
        </TabsTrigger>
        <TabsTrigger value="monitor" className="zflow-node-panel__tab">
          {locale === 'en' ? 'Monitor' : '运行监控'}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="input" className="zflow-node-panel__content">
        <section className="zflow-run-panel">
          <div className="zflow-run-panel__heading">{locale === 'en' ? 'Start output data' : '起点内需要填写的输出数据'}</div>
          <div className="zflow-run-panel__fields">
            {startInputs.length ? startInputs.map((item) => {
              const valueType = normalizeZflowPortValueType(item.valueType, 'string')
              if (valueType === 'image' || valueType === 'file') {
                const files = Array.isArray(inputValues[item.id]) ? inputValues[item.id] as ZpmtTestMediaFile[] : []
                const variable: ZpmtTestVariable = {
                  key: item.id,
                  token: `{{${valueType === 'image' ? 'img' : 'file'}:${item.id}}}`,
                  name: item.id,
                  label: item.label || item.id,
                  typeLabel: getZflowPortTypeLabel(valueType, t),
                  variableType: valueType,
                  mediaKind: valueType,
                  defaultValue: '',
                }
                return (
                  <div key={item.id} className="zflow-node-editor__field">
                    <span>{item.label || item.id} · {getZflowPortTypeLabel(valueType, t)}</span>
                    <TestMediaUploadControl
                      t={t}
                      variable={variable}
                      files={files}
                      disabled={isRunning}
                      onChange={(nextFiles) => {
                        setMediaInputError('')
                        onInputChange({ ...inputValues, [item.id]: nextFiles })
                      }}
                      onError={setMediaInputError}
                    />
                  </div>
                )
              }
              return (
                <label key={item.id} className="zflow-node-editor__field">
                  <span>{item.label || item.id} · {getZflowPortTypeLabel(valueType, t)}</span>
                  <Textarea
                    rows={valueType === 'object' || valueType === 'array' ? 4 : 2}
                    value={readString(inputValues[item.id])}
                    placeholder={getZflowRunInputPlaceholder(valueType, locale)}
                    onChange={(event) => onInputChange({ ...inputValues, [item.id]: event.target.value })}
                  />
                </label>
              )
            }) : (
              <div className="zflow-input-bindings__status">{locale === 'en' ? 'No start inputs configured' : '起点没有配置输入数据'}</div>
            )}
          </div>
          {mediaInputError ? <div className="zflow-node-editor__error">{mediaInputError}</div> : null}
          <Button type="button" size="sm" disabled={isRunning} onClick={onRun}>
            <Play className="h-3.5 w-3.5" />
            {isRunning ? (locale === 'en' ? 'Running' : '运行中') : (locale === 'en' ? 'Run' : '运行')}
          </Button>
        </section>
      </TabsContent>
      <TabsContent value="monitor" className="zflow-node-panel__content">
        <ZflowRunMonitor locale={locale} events={runEvents} isRunning={isRunning} nodes={nodes} />
      </TabsContent>
    </Tabs>
  )
}

function ZflowRunMonitor({ locale, events, isRunning, nodes }: { locale: Locale; events: Array<Record<string, unknown>>; isRunning: boolean; nodes: ZflowNode[] }) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string; index: number } | null>(null)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const visibleEvents = events.filter((event) => readString(event.type) !== 'node:end' || !('output' in event))
  return (
    <section className="zflow-run-panel">
      <div className="zflow-run-panel__heading">
        {isRunning ? (locale === 'en' ? 'Running...' : '正在运行...') : (locale === 'en' ? 'Run events' : '运行事件')}
      </div>
      <div className="zflow-run-monitor">
        {visibleEvents.length ? visibleEvents.map((event, index) => {
          const nodeId = readString(event.nodeId)
          const node = nodeId ? nodeById.get(nodeId) || null : null
          return (
            <article key={`${readString(event.type)}-${index}`} className={cn('zflow-run-event', `zflow-run-event--${readString(event.type).replace(':', '-') || 'event'}`)}>
              <div className="zflow-run-event__header">
                <span>{formatZflowRunEventTitle(event, node, locale)}</span>
                {typeof event.durationMs === 'number' ? <em>{Math.round(event.durationMs)}ms</em> : null}
              </div>
              {event.message ? <div className="zflow-run-event__message">{readString(event.message)}</div> : null}
              {'output' in event ? <ZflowRunPayloadView value={event.output} preferRich={isZflowEndRunEvent(event, node)} onPreviewImage={setPreviewImage} /> : null}
              {'state' in event ? <ZflowRunPayloadView value={event.state} /> : null}
            </article>
          )
        }) : (
          <div className="zflow-input-bindings__status">{locale === 'en' ? 'No run events yet' : '还没有运行事件'}</div>
        )}
      </div>
      {previewImage ? createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={() => setPreviewImage(null)}>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <a
              className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-700 shadow-lg transition hover:bg-white"
              href={previewImage.src}
              download={getZflowRunImageDownloadName(previewImage.src, previewImage.index)}
              title={locale === 'en' ? 'Download image' : '下载图片'}
              aria-label={locale === 'en' ? 'Download image' : '下载图片'}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-700 shadow-lg transition hover:bg-white"
              title={locale === 'en' ? 'Close' : '关闭'}
              aria-label={locale === 'en' ? 'Close' : '关闭'}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid justify-items-center" onMouseDown={(event) => event.stopPropagation()}>
            <img className="max-h-[82vh] max-w-[92vw] rounded-lg bg-white object-contain shadow-2xl" src={previewImage.src} alt={previewImage.alt || `result-${previewImage.index + 1}`} />
            {previewImage.alt ? (
              <p className="mt-3 max-w-[92vw] rounded-md bg-white/95 p-3 text-xs leading-5 text-slate-700 shadow-xl">{previewImage.alt}</p>
            ) : null}
          </div>
        </div>,
        window.document.body,
      ) : null}
    </section>
  )
}

function ZflowRunPayloadView({
  value,
  preferRich = false,
  onPreviewImage,
}: {
  value: unknown
  preferRich?: boolean
  onPreviewImage?: (image: { src: string; alt?: string; index: number }) => void
}) {
  if (preferRich) {
    const images = collectZflowRunImages(value)
    const text = collectZflowRunText(value)
    if (images.length || text.length) {
      return (
        <div className="zflow-run-event__result">
          {text.map((item, index) => (
            <div key={`text-${index}`} className="zflow-run-event__text">{item}</div>
          ))}
          {images.length ? (
            <div className="zflow-run-event__images">
              {images.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  className="zflow-run-event__image-link"
                  onClick={() => onPreviewImage?.({ ...image, index })}
                >
                  <img src={image.src} alt={image.alt || `result-${index + 1}`} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )
    }
  }
  if (typeof value === 'string') return <div className="zflow-run-event__text">{value}</div>
  return <pre className="zflow-run-event__payload">{formatJsonForDisplay(value)}</pre>
}

function isZflowEndRunEvent(event: Record<string, unknown>, node: ZflowNode | null) {
  const type = readString(event.type)
  return type === 'run:end' || (type === 'node:end' && node ? readString(node.data.nodeType) === 'end' || readString(node.data.kind) === 'end' : false)
}

function collectZflowRunText(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : []
  if (Array.isArray(value)) return value.flatMap(collectZflowRunText)
  if (!isRecord(value)) return []
  const direct = readString(value.output || value.result || value.text || value.content)
  const nested = Object.entries(value)
    .filter(([key]) => !isLikelyImageResultKey(key))
    .flatMap(([, item]) => collectZflowRunText(item))
  return Array.from(new Set([direct, ...nested].map((item) => item.trim()).filter(Boolean)))
}

function collectZflowRunImages(value: unknown): Array<{ src: string; alt?: string }> {
  return dedupeZflowRunImages(collectZflowRunImagesDeep(value))
}

function collectZflowRunImagesDeep(value: unknown): Array<{ src: string; alt?: string }> {
  if (typeof value === 'string') return isZflowImageSource(value) ? [{ src: value }] : []
  if (Array.isArray(value)) return value.flatMap(collectZflowRunImagesDeep)
  if (!isRecord(value)) return []
  const src = readString(value.src || value.url || value.dataUrl || value.imageUrl)
  if (isZflowImageSource(src)) {
    return [{ src, alt: readString(value.revisedPrompt || value.alt || value.filename) || undefined }]
  }
  return Object.values(value).flatMap(collectZflowRunImagesDeep)
}

function dedupeZflowRunImages(images: Array<{ src: string; alt?: string }>) {
  const seen = new Set<string>()
  return images.filter((image) => {
    if (seen.has(image.src)) return false
    seen.add(image.src)
    return true
  })
}

function isLikelyImageResultKey(key: string) {
  const normalized = key.toLowerCase()
  return normalized.includes('image') || normalized.includes('images') || normalized.includes('src') || normalized.includes('url')
}

function isZflowImageSource(value: string) {
  if (!value) return false
  if (/^data:image\//i.test(value)) return true
  return /^https?:\/\/\S+\.(png|jpe?g|webp|gif|bmp|svg)(?:[?#]\S*)?$/i.test(value)
}

function getZflowRunImageDownloadName(src: string, index: number) {
  return `zflow-result-${index + 1}.${inferPromptTestImageExtension(src)}`
}

function getZflowRunInputPlaceholder(valueType: ZflowPortValueType, locale: Locale) {
  const type = normalizeZflowPortValueType(valueType, 'string')
  if (type === 'array') return '[...]'
  if (type === 'object') return '{"key":"value"}'
  if (type === 'boolean') return locale === 'en' ? 'true / false' : 'true / false'
  if (type === 'number') return '0'
  return locale === 'en' ? 'Enter value' : '填写内容'
}

function getZflowStartRunInput(nodes: ZflowNode[], values: ZflowRunInputValues) {
  const startNode = nodes.find(isZflowStartNode)
  const ports = startNode ? normalizeZflowNodeOutputData(startNode, 'zh') : []
  return Object.fromEntries(ports.map((port) => [port.id, parseZflowRunInputValue(values[port.id] ?? '', port.valueType || 'string')]))
}

function parseZflowRunInputValue(value: string | ZpmtTestMediaFile[], valueType: ZflowPortValueType) {
  const type = normalizeZflowPortValueType(valueType, 'string')
  if (type === 'image' || type === 'file') return Array.isArray(value) ? value : []
  const textValue = readString(value)
  if (type === 'number') {
    const numberValue = Number(textValue)
    return Number.isFinite(numberValue) ? numberValue : textValue
  }
  if (type === 'boolean') return textValue === 'true' || textValue === '1' || textValue === '是'
  if (type === 'array' || type === 'object') {
    try {
      return textValue.trim() ? JSON.parse(textValue) : type === 'array' ? [] : {}
    } catch {
      return textValue
    }
  }
  return textValue
}

function formatZflowRunEventTitle(event: Record<string, unknown>, node: ZflowNode | null, locale: Locale) {
  const type = readString(event.type)
  const nodeLabel = node ? readString(node.data.label) || node.id : readString(event.nodeId)
  if (type === 'run:start') return locale === 'en' ? 'Run started' : '流程开始'
  if (type === 'run:end') return locale === 'en' ? 'Run finished' : '流程结束'
  if (type === 'run:error') return locale === 'en' ? 'Run failed' : '流程失败'
  if (type === 'node:start') return `${nodeLabel} · ${locale === 'en' ? 'started' : '触发'}`
  if (type === 'node:update') return `${nodeLabel} · ${locale === 'en' ? 'state update' : '状态更新'}`
  if (type === 'node:end') return `${nodeLabel} · ${locale === 'en' ? 'output' : '输出'}`
  if (type === 'node:error') return `${nodeLabel} · ${locale === 'en' ? 'failed' : '失败'}`
  if (type === 'diagnostic') return locale === 'en' ? 'Diagnostic' : '诊断'
  return type || (locale === 'en' ? 'Event' : '事件')
}

function formatJsonForDisplay(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function ZflowNodeEditor({
  t,
  locale,
  node,
  nodes,
  edges,
  promptKindByPath,
  aiProviders,
  recipeVariableCategories,
  editorTabs,
  promptFileCache,
  projectId,
  onChange,
  onOutputDataChange,
  onOutputPortsChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  node: ZflowNode
  nodes: ZflowNode[]
  edges: ZflowEdge[]
  promptKindByPath: ZflowPromptKindByPath
  aiProviders: AiProviderSummary[]
  recipeVariableCategories: RecipeVariableCategory[]
  editorTabs: EditorFileTab[]
  promptFileCache: Record<string, ZflowPromptFileCacheEntry>
  projectId: string
  onChange: (nodeId: string, data: Partial<ZflowNodeData>) => void
  onOutputDataChange: (nodeId: string, outputData: ZflowNodePort[]) => void
  onOutputPortsChange: (nodeId: string, outputPorts: ZflowNodePort[], removedOutputPortIds?: string[]) => void
}) {
  const inputPorts = normalizeZflowNodePortsForDirection(node.data, 'target')
  const outputPorts = normalizeZflowNodePortsForDirection(node.data, 'source')
  const outputData = normalizeZflowNodeOutputData(node, locale, promptKindByPath)
  const canEditOutputData = isZflowOutputDataEditable(node)
  const canEditOutputPorts = isZflowOutputPortsEditable(node)
  const isEndNode = readString(node.data.nodeType) === 'end' || readString(node.data.kind) === 'end'
  const bindingView = useMemo(
    () => getZflowInputBindingView({
      node,
      inputPorts,
      t,
      locale,
      projectId,
      aiProviders,
      recipeVariableCategories,
      editorTabs,
      promptFileCache,
    }),
    [aiProviders, editorTabs, inputPorts, locale, node, projectId, promptFileCache, recipeVariableCategories, t],
  )
  const upstreamOptions = useMemo(
    () => getZflowUpstreamOutputOptions(node.id, nodes, edges, promptKindByPath),
    [edges, node.id, nodes, promptKindByPath],
  )
  const inputBindings = isEndNode ? readZflowEndInputBindings(node.data.config) : readZflowInputBindings(node.data.config)

  function updateInputBinding(key: string, binding: ZflowInputBinding) {
    const config = cloneZflowConfig(isRecord(node.data.config) ? node.data.config : {})
    const currentBindings = readZflowInputBindings(config)
    if (isEndNode && !Array.isArray(config.returnValues)) {
      config.returnValues = bindingView.items.map((item) => ({
        id: item.key,
        label: item.label,
        valueType: item.valueType,
      }))
      delete config.returnPaths
    }
    config.bindings = {
      ...currentBindings,
      [key]: normalizeZflowInputBinding(binding),
    }
    delete config.inputBindings
    onChange(node.id, { config })
  }

  function updateReturnValues(returnValues: ZflowNodePort[]) {
    const config = cloneZflowConfig(isRecord(node.data.config) ? node.data.config : {})
    const currentBindings = readZflowEndInputBindings(config)
    const nextIds = new Set(returnValues.map((item) => item.id))
    config.returnValues = returnValues
    config.bindings = Object.fromEntries(Object.entries(currentBindings).filter(([key]) => nextIds.has(key)))
    delete config.returnPaths
    delete config.inputBindings
    onChange(node.id, { config })
  }

  return (
    <div className="zflow-node-editor">
      <label className="zflow-node-editor__field">
        <span>{t.zflowNodeName}</span>
        <Input value={readString(node.data.label)} onChange={(event) => onChange(node.id, { label: event.target.value })} />
      </label>
      <label className="zflow-node-editor__field">
        <span>{t.zflowNodeDescription}</span>
        <Textarea value={readString(node.data.description)} rows={3} onChange={(event) => onChange(node.id, { description: event.target.value })} />
      </label>
      {!isZflowStartNode(node) ? (
        <ZflowNodeRuntimeFields locale={locale} node={node} onChange={onChange} />
      ) : null}
      {canEditOutputPorts ? (
        <div className="zflow-node-editor__meta zflow-node-editor__meta--start">
          <div>
            <span>{t.zflowNodeOutputPorts}</span>
            <ZflowOutputPortEditor t={t} locale={locale} node={node} ports={outputPorts} onChange={onOutputPortsChange} />
          </div>
        </div>
      ) : null}
      {canEditOutputData ? (
        <section className="zflow-node-editor__meta zflow-node-editor__meta--start">
          <ZflowOutputDataEditor t={t} locale={locale} node={node} outputData={outputData} readonly={!isZflowOutputDataEditable(node)} onChange={onOutputDataChange} />
        </section>
      ) : outputData.length ? (
        <section className="zflow-node-editor__meta zflow-node-editor__meta--start">
          <div>
            <span>{t.zflowNodeOutputData}</span>
            <div className="zflow-node-editor__port-list">
              {outputData.map((port) => (
                <span key={port.id} className="zflow-node-editor__port-chip">
                  <strong>{port.label || port.id}</strong>
                  <em style={getZflowPortBadgeStyle(port.valueType || 'any')}>{getZflowPortTypeLabel(port.valueType || 'any', t)}</em>
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {bindingView.items.length || isEndNode ? (
        <ZflowInputBindingEditor
          t={t}
          locale={locale}
          items={bindingView.items}
          bindings={inputBindings}
          upstreamOptions={upstreamOptions}
          onChange={updateInputBinding}
          editableItems={isEndNode}
          onItemsChange={isEndNode ? updateReturnValues : undefined}
        />
      ) : bindingView.status ? (
        <ZflowInputBindingStatus locale={locale} status={bindingView.status} />
      ) : null}
    </div>
  )
}

function ZflowOutputDataEditor({
  t,
  locale,
  node,
  outputData,
  readonly = false,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  node: ZflowNode
  outputData: ZflowNodePort[]
  readonly?: boolean
  onChange: (nodeId: string, outputData: ZflowNodePort[]) => void
}) {
  const normalizedOutputs = outputData.length ? outputData : getDefaultZflowOutputDataForNode(node, locale)
  const allowedTypes = isZflowStartNode(node) ? ZFLOW_START_OUTPUT_TYPES : ['any', 'string', 'number', 'text', 'object', 'array', 'color', 'boolean', 'image', 'file'] as ZflowPortValueType[]

  function commit(nextOutputs: ZflowNodePort[]) {
    onChange(node.id, nextOutputs.map((port) => ({
      id: normalizeZflowHandleId(port.id) || createZflowStartOutputId(port.label, nextOutputs),
      label: readString(port.label) || (locale === 'en' ? 'Output' : '输出'),
      valueType: isZflowStartNode(node) ? normalizeZflowStartOutputType(port.valueType) : normalizeZflowPortValueType(port.valueType, 'any'),
    })))
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span>{t.zflowNodeOutputData}</span>
        {!readonly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="zflow-node-editor__port-add"
            onClick={() => {
              const label = locale === 'en' ? `Output ${normalizedOutputs.length + 1}` : `输出 ${normalizedOutputs.length + 1}`
              commit(normalizedOutputs.concat({ id: createZflowStartOutputId(label, normalizedOutputs), label, valueType: 'string' }))
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t.zflowStartAddOutput}
          </Button>
        ) : null}
      </div>
      <div className="zflow-node-editor__port-list zflow-node-editor__port-list--editable">
        {normalizedOutputs.map((port, index) => (
          <div key={port.id} className="zflow-node-editor__port-chip zflow-node-editor__port-chip--editable">
            <Input
              className="zflow-node-editor__port-input"
              aria-label={t.zflowOutputName}
              value={port.label}
              readOnly={readonly}
              onChange={(event) => {
                const nextOutputs = normalizedOutputs.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item))
                commit(nextOutputs)
              }}
            />
            <select
              className="zflow-node-editor__port-select"
              style={getZflowPortBadgeStyle(normalizeZflowStartOutputType(port.valueType))}
              aria-label={t.zflowOutputType}
              disabled={readonly}
              value={isZflowStartNode(node) ? normalizeZflowStartOutputType(port.valueType) : normalizeZflowPortValueType(port.valueType, 'any')}
              onChange={(event) => {
                const nextValueType = isZflowStartNode(node) ? normalizeZflowStartOutputType(event.target.value) : normalizeZflowPortValueType(event.target.value, 'any')
                const nextOutputs = normalizedOutputs.map((item, itemIndex) => (itemIndex === index ? { ...item, valueType: nextValueType } : item))
                commit(nextOutputs)
              }}
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {getZflowPortTypeLabel(type, t)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="zflow-node-editor__port-delete"
              disabled={readonly || normalizedOutputs.length <= 1}
              aria-label={locale === 'en' ? 'Delete output' : '删除输出'}
              onClick={() => commit(normalizedOutputs.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ZflowNodeRuntimeFields({
  locale,
  node,
  onChange,
}: {
  locale: Locale
  node: ZflowNode
  onChange: (nodeId: string, data: Partial<ZflowNodeData>) => void
}) {
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  const config = isRecord(node.data.config) ? node.data.config : {}

  function commit(patch: Record<string, unknown>) {
    onChange(node.id, { config: { ...config, ...patch } })
  }

  function fieldLabel(zh: string, en: string) {
    return locale === 'en' ? en : zh
  }

  if (nodeType === 'prompt') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('提示词文件', 'Prompt file')}</span>
          <Input value={readString(config.filePath)} onChange={(event) => commit({ filePath: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输出变量', 'Output variable')}</span>
          <Input value={readString(config.outputPath) || (readString(config.promptKind) === 'image' ? 'image' : 'result')} onChange={(event) => commit({ outputPath: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'state') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输出变量', 'Output variable')}</span>
          <Input value={readString(config.outputPath) || readString(config.name)} onChange={(event) => commit({ outputPath: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('写入值', 'Value')}</span>
          <Textarea rows={3} value={readString(config.value)} onChange={(event) => commit({ value: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'tool') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>toolId</span>
          <Input value={readString(config.toolId)} onChange={(event) => commit({ toolId: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输出变量', 'Output variable')}</span>
          <Input value={readString(config.outputPath) || 'toolResult'} onChange={(event) => commit({ outputPath: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'http') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('请求方式', 'Method')}</span>
          <select className="zflow-input-binding__select" value={readString(config.method) || 'GET'} onChange={(event) => commit({ method: event.target.value })}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>
        <label className="zflow-node-editor__field">
          <span>URL</span>
          <Input value={readString(config.url)} placeholder="https://api.example.com/items?query={{input}}" onChange={(event) => commit({ url: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('Headers（JSON，可选）', 'Headers (JSON, optional)')}</span>
          <Textarea rows={3} value={readString(config.headers)} placeholder={'{"Authorization":"Bearer {{token}}"}'} onChange={(event) => commit({ headers: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('Body（POST，可选）', 'Body (POST, optional)')}</span>
          <Textarea rows={4} value={readString(config.body)} placeholder={'{"prompt":"{{result}}"}'} onChange={(event) => commit({ body: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输出变量', 'Output variable')}</span>
          <Input value={readString(config.outputPath) || 'response'} onChange={(event) => commit({ outputPath: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'router') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('左值', 'Left value')}</span>
          <Input value={readString(config.left || config.source)} onChange={(event) => commit({ left: event.target.value })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('判断方式', 'Operator')}</span>
          <select className="zflow-input-binding__select" value={readString(config.operator) || 'notEmpty'} onChange={(event) => commit({ operator: event.target.value })}>
            {ZFLOW_CONDITION_OPERATORS.map((operator) => (
              <option key={operator} value={operator}>{operator}</option>
            ))}
          </select>
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('右值', 'Right value')}</span>
          <Input value={readString(config.right || config.value)} onChange={(event) => commit({ right: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'array-merge') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输入变量路径', 'Input paths')}</span>
          <Textarea rows={4} value={readStringArray(config.sourcePaths).join('\n')} placeholder="images&#10;items" onChange={(event) => commit({ sourcePaths: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输出变量', 'Output variable')}</span>
          <Input value={readString(config.outputPath) || 'mergedItems'} onChange={(event) => commit({ outputPath: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'parallel-merge') {
    return (
      <section className="zflow-node-editor__runtime">
        <label className="zflow-node-editor__field">
          <span>{fieldLabel('输出变量（可选）', 'Output variable (optional)')}</span>
          <Input value={readString(config.outputPath)} onChange={(event) => commit({ outputPath: event.target.value })} />
        </label>
      </section>
    )
  }

  if (nodeType === 'end') return null

  return (
    <section className="zflow-node-editor__runtime">
      <div className="zflow-input-bindings__status">{locale === 'en' ? 'No editable runtime fields' : '没有可编辑运行字段'}</div>
    </section>
  )
}

function ZflowOutputPortEditor({
  t,
  locale,
  node,
  ports,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  node: ZflowNode
  ports: ZflowNodePort[]
  onChange: (nodeId: string, outputPorts: ZflowNodePort[], removedOutputPortIds?: string[]) => void
}) {
  const normalizedPorts = ports.length ? ports : [{ id: 'out', label: locale === 'en' ? 'Output' : '输出', valueType: 'any' as ZflowPortValueType }]

  function commit(nextPorts: ZflowNodePort[], removedOutputPortIds: string[] = []) {
    onChange(node.id, nextPorts.map((port) => ({
      id: normalizeZflowHandleId(port.id) || createZflowStartOutputId(port.label, nextPorts),
      label: readString(port.label) || (locale === 'en' ? 'Output' : '输出'),
      valueType: normalizeZflowPortValueType(port.valueType, 'any'),
    })), removedOutputPortIds)
  }

  return (
    <div className="zflow-node-editor__port-list zflow-node-editor__port-list--editable">
      {normalizedPorts.map((port, index) => (
        <div key={port.id} className="zflow-node-editor__port-chip zflow-node-editor__port-chip--editable">
          <Input
            className="zflow-node-editor__port-input"
            aria-label={t.zflowOutputName}
            value={port.label}
            onChange={(event) => commit(normalizedPorts.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
          />
          <select
            className="zflow-node-editor__port-select"
            style={getZflowPortBadgeStyle(normalizeZflowPortValueType(port.valueType, 'any'))}
            aria-label={t.zflowOutputType}
            value={normalizeZflowPortValueType(port.valueType, 'any')}
            onChange={(event) => commit(normalizedPorts.map((item, itemIndex) => (itemIndex === index ? { ...item, valueType: normalizeZflowPortValueType(event.target.value, 'any') } : item)))}
          >
            {(['any', 'string', 'number', 'text', 'object', 'array', 'color', 'boolean', 'image', 'file', 'error'] as ZflowPortValueType[]).map((type) => (
              <option key={type} value={type}>
                {getZflowPortTypeLabel(type, t)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="zflow-node-editor__port-delete"
            disabled={normalizedPorts.length <= 1}
            aria-label={locale === 'en' ? 'Delete output port' : '删除输出端点'}
            onClick={() => commit(normalizedPorts.filter((_, itemIndex) => itemIndex !== index), [port.id])}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="zflow-node-editor__port-add"
        onClick={() => {
          const label = locale === 'en' ? `Port ${normalizedPorts.length + 1}` : `端点 ${normalizedPorts.length + 1}`
          commit(normalizedPorts.concat({ id: createZflowStartOutputId(label, normalizedPorts), label, valueType: 'any' }))
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        {t.zflowBranchAddPort}
      </Button>
    </div>
  )
}

function ZflowConditionEditor({
  t,
  locale,
  node,
  upstreamOptions,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  node: ZflowNode
  upstreamOptions: ZflowUpstreamOutputOption[]
  onChange: (config: Record<string, unknown>) => void
}) {
  const conditionConfig = readZflowConditionConfig(node.data.config)
  const sourceNodes = getZflowSourceNodeOptions(upstreamOptions)

  function commit(nextConfig: ZflowConditionConfig) {
    onChange(writeZflowConditionConfig(node.data.config, nextConfig))
  }

  function updateRule(ruleId: string, patch: Partial<ZflowConditionRule>) {
    commit({
      ...conditionConfig,
      conditions: conditionConfig.conditions.map((condition) => {
        if (condition.id !== ruleId) return condition
        const nextCondition = { ...condition, ...patch }
        if (!conditionOperatorNeedsValue(nextCondition.operator)) nextCondition.value = ''
        return nextCondition
      }),
    })
  }

  return (
    <section className="zflow-condition-editor">
      <div className="zflow-condition-editor__heading">
        <span>{t.zflowConditionRules}</span>
        <ToggleGroup
          type="single"
          value={conditionConfig.conditionMode}
          onValueChange={(value) => {
            if (value === 'all' || value === 'any') commit({ ...conditionConfig, conditionMode: value })
          }}
        >
          <ToggleGroupItem value="all" className="h-6 px-2 text-[10px]">{t.zflowConditionModeAll}</ToggleGroupItem>
          <ToggleGroupItem value="any" className="h-6 px-2 text-[10px]">{t.zflowConditionModeAny}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="zflow-condition-editor__list">
        {conditionConfig.conditions.map((condition) => {
          const selectedNodeId = sourceNodes.some((sourceNode) => sourceNode.nodeId === condition.sourceNodeId)
            ? condition.sourceNodeId
            : sourceNodes[0]?.nodeId || ''
          const nodeOutputOptions = selectedNodeId ? upstreamOptions.filter((option) => option.nodeId === selectedNodeId) : []
          const selectedOutputId = nodeOutputOptions.some((option) => option.outputId === condition.sourceOutputId)
            ? condition.sourceOutputId
            : nodeOutputOptions[0]?.outputId || ''
          return (
            <div key={condition.id} className="zflow-condition-rule">
              <select
                className="zflow-input-binding__select"
                aria-label={t.zflowConditionSourceNode}
                value={selectedNodeId}
                onChange={(event) => {
                  const nextNodeId = event.target.value
                  const firstOutput = upstreamOptions.find((option) => option.nodeId === nextNodeId)
                  updateRule(condition.id, { sourceNodeId: nextNodeId, sourceOutputId: firstOutput?.outputId || '' })
                }}
              >
                <option value="">{upstreamOptions.length ? t.zflowConditionSourceNode : (locale === 'en' ? 'No upstream node' : '无前置节点')}</option>
                {sourceNodes.map((sourceNode) => (
                  <option key={sourceNode.nodeId} value={sourceNode.nodeId}>{sourceNode.nodeLabel}</option>
                ))}
              </select>
              <select
                className="zflow-input-binding__select"
                aria-label={t.zflowConditionSourceVariable}
                value={selectedOutputId}
                disabled={!selectedNodeId}
                onChange={(event) => updateRule(condition.id, { sourceNodeId: selectedNodeId, sourceOutputId: event.target.value })}
              >
                <option value="">{nodeOutputOptions.length ? t.zflowConditionSourceVariable : (locale === 'en' ? 'No variable' : '无变量')}</option>
                {nodeOutputOptions.map((option) => (
                  <option key={option.id} value={option.outputId}>
                    {option.label} · {getZflowPortTypeLabel(option.valueType, t)}
                  </option>
                ))}
              </select>
              <select
                className="zflow-input-binding__select"
                value={condition.operator}
                onChange={(event) => updateRule(condition.id, { operator: normalizeZflowConditionOperator(event.target.value) })}
              >
                {ZFLOW_CONDITION_OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>{t.zflowConditionOperators[operator]}</option>
                ))}
              </select>
              {conditionOperatorNeedsValue(condition.operator) ? (
                <Input
                  className="zflow-condition-rule__value"
                  aria-label={t.zflowConditionValue}
                  value={condition.value}
                  placeholder={t.zflowConditionValue}
                  onChange={(event) => updateRule(condition.id, { value: event.target.value })}
                />
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="zflow-node-editor__port-delete"
                aria-label={locale === 'en' ? 'Delete condition' : '删除条件'}
                onClick={() => commit({ ...conditionConfig, conditions: conditionConfig.conditions.filter((item) => item.id !== condition.id) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        })}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="zflow-node-editor__port-add"
        onClick={() => commit({ ...conditionConfig, conditions: conditionConfig.conditions.concat(createZflowConditionRule(conditionConfig.conditions, upstreamOptions)) })}
      >
        <Plus className="h-3.5 w-3.5" />
        {t.zflowConditionAddRule}
      </Button>
    </section>
  )
}

function ZflowInputBindingEditor({
  t,
  locale,
  items,
  bindings,
  upstreamOptions,
  onChange,
  editableItems = false,
  onItemsChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  items: ZflowInputBindingItem[]
  bindings: Record<string, ZflowInputBinding>
  upstreamOptions: ZflowUpstreamOutputOption[]
  onChange: (key: string, binding: ZflowInputBinding) => void
  editableItems?: boolean
  onItemsChange?: (items: ZflowNodePort[]) => void
}) {
  const [draftItemLabels, setDraftItemLabels] = useState<Record<string, string>>({})

  function commitItems(nextItems: ZflowInputBindingItem[]) {
    onItemsChange?.(nextItems.map((item) => ({
      id: normalizeZflowHandleId(item.key) || createZflowStartOutputId(item.label, nextItems.map((candidate) => ({ id: candidate.key, label: candidate.label, valueType: candidate.valueType }))),
      label: typeof item.label === 'string' ? item.label : item.key,
      valueType: normalizeZflowPortValueType(item.valueType, 'any'),
    })))
  }

  return (
    <section className="zflow-input-bindings">
      <div className="zflow-input-bindings__heading">
        <span>{locale === 'en' ? 'Input content' : '输入内容'}</span>
        {editableItems ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="zflow-node-editor__port-add"
            onClick={() => {
              const label = locale === 'en' ? `Return ${items.length + 1}` : `返回值 ${items.length + 1}`
              commitItems(items.concat({ key: createZflowStartOutputId(label, items.map((item) => ({ id: item.key, label: item.label, valueType: item.valueType }))), label, typeLabel: getZflowPortTypeLabel('any', t), valueType: 'any', defaultValue: '' }))
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {locale === 'en' ? 'Add return' : '新增返回值'}
          </Button>
        ) : null}
      </div>
      <div className="zflow-input-bindings__list">
        {!items.length && editableItems ? (
          <div className="zflow-input-bindings__status">{locale === 'en' ? 'No return values yet' : '还没有返回值'}</div>
        ) : null}
        {items.map((item) => {
          const binding = bindings[item.key] || createDefaultZflowInputBinding(item)
          const mode = binding.mode === 'source' ? 'source' : 'value'
          const compatibleOptions = upstreamOptions.filter((option) => isZflowUpstreamOutputCompatible(option, item.valueType))
          const selectedOutputId = readString(binding.sourceOutputId) || readString(binding.sourceHandle)
          const selectedSourceId = binding.sourceNodeId && selectedOutputId ? `${binding.sourceNodeId}:${selectedOutputId}` : ''
          const sourceNodes = getZflowSourceNodeOptions(compatibleOptions)
          const selectedNodeId = sourceNodes.some((sourceNode) => sourceNode.nodeId === binding.sourceNodeId)
            ? readString(binding.sourceNodeId)
            : ''
          const nodeOutputOptions = selectedNodeId ? compatibleOptions.filter((option) => option.nodeId === selectedNodeId) : []
          const selectedNodeOutputId = nodeOutputOptions.some((option) => option.id === selectedSourceId)
            ? selectedSourceId
            : ''
          return (
            <div key={item.key} className="zflow-input-binding">
              <div className={cn('zflow-input-binding__header', editableItems && 'zflow-input-binding__header--return')}>
                {editableItems ? (
                  <div className="zflow-return-binding-editor">
                    <Input
                      className="zflow-return-binding-editor__name"
                      value={draftItemLabels[item.key] ?? item.label}
                      aria-label={locale === 'en' ? 'Return name' : '返回值名称'}
                      onChange={(event) => {
                        const nextLabel = event.target.value
                        setDraftItemLabels((current) => ({ ...current, [item.key]: nextLabel }))
                        commitItems(items.map((candidate) => (candidate.key === item.key ? { ...candidate, label: nextLabel } : candidate)))
                      }}
                      onBlur={() => {
                        setDraftItemLabels((current) => {
                          const next = { ...current }
                          delete next[item.key]
                          return next
                        })
                      }}
                    />
                    <div className="zflow-return-binding-editor__controls">
                      <select
                        className="zflow-input-binding__select"
                        value={item.valueType}
                        onChange={(event) => {
                          const nextType = normalizeZflowPortValueType(event.target.value, 'any')
                          commitItems(items.map((candidate) => (candidate.key === item.key ? { ...candidate, valueType: nextType, typeLabel: getZflowPortTypeLabel(nextType, t) } : candidate)))
                        }}
                      >
                        {(['any', 'string', 'number', 'text', 'object', 'array', 'color', 'boolean', 'image', 'file'] as ZflowPortValueType[]).map((type) => (
                          <option key={type} value={type}>{getZflowPortTypeLabel(type, t)}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="zflow-node-editor__port-delete"
                        aria-label={locale === 'en' ? 'Delete return' : '删除返回值'}
                        onClick={() => commitItems(items.filter((candidate) => candidate.key !== item.key))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="zflow-input-binding__label">{item.label}</div>
                    <div className="zflow-input-binding__type">{item.typeLabel}</div>
                  </div>
                )}
                <ToggleGroup
                  type="single"
                  value={mode}
                  onValueChange={(value) => {
                    if (value === 'value') onChange(item.key, { ...binding, mode: 'value', value: readZflowBindingValue(binding, item) })
                    if (value === 'source') {
                      const firstOption = compatibleOptions[0]
                      onChange(item.key, firstOption ? createZflowSourceBinding(firstOption) : { ...binding, mode: 'source' })
                    }
                  }}
                >
                  <ToggleGroupItem value="value" className="h-6 px-2 text-[10px]">{locale === 'en' ? 'Value' : '值'}</ToggleGroupItem>
                  <ToggleGroupItem value="source" className="h-6 px-2 text-[10px]">{locale === 'en' ? 'Source' : '来源'}</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {mode === 'source' ? (
                <div className="zflow-input-binding__source-grid">
                  <select
                    className="zflow-input-binding__select"
                    value={selectedNodeId}
                    onChange={(event) => {
                      const nextNodeId = event.target.value
                      const option = compatibleOptions.find((candidate) => candidate.nodeId === nextNodeId)
                      onChange(item.key, option ? createZflowSourceBinding(option) : { mode: 'source' })
                    }}
                  >
                    <option value="">{compatibleOptions.length ? (locale === 'en' ? 'Select upstream node' : '选择前置节点') : (locale === 'en' ? 'No compatible upstream node' : '无可用前置节点')}</option>
                    {sourceNodes.map((sourceNode) => (
                      <option key={sourceNode.nodeId} value={sourceNode.nodeId}>
                        {sourceNode.nodeLabel}
                      </option>
                    ))}
                  </select>
                  <select
                    className="zflow-input-binding__select"
                    value={selectedNodeOutputId}
                    disabled={!selectedNodeId}
                    onChange={(event) => {
                      const option = nodeOutputOptions.find((candidate) => candidate.id === event.target.value)
                      onChange(item.key, option ? createZflowSourceBinding(option) : { mode: 'source', sourceNodeId: selectedNodeId })
                    }}
                  >
                    <option value="">{nodeOutputOptions.length ? (locale === 'en' ? 'Select variable' : '选择变量') : (locale === 'en' ? 'No variable' : '无变量')}</option>
                    {nodeOutputOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {getZflowPortTypeLabel(option.valueType, t)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : item.recipe ? (
                <ZflowRecipeValueInput locale={locale} item={item} binding={binding} onChange={(nextBinding) => onChange(item.key, nextBinding)} />
              ) : (
                <Textarea
                  className="zflow-input-binding__textarea"
                  rows={2}
                  value={readZflowBindingValue(binding, item)}
                  placeholder={item.defaultValue || item.label}
                  onChange={(event) => onChange(item.key, { ...binding, mode: 'value', value: event.target.value, valueType: item.valueType })}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ZflowInputBindingStatus({ locale, status }: { locale: Locale; status: ZflowInputBindingStatusKind }) {
  const text = status === 'error'
    ? locale === 'en' ? 'Failed to read prompt variables' : '提示词变量读取失败'
    : status === 'empty'
      ? locale === 'en' ? 'No variables found in this prompt' : '该提示词没有可绑定变量'
      : locale === 'en' ? 'Reading prompt variables...' : '正在读取提示词变量...'

  return (
    <section className="zflow-input-bindings">
      <div className="zflow-input-bindings__heading">{locale === 'en' ? 'Input content' : '输入内容'}</div>
      <div className="zflow-input-bindings__status">{text}</div>
    </section>
  )
}

function ZflowRecipeValueInput({
  locale,
  item,
  binding,
  onChange,
}: {
  locale: Locale
  item: ZflowInputBindingItem
  binding: ZflowInputBinding
  onChange: (binding: ZflowInputBinding) => void
}) {
  const recipe = item.recipe
  if (!recipe) return null
  const candidates = Array.from(new Set([...recipe.candidates, ...recipe.defaultValues, item.defaultValue].flatMap((value) => splitZflowBindingValues(value)).filter(Boolean)))
  if (recipe.multiple) {
    const selectedValues = new Set(readZflowBindingValues(binding, item))
    return (
      <div className="zflow-input-binding__choices">
        {candidates.length ? candidates.map((candidate) => (
          <label key={candidate} className="zflow-input-binding__choice">
            <input
              type="checkbox"
              checked={selectedValues.has(candidate)}
              onChange={(event) => {
                const nextValues = new Set(selectedValues)
                if (event.target.checked) nextValues.add(candidate)
                else nextValues.delete(candidate)
                onChange({ ...binding, mode: 'value', values: Array.from(nextValues), value: Array.from(nextValues).join(', '), valueType: 'string' })
              }}
            />
            <span>{candidate}</span>
          </label>
        )) : (
          <Textarea
            className="zflow-input-binding__textarea"
            rows={2}
            value={readZflowBindingValue(binding, item)}
            placeholder={locale === 'en' ? 'No recipe candidates' : '无配方候选项'}
            onChange={(event) => onChange({ ...binding, mode: 'value', value: event.target.value, valueType: 'string' })}
          />
        )}
      </div>
    )
  }
  return (
    <select
      className="zflow-input-binding__select"
      value={readZflowBindingValue(binding, item)}
      onChange={(event) => onChange({ ...binding, mode: 'value', value: event.target.value, valueType: 'string' })}
    >
      <option value="">{locale === 'en' ? 'Select recipe value' : '选择配方项'}</option>
      {candidates.map((candidate) => (
        <option key={candidate} value={candidate}>{candidate}</option>
      ))}
    </select>
  )
}

function getZflowInputBindingView(input: {
  node: ZflowNode
  inputPorts: ZflowNodePort[]
  t: WorkbenchCopy
  locale: Locale
  projectId: string
  aiProviders: AiProviderSummary[]
  recipeVariableCategories: RecipeVariableCategory[]
  editorTabs: EditorFileTab[]
  promptFileCache: Record<string, ZflowPromptFileCacheEntry>
}): ZflowInputBindingView {
  const nodeType = readString(input.node.data.nodeType) || readString(input.node.data.kind)
  if (nodeType === 'end') {
    return { items: getZflowEndReturnBindingItems(input.node, input.t, input.locale) }
  }

  const promptFilePath = getZflowPromptRunFilePath(input.node)
  if (!promptFilePath) {
    return { items: getZflowInputBindingItemsFromPorts(input.inputPorts, input.t) }
  }

  const reference = resolveZflowPromptRunReference(input.projectId, promptFilePath, input.editorTabs, input.promptFileCache, input.aiProviders)
  const snapshot = getZflowPromptRunVariableSnapshot(reference, input.aiProviders, input.t, input.locale, input.recipeVariableCategories)
  if (snapshot.status === 'ready') {
    if (snapshot.items.length) return { items: snapshot.items }
    const persistedItems = getZflowInputBindingItemsFromPorts(getPersistedZflowPromptRunInputPorts(input.node.data), input.t)
    return persistedItems.length ? { items: persistedItems } : { items: [], status: 'empty' }
  }

  const persistedItems = getZflowInputBindingItemsFromPorts(getPersistedZflowPromptRunInputPorts(input.node.data), input.t)
  if (persistedItems.length) return { items: persistedItems }
  return { items: [], status: snapshot.status }
}

function getZflowInputBindingItemsFromPorts(ports: ZflowNodePort[], t: WorkbenchCopy): ZflowInputBindingItem[] {
  return ports.map((port) => ({
    key: port.id,
    label: port.label || port.id,
    typeLabel: getZflowPortTypeLabel(port.valueType || 'any', t),
    valueType: normalizeZflowPortValueType(port.valueType, 'any'),
    defaultValue: '',
  }))
}

function getZflowEndReturnBindingItems(node: ZflowNode, t: WorkbenchCopy, locale: Locale): ZflowInputBindingItem[] {
  const config = isRecord(node.data.config) ? node.data.config : {}
  const returnValues = normalizeZflowReturnValues(config.returnValues)
  const ports = returnValues.length
    ? returnValues
    : readStringArray(config.returnPaths).map((path) => ({ id: normalizeZflowHandleId(path) || createZflowStartOutputId(path, []), label: path, valueType: 'any' as ZflowPortValueType }))
  return getZflowInputBindingItemsFromPorts(ports, t).map((item) => ({
    ...item,
    label: typeof item.label === 'string' ? item.label : (locale === 'en' ? 'Return value' : '返回值'),
  }))
}

function normalizeZflowReturnValues(value: unknown): ZflowNodePort[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index): ZflowNodePort[] => {
    if (!isRecord(item)) return []
    const id = normalizeZflowHandleId(item.id) || `return-${index + 1}`
    return [{
      id,
      label: typeof item.label === 'string' ? item.label : id,
      valueType: normalizeZflowPortValueType(item.valueType, 'any'),
    }]
  })
}

function getPersistedZflowPromptRunInputPorts(data: ZflowNodeData) {
  const ports = normalizeZflowPortsPreservingEmpty(Array.isArray(data.inputPorts) ? data.inputPorts : data.inputs, [])
  return ports.filter((port) => !isDefaultZflowPromptRunInputPort(port, ports.length))
}

function isDefaultZflowPromptRunInputPort(port: ZflowNodePort, total: number) {
  return total === 1 && port.id === 'in' && normalizeZflowPortValueType(port.valueType, 'any') === 'any'
}

function getZflowPromptRunInputBindingItemsFromDocument(
  document: ZpmtDocument,
  aiProviders: AiProviderSummary[],
  t: WorkbenchCopy,
  locale: Locale,
  recipeVariableCategories: RecipeVariableCategory[],
): ZflowInputBindingItem[] {
  const modelContext = getSelectedAiModelContext(aiProviders, document.config.providerId, document.config.model, document.config.providerFile)
  const promptSurface = resolveAiModelPromptSurface(document.config.outputType, modelContext?.provider.providerType, document.config.model, modelContext?.model)
  return collectZpmtTestVariables(document, t, locale, promptSurface, recipeVariableCategories).map((variable) => ({
    key: variable.key,
    label: variable.label,
    typeLabel: variable.typeLabel,
    valueType: normalizeZflowVariableTypeForBinding(variable.variableType, variable.recipe),
    defaultValue: variable.defaultValue,
    recipe: variable.recipe,
  }))
}

function getZflowPromptRunVariableSnapshot(
  reference: { status: 'ready'; document: ZpmtDocument } | { status: ZflowInputBindingStatusKind },
  aiProviders: AiProviderSummary[],
  t: WorkbenchCopy,
  locale: Locale,
  recipeVariableCategories: RecipeVariableCategory[],
): ZflowPromptRunVariableSnapshot {
  if (reference.status !== 'ready') return { status: reference.status, items: [] }
  const items = getZflowPromptRunInputBindingItemsFromDocument(reference.document, aiProviders, t, locale, recipeVariableCategories)
  return {
    status: 'ready',
    items,
  }
}

function resolveZflowPromptRunReference(
  projectId: string,
  filePath: string,
  editorTabs: EditorFileTab[],
  cache: Record<string, ZflowPromptFileCacheEntry>,
  aiProviders: AiProviderSummary[],
): { status: 'ready'; document: ZpmtDocument } | { status: ZflowInputBindingStatusKind } {
  const content = resolveZflowPromptFileContent(projectId, filePath, editorTabs, cache)
  if (content) {
    const document = parseZpmtContent(content, aiProviders)
    return document ? { status: 'ready', document } : { status: 'error' }
  }
  const cached = cache[createZflowPromptFileCacheKey(projectId, filePath)]
  if (cached?.error) return { status: 'error' }
  return { status: 'loading' }
}

function resolveZflowPromptFileContent(projectId: string, filePath: string, editorTabs: EditorFileTab[], cache: Record<string, ZflowPromptFileCacheEntry>) {
  const tab = editorTabs.find((item) => item.projectId === projectId && item.path === filePath)
  if (tab) return tab.content
  return cache[createZflowPromptFileCacheKey(projectId, filePath)]?.content || ''
}

function createZflowPromptFileCacheKey(projectId: string, filePath: string) {
  return `${projectId}:${filePath}`
}

function getZflowPromptRunFilePath(node: ZflowNode) {
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  if (nodeType !== 'prompt') return ''
  const config = isRecord(node.data.config) ? node.data.config : {}
  return readString(config.filePath)
}

function normalizeZflowVariableTypeForBinding(variableType: VariableType | undefined, recipe?: ZpmtTestVariable['recipe']): ZflowPortValueType {
  if (recipe) return 'string'
  if (variableType === 'string') return 'string'
  if (variableType === 'number') return 'number'
  if (variableType === 'array') return 'array'
  if (variableType === 'color') return 'color'
  if (variableType === 'boolean') return 'boolean'
  if (variableType === 'image') return 'image'
  if (variableType === 'file') return 'file'
  return 'string'
}

function readZflowInputBindings(value: unknown): Record<string, ZflowInputBinding> {
  const config = isRecord(value) ? value : {}
  const bindings = isRecord(config.bindings) ? config.bindings : isRecord(config.inputBindings) ? config.inputBindings : {}
  return Object.fromEntries(
    Object.entries(bindings).flatMap(([key, binding]) => {
      if (!isRecord(binding)) return []
      return [[key, normalizeZflowInputBinding(binding)]]
    }),
  )
}

function readZflowEndInputBindings(value: unknown): Record<string, ZflowInputBinding> {
  const config = isRecord(value) ? value : {}
  const bindings = readZflowInputBindings(config)
  if (Object.keys(bindings).length || Array.isArray(config.returnValues)) return bindings
  return Object.fromEntries(readStringArray(config.returnPaths).map((path) => {
    const key = normalizeZflowHandleId(path) || createZflowStartOutputId(path, [])
    return [key, { mode: 'value', value: `{{${path}}}`, valueType: 'any' as ZflowPortValueType }]
  }))
}

function normalizeZflowInputBinding(binding: ZflowInputBinding | Record<string, unknown>): ZflowInputBinding {
  const source = isRecord(binding) ? binding : {}
  const mode = source.mode === 'source' ? 'source' : 'value'
  const values = Array.isArray(source.values) ? source.values.map(readString).filter(Boolean) : undefined
  return {
    mode,
    value: readString(source.value),
    ...(values?.length ? { values } : {}),
    sourceNodeId: readString(source.sourceNodeId),
    sourceHandle: readString(source.sourceHandle),
    sourceOutputId: readString(source.sourceOutputId) || readString(source.sourceHandle),
    sourcePath: readString(source.sourcePath),
    valueType: normalizeZflowPortValueType(source.valueType, 'string'),
  }
}

function createDefaultZflowInputBinding(item: ZflowInputBindingItem): ZflowInputBinding {
  return {
    mode: 'value',
    value: item.defaultValue,
    values: item.recipe?.multiple ? splitZflowBindingValues(item.defaultValue) : undefined,
    valueType: item.valueType,
  }
}

function readZflowBindingValue(binding: ZflowInputBinding, item: ZflowInputBindingItem) {
  return readString(binding.value) || item.defaultValue
}

function readZflowBindingValues(binding: ZflowInputBinding, item: ZflowInputBindingItem) {
  if (Array.isArray(binding.values) && binding.values.length) return binding.values
  return splitZflowBindingValues(readZflowBindingValue(binding, item))
}

function splitZflowBindingValues(value: unknown) {
  return readString(value).split(',').map((item) => item.trim()).filter(Boolean)
}

function createZflowSourceBinding(option: ZflowUpstreamOutputOption): ZflowInputBinding {
  return {
    mode: 'source',
    sourceNodeId: option.nodeId,
    sourceOutputId: option.outputId,
    sourcePath: option.sourcePath || option.outputId,
    valueType: option.valueType,
  }
}

function getZflowSourceNodeOptions(options: ZflowUpstreamOutputOption[]) {
  const seen = new Set<string>()
  return options.flatMap((option) => {
    if (seen.has(option.nodeId)) return []
    seen.add(option.nodeId)
    return [{ nodeId: option.nodeId, nodeLabel: option.nodeLabel }]
  })
}

function getZflowUpstreamOutputOptions(nodeId: string, nodes: ZflowNode[], edges: ZflowEdge[], promptKindByPath: ZflowPromptKindByPath): ZflowUpstreamOutputOption[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const visited = new Set<string>()
  const queue = edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source)
  const upstreamIds: string[] = []
  while (queue.length) {
    const currentId = queue.shift() || ''
    if (!currentId || visited.has(currentId)) continue
    visited.add(currentId)
    upstreamIds.push(currentId)
    edges.filter((edge) => edge.target === currentId).forEach((edge) => queue.push(edge.source))
  }
  return upstreamIds.flatMap((sourceId): ZflowUpstreamOutputOption[] => {
    const sourceNode = nodeById.get(sourceId)
    if (!sourceNode) return []
    const ports = normalizeZflowNodeOutputData(sourceNode, 'zh', promptKindByPath)
    const isImagePromptOutput = (readString(sourceNode.data.nodeType) || readString(sourceNode.data.kind)) === 'prompt'
      && resolveZflowPromptRunKind(sourceNode, promptKindByPath) === 'image'
    return ports.map((port) => ({
      id: `${sourceNode.id}:${port.id}`,
      nodeId: sourceNode.id,
      outputId: port.id,
      sourcePath: resolveZflowNodeOutputStatePath(sourceNode, port.id),
      nodeLabel: readString(sourceNode.data.label) || sourceNode.id,
      label: port.label || port.id,
      valueType: normalizeZflowPortValueType(port.valueType, 'any'),
      imageCollection: isImagePromptOutput && (port.id === 'image' || port.id === 'images' || normalizeZflowPortValueType(port.valueType, 'any') === 'image'),
    }))
  })
}

function resolveZflowNodeOutputStatePath(node: ZflowNode, outputId: string) {
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  const config = isRecord(node.data.config) ? node.data.config : {}
  const configured = readString(config.outputPath)
  if (configured) return configured
  if (nodeType === 'prompt') return readString(config.promptKind) === 'image' ? 'image' : 'result'
  if (nodeType === 'http') return 'response'
  if (nodeType === 'tool') return 'toolResult'
  if (nodeType === 'array-merge') return 'merged'
  if (nodeType === 'state') return readString(config.name) || 'value'
  return outputId
}

function ZflowNodeTemplateCard({ template, locale }: { template: ZflowNodeTemplate; locale: Locale }) {
  const Icon = template.icon
  const label = localizeZflowText(template.label, locale)

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(ZFLOW_NODE_DRAG_MIME, template.id)
    event.dataTransfer.setData('text/plain', label)
  }

  return (
    <button
      type="button"
      draggable
      className={`zflow-node-template zflow-node-template--${template.category}`}
      onDragStart={handleDragStart}
      aria-label={label}
    >
      <span className="zflow-node-template__icon">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="zflow-node-template__body">
        <span className="zflow-node-template__label">{label}</span>
        <span className="zflow-node-template__description">{localizeZflowText(template.description, locale)}</span>
      </span>
    </button>
  )
}

function ZflowWorkflowNode({ id, data, selected }: NodeProps<ZflowNode>) {
  const category = normalizeZflowNodeCategory(data.category)
  const inputPorts = normalizeZflowNodePortsForDirection(data, 'target')
  const outputPorts = normalizeZflowNodePortsForDirection(data, 'source')
  const Icon = getZflowNodeIcon(readString(data.icon) || getDefaultZflowIconNameForCategory(category))
  const runtime = readString(data.runtime)
  const runStatus = readString(data.runStatus)
  const connections = useNodeConnections()
  const isConnected = connections.length > 0
  const isCondition = readString(data.nodeType) === 'condition' || readString(data.kind) === 'condition'

  return (
    <div className={cn('zflow-node-card', `zflow-node-card--${category}`, isCondition && 'zflow-node-card--condition', isConnected ? 'is-connected' : 'is-disconnected', (selected || runStatus === 'running') && 'is-selected', runStatus && `is-run-${runStatus}`)}>
      {inputPorts.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={isCondition ? Position.Top : Position.Left}
          isConnectableEnd
          className={cn('zflow-node-card__handle zflow-node-card__handle--target', isCondition && 'zflow-node-card__handle--condition-input')}
          style={getZflowPortHandleStyle('target', port.valueType || 'any', index, inputPorts.length, isCondition ? 'top' : undefined)}
        />
      ))}
      <div className="zflow-node-card__header">
        <span className="zflow-node-card__icon">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="zflow-node-card__label">{readString(data.label) || '节点'}</div>
          <div className="zflow-node-card__meta">{getZflowRuntimeLabel(runtime)}</div>
        </div>
      </div>
      <div className="zflow-node-card__body">
        <div className="zflow-node-card__description">{readString(data.description)}</div>
        <div className="zflow-node-card__ports">
          {inputPorts.length ? <span>{getZflowNodeCardPortSummary(inputPorts, 'target')}</span> : <span>start</span>}
          <span>{getZflowNodeCardPortSummary(outputPorts, 'source')}</span>
        </div>
      </div>
      {outputPorts.map((port, index) => (
        isCondition ? (
          <div key={port.id} className={cn('zflow-node-card__branch', `zflow-node-card__branch--${port.id}`)}>
            <span className="zflow-node-card__branch-label">{port.id === 'true' ? 'true' : port.id === 'false' ? 'false' : port.label}</span>
            <Handle
              id={port.id}
              type="source"
              position={port.id === 'false' ? Position.Left : Position.Right}
              isConnectableStart
              className="zflow-node-card__handle zflow-node-card__handle--source zflow-node-card__handle--condition-output"
              style={getZflowPortHandleStyle('source', port.valueType || 'any', index, outputPorts.length, port.id === 'false' ? 'left' : 'right')}
            />
          </div>
        ) : (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={Position.Right}
            isConnectableStart
            className="zflow-node-card__handle zflow-node-card__handle--source"
            style={getZflowPortHandleStyle('source', port.valueType || 'any', index, outputPorts.length)}
          />
        )
      ))}
    </div>
  )
}

function getZflowPortHandleStyle(direction: 'source' | 'target', valueType: ZflowPortValueType, index = 0, total = 1, position?: 'left' | 'right' | 'top') {
  const top = total <= 1 ? '50%' : `${Math.round(((index + 1) / (total + 1)) * 10000) / 100}%`
  const placement: CSSProperties = position === 'top'
    ? { top: 0, left: '50%', right: 'auto', transform: 'translate(-50%, -50%)' }
    : position === 'left'
      ? { top: '50%', left: 0, right: 'auto', transform: 'translate(-50%, -50%)' }
      : position === 'right'
        ? { top: '50%', left: 'auto', right: 0, transform: 'translate(50%, -50%)' }
        : direction === 'target'
          ? { top, left: 0, right: 'auto', transform: 'translate(-50%, -50%)' }
          : { top, left: 'auto', right: 0, transform: 'translate(50%, -50%)' }
  const style: CSSProperties = {
    position: 'absolute',
    ...placement,
    background: getZflowValueTypeColor(valueType),
    borderColor: '#ffffff',
    boxShadow: `0 0 0 2px ${getZflowValueTypeColor(valueType)}22`,
  }
  return style
}

function localizeZflowText(text: LocalizedText, locale: Locale) {
  return locale === 'en' ? text.en : text.zh
}

function isZflowStartNode(node: ZflowNode) {
  return node.id === ZFLOW_START_NODE_ID || readString(node.data.nodeType) === ZFLOW_START_NODE_TYPE || normalizeZflowNodeCategory(node.data.category || node.data.kind) === 'start'
}

function getDefaultZflowStartOutputs(locale: Locale): ZflowNodePort[] {
  return [{ id: 'input', label: locale === 'en' ? 'Input' : '输入', valueType: 'string' }]
}

function isZflowOutputPortsEditable(node: ZflowNode) {
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  return nodeType === 'router'
}

function isZflowOutputDataEditable(node: ZflowNode) {
  if (isZflowStartNode(node)) return true
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  return nodeType === 'state'
}

function isZflowConditionNode(node: ZflowNode | Pick<ZflowNode, 'data'>) {
  return readString(node.data.nodeType) === 'router' || readString(node.data.kind) === 'router'
}

function normalizeZflowConditionMode(value: unknown): ZflowConditionMode {
  return value === 'any' ? 'any' : 'all'
}

function normalizeZflowConditionOperator(value: unknown): ZflowConditionOperator {
  return typeof value === 'string' && ZFLOW_CONDITION_OPERATORS.includes(value as ZflowConditionOperator)
    ? value as ZflowConditionOperator
    : 'eq'
}

function readZflowConditionConfig(value: unknown): ZflowConditionConfig {
  const config = isRecord(value) ? value : {}
  const conditions = Array.isArray(config.conditions) ? config.conditions : []
  return {
    conditionMode: normalizeZflowConditionMode(config.conditionMode),
    conditions: conditions.flatMap((item, index): ZflowConditionRule[] => {
      if (!isRecord(item)) return []
      const id = readString(item.id) || `condition-${index + 1}`
      return [{
        id,
        sourceNodeId: readString(item.sourceNodeId),
        sourceOutputId: readString(item.sourceOutputId) || readString(item.sourceHandle),
        operator: normalizeZflowConditionOperator(item.operator),
        value: readString(item.value),
      }]
    }),
  }
}

function writeZflowConditionConfig(currentConfig: unknown, conditionConfig: ZflowConditionConfig) {
  const config = cloneZflowConfig(isRecord(currentConfig) ? currentConfig : {})
  config.conditionMode = conditionConfig.conditionMode
  config.conditions = conditionConfig.conditions.map((condition) => ({
    id: condition.id,
    sourceNodeId: condition.sourceNodeId,
    sourceOutputId: condition.sourceOutputId,
    operator: condition.operator,
    value: condition.value,
  }))
  delete config.expression
  delete config.defaultPath
  return config
}

function createZflowConditionRule(existing: ZflowConditionRule[], options: ZflowUpstreamOutputOption[]): ZflowConditionRule {
  const firstOption = options[0]
  return {
    id: createZflowConditionRuleId(existing),
    sourceNodeId: firstOption?.nodeId || '',
    sourceOutputId: firstOption?.outputId || '',
    operator: 'eq',
    value: '',
  }
}

function createZflowConditionRuleId(existing: ZflowConditionRule[]) {
  const used = new Set(existing.map((condition) => condition.id))
  let index = existing.length + 1
  let id = `condition-${index}`
  while (used.has(id)) {
    index += 1
    id = `condition-${index}`
  }
  return id
}

function conditionOperatorNeedsValue(operator: ZflowConditionOperator) {
  return operator !== 'empty' && operator !== 'notEmpty'
}

function normalizeZflowStartOutputPorts(value: unknown, locale: Locale): ZflowNodePort[] {
  return normalizeZflowPorts(value, getDefaultZflowStartOutputs(locale)).map((port) => ({
    ...port,
    valueType: normalizeZflowStartOutputType(port.valueType),
  }))
}

function normalizeZflowOutputData(value: unknown, fallback: ZflowNodePort[], locale: Locale): ZflowNodePort[] {
  return normalizeZflowPorts(value, fallback).map((port) => ({
    ...port,
    valueType: normalizeZflowPortValueType(port.valueType, 'string'),
  }))
}

function getDefaultZflowOutputDataForNode(node: ZflowNode, locale: Locale, promptKindByPath?: ZflowPromptKindByPath): ZflowNodePort[] {
  if (isZflowStartNode(node)) return getDefaultZflowStartOutputs(locale)
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  if (nodeType === 'prompt') {
    const valueType = promptKindByPath ? resolveZflowPromptRunOutputType(node, promptKindByPath) : 'text'
    const promptKind = promptKindByPath ? resolveZflowPromptRunKind(node, promptKindByPath) : normalizeZpmtPromptKind(isRecord(node.data.config) ? node.data.config.promptKind : undefined)
    return [{ id: promptKind === 'image' ? 'image' : 'result', label: promptKind === 'image' ? (locale === 'en' ? 'Image' : '图片结果') : (locale === 'en' ? 'Result' : '结果'), valueType }]
  }
  if (nodeType === 'state') {
    const config = isRecord(node.data.config) ? node.data.config : {}
    const label = readString(config.outputPath) || readString(config.name) || (locale === 'en' ? 'Value' : '变量值')
    return [{ id: 'value', label, valueType: 'any' }]
  }
  if (nodeType === 'array-merge') return [{ id: 'merged', label: locale === 'en' ? 'Merged array' : '合并数组', valueType: 'array' }]
  if (nodeType === 'http') return [{ id: 'response', label: locale === 'en' ? 'Response' : '接口响应', valueType: 'object' }]
  return []
}

function normalizeZflowNodeOutputData(node: ZflowNode, locale: Locale, promptKindByPath?: ZflowPromptKindByPath): ZflowNodePort[] {
  const fallback = getDefaultZflowOutputDataForNode(node, locale, promptKindByPath)
  const rawOutputData = Array.isArray(node.data.outputData) ? node.data.outputData : isZflowStartNode(node) ? node.data.outputs : undefined
  if (Array.isArray(rawOutputData)) {
    const outputData = normalizeZflowOutputData(rawOutputData, fallback, locale)
    return isZflowStartNode(node) ? outputData.map((port) => ({ ...port, valueType: normalizeZflowStartOutputType(port.valueType) })) : outputData
  }
  return fallback
}

function normalizeZflowStartOutputType(value: unknown): ZflowPortValueType {
  const normalized = normalizeZflowPortValueType(value, 'string')
  if (normalized === 'text') return 'string'
  return ZFLOW_START_OUTPUT_TYPES.includes(normalized) ? normalized : 'string'
}

function createZflowStartOutputId(label: string, currentOutputs: ZflowNodePort[]) {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
  const baseId = normalizedLabel || 'output'
  let id = baseId
  let index = 2
  const usedIds = new Set(currentOutputs.map((port) => port.id))
  while (usedIds.has(id)) {
    id = `${baseId}-${index}`
    index += 1
  }
  return id
}

function getZflowNodeTemplateById(id: string) {
  return ZFLOW_NODE_TEMPLATES.find((template) => template.id === id) || null
}

function createZflowNodeFromTemplate(template: ZflowNodeTemplate, position: { x: number; y: number }, locale: Locale, currentNodes: ZflowNode[]): ZflowNode {
  const baseId = template.id
  const sameTypeCount = currentNodes.filter((node) => readString(node.data.nodeType) === template.id || node.id.startsWith(baseId)).length
  let suffix = sameTypeCount + 1
  let id = `${baseId}-${suffix}`
  while (currentNodes.some((node) => node.id === id)) {
    suffix += 1
    id = `${baseId}-${suffix}`
  }

  const outputData = getDefaultZflowOutputDataForNode({
    id,
    type: 'zflow',
    position,
    data: {
      label: localizeZflowText(template.label, locale),
      category: template.category,
      nodeType: template.id,
      kind: template.id,
      config: cloneZflowConfig(template.config),
    },
  } as ZflowNode, locale)
  return {
    id,
    type: 'zflow',
    position: {
      x: Math.round((position.x - ZFLOW_NODE_WIDTH / 2) * 100) / 100,
      y: Math.round((position.y - ZFLOW_NODE_HEIGHT / 2) * 100) / 100,
    },
    data: {
      label: localizeZflowText(template.label, locale),
      description: localizeZflowText(template.description, locale),
      category: template.category,
      nodeType: template.id,
      kind: template.id,
      icon: template.iconName,
      runtime: template.runtime,
      inputPorts: localizeZflowTemplatePorts(template.inputs, locale),
      outputPorts: localizeZflowTemplatePorts(template.outputs, locale),
      ...(outputData.length ? { outputData } : {}),
      config: cloneZflowConfig(template.config),
    },
  }
}

function createZflowNodeFromZpmtFile(file: ZpmtFileDragEntry, position: { x: number; y: number }, locale: Locale, currentNodes: ZflowNode[]): ZflowNode {
  const template = getZflowNodeTemplateById('prompt') || ZFLOW_NODE_TEMPLATES[0]
  const filePath = file.path
  const promptKind = normalizeZpmtPromptKind(file.promptKind)
  const fileName = filePath.split('/').pop() || filePath
  const label = fileName.replace(/\.zpmt$/i, '') || localizeZflowText(template.label, locale)
  const node = createZflowNodeFromTemplate(template, position, locale, currentNodes)
  const icon = promptKind === 'image' ? 'wand-sparkles' : promptKind === 'agent' ? 'workflow' : 'message-square'
  return {
    ...node,
    data: {
      ...node.data,
      label,
      description: locale === 'en' ? `Prompt file: ${filePath}` : `提示词文件：${filePath}`,
      icon,
      outputPorts: normalizeZflowNodePortsForDirection(node.data, 'source').map((port) => ({
        ...port,
        valueType: promptKind === 'image' ? 'image' : 'text',
      })),
      outputData: [{ id: promptKind === 'image' ? 'image' : 'result', label: promptKind === 'image' ? (locale === 'en' ? 'Image' : '图片结果') : (locale === 'en' ? 'Result' : '结果'), valueType: promptKind === 'image' ? 'image' : 'text' }],
      config: { filePath, promptKind, outputPath: promptKind === 'image' ? 'image' : 'result', bindings: {} },
    },
  }
}

function cloneZflowNodeForClipboard(node: ZflowNode): ZflowNode {
  return {
    ...node,
    selected: false,
    dragging: false,
    data: cloneZflowNodeData(node.data),
    position: { ...node.position },
  }
}

function cloneZflowNodeForPaste(node: ZflowNode, id: string, offset: number): ZflowNode {
  return {
    ...cloneZflowNodeForClipboard(node),
    id,
    selected: true,
    position: {
      x: Math.round((node.position.x + offset) * 100) / 100,
      y: Math.round((node.position.y + offset) * 100) / 100,
    },
  }
}

function cloneZflowNodeData(data: ZflowNodeData): ZflowNodeData {
  return {
    ...data,
    inputPorts: normalizeZflowPorts(data.inputPorts || data.inputs, []).map((port) => ({ ...port })),
    outputPorts: normalizeZflowPorts(data.outputPorts || data.outputs, []).map((port) => ({ ...port })),
    outputData: normalizeZflowPorts(data.outputData, []).map((port) => ({ ...port })),
    config: cloneZflowConfig(isRecord(data.config) ? data.config : {}),
  }
}

function cloneZflowEdgeForClipboard(edge: ZflowEdge): ZflowEdge {
  const data = isRecord(edge.data) ? stripDerivedZflowEdgeData(edge.data) : {}
  return {
    ...edge,
    selected: false,
    data: Object.keys(data).length ? cloneZflowConfig(data) : undefined,
  }
}

function createUniqueZflowNodeId(baseId: string, nodes: ZflowNode[]) {
  const normalizedBase = normalizeZflowHandleId(baseId) || 'node'
  const usedIds = new Set(nodes.map((node) => node.id))
  let index = 2
  let id = `${normalizedBase}-copy`
  while (usedIds.has(id)) {
    id = `${normalizedBase}-copy-${index}`
    index += 1
  }
  return id
}

function isZflowClipboardShortcutEvent(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false
  const key = event.key.toLowerCase()
  return key === 'c' || key === 'v' || key === 'x'
}

function isEditableZflowShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

type ZflowConnectionLike = {
  source?: string | null
  target?: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
}
type ZflowResolvedConnection = {
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

function createZflowEdgeFromConnection(
  connection: Connection,
  nodes: ZflowNode[],
  edges: ZflowEdge[],
  promptKindByPath: ZflowPromptKindByPath,
): ZflowEdge | null {
  const validation = getZflowConnectionValidation(connection, nodes, promptKindByPath)
  if (!validation.valid || !validation.resolvedConnection) return null
  const edge: ZflowEdge = {
    id: createZflowEdgeId(validation.resolvedConnection, edges),
    source: validation.resolvedConnection.source,
    target: validation.resolvedConnection.target,
    sourceHandle: validation.resolvedConnection.sourceHandle,
    targetHandle: validation.resolvedConnection.targetHandle,
    type: 'smoothstep',
  }
  const label = resolveZflowConnectionLabel(validation.resolvedConnection, nodes)
  return label ? { ...edge, label } : edge
}

function canCreateZflowConnection(
  connection: ZflowConnectionLike,
  nodes: ZflowNode[],
  edges: ZflowEdge[],
  promptKindByPath: ZflowPromptKindByPath,
) {
  const validation = getZflowConnectionValidation(connection, nodes, promptKindByPath)
  return Boolean(validation.valid && validation.resolvedConnection && isZflowResolvedConnectionAvailable(validation.resolvedConnection, edges))
}

function getZflowConnectionValidation(
  connection: ZflowConnectionLike,
  nodes: ZflowNode[],
  promptKindByPath: ZflowPromptKindByPath,
): {
  valid: boolean
  resolvedConnection: ZflowResolvedConnection | null
  sourceType: ZflowPortValueType
  targetType: ZflowPortValueType
  invalidReason: string
} {
  const resolvedConnection = resolveZflowConnectionHandles(connection, nodes)
  if (!resolvedConnection) {
    return {
      valid: false,
      resolvedConnection: null,
      sourceType: 'any',
      targetType: 'any',
      invalidReason: 'unresolved',
    }
  }
  const sourceNode = nodes.find((node) => node.id === resolvedConnection.source)
  const targetNode = nodes.find((node) => node.id === resolvedConnection.target)
  if (!sourceNode || !targetNode) {
    return {
      valid: false,
      resolvedConnection,
      sourceType: 'any',
      targetType: 'any',
      invalidReason: 'missing-node',
    }
  }
  const sourceType = resolveZflowNodePortValueType(sourceNode, 'source', resolvedConnection.sourceHandle, promptKindByPath)
  const targetType = resolveZflowNodePortValueType(targetNode, 'target', resolvedConnection.targetHandle, promptKindByPath)
  const valid = isZflowPortTypeCompatible(sourceType, targetType)
  return {
    valid,
    resolvedConnection,
    sourceType,
    targetType,
    invalidReason: valid ? '' : 'type-mismatch',
  }
}

function isZflowResolvedConnectionAvailable(connection: ZflowResolvedConnection, edges: ZflowEdge[]) {
  return !edges.some((edge) => {
    if (edge.hidden) return false
    return (
      edge.source === connection.source &&
      normalizeZflowHandleId(edge.sourceHandle) === connection.sourceHandle &&
      edge.target === connection.target &&
      normalizeZflowHandleId(edge.targetHandle) === connection.targetHandle
    )
  })
}

function resolveZflowConnectionHandles(connection: ZflowConnectionLike, nodes: ZflowNode[]): ZflowResolvedConnection | null {
  const source = readString(connection.source)
  const target = readString(connection.target)
  if (!source || !target || source === target) return null
  const sourceNode = nodes.find((node) => node.id === source)
  const targetNode = nodes.find((node) => node.id === target)
  if (!sourceNode || !targetNode) return null
  const sourceHandle = resolveZflowNodePortHandle(sourceNode, 'source', connection.sourceHandle)
  const targetHandle = resolveZflowNodePortHandle(targetNode, 'target', connection.targetHandle)
  if (!sourceHandle || !targetHandle) return null
  return { source, target, sourceHandle, targetHandle }
}

function resolveZflowNodePortHandle(node: ZflowNode, direction: 'source' | 'target', preferredHandle: unknown) {
  const normalizedPreferred = normalizeZflowHandleId(preferredHandle)
  const ports = normalizeZflowNodePortsForDirection(node.data, direction)
  if (!ports.length) return undefined
  if (normalizedPreferred && ports.some((port) => port.id === normalizedPreferred)) return normalizedPreferred
  return ports[0]?.id
}

function createZflowEdgeId(connection: ZflowResolvedConnection, edges: ZflowEdge[]) {
  const baseId = `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`
  let id = baseId
  let index = 2
  while (edges.some((edge) => edge.id === id)) {
    id = `${baseId}-${index}`
    index += 1
  }
  return id
}

function resolveZflowConnectionLabel(connection: ZflowResolvedConnection, nodes: ZflowNode[]) {
  const sourceNode = nodes.find((node) => node.id === connection.source)
  const outputs = sourceNode ? normalizeZflowNodePortsForDirection(sourceNode.data, 'source') : []
  const output = outputs.find((port) => port.id === connection.sourceHandle)
  const label = output?.label.trim()
  if (!label || label === '输出' || label.toLowerCase() === 'output') return ''
  return label
}

function localizeZflowTemplatePorts(ports: ZflowNodeTemplatePort[], locale: Locale): ZflowNodePort[] {
  return ports.map((port) => ({
    id: port.id,
    label: localizeZflowText(port.label, locale),
    valueType: normalizeZflowPortValueType(port.valueType, 'any'),
  }))
}

function normalizeZflowHandleId(value: unknown) {
  const id = readString(value)
  if (!id) return undefined
  const normalized = id.toLowerCase()
  if (normalized === 'null' || normalized === 'undefined') return undefined
  return id
}

function normalizeZflowPortValueType(value: unknown, fallback: ZflowPortValueType = 'any'): ZflowPortValueType {
  if (
    value === 'any' ||
    value === 'string' ||
    value === 'number' ||
    value === 'text' ||
    value === 'object' ||
    value === 'array' ||
    value === 'color' ||
    value === 'boolean' ||
    value === 'image' ||
    value === 'file' ||
    value === 'error'
  ) return value
  return fallback
}

function normalizeZflowPorts(value: unknown, fallback: ZflowNodePort[]): ZflowNodePort[] {
  if (!Array.isArray(value)) return fallback
  const ports = value
    .map((item, index) => {
      if (!isRecord(item)) return null
      const id = normalizeZflowHandleId(item.id) || `port-${index + 1}`
      const fallbackPort = fallback[index]
      return {
        id,
        label: readString(item.label) || fallbackPort?.label || id,
        valueType: normalizeZflowPortValueType(item.valueType, fallbackPort?.valueType || 'any'),
      }
    })
    .filter(Boolean) as ZflowNodePort[]
  return ports.length ? ports : fallback
}

function normalizeZflowPortsPreservingEmpty(value: unknown, fallback: ZflowNodePort[]): ZflowNodePort[] {
  if (Array.isArray(value) && value.length === 0) return []
  return normalizeZflowPorts(value, fallback)
}

function normalizeZflowNodePortsForDirection(data: ZflowNodeData, direction: 'source' | 'target'): ZflowNodePort[] {
  const category = normalizeZflowNodeCategory(data.category || data.kind)
  const nodeType = readString(data.nodeType) || readString(data.kind)
  if (direction === 'target' && nodeType === 'prompt') return [{ id: 'in', label: '输入', valueType: 'any' }]
  if (direction === 'source' && (readString(data.nodeType) === 'router' || readString(data.kind) === 'router')) return ZFLOW_CONDITION_OUTPUT_PORTS
  const fallback = direction === 'source'
    ? category === 'start'
      ? [ZFLOW_START_FLOW_PORT]
      : [{ id: 'out', label: '输出', valueType: 'any' as ZflowPortValueType }]
    : category === 'start'
      ? []
      : [{ id: 'in', label: '输入', valueType: 'any' as ZflowPortValueType }]
  const rawPorts = direction === 'source'
    ? Array.isArray(data.outputPorts) ? data.outputPorts : category === 'start' ? undefined : data.outputs
    : Array.isArray(data.inputPorts) ? data.inputPorts : data.inputs
  if (category === 'start' && direction === 'source') return fallback
  return normalizeZflowPortsPreservingEmpty(rawPorts, fallback)
}

function resolveZflowNodePortValueType(
  node: ZflowNode,
  direction: 'source' | 'target',
  handleId: unknown,
  promptKindByPath: ZflowPromptKindByPath,
): ZflowPortValueType {
  const preferredHandle = normalizeZflowHandleId(handleId)
  const ports = normalizeZflowNodePortsForDirection(node.data, direction)
  const port = (preferredHandle ? ports.find((item) => item.id === preferredHandle) : undefined) || ports[0]
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  if (direction === 'source' && nodeType === 'prompt') {
    return resolveZflowPromptRunOutputType(node, promptKindByPath)
  }
  return normalizeZflowPortValueType(port?.valueType, 'any')
}

function resolveZflowPromptRunOutputType(node: ZflowNode, promptKindByPath: ZflowPromptKindByPath): ZflowPortValueType {
  const promptKind = resolveZflowPromptRunKind(node, promptKindByPath)
  return promptKind === 'image' ? 'image' : 'text'
}

function resolveZflowPromptRunKind(node: ZflowNode, promptKindByPath: ZflowPromptKindByPath): ZpmtPromptKind {
  const config = isRecord(node.data.config) ? node.data.config : {}
  const filePath = readString(config.filePath)
  return (filePath ? promptKindByPath[filePath] : undefined) || normalizeZpmtPromptKind(config.promptKind)
}

function isZflowPortTypeCompatible(sourceType: ZflowPortValueType, targetType: ZflowPortValueType) {
  if (sourceType === 'string' && targetType === 'text') return true
  if (sourceType === 'text' && targetType === 'string') return true
  return sourceType === 'any' || targetType === 'any' || sourceType === targetType
}

function isZflowUpstreamOutputCompatible(option: ZflowUpstreamOutputOption, targetType: ZflowPortValueType) {
  if (targetType === 'image' && option.imageCollection) return true
  return isZflowPortTypeCompatible(option.valueType, targetType)
}

function getZflowValueTypeColor(valueType: ZflowPortValueType) {
  if (valueType === 'string' || valueType === 'text') return '#2563eb'
  if (valueType === 'number') return '#7c3aed'
  if (valueType === 'object') return '#0f766e'
  if (valueType === 'array') return '#d97706'
  if (valueType === 'color') return '#db2777'
  if (valueType === 'boolean') return '#059669'
  if (valueType === 'image') return '#e11d48'
  if (valueType === 'file') return '#475569'
  if (valueType === 'error') return '#dc2626'
  return '#475569'
}

function getZflowPortBadgeStyle(valueType: ZflowPortValueType) {
  const color = getZflowValueTypeColor(valueType)
  return {
    borderColor: `${color}33`,
    background: `${color}14`,
    color,
  }
}

function getZflowPortTypeLabel(valueType: ZflowPortValueType, t: WorkbenchCopy) {
  return t.zflowTypeLabels[valueType]
}

function getZflowPortCountSummary(ports: ZflowNodePort[], t: WorkbenchCopy, direction: 'source' | 'target') {
  if (!ports.length) return direction === 'target' ? 'start' : '0 out'
  const directionLabel = direction === 'target' ? 'in' : 'out'
  if (ports.length === 1) return `${ports.length} ${directionLabel} · ${getZflowPortTypeLabel(ports[0]?.valueType || 'any', t)}`
  return `${ports.length} ${directionLabel}`
}

function getZflowNodeCardPortSummary(ports: ZflowNodePort[], direction: 'source' | 'target') {
  if (!ports.length) return direction === 'target' ? 'start' : '0 out'
  const directionLabel = direction === 'target' ? 'in' : 'out'
  const typeLabel = ports[0]?.valueType || 'any'
  if (ports.length === 1) return `${directionLabel} · ${typeLabel}`
  return `${ports.length} ${directionLabel}`
}

function areZflowPortsEqual(left: ZflowNodePort[], right: ZflowNodePort[]) {
  if (left.length !== right.length) return false
  return left.every((port, index) => {
    const candidate = right[index]
    return (
      candidate?.id === port.id &&
      candidate?.label === port.label &&
      normalizeZflowPortValueType(candidate?.valueType, 'any') === normalizeZflowPortValueType(port.valueType, 'any')
    )
  })
}

function decorateZflowNode(node: ZflowNode, promptKindByPath: ZflowPromptKindByPath): ZflowNode {
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  if (nodeType !== 'prompt') {
    return node
  }
  const promptKind = resolveZflowPromptRunKind(node, promptKindByPath)
  const resolvedType = promptKind === 'image' ? 'image' : 'text'
  const nextIcon = promptKind === 'image' ? 'wand-sparkles' : promptKind === 'agent' ? 'workflow' : 'message-square'
  const nextOutputPorts: ZflowNodePort[] = normalizeZflowNodePortsForDirection(node.data, 'source').map((port) => ({ ...port, valueType: resolvedType }))
  const nextOutputData: ZflowNodePort[] = [{ id: promptKind === 'image' ? 'image' : 'result', label: promptKind === 'image' ? '图片结果' : '结果', valueType: resolvedType }]
  const currentConfig = isRecord(node.data.config) ? node.data.config : {}
  const nextOutputPath = promptKind === 'image' ? 'image' : readString(currentConfig.outputPath) || 'result'
  if (
    readString(node.data.icon) === nextIcon &&
    currentConfig.promptKind === promptKind &&
    readString(currentConfig.outputPath) === nextOutputPath &&
    areZflowPortsEqual(normalizeZflowPorts(node.data.outputPorts || node.data.outputs, []), nextOutputPorts) &&
    areZflowPortsEqual(normalizeZflowPorts(node.data.outputData, []), nextOutputData)
  ) {
    return node
  }
  return {
    ...node,
    data: {
      ...node.data,
      icon: nextIcon,
      outputPorts: nextOutputPorts,
      outputData: nextOutputData,
      config: {
        ...currentConfig,
        promptKind,
        outputPath: nextOutputPath,
      },
    },
  }
}

function decorateZflowNodeWithRunStatus(node: ZflowNode, runStatus?: ZflowRunNodeStatus): ZflowNode {
  const currentStatus = readString(node.data.runStatus)
  if (!runStatus && !currentStatus) return node
  if (currentStatus === runStatus) return node
  return {
    ...node,
    data: {
      ...node.data,
      ...(runStatus ? { runStatus } : { runStatus: '' }),
    },
  }
}

function getZflowRunNodeStatuses(events: Array<Record<string, unknown>>): Record<string, ZflowRunNodeStatus> {
  const statuses: Record<string, ZflowRunNodeStatus> = {}
  for (const event of events) {
    const nodeId = readString(event.nodeId)
    if (!nodeId) continue
    const type = readString(event.type)
    if (type === 'node:start') statuses[nodeId] = 'running'
    if (type === 'node:end') statuses[nodeId] = 'success'
    if (type === 'node:error') statuses[nodeId] = 'error'
  }
  return statuses
}

function decorateZflowEdge(edge: ZflowEdge, nodes: ZflowNode[], promptKindByPath: ZflowPromptKindByPath): ZflowEdge {
  const validation = getZflowConnectionValidation(edge, nodes, promptKindByPath)
  const strokeType = validation.valid ? validation.sourceType : 'error'
  const stroke = getZflowValueTypeColor(strokeType)
  const strokeWidth = edge.selected ? 2.8 : 2.25
  const strokeDasharray = validation.valid ? undefined : '7 5'
  const currentMarkerEnd: Record<string, unknown> = isRecord(edge.markerEnd) ? edge.markerEnd : {}
  const currentStyle: Record<string, unknown> = isRecord(edge.style) ? edge.style : {}
  const currentData: Record<string, unknown> = isRecord(edge.data) ? edge.data : {}
  if (
    currentMarkerEnd.type === MarkerType.ArrowClosed &&
    currentMarkerEnd.color === stroke &&
    currentStyle.stroke === stroke &&
    currentStyle.strokeWidth === strokeWidth &&
    currentStyle.strokeDasharray === strokeDasharray &&
    currentData.invalid === !validation.valid &&
    readString(currentData.invalidReason) === validation.invalidReason &&
    normalizeZflowPortValueType(currentData.sourceType, 'any') === validation.sourceType &&
    normalizeZflowPortValueType(currentData.targetType, 'any') === validation.targetType
  ) {
    return edge
  }
  return {
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
    style: {
      ...edge.style,
      stroke,
      strokeWidth,
      strokeDasharray,
    },
    data: {
      ...edge.data,
      invalid: !validation.valid,
      invalidReason: validation.invalidReason,
      sourceType: validation.sourceType,
      targetType: validation.targetType,
    },
  }
}

function stripDerivedZflowEdgeData(data: Record<string, unknown>) {
  const { invalid: _invalid, invalidReason: _invalidReason, sourceType: _sourceType, targetType: _targetType, ...rest } = data
  return rest
}

function areZflowAlignmentGuidesEqual(left: ZflowAlignmentGuide[], right: ZflowAlignmentGuide[]) {
  if (left.length !== right.length) return false
  return left.every((guide, index) => {
    const candidate = right[index]
    return (
      candidate?.id === guide.id &&
      candidate?.axis === guide.axis &&
      candidate?.position === guide.position &&
      candidate?.start === guide.start &&
      candidate?.end === guide.end
    )
  })
}

function getZflowNodeSize(node: ZflowNode) {
  return {
    width: readPositiveFiniteNumber(node.width, readPositiveFiniteNumber(node.initialWidth, ZFLOW_NODE_WIDTH)),
    height: readPositiveFiniteNumber(node.height, readPositiveFiniteNumber(node.initialHeight, ZFLOW_NODE_HEIGHT)),
  }
}

function getZflowNodeRect(node: ZflowNode) {
  const size = getZflowNodeSize(node)
  return {
    x: node.position.x,
    y: node.position.y,
    width: size.width,
    height: size.height,
  }
}

function getZflowNodesBounds(nodes: ZflowNode[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0 }
  const rects = nodes.map(getZflowNodeRect)
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function layoutZflowNodes(nodes: ZflowNode[], edges: ZflowEdge[], targetNodeIds?: string[]) {
  const visibleNodes = nodes.filter((node) => !node.hidden)
  const selectedSet = targetNodeIds?.length ? new Set(targetNodeIds) : null
  const nodesToLayout = selectedSet ? visibleNodes.filter((node) => selectedSet.has(node.id)) : visibleNodes
  if (!nodesToLayout.length) return nodes

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    align: 'UL',
    marginx: 24,
    marginy: 24,
    nodesep: 56,
    ranksep: 92,
  })

  nodesToLayout.forEach((node) => {
    const size = getZflowNodeSize(node)
    graph.setNode(node.id, { width: size.width, height: size.height })
  })

  edges
    .filter((edge) => !selectedSet || (selectedSet.has(edge.source) && selectedSet.has(edge.target)))
    .forEach((edge) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return
      graph.setEdge(edge.source, edge.target)
    })

  dagre.layout(graph)

  const currentBounds = getZflowNodesBounds(nodesToLayout)
  const positioned = new Map<string, { x: number; y: number }>()
  nodesToLayout.forEach((node) => {
    const laidOutNode = graph.node(node.id) as { x: number; y: number } | undefined
    if (!laidOutNode) return
    const size = getZflowNodeSize(node)
    positioned.set(node.id, {
      x: laidOutNode.x - size.width / 2,
      y: laidOutNode.y - size.height / 2,
    })
  })

  const nextBounds = getZflowNodesBounds(
    nodesToLayout.map((node) => ({
      ...node,
      position: positioned.get(node.id) || node.position,
    })),
  )
  const offsetX = selectedSet ? currentBounds.x - nextBounds.x : 0
  const offsetY = selectedSet ? currentBounds.y - nextBounds.y : 0

  return nodes.map((node) => {
    const nextPosition = positioned.get(node.id)
    if (!nextPosition) return node
    return {
      ...node,
      position: {
        x: Math.round((nextPosition.x + offsetX) * 100) / 100,
        y: Math.round((nextPosition.y + offsetY) * 100) / 100,
      },
    }
  })
}

function getZflowNodeAlignmentResult(node: ZflowNode, nodes: ZflowNode[], zoom: number) {
  const current = getZflowNodeRect(node)
  const threshold = ZFLOW_ALIGNMENT_THRESHOLD_PX / Math.max(zoom, 0.25)
  let bestVertical: { delta: number; position: number; start: number; end: number } | null = null
  let bestHorizontal: { delta: number; position: number; start: number; end: number } | null = null

  for (const candidateNode of nodes) {
    if (candidateNode.id === node.id || candidateNode.hidden) continue
    const candidate = getZflowNodeRect(candidateNode)
    const verticalPairs = [
      { current: current.x, candidate: candidate.x },
      { current: current.x + current.width / 2, candidate: candidate.x + candidate.width / 2 },
      { current: current.x + current.width, candidate: candidate.x + candidate.width },
    ]
    const horizontalPairs = [
      { current: current.y, candidate: candidate.y },
      { current: current.y + current.height / 2, candidate: candidate.y + candidate.height / 2 },
      { current: current.y + current.height, candidate: candidate.y + candidate.height },
    ]

    for (const pair of verticalPairs) {
      const delta = pair.candidate - pair.current
      if (Math.abs(delta) > threshold) continue
      if (!bestVertical || Math.abs(delta) < Math.abs(bestVertical.delta)) {
        bestVertical = {
          delta,
          position: pair.candidate,
          start: Math.min(current.y, candidate.y),
          end: Math.max(current.y + current.height, candidate.y + candidate.height),
        }
      }
    }

    for (const pair of horizontalPairs) {
      const delta = pair.candidate - pair.current
      if (Math.abs(delta) > threshold) continue
      if (!bestHorizontal || Math.abs(delta) < Math.abs(bestHorizontal.delta)) {
        bestHorizontal = {
          delta,
          position: pair.candidate,
          start: Math.min(current.x, candidate.x),
          end: Math.max(current.x + current.width, candidate.x + candidate.width),
        }
      }
    }
  }

  const nextPosition = {
    x: Math.round((node.position.x + (bestVertical?.delta || 0)) * 100) / 100,
    y: Math.round((node.position.y + (bestHorizontal?.delta || 0)) * 100) / 100,
  }
  const guides: ZflowAlignmentGuide[] = []
  if (bestVertical) {
    guides.push({
      id: `${node.id}:x`,
      axis: 'x',
      position: bestVertical.position,
      start: bestVertical.start,
      end: bestVertical.end,
    })
  }
  if (bestHorizontal) {
    guides.push({
      id: `${node.id}:y`,
      axis: 'y',
      position: bestHorizontal.position,
      start: bestHorizontal.start,
      end: bestHorizontal.end,
    })
  }

  return {
    changed: Math.abs(nextPosition.x - node.position.x) > 0.01 || Math.abs(nextPosition.y - node.position.y) > 0.01,
    position: nextPosition,
    guides,
  }
}

function cloneZflowConfig(value: Record<string, unknown> = {}) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function getZflowNodeIcon(iconName: string) {
  return ZFLOW_NODE_ICON_MAP[iconName] || Workflow
}

function getDefaultZflowIconNameForCategory(category: ZflowNodeCategoryId) {
  if (category === 'start') return 'play'
  if (category === 'control') return 'route'
  if (category === 'integration') return 'webhook'
  return 'workflow'
}

function getZflowRuntimeLabel(runtime: string) {
  if (runtime === 'start' || runtime === 'trigger') return 'start'
  if (runtime === 'notify') return 'notify'
  if (runtime === 'transform') return 'data'
  if (runtime === 'terminal') return 'terminal'
  return 'flow'
}

function getZflowMiniMapNodeColor(node: ZflowNode) {
  const category = normalizeZflowNodeCategory(node.data.category || node.data.kind)
  if (category === 'start') return '#2563eb'
  if (category === 'control') return '#f97316'
  if (category === 'integration') return '#0f766e'
  return '#64748b'
}

function normalizeZflowNodeCategory(value: unknown): ZflowNodeCategoryId {
  if (value === 'control' || value === 'integration' || value === 'start') return value
  if (value === 'data' || value === 'notification') return 'integration'
  if (value === 'trigger') return 'start'
  const kind = readString(value)
  const templateId = ZFLOW_LEGACY_KIND_TEMPLATE_IDS[kind] || kind
  if (templateId === ZFLOW_START_NODE_TYPE) return 'start'
  const template = getZflowNodeTemplateById(templateId)
  return template?.category || 'integration'
}

function normalizeZflowRuntime(value: unknown, fallback: ZflowNodeRuntime): ZflowNodeRuntime {
  if (value === 'branch' || value === 'transform' || value === 'notify' || value === 'start' || value === 'terminal') return value
  if (value === 'trigger') return 'start'
  return fallback
}

function isPersistableZflowNodeChange(change: NodeChange<ZflowNode>) {
  return change.type !== 'dimensions' && change.type !== 'select'
}

function isPersistableZflowEdgeChange(change: EdgeChange<ZflowEdge>) {
  return change.type !== 'select'
}

function areZflowViewportsEqual(left: Viewport, right: Viewport) {
  return (
    Math.abs(left.x - right.x) < 0.01 &&
    Math.abs(left.y - right.y) < 0.01 &&
    Math.abs(left.zoom - right.zoom) < 0.001
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
            document.models.map((model, index) => {
              const presetKey = getAiModelPresetOptionKeyForModel(document.providerType, model)
              return (
                <div key={`${model.id}-${index}`} className="rounded-md border border-slate-200 bg-white p-2">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{t.modelId}</div>
                      <div className="mt-1 truncate font-mono text-xs font-black text-slate-900">{model.id}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ZamfModelTags t={t} model={model} />
                      </div>
                    </div>
                    <label className="grid min-w-0 gap-1 text-[10px] font-black text-slate-500">
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span>{t.modelPreset}</span>
                        {presetKey ? <Badge variant="outline">{t.modelPresetMatched}</Badge> : null}
                      </span>
                      <select
                        className="h-8 w-full max-w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                        value={presetKey}
                        onChange={(event) => applyModelPreset(index, event.target.value)}
                      >
                        <option value="" disabled>{t.modelPresetPlaceholder}</option>
                        {listAiModelPresetOptions(document.providerType).map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.providerName} / {option.model.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )
            })
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
  const showSystemPrompt = document.kind === 'agent'
  const isImagePrompt = document.kind === 'image'
  const selectedModelContext = getSelectedAiModelContext(aiProviders, document.config.providerId, document.config.model, document.config.providerFile)
  const responseSchema = resolveAiModelParameterSchema(
    document.config.outputType,
    selectedModelContext?.provider?.providerType,
    document.config.model,
    selectedModelContext?.model,
  )
  const promptSurface = resolveAiModelPromptSurface(
    document.config.outputType,
    selectedModelContext?.provider?.providerType,
    document.config.model,
    selectedModelContext?.model,
  )
  const selectedProviderRef = document.config.providerFile || document.config.providerId
  const selectedProvider = findAiProvider(aiProviders, selectedProviderRef, document.config.providerFile)
  const projectProviders = aiProviders.filter((provider) => !isCommonAiProvider(provider))
  const commonProviders = aiProviders.filter(isCommonAiProvider)
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
  const existingTagNames = useMemo(
    () => extractZpmtTagNames(document.system, document.user, document.prompt, document.negativePrompt, getZpmtStyleText(document.style)),
    [document.system, document.user, document.prompt, document.negativePrompt, document.style],
  )

  function applyProviderFile(provider: AiProviderSummary) {
    const model = findCompatibleModelForProvider(provider, document.config.outputType)
    const nextPromptSurface = resolveAiModelPromptSurface(document.config.outputType, provider.providerType, model?.id, model)
    updateDocument({
      config: {
        providerFile: provider.filePath || '',
        providerId: provider.id,
        providerName: provider.name,
        model: model?.id || '',
        responseConfig: defaultResponseConfig(document.config.outputType, provider.providerType, model?.id, model),
      },
      style: document.kind === 'image' ? normalizeZpmtImageStyle(document.style, nextPromptSurface) : document.style,
    })
  }

  function insertPromptToken(sectionKey: ZpmtPromptSectionKey, offset: number, token: string) {
    if (sectionKey === 'system') {
      updateDocument({ system: insertTextAtOffset(document.system, offset, token) })
      return
    }
    if (sectionKey === 'prompt') {
      updateDocument({ prompt: insertTextAtOffset(document.prompt, offset, token) })
      return
    }
    if (sectionKey === 'negativePrompt') {
      updateDocument({ negativePrompt: insertTextAtOffset(document.negativePrompt, offset, token) })
      return
    }
    if (sectionKey === 'style') {
      updateDocument({ style: updateZpmtStyleEditableText(document.style, insertTextAtOffset(getZpmtStyleEditableText(document.style), offset, token)) })
      return
    }

    updateDocument({ user: insertTextAtOffset(document.user, offset, token) })
  }

  function replacePromptToken(sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) {
    const currentValue =
      sectionKey === 'system'
        ? document.system
        : sectionKey === 'prompt'
          ? document.prompt
          : sectionKey === 'negativePrompt'
            ? document.negativePrompt
            : sectionKey === 'style'
              ? getZpmtStyleEditableText(document.style)
              : document.user
    const nextValue = replaceTextRange(currentValue, start, end, token)
    if (sectionKey === 'system') {
      updateDocument({ system: nextValue })
      return
    }
    if (sectionKey === 'prompt') {
      updateDocument({ prompt: nextValue })
      return
    }
    if (sectionKey === 'negativePrompt') {
      updateDocument({ negativePrompt: nextValue })
      return
    }
    if (sectionKey === 'style') {
      updateDocument({ style: updateZpmtStyleEditableText(document.style, nextValue) })
      return
    }
    updateDocument({ user: nextValue })
  }

  function handleInstructionDrop(payload: InstructionDragPayload, sectionKey: ZpmtPromptSectionKey, offset: number) {
    if (!canDropInstructionInPromptSection(payload, document.kind, sectionKey, modelCapabilities)) return
    if (payload.kind === 'constant') {
      insertPromptToken(sectionKey, offset, createConstantToken(payload.item, locale))
      return
    }
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
            <select
              className="zpmt-config-control"
              value={selectedProviderRef}
              disabled={!aiProviders.length && !selectedProviderRef}
              onChange={(event) => {
                const provider = findAiProvider(aiProviders, event.target.value)
                if (provider) applyProviderFile(provider)
              }}
            >
              {!selectedProviderRef ? <option value="">{aiProviders.length ? t.aiProvider : t.noAiProvider}</option> : null}
              {selectedProviderRef && !selectedProvider ? <option value={selectedProviderRef}>{document.config.providerName || t.providerUnavailable}</option> : null}
              {projectProviders.length ? (
                <optgroup label={t.projectProviderGroup}>
                  {projectProviders.map((provider) => (
                    <option key={getAiProviderRef(provider)} value={getAiProviderRef(provider)}>
                      {provider.filePath || provider.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {commonProviders.length ? (
                <optgroup label={t.commonProviderGroup}>
                  {commonProviders.map((provider) => (
                    <option key={getAiProviderRef(provider)} value={getAiProviderRef(provider)}>
                      {provider.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
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
                  style: document.kind === 'image'
                    ? normalizeZpmtImageStyle(document.style, resolveAiModelPromptSurface(document.config.outputType, provider?.providerType, model?.id || event.target.value, model))
                    : document.style,
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

      {isImagePrompt ? (
        <ZpmtImagePromptEditor
          t={t}
          locale={locale}
          document={document}
          promptSurface={promptSurface}
          collapsedSections={collapsedSections}
          recipeVariableCategories={recipeVariableCategories}
          modelCapabilities={modelCapabilities}
          onToggleSection={onToggleSection}
          onInstructionDrop={handleInstructionDrop}
          onTokenEdit={handleTokenEdit}
          onChange={updateDocument}
        />
      ) : (
        <>
          {showSystemPrompt ? (
            <ZpmtPromptSection
              t={t}
              locale={locale}
              recipeVariableCategories={recipeVariableCategories}
              metadata={document.metadata}
              promptKind={document.kind}
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
            promptKind={document.kind}
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
          {document.kind === 'agent' ? <ZpmtToolsDock t={t} locale={locale} tools={document.tools} supportsTools={supportsTools} onEdit={editTool} onRemove={removeTool} /> : null}
        </>
      )}
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

function ZpmtImagePromptEditor({
  t,
  locale,
  document,
  promptSurface,
  collapsedSections,
  recipeVariableCategories,
  modelCapabilities,
  onToggleSection,
  onInstructionDrop,
  onTokenEdit,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  document: ZpmtDocument
  promptSurface: AiModelPromptSurface
  collapsedSections: ZpmtCollapsedSections
  recipeVariableCategories: RecipeVariableCategory[]
  modelCapabilities: ZpmtModelCapabilityGate
  onToggleSection: (section: ZpmtSectionKey) => void
  onInstructionDrop: (payload: InstructionDragPayload, sectionKey: ZpmtPromptSectionKey, offset: number) => void
  onTokenEdit: (sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) => void
  onChange: (document: Partial<Omit<ZpmtDocument, 'config'>> & { config?: Partial<ZpmtDocument['config']> }) => void
}) {
  const imageSurface = promptSurface.kind === 'image-prompt' ? promptSurface : null
  const styleInput = imageSurface?.styleInput || { type: 'free-text' as ImageStyleInputType }
  const negativePromptSupported = imageSurface?.negativePrompt === true

  function updateStyle(next: Partial<ZpmtImageStyle>) {
    onChange({ style: { ...document.style, ...next } })
  }

  return (
    <>
      <ZpmtPromptSection
        t={t}
        locale={locale}
        recipeVariableCategories={recipeVariableCategories}
        metadata={document.metadata}
        promptKind={document.kind}
        sectionKey="prompt"
        title={t.imagePrompt}
        value={document.prompt}
        collapsed={Boolean(collapsedSections.prompt)}
        onToggle={onToggleSection}
        modelCapabilities={modelCapabilities}
        onInstructionDrop={onInstructionDrop}
        onTokenEdit={onTokenEdit}
        onChange={(value) => onChange({ prompt: value })}
      />

      {negativePromptSupported ? (
        <ZpmtPromptSection
          t={t}
          locale={locale}
          recipeVariableCategories={recipeVariableCategories}
          metadata={document.metadata}
          promptKind={document.kind}
          sectionKey="negativePrompt"
          title={t.negativePrompt}
          value={document.negativePrompt}
          collapsed={Boolean(collapsedSections.negativePrompt)}
          onToggle={onToggleSection}
          modelCapabilities={modelCapabilities}
          onInstructionDrop={onInstructionDrop}
          onTokenEdit={onTokenEdit}
          onChange={(value) => onChange({ negativePrompt: value })}
        />
      ) : null}

      {styleInput.type === 'preset' || styleInput.type === 'preset-with-extra-text' ? (
        <ZpmtSection
          title={t.promptStyle}
          sectionKey="style"
          icon={WandSparkles}
          collapsed={Boolean(collapsedSections.style)}
          onToggle={onToggleSection}
        >
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              {t.promptStylePreset}
              <select
                className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={document.style.value}
                onChange={(event) => updateStyle({ mode: styleInput.type, value: event.target.value })}
              >
                {(styleInput.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {styleInput.type === 'preset-with-extra-text' ? (
              <ZpmtInlinePromptEditor
                t={t}
                locale={locale}
                recipeVariableCategories={recipeVariableCategories}
                metadata={document.metadata}
                sectionKey="style"
                value={document.style.extraText}
                modelCapabilities={modelCapabilities}
                onInstructionDrop={onInstructionDrop}
                onTokenEdit={onTokenEdit}
                onChange={(value) => updateStyle({ mode: styleInput.type, extraText: value })}
              />
            ) : null}
          </div>
        </ZpmtSection>
      ) : (
        <ZpmtPromptSection
          t={t}
          locale={locale}
          recipeVariableCategories={recipeVariableCategories}
          metadata={document.metadata}
          promptKind={document.kind}
          sectionKey="style"
          title={t.promptStyle}
          value={document.style.value}
          collapsed={Boolean(collapsedSections.style)}
          onToggle={onToggleSection}
          modelCapabilities={modelCapabilities}
          onInstructionDrop={onInstructionDrop}
          onTokenEdit={onTokenEdit}
          onChange={(value) => updateStyle({ mode: 'free-text', value })}
        />
      )}
    </>
  )
}

function ZpmtSection({
  title,
  sectionKey,
  icon: Icon,
  collapsed,
  children,
  headerAction,
  onToggle,
}: {
  title: string
  sectionKey: ZpmtSectionKey
  icon: typeof Home
  collapsed: boolean
  children: React.ReactNode
  headerAction?: React.ReactNode
  onToggle: (section: ZpmtSectionKey) => void
}) {
  const headerContent = (
    <>
      {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#d95a1b]" />
      <span className="truncate">{title}</span>
    </>
  )

  return (
    <section className={cn('zpmt-section', collapsed && 'zpmt-section--collapsed')}>
      {headerAction ? (
        <div className="zpmt-section__header zpmt-section__header--with-action">
          <button
            type="button"
            className="zpmt-section__header-toggle"
            aria-expanded={!collapsed}
            onClick={() => onToggle(sectionKey)}
          >
            {headerContent}
          </button>
          {headerAction}
        </div>
      ) : (
        <button
          type="button"
          className="zpmt-section__header"
          aria-expanded={!collapsed}
          onClick={() => onToggle(sectionKey)}
        >
          {headerContent}
        </button>
      )}
      {collapsed ? null : <div className="zpmt-section__body">{children}</div>}
    </section>
  )
}

function ZpmtPromptSection({
  t,
  locale,
  recipeVariableCategories,
  metadata,
  promptKind,
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
  promptKind: ZpmtPromptKind
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
  const [extractDialogOpen, setExtractDialogOpen] = useState(false)
  const [extractCopied, setExtractCopied] = useState(false)
  const [extractRandomLoading, setExtractRandomLoading] = useState(false)
  const [extractionValues, setExtractionValues] = useState<Record<string, string>>({})
  const editorHeight = estimateZpmtPromptEditorHeight(value)
  const extractedVariables = useMemo(
    () => extractPromptSectionVariables(value, t, locale, recipeVariableCategories, metadata, modelCapabilities),
    [locale, metadata, modelCapabilities, recipeVariableCategories, t, value],
  )
  const extractedPromptText = useMemo(
    () => renderPromptTextForExtraction(value, extractedVariables, extractionValues),
    [extractedVariables, extractionValues, value],
  )
  const extractedContent = useMemo(
    () => buildPromptSectionExtractionText(title, extractedPromptText, extractedVariables, t, extractionValues),
    [extractedPromptText, extractedVariables, extractionValues, t, title],
  )

  const { setNodeRef: setPromptDropRef, isOver } = useDroppable({
    id: `zpmt-prompt:${sectionKey}`,
    data: {
      kind: 'zpmt-prompt',
      onDragInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => {
        if (!isZpmtPromptSectionKey(sectionKey) || !canDropInstructionInPromptSection(payload, promptKind, sectionKey, modelCapabilities)) return
        editorRef.current?.setCaretAtPoint(point, true)
      },
      onDropInstruction: (payload: InstructionDragPayload, point: ZpmtDropPoint) => {
        if (!isZpmtPromptSectionKey(sectionKey)) return
        if (!canDropInstructionInPromptSection(payload, promptKind, sectionKey, modelCapabilities)) return
        const offset = editorRef.current?.setCaretAtPoint(point, false) ?? value.length
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
      if (
        !detail ||
        !isZpmtPromptSectionKey(sectionKey) ||
        !canDropInstructionInPromptSection(detail.payload, promptKind, sectionKey, modelCapabilities)
      ) return
      if (!isPointInsidePrompt(detail.point)) {
        editorRef.current?.clearDropCursor()
        return
      }
      editorRef.current?.setCaretAtPoint(detail.point, true)
      detail.handled = true
    }

    function handleInstructionDrop(event: Event) {
      const detail = (event as CustomEvent<ZpmtInstructionPointEventDetail>).detail
      if (
        !detail ||
        !isZpmtPromptSectionKey(sectionKey) ||
        !canDropInstructionInPromptSection(detail.payload, promptKind, sectionKey, modelCapabilities)
      ) return
      if (!isPointInsidePrompt(detail.point)) return
      const offset = editorRef.current?.setCaretAtPoint(detail.point, false) ?? value.length
      editorRef.current?.clearDropCursor()
      onInstructionDrop(detail.payload, sectionKey, offset)
      detail.handled = true
    }

    window.addEventListener(ZPMT_INSTRUCTION_DRAG_EVENT, handleInstructionDrag)
    window.addEventListener(ZPMT_INSTRUCTION_DROP_EVENT, handleInstructionDrop)
    return () => {
      window.removeEventListener(ZPMT_INSTRUCTION_DRAG_EVENT, handleInstructionDrag)
      window.removeEventListener(ZPMT_INSTRUCTION_DROP_EVENT, handleInstructionDrop)
    }
  }, [modelCapabilities, onInstructionDrop, promptKind, sectionKey, value.length])

  async function copyExtractedContent() {
    await copyTextToClipboard(extractedContent)
    setExtractCopied(true)
    window.setTimeout(() => setExtractCopied(false), 1400)
  }

  async function randomizeExtractionValues() {
    if (extractRandomLoading) return
    setExtractRandomLoading(true)
    try {
      const nextValues = await createRandomPromptVariableValues({
        variables: extractedVariables.map((variable) => ({
          key: variable.key,
          token: variable.token,
          name: variable.name,
          label: variable.label,
          variableType: variable.variableType,
          defaultValue: variable.defaultValue,
          recipe: variable.recipe,
        })),
        currentValues: extractionValues,
        promptContext: value,
      })
      setExtractionValues((current) => ({ ...current, ...nextValues }))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '随机参数生成失败')
    } finally {
      setExtractRandomLoading(false)
    }
  }

  return (
    <ZpmtSection
      title={title}
      sectionKey={sectionKey}
      icon={FileText}
      collapsed={collapsed}
      headerAction={(
        <button
          type="button"
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-600 transition hover:border-[#ffd8c4] hover:bg-[#fff8f4] hover:text-[#b94712]"
          onClick={() => setExtractDialogOpen(true)}
        >
          <Copy className="h-3 w-3" />
          {t.extractPromptContent}
        </button>
      )}
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
            if (isZpmtPromptSectionKey(sectionKey)) onTokenEdit(sectionKey, start, end, token)
          }}
        />
      </div>
      {extractDialogOpen ? createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={() => setExtractDialogOpen(false)}>
          <div className="w-[min(680px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-slate-900">{t.extractPromptContentTitle} · {title}</h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{t.extractPromptContentHint}</p>
              </div>
              <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setExtractDialogOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-black uppercase text-slate-500">{title}</div>
                <pre className="max-h-[48vh] overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{extractedPromptText || '-'}</pre>
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-black uppercase text-slate-500">{t.extractionVariables}</div>
                <div className="max-h-[48vh] overflow-auto rounded-md border border-slate-200 bg-white p-2">
                  {extractedVariables.length ? (
                    <div className="space-y-1.5">
                      {extractedVariables.map((variable) => (
                        <div key={`${variable.token}-${variable.index}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                          <div className="truncate text-xs font-black text-slate-800">{variable.label}</div>
                          {variable.detail ? <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{variable.detail}</div> : null}
                          <PromptExtractionValueInput
                            t={t}
                            variable={variable}
                            value={extractionValues[variable.key] ?? variable.defaultValue}
                            onChange={(nextValue) => setExtractionValues((current) => ({ ...current, [variable.key]: nextValue }))}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-6 text-center text-xs font-semibold text-slate-500">{t.extractionNoVariables}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-semibold text-emerald-600">{extractCopied ? t.copiedToClipboard : ''}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void randomizeExtractionValues()} disabled={!extractedVariables.length || extractRandomLoading}>
                  {extractRandomLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                  随机参数
                </Button>
                <Button type="button" size="sm" onClick={() => void copyExtractedContent()}>
                  <Copy className="h-3.5 w-3.5" />
                  {t.copyExtractedPromptContent}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </ZpmtSection>
  )
}

function ZpmtInlinePromptEditor({
  t,
  locale,
  recipeVariableCategories,
  metadata,
  sectionKey,
  value,
  modelCapabilities,
  onInstructionDrop,
  onTokenEdit,
  onChange,
}: {
  t: WorkbenchCopy
  locale: Locale
  recipeVariableCategories: RecipeVariableCategory[]
  metadata: ZpmtRecipeVariableMetadata
  sectionKey: ZpmtPromptSectionKey
  value: string
  modelCapabilities: ZpmtModelCapabilityGate
  onInstructionDrop: (payload: InstructionDragPayload, sectionKey: ZpmtPromptSectionKey, offset: number) => void
  onTokenEdit: (sectionKey: ZpmtPromptSectionKey, start: number, end: number, token: string) => void
  onChange: (value: string) => void
}) {
  const editorRef = useRef<ZpmtPromptTokenEditorHandle | null>(null)
  const editorHeight = estimateZpmtPromptEditorHeight(value)
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-2 py-1.5 text-[11px] font-black uppercase text-slate-500">{t.promptStyleExtra}</div>
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
        onTokenEdit={(start, end, token) => onTokenEdit(sectionKey, start, end, token)}
      />
    </div>
  )
}

type PromptExtractionVariable = {
  index: number
  key: string
  token: string
  name: string
  label: string
  detail: string
  defaultValue: string
  variableType?: VariableType
  recipe?: { candidates: string[]; defaultValues: string[]; multiple: boolean }
}

function extractPromptSectionVariables(
  value: string,
  t: WorkbenchCopy,
  locale: Locale,
  recipeVariableCategories: RecipeVariableCategory[],
  metadata: ZpmtRecipeVariableMetadata,
  modelCapabilities: ZpmtModelCapabilityGate,
) {
  const seen = new Set<string>()
  return findPromptTokenRanges(value).flatMap((tokenRange, index) => {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed || parsed.tokenType === 'const') return []
    const key = getZpmtTestVariableKey(tokenRange.token) || tokenRange.token
    if (seen.has(key)) return []
    seen.add(key)
    const presentation = resolvePromptTokenPresentation(tokenRange.token, t, locale, recipeVariableCategories, metadata, modelCapabilities)
    const params = getPromptTokenParamMap(parsed.params)
    const isRecipe = parsed.tokenType === 'recipe'
    const sourceId = params.source || ''
    const recipeItem = isRecipe ? findRecipeVariableItemById(sourceId, recipeVariableCategories) : null
    const recipeSnapshot = isRecipe ? findRecipeVariableSnapshot(metadata, parsed.name, sourceId) : null
    const recipeDefaultValues = isRecipe
      ? parsePromptTestRecipeValues(params.default || '').length
        ? parsePromptTestRecipeValues(params.default || '')
        : recipeItem?.defaultValues?.length
          ? recipeItem.defaultValues
          : recipeSnapshot?.defaultValues || []
      : []
    const detail = presentation.tooltip
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .join('；')
    return [{
      index,
      key,
      token: tokenRange.token,
      name: parsed.name,
      label: presentation.label,
      detail,
      defaultValue: isRecipe ? recipeDefaultValues.join(', ') : params.default || '',
      variableType: parsed.variableType,
      recipe: isRecipe
        ? {
            candidates: recipeItem?.candidates[locale] || recipeSnapshot?.candidates[locale] || [],
            defaultValues: recipeDefaultValues,
            multiple: recipeItem?.multiple ?? recipeSnapshot?.multiple ?? params.multi === 'true',
          }
        : undefined,
    } satisfies PromptExtractionVariable]
  })
}

function PromptExtractionValueInput({
  t,
  variable,
  value,
  onChange,
}: {
  t: WorkbenchCopy
  variable: PromptExtractionVariable
  value: string
  onChange: (value: string) => void
}) {
  if (variable.variableType === 'image' || variable.variableType === 'file') {
    return (
      <Textarea
        className="mt-2 min-h-16 bg-white text-xs"
        value={value}
        placeholder={variable.variableType === 'image' ? '填写参考图说明或上传文件名' : '填写参考文件说明或文件名'}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <PromptTestVariableInput
      t={t}
      variable={{
        key: variable.key,
        token: variable.token,
        name: variable.name,
        label: variable.label,
        typeLabel: '',
        variableType: variable.variableType,
        defaultValue: variable.defaultValue,
        recipe: variable.recipe,
      }}
      value={value}
      onChange={onChange}
    />
  )
}

function renderPromptTextForExtraction(value: string, variables: PromptExtractionVariable[], values: Record<string, string>) {
  const variableMap = new Map(variables.map((variable) => [variable.key, variable]))
  return value.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtTestVariableKey(token) || token
    const variable = variableMap.get(key)
    if (!variable) return token
    const filledValue = values[key] ?? variable.defaultValue
    if (!filledValue && (variable.variableType === 'image' || variable.variableType === 'file')) return `[${variable.label}待补充]`
    return formatExtractionFilledValue(filledValue)
  })
}

function formatExtractionFilledValue(value: string) {
  const parsedValues = parsePromptTestRecipeValues(value)
  if (parsedValues.length > 1) return parsedValues.join('、')
  return value || ''
}

function buildPromptSectionExtractionText(
  title: string,
  value: string,
  variables: PromptExtractionVariable[],
  t: WorkbenchCopy,
  values: Record<string, string>,
) {
  const lines = [
    `# ${title}`,
    '',
    value || '',
    '',
    `## ${t.extractionVariables}`,
  ]
  if (variables.length) {
    variables.forEach((variable) => {
      const filledValue = values[variable.key] ?? variable.defaultValue
      lines.push(`- ${variable.label}：${formatExtractionFilledValue(filledValue) || '未填写'}${variable.detail ? `（${variable.detail}）` : ''}`)
    })
  } else {
    lines.push(`- ${t.extractionNoVariables}`)
  }
  return `${lines.join('\n').trim()}\n`
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function readFileAsAiAssistAttachment(file: File): Promise<AiAssistAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result || ''),
      })
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
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
      try {
        const range = getPromptEditorRangeFromPoint(root, point) || createPromptEditorEndRange(root)
        setPromptEditorSelection(root, range)
        if (showDropCursor) showPromptEditorDropCursor(root, range)
        return getPromptEditorOffsetFromRange(root, range)
      } catch {
        clearPromptEditorDropCursor(root)
        return latestValueRef.current.length
      }
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
              type={field.type === 'number' ? 'number' : field.secret ? 'password' : 'text'}
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
  const [name, setName] = useState(() =>
    initialValues.name ||
    sanitizePromptTokenName(recipeItem?.name[locale] || recipeItem?.variableName || (variableType ? t.variableTypes[variableType] : '') || recipeItem?.id || '变量'),
  )
  const [arrayItemType, setArrayItemType] = useState<ArrayItemType | ''>(() => initialValues.arrayItemType)
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

    if (!isValidPromptTokenName(normalizedName)) {
      setError(t.tagNameInvalid)
      return
    }
    if (normalizedName !== initialValues.originalName && existingNames.has(normalizedName)) {
      setError(t.tagNameDuplicate)
      return
    }
    if (variableType === 'array' && !arrayItemType) {
      setError(t.arrayTypeRequired)
      return
    }
    if (detailConfig && !normalizedDetail) {
      setError(t.tagInfoRequired)
      return
    }

    const token =
      dialog.payload.kind === 'variable'
        ? createVariableToken(dialog.payload.variableType, normalizedName, normalizedDetail, defaultValue, arrayItemType)
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

          {variableType === 'array' ? (
            <label className="block text-xs font-bold text-slate-600">
              {t.arrayType}
              <select
                className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={arrayItemType}
                onChange={(event) => {
                  setArrayItemType(normalizeArrayItemType(event.target.value))
                  setError('')
                }}
              >
                <option value="">{t.selectArrayType}</option>
                {ARRAY_ITEM_TYPES.map((itemType) => (
                  <option key={itemType} value={itemType}>
                    {t.arrayItemTypes[itemType]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {detailConfig ? (
            <label className="block text-xs font-bold text-slate-600">
              {detailConfig.label}
              {variableType ? (
                <ZpmtVariableDetailValueControl
                  t={t}
                  variableType={variableType}
                  config={detailConfig}
                  value={detailValue}
                  onChange={(value) => {
                    setDetailValue(value)
                    setError('')
                  }}
                />
              ) : null}
            </label>
          ) : null}

          {variableType && isVariableDefaultValueSupported(variableType) ? (
            <label className="block text-xs font-bold text-slate-600">
              {t.defaultValue}
              <ZpmtVariableDefaultValueControl
                t={t}
                variableType={variableType}
                value={defaultValue}
                onChange={(value) => {
                  setDefaultValue(value)
                  setError('')
                }}
              />
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

const PROMPT_TEST_EMPTY_PANEL_KEY = '__empty_prompt_test__'

function createPromptTestPanelState(): PromptTestPanelState {
  return {
    activeTab: 'test',
    variableValues: {},
    variableErrors: {},
    mediaVariableValues: {},
    maxToolRounds: 5,
    runLoading: false,
    randomLoading: false,
    runResponse: null,
  }
}

function getPromptTestPanelKey(activeFile: ProjectFileReference | null) {
  return activeFile?.projectId && activeFile.path ? `${activeFile.projectId}:${activeFile.path}` : PROMPT_TEST_EMPTY_PANEL_KEY
}

function normalizePromptTestPanelStateForVariables(state: PromptTestPanelState, variables: ZpmtTestVariable[]): PromptTestPanelState {
  const variableValues: Record<string, string> = {}
  const mediaVariableValues: Record<string, ZpmtTestMediaFile[]> = {}

  for (const variable of variables) {
    if (variable.mediaKind) mediaVariableValues[variable.key] = state.mediaVariableValues[variable.key] || []
    else variableValues[variable.key] = state.variableValues[variable.key] ?? ''
  }

  return {
    ...state,
    variableValues,
    variableErrors: {},
    mediaVariableValues,
    randomLoading: Boolean(state.randomLoading),
  }
}

function TestPanel({
  t,
  locale,
  document,
  activeFile,
  modelCapabilities,
  promptSurface,
  recipeVariableCategories,
}: {
  t: WorkbenchCopy
  locale: Locale
  document: ZpmtDocument | null
  activeFile: ProjectFileReference | null
  modelCapabilities: ZpmtModelCapabilityGate
  promptSurface: AiModelPromptSurface | null
  recipeVariableCategories: RecipeVariableCategory[]
}) {
  const panelKey = useMemo(() => getPromptTestPanelKey(activeFile), [activeFile?.projectId, activeFile?.path])
  const variables = useMemo(
    () => (document ? collectZpmtTestVariables(document, t, locale, promptSurface, recipeVariableCategories) : []),
    [document, locale, promptSurface, recipeVariableCategories, t],
  )
  const variablesKey = variables
    .map((variable) =>
      [
        variable.key,
        variable.defaultValue,
        variable.mediaKind || variable.variableType || 'recipe',
        variable.recipe?.multiple ? 'multi' : 'single',
        variable.recipe?.candidates.join(',') || '',
      ].join(':'),
    )
    .join('|')
  const [stateByFile, setStateByFile] = useState<Record<string, PromptTestPanelState>>({})
  const panelState = stateByFile[panelKey] || createPromptTestPanelState()
  const { activeTab, variableValues, variableErrors, mediaVariableValues, maxToolRounds, runLoading, randomLoading, runResponse } = panelState
  const canRun = Boolean(document && activeFile?.projectId && document.config.providerId && document.config.model)
  const effectiveVariableValues = useMemo(() => getEffectivePromptTestVariableValues(variables, variableValues), [variables, variableValues])
  const renderedPrompt = document ? buildZpmtRenderedPromptPreview(document, effectiveVariableValues, mediaVariableValues, promptSurface) : ''
  const isImageTest = document?.kind === 'image'

  function setPanelStateForKey(key: string, updater: (state: PromptTestPanelState) => PromptTestPanelState) {
    setStateByFile((current) => {
      const nextState = updater(current[key] || createPromptTestPanelState())
      return { ...current, [key]: nextState }
    })
  }

  function updateCurrentPanelState(updater: (state: PromptTestPanelState) => PromptTestPanelState) {
    setPanelStateForKey(panelKey, updater)
  }

  useEffect(() => {
    setPanelStateForKey(panelKey, (current) => normalizePromptTestPanelStateForVariables(current, variables))
  }, [panelKey, variablesKey, variables])

  async function runAgentTest() {
    if (!document || !activeFile?.projectId || runLoading) return
    const validation = validatePromptTestVariables(variables, variableValues, mediaVariableValues, modelCapabilities, t)
    if (!validation.ok) {
      updateCurrentPanelState((current) => ({ ...current, activeTab: 'test', variableErrors: validation.errors }))
      return
    }

    const targetPanelKey = panelKey
    const requestBody = {
      document,
      variables: validation.values,
      mediaVariables: mediaVariableValues,
      maxToolRounds,
      context: {
        projectId: activeFile?.projectId || '',
        path: activeFile?.path || '',
      },
    }

    updateCurrentPanelState((current) => ({
      ...current,
      activeTab: 'result',
      variableErrors: {},
      runLoading: true,
      runResponse: { status: 'loading', ok: false, outputType: isImageTest ? 'image' : 'text' },
    }))

    if (isImageTest) {
      const response = await fetchJson('/api/prompts/test', {
        method: 'POST',
        body: requestBody,
      })
      setPanelStateForKey(targetPanelKey, (current) => ({
        ...current,
        runLoading: false,
        runResponse: {
          ...(response && typeof response === 'object' ? response : { ok: false, message: t.agentRunFailed }),
          status: response && typeof response === 'object' && response.ok === true ? 'success' : 'error',
        } as Record<string, unknown>,
      }))
      return
    }

    await runPromptTestStream(
      { ...requestBody, stream: true },
      (event) => {
        setPanelStateForKey(targetPanelKey, (current) => ({
          ...current,
          runResponse: applyPromptTestStreamEvent(current.runResponse, event),
        }))
      },
      () => {
        setPanelStateForKey(targetPanelKey, (current) => ({ ...current, runLoading: false }))
      },
      (message) => {
        setPanelStateForKey(targetPanelKey, (current) => ({
          ...current,
          runResponse: { ok: false, status: 'error', outputType: 'text', message },
        }))
      },
    )
  }

  async function randomizeTestVariables() {
    if (!document || randomLoading) return
    const targetPanelKey = panelKey
    setPanelStateForKey(targetPanelKey, (current) => ({ ...current, randomLoading: true }))
    try {
      const nextValues = await createRandomPromptVariableValues({
        variables,
        currentValues: variableValues,
        promptContext: renderedPrompt || buildZpmtPreviewMarkdown(document, getZpmtPromptMode(document)),
      })
      setPanelStateForKey(targetPanelKey, (current) => ({
        ...current,
        variableValues: { ...current.variableValues, ...nextValues },
        variableErrors: {},
      }))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '随机参数生成失败')
    } finally {
      setPanelStateForKey(targetPanelKey, (current) => ({ ...current, randomLoading: false }))
    }
  }

  function updateVariableValue(variable: ZpmtTestVariable, value: string) {
    updateCurrentPanelState((current) => ({
      ...current,
      variableValues: { ...current.variableValues, [variable.key]: value },
      variableErrors: { ...current.variableErrors, [variable.key]: '' },
    }))
  }

  function updateMediaVariableValue(variable: ZpmtTestVariable, files: ZpmtTestMediaFile[]) {
    updateCurrentPanelState((current) => ({
      ...current,
      mediaVariableValues: { ...current.mediaVariableValues, [variable.key]: files },
      variableErrors: { ...current.variableErrors, [variable.key]: '' },
    }))
  }

  function updateMaxToolRounds(value: string) {
    const parsed = Math.round(Number(value))
    if (!Number.isFinite(parsed)) {
      updateCurrentPanelState((current) => ({ ...current, maxToolRounds: 0 }))
      return
    }
    updateCurrentPanelState((current) => ({ ...current, maxToolRounds: Math.min(20, Math.max(0, parsed)) }))
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => updateCurrentPanelState((current) => ({ ...current, activeTab: value }))} className="flex h-full min-h-0 flex-col">
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
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => void randomizeTestVariables()} disabled={!document || runLoading || randomLoading || !variables.some((variable) => !variable.mediaKind)}>
                  {randomLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <WandSparkles className="h-3 w-3" />}
                  随机参数
                </Button>
                <Button variant="outline" size="sm" onClick={() => void runAgentTest()} disabled={!canRun || runLoading || randomLoading}>
                  <Play className="h-3 w-3" /> {runLoading ? t.runningAgent : isImageTest ? t.generateImage : t.runAgent}
                </Button>
              </div>
            </div>
            <div className="space-y-3 p-3">
              {!canRun ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{t.agentRunNoProvider}</div> : null}
              {variables.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {variables.map((variable) => {
                    const mediaSupported = !variable.mediaKind
                      || (variable.mediaKind === 'image' ? modelCapabilities.supportsReferenceImage : modelCapabilities.supportsReferenceFile)
                    const error = variableErrors[variable.key] || ''

                    return (
                      <div key={variable.key} className="block rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-600">
                        <span className="block min-w-0 truncate text-slate-800">{variable.label}</span>
                        {!variable.recipe && variable.source && variable.source !== variable.label ? <span className="mt-1 block truncate text-[11px] font-semibold text-slate-400">{variable.source}</span> : null}
                        {variable.mediaKind ? (
                          <TestMediaUploadControl
                            t={t}
                            variable={variable}
                            files={mediaVariableValues[variable.key] || []}
                            disabled={!mediaSupported || runLoading || randomLoading}
                            unsupportedText={!mediaSupported ? t.mediaUnsupportedByModel : ''}
                            onChange={(files) => updateMediaVariableValue(variable, files)}
                            onError={(message) => updateCurrentPanelState((current) => ({ ...current, runResponse: { ok: false, status: 'error', message } }))}
                          />
                        ) : (
                          <PromptTestVariableInput
                            t={t}
                            variable={variable}
                            value={variableValues[variable.key] || ''}
                            disabled={runLoading || randomLoading}
                            onChange={(value) => updateVariableValue(variable, value)}
                          />
                        )}
                        {error ? <span className="mt-1 block text-[11px] font-black text-red-600">{error}</span> : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
                  {t.testVariableEmpty}
                </div>
              )}
              {document.kind === 'agent' ? (
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
              ) : null}
            </div>
          </section>
        )}
      </TabsContent>
      <TabsContent value="result" className="min-h-0 flex-1 overflow-auto p-3">
        {runResponse || runLoading ? (
          <PromptTestResultCard t={t} response={runResponse || { status: 'loading', ok: false, outputType: isImageTest ? 'image' : 'text' }} />
        ) : (
          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">{t.noAgentOutput}</div>
        )}
      </TabsContent>
      <TabsContent value="cases" className="min-h-0 flex-1 overflow-auto p-3">
        <div className="space-y-3">
          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <p className="mb-2 font-black text-slate-900">{t.renderedPrompt}</p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] leading-5">{renderedPrompt}</pre>
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

type PromptTestStreamEvent = {
  type: string
  outputType?: string
  delta?: string
  output?: string
  thinking?: string
  message?: string
  code?: string
  toolName?: string
  status?: string
  durationMs?: number
  toolRounds?: number
  toolCallCount?: number
}

function PromptArrayValueEditor({
  t,
  value,
  disabled,
  onChange,
}: {
  t: WorkbenchCopy
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const items = parsePromptTestArrayItems(value)
  const visibleItems = items.length ? items : ['']
  const updateItems = (nextItems: string[]) => onChange(JSON.stringify(nextItems.filter((item) => item.trim())))

  return (
    <div className="space-y-1.5">
      {visibleItems.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            className="h-7 bg-white text-xs"
            value={item}
            disabled={disabled}
            placeholder={`${t.arrayItemPlaceholder} ${index + 1}`}
            onChange={(event) => {
              const next = [...visibleItems]
              next[index] = event.target.value
              updateItems(next)
            }}
          />
          <button
            type="button"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            title={t.removeArrayItem}
            disabled={disabled || visibleItems.length <= 1}
            onClick={() => updateItems(visibleItems.filter((_, currentIndex) => currentIndex !== index))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 w-full text-[11px]" disabled={disabled} onClick={() => updateItems([...visibleItems, ''])}>
        <Plus className="h-3 w-3" /> {t.addArrayItem}
      </Button>
    </div>
  )
}

function isVariableDefaultValueSupported(type: VariableType) {
  return type === 'string' || type === 'number' || type === 'array'
}

function ZpmtVariableDetailValueControl({
  t,
  variableType,
  config,
  value,
  onChange,
}: {
  t: WorkbenchCopy
  variableType: VariableType
  config: ReturnType<typeof getVariableDetailConfig>
  value: string
  onChange: (value: string) => void
}) {
  if (variableType === 'boolean') {
    return (
      <select
        className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="false">{t.booleanText.false}</option>
        <option value="true">{t.booleanText.true}</option>
      </select>
    )
  }

  if (variableType === 'color') {
    return (
      <div className="mt-1 flex items-center gap-2">
        <input
          className="h-8 w-10 shrink-0 rounded-md border border-slate-200 bg-white p-1"
          type="color"
          value={normalizePromptTestColor(value || config.defaultValue)}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input className="h-8 bg-white text-xs" value={value} placeholder={config.placeholder} onChange={(event) => onChange(event.target.value)} />
      </div>
    )
  }

  return (
    <Input
      className="mt-1"
      value={value}
      placeholder={config.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function ZpmtVariableDefaultValueControl({
  t,
  variableType,
  value,
  onChange,
}: {
  t: WorkbenchCopy
  variableType: VariableType
  value: string
  onChange: (value: string) => void
}) {
  if (variableType === 'array') return <PromptArrayValueEditor t={t} value={value} onChange={onChange} />

  return (
    <Input
      className="mt-1"
      type={variableType === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function PromptTestVariableInput({
  t,
  variable,
  value,
  disabled,
  onChange,
}: {
  t: WorkbenchCopy
  variable: ZpmtTestVariable
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const defaultValue = variable.defaultValue
  const inputValue = value
  const [arrayEditorOpen, setArrayEditorOpen] = useState(false)
  const [multiEditorOpen, setMultiEditorOpen] = useState(false)

  if (variable.recipe) {
    const candidateValues = Array.from(new Set([...variable.recipe.candidates, ...variable.recipe.defaultValues]))
    const selectedValues = parsePromptTestRecipeValues(inputValue || defaultValue)

    if (candidateValues.length) {
      if (variable.recipe.multiple) {
        const updateSelectedValues = (nextValues: string[]) => onChange(JSON.stringify(nextValues))
        const summary = selectedValues.length
          ? selectedValues.slice(0, 3).join(' / ') + (selectedValues.length > 3 ? ` +${selectedValues.length - 3}` : '')
          : t.emptySelected

        return (
          <div className="mt-2">
            <button
              type="button"
              className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-xs font-bold text-slate-700 transition hover:border-[#ffd8c4] hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              onClick={() => setMultiEditorOpen(true)}
            >
              <span className="min-w-0 truncate">{summary}</span>
              <span className="shrink-0 text-[11px] font-black text-[#d95a1b]">{t.compactEdit}</span>
            </button>
            {multiEditorOpen ? createPortal(
              <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={() => setMultiEditorOpen(false)}>
                <div className="w-[min(520px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black text-slate-900">{t.editMultiValues}</h2>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{t.selectedCount.replace('{count}', String(selectedValues.length))}</p>
                    </div>
                    <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setMultiEditorOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-[52vh] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {candidateValues.map((candidate) => {
                        const selected = selectedValues.includes(candidate)

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
                              onChange={() => updateSelectedValues(
                                selected ? selectedValues.filter((item) => item !== candidate) : [...selectedValues, candidate],
                              )}
                            />
                            {candidate}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" size="sm" onClick={() => setMultiEditorOpen(false)}>{t.done}</Button>
                  </div>
                </div>
              </div>,
              document.body,
            ) : null}
          </div>
        )
      }

      return (
        <select
          className="mt-2 h-8 w-full rounded-md border border-input bg-white px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={inputValue || selectedValues[0] || ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{defaultValue ? `${t.defaultValue}: ${defaultValue}` : t.testValue}</option>
          {candidateValues.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
      )
    }
  }

  if (variable.variableType === 'array') {
    const items = parsePromptTestArrayItems(inputValue || defaultValue)
    const summary = items.length
      ? items.slice(0, 3).join(' / ') + (items.length > 3 ? ` +${items.length - 3}` : '')
      : t.emptySelected
    return (
      <div className="mt-2">
        <button
          type="button"
          className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-xs font-bold text-slate-700 transition hover:border-[#ffd8c4] hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={() => setArrayEditorOpen(true)}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span className="shrink-0 text-[11px] font-black text-[#d95a1b]">{t.compactEdit}</span>
        </button>
        {arrayEditorOpen ? createPortal(
          <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={() => setArrayEditorOpen(false)}>
            <div className="w-[min(520px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="truncate text-sm font-black text-slate-900">{t.editArrayValues}</h2>
                <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setArrayEditorOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <PromptArrayValueEditor t={t} value={inputValue || defaultValue} disabled={disabled} onChange={onChange} />
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" onClick={() => setArrayEditorOpen(false)}>{t.done}</Button>
              </div>
            </div>
          </div>,
          document.body,
        ) : null}
      </div>
    )
  }

  if (variable.variableType === 'color') {
    const color = normalizePromptTestColor(inputValue || defaultValue)
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          className="h-8 w-10 shrink-0 rounded-md border border-slate-200 bg-white p-1"
          type="color"
          value={color}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input className="h-8 bg-white text-xs" value={inputValue} disabled={disabled} placeholder={defaultValue || '#000000'} onChange={(event) => onChange(event.target.value)} />
      </div>
    )
  }

  if (variable.variableType === 'boolean') {
    return (
      <select
        className="mt-2 h-8 w-full rounded-md border border-input bg-white px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        value={inputValue || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{defaultValue ? `${t.defaultValue}: ${t.booleanText[normalizePromptTestBoolean(defaultValue) as 'true' | 'false'] || defaultValue}` : t.testValue}</option>
        <option value="true">{t.booleanText.true}</option>
        <option value="false">{t.booleanText.false}</option>
      </select>
    )
  }

  return (
    <Input
      className="mt-2 h-8 bg-white text-xs"
      type={variable.variableType === 'number' ? 'number' : 'text'}
      value={inputValue}
      disabled={disabled}
      placeholder={defaultValue ? `${t.defaultValue}: ${defaultValue}` : t.testValue}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function parsePromptTestArrayItems(value: string) {
  const raw = value.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).filter((item) => item.trim())
  } catch {
    // Fall back to simple text splitting.
  }
  return raw.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
}

function parsePromptTestRecipeValues(value: string) {
  const raw = value.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(readString).filter(Boolean)
  } catch {
    // Recipe token defaults are stored as comma-separated text.
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean)
}

function normalizePromptTestColor(value: string) {
  const normalized = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '#000000'
}

function normalizePromptTestBoolean(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === '是') return 'true'
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '否') return 'false'
  return ''
}

type RandomPromptVariable = Pick<ZpmtTestVariable, 'key' | 'token' | 'name' | 'label' | 'variableType' | 'defaultValue' | 'mediaKind' | 'recipe'>

async function createRandomPromptVariableValues(input: {
  variables: RandomPromptVariable[]
  currentValues: Record<string, string>
  promptContext: string
}) {
  const values: Record<string, string> = {}
  const llmVariables: RandomPromptVariable[] = []

  for (const variable of input.variables) {
    if (variable.mediaKind) continue
    const directValue = createDirectRandomPromptVariableValue(variable)
    if (directValue !== null) values[variable.key] = directValue
    else llmVariables.push(variable)
  }

  if (llmVariables.length) {
    const response = await fetchJson('/api/prompts/random-variables', {
      method: 'POST',
      body: {
        promptContext: input.promptContext,
        variables: llmVariables.map((variable) => ({
          key: variable.key,
          name: variable.name || variable.label,
          label: variable.label,
          variableType: variable.variableType || 'string',
          defaultValue: variable.defaultValue,
          detail: variable.token,
          itemType: getRandomArrayItemType(variable),
        })),
      },
    })
    if (!response?.ok) throw new Error(response?.message || '随机字符串参数生成失败')
    const remoteValues = isRecord(response.values) ? response.values : {}
    for (const variable of llmVariables) {
      const value = normalizeRandomPromptVariableValue(remoteValues[variable.key], variable)
      if (value) values[variable.key] = value
    }
  }

  return values
}

function createDirectRandomPromptVariableValue(variable: RandomPromptVariable): string | null {
  if (variable.recipe) {
    const candidates = Array.from(new Set([...variable.recipe.candidates, ...variable.recipe.defaultValues])).filter(Boolean)
    if (!candidates.length) return null
    if (variable.recipe.multiple) {
      const count = Math.max(1, Math.min(candidates.length, 1 + Math.floor(Math.random() * Math.min(3, candidates.length))))
      return JSON.stringify(shuffleArray(candidates).slice(0, count))
    }
    return candidates[Math.floor(Math.random() * candidates.length)] || ''
  }

  if (variable.variableType === 'boolean') return Math.random() > 0.5 ? 'true' : 'false'
  if (variable.variableType === 'color') return createRandomColor()
  if (variable.variableType === 'number') return createRandomNumberValue(variable.token, variable.defaultValue)
  if (variable.variableType === 'array') {
    const itemType = getRandomArrayItemType(variable)
    if (itemType === 'number') return JSON.stringify(Array.from({ length: 3 }, () => Number(createRandomNumberValue(variable.token, variable.defaultValue))))
    if (itemType === 'boolean') return JSON.stringify(Array.from({ length: 3 }, () => Math.random() > 0.5))
    return null
  }
  return null
}

function normalizeRandomPromptVariableValue(value: unknown, variable: RandomPromptVariable) {
  if (variable.variableType !== 'array') return readString(value)
  if (Array.isArray(value)) return JSON.stringify(value.filter((item) => item !== null && item !== undefined))
  const text = readString(value)
  if (!text) return ''
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return JSON.stringify(parsed.filter((item) => item !== null && item !== undefined))
  } catch {
    // Fall back to text splitting.
  }
  const items = text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
  return items.length ? JSON.stringify(items) : ''
}

function getRandomArrayItemType(variable: RandomPromptVariable) {
  if (variable.variableType !== 'array') return ''
  const parsed = parsePromptToken(variable.token)
  const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
  return normalizeArrayItemType(params.itemType || params.type) || 'string'
}

function createRandomNumberValue(token: string, defaultValue: string) {
  const parsed = parsePromptToken(token)
  const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
  const rangeText = [params.range, params.min, params.max, defaultValue].filter(Boolean).join(' ')
  const numbers = Array.from(rangeText.matchAll(/-?\d+(?:\.\d+)?/g), (match) => Number(match[0])).filter(Number.isFinite)
  const min = numbers.length >= 2 ? Math.min(numbers[0], numbers[1]) : 1
  const max = numbers.length >= 2 ? Math.max(numbers[0], numbers[1]) : numbers.length === 1 ? Math.max(1, numbers[0]) : 100
  return String(Math.round(min + Math.random() * Math.max(1, max - min)))
}

function createRandomColor() {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
}

function shuffleArray<T>(items: T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function getEffectivePromptTestVariableValues(variables: ZpmtTestVariable[], values: Record<string, string>) {
  return Object.fromEntries(
    variables
      .filter((variable) => !variable.mediaKind)
      .map((variable) => {
        const value = values[variable.key] || ''
        if (variable.recipe) {
          return [variable.key, parsePromptTestRecipeValues(value || variable.defaultValue).join(', ')]
        }
        if (variable.variableType === 'array') {
          const items = parsePromptTestArrayItems(value || variable.defaultValue)
          return [variable.key, JSON.stringify(items)]
        }
        if (variable.variableType === 'boolean') return [variable.key, normalizePromptTestBoolean(value || variable.defaultValue)]
        return [variable.key, value.trim() ? value : variable.defaultValue]
      }),
  )
}

function validatePromptTestVariables(
  variables: ZpmtTestVariable[],
  values: Record<string, string>,
  mediaValues: Record<string, ZpmtTestMediaFile[]>,
  modelCapabilities: ZpmtModelCapabilityGate,
  t: WorkbenchCopy,
) {
  const errors: Record<string, string> = {}
  const nextValues = getEffectivePromptTestVariableValues(variables, values)

  for (const variable of variables) {
    if (variable.mediaKind) {
      const supported = variable.mediaKind === 'image' ? modelCapabilities.supportsReferenceImage : modelCapabilities.supportsReferenceFile
      if (!supported) errors[variable.key] = t.unsupportedByModel
      else if (!(mediaValues[variable.key] || []).length) errors[variable.key] = t.requiredVariable
      continue
    }

    const value = nextValues[variable.key] || ''
    if (variable.recipe) {
      if (!parsePromptTestRecipeValues(value).length) errors[variable.key] = t.requiredVariable
      continue
    }
    if (variable.variableType === 'array') {
      if (!parsePromptTestArrayItems(value).length) errors[variable.key] = t.requiredVariable
      continue
    }
    if (variable.variableType === 'boolean') {
      if (!normalizePromptTestBoolean(value)) errors[variable.key] = t.requiredVariable
      continue
    }
    if (!String(value).trim()) errors[variable.key] = t.requiredVariable
  }

  return { ok: Object.keys(errors).length === 0, errors, values: nextValues }
}

async function runPromptTestStream(
  body: Record<string, unknown>,
  onEvent: (event: PromptTestStreamEvent) => void,
  onDone: () => void,
  onError: (message: string) => void,
) {
  try {
    const response = await fetch('/api/prompts/test', {
      method: 'POST',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null)
      onError(readString(isRecord(data) ? data.message : '') || 'Stream failed')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split(/\n\n/)
      buffer = chunks.pop() || ''
      for (const chunk of chunks) {
        const data = chunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
        if (!data) continue
        try {
          onEvent(JSON.parse(data) as PromptTestStreamEvent)
        } catch {
          // Ignore malformed stream events from intermediate proxies.
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Stream failed')
  } finally {
    onDone()
  }
}

function applyPromptTestStreamEvent(current: Record<string, unknown> | null, event: PromptTestStreamEvent): Record<string, unknown> {
  const base = current || { ok: false, status: 'streaming', outputType: 'text', output: '', thinking: '', events: [] }
  if (event.type === 'start') return { ...base, ok: false, status: 'streaming', outputType: 'text', output: '', thinking: '', events: [] }
  if (event.type === 'thinking') return { ...base, status: 'streaming', thinking: `${readString(base.thinking)}${event.delta || ''}` }
  if (event.type === 'content') return { ...base, status: 'streaming', output: `${readString(base.output)}${event.delta || ''}` }
  if (event.type === 'tool') return { ...base, status: 'streaming', events: [...(Array.isArray(base.events) ? base.events : []), event] }
  if (event.type === 'error') return { ...base, ok: false, status: 'error', code: event.code, message: event.message || 'Stream failed' }
  if (event.type === 'done') {
    return {
      ...base,
      ok: true,
      status: 'success',
      output: event.output ?? readString(base.output),
      thinking: event.thinking ?? readString(base.thinking),
      durationMs: event.durationMs,
      toolRounds: event.toolRounds,
      toolCallCount: event.toolCallCount,
    }
  }
  return base
}

function PromptTestResultCard({ t, response }: { t: WorkbenchCopy; response: Record<string, unknown> }) {
  const ok = response.ok === true
  const output = typeof response.output === 'string' ? response.output : ''
  const thinking = typeof response.thinking === 'string' ? response.thinking : ''
  const message = typeof response.message === 'string' ? response.message : ''
  const code = typeof response.code === 'string' ? response.code : ''
  const status = typeof response.status === 'string' ? response.status : ''
  const outputType = typeof response.outputType === 'string' ? response.outputType : ''
  const toolEvents = Array.isArray(response.events) ? response.events.filter(isRecord) : []
  const images = readPromptTestImages(response.images)
  const [previewImage, setPreviewImage] = useState<(PromptTestImage & { index: number }) | null>(null)
  const requestPreview = isRecord(response.requestPreview) ? response.requestPreview : null

  return (
    <div className={cn('mt-3 rounded-md border bg-white p-3 text-xs', ok ? 'border-emerald-200' : 'border-red-200')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn('font-black', ok ? 'text-emerald-700' : 'text-red-700')}>
          {status === 'loading' || status === 'streaming' ? t.runningAgent : ok ? t.agentRunSuccess : t.agentRunFailed}
        </span>
        {response.durationMs ? <span className="text-slate-400">{t.duration}: {String(response.durationMs)}ms</span> : null}
      </div>
      {status === 'loading' && outputType === 'image' ? (
        <div className="mb-3 grid min-h-40 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs font-black text-slate-500">
          <RefreshCw className="mb-2 h-5 w-5 animate-spin text-[#d95a1b]" />
          {t.generatingImage}
        </div>
      ) : null}
      {images.length ? (
        <div className="mb-3">
          <div className="text-[11px] font-black uppercase text-slate-500">{t.generatedImages}</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {images.map((image, index) => {
              const alt = image.revisedPrompt || `${t.generatedImages} ${index + 1}`
              const downloadName = getPromptTestImageDownloadName(image.src, index)

              return (
                <div key={`${image.src}-${index}`} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in"
                    title={t.previewImage}
                    aria-label={`${t.previewImage}: ${downloadName}`}
                    onClick={() => setPreviewImage({ ...image, index })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="aspect-square w-full object-contain" src={image.src} alt={alt} />
                  </button>
                  <a
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-white/70 bg-white/90 text-slate-700 opacity-0 shadow-sm transition hover:bg-white hover:text-[#d95a1b] group-hover:opacity-100 focus:opacity-100"
                    href={image.src}
                    download={downloadName}
                    title={t.downloadImage}
                    aria-label={`${t.downloadImage}: ${downloadName}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  {image.revisedPrompt ? <span className="block border-t border-slate-200 p-2 text-[11px] leading-4 text-slate-600">{image.revisedPrompt}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {thinking ? (
        <div className="mb-3">
          <div className="text-[11px] font-black uppercase text-slate-500">{t.thinkingOutput}</div>
          <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">{thinking}</pre>
        </div>
      ) : null}
      {toolEvents.length ? (
        <div className="mb-3">
          <div className="text-[11px] font-black uppercase text-slate-500">{t.toolEvents}</div>
          <div className="mt-2 space-y-1">
            {toolEvents.map((event, index) => (
              <div key={index} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600">
                {readString(event.toolName || event.message || event.status || event.type)}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {!ok && status === 'error' && (message || code) ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <div className="font-black">{t.runFailedReason}</div>
          <div className="mt-1 whitespace-pre-wrap break-words">{[code, message].filter(Boolean).join(': ')}</div>
        </div>
      ) : null}
      <div className="text-[11px] font-black uppercase text-slate-500">{images.length ? t.requestPreview : t.assistantOutput}</div>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] leading-5 text-slate-700">
        {images.length && requestPreview ? JSON.stringify(requestPreview, null, 2) : output || message || JSON.stringify(response, null, 2)}
      </pre>
      {previewImage ? createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={() => setPreviewImage(null)}>
          <div className="absolute right-4 top-4 flex gap-2">
            <a
              className="grid h-9 w-9 place-items-center rounded-md border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              href={previewImage.src}
              download={getPromptTestImageDownloadName(previewImage.src, previewImage.index)}
              title={t.downloadImage}
              aria-label={t.downloadImage}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-md border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              title={t.close}
              aria-label={t.close}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[88vh] max-w-[92vw]" onMouseDown={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="max-h-[82vh] max-w-[92vw] rounded-lg bg-white object-contain shadow-2xl" src={previewImage.src} alt={previewImage.revisedPrompt || `${t.generatedImages} ${previewImage.index + 1}`} />
            {previewImage.revisedPrompt ? (
              <p className="mt-3 max-w-[92vw] rounded-md bg-white/95 p-3 text-xs leading-5 text-slate-700 shadow-xl">{previewImage.revisedPrompt}</p>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

type PromptTestImage = { src: string; revisedPrompt?: string }

function readPromptTestImages(value: unknown): PromptTestImage[] {
  const source = Array.isArray(value) ? value : []
  return source.flatMap((item): PromptTestImage[] => {
    if (!isRecord(item)) return []
    const src = readString(item.src || item.url || item.dataUrl)
    if (!src) return []
    const revisedPrompt = readString(item.revisedPrompt)
    return [{ src, ...(revisedPrompt ? { revisedPrompt } : {}) }]
  })
}

function getPromptTestImageDownloadName(src: string, index: number) {
  return `generated-image-${index + 1}.${inferPromptTestImageExtension(src)}`
}

function inferPromptTestImageExtension(src: string) {
  const dataMatch = /^data:image\/([a-zA-Z0-9.+-]+)[;,]/.exec(src)
  if (dataMatch) return normalizeImageExtension(dataMatch[1])

  try {
    const pathname = new URL(src).pathname
    const extension = pathname.split('.').pop() || ''
    return normalizeImageExtension(extension)
  } catch {
    return 'png'
  }
}

function normalizeImageExtension(value: string) {
  const normalized = value.toLowerCase().replace(/^x-/, '').split('+')[0]
  if (normalized === 'jpeg') return 'jpg'
  if (normalized === 'jpg' || normalized === 'png' || normalized === 'webp' || normalized === 'gif') return normalized
  return 'png'
}

function TestMediaUploadControl({
  t,
  variable,
  files,
  disabled,
  unsupportedText,
  onChange,
  onError,
}: {
  t: WorkbenchCopy
  variable: ZpmtTestVariable
  files: ZpmtTestMediaFile[]
  disabled?: boolean
  unsupportedText?: string
  onChange: (files: ZpmtTestMediaFile[]) => void
  onError: (message: string) => void
}) {
  const countLimit = getMediaVariableCountLimit(variable)
  const sizeLimit = getMediaVariableSizeLimit(variable)
  const accept = variable.mediaKind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : undefined

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selectedFiles.length) return
    if (selectedFiles.length > countLimit) {
      onError(`${t.mediaCountExceeded} (${countLimit})`)
      return
    }
    if (variable.mediaKind === 'image' && selectedFiles.some((file) => !file.type.startsWith('image/'))) {
      onError(t.mediaInvalidType)
      return
    }
    const oversized = selectedFiles.find((file) => file.size > sizeLimit)
    if (oversized) {
      onError(`${t.mediaTooLarge}: ${oversized.name} (${formatBytes(oversized.size)} > ${formatBytes(sizeLimit)})`)
      return
    }

    try {
      const nextFiles = await Promise.all(selectedFiles.map(readTestMediaFile))
      onChange(nextFiles)
    } catch {
      onError(t.mediaReadFailed)
    }
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#ffd8c4] bg-[#fff8f4] px-2 text-[11px] font-black text-[#b94712] transition hover:bg-[#fff2ea]',
            disabled && 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100',
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          {files.length ? t.replaceMedia : t.uploadMedia}
          <input
            className="sr-only"
            type="file"
            accept={accept}
            multiple={countLimit > 1}
            disabled={disabled}
            onChange={(event) => void handleFilesSelected(event)}
          />
        </label>
        <span className="text-[11px] font-semibold text-slate-400">
          {unsupportedText || `${t.mediaUploadHint} ${formatBytes(sizeLimit)} / ${countLimit}`}
        </span>
      </div>

      {files.length ? (
        <div className="mt-2 space-y-1.5">
          {files.map((file, index) => (
            <div key={`${file.filename}-${index}`} className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">
                {file.filename}
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-slate-400">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                title={t.removeMedia}
                onClick={() => onChange(files.filter((_, currentIndex) => currentIndex !== index))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function readTestMediaFile(file: File): Promise<ZpmtTestMediaFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('FileReader result is not a data URL'))
        return
      }
      resolve({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: reader.result,
      })
    }
    reader.readAsDataURL(file)
  })
}

function collectZpmtTestVariables(
  document: ZpmtDocument,
  t: WorkbenchCopy,
  locale: Locale,
  promptSurface?: AiModelPromptSurface | null,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
): ZpmtTestVariable[] {
  const variables = new Map<string, ZpmtTestVariable>()
  for (const tokenRange of findZpmtDocumentPromptTokenRanges(document, promptSurface)) {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed) continue
    if (parsed.tokenType === 'const') continue
    const params = getPromptTokenParamMap(parsed.params)
    const key = getZpmtTestVariableKey(tokenRange.token)
    if (!key || variables.has(key)) continue
    const isRecipe = parsed.tokenType === 'recipe'
    const typeLabel = parsed.variableType
      ? t.variableTypes[parsed.variableType]
      : isRecipe
        ? t.recipeVariableLabel
        : parsed.tokenType
    const sourceId = params.source || ''
    const recipeItem = isRecipe ? findRecipeVariableItemById(sourceId, categories) : null
    const recipeSnapshot = isRecipe ? findRecipeVariableSnapshot(document.metadata, parsed.name, sourceId) : null
    const recipeDefaultValues = isRecipe
      ? parsePromptTestRecipeValues(params.default || '').length
        ? parsePromptTestRecipeValues(params.default || '')
        : recipeItem?.defaultValues?.length
          ? recipeItem.defaultValues
          : recipeSnapshot?.defaultValues || []
      : []
    const source = isRecipe ? resolveRecipeVariableSourceLabel(sourceId, categories, document.metadata, locale) || params.source : ''
    variables.set(key, {
      key,
      token: tokenRange.token,
      name: parsed.name,
      label: parsed.name,
      typeLabel,
      variableType: parsed.variableType,
      mediaKind: parsed.variableType === 'image' ? 'image' : parsed.variableType === 'file' ? 'file' : undefined,
      defaultValue: isRecipe ? recipeDefaultValues.join(', ') : params.default || '',
      source: source && source !== parsed.name ? source : '',
      recipe: isRecipe
        ? {
            candidates: recipeItem?.candidates[locale] || recipeSnapshot?.candidates[locale] || [],
            defaultValues: recipeDefaultValues,
            multiple: recipeItem?.multiple ?? recipeSnapshot?.multiple ?? params.multi === 'true',
          }
        : undefined,
    })
  }
  return [...variables.values()]
}

function findZpmtDocumentPromptTokenRanges(document: ZpmtDocument, promptSurface?: AiModelPromptSurface | null) {
  const includeNegativePrompt = document.kind !== 'image' || promptSurface?.kind !== 'image-prompt' || promptSurface.negativePrompt
  const texts =
    document.kind === 'image'
      ? [document.prompt, includeNegativePrompt ? document.negativePrompt : '', getZpmtStyleText(document.style)]
      : [document.system, document.user]
  return texts.flatMap(findPromptTokenRanges)
}

function renderZpmtPromptForTest(text: string, values: Record<string, string>) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtTestVariableKey(token)
    if (!key) return token
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    return values[key] ?? params.default ?? ''
  })
}

function renderZpmtPromptPreview(text: string, values: Record<string, string>, mediaValues: Record<string, ZpmtTestMediaFile[]>) {
  return text.replace(/\{\{[^{}\n]+\}\}/g, (token) => {
    const parsed = parsePromptToken(token)
    if (parsed?.tokenType === 'const') return resolveZpmtConstantValue(parsed)
    const key = getZpmtTestVariableKey(token)
    if (!key) return token
    const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
    if (parsed?.variableType === 'image' || parsed?.variableType === 'file') {
      const files = mediaValues[key] || []
      if (!files.length) return `[${params.default || '未上传'}]`
      return files.map((file, index) => `[${createMediaAlias(parsed.name, index, file.filename)}]`).join('\n')
    }
    return values[key] ?? params.default ?? ''
  })
}

function buildZpmtRenderedPromptPreview(document: ZpmtDocument, values: Record<string, string>, mediaValues: Record<string, ZpmtTestMediaFile[]>, promptSurface?: AiModelPromptSurface | null) {
  if (document.kind === 'image') {
    const includeNegativePrompt = promptSurface?.kind !== 'image-prompt' || promptSurface.negativePrompt
    const renderedStyle = renderZpmtPromptPreview(getZpmtStyleText(document.style), values, mediaValues)
    return [
      `Prompt:\n${renderZpmtPromptPreview(document.prompt, values, mediaValues)}`,
      includeNegativePrompt && document.negativePrompt.trim() ? `Negative Prompt:\n${renderZpmtPromptPreview(document.negativePrompt, values, mediaValues)}` : '',
      renderedStyle.trim() ? `Style:\n${renderedStyle}` : '',
      `Params:\n${JSON.stringify(document.config.responseConfig, null, 2)}`,
    ].filter(Boolean).join('\n\n')
  }

  const renderedSystem = renderZpmtPromptForTest(document.system, values)
  const renderedUser = renderZpmtPromptPreview(document.user, values, mediaValues)
  return [renderedSystem, renderedUser].filter(Boolean).join('\n\n')
}

function resolveZpmtConstantValue(parsed: { name: string; params: string[] }) {
  const params = getPromptTokenParamMap(parsed.params)
  const kind = params.kind || parsed.name
  const now = new Date()
  if (kind === 'today') return now.toLocaleDateString('zh-CN')
  if (kind === 'time') return now.toLocaleTimeString('zh-CN', { hour12: false })
  if (kind === 'weekday') return now.toLocaleDateString('zh-CN', { weekday: 'long' })
  if (kind === 'iso') return now.toISOString()
  if (kind === 'timestamp') return String(now.getTime())
  if (kind === 'uuid') return globalThis.crypto?.randomUUID?.() || createShortRandomId()
  if (kind === 'shortId') return createShortRandomId()
  return now.toLocaleString('zh-CN', { hour12: false })
}

function createShortRandomId() {
  return Math.random().toString(36).slice(2, 10)
}

function getZpmtTestVariableKey(token: string) {
  const parsed = parsePromptToken(token)
  if (!parsed) return ''
  if (parsed.tokenType === 'const') return ''
  const params = getPromptTokenParamMap(parsed.params)
  return `${parsed.tokenType}:${parsed.name}:${params.source || ''}`
}

function createMediaAlias(variableName: string, index: number, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload'
  return `${variableName}_${index + 1}_${safeName}`
}

function getMediaVariableCountLimit(variable: ZpmtTestVariable) {
  const parsed = parsePromptToken(variable.token)
  const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
  const raw = variable.mediaKind === 'image' ? String(params.count || '') : ''
  const match = raw.match(/\d+/)
  const parsedCount = match ? Number(match[0]) : 1
  return Number.isFinite(parsedCount) ? Math.max(1, Math.min(20, Math.round(parsedCount))) : 1
}

function getMediaVariableSizeLimit(variable: ZpmtTestVariable) {
  const parsed = parsePromptToken(variable.token)
  const params = parsed ? getPromptTokenParamMap(parsed.params) : {}
  return parseByteSize(String(params.size || '')) || 10 * 1024 * 1024
}

function parseByteSize(value: string) {
  const match = /^\s*(?:[<>=~\s]*)?(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(value)
  if (!match) return 0
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const unit = (match[2] || 'b').toLowerCase()
  if (unit === 'gb') return Math.round(amount * 1024 * 1024 * 1024)
  if (unit === 'mb') return Math.round(amount * 1024 * 1024)
  if (unit === 'kb') return Math.round(amount * 1024)
  return Math.round(amount)
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

function PromptTemplatesPanel({
  t,
  locale,
  document,
  onApplyTemplate,
}: {
  t: WorkbenchCopy
  locale: Locale
  document: ZpmtDocument | null
  onApplyTemplate: (template: PromptTemplateDefinition) => void
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const templates = useMemo(() => {
    if (!document) return []
    return PROMPT_TEMPLATES.filter((template) => template.kind === document.kind)
  }, [document?.kind])
  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, { id: string; name: LocalizedText; templates: PromptTemplateDefinition[] }>()
    for (const template of templates) {
      const searchable = [
        template.categoryName.zh,
        template.categoryName.en,
        template.name.zh,
        template.name.en,
        template.description.zh,
        template.description.en,
        template.preview.zh,
        template.preview.en,
      ].join(' ').toLocaleLowerCase()
      if (normalizedSearch && !searchable.includes(normalizedSearch)) continue
      const current = groups.get(template.categoryId) || { id: template.categoryId, name: template.categoryName, templates: [] }
      current.templates.push(template)
      groups.set(template.categoryId, current)
    }
    return [...groups.values()]
  }, [normalizedSearch, templates])

  if (!document) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
        {t.promptTemplateNoFile}
      </div>
    )
  }

  function applyTemplate(template: PromptTemplateDefinition) {
    if (!window.confirm(t.promptTemplateReplaceConfirm.replace('{name}', template.name[locale]))) return
    onApplyTemplate(template)
  }

  return (
    <section className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-7"
          value={search}
          placeholder={t.promptTemplateSearch}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="space-y-2.5">
        {groupedTemplates.length ? (
          groupedTemplates.map((group) => {
            const open = normalizedSearch.length > 0 || expanded[group.id] !== false
            return (
              <section key={group.id} className="rounded-md border border-slate-200 bg-white">
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                  aria-expanded={open}
                  onClick={() => setExpanded((current) => ({ ...current, [group.id]: !open }))}
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-slate-900">{group.name[locale]}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{t.promptTemplatePreview}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {group.templates.length}
                  </Badge>
                </button>

                {open ? (
                  <div className="space-y-2 border-t border-slate-100 p-2.5">
                    {group.templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="block w-full rounded-md border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-[#FB7E3D]/45 hover:bg-[#fff8f4] focus:outline-none focus:ring-2 focus:ring-[#FB7E3D]/20"
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-slate-950">{template.name[locale]}</p>
                            <p className="mt-1 text-[11px] leading-4 text-slate-600">{template.description[locale]}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 bg-white">
                            {t.promptTemplateApply}
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{template.preview[locale]}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-slate-500">
            {t.promptTemplateEmpty}
          </div>
        )}
      </div>
    </section>
  )
}

function InspectorPanel({
  t,
  locale,
  recipeVariableCategories,
  modelCapabilities,
  activeDocument,
  onApplyTemplate,
}: {
  t: WorkbenchCopy
  locale: Locale
  recipeVariableCategories: RecipeVariableCategory[]
  modelCapabilities: ZpmtModelCapabilityGate
  activeDocument: ZpmtDocument | null
  onApplyTemplate: (template: PromptTemplateDefinition) => void
}) {
  const { supportsTools } = modelCapabilities

  return (
    <Tabs defaultValue="variables" className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200">
        <TabsList className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="variables" className="px-2">{t.inspectorTabs[0]}</TabsTrigger>
          <TabsTrigger value="recipe" className="px-2">{t.inspectorTabs[1]}</TabsTrigger>
          <TabsTrigger value="templates" className="px-2">{t.inspectorTabs[2]}</TabsTrigger>
          <TabsTrigger value="tools" className={cn('px-2', !supportsTools && 'text-slate-400')}>{t.inspectorTabs[3]}</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" className="mr-1 shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
      <TabsContent value="variables" className="min-h-0 flex-1 overflow-auto">
        <VariableTagsPanel t={t} locale={locale} modelCapabilities={modelCapabilities} />
      </TabsContent>
      <TabsContent value="recipe" className="min-h-0 flex-1 overflow-auto p-3">
        <RecipeVariablesPanel t={t} locale={locale} categories={recipeVariableCategories} />
      </TabsContent>
      <TabsContent value="templates" className="min-h-0 flex-1 overflow-auto p-3">
        <PromptTemplatesPanel t={t} locale={locale} document={activeDocument} onApplyTemplate={onApplyTemplate} />
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [sessionAdmin, setSessionAdmin] = useState<AdminSession | null>(null)
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
  const activeProjectPromptKinds = useMemo<ZflowPromptKindByPath>(() => {
    const nodes = buildProjectTreeNodeByPath(activeProject?.tree)
    return Object.fromEntries(Object.entries(nodes).map(([path, node]) => [path, normalizeZpmtPromptKind(node.promptKind)]))
  }, [activeProject?.tree])
  const activeEditorTab = useMemo(
    () => editorTabs.find((tab) => tab.id === activeEditorTabId) || editorTabs[0] || null,
    [activeEditorTabId, editorTabs],
  )
  const activeProjectFile = activeEditorTab
    ? { projectId: activeEditorTab.projectId, path: activeEditorTab.path, name: activeEditorTab.name }
    : null
  const activeIsZflowFile = Boolean(activeEditorTab && isZflowFilePath(activeEditorTab.path))
  const activeZpmtDocument = activeEditorTab && isZpmtFilePath(activeEditorTab.path) ? parseZpmtContent(activeEditorTab.content, aiProviders) : null
  const activeZpmtModelContext = activeZpmtDocument
    ? getSelectedAiModelContext(aiProviders, activeZpmtDocument.config.providerId, activeZpmtDocument.config.model, activeZpmtDocument.config.providerFile)
    : null
  const activeZpmtPromptSurface = activeZpmtDocument
    ? resolveAiModelPromptSurface(
        activeZpmtDocument.config.outputType,
        activeZpmtModelContext?.provider.providerType,
        activeZpmtDocument.config.model,
        activeZpmtModelContext?.model,
      )
    : null
  const activeZpmtModelCapabilities = useMemo(() => getZpmtModelCapabilityGate(activeZpmtModelContext?.model), [activeZpmtModelContext?.model])
  const visibleAnnouncements = announcements.filter((announcement) => !dismissedAnnouncements.has(dismissAnnouncementKey(announcement)))
  const feedbackUrl = useMemo(() => buildFeedbackUrl(), [])
  const gridMaxRows = useMemo(() => calculateGridRows(workbenchHeight), [workbenchHeight])
  const renderLayout = useMemo(
    () => buildRenderableLayout(activeIsZflowFile ? createZflowWorkbenchLayout(layout, gridMaxRows) : layout, minimized),
    [activeIsZflowFile, gridMaxRows, layout, minimized],
  )
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
      .then((data: { user?: SessionUser | null; admin?: AdminSession | null } | null) => {
        if (cancelled) return
        const user = data?.user || null
        setSessionUser(user)
        setSessionAdmin(data?.admin || null)
        setSessionChecked(true)
        if (!user) redirectToLogin()
      })
      .catch(() => {
        if (cancelled) return
        setSessionUser(null)
        setSessionAdmin(null)
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

  function handleProjectEntriesMoved(projectId: string, moved: ProjectEntryMove[]) {
    if (!moved.length) return
    let nextActiveTabId = activeEditorTabId

    setEditorTabs((current) =>
      current.map((tab) => {
        if (tab.projectId !== projectId) return tab
        const operation = moved.find((item) => isPathOrDescendant(tab.path, item.oldPath))
        if (!operation) return tab
        const updatedPath = tab.path === operation.oldPath
          ? operation.nextPath
          : `${operation.nextPath}/${tab.path.slice(operation.oldPath.length + 1)}`
        const updated = {
          ...tab,
          id: buildEditorTabId(projectId, updatedPath),
          path: updatedPath,
          name: tab.path === operation.oldPath ? updatedPath.split('/').pop() || tab.name : tab.name,
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

  function changeActiveEditorContent(value: string, options: { refreshSourceControl?: boolean } = {}) {
    if (activeEditorTab?.content === value) return
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
    if (options.refreshSourceControl !== false) dispatchSourceControlRefresh()
  }

  function applyPromptTemplate(template: PromptTemplateDefinition) {
    if (!activeZpmtDocument) {
      showAppAlert(t.promptTemplateNoFile)
      return
    }

    const templateCategories = getTemplateRecipeCategories(recipeVariableCategories)
    const content = template.build({ categories: templateCategories })
    const nextDocument: ZpmtDocument = {
      ...activeZpmtDocument,
      kind: template.kind,
      system: content.system || '',
      user: content.user || '',
      prompt: content.prompt || '',
      negativePrompt: content.negativePrompt || '',
      style:
        template.kind === 'image' && content.styleText !== undefined
          ? updateZpmtStyleEditableText(activeZpmtDocument.style, content.styleText)
          : activeZpmtDocument.style,
      tools: [],
      metadata: { schemaVersion: 2, recipeVariables: [] },
    }

    changeActiveEditorContent(serializeZpmtDocument(nextDocument, aiProviders, templateCategories))
    setActiveWindow('editor')
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
            {sessionAdmin ? (
              <span className="flex h-7 items-center rounded-md border border-[#ffd8c4] bg-[#fff7f2] px-2 text-[11px] font-black text-[#d95a1b]" title={sessionAdmin.email || sessionAdmin.account || sessionAdmin.name}>
                {t.admin}
              </span>
            ) : null}
            <button
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={t.settings}
              title={t.settings}
              onClick={() => setSettingsOpen(true)}
            >
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
        id="ccks-workbench-dnd"
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
          onDragStop={(nextLayout) => {
            if (!activeIsZflowFile) commitRuntimeLayout(nextLayout as Array<Partial<GridLayoutItem> & { i: string }>)
          }}
          onResizeStop={(nextLayout) => {
            if (!activeIsZflowFile) commitRuntimeLayout(nextLayout as Array<Partial<GridLayoutItem> & { i: string }>)
          }}
        >
          <div
            key="files"
            className={!activeIsZflowFile && minimized.files ? 'is-window-minimized' : undefined}
            data-window-id="files"
            style={{ zIndex: activeWindow === 'files' ? 20 : 1 }}
          >
            <WorkbenchWindow
              id="files"
              title={workspaceActivity === 'explorer' ? t.activity.explorer : t.activity.sourceControl}
              icon={workspaceActivity === 'explorer' ? Boxes : GitBranch}
              active={activeWindow === 'files'}
              minimized={activeIsZflowFile ? false : minimized.files}
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
                onEntriesMoved={handleProjectEntriesMoved}
                onNotify={showAppAlert}
              />
            </WorkbenchWindow>
          </div>
          <div
            key="editor"
            className={!activeIsZflowFile && minimized.editor ? 'is-window-minimized' : undefined}
            data-window-id="editor"
            style={{ zIndex: activeWindow === 'editor' ? 20 : 1 }}
          >
            <WorkbenchWindow
              id="editor"
              title={t.windows.editor}
              icon={FileText}
              active={activeWindow === 'editor'}
              minimized={activeIsZflowFile ? false : minimized.editor}
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
                promptKindByPath={activeProjectPromptKinds}
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
          {!activeIsZflowFile ? (
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
                  modelCapabilities={activeZpmtModelCapabilities}
                  promptSurface={activeZpmtPromptSurface}
                  recipeVariableCategories={recipeVariableCategories}
                />
              </WorkbenchWindow>
            </div>
          ) : null}
          {!activeIsZflowFile ? (
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
                  activeDocument={activeZpmtDocument}
                  onApplyTemplate={applyPromptTemplate}
                />
              </WorkbenchWindow>
            </div>
          ) : null}
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

      {settingsOpen ? (
        <SettingsDialog
          t={t}
          theme={theme}
          locale={locale}
          isAdmin={Boolean(sessionAdmin)}
          onToggleTheme={toggleTheme}
          onToggleLocale={toggleLocale}
          onCommonProvidersChanged={async () => {
            await loadProjectConfigFiles(activeProject?.id || '')
          }}
          onClose={() => setSettingsOpen(false)}
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

function SettingsDialog({
  t,
  theme,
  locale,
  isAdmin,
  onToggleTheme,
  onToggleLocale,
  onCommonProvidersChanged,
  onClose,
}: {
  t: WorkbenchCopy
  theme: ThemeMode
  locale: Locale
  isAdmin: boolean
  onToggleTheme: () => void
  onToggleLocale: () => void
  onCommonProvidersChanged: () => Promise<void> | void
  onClose: () => void
}) {
  const [activeSection, setActiveSection] = useState<'general' | 'systemAi' | 'apiToken' | 'commonProviders'>('general')

  useEffect(() => {
    if (!isAdmin && (activeSection === 'commonProviders' || activeSection === 'systemAi')) setActiveSection('general')
  }, [activeSection, isAdmin])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const navItems = ([
    { id: 'general', label: t.settingsGeneral, description: t.settingsGeneralDesc },
    { id: 'apiToken', label: '接口 Token', description: '配置个人提示词调用接口 Token。' },
    { id: 'systemAi', label: '系统 LLM AI', description: '管理员配置随机参数和 AI 辅助使用的全局模型。', adminOnly: true },
    { id: 'commonProviders', label: t.commonProviderManagement, description: t.commonProviderManagementDesc, adminOnly: true },
  ] satisfies Array<{ id: 'general' | 'systemAi' | 'apiToken' | 'commonProviders'; label: string; description: string; adminOnly?: boolean }>).filter((item) => !item.adminOnly || isAdmin)

  const activeNavItem = navItems.find((item) => item.id === activeSection) || navItems[0]

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/35 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="mx-auto flex h-[min(760px,calc(100vh-48px))] w-[min(1100px,calc(100vw-48px))] overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.25)]"
        role="dialog"
        aria-modal="true"
        aria-label={t.settings}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
            <Settings className="h-4 w-4 text-[#d95a1b]" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-950">{t.settings}</h2>
              <p className="truncate text-[11px] font-semibold text-slate-500">{isAdmin ? t.admin : t.status.ready}</p>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-auto p-2" aria-label={t.settings}>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'mb-1 flex w-full flex-col rounded-md border px-2.5 py-2 text-left transition',
                  activeSection === item.id
                    ? 'border-[#ffd8c4] bg-[#fff2ea] text-[#9a3412]'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950',
                )}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="text-xs font-black">{item.label}</span>
                <span className="mt-0.5 line-clamp-2 text-[10px] font-semibold opacity-75">{item.description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-slate-950">
                {activeNavItem.label}
              </h3>
              <p className="truncate text-[11px] font-semibold text-slate-500">
                {activeNavItem.description}
              </p>
            </div>
            <button className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t.close} onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {activeSection === 'commonProviders' && isAdmin ? (
              <CommonAiProviderManager onChanged={onCommonProvidersChanged} />
            ) : activeSection === 'systemAi' && isAdmin ? (
              <SystemAiSettingsPanel />
            ) : activeSection === 'apiToken' ? (
              <UserApiTokenPanel />
            ) : (
              <div className="max-w-2xl rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">{theme === 'dark' ? t.themeToLight : t.themeToDark}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{theme === 'dark' ? 'Dark' : 'Light'}</p>
                    </div>
                    <Button size="sm" variant="outline" type="button" onClick={onToggleTheme}>
                      {theme === 'dark' ? t.themeToLight : t.themeToDark}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">{t.language}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{locale === 'zh' ? '中文' : 'English'}</p>
                    </div>
                    <Button size="sm" variant="outline" type="button" onClick={onToggleLocale}>
                      {locale === 'zh' ? 'English' : '中文'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

type SystemAiSettingsState = {
  providerType: string
  baseUrl: string
  apiKey: string
  hasApiKey: boolean
  models: AiProviderModel[]
  model: string
  reasoningEffort: string
  maxToolRounds: number
}

function SystemAiSettingsPanel() {
  const [form, setForm] = useState<SystemAiSettingsState>({
    providerType: 'custom',
    baseUrl: '',
    apiKey: '',
    hasApiKey: false,
    models: [],
    model: '',
    reasoningEffort: 'auto',
    maxToolRounds: 5,
  })
  const [loading, setLoading] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadSetting()
  }, [])

  async function loadSetting() {
    setLoading(true)
    setMessage('')
    const response = await fetch('/api/system-ai-settings')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setLoading(false))
    if (!response?.ok) {
      setMessage(response?.message || '系统 AI 设置加载失败')
      return
    }
    const setting = response.setting || {}
    setForm({
      providerType: setting.providerType || 'custom',
      baseUrl: setting.baseUrl || '',
      apiKey: '',
      hasApiKey: Boolean(setting.hasApiKey),
      models: Array.isArray(setting.models) ? setting.models : [],
      model: setting.model || '',
      reasoningEffort: setting.reasoningEffort || 'auto',
      maxToolRounds: Number.isFinite(setting.maxToolRounds) ? setting.maxToolRounds : 5,
    })
  }

  function applySystemAiPreset(providerType: string) {
    const preset = AI_PROVIDER_PRESETS.find((item) => item.providerType === providerType) || AI_PROVIDER_PRESETS[0]
    setForm((current) => ({
      ...current,
      providerType: preset.providerType,
      baseUrl: preset.baseUrl,
      models: [],
      model: '',
    }))
  }

  async function pullModels() {
    setPulling(true)
    setMessage('')
    const response = await fetchJson('/api/system-ai-settings/models', {
      method: 'POST',
      body: {
        providerType: form.providerType,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
      },
    }).finally(() => setPulling(false))
    if (!response?.ok || !Array.isArray(response.models)) {
      setMessage(response?.message || '模型列表获取失败')
      return
    }
    setForm((current) => ({ ...current, models: response.models, model: response.models[0]?.id || '' }))
  }

  async function saveSetting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const response = await fetchJson('/api/system-ai-settings', {
      method: 'PATCH',
      body: {
        providerType: form.providerType,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models,
        model: form.model,
        reasoningEffort: form.reasoningEffort,
        maxToolRounds: form.maxToolRounds,
      },
    }).finally(() => setSaving(false))
    if (!response?.ok) {
      setMessage(response?.message || '系统 AI 设置保存失败')
      return
    }
    const setting = response.setting || {}
    setForm((current) => ({
      ...current,
      apiKey: '',
      hasApiKey: Boolean(setting.hasApiKey),
      models: Array.isArray(setting.models) ? setting.models : current.models,
      model: setting.model || current.model,
    }))
    setMessage('系统 AI 设置已保存')
  }

  return (
    <div className="max-w-4xl">
      <form className="rounded-md border border-slate-200 bg-white p-3" onSubmit={saveSetting}>
        <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Bot className="h-4 w-4 text-[#d95a1b]" />
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-900">系统 LLM AI</h3>
            <p className="text-[11px] font-semibold text-slate-500">用于随机字符串参数、编辑区 AI 辅助和 .zpmt 检查修复。</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            常用供应商
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={form.providerType}
              onChange={(event) => applySystemAiPreset(event.target.value)}
            >
              {AI_PROVIDER_PRESETS.map((preset) => (
                <option key={preset.providerType} value={preset.providerType}>{preset.name}</option>
              ))}
              <option value="custom">自定义</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            供应商类型
            <Input className="mt-1" value={form.providerType} onChange={(event) => setForm((current) => ({ ...current, providerType: event.target.value }))} />
          </label>
          <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
            Base URL
            <Input className="mt-1" value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value, models: [], model: '' }))} placeholder="https://api.example.com/v1" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
            API Key
            <Input className="mt-1" type="password" value={form.apiKey} onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={form.hasApiKey ? '留空则保留已保存密钥' : '填写系统 AI API Key'} />
            <span className="mt-1 block text-[11px] font-semibold text-slate-400">{form.hasApiKey ? '密钥已加密保存，普通用户不可见。' : '尚未保存系统 AI 密钥。'}</span>
          </label>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">模型</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void pullModels()} disabled={pulling || !form.baseUrl || !form.apiKey}>
                {pulling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                获取模型
              </Button>
            </div>
            <select
              className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            >
              <option value="">{loading ? '加载中...' : '请选择模型'}</option>
              {form.models.map((model) => (
                <option key={model.id} value={model.id}>{model.id}</option>
              ))}
            </select>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            思考强度
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={form.reasoningEffort}
              onChange={(event) => setForm((current) => ({ ...current, reasoningEffort: event.target.value }))}
            >
              {['auto', 'none', 'low', 'medium', 'high', 'xhigh', 'max'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            最大工具调用轮数
            <Input className="mt-1" type="number" min={0} max={20} value={String(form.maxToolRounds)} onChange={(event) => setForm((current) => ({ ...current, maxToolRounds: Math.max(0, Math.min(20, Math.round(Number(event.target.value) || 0))) }))} />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className={cn('text-[11px] font-semibold', message.includes('失败') ? 'text-red-600' : 'text-emerald-600')}>{message}</span>
          <Button type="submit" size="sm" disabled={saving || !form.baseUrl || !form.model || !form.models.length}>
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存设置
          </Button>
        </div>
      </form>
    </div>
  )
}

function UserApiTokenPanel() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [plainToken, setPlainToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadToken()
  }, [])

  async function loadToken() {
    setLoading(true)
    const response = await fetch('/api/user-api-token')
      .then((result) => result.json().catch(() => null))
      .catch(() => null)
      .finally(() => setLoading(false))
    if (!response?.ok) {
      setMessage(response?.message || '接口 Token 加载失败')
      return
    }
    setSummary(response.token || null)
  }

  async function saveToken(token?: string) {
    setMessage('')
    const response = await fetchJson('/api/user-api-token', {
      method: 'POST',
      body: token ? { token } : {},
    })
    if (!response?.ok) {
      setMessage(response?.message || '接口 Token 保存失败')
      return
    }
    setSummary(response.token || null)
    setPlainToken(response.plainToken || token || '')
    setManualToken('')
    setMessage('Token 已保存，请及时复制。')
  }

  async function deleteToken() {
    if (!window.confirm('确认撤销当前接口 Token？撤销后外部调用会立即失败。')) return
    const response = await fetch('/api/user-api-token', { method: 'DELETE' }).then((result) => result.json().catch(() => null)).catch(() => null)
    if (!response?.ok) {
      setMessage(response?.message || '接口 Token 撤销失败')
      return
    }
    setSummary(response.token || null)
    setPlainToken('')
    setMessage('Token 已撤销')
  }

  const exists = Boolean(summary?.exists)
  return (
    <div className="max-w-3xl rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
        <Code2 className="h-4 w-4 text-[#d95a1b]" />
        <div>
          <h3 className="text-xs font-black text-slate-900">个人接口 Token</h3>
          <p className="text-[11px] font-semibold text-slate-500">用于外部系统通过接口调用你自己的项目提示词。</p>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <div className="font-black text-slate-800">当前状态</div>
          <div className="mt-1 text-[11px] font-semibold text-slate-500">
            {loading ? '加载中...' : exists ? `已启用：${String(summary?.tokenMasked || '')}` : '未启用'}
          </div>
          {summary?.lastUsedAt ? <div className="mt-1 text-[11px] font-semibold text-slate-400">最后调用：{String(summary.lastUsedAt)}</div> : null}
        </div>
        {plainToken ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
            <div className="mb-1 text-[11px] font-black text-emerald-700">本次 Token 只显示一次</div>
            <div className="flex gap-2">
              <Input readOnly value={plainToken} className="bg-white text-xs" />
              <Button type="button" size="sm" variant="outline" onClick={() => void copyTextToClipboard(plainToken)}>
                <Copy className="h-3.5 w-3.5" />
                复制
              </Button>
            </div>
          </div>
        ) : null}
        <label className="block text-xs font-semibold text-slate-600">
          手动填写 Token
          <Input className="mt-1" value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="留空则点击生成随机 Token" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className={cn('text-[11px] font-semibold', message.includes('失败') ? 'text-red-600' : 'text-emerald-600')}>{message}</span>
          <div className="flex gap-2">
            {exists ? <Button type="button" size="sm" variant="outline" onClick={() => void deleteToken()}><Trash2 className="h-3.5 w-3.5" />撤销</Button> : null}
            <Button type="button" size="sm" variant="outline" onClick={() => void saveToken(manualToken.trim())}><Save className="h-3.5 w-3.5" />保存填写</Button>
            <Button type="button" size="sm" onClick={() => void saveToken()}><RefreshCw className="h-3.5 w-3.5" />生成随机</Button>
          </div>
        </div>
      </div>
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

function flattenProjectTreePaths(tree?: TreeNode | null) {
  const paths: string[] = []
  function visit(node?: TreeNode | null) {
    if (!node) return
    if (node.path) paths.push(node.path)
    node.children?.forEach(visit)
  }
  visit(tree)
  return paths
}

function buildProjectTreeNodeByPath(tree?: TreeNode | null) {
  const nodes: Record<string, TreeNode> = {}
  function visit(node?: TreeNode | null) {
    if (!node) return
    if (node.path) nodes[node.path] = node
    node.children?.forEach(visit)
  }
  visit(tree)
  return nodes
}

function uniqueProjectPaths(paths: string[]) {
  return [...new Set(paths.map((item) => item.trim()).filter(Boolean))]
}

function selectProjectPathRange(paths: string[], anchor: string, target: string, current: string[]) {
  const anchorIndex = paths.indexOf(anchor)
  const targetIndex = paths.indexOf(target)
  if (anchorIndex < 0 || targetIndex < 0) return uniqueProjectPaths([...current, target])
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return paths.slice(start, end + 1)
}

function hasProjectEntryDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types || []).includes(PROJECT_ENTRY_DRAG_MIME)
}

function hasZpmtFileDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types || []).includes(ZPMT_FILE_DRAG_MIME)
}

function hasExternalFileDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types || []).includes('Files')
}

function readProjectEntryDragPayload(dataTransfer: DataTransfer): ProjectEntryDragPayload | null {
  const raw = dataTransfer.getData(PROJECT_ENTRY_DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ProjectEntryDragPayload
    if (parsed?.kind === 'project-entry' && typeof parsed.projectId === 'string' && Array.isArray(parsed.paths)) {
      return {
        kind: 'project-entry',
        projectId: parsed.projectId,
        paths: uniqueProjectPaths(parsed.paths.filter((item): item is string => typeof item === 'string')),
      }
    }
  } catch {
    return null
  }
  return null
}

function readZpmtFileDragPayload(dataTransfer: DataTransfer): ZpmtFileDragPayload | null {
  const raw = dataTransfer.getData(ZPMT_FILE_DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.kind !== 'zpmt-files' || typeof parsed.projectId !== 'string') return null
    const rawFiles = Array.isArray(parsed.files)
      ? parsed.files
      : Array.isArray(parsed.paths)
        ? parsed.paths.map((path) => ({ path }))
        : []
    const seen = new Set<string>()
    const files = rawFiles.flatMap((item): ZpmtFileDragEntry[] => {
      const source: Record<string, unknown> = isRecord(item) ? item : { path: item }
      const path = readString(source.path)
      if (!isZpmtFilePath(path) || seen.has(path)) return []
      seen.add(path)
      return [{ path, promptKind: normalizeZpmtPromptKind(source.promptKind) }]
    })
    if (files.length) {
      return { kind: 'zpmt-files', projectId: parsed.projectId, files, paths: files.map((file) => file.path) }
    }
  } catch {
    return null
  }
  return null
}

async function readDroppedProjectFiles(dataTransfer: DataTransfer): Promise<ProjectUploadEntry[]> {
  const entries: ProjectUploadEntry[] = []
  const items = Array.from(dataTransfer.items || [])
  for (const item of items) {
    if (item.kind !== 'file') continue
    const browserEntry = (item as DataTransferItem & { webkitGetAsEntry?: () => BrowserFileSystemEntry | null }).webkitGetAsEntry?.()
    if (browserEntry) {
      entries.push(...await readBrowserFileSystemEntry(browserEntry, ''))
      continue
    }
    const file = item.getAsFile()
    if (file) entries.push({ file, relativePath: normalizeBrowserRelativePath(file.webkitRelativePath || file.name) })
  }
  if (entries.length) return entries.filter((item) => item.relativePath)

  return Array.from(dataTransfer.files || [])
    .map((file) => ({ file, relativePath: normalizeBrowserRelativePath(file.webkitRelativePath || file.name) }))
    .filter((item) => item.relativePath)
}

async function readBrowserFileSystemEntry(entry: BrowserFileSystemEntry, parentPath: string): Promise<ProjectUploadEntry[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file?.(resolve, reject)
    })
    return [{ file, relativePath: normalizeBrowserRelativePath(`${parentPath}${entry.name || file.name}`) }].filter((item) => item.relativePath)
  }

  if (!entry.isDirectory || !entry.createReader) return []
  const reader = entry.createReader()
  const children = await readAllBrowserDirectoryEntries(reader)
  const nextParent = `${parentPath}${entry.name}/`
  const files: ProjectUploadEntry[] = []
  for (const child of children) {
    files.push(...await readBrowserFileSystemEntry(child, nextParent))
  }
  return files
}

async function readAllBrowserDirectoryEntries(reader: ReturnType<NonNullable<BrowserFileSystemEntry['createReader']>>) {
  const entries: BrowserFileSystemEntry[] = []
  while (true) {
    const batch = await new Promise<BrowserFileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (!batch.length) break
    entries.push(...batch)
  }
  return entries
}

function normalizeBrowserRelativePath(value: string) {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
  if (!normalized) return ''
  const segments = normalized.split('/').filter(Boolean)
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) return ''
  return segments.join('/')
}

function normalizeProjectConflicts(value: unknown[]): ProjectEntryConflict[] {
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const pathValue = readString(item.path)
    const targetPath = readString(item.targetPath)
    return pathValue || targetPath ? [{ path: pathValue, targetPath }] : []
  })
}

function normalizeProjectMoves(value: unknown[]): ProjectEntryMove[] {
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const oldPath = readString(item.oldPath)
    const nextPath = readString(item.nextPath)
    return oldPath && nextPath ? [{ oldPath, nextPath }] : []
  })
}

function buildProjectArchiveUrl(projectId: string, paths: string[], raw = false) {
  const query = new URLSearchParams({ projectId })
  for (const item of uniqueProjectPaths(paths)) query.append('paths', item)
  if (raw) query.set('raw', '1')
  const path = `/api/projects/archive?${query.toString()}`
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`
}

function buildProjectDragDownloadName(projectFileName: string, node: TreeNode, paths: string[], rawDownload: boolean) {
  if (rawDownload) return node.name || paths[0]?.split('/').pop() || 'download'
  return paths.length > 1 ? `${projectFileName}-selection.zip` : `${node.name || projectFileName}.zip`
}

function readDownloadFilename(contentDisposition: string | null) {
  if (!contentDisposition) return ''
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }
  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return asciiMatch?.[1] || ''
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || 'download'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function deriveProjectFileNameFromZip(value: string) {
  const base = value
    .replace(/\.zip$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const normalized = /^[a-z]/.test(base) ? base : `p-${base || 'imported-project'}`
  return normalized.slice(0, 64).replace(/-+$/g, '') || 'imported-project'
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

function ensureZflowFileName(value: string) {
  const normalized = value.trim()
  if (!normalized) return 'flow.zflow'
  return /\.zflow$/i.test(normalized) ? normalized : `${normalized.replace(/\.[a-z0-9]+$/i, '')}.zflow`
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

function createZflowTemplate(fileName: string) {
  const title = fileName.replace(/\.zflow$/i, '') || '提示词流程'
  return serializeZflowDocument(createDefaultZflowDocument(title))
}

function createDefaultZflowDocument(title = '提示词流程'): ZflowDocument {
  const nodes: ZflowNode[] = [
    createDefaultZflowStartNode({ x: 60, y: 120 }, `${title}：${UI_COPY.zh.zflowStartNodeDescription}`),
    createDefaultZflowNode('prompt', 'prompt-1', { x: 325, y: 120 }, '引用 .zpmt 文件并绑定输入变量。'),
    createDefaultZflowNode('end', 'end', { x: 590, y: 120 }, '输出最终结果。'),
  ]
  const edges: ZflowEdge[] = [
    { id: 'start-out-prompt-1-in', source: ZFLOW_START_NODE_ID, sourceHandle: 'out', target: 'prompt-1', targetHandle: 'in', type: 'smoothstep' },
    { id: 'prompt-1-out-end-in', source: 'prompt-1', sourceHandle: 'out', target: 'end', targetHandle: 'in', type: 'smoothstep' },
  ]

  return {
    schema: ZFLOW_SCHEMA,
    version: 1,
    nodes,
    edges,
    viewport: { x: 70, y: 80, zoom: 0.82 },
  }
}

function createDefaultZflowStartNode(position: { x: number; y: number }, description = UI_COPY.zh.zflowStartNodeDescription, outputs: ZflowNodePort[] = getDefaultZflowStartOutputs('zh')): ZflowNode {
  return {
    id: ZFLOW_START_NODE_ID,
    type: 'zflow',
    position,
    data: {
      label: UI_COPY.zh.zflowStartNode,
      description,
      category: 'start',
      nodeType: ZFLOW_START_NODE_TYPE,
      kind: ZFLOW_START_NODE_TYPE,
      icon: 'play',
      runtime: 'start',
      inputPorts: [],
      outputPorts: [ZFLOW_START_FLOW_PORT],
      outputData: outputs.map((port) => ({
        ...port,
        valueType: normalizeZflowStartOutputType(port.valueType),
      })),
      config: {},
    },
  }
}

function createDefaultZflowNode(templateId: string, id: string, position: { x: number; y: number }, description: string): ZflowNode {
  const template = getZflowNodeTemplateById(templateId) || ZFLOW_NODE_TEMPLATES[0]
  const outputData = getDefaultZflowOutputDataForNode({ id, type: 'zflow', position, data: { label: localizeZflowText(template.label, 'zh'), nodeType: template.id, kind: template.id, category: template.category, config: cloneZflowConfig(template.config) } } as ZflowNode, 'zh')
  return {
    id,
    type: 'zflow',
    position,
    data: {
      label: localizeZflowText(template.label, 'zh'),
      description,
      category: template.category,
      nodeType: template.id,
      kind: template.id,
      icon: template.iconName,
      runtime: template.runtime,
      inputPorts: localizeZflowTemplatePorts(template.inputs, 'zh'),
      outputPorts: localizeZflowTemplatePorts(template.outputs, 'zh'),
      ...(outputData.length ? { outputData } : {}),
      config: cloneZflowConfig(template.config),
    },
  }
}

function createZpmtContent(input: {
  promptKind: ZpmtPromptKind
  outputType: ZpmtOutputType
  provider: AiProviderSummary | null
  model: string
  responseConfig: ZpmtResponseConfig
}) {
  const modelEntry = input.provider?.models.find((model) => model.id === input.model) || null
  const outputType = input.promptKind === 'image' ? 'image' : 'text'
  return serializeZpmtDocument(
    {
      schema: 'ccks.zpmt',
      version: 3,
      kind: input.promptKind,
      config: {
        outputType,
        providerFile: input.provider?.filePath || '',
        providerId: input.provider?.id || '',
        providerName: input.provider?.name || '',
        model: input.model,
        responseConfig: normalizeResponseConfig(outputType, input.responseConfig, input.provider?.providerType, input.model, modelEntry),
      },
      system: input.promptKind === 'agent' ? '\n' : '',
      user: '',
      prompt: '',
      negativePrompt: '',
      style: createDefaultZpmtImageStyle(resolveAiModelPromptSurface(outputType, input.provider?.providerType, input.model, modelEntry)),
      tools: [],
      metadata: { schemaVersion: 2, recipeVariables: [] },
    },
    input.provider ? [input.provider] : [],
  )
}

function isZpmtFilePath(filePath: string) {
  return filePath.toLowerCase().endsWith('.zpmt')
}

function isZflowFilePath(filePath: string) {
  return filePath.toLowerCase().endsWith('.zflow')
}

function parseZflowContent(content: string): ProjectConfigParseResult<ZflowDocument> {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!isRecord(parsed)) return { ok: false, message: '文件不是 JSON 对象' }
    const schema = readString(parsed.schema)
    if (schema !== ZFLOW_SCHEMA) return { ok: false, message: '旧版 .zflow 不再兼容，请新建 LangGraph 流程文件' }
    const normalizedNodes = Array.isArray(parsed.nodes) ? parsed.nodes.map(normalizeZflowNodeForEditor) : []
    const normalized = normalizeZflowDocumentStartNode(normalizedNodes)
    const edges = Array.isArray(parsed.edges)
      ? parsed.edges
          .map((edge, index) => normalizeZflowEdgeForEditor(migrateZflowStartEdgeSource(edge, normalized.migratedSourceIds), index, normalized.nodes))
          .filter((edge): edge is ZflowEdge => Boolean(edge))
      : []

    return {
      ok: true,
      document: {
        schema: ZFLOW_SCHEMA,
        version: Math.max(1, Math.round(readFiniteNumber(parsed.version, 1))),
        nodes: normalized.nodes,
        edges,
        viewport: normalizeZflowViewport(parsed.viewport),
      },
    }
  } catch {
    return { ok: false, message: 'JSON 解析失败' }
  }
}

function normalizeZflowDocumentStartNode(nodes: ZflowNode[]) {
  const startCandidates = nodes.filter(isZflowStartNode)
  const firstStart = startCandidates[0]
  const migratedSourceIds = new Set(startCandidates.map((node) => node.id))
  const startNode = firstStart
    ? normalizeExistingZflowStartNode(firstStart)
    : createDefaultZflowStartNode({ x: 60, y: 120 })
  const restNodes = nodes.filter((node) => !isZflowStartNode(node))
  return {
    nodes: [startNode, ...restNodes],
    migratedSourceIds,
  }
}

function normalizeExistingZflowStartNode(node: ZflowNode): ZflowNode {
  const outputData = normalizeZflowStartOutputPorts(node.data.outputData || node.data.outputs, 'zh')
  return {
    ...node,
    id: ZFLOW_START_NODE_ID,
    data: {
      ...node.data,
      label: UI_COPY.zh.zflowStartNode,
      description: readString(node.data.description) || UI_COPY.zh.zflowStartNodeDescription,
      category: 'start',
      nodeType: ZFLOW_START_NODE_TYPE,
      kind: ZFLOW_START_NODE_TYPE,
      icon: readString(node.data.icon) || 'play',
      runtime: 'start',
      inputPorts: [],
      outputPorts: [ZFLOW_START_FLOW_PORT],
      outputData: outputData.length ? outputData : getDefaultZflowStartOutputs('zh'),
      config: isRecord(node.data.config) ? node.data.config : {},
    },
  }
}

function migrateZflowStartEdgeSource(edge: unknown, migratedSourceIds: Set<string>) {
  if (!isRecord(edge)) return edge
  const source = readString(edge.source)
  if (!source || !migratedSourceIds.has(source)) return edge
  return { ...edge, source: ZFLOW_START_NODE_ID, sourceHandle: 'out' }
}

function serializeZflowDocument(document: ZflowDocument) {
  const normalized = normalizeZflowDocumentStartNode(document.nodes)
  return `${JSON.stringify(
    {
      schema: ZFLOW_SCHEMA,
      version: Math.max(2, document.version || 1),
      nodes: normalized.nodes.map(toSerializableZflowNode),
      edges: document.edges.map((edge) => toSerializableZflowEdge(migrateSerializableZflowStartEdge(edge, normalized.migratedSourceIds))),
      viewport: toSerializableZflowViewport(document.viewport),
    },
    null,
    2,
  )}\n`
}

function migrateSerializableZflowStartEdge(edge: ZflowEdge, migratedSourceIds: Set<string>): ZflowEdge {
  if (!migratedSourceIds.has(edge.source)) return edge
  return { ...edge, source: ZFLOW_START_NODE_ID, sourceHandle: 'out' }
}

function normalizeZflowNodeForEditor(value: unknown, index: number): ZflowNode {
  const source = isRecord(value) ? value : {}
  const position = isRecord(source.position) ? source.position : {}
  const data = isRecord(source.data) ? source.data : {}
  const id = readString(source.id) || `node-${index + 1}`
  const label = readString(data.label) || readString(source.label) || `节点 ${index + 1}`
  const legacyKind = readString(data.kind)
  const templateId = readString(data.nodeType) || ZFLOW_LEGACY_KIND_TEMPLATE_IDS[legacyKind] || legacyKind
  const template = getZflowNodeTemplateById(templateId)
  const category = normalizeZflowNodeCategory(readString(data.category) || template?.category || legacyKind)
  const runtime = normalizeZflowRuntime(readString(data.runtime), template?.runtime || (category === 'start' ? 'start' : category === 'control' ? 'branch' : 'transform'))
  const width = readPositiveFiniteNumber(source.width, ZFLOW_NODE_WIDTH)
  const height = readPositiveFiniteNumber(source.height, ZFLOW_NODE_HEIGHT)
  return {
    id,
    type: 'zflow',
    position: {
      x: readFiniteNumber(position.x, 80 + index * 220),
      y: readFiniteNumber(position.y, 80),
    },
    width,
    height,
    initialWidth: readPositiveFiniteNumber(source.initialWidth, width),
    initialHeight: readPositiveFiniteNumber(source.initialHeight, height),
    data: {
      ...data,
      label: category === 'start' ? UI_COPY.zh.zflowStartNode : label,
      description: readString(data.description),
      category,
      nodeType: category === 'start' ? ZFLOW_START_NODE_TYPE : readString(data.nodeType) || template?.id || legacyKind || category,
      kind: category === 'start' ? ZFLOW_START_NODE_TYPE : readString(data.kind) || template?.id || category,
      icon: readString(data.icon) || template?.iconName || getDefaultZflowIconNameForCategory(category),
      runtime,
      inputPorts: normalizeZflowPortsPreservingEmpty(
        Array.isArray(data.inputPorts) ? data.inputPorts : data.inputs,
        template ? localizeZflowTemplatePorts(template.inputs, 'zh') : category === 'start' ? [] : [{ id: 'in', label: '输入', valueType: 'any' }],
      ),
      outputPorts: normalizeZflowPortsPreservingEmpty(
        Array.isArray(data.outputPorts) ? data.outputPorts : category === 'start' ? [ZFLOW_START_FLOW_PORT] : data.outputs,
        template ? localizeZflowTemplatePorts(template.outputs, 'zh') : category === 'start' ? [ZFLOW_START_FLOW_PORT] : [{ id: 'out', label: '输出', valueType: 'any' }],
      ),
      outputData: normalizeZflowNodeOutputData({
        id,
        type: 'zflow',
        position: {
          x: readFiniteNumber(position.x, 80 + index * 220),
          y: readFiniteNumber(position.y, 80),
        },
        data: {
          ...data,
          category,
          nodeType: category === 'start' ? ZFLOW_START_NODE_TYPE : readString(data.nodeType) || template?.id || legacyKind || category,
          kind: category === 'start' ? ZFLOW_START_NODE_TYPE : readString(data.kind) || template?.id || category,
          outputData: Array.isArray(data.outputData) ? data.outputData : category === 'start' ? data.outputs : undefined,
          config: isRecord(data.config) ? data.config : cloneZflowConfig(template?.config),
        },
      } as ZflowNode, 'zh'),
      config: readString(data.nodeType) === 'router' || readString(data.kind) === 'router'
        ? writeZflowConditionConfig(data.config, readZflowConditionConfig(data.config))
        : isRecord(data.config) ? data.config : cloneZflowConfig(template?.config),
    },
  }
}

function normalizeZflowEdgeForEditor(value: unknown, index: number, nodes: ZflowNode[]): ZflowEdge | null {
  if (!isRecord(value)) return null
  const source = readString(value.source)
  const target = readString(value.target)
  if (!source || !target) return null
  const resolvedConnection = resolveZflowConnectionHandles(
    {
      source,
      target,
      sourceHandle: normalizeZflowHandleId(value.sourceHandle),
      targetHandle: normalizeZflowHandleId(value.targetHandle),
    },
    nodes,
  )
  if (!resolvedConnection) return null
  const data = isRecord(value.data) ? value.data : {}
  const label = readString(value.label)
  return {
    id: readString(value.id) || `${source}-${target}-${index + 1}`,
    source: resolvedConnection.source,
    target: resolvedConnection.target,
    sourceHandle: resolvedConnection.sourceHandle,
    targetHandle: resolvedConnection.targetHandle,
    type: readString(value.type) || 'smoothstep',
    ...(label ? { label } : {}),
    ...(Object.keys(data).length ? { data } : {}),
    animated: value.animated === true,
  }
}

function normalizeZflowViewport(value: unknown): Viewport {
  const source = isRecord(value) ? value : {}
  return {
    x: readFiniteNumber(source.x, 0),
    y: readFiniteNumber(source.y, 0),
    zoom: Math.min(2, Math.max(0.25, readFiniteNumber(source.zoom, 1))),
  }
}

function toSerializableZflowViewport(viewport: Viewport) {
  const normalized = normalizeZflowViewport(viewport)
  return {
    x: Math.round(normalized.x * 100) / 100,
    y: Math.round(normalized.y * 100) / 100,
    zoom: Math.round(normalized.zoom * 1000) / 1000,
  }
}

function toSerializableZflowNode(node: ZflowNode) {
  const category = normalizeZflowNodeCategory(node.data.category || node.data.kind)
  const nodeType = readString(node.data.nodeType) || readString(node.data.kind)
  const template = getZflowNodeTemplateById(nodeType)
  const promptKind = nodeType === 'prompt' ? normalizeZpmtPromptKind(isRecord(node.data.config) ? node.data.config.promptKind : undefined) : 'chat'
  const inputPorts = nodeType === 'prompt'
    ? [{ id: 'in', label: '输入', valueType: 'any' as ZflowPortValueType }]
    : normalizeZflowPorts(node.data.inputPorts || node.data.inputs, [])
  const outputPorts = nodeType === 'prompt' && promptKind === 'image'
    ? normalizeZflowNodePortsForDirection(node.data, 'source').map((port) => ({ ...port, valueType: 'image' as ZflowPortValueType }))
    : normalizeZflowNodePortsForDirection(node.data, 'source')
  const outputData = nodeType === 'prompt' && promptKind === 'image'
    ? [{ id: 'image', label: '图片结果', valueType: 'image' as ZflowPortValueType }]
    : normalizeZflowNodeOutputData(node, 'zh')
  const hasInputPorts = Array.isArray(node.data.inputPorts) || Array.isArray(node.data.inputs)
  const hasOutputPorts = Array.isArray(node.data.outputPorts) || Array.isArray(node.data.outputs)
  const hasOutputData = Array.isArray(node.data.outputData) || isZflowStartNode(node) || outputData.length > 0
  const config = isRecord(node.data.config) ? node.data.config : {}
  const serializableConfig = nodeType === 'prompt' && promptKind === 'image'
    ? { ...config, promptKind, outputPath: 'image' }
    : config
  return {
    id: node.id,
    type: 'zflow',
    position: {
      x: Math.round(node.position.x * 100) / 100,
      y: Math.round(node.position.y * 100) / 100,
    },
    data: {
      label: category === 'start' ? UI_COPY.zh.zflowStartNode : readString(node.data.label) || node.id,
      ...(readString(node.data.description) ? { description: readString(node.data.description) } : {}),
      category,
      nodeType: category === 'start' ? ZFLOW_START_NODE_TYPE : readString(node.data.nodeType) || template?.id || category,
      kind: category === 'start' ? ZFLOW_START_NODE_TYPE : readString(node.data.kind) || readString(node.data.nodeType) || template?.id || category,
      icon: readString(node.data.icon) || template?.iconName || getDefaultZflowIconNameForCategory(category),
      runtime: normalizeZflowRuntime(readString(node.data.runtime), category === 'start' ? 'start' : template?.runtime || 'transform'),
      ...(hasInputPorts || inputPorts.length ? { inputPorts } : {}),
      ...(hasOutputPorts || outputPorts.length ? { outputPorts } : {}),
      ...(hasOutputData ? { outputData } : {}),
      ...(Object.keys(serializableConfig).length ? { config: serializableConfig } : {}),
    },
  }
}

function toSerializableZflowEdge(edge: ZflowEdge) {
  const data = isRecord(edge.data) ? stripDerivedZflowEdgeData(edge.data) : {}
  const sourceHandle = normalizeZflowHandleId(edge.sourceHandle)
  const targetHandle = normalizeZflowHandleId(edge.targetHandle)
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    type: edge.type || 'smoothstep',
    ...(typeof edge.label === 'string' && edge.label.trim() ? { label: edge.label.trim() } : {}),
    ...(Object.keys(data).length ? { data } : {}),
    ...(edge.animated ? { animated: true } : {}),
  }
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
        ...(model.promptSurface === undefined || model.promptSurface === '' ? {} : { promptSurface: model.promptSurface }),
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
    const parsed = JSON.parse(content) as Record<string, unknown> | null
    if (!isRecord(parsed)) return null
    const config = parsed.config && typeof parsed.config === 'object' ? parsed.config : {}
    const rawOutputType = (config as { outputType?: unknown }).outputType
    const rawKind = readString(parsed.kind)
    const inferredKind = normalizeZpmtPromptKind(rawKind || inferLegacyZpmtPromptKind(parsed, rawOutputType))
    const outputType = inferredKind === 'image' ? 'image' : 'text'
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
      schema: 'ccks.zpmt',
      version: 3,
      kind: inferredKind,
      system: readZpmtMessageContent(parsed.messages, 'system') || readString(parsed.system),
      user: readZpmtMessageContent(parsed.messages, 'user') || readString(parsed.user),
      prompt: readString(parsed.prompt) || (outputType === 'image' ? readString(parsed.user) : ''),
      negativePrompt: readString(parsed.negativePrompt),
      style: normalizeZpmtImageStyle(parsed.style, resolveAiModelPromptSurface(outputType, selectedModelContext?.provider.providerType, modelId, selectedModelContext?.model)),
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
  const outputType = document.kind === 'image' ? 'image' : 'text'
  const base = {
    schema: 'ccks.zpmt',
    version: 3,
    kind: document.kind,
    config: {
      outputType,
      providerFile: document.config.providerFile,
      providerId: document.config.providerId,
      providerName: document.config.providerName,
      model: document.config.model,
      responseConfig: normalizeResponseConfig(
        outputType,
        document.config.responseConfig,
        selectedModelContext?.provider.providerType,
        document.config.model,
        selectedModelContext?.model,
      ),
    },
    metadata,
  }
  const payload =
    document.kind === 'image'
      ? {
          ...base,
          prompt: document.prompt,
          ...(document.negativePrompt.trim() ? { negativePrompt: document.negativePrompt } : {}),
          ...(hasZpmtImageStyleValue(document.style) ? { style: document.style } : {}),
        }
      : {
          ...base,
          messages: buildZpmtMessages(document),
          ...(document.kind === 'agent' && document.tools.length
            ? {
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
              }
            : {}),
        }
  return `${JSON.stringify(payload, null, 2)}\n`
}

function buildZpmtRecipeVariableMetadata(
  document: ZpmtDocument,
  categories: RecipeVariableCategory[] = DEFAULT_RECIPE_VARIABLE_CATEGORIES,
): ZpmtRecipeVariableMetadata {
  const seen = new Set<string>()
  const recipeVariables: RecipeVariableSnapshot[] = []

  for (const tokenRange of findZpmtDocumentPromptTokenRanges(document)) {
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

function normalizeZpmtPromptKind(value: unknown): ZpmtPromptKind {
  return value === 'image' || value === 'agent' || value === 'chat' ? value : 'chat'
}

function isZpmtPromptSectionKey(value: ZpmtSectionKey): value is ZpmtPromptSectionKey {
  return value === 'system' || value === 'user' || value === 'prompt' || value === 'negativePrompt' || value === 'style'
}

function inferLegacyZpmtPromptKind(parsed: Record<string, unknown>, rawOutputType: unknown): ZpmtPromptKind {
  if (readString(rawOutputType) === 'image') return 'image'
  if (readString(parsed.system).trim()) return 'agent'
  return 'chat'
}

function readZpmtMessageContent(value: unknown, role: 'system' | 'user') {
  const source = Array.isArray(value) ? value : []
  const message = source.find((item) => isRecord(item) && item.role === role)
  return isRecord(message) ? readString(message.content) : ''
}

function buildZpmtMessages(document: ZpmtDocument) {
  if (document.kind === 'agent') {
    return [
      ...(document.system.trim() ? [{ role: 'system', content: document.system }] : []),
      { role: 'user', content: document.user },
    ]
  }
  return [{ role: 'user', content: document.user }]
}

function createDefaultZpmtImageStyle(surface: AiModelPromptSurface): ZpmtImageStyle {
  const styleInput = surface.kind === 'image-prompt' ? surface.styleInput : { type: 'free-text' as ImageStyleInputType }
  return {
    mode: styleInput.type,
    value: styleInput.type === 'preset' || styleInput.type === 'preset-with-extra-text' ? styleInput.options?.[0]?.value || '' : '',
    extraText: '',
  }
}

function normalizeZpmtImageStyle(value: unknown, surface: AiModelPromptSurface): ZpmtImageStyle {
  const defaults = createDefaultZpmtImageStyle(surface)
  if (typeof value === 'string') return { ...defaults, mode: 'free-text', value, extraText: '' }
  if (!isRecord(value)) return defaults
  const rawMode = readString(value.mode)
  const mode: ImageStyleInputType =
    rawMode === 'preset' || rawMode === 'preset-with-extra-text' || rawMode === 'free-text'
      ? rawMode
      : defaults.mode
  return {
    mode,
    value: readString(value.value),
    extraText: readString(value.extraText),
  }
}

function hasZpmtImageStyleValue(style: ZpmtImageStyle) {
  return Boolean(style.value.trim() || style.extraText.trim())
}

function getZpmtStyleText(style: ZpmtImageStyle) {
  return [style.value, style.extraText].map((item) => item.trim()).filter(Boolean).join('\n')
}

function getZpmtStyleEditableText(style: ZpmtImageStyle) {
  return style.mode === 'preset' || style.mode === 'preset-with-extra-text' ? style.extraText : style.value
}

function updateZpmtStyleEditableText(style: ZpmtImageStyle, value: string): ZpmtImageStyle {
  if (style.mode === 'preset' || style.mode === 'preset-with-extra-text') return { ...style, extraText: value }
  return { ...style, value }
}

function normalizeResponseConfig(
  outputType: ZpmtOutputType,
  value: unknown,
  providerType?: string,
  modelId?: string,
  model?: AiProviderModel | null,
): ZpmtResponseConfig {
  const config = normalizeAiResponseConfig(outputType, value, providerType, modelId, model)
  return outputType === 'image' ? { ...config, imageCount: 1 } : config
}

function defaultResponseConfig(outputType: ZpmtOutputType, providerType?: string, modelId?: string, model?: AiProviderModel | null): ZpmtResponseConfig {
  const config = defaultAiResponseConfig(outputType, providerType, modelId, model)
  return outputType === 'image' ? { ...config, imageCount: 1 } : config
}

function createPromptEntryDialog(folder: TreeNode, providers: AiProviderSummary[]): EntryDialogState {
  const outputType: ZpmtOutputType = 'text'
  const selection = selectDefaultAiModel(providers, outputType)
  return {
    mode: 'prompt',
    folder,
    name: '',
    promptKind: 'chat',
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

function isCommonAiProvider(provider: AiProviderSummary) {
  return !provider.filePath && provider.id.startsWith(COMMON_AI_PROVIDER_ID_PREFIX)
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
  if (payload.kind === 'constant') return true
  if (payload.kind === 'variable' && payload.variableType === 'image') return capabilities.supportsReferenceImage
  if (payload.kind === 'variable' && payload.variableType === 'file') return capabilities.supportsReferenceFile
  return true
}

function canDropInstructionInPromptSection(
  payload: InstructionDragPayload,
  _promptKind: ZpmtPromptKind,
  sectionKey: ZpmtPromptSectionKey,
  capabilities: ZpmtModelCapabilityGate,
) {
  if (!canUseInstructionPayload(payload, capabilities)) return false
  if (payload.kind !== 'variable') return true
  if (payload.variableType !== 'image' && payload.variableType !== 'file') return true
  return sectionKey !== 'system'
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

function findZpmtConstant(kind: string) {
  return ZPMT_CONSTANTS.find((item) => item.id === kind) || null
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
    promptSurface: source.promptSurface,
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

function createVariableToken(type: VariableType, name: string, detailValue: string, defaultValue: string, arrayItemType: ArrayItemType | '' = '') {
  const tokenType = VARIABLE_TOKEN_TYPES[type]
  const parts = [`${tokenType}:${name}`]
  const detail = detailValue.trim()
  const defaultText = defaultValue.trim()

  if (type === 'array' && arrayItemType) {
    parts.push(formatEqualsTagParam('itemType', arrayItemType))
  }

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

function createConstantToken(item: ConstantInstructionItem, locale: Locale) {
  return `{{const:${sanitizePromptTokenName(item.tokenName[locale]) || item.id};kind=${item.id}}}`
}

function templateRecipeToken(context: PromptTemplateBuildContext, variableId: string, defaultValues?: string[]) {
  const sourceId = `system:${variableId}`
  const match =
    findRecipeVariableBySourceId(context.categories, sourceId) ||
    findRecipeVariableBySourceId(DEFAULT_RECIPE_VARIABLE_CATEGORIES, sourceId)
  const item = match?.variable
  if (item) return createRecipeToken(item, sanitizePromptTokenName(item.name.zh) || item.variableName, defaultValues || item.defaultValues)

  const tokenName = createIdentifierSeed(variableId) || sanitizePromptTokenName(variableId) || '配方变量'
  const parts = [`recipe:${tokenName}`, formatEqualsTagParam('source', sourceId), formatEqualsTagParam('multi', 'true')]
  const defaultText = (defaultValues || []).map((value) => value.trim()).filter(Boolean).join(',')
  if (defaultText) parts.push(formatEqualsTagParam('default', defaultText))
  return `{{${parts.join(';')}}}`
}

function getTemplateRecipeCategories(categories: RecipeVariableCategory[]) {
  return [...categories, ...DEFAULT_RECIPE_VARIABLE_CATEGORIES]
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

function sanitizePromptTokenName(value: string) {
  return value
    .trim()
    .replace(/[{};:\s]+/g, '_')
    .replace(/[^\p{L}\p{N}_-]/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

function isValidPromptTokenName(value: string) {
  return TAG_NAME_PATTERN.test(value)
}

function normalizeArrayItemType(value: unknown): ArrayItemType | '' {
  return typeof value === 'string' && ARRAY_ITEM_TYPES.includes(value as ArrayItemType) ? value as ArrayItemType : ''
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
  for (const text of texts) {
    for (const tokenRange of findPromptTokenRanges(text)) {
      const parsed = parsePromptToken(tokenRange.token)
      if (parsed && parsed.tokenType !== 'const') names.add(parsed.name)
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
      arrayItemType: '' as ArrayItemType | '',
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
      arrayItemType: '' as ArrayItemType | '',
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
    arrayItemType: variableType === 'array' ? normalizeArrayItemType(params.itemType || params.type) : '',
    detailValue,
    defaultValue: variableType && isVariableDefaultValueSupported(variableType) ? params.default || '' : '',
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

  const styleKey = parsed.variableType || (parsed.tokenType === 'recipe' ? 'recipe' : parsed.tokenType === 'const' ? 'constant' : 'unknown')
  const unsupported = isPromptTokenUnsupported(parsed, modelCapabilities)
  const params = getPromptTokenParamMap(parsed.params)
  const recipeItem = parsed.tokenType === 'recipe' ? findRecipeVariableItemById(params.source || '', categories) : null
  const recipeSnapshot = parsed.tokenType === 'recipe' ? findRecipeVariableSnapshot(metadata, parsed.name, params.source || '') : null
  const constantItem = parsed.tokenType === 'const' ? findZpmtConstant(params.kind || parsed.name) : null
  const typeLabel = parsed.variableType
    ? t.variableTypes[parsed.variableType]
    : parsed.tokenType === 'recipe'
      ? recipeItem?.name[locale] || recipeSnapshot?.name[locale] || t.recipeVariableLabel
      : parsed.tokenType === 'const'
        ? constantItem?.name[locale] || t.constantVariableLabel
      : parsed.tokenType
  const label = `${typeLabel}:${parsed.name}`
  const detailLines = parsed.params.map((param) => formatPromptTokenParam(param, t, locale, categories, metadata)).filter(Boolean)
  if (unsupported) detailLines.unshift(t.unsupportedByModel)
  if (constantItem?.description[locale]) detailLines.push(constantItem.description[locale])
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
  const separatorIndex = (head || '').indexOf(':')
  if (separatorIndex <= 0) return null
  const tokenType = (head || '').slice(0, separatorIndex).trim()
  const name = (head || '').slice(separatorIndex + 1).trim()
  if (!/^[a-z]+$/.test(tokenType) || !isValidPromptTokenName(name)) return null
  const variableType = VARIABLE_TYPES_BY_TOKEN[tokenType as VariableTokenType]

  return {
    tokenType,
    name,
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
  const arrayItemType = parsed.key === 'itemType' ? normalizeArrayItemType(parsed.value) : ''
  let value = parsed.value

  if (arrayItemType) value = t.arrayItemTypes[arrayItemType]
  else if (parsed.key === 'multi' && (parsed.value === 'true' || parsed.value === 'false')) value = t.booleanText[parsed.value]
  else if (parsed.key === 'source') value = resolveRecipeVariableSourceLabel(parsed.value, categories, metadata, locale) || parsed.value

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
  return document.kind === 'agent' ? 'agent' : 'chat'
}

function buildZpmtPreviewMarkdown(document: ZpmtDocument, promptMode: PromptFileType) {
  if (document.kind === 'image') {
    return [
      `## Prompt`,
      document.prompt.trim(),
      document.negativePrompt.trim() ? `## Negative Prompt\n\n${document.negativePrompt.trim()}` : '',
      getZpmtStyleText(document.style).trim() ? `## Style\n\n${getZpmtStyleText(document.style).trim()}` : '',
      `## Params`,
      `\`\`\`json\n${JSON.stringify(document.config.responseConfig, null, 2)}\n\`\`\``,
    ].filter(Boolean).join('\n\n')
  }

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
    { i: 'editor', x: 5, y: 0, w: 11, h: rows, minW: 8, minH: 9 },
    { i: 'inspector', x: 16, y: 0, w: 8, h: instructionRows, minW: 5, minH: 6 },
    { i: 'tests', x: 16, y: instructionRows, w: 8, h: testRows, minW: 5, minH: 6 },
  ]
}

function cloneDefaultWorkbenchLayout(rowCount = DEFAULT_GRID_ROWS) {
  return createDefaultWorkbenchLayout(rowCount).map((item) => clampLayoutItem({ ...item, resizeHandles: RESIZE_HANDLES }))
}

function createZflowWorkbenchLayout(layout: GridLayoutItem[], rowCount = DEFAULT_GRID_ROWS): GridLayoutItem[] {
  const rows = Math.max(DEFAULT_GRID_ROWS, rowCount)
  const currentFiles = layout.find((item) => item.i === 'files') || getDefaultLayoutItem('files', rows)
  const fileWidth = Math.min(7, Math.max(currentFiles.minW || 3, currentFiles.w || 5))
  return [
    createReactGridLayoutItem({
      ...currentFiles,
      i: 'files',
      x: 0,
      y: 0,
      w: fileWidth,
      h: rows,
      minW: 3,
      minH: 8,
      isDraggable: false,
      isResizable: false,
      resizeHandles: [],
    }),
    createReactGridLayoutItem({
      i: 'editor',
      x: fileWidth,
      y: 0,
      w: GRID_COLS - fileWidth,
      h: rows,
      minW: 8,
      minH: 9,
      isDraggable: false,
      isResizable: false,
      resizeHandles: [],
    }),
  ]
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
    (editor.w === 11 || editor.w === 14) &&
    editor.h === files.h &&
    (inspector.x === 16 || inspector.x === 19) &&
    inspector.y === 0 &&
    (inspector.w === 8 || inspector.w === 5) &&
    (tests.x === 16 || tests.x === 19) &&
    tests.y === inspector.h &&
    (tests.w === 8 || tests.w === 5) &&
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

function readPositiveFiniteNumber(value: unknown, fallback: number) {
  const nextValue = readFiniteNumber(value, fallback)
  return nextValue > 0 ? nextValue : fallback
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
