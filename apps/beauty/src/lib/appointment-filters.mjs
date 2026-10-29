const ACTIVE_FUTURE_STATUSES = new Set(['pending_confirmation', 'awaiting_deposit', 'confirmed'])
const PENDING_STATUSES = new Set(['pending_confirmation', 'awaiting_deposit'])
const BUSINESS_TIME_ZONE = 'America/Campo_Grande'

function businessDateString(value) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

function addCalendarDays(dateString, amount) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10)
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function filterAppointments(appointments, options, now = new Date()) {
  const {
    mode = 'upcoming',
    search = '',
    status = 'all',
    period = 'any',
    dateFrom = '',
    dateTo = '',
  } = options ?? {}
  const currentDate = businessDateString(now)
  const currentMonth = currentDate.slice(0, 7)
  const nextSevenDaysEnd = addCalendarDays(currentDate, 6)
  const nowIso = now.toISOString()
  const query = normalizeText(search.trim())
  const queryDigits = onlyDigits(search)
  const invalidCustomRange = period === 'custom' && Boolean(dateFrom && dateTo && dateFrom > dateTo)

  if (invalidCustomRange) return []

  return appointments.filter((appointment) => {
    if (mode === 'pending' && !PENDING_STATUSES.has(appointment.status)) return false
    if (mode === 'upcoming' && (!ACTIVE_FUTURE_STATUSES.has(appointment.status) || appointment.starts_at < nowIso)) return false
    if (status !== 'all' && appointment.status !== status) return false

    if (query) {
      const serviceNames = [
        appointment.service?.name,
        ...(appointment.service_items ?? []).map((item) => item.name),
      ].filter(Boolean).join(' ')
      const searchableText = normalizeText([
        appointment.customer_name,
        appointment.customer_phone,
        appointment.public_code,
        serviceNames,
      ].join(' '))
      const matchesText = searchableText.includes(query)
      const matchesPhone = queryDigits.length > 0 && onlyDigits(appointment.customer_phone).includes(queryDigits)
      if (!matchesText && !matchesPhone) return false
    }

    const appointmentDate = businessDateString(appointment.starts_at)
    if (period === 'today' && appointmentDate !== currentDate) return false
    if (period === 'next7' && (appointmentDate < currentDate || appointmentDate > nextSevenDaysEnd)) return false
    if (period === 'month' && !appointmentDate.startsWith(currentMonth)) return false
    if (period === 'custom') {
      if (dateFrom && appointmentDate < dateFrom) return false
      if (dateTo && appointmentDate > dateTo) return false
    }
    return true
  }).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}
