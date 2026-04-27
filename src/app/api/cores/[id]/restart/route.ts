import { NextRequest, NextResponse } from 'next/server'
import { processManager } from '@/lib/process-manager'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    if (processManager.isRunning(id)) {
      await processManager.stop(id)
    }
    await processManager.start(id)
    return NextResponse.json({ message: 'Core restarted' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to restart core'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
