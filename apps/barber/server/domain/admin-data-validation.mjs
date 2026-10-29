import { getBusinessDate, isValidDate } from './business-time.mjs'
import { normalizeBrazilPhone } from './booking-validation.mjs'

const PAYMENT_METHODS = new Set(['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro'])

export function validateCustomerInput(payload = {}, { requirePhone = true } = {}) {
  const name = String(payload.name ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 100) throw new Error('INVALID_CUSTOMER_NAME')
  if (!requirePhone && payload.whatsapp == null && payload.phoneNormalized == null && payload.phone == null) return { name }
  const source = payload.whatsapp ?? payload.phoneNormalized ?? payload.phone ?? ''
  return { name, phoneNormalized: normalizeBrazilPhone(source) }
}

export function validateCustomerName(payload = {}) {
  return validateCustomerInput(payload, { requirePhone: false }).name
}

export function validateFinancialEntryInput(payload = {}, now = new Date()) {
  const direction = String(payload.direction ?? '')
  const description = String(payload.description ?? '').trim().replace(/\s+/g, ' ')
  const category = String(payload.category ?? '').trim().replace(/\s+/g, ' ')
  const amountCents = Number(payload.amountCents ?? payload.amount_cents)
  const movementDate = String(payload.movementDate ?? payload.movement_date ?? '')
  const paymentMethod = String(payload.paymentMethod ?? payload.payment_method ?? 'Não informado').trim() || 'Não informado'
  if (!['income', 'expense'].includes(direction)) throw new Error('INVALID_FINANCIAL_DIRECTION')
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_FINANCIAL_DESCRIPTION')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_FINANCIAL_CATEGORY')
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000_000) throw new Error('INVALID_FINANCIAL_AMOUNT')
  if (!isValidDate(movementDate) || movementDate > getBusinessDate(now)) throw new Error('INVALID_FINANCIAL_DATE')
  if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD')
  return { direction, description, category, amountCents, movementDate, paymentMethod }
}

export function validatePayableInput(payload = {}) {
  const description = String(payload.description ?? '').trim().replace(/\s+/g, ' ')
  const category = String(payload.category ?? '').trim().replace(/\s+/g, ' ')
  const amountCents = Number(payload.amountCents ?? payload.amount_cents)
  const dueDate = String(payload.dueDate ?? payload.due_date ?? '')
  if (description.length < 2 || description.length > 120) throw new Error('INVALID_PAYABLE_DESCRIPTION')
  if (category.length < 2 || category.length > 80) throw new Error('INVALID_PAYABLE_CATEGORY')
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000_000) throw new Error('INVALID_PAYABLE_AMOUNT')
  if (!isValidDate(dueDate)) throw new Error('INVALID_PAYABLE_DUE_DATE')
  return { description, category, amountCents, dueDate }
}

export function validateFinanceMonth(value) {
  const month = String(value ?? '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_FINANCE_MONTH')
  return month
}
