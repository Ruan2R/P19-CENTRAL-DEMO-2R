import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch, apiPost, ApiError } from '../lib/api'
import AdminSettings from './AdminSettings'
import AdminCustomers from './AdminCustomers'
import AdminFinance from './AdminFinance'
import AdminPromotions from './AdminPromotions'

type AdminUser = { id: string; displayName: string; role: string }
type BookingItem = {
  id: string
  serviceId: string
  serviceName: string
  professionalId: string
  professionalName: string
  time: string
  durationMinutes: number
  priceCents: number
}
type BookingGroup = {
  id: string
  publicCode: string
  date: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  customer: { name: string; whatsapp: string }
  items: BookingItem[]
  totalPriceCents: number
  whatsappConfirmationMarkedAt: string | null
  whatsappConfirmationMarkedBy?: string | null
  createdAt: string
}
type AgendaResponse = {
  date: string
  summary: { total: number; confirmed: number; cancelled: number; completed: number; noShow: number; revenueCents: number }
  bookingGroups: BookingGroup[]
}
type SessionResponse = { authenticated: boolean; user: AdminUser | null }
type AdminSection = 'overview' | 'agenda' | 'customers' | 'services' | 'professionals' | 'hours' | 'blocks' | 'promotions' | 'finance'
type AdminIconName = 'overview' | 'agenda' | 'customers' | 'services' | 'professionals' | 'hours' | 'blocks' | 'promotions' | 'finance' | 'whatsapp' | 'refresh' | 'external' | 'logout' | 'arrow-right' | 'shield'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const adminNavItems: { id: AdminSection; label: string; icon: AdminIconName }[] = [
  { id: 'overview', label: 'Visão geral', icon: 'overview' },
  { id: 'agenda', label: 'Agendamentos', icon: 'agenda' },
  { id: 'customers', label: 'Clientes', icon: 'customers' },
  { id: 'services', label: 'Serviços', icon: 'services' },
  { id: 'professionals', label: 'Profissionais', icon: 'professionals' },
  { id: 'hours', label: 'Horários', icon: 'hours' },
  { id: 'blocks', label: 'Bloqueios', icon: 'blocks' },
  { id: 'promotions', label: 'Promoções', icon: 'promotions' },
  { id: 'finance', label: 'Financeiro', icon: 'finance' },
]
const adminSectionLabels: Record<AdminSection, string> = {
  overview: 'Visão geral', agenda: 'Agendamentos', customers: 'Clientes', services: 'Serviços',
  professionals: 'Profissionais', hours: 'Horários', blocks: 'Bloqueios', promotions: 'Promoções', finance: 'Financeiro',
}

const statusLabels: Record<BookingGroup['status'], string> = {
  confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído', no_show: 'Não compareceu',
}

function businessDateToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function parseDate(date: string) {
  return new Date(`${date}T12:00:00`)
}

function formatDateLong(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Campo_Grande', weekday: 'long', day: '2-digit', month: 'long',
  }).format(parseDate(date)).replace(/^./, (letter) => letter.toUpperCase())
}

function formatWhatsApp(phone: string) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}

function whatsappNumber(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function buildConfirmationMessage(group: BookingGroup) {
  const rawFirstName = group.customer.name.trim().split(/\s+/)[0] || 'cliente'
  const firstName = rawFirstName.charAt(0).toLocaleUpperCase('pt-BR') + rawFirstName.slice(1).toLocaleLowerCase('pt-BR')
  const items = group.items.slice().sort((a, b) => a.time.localeCompare(b.time))
  return [
    `Olá, ${firstName}!`,
    '',
    'Aqui é da 2R Barber Studio.',
    '',
    `Seu agendamento está confirmado para ${formatDateLong(group.date)}.`,
    '',
    'Detalhes do agendamento:',
    ...items.map((item) => `- ${item.serviceName} — ${item.professionalName} — ${item.time}`),
    '',
    `Total: ${currency.format(group.totalPriceCents / 100)}`,
    '',
    'Qualquer dúvida ou observação, estamos à disposição. Até lá!',
  ].join('\n')
}

function openWhatsAppConfirmation(group: BookingGroup) {
  const phone = whatsappNumber(group.customer.whatsapp)
  const message = encodeURIComponent(buildConfirmationMessage(group))
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const url = isMobile
    ? `https://wa.me/${phone}?text=${message}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${message}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function endTime(time: string, duration: number) {
  const [hours, minutes] = time.split(':').map(Number)
  const total = hours * 60 + minutes + duration
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function groupTimeLabel(group: BookingGroup) {
  const items = group.items.slice().sort((a, b) => a.time.localeCompare(b.time))
  if (!items.length) return 'Horário não informado'
  const starts = items[0].time
  const last = items.reduce((latest, item) => {
    const itemEnd = endTime(item.time, item.durationMinutes)
    return itemEnd > latest ? itemEnd : latest
  }, starts)
  return items.length === 1 ? starts : `${starts} — ${last}`
}


function AdminIcon({ name, size = 20 }: { name: AdminIconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  switch (name) {
    case 'overview': return <svg {...common}><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/><path d="m5 2 .7 2.3L8 5l-2.3.7L5 8l-.7-2.3L2 5l2.3-.7L5 2Z"/></svg>
    case 'agenda': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h6"/></svg>
    case 'customers': return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 8v6M17 11h6"/></svg>
    case 'finance': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M15 14h3"/></svg>
    case 'promotions': return <svg {...common}><path d="M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a.7.7 0 0 1 0 1Z"/><circle cx="7.5" cy="7.5" r="1"/></svg>
    case 'whatsapp': return <svg {...common}><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.7A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M8.1 7.5c.2-.5.5-.5.8-.5h.4c.2 0 .3.1.4.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.2 1.5 2.1 1.9.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .3-.2 1-.7 1.3-.4.3-.9.5-1.5.4-1-.1-2.2-.6-3.3-1.6-1.4-1.2-2.3-2.7-2.5-3.7-.2-.8.1-1.4.5-1.8Z"/></svg>
    case 'professionals': return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'services': return <svg {...common}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.2 8.2 12 12M8.2 15.8 20 4M14.5 9.5l3 3"/></svg>
    case 'hours': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
    case 'blocks': return <svg {...common}><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M2 21h20M9 21v-7h6v7M7 7h.01M17 7h.01"/></svg>
    case 'refresh': return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 1M4 17l2 1a7 7 0 0 0 12.4-3"/></svg>
    case 'external': return <svg {...common}><path d="M14 3h7v7M10 14 21 3"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>
    case 'logout': return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>
    case 'arrow-right': return <svg {...common}><path d="M4 12h15M13 6l6 6-6 6"/></svg>
    case 'shield': return <svg {...common}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>
  }
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loginId, setLoginId] = useState(() => new URLSearchParams(window.location.search).get('demoLogin') === 'DEMO' ? 'DEMO' : '')
  const [password, setPassword] = useState(() => new URLSearchParams(window.location.search).get('demoLogin') === 'DEMO' ? '2Rdemo26' : '')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [agendaDate, setAgendaDate] = useState(businessDateToday)
  const [professionalFilter, setProfessionalFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null)
  const [loadingAgenda, setLoadingAgenda] = useState(false)
  const [agendaError, setAgendaError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [whatsappPreparedGroupId, setWhatsappPreparedGroupId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [adminSection, setAdminSection] = useState<AdminSection>('overview')
  const [settingsRefreshKey, setSettingsRefreshKey] = useState(0)
  const [bookingListFilter, setBookingListFilter] = useState<'upcoming' | 'pending' | 'all'>('upcoming')
  const [bookingGroups, setBookingGroups] = useState<BookingGroup[]>([])
  const [bookingListLoading, setBookingListLoading] = useState(false)
  const [bookingListError, setBookingListError] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')

  useEffect(() => {
    const demoMode = new URLSearchParams(window.location.search).get('demoLogin') === 'DEMO'
    document.title = '2R Barber | Área administrativa'
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.append(robots)
    }
    robots.content = 'noindex, nofollow, noarchive'
    let active = true
    async function initializeSession() {
      try {
        const result = await apiGet<SessionResponse>('/api/admin/session')
        if (!active) return
        if (result.authenticated && result.user) {
          setUser(result.user)
          return
        }
        if (demoMode) {
          const demo = await apiPost<{ authenticated: boolean; user: AdminUser }>('/api/admin/login', { id: 'DEMO', password: '2Rdemo26' })
          if (!active) return
          setUser(demo.user)
          setLoginId('')
          setPassword('')
          return
        }
        setUser(null)
      } catch (error) {
        if (!active) return
        if (demoMode) {
          try {
            const demo = await apiPost<{ authenticated: boolean; user: AdminUser }>('/api/admin/login', { id: 'DEMO', password: '2Rdemo26' })
            if (active) { setUser(demo.user); setLoginId(''); setPassword('') }
          } catch { setUser(null) }
        } else setUser(null)
      } finally {
        if (active) setAuthChecked(true)
      }
    }
    void initializeSession()
    return () => {
      active = false
      document.title = '2R Barber | Agendamento demonstrativo'
      robots?.setAttribute('content', 'noindex, nofollow, noarchive')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoadingAgenda(true)
    setAgendaError('')
    const query = new URLSearchParams({ date: agendaDate, professionalId: professionalFilter, status: statusFilter })
    apiGet<AgendaResponse>(`/api/admin/agenda?${query.toString()}`)
      .then((agendaResult) => {
        if (!active) return
        setAgenda(agendaResult)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 401) setUser(null)
        setAgendaError(reason instanceof Error ? reason.message : 'Não foi possível carregar a agenda.')
      })
      .finally(() => {
        if (active) setLoadingAgenda(false)
      })
    return () => { active = false }
  }, [user, agendaDate, professionalFilter, statusFilter, reloadKey])

  useEffect(() => {
    if (!user || adminSection !== 'agenda') return
    let active = true
    setBookingListLoading(true)
    setBookingListError('')
    apiGet<{ bookingGroups: BookingGroup[] }>(`/api/admin/booking-groups?filter=${bookingListFilter}`)
      .then((result) => { if (active) setBookingGroups(result.bookingGroups) })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 401) setUser(null)
        setBookingListError(reason instanceof Error ? reason.message : 'Não foi possível carregar os agendamentos.')
      })
      .finally(() => { if (active) setBookingListLoading(false) })
    return () => { active = false }
  }, [user, adminSection, bookingListFilter, reloadKey])

  const filteredBookingGroups = useMemo(() => {
    const query = bookingSearch.trim().toLocaleLowerCase('pt-BR')
    const digits = bookingSearch.replace(/\D/g, '')
    return bookingGroups.filter((group) => {
      if (!query) return true
      const haystack = `${group.customer.name} ${group.customer.whatsapp} ${group.publicCode} ${group.items.map((item) => `${item.serviceName} ${item.professionalName}`).join(' ')}`.toLocaleLowerCase('pt-BR')
      return haystack.includes(query) || (digits.length > 0 && group.customer.whatsapp.replace(/\D/g, '').includes(digits))
    })
  }, [bookingGroups, bookingSearch])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const result = await apiPost<{ authenticated: boolean; user: AdminUser }>('/api/admin/login', { id: loginId, password })
      setUser(result.user)
      setPassword('')
      setLoginId('')
    } catch (reason: unknown) {
      setLoginError(reason instanceof Error ? reason.message : 'Não foi possível entrar.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function logout() {
    setLoggingOut(true)
    setAgendaError('')
    try {
      await apiPost('/api/admin/logout', {})
      setAgenda(null)
      setBookingGroups([])
      setAdminSection('overview')
      setBookingListFilter('upcoming')
      setBookingSearch('')
      setUser(null)
    } catch (reason: unknown) {
      setAgendaError(reason instanceof Error ? reason.message : 'Não foi possível encerrar a sessão. Tente novamente.')
    } finally {
      setLoggingOut(false)
    }
  }

  async function updateStatus(group: BookingGroup, status: 'cancelled' | 'completed' | 'no_show') {
    const actionLabel = status === 'cancelled' ? 'cancelar este atendimento' : status === 'completed' ? 'marcar este atendimento como concluído' : 'registrar que o cliente não compareceu'
    if (!window.confirm(`Deseja ${actionLabel}?`)) return
    setBusyAction(`${group.id}:${status}`)
    setAgendaError('')
    setNotice('')
    try {
      await apiPatch(`/api/admin/booking-groups/${encodeURIComponent(group.id)}/status`, { status })
      setNotice(status === 'cancelled' ? 'Atendimento cancelado.' : status === 'completed' ? 'Atendimento marcado como concluído.' : 'Não comparecimento registrado.')
      setReloadKey((value) => value + 1)
    } catch (reason: unknown) {
      setAgendaError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o atendimento.')
    } finally {
      setBusyAction('')
    }
  }

  async function markWhatsAppSent(group: BookingGroup) {
    setBusyAction(`${group.id}:whatsapp`)
    setAgendaError('')
    setNotice('')
    try {
      await apiPost(`/api/admin/booking-groups/${encodeURIComponent(group.id)}/whatsapp-confirmation`, {})
      setNotice('Confirmação via WhatsApp marcada como enviada. Esse registro é manual.')
      setReloadKey((value) => value + 1)
    } catch (reason: unknown) {
      setAgendaError(reason instanceof Error ? reason.message : 'Não foi possível registrar o envio.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleWhatsAppAction(group: BookingGroup) {
    if (group.whatsappConfirmationMarkedAt) return
    const p19Demo = new URLSearchParams(window.location.search).get('demoLogin') === 'DEMO'
    if (p19Demo) {
      if (whatsappPreparedGroupId !== group.id) {
        const message = buildConfirmationMessage(group)
        try { await navigator.clipboard.writeText(message) } catch { /* Clipboard unavailable in local demo. */ }
        setWhatsappPreparedGroupId(group.id)
        setNotice('Demonstração: mensagem preparada/copiada. Nenhum WhatsApp será aberto. Toque novamente para registrar o envio fictício.')
        return
      }
      await markWhatsAppSent(group)
      setWhatsappPreparedGroupId(null)
      return
    }
    if (whatsappPreparedGroupId !== group.id) {
      openWhatsAppConfirmation(group)
      setWhatsappPreparedGroupId(group.id)
      setNotice('WhatsApp aberto com a confirmação pré-formatada. Após enviar a mensagem, toque novamente no ícone para registrar o envio.')
      return
    }
    await markWhatsAppSent(group)
    setWhatsappPreparedGroupId(null)
  }

  if (!authChecked) {
    return <main className="page-shell admin-shell">
      <header className="topbar"><Link className="brand" to="/" aria-label="Voltar ao agendamento"><span className="brand-mark">2R</span><span><strong>2R BARBER</strong><small>BARBEARIA</small></span></Link><span className="topbar-note">ÁREA ADMINISTRATIVA</span></header>
      <section className="booking-panel admin-loading"><p className="message" role="status">Verificando sua sessão...</p></section>
    </main>
  }

  if (!user) {
    return <main className="page-shell admin-shell">
      <header className="topbar"><Link className="brand" to="/" aria-label="Voltar ao agendamento"><span className="brand-mark">2R</span><span><strong>2R BARBER</strong><small>BARBEARIA</small></span></Link><span className="topbar-note">ÁREA ADMINISTRATIVA</span></header>
      <section className="booking-panel admin-login-panel" aria-labelledby="admin-login-title">
        <div className="section-heading"><span className="step-index">01</span><div><p className="eyebrow">ACESSO RESTRITO</p><h1 id="admin-login-title">Entre para gerenciar a agenda.</h1></div></div>
        <p className="step-description">Acesse com seu ID administrativo e senha.</p>
        {loginError && <p className="message error" role="alert">{loginError}</p>}
        <form className="customer-form" onSubmit={submitLogin}>
          <label>ID administrativo<input value={loginId} onChange={(event) => setLoginId(event.target.value.toUpperCase())} autoComplete="username" maxLength={40} placeholder="Seu ID de acesso" required /></label>
          <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={200} placeholder="Sua senha" required /></label>
          <button className="primary-button full-width" disabled={loginLoading}>{loginLoading ? 'Entrando...' : 'Entrar na administração'}</button>
        </form>
        <p className="form-hint admin-dev-hint">Acesso de demonstração: ID <strong>DEMO</strong> · senha <strong>2Rdemo26</strong>. Todos os dados deste ambiente são fictícios.</p>
        <Link className="back-link" to="/">Voltar ao agendamento</Link>
      </section>
      <footer className="footer"><span>2R Barber Studio</span><span>P15 · Núcleo administrativo</span></footer>
    </main>
  }

  function navigateTo(section: AdminSection) {
    setAdminSection(section)
    setNotice('')
    setAgendaError('')
    if (section === 'overview') {
      setAgendaDate(businessDateToday())
      setProfessionalFilter('all')
      setStatusFilter('all')
    }
  }

  function refreshCurrentView() {
    setReloadKey((value) => value + 1)
    setSettingsRefreshKey((value) => value + 1)
  }

  const p19Package = new URLSearchParams(window.location.search).get('demoPackage') ?? '';
  const isBasicBarberPackage = ['barber.agenda', 'barber.siteagenda'].includes(p19Package);
  const visibleAdminNavItems = isBasicBarberPackage
    ? adminNavItems.filter((item) => !['promotions', 'finance'].includes(item.id))
    : adminNavItems;
  const upcomingGroups = (agenda?.bookingGroups ?? []).filter((group) => group.status === 'confirmed').slice(0, 5)
  const firstName = user.displayName.trim().split(/\s+/)[0] || 'Administrador'

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link className="brand admin-sidebar-brand" to="/" aria-label="2R Barber Studio — agendamento público">
          <span className="brand-mark">2R</span><span><strong>2R BARBER</strong><small>BARBEARIA</small></span>
        </Link>
        <div className="admin-sidebar-divider" />
        <p className="admin-menu-label">MENU PRINCIPAL</p>
        <nav className="admin-nav" aria-label="Painel administrativo">
          {visibleAdminNavItems.map((item) => (
            <button key={item.id} type="button" className={adminSection === item.id ? 'active' : ''} aria-current={adminSection === item.id ? 'page' : undefined} onClick={() => navigateTo(item.id)}>
              <AdminIcon name={item.icon} size={19} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-user">
          <span className="admin-avatar">{user.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <span className="admin-user-copy"><strong>{user.displayName}</strong><small>Administrador</small></span>
          <span className="admin-connection-dot" title="Sessão autenticada" />
        </div>
      </aside>

      <div className="admin-main-wrap">
        <header className="admin-toolbar">
          <div className="admin-breadcrumb"><span>2R Barber Studio</span><span className="admin-breadcrumb-divider">/</span><strong>{adminSectionLabels[adminSection]}</strong></div>
          <div className="admin-toolbar-actions">
            <Link to="/" target="_blank" rel="noreferrer" className="admin-view-public" aria-label="Abrir agendamento público"><AdminIcon name="external" size={15} /><span>Ver agendamento</span></Link>
            <button className="admin-icon-action" type="button" onClick={refreshCurrentView} aria-label="Atualizar dados"><AdminIcon name="refresh" size={17} /></button>
            <button className="admin-icon-action" type="button" onClick={logout} disabled={loggingOut} aria-label="Sair do painel"><AdminIcon name="logout" size={17} /></button>
          </div>
        </header>

        <main className="admin-content">
          {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}
          {agendaError && <div className="admin-alert admin-alert-error" role="alert">{agendaError}</div>}

          {adminSection === 'overview' && (
            <section className="admin-overview" aria-labelledby="overview-title">
              <div className="overview-heading">
                <p className="eyebrow">SUA BARBEARIA, EM UM SÓ LUGAR</p>
                <h1 id="overview-title">Olá, {firstName}.</h1>
                <p className="overview-date">{formatDateLong(businessDateToday())}</p>
                <p>Acompanhe a agenda e mantenha os atendimentos organizados.</p>
              </div>
              <div className="overview-welcome-card">
                <span className="overview-welcome-icon"><AdminIcon name="overview" size={20} /></span>
                <div><strong>Um novo dia para cuidar de cada detalhe.</strong><p>Consulte seus horários, acompanhe as confirmações e deixe a agenda pronta para receber clientes.</p></div>
              </div>

              <section className="admin-overview-stats" aria-label="Resumo da agenda de hoje">
                <article className="overview-stat"><span>Atendimentos</span><strong>{agenda?.summary.total ?? '—'}</strong><small>Na data selecionada</small></article>
                <article className="overview-stat"><span>Confirmados</span><strong>{agenda?.summary.confirmed ?? '—'}</strong><small>Ocupando a agenda</small></article>
                <article className="overview-stat"><span>Concluídos</span><strong>{agenda?.summary.completed ?? '—'}</strong><small>Atendimentos finalizados</small></article>
                <article className="overview-stat"><span>Valor previsto</span><strong>{agenda ? currency.format(agenda.summary.revenueCents / 100) : '—'}</strong><small>Atendimentos confirmados</small></article>
              </section>

              <div className="admin-overview-columns">
                <section className="admin-dashboard-card" aria-labelledby="overview-agenda-title">
                  <div className="admin-dashboard-card-heading"><div><p className="eyebrow">AGENDA</p><h2 id="overview-agenda-title">Atendimentos do dia</h2></div><button className="admin-text-link" type="button" onClick={() => navigateTo('agenda')}>Ver todos <AdminIcon name="arrow-right" size={14} /></button></div>
                  {loadingAgenda && !agenda ? <p className="message" role="status">Carregando agenda...</p> : upcomingGroups.length ? (
                    <div className="overview-booking-list">{upcomingGroups.map((group) => (
                      <article className="overview-booking-row" key={group.id}>
                        <span className="overview-booking-time">{groupTimeLabel(group)}</span>
                        <div><strong>{group.customer.name}</strong><small>{group.items.map((item) => item.serviceName).join(' · ')}</small></div>
                        <strong className="overview-booking-price">{currency.format(group.totalPriceCents / 100)}</strong>
                      </article>
                    ))}</div>
                  ) : <div className="admin-empty-state"><strong>Agenda tranquila por enquanto</strong><p>Os atendimentos confirmados para a data aparecerão aqui.</p></div>}
                </section>

                <section className="admin-dashboard-card admin-quick-access" aria-labelledby="quick-access-title">
                  <p className="eyebrow">ACESSO RÁPIDO</p><h2 id="quick-access-title">Organize sua rotina.</h2><p className="overview-quick-copy">Atalhos para as tarefas mais usadas no dia a dia.</p>
                  <button type="button" className="overview-quick-link" onClick={() => navigateTo('agenda')}><span className="overview-quick-icon"><AdminIcon name="agenda" size={17} /></span><span><strong>Consultar agenda</strong><small>Acompanhe horários e confirmações</small></span><AdminIcon name="arrow-right" size={16} /></button>
                  <button type="button" className="overview-quick-link" onClick={() => navigateTo('services')}><span className="overview-quick-icon"><AdminIcon name="services" size={17} /></span><span><strong>Editar serviços</strong><small>Preços, durações e disponibilidade</small></span><AdminIcon name="arrow-right" size={16} /></button>
                  <button type="button" className="overview-quick-link" onClick={() => navigateTo('hours')}><span className="overview-quick-icon"><AdminIcon name="hours" size={17} /></span><span><strong>Configurar funcionamento</strong><small>Defina os dias e horários</small></span><AdminIcon name="arrow-right" size={16} /></button>
                  <button type="button" className="overview-quick-link" onClick={() => navigateTo('customers')}><span className="overview-quick-icon"><AdminIcon name="customers" size={17} /></span><span><strong>Localizar clientes</strong><small>Consulte cadastros e histórico de atendimentos</small></span><AdminIcon name="arrow-right" size={16} /></button>
                  <button type="button" className="overview-quick-link" onClick={() => navigateTo('finance')}><span className="overview-quick-icon"><AdminIcon name="finance" size={17} /></span><span><strong>Abrir financeiro</strong><small>Registre entradas, saídas e contas a pagar</small></span><AdminIcon name="arrow-right" size={16} /></button>
                  <div className="overview-quick-note"><AdminIcon name="shield" size={17} /><span>A disponibilidade pública usa os horários cadastrados e evita conflitos de reserva.</span></div>
                </section>
              </div>
              {loadingAgenda && <p className="admin-loading-note" role="status">Atualizando informações...</p>}
            </section>
          )}

          {adminSection === 'agenda' && (
            <section className="admin-agenda-page admin-data-page" aria-labelledby="daily-agenda-title">
              <div className="admin-page-heading"><div><p className="eyebrow">ACOMPANHE SUA ROTINA</p><h1 id="daily-agenda-title">Agendamentos<span className="heading-period">.</span></h1><p>Consulte os próximos atendimentos, revise as confirmações e atualize o status ao finalizar.</p></div><button className="secondary-button" type="button" onClick={() => window.print()}>Imprimir agenda</button></div>
              <div className="admin-appointments-toolbar">
                <div className="admin-segmented-filters" role="group" aria-label="Filtrar agendamentos">
                  <button className={bookingListFilter === 'upcoming' ? 'active' : ''} type="button" onClick={() => setBookingListFilter('upcoming')}>Próximos</button>
                  <button className={bookingListFilter === 'pending' ? 'active' : ''} type="button" onClick={() => setBookingListFilter('pending')}>Confirmação pendente</button>
                  <button className={bookingListFilter === 'all' ? 'active' : ''} type="button" onClick={() => setBookingListFilter('all')}>Todos</button>
                </div>
                <label className="admin-search-field"><span aria-hidden="true">⌕</span><input type="search" value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Buscar cliente, WhatsApp ou código" aria-label="Buscar agendamentos por cliente, WhatsApp, serviço ou código" /></label>
              </div>
              <p className="admin-results-count">{filteredBookingGroups.length} {filteredBookingGroups.length === 1 ? 'atendimento' : 'atendimentos'}{bookingListFilter === 'pending' ? ' aguardando a marcação manual da confirmação via WhatsApp' : bookingListFilter === 'upcoming' ? ' futuros ou ainda em andamento' : ' no histórico'}</p>
              {bookingListError && <p className="admin-alert admin-alert-error" role="alert">{bookingListError}</p>}
              {bookingListLoading ? <p className="message" role="status">Carregando agendamentos...</p> : filteredBookingGroups.length ? (
                <section className="admin-appointment-list" aria-label="Lista de atendimentos">
                  {filteredBookingGroups.map((group) => (
                    <article className="admin-appointment-card" key={group.id}>
                      <div className="admin-appointment-date"><strong>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(parseDate(group.date))}</strong><span>{group.items.slice().sort((a, b) => a.time.localeCompare(b.time))[0]?.time ?? '—'}</span></div>
                      <div className="admin-appointment-main">
                        <div className="admin-appointment-card-head"><div className="admin-appointment-customer"><strong>{group.customer.name}</strong><span>{formatWhatsApp(group.customer.whatsapp)}</span><small>{group.items.length} {group.items.length === 1 ? 'procedimento' : 'procedimentos'} · Código {group.publicCode}</small></div><strong className="admin-appointment-total">{currency.format(group.totalPriceCents / 100)}</strong></div>
                        <div className="admin-appointment-status-row"><span className={`admin-status status-${group.status}`}>{statusLabels[group.status]}</span>{group.whatsappConfirmationMarkedAt && <span className="admin-whatsapp-status">WhatsApp marcado como enviado</span>}</div>
                        <div className="admin-appointment-items">{group.items.slice().sort((a, b) => a.time.localeCompare(b.time)).map((item) => <div className="admin-appointment-item" key={item.id}><strong>{item.time}</strong><div><span>{item.serviceName}</span><small>{item.professionalName} · {item.durationMinutes} min</small></div><b>{currency.format(item.priceCents / 100)}</b></div>)}</div>
                        {group.status === 'confirmed' && <div className="admin-appointment-actions"><div className="admin-whatsapp-action-wrap"><button className={`admin-whatsapp-action ${group.whatsappConfirmationMarkedAt ? 'is-sent' : whatsappPreparedGroupId === group.id ? 'is-ready' : ''}`} type="button" onClick={() => void handleWhatsAppAction(group)} disabled={busyAction !== '' || Boolean(group.whatsappConfirmationMarkedAt)} aria-label={group.whatsappConfirmationMarkedAt ? 'Confirmação via WhatsApp já registrada' : whatsappPreparedGroupId === group.id ? 'Registrar mensagem do WhatsApp como enviada' : 'Abrir confirmação pré-formatada no WhatsApp'}><AdminIcon name="whatsapp" size={24} /></button><p>{group.whatsappConfirmationMarkedAt ? 'Confirmação via WhatsApp registrada' : whatsappPreparedGroupId === group.id ? (busyAction === `${group.id}:whatsapp` ? 'Registrando envio...' : 'Após enviar a mensagem, toque no ícone para confirmar') : 'Realizar confirmação via WhatsApp'}</p></div><label className="admin-status-action">Status do atendimento<select value={group.status} disabled={busyAction !== ''} onChange={(event) => { const next = event.target.value; if (next === 'completed' || next === 'cancelled' || next === 'no_show') void updateStatus(group, next) }}><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option></select></label></div>}
                      </div>
                    </article>
                  ))}
                </section>
              ) : <div className="admin-empty-state"><strong>Nenhum agendamento encontrado</strong><p>{bookingSearch.trim() ? 'Tente pesquisar por outro nome, telefone ou código.' : bookingListFilter === 'pending' ? 'Todos os atendimentos futuros já têm a confirmação do WhatsApp marcada, ou não há atendimentos aguardando.' : 'Os novos atendimentos reservados pelo site aparecerão nesta lista.'}</p></div>}
            </section>
          )}

          {adminSection === 'customers' && <AdminCustomers key={`customers-${reloadKey}`} onNotice={(message) => { setNotice(message); setAgendaError('') }} />}
          {adminSection === 'promotions' && <AdminPromotions key={`promotions-${reloadKey}`} onNotice={(message) => { setNotice(message); setAgendaError('') }} />}
          {adminSection === 'finance' && <AdminFinance key={`finance-${reloadKey}`} onNotice={(message) => { setNotice(message); setAgendaError('') }} />}


          {(['services', 'professionals', 'hours', 'blocks'] as AdminSection[]).includes(adminSection) && <AdminSettings key={`${adminSection}-${settingsRefreshKey}`} section={adminSection as 'services' | 'professionals' | 'hours' | 'blocks'} onNotice={(message) => { setNotice(message); setAgendaError(''); setReloadKey((value) => value + 1) }} />}
        </main>
        <footer className="admin-footer"><span>2R Barber Studio</span><span>Agenda e gestão de atendimentos</span></footer>
      </div>
    </div>
  )
}
