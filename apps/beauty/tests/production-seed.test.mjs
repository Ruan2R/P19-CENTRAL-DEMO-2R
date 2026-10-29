import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductionSeed } from '../scripts/lib/production-seed.mjs'

const serviceId = '11111111-1111-4111-8111-111111111111'
const appointmentId = '22222222-2222-4222-8222-222222222222'
const customerId = '33333333-3333-4333-8333-333333333333'
const promotionId = '44444444-4444-4444-8444-444444444444'
const entryId = '55555555-5555-4555-8555-555555555555'
const payableId = '66666666-6666-4666-8666-666666666666'

function fixture() {
  return {
    schema_version: 1,
    services: [{ id: serviceId, slug: 'service-test', name: 'Serviço de teste', category: 'Teste', description: '', duration_minutes: 60, price_cents: 10000, deposit_percent: 30, active: true, sort_order: 1 }],
    business_hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: false, start_time: null, end_time: null, break_start: null, break_end: null })),
    business_policies: { lateness_tolerance_minutes: 10, cancellation_notice_hours: 2, companion_policy: 'Política de acompanhante para teste.', no_show_policy: 'Política de falta para teste.' },
    date_blocks: [{ id: '77777777-7777-4777-8777-777777777777', blocked_date: '2026-10-20', start_time: null, end_time: null, note: 'bloqueio usado no teste' }],
    customers: [{ id: customerId, name: 'Cliente fictícia', phone: '11987654321', require_deposit: true, internal_note: 'nota de teste' }],
    promotions: [{ id: promotionId, name: 'Promo usada no teste', starts_on: '2026-10-12', ends_on: '2026-10-20', active: true, items: [{ service_id: serviceId, promotional_price_cents: 9000 }] }],
    appointments: [{ id: appointmentId, public_code: 'TEST1234', customer_name: 'Cliente fictícia', customer_phone: '11987654321', service_id: serviceId, starts_at: '2026-10-14T14:00:00.000Z', ends_at: '2026-10-14T15:00:00.000Z', price_cents: 9000, deposit_cents: 2700, status: 'confirmed' }],
    financial_entries: [{ id: entryId, direction: 'income', description: 'sinal teste', category: 'Serviço', amount_cents: 2700, movement_date: '2026-10-11', source_type: 'manual', source_id: null, related_appointment_id: appointmentId }],
    payables: [{ id: payableId, description: 'Despesa fictícia', category: 'Teste', amount_cents: 5000, due_date: '2026-10-20', status: 'pending', expense_entry_id: null }],
  }
}

test('production seed preserves service, weekly hours and policies but removes test/operational records', () => {
  const source = fixture()
  const originalCopy = structuredClone(source)
  const result = createProductionSeed(source)

  assert.deepEqual(source, originalCopy, 'source data must not be mutated')
  assert.equal(result.data.services.length, 1)
  assert.equal(result.data.business_hours.length, 7)
  assert.deepEqual(result.data.business_policies, source.business_policies)
  assert.deepEqual(result.data.date_blocks, [])
  assert.deepEqual(result.data.customers, [])
  assert.deepEqual(result.data.promotions, [])
  assert.deepEqual(result.data.appointments, [])
  assert.deepEqual(result.data.financial_entries, [])
  assert.deepEqual(result.data.payables, [])
  assert.equal(result.sourceCounts.appointments, 1)
  assert.equal(result.sourceCounts.financial_entries, 1)
  assert.equal(result.outputCounts.appointments, 0)
  assert.equal(result.outputCounts.financial_entries, 0)
})

test('production seed refuses an invalid schema or missing business configuration', () => {
  assert.throws(() => createProductionSeed({ schema_version: 2 }), /schema_version deve ser 1/)
  const invalid = fixture()
  invalid.business_policies = null
  assert.throws(() => createProductionSeed(invalid), /business_policies/)
})
