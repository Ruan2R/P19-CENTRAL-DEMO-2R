const MAX_RATE_LIMIT_KEYS = 5000
const SWEEP_EVERY = 128
const mapOperationCounts = new WeakMap()

export function rateLimit(map, key, { max = 10, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const nextCount = (mapOperationCounts.get(map) ?? 0) + 1
  mapOperationCounts.set(map, nextCount)

  // Expired IP keys must not accumulate forever in long-lived Node processes.
  if (nextCount % SWEEP_EVERY === 0 || map.size >= MAX_RATE_LIMIT_KEYS) {
    for (const [storedKey, entry] of map) {
      if (entry.resetAt <= now) map.delete(storedKey)
    }
  }

  let prior = map.get(key)
  if (prior && prior.resetAt <= now) {
    map.delete(key)
    prior = undefined
  }

  if (!prior) {
    // Keep memory bounded even if requests arrive with many distinct IP keys.
    while (map.size >= MAX_RATE_LIMIT_KEYS) {
      const oldestKey = map.keys().next().value
      if (oldestKey === undefined) break
      map.delete(oldestKey)
    }
    map.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  prior.count += 1
  return {
    allowed: prior.count <= max,
    retryAfter: Math.max(1, Math.ceil((prior.resetAt - now) / 1000)),
  }
}

export function sameOrigin(request, { production = false } = {}) {
  const origin = request.headers.origin
  if (!origin) return !production

  try {
    const parsed = new URL(origin)
    const requestHost = String(request.headers.host ?? '').toLowerCase()
    if (!requestHost || parsed.host.toLowerCase() !== requestHost) return false
    // Production admin mutations must originate from the HTTPS site, not HTTP on the same host.
    if (production && parsed.protocol !== 'https:') return false
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function applySecurityHeaders(response, { production = false } = {}) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (production) {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000')
    response.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data: blob: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "script-src 'self' https://challenges.cloudflare.com",
        'frame-src https://challenges.cloudflare.com',
        "connect-src 'self' https://challenges.cloudflare.com",
        'upgrade-insecure-requests',
      ].join('; '),
    )
  }
}
