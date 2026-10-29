import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionManager } from '../server/session-manager.mjs'

const secret = 'test-only-auth-secret-that-is-long-enough'
const users = [{ id: 'ANA-001', displayName: 'Ana Amaral', role: 'studio_admin', passwordHash: 'unused-in-session-tests' }]

 test('session manager issues and verifies a signed session for the configured account', () => {
  const manager = createSessionManager()
  const token = manager.create(users[0], secret)
  const session = manager.verify(token, secret, users)
  assert.equal(session.sub, 'ANA-001')
  assert.equal(session.role, 'studio_admin')
  assert.equal(manager.getRevokedCount(), 0)
})

test('logout revokes a copied token immediately without revoking unrelated sessions', () => {
  const manager = createSessionManager()
  const first = manager.create(users[0], secret)
  const second = manager.create(users[0], secret)
  const firstSession = manager.verify(first, secret, users)
  assert.ok(firstSession)
  assert.ok(manager.verify(second, secret, users))

  assert.deepEqual(manager.revoke(first, firstSession.exp * 1000), { revoked: true, rotated: false })
  assert.equal(manager.verify(first, secret, users), null)
  assert.ok(manager.verify(second, secret, users))
  assert.equal(manager.getRevokedCount(), 1)
})

test('a fresh process session manager invalidates tokens from the prior process', () => {
  const firstProcess = createSessionManager()
  const token = firstProcess.create(users[0], secret)
  assert.ok(firstProcess.verify(token, secret, users))

  const restartedProcess = createSessionManager()
  assert.equal(restartedProcess.verify(token, secret, users), null)
})

test('revocation map stays bounded by invalidating all active sessions on overflow', () => {
  const manager = createSessionManager({ maxRevokedSessions: 1 })
  const first = manager.create(users[0], secret)
  const second = manager.create(users[0], secret)
  const firstSession = manager.verify(first, secret, users)
  const secondSession = manager.verify(second, secret, users)

  assert.deepEqual(manager.revoke(first, firstSession.exp * 1000), { revoked: true, rotated: false })
  assert.deepEqual(manager.revoke(second, secondSession.exp * 1000), { revoked: true, rotated: true })
  assert.equal(manager.verify(first, secret, users), null)
  assert.equal(manager.verify(second, secret, users), null)
  assert.equal(manager.getRevokedCount(), 1)
})

test('expired revocation entries are cleaned up', () => {
  let current = 1_800_000_000_000
  const manager = createSessionManager({ now: () => current })
  const token = manager.create(users[0], secret)
  const session = manager.verify(token, secret, users)
  assert.ok(session)
  manager.revoke(token, session.exp * 1000)
  assert.equal(manager.getRevokedCount(), 1)
  current = session.exp * 1000 + 1
  assert.equal(manager.getRevokedCount(), 0)
  assert.equal(manager.verify(token, secret, users), null)
})
