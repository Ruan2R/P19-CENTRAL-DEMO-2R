import { useMemo, useState } from 'react';
import BeautyBookingPreview from './components/BeautyBookingPreview';
import BeautyAdminShowcase from './components/BeautyAdminShowcase';
import BarberBookingPreview from './components/BarberBookingPreview';
import BarberAdminShowcase from './components/BarberAdminShowcase';
import BurgerP16Showcase from './components/BurgerP16Showcase';
import ModuleGuideCard from './components/ModuleGuideCard';
import { getModuleGuide } from './demoGuides';
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, ClipboardList, Clock3, CreditCard, ExternalLink, Eye, Grid2X2, LayoutDashboard, Menu, Scissors, Search, ShoppingBag, Sparkles, Store, Users, Wallet, X, Boxes, TrendingUp, MonitorSmartphone, LogOut, ArrowUpRight, MoreHorizontal, CheckCircle2, Code2, Linkedin, ShieldCheck, DoorClosed, Tag
} from 'lucide-react';

const DEMOS = [
  { id:'landing', name:'2R Landing Pages', segment:'Vitrine', title:'Landing pages', description:'Apresente os três modelos de página e alterne entre Beauty, Barber e Burger sem trocar de página de demonstração.', modules:['site'], highlight:'Modelos de apresentação', color:'blue', icon:'site' },
  { id:'beauty.agenda', name:'2R Beauty Agenda', segment:'Beauty', title:'Agendamentos e administração básica', description:'Agendamento público para clientes, agenda do dia, serviços e cadastros fictícios para apresentar a rotina de uma profissional.', modules:['overview','booking','appointments','clients','services','promotions','hours','blocks','policies'], color:'rose', icon:'beauty' },
  { id:'beauty.financeiro', name:'2R Beauty Financeiro', segment:'Beauty', title:'Financeiro', description:'Demonstração isolada de receitas, despesas, movimentações e resumo do período.', modules:['finance'], color:'rose', icon:'finance' },
  { id:'beauty.siteagenda', name:'2R Beauty Web + Agenda', segment:'Beauty', title:'Landing page + agendamentos', description:'Página pública para apresentar serviços e um fluxo de agendamento demonstrativo.', modules:['site','booking','appointments','clients','services','promotions','hours','blocks','policies'], color:'rose', icon:'site' },
  { id:'beauty.agenda.financeiro', name:'2R Beauty Gestão', segment:'Beauty', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda administrativa, clientes, serviços e financeiro; sem landing page de marketing neste pacote.', modules:['overview','booking','appointments','clients','services','promotions','hours','blocks','policies','finance'], color:'rose', icon:'finance' },
  { id:'beauty.completo', name:'2R Beauty Completo', segment:'Beauty', title:'Solução completa Beauty', description:'Experiência completa com landing page, agendamentos, gestão administrativa e financeiro.', modules:['site','overview','booking','appointments','clients','services','promotions','hours','blocks','policies','finance'], color:'rose', icon:'sparkles' },
  { id:'barber.agenda', name:'2R Barber Agenda', segment:'Barber', title:'Agendamentos e administração', description:'Agendamento público para clientes, agenda administrativa, procedimentos, profissionais, promoções e gestão básica de uma barbearia.', modules:['overview','booking','appointments','clients','services','professionals','hours','blocks','promotions'], color:'amber', icon:'barber' },
  { id:'barber.siteagenda', name:'2R Barber Web + Agenda', segment:'Barber', title:'Landing page + agendamentos', description:'Página de apresentação da barbearia integrada ao exemplo de agendamentos.', modules:['site','booking','appointments','clients','services','professionals','hours','blocks','promotions'], color:'amber', icon:'site' },
  { id:'barber.agenda.financeiro', name:'2R Barber Gestão', segment:'Barber', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda, serviços, clientes e financeiro para demonstrar uma gestão mais completa.', modules:['overview','booking','appointments','clients','services','professionals','hours','blocks','promotions','finance'], color:'amber', icon:'finance' },
  { id:'barber.completo', name:'2R Barber Completo', segment:'Barber', title:'Solução completa Barber', description:'Landing page, agendamentos e administração completa com dados de demonstração.', modules:['site','overview','booking','appointments','clients','services','professionals','hours','blocks','promotions','finance'], color:'amber', icon:'sparkles' },
  { id:'burger.pedidos', name:'2R Burger Pedidos', segment:'Burger', title:'Pedidos e operação', description:'Operação interna de atendimento, lançamento de pedidos, acompanhamento do preparo e controle de estoque.', modules:['orders'], color:'orange', icon:'orders' },
  { id:'burger.gestao', name:'2R Burger Gestão', segment:'Burger', title:'Financeiro, produtos e estoque', description:'Controle demonstrativo de produtos, estoque e movimentações financeiras.', modules:['finance'], color:'orange', icon:'inventory' },
  { id:'burger.completo', name:'2R Burger Completo', segment:'Burger', title:'Solução completa Burger', description:'Landing page, operação interna de pedidos, produtos, estoque e financeiro reunidos em uma demonstração.', modules:['site','finance','orders'], color:'orange', icon:'sparkles' },
];

const MODULES = {
  site: { label:'Landing page', icon:Store, description:'Página estratégica para apresentar um negócio e direcionar contatos' },
  overview: { label:'Visão geral', icon:LayoutDashboard, description:'Resumo da operação' },
  booking: { label:'Agendamento público', icon:CalendarDays, description:'Página do cliente para escolher serviço e horário' },
  appointments: { label:'Agendamentos', icon:CalendarDays, description:'Agenda e atendimentos' },
  promotions: { label:'Promoções', icon:Tag, description:'Ofertas de serviço individual e combos com validade' },
  professionals: { label:'Profissionais', icon:Users, description:'Equipe, funções e disponibilidade de cada profissional' },
  hours: { label:'Horários', icon:Clock3, description:'Funcionamento semanal e intervalos de atendimento' },
  blocks: { label:'Bloqueios', icon:DoorClosed, description:'Folgas e períodos indisponíveis na agenda' },
  policies: { label:'Políticas', icon:ShieldCheck, description:'Orientações apresentadas antes do agendamento público' },
  clients: { label:'Clientes', icon:Users, description:'Base de clientes fictícios' },
  services: { label:'Serviços', icon:Scissors, description:'Procedimentos e duração' },
  finance: { label:'Financeiro', icon:Wallet, description:'Receitas, despesas e saldo' },
  orders: { label:'Pedidos', icon:ClipboardList, description:'Lançamento interno, preparo, retirada e pagamentos dos pedidos' },
};

const SEGMENTS = {
  Beauty: { short:'BEAUTY', customer:'Studio Bella', subtitle:'Beleza, cuidado e praticidade em um só lugar.', accent:'#b76d8f', secondary:'#f8edf2', services:[['Maquiagem social','R$ 160,00','40 min'],['Design de sobrancelhas','R$ 40,00','40 min'],['Lash lifting','R$ 150,00','1h 30min']], hero:'Seu momento de beleza começa aqui.', action:'Agendar horário' },
  Barber: { short:'BARBER', customer:'Barber Club', subtitle:'Seu estilo. Seu horário. Seu momento.', accent:'#bd954e', secondary:'#f8f2e6', services:[['Corte degradê','R$ 55,00','40 min'],['Barba completa','R$ 35,00','30 min'],['Corte + barba','R$ 80,00','1h']], hero:'Seu próximo corte começa aqui.', action:'Agendar corte' },
  Burger: { short:'BURGER', customer:'Brasa Burger', subtitle:'Feito na brasa, pensado para matar sua fome.', accent:'#d8753d', secondary:'#fff0e5', services:[['Smash clássico','R$ 29,90','Destaque da casa'],['Combo Brasa','R$ 39,90','Destaque da casa'],['Batata crocante','R$ 14,90','Acompanhamento']], hero:'Seu próximo burger favorito está aqui.', action:'Falar com a hamburgueria' },
};

const INITIAL_APPOINTMENTS = [
  { id:1, client:'Mariana Costa', service:'Maquiagem social', time:'09:00', date:'Hoje', status:'Confirmado', price:160 },
  { id:2, client:'Camila Oliveira', service:'Design de sobrancelhas', time:'10:30', date:'Hoje', status:'Confirmado', price:40 },
  { id:3, client:'Juliana Martins', service:'Lash lifting', time:'13:00', date:'Hoje', status:'Aguardando', price:150 },
  { id:4, client:'Bianca Souza', service:'Design de sobrancelhas', time:'15:00', date:'Hoje', status:'Confirmado', price:40 },
];
const INITIAL_TRANSACTIONS = [
  { id:1, description:'Atendimentos do dia', category:'Receita', date:'Hoje', value:890 },
  { id:2, description:'Compra de materiais', category:'Despesa', date:'Ontem', value:145 },
  { id:3, description:'Serviços realizados', category:'Receita', date:'Ontem', value:540 },
  { id:4, description:'Reposição de produtos', category:'Despesa', date:'27 out.', value:220 },
];
function money(value) { return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function IconForDemo({ demo }) {
  const Icon = demo.icon === 'beauty' ? Sparkles : demo.icon === 'barber' ? Scissors : demo.icon === 'orders' ? ShoppingBag : demo.icon === 'inventory' ? Boxes : demo.icon === 'finance' ? Wallet : demo.icon === 'site' ? MonitorSmartphone : demo.icon === 'sparkles' ? Sparkles : Grid2X2;
  return <Icon size={20} strokeWidth={1.8} />;
}
function getStartModule(demo) { return demo.modules[0]; }
function getDemoGuideMetrics(demo,module) {
  if (demo.segment !== 'Burger') {
    return {step:Math.max(1,demo.modules.indexOf(module)+1),total:demo.modules.length};
  }
  const hasSite=demo.modules.includes('site');
  const hasFinance=demo.modules.includes('finance');
  const hasOrders=demo.modules.includes('orders');
  const total=(hasSite?1:0)+(hasFinance?6:0)+(hasOrders?1:0);
  const step=module==='site'
    ? 1
    : module==='finance'
      ? (hasSite?1:0)+1
      : module==='orders'
        ? (hasSite?1:0)+(hasFinance?6:0)+1
        : Math.max(1,demo.modules.indexOf(module)+1);
  return {step,total};
}

export default function App() {
  const [activeDemo, setActiveDemo] = useState(null);
  const [page, setPage] = useState('portfolio');
  const [activeModule, setActiveModule] = useState('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [mobileNav, setMobileNav] = useState(false);
  const appointments = INITIAL_APPOINTMENTS;
  const transactions = INITIAL_TRANSACTIONS;
  const [toast, setToast] = useState('');
  const [siteSegment, setSiteSegment] = useState('Beauty');
  const [acknowledgedGuides, setAcknowledgedGuides] = useState({});


  const visibleDemos = useMemo(() => DEMOS.filter(demo => {
    const matchesText = `${demo.name} ${demo.title} ${demo.description}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'Todos' || demo.segment === filter;
    return matchesText && matchesFilter;
  }), [search, filter]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  }
  function enterDemo(demo) {
    setActiveDemo(demo);
    setActiveModule(getStartModule(demo));
    setSiteSegment(demo.segment === 'Vitrine' ? 'Beauty' : demo.segment);
    setMobileNav(false);
  }
  function exitDemo() { setActiveDemo(null); setMobileNav(false); setPage('catalog'); }
  function canUse(module) { return activeDemo?.modules.includes(module); }
  function changeModule(module, bypassGuideCheck = false) {
    setMobileNav(false);
    if (!activeDemo?.modules.includes(module)) return;
    if (!bypassGuideCheck && module !== activeModule) {
      const currentGuideKey=activeDemo.id+':'+activeModule;
      if (!acknowledgedGuides[currentGuideKey]) {
        notify('Confirme o guia desta tela antes de avançar. Você também pode escolher “Entendi, explorar esta tela”.');
        return;
      }
    }
    setActiveModule(module);
  }
  function acknowledgeGuide(key) {
    setAcknowledgedGuides(current => current[key] ? current : ({...current,[key]:true}));
  }

  if (!activeDemo && page === 'portfolio') {
    return <PortfolioHome onOpenCatalog={(segment = 'Todos') => { setFilter(segment); setSearch(''); setPage('catalog'); }} />;
  }

  if (!activeDemo) {
    return <div className="app-shell hub-shell">
      <header className="topbar hub-topbar">
        <div className="brand-lockup"><div className="brand-mark">2R</div><div><div className="brand-name">2R INFORMÁTICA</div><div className="brand-tagline">Seu parceiro em Tecnologia</div></div></div>
        <div className="topbar-right"><span className="demo-pill"><span className="pulse-dot"/> MODALIDADES 2R</span><button className="catalog-back-button" onClick={() => setPage('portfolio')}><ArrowLeft size={15}/><span>Portfólio</span></button></div>
      </header>
      <main className="hub-main">
        <section className="hero-banner">
          <div className="hero-content">
            <div className="eyebrow"><Sparkles size={14}/> CENTRAL COMERCIAL 2R</div>
            <h1>Uma solução para<br/><span>cada tipo de negócio.</span></h1>
            <p>Escolha um segmento, compare os recursos e abra uma prévia para entender como a solução funciona na prática.</p>
            <div className="hero-segment-line"><span>EXPLORE POR SEGMENTO</span><b>Beauty</b><i></i><b>Barber</b><i></i><b>Burger</b></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-core"><span>2R</span><small>TECNOLOGIA</small></div><div className="float-card float-beauty"><Sparkles size={17}/><span>Beauty</span></div><div className="float-card float-barber"><Scissors size={17}/><span>Barber</span></div><div className="float-card float-burger"><ShoppingBag size={17}/><span>Burger</span></div></div>
        </section>

        <section className="catalog-section">
          <div className="section-heading"><div><div className="eyebrow muted-eyebrow">MODALIDADES DE APLICAÇÃO</div><h2>Explore as opções disponíveis.</h2><p>Abra uma modalidade para ver as telas, os recursos incluídos e como navegar pela demonstração.</p></div><span className="catalog-results-count">{visibleDemos.length} {visibleDemos.length===1?'modalidade':'modalidades'}</span></div>
          <div className="catalog-toolbar"><label className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar modalidade, recurso ou segmento..."/><kbd>⌕</kbd></label><div className="filter-pills" aria-label="Filtrar por segmento">{['Todos','Vitrine','Beauty','Barber','Burger'].map(item=><button key={item} className={`filter-pill ${filter===item?'selected':''}`} onClick={()=>setFilter(item)}>{item}</button>)}</div></div>
          <div className="catalog-usage-guide" aria-label="Como explorar o portfólio">
            <div className="catalog-usage-heading"><span>COMO EXPLORAR</span><strong>Conheça a solução em três passos.</strong></div>
            <article><span>01</span><div><strong>Escolha o segmento</strong><p>Beauty, Barber, Burger ou modelos de landing page.</p></div></article>
            <article><span>02</span><div><strong>Abra uma modalidade</strong><p>Confira os recursos que fazem parte daquele pacote.</p></div></article>
            <article><span>03</span><div><strong>Teste a demonstração</strong><p>Use o menu lateral e experimente os botões e formulários.</p></div></article>
          </div>

          {['Vitrine','Beauty','Barber','Burger'].filter(group=>filter==='Todos'||filter===group).map(group=>{
            const list=visibleDemos.filter(d=>d.segment===group);
            if (!list.length) return null;
            return <div className="segment-group" key={group}><div className="segment-heading"><div className={`segment-icon ${group.toLowerCase()}`}>{group==='Vitrine'?<MonitorSmartphone size={18}/>:group==='Beauty'?<Sparkles size={18}/>:group==='Barber'?<Scissors size={18}/>:<ShoppingBag size={18}/>}</div><div><h3>{group==='Vitrine'?'Modelos de landing page':group==='Beauty'?'Beauty & estética':group==='Barber'?'Barbearia':'Pedidos & alimentação'}</h3><p>{group==='Vitrine'?'Demonstre diferentes estilos de página':group==='Beauty'?'Agenda, gestão e financeiro para profissionais da beleza':group==='Barber'?'Agenda e gestão para barbearias':'Pedidos, produtos, estoque e financeiro'}</p></div><span className="group-count">{list.length} {list.length===1?'modalidade':'modalidades'}</span></div>
              <div className="demo-grid">{list.map((demo,index)=><article className={`demo-card ${demo.color}`} key={demo.id} style={{'--card-index':index}}><div className="demo-card-top"><div className={`demo-card-icon ${demo.color}`}><IconForDemo demo={demo}/></div><span className="demo-segment-tag">{demo.segment==='Vitrine'?'LANDING PAGE':demo.segment.toUpperCase()}</span></div><h4>{demo.name}</h4><div className="demo-card-title">{demo.title}</div><p>{demo.description}</p><div className="module-chips">{demo.modules.filter(m=>m!=='overview').slice(0,4).map(m=><span key={m}>{MODULES[m].label}</span>)}{demo.modules.filter(m=>m!=='overview').length>4&&<span>+{demo.modules.filter(m=>m!=='overview').length-4}</span>}</div>
                
                <button className="enter-demo-button" onClick={()=>enterDemo(demo)}><span>Visualizar modalidade</span><ArrowUpRight size={17}/></button></article>)}</div>
            </div>;
          })}
          {visibleDemos.length===0&&<div className="empty-state"><Search size={28}/><strong>Nenhuma modalidade encontrada</strong><span>Tente outro nome, recurso ou segmento.</span></div>}
        </section>

        <section className="access-note portfolio-demo-disclaimer"><div className="access-note-icon"><Eye size={20}/></div><div className="access-note-copy"><strong>Prévia visual, sem login e sem cadastro</strong><p>As telas usam informações fictícias. Os botões e formulários servem apenas para demonstrar os fluxos; nada é enviado a clientes ou gravado em banco de dados.</p></div></section>
      </main>
      <footer className="footer"><span>2R INFORMÁTICA · Seu parceiro em Tecnologia</span><span><span className="footer-dot"/> Dados fictícios para demonstração</span></footer>
      {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>;
  }

  const currentModules = activeDemo.modules;
  const isBurger = activeDemo.segment === 'Burger';
  const isBarber = activeDemo.segment === 'Barber';
  const isBeauty = activeDemo.segment === 'Beauty';
  const guideKey = activeDemo.id + ':' + activeModule;
  const nextModule = currentModules[currentModules.indexOf(activeModule) + 1];
  const guideContent = getModuleGuide(activeModule, activeDemo.segment);
  const guideMetrics = getDemoGuideMetrics(activeDemo, activeModule);

  if (isBurger && ['finance','orders'].includes(activeModule)) {
    return <BurgerP16Showcase
      module={activeModule}
      notify={notify}
      onNavigate={(module)=>changeModule(module,true)}
      onExit={exitDemo}
      availableModules={currentModules}
      demoId={activeDemo.id}
      seenGuides={acknowledgedGuides}
      onAcknowledgeGuide={acknowledgeGuide}
    />;
  }

  return <div className={`app-shell demo-app ${activeDemo.color}`}>
    <header className="topbar demo-topbar"><div className="brand-lockup"><button className="mobile-menu icon-quiet" onClick={()=>setMobileNav(v=>!v)} aria-label="Abrir menu"><Menu size={20}/></button><div className="brand-mark">2R</div><div><div className="brand-name">2R INFORMÁTICA</div><div className="brand-tagline">Prévia visual de modalidades</div></div></div><div className="demo-topbar-right"><span className={`workspace-badge ${activeDemo.color}`}><span className="workspace-dot"/>{activeDemo.segment==='Vitrine'?'LANDING PAGES':activeDemo.segment.toUpperCase()}</span><button className="back-hub-button" onClick={exitDemo}><ArrowLeft size={16}/><span>Voltar às modalidades</span></button></div></header>
    <div className="demo-layout">
      <aside className={`sidebar ${mobileNav?'show-mobile':''}`}><div className="sidebar-workspace"><div className={`workspace-avatar ${activeDemo.color}`}><IconForDemo demo={activeDemo}/></div><div className="workspace-meta"><strong>{activeDemo.name}</strong><span>Prévia visual do pacote</span></div><button className="icon-quiet sidebar-close" onClick={()=>setMobileNav(false)}><X size={17}/></button></div><div className="sidebar-section-label">NAVEGAR NA PRÉVIA</div><nav className="side-nav">{currentModules.map(module=>{const item=MODULES[module];const Icon=item.icon;return <button key={module} className={`side-nav-item ${activeModule===module?'active':''}`} onClick={()=>changeModule(module)}><Icon size={18}/><span>{item.label}</span>{activeModule===module&&<span className="nav-active-mark"/>}</button>})}</nav><div className="sidebar-bottom"><div className="demo-data-note"><div><Sparkles size={15}/><strong>Modo demonstração</strong></div><p>Use o menu para alternar entre telas e experimente os botões. As alterações são temporárias e reiniciam ao recarregar.</p></div><button className="side-nav-item exit-item" onClick={exitDemo}><LogOut size={18}/><span>Voltar às modalidades</span></button></div></aside>
      {mobileNav&&<button className="mobile-scrim" aria-label="Fechar menu" onClick={()=>setMobileNav(false)}/>}
      <main className="demo-main">
        <div className="demo-breadcrumb"><span>Central 2R</span><ArrowRight size={13}/><span>{activeDemo.segment}</span><ArrowRight size={13}/><strong>{MODULES[activeModule]?.label || 'Demonstração'}</strong></div>
        <div className="main-title-row"><div><div className="eyebrow muted-eyebrow">{activeDemo.name.toUpperCase()}</div><h1>{activeModule==='site'?'Landing pages na prática':MODULES[activeModule]?.label || activeDemo.title}</h1><p>{activeModule==='site'?'Entenda o papel de uma página de apresentação e explore um exemplo visual.':MODULES[activeModule]?.description || activeDemo.description}</p></div><div className="main-title-actions"><span className="fake-live"><span className="pulse-dot"/> PRÉVIA INTERATIVA</span><button className="secondary-button" onClick={exitDemo}><Grid2X2 size={16}/> Catálogo</button></div></div>
        {!acknowledgedGuides[guideKey]&&<ModuleGuideCard
           stepNumber={guideMetrics.step}
           totalSteps={guideMetrics.total}
           title={guideContent.title}
           description={guideContent.description}
           tip={guideContent.tip}
           nextLabel={nextModule ? MODULES[nextModule]?.label : undefined}
           onNext={nextModule ? ()=>{acknowledgeGuide(guideKey);changeModule(nextModule,true);} : undefined}
           onExplore={()=>acknowledgeGuide(guideKey)}
         />}
        {activeModule==='site'&&<SiteModule activeDemo={activeDemo} siteSegment={siteSegment} setSiteSegment={setSiteSegment} onCta={()=>{if(canUse('booking')&&siteSegment!=='Burger'){changeModule('booking');return;}if(siteSegment==='Burger'){notify('Em uma página de alimentação, este botão pode abrir o WhatsApp ou endereço da loja. Os pedidos do P16 são lançados pela equipe na área interna, não por um cardápio público.');return;}notify('O destino deste botão é definido conforme o objetivo do negócio: WhatsApp, formulário, agendamento ou outro canal de contato. Nesta prévia, nenhum envio é realizado.');}} />}
         {activeModule==='overview'&&!isBurger&&(isBarber
           ? <BarberAdminShowcase module="overview" notify={notify}/>
           : <OverviewModule demo={activeDemo} appointments={appointments} transactions={transactions} changeModule={changeModule}/>
         )}
         {activeModule==='booking'&&(isBeauty
           ? <BeautyBookingPreview notify={notify}/>
           : <BarberBookingPreview notify={notify}/>
         )}
         {isBarber&&['appointments','clients','services','professionals','hours','blocks','promotions','finance'].includes(activeModule)&&<BarberAdminShowcase module={activeModule} notify={notify}/>}
         {isBeauty&&['appointments','clients','services','promotions','hours','blocks','policies','finance'].includes(activeModule)&&<BeautyAdminShowcase module={activeModule} notify={notify}/>}
         <div className="demo-footer-note"><Eye size={14}/><span>Como testar: navegue pelo menu lateral, abra formulários e experimente as ações. Os dados são fictícios, nada é enviado ou salvo e recarregar a página reinicia a demonstração.</span></div>
      </main>
    </div>
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}


function MetricCard({label,value,delta,icon:Icon,kind='blue',footnote}) {
  return <div className="metric-card"><div className={`metric-icon ${kind}`}><Icon size={19}/></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><div className="metric-foot"><span className={delta?.startsWith('-')?'negative':'positive'}>{delta}</span>{footnote&&<span>{footnote}</span>}</div></div>;
}
function OverviewModule({demo,appointments,transactions,changeModule}) {
  const incoming=transactions.filter(item=>item.category==='Receita').reduce((sum,item)=>sum+item.value,0);
  const outgoing=transactions.filter(item=>item.category==='Despesa').reduce((sum,item)=>sum+item.value,0);
  const waiting=appointments.filter(item=>item.status==='Aguardando').length;
  const quickModules=demo.modules.filter(module=>module!=='overview').slice(0,4);
  return <>
    <div className="welcome-strip"><div className="welcome-icon"><Activity size={19}/></div><div><strong>Bem-vinda à demonstração Beauty.</strong><p>Este painel reúne um resumo da agenda e alguns atalhos para explorar a gestão.</p></div><span className="sample-tag"><BadgeCheck size={14}/> EXEMPLO</span></div>
    <div className="metric-grid">
      <MetricCard label="Agendamentos" value={appointments.length.toString().padStart(2,'0')} delta={waiting+' aguardando'} icon={CalendarDays} kind="blue" footnote="no exemplo"/>
      <MetricCard label="Receitas lançadas" value={money(incoming)} delta="Entradas fictícias" icon={TrendingUp} kind="green" footnote="valores de exemplo"/>
      <MetricCard label="Despesas lançadas" value={money(outgoing)} delta="Saídas fictícias" icon={CreditCard} kind="rose" footnote="valores de exemplo"/>
      <MetricCard label="Saldo demonstrativo" value={money(incoming-outgoing)} delta="Receitas − despesas" icon={Wallet} kind="purple" footnote="não contábil"/>
    </div>
    <div className="content-grid overview-content">
      <section className="panel">
        <div className="panel-heading"><div><h3>Próximos agendamentos</h3><p>Visualização rápida dos atendimentos de exemplo.</p></div><button className="text-action" onClick={()=>changeModule('appointments')}>Ver agenda <ArrowRight size={15}/></button></div>
        <AppointmentRows appointments={appointments.slice(0,4)}/>
      </section>
      <section className="panel quick-panel">
        <div className="panel-heading"><div><h3>Atalhos do pacote</h3><p>Explore as áreas incluídas nesta modalidade.</p></div><MoreHorizontal size={18} className="muted-icon"/></div>
        <div className="quick-links">{quickModules.map(module=>{const item=MODULES[module];const Icon=item.icon;return <button key={module} onClick={()=>changeModule(module)}><span className={`quick-icon ${module}`}><Icon size={17}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowUpRight size={16}/></button>})}</div>
        <div className="tip-card"><Sparkles size={18}/><div><strong>Dica para explorar</strong><p>Experimente primeiro o agendamento público e depois confira como os atendimentos aparecem na agenda administrativa.</p></div></div>
      </section>
    </div>
  </>;
}
function AppointmentRows({appointments}) {
  return <div className="data-table">
    <div className="table-head appt-head"><span>Horário</span><span>Cliente</span><span>Serviço</span><span>Status</span></div>
    {appointments.map(item=><div className="table-row appt-head" key={item.id}>
      <span className="time-cell"><Clock3 size={14}/>{item.time}</span>
      <span className="client-cell"><span className="table-avatar">{item.client.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><span><strong>{item.client}</strong><small>{item.date}</small></span></span>
      <span className="service-cell">{item.service}</span>
      <span><StatusBadge status={item.status}/></span>
    </div>)}
  </div>;
}
function StatusBadge({status}) {
  const cls=status==='Confirmado'||status==='Pronto'||status==='Concluído'?'status-green':status==='Aguardando'||status==='Em preparo'?'status-amber':status==='Cancelado'?'status-red':'status-blue';
  return <span className={`status-badge ${cls}`}><span/>{status}</span>;
}
function SiteModule({activeDemo,siteSegment,setSiteSegment,onCta}) {
  const changeable=activeDemo.segment==='Vitrine';
  const selected=SEGMENTS[siteSegment]||SEGMENTS.Beauty;
  const businessType=siteSegment==='Beauty'?'beleza e estética':siteSegment==='Barber'?'barbearias':'alimentação';
  return <div className="landing-page-module">
    <section className="landing-purpose-section">
      <div className="landing-purpose-copy">
        <span className="landing-purpose-kicker">ENTENDA A SOLUÇÃO</span>
        <h2>O que é uma landing page?</h2>
        <p>É uma página criada para apresentar um negócio, produto ou serviço e conduzir quem visita até uma ação clara — por exemplo, chamar no WhatsApp, solicitar um orçamento ou agendar um horário.</p>
        <p>Em vez de tentar mostrar tudo, ela reúne as informações mais importantes em uma sequência objetiva: proposta, diferenciais, serviços, confiança e um próximo passo fácil de encontrar.</p>
        <div className="landing-purpose-points">
          <article><span>01</span><div><strong>Apresenta</strong><small>Mostra o que o negócio oferece e para quem.</small></div></article>
          <article><span>02</span><div><strong>Gera confiança</strong><small>Organiza imagens, informações, diferenciais e provas sociais.</small></div></article>
          <article><span>03</span><div><strong>Direciona</strong><small>Leva a pessoa ao contato, orçamento ou agendamento.</small></div></article>
        </div>
      </div>
      <aside className="landing-real-example">
        <span className="landing-real-label">PROJETO PUBLICADO</span>
        <div className="landing-real-mark"><Sparkles size={20}/></div>
        <h3>Danielly Oliveira Beauty Studio</h3>
        <p>Um exemplo real desenvolvido pela 2R Informática. A página apresenta a marca, os serviços e os canais de contato da profissional.</p>
        <a href="https://lavender-elephant-526438.hostingersite.com" target="_blank" rel="noopener noreferrer">Ver landing page funcional <ExternalLink size={16}/></a>
        <small>Abre em uma nova aba.</small>
      </aside>
    </section>

    <div className="landing-preview-heading">
      <div><span>EXEMPLO VISUAL</span><h3>Veja como uma página pode ser organizada.</h3><p>Alterne os segmentos para comparar estilos de apresentação e chamadas para ação.</p></div>
      <span className="landing-preview-tag">CONTEÚDO ILUSTRATIVO</span>
    </div>
    <div className={"landing-preview landing-" + siteSegment.toLowerCase()} style={{'--landing-accent':selected.accent,'--landing-secondary':selected.secondary}}>
      <div className="landing-preview-top">
        <div className="landing-preview-logo"><span>{siteSegment==='Beauty'?'SB':siteSegment==='Barber'?'BC':'BB'}</span><div><strong>{selected.customer}</strong><small>{siteSegment==='Beauty'?'BELEZA & ESTÉTICA':siteSegment==='Barber'?'BARBEARIA':'HAMBURGUERIA'}</small></div></div>
        <div className="landing-preview-nav"><span>Início</span><span>{siteSegment==='Burger'?'Destaques':'Serviços'}</span><span>Sobre</span><button onClick={onCta}>{selected.action}</button></div>
        <div className="landing-mobile-menu"><Menu size={19}/></div>
      </div>
      {changeable&&<div className="landing-switcher"><span><MonitorSmartphone size={15}/> Modelo de demonstração:</span>{Object.keys(SEGMENTS).map(segment=><button key={segment} onClick={()=>setSiteSegment(segment)} className={siteSegment===segment?'active':''}>{segment}</button>)}</div>}
      <div className="landing-hero">
        <div className="landing-copy"><span className="landing-kicker"><Sparkles size={14}/> {selected.short} · EXPERIÊNCIA DIGITAL</span><h2>{selected.hero}</h2><p>{selected.subtitle}</p><button className="landing-cta" onClick={onCta}>{selected.action}<ArrowRight size={16}/></button><div className="landing-social-proof"><span className="proof-avatars"><i>J</i><i>M</i><i>A</i></span><span><strong>Atendimento com carinho</strong><small>Uma experiência pensada para você</small></span></div></div>
        <div className="landing-visual"><div className={"landing-visual-main " + siteSegment.toLowerCase()}><div className="visual-abstract-circle"/><div className="visual-abstract-shape"/>{siteSegment==='Beauty'?<div className="beauty-illustration"><Sparkles size={52}/><span>BEAUTY</span></div>:siteSegment==='Barber'?<div className="barber-illustration"><Scissors size={58}/><span>YOUR STYLE</span></div>:<div className="burger-illustration"><ShoppingBag size={58}/><span>GOOD FOOD</span></div>}<div className="floating-rating"><Sparkles size={14}/><span>feito para seu negócio</span></div></div></div>
      </div>
      <div className="landing-services">
        <div><span className="landing-kicker">FEITO PARA FACILITAR</span><h3>{siteSegment==='Burger'?'Itens em destaque':'Conheça nossos serviços'}</h3></div>
        <div className="landing-service-list">{selected.services.map((s,i)=><div key={s[0]} className="landing-service-item"><span className="landing-service-number">0{i+1}</span><span><strong>{s[0]}</strong><small>{s[2]}</small></span><b>{s[1]}</b><ArrowUpRight size={15}/></div>)}</div>
      </div>
      <div className="landing-disclaimer"><Eye size={14}/> Prévia visual para o segmento de {businessType} · textos, serviços e valores fictícios · estrutura adaptável à identidade do cliente. {siteSegment==='Burger'?'Este exemplo não representa cardápio ou pedidos públicos: a operação do P16 é interna.':''}</div>
    </div>
  </div>;
}
function WhatsAppIcon({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374a9.822 9.822 0 0 1-1.51-5.258c.002-5.45 4.437-9.884 9.89-9.884 2.64.001 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.002 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.334.157 11.893c-.001 2.096.547 4.142 1.588 5.946L0 24l6.335-1.662a11.882 11.882 0 0 0 5.711 1.455h.005c6.554 0 11.89-5.334 11.893-11.893a11.821 11.821 0 0 0-3.48-8.412A11.815 11.815 0 0 0 12.05 0Z"/>
  </svg>;
}

function PortfolioHome({ onOpenCatalog }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  function closeMenu() { setMobileMenuOpen(false); }

  return <div className="portfolio-shell">
    <header className="portfolio-header">
      <div className="portfolio-header-inner">
        <a className="portfolio-brand" href="#inicio" onClick={closeMenu} aria-label="2R Informática — início">
          <img src="/2r-logo.png" alt="" />
          <span><strong>2R INFORMÁTICA</strong><small>Seu parceiro em Tecnologia</small></span>
        </a>
        <button className="portfolio-menu-toggle" type="button" onClick={() => setMobileMenuOpen(v => !v)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}>
          {mobileMenuOpen ? <X size={21}/> : <Menu size={21}/>}
        </button>
        <nav className={'portfolio-nav' + (mobileMenuOpen ? ' is-open' : '')} aria-label="Navegação principal">
          <a href="#solucoes" onClick={closeMenu}>Soluções</a>
          <a href="#projetos" onClick={closeMenu}>Projetos</a>
          <a href="#sobre" onClick={closeMenu}>Sobre mim</a>
          <a className="portfolio-nav-cta" href="#contato" onClick={closeMenu}>Vamos conversar <ArrowUpRight size={16}/></a>
        </nav>
      </div>
    </header>

    <main>
      <section className="portfolio-hero" id="inicio">
        <div className="portfolio-hero-grid" aria-hidden="true"></div>
        <div className="portfolio-container portfolio-hero-layout">
          <div className="portfolio-hero-copy">
            <div className="portfolio-eyebrow"><span className="portfolio-live-dot"></span> TECNOLOGIA • APLICAÇÕES WEB • INFRAESTRUTURA</div>
            <h1>Ideias em tecnologia.<br/><span>Soluções na prática.</span></h1>
            <p>Sou Ruan, da 2R Informática. Desenvolvo aplicações web que ajudam negócios a organizar a rotina, conectar informações e trabalhar com mais praticidade.</p>
            <div className="portfolio-hero-actions">
              <a className="portfolio-button portfolio-button-primary" href="#projetos">Explorar projetos <ArrowRight size={17}/></a>
              <a className="portfolio-button portfolio-button-secondary" href="https://wa.me/5567998042465?text=Ol%C3%A1%2C%20Ruan!%20Encontrei%20seu%20portf%C3%B3lio%20e%20gostaria%20de%20conversar." target="_blank" rel="noreferrer">Falar comigo <WhatsAppIcon size={17}/></a>
            </div>
            <div className="portfolio-quick-access" aria-label="Atalhos diretos para soluções">
              <a href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Todos')}}><span><CalendarDays size={17}/></span><b>Agendamentos</b><ArrowUpRight size={14}/></a>
              <a href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Todos')}}><span><Wallet size={17}/></span><b>Gestão e financeiro</b><ArrowUpRight size={14}/></a>
              <a href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Burger')}}><span><ShoppingBag size={17}/></span><b>Pedidos e estoque</b><ArrowUpRight size={14}/></a>
            </div>
          </div>
          <div className="portfolio-hero-visual">
            <div className="portfolio-photo-halo" aria-hidden="true"></div>
            <div className="portfolio-photo-frame">
              <img className="portfolio-profile-photo" src="/ruan-profile.webp" alt="Ruan Rodrigues, da 2R Informática" fetchPriority="high"/>
              <div className="portfolio-photo-overlay">
                <div className="portfolio-photo-logo"><img src="/2r-logo.png" alt=""/></div>
                <div><strong>Ruan Rodrigues</strong><span>Desenvolvimento web · Tecnologia</span></div>
              </div>
            </div>
            <div className="portfolio-hero-caption"><span className="portfolio-caption-line"></span> SEU PARCEIRO EM TECNOLOGIA</div>
          </div>
        </div>
      </section>

      <section className="portfolio-section portfolio-shortcuts-section" id="solucoes">
        <div className="portfolio-container">
          <div className="portfolio-section-heading portfolio-heading-row">
            <div><span className="portfolio-section-kicker">COMO POSSO AJUDAR</span><h2>Tecnologia com objetivo claro.</h2><p>Escolha o tipo de solução e vá direto ao que interessa.</p></div>
            <a className="portfolio-text-link" href="#projetos">Ver os projetos <ArrowRight size={16}/></a>
          </div>
          <div className="portfolio-service-grid">
            <a className="portfolio-service-card" href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Vitrine')}}><span className="portfolio-service-icon"><Code2 size={21}/></span><span className="portfolio-service-copy"><strong>Landing pages</strong><small>Páginas de apresentação para marcas e negócios.</small></span><ArrowUpRight className="portfolio-service-arrow" size={17}/></a>
            <a className="portfolio-service-card" href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Beauty')}}><span className="portfolio-service-icon"><CalendarDays size={21}/></span><span className="portfolio-service-copy"><strong>Beauty & estética</strong><small>Agendamento, gestão e financeiro.</small></span><ArrowUpRight className="portfolio-service-arrow" size={17}/></a>
            <a className="portfolio-service-card" href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Barber')}}><span className="portfolio-service-icon"><Scissors size={21}/></span><span className="portfolio-service-copy"><strong>Barbearias</strong><small>Agendamentos, serviços e gestão.</small></span><ArrowUpRight className="portfolio-service-arrow" size={17}/></a>
            <a className="portfolio-service-card" href="#projetos" onClick={(e)=>{e.preventDefault();onOpenCatalog('Burger')}}><span className="portfolio-service-icon"><ShoppingBag size={21}/></span><span className="portfolio-service-copy"><strong>Pedidos & alimentação</strong><small>Pedidos, produtos, estoque e financeiro.</small></span><ArrowUpRight className="portfolio-service-arrow" size={17}/></a>
          </div>
        </div>
      </section>

      <section className="portfolio-section portfolio-projects-section" id="projetos">
        <div className="portfolio-container">
          <div className="portfolio-section-heading portfolio-projects-heading">
            <div><span className="portfolio-section-kicker">SOLUÇÕES POR SEGMENTO</span><h2>Soluções para diferentes rotinas de negócio.</h2><p>Explore exemplos de apresentação, agendamento, operação interna e gestão para cada tipo de negócio.</p></div>
          </div>
          <div className="portfolio-project-grid">
            <article className="portfolio-project-card portfolio-project-beauty" id="projeto-beauty">
              <div className="portfolio-project-art portfolio-beauty-art"><div className="portfolio-art-window"><span></span><span></span><span></span></div><div className="portfolio-art-calendar"><div className="portfolio-calendar-top"><CalendarDays size={18}/><b>Agenda</b><span>DEMO</span></div><div className="portfolio-calendar-row"><i></i><span>09:00</span><b>Atendimento</b></div><div className="portfolio-calendar-row"><i></i><span>10:30</span><b>Procedimento</b></div><div className="portfolio-calendar-row"><i></i><span>13:00</span><b>Atendimento</b></div></div><div className="portfolio-art-bubble"><Sparkles size={18}/></div></div>
              <div className="portfolio-project-content"><div className="portfolio-project-meta"><span>AGENDAMENTO & GESTÃO</span><span className="portfolio-project-status"><i></i> DEMONSTRAÇÃO</span></div><h3>Beauty & estética</h3><p>Agendamento de serviços, disponibilidade de horários, administração da agenda, clientes e controle financeiro.</p><div className="portfolio-feature-tags"><span>Agenda online</span><span>Clientes</span><span>Financeiro</span></div><button className="portfolio-project-button" onClick={() => onOpenCatalog('Beauty')}>Ver modalidades <ArrowUpRight size={17}/></button></div>
            </article>
            <article className="portfolio-project-card portfolio-project-barber" id="projeto-barber">
              <div className="portfolio-project-art portfolio-barber-art"><div className="portfolio-barber-window"><div className="portfolio-barber-side"><Scissors size={23}/><span>BARBER STUDIO</span></div><div className="portfolio-barber-content"><div className="portfolio-barber-title"><b>Agenda do dia</b><small>Profissionais e horários</small></div><div className="portfolio-barber-appointment"><span>09:00</span><div><b>Serviço agendado</b><small>40 min · confirmado</small></div><i></i></div><div className="portfolio-barber-appointment"><span>10:00</span><div><b>Serviço agendado</b><small>30 min · confirmado</small></div><i></i></div></div></div><div className="portfolio-art-bubble portfolio-barber-bubble"><CheckCircle2 size={19}/></div></div>
              <div className="portfolio-project-content"><div className="portfolio-project-meta"><span>AGENDA & OPERAÇÃO</span><span className="portfolio-project-status"><i></i> DEMONSTRAÇÃO</span></div><h3>Barbearia</h3><p>Agenda com duração dos serviços, seleção de profissional, disponibilidade e área administrativa com gestão integrada.</p><div className="portfolio-feature-tags"><span>Profissionais</span><span>Disponibilidade</span><span>Gestão</span></div><button className="portfolio-project-button" onClick={() => onOpenCatalog('Barber')}>Ver modalidades <ArrowUpRight size={17}/></button></div>
            </article>
            <article className="portfolio-project-card portfolio-project-burger" id="projeto-burger">
              <div className="portfolio-project-art portfolio-burger-art"><div className="portfolio-burger-dashboard"><div className="portfolio-burger-dashboard-top"><span><ShoppingBag size={17}/><b>Pedidos</b></span><small>EXEMPLO</small></div><div className="portfolio-burger-order"><span>001</span><div><b>Pedido em andamento</b><small>Itens e status do pedido</small></div><i className="burger-state"></i></div><div className="portfolio-burger-order"><span>002</span><div><b>Pedido recebido</b><small>Estoque vinculado ao fluxo</small></div><i className="burger-state burger-state-warm"></i></div><div className="portfolio-burger-mini-stats"><div><small>Produtos</small><b>24</b></div><div><small>Pedidos</small><b>08</b></div><div><small>Estoque</small><b>Ativo</b></div></div></div></div>
              <div className="portfolio-project-content"><div className="portfolio-project-meta"><span>OPERAÇÃO & CONTROLE</span><span className="portfolio-project-status"><i></i> DEMONSTRAÇÃO</span></div><h3>Pedidos & alimentação</h3><p>Gestão de pedidos, produtos, movimentações de estoque e controles financeiros conectados à operação.</p><div className="portfolio-feature-tags"><span>Pedidos</span><span>Estoque</span><span>Financeiro</span></div><button className="portfolio-project-button" onClick={() => onOpenCatalog('Burger')}>Ver modalidades <ArrowUpRight size={17}/></button></div>
            </article>
          </div>
          <div className="portfolio-demo-note"><ShieldCheck size={18}/><p><strong>Ambiente de demonstração</strong> — os cadastros e movimentações apresentados são fictícios. As demonstrações servem para explorar os fluxos e funcionalidades.</p></div>
          <div className="portfolio-all-projects"><span>Quer comparar outras combinações de recursos?</span><button onClick={onOpenCatalog}>Ver todas as modalidades <ArrowRight size={16}/></button></div>
        </div>
      </section>

      <section className="portfolio-process-section">
        <div className="portfolio-container portfolio-process-layout">
          <div><span className="portfolio-section-kicker">MEU JEITO DE TRABALHAR</span><h2>Menos complicação.<br/><span>Mais clareza no dia a dia.</span></h2><p>A tecnologia precisa facilitar a rotina, não criar mais etapas. Por isso, a ideia é manter as informações acessíveis, os fluxos claros e as ações principais fáceis de encontrar — tanto no computador quanto no celular.</p><a className="portfolio-text-link" href="#contato">Vamos conversar sobre sua necessidade <ArrowRight size={16}/></a></div>
          <div className="portfolio-principles">
            <article><span>01</span><div><strong>Fluxos objetivos</strong><p>Ações principais visíveis, sem obrigar a pessoa a procurar onde começar.</p></div><CheckCircle2 size={18}/></article>
            <article><span>02</span><div><strong>Informações conectadas</strong><p>Quando o sistema permite, um registro alimenta as áreas relacionadas sem retrabalho desnecessário.</p></div><CheckCircle2 size={18}/></article>
            <article><span>03</span><div><strong>PC e celular desde o início</strong><p>Interfaces planejadas para telas grandes e pequenas, com os ajustes validados ao longo do projeto.</p></div><CheckCircle2 size={18}/></article>
          </div>
        </div>
      </section>

      <section className="portfolio-section portfolio-about-section" id="sobre">
        <div className="portfolio-container portfolio-about-layout">
          <div className="portfolio-about-mark"><img src="/2r-logo.png" alt="Logotipo da 2R Informática"/></div>
          <div><span className="portfolio-section-kicker">SOBRE A 2R INFORMÁTICA</span><h2>Tecnologia próxima, prática e feita para pessoas.</h2><p>Minha experiência une suporte técnico, redes, infraestrutura e desenvolvimento de aplicações web. Isso ajuda a enxergar tanto a parte técnica quanto o uso real das ferramentas no dia a dia do negócio.</p><p>O objetivo é construir soluções fáceis de entender, com funcionalidades úteis e espaço para evoluir conforme a necessidade.</p></div>
          <div className="portfolio-about-quote"><span>“</span><strong>Seu parceiro em Tecnologia.</strong><small>2R Informática</small></div>
        </div>
      </section>

      <section className="portfolio-contact-section" id="contato">
        <div className="portfolio-container portfolio-contact-layout">
          <div><span className="portfolio-section-kicker">VAMOS TIRAR A IDEIA DO PAPEL?</span><h2>Tem uma necessidade?<br/><span>Vamos pensar na solução.</span></h2><p>Converse comigo sobre uma aplicação web, uma melhoria de processo ou uma demanda de tecnologia para seu negócio.</p></div>
          <div className="portfolio-contact-actions">
            <a className="portfolio-button portfolio-button-primary portfolio-whatsapp-button" href="https://wa.me/5567998042465?text=Ol%C3%A1%2C%20Ruan!%20Encontrei%20seu%20portf%C3%B3lio%20e%20gostaria%20de%20conversar." target="_blank" rel="noreferrer" aria-label="Conversar com Ruan pelo WhatsApp no número (67) 99804-2465"><WhatsAppIcon size={19}/> Chamar no WhatsApp <span className="portfolio-whatsapp-number">(67) 99804-2465</span><ArrowUpRight size={16}/></a>
            <a className="portfolio-button portfolio-button-secondary" href="https://www.linkedin.com/in/ruanrodrigues2r/" target="_blank" rel="noreferrer"><Linkedin size={17}/> Perfil profissional <ArrowUpRight size={16}/></a>
          </div>
        </div>
      </section>
    </main>

    <footer className="portfolio-footer">
      <div className="portfolio-container portfolio-footer-inner">
        <a className="portfolio-brand portfolio-footer-brand" href="#inicio"><img src="/2r-logo.png" alt=""/><span><strong>2R INFORMÁTICA</strong><small>Seu parceiro em Tecnologia</small></span></a>
        <span>© {new Date().getFullYear()} 2R Informática. Tecnologia com propósito.</span>
        <button onClick={onOpenCatalog}>Ver modalidades de aplicações <ArrowUpRight size={15}/></button>
      </div>
    </footer>
  </div>;
}
