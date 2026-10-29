import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLocalDataset, toMysqlDate, toMysqlTime, toMysqlUtcDateTime, validateLocalDataset } from '../scripts/lib/local-json-migration.mjs'

const ids = {
  service: '11111111-1111-4111-8111-111111111111',
  customer: '22222222-2222-4222-8222-222222222222',
  appointment: '33333333-3333-4333-8333-333333333333',
  promotion: '44444444-4444-4444-8444-444444444444',
  financial: '55555555-5555-4555-8555-555555555555',
  payable: '66666666-6666-4666-8666-666666666666',
}

function fixture() {
  const timestamp = '2026-10-10T15:00:00.000Z'
  return {
    schema_version: 1,
    services: [{ id: ids.service, slug: 'volume-brasileiro', name: 'Volume Brasileiro', category: 'Cílios', description: '', duration_minutes: 90, price_cents: 12000, deposit_percent: 30, active: true, sort_order: 10, created_at: timestamp, updated_at: timestamp }],
    business_hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: weekday === 1, start_time: weekday === 1 ? '09:00' : null, end_time: weekday === 1 ? '17:00' : null, break_start: null, break_end: null, updated_at: timestamp })),
    business_policies: { lateness_tolerance_minutes: 10, cancellation_notice_hours: 2, companion_policy: 'Combine previamente.', no_show_policy: 'Avise com antecedência.', updated_at: timestamp },
    date_blocks: [],
    customers: [{ id: ids.customer, name: 'Cliente Teste', phone: '(67) 99999-1234', require_deposit: true, internal_note: 'interno', created_at: timestamp, updated_at: timestamp }],
    promotions: [{ id: ids.promotion, name: 'Promo de teste', starts_on: '2026-10-10', ends_on: '2026-10-20', active: false, created_at: timestamp, updated_at: timestamp, items: [{ service_id: ids.service, promotional_price_cents: 9000 }] }],
    appointments: [{ id: ids.appointment, public_code: 'AB12CD34', customer_name: 'Cliente Teste', customer_phone: '67999991234', customer_note: '', service_id: ids.service, promotion_id: ids.promotion, promotion_name: 'Promo de teste', starts_at: '2026-10-15T17:00:00.000Z', ends_at: '2026-10-15T18:30:00.000Z', price_cents: 9000, regular_price_cents: 12000, deposit_cents: 2700, deposit_required: true, deposit_received: true, deposit_reported: false, policy_acknowledged: true, policy_acknowledged_at: timestamp, policy_snapshot: { acknowledged: true }, status: 'confirmed', created_at: timestamp, updated_at: timestamp }],
    financial_entries: [{ id: ids.financial, direction: 'income', description: 'Sinal recebido', category: 'Sinais', amount_cents: 2700, movement_date: '2026-10-11', payment_method: 'Pix', source_type: 'appointment_deposit', source_id: ids.appointment, related_appointment_id: ids.appointment, created_at: timestamp }],
    payables: [{ id: ids.payable, description: 'Conta de teste', category: 'Estúdio', amount_cents: 5000, due_date: '2026-10-20', status: 'pending', paid_at: null, expense_entry_id: null, created_at: timestamp }],
  }
}

test('local JSON migration produces counts for all P17 modules and accepts cross-references', () => {
  const plan = validateLocalDataset(fixture())
  assert.deepEqual(plan.counts, {
    services: 1, business_hours: 7, business_policies: 1, date_blocks: 0,
    customers: 1, promotions: 1, promotion_items: 1, appointments: 1, financial_entries: 1, payables: 1,
  })
})

test('local JSON migration refuses an appointment that references a missing service', () => {
  const data = fixture()
  data.appointments[0].service_id = '77777777-7777-4777-8777-777777777777'
  assert.throws(() => validateLocalDataset(data), /aponta para um serviço que não existe/)
})

test('local JSON migration detects customer phone duplicates after normalization', () => {
  const data = fixture()
  data.customers.push({ ...data.customers[0], id: '88888888-8888-4888-8888-888888888888', phone: '+55 (67) 99999-1234' })
  assert.throws(() => validateLocalDataset(data), /telefones dos clientes/)
})

test('local JSON migration detects duplicate linked financial sources before hitting the database', () => {
  const data = fixture()
  data.financial_entries.push({ ...data.financial_entries[0], id: '99999999-9999-4999-8999-999999999999' })
  assert.throws(() => validateLocalDataset(data), /duas movimentações com a mesma origem/)
})

test('local JSON migration handles UTC timestamps, dates and times safely', () => {
  assert.equal(toMysqlUtcDateTime('2026-10-11T12:34:56.789Z'), '2026-10-11 12:34:56')
  assert.equal(toMysqlDate('2026-10-11'), '2026-10-11')
  assert.equal(toMysqlTime('9:30'), '09:30:00')
  assert.throws(() => toMysqlTime('25:60'), /não é um horário válido/)
})

test('local JSON migration rejects impossible calendar dates', () => {
  const data = fixture()
  data.promotions[0].starts_on = '2026-02-31'
  assert.throws(() => validateLocalDataset(data), /data real no formato AAAA-MM-DD/)
})

test('local JSON migration requires an explicit current schema and preserves optional collections as empty lists', () => {
  const data = fixture()
  delete data.financial_entries
  assert.deepEqual(normalizeLocalDataset(data).financial_entries, [])
  assert.throws(() => normalizeLocalDataset({ ...data, schema_version: 2 }), /schema_version deve ser 1/)
})
