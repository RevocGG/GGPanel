import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processManager } from '@/lib/process-manager'
import { z } from 'zod'
import path from 'path'

interface Params { params: Promise<{ id: string }> }

const UpdateCoreSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).nullable().optional(),
  binaryPath: z.string().min(1).optional(),
  socksHost: z.string().optional(),
  socksPort: z.number().int().min(1).max(65535).optional(),
  googleHost: z.string().optional(),
  sni: z.string().optional(),
  scriptKeys: z.array(z.string()).optional(),
  tunnelKey: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const core = await db.core.findUnique({
      where: { id },
      include: { config: true, stats: true },
    })
    if (!core) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Override DB status and stats with live process-manager state so UI is always accurate
    if (processManager.isRunning(id) && core.status !== 'running') {
      const liveCount = processManager.getLiveRequestCount(id)
      const patchedStats = core.stats && liveCount !== null
        ? { ...core.stats, todayRequests: core.stats.todayRequests + liveCount }
        : core.stats
      return NextResponse.json({ data: { ...core, status: 'running', stats: patchedStats } })
    }
    const liveCount = processManager.getLiveRequestCount(id)
    if (liveCount !== null && core.stats) {
      return NextResponse.json({ data: { ...core, stats: { ...core.stats, todayRequests: core.stats.todayRequests + liveCount } } })
    }
    return NextResponse.json({ data: core })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch core' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = UpdateCoreSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { name, description, binaryPath, socksHost, socksPort, googleHost, sni, scriptKeys, tunnelKey } = parsed.data

    // Check if core is currently running — we'll need to restart it after config update
    const existingCore = await db.core.findUnique({ where: { id }, include: { config: true } })
    if (!existingCore) {
      return NextResponse.json({ error: 'Core not found' }, { status: 404 })
    }

    // Port conflict check — only if port is changing
    if (socksPort !== undefined && socksPort !== existingCore.config?.socksPort) {
      const conflict = await db.coreConfig.findFirst({ where: { socksPort, coreId: { not: id } } })
      if (conflict) {
        return NextResponse.json({ error: `Port ${socksPort} is already in use by another core` }, { status: 409 })
      }
    }

    const wasRunning = existingCore.status === 'running'

    // Stop if running (will be restarted after update)
    if (wasRunning && processManager.isRunning(id)) {
      await processManager.stop(id)
    }

    // Resolve binary path
    let resolvedBinary: string | undefined
    if (binaryPath !== undefined) {
      const coresDir = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')
      resolvedBinary = path.isAbsolute(binaryPath) ? binaryPath : path.join(coresDir, binaryPath)
    }

    const core = await db.core.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(resolvedBinary !== undefined && { binaryPath: resolvedBinary }),
        ...(socksHost !== undefined || socksPort !== undefined || googleHost !== undefined ||
          sni !== undefined || scriptKeys !== undefined || tunnelKey !== undefined
          ? {
              config: {
                upsert: {
                  create: {
                    socksHost: socksHost ?? '127.0.0.1',
                    socksPort: socksPort ?? 1080,
                    googleHost: googleHost ?? '216.239.38.120',
                    sni: sni ?? 'www.google.com',
                    scriptKeys: JSON.stringify(scriptKeys ?? []),
                    tunnelKey: tunnelKey ?? '',
                  },
                  update: {
                    ...(socksHost !== undefined && { socksHost }),
                    ...(socksPort !== undefined && { socksPort }),
                    ...(googleHost !== undefined && { googleHost }),
                    ...(sni !== undefined && { sni }),
                    ...(scriptKeys !== undefined && { scriptKeys: JSON.stringify(scriptKeys) }),
                    ...(tunnelKey !== undefined && { tunnelKey }),
                  },
                },
              },
            }
          : {}),
      },
      include: { config: true, stats: true },
    })

    // Restart if it was running before the update
    if (wasRunning) {
      try {
        await processManager.start(id)
      } catch (restartErr) {
        // Log error but don't fail the whole request — config was saved successfully
        console.error(`[cores/${id}] Failed to restart after config update:`, restartErr)
      }
    }

    return NextResponse.json({ data: core })
  } catch {
    return NextResponse.json({ error: 'Failed to update core' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    // Safety check — don't delete running cores
    const core = await db.core.findUnique({ where: { id } })
    if (!core) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (core.status === 'running') {
      return NextResponse.json({ error: 'Stop the core before deleting it' }, { status: 409 })
    }

    await db.core.delete({ where: { id } })
    return NextResponse.json({ message: 'Deleted' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete core' }, { status: 500 })
  }
}
