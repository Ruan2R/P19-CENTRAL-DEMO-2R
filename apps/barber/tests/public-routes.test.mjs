import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addDateDays, getBusinessDate, getWeekday } from '../server/domain/business-time.mjs'
import { createStorage } from '../server/storage.mjs'
import { handlePublicRoute } from '../server/routes/public.mjs'

async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p15-routes-'))
  const storage = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: path.join(dir, 'database.json') }, dir)
  t.after(async () => { await storage.close?.(); await rm(dir, { recursive: true, force: true }) })
  const date = Array.from({ length: 14 }, (_, index) => addDateDays(getBusinessDate(), index + 1)).find((candidate) => getWeekday(candidate) === 2)
  return { dir, storage, date }
}

function requestContext(storage, method, pathname, search, body) {
  return {
    method,
    pathname,
    searchParams: new URLSearchParams(search),
    isProduction: false,
    storage,
    readBody: async () => body,
  }
}

test('public route exposes services and real availability from the current storage adapter', async (t) => {
  const { storage, date } = await setup(t)
  const services = await handlePublicRoute(requestContext(storage, 'GET', '/api/public/services', '', {}))
  assert.equal(services.status, 200)
  assert.equal(services.body.services.length, 7)

  const availability = await handlePublicRoute(requestContext(storage, 'GET', '/api/public/availability', `date=${date}&serviceId=corte&professionalId=felipe`, {}))
  assert.equal(availability.status, 200)
  assert.ok(availability.body.slots.some((slot) => slot.time === '09:00'))
})

test('public booking endpoint returns a grouped booking and a clear conflict on a repeated slot', async (t) => {
  const { storage, date } = await setup(t)
  const body = {
    date,
    customerName: 'Cliente de Teste',
    customerWhatsapp: '(67) 99999-0000',
    items: [
      { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
      { serviceId: 'barba', professionalId: 'vitoria', time: '09:30' },
    ],
  }
  const created = await handlePublicRoute(requestContext(storage, 'POST', '/api/public/booking-groups', '', body))
  assert.equal(created.status, 201)
  assert.equal(created.body.booking.items.length, 2)
  assert.equal(created.body.booking.totalPriceCents, 9000)

  const conflict = await handlePublicRoute(requestContext(storage, 'POST', '/api/public/booking-groups', '', {
    ...body,
    customerName: 'Outro Cliente',
    items: [{ serviceId: 'corte', professionalId: 'felipe', time: '09:00' }],
  }))
  assert.equal(conflict.status, 409)
  assert.match(conflict.body.message, /indisponível/i)
})
