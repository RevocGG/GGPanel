import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
  prismaInitialised: boolean
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

// Enable WAL mode (readers don't block writers) and a generous busy-timeout
// so concurrent access between the process-manager and server components
// never immediately returns SQLITE_BUSY ("Operation has timed out").
// WAL mode persists in the DB file; busy_timeout is per-connection.
if (!globalForPrisma.prismaInitialised) {
  globalForPrisma.prismaInitialised = true
  db.$executeRawUnsafe('PRAGMA journal_mode=WAL')
    .then(() => db.$executeRawUnsafe('PRAGMA busy_timeout=10000'))
    .catch(() => { /* ignore — DB may not be ready on very first boot */ })
}
