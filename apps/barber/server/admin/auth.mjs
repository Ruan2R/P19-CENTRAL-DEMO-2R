import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'p15_admin_session'
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60
const DEV_AUTH_SECRET = 'p15-local-development-secret-change-before-production'

export function normalizeAdminId(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function hashAdminPassword(password) {
  const salt = randomBytes(16)
  const derived = scryptSync(String(password ?? ''), salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyAdminPassword(password, encodedHash) {
  const [algorithm, saltHex, hashHex, extra] = String(encodedHash ?? '').split('$')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex || extra) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    if (!salt.length || expected.length !== 64) return false
    const actual = scryptSync(String(password ?? ''), salt, expected.length)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function loadUsers(env, production) {
  const raw = String(env.ADMIN_USERS_JSON ?? '').trim()
  if (raw) {
    let parsed
    try { parsed = JSON.parse(raw) } catch { throw new Error('ADMIN_USERS_JSON inválido.') }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) throw new Error('ADMIN_USERS_JSON precisa conter de 1 a 20 usuários.')
    const seen = new Set()
    return parsed.map((item) => {
      const id = normalizeAdminId(item?.id)
      const displayName = String(item?.displayName ?? '').trim()
      const role = String(item?.role ?? '')
      const passwordHash = String(item?.passwordHash ?? '')
      if (!/^[A-Z0-9_-]{3,40}$/.test(id)) throw new Error('O ID administrativo deve ter 3 a 40 caracteres alfanuméricos, hífen ou sublinhado.')
      if (seen.has(id)) throw new Error(`O ID ${id} está duplicado.`)
      if (!displayName || displayName.length > 80) throw new Error(`Nome administrativo inválido para ${id}.`)
      if (!['owner', 'manager'].includes(role)) throw new Error(`Perfil administrativo inválido para ${id}.`)
      if (!passwordHash.startsWith('scrypt$')) throw new Error(`Hash de senha inválido para ${id}.`)
      seen.add(id)
      return { id, displayName, role, passwordHash }
    })
  }

  if (production) return []

  if (env.P19_DEMO_MODE === 'true') {
    return [{ id: 'DEMO', displayName: '2R Barber Demonstração', role: 'owner', passwordHash: hashAdminPassword('2Rdemo26') }]
  }

  // Conta exclusivamente local para desenvolvimento. A aplicação recusa NODE_ENV=production
  // nesta etapa, e estes valores nunca devem ser usados para uma publicação real.
  return [{ id: 'ADMIN', displayName: 'Administrador Boss67', role: 'owner', passwordHash: hashAdminPassword('boss67demo') }]
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim()
  }
  return null
}

function cookieValue(token, { production = false, clear = false } = {}) {
  const pieces = [
    `${ADMIN_SESSION_COOKIE}=${clear ? '' : token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${clear ? 0 : ADMIN_SESSION_SECONDS}`,
  ]
  if (production) pieces.push('Secure')
  return pieces.join('; ')
}

export function createAdminAuth(env = {}) {
  const production = env.NODE_ENV === 'production'
  const users = loadUsers(env, production)
  const configuredSecret = String(env.AUTH_SECRET ?? '').trim()
  const secret = configuredSecret || (production ? '' : DEV_AUTH_SECRET)
  const revoked = new Map()

  function createToken(user) {
    const payload = Buffer.from(JSON.stringify({
      sub: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
      nonce: randomUUID(),
    })).toString('base64url')
    return `${payload}.${sign(payload, secret)}`
  }

  function verifyToken(token) {
    if (!token || !secret) return null
    const [payload, signature, extra] = String(token).split('.')
    if (!payload || !signature || extra) return null
    const expected = Buffer.from(sign(payload, secret))
    const received = Buffer.from(signature)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      const user = users.find((candidate) => candidate.id === decoded?.sub)
      if (!user || decoded.role !== user.role || !Number.isFinite(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) return null
      const fingerprint = tokenHash(token)
      const expiry = revoked.get(fingerprint)
      if (expiry && expiry > Date.now()) return null
      if (revoked.size > 5000) {
        for (const [key, expiresAt] of revoked) if (expiresAt <= Date.now()) revoked.delete(key)
      }
      return { id: user.id, displayName: user.displayName, role: user.role, exp: decoded.exp }
    } catch {
      return null
    }
  }

  function sessionFromRequest(request) {
    return verifyToken(readCookie(request.headers?.cookie, ADMIN_SESSION_COOKIE))
  }

  function authenticate(id, password) {
    const normalizedId = normalizeAdminId(id)
    const user = users.find((candidate) => candidate.id === normalizedId)
    const hashToCheck = user?.passwordHash ?? (dummyHash ??= hashAdminPassword('p15-invalid-login-check'))
    const valid = verifyAdminPassword(password, hashToCheck)
    if (!user || !valid) return null
    const token = createToken(user)
    return {
      token,
      cookie: cookieValue(token, { production }),
      user: { id: user.id, displayName: user.displayName, role: user.role },
    }
  }

  let dummyHash
  function revokeRequestSession(request) {
    const token = readCookie(request.headers?.cookie, ADMIN_SESSION_COOKIE)
    const session = verifyToken(token)
    if (token && session) revoked.set(tokenHash(token), session.exp * 1000)
    return cookieValue('', { production, clear: true })
  }

  return {
    getConfiguredUsers: () => users.map(({ passwordHash: _passwordHash, ...user }) => user),
    authenticate,
    getSession: sessionFromRequest,
    revokeRequestSession,
    clearCookie: () => cookieValue('', { production, clear: true }),
  }
}
