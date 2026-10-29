import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addDateDays, getBusinessDate, getWeekday, localDateTimeToUtc } from '../server/domain/business-time.mjs'
import { isBookingGroupReceivable, bookingGroupEndEpoch, calculatePromotionalPricing, validatePromotionInput } from '../server/domain/promotions.mjs'
import { createStorage } from '../server/storage.mjs'
import { handlePublicRoute } from '../server/routes/public.mjs'
import { handleAdminRoute } from '../server/routes/admin.mjs'

async function createTestStore(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p15-promotions-'))
  const store = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: path.join(directory, 'local-db.json') }, directory)
  t.after(async () => { await store.close?.(); await rm(directory, { recursive: true, force: true }) })
  return { store, directory }
}
function nextWeekday(weekday) {
  const today = getBusinessDate()
  for (let offset = 1; offset < 14; offset += 1) {
    const date = addDateDays(today, offset)
    if (getWeekday(date) === weekday) return date
  }
  throw new Error('No future weekday found')
}
function routeCtx(storage, method, pathname, readBody = async () => ({}), searchParams = new URLSearchParams()) {
  return { method, pathname, searchParams, storage, session: { id: 'ADMIN', role: 'owner', displayName: 'Test Admin' }, readBody }
}

test('validates individual promotions and combos; promotional price must be below regular total', () => {
  const services = [
    { id: 'corte', name: 'Corte', priceCents: 5000, active: true },
    { id: 'barba', name: 'Barba', priceCents: 4000, active: true },
  ]
  const promotions = []
  assert.equal(validatePromotionInput({ name: 'Corte promocional', kind: 'service', startsOn: '2026-10-01', endsOn: '2026-10-31', active: true, serviceIds: ['corte'], promoPriceCents: 4000 }, { services, promotions }).promoPriceCents, 4000)
  assert.equal(validatePromotionInput({ name: 'Combo corte barba', kind: 'combo', startsOn: '2026-10-01', endsOn: '2026-10-31', active: true, serviceIds: ['corte', 'barba'], promoPriceCents: 7500 }, { services, promotions }).serviceIds.length, 2)
  assert.throws(() => validatePromotionInput({ name: 'Promo', kind: 'service', startsOn: '2026-10-01', endsOn: '2026-10-31', serviceIds: ['corte'], promoPriceCents: 5000 }, { services, promotions }), /INVALID_PROMOTION_PRICE/)
  assert.throws(() => validatePromotionInput({ name: 'Combo inválido', kind: 'combo', startsOn: '2026-10-01', endsOn: '2026-10-31', serviceIds: ['corte'], promoPriceCents: 3000 }, { services, promotions }), /INVALID_PROMOTION_SERVICES/)
})

test('active promotions cannot overlap for the same service and dates', () => {
  const services = [{ id: 'corte', name: 'Corte', priceCents: 5000, active: true }]
  const promotions = [{ id: 'first', name: 'First', kind: 'service', startsOn: '2026-10-01', endsOn: '2026-10-20', active: true, serviceIds: ['corte'], promoPriceCents: 4000 }]
  assert.throws(() => validatePromotionInput({ name: 'Second', kind: 'service', startsOn: '2026-10-20', endsOn: '2026-10-31', active: true, serviceIds: ['corte'], promoPriceCents: 3500 }, { services, promotions }), /PROMOTION_SERVICE_CONFLICT/)
  assert.doesNotThrow(() => validatePromotionInput({ name: 'Second', kind: 'service', startsOn: '2026-10-21', endsOn: '2026-10-31', active: true, serviceIds: ['corte'], promoPriceCents: 3500 }, { services, promotions }))
})

test('combo discount is allocated across component services and sums to combo price', () => {
  const services = [{ id: 'corte', name: 'Corte', priceCents: 5000 }, { id: 'barba', name: 'Barba', priceCents: 4000 }]
  const promotion = { id: 'combo1', name: 'Combo', kind: 'combo', startsOn: '2026-10-01', endsOn: '2026-10-31', active: true, serviceIds: ['corte', 'barba'], promoPriceCents: 7500 }
  const result = calculatePromotionalPricing(services, [promotion], '2026-10-14')
  assert.equal(result.totalPriceCents, 7500)
  assert.equal(result.discountCents, 1500)
  assert.equal(result.prices.corte + result.prices.barba, 7500)
  assert.equal(result.promotionNames.corte, 'Combo')
})

test('local booking snapshots a single-service promotion and public route lists active promotions', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(2)
  await store.savePromotion(null, { name: 'Terça do corte', kind: 'service', startsOn: date, endsOn: date, active: true, serviceIds: ['corte'], promoPriceCents: 4000 })
  const route = await handlePublicRoute({ method: 'GET', pathname: '/api/public/promotions', searchParams: new URLSearchParams(), isProduction: false, storage: store, readBody: async () => ({}) })
  assert.equal(route.status, 200)
  assert.equal(route.body.promotions.length, 1)
  const booking = await store.createBookingGroup({ date, customerName: 'Cliente Promo', customerWhatsapp: '(67) 99999-1234', items: [{ serviceId: 'corte', professionalId: 'felipe', time: '09:00' }] })
  assert.equal(booking.totalPriceCents, 4000)
  assert.equal(booking.items[0].priceCents, 4000)
  assert.equal(booking.items[0].promotionName, 'Terça do corte')
})

test('admin route creates a combo and rejects overlapping active service campaigns', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(3)
  const created = await handleAdminRoute(routeCtx(store, 'POST', '/api/admin/promotions', async () => ({ name: 'Combo da semana', kind: 'combo', startsOn: date, endsOn: date, active: true, serviceIds: ['corte', 'barba'], promoPriceCents: 7500 })))
  assert.equal(created.status, 201)
  assert.equal(created.body.promotion.kind, 'combo')
  const conflicting = await handleAdminRoute(routeCtx(store, 'POST', '/api/admin/promotions', async () => ({ name: 'Corte especial', kind: 'service', startsOn: date, endsOn: date, active: true, serviceIds: ['corte'], promoPriceCents: 4000 })))
  assert.equal(conflicting.status, 409)
})

test('confirmed booking becomes receivable after its last procedure ends, but does not count as income until receipt is confirmed', async (t) => {
  const { store } = await createTestStore(t)
  const date = getBusinessDate()
  const booking = await store.createBookingGroup({ date: addDateDays(date, 1), customerName: 'Cliente Caixa', customerWhatsapp: '(67) 99999-2345', items: [{ serviceId: 'corte', professionalId: 'felipe', time: '14:00' }] })
  const group = { ...booking, date: booking.date, items: booking.items }
  const endEpoch = bookingGroupEndEpoch(group)
  assert.ok(endEpoch)
  assert.equal(isBookingGroupReceivable(group, new Date(endEpoch - 1)), false)
  assert.equal(isBookingGroupReceivable(group, new Date(endEpoch + 60_000)), true)
  await store.updateBookingGroupStatus(booking.id, 'completed')
  let finance = await store.getAdminFinance(getBusinessDate().slice(0, 7))
  assert.equal(finance.receivables.some((item) => item.id === booking.id), true)
  assert.equal(finance.entries.some((entry) => entry.sourceType === 'booking_receipt' && entry.sourceId === booking.id), false)
  const receipt = await store.recordBookingReceipt(booking.id, 'Pix')
  assert.equal(receipt.alreadyReceived, false)
  const secondAttempt = await store.recordBookingReceipt(booking.id, 'Pix')
  assert.equal(secondAttempt.alreadyReceived, true)
  finance = await store.getAdminFinance(getBusinessDate().slice(0, 7))
  assert.equal(finance.receivables.some((item) => item.id === booking.id), false)
  assert.equal(finance.entries.filter((entry) => entry.sourceType === 'booking_receipt' && entry.sourceId === booking.id).length, 1)
})

test('combo promotion is enforced by the booking backend and frozen per item', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(2)
  await store.savePromotion(null, { name: 'Corte + barba', kind: 'combo', startsOn: date, endsOn: date, active: true, serviceIds: ['corte', 'barba'], promoPriceCents: 7500 })
  const booking = await store.createBookingGroup({ date, customerName: 'Cliente Combo', customerWhatsapp: '(67) 99999-3456', items: [
    { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
    { serviceId: 'barba', professionalId: 'vitoria', time: '09:30' },
  ] })
  assert.equal(booking.totalPriceCents, 7500)
  assert.equal(booking.items.reduce((sum, item) => sum + item.priceCents, 0), 7500)
  assert.deepEqual(booking.items.map((item) => item.promotionName), ['Corte + barba', 'Corte + barba'])
})

test('admin receipt endpoint records one income only after an eligible appointment', async (t) => {
  const { store } = await createTestStore(t)
  const date = nextWeekday(2)
  const booking = await store.createBookingGroup({ date, customerName: 'Cliente Recebimento', customerWhatsapp: '(67) 99999-5678', items: [{ serviceId: 'corte', professionalId: 'felipe', time: '09:00' }] })
  const routeBase = { method: 'POST', pathname: `/api/admin/finance/booking-groups/${booking.id}/receipt`, searchParams: new URLSearchParams(), storage: store, session: { id: 'ADMIN' }, readBody: async () => ({ paymentMethod: 'Pix' }) }
  const notEligible = await handleAdminRoute(routeBase)
  assert.equal(notEligible.status, 409)
  await store.updateBookingGroupStatus(booking.id, 'completed')
  const recorded = await handleAdminRoute(routeBase)
  assert.equal(recorded.status, 200)
  assert.equal(recorded.body.alreadyReceived, false)
  const repeated = await handleAdminRoute(routeBase)
  assert.equal(repeated.status, 200)
  assert.equal(repeated.body.alreadyReceived, true)
})
