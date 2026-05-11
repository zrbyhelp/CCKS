import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const TOKEN_PREFIX = 'ccks_'

export type UserApiTokenSummary = {
  exists: boolean
  tokenPrefix: string
  tokenMasked: string
  createdAt: string | null
  updatedAt: string | null
  lastUsedAt: string | null
}

export async function getUserApiTokenSummary(userId: string): Promise<UserApiTokenSummary> {
  const record = await prisma.userApiToken.findUnique({ where: { userId } })
  if (!record) {
    return {
      exists: false,
      tokenPrefix: '',
      tokenMasked: '',
      createdAt: null,
      updatedAt: null,
      lastUsedAt: null,
    }
  }
  return {
    exists: true,
    tokenPrefix: record.tokenPrefix,
    tokenMasked: record.tokenMasked,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() || null,
  }
}

export async function upsertUserApiToken(userId: string, tokenInput?: unknown) {
  const token = readString(tokenInput) || createUserApiToken()
  if (!isValidUserApiToken(token)) throw new UserApiTokenError('TOKEN_INVALID', 'Token 至少需要 16 个字符，且不能包含空格')
  const tokenHash = hashUserApiToken(token)
  const tokenPrefix = token.slice(0, 10)
  const tokenMasked = maskUserApiToken(token)
  const record = await prisma.userApiToken.upsert({
    where: { userId },
    create: { userId, tokenHash, tokenPrefix, tokenMasked },
    update: { tokenHash, tokenPrefix, tokenMasked },
  })
  return {
    token,
    summary: {
      exists: true,
      tokenPrefix: record.tokenPrefix,
      tokenMasked: record.tokenMasked,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      lastUsedAt: record.lastUsedAt?.toISOString() || null,
    } satisfies UserApiTokenSummary,
  }
}

export async function deleteUserApiToken(userId: string) {
  await prisma.userApiToken.delete({ where: { userId } }).catch(() => undefined)
  return getUserApiTokenSummary(userId)
}

export async function authenticateUserApiToken(authHeader: string | null) {
  const token = readBearerToken(authHeader)
  if (!token) return null
  const tokenHash = hashUserApiToken(token)
  const record = await prisma.userApiToken.findUnique({ where: { tokenHash } })
  if (!record) return null
  await prisma.userApiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
  return { userId: record.userId }
}

export function isUserApiTokenError(error: unknown): error is UserApiTokenError {
  return error instanceof UserApiTokenError
}

export class UserApiTokenError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'UserApiTokenError'
  }
}

function createUserApiToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(24).toString('base64url')}`
}

function isValidUserApiToken(value: string) {
  return value.length >= 16 && !/\s/.test(value)
}

function maskUserApiToken(value: string) {
  if (value.length <= 14) return `${value.slice(0, 4)}****`
  return `${value.slice(0, 10)}...${value.slice(-4)}`
}

function hashUserApiToken(value: string) {
  return crypto.createHash('sha256').update(`${getTokenSecret()}:${value}`).digest('hex')
}

function getTokenSecret() {
  return process.env.CCKS_API_TOKEN_SECRET || process.env.CCKS_SESSION_SECRET || process.env.SESSION_SECRET || 'dev-api-token-secret-change-me'
}

function readBearerToken(value: string | null) {
  const raw = readString(value)
  const match = /^Bearer\s+(.+)$/i.exec(raw)
  return match ? match[1].trim() : raw
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}
