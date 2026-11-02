import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2,
  ChevronDown, CreditCard, LayoutDashboard, Plus, Receipt, RefreshCw,
  Search, TrendingDown, TrendingUp, Wallet, X
} from 'lucide-react';

function currentDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function dateLabel(value) {
  if (!value) return 'Sem data';
  if (value === 'Hoje' || value === 'Ontem') return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR');
  return value;
}
function movementMonth(value) {
  if (/^\d{4}-\d{2}/.test(value || '')) return value.slice(0, 7);
  const currentMonth = currentDate().slice(0, 7);
  if (value === 'Hoje' || value === 'Ontem') return currentMonth;
  const match = String(value || '').match(/^(\d{1,2})\s+([a-z]{3})\.?$/i);
  if (match) {
    const months = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
    const month = months[match[2].toLowerCase()];
    if (month) return String(new Date().getFullYear()) + '-' + String(month).padStart(2, '0');
  }
  return currentMonth;
}
function dateIso(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value;
  if (value === 'Ontem') {
    const d = new Date(currentDate() + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return currentDate();
}

export default function EnhancedFinanceModule({
  variant = 'studio', transactions, setTransactions, payables, setPayables,
  receivables, setReceivables, resetTransactions, resetFinance, notify
}) {
  const isBurger = variant === 'burger';
  const [tab, setTab] = useState('summary');
  const [month, setMonth] = useState(currentDate().slice(0, 7));
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [showReceivableForm, setShowReceivableForm] = useState(false);
  const [showReceivables, setShowReceivables] = useState(false);
  const [showPayables, setShowPayables] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Atendimento');
  const [direction, setDirection] = useState('income');
  const [amount, setAmount] = useState('');
  const [movementDate, setMovementDate] = useState(currentDate());
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [payableDescription, setPayableDescription] = useState('');
  const [payableCategory, setPayableCategory] = useState('Despesas do negócio');
  const [payableAmount, setPayableAmount] = useState('');
  const [payableDate, setPayableDate] = useState(currentDate());
  const [receivableDescription, setReceivableDescription] = useState('');
  const [receivableCounterparty, setReceivableCounterparty] = useState('');
  const [receivableAmount, setReceivableAmount] = useState('');
  const [receivableDate, setReceivableDate] = useState(currentDate());
  const [receivableMethod, setReceivableMethod] = useState({});
  const [movementFormOpen, setMovementFormOpen] = useState(false);

  const monthTransactions = useMemo(
    () => transactions.filter(item => movementMonth(item.date) === month),
    [transactions, month]
  );
  const incoming = monthTransactions.filter(item => item.category === 'Receita')
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const outgoing = monthTransactions.filter(item => item.category === 'Despesa')
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const pendingReceivables = receivables.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const openPayables = payables.filter(item => item.status !== 'Paga');
  const pendingPayables = openPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const result = incoming - outgoing;
  const movementCount = monthTransactions.length;
  const movementItems = monthTransactions.slice().reverse();
  const searchedMovements = movementItems.filter(item => {
    const text = [item.description, item.category, item.paymentMethod, item.source].join(' ').toLocaleLowerCase('pt-BR');
    const matchesText = text.includes(movementSearch.toLocaleLowerCase('pt-BR'));
    const matchesDirection = directionFilter === 'all' ||
      (directionFilter === 'income' ? item.category === 'Receita' : item.category === 'Despesa');
    return matchesText && matchesDirection;
  });
  const overduePayables = openPayables.filter(item => dateIso(item.dueDate) < currentDate());
  const overdueReceivables = receivables.filter(item => dateIso(item.date) < currentDate());
  const categoryTotals = useMemo(() => {
    const map = {};
    monthTransactions.forEach(item => {
      const key = item.detailCategory || item.source || (item.category === 'Receita' ? 'Receitas' : 'Despesas');
      map[key] = (map[key] || 0) + Number(item.value || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [monthTransactions]);
  const paymentTotals = useMemo(() => {
    const map = {};
    monthTransactions.forEach(item => {
      const key = item.paymentMethod || 'Não informado';
      if (!map[key]) map[key] = { income: 0, expense: 0, count: 0 };
      if (item.category === 'Receita') map[key].income += Number(item.value || 0);
      else map[key].expense += Number(item.value || 0);
      map[key].count += 1;
    });
    return Object.entries(map).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));
  }, [monthTransactions]);

  function addMovement(event) {
    event.preventDefault();
    const numeric = Number(String(amount).replace(',', '.'));
    if (!description.trim() || !Number.isFinite(numeric) || numeric <= 0 || !movementDate) {
      notify('Informe uma descrição, uma data e um valor válido.');
      return;
    }
    setTransactions(previous => [{
      id: Date.now(), description: description.trim(), category: direction === 'expense' ? 'Despesa' : 'Receita',
      detailCategory: category.trim() || (isBurger ? 'Geral' : 'Atendimento'),
      date: movementDate, value: Math.round(numeric * 100) / 100, paymentMethod, source: 'Manual'
    }, ...previous]);
    setDescription('');
    setAmount('');
    setShowEntryForm(false);
    setMovementFormOpen(false);
    notify('Movimentação fictícia registrada.');
  }

  function addPayable(event) {
    event.preventDefault();
    const numeric = Number(String(payableAmount).replace(',', '.'));
    if (!payableDescription.trim() || !Number.isFinite(numeric) || numeric <= 0 || !payableDate) {
      notify('Preencha a descrição, o valor e o vencimento.');
      return;
    }
    setPayables(previous => [{
      id: Date.now(), description: payableDescription.trim(), category: payableCategory.trim() || 'Outros',
      amount: Math.round(numeric * 100) / 100, dueDate: payableDate, status: 'Em aberto'
    }, ...previous]);
    setPayableDescription('');
    setPayableAmount('');
    setShowPayableForm(false);
    notify('Conta fictícia cadastrada.');
  }

  function markPayablePaid(item) {
    if (item.status === 'Paga') return;
    setPayables(previous => previous.map(payable => payable.id === item.id
      ? { ...payable, status: 'Paga', paidAt: currentDate() } : payable));
    setTransactions(previous => [{
      id: Date.now(), description: item.description, category: 'Despesa',
      detailCategory: item.category, date: currentDate(), value: Number(item.amount),
      paymentMethod: 'Não informado', source: 'Conta a pagar'
    }, ...previous]);
    notify('Pagamento registrado e saída incluída no caixa.');
  }

  function removePayable(item) {
    if (item.status === 'Paga') return;
    setPayables(previous => previous.filter(payable => payable.id !== item.id));
    notify('Conta pendente removida da demonstração.');
  }

  function addReceivable(event) {
    event.preventDefault();
    const numeric = Number(String(receivableAmount).replace(',', '.'));
    if (!receivableDescription.trim() || !Number.isFinite(numeric) || numeric <= 0 || !receivableDate) {
      notify('Preencha a descrição, o valor e a previsão de recebimento.');
      return;
    }
    setReceivables(previous => [{
      id: Date.now(), client: receivableCounterparty.trim() || 'Não informado',
      service: receivableDescription.trim(), date: receivableDate, total: Math.round(numeric * 100) / 100,
      received: 0, balance: Math.round(numeric * 100) / 100
    }, ...previous]);
    setReceivableDescription('');
    setReceivableCounterparty('');
    setReceivableAmount('');
    setShowReceivableForm(false);
    notify('Valor a receber cadastrado.');
  }

  function receiveBalance(item) {
    const method = receivableMethod[item.id] || 'Pix';
    const value = Number(item.balance || 0);
    setTransactions(previous => [{
      id: Date.now(), description: 'Recebimento · ' + (item.client || item.description || 'Valor pendente'),
      category: 'Receita', detailCategory: item.service || 'Recebimento', date: currentDate(),
      value, paymentMethod: method, source: 'Valor a receber'
    }, ...previous]);
    setReceivables(previous => previous.filter(receivable => receivable.id !== item.id));
    notify('Recebimento registrado nas entradas do caixa.');
  }

  function restoreExamples() {
    if (resetFinance) resetFinance();
    else if (resetTransactions) resetTransactions();
    setTab('summary');
    setShowAllMovements(false);
    setMovementSearch('');
    setDirectionFilter('all');
    notify('Dados fictícios restaurados.');
  }

  const tabs = [
    { id: 'summary', label: 'Resumo', icon: LayoutDashboard },
    { id: 'financial', label: 'Financeiro', icon: Wallet },
    { id: 'transactions', label: 'Movimentações', icon: ArrowDownLeft },
    { id: 'payables', label: 'Contas a pagar', icon: CreditCard },
    { id: 'receivables', label: 'Contas a receber', icon: Receipt }
  ];

  function PageHeading({ eyebrow, title, description, children }) {
    return <div className="p16-finance-heading">
      <div><span className="eyebrow muted-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
      {children}
    </div>;
  }

  function SummaryCards({ compact = false }) {
    return <div className={'p16-finance-metrics' + (compact ? ' compact' : '')}>
      <article className="p16-finance-metric prominent"><span>Resultado do período</span><strong>{money(result)}</strong><small>Entradas recebidas menos saídas pagas</small></article>
      <article className="p16-finance-metric income"><span>Entradas recebidas</span><strong>{money(incoming)}</strong><small>{monthTransactions.filter(item => item.category === 'Receita').length} recebimentos no mês</small></article>
      <article className="p16-finance-metric expense"><span>Saídas pagas</span><strong>{money(outgoing)}</strong><small>{monthTransactions.filter(item => item.category === 'Despesa').length} pagamentos no mês</small></article>
    </div>;
  }

  function PayablesList({ limit }) {
    const items = openPayables.slice().sort((a, b) => dateIso(a.dueDate).localeCompare(dateIso(b.dueDate)));
    const visible = typeof limit === 'number' ? items.slice(0, limit) : items;
    return visible.length ? <div className="p16-finance-list">
      {visible.map(item => <article className="p16-finance-list-row" key={item.id}>
        <div><strong>{item.description}</strong><span>{item.category} · Vence {dateLabel(item.dueDate)}</span>
        <small className={dateIso(item.dueDate) < currentDate() ? 'overdue' : ''}>{dateIso(item.dueDate) < currentDate() ? 'Vencida · em aberto' : 'Em aberto'}</small></div>
        <strong className="p16-finance-value expense">{money(item.amount)}</strong>
        <div className="p16-finance-row-actions"><button type="button" onClick={() => markPayablePaid(item)}>Marcar como paga</button><button type="button" className="danger" onClick={() => removePayable(item)}>Excluir</button></div>
      </article>)}
    </div> : <div className="p16-finance-empty">Nenhuma conta pendente.</div>;
  }

  function ReceivablesList({ limit }) {
    const items = receivables.slice().sort((a, b) => dateIso(a.date).localeCompare(dateIso(b.date)));
    const visible = typeof limit === 'number' ? items.slice(0, limit) : items;
    return visible.length ? <div className="p16-finance-list">
      {visible.map(item => <article className="p16-finance-list-row" key={item.id}>
        <div><strong>{item.client || item.description || 'Cliente não informado'}</strong><span>{item.service || 'Recebimento pendente'} · Previsto {dateLabel(item.date)}</span>
        <small>Valor em aberto</small></div>
        <strong className="p16-finance-value income">{money(item.balance)}</strong>
        <div className="p16-finance-row-actions"><label>Recebimento<select value={receivableMethod[item.id] || 'Pix'} onChange={event => setReceivableMethod(previous => ({ ...previous, [item.id]: event.target.value }))}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option></select></label><button type="button" onClick={() => receiveBalance(item)}>Registrar</button></div>
      </article>)}
    </div> : <div className="p16-finance-empty">Nenhum valor pendente de recebimento.</div>;
  }

  function MovementList({ items, limit }) {
    const visible = typeof limit === 'number' ? items.slice(0, limit) : items;
    return visible.length ? <div className="p16-finance-list">
      {visible.map(item => <article className="p16-finance-movement" key={item.id}>
        <span className={'p16-finance-movement-icon ' + (item.category === 'Receita' ? 'income' : 'expense')}>{item.category === 'Receita' ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span>
        <div><strong>{item.description}</strong><span>{item.detailCategory || item.category} · {dateLabel(item.date)} · {item.paymentMethod || 'Forma não informada'}</span></div>
        <strong className={'p16-finance-value ' + (item.category === 'Receita' ? 'income' : 'expense')}>{item.category === 'Receita' ? '+' : '−'} {money(item.value)}</strong>
      </article>)}
    </div> : <div className="p16-finance-empty">Nenhuma movimentação neste período.</div>;
  }

  return <div className={'finance-experience ' + (isBurger ? 'p16-finance' : 'p18-finance')}>
    <PageHeading eyebrow={isBurger ? 'CONTROLE FINANCEIRO' : 'CONTROLE DO ESTÚDIO'} title="Financeiro"
      description={isBurger ? 'Acompanhe o caixa, os vencimentos e as movimentações da operação.' : 'Acompanhe entradas, saídas e valores pendentes do negócio.'}>
      <label className="finance-month-picker">Mês de referência<input type="month" value={month} onChange={event => setMonth(event.target.value)}/></label>
    </PageHeading>

    {isBurger ? <>
      <nav className="p16-finance-tabs" aria-label="Áreas do financeiro">
        {tabs.map(item => { const Icon = item.icon; return <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={15}/><span>{item.label}</span></button>; })}
      </nav>
      {tab === 'summary' && <>
        <SummaryCards/>
        <div className="p16-finance-columns">
          <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Últimas movimentações</h3><p>{month.split('-').reverse().join('/')}</p></div><button className="text-action" type="button" onClick={() => setTab('transactions')}>Ver todas <ArrowDownLeft size={14}/></button></div><MovementList items={movementItems} limit={5}/></section>
          <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Ações rápidas</h3><p>Atalhos para as tarefas financeiras.</p></div></div>
            <button className="p16-finance-quick" type="button" onClick={() => { setTab('transactions'); setMovementFormOpen(true); }}><Plus size={16}/><span><strong>Nova movimentação</strong><small>Registrar entrada ou saída</small></span><ChevronDown size={15}/></button>
            <button className="p16-finance-quick" type="button" onClick={() => { setTab('payables'); setShowPayableForm(true); }}><CalendarDays size={16}/><span><strong>Adicionar conta a pagar</strong><small>Registrar um vencimento</small></span><ChevronDown size={15}/></button>
            <button className="p16-finance-quick" type="button" onClick={() => { setTab('receivables'); setShowReceivableForm(true); }}><Receipt size={16}/><span><strong>Adicionar valor a receber</strong><small>Controlar um recebimento futuro</small></span><ChevronDown size={15}/></button>
          </section>
        </div>
      </>}

      {tab === 'financial' && <>
        <section className="panel table-panel p16-finance-panel">
          <div className="p16-finance-equation-heading"><h3>Resultado de {month.split('-').reverse().join('/')}</h3><span>Valores efetivados</span></div>
          <div className="p16-finance-equation">
            <div><span>Entradas recebidas</span><strong className="income">{money(incoming)}</strong></div><b>−</b>
            <div><span>Saídas pagas</span><strong className="expense">{money(outgoing)}</strong></div><b>=</b>
            <div className="total"><span>Resultado do período</span><strong>{money(result)}</strong></div>
          </div>
          <p className="p16-finance-footnote">O resultado considera apenas entradas recebidas e saídas pagas. Contas pendentes ficam separadas e não alteram o caixa.</p>
        </section>
        {(overduePayables.length || overdueReceivables.length) ? <section className="panel table-panel p16-finance-panel">
          <div className="panel-heading"><div><h3><AlertTriangle size={16}/> Atenção aos vencimentos</h3><p>Valores pendentes com data anterior a hoje.</p></div></div>
          <div className="p16-finance-attention"><div><strong>{overduePayables.length}</strong><span>Contas vencidas</span><small>{money(overduePayables.reduce((sum,item)=>sum+Number(item.amount||0),0))} a pagar</small></div><div><strong>{overdueReceivables.length}</strong><span>Recebimentos vencidos</span><small>{money(overdueReceivables.reduce((sum,item)=>sum+Number(item.balance||0),0))} a receber</small></div></div>
        </section> : null}
        <div className="p16-finance-columns">
          <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Contas a pagar</h3><p>{openPayables.length} pendentes</p></div><strong className="p16-finance-value expense">{money(pendingPayables)}</strong></div><PayablesList limit={4}/><button className="p16-finance-secondary" type="button" onClick={() => setTab('payables')}>Ver todas as contas <ArrowDownLeft size={14}/></button></section>
          <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Valores a receber</h3><p>{receivables.length} pendentes</p></div><strong className="p16-finance-value income">{money(pendingReceivables)}</strong></div><ReceivablesList limit={4}/><button className="p16-finance-secondary" type="button" onClick={() => setTab('receivables')}>Ver todos os valores <ArrowDownLeft size={14}/></button></section>
        </div>
        <div className="p16-finance-columns">
          <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Movimentações por categoria</h3><p>Entradas e saídas do mês.</p></div></div>{categoryTotals.length ? <div className="p16-finance-category-list">{categoryTotals.map(([name,value])=><div key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}</div> : <div className="p16-finance-empty">Sem categorias neste período.</div>}</section>
          <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Formas de pagamento</h3><p>Movimentações registradas no período.</p></div></div>{paymentTotals.length ? <div className="p16-finance-payment-list">{paymentTotals.map(([name,value])=><div key={name}><span><strong>{name}</strong><small>{value.count} movimentações</small></span><strong>{money(value.income + value.expense)}</strong></div>)}</div> : <div className="p16-finance-empty">Sem formas de pagamento neste período.</div>}</section>
        </div>
        <section className="panel table-panel p16-finance-panel"><div className="panel-heading"><div><h3>Movimentações do período</h3><p>Entradas e saídas efetivadas no caixa.</p></div><button className="text-action" type="button" onClick={() => setTab('transactions')}>Abrir todas <ArrowDownLeft size={14}/></button></div><MovementList items={movementItems} limit={8}/></section>
      </>}

      {tab === 'transactions' && <section className="panel table-panel p16-finance-panel">
        <div className="panel-heading"><div><h3>Movimentações</h3><p>Consulte e registre entradas e saídas efetivas do caixa.</p></div><button className="primary-button" type="button" onClick={() => setMovementFormOpen(value=>!value)}><Plus size={15}/>{movementFormOpen ? 'Fechar' : 'Nova movimentação'}</button></div>
        <div className="p16-finance-filter-row"><label className="p16-finance-search"><Search size={16}/><input value={movementSearch} onChange={event=>setMovementSearch(event.target.value)} placeholder="Buscar movimentação..."/></label><select value={directionFilter} onChange={event=>setDirectionFilter(event.target.value)}><option value="all">Todas</option><option value="income">Entradas</option><option value="expense">Saídas</option></select></div>
        {movementFormOpen && <MovementForm/>}
        <MovementList items={searchedMovements}/>
      </section>}

      {tab === 'payables' && <section className="panel table-panel p16-finance-panel">
        <div className="panel-heading"><div><h3>Contas a pagar</h3><p>Organize vencimentos e registre os pagamentos.</p></div><button className="primary-button" type="button" onClick={()=>setShowPayableForm(value=>!value)}><Plus size={15}/>{showPayableForm ? 'Fechar' : 'Cadastrar conta'}</button></div>
        {showPayableForm && <PayableForm/>}<PayablesList/>
      </section>}

      {tab === 'receivables' && <section className="panel table-panel p16-finance-panel">
        <div className="panel-heading"><div><h3>Contas a receber</h3><p>Acompanhe valores pendentes e registre os recebimentos.</p></div><button className="primary-button" type="button" onClick={()=>setShowReceivableForm(value=>!value)}><Plus size={15}/>{showReceivableForm ? 'Fechar' : 'Adicionar valor'}</button></div>
        {showReceivableForm && <ReceivableForm/>}<ReceivablesList/>
      </section>}
      <div className="p16-finance-footer"><span>Controle demonstrativo · sem integração bancária ou gravação permanente.</span><button type="button" onClick={restoreExamples}><RefreshCw size={14}/> Restaurar exemplos</button></div>
    </> : <>
      <div className="p18-finance-intro"><Wallet size={18}/><p>O financeiro acompanha os valores que já entraram e o que ainda falta receber. As alterações desta prévia são demonstrativas e não substituem o controle real do sistema.</p></div>
      <div className="p18-finance-summary-grid">
        <article className="p18-finance-card income"><span><TrendingUp size={16}/> Entradas do mês</span><strong>{money(incoming)}</strong><small>{monthTransactions.filter(item=>item.category==='Receita').length} movimentações</small></article>
        <article className="p18-finance-card expense"><span><TrendingDown size={16}/> Saídas do mês</span><strong>{money(outgoing)}</strong><small>{monthTransactions.filter(item=>item.category==='Despesa').length} movimentações</small></article>
        <article className={'p18-finance-card balance ' + (result<0?'negative':'')}><span><Wallet size={16}/> Resultado do mês</span><strong>{money(result)}</strong><small>Entradas menos saídas registradas</small></article>
        <article className="p18-finance-card receivable"><span><Receipt size={16}/> Valores a receber</span><strong>{money(pendingReceivables)}</strong><small>{receivables.length} atendimentos pendentes</small></article>
        <article className="p18-finance-card due"><span><CreditCard size={16}/> Contas a pagar</span><strong>{money(pendingPayables)}</strong><small>{openPayables.length} contas em aberto</small></article>
      </div>

      <section className="panel table-panel p18-finance-section">
        <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">ATENDIMENTOS</span><h3>Valores a receber</h3><p>Consulte os saldos pendentes e registre quando o valor for recebido.</p></div><button type="button" className="p18-finance-toggle" onClick={()=>setShowReceivables(value=>!value)}>{showReceivables?'Ocultar lista':'Ver atendimentos'} ({receivables.length}) <ChevronDown size={15}/></button></div>
        {showReceivables && <ReceivablesList/>}
        {!showReceivables && !receivables.length && <div className="p18-finance-empty">Nenhum valor pendente neste momento.</div>}
      </section>

      <div className="p18-finance-forms-grid">
        <section className="panel table-panel p18-finance-section">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">MOVIMENTAÇÃO</span><h3>Registrar entrada ou saída</h3></div><span className="p18-finance-mark"><Wallet size={18}/></span></div>
          <button type="button" className="p18-finance-toggle full" onClick={()=>setShowEntryForm(value=>!value)}>{showEntryForm?'Fechar formulário':'Registrar movimentação'} <ChevronDown size={15}/></button>
          {showEntryForm && <MovementForm/>}
          <p className="p18-finance-footnote">Use para recebimentos e despesas que ainda não foram registrados automaticamente.</p>
        </section>

        <section className="panel table-panel p18-finance-section">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">ORGANIZAÇÃO</span><h3>Contas a pagar</h3></div><span className="count-chip">{payables.length}</span></div>
          <button type="button" className="p18-finance-toggle full" onClick={()=>setShowPayableForm(value=>!value)}>{showPayableForm?'Fechar formulário':'Cadastrar conta'} <ChevronDown size={15}/></button>
          {showPayableForm && <PayableForm/>}
          <button type="button" className="p18-finance-toggle full secondary" onClick={()=>setShowPayables(value=>!value)}>{showPayables?'Ocultar contas':'Consultar contas ('+payables.length+')'} <ChevronDown size={15}/></button>
          {showPayables && <PayablesList/>}
        </section>
      </div>

      <section className="panel table-panel p18-finance-section">
        <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">RESUMO DE CAIXA</span><h3>Movimentações de {month.split('-').reverse().join('/')}</h3></div><span className="count-chip">{movementCount}</span></div>
        <MovementList items={movementItems.slice(0, showAllMovements ? movementItems.length : 5)}/>
        {movementItems.length>5 && <button type="button" className="p18-finance-toggle full secondary" onClick={()=>setShowAllMovements(value=>!value)}>{showAllMovements?'Mostrar só as 5 mais recentes':'Ver todas as movimentações ('+movementItems.length+')'} <ChevronDown size={15}/></button>}
      </section>
      <div className="p18-finance-footnote bottom">Prévia demonstrativa, sem integração bancária e sem persistência. Recebimentos e pagamentos são refletidos apenas nos dados fictícios desta sessão.</div>
    </>}
  </div>;

  function MovementForm() {
    return <form className="p18-finance-form" onSubmit={addMovement}>
      <label>Tipo de movimentação<select value={direction} onChange={event=>setDirection(event.target.value)}><option value="income">Entrada de dinheiro</option><option value="expense">Saída de dinheiro</option></select></label>
      <label>Descrição<input value={description} onChange={event=>setDescription(event.target.value)} minLength={2} maxLength={120} placeholder={direction==='income'?'Ex.: serviço realizado':'Ex.: compra de materiais'} required/></label>
      <div className="p18-finance-fields"><label>Categoria<input value={category} onChange={event=>setCategory(event.target.value)} placeholder="Ex.: Atendimento / Estrutura" required/></label><label>Valor (R$)<input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0,00" required/></label></div>
      <div className="p18-finance-fields"><label>Data<input type="date" value={movementDate} onChange={event=>setMovementDate(event.target.value)} required/></label><label>Forma de recebimento/pagamento<select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option><option>Outro</option></select></label></div>
      <div className="p18-finance-form-actions"><button className="primary-button" type="submit"><Plus size={15}/> Registrar lançamento</button><button className="secondary-button" type="button" onClick={()=>setShowEntryForm(false)}>Cancelar</button></div>
    </form>;
  }

  function PayableForm() {
    return <form className="p18-finance-form" onSubmit={addPayable}>
      <label>Descrição<input value={payableDescription} onChange={event=>setPayableDescription(event.target.value)} minLength={2} maxLength={120} placeholder="Ex.: aluguel / reposição de materiais" required/></label>
      <div className="p18-finance-fields"><label>Categoria<input value={payableCategory} onChange={event=>setPayableCategory(event.target.value)} required/></label><label>Valor (R$)<input inputMode="decimal" value={payableAmount} onChange={event=>setPayableAmount(event.target.value)} placeholder="0,00" required/></label></div>
      <label>Vencimento<input type="date" value={payableDate} onChange={event=>setPayableDate(event.target.value)} required/></label>
      <div className="p18-finance-form-actions"><button className="primary-button" type="submit"><Plus size={15}/> Cadastrar conta</button><button className="secondary-button" type="button" onClick={()=>setShowPayableForm(false)}>Cancelar</button></div>
    </form>;
  }

  function ReceivableForm() {
    return <form className="p18-finance-form" onSubmit={addReceivable}>
      <label>Descrição<input value={receivableDescription} onChange={event=>setReceivableDescription(event.target.value)} placeholder="Ex.: Pedido delivery" required/></label>
      <label>Cliente / origem<input value={receivableCounterparty} onChange={event=>setReceivableCounterparty(event.target.value)} placeholder="Ex.: Pedido #006 / balcão"/></label>
      <div className="p18-finance-fields"><label>Valor (R$)<input inputMode="decimal" value={receivableAmount} onChange={event=>setReceivableAmount(event.target.value)} placeholder="0,00" required/></label><label>Previsão<input type="date" value={receivableDate} onChange={event=>setReceivableDate(event.target.value)} required/></label></div>
      <div className="p18-finance-form-actions"><button className="primary-button" type="submit"><Plus size={15}/> Adicionar valor</button><button className="secondary-button" type="button" onClick={()=>setShowReceivableForm(false)}>Cancelar</button></div>
    </form>;
  }
}
