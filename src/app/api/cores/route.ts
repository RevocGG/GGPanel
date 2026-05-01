import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import path from 'path'

// ── Goose core creation schema ────────────────────────────────────────────────
const CreateGooseSchema = z.object({
  coreType: z.literal('goose').default('goose'),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  binaryPath: z.string().min(1),
  socksHost: z.string().default('127.0.0.1'),
  socksPort: z.number().int().min(1).max(65535).default(1080),
  googleHost: z.string().default('216.239.38.120'),
  sni: z.string().default('www.google.com'),
  scriptKeys: z.array(z.string()).default([]),
  tunnelKey: z.string().default(''),
  socksUser: z.string().optional().default(''),
  socksPass: z.string().optional().default(''),
})

// ── FlowDriver core creation schema ──────────────────────────────────────────
// FlowDriver uses Google Drive API — config fields are completely different from Goose.
// See src/lib/config-writer.ts > writeFlowDriverConfigFile for the resulting JSON format.
const CreateFlowDriverSchema = z.object({
  coreType: z.literal('flowdriver'),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  binaryPath: z.string().min(1),
  listenAddr: z.string().default('127.0.0.1:1080'),
  googleFolderId: z.string().default(''),
  refreshRateMs: z.number().int().min(50).max(10000).default(200),
  flushRateMs: z.number().int().min(50).max(10000).default(300),
  transportTarget: z.string().default('216.239.38.120:443'),
  transportSni: z.string().default('google.com'),
  transportHost: z.string().default('www.googleapis.com'),
  credentialsPath: z.string().default(''),
})

const CreateCoreSchema = z.discriminatedUnion('coreType', [
  CreateGooseSchema,
  CreateFlowDriverSchema,
])

export async function GET() {
  try {
    const cores = await db.core.findMany({
      include: { config: true, flowDriverConfig: true, stats: true },
      orderBy: { createdAt: 'desc' },
    })
    // Override DB status and stats with live process-manager state so UI is always accurate
    const { processManager } = await import('@/lib/process-manager')
    const patched = cores.map((c) => {
      const liveCount = processManager.getLiveRequestCount(c.id)
      const liveRunning = processManager.isRunning(c.id)
      return {
        ...c,
        status: liveRunning && c.status !== 'running' ? 'running' : c.status,
        stats: c.stats && liveCount !== null
          ? { ...c.stats, todayRequests: c.stats.todayRequests + liveCount }
          : c.stats,
      }
    })
    return NextResponse.json({ data: patched })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch cores' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateCoreSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const coresDir = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')
    const resolvedBinary = path.isAbsolute(parsed.data.binaryPath)
      ? parsed.data.binaryPath
      : path.join(coresDir, parsed.data.binaryPath)

    if (parsed.data.coreType === 'flowdriver') {
      const { name, description, coreType, listenAddr, googleFolderId, refreshRateMs,
              flushRateMs, transportTarget, transportSni, transportHost, credentialsPath } = parsed.data

      const core = await db.core.create({
        data: {
          name,
          description: description ?? null,
          binaryPath: resolvedBinary,
          coreType,
          flowDriverConfig: {
            create: { listenAddr, googleFolderId, refreshRateMs, flushRateMs,
                      transportTarget, transportSni, transportHost, credentialsPath },
          },
          stats: { create: {} },
        },
        include: { config: true, flowDriverConfig: true, stats: true },
      })
      return NextResponse.json({ data: core }, { status: 201 })
    }

    // Goose core
    const { name, description, socksHost, socksPort, googleHost, sni, scriptKeys, tunnelKey, socksUser, socksPass } = parsed.data

    // Check if port is already used by another core
    const existingPort = await db.coreConfig.findFirst({ where: { socksPort } })
    if (existingPort) {
      return NextResponse.json({ error: `Port ${socksPort} is already in use by another core` }, { status: 409 })
    }

    const core = await db.core.create({
      data: {
        name,
        description: description ?? null,
        binaryPath: resolvedBinary,
        coreType: 'goose',
        config: {
          create: {
            socksHost,
            socksPort,
            googleHost,
            sni,
            scriptKeys: JSON.stringify(scriptKeys),
            tunnelKey,
            socksUser: socksUser ?? '',
            socksPass: socksPass ?? '',
          },
        },
        stats: { create: {} },
      },
      include: { config: true, flowDriverConfig: true, stats: true },
    })

    return NextResponse.json({ data: core }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create core' }, { status: 500 })
  }
}
