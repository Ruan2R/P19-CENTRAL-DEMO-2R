import { createServer } from 'node:http'
import { SESSION_SECONDS, getConfiguredAdminUsers, hashPassword, verifyPassword } from './auth.mjs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStorage } from './storage.mjs'
import { applySecurityHeaders, rateLimit, sameOrigin } from './http-security.mjs'
import { createSessionManager } from './session-manager.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function loadDotEnvFiles(directory) {
  const result = {}
  async function loadFile(name) {
    let content
    try { content = await readFile(path.join(directory, name), 'utf8') } catch (error) { if (error?.code === 'ENOENT') return; throw error }
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!match) continue
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      result[match[1]] = value
    }
  }

  await loadFile('.env')
  await loadFile('.env.local')
  const requestedMode = String(process.env.NODE_ENV || result.NODE_ENV || 'development').trim()
  const mode = /^[a-z0-9_-]+$/i.test(requestedMode) ? requestedMode : 'development'
  await loadFile(`.env.${mode}`)
  await loadFile(`.env.${mode}.local`)
  return result
}

const fileEnv = await loadDotEnvFiles(root)
const env = { ...fileEnv, ...process.env }
const isProduction = env.NODE_ENV === 'production'
const COOKIE_NAME = 'p18_ana_admin_session'
const sessionManager = createSessionManager()
const DUMMY_PASSWORD_HASH = hashPassword('p18-ana-dummy-password-check-value')
const loginAttempts = new Map()
const bookingAttempts = new Map()
const paymentReportAttempts = new Map()
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders })
  response.end(JSON.stringify(payload))
}

function sendText(response, status, text) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(text)
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie ?? ''
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

function cookieHeader(token, clear = false) {
  const pieces = [`${COOKIE_NAME}=${clear ? '' : token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (isProduction) pieces.push('Secure')
  pieces.push(`Max-Age=${clear ? 0 : SESSION_SECONDS}`)
  return pieces.join('; ')
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { status: 400 })
  }
}

function errorResponse(error) {
  const code = typeof error?.message === 'string' ? error.message : 'INTERNAL_ERROR'
  const messages = {
    UNAUTHORIZED: 'Sua sessão expirou ou não tem autorização para esta ação. Entre novamente.',
    INVALID_ORIGIN: 'Origem não autorizada.',
    TOO_MANY_ATTEMPTS: 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.',
    ADMIN_NOT_CONFIGURED: 'Os acessos iniciais ainda não foram configurados. Execute npm run admin:setup no terminal do projeto.',
    TURNSTILE_NOT_CONFIGURED: 'A proteção antispam ainda não foi configurada no servidor.',
    INVALID_JSON: 'Os dados enviados não estão em um formato válido.',
    REQUEST_TOO_LARGE: 'A solicitação enviada é muito grande.',
    INVALID_CUSTOMER_NAME: 'Confira o nome informado. O nome será padronizado automaticamente.',
    INVALID_CUSTOMER_PHONE: 'Informe um WhatsApp válido com DDD.',
    CUSTOMER_PHONE_ALREADY_EXISTS: 'Já existe um cadastro com este telefone. Pesquise pelo nome ou número para editar o cliente.',
    CUSTOMER_NOT_FOUND: 'Esse cadastro de cliente não foi encontrado.',
    INVALID_PROMOTION_NAME: 'Informe um nome para a promoção entre 2 e 100 caracteres.',
    INVALID_PROMOTION_DATES: 'Informe datas válidas e confira se o término é igual ou posterior ao início.',
    INVALID_PROMOTION_ITEMS: 'Selecione pelo menos um serviço para a promoção.',
    PROMOTION_SERVICE_NOT_FOUND: 'Um dos serviços selecionados não existe mais. Atualize a tela e tente novamente.',
    DUPLICATE_PROMOTION_SERVICE: 'Cada serviço só pode aparecer uma vez na mesma promoção.',
    INVALID_PROMOTION_PRICE: 'O preço promocional precisa ser maior que zero e menor que o preço normal atual.',
    PROMOTION_SERVICE_DATE_CONFLICT: 'Já existe outra promoção ativa para um dos serviços nesse período. Ajuste as datas ou pause a outra promoção.',
    PROMOTION_NOT_FOUND: 'Essa promoção não foi encontrada. Atualize a tela e tente novamente.',
    INVALID_BOOKING_DATE: 'A data precisa estar entre hoje e os próximos 60 dias.',
    INVALID_BOOKING_SLOT: 'Selecione um dos horários disponíveis.',
    BOOKING_IN_THE_PAST: 'Esse horário já passou. Escolha outro.',
    SERVICE_NOT_AVAILABLE: 'Esse procedimento não está disponível.',
    POLICY_ACKNOWLEDGEMENT_REQUIRED: 'É necessário aceitar as orientações do estúdio.',
    BUSINESS_POLICIES_UNAVAILABLE: 'As orientações do estúdio não estão disponíveis neste momento.',
    OUTSIDE_BUSINESS_HOURS: 'Esse horário está fora do funcionamento do estúdio.',
    TIME_BLOCKED: 'Esse período está bloqueado na agenda.',
    SLOT_TAKEN: 'Esse horário acabou de ser reservado. Escolha outro horário.',
    SLOT_NOT_AVAILABLE: 'Esse horário não está disponível. Atualize a agenda e escolha outro.',
    INVALID_APPOINTMENT_STATUS: 'O status solicitado não é válido.',
    APPOINTMENT_NOT_FOUND: 'Esse agendamento não foi encontrado.',
    DEPOSIT_NOT_CONFIGURED: 'Configure uma porcentagem de sinal maior que zero no serviço antes de solicitar o pagamento.',
    DEPOSIT_NOT_REQUIRED: 'Este agendamento não tem sinal exigido.',
    DEPOSIT_REPORT_NOT_ALLOWED: 'Não é possível informar pagamento para este agendamento no estado atual.',
    DEPOSIT_NOT_CONFIRMED: 'Confira o sinal antes de concluir o atendimento. Confirme o agendamento após verificar o pagamento.',
    APPOINTMENT_NOT_CONFIRMED: 'Confirme o agendamento antes de marcá-lo como concluído.',
    SERVICE_NOT_FOUND: 'Esse serviço não foi encontrado.',
    INVALID_SERVICE_NAME: 'Informe um nome válido para o serviço.',
    INVALID_SERVICE_CATEGORY: 'Escolha uma categoria para o serviço.',
    SERVICE_IN_USE: 'Este serviço já está associado a um agendamento ou promoção. Desative-o para preservar o histórico.',
    INVALID_SERVICE_DURATION: 'A duração deve ficar entre 15 e 600 minutos.',
    INVALID_SERVICE_PRICE: 'O valor informado não é válido.',
    INVALID_DEPOSIT_PERCENT: 'A porcentagem do sinal deve ficar entre 0 e 100.',
    INVALID_BUSINESS_HOURS: 'Confira os dias, horários e intervalos de funcionamento.',
    INVALID_POLICIES: 'Confira os limites e os textos das orientações.',
    INVALID_BLOCK_DATE: 'Escolha uma data de bloqueio válida, a partir de hoje.',
    INVALID_BLOCK_TIME: 'Informe um período válido ou deixe ambos os horários vazios para bloquear o dia inteiro.',
    BLOCK_ALREADY_EXISTS: 'Esse bloqueio já existe.',
    BLOCK_NOT_FOUND: 'Esse bloqueio já foi removido ou não existe.',
    INVALID_FINANCIAL_DIRECTION: 'Selecione se a movimentação é uma entrada ou saída.',
    INVALID_FINANCIAL_DESCRIPTION: 'Informe uma descrição entre 2 e 120 caracteres.',
    INVALID_FINANCIAL_CATEGORY: 'Informe uma categoria entre 2 e 80 caracteres.',
    INVALID_FINANCIAL_AMOUNT: 'Informe um valor maior que zero.',
    INVALID_FINANCIAL_DATE: 'Informe uma data válida para a movimentação.',
    INVALID_PAYMENT_METHOD: 'Selecione uma forma de recebimento válida.',
    APPOINTMENT_NOT_FINISHED: 'O horário previsto deste atendimento ainda não terminou. O saldo poderá ser registrado depois.',
    NO_BALANCE_TO_RECEIVE: 'Este atendimento não possui saldo pendente de recebimento.',
    FINANCIAL_ENTRY_NOT_FOUND: 'Essa movimentação não foi encontrada.',
    FINANCIAL_ENTRY_PROTECTED: 'Movimentações geradas pelo sistema não podem ser apagadas por aqui.',
    INVALID_PAYABLE_DESCRIPTION: 'Informe uma descrição entre 2 e 120 caracteres.',
    INVALID_PAYABLE_CATEGORY: 'Informe uma categoria entre 2 e 80 caracteres.',
    INVALID_PAYABLE_AMOUNT: 'Informe um valor maior que zero.',
    INVALID_PAYABLE_DUE_DATE: 'Informe uma data de vencimento válida.',
    PAYABLE_NOT_FOUND: 'Essa conta a pagar não foi encontrada.',
    PAID_PAYABLE_PROTECTED: 'Uma conta já paga não pode ser excluída.',
    TURNSTILE_FAILED: 'A verificação antispam não foi concluída. Tente novamente.',
  }
  const status = Number(error?.status) || (['TURNSTILE_FAILED','INVALID_CUSTOMER_NAME','INVALID_CUSTOMER_PHONE','INVALID_BOOKING_DATE','INVALID_BOOKING_SLOT','BOOKING_IN_THE_PAST','SERVICE_NOT_AVAILABLE','POLICY_ACKNOWLEDGEMENT_REQUIRED','OUTSIDE_BUSINESS_HOURS','TIME_BLOCKED','SLOT_TAKEN','SLOT_NOT_AVAILABLE','INVALID_APPOINTMENT_STATUS','DEPOSIT_NOT_CONFIGURED','DEPOSIT_NOT_REQUIRED','DEPOSIT_REPORT_NOT_ALLOWED','DEPOSIT_NOT_CONFIRMED','APPOINTMENT_NOT_CONFIRMED','INVALID_SERVICE_NAME','INVALID_SERVICE_CATEGORY','INVALID_SERVICE_DURATION','INVALID_SERVICE_PRICE','INVALID_DEPOSIT_PERCENT','INVALID_BUSINESS_HOURS','INVALID_POLICIES','INVALID_BLOCK_DATE','INVALID_BLOCK_TIME','BLOCK_ALREADY_EXISTS','INVALID_FINANCIAL_DIRECTION','INVALID_FINANCIAL_DESCRIPTION','INVALID_FINANCIAL_CATEGORY','INVALID_FINANCIAL_AMOUNT','INVALID_FINANCIAL_DATE','INVALID_PAYMENT_METHOD','APPOINTMENT_NOT_FINISHED','NO_BALANCE_TO_RECEIVE','INVALID_PAYABLE_DESCRIPTION','INVALID_PAYABLE_CATEGORY','INVALID_PAYABLE_AMOUNT','INVALID_PAYABLE_DUE_DATE','INVALID_PROMOTION_NAME','INVALID_PROMOTION_DATES','INVALID_PROMOTION_ITEMS','PROMOTION_SERVICE_NOT_FOUND','DUPLICATE_PROMOTION_SERVICE','INVALID_PROMOTION_PRICE'].includes(code) ? 400 : ['APPOINTMENT_NOT_FOUND','SERVICE_NOT_FOUND','BLOCK_NOT_FOUND','CUSTOMER_NOT_FOUND','FINANCIAL_ENTRY_NOT_FOUND','PAYABLE_NOT_FOUND','PROMOTION_NOT_FOUND'].includes(code) ? 404 : ['CUSTOMER_PHONE_ALREADY_EXISTS','FINANCIAL_ENTRY_PROTECTED','PAID_PAYABLE_PROTECTED','PROMOTION_SERVICE_DATE_CONFLICT','SERVICE_IN_USE'].includes(code) ? 409 : 500)
  return { status, payload: { error: code, message: messages[code] ?? (status >= 500 ? 'Ocorreu um erro interno. Tente novamente.' : 'Não foi possível concluir a operação.') } }
}

async function verifyTurnstile(token, secret, remoteIp) {
  if (!secret) {
    if (isProduction) throw new Error('TURNSTILE_NOT_CONFIGURED')
    return true
  }
  if (typeof token !== 'string' || !token.trim()) throw new Error('TURNSTILE_FAILED')
  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)
  let response
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new Error('TURNSTILE_FAILED')
  }
  if (!response.ok) throw new Error('TURNSTILE_FAILED')
  const result = await response.json()
  if (!result.success) throw new Error('TURNSTILE_FAILED')
  return true
}

async function handleApi(request, response, storage, serverEnv) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const pathname = url.pathname
  const method = request.method ?? 'GET'
  const remoteIp = request.socket.remoteAddress ?? 'unknown'

  const adminUsers = getConfiguredAdminUsers(serverEnv)
  const authSecret = String(serverEnv.AUTH_SECRET ?? '')
  const sessionToken = getCookie(request, COOKIE_NAME)
  const session = sessionManager.verify(sessionToken, authSecret, adminUsers)
  const requireAdmin = () => {
    if (!session || !adminUsers.length || !authSecret) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  }

  if (method === 'GET' && pathname === '/api/health') {
    if (isProduction) {
      try {
        if (typeof storage.pool?.query !== 'function') throw new Error('Database health probe unavailable')
        await storage.pool.query('SELECT 1')
        return sendJson(response, 200, { ok: true })
      } catch {
        return sendJson(response, 503, { ok: false })
      }
    }
    return sendJson(response, 200, { ok: true, storageMode: storage.mode, persistentOnThisComputer: storage.mode === 'local-json', published: false })
  }

  if (method === 'GET' && pathname === '/api/public/services') {
    return sendJson(response, 200, { services: await storage.getPublicServices() })
  }
  if (method === 'GET' && pathname === '/api/public/promotions') {
    const date = url.searchParams.get('date') ?? ''
    return sendJson(response, 200, { promotions: await storage.getPublicPromotions(date) })
  }
  if (method === 'GET' && pathname === '/api/public/policies') {
    return sendJson(response, 200, { policies: await storage.getPolicies() })
  }
  if (method === 'GET' && pathname === '/api/public/slots') {
    const serviceIds = (url.searchParams.get('serviceIds') ?? '').split(',').filter(Boolean)
    const serviceId = url.searchParams.get('serviceId') ?? ''
    const date = url.searchParams.get('date') ?? ''
    if ((!serviceId && !serviceIds.length) || !date) return sendJson(response, 400, { error: 'INVALID_AVAILABILITY_QUERY', message: 'Informe procedimentos e data.' })
    return sendJson(response, 200, { slots: await storage.getAvailableSlots(serviceIds.length ? serviceIds : serviceId, date) })
  }

  if (method === 'POST' && pathname === '/api/admin/login') {
    if (!sameOrigin(request, { production: isProduction })) return sendJson(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
    const limit = rateLimit(loginAttempts, remoteIp, { max: 8, windowMs: 15 * 60_000 })
    if (!limit.allowed) return sendJson(response, 429, { error: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { 'Retry-After': String(limit.retryAfter) })
    if (!adminUsers.length || !authSecret) return sendJson(response, 503, { error: 'ADMIN_NOT_CONFIGURED', message: 'Os acessos iniciais ainda não foram configurados. Execute npm run admin:setup no terminal do projeto.' })
    const body = await readJson(request)
    const submittedId = String(body.id ?? '').trim().toUpperCase()
    const submittedPassword = String(body.password ?? '')
    const user = adminUsers.find((candidate) => candidate.id === submittedId)
    const passwordMatches = verifyPassword(submittedPassword, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
    if (!user || !passwordMatches) return sendJson(response, 401, { error: 'INVALID_CREDENTIALS', message: 'ID ou senha inválidos.' })
    loginAttempts.delete(remoteIp)
    const safeUser = { id: user.id, displayName: user.displayName, role: user.role }
    return sendJson(response, 200, { authenticated: true, loginId: user.id, displayName: user.displayName, role: user.role }, { 'Set-Cookie': cookieHeader(sessionManager.create(safeUser, authSecret)) })
  }

  if (method === 'GET' && pathname === '/api/admin/session') {
    return sendJson(response, 200, {
      authenticated: Boolean(session),
      loginId: session?.sub ?? null,
      displayName: session?.displayName ?? null,
      role: session?.role ?? null,
    })
  }

  if (method === 'POST' && pathname === '/api/admin/logout') {
    if (!sameOrigin(request, { production: isProduction })) return sendJson(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
    if (session && sessionToken) sessionManager.revoke(sessionToken, session.exp * 1000)
    return sendJson(response, 200, { success: true }, { 'Set-Cookie': cookieHeader('', true) })
  }

  if (pathname.startsWith('/api/admin/')) {
    if (method !== 'GET' && !sameOrigin(request, { production: isProduction })) return sendJson(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
    requireAdmin()

    if (method === 'GET' && pathname === '/api/admin/data') {
      return sendJson(response, 200, await storage.getAdminData())
    }

    if (method === 'POST' && pathname === '/api/admin/promotions') {
      const body = await readJson(request)
      return sendJson(response, 201, { promotion: await storage.createPromotion(body) })
    }

    const promotionMatch = pathname.match(/^\/api\/admin\/promotions\/([^/]+)$/)
    if (method === 'PATCH' && promotionMatch) {
      const body = await readJson(request)
      return sendJson(response, 200, { promotion: await storage.updatePromotion(decodeURIComponent(promotionMatch[1]), body) })
    }

    if (method === 'POST' && pathname === '/api/admin/customers/import') {
      const body = await readJson(request, 2_000_000)
      const result = await storage.importCustomers(body.contacts)
      return sendJson(response, 200, result)
    }

    if (method === 'POST' && pathname === '/api/admin/customers') {
      const body = await readJson(request)
      const customer = await storage.createCustomer(body)
      return sendJson(response, 201, { customer })
    }

    if (method === 'POST' && pathname === '/api/admin/finance/entries') {
      const body = await readJson(request)
      const entry = await storage.createFinancialEntry(body)
      return sendJson(response, 201, { entry })
    }

    let financeMatch = pathname.match(/^\/api\/admin\/finance\/appointments\/([^/]+)\/receive-balance$/)
    if (method === 'POST' && financeMatch) {
      const body = await readJson(request)
      return sendJson(response, 200, await storage.receiveAppointmentBalance(decodeURIComponent(financeMatch[1]), body.payment_method))
    }

    financeMatch = pathname.match(/^\/api\/admin\/finance\/entries\/([^/]+)$/)
    if (method === 'DELETE' && financeMatch) {
      return sendJson(response, 200, await storage.deleteFinancialEntry(decodeURIComponent(financeMatch[1])))
    }

    if (method === 'POST' && pathname === '/api/admin/finance/payables') {
      const body = await readJson(request)
      const payable = await storage.createPayable(body)
      return sendJson(response, 201, { payable })
    }

    financeMatch = pathname.match(/^\/api\/admin\/finance\/payables\/([^/]+)\/paid$/)
    if (method === 'POST' && financeMatch) {
      return sendJson(response, 200, await storage.markPayablePaid(decodeURIComponent(financeMatch[1])))
    }

    financeMatch = pathname.match(/^\/api\/admin\/finance\/payables\/([^/]+)$/)
    if (method === 'DELETE' && financeMatch) {
      return sendJson(response, 200, await storage.deletePayable(decodeURIComponent(financeMatch[1])))
    }

    let customerMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)$/)
    if (method === 'PATCH' && customerMatch) {
      const body = await readJson(request)
      const customer = await storage.updateCustomer(decodeURIComponent(customerMatch[1]), body)
      return sendJson(response, 200, { customer })
    }

    if (method === 'POST' && pathname === '/api/admin/appointments') {
      const body = await readJson(request)
      const booking = await storage.createBooking(body, { adminCreated: true })
      return sendJson(response, 201, { booking })
    }

    let match = pathname.match(/^\/api\/admin\/appointments\/([^/]+)\/status$/)
    if (method === 'PATCH' && match) {
      const body = await readJson(request)
      const appointment = await storage.updateAppointmentStatus(decodeURIComponent(match[1]), String(body.status ?? ''))
      return sendJson(response, 200, { appointment })
    }

    if (method === 'POST' && pathname === '/api/admin/services') {
      const body = await readJson(request)
      return sendJson(response, 201, { service: await storage.createService(body) })
    }

    match = pathname.match(/^\/api\/admin\/services\/([^/]+)$/)
    if (method === 'DELETE' && match) {
      return sendJson(response, 200, await storage.deleteService(decodeURIComponent(match[1])))
    }
    if (method === 'PATCH' && match) {
      const body = await readJson(request)
      const service = await storage.updateService(decodeURIComponent(match[1]), body)
      return sendJson(response, 200, { service })
    }

    if (method === 'PUT' && pathname === '/api/admin/hours') {
      const body = await readJson(request)
      return sendJson(response, 200, { hours: await storage.saveHours(body.hours) })
    }

    if (method === 'PUT' && pathname === '/api/admin/policies') {
      const body = await readJson(request)
      return sendJson(response, 200, { policies: await storage.savePolicies(body) })
    }

    if (method === 'POST' && pathname === '/api/admin/blocks') {
      const body = await readJson(request)
      return sendJson(response, 201, { block: await storage.createBlock(body) })
    }

    match = pathname.match(/^\/api\/admin\/blocks\/([^/]+)$/)
    if (method === 'DELETE' && match) {
      return sendJson(response, 200, await storage.removeBlock(decodeURIComponent(match[1])))
    }
  }

  if (method === 'POST' && pathname === '/api/public/bookings') {
    const limit = rateLimit(bookingAttempts, remoteIp, { max: 10, windowMs: 10 * 60_000 })
    if (!limit.allowed) return sendJson(response, 429, { error: 'TOO_MANY_ATTEMPTS', message: 'Muitas solicitações em pouco tempo. Aguarde antes de tentar novamente.' }, { 'Retry-After': String(limit.retryAfter) })
    const body = await readJson(request)
    if (serverEnv.TURNSTILE_SECRET_KEY || isProduction) await verifyTurnstile(body.captchaToken, serverEnv.TURNSTILE_SECRET_KEY, remoteIp)
    const booking = await storage.createBooking(body)
    return sendJson(response, 201, { booking })
  }

  const paymentReportMatch = pathname.match(/^\/api\/public\/bookings\/([^/]+)\/deposit-reported$/)
  if (method === 'POST' && paymentReportMatch) {
    if (!sameOrigin(request, { production: isProduction })) return sendJson(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não autorizada.' })
    const limit = rateLimit(paymentReportAttempts, remoteIp, { max: 5, windowMs: 15 * 60_000 })
    if (!limit.allowed) return sendJson(response, 429, { error: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas de informar pagamento. Aguarde e tente novamente.' }, { 'Retry-After': String(limit.retryAfter) })
    const body = await readJson(request)
    const result = await storage.reportDepositPayment(decodeURIComponent(paymentReportMatch[1]), body.customerPhone)
    return sendJson(response, 200, result)
  }

  return sendJson(response, 404, { error: 'NOT_FOUND', message: 'Rota não encontrada.' })
}

async function serveStatic(request, response) {
  const distPath = path.join(root, 'dist')
  let rawPath
  try {
    rawPath = decodeURIComponent(new URL(request.url ?? '/', 'http://' + (request.headers.host ?? 'localhost')).pathname)
  } catch {
    sendText(response, 400, 'Caminho de URL inválido.')
    return
  }

  const isAssetRequest = rawPath === '/favicon.svg' || rawPath === '/assets' || rawPath.startsWith('/assets/')
  const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '')
  const resolved = path.resolve(distPath, relative)
  let target = resolved.startsWith(distPath + path.sep) || resolved === path.join(distPath, 'index.html')
    ? resolved
    : path.join(distPath, 'index.html')

  try {
    const info = await stat(target)
    if (!info.isFile()) {
      if (isAssetRequest) return sendText(response, 404, 'Arquivo não encontrado.')
      target = path.join(distPath, 'index.html')
    }
  } catch {
    if (isAssetRequest) return sendText(response, 404, 'Arquivo não encontrado.')
    target = path.join(distPath, 'index.html')
  }

  try {
    let contents = await readFile(target)
    const ext = path.extname(target).toLowerCase()
    const relativeTarget = path.relative(distPath, target).split(path.sep).join('/')

    // Serve a noindex version of the shared SPA shell to /admin before JavaScript runs.
    if (ext === '.html' && /^\/admin(?:\/|$)/.test(rawPath)) {
      const adminTitle = 'Acesso administrativo | Ana Amaral Lash Designer'
      const adminDescription = 'Área administrativa restrita da agenda de Ana Amaral Lash Designer'
      let html = contents.toString('utf8')
      html = html.replace(/<title>[^<]*<\/title>/i, '<title>' + adminTitle + '</title>')
      html = html.replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, '<meta name="robots" content="noindex, nofollow" />')
      html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/i, '<meta name="description" content="' + adminDescription + '" />')
      html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, '<meta property="og:title" content="' + adminTitle + '" />')
      html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, '<meta property="og:description" content="' + adminDescription + '" />')
      html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, '<meta name="twitter:title" content="' + adminTitle + '" />')
      html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, '<meta name="twitter:description" content="' + adminDescription + '" />')
      contents = Buffer.from(html)
    }

    let cacheControl = 'no-cache'
    if (relativeTarget.startsWith('assets/branding/')) cacheControl = 'public, max-age=3600'
    else if (relativeTarget.startsWith('assets/')) cacheControl = 'public, max-age=31536000, immutable'

    response.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': cacheControl })
    response.end(request.method === 'HEAD' ? undefined : contents)
  } catch {
    sendText(response, 500, 'Build não encontrado. Execute npm run build antes de iniciar em produção.')
  }
}


async function main() {
  const port = Number(env.PORT || 5173)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  if (isProduction) {
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must be configured with at least 32 characters in production.')
    if (!getConfiguredAdminUsers(env).length) throw new Error('Configure at least one account with npm run admin:setup before production.')
    if (!env.TURNSTILE_SECRET_KEY || !env.VITE_TURNSTILE_SITE_KEY) throw new Error('Configure both TURNSTILE_SECRET_KEY and VITE_TURNSTILE_SITE_KEY before production.')
  }

  const storage = await createStorage(env, root)
  let vite = null
  const apiOnly = !isProduction && env.P18_API_ONLY === '1'
  if (!isProduction && !apiOnly) {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({ configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'spa' })
  }

  const server = createServer(async (request, response) => {
    applySecurityHeaders(response, { production: isProduction })
    const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname
    if (pathname.startsWith('/api/')) {
      try {
        await handleApi(request, response, storage, env)
      } catch (error) {
        if (response.headersSent) return response.end()
        const mapped = errorResponse(error)
        sendJson(response, mapped.status, mapped.payload)
      }
      return
    }

    if (isProduction) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return sendText(response, 405, 'Método não permitido.')
      return serveStatic(request, response)
    }

    if (apiOnly) return sendText(response, 404, 'Modo de teste da API: consulte as rotas /api/*.')

    vite.middlewares(request, response, (error) => {
      if (error) {
        console.error(error)
        if (!response.headersSent) sendText(response, 500, 'Erro no servidor de desenvolvimento.')
      }
    })
  })

  // API requests are small; bound slow header/body connections in production and development.
  server.headersTimeout = 15_000
  server.requestTimeout = 30_000
  server.keepAliveTimeout = 5_000

  server.listen(port, env.HOST || '0.0.0.0', () => {
    console.log(`\nP18 Sistema Ana iniciado em ${isProduction ? 'modo produção' : 'modo desenvolvimento'}.`)
    console.log(`Armazenamento: ${storage.mode === 'mysql' ? 'MySQL' : 'JSON local (somente este computador)'}`)
    console.log(`URL: http://localhost:${port}/`)
    if (storage.mode === 'local-json') console.log('Dados locais: data/local-db.json')
    if (!getConfiguredAdminUsers(env).length) console.log('Acessos administrativos ainda não configurados. Execute: npm run admin:setup')
    if (!env.TURNSTILE_SECRET_KEY && storage.mode === 'local-json') console.log('Turnstile ficará opcional no ambiente local; ele será obrigatório em produção.')
  })

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true

    // Stop accepting new connections first, then close Vite's dev middleware/HMR
    // so active development sockets cannot keep the HTTP server shutdown waiting.
    const serverClosed = new Promise((resolve) => {
      server.close((error) => resolve(error ?? null))
    })
    let shutdownError = null
    try {
      if (vite) await vite.close()
    } catch (error) {
      shutdownError = error
    }

    const serverCloseError = await serverClosed
    try {
      if (storage.pool?.end) await storage.pool.end()
    } catch (error) {
      shutdownError ??= error
    }

    const finalError = shutdownError ?? serverCloseError
    if (finalError) {
      console.error('Falha durante o encerramento do P18:', finalError?.message ?? finalError)
      process.exitCode = 1
    }
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('\nFalha ao iniciar P18:', error.message)
  process.exit(1)
})
