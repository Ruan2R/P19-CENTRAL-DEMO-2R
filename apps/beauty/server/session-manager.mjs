import { createHash, createHmac, randomBytes } from 'node:crypto'
import { SESSION_SECONDS, createSessionToken, verifySessionToken } from './auth.mjs'

const DEFAULT_MAX_REVOKED_SESSIONS = 20_000
const SWEEP_EVERY = 128

function fingerprint(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

/**
 * Session lifecycle for a single Node.js process.
 * - tokens are signed with a process-specific key, so a restart invalidates old sessions;
 * - logout revokes the current token immediately for the lifetime of this process;
 * - the revocation map is bounded; an overflow rotates the process key and invalidates all sessions.
 * A multi-instance deployment must use a shared persistent session store instead.
 */
export function createSessionManager({ maxRevokedSessions = DEFAULT_MAX_REVOKED_SESSIONS, now = Date.now, nonceFactory = () => randomBytes(32) } = {}) {
  if (!Number.isSafeInteger(maxRevokedSessions) || maxRevokedSessions < 1) {
    throw new TypeError('maxRevokedSessions must be a positive safe integer')
  }

  let processNonce = nonceFactory()
  const revoked = new Map()
  let operations = 0

  function sessionSecret(authSecret) {
    const source = String(authSecret ?? '')
    if (!source) return ''
    return createHmac('sha256', source).update(processNonce).digest('base64url')
  }

  function sweepExpired() {
    const current = now()
    for (const [tokenHash, expiresAt] of revoked) {
      if (expiresAt <= current) revoked.delete(tokenHash)
    }
  }

  function verify(token, authSecret, configuredUsers) {
    if (!token) return null
    operations += 1
    if (operations % SWEEP_EVERY === 0) sweepExpired()

    const tokenHash = fingerprint(token)
    const revokedUntil = revoked.get(tokenHash)
    if (revokedUntil !== undefined) {
      if (revokedUntil > now()) return null
      revoked.delete(tokenHash)
    }

    return verifySessionToken(token, sessionSecret(authSecret), configuredUsers, now())
  }

  function create(user, authSecret) {
    return createSessionToken(user, sessionSecret(authSecret), now())
  }

  function revoke(token, expiresAtMs) {
    if (typeof token !== 'string' || !token) return { revoked: false, rotated: false }
    const current = now()
    const tokenExpiry = Number(expiresAtMs)
    if (!Number.isFinite(tokenExpiry) || tokenExpiry <= current) return { revoked: false, rotated: false }

    operations += 1
    if (operations % SWEEP_EVERY === 0 || revoked.size >= maxRevokedSessions) sweepExpired()

    let rotated = false
    if (revoked.size >= maxRevokedSessions) {
      // Never evict an unexpired revocation (that could reactivate a copied token).
      // Instead invalidate all sessions by rotating this process's signing nonce.
      processNonce = nonceFactory()
      revoked.clear()
      rotated = true
    }

    revoked.set(fingerprint(token), Math.min(tokenExpiry, current + SESSION_SECONDS * 1000))
    return { revoked: true, rotated }
  }

  function getRevokedCount() {
    sweepExpired()
    return revoked.size
  }

  return { create, verify, revoke, getRevokedCount }
}
