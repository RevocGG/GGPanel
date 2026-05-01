export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { parseScriptKeys, calcQuota, formatNumber } from '@/lib/utils'
import { Plus, Server } from 'lucide-react'
import { CoresClient } from '@/components/cores/cores-client'

async function getCores() {
  return db.core.findMany({
    include: { config: true, stats: true, flowDriverConfig: true },
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
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between" style={{borderBottom:'1px solid rgba(100,60,35,0.4)', paddingBottom:'12px'}}>
        <div>
          <p className="section-label mb-0.5">System</p>
          <h1 className="text-lg font-bold text-text-base tracking-widest uppercase">Core Units</h1>
          <p className="text-text-dim text-xs mt-0.5 tracking-wider">
            {cores.length} unit{cores.length !== 1 ? 's' : ''} · {cores.filter((c) => c.status === 'running').length} active
          </p>
        </div>
        <CoresClient cores={coresWithQuota} binaries={binaries} mode="create-button" />
      </div>

      {cores.length === 0 ? (
        <div className="glass corner-accent p-12 text-center">
          <Server className="w-8 h-8 text-text-muted mx-auto mb-4" />
          <h3 className="text-text-base font-bold tracking-widest uppercase text-xs mb-2">No Units Registered</h3>
          <p className="text-text-dim text-xs mb-5 max-w-md mx-auto tracking-wider">
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
