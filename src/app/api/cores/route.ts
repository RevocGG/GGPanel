import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import path from 'path'

const CreateCoreSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  binaryPath: z.string().min(1),
  socksHost: z.string().default('127.0.0.1'),
  socksPort: z.number().int().min(1).max(65535).default(1080),
  googleHost: z.string().default('216.239.38.120'),
  sni: z.string().default('www.google.com'),
  scriptKeys: z.array(z.string()).default([]),
  tunnelKey: z.string().default(''),
})

export async function GET() {
  try {
    const cores = await db.core.findMany({
      include: { config: true, stats: true },
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

    const { name, description, binaryPath, socksHost, socksPort, googleHost, sni, scriptKeys, tunnelKey } = parsed.data

    // Resolve binary path relative to cores dir if not absolute
    const coresDir = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')
    const resolvedBinary = path.isAbsolute(binaryPath)
      ? binaryPath
      : path.join(coresDir, binaryPath)

    const core = await db.core.create({
      data: {
        name,
        description: description ?? null,
        binaryPath: resolvedBinary,
        config: {
          create: {
            socksHost,
            socksPort,
            googleHost,
            sni,
            scriptKeys: JSON.stringify(scriptKeys),
            tunnelKey,
          },
        },
        stats: {
          create: {},
        },
      },
      include: { config: true, stats: true },
    })

    return NextResponse.json({ data: core }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create core' }, { status: 500 })
  }
}
