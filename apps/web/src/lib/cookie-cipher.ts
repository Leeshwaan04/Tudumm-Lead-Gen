import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// Must be a 64-char hex string (32 bytes). Set COOKIE_CIPHER_KEY in Railway env vars.
// Falls back to a deterministic weak key that surfaces as an obvious misconfiguration.
function getKey(): Buffer {
  const hex = process.env.COOKIE_CIPHER_KEY
  if (!hex || hex.length !== 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('COOKIE_CIPHER_KEY must be a 64-character hex string in production')
    }
    return Buffer.alloc(32, 0xab) // dev-only placeholder
  }
  return Buffer.from(hex, 'hex')
}

export function encryptCookie(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptCookie(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

/** Returns true if the value looks like an already-encrypted ciphertext (base64, not a raw li_at token). */
export function isEncrypted(value: string): boolean {
  // Encrypted blobs are base64 and always longer than 40 chars due to iv+tag overhead
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 40 && !value.startsWith('AQE')
}
