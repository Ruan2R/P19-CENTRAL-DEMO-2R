import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdminAuth, ADMIN_SESSION_COOKIE, hashAdminPassword, verifyAdminPassword } from '../server/admin/auth.mjs'

test('administrative passwords use scrypt hashes and reject incorrect passwords', () => {
  const hash = hashAdminPassword('uma-senha-de-teste')
  assert.match(hash, /^scrypt\$/)
  assert.equal(verifyAdminPassword('uma-senha-de-teste', hash), true)
  assert.equal(verifyAdminPassword('senha-errada', hash), false)
})

test('local-only development account can create a session and logout revokes that session', () => {
  const auth = createAdminAuth({ NODE_ENV: 'development' })
  const loggedIn = auth.authenticate('admin', 'boss67demo')
  assert.ok(loggedIn)
  assert.match(loggedIn.cookie, /HttpOnly/)
  assert.match(loggedIn.cookie, /SameSite=Lax/)
  const request = { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${loggedIn.token}` } }
  assert.equal(auth.getSession(request)?.id, 'ADMIN')
  const clearedCookie = auth.revokeRequestSession(request)
  assert.match(clearedCookie, /Max-Age=0/)
  assert.equal(auth.getSession(request), null)
})

test('incorrect credentials are rejected and production has no demo account', () => {
  const local = createAdminAuth({ NODE_ENV: 'development' })
  assert.equal(local.authenticate('ADMIN', 'wrong'), null)
  const production = createAdminAuth({ NODE_ENV: 'production' })
  assert.equal(production.authenticate('ADMIN', 'boss67demo'), null)
})

test('empty optional auth secret keeps the local-only development fallback functional', () => {
  const auth = createAdminAuth({ NODE_ENV: 'development', AUTH_SECRET: '' })
  const loggedIn = auth.authenticate('ADMIN', 'boss67demo')
  assert.ok(loggedIn)
  const request = { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${loggedIn.token}` } }
  assert.equal(auth.getSession(request)?.id, 'ADMIN')
})
