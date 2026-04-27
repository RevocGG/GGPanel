import { spawn, type ChildProcess } from 'child_process'
import { writeConfigFile } from './config-writer'
import path from 'path'

const CORES_DIR = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')

// ── Serial DB write queue ─────────────────────────────────────────────────────
// libsql (used by Prisma adapter on Windows) cannot handle concurrent writes.
// All DB mutations go through this queue to ensure they run one at a time.
let dbWriteQueue: Promise<unknown> = Promise.resolve()

function queueDbWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbWriteQueue.then(fn, fn) as Promise<T>
  dbWriteQueue = next.catch(() => {})
  return next
}

// ── WSL path conversion ───────────────────────────────────────────────────────
/** Convert Windows path to WSL mount path: "F:\foo\bar" → "/mnt/f/foo/bar" */
function toWslPath(winPath: string): string {
  return winPath
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replace(/\\/g, '/')
}

/** Build spawn command/args — use WSL on Windows for Linux binaries */
function buildSpawnCommand(binaryPath: string, configPath: string): { cmd: string; args: string[] } {
  if (process.platform === 'win32') {
    // Windows: execute binary via WSL
    return {
      cmd: 'wsl',
      args: [toWslPath(binaryPath), '-config', toWslPath(configPath)],
    }
  }
  // Linux/Mac: execute directly
  return {
    cmd: binaryPath,
    args: ['-config', configPath],
  }
}

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

interface ManagedProcess {
  proc: ChildProcess
  coreId: string
  logBuffer: string[]
  requestCount: number
  listeners: Set<(entry: string) => void>
}

// ── Module-level singleton ───────────────────────────────────────────────────
// Works correctly with `next start` (single persistent Node.js process).
// In dev (HMR), globalThis preserves the map across module reloads.
const globalForPM = globalThis as unknown as { _ggooseProcesses: Map<string, ManagedProcess> }

if (!globalForPM._ggooseProcesses) {
  globalForPM._ggooseProcesses = new Map()
}

const processes = globalForPM._ggooseProcesses

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Detect if a log line represents a forwarded request (heuristic) */
function isRequestLine(message: string): boolean {
  return /poll\s+ok|POST.*exec|relay\s+request|script\.google\.com|urlFetch/i.test(message)
}

function makeLogEntry(level: LogEntry['level'], message: string): string {
  return JSON.stringify({ level, message, timestamp: new Date().toISOString() })
}

function handleOutput(managed: ManagedProcess, level: LogEntry['level'], chunk: Buffer) {
  const lines = chunk.toString().split('\n').filter(Boolean)
  for (const line of lines) {
    const entry = makeLogEntry(level, line)

    // Ring buffer — keep last 500 log lines in memory
    managed.logBuffer.push(entry)
    if (managed.logBuffer.length > 500) managed.logBuffer.shift()

    // Increment request counter
    if (isRequestLine(line)) {
      managed.requestCount++
      flushStats(managed).catch(() => {})
    }

    // Notify all SSE subscribers
    for (const listener of managed.listeners) {
      try {
        listener(entry)
      } catch {
        managed.listeners.delete(listener)
      }
    }
  }

  // Persist tail of logs to DB asynchronously (no await — fire & forget)
  persistLogs(managed.coreId, lines, level).catch(() => {})
}

async function persistLogs(coreId: string, lines: string[], level: LogEntry['level']) {
  try {
    const { db } = await import('./db')
    // Insert all lines; trim older logs to last 1000 per core
    await db.coreLog.createMany({
      data: lines.map((message) => ({ coreId, level, message })),
    })
    // Clean up old logs beyond 1000 per core
    const count = await db.coreLog.count({ where: { coreId } })
    if (count > 1000) {
      const oldest = await db.coreLog.findMany({
        where: { coreId },
        orderBy: { createdAt: 'asc' },
        take: count - 1000,
        select: { id: true },
      })
      await db.coreLog.deleteMany({
        where: { id: { in: oldest.map((l) => l.id) } },
      })
    }
  } catch {
    // Non-critical — silently ignore DB errors during log persistence
  }
}

// Debounce stats flush: once per 2 seconds
const statsFlushTimers = new Map<string, ReturnType<typeof setTimeout>>()

function flushStats(managed: ManagedProcess) {
  const existing = statsFlushTimers.get(managed.coreId)
  if (existing) clearTimeout(existing)

  return new Promise<void>((resolve) => {
    const timer = setTimeout(async () => {
      statsFlushTimers.delete(managed.coreId)
      try {
        const { db } = await import('./db')
        await queueDbWrite(() => db.coreStats.upsert({
          where: { coreId: managed.coreId },
          update: {
            todayRequests: { increment: 1 },
            totalRequests: { increment: 1 },
          },
          create: {
            coreId: managed.coreId,
            todayRequests: managed.requestCount,
            totalRequests: managed.requestCount,
          },
        }))
      } catch {
        // Non-critical
      }
      resolve()
    }, 2000)
    statsFlushTimers.set(managed.coreId, timer)
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

export const processManager = {
  /**
   * Start a core process.
   * Writes a fresh config file then spawns the binary.
   */
  async start(coreId: string): Promise<void> {
    if (processes.has(coreId)) {
      throw new Error('Core is already running')
    }

    const { db } = await import('./db')
    const core = await db.core.findUnique({
      where: { id: coreId },
      include: { config: true },
    })

    if (!core) throw new Error('Core not found')
    if (!core.config) throw new Error('Core has no configuration — save a config first')

    // Write config to disk
    const configPath = await writeConfigFile(core.config)

    // Mark as starting
    await queueDbWrite(() => db.core.update({
      where: { id: coreId },
      data: { status: 'starting' },
    }))

    // Resolve binary path — stored name is relative to CORES_DIR
    const binaryPath = path.isAbsolute(core.binaryPath)
      ? core.binaryPath
      : path.join(CORES_DIR, core.binaryPath)

    const { cmd, args } = buildSpawnCommand(binaryPath, configPath)
    const proc = spawn(cmd, args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Wait for spawn confirmation OR immediate error (with timeout).
    // For wsl wrapper, 'spawn' event may not fire reliably, so we use a 500ms timeout.
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          proc.once('spawn', resolve)
          proc.once('error', reject)
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ])
    } catch (spawnErr) {
      // Process failed to start — update DB once and re-throw
      await queueDbWrite(() => db.core.update({
        where: { id: coreId },
        data: { status: 'error', pid: null },
      }))
      throw spawnErr
    }

    const managed: ManagedProcess = {
      proc,
      coreId,
      logBuffer: [makeLogEntry('info', `[ggoose] Starting core "${core.name}" (PID ${proc.pid})…`)],
      requestCount: 0,
      listeners: new Set(),
    }

    processes.set(coreId, managed)

    await queueDbWrite(() => db.core.update({
      where: { id: coreId },
      data: { status: 'running', pid: proc.pid ?? null },
    }))

    proc.stdout?.on('data', (chunk: Buffer) => handleOutput(managed, 'info', chunk))
    proc.stderr?.on('data', (chunk: Buffer) => handleOutput(managed, 'error', chunk))

    proc.on('exit', async (code) => {
      processes.delete(coreId)
      try {
        const { db: dbInner } = await import('./db')
        await queueDbWrite(() => dbInner.core.update({
          where: { id: coreId },
          data: { status: code === 0 ? 'stopped' : 'error', pid: null },
        }))
      } catch { /* ignore */ }
    })

    proc.on('error', async (err) => {
      // Post-spawn errors (e.g. process crashed mid-run)
      processes.delete(coreId)
      try {
        const { db: dbInner } = await import('./db')
        await queueDbWrite(() => dbInner.core.update({
          where: { id: coreId },
          data: { status: 'error', pid: null },
        }))
        handleOutput(managed, 'error', Buffer.from(`[ggoose] Process error: ${err.message}`))
      } catch { /* ignore */ }
    })
  },

  /** Stop a running core */
  async stop(coreId: string): Promise<void> {
    const managed = processes.get(coreId)
    if (!managed) throw new Error('Core is not running')

    managed.proc.kill('SIGTERM')
    processes.delete(coreId)

    const { db } = await import('./db')
    await queueDbWrite(() => db.core.update({
      where: { id: coreId },
      data: { status: 'stopped', pid: null },
    }))
  },

  isRunning(coreId: string): boolean {
    return processes.has(coreId)
  },

  /** Register an SSE listener — returns unsubscribe function */
  subscribe(coreId: string, listener: (entry: string) => void): () => void {
    const managed = processes.get(coreId)
    if (!managed) {
      // Core not running — return empty logs sentinel + no-op unsub
      listener(makeLogEntry('info', '[ggoose] Core is not running'))
      return () => {}
    }

    // Send buffered logs immediately
    for (const entry of managed.logBuffer) {
      listener(entry)
    }

    managed.listeners.add(listener)
    return () => managed.listeners.delete(listener)
  },

  /** Return the in-memory log buffer for a running core */
  getRecentLogs(coreId: string): string[] {
    return processes.get(coreId)?.logBuffer.slice(-200) ?? []
  },

  /** Called on server boot: reset any stale "running" states in the DB */
  async resetStaleStatuses(): Promise<void> {
    try {
      const { db } = await import('./db')
      await db.core.updateMany({
        where: { status: { in: ['running', 'starting'] } },
        data: { status: 'stopped', pid: null },
      })
    } catch { /* ignore — DB might not be ready yet */ }
  },
}

// Run once when this module first loads
processManager.resetStaleStatuses()
