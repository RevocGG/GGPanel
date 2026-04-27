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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/cores"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Cores
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-base">{core.name}</h1>
              {core.description && (
                <p className="text-text-muted text-sm mt-0.5">{core.description}</p>
              )}
            </div>
            <Badge variant={statusVariant} dot className="mt-1">
              {core.status}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button
              variant={isRunning ? 'danger' : 'success'}
              size="sm"
              onClick={handleToggle}
              loading={actionLoading && !deleteConfirm}
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
                Restart
              </Button>
            )}
            <Button
              variant={deleteConfirm ? 'danger' : 'outline'}
              size="sm"
              onClick={handleDelete}
              loading={actionLoading && deleteConfirm}
              onBlur={() => setDeleteConfirm(false)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteConfirm ? 'Confirm?' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-border">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors relative',
                tab === id
                  ? 'text-primary tab-active'
                  : 'text-text-muted hover:text-text-base'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="glass rounded-b-xl rounded-tr-xl p-6 mt-0">
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
            <p className="text-text-muted text-sm">No configuration found.</p>
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
