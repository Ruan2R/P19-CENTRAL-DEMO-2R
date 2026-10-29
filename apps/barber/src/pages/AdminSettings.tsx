import { useEffect, useState, type FormEvent } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api'

type Section = 'services' | 'professionals' | 'hours' | 'blocks'
type Service = { id: string; name: string; durationMinutes: number; priceCents: number; active: boolean; slug?: string }
type Professional = { id: string; name: string; role: string; active: boolean; slug?: string }
type BusinessHour = { weekday: number; name: string; enabled: boolean; openTime: string; closeTime: string; breakStart: string | null; breakEnd: string | null }
type AdminBlock = { id: string; scope: 'business' | 'professional'; professionalId?: string; professionalName?: string | null; date: string; startTime: string | null; endTime: string | null; reason: string }
type ConfigResponse = { services: Service[]; professionals: Professional[]; businessHours: BusinessHour[] }
type Props = { section: Section; onNotice: (message: string) => void }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const durations = [15, 30, 45, 60, 90, 120]

function businessDateToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', weekday: 'long', day: '2-digit', month: 'long' })
    .format(new Date(`${value}T12:00:00`)).replace(/^./, (letter) => letter.toUpperCase())
}

export default function AdminSettings({ section, onNotice }: Props) {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [blocks, setBlocks] = useState<AdminBlock[]>([])
  const [blockDate, setBlockDate] = useState(businessDateToday)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [serviceDuration, setServiceDuration] = useState('30')
  const [servicePrice, setServicePrice] = useState('')
  const [professionalName, setProfessionalName] = useState('')
  const [professionalRole, setProfessionalRole] = useState('Barbeiro')
  const [blockScope, setBlockScope] = useState<'business' | 'professional'>('professional')
  const [blockProfessional, setBlockProfessional] = useState('')
  const [blockAllDay, setBlockAllDay] = useState(false)
  const [blockStart, setBlockStart] = useState('13:00')
  const [blockEnd, setBlockEnd] = useState('14:00')
  const [blockReason, setBlockReason] = useState('')

  async function refreshConfig() {
    setLoading(true)
    setError('')
    try {
      const [nextConfig, blockResult] = await Promise.all([
        apiGet<ConfigResponse>('/api/admin/configuration'),
        apiGet<{ blocks: AdminBlock[] }>(`/api/admin/blocks?date=${encodeURIComponent(blockDate)}`),
      ])
      setConfig(nextConfig)
      setBlocks(blockResult.blocks)
      setBlockProfessional((current) => current || nextConfig.professionals.find((item) => item.active)?.id || '')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as configurações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshConfig() }, [blockDate, section])

  function reportError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.')
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('service-create')
    setError('')
    try {
      await apiPost('/api/admin/services', {
        name: serviceName,
        durationMinutes: Number(serviceDuration),
        priceCents: Math.round(Number(servicePrice.replace(',', '.')) * 100),
      })
      setServiceName('')
      setServiceDuration('30')
      setServicePrice('')
      onNotice('Serviço cadastrado com sucesso.')
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function updateService(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(`service:${id}`)
    setError('')
    try {
      await apiPatch(`/api/admin/services/${encodeURIComponent(id)}`, {
        name: String(data.get('name') || ''),
        durationMinutes: Number(data.get('durationMinutes')),
        priceCents: Math.round(Number(String(data.get('price') || '0').replace(',', '.')) * 100),
      })
      onNotice('Alterações do serviço salvas.')
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function toggleService(service: Service) {
    const active = !service.active
    if (!window.confirm(`${active ? 'Ativar' : 'Desativar'} o serviço “${service.name}”?`)) return
    setBusy(`service-toggle:${service.id}`)
    setError('')
    try {
      await apiPatch(`/api/admin/services/${encodeURIComponent(service.id)}/active`, { active })
      onNotice(`Serviço ${active ? 'ativado' : 'desativado'}.`)
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function createProfessional(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('professional-create')
    setError('')
    try {
      await apiPost('/api/admin/professionals', { name: professionalName, role: professionalRole })
      setProfessionalName('')
      setProfessionalRole('Barbeiro')
      onNotice('Profissional cadastrado com sucesso.')
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function updateProfessional(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(`professional:${id}`)
    setError('')
    try {
      await apiPatch(`/api/admin/professionals/${encodeURIComponent(id)}`, { name: String(data.get('name') || ''), role: String(data.get('role') || '') })
      onNotice('Alterações do profissional salvas.')
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function toggleProfessional(professional: Professional) {
    const active = !professional.active
    if (!window.confirm(`${active ? 'Ativar' : 'Desativar'} ${professional.name}?`)) return
    setBusy(`professional-toggle:${professional.id}`)
    setError('')
    try {
      await apiPatch(`/api/admin/professionals/${encodeURIComponent(professional.id)}/active`, { active })
      onNotice(`Profissional ${active ? 'ativado' : 'desativado'}.`)
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  function updateHour(weekday: number, field: keyof BusinessHour, value: string | boolean | null) {
    setConfig((current) => current ? ({
      ...current,
      businessHours: current.businessHours.map((day) => day.weekday === weekday ? { ...day, [field]: value } : day),
    }) : current)
  }

  function clearBreak(weekday: number) {
    setConfig((current) => current ? ({
      ...current,
      businessHours: current.businessHours.map((day) => day.weekday === weekday
        ? { ...day, breakStart: null, breakEnd: null }
        : day),
    }) : current)
  }

  async function saveHours(event: FormEvent<HTMLFormElement>, day: BusinessHour) {
    event.preventDefault()
    setBusy(`hours:${day.weekday}`)
    setError('')
    try {
      const response = await apiPut<{ hours: BusinessHour }>(`/api/admin/business-hours/${day.weekday}`, day)
      setConfig((current) => current ? ({ ...current, businessHours: current.businessHours.map((item) => item.weekday === day.weekday ? response.hours : item) }) : current)
      onNotice(`Horário de ${day.name.toLocaleLowerCase('pt-BR')} salvo.`)
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('block-create')
    setError('')
    try {
      await apiPost('/api/admin/blocks', {
        scope: blockScope,
        professionalId: blockScope === 'professional' ? blockProfessional : undefined,
        date: blockDate,
        startTime: blockScope === 'business' && blockAllDay ? '' : blockStart,
        endTime: blockScope === 'business' && blockAllDay ? '' : blockEnd,
        reason: blockReason,
      })
      setBlockReason('')
      onNotice('Bloqueio criado. Os horários afetados deixam de aparecer para agendamento.')
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  async function deleteBlock(block: AdminBlock) {
    if (!window.confirm('Remover este bloqueio da agenda?')) return
    setBusy(`block-delete:${block.id}`)
    setError('')
    try {
      await apiDelete(`/api/admin/blocks/${encodeURIComponent(block.id)}`)
      setBlocks((current) => current.filter((item) => item.id !== block.id))
      onNotice('Bloqueio removido.')
      await refreshConfig()
    } catch (reason: unknown) { reportError(reason) }
    finally { setBusy('') }
  }

  const activeProfessionals = config?.professionals.filter((item) => item.active) ?? []

  return (
    <section className="admin-settings" aria-labelledby="settings-heading">
      <div className="admin-section-heading settings-title-row">
        <div>
          <p className="eyebrow">CONFIGURAÇÕES</p>
          <h2 id="settings-heading">{{ services: 'Serviços e preços', professionals: 'Equipe da barbearia', hours: 'Funcionamento semanal', blocks: 'Bloqueios da agenda' }[section]}</h2>
          <p className="settings-description">As mudanças são salvas na persistência local do projeto e passam a valer para novos agendamentos.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void refreshConfig()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      {loading && !config ? <p className="message" role="status">Carregando configurações...</p> : !config ? <div className="admin-empty-state"><strong>Configurações indisponíveis</strong><p>Atualize a página ou tente novamente.</p></div> : (
        <>
          {section === 'services' && (
            <div className="settings-layout">
              <article className="admin-settings-card">
                <p className="eyebrow">NOVO SERVIÇO</p><h3>Cadastrar serviço</h3>
                <form className="settings-form" onSubmit={createService}>
                  <label>Nome do serviço<input value={serviceName} onChange={(event) => setServiceName(event.target.value)} minLength={2} maxLength={120} placeholder="Ex.: Corte infantil" required /></label>
                  <div className="settings-form-row">
                    <label>Duração<select value={serviceDuration} onChange={(event) => setServiceDuration(event.target.value)}>{durations.map((duration) => <option key={duration} value={duration}>{duration} min</option>)}</select></label>
                    <label>Preço (R$)<input inputMode="decimal" type="number" min="0" max="10000" step="0.01" value={servicePrice} onChange={(event) => setServicePrice(event.target.value)} placeholder="50,00" required /></label>
                  </div>
                  <button className="primary-button full-width" disabled={busy === 'service-create'}>{busy === 'service-create' ? 'Cadastrando...' : 'Cadastrar serviço'}</button>
                </form>
              </article>
              <article className="admin-settings-card">
                <p className="eyebrow">CATÁLOGO</p><h3>Serviços cadastrados ({config.services.length})</h3>
                <div className="settings-list">
                  {config.services.map((service) => (
                    <details className={`settings-item ${service.active ? '' : 'is-inactive'}`} key={service.id}>
                      <summary><span className="settings-item-main"><strong>{service.name}</strong><small>{service.durationMinutes} min · {currency.format(service.priceCents / 100)}</small></span><span className={`settings-state ${service.active ? 'is-active' : ''}`}>{service.active ? 'Ativo' : 'Inativo'}</span></summary>
                      <form className="settings-form settings-edit-form" onSubmit={(event) => void updateService(event, service.id)}>
                        <label>Nome<input name="name" defaultValue={service.name} minLength={2} maxLength={120} required /></label>
                        <div className="settings-form-row"><label>Duração<select name="durationMinutes" defaultValue={service.durationMinutes}>{durations.map((duration) => <option key={duration} value={duration}>{duration} min</option>)}</select></label><label>Preço (R$)<input name="price" type="number" min="0" max="10000" step="0.01" defaultValue={(service.priceCents / 100).toFixed(2)} required /></label></div>
                        <button className="primary-button full-width" disabled={busy === `service:${service.id}`}>{busy === `service:${service.id}` ? 'Salvando...' : 'Salvar alterações'}</button>
                        <button className="secondary-button full-width" type="button" onClick={() => void toggleService(service)} disabled={busy === `service-toggle:${service.id}`}>{service.active ? 'Desativar serviço' : 'Ativar serviço'}</button>
                      </form>
                    </details>
                  ))}
                </div>
              </article>
            </div>
          )}

          {section === 'professionals' && (
            <div className="settings-layout">
              <article className="admin-settings-card">
                <p className="eyebrow">NOVA PESSOA</p><h3>Cadastrar profissional</h3>
                <form className="settings-form" onSubmit={createProfessional}>
                  <label>Nome<input value={professionalName} onChange={(event) => setProfessionalName(event.target.value)} minLength={2} maxLength={100} placeholder="Nome do profissional" required /></label>
                  <label>Função<input value={professionalRole} onChange={(event) => setProfessionalRole(event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Barbeiro" required /></label>
                  <button className="primary-button full-width" disabled={busy === 'professional-create'}>{busy === 'professional-create' ? 'Cadastrando...' : 'Cadastrar profissional'}</button>
                </form>
              </article>
              <article className="admin-settings-card">
                <p className="eyebrow">EQUIPE</p><h3>Profissionais cadastrados ({config.professionals.length})</h3>
                <div className="settings-list">
                  {config.professionals.map((person) => (
                    <details className={`settings-item ${person.active ? '' : 'is-inactive'}`} key={person.id}>
                      <summary><span className="settings-item-main"><strong>{person.name}</strong><small>{person.role}</small></span><span className={`settings-state ${person.active ? 'is-active' : ''}`}>{person.active ? 'Ativo' : 'Inativo'}</span></summary>
                      <form className="settings-form settings-edit-form" onSubmit={(event) => void updateProfessional(event, person.id)}>
                        <label>Nome<input name="name" defaultValue={person.name} minLength={2} maxLength={100} required /></label>
                        <label>Função<input name="role" defaultValue={person.role} minLength={2} maxLength={80} required /></label>
                        <button className="primary-button full-width" disabled={busy === `professional:${person.id}`}>{busy === `professional:${person.id}` ? 'Salvando...' : 'Salvar alterações'}</button>
                        <button className="secondary-button full-width" type="button" onClick={() => void toggleProfessional(person)} disabled={busy === `professional-toggle:${person.id}`}>{person.active ? 'Desativar profissional' : 'Ativar profissional'}</button>
                      </form>
                    </details>
                  ))}
                </div>
              </article>
            </div>
          )}

          {section === 'hours' && (
            <div className="hours-settings-list">
              {config.businessHours.map((day) => (
                <form className={`hours-settings-card ${day.enabled ? '' : 'is-closed'}`} key={day.weekday} onSubmit={(event) => void saveHours(event, day)}>
                  <div className="hours-settings-head"><div><h3>{day.name}</h3><small>{day.enabled ? `${day.openTime} — ${day.closeTime}` : 'Fechado'}</small></div><label className="hours-open-toggle"><input type="checkbox" checked={day.enabled} onChange={(event) => updateHour(day.weekday, 'enabled', event.target.checked)} /> Aberto</label></div>
                  <div className="settings-form-row">
                    <label>Abertura<input type="time" step="1800" value={day.openTime || ''} disabled={!day.enabled} onChange={(event) => updateHour(day.weekday, 'openTime', event.target.value)} required={day.enabled} /></label>
                    <label>Fechamento<input type="time" step="1800" value={day.closeTime || ''} disabled={!day.enabled} onChange={(event) => updateHour(day.weekday, 'closeTime', event.target.value)} required={day.enabled} /></label>
                  </div>
                  <div className="hours-break-heading">
                    <p className="form-hint">Intervalo opcional (almoço ou pausa)</p>
                    <button
                      className="remove-break-button"
                      type="button"
                      onClick={() => clearBreak(day.weekday)}
                      disabled={!day.enabled || (!day.breakStart && !day.breakEnd)}
                      aria-label={`Limpar intervalo de ${day.name}`}
                    >Remover intervalo</button>
                  </div>
                  <div className="settings-form-row">
                    <label>Início da pausa<input type="time" step="1800" value={day.breakStart || ''} disabled={!day.enabled} onChange={(event) => updateHour(day.weekday, 'breakStart', event.target.value || null)} /></label>
                    <label>Fim da pausa<input type="time" step="1800" value={day.breakEnd || ''} disabled={!day.enabled} onChange={(event) => updateHour(day.weekday, 'breakEnd', event.target.value || null)} /></label>
                  </div>
                  <p className="form-hint break-save-hint">Depois de remover ou ajustar o intervalo, salve o dia para aplicar a alteração.</p>
                  <button className="primary-button full-width" disabled={busy === `hours:${day.weekday}`}>{busy === `hours:${day.weekday}` ? 'Salvando...' : `Salvar ${day.name.toLocaleLowerCase('pt-BR')}`}</button>
                </form>
              ))}
            </div>
          )}

          {section === 'blocks' && (
            <div className="settings-layout">
              <article className="admin-settings-card">
                <p className="eyebrow">INDISPONIBILIDADE</p><h3>Criar bloqueio</h3>
                <form className="settings-form" onSubmit={createBlock}>
                  <label>Data<input type="date" value={blockDate} onChange={(event) => setBlockDate(event.target.value)} min={businessDateToday()} required /></label>
                  <label>Aplicar a<select value={blockScope} onChange={(event) => { const next = event.target.value as 'business' | 'professional'; setBlockScope(next); if (next === 'professional') setBlockAllDay(false) }}><option value="professional">Um profissional</option><option value="business">Toda a barbearia</option></select></label>
                  {blockScope === 'professional' && <label>Profissional<select value={blockProfessional} onChange={(event) => setBlockProfessional(event.target.value)} required>{activeProfessionals.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
                  {blockScope === 'business' && <label className="settings-check"><input type="checkbox" checked={blockAllDay} onChange={(event) => setBlockAllDay(event.target.checked)} /> Bloquear o dia inteiro</label>}
                  {!(blockScope === 'business' && blockAllDay) && <div className="settings-form-row"><label>Início<input type="time" step="1800" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required /></label><label>Fim<input type="time" step="1800" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} required /></label></div>}
                  <label>Motivo (opcional)<input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} maxLength={160} placeholder="Ex.: compromisso, manutenção..." /></label>
                  <button className="primary-button full-width" disabled={busy === 'block-create' || (blockScope === 'professional' && !activeProfessionals.length)}>{busy === 'block-create' ? 'Salvando...' : 'Criar bloqueio'}</button>
                </form>
                <p className="form-hint">Bloqueios que conflitam com atendimentos confirmados são recusados.</p>
              </article>
              <article className="admin-settings-card">
                <div className="blocks-date-heading"><div><p className="eyebrow">AGENDA</p><h3>Bloqueios do dia</h3><small>{formatDate(blockDate)}</small></div><label>Consultar data<input type="date" value={blockDate} min={businessDateToday()} onChange={(event) => setBlockDate(event.target.value)} /></label></div>
                {blocks.length === 0 ? <div className="admin-empty-state"><strong>Nenhum bloqueio</strong><p>Não há indisponibilidades registradas para esta data.</p></div> : (
                  <div className="settings-list">
                    {blocks.map((block) => (
                      <div className="settings-item block-list-item" key={block.id}>
                        <div className="settings-item-main"><strong>{block.startTime && block.endTime ? `${block.startTime} — ${block.endTime}` : 'Dia inteiro'}</strong><small>{block.scope === 'business' ? 'Toda a barbearia' : block.professionalName || 'Profissional'}{block.reason ? ` · ${block.reason}` : ''}</small></div>
                        <button className="admin-danger-button" type="button" onClick={() => void deleteBlock(block)} disabled={busy === `block-delete:${block.id}`}>{busy === `block-delete:${block.id}` ? 'Removendo...' : 'Remover'}</button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          )}
        </>
      )}
    </section>
  )
}
