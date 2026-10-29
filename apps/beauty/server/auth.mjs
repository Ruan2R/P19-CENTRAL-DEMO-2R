import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

export const SESSION_SECONDS = 8 * 60 * 60
const ALLOWED_ROLES = new Set(['owner', 'studio_admin'])

export function normalizeLoginId(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function validateLoginId(value) {
  const id = normalizeLoginId(value)
  if (!/^[A-Z0-9_-]{3,40}$/.test(id)) {
    throw new Error('Use um ID de 3 a 40 caracteres: letras, números, hífen ou sublinhado.')
  }
  return id
}

export function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyPassword(password, encodedHash) {
  const [algorithm, saltHex, hashHex, extra] = String(encodedHash ?? '').split('$')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex || extra) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    if (!salt.length || !expected.length) return false
    const actual = scryptSync(String(password ?? ''), salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function getConfiguredAdminUsers(serverEnv = {}) {
  const rawConfig = String(serverEnv.ADMIN_USERS_JSON ?? '').trim()
  if (rawConfig) {
    let parsed
    try {
      parsed = JSON.parse(rawConfig)
    } catch {
      throw new Error('ADMIN_USERS_JSON não contém uma configuração JSON válida. Execute npm run admin:setup novamente.')
    }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) {
      throw new Error('ADMIN_USERS_JSON precisa conter entre 1 e 20 usuários administrativos.')
    }
    const seen = new Set()
    return parsed.map((item) => {
      const id = validateLoginId(item?.id)
      const displayName = String(item?.displayName ?? '').trim()
      const role = String(item?.role ?? '')
      const passwordHash = String(item?.passwordHash ?? '')
      if (seen.has(id)) throw new Error(`O ID administrativo ${id} está duplicado.`)
      if (!displayName || displayName.length > 80) throw new Error(`Nome de exibição inválido para ${id}.`)
      if (!ALLOWED_ROLES.has(role)) throw new Error(`Perfil administrativo inválido para ${id}.`)
      if (!passwordHash.startsWith('scrypt$')) throw new Error(`Hash de senha inválido para ${id}. Execute npm run admin:setup novamente.`)
      seen.add(id)
      return { id, displayName, role, passwordHash }
    })
  }

  // Compatibility with the previous single-account setup.
  const legacyId = normalizeLoginId(serverEnv.ADMIN_LOGIN_ID)
  const legacyHash = String(serverEnv.ADMIN_PASSWORD_HASH ?? '')
  if (legacyId && legacyHash) {
    return [{
      id: legacyId,
      displayName: legacyId === 'RUAN-2R' ? 'Ruan Rodrigues' : 'Ana Amaral',
      role: legacyId === 'RUAN-2R' ? 'owner' : 'studio_admin',
      passwordHash: legacyHash,
    }]
  }
  if (serverEnv.P19_DEMO_MODE === 'true') {
    return [{ id: 'DEMO-2R', displayName: '2R Beauty Demonstração', role: 'owner', passwordHash: hashPassword('2Rdemo26') }]
  }
  return []
}

function signToken(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(user, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    exp: Math.floor(now / 1000) + SESSION_SECONDS,
    nonce: randomUUID(),
  })).toString('base64url')
  return `${payload}.${signToken(payload, secret)}`
}

export function verifySessionToken(token, secret, configuredUsers, now = Date.now()) {
  if (!token || !secret || !Array.isArray(configuredUsers)) return null
  const [payload, signature, extra] = String(token).split('.')
  if (!payload || !signature || extra) return null
  const expected = Buffer.from(signToken(payload, secret))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const user = configuredUsers.find((candidate) => candidate.id === decoded?.sub)
    if (!user || decoded.role !== user.role || !Number.isFinite(decoded.exp) || decoded.exp <= Math.floor(now / 1000)) return null
    return { sub: user.id, role: user.role, displayName: user.displayName, exp: decoded.exp }
  } catch {
    return null
  }
}
