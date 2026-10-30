import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Copy, Eye, Heart, MapPin, MessageCircle, ShieldCheck, Sparkles, UserRound, WalletCards } from 'lucide-react';
import BookingTimeWheelPicker from './BookingTimeWheelPicker';

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return \`\${year}-\${month}-\${day}\`;
}
function money(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function readableDate(value) {
  if (!value) return 'Selecione uma data';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(\`\${value}T12:00:00\`));
}
function formatInputPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? \`(\${digits}\` : '';
  if (digits.length <= 7) return \`(\${digits.slice(0, 2)}) \${digits.slice(2)}\`;
  return \`(\${digits.slice(0, 2)}) \${digits.slice(2, 7)}-\${digits.slice(7)}\`;
}
const SERVICES = [
  { id: 'svc-01', name: 'Lash lifting', category: 'Cílios', description: 'Realce e curvatura natural dos fios.', duration: 90, price: 15000, depositPercent: 20 },
  { id: 'svc-02', name: 'Extensão de cílios', category: 'Cílios', description: 'Aplicação personalizada de acordo com o olhar.', duration: 120, price: 22000, depositPercent: 25 },
  { id: 'svc-03', name: 'Design de sobrancelhas', category: 'Sobrancelhas', description: 'Design alinhado ao formato do rosto.', duration: 40, price: 4000, depositPercent: 0 },
  { id: 'svc-04', name: 'Tintura de sobrancelhas', category: 'Sobrancelhas', description: 'Realce da cor e definição dos fios.', duration: 20, price: 2000, depositPercent: 0 },
  { id: 'svc-05', name: 'Maquiagem social', category: 'Maquiagem', description: 'Produção para ocasiões especiais.', duration: 60, price: 16000, depositPercent: 20 },
];
const PROMOTIONS = [
  { id: 'promo-01', name: 'Semana do olhar', startsOn: localDate(-3), endsOn: localDate(12), serviceId: 'svc-03', price: 3500 },
  { id: 'promo-02', name: 'Combo de cuidados', startsOn: localDate(-1), endsOn: localDate(20), serviceId: 'svc-01', price: 13500 },
];
const POLICIES = [
  { title: 'Atrasos', text: 'Tolerância de até 10 minutos.' },
  { title: 'Cancelamentos e reagendamentos', text: 'Avise com pelo menos 12 horas de antecedência.' },
  { title: 'Acompanhantes e crianças', text: 'Consulte a disponibilidade antes de vir acompanhada.' },
  { title: 'Faltas e cancelamentos', text: 'Em caso de ausência, entre em contato para alinhar uma nova data.' },
];
function buildMinuteSlots() {
  const slots = [];
  for (let hour = 8; hour <= 18; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      const label = \`\${String(hour).padStart(2, '0')}:\${String(minute).padStart(2, '0')}\`;
      if (hour === 12 || (hour === 13 && minute < 30)) continue;
      slots.push(label);
    }
  }
  return slots;
}
const TIME_SLOTS = buildMinuteSlots();

export default function BeautyBookingPreview({ notify = () => {} }) {
  const [selectedIds, setSelectedIds] = useState(['svc-03']);
  const [date, setDate] = useState(localDate(1));
  const [time, setTime] = useState('10:30');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [booking, setBooking] = useState(null);
  const [paymentReported, setPaymentReported] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [showPolicies, setShowPolicies] = useState(true);

  const activeServices = SERVICES;
  const selectedServices = useMemo(() => activeServices.filter((service) => selectedIds.includes(service.id)), [selectedIds]);
  const groupedServices = useMemo(() => {
    const groups = new Map();
    activeServices.forEach((service) => {
      const list = groups.get(service.category) || [];
      list.push(service);
      groups.set(service.category, list);
    });
    return [...groups.entries()];
  }, []);
  const promotionByService = new Map(PROMOTIONS
    .filter((promotion) => date >= promotion.startsOn && date <= promotion.endsOn)
    .map((promotion) => [promotion.serviceId, promotion]));
  const selectedDuration = selectedServices.reduce((sum, service) => sum + service.duration, 0);
  const regularTotal = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const total = selectedServices.reduce((sum, service) => sum + (promotionByService.get(service.id)?.price ?? service.price), 0);
  const hasPromotion = selectedServices.some((service) => promotionByService.has(service.id));
  const depositPercent = selectedServices.reduce((max, service) => Math.max(max, service.depositPercent), 0);
  const depositAmount = Math.round(total * depositPercent / 100);
  const timeSlots = TIME_SLOTS;

  function toggleService(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setBooking(null);
    setTime('');
  }
  function submit(event) {
    event.preventDefault();
    if (!selectedServices.length || !time || !name.trim() || phone.replace(/\D/g, '').length < 10) {
      notify('Preencha os procedimentos, horário e dados de contato para visualizar a confirmação.');
      return;
    }
    if (!policyAcknowledged) {
      notify('Marque o aceite das orientações para continuar.');
      return;
    }
    setBooking({
      code: 'ANA-2026-0042',
      date,
      time,
      name: name.trim(),
      phone,
      services: selectedServices.map((service) => ({ ...service, appliedPrice: promotionByService.get(service.id)?.price ?? service.price, promotion: promotionByService.get(service.id)?.name ?? '' })),
      total,
      regularTotal,
      duration: selectedDuration,
      depositRequired: depositPercent > 0,
      deposit: depositAmount,
    });
    setPaymentReported(false);
    setPixCopied(false);
  }

  if (booking) {
    return <div className="beauty-public-preview">
      <div className="beauty-booking-success">
        <div className="beauty-success-mark"><CheckCircle2 size={32} /></div>
        <span className="beauty-kicker">{booking.depositRequired && !paymentReported ? 'PAGAMENTO DO SINAL' : 'SOLICITAÇÃO RECEBIDA'}</span>
        <h2>{booking.depositRequired && !paymentReported ? 'Quase lá!' : 'Solicitação recebida!'}</h2>
        <p>{booking.depositRequired && !paymentReported ? 'Para concluir o exemplo de agendamento, confira o sinal demonstrativo abaixo.' : 'A solicitação foi registrada nesta demonstração. Em um ambiente real, a profissional confirma os detalhes pelo WhatsApp.'}</p>
        {booking.depositRequired && !paymentReported && <section className="beauty-pix-card">
          <div><span>VALOR DO SINAL</span><strong>{money(booking.deposit)}</strong></div>
          <div className="beauty-pix-placeholder"><WalletCards size={25} /><span>Pix e QR Code configuráveis na administração</span><small>Área reservada para a chave Pix e a imagem do QR Code do negócio.</small></div>
          <button type="button" className="ba-button ba-button-outline" onClick={() => { setPixCopied(true); notify('Ação demonstrativa: copiar chave Pix.'); }}><Copy size={15} /> {pixCopied ? 'Chave Pix demonstrativa copiada' : 'Copiar chave Pix'}</button>
          <button type="button" className="ba-button ba-button-primary" onClick={() => { setPaymentReported(true); notify('Aviso de pagamento registrado na demonstração.'); }}><Check size={16} /> Já fiz o Pix</button>
        </section>}
        {booking.depositRequired && paymentReported && <div className="beauty-payment-reported"><CheckCircle2 size={19} /><span>Aviso de pagamento registrado. O recebimento real precisa ser conferido pela administração.</span></div>}
        <div className="beauty-confirmation-details">
          <div><span>Código do agendamento</span><strong>{booking.code}</strong></div>
          <div><span>Cliente</span><strong>{booking.name}</strong></div>
          <div><span>Procedimentos</span><strong>{booking.services.map((service) => service.name).join(' + ')}</strong></div>
          <div><span>Duração total</span><strong>{booking.duration} min</strong></div>
          <div><span>Data e horário</span><strong>{readableDate(booking.date)} · {booking.time}</strong></div>
          {booking.services.some((service) => service.promotion) && <div><span>Promoção aplicada</span><strong>{booking.services.filter((service) => service.promotion).map((service) => service.promotion).join(', ')}</strong></div>}
          <div><span>Valor total</span><strong>{money(booking.total)}</strong></div>
          {booking.depositRequired && <div><span>Sinal demonstrativo</span><strong>{money(booking.deposit)}</strong></div>}
        </div>
        <div className="beauty-success-actions">
          <button className="ba-button ba-button-primary" onClick={() => { setBooking(null); setName(''); setPhone(''); setNote(''); setPolicyAcknowledged(false); setTime('10:30'); }}>Voltar ao agendamento</button>
          <button className="ba-button ba-button-outline" onClick={() => notify('O atalho do WhatsApp será configurado com o contato real do negócio.')}><MessageCircle size={15} /> WhatsApp do estúdio</button>
        </div>
        <p className="beauty-disclaimer"><ShieldCheck size={14} /> Prévia fictícia. Nenhum Pix, mensagem ou reserva real será enviado.</p>
      </div>
    </div>;
  }

  return <div className="beauty-public-preview">
    <div className="beauty-public-heading">
      <div><span className="beauty-kicker">ÁREA PÚBLICA · AGENDAMENTO ONLINE</span><h2>Reserve seu horário.</h2><p>Selecione vários procedimentos, confira promoções por data, escolha um horário disponível e envie seus dados.</p></div>
      <span className="beauty-preview-badge"><Eye size={14} /> PRÉVIA FICTÍCIA</span>
    </div>
    <form className="beauty-booking-layout" onSubmit={submit}>
      <div className="beauty-booking-main">
        <section className="ba-card">
          <div className="ba-step-heading"><span>01</span><div><strong>Escolha os procedimentos</strong><small>Selecione um ou mais procedimentos. A duração e o valor serão somados automaticamente.</small></div></div>
          <div className="beauty-service-groups">
            {groupedServices.map(([category, items]) => <fieldset className="beauty-service-group" key={category}>
              <legend>{category}</legend>
              {items.map((service) => {
                const promotion = promotionByService.get(service.id);
                const checked = selectedIds.includes(service.id);
                return <label className={\`beauty-service-option \${checked ? 'is-selected' : ''}\`} key={service.id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleService(service.id)} />
                  <span><strong>{service.name}</strong><small>{service.description} · {service.duration} min {promotion ? '· promoção vigente' : ''}</small></span>
                  <b>{money(promotion?.price ?? service.price)}{promotion && <s>{money(service.price)}</s>}</b>
                </label>;
              })}
            </fieldset>)}
          </div>
          {selectedServices.length > 0 && <div className="beauty-selection-total"><span><Clock3 size={15} /> Duração total: {selectedDuration} min</span><strong>{money(total)}</strong>{hasPromotion && <s>{money(regularTotal)}</s>}</div>}
          <p className="beauty-helper">As campanhas promocionais são consultadas pela data escolhida. O preço normal permanece no cadastro do serviço.</p>
        </section>

        <section className="ba-card">
          <div className="ba-step-heading"><span>02</span><div><strong>Data e horário</strong><small>A disponibilidade considera duração, expediente, intervalo, agendamentos e bloqueios.</small></div></div>
          <div className="beauty-date-row">
            <label>Data do atendimento<input type="date" value={date} min={localDate(0)} max={localDate(60)} onChange={(event) => { setDate(event.target.value); setTime(''); }} required /></label>
            <div className="beauty-date-readable"><CalendarDays size={15} /> {readableDate(date)}</div>
          </div>
          <div className="beauty-slots-heading"><strong>Horários disponíveis</strong><span>Seletor vertical hora / minuto</span></div>
          {selectedIds.length ? <BookingTimeWheelPicker id="beauty-public-time" slots={timeSlots} value={time} onChange={setTime} /> : <div className="beauty-empty-slots"><CalendarDays size={18} /> Selecione ao menos um procedimento para consultar os horários.</div>}
          <p className="beauty-helper">A seleção usa duas colunas independentes: role a hora e depois os minutos. No sistema real, os minutos exibidos são somente os horários liberados pela agenda.</p>
        </section>
      </div>

      <aside className="beauty-booking-aside">
        <section className="ba-card beauty-customer-card">
          <div className="ba-step-heading"><span>03</span><div><strong>Seus dados</strong><small>Para receber o retorno sobre a solicitação.</small></div></div>
          <label>Nome completo<div className="ba-input-icon"><UserRound size={16} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={100} placeholder="Ex.: Ana Martins" required /></div></label>
          <label>WhatsApp com DDD<div className="ba-input-icon"><MessageCircle size={16} /><input type="tel" value={phone} onChange={(event) => setPhone(formatInputPhone(event.target.value))} autoComplete="tel" maxLength={16} placeholder="(67) 99999-9999" required /></div></label>
          <label>Observações <span className="beauty-optional">Opcional</span><textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Alguma informação importante para o atendimento?" /></label>
          <section className="beauty-booking-policy">
            <button type="button" className="beauty-policy-toggle" onClick={() => setShowPolicies((value) => !value)} aria-expanded={showPolicies}><ShieldCheck size={16} /> Orientações importantes <ChevronDown size={15} /></button>
            {showPolicies && <div className="beauty-policy-list">{POLICIES.map((policy) => <p key={policy.title}><strong>{policy.title}:</strong> {policy.text}</p>)}</div>}
            <label className="beauty-policy-ack"><input type="checkbox" checked={policyAcknowledged} onChange={(event) => setPolicyAcknowledged(event.target.checked)} /> Li e concordo com as orientações acima.</label>
          </section>
          <div className="beauty-booking-summary">
            <span>RESUMO DO AGENDAMENTO</span>
            {selectedServices.map((service) => <div key={service.id}><small>{service.name}</small><strong>{money(promotionByService.get(service.id)?.price ?? service.price)}</strong></div>)}
            <div><small>Duração total</small><strong>{selectedDuration} min</strong></div>
            {hasPromotion && <div><small>Preço normal</small><s>{money(regularTotal)}</s></div>}
            <div className="beauty-grand-total"><span>Total estimado</span><strong>{money(total)}</strong></div>
            {depositPercent > 0 && <p>Sinal demonstrativo de até {depositPercent}%: {money(depositAmount)}. A exigência real depende da configuração do cadastro da cliente.</p>}
          </div>
          <button className="ba-button ba-button-primary beauty-book-submit" type="submit" disabled={!selectedIds.length || !time || !policyAcknowledged}><Check size={16} /> Reservar horário <ArrowRight size={16} /></button>
          <p className="beauty-privacy"><ShieldCheck size={13} /> Seus dados são usados para organizar seu atendimento.</p>
        </section>
      </aside>
    </form>
    <section className="beauty-booking-extras">
      <article><Heart size={18} /><div><strong>Atendimento personalizado</strong><p>Serviços e orientações podem ser adaptados à rotina do negócio.</p></div></article>
      <article><CalendarDays size={18} /><div><strong>Como funciona</strong><p>Após a solicitação, a equipe acompanha o pedido e atualiza o status na agenda administrativa.</p></div></article>
      <article><MapPin size={18} /><div><strong>Informações para sua visita</strong><p>Localização e detalhes do atendimento podem ser enviados pelo WhatsApp.</p></div></article>
    </section>
    <p className="beauty-disclaimer"><ShieldCheck size={14} /> Esta é uma prévia visual com dados fictícios. Nenhum agendamento, contato ou pagamento é registrado em um sistema real.</p>
  </div>;
}
