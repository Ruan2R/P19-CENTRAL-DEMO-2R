import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Copy, Instagram, MapPin, ShieldCheck, Sparkles, UserRound, MessageCircle, Heart, WalletCards } from 'lucide-react'
import { createPublicBooking, getAvailableSlots, getHealth, getPublicPolicies, getPublicServices, getPublicPromotions, reportPublicDepositPayment, type CreatedBooking, type StorageMode } from '../lib/api'
import type { BusinessPolicy, PublicPromotionPrice, Service } from '../types'
import { formatBrazilPhoneInput } from '../lib/phone.mjs'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { BookingTimeWheelPicker } from '../components/BookingTimeWheelPicker'

const P19_DEMO_MODE = true
const WHATSAPP_NUMBER = ''
const PUBLIC_SITE = '/agendar'
const DEFAULT_POLICIES: BusinessPolicy = { singleton: true, lateness_tolerance_minutes: 0, cancellation_notice_hours: 0, companion_policy: 'Política de acompanhantes pendente de confirmação pela Ana.', no_show_policy: 'Política de faltas e cancelamentos pendente de confirmação pela Ana.', show_lateness_policy: false, show_cancellation_policy: false, show_companion_policy: false, show_no_show_policy: false }

function localDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Campo_Grande' }).format(new Date(`${date}T12:00:00Z`))
}

function formatDateControl(value: string) {
  if (!value) return 'Selecione uma data'
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function getBookingError(error: string) {
  if (error.includes('SLOT_TAKEN')) return 'Esse horário acabou de ser reservado. Escolha outro horário.'
  return error || 'Não foi possível concluir o agendamento. Tente novamente.'
}

export function BookingPage() {
  const today = useMemo(() => localDateString(new Date()), [])
  const [services, setServices] = useState<Service[]>([])
  const [promotionPrices, setPromotionPrices] = useState<PublicPromotionPrice[]>([])
  const [promotionDateLoaded, setPromotionDateLoaded] = useState('')
  const [promotionError, setPromotionError] = useState('')
  const [policies, setPolicies] = useState<BusinessPolicy>(DEFAULT_POLICIES)
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(addDays(today, 1))
  const [slots, setSlots] = useState<string[]>([])
  const [time, setTime] = useState('')
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null)
  const [paymentReported, setPaymentReported] = useState(false)
  const [reportingPayment, setReportingPayment] = useState(false)
  const [paymentReportError, setPaymentReportError] = useState('')
  const [pixCopied, setPixCopied] = useState(false)
  const [storageMode, setStorageMode] = useState<StorageMode>('local-json')
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? ''
  const pixKey = import.meta.env.VITE_PIX_KEY?.trim() ?? ''
  const pixHolder = import.meta.env.VITE_PIX_HOLDER?.trim() ?? ''
  const pixQrImageUrl = import.meta.env.VITE_PIX_QR_IMAGE_URL?.trim() ?? ''

  const selectedServices = services.filter((service) => serviceIds.includes(service.id))
  const visiblePolicyItems: Array<{ key: string; title: string; text: string }> = []
  if (policies.show_lateness_policy) visiblePolicyItems.push({ key: 'lateness', title: 'Atrasos', text: `Tolerância de até ${policies.lateness_tolerance_minutes} minutos.` })
  if (policies.show_cancellation_policy) visiblePolicyItems.push({ key: 'cancellation', title: 'Cancelamentos e reagendamentos', text: `Avise com pelo menos ${policies.cancellation_notice_hours} ${policies.cancellation_notice_hours === 1 ? 'hora' : 'horas'} de antecedência.` })
  if (policies.show_companion_policy) visiblePolicyItems.push({ key: 'companions', title: 'Acompanhantes e crianças', text: policies.companion_policy })
  if (policies.show_no_show_policy) visiblePolicyItems.push({ key: 'no-show', title: 'Faltas e cancelamentos', text: policies.no_show_policy })
  // Nunca exibir orientações sobre sinal fora da tela exclusiva de pagamento.
  // Mantemos a orientação e o aceite quando houver texto configurado, mas substituímos
  // seu conteúdo por uma mensagem neutra se mencionar sinal ou depósito.
  const publicPolicyItems = visiblePolicyItems.map((item) => {
    const mentionsDeposit = /\b(?:sinais?|dep[oó]sitos?)\b/i.test(`${item.title} ${item.text}`)
    return mentionsDeposit
      ? { ...item, title: item.key === 'no-show' ? 'Faltas e cancelamentos' : item.title, text: 'Em caso de dúvidas sobre esta orientação, confirme os detalhes com Ana pelo WhatsApp.' }
      : item
  })
  const hasPublicGuidelines = publicPolicyItems.length > 0
  const selectedPromotionById = new Map((promotionDateLoaded === date ? promotionPrices : []).map((promotion) => [promotion.service_id, promotion]))
  const selectedPromotions = selectedServices.map((service) => selectedPromotionById.get(service.id)).filter((promotion): promotion is PublicPromotionPrice => Boolean(promotion))
  const selectedTotalDuration = selectedServices.reduce((sum, service) => sum + service.duration_minutes, 0)
  const selectedRegularTotal = selectedServices.reduce((sum, service) => sum + service.price_cents, 0)
  const selectedTotal = selectedServices.reduce((sum, service) => sum + (selectedPromotionById.get(service.id)?.promotional_price_cents ?? service.price_cents), 0)
  const hasSelectedPromotion = selectedPromotions.length > 0
  const maximumDate = addDays(today, 60)
  const groupedServices = useMemo(() => {
    const groups = new Map<string, Service[]>()
    for (const service of services.filter((item) => item.active)) {
      const items = groups.get(service.category) ?? []
      items.push(service)
      groups.set(service.category, items)
    }
    return [...groups.entries()]
  }, [services])

  useEffect(() => {
    let isMounted = true
    Promise.all([getPublicPolicies(), getPublicServices(), getHealth()])
      .then(([nextPolicies, nextServices, health]) => {
        if (!isMounted) return
        setPolicies(nextPolicies)
        setServices(nextServices)
        setStorageMode(health.storageMode)
        setServiceIds((current) => current.filter((id) => nextServices.some((service) => service.id === id)))
      })
      .catch(() => {
        if (isMounted) setServiceError('Não foi possível conectar à agenda. Confira se o Sistema Ana está iniciado e tente novamente.')
      })
      .finally(() => { if (isMounted) setLoadingServices(false) })
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isMounted = true
    setPromotionDateLoaded('')
    setPromotionError('')
    getPublicPromotions(date)
      .then((promotions) => { if (isMounted) setPromotionPrices(promotions) })
      .catch(() => {
        if (!isMounted) return
        setPromotionPrices([])
        setPromotionError('Não foi possível conferir as promoções desta data. Atualize a página antes de reservar para confirmar o valor correto.')
      })
      .finally(() => { if (isMounted) setPromotionDateLoaded(date) })
    return () => { isMounted = false }
  }, [date])

  useEffect(() => {
    if (!serviceIds.length) {
      setSlots([])
      setTime('')
      return
    }
    let isMounted = true
    setTime('')
    setSlotError('')
    setLoadingSlots(true)
    getAvailableSlots(serviceIds, date)
      .then((nextSlots) => { if (isMounted) setSlots(nextSlots.map(formatTime)) })
      .catch(() => {
        if (!isMounted) return
        setSlots([])
        setSlotError('Não foi possível consultar a agenda. Tente novamente.')
      })
      .finally(() => { if (isMounted) setLoadingSlots(false) })
    return () => { isMounted = false }
  }, [serviceIds.join('|'), date])

  const resetCaptcha = useCallback(() => setCaptchaToken(''), [])

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!selectedServices.length || !time) {
      setFormError('Escolha um procedimento, a data e um horário disponível.')
      return
    }
    if (hasPublicGuidelines && !policyAcknowledged) {
      setFormError('Leia e aceite as orientações exibidas antes de continuar.')
      return
    }
    if (turnstileSiteKey && !captchaToken) {
      setFormError('Conclua a verificação de segurança antes de continuar.')
      return
    }

    setSubmitting(true)
    try {
      const booking = await createPublicBooking({
        serviceId: selectedServices[0].id,
        serviceIds: selectedServices.map((service) => service.id),
        date,
        time,
        customerName: name,
        customerPhone: phone,
        customerNote: note,
        captchaToken,
        policyAcknowledged,
      })
      setCreatedBooking(booking)
      setPaymentReported(false)
      setReportingPayment(false)
      setPaymentReportError('')
      setPixCopied(false)
      setTime('')
    } catch (error) {
      setFormError(getBookingError(error instanceof Error ? error.message : ''))
      resetCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReportPayment() {
    if (!createdBooking || !createdBooking.deposit_required || reportingPayment) return
    setReportingPayment(true)
    setPaymentReportError('')
    try {
      await reportPublicDepositPayment(createdBooking.public_code, phone)
      setPaymentReported(true)
    } catch (error) {
      setPaymentReportError(error instanceof Error ? error.message : 'Não foi possível registrar o aviso de pagamento. Tente novamente.')
    } finally {
      setReportingPayment(false)
    }
  }

  async function handleCopyPixKey() {
    if (!pixKey) return
    setPaymentReportError('')
    try {
      await navigator.clipboard.writeText(pixKey)
      setPixCopied(true)
    } catch {
      setPaymentReportError('Não foi possível copiar automaticamente. Selecione a chave Pix e copie manualmente.')
    }
  }

  if (createdBooking) {
    const needsPayment = createdBooking.deposit_required && !paymentReported
    const localPixTest = storageMode === 'local-json'
    const canReportPayment = Boolean(pixKey) || localPixTest
    const confirmationCopy = paymentReported
      ? 'Recebemos seu aviso de pagamento. Ana vai conferir o recebimento e falar com você pelo WhatsApp para confirmar o horário.'
      : 'Sua solicitação chegou até nós. Ana entrará em contato pelo WhatsApp para confirmar os detalhes do seu horário.'

    return (
      <main className="success-page">
        <div className={`success-card success-card--simple ${needsPayment ? 'success-card--requires-deposit' : 'success-card--awaiting-confirmation'}`}>
          <div className={`success-mark ${needsPayment ? 'success-mark--warning' : 'success-mark--pending'}`}>
            {needsPayment ? <WalletCards size={36} strokeWidth={1.7} /> : <CheckCircle2 size={38} strokeWidth={1.7} />}
          </div>
          <p className="eyebrow">{needsPayment ? 'PAGAMENTO DO SINAL' : 'SOLICITAÇÃO RECEBIDA'}</p>
          <h1>{needsPayment ? <>Quase <em>lá!</em></> : <>Solicitação <em>recebida!</em></>}</h1>
          <p className="success-copy">
            {needsPayment ? 'Para concluir seu agendamento, informe o pagamento do sinal abaixo.' : confirmationCopy}
          </p>

          {needsPayment && (
            <section className="pix-payment-card" aria-labelledby="pix-payment-title">
              <div className="pix-payment-heading">
                <span className="confirmation-action-label">VALOR DO SINAL</span>
                <strong id="pix-payment-title" className="confirmation-action-amount">{formatPrice(createdBooking.deposit_cents)}</strong>
              </div>

              {pixKey ? (
                <div className="pix-key-panel">
                  <span className="pix-key-label">Pagamento via Pix</span>
                  {pixHolder && <span className="pix-holder">Recebedor: {pixHolder}</span>}
                  <code className="pix-key-value">{pixKey}</code>
                  <button className="button button-outline button-full" type="button" onClick={() => void handleCopyPixKey()}>
                    <Copy size={16} /> {pixCopied ? 'Chave Pix copiada' : 'Copiar chave Pix'}
                  </button>
                  {pixQrImageUrl && <img className="pix-qr-image" src={pixQrImageUrl} alt="QR Code Pix do estúdio" />}
                </div>
              ) : (
                <div className="pix-not-configured" role="status">
                  <WalletCards size={20} />
                  <div>
                    <strong>Pix</strong>
                    <p>{localPixTest ? 'A chave Pix ainda não foi configurada. Neste ambiente local, você pode testar o fluxo sem realizar pagamento real.' : 'O pagamento Pix ainda não foi configurado. Entre em contato com o estúdio antes de continuar.'}</p>
                  </div>
                </div>
              )}

              {paymentReportError && <p className="payment-report-error" role="alert">{paymentReportError}</p>}
              <button className="button button-primary button-full pix-report-button" type="button" onClick={() => void handleReportPayment()} disabled={reportingPayment || !canReportPayment}>
                <Check size={17} /> {reportingPayment ? 'Registrando...' : 'Já fiz o Pix'}
              </button>
            </section>
          )}

          {!needsPayment && paymentReportError && <p className="payment-report-error" role="alert">{paymentReportError}</p>}

          <div className="confirmation-details confirmation-details--compact">
            <div><span>Código do agendamento</span><strong>{createdBooking.public_code}</strong></div>
            <div><span>Procedimento</span><strong>{selectedServices[0]?.name ?? 'Procedimento'}</strong></div>
            <div><span>Duração total</span><strong>{selectedTotalDuration} min</strong></div>
            <div><span>Data e horário</span><strong>{formatLongDate(date)} · {formatTime(new Date(createdBooking.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' }))}</strong></div>
            {createdBooking.promotion_name ? <>
              <div><span>Promoção aplicada</span><strong>{createdBooking.promotion_name}</strong></div>
              <div><span>Valor promocional</span><strong>{formatPrice(createdBooking.price_cents)}</strong></div>
              <div><span>Preço normal</span><strong><s>{formatPrice(createdBooking.regular_price_cents)}</s></strong></div>
            </> : <div><span>Valor do procedimento</span><strong>{formatPrice(createdBooking.price_cents)}</strong></div>}
          </div>
          <a className="button button-quiet button-full" href={PUBLIC_SITE}>Voltar ao agendamento</a>
        </div>
        {!P19_DEMO_MODE && (<a className="floating-whatsapp" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp do estúdio" title="WhatsApp do estúdio">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.52 3.48A11.82 11.82 0 0 0 12.1.2C5.57.2.27 5.5.27 12.03c0 2.08.54 4.1 1.56 5.88L.2 23.8l6.03-1.58a11.8 11.8 0 0 0 5.87 1.55h.01c6.52 0 11.82-5.3 11.82-11.82 0-3.16-1.23-6.13-3.41-8.47ZM12.11 21.7h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.58.94.96-3.49-.23-.36a9.68 9.68 0 1 1 8.13 4.47Zm5.3-7.24c-.29-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.19.29-.73.94-.89 1.13-.16.2-.33.22-.61.08-.29-.15-1.2-.44-2.28-1.41-.84-.75-1.41-1.68-1.58-1.96-.16-.29-.02-.44.12-.59.13-.13.29-.33.43-.49.15-.16.2-.28.3-.47.1-.2.05-.36-.02-.5-.07-.15-.64-1.54-.88-2.11-.23-.55-.47-.47-.64-.48h-.54c-.19 0-.5.07-.77.36-.26.29-1 1-.1 2.42.89 1.42 1.03 1.65 1.28 1.94.15.19 1.74 2.66 4.21 3.72.59.25 1.05.4 1.4.51.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.66-1.17.2-.57.2-1.07.14-1.17-.06-.1-.25-.16-.53-.3Z"></path></svg>
        </a>)}
      </main>
    )
  }

  return (
    <div className="booking-site">
      {storageMode === 'local-json' && <div className="demo-ribbon"><span /> Ambiente local — agendamentos ficam salvos somente neste computador</div>}
      <header className="public-header">
        <a href={PUBLIC_SITE} className="brand-lockup" aria-label="Agendar com 2R Beauty Studio">
          <img className="brand-wordmark" src="/assets/branding/logo-2r-demo.svg" alt="2R Beauty Studio" />
          <img className="brand-lash-designer" src="/assets/branding/tagline-2r-demo.svg" alt="" aria-hidden="true" />
        </a>
        <nav className="public-nav" aria-label="Links do estúdio">
          <a href="#agendar" className="nav-link">Agendamento</a>
          <a href="https://instagram.com/2r.informatica.demo" target="_blank" rel="noreferrer" aria-label="Instagram da Ana"><Instagram size={17} /></a>
        </nav>
      </header>

      <main>
        <section className="booking-hero">
          <div className="hero-backdrop" aria-hidden="true" />
          <div className="booking-hero-copy">
            <p className="eyebrow"><Sparkles size={14} /> DESIGN DO OLHAR COM DELICADEZA E PRECISÃO</p>
            <h1>Um olhar que revela<br /><em>a sua essência.</em></h1>
            <p className="booking-intro">Escolha seu procedimento e encontre um horário para cuidar do seu olhar com calma e atenção aos detalhes.</p>
            <div className="hero-trust-row"><span><Check size={15} /> Cuidado em cada detalhe</span><span><Check size={15} /> Ambiente demonstrativo</span></div>
          </div>
          <div className="booking-panel-wrap" id="agendar">
            <div className="booking-panel-heading">
              <span className="panel-step-label">AGENDE ONLINE</span>
              <h2>Agende seu momento de beleza.</h2>
              <p>Veja os procedimentos disponíveis e escolha um horário que combine com sua rotina.</p>
            </div>
            <form className="booking-form" onSubmit={handleBooking}>
              <div className="form-section-title"><span className="step-number">1</span><div><strong>Escolha os procedimentos</strong><small>{groupedServices.length ? 'Selecione uma ou mais opções para seu atendimento' : 'A agenda está sendo preparada para você'}</small></div></div>
              {loadingServices ? <div className="loading-line">Carregando serviços...</div> : serviceError ? <div className="inline-error">{serviceError}</div> : (
                <div className="service-picker multi-service-picker">
                  {groupedServices.length > 0 ? <>
                    <p className="field-label">Procedimento</p>
                    <p className="multi-service-hint">Selecione um ou mais procedimentos. A duração e o valor serão somados automaticamente.</p>
                    {groupedServices.map(([category, items]) => <fieldset className="multi-service-group" key={category}><legend>{category}</legend>{items.map((service) => {
                    const promotion = selectedPromotionById.get(service.id)
                    const checked = serviceIds.includes(service.id)
                    return <label className={`multi-service-option ${checked ? 'is-selected' : ''}`} key={service.id}>
                      <input type="checkbox" name="booking-service" checked={checked} onChange={() => { setServiceIds((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id]); setCreatedBooking(null); setTime('') }} />
                      <span className="multi-service-option-main"><strong>{service.name}</strong><small>{service.duration_minutes} min{promotion ? ' · promoção' : ''}</small></span>
                      <span className="multi-service-option-price">{formatPrice(promotion?.promotional_price_cents ?? service.price_cents)}{promotion && <s>{formatPrice(service.price_cents)}</s>}</span>
                    </label>
                  })}</fieldset>)}
                    {selectedServices.length > 0 && <div className="selected-service-meta multi-service-total"><span><Clock3 size={14} /> Total: {selectedTotalDuration} min</span><div className="selected-service-price"><strong>{formatPrice(selectedTotal)}</strong>{hasSelectedPromotion && <s>{formatPrice(selectedRegularTotal)}</s>}</div></div>}
                  </> : <p className="multi-service-hint" role="status">Os procedimentos serão adicionados em breve. Volte para conferir as opções de atendimento.</p>}
                </div>
              )}

              <div className="form-section-title"><span className="step-number">2</span><div><strong>Escolha a data e o horário</strong><small>Veja os horários livres na agenda</small></div></div>
              <label className="field-label" htmlFor="booking-date">Data do atendimento</label>
              <div className="date-input-wrap"><CalendarDays size={17} aria-hidden="true" /><span className="date-input-value" aria-hidden="true">{formatDateControl(date)}</span><input id="booking-date" type="date" value={date} min={today} max={maximumDate} onChange={(event) => { setDate(event.target.value); setTime(''); setCreatedBooking(null) }} required /></div>
              {date && <p className="date-readable">{formatLongDate(date)}</p>}
              <div className="slots-heading"><span>Horários disponíveis</span>{loadingSlots && <span className="loading-dot">Atualizando...</span>}</div>
              {loadingSlots ? <div className="slot-skeleton"><i /><i /><i /><i /></div> : slotError ? <div className="inline-error">{slotError}</div> : slots.length ? (
                <BookingTimeWheelPicker id="public-booking-time" slots={slots} value={time} onChange={setTime} disabled={submitting} />
              )
              : !serviceIds.length ? <div className="empty-slots" role="status"><CalendarDays size={19} /><span>{groupedServices.length ? 'Selecione primeiro um procedimento para consultar os horários disponíveis.' : 'Os horários serão exibidos assim que os procedimentos forem cadastrados.'}</span></div>
              : <div className="empty-slots"><CalendarDays size={19} /><span>Não há horários disponíveis nessa data. Escolha outro dia.</span></div>}

              <div className="form-section-title customer-section-title"><span className="step-number">3</span><div><strong>Seus dados</strong><small>Para confirmar a solicitação</small></div></div>
              <div className="field-group"><label className="field-label" htmlFor="customer-name">Nome completo</label><div className="input-with-icon"><UserRound size={17} /><input id="customer-name" autoComplete="name" placeholder="Como você se chama?" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></div></div>
              <div className="field-group"><label className="field-label" htmlFor="customer-phone">WhatsApp com DDD</label><div className="input-with-icon"><MessageCircle size={17} /><input id="customer-phone" type="tel" autoComplete="tel" placeholder="(67) 99999-9999" value={phone} onChange={(event) => setPhone(formatBrazilPhoneInput(event.target.value))} maxLength={16} required /></div></div>
              <div className="field-group"><label className="field-label" htmlFor="customer-note">Observações <span className="optional">Opcional</span></label><textarea id="customer-note" rows={2} maxLength={500} placeholder="Alguma informação que devo saber?" value={note} onChange={(event) => setNote(event.target.value)} /></div>

              {hasPublicGuidelines && <section className="booking-policy-card" aria-labelledby="booking-policy-title">
                <div className="policy-card-heading"><ShieldCheck size={18} /><h3 id="booking-policy-title">Orientações importantes</h3></div>
                {publicPolicyItems.map((item) => <p key={item.key}><strong>{item.title}:</strong> {item.text}</p>)}
                <label className="policy-acknowledgement"><input type="checkbox" checked={policyAcknowledged} onChange={(event) => setPolicyAcknowledged(event.target.checked)} required /><span>Li e concordo com as orientações informadas acima.</span></label>
              </section>}

              {selectedServices.length > 0 && <div className={`booking-summary multi-service-summary ${hasSelectedPromotion ? 'booking-summary-has-promotion' : ''}`}>
                {selectedServices.map((service) => { const promotion = selectedPromotionById.get(service.id); return <div className="multi-service-summary-row" key={service.id}><span>{service.name}{promotion ? ` · ${promotion.promotion_name}` : ''}</span><strong>{formatPrice(promotion?.promotional_price_cents ?? service.price_cents)}</strong></div> })}
                <div><span>Duração total</span><strong>{selectedTotalDuration} min</strong></div>
                {hasSelectedPromotion && <div className="booking-summary-regular"><span>Preço normal somado</span><s>{formatPrice(selectedRegularTotal)}</s></div>}
                <div className="multi-service-grand-total"><span>Total estimado</span><strong>{formatPrice(selectedTotal)}</strong></div>
              </div>}
              {promotionError && <div className="inline-error" role="alert">{promotionError}</div>}
              {turnstileSiteKey && <div className="captcha-area"><TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} /></div>}
              {storageMode === 'local-json' && <div className="demo-notice"><ShieldCheck size={17} /><span>Ambiente de desenvolvimento: os dados ficam em um arquivo local e ainda não estão publicados na internet.</span></div>}
              {formError && <div className="inline-error" role="alert">{formError}</div>}
              <button className="button button-primary button-full submit-booking" type="submit" disabled={submitting || loadingServices || loadingSlots || promotionDateLoaded !== date || Boolean(promotionError) || !serviceIds.length || !time || (Boolean(turnstileSiteKey) && !captchaToken)}>
                {submitting ? 'Reservando horário...' : 'Reservar horário'} <ArrowRight size={17} />
              </button>
              <p className="privacy-note"><ShieldCheck size={14} /> Seus dados serão usados apenas para organizar seu atendimento.</p>
            </form>
          </div>
        </section>

        <section className="booking-extras">
          <div className="extra-card"><span className="extra-icon"><Heart size={19} /></span><div><h3>Seu olhar em primeiro plano</h3><p>Delicadeza, técnica e atenção aos detalhes para valorizar suas características e respeitar seu estilo.</p></div></div>
          <div className="extra-card"><span className="extra-icon"><CalendarDays size={19} /></span><div><h3>Como funciona?</h3><p>O fluxo de confirmação do atendimento pode ser acompanhado no painel administrativo.</p></div></div>
          <div className="extra-card"><span className="extra-icon"><MapPin size={19} /></span><div><h3>Informações para sua visita</h3><p>Após a confirmação do horário, Ana envia as orientações de localização pelo WhatsApp.</p></div></div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="footer-brand-row">
          <a href={PUBLIC_SITE} className="footer-brand-lockup" aria-label="2R Beauty Studio — Lash Designer">
            <img className="footer-wordmark" src="/assets/branding/logo-2r-demo.svg" alt="2R Beauty Studio" />
            <img className="footer-lash-designer" src="/assets/branding/tagline-2r-demo.svg" alt="" aria-hidden="true" />
            <img className="footer-brand-divider" src="/assets/branding/tagline-2r-demo.svg" alt="" aria-hidden="true" />
            <img className="footer-brand-slogan" src="/assets/branding/tagline-2r-demo.svg" alt="Seu espaço de beleza, com gestão inteligente." />
          </a>
          <a className="footer-instagram-link" href="https://instagram.com/2r.informatica.demo" target="_blank" rel="noreferrer" aria-label="Instagram da Ana" title="Instagram da Ana"><Instagram size={17} /></a>
        </div>
        <div className="public-footer-links"><Link to="/admin" className="nav-admin nav-admin--subtle">Acesso administrativo</Link></div>
      </footer>
      {!P19_DEMO_MODE && (<a className="floating-whatsapp" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" aria-label="Falar com o estúdio pelo WhatsApp" title="Falar com o estúdio pelo WhatsApp">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.52 3.48A11.82 11.82 0 0 0 12.1.2C5.57.2.27 5.5.27 12.03c0 2.08.54 4.1 1.56 5.88L.2 23.8l6.03-1.58a11.8 11.8 0 0 0 5.87 1.55h.01c6.52 0 11.82-5.3 11.82-11.82 0-3.16-1.23-6.13-3.41-8.47ZM12.11 21.7h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.58.94.96-3.49-.23-.36a9.68 9.68 0 1 1 8.13 4.47Zm5.3-7.24c-.29-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.19.29-.73.94-.89 1.13-.16.2-.33.22-.61.08-.29-.15-1.2-.44-2.28-1.41-.84-.75-1.41-1.68-1.58-1.96-.16-.29-.02-.44.12-.59.13-.13.29-.33.43-.49.15-.16.2-.28.3-.47.1-.2.05-.36-.02-.5-.07-.15-.64-1.54-.88-2.11-.23-.55-.47-.47-.64-.48h-.54c-.19 0-.5.07-.77.36-.26.29-1 1-.1 2.42.89 1.42 1.03 1.65 1.28 1.94.15.19 1.74 2.66 4.21 3.72.59.25 1.05.4 1.4.51.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.66-1.17.2-.57.2-1.07.14-1.17-.06-.1-.25-.16-.53-.3Z"></path></svg>
      </a>)}
    </div>
  )
}

/* P17_UPDATE_V0_3_0_APPLIED */
