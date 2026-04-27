import { SignJWT, jwtVerify } from 'jose'
import { timingSafeEqual } from 'crypto'

const getSecret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? 'fallback-dev-secret-change-this')

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

  try {
    const userMatch = timingSafeEqual(
      Buffer.from(inputUser.padEnd(validUser.length)),
      Buffer.from(validUser)
    )
    const passMatch = timingSafeEqual(
      Buffer.from(inputPass.padEnd(validPass.length)),
      Buffer.from(validPass)
    )
    // Avoid short-circuit: check both regardless
    return userMatch && passMatch && inputUser.length === validUser.length && inputPass.length === validPass.length
  } catch {
    return false
  }
}
