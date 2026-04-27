import { db } from '@/lib/db'
import { parseScriptKeys, calcQuota, formatNumber } from '@/lib/utils'
import { Activity, Server, Zap, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

async function getStats() {
  const [allCores, stats] = await Promise.all([
    db.core.findMany({ include: { config: true, stats: true } }),
    db.coreStats.findMany(),
  ])

  const running = allCores.filter((c) => c.status === 'running').length
  const totalRequests = stats.reduce((s, st) => s + st.todayRequests, 0)
  const criticalCores = allCores.filter((c) => {
    if (!c.stats || !c.config) return false
    const keys = parseScriptKeys(c.config.scriptKeys)
    const quota = calcQuota(c.stats.todayRequests, keys.length)
    return quota.isDanger
  })

  return { total: allCores.length, running, totalRequests, criticalCores, allCores }
}

export default async function DashboardPage() {
  const { total, running, totalRequests, criticalCores, allCores } = await getStats()

  const statCards = [
    {
      label: 'Total Cores',
      value: total,
      icon: Server,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Running',
      value: running,
      icon: Activity,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: "Today's Requests",
      value: formatNumber(totalRequests),
      icon: Zap,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    {
      label: 'Quota Alerts',
      value: criticalCores.length,
      icon: AlertTriangle,
      color: criticalCores.length > 0 ? 'text-danger' : 'text-text-muted',
      bg: criticalCores.length > 0 ? 'bg-danger/10' : 'bg-bg-elevated',
    },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-base">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">Overview of all managed cores</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass rounded-xl p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-muted text-xs font-medium uppercase tracking-wider">{label}</span>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center glow-primary`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Quota warnings */}
      {criticalCores.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-danger font-medium text-sm">Quota limit reached</p>
            <p className="text-text-muted text-sm mt-0.5">
              {criticalCores.map((c) => c.name).join(', ')} — daily Google Apps Script quota is almost exhausted.
              Add more deployment IDs or wait for the quota to reset (10:30 AM Iran time).
            </p>
          </div>
        </div>
      )}

      {/* Recent cores */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-base">Cores</h2>
          <Link
            href="/cores"
            className="text-primary text-sm hover:text-primary/80 transition-colors"
          >
            View all →
          </Link>
        </div>

        {allCores.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Server className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">No cores yet.</p>
            <Link
              href="/cores"
              className="inline-block mt-3 text-primary text-sm hover:underline"
            >
              Create your first core →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allCores.slice(0, 6).map((core) => {
              const keys = core.config ? parseScriptKeys(core.config.scriptKeys) : []
              const quota = core.stats ? calcQuota(core.stats.todayRequests, keys.length) : null
              const isRunning = core.status === 'running'

              return (
                <Link key={core.id} href={`/dashboard/cores/${core.id}`}>
                  <div className="glass rounded-xl p-5 card-hover group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-success glow-success status-dot-running' : 'bg-text-muted'}`} />
                        <span className="font-medium text-text-base text-sm group-hover:text-primary transition-colors">
                          {core.name}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        core.status === 'running' ? 'badge-running' :
                        core.status === 'error' ? 'badge-error' :
                        core.status === 'starting' ? 'badge-starting' :
                        'badge-stopped'
                      }`}>
                        {core.status}
                      </span>
                    </div>

                    <p className="text-text-muted text-xs mb-3">
                      SOCKS5 :{core.config?.socksPort ?? '—'} · {keys.length} key{keys.length !== 1 ? 's' : ''}
                    </p>

                    {quota && (
                      <div>
                        <div className="flex justify-between text-xs text-text-muted mb-1">
                          <span>Quota today</span>
                          <span className={quota.isDanger ? 'text-danger' : quota.isWarning ? 'text-warning' : ''}>
                            {quota.percentage}%
                          </span>
                        </div>
                        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden progress-glow">
                          <div
                            className={`h-full rounded-full transition-all ${
                              quota.isDanger ? 'bg-danger glow-danger' : quota.isWarning ? 'bg-warning glow-accent' : 'bg-primary glow-primary'
                            }`}
                            style={{ width: `${quota.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
