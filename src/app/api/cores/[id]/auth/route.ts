import { NextRequest, NextResponse } from 'next/server'
import { processManager } from '@/lib/process-manager'
import { db } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/cores/[id]/auth
 *
 * Used for FlowDriver OAuth2 flow.
 * When the binary outputs a Google auth URL, the UI shows an OAuth dialog.
 * The user pastes the callback URL (http://localhost?code=...) here.
 * We forward it to the binary via stdin, completing authentication.
 *
 * After successful auth, FlowDriver creates a .token file next to credentials.json.
 * Subsequent starts will use that token without needing OAuth again.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const core = await db.core.findUnique({ where: { id } })
    if (!core) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (core.coreType !== 'flowdriver') {
      return NextResponse.json({ error: 'OAuth flow is only for FlowDriver cores' }, { status: 400 })
    }

    if (!processManager.isRunning(id)) {
      return NextResponse.json({ error: 'Core is not running' }, { status: 409 })
    }

    const oauthState = processManager.getOAuthState(id)
    if (oauthState !== 'waiting') {
      return NextResponse.json({ error: `OAuth state is "${oauthState}" — not waiting for callback` }, { status: 409 })
    }

    const body = await req.json()
    const callbackUrl = body?.callbackUrl
    if (!callbackUrl || typeof callbackUrl !== 'string') {
      return NextResponse.json({ error: 'callbackUrl is required' }, { status: 400 })
    }

    processManager.sendStdin(id, callbackUrl)

    return NextResponse.json({ message: 'Callback URL sent to process' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send auth callback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
