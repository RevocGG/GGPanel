import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
}

function createPrismaClient() {
  // Use an absolute path so the file is always found regardless of CWD
  const url = process.env.DATABASE_URL
    ?? `file:${path.join(process.cwd(), 'data', 'goose.db')}`
  const adapter = new PrismaLibSql({ url })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
