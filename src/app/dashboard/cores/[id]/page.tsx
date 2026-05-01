export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { parseScriptKeys, calcQuota } from '@/lib/utils'
import { CoreDetailClient } from '@/components/cores/core-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

async function getCore(id: string) {
  return db.core.findUnique({
    where: { id },
    include: { config: true, flowDriverConfig: true, stats: true },
  })
}

async function getAvailableBinaries(): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  const path = await import('path')
  const coresDir = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')
  try {
    const files = await readdir(coresDir)
    return files.filter((f) => !f.startsWith('.'))
  } catch {
    return []
  }
}

async function getRecentLogs(coreId: string) {
  return db.coreLog.findMany({
    where: { coreId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { level: true, message: true, createdAt: true },
  })
}

export default async function CoreDetailPage({ params }: Props) {
  const { id } = await params
  const [core, binaries, logsRaw] = await Promise.all([
    getCore(id),
    getAvailableBinaries(),
    getRecentLogs(id),
  ])

  if (!core) notFound()

  const keys = core.config ? parseScriptKeys(core.config.scriptKeys) : []
  const quota = core.stats ? calcQuota(core.stats.todayRequests, keys.length) : null
  const logs = logsRaw.reverse().map((l) => ({
    level: l.level,
    message: l.message,
    timestamp: l.createdAt.toISOString(),
  }))

  return (
    <CoreDetailClient
      core={{
        ...core,
        createdAt: core.createdAt.toISOString(),
        updatedAt: core.updatedAt.toISOString(),
        config: core.config
          ? { ...core.config, updatedAt: core.config.updatedAt.toISOString() }
          : null,
        flowDriverConfig: core.flowDriverConfig
          ? { ...core.flowDriverConfig, updatedAt: core.flowDriverConfig.updatedAt.toISOString() }
          : null,
        stats: core.stats
          ? {
              ...core.stats,
              lastResetAt: core.stats.lastResetAt.toISOString(),
              updatedAt: core.stats.updatedAt.toISOString(),
            }
          : null,
      }}
      binaries={binaries}
      quota={quota}
      initialLogs={logs}
    />
  )
}
