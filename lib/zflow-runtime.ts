import { Annotation, Command, END, START, StateGraph } from '@langchain/langgraph'
import { runAiTool } from '@/lib/ai-tool-runner'
import { getCommonAiProviderForRuntime, isCommonAiProviderRef } from '@/lib/ai-provider-store'
import { readProjectConfigCatalog } from '@/lib/project-config-files'
import type { ProjectAiProviderSummary } from '@/lib/project-config-types'
import { getProjectWorkingDirectory, readProjectFile } from '@/lib/project-store'
import {
  collectZpmtVariableDescriptors,
  findPromptTokenRanges,
  getPromptTokenMediaKind,
  getZpmtImageStyleText,
  getZpmtPromptMessages,
  getZpmtVariableKey,
  normalizeZpmtMediaVariables,
  normalizeZpmtVariableValues,
  parsePromptToken,
  parseZpmtContentForRuntime,
  renderZpmtImagePrompt,
  renderZpmtTextPrompt,
  validateZpmtMediaVariables,
  validateZpmtDocumentForRuntime,
  type ZpmtMediaFile,
} from '@/lib/zpmt-document'
import { resolveAiModelPromptSurface, type ZpmtResponseConfig } from '@/lib/ai-presets'

export const ZFLOW_LANGGRAPH_SCHEMA = 'ccks.zflow.langgraph'

export type ZflowLangGraphNodeKind = 'start' | 'state' | 'prompt' | 'tool' | 'http' | 'router' | 'parallel-merge' | 'array-merge' | 'end'

export type ZflowLangGraphPort = {
  id: string
  label: string
}

export type ZflowLangGraphNode = {
  id: string
  type: 'zflow'
  position: { x: number; y: number }
  data: {
    label: string
    description?: string
    kind: ZflowLangGraphNodeKind
    icon?: string
    inputs?: ZflowLangGraphPort[]
    outputs?: ZflowLangGraphPort[]
    inputPorts?: ZflowLangGraphPort[]
    outputPorts?: ZflowLangGraphPort[]
    config?: Record<string, unknown>
  }
}

export type ZflowLangGraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  label?: string
}

export type ZflowLangGraphDocument = {
  schema: typeof ZFLOW_LANGGRAPH_SCHEMA
  version: number
  nodes: ZflowLangGraphNode[]
  edges: ZflowLangGraphEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export type ZflowDiagnostic = {
  level: 'error' | 'warning'
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export type ZflowRuntimeEvent =
  | { type: 'run:start'; runId: string; threadId: string }
  | { type: 'node:start'; nodeId: string; label: string; kind: ZflowLangGraphNodeKind }
  | { type: 'node:end'; nodeId: string; output?: unknown; durationMs: number }
  | { type: 'node:error'; nodeId: string; message: string; durationMs: number }
  | { type: 'run:end'; runId: string; output: unknown; durationMs: number }
  | { type: 'run:error'; runId: string; message: string; durationMs: number }

export type ZflowRunInput = {
  userId: string
  projectId: string
  document: ZflowLangGraphDocument
  input?: Record<string, unknown>
  threadId?: string
  maxSteps?: number
  onEvent?: (event: ZflowRuntimeEvent) => void | Promise<void>
}

type GraphState = {
  values: Record<string, unknown>
  last: unknown
}

const ZflowState = Annotation.Root({
  values: Annotation<Record<string, unknown>>({
    reducer: (left, right) => ({ ...(left || {}), ...(right || {}) }),
    default: () => ({}),
  }),
  last: Annotation<unknown>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
})

const ZFLOW_NODE_OUTPUT_PREFIX = '__nodeOutput'

export function createDefaultZflowLangGraphDocument(title = '提示词流程'): ZflowLangGraphDocument {
  return {
    schema: ZFLOW_LANGGRAPH_SCHEMA,
    version: 1,
    nodes: [
      createZflowNode('start', 'start', '开始', { x: 80, y: 140 }, { outputs: [{ id: 'out', label: '输出' }] }),
      createZflowNode('prompt', 'prompt-1', '提示词执行', { x: 360, y: 140 }, { config: { filePath: '', bindings: {} } }),
      createZflowNode('end', 'end', '结束', { x: 650, y: 140 }, { config: { outputPath: 'result' } }),
    ],
    edges: [
      { id: 'start-out-prompt-1-in', source: 'start', sourceHandle: 'out', target: 'prompt-1', targetHandle: 'in', type: 'smoothstep' },
      { id: 'prompt-1-out-end-in', source: 'prompt-1', sourceHandle: 'out', target: 'end', targetHandle: 'in', type: 'smoothstep' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

export function parseZflowLangGraphContent(content: string) {
  try {
    return normalizeZflowLangGraphDocument(JSON.parse(content))
  } catch {
    return null
  }
}

export function serializeZflowLangGraphDocument(document: ZflowLangGraphDocument) {
  return `${JSON.stringify(normalizeZflowLangGraphDocument(document) || createDefaultZflowLangGraphDocument(), null, 2)}\n`
}

export function normalizeZflowLangGraphDocument(value: unknown): ZflowLangGraphDocument | null {
  if (!isRecord(value)) return null
  if (readString(value.schema) !== ZFLOW_LANGGRAPH_SCHEMA) return null
  const nodes = readArray(value.nodes).flatMap((node, index) => normalizeZflowNode(node, index))
  const edges = readArray(value.edges).flatMap((edge, index) => normalizeZflowEdge(edge, index, nodes))
  const viewport = isRecord(value.viewport)
    ? {
        x: readNumber(value.viewport.x, 0),
        y: readNumber(value.viewport.y, 0),
        zoom: Math.min(2, Math.max(0.25, readNumber(value.viewport.zoom, 1))),
      }
    : { x: 0, y: 0, zoom: 1 }
  return {
    schema: ZFLOW_LANGGRAPH_SCHEMA,
    version: Math.max(1, Math.round(readNumber(value.version, 1))),
    nodes: ensureSingleStart(nodes),
    edges,
    viewport,
  }
}

export function validateZflowLangGraphDocument(document: ZflowLangGraphDocument): ZflowDiagnostic[] {
  const diagnostics: ZflowDiagnostic[] = []
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const starts = document.nodes.filter((node) => node.data.kind === 'start')
  if (starts.length !== 1) diagnostics.push({ level: 'error', code: 'START_INVALID', message: '流程必须且只能有一个 start 节点' })
  if (!document.nodes.some((node) => node.data.kind === 'end')) diagnostics.push({ level: 'warning', code: 'END_MISSING', message: '建议至少添加一个 end 节点' })

  for (const edge of document.edges) {
    if (!nodeIds.has(edge.source)) diagnostics.push({ level: 'error', code: 'EDGE_SOURCE_MISSING', message: '连线来源节点不存在', edgeId: edge.id })
    if (!nodeIds.has(edge.target)) diagnostics.push({ level: 'error', code: 'EDGE_TARGET_MISSING', message: '连线目标节点不存在', edgeId: edge.id })
  }

  for (const node of document.nodes) {
    if (node.data.kind === 'prompt' && !readString(node.data.config?.filePath)) {
      diagnostics.push({ level: 'error', code: 'PROMPT_FILE_MISSING', message: '提示词节点缺少 .zpmt 文件', nodeId: node.id })
    }
    if (node.data.kind === 'tool' && !readString(node.data.config?.toolId)) {
      diagnostics.push({ level: 'error', code: 'TOOL_ID_MISSING', message: '工具节点缺少 toolId', nodeId: node.id })
    }
    if (node.data.kind === 'http' && !readString(node.data.config?.url)) {
      diagnostics.push({ level: 'error', code: 'HTTP_URL_MISSING', message: '接口节点缺少 URL', nodeId: node.id })
    }
    if (node.data.kind === 'array-merge' && !readString(node.data.config?.outputPath)) {
      diagnostics.push({ level: 'error', code: 'ARRAY_MERGE_OUTPUT_MISSING', message: '数组合并节点缺少输出变量', nodeId: node.id })
    }
    if (node.data.kind === 'router') {
      const branches = getRouterBranches(document, node.id)
      if (!branches.true && !branches.false) diagnostics.push({ level: 'error', code: 'ROUTER_BRANCH_MISSING', message: '路由节点至少需要 true 或 false 分支', nodeId: node.id })
    }
    if (node.data.kind === 'parallel-merge') {
      const upstream = getIncomingEdges(document, node.id)
      if (upstream.length < 2) diagnostics.push({ level: 'warning', code: 'PARALLEL_MERGE_INPUTS_LOW', message: '并发合并节点建议连接两个以上上游分支', nodeId: node.id })
    }
  }

  return diagnostics
}

export async function readZflowPromptVariables(userId: string, projectId: string, filePath: string) {
  const file = await readProjectFile(userId, { projectId, filePath })
  const document = parseZpmtContentForRuntime(file.content)
  const validation = validateZpmtDocumentForRuntime({ document })
  if (!document) return { ok: false as const, validation, variables: [] }
  return {
    ok: true as const,
    projectId: file.projectId,
    path: file.path,
    kind: document.kind,
    outputType: document.config.outputType,
    variables: collectZpmtVariableDescriptors(document),
    validation,
  }
}

export async function runZflowLangGraph(input: ZflowRunInput) {
  const runId = `zflow-run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const threadId = input.threadId || runId
  const startedAt = Date.now()
  await input.onEvent?.({ type: 'run:start', runId, threadId })
  const diagnostics = validateZflowLangGraphDocument(input.document)
  const error = diagnostics.find((item) => item.level === 'error')
  if (error) {
    const event = { type: 'run:error' as const, runId, message: error.message, durationMs: Date.now() - startedAt }
    await input.onEvent?.(event)
    return { ok: false as const, diagnostics, output: {}, error: error.message }
  }

  try {
    const graph = compileZflowLangGraph(input)
    const output = await graph.invoke(
      { values: input.input || {}, last: input.input || {} },
      { configurable: { thread_id: threadId }, recursionLimit: clampInteger(input.maxSteps, 30, 1, 200) },
    )
    const values = isRecord(output.values) ? output.values : {}
    const finalOutput = Object.prototype.hasOwnProperty.call(values, 'final') ? values.final : values
    await input.onEvent?.({ type: 'run:end', runId, output: finalOutput, durationMs: Date.now() - startedAt })
    return { ok: true as const, diagnostics, output: finalOutput }
  } catch (error) {
    const message = readErrorMessage(error)
    await input.onEvent?.({ type: 'run:error', runId, message, durationMs: Date.now() - startedAt })
    return { ok: false as const, diagnostics, output: {}, error: message }
  }
}

export function compileZflowLangGraph(input: ZflowRunInput) {
  let graph = new StateGraph(ZflowState) as any
  const addedEdges = new Set<string>()
  const addEdgeOnce = (source: string, target: string) => {
    const key = `${source}->${target}`
    if (addedEdges.has(key)) return
    addedEdges.add(key)
    graph = graph.addEdge(source, target)
  }
  const addWaitingEdgeOnce = (sources: string[], target: string) => {
    const uniqueSources = Array.from(new Set(sources))
    if (uniqueSources.length < 2) {
      if (uniqueSources[0]) addEdgeOnce(uniqueSources[0], target)
      return
    }
    const key = `${uniqueSources.join('+')}->${target}`
    if (addedEdges.has(key)) return
    addedEdges.add(key)
    graph = graph.addEdge(uniqueSources, target)
  }
  for (const node of input.document.nodes) {
    if (node.data.kind === 'start') continue
    graph = graph.addNode(node.id, async (state: GraphState) => runZflowNode(input, node, state), node.data.kind === 'router' ? { ends: getRouterEnds(input.document, node.id) } : undefined)
  }

  for (const target of getStartTargets(input.document)) addEdgeOnce(START, target)
  for (const mergeNode of input.document.nodes.filter((node) => node.data.kind === 'parallel-merge')) {
    const upstream = getIncomingEdges(input.document, mergeNode.id)
      .map((edge) => edge.source)
      .filter((sourceId) => input.document.nodes.some((node) => node.id === sourceId && node.data.kind !== 'start' && node.data.kind !== 'router'))
    if (upstream.length > 1) addWaitingEdgeOnce(upstream, mergeNode.id)
  }
  for (const edge of input.document.edges) {
    const source = input.document.nodes.find((node) => node.id === edge.source)
    if (!source || source.data.kind === 'start' || source.data.kind === 'router') continue
    const target = input.document.nodes.find((node) => node.id === edge.target)
    if (!target) continue
    if (target.data.kind === 'parallel-merge' && getIncomingEdges(input.document, target.id).length > 1) continue
    addEdgeOnce(edge.source, edge.target)
  }
  for (const router of input.document.nodes.filter((node) => node.data.kind === 'router')) {
    const branches = getRouterBranches(input.document, router.id)
    graph = graph.addConditionalEdges(router.id, (state: GraphState) => branches[readString(state.values[`__route:${router.id}`]) || 'false'] || END)
  }
  for (const node of input.document.nodes.filter((item) => item.data.kind === 'end')) {
    addEdgeOnce(node.id, END)
  }
  return graph.compile()
}

async function runZflowNode(input: ZflowRunInput, node: ZflowLangGraphNode, state: GraphState) {
  const startedAt = Date.now()
  await input.onEvent?.({ type: 'node:start', nodeId: node.id, label: node.data.label, kind: node.data.kind })
  try {
    let result: unknown
    let update: Record<string, unknown> = {}
    if (node.data.kind === 'state') {
      update = runStateNode(node, state)
      result = update
    } else if (node.data.kind === 'prompt') {
      result = await runPromptNode(input, node, state)
      const promptKind = readString(node.data.config?.promptKind)
      if (promptKind === 'image') {
        const configuredOutputPath = readString(node.data.config?.outputPath)
        update = {
          image: result,
          images: result,
          ...(configuredOutputPath && configuredOutputPath !== 'image' ? { [configuredOutputPath]: result } : {}),
        }
      } else {
        update = { [readString(node.data.config?.outputPath) || 'result']: result }
      }
    } else if (node.data.kind === 'tool') {
      result = await runAiTool(input.userId, {
        toolId: node.data.config?.toolId,
        input: resolveTemplateValue(node.data.config?.input || {}, state.values),
        context: { projectId: input.projectId },
      })
      update = { [readString(node.data.config?.outputPath) || 'toolResult']: result }
    } else if (node.data.kind === 'http') {
      result = await runHttpNode(node, state)
      update = { [readString(node.data.config?.outputPath) || 'response']: result }
    } else if (node.data.kind === 'router') {
      const route = evaluateRouter(node, state) ? 'true' : 'false'
      update = { [`__route:${node.id}`]: route }
      result = route
    } else if (node.data.kind === 'parallel-merge') {
      update = runParallelMergeNode(node, state)
      result = update
    } else if (node.data.kind === 'array-merge') {
      update = runArrayMergeNode(node, state)
      result = update
    } else if (node.data.kind === 'end') {
      result = runEndNode(input.document, node, state)
      update = { final: result }
    }
    update = withScopedZflowNodeOutputs(node, update)

    await input.onEvent?.({
      type: 'node:end',
      nodeId: node.id,
      ...(node.data.kind === 'end' ? { output: result } : {}),
      durationMs: Date.now() - startedAt,
    })
    if (node.data.kind === 'router') return new Command({ update: { values: update, last: result } })
    return { values: update, last: result }
  } catch (error) {
    const message = readErrorMessage(error)
    await input.onEvent?.({ type: 'node:error', nodeId: node.id, message, durationMs: Date.now() - startedAt })
    throw error
  }
}

function runStateNode(node: ZflowLangGraphNode, state: GraphState) {
  const outputPath = readString(node.data.config?.outputPath) || readString(node.data.config?.name) || 'value'
  const value = resolveTemplateValue(node.data.config?.value ?? node.data.config?.input ?? state.last, state.values)
  return { [outputPath]: value }
}

function withScopedZflowNodeOutputs(node: ZflowLangGraphNode, update: Record<string, unknown>) {
  if (!Object.keys(update).length) return update
  return {
    ...update,
    ...Object.fromEntries(Object.entries(update).map(([path, value]) => [createZflowNodeOutputKey(node.id, path), value])),
  }
}

function createZflowNodeOutputKey(nodeId: string, outputPath: string) {
  return `${ZFLOW_NODE_OUTPUT_PREFIX}:${nodeId}:${outputPath}`
}

function runParallelMergeNode(node: ZflowLangGraphNode, state: GraphState) {
  const outputPath = readString(node.data.config?.outputPath)
  return outputPath ? { [outputPath]: state.values } : {}
}

function runArrayMergeNode(node: ZflowLangGraphNode, state: GraphState) {
  const outputPath = readString(node.data.config?.outputPath) || 'merged'
  const sourcePaths = readArray(node.data.config?.sourcePaths).map(readString).filter(Boolean)
  const values = (sourcePaths.length ? sourcePaths.map((path) => readPath(state.values, path)) : [state.last])
    .flatMap((value) => {
      const resolved = resolveTemplateValue(value, state.values)
      if (resolved === undefined || resolved === null || resolved === '') return []
      return Array.isArray(resolved) ? resolved : [resolved]
    })
  return { [outputPath]: values }
}

async function runHttpNode(node: ZflowLangGraphNode, state: GraphState) {
  const method = readString(node.data.config?.method).toUpperCase() === 'POST' ? 'POST' : 'GET'
  const url = readString(resolveTemplateValue(node.data.config?.url, state.values))
  if (!url) throw new Error('接口节点缺少 URL')
  const headers = readHttpHeaders(node.data.config?.headers, state.values)
  const init: RequestInit = { method, headers }
  if (method === 'POST') {
    const body = resolveHttpBody(node.data.config?.body, state.values)
    if (body !== undefined) {
      init.body = body
      if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json'
    }
  }
  const response = await fetch(url, init)
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text()
  if (!response.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body)
    throw new Error(`接口请求失败 ${response.status}: ${message}`)
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

function readHttpHeaders(value: unknown, values: Record<string, unknown>): Record<string, string> {
  const resolved = resolveTemplateValue(value, values)
  if (isRecord(resolved)) return Object.fromEntries(Object.entries(resolved).map(([key, item]) => [key, readString(item)]).filter(([, item]) => item))
  const text = readString(resolved)
  if (!text) return {}
  try {
    const parsed = JSON.parse(text) as unknown
    return isRecord(parsed) ? Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, readString(item)]).filter(([, item]) => item)) : {}
  } catch {
    return {}
  }
}

function resolveHttpBody(value: unknown, values: Record<string, unknown>) {
  const resolved = resolveTemplateValue(value, values)
  if (resolved === undefined || resolved === null || resolved === '') return undefined
  if (typeof resolved === 'string') {
    try {
      return JSON.stringify(JSON.parse(resolved))
    } catch {
      return resolved
    }
  }
  return JSON.stringify(resolved)
}

function runEndNode(document: ZflowLangGraphDocument, node: ZflowLangGraphNode, state: GraphState) {
  const legacyOutputPath = readString(node.data.config?.outputPath)
  if (legacyOutputPath) return readPath(state.values, legacyOutputPath)
  const returnValues = readZflowEndReturnValues(node.data.config?.returnValues)
  if (returnValues.length) {
    const bindings = isRecord(node.data.config?.bindings) ? node.data.config?.bindings : {}
    return Object.fromEntries(returnValues.map((item) => {
      const binding = bindings[item.id]
      const value = isRecord(binding) ? resolveBindingValue(binding, state.values) : readPath(state.values, item.id)
      return [item.id, value]
    }))
  }
  const configuredPaths = readArray(node.data.config?.returnPaths).map(readString).filter(Boolean)
  if (configuredPaths.length) return Object.fromEntries(configuredPaths.map((path) => [path, readPath(state.values, path)]))
  const incoming = getIncomingEdges(document, node.id)
  if (!incoming.length) return state.values
  const entries = incoming.flatMap((edge) => {
    const path = resolveZflowEdgeOutputPath(document, edge)
    if (!path) return []
    return [[path, readPath(state.values, path)]]
  })
  return entries.length ? Object.fromEntries(entries) : state.values
}

function readZflowEndReturnValues(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index): { id: string; label: string }[] => {
    if (!isRecord(item)) return []
    const id = readString(item.id) || `return-${index + 1}`
    return [{ id, label: readString(item.label) || id }]
  })
}

function resolveZflowEdgeOutputPath(document: ZflowLangGraphDocument, edge: ZflowLangGraphEdge) {
  const source = document.nodes.find((node) => node.id === edge.source)
  if (!source) return ''
  const configOutput = readString(source.data.config?.outputPath)
  if (configOutput) return configOutput
  if (source.data.kind === 'prompt') return readString(source.data.config?.promptKind) === 'image' ? 'image' : 'result'
  if (source.data.kind === 'tool') return 'toolResult'
  if (source.data.kind === 'http') return 'response'
  if (source.data.kind === 'array-merge') return 'merged'
  if (source.data.kind === 'state') return readString(source.data.config?.name) || 'value'
  return readString(edge.sourceHandle)
}

async function runPromptNode(input: ZflowRunInput, node: ZflowLangGraphNode, state: GraphState) {
  const filePath = readString(node.data.config?.filePath)
  if (!filePath) throw new Error('提示词节点缺少 .zpmt 文件')
  const file = await readProjectFile(input.userId, { projectId: input.projectId, filePath })
  const document = parseZpmtContentForRuntime(file.content)
  if (!document) throw new Error('.zpmt 文件结构无效')
  const project = await getProjectWorkingDirectory(input.userId, input.projectId)
  const catalog = await readProjectConfigCatalog(project.localPath)
  const provider = await resolveZflowPromptProvider(catalog.providers, document.config.providerFile, document.config.providerId)
  if (!provider) throw new Error('未找到 .zpmt 绑定的供应商')
  if (!provider.apiKey) throw new Error('当前供应商未配置 API Key')
  const model = provider.models.find((item) => item.id === document.config.model) || null
  const validation = validateZpmtDocumentForRuntime({ document, provider, model })
  if (!validation.ok) throw new Error(validation.issues.map((issue) => issue.message).join('；') || '.zpmt 文件结构无效')
  const bindings = isRecord(node.data.config?.bindings) ? node.data.config?.bindings : {}
  const descriptors = collectZpmtVariableDescriptors(document)
  const descriptorByKey = new Map(descriptors.map((descriptor) => [descriptor.key, descriptor]))
  const descriptorByName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))
  const resolvedBindings = Object.fromEntries(Object.entries(bindings).map(([key, binding]) => {
    const descriptor = resolveZflowPromptDescriptor(key, descriptorByKey, descriptorByName)
    return [key, resolveZflowPromptBindingValue(binding, state.values, input.document, node, descriptor)]
  }))
  const variables = Object.fromEntries(Object.entries(resolvedBindings).filter(([key]) => !resolveZflowPromptDescriptor(key, descriptorByKey, descriptorByName)?.mediaKind))
  const mediaInput = await normalizeZflowPromptMediaInput(resolvedBindings, descriptorByKey, descriptorByName)
  const variableValues = normalizeZpmtVariableValues(document, variables)
  const mediaVariables = normalizeZpmtMediaVariables(document, mediaInput) as Record<string, ZpmtMediaFile[]>
  if (document.kind === 'image' || document.config.outputType === 'image') {
    return runImagePromptNode({ input, node, document, provider, model, variableValues, mediaVariables })
  }
  const messages = getZpmtPromptMessages(document).map((message) => ({
    role: message.role,
    content: renderZpmtTextPrompt(message.content, variableValues),
  }))
  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${provider.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: document.config.model,
      messages,
      ...createZflowChatResponseConfig(document.config.responseConfig),
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readRemoteError(data) || `模型请求失败 (${response.status})`)
  const choice = readArray(readRecord(data).choices)[0]
  const message = readRecord(readRecord(choice).message)
  const output = readAssistantContent(message.content)
  return { output, usage: readRecord(data).usage || null }
}

async function runImagePromptNode(input: {
  input: ZflowRunInput
  node: ZflowLangGraphNode
  document: NonNullable<ReturnType<typeof parseZpmtContentForRuntime>>
  provider: ProjectAiProviderSummary
  model: ProjectAiProviderSummary['models'][number] | null
  variableValues: Record<string, string>
  mediaVariables: Record<string, ZpmtMediaFile[]>
}) {
  const promptSurface = resolveAiModelPromptSurface('image', input.provider.providerType, input.document.config.model, input.model)
  validateZpmtMediaVariables({ document: input.document, mediaVariables: input.mediaVariables, model: input.model, provider: input.provider })
  const prompt = renderZpmtImagePrompt(input.document.prompt, input.variableValues, input.mediaVariables)
  if (!prompt.trim()) throw new Error('图片提示词不能为空')
  const negativePrompt = promptSurface.kind === 'image-prompt' && promptSurface.negativePrompt
    ? renderZpmtImagePrompt(input.document.negativePrompt, input.variableValues, input.mediaVariables)
    : ''
  const styleText = renderZpmtImagePrompt(getZpmtImageStyleText(input.document.style), input.variableValues, input.mediaVariables)
  const finalPrompt = [prompt.trim(), styleText.trim() ? `Style: ${styleText.trim()}` : ''].filter(Boolean).join('\n\n')
  const requestBody = buildProviderImageRequestBody(input.document, finalPrompt, negativePrompt, promptSurface)
  const referenceImages = collectImagePromptReferenceImages(input.document, input.mediaVariables, promptSurface)
  const endpoint = `${input.provider.baseUrl.replace(/\/+$/, '')}/${referenceImages.length ? 'images/edits' : 'images/generations'}`
  const response = await fetch(endpoint, referenceImages.length
    ? buildProviderImageEditRequestInit(input.provider, requestBody, referenceImages)
    : {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${input.provider.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readRemoteError(data) || `图片模型请求失败 (${response.status})`)
  const images = normalizeImageGenerationResults(data, input.document.config.responseConfig)
  if (!images.length) throw new Error('图片模型没有返回可展示的图片')
  return images[0]
}

async function resolveZflowPromptProvider(providers: ProjectAiProviderSummary[], providerFile: string, providerId: string) {
  if (!providerFile && isCommonAiProviderRef(providerId)) return getCommonAiProviderForRuntime(providerId)
  if (providerFile) return providers.find((provider) => provider.filePath === providerFile) || null
  return providers.find((provider) => provider.id === providerId) || null
}

function createZflowChatResponseConfig(config: Record<string, unknown>) {
  const responseConfig = config as Partial<ZpmtResponseConfig>
  const next: Record<string, unknown> = {}
  const temperature = readNumber(responseConfig.temperature, Number.NaN)
  const maxTokens = readNumber(responseConfig.maxTokens, Number.NaN)
  if (Number.isFinite(temperature)) next.temperature = temperature
  if (Number.isFinite(maxTokens)) next.max_tokens = Math.round(maxTokens)
  if (responseConfig.responseFormat === 'json_object') next.response_format = { type: 'json_object' }
  if (typeof responseConfig.reasoningEffort === 'string' && responseConfig.reasoningEffort) next.reasoning_effort = responseConfig.reasoningEffort
  return next
}

function buildProviderImageRequestBody(
  document: NonNullable<ReturnType<typeof parseZpmtContentForRuntime>>,
  prompt: string,
  negativePrompt: string,
  promptSurface: ReturnType<typeof resolveAiModelPromptSurface>,
) {
  const config = document.config.responseConfig as Partial<ZpmtResponseConfig>
  const body: Record<string, unknown> = { model: document.config.model, prompt }
  if (promptSurface.kind === 'image-prompt' && promptSurface.negativePrompt && negativePrompt.trim()) body.negative_prompt = negativePrompt.trim()
  if (config.imageSize && config.imageSize !== 'adaptive') body.size = config.imageSize
  body.n = 1
  if (config.imageQuality) body.quality = config.imageQuality
  if (config.imageOutputFormat) body.output_format = config.imageOutputFormat
  if (Number.isFinite(config.imageOutputCompression)) body.output_compression = config.imageOutputCompression
  if (config.imageResponseFormat) body.response_format = config.imageResponseFormat
  if (config.imageBackground) body.background = config.imageBackground
  if (config.imageModeration) body.moderation = config.imageModeration
  if (typeof config.watermark === 'boolean') body.watermark = config.watermark
  if (config.imageStyle) body.style = config.imageStyle
  return body
}

function buildProviderImageEditRequestInit(provider: ProjectAiProviderSummary, body: Record<string, unknown>, referenceImages: ZpmtMediaFile[]): RequestInit {
  const formData = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') continue
    formData.append(key, typeof value === 'string' ? value : String(value))
  }
  for (const file of referenceImages) formData.append('image', dataUrlToBlob(file.dataUrl, file.mimeType), file.filename)
  return { method: 'POST', headers: { accept: 'application/json', authorization: `Bearer ${provider.apiKey}` }, body: formData }
}

function collectImagePromptReferenceImages(
  document: NonNullable<ReturnType<typeof parseZpmtContentForRuntime>>,
  mediaVariables: Record<string, ZpmtMediaFile[]>,
  promptSurface: ReturnType<typeof resolveAiModelPromptSurface>,
) {
  const includeNegativePrompt = promptSurface.kind !== 'image-prompt' || promptSurface.negativePrompt
  const ranges = [
    ...findPromptTokenRanges(document.prompt),
    ...(includeNegativePrompt ? findPromptTokenRanges(document.negativePrompt) : []),
    ...findPromptTokenRanges(getZpmtImageStyleText(document.style)),
  ]
  const seen = new Set<string>()
  const files: ZpmtMediaFile[] = []
  for (const tokenRange of ranges) {
    const parsed = parsePromptToken(tokenRange.token)
    if (!parsed || getPromptTokenMediaKind(parsed) !== 'image') continue
    const key = getZpmtVariableKey(tokenRange.token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    files.push(...(mediaVariables[key] || []).map((file, index) => ({ ...file, filename: createMediaAlias(parsed.name, index, file.filename) })))
  }
  for (const [key, values] of Object.entries(mediaVariables)) {
    if (seen.has(key)) continue
    seen.add(key)
    files.push(...values.map((file, index) => ({ ...file, filename: createMediaAlias(key.split(':')[1] || 'image', index, file.filename) })))
  }
  return files
}

function normalizeImageGenerationResults(value: unknown, config: Record<string, unknown>) {
  const outputFormat = readString(config.imageOutputFormat) || 'png'
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png'
  return readArray(readRecord(value).data).flatMap((item): Array<{ src: string; revisedPrompt?: string }> => {
    const record = readRecord(item)
    const url = readString(record.url)
    const b64 = readString(record.b64_json)
    const revisedPrompt = readString(record.revised_prompt)
    const src = url || (b64 ? `data:${mimeType};base64,${b64}` : '')
    return src ? [{ src, ...(revisedPrompt ? { revisedPrompt } : {}) }] : []
  })
}

function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const base64 = dataUrl.split(',')[1] || ''
  return new Blob([Buffer.from(base64, 'base64')], { type: mimeType || 'application/octet-stream' })
}

async function normalizeZflowPromptMediaInput(
  bindings: Record<string, unknown>,
  descriptorByKey: Map<string, ReturnType<typeof collectZpmtVariableDescriptors>[number]>,
  descriptorByName: Map<string, ReturnType<typeof collectZpmtVariableDescriptors>[number]>,
) {
  const entries = await Promise.all(Object.entries(bindings).map(async ([key, value]) => {
    const descriptor = resolveZflowPromptDescriptor(key, descriptorByKey, descriptorByName)
    if (!descriptor?.mediaKind) return null
    if (descriptor.mediaKind !== 'image') return [descriptor.key, value] as const
    return [descriptor.key, await collectZflowImageMediaFiles(value)] as const
  }))
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, unknown] => Boolean(entry)))
}

function resolveZflowPromptDescriptor(
  key: string,
  descriptorByKey: Map<string, ReturnType<typeof collectZpmtVariableDescriptors>[number]>,
  descriptorByName: Map<string, ReturnType<typeof collectZpmtVariableDescriptors>[number]>,
) {
  return descriptorByKey.get(key) || descriptorByName.get(key) || null
}

function resolveZflowPromptBindingValue(
  binding: unknown,
  values: Record<string, unknown>,
  document: ZflowLangGraphDocument,
  node: ZflowLangGraphNode,
  descriptor: ReturnType<typeof collectZpmtVariableDescriptors>[number] | null,
) {
  const value = resolveBindingValue(binding, values)
  if (value !== undefined && value !== null && value !== '') return value
  if (!isRecord(binding) || readString(binding.mode) !== 'source') return value
  if (descriptor?.mediaKind !== 'image') return value
  return resolveDirectUpstreamImageValue(document, node, values) ?? value
}

function resolveDirectUpstreamImageValue(document: ZflowLangGraphDocument, node: ZflowLangGraphNode, values: Record<string, unknown>) {
  const candidates = getIncomingEdges(document, node.id).flatMap((edge) => {
    const source = document.nodes.find((item) => item.id === edge.source)
    if (!source || source.data.kind !== 'prompt' || readString(source.data.config?.promptKind) !== 'image') return []
    const configuredOutputPath = readString(source.data.config?.outputPath)
    const paths = [configuredOutputPath, 'image', 'images'].filter(Boolean)
    return paths.flatMap((path) => {
      const value = values[createZflowNodeOutputKey(source.id, path)] ?? readPath(values, path)
      return value === undefined || value === null || value === '' ? [] : [value]
    })
  })
  return candidates[0]
}

async function collectZflowImageMediaFiles(value: unknown): Promise<ZpmtMediaFile[]> {
  if (typeof value === 'string') {
    const file = await readZflowImageMediaFileFromSource(value, '', 0)
    return file ? [file] : []
  }
  if (Array.isArray(value)) {
    const nested = await Promise.all(value.map(collectZflowImageMediaFiles))
    return nested.flat()
  }
  if (!isRecord(value)) return []
  const b64Json = readString(value.b64_json || value.b64Json)
  if (b64Json) {
    const mimeType = readString(value.mimeType) || 'image/png'
    return [{
      filename: readString(value.filename) || createZflowImageMediaFilename(`data:${mimeType};base64,`, 0),
      mimeType,
      size: Buffer.from(b64Json, 'base64').byteLength,
      dataUrl: `data:${mimeType};base64,${b64Json}`,
    }]
  }
  const existingDataUrl = readString(value.dataUrl)
  const existingSize = readNumber(value.size, Number.NaN)
  if (existingDataUrl && Number.isFinite(existingSize) && existingSize >= 0) {
    return [{
      filename: readString(value.filename) || createZflowImageMediaFilename(existingDataUrl, 0),
      mimeType: readString(value.mimeType) || readZflowImageMimeType(existingDataUrl),
      size: existingSize,
      dataUrl: existingDataUrl,
    }]
  }
  const src = readString(value.src || value.url || value.imageUrl)
  if (src) {
    const file = await readZflowImageMediaFileFromSource(src, readString(value.filename), 0)
    return file ? [file] : []
  }
  const nested = await Promise.all(Object.values(value).map(collectZflowImageMediaFiles))
  return nested.flat()
}

async function readZflowImageMediaFileFromSource(src: string, filename: string, index: number): Promise<ZpmtMediaFile | null> {
  if (!src) return null
  if (/^data:image\//i.test(src)) {
    const mimeType = readZflowImageMimeType(src)
    const base64 = src.split(',')[1] || ''
    return {
      filename: filename || createZflowImageMediaFilename(src, index),
      mimeType,
      size: Buffer.from(base64, 'base64').byteLength,
      dataUrl: src,
    }
  }
  if (!/^https?:\/\//i.test(src)) return null
  const response = await fetch(src)
  if (!response.ok) throw new Error(`读取前置图片失败 (${response.status})`)
  const arrayBuffer = await response.arrayBuffer()
  const mimeType = response.headers.get('content-type')?.split(';')[0] || inferZflowImageMimeType(src)
  const buffer = Buffer.from(arrayBuffer)
  return {
    filename: filename || createZflowImageMediaFilename(src, index),
    mimeType,
    size: buffer.byteLength,
    dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
  }
}

function readZflowImageMimeType(src: string) {
  const match = /^data:([^;,]+)/i.exec(src)
  return match?.[1] || inferZflowImageMimeType(src)
}

function inferZflowImageMimeType(src: string) {
  const path = src.split(/[?#]/)[0]?.toLowerCase() || ''
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

function createZflowImageMediaFilename(src: string, index: number) {
  const extension = inferZflowImageMimeType(src).split('/')[1] || 'png'
  return `zflow-image-${index + 1}.${extension === 'jpeg' ? 'jpg' : extension}`
}

function createMediaAlias(variableName: string, index: number, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload'
  return `${variableName}_${index + 1}_${safeName}`
}

function readAssistantContent(value: unknown) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!isRecord(item)) return ''
    return readString(item.text || item.content)
  }).filter(Boolean).join('\n')
}

function readRemoteError(value: unknown) {
  const record = readRecord(value)
  const error = readRecord(record.error)
  return readString(error.message || error.code) || readString(record.message || record.error) || (Object.keys(record).length ? JSON.stringify(record).slice(0, 1000) : '')
}

function evaluateRouter(node: ZflowLangGraphNode, state: GraphState) {
  const config = isRecord(node.data.config) ? node.data.config : {}
  const conditions = readRouterConditions(config)
  if (conditions.length) {
    const results = conditions.map((condition) => evaluateRouterCondition(condition, state.values))
    return readString(config.conditionMode) === 'any' ? results.some(Boolean) : results.every(Boolean)
  }
  const left = resolveTemplateValue(config.left ?? config.source ?? state.last, state.values)
  const operator = readString(config.operator) || 'notEmpty'
  const right = resolveTemplateValue(config.right ?? config.value ?? '', state.values)
  return compareRouterValues(left, operator, right)
}

function readRouterConditions(config: Record<string, unknown>) {
  if (!Array.isArray(config.conditions)) return []
  return config.conditions.flatMap((item) => {
    if (!isRecord(item)) return []
    const sourceNodeId = readString(item.sourceNodeId)
    const sourceOutputId = readString(item.sourceOutputId) || readString(item.sourcePath) || readString(item.sourceHandle)
    if (!sourceNodeId || !sourceOutputId) return []
    return [{
      sourceNodeId,
      sourceOutputId,
      operator: readString(item.operator) || 'eq',
      value: item.value,
    }]
  })
}

function evaluateRouterCondition(
  condition: { sourceNodeId: string; sourceOutputId: string; operator: string; value: unknown },
  values: Record<string, unknown>,
) {
  const scopedValue = values[createZflowNodeOutputKey(condition.sourceNodeId, condition.sourceOutputId)]
  const left = scopedValue !== undefined ? scopedValue : readPath(values, condition.sourceOutputId)
  const right = resolveTemplateValue(condition.value ?? '', values)
  return compareRouterValues(left, condition.operator, right)
}

function compareRouterValues(left: unknown, operator: string, right: unknown) {
  if (operator === 'empty') return isRouterEmptyValue(left)
  if (operator === 'notEmpty') return !isRouterEmptyValue(left)
  if (operator === 'eq') return String(left ?? '') === String(right ?? '')
  if (operator === 'neq') return String(left ?? '') !== String(right ?? '')
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false
  if (operator === 'gt') return leftNumber > rightNumber
  if (operator === 'gte') return leftNumber >= rightNumber
  if (operator === 'lt') return leftNumber < rightNumber
  if (operator === 'lte') return leftNumber <= rightNumber
  return false
}

function isRouterEmptyValue(value: unknown) {
  if (value == null) return true
  if (typeof value === 'string') return !value.trim()
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) return Object.keys(value).length === 0
  return false
}

function resolveBindingValue(binding: unknown, values: Record<string, unknown>) {
  if (!isRecord(binding)) return ''
  const mode = readString(binding.mode)
  if (mode === 'source') {
    const sourcePath = readString(binding.sourcePath) || readString(binding.sourceOutputId) || readString(binding.sourceHandle)
    const sourceNodeId = readString(binding.sourceNodeId)
    if (sourceNodeId && sourcePath) {
      const scopedValue = values[createZflowNodeOutputKey(sourceNodeId, sourcePath)]
      if (scopedValue !== undefined) return scopedValue
    }
    return sourcePath ? readPath(values, sourcePath) : undefined
  }
  if (Array.isArray(binding.values)) return binding.values.join(', ')
  return resolveTemplateValue(binding.value, values)
}

function resolveTemplateValue(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{\s*([\w.-]+)\s*\}\}$/)
    if (exact) return readPath(values, exact[1])
    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => String(readPath(values, key) ?? ''))
  }
  if (Array.isArray(value)) return value.map((item) => resolveTemplateValue(item, values))
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTemplateValue(item, values)]))
  return value
}

function readPath(values: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), values)
}

function getStartNode(document: ZflowLangGraphDocument) {
  return document.nodes.find((node) => node.data.kind === 'start')
}

function getStartTargets(document: ZflowLangGraphDocument) {
  const startNode = getStartNode(document)
  if (!startNode) return []
  return Array.from(new Set(document.edges.filter((edge) => edge.source === startNode.id).map((edge) => edge.target).filter(Boolean)))
}

function getRouterBranches(document: ZflowLangGraphDocument, nodeId: string) {
  const branches: Record<string, string[]> = {}
  for (const edge of document.edges.filter((item) => item.source === nodeId)) {
    const handle = readString(edge.sourceHandle) || readString(edge.label)
    if (handle === 'true' || handle === 'false') branches[handle] = Array.from(new Set([...(branches[handle] || []), edge.target]))
  }
  return branches
}

function getRouterEnds(document: ZflowLangGraphDocument, nodeId: string) {
  const branches = getRouterBranches(document, nodeId)
  const ends = Array.from(new Set(Object.values(branches).flat()))
  return ends.length ? ends : [END]
}

function getIncomingEdges(document: ZflowLangGraphDocument, nodeId: string) {
  return document.edges.filter((edge) => edge.target === nodeId)
}

function createZflowNode(
  kind: ZflowLangGraphNodeKind,
  id: string,
  label: string,
  position: { x: number; y: number },
  options: Partial<ZflowLangGraphNode['data']> = {},
): ZflowLangGraphNode {
  return {
    id,
    type: 'zflow',
    position,
    data: {
      label,
      kind,
      icon: getDefaultIcon(kind),
      inputs: kind === 'start' ? [] : [{ id: 'in', label: '输入' }],
      outputs: kind === 'end' ? [] : kind === 'router' ? [{ id: 'true', label: 'true' }, { id: 'false', label: 'false' }] : [{ id: 'out', label: '输出' }],
      config: {},
      ...options,
    },
  }
}

function normalizeZflowNode(value: unknown, index: number): ZflowLangGraphNode[] {
  if (!isRecord(value)) return []
  const data = isRecord(value.data) ? value.data : {}
  const kind = normalizeKind(data.kind || data.nodeType)
  if (!kind) return []
  const id = readString(value.id) || `${kind}-${index + 1}`
  const position = isRecord(value.position) ? value.position : {}
  return [createZflowNode(kind, id, readString(data.label) || id, { x: readNumber(position.x, 80 + index * 240), y: readNumber(position.y, 120) }, {
    description: readString(data.description),
    icon: readString(data.icon) || getDefaultIcon(kind),
    inputs: normalizePorts(data.inputs || data.inputPorts, kind === 'start' ? [] : [{ id: 'in', label: '输入' }]),
    outputs: kind === 'router'
      ? [{ id: 'true', label: 'true' }, { id: 'false', label: 'false' }]
      : normalizePorts(data.outputs || data.outputPorts, kind === 'end' ? [] : [{ id: 'out', label: '输出' }]),
    config: isRecord(data.config) ? data.config : {},
  })]
}

function normalizeZflowEdge(value: unknown, index: number, nodes: ZflowLangGraphNode[]): ZflowLangGraphEdge[] {
  if (!isRecord(value)) return []
  const source = readString(value.source)
  const target = readString(value.target)
  if (!source || !target || !nodes.some((node) => node.id === source) || !nodes.some((node) => node.id === target)) return []
  return [{
    id: readString(value.id) || `${source}-${target}-${index + 1}`,
    source,
    target,
    sourceHandle: readString(value.sourceHandle) || undefined,
    targetHandle: readString(value.targetHandle) || undefined,
    type: readString(value.type) || 'smoothstep',
    label: readString(value.label) || undefined,
  }]
}

function ensureSingleStart(nodes: ZflowLangGraphNode[]) {
  const starts = nodes.filter((node) => node.data.kind === 'start')
  if (starts.length) return [starts[0], ...nodes.filter((node) => node.data.kind !== 'start')]
  return [createZflowNode('start', 'start', '开始', { x: 80, y: 140 }), ...nodes]
}

function normalizePorts(value: unknown, fallback: ZflowLangGraphPort[]) {
  if (!Array.isArray(value)) return fallback
  return value.flatMap((item, index) => isRecord(item) ? [{ id: readString(item.id) || `port-${index + 1}`, label: readString(item.label) || readString(item.id) || `端点 ${index + 1}` }] : [])
}

function normalizeKind(value: unknown): ZflowLangGraphNodeKind | null {
  const kind = readString(value)
  if (kind === 'start' || kind === 'state' || kind === 'prompt' || kind === 'prompt-run' || kind === 'tool' || kind === 'http' || kind === 'router' || kind === 'condition' || kind === 'parallel-merge' || kind === 'array-merge' || kind === 'end') {
    if (kind === 'prompt-run') return 'prompt'
    if (kind === 'condition') return 'router'
    return kind
  }
  return null
}

function getDefaultIcon(kind: ZflowLangGraphNodeKind) {
  if (kind === 'start') return 'play'
  if (kind === 'prompt') return 'message-square'
  if (kind === 'tool') return 'wrench'
  if (kind === 'http') return 'webhook'
  if (kind === 'router') return 'route'
  if (kind === 'parallel-merge') return 'git-merge'
  if (kind === 'array-merge') return 'merge'
  if (kind === 'end') return 'check-circle'
  return 'variable'
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
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

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Math.round(readNumber(value, fallback))
  return Math.min(max, Math.max(min, number))
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return readString(error) || '未知错误'
}
