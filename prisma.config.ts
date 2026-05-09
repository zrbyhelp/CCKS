import 'dotenv/config'
import { mkdirSync } from 'fs'
import path from 'path'
import { defineConfig } from 'prisma/config'

const databaseMode = process.env.CCKS_DATABASE_MODE === 'sqlite' ? 'sqlite' : 'mysql'
const defaultSqliteDatabasePath = path.join(process.cwd(), '.ccks-local', 'dev.db')
if (databaseMode === 'sqlite' && !process.env.CCKS_SQLITE_DATABASE_URL) {
  mkdirSync(path.dirname(defaultSqliteDatabasePath), { recursive: true })
}
const sqliteDatabaseUrl = process.env.CCKS_SQLITE_DATABASE_URL || `file:${defaultSqliteDatabasePath.replace(/\\/g, '/')}`

export default defineConfig({
  schema: databaseMode === 'sqlite' ? 'prisma/schema.sqlite.prisma' : 'prisma/schema.prisma',
  datasource: {
    url: databaseMode === 'sqlite' ? sqliteDatabaseUrl : process.env.DATABASE_URL || 'mysql://ccks:ccks_password@localhost:3306/ccks',
  },
})
