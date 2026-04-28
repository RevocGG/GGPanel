import { NextRequest, NextResponse } from 'next/server'
import { processManager } from '@/lib/process-manager'
import { db } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

/** SSE endpoint — streams live logs for a running core, or historical logs for a stopped one */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const encoder = new TextEncoder()
  const sendEvent = (data: string) => encoder.encode(`data: ${data}\n\n`)

  // Check if core exists
  const core = await db.core.findUnique({ where: { id } })
  if (!core) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let cleanup: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      if (processManager.isRunning(id)) {
        // Live streaming — subscribe to process output
        cleanup = processManager.subscribe(id, (entry) => {
          try {
            controller.enqueue(sendEvent(entry))
          } catch {
            // Client disconnected
          }
        })
      } else {
        // Check if there are fresh in-memory logs from a process that just died.
        // If so, serve those immediately (they're more up-to-date than DB).
        const recentLogs = processManager.getRecentLogs(id)
        if (recentLogs.length > 0) {
          for (const entry of recentLogs) {
            try { controller.enqueue(sendEvent(entry)) } catch { break }
          }
          try {
            controller.enqueue(sendEvent(JSON.stringify({ level: 'info', message: '[ggoose] Core is not running', timestamp: new Date().toISOString() })))
            controller.close()
          } catch { /* already closed */ }
        } else {
          // Fall back to DB for older historical logs
          db.coreLog
            .findMany({
              where: { coreId: id },
              orderBy: { createdAt: 'asc' },
              take: 300,
            })
            .then((logs) => {
              for (const log of logs) {
                const entry = JSON.stringify({
                  level: log.level,
                  message: log.message,
                  timestamp: log.createdAt.toISOString(),
                })
                try {
                  controller.enqueue(sendEvent(entry))
                } catch {
                  break
                }
              }
              // Send sentinel then close
              try {
                controller.enqueue(sendEvent(JSON.stringify({ level: 'info', message: '[ggoose] Core is not running', timestamp: new Date().toISOString() })))
                controller.close()
              } catch { /* already closed */ }
            })
            .catch(() => {
              try { controller.close() } catch { /* ignore */ }
            })
        }
      }
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
