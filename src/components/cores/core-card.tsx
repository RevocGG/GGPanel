'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Play, Square, Settings, RotateCcw, Terminal, ChevronDown, ChevronUp, Copy } from 'lucide-react'
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
    binaryPath: string
    coreType: string
    config: {
      socksPort: number
      socksHost: string
      googleHost: string
      sni: string
      scriptKeys: string
      tunnelKey: string
    } | null
    flowDriverConfig: {
      listenAddr: string
    } | null
    quota: QuotaInfo | null
  }
  onClone?: (prefill: {
    name: string
    binaryPath: string
    socksHost?: string
    socksPort?: number
    googleHost?: string
    sni?: string
    scriptKeys?: string[]
    tunnelKey?: string
  }) => void
}

export function CoreCard({ core, onClone }: Props) {
  function handleClone() {
    if (!onClone) return
    let parsedKeys: string[] = []
    try { parsedKeys = JSON.parse(core.config?.scriptKeys ?? '[]') } catch { }
    onClone({
      name: `Copy of ${core.name}`,
      binaryPath: core.binaryPath,
      socksHost: core.config?.socksHost,
      socksPort: core.config?.socksPort,
      googleHost: core.config?.googleHost,
      sni: core.config?.sni,
      scriptKeys: parsedKeys,
      tunnelKey: core.config?.tunnelKey,
    })
  }
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
      'glass corner-accent flex flex-col gap-0 overflow-hidden card-hover',
      isRunning && 'border-l-2 border-l-success/50',
      core.status === 'error' && 'border-l-2 border-l-danger/50',
    )}>
      {/* Header */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 flex-shrink-0 ${isRunning ? 'bg-success status-dot-running' : 'bg-text-dim'}`} />
              <span className="text-base leading-none" title={core.coreType === 'flowdriver' ? 'FlowDriver' : 'GooseRelayVPN'}>
                {core.coreType === 'flowdriver' ? '🌊' : '🪿'}
              </span>
              <h3 className="font-bold text-text-base text-xs tracking-wider uppercase truncate">{core.name}</h3>
            </div>
            <p className="text-text-dim text-xs mt-0.5 font-mono pl-3.5">
              {core.coreType === 'flowdriver'
                ? `SOCKS5 ${core.flowDriverConfig?.listenAddr ?? '—'}`
                : `SOCKS5 ${core.config?.socksHost ?? '127.0.0.1'}:${core.config?.socksPort ?? '—'}`}
            </p>
          </div>
          <Badge variant={statusVariant} dot>
            {core.status}
          </Badge>
        </div>

        {/* Quota */}
        {core.quota ? (
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span className="font-mono" style={{fontSize:'0.6rem'}}>{formatNumber(core.quota.used)} / {formatNumber(core.quota.total)}</span>
              <span className={cn(
                'font-bold',
                core.quota.isDanger ? 'text-danger' :
                core.quota.isWarning ? 'text-warning' : 'text-text-muted'
              )}>
                {core.quota.percentage}%
              </span>
            </div>
            <Progress
              value={core.quota.percentage}
              barClassName={cn(
                core.quota.isDanger ? 'bg-danger' :
                core.quota.isWarning ? 'bg-warning' :
                'bg-primary'
              )}
            />
          </div>
        ) : (
          <p className="text-xs text-text-dim" style={{fontSize:'0.6rem', letterSpacing:'0.08em'}}>NO STATS YET</p>
        )}

        {/* Actions */}
        <div className="flex gap-1.5">
          <Button
            variant={isRunning ? 'danger' : 'success'}
            size="sm"
            onClick={toggleStatus}
            loading={loading || core.status === 'starting'}
            className="flex-1"
          >
            {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
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
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLogs((v) => !v)}
            title={showLogs ? 'Hide logs' : 'Show logs'}
          >
            <Terminal className="w-3 h-3" />
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          {onClone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClone}
              title="Clone this core"
            >
              <Copy className="w-3 h-3" />
            </Button>
          )}
          <Link href={`/dashboard/cores/${core.id}`}>
            <Button variant="outline" size="sm" title="Settings">
              <Settings className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Inline log panel */}
      {showLogs && (
        <div className="terminal-bg px-3 pb-3 pt-2" style={{borderTop: '1px solid rgba(100,60,35,0.35)'}}>
          <LogViewer coreId={core.id} isRunning={isRunning} compact />
        </div>
      )}
    </div>
  )
}
