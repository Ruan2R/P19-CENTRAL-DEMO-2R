import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiGet, apiPatch, apiPost } from '../lib/api'

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; active: boolean }
type PromotionService = { id: string; name: string; priceCents: number; active: boolean }
type Promotion = { id: string; name: string; kind: 'service' | 'combo'; startsOn: string; endsOn: string; active: boolean; serviceIds: string[]; services: PromotionService[]; promoPriceCents: number; createdAt: string | null; updatedAt: string | null }
type PromotionPayload = { name: string; kind: 'service' | 'combo'; startsOn: string; endsOn: string; active: boolean; serviceIds: string[]; promoPriceCents: number }
type DataResponse = { services: Service[]; promotions: Promotion[] }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function todayLocal() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
function dateLabel(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) }
function toCents(value: string) { return Math.round(Number(String(value).trim().replace(',', '.')) * 100) }

export default function AdminPromotions({ onNotice }: { onNotice: (message: string) => void }) {
  const [data, setData] = useState<DataResponse>({ services: [], promotions: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'service' | 'combo'>('service')
  const [startsOn, setStartsOn] = useState(todayLocal())
  const [endsOn, setEndsOn] = useState(todayLocal())
  const [active, setActive] = useState(true)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [promoPrice, setPromoPrice] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'ended' | 'paused'>('all')

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true)
    setError('')
    try { setData(await apiGet<DataResponse>('/api/admin/promotions')) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as promoções.') }
    finally { if (showSpinner) setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  // Keep inactive services visible when they are already attached to an old paused promotion, so it can be edited or removed safely.
  const selectableServices = data.services.filter((service) => service.active || serviceIds.includes(service.id))
  const selectedServices = serviceIds.map((id) => data.services.find((service) => service.id === id)).filter((service): service is Service => Boolean(service))
  const regularPrice = selectedServices.reduce((sum, service) => sum + service.priceCents, 0)
  const discountCents = promoPrice.trim() ? Math.max(0, regularPrice - toCents(promoPrice)) : 0
  const currentDate = todayLocal()
  function promotionState(promotion: Promotion) {
    if (!promotion.active) return 'paused'
    if (promotion.endsOn < currentDate) return 'ended'
    if (promotion.startsOn > currentDate) return 'scheduled'
    return 'active'
  }
  const filteredPromotions = useMemo(() => data.promotions.filter((promotion) => filter === 'all' || promotionState(promotion) === filter).slice().sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.name.localeCompare(b.name, 'pt-BR')), [data.promotions, filter, currentDate])

  function resetForm() {
    setEditingId(null); setName(''); setKind('service'); setStartsOn(todayLocal()); setEndsOn(todayLocal()); setActive(true); setServiceIds([]); setPromoPrice(''); setShowForm(false); setError('')
  }
  function editPromotion(promotion: Promotion) {
    setEditingId(promotion.id); setName(promotion.name); setKind(promotion.kind); setStartsOn(promotion.startsOn); setEndsOn(promotion.endsOn); setActive(promotion.active); setServiceIds(promotion.serviceIds); setPromoPrice((promotion.promoPriceCents / 100).toFixed(2)); setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function toggleService(id: string, checked: boolean) {
    setServiceIds((current) => {
      if (checked) {
        if (kind === 'service') return [id]
        return current.includes(id) ? current : [...current, id].slice(0, 6)
      }
      return current.filter((value) => value !== id)
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: PromotionPayload = { name: name.trim(), kind, startsOn, endsOn, active, serviceIds, promoPriceCents: toCents(promoPrice) }
    setSaving(true); setError('')
    try {
      if (editingId) await apiPatch(`/api/admin/promotions/${encodeURIComponent(editingId)}`, payload)
      else await apiPost('/api/admin/promotions', payload)
      onNotice(editingId ? 'Promoção atualizada.' : 'Promoção cadastrada. O preço será aplicado somente dentro da validade.')
      resetForm()
      await load(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a promoção.') }
    finally { setSaving(false) }
  }

  async function toggleActive(promotion: Promotion) {
    const next = { name: promotion.name, kind: promotion.kind, startsOn: promotion.startsOn, endsOn: promotion.endsOn, active: !promotion.active, serviceIds: promotion.serviceIds, promoPriceCents: promotion.promoPriceCents }
    setSaving(true); setError('')
    try {
      await apiPatch(`/api/admin/promotions/${encodeURIComponent(promotion.id)}`, next)
      onNotice(next.active ? `Promoção “${promotion.name}” ativada.` : `Promoção “${promotion.name}” pausada.`)
      await load(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a promoção.') }
    finally { setSaving(false) }
  }

  return <section className="admin-data-page promotions-page" aria-labelledby="promotions-title">
    <div className="admin-page-heading"><div><p className="eyebrow">OFERTAS DA BARBEARIA</p><h1 id="promotions-title">Promoções<span className="heading-period">.</span></h1><p>Ofertas para serviços individuais e combos, sem alterar os preços normais.</p></div></div>
    <details className="promotion-info"><summary>Como funcionam os combos</summary><p>Selecione de 2 a 6 serviços diferentes e defina um preço para o pacote. O desconto é aplicado somente quando todos os serviços estiverem no mesmo atendimento e a data estiver dentro da validade.</p></details>
    {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}

    <section className={`admin-data-card promotion-create-card ${showForm ? 'is-open' : ''}`}>
      <div className="admin-data-card-heading promotion-create-heading"><div><p className="eyebrow">{editingId ? 'EDITAR OFERTA' : 'NOVA OFERTA'}</p><h2>{editingId ? 'Editar promoção' : 'Criar promoção'}</h2><p>Descontos especiais sem alterar o catálogo.</p></div><button type="button" className="secondary-button" onClick={() => showForm ? resetForm() : setShowForm(true)}>{showForm ? 'Fechar formulário' : '+ Nova promoção'}</button></div>
      {showForm && <form className="admin-data-form promotion-form" onSubmit={submit}>
        <label>Nome da promoção<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} placeholder="Ex.: Combo corte + barba" required /></label>
        <label>Tipo de oferta<select value={kind} onChange={(event) => { const next = event.target.value as 'service' | 'combo'; setKind(next); if (next === 'service' && serviceIds.length > 1) setServiceIds(serviceIds.slice(0, 1)) }}><option value="service">Promoção de um serviço</option><option value="combo">Combo de serviços</option></select></label>
        <div className="promotion-date-fields"><label>Início da validade<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required /></label><label>Fim da validade<input type="date" min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} required /></label></div>
        <div className="promotion-service-picker"><div className="promotion-service-picker-heading"><strong>{kind === 'service' ? 'Escolha o serviço' : 'Escolha os serviços do combo'}</strong><small>{kind === 'service' ? 'Selecione exatamente um serviço.' : `${serviceIds.length} selecionados · mínimo 2, máximo 6`}</small></div>
          {selectableServices.length ? selectableServices.map((service) => {
            const checked = serviceIds.includes(service.id)
            const disabled = (!service.active && !checked) || (kind === 'combo' && !checked && serviceIds.length >= 6)
            return <label className={`promotion-service-choice ${checked ? 'is-selected' : ''} ${!service.active ? 'is-inactive' : ''}`} key={service.id}><input type={kind === 'service' ? 'radio' : 'checkbox'} name="promotion-services" checked={checked} disabled={disabled} onChange={(event) => toggleService(service.id, event.target.checked)} /><span><strong>{service.name}</strong><small>{service.durationMinutes} min · {currency.format(service.priceCents / 100)}{!service.active ? ' · Serviço inativo' : ''}</small></span><b>{checked ? 'Selecionado' : 'Adicionar'}</b></label>
          }) : <p className="admin-empty-state">Cadastre ao menos um serviço ativo antes de criar uma promoção.</p>}
        </div>
        <div className="promotion-price-summary"><div><span>Valor normal{kind === 'combo' ? ' do combo' : ''}</span><strong>{currency.format(regularPrice / 100)}</strong></div><div><span>Desconto calculado</span><strong>{currency.format(discountCents / 100)}</strong></div></div>
        <label>Preço promocional (R$)<input type="number" inputMode="decimal" min="0.01" step="0.01" value={promoPrice} onChange={(event) => setPromoPrice(event.target.value)} placeholder="0,00" required /><small>Precisa ser menor que a soma dos preços normais selecionados.</small></label>
        <label className="promotion-active-toggle"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span><strong>Promoção ativa</strong><small>Se pausada, não será aplicada no agendamento público.</small></span></label>
        <div className="promotion-form-actions"><button type="button" className="secondary-button" onClick={resetForm} disabled={saving}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || selectedServices.length === 0}>{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar promoção'}</button></div>
      </form>}
    </section>

    <section className="admin-data-card promotion-directory">
      <div className="admin-data-card-heading"><div><p className="eyebrow">CATÁLOGO DE OFERTAS</p><h2>Promoções cadastradas</h2></div><span className="admin-count-chip">{filteredPromotions.length}</span></div>
      <div className="promotion-filter-bar"><label className="promotion-filter-select"><span>Filtrar por status</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filtrar promoções por status"><option value="all">Todas</option><option value="active">Ativas</option><option value="scheduled">Programadas</option><option value="ended">Encerradas</option><option value="paused">Pausadas</option></select></label><span className="promotion-results-count">{filteredPromotions.length} {filteredPromotions.length === 1 ? 'oferta' : 'ofertas'}</span></div>
      {loading ? <p className="message" role="status">Carregando promoções...</p> : filteredPromotions.length ? <div className="promotion-admin-list">{filteredPromotions.map((promotion) => {
        const state = promotionState(promotion)
        const fullPrice = promotion.services.reduce((sum, service) => sum + service.priceCents, 0)
        const savings = Math.max(0, fullPrice - promotion.promoPriceCents)
        return <article className={`admin-promotion-card state-${state} ${!promotion.active ? 'is-inactive' : ''}`} key={promotion.id}>
          <div className="admin-promotion-card-head"><div><span className="promotion-kind-chip">{promotion.kind === 'service' ? 'Serviço individual' : 'Combo'}</span><h3>{promotion.name}</h3></div><span className={`promotion-status-chip status-${state}`}>{state === 'active' ? 'Ativa' : state === 'scheduled' ? 'Programada' : state === 'ended' ? 'Encerrada' : 'Pausada'}</span></div>
          <div className={`admin-promotion-service-list ${promotion.kind === 'service' ? 'is-single-service' : 'is-combo'}`}>{promotion.services.map((service) => <div key={service.id}><span>{service.name}</span>{promotion.kind === 'combo' && <small>{currency.format(service.priceCents / 100)}</small>}</div>)}</div>
          <div className="admin-promotion-meta-row"><span className="admin-promotion-validity">{dateLabel(promotion.startsOn)} <span aria-hidden="true">—</span> {dateLabel(promotion.endsOn)}</span><span className="admin-promotion-savings">Economize {currency.format(savings / 100)}</span></div>
          <div className="admin-promotion-price-line"><span className="admin-promotion-regular">De <s>{currency.format(fullPrice / 100)}</s></span><span className="admin-promotion-price-word">por</span><strong className="admin-promotion-current-price">{currency.format(promotion.promoPriceCents / 100)}</strong></div>
          <div className="admin-promotion-actions"><button type="button" className="secondary-button" onClick={() => editPromotion(promotion)}>Editar</button><button type="button" className="secondary-button" disabled={saving || state === 'ended' || (!promotion.active && promotion.serviceIds.some((id) => !data.services.find((service) => service.id === id)?.active))} onClick={() => void toggleActive(promotion)}>{promotion.active ? 'Pausar' : 'Ativar'}</button></div>
        </article>
      })}</div> : <div className="admin-empty-state"><strong>{filter === 'all' ? 'Nenhuma promoção cadastrada' : 'Nenhuma promoção neste filtro'}</strong><p>Crie uma oferta para um serviço ou um combo de serviços. Promoções não alteram o catálogo regular.</p></div>}
    </section>
  </section>
}
