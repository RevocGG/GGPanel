'use client'

import { formatNumber, calcQuota, parseScriptKeys } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { RotateCcw, TrendingUp, Calendar, Zap } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface StatsData {
  todayRequests: number
  totalRequests: number
  lastResetAt: string
}

interface Props {
  coreId: string
  stats: StatsData | null
  scriptKeys: string[]
}

export function StatsPanel({ coreId, stats, scriptKeys }: Props) {
  const [resetting, setResetting] = useState(false)
  const router = useRouter()

  const quota = stats ? calcQuota(stats.todayRequests, scriptKeys.length) : null

  async function handleReset() {
    setResetting(true)
    try {
      const res = await fetch(`/api/cores/${coreId}/stats/reset`, { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      toast.success('Daily counter reset')
      router.refresh()
    } catch {
      toast.error('Failed to reset stats')
    } finally {
      setResetting(false)
    }
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No stats available yet. Start the core to begin tracking.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quota */}
      {quota && (
        <div className="glass-elevated rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Today's Quota
            </h4>
            <span className={cn(
              'text-sm font-bold',
              quota.isDanger ? 'text-danger' : quota.isWarning ? 'text-yellow-400' : 'text-primary'
            )}>
              {quota.percentage}%
            </span>
          </div>
          <Progress
            value={quota.percentage}
            size="md"
            barClassName={cn(
              quota.isDanger ? 'bg-danger' :
              quota.isWarning ? 'bg-yellow-400' :
              'bg-primary'
            )}
          />
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span>{formatNumber(quota.used)} requests</span>
            <span>/ {formatNumber(quota.total)} limit</span>
          </div>
          {(quota.isDanger || quota.isWarning) && (
            <p className={cn(
              'mt-3 text-xs rounded-lg px-3 py-2',
              quota.isDanger ? 'bg-danger/10 text-danger' : 'bg-yellow-500/10 text-yellow-400'
            )}>
              {quota.isDanger
                ? 'Quota almost exhausted. Add more deployment IDs or wait for reset.'
                : 'Approaching quota limit. Consider adding more deployment IDs.'}
            </p>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted uppercase tracking-wide">Today</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatNumber(stats.todayRequests)}</p>
          <p className="text-xs text-text-muted mt-0.5">requests relayed</p>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted uppercase tracking-wide">All time</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatNumber(stats.totalRequests)}</p>
          <p className="text-xs text-text-muted mt-0.5">total requests</p>
        </div>
      </div>

      {/* Reset */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs text-text-muted">
            Last daily reset: {new Date(stats.lastResetAt).toLocaleString()}
          </p>
          <p className="text-xs text-text-dim mt-0.5">
            Quota resets daily at 10:30 AM Iran time
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} loading={resetting}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset today
        </Button>
      </div>
    </div>
  )
}
