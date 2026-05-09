import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const databaseUrl = process.env.DATABASE_URL || 'mysql://ccks:ccks_password@localhost:3306/ccks'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
