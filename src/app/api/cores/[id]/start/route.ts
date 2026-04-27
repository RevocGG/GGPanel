import { NextRequest, NextResponse } from 'next/server'
import { processManager } from '@/lib/process-manager'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await processManager.start(id)
    return NextResponse.json({ message: 'Core started' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start core'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
