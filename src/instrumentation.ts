/**
 * Next.js Instrumentation — runs once when the server starts.
 * Sets up global error handlers and writes panel crash logs to data/panel.log
 *
 * IMPORTANT: No top-level Node.js built-in imports here — this file is also
 * evaluated in the edge runtime bundle. All fs/path usage is inside dynamic
 * imports guarded by the NEXT_RUNTIME === 'nodejs' check.
 */

export async function register() {
  // Only run on the Node.js server (not in the browser or edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Dynamic imports so the edge bundler never sees Node.js built-ins
  const { appendFileSync, mkdirSync } = await import('fs')
  const { join } = await import('path')

  const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data')
  const LOG_FILE = join(DATA_DIR, 'panel.log')

  function writeLog(level: string, message: string, extra?: unknown) {
    try {
      mkdirSync(DATA_DIR, { recursive: true })
      const line = JSON.stringify({
        level,
        message,
        extra: extra instanceof Error
          ? { name: extra.name, message: extra.message, stack: extra.stack }
          : extra,
        timestamp: new Date().toISOString(),
      }) + '\n'
      appendFileSync(LOG_FILE, line, 'utf8')
    } catch {
      // Ignore log write errors — don't cause infinite recursion
    }
  }

  writeLog('info', '[panel] Server started')

  process.on('uncaughtException', (err) => {
    writeLog('error', '[panel] uncaughtException', err)
    // Do NOT re-throw — let the process attempt to continue
  })

  process.on('unhandledRejection', (reason) => {
    writeLog('error', '[panel] unhandledRejection', reason instanceof Error ? reason : String(reason))
  })

  process.on('exit', (code) => {
    writeLog(code === 0 ? 'info' : 'error', `[panel] Process exiting with code ${code}`)
  })

  process.on('SIGTERM', () => {
    writeLog('info', '[panel] Received SIGTERM — shutting down')
  })

  process.on('SIGINT', () => {
    writeLog('info', '[panel] Received SIGINT — shutting down')
  })
}
