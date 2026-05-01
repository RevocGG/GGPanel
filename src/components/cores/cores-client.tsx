'use client'

import { useState } from 'react'
import { Plus, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoreCard } from '@/components/cores/core-card'
import { CreateCoreDialog } from '@/components/cores/create-core-dialog'
import type { QuotaInfo } from '@/types'

type ClonePrefill = {
  name: string
  binaryPath: string
  socksHost?: string
  socksPort?: number
  googleHost?: string
  sni?: string
  scriptKeys?: string[]
  tunnelKey?: string
}

interface CoreItem {
  id: string
  name: string
  status: string
  binaryPath: string
  coreType: string
  flowDriverConfig: {
    listenAddr: string
  } | null
  config: {
    socksPort: number
    socksHost: string
    googleHost: string
    sni: string
    scriptKeys: string
    tunnelKey: string
  } | null
  stats: { todayRequests: number } | null
  quota: QuotaInfo | null
}

interface Props {
  cores: CoreItem[]
  binaries: string[]
  mode: 'list' | 'create-button' | 'create-button-primary'
}

export function CoresClient({ cores, binaries, mode }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [clonePrefill, setClonePrefill] = useState<ClonePrefill | null>(null)

  function openCreate() {
    setClonePrefill(null)
    setDialogOpen(true)
  }

  function openClone(prefill: ClonePrefill) {
    setClonePrefill(prefill)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setClonePrefill(null)
  }

  if (mode === 'create-button') {
    return (
      <>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Create Core
        </Button>
        {dialogOpen && (
          <CreateCoreDialog binaries={binaries} onClose={closeDialog} prefill={clonePrefill ?? undefined} />
        )}
      </>
    )
  }

  if (mode === 'create-button-primary') {
    return (
      <>
        <Button variant="default" size="lg" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Create first core
        </Button>
        {dialogOpen && (
          <CreateCoreDialog binaries={binaries} onClose={closeDialog} prefill={clonePrefill ?? undefined} />
        )}
      </>
    )
  }

  // mode === 'list'
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {cores.map((core) => (
          <CoreCard key={core.id} core={core} onClone={openClone} />
        ))}
      </div>
      {dialogOpen && (
        <CreateCoreDialog binaries={binaries} onClose={closeDialog} prefill={clonePrefill ?? undefined} />
      )}
    </>
  )
}
