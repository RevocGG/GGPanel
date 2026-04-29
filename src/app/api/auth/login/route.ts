import { NextRequest, NextResponse } from 'next/server'
import { createSession, validateCredentials } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body ?? {}

    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    if (!validateCredentials(String(username), String(password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await createSession(String(username))
    const cookieStore = await cookies()

    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ message: 'OK' })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
