import { assertNonNegativeCents, assertPositiveCents } from './money.mjs'

const DIRECTIONS = new Set(['income', 'expense'])
const ENTRY_SOURCES = new Set(['manual', 'payable_payment', 'receivable_receipt', 'order_payment'])
const PAYMENT_METHODS = new Set(['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado'])

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function validMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function validateFinancialEntry(input) {
  if (!input || typeof input !== 'object') throw new Error('INVALID_FINANCIAL_ENTRY')
  const description = String(input.description ?? '').trim()
  const category = String(input.category ?? '').trim()
  if (!DIRECTIONS.has(input.direction)) throw new Error('INVALID_FINANCIAL_DIRECTION')
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_FINANCIAL_DESCRIPTION')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_FINANCIAL_CATEGORY')
  assertPositiveCents(input.amountCents, 'INVALID_FINANCIAL_AMOUNT')
  if (!validIsoDate(input.movementDate)) throw new Error('INVALID_FINANCIAL_DATE')
  if (!PAYMENT_METHODS.has(input.paymentMethod ?? 'Não informado')) throw new Error('INVALID_PAYMENT_METHOD')
  const sourceType = input.sourceType ?? 'manual'
  if (!ENTRY_SOURCES.has(sourceType)) throw new Error('INVALID_FINANCIAL_SOURCE')
  if (sourceType !== 'manual' && !(typeof input.sourceId === 'string' && input.sourceId.trim())) {
    throw new Error('FINANCIAL_SOURCE_ID_REQUIRED')
  }
  return {
    direction: input.direction,
    description,
    category,
    amountCents: input.amountCents,
    movementDate: input.movementDate,
    paymentMethod: input.paymentMethod ?? 'Não informado',
    sourceType,
    sourceId: sourceType === 'manual' ? (input.sourceId ?? null) : input.sourceId,
  }
}

/** Throws when a system-generated cash entry already exists for the same source. */
export function assertUniqueFinancialSource(entries, sourceType, sourceId) {
  if (!sourceId) return true
  if (entries.some((entry) => entry.sourceType === sourceType && entry.sourceId === sourceId)) {
    throw new Error('DUPLICATE_FINANCIAL_SOURCE')
  }
  return true
}

/**
 * Summarizes only recorded cash movements for the selected month.
 * Open payables/receivables are displayed separately and are not treated as cash.
 */
export function summarizeFinance({ entries = [], payables = [], receivables = [], month }) {
  if (!validMonth(month)) throw new Error('INVALID_FINANCE_MONTH')
  let incomeCents = 0
  let expenseCents = 0

  for (const entry of entries) {
    const date = entry.movementDate ?? entry.movement_date
    if (typeof date !== 'string' || !date.startsWith(`${month}-`)) continue
    const amount = entry.amountCents ?? entry.amount_cents
    assertPositiveCents(amount, 'INVALID_FINANCIAL_AMOUNT')
    if (entry.direction === 'income') incomeCents += amount
    else if (entry.direction === 'expense') expenseCents += amount
    else throw new Error('INVALID_FINANCIAL_DIRECTION')
  }

  const sumPending = (items, kind) => items.reduce((sum, item) => {
    if (item.status !== 'pending') return sum
    const amount = item.amountCents ?? item.amount_cents
    assertPositiveCents(amount, kind === 'payable' ? 'INVALID_PAYABLE_AMOUNT' : 'INVALID_RECEIVABLE_AMOUNT')
    return sum + amount
  }, 0)

  assertNonNegativeCents(incomeCents + expenseCents, 'INVALID_FINANCE_TOTAL')
  return {
    month,
    incomeCents,
    expenseCents,
    cashResultCents: incomeCents - expenseCents,
    pendingPayablesCents: sumPending(payables, 'payable'),
    pendingReceivablesCents: sumPending(receivables, 'receivable'),
  }
}

export function markPayablePaid(payable, { paidAt, expenseEntryId }) {
  if (!payable || typeof payable !== 'object') throw new Error('PAYABLE_NOT_FOUND')
  if (payable.status !== 'pending') throw new Error('PAYABLE_NOT_PENDING')
  if (!validIsoDate(String(paidAt ?? '').slice(0, 10))) throw new Error('INVALID_PAYABLE_PAYMENT_DATE')
  if (typeof expenseEntryId !== 'string' || !expenseEntryId.trim()) throw new Error('PAYABLE_EXPENSE_ENTRY_REQUIRED')
  return { ...payable, status: 'paid', paidAt, expenseEntryId }
}

export function validatePayable(input) {
  const description = String(input?.description ?? '').trim()
  const category = String(input?.category ?? '').trim()
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_PAYABLE_DESCRIPTION')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_PAYABLE_CATEGORY')
  assertPositiveCents(input.amountCents, 'INVALID_PAYABLE_AMOUNT')
  if (!validIsoDate(input.dueDate)) throw new Error('INVALID_PAYABLE_DUE_DATE')
  return { description, category, amountCents: input.amountCents, dueDate: input.dueDate, status: 'pending' }
}

export function validateReceivable(input) {
  const description = String(input?.description ?? '').trim()
  const counterparty = String(input?.counterparty ?? '').trim()
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_RECEIVABLE_DESCRIPTION')
  if (counterparty.length > 120) throw new Error('INVALID_RECEIVABLE_COUNTERPARTY')
  assertPositiveCents(input.amountCents, 'INVALID_RECEIVABLE_AMOUNT')
  if (!validIsoDate(input.dueDate)) throw new Error('INVALID_RECEIVABLE_DUE_DATE')
  return { description, counterparty: counterparty || null, amountCents: input.amountCents, dueDate: input.dueDate, status: 'pending' }
}
