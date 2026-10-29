import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createJsonStore } from '../server/json-store.mjs'
import { createApiServer } from '../server/api.mjs'

async function withApi(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p16-order-lifecycle-'))
  const filePath = path.join(directory, 'local-db.json')
  const store = await createJsonStore({ filePath })
  const server = createApiServer({ store })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  const app = {
    store,
    async json(route, options = {}) {
      const response = await fetch(`http://127.0.0.1:${address.port}${route}`, {
        ...options,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      })
      let body = null
      try { body = await response.json() } catch { /* API could reply without JSON */ }
      return { response, body }
    },
  }
  try { await run(app) }
  finally {
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
}

async function startOrdersSession(app) {
  const current = await app.json('/api/admin/orders/session')
  if (current.body?.session?.status === 'open') return current.body.session
  const started = await app.json('/api/admin/orders/session/start', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(started.response.status, 201, JSON.stringify(started.body))
  return started.body.session
}

async function createProduct(app, product) {
  const { response, body } = await app.json('/api/admin/products', {
    method: 'POST', body: JSON.stringify({
      name: product.name, category: product.category, unit: product.unit ?? (product.kind === 'prepared' ? 'porcao' : 'un'), kind: product.kind ?? 'resale',
      costCents: product.costCents, priceCents: product.priceCents,
      ...(product.kind === 'prepared' ? {} : { stockQuantity: product.stockQuantity ?? 20, stockMinimum: 2 }),
    }),
  })
  assert.equal(response.status, 201, JSON.stringify(body))
  return body.product
}

test('complete order lifecycle with multiple items updates only one receivable and one cash entry', async () => withApi(async (app) => {
  const burger = await createProduct(app, { name: 'X-Burguer ciclo completo', category: 'Lanches preparados', kind: 'prepared', costCents: 850, priceCents: 2000 })
  const soda = await createProduct(app, { name: 'Refrigerante ciclo completo', category: 'Bebidas', costCents: 240, priceCents: 500, stockQuantity: 20 })

  // Register one order with two different products. Submitted client prices must never override catalogue prices.
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({
      customer: 'Balcão - teste de ciclo',
      items: [
        { productId: burger.id, quantity: 2, unitPriceCents: 1 },
        { productId: soda.id, quantity: 3, unitPriceCents: 1 },
      ],
    }),
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.body))
  const order = created.body.order
  assert.equal(order.items.length, 2)
  assert.equal(order.totalCents, 5500) // 2 x R$ 20,00 + 3 x R$ 5,00
  assert.equal(order.status, 'received')
  assert.equal(order.paymentStatus, 'unpaid')
  assert.ok(order.stockReservedAt)

  const initialStockState = await app.store.read()
  assert.equal(initialStockState.products.find((item) => item.id === soda.id).stockMilli, 17000)
  assert.equal(initialStockState.stockMovements.filter((item) => item.sourceType === 'order' && item.sourceId === order.id && item.type === 'order_consumption').length, 1)

  const month = order.orderDate.slice(0, 7)
  let state = await app.store.read()
  let orderReceivables = state.receivables.filter((item) => item.orderId === order.id)
  assert.equal(orderReceivables.length, 1)
  assert.equal(orderReceivables[0].amountCents, 5500)
  assert.equal(orderReceivables[0].status, 'pending')
  assert.equal(state.financialEntries.filter((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id).length, 0)

  let dashboard = await app.json(`/api/admin/dashboard?month=${month}`)
  assert.equal(dashboard.response.status, 200)
  assert.equal(dashboard.body.summary.incomeCents, 0)
  assert.equal(dashboard.body.summary.pendingReceivablesCents, 5500)

  // Advance kitchen/delivery status; this must not imply payment.
  for (const status of ['preparing', 'ready', 'delivered']) {
    const transitioned = await app.json(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    assert.equal(transitioned.response.status, 200, JSON.stringify(transitioned.body))
    assert.equal(transitioned.body.order.status, status)
    assert.equal(transitioned.body.order.paymentStatus, 'unpaid')
    if (status === 'preparing') {
      assert.ok(transitioned.body.order.stockReservedAt)
      const afterReservation = await app.store.read()
      assert.equal(afterReservation.products.find((item) => item.id === soda.id).stockMilli, 17000)
      const consumption = afterReservation.stockMovements.filter((item) => item.sourceType === 'order' && item.sourceId === order.id && item.type === 'order_consumption')
      assert.equal(consumption.length, 1)
      assert.equal(consumption[0].quantityMilli, 3000)
    }
  }
  const afterDelivery = await app.store.read()
  assert.equal(afterDelivery.products.find((item) => item.id === soda.id).stockMilli, 17000)
  assert.equal(afterDelivery.stockMovements.filter((item) => item.sourceType === 'order' && item.sourceId === order.id && item.type === 'order_consumption').length, 1)
  dashboard = await app.json(`/api/admin/dashboard?month=${month}`)
  assert.equal(dashboard.body.summary.incomeCents, 0)
  assert.equal(dashboard.body.summary.pendingReceivablesCents, 5500)

  // Paying from the order is the single source of the income entry.
  const paymentRoute = `/api/admin/orders/${order.id}/pay`
  const paymentOptions = { method: 'POST', body: JSON.stringify({ paymentDate: order.orderDate, paymentMethod: 'Pix' }) }
  const paid = await app.json(paymentRoute, paymentOptions)
  assert.equal(paid.response.status, 200, JSON.stringify(paid.body))
  assert.equal(paid.body.idempotent, false)
  assert.equal(paid.body.order.status, 'delivered')
  assert.equal(paid.body.order.paymentStatus, 'paid')
  assert.equal(paid.body.receivable.status, 'received')
  assert.equal(paid.body.entry.amountCents, 5500)
  assert.equal(paid.body.entry.paymentMethod, 'Pix')

  // Repeating the same payment must be idempotent and must not duplicate cash.
  const repeated = await app.json(paymentRoute, paymentOptions)
  assert.equal(repeated.response.status, 200, JSON.stringify(repeated.body))
  assert.equal(repeated.body.idempotent, true)
  state = await app.store.read()
  orderReceivables = state.receivables.filter((item) => item.orderId === order.id)
  assert.equal(orderReceivables.length, 1)
  assert.equal(orderReceivables[0].status, 'received')
  assert.equal(state.financialEntries.filter((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id).length, 1)
  assert.equal(state.auditLogs.filter((item) => item.action === 'order.payment.received' && item.entityId === order.id).length, 1)

  dashboard = await app.json(`/api/admin/dashboard?month=${month}`)
  assert.equal(dashboard.body.summary.incomeCents, 5500)
  assert.equal(dashboard.body.summary.pendingReceivablesCents, 0)
  assert.equal(dashboard.body.summary.cashResultCents, 5500)

  const orders = await app.json('/api/admin/orders')
  const persistedOrder = orders.body.orders.find((item) => item.id === order.id)
  assert.equal(persistedOrder.status, 'delivered')
  assert.equal(persistedOrder.paymentStatus, 'paid')
  assert.equal(persistedOrder.paymentMethod, 'Pix')
}))

test('cancelling an unpaid order closes its linked receivable without changing cash', async () => withApi(async (app) => {
  const product = await createProduct(app, { name: 'Produto para pedido cancelado', category: 'Bebidas', kind: 'resale', costCents: 1050, priceCents: 2500, stockQuantity: 8 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão - cancelamento', items: [{ productId: product.id, quantity: 2 }] }),
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.body))
  const order = created.body.order
  const month = order.orderDate.slice(0, 7)

  const cancelled = await app.json(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
  assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.body))
  assert.equal(cancelled.body.order.status, 'cancelled')

  const state = await app.store.read()
  assert.equal(state.products.find((item) => item.id === product.id).stockMilli, 8000)
  const stockMoves = state.stockMovements.filter((item) => item.sourceId === order.id && ['order_consumption', 'return'].includes(item.type))
  assert.equal(stockMoves.length, 2)
  assert.equal(stockMoves.filter((item) => item.type === 'order_consumption').length, 1)
  assert.equal(stockMoves.filter((item) => item.type === 'return').length, 1)
  const linked = state.receivables.filter((item) => item.orderId === order.id)
  assert.equal(linked.length, 1)
  assert.equal(linked[0].status, 'cancelled')
  assert.equal(state.financialEntries.filter((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id).length, 0)

  const dashboard = await app.json(`/api/admin/dashboard?month=${month}`)
  assert.equal(dashboard.body.summary.incomeCents, 0)
  assert.equal(dashboard.body.summary.pendingReceivablesCents, 0)
  assert.equal(dashboard.body.summary.cashResultCents, 0)

  const payment = await app.json(`/api/admin/orders/${order.id}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: order.orderDate, paymentMethod: 'Pix' }) })
  assert.equal(payment.response.status, 409)
  assert.equal(payment.body.error, 'ORDER_CANCELLED_CANNOT_BE_PAID')
}))


test('creating an order deducts resale stock immediately and cancelling before delivery returns it once', async () => withApi(async (app) => {
  const product = await createProduct(app, { name: 'Cerveja estoque reserva', category: 'Bebidas', kind: 'resale', costCents: 300, priceCents: 600, stockQuantity: 7 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão - devolução', items: [{ productId: product.id, quantity: 2 }] }),
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.body))
  const order = created.body.order
  const route = `/api/admin/orders/${order.id}/status`

  const preparing = await app.json(route, { method: 'PATCH', body: JSON.stringify({ status: 'preparing' }) })
  assert.equal(preparing.response.status, 200, JSON.stringify(preparing.body))
  assert.equal(preparing.body.order.status, 'preparing')
  let state = await app.store.read()
  assert.equal(state.products.find((item) => item.id === product.id).stockMilli, 5000)
  assert.equal(state.stockMovements.filter((item) => item.sourceType === 'order' && item.sourceId === order.id && item.type === 'order_consumption').length, 1)

  const ready = await app.json(route, { method: 'PATCH', body: JSON.stringify({ status: 'ready' }) })
  assert.equal(ready.response.status, 200, JSON.stringify(ready.body))
  const cancelled = await app.json(route, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
  assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.body))
  assert.ok(cancelled.body.order.stockReleasedAt)

  state = await app.store.read()
  assert.equal(state.products.find((item) => item.id === product.id).stockMilli, 7000)
  const consumed = state.stockMovements.filter((item) => item.sourceType === 'order' && item.sourceId === order.id && item.type === 'order_consumption')
  const returned = state.stockMovements.filter((item) => item.sourceType === 'order_cancellation' && item.sourceId === order.id && item.type === 'return')
  assert.equal(consumed.length, 1)
  assert.equal(returned.length, 1)
  assert.equal(returned[0].quantityMilli, consumed[0].quantityMilli)

  const repeatedCancellation = await app.json(route, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
  assert.equal(repeatedCancellation.response.status, 409)
  state = await app.store.read()
  assert.equal(state.products.find((item) => item.id === product.id).stockMilli, 7000)
  assert.equal(state.stockMovements.filter((item) => item.sourceType === 'order_cancellation' && item.sourceId === order.id && item.type === 'return').length, 1)
}))

test('insufficient stock rejects order creation atomically without deducting any product', async () => withApi(async (app) => {
  await startOrdersSession(app)
  const available = await createProduct(app, { name: 'Produto com saldo suficiente', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 200, stockQuantity: 5 })
  const scarce = await createProduct(app, { name: 'Produto com saldo insuficiente', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 200, stockQuantity: 1 })
  const before = await app.store.read()
  const response = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({
      customer: 'Balcão - teste de estoque',
      items: [{ productId: available.id, quantity: 2 }, { productId: scarce.id, quantity: 2 }],
    }),
  })
  assert.equal(response.response.status, 409, JSON.stringify(response.body))
  assert.equal(response.body.error, 'INSUFFICIENT_STOCK')

  const after = await app.store.read()
  assert.equal(after.orders.length, 0)
  assert.equal(after.products.find((item) => item.id === available.id).stockMilli, 5000)
  assert.equal(after.products.find((item) => item.id === scarce.id).stockMilli, 1000)
  assert.equal(after.stockMovements.length, before.stockMovements.length)
  assert.equal(after.stockMovements.some((item) => item.type === 'order_consumption'), false)
  const currentSession = await app.json('/api/admin/orders/session')
  assert.equal(currentSession.body.session.nextOrderNumber, 1, 'Falha no estoque não deve consumir numeração de pedido.')
}))

test('multiple lines for the same resale product create one aggregated stock movement at order creation', async () => withApi(async (app) => {
  const product = await createProduct(app, { name: 'Produto com linhas repetidas', category: 'Bebidas', unit: 'kg', kind: 'resale', costCents: 100, priceCents: 250, stockQuantity: 10 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({
      customer: 'Balcão - produto repetido',
      items: [{ productId: product.id, quantity: 1.5 }, { productId: product.id, quantity: 2.5 }],
    }),
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.body))
  const order = created.body.order
  const stockAtCreation = await app.store.read()
  assert.equal(stockAtCreation.products.find((item) => item.id === product.id).stockMilli, 6000)
  const preparing = await app.json(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'preparing' }) })
  assert.equal(preparing.response.status, 200, JSON.stringify(preparing.body))

  const state = await app.store.read()
  assert.equal(state.products.find((item) => item.id === product.id).stockMilli, 6000)
  const consumption = state.stockMovements.filter((item) => item.sourceType === 'order' && item.sourceId === order.id && item.type === 'order_consumption')
  assert.equal(consumption.length, 1)
  assert.equal(consumption[0].quantityMilli, 4000)
}))


test('orders require an open session; numbering resets to 001 and history is preserved between sessions', async () => withApi(async (app) => {
  const product = await createProduct(app, { name: 'Produto sessão', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 250, stockQuantity: 10 })
  const blocked = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
  assert.equal(blocked.response.status, 409)
  assert.equal(blocked.body.error, 'ORDER_SESSION_NOT_OPEN')

  const session1 = await startOrdersSession(app)
  const first = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
  const second = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
  assert.equal(first.body.order.number, 1)
  assert.equal(second.body.order.number, 2)
  assert.equal(first.body.order.sessionId, session1.id)
  assert.equal((await app.store.read()).products.find((item) => item.id === product.id).stockMilli, 8000)

  for (const order of [first.body.order, second.body.order]) {
    for (const status of ['preparing', 'ready', 'delivered']) {
      const moved = await app.json(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      assert.equal(moved.response.status, 200, JSON.stringify(moved.body))
    }
  }
  const close = await app.json('/api/admin/orders/session/close', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(close.response.status, 200, JSON.stringify(close.body))
  assert.equal(close.body.session.status, 'closed')
  const oldOrderStatus = await app.json(`/api/admin/orders/${first.body.order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
  assert.equal(oldOrderStatus.response.status, 409)
  assert.equal(oldOrderStatus.body.error, 'ORDER_SESSION_NOT_OPEN')
  const blockedAfterClose = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
  assert.equal(blockedAfterClose.response.status, 409)

  const session2 = await startOrdersSession(app)
  assert.notEqual(session2.id, session1.id)
  const oldSessionEdit = await app.json(`/api/admin/orders/${first.body.order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
  assert.equal(oldSessionEdit.response.status, 409)
  assert.equal(oldSessionEdit.body.error, 'ORDER_SESSION_CLOSED')
  const reset = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
  assert.equal(reset.response.status, 201, JSON.stringify(reset.body))
  assert.equal(reset.body.order.number, 1)
  assert.equal(reset.body.order.sessionId, session2.id)
  const allOrders = await app.json('/api/admin/orders')
  assert.equal(allOrders.body.orders.length, 3)
}))

test('closing a session is blocked while orders are still active', async () => withApi(async (app) => {
  await startOrdersSession(app)
  const product = await createProduct(app, { name: 'Produto sessão ativa', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 250, stockQuantity: 5 })
  const created = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
  assert.equal(created.response.status, 201)
  const close = await app.json('/api/admin/orders/session/close', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(close.response.status, 409)
  assert.equal(close.body.error, 'ORDER_SESSION_HAS_ACTIVE_ORDERS')
  assert.equal(close.body.activeCount, 1)
}))

test('daily and monthly order reports summarize orders and payments linked to those orders', async () => withApi(async (app) => {
  await startOrdersSession(app)
  const product = await createProduct(app, { name: 'Produto relatório', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 1000, stockQuantity: 10 })
  const created = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 2 }] }) })
  assert.equal(created.response.status, 201)
  const order = created.body.order
  const delivered = await app.json(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'preparing' }) })
  assert.equal(delivered.response.status, 200)
  for (const status of ['ready', 'delivered']) assert.equal((await app.json(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })).response.status, 200)
  const paid = await app.json(`/api/admin/orders/${order.id}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: order.orderDate, paymentMethod: 'Pix' }) })
  assert.equal(paid.response.status, 200)

  const day = await app.json(`/api/admin/orders/reports?period=day&date=${order.orderDate}`)
  assert.equal(day.response.status, 200)
  assert.equal(day.body.totals.ordersCount, 1)
  assert.equal(day.body.totals.completedCount, 1)
  assert.equal(day.body.totals.activeValueCents, 2000)
  assert.equal(day.body.totals.paidValueCents, 2000)
  assert.equal(day.body.totals.pendingValueCents, 0)

  const month = await app.json(`/api/admin/orders/reports?period=month&month=${order.orderDate.slice(0, 7)}`)
  assert.equal(month.response.status, 200)
  assert.equal(month.body.totals.ordersCount, 1)
  assert.equal(month.body.totals.activeValueCents, 2000)
  assert.equal(month.body.totals.paidValueCents, 2000)
  assert.equal(month.body.totals.pendingValueCents, 0)
  assert.ok(Array.isArray(month.body.daily))
}))


test('order report assigns payments to the order creation period, not the cash movement date', async () => withApi(async (app) => {
  await startOrdersSession(app)
  const product = await createProduct(app, { name: 'Produto data-base relatório', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 1000, stockQuantity: 10 })
  const createOrder = async () => {
    const created = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }) })
    assert.equal(created.response.status, 201, JSON.stringify(created.body))
    return created.body.order
  }
  const olderOrder = await createOrder()
  const reportDate = olderOrder.orderDate
  const previousDate = new Date(`${reportDate}T12:00:00.000Z`)
  previousDate.setUTCDate(previousDate.getUTCDate() - 1)
  const olderOrderDate = previousDate.toISOString().slice(0, 10)
  const laterDate = new Date(`${reportDate}T12:00:00.000Z`)
  laterDate.setUTCDate(laterDate.getUTCDate() + 1)
  const paymentDateAfterReportDate = laterDate.toISOString().slice(0, 10)

  // This older order is paid on reportDate, but its payment must not be counted
  // in the report for orders created on reportDate.
  const olderPaid = await app.json(`/api/admin/orders/${olderOrder.id}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: reportDate, paymentMethod: 'Pix' }) })
  assert.equal(olderPaid.response.status, 200, JSON.stringify(olderPaid.body))
  await app.store.transact((data) => {
    const stored = data.orders.find((order) => order.id === olderOrder.id)
    stored.businessDate = olderOrderDate
    stored.sessionDate = olderOrderDate
    stored.orderDate = olderOrderDate
  })

  const currentOrder = await createOrder()
  assert.equal(currentOrder.orderDate, reportDate)
  const currentPaid = await app.json(`/api/admin/orders/${currentOrder.id}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: paymentDateAfterReportDate, paymentMethod: 'Pix' }) })
  assert.equal(currentPaid.response.status, 200, JSON.stringify(currentPaid.body))

  const dayReport = await app.json(`/api/admin/orders/reports?period=day&date=${reportDate}`)
  assert.equal(dayReport.response.status, 200)
  assert.equal(dayReport.body.totals.ordersCount, 1)
  assert.equal(dayReport.body.totals.activeValueCents, 1000)
  assert.equal(dayReport.body.totals.paidValueCents, 1000)
  assert.equal(dayReport.body.totals.pendingValueCents, 0)
  assert.deepEqual(dayReport.body.daily.map((line) => line.date), [reportDate])

  const nextDayReport = await app.json(`/api/admin/orders/reports?period=day&date=${paymentDateAfterReportDate}`)
  assert.equal(nextDayReport.response.status, 200)
  assert.equal(nextDayReport.body.totals.ordersCount, 0)
  assert.equal(nextDayReport.body.totals.paidValueCents, 0)
  assert.equal(nextDayReport.body.daily.length, 0)

  const previousDayReport = await app.json(`/api/admin/orders/reports?period=day&date=${olderOrderDate}`)
  assert.equal(previousDayReport.response.status, 200)
  assert.equal(previousDayReport.body.totals.ordersCount, 1)
  assert.equal(previousDayReport.body.totals.paidValueCents, 1000)
}))


test('order report ignores malformed historical payment amounts without producing NaN', async () => withApi(async (app) => {
  await startOrdersSession(app)
  const product = await createProduct(app, { name: 'Produto valor legado inválido', category: 'Bebidas', kind: 'resale', costCents: 100, priceCents: 1250, stockQuantity: 10 })
  const created = await app.json('/api/admin/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 2 }] }) })
  assert.equal(created.response.status, 201, JSON.stringify(created.body))
  const order = created.body.order

  await app.store.transact((data) => {
    data.financialEntries.push({
      id: 'legacy-invalid-payment', direction: 'income', sourceType: 'order_payment', sourceId: order.id,
      amountCents: 'NaN', movementDate: order.orderDate, paymentMethod: 'Pix',
    })
  })

  const report = await app.json(`/api/admin/orders/reports?period=day&date=${order.orderDate}`)
  assert.equal(report.response.status, 200, JSON.stringify(report.body))
  assert.equal(report.body.totals.activeValueCents, 2500)
  assert.equal(report.body.totals.paidValueCents, 0)
  assert.equal(report.body.totals.pendingValueCents, 2500)
  assert.equal(JSON.stringify(report.body).includes('NaN'), false)
}))

test('stock movement rejects vague reasons and preserves the current stock', async () => withApi(async (app) => {
  const product = await createProduct(app, { name: 'Refrigerante validação motivo', category: 'Bebidas', costCents: 200, priceCents: 350, stockQuantity: 12 })
  const before = await app.store.read()
  const response = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: product.id, type: 'adjustment_out', quantity: 1, reason: 'ok', movementDate: '2026-10-17' }),
  })
  assert.equal(response.response.status, 400, JSON.stringify(response.body))
  assert.equal(response.body.error, 'INVALID_STOCK_MOVEMENT_REASON')
  assert.match(response.body.message, /pelo menos 5 caracteres/i)

  const after = await app.store.read()
  const beforeProduct = before.products.find((item) => item.id === product.id)
  const afterProduct = after.products.find((item) => item.id === product.id)
  assert.equal(afterProduct.stockMilli, beforeProduct.stockMilli)
  assert.equal(after.stockMovements.length, before.stockMovements.length)
}))

test('stock movement history shows the product, reason, date and before/after balance', async () => withApi(async (app) => {
  const product = await createProduct(app, { name: 'Água histórico estoque', category: 'Bebidas', costCents: 100, priceCents: 200, stockQuantity: 20 })
  const initialResponse = await app.json('/api/admin/stock-movements')
  assert.equal(initialResponse.response.status, 200, JSON.stringify(initialResponse.body))
  const initial = initialResponse.body.movements.find((item) => item.productId === product.id && item.sourceType === 'product_initial_stock')
  assert.ok(initial)
  assert.equal(initial.productName, 'Água histórico estoque')
  assert.equal(initial.productUnit, 'un')
  assert.equal(initial.beforeMilli, 0)
  assert.equal(initial.afterMilli, 20000)

  const adjustment = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: product.id, type: 'adjustment_out', quantity: 2, reason: 'Conferência física', movementDate: '2026-10-17' }),
  })
  assert.equal(adjustment.response.status, 201, JSON.stringify(adjustment.body))
  assert.equal(adjustment.body.movement.beforeMilli, 20000)
  assert.equal(adjustment.body.movement.afterMilli, 18000)

  const updatedResponse = await app.json(`/api/admin/stock-movements?productId=${encodeURIComponent(product.id)}`)
  assert.equal(updatedResponse.response.status, 200, JSON.stringify(updatedResponse.body))
  const listed = updatedResponse.body.movements.find((item) => item.id === adjustment.body.movement.id)
  assert.ok(listed)
  assert.equal(listed.productName, 'Água histórico estoque')
  assert.equal(listed.reason, 'Conferência física')
  assert.equal(listed.movementDate, '2026-10-17')
  assert.equal(listed.beforeMilli, 20000)
  assert.equal(listed.afterMilli, 18000)
}))

test('closing a session ignores legacy active orders without a session link', async () => withApi(async (app) => {
  const session = await startOrdersSession(app)
  await app.store.transact((data) => {
    data.orders.push({
      id: 'legacy-order-without-session', number: 106, customer: 'Balcão',
      totalCents: 1000, status: 'preparing', paymentStatus: 'unpaid',
      items: [], createdAt: '2026-10-14T18:00:00.000Z', orderDate: '2026-10-14',
    })
  })

  const close = await app.json('/api/admin/orders/session/close', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(close.response.status, 200, JSON.stringify(close.body))
  assert.equal(close.body.session.id, session.id)
  assert.equal(close.body.session.status, 'closed')
  const state = await app.store.read()
  assert.equal(state.orders.find((order) => order.id === 'legacy-order-without-session').status, 'preparing', 'O histórico legado é preservado e não altera o fechamento do expediente atual.')
}))

test('countable order products reject fractional quantities without consuming stock or numbering', async () => withApi(async (app) => {
  await startOrdersSession(app)
  const product = await createProduct(app, { name: 'Refrigerante quantidade inteira', category: 'Bebidas', unit: 'un', costCents: 200, priceCents: 350, stockQuantity: 8 })
  const before = await app.store.read()
  const response = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 1.5 }] }),
  })
  assert.equal(response.response.status, 400, JSON.stringify(response.body))
  assert.equal(response.body.error, 'INVALID_ORDER_ITEM_QUANTITY')
  assert.match(response.body.message, /quantidade inteira/i)
  const after = await app.store.read()
  assert.equal(after.orders.length, before.orders.length)
  assert.equal(after.products.find((item) => item.id === product.id).stockMilli, before.products.find((item) => item.id === product.id).stockMilli)
  assert.equal(after.stockMovements.length, before.stockMovements.length)
  const session = await app.json('/api/admin/orders/session')
  assert.equal(session.body.session.nextOrderNumber, 1)
}))

test('manual stock movements reject fractional quantities for countable products but allow measured units', async () => withApi(async (app) => {
  const countable = await createProduct(app, { name: 'Água quantidade inteira', category: 'Bebidas', unit: 'un', costCents: 100, priceCents: 250, stockQuantity: 8 })
  const before = await app.store.read()
  const rejected = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: countable.id, type: 'purchase', quantity: 1.5, reason: 'Compra teste fornecedor', movementDate: '2026-10-17' }),
  })
  assert.equal(rejected.response.status, 400, JSON.stringify(rejected.body))
  assert.equal(rejected.body.error, 'INVALID_STOCK_MOVEMENT_QUANTITY')
  assert.match(rejected.body.message, /quantidade inteira/i)
  const afterRejected = await app.store.read()
  assert.equal(afterRejected.products.find((item) => item.id === countable.id).stockMilli, before.products.find((item) => item.id === countable.id).stockMilli)
  assert.equal(afterRejected.stockMovements.length, before.stockMovements.length)

  const measured = await createProduct(app, { name: 'Xarope medido por litro', category: 'Insumos', unit: 'l', costCents: 200, priceCents: 500, stockQuantity: 2 })
  const accepted = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: measured.id, type: 'purchase', quantity: 1.5, reason: 'Compra teste fornecedor', movementDate: '2026-10-17' }),
  })
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.body))
  const afterAccepted = await app.store.read()
  assert.equal(afterAccepted.products.find((item) => item.id === measured.id).stockMilli, 3500)
}))
