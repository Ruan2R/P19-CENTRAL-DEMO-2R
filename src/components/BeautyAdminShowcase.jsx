import { useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, CalendarCheck2, CalendarDays, Check, CheckCircle2, ChevronDown,
  Clock3, DoorClosed, FileText, MessageCircle, MoreHorizontal, Pencil, PauseCircle, PlayCircle,
  Plus, Receipt, Save, Scissors, Search, ShieldCheck, SlidersHorizontal, Tag, Trash2, TrendingDown,
  TrendingUp, Upload, UserPlus, UserRound, Users, Wallet, X, Phone, RefreshCw
} from 'lucide-react';
import BookingTimeWheelPicker from './BookingTimeWheelPicker';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const STATUS = {
  pending_confirmation: 'Aguardando confirmação',
  awaiting_deposit: 'Aguardando sinal',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};
const STATUS_KEYS = Object.keys(STATUS);
const SERVICE_CATEGORIES = ['Sobrancelhas', 'Cílios', 'Maquiagem', 'Outro'];

function dateValue(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function dateTime(value, time) {
  return new Date(value + 'T' + time + ':00');
}
function money(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}
function dateLabel(value, options = { day: '2-digit', month: 'short' }) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}
function timeLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function makeMinuteSlots() {
  const slots = [];
  for (let hour = 8; hour <= 18; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      if (hour === 12 || (hour === 13 && minute < 30)) continue;
      slots.push(String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'));
    }
  }
  return slots;
}
const MINUTE_SLOTS = makeMinuteSlots();
function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? '(' + digits : '';
  if (digits.length <= 7) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
}
function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
function newAppointment(id, customer, phone, services, offset, time, status, deposit = false, depositReceived = false, note = '') {
  const starts = dateTime(dateValue(offset), time);
  const duration = services.reduce((sum, item) => sum + item.duration_minutes, 0);
  const ends = new Date(starts.getTime() + duration * 60000);
  const regular = services.reduce((sum, item) => sum + item.price_cents, 0);
  const depositCents = Math.round(regular * 0.2);
  return {
    id, public_code: 'AA-' + String(1040 + id).padStart(4, '0'), customer_name: customer, customer_phone: phone,
    customer_note: note, service_items: services.map((item) => ({ ...item })),
    service: { name: services.map((item) => item.name).join(' + '), duration_minutes: duration },
    starts_at: starts.toISOString(), ends_at: ends.toISOString(), price_cents: regular, regular_price_cents: regular,
    deposit_cents: depositCents, deposit_required: deposit, deposit_received: depositReceived,
    deposit_reported: false, policy_acknowledged: true, status,
    promotion_name: '', received_balance_cents: 0,
  };
}
const SERVICE_FIXTURES = [
  { id: 's1', name: 'Lash lifting', category: 'Cílios', description: 'Curvatura e realce dos fios naturais.', duration_minutes: 90, price_cents: 15000, deposit_percent: 20, active: true },
  { id: 's2', name: 'Extensão de cílios', category: 'Cílios', description: 'Aplicação personalizada para cada olhar.', duration_minutes: 120, price_cents: 22000, deposit_percent: 25, active: true },
  { id: 's3', name: 'Design de sobrancelhas', category: 'Sobrancelhas', description: 'Design alinhado ao formato do rosto.', duration_minutes: 40, price_cents: 4000, deposit_percent: 0, active: true },
  { id: 's4', name: 'Tintura de sobrancelhas', category: 'Sobrancelhas', description: 'Realce da cor e definição dos fios.', duration_minutes: 20, price_cents: 2000, deposit_percent: 0, active: true },
  { id: 's5', name: 'Maquiagem social', category: 'Maquiagem', description: 'Produção para ocasiões especiais.', duration_minutes: 60, price_cents: 16000, deposit_percent: 20, active: true },
];
const CUSTOMER_FIXTURES = [
  { id: 'c1', name: 'Mariana Costa', phone: '(67) 99912-0011', require_deposit: true, internal_note: 'Prefere atendimento no período da manhã.', appointment_count: 8, no_show_count: 0, last_appointment_at: dateTime(dateValue(-2), '10:30').toISOString() },
  { id: 'c2', name: 'Camila Oliveira', phone: '(67) 99912-0022', require_deposit: false, internal_note: '', appointment_count: 5, no_show_count: 1, last_appointment_at: dateTime(dateValue(-8), '14:00').toISOString() },
  { id: 'c3', name: 'Juliana Martins', phone: '(67) 99912-0033', require_deposit: false, internal_note: 'Cliente recorrente.', appointment_count: 11, no_show_count: 0, last_appointment_at: dateTime(dateValue(-1), '16:00').toISOString() },
  { id: 'c4', name: 'Bianca Souza', phone: '(67) 99912-0044', require_deposit: true, internal_note: 'Confirmar sinal antes de reservar.', appointment_count: 3, no_show_count: 2, last_appointment_at: dateTime(dateValue(-18), '09:30').toISOString() },
];
const APPOINTMENT_FIXTURES = [
  newAppointment(1, 'Mariana Costa', '(67) 99912-0011', [SERVICE_FIXTURES[0]], -2, '09:00', 'completed', true, true),
  newAppointment(2, 'Camila Oliveira', '(67) 99912-0022', [SERVICE_FIXTURES[2], SERVICE_FIXTURES[3]], -1, '10:30', 'completed', false, false),
  newAppointment(3, 'Juliana Martins', '(67) 99912-0033', [SERVICE_FIXTURES[1]], 0, '13:00', 'awaiting_deposit', true, false),
  newAppointment(4, 'Bianca Souza', '(67) 99912-0044', [SERVICE_FIXTURES[2]], 0, '15:00', 'confirmed', true, true),
  newAppointment(5, 'Fernanda Lima', '(67) 99912-0055', [SERVICE_FIXTURES[4]], 1, '09:30', 'pending_confirmation', false, false, 'Prefere maquiagem leve.'),
  newAppointment(6, 'Paula Nunes', '(67) 99912-0066', [SERVICE_FIXTURES[0], SERVICE_FIXTURES[2]], 2, '11:00', 'confirmed', true, false),
  newAppointment(7, 'Renata Alves', '(67) 99912-0077', [SERVICE_FIXTURES[3]], -6, '16:30', 'no_show', false, false),
  newAppointment(8, 'Lívia Rocha', '(67) 99912-0088', [SERVICE_FIXTURES[2]], -4, '14:00', 'cancelled', false, false),
];
const HOUR_FIXTURES = WEEKDAYS.map((day, weekday) => ({
  weekday, enabled: weekday >= 1 && weekday <= 6,
  start_time: weekday === 0 ? null : '09:00',
  end_time: weekday === 0 ? null : (weekday === 6 ? '15:00' : '18:00'),
  break_start: weekday >= 1 && weekday <= 5 ? '12:00' : null,
  break_end: weekday >= 1 && weekday <= 5 ? '13:00' : null,
}));
const BLOCK_FIXTURES = [
  { id: 'b1', blocked_date: dateValue(3), start_time: null, end_time: null, note: 'Compromisso pessoal · dia inteiro' },
  { id: 'b2', blocked_date: dateValue(6), start_time: '14:00', end_time: '16:30', note: 'Pausa / compromisso' },
];
const TRANSACTION_FIXTURES = [
  { id: 'f1', direction: 'income', description: 'Sinal · Mariana Costa', category: 'Sinal de agendamento', amount_cents: 3000, movement_date: dateValue(-2), payment_method: 'Pix', source_type: 'appointment_deposit', related_appointment_id: '1' },
  { id: 'f2', direction: 'income', description: 'Atendimentos realizados', category: 'Serviços', amount_cents: 42000, movement_date: dateValue(-1), payment_method: 'Pix', source_type: 'manual', related_appointment_id: null },
  { id: 'f3', direction: 'expense', description: 'Compra de materiais', category: 'Materiais', amount_cents: 8900, movement_date: dateValue(-1), payment_method: 'Cartão', source_type: 'manual', related_appointment_id: null },
  { id: 'f4', direction: 'expense', description: 'Produtos de uso profissional', category: 'Insumos', amount_cents: 12500, movement_date: dateValue(-4), payment_method: 'Pix', source_type: 'manual', related_appointment_id: null },
  { id: 'f5', direction: 'income', description: 'Saldo · atendimento concluído', category: 'Saldo de atendimento', amount_cents: 12000, movement_date: dateValue(-2), payment_method: 'Dinheiro', source_type: 'appointment_balance', related_appointment_id: null },
];
const PAYABLE_FIXTURES = [
  { id: 'p1', description: 'Aluguel do espaço', category: 'Estrutura', amount_cents: 90000, due_date: dateValue(3), status: 'pending', paid_at: null },
  { id: 'p2', description: 'Reposição de materiais', category: 'Insumos', amount_cents: 18500, due_date: dateValue(-2), status: 'pending', paid_at: null },
  { id: 'p3', description: 'Internet', category: 'Serviços', amount_cents: 11990, due_date: dateValue(-5), status: 'paid', paid_at: new Date().toISOString() },
];
function CardHeading({ eyebrow, title, action }) {
  return <div className="ba-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}
function CountPill({ children }) { return <span className="ba-count-pill">{children}</span>; }
function Field({ label, children, className = '' }) { return <label className={'ba-field ' + className}><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, label, description, compact = false }) {
  return <label className={'ba-toggle' + (compact ? ' ba-toggle-compact' : '')}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="ba-switch" />
    <span className="ba-toggle-copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
  </label>;
}
function StatusPill({ status }) {
  return <span className={'ba-status ba-status-' + status}>{STATUS[status]}</span>;
}

export default function BeautyAdminShowcase({ module, notify = () => {} }) {
  const [appointments, setAppointments] = useState(APPOINTMENT_FIXTURES);
  const [customers, setCustomers] = useState(CUSTOMER_FIXTURES);
  const [services, setServices] = useState(SERVICE_FIXTURES);
  const [promotions, setPromotions] = useState([
    { id: 'pr1', name: 'Semana do olhar', starts_on: dateValue(-2), ends_on: dateValue(10), active: true, items: [{ service_id: 's3', promotional_price_cents: 3500 }, { service_id: 's4', promotional_price_cents: 1700 }] },
    { id: 'pr2', name: 'Combo de cuidados', starts_on: dateValue(5), ends_on: dateValue(18), active: true, items: [{ service_id: 's1', promotional_price_cents: 13500 }] },
    { id: 'pr3', name: 'Especial de primavera', starts_on: dateValue(-25), ends_on: dateValue(-8), active: true, items: [{ service_id: 's5', promotional_price_cents: 14500 }] },
  ]);
  const [hours, setHours] = useState(HOUR_FIXTURES);
  const [blocks, setBlocks] = useState(BLOCK_FIXTURES);
  const [policies, setPolicies] = useState({
    show_lateness_policy: true, lateness_tolerance_minutes: 10,
    show_cancellation_policy: true, cancellation_notice_hours: 12,
    show_companion_policy: false, companion_policy: 'Consulte a disponibilidade antes de vir acompanhada.',
    show_no_show_policy: true, no_show_policy: 'Em caso de falta ou cancelamento, entre em contato com o estúdio para alinhar os próximos passos.',
  });
  const [financialEntries, setFinancialEntries] = useState(TRANSACTION_FIXTURES);
  const [payables, setPayables] = useState(PAYABLE_FIXTURES);
  const [saving, setSaving] = useState(false);

  if (module === 'appointments') return <AppointmentsView {...{ appointments, setAppointments, customers, setCustomers, services, promotions, notify, saving }} />;
  if (module === 'clients') return <CustomersView {...{ customers, setCustomers, appointments, notify, saving }} />;
  if (module === 'services') return <ServicesView {...{ services, setServices, notify, saving }} />;
  if (module === 'promotions') return <PromotionsView {...{ promotions, setPromotions, services, notify, saving }} />;
  if (module === 'hours') return <HoursView {...{ hours, setHours, notify, saving }} />;
  if (module === 'blocks') return <BlocksView {...{ blocks, setBlocks, notify, saving }} />;
  if (module === 'policies') return <PoliciesView {...{ policies, setPolicies, notify, saving }} />;
  if (module === 'finance') return <FinanceView {...{ appointments, financialEntries, setFinancialEntries, payables, setPayables, notify, saving, setAppointments }} />;
  return <OverviewView {...{ appointments, services, promotions, customers, financialEntries, payables }} onNavigate={notify} />;
}

function OverviewView({ appointments, services, promotions, customers, financialEntries, payables, onNavigate }) {
  const today = dateValue(0);
  const todaysAppointments = appointments.filter((item) => item.starts_at.slice(0, 10) === today && !['cancelled', 'no_show'].includes(item.status));
  const awaiting = appointments.filter((item) => ['pending_confirmation', 'awaiting_deposit'].includes(item.status)).length;
  const activeServices = services.filter((item) => item.active).length;
  const income = financialEntries.filter((item) => item.direction === 'income').reduce((sum, item) => sum + item.amount_cents, 0);
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">PAINEL DO ESTÚDIO</span><h2>Visão geral.</h2><p>Resumo da rotina, dos atendimentos e das configurações do estúdio.</p></div><span className="ba-date-chip"><CalendarDays size={15}/>{dateLabel(today, { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
    <div className="ba-metric-grid">
      <article><span><CalendarCheck2 size={17}/> Atendimentos de hoje</span><strong>{todaysAppointments.length}</strong><small>Horários previstos para hoje</small></article>
      <article><span><Clock3 size={17}/> Aguardando ação</span><strong>{awaiting}</strong><small>Confirmações e sinais pendentes</small></article>
      <article><span><Scissors size={17}/> Serviços ativos</span><strong>{activeServices}</strong><small>Disponíveis para agendamento</small></article>
      <article><span><Wallet size={17}/> Entradas registradas</span><strong>{money(income)}</strong><small>Movimentações demonstrativas</small></article>
    </div>
    <section className="ba-card">
      <CardHeading eyebrow="AGENDA" title="Próximos atendimentos" action={<CountPill>{appointments.length}</CountPill>} />
      <div className="ba-upcoming-list">{appointments.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4).map((item) => <div className="ba-upcoming-row" key={item.id}><div className="ba-date-square"><strong>{dateLabel(item.starts_at, { day: '2-digit' })}</strong><small>{timeLabel(item.starts_at)}</small></div><div><strong>{item.customer_name}</strong><span>{item.service.name}</span></div><StatusPill status={item.status}/></div>)}</div>
      <p className="ba-helper">A agenda registra status, sinal, observações e os procedimentos selecionados em cada atendimento.</p>
    </section>
    <div className="ba-overview-bottom">
      <section className="ba-card"><CardHeading eyebrow="CONFIGURAÇÃO" title="Preparar a agenda" /><p>Cadastre os serviços, ajuste o funcionamento semanal, crie bloqueios e defina as orientações exibidas antes da reserva pública.</p><div className="ba-module-tags"><span>Serviços e valores</span><span>Horários</span><span>Bloqueios</span><span>Políticas</span></div></section>
      <section className="ba-card"><CardHeading eyebrow="CAMPANHAS" title="Promoções ativas" action={<CountPill>{promotions.length}</CountPill>} /><div className="ba-promotion-summary">{promotions.slice(0, 2).map((promotion) => <div key={promotion.id}><Tag size={16}/><span><strong>{promotion.name}</strong><small>{promotion.items.length} serviços participantes</small></span></div>)}</div></section>
    </div>
    <p className="ba-demo-note"><ShieldCheck size={14}/> Dados fictícios para demonstração. Os cadastros e valores são reiniciados ao recarregar.</p>
  </div>;
}

function AppointmentsView({ appointments, setAppointments, customers, setCustomers, services, promotions, notify, saving }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [serviceIds, setServiceIds] = useState([]);
  const [date, setDate] = useState(dateValue(0));
  const [time, setTime] = useState('16:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [allowMissingPhone, setAllowMissingPhone] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const activeServices = services.filter((service) => service.active);
  const selectedServices = activeServices.filter((service) => serviceIds.includes(service.id));
  const promotionByService = new Map();
  promotions.filter((promotion) => promotion.active && date >= promotion.starts_on && date <= promotion.ends_on).forEach((promotion) => {
    promotion.items.forEach((item) => {
      if (serviceIds.includes(item.service_id) && !promotionByService.has(item.service_id)) promotionByService.set(item.service_id, { name: promotion.name, price: item.promotional_price_cents });
    });
  });
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration_minutes, 0);
  const regularTotal = selectedServices.reduce((sum, service) => sum + service.price_cents, 0);
  const total = selectedServices.reduce((sum, service) => sum + (promotionByService.get(service.id)?.price ?? service.price_cents), 0);
  const suggestions = customers.filter((customer) => customer.name.toLowerCase().includes(customerName.trim().toLowerCase()) || (customerName.replace(/\D/g, '').length >= 3 && customer.phone.replace(/\D/g, '').includes(customerName.replace(/\D/g, '')))).slice(0, 6);
  const [viewFilter, setViewFilter] = useState('upcoming');
  const filtered = appointments.filter((item) => {
    const value = search.trim().toLowerCase();
    const matchesSearch = !value || (item.customer_name + ' ' + item.customer_phone + ' ' + item.service.name).toLowerCase().includes(value);
    const appointmentDate = item.starts_at.slice(0, 10);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPeriod = periodFilter === 'custom'
      ? (!dateFrom || appointmentDate >= dateFrom) && (!dateTo || appointmentDate <= dateTo)
      : periodFilter === 'today' ? appointmentDate === dateValue(0)
      : periodFilter === 'next7' ? appointmentDate >= dateValue(0) && appointmentDate <= dateValue(7)
      : periodFilter === 'month' ? appointmentDate.slice(0, 7) === dateValue(0).slice(0, 7)
      : true;
    const matchesView = viewFilter === 'upcoming'
      ? !['cancelled', 'no_show'].includes(item.status)
      : viewFilter === 'pending'
        ? ['pending_confirmation', 'awaiting_deposit'].includes(item.status)
        : true;
    return matchesSearch && matchesStatus && matchesPeriod && matchesView;
  }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  function createManualAppointment(event) {
    event.preventDefault();
    if (!serviceIds.length || !time || !customerName.trim()) return;
    const start = dateTime(date, time);
    const duration = totalDuration;
    const end = new Date(start.getTime() + duration * 60000);
    const customer = customers.find((item) => item.name.toLowerCase() === customerName.trim().toLowerCase());
    const depositRequired = Boolean(customer?.require_deposit || selectedServices.some((service) => service.deposit_percent > 0));
    const depositPercent = Math.max(0, ...selectedServices.map((service) => service.deposit_percent));
    const appointment = {
      id: String(Date.now()), public_code: 'AA-' + String(1100 + appointments.length).padStart(4, '0'),
      customer_name: customerName.trim(), customer_phone: customerPhone, customer_note: customerNote,
      service_items: selectedServices.map((service) => ({ ...service })), service: { name: selectedServices.map((service) => service.name).join(' + '), duration_minutes: duration },
      starts_at: start.toISOString(), ends_at: end.toISOString(), price_cents: total, regular_price_cents: regularTotal,
      deposit_cents: depositRequired ? Math.round(total * depositPercent / 100) : 0, deposit_required: depositRequired,
      deposit_received: false, deposit_reported: false, policy_acknowledged: true,
      status: depositRequired ? 'awaiting_deposit' : 'pending_confirmation',
      promotion_name: [...new Set([...promotionByService.values()].map((promotion) => promotion.name))].join(', '),
    };
    setAppointments((items) => [appointment, ...items]);
    if (!customer && customerName.trim()) setCustomers((items) => [{ id: 'new-' + Date.now(), name: customerName.trim(), phone: customerPhone, require_deposit: false, internal_note: '', appointment_count: 1, no_show_count: 0, last_appointment_at: start.toISOString() }, ...items]);
    setShowCreateForm(false);
    setServiceIds([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerNote('');
    setTime('16:00');
    notify('Agendamento manual adicionado à demonstração.');
  }

  const additionalFilters = Number(Boolean(search.trim())) + Number(statusFilter !== 'all') + Number(periodFilter !== 'any');
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">ACOMPANHE SUA ROTINA</span><h2>Agendamentos.</h2><p>Gerencie solicitações, confirme horários e acompanhe cada etapa do atendimento.</p></div><div className="ba-heading-actions"><button className="ba-button ba-button-primary" onClick={() => setShowCreateForm((value) => !value)}><Plus size={15}/>{showCreateForm ? 'Fechar formulário' : 'Novo agendamento'}</button><button className="ba-button ba-button-outline" onClick={() => window.print()}><FileText size={15}/> Imprimir agenda</button></div></div>
    {showCreateForm && <section className="ba-card ba-manual-booking">
      <CardHeading eyebrow="LANÇAMENTO MANUAL" title="Novo agendamento" />
      <p className="ba-helper">Selecione um ou mais procedimentos. A duração e o valor serão somados. A busca de horários leva em conta a disponibilidade da agenda.</p>
      <form onSubmit={createManualAppointment}>
        <fieldset className="ba-service-picker"><legend>Procedimentos</legend>
          {activeServices.map((service) => {
            const promotion = promotionByService.get(service.id);
            return <label className="ba-service-choice" key={service.id}><input type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => setServiceIds((ids) => ids.includes(service.id) ? ids.filter((id) => id !== service.id) : [...ids, service.id])}/><span><strong>{service.name}</strong><small>{service.duration_minutes} min{promotion ? ' · promoção' : ''}</small></span><b>{money(promotion?.price ?? service.price_cents)}{promotion && <s>{money(service.price_cents)}</s>}</b></label>;
          })}
        </fieldset>
        {selectedServices.length > 0 && <div className="ba-selected-total"><span><Clock3 size={14}/> Duração total: {totalDuration} min</span><strong>{money(total)}</strong>{total !== regularTotal && <s>{money(regularTotal)}</s>}</div>}
        <div className="ba-form-grid">
          <label>Data<input type="date" value={date} min={dateValue(0)} onChange={(event) => setDate(event.target.value)} required/></label>
          <div className="ba-field"><span>Horário</span><BookingTimeWheelPicker id="beauty-admin-time" slots={MINUTE_SLOTS} value={time} onChange={setTime} disabled={!serviceIds.length}/></div>
        </div>
        <div className="ba-customer-autocomplete">
          <label>Nome completo<input value={customerName} onFocus={() => setShowSuggestions(true)} onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)} onChange={(event) => { setCustomerName(event.target.value); setCustomerPhone(''); setAllowMissingPhone(false); setShowSuggestions(true); }} autoComplete="off" placeholder="Digite para localizar uma cliente" required/></label>
          {showSuggestions && customerName.trim() && <div className="ba-suggestions">{suggestions.length ? suggestions.map((customer) => <button type="button" key={customer.id} onMouseDown={() => { setCustomerName(customer.name); setCustomerPhone(customer.phone); setAllowMissingPhone(!customer.phone); setShowSuggestions(false); }}><span><strong>{customer.name}</strong><small>{customer.phone || 'Telefone não informado'}</small></span><small>{customer.appointment_count} agendamentos</small></button>) : <p>Nenhum cadastro encontrado. Continue preenchendo manualmente.</p>}</div>}
        </div>
        <div className="ba-form-grid">
          <label>WhatsApp com DDD<input value={customerPhone} onChange={(event) => setCustomerPhone(formatPhone(event.target.value))} placeholder="(67) 99999-9999" maxLength={16} required={!allowMissingPhone}/></label>
          <Toggle checked={allowMissingPhone} onChange={setAllowMissingPhone} label="Agendar sem telefone" description="Disponível apenas para lançamentos administrativos." compact/>
        </div>
        <label className="ba-full-field">Observação (opcional)<textarea rows={2} maxLength={500} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Informações internas sobre o atendimento"/></label>
        <div className="ba-form-actions"><button className="ba-button ba-button-outline" type="button" onClick={() => setShowCreateForm(false)}>Cancelar</button><button className="ba-button ba-button-primary" type="submit" disabled={!serviceIds.length || !time || saving}><Plus size={15}/> Criar agendamento</button></div>
      </form>
    </section>}
    <div className="ba-appointment-tools">
      <label className="ba-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone ou procedimento"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><X size={14}/></button>}</label>
      <button className={'ba-button ba-button-outline' + (showFilters || additionalFilters ? ' is-active' : '')} onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal size={15}/> Filtros {additionalFilters > 0 && <span className="ba-filter-count">{additionalFilters}</span>}<ChevronDown size={14}/></button>
    </div>
    {showFilters && <section className="ba-card ba-advanced-filters">
      <label>Situação<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos os status</option>{STATUS_KEYS.map((key) => <option key={key} value={key}>{STATUS[key]}</option>)}</select></label>
      <label>Período<select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}><option value="any">Qualquer data</option><option value="today">Hoje</option><option value="next7">Próximos 7 dias</option><option value="month">Este mês</option><option value="custom">Intervalo personalizado</option></select></label>
      {periodFilter === 'custom' && <div className="ba-date-range"><label>De<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} max={dateTo || undefined}/></label><label>Até<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} min={dateFrom || undefined}/></label></div>}
      <div className="ba-filter-footer"><span>{additionalFilters} filtro(s) adicional(is) aplicado(s)</span><button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setPeriodFilter('any'); setDateFrom(''); setDateTo(''); setViewFilter('upcoming'); }}>Limpar filtros</button></div>
    </section>}
    <div className="ba-filter-toolbar"><div className="ba-segmented"><button className={viewFilter === 'upcoming' ? 'active' : ''} onClick={() => { setViewFilter('upcoming'); setPeriodFilter('any'); }}>Próximos</button><button className={viewFilter === 'pending' ? 'active' : ''} onClick={() => { setViewFilter('pending'); setPeriodFilter('any'); }}>Pendentes</button><button className={viewFilter === 'all' ? 'active' : ''} onClick={() => { setViewFilter('all'); setPeriodFilter('any'); }}>Todos</button></div><span>{filtered.length} agendamento(s)</span></div>
    <section className="ba-card ba-appointment-list">
      {filtered.length ? filtered.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onStatus={(status) => setAppointments((items) => items.map((item) => item.id === appointment.id ? { ...item, status } : item))} notify={notify}/>) : <div className="ba-empty"><CalendarDays size={25}/><strong>Nenhum agendamento encontrado</strong><p>Ajuste os filtros ou consulte outra data.</p></div>}
    </section>
    <p className="ba-demo-note"><ShieldCheck size={14}/> A tela real também permite filtrar por intervalo personalizado, status de pagamento, sinal e imprimir a agenda. Os dados desta prévia são fictícios.</p>
  </div>;
}

function AppointmentCard({ appointment, onStatus, notify }) {
  const items = appointment.service_items?.map((item) => item.name).join(' + ') || appointment.service?.name || 'Atendimento';
  const hint = appointment.status === 'awaiting_deposit'
    ? appointment.deposit_reported ? 'A cliente informou o Pix. Confira o crédito antes de confirmar.' : 'Aguardando sinal de ' + money(appointment.deposit_cents) + '.'
    : appointment.status === 'confirmed' ? (appointment.deposit_received ? 'Sinal registrado. Após o atendimento, marque como concluído.' : 'Horário confirmado. Após o atendimento, marque como concluído.') : '';
  return <article className="ba-appointment-card">
    <div className="ba-appointment-date"><strong>{dateLabel(appointment.starts_at, { day: '2-digit', month: 'short' })}</strong><span>{timeLabel(appointment.starts_at)}</span></div>
    <div className="ba-appointment-info"><strong>{appointment.customer_name}</strong><span>{items}{appointment.customer_note ? ' · ' + appointment.customer_note : ''}</span><small>Código {appointment.public_code}</small>{appointment.promotion_name && <em><Tag size={12}/>{appointment.promotion_name}</em>}</div>
    <div className="ba-appointment-money"><strong>{money(appointment.price_cents)}</strong><small>{appointment.deposit_required ? 'Sinal ' + money(appointment.deposit_cents) + (appointment.deposit_received ? ' · recebido' : ' · pendente') : 'Sem sinal obrigatório'}</small></div>
    <div className="ba-appointment-status"><StatusPill status={appointment.status}/><select aria-label="Alterar status do atendimento" value={appointment.status} onChange={(event) => onStatus(event.target.value)}>{STATUS_KEYS.map((key) => <option key={key} value={key}>{STATUS[key]}</option>)}</select>{hint && <small>{hint}</small>}</div>
    <button className="ba-icon-button" type="button" onClick={() => notify('Atalho demonstrativo: abrir conversa com ' + appointment.customer_name + ' no WhatsApp.')} aria-label="Abrir WhatsApp"><MessageCircle size={16}/></button>
  </article>;
}

function CustomersView({ customers, setCustomers, appointments, notify }) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState('c1');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [importFile, setImportFile] = useState('');
  const [importMenu, setImportMenu] = useState(false);
  const filtered = customers.filter((customer) => (customer.name + ' ' + customer.phone).toLowerCase().includes(query.toLowerCase()) || (query.replace(/\D/g, '') && customer.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))));
  function addCustomer(event) {
    event.preventDefault();
    setCustomers((items) => [{ id: 'c' + Date.now(), name: name.trim(), phone, require_deposit: requireDeposit, internal_note: internalNote, appointment_count: 0, no_show_count: 0, last_appointment_at: null }, ...items]);
    setName(''); setPhone(''); setInternalNote(''); setRequireDeposit(false); setShowForm(false);
    notify('Cliente demonstrativa adicionada.');
  }
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">CADASTRO E PREFERÊNCIAS INDIVIDUAIS</span><h2>Clientes e preferências individuais.</h2><p>Consulte o histórico, organize informações internas e configure exigência de sinal por cliente.</p></div><CountPill>{customers.length} cadastrados</CountPill></div>
    <div className="ba-notice"><ShieldCheck size={17}/><span>O sinal não é obrigatório por serviço. A administração pode marcar individualmente os clientes para os quais deseja exigir sinal nas próximas reservas. Observações internas não aparecem na página pública.</span></div>
    <div className="ba-two-column ba-customer-layout">
      <section className="ba-card">
        <CardHeading eyebrow="CADASTRO DE CLIENTES" title="Adicionar cliente" action={<div className="ba-inline-actions"><button className="ba-button ba-button-primary" onClick={() => setShowForm((value) => !value)}><UserPlus size={15}/>{showForm ? 'Fechar' : 'Adicionar'}</button><button className="ba-icon-button" onClick={() => setImportMenu((value) => !value)}><MoreHorizontal size={18}/></button></div>}/>
        {importMenu && <div className="ba-import-popover"><label className="ba-button ba-button-outline"><Upload size={15}/> Importar contatos (.vcf)<input type="file" accept=".vcf,.vcard,text/vcard" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) { setImportFile(file.name); notify('Arquivo selecionado para a prévia de importação vCard.'); } setImportMenu(false); }}/></label><small>Importação com prévia, deduplicação e relatório de registros inválidos.</small></div>}
        {importFile && <div className="ba-import-review"><strong>{importFile}</strong><span>Prévia de importação vCard · somente nome e telefone.</span><button onClick={() => { setImportFile(''); notify('Importação demonstrativa encerrada.'); }}>Fechar prévia</button></div>}
        {showForm && <form className="ba-form-stack" onSubmit={addCustomer}>
          <Field label="Nome completo"><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required placeholder="Nome da cliente"/></Field>
          <Field label="Telefone / WhatsApp"><input value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} maxLength={16} required placeholder="(67) 99999-9999"/></Field>
          <Toggle checked={requireDeposit} onChange={setRequireDeposit} label="Exigir sinal nas próximas reservas" description="Preferência individual vinculada ao cadastro da cliente."/>
          <Field label="Observação interna (opcional)"><textarea rows={3} maxLength={500} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Combinados de atendimento ou histórico relevante"/></Field>
          <button className="ba-button ba-button-primary" type="submit"><UserPlus size={15}/> Cadastrar cliente</button>
        </form>}
      </section>
      <section className="ba-card ba-customer-directory">
        <CardHeading eyebrow="CADASTROS EXISTENTES" title="Localizar cliente" action={<CountPill>{filtered.length}</CountPill>}/>
        <label className="ba-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome ou telefone"/></label>
        <div className="ba-customer-list">{filtered.map((customer) => {
          const expanded = expandedId === customer.id;
          const linkedAppointments = appointments.filter((item) => item.customer_name === customer.name);
          return <article className="ba-customer-card" key={customer.id}>
            <button className="ba-customer-summary" onClick={() => setExpandedId(expanded ? null : customer.id)} aria-expanded={expanded}>
              <span className="ba-avatar">{initials(customer.name)}</span>
              <span className="ba-customer-identity"><strong>{customer.name}</strong><small><Phone size={12}/>{customer.phone || 'Telefone não informado'}</small></span>
              <span className="ba-customer-meta"><em className={customer.require_deposit ? 'required' : ''}>{customer.require_deposit ? 'Sinal exigido' : 'Sinal não exigido'}</em><small>{customer.appointment_count} ag. · {customer.no_show_count} faltas</small></span>
              <ChevronDown size={16}/>
            </button>
            {expanded && <div className="ba-customer-details">
              <div className="ba-customer-history"><span>{customer.appointment_count} agendamentos</span><span>{customer.no_show_count} faltas registradas</span>{customer.last_appointment_at && <span>Último: {dateLabel(customer.last_appointment_at)}</span>}</div>
              <Field label="Nome exibido"><input value={customer.name} onChange={(event) => setCustomers((items) => items.map((item) => item.id === customer.id ? { ...item, name: event.target.value } : item))}/></Field>
              <Toggle checked={customer.require_deposit} onChange={(value) => setCustomers((items) => items.map((item) => item.id === customer.id ? { ...item, require_deposit: value } : item))} label="Exigir sinal nas próximas reservas" description="A preferência será considerada quando a cliente for identificada pelo telefone."/>
              <Field label="Observação interna"><textarea rows={3} value={customer.internal_note} onChange={(event) => setCustomers((items) => items.map((item) => item.id === customer.id ? { ...item, internal_note: event.target.value } : item))}/></Field>
              <div className="ba-customer-detail-bottom"><small>{linkedAppointments.length} atendimento(s) nesta demonstração</small><button className="ba-button ba-button-outline" onClick={() => notify('Alterações da ficha demonstrativa salvas.')}><Save size={14}/> Salvar alterações</button></div>
            </div>}
          </article>;
        })}</div>
      </section>
    </div>
    <p className="ba-demo-note"><ShieldCheck size={14}/> Na aplicação real, a importação vCard faz prévia, deduplica contatos e informa quantos foram criados, ignorados ou inválidos.</p>
  </div>;
}

function ServicesView({ services, setServices, notify }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sobrancelhas');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('0.00');
  const [deposit, setDeposit] = useState('0');
  function update(id, patch) { setServices((items) => items.map((service) => service.id === id ? { ...service, ...patch } : service)); }
  function addService(event) {
    event.preventDefault();
    const cents = Math.round(Number(price.replace(',', '.')) * 100);
    setServices((items) => [...items, { id: 's' + Date.now(), name: name.trim(), category: category === 'Outro' ? customCategory.trim() : category, description, duration_minutes: Number(duration), price_cents: cents, deposit_percent: Number(deposit), active: true }]);
    setName(''); setDescription(''); setPrice('0.00'); setDuration('30'); setDeposit('0'); setCategory('Sobrancelhas'); setCustomCategory(''); setShowNew(false);
    notify('Serviço demonstrativo cadastrado.');
  }
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">CATÁLOGO DO ESTÚDIO</span><h2>Serviços e valores.</h2><p>Cadastre procedimentos, organize categorias e defina duração, preço e sinal para clientes sinalizadas.</p></div><CountPill>{services.filter((service) => service.active).length} ativos</CountPill></div>
    <div className="ba-notice"><Scissors size={17}/><span>Serviços com histórico de agendamentos ou promoções são preservados; quando não forem mais oferecidos, podem ser desativados para manter os registros.</span></div>
    <section className="ba-card">
      <CardHeading eyebrow="CATÁLOGO" title="Novo procedimento" action={<button className="ba-button ba-button-primary" onClick={() => setShowNew((value) => !value)}><Plus size={15}/>{showNew ? 'Fechar' : 'Adicionar serviço'}</button>}/>
      {showNew && <form className="ba-form-stack" onSubmit={addService}>
        <div className="ba-form-grid"><Field label="Nome do procedimento"><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: Henna de sobrancelhas"/></Field><Field label="Categoria"><select value={category} onChange={(event) => setCategory(event.target.value)}>{SERVICE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field></div>
        {category === 'Outro' && <Field label="Nome da categoria"><input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} required/></Field>}
        <Field label="Descrição (opcional)"><textarea rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Breve descrição do serviço"/></Field>
        <div className="ba-form-grid ba-form-grid-three"><Field label="Preço (R$)"><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required/></Field><Field label="Duração (minutos)"><input type="number" min="15" max="600" value={duration} onChange={(event) => setDuration(event.target.value)} required/></Field><Field label="Sinal (%)"><input type="number" min="0" max="100" value={deposit} onChange={(event) => setDeposit(event.target.value)} required/></Field></div>
        <button className="ba-button ba-button-primary" type="submit"><Save size={15}/> Salvar serviço</button>
      </form>}
    </section>
    <div className="ba-service-list">{services.map((service) => <article className="ba-card ba-service-card" key={service.id}>
      <div className="ba-service-card-heading"><span className="ba-service-icon"><Scissors size={18}/></span><div><small>{service.category}</small><h3>{service.name}</h3><p>{service.description}</p></div><Toggle checked={service.active} onChange={(value) => update(service.id, { active: value })} label={service.active ? 'Ativo' : 'Inativo'} compact/></div>
      <div className="ba-form-grid ba-form-grid-three">
        <Field label="Preço (R$)"><input type="number" min="0" step="0.01" value={(service.price_cents / 100).toFixed(2)} onChange={(event) => update(service.id, { price_cents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })}/></Field>
        <Field label="Duração (minutos)"><input type="number" min="15" max="600" value={service.duration_minutes} onChange={(event) => update(service.id, { duration_minutes: Math.min(600, Math.max(15, Number(event.target.value || 15))) })}/></Field>
        <Field label="Sinal para cliente sinalizada (%)"><input type="number" min="0" max="100" value={service.deposit_percent} onChange={(event) => update(service.id, { deposit_percent: Math.min(100, Math.max(0, Number(event.target.value || 0))) })}/></Field>
      </div>
      <div className="ba-service-card-footer"><span>Valor estimado de sinal: <strong>{money(Math.round(service.price_cents * service.deposit_percent / 100))}</strong></span><div><button className="ba-button ba-button-outline" onClick={() => notify('Alterações de serviço salvas na demonstração.')}><Save size={14}/> Salvar alterações</button><button className="ba-icon-button danger" onClick={() => { if (window.confirm('Remover este serviço da prévia?')) setServices((items) => items.filter((item) => item.id !== service.id)); }} aria-label="Excluir serviço"><Trash2 size={15}/></button></div></div>
    </article>)}</div>
    <p className="ba-demo-note"><ShieldCheck size={14}/> A ficha real também possui categoria, descrição, duração, preço, percentual de sinal e estado ativo/inativo.</p>
  </div>;
}

function PromotionsView({ promotions, setPromotions, services, notify }) {
  const today = dateValue(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(dateValue(7));
  const [active, setActive] = useState(true);
  const [itemPrices, setItemPrices] = useState({});
  const [filter, setFilter] = useState('all');
  function statusFor(promotion) {
    if (!promotion.active) return 'paused';
    if (promotion.ends_on < today) return 'ended';
    if (promotion.starts_on > today) return 'scheduled';
    return 'active';
  }
  const statusLabel = { active: 'Ativa', scheduled: 'Programada', ended: 'Encerrada', paused: 'Pausada' };
  const filtered = promotions.filter((promotion) => filter === 'all' || statusFor(promotion) === filter).slice().sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  function openNew() { setEditingId(null); setName(''); setStartsOn(today); setEndsOn(dateValue(7)); setActive(true); setItemPrices({}); setShowForm(true); }
  function edit(promotion) {
    setEditingId(promotion.id); setName(promotion.name); setStartsOn(promotion.starts_on); setEndsOn(promotion.ends_on); setActive(promotion.active);
    setItemPrices(Object.fromEntries(promotion.items.map((item) => [item.service_id, String((item.promotional_price_cents / 100).toFixed(2))])));
    setShowForm(true);
  }
  function submit(event) {
    event.preventDefault();
    const items = Object.entries(itemPrices).filter(([, value]) => String(value).trim() !== '').map(([service_id, value]) => ({ service_id, promotional_price_cents: Math.round(Number(String(value).replace(',', '.')) * 100) }));
    if (!items.length || items.some((item) => item.promotional_price_cents <= 0 || item.promotional_price_cents >= (services.find((service) => service.id === item.service_id)?.price_cents ?? 0))) {
      notify('Informe pelo menos um preço promocional menor que o preço normal.');
      return;
    }
    const entry = { id: editingId || 'pr' + Date.now(), name, starts_on: startsOn, ends_on: endsOn, active, items };
    setPromotions((current) => editingId ? current.map((item) => item.id === editingId ? entry : item) : [entry, ...current]);
    setShowForm(false); setEditingId(null); setName(''); setItemPrices({});
    notify('Campanha demonstrativa salva.');
  }
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">CAMPANHAS DO ESTÚDIO</span><h2>Promoções.</h2><p>Crie campanhas com período de validade e preço especial por procedimento.</p></div><CountPill>{promotions.length} cadastradas</CountPill></div>
    <div className="ba-notice"><Tag size={17}/><span>O valor promocional é aplicado somente aos agendamentos realizados dentro do período configurado. O preço normal do catálogo permanece preservado.</span></div>
    <section className="ba-card">
      <CardHeading eyebrow="NOVA CAMPANHA" title={editingId ? 'Editar promoção' : 'Criar promoção'} action={<button className="ba-button ba-button-primary" onClick={() => showForm ? setShowForm(false) : openNew()}>{showForm ? <X size={15}/> : <Plus size={15}/>} {showForm ? 'Fechar' : 'Nova promoção'}</button>}/>
      {showForm ? <form className="ba-form-stack" onSubmit={submit}>
        <Field label="Nome da promoção"><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} placeholder="Ex.: Promo da semana" required/></Field>
        <div className="ba-form-grid"><Field label="Início da promoção"><input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required/></Field><Field label="Fim da promoção"><input type="date" value={endsOn} min={startsOn} onChange={(event) => setEndsOn(event.target.value)} required/></Field></div>
        <Toggle checked={active} onChange={setActive} label="Promoção ativa" description="Quando desativada, o desconto não aparece na página pública."/>
        <div><strong>Serviços participantes</strong><p className="ba-helper">Marque um ou mais serviços e informe o preço promocional de cada um.</p></div>
        <div className="ba-promotion-service-grid">{services.filter((service) => service.active).map((service) => {
          const selected = Object.prototype.hasOwnProperty.call(itemPrices, service.id);
          return <article className={selected ? 'selected' : ''} key={service.id}><label><input type="checkbox" checked={selected} onChange={(event) => setItemPrices((current) => { const next = { ...current }; if (event.target.checked) next[service.id] = ''; else delete next[service.id]; return next; })}/><span><strong>{service.name}</strong><small>Preço normal: {money(service.price_cents)}</small></span></label>{selected && <Field label="Preço promocional (R$)"><input type="number" min="0.01" max={(service.price_cents - 1) / 100} step="0.01" value={itemPrices[service.id]} onChange={(event) => setItemPrices((current) => ({ ...current, [service.id]: event.target.value }))} required/></Field>}</article>;
        })}</div>
        <p className="ba-helper"><ShieldCheck size={14}/> O preço promocional deve ser menor que o preço normal. Campanhas com descontos diferentes para o mesmo serviço não devem ter datas sobrepostas.</p>
        <div className="ba-form-actions"><button className="ba-button ba-button-outline" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="ba-button ba-button-primary" type="submit"><Save size={15}/> {editingId ? 'Salvar promoção' : 'Criar promoção'}</button></div>
      </form> : <p className="ba-helper">Defina o período e os preços especiais dos serviços. Depois acompanhe o estado de cada campanha na lista abaixo.</p>}
    </section>
    <section className="ba-card ba-promotion-directory">
      <CardHeading eyebrow="CAMPANHAS CADASTRADAS" title="Suas promoções" action={<CountPill>{promotions.length}</CountPill>}/>
      <div className="ba-promotion-filters">{['all', 'active', 'scheduled', 'ended', 'paused'].map((key) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{key === 'all' ? 'Todas' : key === 'active' ? 'Ativas' : key === 'scheduled' ? 'Programadas' : key === 'ended' ? 'Encerradas' : 'Pausadas'}</button>)}</div>
      <div className="ba-promotion-list">{filtered.map((promotion) => {
        const state = statusFor(promotion);
        return <article className="ba-promotion-card" key={promotion.id}>
          <div className="ba-promotion-title"><span><Tag size={18}/></span><div><strong>{promotion.name}</strong><em className={'ba-promotion-status ' + state}>{statusLabel[state]}</em></div></div>
          <p className="ba-promotion-date"><CalendarDays size={14}/> {dateLabel(promotion.starts_on, { day: '2-digit', month: 'short', year: 'numeric' })} até {dateLabel(promotion.ends_on, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <div className="ba-promotion-prices">{promotion.items.map((item) => {
            const service = services.find((entry) => entry.id === item.service_id);
            return <div key={item.service_id}><span><strong>{service?.name || 'Serviço'}</strong><small><s>{money(service?.price_cents || item.promotional_price_cents)}</s></small></span><span><strong>{money(item.promotional_price_cents)}</strong><small>Promoção</small></span></div>;
          })}</div>
          <div className="ba-promotion-actions"><button className="ba-button ba-button-outline" onClick={() => edit(promotion)}><Pencil size={14}/> Editar</button>{state !== 'ended' && <button className="ba-button ba-button-outline" onClick={() => setPromotions((items) => items.map((item) => item.id === promotion.id ? { ...item, active: !item.active } : item))}>{promotion.active ? <PauseCircle size={14}/> : <PlayCircle size={14}/>} {promotion.active ? 'Pausar' : 'Ativar'}</button>}</div>
        </article>;
      })}</div>
    </section>
  </div>;
}

function HoursView({ hours, setHours, notify }) {
  function patch(weekday, changes) { setHours((items) => items.map((item) => item.weekday === weekday ? { ...item, ...changes } : item)); }
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">DISPONIBILIDADE DA AGENDA</span><h2>Horários de funcionamento.</h2><p>Defina em quais dias e períodos o público poderá encontrar horários para reservar.</p></div></div>
    <div className="ba-notice"><AlertCircle size={17}/><span>Os horários disponíveis são calculados a partir do expediente, dos intervalos, da duração dos serviços, dos agendamentos e dos bloqueios cadastrados.</span></div>
    <section className="ba-card ba-hours-card">
      <CardHeading eyebrow="CONFIGURAÇÃO SEMANAL" title="Funcionamento semanal" action={<span className="ba-timezone">Horário local · Sidrolândia (MS)</span>}/>
      <div className="ba-hours-table-head"><span>Dia</span><span>Atende?</span><span>Abertura</span><span>Fechamento</span><span>Início do intervalo</span><span>Fim do intervalo</span></div>
      <div className="ba-hours-list">{hours.map((hour) => <div className={'ba-hours-row' + (!hour.enabled ? ' disabled' : '')} key={hour.weekday}>
        <strong>{WEEKDAYS[hour.weekday]}</strong>
        <Toggle checked={hour.enabled} onChange={(checked) => patch(hour.weekday, { enabled: checked, start_time: checked ? hour.start_time || '09:00' : null, end_time: checked ? hour.end_time || '18:00' : null })} label={hour.enabled ? 'Sim' : 'Não'} compact/>
        <label><span>Abertura</span><input type="time" disabled={!hour.enabled} value={hour.start_time || ''} onChange={(event) => patch(hour.weekday, { start_time: event.target.value })}/></label>
        <label><span>Fechamento</span><input type="time" disabled={!hour.enabled} value={hour.end_time || ''} onChange={(event) => patch(hour.weekday, { end_time: event.target.value })}/></label>
        <label><span>Início do intervalo</span><input type="time" disabled={!hour.enabled} value={hour.break_start || ''} onChange={(event) => patch(hour.weekday, { break_start: event.target.value, break_end: event.target.value ? hour.break_end : null })}/></label>
        <label><span>Fim do intervalo</span><input type="time" disabled={!hour.enabled} value={hour.break_end || ''} onChange={(event) => patch(hour.weekday, { break_end: event.target.value, break_start: event.target.value ? hour.break_start : null })}/></label>
      </div>)}</div>
      <div className="ba-hours-footer"><span>Intervalos opcionais, por exemplo, para o almoço.</span><button className="ba-button ba-button-primary" onClick={() => notify('Funcionamento semanal salvo na demonstração.')}><Save size={15}/> Salvar funcionamento</button></div>
    </section>
    <p className="ba-demo-note"><ShieldCheck size={14}/> No P18, a agenda começa intencionalmente fechada até a profissional configurar os dias e os horários reais.</p>
  </div>;
}

function BlocksView({ blocks, setBlocks, notify }) {
  const [date, setDate] = useState(dateValue(3));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  function addBlock(event) {
    event.preventDefault();
    if (Boolean(start) !== Boolean(end)) { notify('Informe os dois horários ou deixe ambos vazios para bloquear o dia inteiro.'); return; }
    setBlocks((items) => [{ id: 'b' + Date.now(), blocked_date: date, start_time: start || null, end_time: end || null, note }, ...items]);
    setStart(''); setEnd(''); setNote('');
    notify('Bloqueio de agenda adicionado.');
  }
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">EXCEÇÕES À ROTINA</span><h2>Bloqueios de agenda.</h2><p>Reserve períodos para folgas, compromissos, feriados ou pausas fora do horário semanal.</p></div><CountPill>{blocks.length} bloqueios</CountPill></div>
    <div className="ba-two-column ba-blocks-layout">
      <section className="ba-card">
        <CardHeading eyebrow="NOVA EXCEÇÃO" title="Reservar um período" />
        <form className="ba-form-stack" onSubmit={addBlock}>
          <Field label="Data"><input type="date" min={dateValue(0)} value={date} onChange={(event) => setDate(event.target.value)} required/></Field>
          <div className="ba-form-grid"><Field label="Das (opcional)"><input type="time" value={start} onChange={(event) => setStart(event.target.value)}/></Field><Field label="Até (opcional)"><input type="time" value={end} onChange={(event) => setEnd(event.target.value)}/></Field></div>
          <Field label="Motivo ou observação"><input maxLength={120} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: compromisso pessoal"/></Field>
          <button className="ba-button ba-button-primary" type="submit"><Plus size={15}/> Adicionar bloqueio</button>
          <small className="ba-helper">Deixe os dois horários vazios para bloquear o dia inteiro.</small>
        </form>
      </section>
      <section className="ba-card">
        <CardHeading eyebrow="AGENDA" title="Próximos bloqueios" action={<CountPill>{blocks.length}</CountPill>}/>
        <div className="ba-block-list">{blocks.length ? blocks.map((block) => <article key={block.id} className="ba-block-row"><div className="ba-block-date"><strong>{dateLabel(block.blocked_date, { day: '2-digit' })}</strong><small>{dateLabel(block.blocked_date, { month: 'short' })}</small></div><div><strong>{new Date(block.blocked_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}</strong><span>{block.start_time ? block.start_time + '–' + block.end_time : 'Dia inteiro'}</span><small>{block.note || 'Sem observações'}</small></div><button className="ba-icon-button danger" onClick={() => setBlocks((items) => items.filter((item) => item.id !== block.id))} aria-label="Remover bloqueio"><Trash2 size={15}/></button></article>) : <div className="ba-empty"><CalendarDays size={24}/><strong>Nenhum bloqueio futuro</strong><p>Os períodos cadastrados aparecerão aqui.</p></div>}</div>
      </section>
    </div>
  </div>;
}

function PoliciesView({ policies, setPolicies, notify }) {
  function patch(changes) { setPolicies((current) => ({ ...current, ...changes })); }
  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">REGRAS DO ESTÚDIO</span><h2>Orientações para clientes.</h2><p>Escolha quais avisos serão apresentados antes da cliente concluir a solicitação de agendamento.</p></div></div>
    <div className="ba-notice"><ShieldCheck size={17}/><span>Você escolhe quais orientações aparecem na página pública. Se todas estiverem desativadas, a área de avisos não é exibida.</span></div>
    <section className="ba-card">
      <CardHeading eyebrow="CONTROLE DE EXIBIÇÃO" title="Orientações do estúdio"/>
      <p className="ba-helper">Ative somente as políticas que já foram definidas pelo negócio. Os dados abaixo são fictícios e editáveis na demonstração.</p>
      <div className="ba-policy-grid">
        <Toggle checked={policies.show_lateness_policy} onChange={(value) => patch({ show_lateness_policy: value })} label="Mostrar tolerância a atrasos" description="Exibe o prazo permitido para chegar atrasada."/>
        <Toggle checked={policies.show_cancellation_policy} onChange={(value) => patch({ show_cancellation_policy: value })} label="Mostrar prazo de cancelamento" description="Exibe com quantas horas de antecedência avisar."/>
        <Toggle checked={policies.show_companion_policy} onChange={(value) => patch({ show_companion_policy: value })} label="Mostrar aviso sobre acompanhantes" description="Orientação sobre acompanhantes e crianças."/>
        <Toggle checked={policies.show_no_show_policy} onChange={(value) => patch({ show_no_show_policy: value })} label="Mostrar política de faltas e sinal" description="Texto sobre faltas, cancelamento e sinal pago."/>
      </div>
      {policies.show_lateness_policy && <Field label="Tolerância de atraso (minutos)"><input type="number" min="0" max="60" value={policies.lateness_tolerance_minutes} onChange={(event) => patch({ lateness_tolerance_minutes: Number(event.target.value) })}/></Field>}
      {policies.show_cancellation_policy && <Field label="Prazo para avisar (horas)"><input type="number" min="0" max="168" value={policies.cancellation_notice_hours} onChange={(event) => patch({ cancellation_notice_hours: Number(event.target.value) })}/></Field>}
      {policies.show_companion_policy && <Field label="Acompanhantes e crianças"><textarea rows={4} maxLength={700} value={policies.companion_policy} onChange={(event) => patch({ companion_policy: event.target.value })}/></Field>}
      {policies.show_no_show_policy && <Field label="Faltas e sinal pago"><textarea rows={4} maxLength={700} value={policies.no_show_policy} onChange={(event) => patch({ no_show_policy: event.target.value })}/></Field>}
      <div className="ba-form-actions"><span className="ba-helper"><ShieldCheck size={14}/> As orientações são exibidas no agendamento público.</span><button className="ba-button ba-button-primary" onClick={() => notify('Orientações salvas na demonstração.')}><Save size={15}/> Salvar orientações</button></div>
    </section>
  </div>;
}

function FinanceView({ appointments, financialEntries, setFinancialEntries, payables, setPayables, notify, setAppointments }) {
  const [month, setMonth] = useState(dateValue(0).slice(0, 7));
  const [showReceivables, setShowReceivables] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [showPayables, setShowPayables] = useState(true);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [entryDirection, setEntryDirection] = useState('income');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryCategory, setEntryCategory] = useState('Serviços');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(dateValue(0));
  const [entryMethod, setEntryMethod] = useState('Pix');
  const [payableDescription, setPayableDescription] = useState('');
  const [payableCategory, setPayableCategory] = useState('Estrutura');
  const [payableAmount, setPayableAmount] = useState('');
  const [payableDue, setPayableDue] = useState(dateValue(7));
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Pix');

  const monthEntries = financialEntries.filter((entry) => entry.movement_date.startsWith(month)).sort((a, b) => b.movement_date.localeCompare(a.movement_date));
  const monthIncome = monthEntries.filter((entry) => entry.direction === 'income').reduce((sum, item) => sum + item.amount_cents, 0);
  const monthExpenses = monthEntries.filter((entry) => entry.direction === 'expense').reduce((sum, item) => sum + item.amount_cents, 0);
  const openPayables = payables.filter((item) => item.status === 'pending');
  const pendingTotal = openPayables.reduce((sum, item) => sum + item.amount_cents, 0);
  const receivables = appointments.filter((appointment) => ['confirmed', 'completed'].includes(appointment.status) && new Date(appointment.ends_at).getTime() <= Date.now()).map((appointment) => {
    const related = financialEntries.filter((entry) => entry.related_appointment_id === String(appointment.id));
    const alreadyReceived = related.reduce((sum, entry) => sum + entry.amount_cents, 0);
    return { appointment, alreadyReceived, remaining: Math.max(0, appointment.price_cents - alreadyReceived) };
  }).filter((item) => item.remaining > 0);
  const pendingReceivablesTotal = receivables.reduce((sum, item) => sum + item.remaining, 0);

  function submitEntry(event) {
    event.preventDefault();
    const amount = Math.round(Number(entryAmount.replace(',', '.')) * 100);
    if (!entryDescription.trim() || amount <= 0) return;
    setFinancialEntries((items) => [{ id: 'f' + Date.now(), direction: entryDirection, description: entryDescription.trim(), category: entryCategory, amount_cents: amount, movement_date: entryDate, payment_method: entryMethod, source_type: 'manual', related_appointment_id: null }, ...items]);
    setEntryDescription(''); setEntryAmount(''); setShowEntryForm(false);
    notify('Movimentação demonstrativa registrada.');
  }
  function submitPayable(event) {
    event.preventDefault();
    const amount = Math.round(Number(payableAmount.replace(',', '.')) * 100);
    if (!payableDescription.trim() || amount <= 0) return;
    setPayables((items) => [{ id: 'p' + Date.now(), description: payableDescription, category: payableCategory, amount_cents: amount, due_date: payableDue, status: 'pending', paid_at: null }, ...items]);
    setPayableDescription(''); setPayableAmount(''); setShowPayableForm(false);
    notify('Conta a pagar demonstrativa cadastrada.');
  }
  function markPaid(payable) {
    setPayables((items) => items.map((item) => item.id === payable.id ? { ...item, status: 'paid', paid_at: new Date().toISOString() } : item));
    setFinancialEntries((items) => [...items, { id: 'fp' + Date.now(), direction: 'expense', description: payable.description, category: payable.category, amount_cents: payable.amount_cents, movement_date: dateValue(0), payment_method: 'Não informado', source_type: 'payable_payment', related_appointment_id: null }]);
    notify('Conta marcada como paga e lançada como saída.');
  }
  function registerBalance() {
    if (!selectedReceivable) return;
    const item = receivables.find((entry) => String(entry.appointment.id) === String(selectedReceivable));
    if (!item) return;
    setFinancialEntries((entries) => [...entries, { id: 'fb' + Date.now(), direction: 'income', description: 'Saldo · ' + item.appointment.customer_name, category: 'Saldo de atendimento', amount_cents: item.remaining, movement_date: dateValue(0), payment_method: paymentMethod, source_type: 'appointment_balance', related_appointment_id: String(item.appointment.id) }]);
    notify('Recebimento do saldo registrado e vinculado ao atendimento.');
    setSelectedReceivable(null);
    setPaymentMethod('Pix');
  }
  const selectedReceivableItem = receivables.find((item) => String(item.appointment.id) === String(selectedReceivable));

  return <div className="beauty-admin">
    <div className="ba-page-heading"><div><span className="beauty-kicker">CONTROLE DO ESTÚDIO</span><h2>Financeiro.</h2><p>Acompanhe entradas, saídas, sinais, saldos pendentes e contas a pagar.</p></div><Field label="Mês de referência"><input type="month" value={month} onChange={(event) => setMonth(event.target.value)}/></Field></div>
    <div className="ba-notice"><Wallet size={17}/><span>O sinal entra como receita somente após a confirmação do recebimento. O saldo do atendimento aparece para registro após o horário previsto; contas a pagar só viram saída quando forem marcadas como pagas.</span></div>
    <div className="ba-finance-metrics">
      <article className="income"><span><TrendingUp size={16}/> Entradas do mês</span><strong>{money(monthIncome)}</strong><small>{monthEntries.filter((entry) => entry.direction === 'income').length} movimentações</small></article>
      <article className="expense"><span><TrendingDown size={16}/> Saídas do mês</span><strong>{money(monthExpenses)}</strong><small>{monthEntries.filter((entry) => entry.direction === 'expense').length} movimentações</small></article>
      <article className="balance"><span><Wallet size={16}/> Resultado do mês</span><strong>{money(monthIncome - monthExpenses)}</strong><small>Entradas menos saídas registradas</small></article>
      <article className="receivable"><span><Clock3 size={16}/> Valores a receber</span><strong>{money(pendingReceivablesTotal)}</strong><small>{receivables.length} atendimentos com saldo pendente</small></article>
      <article className="due"><span><Receipt size={16}/> Contas a pagar</span><strong>{money(pendingTotal)}</strong><small>{openPayables.length} contas pendentes</small></article>
    </div>
    <section className="ba-card">
      <CardHeading eyebrow="ATENDIMENTOS" title="Valores a receber" action={<button className="ba-button ba-button-outline" onClick={() => setShowReceivables((value) => !value)}>{showReceivables ? 'Ocultar lista' : 'Ver atendimentos'} ({receivables.length}) <ChevronDown size={14}/></button>}/>
      {showReceivables && <div className="ba-receivables">{receivables.length ? receivables.map((item) => <article key={item.appointment.id}>
        <div className="ba-receivable-heading"><span><strong>{item.appointment.customer_name}</strong><small>{item.appointment.service.name} · {dateLabel(item.appointment.starts_at, { day: '2-digit', month: 'short', year: 'numeric' })}</small></span><em>#{item.appointment.public_code}</em></div>
        <div className="ba-receivable-breakdown"><div><span>Valor total</span><strong>{money(item.appointment.price_cents)}</strong></div><div><span>Já recebido</span><strong>{money(item.alreadyReceived)}</strong></div><div className="remaining"><span>Restante a receber</span><strong>{money(item.remaining)}</strong></div></div>
        <button className="ba-button ba-button-primary" onClick={() => setSelectedReceivable(String(item.appointment.id))}><CheckCircle2 size={15}/> Registrar recebimento do saldo</button>
      </article>) : <div className="ba-empty"><Wallet size={23}/><strong>Nenhum valor pendente</strong><p>Os saldos de atendimentos concluídos aparecerão aqui.</p></div>}</div>}
    </section>
    <div className="ba-two-column ba-finance-forms">
      <section className="ba-card">
        <CardHeading eyebrow="MOVIMENTAÇÃO" title="Registrar entrada ou saída"/>
        <button className="ba-button ba-button-outline ba-expand-button" onClick={() => setShowEntryForm((value) => !value)}>{showEntryForm ? 'Fechar formulário' : 'Registrar movimentação'} <ChevronDown size={14}/></button>
        {showEntryForm && <form className="ba-form-stack" onSubmit={submitEntry}>
          <Field label="Tipo de movimentação"><select value={entryDirection} onChange={(event) => setEntryDirection(event.target.value)}><option value="income">Entrada de dinheiro</option><option value="expense">Saída de dinheiro</option></select></Field>
          <Field label="Descrição"><input value={entryDescription} onChange={(event) => setEntryDescription(event.target.value)} required placeholder="Ex.: atendimento realizado"/></Field>
          <div className="ba-form-grid"><Field label="Categoria"><input value={entryCategory} onChange={(event) => setEntryCategory(event.target.value)}/></Field><Field label="Valor (R$)"><input inputMode="decimal" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} required placeholder="0,00"/></Field></div>
          <div className="ba-form-grid"><Field label="Data"><input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)}/></Field><Field label="Forma de recebimento/pagamento"><select value={entryMethod} onChange={(event) => setEntryMethod(event.target.value)}>{['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro'].map((item) => <option key={item}>{item}</option>)}</select></Field></div>
          <button className="ba-button ba-button-primary" type="submit"><Plus size={15}/> Registrar {entryDirection === 'income' ? 'entrada' : 'saída'}</button>
        </form>}
        <p className="ba-helper">Use para recebimentos e despesas que ainda não foram registrados automaticamente.</p>
      </section>
      <section className="ba-card">
        <CardHeading eyebrow="ORGANIZAÇÃO" title="Contas a pagar" action={<CountPill>{payables.length}</CountPill>}/>
        <button className="ba-button ba-button-outline ba-expand-button" onClick={() => setShowPayableForm((value) => !value)}>{showPayableForm ? 'Fechar formulário' : 'Cadastrar conta'} <ChevronDown size={14}/></button>
        {showPayableForm && <form className="ba-form-stack" onSubmit={submitPayable}>
          <Field label="Descrição"><input value={payableDescription} onChange={(event) => setPayableDescription(event.target.value)} required placeholder="Ex.: aluguel do espaço"/></Field>
          <div className="ba-form-grid"><Field label="Categoria"><input value={payableCategory} onChange={(event) => setPayableCategory(event.target.value)}/></Field><Field label="Valor (R$)"><input value={payableAmount} onChange={(event) => setPayableAmount(event.target.value)} inputMode="decimal" required placeholder="0,00"/></Field></div>
          <Field label="Vencimento"><input type="date" value={payableDue} onChange={(event) => setPayableDue(event.target.value)} required/></Field>
          <button className="ba-button ba-button-primary" type="submit"><Plus size={15}/> Cadastrar conta</button>
        </form>}
        <button className="ba-button ba-button-outline ba-expand-button" onClick={() => setShowPayables((value) => !value)}>{showPayables ? 'Ocultar contas' : 'Consultar contas'} ({payables.length}) <ChevronDown size={14}/></button>
        {showPayables && <div className="ba-payables-list">{payables.map((payable) => <article key={payable.id}><div><strong>{payable.description}</strong><small>{payable.category} · Vence {dateLabel(payable.due_date)}</small><em className={payable.status === 'paid' ? 'paid' : 'pending'}>{payable.status === 'paid' ? 'Paga' : payable.due_date < dateValue(0) ? 'Vencida · em aberto' : 'Em aberto'}</em></div><strong>{money(payable.amount_cents)}</strong><div>{payable.status === 'pending' ? <button className="ba-button ba-button-outline" onClick={() => markPaid(payable)}>Marcar como paga</button> : <small>Pagamento registrado</small>}</div></article>)}</div>}
        <p className="ba-helper">Uma conta só vira saída no financeiro quando for marcada como paga.</p>
      </section>
    </div>
    <section className="ba-card">
      <CardHeading eyebrow="RESUMO DE CAIXA" title={'Movimentações de ' + month.split('-').reverse().join('/')} action={<CountPill>{monthEntries.length}</CountPill>}/>
      <div className="ba-finance-entry-list">{(showAllMovements ? monthEntries : monthEntries.slice(0, 5)).map((entry) => <article key={entry.id}><span className={'ba-finance-entry-icon ' + entry.direction}>{entry.direction === 'income' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}</span><div><strong>{entry.description}</strong><small>{entry.category} · {dateLabel(entry.movement_date, { day: '2-digit', month: 'short', year: 'numeric' })}</small><em>{entry.source_type === 'appointment_deposit' ? 'Sinal de agendamento · confirmado' : entry.source_type === 'appointment_balance' ? 'Saldo de atendimento · ' + entry.payment_method : entry.source_type === 'payable_payment' ? 'Conta a pagar · saída registrada' : entry.payment_method}</em></div><strong className={entry.direction}>{entry.direction === 'income' ? '+' : '−'} {money(entry.amount_cents)}</strong>{entry.source_type === 'manual' && <button className="ba-icon-button danger" onClick={() => { if (window.confirm('Excluir esta movimentação manual?')) setFinancialEntries((items) => items.filter((item) => item.id !== entry.id)); }}><Trash2 size={14}/></button>}</article>)}</div>
      {monthEntries.length > 5 && <button className="ba-button ba-button-outline ba-expand-button" onClick={() => setShowAllMovements((value) => !value)}>{showAllMovements ? 'Mostrar só as 5 mais recentes' : 'Ver todas as movimentações (' + monthEntries.length + ')'}</button>}
      {!monthEntries.length && <div className="ba-empty"><Wallet size={23}/><strong>Nenhuma movimentação neste mês</strong></div>}
    </section>
    {selectedReceivableItem && <div className="ba-modal-backdrop"><section className="ba-receipt-modal"><div className="ba-section-heading"><div><span>CONFERÊNCIA DE RECEBIMENTO</span><h2>Registrar saldo recebido</h2></div><button className="ba-icon-button" onClick={() => setSelectedReceivable(null)}><X size={17}/></button></div><p>{selectedReceivableItem.appointment.customer_name} · {selectedReceivableItem.appointment.service.name}</p><div className="ba-receivable-breakdown"><div><span>Valor total</span><strong>{money(selectedReceivableItem.appointment.price_cents)}</strong></div><div><span>Já recebido</span><strong>{money(selectedReceivableItem.alreadyReceived)}</strong></div><div className="remaining"><span>Valor recebido agora</span><strong>{money(selectedReceivableItem.remaining)}</strong></div></div><Field label="Forma de recebimento"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Outro', 'Não informado'].map((item) => <option key={item}>{item}</option>)}</select></Field><p className="ba-helper"><ShieldCheck size={14}/> Confirme somente depois de verificar que o valor foi recebido.</p><div className="ba-form-actions"><button className="ba-button ba-button-outline" onClick={() => setSelectedReceivable(null)}>Cancelar</button><button className="ba-button ba-button-primary" onClick={registerBalance}><Check size={15}/> Confirmar recebimento</button></div></section></div>}
    <p className="ba-demo-note"><ShieldCheck size={14}/> Controle sem integração bancária automática. Sinais e saldos só entram no caixa após confirmação do recebimento.</p>
  </div>;
}
