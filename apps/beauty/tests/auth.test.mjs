import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionToken, getConfiguredAdminUsers, hashPassword, normalizeLoginId, validateLoginId, verifyPassword, verifySessionToken } from '../server/auth.mjs'

const ownerPassword = 'Senha-de-teste-Owner-2026!'
const anaPassword = 'Senha-de-teste-Fer-2026!'
const users = [
  { id: 'RUAN-2R', displayName: 'Ruan Rodrigues', role: 'owner', passwordHash: hashPassword(ownerPassword) },
  { id: 'ANA-001', displayName: 'Ana Amaral', role: 'studio_admin', passwordHash: hashPassword(anaPassword) },
]

test('normalizes and validates IDs for individual administrator accounts', () => {
  assert.equal(normalizeLoginId(' ruan-2r '), 'RUAN-2R')
  assert.equal(validateLoginId('ANA-001'), 'ANA-001')
  assert.throws(() => validateLoginId('ab'), /3 a 40 caracteres/)
  assert.throws(() => validateLoginId('DANY 001'), /3 a 40 caracteres/)
})

test('passwords are stored as scrypt hashes and verified independently', () => {
  assert.match(users[0].passwordHash, /^scrypt\$/)
  assert.notEqual(users[0].passwordHash, ownerPassword)
  assert.equal(verifyPassword(ownerPassword, users[0].passwordHash), true)
  assert.equal(verifyPassword(anaPassword, users[0].passwordHash), false)
  assert.equal(verifyPassword(anaPassword, users[1].passwordHash), true)
})

test('loads the two configured accounts and rejects duplicate IDs', () => {
  const configured = getConfiguredAdminUsers({ ADMIN_USERS_JSON: JSON.stringify(users) })
  assert.equal(configured.length, 2)
  assert.equal(configured.find((user) => user.id === 'RUAN-2R')?.role, 'owner')
  assert.equal(configured.find((user) => user.id === 'ANA-001')?.displayName, 'Ana Amaral')
  assert.throws(() => getConfiguredAdminUsers({ ADMIN_USERS_JSON: JSON.stringify([users[0], { ...users[1], id: 'ruan-2r' }]) }), /duplicado/)
})

test('sessions are tied to a configured account and its role', () => {
  const now = 1_800_000_000_000
  const token = createSessionToken(users[0], 'a-long-development-secret-for-tests', now)
  const session = verifySessionToken(token, 'a-long-development-secret-for-tests', users, now + 1000)
  assert.equal(session?.sub, 'RUAN-2R')
  assert.equal(session?.displayName, 'Ruan Rodrigues')
  assert.equal(session?.role, 'owner')
  assert.equal(verifySessionToken(token, 'wrong-secret', users, now + 1000), null)
  assert.equal(verifySessionToken(token, 'a-long-development-secret-for-tests', [users[1]], now + 1000), null)
  assert.equal(verifySessionToken(token, 'a-long-development-secret-for-tests', [{ ...users[0], role: 'studio_admin' }], now + 1000), null)
  assert.equal(verifySessionToken(token, 'a-long-development-secret-for-tests', users, now + (9 * 60 * 60 * 1000)), null)
})
