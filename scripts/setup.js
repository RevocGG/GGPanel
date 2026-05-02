#!/usr/bin/env node
/**
 * GGoose UI — First-run database setup.
 * Creates all tables and applies WAL mode / busy_timeout.
 * Safe to run multiple times (fully idempotent).
 *
 * Usage: node setup.js
 * Env:   DATABASE_URL=file:/absolute/path/data/goose.db
 */
'use strict'

const path = require('path')
const fs   = require('fs')

async function main() {
  // ── Resolve DB path ──────────────────────────────────────────────────
  const rawUrl  = process.env.DATABASE_URL || 'file:./data/goose.db'
  const filePart = rawUrl.replace(/^file:/, '')
  const absPath  = path.isAbsolute(filePart)
    ? filePart
    : path.join(process.cwd(), filePart)

  // ── Ensure directories exist ─────────────────────────────────────────
  fs.mkdirSync(path.dirname(absPath),                          { recursive: true })
  fs.mkdirSync(path.join(process.cwd(), 'data', 'cores'),     { recursive: true })
  fs.mkdirSync(path.join(process.cwd(), 'data', 'configs'),   { recursive: true })

  // ── Open database ────────────────────────────────────────────────────
  const { createClient } = require('@libsql/client')
  const db = createClient({ url: `file:${absPath}` })

  // Performance & safety pragmas
  await db.execute('PRAGMA journal_mode=WAL')
  await db.execute('PRAGMA busy_timeout=10000')
  await db.execute('PRAGMA foreign_keys=ON')

  // ── Schema (idempotent) ──────────────────────────────────────────────
  const ddl = [
    `CREATE TABLE IF NOT EXISTS "Core" (
      "id"          TEXT     NOT NULL PRIMARY KEY,
      "name"        TEXT     NOT NULL,
      "description" TEXT,
      "binaryPath"  TEXT     NOT NULL,
      "status"      TEXT     NOT NULL DEFAULT 'stopped',
      "pid"         INTEGER,
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "CoreConfig" (
      "id"         TEXT     NOT NULL PRIMARY KEY,
      "coreId"     TEXT     NOT NULL,
      "socksHost"  TEXT     NOT NULL DEFAULT '127.0.0.1',
      "socksPort"  INTEGER  NOT NULL DEFAULT 1080,
      "googleHost" TEXT     NOT NULL DEFAULT '216.239.38.120',
      "sni"        TEXT     NOT NULL DEFAULT 'www.google.com',
      "scriptKeys" TEXT     NOT NULL DEFAULT '[]',
      "tunnelKey"  TEXT     NOT NULL DEFAULT '',
      "socksUser"  TEXT     NOT NULL DEFAULT '',
      "socksPass"  TEXT     NOT NULL DEFAULT '',
      "updatedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CoreConfig_coreId_fkey"
        FOREIGN KEY ("coreId") REFERENCES "Core" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CoreConfig_coreId_key" ON "CoreConfig"("coreId")`,
    `CREATE TABLE IF NOT EXISTS "CoreStats" (
      "id"            TEXT     NOT NULL PRIMARY KEY,
      "coreId"        TEXT     NOT NULL,
      "totalRequests" INTEGER  NOT NULL DEFAULT 0,
      "todayRequests" INTEGER  NOT NULL DEFAULT 0,
      "lastResetAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CoreStats_coreId_fkey"
        FOREIGN KEY ("coreId") REFERENCES "Core" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CoreStats_coreId_key" ON "CoreStats"("coreId")`,
    `CREATE TABLE IF NOT EXISTS "CoreLog" (
      "id"        TEXT     NOT NULL PRIMARY KEY,
      "coreId"    TEXT     NOT NULL,
      "level"     TEXT     NOT NULL DEFAULT 'info',
      "message"   TEXT     NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CoreLog_coreId_fkey"
        FOREIGN KEY ("coreId") REFERENCES "Core" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CoreLog_coreId_createdAt_idx" ON "CoreLog"("coreId", "createdAt")`,
    // Reset stale statuses left over from a previous crash
    `UPDATE "Core" SET "status" = 'stopped', "pid" = NULL
      WHERE "status" IN ('running', 'starting')`,
  ]

  for (const sql of ddl) {
    await db.execute(sql)
  }

  // Idempotent column additions — ignore "duplicate column" errors for existing DBs
  const alterStatements = [
    `ALTER TABLE "CoreConfig" ADD COLUMN "socksUser" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "CoreConfig" ADD COLUMN "socksPass" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Core" ADD COLUMN "coreType" TEXT NOT NULL DEFAULT 'goose'`,
  ]
  for (const sql of alterStatements) {
    try {
      await db.execute(sql)
    } catch (e) {
      if (!String(e).includes('duplicate column')) throw e
    }
  }

  db.close()
  console.log('[ggpanel] Database ready:', absPath)
}

main().catch(err => {
  console.error('[ggpanel] Setup failed:', err.message)
  process.exit(1)
})
