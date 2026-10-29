import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStorage } from '../server/storage.mjs'
import { handleAdminRoute } from '../server/routes/admin.mjs'
import { getBusinessDate, addDateDays, getWeekday } from '../server/domain/business-time.mjs'
import { validateCustomerInput, validateFinancialEntryInput, validateFinanceMonth, validatePayableInput } from '../server/domain/admin-data-validation.mjs'

async function setup(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p15-admin-data-'))
  const storage = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: path.join(directory, 'local-db.json') }, directory)
  t.after(async () => { await storage.close?.(); await rm(directory, { recursive: true, force: true }) })
  return { storage, directory }
}

function nextWeekday(weekday) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDateDays(getBusinessDate(), offset)
    if (getWeekday(candidate) === weekday) return candidate
  }
  throw new Error('No test date found')
}

function routeContext(storage, overrides = {}) {
  return {
    method: 'GET',
    pathname: '/api/admin/customers',
    searchParams: new URLSearchParams(),
    storage,
    session: { id: 'ADMIN', displayName: 'Administrador', role: 'owner' },
    readBody: async () => ({}),
    ...overrides,
  }
}

test('customer input normalizes WhatsApp and rejects invalid names or duplicate contact', async (t) => {
  const { storage } = await setup(t)
  const customer = await storage.createCustomer({ name: '  Carlos   Teste ', whatsapp: '(67) 99999-1234' })
  assert.equal(customer.name, 'Carlos Teste')
  assert.equal(customer.whatsapp, '67999991234')
  await assert.rejects(storage.createCustomer({ name: 'Outro Cliente', whatsapp: '+55 (67) 99999-1234' }), /CUSTOMER_PHONE_ALREADY_EXISTS/)
  assert.throws(() => validateCustomerInput({ name: 'A', whatsapp: '123' }), /INVALID_CUSTOMER_NAME|INVALID_CUSTOMER_PHONE/)
})

test('customers from public bookings appear in directory and history', async (t) => {
  const { storage } = await setup(t)
  const date = nextWeekday(2)
  await storage.createBookingGroup({ date, customerName: 'Cliente Histórico', customerWhatsapp: '(67) 98888-4321', items: [
    { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
    { serviceId: 'sobrancelha', professionalId: 'vitoria', time: '09:30' },
  ] })
  const listed = await storage.getAdminCustomers('Histórico')
  assert.equal(listed.customers.length, 1)
  assert.equal(listed.customers[0].appointmentCount, 1)
  const history = await storage.getAdminCustomerHistory(listed.customers[0].id)
  assert.equal(history.bookingGroups.length, 1)
  assert.equal(history.bookingGroups[0].items.length, 2)
  assert.equal(history.bookingGroups[0].totalPriceCents, 7000)
  const changed = await storage.updateCustomer(listed.customers[0].id, { name: 'Cliente Renomeado' })
  assert.equal(changed.name, 'Cliente Renomeado')
  await assert.rejects(storage.getAdminCustomerHistory('missing'), /CUSTOMER_NOT_FOUND/)
})

test('manual finance entries are validated and listed by month only', async (t) => {
  const { storage } = await setup(t)
  const today = getBusinessDate()
  const entry = await storage.createFinancialEntry({ direction: 'income', description: 'Corte no balcão', category: 'Atendimento', amountCents: 5000, movementDate: today, paymentMethod: 'Pix' })
  assert.equal(entry.amountCents, 5000)
  assert.equal(entry.sourceType, 'manual')
  const month = await storage.getAdminFinance(today.slice(0, 7))
  assert.equal(month.entries.length, 1)
  assert.equal(month.entries[0].id, entry.id)
  assert.throws(() => validateFinancialEntryInput({ direction: 'income', description: 'A', category: 'Atendimento', amountCents: 10, movementDate: today, paymentMethod: 'Pix' }), /INVALID_FINANCIAL_DESCRIPTION/)
  assert.throws(() => validateFinanceMonth('2026-13'), /INVALID_FINANCE_MONTH/)
  await storage.deleteFinancialEntry(entry.id)
  assert.equal((await storage.getAdminFinance(today.slice(0, 7))).entries.length, 0)
})

test('marking a payable as paid creates exactly one protected expense entry', async (t) => {
  const { storage } = await setup(t)
  const today = getBusinessDate()
  const dueDate = addDateDays(today, 5)
  const payable = await storage.createPayable({ description: 'Lâminas e produtos', category: 'Materiais', amountCents: 12500, dueDate })
  assert.equal(payable.status, 'pending')
  const first = await storage.markPayablePaid(payable.id)
  assert.equal(first.alreadyPaid, false)
  assert.equal(first.payable.status, 'paid')
  const second = await storage.markPayablePaid(payable.id)
  assert.equal(second.alreadyPaid, true)
  const finance = await storage.getAdminFinance(today.slice(0, 7))
  const generated = finance.entries.filter((entry) => entry.sourceType === 'payable_payment' && entry.sourceId === payable.id)
  assert.equal(generated.length, 1)
  assert.equal(generated[0].direction, 'expense')
  assert.equal(generated[0].amountCents, 12500)
  await assert.rejects(storage.deleteFinancialEntry(generated[0].id), /FINANCIAL_ENTRY_PROTECTED/)
  await assert.rejects(storage.deletePayable(payable.id), /PAID_PAYABLE_PROTECTED/)
  assert.throws(() => validatePayableInput({ description: 'Conta', category: 'Luz', amountCents: 0, dueDate }), /INVALID_PAYABLE_AMOUNT/)
})

test('admin APIs expose customers and finance only through the protected route handler', async (t) => {
  const { storage } = await setup(t)
  const today = getBusinessDate()
  const createCustomer = await handleAdminRoute(routeContext(storage, {
    method: 'POST', pathname: '/api/admin/customers', readBody: async () => ({ name: 'Via API', whatsapp: '(67) 97777-1111' }),
  }))
  assert.equal(createCustomer.status, 201)
  const customerList = await handleAdminRoute(routeContext(storage, { searchParams: new URLSearchParams({ search: 'Via API' }) }))
  assert.equal(customerList.body.customers.length, 1)
  const financeCreate = await handleAdminRoute(routeContext(storage, {
    method: 'POST', pathname: '/api/admin/finance/entries', readBody: async () => ({ direction: 'expense', description: 'Café', category: 'Consumo', amountCents: 1500, movementDate: today, paymentMethod: 'Dinheiro' }),
  }))
  assert.equal(financeCreate.status, 201)
  const financeRead = await handleAdminRoute(routeContext(storage, {
    pathname: '/api/admin/finance', searchParams: new URLSearchParams({ month: today.slice(0, 7) }),
  }))
  assert.equal(financeRead.status, 200)
  assert.equal(financeRead.body.entries.length, 1)
  const invalidMonth = await handleAdminRoute(routeContext(storage, { pathname: '/api/admin/finance', searchParams: new URLSearchParams({ month: '2026-99' }) }))
  assert.equal(invalidMonth.status, 400)
})

test('appointment list filters follow the P14-style upcoming, WhatsApp-pending and all tabs', async (t) => {
  const { storage } = await setup(t)
  const date = nextWeekday(2)
  const created = await storage.createBookingGroup({ date, customerName: 'Filtro Agenda', customerWhatsapp: '(67) 96666-1234', items: [
    { serviceId: 'corte', professionalId: 'felipe', time: '09:00' },
  ] })
  const upcoming = await handleAdminRoute(routeContext(storage, {
    pathname: '/api/admin/booking-groups', searchParams: new URLSearchParams({ filter: 'upcoming' }),
  }))
  assert.equal(upcoming.status, 200)
  assert.ok(upcoming.body.bookingGroups.some((group) => group.id === created.id))
  const pending = await handleAdminRoute(routeContext(storage, {
    pathname: '/api/admin/booking-groups', searchParams: new URLSearchParams({ filter: 'pending' }),
  }))
  assert.equal(pending.body.bookingGroups.length, 1)
  await storage.markWhatsAppConfirmationSent(created.id, 'ADMIN')
  const pendingAfterMark = await storage.getAdminBookingGroups('pending')
  assert.equal(pendingAfterMark.bookingGroups.length, 0)
  const all = await storage.getAdminBookingGroups('all')
  assert.equal(all.bookingGroups.length, 1)
})
