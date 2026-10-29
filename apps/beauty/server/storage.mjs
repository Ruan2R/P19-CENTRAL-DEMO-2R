import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import {
  APPOINTMENT_STATUSES, addDateDays, buildAppointment,
  buildAvailableSlots, getStudioDate, getWeekday, localDateTimeToUtc,
  mysqlDateTimeToIso, mysqlUtcDateTime, normalizeBrazilPhone, normalizeCustomerName, validateBlock, validateBookingInput, validateBusinessHours, validateCustomerProfileInput, validatePolicies, validateServiceUpdate, validatePromotionInput, findPromotionPrice, validateFinancialEntryInput, validatePayableInput, validatePaymentMethod, isAppointmentBalanceEligible,
} from './domain.mjs'

const DEFAULT_SERVICES = [
  ['brow-lamination', 'Brow lamination', 'Sobrancelhas', 'Alinhamento e definição dos fios das sobrancelhas.', 60, 12000, 10],
  ['design-sobrancelhas', 'Design de sobrancelhas', 'Sobrancelhas', 'Design pensado para valorizar o olhar.', 40, 4000, 20],
  ['tintura-sobrancelhas', 'Tintura de sobrancelhas', 'Sobrancelhas', 'Tintura para realçar e definir as sobrancelhas.', 20, 2000, 30],
  ['lash-lifting', 'Lash lifting', 'Cílios', 'Curvatura e realce dos cílios naturais.', 90, 15000, 40],
  ['maquiagem-social', 'Maquiagem social', 'Maquiagem', 'Maquiagem social personalizada para a sua ocasião.', 40, 16000, 50],
]

const DEFAULT_POLICIES = {
  singleton: true,
  lateness_tolerance_minutes: 0,
  cancellation_notice_hours: 0,
  companion_policy: 'Política de acompanhantes pendente de confirmação pela Ana.',
  no_show_policy: 'Política de faltas, cancelamentos e sinal pendente de confirmação pela Ana.',
  show_lateness_policy: false,
  show_cancellation_policy: false,
  show_companion_policy: false,
  show_no_show_policy: false,
  updated_at: new Date().toISOString(),
}

function normalizePolicyFlags(policies = {}) {
  return {
    ...DEFAULT_POLICIES,
    ...policies,
    singleton: true,
    show_lateness_policy: Boolean(policies.show_lateness_policy ?? false),
    show_cancellation_policy: Boolean(policies.show_cancellation_policy ?? false),
    show_companion_policy: Boolean(policies.show_companion_policy ?? false),
    show_no_show_policy: Boolean(policies.show_no_show_policy ?? false),
  }
}

function hasPublicGuidelines(policies = {}) {
  return Boolean(policies.show_lateness_policy || policies.show_cancellation_policy || policies.show_companion_policy || policies.show_no_show_policy)
}

function defaultHours() {
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: false, start_time: null, end_time: null, break_start: null, break_end: null }))
}

function isUntouchedDemoCatalog(data) {
  const services = Array.isArray(data.services) ? data.services : []
  if (services.length !== DEFAULT_SERVICES.length) return false

  for (const key of ['appointments', 'customers', 'promotions', 'financial_entries', 'payables', 'date_blocks']) {
    if (!Array.isArray(data[key]) || data[key].length > 0) return false
  }

  const hours = Array.isArray(data.business_hours) ? data.business_hours : []
  if (hours.length !== 7 || hours.some((hour) => hour.enabled || hour.start_time || hour.end_time || hour.break_start || hour.break_end)) return false

  const expectedBySlug = new Map(DEFAULT_SERVICES.map(([slug, name, category, _description, duration, price, order]) => [slug, { name, category, duration, price, order }]))
  return services.every((service) => {
    const expected = expectedBySlug.get(service.slug)
    return Boolean(expected)
      && service.name === expected.name
      && service.category === expected.category
      && Number(service.duration_minutes) === expected.duration
      && Number(service.price_cents) === expected.price
      && Number(service.sort_order) === expected.order
      && service.active === true
      && Number(service.deposit_percent ?? 0) === 0
  })
}

function initialLocalData({ includeDemoServices = false } = {}) {
  const now = new Date().toISOString()
  return {
    schema_version: 1,
    services: includeDemoServices ? DEFAULT_SERVICES.map(([slug, name, category, description, duration_minutes, price_cents, sort_order]) => ({
      id: randomUUID(), slug, name, category, description, duration_minutes, price_cents,
      deposit_percent: 0, active: true, sort_order, created_at: now, updated_at: now,
    })) : [],
    business_hours: defaultHours(),
    business_policies: structuredClone(DEFAULT_POLICIES),
    date_blocks: [],
    appointments: [],
    customers: [],
    promotions: [],
    financial_entries: [],
    payables: [],
  }
}

function prepareNewService(input) {
  const name = String(input.name ?? '').trim()
  const category = String(input.category ?? '').trim().slice(0, 100)
  const description = String(input.description ?? '').trim().slice(0, 1000)
  if (category.length < 2) throw new Error('INVALID_SERVICE_CATEGORY')
  const service = {
    name, category, description,
    duration_minutes: Number(input.duration_minutes),
    price_cents: Number(input.price_cents),
    deposit_percent: Number(input.deposit_percent ?? 0),
    active: input.active !== false,
  }
  validateServiceUpdate(service)
  return service
}

function slugifyServiceName(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'servico'
}

function uniqueServiceSlug(name, existing) {
  const base = slugifyServiceName(name)
  const used = new Set(existing.map((service) => service.slug))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function combineSelectedServices(selectedServices, promotions, date) {
  const serviceItems = selectedServices.map((service) => {
    const promotion = findPromotionPrice(promotions ?? [], service, date)
    return {
      service_id: service.id, name: service.name, category: service.category,
      duration_minutes: Number(service.duration_minutes),
      regular_price_cents: Number(service.price_cents),
      price_cents: Number(promotion?.promotional_price_cents ?? service.price_cents),
      deposit_percent: Number(service.deposit_percent ?? 0),
      promotion_id: promotion?.promotion_id ?? null, promotion_name: promotion?.promotion_name ?? null,
    }
  })
  const total = serviceItems.reduce((sum, item) => sum + item.price_cents, 0)
  const regularTotal = serviceItems.reduce((sum, item) => sum + item.regular_price_cents, 0)
  const deposit = serviceItems.reduce((sum, item) => sum + Math.round(item.price_cents * item.deposit_percent / 100), 0)
  const first = selectedServices[0]
  const service = {
    ...first, active: true,
    name: serviceItems.map((item) => item.name).join(' + '),
    category: [...new Set(serviceItems.map((item) => item.category))].join(' · '),
    duration_minutes: serviceItems.reduce((sum, item) => sum + item.duration_minutes, 0),
    price_cents: total, deposit_percent: total > 0 ? deposit * 100 / total : 0,
  }
  const promotionNames = [...new Set(serviceItems.map((item) => item.promotion_name).filter(Boolean))]
  const promotionIds = [...new Set(serviceItems.map((item) => item.promotion_id).filter(Boolean))]
  return { service, serviceItems, total, regularTotal, deposit, promotionName: promotionNames.join(' + ') || null, promotionId: promotionIds.length === 1 ? promotionIds[0] : null }
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value))
}

function appointmentServiceItems(appointment) {
  let value = appointment.service_items ?? appointment.service_snapshot ?? []
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { value = [] } }
  return Array.isArray(value) ? value : []
}

function normalizeAppointment(appointment, service) {
  const serviceItems = appointmentServiceItems(appointment)
  const serviceSummary = serviceItems.length ? {
    name: serviceItems.map((item) => item.name).join(' + '),
    category: [...new Set(serviceItems.map((item) => item.category).filter(Boolean))].join(' · '),
    duration_minutes: serviceItems.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0),
  } : (service ? { name: service.name, category: service.category, duration_minutes: service.duration_minutes } : appointment.service)
  return {
    ...appointment,
    customer_name: normalizeCustomerName(appointment.customer_name),
    price_cents: Number(appointment.price_cents),
    regular_price_cents: appointment.regular_price_cents == null ? Number(appointment.price_cents) : Number(appointment.regular_price_cents),
    promotion_id: appointment.promotion_id ?? null,
    promotion_name: appointment.promotion_name ?? null,
    starts_at: mysqlDateTimeToIso(appointment.starts_at) ?? appointment.starts_at,
    ends_at: mysqlDateTimeToIso(appointment.ends_at) ?? appointment.ends_at,
    created_at: mysqlDateTimeToIso(appointment.created_at) ?? appointment.created_at,
    updated_at: mysqlDateTimeToIso(appointment.updated_at) ?? appointment.updated_at,
    policy_acknowledged_at: mysqlDateTimeToIso(appointment.policy_acknowledged_at) ?? appointment.policy_acknowledged_at,
    deposit_required: Boolean(appointment.deposit_required),
    deposit_received: Boolean(appointment.deposit_received),
    deposit_reported: Boolean(appointment.deposit_reported),
    service_items: serviceItems,
    service: serviceSummary,
  }
}

function publicBookingResult(appointment) {
  return {
    public_code: appointment.public_code,
    price_cents: appointment.price_cents,
    deposit_cents: appointment.deposit_cents,
    deposit_required: Boolean(appointment.deposit_required),
    status: appointment.status,
    starts_at: appointment.starts_at,
    regular_price_cents: Number(appointment.regular_price_cents ?? appointment.price_cents),
    promotion_name: appointment.promotion_name ?? null,
  }
}

function normalizePromotion(promotion, services = []) {
  const serviceById = new Map(services.map((service) => [String(service.id), service]))
  return {
    ...promotion,
    starts_on: String(promotion.starts_on ?? '').slice(0, 10),
    ends_on: String(promotion.ends_on ?? '').slice(0, 10),
    active: Boolean(promotion.active),
    created_at: mysqlDateTimeToIso(promotion.created_at) ?? promotion.created_at,
    updated_at: mysqlDateTimeToIso(promotion.updated_at) ?? promotion.updated_at,
    items: (promotion.items ?? []).map((item) => {
      const service = serviceById.get(String(item.service_id))
      return {
        service_id: String(item.service_id),
        promotional_price_cents: Number(item.promotional_price_cents),
        ...(service ? { service_name: service.name, regular_price_cents: Number(service.price_cents) } : {}),
      }
    }),
  }
}

function makePublicCode() {
  return randomBytes(5).toString('hex').slice(0, 8).toUpperCase()
}

function stripLegacyServiceDepositFlag(service) {
  const { deposit_required: _legacyDepositFlag, ...clean } = service
  return clean
}

function normalizeDateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10)
}

function normalizeFinancialEntry(entry) {
  return { ...entry, amount_cents: Number(entry.amount_cents), movement_date: normalizeDateOnly(entry.movement_date), source_type: entry.source_type ?? 'manual', source_id: entry.source_id ?? null, related_appointment_id: entry.related_appointment_id ?? null, payment_method: entry.payment_method ?? 'Não informado' }
}

function normalizePayable(payable) {
  return { ...payable, amount_cents: Number(payable.amount_cents), due_date: normalizeDateOnly(payable.due_date), status: payable.status ?? 'pending', paid_at: payable.paid_at ?? null, expense_entry_id: payable.expense_entry_id ?? null }
}

function makeFinancialEntry({ direction, description, category, amount_cents, movement_date, payment_method = 'Não informado', source_type = 'manual', source_id = null, related_appointment_id = null }) {
  return { id: randomUUID(), direction, description, category, amount_cents: Number(amount_cents), movement_date, payment_method, source_type, source_id, related_appointment_id, created_at: new Date().toISOString() }
}

function ensureDepositFinancialEntry(data, appointment) {
  if (!appointment.deposit_required || !appointment.deposit_received || Number(appointment.deposit_cents) <= 0) return
  data.financial_entries ??= []
  const exists = data.financial_entries.some((entry) => entry.source_type === 'appointment_deposit' && entry.source_id === appointment.id)
  if (exists) return
  const service = data.services.find((item) => item.id === appointment.service_id)
  data.financial_entries.push(makeFinancialEntry({
    direction: 'income', description: `Sinal recebido — ${appointment.customer_name}${service?.name ? ` · ${service.name}` : ''}`,
    category: 'Sinais de agendamento', amount_cents: appointment.deposit_cents, movement_date: getStudioDate(),
    payment_method: 'Pix', source_type: 'appointment_deposit', source_id: appointment.id, related_appointment_id: appointment.id,
  }))
}


function prepareContactImport(rawContacts) {
  if (!Array.isArray(rawContacts) || rawContacts.length < 1 || rawContacts.length > 5000) throw new Error('INVALID_CONTACT_IMPORT')
  const contacts = []
  let invalid = 0
  for (const raw of rawContacts) {
    const name = normalizeCustomerName(raw?.name)
    const nameLength = Array.from(name).length
    const rawPhone = String(raw?.phone ?? '').trim()
    const phone = normalizeBrazilPhone(rawPhone)
    if (nameLength < 2 || nameLength > 100 || (rawPhone && (phone.length < 10 || phone.length > 11))) {
      invalid += 1
      continue
    }
    contacts.push({ name, phone })
  }
  contacts.sort((a, b) => Number(Boolean(b.phone)) - Number(Boolean(a.phone)))
  return { contacts, invalid }
}

function customerNameKey(name) {
  return normalizeCustomerName(name).toLocaleLowerCase('pt-BR')
}

function customerSummary(customer, appointments) {
  const phone = normalizeBrazilPhone(customer.phone)
  const customerName = normalizeCustomerName(customer.name)
  const related = appointments.filter((appointment) => phone
    ? normalizeBrazilPhone(appointment.customer_phone) === phone
    : !normalizeBrazilPhone(appointment.customer_phone) && normalizeCustomerName(appointment.customer_name) === customerName)
  const ordered = related.slice().sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)))
  return {
    ...customer,
    phone,
    require_deposit: Boolean(customer.require_deposit),
    internal_note: String(customer.internal_note ?? ''),
    appointment_count: related.length,
    no_show_count: related.filter((appointment) => appointment.status === 'no_show').length,
    last_appointment_at: ordered[0]?.starts_at ?? null,
  }
}

function validateCustomerUpdateInput(input, current) {
  const name = normalizeCustomerName(input.name ?? current.name)
  const phone = normalizeBrazilPhone(current.phone)
  const internalNote = String(input.internal_note ?? current.internal_note ?? '').trim().slice(0, 500)
  if (name.length < 2 || name.length > 100) throw new Error('INVALID_CUSTOMER_NAME')
  return {
    name,
    phone,
    require_deposit: Boolean(input.require_deposit ?? current.require_deposit),
    internal_note: internalNote,
  }
}

class LocalJsonStore {
  constructor(filePath, { includeDemoServices = false } = {}) {
    this.filePath = filePath
    this.includeDemoServices = includeDemoServices
    this.data = null
    this.writeQueue = Promise.resolve()
    this.mode = 'local-json'
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      this.data = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!this.data || this.data.schema_version !== 1) throw new Error('Unsupported local data version')
      let migrated = false
      if (!Array.isArray(this.data.customers)) {
        this.data.customers = []
        const seenPhones = new Set()
        for (const appointment of this.data.appointments ?? []) {
          const phone = normalizeBrazilPhone(appointment.customer_phone)
          if (!phone || seenPhones.has(phone)) continue
          seenPhones.add(phone)
          this.data.customers.push({
            id: randomUUID(), name: normalizeCustomerName(String(appointment.customer_name ?? 'Cliente')).slice(0, 100), phone,
            require_deposit: false, internal_note: '', created_at: appointment.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
        migrated = true
      }
      if (!Array.isArray(this.data.financial_entries)) { this.data.financial_entries = []; migrated = true }
      if (!Array.isArray(this.data.payables)) { this.data.payables = []; migrated = true }
      if (!Array.isArray(this.data.promotions)) { this.data.promotions = []; migrated = true }
      for (const appointment of this.data.appointments ?? []) {
        if (!Object.prototype.hasOwnProperty.call(appointment, 'deposit_reported')) {
          appointment.deposit_reported = false
          migrated = true
        }
      }
      this.data.services = (this.data.services ?? []).map((service) => {
        if (!Object.prototype.hasOwnProperty.call(service, 'deposit_required')) return service
        migrated = true
        return stripLegacyServiceDepositFlag(service)
      })
      // This P18 was copied from P17. Remove only the untouched example catalog
      // from an empty local database; never remove user-edited services or history.
      if (!this.includeDemoServices && isUntouchedDemoCatalog(this.data)) {
        this.data.services = []
        migrated = true
      }
      if (migrated) await this.persist()
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      this.data = initialLocalData({ includeDemoServices: this.includeDemoServices })
      await this.persist()
    }
  }

  async persist() {
    const temporaryPath = `${this.filePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.filePath)
  }

  async mutate(callback) {
    const previous = this.writeQueue
    let release
    this.writeQueue = new Promise((resolve) => { release = resolve })
    await previous
    try {
      const result = await callback(this.data)
      await this.persist()
      return jsonSafe(result)
    } finally {
      release()
    }
  }

  async getPublicServices() {
    return jsonSafe(this.data.services.filter((service) => service.active).sort((a, b) => a.sort_order - b.sort_order).map(stripLegacyServiceDepositFlag))
  }

  async getPublicPromotions(date) {
    const prices = this.data.services.filter((service) => service.active)
      .map((service) => findPromotionPrice(this.data.promotions ?? [], service, date))
      .filter(Boolean)
    return jsonSafe(prices)
  }

  async getPolicies() {
    return jsonSafe(normalizePolicyFlags(this.data.business_policies))
  }

  async getAvailableSlots(serviceIdsInput, date) {
    const ids = Array.isArray(serviceIdsInput) ? serviceIdsInput : String(serviceIdsInput ?? '').split(',').filter(Boolean)
    const selected = ids.map((id) => this.data.services.find((item) => item.id === id && item.active)).filter(Boolean)
    if (!selected.length || selected.length !== ids.length) return []
    const combined = combineSelectedServices(selected, this.data.promotions ?? [], date)
    return buildAvailableSlots({ service: combined.service, hours: this.data.business_hours, blocks: this.data.date_blocks, appointments: this.data.appointments, date })
  }

  async createBooking(rawInput, { adminCreated = false } = {}) {
    return this.mutate((data) => {
      if (!data.business_policies) throw new Error('BUSINESS_POLICIES_UNAVAILABLE')
      const input = validateBookingInput(rawInput, { requirePolicyAcknowledgement: !adminCreated && hasPublicGuidelines(data.business_policies), allowMissingPhone: adminCreated && rawInput.allowMissingPhone === true })
      const selected = input.serviceIds.map((id) => data.services.find((item) => item.id === id && item.active))
      if (!selected.length || selected.some((item) => !item)) throw new Error('SERVICE_NOT_AVAILABLE')
      const available = buildAvailableSlots({ service: combineSelectedServices(selected, data.promotions ?? [], input.date).service, hours: data.business_hours, blocks: data.date_blocks, appointments: data.appointments, date: input.date })
      if (!available.includes(input.time)) throw new Error('SLOT_TAKEN')
      let customer = input.customerPhone
        ? data.customers.find((item) => normalizeBrazilPhone(item.phone) === input.customerPhone)
        : adminCreated && rawInput.allowMissingPhone === true
          ? data.customers.find((item) => !normalizeBrazilPhone(item.phone) && normalizeCustomerName(item.name) === input.customerName)
          : null
      if (!customer && (input.customerPhone || (adminCreated && rawInput.allowMissingPhone === true))) {
        customer = { id: randomUUID(), name: normalizeCustomerName(input.customerName), phone: input.customerPhone || '', require_deposit: false, internal_note: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        data.customers.push(customer)
      }
      const depositRequired = Boolean(customer?.require_deposit)
      const combined = combineSelectedServices(selected, data.promotions ?? [], input.date)
      if (depositRequired && combined.deposit <= 0) throw new Error('DEPOSIT_NOT_CONFIGURED')
      const appointment = buildAppointment({ input, service: combined.service, policies: data.business_policies, id: randomUUID(), publicCode: makePublicCode(), depositRequired })
      appointment.service_id = selected[0].id
      appointment.service_items = combined.serviceItems
      appointment.service = { name: combined.service.name, category: combined.service.category, duration_minutes: combined.service.duration_minutes }
      appointment.price_cents = combined.total
      appointment.regular_price_cents = combined.regularTotal
      appointment.deposit_cents = depositRequired ? combined.deposit : 0
      appointment.promotion_id = combined.promotionId
      appointment.promotion_name = combined.promotionName
      appointment.status = depositRequired ? 'awaiting_deposit' : 'pending_confirmation'
      if (adminCreated) { appointment.policy_acknowledged = false; appointment.policy_acknowledged_at = null }
      data.appointments.push(appointment)
      return publicBookingResult(appointment)
    })
  }

  async getAdminData() {
    const services = [...this.data.services].sort((a, b) => a.sort_order - b.sort_order)
    const serviceById = new Map(services.map((service) => [service.id, service]))
    const appointments = [...this.data.appointments]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 500)
      .map((appointment) => normalizeAppointment(appointment, serviceById.get(appointment.service_id)))
    const today = getStudioDate()
    const blocks = this.data.date_blocks.filter((block) => block.blocked_date >= today).sort((a, b) => a.blocked_date.localeCompare(b.blocked_date))
    const customers = (this.data.customers ?? []).map((customer) => customerSummary(customer, this.data.appointments)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const promotions = (this.data.promotions ?? []).slice().sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on))).map((promotion) => normalizePromotion(promotion, services))
    return jsonSafe({ appointments, services: services.map(stripLegacyServiceDepositFlag), hours: this.data.business_hours, blocks, policies: normalizePolicyFlags(this.data.business_policies), customers, promotions, financial_entries: (this.data.financial_entries ?? []).slice().sort((a, b) => String(b.movement_date).localeCompare(String(a.movement_date)) || String(b.created_at).localeCompare(String(a.created_at))).map(normalizeFinancialEntry), payables: (this.data.payables ?? []).slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).map(normalizePayable) })
  }

  async createPromotion(input) {
    return this.mutate((data) => {
      data.promotions ??= []
      const valid = validatePromotionInput(input, data.services, data.promotions)
      const now = new Date().toISOString()
      const promotion = { id: randomUUID(), ...valid, created_at: now, updated_at: now }
      data.promotions.push(promotion)
      return normalizePromotion(promotion, data.services)
    })
  }

  async updatePromotion(id, input) {
    return this.mutate((data) => {
      data.promotions ??= []
      const existing = data.promotions.find((item) => item.id === id)
      if (!existing) throw new Error('PROMOTION_NOT_FOUND')
      const valid = validatePromotionInput(input, data.services, data.promotions, id)
      Object.assign(existing, valid, { updated_at: new Date().toISOString() })
      return normalizePromotion(existing, data.services)
    })
  }

  async createCustomer(input) {
    const valid = validateCustomerProfileInput(input)
    return this.mutate((data) => {
      const existing = data.customers.find((customer) => normalizeBrazilPhone(customer.phone) === valid.phone)
      if (existing) throw new Error('CUSTOMER_PHONE_ALREADY_EXISTS')
      const now = new Date().toISOString()
      const customer = { id: randomUUID(), ...valid, created_at: now, updated_at: now }
      data.customers.push(customer)
      return customerSummary(customer, data.appointments)
    })
  }

  async importCustomers(rawContacts) {
    const prepared = prepareContactImport(rawContacts)
    return this.mutate((data) => {
      const phoneSet = new Set(data.customers.map((customer) => normalizeBrazilPhone(customer.phone)).filter(Boolean))
      const nameSet = new Set(data.customers.map((customer) => customerNameKey(customer.name)))
      let created = 0
      let duplicates = 0
      for (const contact of prepared.contacts) {
        const key = customerNameKey(contact.name)
        if ((contact.phone && phoneSet.has(contact.phone)) || (!contact.phone && nameSet.has(key))) {
          duplicates += 1
          continue
        }
        const now = new Date().toISOString()
        data.customers.push({ id: randomUUID(), name: contact.name, phone: contact.phone, require_deposit: false, internal_note: '', created_at: now, updated_at: now })
        if (contact.phone) phoneSet.add(contact.phone)
        nameSet.add(key)
        created += 1
      }
      return { created, duplicates, invalid: prepared.invalid }
    })
  }

  async updateCustomer(id, input) {
    return this.mutate((data) => {
      const customer = data.customers.find((item) => item.id === id)
      if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
      const valid = validateCustomerUpdateInput(input, customer)
      Object.assign(customer, valid, { updated_at: new Date().toISOString() })
      return customerSummary(customer, data.appointments)
    })
  }

  async updateAppointmentStatus(id, status) {
    if (!APPOINTMENT_STATUSES.has(status)) throw new Error('INVALID_APPOINTMENT_STATUS')
    return this.mutate((data) => {
      const appointment = data.appointments.find((item) => item.id === id)
      if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND')
      if (status === 'completed' && appointment.deposit_required && !appointment.deposit_received) throw new Error('DEPOSIT_NOT_CONFIRMED')
      if (status === 'completed' && !['confirmed', 'completed'].includes(appointment.status)) throw new Error('APPOINTMENT_NOT_CONFIRMED')
      if (status === 'confirmed' && appointment.deposit_required) appointment.deposit_received = true
      if (status === 'awaiting_deposit') {
        const service = data.services.find((item) => item.id === appointment.service_id)
        if (!service || service.deposit_percent <= 0) throw new Error('DEPOSIT_NOT_CONFIGURED')
        appointment.deposit_required = true
        if (appointment.deposit_cents <= 0) appointment.deposit_cents = Math.round(appointment.price_cents * service.deposit_percent / 100)
      }
      appointment.status = status
      appointment.updated_at = new Date().toISOString()
      if (status === 'confirmed' && appointment.deposit_required) ensureDepositFinancialEntry(data, appointment)
      return normalizeAppointment(appointment, data.services.find((item) => item.id === appointment.service_id))
    })
  }

  async reportDepositPayment(publicCode, rawPhone) {
    const code = String(publicCode ?? '').trim().toUpperCase()
    const phone = normalizeBrazilPhone(rawPhone)
    if (!phone) throw new Error('INVALID_CUSTOMER_PHONE')
    return this.mutate((data) => {
      const appointment = data.appointments.find((item) => item.public_code === code && normalizeBrazilPhone(item.customer_phone) === phone)
      if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND')
      if (!appointment.deposit_required) throw new Error('DEPOSIT_NOT_REQUIRED')
      if (appointment.deposit_received) return { success: true, deposit_reported: true, already_received: true }
      if (appointment.status !== 'awaiting_deposit') throw new Error('DEPOSIT_REPORT_NOT_ALLOWED')
      appointment.deposit_reported = true
      appointment.updated_at = new Date().toISOString()
      return { success: true, deposit_reported: true, already_received: false }
    })
  }

  async receiveAppointmentBalance(id, rawPaymentMethod = 'Pix') {
    const paymentMethod = validatePaymentMethod(rawPaymentMethod)
    return this.mutate((data) => {
      const appointment = data.appointments.find((item) => item.id === id)
      if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND')
      data.financial_entries ??= []
      const relatedEntries = data.financial_entries.filter((entry) => entry.related_appointment_id === id && ['appointment_deposit', 'appointment_balance'].includes(entry.source_type))
      const priorBalance = relatedEntries.find((entry) => entry.source_type === 'appointment_balance')
      if (priorBalance) return { entry: normalizeFinancialEntry(priorBalance), already_received: true }
      if (!isAppointmentBalanceEligible(appointment)) throw new Error('APPOINTMENT_NOT_FINISHED')

      const alreadyReceivedCents = relatedEntries.reduce((total, entry) => total + Number(entry.amount_cents || 0), 0)
      const balanceCents = Math.max(0, Number(appointment.price_cents) - alreadyReceivedCents)
      if (balanceCents <= 0) throw new Error('NO_BALANCE_TO_RECEIVE')

      const service = data.services.find((item) => item.id === appointment.service_id)
      const entry = makeFinancialEntry({
        direction: 'income',
        description: `Restante recebido — ${appointment.customer_name}${service?.name ? ` · ${service.name}` : ''}`,
        category: 'Atendimentos',
        amount_cents: balanceCents,
        movement_date: getStudioDate(),
        payment_method: paymentMethod,
        source_type: 'appointment_balance',
        source_id: appointment.id,
        related_appointment_id: appointment.id,
      })
      data.financial_entries.push(entry)
      return { entry: normalizeFinancialEntry(entry), already_received: false }
    })
  }

  async createFinancialEntry(input) {
    const valid = validateFinancialEntryInput(input)
    return this.mutate((data) => {
      const entry = makeFinancialEntry({ ...valid, source_type: 'manual' })
      data.financial_entries ??= []
      data.financial_entries.push(entry)
      return normalizeFinancialEntry(entry)
    })
  }

  async deleteFinancialEntry(id) {
    return this.mutate((data) => {
      const entry = (data.financial_entries ?? []).find((item) => item.id === id)
      if (!entry) throw new Error('FINANCIAL_ENTRY_NOT_FOUND')
      if (entry.source_type !== 'manual') throw new Error('FINANCIAL_ENTRY_PROTECTED')
      data.financial_entries = data.financial_entries.filter((item) => item.id !== id)
      return { success: true }
    })
  }

  async createPayable(input) {
    const valid = validatePayableInput(input)
    return this.mutate((data) => {
      data.payables ??= []
      const payable = { id: randomUUID(), ...valid, status: 'pending', paid_at: null, expense_entry_id: null, created_at: new Date().toISOString() }
      data.payables.push(payable)
      return normalizePayable(payable)
    })
  }

  async markPayablePaid(id) {
    return this.mutate((data) => {
      const payable = (data.payables ?? []).find((item) => item.id === id)
      if (!payable) throw new Error('PAYABLE_NOT_FOUND')
      if (payable.status === 'paid') return { payable: normalizePayable(payable), entry: (data.financial_entries ?? []).find((item) => item.id === payable.expense_entry_id) ?? null, already_paid: true }
      const entry = makeFinancialEntry({ direction: 'expense', description: `Pagamento: ${payable.description}`, category: payable.category, amount_cents: payable.amount_cents, movement_date: getStudioDate(), payment_method: 'Não informado', source_type: 'payable_payment', source_id: payable.id })
      data.financial_entries ??= []
      data.financial_entries.push(entry)
      payable.status = 'paid'
      payable.paid_at = new Date().toISOString()
      payable.expense_entry_id = entry.id
      return { payable: normalizePayable(payable), entry: normalizeFinancialEntry(entry), already_paid: false }
    })
  }

  async deletePayable(id) {
    return this.mutate((data) => {
      const payable = (data.payables ?? []).find((item) => item.id === id)
      if (!payable) throw new Error('PAYABLE_NOT_FOUND')
      if (payable.status === 'paid') throw new Error('PAID_PAYABLE_PROTECTED')
      data.payables = data.payables.filter((item) => item.id !== id)
      return { success: true }
    })
  }

  async createService(input) {
    const valid = prepareNewService(input)
    return this.mutate((data) => {
      const now = new Date().toISOString()
      const service = {
        id: randomUUID(),
        slug: uniqueServiceSlug(valid.name, data.services),
        ...valid,
        sort_order: Math.max(0, ...data.services.map((item) => Number(item.sort_order) || 0)) + 10,
        created_at: now,
        updated_at: now,
      }
      data.services.push(service)
      return stripLegacyServiceDepositFlag(service)
    })
  }

  async deleteService(id) {
    return this.mutate((data) => {
      const service = data.services.find((item) => item.id === id)
      if (!service) throw new Error('SERVICE_NOT_FOUND')
      const hasAppointments = data.appointments.some((item) => item.service_id === id)
      const hasPromotions = (data.promotions ?? []).some((promotion) => (promotion.items ?? []).some((item) => item.service_id === id))
      if (hasAppointments || hasPromotions) throw new Error('SERVICE_IN_USE')
      data.services = data.services.filter((item) => item.id !== id)
      return { success: true }
    })
  }

  async updateService(id, values) {
    return this.mutate((data) => {
      const service = data.services.find((item) => item.id === id)
      if (!service) throw new Error('SERVICE_NOT_FOUND')
      const next = { ...stripLegacyServiceDepositFlag(service), ...values, updated_at: new Date().toISOString() }
      validateServiceUpdate(next)
      next.name = String(next.name).trim()
      next.category = String(next.category ?? '').trim().slice(0, 100)
      next.description = String(next.description ?? '').trim().slice(0, 1000)
      next.duration_minutes = Number(next.duration_minutes)
      next.price_cents = Number(next.price_cents)
      next.deposit_percent = Number(next.deposit_percent)
      delete next.deposit_required
      next.active = Boolean(next.active)
      delete service.deposit_required
      Object.assign(service, next)
      return stripLegacyServiceDepositFlag(service)
    })
  }

  async saveHours(hours) {
    validateBusinessHours(hours)
    return this.mutate((data) => {
      data.business_hours = hours.map((hour) => ({
        weekday: Number(hour.weekday), enabled: Boolean(hour.enabled),
        start_time: hour.enabled ? String(hour.start_time).slice(0, 5) : null,
        end_time: hour.enabled ? String(hour.end_time).slice(0, 5) : null,
        break_start: hour.enabled && hour.break_start ? String(hour.break_start).slice(0, 5) : null,
        break_end: hour.enabled && hour.break_end ? String(hour.break_end).slice(0, 5) : null,
      })).sort((a, b) => a.weekday - b.weekday)
      return data.business_hours
    })
  }

  async savePolicies(input) {
    const valid = validatePolicies(input)
    return this.mutate((data) => {
      data.business_policies = normalizePolicyFlags({ ...data.business_policies, ...valid, updated_at: new Date().toISOString() })
      return data.business_policies
    })
  }

  async createBlock(input) {
    const valid = validateBlock(input)
    return this.mutate((data) => {
      if (data.date_blocks.some((block) => block.blocked_date === valid.blocked_date && block.start_time === valid.start_time && block.end_time === valid.end_time)) throw new Error('BLOCK_ALREADY_EXISTS')
      const block = { id: randomUUID(), ...valid, created_at: new Date().toISOString() }
      data.date_blocks.push(block)
      data.date_blocks.sort((a, b) => a.blocked_date.localeCompare(b.blocked_date))
      return block
    })
  }

  async removeBlock(id) {
    return this.mutate((data) => {
      const lengthBefore = data.date_blocks.length
      data.date_blocks = data.date_blocks.filter((block) => block.id !== id)
      if (data.date_blocks.length === lengthBefore) throw new Error('BLOCK_NOT_FOUND')
      return { success: true }
    })
  }
}

class MySqlStore {
  constructor(pool) {
    this.pool = pool
    this.mode = 'mysql'
  }

  async init() {
    await this.pool.query('SELECT 1')
  }

  async getPublicServices() {
    const [rows] = await this.pool.query('SELECT id, slug, name, category, description, duration_minutes, price_cents, deposit_percent, active, sort_order FROM services WHERE active = 1 ORDER BY sort_order, name')
    return rows.map(normalizeSqlService)
  }

  async loadPromotions(executor = this.pool) {
    const [[promotionRows], [itemRows], [serviceRows]] = await Promise.all([
      executor.query('SELECT id, name, starts_on, ends_on, active, created_at, updated_at FROM promotions ORDER BY starts_on, name'),
      executor.query('SELECT promotion_id, service_id, promotional_price_cents FROM promotion_items ORDER BY promotion_id, service_id'),
      executor.query('SELECT id, name, price_cents FROM services'),
    ])
    const services = serviceRows.map((service) => ({ ...service, price_cents: Number(service.price_cents) }))
    return promotionRows.map((row) => normalizePromotion({
      id: row.id, name: row.name, starts_on: normalizeDateOnly(row.starts_on), ends_on: normalizeDateOnly(row.ends_on),
      active: Boolean(row.active), created_at: row.created_at, updated_at: row.updated_at,
      items: itemRows.filter((item) => item.promotion_id === row.id).map((item) => ({ service_id: item.service_id, promotional_price_cents: Number(item.promotional_price_cents) })),
    }, services))
  }

  async getPublicPromotions(date) {
    const [services, promotions] = await Promise.all([this.getPublicServices(), this.loadPromotions()])
    return services.map((service) => findPromotionPrice(promotions, service, date)).filter(Boolean)
  }

  async getPolicies() {
    const [rows] = await this.pool.query('SELECT singleton, lateness_tolerance_minutes, cancellation_notice_hours, companion_policy, no_show_policy, show_lateness_policy, show_cancellation_policy, show_companion_policy, show_no_show_policy, updated_at FROM business_policies WHERE singleton = 1 LIMIT 1')
    if (!rows.length) throw new Error('BUSINESS_POLICIES_UNAVAILABLE')
    return normalizePolicyFlags({ ...rows[0], singleton: Boolean(rows[0].singleton), updated_at: mysqlDateTimeToIso(rows[0].updated_at) })
  }

  async getAvailabilityContext(connection, date) {
    const startUtc = mysqlUtcDateTime(localDateTimeToUtc(date, '00:00'))
    const nextUtc = mysqlUtcDateTime(localDateTimeToUtc(addDateDays(date, 1), '00:00'))
    const weekday = getWeekday(date)
    const [[hours], [blocks], [appointments]] = await Promise.all([
      connection.query('SELECT weekday, enabled, start_time, end_time, break_start, break_end FROM business_hours WHERE weekday = ?', [weekday]),
      connection.query('SELECT id, blocked_date, start_time, end_time, note FROM date_blocks WHERE blocked_date = ?', [date]),
      connection.query("SELECT id, public_code, customer_name, customer_phone, customer_note, service_id, starts_at, ends_at, price_cents, deposit_cents, deposit_required, deposit_received, policy_acknowledged, status, created_at, updated_at FROM appointments WHERE starts_at < ? AND ends_at > ? AND status IN ('pending_confirmation','awaiting_deposit','confirmed')", [nextUtc, startUtc]),
    ])
    return {
      hours: hours.map((item) => ({ ...item, weekday: Number(item.weekday), enabled: Boolean(item.enabled) })),
      blocks: blocks.map((item) => ({ ...item, blocked_date: String(item.blocked_date).slice(0, 10) })),
      appointments: appointments.map((item) => ({ ...item, starts_at: mysqlDateTimeToIso(item.starts_at), ends_at: mysqlDateTimeToIso(item.ends_at), created_at: mysqlDateTimeToIso(item.created_at), updated_at: mysqlDateTimeToIso(item.updated_at), deposit_required: Boolean(item.deposit_required), deposit_received: Boolean(item.deposit_received), policy_acknowledged: Boolean(item.policy_acknowledged) })),
    }
  }

  async getAvailableSlots(serviceIdsInput, date) {
    const ids = Array.isArray(serviceIdsInput) ? serviceIdsInput : String(serviceIdsInput ?? '').split(',').filter(Boolean)
    if (!ids.length || ids.length > 5) return []
    const [rows] = await this.pool.query('SELECT id, active, duration_minutes, name, category, price_cents, deposit_percent, description, slug FROM services WHERE id IN (?) AND active = 1', [ids])
    const byId = new Map(rows.map((row) => [row.id, normalizeSqlService(row)]))
    const selected = ids.map((id) => byId.get(id)).filter(Boolean)
    if (selected.length !== ids.length) return []
    const connection = await this.pool.getConnection()
    try {
      const context = await this.getAvailabilityContext(connection, date)
      const combined = combineSelectedServices(selected, await this.loadPromotions(connection), date)
      return buildAvailableSlots({ service: combined.service, ...context, date })
    } finally { connection.release() }
  }

  async createBooking(rawInput, { adminCreated = false } = {}) {
    const policySettings = await this.getPolicies()
    const input = validateBookingInput(rawInput, { requirePolicyAcknowledgement: !adminCreated && hasPublicGuidelines(policySettings), allowMissingPhone: adminCreated && rawInput.allowMissingPhone === true })
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.query('SELECT id FROM booking_mutex WHERE id = 1 FOR UPDATE')
      const [serviceRows] = await connection.query('SELECT * FROM services WHERE id IN (?) AND active = 1', [input.serviceIds])
      const byId = new Map(serviceRows.map((row) => [row.id, normalizeSqlService(row)]))
      const selected = input.serviceIds.map((id) => byId.get(id)).filter(Boolean)
      if (!selected.length || selected.length !== input.serviceIds.length) throw new Error('SERVICE_NOT_AVAILABLE')
      const context = await this.getAvailabilityContext(connection, input.date)
      const [policyRows] = await connection.query('SELECT singleton, lateness_tolerance_minutes, cancellation_notice_hours, companion_policy, no_show_policy, show_lateness_policy, show_cancellation_policy, show_companion_policy, show_no_show_policy, updated_at FROM business_policies WHERE singleton = 1 LIMIT 1')
      if (!policyRows.length) throw new Error('BUSINESS_POLICIES_UNAVAILABLE')
      const promotions = await this.loadPromotions(connection)
      const combined = combineSelectedServices(selected, promotions, input.date)
      if (!buildAvailableSlots({ service: combined.service, ...context, date: input.date }).includes(input.time)) throw new Error('SLOT_TAKEN')
      const policies = normalizePolicyFlags({ ...policyRows[0], singleton: Boolean(policyRows[0].singleton), updated_at: mysqlDateTimeToIso(policyRows[0].updated_at) })
      let customerRows = []
      if (input.customerPhone) {
        await connection.query("INSERT IGNORE INTO customers (id, name, phone, require_deposit, internal_note) VALUES (?, ?, ?, 0, '')", [randomUUID(), input.customerName, input.customerPhone])
        const [rows] = await connection.query('SELECT id, require_deposit FROM customers WHERE phone = ? LIMIT 1 FOR UPDATE', [input.customerPhone])
        if (!rows.length) throw new Error('CUSTOMER_NOT_FOUND')
        customerRows = rows
      } else if (adminCreated && rawInput.allowMissingPhone === true) {
        const [rows] = await connection.query('SELECT id, require_deposit FROM customers WHERE phone IS NULL AND name = ? LIMIT 1 FOR UPDATE', [input.customerName])
        if (rows.length) {
          customerRows = rows
        } else {
          const customerId = randomUUID()
          await connection.query("INSERT INTO customers (id, name, phone, require_deposit, internal_note) VALUES (?, ?, NULL, 0, '')", [customerId, input.customerName])
          customerRows = [{ id: customerId, require_deposit: 0 }]
        }
      }
      const depositRequired = Boolean(customerRows[0]?.require_deposit)
      if (depositRequired && combined.deposit <= 0) throw new Error('DEPOSIT_NOT_CONFIGURED')
      const appointment = buildAppointment({ input, service: combined.service, policies, id: randomUUID(), publicCode: makePublicCode(), depositRequired })
      appointment.service_id = selected[0].id
      appointment.service_items = combined.serviceItems
      appointment.service = { name: combined.service.name, category: combined.service.category, duration_minutes: combined.service.duration_minutes }
      appointment.price_cents = combined.total
      appointment.regular_price_cents = combined.regularTotal
      appointment.deposit_cents = depositRequired ? combined.deposit : 0
      appointment.promotion_id = combined.promotionId
      appointment.promotion_name = combined.promotionName
      appointment.status = depositRequired ? 'awaiting_deposit' : 'pending_confirmation'
      if (adminCreated) { appointment.policy_acknowledged = false; appointment.policy_acknowledged_at = null }
      await connection.query(`INSERT INTO appointments
        (id, public_code, customer_name, customer_phone, customer_note, service_id, service_snapshot, promotion_id, promotion_name, starts_at, ends_at, price_cents, regular_price_cents, deposit_cents, deposit_required, deposit_received, deposit_reported, policy_acknowledged, policy_acknowledged_at, policy_snapshot, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`, [
        appointment.id, appointment.public_code, appointment.customer_name, appointment.customer_phone, appointment.customer_note,
        appointment.service_id, JSON.stringify(appointment.service_items), appointment.promotion_id, appointment.promotion_name,
        mysqlUtcDateTime(appointment.starts_at), mysqlUtcDateTime(appointment.ends_at), appointment.price_cents, appointment.regular_price_cents,
        appointment.deposit_cents, appointment.deposit_required ? 1 : 0, appointment.policy_acknowledged ? 1 : 0,
        appointment.policy_acknowledged_at ? mysqlUtcDateTime(appointment.policy_acknowledged_at) : null, JSON.stringify(appointment.policy_snapshot), appointment.status, mysqlUtcDateTime(appointment.created_at), mysqlUtcDateTime(appointment.updated_at),
      ])
      await connection.commit()
      return publicBookingResult(appointment)
    } catch (error) {
      await connection.rollback()
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('SLOT_TAKEN')
      throw error
    } finally { connection.release() }
  }

  async getAdminData() {
    const today = getStudioDate()
    const [[appointmentRows], [serviceRows], [hourRows], [blockRows], [policyRows], [customerRows], [entryRows], [payableRows]] = await Promise.all([
      this.pool.query(`SELECT a.*, s.name AS service_name, s.category AS service_category, s.duration_minutes AS service_duration_minutes
        FROM appointments a LEFT JOIN services s ON s.id = a.service_id ORDER BY a.starts_at ASC LIMIT 500`),
      this.pool.query('SELECT * FROM services ORDER BY sort_order, name'),
      this.pool.query('SELECT * FROM business_hours ORDER BY weekday'),
      this.pool.query('SELECT * FROM date_blocks WHERE blocked_date >= ? ORDER BY blocked_date, start_time', [today]),
      this.pool.query('SELECT * FROM business_policies WHERE singleton = 1 LIMIT 1'),
      this.pool.query(`SELECT c.*, COUNT(a.id) AS appointment_count, SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) AS no_show_count, MAX(a.starts_at) AS last_appointment_at
        FROM customers c LEFT JOIN appointments a
          ON (c.phone IS NOT NULL AND c.phone <> '' AND a.customer_phone = c.phone)
          OR ((c.phone IS NULL OR c.phone = '') AND a.customer_phone = '' AND a.customer_name = c.name)
        GROUP BY c.id ORDER BY c.name`),
      this.pool.query('SELECT * FROM financial_entries ORDER BY movement_date DESC, created_at DESC LIMIT 1000'),
      this.pool.query('SELECT * FROM payables ORDER BY due_date ASC, created_at DESC LIMIT 500'),
    ])
    const appointments = appointmentRows.map((item) => normalizeAppointment({
      ...item,
      starts_at: item.starts_at,
      ends_at: item.ends_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      policy_acknowledged_at: item.policy_acknowledged_at,
      deposit_required: Boolean(item.deposit_required),
      deposit_received: Boolean(item.deposit_received),
      deposit_reported: Boolean(item.deposit_reported),
      policy_acknowledged: Boolean(item.policy_acknowledged),
      policy_snapshot: typeof item.policy_snapshot === 'string' ? JSON.parse(item.policy_snapshot) : item.policy_snapshot,
    }, item.service_name ? { name: item.service_name, category: item.service_category, duration_minutes: item.service_duration_minutes } : null))
    return {
      appointments,
      services: serviceRows.map(normalizeSqlService),
      customers: customerRows.map((item) => ({ id: item.id, name: item.name, phone: normalizeBrazilPhone(item.phone), require_deposit: Boolean(item.require_deposit), internal_note: item.internal_note ?? '', created_at: mysqlDateTimeToIso(item.created_at), updated_at: mysqlDateTimeToIso(item.updated_at), appointment_count: Number(item.appointment_count ?? 0), no_show_count: Number(item.no_show_count ?? 0), last_appointment_at: mysqlDateTimeToIso(item.last_appointment_at) })),
      hours: hourRows.map((item) => ({ ...item, weekday: Number(item.weekday), enabled: Boolean(item.enabled) })),
      blocks: blockRows.map((item) => ({ ...item, blocked_date: String(item.blocked_date).slice(0, 10), created_at: mysqlDateTimeToIso(item.created_at) })),
      policies: policyRows.length ? normalizePolicyFlags({ ...policyRows[0], singleton: Boolean(policyRows[0].singleton), updated_at: mysqlDateTimeToIso(policyRows[0].updated_at) }) : DEFAULT_POLICIES,
      financial_entries: entryRows.map((item) => normalizeFinancialEntry({ ...item, movement_date: normalizeDateOnly(item.movement_date), created_at: mysqlDateTimeToIso(item.created_at) })),
      promotions: await this.loadPromotions(this.pool),
      payables: payableRows.map((item) => normalizePayable({ ...item, due_date: normalizeDateOnly(item.due_date), paid_at: mysqlDateTimeToIso(item.paid_at), created_at: mysqlDateTimeToIso(item.created_at) })),
    }
  }

  async createPromotion(input) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [[serviceRows], promotions] = await Promise.all([
        connection.query('SELECT id, name, price_cents, active FROM services'),
        this.loadPromotions(connection),
      ])
      const services = serviceRows.map((service) => ({ ...service, price_cents: Number(service.price_cents), active: Boolean(service.active) }))
      const valid = validatePromotionInput(input, services, promotions)
      const id = randomUUID()
      await connection.query('INSERT INTO promotions (id, name, starts_on, ends_on, active) VALUES (?, ?, ?, ?, ?)', [id, valid.name, valid.starts_on, valid.ends_on, valid.active ? 1 : 0])
      for (const item of valid.items) {
        await connection.query('INSERT INTO promotion_items (promotion_id, service_id, promotional_price_cents) VALUES (?, ?, ?)', [id, item.service_id, item.promotional_price_cents])
      }
      await connection.commit()
      return normalizePromotion({ id, ...valid, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, services)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async updatePromotion(id, input) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [[serviceRows], promotions] = await Promise.all([
        connection.query('SELECT id, name, price_cents, active FROM services'),
        this.loadPromotions(connection),
      ])
      const existing = promotions.find((promotion) => promotion.id === id)
      if (!existing) throw new Error('PROMOTION_NOT_FOUND')
      const services = serviceRows.map((service) => ({ ...service, price_cents: Number(service.price_cents), active: Boolean(service.active) }))
      const valid = validatePromotionInput(input, services, promotions, id)
      await connection.query('UPDATE promotions SET name = ?, starts_on = ?, ends_on = ?, active = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [valid.name, valid.starts_on, valid.ends_on, valid.active ? 1 : 0, id])
      await connection.query('DELETE FROM promotion_items WHERE promotion_id = ?', [id])
      for (const item of valid.items) {
        await connection.query('INSERT INTO promotion_items (promotion_id, service_id, promotional_price_cents) VALUES (?, ?, ?)', [id, item.service_id, item.promotional_price_cents])
      }
      await connection.commit()
      return normalizePromotion({ ...existing, ...valid, id, updated_at: new Date().toISOString() }, services)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async createCustomer(input) {
    const valid = validateCustomerProfileInput(input)
    const id = randomUUID()
    try {
      await this.pool.query('INSERT INTO customers (id, name, phone, require_deposit, internal_note) VALUES (?, ?, ?, ?, ?)', [id, valid.name, valid.phone, valid.require_deposit ? 1 : 0, valid.internal_note])
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('CUSTOMER_PHONE_ALREADY_EXISTS')
      throw error
    }
    const { customers } = await this.getAdminData()
    return customers.find((customer) => customer.id === id)
  }

  async importCustomers(rawContacts) {
    const prepared = prepareContactImport(rawContacts)
    const connection = await this.pool.getConnection()
    let created = 0
    let duplicates = 0
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT name, phone FROM customers FOR UPDATE')
      const phoneSet = new Set(rows.map((customer) => normalizeBrazilPhone(customer.phone)).filter(Boolean))
      const nameSet = new Set(rows.map((customer) => customerNameKey(customer.name)))
      for (const contact of prepared.contacts) {
        const key = customerNameKey(contact.name)
        if ((contact.phone && phoneSet.has(contact.phone)) || (!contact.phone && nameSet.has(key))) {
          duplicates += 1
          continue
        }
        try {
          await connection.query("INSERT INTO customers (id, name, phone, require_deposit, internal_note) VALUES (?, ?, ?, 0, '')", [randomUUID(), contact.name, contact.phone || null])
        } catch (error) {
          if (error?.code === 'ER_DUP_ENTRY') {
            duplicates += 1
            continue
          }
          throw error
        }
        if (contact.phone) phoneSet.add(contact.phone)
        nameSet.add(key)
        created += 1
      }
      await connection.commit()
      return { created, duplicates, invalid: prepared.invalid }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async updateCustomer(id, input) {
    const [rows] = await this.pool.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('CUSTOMER_NOT_FOUND')
    const current = rows[0]
    const valid = validateCustomerUpdateInput(input, { ...current, require_deposit: Boolean(current.require_deposit), phone: normalizeBrazilPhone(current.phone) })
    await this.pool.query('UPDATE customers SET name = ?, require_deposit = ?, internal_note = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [valid.name, valid.require_deposit ? 1 : 0, valid.internal_note, id])
    const { customers } = await this.getAdminData()
    return customers.find((customer) => customer.id === id)
  }

  async updateAppointmentStatus(id, status) {
    if (!APPOINTMENT_STATUSES.has(status)) throw new Error('INVALID_APPOINTMENT_STATUS')
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id])
      if (!rows.length) throw new Error('APPOINTMENT_NOT_FOUND')
      const appointment = rows[0]
      if (status === 'completed' && Boolean(appointment.deposit_required) && !Boolean(appointment.deposit_received)) throw new Error('DEPOSIT_NOT_CONFIRMED')
      if (status === 'completed' && !['confirmed', 'completed'].includes(appointment.status)) throw new Error('APPOINTMENT_NOT_CONFIRMED')
      let depositRequired = Boolean(appointment.deposit_required)
      let depositCents = Number(appointment.deposit_cents)
      const depositReceived = status === 'confirmed' && depositRequired ? true : Boolean(appointment.deposit_received)
      if (status === 'awaiting_deposit') {
        const [serviceRows] = await connection.query('SELECT deposit_percent FROM services WHERE id = ? LIMIT 1', [appointment.service_id])
        const depositPercent = Number(serviceRows[0]?.deposit_percent ?? 0)
        if (depositPercent <= 0) throw new Error('DEPOSIT_NOT_CONFIGURED')
        depositRequired = true
        if (depositCents <= 0) depositCents = Math.round(Number(appointment.price_cents) * depositPercent / 100)
      }
      await connection.query('UPDATE appointments SET status = ?, deposit_required = ?, deposit_cents = ?, deposit_received = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [status, depositRequired ? 1 : 0, depositCents, depositReceived ? 1 : 0, id])
      if (status === 'confirmed' && depositRequired && depositCents > 0) {
        await connection.query(`INSERT INTO financial_entries (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id, related_appointment_id)
          VALUES (?, 'income', ?, 'Sinais de agendamento', ?, ?, 'Pix', 'appointment_deposit', ?, ?)
          ON DUPLICATE KEY UPDATE id = id`, [randomUUID(), `Sinal recebido — ${appointment.customer_name}`, depositCents, getStudioDate(), id, id])
      }
      await connection.commit()
      const updated = { ...appointment, status, deposit_required: depositRequired, deposit_cents: depositCents, deposit_received: depositReceived, updated_at: new Date().toISOString() }
      return normalizeAppointment(updated, null)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async reportDepositPayment(publicCode, rawPhone) {
    const code = String(publicCode ?? '').trim().toUpperCase()
    const phone = normalizeBrazilPhone(rawPhone)
    if (!phone) throw new Error('INVALID_CUSTOMER_PHONE')
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT id, deposit_required, deposit_received, status FROM appointments WHERE public_code = ? AND customer_phone = ? LIMIT 1 FOR UPDATE', [code, phone])
      if (!rows.length) throw new Error('APPOINTMENT_NOT_FOUND')
      const appointment = rows[0]
      if (!Boolean(appointment.deposit_required)) throw new Error('DEPOSIT_NOT_REQUIRED')
      if (Boolean(appointment.deposit_received)) {
        await connection.commit()
        return { success: true, deposit_reported: true, already_received: true }
      }
      if (appointment.status !== 'awaiting_deposit') throw new Error('DEPOSIT_REPORT_NOT_ALLOWED')
      await connection.query('UPDATE appointments SET deposit_reported = 1, updated_at = UTC_TIMESTAMP() WHERE id = ?', [appointment.id])
      await connection.commit()
      return { success: true, deposit_reported: true, already_received: false }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async receiveAppointmentBalance(id, rawPaymentMethod = 'Pix') {
    const paymentMethod = validatePaymentMethod(rawPaymentMethod)
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [appointmentRows] = await connection.query('SELECT * FROM appointments WHERE id = ? LIMIT 1 FOR UPDATE', [id])
      if (!appointmentRows.length) throw new Error('APPOINTMENT_NOT_FOUND')
      const appointment = appointmentRows[0]
      const [entryRows] = await connection.query(`SELECT * FROM financial_entries
        WHERE related_appointment_id = ? AND source_type IN ('appointment_deposit', 'appointment_balance') FOR UPDATE`, [id])
      const priorBalance = entryRows.find((entry) => entry.source_type === 'appointment_balance')
      if (priorBalance) {
        await connection.commit()
        return { entry: normalizeFinancialEntry({ ...priorBalance, movement_date: normalizeDateOnly(priorBalance.movement_date), created_at: mysqlDateTimeToIso(priorBalance.created_at) }), already_received: true }
      }
      const normalizedAppointment = { ...appointment, ends_at: mysqlDateTimeToIso(appointment.ends_at) }
      if (!isAppointmentBalanceEligible(normalizedAppointment)) throw new Error('APPOINTMENT_NOT_FINISHED')

      const alreadyReceivedCents = entryRows.reduce((total, entry) => total + Number(entry.amount_cents || 0), 0)
      const balanceCents = Math.max(0, Number(appointment.price_cents) - alreadyReceivedCents)
      if (balanceCents <= 0) throw new Error('NO_BALANCE_TO_RECEIVE')
      const entryId = randomUUID()
      await connection.query(`INSERT INTO financial_entries
        (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id, related_appointment_id)
        VALUES (?, 'income', ?, 'Atendimentos', ?, ?, ?, 'appointment_balance', ?, ?)
        ON DUPLICATE KEY UPDATE id = id`, [entryId, `Restante recebido — ${appointment.customer_name}`, balanceCents, getStudioDate(), paymentMethod, id, id])
      const [savedRows] = await connection.query("SELECT * FROM financial_entries WHERE source_type = 'appointment_balance' AND source_id = ? LIMIT 1", [id])
      await connection.commit()
      const savedEntry = savedRows[0]
      return { entry: normalizeFinancialEntry({ ...savedEntry, movement_date: normalizeDateOnly(savedEntry.movement_date), created_at: mysqlDateTimeToIso(savedEntry.created_at) }), already_received: false }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async createFinancialEntry(input) {
    const valid = validateFinancialEntryInput(input)
    const id = randomUUID()
    await this.pool.query(`INSERT INTO financial_entries (id, direction, description, category, amount_cents, movement_date, payment_method, source_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')`, [id, valid.direction, valid.description, valid.category, valid.amount_cents, valid.movement_date, valid.payment_method])
    const [rows] = await this.pool.query('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [id])
    return normalizeFinancialEntry({ ...rows[0], movement_date: normalizeDateOnly(rows[0].movement_date), created_at: mysqlDateTimeToIso(rows[0].created_at) })
  }

  async deleteFinancialEntry(id) {
    const [rows] = await this.pool.query('SELECT source_type FROM financial_entries WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('FINANCIAL_ENTRY_NOT_FOUND')
    if (rows[0].source_type !== 'manual') throw new Error('FINANCIAL_ENTRY_PROTECTED')
    await this.pool.query("DELETE FROM financial_entries WHERE id = ? AND source_type = 'manual'", [id])
    return { success: true }
  }

  async createPayable(input) {
    const valid = validatePayableInput(input)
    const id = randomUUID()
    await this.pool.query(`INSERT INTO payables (id, description, category, amount_cents, due_date, status) VALUES (?, ?, ?, ?, ?, 'pending')`, [id, valid.description, valid.category, valid.amount_cents, valid.due_date])
    const [rows] = await this.pool.query('SELECT * FROM payables WHERE id = ? LIMIT 1', [id])
    return normalizePayable({ ...rows[0], due_date: normalizeDateOnly(rows[0].due_date), created_at: mysqlDateTimeToIso(rows[0].created_at) })
  }

  async markPayablePaid(id) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT * FROM payables WHERE id = ? LIMIT 1 FOR UPDATE', [id])
      if (!rows.length) throw new Error('PAYABLE_NOT_FOUND')
      const payable = rows[0]
      if (payable.status === 'paid') {
        await connection.commit()
        return { payable: normalizePayable({ ...payable, due_date: normalizeDateOnly(payable.due_date), paid_at: mysqlDateTimeToIso(payable.paid_at), created_at: mysqlDateTimeToIso(payable.created_at) }), already_paid: true }
      }
      const entryId = randomUUID()
      const paidDate = getStudioDate()
      await connection.query(`INSERT INTO financial_entries (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id)
        VALUES (?, 'expense', ?, ?, ?, ?, 'Não informado', 'payable_payment', ?)
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, [entryId, `Pagamento: ${payable.description}`, payable.category, Number(payable.amount_cents), paidDate, payable.id])
      const [entryRows] = await connection.query("SELECT id FROM financial_entries WHERE source_type = 'payable_payment' AND source_id = ? LIMIT 1", [payable.id])
      const savedEntryId = entryRows[0]?.id ?? entryId
      await connection.query("UPDATE payables SET status = 'paid', paid_at = UTC_TIMESTAMP(), expense_entry_id = ? WHERE id = ?", [savedEntryId, payable.id])
      await connection.commit()
      const [updatedRows] = await this.pool.query('SELECT * FROM payables WHERE id = ? LIMIT 1', [id])
      return { payable: normalizePayable({ ...updatedRows[0], due_date: normalizeDateOnly(updatedRows[0].due_date), paid_at: mysqlDateTimeToIso(updatedRows[0].paid_at), created_at: mysqlDateTimeToIso(updatedRows[0].created_at) }), already_paid: false }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally { connection.release() }
  }

  async deletePayable(id) {
    const [rows] = await this.pool.query('SELECT status FROM payables WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('PAYABLE_NOT_FOUND')
    if (rows[0].status === 'paid') throw new Error('PAID_PAYABLE_PROTECTED')
    const [result] = await this.pool.query("DELETE FROM payables WHERE id = ? AND status = 'pending'", [id])
    if (!result.affectedRows) throw new Error('PAYABLE_NOT_FOUND')
    return { success: true }
  }

  async createService(input) {
    const valid = prepareNewService(input)
    const [existing] = await this.pool.query('SELECT slug, sort_order FROM services')
    const slug = uniqueServiceSlug(valid.name, existing)
    const id = randomUUID()
    const sortOrder = Math.max(0, ...existing.map((item) => Number(item.sort_order) || 0)) + 10
    await this.pool.query(
      'INSERT INTO services (id, slug, name, category, description, duration_minutes, price_cents, deposit_percent, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, slug, valid.name, valid.category, valid.description, valid.duration_minutes, valid.price_cents, valid.deposit_percent, valid.active ? 1 : 0, sortOrder],
    )
    const [rows] = await this.pool.query('SELECT * FROM services WHERE id = ? LIMIT 1', [id])
    return normalizeSqlService(rows[0])
  }

  async deleteService(id) {
    const [rows] = await this.pool.query('SELECT id FROM services WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('SERVICE_NOT_FOUND')
    const [[appointmentRows], [promotionRows]] = await Promise.all([
      this.pool.query('SELECT COUNT(*) AS total FROM appointments WHERE service_id = ?', [id]),
      this.pool.query('SELECT COUNT(*) AS total FROM promotion_items WHERE service_id = ?', [id]),
    ])
    if (Number(appointmentRows[0]?.total) > 0 || Number(promotionRows[0]?.total) > 0) throw new Error('SERVICE_IN_USE')
    const [result] = await this.pool.query('DELETE FROM services WHERE id = ?', [id])
    if (!result.affectedRows) throw new Error('SERVICE_NOT_FOUND')
    return { success: true }
  }

  async updateService(id, values) {
    const [rows] = await this.pool.query('SELECT * FROM services WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('SERVICE_NOT_FOUND')
    const next = { ...normalizeSqlService(rows[0]), ...values }
    validateServiceUpdate(next)
    await this.pool.query(`UPDATE services SET name = ?, category = ?, description = ?, duration_minutes = ?, price_cents = ?, deposit_percent = ?, active = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?`, [
      String(next.name).trim(), String(next.category ?? '').trim().slice(0, 100), String(next.description ?? '').trim().slice(0, 1000), Number(next.duration_minutes), Number(next.price_cents), Number(next.deposit_percent), next.active ? 1 : 0, id,
    ])
    const [updated] = await this.pool.query('SELECT * FROM services WHERE id = ? LIMIT 1', [id])
    return normalizeSqlService(updated[0])
  }

  async saveHours(hours) {
    validateBusinessHours(hours)
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      for (const hour of hours) {
        await connection.query(`INSERT INTO business_hours (weekday, enabled, start_time, end_time, break_start, break_end)
          VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), start_time = VALUES(start_time), end_time = VALUES(end_time), break_start = VALUES(break_start), break_end = VALUES(break_end), updated_at = UTC_TIMESTAMP()`, [
          Number(hour.weekday), hour.enabled ? 1 : 0, hour.enabled ? hour.start_time : null, hour.enabled ? hour.end_time : null,
          hour.enabled && hour.break_start ? hour.break_start : null, hour.enabled && hour.break_end ? hour.break_end : null,
        ])
      }
      await connection.commit()
      return hours
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async savePolicies(input) {
    const policies = validatePolicies(input)
    await this.pool.query('UPDATE business_policies SET lateness_tolerance_minutes = ?, cancellation_notice_hours = ?, companion_policy = ?, no_show_policy = ?, show_lateness_policy = ?, show_cancellation_policy = ?, show_companion_policy = ?, show_no_show_policy = ?, updated_at = UTC_TIMESTAMP() WHERE singleton = 1', [
      policies.lateness_tolerance_minutes, policies.cancellation_notice_hours, policies.companion_policy, policies.no_show_policy,
      policies.show_lateness_policy ? 1 : 0, policies.show_cancellation_policy ? 1 : 0, policies.show_companion_policy ? 1 : 0, policies.show_no_show_policy ? 1 : 0,
    ])
    return this.getPolicies()
  }

  async createBlock(input) {
    const valid = validateBlock(input)
    const id = randomUUID()
    try {
      await this.pool.query('INSERT INTO date_blocks (id, blocked_date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)', [id, valid.blocked_date, valid.start_time, valid.end_time, valid.note])
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('BLOCK_ALREADY_EXISTS')
      throw error
    }
    const [rows] = await this.pool.query('SELECT * FROM date_blocks WHERE id = ? LIMIT 1', [id])
    return { ...rows[0], blocked_date: String(rows[0].blocked_date).slice(0, 10), created_at: mysqlDateTimeToIso(rows[0].created_at) }
  }

  async removeBlock(id) {
    const [result] = await this.pool.query('DELETE FROM date_blocks WHERE id = ?', [id])
    if (!result.affectedRows) throw new Error('BLOCK_NOT_FOUND')
    return { success: true }
  }
}

function normalizeSqlService(service) {
  const { deposit_required: _legacyDepositFlag, ...clean } = service
  return {
    ...clean,
    duration_minutes: Number(service.duration_minutes),
    price_cents: Number(service.price_cents),
    deposit_percent: Number(service.deposit_percent),
    active: Boolean(service.active),
    sort_order: Number(service.sort_order ?? 0),
    created_at: mysqlDateTimeToIso(service.created_at),
    updated_at: mysqlDateTimeToIso(service.updated_at),
  }
}

export async function createStorage(env, projectRoot) {
  const mysqlRequested = Boolean(env.DB_HOST || env.DB_USER || env.DB_NAME || env.DB_PASSWORD)
  const hasMysql = Boolean(env.DB_HOST && env.DB_USER && env.DB_NAME && env.DB_PASSWORD)
  if (mysqlRequested && !hasMysql) throw new Error('Incomplete MySQL configuration. Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME together.')
  if (hasMysql) {
    const mysql = await import('mysql2/promise')
    const pool = mysql.createPool({
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER,
      password: env.DB_PASSWORD || '',
      database: env.DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(env.DB_CONNECTION_LIMIT || 5),
      queueLimit: 0,
      timezone: 'Z',
      dateStrings: true,
      charset: 'utf8mb4',
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
    const store = new MySqlStore(pool)
    await store.init()
    return store
  }
  if (env.NODE_ENV === 'production') throw new Error('MySQL is required in production. Configure DB_HOST, DB_USER, DB_NAME and DB_PASSWORD.')
  const filePath = path.join(projectRoot, 'data', 'local-db.json')
  const includeDemoServices = String(env.P18_TEST_FIXTURES ?? '').toLowerCase() === 'true'
  const store = new LocalJsonStore(filePath, { includeDemoServices })
  await store.init()
  return store
}
