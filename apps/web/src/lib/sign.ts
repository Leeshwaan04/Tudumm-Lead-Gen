// HMAC-signed opaque tokens for unauthenticated links (e.g. email unsubscribe).
// Prevents tampering / ID-enumeration: a valid token proves the server issued it.

import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.COOKIE_CIPHER_KEY ||
    'dev-only-insecure-secret'
  )
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Sign a payload → `${payload}.${sig}`. The payload itself is not secret. */
export function signToken(payload: string): string {
  const sig = b64url(createHmac('sha256', secret()).update(payload).digest()).slice(0, 27)
  return `${payload}.${sig}`
}

/** Verify a `${payload}.${sig}` token. Returns the payload if valid, else null. */
export function verifyToken(token: string): string | null {
  const i = token.lastIndexOf('.')
  if (i <= 0) return null
  const payload = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expected = b64url(createHmac('sha256', secret()).update(payload).digest()).slice(0, 27)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return null
    return timingSafeEqual(a, b) ? payload : null
  } catch {
    return null
  }
}
