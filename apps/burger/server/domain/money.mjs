/**
 * Monetary helpers for P16.
 * All persisted/calculated money is represented as integer centavos (BRL).
 */

export function parseAmountToCents(value) {
  if (value === null || value === undefined || value === '') {
    throw new Error('INVALID_MONEY_AMOUNT')
  }

  let text = String(value).trim().replace(/R\$/gi, '').replace(/\s/g, '')
  if (!text || text.startsWith('-') || text.startsWith('+')) {
    throw new Error('INVALID_MONEY_AMOUNT')
  }

  // Brazilian input: 1.234,56. Without comma, accept standard decimal input: 1234.56.
  if (text.includes(',')) {
    if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/.test(text)) {
      throw new Error('INVALID_MONEY_AMOUNT')
    }
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('INVALID_MONEY_AMOUNT')
  }

  const [whole, fraction = ''] = text.split('.')
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error('INVALID_MONEY_AMOUNT')
  }
  return cents
}

export function assertPositiveCents(value, code = 'INVALID_MONEY_AMOUNT') {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code)
  return value
}

export function assertNonNegativeCents(value, code = 'INVALID_MONEY_AMOUNT') {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code)
  return value
}

export function formatCentsForPtBr(cents) {
  assertNonNegativeCents(cents)
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
