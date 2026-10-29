import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const targets = {
  app: path.join(root, 'src', 'App.tsx'),
  css: path.join(root, 'src', 'styles.css'),
  api: path.join(root, 'server', 'api.mjs'),
  tests: path.join(root, 'tests', 'api.test.mjs'),
}

async function readTarget(key) {
  try { return await readFile(targets[key], 'utf8') }
  catch (error) {
    throw new Error(`Não consegui ler ${path.relative(root, targets[key])}. Execute o script na raiz do P16 e confira se os arquivos existem. ${error.message}`)
  }
}
function replaceOnce(content, oldText, newText, label) {
  const count = content.split(oldText).length - 1
  if (count !== 1) throw new Error(`Não consegui aplicar "${label}": esperava encontrar exatamente 1 trecho-base e encontrei ${count}. Nenhum arquivo foi alterado. Confira se o projeto local corresponde à versão recente do GitHub.`)
  return content.replace(oldText, newText)
}
function replaceAllExpected(content, oldText, newText, expectedCount, label) {
  const count = content.split(oldText).length - 1
  if (count !== expectedCount) throw new Error(`Não consegui aplicar "${label}": esperava ${expectedCount} ocorrências do trecho-base e encontrei ${count}. Nenhum arquivo foi alterado.`)
  return content.split(oldText).join(newText)
}
function insertBefore(content, anchor, insertion, label) {
  return replaceOnce(content, anchor, `${insertion}\n${anchor}`, label)
}

let app = await readTarget('app')
let css = await readTarget('css')
let api = await readTarget('api')
let tests = await readTarget('tests')

if (app.includes('paymentOrderId') || api.includes('ORDER_PAYMENT_VIA_ORDER_ACTION')) {
  throw new Error('A Etapa 12 parece já estar aplicada. Não fiz nenhuma alteração.')
}

/* API: migrate any order created before automatic receivables existed. */
const auditHelperAnchor = `function decorateProduct(product) {`
const orderReceivableHelpers = `function ensureOrderReceivablesInData(data) {
  for (const order of data.orders) {
    let receivable = data.receivables.find((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
    const paymentEntry = data.financialEntries.find((item) => item.sourceType === 'order_payment' && item.sourceId === order.id)
    const isPaid = order.paymentStatus === 'paid' || Boolean(paymentEntry)

    if (!receivable) {
      const cancelled = order.status === 'cancelled'
      receivable = {
        id: randomUUID(),
        description: \`Pedido #\${order.number}\`,
        counterparty: order.customer || 'Balcão',
        amountCents: order.totalCents,
        dueDate: order.orderDate || businessDate(),
        status: cancelled ? 'cancelled' : isPaid ? 'received' : 'pending',
        receivedAt: isPaid ? (order.paidAt ?? paymentEntry?.createdAt ?? new Date().toISOString()) : null,
        incomeEntryId: paymentEntry?.id ?? order.incomeEntryId ?? null,
        orderId: order.id,
        orderNumber: Number(order.number),
        createdAt: order.createdAt ?? new Date().toISOString(),
        sourceType: 'order',
      }
      data.receivables.push(receivable)
      order.receivableId = receivable.id
      appendAudit(data, 'finance.receivable.migrated_from_order', 'receivable', receivable.id, { orderId: order.id, orderNumber: order.number, amountCents: order.totalCents })
    } else {
      receivable.orderId = order.id
      receivable.orderNumber = Number(order.number)
      order.receivableId = receivable.id
    }

    if (order.status === 'cancelled' && receivable.status === 'pending') {
      receivable.status = 'cancelled'
      receivable.cancelledAt = order.updatedAt ?? new Date().toISOString()
    } else if (isPaid && paymentEntry) {
      receivable.status = 'received'
      receivable.receivedAt = order.paidAt ?? paymentEntry.createdAt ?? new Date().toISOString()
      receivable.incomeEntryId = paymentEntry.id
      receivable.paymentMethod = paymentEntry.paymentMethod
      receivable.receivedDate = paymentEntry.movementDate
      order.paymentStatus = 'paid'
      order.paidCents = order.totalCents
      order.incomeEntryId = paymentEntry.id
      order.paymentMethod = paymentEntry.paymentMethod
      order.paymentDate = paymentEntry.movementDate
      order.paidAt ??= paymentEntry.createdAt
    }
  }
}

async function ensureOrderReceivables(store) {
  const snapshot = await store.read()
  const hasMissingOrderReceivable = snapshot.orders.some((order) =>
    !snapshot.receivables.some((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
  )
  if (!hasMissingOrderReceivable) return snapshot
  await store.transact((data) => ensureOrderReceivablesInData(data))
  return store.read()
}

`
api = insertBefore(api, auditHelperAnchor, orderReceivableHelpers, 'migração de pedidos antigos')

api = replaceOnce(
  api,
  `'INVALID_ORDER_STATUS_TRANSITION', 'PRODUCT_STOCK_MUST_USE_MOVEMENT',\n  ])`,
  `'INVALID_ORDER_STATUS_TRANSITION', 'PRODUCT_STOCK_MUST_USE_MOVEMENT',\n    'ORDER_CANNOT_BE_PAID_AFTER_CANCELLATION', 'ORDER_RECEIVABLE_PAYMENT_VIA_ORDER', 'ORDER_RECEIVABLE_MANAGED_BY_ORDER', 'PAID_ORDER_CANNOT_BE_CANCELLED',\n  ])`,
  'erros de pagamento de pedidos'
)
api = replaceOnce(
  api,
  `    PRODUCT_STOCK_NOT_TRACKED: 'Este item é preparado na hora e não possui estoque por unidade. O custo cadastrado é apenas uma estimativa; controle de ingredientes/receitas pode ser avaliado futuramente.',`,
  `    PRODUCT_STOCK_NOT_TRACKED: 'Este item é preparado na hora e não possui estoque por unidade. O custo cadastrado é apenas uma estimativa; controle de ingredientes/receitas pode ser avaliado futuramente.',\n    ORDER_CANNOT_BE_PAID_AFTER_CANCELLATION: 'Pedidos cancelados não podem ser marcados como pagos.',\n    ORDER_RECEIVABLE_PAYMENT_VIA_ORDER: 'Este valor pertence a um pedido. Registre o pagamento pela aba Pedidos para sincronizar o caixa e o pedido.',\n    ORDER_RECEIVABLE_MANAGED_BY_ORDER: 'Este valor está vinculado a um pedido e não pode ser removido separadamente. Gerencie-o pela aba Pedidos.',\n    PAID_ORDER_CANNOT_BE_CANCELLED: 'Este pedido já foi pago. O cancelamento exige um fluxo de estorno, ainda não disponível.',`,
  'mensagens de pagamento de pedidos'
)
api = replaceOnce(
  api,
  `      if (method === 'GET' && pathname === '/api/admin/dashboard') {\n        const state = await store.read()`,
  `      if (method === 'GET' && pathname === '/api/admin/dashboard') {\n        const state = await ensureOrderReceivables(store)`,
  'sincronização dos pedidos no resumo financeiro'
)
api = replaceOnce(
  api,
  `      if (method === 'GET' && pathname === '/api/admin/finance/receivables') {\n        const state = await store.read()`,
  `      if (method === 'GET' && pathname === '/api/admin/finance/receivables') {\n        const state = await ensureOrderReceivables(store)`,
  'sincronização de pedidos em valores a receber'
)
api = replaceOnce(
  api,
  `      if (method === 'GET' && pathname === '/api/admin/orders') {\n        const state = await store.read()`,
  `      if (method === 'GET' && pathname === '/api/admin/orders') {\n        const state = await ensureOrderReceivables(store)`,
  'migração de pedidos ao consultar pedidos'
)
api = replaceOnce(
  api,
  `          const order = {\n            id: randomUUID(), number: data.nextOrderNumber++, customer: String(body.customer ?? 'Balcão').trim().slice(0, 120) || 'Balcão',\n            status: 'received', paymentStatus: 'unpaid', paidCents: 0, totalCents, items,\n            createdAt: new Date().toISOString(), orderDate: businessDate(),\n          }\n          data.orders.push(order)`,
  `          const createdAt = new Date().toISOString()\n          const order = {\n            id: randomUUID(), number: data.nextOrderNumber++, customer: String(body.customer ?? 'Balcão').trim().slice(0, 120) || 'Balcão',\n            status: 'received', paymentStatus: 'unpaid', paidCents: 0, totalCents, items,\n            createdAt, orderDate: businessDate(),\n          }\n          const receivable = {\n            id: randomUUID(), description: \`Pedido #\${order.number}\`, counterparty: order.customer,\n            amountCents: totalCents, dueDate: order.orderDate, status: 'pending', receivedAt: null,\n            incomeEntryId: null, orderId: order.id, orderNumber: order.number, createdAt, sourceType: 'order',\n          }\n          order.receivableId = receivable.id\n          data.receivables.push(receivable)\n          data.orders.push(order)`,
  'criação automática do valor a receber do pedido'
)
api = replaceOnce(
  api,
  `          const receivable = data.receivables.find((item) => item.id === decodeURIComponent(receivableReceiveMatch[1]))\n          if (!receivable) throw new Error('RECEIVABLE_NOT_FOUND')\n          if (receivable.status === 'received' && receivable.incomeEntryId) {`,
  `          const receivable = data.receivables.find((item) => item.id === decodeURIComponent(receivableReceiveMatch[1]))\n          if (!receivable) throw new Error('RECEIVABLE_NOT_FOUND')\n          if (receivable.orderId) throw new Error('ORDER_RECEIVABLE_PAYMENT_VIA_ORDER')\n          if (receivable.status === 'received' && receivable.incomeEntryId) {`,
  'proteger pagamento de pedidos pela aba Pedidos'
)
api = replaceOnce(
  api,
  `          const receivable = data.receivables[index]\n          if (receivable.status === 'received' || receivable.incomeEntryId) throw new Error('RECEIVABLE_ALREADY_RECEIVED')`,
  `          const receivable = data.receivables[index]\n          if (receivable.orderId) throw new Error('ORDER_RECEIVABLE_MANAGED_BY_ORDER')\n          if (receivable.status === 'received' || receivable.incomeEntryId) throw new Error('RECEIVABLE_ALREADY_RECEIVED')`,
  'proteger exclusão de valores a receber de pedidos'
)
const orderStatusLine = `      const orderStatusMatch = pathname.match(/^\\/api\\/admin\\/orders\\/([^/]+)\\/status$/)`
const orderPaymentRoute = `      const orderPayMatch = pathname.match(/^\\/api\\/admin\\/orders\\/([^/]+)\\/pay$/)
      if (method === 'POST' && orderPayMatch) {
        const body = await readJson(request)
        const paymentDate = requireDateOrToday(body.paymentDate)
        const paymentMethod = body.paymentMethod ?? 'Não informado'
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD')
        await ensureOrderReceivables(store)
        const result = await store.transact((data) => {
          const order = data.orders.find((item) => item.id === decodeURIComponent(orderPayMatch[1]))
          if (!order) throw new Error('ORDER_NOT_FOUND')
          if (order.status === 'cancelled') throw new Error('ORDER_CANNOT_BE_PAID_AFTER_CANCELLATION')

          let receivable = data.receivables.find((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))
          if (!receivable) {
            receivable = {
              id: randomUUID(), description: \`Pedido #\${order.number}\`, counterparty: order.customer || 'Balcão',
              amountCents: order.totalCents, dueDate: order.orderDate || businessDate(), status: 'pending',
              receivedAt: null, incomeEntryId: null, orderId: order.id, orderNumber: Number(order.number),
              createdAt: order.createdAt ?? new Date().toISOString(), sourceType: 'order',
            }
            data.receivables.push(receivable)
            order.receivableId = receivable.id
          }

          const existingEntry = data.financialEntries.find((item) => item.sourceType === 'order_payment' && item.sourceId === order.id)
          if (existingEntry) {
            const paidAt = order.paidAt ?? existingEntry.createdAt ?? new Date().toISOString()
            Object.assign(order, {
              paymentStatus: 'paid', paidCents: order.totalCents, paymentMethod: existingEntry.paymentMethod,
              paymentDate: existingEntry.movementDate, paidAt, incomeEntryId: existingEntry.id, updatedAt: paidAt,
            })
            Object.assign(receivable, {
              status: 'received', receivedAt: paidAt, incomeEntryId: existingEntry.id,
              paymentMethod: existingEntry.paymentMethod, receivedDate: existingEntry.movementDate,
            })
            return { order, entry: existingEntry, receivable, idempotent: true }
          }

          const entry = newFinancialEntry({
            direction: 'income',
            description: \`Pedido #\${order.number} - \${order.customer || 'Balcão'}\`.slice(0, 120),
            category: 'Vendas de pedidos',
            amountCents: order.totalCents,
            movementDate: paymentDate,
            paymentMethod,
          }, 'order_payment', order.id)
          assertUniqueFinancialSource(data.financialEntries, entry.sourceType, entry.sourceId)
          const paidAt = new Date().toISOString()
          data.financialEntries.push(entry)
          Object.assign(order, {
            paymentStatus: 'paid', paidCents: order.totalCents, paymentMethod,
            paymentDate, paidAt, incomeEntryId: entry.id, updatedAt: paidAt,
          })
          Object.assign(receivable, {
            status: 'received', receivedAt: paidAt, incomeEntryId: entry.id,
            paymentMethod, receivedDate: paymentDate,
          })
          appendAudit(data, 'order.payment.confirmed', 'order', order.id, {
            orderNumber: order.number, amountCents: order.totalCents, paymentMethod, paymentDate, entryId: entry.id,
          })
          appendAudit(data, 'finance.receivable.received_from_order', 'receivable', receivable.id, {
            orderId: order.id, orderNumber: order.number, entryId: entry.id, amountCents: order.totalCents,
          })
          return { order, entry, receivable, idempotent: false }
        })
        return responseJson(response, 200, result)
      }

`
api = insertBefore(api, orderStatusLine, orderPaymentRoute, 'rota de confirmar pagamento do pedido')
api = replaceOnce(
  api,
  `          const transitioned = transitionOrderStatus(order, body.status)\n          Object.assign(order, transitioned, { updatedAt: new Date().toISOString() })\n          appendAudit(data, 'order.status.changed', 'order', order.id, { status: order.status })`,
  `          if (body.status === 'cancelled' && order.paymentStatus === 'paid') throw new Error('PAID_ORDER_CANNOT_BE_CANCELLED')\n          const transitioned = transitionOrderStatus(order, body.status)\n          Object.assign(order, transitioned, { updatedAt: new Date().toISOString() })\n          if (order.status === 'cancelled') {\n            const receivable = data.receivables.find((item) => item.orderId === order.id || (order.receivableId && item.id === order.receivableId))\n            if (receivable?.status === 'pending') {\n              receivable.status = 'cancelled'\n              receivable.cancelledAt = order.updatedAt\n            }\n          }\n          appendAudit(data, 'order.status.changed', 'order', order.id, { status: order.status })`,
  'sincronização de cancelamento do pedido com valores a receber'
)

/* Frontend: payment state + order-level payment action. */
app = replaceOnce(
  app,
  `type Receivable = { id: string; title: string; counterparty: string; amount: number; due: string; received: boolean }`,
  `type Receivable = { id: string; title: string; counterparty: string; amount: number; due: string; received: boolean; cancelled?: boolean; orderId?: string; orderNumber?: number }`,
  'modelo visual de valores a receber'
)
app = replaceOnce(
  app,
  `type Order = { id: string; number: number; customer: string; items: string; total: number; status: OrderStatus; created: string; itemRecords: { productId: string; quantity: number }[] }`,
  `type Order = { id: string; number: number; customer: string; items: string; total: number; status: OrderStatus; created: string; paid: boolean; paymentMethod?: string; paymentDate?: string; receivableId?: string; itemRecords: { productId: string; quantity: number }[] }`,
  'modelo visual do estado de pagamento'
)
app = replaceOnce(
  app,
  `type ApiReceivable = { id: string; description: string; counterparty?: string | null; amountCents: number; dueDate: string; status: string }`,
  `type ApiReceivable = { id: string; description: string; counterparty?: string | null; amountCents: number; dueDate: string; status: string; orderId?: string; orderNumber?: number }`,
  'modelo API de valores a receber'
)
app = replaceOnce(
  app,
  `type ApiOrder = { id: string; number: number; customer: string; status: string; totalCents: number; createdAt: string; items: { productId: string; nameSnapshot: string; quantityMilli: number }[] }`,
  `type ApiOrder = { id: string; number: number; customer: string; status: string; paymentStatus?: string; paymentMethod?: string | null; paymentDate?: string | null; receivableId?: string | null; totalCents: number; createdAt: string; items: { productId: string; nameSnapshot: string; quantityMilli: number }[] }`,
  'modelo API de pedidos com pagamento'
)
app = replaceOnce(
  app,
  `function mapReceivable(item: ApiReceivable): Receivable {\n  return { id: String(item.id), title: item.description, counterparty: item.counterparty || 'Não informado', amount: centsToReais(item.amountCents), due: displayDate(item.dueDate), received: item.status === 'received' }\n}`,
  `function mapReceivable(item: ApiReceivable): Receivable {\n  return {\n    id: String(item.id), title: item.description, counterparty: item.counterparty || 'Não informado',\n    amount: centsToReais(item.amountCents), due: displayDate(item.dueDate), received: item.status === 'received',\n    cancelled: item.status === 'cancelled', orderId: item.orderId, orderNumber: item.orderNumber,\n  }\n}`,
  'mapeamento de valores a receber ligados a pedidos'
)
app = replaceOnce(
  app,
  `    id: String(item.id), number: Number(item.number), customer: item.customer || 'Balcão',\n    items: item.items.map((line) => \`\${line.quantityMilli / 1000}x \${line.nameSnapshot}\`).join(', '),\n    total: centsToReais(item.totalCents), status: uiOrderStatus[item.status] || 'Recebido', created: displayTime(item.createdAt),\n    itemRecords: item.items.map((line) => ({ productId: String(line.productId), quantity: line.quantityMilli / 1000 })),`,
  `    id: String(item.id), number: Number(item.number), customer: item.customer || 'Balcão',\n    items: item.items.map((line) => \`\${line.quantityMilli / 1000}x \${line.nameSnapshot}\`).join(', '),\n    total: centsToReais(item.totalCents), status: uiOrderStatus[item.status] || 'Recebido', created: displayTime(item.createdAt),\n    paid: item.paymentStatus === 'paid', paymentMethod: item.paymentMethod ?? undefined, paymentDate: item.paymentDate ?? undefined, receivableId: item.receivableId ?? undefined,\n    itemRecords: item.items.map((line) => ({ productId: String(line.productId), quantity: line.quantityMilli / 1000 })),`,
  'mapeamento do estado de pagamento dos pedidos'
)
app = replaceOnce(
  app,
  `  const openReceivables = receivables.filter((item) => !item.received)`,
  `  const openReceivables = receivables.filter((item) => !item.received && !item.cancelled)`,
  'resumo de valores a receber sem cancelamentos'
)
app = replaceOnce(
  app,
  `<p>O pedido é salvo no backend. Estoque e caixa não são alterados automaticamente nesta etapa.</p>`,
  `<p>O pedido entra em valores a receber. Ao registrar o pagamento aqui, o caixa e o financeiro são atualizados automaticamente.</p>`,
  'explicação do formulário de pedido'
)
app = replaceOnce(
  app,
  `<p>{receivables.filter((r) => !r.received).length} pendentes · {money(centsToReais(summary.pendingReceivablesCents))} em aberto</p>`,
  `<p>{receivables.filter((r) => !r.received && !r.cancelled).length} pendentes · {money(centsToReais(summary.pendingReceivablesCents))} em aberto</p>`,
  'contador de valores pendentes'
)
app = replaceAllExpected(
  app,
  `<span className={\`status-pill \${r.received ? 'done' : 'pending'}\`}>{r.received ? 'Recebido' : 'Pendente'}</span>`,
  `<span className={\`status-pill \${r.received ? 'done' : r.cancelled ? 'cancelled' : 'pending'}\`}>{r.received ? 'Recebido' : r.cancelled ? 'Cancelado' : 'Pendente'}</span>`,
  2,
  'status de valores a receber'
)
const desktopReceivableActions = `<div className="record-actions">{!r.received ? <button className="small-action" disabled={!apiReady} onClick={() => void markReceivableReceived(r)}><Check size={14} /> Confirmar</button> : <span className="muted-cell">Histórico preservado</span>}{!r.received && <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removeReceivable(r)}><Trash2 size={14} /> Excluir</button>}</div>`
const desktopReceivableReplacement = `<div className="record-actions">{r.orderId ? <span className="muted-cell">{r.cancelled ? 'Pedido cancelado' : r.received ? \`Pagamento registrado em Pedidos #\${r.orderNumber}\` : \`Pagamento gerenciado em Pedidos #\${r.orderNumber}\`}</span> : <>{!r.received && !r.cancelled ? <button className="small-action" disabled={!apiReady} onClick={() => void markReceivableReceived(r)}><Check size={14} /> Confirmar</button> : <span className="muted-cell">Histórico preservado</span>}{!r.received && !r.cancelled && <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removeReceivable(r)}><Trash2 size={14} /> Excluir</button>}</>}</div>`
app = replaceOnce(app, desktopReceivableActions, desktopReceivableReplacement, 'ações dos valores a receber no desktop')
const mobileReceivableActions = `<div className="record-actions">{!r.received && <button className="small-action" disabled={!apiReady} onClick={() => void markReceivableReceived(r)}><Check size={14} /> Confirmar</button>}{!r.received ? <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removeReceivable(r)}><Trash2 size={14} /> Excluir valor</button> : <span className="muted-cell">Histórico preservado</span>}</div>`
const mobileReceivableReplacement = `<div className="record-actions">{r.orderId ? <span className="muted-cell">{r.cancelled ? 'Pedido cancelado' : r.received ? \`Pagamento registrado em Pedidos #\${r.orderNumber}\` : \`Pagamento gerenciado em Pedidos #\${r.orderNumber}\`}</span> : <>{!r.received && !r.cancelled && <button className="small-action" disabled={!apiReady} onClick={() => void markReceivableReceived(r)}><Check size={14} /> Confirmar</button>}{!r.received && !r.cancelled ? <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removeReceivable(r)}><Trash2 size={14} /> Excluir valor</button> : <span className="muted-cell">Histórico preservado</span>}</>}</div>`
app = replaceOnce(app, mobileReceivableActions, mobileReceivableReplacement, 'ações dos valores a receber no mobile')

app = replaceOnce(
  app,
  `  const [customer, setCustomer] = useState('Balcão')\n  const sellableProducts = products.filter((p) => p.sellable)`,
  `  const [customer, setCustomer] = useState('Balcão')\n  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)\n  const sellableProducts = products.filter((p) => p.sellable)`,
  'estado do formulário de pagamento do pedido'
)
app = replaceOnce(
  app,
  `  const shownOrders = useMemo(() => orders.filter((o) => \`\${o.number} \${o.customer} \${o.items} \${o.status}\`.toLowerCase().includes(search.toLowerCase())), [orders, search])`,
  `  const shownOrders = useMemo(() => orders.filter((o) => \`\${o.number} \${o.customer} \${o.items} \${o.status} \${o.paid ? 'pago' : 'pendente'}\`.toLowerCase().includes(search.toLowerCase())), [orders, search])\n  const unpaidOrders = orders.filter((o) => !o.paid && o.status !== 'Cancelado')\n  const unpaidOrdersTotal = unpaidOrders.reduce((sum, order) => sum + order.total, 0)`,
  'filtro e totais de pagamentos pendentes dos pedidos'
)
const paymentHandlerAnchor = `  return <section className="page-content"><div className="page-heading-row"><div><div className="section-kicker">OPERAÇÃO DO ESTABELECIMENTO</div><h1>Pedidos</h1>`
const paymentHandler = `  const confirmOrderPayment = async (event: FormEvent<HTMLFormElement>, order: Order) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const paymentDate = String(data.get('paymentDate') || businessTodayIso())
    const paymentMethod = String(data.get('paymentMethod') || 'Não informado')
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (order.paid) return toast(\`Pedido #\${order.number} já está pago.\`)
    try {
      await apiRequest<{ order: ApiOrder }>(\`/admin/orders/\${encodeURIComponent(order.id)}/pay\`, {
        method: 'POST',
        body: JSON.stringify({ paymentDate, paymentMethod }),
      })
      setPaymentOrderId(null)
      await onRefresh()
      toast(\`Pagamento do pedido #\${order.number} registrado no financeiro.\`)
    } catch (error) { toast(errorText(error)) }
  }

`
app = insertBefore(app, paymentHandlerAnchor, paymentHandler, 'ação para confirmar pagamento em Pedidos')
app = replaceOnce(
  app,
  `<p>Atualize o status conforme a equipe avança.</p>`,
  `<p>{unpaidOrders.length} pedidos aguardando pagamento · {money(unpaidOrdersTotal)} em aberto. Entrega e pagamento são controlados separadamente.</p>`,
  'resumo de pagamentos pendentes no quadro de pedidos'
)

const oldOrderList = "{shownOrders.length === 0 ? <div className=\"empty-state\">Nenhum pedido encontrado.</div> : <div className=\"order-list\">{shownOrders.map((order) => <article className=\"order-card\" key={order.id}><div className=\"order-number\"><span>PEDIDO</span><strong>#{order.number}</strong><small>{order.created}</small></div><div className=\"order-description\"><strong>{order.customer}</strong><p>{order.items}</p><span className=\"order-total\">{money(order.total)}</span></div><div className=\"order-status-actions\"><span className={`status-pill ${order.status === 'Pronto' ? 'ready' : order.status === 'Entregue' ? 'done' : order.status === 'Cancelado' ? 'done' : 'pending'}`}>{order.status}</span>{order.status !== 'Entregue' && order.status !== 'Cancelado' && <button className={`small-action ${order.status === 'Em preparo' ? 'ready-action' : ''}`} disabled={!apiReady} onClick={() => void advanceOrder(order)}>{order.status === 'Recebido' ? 'Iniciar preparo' : order.status === 'Em preparo' ? 'Marcar pronto' : 'Confirmar retirada'} <ArrowUpRight size={14} /></button>}</div></article>)}</div>}"
const newOrderList = "{shownOrders.length === 0 ? <div className=\"empty-state\">Nenhum pedido encontrado.</div> : <div className=\"order-list\">{shownOrders.map((order) => <div className=\"order-record\" key={order.id}>\n        <article className=\"order-card\">\n          <div className=\"order-number\"><span>PEDIDO</span><strong>#{order.number}</strong><small>{order.created}</small></div>\n          <div className=\"order-description\"><strong>{order.customer}</strong><p>{order.items}</p><span className=\"order-total\">{money(order.total)}</span></div>\n          <div className=\"order-status-actions\">\n            <div className=\"order-status-pills\">\n              <span className={`status-pill ${order.status === 'Pronto' ? 'ready' : order.status === 'Entregue' ? 'done' : order.status === 'Cancelado' ? 'cancelled' : 'pending'}`}>{order.status}</span>\n              <span className={`status-pill order-payment-pill ${order.paid ? 'paid' : order.status === 'Cancelado' ? 'no-charge' : 'pending'}`}>{order.paid ? 'Pago' : order.status === 'Cancelado' ? 'Sem cobrança' : 'Pagamento pendente'}</span>\n            </div>\n            <div className=\"order-action-buttons\">\n              {!order.paid && order.status !== 'Cancelado' && <button className=\"small-action payment-action\" disabled={!apiReady} onClick={() => setPaymentOrderId(paymentOrderId === order.id ? null : order.id)}><CheckCircle2 size={14} /> {paymentOrderId === order.id ? 'Fechar pagamento' : 'Marcar pago'}</button>}\n              {order.status !== 'Entregue' && order.status !== 'Cancelado' && <button className={`small-action ${order.status === 'Em preparo' ? 'ready-action' : ''}`} disabled={!apiReady} onClick={() => void advanceOrder(order)}>{order.status === 'Recebido' ? 'Iniciar preparo' : order.status === 'Em preparo' ? 'Marcar pronto' : 'Confirmar retirada'} <ArrowUpRight size={14} /></button>}\n            </div>\n          </div>\n        </article>\n        {paymentOrderId === order.id && !order.paid && order.status !== 'Cancelado' && <form className=\"order-payment-form\" onSubmit={(event) => void confirmOrderPayment(event, order)}>\n          <div className=\"order-payment-form-heading\"><div><strong>Confirmar pagamento do pedido #{order.number}</strong><span>Valor total: {money(order.total)} · lançamento integral no caixa</span></div><button className=\"icon-button\" type=\"button\" aria-label=\"Fechar pagamento\" onClick={() => setPaymentOrderId(null)}><X size={16} /></button></div>\n          <label>Data do pagamento<input name=\"paymentDate\" type=\"date\" defaultValue={businessTodayIso()} required /></label>\n          <label>Forma de pagamento<select name=\"paymentMethod\" defaultValue=\"Pix\" required><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option></select></label>\n          <div className=\"order-payment-form-actions\"><button className=\"outline-button\" type=\"button\" onClick={() => setPaymentOrderId(null)}>Cancelar</button><button className=\"primary-button\" type=\"submit\" disabled={!apiReady}><CheckCircle2 size={15} /> Confirmar pagamento</button></div>\n        </form>}\n      </div>)}</div>}"
app = replaceOnce(app, oldOrderList, newOrderList, 'layout de pedidos com pagamento')

css += "\n\n/* P16 Etapa 12 — pedido, pagamento e contas a receber têm estados independentes. */\n.order-record { border-top: 1px solid #2d2d29; }\n.order-record:first-child { border-top: 0; }\n.order-record .order-card { border-top: 0; }\n.order-status-actions { min-width: 0; }\n.order-status-pills { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; }\n.order-action-buttons { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 7px; }\n.order-payment-pill.paid { background: #1f382b; color: #73d1a3; }\n.order-payment-pill.pending { background: #3b321b; color: #e3c45c; }\n.order-payment-pill.no-charge, .status-pill.cancelled { background: #2b2b28; color: #aaa99f; }\n.payment-action { border-color: #4c421e; background: #292416; color: #f1d56e; }\n.payment-action:hover { background: #393019; border-color: #796328; }\n.order-payment-form { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(170px, .75fr) minmax(170px, .75fr) auto; align-items: end; gap: 12px; margin: 0 4px 15px 95px; padding: 15px; border: 1px solid #5b4b1e; border-radius: 9px; background: #211e14; }\n.order-payment-form-heading { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }\n.order-payment-form-heading > div { display: flex; flex-direction: column; gap: 5px; }\n.order-payment-form-heading strong { color: #f5e2a1; font-size: 13px; }\n.order-payment-form-heading span { color: #aaa18a; font-size: 11px; line-height: 1.5; }\n.order-payment-form label { display: flex; flex-direction: column; gap: 7px; color: #c4bd9f; font-size: 11px; font-weight: 600; }\n.order-payment-form input, .order-payment-form select { min-width: 0; width: 100%; height: 38px; padding: 0 10px; border: 1px solid #49422c; border-radius: 7px; background: #151514; color: #f1efe6; font: inherit; font-size: 12px; }\n.order-payment-form-actions { display: flex; justify-content: flex-end; gap: 8px; grid-column: 1 / -1; }\n@media (min-width: 761px) {\n  .order-status-pills .status-pill { font-size: 11px; min-height: 25px; }\n  .order-action-buttons .small-action { font-size: 11px; min-height: 35px; }\n  .order-payment-form { margin-left: 95px; }\n}\n@media (max-width: 760px) {\n  .order-status-pills, .order-action-buttons { justify-content: flex-start; align-items: flex-start; }\n  .order-status-actions { flex-wrap: wrap; }\n  .order-payment-form { margin: 0 0 14px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding: 13px; gap: 10px; }\n  .order-payment-form-heading, .order-payment-form-actions { grid-column: 1 / -1; }\n  .order-payment-form-heading strong { font-size: 12px; }\n  .order-payment-form label { font-size: 11px; }\n  .order-payment-form input, .order-payment-form select { height: 41px; font-size: 12px; }\n  .order-payment-form-actions { flex-wrap: wrap; }\n}\n@media (max-width: 390px) {\n  .order-payment-form { grid-template-columns: minmax(0, 1fr); }\n  .order-payment-form-heading, .order-payment-form-actions { grid-column: 1; }\n}\n"

const newTests = "\ntest('order creates an open receivable and paying from orders updates finance exactly once', async () => withFixture(async (app) => {\n  const product = await createProduct(app, { name: 'Copão pagamento', kind: 'prepared', stockQuantity: 0, stockMinimum: 0, priceCents: 2500, costCents: 1050 })\n  const created = await app.json('/api/admin/orders', {\n    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 2 }] }),\n  })\n  assert.equal(created.response.status, 201, JSON.stringify(created.body))\n  const order = created.body.order\n  assert.equal(order.paymentStatus, 'unpaid')\n\n  const receivablesBefore = await app.json('/api/admin/finance/receivables')\n  const orderReceivable = receivablesBefore.body.receivables.find((item) => item.orderId === order.id)\n  assert.ok(orderReceivable)\n  assert.equal(orderReceivable.status, 'pending')\n  assert.equal(orderReceivable.amountCents, 5000)\n\n  const route = `/api/admin/orders/${order.id}/pay`\n  const options = { method: 'POST', body: JSON.stringify({ paymentDate: '2026-10-15', paymentMethod: 'Pix' }) }\n  const [first, second] = await Promise.all([app.json(route, options), app.json(route, options)])\n  assert.equal(first.response.status, 200, JSON.stringify(first.body))\n  assert.equal(second.response.status, 200, JSON.stringify(second.body))\n  assert.equal([first.body.idempotent, second.body.idempotent].filter(Boolean).length, 1)\n\n  const state = await app.store.read()\n  const savedOrder = state.orders.find((item) => item.id === order.id)\n  const savedReceivable = state.receivables.find((item) => item.orderId === order.id)\n  const orderEntries = state.financialEntries.filter((item) => item.sourceType === 'order_payment' && item.sourceId === order.id)\n  assert.equal(savedOrder.paymentStatus, 'paid')\n  assert.equal(savedOrder.paidCents, 5000)\n  assert.equal(savedOrder.paymentMethod, 'Pix')\n  assert.equal(savedReceivable.status, 'received')\n  assert.equal(savedReceivable.incomeEntryId, orderEntries[0].id)\n  assert.equal(orderEntries.length, 1)\n\n  const dashboard = await app.json('/api/admin/dashboard?month=2026-10')\n  assert.equal(dashboard.body.summary.incomeCents, 5000)\n  assert.equal(dashboard.body.summary.pendingReceivablesCents, 0)\n}))\n\ntest('old unpaid orders receive one pending receivable during read migration', async () => withFixture(async (app) => {\n  const product = await createProduct(app, { name: 'Pedido legado', kind: 'prepared', stockQuantity: 0, stockMinimum: 0 })\n  const created = await app.json('/api/admin/orders', {\n    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 1 }] }),\n  })\n  const orderId = created.body.order.id\n  await app.store.transact((data) => {\n    data.receivables = data.receivables.filter((item) => item.orderId !== orderId)\n    const order = data.orders.find((item) => item.id === orderId)\n    delete order.receivableId\n  })\n\n  const response = await app.json('/api/admin/finance/receivables')\n  assert.equal(response.response.status, 200)\n  const migrated = response.body.receivables.filter((item) => item.orderId === orderId)\n  assert.equal(migrated.length, 1)\n  assert.equal(migrated[0].status, 'pending')\n}))\n\ntest('cancelled order clears its pending receivable and cannot be paid', async () => withFixture(async (app) => {\n  const product = await createProduct(app, { name: 'Pedido cancelado', kind: 'prepared', stockQuantity: 0, stockMinimum: 0 })\n  const created = await app.json('/api/admin/orders', {\n    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 1 }] }),\n  })\n  const id = created.body.order.id\n  const cancelled = await app.json(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })\n  assert.equal(cancelled.response.status, 200)\n  const state = await app.store.read()\n  assert.equal(state.receivables.find((item) => item.orderId === id).status, 'cancelled')\n  const payment = await app.json(`/api/admin/orders/${id}/pay`, {\n    method: 'POST', body: JSON.stringify({ paymentDate: '2026-10-15', paymentMethod: 'Pix' }),\n  })\n  assert.equal(payment.response.status, 409)\n  assert.equal((await app.store.read()).financialEntries.filter((item) => item.sourceType === 'order_payment').length, 0)\n}))\n\ntest('order receivable cannot be received independently from the receivables page', async () => withFixture(async (app) => {\n  const product = await createProduct(app, { name: 'Pedido só pelo fluxo de pedidos', kind: 'prepared', stockQuantity: 0, stockMinimum: 0 })\n  const created = await app.json('/api/admin/orders', {\n    method: 'POST', body: JSON.stringify({ customer: 'Balcão', items: [{ productId: product.id, quantity: 1 }] }),\n  })\n  const order = created.body.order\n  const receivable = (await app.json('/api/admin/finance/receivables')).body.receivables.find((item) => item.orderId === order.id)\n  const response = await app.json(`/api/admin/finance/receivables/${receivable.id}/receive`, {\n    method: 'POST', body: JSON.stringify({ receivedDate: '2026-10-15', paymentMethod: 'Pix' }),\n  })\n  assert.equal(response.response.status, 409)\n  const deletion = await app.json(`/api/admin/finance/receivables/${receivable.id}`, { method: 'DELETE' })\n  assert.equal(deletion.response.status, 409)\n  const finalState = await app.store.read()\n  assert.equal(finalState.receivables.find((item) => item.id === receivable.id).status, 'pending')\n  assert.equal(finalState.financialEntries.length, 0)\n}))\n"
test_anchor = `test('local API rejects non-local origins and unknown endpoints', async () => withFixture(async (app) => {`
tests = replaceOnce(tests, test_anchor, newTests + '\n' + test_anchor, 'testes de pagamento integrado de pedidos')

const updated = { app, css, api, tests }
for (const [key, content] of Object.entries(updated)) {
  if (!content || content.length < 100) throw new Error(`Arquivo ${key} não passou na verificação de conteúdo.`)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.join(path.dirname(root), path.basename(root) + '-backup-etapa-12-' + stamp)
await mkdir(backupDir, { recursive: true })
for (const [key, filePath] of Object.entries(targets)) {
  await copyFile(filePath, path.join(backupDir, path.basename(filePath)))
}
try {
  for (const [key, content] of Object.entries(updated)) await writeFile(targets[key], content, 'utf8')
} catch (error) {
  for (const [key, filePath] of Object.entries(targets)) {
    try { await copyFile(path.join(backupDir, path.basename(filePath)), filePath) } catch {}
  }
  throw new Error('A aplicação falhou e os arquivos originais foram restaurados. Backup: ' + backupDir + '. Detalhe: ' + error.message)
}
console.log('Etapa 12 aplicada com sucesso.')
console.log('Arquivos atualizados: src/App.tsx, src/styles.css, server/api.mjs, tests/api.test.mjs')
console.log('Backup dos originais: ' + backupDir)
console.log('Próximo passo: npm test && npm run typecheck && npm run build')
