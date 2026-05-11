import path from 'path'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { unzipSync, zipSync } from 'fflate'

export type ProjectArchiveResult = {
  data: Uint8Array
  fileCount: number
  totalBytes: number
}

export type ProjectDownloadFile = {
  filename: string
  data: Uint8Array
  size: number
}

const MAX_ARCHIVE_FILES = 5000
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024
const MAX_ZIP_BYTES = 200 * 1024 * 1024
const EXCLUDED_ARCHIVE_SEGMENTS = new Set(['.git', 'node_modules', '.next', '.turbo'])
const EXCLUDED_ARCHIVE_FILES = new Set(['.DS_Store', 'Thumbs.db'])

export async function createProjectZip(projectRoot: string, inputPaths: unknown[]): Promise<ProjectArchiveResult> {
  const normalizedPaths = normalizeSelectionPaths(inputPaths)
  const files = new Map<string, Uint8Array>()
  let totalBytes = 0

  async function addFile(relativePath: string, absolutePath: string) {
    if (shouldExcludeArchivePath(relativePath) || files.has(relativePath)) return
    const data = await readFile(absolutePath)
    totalBytes += data.byteLength
    if (files.size + 1 > MAX_ARCHIVE_FILES) throw new ProjectArchiveError('ARCHIVE_FILE_LIMIT_EXCEEDED', `打包文件数量超过 ${MAX_ARCHIVE_FILES} 个`)
    if (totalBytes > MAX_ARCHIVE_BYTES) throw new ProjectArchiveError('ARCHIVE_SIZE_LIMIT_EXCEEDED', '打包内容超过 500MB')
    files.set(relativePath, new Uint8Array(data))
  }

  async function visit(relativePath: string) {
    const target = resolveInside(projectRoot, relativePath)
    const targetStats = await stat(target).catch(() => null)
    if (!targetStats) throw new ProjectArchiveError('ARCHIVE_PATH_NOT_FOUND', `路径不存在：${relativePath || '/'}`)
    if (targetStats.isFile()) {
      await addFile(relativePath, target)
      return
    }
    if (!targetStats.isDirectory()) return

    const entries = await readdir(target, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
      if (shouldExcludeArchivePath(entryPath)) continue
      if (entry.isDirectory()) await visit(entryPath)
      else if (entry.isFile()) await addFile(entryPath, resolveInside(projectRoot, entryPath))
    }
  }

  for (const selectedPath of normalizedPaths.length ? normalizedPaths : ['']) {
    await visit(selectedPath)
  }

  if (!files.size) throw new ProjectArchiveError('ARCHIVE_EMPTY', '没有可打包的文件')
  return {
    data: zipSync(Object.fromEntries(files), { level: 6 }),
    fileCount: files.size,
    totalBytes,
  }
}

export async function readProjectDownloadFile(projectRoot: string, filePath: unknown): Promise<ProjectDownloadFile> {
  const normalizedPath = normalizeArchivePath(filePath)
  if (!normalizedPath) throw new ProjectArchiveError('PATH_INVALID', '文件路径无效')
  if (shouldExcludeArchivePath(normalizedPath)) throw new ProjectArchiveError('PATH_INVALID', '该路径不允许下载')
  const target = resolveInside(projectRoot, normalizedPath)
  const targetStats = await stat(target).catch(() => null)
  if (!targetStats?.isFile()) throw new ProjectArchiveError('FILE_NOT_FOUND', '文件不存在或不是普通文件')
  if (targetStats.size > MAX_ARCHIVE_BYTES) throw new ProjectArchiveError('FILE_TOO_LARGE', '文件超过 500MB，无法下载')
  return {
    filename: path.basename(normalizedPath),
    data: new Uint8Array(await readFile(target)),
    size: targetStats.size,
  }
}

export async function extractProjectZipToDirectory(data: Uint8Array, targetRoot: string) {
  if (data.byteLength > MAX_ZIP_BYTES) throw new ProjectArchiveError('ZIP_TOO_LARGE', 'ZIP 文件超过 200MB')
  const unzipped = unzipSync(data)
  const entries = Object.entries(unzipped)
    .filter(([entryPath]) => !entryPath.endsWith('/'))
    .map(([entryPath, content]) => ({ path: normalizeArchivePath(entryPath), content }))
    .filter((entry): entry is { path: string; content: Uint8Array } => Boolean(entry.path))

  if (!entries.length) throw new ProjectArchiveError('ZIP_EMPTY', 'ZIP 中没有可导入的文件')

  const strippedEntries = stripSingleTopLevelDirectory(entries)
  let totalBytes = 0
  if (strippedEntries.length > MAX_ARCHIVE_FILES) throw new ProjectArchiveError('ZIP_FILE_LIMIT_EXCEEDED', `ZIP 文件数量超过 ${MAX_ARCHIVE_FILES} 个`)
  await rm(targetRoot, { recursive: true, force: true }).catch(() => undefined)
  await mkdir(targetRoot, { recursive: true })

  for (const entry of strippedEntries) {
    if (shouldExcludeArchivePath(entry.path)) throw new ProjectArchiveError('ZIP_PATH_FORBIDDEN', `ZIP 包含不允许导入的路径：${entry.path}`)
    totalBytes += entry.content.byteLength
    if (totalBytes > MAX_ARCHIVE_BYTES) throw new ProjectArchiveError('ZIP_UNPACKED_TOO_LARGE', 'ZIP 解压后超过 500MB')
    const target = resolveInside(targetRoot, entry.path)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, entry.content, { flag: 'wx' })
  }

  return { fileCount: strippedEntries.length, totalBytes }
}

export function normalizeArchivePath(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
  if (!normalized) return ''
  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return ''
  if (segments.some((segment) => /[<>:"|?*\u0000-\u001f]/.test(segment))) return ''
  return segments.join('/')
}

export function shouldExcludeArchivePath(relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  if (!segments.length) return false
  return segments.some((segment) => EXCLUDED_ARCHIVE_SEGMENTS.has(segment) || segment.startsWith('.import-'))
    || EXCLUDED_ARCHIVE_FILES.has(segments[segments.length - 1] || '')
}

export function sanitizeDownloadFilename(value: string, fallback: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').slice(0, 120)
  return normalized || fallback
}

export class ProjectArchiveError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ProjectArchiveError'
  }
}

export function isProjectArchiveError(error: unknown): error is ProjectArchiveError {
  return error instanceof ProjectArchiveError
}

function normalizeSelectionPaths(inputPaths: unknown[]) {
  const seen = new Set<string>()
  return inputPaths
    .flatMap((value) => {
      if (typeof value !== 'string') return []
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // Query strings may pass paths as repeated plain values.
      }
      return [value]
    })
    .map(normalizeArchivePath)
    .filter((item) => item || item === '')
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function stripSingleTopLevelDirectory(entries: Array<{ path: string; content: Uint8Array }>) {
  const topSegments = new Set(entries.map((entry) => entry.path.split('/')[0]).filter(Boolean))
  const allNested = entries.every((entry) => entry.path.includes('/'))
  if (topSegments.size !== 1 || !allNested) return entries
  return entries
    .map((entry) => ({ ...entry, path: entry.path.split('/').slice(1).join('/') }))
    .filter((entry) => entry.path)
}

function resolveInside(base: string, ...segments: string[]) {
  const target = path.resolve(base, ...segments)
  const relative = path.relative(base, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectArchiveError('PATH_INVALID', '目录路径无效')
  }
  return target
}
