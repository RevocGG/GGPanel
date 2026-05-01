#!/usr/bin/env node
/**
 * GGoose Panel launcher
 * Runs DB migrations then starts the Next.js standalone server.
 */
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

const ROOT = __dirname

// ── Ensure data/ dir exists next to where bat is run from ────────────────────
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
if (!fs.existsSync(path.join(dataDir, 'cores'))) fs.mkdirSync(path.join(dataDir, 'cores'), { recursive: true })

// ── Set environment ───────────────────────────────────────────────────────────
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(dataDir, 'goose.db')}`
process.env.CORES_DIR    = process.env.CORES_DIR    || path.join(dataDir, 'cores')
process.env.NODE_ENV     = 'production'
process.env.PORT         = process.env.PORT || '3000'

// ── Run migrations ────────────────────────────────────────────────────────────
;(async () => {
  console.log('[GGoose] Running database migrations…')
  const prismaScript = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')

  if (fs.existsSync(prismaScript)) {
    try {
      execFileSync(process.execPath, [
        prismaScript, 'migrate', 'deploy',
        '--schema', path.join(ROOT, 'prisma', 'schema.prisma'),
      ], { stdio: 'inherit', env: { ...process.env } })
      console.log('[GGoose] Migrations done.')
    } catch (e) {
      console.warn('[GGoose] Prisma migrate warning:', e.message)
    }
  } else {
    // Prisma CLI not bundled — apply SQL migrations directly
    try {
      const { createClient } = require(path.join(ROOT, 'node_modules', '@libsql', 'client'))
      const db = createClient({ url: process.env.DATABASE_URL })
      const migsDir = path.join(ROOT, 'prisma', 'migrations')
      const dirs = fs.readdirSync(migsDir).sort()
      for (const dir of dirs) {
        const sqlFile = path.join(migsDir, dir, 'migration.sql')
        if (!fs.existsSync(sqlFile)) continue
        const stmts = fs.readFileSync(sqlFile, 'utf8')
          .split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean)
        for (const stmt of stmts) {
          try { await db.execute(stmt) } catch (e) {
            if (!e.message.toLowerCase().includes('already exists')) throw e
          }
        }
      }
      db.close && db.close()
      console.log('[GGoose] Migrations applied via SQL.')
    } catch (e) {
      console.warn('[GGoose] Migration fallback warning:', e.message)
    }
  }

  // ── Start server ────────────────────────────────────────────────────────────
  const serverJs = path.join(ROOT, 'server.js')
  if (!fs.existsSync(serverJs)) {
    console.error('[GGoose] ERROR: server.js not found at', serverJs)
    process.exit(1)
  }
  console.log(`[GGoose] Starting panel on http://localhost:${process.env.PORT}`)
  require(serverJs)

  // ── Open browser ────────────────────────────────────────────────────────────
  function waitAndOpen(retries = 20) {
    const port = parseInt(process.env.PORT || '3000')
    const req = http.get({ hostname: 'localhost', port, path: '/' }, () => {
      console.log(`[GGoose] Ready → http://localhost:${port}`)
      const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'
      try { require('child_process').execSync(`${cmd} http://localhost:${port}`, { shell: true }) } catch {}
    })
    req.on('error', () => { if (retries > 0) setTimeout(() => waitAndOpen(retries - 1), 500) })
    req.end()
  }
  setTimeout(() => waitAndOpen(), 1500)
})()
