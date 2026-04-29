import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? 'fallback-dev-secret-change-this')

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  const maxLen = Math.max(aBytes.length, bBytes.length)

  let diff = aBytes.length ^ bBytes.length

  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }

  return diff === 0
}

/** Create a signed JWT session token */
export async function createSession(username: string): Promise<string> {
  return await new SignJWT({ username, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

/** Verify a JWT session token — returns the payload or null */
export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload
  } catch {
    return null
  }
}

/** Timing-safe credential comparison */
export function validateCredentials(inputUser: string, inputPass: string): boolean {
  const validUser = process.env.ADMIN_USERNAME ?? ''
  const validPass = process.env.ADMIN_PASSWORD ?? ''

  if (!validUser || !validPass) return false

  const userMatch = constantTimeEqual(inputUser, validUser)
  const passMatch = constantTimeEqual(inputPass, validPass)

  // Avoid short-circuit: evaluate both regardless
  return userMatch && passMatch
}
