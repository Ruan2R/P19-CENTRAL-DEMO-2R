import { normalizeBrazilPhone } from '../../server/domain.mjs'

const ARRAY_KEYS = [
  'services', 'business_hours', 'date_blocks', 'appointments',
  'customers', 'promotions', 'financial_entries', 'payables',
]
const FINANCIAL_SOURCE_TYPES = new Set(['manual', 'appointment_deposit', 'appointment_balance', 'payable_payment'])
const APPOINTMENT_STATUSES = new Set(['pending_confirmation', 'awaiting_deposit', 'confirmed', 'completed', 'cancelled', 'no_show'])

function fail(message) {
  throw new Error(`LOCAL_JSON_INVALID: ${message}`)
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`o campo "${label}" precisa ser uma lista.`)
  return value
}

function requireText(value, label, max = 255) {
  const text = String(value ?? '').trim()
  if (!text || text.length > max) fail(`"${label}" está vazio ou excede ${max} caracteres.`)
  return text
}

function requireId(value, label) {
  const id = requireText(value, label, 36)
  if (!/^[0-9a-f-]{16,36}$/i.test(id)) fail(`"${label}" não parece um ID válido: ${id}.`)
  return id
}

function requireDate(value, label) {
  const date = String(value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`"${label}" precisa estar no formato AAAA-MM-DD.`)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail(`"${label}" precisa ser uma data real no formato AAAA-MM-DD.`)
  }
  return date
}

function requireAmount(value, label, allowZero = false) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || (allowZero ? amount < 0 : amount <= 0)) fail(`"${label}" precisa ser um valor em centavos válido.`)
  return amount
}

function ensureUnique(items, keyFn, label) {
  const seen = new Set()
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) fail(`há valores duplicados em ${label}: ${key}.`)
    seen.add(key)
  }
}

export function normalizeLocalDataset(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema_version !== 1) {
    fail('a versão do banco local não é compatível (schema_version deve ser 1).')
  }

  const data = { ...raw }
  for (const key of ARRAY_KEYS) {
    if (key === 'services' || key === 'business_hours' || key === 'appointments' || key === 'customers') {
      requireArray(data[key], key)
    } else {
      data[key] = Array.isArray(data[key]) ? data[key] : []
    }
  }
  if (!data.business_policies || typeof data.business_policies !== 'object') {
    fail('"business_policies" não foi encontrado; abra o sistema local uma vez para concluir atualizações de dados e tente novamente.')
  }
  return data
}

export function validateLocalDataset(raw) {
  const data = normalizeLocalDataset(raw)
  const { services, business_hours, date_blocks, appointments, customers, promotions, financial_entries, payables } = data

  if (services.length === 0) fail('nenhum serviço encontrado.')
  ensureUnique(services, (x) => requireId(x.id, 'services.id'), 'IDs dos serviços')
  ensureUnique(services, (x) => requireText(x.slug, 'services.slug', 100), 'slugs dos serviços')
  const serviceIds = new Set(services.map((x) => String(x.id)))
  for (const [index, service] of services.entries()) {
    requireText(service.name, `services[${index}].name`, 120)
    requireText(service.slug, `services[${index}].slug`, 100)
    requireAmount(service.price_cents, `services[${index}].price_cents`, true)
    const duration = Number(service.duration_minutes)
    if (!Number.isInteger(duration) || duration < 15 || duration > 600) fail(`duração inválida no serviço "${service.name}".`)
    const depositPercent = Number(service.deposit_percent ?? 30)
    if (!Number.isInteger(depositPercent) || depositPercent < 0 || depositPercent > 100) fail(`percentual de sinal inválido no serviço "${service.name}".`)
  }

  ensureUnique(business_hours, (x) => String(x.weekday), 'dias de funcionamento')
  if (business_hours.length !== 7 || business_hours.some((x) => !Number.isInteger(Number(x.weekday)) || Number(x.weekday) < 0 || Number(x.weekday) > 6)) {
    fail('business_hours deve conter os sete dias da semana, de 0 a 6.')
  }

  ensureUnique(customers, (x) => requireId(x.id, 'customers.id'), 'IDs dos clientes')
  const normalizedPhones = customers.map((customer) => normalizeBrazilPhone(customer.phone))
  ensureUnique(normalizedPhones, (x) => x, 'telefones dos clientes')
  for (const [index, customer] of customers.entries()) {
    requireText(customer.name, `customers[${index}].name`, 100)
    const phone = normalizedPhones[index]
    if (!/^\d{10,11}$/.test(phone)) fail(`telefone inválido no cadastro de cliente "${customer.name}".`)
  }

  ensureUnique(date_blocks, (x) => requireId(x.id, 'date_blocks.id'), 'IDs dos bloqueios')
  for (const [index, block] of date_blocks.entries()) requireDate(block.blocked_date, `date_blocks[${index}].blocked_date`)

  ensureUnique(promotions, (x) => requireId(x.id, 'promotions.id'), 'IDs das promoções')
  const promotionIds = new Set(promotions.map((x) => String(x.id)))
  for (const [index, promotion] of promotions.entries()) {
    const start = requireDate(promotion.starts_on, `promotions[${index}].starts_on`)
    const end = requireDate(promotion.ends_on, `promotions[${index}].ends_on`)
    requireText(promotion.name, `promotions[${index}].name`, 100)
    if (end < start) fail(`a promoção "${promotion.name}" termina antes de começar.`)
    const items = requireArray(promotion.items, `promotions[${index}].items`)
    ensureUnique(items, (item) => String(item.service_id), `serviços da promoção "${promotion.name}"`)
    if (items.length === 0) fail(`a promoção "${promotion.name}" não contém serviços.`)
    for (const item of items) {
      if (!serviceIds.has(String(item.service_id))) fail(`a promoção "${promotion.name}" aponta para um serviço que não existe.`)
      requireAmount(item.promotional_price_cents, `preço promocional de ${promotion.name}`)
    }
  }

  for (let leftIndex = 0; leftIndex < promotions.length; leftIndex += 1) {
    const left = promotions[leftIndex]
    if (!left.active) continue
    const leftServices = new Set(left.items.map((item) => String(item.service_id)))
    for (let rightIndex = leftIndex + 1; rightIndex < promotions.length; rightIndex += 1) {
      const right = promotions[rightIndex]
      if (!right.active || String(left.ends_on) < String(right.starts_on) || String(right.ends_on) < String(left.starts_on)) continue
      if (right.items.some((item) => leftServices.has(String(item.service_id)))) {
        fail(`as promoções ativas \"${left.name}\" e \"${right.name}\" se sobrepõem para o mesmo serviço.`)
      }
    }
  }

  ensureUnique(appointments, (x) => requireId(x.id, 'appointments.id'), 'IDs dos agendamentos')
  ensureUnique(appointments, (x) => {
    const code = requireText(x.public_code, 'appointments.public_code', 8).toUpperCase()
    if (code.length !== 8) fail(`o código público do agendamento precisa ter 8 caracteres: ${code}.`)
    return code
  }, 'códigos públicos dos agendamentos')
  const appointmentIds = new Set(appointments.map((x) => String(x.id)))
  for (const [index, appointment] of appointments.entries()) {
    requireText(appointment.customer_name, `appointments[${index}].customer_name`, 100)
    const phone = normalizeBrazilPhone(appointment.customer_phone)
    if (!/^\d{10,11}$/.test(phone)) fail(`telefone inválido no agendamento ${appointment.public_code}.`)
    if (!serviceIds.has(String(appointment.service_id))) fail(`o agendamento ${appointment.public_code} aponta para um serviço que não existe.`)
    if (appointment.promotion_id && !promotionIds.has(String(appointment.promotion_id))) fail(`o agendamento ${appointment.public_code} aponta para uma promoção que não existe no arquivo local.`)
    if (!APPOINTMENT_STATUSES.has(appointment.status)) fail(`status inválido no agendamento ${appointment.public_code}.`)
    const starts = new Date(appointment.starts_at)
    const ends = new Date(appointment.ends_at)
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) fail(`datas inválidas no agendamento ${appointment.public_code}.`)
    requireAmount(appointment.price_cents, `valor do agendamento ${appointment.public_code}`, true)
    requireAmount(appointment.deposit_cents ?? 0, `sinal do agendamento ${appointment.public_code}`, true)
  }

  ensureUnique(financial_entries, (x) => requireId(x.id, 'financial_entries.id'), 'IDs das movimentações financeiras')
  const financialIds = new Set(financial_entries.map((x) => String(x.id)))
  const sourceKeys = new Set()
  for (const [index, entry] of financial_entries.entries()) {
    if (!['income', 'expense'].includes(entry.direction)) fail(`direção inválida na movimentação ${entry.id}.`)
    const sourceType = entry.source_type ?? 'manual'
    if (!FINANCIAL_SOURCE_TYPES.has(sourceType)) fail(`origem financeira desconhecida na movimentação ${entry.id}.`)
    requireAmount(entry.amount_cents, `financial_entries[${index}].amount_cents`)
    requireDate(entry.movement_date, `financial_entries[${index}].movement_date`)
    if (entry.related_appointment_id && !appointmentIds.has(String(entry.related_appointment_id))) fail(`a movimentação ${entry.id} aponta para um agendamento inexistente.`)
    if (entry.source_id != null) {
      const sourceKey = `${sourceType}:${entry.source_id}`
      if (sourceKeys.has(sourceKey)) fail(`há duas movimentações com a mesma origem ${sourceKey}; verifique duplicações antes de migrar.`)
      sourceKeys.add(sourceKey)
      if (['appointment_deposit', 'appointment_balance'].includes(sourceType) && !appointmentIds.has(String(entry.source_id))) fail(`a movimentação ${entry.id} aponta para um agendamento inexistente.`)
    }
  }

  ensureUnique(payables, (x) => requireId(x.id, 'payables.id'), 'IDs das contas a pagar')
  const payableIds = new Set(payables.map((x) => String(x.id)))
  for (const [index, payable] of payables.entries()) {
    requireText(payable.description, `payables[${index}].description`, 120)
    requireText(payable.category, `payables[${index}].category`, 80)
    requireAmount(payable.amount_cents, `payables[${index}].amount_cents`)
    requireDate(payable.due_date, `payables[${index}].due_date`)
    if (!['pending', 'paid'].includes(payable.status ?? 'pending')) fail(`status inválido na conta a pagar ${payable.id}.`)
    if (payable.expense_entry_id && !financialIds.has(String(payable.expense_entry_id))) fail(`a conta a pagar ${payable.id} aponta para uma movimentação inexistente.`)
  }
  ensureUnique(payables.filter((payable) => payable.expense_entry_id), (payable) => String(payable.expense_entry_id), 'vínculos de despesa das contas a pagar')
  for (const payable of payables) {
    const status = payable.status ?? 'pending'
    const paymentEntry = financial_entries.find((entry) => (entry.source_type ?? 'manual') === 'payable_payment' && String(entry.source_id ?? '') === String(payable.id))
    if (status === 'paid' && !payable.expense_entry_id) fail(`a conta a pagar ${payable.id} está marcada como paga, mas não referencia a movimentação de despesa.`)
    if (payable.expense_entry_id) {
      const linked = financial_entries.find((entry) => String(entry.id) === String(payable.expense_entry_id))
      if (!linked || (linked.source_type ?? 'manual') !== 'payable_payment' || String(linked.source_id ?? '') !== String(payable.id)) {
        fail(`o vínculo de despesa da conta a pagar ${payable.id} não corresponde à movimentação de pagamento.`)
      }
    }
    if (status === 'pending' && paymentEntry) fail(`a conta a pagar ${payable.id} está pendente, mas já tem uma movimentação de pagamento vinculada.`)
  }

  for (const entry of financial_entries) {
    const sourceType = entry.source_type ?? 'manual'
    if (sourceType === 'payable_payment' && (!entry.source_id || !payableIds.has(String(entry.source_id)))) fail(`a movimentação ${entry.id} aponta para uma conta a pagar inexistente.`)
  }

  const policy = data.business_policies
  for (const key of ['lateness_tolerance_minutes', 'cancellation_notice_hours', 'companion_policy', 'no_show_policy']) {
    if (policy[key] == null) fail(`a política "${key}" está ausente.`)
  }

  return {
    data,
    counts: {
      services: services.length,
      business_hours: business_hours.length,
      business_policies: 1,
      date_blocks: date_blocks.length,
      customers: customers.length,
      promotions: promotions.length,
      promotion_items: promotions.reduce((sum, promotion) => sum + promotion.items.length, 0),
      appointments: appointments.length,
      financial_entries: financial_entries.length,
      payables: payables.length,
    },
  }
}

export function toMysqlUtcDateTime(value, fallback = null) {
  if (value == null || value === '') {
    if (fallback == null) return null
    return toMysqlUtcDateTime(fallback)
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) fail(`timestamp inválido: ${value}.`)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function toMysqlDate(value, label = 'data') {
  return requireDate(value, label)
}

export function toMysqlTime(value, label = 'horário') {
  if (value == null || value === '') return null
  const time = String(value).trim()
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) fail(`"${label}" precisa estar no formato HH:MM ou HH:MM:SS.`)
  const hour = Number(match[1]), minute = Number(match[2]), second = Number(match[3] ?? 0)
  if (hour > 23 || minute > 59 || second > 59) fail(`"${label}" não é um horário válido.`)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}
