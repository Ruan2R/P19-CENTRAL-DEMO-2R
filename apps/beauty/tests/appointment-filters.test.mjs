import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAppointments } from '../src/lib/appointment-filters.mjs'

const NOW = new Date('2026-10-24T16:00:00.000Z') // 12:00 in America/Campo_Grande

function appointment(overrides = {}) {
  return {
    id: 'appt-1',
    public_code: 'ANA12345',
    customer_name: 'João da Silva',
    customer_phone: '(67) 99999-1111',
    starts_at: '2026-10-24T17:00:00.000Z',
    status: 'confirmed',
    service: { name: 'Lash lifting' },
    service_items: [{ name: 'Lash lifting' }],
    ...overrides,
  }
}

const options = (overrides = {}) => ({
  mode: 'all',
  search: '',
  status: 'all',
  period: 'any',
  dateFrom: '',
  dateTo: '',
  ...overrides,
})

test('keeps the existing Próximos and Pendentes shortcuts', () => {
  const items = [
    appointment({ id: 'future-confirmed' }),
    appointment({ id: 'future-pending', status: 'pending_confirmation', starts_at: '2026-10-25T17:00:00.000Z' }),
    appointment({ id: 'future-deposit', status: 'awaiting_deposit', starts_at: '2026-10-26T17:00:00.000Z' }),
    appointment({ id: 'past-pending', status: 'pending_confirmation', starts_at: '2026-10-23T17:00:00.000Z' }),
    appointment({ id: 'future-completed', status: 'completed', starts_at: '2026-10-27T17:00:00.000Z' }),
  ]
  assert.deepEqual(filterAppointments(items, options({ mode: 'upcoming' }), NOW).map((item) => item.id), [
    'future-confirmed', 'future-pending', 'future-deposit',
  ])
  assert.deepEqual(filterAppointments(items, options({ mode: 'pending' }), NOW).map((item) => item.id), [
    'past-pending', 'future-pending', 'future-deposit',
  ])
})

test('searches customer names without accent sensitivity, phone digits, procedure and booking code', () => {
  const items = [appointment()]
  assert.equal(filterAppointments(items, options({ search: 'Joao da Silva' }), NOW).length, 1)
  assert.equal(filterAppointments(items, options({ search: '999991111' }), NOW).length, 1)
  assert.equal(filterAppointments(items, options({ search: 'lifting' }), NOW).length, 1)
  assert.equal(filterAppointments(items, options({ search: 'ANA12345' }), NOW).length, 1)
  assert.equal(filterAppointments(items, options({ search: 'cliente inexistente' }), NOW).length, 0)
})

test('status filter can find completed and cancelled appointments', () => {
  const items = [
    appointment({ id: 'confirmed' }),
    appointment({ id: 'completed', status: 'completed' }),
    appointment({ id: 'cancelled', status: 'cancelled' }),
  ]
  assert.deepEqual(filterAppointments(items, options({ status: 'completed' }), NOW).map((item) => item.id), ['completed'])
  assert.deepEqual(filterAppointments(items, options({ status: 'cancelled' }), NOW).map((item) => item.id), ['cancelled'])
})

test('filters dates by the studio business timezone for today, next 7 days and current month', () => {
  const items = [
    appointment({ id: 'today', starts_at: '2026-10-24T17:00:00.000Z' }),
    appointment({ id: 'seven-days-end', starts_at: '2026-10-30T17:00:00.000Z' }),
    appointment({ id: 'next-month', starts_at: '2026-11-01T17:00:00.000Z' }),
  ]
  assert.deepEqual(filterAppointments(items, options({ period: 'today' }), NOW).map((item) => item.id), ['today'])
  assert.deepEqual(filterAppointments(items, options({ period: 'next7' }), NOW).map((item) => item.id), ['today', 'seven-days-end'])
  assert.deepEqual(filterAppointments(items, options({ period: 'month' }), NOW).map((item) => item.id), ['today', 'seven-days-end'])
})

test('custom date range includes its boundary dates and rejects an inverted range', () => {
  const items = [
    appointment({ id: 'before', starts_at: '2026-10-23T17:00:00.000Z' }),
    appointment({ id: 'start', starts_at: '2026-10-24T17:00:00.000Z' }),
    appointment({ id: 'end', starts_at: '2026-10-26T17:00:00.000Z' }),
    appointment({ id: 'after', starts_at: '2026-10-27T17:00:00.000Z' }),
  ]
  assert.deepEqual(filterAppointments(items, options({ period: 'custom', dateFrom: '2026-10-24', dateTo: '2026-10-26' }), NOW).map((item) => item.id), ['start', 'end'])
  assert.deepEqual(filterAppointments(items, options({ period: 'custom', dateFrom: '2026-10-27', dateTo: '2026-10-24' }), NOW), [])
})
