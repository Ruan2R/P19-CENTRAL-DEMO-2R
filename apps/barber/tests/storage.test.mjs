import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addDateDays, getBusinessDate, getWeekday } from '../server/domain/business-time.mjs'
import { createStorage } from '../server/storage.mjs'

async function createTestStore(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p15-storage-'))
  const filePath = path.join(directory, 'local-db.json')
  const store = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: filePath }, directory)
  t.after(async () => {
    await store.close?.()
    await rm(directory, { recursive: true, force: true })
  })
  return { store, filePath, directory }
}

function nextWeekday(weekday) {
  const today = getBusinessDate()
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDateDays(today, offset)
    if (getWeekday(candidate) === weekday) return candidate
  }
  throw new Error('Não foi possível calcular uma data futura para o teste.')
}

function bookingPayload({ date, items, customerName = 'Cliente Teste', customerWhatsapp = '(67) 99999-1234' }) {
  return { date, customerName, customerWhatsapp, items }
}

test('local JSON store serves the initial Boss67 catalog and professionals', async (t) => {
  const { store } = await createTestStore(t)
  const services = await store.getPublicServices()
  const professionals = await store.getPublicProfessionals()
  assert.equal(services.length, 7)
  assert.equal(services.find((item) => item.id === 'barba-pigmentacao')?.durationMinutes, 45)
  assert.equal(services.find((item) => item.id === 'corte')?.priceCents, 5000)
  assert.deepEqual(professionals.map((item) => item.id), ['felipe', 'vitoria'])
})

test('booking with a 45-minute service makes the next 30-minute grid start 14:00, not 13:30', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(2) // Tuesday: opens at 09:00.
  const booking = await store.createBookingGroup(bookingPayload({
    date,
    items: [{ serviceId: 'barba-pigmentacao', professionalId: 'felipe', time: '09:00' }],
  }))
  assert.equal(booking.items[0].durationMinutes, 45)
  const result = await store.getAvailableSlots('corte', 'felipe', date)
  const times = result.slots.map((slot) => slot.time)
  assert.ok(!times.includes('09:30'))
  assert.ok(times.includes('10:00'))
})

test('booking group stores multiple non-overlapping procedures atomically and computes price snapshots', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(3) // Wednesday: opens at 09:00.
  const group = await store.createBookingGroup(bookingPayload({
    date,
    items: [
      { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
      { serviceId: 'sobrancelha', professionalId: 'vitoria', time: '09:30' },
      { serviceId: 'barba', professionalId: 'felipe', time: '10:00' },
    ],
  }))
  assert.equal(group.items.length, 3)
  assert.equal(group.totalPriceCents, 11000)
  assert.equal(group.status, 'confirmed')
  assert.ok(group.publicCode)
  assert.deepEqual(group.items.map((item) => item.time), ['09:00', '09:30', '10:00'])
})

test('conflicting reservation is rejected and does not partially write a booking group', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(4) // Thursday.
  await store.createBookingGroup(bookingPayload({
    date,
    items: [{ serviceId: 'barba-pigmentacao', professionalId: 'felipe', time: '09:00' }],
    customerName: 'Primeiro Cliente',
  }))
  await assert.rejects(
    store.createBookingGroup(bookingPayload({
      date,
      items: [{ serviceId: 'corte', professionalId: 'felipe', time: '09:30' }],
      customerName: 'Segundo Cliente',
    })),
    /SLOT_TAKEN/,
  )
  const next = await store.getAvailableSlots('corte', 'felipe', date)
  assert.ok(!next.slots.some((slot) => slot.time === '09:30'))
})

test('backend rejects overlapping procedures within one customer appointment even across professionals', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(5) // Friday.
  await assert.rejects(
    store.createBookingGroup(bookingPayload({
      date,
      items: [
        { serviceId: 'barba-pigmentacao', professionalId: 'felipe', time: '09:00' },
        { serviceId: 'corte', professionalId: 'vitoria', time: '09:30' },
      ],
    })),
    /PROCEDURES_OVERLAP/,
  )
})

test('availability and booking reject a start outside the 30-minute grid', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(6) // Saturday.
  await assert.rejects(
    store.createBookingGroup(bookingPayload({
      date,
      items: [{ serviceId: 'corte', professionalId: 'felipe', time: '09:15' }],
    })),
    /SLOT_TAKEN/,
  )
})

test('local JSON data persists when the store is reopened', async (t) => {
  const { store, filePath, directory } = await createTestStore(t)
  const date = nextWeekday(2)
  await store.createBookingGroup(bookingPayload({ date, items: [{ serviceId: 'corte', professionalId: 'felipe', time: '09:00' }] }))
  const reopened = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: filePath }, directory)
  t.after(async () => { await reopened.close?.() })
  const availability = await reopened.getAvailableSlots('corte', 'felipe', date)
  assert.ok(!availability.slots.some((slot) => slot.time === '09:00'))
})
