import path from 'path'
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { createSystemZlexContent, getDefaultZamfFiles } from '@/lib/project-config-files'
import { prisma } from '@/lib/prisma'

export type ProjectPromptKind = 'chat' | 'agent' | 'image'

export type ProjectTreeNode = {
  id: string
  name: string
  kind: 'folder' | 'file'
  path: string
  projectId: string
  promptKind?: ProjectPromptKind
  children?: ProjectTreeNode[]
}

export type UserProject = {
  id: string
  name: string
  fileName: string
  localPath: string
  source: string
  repositoryUrl: string | null
  createdAt: string
  updatedAt: string
  tree: ProjectTreeNode
}

export type ProjectUploadFile = {
  relativePath: string
  data: Uint8Array
}

export type ProjectEntryConflict = {
  path: string
  targetPath: string
}

type ProjectRecord = {
  id: string
  userId: string
  name: string
  fileName: string
  localPath: string
  source: string
  repositoryUrl: string | null
  createdAt: Date
  updatedAt: Date
}

const PROJECT_ROOT = process.env.CCKS_PROJECT_ROOT || path.join(process.cwd(), '.ccks-projects')
const DEFAULT_PROJECT_FILE_NAME = 'example-site'

const examplePrompt = `---
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

export async function listUserProjects(userId: string): Promise<UserProject[]> {
  let records = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  if (!records.length) {
    records = [await ensureDefaultProject(userId)]
  } else {
    const defaultProject = records.find((record) => record.fileName === DEFAULT_PROJECT_FILE_NAME)
    if (defaultProject) await ensureDefaultProjectFiles(defaultProject.localPath)
  }

  return Promise.all(records.map(readProject))
}

export async function createUserProject(userId: string, input: { name: unknown; fileName: unknown }) {
  const name = normalizeProjectName(input.name)
  const fileName = normalizeProjectFileName(input.fileName)
  if (!name) throw new ProjectStoreError('PROJECT_NAME_REQUIRED', '项目名称不能为空')
  if (!fileName) throw new ProjectStoreError('PROJECT_FILE_NAME_INVALID', '文件名称只能使用英文、数字、下划线或连字符，并且必须以英文字母开头')

  await ensureUserRoot(userId)
  const projectRoot = getProjectRoot(userId, fileName)
  await mkdir(projectRoot, { recursive: false }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')
    throw error
  })
  await copyRepositoryReadme(projectRoot)
  await ensureProjectConfigFiles(projectRoot)
  await ensureProjectPromptTestFiles(projectRoot)
  await ensureProjectZflowDemoFiles(projectRoot)

  try {
    const record = await prisma.project.create({
      data: {
        userId,
        name,
        fileName,
        localPath: projectRoot,
        source: 'local',
      },
    })
    return readProject(record)
  } catch (error) {
    await rm(projectRoot, { recursive: true, force: true }).catch(() => undefined)
    if (isUniqueConstraintError(error)) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')
    throw error
  }
}

export async function createImportedProjectRecord(
  userId: string,
  input: { name: unknown; fileName: unknown; repositoryUrl: unknown },
) {
  const name = normalizeProjectName(input.name)
  const fileName = normalizeProjectFileName(input.fileName)
  const repositoryUrl = normalizeRepositoryUrl(input.repositoryUrl)
  if (!name) throw new ProjectStoreError('PROJECT_NAME_REQUIRED', '项目名称不能为空')
  if (!fileName) throw new ProjectStoreError('PROJECT_FILE_NAME_INVALID', '文件名称只能使用英文、数字、下划线或连字符，并且必须以英文字母开头')
  if (!repositoryUrl) throw new ProjectStoreError('REPOSITORY_URL_INVALID', 'GitHub 仓库地址无效')

  const projectRoot = getProjectRoot(userId, fileName)
  try {
    const record = await prisma.project.create({
      data: {
        userId,
        name,
        fileName,
        localPath: projectRoot,
        source: 'github',
        repositoryUrl,
      },
    })
    return readProject(record)
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')
    throw error
  }
}

export async function prepareImportedProjectTarget(userId: string, input: { fileName: unknown }) {
  const fileName = normalizeProjectFileName(input.fileName)
  if (!fileName) throw new ProjectStoreError('PROJECT_FILE_NAME_INVALID', '文件名称只能使用英文、数字、下划线或连字符，并且必须以英文字母开头')

  await ensureUserRoot(userId)
  const existingRecord = await prisma.project.findFirst({ where: { userId, fileName } })
  if (existingRecord) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')

  const projectRoot = getProjectRoot(userId, fileName)
  const existingPath = await stat(projectRoot).catch(() => null)
  if (existingPath) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')

  const temporaryRoot = resolveInside(getUserRoot(userId), `.import-${fileName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  return { fileName, projectRoot, temporaryRoot }
}

export async function finalizeImportedProject(
  userId: string,
  input: { name: unknown; fileName: unknown; repositoryUrl: unknown; temporaryRoot: string },
) {
  const fileName = normalizeProjectFileName(input.fileName)
  const projectRoot = getProjectRoot(userId, fileName)
  const targetExists = await stat(projectRoot).catch(() => null)
  if (targetExists) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')

  await rename(input.temporaryRoot, projectRoot)
  try {
    return await createImportedProjectRecord(userId, {
      name: input.name,
      fileName,
      repositoryUrl: input.repositoryUrl,
    })
  } catch (error) {
    await rm(projectRoot, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function finalizeZipImportedProject(
  userId: string,
  input: { name: unknown; fileName: unknown; temporaryRoot: string },
) {
  const name = normalizeProjectName(input.name)
  const fileName = normalizeProjectFileName(input.fileName)
  if (!name) throw new ProjectStoreError('PROJECT_NAME_REQUIRED', '项目名称不能为空')
  if (!fileName) throw new ProjectStoreError('PROJECT_FILE_NAME_INVALID', '文件名称只能使用英文、数字、下划线或连字符，并且必须以英文字母开头')

  const projectRoot = getProjectRoot(userId, fileName)
  const targetExists = await stat(projectRoot).catch(() => null)
  if (targetExists) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')

  await rename(input.temporaryRoot, projectRoot)
  try {
    const record = await prisma.project.create({
      data: {
        userId,
        name,
        fileName,
        localPath: projectRoot,
        source: 'zip',
      },
    })
    return readProject(record)
  } catch (error) {
    await rm(projectRoot, { recursive: true, force: true }).catch(() => undefined)
    if (isUniqueConstraintError(error)) throw new ProjectStoreError('PROJECT_EXISTS', '文件名称已存在')
    throw error
  }
}

export async function createProjectFolder(
  userId: string,
  input: { projectId: unknown; parentPath: unknown; folderName: unknown },
) {
  const parentPath = normalizeRelativePath(input.parentPath)
  const folderName = normalizeFolderName(input.folderName)
  if (parentPath === null) throw new ProjectStoreError('PATH_INVALID', '目录路径无效')
  if (!folderName) throw new ProjectStoreError('FOLDER_NAME_INVALID', '文件夹名称不能为空，且不能包含路径分隔符')

  const project = await getProjectRecord(userId, input.projectId)
  const parentRoot = resolveInside(project.localPath, parentPath)
  const target = resolveInside(parentRoot, folderName)
  await mkdir(target, { recursive: false }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new ProjectStoreError('FOLDER_EXISTS', '文件夹已存在')
    throw error
  })

  return touchAndReadProject(project)
}

export async function createProjectFile(
  userId: string,
  input: { projectId: unknown; parentPath: unknown; fileName: unknown; content?: unknown },
) {
  const parentPath = normalizeRelativePath(input.parentPath)
  const fileName = normalizeEntryName(input.fileName)
  if (parentPath === null) throw new ProjectStoreError('PATH_INVALID', '目录路径无效')
  if (!fileName) throw new ProjectStoreError('FILE_NAME_INVALID', '文件名称不能为空，且不能包含路径分隔符')

  const project = await getProjectRecord(userId, input.projectId)
  const parentRoot = resolveInside(project.localPath, parentPath)
  const parentStats = await stat(parentRoot).catch(() => null)
  if (!parentStats?.isDirectory()) throw new ProjectStoreError('FOLDER_NOT_FOUND', '文件夹不存在')

  const target = resolveInside(parentRoot, fileName)
  const content = typeof input.content === 'string' ? input.content : `# ${fileName}\n`
  await writeFile(target, content, { encoding: 'utf8', flag: 'wx' }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') throw new ProjectStoreError('FILE_EXISTS', '文件已存在')
      throw error
    },
  )

  const nextProject = await touchAndReadProject(project)
  const filePath = parentPath ? `${parentPath}/${fileName}` : fileName
  return {
    project: nextProject,
    file: {
      projectId: project.id,
      path: filePath,
      name: fileName,
      content,
      updatedAt: new Date().toISOString(),
    },
  }
}

export async function renameProjectEntry(
  userId: string,
  input: { projectId: unknown; entryPath: unknown; nextName: unknown },
) {
  const entryPath = normalizeRelativePath(input.entryPath)
  const nextName = normalizeEntryName(input.nextName)
  if (!entryPath) throw new ProjectStoreError('PATH_INVALID', '文件路径无效')
  if (!nextName) throw new ProjectStoreError('ENTRY_NAME_INVALID', '名称不能为空，且不能包含路径分隔符')

  const project = await getProjectRecord(userId, input.projectId)
  const source = resolveInside(project.localPath, entryPath)
  const sourceStats = await stat(source).catch(() => null)
  if (!sourceStats) throw new ProjectStoreError('ENTRY_NOT_FOUND', '文件或文件夹不存在')

  const target = resolveInside(path.dirname(source), nextName)
  await rename(source, target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new ProjectStoreError('ENTRY_EXISTS', '同名文件或文件夹已存在')
    throw error
  })

  return touchAndReadProject(project)
}

export async function deleteProjectEntry(userId: string, input: { projectId: unknown; entryPath: unknown }) {
  const entryPath = normalizeRelativePath(input.entryPath)
  if (!entryPath) throw new ProjectStoreError('PATH_INVALID', '文件路径无效')

  const project = await getProjectRecord(userId, input.projectId)
  const target = resolveInside(project.localPath, entryPath)
  const targetStats = await stat(target).catch(() => null)
  if (!targetStats) throw new ProjectStoreError('ENTRY_NOT_FOUND', '文件或文件夹不存在')

  await rm(target, { recursive: targetStats.isDirectory(), force: false })
  return touchAndReadProject(project)
}

export async function deleteUserProject(userId: string, projectId: unknown) {
  const project = await getProjectRecord(userId, projectId)
  const userRoot = path.resolve(getUserRoot(userId))
  const projectRoot = path.resolve(project.localPath)
  const relativePath = path.relative(userRoot, projectRoot)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new ProjectStoreError('PROJECT_PATH_INVALID', '项目目录无效')
  }

  await prisma.project.delete({ where: { id: project.id } })
  await rm(projectRoot, { recursive: true, force: true })

  return {
    id: project.id,
    name: project.name,
    fileName: project.fileName,
  }
}

export async function readProjectFile(userId: string, input: { projectId: unknown; filePath: unknown }) {
  const { project, filePath } = await resolveProjectFile(userId, input)
  const target = resolveInside(project.localPath, filePath)
  const stats = await stat(target).catch(() => null)
  if (!stats?.isFile()) throw new ProjectStoreError('FILE_NOT_FOUND', '文件不存在')
  if (stats.size > 1024 * 1024) throw new ProjectStoreError('FILE_TOO_LARGE', '文件超过 1MB，暂不支持编辑')

  return {
    projectId: project.id,
    path: filePath,
    name: path.basename(filePath),
    content: await readFile(target, 'utf8'),
    updatedAt: stats.mtime.toISOString(),
  }
}

export async function writeProjectFile(
  userId: string,
  input: { projectId: unknown; filePath: unknown; content: unknown },
) {
  const content = typeof input.content === 'string' ? input.content : ''
  const { project, filePath } = await resolveProjectFile(userId, input)
  const target = resolveInside(project.localPath, filePath)
  const stats = await stat(target).catch(() => null)
  if (!stats?.isFile()) throw new ProjectStoreError('FILE_NOT_FOUND', '文件不存在')

  await writeFile(target, content, 'utf8')
  await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } })

  return {
    projectId: project.id,
    path: filePath,
    name: path.basename(filePath),
    content,
    updatedAt: new Date().toISOString(),
  }
}

export async function uploadProjectFiles(
  userId: string,
  input: { projectId: unknown; targetPath: unknown; files: ProjectUploadFile[]; overwrite?: unknown },
) {
  const targetPath = normalizeRelativePath(input.targetPath)
  if (targetPath === null) throw new ProjectStoreError('PATH_INVALID', '目录路径无效')
  if (!input.files.length) throw new ProjectStoreError('UPLOAD_EMPTY', '没有可上传的文件')
  const overwrite = input.overwrite === true || input.overwrite === 'true'
  const project = await getProjectRecord(userId, input.projectId)
  const targetRoot = resolveInside(project.localPath, targetPath)
  const targetStats = await stat(targetRoot).catch(() => null)
  if (!targetStats?.isDirectory()) throw new ProjectStoreError('FOLDER_NOT_FOUND', '目标文件夹不存在')

  const normalizedFiles = input.files.map((file) => {
    const relativePath = normalizeUploadRelativePath(file.relativePath)
    if (!relativePath) throw new ProjectStoreError('UPLOAD_PATH_INVALID', '上传文件路径无效')
    return { ...file, relativePath }
  })
  const conflicts: ProjectEntryConflict[] = []
  for (const file of normalizedFiles) {
    const target = resolveInside(targetRoot, file.relativePath)
    const targetExists = await stat(target).catch(() => null)
    if (targetExists) {
      conflicts.push({
        path: file.relativePath,
        targetPath: targetPath ? `${targetPath}/${file.relativePath}` : file.relativePath,
      })
    }
  }
  if (conflicts.length && !overwrite) return { project: await readProject(project), conflicts, uploaded: 0 }

  let uploaded = 0
  for (const file of normalizedFiles) {
    const target = resolveInside(targetRoot, file.relativePath)
    const targetExists = await stat(target).catch(() => null)
    if (targetExists?.isDirectory()) {
      if (!overwrite) continue
      await rm(target, { recursive: true, force: true })
    }
    await mkdir(path.dirname(target), { recursive: true })
    if (overwrite) {
      await writeFile(target, file.data)
    } else {
      await writeFile(target, file.data, { flag: 'wx' })
    }
    uploaded += 1
  }

  return { project: await touchAndReadProject(project), conflicts: [], uploaded }
}

export async function moveProjectEntries(
  userId: string,
  input: { projectId: unknown; entryPaths: unknown; targetPath: unknown; overwrite?: unknown },
) {
  const targetPath = normalizeRelativePath(input.targetPath)
  if (targetPath === null) throw new ProjectStoreError('PATH_INVALID', '目标目录路径无效')
  const entryPaths = normalizeEntryPathList(input.entryPaths)
  if (!entryPaths.length) throw new ProjectStoreError('MOVE_EMPTY', '没有可移动的文件或文件夹')
  const overwrite = input.overwrite === true || input.overwrite === 'true'
  const project = await getProjectRecord(userId, input.projectId)
  const targetRoot = resolveInside(project.localPath, targetPath)
  const targetStats = await stat(targetRoot).catch(() => null)
  if (!targetStats?.isDirectory()) throw new ProjectStoreError('FOLDER_NOT_FOUND', '目标文件夹不存在')

  const sourcePaths = removeNestedEntryPaths(entryPaths)
  const operations: Array<{ oldPath: string; nextPath: string; source: string; target: string; sourceIsDirectory: boolean }> = []
  const conflicts: ProjectEntryConflict[] = []

  for (const oldPath of sourcePaths) {
    if (!oldPath) throw new ProjectStoreError('PATH_INVALID', '不能移动项目根目录')
    if (targetPath === oldPath || targetPath.startsWith(`${oldPath}/`)) {
      throw new ProjectStoreError('MOVE_INTO_SELF', '不能把文件夹移动到自身或子目录中')
    }
    const source = resolveInside(project.localPath, oldPath)
    const sourceStats = await stat(source).catch(() => null)
    if (!sourceStats) throw new ProjectStoreError('ENTRY_NOT_FOUND', `文件或文件夹不存在：${oldPath}`)
    const nextPath = targetPath ? `${targetPath}/${path.basename(oldPath)}` : path.basename(oldPath)
    if (nextPath === oldPath) continue
    const target = resolveInside(project.localPath, nextPath)
    const targetExists = await stat(target).catch(() => null)
    if (targetExists) conflicts.push({ path: oldPath, targetPath: nextPath })
    operations.push({ oldPath, nextPath, source, target, sourceIsDirectory: sourceStats.isDirectory() })
  }

  if (!operations.length) return { project: await readProject(project), conflicts: [], moved: [] }
  if (conflicts.length && !overwrite) return { project: await readProject(project), conflicts, moved: [] }

  for (const operation of operations) {
    const targetExists = await stat(operation.target).catch(() => null)
    if (targetExists && overwrite) await rm(operation.target, { recursive: targetExists.isDirectory(), force: true })
    await mkdir(path.dirname(operation.target), { recursive: true })
    await rename(operation.source, operation.target)
  }

  return {
    project: await touchAndReadProject(project),
    conflicts: [],
    moved: operations.map((operation) => ({ oldPath: operation.oldPath, nextPath: operation.nextPath })),
  }
}

export async function getProjectWorkingDirectory(userId: string, projectId: unknown) {
  const project = await getProjectRecord(userId, projectId)
  return {
    id: project.id,
    name: project.name,
    fileName: project.fileName,
    localPath: project.localPath,
    repositoryUrl: project.repositoryUrl,
  }
}

export async function updateProjectRepositoryUrl(userId: string, projectId: unknown, repositoryUrl: unknown) {
  const project = await getProjectRecord(userId, projectId)
  const normalizedUrl = normalizeRepositoryUrl(repositoryUrl)
  if (!normalizedUrl) throw new ProjectStoreError('REPOSITORY_URL_INVALID', 'GitHub 仓库地址无效')

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { repositoryUrl: normalizedUrl, source: 'github' },
  })
  return readProject(updated)
}

export function getProjectRootForFileName(userId: string, fileName: string) {
  return getProjectRoot(userId, fileName)
}

export function normalizeProjectFileName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  return /^[a-z][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : ''
}

export function deriveProjectFileNameFromRepository(value: unknown) {
  const repositoryUrl = normalizeRepositoryUrl(value)
  if (!repositoryUrl) return ''
  const lastSegment = repositoryUrl.replace(/\.git$/i, '').split('/').filter(Boolean).pop() || ''
  return normalizeProjectFileName(lastSegment.replace(/[^a-zA-Z0-9_-]/g, '-'))
}

export function isProjectStoreError(error: unknown): error is ProjectStoreError {
  return error instanceof ProjectStoreError
}

export class ProjectStoreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ProjectStoreError'
  }
}

async function readProject(record: ProjectRecord): Promise<UserProject> {
  await mkdir(record.localPath, { recursive: true })
  return {
    id: record.id,
    name: record.name,
    fileName: record.fileName,
    localPath: record.localPath,
    source: record.source,
    repositoryUrl: record.repositoryUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    tree: await readProjectTree(record),
  }
}

async function touchAndReadProject(project: ProjectRecord) {
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { updatedAt: new Date() },
  })
  return readProject(updated)
}

async function ensureDefaultProject(userId: string) {
  await ensureUserRoot(userId)
  const existing = await prisma.project.findFirst({
    where: { userId, fileName: DEFAULT_PROJECT_FILE_NAME },
  })
  if (existing) {
    await ensureDefaultProjectFiles(existing.localPath)
    return existing
  }

  const projectRoot = getProjectRoot(userId, DEFAULT_PROJECT_FILE_NAME)
  await ensureDefaultProjectFiles(projectRoot)
  try {
    return await prisma.project.create({
      data: {
        userId,
        name: '默认项目',
        fileName: DEFAULT_PROJECT_FILE_NAME,
        localPath: projectRoot,
        source: 'local',
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const record = await prisma.project.findFirst({
      where: { userId, fileName: DEFAULT_PROJECT_FILE_NAME },
    })
    if (record) return record
    throw error
  }
}

async function ensureDefaultProjectFiles(projectRoot: string) {
  await mkdir(resolveInside(projectRoot, '_global'), { recursive: true })
  await ensureProjectConfigFiles(projectRoot)
  await mkdir(resolveInside(projectRoot, 'pages'), { recursive: true })
  await mkdir(resolveInside(projectRoot, 'blog/文章'), { recursive: true })
  await mkdir(resolveInside(projectRoot, 'api'), { recursive: true })
  await mkdir(resolveInside(projectRoot, 'components'), { recursive: true })
  await mkdir(resolveInside(projectRoot, 'templates'), { recursive: true })
  await ensureProjectPromptTestFiles(projectRoot)
  await ensureProjectZflowDemoFiles(projectRoot)

  await Promise.all([
    writeFileIfMissing(resolveInside(projectRoot, 'README.md'), examplePrompt),
    writeFileIfMissing(resolveInside(projectRoot, '_global/全局设置.prompt'), examplePrompt),
    writeFileIfMissing(resolveInside(projectRoot, '_global/导航.prompt'), '# 导航.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'pages/首页.prompt'), examplePrompt),
    writeFileIfMissing(resolveInside(projectRoot, 'pages/产品页.prompt'), '# 产品页.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'pages/定价页.prompt'), '# 定价页.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'pages/关于我们.prompt'), '# 关于我们.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'blog/列表页.prompt'), '# 列表页.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'blog/文章/博客文章.prompt'), '# 博客文章.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'blog/文章/文章详情.prompt'), '# 文章详情.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'api/搜索.prompt'), '# 搜索.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'api/订阅.prompt'), '# 订阅.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'components/页头.prompt'), '# 页头.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'components/页脚.prompt'), '# 页脚.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'components/CTA.prompt'), '# CTA.prompt\n'),
    writeFileIfMissing(resolveInside(projectRoot, 'templates/基础模板.prompt'), '# 基础模板.prompt\n'),
  ])
}

async function ensureProjectPromptTestFiles(projectRoot: string) {
  await mkdir(resolveInside(projectRoot, 'templates/提示词测试'), { recursive: true })
  await Promise.all([
    writeFileIfMissing(resolveInside(projectRoot, 'templates/提示词测试/文本生成测试.zpmt'), createDefaultZpmtContent('chat')),
    writeFileIfMissing(resolveInside(projectRoot, 'templates/提示词测试/Agent测试.zpmt'), createDefaultZpmtContent('agent')),
    writeFileIfMissing(resolveInside(projectRoot, 'templates/提示词测试/图片生成测试.zpmt'), createDefaultZpmtContent('image')),
  ])
}

async function ensureProjectZflowDemoFiles(projectRoot: string) {
  await mkdir(resolveInside(projectRoot, 'flows'), { recursive: true })
  await writeFileIfMissing(resolveInside(projectRoot, 'flows/提示词流程.zflow'), createDefaultZflowContent())
}

function createDefaultZpmtContent(kind: ProjectPromptKind) {
  const outputType = kind === 'image' ? 'image' : 'text'
  const document = {
    schema: 'ccks.zpmt',
    version: 3,
    kind,
    config: {
      providerFile: '',
      providerId: '',
      providerName: '',
      model: '',
      outputType,
      responseConfig: {},
    },
    system: kind === 'image' ? '' : kind === 'agent' ? '你是一个严谨的任务执行 Agent。先确认目标，再按步骤完成，并在结果中说明关键依据。\n' : '你是一个专业中文内容助手。输出必须具体、可执行，避免空泛表达。\n',
    user: kind === 'image' ? '' : '请围绕{{str:主题;length<300;default=从词开始提示词工作台}}生成内容。目标读者：{{str:目标读者;length<120;default=提示词工程师}}。当前时间：{{const:当前时间;kind=now}}。\n',
    prompt: kind === 'image' ? '生成一张{{str:主题;length<300;default=从词开始提示词工作台}}的高质量主视觉。参考图：{{img:参考图;count<=3}}。画面风格清晰，主体突出，适合产品介绍或项目封面。\n' : '',
    negativePrompt: kind === 'image' ? '低质量，模糊，水印，文字乱码，主体变形，构图混乱' : '',
    style: {
      preset: '',
      text: kind === 'image' ? '商业级完成度，清晰主体，干净背景，高质量细节' : '',
    },
    tools: [],
    metadata: {
      schemaVersion: 2,
      recipeVariables: [],
    },
  }
  return `${JSON.stringify(document, null, 2)}\n`
}

function createDefaultZflowContent() {
  const document = {
    schema: 'ccks.zflow.langgraph',
    version: 1,
    nodes: [
      {
        id: 'start',
        type: 'zflow',
        position: { x: 60, y: 120 },
        data: {
          label: '起点',
          description: 'LangGraph 流程起点。',
          category: 'start',
          nodeType: 'start',
          kind: 'start',
          icon: 'play',
          runtime: 'start',
          inputPorts: [],
          outputPorts: [{ id: 'out', label: '输出', valueType: 'any' }],
          outputData: [{ id: 'input', label: '输入', valueType: 'string' }],
          config: {},
        },
      },
      {
        id: 'prompt-1',
        type: 'zflow',
        position: { x: 325, y: 120 },
        data: {
          label: '提示词执行',
          description: '引用 .zpmt 文件并绑定输入变量。',
          category: 'data',
          nodeType: 'prompt',
          kind: 'prompt',
          icon: 'message-square',
          runtime: 'transform',
          inputPorts: [{ id: 'in', label: '输入' }],
          outputPorts: [{ id: 'out', label: '输出', valueType: 'text' }],
          outputData: [{ id: 'result', label: '结果', valueType: 'text' }],
          config: { filePath: '', outputPath: 'result', bindings: {} },
        },
      },
      {
        id: 'end',
        type: 'zflow',
        position: { x: 590, y: 120 },
        data: {
          label: '结束节点',
          description: '输出最终结果。',
          category: 'control',
          nodeType: 'end',
          kind: 'end',
          icon: 'check-circle',
          runtime: 'terminal',
          inputPorts: [{ id: 'in', label: '输入' }],
          outputPorts: [],
          config: { outputPath: 'result' },
        },
      },
    ],
    edges: [
      { id: 'start-out-prompt-1-in', source: 'start', sourceHandle: 'out', target: 'prompt-1', targetHandle: 'in', type: 'smoothstep' },
      { id: 'prompt-1-out-end-in', source: 'prompt-1', sourceHandle: 'out', target: 'end', targetHandle: 'in', type: 'smoothstep' },
    ],
    viewport: { x: 70, y: 80, zoom: 0.82 },
  }
  return `${JSON.stringify(document, null, 2)}\n`
}

async function ensureProjectConfigFiles(projectRoot: string) {
  const lexiconRoot = resolveInside(projectRoot, '_global/词汇变量')
  const providerRoot = resolveInside(projectRoot, '_global/供应商')
  await mkdir(lexiconRoot, { recursive: true })
  await mkdir(providerRoot, { recursive: true })

  await Promise.all([
    writeFileIfMissing(resolveInside(lexiconRoot, '系统词汇.zlex'), createSystemZlexContent()),
    ...getDefaultZamfFiles().map((file) => writeFileIfMissing(resolveInside(providerRoot, file.fileName), file.content)),
  ])
}

async function writeFileIfMissing(target: string, content: string) {
  const exists = await stat(target)
    .then((stats) => stats.isFile())
    .catch(() => false)
  if (!exists) await writeFile(target, content, 'utf8')
}

async function copyRepositoryReadme(projectRoot: string) {
  const source = path.join(process.cwd(), 'README.md')
  const target = resolveInside(projectRoot, 'README.md')
  const exists = await stat(source)
    .then((stats) => stats.isFile())
    .catch(() => false)

  if (exists) {
    await copyFile(source, target)
  } else {
    await writeFile(target, '# ccks\n\n新时代 AI 代码编辑工具以及编辑框架。\n', 'utf8')
  }
}

async function readProjectTree(project: ProjectRecord): Promise<ProjectTreeNode> {
  await mkdir(project.localPath, { recursive: true })

  return {
    id: `${project.id}:root`,
    name: `${project.fileName}/`,
    kind: 'folder',
    path: '',
    projectId: project.id,
    children: await readDirectoryChildren(project.localPath, project.id, ''),
  }
}

async function readDirectoryChildren(root: string, projectId: string, relativePath: string): Promise<ProjectTreeNode[]> {
  const directory = resolveInside(root, relativePath)
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const nodes = await Promise.all(
    entries
      .filter((entry) => entry.name !== '.git')
      .map(async (entry) => {
        const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          return {
            id: `${projectId}:${entryPath}`,
            name: entry.name,
            kind: 'folder' as const,
            path: entryPath,
            projectId,
            children: await readDirectoryChildren(root, projectId, entryPath),
          }
        }

        const promptKind = entry.name.toLowerCase().endsWith('.zpmt') ? await readProjectPromptKind(resolveInside(root, entryPath)) : undefined

        return {
          id: `${projectId}:${entryPath}`,
          name: entry.name,
          kind: 'file' as const,
          path: entryPath,
          projectId,
          ...(promptKind ? { promptKind } : {}),
        }
      }),
  )

  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
}

async function readProjectPromptKind(filePath: string): Promise<ProjectPromptKind | undefined> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    if (!isRecord(parsed)) return undefined

    const rawKind = readString(parsed.kind)
    if (rawKind === 'chat' || rawKind === 'agent' || rawKind === 'image') return rawKind

    const config = isRecord(parsed.config) ? parsed.config : {}
    if (readString(config.outputType) === 'image') return 'image'
    if (readString(parsed.system).trim() || hasSystemMessage(parsed.messages)) return 'agent'
    return readString(parsed.schema) === 'ccks.zpmt' ? 'chat' : undefined
  } catch {
    return undefined
  }
}

function hasSystemMessage(value: unknown) {
  return Array.isArray(value) && value.some((item) => isRecord(item) && item.role === 'system' && readString(item.content).trim())
}

async function resolveProjectFile(userId: string, input: { projectId: unknown; filePath?: unknown; path?: unknown }) {
  const filePath = normalizeRelativePath(input.filePath ?? input.path)
  if (!filePath) throw new ProjectStoreError('PATH_INVALID', '文件路径无效')

  return {
    project: await getProjectRecord(userId, input.projectId),
    filePath,
  }
}

async function getProjectRecord(userId: string, projectId: unknown): Promise<ProjectRecord> {
  const id = readString(projectId)
  if (!id) throw new ProjectStoreError('PROJECT_NOT_FOUND', '项目不存在')

  const project = await prisma.project.findFirst({ where: { id, userId } })
  if (!project) throw new ProjectStoreError('PROJECT_NOT_FOUND', '项目不存在')
  return project
}

async function ensureUserRoot(userId: string) {
  await mkdir(getUserRoot(userId), { recursive: true })
}

function getUserRoot(userId: string) {
  return path.join(PROJECT_ROOT, 'users', safePathSegment(userId || 'anonymous'))
}

function getProjectRoot(userId: string, fileName: string) {
  return resolveInside(getUserRoot(userId), fileName)
}

function normalizeProjectName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 64)
}

function normalizeRepositoryUrl(value: unknown) {
  const raw = readString(value)
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    if (parsed.hostname !== 'github.com') return ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    const match = raw.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i)
    return match ? `https://github.com/${match[1]}.git` : ''
  }
}

function normalizeFolderName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().slice(0, 64)
  if (!normalized || normalized === '.' || normalized === '..') return ''
  return /[\\/:*?"<>|]/.test(normalized) ? '' : normalized
}

function normalizeEntryName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().slice(0, 96)
  if (!normalized || normalized === '.' || normalized === '..') return ''
  return /[\\/:*?"<>|]/.test(normalized) ? '' : normalized
}

function normalizeRelativePath(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized) return ''
  if (normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return null
  return normalized
}

function normalizeUploadRelativePath(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
  if (!normalized) return ''
  const segments = normalized.split('/')
  const safeSegments = segments.map((segment) => normalizeEntryName(segment))
  if (safeSegments.some((segment) => !segment)) return ''
  return safeSegments.join('/')
}

function normalizeEntryPathList(value: unknown) {
  const source = Array.isArray(value) ? value : [value]
  const seen = new Set<string>()
  return source
    .map(normalizeRelativePath)
    .filter((item): item is string => typeof item === 'string' && Boolean(item))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function removeNestedEntryPaths(paths: string[]) {
  const sorted = [...paths].sort((a, b) => a.length - b.length)
  const result: string[] = []
  for (const item of sorted) {
    if (result.some((parent) => item.startsWith(`${parent}/`))) continue
    result.push(item)
  }
  return result
}

function safePathSegment(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 96)
  return normalized || 'anonymous'
}

function resolveInside(base: string, ...segments: string[]) {
  const target = path.resolve(base, ...segments)
  const relative = path.relative(base, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectStoreError('PATH_INVALID', '目录路径无效')
  }
  return target
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002')
}
