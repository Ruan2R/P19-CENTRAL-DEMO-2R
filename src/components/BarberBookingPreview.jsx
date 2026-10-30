import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Gift, Scissors, ShieldCheck, UserRound } from 'lucide-react';

const currency = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const ANY = 'sem-preferencia';
const todayKey = (offset = 0) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
};
const dateLabel = (value) => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date(value+'T12:00:00'));
const SERVICES = [
  {id:'s1',name:'Corte',durationMinutes:30,priceCents:5000,active:true},
  {id:'s2',name:'Barba',durationMinutes:30,priceCents:4000,active:true},
  {id:'s3',name:'Barba e Pigmentação',durationMinutes:45,priceCents:6500,active:true},
  {id:'s4',name:'Corte e Barba',durationMinutes:60,priceCents:8500,active:true},
  {id:'s5',name:'Low Fade ou Navalhado',durationMinutes:60,priceCents:6000,active:true},
  {id:'s6',name:'Pézinho',durationMinutes:15,priceCents:2000,active:true},
  {id:'s7',name:'Sobrancelha',durationMinutes:15,priceCents:2000,active:true},
];
const PROFESSIONALS = [{id:'p1',name:'João',role:'Barbeiro'},{id:'p2',name:'Maria',role:'Barbeira'}];
const PROMOTIONS = [
  {id:'pr1',name:'Combo corte + barba',kind:'combo',startsOn:todayKey(-5),endsOn:todayKey(16),active:true,serviceIds:['s1','s2'],promoPriceCents:7500},
  {id:'pr2',name:'Pézinho especial',kind:'service',startsOn:todayKey(-2),endsOn:todayKey(12),active:true,serviceIds:['s6'],promoPriceCents:1500},
  {id:'pr3',name:'Combo completo',kind:'combo',startsOn:todayKey(8),endsOn:todayKey(24),active:true,serviceIds:['s1','s2','s7'],promoPriceCents:9200},
];
const toMinutes = (time) => Number(time.slice(0,2))*60+Number(time.slice(3,5));
const overlaps = (a,da,b,db) => toMinutes(a)<toMinutes(b)+db && toMinutes(a)+da>toMinutes(b);

export default function BarberBookingPreview({ notify=()=>{} }) {
  const [selected, setSelected] = useState([]);
  const [date, setDate] = useState(todayKey(1));
  const [promotionId, setPromotionId] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [booking, setBooking] = useState(null);
  const applicablePromotions = PROMOTIONS.filter((item)=>item.active && item.endsOn>=todayKey(0));
  const chosenPromotion = applicablePromotions.find((item)=>item.id===promotionId);
  const selectedServices = selected.map((item)=>SERVICES.find((service)=>service.id===item.serviceId)).filter(Boolean);
  const regularTotal = selectedServices.reduce((sum,item)=>sum+item.priceCents,0);
  const promoApplies = Boolean(chosenPromotion && chosenPromotion.serviceIds.every((id)=>selected.some((item)=>item.serviceId===id)) && date>=chosenPromotion.startsOn && date<=chosenPromotion.endsOn);
  const promotedPrices = useMemo(()=>{
    const result = Object.fromEntries(selectedServices.map((service)=>[service.id,service.priceCents]));
    if(!promoApplies) return result;
    const offerServices = chosenPromotion.serviceIds.map((id)=>selectedServices.find((service)=>service.id===id)).filter(Boolean);
    const regular = offerServices.reduce((sum,service)=>sum+service.priceCents,0);
    const allocated = offerServices.map((service)=>Math.floor(chosenPromotion.promoPriceCents*service.priceCents/regular));
    let remaining = chosenPromotion.promoPriceCents-allocated.reduce((sum,cents)=>sum+cents,0);
    const shares = offerServices.map((service,index)=>({index,remainder:(chosenPromotion.promoPriceCents*service.priceCents)%regular})).sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
    for(let index=0;remaining>0;index+=1,remaining-=1) allocated[shares[index%shares.length].index]+=1;
    offerServices.forEach((service,index)=>{result[service.id]=allocated[index]});
    return result;
  },[selectedServices,chosenPromotion,promoApplies]);
  const promotionTotal = selectedServices.reduce((sum,service)=>sum+(promotedPrices[service.id]??service.priceCents),0);
  const duration = selectedServices.reduce((sum,item)=>sum+item.durationMinutes,0);
  const totalSlots = selected.map((item)=>({...item,service:SERVICES.find((service)=>service.id===item.serviceId)}));

  function applyPromotion(promotion) {
    const dateNext = date<promotion.startsOn ? promotion.startsOn : date>promotion.endsOn ? promotion.startsOn : date;
    setDate(dateNext);
    setPromotionId(promotion.id);
    setSelected((current)=>{
      const keys = new Set(current.map((item)=>item.serviceId));
      return [...current,...promotion.serviceIds.filter((id)=>!keys.has(id)).map((id)=>({serviceId:id,professionalId:ANY,time:''}))];
    });
    setOfferOpen(false);
    notify('Oferta aplicada: serviços adicionados e período da campanha selecionado.');
  }
  function toggleService(service) {
    setPromotionId('');
    setSelected((current)=>current.some((item)=>item.serviceId===service.id)
      ? current.filter((item)=>item.serviceId!==service.id)
      : [...current,{serviceId:service.id,professionalId:ANY,time:''}]);
  }
  function setProfessional(serviceId, professionalId) {
    setSelected((current)=>current.map((item)=>({
      ...item,
      professionalId:item.serviceId===serviceId?professionalId:item.professionalId,
      time:'',
      assignedProfessional:null
    })));
  }
  function availableFor(item) {
    const day = new Date(date+'T12:00:00').getDay();
    const hours = day===0 ? null : day===1
      ? {open:'13:30',close:'20:00',breakStart:'',breakEnd:''}
      : day===6 ? {open:'09:00',close:'17:00',breakStart:'',breakEnd:''}
      : {open:'09:00',close:'20:00',breakStart:'',breakEnd:''};
    if(!hours) return [];
    const professionals = item.professionalId===ANY
      ? PROFESSIONALS
      : PROFESSIONALS.filter((person)=>person.id===item.professionalId);
    const others=selected.filter((other)=>other.serviceId!==item.serviceId && other.time);
    const result=[];
    for(let minute=toMinutes(hours.open);minute+item.service.durationMinutes<=toMinutes(hours.close);minute+=30){
      const slot=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
      if(hours.breakStart && minute<toMinutes(hours.breakEnd) && minute+item.service.durationMinutes>toMinutes(hours.breakStart)) continue;
      const conflicts=others.some((other)=>{
        const otherService=SERVICES.find((service)=>service.id===other.serviceId);
        return overlaps(slot,item.service.durationMinutes,other.time,otherService.durationMinutes);
      });
      if(conflicts) continue;
      professionals.forEach((professional)=>result.push({time:slot,professional}));
    }
    return result;
  }
  function chooseSlot(serviceId,time,professional) {
    setSelected((current)=>current.map((item)=>item.serviceId===serviceId?{...item,time,assignedProfessional:professional}:item));
  }
  function finish(event) {
    event.preventDefault();
    if(!selected.length || selected.some((item)=>!item.time) || !name.trim() || whatsapp.replace(/\D/g,'').length<10){
      notify('Confira os serviços, profissionais, horários e dados do cliente.');
      return;
    }
    const chosen=selected.map((item)=>{
      const service=SERVICES.find((s)=>s.id===item.serviceId);
      const assigned=item.assignedProfessional||PROFESSIONALS.find((p)=>p.id===item.professionalId)||PROFESSIONALS[0];
      return {service, time:item.time, professional:assigned.name, priceCents:promotedPrices[service.id]??service.priceCents, promotionName:promoApplies&&chosenPromotion.serviceIds.includes(service.id)?chosenPromotion.name:''};
    }).sort((a,b)=>a.time.localeCompare(b.time));
    setBooking({code:'B67-2026-0148',date,name,whatsapp,items:chosen,total:promotionTotal,duration});
  }

  if(booking) return <div className="barber-booking-preview">
    <section className="bb-confirmation">
      <span className="bb-confirmation-mark"><CheckCircle2 size={30}/></span>
      <span className="bb-kicker">DEMONSTRAÇÃO DE AGENDAMENTO</span>
      <h2>Atendimento montado!</h2>
      <p>Este é o resumo que o cliente confere antes de concluir a solicitação no P15.</p>
      <div className="bb-code"><small>CÓDIGO DO ATENDIMENTO</small><strong>{booking.code}</strong></div>
      <div className="bb-confirmation-meta"><div><small>Cliente</small><strong>{booking.name}</strong></div><div><small>Data</small><strong>{dateLabel(booking.date)}</strong></div><div><small>Procedimentos</small><strong>{booking.items.length}</strong></div></div>
      <div className="bb-selected-list">{booking.items.map((item)=> <div key={item.service.id}><span className="bb-time">{item.time}</span><span><strong>{item.service.name}</strong><small>{item.professional} · {item.service.durationMinutes} min</small></span><b>{currency(item.priceCents)}</b></div>)}</div>
      <div className="bb-total-row"><span>Total · {booking.duration} min</span><strong>{currency(booking.total)}</strong></div>
      <p className="bb-demo-note"><ShieldCheck size={14}/> Prévia fictícia. Nenhuma reserva ou mensagem será enviada.</p>
      <button className="bb-button bb-button-primary" onClick={()=>{setBooking(null);setSelected([]);setName('');setWhatsapp('');setPromotionId('');}}>Voltar ao catálogo de serviços</button>
    </section>
  </div>;

  return <div className="barber-booking-preview">
    <header className="bb-public-heading"><div><span className="bb-kicker">BOSS67 BARBEARIA · AGENDAMENTO ONLINE</span><h2>Monte seu atendimento.</h2><p>Escolha vários procedimentos, defina a preferência de profissional de cada um e selecione os horários.</p></div><span className="bb-demo-pill"><span/> PRÉVIA INTERATIVA</span></header>
    <section className="bb-booking-section">
      <div className="bb-step-heading"><span>01</span><div><strong>Escolha os serviços</strong><small>Selecione um ou mais procedimentos para montar seu atendimento.</small></div></div>
      <button className="bb-offer-toggle" onClick={()=>setOfferOpen((value)=>!value)} aria-expanded={offerOpen}><span className="bb-offer-mark">%</span><span><strong>Temos {applicablePromotions.length} ofertas para você</strong><small>Ofertas individuais e combos com validade.</small></span><b>{offerOpen?'Ocultar −':'Ver ofertas +'}</b></button>
      {offerOpen&&<div className="bb-offer-list">{applicablePromotions.map((promotion)=>{
        const subtotal=promotion.serviceIds.reduce((sum,id)=>sum+(SERVICES.find((service)=>service.id===id)?.priceCents||0),0);
        return <article key={promotion.id} className="bb-offer-card"><div><span>{promotion.kind==='combo'?'COMBO':'OFERTA'}</span><small>Válida de {promotion.startsOn.split('-').reverse().join('/')} a {promotion.endsOn.split('-').reverse().join('/')}</small></div><strong>{promotion.name}</strong><p>{promotion.serviceIds.map((id)=>SERVICES.find((service)=>service.id===id)?.name).join(' + ')}</p><div className="bb-offer-price"><s>{currency(subtotal)}</s><b>{currency(promotion.promoPriceCents)}</b><em>Economize {currency(subtotal-promotion.promoPriceCents)}</em></div><button onClick={()=>applyPromotion(promotion)}>Adicionar {promotion.kind==='combo'?'combo':'oferta'}</button></article>;
      })}</div>}
      <div className="bb-service-list">{SERVICES.filter((service)=>service.active).map((service)=>{
        const chosen=selected.some((item)=>item.serviceId===service.id);
        return <button key={service.id} className={'bb-service-option'+(chosen?' selected':'')} aria-pressed={chosen} onClick={()=>toggleService(service)}><span className="bb-service-check">{chosen?'✓':'+'}</span><span><strong>{service.name}</strong><small>{service.durationMinutes} minutos</small></span><b>{currency(promotedPrices[service.id]??service.priceCents)}{(promotedPrices[service.id]??service.priceCents)<service.priceCents&&<s>{currency(service.priceCents)}</s>}</b></button>;
      })}</div>
      {selected.length>0&&<div className="bb-total-preview"><span>{selected.length} procedimentos · {duration} min</span>{promoApplies&&<small>{chosenPromotion.name} aplicada</small>}<strong>{currency(promotionTotal)}</strong></div>}
    </section>

    {selected.length>0&&<section className="bb-booking-section">
      <div className="bb-step-heading"><span>02</span><div><strong>Escolha os profissionais</strong><small>Defina quem fará cada procedimento ou deixe sem preferência.</small></div></div>
      <div className="bb-procedure-settings">{selected.map((item,index)=>{
        const service=SERVICES.find((entry)=>entry.id===item.serviceId);
        return <article key={service.id}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{service.name}</strong><small>{service.durationMinutes} min · {currency(service.priceCents)}</small></div><label>Profissional<select value={item.professionalId} onChange={(event)=>setProfessional(item.serviceId,event.target.value)}><option value={ANY}>Sem preferência</option>{PROFESSIONALS.map((professional)=><option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label></article>;
      })}</div>
    </section>}

    {selected.length>0&&<section className="bb-booking-section">
      <div className="bb-step-heading"><span>03</span><div><strong>Escolha data e horários</strong><small>Grade de inícios em intervalos de 30 minutos; a duração de cada serviço é respeitada.</small></div></div>
      <label className="bb-date-field">Data do atendimento<input type="date" min={todayKey(0)} max={todayKey(60)} value={date} onChange={(event)=>{setDate(event.target.value);setSelected((current)=>current.map((item)=>({...item,time:''})));}}/></label>
      <div className="bb-date-label"><CalendarDays size={15}/>{dateLabel(date)}</div>
      <div className="bb-slot-groups">{totalSlots.map((item,index)=>{
        const slots=availableFor(item);
        const preferred=PROFESSIONALS.find((p)=>p.id===item.professionalId);
        return <article className="bb-slot-card" key={item.serviceId}><div className="bb-slot-head"><span>{String(index+1).padStart(2,'0')}</span><div><strong>{item.service.name}</strong><small>{item.service.durationMinutes} min · {preferred?.name||'Sem preferência'}</small></div>{item.time&&<b>{item.time}</b>}</div>{slots.length?<div className="bb-slot-grid">{slots.map((slot,slotIndex)=>{
          const chosen=item.time===slot.time&&item.assignedProfessional?.id===slot.professional.id;
          return <button key={slot.time+'-'+slot.professional.id+'-'+slotIndex} className={chosen?'selected':''} onClick={()=>chooseSlot(item.serviceId,slot.time,slot.professional)}><strong>{slot.time}</strong>{item.professionalId===ANY&&<small>{slot.professional.name}</small>}</button>;
        })}</div>:<p className="bb-empty-slot">Não há horários disponíveis para esse procedimento nesta data.</p>}</article>;
      })}</div>
      <p className="bb-helper">Cada procedimento tem sua própria escolha de horário. O sistema evita sobreposição entre serviços do mesmo atendimento.</p>
    </section>}

    {selected.length>0&&selected.every((item)=>item.time)&&<section className="bb-booking-section">
      <div className="bb-step-heading"><span>04</span><div><strong>Confira e confirme seu atendimento</strong><small>Revise os serviços, profissionais, horários e valor final.</small></div></div>
      <div className="bb-final-summary">{selected.map((item)=>{const service=SERVICES.find((s)=>s.id===item.serviceId);const person=PROFESSIONALS.find((p)=>p.id===item.professionalId)||item.assignedProfessional||PROFESSIONALS[0];return <div key={item.serviceId}><span>{item.time}</span><div><strong>{service.name}</strong><small>{person.name} · {service.durationMinutes} min</small></div><b>{currency(service.priceCents)}</b></div>;})}<div className="bb-total-row"><span>Total do atendimento</span><strong>{currency(promotionTotal)}</strong></div></div>
      <form className="bb-customer-form" onSubmit={finish}><label>Seu nome<input value={name} onChange={(event)=>setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" placeholder="Nome e sobrenome" required/></label><label>WhatsApp com DDD<input value={whatsapp} onChange={(event)=>setWhatsapp(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(67) 99999-9999" required/></label><button className="bb-button bb-button-primary" type="submit"><Check size={16}/> Confirmar agendamento <ArrowRight size={16}/></button></form>
    </section>}
    <p className="bb-demo-note"><ShieldCheck size={14}/> Experiência pública demonstrativa. A disponibilidade, os profissionais e os valores desta prévia são fictícios; o P15 real consulta a API e valida todos os horários de forma atômica.</p>
  </div>;
}
