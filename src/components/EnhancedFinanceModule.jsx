import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, CreditCard, Plus, ReceiptText, RefreshCw, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';

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
  if (/^\\d{4}-\\d{2}/.test(value || '')) return value.slice(0, 7);
  const currentMonth = currentDate().slice(0, 7);
  if (value === 'Hoje' || value === 'Ontem') return currentMonth;
  const match = String(value || '').match(/^(\\d{1,2})\\s+([a-z]{3})\\.?$/i);
  if (match) {
    const months = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
    const month = months[match[2].toLowerCase()];
    if (month) return String(new Date().getFullYear()) + '-' + String(month).padStart(2, '0');
  }
  return currentMonth;
}

const TABS = [
  { id: 'summary', label: 'Resumo', icon: Wallet },
  { id: 'income', label: 'Entradas', icon: TrendingUp },
  { id: 'expense', label: 'Saídas', icon: TrendingDown },
  { id: 'receivables', label: 'Valores a receber', icon: ReceiptText },
  { id: 'payables', label: 'Contas a pagar', icon: CreditCard }
];

export default function EnhancedFinanceModule({ transactions, setTransactions, payables, setPayables, receivables, setReceivables, resetTransactions, resetFinance, notify }) {
  const [tab, setTab] = useState('summary');
  const [month, setMonth] = useState(currentDate().slice(0, 7));
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Atendimento');
  const [amount, setAmount] = useState('');
  const [movementDate, setMovementDate] = useState(currentDate());
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [payableDescription, setPayableDescription] = useState('');
  const [payableCategory, setPayableCategory] = useState('Despesas do negócio');
  const [payableAmount, setPayableAmount] = useState('');
  const [payableDate, setPayableDate] = useState(currentDate());
  const [receivableMethod, setReceivableMethod] = useState({});

  const monthTransactions = useMemo(() => transactions.filter(item => movementMonth(item.date) === month), [transactions, month]);
  const incoming = monthTransactions.filter(item => item.category === 'Receita').reduce((sum, item) => sum + Number(item.value || 0), 0);
  const outgoing = monthTransactions.filter(item => item.category === 'Despesa').reduce((sum, item) => sum + Number(item.value || 0), 0);
  const pendingReceivables = receivables.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const pendingPayables = payables.filter(item => item.status !== 'Paga').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const visibleTransactions = monthTransactions.filter(item => tab === 'income' ? item.category === 'Receita' : tab === 'expense' ? item.category === 'Despesa' : true).slice().reverse();

  function addEntry(event) {
    event.preventDefault();
    const numeric = Number(String(amount).replace(',', '.'));
    if (!description.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      notify('Informe uma descrição e um valor válido.');
      return;
    }
    setTransactions(previous => [{ id: Date.now(), description: description.trim(), category: tab === 'expense' ? 'Despesa' : category === 'Despesa' ? 'Despesa' : 'Receita', date: movementDate, value: Math.round(numeric * 100) / 100, paymentMethod, source: 'Manual' }, ...previous]);
    setDescription('');
    setAmount('');
    setShowEntryForm(false);
    notify('Movimentação fictícia registrada.');
  }

  function addPayable(event) {
    event.preventDefault();
    const numeric = Number(String(payableAmount).replace(',', '.'));
    if (!payableDescription.trim() || !Number.isFinite(numeric) || numeric <= 0 || !payableDate) {
      notify('Preencha a descrição, o valor e o vencimento.');
      return;
    }
    setPayables(previous => [{ id: Date.now(), description: payableDescription.trim(), category: payableCategory.trim() || 'Outros', amount: Math.round(numeric * 100) / 100, dueDate: payableDate, status: 'Em aberto' }, ...previous]);
    setPayableDescription('');
    setPayableAmount('');
    setShowPayableForm(false);
    notify('Conta fictícia adicionada.');
  }

  function markPayablePaid(item) {
    if (item.status === 'Paga') return;
    setPayables(previous => previous.map(payable => payable.id === item.id ? { ...payable, status: 'Paga', paidAt: currentDate() } : payable));
    setTransactions(previous => [{ id: Date.now(), description: item.description, category: 'Despesa', date: currentDate(), value: item.amount, paymentMethod: 'Não informado', source: 'Conta a pagar' }, ...previous]);
    notify('Conta marcada como paga e saída registrada.');
  }

  function receiveBalance(item) {
    const method = receivableMethod[item.id] || 'Pix';
    setTransactions(previous => [{ id: Date.now(), description: 'Recebimento de ' + item.client + ' · ' + item.service, category: 'Receita', date: currentDate(), value: item.balance, paymentMethod: method, source: 'Atendimento' }, ...previous]);
    setReceivables(previous => previous.filter(receivable => receivable.id !== item.id));
    notify('Recebimento registrado nas entradas.');
  }

  function restoreExamples() {
    if (resetFinance) resetFinance();
    else resetTransactions();
    notify('Exemplos financeiros restaurados.');
  }

  return <>
    <section className="finance-demo-header">
      <div><span className="eyebrow muted-eyebrow">CONTROLE FINANCEIRO</span><h2>Organize as movimentações do negócio.</h2><p>Acompanhe o que entrou, o que saiu, os valores pendentes e o resultado do mês em um só lugar.</p></div>
      <label className="finance-month-picker">Mês de referência<input type="month" value={month} onChange={event => setMonth(event.target.value)}/></label>
    </section>

    <div className="finance-summary-grid finance-demo-summary">
      <article className="finance-summary-card income"><span><TrendingUp size={17}/> Entradas do mês</span><strong>{money(incoming)}</strong><small>{monthTransactions.filter(item => item.category === 'Receita').length} movimentações</small></article>
      <article className="finance-summary-card expense"><span><TrendingDown size={17}/> Saídas do mês</span><strong>{money(outgoing)}</strong><small>{monthTransactions.filter(item => item.category === 'Despesa').length} movimentações</small></article>
      <article className={'finance-summary-card balance' + (incoming - outgoing < 0 ? ' negative' : '')}><span><Wallet size={17}/> Resultado do mês</span><strong>{money(incoming - outgoing)}</strong><small>Entradas menos saídas registradas</small></article>
      <article className="finance-summary-card receivable"><span><ReceiptText size={17}/> Valores a receber</span><strong>{money(pendingReceivables)}</strong><small>{receivables.length} atendimentos pendentes</small></article>
      <article className="finance-summary-card due"><span><CreditCard size={17}/> Contas a pagar</span><strong>{money(pendingPayables)}</strong><small>{payables.filter(item => item.status !== 'Paga').length} contas em aberto</small></article>
    </div>

    <nav className="finance-demo-tabs" aria-label="Áreas do financeiro">
      {TABS.map(item => {
        const Icon = item.icon;
        return <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setShowEntryForm(false); setShowPayableForm(false); }}><Icon size={15}/><span>{item.label}</span></button>;
      })}
    </nav>

    {tab === 'summary' && <>
      <section className="panel table-panel finance-demo-panel">
        <div className="panel-heading"><div><h3>Resultado do mês</h3><p>Visão consolidada das movimentações selecionadas.</p></div><span className="date-chip"><CalendarDays size={14}/>{month.split('-').reverse().join('/')}</span></div>
        <div className="finance-result-breakdown">
          <div><span>Entradas registradas</span><strong className="positive">{money(incoming)}</strong></div>
          <div><span>Saídas registradas</span><strong className="negative">− {money(outgoing)}</strong></div>
          <div className="finance-result-total"><span>Resultado</span><strong>{money(incoming - outgoing)}</strong></div>
        </div>
      </section>
      <section className="panel table-panel finance-demo-panel">
        <div className="panel-heading"><div><h3>Movimentações recentes</h3><p>Últimas entradas e saídas registradas na demonstração.</p></div><button className="text-action" type="button" onClick={() => setTab('income')}>Ver entradas e saídas <ChevronDown size={14}/></button></div>
        <MovementList items={monthTransactions.slice().reverse().slice(0, 5)}/>
      </section>
    </>}

    {(tab === 'income' || tab === 'expense') && <section className="panel table-panel finance-demo-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">{tab === 'income' ? 'DINHEIRO QUE ENTROU' : 'DINHEIRO QUE SAIU'}</span><h3>{tab === 'income' ? 'Entradas' : 'Saídas'}</h3><p>{tab === 'income' ? 'Recebimentos confirmados e lançamentos de receita.' : 'Despesas já pagas e saídas registradas.'}</p></div><button className="primary-button" type="button" onClick={() => { setShowEntryForm(value => !value); setCategory(tab === 'income' ? 'Receita' : 'Despesa'); }}><Plus size={15}/>{showEntryForm ? 'Fechar' : tab === 'income' ? 'Registrar entrada' : 'Registrar saída'}</button></div>
      {showEntryForm && <form className="finance-form finance-demo-form" onSubmit={addEntry}>
        <label>Descrição<input value={description} onChange={event => setDescription(event.target.value)} minLength={2} maxLength={120} required placeholder={tab === 'income' ? 'Ex.: serviço realizado' : 'Ex.: compra de materiais'}/></label>
        <div className="finance-fields-two"><label>Categoria<input value={category === 'Receita' || category === 'Despesa' ? '' : category} onChange={event => setCategory(event.target.value || (tab === 'income' ? 'Receita' : 'Despesa'))} placeholder="Ex.: Atendimento / Estrutura"/></label><label>Valor (R$)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required placeholder="0,00"/></label></div>
        <div className="finance-fields-two"><label>Data<input type="date" value={movementDate} onChange={event => setMovementDate(event.target.value)} required/></label><label>Forma de recebimento/pagamento<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option><option>Outro</option></select></label></div>
        <div className="finance-demo-form-actions"><button className="primary-button" type="submit">Registrar {tab === 'income' ? 'entrada' : 'saída'}</button><button className="secondary-button" type="button" onClick={() => setShowEntryForm(false)}>Cancelar</button></div>
      </form>}
      <MovementList items={visibleTransactions}/>
      <div className="table-foot"><span>Valores demonstrativos · não representam movimentações bancárias reais.</span></div>
    </section>}

    {tab === 'receivables' && <section className="panel table-panel finance-demo-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">ATENDIMENTOS</span><h3>Valores a receber</h3><p>Consulte os saldos pendentes e registre quando o valor for recebido.</p></div><span className="count-chip">{receivables.length} pendentes</span></div>
      {receivables.length ? <div className="finance-demo-receivables">{receivables.map(item => <article className="finance-demo-receivable" key={item.id}>
        <div><strong>{item.client}</strong><span>{item.service} · {dateLabel(item.date)}</span><small>Total {money(item.total)} · Já recebido {money(item.received)}</small></div>
        <div className="finance-demo-receivable-balance"><small>Restante</small><strong>{money(item.balance)}</strong></div>
        <div className="finance-demo-receive-actions"><label>Forma de recebimento<select value={receivableMethod[item.id] || 'Pix'} onChange={event => setReceivableMethod(previous => ({ ...previous, [item.id]: event.target.value }))}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option></select></label><button type="button" className="primary-button" onClick={() => receiveBalance(item)}><CheckCircle2 size={15}/> Registrar recebimento</button></div>
      </article>)}</div> : <div className="empty-table"><CheckCircle2 size={24}/><strong>Nenhum valor pendente</strong><span>Quando houver saldo de atendimento a receber, ele aparecerá aqui.</span></div>}
    </section>}

    {tab === 'payables' && <section className="panel table-panel finance-demo-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">ORGANIZAÇÃO</span><h3>Contas a pagar</h3><p>Cadastre despesas futuras e marque cada conta como paga quando concluir o pagamento.</p></div><button className="primary-button" type="button" onClick={() => setShowPayableForm(value => !value)}><Plus size={15}/>{showPayableForm ? 'Fechar' : 'Cadastrar conta'}</button></div>
      {showPayableForm && <form className="finance-form finance-demo-form" onSubmit={addPayable}>
        <label>Descrição<input value={payableDescription} onChange={event => setPayableDescription(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: aluguel do espaço"/></label>
        <div className="finance-fields-two"><label>Categoria<input value={payableCategory} onChange={event => setPayableCategory(event.target.value)} required placeholder="Ex.: Estrutura"/></label><label>Valor (R$)<input inputMode="decimal" value={payableAmount} onChange={event => setPayableAmount(event.target.value)} required placeholder="0,00"/></label></div>
        <label>Vencimento<input type="date" value={payableDate} onChange={event => setPayableDate(event.target.value)} required/></label>
        <div className="finance-demo-form-actions"><button className="primary-button" type="submit">Cadastrar conta</button><button className="secondary-button" type="button" onClick={() => setShowPayableForm(false)}>Cancelar</button></div>
        <p className="finance-footnote">Uma conta só vira saída no financeiro quando for marcada como paga.</p>
      </form>}
      {payables.length ? <div className="finance-demo-payables">{payables.slice().sort((a, b) => (a.status === b.status ? String(a.dueDate).localeCompare(String(b.dueDate)) : a.status === 'Em aberto' ? -1 : 1)).map(item => <article className="finance-demo-payable" key={item.id}>
        <div><strong>{item.description}</strong><span>{item.category} · Vence {dateLabel(item.dueDate)}</span><small className={item.status === 'Paga' ? 'is-paid' : ''}>{item.status}</small></div>
        <strong className="finance-payable-amount">{money(item.amount)}</strong>
        <div className="finance-demo-payable-actions">{item.status === 'Em aberto' ? <button type="button" className="button button-outline button-small" onClick={() => markPayablePaid(item)}>Marcar como paga</button> : <span className="finance-paid-date">Paga em {dateLabel(item.paidAt)}</span>}</div>
      </article>)}</div> : <div className="empty-table"><CreditCard size={24}/><strong>Nenhuma conta cadastrada</strong><span>Cadastre despesas que precisam ser pagas.</span></div>}
    </section>}

    <div className="table-foot finance-demo-foot"><span>Controle ilustrativo, sem integração bancária ou gravação permanente.</span><button className="text-action" type="button" onClick={restoreExamples}><RefreshCw size={14}/> Restaurar exemplos</button></div>
  </>;
}

function MovementList({ items }) {
  return items.length ? <div className="finance-demo-movements">
    {items.map(item => <article className="finance-demo-movement" key={item.id}>
      <span className={'finance-entry-icon ' + (item.category === 'Receita' ? 'income' : 'expense')}>{item.category === 'Receita' ? <TrendingUp size={17}/> : <TrendingDown size={17}/>}</span>
      <div><strong>{item.description}</strong><span>{item.category} · {dateLabel(item.date)}</span><small>{item.source || item.paymentMethod || 'Lançamento demonstrativo'}</small></div>
      <strong className={'finance-entry-amount ' + (item.category === 'Receita' ? 'income' : 'expense')}>{item.category === 'Receita' ? '+' : '−'} {money(item.value)}</strong>
    </article>)}
  </div> : <div className="empty-table"><ReceiptText size={24}/><strong>Nenhuma movimentação neste período</strong><span>Os registros aparecerão aqui quando uma entrada ou saída for adicionada.</span></div>;
}
