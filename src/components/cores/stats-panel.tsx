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
      <div className="text-center py-8 text-text-muted" style={{fontSize:'0.7rem', letterSpacing:'0.1em', textTransform:'uppercase'}}>
        No stats available. Start the core to begin tracking.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Quota */}
      {quota && (
        <div className="glass-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-text-base flex items-center gap-2 tracking-widest uppercase">
              <Zap className="w-3.5 h-3.5 text-primary" />
              Today's Quota
            </h4>
            <span className={cn(
              'text-sm font-bold',
              quota.isDanger ? 'text-danger' : quota.isWarning ? 'text-warning' : 'text-primary'
            )}>
              {quota.percentage}%
            </span>
          </div>
          <Progress
            value={quota.percentage}
            size="md"
            barClassName={cn(
              quota.isDanger ? 'bg-danger' :
              quota.isWarning ? 'bg-warning' :
              'bg-primary'
            )}
          />
          <div className="flex justify-between mt-2 text-text-muted" style={{fontSize:'0.6rem', letterSpacing:'0.06em'}}>
            <span>{formatNumber(quota.used)} requests</span>
            <span>/ {formatNumber(quota.total)} limit</span>
          </div>
          {(quota.isDanger || quota.isWarning) && (
            <p className={cn(
              'mt-2 text-xs px-3 py-2',
              quota.isDanger ? 'alert-banner text-danger' : 'bg-warning/10 border border-warning/30 text-warning'
            )}>
              {quota.isDanger
                ? 'Quota almost exhausted. Add more deployment IDs or wait for reset.'
                : 'Approaching quota limit. Consider adding more deployment IDs.'}
            </p>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3 h-3 text-text-muted" />
            <span className="font-bold text-text-dim tracking-widest uppercase" style={{fontSize:'0.55rem'}}>Today</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatNumber(stats.todayRequests)}</p>
          <p className="text-text-muted mt-0.5" style={{fontSize:'0.6rem', letterSpacing:'0.06em'}}>requests relayed</p>
        </div>

        <div className="glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3 h-3 text-text-muted" />
            <span className="font-bold text-text-dim tracking-widest uppercase" style={{fontSize:'0.55rem'}}>All time</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatNumber(stats.totalRequests)}</p>
          <p className="text-text-muted mt-0.5" style={{fontSize:'0.6rem', letterSpacing:'0.06em'}}>total requests</p>
        </div>
      </div>

      {/* Reset */}
      <div className="flex items-center justify-between pt-3" style={{borderTop:'1px solid rgba(100,60,35,0.4)'}}>
        <div>
          <p className="text-text-muted" style={{fontSize:'0.6rem', letterSpacing:'0.06em'}}>
            Last daily reset: {new Date(stats.lastResetAt).toLocaleString()}
          </p>
          <p className="text-text-dim mt-0.5" style={{fontSize:'0.6rem', letterSpacing:'0.06em'}}>
            Quota resets daily at 10:30 AM Iran time
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} loading={resetting}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>
    </div>
  )
}
