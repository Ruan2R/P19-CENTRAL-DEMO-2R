import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAmountToCents, formatCentsForPtBr } from '../server/domain/money.mjs'
import { assertUniqueFinancialSource, summarizeFinance, validateFinancialEntry, validatePayable, validateReceivable, markPayablePaid } from '../server/domain/finance.mjs'
import { applyStockMovement, calculateUnitGrossMargin, isStockAtOrBelowMinimum, validateProduct, assertUniqueStockSource } from '../server/domain/inventory.mjs'
import { canTransitionOrderStatus, transitionOrderStatus, validateOrderItems, calculateOrderTotalCents } from '../server/domain/orders.mjs'

test('money: parses BRL decimal and Brazilian thousand separator exactly in cents', () => {
  assert.equal(parseAmountToCents('1234,56'), 123456)
  assert.equal(parseAmountToCents('1.234,56'), 123456)
  assert.equal(parseAmountToCents('R$ 89,9'), 8990)
  assert.equal(parseAmountToCents('89.90'), 8990)
  assert.equal(parseAmountToCents('0'), 0)
})

test('money: rejects invalid or negative amounts', () => {
  for (const value of ['', '-1,00', '1,234', 'abc', '1.2.3']) {
    assert.throws(() => parseAmountToCents(value), /INVALID_MONEY_AMOUNT/)
  }
})

test('money: formats integer cents to Brazilian currency', () => {
  assert.match(formatCentsForPtBr(212350), /2\.123,50/)
})

test('finance: validates a manual income entry', () => {
  assert.deepEqual(validateFinancialEntry({
    direction: 'income', description: 'Venda balcão', category: 'Vendas', amountCents: 2500,
    movementDate: '2026-10-14', paymentMethod: 'Pix',
  }), {
    direction: 'income', description: 'Venda balcão', category: 'Vendas', amountCents: 2500,
    movementDate: '2026-10-14', paymentMethod: 'Pix', sourceType: 'manual', sourceId: null,
  })
})

test('finance: rejects invalid date, direction, and zero amount', () => {
  assert.throws(() => validateFinancialEntry({ direction: 'other', description: 'Venda', category: 'Vendas', amountCents: 500, movementDate: '2026-10-14' }), /INVALID_FINANCIAL_DIRECTION/)
  assert.throws(() => validateFinancialEntry({ direction: 'income', description: 'Venda', category: 'Vendas', amountCents: 0, movementDate: '2026-10-14' }), /INVALID_FINANCIAL_AMOUNT/)
  assert.throws(() => validateFinancialEntry({ direction: 'income', description: 'Venda', category: 'Vendas', amountCents: 500, movementDate: '2026-02-30' }), /INVALID_FINANCIAL_DATE/)
})

test('finance: monthly cash summary ignores other months and keeps open obligations separate', () => {
  const summary = summarizeFinance({
    month: '2026-10',
    entries: [
      { direction: 'income', amountCents: 10000, movementDate: '2026-10-01' },
      { direction: 'expense', amountCents: 2500, movementDate: '2026-10-02' },
      { direction: 'income', amountCents: 7000, movementDate: '2026-09-30' },
    ],
    payables: [{ amountCents: 4000, status: 'pending' }, { amountCents: 800, status: 'paid' }],
    receivables: [{ amountCents: 3200, status: 'pending' }],
  })
  assert.deepEqual(summary, {
    month: '2026-10', incomeCents: 10000, expenseCents: 2500, cashResultCents: 7500,
    pendingPayablesCents: 4000, pendingReceivablesCents: 3200,
  })
})

test('finance: prevents duplicate system-generated entries for the same source', () => {
  const rows = [{ sourceType: 'payable_payment', sourceId: 'p-1' }]
  assert.throws(() => assertUniqueFinancialSource(rows, 'payable_payment', 'p-1'), /DUPLICATE_FINANCIAL_SOURCE/)
  assert.equal(assertUniqueFinancialSource(rows, 'payable_payment', 'p-2'), true)
  assert.equal(assertUniqueFinancialSource(rows, 'manual', null), true)
})

test('finance: validates payables and receivables with pending default status', () => {
  assert.equal(validatePayable({ description: 'Internet', category: 'Contas fixas', amountCents: 12990, dueDate: '2026-10-20' }).status, 'pending')
  assert.equal(validateReceivable({ description: 'Venda a prazo', counterparty: 'Cliente balcão', amountCents: 6000, dueDate: '2026-10-22' }).status, 'pending')
  assert.throws(() => validatePayable({ description: 'Compra insumos', category: 'Estoque', amountCents: 120, dueDate: '2026-13-99' }), /INVALID_PAYABLE_DUE_DATE/)
})

test('finance: only pending payable can be marked paid and must link an expense entry', () => {
  const result = markPayablePaid({ id: 'p1', status: 'pending' }, { paidAt: '2026-10-14T15:00:00.000Z', expenseEntryId: 'e1' })
  assert.equal(result.status, 'paid')
  assert.equal(result.expenseEntryId, 'e1')
  assert.throws(() => markPayablePaid({ status: 'paid' }, { paidAt: '2026-10-14', expenseEntryId: 'e1' }), /PAYABLE_NOT_PENDING/)
})

test('inventory: validates product inputs and returns stock in milli-units', () => {
  const product = validateProduct({ name: 'Cerveja lata', category: 'Adega', unit: 'un', costCents: 430, priceCents: 800, stockQuantity: 12, stockMinimum: 6 })
  assert.equal(product.stockMilli, 12000)
  assert.equal(product.minimumMilli, 6000)
})

test('inventory: applies purchase, sale and fractional quantity movements', () => {
  assert.equal(applyStockMovement(10, { type: 'purchase', quantity: 5 }), 15)
  assert.equal(applyStockMovement(10, { type: 'sale', quantity: 2 }), 8)
  assert.equal(applyStockMovement(1.5, { type: 'waste', quantity: 0.25 }), 1.25)
})

test('inventory: disallows stock below zero and unknown movement types', () => {
  assert.throws(() => applyStockMovement(1, { type: 'sale', quantity: 2 }), /INSUFFICIENT_STOCK/)
  assert.throws(() => applyStockMovement(1, { type: 'unknown', quantity: 1 }), /INVALID_STOCK_MOVEMENT_TYPE/)
})

test('inventory: margin is cost-free cash calculation, not net profit', () => {
  assert.deepEqual(calculateUnitGrossMargin({ costCents: 850, priceCents: 2000 }), { marginCents: 1150, marginPercentOfPrice: 57.5 })
})

test('inventory: flags stock at or below minimum', () => {
  assert.equal(isStockAtOrBelowMinimum({ stockQuantity: 6, stockMinimum: 6 }), true)
  assert.equal(isStockAtOrBelowMinimum({ stockQuantity: 7, stockMinimum: 6 }), false)
})

test('inventory: prevents duplicate stock event source', () => {
  const rows = [{ sourceType: 'order', sourceId: 'o-1', productId: 'p-1', type: 'order_consumption' }]
  assert.throws(() => assertUniqueStockSource(rows, 'order', 'o-1', 'p-1', 'order_consumption'), /DUPLICATE_STOCK_SOURCE/)
  assert.equal(assertUniqueStockSource(rows, 'order', 'o-2', 'p-1', 'order_consumption'), true)
})

test('orders: allows expected forward transitions and rejects skipping steps', () => {
  assert.equal(canTransitionOrderStatus('received', 'preparing'), true)
  assert.equal(canTransitionOrderStatus('preparing', 'ready'), true)
  assert.equal(canTransitionOrderStatus('ready', 'delivered'), true)
  assert.equal(canTransitionOrderStatus('received', 'ready'), false)
  assert.equal(canTransitionOrderStatus('delivered', 'preparing'), false)
})

test('orders: status transition returns a copy and does not mutate original', () => {
  const order = { id: 'o-1', status: 'received' }
  const changed = transitionOrderStatus(order, 'preparing')
  assert.equal(changed.status, 'preparing')
  assert.equal(order.status, 'received')
  assert.throws(() => transitionOrderStatus(order, 'delivered'), /INVALID_ORDER_STATUS_TRANSITION/)
})

test('orders: validates item price, quantity and calculates totals in cents', () => {
  const items = validateOrderItems([
    { productId: 'p1', name: 'X-Burguer', quantity: 2, unitPriceCents: 2000, unitCostCents: 850 },
    { productId: 'p2', name: 'Refrigerante lata', quantity: 1, unitPriceCents: 700, unitCostCents: 320 },
  ])
  assert.equal(items[0].quantityMilli, 2000)
  assert.equal(calculateOrderTotalCents([
    { productId: 'p1', name: 'X-Burguer', quantity: 2, unitPriceCents: 2000, unitCostCents: 850 },
    { productId: 'p2', name: 'Refrigerante lata', quantity: 1, unitPriceCents: 700, unitCostCents: 320 },
  ]), 4700)
})

test('orders: requires at least one valid item', () => {
  assert.throws(() => validateOrderItems([]), /ORDER_REQUIRES_ITEMS/)
  assert.throws(() => calculateOrderTotalCents([{ productId: 'p1', name: 'X', quantity: 0, unitPriceCents: 2000 }]), /INVALID_ORDER_ITEM_NAME/)
})


test('inventory: made-to-order products have no own stock; recipe ingredients are outside MVP', () => {
  const prepared = validateProduct({ name: 'Copão', category: 'Drinks', kind: 'prepared', unit: 'porcao', costCents: 1050, priceCents: 2500 })
  assert.equal(prepared.kind, 'prepared')
  assert.equal(prepared.stockTracked, false)
  assert.equal(prepared.sellable, true)
  assert.equal(prepared.stockMilli, 0)
  assert.equal(prepared.minimumMilli, 0)
  assert.throws(() => validateProduct({ name: 'Whisky para drinks', category: 'Insumos', kind: 'ingredient', unit: 'ml', costCents: 6, priceCents: 0, stockQuantity: 1000, stockMinimum: 200 }), /INVALID_PRODUCT_KIND/)
})
