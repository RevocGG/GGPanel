import { db } from '@/lib/db'
import { parseScriptKeys, calcQuota, formatNumber } from '@/lib/utils'
import { Plus, Server } from 'lucide-react'
import { CoresClient } from '@/components/cores/cores-client'

async function getCores() {
  return db.core.findMany({
    include: { config: true, stats: true },
    orderBy: { createdAt: 'desc' },
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

export default async function CoresPage() {
  const [cores, binaries] = await Promise.all([getCores(), getAvailableBinaries()])

  const coresWithQuota = cores.map((c) => {
    const keys = c.config ? parseScriptKeys(c.config.scriptKeys) : []
    const quota = c.stats ? calcQuota(c.stats.todayRequests, keys.length) : null
    return { ...c, quota }
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-base">Cores</h1>
          <p className="text-text-muted text-sm mt-1">
            {cores.length} core{cores.length !== 1 ? 's' : ''} · {cores.filter((c) => c.status === 'running').length} running
          </p>
        </div>
        <CoresClient cores={coresWithQuota} binaries={binaries} mode="create-button" />
      </div>

      {cores.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <Server className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-text-base font-medium mb-2">No cores yet</h3>
          <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
            A core is an instance of the GooseRelayVPN client with its own configuration, port, and set of Google Apps Script keys.
          </p>
          <CoresClient cores={[]} binaries={binaries} mode="create-button-primary" />
        </div>
      ) : (
        <CoresClient cores={coresWithQuota} binaries={binaries} mode="list" />
      )}
    </div>
  )
}
