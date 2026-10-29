import { useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiPatch, apiPost } from '../lib/api'

type Customer = {
  id: string
  name: string
  whatsapp: string
  createdAt: string
  appointmentCount: number
  noShowCount: number
  lastAppointmentDate: string | null
}
type BookingItem = { id: string; serviceName: string; professionalName: string; time: string; durationMinutes: number; priceCents: number }
type BookingGroup = { id: string; publicCode: string; date: string; status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'; customer: { name: string; whatsapp: string }; items: BookingItem[]; totalPriceCents: number }
type CustomerHistory = { customer: Customer; bookingGroups: BookingGroup[] }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const statusLabels: Record<BookingGroup['status'], string> = { confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído', no_show: 'Não compareceu' }

function formatWhatsApp(value: string) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return value
}

function formatDate(value: string | null) {
  if (!value) return 'Ainda não agendou'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CL'
}

function groupRange(group: BookingGroup) {
  if (!group.items.length) return 'Horário não informado'
  const sorted = [...group.items].sort((a, b) => a.time.localeCompare(b.time))
  const first = sorted[0]
  const ends = sorted.map((item) => {
    const [hours, minutes] = item.time.split(':').map(Number)
    const total = hours * 60 + minutes + item.durationMinutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }).sort()
  return sorted.length === 1 ? first.time : `${first.time} — ${ends.at(-1)}`
}

export default function AdminCustomers({ onNotice }: { onNotice: (message: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWhatsApp, setNewWhatsApp] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [histories, setHistories] = useState<Record<string, CustomerHistory>>({})
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null)
  const [editNames, setEditNames] = useState<Record<string, string>>({})

  async function loadCustomers(searchTerm = search) {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<{ customers: Customer[] }>(`/api/admin/customers?search=${encodeURIComponent(searchTerm)}`)
      setCustomers(data.customers)
      setEditNames(Object.fromEntries(data.customers.map((customer) => [customer.id, customer.name])))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os clientes.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadCustomers('') }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCustomers(search) }, 220)
    return () => window.clearTimeout(timer)
  }, [search])

  async function toggleHistory(customer: Customer) {
    if (expandedId === customer.id) { setExpandedId(null); return }
    setExpandedId(customer.id)
    if (histories[customer.id]) return
    setLoadingHistoryId(customer.id)
    try {
      const history = await apiGet<CustomerHistory>(`/api/admin/customers/${encodeURIComponent(customer.id)}/history`)
      setHistories((current) => ({ ...current, [customer.id]: history }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o histórico do cliente.')
    } finally { setLoadingHistoryId(null) }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const data = await apiPost<{ customer: Customer }>('/api/admin/customers', { name: newName, whatsapp: newWhatsApp })
      setCustomers((current) => [...current, data.customer].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setEditNames((current) => ({ ...current, [data.customer.id]: data.customer.name }))
      setNewName(''); setNewWhatsApp(''); setShowCreate(false)
      onNotice(`Cliente ${data.customer.name} cadastrado.`)
      await loadCustomers(search)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar o cliente.') }
    finally { setSaving(false) }
  }

  async function saveCustomerName(customer: Customer) {
    const name = String(editNames[customer.id] ?? '').trim()
    if (name === customer.name) return
    setSaving(true); setError('')
    try {
      const data = await apiPatch<{ customer: Customer }>(`/api/admin/customers/${encodeURIComponent(customer.id)}`, { name })
      setCustomers((current) => current.map((item) => item.id === customer.id ? data.customer : item))
      setHistories((current) => current[customer.id] ? { ...current, [customer.id]: { ...current[customer.id], customer: data.customer } } : current)
      onNotice('Cadastro do cliente atualizado.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o cadastro.') }
    finally { setSaving(false) }
  }

  return <section className="admin-data-page" aria-labelledby="customers-title">
    <div className="admin-page-heading"><div><p className="eyebrow">CADASTRO E HISTÓRICO</p><h1 id="customers-title">Clientes<span className="heading-period">.</span></h1><p>Pesquise por nome ou WhatsApp e consulte os atendimentos anteriores.</p></div><span className="admin-count-chip">{customers.length} cadastrados</span></div>
    {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}

    <section className={`admin-data-card customer-create-card ${showCreate ? 'is-open' : ''}`}>
      <div className="admin-data-card-heading"><div><p className="eyebrow">NOVO CADASTRO</p><h2>Adicionar cliente</h2><p>Cadastre também clientes que agendam diretamente na barbearia.</p></div><button type="button" className="secondary-button" onClick={() => setShowCreate((current) => !current)}>{showCreate ? 'Fechar' : '+ Adicionar'}</button></div>
      {showCreate && <form className="admin-data-form" onSubmit={createCustomer}>
        <label>Nome completo<input value={newName} onChange={(event) => setNewName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" placeholder="Nome do cliente" required /></label>
        <label>WhatsApp com DDD<input type="tel" inputMode="tel" autoComplete="tel" value={newWhatsApp} onChange={(event) => setNewWhatsApp(event.target.value)} maxLength={20} placeholder="(67) 99999-9999" required /></label>
        <p className="admin-field-hint">O WhatsApp será normalizado para evitar cadastros duplicados. Se o cliente já tiver agendado no site, pesquise pelo número em vez de criar outro cadastro.</p>
        <button className="primary-button full-width" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar cliente'}</button>
      </form>}
    </section>

    <section className="admin-data-card customer-directory">
      <div className="admin-data-card-heading"><div><p className="eyebrow">CADASTROS EXISTENTES</p><h2>Localizar cliente</h2></div><span className="admin-count-chip">{customers.length}</span></div>
      <label className="admin-search-field"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome ou telefone" aria-label="Pesquisar clientes por nome ou WhatsApp" /></label>
      {loading ? <p className="message" role="status">Carregando clientes...</p> : customers.length ? <div className="customer-profile-list">
        {customers.map((customer) => {
          const expanded = expandedId === customer.id
          const history = histories[customer.id]
          return <article className={`customer-profile-card ${expanded ? 'is-expanded' : ''}`} key={customer.id}>
            <button type="button" className="customer-profile-summary" aria-expanded={expanded} onClick={() => void toggleHistory(customer)}>
              <span className="customer-profile-avatar">{initials(customer.name)}</span>
              <span className="customer-profile-identity"><strong>{customer.name}</strong><span>{formatWhatsApp(customer.whatsapp)}</span></span>
              <span className="customer-profile-chevron">{expanded ? '⌃' : '⌄'}</span>
              <span className="customer-profile-meta"><span>{customer.appointmentCount} {customer.appointmentCount === 1 ? 'atendimento' : 'atendimentos'}</span><span>{customer.noShowCount} faltas</span></span>
            </button>
            {expanded && <div className="customer-profile-details">
              <div className="customer-history-summary"><span><small>Último agendamento</small><strong>{formatDate(customer.lastAppointmentDate)}</strong></span><span><small>Cadastro</small><strong>{formatDate(customer.createdAt.slice(0, 10))}</strong></span></div>
              <form className="customer-edit-form" onSubmit={(event) => { event.preventDefault(); void saveCustomerName(customer) }}><label>Nome exibido<input value={editNames[customer.id] ?? customer.name} onChange={(event) => setEditNames((current) => ({ ...current, [customer.id]: event.target.value }))} minLength={2} maxLength={100} required /></label><button className="secondary-button" type="submit" disabled={saving || (editNames[customer.id] ?? customer.name).trim() === customer.name}>{saving ? 'Salvando...' : 'Salvar nome'}</button></form>
              <div className="customer-history-heading"><h3>Histórico de atendimentos</h3><span>{history?.bookingGroups.length ?? customer.appointmentCount}</span></div>
              {loadingHistoryId === customer.id ? <p className="message" role="status">Carregando histórico...</p> : history?.bookingGroups.length ? <div className="customer-history-list">{history.bookingGroups.map((group) => <article className="customer-history-row" key={group.id}>
                <div className="customer-history-row-head"><strong>{formatDate(group.date)} · {groupRange(group)}</strong><span className={`admin-status status-${group.status}`}>{statusLabels[group.status]}</span></div>
                <p>{group.items.map((item) => `${item.serviceName} (${item.professionalName}, ${item.time})`).join(' · ')}</p>
                <div className="customer-history-row-foot"><small>Código {group.publicCode}</small><strong>{currency.format(group.totalPriceCents / 100)}</strong></div>
              </article>)}</div> : <div className="admin-empty-state compact"><strong>Nenhum atendimento anterior</strong><p>Os novos agendamentos aparecerão aqui automaticamente.</p></div>}
            </div>}
          </article>
        })}
      </div> : <div className="admin-empty-state"><strong>{search ? 'Nenhum cliente encontrado' : 'Ainda não há clientes cadastrados'}</strong><p>{search ? 'Tente outro nome ou número de WhatsApp.' : 'Os clientes que agendarem pelo site aparecerão automaticamente. Você também pode cadastrar um cliente manualmente.'}</p></div>}
    </section>
  </section>
}
