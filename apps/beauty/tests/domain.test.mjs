import test from 'node:test'
import assert from 'node:assert/strict'
import { addDateDays, buildAvailableSlots, getStudioDate, getWeekday, localDateTimeToUtc, normalizeBrazilPhone, normalizeCustomerName, validateBookingInput, validateBusinessHours, validateCustomerProfileInput, validatePolicies } from '../server/domain.mjs'

const service = { id: 'svc-1', active: true, duration_minutes: 90 }

function hoursFor(date, overrides = {}) {
  const weekday = getWeekday(date)
  return [{ weekday, enabled: true, start_time: '09:00', end_time: '13:00', break_start: '11:00', break_end: '11:30', ...overrides }]
}

test('slots respect duration, closing time and lunch interval', () => {
  const date = addDateDays(getStudioDate(), 2)
  const slots = buildAvailableSlots({ service, hours: hoursFor(date), date, now: new Date() })
  assert.deepEqual(slots, ['09:00', '09:15', '09:30', '11:30'])
})

test('slots are removed when blocked or overlapping an active appointment', () => {
  const date = addDateDays(getStudioDate(), 2)
  const appointments = [{ status: 'confirmed', starts_at: `${date}T13:00:00.000Z`, ends_at: `${date}T14:30:00.000Z` }]
  const blocks = [{ blocked_date: date, start_time: '09:00', end_time: '10:00' }]
  const slots = buildAvailableSlots({ service, hours: hoursFor(date), blocks, appointments, date, now: new Date() })
  assert.ok(!slots.includes('09:00'))
})

test('booking input validates name, phone, acknowledgement and valid time format', () => {
  const date = addDateDays(getStudioDate(), 2)
  assert.throws(() => validateBookingInput({ serviceId: 'svc-1', date, time: '25:00', customerName: 'Fer', customerPhone: '67999990000', policyAcknowledged: true }), /INVALID_BOOKING_SLOT/)
  assert.throws(() => validateBookingInput({ serviceId: 'svc-1', date, time: '09:00', customerName: 'Fer', customerPhone: '67999990000', policyAcknowledged: false }), /POLICY_ACKNOWLEDGEMENT_REQUIRED/)
  const valid = validateBookingInput({ serviceId: 'svc-1', date, time: '09:15', customerName: 'fER oLIVEIRA', customerPhone: '(67) 99999-0000', policyAcknowledged: true })
  assert.equal(valid.customerPhone, '67999990000')
  assert.equal(valid.customerName, 'Fer Oliveira')
})

test('public policy acknowledgement is required only when at least one notice is enabled', () => {
  const date = addDateDays(getStudioDate(), 2)
  const input = { serviceId: 'svc-1', date, time: '09:15', customerName: 'Ana Souza', customerPhone: '67999990000', policyAcknowledged: false }
  assert.throws(() => validateBookingInput(input), /POLICY_ACKNOWLEDGEMENT_REQUIRED/)
  const validWithoutPublicNotice = validateBookingInput(input, { requirePolicyAcknowledgement: false })
  assert.equal(validWithoutPublicNotice.policyAcknowledged, false)
})

test('policy settings accept hidden blank text and validate only enabled text', () => {
  const base = { lateness_tolerance_minutes: 0, cancellation_notice_hours: 0, companion_policy: '', no_show_policy: '', show_lateness_policy: false, show_cancellation_policy: false, show_companion_policy: false, show_no_show_policy: false }
  assert.equal(validatePolicies(base).show_lateness_policy, false)
  assert.throws(() => validatePolicies({ ...base, show_companion_policy: true }), /INVALID_POLICIES/)
  const enabled = validatePolicies({ ...base, show_companion_policy: true, companion_policy: 'Combine previamente com a Ana.' })
  assert.equal(enabled.show_companion_policy, true)
})

test('business hours require valid opening/closing times and break ranges', () => {
  const hours = Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: false, start_time: null, end_time: null, break_start: null, break_end: null }))
  hours[1] = { weekday: 1, enabled: true, start_time: '09:00', end_time: '18:00', break_start: '12:00', break_end: '13:00' }
  assert.doesNotThrow(() => validateBusinessHours(hours))
  hours[1].break_end = '19:00'
  assert.throws(() => validateBusinessHours(hours), /INVALID_BUSINESS_HOURS/)
})


test('Brazilian phone numbers normalize country code and customer profile validation', () => {
  assert.equal(normalizeBrazilPhone('+55 (67) 98888-0000'), '67988880000')
  assert.deepEqual(validateCustomerProfileInput({
    name: 'Cliente de Teste',
    phone: '+55 (67) 98888-0000',
    require_deposit: true,
    internal_note: 'Conferir condições antes de confirmar.',
  }), {
    name: 'Cliente de Teste', phone: '67988880000', require_deposit: true,
    internal_note: 'Conferir condições antes de confirmar.',
  })
  assert.throws(() => validateCustomerProfileInput({ name: 'A', phone: '123' }), /INVALID_CUSTOMER_NAME/)
})



test('availability includes the exact end minute when a 40-minute appointment ends at 13:40', () => {
  const date = addDateDays(getStudioDate(), 2)
  const localDateTimeToUtcRef = localDateTimeToUtc
  const start = localDateTimeToUtcRef(date, '13:00')
  const appointment = { status: 'confirmed', starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 40 * 60_000).toISOString() }
  const shortService = { id: 'svc-short', active: true, duration_minutes: 20 }
  const hours = hoursFor(date, { start_time: '13:00', end_time: '16:00', break_start: null, break_end: null })
  const slots = buildAvailableSlots({ service: shortService, hours, appointments: [appointment], date, now: new Date(localDateTimeToUtcRef(date, '08:00')) })
  assert.ok(slots.includes('13:40'))
})

test('availability recalculates from the exact end minute of consecutive appointments', () => {
  const date = addDateDays(getStudioDate(), 2)
  const localDateTimeToUtcRef = localDateTimeToUtc
  const firstStart = localDateTimeToUtc(date, '13:00')
  const secondStart = localDateTimeToUtc(date, '13:40')
  const appointments = [
    { status: 'confirmed', starts_at: firstStart.toISOString(), ends_at: new Date(firstStart.getTime() + 40 * 60_000).toISOString() },
    { status: 'confirmed', starts_at: secondStart.toISOString(), ends_at: new Date(secondStart.getTime() + 30 * 60_000).toISOString() },
  ]
  const shortService = { id: 'svc-short', active: true, duration_minutes: 20 }
  const hours = hoursFor(date, { start_time: '13:00', end_time: '16:00', break_start: null, break_end: null })
  const slots = buildAvailableSlots({ service: shortService, hours, appointments, date, now: new Date(localDateTimeToUtc(date, '08:00')) })
  assert.ok(!slots.includes('14:09'))
  assert.ok(slots.includes('14:10'))
})

test('availability releases a 09:00–09:30 appointment exactly at 09:30', () => {
  const date = addDateDays(getStudioDate(), 2)
  const start = localDateTimeToUtc(date, '09:00')
  const appointment = { status: 'confirmed', starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60_000).toISOString() }
  const shortService = { id: 'svc-short', active: true, duration_minutes: 20 }
  const hours = hoursFor(date, { start_time: '09:00', end_time: '12:00', break_start: null, break_end: null })
  const slots = buildAvailableSlots({ service: shortService, hours, appointments: [appointment], date, now: new Date(localDateTimeToUtc(date, '08:00')) })
  assert.ok(!slots.includes('09:15'), 'a candidate overlapping the existing appointment remains unavailable')
  assert.ok(slots.includes('09:30'), 'the exact end minute is available')
})

test('missing phone is allowed only for an explicitly administrative booking', () => {
  const date = addDateDays(getStudioDate(), 2)
  const input = { serviceId: 'svc-1', date, time: '09:00', customerName: 'Ana Souza', customerPhone: '', policyAcknowledged: false }
  assert.throws(() => validateBookingInput(input, { requirePolicyAcknowledgement: false }), /INVALID_CUSTOMER_PHONE/)
  const adminInput = validateBookingInput(input, { requirePolicyAcknowledgement: false, allowMissingPhone: true })
  assert.equal(adminInput.customerPhone, '')
})

test('customer names are normalized automatically to title case', () => {
  assert.equal(normalizeCustomerName('  aNA   sOUZA  '), 'Ana Souza')
  assert.equal(normalizeCustomerName('mARIA de sOUZA'), 'Maria de Souza')
  assert.equal(normalizeCustomerName("joÃO d\'ÁVILA"), "João D'Ávila")
})


test('booking input accepts a list of distinct service IDs', () => {
  const date = addDateDays(getStudioDate(), 2)
  const valid = validateBookingInput({ serviceId: 'svc-1', serviceIds: ['svc-1', 'svc-2'], date, time: '09:00', customerName: 'Ana Souza', customerPhone: '67999990000', policyAcknowledged: true })
  assert.deepEqual(valid.serviceIds, ['svc-1', 'svc-2'])
  assert.equal(valid.serviceId, 'svc-1')
  assert.throws(() => validateBookingInput({ serviceId: 'svc-1', serviceIds: ['svc-1', 'svc-1'], date, time: '09:00', customerName: 'Ana Souza', customerPhone: '67999990000', policyAcknowledged: true }), /SERVICE_NOT_AVAILABLE/)
})
