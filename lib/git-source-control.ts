import { execFile } from 'child_process'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type GitChangeKind = 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored' | 'conflict'
export type GitChangeGroupId = 'staged' | 'unstaged' | 'untracked' | 'conflicts'

export type GitChange = {
  path: string
  status: string
  statusCode: string
  kind: GitChangeKind
  originalPath?: string
  indexStatus: string
  workingTreeStatus: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
  conflicted: boolean
}

export type GitDecoration = {
  path: string
  status: string
  kind: GitChangeKind
  count: number
}

export type SourceControlStatus = {
  connected: boolean
  branch: string
  upstream: string
  ahead: number
  behind: number
  repositoryUrl: string
  workingDirectory: string
  hasRemote: boolean
  changes: GitChange[]
  groups: Record<GitChangeGroupId, GitChange[]>
  decorations: Record<string, GitDecoration>
  remotes: Array<{ name: string; url: string }>
  branches: Array<{ name: string; current: boolean; remote?: boolean }>
}

export type SourceControlDiff = {
  path: string
  originalPath?: string
  original: string
  modified: string
  staged: boolean
  language: string
}

export async function cloneGitHubRepository(repositoryUrl: string, token: string, targetPath: string) {
  await runGit([
    ...withGitHubToken([], token),
    'clone',
    '--',
    repositoryUrl,
    targetPath,
  ])
  await runProjectGit(['remote', 'set-url', 'origin', repositoryUrl], targetPath)
}

export async function readSourceControlStatus(projectPath: string): Promise<SourceControlStatus> {
  const projectRoot = path.resolve(projectPath)
  const hasRepository = await hasProjectRepository(projectRoot)
  if (!hasRepository) return createEmptyStatus(projectRoot)

  const remote = await runProjectGit(['remote', 'get-url', 'origin'], projectRoot).catch(() => ({ stdout: '' }))
  const remotes = await readRemotes(projectRoot)
  const branches = await readBranches(projectRoot)
  const result = await runProjectGit(['-c', 'core.quotePath=false', 'status', '--porcelain=v1', '-b', '--untracked-files=all'], projectRoot)

  const lines = result.stdout.split(/\r?\n/).filter(Boolean)
  const branchLine = lines.find((line) => line.startsWith('## ')) || ''
  const branchInfo = parseBranchLine(branchLine)
  const changes = lines.filter((line) => !line.startsWith('## ')).map(parsePorcelainChange)

  return {
    connected: true,
    branch: branchInfo.branch,
    upstream: branchInfo.upstream,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
    repositoryUrl: remote.stdout.trim(),
    workingDirectory: projectRoot,
    hasRemote: Boolean(remote.stdout.trim() || remotes.length),
    changes,
    groups: groupChanges(changes),
    decorations: buildDecorations(changes),
    remotes,
    branches,
  }
}

export async function initializeProjectRepository(projectPath: string) {
  const projectRoot = path.resolve(projectPath)
  const hasRepository = await hasProjectRepository(projectRoot)
  if (!hasRepository) await runGit(['init', projectRoot])

  await ensureGitIdentity(projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function stageProjectPath(projectPath: string, targetPath?: unknown) {
  const projectRoot = await requireProjectRepository(projectPath)
  const pathspec = normalizePathSpec(targetPath)
  await runProjectGit(pathspec ? ['add', '--', pathspec] : ['add', '-A'], projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function unstageProjectPath(projectPath: string, targetPath?: unknown) {
  const projectRoot = await requireProjectRepository(projectPath)
  const pathspec = normalizePathSpec(targetPath)
  const args = pathspec ? ['restore', '--staged', '--', pathspec] : ['restore', '--staged', '--', '.']
  await runProjectGit(args, projectRoot).catch(async () => {
    await runProjectGit(pathspec ? ['rm', '--cached', '-r', '--', pathspec] : ['rm', '--cached', '-r', '--', '.'], projectRoot)
  })
  return readSourceControlStatus(projectRoot)
}

export async function discardProjectPath(projectPath: string, targetPath?: unknown) {
  const projectRoot = await requireProjectRepository(projectPath)
  const pathspec = normalizePathSpec(targetPath)
  const targetArgs = pathspec ? ['--', pathspec] : ['--', '.']

  await runProjectGit(['restore', '--staged', ...targetArgs], projectRoot).catch(() => undefined)
  await runProjectGit(['restore', '--worktree', ...targetArgs], projectRoot).catch(() => undefined)
  await runProjectGit(['clean', '-fd', ...targetArgs], projectRoot).catch(() => undefined)
  return readSourceControlStatus(projectRoot)
}

export async function commitProjectChanges(projectPath: string, message: string, mode: 'all' | 'staged' = 'staged') {
  const normalizedMessage = message.trim()
  if (!normalizedMessage) throw new GitSourceControlError('COMMIT_MESSAGE_REQUIRED', '提交信息不能为空')

  const projectRoot = await requireProjectRepository(projectPath)
  await ensureGitIdentity(projectRoot)
  if (mode === 'all') await runProjectGit(['add', '-A'], projectRoot)

  const status = await readSourceControlStatus(projectRoot)
  if (status.groups.conflicts.length) throw new GitSourceControlError('MERGE_CONFLICTS', '存在合并冲突，请先解决冲突后再提交')
  if (!status.groups.staged.length) throw new GitSourceControlError('NO_STAGED_CHANGES', '没有暂存的变更')

  await runProjectGit(['-c', 'user.name=CCKS Bot', '-c', 'user.email=ccks@example.local', 'commit', '-m', normalizedMessage], projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function pushProjectRepository(projectPath: string, token?: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  const status = await requireRemote(projectRoot)
  requireGitHubTokenForWrite(status, token)
  await runProjectGit(withGitHubToken(['push', '-u', 'origin', 'HEAD'], token), projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function pullProjectRepository(projectPath: string, token?: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  await requireRemote(projectRoot)
  const status = await readSourceControlStatus(projectRoot)
  const pullArgs = status.upstream ? ['pull', '--ff-only'] : ['pull', '--ff-only', 'origin', status.branch || 'HEAD']
  await runProjectGit(withGitHubToken(pullArgs, token), projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function syncProjectRepository(projectPath: string, token?: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  const remoteStatus = await requireRemote(projectRoot)
  requireGitHubTokenForWrite(remoteStatus, token)
  const status = await readSourceControlStatus(projectRoot)
  if (status.behind > 0 || status.upstream) {
    await pullProjectRepository(projectRoot, token)
  }
  return pushProjectRepository(projectRoot, token)
}

export async function fetchProjectRepository(projectPath: string, token?: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  await requireRemote(projectRoot)
  await runProjectGit(withGitHubToken(['fetch', '--prune', 'origin'], token), projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function setProjectRemote(projectPath: string, repositoryUrl: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  const normalizedUrl = normalizeGitRemoteUrl(repositoryUrl)
  if (!normalizedUrl) throw new GitSourceControlError('REMOTE_URL_INVALID', 'GitHub 仓库地址无效')

  const hasOrigin = await runProjectGit(['remote', 'get-url', 'origin'], projectRoot).then(() => true).catch(() => false)
  await runProjectGit(hasOrigin ? ['remote', 'set-url', 'origin', normalizedUrl] : ['remote', 'add', 'origin', normalizedUrl], projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function checkoutProjectBranch(projectPath: string, branchName: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  const normalized = normalizeBranchName(branchName)
  if (!normalized) throw new GitSourceControlError('BRANCH_NAME_INVALID', '分支名称无效')

  if (normalized.startsWith('origin/')) {
    const localBranch = normalized.replace(/^origin\//, '')
    const localExists = await runProjectGit(['rev-parse', '--verify', localBranch], projectRoot)
      .then(() => true)
      .catch(() => false)
    await runProjectGit(localExists ? ['checkout', localBranch] : ['checkout', '--track', normalized], projectRoot)
  } else {
    await runProjectGit(['checkout', normalized], projectRoot)
  }
  return readSourceControlStatus(projectRoot)
}

export async function createProjectBranch(projectPath: string, branchName: string) {
  const projectRoot = await requireProjectRepository(projectPath)
  const normalized = normalizeBranchName(branchName)
  if (!normalized) throw new GitSourceControlError('BRANCH_NAME_INVALID', '分支名称无效')

  await runProjectGit(['checkout', '-b', normalized], projectRoot)
  return readSourceControlStatus(projectRoot)
}

export async function publishProjectRepository(
  projectPath: string,
  input: { repositoryName: unknown; privateRepository?: unknown; token: string },
) {
  const repositoryName = normalizeRepositoryName(input.repositoryName)
  const token = input.token.trim()
  if (!repositoryName) throw new GitSourceControlError('REPOSITORY_NAME_INVALID', '仓库名称只能使用英文、数字、下划线、连字符或点')
  if (!token) throw new GitSourceControlError('GITHUB_TOKEN_REQUIRED', '请先连接 GitHub')

  const repository = await createGitHubRepository(token, {
    name: repositoryName,
    private: input.privateRepository !== false,
  })
  const projectRoot = path.resolve(projectPath)
  await initializeProjectRepository(projectRoot)
  await setProjectRemote(projectRoot, repository.cloneUrl)
  await ensureGitIdentity(projectRoot)

  const hasCommit = await hasAnyCommit(projectRoot)
  if (!hasCommit) {
    await runProjectGit(['add', '-A'], projectRoot)
    const status = await readSourceControlStatus(projectRoot)
    if (status.groups.staged.length) {
      await runProjectGit(['-c', 'user.name=CCKS Bot', '-c', 'user.email=ccks@example.local', 'commit', '-m', 'Initial commit'], projectRoot)
    } else {
      await runProjectGit(['commit', '--allow-empty', '-m', 'Initial commit'], projectRoot)
    }
  }

  await pushProjectRepository(projectRoot, token)
  return {
    repositoryUrl: repository.cloneUrl,
    htmlUrl: repository.htmlUrl,
    status: await readSourceControlStatus(projectRoot),
  }
}

export async function commitAndPush(projectPath: string, message: string, token: string) {
  await commitProjectChanges(projectPath, message, 'all')
  return pushProjectRepository(projectPath, token)
}

export async function readProjectDiff(projectPath: string, filePath: unknown, staged: boolean): Promise<SourceControlDiff> {
  const projectRoot = await requireProjectRepository(projectPath)
  const pathspec = normalizePathSpec(filePath)
  if (!pathspec) throw new GitSourceControlError('PATH_INVALID', '文件路径无效')

  const status = await readSourceControlStatus(projectRoot)
  const change = status.changes.find((item) => item.path === pathspec || item.originalPath === pathspec)
  const targetPath = change?.path || pathspec
  const originalPath = change?.originalPath || targetPath
  const language = getEditorLanguage(targetPath)

  if (staged) {
    return {
      path: targetPath,
      originalPath: change?.originalPath,
      original: await readGitText(projectRoot, `HEAD:${originalPath}`),
      modified: await readGitText(projectRoot, `:${targetPath}`),
      staged: true,
      language,
    }
  }

  return {
    path: targetPath,
    originalPath: change?.originalPath,
    original: change?.untracked ? '' : await readGitText(projectRoot, `:${originalPath}`) || (await readGitText(projectRoot, `HEAD:${originalPath}`)),
    modified: change?.kind === 'deleted' ? '' : await readWorkingTreeText(projectRoot, targetPath),
    staged: false,
    language,
  }
}

export function isGitSourceControlError(error: unknown): error is GitSourceControlError {
  return error instanceof GitSourceControlError
}

export class GitSourceControlError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GitSourceControlError'
  }
}

function createEmptyStatus(projectRoot: string): SourceControlStatus {
  return {
    connected: false,
    branch: '',
    upstream: '',
    ahead: 0,
    behind: 0,
    repositoryUrl: '',
    workingDirectory: projectRoot,
    hasRemote: false,
    changes: [],
    groups: {
      staged: [],
      unstaged: [],
      untracked: [],
      conflicts: [],
    },
    decorations: {},
    remotes: [],
    branches: [],
  }
}

function parseBranchLine(line: string) {
  const raw = line.replace(/^##\s+/, '')
  const unborn = raw.match(/^No commits yet on (.+)$/)
  if (unborn) {
    return {
      branch: unborn[1].trim(),
      upstream: '',
      ahead: 0,
      behind: 0,
    }
  }
  const counts = raw.match(/\[(.*?)\]/)?.[1] || ''
  const withoutCounts = raw.replace(/\s+\[.*?\]$/, '')
  const [branch = '', upstream = ''] = withoutCounts.split('...')

  return {
    branch: branch.replace(/^HEAD detached at /, 'HEAD detached ').trim(),
    upstream: upstream.trim(),
    ahead: readCount(counts, 'ahead'),
    behind: readCount(counts, 'behind'),
  }
}

function readCount(value: string, label: 'ahead' | 'behind') {
  const match = value.match(new RegExp(`${label}\\s+(\\d+)`))
  return match ? Number(match[1]) : 0
}

function parsePorcelainChange(line: string): GitChange {
  const rawStatus = line.slice(0, 2)
  const rawPath = line.slice(3).trim()
  const renameSeparator = ' -> '
  const isRenameOrCopy = /[RC]/.test(rawStatus)
  const base = createChange(rawStatus, rawPath)

  if (isRenameOrCopy && rawPath.includes(renameSeparator)) {
    const [originalPath, ...nextParts] = rawPath.split(renameSeparator)
    return {
      ...base,
      originalPath,
      path: nextParts.join(renameSeparator),
    }
  }

  return base
}

function createChange(rawStatus: string, rawPath: string): GitChange {
  const indexStatus = rawStatus[0] || ' '
  const workingTreeStatus = rawStatus[1] || ' '
  const conflicted = isConflictStatus(rawStatus)
  const untracked = indexStatus === '?' && workingTreeStatus === '?'
  const staged = !conflicted && !untracked && indexStatus !== ' ' && indexStatus !== '!'
  const unstaged = !conflicted && !untracked && workingTreeStatus !== ' ' && workingTreeStatus !== '!'
  const kind = resolveChangeKind(indexStatus, workingTreeStatus, conflicted, untracked)

  return {
    path: rawPath,
    status: statusLabel(kind),
    statusCode: normalizePorcelainStatus(indexStatus, workingTreeStatus, kind),
    kind,
    indexStatus,
    workingTreeStatus,
    staged,
    unstaged,
    untracked,
    conflicted,
  }
}

function isConflictStatus(status: string) {
  return ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(status)
}

function resolveChangeKind(indexStatus: string, workingTreeStatus: string, conflicted: boolean, untracked: boolean): GitChangeKind {
  const combined = `${indexStatus}${workingTreeStatus}`
  if (conflicted) return 'conflict'
  if (untracked) return 'untracked'
  if (combined.includes('!')) return 'ignored'
  if (combined.includes('R')) return 'renamed'
  if (combined.includes('C')) return 'copied'
  if (combined.includes('A')) return 'added'
  if (combined.includes('D')) return 'deleted'
  return 'modified'
}

function statusLabel(kind: GitChangeKind) {
  const labels: Record<GitChangeKind, string> = {
    modified: 'Modified',
    added: 'Added',
    deleted: 'Deleted',
    renamed: 'Renamed',
    copied: 'Copied',
    untracked: 'Untracked',
    ignored: 'Ignored',
    conflict: 'Conflict',
  }
  return labels[kind]
}

function normalizePorcelainStatus(indexStatus: string, workingTreeStatus: string, kind: GitChangeKind) {
  if (kind === 'conflict') return '!'
  if (kind === 'untracked') return 'U'
  if (kind === 'ignored') return 'I'
  if (kind === 'renamed') return 'R'
  if (kind === 'copied') return 'C'
  if (kind === 'added') return 'A'
  if (kind === 'deleted') return 'D'
  if (indexStatus === 'M' || workingTreeStatus === 'M') return 'M'
  return (indexStatus + workingTreeStatus).trim() || 'M'
}

function groupChanges(changes: GitChange[]): Record<GitChangeGroupId, GitChange[]> {
  return {
    staged: changes.filter((change) => change.staged),
    unstaged: changes.filter((change) => change.unstaged),
    untracked: changes.filter((change) => change.untracked),
    conflicts: changes.filter((change) => change.conflicted),
  }
}

function buildDecorations(changes: GitChange[]) {
  const decorations: Record<string, GitDecoration> = {}
  for (const change of changes) {
    addDecoration(decorations, change.path, change.kind)
    const segments = change.path.split('/').filter(Boolean)
    for (let index = 1; index < segments.length; index += 1) {
      addDecoration(decorations, segments.slice(0, index).join('/'), change.kind)
    }
  }
  return decorations
}

function addDecoration(decorations: Record<string, GitDecoration>, entryPath: string, kind: GitChangeKind) {
  const current = decorations[entryPath]
  if (!current) {
    decorations[entryPath] = {
      path: entryPath,
      kind,
      status: normalizePorcelainStatus(kind[0].toUpperCase(), ' ', kind),
      count: 1,
    }
    return
  }

  const nextKind = compareKindPriority(kind, current.kind) > 0 ? kind : current.kind
  decorations[entryPath] = {
    ...current,
    kind: nextKind,
    status: normalizePorcelainStatus(nextKind[0].toUpperCase(), ' ', nextKind),
    count: current.count + 1,
  }
}

function compareKindPriority(left: GitChangeKind, right: GitChangeKind) {
  const priority: Record<GitChangeKind, number> = {
    ignored: 0,
    copied: 1,
    renamed: 2,
    untracked: 3,
    added: 4,
    modified: 5,
    deleted: 6,
    conflict: 7,
  }
  return priority[left] - priority[right]
}

async function readRemotes(projectRoot: string) {
  const result = await runProjectGit(['remote', '-v'], projectRoot).catch(() => ({ stdout: '' }))
  const remotes = new Map<string, string>()
  result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/)
      if (match) remotes.set(match[1], match[2])
    })
  return [...remotes].map(([name, url]) => ({ name, url }))
}

async function readBranches(projectRoot: string) {
  const result = await runProjectGit(['branch', '--all', '--format=%(refname:short)|%(HEAD)'], projectRoot).catch(() => ({ stdout: '' }))
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('origin/HEAD'))
    .map((line) => {
      const [name, head] = line.split('|')
      return { name, current: head === '*', remote: name.startsWith('origin/') }
    })
}

async function ensureGitIdentity(projectRoot: string) {
  await runProjectGit(['config', 'user.name', 'CCKS Bot'], projectRoot).catch(() => undefined)
  await runProjectGit(['config', 'user.email', 'ccks@example.local'], projectRoot).catch(() => undefined)
}

async function requireProjectRepository(projectPath: string) {
  const projectRoot = path.resolve(projectPath)
  const hasRepository = await hasProjectRepository(projectRoot)
  if (!hasRepository) throw new GitSourceControlError('GIT_REPOSITORY_NOT_FOUND', '当前项目未绑定 Git 仓库')
  return projectRoot
}

async function requireRemote(projectRoot: string) {
  const status = await readSourceControlStatus(projectRoot)
  if (!status.hasRemote) throw new GitSourceControlError('REMOTE_REQUIRED', '当前项目未设置 GitHub 远程仓库')
  return status
}

async function hasAnyCommit(projectRoot: string) {
  return runProjectGit(['rev-parse', '--verify', 'HEAD'], projectRoot)
    .then(() => true)
    .catch(() => false)
}

async function runGit(args: string[], cwd?: string) {
  try {
    return await execFileAsync('git', args, {
      cwd,
      env: cwd ? { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(cwd)) } : process.env,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    })
  } catch (error) {
    const message = readGitError(error)
    throw new GitSourceControlError('GIT_COMMAND_FAILED', message || 'Git 命令执行失败')
  }
}

async function runProjectGit(args: string[], projectPath: string) {
  const projectRoot = path.resolve(projectPath)
  return runGit(['--git-dir', path.join(projectRoot, '.git'), '--work-tree', projectRoot, ...args], projectRoot)
}

async function hasProjectRepository(projectPath: string) {
  const repositoryMarker = path.join(path.resolve(projectPath), '.git')
  return stat(repositoryMarker)
    .then((stats) => stats.isDirectory())
    .catch(() => false)
}

async function createGitHubRepository(token: string, input: { name: string; private: boolean }) {
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      private: input.private,
      auto_init: false,
    }),
    cache: 'no-store',
  }).catch(() => null)

  const payload = await response?.json().catch(() => null)
  if (!response?.ok) {
    throw new GitSourceControlError('GITHUB_REPOSITORY_CREATE_FAILED', readGitHubMessage(payload) || 'GitHub 仓库创建失败')
  }

  const cloneUrl = typeof payload?.clone_url === 'string' ? payload.clone_url : ''
  const htmlUrl = typeof payload?.html_url === 'string' ? payload.html_url : cloneUrl
  if (!cloneUrl) throw new GitSourceControlError('GITHUB_REPOSITORY_CREATE_FAILED', 'GitHub 仓库地址缺失')
  return { cloneUrl, htmlUrl }
}

function normalizePathSpec(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string') throw new GitSourceControlError('PATH_INVALID', '文件路径无效')
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized) return ''
  if (
    /[*?[\]{}:]/.test(normalized) ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..' || segment === '.git')
  ) {
    throw new GitSourceControlError('PATH_INVALID', '文件路径无效')
  }
  return normalized
}

function normalizeGitRemoteUrl(value: unknown) {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
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

function normalizeBranchName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().slice(0, 96)
  if (!normalized || normalized.startsWith('-') || normalized.includes('..') || /[\s~^:?*[\\]/.test(normalized)) return ''
  return normalized
}

function normalizeRepositoryName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().slice(0, 96)
  return /^[a-zA-Z0-9._-]+$/.test(normalized) ? normalized : ''
}

function withGitHubToken(args: string[], token?: string) {
  const normalizedToken = token?.trim()
  return normalizedToken ? ['-c', buildGitHubGitAuthHeader(normalizedToken), ...args] : args
}

function buildGitHubGitAuthHeader(token: string) {
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')
  return `http.extraHeader=AUTHORIZATION: basic ${basic}`
}

async function readGitText(projectRoot: string, revisionPath: string) {
  return runProjectGit(['show', revisionPath], projectRoot)
    .then((result) => result.stdout)
    .catch(() => '')
}

async function readWorkingTreeText(projectRoot: string, filePath: string) {
  const target = path.resolve(projectRoot, filePath)
  const relative = path.relative(projectRoot, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new GitSourceControlError('PATH_INVALID', '文件路径无效')
  return readFile(target, 'utf8').catch(() => '')
}

function requireGitHubTokenForWrite(status: SourceControlStatus, token?: string) {
  if (isGitHubRemote(status.repositoryUrl) && !token?.trim()) {
    throw new GitSourceControlError('GITHUB_TOKEN_REQUIRED', '请先连接 GitHub')
  }
}

function isGitHubRemote(value: string) {
  return /^https:\/\/github\.com\//i.test(value) || /^git@github\.com:/i.test(value)
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

function readGitHubMessage(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  const source = value as { message?: unknown; errors?: unknown }
  const message = typeof source.message === 'string' ? source.message : ''
  const errors = Array.isArray(source.errors)
    ? source.errors
        .map((error) => (error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '') : ''))
        .filter(Boolean)
        .join('；')
    : ''
  return [message, errors].filter(Boolean).join('：')
}

function readGitError(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const source = error as { stderr?: unknown; stdout?: unknown; message?: unknown }
  return readString(source.stderr) || readString(source.stdout) || readString(source.message)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
