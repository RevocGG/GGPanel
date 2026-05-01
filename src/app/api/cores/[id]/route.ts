import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processManager } from '@/lib/process-manager'
import { z } from 'zod'
import path from 'path'

interface Params { params: Promise<{ id: string }> }

const UpdateGooseSchema = z.object({
  coreType: z.literal('goose').optional(),
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).nullable().optional(),
  binaryPath: z.string().min(1).optional(),
  socksHost: z.string().optional(),
  socksPort: z.number().int().min(1).max(65535).optional(),
  googleHost: z.string().optional(),
  sni: z.string().optional(),
  scriptKeys: z.array(z.string()).optional(),
  tunnelKey: z.string().optional(),
  socksUser: z.string().optional(),
  socksPass: z.string().optional(),
})

const UpdateFlowDriverSchema = z.object({
  coreType: z.literal('flowdriver'),
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).nullable().optional(),
  binaryPath: z.string().min(1).optional(),
  listenAddr: z.string().optional(),
  googleFolderId: z.string().optional(),
  refreshRateMs: z.number().int().min(50).max(10000).optional(),
  flushRateMs: z.number().int().min(50).max(10000).optional(),
  transportTarget: z.string().optional(),
  transportSni: z.string().optional(),
  transportHost: z.string().optional(),
  credentialsPath: z.string().optional(),
  tokenPath: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const core = await db.core.findUnique({
      where: { id },
      include: { config: true, flowDriverConfig: true, stats: true },
    })
    if (!core) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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

    const existingCore = await db.core.findUnique({
      where: { id },
      include: { config: true, flowDriverConfig: true },
    })
    if (!existingCore) return NextResponse.json({ error: 'Core not found' }, { status: 404 })

    const wasRunning = existingCore.status === 'running'
    if (wasRunning && processManager.isRunning(id)) {
      await processManager.stop(id)
    }

    const coresDir = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')

    if (existingCore.coreType === 'flowdriver') {
      const parsed = UpdateFlowDriverSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

      const { name, description, binaryPath, listenAddr, googleFolderId, refreshRateMs,
              flushRateMs, transportTarget, transportSni, transportHost, credentialsPath, tokenPath } = parsed.data

      let resolvedBinary: string | undefined
      if (binaryPath !== undefined) {
        resolvedBinary = path.isAbsolute(binaryPath) ? binaryPath : path.join(coresDir, binaryPath)
      }

      const core = await db.core.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(resolvedBinary !== undefined && { binaryPath: resolvedBinary }),
          ...(listenAddr !== undefined || googleFolderId !== undefined || refreshRateMs !== undefined ||
            flushRateMs !== undefined || transportTarget !== undefined || transportSni !== undefined ||
            transportHost !== undefined || credentialsPath !== undefined || tokenPath !== undefined
            ? {
                flowDriverConfig: {
                  upsert: {
                    create: {
                      listenAddr: listenAddr ?? '127.0.0.1:1080',
                      googleFolderId: googleFolderId ?? '',
                      refreshRateMs: refreshRateMs ?? 200,
                      flushRateMs: flushRateMs ?? 300,
                      transportTarget: transportTarget ?? '216.239.38.120:443',
                      transportSni: transportSni ?? 'google.com',
                      transportHost: transportHost ?? 'www.googleapis.com',
                      credentialsPath: credentialsPath ?? '',
                      tokenPath: tokenPath ?? '',
                    },
                    update: {
                      ...(listenAddr !== undefined && { listenAddr }),
                      ...(googleFolderId !== undefined && { googleFolderId }),
                      ...(refreshRateMs !== undefined && { refreshRateMs }),
                      ...(flushRateMs !== undefined && { flushRateMs }),
                      ...(transportTarget !== undefined && { transportTarget }),
                      ...(transportSni !== undefined && { transportSni }),
                      ...(transportHost !== undefined && { transportHost }),
                      ...(credentialsPath !== undefined && { credentialsPath }),
                      ...(tokenPath !== undefined && { tokenPath }),
                    },
                  },
                },
              }
            : {}),
        },
        include: { config: true, flowDriverConfig: true, stats: true },
      })

      if (wasRunning) {
        try { await processManager.start(id) } catch (e) {
          console.error(`[cores/${id}] Failed to restart after update:`, e)
        }
      }
      return NextResponse.json({ data: core })
    }

    // Goose core
    const parsed = UpdateGooseSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { name, description, binaryPath, socksHost, socksPort, googleHost, sni, scriptKeys, tunnelKey, socksUser, socksPass } = parsed.data

    if (socksPort !== undefined && socksPort !== existingCore.config?.socksPort) {
      const conflict = await db.coreConfig.findFirst({ where: { socksPort, coreId: { not: id } } })
      if (conflict) {
        return NextResponse.json({ error: `Port ${socksPort} is already in use by another core` }, { status: 409 })
      }
    }

    let resolvedBinary: string | undefined
    if (binaryPath !== undefined) {
      resolvedBinary = path.isAbsolute(binaryPath) ? binaryPath : path.join(coresDir, binaryPath)
    }

    const core = await db.core.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(resolvedBinary !== undefined && { binaryPath: resolvedBinary }),
        ...(socksHost !== undefined || socksPort !== undefined || googleHost !== undefined ||
          sni !== undefined || scriptKeys !== undefined || tunnelKey !== undefined ||
          socksUser !== undefined || socksPass !== undefined
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
                    socksUser: socksUser ?? '',
                    socksPass: socksPass ?? '',
                  },
                  update: {
                    ...(socksHost !== undefined && { socksHost }),
                    ...(socksPort !== undefined && { socksPort }),
                    ...(googleHost !== undefined && { googleHost }),
                    ...(sni !== undefined && { sni }),
                    ...(scriptKeys !== undefined && { scriptKeys: JSON.stringify(scriptKeys) }),
                    ...(tunnelKey !== undefined && { tunnelKey }),
                    ...(socksUser !== undefined && { socksUser }),
                    ...(socksPass !== undefined && { socksPass }),
                  },
                },
              },
            }
          : {}),
      },
      include: { config: true, flowDriverConfig: true, stats: true },
    })

    if (wasRunning) {
      try { await processManager.start(id) } catch (e) {
        console.error(`[cores/${id}] Failed to restart after config update:`, e)
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
