import { NextRequest, NextResponse } from 'next/server'
import { processManager } from '@/lib/process-manager'
import { db } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

/** Reset today's request counter for a core */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await db.coreStats.upsert({
      where: { coreId: id },
      update: { todayRequests: 0, lastResetAt: new Date() },
      create: { coreId: id, todayRequests: 0, lastResetAt: new Date() },
    })
    return NextResponse.json({ message: 'Stats reset' })
  } catch {
    return NextResponse.json({ error: 'Failed to reset stats' }, { status: 500 })
  }
}
