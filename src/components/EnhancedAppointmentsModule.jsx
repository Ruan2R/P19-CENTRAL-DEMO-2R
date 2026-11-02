import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Clock3, Printer, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';

function todayValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function appointmentDateValue(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const today = todayValue();
  if (text.toLowerCase() === 'hoje') return today;
  if (text.toLowerCase() === 'ontem') {
    const date = new Date(today + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  const match = text.match(/^(\d{1,2})\s+([a-z]{3})\.?$/i);
  if (match) {
    const months = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
    const month = months[match[2].toLowerCase()];
    if (month !== undefined) return new Date(new Date().getFullYear(), month, Number(match[1]), 12).toISOString().slice(0, 10);
  }
  return today;
}
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
function digits(value) { return String(value || '').replace(/\D/g, ''); }
function displayDate(value) {
  const date = appointmentDateValue(value);
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
const STATUS_OPTIONS = ['Aguardando', 'Aguardando sinal', 'Confirmado', 'Concluído', 'Cancelado', 'Não compareceu'];
function statusClass(status) {
  if (status === 'Confirmado' || status === 'Concluído') return 'status-green';
  if (status === 'Aguardando' || status === 'Aguardando sinal') return 'status-amber';
  if (status === 'Cancelado' || status === 'Não compareceu') return 'status-red';
  return 'status-blue';
}

export default function EnhancedAppointmentsModule({ appointments, setAppointments, openModal, resetAppointments }) {
  const [mode, setMode] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const activeFilterCount = Number(Boolean(search.trim())) + Number(status !== 'all') + Number(period !== 'any');
  const invalidRange = period === 'custom' && Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const today = todayValue();
  const nextSeven = new Date(today + 'T12:00:00');
  nextSeven.setDate(nextSeven.getDate() + 6);
  const nextSevenValue = nextSeven.toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const filtered = useMemo(() => appointments.filter(item => {
    const date = appointmentDateValue(item.date);
    if (mode === 'upcoming' && (['Concluído', 'Cancelado', 'Não compareceu'].includes(item.status) || date < today)) return false;
    if (mode === 'pending' && !['Aguardando', 'Aguardando sinal'].includes(item.status)) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (search.trim()) {
      const query = normalize(search);
      const queryDigits = digits(search);
      const combined = normalize([item.client, item.contact, item.phone, item.service, item.professional].filter(Boolean).join(' '));
      const byText = combined.includes(query);
      const byPhone = queryDigits.length > 0 && digits(item.contact || item.phone).includes(queryDigits);
      if (!byText && !byPhone) return false;
    }
    if (period === 'today' && date !== today) return false;
    if (period === 'next7' && (date < today || date > nextSevenValue)) return false;
    if (period === 'month' && !date.startsWith(currentMonth)) return false;
    if (period === 'custom' && ((dateFrom && date < dateFrom) || (dateTo && date > dateTo))) return false;
    return true;
  }).slice().sort((a, b) => appointmentDateValue(a.date).localeCompare(appointmentDateValue(b.date)) || String(a.time).localeCompare(String(b.time))), [appointments, mode, search, status, period, dateFrom, dateTo, today, nextSevenValue, currentMonth]);

  function updateStatus(id, nextStatus) {
    setAppointments(previous => previous.map(item => item.id === id ? { ...item, status: nextStatus } : item));
  }
  function clearFilters() {
    setSearch(''); setStatus('all'); setPeriod('any'); setDateFrom(''); setDateTo(''); setMode('all');
  }

  return <>
    <div className="module-toolbar appointments-toolbar">
      <div className="appointments-toolbar-actions">
        <button className="primary-button" type="button" onClick={openModal}>＋ Novo agendamento</button>
        <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={15}/> Imprimir agenda</button>
      </div>
    </div>
    <section className="appointment-filter-tools" aria-label="Buscar e filtrar agendamentos">
      <label className="appointment-search-field">
        <Search size={17} aria-hidden="true"/>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, telefone ou procedimento" aria-label="Buscar por cliente, telefone ou procedimento"/>
        {search && <button type="button" className="appointment-search-clear" onClick={() => setSearch('')} aria-label="Limpar busca"><X size={15}/></button>}
      </label>
      <button className={'button button-outline appointment-filter-toggle' + (showFilters || activeFilterCount ? ' active' : '')} type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters}>
        <SlidersHorizontal size={16}/><span>Filtros</span>{activeFilterCount > 0 && <span className="appointment-filter-count">{activeFilterCount}</span>}<ChevronDown size={14} className={showFilters ? 'is-open' : ''}/>
      </button>
    </section>
    {showFilters && <section className="appointment-advanced-filters" aria-label="Filtros avançados de agendamentos">
      <label className="appointment-filter-field"><span>Situação</span><select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">Todos os status</option>{STATUS_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label className="appointment-filter-field"><span>Período</span><select value={period} onChange={event => setPeriod(event.target.value)}>
        <option value="any">Qualquer data</option><option value="today">Hoje</option><option value="next7">Próximos 7 dias</option><option value="month">Este mês</option><option value="custom">Intervalo personalizado</option>
      </select></label>
      {period === 'custom' && <div className="appointment-date-range">
        <label className="appointment-filter-field"><span>De</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)}/></label>
        <label className="appointment-filter-field"><span>Até</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)}/></label>
        {invalidRange && <p className="appointment-filter-error">A data final precisa ser igual ou posterior à data inicial.</p>}
        {!dateFrom && !dateTo && <p className="appointment-filter-hint">Escolha uma data inicial e/ou final para limitar a busca.</p>}
      </div>}
      <div className="appointment-filter-footer"><span>{activeFilterCount ? activeFilterCount + ' filtro(s) adicional(is) aplicado(s)' : 'Nenhum filtro adicional aplicado'}</span><button type="button" className="text-action appointment-clear-filters" onClick={clearFilters} disabled={!activeFilterCount && mode === 'all'}>Limpar filtros</button></div>
    </section>}
    <div className="filter-toolbar">
      <div className="segmented-filters">
        <button type="button" className={mode === 'upcoming' ? 'active' : ''} onClick={() => setMode('upcoming')}>Próximos</button>
        <button type="button" className={mode === 'pending' ? 'active' : ''} onClick={() => setMode('pending')}>Pendentes</button>
        <button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>Todos</button>
      </div>
      <span className="results-count">{filtered.length} {filtered.length === 1 ? 'agendamento' : 'agendamentos'}</span>
    </div>
    <section className="panel table-panel appointment-table-card">
      <div className="panel-heading"><div><h3>{mode === 'upcoming' ? 'Próximos atendimentos' : mode === 'pending' ? 'Agendamentos pendentes' : 'Todos os agendamentos'}</h3><p>Consulte, filtre e atualize o andamento de cada atendimento.</p></div><span className="date-chip"><CalendarDays size={15}/> {new Date(today + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
      {invalidRange ? <div className="empty-table">Ajuste o intervalo de datas para consultar os agendamentos.</div> : filtered.length ? <div className="appointment-demo-list">
        {filtered.map(item => <article className="appointment-demo-row" key={item.id}>
          <div className="appointment-demo-date"><strong>{displayDate(item.date)}</strong><span><Clock3 size={13}/>{item.time}</span></div>
          <div className="appointment-demo-customer"><span className="table-avatar">{String(item.client || 'C').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{item.client}</strong><small>{item.contact || item.phone || 'Telefone não informado'}</small></span></div>
          <div className="appointment-demo-service"><strong>{item.service}</strong><small>{item.professional || 'Profissional principal'}</small></div>
          <div className="appointment-demo-value"><strong>{Number(item.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
          <div className="appointment-demo-status"><span className={'status-badge ' + statusClass(item.status)}><span/>{item.status}</span><label><span className="sr-only">Alterar status de {item.client}</span><select value={item.status} onChange={event => updateStatus(item.id, event.target.value)}>{STATUS_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
        </article>)}
      </div> : <div className="empty-table"><CalendarDays size={24}/><strong>Nenhum agendamento encontrado</strong><span>Tente ajustar ou limpar os filtros para ver outros resultados.</span></div>}
      <div className="table-foot"><span>Dados fictícios · alterações ficam em memória até atualizar a página.</span><button className="text-action" type="button" onClick={resetAppointments}><RefreshCw size={14}/> Restaurar exemplos</button></div>
    </section>
  </>;
}
