import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addDateDays, getBusinessDate, getWeekday } from '../server/domain/business-time.mjs'
import { createStorage } from '../server/storage.mjs'
import { handlePublicRoute } from '../server/routes/public.mjs'
import { handleAdminRoute } from '../server/routes/admin.mjs'

async function setup(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p15-e2e-'))
  const storage = await createStorage({
    NODE_ENV: 'development',
    P15_LOCAL_DB_PATH: path.join(directory, 'local-db.json'),
  }, directory)
  t.after(async () => {
    await storage.close?.()
    await rm(directory, { recursive: true, force: true })
  })

  // Pick a future Tuesday so the seeded service schedule is open and the booking
  // stays inside the public booking horizon used by the application.
  const date = Array.from({ length: 14 }, (_, index) => addDateDays(getBusinessDate(), index + 1))
    .find((candidate) => getWeekday(candidate) === 2)
  assert.ok(date, 'test setup should find a future Tuesday')
  return { storage, date }
}

function publicRequest(storage, method, pathname, search = '', body = {}) {
  return handlePublicRoute({
    method,
    pathname,
    searchParams: new URLSearchParams(search),
    isProduction: false,
    storage,
    readBody: async () => body,
  })
}

function adminRequest(storage, method, pathname, search = '', body = {}) {
  return handleAdminRoute({
    method,
    pathname,
    searchParams: new URLSearchParams(search),
    storage,
    session: { id: 'ADMIN', role: 'owner', displayName: 'Test Admin' },
    readBody: async () => body,
  })
}

test('end-to-end: customer books a discounted combo and admin confirms, completes and records receipt', async (t) => {
  const { storage, date } = await setup(t)

  const promotion = await adminRequest(storage, 'POST', '/api/admin/promotions', '', {
    name: 'Combo teste ponta a ponta',
    kind: 'combo',
    startsOn: date,
    endsOn: date,
    active: true,
    serviceIds: ['corte', 'barba'],
    promoPriceCents: 7500,
  })
  assert.equal(promotion.status, 201)

  const [services, professionals, promotions] = await Promise.all([
    publicRequest(storage, 'GET', '/api/public/services'),
    publicRequest(storage, 'GET', '/api/public/professionals'),
    publicRequest(storage, 'GET', '/api/public/promotions'),
  ])
  assert.equal(services.status, 200)
  assert.ok(services.body.services.some((service) => service.id === 'corte'))
  assert.equal(professionals.status, 200)
  assert.ok(professionals.body.professionals.some((professional) => professional.id === 'felipe'))
  assert.equal(promotions.status, 200)
  assert.ok(promotions.body.promotions.some((item) => item.name === 'Combo teste ponta a ponta'))

  const corteAvailability = await publicRequest(storage, 'GET', '/api/public/availability',
    new URLSearchParams({ date, serviceId: 'corte', professionalId: 'felipe' }).toString())
  const barbaAvailability = await publicRequest(storage, 'GET', '/api/public/availability',
    new URLSearchParams({ date, serviceId: 'barba', professionalId: 'vitoria' }).toString())
  assert.equal(corteAvailability.status, 200)
  assert.equal(barbaAvailability.status, 200)
  assert.ok(corteAvailability.body.slots.some((slot) => slot.time === '09:00'))
  assert.ok(barbaAvailability.body.slots.some((slot) => slot.time === '09:30'))

  const created = await publicRequest(storage, 'POST', '/api/public/booking-groups', '', {
    date,
    customerName: 'Cliente Ponta a Ponta',
    customerWhatsapp: '(67) 99999-1234',
    items: [
      { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
      { serviceId: 'barba', professionalId: 'vitoria', time: '09:30' },
    ],
  })
  assert.equal(created.status, 201)
  const booking = created.body.booking
  assert.equal(booking.items.length, 2)
  assert.equal(booking.totalPriceCents, 7500)
  assert.equal(booking.items.reduce((sum, item) => sum + item.priceCents, 0), 7500)
  assert.ok(booking.items.every((item) => item.promotionName === 'Combo teste ponta a ponta'))

  const corteAfterBooking = await publicRequest(storage, 'GET', '/api/public/availability',
    new URLSearchParams({ date, serviceId: 'corte', professionalId: 'felipe' }).toString())
  const barbaAfterBooking = await publicRequest(storage, 'GET', '/api/public/availability',
    new URLSearchParams({ date, serviceId: 'barba', professionalId: 'vitoria' }).toString())
  assert.ok(!corteAfterBooking.body.slots.some((slot) => slot.time === '09:00'), 'the booked corte slot must no longer be offered')
  assert.ok(!barbaAfterBooking.body.slots.some((slot) => slot.time === '09:30'), 'the booked barba slot must no longer be offered')

  const adminList = await adminRequest(storage, 'GET', '/api/admin/booking-groups', 'filter=all')
  assert.equal(adminList.status, 200)
  const listedBooking = adminList.body.bookingGroups.find((group) => group.id === booking.id)
  assert.ok(listedBooking)
  assert.equal(listedBooking.items.length, 2)

  const agenda = await adminRequest(storage, 'GET', '/api/admin/agenda',
    new URLSearchParams({ date, professionalId: 'all', status: 'all' }).toString())
  assert.equal(agenda.status, 200)
  assert.equal(agenda.body.summary.total, 1)
  assert.equal(agenda.body.summary.confirmed, 1)
  assert.equal(agenda.body.bookingGroups[0].id, booking.id)

  const customers = await adminRequest(storage, 'GET', '/api/admin/customers', 'search=Cliente%20Ponta%20a%20Ponta')
  assert.equal(customers.status, 200)
  assert.equal(customers.body.customers.length, 1)
  assert.equal(customers.body.customers[0].appointmentCount, 1)
  const history = await adminRequest(storage, 'GET', `/api/admin/customers/${customers.body.customers[0].id}/history`)
  assert.equal(history.status, 200)
  assert.equal(history.body.bookingGroups[0].id, booking.id)

  const prematureReceipt = await adminRequest(storage, 'POST', `/api/admin/finance/booking-groups/${booking.id}/receipt`, '', { paymentMethod: 'Pix' })
  assert.equal(prematureReceipt.status, 409, 'a future confirmed booking must not be booked as received')

  const whatsapp = await adminRequest(storage, 'POST', `/api/admin/booking-groups/${booking.id}/whatsapp-confirmation`)
  assert.equal(whatsapp.status, 200)
  assert.ok(whatsapp.body.booking.whatsappConfirmationMarkedAt)

  const completed = await adminRequest(storage, 'PATCH', `/api/admin/booking-groups/${booking.id}/status`, '', { status: 'completed' })
  assert.equal(completed.status, 200)
  assert.equal(completed.body.booking.status, 'completed')

  const receipt = await adminRequest(storage, 'POST', `/api/admin/finance/booking-groups/${booking.id}/receipt`, '', { paymentMethod: 'Pix' })
  assert.equal(receipt.status, 200)
  assert.equal(receipt.body.alreadyReceived, false)
  assert.equal(receipt.body.entry.amountCents, 7500)
  const duplicateReceipt = await adminRequest(storage, 'POST', `/api/admin/finance/booking-groups/${booking.id}/receipt`, '', { paymentMethod: 'Pix' })
  assert.equal(duplicateReceipt.status, 200)
  assert.equal(duplicateReceipt.body.alreadyReceived, true)

  const finance = await adminRequest(storage, 'GET', '/api/admin/finance', `month=${getBusinessDate().slice(0, 7)}`)
  assert.equal(finance.status, 200)
  assert.equal(finance.body.entries.filter((entry) => entry.sourceType === 'booking_receipt' && entry.sourceId === booking.id).length, 1)
  assert.ok(!finance.body.receivables.some((item) => item.id === booking.id))
})

test('public booking conflict does not partially reserve the earlier procedure in a group', async (t) => {
  const { storage, date } = await setup(t)

  const existing = await publicRequest(storage, 'POST', '/api/public/booking-groups', '', {
    date,
    customerName: 'Cliente Existente',
    customerWhatsapp: '(67) 99999-4321',
    items: [{ serviceId: 'barba', professionalId: 'vitoria', time: '09:30' }],
  })
  assert.equal(existing.status, 201)

  const failedGroup = await publicRequest(storage, 'POST', '/api/public/booking-groups', '', {
    date,
    customerName: 'Cliente Sem Reserva',
    customerWhatsapp: '(67) 99999-6789',
    items: [
      { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
      { serviceId: 'barba', professionalId: 'vitoria', time: '09:30' },
    ],
  })
  assert.equal(failedGroup.status, 409)
  assert.equal(failedGroup.body.error, 'SLOT_TAKEN')

  const list = await adminRequest(storage, 'GET', '/api/admin/booking-groups', 'filter=all')
  assert.equal(list.status, 200)
  assert.equal(list.body.bookingGroups.length, 1, 'only the pre-existing booking should have been persisted')

  const corteAvailability = await publicRequest(storage, 'GET', '/api/public/availability',
    new URLSearchParams({ date, serviceId: 'corte', professionalId: 'felipe' }).toString())
  assert.ok(corteAvailability.body.slots.some((slot) => slot.time === '09:00'), 'the uncommitted first procedure must remain available')
})

test('public availability and booking resolve “sem preferência” to an available professional', async (t) => {
  const { storage, date } = await setup(t)
  const query = new URLSearchParams({ date, serviceId: 'corte', professionalId: 'sem-preferencia' }).toString()
  const availability = await publicRequest(storage, 'GET', '/api/public/availability', query)
  assert.equal(availability.status, 200)
  const slot = availability.body.slots.find((item) => item.time === '09:00')
  assert.ok(slot)
  assert.ok(slot.professionalId)
  assert.ok(slot.professionalName)

  const booking = await publicRequest(storage, 'POST', '/api/public/booking-groups', '', {
    date,
    customerName: 'Cliente Sem Preferência',
    customerWhatsapp: '(67) 99999-2468',
    items: [{ serviceId: 'corte', professionalId: 'sem-preferencia', time: '09:00' }],
  })
  assert.equal(booking.status, 201)
  assert.equal(booking.body.booking.items[0].professionalId, slot.professionalId)
  assert.equal(booking.body.booking.items[0].professionalName, slot.professionalName)
})
