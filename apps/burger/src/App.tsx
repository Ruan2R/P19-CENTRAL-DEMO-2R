import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardList, CreditCard, LayoutDashboard, LogOut, Package, Plus,
  RefreshCw, Search, ShieldCheck, TrendingUp, Wallet, X, Trash2, PlayCircle, StopCircle,
  LockKeyhole, BarChart3,
} from 'lucide-react'
import { apiRequest } from './api'

type AccessRole = 'finance' | 'full'
type FinanceTab = 'overview' | 'financial' | 'transactions' | 'payables' | 'receivables' | 'inventory'
type Direction = 'income' | 'expense'
type ProductKind = 'resale' | 'prepared'
type Product = { id: string; name: string; category: string; kind: ProductKind; sellable: boolean; stockTracked: boolean; cost: number; price: number; stock: number; minimum: number; unit: string; lowStock?: boolean }
type Movement = { id: string; title: string; category: string; direction: Direction; amount: number; date: string; method: string }
type Payable = { id: string; title: string; category: string; amount: number; due: string; dueIso: string; paid: boolean }
type Receivable = { id: string; title: string; counterparty: string; amount: number; due: string; dueIso: string; received: boolean; cancelled?: boolean; orderId?: string; orderNumber?: number }
type OrderStatus = 'Recebido' | 'Em preparo' | 'Pronto' | 'Entregue' | 'Cancelado'
type Order = { id: string; number: number; customer: string; items: string; total: number; status: OrderStatus; paymentStatus: 'paid' | 'unpaid'; paymentMethod?: string; created: string; businessDate?: string; sessionId?: string; stockReserved?: boolean; itemRecords: { productId: string; quantity: number }[] }
type OrderSession = { id: string; businessDate: string; status: 'open' | 'closed'; startedAt: string; endedAt?: string | null; nextOrderNumber: number; lastOrderNumber?: number }
type ApiOrderSession = { session: OrderSession | null; sessions: OrderSession[] }
type OrderReportLine = { date: string; ordersCount: number; completedCount: number; cancelledCount: number; activeValueCents: number; paidValueCents: number; pendingValueCents: number }
type OrderReport = { period: 'day' | 'month'; startDate: string; endDate: string; key: string; totals: { ordersCount: number; completedCount: number; cancelledCount: number; activeValueCents: number; paidValueCents: number; pendingValueCents: number }; daily: OrderReportLine[] }
type FinanceSummary = { month: string; incomeCents: number; expenseCents: number; cashResultCents: number; pendingPayablesCents: number; pendingReceivablesCents: number }
type ApiProduct = { id: string; name: string; category: string; kind?: ProductKind; sellable?: boolean; stockTracked?: boolean; unit: string; costCents: number; priceCents: number; stockQuantity: number | null; stockMinimum: number | null; lowStock?: boolean; active?: boolean }
type StockMovementType = 'purchase' | 'return' | 'adjustment_in' | 'sale' | 'order_consumption' | 'adjustment_out' | 'waste'
type ManualStockMovementType = Exclude<StockMovementType, 'order_consumption'>
type ApiStockMovement = { id: string; productId: string; type: StockMovementType; quantityMilli: number; beforeMilli: number; afterMilli: number; reason: string; movementDate: string; sourceType: string; sourceId?: string | null; createdAt: string; productName?: string; productUnit?: string }
type StockHistoryFilter = 'all' | 'inbound' | 'outbound' | 'waste'
const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: 'Entrada por compra', return: 'Devolução / retorno', adjustment_in: 'Ajuste de entrada',
  sale: 'Saída por venda', order_consumption: 'Saída por pedido', adjustment_out: 'Ajuste de saída', waste: 'Perda / desperdício',
}
const STOCK_MOVEMENT_GUIDANCE: Record<ManualStockMovementType, { title: string; description: string; placeholder: string }> = {
  purchase: { title: 'Entrada de mercadoria comprada', description: 'Aumenta o estoque. Use quando receber produtos do fornecedor e informe a origem da compra no motivo.', placeholder: 'Ex.: Compra fornecedor X — NF 123' },
  return: { title: 'Devolução que voltou ao estoque', description: 'Aumenta o estoque apenas se os itens voltaram em condição de venda. Informe o pedido, cliente ou fornecedor relacionado.', placeholder: 'Ex.: Devolução do cliente — pedido 042' },
  adjustment_in: { title: 'Correção positiva de estoque', description: 'Use após conferir fisicamente o estoque e encontrar mais itens do que o sistema registra. Não use para registrar compras.', placeholder: 'Ex.: Contagem física — diferença de +3 unidades' },
  sale: { title: 'Venda avulsa fora de Pedidos', description: 'Reduz somente o estoque; não registra recebimento no Financeiro. Use para vendas fora de Pedidos, pois os pedidos do P16 já baixam o estoque automaticamente. Se houve recebimento, registre-o separadamente no Financeiro.', placeholder: 'Ex.: Venda avulsa sem pedido no sistema' },
  adjustment_out: { title: 'Correção negativa de estoque', description: 'Use após conferir fisicamente o estoque e encontrar menos itens do que o sistema registra. Informe a diferença e a conferência realizada.', placeholder: 'Ex.: Contagem física — diferença de -2 unidades' },
  waste: { title: 'Perda ou descarte', description: 'Reduz o estoque de itens vencidos, danificados ou impróprios para venda. Descreva o motivo da perda.', placeholder: 'Ex.: Produto vencido — 2 unidades descartadas' },
}
const STOCK_INBOUND_TYPES = new Set<ManualStockMovementType>(['purchase', 'return', 'adjustment_in'])
const STOCK_MOVEMENT_GROUPS: Record<Exclude<StockHistoryFilter, 'all'>, StockMovementType[]> = {
  inbound: ['purchase', 'return', 'adjustment_in'],
  outbound: ['sale', 'order_consumption', 'adjustment_out'],
  waste: ['waste'],
}
type ApiEntry = { id: string; direction: Direction; description: string; category: string; amountCents: number; movementDate: string; paymentMethod: string }
type ApiPayable = { id: string; description: string; category: string; amountCents: number; dueDate: string; status: string }
type ApiReceivable = { id: string; description: string; counterparty?: string | null; amountCents: number; dueDate: string; status: string; orderId?: string; orderNumber?: number; paymentMethod?: string }
type ApiOrder = { id: string; number: number; customer: string; status: string; paymentStatus?: string; paidCents?: number; paymentDate?: string; paymentMethod?: string; receivableId?: string; totalCents: number; createdAt: string; orderDate?: string; businessDate?: string; sessionDate?: string; sessionId?: string; stockReservedAt?: string | null; stockReleasedAt?: string | null; stockDeducted?: boolean; items: { productId: string; nameSnapshot: string; quantityMilli: number }[] }

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const centsToReais = (cents: number) => cents / 100
const reaisToCents = (value: number) => Math.round((value + Number.EPSILON) * 100)
const DEMO_USERS: Record<string, { password: string; role: AccessRole; displayName: string }> = {
  admin: { password: '2Rdemo26', role: 'finance', displayName: '2R Burger · Financeiro Demo' },
  admin02: { password: '2Rdemo26', role: 'full', displayName: '2R Burger · Gestão Completa' },
}
function getRequestedDemoAccount() {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('demoUser')?.trim().toLowerCase() || '';
  const account = DEMO_USERS[id];
  return account ? { id, ...account } : null;
}

function businessTodayIso() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
function localMonth() { return businessTodayIso().slice(0, 7) }
function dueState(dueIso: string): { key: 'overdue' | 'today' | 'soon' | 'normal'; label: string } {
  const today = businessTodayIso()
  if (!dueIso) return { key: 'normal', label: 'Sem vencimento' }
  if (dueIso < today) return { key: 'overdue', label: 'Vencida' }
  if (dueIso === today) return { key: 'today', label: 'Vence hoje' }
  const limit = new Date(`${today}T12:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + 7)
  if (dueIso <= limit.toISOString().slice(0, 10)) return { key: 'soon', label: 'Vence em breve' }
  return { key: 'normal', label: 'Em dia' }
}
function displayDate(value: string) {
  if (!value) return '—'
  const date = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.split('-').reverse().join('/')
  return date
}
function displayTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function displayMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}
function mapProduct(item: ApiProduct): Product {
  const kind = item.kind ?? 'resale'
  return { id: String(item.id), name: item.name, category: item.category, kind, sellable: item.sellable ?? true, stockTracked: item.stockTracked ?? kind !== 'prepared', unit: item.unit || 'un', cost: centsToReais(item.costCents), price: centsToReais(item.priceCents), stock: Number(item.stockQuantity ?? 0), minimum: Number(item.stockMinimum ?? 0), lowStock: Boolean(item.lowStock) }
}
function mapEntry(item: ApiEntry): Movement {
  return { id: String(item.id), title: item.description, category: item.category, direction: item.direction, amount: centsToReais(item.amountCents), date: displayDate(item.movementDate), method: item.paymentMethod || 'Não informado' }
}
function mapPayable(item: ApiPayable): Payable {
  return { id: String(item.id), title: item.description, category: item.category, amount: centsToReais(item.amountCents), due: displayDate(item.dueDate), dueIso: item.dueDate, paid: item.status === 'paid' }
}
function mapReceivable(item: ApiReceivable): Receivable {
  return { id: String(item.id), title: item.description, counterparty: item.counterparty || 'Não informado', amount: centsToReais(item.amountCents), due: displayDate(item.dueDate), dueIso: item.dueDate, received: item.status === 'received', cancelled: item.status === 'cancelled', orderId: item.orderId, orderNumber: item.orderNumber }
}
const uiOrderStatus: Record<string, OrderStatus> = { received: 'Recebido', preparing: 'Em preparo', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado' }
const apiOrderStatus: Record<OrderStatus, string> = { Recebido: 'received', 'Em preparo': 'preparing', Pronto: 'ready', Entregue: 'delivered', Cancelado: 'cancelled' }
function mapOrder(item: ApiOrder): Order {
  return {
    id: String(item.id), number: Number(item.number), customer: item.customer || 'Balcão',
    items: item.items.map((line) => `${line.quantityMilli / 1000}x ${line.nameSnapshot}`).join(', '),
    total: centsToReais(item.totalCents), status: uiOrderStatus[item.status] || 'Recebido', paymentStatus: item.paymentStatus === 'paid' ? 'paid' : 'unpaid', paymentMethod: item.paymentMethod, created: displayTime(item.createdAt),
    businessDate: item.businessDate || item.sessionDate || item.orderDate || item.createdAt.slice(0, 10), sessionId: item.sessionId, stockReserved: Boolean(item.stockDeducted ?? item.stockReservedAt) && !item.stockReleasedAt,
    itemRecords: item.items.map((line) => ({ productId: String(line.productId), quantity: line.quantityMilli / 1000 })),
  }
}
const emptySummary = (): FinanceSummary => ({ month: localMonth(), incomeCents: 0, expenseCents: 0, cashResultCents: 0, pendingPayablesCents: 0, pendingReceivablesCents: 0 })
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.' }

function App() {
  const [user, setUser] = useState<{ role: AccessRole; displayName: string } | null>(() => {
    const requested = getRequestedDemoAccount();
    return requested ? { role: requested.role, displayName: requested.displayName } : null;
  })
  const [loginId, setLoginId] = useState(() => getRequestedDemoAccount()?.id ?? 'admin')
  const [password, setPassword] = useState(() => getRequestedDemoAccount()?.password ?? '')
  const [loginError, setLoginError] = useState('')
  const [view, setView] = useState<'finance' | 'orders'>('finance')
  const [financeTab, setFinanceTab] = useState<FinanceTab>('overview')
  const [notice, setNotice] = useState('')
  const [apiStatus, setApiStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [apiError, setApiError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(localMonth())
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary)
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [stockMovements, setStockMovements] = useState<ApiStockMovement[]>([])
  const [payables, setPayables] = useState<Payable[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersSession, setOrdersSession] = useState<OrderSession | null>(null)
  const [ordersSessions, setOrdersSessions] = useState<OrderSession[]>([])

  const toast = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  const loadData = useCallback(async (month: string) => {
    setApiStatus('loading')
    setApiError('')
    try {
      const [health, dashboard, productResponse, entryResponse, stockMovementResponse, payableResponse, receivableResponse, orderResponse, sessionResponse] = await Promise.all([
        apiRequest<{ ok: boolean; productionReady: boolean }>('/health'),
        apiRequest<{ summary: FinanceSummary }>(`/admin/dashboard?month=${encodeURIComponent(month)}`),
        apiRequest<{ products: ApiProduct[] }>('/admin/products'),
        apiRequest<{ entries: ApiEntry[] }>(`/admin/finance/entries?month=${encodeURIComponent(month)}`),
        apiRequest<{ movements: ApiStockMovement[] }>('/admin/stock-movements'),
        apiRequest<{ payables: ApiPayable[] }>('/admin/finance/payables'),
        apiRequest<{ receivables: ApiReceivable[] }>('/admin/finance/receivables'),
        apiRequest<{ orders: ApiOrder[] }>('/admin/orders'),
        apiRequest<ApiOrderSession>('/admin/orders/session'),
      ])
      if (!health.ok || health.productionReady) throw new Error('A API respondeu com um estado inesperado. Confira se a versão local do P16 está rodando.')
      setSummary(dashboard.summary)
      setProducts(productResponse.products.map(mapProduct))
      setMovements(entryResponse.entries.map(mapEntry))
      setStockMovements(stockMovementResponse.movements)
      setPayables(payableResponse.payables.map(mapPayable))
      setReceivables(receivableResponse.receivables.map(mapReceivable))
      setOrders(orderResponse.orders.map(mapOrder))
      setOrdersSession(sessionResponse.session)
      setOrdersSessions(sessionResponse.sessions || [])
      setApiStatus('connected')
    } catch (error) {
      setApiStatus('error')
      setApiError(`${errorText(error)} Mantenha a API local ativa com: node server/index.mjs`)
    }
  }, [])

  useEffect(() => {
    if (user) void loadData(selectedMonth)
  }, [user, selectedMonth, loadData])

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const account = DEMO_USERS[loginId.trim().toLowerCase()]
    if (!account || account.password !== password) {
      setLoginError('Usuário ou senha inválidos. Confira os dados de demonstração.')
      return
    }
    setUser({ role: account.role, displayName: account.displayName })
    setView('finance')
    setFinanceTab('overview')
    setLoginError('')
  }

  if (!user) {
    return <LoginScreen loginId={loginId} password={password} setLoginId={setLoginId} setPassword={setPassword} error={loginError} onSubmit={signIn} />
  }

  const financeOnly = user.role === 'finance'
  const refresh = () => loadData(selectedMonth)
  return (
    <div className="app-shell">
      <aside className={`sidebar ${financeOnly ? 'finance-only-sidebar' : ''}`}>
        <Brand onClick={() => { setView('finance'); setFinanceTab('overview') }} />
        <div className="sidebar-caption">MENU PRINCIPAL</div>
        <button className={`nav-item ${view === 'finance' ? 'active' : ''}`} onClick={() => { setView('finance'); setFinanceTab('overview') }}>
          <Wallet size={18} /><span>Financeiro</span><span className="nav-active-dot" />
        </button>
        {!financeOnly && <button className={`nav-item ${view === 'orders' ? 'active' : ''}`} onClick={() => setView('orders')}>
          <ClipboardList size={18} /><span>Pedidos</span>
        </button>}
        <div className="sidebar-bottom">
          <div className="local-state"><span className={`local-dot ${apiStatus === 'error' ? 'local-dot-error' : ''}`} /><span>{apiStatus === 'connected' ? 'API local conectada' : apiStatus === 'loading' ? 'Conectando à API local' : 'API local indisponível'}</span></div>
          <div className="user-chip">
            <div className="user-avatar">{user.displayName.charAt(0)}</div>
            <div className="user-meta"><strong>{user.displayName}</strong><span>{financeOnly ? 'Acesso financeiro de demonstração' : 'Acesso completo de demonstração'}</span></div>
            <button className="icon-button logout-button" aria-label="Sair" title="Sair" onClick={() => { setUser(null); setPassword('') }}><LogOut size={17} /><span className="logout-label">Sair</span></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Copão</span><span className="crumb-separator">/</span><strong>{view === 'finance' ? 'Financeiro' : 'Pedidos'}</strong></div>
          <div className="topbar-right"><span className="date-chip"><CalendarDays size={15} />{displayDate(businessTodayIso())}</span><button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><i /></button></div>
        </header>

        {apiError && <div className="api-error-banner" role="alert"><AlertTriangle size={18} /><div><strong>Não foi possível sincronizar com a API local.</strong><span>{apiError}</span></div><button className="outline-button" onClick={() => void refresh()}><RefreshCw size={15} /> Tentar novamente</button></div>}
        {apiStatus === 'loading' && <div className="api-loading-note">Sincronizando dados locais…</div>}
        {view === 'finance' ? <FinanceArea
          tab={financeTab} setTab={setFinanceTab} products={products} movements={movements} stockMovements={stockMovements} payables={payables} receivables={receivables}
          summary={summary} month={selectedMonth} onMonthChange={setSelectedMonth} onRefresh={refresh} toast={toast} apiReady={apiStatus === 'connected'} showOrderReports={!financeOnly}
        /> : <OrdersArea orders={orders} products={products} session={ordersSession} sessions={ordersSessions} onRefresh={refresh} toast={toast} apiReady={apiStatus === 'connected'} />}
        <footer className="app-footer"><span>ADEGA DO COPÃO</span><span>Desenvolvimento local · Dados persistidos no computador</span></footer>
      </main>
      {notice && <div className="toast"><CheckCircle2 size={18} />{notice}</div>}
    </div>
  )
}

function Brand({ onClick }: { onClick?: () => void }) {
  return <button className="brand" onClick={onClick} aria-label="Ir para o financeiro">
    <div className="brand-mark"><span>A</span><i /></div>
    <div className="brand-copy"><strong>ADEGA DO <b>COPÃO</b></strong><span>GESTÃO DO ESTABELECIMENTO</span></div>
  </button>
}

function LoginScreen(props: { loginId: string; password: string; setLoginId: (v: string) => void; setPassword: (v: string) => void; error: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  const { loginId, password, setLoginId, setPassword, error, onSubmit } = props
  return <div className="login-page">
    <div className="login-visual">
      <div className="login-visual-noise" />
      <div className="login-brand-lockup"><Brand /></div>
      <div className="visual-content"><div className="eyebrow"><span /> CONTROLE NA PALMA DA MÃO</div><h1>O seu negócio.<br /><em>Mais organizado.</em></h1><p>Gestão financeira e operacional em um só lugar, para você acompanhar o que acontece e decidir com mais segurança.</p><div className="visual-stats"><div><strong>01</strong><span>Financeiro organizado</span></div><i /><div><strong>02</strong><span>Operação simplificada</span></div></div></div>
      <div className="visual-bottom"><span>GESTÃO INTELIGENTE</span><span>DESDE 2026</span></div>
    </div>
    <div className="login-form-side">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="mobile-brand"><Brand /></div>
        <div className="login-heading"><span className="section-kicker">BEM-VINDO DE VOLTA</span><h2>Acesse o sistema</h2><p>Entre com seu usuário para continuar.</p></div>
        <label className="field-label" htmlFor="login-id">Usuário</label>
        <div className="input-wrap"><ShieldCheck size={18} /><input id="login-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Digite seu usuário" autoComplete="username" /></div>
        <label className="field-label" htmlFor="login-password">Senha</label>
        <div className="input-wrap"><span className="password-symbol">••</span><input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" autoComplete="current-password" /></div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button login-submit" type="submit">Entrar no sistema <ArrowUpRight size={18} /></button>
        <div className="demo-access">
          <div className="demo-title"><span>ACESSOS PARA DEMONSTRAÇÃO</span><span className="demo-line" /></div>
          <button type="button" className={`demo-account ${loginId === 'admin' ? 'selected' : ''}`} onClick={() => { setLoginId('admin'); setPassword('financeiro123') }}><span className="demo-account-icon"><Wallet size={17} /></span><span className="demo-account-text"><strong>Financeiro</strong><small>Visualiza somente o módulo financeiro</small></span><span className="demo-fill">Preencher</span></button>
          <button type="button" className={`demo-account ${loginId === 'admin02' ? 'selected' : ''}`} onClick={() => { setLoginId('admin02'); setPassword('painel123') }}><span className="demo-account-icon"><LayoutDashboard size={17} /></span><span className="demo-account-text"><strong>Gestão completa</strong><small>Financeiro e módulo de pedidos</small></span><span className="demo-fill">Preencher</span></button>
        </div>
        <p className="prototype-warning">Integração local em desenvolvimento: estes acessos ainda são demonstrativos. A API não tem autenticação real; não publique nem utilize dados reais.</p>
      </form>
    </div>
  </div>
}

function FinanceArea(props: {
  tab: FinanceTab; setTab: (v: FinanceTab) => void; products: Product[]; movements: Movement[]; stockMovements: ApiStockMovement[]; payables: Payable[]; receivables: Receivable[];
  summary: FinanceSummary; month: string; onMonthChange: (v: string) => void; onRefresh: () => Promise<void>; toast: (v: string) => void; apiReady: boolean; showOrderReports: boolean
}) {
  const { tab, setTab, products, movements, stockMovements, payables, receivables, summary, month, onMonthChange, onRefresh, toast, apiReady, showOrderReports } = props
  const income = centsToReais(summary.incomeCents)
  const expenses = centsToReais(summary.expenseCents)
  const result = centsToReais(summary.cashResultCents)
  const pending = centsToReais(summary.pendingPayablesCents)
  const openPayables = payables.filter((item) => !item.paid).slice().sort((a, b) => a.dueIso.localeCompare(b.dueIso))
  const openReceivables = receivables.filter((item) => !item.received && !item.cancelled).slice().sort((a, b) => a.dueIso.localeCompare(b.dueIso))
  // Pedidos continuam em "Valores a receber", mas não entram no alerta de vencimentos financeiros.
  const financeOpenReceivables = openReceivables.filter((item) => !item.orderId)
  const openPayablesTotal = openPayables.reduce((total, item) => total + item.amount, 0)
  const openReceivablesTotal = openReceivables.reduce((total, item) => total + item.amount, 0)
  const categorySummary = (direction: Direction) => {
    const amounts = new Map<string, number>()
    movements.filter((item) => item.direction === direction).forEach((item) => {
      const category = item.category.trim() || 'Geral'
      amounts.set(category, (amounts.get(category) ?? 0) + reaisToCents(item.amount))
    })
    const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0)
    return [...amounts.entries()]
      .map(([label, amountCents]) => ({ label, amount: amountCents / 100, percent: total ? (amountCents / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
  }
  const incomingCategories = categorySummary('income')
  const outgoingCategories = categorySummary('expense')
  const paymentMethods = (() => {
    const totals = new Map<string, { incomeCents: number; expenseCents: number; count: number }>()
    movements.forEach((item) => {
      const method = item.method.trim() || 'Não informado'
      const current = totals.get(method) ?? { incomeCents: 0, expenseCents: 0, count: 0 }
      if (item.direction === 'income') current.incomeCents += reaisToCents(item.amount)
      else current.expenseCents += reaisToCents(item.amount)
      current.count += 1
      totals.set(method, current)
    })
    return [...totals.entries()]
      .map(([method, values]) => ({ method, ...values }))
      .sort((a, b) => (b.incomeCents + b.expenseCents) - (a.incomeCents + a.expenseCents))
  })()
  const overduePayables = openPayables.filter((item) => dueState(item.dueIso).key === 'overdue')
  // O painel de vencimentos trata apenas contas financeiras manuais; contas de pedidos ficam na lista de recebíveis.
  const overdueReceivables = financeOpenReceivables.filter((item) => dueState(item.dueIso).key === 'overdue')
  const dueTodayCount = [...openPayables, ...financeOpenReceivables].filter((item) => dueState(item.dueIso).key === 'today').length
  const dueSoonCount = [...openPayables, ...financeOpenReceivables].filter((item) => dueState(item.dueIso).key === 'soon').length
  const [term, setTerm] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'all' | Direction>('all')
  const [movementForm, setMovementForm] = useState(false)
  const [productForm, setProductForm] = useState(false)
  const [payableForm, setPayableForm] = useState(false)
  const [receivableForm, setReceivableForm] = useState(false)
  const [stockProductId, setStockProductId] = useState<string | null>(null)
  const [stockMovementType, setStockMovementType] = useState<ManualStockMovementType>('purchase')
  const [stockMovementQuantity, setStockMovementQuantity] = useState('')
  const [stockMovementReason, setStockMovementReason] = useState('')
  const [productKind, setProductKind] = useState<ProductKind>('resale')
  const [showAllStockMovements, setShowAllStockMovements] = useState(false)
  const [stockHistoryTerm, setStockHistoryTerm] = useState('')
  const [stockHistoryFilter, setStockHistoryFilter] = useState<StockHistoryFilter>('all')
  const stockMovementFormRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    if (!stockProductId) return
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      stockMovementFormRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [stockProductId])

  const normalizedStockHistoryTerm = stockHistoryTerm.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const filteredStockMovements = stockMovements.filter((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)
    const productName = item.productName || product?.name || 'Produto fora do catálogo ativo'
    const searchableText = `${productName} ${item.reason}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    const matchesTerm = !normalizedStockHistoryTerm || searchableText.includes(normalizedStockHistoryTerm)
    const matchesFilter = stockHistoryFilter === 'all' || STOCK_MOVEMENT_GROUPS[stockHistoryFilter].includes(item.type)
    return matchesTerm && matchesFilter
  })

  const selectedStockProduct = products.find((product) => product.id === stockProductId) ?? null
  const stockMovementIsInbound = STOCK_INBOUND_TYPES.has(stockMovementType)
  const parsedStockMovementQuantity = stockMovementQuantity.trim() ? Number(stockMovementQuantity) : Number.NaN
  const stockMovementNeedsWholeQuantity = selectedStockProduct ? ['un', 'porcao'].includes(selectedStockProduct.unit) : false
  const stockMovementQuantityValid = Number.isFinite(parsedStockMovementQuantity) && parsedStockMovementQuantity >= (stockMovementNeedsWholeQuantity ? 1 : 0.001) && (!stockMovementNeedsWholeQuantity || Number.isInteger(parsedStockMovementQuantity))
  const stockMovementProjectedBalance = selectedStockProduct && stockMovementQuantityValid
    ? selectedStockProduct.stock + (stockMovementIsInbound ? parsedStockMovementQuantity : -parsedStockMovementQuantity)
    : null
  const stockMovementExceedsAvailable = stockMovementProjectedBalance !== null && stockMovementProjectedBalance < -0.000001
  const stockMovementGuidance = STOCK_MOVEMENT_GUIDANCE[stockMovementType]
  const stockQuantityText = (quantity: number) => quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  const openStockMovement = (productId: string) => {
    setStockProductId(productId)
    setStockMovementType('purchase')
    setStockMovementQuantity('')
    setStockMovementReason('')
  }
  const closeStockMovement = () => {
    setStockProductId(null)
    setStockMovementType('purchase')
    setStockMovementQuantity('')
    setStockMovementReason('')
  }

  const addMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const amount = Number(data.get('amount'))
    const title = String(data.get('title') || '').trim()
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!title || !Number.isFinite(amount) || amount <= 0) return
    try {
      await apiRequest('/admin/finance/entries', { method: 'POST', body: JSON.stringify({ description: title, category: String(data.get('category') || 'Geral'), direction: String(data.get('direction')) as Direction, amountCents: reaisToCents(amount), movementDate: String(data.get('date') || businessTodayIso()), paymentMethod: String(data.get('method') || 'Não informado') }) })
      setMovementForm(false); await onRefresh(); toast('Movimentação salva no armazenamento local.')
    } catch (error) { toast(errorText(error)) }
  }
  const addProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const kind = String(data.get('kind') || productKind) as ProductKind
    const cost = Number(data.get('cost'))
    const price = Number(data.get('price'))
    const stock = kind === 'prepared' ? 0 : Number(data.get('stock'))
    const minimum = kind === 'prepared' ? 0 : Number(data.get('minimum'))
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!name || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(minimum) || minimum < 0) return
    try {
      await apiRequest('/admin/products', { method: 'POST', body: JSON.stringify({ name, category: String(data.get('category') || 'Geral'), kind, unit: String(data.get('unit') || 'un'), costCents: reaisToCents(cost), priceCents: reaisToCents(price), stockQuantity: stock, stockMinimum: minimum }) })
      setProductForm(false); setProductKind('resale'); await onRefresh(); toast(kind === 'prepared' ? 'Preparado salvo sem estoque próprio.' : 'Produto para revenda salvo com histórico do estoque inicial.')
    } catch (error) { toast(errorText(error)) }
  }
  const addPayable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') || '').trim(); const amount = Number(data.get('amount'))
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!title || !Number.isFinite(amount) || amount <= 0) return
    try {
      await apiRequest('/admin/finance/payables', { method: 'POST', body: JSON.stringify({ description: title, category: String(data.get('category') || 'Geral'), amountCents: reaisToCents(amount), dueDate: String(data.get('due') || '') }) })
      setPayableForm(false); await onRefresh(); toast('Conta a pagar cadastrada.')
    } catch (error) { toast(errorText(error)) }
  }
  const addReceivable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') || '').trim(); const amount = Number(data.get('amount'))
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!title || !Number.isFinite(amount) || amount <= 0) return
    try {
      await apiRequest('/admin/finance/receivables', { method: 'POST', body: JSON.stringify({ description: title, counterparty: String(data.get('counterparty') || '').trim(), amountCents: reaisToCents(amount), dueDate: String(data.get('due') || '') }) })
      setReceivableForm(false); await onRefresh(); toast('Valor a receber cadastrado.')
    } catch (error) { toast(errorText(error)) }
  }
  const addStockMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!stockProductId || !selectedStockProduct) return
    const data = new FormData(event.currentTarget)
    const quantity = Number(data.get('quantity'))
    const reason = String(data.get('reason') || '').trim()
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!Number.isFinite(quantity) || quantity <= 0 || (stockMovementNeedsWholeQuantity && !Number.isInteger(quantity))) {
      return toast(stockMovementNeedsWholeQuantity ? 'Informe uma quantidade inteira para este produto.' : 'Informe uma quantidade válida.')
    }
    if (reason.length < 5) return toast('Descreva o motivo da movimentação com pelo menos 5 caracteres.')
    if (stockMovementExceedsAvailable) return toast('A saída é maior que o estoque disponível. Confira a quantidade antes de continuar.')
    try {
      await apiRequest('/admin/stock-movements', { method: 'POST', body: JSON.stringify({ productId: stockProductId, type: stockMovementType, quantity, reason, movementDate: String(data.get('date') || businessTodayIso()) }) })
      closeStockMovement(); await onRefresh(); toast('Movimentação de estoque registrada no histórico.')
    } catch (error) { toast(errorText(error)) }
  }
  const markPayablePaid = async (item: Payable) => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!window.confirm(`Confirmar pagamento de ${money(item.amount)} referente a “${item.title}”? Isso registrará uma saída no caixa.`)) return
    try {
      await apiRequest(`/admin/finance/payables/${encodeURIComponent(item.id)}/pay`, { method: 'POST', body: JSON.stringify({ paymentDate: businessTodayIso(), paymentMethod: 'Não informado' }) })
      await onRefresh(); toast('Pagamento registrado; a saída foi lançada no caixa uma única vez.')
    } catch (error) { toast(errorText(error)) }
  }
  const markReceivableReceived = async (item: Receivable) => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!window.confirm(`Confirmar recebimento de ${money(item.amount)} referente a “${item.title}”? Isso registrará uma entrada no caixa.`)) return
    try {
      await apiRequest(`/admin/finance/receivables/${encodeURIComponent(item.id)}/receive`, { method: 'POST', body: JSON.stringify({ receivedDate: businessTodayIso(), paymentMethod: 'Não informado' }) })
      await onRefresh(); toast('Recebimento registrado; a entrada foi lançada no caixa uma única vez.')
    } catch (error) { toast(errorText(error)) }
  }
  const removePayable = async (item: Payable) => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (item.paid) return toast('Contas pagas são preservadas no histórico financeiro.')
    if (!window.confirm(`Excluir a conta “${item.title}” de ${money(item.amount)}? Essa ação não registra pagamento nem altera o caixa.`)) return
    try {
      await apiRequest(`/admin/finance/payables/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      await onRefresh(); toast('Conta pendente excluída. Nenhuma movimentação de caixa foi criada.')
    } catch (error) { toast(errorText(error)) }
  }
  const removeReceivable = async (item: Receivable) => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (item.received) return toast('Valores já recebidos são preservados no histórico financeiro.')
    if (!window.confirm(`Excluir o valor a receber “${item.title}” de ${money(item.amount)}? Essa ação não altera o caixa.`)) return
    try {
      await apiRequest(`/admin/finance/receivables/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      await onRefresh(); toast('Valor a receber excluído. Nenhuma movimentação de caixa foi criada.')
    } catch (error) { toast(errorText(error)) }
  }
  const removeProduct = async (item: Product) => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!window.confirm(`Remover “${item.name}” do catálogo? Se houver histórico de estoque ou pedidos, o item será arquivado para preservar os registros.`)) return
    try {
      const result = await apiRequest<{ archived: boolean; deleted: boolean }>(`/admin/products/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      if (stockProductId === item.id) setStockProductId(null)
      await onRefresh()
      toast(result.archived ? 'Produto removido do catálogo. O histórico foi preservado.' : 'Produto excluído do catálogo.')
    } catch (error) { toast(errorText(error)) }
  }

  const headings: Record<FinanceTab, { title: string; description: string }> = {
    overview: { title: 'Resumo', description: 'Consulte rapidamente o caixa e acesse as tarefas mais usadas.' },
    financial: { title: 'Financeiro', description: 'Veja o caixa do período, contas pendentes e movimentações.' },
    transactions: { title: 'Movimentações', description: 'Consulte e registre entradas e saídas efetivas do caixa.' },
    payables: { title: 'Contas a pagar', description: 'Organize vencimentos e registre pagamentos.' },
    receivables: { title: 'Contas a receber', description: 'Acompanhe valores pendentes e registre recebimentos.' },
    inventory: { title: 'Produtos e estoque', description: 'Cadastre produtos e controle cada movimentação de estoque.' },
  }
  return <section className="page-content">
    <div className="page-heading-row"><div><div className="section-kicker">CONTROLE FINANCEIRO</div><h1>{headings[tab].title}</h1><p>{headings[tab].description}</p></div><label className="outline-button month-button month-picker-wrap"><CalendarDays size={16} /><span>{displayMonth(month)}</span><input className="month-picker-input" aria-label="Filtrar mês financeiro" type="month" value={month} onChange={(event) => { if (event.target.value) onMonthChange(event.target.value) }} /><ChevronDown size={15} /></label></div>
    <div className="finance-tabs" role="tablist" aria-label="Módulos financeiros">
      <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<LayoutDashboard size={16} />}>Resumo</TabButton>
      <TabButton active={tab === 'financial'} onClick={() => setTab('financial')} icon={<TrendingUp size={16} />}>Financeiro</TabButton>
      <TabButton active={tab === 'transactions'} onClick={() => setTab('transactions')} icon={<ArrowDownLeft size={16} />}>Movimentações</TabButton>
      <TabButton active={tab === 'payables'} onClick={() => setTab('payables')} icon={<CreditCard size={16} />}>Contas a pagar</TabButton>
      <TabButton active={tab === 'receivables'} onClick={() => setTab('receivables')} icon={<ArrowDownLeft size={16} />}>Contas a receber</TabButton>
      <TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')} icon={<Package size={16} />}>Produtos e estoque</TabButton>
    </div>

    {tab === 'overview' && <>
      <div className="metrics-grid summary-metrics-grid">
        <MetricCard title="Resultado do período" value={money(result)} detail="Entradas recebidas menos saídas pagas" icon={<TrendingUp size={18} />} tone="gold" prominent />
        <MetricCard title="Entradas recebidas" value={money(income)} detail={`${movements.filter((m) => m.direction === 'income').length} recebimentos no mês`} icon={<ArrowDownLeft size={18} />} tone="green" />
        <MetricCard title="Saídas pagas" value={money(expenses)} detail={`${movements.filter((m) => m.direction === 'expense').length} pagamentos no mês`} icon={<ArrowUpRight size={18} />} tone="red" />
      </div>
      <div className="overview-grid summary-overview-grid">
        <section className="panel transactions-panel">
          <div className="panel-heading"><div><h3>Últimas movimentações</h3><p>{displayMonth(month)}</p></div><button className="text-button" onClick={() => setTab('transactions')}>Ver todas <ArrowUpRight size={15} /></button></div>
          <MovementList movements={movements.slice(0, 5)} />
        </section>
        <section className="panel action-panel">
          <div className="panel-heading"><div><h3>Ações rápidas</h3></div></div>
          <button className="quick-action" onClick={() => { setTab('transactions'); setMovementForm(true) }}><span className="quick-icon income-bg"><Plus size={17} /></span><span><strong>Nova movimentação</strong><small>Registrar entrada ou saída</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-action" onClick={() => { setTab('payables'); setPayableForm(true) }}><span className="quick-icon payable-bg"><CalendarDays size={17} /></span><span><strong>Adicionar conta a pagar</strong><small>Registrar um vencimento</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-action" onClick={() => { setTab('receivables'); setReceivableForm(true) }}><span className="quick-icon income-bg"><ArrowDownLeft size={17} /></span><span><strong>Adicionar valor a receber</strong><small>Controlar um recebimento futuro</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-action" onClick={() => { setTab('inventory'); setProductForm(true) }}><span className="quick-icon stock-bg"><Package size={17} /></span><span><strong>Cadastrar produto</strong><small>Adicionar ao catálogo</small></span><ArrowUpRight size={16} /></button>
        </section>
      </div>
    </>}

    {tab === 'financial' && <>
      <section className="panel cash-equation-panel finance-period-panel" aria-label="Resultado financeiro no período">
        <div className="cash-equation-heading"><h3>Resultado de {displayMonth(month)}</h3><span>Valores efetivados</span></div>
        <div className="cash-equation">
          <div><span>Entradas recebidas</span><strong>{money(income)}</strong></div>
          <b aria-hidden="true">−</b>
          <div><span>Saídas pagas</span><strong>{money(expenses)}</strong></div>
          <b aria-hidden="true">=</b>
          <div className="cash-equation-result"><span>Resultado do período</span><strong className={result >= 0 ? 'positive' : 'negative'}>{money(result)}</strong></div>
        </div>
        <p className="cash-equation-note">Resultado = entradas recebidas menos saídas pagas no mês selecionado. Contas pendentes ficam separadas; este valor não representa o saldo total disponível nem o lucro líquido.</p>
      </section>

      {(overduePayables.length > 0 || overdueReceivables.length > 0 || dueTodayCount > 0 || dueSoonCount > 0) && <section className="panel finance-attention-panel">
        <div className="panel-heading"><div><h3><AlertTriangle size={16} /> Atenção aos vencimentos</h3><p>Contas que podem exigir uma ação</p></div></div>
        <div className="due-attention-grid">
          <div className={overduePayables.length + overdueReceivables.length ? 'attention-item overdue' : 'attention-item'}><strong>{overduePayables.length + overdueReceivables.length}</strong><span>Vencidas</span><small>{money(overduePayables.reduce((sum, item) => sum + item.amount, 0))} a pagar · {money(overdueReceivables.reduce((sum, item) => sum + item.amount, 0))} a receber</small></div>
          <div className={dueTodayCount ? 'attention-item today' : 'attention-item'}><strong>{dueTodayCount}</strong><span>Vencem hoje</span><small>Contas a pagar e valores a receber</small></div>
          <div className={dueSoonCount ? 'attention-item soon' : 'attention-item'}><strong>{dueSoonCount}</strong><span>Próximos 7 dias</span><small>Vencimentos futuros próximos</small></div>
        </div>
      </section>}

      <div className="financial-obligations-grid">
        <section className="panel">
          <div className="panel-heading"><div><h3>Contas a pagar</h3><p>{openPayables.length} pendentes</p></div><strong className="obligation-total expense-text">{money(openPayablesTotal)}</strong></div>
          {openPayables.length ? <div className="financial-obligation-list">{openPayables.slice(0, 4).map((item) => { const status = dueState(item.dueIso); return <div className="financial-obligation-row" key={item.id}><span><strong>{item.title}</strong><small>{item.category} · Vence em {item.due}</small><em className={`due-chip ${status.key}`}>{status.label}</em></span><b className="expense-text">{money(item.amount)}</b></div> })}</div> : <div className="empty-state financial-obligation-empty">Nenhuma conta pendente.</div>}
          <button className="secondary-full-button" onClick={() => setTab('payables')}>Ver contas a pagar <ArrowUpRight size={15} /></button>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h3>Valores a receber</h3><p>{openReceivables.length} pendentes</p></div><strong className="obligation-total income-text">{money(openReceivablesTotal)}</strong></div>
          {openReceivables.length ? <div className="financial-obligation-list">{openReceivables.slice(0, 4).map((item) => { const status = dueState(item.dueIso); return <div className="financial-obligation-row" key={item.id}><span><strong>{item.title}</strong><small>{item.counterparty ? `${item.counterparty} · ` : ''}Previsto para ${item.due}</small><em className={`due-chip ${status.key}`}>{status.label}</em></span><b className="income-text">{money(item.amount)}</b></div> })}</div> : <div className="empty-state financial-obligation-empty">Nenhum valor pendente de recebimento.</div>}
          <button className="secondary-full-button" onClick={() => setTab('receivables')}>Ver valores a receber <ArrowUpRight size={15} /></button>
        </section>
      </div>

      <div className="finance-analysis-grid">
        <CategoryBreakdown title="Entradas por categoria" description="Categorias que mais contribuíram com os recebimentos deste mês." items={incomingCategories} tone="income" emptyText="Nenhuma entrada registrada neste mês." />
        <CategoryBreakdown title="Saídas por categoria" description="Veja em que tipos de despesa o dinheiro foi usado." items={outgoingCategories} tone="expense" emptyText="Nenhuma saída registrada neste mês." />
      </div>

      <section className="panel payment-method-panel">
        <div className="panel-heading"><div><h3>Movimentações por forma de pagamento</h3><p>Valores efetivamente recebidos e pagos no período selecionado.</p></div></div>
        {paymentMethods.length ? <div className="payment-method-list">{paymentMethods.map((item) => <article className="payment-method-row" key={item.method}><div className="payment-method-name"><strong>{item.method}</strong><span>{item.count} {item.count === 1 ? 'movimentação' : 'movimentações'}</span></div><div className="payment-method-value income-text"><span>Entradas</span><strong>{money(item.incomeCents / 100)}</strong></div><div className="payment-method-value expense-text"><span>Saídas</span><strong>{money(item.expenseCents / 100)}</strong></div></article>)}</div> : <div className="empty-state">Ainda não há movimentações para comparar por forma de pagamento.</div>}
      </section>

      <section className="panel financial-recent-panel">
        <div className="panel-heading"><div><h3>Movimentações do período</h3><p>Recebimentos e pagamentos já registrados no caixa</p></div><button className="text-button" onClick={() => setTab('transactions')}>Abrir todas <ArrowUpRight size={15} /></button></div>
        <MovementList movements={movements.slice(0, 8)} />
      </section>

      {showOrderReports && <OrderReports apiReady={apiReady} />}
    </>}
    {tab === 'transactions' && <section className="panel table-panel"><div className="table-toolbar"><div className="filter-control"><Search size={17} /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar movimentação..." /></div><select aria-label="Filtrar movimentações" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as typeof directionFilter)}><option value="all">Todas as movimentações</option><option value="income">Somente entradas</option><option value="expense">Somente saídas</option></select><button className="primary-button" disabled={!apiReady} onClick={() => setMovementForm(!movementForm)}><Plus size={17} /> Nova movimentação</button></div>
      {movementForm && <form className="inline-form four-fields" onSubmit={addMovement}><label>Descrição<input name="title" required minLength={2} placeholder="Ex.: venda no balcão" /></label><label>Tipo<select name="direction"><option value="income">Entrada</option><option value="expense">Saída</option></select></label><label>Categoria<input name="category" required defaultValue="Geral" placeholder="Ex.: Vendas" /></label><label>Valor (R$)<input name="amount" required type="number" min="0.01" step="0.01" placeholder="0,00" /></label><label>Data da movimentação<input name="date" type="date" defaultValue={businessTodayIso()} required /></label><label>Forma de pagamento<select name="method"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option></select></label><div className="form-actions"><button className="outline-button" type="button" onClick={() => setMovementForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar lançamento</button></div></form>}
      <MovementList movements={movements.filter((m) => (directionFilter === 'all' || m.direction === directionFilter) && `${m.title} ${m.category} ${m.method}`.toLowerCase().includes(term.toLowerCase()))} expanded /></section>}

    {tab === 'payables' && <section className="panel table-panel"><div className="table-toolbar"><div><h3>Contas cadastradas</h3><p>{payables.filter((p) => !p.paid).length} pendentes · {money(pending)} em aberto</p></div><button className="primary-button" disabled={!apiReady} onClick={() => setPayableForm(!payableForm)}><Plus size={17} /> Nova conta</button></div>
      {payableForm && <form className="inline-form four-fields" onSubmit={addPayable}><label>Descrição<input name="title" minLength={2} required placeholder="Ex.: fornecedor de bebidas" /></label><label>Categoria<input name="category" required defaultValue="Geral" placeholder="Ex.: Estoque" /></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" /></label><label>Vencimento<input name="due" type="date" required defaultValue={businessTodayIso()} /></label><div className="form-actions"><button className="outline-button" type="button" onClick={() => setPayableForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar conta</button></div></form>}
      <div className="data-table-wrap desktop-record-table"><table className="data-table"><thead><tr><th>Conta</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{payables.map((p) => <tr key={p.id}><td><strong>{p.title}</strong></td><td>{p.category}</td><td>{p.due}</td><td className="amount-cell">{money(p.amount)}</td><td><span className={`status-pill ${p.paid ? 'done' : dueState(p.dueIso).key === 'overdue' ? 'due-overdue' : dueState(p.dueIso).key === 'today' ? 'due-today' : 'pending'}`}>{p.paid ? 'Paga' : dueState(p.dueIso).label}</span></td><td><div className="record-actions">{!p.paid ? <button className="small-action" disabled={!apiReady} onClick={() => void markPayablePaid(p)}><Check size={14} /> Marcar paga</button> : <span className="muted-cell">Histórico preservado</span>}{!p.paid && <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removePayable(p)}><Trash2 size={14} /> Excluir</button>}</div></td></tr>)}</tbody></table></div>
      <div className="record-cards-mobile">{payables.map((p) => <article className="record-card" key={p.id}><div className="record-card-heading"><div><strong>{p.title}</strong><span>{p.category} · Vencimento {p.due}</span></div><span className={`status-pill ${p.paid ? 'done' : dueState(p.dueIso).key === 'overdue' ? 'due-overdue' : dueState(p.dueIso).key === 'today' ? 'due-today' : 'pending'}`}>{p.paid ? 'Paga' : dueState(p.dueIso).label}</span></div><strong className="record-card-amount">{money(p.amount)}</strong><div className="record-actions">{!p.paid && <button className="small-action" disabled={!apiReady} onClick={() => void markPayablePaid(p)}><Check size={14} /> Marcar paga</button>}{!p.paid ? <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removePayable(p)}><Trash2 size={14} /> Excluir conta</button> : <span className="muted-cell">Histórico preservado</span>}</div></article>)}</div>
      {!payables.length && <div className="empty-state">Nenhuma conta cadastrada para exibir.</div>}
    </section>}

    {tab === 'receivables' && <section className="panel table-panel"><div className="table-toolbar"><div><h3>Valores cadastrados</h3><p>{receivables.filter((r) => !r.received && !r.cancelled).length} pendentes · {money(centsToReais(summary.pendingReceivablesCents))} em aberto</p></div><button className="primary-button" disabled={!apiReady} onClick={() => setReceivableForm(!receivableForm)}><Plus size={17} /> Novo valor a receber</button></div>
      {receivableForm && <form className="inline-form four-fields" onSubmit={addReceivable}><label>Descrição<input name="title" minLength={2} required placeholder="Ex.: venda a prazo" /></label><label>Cliente / origem<input name="counterparty" placeholder="Ex.: balcão" /></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" /></label><label>Vencimento previsto<input name="due" type="date" required defaultValue={businessTodayIso()} /></label><div className="form-actions"><button className="outline-button" type="button" onClick={() => setReceivableForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar valor</button></div></form>}
      <div className="data-table-wrap desktop-record-table"><table className="data-table"><thead><tr><th>Descrição</th><th>Origem</th><th>Data prevista</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{receivables.map((r) => <tr key={r.id}><td><strong>{r.title}</strong></td><td>{r.counterparty}</td><td>{r.due}</td><td className="amount-cell">{money(r.amount)}</td><td><span className={`status-pill ${r.cancelled ? 'cancelled' : r.received ? 'done' : dueState(r.dueIso).key === 'overdue' ? 'due-overdue' : dueState(r.dueIso).key === 'today' ? 'due-today' : 'pending'}`}>{r.cancelled ? 'Cancelado' : r.received ? 'Recebido' : dueState(r.dueIso).label}</span></td><td><div className="record-actions">{r.orderId ? <span className="muted-cell">Pagamento gerenciado em Pedidos</span> : !r.received && !r.cancelled ? <button className="small-action" disabled={!apiReady} onClick={() => void markReceivableReceived(r)}><Check size={14} /> Confirmar</button> : <span className="muted-cell">Histórico preservado</span>}{!r.orderId && !r.received && !r.cancelled && <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removeReceivable(r)}><Trash2 size={14} /> Excluir</button>}</div></td></tr>)}</tbody></table></div>
      <div className="record-cards-mobile">{receivables.map((r) => <article className="record-card" key={r.id}><div className="record-card-heading"><div><strong>{r.title}</strong><span>{r.counterparty} · Previsto para {r.due}</span></div><span className={`status-pill ${r.cancelled ? 'cancelled' : r.received ? 'done' : dueState(r.dueIso).key === 'overdue' ? 'due-overdue' : dueState(r.dueIso).key === 'today' ? 'due-today' : 'pending'}`}>{r.cancelled ? 'Cancelado' : r.received ? 'Recebido' : dueState(r.dueIso).label}</span></div><strong className="record-card-amount">{money(r.amount)}</strong><div className="record-actions">{r.orderId ? <span className="muted-cell">Pagamento gerenciado em Pedidos</span> : !r.received && !r.cancelled ? <button className="small-action" disabled={!apiReady} onClick={() => void markReceivableReceived(r)}><Check size={14} /> Confirmar</button> : <span className="muted-cell">Histórico preservado</span>}{!r.orderId && !r.received && !r.cancelled && <button className="small-action danger-action" disabled={!apiReady} onClick={() => void removeReceivable(r)}><Trash2 size={14} /> Excluir valor</button>}</div></article>)}</div>
      {!receivables.length && <div className="empty-state">Nenhum valor a receber cadastrado.</div>}
    </section>}

    {tab === 'inventory' && <section className="panel table-panel"><div className="table-toolbar"><div><h3>Catálogo de produtos</h3><p>{products.length} itens cadastrados · {products.filter((p) => p.stockTracked && p.stock <= p.minimum).length} precisam de reposição</p></div><button className="primary-button" disabled={!apiReady} onClick={() => setProductForm(!productForm)}><Plus size={17} /> Novo produto</button></div>
      {productForm && <form className="inline-form four-fields" onSubmit={addProduct}><label>Nome do item<input name="name" required minLength={2} placeholder={productKind === 'prepared' ? 'Ex.: Copão tradicional' : 'Ex.: Refrigerante lata 350 ml'} /></label><label>Categoria<input name="category" required defaultValue="Geral" placeholder="Ex.: Bebidas, Lanches, Drinks" /></label><label>Tipo de item<select name="kind" value={productKind} onChange={(event) => setProductKind(event.target.value as ProductKind)}><option value="resale">Revenda — produto comprado pronto</option><option value="prepared">Preparado na hora</option></select></label><label>{productKind === 'prepared' ? 'Custo estimado por unidade (R$)' : 'Custo de compra por unidade (R$)'}<input name="cost" type="number" min="0" step="0.01" required placeholder="0,00" /></label><label>Preço de venda (R$)<input key={productKind} name="price" type="number" min="0.01" step="0.01" required placeholder="0,00" /></label>{productKind !== 'prepared' && <><label>Quantidade inicial<input name="stock" type="number" min="0" step="0.001" required placeholder="0" /></label><label>Estoque mínimo<input name="minimum" type="number" min="0" step="0.001" required placeholder="0" /></label></>}<label>Unidade<select key={productKind} name="unit" defaultValue={productKind === 'prepared' ? 'porcao' : 'un'}><option value="un">Unidade</option><option value="kg">Quilograma (kg)</option><option value="g">Grama (g)</option><option value="l">Litro (L)</option><option value="ml">Mililitro (ml)</option><option value="porcao">Porção</option></select></label><div className="product-kind-note form-wide-label">{productKind === 'resale' ? 'Produto comprado pronto e vendido como está (ex.: refrigerante, água ou cerveja). A quantidade e o estoque mínimo serão controlados.' : 'Preparado na hora (ex.: hambúrguer ou Copão). Não exige quantidade fixa de estoque. Informe um custo por unidade apenas como estimativa para comparar com o preço de venda.'}</div><div className="form-actions"><button className="outline-button" type="button" onClick={() => { setProductForm(false); setProductKind('resale') }}>Cancelar</button><button className="primary-button" type="submit">Salvar item</button></div></form>}
      {stockProductId && selectedStockProduct && <form ref={stockMovementFormRef} className="inline-form four-fields stock-movement-form" onSubmit={addStockMovement}>
        <div className="form-wide-label stock-movement-form-heading"><div><strong>Movimentar estoque: {selectedStockProduct.name}</strong><span>Saldo atual: {stockQuantityText(selectedStockProduct.stock)} {selectedStockProduct.unit}</span></div><button type="button" className="icon-button" aria-label="Fechar movimentação" onClick={closeStockMovement}><X size={16} /></button></div>
        <div className="form-wide-label stock-movement-guidance"><strong>{stockMovementGuidance.title}</strong><p>{stockMovementGuidance.description}</p></div>
        <label>Tipo de movimento<select name="type" value={stockMovementType} onChange={(event) => setStockMovementType(event.target.value as ManualStockMovementType)}><option value="purchase">Entrada por compra</option><option value="return">Devolução / retorno ao estoque</option><option value="adjustment_in">Ajuste positivo de inventário</option><option value="sale">Venda avulsa (fora de Pedidos)</option><option value="adjustment_out">Ajuste negativo de inventário</option><option value="waste">Perda / descarte</option></select></label>
        <label>Quantidade ({selectedStockProduct.unit})<input name="quantity" type="number" min={stockMovementNeedsWholeQuantity ? 1 : 0.001} step={stockMovementNeedsWholeQuantity ? 1 : 0.001} value={stockMovementQuantity} onChange={(event) => setStockMovementQuantity(event.target.value)} required placeholder={stockMovementNeedsWholeQuantity ? 'Ex.: 3' : 'Ex.: 1,5'} /></label>
        <label>Data da movimentação<input name="date" type="date" defaultValue={businessTodayIso()} required /></label>
        <label>Motivo / referência<input name="reason" value={stockMovementReason} onChange={(event) => setStockMovementReason(event.target.value)} minLength={5} maxLength={160} required placeholder={stockMovementGuidance.placeholder} /></label>
        <div className={`stock-movement-preview form-wide-label${stockMovementExceedsAvailable ? ' is-warning' : ''}`} aria-live="polite">
          <div><span>Estoque atual</span><strong>{stockQuantityText(selectedStockProduct.stock)} {selectedStockProduct.unit}</strong></div>
          <span className="stock-movement-preview-arrow">→</span>
          <div><span>Após movimentação</span><strong>{stockMovementExceedsAvailable ? 'Saldo insuficiente' : stockMovementProjectedBalance !== null ? `${stockQuantityText(stockMovementProjectedBalance)} ${selectedStockProduct.unit}` : 'Informe a quantidade'}</strong></div>
          {stockMovementExceedsAvailable ? <p role="alert">Quantidade maior que o estoque disponível. Reduza a saída para continuar.</p> : stockMovementProjectedBalance !== null ? <p>{stockMovementIsInbound ? 'Esta movimentação aumentará o estoque.' : 'Esta movimentação reduzirá o estoque.'}</p> : <p>Confira o saldo previsto antes de registrar.</p>}
        </div>
        <div className="form-actions"><button className="outline-button" type="button" onClick={closeStockMovement}>Cancelar</button><button className="primary-button" type="submit" disabled={!apiReady || stockMovementExceedsAvailable}>Registrar movimento</button></div>
      </form>}
      <div className="product-groups">
        <ProductGroup title="Produtos de revenda" description="Comprados prontos; têm quantidade em estoque." products={products.filter((p) => p.kind === 'resale')} apiReady={apiReady} onMoveStock={openStockMovement} onRemove={removeProduct} />
        <ProductGroup title="Preparados na hora" description="Lanches e drinks; o custo é estimado e não há estoque do produto final." products={products.filter((p) => p.kind === 'prepared')} apiReady={apiReady} onMoveStock={openStockMovement} onRemove={removeProduct} />
      </div>
      {!products.length && <div className="empty-state">Nenhum item cadastrado. Cadastre bebidas/produtos de revenda ou lanches/drinks preparados para testar.</div>}
      <section className="panel stock-history-panel">
        <div className="panel-heading stock-history-heading">
          <div><h3>Histórico de estoque</h3><p>Entradas, saídas, perdas e baixas automáticas dos pedidos.</p></div>
          <span className="stock-history-count">{filteredStockMovements.length === stockMovements.length ? `${stockMovements.length} ${stockMovements.length === 1 ? 'movimento' : 'movimentos'}` : `${filteredStockMovements.length} de ${stockMovements.length} movimentos`}</span>
        </div>
        {stockMovements.length === 0 ? <div className="empty-state stock-history-empty">Ainda não há movimentações de estoque registradas.</div> : <>
          <div className="stock-history-controls">
            <label className="stock-history-search"><Search size={16} aria-hidden="true" /><input type="search" value={stockHistoryTerm} onChange={(event) => { setStockHistoryTerm(event.target.value); setShowAllStockMovements(false) }} placeholder="Buscar produto ou motivo..." aria-label="Buscar produto ou motivo no histórico de estoque" /></label>
            <label className="stock-history-filter"><span>Tipo</span><select value={stockHistoryFilter} onChange={(event) => { setStockHistoryFilter(event.target.value as StockHistoryFilter); setShowAllStockMovements(false) }} aria-label="Filtrar tipo de movimentação de estoque"><option value="all">Todas</option><option value="inbound">Entradas</option><option value="outbound">Saídas</option><option value="waste">Perdas</option></select></label>
          </div>
          {filteredStockMovements.length === 0 ? <div className="empty-state stock-history-empty">Nenhuma movimentação encontrada. Tente outro nome ou tipo.<button type="button" className="text-button" onClick={() => { setStockHistoryTerm(''); setStockHistoryFilter('all'); setShowAllStockMovements(false) }}>Limpar filtros</button></div> : <>
            <div className="stock-history-list">
              {(showAllStockMovements ? filteredStockMovements : filteredStockMovements.slice(0, 8)).map((item) => {
                const delta = item.afterMilli - item.beforeMilli
                const product = products.find((candidate) => candidate.id === item.productId)
                const unit = item.productUnit || product?.unit || 'un'
                const productName = item.productName || product?.name || 'Produto fora do catálogo ativo'
                const quantityText = (value: number) => (Math.abs(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
                return <article className="stock-history-entry" key={item.id}>
                  <span className={`stock-history-icon ${delta >= 0 ? 'is-increase' : 'is-decrease'}`}><Package size={17} /></span>
                  <div className="stock-history-main">
                    <div className="stock-history-title"><strong>{productName}</strong><span className={`stock-history-kind ${delta >= 0 ? 'is-increase' : 'is-decrease'}`}>{STOCK_MOVEMENT_LABELS[item.type] || 'Movimentação de estoque'}</span></div>
                    <p>{item.reason}</p>
                    <div className="stock-history-meta"><span>{displayDate(item.movementDate)}</span><span>Saldo: {quantityText(item.beforeMilli)} → {quantityText(item.afterMilli)} {unit}</span></div>
                  </div>
                  <strong className={`stock-history-delta ${delta >= 0 ? 'positive' : 'negative'}`}>{delta > 0 ? '+' : delta < 0 ? '−' : ''}{quantityText(delta)} {unit}</strong>
                </article>
              })}
            </div>
            {filteredStockMovements.length > 8 && <button type="button" className="text-button stock-history-toggle" onClick={() => setShowAllStockMovements((value) => !value)}>{showAllStockMovements ? 'Mostrar menos' : `Ver todos os resultados (${filteredStockMovements.length})`} <ChevronDown size={15} className={showAllStockMovements ? 'is-rotated' : ''} /></button>}
          </>}
        </>}
      </section>
      <p className="table-footnote">* Para lanches e drinks preparados, a margem usa um custo estimado informado manualmente. Não existe estoque por unidade desses preparados nem controle automático dos ingredientes. Esse controle pode ser avaliado futuramente se o estabelecimento demonstrar interesse.</p>
    </section>}
  </section>
}

function ProductGroup({ title, description, products, apiReady, onMoveStock, onRemove }: {
  title: string; description: string; products: Product[]; apiReady: boolean;
  onMoveStock: (id: string) => void; onRemove: (product: Product) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return <section className={`product-group ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
    <div className="product-group-heading"><div><h4>{title}</h4><p>{description}</p></div><button type="button" className="product-group-toggle" aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${title.toLowerCase()}`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><span>{products.length} {products.length === 1 ? 'item' : 'itens'}</span><ChevronDown size={17} /></button></div>
    {expanded && (products.length === 0 ? <div className="product-group-empty">Nenhum produto nesta categoria.</div> : <>
      <div className="data-table-wrap desktop-record-table"><table className="data-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Margem estimada</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}>
        <td><div className="table-product"><span className="product-avatar"><Package size={16} /></span><strong>{p.name}</strong></div></td><td>{p.category}</td><td>{money(p.cost)}</td><td className="amount-cell">{money(p.price)}</td><td className={p.price >= p.cost ? 'positive' : 'negative'}>{money(p.price - p.cost)}</td><td>{p.stockTracked ? `${p.stock} ${p.unit}` : 'Sem estoque próprio'}</td><td><span className={`status-pill ${p.kind === 'prepared' ? 'done' : p.stock <= p.minimum ? 'pending' : 'done'}`}>{p.kind === 'prepared' ? 'Feito na hora' : p.stock <= p.minimum ? 'Repor estoque' : 'Disponível'}</span></td>
        <td><div className="record-actions">{p.stockTracked && <button className="small-action" disabled={!apiReady} onClick={() => onMoveStock(p.id)}><Package size={14} /> Movimentar</button>}<button className="small-action danger-action" disabled={!apiReady} onClick={() => onRemove(p)}><Trash2 size={14} /> Remover</button></div></td>
      </tr>)}</tbody></table></div>
      <div className="product-cards-mobile">{products.map((p) => <article className="product-card-mobile" key={p.id}>
        <div className="product-card-top"><span className="product-avatar"><Package size={17} /></span><div><strong>{p.name}</strong><span>{p.category}</span></div><span className={`status-pill ${p.kind === 'prepared' ? 'done' : p.stock <= p.minimum ? 'pending' : 'done'}`}>{p.kind === 'prepared' ? 'Preparado' : p.stock <= p.minimum ? 'Repor' : 'Disponível'}</span></div>
        <div className="product-card-values"><div><span>{p.kind === 'prepared' ? 'Custo estimado' : 'Custo unitário'}</span><strong>{money(p.cost)}</strong></div><div><span>Preço de venda</span><strong>{money(p.price)}</strong></div><div><span>Margem estimada</span><strong className={p.price >= p.cost ? 'positive' : 'negative'}>{money(p.price - p.cost)}</strong></div></div>
        <div className="product-card-stock"><span>{p.stockTracked ? 'Estoque atual' : 'Controle de estoque'}</span><strong>{p.stockTracked ? `${p.stock} ${p.unit} · mínimo ${p.minimum}` : 'Não se aplica — feito na hora'}</strong></div>
        <div className="record-actions">{p.stockTracked && <button className="small-action" disabled={!apiReady} onClick={() => onMoveStock(p.id)}><Package size={14} /> Movimentar estoque</button>}<button className="small-action danger-action" disabled={!apiReady} onClick={() => onRemove(p)}><Trash2 size={14} /> Remover produto</button></div>
      </article>)}</div>
    </>)}
  </section>
}

function CategoryBreakdown({ title, description, items, tone, emptyText }: {
  title: string; description: string; items: { label: string; amount: number; percent: number }[]; tone: 'income' | 'expense'; emptyText: string
}) {
  return <section className="panel category-breakdown-panel">
    <div className="panel-heading"><div><h3>{title}</h3><p>{description}</p></div></div>
    {items.length ? <div className="category-breakdown-list">{items.map((item) => <div className="category-breakdown-row" key={item.label}>
      <div className="category-breakdown-heading"><strong>{item.label}</strong><span>{Math.round(item.percent)}% · {money(item.amount)}</span></div>
      <div className="category-breakdown-track"><span className={tone} style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }} /></div>
    </div>)}</div> : <div className="empty-state category-breakdown-empty">{emptyText}</div>}
  </section>
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button className={`finance-tab ${active ? 'active' : ''}`} onClick={onClick} role="tab" aria-selected={active}>{icon}<span>{children}</span></button>
}
function MetricCard({ title, value, detail, icon, tone, prominent }: { title: string; value: string; detail: string; icon: ReactNode; tone: string; prominent?: boolean }) {
  return <article className={`metric-card ${prominent ? 'prominent' : ''}`}><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong className="metric-value">{value}</strong><div className="metric-detail">{detail}</div></article>
}
function MovementList({ movements, expanded = false }: { movements: Movement[]; expanded?: boolean }) {
  if (!movements.length) return <div className="empty-state">Nenhuma movimentação encontrada para este período.</div>
  return <div className={`movement-list ${expanded ? 'expanded' : ''}`}>{movements.map((m) => <div className="movement-row" key={m.id}><span className={`movement-icon ${m.direction}`} >{m.direction === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div className="movement-info"><strong>{m.title}</strong><span>{m.category} · {m.date} · {m.method}</span></div><strong className={`movement-amount ${m.direction}`}>{m.direction === 'income' ? '+' : '−'} {money(m.amount)}</strong></div>)}</div>
}
function OrderReports({ apiReady }: { apiReady: boolean }) {
  const [period, setPeriod] = useState<'day' | 'month'>('day')
  const [selectedDate, setSelectedDate] = useState(businessTodayIso())
  const [report, setReport] = useState<OrderReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiReady) { setReport(null); return }
    let active = true
    setLoading(true)
    setError('')
    const query = period === 'day'
      ? `period=day&date=${encodeURIComponent(selectedDate)}`
      : `period=month&month=${encodeURIComponent(selectedDate.slice(0, 7))}`
    apiRequest<OrderReport>(`/admin/orders/reports?${query}`)
      .then((value) => { if (active) setReport(value) })
      .catch((reason) => { if (active) { setReport(null); setError(errorText(reason)) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiReady, period, selectedDate])

  const totals = report?.totals
  const formattedPeriod = period === 'day' ? displayDate(selectedDate) : displayMonth(selectedDate.slice(0, 7))
  const createdByDay = report?.daily.filter((line) => line.ordersCount > 0) ?? []

  return <section className="panel orders-report-panel orders-report-panel-order-only">
    <div className="panel-heading orders-report-heading">
      <div>
        <div className="section-kicker">ACOMPANHAMENTO OPERACIONAL</div>
        <h3><BarChart3 size={18} /> Relatório de pedidos</h3>
        <p>Pedidos agrupados pela data em que foram criados. Os valores de pagamento são vinculados a esses pedidos.</p>
      </div>
      <div className="orders-report-period"><button type="button" className={period === 'day' ? 'active' : ''} onClick={() => setPeriod('day')}>Diário</button><button type="button" className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Mensal</button></div>
    </div>

    <div className="orders-report-controls">
      <label>{period === 'day' ? 'Dia dos pedidos' : 'Mês dos pedidos'}<input aria-label={period === 'day' ? 'Dia dos pedidos' : 'Mês dos pedidos'} type={period === 'day' ? 'date' : 'month'} value={period === 'day' ? selectedDate : selectedDate.slice(0, 7)} onChange={(event) => setSelectedDate(period === 'day' ? event.target.value : `${event.target.value}-15`)} /></label>
      <span>{formattedPeriod}</span>
    </div>

    {loading ? <div className="empty-state">Carregando relatório…</div> : error ? <div className="empty-state" role="alert">{error}</div> : totals ? <>
      <div className="order-report-summary">
        <div className="order-report-summary-heading">
          <span className="order-report-eyebrow">{period === 'day' ? 'RESUMO DO DIA' : 'RESUMO DO MÊS'}</span>
          <p>{period === 'day' ? `Pedidos criados em ${formattedPeriod}.` : `Pedidos criados em ${formattedPeriod}.`}</p>
        </div>
        <div className="order-report-key-values order-report-key-values-simple">
          <div className="order-report-summary-count"><span>Pedidos registrados</span><strong>{totals.ordersCount}</strong><small>{totals.completedCount} entregues · {totals.cancelledCount} cancelados</small></div>
          <div><span>Total vendido</span><strong>{money(centsToReais(totals.activeValueCents))}</strong><small>Pedidos não cancelados</small></div>
          <div className="order-report-value-pending"><span>Falta receber</span><strong>{money(centsToReais(totals.pendingValueCents))}</strong><small>Valor dos pedidos ainda não pagos</small></div>
        </div>
      </div>

      {period === 'month' && <section className="order-report-breakdown order-report-breakdown-month">
        <div className="order-report-breakdown-heading"><h4>Pedidos por dia</h4></div>
        <div className="orders-report-table-wrap"><table className="orders-report-table"><thead><tr><th>Dia</th><th>Pedidos</th><th>Cancelados</th><th>Total vendido</th><th>Falta receber</th></tr></thead><tbody>{createdByDay.length ? createdByDay.map((line) => <tr key={line.date}><td>{displayDate(line.date)}</td><td>{line.ordersCount}</td><td>{line.cancelledCount}</td><td>{money(centsToReais(line.activeValueCents))}</td><td>{money(centsToReais(line.pendingValueCents))}</td></tr>) : <tr><td colSpan={5}>Nenhum pedido criado neste mês.</td></tr>}</tbody></table></div>
        <div className="order-report-days-mobile" aria-label="Pedidos por dia">
          {createdByDay.length ? createdByDay.map((line) => <article className="order-report-day-card" key={`mobile-${line.date}`}>
            <div className="order-report-day-card-heading">
              <strong>{displayDate(line.date)}</strong>
              <span>{line.ordersCount} {line.ordersCount === 1 ? 'pedido' : 'pedidos'}</span>
            </div>
            <div className="order-report-day-card-stats">
              <div><span>Cancelados</span><strong>{line.cancelledCount}</strong></div>
              <div><span>Total vendido</span><strong>{money(centsToReais(line.activeValueCents))}</strong></div>
              <div><span>Falta receber</span><strong>{money(centsToReais(line.pendingValueCents))}</strong></div>
            </div>
          </article>) : <div className="order-report-days-empty">Nenhum pedido criado neste mês.</div>}
        </div>
      </section>}
    </> : <div className="empty-state">O relatório ficará disponível quando a API estiver conectada.</div>}
  </section>
}

function OrdersArea({ orders, products, session, sessions, onRefresh, toast, apiReady }: { orders: Order[]; products: Product[]; session: OrderSession | null; sessions: OrderSession[]; onRefresh: () => Promise<void>; toast: (v: string) => void; apiReady: boolean }) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState('Balcão')
  const [draftItems, setDraftItems] = useState<Array<{ key: number; productId: string; quantity: string }>>([{ key: 1, productId: '', quantity: '1' }])
  const [nextDraftKey, setNextDraftKey] = useState(2)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [paymentDate, setPaymentDate] = useState(businessTodayIso())
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [orderScope, setOrderScope] = useState<'session' | 'all'>('session')
  const sessionIsOpen = session?.status === 'open'
  const latestSession = session ?? sessions[0] ?? null
  const sessionOrders = latestSession ? orders.filter((o) => o.sessionId === latestSession.id) : orders.filter((o) => !o.sessionId)
  const activeOrders = session ? orders.filter((o) => o.sessionId === session.id && o.status !== 'Entregue' && o.status !== 'Cancelado') : []
  const scopedOrders = orderScope === 'all' ? orders : latestSession ? orders.filter((o) => o.sessionId === latestSession.id) : orders.filter((o) => !o.sessionId)
  const sellableProducts = products.filter((p) => p.sellable)
  const shownOrders = useMemo(() => scopedOrders.filter((o) => `${o.number} ${o.customer} ${o.items} ${o.status} ${o.paymentStatus} ${o.paymentMethod ?? ''} ${o.businessDate ?? ''}`.toLowerCase().includes(search.toLowerCase())), [scopedOrders, search])

  const productForDraft = (row: { productId: string; quantity: string }) => sellableProducts.find((p) => p.id === row.productId)
  const draftLineTotalCents = (row: { productId: string; quantity: string }) => {
    const product = productForDraft(row)
    const qty = Number(row.quantity)
    if (!product || !Number.isFinite(qty) || qty <= 0) return 0
    const milliQuantity = Math.round((qty + Number.EPSILON) * 1000)
    return Math.round((milliQuantity / 1000) * reaisToCents(product.price))
  }
  const draftTotalCents = draftItems.reduce((sum, row) => sum + draftLineTotalCents(row), 0)
  const updateDraftItem = (key: number, patch: Partial<{ productId: string; quantity: string }>) => {
    setDraftItems((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item))
  }
  const updateDraftProduct = (key: number, productId: string) => {
    const product = sellableProducts.find((item) => item.id === productId)
    setDraftItems((items) => items.map((item) => {
      if (item.key !== key) return item
      const needsWholeQuantity = Boolean(product && ['un', 'porcao'].includes(product.unit))
      const quantity = needsWholeQuantity && !Number.isInteger(Number(item.quantity)) ? '1' : item.quantity
      return { ...item, productId, quantity }
    }))
  }
  const addDraftItem = () => {
    setDraftItems((items) => [...items, { key: nextDraftKey, productId: '', quantity: '1' }])
    setNextDraftKey((key) => key + 1)
  }
  const resetDraft = () => {
    setCustomer('Balcão')
    setDraftItems([{ key: 1, productId: '', quantity: '1' }])
    setNextDraftKey(2)
    setShowForm(false)
  }

  const toggleOrderForm = () => {
    if (showForm) { resetDraft(); return }
    setCustomer('Balcão')
    setDraftItems([{ key: 1, productId: '', quantity: '1' }])
    setNextDraftKey(2)
    setShowForm(true)
  }

  const startSession = async () => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    try {
      await apiRequest('/admin/orders/session/start', { method: 'POST', body: JSON.stringify({}) })
      setOrderScope('session')
      await onRefresh()
      toast('Atendimento iniciado. A numeração dos pedidos começou em 001.')
    } catch (error) { toast(errorText(error)) }
  }

  const closeSession = async () => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (activeOrders.length) return toast(`Finalize ou cancele os ${activeOrders.length} pedidos em andamento antes de encerrar.`)
    if (!window.confirm('Deseja encerrar o atendimento? Novos pedidos e mudanças operacionais ficarão bloqueados até iniciar um novo atendimento.')) return
    try {
      await apiRequest('/admin/orders/session/close', { method: 'POST', body: JSON.stringify({}) })
      setShowForm(false)
      await onRefresh()
      toast('Atendimento encerrado. Os lançamentos operacionais estão bloqueados até a próxima abertura.')
    } catch (error) { toast(errorText(error)) }
  }

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (!sessionIsOpen) return toast('Inicie o atendimento antes de registrar pedidos.')
    if (!sellableProducts.length) return toast('Cadastre pelo menos um produto antes de criar um pedido.')
    if (!draftItems.length) return toast('Adicione pelo menos um item ao pedido.')
    const items = draftItems.map((row) => {
      const product = productForDraft(row)
      return { productId: product?.id ?? '', quantity: Number(row.quantity) }
    })
    if (items.some((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      return toast('Confira o produto e a quantidade de cada item.')
    }
    try {
      const result = await apiRequest<{ order: ApiOrder }>('/admin/orders', {
        method: 'POST',
        body: JSON.stringify({ customer: customer.trim() || 'Balcão', items }),
      })
      resetDraft()
      await onRefresh()
      toast(`Pedido #${String(result.order.number).padStart(3, '0')} salvo com ${result.order.items.length} ${result.order.items.length === 1 ? 'item' : 'itens'}. Baixa de estoque automática aplicada quando houver itens controlados.`)
    } catch (error) { toast(errorText(error)) }
  }

  const advanceOrder = async (order: Order) => {
    const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { Recebido: 'Em preparo', 'Em preparo': 'Pronto', Pronto: 'Entregue' }
    const status = nextStatus[order.status]
    if (!status) return
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    try {
      await apiRequest(`/admin/orders/${encodeURIComponent(order.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: apiOrderStatus[status] }) })
      await onRefresh()
      toast(status === 'Pronto' ? `Pedido #${String(order.number).padStart(3, '0')} marcado como pronto. O painel físico ainda não está integrado.` : status === 'Entregue' ? `Pedido #${String(order.number).padStart(3, '0')} marcado como entregue.` : `Pedido #${String(order.number).padStart(3, '0')} atualizado para ${status.toLowerCase()}.`)
    } catch (error) { toast(errorText(error)) }
  }

  const cancelOrder = async (order: Order) => {
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (order.paymentStatus === 'paid') return toast('Pedidos pagos não podem ser cancelados até existir o fluxo de estorno.')
    const stockNotice = order.stockReserved
      ? '\nOs produtos de revenda baixados no registro serão devolvidos ao estoque automaticamente.'
      : '\nEste pedido não possui baixa de estoque de revenda para devolver.'
    if (!window.confirm(`Deseja cancelar o pedido #${order.number}?\nEssa ação não pode ser desfeita.${stockNotice}`)) return
    try {
      await apiRequest(`/admin/orders/${encodeURIComponent(order.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: apiOrderStatus.Cancelado }) })
      await onRefresh()
      toast(`Pedido #${String(order.number).padStart(3, '0')} cancelado${order.stockReserved ? ' e estoque de revenda devolvido.' : '.'}`)
    } catch (error) { toast(errorText(error)) }
  }

  const saveOrderPayment = async (order: Order, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!apiReady) return toast('API local indisponível. Inicie o servidor e tente novamente.')
    if (order.paymentStatus === 'paid') return toast('Este pedido já foi pago; o caixa não será lançado novamente.')
    if (!paymentDate) return toast('Informe a data do pagamento.')
    try {
      const result = await apiRequest<{ idempotent: boolean }>(`/admin/orders/${encodeURIComponent(order.id)}/pay`, {
        method: 'POST', body: JSON.stringify({ paymentDate, paymentMethod }),
      })
      setPaymentOrderId(null)
      await onRefresh()
      toast(result.idempotent ? `O pedido #${order.number} já estava pago; nenhuma entrada duplicada foi criada.` : `Pagamento do pedido #${order.number} registrado no caixa.`)
    } catch (error) { toast(errorText(error)) }
  }

  return <section className="page-content">
    <div className="page-heading-row orders-page-heading">
      <div><div className="section-kicker">OPERAÇÃO DO ESTABELECIMENTO</div><h1>Pedidos</h1><p>Organize o preparo e acompanhe as retiradas durante o expediente.</p></div>
      <div className="orders-session-actions">
        {sessionIsOpen ? <button type="button" className="outline-button session-close-button" onClick={() => void closeSession()} disabled={!apiReady}><StopCircle size={17} /> Encerrar atendimento</button>
          : <button type="button" className="primary-button session-start-button" onClick={() => void startSession()} disabled={!apiReady}><PlayCircle size={17} /> Iniciar atendimento</button>}

      </div>
    </div>
    <div className={`order-session-banner ${sessionIsOpen ? 'is-open' : 'is-closed'}`}>
      <span className="order-session-icon">{sessionIsOpen ? <CheckCircle2 size={19} /> : <LockKeyhole size={19} />}</span>
      <div className="order-session-copy">
        <strong>{sessionIsOpen ? 'Atendimento aberto' : 'Atendimento encerrado'}</strong>
        <span>{sessionIsOpen ? `Iniciado às ${displayTime(session.startedAt)} · ${displayDate(session.businessDate)}` : 'Novos pedidos estão bloqueados. Inicie o atendimento quando a adega abrir.'}</span>
        {sessionIsOpen && activeOrders.length > 0 && <small>{activeOrders.length} pedido(s) ainda precisam ser entregues ou cancelados para permitir o encerramento.</small>}
      </div>
      {sessionIsOpen && <div className="order-session-next"><span>PRÓXIMO PEDIDO</span><strong>#{String(session.nextOrderNumber).padStart(3, '0')}</strong></div>}
    </div>
    <div className="order-section-label"><span>RESUMO DO ATENDIMENTO</span><small>{sessionOrders.length} {sessionOrders.length === 1 ? 'pedido registrado' : 'pedidos registrados'}</small></div>
    <div className="order-metrics">
      <MetricCard title="Pedidos pendentes" value={String(activeOrders.length).padStart(2, '0')} detail="Em preparo ou aguardando retirada" icon={<ClipboardList size={18} />} tone="gold" />
      <MetricCard title="Prontos para retirada" value={String(sessionOrders.filter((o) => o.status === 'Pronto').length).padStart(2, '0')} detail="Aguardando cliente" icon={<Bell size={18} />} tone="blue" />
      <MetricCard title="Entregues" value={String(sessionOrders.filter((o) => o.status === 'Entregue').length).padStart(2, '0')} detail="Concluídos neste atendimento" icon={<CheckCircle2 size={18} />} tone="green" />
    </div>

    <section className="panel order-board">
      <div className="table-toolbar order-board-toolbar">
        <div className="order-board-heading-copy">
          <div className="order-board-title-row"><h3>{orderScope === 'all' ? 'Histórico de pedidos' : sessionIsOpen ? 'Pedidos do atendimento' : 'Pedidos do último atendimento'}</h3><span className="order-result-count">{shownOrders.length} {shownOrders.length === 1 ? 'pedido' : 'pedidos'}</span></div>
          <p>Acompanhe o preparo, a retirada e o pagamento de cada pedido.</p>
          <div className="order-scope-switch"><button type="button" className={orderScope === 'session' ? 'active' : ''} onClick={() => setOrderScope('session')}>{latestSession ? (sessionIsOpen ? 'Atendimento atual' : 'Último atendimento') : 'Pedidos antigos'}</button><button type="button" className={orderScope === 'all' ? 'active' : ''} onClick={() => setOrderScope('all')}>Todo o histórico</button></div>
        </div>
        <div className="order-board-toolbar-actions">
          {sessionIsOpen && <button type="button" className={showForm ? 'outline-button order-new-button is-open' : 'primary-button order-new-button'} title={showForm ? 'Fechar formulário de novo pedido' : 'Registrar um novo pedido'} disabled={!apiReady} onClick={toggleOrderForm}>{showForm ? <X size={16} /> : <Plus size={17} />}{showForm ? 'Fechar formulário' : 'Novo pedido'}</button>}
          <div className="filter-control"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar número ou cliente..." /></div>
        </div>
      </div>
      {showForm && sessionIsOpen && <form className="panel order-form" onSubmit={createOrder}>
      <div className="panel-heading">
        <div><h3>Novo pedido</h3><p>Adicione todos os produtos antes de registrar.</p></div>
        <button className="icon-button" type="button" aria-label="Fechar formulário" onClick={resetDraft}><X size={17} /></button>
      </div>
      <div className="order-form-grid">
        <label className="order-customer-field">Identificação / cliente<input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Ex.: Balcão" /></label>
        <section className="order-items-section" aria-label="Itens do pedido">
          <div className="order-items-heading"><div><h4>Produtos deste pedido</h4><span>{draftItems.length} {draftItems.length === 1 ? 'produto' : 'produtos'} · adicione todos antes de registrar</span></div></div>
          {draftItems.map((row, index) => {
            const product = productForDraft(row)
            const lineTotal = centsToReais(draftLineTotalCents(row))
            return <div className="order-item-row" key={row.key}>
              <label className="order-item-product">Produto {index + 1}<select value={row.productId} onChange={(event) => updateDraftProduct(row.key, event.target.value)} required disabled={!sellableProducts.length}><option value="">Selecione um produto</option>{sellableProducts.map((item) => <option key={item.id} value={item.id}>{item.name} — {money(item.price)}</option>)}</select></label>
              <label className="order-item-quantity">Quantidade<input type="number" min={product && ['un', 'porcao'].includes(product.unit) ? 1 : 0.001} step={product && ['un', 'porcao'].includes(product.unit) ? 1 : 0.001} value={row.quantity} onChange={(event) => updateDraftItem(row.key, { quantity: event.target.value })} required /></label>
              <div className={`order-item-subtotal ${product ? '' : 'is-empty'}`}><span>Subtotal</span><strong>{product ? money(lineTotal) : '—'}</strong><small>{product?.name ?? 'Escolha um produto'}</small></div>
              <button type="button" className="order-item-remove" aria-label={`Remover item ${index + 1}`} title="Remover item" disabled={draftItems.length === 1} onClick={() => setDraftItems((items) => items.filter((item) => item.key !== row.key))}><Trash2 size={16} /></button>
            </div>
          })}
          <button type="button" className="primary-button order-add-item" onClick={addDraftItem} disabled={!sellableProducts.length}><Plus size={16} /> Adicionar outro produto ao pedido</button>
          {!sellableProducts.length && <div className="empty-state">Cadastre um produto de revenda ou preparado antes de criar pedidos.</div>}
        </section>
        <div className="order-order-total"><span>Total do pedido</span><strong>{money(centsToReais(draftTotalCents))}</strong></div>
      </div>
      <div className="form-actions"><button type="button" className="outline-button" onClick={resetDraft}>Cancelar</button><button type="submit" className="primary-button" disabled={!sellableProducts.length || !apiReady}>Registrar pedido</button></div>
    </form>}
      {shownOrders.length === 0 ? <div className="empty-state order-empty-state"><span className="order-empty-icon"><ClipboardList size={22} /></span><strong>{search.trim() ? 'Nenhum pedido encontrado' : sessionIsOpen && orderScope === 'session' ? 'Nenhum pedido neste atendimento ainda' : 'Não há pedidos para exibir'}</strong><p>{search.trim() ? 'Tente outro número ou nome de cliente.' : sessionIsOpen && orderScope === 'session' ? 'Registre o primeiro pedido deste expediente para começar a acompanhar o preparo e a retirada.' : 'Quando houver pedidos neste período, eles aparecerão aqui.'}</p>{!search.trim() && sessionIsOpen && orderScope === 'session' && <button type="button" className="outline-button" onClick={() => { setCustomer('Balcão'); setDraftItems([{ key: 1, productId: '', quantity: '1' }]); setNextDraftKey(2); setShowForm(true) }}><Plus size={15} /> Criar primeiro pedido</button>}</div> : <div className="order-list">{shownOrders.map((order) => <article className="order-card" key={order.id}>
        <div className="order-number"><span>PEDIDO</span><strong>#{String(order.number).padStart(3, '0')}</strong><small>{order.created} · {displayDate(order.businessDate || '')}</small></div>
        <div className="order-description"><strong>{order.customer}</strong><p>{order.items}</p>
          <div className="order-meta-row"><span className="order-total">{money(order.total)}</span>
            {order.paymentStatus === 'paid' ? <span title={`Pago${order.paymentMethod ? ` · ${order.paymentMethod}` : ''}`} className="order-payment-state is-paid"><i aria-hidden="true" />{`Pago${order.paymentMethod ? ` · ${order.paymentMethod}` : ''}`}</span>
              : order.status === 'Cancelado' ? <span className="order-payment-state is-pending"><i aria-hidden="true" />Cancelado sem pagamento</span>
              : <button type="button" title={`Registrar pagamento do pedido #${order.number}`} aria-label={`Registrar pagamento do pedido #${order.number}`} aria-expanded={paymentOrderId === order.id} className="order-payment-state is-pending order-payment-inline-action" onClick={() => { setPaymentOrderId(paymentOrderId === order.id ? null : order.id); setPaymentDate(businessTodayIso()); setPaymentMethod('Pix') }}><i aria-hidden="true" />Pagamento pendente · <strong>{paymentOrderId === order.id ? 'Fechar' : 'Registrar'}</strong></button>}
          </div>
        </div>
        <div className="order-status-actions">
          <div className="order-status-stack">
            <span className={`status-pill ${order.status === 'Pronto' ? 'ready' : order.status === 'Entregue' ? 'done' : order.status === 'Cancelado' ? 'cancelled' : 'pending'}`}>{order.status}</span>
          </div>
          {sessionIsOpen && (!order.sessionId || order.sessionId === session.id) && order.status !== 'Entregue' && order.status !== 'Cancelado' && <div className={`order-action-buttons ${order.paymentStatus !== 'paid' ? 'has-two-actions' : ''}`}>
            <button className={`small-action order-operational-action ${order.status === 'Em preparo' ? 'ready-action' : ''}`} disabled={!apiReady} onClick={() => void advanceOrder(order)}>{order.status === 'Recebido' ? 'Iniciar preparo' : order.status === 'Em preparo' ? 'Marcar pronto' : 'Confirmar retirada'} <ArrowUpRight size={14} /></button>
            {order.paymentStatus !== 'paid' && <button type="button" className="small-action danger-action order-cancel-action" disabled={!apiReady} onClick={() => void cancelOrder(order)} aria-label={`Cancelar pedido #${order.number}`}><X size={14} /> Cancelar pedido</button>}
          </div>}
        </div>
        {paymentOrderId === order.id && <form className="order-payment-form" onSubmit={(event) => void saveOrderPayment(order, event)}>
          <div className="order-payment-heading"><strong>Pagamento do pedido #{order.number}</strong><span>Valor integral: {money(order.total)}</span></div>
          <label>Data do pagamento<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
          <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option></select></label>
          <div className="form-actions"><button className="outline-button" type="button" onClick={() => setPaymentOrderId(null)}>Cancelar</button><button className="primary-button" type="submit" disabled={!apiReady}>Confirmar pagamento</button></div>
        </form>}
      </article>)}</div>}
    </section>
    <div className="integration-note"><Bell size={18} /><div><strong>Integração com painel de chamadas pendente</strong><p>O pedido e suas mudanças de status já são persistidos localmente. A comunicação com o painel físico depende do modelo e do protocolo do equipamento; por enquanto, não é enviado nenhum sinal externo.</p></div></div>
  </section>
}

export default App
