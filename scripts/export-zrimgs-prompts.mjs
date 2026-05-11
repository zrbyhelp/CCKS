import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mariadb from 'mariadb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const defaultSourceRoot = path.resolve(repoRoot, '..', 'ZrImgs')
const defaultOutputRoot = path.resolve(repoRoot, '.ccks-local', 'zrimgs-prompts')

const options = parseArgs(process.argv.slice(2))
const sourceRoot = path.resolve(options.sourceRoot || defaultSourceRoot)
const outputRoot = path.resolve(options.output || defaultOutputRoot)
const batchSize = readPositiveInteger(options.batchSize, 500)
const maxRows = readPositiveInteger(options.maxRows, 0)
const maxRetries = readPositiveInteger(options.retries, 5)

const sourceEnv = parseEnvFile(await fs.readFile(path.join(sourceRoot, '.env'), 'utf8'))
const databaseUrl = sourceEnv.DATABASE_URL || ''
if (!databaseUrl) throw new Error(`DATABASE_URL not found in ${path.join(sourceRoot, '.env')}`)

await fs.mkdir(outputRoot, { recursive: true })

const rawPath = path.join(outputRoot, 'raw-prompts.jsonl')
const normalizedPath = path.join(outputRoot, 'normalized-prompts.jsonl')
const statsPath = path.join(outputRoot, 'prompt-stats.json')
const samplePath = path.join(outputRoot, 'sample-review.md')

await fs.rm(rawPath, { force: true })
await fs.rm(normalizedPath, { force: true })

const connectionConfig = createMariadbConfig(databaseUrl)
const connection = await connectWithRetry(connectionConfig, maxRetries)

try {
  const prompts = new Map()
  const stats = {
    sourceRoot,
    outputRoot,
    exportedAt: new Date().toISOString(),
    table: 'ImageSet',
    totalRowsRead: 0,
    nonEmptyRows: 0,
    uniquePrompts: 0,
    duplicateRows: 0,
    reviewStatus: {},
    apiProviders: {},
    apiModels: {},
    promptLength: { min: 0, max: 0, average: 0 },
  }

  let lastId = ''
  let done = false
  let totalLength = 0
  let minLength = Number.POSITIVE_INFINITY
  let maxLength = 0

  while (!done) {
    const remaining = maxRows > 0 ? Math.max(0, maxRows - stats.totalRowsRead) : batchSize
    if (maxRows > 0 && remaining <= 0) break
    const limit = Math.min(batchSize, remaining)
    const rows = await queryWithRetry(
      connection,
      `
        SELECT id, prompt, apiProvider, apiModel, reviewStatus, createdAt
        FROM ImageSet
        WHERE id > ? AND TRIM(prompt) <> ''
        ORDER BY id ASC
        LIMIT ?
      `,
      [lastId, limit],
      maxRetries,
    )

    if (!rows.length) {
      done = true
      break
    }

    for (const row of rows) {
      lastId = String(row.id || '')
      const prompt = String(row.prompt || '')
      const normalizedPrompt = normalizePrompt(prompt)
      if (!normalizedPrompt) continue

      stats.totalRowsRead += 1
      stats.nonEmptyRows += 1
      totalLength += normalizedPrompt.length
      minLength = Math.min(minLength, normalizedPrompt.length)
      maxLength = Math.max(maxLength, normalizedPrompt.length)

      const rawEntry = {
        id: String(row.id || ''),
        prompt,
        normalizedPrompt,
        hash: hashText(normalizedPrompt),
        apiProvider: normalizeNullableString(row.apiProvider),
        apiModel: normalizeNullableString(row.apiModel),
        reviewStatus: normalizeNullableString(row.reviewStatus),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : normalizeNullableString(row.createdAt),
      }
      await appendJsonLine(rawPath, rawEntry)

      increment(stats.reviewStatus, rawEntry.reviewStatus || 'UNKNOWN')
      increment(stats.apiProviders, rawEntry.apiProvider || 'UNKNOWN')
      increment(stats.apiModels, rawEntry.apiModel || 'UNKNOWN')

      const current = prompts.get(rawEntry.hash)
      if (current) {
        current.occurrences += 1
        current.sourceIds.push(rawEntry.id)
        current.reviewStatus[rawEntry.reviewStatus || 'UNKNOWN'] = (current.reviewStatus[rawEntry.reviewStatus || 'UNKNOWN'] || 0) + 1
        current.apiProviders[rawEntry.apiProvider || 'UNKNOWN'] = (current.apiProviders[rawEntry.apiProvider || 'UNKNOWN'] || 0) + 1
        current.apiModels[rawEntry.apiModel || 'UNKNOWN'] = (current.apiModels[rawEntry.apiModel || 'UNKNOWN'] || 0) + 1
        if (rawEntry.createdAt) current.lastCreatedAt = maxIsoDate(current.lastCreatedAt, rawEntry.createdAt)
      } else {
        prompts.set(rawEntry.hash, {
          hash: rawEntry.hash,
          prompt,
          normalizedPrompt,
          occurrences: 1,
          sourceIds: [rawEntry.id],
          firstCreatedAt: rawEntry.createdAt || '',
          lastCreatedAt: rawEntry.createdAt || '',
          reviewStatus: { [rawEntry.reviewStatus || 'UNKNOWN']: 1 },
          apiProviders: { [rawEntry.apiProvider || 'UNKNOWN']: 1 },
          apiModels: { [rawEntry.apiModel || 'UNKNOWN']: 1 },
        })
      }
    }
  }

  const sortedPrompts = Array.from(prompts.values()).sort((left, right) => right.occurrences - left.occurrences || left.hash.localeCompare(right.hash))
  for (const item of sortedPrompts) {
    await appendJsonLine(normalizedPath, {
      ...item,
      sourceIds: item.sourceIds.slice(0, 20),
      sourceIdCount: item.sourceIds.length,
    })
  }

  stats.uniquePrompts = sortedPrompts.length
  stats.duplicateRows = Math.max(0, stats.nonEmptyRows - stats.uniquePrompts)
  stats.promptLength = {
    min: Number.isFinite(minLength) ? minLength : 0,
    max: maxLength,
    average: stats.nonEmptyRows ? Math.round((totalLength / stats.nonEmptyRows) * 100) / 100 : 0,
  }

  await fs.writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8')
  await fs.writeFile(samplePath, createSampleReview(stats, sortedPrompts), 'utf8')

  console.log(`Exported ${stats.nonEmptyRows} rows, ${stats.uniquePrompts} unique prompts.`)
  console.log(`Output: ${outputRoot}`)
} finally {
  await connection.end().catch(() => undefined)
}

function createMariadbConfig(rawUrl) {
  const url = new URL(rawUrl)
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 1,
    connectTimeout: 15000,
    socketTimeout: 60000,
  }
}

async function connectWithRetry(config, retries) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await mariadb.createConnection(config)
    } catch (error) {
      lastError = error
      await sleep(Math.min(1000 * attempt, 8000))
    }
  }
  throw lastError
}

async function queryWithRetry(connection, sql, params, retries) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await connection.query(sql, params)
    } catch (error) {
      lastError = error
      await sleep(Math.min(1000 * attempt, 8000))
    }
  }
  throw lastError
}

function parseEnvFile(content) {
  const result = {}
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    result[match[1]] = value
  }
  return result
}

function parseArgs(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = args[index + 1]
    if (!next || next.startsWith('--')) parsed[key] = '1'
    else {
      parsed[key] = next
      index += 1
    }
  }
  return parsed
}

function normalizePrompt(value) {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, '')
    .trim()
}

function hashText(value) {
  return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex')
}

function normalizeNullableString(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1
}

function maxIsoDate(left, right) {
  if (!left) return right
  if (!right) return left
  return left > right ? left : right
}

async function appendJsonLine(filePath, value) {
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8')
}

function createSampleReview(stats, prompts) {
  const topPrompts = prompts.slice(0, 30)
  const longPrompts = [...prompts].sort((left, right) => right.normalizedPrompt.length - left.normalizedPrompt.length).slice(0, 10)
  return [
    '# ZrImgs 提示词本地数据集',
    '',
    `- 导出时间：${stats.exportedAt}`,
    `- 非空记录：${stats.nonEmptyRows}`,
    `- 去重后提示词：${stats.uniquePrompts}`,
    `- 重复记录：${stats.duplicateRows}`,
    `- 平均长度：${stats.promptLength.average}`,
    '',
    '## 高频提示词样本',
    '',
    ...topPrompts.map((item, index) => `${index + 1}. (${item.occurrences}) ${truncate(item.normalizedPrompt, 220)}`),
    '',
    '## 长提示词样本',
    '',
    ...longPrompts.map((item, index) => `${index + 1}. (${item.normalizedPrompt.length}) ${truncate(item.normalizedPrompt, 260)}`),
    '',
  ].join('\n')
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
