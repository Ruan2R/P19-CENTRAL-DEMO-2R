import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { developmentProfessionals, developmentServices } from './dev-seed.mjs'
import { buildAvailableSlots, timeToMinutes } from './domain/availability.mjs'
import { addDateDays, getBusinessClock, getBusinessDate, getWeekday, localDateTimeToUtc, mysqlUtcDateTime, utcDateTimeToLocalParts } from './domain/business-time.mjs'
import { validateBookingRequest } from './domain/booking-validation.mjs'
import { validateCustomerInput, validateCustomerName, validateFinancialEntryInput, validateFinanceMonth, validatePayableInput } from './domain/admin-data-validation.mjs'
import { bookingGroupEndEpoch, calculatePromotionalPricing, formatPromotion, isBookingGroupReceivable, validatePromotionInput } from './domain/promotions.mjs'

const ACTIVE_GROUP_STATUS = 'confirmed'
const ANY_PROFESSIONAL_ID = 'sem-preferencia'

const DEFAULT_HOURS = {
  1: { weekday: 1, enabled: true, openTime: '13:30', closeTime: '20:00', breakStart: null, breakEnd: null },
  2: { weekday: 2, enabled: true, openTime: '09:00', closeTime: '20:00', breakStart: null, breakEnd: null },
  3: { weekday: 3, enabled: true, openTime: '09:00', closeTime: '20:00', breakStart: null, breakEnd: null },
  4: { weekday: 4, enabled: true, openTime: '09:00', closeTime: '20:00', breakStart: null, breakEnd: null },
  5: { weekday: 5, enabled: true, openTime: '09:00', closeTime: '20:00', breakStart: null, breakEnd: null },
  6: { weekday: 6, enabled: true, openTime: '09:00', closeTime: '17:00', breakStart: null, breakEnd: null },
}

function initialLocalData() {
  return {
    schemaVersion: 1,
    services: developmentServices.map((service, sortOrder) => ({ ...service, sortOrder })),
    professionals: developmentProfessionals.map((professional, sortOrder) => ({ ...professional, sortOrder })),
    businessHours: structuredClone(DEFAULT_HOURS),
    dateBlocks: [],
    professionalBlocks: [],
    customers: [],
    bookingGroups: [],
    bookingItems: [],
    financialEntries: [],
    payables: [],
    promotions: [],
  }
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value))
}

function overlaps(startA, durationA, startB, durationB) {
  return startA < startB + durationB && startA + durationA > startB
}

function durationBetween(startTime, endTime) {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime)
  if (duration <= 0) throw new Error('INVALID_BLOCK_RANGE')
  return duration
}

function makePublicCode() {
  return randomBytes(5).toString('hex').slice(0, 10).toUpperCase()
}

function formatService(service) {
  return {
    id: String(service.id),
    name: String(service.name),
    durationMinutes: Number(service.durationMinutes ?? service.duration_minutes),
    priceCents: Number(service.priceCents ?? service.price_cents),
    active: Boolean(service.active),
  }
}

function formatProfessional(professional) {
  return {
    id: String(professional.id),
    name: String(professional.name),
    role: String(professional.role),
    active: Boolean(professional.active),
  }
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

function slugify(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'item'
}

function uniqueSlug(items, value, exceptId = null) {
  const base = slugify(value)
  const used = new Set(items.filter((item) => item.id !== exceptId).map((item) => String(item.slug ?? item.id)))
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) candidate = `${base}-${suffix++}`
  return candidate
}

function parseServiceInput(payload = {}) {
  const name = String(payload.name ?? '').trim()
  const durationMinutes = Number(payload.durationMinutes)
  const priceCents = Number(payload.priceCents)
  if (name.length < 2 || name.length > 120) throw new Error('INVALID_SERVICE_NAME')
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) throw new Error('INVALID_SERVICE_DURATION')
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 1_000_000) throw new Error('INVALID_SERVICE_PRICE')
  return { name, durationMinutes, priceCents }
}

function parseProfessionalInput(payload = {}) {
  const name = String(payload.name ?? '').trim()
  const role = String(payload.role ?? '').trim()
  if (name.length < 2 || name.length > 100) throw new Error('INVALID_PROFESSIONAL_NAME')
  if (role.length < 2 || role.length > 80) throw new Error('INVALID_PROFESSIONAL_ROLE')
  return { name, role }
}

function isValidTimeInput(value) {
  try { timeToMinutes(String(value)); return true } catch { return false }
}

function parseHoursInput(weekday, payload = {}) {
  const day = Number(weekday)
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('INVALID_WEEKDAY')
  const enabled = Boolean(payload.enabled)
  if (!enabled) return { weekday: day, enabled: false, openTime: null, closeTime: null, breakStart: null, breakEnd: null }
  const openTime = String(payload.openTime ?? '')
  const closeTime = String(payload.closeTime ?? '')
  const breakStart = String(payload.breakStart ?? '').trim() || null
  const breakEnd = String(payload.breakEnd ?? '').trim() || null
  if (!isValidTimeInput(openTime) || !isValidTimeInput(closeTime) || timeToMinutes(closeTime) <= timeToMinutes(openTime)) throw new Error('INVALID_BUSINESS_HOURS')
  if (Boolean(breakStart) !== Boolean(breakEnd)) throw new Error('INVALID_BUSINESS_BREAK')
  if (breakStart && breakEnd) {
    if (!isValidTimeInput(breakStart) || !isValidTimeInput(breakEnd) || timeToMinutes(breakEnd) <= timeToMinutes(breakStart) || timeToMinutes(breakStart) < timeToMinutes(openTime) || timeToMinutes(breakEnd) > timeToMinutes(closeTime)) throw new Error('INVALID_BUSINESS_BREAK')
  }
  return { weekday: day, enabled: true, openTime, closeTime, breakStart, breakEnd }
}

function parseBlockInput(payload = {}) {
  const date = String(payload.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID_BLOCK_DATE')
  const blockDate = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(blockDate.getTime()) || blockDate.toISOString().slice(0, 10) !== date) throw new Error('INVALID_BLOCK_DATE')
  if (date < getBusinessDate()) throw new Error('INVALID_BLOCK_DATE')
  if (!['business', 'professional'].includes(payload.scope)) throw new Error('INVALID_BLOCK_SCOPE')
  const scope = payload.scope
  const professionalId = scope === 'professional' ? String(payload.professionalId ?? '') : null
  if (scope === 'professional' && !professionalId) throw new Error('INVALID_BLOCK_PROFESSIONAL')
  const startTime = String(payload.startTime ?? '').trim() || null
  const endTime = String(payload.endTime ?? '').trim() || null
  if (Boolean(startTime) !== Boolean(endTime)) throw new Error('INVALID_BLOCK_RANGE')
  if (scope === 'professional' && !startTime) throw new Error('INVALID_BLOCK_RANGE')
  if (startTime && (!isValidTimeInput(startTime) || !isValidTimeInput(endTime) || timeToMinutes(endTime) <= timeToMinutes(startTime))) throw new Error('INVALID_BLOCK_RANGE')
  const reason = String(payload.reason ?? '').trim().slice(0, 160)
  return { scope, professionalId, date, startTime, endTime, reason }
}

function checkLocalBlockConflicts(data, block) {
  const start = block.startTime ? timeToMinutes(block.startTime) : 0
  const duration = block.startTime ? timeToMinutes(block.endTime) - start : 24 * 60
  const activeGroupIds = new Set(data.bookingGroups.filter((group) => group.bookingDate === block.date && group.status === 'confirmed').map((group) => group.id))
  const hasConflict = data.bookingItems.some((item) => {
    if (!activeGroupIds.has(item.bookingGroupId) || item.date !== block.date) return false
    if (block.scope === 'professional' && item.professionalId !== block.professionalId) return false
    return overlaps(start, duration, timeToMinutes(item.startTime), Number(item.durationMinutes))
  })
  if (hasConflict) throw new Error('BLOCK_CONFLICTS_WITH_BOOKING')
}

function formatStoredGroup(data, group) {
  const customer = data.customers.find((item) => item.id === group.customerId)
  const items = data.bookingItems
    .filter((item) => item.bookingGroupId === group.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      serviceName: item.serviceNameSnapshot,
      professionalId: item.professionalId,
      professionalName: item.professionalNameSnapshot,
      time: item.startTime,
      durationMinutes: Number(item.durationMinutes),
      priceCents: Number(item.priceCents),
      promotionName: item.promotionNameSnapshot ?? null,
    }))
  return {
    id: group.id,
    publicCode: group.publicCode,
    date: group.bookingDate,
    status: group.status,
    customer: customer ? { name: customer.name, whatsapp: customer.phoneNormalized } : null,
    items,
    totalPriceCents: Number(group.totalPriceCents),
    whatsappConfirmationMarkedAt: group.whatsappConfirmationMarkedAt ?? null,
    whatsappConfirmationMarkedBy: group.whatsappConfirmationMarkedBy ?? null,
    createdAt: group.createdAt,
  }
}

function makeAdminAgendaResponse(date, sourceGroups, { professionalId = 'all', status = 'all' } = {}) {
  const groups = sourceGroups
    .filter((group) => status === 'all' || group.status === status)
    .filter((group) => professionalId === 'all' || group.items.some((item) => item.professionalId === professionalId))
    .sort((a, b) => (a.items[0]?.time ?? '').localeCompare(b.items[0]?.time ?? ''))
  const count = (value) => groups.filter((group) => group.status === value).length
  return {
    date,
    summary: {
      total: groups.length,
      confirmed: count('confirmed'),
      cancelled: count('cancelled'),
      completed: count('completed'),
      noShow: count('no_show'),
      revenueCents: groups.filter((group) => group.status === 'confirmed').reduce((sum, group) => sum + Number(group.totalPriceCents || 0), 0),
    },
    bookingGroups: groups,
  }
}

function customerSummary(data, customer) {
  const groups = data.bookingGroups.filter((group) => group.customerId === customer.id)
  const dates = groups.map((group) => String(group.bookingDate)).sort()
  return {
    id: customer.id,
    name: customer.name,
    whatsapp: customer.phoneNormalized,
    createdAt: customer.createdAt,
    appointmentCount: groups.length,
    noShowCount: groups.filter((group) => group.status === 'no_show').length,
    lastAppointmentDate: dates.at(-1) ?? null,
  }
}

function formatStorageTimestamp(value, fallback = null) {
  if (!value) return fallback
  if (value instanceof Date) return value.toISOString()
  const text = String(value)
  if (text.includes('T')) return text
  return mysqlDateTimeToIso(text)
}

function formatFinancialEntry(entry) {
  return {
    id: String(entry.id), direction: entry.direction, description: String(entry.description), category: String(entry.category),
    amountCents: Number(entry.amountCents ?? entry.amount_cents),
    movementDate: String(entry.movementDate ?? entry.movement_date).slice(0, 10),
    paymentMethod: String(entry.paymentMethod ?? entry.payment_method ?? 'Não informado'),
    sourceType: String(entry.sourceType ?? entry.source_type ?? 'manual'),
    sourceId: entry.sourceId ?? entry.source_id ?? null,
    createdAt: formatStorageTimestamp(entry.createdAt ?? entry.created_at, new Date().toISOString()),
  }
}

function formatPayable(payable) {
  return {
    id: String(payable.id), description: String(payable.description), category: String(payable.category),
    amountCents: Number(payable.amountCents ?? payable.amount_cents),
    dueDate: String(payable.dueDate ?? payable.due_date).slice(0, 10), status: String(payable.status),
    paidAt: formatStorageTimestamp(payable.paidAt ?? payable.paid_at, null),
    expenseEntryId: payable.expenseEntryId ?? payable.expense_entry_id ?? null,
    createdAt: formatStorageTimestamp(payable.createdAt ?? payable.created_at, new Date().toISOString()),
  }
}

function groupIsUpcoming(group, now = new Date()) {
  if (group.status !== 'confirmed') return false
  const clock = getBusinessClock(now)
  if (group.date > clock.date) return true
  if (group.date < clock.date) return false
  const lastEnd = group.items.reduce((latest, item) => Math.max(latest, timeToMinutes(item.time) + Number(item.durationMinutes)), 0)
  return lastEnd > clock.minutes
}

function filterAdminBookingGroups(groups, filter = 'upcoming') {
  let result = groups
  if (filter === 'upcoming') result = result.filter((group) => groupIsUpcoming(group))
  else if (filter === 'pending') result = result.filter((group) => group.status === 'confirmed' && !group.whatsappConfirmationMarkedAt)
  return result.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.items[0]?.time ?? '').localeCompare(b.items[0]?.time ?? ''))
}

function financePayload(data, month) {
  const validMonth = validateFinanceMonth(month)
  const entries = data.financialEntries.filter((entry) => String(entry.movementDate).startsWith(validMonth)).slice()
    .sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.createdAt.localeCompare(a.createdAt)).map(formatFinancialEntry)
  const payables = data.payables.slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
    return a.dueDate.localeCompare(b.dueDate)
  }).map(formatPayable)
  const recordedGroupIds = new Set(data.financialEntries
    .filter((entry) => entry.sourceType === 'booking_receipt' && entry.sourceId)
    .map((entry) => String(entry.sourceId)))
  const receivables = data.bookingGroups
    .map((group) => formatStoredGroup(data, group))
    .filter((group) => !recordedGroupIds.has(String(group.id)) && isBookingGroupReceivable(group))
    .map((group) => ({
      id: group.id,
      publicCode: group.publicCode,
      date: group.date,
      customerName: group.customer?.name ?? 'Cliente',
      itemSummary: group.items.map((item) => item.serviceName).join(' · '),
      totalPriceCents: group.totalPriceCents,
      status: group.status,
      endsAt: bookingGroupEndEpoch(group) == null ? null : new Date(bookingGroupEndEpoch(group)).toISOString(),
    }))
    .sort((a, b) => String(a.endsAt ?? '').localeCompare(String(b.endsAt ?? '')))
  return { month: validMonth, entries, payables, receivables }
}

function assertNoInternalOverlap(items) {
  const withDuration = items.map((item) => ({ ...item, start: timeToMinutes(item.time) }))
  for (let index = 0; index < withDuration.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < withDuration.length; otherIndex += 1) {
      const first = withDuration[index]
      const second = withDuration[otherIndex]
      if (overlaps(first.start, first.durationMinutes, second.start, second.durationMinutes)) {
        throw new Error('PROCEDURES_OVERLAP')
      }
    }
  }
}

function busyIntervalsForLocal(data, date, professionalId) {
  const activeGroupIds = new Set(data.bookingGroups
    .filter((group) => group.bookingDate === date && group.status === ACTIVE_GROUP_STATUS)
    .map((group) => group.id))
  const busyIntervals = data.bookingItems
    .filter((item) => activeGroupIds.has(item.bookingGroupId) && item.professionalId === professionalId && item.date === date)
    .map((item) => ({ startTime: item.startTime, durationMinutes: Number(item.durationMinutes) }))

  const blockedIntervals = data.professionalBlocks
    .filter((block) => block.date === date && block.professionalId === professionalId)
    .map((block) => ({ startTime: block.startTime, durationMinutes: Number(block.durationMinutes) }))

  for (const block of data.dateBlocks.filter((item) => item.date === date)) {
    if (!block.startTime || !block.endTime) {
      blockedIntervals.push({ startTime: '00:00', durationMinutes: 24 * 60 })
    } else {
      blockedIntervals.push({ startTime: block.startTime, durationMinutes: durationBetween(block.startTime, block.endTime) })
    }
  }

  return { busyIntervals, blockedIntervals }
}

function availableSlotsForLocal(data, service, professional, date, now = new Date()) {
  const hours = data.businessHours[String(getWeekday(date))]
  if (!hours?.enabled) return []
  const { busyIntervals, blockedIntervals } = busyIntervalsForLocal(data, date, professional.id)
  if (hours.breakStart && hours.breakEnd) {
    blockedIntervals.push({ startTime: hours.breakStart, durationMinutes: durationBetween(hours.breakStart, hours.breakEnd) })
  }
  const clock = getBusinessClock(now)
  return buildAvailableSlots({
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    durationMinutes: Number(service.durationMinutes),
    busyIntervals,
    blockedIntervals,
    isToday: date === clock.date,
    nowMinutes: clock.minutes,
  })
}

function resolveLocalAvailability(data, serviceId, professionalId, date) {
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(String(date))) throw new Error('INVALID_BOOKING_DATE')
  const service = data.services.find((item) => item.id === serviceId && item.active)
  if (!service) throw new Error('SERVICE_NOT_AVAILABLE')
  const activeProfessionals = data.professionals.filter((item) => item.active).sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
  if (!activeProfessionals.length) return { service: formatService(service), professionalId, slots: [] }

  if (professionalId === ANY_PROFESSIONAL_ID) {
    const byTime = new Map()
    for (const professional of activeProfessionals) {
      for (const time of availableSlotsForLocal(data, service, professional, date)) {
        if (!byTime.has(time)) byTime.set(time, { time, professionalId: professional.id, professionalName: professional.name })
      }
    }
    return { service: formatService(service), professionalId, slots: [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time)) }
  }

  const professional = activeProfessionals.find((item) => item.id === professionalId)
  if (!professional) throw new Error('PROFESSIONAL_NOT_AVAILABLE')
  return {
    service: formatService(service),
    professionalId,
    professionalName: professional.name,
    slots: availableSlotsForLocal(data, service, professional, date).map((time) => ({ time, professionalId: professional.id, professionalName: professional.name })),
  }
}

class LocalJsonStore {
  constructor(filePath) {
    this.filePath = filePath
    this.mode = 'local-json'
    this.data = null
    this.mutationQueue = Promise.resolve()
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      const content = await readFile(this.filePath, 'utf8')
      this.data = JSON.parse(content)
      this.data.services ??= []
      this.data.professionals ??= []
      this.data.businessHours ??= structuredClone(DEFAULT_HOURS)
      this.data.dateBlocks ??= []
      this.data.professionalBlocks ??= []
      this.data.customers ??= []
      this.data.bookingGroups ??= []
      this.data.bookingItems ??= []
      this.data.financialEntries ??= []
      this.data.payables ??= []
      this.data.promotions ??= []
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error(`Não foi possível ler o banco local: ${error.message}`)
      this.data = initialLocalData()
      await this.persist(this.data)
    }
    return this
  }

  async persist(data) {
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.filePath)
  }

  async mutate(mutator) {
    const run = async () => {
      const draft = structuredClone(this.data)
      const result = await mutator(draft)
      await this.persist(draft)
      this.data = draft
      return result
    }
    const current = this.mutationQueue.then(run, run)
    this.mutationQueue = current.catch(() => {})
    return current
  }

  async getPublicServices() {
    return this.data.services.filter((item) => item.active).sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)).map(formatService)
  }

  async getPublicProfessionals() {
    return this.data.professionals.filter((item) => item.active).sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)).map(formatProfessional)
  }

  async getPublicPromotions() {
    const services = this.data.services.map(formatService)
    return { promotions: this.data.promotions.filter((item) => item.active).map((item) => formatPromotion(item, services)) }
  }

  async getAdminPromotions() {
    const services = this.data.services.slice().sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)).map(formatService)
    return { services, promotions: this.data.promotions.slice().sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.name.localeCompare(b.name, 'pt-BR')).map((item) => formatPromotion(item, services)) }
  }

  async savePromotion(id, payload) {
    return this.mutate((data) => {
      const existing = id ? data.promotions.find((item) => item.id === id) : null
      if (id && !existing) throw new Error('PROMOTION_NOT_FOUND')
      const services = data.services.map(formatService)
      const input = validatePromotionInput(payload, { services, promotions: data.promotions, exceptId: id })
      const now = new Date().toISOString()
      if (existing) Object.assign(existing, input, { updatedAt: now })
      else data.promotions.push({ id: randomUUID(), ...input, createdAt: now, updatedAt: now })
      const saved = existing ?? data.promotions[data.promotions.length - 1]
      return formatPromotion(saved, services)
    })
  }

  async getAvailableSlots(serviceId, professionalId, date) {
    return resolveLocalAvailability(this.data, serviceId, professionalId, date)
  }

  async createBookingGroup(payload) {
    return this.mutate((data) => {
      const input = validateBookingRequest(payload)
      const normalized = input.items.map((item) => {
        const service = data.services.find((row) => row.id === item.serviceId && row.active)
        if (!service) throw new Error('SERVICE_NOT_AVAILABLE')
        return { ...item, service: formatService(service), durationMinutes: Number(service.durationMinutes) }
      })
      assertNoInternalOverlap(normalized)

      const activeProfessionals = data.professionals.filter((item) => item.active).sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
      const assignedItems = []
      for (const item of normalized) {
        const candidates = item.professionalId === ANY_PROFESSIONAL_ID
          ? activeProfessionals
          : activeProfessionals.filter((person) => person.id === item.professionalId)
        if (!candidates.length) throw new Error('PROFESSIONAL_NOT_AVAILABLE')
        let assigned = null
        for (const candidate of candidates) {
          const slots = availableSlotsForLocal(data, data.services.find((row) => row.id === item.serviceId), candidate, input.date)
          const busyInThisGroup = assignedItems.some((other) => other.professionalId === candidate.id && overlaps(timeToMinutes(item.time), item.durationMinutes, timeToMinutes(other.time), other.durationMinutes))
          if (slots.includes(item.time) && !busyInThisGroup) {
            assigned = candidate
            break
          }
        }
        if (!assigned) throw new Error('SLOT_TAKEN')
        assignedItems.push({ ...item, professional: formatProfessional(assigned) })
      }

      let customer = data.customers.find((item) => item.phoneNormalized === input.customerPhone)
      const now = new Date().toISOString()
      if (!customer) {
        customer = { id: randomUUID(), name: input.customerName, phoneNormalized: input.customerPhone, createdAt: now, updatedAt: now }
        data.customers.push(customer)
      } else {
        customer.name = input.customerName
        customer.updatedAt = now
      }

      const groupId = randomUUID()
      const pricing = calculatePromotionalPricing(assignedItems.map((item) => ({ id: item.service.id, name: item.service.name, priceCents: item.service.priceCents })), data.promotions.map((promo) => formatPromotion(promo, data.services.map(formatService))), input.date)
      for (const item of assignedItems) {
        item.priceCents = Number(pricing.prices[item.service.id] ?? item.service.priceCents)
        item.promotionNameSnapshot = pricing.promotionNames[item.service.id] ?? null
      }
      const group = {
        id: groupId,
        publicCode: makePublicCode(),
        customerId: customer.id,
        bookingDate: input.date,
        status: ACTIVE_GROUP_STATUS,
        totalPriceCents: assignedItems.reduce((sum, item) => sum + item.priceCents, 0),
        whatsappConfirmationMarkedAt: null,
        whatsappConfirmationMarkedBy: null,
        createdAt: now,
        updatedAt: now,
        cancelledAt: null,
      }
      data.bookingGroups.push(group)
      for (const item of assignedItems) {
        const start = timeToMinutes(item.time)
        data.bookingItems.push({
          id: randomUUID(),
          bookingGroupId: groupId,
          serviceId: item.service.id,
          professionalId: item.professional.id,
          serviceNameSnapshot: item.service.name,
          professionalNameSnapshot: item.professional.name,
          priceCents: item.priceCents,
          promotionNameSnapshot: item.promotionNameSnapshot,
          durationMinutes: item.durationMinutes,
          date: input.date,
          startTime: item.time,
          endTime: minutesToTimeSafe(start + item.durationMinutes),
          createdAt: now,
        })
      }
      return formatStoredGroup(data, group)
    })
  }
  async getAdminAgenda(date, filters = {}) {
    const groups = this.data.bookingGroups
      .filter((group) => group.bookingDate === date)
      .map((group) => formatStoredGroup(this.data, group))
    return makeAdminAgendaResponse(date, groups, filters)
  }

  async updateBookingGroupStatus(groupId, status) {
    return this.mutate((data) => {
      const group = data.bookingGroups.find((item) => item.id === groupId)
      if (!group) throw new Error('BOOKING_GROUP_NOT_FOUND')
      if (group.status !== 'confirmed') throw new Error('BOOKING_GROUP_NOT_ACTIONABLE')
      if (!['cancelled', 'completed', 'no_show'].includes(status)) throw new Error('INVALID_STATUS')
      const now = new Date().toISOString()
      group.status = status
      group.updatedAt = now
      if (status === 'cancelled') group.cancelledAt = now
      if (status === 'completed') group.completedAt = now
      return formatStoredGroup(data, group)
    })
  }

  async markWhatsAppConfirmationSent(groupId, adminId) {
    return this.mutate((data) => {
      const group = data.bookingGroups.find((item) => item.id === groupId)
      if (!group) throw new Error('BOOKING_GROUP_NOT_FOUND')
      if (group.status !== 'confirmed') throw new Error('BOOKING_GROUP_NOT_ACTIONABLE')
      group.whatsappConfirmationMarkedAt = new Date().toISOString()
      group.whatsappConfirmationMarkedBy = String(adminId || 'ADMIN').slice(0, 40)
      group.updatedAt = group.whatsappConfirmationMarkedAt
      return formatStoredGroup(data, group)
    })
  }

  async getAdminBookingGroups(filter = 'upcoming') {
    const groups = this.data.bookingGroups.map((group) => formatStoredGroup(this.data, group))
    return { bookingGroups: filterAdminBookingGroups(groups, filter) }
  }

  async getAdminCustomers(search = '') {
    const query = String(search ?? '').trim().toLocaleLowerCase('pt-BR')
    const digits = query.replace(/\D/g, '')
    const customers = this.data.customers
      .filter((customer) => !query || `${customer.name} ${customer.phoneNormalized}`.toLocaleLowerCase('pt-BR').includes(query) || (digits && customer.phoneNormalized.includes(digits)))
      .map((customer) => customerSummary(this.data, customer))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return { customers }
  }

  async getAdminCustomerHistory(customerId) {
    const customer = this.data.customers.find((item) => item.id === customerId)
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    const bookingGroups = this.data.bookingGroups.filter((group) => group.customerId === customerId)
      .map((group) => formatStoredGroup(this.data, group))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.items[0]?.time ?? '').localeCompare(a.items[0]?.time ?? ''))
    return { customer: customerSummary(this.data, customer), bookingGroups }
  }

  async createCustomer(payload) {
    const input = validateCustomerInput(payload)
    return this.mutate((data) => {
      if (data.customers.some((item) => item.phoneNormalized === input.phoneNormalized)) throw new Error('CUSTOMER_PHONE_ALREADY_EXISTS')
      const now = new Date().toISOString()
      const customer = { id: randomUUID(), ...input, createdAt: now, updatedAt: now }
      data.customers.push(customer)
      return customerSummary(data, customer)
    })
  }

  async updateCustomer(id, payload) {
    const name = validateCustomerName(payload)
    return this.mutate((data) => {
      const customer = data.customers.find((item) => item.id === id)
      if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
      customer.name = name
      customer.updatedAt = new Date().toISOString()
      return customerSummary(data, customer)
    })
  }

  async getAdminFinance(month) { return financePayload(this.data, month) }

  async createFinancialEntry(payload) {
    const input = validateFinancialEntryInput(payload)
    return this.mutate((data) => {
      const entry = { id: randomUUID(), ...input, sourceType: 'manual', sourceId: null, createdAt: new Date().toISOString() }
      data.financialEntries.push(entry)
      return formatFinancialEntry(entry)
    })
  }

  async recordBookingReceipt(groupId, paymentMethod) {
    const validMethod = String(paymentMethod ?? 'Não informado').trim() || 'Não informado'
    if (!['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro'].includes(validMethod)) throw new Error('INVALID_PAYMENT_METHOD')
    return this.mutate((data) => {
      const group = data.bookingGroups.find((item) => item.id === groupId)
      if (!group) throw new Error('BOOKING_GROUP_NOT_FOUND')
      const existing = data.financialEntries.find((entry) => entry.sourceType === 'booking_receipt' && String(entry.sourceId) === String(groupId))
      if (existing) return { entry: formatFinancialEntry(existing), alreadyReceived: true }
      const formatted = formatStoredGroup(data, group)
      if (!isBookingGroupReceivable(formatted)) throw new Error('BOOKING_RECEIPT_NOT_ELIGIBLE')
      const now = new Date().toISOString()
      const entry = { id: randomUUID(), direction: 'income', description: `Recebimento do atendimento ${group.publicCode} — ${formatted.customer?.name ?? 'Cliente'}`, category: 'Atendimentos', amountCents: Number(group.totalPriceCents), movementDate: getBusinessDate(), paymentMethod: validMethod, sourceType: 'booking_receipt', sourceId: group.id, createdAt: now }
      data.financialEntries.push(entry)
      return { entry: formatFinancialEntry(entry), alreadyReceived: false }
    })
  }

  async deleteFinancialEntry(id) {
    return this.mutate((data) => {
      const index = data.financialEntries.findIndex((item) => item.id === id)
      if (index < 0) throw new Error('FINANCIAL_ENTRY_NOT_FOUND')
      if (data.financialEntries[index].sourceType !== 'manual') throw new Error('FINANCIAL_ENTRY_PROTECTED')
      data.financialEntries.splice(index, 1)
      return { success: true }
    })
  }

  async createPayable(payload) {
    const input = validatePayableInput(payload)
    return this.mutate((data) => {
      const payable = { id: randomUUID(), ...input, status: 'pending', paidAt: null, expenseEntryId: null, createdAt: new Date().toISOString() }
      data.payables.push(payable)
      return formatPayable(payable)
    })
  }

  async markPayablePaid(id) {
    return this.mutate((data) => {
      const payable = data.payables.find((item) => item.id === id)
      if (!payable) throw new Error('PAYABLE_NOT_FOUND')
      if (payable.status === 'paid') return { payable: formatPayable(payable), alreadyPaid: true }
      const now = new Date().toISOString()
      const entry = { id: randomUUID(), direction: 'expense', description: `Pagamento: ${payable.description}`, category: payable.category,
        amountCents: payable.amountCents, movementDate: getBusinessDate(), paymentMethod: 'Não informado',
        sourceType: 'payable_payment', sourceId: payable.id, createdAt: now }
      data.financialEntries.push(entry)
      payable.status = 'paid'; payable.paidAt = now; payable.expenseEntryId = entry.id
      return { payable: formatPayable(payable), alreadyPaid: false }
    })
  }

  async deletePayable(id) {
    return this.mutate((data) => {
      const index = data.payables.findIndex((item) => item.id === id)
      if (index < 0) throw new Error('PAYABLE_NOT_FOUND')
      if (data.payables[index].status === 'paid') throw new Error('PAID_PAYABLE_PROTECTED')
      data.payables.splice(index, 1)
      return { success: true }
    })
  }

  async getAdminConfiguration() {
    const services = this.data.services.slice().sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)).map(formatService)
    const professionals = this.data.professionals.slice().sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)).map(formatProfessional)
    const businessHours = WEEKDAY_NAMES.map((name, weekday) => {
      const row = this.data.businessHours[String(weekday)]
      return row ? { ...row, weekday, name, enabled: Boolean(row.enabled) } : { weekday, name, enabled: false, openTime: '', closeTime: '', breakStart: null, breakEnd: null }
    })
    return { services, professionals, businessHours }
  }

  async createService(payload) {
    const input = parseServiceInput(payload)
    return this.mutate((data) => {
      const now = new Date().toISOString()
      const slug = uniqueSlug(data.services, input.name)
      const service = { id: slug, slug, ...input, active: true, sortOrder: data.services.length, createdAt: now, updatedAt: now }
      data.services.push(service)
      return formatService(service)
    })
  }

  async updateService(id, payload) {
    const input = parseServiceInput(payload)
    return this.mutate((data) => {
      const service = data.services.find((item) => item.id === id)
      if (!service) throw new Error('SERVICE_NOT_FOUND')
      Object.assign(service, input, { updatedAt: new Date().toISOString() })
      return formatService(service)
    })
  }

  async setServiceActive(id, active) {
    return this.mutate((data) => {
      const service = data.services.find((item) => item.id === id)
      if (!service) throw new Error('SERVICE_NOT_FOUND')
      if (!active && service.active && data.services.filter((item) => item.active).length <= 1) throw new Error('LAST_ACTIVE_SERVICE')
      service.active = Boolean(active)
      service.updatedAt = new Date().toISOString()
      return formatService(service)
    })
  }

  async createProfessional(payload) {
    const input = parseProfessionalInput(payload)
    return this.mutate((data) => {
      const now = new Date().toISOString()
      const slug = uniqueSlug(data.professionals, input.name)
      const professional = { id: slug, slug, ...input, active: true, sortOrder: data.professionals.length, createdAt: now, updatedAt: now }
      data.professionals.push(professional)
      return formatProfessional(professional)
    })
  }

  async updateProfessional(id, payload) {
    const input = parseProfessionalInput(payload)
    return this.mutate((data) => {
      const professional = data.professionals.find((item) => item.id === id)
      if (!professional) throw new Error('PROFESSIONAL_NOT_FOUND')
      Object.assign(professional, input, { updatedAt: new Date().toISOString() })
      return formatProfessional(professional)
    })
  }

  async setProfessionalActive(id, active) {
    return this.mutate((data) => {
      const professional = data.professionals.find((item) => item.id === id)
      if (!professional) throw new Error('PROFESSIONAL_NOT_FOUND')
      if (!active && professional.active && data.professionals.filter((item) => item.active).length <= 1) throw new Error('LAST_ACTIVE_PROFESSIONAL')
      professional.active = Boolean(active)
      professional.updatedAt = new Date().toISOString()
      return formatProfessional(professional)
    })
  }

  async updateBusinessHours(weekday, payload) {
    const hours = parseHoursInput(weekday, payload)
    return this.mutate((data) => {
      if (hours.enabled) data.businessHours[String(hours.weekday)] = hours
      else delete data.businessHours[String(hours.weekday)]
      return { ...hours, name: WEEKDAY_NAMES[hours.weekday] }
    })
  }

  async getAdminBlocks(date) {
    const dateBlocks = this.data.dateBlocks.filter((item) => item.date === date).map((item) => ({ id: item.id, scope: 'business', date: item.date, startTime: item.startTime ?? null, endTime: item.endTime ?? null, reason: item.reason ?? '' }))
    const professionalBlocks = this.data.professionalBlocks.filter((item) => item.date === date).map((item) => ({ id: item.id, scope: 'professional', professionalId: item.professionalId, professionalName: this.data.professionals.find((pro) => pro.id === item.professionalId)?.name ?? 'Profissional', date: item.date, startTime: item.startTime, endTime: item.endTime, reason: item.reason ?? '' }))
    return [...dateBlocks, ...professionalBlocks].sort((a, b) => String(a.startTime ?? '').localeCompare(String(b.startTime ?? '')))
  }

  async createAdminBlock(payload) {
    const input = parseBlockInput(payload)
    return this.mutate((data) => {
      if (input.scope === 'professional' && !data.professionals.some((item) => item.id === input.professionalId && item.active)) throw new Error('INVALID_BLOCK_PROFESSIONAL')
      checkLocalBlockConflicts(data, input)
      const block = { id: randomUUID(), ...input, createdAt: new Date().toISOString() }
      if (input.scope === 'business') data.dateBlocks.push(block)
      else data.professionalBlocks.push({ ...block, durationMinutes: timeToMinutes(input.endTime) - timeToMinutes(input.startTime) })
      return { ...block, professionalName: data.professionals.find((item) => item.id === input.professionalId)?.name ?? null }
    })
  }

  async deleteAdminBlock(id) {
    return this.mutate((data) => {
      const dateIndex = data.dateBlocks.findIndex((item) => item.id === id)
      if (dateIndex >= 0) { data.dateBlocks.splice(dateIndex, 1); return { id } }
      const professionalIndex = data.professionalBlocks.findIndex((item) => item.id === id)
      if (professionalIndex >= 0) { data.professionalBlocks.splice(professionalIndex, 1); return { id } }
      throw new Error('BLOCK_NOT_FOUND')
    })
  }
}

function minutesToTimeSafe(minutes) {
  if (minutes >= 24 * 60) throw new Error('INVALID_BLOCK_RANGE')
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function mysqlDateTimeToIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const valueString = String(value)
  return new Date(`${valueString.replace(' ', 'T')}Z`).toISOString()
}

function mysqlTime(value) {
  if (!value) return null
  return String(value).slice(0, 5)
}

function sqlService(row) {
  return { ...formatService({ ...row, durationMinutes: row.duration_minutes, priceCents: row.price_cents }), ...(row.slug ? { slug: String(row.slug) } : {}) }
}

function sqlProfessional(row) {
  return { ...formatProfessional(row), ...(row.slug ? { slug: String(row.slug) } : {}) }
}

async function loadSqlBookingGroups(pool, { whereSql = '', params = [], limit = 2000 } = {}) {
  const safeLimit = Math.min(5000, Math.max(1, Number(limit) || 2000))
  const [groupRows] = await pool.query(
    `SELECT bg.id, bg.public_code AS publicCode, DATE_FORMAT(bg.booking_date, '%Y-%m-%d') AS bookingDate,
      bg.status, bg.total_price_cents AS totalPriceCents, bg.whatsapp_confirmation_marked_at AS whatsappConfirmationMarkedAt,
      bg.whatsapp_confirmation_marked_by AS whatsappConfirmationMarkedBy, bg.created_at AS createdAt,
      c.name AS customerName, c.phone_normalized AS customerWhatsapp
     FROM booking_groups bg JOIN customers c ON c.id = bg.customer_id
     ${whereSql}
     ORDER BY bg.booking_date ASC, bg.created_at ASC LIMIT ${safeLimit}`,
    params,
  )
  const ids = groupRows.map((row) => row.id)
  let itemRows = []
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await pool.query(
      `SELECT id, booking_group_id AS bookingGroupId, service_id AS serviceId, professional_id AS professionalId,
        service_name_snapshot AS serviceName, professional_name_snapshot AS professionalName, promotion_name_snapshot AS promotionName, price_cents AS priceCents,
        duration_minutes AS durationMinutes, starts_at AS startsAt
       FROM booking_items WHERE booking_group_id IN (${placeholders}) ORDER BY starts_at ASC`, ids)
    itemRows = rows
  }
  const itemsByGroup = new Map()
  for (const row of itemRows) {
    const local = utcDateTimeToLocalParts(new Date(`${String(row.startsAt).replace(' ', 'T')}Z`))
    const items = itemsByGroup.get(row.bookingGroupId) ?? []
    items.push({ id: row.id, serviceId: row.serviceId, serviceName: row.serviceName, professionalId: row.professionalId,
      professionalName: row.professionalName, time: local.time, durationMinutes: Number(row.durationMinutes), priceCents: Number(row.priceCents), promotionName: row.promotionName ?? null })
    itemsByGroup.set(row.bookingGroupId, items)
  }
  return groupRows.map((row) => ({ id: row.id, publicCode: row.publicCode, date: String(row.bookingDate).slice(0, 10), status: row.status,
    customer: { name: row.customerName, whatsapp: row.customerWhatsapp }, items: itemsByGroup.get(row.id) ?? [], totalPriceCents: Number(row.totalPriceCents),
    whatsappConfirmationMarkedAt: mysqlDateTimeToIso(row.whatsappConfirmationMarkedAt), whatsappConfirmationMarkedBy: row.whatsappConfirmationMarkedBy ?? null,
    createdAt: mysqlDateTimeToIso(row.createdAt) }))
}

async function loadSqlPromotions(executor) {
  const [[promotionRows], [serviceRows], [linkRows]] = await Promise.all([
    executor.query("SELECT id, name, kind, DATE_FORMAT(starts_on, '%Y-%m-%d') AS startsOn, DATE_FORMAT(ends_on, '%Y-%m-%d') AS endsOn, active, promo_price_cents AS promoPriceCents, created_at AS createdAt, updated_at AS updatedAt FROM promotions ORDER BY starts_on DESC, name"),
    executor.query('SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services'),
    executor.query('SELECT promotion_id AS promotionId, service_id AS serviceId FROM promotion_services'),
  ])
  const services = serviceRows.map((row) => ({ id: String(row.id), name: String(row.name), durationMinutes: Number(row.durationMinutes), priceCents: Number(row.priceCents), active: Boolean(row.active) }))
  return promotionRows.map((row) => formatPromotion({ ...row, active: Boolean(row.active), promoPriceCents: Number(row.promoPriceCents), serviceIds: linkRows.filter((link) => String(link.promotionId) === String(row.id)).map((link) => String(link.serviceId)) }, services))
}

class MySqlStore {
  constructor(pool) {
    this.pool = pool
    this.mode = 'mysql'
  }

  async init() {
    await this.pool.query('SELECT 1 FROM services LIMIT 0')
    await this.pool.query('SELECT 1 FROM professionals LIMIT 0')
    await this.pool.query('SELECT 1 FROM business_hours LIMIT 0')
    await this.pool.query('SELECT 1 FROM booking_groups LIMIT 0')
    await this.pool.query('SELECT 1 FROM booking_items LIMIT 0')
    await this.pool.query('SELECT 1 FROM booking_mutex WHERE id = 1')
    await this.pool.query('SELECT 1 FROM financial_entries LIMIT 0')
    await this.pool.query('SELECT 1 FROM payables LIMIT 0')
    await this.pool.query('SELECT 1 FROM promotions LIMIT 0')
    await this.pool.query('SELECT 1 FROM promotion_services LIMIT 0')
    return this
  }

  async getPublicServices(executor = this.pool) {
    const [rows] = await executor.query('SELECT id, name, duration_minutes, price_cents, active FROM services WHERE active = 1 ORDER BY sort_order, name')
    return rows.map(sqlService)
  }

  async getPublicProfessionals(executor = this.pool) {
    const [rows] = await executor.query('SELECT id, name, role, active FROM professionals WHERE active = 1 ORDER BY sort_order, name')
    return rows.map(sqlProfessional)
  }

  async getPublicPromotions(executor = this.pool) {
    return { promotions: (await loadSqlPromotions(executor)).filter((promotion) => promotion.active) }
  }

  async getAdminPromotions() {
    const [services, promotions] = await Promise.all([this.getAdminConfiguration().then((data) => data.services), loadSqlPromotions(this.pool)])
    return { services, promotions }
  }

  async savePromotion(id, payload) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.query('SELECT id FROM promotions FOR UPDATE')
      const [serviceRows] = await connection.query('SELECT id, name, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services ORDER BY sort_order, name')
      const services = serviceRows.map((service) => ({ ...service, active: Boolean(service.active), durationMinutes: Number(service.durationMinutes), priceCents: Number(service.priceCents) }))
      const promotions = await loadSqlPromotions(connection)
      const existing = id ? promotions.find((item) => item.id === id) : null
      if (id && !existing) throw new Error('PROMOTION_NOT_FOUND')
      const input = validatePromotionInput(payload, { services, promotions, exceptId: id })
      const promotionId = id ?? randomUUID()
      if (existing) {
        await connection.query('UPDATE promotions SET name = ?, kind = ?, starts_on = ?, ends_on = ?, active = ?, promo_price_cents = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [input.name, input.kind, input.startsOn, input.endsOn, input.active ? 1 : 0, input.promoPriceCents, promotionId])
        await connection.query('DELETE FROM promotion_services WHERE promotion_id = ?', [promotionId])
      } else {
        await connection.query('INSERT INTO promotions (id, name, kind, starts_on, ends_on, active, promo_price_cents) VALUES (?, ?, ?, ?, ?, ?, ?)', [promotionId, input.name, input.kind, input.startsOn, input.endsOn, input.active ? 1 : 0, input.promoPriceCents])
      }
      for (const serviceId of input.serviceIds) await connection.query('INSERT INTO promotion_services (promotion_id, service_id) VALUES (?, ?)', [promotionId, serviceId])
      await connection.commit()
      const fresh = (await loadSqlPromotions(this.pool)).find((item) => item.id === promotionId)
      if (!fresh) throw new Error('PROMOTION_NOT_FOUND')
      return fresh
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  }

  async availabilityContext(executor, date, professionalId) {
    const weekday = getWeekday(date)
    const [[hourRows], [dayBlockRows], [proBlockRows], [bookingRows]] = await Promise.all([
      executor.query("SELECT enabled, TIME_FORMAT(start_time, '%H:%i') AS openTime, TIME_FORMAT(end_time, '%H:%i') AS closeTime, TIME_FORMAT(break_start, '%H:%i') AS breakStart, TIME_FORMAT(break_end, '%H:%i') AS breakEnd FROM business_hours WHERE weekday = ? LIMIT 1", [weekday]),
      executor.query("SELECT TIME_FORMAT(start_time, '%H:%i') AS startTime, TIME_FORMAT(end_time, '%H:%i') AS endTime FROM date_blocks WHERE blocked_date = ?", [date]),
      executor.query("SELECT TIME_FORMAT(start_time, '%H:%i') AS startTime, TIME_FORMAT(end_time, '%H:%i') AS endTime FROM professional_blocks WHERE blocked_date = ? AND professional_id = ?", [date, professionalId]),
      executor.query("SELECT bi.starts_at, bi.duration_minutes FROM booking_items bi JOIN booking_groups bg ON bg.id = bi.booking_group_id WHERE bg.booking_date = ? AND bg.status = 'confirmed' AND bi.professional_id = ?", [date, professionalId]),
    ])
    const hours = hourRows[0]
    if (!hours || !hours.enabled || !hours.openTime || !hours.closeTime) return { hours: null, busyIntervals: [], blockedIntervals: [] }
    const blockedIntervals = []
    for (const block of dayBlockRows) {
      if (!block.startTime || !block.endTime) blockedIntervals.push({ startTime: '00:00', durationMinutes: 24 * 60 })
      else blockedIntervals.push({ startTime: block.startTime, durationMinutes: durationBetween(block.startTime, block.endTime) })
    }
    for (const block of proBlockRows) {
      blockedIntervals.push({ startTime: block.startTime, durationMinutes: durationBetween(block.startTime, block.endTime) })
    }
    if (hours.breakStart && hours.breakEnd) blockedIntervals.push({ startTime: hours.breakStart, durationMinutes: durationBetween(hours.breakStart, hours.breakEnd) })
    const busyIntervals = bookingRows.map((row) => {
      const local = utcDateTimeToLocalParts(new Date(`${String(row.starts_at).replace(' ', 'T')}Z`))
      return { startTime: local.time, durationMinutes: Number(row.duration_minutes) }
    })
    return { hours, busyIntervals, blockedIntervals }
  }

  async slotsFromContext(service, professional, date, context, now = new Date()) {
    if (!context.hours) return []
    const clock = getBusinessClock(now)
    return buildAvailableSlots({
      openTime: context.hours.openTime,
      closeTime: context.hours.closeTime,
      durationMinutes: Number(service.durationMinutes),
      busyIntervals: context.busyIntervals,
      blockedIntervals: context.blockedIntervals,
      isToday: date === clock.date,
      nowMinutes: clock.minutes,
    }).map((time) => ({ time, professionalId: professional.id, professionalName: professional.name }))
  }

  async getAvailableSlots(serviceId, professionalId, date) {
    const services = await this.getPublicServices()
    const service = services.find((item) => item.id === serviceId)
    if (!service) throw new Error('SERVICE_NOT_AVAILABLE')
    const professionals = await this.getPublicProfessionals()
    if (professionalId === ANY_PROFESSIONAL_ID) {
      const byTime = new Map()
      for (const professional of professionals) {
        const context = await this.availabilityContext(this.pool, date, professional.id)
        for (const slot of await this.slotsFromContext(service, professional, date, context)) {
          if (!byTime.has(slot.time)) byTime.set(slot.time, slot)
        }
      }
      return { service, professionalId, slots: [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time)) }
    }
    const professional = professionals.find((item) => item.id === professionalId)
    if (!professional) throw new Error('PROFESSIONAL_NOT_AVAILABLE')
    const context = await this.availabilityContext(this.pool, date, professional.id)
    return { service, professionalId, professionalName: professional.name, slots: await this.slotsFromContext(service, professional, date, context) }
  }

  async createBookingGroup(payload) {
    const input = validateBookingRequest(payload)
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      // One shared row serializes competing booking requests while conflicts are checked and rows inserted.
      await connection.query('SELECT id FROM booking_mutex WHERE id = 1 FOR UPDATE')
      const services = await this.getPublicServices(connection)
      const professionals = await this.getPublicProfessionals(connection)
      const normalized = input.items.map((item) => {
        const service = services.find((row) => row.id === item.serviceId)
        if (!service) throw new Error('SERVICE_NOT_AVAILABLE')
        return { ...item, service, durationMinutes: service.durationMinutes }
      })
      assertNoInternalOverlap(normalized)

      const assignedItems = []
      for (const item of normalized) {
        const candidates = item.professionalId === ANY_PROFESSIONAL_ID
          ? professionals
          : professionals.filter((person) => person.id === item.professionalId)
        if (!candidates.length) throw new Error('PROFESSIONAL_NOT_AVAILABLE')
        let assigned = null
        for (const candidate of candidates) {
          const context = await this.availabilityContext(connection, input.date, candidate.id)
          const slots = await this.slotsFromContext(item.service, candidate, input.date, context)
          const busyInThisGroup = assignedItems.some((other) => other.professionalId === candidate.id && overlaps(timeToMinutes(item.time), item.durationMinutes, timeToMinutes(other.time), other.durationMinutes))
          if (slots.some((slot) => slot.time === item.time) && !busyInThisGroup) {
            assigned = candidate
            break
          }
        }
        if (!assigned) throw new Error('SLOT_TAKEN')
        assignedItems.push({ ...item, professional: assigned })
      }

      const customerId = randomUUID()
      await connection.query(
        'INSERT INTO customers (id, name, phone_normalized) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = UTC_TIMESTAMP()',
        [customerId, input.customerName, input.customerPhone],
      )
      const [customerRows] = await connection.query('SELECT id, name, phone_normalized FROM customers WHERE phone_normalized = ? LIMIT 1 FOR UPDATE', [input.customerPhone])
      if (!customerRows.length) throw new Error('CUSTOMER_NOT_FOUND')
      const customer = customerRows[0]
      const pricing = calculatePromotionalPricing(assignedItems.map((item) => ({ id: item.service.id, name: item.service.name, priceCents: item.service.priceCents })), (await loadSqlPromotions(connection)).filter((promo) => promo.active), input.date)
      for (const item of assignedItems) {
        item.priceCents = Number(pricing.prices[item.service.id] ?? item.service.priceCents)
        item.promotionNameSnapshot = pricing.promotionNames[item.service.id] ?? null
      }
      const groupId = randomUUID()
      const publicCode = makePublicCode()
      const createdAt = new Date()
      const totalPriceCents = assignedItems.reduce((sum, item) => sum + item.priceCents, 0)
      await connection.query(
        "INSERT INTO booking_groups (id, public_code, customer_id, booking_date, status, total_price_cents, created_at, updated_at) VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?)",
        [groupId, publicCode, customer.id, input.date, totalPriceCents, mysqlUtcDateTime(createdAt), mysqlUtcDateTime(createdAt)],
      )
      const returnedItems = []
      for (const item of assignedItems) {
        const startUtc = localDateTimeToUtc(input.date, item.time)
        const endUtc = new Date(startUtc.getTime() + item.durationMinutes * 60_000)
        const itemId = randomUUID()
        await connection.query(
          'INSERT INTO booking_items (id, booking_group_id, service_id, professional_id, service_name_snapshot, professional_name_snapshot, promotion_name_snapshot, price_cents, duration_minutes, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [itemId, groupId, item.service.id, item.professional.id, item.service.name, item.professional.name, item.promotionNameSnapshot, item.priceCents, item.durationMinutes, mysqlUtcDateTime(startUtc), mysqlUtcDateTime(endUtc), mysqlUtcDateTime(createdAt)],
        )
        returnedItems.push({ id: itemId, serviceId: item.service.id, serviceName: item.service.name, professionalId: item.professional.id, professionalName: item.professional.name, time: item.time, durationMinutes: item.durationMinutes, priceCents: item.priceCents, promotionName: item.promotionNameSnapshot })
      }
      await connection.commit()
      return { id: groupId, publicCode, date: input.date, status: ACTIVE_GROUP_STATUS, customer: { name: customer.name, whatsapp: customer.phone_normalized }, items: returnedItems, totalPriceCents, createdAt: createdAt.toISOString() }
    } catch (error) {
      await connection.rollback()
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('SLOT_TAKEN')
      throw error
    } finally {
      connection.release()
    }
  }

  async getAdminAgenda(date, filters = {}) {
    const groups = await loadSqlBookingGroups(this.pool, { whereSql: 'WHERE bg.booking_date = ?', params: [date] })
    return makeAdminAgendaResponse(date, groups, filters)
  }

  async updateBookingGroupStatus(groupId, status) {
    if (!['cancelled', 'completed', 'no_show'].includes(status)) throw new Error('INVALID_STATUS')
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT status FROM booking_groups WHERE id = ? FOR UPDATE', [groupId])
      if (!rows.length) throw new Error('BOOKING_GROUP_NOT_FOUND')
      if (rows[0].status !== 'confirmed') throw new Error('BOOKING_GROUP_NOT_ACTIONABLE')
      const now = mysqlUtcDateTime(new Date())
      await connection.query(
        `UPDATE booking_groups SET status = ?, updated_at = ?,
          cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END,
          completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END WHERE id = ?`,
        [status, now, status, now, status, now, groupId],
      )
      await connection.commit()
      return { id: groupId, status }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async markWhatsAppConfirmationSent(groupId, adminId) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT status FROM booking_groups WHERE id = ? FOR UPDATE', [groupId])
      if (!rows.length) throw new Error('BOOKING_GROUP_NOT_FOUND')
      if (rows[0].status !== 'confirmed') throw new Error('BOOKING_GROUP_NOT_ACTIONABLE')
      const now = mysqlUtcDateTime(new Date())
      await connection.query(
        'UPDATE booking_groups SET whatsapp_confirmation_marked_at = ?, whatsapp_confirmation_marked_by = ?, updated_at = ? WHERE id = ?',
        [now, String(adminId || 'ADMIN').slice(0, 80), now, groupId],
      )
      await connection.commit()
      return { id: groupId, whatsappConfirmationMarkedAt: new Date().toISOString(), whatsappConfirmationMarkedBy: String(adminId || 'ADMIN').slice(0, 80) }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async getAdminConfiguration() {
    const [[serviceRows], [professionalRows], [hoursRows]] = await Promise.all([
      this.pool.query('SELECT id, slug, name, duration_minutes, price_cents, active, sort_order FROM services ORDER BY sort_order, name'),
      this.pool.query('SELECT id, slug, name, role, active, sort_order FROM professionals ORDER BY sort_order, name'),
      this.pool.query("SELECT weekday, enabled, TIME_FORMAT(start_time, '%H:%i') AS openTime, TIME_FORMAT(end_time, '%H:%i') AS closeTime, TIME_FORMAT(break_start, '%H:%i') AS breakStart, TIME_FORMAT(break_end, '%H:%i') AS breakEnd FROM business_hours ORDER BY weekday"),
    ])
    const byDay = new Map(hoursRows.map((row) => [Number(row.weekday), { weekday: Number(row.weekday), enabled: Boolean(row.enabled), openTime: row.openTime ?? '', closeTime: row.closeTime ?? '', breakStart: row.breakStart ?? null, breakEnd: row.breakEnd ?? null, name: WEEKDAY_NAMES[Number(row.weekday)] }]))
    const businessHours = WEEKDAY_NAMES.map((name, weekday) => byDay.get(weekday) ?? { weekday, name, enabled: false, openTime: '', closeTime: '', breakStart: null, breakEnd: null })
    return { services: serviceRows.map(sqlService), professionals: professionalRows.map(sqlProfessional), businessHours }
  }

  async createService(payload) {
    const input = parseServiceInput(payload)
    const id = randomUUID()
    const slug = uniqueSlug((await this.getAdminConfiguration()).services, input.name)
    const [[countRows]] = await Promise.all([this.pool.query('SELECT COALESCE(MAX(sort_order), 0) + 10 AS nextOrder FROM services')])
    await this.pool.query('INSERT INTO services (id, slug, name, duration_minutes, price_cents, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)', [id, slug, input.name, input.durationMinutes, input.priceCents, Number(countRows[0]?.nextOrder ?? 10)])
    return { id, name: input.name, durationMinutes: input.durationMinutes, priceCents: input.priceCents, active: true }
  }

  async updateService(id, payload) {
    const input = parseServiceInput(payload)
    const [result] = await this.pool.query('UPDATE services SET name = ?, duration_minutes = ?, price_cents = ? WHERE id = ?', [input.name, input.durationMinutes, input.priceCents, id])
    if (!result.affectedRows) {
      const [rows] = await this.pool.query('SELECT id FROM services WHERE id = ? LIMIT 1', [id])
      if (!rows.length) throw new Error('SERVICE_NOT_FOUND')
    }
    const [rows] = await this.pool.query('SELECT id, name, duration_minutes, price_cents, active FROM services WHERE id = ? LIMIT 1', [id])
    return sqlService(rows[0])
  }

  async setServiceActive(id, active) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT id, active FROM services WHERE id = ? FOR UPDATE', [id])
      if (!rows.length) throw new Error('SERVICE_NOT_FOUND')
      if (!active && Boolean(rows[0].active)) {
        const [counts] = await connection.query('SELECT COUNT(*) AS total FROM services WHERE active = 1')
        if (Number(counts[0].total) <= 1) throw new Error('LAST_ACTIVE_SERVICE')
      }
      await connection.query('UPDATE services SET active = ? WHERE id = ?', [active ? 1 : 0, id])
      await connection.commit()
      const [updated] = await this.pool.query('SELECT id, name, duration_minutes, price_cents, active FROM services WHERE id = ? LIMIT 1', [id])
      return sqlService(updated[0])
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  }

  async createProfessional(payload) {
    const input = parseProfessionalInput(payload)
    const id = randomUUID()
    const existing = (await this.getAdminConfiguration()).professionals
    const slug = uniqueSlug(existing, input.name)
    const [countRows] = await this.pool.query('SELECT COALESCE(MAX(sort_order), 0) + 10 AS nextOrder FROM professionals')
    await this.pool.query('INSERT INTO professionals (id, slug, name, role, active, sort_order) VALUES (?, ?, ?, ?, 1, ?)', [id, slug, input.name, input.role, Number(countRows[0]?.nextOrder ?? 10)])
    return { id, name: input.name, role: input.role, active: true }
  }

  async updateProfessional(id, payload) {
    const input = parseProfessionalInput(payload)
    const [result] = await this.pool.query('UPDATE professionals SET name = ?, role = ? WHERE id = ?', [input.name, input.role, id])
    if (!result.affectedRows) {
      const [rows] = await this.pool.query('SELECT id FROM professionals WHERE id = ? LIMIT 1', [id])
      if (!rows.length) throw new Error('PROFESSIONAL_NOT_FOUND')
    }
    const [rows] = await this.pool.query('SELECT id, name, role, active FROM professionals WHERE id = ? LIMIT 1', [id])
    return sqlProfessional(rows[0])
  }

  async setProfessionalActive(id, active) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT id, active FROM professionals WHERE id = ? FOR UPDATE', [id])
      if (!rows.length) throw new Error('PROFESSIONAL_NOT_FOUND')
      if (!active && Boolean(rows[0].active)) {
        const [counts] = await connection.query('SELECT COUNT(*) AS total FROM professionals WHERE active = 1')
        if (Number(counts[0].total) <= 1) throw new Error('LAST_ACTIVE_PROFESSIONAL')
      }
      await connection.query('UPDATE professionals SET active = ? WHERE id = ?', [active ? 1 : 0, id])
      await connection.commit()
      const [updated] = await this.pool.query('SELECT id, name, role, active FROM professionals WHERE id = ? LIMIT 1', [id])
      return sqlProfessional(updated[0])
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  }

  async updateBusinessHours(weekday, payload) {
    const hours = parseHoursInput(weekday, payload)
    await this.pool.query(
      `INSERT INTO business_hours (weekday, enabled, start_time, end_time, break_start, break_end) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), start_time = VALUES(start_time), end_time = VALUES(end_time), break_start = VALUES(break_start), break_end = VALUES(break_end)`,
      [hours.weekday, hours.enabled ? 1 : 0, hours.openTime, hours.closeTime, hours.breakStart, hours.breakEnd],
    )
    return { ...hours, name: WEEKDAY_NAMES[hours.weekday] }
  }

  async getAdminBlocks(date) {
    const [[dateRows], [professionalRows]] = await Promise.all([
      this.pool.query("SELECT id, DATE_FORMAT(blocked_date, '%Y-%m-%d') AS date, TIME_FORMAT(start_time, '%H:%i') AS startTime, TIME_FORMAT(end_time, '%H:%i') AS endTime, reason FROM date_blocks WHERE blocked_date = ? ORDER BY start_time", [date]),
      this.pool.query("SELECT pb.id, pb.professional_id AS professionalId, p.name AS professionalName, DATE_FORMAT(pb.blocked_date, '%Y-%m-%d') AS date, TIME_FORMAT(pb.start_time, '%H:%i') AS startTime, TIME_FORMAT(pb.end_time, '%H:%i') AS endTime, pb.reason FROM professional_blocks pb JOIN professionals p ON p.id = pb.professional_id WHERE pb.blocked_date = ? ORDER BY pb.start_time, p.name", [date]),
    ])
    return [
      ...dateRows.map((row) => ({ ...row, scope: 'business' })),
      ...professionalRows.map((row) => ({ ...row, scope: 'professional' })),
    ].sort((a, b) => String(a.startTime ?? '').localeCompare(String(b.startTime ?? '')))
  }

  async createAdminBlock(payload) {
    const input = parseBlockInput(payload)
    const id = randomUUID()
    if (input.scope === 'professional') {
      const [pros] = await this.pool.query('SELECT id FROM professionals WHERE id = ? AND active = 1 LIMIT 1', [input.professionalId])
      if (!pros.length) throw new Error('INVALID_BLOCK_PROFESSIONAL')
    }
    const [rows] = await this.pool.query(
      `SELECT bi.professional_id AS professionalId, bi.starts_at AS startsAt, bi.duration_minutes AS durationMinutes
       FROM booking_items bi JOIN booking_groups bg ON bg.id = bi.booking_group_id
       WHERE bg.booking_date = ? AND bg.status = 'confirmed'`, [input.date],
    )
    const blockStart = input.startTime ? timeToMinutes(input.startTime) : 0
    const blockDuration = input.startTime ? timeToMinutes(input.endTime) - blockStart : 24 * 60
    const conflicts = rows.some((row) => {
      if (input.scope === 'professional' && row.professionalId !== input.professionalId) return false
      const local = utcDateTimeToLocalParts(new Date(`${String(row.startsAt).replace(' ', 'T')}Z`))
      return overlaps(blockStart, blockDuration, timeToMinutes(local.time), Number(row.durationMinutes))
    })
    if (conflicts) throw new Error('BLOCK_CONFLICTS_WITH_BOOKING')
    if (input.scope === 'business') {
      await this.pool.query('INSERT INTO date_blocks (id, blocked_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)', [id, input.date, input.startTime, input.endTime, input.reason])
    } else {
      await this.pool.query('INSERT INTO professional_blocks (id, professional_id, blocked_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?, ?)', [id, input.professionalId, input.date, input.startTime, input.endTime, input.reason])
    }
    const [pros] = input.professionalId ? await this.pool.query('SELECT name FROM professionals WHERE id = ? LIMIT 1', [input.professionalId]) : [[]]
    return { id, ...input, professionalName: pros[0]?.name ?? null, createdAt: new Date().toISOString() }
  }

  async deleteAdminBlock(id) {
    const [proResult] = await this.pool.query('DELETE FROM professional_blocks WHERE id = ?', [id])
    const [dateResult] = await this.pool.query('DELETE FROM date_blocks WHERE id = ?', [id])
    if (!proResult.affectedRows && !dateResult.affectedRows) throw new Error('BLOCK_NOT_FOUND')
    return { id }
  }

  async getAdminBookingGroups(filter = 'upcoming') {
    let whereSql = ''
    let params = []
    if (filter === 'upcoming') {
      whereSql = "WHERE bg.status = 'confirmed' AND bg.booking_date >= ?"
      params = [getBusinessDate()]
    } else if (filter === 'pending') {
      whereSql = "WHERE bg.status = 'confirmed' AND bg.whatsapp_confirmation_marked_at IS NULL"
    }
    const groups = await loadSqlBookingGroups(this.pool, { whereSql, params, limit: filter === 'all' ? 2000 : 1000 })
    return { bookingGroups: filterAdminBookingGroups(groups, filter) }
  }

  async getAdminCustomers(search = '') {
    const query = String(search ?? '').trim()
    const like = `%${query}%`
    const digits = query.replace(/\D/g, '')
    const phoneLike = digits ? `%${digits}%` : ''
    const [rows] = await this.pool.query(
      `SELECT c.id, c.name, c.phone_normalized AS whatsapp,
        DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        COUNT(DISTINCT bg.id) AS appointmentCount,
        COUNT(DISTINCT CASE WHEN bg.status = 'no_show' THEN bg.id END) AS noShowCount,
        DATE_FORMAT(MAX(bg.booking_date), '%Y-%m-%d') AS lastAppointmentDate
       FROM customers c LEFT JOIN booking_groups bg ON bg.customer_id = c.id
       WHERE (? = '' OR c.name LIKE ? OR (? <> '' AND c.phone_normalized LIKE ?))
       GROUP BY c.id, c.name, c.phone_normalized, c.created_at ORDER BY c.name LIMIT 500`,
      [query, like, digits, phoneLike],
    )
    return { customers: rows.map((row) => ({
      id: String(row.id), name: String(row.name), whatsapp: String(row.whatsapp), createdAt: mysqlDateTimeToIso(row.createdAt),
      appointmentCount: Number(row.appointmentCount || 0), noShowCount: Number(row.noShowCount || 0),
      lastAppointmentDate: row.lastAppointmentDate ? String(row.lastAppointmentDate).slice(0, 10) : null,
    })) }
  }

  async getAdminCustomerHistory(customerId) {
    const [rows] = await this.pool.query(
      `SELECT c.id, c.name, c.phone_normalized AS whatsapp,
        DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        COUNT(DISTINCT bg.id) AS appointmentCount,
        COUNT(DISTINCT CASE WHEN bg.status = 'no_show' THEN bg.id END) AS noShowCount,
        DATE_FORMAT(MAX(bg.booking_date), '%Y-%m-%d') AS lastAppointmentDate
       FROM customers c LEFT JOIN booking_groups bg ON bg.customer_id = c.id
       WHERE c.id = ? GROUP BY c.id, c.name, c.phone_normalized, c.created_at LIMIT 1`, [customerId],
    )
    if (!rows.length) throw new Error('CUSTOMER_NOT_FOUND')
    const row = rows[0]
    const customer = { id: String(row.id), name: String(row.name), whatsapp: String(row.whatsapp), createdAt: mysqlDateTimeToIso(row.createdAt),
      appointmentCount: Number(row.appointmentCount || 0), noShowCount: Number(row.noShowCount || 0),
      lastAppointmentDate: row.lastAppointmentDate ? String(row.lastAppointmentDate).slice(0, 10) : null }
    const bookingGroups = await loadSqlBookingGroups(this.pool, { whereSql: 'WHERE bg.customer_id = ?', params: [customerId], limit: 1000 })
    bookingGroups.sort((a, b) => b.date.localeCompare(a.date) || (b.items[0]?.time ?? '').localeCompare(a.items[0]?.time ?? ''))
    return { customer, bookingGroups }
  }

  async createCustomer(payload) {
    const input = validateCustomerInput(payload)
    const id = randomUUID()
    try {
      await this.pool.query('INSERT INTO customers (id, name, phone_normalized) VALUES (?, ?, ?)', [id, input.name, input.phoneNormalized])
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('CUSTOMER_PHONE_ALREADY_EXISTS')
      throw error
    }
    const response = await this.getAdminCustomers(input.phoneNormalized)
    const customer = response.customers.find((item) => item.id === id)
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    return customer
  }

  async updateCustomer(id, payload) {
    const name = validateCustomerName(payload)
    const [result] = await this.pool.query('UPDATE customers SET name = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [name, id])
    if (!result.affectedRows) {
      const [exists] = await this.pool.query('SELECT id FROM customers WHERE id = ? LIMIT 1', [id])
      if (!exists.length) throw new Error('CUSTOMER_NOT_FOUND')
    }
    const response = await this.getAdminCustomers(name)
    const customer = response.customers.find((item) => item.id === id)
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    return customer
  }

  async getAdminFinance(month) {
    const validMonth = validateFinanceMonth(month)
    const [entryRows] = await this.pool.query(
      `SELECT id, direction, description, category, amount_cents AS amountCents,
        DATE_FORMAT(movement_date, '%Y-%m-%d') AS movementDate, payment_method AS paymentMethod,
        source_type AS sourceType, source_id AS sourceId, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM financial_entries WHERE DATE_FORMAT(movement_date, '%Y-%m') = ? ORDER BY movement_date DESC, created_at DESC`, [validMonth],
    )
    const [payableRows] = await this.pool.query(
      `SELECT id, description, category, amount_cents AS amountCents,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate, status,
        DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paidAt, expense_entry_id AS expenseEntryId,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM payables ORDER BY (status = 'pending') DESC, due_date ASC`,
    )
    const groups = await loadSqlBookingGroups(this.pool, { whereSql: "WHERE bg.status IN ('confirmed','completed')", limit: 5000 })
    const [receiptRows] = await this.pool.query("SELECT source_id AS sourceId FROM financial_entries WHERE source_type = 'booking_receipt' AND source_id IS NOT NULL")
    const recordedGroupIds = new Set(receiptRows.map((row) => String(row.sourceId)))
    const receivables = groups.filter((group) => !recordedGroupIds.has(String(group.id)) && isBookingGroupReceivable(group))
      .map((group) => { const epoch = bookingGroupEndEpoch(group); return { id: group.id, publicCode: group.publicCode, date: group.date, customerName: group.customer?.name ?? 'Cliente', itemSummary: group.items.map((item) => item.serviceName).join(' · '), totalPriceCents: group.totalPriceCents, status: group.status, endsAt: epoch == null ? null : new Date(epoch).toISOString() } })
      .sort((a, b) => String(a.endsAt ?? '').localeCompare(String(b.endsAt ?? '')))
    return { month: validMonth, entries: entryRows.map(formatFinancialEntry), payables: payableRows.map(formatPayable), receivables }
  }

  async createFinancialEntry(payload) {
    const input = validateFinancialEntryInput(payload)
    const id = randomUUID()
    await this.pool.query(
      `INSERT INTO financial_entries (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL)`,
      [id, input.direction, input.description, input.category, input.amountCents, input.movementDate, input.paymentMethod],
    )
    const response = await this.getAdminFinance(input.movementDate.slice(0, 7))
    const entry = response.entries.find((item) => item.id === id)
    if (!entry) throw new Error('FINANCIAL_ENTRY_NOT_FOUND')
    return entry
  }

  async recordBookingReceipt(groupId, paymentMethod) {
    const validMethod = String(paymentMethod ?? 'Não informado').trim() || 'Não informado'
    if (!['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro'].includes(validMethod)) throw new Error('INVALID_PAYMENT_METHOD')
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.query('SELECT id FROM booking_groups WHERE id = ? FOR UPDATE', [groupId])
      const groups = await loadSqlBookingGroups(connection, { whereSql: 'WHERE bg.id = ?', params: [groupId], limit: 1 })
      const group = groups[0]
      if (!group) throw new Error('BOOKING_GROUP_NOT_FOUND')
      const [existingRows] = await connection.query("SELECT id, direction, description, category, amount_cents AS amountCents, DATE_FORMAT(movement_date, '%Y-%m-%d') AS movementDate, payment_method AS paymentMethod, source_type AS sourceType, source_id AS sourceId, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt FROM financial_entries WHERE source_type = 'booking_receipt' AND source_id = ? LIMIT 1", [groupId])
      if (existingRows.length) {
        await connection.commit()
        return { entry: formatFinancialEntry(existingRows[0]), alreadyReceived: true }
      }
      if (!isBookingGroupReceivable(group)) throw new Error('BOOKING_RECEIPT_NOT_ELIGIBLE')
      const id = randomUUID()
      const now = mysqlUtcDateTime(new Date())
      await connection.query("INSERT INTO financial_entries (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id, created_at) VALUES (?, 'income', ?, 'Atendimentos', ?, ?, ?, 'booking_receipt', ?, ?)", [id, `Recebimento do atendimento ${group.publicCode} — ${group.customer.name}`, Number(group.totalPriceCents), getBusinessDate(), validMethod, groupId, now])
      await connection.commit()
      const [rows] = await this.pool.query("SELECT id, direction, description, category, amount_cents AS amountCents, DATE_FORMAT(movement_date, '%Y-%m-%d') AS movementDate, payment_method AS paymentMethod, source_type AS sourceType, source_id AS sourceId, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt FROM financial_entries WHERE id = ? LIMIT 1", [id])
      return { entry: formatFinancialEntry(rows[0]), alreadyReceived: false }
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  }

  async deleteFinancialEntry(id) {
    const [rows] = await this.pool.query('SELECT source_type AS sourceType FROM financial_entries WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('FINANCIAL_ENTRY_NOT_FOUND')
    if (rows[0].sourceType !== 'manual') throw new Error('FINANCIAL_ENTRY_PROTECTED')
    await this.pool.query("DELETE FROM financial_entries WHERE id = ? AND source_type = 'manual'", [id])
    return { success: true }
  }

  async createPayable(payload) {
    const input = validatePayableInput(payload)
    const id = randomUUID()
    await this.pool.query("INSERT INTO payables (id, description, category, amount_cents, due_date, status) VALUES (?, ?, ?, ?, ?, 'pending')",
      [id, input.description, input.category, input.amountCents, input.dueDate])
    const response = await this.getAdminFinance(input.dueDate.slice(0, 7))
    const payable = response.payables.find((item) => item.id === id)
    if (!payable) throw new Error('PAYABLE_NOT_FOUND')
    return payable
  }

  async markPayablePaid(id) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query(
        "SELECT id, description, category, amount_cents AS amountCents, DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate, status, DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paidAt, expense_entry_id AS expenseEntryId, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt FROM payables WHERE id = ? LIMIT 1 FOR UPDATE", [id])
      if (!rows.length) throw new Error('PAYABLE_NOT_FOUND')
      const payable = rows[0]
      if (payable.status === 'paid') {
        await connection.commit()
        return { payable: formatPayable(payable), alreadyPaid: true }
      }
      const entryId = randomUUID()
      const paidDate = getBusinessDate()
      const now = mysqlUtcDateTime(new Date())
      await connection.query(
        `INSERT INTO financial_entries (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id, created_at)
         VALUES (?, 'expense', ?, ?, ?, ?, 'Não informado', 'payable_payment', ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [entryId, `Pagamento: ${payable.description}`, payable.category, Number(payable.amountCents), paidDate, id, now],
      )
      const [entryRows] = await connection.query("SELECT id FROM financial_entries WHERE source_type = 'payable_payment' AND source_id = ? LIMIT 1", [id])
      const savedEntryId = entryRows[0]?.id ?? entryId
      await connection.query("UPDATE payables SET status = 'paid', paid_at = ?, expense_entry_id = ? WHERE id = ?", [now, savedEntryId, id])
      await connection.commit()
      const [updatedRows] = await this.pool.query(
        "SELECT id, description, category, amount_cents AS amountCents, DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate, status, DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paidAt, expense_entry_id AS expenseEntryId, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt FROM payables WHERE id = ? LIMIT 1", [id])
      return { payable: formatPayable(updatedRows[0]), alreadyPaid: false }
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  }

  async deletePayable(id) {
    const [rows] = await this.pool.query('SELECT status FROM payables WHERE id = ? LIMIT 1', [id])
    if (!rows.length) throw new Error('PAYABLE_NOT_FOUND')
    if (rows[0].status === 'paid') throw new Error('PAID_PAYABLE_PROTECTED')
    const [result] = await this.pool.query("DELETE FROM payables WHERE id = ? AND status = 'pending'", [id])
    if (!result.affectedRows) throw new Error('PAYABLE_NOT_FOUND')
    return { success: true }
  }

  async close() {
    await this.pool.end()
  }
}

export async function createStorage(env, projectRoot) {
  const mysqlKeys = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD']
  const mysqlRequested = mysqlKeys.some((key) => Boolean(env[key]))
  const mysqlConfigured = mysqlKeys.every((key) => Boolean(env[key]))
  if (mysqlRequested && !mysqlConfigured) throw new Error('Configuração MySQL incompleta. Informe DB_HOST, DB_USER, DB_NAME e DB_PASSWORD.')
  if (mysqlConfigured) {
    const mysql = await import('mysql2/promise')
    const pool = mysql.createPool({
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
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
    try {
      await store.init()
      return store
    } catch (error) {
      await pool.end()
      throw new Error(`Não foi possível inicializar o MySQL do P15. Confira o schema e as migrações: ${error.message}`)
    }
  }
  if (env.NODE_ENV === 'production') throw new Error('MySQL é obrigatório em produção. Configure DB_HOST, DB_USER, DB_NAME e DB_PASSWORD.')
  const filePath = env.P15_LOCAL_DB_PATH ? path.resolve(env.P15_LOCAL_DB_PATH) : path.join(projectRoot, 'data', 'local-db.json')
  const store = new LocalJsonStore(filePath)
  await store.init()
  return store
}
