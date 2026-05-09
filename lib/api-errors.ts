export function apiErrorMessage(error: unknown, fallback: string) {
  const code = readErrorCode(error)
  if (code === 'P1001') return 'MySQL 数据库未连接，请先启动数据库，再执行 npm run db:push'
  if (code === 'P2021') return '数据库表未初始化，请先执行 npm run db:push'

  const message = readErrorMessage(error)
  if (process.env.NODE_ENV !== 'production' && message) return `${fallback}：${message}`
  return fallback
}

function readErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const source = error as { code?: unknown }
  return typeof source.code === 'string' ? source.code : ''
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return ''
  const source = error as { message?: unknown }
  return typeof source.message === 'string' ? source.message : ''
}
