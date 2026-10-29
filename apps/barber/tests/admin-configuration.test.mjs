import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addDateDays, getBusinessDate, getWeekday } from '../server/domain/business-time.mjs'
import { createStorage } from '../server/storage.mjs'
import { handleAdminRoute } from '../server/routes/admin.mjs'

async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p15-admin-config-'))
  const storage = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: path.join(dir, 'local-db.json') }, dir)
  t.after(async () => { await storage.close?.(); await rm(dir, { recursive: true, force: true }) })
  return { dir, storage }
}

function futureDateForWeekday(weekday) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = addDateDays(getBusinessDate(), offset)
    if (getWeekday(date) === weekday) return date
  }
  throw new Error('Não foi possível encontrar uma data futura de teste.')
}

function context(storage, overrides = {}) {
  return {
    method: 'GET', pathname: '/api/admin/configuration', searchParams: new URLSearchParams(),
    storage, session: { id: 'ADMIN', displayName: 'Administrador', role: 'owner' },
    readBody: async () => ({}), ...overrides,
  }
}

test('admin configuration creates, edits and deactivates a service without removing history references', async (t) => {
  const { storage } = await setup(t)
  const created = await storage.createService({ name: 'Corte infantil', durationMinutes: 30, priceCents: 3500 })
  assert.equal(created.active, true)
  assert.equal((await storage.getPublicServices()).some((service) => service.id === created.id), true)

  const updated = await storage.updateService(created.id, { name: 'Corte infantil premium', durationMinutes: 45, priceCents: 4000 })
  assert.equal(updated.durationMinutes, 45)
  assert.equal(updated.priceCents, 4000)

  await storage.setServiceActive(created.id, false)
  assert.equal((await storage.getPublicServices()).some((service) => service.id === created.id), false)
  assert.equal((await storage.getAdminConfiguration()).services.some((service) => service.id === created.id && !service.active), true)
})

test('admin configuration manages professionals and preserves at least one active professional', async (t) => {
  const { storage } = await setup(t)
  const created = await storage.createProfessional({ name: 'João Silva', role: 'Barbeiro' })
  const updated = await storage.updateProfessional(created.id, { name: 'João Santos', role: 'Barbeiro Sênior' })
  assert.equal(updated.name, 'João Santos')
  assert.equal(updated.role, 'Barbeiro Sênior')
  await storage.setProfessionalActive(created.id, false)

  const remaining = (await storage.getAdminConfiguration()).professionals.filter((person) => person.active)
  for (const professional of remaining.slice(0, -1)) await storage.setProfessionalActive(professional.id, false)
  await assert.rejects(storage.setProfessionalActive(remaining.at(-1).id, false), /LAST_ACTIVE_PROFESSIONAL/)
})

test('business hours can be opened and a midday break is validated', async (t) => {
  const { storage } = await setup(t)
  await storage.updateBusinessHours(0, { enabled: true, openTime: '10:00', closeTime: '14:00', breakStart: '12:00', breakEnd: '12:30' })
  const sunday = (await storage.getAdminConfiguration()).businessHours.find((day) => day.weekday === 0)
  assert.equal(sunday.enabled, true)
  assert.equal(sunday.openTime, '10:00')
  const date = futureDateForWeekday(0)
  const slots = (await storage.getAvailableSlots('corte', 'felipe', date)).slots.map((slot) => slot.time)
  assert.ok(slots.includes('10:00'))
  assert.ok(!slots.includes('12:00'))
  assert.ok(slots.includes('12:30'))
  await assert.rejects(storage.updateBusinessHours(0, { enabled: true, openTime: '10:00', closeTime: '14:00', breakStart: '13:00', breakEnd: '15:00' }), /INVALID_BUSINESS_BREAK/)
})

test('professional blocks remove conflicting starts and can be removed', async (t) => {
  const { storage } = await setup(t)
  const date = futureDateForWeekday(2)
  const block = await storage.createAdminBlock({ scope: 'professional', professionalId: 'felipe', date, startTime: '10:00', endTime: '11:00', reason: 'Compromisso' })
  assert.equal(block.professionalName, 'Felipe')
  const slots = (await storage.getAvailableSlots('corte', 'felipe', date)).slots.map((slot) => slot.time)
  assert.ok(!slots.includes('10:00'))
  assert.ok(!slots.includes('10:30'))
  assert.ok(slots.includes('11:00'))
  assert.equal((await storage.getAdminBlocks(date)).length, 1)
  await storage.deleteAdminBlock(block.id)
  assert.equal((await storage.getAdminBlocks(date)).length, 0)
  const restored = (await storage.getAvailableSlots('corte', 'felipe', date)).slots.map((slot) => slot.time)
  assert.ok(restored.includes('10:00'))
})

test('cannot create a block that overlaps a confirmed booking', async (t) => {
  const { storage } = await setup(t)
  const date = futureDateForWeekday(2)
  await storage.createBookingGroup({ date, customerName: 'Cliente Teste', customerWhatsapp: '(67) 99999-1234', items: [
    { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
  ] })
  await assert.rejects(storage.createAdminBlock({ scope: 'professional', professionalId: 'felipe', date, startTime: '09:00', endTime: '10:00', reason: 'Bloqueio conflitante' }), /BLOCK_CONFLICTS_WITH_BOOKING/)
  await assert.rejects(storage.createAdminBlock({ scope: 'business', date, startTime: '09:00', endTime: '10:00', reason: 'Bloqueio geral conflitante' }), /BLOCK_CONFLICTS_WITH_BOOKING/)
})

test('admin configuration routes validate service data and support block listing', async (t) => {
  const { storage } = await setup(t)
  const configuration = await handleAdminRoute(context(storage))
  assert.equal(configuration.status, 200)
  assert.equal(configuration.body.services.length, 7)
  assert.equal(configuration.body.businessHours.length, 7)

  const invalid = await handleAdminRoute(context(storage, {
    method: 'POST', pathname: '/api/admin/services', readBody: async () => ({ name: 'X', durationMinutes: 30, priceCents: 1000 }),
  }))
  assert.equal(invalid.status, 400)

  const created = await handleAdminRoute(context(storage, {
    method: 'POST', pathname: '/api/admin/services', readBody: async () => ({ name: 'Design de barba', durationMinutes: 15, priceCents: 2500 }),
  }))
  assert.equal(created.status, 201)
  assert.equal(created.body.service.priceCents, 2500)

  const date = futureDateForWeekday(2)
  const blocks = await handleAdminRoute(context(storage, { pathname: '/api/admin/blocks', searchParams: new URLSearchParams({ date }) }))
  assert.equal(blocks.status, 200)
  assert.deepEqual(blocks.body.blocks, [])
})
