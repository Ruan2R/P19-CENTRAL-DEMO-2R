import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { URL } from 'node:url'
import {
  assertUniqueFinancialSource,
  markPayablePaid, summarizeFinance, validateFinancialEntry, validatePayable, validateReceivable,
} from './domain/finance.mjs'
import { applyStockMovement, assertUniqueStockSource, calculateUnitGrossMargin, isStockAtOrBelowMinimum, validateProduct } from './domain/inventory.mjs'
import { calculateOrderTotalCents, transitionOrderStatus, validateOrderItems } from './domain/orders.mjs'

const MAX_BODY_BYTES = 64 * 1024
const LOCAL_ORIGINS = new Set([
  'http://127.0.0.1:5173', 'http://localhost:5173',
  'http://127.0.0.1:3001', 'http://localhost:3001',
])
const STOCK_TYPES = new Set(['purchase', 'return', 'adjustment_in', 'sale', 'order_consumption', 'adjustment_out', 'waste'])
const PAYMENT_METHODS = new Set(['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado'])

function businessDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function responseJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 })
    chunks.push(chunk)
  }
  if (size === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_JSON')
    return parsed
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { status: 400 })
  }
}

function validateLocalOrigin(request) {
  const origin = request.headers.origin
  return !origin || LOCAL_ORIGINS.has(origin)
}

function apiError(error) {
  const code = typeof error?.message === 'string' ? error.message : 'INTERNAL_ERROR'
  const notFound = new Set(['PRODUCT_NOT_FOUND', 'PAYABLE_NOT_FOUND', 'RECEIVABLE_NOT_FOUND', 'ORDER_NOT_FOUND'])
  const conflicts = new Set([
    'INSUFFICIENT_STOCK', 'DUPLICATE_STOCK_SOURCE', 'DUPLICATE_FINANCIAL_SOURCE', 'PRODUCT_STOCK_NOT_TRACKED', 'PRODUCT_NOT_SELLABLE',
    'PAYABLE_NOT_PENDING', 'RECEIVABLE_NOT_PENDING', 'PAYABLE_ALREADY_PAID', 'RECEIVABLE_ALREADY_RECEIVED',
    'INVALID_ORDER_STATUS_TRANSITION', 'PRODUCT_STOCK_MUST_USE_MOVEMENT',
    'ORDER_CANCELLED_CANNOT_BE_PAID', 'ORDER_PAYMENT_HISTORY_INCONSISTENT',
    'ORDER_RECEIVABLE_MUST_BE_PAID_FROM_ORDER', 'ORDER_RECEIVABLE_MANAGED_BY_ORDER',
    'PAID_ORDER_CANNOT_BE_CANCELLED_WITHOUT_REFUND', 'ORDER_SESSION_NOT_OPEN', 'ORDER_SESSION_ALREADY_OPEN',
    'ORDER_SESSION_NOT_FOUND', 'ORDER_SESSION_HAS_ACTIVE_ORDERS', 'ORDER_SESSION_CLOSED', 'INVALID_REPORT_PERIOD',
  ])
  let status = Number(error?.status) || 400
  if (notFound.has(code)) status = 404
  else if (conflicts.has(code)) status = 409
  else if (code === 'REQUEST_TOO_LARGE') status = 413
  else if (code === 'INTERNAL_ERROR') status = 500
  const messages = {
    PRODUCT_NOT_FOUND: 'Produto não encontrado.',
    PAYABLE_NOT_FOUND: 'Conta a pagar não encontrada.',
    RECEIVABLE_NOT_FOUND: 'Valor a receber não encontrado.',
    ORDER_NOT_FOUND: 'Pedido não encontrado.',
    ORDER_CANCELLED_CANNOT_BE_PAID: 'Pedidos cancelados não podem ser marcados como pagos.',
    ORDER_PAYMENT_HISTORY_INCONSISTENT: 'O pedido indica pagamento, mas não há lançamento financeiro correspondente. Confira o histórico antes de continuar.',
    ORDER_RECEIVABLE_MUST_BE_PAID_FROM_ORDER: 'Valores gerados por pedidos devem ser recebidos pela ação de pagamento na aba Pedidos.',
    ORDER_RECEIVABLE_MANAGED_BY_ORDER: 'Esse valor está vinculado a um pedido. Gerencie o pagamento ou cancelamento pela aba Pedidos.',
    PAID_ORDER_CANNOT_BE_CANCELLED_WITHOUT_REFUND: 'Não é possível cancelar um pedido pago sem registrar o estorno correspondente. O fluxo de estorno ainda não está disponível.',
    ORDER_SESSION_NOT_OPEN: 'O atendimento está encerrado. Clique em “Iniciar atendimento” para liberar os pedidos.',
    ORDER_SESSION_ALREADY_OPEN: 'Já existe um atendimento aberto.',
    ORDER_SESSION_NOT_FOUND: 'Atendimento não encontrado.',
    ORDER_SESSION_HAS_ACTIVE_ORDERS: 'Finalize ou cancele todos os pedidos em andamento antes de encerrar o atendimento.',
    ORDER_SESSION_CLOSED: 'Este pedido pertence a um atendimento encerrado. Reabra um atendimento para registrar novos pedidos; o histórico anterior fica preservado.',
    INVALID_REPORT_PERIOD: 'Informe um período válido para o relatório: dia ou mês.',
    INSUFFICIENT_STOCK: 'Estoque insuficiente para essa movimentação.',
    DUPLICATE_STOCK_SOURCE: 'Essa movimentação de estoque já foi registrada.',
    DUPLICATE_FINANCIAL_SOURCE: 'Esse evento financeiro já foi registrado.',
    PAYABLE_NOT_PENDING: 'Essa conta já foi paga ou não está pendente.',
    RECEIVABLE_NOT_PENDING: 'Esse valor já foi recebido ou não está pendente.',
    PAYABLE_ALREADY_PAID: 'Contas já pagas não podem ser excluídas; o lançamento de caixa relacionado precisa ser preservado.',
    RECEIVABLE_ALREADY_RECEIVED: 'Valores já recebidos não podem ser excluídos; o lançamento de caixa relacionado precisa ser preservado.',
    INVALID_ORDER_STATUS_TRANSITION: 'Não é permitido avançar o pedido para esse status.',
    PRODUCT_STOCK_MUST_USE_MOVEMENT: 'Altere o estoque pela função de movimentação, para preservar o histórico.',
    PRODUCT_STOCK_NOT_TRACKED: 'Este item é preparado na hora e não possui estoque por unidade. O custo cadastrado é apenas uma estimativa; controle de ingredientes/receitas pode ser avaliado futuramente.',
    INVALID_JSON: 'O corpo da solicitação não contém um JSON válido.',
    REQUEST_TOO_LARGE: 'A solicitação excede o tamanho permitido.',
    INVALID_FINANCE_MONTH: 'Informe o mês no formato AAAA-MM.',
    INVALID_DATE: 'Informe uma data válida no formato AAAA-MM-DD.',
    INVALID_PAYMENT_METHOD: 'Forma de pagamento inválida.',
    INVALID_STOCK_MOVEMENT_TYPE: 'Tipo de movimentação de estoque inválido.',
    INVALID_STOCK_MOVEMENT_REASON: 'Informe um motivo ou referência com pelo menos 5 caracteres.',
    INVALID_STOCK_MOVEMENT_QUANTITY: 'Quantidade inválida. Produtos por unidade ou por porção exigem uma quantidade inteira.',
    INVALID_ORDER_ITEM_QUANTITY: 'A quantidade do pedido é inválida. Produtos por unidade ou por porção exigem uma quantidade inteira.',
    INTERNAL_ERROR: 'Erro interno do servidor local.',
  }
  return { status, body: { error: code, message: messages[code] ?? (status >= 500 ? 'Erro interno do servidor local.' : 'Não foi possível concluir a operação. Confira os dados enviados.'), ...(Number.isSafeInteger(error?.activeCount) ? { activeCount: error.activeCount } : {}) } }
}

function appendAudit(data, action, entityType, entityId, details = {}) {
  data.auditLogs.push({
    id: randomUUID(), action, entityType, entityId: entityId ?? null,
    actor: 'local-development', details, createdAt: new Date().toISOString(),
  })
}

function ensureOrderSessionsInData(data) {
  data.orderSessions ??= []
  return data.orderSessions
}

function openOrderSession(data) {
  return ensureOrderSessionsInData(data).find((session) => session.status === 'open') ?? null
}

function displayableBusinessDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : String(value || '');
}

function formatOrderNumber(number) {
  return String(Number(number) || 0).padStart(3, '0')
}

function orderBusinessDate(order) {
  return order.businessDate || order.sessionDate || order.orderDate || String(order.createdAt || '').slice(0, 10)
}

function reportRange(searchParams) {
  const period = searchParams.get('period') || 'day'
  if (period === 'day') {
    const date = requireDateOrToday(searchParams.get('date') || businessDate())
    return { period, startDate: date, endDate: date, key: date }
  }
  if (period === 'month') {
    const month = searchParams.get('month') || businessDate().slice(0, 7)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_FINANCE_MONTH')
    const [year, monthNumber] = month.split('-').map(Number)
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    return { period, startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, '0')}`, key: month }
  }
  throw new Error('INVALID_REPORT_PERIOD')
}

function buildOrderReport(data, range) {
  // Este relatório é organizado pela data de criação do pedido. Pagamentos são
  // atribuídos ao pedido correspondente, mesmo quando ocorreram em outra data.
  const orders = data.orders.filter((order) => {
    const date = orderBusinessDate(order)
    return date >= range.startDate && date <= range.endDate
  })
  const active = orders.filter((order) => order.status !== 'cancelled')
  const cancelled = orders.filter((order) => order.status === 'cancelled')
  const activeOrderIds = new Set(active.map((order) => order.id))
  const paidByOrder = new Map()
  for (const entry of data.financialEntries) {
    if (entry.sourceType !== 'order_payment' || entry.direction !== 'income' || !activeOrderIds.has(entry.sourceId)) continue
    const amountCents = Number(entry.amountCents)
    // Dados antigos/corrompidos não podem contaminar o resumo com NaN.
    // Valores inválidos não são considerados pagamentos confirmados.
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) continue
    const nextTotal = (paidByOrder.get(entry.sourceId) ?? 0) + amountCents
    if (Number.isSafeInteger(nextTotal)) paidByOrder.set(entry.sourceId, nextTotal)
  }
  const orderTotal = (order) => {
    const value = Number(order.totalCents)
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  }
  const paidValue = (order) => Math.min(orderTotal(order), paidByOrder.get(order.id) ?? 0)
  const pendingValue = (order) => Math.max(0, orderTotal(order) - paidValue(order))
  const totals = {
    ordersCount: orders.length,
    completedCount: orders.filter((order) => order.status === 'delivered').length,
    cancelledCount: cancelled.length,
    activeValueCents: active.reduce((sum, order) => sum + orderTotal(order), 0),
    paidValueCents: active.reduce((sum, order) => sum + paidValue(order), 0),
    pendingValueCents: active.reduce((sum, order) => sum + pendingValue(order), 0),
  }
  const daily = new Map()
  for (const order of orders) {
    const date = orderBusinessDate(order)
    if (!daily.has(date)) daily.set(date, { date, ordersCount: 0, cancelledCount: 0, completedCount: 0, activeValueCents: 0, paidValueCents: 0, pendingValueCents: 0 })
    const item = daily.get(date)
    item.ordersCount += 1
    if (order.status === 'cancelled') {
      item.cancelledCount += 1
      continue
    }
    item.activeValueCents += orderTotal(order)
    item.paidValueCents += paidValue(order)
    item.pendingValueCents += pendingValue(order)
    if (order.status === 'delivered') item.completedCount += 1
  }
  return { ...range, totals, daily: [...daily.values()].sort((a, b) => b.date.localeCompare(a.date)) }
}

function decorateProduct(product) {
  const kind = product.kind ?? 'resale' // Compatibility with products created before product types existed.
  const stockTracked = kind !== 'prepared'
  const sellable = true
  return {
    ...product,
    kind,
    stockTracked,
    sellable,
    stockQuantity: kind === 'prepared' ? null : product.stockMilli / 1000,
    stockMinimum: kind === 'prepared' ? null : product.minimumMilli / 1000,
    margin: sellable ? calculateUnitGrossMargin({ costCents: product.costCents, priceCents: product.priceCents }) : null,
    lowStock: stockTracked && isStockAtOrBelowMinimum({ stockQuantity: product.stockMilli / 1000, stockMinimum: product.minimumMilli / 1000 }),
  }
}

function monthFromSearch(searchParams) {
  const month = searchParams.get('month') || businessDate().slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_FINANCE_MONTH')
  return month
}

function requireDateOrToday(value) {
  const date = value ?? businessDate()
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID_DATE')
  const parsed = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('INVALID_DATE')
  return date
}

function productInput(input, existing = null) {
  if (existing && Object.hasOwn(input, 'stockQuantity')) throw new Error('PRODUCT_STOCK_MUST_USE_MOVEMENT')
  const kind = input.kind ?? existing?.kind ?? 'resale'
  const previousTracksStock = existing ? (existing.kind ?? 'resale') !== 'prepared' : false
  const stockQuantity = kind === 'prepared' ? 0 : existing ? (previousTracksStock ? existing.stockMilli / 1000 : input.stockQuantity) : input.stockQuantity
  const stockMinimum = kind === 'prepared' ? 0 : input.stockMinimum ?? (existing && previousTracksStock ? existing.minimumMilli / 1000 : 0)
  return validateProduct({
    name: input.name ?? existing?.name,
    category: input.category ?? existing?.category,
    unit: input.unit ?? existing?.unit ?? 'un',
    kind,
    costCents: input.costCents ?? existing?.costCents,
    priceCents: input.priceCents ?? existing?.priceCents,
    stockQuantity,
    stockMinimum,
  })
}

function newFinancialEntry(input, sourceType = 'manual', sourceId = null) {
  const normal = validateFinancialEntry({ ...input, sourceType, sourceId })
  return { id: randomUUID(), ...normal, createdAt: new Date().toISOString() }
}

function snapshotOrderItems(data, submittedItems) {
  if (!Array.isArray(submittedItems) || !submittedItems.length) throw new Error('ORDER_REQUIRES_ITEMS')
  const domainItems = submittedItems.map((item) => {
    const product = data.products.find((candidate) => candidate.id === String(item?.productId ?? ''))
    if (!product) throw new Error('PRODUCT_NOT_FOUND')
    if (product.active === false) throw new Error('ORDER_PRODUCT_INACTIVE')
    const quantity = Number(item?.quantity)
    if (['un', 'porcao'].includes(product.unit) && !Number.isInteger(quantity)) throw new Error('INVALID_ORDER_ITEM_QUANTITY')
    return {
      productId: product.id,
      name: product.name,
      quantity,
      unitPriceCents: product.priceCents,
      unitCostCents: product.costCents,
    }
  })
  const normalized = validateOrderItems(domainItems)
  return normalized.map((item) => ({
    id: randomUUID(), productId: item.productId, nameSnapshot: item.name,
    quantityMilli: item.quantityMilli, unitPriceCents: item.unitPriceCents,
    unitCostCents: item.unitCostCents, lineTotalCents: item.lineTotalCents,
  }))
}


const DEMO_SEED_VERSION = 'copao-demo-v1'

function shiftBusinessDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function seedDemoData(data) {
  data.demoSeedVersions ??= []
  if (data.demoSeedVersions.includes(DEMO_SEED_VERSION)) {
    return { alreadySeeded: true, products: data.products.length, orders: data.orders.length }
  }
  const today = businessDate()
  const yesterday = shiftBusinessDate(today, -1)
  // Example prices/costs are fictitious, for demonstrating the difference
  // between resale stock and made-to-order products. No recipe/ingredient ledger.
  const productDefinitions = [
    { name: 'Refrigerante lata 350 ml', category: 'Bebidas', kind: 'resale', unit: 'un', costCents: 240, priceCents: 500, stockQuantity: 48, stockMinimum: 12 },
    { name: 'Água mineral 500 ml', category: 'Bebidas', kind: 'resale', unit: 'un', costCents: 110, priceCents: 300, stockQuantity: 36, stockMinimum: 10 },
    { name: 'Cerveja lata 350 ml', category: 'Bebidas', kind: 'resale', unit: 'un', costCents: 350, priceCents: 600, stockQuantity: 48, stockMinimum: 12 },
    { name: 'X-Burguer', category: 'Lanches preparados', kind: 'prepared', unit: 'porcao', costCents: 850, priceCents: 2000, stockQuantity: 0, stockMinimum: 0 },
    { name: 'X-Bacon', category: 'Lanches preparados', kind: 'prepared', unit: 'porcao', costCents: 1100, priceCents: 2600, stockQuantity: 0, stockMinimum: 0 },
    { name: 'Batata frita pequena', category: 'Acompanhamentos preparados', kind: 'prepared', unit: 'porcao', costCents: 350, priceCents: 1000, stockQuantity: 0, stockMinimum: 0 },
    { name: 'Copão tradicional', category: 'Drinks preparados', kind: 'prepared', unit: 'porcao', costCents: 1050, priceCents: 2500, stockQuantity: 0, stockMinimum: 0 },
    { name: 'Drink vodka com energético', category: 'Drinks preparados', kind: 'prepared', unit: 'porcao', costCents: 900, priceCents: 2200, stockQuantity: 0, stockMinimum: 0 },
  ]
  const createdProductIds = new Set()
  for (const definition of productDefinitions) {
    let product = data.products.find((item) => item.name.toLocaleLowerCase('pt-BR') === definition.name.toLocaleLowerCase('pt-BR'))
    if (!product) {
      const normalized = validateProduct(definition)
      product = { id: randomUUID(), ...normalized, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), demoSeed: DEMO_SEED_VERSION }
      data.products.push(product)
      createdProductIds.add(product.id)
      if (product.stockMilli > 0) {
        data.stockMovements.push({
          id: randomUUID(), productId: product.id, type: 'adjustment_in', quantityMilli: product.stockMilli,
          beforeMilli: 0, afterMilli: product.stockMilli, reason: 'Estoque inicial dos dados de demonstração',
          movementDate: today, sourceType: 'demo_seed_stock', sourceId: product.id, createdAt: new Date().toISOString(),
        })
      }
      appendAudit(data, 'product.demo_seeded', 'product', product.id, { name: product.name, kind: product.kind })
    }
  }

  const entries = [
    { direction: 'income', description: 'Venda do balcão', category: 'Vendas', amountCents: 125000, movementDate: today, paymentMethod: 'Pix' },
    { direction: 'income', description: 'Venda de bebidas', category: 'Vendas', amountCents: 63500, movementDate: today, paymentMethod: 'Dinheiro' },
    { direction: 'income', description: 'Venda de pedidos', category: 'Vendas', amountCents: 48500, movementDate: today, paymentMethod: 'Cartão' },
    { direction: 'expense', description: 'Compra de bebidas e energético', category: 'Estoque / insumos', amountCents: 48690, movementDate: today, paymentMethod: 'Cartão' },
    { direction: 'expense', description: 'Fornecedor de carnes e pães', category: 'Estoque / insumos', amountCents: 64000, movementDate: yesterday, paymentMethod: 'Pix' },
    { direction: 'expense', description: 'Embalagens e descartáveis', category: 'Operação', amountCents: 12500, movementDate: today, paymentMethod: 'Dinheiro' },
  ]
  for (const input of entries) {
    const entry = newFinancialEntry(input)
    data.financialEntries.push(entry)
    appendAudit(data, 'finance.entry.demo_seeded', 'financial_entry', entry.id, { description: entry.description, amountCents: entry.amountCents })
  }

  const payables = [
    { description: 'Aluguel do estabelecimento', category: 'Despesas fixas', amountCents: 150000, dueDate: shiftBusinessDate(today, 6) },
    { description: 'Reposição de bebidas', category: 'Estoque / insumos', amountCents: 48990, dueDate: shiftBusinessDate(today, 3) },
  ]
  for (const input of payables) {
    const payable = { id: randomUUID(), ...validatePayable(input), paidAt: null, expenseEntryId: null, createdAt: new Date().toISOString(), demoSeed: DEMO_SEED_VERSION }
    data.payables.push(payable)
    appendAudit(data, 'finance.payable.demo_seeded', 'payable', payable.id, { amountCents: payable.amountCents })
  }
  const receivableInput = { description: 'Pedido para evento (a prazo)', counterparty: 'Cliente de demonstração', amountCents: 25000, dueDate: shiftBusinessDate(today, 2) }
  const receivable = { id: randomUUID(), ...validateReceivable(receivableInput), receivedAt: null, incomeEntryId: null, createdAt: new Date().toISOString(), demoSeed: DEMO_SEED_VERSION }
  data.receivables.push(receivable)
  appendAudit(data, 'finance.receivable.demo_seeded', 'receivable', receivable.id, { amountCents: receivable.amountCents })

  const findProductId = (name) => data.products.find((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))?.id
  const orderDefinitions = [
    { customer: 'Balcão', status: 'preparing', items: [{ productId: findProductId('X-Burguer'), quantity: 2 }, { productId: findProductId('Refrigerante lata 350 ml'), quantity: 1 }] },
    { customer: 'Balcão', status: 'ready', items: [{ productId: findProductId('X-Bacon'), quantity: 1 }, { productId: findProductId('Água mineral 500 ml'), quantity: 1 }] },
    { customer: 'Balcão', status: 'received', items: [{ productId: findProductId('Copão tradicional'), quantity: 1 }] },
  ]
  for (const definition of orderDefinitions) {
    const items = snapshotOrderItems(data, definition.items)
    const totalCents = calculateOrderTotalCents(items.map((item) => ({ productId: item.productId, name: item.nameSnapshot, quantity: item.quantityMilli / 1000, unitPriceCents: item.unitPriceCents, unitCostCents: item.unitCostCents })))
    const order = {
      id: randomUUID(), number: data.nextOrderNumber++, customer: definition.customer, status: definition.status,
      paymentStatus: 'unpaid', paidCents: 0, totalCents, items, createdAt: new Date().toISOString(), orderDate: today, demoSeed: DEMO_SEED_VERSION,
    }
    data.orders.push(order)
    appendAudit(data, 'order.demo_seeded', 'order', order.id, { number: order.number, totalCents, status: order.status })
  }

  data.demoSeedVersions.push(DEMO_SEED_VERSION)
  appendAudit(data, 'demo.seed.completed', 'demo_seed', DEMO_SEED_VERSION, { products: productDefinitions.length, entries: entries.length, payables: payables.length, receivables: 1, orders: orderDefinitions.length })
  return {
    alreadySeeded: false,
    newProducts: createdProductIds.size,
    newEntries: entries.length,
    newPayables: payables.length,
    newReceivables: 1,
    newOrders: orderDefinitions.length,
    counts: { products: data.products.length, entries: data.financialEntries.length, payables: data.payables.length, receivables: data.receivables.length, orders: data.orders.length },
  }
}

function ensureOrderReceivablesInData(data) {
  let added = 0
  for (const order of data.orders) {
    const paymentEntry = data.financialEntries.find((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id)
    let receivable = data.receivables.find((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
    const cancelled = order.status === 'cancelled'
    const paid = Boolean(paymentEntry)

    if (!receivable) {
      receivable = {
        id: randomUUID(), description: `Pedido #${formatOrderNumber(order.number)}${orderBusinessDate(order) ? ` · ${displayableBusinessDate(orderBusinessDate(order))}` : ''}`, counterparty: order.customer || 'Balcão',
        amountCents: order.totalCents, dueDate: order.orderDate || businessDate(),
        status: cancelled ? 'cancelled' : paid ? 'received' : 'pending',
        receivedAt: paid ? (order.paidAt ?? paymentEntry?.createdAt ?? new Date().toISOString()) : null,
        incomeEntryId: paymentEntry?.id ?? null, orderId: order.id, orderNumber: Number(order.number),
        createdAt: order.createdAt ?? new Date().toISOString(), sourceType: 'order',
      }
      data.receivables.push(receivable)
      order.receivableId = receivable.id
      added += 1
      appendAudit(data, 'finance.receivable.created_from_order', 'receivable', receivable.id, { orderId: order.id, orderNumber: order.number, amountCents: order.totalCents })
    } else {
      receivable.orderId = order.id
      receivable.orderNumber = Number(order.number)
      order.receivableId = receivable.id
      if (cancelled && receivable.status === 'pending') {
        receivable.status = 'cancelled'
        receivable.cancelledAt = order.updatedAt ?? new Date().toISOString()
      }
    }

    if (paid && paymentEntry) {
      order.paymentStatus = 'paid'
      order.paidCents = order.totalCents
      order.incomeEntryId = paymentEntry.id
      order.paymentMethod = paymentEntry.paymentMethod
      order.paymentDate = paymentEntry.movementDate
      order.paidAt ??= paymentEntry.createdAt
      receivable.status = 'received'
      receivable.receivedAt = order.paidAt
      receivable.incomeEntryId = paymentEntry.id
      receivable.paymentMethod = paymentEntry.paymentMethod
      receivable.receivedDate = paymentEntry.movementDate
    } else if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'unpaid'
      order.paidCents = 0
    }
  }
  return added
}

async function ensureOrderReceivables(store) {
  const snapshot = await store.read()
  const hasMissing = snapshot.orders.some((order) =>
    !snapshot.receivables.some((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
  )
  if (!hasMissing) return snapshot
  await store.transact((data) => ensureOrderReceivablesInData(data))
  return store.read()
}

function orderStockRequirements(data, order) {
  const quantities = new Map()
  for (const item of order.items ?? []) {
    const product = data.products.find((candidate) => candidate.id === item.productId)
    if (!product) throw new Error('PRODUCT_NOT_FOUND')
    if ((product.kind ?? 'resale') === 'prepared') continue
    const nextQuantityMilli = (quantities.get(product.id) ?? 0) + Number(item.quantityMilli)
    if (!Number.isSafeInteger(nextQuantityMilli) || nextQuantityMilli <= 0) throw new Error('INVALID_STOCK_QUANTITY')
    quantities.set(product.id, nextQuantityMilli)
  }
  return quantities
}

function reserveOrderStock(data, order, timestamp) {
  const priorConsumption = data.stockMovements.some((movement) =>
    movement.sourceType === 'order' && movement.sourceId === order.id && movement.type === 'order_consumption'
  )
  if (order.stockReservedAt || priorConsumption) throw new Error('DUPLICATE_STOCK_SOURCE')

  // Validate and apply within the same JSON transaction. Any insufficient item
  // aborts the whole transaction, so earlier items cannot remain deducted.
  const requirements = orderStockRequirements(data, order)
  const movements = []
  for (const [productId, quantityMilli] of requirements) {
    const product = data.products.find((candidate) => candidate.id === productId)
    const quantity = quantityMilli / 1000
    const beforeMilli = product.stockMilli
    const afterUnits = applyStockMovement(beforeMilli / 1000, { type: 'order_consumption', quantity })
    const afterMilli = Math.round(afterUnits * 1000)
    const movement = {
      id: randomUUID(), productId, type: 'order_consumption', quantityMilli,
      beforeMilli, afterMilli, reason: `Saída de estoque pelo registro do pedido #${formatOrderNumber(order.number)}`.slice(0, 160),
      movementDate: order.businessDate || order.orderDate || businessDate(), sourceType: 'order', sourceId: order.id, createdAt: timestamp,
    }
    assertUniqueStockSource(data.stockMovements, movement.sourceType, movement.sourceId, productId, movement.type)
    product.stockMilli = afterMilli
    product.updatedAt = timestamp
    data.stockMovements.push(movement)
    appendAudit(data, 'stock.movement.created', 'stock_movement', movement.id, {
      productId, type: movement.type, quantityMilli, beforeMilli, afterMilli, reason: movement.reason,
    })
    movements.push(movement)
  }

  // Mark completion even for orders made only of prepared products; they have
  // no per-unit stock to reserve, but the status transition is still complete.
  order.stockReservedAt = timestamp
  order.stockDeducted = movements.length > 0
  if (movements.length) {
    appendAudit(data, 'order.stock.reserved', 'order', order.id, {
      number: order.number, movements: movements.length,
      products: movements.map((movement) => movement.productId),
    })
  }
}

function releaseOrderStock(data, order, timestamp) {
  if (!order.stockReservedAt || order.stockReleasedAt) return []
  const consumed = data.stockMovements.filter((movement) =>
    movement.sourceType === 'order' && movement.sourceId === order.id && movement.type === 'order_consumption'
  )
  const returnedProductIds = new Set(data.stockMovements.filter((movement) =>
    movement.sourceType === 'order_cancellation' && movement.sourceId === order.id && movement.type === 'return'
  ).map((movement) => movement.productId))
  const returned = []

  for (const consumption of consumed) {
    if (returnedProductIds.has(consumption.productId)) continue
    const product = data.products.find((candidate) => candidate.id === consumption.productId)
    if (!product) throw new Error('PRODUCT_NOT_FOUND')
    const quantity = consumption.quantityMilli / 1000
    const beforeMilli = product.stockMilli
    const afterUnits = applyStockMovement(beforeMilli / 1000, { type: 'return', quantity })
    const afterMilli = Math.round(afterUnits * 1000)
    const movement = {
      id: randomUUID(), productId: product.id, type: 'return', quantityMilli: consumption.quantityMilli,
      beforeMilli, afterMilli, reason: `Devolução ao estoque do pedido #${order.number} cancelado`.slice(0, 160),
      movementDate: businessDate(), sourceType: 'order_cancellation', sourceId: order.id, createdAt: timestamp,
    }
    assertUniqueStockSource(data.stockMovements, movement.sourceType, movement.sourceId, product.id, movement.type)
    product.stockMilli = afterMilli
    product.updatedAt = timestamp
    data.stockMovements.push(movement)
    appendAudit(data, 'stock.movement.created', 'stock_movement', movement.id, {
      productId: product.id, type: movement.type, quantityMilli: movement.quantityMilli,
      beforeMilli, afterMilli, reason: movement.reason,
    })
    returned.push(movement)
  }

  order.stockReleasedAt = timestamp
  if (returned.length) {
    appendAudit(data, 'order.stock.released', 'order', order.id, {
      number: order.number, movements: returned.length,
      products: returned.map((movement) => movement.productId),
    })
  }
  return returned
}

export function createApiServer({ store }) {
  if (!store || typeof store.read !== 'function' || typeof store.transact !== 'function') throw new TypeError('store inválido')
  return createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Cache-Control': 'no-store' })
      return response.end()
    }
    if (!validateLocalOrigin(request)) return responseJson(response, 403, { error: 'INVALID_ORIGIN', message: 'Origem não permitida para a API local.' })

    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const method = request.method || 'GET'
    const pathname = url.pathname

    try {
      if (method === 'GET' && pathname === '/api/health') {
        const state = await store.read()
        return responseJson(response, 200, { ok: true, application: 'P16 — Adega do Copão', storage: 'local-json', productionReady: false, counts: { products: state.products.length, orders: state.orders.length } })
      }

      if (method === 'POST' && pathname === '/api/admin/demo-seed') {
        await readJson(request)
        const result = await store.transact((data) => seedDemoData(data))
        return responseJson(response, result.alreadySeeded ? 200 : 201, result)
      }

      if (method === 'GET' && pathname === '/api/admin/dashboard') {
        await ensureOrderReceivables(store)
        const state = await store.read()
        const month = monthFromSearch(url.searchParams)
        const summary = summarizeFinance({ month, entries: state.financialEntries, payables: state.payables, receivables: state.receivables })
        return responseJson(response, 200, {
          summary,
          lowStockProducts: state.products.filter((product) => product.active !== false && (product.kind ?? 'resale') !== 'prepared' && isStockAtOrBelowMinimum({ stockQuantity: product.stockMilli / 1000, stockMinimum: product.minimumMilli / 1000 })).map(decorateProduct),
          recentEntries: state.financialEntries.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
          pendingPayables: state.payables.filter((item) => item.status === 'pending').length,
          pendingReceivables: state.receivables.filter((item) => item.status === 'pending').length,
        })
      }

      if (method === 'GET' && pathname === '/api/admin/products') {
        const state = await store.read()
        const products = state.products.filter((item) => item.active !== false).map(decorateProduct).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        return responseJson(response, 200, { products })
      }

      if (method === 'POST' && pathname === '/api/admin/products') {
        const body = await readJson(request)
        const normalized = productInput(body)
        const result = await store.transact((data) => {
          if (data.products.some((item) => item.active !== false && item.name.toLocaleLowerCase('pt-BR') === normalized.name.toLocaleLowerCase('pt-BR'))) throw Object.assign(new Error('PRODUCT_NAME_ALREADY_EXISTS'), { status: 409 })
          const product = {
            id: randomUUID(), ...normalized, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
          data.products.push(product)
          if (product.stockMilli > 0) {
            data.stockMovements.push({
              id: randomUUID(), productId: product.id, type: 'adjustment_in', quantityMilli: product.stockMilli,
              beforeMilli: 0, afterMilli: product.stockMilli, reason: 'Estoque inicial no cadastro',
              movementDate: businessDate(), sourceType: 'product_initial_stock', sourceId: product.id, createdAt: new Date().toISOString(),
            })
          }
          appendAudit(data, 'product.created', 'product', product.id, { name: product.name })
          return product
        })
        return responseJson(response, 201, { product: decorateProduct(result) })
      }

      const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/)
      if (method === 'DELETE' && productMatch) {
        const result = await store.transact((data) => {
          const productId = decodeURIComponent(productMatch[1])
          const product = data.products.find((item) => item.id === productId && item.active !== false)
          if (!product) throw new Error('PRODUCT_NOT_FOUND')
          const hasStockHistory = data.stockMovements.some((item) => item.productId === product.id)
          const hasOrderHistory = data.orders.some((order) => order.items?.some((item) => item.productId === product.id))
          if (hasStockHistory || hasOrderHistory) {
            product.active = false
            product.updatedAt = new Date().toISOString()
            appendAudit(data, 'product.archived', 'product', product.id, { name: product.name, hasStockHistory, hasOrderHistory })
            return { product, archived: true, deleted: false }
          }
          data.products = data.products.filter((item) => item.id !== product.id)
          appendAudit(data, 'product.deleted', 'product', product.id, { name: product.name })
          return { product, archived: false, deleted: true }
        })
        return responseJson(response, 200, { archived: result.archived, deleted: result.deleted, product: decorateProduct(result.product) })
      }
      if (method === 'PATCH' && productMatch) {
        const body = await readJson(request)
        const result = await store.transact((data) => {
          const product = data.products.find((item) => item.id === decodeURIComponent(productMatch[1]))
          if (!product) throw new Error('PRODUCT_NOT_FOUND')
          const normalized = productInput(body, product)
          if (data.products.some((item) => item.id !== product.id && item.active !== false && item.name.toLocaleLowerCase('pt-BR') === normalized.name.toLocaleLowerCase('pt-BR'))) throw Object.assign(new Error('PRODUCT_NAME_ALREADY_EXISTS'), { status: 409 })
          Object.assign(product, normalized, { updatedAt: new Date().toISOString() })
          appendAudit(data, 'product.updated', 'product', product.id, { name: product.name })
          return product
        })
        return responseJson(response, 200, { product: decorateProduct(result) })
      }

      if (method === 'GET' && pathname === '/api/admin/stock-movements') {
        const state = await store.read()
        const productId = url.searchParams.get('productId')
        const movements = state.stockMovements.filter((item) => !productId || item.productId === productId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => {
          const product = state.products.find((candidate) => candidate.id === item.productId)
          return { ...item, productName: product?.name ?? 'Produto fora do catálogo', productUnit: product?.unit ?? 'un' }
        })
        return responseJson(response, 200, { movements })
      }

      if (method === 'POST' && pathname === '/api/admin/stock-movements') {
        const body = await readJson(request)
        const type = String(body.type ?? '')
        if (!STOCK_TYPES.has(type)) throw new Error('INVALID_STOCK_MOVEMENT_TYPE')
        const quantity = body.quantity
        const reason = String(body.reason ?? '').trim()
        if (reason.length < 5 || reason.length > 160) throw new Error('INVALID_STOCK_MOVEMENT_REASON')
        const movementDate = requireDateOrToday(body.movementDate)
        const result = await store.transact((data) => {
          const product = data.products.find((item) => item.id === String(body.productId ?? ''))
          if (!product) throw new Error('PRODUCT_NOT_FOUND')
          if ((product.kind ?? 'resale') === 'prepared') throw new Error('PRODUCT_STOCK_NOT_TRACKED')
          const numericQuantity = Number(typeof quantity === 'string' ? quantity.trim().replace(',', '.') : quantity)
          if (['un', 'porcao'].includes(product.unit ?? 'un') && !Number.isInteger(numericQuantity)) throw new Error('INVALID_STOCK_MOVEMENT_QUANTITY')
          const sourceType = String(body.sourceType ?? 'manual')
          const sourceId = body.sourceId == null ? null : String(body.sourceId)
          assertUniqueStockSource(data.stockMovements, sourceType, sourceId, product.id, type)
          const beforeMilli = product.stockMilli
          const afterUnits = applyStockMovement(beforeMilli / 1000, { type, quantity })
          const afterMilli = Math.round(afterUnits * 1000)
          const movement = {
            id: randomUUID(), productId: product.id, type, quantityMilli: Math.round(Number(String(quantity).replace(',', '.')) * 1000),
            beforeMilli, afterMilli, reason, movementDate, sourceType, sourceId, createdAt: new Date().toISOString(),
          }
          product.stockMilli = afterMilli
          product.updatedAt = new Date().toISOString()
          data.stockMovements.push(movement)
          appendAudit(data, 'stock.movement.created', 'stock_movement', movement.id, { productId: product.id, type, quantityMilli: movement.quantityMilli, beforeMilli, afterMilli, reason })
          return { movement, product }
        })
        return responseJson(response, 201, { movement: result.movement, product: decorateProduct(result.product) })
      }

      if (method === 'GET' && pathname === '/api/admin/finance/entries') {
        const state = await store.read()
        const month = url.searchParams.get('month')
        const entries = state.financialEntries.filter((item) => !month || item.movementDate.startsWith(`${month}-`)).slice().sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.createdAt.localeCompare(a.createdAt))
        if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_FINANCE_MONTH')
        return responseJson(response, 200, { entries })
      }

      if (method === 'POST' && pathname === '/api/admin/finance/entries') {
        const body = await readJson(request)
        const entry = newFinancialEntry(body)
        const result = await store.transact((data) => {
          data.financialEntries.push(entry)
          appendAudit(data, 'finance.entry.created', 'financial_entry', entry.id, { direction: entry.direction, amountCents: entry.amountCents })
          return entry
        })
        return responseJson(response, 201, { entry: result })
      }

      if (method === 'GET' && pathname === '/api/admin/finance/payables') {
        const state = await store.read()
        return responseJson(response, 200, { payables: state.payables.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)) })
      }

      if (method === 'POST' && pathname === '/api/admin/finance/payables') {
        const body = await readJson(request)
        const normalized = validatePayable(body)
        const payable = await store.transact((data) => {
          const item = { id: randomUUID(), ...normalized, paidAt: null, expenseEntryId: null, createdAt: new Date().toISOString() }
          data.payables.push(item)
          appendAudit(data, 'finance.payable.created', 'payable', item.id, { amountCents: item.amountCents, dueDate: item.dueDate })
          return item
        })
        return responseJson(response, 201, { payable })
      }

      const payablePayMatch = pathname.match(/^\/api\/admin\/finance\/payables\/([^/]+)\/pay$/)
      if (method === 'POST' && payablePayMatch) {
        const body = await readJson(request)
        const paymentDate = requireDateOrToday(body.paymentDate)
        const paymentMethod = body.paymentMethod ?? 'Não informado'
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD')
        const result = await store.transact((data) => {
          const payable = data.payables.find((item) => item.id === decodeURIComponent(payablePayMatch[1]))
          if (!payable) throw new Error('PAYABLE_NOT_FOUND')
          if (payable.status === 'paid' && payable.expenseEntryId) {
            const existing = data.financialEntries.find((item) => item.id === payable.expenseEntryId)
            if (existing) return { payable, entry: existing, idempotent: true }
          }
          const entry = newFinancialEntry({
            direction: 'expense', description: `Pagamento: ${payable.description}`.slice(0, 120), category: payable.category,
            amountCents: payable.amountCents, movementDate: paymentDate, paymentMethod,
          }, 'payable_payment', payable.id)
          assertUniqueFinancialSource(data.financialEntries, entry.sourceType, entry.sourceId)
          const paidAt = new Date().toISOString()
          const updatedPayable = markPayablePaid(payable, { paidAt, expenseEntryId: entry.id })
          data.financialEntries.push(entry)
          Object.assign(payable, updatedPayable)
          appendAudit(data, 'finance.payable.paid', 'payable', payable.id, { entryId: entry.id, amountCents: entry.amountCents })
          return { payable, entry, idempotent: false }
        })
        return responseJson(response, 200, result)
      }

      const payableDeleteMatch = pathname.match(/^\/api\/admin\/finance\/payables\/([^/]+)$/)
      if (method === 'DELETE' && payableDeleteMatch) {
        const result = await store.transact((data) => {
          const payableId = decodeURIComponent(payableDeleteMatch[1])
          const index = data.payables.findIndex((item) => item.id === payableId)
          if (index < 0) throw new Error('PAYABLE_NOT_FOUND')
          const payable = data.payables[index]
          if (payable.status === 'paid' || payable.expenseEntryId) throw new Error('PAYABLE_ALREADY_PAID')
          data.payables.splice(index, 1)
          appendAudit(data, 'finance.payable.deleted', 'payable', payable.id, { description: payable.description, amountCents: payable.amountCents })
          return payable
        })
        return responseJson(response, 200, { deleted: true, payable: result })
      }

      if (method === 'GET' && pathname === '/api/admin/finance/receivables') {
        await ensureOrderReceivables(store)
        const state = await store.read()
        return responseJson(response, 200, { receivables: state.receivables.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)) })
      }

      if (method === 'POST' && pathname === '/api/admin/finance/receivables') {
        const body = await readJson(request)
        const normalized = validateReceivable(body)
        const receivable = await store.transact((data) => {
          const item = { id: randomUUID(), ...normalized, receivedAt: null, incomeEntryId: null, createdAt: new Date().toISOString() }
          data.receivables.push(item)
          appendAudit(data, 'finance.receivable.created', 'receivable', item.id, { amountCents: item.amountCents, dueDate: item.dueDate })
          return item
        })
        return responseJson(response, 201, { receivable })
      }

      const receivableReceiveMatch = pathname.match(/^\/api\/admin\/finance\/receivables\/([^/]+)\/receive$/)
      if (method === 'POST' && receivableReceiveMatch) {
        const body = await readJson(request)
        const receivedDate = requireDateOrToday(body.receivedDate)
        const paymentMethod = body.paymentMethod ?? 'Não informado'
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD')
        const result = await store.transact((data) => {
          const receivable = data.receivables.find((item) => item.id === decodeURIComponent(receivableReceiveMatch[1]))
          if (!receivable) throw new Error('RECEIVABLE_NOT_FOUND')
          if (receivable.orderId) throw new Error('ORDER_RECEIVABLE_MUST_BE_PAID_FROM_ORDER')
          if (receivable.status === 'received' && receivable.incomeEntryId) {
            const existing = data.financialEntries.find((item) => item.id === receivable.incomeEntryId)
            if (existing) return { receivable, entry: existing, idempotent: true }
          }
          const entry = newFinancialEntry({
            direction: 'income', description: `Recebimento: ${receivable.description}`.slice(0, 120), category: 'Recebimentos',
            amountCents: receivable.amountCents, movementDate: receivedDate, paymentMethod,
          }, 'receivable_receipt', receivable.id)
          assertUniqueFinancialSource(data.financialEntries, entry.sourceType, entry.sourceId)
          receivable.status = 'received'
          receivable.receivedAt = new Date().toISOString()
          receivable.incomeEntryId = entry.id
          data.financialEntries.push(entry)
          appendAudit(data, 'finance.receivable.received', 'receivable', receivable.id, { entryId: entry.id, amountCents: entry.amountCents })
          return { receivable, entry, idempotent: false }
        })
        return responseJson(response, 200, result)
      }

      const receivableDeleteMatch = pathname.match(/^\/api\/admin\/finance\/receivables\/([^/]+)$/)
      if (method === 'DELETE' && receivableDeleteMatch) {
        const result = await store.transact((data) => {
          const receivableId = decodeURIComponent(receivableDeleteMatch[1])
          const index = data.receivables.findIndex((item) => item.id === receivableId)
          if (index < 0) throw new Error('RECEIVABLE_NOT_FOUND')
          const receivable = data.receivables[index]
          if (receivable.orderId) throw new Error('ORDER_RECEIVABLE_MANAGED_BY_ORDER')
          if (receivable.status === 'received' || receivable.incomeEntryId) throw new Error('RECEIVABLE_ALREADY_RECEIVED')
          data.receivables.splice(index, 1)
          appendAudit(data, 'finance.receivable.deleted', 'receivable', receivable.id, { description: receivable.description, amountCents: receivable.amountCents })
          return receivable
        })
        return responseJson(response, 200, { deleted: true, receivable: result })
      }

      if (method === 'GET' && pathname === '/api/admin/orders/session') {
        const state = await store.read()
        const sessions = [...(state.orderSessions ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        return responseJson(response, 200, { session: sessions.find((item) => item.status === 'open') ?? null, sessions: sessions.slice(0, 30) })
      }

      if (method === 'POST' && pathname === '/api/admin/orders/session/start') {
        await readJson(request)
        const result = await store.transact((data) => {
          const sessions = ensureOrderSessionsInData(data)
          if (sessions.some((session) => session.status === 'open')) throw new Error('ORDER_SESSION_ALREADY_OPEN')
          const timestamp = new Date().toISOString()
          const session = {
            id: randomUUID(), businessDate: businessDate(), status: 'open', startedAt: timestamp,
            endedAt: null, nextOrderNumber: 1, createdAt: timestamp, updatedAt: timestamp,
          }
          sessions.push(session)
          appendAudit(data, 'orders.session.started', 'order_session', session.id, { businessDate: session.businessDate })
          return session
        })
        return responseJson(response, 201, { session: result })
      }

      if (method === 'POST' && pathname === '/api/admin/orders/session/close') {
        await readJson(request)
        const result = await store.transact((data) => {
          const session = openOrderSession(data)
          if (!session) throw new Error('ORDER_SESSION_NOT_OPEN')
          const activeOrders = data.orders.filter((order) => order.sessionId === session.id && !['delivered', 'cancelled'].includes(order.status))
          if (activeOrders.length) throw Object.assign(new Error('ORDER_SESSION_HAS_ACTIVE_ORDERS'), { activeCount: activeOrders.length })
          const timestamp = new Date().toISOString()
          Object.assign(session, { status: 'closed', endedAt: timestamp, updatedAt: timestamp, lastOrderNumber: Math.max(0, session.nextOrderNumber - 1) })
          appendAudit(data, 'orders.session.closed', 'order_session', session.id, { businessDate: session.businessDate, orderCount: session.nextOrderNumber - 1, lastOrderNumber: session.lastOrderNumber })
          return session
        })
        return responseJson(response, 200, { session: result })
      }

      if (method === 'GET' && pathname === '/api/admin/orders/reports') {
        const range = reportRange(url.searchParams)
        const state = await store.read()
        return responseJson(response, 200, buildOrderReport(state, range))
      }

      if (method === 'GET' && pathname === '/api/admin/orders') {
        await ensureOrderReceivables(store)
        const state = await store.read()
        return responseJson(response, 200, { orders: state.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
      }

      if (method === 'POST' && pathname === '/api/admin/orders') {
        const body = await readJson(request)
        const result = await store.transact((data) => {
          const session = openOrderSession(data)
          if (!session) throw new Error('ORDER_SESSION_NOT_OPEN')
          const items = snapshotOrderItems(data, body.items)
          const domainTotalItems = items.map((item) => ({ productId: item.productId, name: item.nameSnapshot, quantity: item.quantityMilli / 1000, unitPriceCents: item.unitPriceCents, unitCostCents: item.unitCostCents }))
          const totalCents = calculateOrderTotalCents(domainTotalItems)
          const timestamp = new Date().toISOString()
          const order = {
            id: randomUUID(), number: session.nextOrderNumber, sessionId: session.id, sessionDate: session.businessDate, businessDate: session.businessDate,
            customer: String(body.customer ?? 'Balcão').trim().slice(0, 120) || 'Balcão',
            status: 'received', paymentStatus: 'unpaid', paidCents: 0, totalCents, items,
            createdAt: timestamp, orderDate: session.businessDate,
          }
          // Reserva/baixa de produtos de revenda no próprio registro do pedido.
          // A transação JSON é descartada por inteiro se algum item não tiver saldo.
          reserveOrderStock(data, order, timestamp)
          const receivable = {
            id: randomUUID(), description: `Pedido #${formatOrderNumber(order.number)} · ${displayableBusinessDate(order.businessDate)}`, counterparty: order.customer,
            amountCents: totalCents, dueDate: order.orderDate, status: 'pending', receivedAt: null,
            incomeEntryId: null, orderId: order.id, orderNumber: order.number,
            createdAt: timestamp, sourceType: 'order',
          }
          order.receivableId = receivable.id
          data.orders.push(order)
          data.receivables.push(receivable)
          session.nextOrderNumber += 1
          session.updatedAt = timestamp
          appendAudit(data, 'order.created', 'order', order.id, { number: order.number, sessionId: session.id, totalCents, receivableId: receivable.id })
          appendAudit(data, 'finance.receivable.created_from_order', 'receivable', receivable.id, { orderId: order.id, orderNumber: order.number, amountCents: totalCents })
          return order
        })
        return responseJson(response, 201, { order: result })
      }

      const orderPaymentMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/pay$/)
      if (method === 'POST' && orderPaymentMatch) {
        const body = await readJson(request)
        const paymentDate = requireDateOrToday(body.paymentDate)
        const paymentMethod = body.paymentMethod ?? 'Não informado'
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD')
        const result = await store.transact((data) => {
          ensureOrderReceivablesInData(data)
          const order = data.orders.find((item) => item.id === decodeURIComponent(orderPaymentMatch[1]))
          if (!order) throw new Error('ORDER_NOT_FOUND')
          if (order.status === 'cancelled') throw new Error('ORDER_CANCELLED_CANNOT_BE_PAID')
          const existingEntry = data.financialEntries.find((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id)
          let receivable = data.receivables.find((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
          if (existingEntry || order.paymentStatus === 'paid') {
            if (!existingEntry) throw new Error('ORDER_PAYMENT_HISTORY_INCONSISTENT')
            if (!receivable) throw new Error('ORDER_PAYMENT_HISTORY_INCONSISTENT')
            order.paymentStatus = 'paid'
            order.paidCents = order.totalCents
            order.incomeEntryId = existingEntry.id
            order.paymentMethod = existingEntry.paymentMethod
            order.paymentDate = existingEntry.movementDate
            order.paidAt ??= existingEntry.createdAt
            receivable.status = 'received'
            receivable.receivedAt = order.paidAt
            receivable.incomeEntryId = existingEntry.id
            receivable.paymentMethod = existingEntry.paymentMethod
            receivable.receivedDate = existingEntry.movementDate
            return { order, entry: existingEntry, receivable, idempotent: true }
          }
          if (!receivable) throw new Error('ORDER_PAYMENT_HISTORY_INCONSISTENT')
          const entry = newFinancialEntry({
            direction: 'income', description: `Pedido #${order.number} - ${order.customer}`.slice(0, 120),
            category: 'Vendas de pedidos', amountCents: order.totalCents,
            movementDate: paymentDate, paymentMethod,
          }, 'order_payment', order.id)
          assertUniqueFinancialSource(data.financialEntries, entry.sourceType, entry.sourceId)
          data.financialEntries.push(entry)
          const paidAt = new Date().toISOString()
          Object.assign(order, { paymentStatus: 'paid', paidCents: order.totalCents, incomeEntryId: entry.id, paymentDate, paymentMethod, paidAt, updatedAt: paidAt })
          Object.assign(receivable, { status: 'received', receivedAt: paidAt, incomeEntryId: entry.id, paymentMethod, receivedDate: paymentDate })
          appendAudit(data, 'order.payment.received', 'order', order.id, { entryId: entry.id, receivableId: receivable.id, amountCents: entry.amountCents, paymentMethod, paymentDate })
          appendAudit(data, 'finance.receivable.received_from_order', 'receivable', receivable.id, { orderId: order.id, entryId: entry.id, amountCents: entry.amountCents })
          return { order, entry, receivable, idempotent: false }
        })
        return responseJson(response, 200, result)
      }

      const orderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/)
      if (method === 'PATCH' && orderStatusMatch) {
        const body = await readJson(request)
        const result = await store.transact((data) => {
          const order = data.orders.find((item) => item.id === decodeURIComponent(orderStatusMatch[1]))
          if (!order) throw new Error('ORDER_NOT_FOUND')
          const session = openOrderSession(data)
          if (!session) throw new Error('ORDER_SESSION_NOT_OPEN')
          if (order.sessionId && order.sessionId !== session.id) throw new Error('ORDER_SESSION_CLOSED')
          const hasOrderPayment = data.financialEntries.some((entry) => entry.sourceType === 'order_payment' && entry.sourceId === order.id)
          if (body.status === 'cancelled' && (order.paymentStatus === 'paid' || hasOrderPayment)) throw new Error('PAID_ORDER_CANNOT_BE_CANCELLED_WITHOUT_REFUND')
          const transitioned = transitionOrderStatus(order, body.status)
          const timestamp = new Date().toISOString()
          Object.assign(order, transitioned, { updatedAt: timestamp })

          if (order.status === 'cancelled') {
            releaseOrderStock(data, order, timestamp)
            const receivable = data.receivables.find((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
            if (receivable && receivable.status === 'pending') {
              receivable.status = 'cancelled'
              receivable.cancelledAt = order.updatedAt
            }
          }
          appendAudit(data, 'order.status.changed', 'order', order.id, { status: order.status })
          return order
        })
        return responseJson(response, 200, { order: result })
      }

      return responseJson(response, 404, { error: 'NOT_FOUND', message: 'Rota não encontrada.' })
    } catch (error) {
      const mapped = apiError(error)
      if (mapped.status >= 500) console.error('[P16 local API]', error?.stack || error)
      return responseJson(response, mapped.status, mapped.body)
    }
  })
}
