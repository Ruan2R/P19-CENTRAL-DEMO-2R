import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStorage } from '../server/storage.mjs'
import { handleAdminRoute } from '../server/routes/admin.mjs'
import { addDateDays, getBusinessDate, getWeekday } from '../server/domain/business-time.mjs'

async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p15-admin-'))
  const storage = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: path.join(dir, 'database.json') }, dir)
  t.after(async () => { await storage.close?.(); await rm(dir, { recursive: true, force: true }) })
  const date = Array.from({ length: 14 }, (_, index) => addDateDays(getBusinessDate(), index + 1)).find((candidate) => getWeekday(candidate) === 2)
  return { dir, storage, date }
}

function routeContext(storage, date, overrides = {}) {
  return {
    method: 'GET',
    pathname: '/api/admin/agenda',
    searchParams: new URLSearchParams({ date }),
    storage,
    session: { id: 'ADMIN', displayName: 'Administrador', role: 'owner' },
    readBody: async () => ({}),
    ...overrides,
  }
}

test('admin agenda groups multiple procedures and summarizes confirmed revenue', async (t) => {
  const { storage, date } = await setup(t)
  await storage.createBookingGroup({ date, customerName: 'Cliente da Agenda', customerWhatsapp: '(67) 99999-1234', items: [
    { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
    { serviceId: 'sobrancelha', professionalId: 'vitoria', time: '09:30' },
  ] })
  const result = await handleAdminRoute(routeContext(storage, date))
  assert.equal(result.status, 200)
  assert.equal(result.body.summary.total, 1)
  assert.equal(result.body.summary.confirmed, 1)
  assert.equal(result.body.summary.revenueCents, 7000)
  assert.equal(result.body.bookingGroups.length, 1)
  assert.equal(result.body.bookingGroups[0].items.length, 2)
  assert.equal(result.body.bookingGroups[0].customer.name, 'Cliente da Agenda')
})

test('admin can manually mark WhatsApp message as sent and cancel the whole group', async (t) => {
  const { storage, date } = await setup(t)
  const created = await storage.createBookingGroup({ date, customerName: 'Cliente da Agenda', customerWhatsapp: '(67) 99999-1234', items: [
    { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
  ] })

  const marked = await handleAdminRoute(routeContext(storage, date, {
    method: 'POST',
    pathname: `/api/admin/booking-groups/${created.id}/whatsapp-confirmation`,
  }))
  assert.equal(marked.status, 200)
  assert.ok(marked.body.booking.whatsappConfirmationMarkedAt)

  const cancelled = await handleAdminRoute(routeContext(storage, date, {
    method: 'PATCH',
    pathname: `/api/admin/booking-groups/${created.id}/status`,
    readBody: async () => ({ status: 'cancelled' }),
  }))
  assert.equal(cancelled.status, 200)
  assert.equal(cancelled.body.booking.status, 'cancelled')

  const agenda = await storage.getAdminAgenda(date)
  assert.equal(agenda.summary.cancelled, 1)
  assert.equal(agenda.summary.revenueCents, 0)
  await assert.rejects(storage.updateBookingGroupStatus(created.id, 'completed'), /BOOKING_GROUP_NOT_ACTIONABLE/)
})

test('admin routes validate dates and status transitions', async (t) => {
  const { storage, date } = await setup(t)
  const invalidDate = await handleAdminRoute(routeContext(storage, date, { searchParams: new URLSearchParams({ date: 'not-a-date' }) }))
  assert.equal(invalidDate.status, 400)
  const invalidStatus = await handleAdminRoute(routeContext(storage, date, {
    method: 'PATCH',
    pathname: '/api/admin/booking-groups/missing/status',
    readBody: async () => ({ status: 'inventado' }),
  }))
  assert.equal(invalidStatus.status, 400)
})
