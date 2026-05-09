import 'dotenv/config'
import { mkdirSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const databaseMode = process.env.CCKS_DATABASE_MODE === 'sqlite' ? 'sqlite' : 'mysql'
const mysqlDatabaseUrl = process.env.DATABASE_URL || 'mysql://ccks:ccks_password@localhost:3306/ccks'
const defaultSqliteDatabasePath = path.join(process.cwd(), '.ccks-local', 'dev.db')
if (databaseMode === 'sqlite' && !process.env.CCKS_SQLITE_DATABASE_URL) {
  mkdirSync(path.dirname(defaultSqliteDatabasePath), { recursive: true })
}
const sqliteDatabaseUrl = process.env.CCKS_SQLITE_DATABASE_URL || `file:${defaultSqliteDatabasePath.replace(/\\/g, '/')}`

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: databaseMode === 'sqlite' ? new PrismaBetterSqlite3({ url: sqliteDatabaseUrl }) : new PrismaMariaDb(mysqlDatabaseUrl),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
