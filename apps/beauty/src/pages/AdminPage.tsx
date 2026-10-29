import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CalendarCheck2, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, DoorClosed, ExternalLink, LogOut, MessageCircle, Phone, Plus, RefreshCw, Save, Scissors, Search, ShieldCheck, Sparkles, Tag, UserPlus, Users, UserRound, X, Wallet, TrendingDown, TrendingUp, Receipt, Trash2, Pencil, PauseCircle, PlayCircle, MoreHorizontal, Upload, SlidersHorizontal } from 'lucide-react'
import { ApiError, getAdminData, getAdminSession, getHealth, loginAdmin, logoutAdmin, createAdminAppointment, getAvailableSlots, updateAppointmentStatus, updateService, createService, deleteService, saveBusinessHours, saveBusinessPolicies, createDateBlock, removeDateBlock, createCustomer, importCustomers as importCustomersApi, updateCustomer, createFinancialEntry, deleteFinancialEntry, receiveAppointmentBalance, createPayable, markPayablePaid, deletePayable, createPromotion as createPromotionApi, updatePromotion as updatePromotionApi, type AdminRole, type ContactImportResult, type StorageMode } from '../lib/api'
import { formatBrazilPhone, formatBrazilPhoneInput } from '../lib/phone.mjs'
import { filterAppointments, type AppointmentPeriod, type AppointmentStatusFilter } from '../lib/appointment-filters.mjs'
import { parseVCardContacts } from '../lib/vcard.mjs'
import { BookingTimeWheelPicker } from '../components/BookingTimeWheelPicker'
import { STATUS_LABELS, WEEKDAYS, type Appointment, type AppointmentStatus, type BusinessHour, type BusinessPolicy, type CustomerProfile, type FinancialEntry, type Payable, type Promotion, type PromotionInput, type Service } from '../types'

const WHATSAPP_NUMBER = '556798580350'
const INITIAL_HOURS: BusinessHour[] = WEEKDAYS.map((_, weekday) => ({ weekday, start_time: null, end_time: null, break_start: null, break_end: null, enabled: false }))
const INITIAL_POLICIES: BusinessPolicy = { singleton: true, lateness_tolerance_minutes: 0, cancellation_notice_hours: 0, companion_policy: 'Política de acompanhantes pendente de confirmação pela Ana.', no_show_policy: 'Política de faltas, cancelamentos e sinal pendente de confirmação pela Ana.', show_lateness_policy: false, show_cancellation_policy: false, show_companion_policy: false, show_no_show_policy: false }

type Tab = 'overview' | 'appointments' | 'customers' | 'services' | 'promotions' | 'hours' | 'blocks' | 'policies' | 'finance'
type DateBlock = { id: string; blocked_date: string; start_time: string | null; end_time: string | null; note: string }

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' }).format(new Date(value))
}

function localDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function searchComparable(value: string) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

function whatsappHref(appointment: Appointment) {
  const customerPhone = digits(appointment.customer_phone)
  const phone = customerPhone.startsWith('55') ? customerPhone : `55${customerPhone}`
  const message = `Olá, ${appointment.customer_name}. Aqui é a Ana, da Ana Amaral Lash Designer. Estou entrando em contato sobre seu agendamento de ${appointment.service?.name ?? 'procedimento'} para ${formatDateTime(appointment.starts_at)}. ${appointment.status === 'awaiting_deposit' ? 'Para confirmar o horário, o sinal é de ' + formatPrice(appointment.deposit_cents) + '. Posso te passar as orientações para o pagamento?' : appointment.status === 'pending_confirmation' ? 'Recebi sua solicitação e estou entrando em contato para confirmar os detalhes do horário.' : appointment.status === 'confirmed' ? 'Seu horário está confirmado! Se precisar de alguma orientação antes do atendimento, estou à disposição.' : appointment.status === 'cancelled' ? 'Estou entrando em contato para confirmar o cancelamento deste horário.' : appointment.status === 'no_show' ? 'Estou entrando em contato sobre o atendimento agendado. Vamos conversar para alinhar os próximos passos.' : 'Obrigada por escolher a Ana Amaral Lash Designer. Espero que tenha gostado do atendimento!'}`
  return `https://wa.me/${phone || WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

function StatusPill({ status }: { status: AppointmentStatus }) {
  return <span className={`status-pill status-${status}`}>{STATUS_LABELS[status]}</span>
}

function HeaderBrand() {
  return <Link to="/agendar" className="admin-brand" aria-label="Voltar ao agendamento público"><img className="admin-brand-wordmark" src="/assets/branding/logo-ana-amaral-metalico.webp" alt="Ana Amaral" /><img className="admin-brand-lash-designer" src="/assets/branding/lash-designer-ana-amaral.webp" alt="" aria-hidden="true" /></Link>
}

export function AdminPage() {
  const [session, setSession] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminDisplayName, setAdminDisplayName] = useState('Ana Amaral')
  const [adminRole, setAdminRole] = useState<AdminRole>('studio_admin')
  const [storageMode, setStorageMode] = useState<StorageMode>('local-json')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([])
  const [payables, setPayables] = useState<Payable[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerRequireDeposit, setNewCustomerRequireDeposit] = useState(false)
  const [newCustomerInternalNote, setNewCustomerInternalNote] = useState('')
  const [hours, setHours] = useState<BusinessHour[]>(INITIAL_HOURS)
  const [policies, setPolicies] = useState<BusinessPolicy>(INITIAL_POLICIES)
  const [blocks, setBlocks] = useState<DateBlock[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [blockDate, setBlockDate] = useState('')
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockNote, setBlockNote] = useState('')
  const [appointmentFilter, setAppointmentFilter] = useState<'upcoming' | 'pending' | 'all'>('upcoming')

  useEffect(() => {
    let mounted = true
    Promise.all([getAdminSession(), getHealth()])
      .then(([auth, health]) => {
        if (!mounted) return
        setSession(auth.authenticated)
        setIsAdmin(auth.authenticated)
        if (auth.authenticated && auth.displayName && auth.role) {
          setAdminDisplayName(auth.displayName)
          setAdminRole(auth.role)
        }
        setStorageMode(health.storageMode)
        setAuthReady(true)
      })
      .catch(() => {
        if (!mounted) return
        setAuthReady(true)
        setPageError('Não foi possível conectar ao servidor do Sistema Ana. Confira se ele está iniciado e atualize a página.')
      })
    return () => { mounted = false }
  }, [])

  const loadData = useCallback(async (showLoading = true) => {
    if (!session) return
    if (showLoading) setLoadingData(true)
    setPageError('')
    try {
      const data = await getAdminData()
      setAppointments(data.appointments)
      setServices(data.services)
      setPromotions(data.promotions ?? [])
      setCustomers(data.customers ?? [])
      setFinancialEntries(data.financial_entries ?? [])
      setPayables(data.payables ?? [])
      setHours(INITIAL_HOURS.map((item) => data.hours.find((hour) => hour.weekday === item.weekday) ?? item))
      setBlocks(data.blocks)
      setPolicies(data.policies ?? INITIAL_POLICIES)
      setIsAdmin(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(false)
        setIsAdmin(false)
        setPageError('Sua sessão expirou. Entre novamente com seu ID e senha.')
      } else {
        setPageError(error instanceof Error ? error.message : 'Não foi possível carregar todos os dados. Atualize e tente novamente.')
      }
    } finally {
      if (showLoading) setLoadingData(false)
    }
  }, [session])

  useEffect(() => { if (session) void loadData() }, [session, loadData])
  // Sempre que o Financeiro é aberto, busca novamente os dados para refletir alterações feitas em Agendamentos.
  useEffect(() => { if (session && tab === 'finance') void loadData(false) }, [session, tab, loadData])

  const displayAppointments = appointments
  const today = useMemo(() => localDateString(new Date()), [])
  const pendingAppointments = displayAppointments.filter((appointment) => ['pending_confirmation', 'awaiting_deposit'].includes(appointment.status))
  const confirmedAppointments = displayAppointments.filter((appointment) => appointment.status === 'confirmed')
  const upcomingAppointments = displayAppointments.filter((appointment) => ['pending_confirmation', 'awaiting_deposit', 'confirmed'].includes(appointment.status) && appointment.starts_at >= new Date().toISOString())
  const todayAppointments = displayAppointments.filter((appointment) => localDateString(new Date(appointment.starts_at)) === today && !['cancelled', 'no_show'].includes(appointment.status))

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)
    try {
      const identity = await loginAdmin(loginId.trim().toUpperCase(), password)
      setAdminDisplayName(identity.displayName)
      setAdminRole(identity.role)
      setSession(true)
      setIsAdmin(true)
      setPageError('')
      setPassword('')
      setLoginId('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível entrar. Confira o ID e a senha.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    try { await logoutAdmin() } catch { /* Localiza-se fora da sessão mesmo se a rede estiver indisponível. */ }
    setSession(false)
    setIsAdmin(false)
    setAdminDisplayName('Ana Amaral')
    setAdminRole('studio_admin')
    setAppointments([])
    setTab('overview')
    setPassword('')
  }

  async function updateStatus(appointmentId: string, status: AppointmentStatus) {
    setSaving(true)
    setPageError('')
    try {
      const previous = appointments.find((appointment) => appointment.id === appointmentId)
      const updated = await updateAppointmentStatus(appointmentId, status)
      setAppointments((current) => current.map((appointment) => appointment.id === appointmentId ? { ...appointment, ...updated, service: updated.service ?? appointment.service } : appointment))
      if (previous && previous.status !== status && (previous.status === 'no_show' || status === 'no_show')) {
        const customerPhone = digits(previous.customer_phone)
        const delta = status === 'no_show' ? 1 : -1
        setCustomers((current) => current.map((customer) => digits(customer.phone) === customerPhone ? { ...customer, no_show_count: Math.max(0, customer.no_show_count + delta) } : customer))
      }
      setNotice('Status do atendimento atualizado.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível atualizar o atendimento. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function addAdminAppointment(input: { serviceId: string; serviceIds?: string[]; date: string; time: string; customerName: string; customerPhone: string; customerNote: string }): Promise<boolean> {
    setSaving(true)
    setPageError('')
    try {
      const booking = await createAdminAppointment(input)
      await loadData(false)
      setNotice(`Agendamento ${booking.public_code} criado e incluído na agenda.`)
      return true
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível criar o agendamento. Confira a disponibilidade.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveService(service: Service) {
    setSaving(true)
    setPageError('')
    try {
      const updated = await updateService(service)
      setServices((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Serviço "${updated.name}" atualizado.`)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível salvar esse serviço. Confira os valores.')
    } finally {
      setSaving(false)
    }
  }

  async function addService(input: { name: string; category: string; description: string; duration_minutes: number; price_cents: number; deposit_percent: number; active: boolean }): Promise<boolean> {
    setSaving(true)
    setPageError('')
    try {
      const created = await createService(input)
      setServices((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setNotice(`Serviço "${created.name}" criado.`)
      return true
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível criar o serviço.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function removeService(id: string): Promise<boolean> {
    setSaving(true)
    setPageError('')
    try {
      await deleteService(id)
      setServices((current) => current.filter((service) => service.id !== id))
      setNotice('Serviço removido do catálogo.')
      return true
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível remover o serviço. Se já foi usado, desative-o para preservar o histórico.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function savePromotion(id: string | null, input: PromotionInput): Promise<boolean> {
    setSaving(true)
    setPageError('')
    try {
      const saved = id ? await updatePromotionApi(id, input) : await createPromotionApi(input)
      setPromotions((current) => {
        const next = id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]
        return next.sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.name.localeCompare(b.name, 'pt-BR'))
      })
      setNotice(id ? `Promoção "${saved.name}" atualizada.` : `Promoção "${saved.name}" criada.`)
      return true
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível salvar a promoção. Confira datas, serviços e preços.')
      return false
    } finally {
      setSaving(false)
    }
  }

  function editService(id: string, patch: Partial<Service>) {
    setServices((current) => current.map((service) => service.id === id ? { ...service, ...patch } : service))
  }

  function editCustomer(id: string, patch: Partial<CustomerProfile>) {
    setCustomers((current) => current.map((customer) => customer.id === id ? { ...customer, ...patch } : customer))
  }

  async function saveCustomerProfile(customer: CustomerProfile) {
    setSaving(true)
    setPageError('')
    try {
      const updated = await updateCustomer(customer)
      setCustomers((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Cadastro de ${updated.name} atualizado.`)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível salvar o cadastro da cliente.')
    } finally {
      setSaving(false)
    }
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault()
    setSaving(true)
    setPageError('')
    try {
      const customer = await createCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone,
        require_deposit: newCustomerRequireDeposit,
        internal_note: newCustomerInternalNote.trim(),
      })
      setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setNewCustomerName('')
      setNewCustomerPhone('')
      setNewCustomerRequireDeposit(false)
      setNewCustomerInternalNote('')
      setNotice(`Cadastro de ${customer.name} criado.`)
      return true
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível cadastrar a cliente. Confira o nome e o telefone.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function importContactList(contacts: Array<{ name: string; phone: string }>): Promise<ContactImportResult | null> {
    setSaving(true)
    setPageError('')
    try {
      const result = await importCustomersApi(contacts)
      await loadData(false)
      setNotice(`Importação concluída: ${result.created} cadastros adicionados, ${result.duplicates} duplicados ignorados e ${result.invalid} registros inválidos ignorados.`)
      return result
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível importar os contatos. Confira o arquivo e tente novamente.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setPageError('')
    try {
      const updated = await saveBusinessHours(hours)
      setHours(INITIAL_HOURS.map((item) => updated.find((hour) => hour.weekday === item.weekday) ?? item))
      setNotice('Horários de funcionamento salvos. A agenda pública já considera essas regras.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível salvar os horários. Confira abertura, fechamento e intervalos.')
    } finally {
      setSaving(false)
    }
  }

  async function savePolicies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((policies.show_companion_policy && policies.companion_policy.trim().length < 10) ||
        (policies.show_no_show_policy && policies.no_show_policy.trim().length < 10)) {
      setPageError('Preencha o texto de cada orientação que estiver ativada (mínimo de 10 caracteres).')
      return
    }
    setSaving(true)
    setPageError('')
    try {
      const updated = await saveBusinessPolicies(policies)
      setPolicies(updated)
      setNotice('Orientações do estúdio atualizadas e exibidas no agendamento público.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível salvar as orientações.')
    } finally {
      setSaving(false)
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!blockDate) return
    if ((blockStart && !blockEnd) || (!blockStart && blockEnd) || (blockStart && blockEnd && blockStart >= blockEnd)) {
      setPageError('Para bloquear parte do dia, informe um horário inicial e final válidos. Deixe ambos vazios para bloquear o dia inteiro.')
      return
    }
    setSaving(true)
    setPageError('')
    try {
      const block = await createDateBlock({ blocked_date: blockDate, start_time: blockStart || null, end_time: blockEnd || null, note: blockNote.trim() })
      setBlocks((current) => [...current, block].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)))
      setNotice('Bloqueio adicionado à agenda.')
      setBlockDate(''); setBlockStart(''); setBlockEnd(''); setBlockNote('')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível criar o bloqueio. Verifique a data e os horários.')
    } finally {
      setSaving(false)
    }
  }

  async function removeBlock(id: string) {
    setSaving(true)
    setPageError('')
    try {
      await removeDateBlock(id)
      setBlocks((current) => current.filter((block) => block.id !== id))
      setNotice('Bloqueio removido.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível remover esse bloqueio.')
    } finally {
      setSaving(false)
    }
  }

  async function addFinancialEntry(input: { direction: 'income' | 'expense'; description: string; category: string; amount_cents: number; movement_date: string; payment_method: string }) {
    setSaving(true); setPageError('')
    try {
      const entry = await createFinancialEntry(input)
      setFinancialEntries((current) => [entry, ...current].sort((a, b) => b.movement_date.localeCompare(a.movement_date)))
      setNotice(input.direction === 'income' ? 'Entrada registrada no financeiro.' : 'Saída registrada no financeiro.')
      return true
    } catch (error) { setPageError(error instanceof Error ? error.message : 'Não foi possível registrar a movimentação.'); return false }
    finally { setSaving(false) }
  }

  async function removeFinancialEntry(id: string) {
    setSaving(true); setPageError('')
    try { await deleteFinancialEntry(id); setFinancialEntries((current) => current.filter((entry) => entry.id !== id)); setNotice('Movimentação removida.'); return true }
    catch (error) { setPageError(error instanceof Error ? error.message : 'Não foi possível remover a movimentação.'); return false }
    finally { setSaving(false) }
  }

  async function addPayable(input: { description: string; category: string; amount_cents: number; due_date: string }) {
    setSaving(true); setPageError('')
    try {
      const payable = await createPayable(input)
      setPayables((current) => [...current, payable].sort((a, b) => a.due_date.localeCompare(b.due_date)))
      setNotice('Conta a pagar cadastrada.')
      return true
    } catch (error) { setPageError(error instanceof Error ? error.message : 'Não foi possível cadastrar a conta.'); return false }
    finally { setSaving(false) }
  }

  async function settlePayable(id: string) {
    setSaving(true); setPageError('')
    try {
      const result = await markPayablePaid(id)
      await loadData()
      setNotice(result.already_paid ? 'Esta conta já estava marcada como paga.' : 'Conta marcada como paga e saída registrada no financeiro.')
      return true
    } catch (error) { setPageError(error instanceof Error ? error.message : 'Não foi possível marcar a conta como paga.'); return false }
    finally { setSaving(false) }
  }

  async function recordAppointmentBalance(appointmentId: string, paymentMethod: string) {
    setSaving(true); setPageError('')
    try {
      const result = await receiveAppointmentBalance(appointmentId, paymentMethod)
      setFinancialEntries((current) => current.some((entry) => entry.id === result.entry.id)
        ? current
        : [result.entry, ...current].sort((a, b) => b.movement_date.localeCompare(a.movement_date) || b.created_at.localeCompare(a.created_at)))
      setNotice(result.already_received ? 'Este saldo já estava registrado como recebido; não houve novo lançamento.' : 'Recebimento registrado no financeiro.')
      return true
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Não foi possível registrar o recebimento. Confira o pagamento e tente novamente.')
      return false
    } finally { setSaving(false) }
  }

  async function removePayable(id: string) {
    setSaving(true); setPageError('')
    try { await deletePayable(id); setPayables((current) => current.filter((payable) => payable.id !== id)); setNotice('Conta a pagar removida.'); return true }
    catch (error) { setPageError(error instanceof Error ? error.message : 'Não foi possível remover a conta.'); return false }
    finally { setSaving(false) }
  }

  const navItems: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'overview', label: 'Visão geral', icon: Sparkles },
    { id: 'appointments', label: 'Agendamentos', icon: CalendarCheck2 },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'promotions', label: 'Promoções', icon: Tag },
    { id: 'hours', label: 'Horários', icon: Clock3 },
    { id: 'blocks', label: 'Bloqueios', icon: DoorClosed },
    { id: 'policies', label: 'Políticas', icon: ShieldCheck },
    { id: 'finance', label: 'Financeiro', icon: Wallet },
  ]

  if (!authReady) return <div className="auth-loading"><RefreshCw className="spin" size={22} /><span>Conferindo o acesso...</span></div>

  if (!session) {
    return <main className="admin-login-page">
      <header className="login-top"><HeaderBrand /><Link to="/" className="back-to-booking"><ArrowLeft size={16} /> Agendamento público</Link></header>
      <section className="login-card">
        <div className="login-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">ÁREA RESTRITA</p>
        <h1>Acesse o painel<br /><em>administrativo.</em></h1>
        <p className="login-copy">Entre com seu ID individual para administrar a agenda e as configurações do estúdio.</p>
        <form onSubmit={handleLogin} className="login-form">
          <label htmlFor="admin-login-id">ID de acesso</label><input id="admin-login-id" type="text" autoComplete="username" autoCapitalize="characters" spellCheck={false} placeholder="Digite seu ID de acesso" value={loginId} onChange={(event) => setLoginId(event.target.value)} required />
          <label htmlFor="admin-password">Senha</label><input id="admin-password" type="password" autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {authError && <div className="inline-error" role="alert">{authError}</div>}
          {pageError && <div className="inline-error" role="alert">{pageError}</div>}
          <button className="button button-primary button-full" disabled={authBusy}>{authBusy ? 'Entrando...' : 'Entrar no painel'} <ArrowRightIcon /></button>
        </form>
        <span className="login-security"><ShieldCheck size={14} /> Acesso protegido e exclusivo.</span>
      </section>
    </main>
  }

  if (session && !isAdmin && pageError) {
    return <main className="admin-login-page"><header className="login-top"><HeaderBrand /><button onClick={() => void handleLogout()} className="back-to-booking"><LogOut size={16} /> Sair</button></header><section className="login-card"><div className="login-icon warning"><AlertCircle size={24} /></div><h1>Acesso <em>restrito.</em></h1><p className="login-copy">{pageError}</p><button className="button button-primary button-full" onClick={() => void handleLogout()}>Voltar para o login</button></section></main>
  }

  return <AdminShell tab={tab} setTab={setTab} navItems={navItems} onLogout={handleLogout} onRefresh={() => void loadData()} demo={storageMode === 'local-json'} adminDisplayName={adminDisplayName} adminRole={adminRole}>
    {storageMode === 'local-json' && <div className="preview-admin-banner"><AlertCircle size={18} /><div><strong>Ambiente de desenvolvimento local</strong><span>As alterações ficam no arquivo data/local-db.json deste computador. O sistema ainda não foi publicado na internet.</span></div></div>}
    {notice && <div className="notice-banner"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    {pageError && <div className="error-banner"><AlertCircle size={17} /><span>{pageError}</span><button onClick={() => setPageError('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    {loadingData ? <div className="loading-admin"><RefreshCw className="spin" size={20} /> Carregando dados da agenda...</div> : <AdminContents adminDisplayName={adminDisplayName} tab={tab} setTab={setTab} appointments={displayAppointments} services={services} promotions={promotions} onSavePromotion={savePromotion} customers={customers} financialEntries={financialEntries} payables={payables} onCreateFinancialEntry={addFinancialEntry} onDeleteFinancialEntry={removeFinancialEntry} onCreatePayable={addPayable} onMarkPayablePaid={settlePayable} onDeletePayable={removePayable} onReceiveAppointmentBalance={recordAppointmentBalance} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} newCustomerName={newCustomerName} setNewCustomerName={setNewCustomerName} newCustomerPhone={newCustomerPhone} setNewCustomerPhone={setNewCustomerPhone} newCustomerRequireDeposit={newCustomerRequireDeposit} setNewCustomerRequireDeposit={setNewCustomerRequireDeposit} newCustomerInternalNote={newCustomerInternalNote} setNewCustomerInternalNote={setNewCustomerInternalNote} onCreateCustomer={addCustomer} onImportCustomers={importContactList} onCustomerChange={editCustomer} onSaveCustomer={saveCustomerProfile} hours={hours} setHours={setHours} policies={policies} setPolicies={setPolicies} onSavePolicies={savePolicies} blocks={blocks} onStatusChange={(id, status) => void updateStatus(id, status)} onCreateAppointment={addAdminAppointment} onServiceChange={editService} onSaveService={(service) => void saveService(service)} onCreateService={addService} onDeleteService={removeService} onSaveHours={saveHours} onCreateBlock={createBlock} blockDate={blockDate} setBlockDate={setBlockDate} blockStart={blockStart} setBlockStart={setBlockStart} blockEnd={blockEnd} setBlockEnd={setBlockEnd} blockNote={blockNote} setBlockNote={setBlockNote} onRemoveBlock={removeBlock} todayCount={todayAppointments.length} pendingCount={pendingAppointments.length} confirmedCount={confirmedAppointments.length} upcoming={upcomingAppointments} appointmentFilter={appointmentFilter} setAppointmentFilter={setAppointmentFilter} saving={saving} />}
  </AdminShell>
}

function ArrowRightIcon() {
  return <span className="button-arrow">→</span>
}

type NavItem = { id: Tab; label: string; icon: typeof CalendarDays }
type AdminShellProps = { children: ReactNode; tab: Tab; setTab: (tab: Tab) => void; navItems: NavItem[]; onLogout?: () => void; onRefresh?: () => void; demo: boolean; adminDisplayName: string; adminRole: AdminRole }

function displayInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function AdminShell({ children, tab, setTab, navItems, onLogout, onRefresh, demo, adminDisplayName, adminRole }: AdminShellProps) {
  return <div className="admin-app">
    <aside className="admin-sidebar">
      <HeaderBrand />
      <div className="sidebar-divider" />
      <div className="sidebar-label">MENU PRINCIPAL</div>
      <nav className="admin-nav" aria-label="Painel administrativo">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><Icon size={18} /><span>{item.label}</span>{item.id === 'appointments' && <ChevronDown className="nav-chevron" size={13} />}</button> })}</nav>
      <div className="sidebar-bottom"><div className="sidebar-user-mark">{displayInitials(adminDisplayName)}</div><div className="sidebar-user"><strong>{adminDisplayName}</strong><span>{adminRole === 'owner' ? 'Proprietário' : 'Administradora'}</span></div><span className={`connection-indicator ${demo ? 'demo' : ''}`} title={demo ? 'Modo demonstração' : 'Conectado'} /></div>
    </aside>
    <div className="admin-main-wrap">
      <header className="admin-topbar"><div className="topbar-location"><span>Ana Amaral</span><span className="breadcrumb-separator">/</span><strong>{navItems.find((item) => item.id === tab)?.label}</strong></div><div className="topbar-actions"><Link to="/agendar" className="view-public-link" target="_blank"><ExternalLink size={15} /> Abrir agenda pública</Link>{onRefresh && <button className="icon-button" onClick={onRefresh} aria-label="Atualizar dados"><RefreshCw size={16} /></button>}{onLogout && <button className="icon-button" onClick={onLogout} aria-label="Sair do painel"><LogOut size={16} /></button>}</div></header>
      <main className="admin-content">{children}</main>
      <footer className="admin-footer"><span>Ana Amaral</span><span>Olhar que realça a sua beleza</span></footer>
    </div>
  </div>
}

type ContentsProps = {
  adminDisplayName: string
  tab: Tab
  setTab: (tab: Tab) => void
  appointments: Appointment[]
  services: Service[]
  promotions: Promotion[]
  onSavePromotion: (id: string | null, input: PromotionInput) => Promise<boolean>
  customers: CustomerProfile[]
  financialEntries: FinancialEntry[]
  payables: Payable[]
  onCreateFinancialEntry: (input: { direction: 'income' | 'expense'; description: string; category: string; amount_cents: number; movement_date: string; payment_method: string }) => Promise<boolean>
  onDeleteFinancialEntry: (id: string) => Promise<boolean>
  onCreatePayable: (input: { description: string; category: string; amount_cents: number; due_date: string }) => Promise<boolean>
  onMarkPayablePaid: (id: string) => Promise<boolean>
  onDeletePayable: (id: string) => Promise<boolean>
  onReceiveAppointmentBalance: (appointmentId: string, paymentMethod: string) => Promise<boolean>
  customerSearch: string
  setCustomerSearch: (value: string) => void
  newCustomerName: string
  setNewCustomerName: (value: string) => void
  newCustomerPhone: string
  setNewCustomerPhone: (value: string) => void
  newCustomerRequireDeposit: boolean
  setNewCustomerRequireDeposit: (value: boolean) => void
  newCustomerInternalNote: string
  setNewCustomerInternalNote: (value: string) => void
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onImportCustomers: (contacts: Array<{ name: string; phone: string }>) => Promise<ContactImportResult | null>
  onCustomerChange: (id: string, patch: Partial<CustomerProfile>) => void
  onSaveCustomer: (customer: CustomerProfile) => void
  hours: BusinessHour[]
  setHours: (hours: BusinessHour[] | ((current: BusinessHour[]) => BusinessHour[])) => void
  policies: BusinessPolicy
  setPolicies: (policies: BusinessPolicy) => void
  onSavePolicies: (event: FormEvent<HTMLFormElement>) => void
  blocks: DateBlock[]
  onStatusChange: (id: string, status: AppointmentStatus) => void
  onCreateAppointment: (input: { serviceId: string; serviceIds?: string[]; date: string; time: string; customerName: string; customerPhone: string; customerNote: string; allowMissingPhone?: boolean }) => Promise<boolean>
  onServiceChange: (id: string, patch: Partial<Service>) => void
  onSaveService: (service: Service) => void
  onCreateService: (input: { name: string; category: string; description: string; duration_minutes: number; price_cents: number; deposit_percent: number; active: boolean }) => Promise<boolean>
  onDeleteService: (id: string) => Promise<boolean>
  onSaveHours: (event: FormEvent<HTMLFormElement>) => void
  onCreateBlock: (event: FormEvent<HTMLFormElement>) => void
  blockDate: string
  setBlockDate: (value: string) => void
  blockStart: string
  setBlockStart: (value: string) => void
  blockEnd: string
  setBlockEnd: (value: string) => void
  blockNote: string
  setBlockNote: (value: string) => void
  onRemoveBlock: (id: string) => void
  todayCount: number
  pendingCount: number
  confirmedCount: number
  upcoming: Appointment[]
  appointmentFilter: 'upcoming' | 'pending' | 'all'
  setAppointmentFilter: (value: 'upcoming' | 'pending' | 'all') => void
  saving: boolean
}

function AdminContents(props: ContentsProps) {
  const { tab } = props
  if (tab === 'services') return <ServicesView {...props} />
  if (tab === 'promotions') return <PromotionsView {...props} />
  if (tab === 'customers') return <CustomersView {...props} />
  if (tab === 'hours') return <HoursView {...props} />
  if (tab === 'blocks') return <BlocksView {...props} />
  if (tab === 'policies') return <PoliciesView {...props} />
  if (tab === 'finance') return <FinanceView {...props} />
  if (tab === 'appointments') return <AppointmentsView {...props} />
  return <OverviewView {...props} />
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>
}

function OverviewView(props: ContentsProps) {
  const { adminDisplayName, todayCount, pendingCount, confirmedCount, upcoming, setTab, onStatusChange } = props
  return <>
    <PageHeading eyebrow="PAINEL DO ESTÚDIO" title={<>Olá, {adminDisplayName.split(/\s+/)[0]}<span className="heading-period">.</span></>}><span className="heading-date">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</span></PageHeading>
    <div className="welcome-strip"><div className="welcome-sparkle"><Sparkles size={21} /></div><div><strong>Cada detalhe faz parte de um olhar único.</strong><p>Acompanhe a agenda, organize os atendimentos e tenha tudo à mão para cuidar bem de cada cliente.</p></div><span className="welcome-diamond">✦</span></div>
    <div className="stats-grid">
      <StatCard label="Atendimentos hoje" value={String(todayCount).padStart(2, '0')} icon={CalendarDays} note="Na agenda de hoje" tint="rose" />
      <StatCard label="Pendentes" value={String(pendingCount).padStart(2, '0')} icon={Clock3} note="Aguardam confirmação ou sinal" tint="gold" />
      <StatCard label="Confirmados" value={String(confirmedCount).padStart(2, '0')} icon={CheckCircle2} note="Horários confirmados" tint="sage" />
      <StatCard label="Próximos atendimentos" value={String(upcoming.length).padStart(2, '0')} icon={Users} note="Reservas futuras ativas" tint="blue" />
    </div>
    <div className="dashboard-two-col">
      <section className="content-card upcoming-card"><div className="card-heading"><div><p className="eyebrow">AGENDA</p><h2>Próximos atendimentos</h2></div><button className="text-action" onClick={() => setTab('appointments')}>Ver todos <span>→</span></button></div>
        {upcoming.length ? <div className="appointment-list">{upcoming.slice(0, 5).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatusChange={onStatusChange} compact />)}</div> : <EmptyState icon={CalendarDays} title="Sua agenda está pronta para começar" message="Assim que chegarem as primeiras solicitações, você poderá acompanhar os horários e confirmar cada atendimento por aqui." />}
      </section>
      <section className="content-card quick-card"><p className="eyebrow">ACESSO RÁPIDO</p><h2>Prepare o estúdio para receber.</h2><p className="quick-intro">Configure os procedimentos e os horários de funcionamento antes de compartilhar a agenda.</p><button className="quick-action" onClick={() => setTab('appointments')}><span><CalendarCheck2 size={17} /></span><div><strong>Consultar agenda</strong><small>Acompanhe horários e confirmações</small></div><ArrowRightIcon /></button><button className="quick-action" onClick={() => setTab('services')}><span><Scissors size={17} /></span><div><strong>Editar serviços</strong><small>Preços, duração e disponibilidade</small></div><ArrowRightIcon /></button><button className="quick-action" onClick={() => setTab('hours')}><span><Clock3 size={17} /></span><div><strong>Configurar funcionamento</strong><small>Defina seus dias e horários</small></div><ArrowRightIcon /></button><div className="quick-note"><ShieldCheck size={17} /><span>A disponibilidade do site considera os horários configurados e evita reservas sobrepostas.</span></div></section>
    </div>
  </>
}

function StatCard({ label, value, icon: Icon, note, tint }: { label: string; value: string; icon: typeof CalendarDays; note: string; tint: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={19} /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div>
}

function AppointmentsView(props: ContentsProps) {
  const { appointments, services, promotions, customers, onStatusChange, onCreateAppointment, appointmentFilter, setAppointmentFilter, saving } = props
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(localDateString(new Date()))
  const [time, setTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [allowMissingPhone, setAllowMissingPhone] = useState(false)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [customerNote, setCustomerNote] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [showAppointmentFilters, setShowAppointmentFilters] = useState(false)
  const [appointmentSearch, setAppointmentSearch] = useState('')
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatusFilter>('all')
  const [appointmentPeriodFilter, setAppointmentPeriodFilter] = useState<AppointmentPeriod>('any')
  const [appointmentDateFrom, setAppointmentDateFrom] = useState('')
  const [appointmentDateTo, setAppointmentDateTo] = useState('')
  const activeServices = services.filter((service) => service.active)
  const selectedServices = activeServices.filter((service) => serviceIds.includes(service.id))
  const selectedPromotionById = new Map<string, { promotion_name: string; promotional_price_cents: number }>()
  for (const promotion of promotions) {
    if (!promotion.active || date < promotion.starts_on || date > promotion.ends_on) continue
    for (const item of promotion.items) {
      if (serviceIds.includes(item.service_id) && !selectedPromotionById.has(item.service_id)) {
        selectedPromotionById.set(item.service_id, { promotion_name: promotion.name, promotional_price_cents: item.promotional_price_cents })
      }
    }
  }
  const selectedTotalDuration = selectedServices.reduce((sum, service) => sum + service.duration_minutes, 0)
  const selectedRegularTotal = selectedServices.reduce((sum, service) => sum + service.price_cents, 0)
  const selectedTotal = selectedServices.reduce((sum, service) => sum + (selectedPromotionById.get(service.id)?.promotional_price_cents ?? service.price_cents), 0)
  const hasSelectedPromotion = selectedServices.some((service) => selectedPromotionById.has(service.id))
  const customerSuggestions = useMemo(() => {
    const query = searchComparable(customerName.trim())
    const queryDigits = digits(customerName)
    if (!query) return []
    return customers.filter((customer) => searchComparable(customer.name).includes(query) ||
      (queryDigits.length >= 3 && digits(customer.phone ?? '').includes(queryDigits)))
      .sort((a, b) => Number(searchComparable(b.name).startsWith(query)) - Number(searchComparable(a.name).startsWith(query)) || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 7)
  }, [customers, customerName])
  const maxDate = useMemo(() => {
    const value = new Date(`${localDateString(new Date())}T12:00:00Z`)
    value.setUTCDate(value.getUTCDate() + 60)
    return value.toISOString().slice(0, 10)
  }, [])

  useEffect(() => {
    setServiceIds((current) => current.filter((id) => activeServices.some((service) => service.id === id)))
  }, [services])

  useEffect(() => {
    if (!showCreateForm || !serviceIds.length || !date) { setSlots([]); return }
    let mounted = true
    setSlotsLoading(true)
    setSlotsError('')
    setTime('')
    getAvailableSlots(serviceIds, date)
      .then((next) => { if (mounted) setSlots(next) })
      .catch((error) => { if (mounted) { setSlots([]); setSlotsError(error instanceof Error ? error.message : 'Não foi possível consultar a agenda.') } })
      .finally(() => { if (mounted) setSlotsLoading(false) })
    return () => { mounted = false }
  }, [showCreateForm, serviceIds.join('|'), date])

  function selectCustomer(customer: CustomerProfile) {
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone ? formatBrazilPhoneInput(customer.phone) : '')
    setAllowMissingPhone(!customer.phone)
    setShowCustomerSuggestions(false)
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await onCreateAppointment({ serviceId: serviceIds[0], serviceIds, date, time, customerName, customerPhone, customerNote, allowMissingPhone })
    if (ok) {
      setServiceIds([]); setCustomerName(''); setCustomerPhone(''); setAllowMissingPhone(false); setCustomerNote(''); setTime('')
      setShowCustomerSuggestions(false)
      setShowCreateForm(false)
    }
  }

  const filtered = filterAppointments(appointments, {
    mode: appointmentFilter,
    search: appointmentSearch,
    status: appointmentStatusFilter,
    period: appointmentPeriodFilter,
    dateFrom: appointmentDateFrom,
    dateTo: appointmentDateTo,
  })
  const activeAdditionalFilterCount = Number(Boolean(appointmentSearch.trim()))
    + Number(appointmentStatusFilter !== 'all')
    + Number(appointmentPeriodFilter !== 'any')
  const customDateRangeInvalid = appointmentPeriodFilter === 'custom'
    && Boolean(appointmentDateFrom && appointmentDateTo && appointmentDateFrom > appointmentDateTo)
  const clearAppointmentFilters = () => {
    setAppointmentSearch('')
    setAppointmentStatusFilter('all')
    setAppointmentPeriodFilter('any')
    setAppointmentDateFrom('')
    setAppointmentDateTo('')
  }
  return <>
    <PageHeading eyebrow="ACOMPANHE SUA ROTINA" title={<>Agendamentos<span className="heading-period">.</span></>}><div className="appointment-heading-actions"><button className="button button-primary" type="button" onClick={() => setShowCreateForm((value) => !value)}><Plus size={16} /> {showCreateForm ? 'Fechar formulário' : 'Novo agendamento'}</button><button className="button button-outline" onClick={() => window.print()}>Imprimir agenda</button></div></PageHeading>
    {showCreateForm && <section className="content-card admin-booking-card">
      <div className="card-heading"><div><p className="eyebrow">LANÇAMENTO MANUAL</p><h2>Novo agendamento</h2><p>Escolha o procedimento e um dos horários livres da agenda.</p></div></div>
      <form className="admin-booking-form" onSubmit={submitAppointment}>
        <fieldset className="admin-service-multi-picker"><legend>Procedimentos</legend><p className="form-hint">Selecione um ou mais procedimentos. A duração e o valor total serão somados.</p>{activeServices.map((service) => {
          const promotion = selectedPromotionById.get(service.id)
          return <label className="admin-service-option" key={service.id}><input type="checkbox" name="admin-appointment-service" checked={serviceIds.includes(service.id)} onChange={() => { setServiceIds((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id]); setTime('') }} /><span><strong>{service.name}</strong><small>{service.duration_minutes} min{promotion ? ' · promoção' : ''}</small></span><b className="admin-service-option-price">{formatPrice(promotion?.promotional_price_cents ?? service.price_cents)}{promotion && <s>{formatPrice(service.price_cents)}</s>}</b></label>
        })}</fieldset>
        {selectedServices.length > 0 && <div className="selected-service-meta multi-service-total admin-multi-service-total"><span><Clock3 size={14} /> Duração total: {selectedTotalDuration} min</span><div className="selected-service-price"><strong>{formatPrice(selectedTotal)}</strong>{hasSelectedPromotion && <s>{formatPrice(selectedRegularTotal)}</s>}</div></div>}
        <label>Data<input type="date" value={date} min={localDateString(new Date())} max={maxDate} onChange={(event) => { setDate(event.target.value); setTime('') }} required /></label>
        <div className="admin-booking-time-field"><span>Horário</span>{slotsLoading ? <p className="form-hint">Consultando horários...</p> : <BookingTimeWheelPicker id="admin-booking-time" slots={slots} value={time} onChange={setTime} disabled={saving || !slots.length} />}</div>
        {slotsError && <p className="inline-error" role="alert">{slotsError}</p>}
        {!slotsLoading && !slotsError && showCreateForm && !serviceIds.length && <p className="form-hint" role="status">Selecione primeiro um ou mais procedimentos para consultar os horários disponíveis.</p>}
        {!slotsLoading && !slotsError && showCreateForm && serviceIds.length > 0 && !slots.length && <p className="form-hint">Não há horários disponíveis nessa data. Escolha outro dia ou ajuste o funcionamento em Horários.</p>}
        <div className="admin-booking-customer-autocomplete">
          <label>Nome completo<input value={customerName} onFocus={() => setShowCustomerSuggestions(true)} onBlur={() => window.setTimeout(() => setShowCustomerSuggestions(false), 150)} onChange={(event) => { setCustomerName(event.target.value); setCustomerPhone(''); setAllowMissingPhone(false); setShowCustomerSuggestions(true) }} autoComplete="off" aria-autocomplete="list" aria-expanded={showCustomerSuggestions && customerSuggestions.length > 0} aria-controls="admin-customer-suggestions" minLength={2} maxLength={100} required placeholder="Digite para buscar uma cliente" /></label>
          {showCustomerSuggestions && customerSuggestions.length > 0 && <div className="admin-customer-suggestions" id="admin-customer-suggestions" role="listbox" aria-label="Clientes cadastrados">
            {customerSuggestions.map((customer) => <button key={customer.id} type="button" role="option" aria-selected="false" className="admin-customer-suggestion" onClick={() => selectCustomer(customer)}>
              <span><strong>{customer.name}</strong><small>{customer.phone ? formatBrazilPhone(customer.phone) : 'Telefone não informado'}</small></span>
              <span className="admin-customer-suggestion-count">{customer.appointment_count} {customer.appointment_count === 1 ? 'agendamento' : 'agendamentos'}</span>
            </button>)}
          </div>}
          {showCustomerSuggestions && customerName.trim().length > 0 && customerSuggestions.length === 0 && <p className="form-hint">Nenhum cadastro encontrado. Você pode continuar preenchendo os dados manualmente.</p>}
        </div>
        <label>WhatsApp com DDD{allowMissingPhone ? ' (opcional)' : ''}<input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(formatBrazilPhoneInput(event.target.value))} autoComplete="tel" placeholder="(67) 99999-9999" maxLength={16} required={!allowMissingPhone} /></label>
        <label className="admin-booking-phone-toggle"><input type="checkbox" checked={allowMissingPhone} onChange={(event) => setAllowMissingPhone(event.target.checked)} /><span><strong>Agendar sem telefone</strong><small>Use somente quando a cliente não tiver um número disponível. O cadastro será criado ou reutilizado pelo nome.</small></span></label>
        <label className="admin-booking-note">Observação (opcional)<textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} maxLength={500} rows={2} /></label>
        <div className="admin-booking-actions"><button className="button button-primary" type="submit" disabled={saving || slotsLoading || !time || !serviceIds.length}>{saving ? 'Salvando...' : 'Criar agendamento'}</button><button className="button button-outline" type="button" onClick={() => setShowCreateForm(false)}>Cancelar</button></div>
      </form>
    </section>}
    <section className="appointment-filter-tools" aria-label="Buscar e filtrar agendamentos">
      <label className="appointment-search-field">
        <Search size={17} aria-hidden="true" />
        <input type="search" value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} placeholder="Nome, telefone ou procedimento" aria-label="Buscar por cliente, telefone ou procedimento" />
        {appointmentSearch && <button type="button" className="appointment-search-clear" onClick={() => setAppointmentSearch('')} aria-label="Limpar busca"><X size={15} /></button>}
      </label>
      <button className={`button button-outline appointment-filter-toggle${showAppointmentFilters || activeAdditionalFilterCount ? ' active' : ''}`} type="button" onClick={() => setShowAppointmentFilters((value) => !value)} aria-expanded={showAppointmentFilters} aria-controls="appointment-advanced-filters">
        <SlidersHorizontal size={16} /><span>Filtros</span>{activeAdditionalFilterCount > 0 && <span className="appointment-filter-count">{activeAdditionalFilterCount}</span>}<ChevronDown size={14} className={showAppointmentFilters ? 'is-open' : ''} />
      </button>
    </section>
    {showAppointmentFilters && <section id="appointment-advanced-filters" className="appointment-advanced-filters" aria-label="Filtros avançados de agendamentos">
      <label className="appointment-filter-field"><span>Situação</span><select value={appointmentStatusFilter} onChange={(event) => { const nextStatus = event.target.value as AppointmentStatusFilter; setAppointmentStatusFilter(nextStatus); if (nextStatus !== 'all') setAppointmentFilter('all') }}>
        <option value="all">Todos os status</option><option value="pending_confirmation">Aguardando confirmação</option><option value="awaiting_deposit">Aguardando sinal</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option>
      </select></label>
      <label className="appointment-filter-field"><span>Período</span><select value={appointmentPeriodFilter} onChange={(event) => setAppointmentPeriodFilter(event.target.value as AppointmentPeriod)}>
        <option value="any">Qualquer data</option><option value="today">Hoje</option><option value="next7">Próximos 7 dias</option><option value="month">Este mês</option><option value="custom">Intervalo personalizado</option>
      </select></label>
      {appointmentPeriodFilter === 'custom' && <div className="appointment-date-range">
        <label className="appointment-filter-field"><span>De</span><input type="date" value={appointmentDateFrom} max={appointmentDateTo || undefined} onChange={(event) => setAppointmentDateFrom(event.target.value)} /></label>
        <label className="appointment-filter-field"><span>Até</span><input type="date" value={appointmentDateTo} min={appointmentDateFrom || undefined} onChange={(event) => setAppointmentDateTo(event.target.value)} /></label>
        {customDateRangeInvalid && <p className="appointment-filter-error" role="alert">A data final precisa ser igual ou posterior à data inicial.</p>}
        {!appointmentDateFrom && !appointmentDateTo && <p className="appointment-filter-hint">Escolha uma data inicial e/ou final para limitar a busca.</p>}
      </div>}
      <div className="appointment-filter-footer"><span>{activeAdditionalFilterCount ? `${activeAdditionalFilterCount} ${activeAdditionalFilterCount === 1 ? 'filtro adicional aplicado' : 'filtros adicionais aplicados'}` : 'Nenhum filtro adicional aplicado'}</span><button type="button" className="text-action appointment-clear-filters" onClick={clearAppointmentFilters} disabled={activeAdditionalFilterCount === 0}>Limpar filtros</button></div>
    </section>}
    <div className="filter-toolbar"><div className="segmented-filters"><button className={appointmentFilter === 'upcoming' ? 'active' : ''} onClick={() => { setAppointmentFilter('upcoming'); setAppointmentStatusFilter('all') }}>Próximos</button><button className={appointmentFilter === 'pending' ? 'active' : ''} onClick={() => { setAppointmentFilter('pending'); setAppointmentStatusFilter('all') }}>Pendentes</button><button className={appointmentFilter === 'all' ? 'active' : ''} onClick={() => { setAppointmentFilter('all'); setAppointmentStatusFilter('all') }}>Todos</button></div><span className="results-count">{filtered.length} {filtered.length === 1 ? 'agendamento' : 'agendamentos'}</span></div>
    <section className="content-card appointment-table-card">{filtered.length ? <div className="appointment-list full-list">{filtered.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatusChange={onStatusChange} />)}</div> : <EmptyState icon={CalendarDays} title="Nenhum agendamento encontrado" message={activeAdditionalFilterCount || appointmentFilter !== 'upcoming' ? 'Tente ajustar ou limpar os filtros para ver outros resultados.' : 'Os próximos horários reservados pelo site aparecerão aqui.'} />}</section>
  </>
}

function AppointmentRow({ appointment, onStatusChange, compact = false }: { appointment: Appointment; onStatusChange: (id: string, status: AppointmentStatus) => void; compact?: boolean }) {
  const date = new Date(appointment.starts_at)
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Campo_Grande' }).format(date)
  const timeLabel = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' }).format(date)
  const customerInitials = appointment.customer_name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
  const flowHint = !compact && appointment.status === 'awaiting_deposit'
    ? appointment.deposit_reported
      ? 'A cliente avisou que fez o Pix. Confira o crédito no banco antes de selecionar “Confirmado”; isso registra o sinal no Financeiro.'
      : `Aguardando sinal de ${formatPrice(appointment.deposit_cents)}. Depois de conferir o crédito no banco, selecione “Confirmado” para registrar o sinal no Financeiro.`
    : !compact && appointment.status === 'confirmed'
      ? appointment.deposit_required && appointment.deposit_received
        ? 'Sinal registrado no Financeiro. Depois do atendimento, altere para “Concluído”.'
        : 'Horário confirmado. Depois do atendimento, altere para “Concluído”.'
      : null
  return <article className={`appointment-row ${compact ? 'compact' : ''}`}>
    <div className="appointment-date-block"><strong>{dateLabel}</strong><span>{timeLabel}</span></div>
    <div className="customer-avatar">{customerInitials}</div>
    <div className="appointment-main"><strong>{appointment.customer_name}</strong><span>{appointment.service?.name ?? 'Procedimento'}{appointment.customer_note ? ` · ${appointment.customer_note}` : ''}</span><small>Código {appointment.public_code}</small>{appointment.promotion_name && <span className="appointment-promotion-badge"><Tag size={12} /> {appointment.promotion_name} · {formatPrice(appointment.price_cents)} <s>{formatPrice(appointment.regular_price_cents ?? appointment.price_cents)}</s></span>}{appointment.status === 'awaiting_deposit' && appointment.deposit_required && appointment.deposit_reported && !appointment.deposit_received && <span className="deposit-reported-badge" role="status">Pix informado pela cliente</span>}</div>
    {!compact && <div className="appointment-value"><strong>{formatPrice(appointment.price_cents)}</strong><span>{appointment.deposit_required ? `Sinal ${formatPrice(appointment.deposit_cents)}${appointment.deposit_received ? ' · recebido' : ' · pendente'}` : 'Sem sinal obrigatório'}</span></div>}
    <div className={`appointment-end ${!compact ? 'appointment-end-editable' : ''}`}><StatusPill status={appointment.status} />{!compact && <><select className={`appointment-status-select appointment-status-select-${appointment.status}`} aria-label={`Alterar status de ${appointment.customer_name}`} value={appointment.status} onChange={(event) => onStatusChange(appointment.id, event.target.value as AppointmentStatus)}><option value="pending_confirmation">Aguardando confirmação</option><option value="awaiting_deposit">Aguardando sinal</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option></select>{flowHint && <small className={`appointment-flow-hint ${appointment.status === 'awaiting_deposit' ? 'appointment-flow-hint-deposit' : 'appointment-flow-hint-confirmed'}`}>{flowHint}</small>}</>}</div>
    <a className="whatsapp-action" href={whatsappHref(appointment)} target="_blank" rel="noreferrer" title="Abrir conversa direta no WhatsApp" aria-label={`Abrir WhatsApp para ${appointment.customer_name}`}><MessageCircle size={17} /></a>
  </article>
}

function ServicesView(props: ContentsProps) {
  const { services, onServiceChange, onSaveService, onCreateService, onDeleteService, saving } = props
  const [showNewService, setShowNewService] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Sobrancelhas')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('0.00')
  const [depositPercent, setDepositPercent] = useState('0')

  async function submitNewService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const resolvedCategory = category === 'Outro' ? customCategory.trim() : category
    const ok = await onCreateService({
      name: name.trim(), category: resolvedCategory, description: description.trim(),
      duration_minutes: Number(duration), price_cents: Math.round(Number(price.replace(',', '.')) * 100),
      deposit_percent: Number(depositPercent), active: true,
    })
    if (ok) {
      setName(''); setCategory('Sobrancelhas'); setCustomCategory(''); setDescription('')
      setDuration('30'); setPrice('0.00'); setDepositPercent('0'); setShowNewService(false)
    }
  }

  async function confirmDelete(service: Service) {
    if (window.confirm(`Remover "${service.name}" do catálogo? Se já foi usado em agendamento ou promoção, o sistema preservará o histórico e pedirá que você o desative.`)) {
      await onDeleteService(service.id)
    }
  }

  return <>
    <PageHeading eyebrow="CATÁLOGO DO ESTÚDIO" title={<>Serviços e valores<span className="heading-period">.</span></>}><span className="count-chip">{services.filter((service) => service.active).length} ativos</span></PageHeading>
    <div className="services-intro"><Scissors size={19} /><p>Adicione procedimentos, ajuste preço e duração ou desative serviços que não oferece mais. Serviços com histórico não são apagados para preservar os registros.</p></div>
    <section className="content-card service-create-card">
      <div className="card-heading"><div><p className="eyebrow">CATÁLOGO</p><h2>Novo procedimento</h2><p>Cadastre um serviço para aparecer na agenda.</p></div><button className="button button-primary" type="button" onClick={() => setShowNewService((value) => !value)}><Plus size={16} /> {showNewService ? 'Fechar' : 'Adicionar serviço'}</button></div>
      {showNewService && <form className="service-create-form" onSubmit={submitNewService}>
        <label>Nome do procedimento<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: Henna de sobrancelhas" /></label>
        <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Sobrancelhas</option><option>Cílios</option><option>Maquiagem</option><option>Outro</option></select></label>
        {category === 'Outro' && <label>Nome da categoria<input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} minLength={2} maxLength={100} required placeholder="Ex.: Pele" /></label>}
        <label>Descrição (opcional)<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Breve descrição do serviço" /></label>
        <div className="service-create-numbers">
          <label>Preço (R$)<input type="number" min="0" max="10000" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
          <label>Duração (minutos)<input type="number" min="15" max="600" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} required /></label>
          <label>Sinal (%)<input type="number" min="0" max="100" step="1" value={depositPercent} onChange={(event) => setDepositPercent(event.target.value)} required /></label>
        </div>
        <div className="service-create-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar serviço'}</button><button className="button button-outline" type="button" onClick={() => setShowNewService(false)}>Cancelar</button></div>
      </form>}
    </section>
    <div className="service-admin-list">{services.map((service) => <article className={`service-admin-card ${!service.active ? 'service-inactive' : ''}`} key={service.id}>
      <div className="service-admin-mark"><Scissors size={20} /></div><div className="service-admin-content"><div className="service-admin-title"><div><span>{service.category}</span><h3>{service.name}</h3></div><label className="switch-label"><input type="checkbox" checked={service.active} onChange={(event) => onServiceChange(service.id, { active: event.target.checked })} /><span className="switch-ui" /><span className="switch-text">{service.active ? 'Ativo' : 'Inativo'}</span></label></div>
      <div className="service-edit-grid"><label>Preço (R$)<input type="number" min="0" max="10000" step="0.01" value={(service.price_cents / 100).toFixed(2)} onChange={(event) => onServiceChange(service.id, { price_cents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })} /></label><label>Duração (minutos)<input type="number" min="15" max="600" step="1" value={service.duration_minutes} onChange={(event) => onServiceChange(service.id, { duration_minutes: Math.min(600, Math.max(15, Number(event.target.value || 15))) })} /></label><label>Sinal para cliente sinalizado (%)<input type="number" min="0" max="100" step="1" value={service.deposit_percent} onChange={(event) => onServiceChange(service.id, { deposit_percent: Math.min(100, Math.max(0, Number(event.target.value || 0))) })} /></label></div>
      <div className="service-admin-bottom"><span>Valor estimado quando o cadastro da cliente exigir sinal: <strong>{formatPrice(Math.round(service.price_cents * service.deposit_percent / 100))}</strong></span><div className="service-admin-actions"><button className="button button-outline button-small" onClick={() => onSaveService(service)} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button><button className="button button-outline button-small danger" onClick={() => void confirmDelete(service)} disabled={saving}>Excluir</button></div></div>
    </div></article>)}</div>
  </>
}

function PromotionsView({ services, promotions, onSavePromotion, saving }: ContentsProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState(localDateString(new Date()))
  const [endsOn, setEndsOn] = useState(localDateString(new Date()))
  const [active, setActive] = useState(true)
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'ended' | 'paused'>('all')
  const today = localDateString(new Date())
  const activeServices = services.filter((service) => service.active)

  function resetForm() {
    setEditingId(null)
    setName('')
    setStartsOn(today)
    setEndsOn(today)
    setActive(true)
    setItemPrices({})
    setShowForm(false)
  }

  function editPromotion(promotion: Promotion) {
    setEditingId(promotion.id)
    setName(promotion.name)
    setStartsOn(promotion.starts_on)
    setEndsOn(promotion.ends_on)
    setActive(promotion.active)
    setItemPrices(Object.fromEntries(promotion.items.map((item) => [item.service_id, (item.promotional_price_cents / 100).toFixed(2)])))
    setShowForm(true)
  }

  function getStatus(promotion: Promotion): 'active' | 'scheduled' | 'ended' | 'paused' {
    if (!promotion.active) return 'paused'
    if (promotion.ends_on < today) return 'ended'
    if (promotion.starts_on > today) return 'scheduled'
    return 'active'
  }

  const statusMeta = {
    active: { label: 'Ativa', filterLabel: 'Ativas' },
    scheduled: { label: 'Programada', filterLabel: 'Programadas' },
    ended: { label: 'Encerrada', filterLabel: 'Encerradas' },
    paused: { label: 'Pausada', filterLabel: 'Pausadas' },
  }
  const filteredPromotions = promotions.filter((promotion) => filter === 'all' || getStatus(promotion) === filter)
    .slice().sort((a, b) => b.starts_on.localeCompare(a.starts_on) || b.created_at.localeCompare(a.created_at))

  function formatDateOnly(value: string) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const items = Object.entries(itemPrices).filter(([, rawPrice]) => rawPrice.trim() !== '').map(([service_id, rawPrice]) => ({
      service_id,
      promotional_price_cents: Math.round(Number(rawPrice) * 100),
    }))
    const success = await onSavePromotion(editingId, { name, starts_on: startsOn, ends_on: endsOn, active, items })
    if (success) resetForm()
  }

  async function togglePromotion(promotion: Promotion) {
    await onSavePromotion(promotion.id, {
      name: promotion.name,
      starts_on: promotion.starts_on,
      ends_on: promotion.ends_on,
      active: !promotion.active,
      items: promotion.items.map((item) => ({ service_id: item.service_id, promotional_price_cents: item.promotional_price_cents })),
    })
  }

  return <>
    <PageHeading eyebrow="CAMPANHAS DO ESTÚDIO" title={<>Promoções<span className="heading-period">.</span></>}><span className="count-chip">{promotions.length} cadastradas</span></PageHeading>
    <div className="services-intro promotion-intro"><Tag size={19} /><p>Crie ofertas com data de início e término. O preço promocional será aplicado somente aos atendimentos marcados dentro da validade; os preços normais do catálogo continuam iguais.</p></div>

    <section className={`content-card promotion-create-card ${showForm ? 'is-open' : 'is-collapsed'}`}>
      <div className="promotion-create-heading">
        <div className="promotion-create-heading-copy">
          <p className="eyebrow">NOVA CAMPANHA</p>
          <h2>{editingId ? 'Editar promoção' : 'Criar promoção'}</h2>
          {!showForm && <p className="promotion-create-hint">Defina o período e os preços especiais dos serviços.</p>}
        </div>
        <button type="button" className="promotion-create-toggle" aria-expanded={showForm} aria-controls="promotion-create-form" onClick={() => showForm ? resetForm() : setShowForm(true)}>
          {showForm ? <X size={18} /> : <Plus size={20} />}
          <span>{showForm ? 'Fechar' : 'Nova promoção'}</span>
        </button>
      </div>
      {showForm && <form id="promotion-create-form" className="promotion-form" onSubmit={handleSubmit}>
        <label>Nome da promoção<input type="text" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} placeholder="Ex.: Promo da semana" required /></label>
        <div className="promotion-date-grid">
          <label>Início da promoção<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required /></label>
          <label>Fim da promoção<input type="date" value={endsOn} min={startsOn || undefined} onChange={(event) => setEndsOn(event.target.value)} required /></label>
        </div>
        <label className="promotion-active-toggle"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span><strong>Promoção ativa</strong><small>Se desativada, o desconto não será aplicado no site, mesmo dentro das datas.</small></span></label>
        <div className="promotion-services-heading"><strong>Serviços participantes</strong><small>Marque um ou mais serviços e informe o preço promocional de cada um.</small></div>
        <div className="promotion-service-options">{activeServices.map((service) => {
          const selected = Object.prototype.hasOwnProperty.call(itemPrices, service.id)
          return <div className={`promotion-service-option ${selected ? 'is-selected' : ''}`} key={service.id}>
            <label className="promotion-service-check"><input type="checkbox" checked={selected} onChange={(event) => setItemPrices((current) => {
              if (!event.target.checked) { const next = { ...current }; delete next[service.id]; return next }
              return { ...current, [service.id]: '' }
            })} /><span><strong>{service.name}</strong><small>Preço normal: {formatPrice(service.price_cents)}</small></span></label>
            {selected && <label className="promotion-price-field">Preço promocional (R$)<input type="number" inputMode="decimal" min="0.01" max={((service.price_cents - 1) / 100).toFixed(2)} step="0.01" value={itemPrices[service.id]} onChange={(event) => setItemPrices((current) => ({ ...current, [service.id]: event.target.value }))} placeholder="0,00" required /></label>}
          </div>
        })}</div>
        <p className="promotion-form-note"><ShieldCheck size={15} /> O preço promocional deve ser menor que o preço normal atual. Campanhas ativas não podem aplicar descontos diferentes ao mesmo serviço em períodos sobrepostos.</p>
        <div className="promotion-form-actions"><button type="button" className="button button-outline" onClick={resetForm} disabled={saving}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando...' : editingId ? 'Salvar promoção' : 'Criar promoção'} <Check size={16} /></button></div>
      </form>}
    </section>

    <section className="promotion-directory">
      <div className="promotion-directory-heading"><div><p className="eyebrow">CAMPANHAS CADASTRADAS</p><h2>Suas promoções</h2></div><span className="count-chip">{promotions.length}</span></div>
      <div className="promotion-filters" aria-label="Filtrar promoções">
        {(['all', 'active', 'scheduled', 'ended', 'paused'] as const).map((value) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'Todas' : statusMeta[value].filterLabel}</button>)}
      </div>
      {filteredPromotions.length ? <div className="promotion-admin-list">{filteredPromotions.map((promotion) => {
        const status = getStatus(promotion)
        const canToggle = promotion.ends_on >= today
        return <article className="content-card promotion-admin-card" key={promotion.id}>
          <div className="promotion-admin-card-heading"><div className="promotion-admin-icon"><Tag size={19} /></div><div className="promotion-admin-card-title"><h3>{promotion.name}</h3><span className={`promotion-status promotion-status-${status}`}>{statusMeta[status].label}</span></div></div>
          <div className="promotion-date-range"><CalendarDays size={15} /><span>{formatDateOnly(promotion.starts_on)} até {formatDateOnly(promotion.ends_on)}</span></div>
          <div className="promotion-item-list">{promotion.items.map((item) => {
            const service = services.find((candidate) => candidate.id === item.service_id)
            const regularPrice = service?.price_cents ?? item.regular_price_cents ?? item.promotional_price_cents
            return <div className="promotion-price-row" key={item.service_id}><div><strong>{service?.name ?? item.service_name ?? 'Serviço'}</strong><small><s>{formatPrice(regularPrice)}</s></small></div><div className="promotion-price-values"><strong>{formatPrice(item.promotional_price_cents)}</strong><small>Promoção</small></div></div>
          })}</div>
          <div className="promotion-card-actions"><button type="button" className="button button-outline button-small" onClick={() => editPromotion(promotion)}><Pencil size={14} /> Editar</button>{canToggle && <button type="button" className="button button-outline button-small" onClick={() => void togglePromotion(promotion)} disabled={saving}>{promotion.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}{promotion.active ? 'Pausar' : 'Ativar'}</button>}</div>
        </article>
      })}</div> : <div className="content-card promotion-empty"><EmptyState icon={Tag} title={filter === 'all' ? 'Nenhuma promoção cadastrada' : 'Nenhuma promoção nesta categoria'} message={filter === 'all' ? 'Crie a primeira campanha para oferecer preços especiais em datas específicas.' : 'Experimente outro filtro ou crie uma nova promoção.'} /></div>}
    </section>
  </>
}

function CustomersView(props: ContentsProps) {
  const {
    customers, customerSearch, setCustomerSearch,
    newCustomerName, setNewCustomerName, newCustomerPhone, setNewCustomerPhone,
    newCustomerRequireDeposit, setNewCustomerRequireDeposit,
    newCustomerInternalNote, setNewCustomerInternalNote,
    onCreateCustomer, onImportCustomers, onCustomerChange, onSaveCustomer, saving,
  } = props
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [showCustomerActions, setShowCustomerActions] = useState(false)
  const customerActionsRef = useRef<HTMLDivElement>(null)
  const contactFileInputRef = useRef<HTMLInputElement>(null)
  const [contactPreview, setContactPreview] = useState<{ fileName: string; contacts: Array<{ name: string; phone: string }>; ignored: number } | null>(null)
  const [contactFileError, setContactFileError] = useState('')
  const [contactImportResult, setContactImportResult] = useState<ContactImportResult | null>(null)
  useEffect(() => {
    if (!showCustomerActions) return
    function closeOnPointerDown(event: PointerEvent) {
      if (customerActionsRef.current && !customerActionsRef.current.contains(event.target as Node)) {
        setShowCustomerActions(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowCustomerActions(false)
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showCustomerActions])
  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    const created = await onCreateCustomer(event)
    if (created) setShowNewCustomerForm(false)
  }
  async function handleContactFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    setShowCustomerActions(false)
    setContactFileError('')
    setContactImportResult(null)
    setContactPreview(null)
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setContactFileError('O arquivo é muito grande. Exporte apenas nome e telefone ou selecione uma lista menor.')
      return
    }
    try {
      const parsed = parseVCardContacts(await file.text())
      if (parsed.contacts.length > 5000) {
        setContactFileError('O arquivo tem mais de 5.000 contatos válidos. Exporte uma lista menor para importar com segurança.')
        return
      }
      if (!parsed.contacts.length && !parsed.ignored) {
        setContactFileError('Não encontrei cartões de contato neste arquivo. Selecione um arquivo vCard (.vcf) exportado dos Contatos.')
        return
      }
      setContactPreview({ fileName: file.name, contacts: parsed.contacts, ignored: parsed.ignored })
    } catch {
      setContactFileError('Não foi possível ler esse arquivo. Exporte os contatos novamente como vCard (.vcf).')
    }
  }
  async function handleImportContacts() {
    if (!contactPreview?.contacts.length || saving) return
    const result = await onImportCustomers(contactPreview.contacts)
    if (result) {
      setContactImportResult({ ...result, invalid: result.invalid + (contactPreview?.ignored ?? 0) })
      setContactPreview(null)
    }
  }
  const query = customerSearch.trim().toLocaleLowerCase('pt-BR')
  const queryDigits = customerSearch.replace(/\D/g, '')
  const filtered = customers.filter((customer) => {
    const matchesText = `${customer.name} ${customer.phone}`.toLocaleLowerCase('pt-BR').includes(query)
    const matchesPhone = queryDigits.length > 0 && digits(customer.phone).includes(queryDigits)
    return !query || matchesText || matchesPhone
  })
  return <>
    <PageHeading eyebrow="CADASTRO E PREFERÊNCIAS INDIVIDUAIS" title={<>Clientes e preferências individuais<span className="heading-period">.</span></>}><span className="count-chip">{customers.length} cadastrados</span></PageHeading>
    <div className="notice-soft"><ShieldCheck size={17} /><span>O sinal não é obrigatório por serviço. Marque manualmente os clientes para os quais deseja exigir sinal nas próximas reservas. Registrar uma falta não ativa o sinal automaticamente; a decisão fica com a administração. As observações desta tela são internas e não aparecem no site público.</span></div>
    <div className="customers-admin-layout">
      <section className={`content-card customer-create-card ${showNewCustomerForm ? 'is-open' : 'is-collapsed'}`}>
        <div className="customer-create-heading">
          <div className="customer-create-heading-copy">
            <p className="eyebrow">CADASTRO DE CLIENTES</p>
            <h2>Adicionar cliente</h2>
            {!showNewCustomerForm && <p className="customer-create-hint">Cadastre uma cliente ou importe contatos de um arquivo vCard.</p>}
          </div>
          <div className="customer-create-actions">
            <button type="button" className="customer-create-toggle" aria-label={showNewCustomerForm ? 'Fechar formulário de cadastro' : 'Adicionar cliente'} aria-expanded={showNewCustomerForm} aria-controls="customer-create-form" onClick={() => setShowNewCustomerForm((current) => !current)}>
              {showNewCustomerForm ? <X size={18} /> : <Plus size={20} />}
              <span>{showNewCustomerForm ? 'Fechar' : 'Adicionar'}</span>
            </button>
            <div className="customer-actions-menu" ref={customerActionsRef}>
              <button type="button" className="customer-actions-trigger" aria-label="Mais opções de clientes" aria-haspopup="menu" aria-expanded={showCustomerActions} onClick={() => setShowCustomerActions((current) => !current)}>
                <MoreHorizontal size={20} />
              </button>
              {showCustomerActions && <div className="customer-actions-popover" role="menu">
                <button type="button" className="customer-action-menu-item" role="menuitem" onClick={() => { setShowCustomerActions(false); contactFileInputRef.current?.click() }}>
                  <Upload size={16} />
                  <span><strong>Importar contatos</strong><small>Arquivo vCard (.vcf)</small></span>
                </button>
              </div>}
              <input ref={contactFileInputRef} className="customer-import-file-input" type="file" accept=".vcf,.vcard,text/vcard" aria-label="Selecionar arquivo de contatos vCard" onChange={(event) => void handleContactFile(event)} />
            </div>
          </div>
        </div>
        {contactFileError && <p className="contact-import-message error" role="alert">{contactFileError}</p>}
        {contactPreview && <div className="contact-import-preview">
          <div className="contact-import-file-summary">
            <strong>{contactPreview.fileName}</strong>
            <span>{contactPreview.contacts.length} contatos encontrados · {contactPreview.contacts.filter((contact) => Boolean(contact.phone)).length} com telefone · {contactPreview.contacts.filter((contact) => !contact.phone).length} sem telefone{contactPreview.ignored ? ` · ${contactPreview.ignored} inválidos` : ''}</span>
            <small>Serão usados apenas nome e telefone. Outros dados do contato não serão importados.</small>
          </div>
          <div className="contact-import-actions"><button type="button" className="button button-primary" disabled={saving || !contactPreview.contacts.length} onClick={() => void handleImportContacts()}>{saving ? 'Importando...' : `Importar ${contactPreview.contacts.length}`}</button><button type="button" className="button button-outline" onClick={() => setContactPreview(null)} disabled={saving}>Cancelar</button></div>
        </div>}
        {contactImportResult && <p className="contact-import-message success" role="status">Importação: {contactImportResult.created} adicionados · {contactImportResult.duplicates} duplicados ignorados · {contactImportResult.invalid} inválidos ignorados.</p>}
        {showNewCustomerForm && <form id="customer-create-form" className="customer-form" onSubmit={handleCreateCustomer}>
          <label>Nome completo<input type="text" minLength={2} maxLength={100} autoComplete="name" placeholder="Nome da cliente" value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} required /></label>
          <label>Telefone / WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" placeholder="(67) 99999-9999" value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(formatBrazilPhoneInput(event.target.value))} maxLength={16} required /></label>
          <label className="customer-deposit-toggle"><input type="checkbox" checked={newCustomerRequireDeposit} onChange={(event) => setNewCustomerRequireDeposit(event.target.checked)} /><span><strong>Exigir sinal nas próximas reservas</strong><small>Use apenas quando necessário para esta cliente. O cadastro será associado ao telefone informado.</small></span></label>
          <label>Observação interna (opcional)<textarea rows={3} maxLength={500} placeholder="Ex.: combinados de atendimento ou histórico relevante" value={newCustomerInternalNote} onChange={(event) => setNewCustomerInternalNote(event.target.value)} /></label>
          <button className="button button-primary button-full" disabled={saving}><UserPlus size={16} /> {saving ? 'Salvando cadastro...' : 'Cadastrar cliente'}</button>
        </form>}
      </section>
      <section className="customer-directory">
        <div className="card-heading"><div><p className="eyebrow">CADASTROS EXISTENTES</p><h2>Localizar cliente</h2></div><span className="count-chip">{filtered.length}</span></div>
        <label className="customer-search-field"><Search size={17} /><input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Pesquisar por nome ou telefone" aria-label="Pesquisar clientes por nome ou telefone" /></label>
        {filtered.length ? <div className="customer-profile-list">{filtered.map((customer) => {
          const expanded = expandedCustomerId === customer.id
          return <article className={`content-card customer-profile-card ${expanded ? 'is-expanded' : ''}`} key={customer.id}>
            <button type="button" className="customer-profile-summary" aria-expanded={expanded} onClick={() => setExpandedCustomerId(expanded ? null : customer.id)}>
              <span className="customer-profile-avatar"><UserRound size={19} /></span>
              <span className="customer-profile-identity"><strong>{customer.name}</strong><span><Phone size={13} /> {customer.phone ? formatBrazilPhone(customer.phone) : 'Telefone não informado'}</span></span>
              <span className="customer-profile-chevron"><ChevronDown size={17} /></span>
              <span className="customer-profile-meta"><span className={`customer-flag-pill ${customer.require_deposit ? 'required' : ''}`}>{customer.require_deposit ? 'Sinal exigido' : 'Sinal não exigido'}</span><span className="customer-summary-count">{customer.appointment_count} ag. · {customer.no_show_count} faltas</span></span>
            </button>
            {expanded && <div className="customer-profile-details">
              <div className="customer-history-summary"><span>{customer.appointment_count} {customer.appointment_count === 1 ? 'agendamento' : 'agendamentos'}</span><span>{customer.no_show_count} {customer.no_show_count === 1 ? 'falta registrada' : 'faltas registradas'}</span>{customer.last_appointment_at && <span>Último: {formatDateTime(customer.last_appointment_at)}</span>}</div>
              <label className="customer-edit-label">Nome exibido<input type="text" maxLength={100} value={customer.name} onChange={(event) => onCustomerChange(customer.id, { name: event.target.value })} required /></label>
              <label className="customer-deposit-toggle"><input type="checkbox" checked={customer.require_deposit} onChange={(event) => onCustomerChange(customer.id, { require_deposit: event.target.checked })} /><span><strong>Exigir sinal nas próximas reservas</strong><small>Aplica-se às próximas reservas identificadas por este telefone; sem telefone, o cadastro é localizado pelo nome.</small></span></label>
              <label className="customer-edit-label">Observação interna<textarea rows={3} maxLength={500} value={customer.internal_note} onChange={(event) => onCustomerChange(customer.id, { internal_note: event.target.value })} placeholder="Opcional; só a administração pode ver" /></label>
              <div className="customer-profile-actions"><small>Telefone usado para localizar o cadastro: {customer.phone ? formatBrazilPhone(customer.phone) : 'Não informado; vínculo pelo nome'}</small><button className="button button-outline button-small" onClick={() => onSaveCustomer(customer)} disabled={saving}><Save size={15} /> {saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
            </div>}
          </article>
        })}</div> : <div className="content-card customer-empty"><EmptyState icon={Users} title={query ? 'Nenhuma cliente encontrada' : 'Ainda não há clientes'} message={query ? 'Tente outro nome ou número de telefone.' : 'Cadastre uma cliente ou crie uma reserva fictícia de teste; novos cadastros também surgirão após as primeiras solicitações.'} /></div>}
      </section>
    </div>
  </>
}


function HoursView(props: ContentsProps) {
  const { hours, setHours, onSaveHours, saving } = props
  function patchHour(weekday: number, patch: Partial<BusinessHour>) {
    setHours((current) => current.map((hour) => hour.weekday === weekday ? { ...hour, ...patch } : hour))
  }
  return <>
    <PageHeading eyebrow="DISPONIBILIDADE DA AGENDA" title={<>Horários de funcionamento<span className="heading-period">.</span></>} />
    <div className="notice-soft"><AlertCircle size={17} /><span>Configure os horários reais antes de abrir os agendamentos ao público. Nenhum horário de funcionamento foi presumido.</span></div>
    <form className="content-card hours-card" onSubmit={onSaveHours}>
      <div className="hours-card-heading"><div><h2>Funcionamento semanal</h2><p>Os horários disponíveis serão calculados a partir destas regras.</p></div><span className="hours-timezone">Horário de Sidrolândia (MS)</span></div>
      <div className="hours-table-head"><span>Dia</span><span>Atende?</span><span>Abertura</span><span>Fechamento</span><span>Início do intervalo</span><span>Fim do intervalo</span></div>
      <div className="hours-rows">{hours.map((hour) => <div className={`hours-row ${!hour.enabled ? 'disabled-day' : ''}`} key={hour.weekday}>
        <strong>{WEEKDAYS[hour.weekday]}</strong><label className="switch-label hours-switch"><input type="checkbox" checked={hour.enabled} onChange={(event) => patchHour(hour.weekday, { enabled: event.target.checked, start_time: event.target.checked ? hour.start_time || '09:00' : null, end_time: event.target.checked ? hour.end_time || '18:00' : null })} /><span className="switch-ui" /><span className="switch-text">{hour.enabled ? 'Sim' : 'Não'}</span></label>
        <label className="hours-time-field"><span>Abertura</span><input aria-label={`${WEEKDAYS[hour.weekday]} - abertura`} type="time" value={hour.start_time ?? ''} disabled={!hour.enabled} onChange={(event) => patchHour(hour.weekday, { start_time: event.target.value })} required={hour.enabled} /></label>
        <label className="hours-time-field"><span>Fechamento</span><input aria-label={`${WEEKDAYS[hour.weekday]} - fechamento`} type="time" value={hour.end_time ?? ''} disabled={!hour.enabled} onChange={(event) => patchHour(hour.weekday, { end_time: event.target.value })} required={hour.enabled} /></label>
        <label className="hours-time-field"><span>Início do intervalo</span><input aria-label={`${WEEKDAYS[hour.weekday]} - início do intervalo`} type="time" value={hour.break_start ?? ''} disabled={!hour.enabled} onChange={(event) => patchHour(hour.weekday, { break_start: event.target.value, break_end: event.target.value ? hour.break_end : null })} /></label>
        <label className="hours-time-field"><span>Fim do intervalo</span><input aria-label={`${WEEKDAYS[hour.weekday]} - fim do intervalo`} type="time" value={hour.break_end ?? ''} disabled={!hour.enabled} onChange={(event) => patchHour(hour.weekday, { break_end: event.target.value, break_start: event.target.value ? hour.break_start : null })} /></label>
      </div>)}</div>
      <div className="hours-footer"><span>Intervalos opcionais, por exemplo, para o almoço.</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar funcionamento'} <Check size={16} /></button></div>
    </form>
  </>
}

function BlocksView(props: ContentsProps) {
  const { blocks, onCreateBlock, blockDate, setBlockDate, blockStart, setBlockStart, blockEnd, setBlockEnd, blockNote, setBlockNote, onRemoveBlock, saving } = props
  return <>
    <PageHeading eyebrow="EXCEÇÕES À ROTINA" title={<>Bloqueios de agenda<span className="heading-period">.</span></>} />
    <div className="blocks-layout"><section className="content-card block-form-card"><div className="card-heading"><div><p className="eyebrow">NOVA EXCEÇÃO</p><h2>Reservar um período</h2></div><span className="block-form-icon"><DoorClosed size={20} /></span></div><p className="block-help">Use para folgas, compromissos, feriados ou pausas fora do intervalo habitual.</p>
      <form className="block-form" onSubmit={onCreateBlock}><label>Data<input type="date" min={localDateString(new Date())} value={blockDate} onChange={(event) => setBlockDate(event.target.value)} required /></label><div className="block-time-grid"><label>Das (opcional)<input type="time" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} /></label><label>Até (opcional)<input type="time" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} /></label></div><label>Motivo ou observação<input type="text" maxLength={120} placeholder="Ex.: compromisso pessoal" value={blockNote} onChange={(event) => setBlockNote(event.target.value)} /></label><button className="button button-primary button-full" disabled={saving}><Plus size={17} /> {saving ? 'Adicionando...' : 'Adicionar bloqueio'}</button><small>Deixe os dois horários vazios para bloquear o dia inteiro.</small></form>
    </section><section className="content-card blocks-list-card"><div className="card-heading"><div><p className="eyebrow">AGENDA</p><h2>Próximos bloqueios</h2></div><span className="count-chip">{blocks.length}</span></div>{blocks.length ? <div className="blocks-list">{blocks.map((block) => <div className="block-row" key={block.id}><div className="block-date-badge"><strong>{new Date(`${block.blocked_date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${block.blocked_date}T12:00:00`))}</span></div><div className="block-row-copy"><strong>{new Date(`${block.blocked_date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' })}</strong><span>{block.start_time ? `${block.start_time.slice(0, 5)}–${block.end_time?.slice(0, 5)}` : 'Dia inteiro'}</span><small>{block.note || 'Sem observações'}</small></div><button className="icon-button danger" onClick={() => onRemoveBlock(block.id)} aria-label="Remover bloqueio"><X size={16} /></button></div>)}</div> : <EmptyState icon={CalendarDays} title="Nenhum bloqueio futuro" message="Quando precisar fechar algum período, cadastre aqui." />}</section></div>
  </>
}

function PoliciesView(props: ContentsProps) {
  const { policies, setPolicies, onSavePolicies, saving } = props
  function patchPolicy(patch: Partial<BusinessPolicy>) {
    setPolicies({ ...policies, ...patch })
  }
  return <>
    <PageHeading eyebrow="REGRAS DO ESTÚDIO" title={<>Orientações para clientes<span className="heading-period">.</span></>} />
    <div className="notice-soft"><AlertCircle size={17} /><span>Você escolhe quais avisos aparecem antes do agendamento público. Se todos estiverem desligados, a área de orientações não será exibida para a cliente.</span></div>
    <form className="content-card policies-form" onSubmit={onSavePolicies}>
      <div className="policies-form-heading"><div><p className="eyebrow">CONTROLE DE EXIBIÇÃO</p><h2>Orientações do estúdio</h2><p>Ligue somente os avisos que você deseja mostrar. Os quatro começam desligados até serem configurados.</p></div><span className="policy-mark"><ShieldCheck size={22} /></span></div>
      <div className="policy-display-options">
        <label className="policy-display-toggle"><input type="checkbox" checked={policies.show_lateness_policy} onChange={(event) => patchPolicy({ show_lateness_policy: event.target.checked })} /><span><strong>Mostrar tolerância a atrasos</strong><small>Exibe o prazo permitido para chegar atrasada.</small></span></label>
        <label className="policy-display-toggle"><input type="checkbox" checked={policies.show_cancellation_policy} onChange={(event) => patchPolicy({ show_cancellation_policy: event.target.checked })} /><span><strong>Mostrar prazo de cancelamento</strong><small>Exibe com quantas horas de antecedência avisar.</small></span></label>
        <label className="policy-display-toggle"><input type="checkbox" checked={policies.show_companion_policy} onChange={(event) => patchPolicy({ show_companion_policy: event.target.checked })} /><span><strong>Mostrar aviso sobre acompanhantes</strong><small>Use para orientar sobre acompanhantes e crianças.</small></span></label>
        <label className="policy-display-toggle"><input type="checkbox" checked={policies.show_no_show_policy} onChange={(event) => patchPolicy({ show_no_show_policy: event.target.checked })} /><span><strong>Mostrar política de faltas e sinal</strong><small>Exibe o texto sobre faltas, cancelamento e sinal pago.</small></span></label>
      </div>
      {policies.show_lateness_policy && <label className="policy-text-field">Tolerância de atraso (minutos)<input type="number" min="0" max="60" value={policies.lateness_tolerance_minutes} onChange={(event) => patchPolicy({ lateness_tolerance_minutes: Math.min(60, Math.max(0, Number(event.target.value || 0))) })} required /><small>Este prazo aparecerá na agenda pública.</small></label>}
      {policies.show_cancellation_policy && <label className="policy-text-field">Prazo para avisar (horas)<input type="number" min="0" max="168" value={policies.cancellation_notice_hours} onChange={(event) => patchPolicy({ cancellation_notice_hours: Math.min(168, Math.max(0, Number(event.target.value || 0))) })} required /><small>Para cancelamentos e reagendamentos.</small></label>}
      {policies.show_companion_policy && <label className="policy-text-field">Acompanhantes e crianças<textarea rows={4} minLength={10} maxLength={700} value={policies.companion_policy} onChange={(event) => patchPolicy({ companion_policy: event.target.value })} required /><small>Edite o texto conforme a regra real do estúdio.</small></label>}
      {policies.show_no_show_policy && <label className="policy-text-field">Faltas e sinal pago<textarea rows={4} minLength={10} maxLength={700} value={policies.no_show_policy} onChange={(event) => patchPolicy({ no_show_policy: event.target.value })} required /><small>A cliente verá esta orientação antes de aceitar as condições.</small></label>}
      <div className="policies-save-row"><span><ShieldCheck size={16} /> A exibição será atualizada na página pública ao salvar.</span><button className="button button-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar orientações'} <ArrowRightIcon /></button></div>
    </form>
  </>
}

function formatFinanceDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
}

function currencyInputToCents(value: string) {
  const amount = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function FinanceView(props: ContentsProps) {
  const { appointments, financialEntries, payables, onCreateFinancialEntry, onDeleteFinancialEntry, onCreatePayable, onMarkPayablePaid, onDeletePayable, onReceiveAppointmentBalance, saving } = props
  const [month, setMonth] = useState(localDateString(new Date()).slice(0, 7))
  const [direction, setDirection] = useState<'income' | 'expense'>('income')
  const [entryDescription, setEntryDescription] = useState('')
  const [entryCategory, setEntryCategory] = useState('Atendimento')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryDate, setEntryDate] = useState(localDateString(new Date()))
  const [entryPaymentMethod, setEntryPaymentMethod] = useState('Pix')
  const [payableDescription, setPayableDescription] = useState('')
  const [payableCategory, setPayableCategory] = useState('Despesas do estúdio')
  const [payableAmount, setPayableAmount] = useState('')
  const [payableDueDate, setPayableDueDate] = useState(localDateString(new Date()))
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [receivablesExpanded, setReceivablesExpanded] = useState(false)
  const [entryFormExpanded, setEntryFormExpanded] = useState(false)
  const [payableFormExpanded, setPayableFormExpanded] = useState(false)
  const [payablesExpanded, setPayablesExpanded] = useState(false)
  const [allMovementsExpanded, setAllMovementsExpanded] = useState(false)
  const [selectedReceivableId, setSelectedReceivableId] = useState<string | null>(null)
  const [balancePaymentMethod, setBalancePaymentMethod] = useState('Pix')

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const monthEntries = financialEntries.filter((entry) => entry.movement_date.startsWith(month)).sort((a, b) => b.movement_date.localeCompare(a.movement_date) || b.created_at.localeCompare(a.created_at))
  const monthIncome = monthEntries.filter((entry) => entry.direction === 'income').reduce((total, entry) => total + entry.amount_cents, 0)
  const monthExpenses = monthEntries.filter((entry) => entry.direction === 'expense').reduce((total, entry) => total + entry.amount_cents, 0)
  const openPayables = payables.filter((item) => item.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date))
  const pendingTotal = openPayables.reduce((total, item) => total + item.amount_cents, 0)
  const pendingReceivables = appointments.flatMap((appointment) => {
    if (!['confirmed', 'completed'].includes(appointment.status)) return []
    if (appointment.deposit_required && !appointment.deposit_received) return []
    const endTime = new Date(appointment.ends_at).getTime()
    if (appointment.status !== 'completed' && (!Number.isFinite(endTime) || endTime > currentTime)) return []
    const entries = financialEntries.filter((entry) => entry.related_appointment_id === appointment.id && ['appointment_deposit', 'appointment_balance'].includes(entry.source_type))
    const depositReceivedCents = entries.filter((entry) => entry.source_type === 'appointment_deposit').reduce((total, entry) => total + Number(entry.amount_cents), 0)
    const allReceivedCents = entries.reduce((total, entry) => total + Number(entry.amount_cents), 0)
    const remainingCents = Math.max(0, Number(appointment.price_cents) - allReceivedCents)
    if (remainingCents <= 0) return []
    return [{ appointment, depositReceivedCents, allReceivedCents, remainingCents }]
  }).sort((a, b) => a.appointment.ends_at.localeCompare(b.appointment.ends_at))
  const pendingReceivablesTotal = pendingReceivables.reduce((total, item) => total + item.remainingCents, 0)
  const selectedReceivable = pendingReceivables.find((item) => item.appointment.id === selectedReceivableId) ?? null
  const today = localDateString(new Date())

  async function confirmBalanceReceipt() {
    if (!selectedReceivable) return
    const ok = await onReceiveAppointmentBalance(selectedReceivable.appointment.id, balancePaymentMethod)
    if (ok) {
      setSelectedReceivableId(null)
      setBalancePaymentMethod('Pix')
    }
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await onCreateFinancialEntry({ direction, description: entryDescription.trim(), category: entryCategory.trim(), amount_cents: currencyInputToCents(entryAmount), movement_date: entryDate, payment_method: entryPaymentMethod })
    if (ok) { setEntryDescription(''); setEntryAmount('') }
  }

  async function submitPayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await onCreatePayable({ description: payableDescription.trim(), category: payableCategory.trim(), amount_cents: currencyInputToCents(payableAmount), due_date: payableDueDate })
    if (ok) { setPayableDescription(''); setPayableAmount('') }
  }

  return <>
    <PageHeading eyebrow="CONTROLE DO ESTÚDIO" title={<>Financeiro<span className="heading-period">.</span></>}>
      <label className="finance-month-picker">Mês de referência<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
    </PageHeading>
    <div className="notice-soft finance-intro"><Wallet size={17} /><span>O Financeiro acompanha o que já entrou e o que ainda falta receber. O sinal entra automaticamente quando você confirma o agendamento; após o horário previsto do atendimento, o saldo aparece aqui vinculado à cliente e ao valor total.</span></div>

    <div className="finance-summary-grid">
      <article className="finance-summary-card income"><span><TrendingUp size={17} /> Entradas do mês</span><strong>{formatPrice(monthIncome)}</strong><small>{monthEntries.filter((entry) => entry.direction === 'income').length} movimentações</small></article>
      <article className="finance-summary-card expense"><span><TrendingDown size={17} /> Saídas do mês</span><strong>{formatPrice(monthExpenses)}</strong><small>{monthEntries.filter((entry) => entry.direction === 'expense').length} movimentações</small></article>
      <article className={`finance-summary-card balance ${monthIncome - monthExpenses < 0 ? 'negative' : ''}`}><span><Wallet size={17} /> Resultado do mês</span><strong>{formatPrice(monthIncome - monthExpenses)}</strong><small>Entradas menos saídas registradas em {month.split('-').reverse().join('/')}</small></article>
      <article className="finance-summary-card receivable"><span><Clock3 size={17} /> Valores a receber</span><strong>{formatPrice(pendingReceivablesTotal)}</strong><small>{pendingReceivables.length} atendimentos com saldo pendente</small></article>
      <article className="finance-summary-card due"><span><Receipt size={17} /> Contas a pagar</span><strong>{formatPrice(pendingTotal)}</strong><small>{openPayables.length} contas pendentes</small></article>
    </div>

    <section className="content-card finance-list-card finance-receivables-card">
      <div className="card-heading">
        <div><p className="eyebrow">ATENDIMENTOS</p><h2>Valores a receber</h2><p className="finance-section-subtitle">Consulte os saldos pendentes e registre o recebimento quando o dinheiro entrar.</p></div>
        <button type="button" className="finance-receivables-toggle" aria-expanded={receivablesExpanded} aria-controls="finance-receivables-content" onClick={() => setReceivablesExpanded((expanded) => !expanded)}>
          {receivablesExpanded ? 'Ocultar lista' : 'Ver atendimentos'} <span>({pendingReceivables.length})</span><ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      <div id="finance-receivables-content" className="finance-receivables-list" hidden={!receivablesExpanded}>
        {receivablesExpanded && (pendingReceivables.length ? pendingReceivables.map(({ appointment, depositReceivedCents, allReceivedCents, remainingCents }) => <article className="finance-receivable-row" key={appointment.id}>
          <div className="finance-receivable-heading"><div><strong>{appointment.customer_name}</strong><span>{appointment.service?.name ?? 'Atendimento'} · {formatDateTime(appointment.starts_at)}</span><small>{appointment.deposit_required ? 'Atendimento com sinal' : 'Atendimento sem sinal'}</small></div><span className="finance-receivable-code">#{appointment.public_code}</span></div>
          <div className="finance-receivable-breakdown">
            <div><span>Valor total</span><strong>{formatPrice(appointment.price_cents)}</strong></div>
            <div><span>Já recebido</span><strong className="is-received">{formatPrice(allReceivedCents)}</strong>{appointment.deposit_required && depositReceivedCents > 0 && <small>Sinal: {formatPrice(depositReceivedCents)}</small>}</div>
            <div className="remaining"><span>Restante a receber</span><strong>{formatPrice(remainingCents)}</strong><small>Este valor ainda não foi somado às entradas recebidas.</small></div>
          </div>
          <div className="finance-receivable-actions"><button type="button" className="button button-primary" disabled={saving} onClick={() => { setSelectedReceivableId(appointment.id); setBalancePaymentMethod('Pix') }}><CheckCircle2 size={16} /> Registrar recebimento do saldo</button></div>
        </article>) : <EmptyState icon={Wallet} title="Nenhum valor pendente" message="Quando o horário previsto de um atendimento confirmado terminar, o saldo aparecerá aqui. O valor só entra nas receitas quando você registrar que recebeu." />)}
      </div>
    </section>

    <div className="finance-forms-grid">
      <section className="content-card finance-form-card">
        <div className="card-heading"><div><p className="eyebrow">MOVIMENTAÇÃO</p><h2>Registrar entrada ou saída</h2></div><span className="finance-form-mark"><Wallet size={20} /></span></div>
        <button type="button" className="finance-section-toggle" aria-expanded={entryFormExpanded} aria-controls="finance-entry-form" onClick={() => setEntryFormExpanded((expanded) => !expanded)}>{entryFormExpanded ? 'Fechar formulário' : 'Registrar movimentação'}<ChevronDown size={16} aria-hidden="true" /></button>
        <div id="finance-entry-form" hidden={!entryFormExpanded}>
          {entryFormExpanded && <>
            <form className="finance-form" onSubmit={submitEntry}>
            <label>Tipo de movimentação<select value={direction} onChange={(event) => setDirection(event.target.value as 'income' | 'expense')}><option value="income">Entrada de dinheiro</option><option value="expense">Saída de dinheiro</option></select></label>
            <label>Descrição<input value={entryDescription} onChange={(event) => setEntryDescription(event.target.value)} minLength={2} maxLength={120} placeholder={direction === 'income' ? 'Ex.: atendimento realizado' : 'Ex.: compra de materiais'} required /></label>
            <div className="finance-fields-two"><label>Categoria<input value={entryCategory} onChange={(event) => setEntryCategory(event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Atendimento" required /></label><label>Valor (R$)<input value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label></div>
            <div className="finance-fields-two"><label>Data<input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required /></label><label>Forma de recebimento/pagamento<select value={entryPaymentMethod} onChange={(event) => setEntryPaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Não informado</option><option>Outro</option></select></label></div>
            <button className="button button-primary button-full" disabled={saving}><Plus size={16} /> {saving ? 'Salvando...' : `Registrar ${direction === 'income' ? 'entrada' : 'saída'}`}</button>
            </form>
            <p className="finance-footnote">Use para recebimentos e despesas que ainda não foram registrados automaticamente.</p>
          </>}
        </div>
      </section>

      <section className="content-card finance-form-card finance-payables-card">
        <div className="card-heading"><div><p className="eyebrow">ORGANIZAÇÃO</p><h2>Contas a pagar</h2></div><span className="count-chip">{payables.length}</span></div>
        <button type="button" className="finance-section-toggle" aria-expanded={payableFormExpanded} aria-controls="finance-payable-form" onClick={() => setPayableFormExpanded((expanded) => !expanded)}>{payableFormExpanded ? 'Fechar formulário' : 'Cadastrar conta'}<ChevronDown size={16} aria-hidden="true" /></button>
        <div id="finance-payable-form" hidden={!payableFormExpanded}>
          {payableFormExpanded && <>
            <form className="finance-form" onSubmit={submitPayable}>
              <label>Descrição<input value={payableDescription} onChange={(event) => setPayableDescription(event.target.value)} minLength={2} maxLength={120} placeholder="Ex.: aluguel do espaço" required /></label>
              <div className="finance-fields-two"><label>Categoria<input value={payableCategory} onChange={(event) => setPayableCategory(event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Estrutura" required /></label><label>Valor (R$)<input value={payableAmount} onChange={(event) => setPayableAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label></div>
              <label>Vencimento<input type="date" value={payableDueDate} onChange={(event) => setPayableDueDate(event.target.value)} required /></label>
              <button className="button button-primary button-full" disabled={saving}><Plus size={16} /> {saving ? 'Salvando...' : 'Cadastrar conta'}</button>
            </form>
            <p className="finance-footnote">Uma conta só vira saída no financeiro quando for marcada como paga.</p>
          </>}
        </div>
        <button type="button" className="finance-list-more-toggle finance-payables-toggle" aria-expanded={payablesExpanded} aria-controls="finance-payables-content" onClick={() => setPayablesExpanded((expanded) => !expanded)}>{payablesExpanded ? 'Ocultar contas' : `Consultar contas (${payables.length})`}<ChevronDown size={16} aria-hidden="true" /></button>
        <div id="finance-payables-content" className="finance-payables-content" hidden={!payablesExpanded}>
          {payablesExpanded && (payables.length ? <div className="finance-payables-list">{payables.slice().sort((a, b) => (a.status === b.status ? a.due_date.localeCompare(b.due_date) : a.status === 'pending' ? -1 : 1)).map((payable) => {
            const isOverdue = payable.status === 'pending' && payable.due_date < today
            return <article className="finance-payable-row" key={payable.id}>
              <div className="finance-payable-copy"><strong>{payable.description}</strong><span>{payable.category} · Vence {formatFinanceDate(payable.due_date)}</span><small className={isOverdue ? 'is-overdue' : payable.status === 'paid' ? 'is-paid' : ''}>{payable.status === 'paid' ? 'Paga' : isOverdue ? 'Vencida · em aberto' : 'Em aberto'}</small></div>
              <strong className="finance-payable-amount">{formatPrice(payable.amount_cents)}</strong>
              <div className="finance-payable-actions">{payable.status === 'pending' ? <><button type="button" className="button button-outline button-small" disabled={saving} onClick={() => { if (window.confirm(`Marcar “${payable.description}” como paga e registrar a saída?`)) void onMarkPayablePaid(payable.id) }}>Marcar como paga</button><button type="button" className="icon-button danger" aria-label={`Excluir conta ${payable.description}`} disabled={saving} onClick={() => { if (window.confirm(`Excluir a conta “${payable.description}”?`)) void onDeletePayable(payable.id) }}><Trash2 size={15} /></button></> : <span className="finance-paid-date">Paga em {payable.paid_at ? formatDateTime(payable.paid_at) : 'data registrada'}</span>}</div>
            </article>
          })}</div> : <EmptyState icon={Receipt} title="Nenhuma conta cadastrada" message="Cadastre as despesas que precisam ser pagas e marque cada uma como paga quando concluir o pagamento." />)}
        </div>
      </section>
    </div>

    <section className="content-card finance-list-card">
      <div className="card-heading"><div><p className="eyebrow">RESUMO DE CAIXA</p><h2>Movimentações de {month.split('-').reverse().join('/')}</h2></div><span className="count-chip">{monthEntries.length}</span></div>
      {monthEntries.length ? <>
      <div className="finance-entries-list">{(allMovementsExpanded ? monthEntries : monthEntries.slice(0, 5)).map((entry) => <article className="finance-entry-row" key={entry.id}>
        <span className={`finance-entry-icon ${entry.direction}`} aria-hidden="true">{entry.direction === 'income' ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</span>
        <div className="finance-entry-main"><strong>{entry.description}</strong><span>{entry.category} · {formatFinanceDate(entry.movement_date)}</span><small>{entry.source_type === 'appointment_deposit' ? 'Sinal de agendamento · registrado pela confirmação' : entry.source_type === 'appointment_balance' ? `Saldo de atendimento · ${entry.payment_method}` : entry.source_type === 'payable_payment' ? 'Conta a pagar · pagamento registrado automaticamente' : entry.payment_method}</small></div>
        <strong className={`finance-entry-amount ${entry.direction}`}>{entry.direction === 'income' ? '+' : '−'} {formatPrice(entry.amount_cents)}</strong>
        {entry.source_type === 'manual' && <button type="button" className="icon-button danger" aria-label={`Excluir movimentação ${entry.description}`} title="Excluir movimentação manual" disabled={saving} onClick={() => { if (window.confirm('Deseja excluir esta movimentação manual?')) void onDeleteFinancialEntry(entry.id) }}><Trash2 size={15} /></button>}
      </article>)}</div>
      {monthEntries.length > 5 && <button type="button" className="finance-list-more-toggle" aria-expanded={allMovementsExpanded} onClick={() => setAllMovementsExpanded((expanded) => !expanded)}>{allMovementsExpanded ? 'Mostrar só as 5 mais recentes' : `Ver todas as movimentações (${monthEntries.length})`}<ChevronDown size={16} aria-hidden="true" /></button>}
      </> : <EmptyState icon={Wallet} title="Nenhuma movimentação neste mês" message="Entradas e saídas registradas aparecerão aqui. O sinal só entra quando o recebimento é confirmado pela Ana." />}
    </section>


    <div className="notice-soft finance-notice"><ShieldCheck size={17} /><span>Controle inicial sem integração bancária. Sinais confirmados e contas marcadas como pagas geram movimentações automáticas. Registre o saldo de cada atendimento apenas quando o dinheiro realmente tiver entrado.</span></div>

    {selectedReceivable && <div className="finance-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelectedReceivableId(null) }}>
      <section className="finance-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="finance-receipt-title">
        <div className="finance-modal-heading"><div><p className="eyebrow">CONFERÊNCIA DE RECEBIMENTO</p><h2 id="finance-receipt-title">Registrar saldo recebido</h2></div><button type="button" className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setSelectedReceivableId(null)}><X size={18} /></button></div>
        <p className="finance-modal-customer">{selectedReceivable.appointment.customer_name} · {selectedReceivable.appointment.service?.name ?? 'Atendimento'} · {formatDateTime(selectedReceivable.appointment.starts_at)}</p>
        <div className="finance-modal-breakdown"><div><span>Valor total do atendimento</span><strong>{formatPrice(selectedReceivable.appointment.price_cents)}</strong></div><div><span>Já recebido neste atendimento</span><strong className="is-received">{formatPrice(selectedReceivable.allReceivedCents)}</strong></div><div className="remaining"><span>Valor que está sendo registrado agora</span><strong>{formatPrice(selectedReceivable.remainingCents)}</strong></div></div>
        <label className="finance-payment-method">Forma de recebimento<select value={balancePaymentMethod} onChange={(event) => setBalancePaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option><option>Não informado</option></select></label>
        <p className="finance-modal-warning"><ShieldCheck size={16} /> Confirme somente depois de verificar que este valor foi recebido. O lançamento será vinculado a este atendimento e não será duplicado.</p>
        <div className="finance-modal-actions"><button type="button" className="button button-outline" disabled={saving} onClick={() => setSelectedReceivableId(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void confirmBalanceReceipt()}>{saving ? 'Registrando...' : 'Confirmar recebimento'}</button></div>
      </section>
    </div>}
  </>
}

function EmptyState({ icon: Icon, title, message }: { icon: typeof CalendarDays; title: string; message: string }) {
  return <div className="empty-state"><div><Icon size={22} /></div><strong>{title}</strong><p>{message}</p></div>
}
