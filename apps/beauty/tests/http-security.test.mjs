import test from 'node:test'
import assert from 'node:assert/strict'
import { applySecurityHeaders, rateLimit, sameOrigin } from '../server/http-security.mjs'

test('rate limiter blocks after the configured threshold and resets after the window', () => {
  const map = new Map()
  assert.deepEqual(rateLimit(map, 'client-a', { max: 1, windowMs: 60_000 }), { allowed: true, retryAfter: 0 })
  const second = rateLimit(map, 'client-a', { max: 1, windowMs: 60_000 })
  assert.equal(second.allowed, false)
  assert.ok(second.retryAfter >= 1)

  map.set('expired-client', { count: 99, resetAt: Date.now() - 1 })
  assert.equal(rateLimit(map, 'expired-client', { max: 1, windowMs: 60_000 }).allowed, true)
})

test('rate limiter keeps its key map bounded when many keys are received', () => {
  const map = new Map()
  for (let index = 0; index < 5_100; index += 1) {
    rateLimit(map, `client-${index}`, { max: 2, windowMs: 60_000 })
  }
  assert.ok(map.size <= 5_000)
  assert.equal(map.has('client-5099'), true)
})

test('same-origin checks host and requires HTTPS in production', () => {
  assert.equal(sameOrigin({ headers: { origin: 'https://studio.example', host: 'studio.example' } }, { production: true }), true)
  assert.equal(sameOrigin({ headers: { origin: 'http://studio.example', host: 'studio.example' } }, { production: true }), false)
  assert.equal(sameOrigin({ headers: { origin: 'https://other.example', host: 'studio.example' } }, { production: true }), false)
  assert.equal(sameOrigin({ headers: { host: 'localhost:5173' } }, { production: false }), true)
  assert.equal(sameOrigin({ headers: { host: 'studio.example' } }, { production: true }), false)
})

test('security headers include HSTS and a restrictive content policy only in production', () => {
  const devHeaders = new Map()
  applySecurityHeaders({ setHeader: (key, value) => devHeaders.set(key, value) }, { production: false })
  assert.equal(devHeaders.get('X-Frame-Options'), 'DENY')
  assert.equal(devHeaders.has('Strict-Transport-Security'), false)
  assert.equal(devHeaders.has('Content-Security-Policy'), false)

  const prodHeaders = new Map()
  applySecurityHeaders({ setHeader: (key, value) => prodHeaders.set(key, value) }, { production: true })
  assert.equal(prodHeaders.get('Strict-Transport-Security'), 'max-age=31536000')
  assert.match(prodHeaders.get('Content-Security-Policy'), /frame-ancestors 'none'/)
  assert.match(prodHeaders.get('Content-Security-Policy'), /https:\/\/challenges\.cloudflare\.com/)
})
