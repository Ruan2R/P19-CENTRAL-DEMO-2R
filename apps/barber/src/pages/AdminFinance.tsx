import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiDelete, apiGet, apiPost } from '../lib/api'

type FinancialEntry = { id: string; direction: 'income' | 'expense'; description: string; category: string; amountCents: number; movementDate: string; paymentMethod: string; sourceType: 'manual' | 'payable_payment' | 'booking_receipt'; sourceId: string | null; createdAt: string }
type Payable = { id: string; description: string; category: string; amountCents: number; dueDate: string; status: 'pending' | 'paid'; paidAt: string | null; expenseEntryId: string | null; createdAt: string }
type Receivable = { id: string; publicCode: string; date: string; customerName: string; itemSummary: string; totalPriceCents: number; status: 'confirmed' | 'completed'; endsAt: string | null }
type FinanceData = { month: string; entries: FinancialEntry[]; payables: Payable[]; receivables: Receivable[] }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const paymentMethods = ['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro']
function todayLocal() { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value])); return `${parts.year}-${parts.month}-${parts.day}` }
function dateLabel(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) }
function toCents(value: string) { return Math.round(Number(String(value).trim().replace(',', '.')) * 100) }

export default function AdminFinance({ onNotice }: { onNotice: (message: string) => void }) {
  const [month, setMonth] = useState(todayLocal().slice(0, 7))
  const [data, setData] = useState<FinanceData>({ month: todayLocal().slice(0, 7), entries: [], payables: [], receivables: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [showReceivables, setShowReceivables] = useState(false)
  const [showPayablesList, setShowPayablesList] = useState(false)
  const [showEntriesList, setShowEntriesList] = useState(false)
  const [direction, setDirection] = useState<'income' | 'expense'>('income')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Atendimento')
  const [amount, setAmount] = useState('')
  const [movementDate, setMovementDate] = useState(todayLocal())
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [showPayableForm, setShowPayableForm] = useState(false)
  const [payableDescription, setPayableDescription] = useState('')
  const [payableCategory, setPayableCategory] = useState('Despesas da barbearia')
  const [payableAmount, setPayableAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayLocal())
  const [showAllEntries, setShowAllEntries] = useState(false)
  const [showAllPayables, setShowAllPayables] = useState(false)
  const [receiptMethods, setReceiptMethods] = useState<Record<string, string>>({})

  async function loadFinance(showSpinner = true) {
    if (showSpinner) setLoading(true)
    setError('')
    try { setData(await apiGet<FinanceData>(`/api/admin/finance?month=${encodeURIComponent(month)}`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o financeiro.') }
    finally { if (showSpinner) setLoading(false) }
  }
  useEffect(() => {
    void loadFinance()
    const timer = window.setInterval(() => { void loadFinance(false) }, 30_000)
    return () => window.clearInterval(timer)
  }, [month])

  const incoming = useMemo(() => data.entries.filter((entry) => entry.direction === 'income').reduce((sum, entry) => sum + entry.amountCents, 0), [data.entries])
  const outgoing = useMemo(() => data.entries.filter((entry) => entry.direction === 'expense').reduce((sum, entry) => sum + entry.amountCents, 0), [data.entries])
  const openPayables = data.payables.filter((payable) => payable.status === 'pending')
  const pendingPayables = openPayables.reduce((sum, payable) => sum + payable.amountCents, 0)
  const pendingReceivables = (data.receivables ?? []).reduce((sum, booking) => sum + booking.totalPriceCents, 0)
  const today = todayLocal()

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await apiPost('/api/admin/finance/entries', { direction, description: description.trim(), category: category.trim(), amountCents: toCents(amount), movementDate, paymentMethod })
      setDescription(''); setAmount(''); setShowEntryForm(false); setShowEntriesList(true)
      onNotice(direction === 'income' ? 'Entrada registrada no financeiro.' : 'Saída registrada no financeiro.')
      await loadFinance()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar a movimentação.') }
    finally { setSaving(false) }
  }

  async function createPayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await apiPost('/api/admin/finance/payables', { description: payableDescription.trim(), category: payableCategory.trim(), amountCents: toCents(payableAmount), dueDate })
      setPayableDescription(''); setPayableAmount(''); setShowPayableForm(false); setShowPayablesList(true)
      onNotice('Conta a pagar cadastrada.')
      await loadFinance()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar a conta.') }
    finally { setSaving(false) }
  }

  async function markPayablePaid(payable: Payable) {
    if (!window.confirm(`Marcar “${payable.description}” como paga e registrar a saída no financeiro?`)) return
    setSaving(true); setError('')
    try {
      await apiPost(`/api/admin/finance/payables/${encodeURIComponent(payable.id)}/paid`, {})
      onNotice('Conta marcada como paga e saída registrada uma única vez.')
      setShowEntriesList(true)
      await loadFinance()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar o pagamento.') }
    finally { setSaving(false) }
  }

  async function recordBookingReceipt(booking: Receivable) {
    const method = receiptMethods[booking.id] || 'Pix'
    if (!window.confirm(`Confirmar recebimento de ${currency.format(booking.totalPriceCents / 100)} referente ao atendimento ${booking.publicCode}? Só continue se o dinheiro realmente entrou no caixa.`)) return
    setSaving(true); setError('')
    try {
      const result = await apiPost<{ alreadyReceived?: boolean }>(`/api/admin/finance/booking-groups/${encodeURIComponent(booking.id)}/receipt`, { paymentMethod: method })
      onNotice(result.alreadyReceived ? 'Esse recebimento já estava registrado; nenhuma entrada duplicada foi criada.' : 'Recebimento confirmado e entrada registrada no financeiro.')
      setShowEntriesList(true)
      setShowReceivables(false)
      await loadFinance()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar o recebimento.') }
    finally { setSaving(false) }
  }

  async function deleteEntry(entry: FinancialEntry) {
    if (!window.confirm(`Excluir a movimentação manual “${entry.description}”?`)) return
    setSaving(true); setError('')
    try { await apiDelete(`/api/admin/finance/entries/${encodeURIComponent(entry.id)}`); onNotice('Movimentação removida.'); await loadFinance() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível remover a movimentação.') }
    finally { setSaving(false) }
  }

  async function deletePayable(payable: Payable) {
    if (!window.confirm(`Excluir a conta “${payable.description}”?`)) return
    setSaving(true); setError('')
    try { await apiDelete(`/api/admin/finance/payables/${encodeURIComponent(payable.id)}`); onNotice('Conta a pagar removida.'); await loadFinance() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível remover a conta.') }
    finally { setSaving(false) }
  }

  const visibleEntries = showAllEntries ? data.entries : data.entries.slice(0, 5)
  const visiblePayables = showAllPayables ? data.payables : data.payables.slice(0, 5)

  return <section className="admin-data-page" aria-labelledby="finance-title">
    <div className="admin-page-heading finance-page-heading"><div><p className="eyebrow">CONTROLE DE CAIXA</p><h1 id="finance-title">Financeiro<span className="heading-period">.</span></h1><p>Acompanhe entradas, saídas e contas a pagar da barbearia.</p></div><label className="finance-month-picker">Mês de referência<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>
    {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
    <div className="finance-notice"><strong>Controle sem integração bancária.</strong><span>Quando um atendimento confirmado termina (ou é marcado como concluído), ele aparece em “Valores a receber”. O sistema atualiza essa lista a cada 30 segundos enquanto esta aba estiver aberta. A receita só entra no caixa quando você confirma que recebeu o pagamento.</span></div>

    <section className="finance-summary-grid" aria-label="Resumo financeiro do mês">
      <article className="finance-summary-card income"><span>Entradas do mês</span><strong>{currency.format(incoming / 100)}</strong><small>{data.entries.filter((entry) => entry.direction === 'income').length} movimentações</small></article>
      <article className="finance-summary-card expense"><span>Saídas do mês</span><strong>{currency.format(outgoing / 100)}</strong><small>{data.entries.filter((entry) => entry.direction === 'expense').length} movimentações</small></article>
      <article className="finance-summary-card receivable"><span>Valores a receber</span><strong>{currency.format(pendingReceivables / 100)}</strong><small>{(data.receivables ?? []).length} atendimentos</small></article>
      <article className="finance-summary-card due"><span>Contas a pagar</span><strong>{currency.format(pendingPayables / 100)}</strong><small>{openPayables.length} pendentes</small></article>
      <article className={`finance-summary-card balance ${(incoming - outgoing) < 0 ? 'negative' : ''}`}><span>Resultado do mês</span><strong>{currency.format((incoming - outgoing) / 100)}</strong><small>Entradas menos saídas registradas</small></article>
    </section>

    <section className="admin-data-card finance-list-card finance-receivables-card">
      <div className="admin-data-card-heading"><div><p className="eyebrow">ATENDIMENTOS FINALIZADOS</p><h2>Valores a receber</h2><p>O horário previsto ou a conclusão tornam o atendimento elegível; registre o pagamento só depois de recebê-lo.</p></div><span className="admin-count-chip">{(data.receivables ?? []).length}</span></div>
      <button className="secondary-button finance-disclosure" type="button" aria-expanded={showReceivables} aria-controls="finance-receivables-content" onClick={() => setShowReceivables((value) => !value)}>{showReceivables ? 'Ocultar atendimentos' : `Ver atendimentos (${(data.receivables ?? []).length})`}</button>
      <div id="finance-receivables-content" hidden={!showReceivables}>
        {showReceivables && (loading ? <p className="message" role="status">Verificando valores a receber...</p> : (data.receivables ?? []).length ? <div className="finance-receivables-list">{data.receivables.map((booking) => <article className="finance-receivable-row" key={booking.id}>
          <div className="finance-receivable-head"><div><strong>{booking.customerName}</strong><small>{booking.itemSummary || 'Atendimento'} · Código {booking.publicCode}</small><small>{dateLabel(booking.date)}{booking.endsAt ? ` · encerrado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' }).format(new Date(booking.endsAt))}` : ' · marcado como concluído'}</small></div><strong>{currency.format(booking.totalPriceCents / 100)}</strong></div>
          <label>Forma de recebimento<select value={receiptMethods[booking.id] || 'Pix'} onChange={(event) => setReceiptMethods((current) => ({ ...current, [booking.id]: event.target.value }))}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
          <button type="button" className="primary-button full-width" disabled={saving} onClick={() => void recordBookingReceipt(booking)}>{saving ? 'Registrando...' : 'Confirmar recebimento'}</button>
        </article>)}</div> : <div className="admin-empty-state"><strong>Nenhum valor pendente</strong><p>Atendimentos confirmados aparecem aqui quando termina o último procedimento, ou assim que forem marcados como concluídos.</p></div>)}
      </div>
    </section>

    <div className="finance-admin-columns">
      <section className="admin-data-card finance-form-card">
        <div className="admin-data-card-heading"><div><p className="eyebrow">MOVIMENTAÇÕES</p><h2>Registrar entrada ou saída</h2><p>Use para valores que já entraram ou saíram do caixa.</p></div></div>
        <button className="secondary-button finance-toggle" type="button" aria-expanded={showEntryForm} onClick={() => setShowEntryForm((value) => !value)}>{showEntryForm ? 'Fechar formulário' : '+ Nova movimentação'}</button>
        {showEntryForm && <form className="admin-data-form" onSubmit={createEntry}>
          <label>Tipo de movimentação<select value={direction} onChange={(event) => setDirection(event.target.value as 'income' | 'expense')}><option value="income">Entrada de dinheiro</option><option value="expense">Saída de dinheiro</option></select></label>
          <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} minLength={2} maxLength={120} placeholder={direction === 'income' ? 'Ex.: corte pago no balcão' : 'Ex.: compra de materiais'} required /></label>
          <div className="finance-form-grid"><label>Categoria<input value={category} onChange={(event) => setCategory(event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Atendimento" required /></label><label>Valor (R$)<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label></div>
          <div className="finance-form-grid"><label>Data<input type="date" value={movementDate} max={today} onChange={(event) => setMovementDate(event.target.value)} required /></label><label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label></div>
          <button className="primary-button full-width" type="submit" disabled={saving}>{saving ? 'Salvando...' : `Registrar ${direction === 'income' ? 'entrada' : 'saída'}`}</button>
        </form>}
      </section>

      <section className="admin-data-card finance-form-card">
        <div className="admin-data-card-heading"><div><p className="eyebrow">ORGANIZAÇÃO</p><h2>Contas a pagar</h2><p>As saídas entram no caixa quando a conta é marcada como paga.</p></div><span className="admin-count-chip">{data.payables.length}</span></div>
        <button className="secondary-button finance-toggle" type="button" aria-expanded={showPayableForm} onClick={() => setShowPayableForm((value) => !value)}>{showPayableForm ? 'Fechar formulário' : '+ Cadastrar conta'}</button>
        {showPayableForm && <form className="admin-data-form" onSubmit={createPayable}>
          <label>Descrição<input value={payableDescription} onChange={(event) => setPayableDescription(event.target.value)} minLength={2} maxLength={120} placeholder="Ex.: aluguel da barbearia" required /></label>
          <div className="finance-form-grid"><label>Categoria<input value={payableCategory} onChange={(event) => setPayableCategory(event.target.value)} minLength={2} maxLength={80} required /></label><label>Valor (R$)<input value={payableAmount} onChange={(event) => setPayableAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label></div>
          <label>Vencimento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
          <button className="primary-button full-width" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar conta'}</button>
        </form>}
        <div className="finance-payables-inline"><div className="finance-inline-heading"><strong>Contas cadastradas</strong><span>{data.payables.length}</span></div>
          <button className="secondary-button finance-disclosure" type="button" aria-expanded={showPayablesList} aria-controls="finance-payables-content" onClick={() => setShowPayablesList((value) => !value)}>{showPayablesList ? 'Ocultar contas' : `Consultar contas (${data.payables.length})`}</button>
          <div id="finance-payables-content" hidden={!showPayablesList}>
            {showPayablesList && (visiblePayables.length ? <div className="finance-payables-list">{visiblePayables.map((payable) => {
              const overdue = payable.status === 'pending' && payable.dueDate < today
              return <article className="finance-payable-row" key={payable.id}>
                <div className="finance-entry-copy"><strong>{payable.description}</strong><span>{payable.category} · Vence {dateLabel(payable.dueDate)}</span><small className={payable.status === 'paid' ? 'is-paid' : overdue ? 'is-overdue' : ''}>{payable.status === 'paid' ? `Paga${payable.paidAt ? ` em ${dateLabel(payable.paidAt.slice(0, 10))}` : ''}` : overdue ? 'Vencida · em aberto' : 'Em aberto'}</small></div>
                <strong className="finance-entry-amount expense">{currency.format(payable.amountCents / 100)}</strong>
                <div className="finance-payable-actions">{payable.status === 'pending' ? <><button type="button" className="secondary-button" disabled={saving} onClick={() => void markPayablePaid(payable)}>Marcar como paga</button><button type="button" className="finance-delete-button" disabled={saving} onClick={() => void deletePayable(payable)}>Excluir</button></> : <span className="finance-paid-lock">Saída registrada</span>}</div>
              </article>
            })}</div> : <div className="admin-empty-state"><strong>Nenhuma conta cadastrada</strong><p>Cadastre despesas futuras e marque cada conta como paga após concluir o pagamento.</p></div>)}
            {showPayablesList && data.payables.length > 5 && <button type="button" className="finance-more-button" onClick={() => setShowAllPayables((value) => !value)}>{showAllPayables ? 'Mostrar até 5 contas' : `Consultar todas as contas (${data.payables.length})`}</button>}
          </div>
        </div>
      </section>
    </div>

    <section className="admin-data-card finance-list-card">
      <div className="admin-data-card-heading"><div><p className="eyebrow">RESUMO DE CAIXA</p><h2>Movimentações de {month.split('-').reverse().join('/')}</h2><p>Consulte lançamentos registrados neste mês.</p></div><span className="admin-count-chip">{data.entries.length}</span></div>
      <button className="secondary-button finance-disclosure" type="button" aria-expanded={showEntriesList} aria-controls="finance-entries-content" onClick={() => setShowEntriesList((value) => !value)}>{showEntriesList ? 'Ocultar movimentações' : `Consultar movimentações (${data.entries.length})`}</button>
      <div id="finance-entries-content" hidden={!showEntriesList}>
        {showEntriesList && (loading ? <p className="message" role="status">Carregando movimentações...</p> : visibleEntries.length ? <div className="finance-entries-list">{visibleEntries.map((entry) => <article className="finance-entry-row" key={entry.id}>
          <span className={`finance-entry-symbol ${entry.direction}`}>{entry.direction === 'income' ? '+' : '−'}</span>
          <div className="finance-entry-copy"><strong>{entry.description}</strong><span>{entry.category} · {dateLabel(entry.movementDate)}</span><small>{entry.sourceType === 'payable_payment' ? 'Pagamento de conta a pagar' : entry.sourceType === 'booking_receipt' ? `Recebimento de atendimento · ${entry.paymentMethod}` : entry.paymentMethod}</small></div>
          <strong className={`finance-entry-amount ${entry.direction}`}>{entry.direction === 'income' ? '+' : '−'} {currency.format(entry.amountCents / 100)}</strong>
          {entry.sourceType === 'manual' && <button type="button" className="finance-delete-button" aria-label={`Excluir ${entry.description}`} disabled={saving} onClick={() => void deleteEntry(entry)}>Excluir</button>}
        </article>)}</div> : <div className="admin-empty-state"><strong>Nenhuma movimentação neste mês</strong><p>As entradas e saídas registradas aparecerão aqui.</p></div>)}
        {showEntriesList && data.entries.length > 5 && <button type="button" className="finance-more-button" onClick={() => setShowAllEntries((value) => !value)}>{showAllEntries ? 'Mostrar as 5 mais recentes' : `Ver todas as movimentações (${data.entries.length})`}</button>}
      </div>
    </section>

  </section>
}
