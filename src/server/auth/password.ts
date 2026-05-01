import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

const KEY_LEN = 64
const SALT_LEN = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN).toString('hex')
  const hash = scryptSync(password, salt, KEY_LEN).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.startsWith('scrypt:')) return false
  const [, salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const candidate = scryptSync(password, salt, expected.length)
  if (expected.length !== candidate.length) return false
  return timingSafeEqual(expected, candidate)
}
