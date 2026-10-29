import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handlePublicRoute } from './routes/public.mjs'
import { handleAdminRoute } from './routes/admin.mjs'
import { createAdminAuth } from './admin/auth.mjs'
import { createStorage } from './storage.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = await loadEnvironment(root)
const isProduction = env.NODE_ENV === 'production'
if (isProduction) {
  console.error('P15 ainda não está liberado para produção: autenticação administrativa, painel completo e revisão final de segurança estão pendentes.')
  process.exit(1)
}
const port = Number(env.PORT || 3000)
const host = env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}

async function loadEnvironment(projectRoot) {
  let fileContent = ''
  try { fileContent = await readFile(path.join(projectRoot, '.env'), 'utf8') } catch (error) { if (error?.code !== 'ENOENT') throw error }
  const fromFile = {}
  for (const raw of fileContent.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (match) fromFile[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return { ...fromFile, ...process.env }
}

function json(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders })
  response.end(JSON.stringify(body))
}

function sendText(response, status, text) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(text)
}

function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

async function readJson(request, maxBytes = 32_000) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('INVALID_JSON'), { status: 400 }) }
}

function isSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return !isProduction
  try {
    const parsed = new URL(origin)
    const requestHost = String(request.headers.host || '').toLowerCase()
    if (!requestHost || parsed.host.toLowerCase() !== requestHost) return false
    if (isProduction && parsed.protocol !== 'https:') return false
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const rateLimitBuckets = new Map()
function allowPublicBooking(request) {
  const address = request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const windowMs = 60_000
  const max = 8
  let bucket = rateLimitBuckets.get(address)
  if (!bucket || now - bucket.startedAt >= windowMs) bucket = { startedAt: now, count: 0 }
  bucket.count += 1
  rateLimitBuckets.set(address, bucket)
  if (rateLimitBuckets.size > 5_000) {
    for (const [key, item] of rateLimitBuckets) if (now - item.startedAt >= windowMs) rateLimitBuckets.delete(key)
  }
  return bucket.count <= max
}

const storage = await createStorage(env, root)
const adminAuth = createAdminAuth(env)

const adminLoginBuckets = new Map()
function allowAdminLogin(request) {
  const address = request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const windowMs = 15 * 60_000
  let bucket = adminLoginBuckets.get(address)
  if (!bucket || now - bucket.startedAt >= windowMs) bucket = { startedAt: now, count: 0 }
  bucket.count += 1
  adminLoginBuckets.set(address, bucket)
  if (adminLoginBuckets.size > 5_000) {
    for (const [key, item] of adminLoginBuckets) if (now - item.startedAt >= windowMs) adminLoginBuckets.delete(key)
  }
  return { allowed: bucket.count <= 8, retryAfter: Math.max(1, Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)) }
}

const server = createServer(async (request, response) => {
  applySecurityHeaders(response)
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }

  if (url.pathname.startsWith('/api/admin/')) {
    const method = request.method || 'GET'
    const pathname = url.pathname

    if (method === 'POST' && pathname === '/api/admin/login') {
      if (!isSameOrigin(request)) return json(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
      const limit = allowAdminLogin(request)
      if (!limit.allowed) return json(response, 429, { error: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' }, { 'Retry-After': String(limit.retryAfter) })
      try {
        const payload = await readJson(request)
        const auth = adminAuth.authenticate(payload.id, payload.password)
        if (!auth) return json(response, 401, { error: 'INVALID_CREDENTIALS', message: 'ID ou senha inválidos.' })
        adminLoginBuckets.delete(request.socket.remoteAddress || 'unknown')
        return json(response, 200, { authenticated: true, user: auth.user }, { 'Set-Cookie': auth.cookie })
      } catch (error) {
        if (error?.message === 'REQUEST_TOO_LARGE') return json(response, 413, { error: 'REQUEST_TOO_LARGE', message: 'A solicitação é muito grande.' })
        if (error?.message === 'INVALID_JSON') return json(response, 400, { error: 'INVALID_JSON', message: 'Os dados enviados não estão em um formato válido.' })
        console.error('[P15 auth] Erro de login:', error?.stack || error)
        return json(response, 500, { error: 'AUTH_ERROR', message: 'Não foi possível iniciar a sessão.' })
      }
    }

    if (method === 'GET' && pathname === '/api/admin/session') {
      const user = adminAuth.getSession(request)
      return json(response, 200, { authenticated: Boolean(user), user: user ? { id: user.id, displayName: user.displayName, role: user.role } : null })
    }

    if (method === 'POST' && pathname === '/api/admin/logout') {
      if (!isSameOrigin(request)) return json(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
      const cookie = adminAuth.revokeRequestSession(request)
      return json(response, 200, { success: true }, { 'Set-Cookie': cookie })
    }

    if (method !== 'GET' && !isSameOrigin(request)) return json(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
    const session = adminAuth.getSession(request)
    if (!session) return json(response, 401, { error: 'UNAUTHORIZED', message: 'Sua sessão expirou. Entre novamente para continuar.' })

    try {
      const route = await handleAdminRoute({
        method,
        pathname,
        searchParams: url.searchParams,
        storage,
        session,
        readBody: () => readJson(request),
      })
      return json(response, route.status, route.body)
    } catch (error) {
      if (error?.message === 'REQUEST_TOO_LARGE') return json(response, 413, { error: 'REQUEST_TOO_LARGE', message: 'A solicitação é muito grande.' })
      if (error?.message === 'INVALID_JSON') return json(response, 400, { error: 'INVALID_JSON', message: 'Os dados enviados não estão em um formato válido.' })
      console.error('[P15 admin] Erro inesperado:', error?.stack || error)
      return json(response, 500, { error: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno. Tente novamente.' })
    }
  }

  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'POST' && url.pathname === '/api/public/booking-groups') {
      if (!isSameOrigin(request)) return json(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada. Atualize a página e tente novamente.' })
      if (!allowPublicBooking(request)) return json(response, 429, { error: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.' }, { 'Retry-After': '60' })
    }
    try {
      const route = await handlePublicRoute({
        method: request.method || 'GET',
        pathname: url.pathname,
        searchParams: url.searchParams,
        isProduction,
        storage,
        readBody: () => readJson(request),
      })
      if (!route) return json(response, 404, { error: 'NOT_FOUND', message: 'Rota não encontrada.' })
      return json(response, route.status, route.body)
    } catch (error) {
      if (error?.message === 'REQUEST_TOO_LARGE') return json(response, 413, { error: 'REQUEST_TOO_LARGE', message: 'A solicitação é muito grande.' })
      if (error?.message === 'INVALID_JSON') return json(response, 400, { error: 'INVALID_JSON', message: 'Os dados enviados não estão em um formato válido.' })
      console.error('[P15 API] Erro inesperado:', error?.stack || error)
      return json(response, 500, { error: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno. Tente novamente.' })
    }
  }

  if (isProduction) {
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) return sendText(response, 405, 'Method not allowed')
    let relativePath
    try { relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '') }
    catch { return sendText(response, 400, 'Bad request') }
    const distRoot = path.resolve(root, 'dist')
    const filePath = path.resolve(distRoot, relativePath)
    if (!filePath.startsWith(`${distRoot}${path.sep}`) && filePath !== path.join(distRoot, 'index.html')) return sendText(response, 403, 'Forbidden')
    try {
      const info = await stat(filePath)
      const finalPath = info.isDirectory() ? path.join(filePath, 'index.html') : filePath
      const data = await readFile(finalPath)
      response.writeHead(200, { 'Content-Type': mime[path.extname(finalPath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
      return request.method === 'HEAD' ? response.end() : response.end(data)
    } catch {
      try {
        const data = await readFile(path.join(distRoot, 'index.html'))
        response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-cache' })
        return request.method === 'HEAD' ? response.end() : response.end(data)
      } catch { return sendText(response, 503, 'P15 ainda não possui build de produção.') }
    }
  }

  try {
    const vite = await getViteServer()
    vite.middlewares(request, response, (error) => {
      if (error) {
        console.error(error)
        if (!response.headersSent) sendText(response, 500, 'Erro no servidor de desenvolvimento.')
      }
    })
  } catch (error) {
    console.error(error)
    if (!response.headersSent) sendText(response, 500, 'Não foi possível iniciar o frontend.')
  }
})

let viteInstance
let vitePromise
async function getViteServer() {
  if (viteInstance) return viteInstance
  if (!vitePromise) {
    vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({ configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: { server } }, appType: 'spa' }),
    ).then((instance) => { viteInstance = instance; return instance })
  }
  return vitePromise
}

server.headersTimeout = 15_000
server.requestTimeout = 30_000
server.keepAliveTimeout = 5_000
server.listen(port, host, () => {
  console.log(`\nP15-SISTEMA-BARBEARIA — núcleo de agendamento iniciado.`)
  console.log(`Armazenamento: ${storage.mode === 'mysql' ? 'MySQL' : 'JSON local (persistente neste computador)'}`)
  console.log(`URL: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)
  if (storage.mode !== 'mysql') console.log('Aviso: dados locais são de desenvolvimento; o sistema ainda não deve receber reservas reais.')
})

async function shutdown() {
  server.close()
  if (viteInstance) await viteInstance.close()
  if (typeof storage.close === 'function') await storage.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
