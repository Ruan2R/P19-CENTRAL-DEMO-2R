import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createJsonStore } from '../server/json-store.mjs'
import { createApiServer } from '../server/api.mjs'

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p16-api-test-'))
  const filePath = path.join(directory, 'local-db.json')
  const store = await createJsonStore({ filePath })
  const server = createApiServer({ store })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  return {
    directory, filePath, store, server, baseUrl,
    async close() {
      server.closeAllConnections?.()
      await new Promise((resolve) => server.close(resolve))
      await rm(directory, { recursive: true, force: true })
    },
    async json(route, options = {}) {
      const response = await fetch(`${baseUrl}${route}`, {
        ...options,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      })
      let body
      try { body = await response.json() } catch { body = null }
      return { response, body }
    },
  }
}

async function withFixture(run) {
  const app = await fixture()
  try { await run(app) } finally { await app.close() }
}

async function startOrdersSession(app) {
  const current = await app.json('/api/admin/orders/session')
  if (current.body?.session?.status === 'open') return current.body.session
  const started = await app.json('/api/admin/orders/session/start', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(started.response.status, 201, JSON.stringify(started.body))
  return started.body.session
}

async function createProduct(app, overrides = {}) {
  const { response, body } = await app.json('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify({
      name: 'X-Burguer', category: 'Hambúrguer', unit: 'un',
      costCents: 850, priceCents: 2000, stockQuantity: 10, stockMinimum: 2, ...overrides,
    }),
  })
  assert.equal(response.status, 201, JSON.stringify(body))
  return body.product
}

test('API health identifies the local-only, non-production status', async () => withFixture(async (app) => {
  const { response, body } = await app.json('/api/health')
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'local-json')
  assert.equal(body.productionReady, false)
}))

test('products persist with centavos, calculated margin and initial stock history', async () => withFixture(async (app) => {
  const product = await createProduct(app)
  assert.equal(product.costCents, 850)
  assert.equal(product.stockQuantity, 10)
  assert.equal(product.margin.marginCents, 1150)
  assert.equal(product.lowStock, false)
  const { body } = await app.json('/api/admin/stock-movements')
  assert.equal(body.movements.length, 1)
  assert.equal(body.movements[0].type, 'adjustment_in')
  assert.equal(body.movements[0].afterMilli, 10000)
}))

test('duplicate product names are rejected', async () => withFixture(async (app) => {
  await createProduct(app)
  const { response, body } = await app.json('/api/admin/products', {
    method: 'POST', body: JSON.stringify({ name: 'x-burguer', category: 'Hambúrguer', unit: 'un', costCents: 850, priceCents: 2000, stockQuantity: 0, stockMinimum: 1 }),
  })
  assert.equal(response.status, 409)
  assert.equal(body.error, 'PRODUCT_NAME_ALREADY_EXISTS')
}))

test('stock movements update the quantity, are audited and prevent negative stock', async () => withFixture(async (app) => {
  const product = await createProduct(app, { stockQuantity: 3 })
  const { response: badResponse, body: badBody } = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: product.id, type: 'sale', quantity: 4, reason: 'Venda balcão' }),
  })
  assert.equal(badResponse.status, 409)
  assert.equal(badBody.error, 'INSUFFICIENT_STOCK')

  const { response, body } = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: product.id, type: 'purchase', quantity: 2, reason: 'Compra fornecedor', movementDate: '2026-10-15' }),
  })
  assert.equal(response.status, 201)
  assert.equal(body.product.stockQuantity, 5)
  const state = await app.store.read()
  assert.equal(state.stockMovements.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.action === 'stock.movement.created').length, 1)
}))

test('manual entries flow into the monthly cash dashboard only by movement date', async () => withFixture(async (app) => {
  const payload = { direction: 'income', description: 'Venda balcão', category: 'Vendas', amountCents: 12500, movementDate: '2026-10-15', paymentMethod: 'Pix' }
  const first = await app.json('/api/admin/finance/entries', { method: 'POST', body: JSON.stringify(payload) })
  assert.equal(first.response.status, 201)
  const second = await app.json('/api/admin/finance/entries', { method: 'POST', body: JSON.stringify({ ...payload, description: 'Venda setembro', movementDate: '2026-09-30' }) })
  assert.equal(second.response.status, 201)
  const dashboard = await app.json('/api/admin/dashboard?month=2026-10')
  assert.equal(dashboard.response.status, 200)
  assert.equal(dashboard.body.summary.incomeCents, 12500)
  assert.equal(dashboard.body.summary.expenseCents, 0)
  assert.equal(dashboard.body.summary.cashResultCents, 12500)
}))

test('paying a payable is atomic and idempotent under repeated requests', async () => withFixture(async (app) => {
  const created = await app.json('/api/admin/finance/payables', {
    method: 'POST', body: JSON.stringify({ description: 'Conta de energia', category: 'Contas fixas', amountCents: 25000, dueDate: '2026-10-20' }),
  })
  assert.equal(created.response.status, 201)
  const route = `/api/admin/finance/payables/${created.body.payable.id}/pay`
  const options = { method: 'POST', body: JSON.stringify({ paymentDate: '2026-10-15', paymentMethod: 'Pix' }) }
  const [first, second] = await Promise.all([app.json(route, options), app.json(route, options)])
  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200)
  const state = await app.store.read()
  assert.equal(state.payables[0].status, 'paid')
  assert.equal(state.financialEntries.filter((item) => item.sourceType === 'payable_payment').length, 1)
  assert.equal(state.auditLogs.filter((item) => item.action === 'finance.payable.paid').length, 1)
  assert.equal([first.body.idempotent, second.body.idempotent].filter(Boolean).length, 1)
}))

test('receiving a receivable creates one matching income entry', async () => withFixture(async (app) => {
  const created = await app.json('/api/admin/finance/receivables', {
    method: 'POST', body: JSON.stringify({ description: 'Venda a prazo', counterparty: 'Cliente do balcão', amountCents: 7900, dueDate: '2026-10-20' }),
  })
  assert.equal(created.response.status, 201)
  const route = `/api/admin/finance/receivables/${created.body.receivable.id}/receive`
  const options = { method: 'POST', body: JSON.stringify({ receivedDate: '2026-10-15', paymentMethod: 'Dinheiro' }) }
  const first = await app.json(route, options)
  const second = await app.json(route, options)
  assert.equal(first.response.status, 200)
  assert.equal(second.body.idempotent, true)
  const state = await app.store.read()
  assert.equal(state.financialEntries.filter((item) => item.sourceType === 'receivable_receipt').length, 1)
  assert.equal(state.financialEntries[0].direction, 'income')
}))

test('order prices come from stored products and resale stock is deducted atomically when the order is created', async () => withFixture(async (app) => {
  const product = await createProduct(app, { priceCents: 2200, stockQuantity: 7 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 2, unitPriceCents: 1 }] }),
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.body.order.totalCents, 4400)
  assert.equal(created.body.order.items[0].unitPriceCents, 2200)
  assert.equal((await app.store.read()).products[0].stockMilli, 5000)

  const id = created.body.order.id
  const skip = await app.json(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ready' }) })
  assert.equal(skip.response.status, 409)
  const preparing = await app.json(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'preparing' }) })
  assert.equal(preparing.response.status, 200)
  assert.equal((await app.store.read()).products[0].stockMilli, 5000)
  const ready = await app.json(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ready' }) })
  assert.equal(ready.response.status, 200)
}))



test('creating an order also creates one linked pending receivable without affecting cash', async () => withFixture(async (app) => {
  const product = await createProduct(app, { priceCents: 2500, stockQuantity: 9 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 2 }] }),
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.body))
  const state = await app.store.read()
  const order = state.orders[0]
  const linked = state.receivables.find((item) => item.orderId === order.id)
  assert.ok(linked)
  assert.equal(linked.status, 'pending')
  assert.equal(linked.amountCents, 5000)
  assert.equal(order.paymentStatus, 'unpaid')
  assert.equal(state.financialEntries.length, 0)
}))

test('marking an order as paid records one income entry and closes its receivable idempotently', async () => withFixture(async (app) => {
  const product = await createProduct(app, { priceCents: 2200 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 2 }] }),
  })
  const order = created.body.order
  const route = `/api/admin/orders/${order.id}/pay`
  const options = { method: 'POST', body: JSON.stringify({ paymentDate: '2026-10-15', paymentMethod: 'Pix' }) }
  const first = await app.json(route, options)
  const second = await app.json(route, { ...options, body: JSON.stringify({ paymentDate: '2026-10-16', paymentMethod: 'Dinheiro' }) })
  assert.equal(first.response.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.idempotent, false)
  assert.equal(second.response.status, 200)
  assert.equal(second.body.idempotent, true)
  const state = await app.store.read()
  assert.equal(state.financialEntries.filter((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id).length, 1)
  assert.equal(state.financialEntries[0].amountCents, 4400)
  assert.equal(state.financialEntries[0].direction, 'income')
  assert.equal(state.financialEntries[0].category, 'Vendas de pedidos')
  assert.equal(state.financialEntries[0].paymentMethod, 'Pix')
  assert.equal(state.orders[0].paymentStatus, 'paid')
  assert.equal(state.receivables.find((item) => item.orderId === order.id).status, 'received')
  const dashboard = await app.json('/api/admin/dashboard?month=2026-10')
  assert.equal(dashboard.body.summary.incomeCents, 4400)
  assert.equal(dashboard.body.summary.pendingReceivablesCents, 0)
}))

test('legacy orders are migrated to pending receivables exactly once on read', async () => withFixture(async (app) => {
  const product = await createProduct(app, { priceCents: 1800 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Pedido legado', items: [{ productId: product.id, quantity: 1 }] }),
  })
  await app.store.transact((data) => {
    data.receivables = []
    delete data.orders[0].receivableId
  })
  const first = await app.json('/api/admin/orders')
  assert.equal(first.response.status, 200)
  assert.equal(first.body.orders[0].paymentStatus, 'unpaid')
  const afterFirst = await app.store.read()
  assert.equal(afterFirst.receivables.filter((item) => item.orderId === created.body.order.id).length, 1)
  await app.json('/api/admin/finance/receivables')
  const afterSecond = await app.store.read()
  assert.equal(afterSecond.receivables.filter((item) => item.orderId === created.body.order.id).length, 1)
}))

test('an order-linked receivable cannot be paid or deleted from the generic receivables route', async () => withFixture(async (app) => {
  const product = await createProduct(app, { priceCents: 2100 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 1 }] }),
  })
  const state = await app.store.read()
  const receivable = state.receivables.find((item) => item.orderId === created.body.order.id)
  const receive = await app.json(`/api/admin/finance/receivables/${receivable.id}/receive`, { method: 'POST', body: JSON.stringify({ receivedDate: '2026-10-15', paymentMethod: 'Pix' }) })
  assert.equal(receive.response.status, 409)
  assert.equal(receive.body.error, 'ORDER_RECEIVABLE_MUST_BE_PAID_FROM_ORDER')
  const remove = await app.json(`/api/admin/finance/receivables/${receivable.id}`, { method: 'DELETE' })
  assert.equal(remove.response.status, 409)
  assert.equal(remove.body.error, 'ORDER_RECEIVABLE_MANAGED_BY_ORDER')
}))

test('paid orders cannot be cancelled until a refund flow exists', async () => withFixture(async (app) => {
  const product = await createProduct(app, { priceCents: 2600 })
  await startOrdersSession(app)
  const created = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 1 }] }),
  })
  await app.json(`/api/admin/orders/${created.body.order.id}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: '2026-10-15', paymentMethod: 'Pix' }) })
  const cancelled = await app.json(`/api/admin/orders/${created.body.order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
  assert.equal(cancelled.response.status, 409)
  assert.equal(cancelled.body.error, 'PAID_ORDER_CANNOT_BE_CANCELLED_WITHOUT_REFUND')
}))

test('an order can contain multiple products and totals each line from stored prices', async () => withFixture(async (app) => {
  const burger = await createProduct(app, { name: 'X-Burguer multi-item', priceCents: 2000, stockQuantity: 7 })
  const soda = await createProduct(app, { name: 'Refrigerante multi-item', category: 'Bebidas', costCents: 240, priceCents: 500, stockQuantity: 20 })
  await startOrdersSession(app)
  const { response, body } = await app.json('/api/admin/orders', {
    method: 'POST', body: JSON.stringify({
      customer: 'Balcão',
      items: [
        { productId: burger.id, quantity: 2, unitPriceCents: 1 },
        { productId: soda.id, quantity: 3, unitPriceCents: 1 },
      ],
    }),
  })
  assert.equal(response.status, 201, JSON.stringify(body))
  assert.equal(body.order.items.length, 2)
  assert.equal(body.order.totalCents, 5500)
  assert.equal(body.order.items[0].lineTotalCents, 4000)
  assert.equal(body.order.items[1].lineTotalCents, 1500)
  assert.equal(body.order.paymentStatus, 'unpaid')
  const receivables = await app.json('/api/admin/finance/receivables')
  assert.equal(receivables.body.receivables.filter((item) => item.orderId === body.order.id).length, 1)
}))

test('local API rejects non-local origins and unknown endpoints', async () => withFixture(async (app) => {
  const forbidden = await app.json('/api/admin/products', { headers: { Origin: 'https://example.com' } })
  assert.equal(forbidden.response.status, 403)
  const missing = await app.json('/api/does-not-exist')
  assert.equal(missing.response.status, 404)
}))

test('data survives store reinitialization from the same local JSON file', async () => withFixture(async (app) => {
  await createProduct(app, { name: 'Refrigerante lata', category: 'Bebida', stockQuantity: 8 })
  const restartedStore = await createJsonStore({ filePath: app.filePath })
  const data = await restartedStore.read()
  assert.equal(data.products.length, 1)
  assert.equal(data.products[0].name, 'Refrigerante lata')
  assert.equal(data.products[0].stockMilli, 8000)
}))


test('prepared products do not use direct stock and cannot receive stock movements', async () => withFixture(async (app) => {
  const { response, body } = await app.json('/api/admin/products', {
    method: 'POST', body: JSON.stringify({
      name: 'Copão de demonstração', category: 'Drinks preparados', kind: 'prepared', unit: 'porcao',
      costCents: 1050, priceCents: 2500,
    }),
  })
  assert.equal(response.status, 201, JSON.stringify(body))
  assert.equal(body.product.kind, 'prepared')
  assert.equal(body.product.stockTracked, false)
  assert.equal(body.product.stockQuantity, null)
  assert.equal(body.product.lowStock, false)
  const movement = await app.json('/api/admin/stock-movements', {
    method: 'POST', body: JSON.stringify({ productId: body.product.id, type: 'sale', quantity: 1, reason: 'Teste de preparo' }),
  })
  assert.equal(movement.response.status, 409)
  assert.equal(movement.body.error, 'PRODUCT_STOCK_NOT_TRACKED')
}))

test('MVP rejects ingredient/recipe stock types to keep the product flow simple', async () => withFixture(async (app) => {
  const { response, body } = await app.json('/api/admin/products', {
    method: 'POST', body: JSON.stringify({
      name: 'Whisky para drinks', category: 'Insumos', kind: 'ingredient', unit: 'ml',
      costCents: 600, priceCents: 0, stockQuantity: 1000, stockMinimum: 200,
    }),
  })
  assert.equal(response.status, 400)
  assert.equal(body.error, 'INVALID_PRODUCT_KIND')
}))

test('demo seed adds example data once without duplicating entries on re-run', async () => withFixture(async (app) => {
  const first = await app.json('/api/admin/demo-seed', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(first.response.status, 201, JSON.stringify(first.body))
  assert.equal(first.body.newProducts, 8)
  assert.equal(first.body.newEntries, 6)
  assert.equal(first.body.newPayables, 2)
  assert.equal(first.body.newReceivables, 1)
  assert.equal(first.body.newOrders, 3)

  const snapshot = await app.store.read()
  assert.equal(snapshot.products.filter((item) => item.kind === 'prepared').length, 5)
  assert.equal(snapshot.products.filter((item) => item.kind === 'resale').length, 3)
  assert.equal(snapshot.stockMovements.length, 3)
  assert.equal(snapshot.products.find((item) => item.name === 'Copão tradicional').stockTracked, false)
  assert.equal(snapshot.products.find((item) => item.name === 'Refrigerante lata 350 ml').stockMilli, 48000)

  const second = await app.json('/api/admin/demo-seed', { method: 'POST', body: JSON.stringify({}) })
  assert.equal(second.response.status, 200)
  assert.equal(second.body.alreadySeeded, true)
  const afterSecond = await app.store.read()
  assert.equal(afterSecond.products.length, 8)
  assert.equal(afterSecond.financialEntries.length, 6)
  assert.equal(afterSecond.payables.length, 2)
  assert.equal(afterSecond.receivables.length, 1)
  assert.equal(afterSecond.orders.length, 3)
}))

test('pending payable can be deleted without creating a cash movement', async () => withFixture(async (app) => {
  const created = await app.json('/api/admin/finance/payables', {
    method: 'POST', body: JSON.stringify({ description: 'Aluguel duplicado de teste', category: 'Despesas fixas', amountCents: 150000, dueDate: '2026-10-20' }),
  })
  assert.equal(created.response.status, 201)
  const removed = await app.json(`/api/admin/finance/payables/${created.body.payable.id}`, { method: 'DELETE' })
  assert.equal(removed.response.status, 200)
  assert.equal(removed.body.deleted, true)
  const state = await app.store.read()
  assert.equal(state.payables.length, 0)
  assert.equal(state.financialEntries.length, 0)
  assert.equal(state.auditLogs.some((item) => item.action === 'finance.payable.deleted'), true)
}))

test('paid payable cannot be deleted because its cash history must remain', async () => withFixture(async (app) => {
  const created = await app.json('/api/admin/finance/payables', {
    method: 'POST', body: JSON.stringify({ description: 'Conta já paga', category: 'Despesas fixas', amountCents: 150000, dueDate: '2026-10-20' }),
  })
  const id = created.body.payable.id
  await app.json(`/api/admin/finance/payables/${id}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: '2026-10-15', paymentMethod: 'Pix' }) })
  const removed = await app.json(`/api/admin/finance/payables/${id}`, { method: 'DELETE' })
  assert.equal(removed.response.status, 409)
  assert.equal(removed.body.error, 'PAYABLE_ALREADY_PAID')
  assert.equal((await app.store.read()).payables.length, 1)
}))

test('pending receivable can be deleted; received receivable is protected', async () => withFixture(async (app) => {
  const pending = await app.json('/api/admin/finance/receivables', {
    method: 'POST', body: JSON.stringify({ description: 'Cobrança de teste', counterparty: 'Balcão', amountCents: 4200, dueDate: '2026-10-20' }),
  })
  const removedPending = await app.json(`/api/admin/finance/receivables/${pending.body.receivable.id}`, { method: 'DELETE' })
  assert.equal(removedPending.response.status, 200)
  const received = await app.json('/api/admin/finance/receivables', {
    method: 'POST', body: JSON.stringify({ description: 'Venda já recebida', counterparty: 'Balcão', amountCents: 5200, dueDate: '2026-10-20' }),
  })
  const id = received.body.receivable.id
  await app.json(`/api/admin/finance/receivables/${id}/receive`, { method: 'POST', body: JSON.stringify({ receivedDate: '2026-10-15', paymentMethod: 'Pix' }) })
  const removedReceived = await app.json(`/api/admin/finance/receivables/${id}`, { method: 'DELETE' })
  assert.equal(removedReceived.response.status, 409)
  assert.equal(removedReceived.body.error, 'RECEIVABLE_ALREADY_RECEIVED')
  const state = await app.store.read()
  assert.equal(state.receivables.length, 1)
  assert.equal(state.financialEntries.length, 1)
}))

test('unreferenced product can be deleted and product with history is archived from catalog', async () => withFixture(async (app) => {
  const unreferenced = await createProduct(app, { name: 'Produto provisório', stockQuantity: 0 })
  const deleted = await app.json(`/api/admin/products/${unreferenced.id}`, { method: 'DELETE' })
  assert.equal(deleted.response.status, 200)
  assert.equal(deleted.body.deleted, true)
  assert.equal(deleted.body.archived, false)

  const withHistory = await createProduct(app, { name: 'Refrigerante de teste', stockQuantity: 10 })
  const archived = await app.json(`/api/admin/products/${withHistory.id}`, { method: 'DELETE' })
  assert.equal(archived.response.status, 200)
  assert.equal(archived.body.archived, true)
  const visible = await app.json('/api/admin/products')
  assert.equal(visible.body.products.length, 0)
  const state = await app.store.read()
  assert.equal(state.stockMovements.length, 1)
  assert.equal(state.products[0].active, false)
  assert.equal(state.auditLogs.some((item) => item.action === 'product.archived'), true)
}))
