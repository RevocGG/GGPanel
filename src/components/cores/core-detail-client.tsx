'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Play, Square, Trash2, ArrowLeft, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfigForm } from '@/components/cores/config-form'
import { LogViewer } from '@/components/cores/log-viewer'
import { StatsPanel } from '@/components/cores/stats-panel'
import { parseScriptKeys } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { QuotaInfo } from '@/types'

type Tab = 'config' | 'logs' | 'stats'

interface CoreData {
  id: string
  name: string
  description: string | null
  binaryPath: string
  status: string
  pid: number | null
  createdAt: string
  updatedAt: string
  config: {
    socksHost: string
    socksPort: number
    googleHost: string
    sni: string
    scriptKeys: string
    tunnelKey: string
    updatedAt: string
  } | null
  stats: {
    todayRequests: number
    totalRequests: number
    lastResetAt: string
    updatedAt: string
  } | null
}

interface Props {
  core: CoreData
  binaries: string[]
  quota: QuotaInfo | null
  initialLogs: { level: string; message: string; timestamp: string }[]
}

export function CoreDetailClient({ core, binaries, quota, initialLogs }: Props) {
  const [tab, setTab] = useState<Tab>('config')
  const [actionLoading, setActionLoading] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const router = useRouter()

  const isRunning = core.status === 'running'
  const scriptKeys = core.config ? parseScriptKeys(core.config.scriptKeys) : []

  // Extract binary filename for the form
  const binaryFilename = core.binaryPath.split(/[\\/]/).pop() ?? core.binaryPath

  async function handleToggle() {
    setActionLoading(true)
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
      setActionLoading(false)
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

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/cores/${core.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      toast.success('Core deleted')
      router.push('/dashboard/cores')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
      setDeleteConfirm(false)
    } finally {
      setActionLoading(false)
    }
  }

  const statusVariant = (core.status === 'running' ? 'running' :
    core.status === 'error' ? 'error' :
    core.status === 'starting' ? 'starting' : 'stopped') as any

  const tabs: { id: Tab; label: string }[] = [
    { id: 'config', label: 'Configuration' },
    { id: 'logs', label: 'Logs' },
    { id: 'stats', label: 'Stats' },
  ]

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/cores"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors mb-3 font-bold tracking-widest uppercase btn-hover"
        >
          <ArrowLeft className="w-3 h-3" />
          All Cores
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap" style={{borderBottom:'1px solid rgba(100,60,35,0.4)', paddingBottom:'12px'}}>
          <div className="flex items-center gap-3">
            <div>
              <p className="section-label mb-0.5">Core Unit</p>
              <h1 className="text-lg font-bold text-text-base tracking-widest uppercase">{core.name}</h1>
              {core.description && (
                <p className="text-text-dim text-xs mt-0.5 tracking-wider">{core.description}</p>
              )}
            </div>
            <Badge variant={statusVariant} dot className="mt-1">
              {core.status}
            </Badge>
          </div>

          <div className="flex gap-1.5">
            <Button
              variant={isRunning ? 'danger' : 'success'}
              size="sm"
              onClick={handleToggle}
              loading={actionLoading && !deleteConfirm}
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
                Restart
              </Button>
            )}
            <Button
              variant={deleteConfirm ? 'danger' : 'ghost'}
              size="sm"
              onClick={handleDelete}
              loading={actionLoading && deleteConfirm}
              onBlur={() => setDeleteConfirm(false)}
            >
              <Trash2 className="w-3 h-3" />
              {deleteConfirm ? 'Confirm?' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-0" style={{borderBottom:'1px solid rgba(100,60,35,0.4)'}}>
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'px-5 py-2 text-xs font-bold tracking-widest uppercase transition-colors relative border-b-2',
                tab === id
                  ? 'text-primary border-primary'
                  : 'text-text-muted border-transparent hover:text-text-base'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="glass p-5 mt-0" style={{borderTop:'none', borderTopLeftRadius:0, borderTopRightRadius:0}}>
          {tab === 'config' && core.config && (
            <ConfigForm
              coreId={core.id}
              binaries={binaries}
              defaultValues={{
                socksHost: core.config.socksHost,
                socksPort: core.config.socksPort,
                googleHost: core.config.googleHost,
                sni: core.config.sni,
                scriptKeys,
                tunnelKey: core.config.tunnelKey,
                binaryPath: binaryFilename,
              }}
              onSaved={() => router.refresh()}
            />
          )}
          {tab === 'config' && !core.config && (
            <p className="text-text-muted text-xs tracking-wider uppercase">No configuration found.</p>
          )}

          {tab === 'logs' && (
            <LogViewer
              coreId={core.id}
              initialLogs={initialLogs}
              isRunning={isRunning}
            />
          )}

          {tab === 'stats' && (
            <StatsPanel
              coreId={core.id}
              stats={core.stats}
              scriptKeys={scriptKeys}
            />
          )}
        </div>
      </div>
    </div>
  )
}
