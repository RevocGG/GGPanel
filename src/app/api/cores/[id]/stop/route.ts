import { NextRequest, NextResponse } from 'next/server'
import { processManager } from '@/lib/process-manager'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await processManager.stop(id)
    return NextResponse.json({ message: 'Core stopped' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stop core'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
