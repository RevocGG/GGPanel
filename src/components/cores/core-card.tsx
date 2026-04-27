'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Play, Square, Settings, RotateCcw, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LogViewer } from '@/components/cores/log-viewer'
import { formatNumber, cn } from '@/lib/utils'
import type { QuotaInfo } from '@/types'

interface Props {
  core: {
    id: string
    name: string
    status: string
    config: { socksPort: number; scriptKeys: string } | null
    quota: QuotaInfo | null
  }
}

export function CoreCard({ core }: Props) {
  const [loading, setLoading] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const router = useRouter()
  const isRunning = core.status === 'running'

  async function toggleStatus() {
    setLoading(true)
    try {
      const action = isRunning ? 'stop' : 'start'
      const res = await fetch(`/api/cores/${core.id}/${action}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `${action} failed`)
      toast.success(isRunning ? 'Core stopped' : 'Core started')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRestart() {
    setRestartLoading(true)
    try {
      const res = await fetch(`/api/cores/${core.id}/restart`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Restart failed')
      toast.success('Core restarted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restart failed')
    } finally {
      setRestartLoading(false)
    }
  }

  const statusVariant = (core.status === 'running' ? 'running' :
    core.status === 'error' ? 'error' :
    core.status === 'starting' ? 'starting' : 'stopped') as 'running' | 'error' | 'starting' | 'stopped'

  return (
    <div className={cn(
      'glass rounded-xl flex flex-col gap-0 overflow-hidden card-hover',
      isRunning && 'border-cyan-500/25',
      core.status === 'error' && 'border-red-500/25',
    )}>
      {/* Header */}
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-text-base text-sm truncate">{core.name}</h3>
            <p className="text-text-muted text-xs mt-0.5 font-mono">
              SOCKS5 :{core.config?.socksPort ?? '—'}
            </p>
          </div>
          <Badge variant={statusVariant} dot>
            {core.status}
          </Badge>
        </div>

        {/* Quota */}
        {core.quota ? (
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span className="font-mono">{formatNumber(core.quota.used)} / {formatNumber(core.quota.total)}</span>
              <span className={cn(
                'font-semibold',
                core.quota.isDanger ? 'text-danger' :
                core.quota.isWarning ? 'text-yellow-400' : 'text-primary'
              )}>
                {core.quota.percentage}%
              </span>
            </div>
            <Progress
              value={core.quota.percentage}
              barClassName={cn(
                core.quota.isDanger ? 'bg-danger' :
                core.quota.isWarning ? 'bg-yellow-400' :
                'bg-primary'
              )}
            />
          </div>
        ) : (
          <p className="text-xs text-text-dim italic">No stats yet</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant={isRunning ? 'danger' : 'success'}
            size="sm"
            onClick={toggleStatus}
            loading={loading || core.status === 'starting'}
            className="flex-1"
          >
            {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Stop' : 'Start'}
          </Button>
          {isRunning && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              loading={restartLoading}
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLogs((v) => !v)}
            title={showLogs ? 'Hide logs' : 'Show logs'}
          >
            <Terminal className="w-3.5 h-3.5" />
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Link href={`/dashboard/cores/${core.id}`}>
            <Button variant="outline" size="sm" title="Settings">
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Inline log panel */}
      {showLogs && (
        <div className="border-t border-border px-4 pb-4 pt-3 bg-[#030812]">
          <LogViewer coreId={core.id} isRunning={isRunning} compact />
        </div>
      )}
    </div>
  )
}
