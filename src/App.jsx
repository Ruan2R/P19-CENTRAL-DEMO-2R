import { useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown,
  CircleDollarSign, ClipboardList, Clock3, Copy, CreditCard, ExternalLink, Eye,
  FileText, Filter, Grid2X2, LayoutDashboard, Menu, Package, Plus, Scissors,
  Search, Settings2, ShoppingBag, Sparkles, Store, Users, Wallet, X, Boxes,
  TrendingUp, ReceiptText, MonitorSmartphone, LockKeyhole, LogOut, ArrowUpRight,
  MoreHorizontal, CheckCircle2, Clock, CircleAlert, RefreshCw
} from 'lucide-react';

const PASSWORD = '2Rdemo26';

const DEMOS = [
  { id:'landing', name:'2R Landing Pages', user:'landing', segment:'Vitrine', title:'Landing pages', description:'Apresente os três modelos de página e alterne entre Beauty, Barber e Burger sem trocar de acesso.', modules:['site'], highlight:'Modelos de apresentação', color:'blue', icon:'site' },
  { id:'beauty.agenda', name:'2R Beauty Agenda', user:'beauty.agenda', segment:'Beauty', title:'Agendamentos e administração básica', description:'Agendamento público para clientes, agenda do dia, serviços e cadastros fictícios para apresentar a rotina de uma profissional.', modules:['overview','booking','appointments','clients','services'], color:'rose', icon:'beauty' },
  { id:'beauty.financeiro', name:'2R Beauty Financeiro', user:'beauty.financeiro', segment:'Beauty', title:'Financeiro', description:'Demonstração isolada de receitas, despesas, movimentações e resumo do período.', modules:['finance'], color:'rose', icon:'finance' },
  { id:'beauty.siteagenda', name:'2R Beauty Web + Agenda', user:'beauty.siteagenda', segment:'Beauty', title:'Landing page + agendamentos', description:'Página pública para apresentar serviços e um fluxo de agendamento demonstrativo.', modules:['site','booking','appointments','clients','services'], color:'rose', icon:'site' },
  { id:'beauty.agenda.financeiro', name:'2R Beauty Gestão', user:'beauty.agenda.financeiro', segment:'Beauty', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda administrativa, clientes, serviços e financeiro; sem landing page de marketing neste pacote.', modules:['overview','booking','appointments','clients','services','finance'], color:'rose', icon:'finance' },
  { id:'beauty.completo', name:'2R Beauty Completo', user:'beauty.completo', segment:'Beauty', title:'Solução completa Beauty', description:'Experiência completa com landing page, agendamentos, gestão administrativa e financeiro.', modules:['site','overview','booking','appointments','clients','services','finance'], color:'rose', icon:'sparkles' },
  { id:'barber.agenda', name:'2R Barber Agenda', user:'barber.agenda', segment:'Barber', title:'Agendamentos e administração', description:'Agendamento público para clientes, agenda administrativa, procedimentos, profissionais e gestão básica de uma barbearia.', modules:['overview','booking','appointments','clients','services'], color:'amber', icon:'barber' },
  { id:'barber.siteagenda', name:'2R Barber Web + Agenda', user:'barber.siteagenda', segment:'Barber', title:'Landing page + agendamentos', description:'Página de apresentação da barbearia integrada ao exemplo de agendamentos.', modules:['site','booking','appointments','clients','services'], color:'amber', icon:'site' },
  { id:'barber.agenda.financeiro', name:'2R Barber Gestão', user:'barber.agenda.financeiro', segment:'Barber', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda, serviços, clientes e financeiro para demonstrar uma gestão mais completa.', modules:['overview','booking','appointments','clients','services','finance'], color:'amber', icon:'finance' },
  { id:'barber.completo', name:'2R Barber Completo', user:'barber.completo', segment:'Barber', title:'Solução completa Barber', description:'Landing page, agendamentos e administração completa com dados de demonstração.', modules:['site','overview','booking','appointments','clients','services','finance'], color:'amber', icon:'sparkles' },
  { id:'burger.pedidos', name:'2R Burger Pedidos', user:'burger.pedidos', segment:'Burger', title:'Pedidos e operação', description:'Cardápio público para montar pedidos, acompanhar a operação e explorar produtos e estoque de uma hamburgueria ou adega.', modules:['overview','orderPublic','orders','products','inventory'], color:'orange', icon:'orders' },
  { id:'burger.gestao', name:'2R Burger Gestão', user:'burger.gestao', segment:'Burger', title:'Financeiro, produtos e estoque', description:'Controle demonstrativo de produtos, estoque e movimentações financeiras.', modules:['overview','finance','products','inventory'], color:'orange', icon:'inventory' },
  { id:'burger.completo', name:'2R Burger Completo', user:'burger.completo', segment:'Burger', title:'Solução completa Burger', description:'Landing page, pedidos, produtos, estoque e financeiro reunidos em uma demonstração.', modules:['site','overview','orderPublic','orders','products','inventory','finance'], color:'orange', icon:'sparkles' },
];

const MODULES = {
  site: { label:'Landing page', icon:Store, description:'Página pública de apresentação' },
  overview: { label:'Visão geral', icon:LayoutDashboard, description:'Resumo da operação' },
  booking: { label:'Agendamento público', icon:CalendarDays, description:'Página do cliente para escolher serviço e horário' },
  appointments: { label:'Agendamentos', icon:CalendarDays, description:'Agenda e atendimentos' },
  orderPublic: { label:'Cardápio e pedidos', icon:ShoppingBag, description:'Experiência pública para selecionar produtos e enviar pedido' },
  clients: { label:'Clientes', icon:Users, description:'Base de clientes fictícios' },
  services: { label:'Serviços', icon:Scissors, description:'Procedimentos e duração' },
  finance: { label:'Financeiro', icon:Wallet, description:'Receitas, despesas e saldo' },
  orders: { label:'Pedidos', icon:ClipboardList, description:'Acompanhamento dos pedidos' },
  products: { label:'Produtos', icon:Package, description:'Catálogo demonstrativo' },
  inventory: { label:'Estoque', icon:Boxes, description:'Entradas e quantidades' },
};

const SEGMENTS = {
  Beauty: { short:'BEAUTY', customer:'Studio Bella', subtitle:'Beleza, cuidado e praticidade em um só lugar.', accent:'#b76d8f', secondary:'#f8edf2', services:[['Maquiagem social','R$ 160,00','40 min'],['Design de sobrancelhas','R$ 40,00','40 min'],['Lash lifting','R$ 150,00','1h 30min']], hero:'Seu momento de beleza começa aqui.', action:'Agendar horário' },
  Barber: { short:'BARBER', customer:'Barber Club', subtitle:'Seu estilo. Seu horário. Seu momento.', accent:'#bd954e', secondary:'#f8f2e6', services:[['Corte degradê','R$ 55,00','40 min'],['Barba completa','R$ 35,00','30 min'],['Corte + barba','R$ 80,00','1h']], hero:'Seu próximo corte começa aqui.', action:'Agendar corte' },
  Burger: { short:'BURGER', customer:'Brasa Burger', subtitle:'Feito na brasa, pensado para matar sua fome.', accent:'#d8753d', secondary:'#fff0e5', services:[['Smash clássico','R$ 29,90','Pedido'],['Combo Brasa','R$ 39,90','Pedido'],['Batata crocante','R$ 14,90','Pedido']], hero:'Seu próximo burger favorito está aqui.', action:'Ver cardápio' },
};

const INITIAL_APPOINTMENTS = [
  { id:1, client:'Mariana Costa', service:'Maquiagem social', time:'09:00', date:'Hoje', status:'Confirmado', price:160 },
  { id:2, client:'Camila Oliveira', service:'Design de sobrancelhas', time:'10:30', date:'Hoje', status:'Confirmado', price:40 },
  { id:3, client:'Juliana Martins', service:'Lash lifting', time:'13:00', date:'Hoje', status:'Aguardando', price:150 },
  { id:4, client:'Bianca Souza', service:'Design de sobrancelhas', time:'15:00', date:'Hoje', status:'Confirmado', price:40 },
];
const INITIAL_ORDERS = [
  { id:101, code:'001', table:'Mesa 02', items:'2x Smash clássico, 1x Batata', total:74.70, status:'Em preparo' },
  { id:102, code:'002', table:'Balcão', items:'1x Combo Brasa', total:39.90, status:'Novo' },
  { id:103, code:'003', table:'Mesa 05', items:'1x Smash duplo, 2x Refrigerante', total:67.80, status:'Pronto' },
];
const INITIAL_PRODUCTS = [
  { id:1, name:'Pão brioche', category:'Estoque', stock:24, unit:'un.', price:3.5 },
  { id:2, name:'Blend 160g', category:'Estoque', stock:18, unit:'un.', price:8.9 },
  { id:3, name:'Queijo cheddar', category:'Estoque', stock:32, unit:'fatias', price:1.2 },
  { id:4, name:'Smash clássico', category:'Produção sob pedido', stock:null, unit:'pedido', price:29.9 },
];
const INITIAL_TRANSACTIONS = [
  { id:1, description:'Atendimentos do dia', category:'Receita', date:'Hoje', value:890 },
  { id:2, description:'Compra de materiais', category:'Despesa', date:'Ontem', value:145 },
  { id:3, description:'Serviços realizados', category:'Receita', date:'Ontem', value:540 },
  { id:4, description:'Reposição de produtos', category:'Despesa', date:'27 out.', value:220 },
];
const CLIENTS = [
  { name:'Mariana Costa', contact:'(67) 9 0000-0001', visits:8, last:'Hoje' },
  { name:'Camila Oliveira', contact:'(67) 9 0000-0002', visits:5, last:'Hoje' },
  { name:'Juliana Martins', contact:'(67) 9 0000-0003', visits:11, last:'Ontem' },
  { name:'Bianca Souza', contact:'(67) 9 0000-0004', visits:3, last:'27 out.' },
];
const SERVICES = [
  { name:'Maquiagem social', duration:'40 min', price:160, type:'Beleza' },
  { name:'Design de sobrancelhas', duration:'40 min', price:40, type:'Sobrancelhas' },
  { name:'Lash lifting', duration:'1h 30min', price:150, type:'Cílios' },
  { name:'Tintura de sobrancelhas', duration:'20 min', price:20, type:'Sobrancelhas' },
];
const BARBER_SERVICES = [
  { name:'Corte degradê', duration:'40 min', price:55, type:'Cortes' },
  { name:'Barba completa', duration:'30 min', price:35, type:'Barba' },
  { name:'Corte + barba', duration:'1h', price:80, type:'Combos' },
  { name:'Acabamento', duration:'15 min', price:20, type:'Finalização' },
  { name:'Sobrancelha', duration:'15 min', price:15, type:'Acabamento' },
];
const BARBER_CLIENTS = [
  { name:'Lucas Mendes', contact:'(67) 9 0000-0101', visits:12, last:'Hoje' },
  { name:'Pedro Henrique', contact:'(67) 9 0000-0102', visits:7, last:'Hoje' },
  { name:'André Costa', contact:'(67) 9 0000-0103', visits:4, last:'Ontem' },
  { name:'Rafael Martins', contact:'(67) 9 0000-0104', visits:16, last:'27 out.' },
];
const BARBER_APPOINTMENTS = [
  { id:21, client:'Lucas Mendes', service:'Corte degradê', time:'09:00', date:'Hoje', status:'Confirmado', price:55, professional:'Felipe' },
  { id:22, client:'Pedro Henrique', service:'Barba completa', time:'10:00', date:'Hoje', status:'Confirmado', price:35, professional:'Vitória' },
  { id:23, client:'André Costa', service:'Corte + barba', time:'11:30', date:'Hoje', status:'Aguardando', price:80, professional:'Felipe' },
  { id:24, client:'Rafael Martins', service:'Corte degradê', time:'14:00', date:'Hoje', status:'Confirmado', price:55, professional:'Felipe' },
];
const BARBER_TRANSACTIONS = [
  { id:21, description:'Cortes e serviços do dia', category:'Receita', date:'Hoje', value:620 },
  { id:22, description:'Compra de produtos de barbearia', category:'Despesa', date:'Ontem', value:180 },
  { id:23, description:'Atendimentos de sábado', category:'Receita', date:'25 out.', value:840 },
  { id:24, description:'Materiais de consumo', category:'Despesa', date:'24 out.', value:95 },
];
const BURGER_TRANSACTIONS = [
  { id:31, description:'Pedidos do salão e balcão', category:'Receita', date:'Hoje', value:684.50 },
  { id:32, description:'Compra de ingredientes', category:'Despesa', date:'Ontem', value:246.80 },
  { id:33, description:'Pedidos delivery', category:'Receita', date:'Ontem', value:428.90 },
  { id:34, description:'Embalagens e descartáveis', category:'Despesa', date:'27 out.', value:86.40 },
];
const BURGER_MENU = [
  { id:1, name:'Smash clássico', description:'Pão brioche, blend artesanal, queijo e molho da casa.', price:29.90, category:'Hambúrgueres' },
  { id:2, name:'Combo Brasa', description:'Smash clássico com batata crocante e bebida.', price:39.90, category:'Combos' },
  { id:3, name:'Smash duplo', description:'Dois blends, queijo cheddar e molho especial.', price:36.90, category:'Hambúrgueres' },
  { id:4, name:'Batata crocante', description:'Porção individual com tempero da casa.', price:14.90, category:'Acompanhamentos' },
  { id:5, name:'Refrigerante lata', description:'Bebida gelada 350 ml.', price:6.00, category:'Bebidas' },
];
function getSeedData(segment) {
  const seed = segment === 'Barber'
    ? { appointments:BARBER_APPOINTMENTS, clients:BARBER_CLIENTS, services:BARBER_SERVICES, transactions:BARBER_TRANSACTIONS, orders:INITIAL_ORDERS, products:INITIAL_PRODUCTS }
    : segment === 'Burger'
      ? { appointments:[], clients:[], services:[], transactions:BURGER_TRANSACTIONS, orders:INITIAL_ORDERS, products:INITIAL_PRODUCTS }
      : { appointments:INITIAL_APPOINTMENTS, clients:CLIENTS, services:SERVICES, transactions:INITIAL_TRANSACTIONS, orders:INITIAL_ORDERS, products:INITIAL_PRODUCTS };
  return Object.fromEntries(Object.entries(seed).map(([key,values]) => [key, values.map(item => ({...item}))]));
}
function currentDateLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' }).replace(/^./, c => c.toUpperCase());
}
function localDateValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0,10);
}

function money(value) { return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function IconForDemo({ demo }) {
  const Icon = demo.icon === 'beauty' ? Sparkles : demo.icon === 'barber' ? Scissors : demo.icon === 'orders' ? ShoppingBag : demo.icon === 'inventory' ? Boxes : demo.icon === 'finance' ? Wallet : demo.icon === 'site' ? MonitorSmartphone : demo.icon === 'sparkles' ? Sparkles : Grid2X2;
  return <Icon size={20} strokeWidth={1.8} />;
}
function getStartModule(demo) { return demo.modules[0] === 'site' && demo.modules.length > 1 ? 'site' : demo.modules[0]; }

export default function App() {
  const [activeDemo, setActiveDemo] = useState(null);
  const [activeModule, setActiveModule] = useState('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [showAccessDetails, setShowAccessDetails] = useState(true);
  const [copied, setCopied] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [clients, setClients] = useState(CLIENTS);
  const [services, setServices] = useState(SERVICES);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [siteSegment, setSiteSegment] = useState('Beauty');
  const [appointmentForm, setAppointmentForm] = useState({client:'',service:'Design de sobrancelhas',time:'16:00'});
  const [transactionForm, setTransactionForm] = useState({description:'',category:'Receita',value:''});

  const visibleDemos = useMemo(() => DEMOS.filter(demo => {
    const matchesText = `${demo.name} ${demo.title} ${demo.description} ${demo.user}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'Todos' || demo.segment === filter;
    return matchesText && matchesFilter;
  }), [search, filter]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  }
  async function copyText(value, key) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      notify(`Copie manualmente: ${value}`);
    }
  }
  function enterDemo(demo) {
    const seed = getSeedData(demo.segment === 'Vitrine' ? 'Beauty' : demo.segment);
    setActiveDemo(demo);
    setActiveModule(getStartModule(demo));
    setSiteSegment(demo.segment === 'Vitrine' ? 'Beauty' : demo.segment);
    setAppointments(seed.appointments);
    setOrders(seed.orders);
    setProducts(seed.products);
    setTransactions(seed.transactions);
    setClients(seed.clients);
    setServices(seed.services);
    setAppointmentForm({client:'',service:seed.services[0]?.name || '',time:'16:00'});
    setTransactionForm({description:'',category:'Receita',value:''});
    setMobileNav(false);
    setModal(null);
  }
  function exitDemo() { setActiveDemo(null); setMobileNav(false); }
  function canUse(module) { return activeDemo?.modules.includes(module); }
  function changeModule(module) { setActiveModule(module); setMobileNav(false); }

  if (!activeDemo) {
    return <div className="app-shell hub-shell">
      <header className="topbar hub-topbar">
        <div className="brand-lockup"><div className="brand-mark">2R</div><div><div className="brand-name">2R INFORMÁTICA</div><div className="brand-tagline">Seu parceiro em Tecnologia</div></div></div>
        <div className="topbar-right"><span className="demo-pill"><span className="pulse-dot"/> AMBIENTE DE DEMONSTRAÇÃO</span><div className="user-avatar">RC</div></div>
      </header>
      <main className="hub-main">
        <section className="hero-banner">
          <div className="hero-content">
            <div className="eyebrow"><Sparkles size={14}/> CENTRAL COMERCIAL 2R</div>
            <h1>Uma solução para<br/><span>cada tipo de negócio.</span></h1>
            <p>Escolha um dos ambientes para apresentar o sistema. Cada acesso abre um pacote de funcionalidades com dados demonstrativos.</p>
            <div className="hero-mini-stats"><div><strong>13</strong><span>acessos preparados</span></div><div className="hero-stat-separator"/><div><strong>3</strong><span>segmentos principais</span></div><div className="hero-stat-separator"/><div><strong>1</strong><span>central de demonstração</span></div></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-core"><span>2R</span><small>TECNOLOGIA</small></div><div className="float-card float-beauty"><Sparkles size={17}/><span>Beauty</span></div><div className="float-card float-barber"><Scissors size={17}/><span>Barber</span></div><div className="float-card float-burger"><ShoppingBag size={17}/><span>Burger</span></div></div>
        </section>

        <section className="catalog-section">
          <div className="section-heading"><div><div className="eyebrow muted-eyebrow">CATÁLOGO DE ACESSOS</div><h2>Qual solução vamos mostrar?</h2><p>As descrições ficam aqui para você localizar o pacote rapidamente durante a apresentação.</p></div><div className="catalog-count"><strong>{visibleDemos.length.toString().padStart(2,'0')}</strong><span>opções</span></div></div>
          <div className="catalog-toolbar"><label className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, módulo ou usuário..."/><kbd>⌕</kbd></label><div className="filter-pills" aria-label="Filtrar por segmento">{['Todos','Vitrine','Beauty','Barber','Burger'].map(item=><button key={item} className={`filter-pill ${filter===item?'selected':''}`} onClick={()=>setFilter(item)}>{item}</button>)}</div></div>
          {['Vitrine','Beauty','Barber','Burger'].filter(group=>filter==='Todos'||filter===group).map(group=>{
            const list=visibleDemos.filter(d=>d.segment===group);
            if (!list.length) return null;
            return <div className="segment-group" key={group}><div className="segment-heading"><div className={`segment-icon ${group.toLowerCase()}`}>{group==='Vitrine'?<MonitorSmartphone size={18}/>:group==='Beauty'?<Sparkles size={18}/>:group==='Barber'?<Scissors size={18}/>:<ShoppingBag size={18}/>}</div><div><h3>{group==='Vitrine'?'Modelos de landing page':group==='Beauty'?'Beauty & estética':group==='Barber'?'Barbearia':'Pedidos & alimentação'}</h3><p>{group==='Vitrine'?'Demonstre diferentes estilos de página':group==='Beauty'?'Agenda, gestão e financeiro para profissionais da beleza':group==='Barber'?'Agenda e gestão para barbearias':'Pedidos, produtos, estoque e financeiro'}</p></div><span className="group-count">{list.length} {list.length===1?'acesso':'acessos'}</span></div>
              <div className="demo-grid">{list.map((demo,index)=><article className={`demo-card ${demo.color}`} key={demo.id} style={{'--card-index':index}}><div className="demo-card-top"><div className={`demo-card-icon ${demo.color}`}><IconForDemo demo={demo}/></div><span className="demo-segment-tag">{demo.segment==='Vitrine'?'LANDING PAGE':demo.segment.toUpperCase()}</span><button className="icon-quiet" title="Copiar usuário" onClick={()=>copyText(demo.user,demo.id)}>{copied===demo.id?<Check size={16}/>:<Copy size={16}/>}</button></div><h4>{demo.name}</h4><div className="demo-card-title">{demo.title}</div><p>{demo.description}</p><div className="module-chips">{demo.modules.filter(m=>m!=='overview').slice(0,4).map(m=><span key={m}>{MODULES[m].label}</span>)}{demo.modules.filter(m=>m!=='overview').length>4&&<span>+{demo.modules.filter(m=>m!=='overview').length-4}</span>}</div>
                {showAccessDetails&&<div className="credential-row"><span><LockKeyhole size={13}/> {demo.user}</span><button onClick={()=>copyText(demo.user,demo.id)}>{copied===demo.id?'Copiado':'Copiar usuário'}</button></div>}
                <button className="enter-demo-button" onClick={()=>enterDemo(demo)}><span>Acessar demonstração</span><ArrowUpRight size={17}/></button></article>)}</div>
            </div>;
          })}
          {visibleDemos.length===0&&<div className="empty-state"><Search size={28}/><strong>Nenhum acesso encontrado</strong><span>Tente outro nome ou segmento.</span></div>}
        </section>

        <section className="access-note"><div className="access-note-icon"><LockKeyhole size={20}/></div><div className="access-note-copy"><strong>Credenciais rápidas para apresentação</strong><p>Todos os perfis usam a mesma senha de demonstração. Os cartões entram direto no ambiente escolhido para agilizar a gravação e as apresentações.</p><div className="shared-password"><span>Senha padrão</span><code>{PASSWORD}</code><button onClick={()=>copyText(PASSWORD,'password')}>{copied==='password'?<Check size={14}/>:<Copy size={14}/>} {copied==='password'?'Copiada':'Copiar senha'}</button></div></div><button className="details-toggle" onClick={()=>setShowAccessDetails(v=>!v)}>{showAccessDetails?'Ocultar usuários':'Mostrar usuários'}<ChevronDown size={16} className={showAccessDetails?'rotated':''}/></button></section>
      </main>
      <footer className="footer"><span>2R INFORMÁTICA · Seu parceiro em Tecnologia</span><span><span className="footer-dot"/> Dados fictícios para demonstração</span></footer>
      {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>;
  }

  const currentModules = activeDemo.modules;
  const activeSegment = SEGMENTS[siteSegment] || SEGMENTS.Beauty;
  const isBurger = activeDemo.segment === 'Burger';
  const isBarber = activeDemo.segment === 'Barber';
  const segmentLabel = isBurger ? 'Burger' : isBarber ? 'Barber' : 'Beauty';

  return <div className={`app-shell demo-app ${activeDemo.color}`}>
    <header className="topbar demo-topbar"><div className="brand-lockup"><button className="mobile-menu icon-quiet" onClick={()=>setMobileNav(v=>!v)} aria-label="Abrir menu"><Menu size={20}/></button><div className="brand-mark">2R</div><div><div className="brand-name">2R INFORMÁTICA</div><div className="brand-tagline">Central de demonstrações</div></div></div><div className="demo-topbar-right"><span className={`workspace-badge ${activeDemo.color}`}><span className="workspace-dot"/>{activeDemo.segment==='Vitrine'?'LANDING PAGES':activeDemo.segment.toUpperCase()}</span><button className="back-hub-button" onClick={exitDemo}><ArrowLeft size={16}/><span>Todos os acessos</span></button><div className="user-avatar">2R</div></div></header>
    <div className="demo-layout">
      <aside className={`sidebar ${mobileNav?'show-mobile':''}`}><div className="sidebar-workspace"><div className={`workspace-avatar ${activeDemo.color}`}><IconForDemo demo={activeDemo}/></div><div className="workspace-meta"><strong>{activeDemo.name}</strong><span>Ambiente de demonstração</span></div><button className="icon-quiet sidebar-close" onClick={()=>setMobileNav(false)}><X size={17}/></button></div><div className="sidebar-section-label">MENU DO SISTEMA</div><nav className="side-nav">{currentModules.map(module=>{const item=MODULES[module];const Icon=item.icon;return <button key={module} className={`side-nav-item ${activeModule===module?'active':''}`} onClick={()=>changeModule(module)}><Icon size={18}/><span>{item.label}</span>{activeModule===module&&<span className="nav-active-mark"/>}</button>})}</nav><div className="sidebar-bottom"><div className="demo-data-note"><div><Sparkles size={15}/><strong>Modo demonstração</strong></div><p>Alterações feitas aqui usam dados fictícios e temporários.</p></div><button className="side-nav-item exit-item" onClick={exitDemo}><LogOut size={18}/><span>Trocar de demonstração</span></button></div></aside>
      {mobileNav&&<button className="mobile-scrim" aria-label="Fechar menu" onClick={()=>setMobileNav(false)}/>}
      <main className="demo-main">
        <div className="demo-breadcrumb"><span>Central 2R</span><ArrowRight size={13}/><span>{activeDemo.segment}</span><ArrowRight size={13}/><strong>{MODULES[activeModule]?.label || 'Demonstração'}</strong></div>
        <div className="main-title-row"><div><div className="eyebrow muted-eyebrow">{activeDemo.name.toUpperCase()}</div><h1>{activeModule==='site'?'Experiência pública':MODULES[activeModule]?.label || activeDemo.title}</h1><p>{activeModule==='site'?'Visualize a página que pode ser apresentada ao cliente.':MODULES[activeModule]?.description || activeDemo.description}</p></div><div className="main-title-actions"><span className="fake-live"><span className="pulse-dot"/> DEMO ATIVA</span><button className="secondary-button" onClick={exitDemo}><Grid2X2 size={16}/> Catálogo</button></div></div>
        {activeModule==='site'&&<SiteModule activeDemo={activeDemo} siteSegment={siteSegment} setSiteSegment={setSiteSegment} activeSegment={activeSegment} onCta={()=>{if(activeDemo.segment==='Burger'&&canUse('orderPublic'))changeModule('orderPublic');else if(canUse('booking'))changeModule('booking');else notify('Esta é uma prévia visual. O fluxo interativo está disponível nos pacotes com agendamento ou pedidos.');}} />}
        {activeModule==='overview'&&<OverviewModule demo={activeDemo} appointments={appointments} orders={orders} products={products} transactions={transactions} changeModule={changeModule}/>} 
         {activeModule==='booking'&&<PublicBookingModule segment={segmentLabel} services={services} onBook={(payload)=>{const service=services.find(item=>item.name===payload.service);setAppointments(prev=>[...prev,{id:Date.now(),client:payload.client,contact:payload.contact,service:payload.service,time:payload.time,date:payload.date,status:'Confirmado',price:service?.price||0,professional:payload.professional}].sort((a,b)=>a.time.localeCompare(b.time)));setClients(prev=>prev.some(item=>item.name.toLowerCase()===payload.client.toLowerCase())?prev:[{name:payload.client,contact:payload.contact,visits:1,last:'Hoje'},...prev]);notify('Agendamento fictício confirmado e enviado para a agenda administrativa.');}} />}
         {activeModule==='orderPublic'&&<PublicOrderingModule onPlaceOrder={(payload)=>{const nextNumber=orders.reduce((max,item)=>Math.max(max,Number(item.code)||0),0)+1;setOrders(prev=>[...prev,{id:Date.now(),code:String(nextNumber).padStart(3,'0'),table:payload.place,items:payload.items,total:payload.total,status:'Novo',customer:payload.customer}]);notify('Pedido fictício enviado para a central de pedidos.');}} />}
        {activeModule==='appointments'&&<AppointmentsModule appointments={appointments} setAppointments={setAppointments} openModal={()=>setModal('appointment')} isBarber={isBarber} resetAppointments={()=>setAppointments(getSeedData(activeDemo.segment).appointments)} />}
        {activeModule==='clients'&&<ClientsModule clients={clients} />}
        {activeModule==='services'&&<ServicesModule services={services} />}
        {activeModule==='finance'&&<FinanceModule transactions={transactions} setTransactions={setTransactions} openModal={()=>setModal('transaction')} resetTransactions={()=>setTransactions(getSeedData(activeDemo.segment).transactions)} />}
        {activeModule==='orders'&&<OrdersModule orders={orders} setOrders={setOrders} />}
        {activeModule==='products'&&<ProductsModule products={products} />}
        {activeModule==='inventory'&&<InventoryModule products={products} setProducts={setProducts} />}
        <div className="demo-footer-note"><LockKeyhole size={14}/><span>Esta tela usa dados fictícios de apresentação. Não representa informações de clientes reais.</span><button onClick={()=>copyText(activeDemo.user,'demoUser')}><Copy size={13}/>{copied==='demoUser'?'Usuário copiado':`Usuário: ${activeDemo.user}`}</button></div>
      </main>
    </div>
    {modal==='appointment'&&<Modal title="Novo agendamento de demonstração" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();setAppointments(prev=>[...prev,{id:Date.now(),client:appointmentForm.client||'Cliente demonstrativo',service:appointmentForm.service,time:appointmentForm.time,date:'Hoje',status:'Aguardando',price:services.find(s=>s.name===appointmentForm.service)?.price||40}].sort((a,b)=>a.time.localeCompare(b.time)));setModal(null);notify('Agendamento fictício adicionado.')}}><label>Nome do cliente<input value={appointmentForm.client} onChange={e=>setAppointmentForm({...appointmentForm,client:e.target.value})} placeholder="Ex.: Ana Martins"/></label><div className="form-grid"><label>Serviço<select value={appointmentForm.service} onChange={e=>setAppointmentForm({...appointmentForm,service:e.target.value})}>{services.map(s=><option key={s.name}>{s.name}</option>)}</select></label><label>Horário<input type="time" value={appointmentForm.time} onChange={e=>setAppointmentForm({...appointmentForm,time:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="primary-button"><Plus size={16}/> Adicionar exemplo</button></div></form></Modal>}
    {modal==='transaction'&&<Modal title="Novo lançamento de demonstração" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const value=Number(String(transactionForm.value).replace(',','.'));if(!transactionForm.description||!Number.isFinite(value)||value<=0){notify('Preencha a descrição e um valor válido.');return;}setTransactions(prev=>[{id:Date.now(),description:transactionForm.description,category:transactionForm.category,date:'Hoje',value},...prev]);setModal(null);setTransactionForm({description:'',category:'Receita',value:''});notify('Lançamento fictício adicionado.')}}><label>Descrição<input value={transactionForm.description} onChange={e=>setTransactionForm({...transactionForm,description:e.target.value})} placeholder="Ex.: Venda de serviço" required/></label><div className="form-grid"><label>Tipo<select value={transactionForm.category} onChange={e=>setTransactionForm({...transactionForm,category:e.target.value})}><option>Receita</option><option>Despesa</option></select></label><label>Valor (R$)<input inputMode="decimal" value={transactionForm.value} onChange={e=>setTransactionForm({...transactionForm,value:e.target.value})} placeholder="0,00" required/></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="primary-button"><Plus size={16}/> Adicionar lançamento</button></div></form></Modal>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function MetricCard({label,value,delta,icon:Icon,kind='blue',footnote}) { return <div className="metric-card"><div className={`metric-icon ${kind}`}><Icon size={19}/></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><div className="metric-foot"><span className={delta?.startsWith('-')?'negative':'positive'}>{delta}</span>{footnote&&<span>{footnote}</span>}</div></div>; }
function OverviewModule({demo,appointments,orders,products,transactions,changeModule}) {
  const burger=demo.segment==='Burger';
  const hasOrders=demo.modules.includes('orders');
  const inMoney=transactions.filter(t=>t.category==='Receita').reduce((s,t)=>s+t.value,0);
  const outMoney=transactions.filter(t=>t.category==='Despesa').reduce((s,t)=>s+t.value,0);
  const revenue=hasOrders?orders.reduce((s,o)=>s+o.total,0):inMoney;
  const waiting=hasOrders?orders.filter(o=>o.status==='Novo').length:appointments.filter(a=>a.status==='Aguardando').length;
  const quickModules=demo.modules.filter(m=>m!=='overview').slice(0,4);
  const overviewTitle=burger?(hasOrders?'Pedidos recentes':'Posição do estoque'):'Próximos agendamentos';
  const overviewDescription=burger?(hasOrders?'Acompanhe o andamento dos pedidos de exemplo.':'Confira os produtos com controle de quantidade.'):'Visualização rápida da agenda demonstrativa.';
  const viewAllModule=burger?(hasOrders?'orders':'inventory'):'appointments';
  return <>
    <div className="welcome-strip"><div className="welcome-icon"><Activity size={19}/></div><div><strong>Bom dia! Bem-vindo à demonstração.</strong><p>Este painel contém movimentações e cadastros fictícios para você explorar o pacote.</p></div><span className="sample-tag"><BadgeCheck size={14}/> EXEMPLO</span></div>
    <div className="metric-grid">
      {burger&&hasOrders ? <>
        <MetricCard label="Pedidos do exemplo" value={orders.length.toString().padStart(2,'0')} delta={waiting+' novo(s)'} icon={ShoppingBag} kind="orange" footnote="para acompanhar"/>
        <MetricCard label="Vendas em pedidos" value={money(revenue)} delta="Pedidos fictícios" icon={CircleDollarSign} kind="green" footnote="valor ilustrativo"/>
        <MetricCard label="Produtos cadastrados" value={products.length.toString().padStart(2,'0')} delta="Catálogo de exemplo" icon={Package} kind="blue" footnote="itens"/>
        <MetricCard label="Itens com estoque" value={products.filter(p=>p.stock!==null).length.toString().padStart(2,'0')} delta="Controlados" icon={Boxes} kind="purple" footnote="produtos"/>
      </> : burger ? <>
        <MetricCard label="Receitas lançadas" value={money(inMoney)} delta="Entradas fictícias" icon={TrendingUp} kind="green" footnote="valores de exemplo"/>
        <MetricCard label="Despesas lançadas" value={money(outMoney)} delta="Saídas fictícias" icon={CreditCard} kind="rose" footnote="valores de exemplo"/>
        <MetricCard label="Saldo demonstrativo" value={money(inMoney-outMoney)} delta="Receitas − despesas" icon={Wallet} kind="purple" footnote="não contábil"/>
        <MetricCard label="Itens com estoque" value={products.filter(p=>p.stock!==null).length.toString().padStart(2,'0')} delta="Controle por quantidade" icon={Boxes} kind="blue" footnote="produtos"/>
      </> : <>
        <MetricCard label="Agendamentos" value={appointments.length.toString().padStart(2,'0')} delta={waiting+' aguardando'} icon={CalendarDays} kind="blue" footnote="no exemplo"/>
        <MetricCard label="Receitas lançadas" value={money(inMoney)} delta="Entradas fictícias" icon={TrendingUp} kind="green" footnote="valores de exemplo"/>
        <MetricCard label="Despesas lançadas" value={money(outMoney)} delta="Saídas fictícias" icon={CreditCard} kind="rose" footnote="valores de exemplo"/>
        <MetricCard label="Saldo demonstrativo" value={money(inMoney-outMoney)} delta="Receitas − despesas" icon={Wallet} kind="purple" footnote="não contábil"/>
      </>}
    </div>
    <div className="content-grid overview-content">
      <section className="panel">
        <div className="panel-heading"><div><h3>{overviewTitle}</h3><p>{overviewDescription}</p></div><button className="text-action" onClick={()=>changeModule(viewAllModule)}>{burger&&!hasOrders?'Ver estoque':'Ver todos'} <ArrowRight size={15}/></button></div>
        {burger&&hasOrders?<OrderRows orders={orders.slice(0,3)}/>:burger?<ProductTable products={products}/>:<AppointmentRows appointments={appointments.slice(0,4)}/>}
      </section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h3>Acesso rápido</h3><p>Explore as áreas deste pacote.</p></div><MoreHorizontal size={18} className="muted-icon"/></div><div className="quick-links">{quickModules.map(m=>{const I=MODULES[m].icon;return <button key={m} onClick={()=>changeModule(m)}><span className={`quick-icon ${m}`}><I size={17}/></span><span><strong>{MODULES[m].label}</strong><small>{MODULES[m].description}</small></span><ArrowUpRight size={16}/></button>})}</div><div className="tip-card"><Sparkles size={18}/><div><strong>Dica para a apresentação</strong><p>{burger?'Mostre como o cliente monta o pedido e depois acompanhe o preparo no painel.': 'Mostre primeiro a experiência do cliente e depois como a área administrativa facilita a operação.'}</p></div></div></section>
    </div>
  </>;
}
function AppointmentsModule({appointments,setAppointments,openModal,isBarber,resetAppointments}) { const [query,setQuery]=useState('');const [status,setStatus]=useState('Todos');const list=appointments.filter(a=>a.client.toLowerCase().includes(query.toLowerCase())&&(status==='Todos'||a.status===status));return <><div className="module-toolbar"><div className="toolbar-filters"><label className="search-box compact"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente..."/></label><label className="select-filter"><Filter size={15}/><select value={status} onChange={e=>setStatus(e.target.value)}><option>Todos</option><option>Confirmado</option><option>Aguardando</option></select></label></div><button className="primary-button" onClick={openModal}><Plus size={16}/> Novo agendamento</button></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Agenda de hoje</h3><p>{list.length} agendamento(s) na demonstração</p></div><span className="date-chip"><CalendarDays size={15}/> {currentDateLabel()}</span></div><AppointmentRows appointments={list} full onStatusChange={(id)=>setAppointments(prev=>prev.map(a=>a.id===id?{...a,status:a.status==='Confirmado'?'Aguardando':'Confirmado'}:a))}/>{list.length===0&&<div className="empty-table">Nenhum agendamento encontrado com esse filtro.</div>}<div className="table-foot"><span>Dados ilustrativos · alterações ficam em memória até atualizar a página.</span><button className="text-action" onClick={resetAppointments}><RefreshCw size={14}/> Restaurar exemplos</button></div></div></>; }
function AppointmentRows({appointments,full=false,onStatusChange}) { return <div className={`data-table ${full?'full-table':''}`}><div className="table-head appt-head"><span>Horário</span><span>Cliente</span><span>Serviço</span><span>Status</span>{full&&<span>Ação</span>}</div>{appointments.map(a=><div className="table-row appt-head" key={a.id}><span className="time-cell"><Clock3 size={14}/>{a.time}</span><span className="client-cell"><span className="table-avatar">{a.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><span><strong>{a.client}</strong><small>{a.date}</small></span></span><span className="service-cell">{a.service}</span><span><StatusBadge status={a.status}/></span>{full&&<span><button className="small-outline" onClick={()=>onStatusChange?.(a.id)}>{a.status==='Confirmado'?'Marcar pendente':'Confirmar'}</button></span>}</div>)}</div>; }
function StatusBadge({status}) { let cls=status==='Confirmado'||status==='Pronto'||status==='Concluído'?'status-green':status==='Aguardando'||status==='Em preparo'?'status-amber':status==='Cancelado'?'status-red':'status-blue';return <span className={`status-badge ${cls}`}><span/>{status}</span>; }
function FinanceModule({transactions,setTransactions,openModal,resetTransactions}) { const incoming=transactions.filter(t=>t.category==='Receita').reduce((s,t)=>s+t.value,0);const outgoing=transactions.filter(t=>t.category==='Despesa').reduce((s,t)=>s+t.value,0);return <><div className="metric-grid finance-metrics"><MetricCard label="Total de receitas" value={money(incoming)} delta="Lançamentos fictícios" icon={TrendingUp} kind="green"/><MetricCard label="Total de despesas" value={money(outgoing)} delta="Lançamentos fictícios" icon={CreditCard} kind="rose"/><MetricCard label="Saldo do período" value={money(incoming-outgoing)} delta="Receitas − despesas" icon={Wallet} kind="blue"/><MetricCard label="Movimentações" value={transactions.length.toString().padStart(2,'0')} delta="Entradas e saídas" icon={ReceiptText} kind="purple"/></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Movimentações financeiras</h3><p>Registros de exemplo para apresentar o controle financeiro.</p></div><button className="primary-button" onClick={openModal}><Plus size={16}/> Novo lançamento</button></div><div className="data-table"><div className="table-head finance-head"><span>Descrição</span><span>Categoria</span><span>Data</span><span className="align-right">Valor</span></div>{transactions.map(t=><div key={t.id} className="table-row finance-head"><span className="finance-description"><span className={`transaction-icon ${t.category==='Receita'?'revenue':'expense'}`}>{t.category==='Receita'?<TrendingUp size={16}/>:<CreditCard size={16}/>}</span><strong>{t.description}</strong></span><span><span className={`category-pill ${t.category==='Receita'?'income':'expense'}`}>{t.category}</span></span><span className="muted-text">{t.date}</span><strong className={`money-cell ${t.category==='Receita'?'positive':'negative'}`}>{t.category==='Despesa'?'- ': '+ '}{money(t.value)}</strong></div>)}</div><div className="table-foot"><span>Valores exclusivamente fictícios.</span><button className="text-action" onClick={resetTransactions}><RefreshCw size={14}/> Restaurar exemplos</button></div></section></>; }
function OrdersModule({orders,setOrders}) { const [filter,setFilter]=useState('Todos');const list=orders.filter(o=>filter==='Todos'||o.status===filter);function updateOrder(id){setOrders(prev=>prev.map(o=>o.id===id?{...o,status:o.status==='Novo'?'Em preparo':o.status==='Em preparo'?'Pronto':'Concluído'}:o));}return <><div className="orders-intro"><div className="orders-intro-icon"><ShoppingBag size={20}/></div><div><strong>Central de pedidos</strong><p>Use os botões para demonstrar o andamento de um pedido. As mudanças são temporárias.</p></div><span className="sample-tag"><BadgeCheck size={14}/> EXEMPLO</span></div><div className="order-summary-grid"><div><span>Pedidos ativos</span><strong>{orders.filter(o=>o.status!=='Concluído').length.toString().padStart(2,'0')}</strong></div><div><span>Em preparo</span><strong>{orders.filter(o=>o.status==='Em preparo').length.toString().padStart(2,'0')}</strong></div><div><span>Prontos</span><strong>{orders.filter(o=>o.status==='Pronto').length.toString().padStart(2,'0')}</strong></div><div><span>Vendas demonstrativas</span><strong>{money(orders.reduce((s,o)=>s+o.total,0))}</strong></div></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Lista de pedidos</h3><p>Pedido, itens e etapa do atendimento</p></div><label className="select-filter"><Filter size={15}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Todos</option><option>Novo</option><option>Em preparo</option><option>Pronto</option><option>Concluído</option></select></label></div><div className="data-table"><div className="table-head order-head"><span>Pedido</span><span>Local</span><span>Itens</span><span>Total</span><span>Status / ação</span></div>{list.map(o=><div className="table-row order-head" key={o.id}><span><strong className="order-code">#{o.code}</strong><small className="block-muted">Hoje</small></span><span>{o.table}</span><span className="order-items">{o.items}</span><strong>{money(o.total)}</strong><span className="order-actions"><StatusBadge status={o.status}/><button className="small-outline" disabled={o.status==='Concluído'} onClick={()=>updateOrder(o.id)}>{o.status==='Novo'?'Iniciar':o.status==='Em preparo'?'Marcar pronto':o.status==='Pronto'?'Encerrar':'Encerrado'}</button></span></div>)}</div><div className="table-foot"><span>Fluxo ilustrativo: Novo → Em preparo → Pronto → Concluído.</span><button className="text-action" onClick={()=>setOrders(INITIAL_ORDERS)}><RefreshCw size={14}/> Restaurar pedidos</button></div></section></>; }
function ProductsModule({products}) { return <><div className="metric-grid"><MetricCard label="Itens cadastrados" value={products.length.toString().padStart(2,'0')} delta="Catálogo de exemplo" icon={Package} kind="blue"/><MetricCard label="Com estoque" value={products.filter(p=>p.stock!==null).length.toString().padStart(2,'0')} delta="Controle por quantidade" icon={Boxes} kind="green"/><MetricCard label="Sob pedido" value={products.filter(p=>p.stock===null).length.toString().padStart(2,'0')} delta="Produção sob demanda" icon={ShoppingBag} kind="orange"/><MetricCard label="Categorias" value="02" delta="Tipos demonstrativos" icon={Grid2X2} kind="purple"/></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Catálogo de produtos</h3><p>Separação entre itens com estoque e itens preparados sob demanda.</p></div><span className="sample-tag"><BadgeCheck size={14}/> EXEMPLO</span></div><ProductTable products={products}/></section></>; }
function InventoryModule({products,setProducts}) { return <><div className="welcome-strip inventory-welcome"><div className="welcome-icon"><Boxes size={19}/></div><div><strong>Controle de estoque demonstrativo</strong><p>Os produtos com estoque usam quantidade. Itens feitos sob pedido não mantêm saldo de unidades.</p></div></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Posição atual do estoque</h3><p>{products.filter(p=>p.stock!==null).length} produto(s) com controle de quantidade</p></div><button className="secondary-button" onClick={()=>setProducts(INITIAL_PRODUCTS)}><RefreshCw size={15}/> Restaurar</button></div><ProductTable products={products} inventory setProducts={setProducts}/></section></>; }
function ProductTable({products,inventory=false,setProducts}) { return <div className="data-table"><div className="table-head product-head"><span>Produto</span><span>Tipo</span><span>Estoque</span><span>Preço / custo demo</span>{inventory&&<span>Movimentar</span>}</div>{products.map(p=><div className="table-row product-head" key={p.id}><span className="product-name"><span className="product-thumb"><Package size={17}/></span><strong>{p.name}</strong></span><span><span className={`category-pill ${p.stock===null?'made-to-order':'in-stock'}`}>{p.category}</span></span><span>{p.stock===null?<span className="muted-text">Sob pedido</span>:<strong>{p.stock} <small>{p.unit}</small></strong>}</span><span>{money(p.price)}</span>{inventory&&<span className="stock-actions">{p.stock!==null&&<><button title="Retirar uma unidade" onClick={()=>setProducts(prev=>prev.map(item=>item.id===p.id?{...item,stock:Math.max(0,item.stock-1)}:item))} disabled={p.stock===0}>−</button><button title="Adicionar uma unidade" onClick={()=>setProducts(prev=>prev.map(item=>item.id===p.id?{...item,stock:item.stock+1}:item))}>+</button></>}</span>}</div>)}</div>; }
function ClientsModule({clients}) { const [query,setQuery]=useState('');const filtered=clients.filter(c=>c.name.toLowerCase().includes(query.toLowerCase()));return <section className="panel table-panel"><div className="panel-heading"><div><h3>Clientes demonstrativos</h3><p>Registros de exemplo, sem relação com pessoas reais.</p></div><label className="search-box compact"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente..."/></label></div><div className="data-table"><div className="table-head client-head"><span>Cliente</span><span>Contato fictício</span><span>Atendimentos</span><span>Última visita</span></div>{filtered.map(c=><div className="table-row client-head" key={c.name}><span className="client-cell"><span className="table-avatar">{c.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><strong>{c.name}</strong></span><span className="muted-text">{c.contact}</span><span>{c.visits}</span><span className="muted-text">{c.last}</span></div>)}</div></section>; }
function ServicesModule({services}) { return <><div className="service-card-grid">{services.map((s,i)=><article className="service-card" key={s.name}><div className={`service-number n${i+1}`}>{String(i+1).padStart(2,'0')}</div><div className="service-category">{s.type}</div><h3>{s.name}</h3><div className="service-detail"><Clock3 size={14}/>{s.duration}</div><div className="service-price">{money(s.price)}</div><div className="service-enabled"><span/>Disponível no exemplo</div></article>)}</div><div className="service-helper"><Settings2 size={18}/><div><strong>Catálogo demonstrativo</strong><p>Na integração das funcionalidades originais, os campos editáveis serão vinculados às regras reais do sistema de origem.</p></div></div></>; }
function SiteModule({activeDemo,siteSegment,setSiteSegment,activeSegment,onCta}) { const changeable=activeDemo.segment==='Vitrine';const selected=SEGMENTS[siteSegment]||SEGMENTS.Beauty;return <div className={`landing-preview landing-${siteSegment.toLowerCase()}`} style={{'--landing-accent':selected.accent,'--landing-secondary':selected.secondary}}><div className="landing-preview-top"><div className="landing-preview-logo"><span>{siteSegment==='Beauty'?'SB':siteSegment==='Barber'?'BC':'BB'}</span><div><strong>{selected.customer}</strong><small>{siteSegment==='Beauty'?'BELEZA & ESTÉTICA':siteSegment==='Barber'?'BARBEARIA':'HAMBURGUERIA'}</small></div></div><div className="landing-preview-nav"><span>Início</span><span>{siteSegment==='Burger'?'Cardápio':'Serviços'}</span><span>Sobre</span><button onClick={onCta}>{selected.action}</button></div><div className="landing-mobile-menu"><Menu size={19}/></div></div>{changeable&&<div className="landing-switcher"><span><MonitorSmartphone size={15}/> Modelo de demonstração:</span>{Object.keys(SEGMENTS).map(segment=><button key={segment} onClick={()=>setSiteSegment(segment)} className={siteSegment===segment?'active':''}>{segment}</button>)}</div>}<div className="landing-hero"><div className="landing-copy"><span className="landing-kicker"><Sparkles size={14}/> {selected.short} · EXPERIÊNCIA DIGITAL</span><h2>{selected.hero}</h2><p>{selected.subtitle}</p><button className="landing-cta" onClick={onCta}>{selected.action}<ArrowRight size={16}/></button><div className="landing-social-proof"><span className="proof-avatars"><i>J</i><i>M</i><i>A</i></span><span><strong>Atendimento com carinho</strong><small>Uma experiência pensada para você</small></span></div></div><div className="landing-visual"><div className={`landing-visual-main ${siteSegment.toLowerCase()}`}><div className="visual-abstract-circle"/><div className="visual-abstract-shape"/>{siteSegment==='Beauty'?<div className="beauty-illustration"><Sparkles size={52}/><span>BEAUTY</span></div>:siteSegment==='Barber'?<div className="barber-illustration"><Scissors size={58}/><span>YOUR STYLE</span></div>:<div className="burger-illustration"><ShoppingBag size={58}/><span>GOOD FOOD</span></div>}<div className="floating-rating"><Sparkles size={14}/><span>feito para seu negócio</span></div></div></div></div><div className="landing-services"><div><span className="landing-kicker">FEITO PARA FACILITAR</span><h3>{siteSegment==='Burger'?'Mais sabor, menos complicação.':'Conheça nossos serviços'}</h3></div><div className="landing-service-list">{selected.services.map((s,i)=><div key={s[0]} className="landing-service-item"><span className="landing-service-number">0{i+1}</span><span><strong>{s[0]}</strong><small>{s[2]}</small></span><b>{s[1]}</b><ArrowUpRight size={15}/></div>)}</div></div><div className="landing-disclaimer"><Eye size={14}/> Prévia visual de landing page · conteúdo fictício · identidade adaptável à marca do cliente</div></div>; }
function PublicBookingModule({segment,services,onBook}) {
  const [form,setForm] = useState({client:'',contact:'',service:services[0]?.name||'',date:localDateValue(),time:'10:00',professional:'Sem preferência'});
  const [completed,setCompleted] = useState(false);
  const chosen = services.find(service=>service.name===form.service) || services[0];
  const timeSlots = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
  function submit(event) {
    event.preventDefault();
    if (!form.client.trim() || !form.contact.trim() || !form.service || !form.date || !form.time) return;
    onBook({...form,client:form.client.trim(),contact:form.contact.trim()});
    setCompleted(true);
  }
  if (completed) return <section className="booking-confirmation panel">
    <div className="booking-success-icon"><CheckCircle2 size={30}/></div><span className="public-kicker">{segment.toUpperCase()} · DEMONSTRAÇÃO</span><h2>Agendamento confirmado!</h2><p>Este é um exemplo fictício. O horário foi incluído na agenda administrativa deste ambiente.</p>
    <div className="booking-confirmation-details"><span>Cliente<strong>{form.client}</strong></span><span>Serviço<strong>{form.service}</strong></span><span>Data e horário<strong>{form.date} · {form.time}</strong></span><span>Valor demonstrativo<strong>{money(chosen?.price||0)}</strong></span></div>
    <button className="primary-button" onClick={()=>{setCompleted(false);setForm(prev=>({...prev,client:'',contact:''}));}}>Fazer outro agendamento</button>
  </section>;
  return <div className="booking-page">
    <div className="public-module-heading"><div><span className="public-kicker">{segment.toUpperCase()} · ÁREA DO CLIENTE</span><h2>Agende seu horário</h2><p>Escolha o serviço, encontre um horário e confirme seus dados. Tudo aqui é demonstrativo.</p></div><span className="sample-tag"><BadgeCheck size={14}/> SEM ENVIO REAL</span></div>
    <form className="booking-layout" onSubmit={submit}>
      <div className="booking-main-column">
        <section className="panel booking-card"><div className="booking-step"><span>01</span><div><h3>Escolha o serviço</h3><p>Veja valores e duração antes de reservar.</p></div></div>
          <div className="booking-service-list">{services.map(service=><button type="button" key={service.name} className={'booking-service-option'+(form.service===service.name?' selected':'')} onClick={()=>setForm(prev=>({...prev,service:service.name}))}><span className="booking-radio"/><span className="booking-service-copy"><strong>{service.name}</strong><small>{service.type} · {service.duration}</small></span><b>{money(service.price)}</b></button>)}</div>
        </section>
        <section className="panel booking-card"><div className="booking-step"><span>02</span><div><h3>Data e horário</h3><p>Selecione uma opção para a demonstração.</p></div></div>
          <div className="booking-fields"><label>Data<input type="date" min={localDateValue()} value={form.date} onChange={e=>setForm(prev=>({...prev,date:e.target.value}))} required/></label><label>Profissional<select value={form.professional} onChange={e=>setForm(prev=>({...prev,professional:e.target.value}))}><option>Sem preferência</option>{(segment==='Barber'?['Felipe','Vitória']:['Profissional principal']).map(person=><option key={person}>{person}</option>)}</select></label></div>
          <div className="booking-time-grid">{timeSlots.map(time=><button type="button" key={time} className={form.time===time?'selected':''} onClick={()=>setForm(prev=>({...prev,time}))}><Clock3 size={14}/>{time}</button>)}</div>
        </section>
      </div>
      <aside className="panel booking-summary"><div className="booking-step"><span>03</span><div><h3>Seus dados</h3><p>Contato fictício para finalizar.</p></div></div>
        <label>Nome completo<input value={form.client} onChange={e=>setForm(prev=>({...prev,client:e.target.value}))} placeholder="Ex.: Ana Martins" required/></label>
        <label>WhatsApp<input value={form.contact} onChange={e=>setForm(prev=>({...prev,contact:e.target.value}))} placeholder="(67) 9 0000-0000" required/></label>
        <div className="booking-total"><span>Valor demonstrativo</span><strong>{money(chosen?.price||0)}</strong><small>{chosen?.duration||'Serviço'} · {form.time}</small></div>
        <button type="submit" className="primary-button booking-submit"><Check size={16}/> Confirmar agendamento</button><p className="booking-privacy"><LockKeyhole size={13}/> Dados fictícios. Nenhuma mensagem será enviada.</p>
      </aside>
    </form>
  </div>;
}
function PublicOrderingModule({onPlaceOrder}) {
  const [quantities,setQuantities] = useState({});
  const [customer,setCustomer] = useState('');
  const [place,setPlace] = useState('Balcão');
  const [completed,setCompleted] = useState(false);
  const selected = BURGER_MENU.filter(item=>(quantities[item.id]||0)>0);
  const total = selected.reduce((sum,item)=>sum+item.price*quantities[item.id],0);
  function submit(event) {
    event.preventDefault();
    if (!selected.length) return;
    onPlaceOrder({customer:customer.trim()||'Cliente demonstrativo',place,items:selected.map(item=>(quantities[item.id]+'x '+item.name)).join(', '),total});
    setCompleted(true);
  }
  if (completed) return <section className="booking-confirmation panel"><div className="booking-success-icon"><CheckCircle2 size={30}/></div><span className="public-kicker">BRASA BURGER · DEMONSTRAÇÃO</span><h2>Pedido enviado para a cozinha!</h2><p>O pedido fictício já está disponível na central administrativa para acompanhar o preparo.</p><button className="primary-button" onClick={()=>{setCompleted(false);setQuantities({});setCustomer('');}}>Montar outro pedido</button></section>;
  return <div className="booking-page ordering-page">
    <div className="public-module-heading"><div><span className="public-kicker">BURGER · ÁREA DO CLIENTE</span><h2>Cardápio e pedidos</h2><p>Monte um pedido de exemplo e acompanhe o fluxo na área administrativa. Nenhum pedido real será enviado.</p></div><span className="sample-tag"><BadgeCheck size={14}/> MODO DEMONSTRAÇÃO</span></div>
    <form className="ordering-layout" onSubmit={submit}>
      <div className="menu-product-grid">{BURGER_MENU.map(item=><article className="panel menu-product-card" key={item.id}><div className="menu-product-art"><ShoppingBag size={24}/><span>{item.category}</span></div><div className="menu-product-body"><h3>{item.name}</h3><p>{item.description}</p><strong>{money(item.price)}</strong><div className="menu-quantity"><button type="button" aria-label={'Remover '+item.name} disabled={!quantities[item.id]} onClick={()=>setQuantities(prev=>({...prev,[item.id]:Math.max(0,(prev[item.id]||0)-1)}))}>−</button><span>{quantities[item.id]||0}</span><button type="button" aria-label={'Adicionar '+item.name} onClick={()=>setQuantities(prev=>({...prev,[item.id]:(prev[item.id]||0)+1}))}>+</button></div></div></article>)}</div>
      <aside className="panel booking-summary order-summary"><div className="booking-step"><span><ShoppingBag size={15}/></span><div><h3>Seu pedido</h3><p>{selected.length} item(ns) selecionado(s)</p></div></div>
        <div className="order-cart-lines">{selected.map(item=><div key={item.id}><span>{quantities[item.id]}x {item.name}</span><strong>{money(item.price*quantities[item.id])}</strong></div>)}{!selected.length&&<p>Adicione itens do cardápio para começar.</p>}</div>
        <label>Nome para o pedido<input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Ex.: Cliente da mesa 02"/></label><label>Retirada / local<select value={place} onChange={e=>setPlace(e.target.value)}><option>Balcão</option><option>Mesa 01</option><option>Mesa 02</option><option>Mesa 03</option><option>Delivery demonstrativo</option></select></label>
        <div className="booking-total"><span>Total do pedido</span><strong>{money(total)}</strong><small>Valores meramente ilustrativos</small></div><button type="submit" className="primary-button booking-submit" disabled={!selected.length}><Check size={16}/> Enviar pedido demonstrativo</button>
      </aside>
    </form>
  </div>;
}
function OrderRows({orders}) { return <div className="simple-order-list">{orders.map(o=><div className="simple-order-row" key={o.id}><span className="order-mini-icon"><ShoppingBag size={16}/></span><span><strong>Pedido #{o.code}</strong><small>{o.items}</small></span><span className="order-list-right"><strong>{money(o.total)}</strong><StatusBadge status={o.status}/></span></div>)}</div>; }
function Modal({title,onClose,children}) { return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal-card"><div className="modal-heading"><div><span className="eyebrow muted-eyebrow">MODO DEMONSTRAÇÃO</span><h2>{title}</h2></div><button className="icon-quiet" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>{children}</section></div>; }
