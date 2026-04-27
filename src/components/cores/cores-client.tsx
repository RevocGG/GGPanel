'use client'

import { useState } from 'react'
import { Plus, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoreCard } from '@/components/cores/core-card'
import { CreateCoreDialog } from '@/components/cores/create-core-dialog'
import type { QuotaInfo } from '@/types'

interface CoreItem {
  id: string
  name: string
  status: string
  config: { socksPort: number; scriptKeys: string } | null
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

  if (mode === 'create-button') {
    return (
      <>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Create Core
        </Button>
        {dialogOpen && (
          <CreateCoreDialog binaries={binaries} onClose={() => setDialogOpen(false)} />
        )}
      </>
    )
  }

  if (mode === 'create-button-primary') {
    return (
      <>
        <Button variant="default" size="lg" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Create first core
        </Button>
        {dialogOpen && (
          <CreateCoreDialog binaries={binaries} onClose={() => setDialogOpen(false)} />
        )}
      </>
    )
  }

  // mode === 'list'
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cores.map((core) => (
          <CoreCard key={core.id} core={core} />
        ))}
      </div>
      {dialogOpen && (
        <CreateCoreDialog binaries={binaries} onClose={() => setDialogOpen(false)} />
      )}
    </>
  )
}
