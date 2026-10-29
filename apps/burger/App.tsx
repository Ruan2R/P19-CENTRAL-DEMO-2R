import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2, ChevronDown,
  ClipboardList, CreditCard, LayoutDashboard, LogOut, Package, Plus, Search, ShieldCheck,
  TrendingUp, Wallet, X,
} from 'lucide-react'

type AccessRole = 'finance' | 'full'
type FinanceTab = 'overview' | 'transactions' | 'payables' | 'inventory'
type Direction = 'income' | 'expense'
type Product = { id: number; name: string; category: string; cost: number; price: number; stock: number; minimum: number }
type Movement = { id: number; title: string; category: string; direction: Direction; amount: number; date: string; method: string }
type Payable = { id: number; title: string; category: string; amount: number; due: string; paid: boolean }
type OrderStatus = 'Recebido' | 'Em preparo' | 'Pronto' | 'Entregue'
type Order = { id: number; number: number; customer: string; items: string; total: number; status: OrderStatus; created: string }

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const today = new Date().toLocaleDateString('pt-BR')
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())
const DEMO_USERS: Record<string, { password: string; role: AccessRole; displayName: string }> = {
  admin: { password: 'financeiro123', role: 'finance', displayName: 'Admin Financeiro' },
  admin02: { password: 'painel123', role: 'full', displayName: 'Admin Completo' },
}

const initialProducts: Product[] = [
  { id: 1, name: 'X-Burguer', category: 'Hambúrguer', cost: 8.5, price: 20, stock: 34, minimum: 10 },
  { id: 2, name: 'X-Bacon', category: 'Hambúrguer', cost: 11.2, price: 27, stock: 18, minimum: 8 },
  { id: 3, name: 'Batata frita P', category: 'Acompanhamento', cost: 4.1, price: 12, stock: 6, minimum: 8 },
  { id: 4, name: 'Refrigerante lata', category: 'Bebida', cost: 3.2, price: 7, stock: 42, minimum: 12 },
  { id: 5, name: 'Água mineral', category: 'Bebida', cost: 1.1, price: 4, stock: 24, minimum: 10 },
  { id: 6, name: 'Cerveja lata', category: 'Adega', cost: 4.3, price: 8, stock: 9, minimum: 18 },
]
const initialMovements: Movement[] = [
  { id: 1, title: 'Vendas do balcão', category: 'Vendas', direction: 'income', amount: 1250, date: today, method: 'Pix' },
  { id: 2, title: 'Compra de bebidas', category: 'Estoque', direction: 'expense', amount: 486.9, date: today, method: 'Cartão' },
  { id: 3, title: 'Venda de pedidos', category: 'Vendas', direction: 'income', amount: 873.5, date: today, method: 'Dinheiro' },
  { id: 4, title: 'Fornecedor de carnes', category: 'Fornecedor', direction: 'expense', amount: 640, date: '10/10/2026', method: 'Pix' },
  { id: 5, title: 'Conta de energia', category: 'Contas fixas', direction: 'expense', amount: 289.9, date: '09/10/2026', method: 'Pix' },
]
const initialPayables: Payable[] = [
  { id: 1, title: 'Fornecedor de bebidas', category: 'Estoque', amount: 780, due: '18/10/2026', paid: false },
  { id: 2, title: 'Internet', category: 'Contas fixas', amount: 119.9, due: '20/10/2026', paid: false },
  { id: 3, title: 'Fornecedor de pães', category: 'Estoque', amount: 245, due: '12/10/2026', paid: true },
]
const initialOrders: Order[] = [
  { id: 1, number: 101, customer: 'Balcão', items: '2x X-Burguer, 1x Refrigerante lata', total: 47, status: 'Em preparo', created: '14:32' },
  { id: 2, number: 102, customer: 'Balcão', items: '1x X-Bacon, 1x Batata frita P', total: 39, status: 'Pronto', created: '14:35' },
  { id: 3, number: 103, customer: 'Balcão', items: '2x Cerveja lata', total: 16, status: 'Recebido', created: '14:39' },
]

function App() {
  const [user, setUser] = useState<{ role: AccessRole; displayName: string } | null>(null)
  const [loginId, setLoginId] = useState('admin')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [view, setView] = useState<'finance' | 'orders'>('finance')
  const [financeTab, setFinanceTab] = useState<FinanceTab>('overview')
  const [notice, setNotice] = useState('')
  const [products, setProducts] = useState(initialProducts)
  const [movements, setMovements] = useState(initialMovements)
  const [payables, setPayables] = useState(initialPayables)
  const [orders, setOrders] = useState(initialOrders)

  const toast = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

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
          <div className="local-state"><span className="local-dot" /><span>Demonstração local</span></div>
          <div className="user-chip">
            <div className="user-avatar">{user.displayName.charAt(0)}</div>
            <div className="user-meta"><strong>{user.displayName}</strong><span>{financeOnly ? 'Acesso financeiro' : 'Acesso completo'}</span></div>
            <button className="icon-button logout-button" aria-label="Sair" title="Sair" onClick={() => { setUser(null); setPassword('') }}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Copão</span><span className="crumb-separator">/</span><strong>{view === 'finance' ? 'Financeiro' : 'Pedidos'}</strong></div>
          <div className="topbar-right"><span className="date-chip"><CalendarDays size={15} />{today}</span><button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><i /></button></div>
        </header>

        {view === 'finance' ? <FinanceArea
          tab={financeTab} setTab={setFinanceTab} products={products} setProducts={setProducts}
          movements={movements} setMovements={setMovements} payables={payables} setPayables={setPayables} toast={toast}
        /> : <OrdersArea orders={orders} setOrders={setOrders} products={products} toast={toast} />}
        <footer className="app-footer"><span>ADEGA DO COPÃO</span><span>Base de demonstração · Dados fictícios</span></footer>
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
        <p className="prototype-warning">Protótipo inicial: os acessos e dados são demonstrativos e ainda não devem ser usados em produção.</p>
      </form>
    </div>
  </div>
}

function FinanceArea(props: {
  tab: FinanceTab; setTab: (v: FinanceTab) => void; products: Product[]; setProducts: (v: Product[]) => void;
  movements: Movement[]; setMovements: (v: Movement[]) => void; payables: Payable[]; setPayables: (v: Payable[]) => void; toast: (v: string) => void
}) {
  const { tab, setTab, products, setProducts, movements, setMovements, payables, setPayables, toast } = props
  const income = movements.filter((m) => m.direction === 'income').reduce((sum, m) => sum + m.amount, 0)
  const expenses = movements.filter((m) => m.direction === 'expense').reduce((sum, m) => sum + m.amount, 0)
  const result = income - expenses
  const pending = payables.filter((p) => !p.paid).reduce((sum, p) => sum + p.amount, 0)
  const [term, setTerm] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'all' | Direction>('all')
  const [movementForm, setMovementForm] = useState(false)
  const [productForm, setProductForm] = useState(false)
  const [payableForm, setPayableForm] = useState(false)

  const addMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const amount = Number(data.get('amount'))
    const title = String(data.get('title') || '').trim()
    if (!title || !Number.isFinite(amount) || amount <= 0) return
    setMovements([{ id: Date.now(), title, category: String(data.get('category') || 'Geral'), direction: String(data.get('direction')) as Direction, amount, date: today, method: String(data.get('method') || 'Não informado') }, ...movements])
    setMovementForm(false); toast('Movimentação adicionada à demonstração.')
  }
  const addProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const product: Product = { id: Date.now(), name: String(data.get('name') || '').trim(), category: String(data.get('category') || 'Geral'), cost: Number(data.get('cost')), price: Number(data.get('price')), stock: Number(data.get('stock')), minimum: Number(data.get('minimum')) }
    if (!product.name || product.cost < 0 || product.price <= 0 || product.stock < 0) return
    setProducts([product, ...products]); setProductForm(false); toast('Produto adicionado à demonstração.')
  }
  const addPayable = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') || '').trim(); const amount = Number(data.get('amount'))
    if (!title || amount <= 0) return
    const dueValue = String(data.get('due') || today)
    const dueDisplay = dueValue.includes('-') ? dueValue.split('-').reverse().join('/') : dueValue
    setPayables([{ id: Date.now(), title, category: String(data.get('category') || 'Geral'), amount, due: dueDisplay, paid: false }, ...payables])
    setPayableForm(false); toast('Conta adicionada à demonstração.')
  }

  const headings: Record<FinanceTab, { title: string; description: string }> = {
    overview: { title: 'Visão financeira', description: 'Acompanhe os números do estabelecimento em um só lugar.' },
    transactions: { title: 'Movimentações', description: 'Consulte e registre entradas e saídas do caixa.' },
    payables: { title: 'Contas a pagar', description: 'Organize vencimentos e acompanhe o que ainda está pendente.' },
    inventory: { title: 'Produtos e estoque', description: 'Cadastre produtos, acompanhe custos, preços e quantidades.' },
  }
  return <section className="page-content">
    <div className="page-heading-row"><div><div className="section-kicker">CONTROLE FINANCEIRO</div><h1>{headings[tab].title}</h1><p>{headings[tab].description}</p></div><button className="outline-button month-button"><CalendarDays size={16} /> {monthLabel} <ChevronDown size={15} /></button></div>
    <div className="finance-tabs" role="tablist" aria-label="Módulos financeiros">
      <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<LayoutDashboard size={16} />}>Resumo</TabButton>
      <TabButton active={tab === 'transactions'} onClick={() => setTab('transactions')} icon={<ArrowDownLeft size={16} />}>Movimentações</TabButton>
      <TabButton active={tab === 'payables'} onClick={() => setTab('payables')} icon={<CreditCard size={16} />}>Contas a pagar</TabButton>
      <TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')} icon={<Package size={16} />}>Produtos e estoque</TabButton>
    </div>

    {tab === 'overview' && <>
      <div className="metrics-grid">
        <MetricCard title="Entradas registradas" value={money(income)} detail="Movimentações da demonstração" icon={<ArrowDownLeft size={18} />} tone="green" />
        <MetricCard title="Saídas registradas" value={money(expenses)} detail="Movimentações da demonstração" icon={<ArrowUpRight size={18} />} tone="red" />
        <MetricCard title="Resultado do período" value={money(result)} detail="Entradas menos saídas registradas" icon={<TrendingUp size={18} />} tone="gold" prominent />
        <MetricCard title="Contas pendentes" value={money(pending)} detail={`${payables.filter((p) => !p.paid).length} contas em aberto`} icon={<CalendarDays size={18} />} tone="blue" />
      </div>
      <div className="overview-grid">
        <section className="panel transactions-panel"><div className="panel-heading"><div><h3>Últimas movimentações</h3><p>Entradas e saídas recentes</p></div><button className="text-button" onClick={() => setTab('transactions')}>Ver todas <ArrowUpRight size={15} /></button></div><MovementList movements={movements.slice(0, 4)} /></section>
        <section className="panel"><div className="panel-heading"><div><h3>Visão rápida do estoque</h3><p>{products.filter((p) => p.stock <= p.minimum).length} produtos no mínimo ou abaixo</p></div><button className="icon-button" aria-label="Abrir estoque" onClick={() => setTab('inventory')}><ArrowUpRight size={17} /></button></div>
          <div className="stock-mini-list">{products.slice(0, 4).map((p) => <div className="stock-mini-row" key={p.id}><div className="product-avatar"><Package size={17} /></div><div className="stock-mini-name"><strong>{p.name}</strong><small>{p.category}</small></div><span className={`stock-count ${p.stock <= p.minimum ? 'low' : ''}`}>{p.stock} un.</span></div>)}</div><button className="secondary-full-button" onClick={() => setTab('inventory')}>Gerenciar produtos <ArrowUpRight size={16} /></button>
        </section>
      </div>
      <div className="bottom-grid"><section className="panel"><div className="panel-heading"><div><h3>Resumo de caixa</h3><p>Visão comparativa das movimentações registradas</p></div></div><CashBar label="Entradas" amount={income} max={Math.max(income, expenses, 1)} moneyValue={money(income)} tone="income" /><CashBar label="Saídas" amount={expenses} max={Math.max(income, expenses, 1)} moneyValue={money(expenses)} tone="expense" /><div className="cash-result"><span>Saldo das movimentações</span><strong className={result >= 0 ? 'positive' : 'negative'}>{money(result)}</strong></div></section>
        <section className="panel action-panel"><div className="panel-heading"><div><h3>Ações rápidas</h3><p>Atalhos para o dia a dia</p></div></div><button className="quick-action" onClick={() => { setTab('transactions'); setMovementForm(true) }}><span className="quick-icon income-bg"><Plus size={17} /></span><span><strong>Nova movimentação</strong><small>Registrar entrada ou saída</small></span><ArrowUpRight size={16} /></button><button className="quick-action" onClick={() => { setTab('payables'); setPayableForm(true) }}><span className="quick-icon payable-bg"><CalendarDays size={17} /></span><span><strong>Adicionar conta</strong><small>Organizar um vencimento</small></span><ArrowUpRight size={16} /></button><button className="quick-action" onClick={() => { setTab('inventory'); setProductForm(true) }}><span className="quick-icon stock-bg"><Package size={17} /></span><span><strong>Cadastrar produto</strong><small>Atualizar catálogo e estoque</small></span><ArrowUpRight size={16} /></button></section></div>
    </>}

    {tab === 'transactions' && <section className="panel table-panel"><div className="table-toolbar"><div className="filter-control"><Search size={17} /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar movimentação..." /></div><select aria-label="Filtrar movimentações" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as typeof directionFilter)}><option value="all">Todas as movimentações</option><option value="income">Somente entradas</option><option value="expense">Somente saídas</option></select><button className="primary-button" onClick={() => setMovementForm(!movementForm)}><Plus size={17} /> Nova movimentação</button></div>
      {movementForm && <form className="inline-form four-fields" onSubmit={addMovement}><label>Descrição<input name="title" required placeholder="Ex.: venda no balcão" /></label><label>Tipo<select name="direction"><option value="income">Entrada</option><option value="expense">Saída</option></select></label><label>Categoria<input name="category" placeholder="Ex.: Vendas" /></label><label>Valor (R$)<input name="amount" required type="number" min="0.01" step="0.01" placeholder="0,00" /></label><label>Forma de pagamento<select name="method"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option></select></label><div className="form-actions"><button className="outline-button" type="button" onClick={() => setMovementForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar lançamento</button></div></form>}
      <MovementList movements={movements.filter((m) => (directionFilter === 'all' || m.direction === directionFilter) && `${m.title} ${m.category} ${m.method}`.toLowerCase().includes(term.toLowerCase()))} expanded /></section>}

    {tab === 'payables' && <section className="panel table-panel"><div className="table-toolbar"><div><h3>Contas cadastradas</h3><p>{payables.filter((p) => !p.paid).length} pendentes · {money(pending)} em aberto</p></div><button className="primary-button" onClick={() => setPayableForm(!payableForm)}><Plus size={17} /> Nova conta</button></div>
      {payableForm && <form className="inline-form four-fields" onSubmit={addPayable}><label>Descrição<input name="title" required placeholder="Ex.: fornecedor de bebidas" /></label><label>Categoria<input name="category" placeholder="Ex.: Estoque" /></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" /></label><label>Vencimento<input name="due" type="date" required /></label><div className="form-actions"><button className="outline-button" type="button" onClick={() => setPayableForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar conta</button></div></form>}
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Conta</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{payables.map((p) => <tr key={p.id}><td><strong>{p.title}</strong></td><td>{p.category}</td><td>{p.due}</td><td className="amount-cell">{money(p.amount)}</td><td><span className={`status-pill ${p.paid ? 'done' : 'pending'}`}>{p.paid ? 'Paga' : 'Pendente'}</span></td><td>{!p.paid ? <button className="small-action" onClick={() => { setPayables(payables.map((x) => x.id === p.id ? { ...x, paid: true } : x)); toast('Conta marcada como paga na demonstração.') }}><Check size={14} /> Marcar paga</button> : <span className="muted-cell">Concluída</span>}</td></tr>)}</tbody></table></div>
    </section>}

    {tab === 'inventory' && <section className="panel table-panel"><div className="table-toolbar"><div><h3>Catálogo de produtos</h3><p>{products.length} produtos cadastrados · {products.filter((p) => p.stock <= p.minimum).length} precisam de reposição</p></div><button className="primary-button" onClick={() => setProductForm(!productForm)}><Plus size={17} /> Novo produto</button></div>
      {productForm && <form className="inline-form four-fields" onSubmit={addProduct}><label>Nome do produto<input name="name" required placeholder="Ex.: Hambúrguer artesanal" /></label><label>Categoria<input name="category" placeholder="Ex.: Hambúrguer" /></label><label>Custo de compra (R$)<input name="cost" type="number" min="0" step="0.01" required placeholder="0,00" /></label><label>Preço de venda (R$)<input name="price" type="number" min="0.01" step="0.01" required placeholder="0,00" /></label><label>Quantidade atual<input name="stock" type="number" min="0" step="1" required placeholder="0" /></label><label>Estoque mínimo<input name="minimum" type="number" min="0" step="1" required placeholder="0" /></label><div className="form-actions"><button className="outline-button" type="button" onClick={() => setProductForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar produto</button></div></form>}
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Margem bruta*</th><th>Estoque</th><th>Status</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><div className="table-product"><span className="product-avatar"><Package size={16} /></span><strong>{p.name}</strong></div></td><td>{p.category}</td><td>{money(p.cost)}</td><td className="amount-cell">{money(p.price)}</td><td className="positive">{money(p.price - p.cost)}</td><td>{p.stock} un.</td><td><span className={`status-pill ${p.stock <= p.minimum ? 'pending' : 'done'}`}>{p.stock <= p.minimum ? 'Repor estoque' : 'Disponível'}</span></td></tr>)}</tbody></table></div>
      <p className="table-footnote">* Cálculo ilustrativo por unidade: preço de venda menos custo de compra. Ainda não considera despesas, impostos, perdas ou custos indiretos.</p>
    </section>}
  </section>
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button className={`finance-tab ${active ? 'active' : ''}`} onClick={onClick} role="tab" aria-selected={active}>{icon}<span>{children}</span></button>
}
function MetricCard({ title, value, detail, icon, tone, prominent }: { title: string; value: string; detail: string; icon: ReactNode; tone: string; prominent?: boolean }) {
  return <article className={`metric-card ${prominent ? 'prominent' : ''}`}><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong className="metric-value">{value}</strong><div className="metric-detail">{detail}</div></article>
}
function MovementList({ movements, expanded = false }: { movements: Movement[]; expanded?: boolean }) {
  if (!movements.length) return <div className="empty-state">Nenhuma movimentação encontrada.</div>
  return <div className={`movement-list ${expanded ? 'expanded' : ''}`}>{movements.map((m) => <div className="movement-row" key={m.id}><span className={`movement-icon ${m.direction}`} >{m.direction === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div className="movement-info"><strong>{m.title}</strong><span>{m.category} · {m.date} · {m.method}</span></div><strong className={`movement-amount ${m.direction}`}>{m.direction === 'income' ? '+' : '−'} {money(m.amount)}</strong></div>)}</div>
}
function CashBar({ label, amount, max, moneyValue, tone }: { label: string; amount: number; max: number; moneyValue: string; tone: string }) {
  return <div className="cash-bar-row"><div className="cash-bar-label"><span>{label}</span><strong>{moneyValue}</strong></div><div className="cash-track"><span className={tone} style={{ width: `${Math.min(100, (amount / max) * 100)}%` }} /></div></div>
}

function OrdersArea({ orders, setOrders, products, toast }: { orders: Order[]; setOrders: (v: Order[]) => void; products: Product[]; toast: (v: string) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [itemId, setItemId] = useState(String(products[0]?.id ?? ''))
  const [quantity, setQuantity] = useState('1')
  const [customer, setCustomer] = useState('Balcão')
  const chosen = products.find((p) => p.id === Number(itemId))
  const activeOrders = orders.filter((o) => o.status !== 'Entregue')
  const shownOrders = useMemo(() => orders.filter((o) => `${o.number} ${o.customer} ${o.items} ${o.status}`.toLowerCase().includes(search.toLowerCase())), [orders, search])
  const nextStatus: Record<OrderStatus, OrderStatus> = { Recebido: 'Em preparo', 'Em preparo': 'Pronto', Pronto: 'Entregue', Entregue: 'Entregue' }
  const createOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const qty = Number(quantity)
    if (!chosen || !Number.isInteger(qty) || qty < 1) return
    const nextNumber = Math.max(100, ...orders.map((o) => o.number)) + 1
    const newOrder: Order = { id: Date.now(), number: nextNumber, customer: customer.trim() || 'Balcão', items: `${qty}x ${chosen.name}`, total: chosen.price * qty, status: 'Recebido', created: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    setOrders([newOrder, ...orders]); setShowForm(false); setCustomer('Balcão'); setQuantity('1'); toast(`Pedido #${nextNumber} registrado na demonstração.`)
  }
  const advanceOrder = (order: Order) => {
    const status = nextStatus[order.status]
    setOrders(orders.map((o) => o.id === order.id ? { ...o, status } : o))
    toast(status === 'Pronto' ? `Pedido #${order.number} pronto. Sinal de chamada simulado; painel físico ainda não integrado.` : status === 'Entregue' ? `Pedido #${order.number} marcado como entregue.` : `Pedido #${order.number} atualizado para ${status.toLowerCase()}.`)
  }
  return <section className="page-content"><div className="page-heading-row"><div><div className="section-kicker">OPERAÇÃO DO ESTABELECIMENTO</div><h1>Pedidos</h1><p>Registre pedidos presenciais e acompanhe o andamento da preparação.</p></div><button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={17} /> Novo pedido</button></div>
    <div className="order-metrics"><MetricCard title="Em andamento" value={String(activeOrders.length).padStart(2, '0')} detail="Aguardando preparação ou retirada" icon={<ClipboardList size={18} />} tone="gold" /><MetricCard title="Prontos para retirada" value={String(orders.filter((o) => o.status === 'Pronto').length).padStart(2, '0')} detail="Aguardando cliente" icon={<Bell size={18} />} tone="blue" /><MetricCard title="Entregues hoje" value={String(orders.filter((o) => o.status === 'Entregue').length).padStart(2, '0')} detail="Pedidos finalizados na demonstração" icon={<CheckCircle2 size={18} />} tone="green" /></div>
    {showForm && <form className="panel order-form" onSubmit={createOrder}><div className="panel-heading"><div><h3>Novo pedido presencial</h3><p>Este cadastro é demonstrativo e ainda não baixa o estoque nem lança receita.</p></div><button className="icon-button" type="button" aria-label="Fechar" onClick={() => setShowForm(false)}><X size={17} /></button></div><div className="order-form-grid"><label>Identificação / cliente<input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Ex.: Balcão" /></label><label>Produto<select value={itemId} onChange={(e) => setItemId(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</select></label><label>Quantidade<input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><div className="order-form-total"><span>Total do item</span><strong>{money((chosen?.price ?? 0) * Math.max(1, Number(quantity) || 1))}</strong></div></div><div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button">Registrar pedido</button></div></form>}
    <section className="panel order-board"><div className="table-toolbar"><div><h3>Acompanhar pedidos</h3><p>Atualize o status conforme a equipe avança.</p></div><div className="filter-control"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pedido..." /></div></div>
      {shownOrders.length === 0 ? <div className="empty-state">Nenhum pedido encontrado.</div> : <div className="order-list">{shownOrders.map((order) => <article className="order-card" key={order.id}><div className="order-number"><span>PEDIDO</span><strong>#{order.number}</strong><small>{order.created}</small></div><div className="order-description"><strong>{order.customer}</strong><p>{order.items}</p><span className="order-total">{money(order.total)}</span></div><div className="order-status-actions"><span className={`status-pill ${order.status === 'Pronto' ? 'ready' : order.status === 'Entregue' ? 'done' : 'pending'}`}>{order.status}</span>{order.status !== 'Entregue' && <button className={`small-action ${order.status === 'Em preparo' ? 'ready-action' : ''}`} onClick={() => advanceOrder(order)}>{order.status === 'Recebido' ? 'Iniciar preparo' : order.status === 'Em preparo' ? 'Marcar pronto' : 'Confirmar retirada'} <ArrowUpRight size={14} /></button>}</div></article>)}</div>}
    </section><div className="integration-note"><Bell size={18} /><div><strong>Integração com painel de chamadas pendente</strong><p>Nesta etapa, marcar o pedido como pronto apenas simula o aviso dentro do sistema. Precisamos do modelo ou das especificações do painel físico para implementar a comunicação real.</p></div></div>
  </section>
}

export default App
