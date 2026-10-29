import { addDateDays, getBusinessClock, isValidDate } from './business-time.mjs'
import { timeToMinutes } from './availability.mjs'

export const MAX_PROCEDURES_PER_BOOKING = 6
export const MAX_BOOKING_DAYS_AHEAD = 60

export function normalizeBrazilPhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2)
  if (!/^\d{10,11}$/.test(digits)) throw new Error('INVALID_CUSTOMER_PHONE')
  return digits
}

export function validateBookingRequest(payload, now = new Date()) {
  const customerName = String(payload?.customerName ?? '').trim().replace(/\s+/g, ' ')
  if (customerName.length < 2 || customerName.length > 100) throw new Error('INVALID_CUSTOMER_NAME')

  const customerPhone = normalizeBrazilPhone(payload?.customerWhatsapp)
  const date = String(payload?.date ?? '')
  if (!isValidDate(date)) throw new Error('INVALID_BOOKING_DATE')
  const businessClock = getBusinessClock(now)
  if (date < businessClock.date || date > addDateDays(businessClock.date, MAX_BOOKING_DAYS_AHEAD)) throw new Error('INVALID_BOOKING_DATE')

  const items = Array.isArray(payload?.items) ? payload.items : []
  if (!items.length || items.length > MAX_PROCEDURES_PER_BOOKING) throw new Error('INVALID_BOOKING_ITEMS')

  const normalizedItems = items.map((item) => {
    const serviceId = String(item?.serviceId ?? '').trim()
    const professionalId = String(item?.professionalId ?? '').trim()
    const time = String(item?.time ?? '').trim()
    if (!serviceId || !professionalId || !time) throw new Error('INVALID_BOOKING_ITEM')
    timeToMinutes(time)
    return { serviceId, professionalId, time }
  })


  return { customerName, customerPhone, date, items: normalizedItems }
}
