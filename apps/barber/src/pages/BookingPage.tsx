import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiGet, apiPost } from '../lib/api'

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; active: boolean }
type Promotion = { id: string; name: string; kind: 'service' | 'combo'; startsOn: string; endsOn: string; active: boolean; serviceIds: string[]; services: Array<{ id: string; name: string; priceCents: number; active: boolean }>; promoPriceCents: number }
type PromotionPrice = { prices: Record<string, number>; names: Record<string, string>; applied: Promotion[]; baseTotal: number; total: number; discount: number }
type Professional = { id: string; name: string; role: string; active: boolean }
type Slot = { time: string; professionalId: string; professionalName: string }
type SelectedService = {
  key: string
  service: Service
  professionalId: string
  time: string | null
  assignedProfessionalId: string | null
  assignedProfessionalName: string | null
}
type ServiceListResponse = { services: Service[]; source: string }
type ProfessionalListResponse = { professionals: Professional[]; source: string }
type PromotionListResponse = { promotions: Promotion[] }
type AvailabilityResponse = { date: string; slots: Slot[] }
type BookingResponse = {
  id: string
  publicCode: string
  date: string
  status: string
  customer: { name: string; whatsapp: string }
  items: Array<{ id: string; serviceId: string; serviceName: string; professionalId: string; professionalName: string; time: string; durationMinutes: number; priceCents: number; promotionName?: string | null }>
  totalPriceCents: number
  createdAt: string
}

const ANY_PROFESSIONAL_ID = 'sem-preferencia'
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function datePlusDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return shortDate.format(new Date(`${value}T12:00:00`)).replace(/^./, (letter) => letter.toUpperCase())
}

function formatOfferDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`)).replace('.', '')
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function overlaps(timeA: string, durationA: number, timeB: string, durationB: number) {
  const startA = timeToMinutes(timeA)
  const startB = timeToMinutes(timeB)
  return startA < startB + durationB && startA + durationA > startB
}

function formatPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2)
  digits = digits.slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function StepHeading({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) {
  return (
    <div className="section-heading">
      <span className="step-index">{number}</span>
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
    </div>
  )
}

function promotionalPricing(services: Service[], promotions: Promotion[], date: string): PromotionPrice {
  const selected = services.map((service) => ({ ...service, id: String(service.id), priceCents: Number(service.priceCents) }))
  const selectedById = new Map(selected.map((service) => [service.id, service]))
  const prices: Record<string, number> = Object.fromEntries(selected.map((service) => [service.id, service.priceCents]))
  const names: Record<string, string> = {}
  const applied: Promotion[] = []
  const active = promotions.filter((promotion) => promotion.active && promotion.startsOn <= date && promotion.endsOn >= date)
  for (const promotion of active) {
    const ids = promotion.serviceIds.map(String)
    if (!ids.length || ids.some((id) => !selectedById.has(id))) continue
    const regular = ids.reduce((sum, id) => sum + (selectedById.get(id)?.priceCents ?? 0), 0)
    if (promotion.promoPriceCents <= 0 || promotion.promoPriceCents >= regular) continue
    if (promotion.kind === 'service' && ids.length === 1) {
      prices[ids[0]] = promotion.promoPriceCents
      names[ids[0]] = promotion.name
    } else if (promotion.kind === 'combo' && ids.length >= 2) {
      const allocated = ids.map((id) => Math.floor(promotion.promoPriceCents * (selectedById.get(id)?.priceCents ?? 0) / regular))
      let remaining = promotion.promoPriceCents - allocated.reduce((sum, cents) => sum + cents, 0)
      const shares = ids.map((id, index) => ({ index, remainder: (promotion.promoPriceCents * (selectedById.get(id)?.priceCents ?? 0)) % regular })).sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      for (let index = 0; remaining > 0; index += 1, remaining -= 1) allocated[shares[index % shares.length].index] += 1
      ids.forEach((id, index) => { prices[id] = allocated[index]; names[id] = promotion.name })
    } else continue
    applied.push(promotion)
  }
  const baseTotal = selected.reduce((sum, service) => sum + service.priceCents, 0)
  const total = selected.reduce((sum, service) => sum + Number(prices[service.id] ?? service.priceCents), 0)
  return { prices, names, applied, baseTotal, total, discount: Math.max(0, baseTotal - total) }
}

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [selectedItems, setSelectedItems] = useState<SelectedService[]>([])
  const [promotionNotice, setPromotionNotice] = useState('')
  const [offersExpanded, setOffersExpanded] = useState(false)
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')
  const [date, setDate] = useState(dateKey())
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerWhatsapp, setCustomerWhatsapp] = useState('')
  const [booking, setBooking] = useState<BookingResponse | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      apiGet<ServiceListResponse>('/api/public/services'),
      apiGet<ProfessionalListResponse>('/api/public/professionals'),
      apiGet<PromotionListResponse>('/api/public/promotions'),
    ]).then(([serviceData, professionalData, promotionData]) => {
      if (!active) return
      setServices(serviceData.services)
      setProfessionals(professionalData.professionals)
      setPromotions(promotionData.promotions ?? [])
      setSource(serviceData.source)
    }).catch((reason: unknown) => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados do agendamento.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const availabilityKey = selectedItems.map((item) => `${item.key}:${item.service.id}:${item.professionalId}`).join('|')

  useEffect(() => {
    if (step >= 6 || !date || !selectedItems.length) return
    let active = true
    setAvailabilityLoading(true)
    setAvailabilityError('')
    setAvailability({})

    Promise.all(selectedItems.map(async (item) => {
      const query = new URLSearchParams({ date, serviceId: item.service.id, professionalId: item.professionalId })
      const result = await apiGet<AvailabilityResponse>(`/api/public/availability?${query.toString()}`)
      return [item.key, result.slots] as const
    })).then((entries) => {
      if (!active) return
      setAvailability(Object.fromEntries(entries))
    }).catch((reason: unknown) => {
      if (!active) return
      setAvailabilityError(reason instanceof Error ? reason.message : 'Não foi possível consultar os horários.')
    }).finally(() => { if (active) setAvailabilityLoading(false) })

    return () => { active = false }
  // availabilityKey represents only service/professional choices; picking a time must not refetch the slots.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, date, availabilityKey])

  const pricing = promotionalPricing(selectedItems.map((item) => item.service), promotions, date)
  const selectedTotal = pricing.total
  const selectedPrice = (serviceId: string) => Number(pricing.prices[serviceId] ?? selectedItems.find((item) => item.service.id === serviceId)?.service.priceCents ?? 0)
  const selectedDuration = selectedItems.reduce((total, item) => total + item.service.durationMinutes, 0)
  const allTimesSelected = selectedItems.length > 0 && selectedItems.every((item) => Boolean(item.time))
  const campaignToday = dateKey()
  const campaignHorizon = datePlusDays(campaignToday, 60)
  const spotlightPromotions = promotions
    .filter((promotion) => {
      if (!promotion.active || promotion.endsOn < campaignToday || promotion.startsOn > campaignHorizon) return false

      const ids = [...new Set(promotion.serviceIds.map(String))]
      if (promotion.kind === 'service' && ids.length !== 1) return false
      if (promotion.kind === 'combo' && (ids.length < 2 || ids.length > 6)) return false
      if (!ids.length) return false

      // Only surface offers that can actually be booked with currently active public services.
      const activeServices = ids.map((id) => services.find((service) => service.id === id && service.active))
      if (activeServices.some((service) => !service)) return false
      const regularTotal = activeServices.reduce((sum, service) => sum + (service?.priceCents ?? 0), 0)
      const promotionalPrice = Number(promotion.promoPriceCents)
      if (!Number.isFinite(promotionalPrice) || promotionalPrice <= 0 || promotionalPrice >= regularTotal) return false
      if (promotion.services.length !== ids.length || !promotion.services.every((service) => service.active)) return false
      return true
    })
    .sort((a, b) => {
      const aUpcoming = a.startsOn > campaignToday ? 1 : 0
      const bUpcoming = b.startsOn > campaignToday ? 1 : 0
      return aUpcoming - bUpcoming || a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name, 'pt-BR')
    })
  const selectedPromotion = spotlightPromotions.find((promotion) => promotion.id === selectedPromotionId) ?? null
  const selectedPromotionMinDate = selectedPromotion && selectedPromotion.startsOn > campaignToday ? selectedPromotion.startsOn : campaignToday
  const selectedPromotionMaxDate = selectedPromotion && selectedPromotion.endsOn < campaignHorizon ? selectedPromotion.endsOn : campaignHorizon

  function addPromotionToSelection(promotion: Promotion) {
    const offerServices = promotion.serviceIds
      .map((id) => services.find((service) => service.id === String(id)))
      .filter((service): service is Service => Boolean(service))
    if (!offerServices.length) return

    const today = campaignToday
    const horizon = campaignHorizon
    const minimum = promotion.startsOn > today ? promotion.startsOn : today
    const maximum = promotion.endsOn < horizon ? promotion.endsOn : horizon
    const nextDate = date < minimum || date > maximum ? minimum : date
    const dateChanged = nextDate !== date
    const selectedIds = new Set(selectedItems.map((item) => item.service.id))
    const missingServices = offerServices.filter((service) => !selectedIds.has(service.id))

    setSelectedPromotionId(promotion.id)
    setOffersExpanded(false)
    setDate(nextDate)
    setSelectedItems((current) => {
      const currentIds = new Set(current.map((item) => item.service.id))
      const retained = current.map((item) => dateChanged
        ? { ...item, time: null, assignedProfessionalId: null, assignedProfessionalName: null }
        : item)
      const additions = offerServices
        .filter((service) => !currentIds.has(service.id))
        .map((service) => ({
          key: service.id,
          service,
          professionalId: ANY_PROFESSIONAL_ID,
          time: null,
          assignedProfessionalId: null,
          assignedProfessionalName: null,
        }))
      return [...retained, ...additions]
    })

    const validity = minimum === maximum
      ? `Essa oferta só pode ser agendada em ${formatOfferDate(minimum)}`
      : `Essa oferta pode ser agendada entre ${formatOfferDate(minimum)} e ${formatOfferDate(maximum)}`
    const addedText = missingServices.length
      ? `${missingServices.map((service) => service.name).join(' + ')} ${missingServices.length === 1 ? 'foi adicionado' : 'foram adicionados'} ao atendimento.`
      : 'Os procedimentos dessa oferta já estão selecionados.'
    setPromotionNotice(`${promotion.name} adicionada. ${addedText} Data ajustada para ${formatOfferDate(nextDate)}. ${validity}.`)
    setError('')
    window.setTimeout(() => document.getElementById('service-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function toggleService(service: Service) {
    const removing = selectedItems.some((item) => item.service.id === service.id)
    const offerContainsService = Boolean(selectedPromotion?.serviceIds.includes(service.id))
    setPromotionNotice(removing && offerContainsService
      ? `Você removeu ${service.name}; outras datas voltaram a ficar disponíveis. O desconto da oferta selecionada pode deixar de valer.`
      : '')
    if (removing && offerContainsService) setSelectedPromotionId(null)
    setSelectedItems((current) => {
      if (current.some((item) => item.service.id === service.id)) return current.filter((item) => item.service.id !== service.id)
      return [...current, { key: service.id, service, professionalId: ANY_PROFESSIONAL_ID, time: null, assignedProfessionalId: null, assignedProfessionalName: null }]
    })
    setError('')
  }

  function changeProfessional(key: string, professionalId: string) {
    setSelectedItems((current) => current.map((item) => item.key === key
      ? { ...item, professionalId, time: null, assignedProfessionalId: null, assignedProfessionalName: null }
      : { ...item, time: null, assignedProfessionalId: null, assignedProfessionalName: null }))
    setAvailability({})
    setError('')
  }

  function availableSlotsFor(item: SelectedService) {
    const chosenByOthers = selectedItems.filter((other) => other.key !== item.key && other.time)
    return (availability[item.key] || []).filter((slot) => !chosenByOthers.some((other) =>
      overlaps(slot.time, item.service.durationMinutes, other.time as string, other.service.durationMinutes)))
  }

  function chooseTime(itemKey: string, slot: Slot) {
    setSelectedItems((current) => current.map((item) => item.key === itemKey
      ? { ...item, time: slot.time, assignedProfessionalId: slot.professionalId, assignedProfessionalName: slot.professionalName }
      : item))
    setError('')
  }

  function validateAndConfirmCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!customerName.trim() || customerName.trim().length < 2) {
      setError('Informe seu nome para continuar.')
      return
    }
    const digits = customerWhatsapp.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    if (!/^\d{10,11}$/.test(digits)) {
      setError('Confira o WhatsApp com DDD antes de continuar.')
      return
    }
    setError('')
    void confirmBooking()
  }

  async function confirmBooking() {
    if (!allTimesSelected || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await apiPost<{ booking: BookingResponse }>('/api/public/booking-groups', {
        date,
        customerName: customerName.trim(),
        customerWhatsapp,
        items: selectedItems.map((item) => ({
          serviceId: item.service.id,
          professionalId: item.professionalId,
          time: item.time,
        })),
      })
      setBooking(result.booking)
      setStep(6)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível confirmar o agendamento.'
      setError(message)
      if (reason instanceof ApiError && reason.status === 409) {
        setSelectedItems((current) => current.map((item) => ({ ...item, time: null, assignedProfessionalId: null, assignedProfessionalName: null })))
        setStep(3)
        window.setTimeout(() => document.getElementById('availability-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
      }
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="2R Barber Studio — agendamento">
          <span className="brand-mark">B67</span>
          <span><strong>2R BARBER</strong><small>BARBEARIA</small></span>
        </a>
        <span className="topbar-note">AGENDAMENTO ONLINE</span>
      </header>

      <section className="intro">
        <p className="eyebrow">2R BARBER BARBEARIA · SIDROLÂNDIA - MS</p>
        <h1>Seu próximo corte<br /><span>começa aqui.</span></h1>
        <p className="intro-copy">Escolha seus procedimentos, encontre um horário e confirme seu atendimento.</p>
      </section>

      {step < 6 && (
        <div className="booking-panel booking-flow-panel">
          {error && !allTimesSelected && <div className="message error global-message" role="alert">{error}</div>}


      {step < 6 && (
        <section id="booking-service-section" className="booking-flow-section" aria-labelledby="service-title">
          <StepHeading number="01" eyebrow="MONTE SEU ATENDIMENTO" title="Escolha os serviços" />
          <p className="step-description">Selecione um ou mais procedimentos para montar seu atendimento.</p>
          {!loading && spotlightPromotions.length > 0 && (
            <section className={`public-promotions ${offersExpanded ? 'is-expanded' : ''}`} aria-label="Ofertas promocionais">
              <button
                className="public-promotions-toggle"
                type="button"
                aria-expanded={offersExpanded}
                aria-controls="public-promotions-list"
                onClick={() => setOffersExpanded((expanded) => !expanded)}
              >
                <span className="public-promotions-symbol" aria-hidden="true">%</span>
                <span className="public-promotions-toggle-copy">
                  <strong>Temos {spotlightPromotions.length === 1 ? 'uma oferta' : `${spotlightPromotions.length} ofertas`} para você</strong>
                  <small>Veja os descontos e adicione os procedimentos com um toque.</small>
                </span>
                <span className="public-promotions-toggle-action">{offersExpanded ? 'Ocultar' : 'Ver ofertas'} <span aria-hidden="true">{offersExpanded ? '−' : '+'}</span></span>
              </button>
              <div className="public-promotions-expanded" id="public-promotions-list" hidden={!offersExpanded}>
                  <div className="public-promotions-list">
                    {spotlightPromotions.map((promotion) => {
                      const regularTotal = promotion.services.reduce((sum, service) => sum + service.priceCents, 0)
                      const discount = Math.max(0, regularTotal - promotion.promoPriceCents)
                      const servicesLabel = promotion.services.map((service) => service.name).join(' + ')
                      const validity = promotion.startsOn === promotion.endsOn
                        ? `Válida em ${formatOfferDate(promotion.startsOn)}`
                        : `De ${formatOfferDate(promotion.startsOn)} a ${formatOfferDate(promotion.endsOn)}`
                      const offerIsChosen = selectedPromotionId === promotion.id
                      const selectedCount = promotion.serviceIds.filter((id) => selectedItems.some((item) => item.service.id === String(id))).length
                      const partiallySelected = selectedCount > 0 && selectedCount < promotion.serviceIds.length
                      return (
                        <article className={`public-promotion-card ${offerIsChosen ? 'is-added' : ''}`} key={promotion.id}>
                          <div className="public-promotion-card-head">
                            <span className="public-promotion-type">{promotion.kind === 'combo' ? 'COMBO' : 'OFERTA'}</span>
                            {discount > 0 && <span className="public-promotion-savings">Economize {currency.format(discount / 100)}</span>}
                          </div>
                          <h3>{promotion.name}</h3>
                          <p className="public-promotion-services">{servicesLabel}</p>
                          <div className="public-promotion-prices">
                            <span className="public-promotion-regular-price">De <s>{currency.format(regularTotal / 100)}</s></span>
                            <strong>Por {currency.format(promotion.promoPriceCents / 100)}</strong>
                          </div>
                          <div className="public-promotion-footer">
                            <p className="public-promotion-validity">{validity}</p>
                            <button
                              className={`public-promotion-action ${offerIsChosen ? 'is-added' : ''}`}
                              type="button"
                              disabled={offerIsChosen}
                              onClick={() => addPromotionToSelection(promotion)}
                              aria-label={offerIsChosen ? `Oferta ${promotion.name} selecionada` : partiallySelected ? `Completar oferta ${promotion.name}` : `Adicionar ${promotion.name} ao atendimento`}
                            >
                              {offerIsChosen ? 'Adicionada ✓' : partiallySelected ? `Completar ${selectedCount}/${promotion.serviceIds.length}` : promotion.kind === 'combo' ? 'Adicionar combo' : 'Usar oferta'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <p className="public-promotions-footnote">Ao adicionar uma oferta, os procedimentos são selecionados automaticamente e a agenda considera as datas válidas.</p>
              </div>
            </section>
          )}
          {loading && <p className="message" role="status">Carregando serviços...</p>}
          {!loading && !services.length && !error && <p className="message">Nenhum serviço disponível no momento.</p>}
          {promotionNotice && <p className="public-promotion-notice" role="status">{promotionNotice}</p>}
          <div className="service-list" id="service-list" tabIndex={-1}>
            {services.map((service) => {
              const selected = selectedItems.some((item) => item.service.id === service.id)
              return (
                <button key={service.id} type="button" className={`service-option ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => toggleService(service)}>
                  <span className="service-copy"><strong>{service.name}</strong><small>{service.durationMinutes} minutos</small></span>
                  <span className="service-price-block">{(() => {
                    // A promotion is shown as applied only while this service is selected and the
                    // current date qualifies. Unselected catalog cards always show the regular price.
                    const appliedName = selected ? pricing.names[service.id] : undefined
                    const price = selected ? selectedPrice(service.id) : service.priceCents
                    return selected && appliedName
                      ? <><s>{currency.format(service.priceCents / 100)}</s><strong className="service-price promo">{currency.format(price / 100)}</strong><small className="service-promo-label">{appliedName}</small></>
                      : <strong className="service-price">{currency.format(service.priceCents / 100)}</strong>
                  })()}</span>
                  <span className="selection-mark" aria-hidden="true">{selected ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
          {selectedItems.length > 0 && (
            <div className="selection-summary">
              <span>{selectedItems.length} {selectedItems.length === 1 ? 'procedimento' : 'procedimentos'} · {selectedDuration} min</span>
              <span>{pricing.discount > 0 ? `Economia de ${currency.format(pricing.discount / 100)}` : `${selectedDuration} min`}</span><strong>{currency.format(selectedTotal / 100)}</strong>
            </div>
          )}
          {pricing.applied.some((promotion) => promotion.kind === 'combo') && <p className="booking-promotion-note">{pricing.applied.filter((promotion) => promotion.kind === 'combo').map((promotion) => promotion.name).join(' · ')} aplicado ao atendimento.</p>}
        </section>
      )}

      {step < 6 && selectedItems.length > 0 && (
        <section className="booking-flow-section" aria-labelledby="professional-title">
          <StepHeading number="02" eyebrow="PREFERÊNCIAS" title="Escolha os profissionais" />
          <p className="step-description">Defina quem fará cada procedimento. Se preferir, deixe o sistema encontrar alguém disponível.</p>
          <div className="procedure-settings-list">
            {selectedItems.map((item, index) => (
              <article className="procedure-setting" key={item.key}>
                <div className="procedure-setting-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="procedure-setting-copy"><strong>{item.service.name}</strong><small>{item.service.durationMinutes} min · {currency.format(selectedPrice(item.service.id) / 100)}{pricing.names[item.service.id] ? ` · ${pricing.names[item.service.id]}` : ''}</small></div>
                <label className="professional-select-label">
                  <span>Profissional</span>
                  <select value={item.professionalId} onChange={(event) => changeProfessional(item.key, event.target.value)}>
                    <option value={ANY_PROFESSIONAL_ID}>Sem preferência</option>
                    {professionals.map((professional) => <option value={professional.id} key={professional.id}>{professional.name}</option>)}
                  </select>
                </label>
              </article>
            ))}
          </div>
        </section>
      )}

      {step < 6 && selectedItems.length > 0 && (
        <section id="availability-section" className="booking-flow-section" aria-labelledby="availability-title">
          <StepHeading number="03" eyebrow="AGENDA" title="Escolha data e horários" />
          <p className="step-description">Escolha o dia primeiro; os horários livres aparecem logo abaixo. Se selecionou uma oferta, o calendário mostra somente o período em que o desconto é válido.</p>
          {selectedPromotion && (
            <div className="chosen-offer-callout" role="status">
              <div><strong>Oferta selecionada: {selectedPromotion.name}</strong><p>{selectedPromotionMinDate === selectedPromotionMaxDate ? `Esta oferta só pode ser agendada em ${formatOfferDate(selectedPromotionMinDate)}` : `Escolha uma data entre ${formatOfferDate(selectedPromotionMinDate)} e ${formatOfferDate(selectedPromotionMaxDate)}`}. O sistema já separou os procedimentos dessa oferta.</p></div>
              <button className="text-action chosen-offer-unlock" type="button" onClick={() => { setSelectedPromotionId(null); setPromotionNotice('A oferta deixou de restringir as datas. Os mesmos serviços continuam selecionados, mas o desconto depende da data escolhida.') }}>Ver outras datas <small>(pode perder o desconto)</small></button>
            </div>
          )}
          <label className="date-picker-label">Data do atendimento
            <input type="date" min={selectedPromotion ? selectedPromotionMinDate : campaignToday} max={selectedPromotion ? selectedPromotionMaxDate : campaignHorizon} value={date} onChange={(event) => {
              const nextDate = event.target.value
              if (selectedPromotion && (nextDate < selectedPromotionMinDate || nextDate > selectedPromotionMaxDate)) {
                setError(`A oferta “${selectedPromotion.name}” vale de ${formatOfferDate(selectedPromotionMinDate)} a ${formatOfferDate(selectedPromotionMaxDate)}. Escolha uma data dentro desse período ou toque em “Ver outras datas”.`)
                return
              }
              setDate(nextDate)
              setSelectedItems((current) => current.map((item) => ({ ...item, time: null, assignedProfessionalId: null, assignedProfessionalName: null })))
              setError('')
            }} />
          </label>
          <div className="date-context">{date ? formatDate(date) : 'Selecione uma data'}</div>
          {availabilityLoading && <p className="message" role="status">Consultando a disponibilidade dos profissionais...</p>}
          {availabilityError && <p className="message error" role="alert">{availabilityError}</p>}
          {!availabilityLoading && !availabilityError && (
            <div className="availability-service-list">
              {selectedItems.map((item, index) => {
                const slots = availableSlotsFor(item)
                const selectedProfessionalName = item.assignedProfessionalName || professionals.find((person) => person.id === item.professionalId)?.name || 'Sem preferência'
                return (
                  <article className="availability-card" key={item.key}>
                    <div className="availability-card-heading">
                      <span className="procedure-setting-number">{String(index + 1).padStart(2, '0')}</span>
                      <div><strong>{item.service.name}</strong><small>{item.service.durationMinutes} min · {item.professionalId === ANY_PROFESSIONAL_ID ? 'Sem preferência' : selectedProfessionalName}</small></div>
                      {item.time && <span className="chosen-time">{item.time}</span>}
                    </div>
                    {slots.length ? (
                      <div className="time-grid">
                        {slots.map((slot) => (
                          <button key={`${slot.time}:${slot.professionalId}`} type="button" className={`time-option ${item.time === slot.time ? 'selected' : ''}`} aria-pressed={item.time === slot.time} onClick={() => chooseTime(item.key, slot)}>
                            <strong>{slot.time}</strong>
                            {item.professionalId === ANY_PROFESSIONAL_ID && <small>{slot.professionalName}</small>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-slots">{(availability[item.key] || []).length ? 'Os horários restantes entram em conflito com outro procedimento deste atendimento.' : 'Não há horários disponíveis para este serviço nesta data.'}</p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
          <div className="selection-summary"><span>{selectedItems.filter((item) => item.time).length} de {selectedItems.length} horários escolhidos{pricing.discount > 0 ? ` · economia ${currency.format(pricing.discount / 100)}` : ''}</span><strong>{currency.format(selectedTotal / 100)}</strong></div>
          {allTimesSelected && <p className="booking-next-step" role="status">Horários escolhidos! Continue logo abaixo para informar seus dados e confirmar.</p>}
        </section>
      )}

      {step < 6 && allTimesSelected && (
        <section id="customer-section" className="booking-flow-section" aria-labelledby="customer-title">
          <StepHeading number="04" eyebrow="ÚLTIMA ETAPA" title="Confira e confirme seu atendimento" />
          <p className="step-description">Confira os procedimentos, horários e valores abaixo. Seus dados vêm em seguida; a reserva só é criada quando você confirmar.</p>
          <div className="review-meta"><div><span>Data</span><strong>{formatDate(date)}</strong></div><div><span>Procedimentos</span><strong>{selectedItems.length}</strong></div><div><span>WhatsApp</span><strong>{customerWhatsapp || 'Informar abaixo'}</strong></div></div>
          <div className="review-items">
            {selectedItems.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((item) => (
              <div className="review-item" key={item.key}><span className="review-time">{item.time}</span><div><strong>{item.service.name}</strong><small>{item.assignedProfessionalName || professionals.find((person) => person.id === item.professionalId)?.name || 'Profissional a definir'} · {item.service.durationMinutes} min{pricing.names[item.service.id] ? ` · ${pricing.names[item.service.id]}` : ''}</small></div><strong className="review-price">{currency.format(selectedPrice(item.service.id) / 100)}</strong></div>
            ))}
          </div>
          <div className="selection-summary total-summary"><span>Total do atendimento · {selectedDuration} min{pricing.discount > 0 ? ` · economia ${currency.format(pricing.discount / 100)}` : ''}</span><strong>{currency.format(selectedTotal / 100)}</strong></div>
          {error && <div className="message error" role="alert">{error}</div>}
          <form className="customer-form" onSubmit={validateAndConfirmCustomer}>
            <label>Seu nome
              <input autoComplete="name" name="name" maxLength={100} required placeholder="Nome e sobrenome" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>WhatsApp com DDD
              <input autoComplete="tel" inputMode="tel" name="whatsapp" type="tel" required placeholder="(67) 99999-9999" maxLength={20} value={customerWhatsapp} onChange={(event) => setCustomerWhatsapp(formatPhone(event.target.value))} />
            </label>
            <p className="form-hint">Não precisa criar uma conta. Seus dados serão usados para organizar o atendimento.</p>
            <button className="primary-button full-width booking-confirm-button" type="submit" disabled={submitting || !allTimesSelected || availabilityLoading || Boolean(availabilityError)}>{submitting ? 'Confirmando...' : 'Confirmar agendamento'} <span>{submitting ? '…' : '✓'}</span></button>
          </form>
        </section>
      )}


          {source === 'local-database' && <p className="dev-note booking-flow-dev-note">Ambiente local: seus dados e agendamentos de teste são salvos neste computador.</p>}
        </div>
      )}

      {step === 6 && booking && (
        <section className="booking-panel confirmation-panel" aria-labelledby="confirmation-title">
          <div className="confirmation-mark" aria-hidden="true">✓</div>
          <p className="eyebrow">AGENDAMENTO REGISTRADO</p>
          <h2 id="confirmation-title">Fechado, {booking.customer.name.split(/\s+/)[0]}!</h2>
          <p className="confirmation-copy">Seu horário foi reservado no sistema da 2R Barber Studio.</p>
          <div className="booking-code"><span>Código do atendimento</span><strong>{booking.publicCode}</strong></div>
          <div className="review-meta"><div><span>Data</span><strong>{formatDate(booking.date)}</strong></div><div><span>Procedimentos</span><strong>{booking.items.length}</strong></div></div>
          <div className="review-items">
            {booking.items.slice().sort((a, b) => a.time.localeCompare(b.time)).map((item) => (
              <div className="review-item" key={item.id}><span className="review-time">{item.time}</span><div><strong>{item.serviceName}</strong><small>{item.professionalName} · {item.durationMinutes} min{item.promotionName ? ` · ${item.promotionName}` : ''}</small></div><strong className="review-price">{currency.format(item.priceCents / 100)}</strong></div>
            ))}
          </div>
          <div className="selection-summary total-summary"><span>Total do atendimento</span><strong>{currency.format(booking.totalPriceCents / 100)}</strong></div>
          <p className="form-hint">Guarde o código do atendimento para referência. Para confirmar os detalhes, entre em contato com a barbearia pelo WhatsApp.</p>
          <button className="primary-button full-width" type="button" onClick={() => window.location.reload()}>Fazer novo agendamento <span>↻</span></button>
        </section>
      )}

      <footer className="footer"><span>2R Barber Studio</span><span>P15 · Núcleo de agendamento</span></footer>
    </main>
  )
}
