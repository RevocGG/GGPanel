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
    // If the binary is a native Windows EXE, run it directly with Windows paths.
    if (binaryPath.toLowerCase().endsWith('.exe')) {
      return {
        cmd: binaryPath,
        args: ['-config', configPath],
      }
    }
    // Otherwise it's a Linux ELF binary — execute via WSL.
    // --exec bypasses the WSL shell init that triggers the
    // "localhost proxy not mirrored" warning in NAT mode.
    return {
      cmd: 'wsl',
      args: [
        '--exec',
        toWslPath(binaryPath),
        '-config', toWslPath(configPath),
      ],
    }
  }
  // Linux/Mac: execute directly
  return {
    cmd: binaryPath,
    args: ['-config', configPath],
  }
}

/**
 * WSL prints informational/warning lines to stderr that are not errors.
 * These should be shown as info (or silently dropped) so they don't
 * cause the core to appear as errored.
 */
const WSL_NOISE_PATTERNS = [
  /^wsl:/i,                                // "wsl: A localhost proxy ..."
  /localhost proxy/i,
  /NAT mode does not support/i,
  /not mirrored into WSL/i,
]

/**
 * The binary writes many INFO-level messages to stderr (e.g. CARRIER INFO, CLIENT INFO).
 * Reclassify these as 'info' so they don't show as red errors in the UI.
 */
const BINARY_INFO_PATTERNS = [
  /\bCARRIER\s+INFO\b/,
  /\bCLIENT\s+INFO\b/,
  /\bSERVER\s+INFO\b/,
  /\bINFO\b.*relay returned/i,
  /\bINFO\b.*non-batch payload/i,
]

function isStderrInfo(line: string): boolean {
  return WSL_NOISE_PATTERNS.some((re) => re.test(line))
    || BINARY_INFO_PATTERNS.some((re) => re.test(line))
}

// Keep old name as alias so existing callers still work
const isWslNoise = isStderrInfo

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

interface ManagedProcess {
  proc: ChildProcess
  coreId: string
  logBuffer: string[]
  requestCount: number      // total since start (for live override)
  pendingFlushCount: number // accumulated since last DB flush
  listeners: Set<(entry: string) => void>
}

// ── Module-level singleton ───────────────────────────────────────────────────
// Works correctly with `next start` (single persistent Node.js process).
// In dev (HMR), globalThis preserves the map across module reloads.
const globalForPM = globalThis as unknown as {
  _ggooseProcesses: Map<string, ManagedProcess>
  _ggooseDeadLogs: Map<string, string[]>   // log buffer kept after exit
}

if (!globalForPM._ggooseProcesses) globalForPM._ggooseProcesses = new Map()
if (!globalForPM._ggooseDeadLogs)  globalForPM._ggooseDeadLogs  = new Map()

const processes = globalForPM._ggooseProcesses
// Keeps last log buffer for a short while after process dies so SSE can read it.
// Entries are evicted after 60 seconds to avoid memory leaks.
const deadLogs  = globalForPM._ggooseDeadLogs

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Detect if a log line represents a forwarded connection/request */
function isRequestLine(message: string): boolean {
  return /poll\s+ok|POST.*exec|relay\s+request|script\.google\.com|urlFetch/i.test(message)
    || /SOCKS\s+INFO\s+new\s+session/i.test(message)
    || /CARRIER\s+INFO\s+relay\s+ok/i.test(message)
}

function makeLogEntry(level: LogEntry['level'], message: string): string {
  return JSON.stringify({ level, message, timestamp: new Date().toISOString() })
}

function handleOutput(managed: ManagedProcess, level: LogEntry['level'], chunk: Buffer) {
  const lines = chunk.toString().split('\n').filter(Boolean)
  for (const line of lines) {
    // WSL prints informational warnings to stderr — treat them as info, not errors
    const effectiveLevel: LogEntry['level'] = (level === 'error' && isWslNoise(line)) ? 'info' : level
    const entry = makeLogEntry(effectiveLevel, line)

    // Ring buffer — keep last 500 log lines in memory
    managed.logBuffer.push(entry)
    if (managed.logBuffer.length > 500) managed.logBuffer.shift()

    // Increment request counter
    if (isRequestLine(line)) {
      managed.requestCount++
      managed.pendingFlushCount++
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

// Debounce stats flush: once per 2 seconds, but always flushes ALL pending count
const statsFlushTimers = new Map<string, ReturnType<typeof setTimeout>>()

function flushStats(managed: ManagedProcess) {
  // If a timer is already pending, let it fire — it will pick up the latest pendingFlushCount
  if (statsFlushTimers.has(managed.coreId)) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const timer = setTimeout(async () => {
      statsFlushTimers.delete(managed.coreId)
      const toFlush = managed.pendingFlushCount
      if (toFlush === 0) { resolve(); return }
      managed.pendingFlushCount = 0
      try {
        const { db } = await import('./db')
        await queueDbWrite(() => db.coreStats.upsert({
          where: { coreId: managed.coreId },
          update: {
            todayRequests: { increment: toFlush },
            totalRequests: { increment: toFlush },
          },
          create: {
            coreId: managed.coreId,
            todayRequests: toFlush,
            totalRequests: toFlush,
          },
        }))
      } catch {
        // Non-critical — put the count back so it's not lost
        managed.pendingFlushCount += toFlush
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
      const existing = processes.get(coreId)!
      if (existing.proc.exitCode !== null) {
        // Process has already exited but was not cleaned up — remove stale entry
        processes.delete(coreId)
      } else {
        // Process is genuinely alive — re-sync DB and return
        const { db: dbSync } = await import('./db')
        await queueDbWrite(() => dbSync.core.update({
          where: { id: coreId },
          data: { status: 'running', pid: existing.proc.pid ?? null },
        }))
        return
      }
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
      pendingFlushCount: 0,
      listeners: new Set(),
    }

    processes.set(coreId, managed)

    // Register stdout/stderr listeners IMMEDIATELY — before any awaits —
    // so we never miss output from a fast-exiting process.
    proc.stdout?.on('data', (chunk: Buffer) => handleOutput(managed, 'info', chunk))
    proc.stderr?.on('data', (chunk: Buffer) => handleOutput(managed, 'error', chunk))

    proc.on('exit', async (code, signal) => {
      // Log exit reason BEFORE removing from processes map
      const reason = signal ? `signal ${signal}` : `code ${code}`
      handleOutput(managed, code === 0 ? 'info' : 'error',
        Buffer.from(`[ggoose] Process exited (${reason})`))

      // Save log buffer so SSE can still serve it after the process is gone
      deadLogs.set(coreId, [...managed.logBuffer])
      setTimeout(() => deadLogs.delete(coreId), 60_000)

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
      handleOutput(managed, 'error', Buffer.from(`[ggoose] Process error: ${err.message}`))
      try {
        const { db: dbInner } = await import('./db')
        await queueDbWrite(() => dbInner.core.update({
          where: { id: coreId },
          data: { status: 'error', pid: null },
        }))
      } catch { /* ignore */ }
    })

    await queueDbWrite(() => db.core.update({
      where: { id: coreId },
      data: { status: 'running', pid: proc.pid ?? null },
    }))
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
      // Core not running — check if we have a recent dead-log buffer first
      const dead = deadLogs.get(coreId)
      if (dead && dead.length > 0) {
        for (const entry of dead) listener(entry)
      } else {
        listener(makeLogEntry('info', '[ggoose] Core is not running'))
      }
      return () => {}
    }

    // Send buffered logs immediately
    for (const entry of managed.logBuffer) {
      listener(entry)
    }

    managed.listeners.add(listener)
    return () => managed.listeners.delete(listener)
  },

  /** Return the in-memory log buffer — checks live process first, then recently-dead buffer */
  getRecentLogs(coreId: string): string[] {
    return processes.get(coreId)?.logBuffer.slice(-200)
      ?? deadLogs.get(coreId)?.slice(-200)
      ?? []
  },

  /** Return in-memory request count for a running core (more up-to-date than DB) */
  getLiveRequestCount(coreId: string): number | null {
    const managed = processes.get(coreId)
    return managed ? managed.requestCount : null
  },

  /** Called on server boot: reset any stale "running" states in the DB */
  async resetStaleStatuses(): Promise<void> {
    try {
      const { db } = await import('./db')
      // Only reset cores that are NOT currently tracked as running in memory.
      // IMPORTANT: if activeIds is empty we skip entirely — there may be processes
      // running in another worker whose Map we can't see, so we must NOT wipe them.
      const activeIds = [...processes.keys()]
      if (activeIds.length === 0) return
      await db.core.updateMany({
        where: {
          status: { in: ['running', 'starting'] },
          id: { notIn: activeIds },
        },
        data: { status: 'stopped', pid: null },
      })
    } catch { /* ignore — DB might not be ready yet */ }
  },
}

// Run once when this module first loads
processManager.resetStaleStatuses()
