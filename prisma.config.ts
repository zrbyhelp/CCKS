import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'mysql://ccks:ccks_password@localhost:3306/ccks',
  },
})
