export const STUDIO_TIME_ZONE = 'America/Campo_Grande'
export const ACTIVE_APPOINTMENT_STATUSES = new Set(['pending_confirmation', 'awaiting_deposit', 'confirmed'])
export const APPOINTMENT_STATUSES = new Set(['pending_confirmation', 'awaiting_deposit', 'confirmed', 'completed', 'cancelled', 'no_show'])

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STUDIO_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

export function getStudioDate(date = new Date()) {
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((item) => [item.type, item.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function addDateDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getWeekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

export function normalizeTime(value) {
  return typeof value === 'string' ? value.slice(0, 5) : ''
}

export function timeToMinutes(value) {
  const normalized = normalizeTime(value)
  if (!/^\d{2}:\d{2}$/.test(normalized)) return NaN
  const [hours, minutes] = normalized.split(':').map(Number)
  if (hours > 23 || minutes > 59) return NaN
  return hours * 60 + minutes
}

export function localDateTimeToUtc(date, time) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = normalizeTime(time).split(':').map(Number)
  const guessedUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const localParts = Object.fromEntries(dateTimeFormatter.formatToParts(new Date(guessedUtc)).map((item) => [item.type, item.value]))
  const localAsUtc = Date.UTC(Number(localParts.year), Number(localParts.month) - 1, Number(localParts.day), Number(localParts.hour), Number(localParts.minute), Number(localParts.second))
  return new Date(guessedUtc - (localAsUtc - guessedUtc))
}

export function mysqlUtcDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

export function mysqlDateTimeToIso(value) {
  if (value instanceof Date) return value.toISOString()
  if (!value) return null
  const text = String(value)
  const normalized = text.includes('T') ? text : `${text.replace(' ', 'T')}Z`
  return new Date(normalized).toISOString()
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}

export function normalizeCustomerName(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const particles = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])
  return text.toLocaleLowerCase('pt-BR').split(' ').map((word, index) => {
    return word.split(/([-'])/).map((part) => {
      if (part === '-' || part === "'") return part
      const lower = part.toLocaleLowerCase('pt-BR')
      if (index > 0 && particles.has(lower)) return lower
      return lower ? lower[0].toLocaleUpperCase('pt-BR') + lower.slice(1) : ''
    }).join('')
  }).join(' ')
}

function localDateTimeParts(value) {
  return Object.fromEntries(dateTimeFormatter.formatToParts(new Date(value)).map((item) => [item.type, item.value]))
}

export function buildAvailableSlots({ service, hours, blocks = [], appointments = [], date, now = new Date() }) {
  if (!service || !service.active || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
  const today = getStudioDate(now)
  if (date < today || date > addDateDays(today, 60)) return []
  const weekday = getWeekday(date)
  const businessHour = hours.find((item) => Number(item.weekday) === weekday)
  if (!businessHour?.enabled || !businessHour.start_time || !businessHour.end_time) return []

  const opening = timeToMinutes(businessHour.start_time)
  const closing = timeToMinutes(businessHour.end_time)
  const duration = Number(service.duration_minutes)
  if (!Number.isFinite(opening) || !Number.isFinite(closing) || !Number.isFinite(duration) || duration <= 0 || opening >= closing) return []

  const breakStart = businessHour.break_start ? timeToMinutes(businessHour.break_start) : null
  const breakEnd = businessHour.break_end ? timeToMinutes(businessHour.break_end) : null
  const dateBlocks = blocks.filter((block) => block.blocked_date === date)
  const activeAppointments = appointments.filter((item) => ACTIVE_APPOINTMENT_STATUSES.has(item.status))
  const candidateMinutes = new Set()

  // Sugestões regulares a cada 15 minutos, contadas a partir da abertura.
  for (let startMinute = opening; startMinute + duration <= closing; startMinute += 15) {
    candidateMinutes.add(startMinute)
  }

  // Se um atendimento termina fora da grade, inclua exatamente o minuto final.
  // Ex.: termina às 13:40 => outro atendimento pode começar às 13:40.
  for (const appointment of activeAppointments) {
    const end = localDateTimeParts(appointment.ends_at)
    if (`${end.year}-${end.month}-${end.day}` !== date) continue
    const endMinute = timeToMinutes(`${end.hour}:${end.minute}`)
    if (Number.isFinite(endMinute)) candidateMinutes.add(endMinute)
  }

  const slots = []
  for (const startMinute of [...candidateMinutes].sort((a, b) => a - b)) {
    const endMinute = startMinute + duration
    if (startMinute < opening || endMinute > closing || startMinute < 0 || startMinute >= 1440) continue
    const hour = String(Math.floor(startMinute / 60)).padStart(2, '0')
    const minute = String(startMinute % 60).padStart(2, '0')
    const slot = `${hour}:${minute}`

    if (breakStart !== null && breakEnd !== null && !(endMinute <= breakStart || startMinute >= breakEnd)) continue

    const startsAt = localDateTimeToUtc(date, slot)
    const endsAt = new Date(startsAt.getTime() + duration * 60_000)
    if (startsAt <= now) continue

    const isBlocked = dateBlocks.some((block) => {
      if (!block.start_time) return true
      const blockStart = localDateTimeToUtc(date, block.start_time)
      const blockEnd = localDateTimeToUtc(date, block.end_time)
      return intervalsOverlap(startsAt, endsAt, blockStart, blockEnd)
    })
    if (isBlocked) continue

    const isTaken = activeAppointments.some((appointment) => {
      const appointmentStart = new Date(appointment.starts_at)
      const appointmentEnd = new Date(appointment.ends_at)
      return intervalsOverlap(startsAt, endsAt, appointmentStart, appointmentEnd)
    })
    if (!isTaken) slots.push(slot)
  }
  return slots
}

export function normalizeBrazilPhone(value) {
  let phone = String(value ?? '').replace(/\D/g, '')
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2)
  return phone
}

export function validateCustomerProfileInput(input) {
  const name = normalizeCustomerName(input.name ?? input.customerName)
  const phone = normalizeBrazilPhone(input.phone ?? input.customerPhone)
  const internalNote = String(input.internal_note ?? input.internalNote ?? '').trim().slice(0, 500)
  if (name.length < 2 || name.length > 100) throw new Error('INVALID_CUSTOMER_NAME')
  if (phone.length < 10 || phone.length > 11) throw new Error('INVALID_CUSTOMER_PHONE')
  return { name, phone, require_deposit: Boolean(input.require_deposit ?? input.requireDeposit), internal_note: internalNote }
}

export function validateBookingInput(input, { requirePolicyAcknowledgement = true, allowMissingPhone = false } = {}) {
  const name = normalizeCustomerName(input.customerName)
  const rawPhone = String(input.customerPhone ?? '').trim()
  const phone = normalizeBrazilPhone(rawPhone)
  const date = String(input.date ?? '')
  const time = normalizeTime(String(input.time ?? ''))
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds.map((value) => String(value ?? '').trim()) : [String(input.serviceId ?? '').trim()]
  const serviceIds = [...new Set(requestedIds.filter(Boolean))]
  const serviceId = serviceIds[0] ?? ''
  const note = String(input.customerNote ?? '').trim().slice(0, 500)

  if (name.length < 2 || name.length > 100) throw new Error('INVALID_CUSTOMER_NAME')
  if (rawPhone.length === 0 ? !allowMissingPhone : phone.length < 10 || phone.length > 11) throw new Error('INVALID_CUSTOMER_PHONE')
  if (!serviceId || serviceIds.length !== requestedIds.filter(Boolean).length || serviceIds.length > 5) throw new Error('SERVICE_NOT_AVAILABLE')
  if (requirePolicyAcknowledgement && input.policyAcknowledged !== true) throw new Error('POLICY_ACKNOWLEDGEMENT_REQUIRED')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('INVALID_BOOKING_DATE')
  const timeMinutes = timeToMinutes(time)
  if (!Number.isFinite(timeMinutes)) throw new Error('INVALID_BOOKING_SLOT')
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('INVALID_BOOKING_DATE')
  const today = getStudioDate()
  if (date < today || date > addDateDays(today, 60)) throw new Error('INVALID_BOOKING_DATE')
  return { customerName: name, customerPhone: phone, customerNote: note || null, date, time, serviceId, serviceIds, policyAcknowledged: input.policyAcknowledged === true }
}

export function buildAppointment({ input, service, policies, id, publicCode, depositRequired = false }) {
  const startsAt = localDateTimeToUtc(input.date, input.time)
  if (startsAt <= new Date()) throw new Error('BOOKING_IN_THE_PAST')
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000)
  if (depositRequired && Number(service.deposit_percent) <= 0) throw new Error('DEPOSIT_NOT_CONFIGURED')
  const depositCents = depositRequired ? Math.round(service.price_cents * service.deposit_percent / 100) : 0
  return {
    id,
    public_code: publicCode,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_note: input.customerNote,
    service_id: service.id,
    promotion_id: null,
    promotion_name: null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    price_cents: service.price_cents,
    regular_price_cents: service.price_cents,
    deposit_cents: depositCents,
    deposit_required: depositRequired,
    deposit_received: false,
    deposit_reported: false,
    policy_acknowledged: input.policyAcknowledged === true,
    policy_acknowledged_at: input.policyAcknowledged === true ? new Date().toISOString() : null,
    policy_snapshot: policies,
    status: depositRequired && service.deposit_percent > 0 ? 'awaiting_deposit' : 'pending_confirmation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    service: { name: service.name, category: service.category, duration_minutes: service.duration_minutes },
  }
}

export function validatePromotionInput(input, services, promotions = [], excludePromotionId = null) {
  const name = String(input.name ?? '').trim()
  const startsOn = String(input.starts_on ?? '')
  const endsOn = String(input.ends_on ?? '')
  const active = input.active !== false
  if (name.length < 2 || name.length > 100) throw new Error('INVALID_PROMOTION_NAME')
  if (!isIsoDate(startsOn) || !isIsoDate(endsOn) || startsOn > endsOn) throw new Error('INVALID_PROMOTION_DATES')
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) throw new Error('INVALID_PROMOTION_ITEMS')

  const serviceById = new Map(services.map((service) => [String(service.id), service]))
  const seen = new Set()
  const items = input.items.map((item) => {
    const serviceId = String(item.service_id ?? '')
    const service = serviceById.get(serviceId)
    const promotionalPrice = Number(item.promotional_price_cents)
    if (!service) throw new Error('PROMOTION_SERVICE_NOT_FOUND')
    if (seen.has(serviceId)) throw new Error('DUPLICATE_PROMOTION_SERVICE')
    seen.add(serviceId)
    if (!Number.isSafeInteger(promotionalPrice) || promotionalPrice <= 0 || promotionalPrice >= Number(service.price_cents)) {
      throw new Error('INVALID_PROMOTION_PRICE')
    }
    return { service_id: serviceId, promotional_price_cents: promotionalPrice }
  })

  if (active) {
    for (const existing of promotions) {
      if (existing.id === excludePromotionId || !existing.active) continue
      const overlapsDates = startsOn <= String(existing.ends_on).slice(0, 10) && endsOn >= String(existing.starts_on).slice(0, 10)
      if (!overlapsDates) continue
      const existingServiceIds = new Set((existing.items ?? []).map((item) => String(item.service_id)))
      if (items.some((item) => existingServiceIds.has(item.service_id))) throw new Error('PROMOTION_SERVICE_DATE_CONFLICT')
    }
  }

  return { name, starts_on: startsOn, ends_on: endsOn, active, items }
}

export function findPromotionPrice(promotions, service, appointmentDate) {
  if (!service || !isIsoDate(appointmentDate)) return null
  const promo = (promotions ?? []).find((promotion) => {
    if (!promotion.active) return false
    if (String(promotion.starts_on).slice(0, 10) > appointmentDate || String(promotion.ends_on).slice(0, 10) < appointmentDate) return false
    const item = (promotion.items ?? []).find((candidate) => candidate.service_id === service.id)
    return Boolean(item && Number(item.promotional_price_cents) > 0 && Number(item.promotional_price_cents) < Number(service.price_cents))
  })
  if (!promo) return null
  const item = promo.items.find((candidate) => candidate.service_id === service.id)
  return {
    promotion_id: promo.id,
    promotion_name: promo.name,
    starts_on: String(promo.starts_on).slice(0, 10),
    ends_on: String(promo.ends_on).slice(0, 10),
    service_id: service.id,
    service_name: service.name,
    regular_price_cents: Number(service.price_cents),
    promotional_price_cents: Number(item.promotional_price_cents),
  }
}

export function validateServiceUpdate(service) {
  if (!service || !String(service.name ?? '').trim() || String(service.name).length > 120) throw new Error('INVALID_SERVICE_NAME')
  if (!Number.isInteger(Number(service.duration_minutes)) || Number(service.duration_minutes) < 15 || Number(service.duration_minutes) > 600) throw new Error('INVALID_SERVICE_DURATION')
  if (!Number.isInteger(Number(service.price_cents)) || Number(service.price_cents) < 0) throw new Error('INVALID_SERVICE_PRICE')
  if (!Number.isInteger(Number(service.deposit_percent)) || Number(service.deposit_percent) < 0 || Number(service.deposit_percent) > 100) throw new Error('INVALID_DEPOSIT_PERCENT')
}

export function validateBusinessHours(hours) {
  if (!Array.isArray(hours) || hours.length !== 7) throw new Error('INVALID_BUSINESS_HOURS')
  const seen = new Set()
  for (const hour of hours) {
    const weekday = Number(hour.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || seen.has(weekday)) throw new Error('INVALID_BUSINESS_HOURS')
    seen.add(weekday)
    if (!hour.enabled) continue
    const start = timeToMinutes(hour.start_time)
    const end = timeToMinutes(hour.end_time)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('INVALID_BUSINESS_HOURS')
    if (hour.break_start || hour.break_end) {
      const breakStart = timeToMinutes(hour.break_start)
      const breakEnd = timeToMinutes(hour.break_end)
      if (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd) || breakStart >= breakEnd || breakStart < start || breakEnd > end) throw new Error('INVALID_BUSINESS_HOURS')
    }
  }
}

export function validatePolicies(policies) {
  const lateness = Number(policies.lateness_tolerance_minutes)
  const cancellation = Number(policies.cancellation_notice_hours)
  if (!Number.isInteger(lateness) || lateness < 0 || lateness > 60) throw new Error('INVALID_POLICIES')
  if (!Number.isInteger(cancellation) || cancellation < 0 || cancellation > 168) throw new Error('INVALID_POLICIES')
  const companion = String(policies.companion_policy ?? '').trim()
  const noShow = String(policies.no_show_policy ?? '').trim()
  const showLateness = Boolean(policies.show_lateness_policy)
  const showCancellation = Boolean(policies.show_cancellation_policy)
  const showCompanion = Boolean(policies.show_companion_policy)
  const showNoShow = Boolean(policies.show_no_show_policy)
  if (companion.length > 700 || (showCompanion && companion.length < 10)) throw new Error('INVALID_POLICIES')
  if (noShow.length > 700 || (showNoShow && noShow.length < 10)) throw new Error('INVALID_POLICIES')
  return {
    singleton: true,
    lateness_tolerance_minutes: lateness,
    cancellation_notice_hours: cancellation,
    companion_policy: companion,
    no_show_policy: noShow,
    show_lateness_policy: showLateness,
    show_cancellation_policy: showCancellation,
    show_companion_policy: showCompanion,
    show_no_show_policy: showNoShow,
  }
}

export function validateBlock(input) {
  const date = String(input.blocked_date ?? '')
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < getStudioDate()) throw new Error('INVALID_BLOCK_DATE')
  const start = input.start_time ? normalizeTime(input.start_time) : null
  const end = input.end_time ? normalizeTime(input.end_time) : null
  if ((start && !end) || (!start && end)) throw new Error('INVALID_BLOCK_TIME')
  if (start && (timeToMinutes(start) >= timeToMinutes(end))) throw new Error('INVALID_BLOCK_TIME')
  return { blocked_date: date, start_time: start, end_time: end, note: String(input.note ?? '').trim().slice(0, 120) }
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const FINANCIAL_PAYMENT_METHODS = new Set(['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro'])

export function validatePaymentMethod(value) {
  const method = String(value ?? '').trim()
  if (!FINANCIAL_PAYMENT_METHODS.has(method)) throw new Error('INVALID_PAYMENT_METHOD')
  return method
}

export function isAppointmentBalanceEligible(appointment, now = new Date()) {
  if (!appointment || !['confirmed', 'completed'].includes(appointment.status)) return false
  if (appointment.deposit_required && !appointment.deposit_received) return false
  // Explicit completion means the service ended; otherwise a confirmed appointment waits until its planned end time.
  if (appointment.status === 'completed') return true
  const end = new Date(appointment.ends_at).getTime()
  return Number.isFinite(end) && end <= now.getTime()
}

export function validateFinancialEntryInput(input) {
  const direction = String(input.direction ?? '')
  const description = String(input.description ?? '').trim()
  const category = String(input.category ?? '').trim()
  const amount = Number(input.amount_cents)
  const movementDate = String(input.movement_date ?? '')
  const paymentMethod = String(input.payment_method ?? '').trim().slice(0, 60)
  if (!['income', 'expense'].includes(direction)) throw new Error('INVALID_FINANCIAL_DIRECTION')
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_FINANCIAL_DESCRIPTION')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_FINANCIAL_CATEGORY')
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000000) throw new Error('INVALID_FINANCIAL_AMOUNT')
  if (!isIsoDate(movementDate) || movementDate > getStudioDate()) throw new Error('INVALID_FINANCIAL_DATE')
  return { direction, description, category, amount_cents: amount, movement_date: movementDate, payment_method: paymentMethod || 'Não informado' }
}

export function validatePayableInput(input) {
  const description = String(input.description ?? '').trim()
  const category = String(input.category ?? '').trim()
  const amount = Number(input.amount_cents)
  const dueDate = String(input.due_date ?? '')
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_PAYABLE_DESCRIPTION')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_PAYABLE_CATEGORY')
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000000) throw new Error('INVALID_PAYABLE_AMOUNT')
  if (!isIsoDate(dueDate)) throw new Error('INVALID_PAYABLE_DUE_DATE')
  return { description, category, amount_cents: amount, due_date: dueDate }
}
