'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSession, validateCredentials } from '@/lib/auth'

export async function loginAction(_prevState: unknown, formData: FormData): Promise<{ error: string }> {
  const username = (formData.get('username') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  const valid = validateCredentials(username, password)
  if (!valid) {
    return { error: 'Invalid username or password' }
  }

  const token = await createSession(username)
  const cookieStore = await cookies()

  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  redirect('/dashboard')
}
