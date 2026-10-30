import { useMemo, useState } from 'react';
import BeautyBookingPreview from './components/BeautyBookingPreview';
import BeautyAdminShowcase from './components/BeautyAdminShowcase';
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown,
  CircleDollarSign, ClipboardList, Clock3, Copy, CreditCard, ExternalLink, Eye,
  FileText, Filter, Grid2X2, LayoutDashboard, Menu, Package, Plus, Scissors,
  Search, Settings2, ShoppingBag, Sparkles, Store, Users, Wallet, X, Boxes,
  TrendingUp, ReceiptText, MonitorSmartphone, LockKeyhole, LogOut, ArrowUpRight,
  MoreHorizontal, CheckCircle2, Clock, CircleAlert, RefreshCw,
  Code2, Wrench, Network, Linkedin, ShieldCheck, DoorClosed, Tag
} from 'lucide-react';

const DEMOS = [
  { id:'landing', name:'2R Landing Pages', segment:'Vitrine', title:'Landing pages', description:'Apresente os três modelos de página e alterne entre Beauty, Barber e Burger sem trocar de página de demonstração.', modules:['site'], highlight:'Modelos de apresentação', color:'blue', icon:'site' },
  { id:'beauty.agenda', name:'2R Beauty Agenda', segment:'Beauty', title:'Agendamentos e administração básica', description:'Agendamento público para clientes, agenda do dia, serviços e cadastros fictícios para apresentar a rotina de uma profissional.', modules:['overview','booking','appointments','clients','services','promotions','hours','blocks','policies'], color:'rose', icon:'beauty' },
  { id:'beauty.financeiro', name:'2R Beauty Financeiro', segment:'Beauty', title:'Financeiro', description:'Demonstração isolada de receitas, despesas, movimentações e resumo do período.', modules:['finance'], color:'rose', icon:'finance' },
  { id:'beauty.siteagenda', name:'2R Beauty Web + Agenda', segment:'Beauty', title:'Landing page + agendamentos', description:'Página pública para apresentar serviços e um fluxo de agendamento demonstrativo.', modules:['site','booking','appointments','clients','services','promotions','hours','blocks','policies'], color:'rose', icon:'site' },
  { id:'beauty.agenda.financeiro', name:'2R Beauty Gestão', segment:'Beauty', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda administrativa, clientes, serviços e financeiro; sem landing page de marketing neste pacote.', modules:['overview','booking','appointments','clients','services','promotions','hours','blocks','policies','finance'], color:'rose', icon:'finance' },
  { id:'beauty.completo', name:'2R Beauty Completo', segment:'Beauty', title:'Solução completa Beauty', description:'Experiência completa com landing page, agendamentos, gestão administrativa e financeiro.', modules:['site','overview','booking','appointments','clients','services','promotions','hours','blocks','policies','finance'], color:'rose', icon:'sparkles' },
  { id:'barber.agenda', name:'2R Barber Agenda', segment:'Barber', title:'Agendamentos e administração', description:'Agendamento público para clientes, agenda administrativa, procedimentos, profissionais, promoções e gestão básica de uma barbearia.', modules:['overview','booking','appointments','clients','services','servicePromotions'], color:'amber', icon:'barber' },
  { id:'barber.siteagenda', name:'2R Barber Web + Agenda', segment:'Barber', title:'Landing page + agendamentos', description:'Página de apresentação da barbearia integrada ao exemplo de agendamentos.', modules:['site','booking','appointments','clients','services'], color:'amber', icon:'site' },
  { id:'barber.agenda.financeiro', name:'2R Barber Gestão', segment:'Barber', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda, serviços, clientes e financeiro para demonstrar uma gestão mais completa.', modules:['overview','booking','appointments','clients','services','finance'], color:'amber', icon:'finance' },
  { id:'barber.completo', name:'2R Barber Completo', segment:'Barber', title:'Solução completa Barber', description:'Landing page, agendamentos e administração completa com dados de demonstração.', modules:['site','overview','booking','appointments','clients','services','finance'], color:'amber', icon:'sparkles' },
  { id:'burger.pedidos', name:'2R Burger Pedidos', segment:'Burger', title:'Pedidos e operação', description:'Operação interna de atendimento, lançamento de pedidos, acompanhamento do preparo e controle de estoque.', modules:['overview','orders','products','inventory'], color:'orange', icon:'orders' },
  { id:'burger.gestao', name:'2R Burger Gestão', segment:'Burger', title:'Financeiro, produtos e estoque', description:'Controle demonstrativo de produtos, estoque e movimentações financeiras.', modules:['overview','finance','products','inventory'], color:'orange', icon:'inventory' },
  { id:'burger.completo', name:'2R Burger Completo', segment:'Burger', title:'Solução completa Burger', description:'Landing page, operação interna de pedidos, produtos, estoque e financeiro reunidos em uma demonstração.', modules:['site','overview','orders','products','inventory','finance'], color:'orange', icon:'sparkles' },
];

const MODULES = {
  site: { label:'Landing page', icon:Store, description:'Página estratégica para apresentar um negócio e direcionar contatos' },
  overview: { label:'Visão geral', icon:LayoutDashboard, description:'Resumo da operação' },
  booking: { label:'Agendamento público', icon:CalendarDays, description:'Página do cliente para escolher serviço e horário' },
  appointments: { label:'Agendamentos', icon:CalendarDays, description:'Agenda e atendimentos' },
  servicePromotions: { label:'Promoções', icon:Sparkles, description:'Exemplos de ofertas individuais e combos de procedimentos' },
  promotions: { label:'Promoções', icon:Tag, description:'Campanhas com validade e preços promocionais por procedimento' },
  hours: { label:'Horários', icon:Clock3, description:'Funcionamento semanal e intervalos de atendimento' },
  blocks: { label:'Bloqueios', icon:DoorClosed, description:'Folgas e períodos indisponíveis na agenda' },
  policies: { label:'Políticas', icon:ShieldCheck, description:'Orientações apresentadas antes do agendamento público' },
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
  Burger: { short:'BURGER', customer:'Brasa Burger', subtitle:'Feito na brasa, pensado para matar sua fome.', accent:'#d8753d', secondary:'#fff0e5', services:[['Smash clássico','R$ 29,90','Destaque da casa'],['Combo Brasa','R$ 39,90','Destaque da casa'],['Batata crocante','R$ 14,90','Acompanhamento']], hero:'Seu próximo burger favorito está aqui.', action:'Falar com a hamburgueria' },
};

const INITIAL_APPOINTMENTS = [
  { id:1, client:'Mariana Costa', service:'Maquiagem social', time:'09:00', date:'Hoje', status:'Confirmado', price:160 },
  { id:2, client:'Camila Oliveira', service:'Design de sobrancelhas', time:'10:30', date:'Hoje', status:'Confirmado', price:40 },
  { id:3, client:'Juliana Martins', service:'Lash lifting', time:'13:00', date:'Hoje', status:'Aguardando', price:150 },
  { id:4, client:'Bianca Souza', service:'Design de sobrancelhas', time:'15:00', date:'Hoje', status:'Confirmado', price:40 },
];
const INITIAL_ORDERS = [
  { id:101, code:'001', customer:'Cliente demonstrativo 01', items:'2x Smash clássico, 1x Batata', total:74.70, status:'Em preparo', payment:'Pendente' },
  { id:102, code:'002', customer:'Cliente demonstrativo 02', items:'1x Combo Brasa', total:39.90, status:'Novo', payment:'Pendente' },
  { id:103, code:'003', customer:'Cliente demonstrativo 03', items:'1x Smash duplo, 2x Refrigerante', total:67.80, status:'Pronto', payment:'Recebido' },
];
const INITIAL_PRODUCTS = [
  { id:1, name:'Pão brioche', category:'Estoque', stock:24, unit:'un.', price:3.5 },
  { id:2, name:'Blend 160g', category:'Estoque', stock:18, unit:'un.', price:8.9 },
  { id:3, name:'Queijo cheddar', category:'Estoque', stock:32, unit:'fatias', price:1.2 },
  { id:4, name:'Smash clássico', category:'Produção sob pedido', stock:null, unit:'pedido', price:29.9 },
  { id:5, name:'Batata pré-frita', category:'Estoque', stock:16, unit:'kg', price:12.5 },
  { id:6, name:'Refrigerante lata', category:'Estoque', stock:36, unit:'un.', price:3.2 },
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
  { id:21, client:'Lucas Mendes', service:'Corte degradê', time:'09:00', date:'Hoje', status:'Confirmado', price:55, professional:'Profissional 1' },
  { id:22, client:'Pedro Henrique', service:'Barba completa', time:'10:00', date:'Hoje', status:'Confirmado', price:35, professional:'Profissional 2' },
  { id:23, client:'André Costa', service:'Corte + barba', time:'11:30', date:'Hoje', status:'Aguardando', price:80, professional:'Profissional 1' },
  { id:24, client:'Rafael Martins', service:'Corte degradê', time:'14:00', date:'Hoje', status:'Confirmado', price:55, professional:'Profissional 1' },
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
const BURGER_RECIPES = {
  'Smash clássico': {'Pão brioche':1,'Blend 160g':1,'Queijo cheddar':1},
  'Combo Brasa': {'Pão brioche':1,'Blend 160g':1,'Queijo cheddar':1,'Batata pré-frita':0.2,'Refrigerante lata':1},
  'Smash duplo': {'Pão brioche':1,'Blend 160g':2,'Queijo cheddar':2},
  'Batata crocante': {'Batata pré-frita':0.2},
  'Refrigerante lata': {'Refrigerante lata':1},
};
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
const AUTOMATION_NOTES = {
  Beauty: {
    title: 'Agendamento, cadastro e financeiro conectados',
    points: [
      'O fluxo de agendamento mostra a verificação de disponibilidade antes de apresentar a confirmação.',
      'Ao confirmar o exemplo de agendamento, a informação aparece na agenda e no cadastro ilustrativo do cliente.',
      'A prévia financeira representa recebimentos e lançamentos em uma área própria.',
    ],
    reminder: 'Mostre primeiro a prévia de agendamento. Depois abra a agenda e mostre como o mesmo atendimento aparece na visão administrativa.',
  },
  Barber: {
    title: 'Disponibilidade e gestão da barbearia no mesmo fluxo',
    points: [
      'A prévia mostra como a disponibilidade pode considerar serviço, duração, profissional e horário.',
      'Combos e promoções podem seguir regras de preço configuradas para cada modalidade.',
      'A reserva ilustrativa pode ser acompanhada e ter seu status atualizado na prévia administrativa.',
    ],
    reminder: 'Mostre a seleção de serviços e horários e depois a mesma reserva na agenda da prévia. Destaque como as áreas podem trabalhar em conjunto.',
  },
  Burger: {
    title: 'Pedidos, estoque e financeiro integrados',
    points: [
      'A prévia apresenta o pedido com itens e status em uma área de operação.',
      'O exemplo mostra como as baixas e devoluções de estoque podem acompanhar o ciclo do pedido.',
      'As telas de financeiro e relatórios ilustram como os valores da operação podem ser organizados.',
    ],
    reminder: 'Monte um pedido de exemplo, avance seu status e mostre as telas ilustrativas de estoque e financeiro. Explique quais etapas podem ser conectadas e quais dependem de uma confirmação.',
  },
};

function IconForDemo({ demo }) {
  const Icon = demo.icon === 'beauty' ? Sparkles : demo.icon === 'barber' ? Scissors : demo.icon === 'orders' ? ShoppingBag : demo.icon === 'inventory' ? Boxes : demo.icon === 'finance' ? Wallet : demo.icon === 'site' ? MonitorSmartphone : demo.icon === 'sparkles' ? Sparkles : Grid2X2;
  return <Icon size={20} strokeWidth={1.8} />;
}
function getStartModule(demo) { return demo.modules[0]; }

export default function App() {
  const [activeDemo, setActiveDemo] = useState(null);
  const [page, setPage] = useState('portfolio');
  const [activeModule, setActiveModule] = useState('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [mobileNav, setMobileNav] = useState(false);
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceOrders, setAttendanceOrders] = useState([]);
  const [promotions, setPromotions] = useState([{id:1,name:'Combo corte + barba',kind:'Combo',services:['Corte degradê','Barba completa'],regular:90,promo:75,validity:'Período demonstrativo',status:'Ativa'},{id:2,name:'Acabamento especial',kind:'Serviço',services:['Acabamento'],regular:20,promo:15,validity:'Período demonstrativo',status:'Programada'}]);
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
    const matchesText = `${demo.name} ${demo.title} ${demo.description}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'Todos' || demo.segment === filter;
    return matchesText && matchesFilter;
  }), [search, filter]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  }
  function enterDemo(demo) {
    const seed = getSeedData(demo.segment === 'Vitrine' ? 'Beauty' : demo.segment);
    setActiveDemo(demo);
    setActiveModule(getStartModule(demo));
    setSiteSegment(demo.segment === 'Vitrine' ? 'Beauty' : demo.segment);
    setAppointments(seed.appointments);
    setOrders(seed.orders);
    setAttendanceOpen(demo.segment === 'Burger');
    setAttendanceOrders(demo.segment === 'Burger' ? seed.orders.map(item=>({...item})) : []);
    setPromotions([{id:1,name:'Combo corte + barba',kind:'Combo',services:['Corte degradê','Barba completa'],regular:90,promo:75,validity:'Período demonstrativo',status:'Ativa'},{id:2,name:'Acabamento especial',kind:'Serviço',services:['Acabamento'],regular:20,promo:15,validity:'Período demonstrativo',status:'Programada'}]);
    setProducts(seed.products);
    setTransactions(seed.transactions);
    setClients(seed.clients);
    setServices(seed.services);
    setAppointmentForm({client:'',service:seed.services[0]?.name || '',time:'16:00'});
    setTransactionForm({description:'',category:'Receita',value:''});
    setMobileNav(false);
    setModal(null);
  }
  function exitDemo() { setActiveDemo(null); setMobileNav(false); setPage('catalog'); }
  function canUse(module) { return activeDemo?.modules.includes(module); }
  function changeModule(module) {
    setMobileNav(false);
    if (activeDemo?.modules.includes(module)) setActiveModule(module);
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
  const activeSegment = SEGMENTS[siteSegment] || SEGMENTS.Beauty;
  const isBurger = activeDemo.segment === 'Burger';
  const isBarber = activeDemo.segment === 'Barber';
  const isBeauty = activeDemo.segment === 'Beauty';
  const segmentLabel = isBurger ? 'Burger' : isBarber ? 'Barber' : 'Beauty';

  return <div className={`app-shell demo-app ${activeDemo.color}`}>
    <header className="topbar demo-topbar"><div className="brand-lockup"><button className="mobile-menu icon-quiet" onClick={()=>setMobileNav(v=>!v)} aria-label="Abrir menu"><Menu size={20}/></button><div className="brand-mark">2R</div><div><div className="brand-name">2R INFORMÁTICA</div><div className="brand-tagline">Prévia visual de modalidades</div></div></div><div className="demo-topbar-right"><span className={`workspace-badge ${activeDemo.color}`}><span className="workspace-dot"/>{activeDemo.segment==='Vitrine'?'LANDING PAGES':activeDemo.segment.toUpperCase()}</span><button className="back-hub-button" onClick={exitDemo}><ArrowLeft size={16}/><span>Voltar às modalidades</span></button></div></header>
    <div className="demo-layout">
      <aside className={`sidebar ${mobileNav?'show-mobile':''}`}><div className="sidebar-workspace"><div className={`workspace-avatar ${activeDemo.color}`}><IconForDemo demo={activeDemo}/></div><div className="workspace-meta"><strong>{activeDemo.name}</strong><span>Prévia visual do pacote</span></div><button className="icon-quiet sidebar-close" onClick={()=>setMobileNav(false)}><X size={17}/></button></div><div className="sidebar-section-label">NAVEGAR NA PRÉVIA</div><nav className="side-nav">{currentModules.map(module=>{const item=MODULES[module];const Icon=item.icon;return <button key={module} className={`side-nav-item ${activeModule===module?'active':''}`} onClick={()=>changeModule(module)}><Icon size={18}/><span>{item.label}</span>{activeModule===module&&<span className="nav-active-mark"/>}</button>})}</nav><div className="sidebar-bottom"><div className="demo-data-note"><div><Sparkles size={15}/><strong>Modo demonstração</strong></div><p>Use o menu para alternar entre telas e experimente os botões. As alterações são temporárias e reiniciam ao recarregar.</p></div><button className="side-nav-item exit-item" onClick={exitDemo}><LogOut size={18}/><span>Voltar às modalidades</span></button></div></aside>
      {mobileNav&&<button className="mobile-scrim" aria-label="Fechar menu" onClick={()=>setMobileNav(false)}/>}
      <main className="demo-main">
        <div className="demo-breadcrumb"><span>Central 2R</span><ArrowRight size={13}/><span>{activeDemo.segment}</span><ArrowRight size={13}/><strong>{MODULES[activeModule]?.label || 'Demonstração'}</strong></div>
        <div className="main-title-row"><div><div className="eyebrow muted-eyebrow">{activeDemo.name.toUpperCase()}</div><h1>{activeModule==='site'?'Landing pages na prática':MODULES[activeModule]?.label || activeDemo.title}</h1><p>{activeModule==='site'?'Entenda o papel de uma página de apresentação e explore um exemplo visual.':MODULES[activeModule]?.description || activeDemo.description}</p></div><div className="main-title-actions"><span className="fake-live"><span className="pulse-dot"/> PRÉVIA INTERATIVA</span><button className="secondary-button" onClick={exitDemo}><Grid2X2 size={16}/> Catálogo</button></div></div>
        {activeModule==='site'&&<SiteModule activeDemo={activeDemo} siteSegment={siteSegment} setSiteSegment={setSiteSegment} onCta={()=>{if(canUse('booking')&&siteSegment!=='Burger'){changeModule('booking');return;}if(siteSegment==='Burger'){notify('Em uma página de alimentação, este botão pode abrir o WhatsApp ou endereço da loja. Os pedidos do P16 são lançados pela equipe na área interna, não por um cardápio público.');return;}notify('O destino deste botão é definido conforme o objetivo do negócio: WhatsApp, formulário, agendamento ou outro canal de contato. Nesta prévia, nenhum envio é realizado.');}} />}
        {activeModule==='overview'&&<OverviewModule demo={activeDemo} appointments={appointments} orders={orders} products={products} transactions={transactions} changeModule={changeModule}/>} 
         {activeModule==='booking'&&(isBeauty?<BeautyBookingPreview notify={notify}/>:<PublicBookingModule segment={segmentLabel} services={services} onBook={(payload)=>{setAppointments(prev=>[...prev,{id:Date.now(),client:payload.client,contact:payload.contact,service:payload.services.map(item=>item.name).join(' + '),time:payload.time,date:payload.date,status:'Confirmado',price:payload.total,professional:payload.professionalAssignments?.map(item=>item.service+': '+item.professional).join(' · ')}].sort((a,b)=>a.time.localeCompare(b.time)));setClients(prev=>prev.some(item=>item.name.toLowerCase()===payload.client.toLowerCase())?prev:[{name:payload.client,contact:payload.contact,visits:1,last:'Hoje'},...prev]);notify('Agendamento fictício confirmado e enviado para a agenda administrativa.');}} />)}
         {activeModule==='orders'&&<BurgerOrdersModule attendanceOpen={attendanceOpen} setAttendanceOpen={setAttendanceOpen} attendanceOrders={attendanceOrders} setAttendanceOrders={setAttendanceOrders} products={products} setProducts={setProducts} notify={notify} />}
        {!isBeauty&&activeModule==='appointments'&&<AppointmentsModule appointments={appointments} setAppointments={setAppointments} openModal={()=>setModal('appointment')} isBarber={isBarber} resetAppointments={()=>setAppointments(getSeedData(activeDemo.segment).appointments)} />}
        {isBeauty&&['appointments','clients','services','promotions','hours','blocks','policies','finance'].includes(activeModule)&&<BeautyAdminShowcase module={activeModule} notify={notify}/>}
        {!isBeauty&&activeModule==='clients'&&<ClientsModule clients={clients} />}
        {!isBeauty&&activeModule==='services'&&<ServicesModule services={services} />}
        {!isBeauty&&activeModule==='finance'&&<FinanceModule transactions={transactions} setTransactions={setTransactions} openModal={()=>setModal('transaction')} resetTransactions={()=>setTransactions(getSeedData(activeDemo.segment).transactions)} />}
        {activeModule==='servicePromotions'&&<PromotionsPreview promotions={promotions} setPromotions={setPromotions} />}
        {activeModule==='products'&&<ProductsModule products={products} />}
        {activeModule==='inventory'&&<InventoryModule products={products} setProducts={setProducts} />}
        {activeDemo.segment !== 'Burger' && !isBeauty && AUTOMATION_NOTES[activeDemo.segment] && <section className="panel automation-panel preview-automation-panel">
          <div className="automation-heading"><div className="automation-icon"><Activity size={20}/></div><div><span className="eyebrow muted-eyebrow">COMO AS ÁREAS SE CONECTAM</span><h2>{AUTOMATION_NOTES[activeDemo.segment].title}</h2><p>Resumo ilustrativo do que esta modalidade pode reunir.</p></div></div>
          <div className="automation-points">{AUTOMATION_NOTES[activeDemo.segment].points.map((point,index)=><div className="automation-point" key={point}><span>{String(index+1).padStart(2,'0')}</span><p>{point}</p></div>)}</div>
        </section>}
        <div className="demo-footer-note"><Eye size={14}/><span>Como testar: navegue pelo menu lateral, abra formulários e experimente as ações. Os dados são fictícios, nada é enviado ou salvo e recarregar a página reinicia a demonstração.</span></div>
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
      <section className="panel quick-panel"><div className="panel-heading"><div><h3>Atalhos do pacote</h3><p>Explore as áreas deste pacote.</p></div><MoreHorizontal size={18} className="muted-icon"/></div><div className="quick-links">{quickModules.map(m=>{const I=MODULES[m].icon;return <button key={m} onClick={()=>changeModule(m)}><span className={`quick-icon ${m}`}><I size={17}/></span><span><strong>{MODULES[m].label}</strong><small>{MODULES[m].description}</small></span><ArrowUpRight size={16}/></button>})}</div><div className="tip-card"><Sparkles size={18}/><div><strong>Dica para a apresentação</strong><p>{burger?'Abra um atendimento, registre um pedido pela administração e acompanhe as etapas e a movimentação de estoque.': 'Mostre primeiro a experiência do cliente e depois como a área administrativa facilita a operação.'}</p></div></div></section>
    </div>
  </>;
}
function AppointmentsModule({appointments,setAppointments,openModal,resetAppointments}) {
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('Todos');
  const list=appointments.filter(a=>a.client.toLowerCase().includes(query.toLowerCase())&&(status==='Todos'||a.status===status));
  function updateStatus(id,nextStatus){setAppointments(prev=>prev.map(a=>a.id===id?{...a,status:nextStatus}:a));}
  return <>
    <div className="module-toolbar"><div className="toolbar-filters"><label className="search-box compact"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente..."/></label><label className="select-filter"><Filter size={15}/><select value={status} onChange={e=>setStatus(e.target.value)}><option>Todos</option><option>Confirmado</option><option>Aguardando</option><option>Concluído</option><option>Cancelado</option></select></label></div><button className="primary-button" onClick={openModal}><Plus size={16}/> Novo agendamento</button></div>
    <div className="panel table-panel"><div className="panel-heading"><div><h3>Agenda de hoje</h3><p>{list.length} agendamento(s) na demonstração</p></div><span className="date-chip"><CalendarDays size={15}/> {currentDateLabel()}</span></div>
      <AppointmentRows appointments={list} full onStatusChange={updateStatus}/>
      {list.length===0&&<div className="empty-table">Nenhum agendamento encontrado com esse filtro.</div>}
      <div className="table-foot"><span>Dados ilustrativos · alterações ficam em memória até atualizar a página.</span><button className="text-action" onClick={resetAppointments}><RefreshCw size={14}/> Restaurar exemplos</button></div>
    </div>
  </>;
}
function AppointmentRows({appointments,full=false,onStatusChange}) {
  return <div className={`data-table ${full?'full-table':''}`}><div className="table-head appt-head"><span>Horário</span><span>Cliente</span><span>Serviço</span><span>Status</span>{full&&<span>Ação</span>}</div>
    {appointments.map(a=><div className="table-row appt-head" key={a.id}><span className="time-cell"><Clock3 size={14}/>{a.time}</span><span className="client-cell"><span className="table-avatar">{a.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><span><strong>{a.client}</strong><small>{a.date}</small></span></span><span className="service-cell">{a.service}</span><span><StatusBadge status={a.status}/></span>
      {full&&<span className="appt-row-actions">{a.status==='Aguardando'&&<button className="small-outline" onClick={()=>onStatusChange?.(a.id,'Confirmado')}>Confirmar</button>}{a.status==='Confirmado'&&<button className="small-outline" onClick={()=>onStatusChange?.(a.id,'Concluído')}>Concluir</button>}{!['Cancelado','Concluído'].includes(a.status)&&<button className="small-outline danger" onClick={()=>onStatusChange?.(a.id,'Cancelado')}>Cancelar</button>}{['Cancelado','Concluído'].includes(a.status)&&<span className="muted-text">Encerrado</span>}</span>}
    </div>)}
  </div>;
}
function StatusBadge({status}) { let cls=status==='Confirmado'||status==='Pronto'||status==='Concluído'?'status-green':status==='Aguardando'||status==='Em preparo'?'status-amber':status==='Cancelado'?'status-red':'status-blue';return <span className={`status-badge ${cls}`}><span/>{status}</span>; }
function FinanceModule({transactions,setTransactions,openModal,resetTransactions}) { const incoming=transactions.filter(t=>t.category==='Receita').reduce((s,t)=>s+t.value,0);const outgoing=transactions.filter(t=>t.category==='Despesa').reduce((s,t)=>s+t.value,0);return <><div className="metric-grid finance-metrics"><MetricCard label="Total de receitas" value={money(incoming)} delta="Lançamentos fictícios" icon={TrendingUp} kind="green"/><MetricCard label="Total de despesas" value={money(outgoing)} delta="Lançamentos fictícios" icon={CreditCard} kind="rose"/><MetricCard label="Saldo do período" value={money(incoming-outgoing)} delta="Receitas − despesas" icon={Wallet} kind="blue"/><MetricCard label="Movimentações" value={transactions.length.toString().padStart(2,'0')} delta="Entradas e saídas" icon={ReceiptText} kind="purple"/></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Movimentações financeiras</h3><p>Registros de exemplo para apresentar o controle financeiro.</p></div><button className="primary-button" onClick={openModal}><Plus size={16}/> Novo lançamento</button></div><div className="data-table"><div className="table-head finance-head"><span>Descrição</span><span>Categoria</span><span>Data</span><span className="align-right">Valor</span></div>{transactions.map(t=><div key={t.id} className="table-row finance-head"><span className="finance-description"><span className={`transaction-icon ${t.category==='Receita'?'revenue':'expense'}`}>{t.category==='Receita'?<TrendingUp size={16}/>:<CreditCard size={16}/>}</span><strong>{t.description}</strong></span><span><span className={`category-pill ${t.category==='Receita'?'income':'expense'}`}>{t.category}</span></span><span className="muted-text">{t.date}</span><strong className={`money-cell ${t.category==='Receita'?'positive':'negative'}`}>{t.category==='Despesa'?'- ': '+ '}{money(t.value)}</strong></div>)}</div><div className="table-foot"><span>Valores exclusivamente fictícios.</span><button className="text-action" onClick={resetTransactions}><RefreshCw size={14}/> Restaurar exemplos</button></div></section></>; }
function ProductsModule({products}) { return <><div className="metric-grid"><MetricCard label="Itens cadastrados" value={products.length.toString().padStart(2,'0')} delta="Catálogo de exemplo" icon={Package} kind="blue"/><MetricCard label="Com estoque" value={products.filter(p=>p.stock!==null).length.toString().padStart(2,'0')} delta="Controle por quantidade" icon={Boxes} kind="green"/><MetricCard label="Sob pedido" value={products.filter(p=>p.stock===null).length.toString().padStart(2,'0')} delta="Produção sob demanda" icon={ShoppingBag} kind="orange"/><MetricCard label="Categorias" value="02" delta="Tipos demonstrativos" icon={Grid2X2} kind="purple"/></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Catálogo de produtos</h3><p>Separação entre itens com estoque e itens preparados sob demanda.</p></div><span className="sample-tag"><BadgeCheck size={14}/> EXEMPLO</span></div><ProductTable products={products}/></section></>; }
function InventoryModule({products,setProducts}) { return <><div className="welcome-strip inventory-welcome"><div className="welcome-icon"><Boxes size={19}/></div><div><strong>Controle de estoque demonstrativo</strong><p>Os produtos com estoque usam quantidade. Itens feitos sob pedido não mantêm saldo de unidades.</p></div></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Posição atual do estoque</h3><p>{products.filter(p=>p.stock!==null).length} produto(s) com controle de quantidade</p></div><button className="secondary-button" onClick={()=>setProducts(INITIAL_PRODUCTS)}><RefreshCw size={15}/> Restaurar</button></div><ProductTable products={products} inventory setProducts={setProducts}/></section></>; }
function ProductTable({products,inventory=false,setProducts}) { return <div className="data-table"><div className="table-head product-head"><span>Produto</span><span>Tipo</span><span>Estoque</span><span>Preço / custo demo</span>{inventory&&<span>Movimentar</span>}</div>{products.map(p=><div className="table-row product-head" key={p.id}><span className="product-name"><span className="product-thumb"><Package size={17}/></span><strong>{p.name}</strong></span><span><span className={`category-pill ${p.stock===null?'made-to-order':'in-stock'}`}>{p.category}</span></span><span>{p.stock===null?<span className="muted-text">Sob pedido</span>:<strong>{p.stock} <small>{p.unit}</small></strong>}</span><span>{money(p.price)}</span>{inventory&&<span className="stock-actions">{p.stock!==null&&<><button title="Retirar uma unidade" onClick={()=>setProducts(prev=>prev.map(item=>item.id===p.id?{...item,stock:Math.max(0,item.stock-1)}:item))} disabled={p.stock===0}>−</button><button title="Adicionar uma unidade" onClick={()=>setProducts(prev=>prev.map(item=>item.id===p.id?{...item,stock:item.stock+1}:item))}>+</button></>}</span>}</div>)}</div>; }
function ClientsModule({clients}) { const [query,setQuery]=useState('');const filtered=clients.filter(c=>c.name.toLowerCase().includes(query.toLowerCase()));return <section className="panel table-panel"><div className="panel-heading"><div><h3>Clientes demonstrativos</h3><p>Registros de exemplo, sem relação com pessoas reais.</p></div><label className="search-box compact"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente..."/></label></div><div className="data-table"><div className="table-head client-head"><span>Cliente</span><span>Contato fictício</span><span>Atendimentos</span><span>Última visita</span></div>{filtered.map(c=><div className="table-row client-head" key={c.name}><span className="client-cell"><span className="table-avatar">{c.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><strong>{c.name}</strong></span><span className="muted-text">{c.contact}</span><span>{c.visits}</span><span className="muted-text">{c.last}</span></div>)}</div></section>; }
function ServicesModule({services}) { return <><div className="service-card-grid">{services.map((s,i)=><article className="service-card" key={s.name}><div className={`service-number n${i+1}`}>{String(i+1).padStart(2,'0')}</div><div className="service-category">{s.type}</div><h3>{s.name}</h3><div className="service-detail"><Clock3 size={14}/>{s.duration}</div><div className="service-price">{money(s.price)}</div><div className="service-enabled"><span/>Disponível no exemplo</div></article>)}</div><div className="service-helper"><Settings2 size={18}/><div><strong>Catálogo demonstrativo</strong><p>Na integração das funcionalidades originais, os campos editáveis serão vinculados às regras reais do sistema de origem.</p></div></div></>; }
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
        <a href="https://ruan2r.github.io/P11-LANDING-PAGE-DANY/" target="_blank" rel="noopener noreferrer">Ver landing page funcional <ExternalLink size={16}/></a>
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
function PublicBookingModule({segment,services,onBook}) {
  const [form,setForm] = useState({client:'',contact:'',services:services[0]?.name?[services[0].name]:[],date:localDateValue(),time:'10:00',professionalByService:{}});
  const [completed,setCompleted] = useState(false);
  const selectedServices = services.filter(service=>form.services.includes(service.name));
  const total = selectedServices.reduce((sum,service)=>sum+service.price,0);
  const totalDuration = selectedServices.map(service=>service.duration).join(' + ');
  const timeSlots = segment==='Barber' ? Array.from({length:20},(_,index)=>`${String(9+Math.floor(index/2)).padStart(2,'0')}:${String((index%2)*30).padStart(2,'0')}`) : Array.from({length:540},(_,index)=>`${String(8+Math.floor(index/60)).padStart(2,'0')}:${String(index%60).padStart(2,'0')}`);
  function toggleService(name) {
    setForm(prev=>{
      if(prev.services.includes(name)) return prev.services.length===1?prev:{...prev,services:prev.services.filter(item=>item!==name)};
      return {...prev,services:[...prev.services,name]};
    });
  }
  function submit(event) {
    event.preventDefault();
    if (!form.client.trim() || !form.contact.trim() || !selectedServices.length || !form.date || !form.time) return;
    const professionalAssignments=selectedServices.map(service=>({service:service.name,professional:segment==='Barber'?(form.professionalByService[service.name]||'Sem preferência'):'Profissional principal'}));
    onBook({...form,client:form.client.trim(),contact:form.contact.trim(),services:selectedServices,total,professionalAssignments});
    setCompleted(true);
  }
  if (completed) return <section className="booking-confirmation panel">
    <div className="booking-success-icon"><CheckCircle2 size={30}/></div><span className="public-kicker">{segment.toUpperCase()} · DEMONSTRAÇÃO</span><h2>Agendamento confirmado!</h2><p>Este é um exemplo fictício. O atendimento com os procedimentos selecionados foi incluído na agenda administrativa deste ambiente.</p>
    <div className="booking-confirmation-details"><span>Cliente<strong>{form.client}</strong></span><span>Procedimentos<strong>{selectedServices.map(item=>item.name).join(' + ')}</strong></span><span>Data e horário<strong>{form.date} · {form.time}</strong></span><span>Valor demonstrativo<strong>{money(total)}</strong></span></div>
    <button className="primary-button" onClick={()=>{setCompleted(false);setForm(prev=>({...prev,client:'',contact:''}));}}>Fazer outro agendamento</button>
  </section>;
  return <div className="booking-page">
    <div className="public-module-heading"><div><span className="public-kicker">{segment.toUpperCase()} · ÁREA DO CLIENTE</span><h2>Agende seu horário</h2><p>Escolha um ou mais serviços, encontre um horário e confirme seus dados. Tudo aqui é demonstrativo.</p></div><span className="sample-tag"><BadgeCheck size={14}/> SEM ENVIO REAL</span></div>
    <form className="booking-layout" onSubmit={submit}>
      <div className="booking-main-column">
        <section className="panel booking-card"><div className="booking-step"><span>01</span><div><h3>Escolha os serviços</h3><p>Você pode combinar procedimentos no mesmo atendimento.</p></div></div>
          <div className="booking-service-list">{services.map(service=><button type="button" key={service.name} className={'booking-service-option'+(form.services.includes(service.name)?' selected':'')} aria-pressed={form.services.includes(service.name)} onClick={()=>toggleService(service.name)}><span className="booking-radio"/><span className="booking-service-copy"><strong>{service.name}</strong><small>{service.type} · {service.duration}</small></span><b>{money(service.price)}</b></button>)}</div>
        </section>
        <section className="panel booking-card"><div className="booking-step"><span>02</span><div><h3>Data e horário</h3><p>Selecione uma opção para a demonstração.</p></div></div>
          <div className="booking-fields"><label>Data<input type="date" min={localDateValue()} value={form.date} onChange={e=>setForm(prev=>({...prev,date:e.target.value}))} required/></label>{segment==='Barber'?<div className="booking-professional-assignments"><strong>Profissional por procedimento</strong>{selectedServices.map(service=><label key={service.name}>{service.name}<select value={form.professionalByService[service.name]||'Sem preferência'} onChange={e=>setForm(prev=>({...prev,professionalByService:{...prev.professionalByService,[service.name]:e.target.value}}))}><option>Sem preferência</option><option>Profissional 1</option><option>Profissional 2</option></select></label>)}</div>:<label>Profissional<select disabled value="Profissional principal"><option>Profissional principal</option></select></label>}</div>
          <div className="booking-time-grid booking-time-grid-minute">{timeSlots.map(time=><button type="button" key={time} className={form.time===time?'selected':''} onClick={()=>setForm(prev=>({...prev,time}))}>{time}</button>)}</div><p className="booking-availability-note">{segment==='Barber'?'Grade demonstrativa em intervalos de 30 minutos. A disponibilidade real considera duração, profissional e bloqueios.':'Seletor demonstrativo minuto a minuto. A disponibilidade real considera duração, horários ocupados e bloqueios.'}</p>
        </section>
      </div>
      <aside className="panel booking-summary"><div className="booking-step"><span>03</span><div><h3>Seus dados</h3><p>Contato fictício para finalizar.</p></div></div>
        <label>Nome completo<input value={form.client} onChange={e=>setForm(prev=>({...prev,client:e.target.value}))} placeholder="Ex.: Ana Martins" required/></label>
        <label>WhatsApp<input value={form.contact} onChange={e=>setForm(prev=>({...prev,contact:e.target.value}))} placeholder="(67) 9 0000-0000" required/></label>
        <div className="booking-total"><span>Valor demonstrativo · {selectedServices.length} serviço(s)</span><strong>{money(total)}</strong><small>{totalDuration} · {form.time}</small></div>
        <button type="submit" className="primary-button booking-submit" disabled={!selectedServices.length}><Check size={16}/> Confirmar agendamento</button><p className="booking-privacy"><LockKeyhole size={13}/> Dados fictícios. Nenhuma mensagem será enviada.</p>
      </aside>
    </form>
  </div>;
}

function BurgerOrdersModule({attendanceOpen,setAttendanceOpen,attendanceOrders,setAttendanceOrders,products,setProducts,notify}) {
 const [showNewOrder,setShowNewOrder]=useState(false),[customer,setCustomer]=useState(''),[quantities,setQuantities]=useState({}),[filter,setFilter]=useState('Todos');
 const catalog=[{id:1,name:'Smash clássico',price:29.9,recipe:{'Pão brioche':1,'Blend 160g':1,'Queijo cheddar':1}},{id:2,name:'Combo Brasa',price:39.9,recipe:{'Pão brioche':1,'Blend 160g':1,'Queijo cheddar':1,'Batata pré-frita':.2,'Refrigerante lata':1}},{id:3,name:'Smash duplo',price:36.9,recipe:{'Pão brioche':1,'Blend 160g':2,'Queijo cheddar':2}},{id:4,name:'Batata crocante',price:14.9,recipe:{'Batata pré-frita':.2}},{id:5,name:'Refrigerante lata',price:6,recipe:{'Refrigerante lata':1}}];
 const selected=catalog.filter(item=>(quantities[item.id]||0)>0), total=selected.reduce((sum,item)=>sum+item.price*quantities[item.id],0);
 const filtered=attendanceOrders.filter(order=>filter==='Todos'||order.status===filter);
 const nextCode=String(attendanceOrders.reduce((max,order)=>Math.max(max,Number(order.code)||0),0)+1).padStart(3,'0');
 const pending=attendanceOrders.filter(order=>order.payment==='Pendente').length;
 function createOrder(event){event.preventDefault();if(!attendanceOpen){notify('Inicie o atendimento antes de lançar pedidos.');return;}if(!selected.length)return;
  const consumed={};selected.forEach(item=>Object.entries(item.recipe).forEach(([name,qty])=>consumed[name]=(consumed[name]||0)+qty*quantities[item.id]));
  for(const [name,qty] of Object.entries(consumed)){const product=products.find(item=>item.name===name&&item.stock!==null);if(!product||product.stock<qty){notify('Estoque demonstrativo insuficiente para '+name+'.');return;}}
  setProducts(prev=>prev.map(product=>product.stock!==null&&consumed[product.name]!==undefined?{...product,stock:Number((product.stock-consumed[product.name]).toFixed(2))}:product));
  setAttendanceOrders(prev=>[...prev,{id:Date.now(),code:nextCode,customer:customer.trim()||'Cliente demonstrativo',items:selected.map(item=>quantities[item.id]+'x '+item.name).join(', '),total,status:'Recebido',payment:'Pendente'}]);
  setQuantities({});setCustomer('');setShowNewOrder(false);notify('Pedido #'+nextCode+' lançado; estoque demonstrativo atualizado.');
 }
 function updateOrder(id,status){setAttendanceOrders(prev=>prev.map(order=>order.id===id?{...order,status}:order));}
 return <div className="burger-operations">
  <section className="panel attendance-control-card"><div><span className="public-kicker">OPERAÇÃO · P16</span><h2>{attendanceOpen?'Atendimento em andamento':'Atendimento encerrado'}</h2><p>{attendanceOpen?'Pedidos são lançados e acompanhados dentro deste atendimento.':'Inicie um atendimento para liberar os lançamentos.'}</p></div>
   {attendanceOpen?<button className="secondary-button" disabled={pending>0} onClick={()=>{setAttendanceOpen(false);setAttendanceOrders([]);notify('Atendimento encerrado.');}}>Encerrar atendimento</button>:<button className="primary-button" onClick={()=>{setAttendanceOrders([]);setAttendanceOpen(true);notify('Novo atendimento iniciado. Numeração reiniciada em 001.');}}>Iniciar atendimento</button>}
   {attendanceOpen&&<div className="attendance-open-meta"><span><strong>{attendanceOrders.length}</strong> pedidos neste atendimento</span><span><strong>{pending}</strong> pedidos sem recebimento</span><span>Próximo pedido <strong>#{nextCode}</strong></span></div>}
  </section>
  <div className="orders-intro"><div className="orders-intro-icon"><ClipboardList size={20}/></div><div><strong>Pedidos do atendimento</strong><p>Lançamento pela administração. Não há cardápio público ou envio de pedidos pelo cliente nesta versão.</p></div><span className="sample-tag"><BadgeCheck size={14}/> P16 · DEMO</span></div>
  {attendanceOpen&&<div className="module-toolbar"><span className="muted-text">Numeração sequencial por atendimento.</span><button className="primary-button" onClick={()=>setShowNewOrder(value=>!value)}><Plus size={16}/>{showNewOrder?'Fechar pedido':'Lançar pedido'}</button></div>}
  {showNewOrder&&attendanceOpen&&<section className="panel new-internal-order"><div className="panel-heading"><div><h3>Novo pedido interno</h3><p>Selecione produtos e quantidades; a baixa demonstrativa ocorre ao registrar.</p></div><strong className="order-code">#{nextCode}</strong></div>
   <form onSubmit={createOrder}><label>Cliente / identificação<input value={customer} onChange={event=>setCustomer(event.target.value)} placeholder="Ex.: Cliente balcão"/></label>
    <div className="internal-order-product-grid">{catalog.map(item=><article className="internal-order-product" key={item.id}><div><strong>{item.name}</strong><small>{money(item.price)}</small></div><div className="menu-quantity"><button type="button" disabled={!quantities[item.id]} onClick={()=>setQuantities(prev=>({...prev,[item.id]:Math.max(0,(prev[item.id]||0)-1)}))}>−</button><span>{quantities[item.id]||0}</span><button type="button" onClick={()=>setQuantities(prev=>({...prev,[item.id]:(prev[item.id]||0)+1}))}>+</button></div></article>)}</div>
    <div className="internal-order-footer"><span>Total do pedido<strong>{money(total)}</strong></span><button className="primary-button" type="submit" disabled={!selected.length}>Registrar pedido #{nextCode}</button></div>
   </form></section>}
  <div className="order-summary-grid"><div><span>Pedidos no atendimento</span><strong>{attendanceOrders.length.toString().padStart(2,'0')}</strong></div><div><span>Sem recebimento</span><strong>{pending.toString().padStart(2,'0')}</strong></div><div><span>Em preparo</span><strong>{attendanceOrders.filter(order=>order.status==='Em preparo').length.toString().padStart(2,'0')}</strong></div><div><span>Total dos pedidos</span><strong>{money(attendanceOrders.reduce((sum,order)=>sum+order.total,0))}</strong></div></div>
  <section className="panel table-panel"><div className="panel-heading"><div><h3>Lista de pedidos</h3><p>Recebido → em preparo → pronto → entregue; cancelamentos separados.</p></div><label className="select-filter"><Filter size={15}/><select value={filter} onChange={event=>setFilter(event.target.value)}><option>Todos</option><option>Recebido</option><option>Em preparo</option><option>Pronto</option><option>Entregue</option><option>Cancelado</option></select></label></div>
   <div className="data-table"><div className="table-head order-head"><span>Pedido</span><span>Cliente / origem</span><span>Itens</span><span>Total</span><span>Etapa / ação</span></div>{filtered.map(order=><div className="table-row order-head" key={order.id}><span><strong className="order-code">#{order.code}</strong></span><span>{order.customer||'Cliente demonstrativo'}</span><span className="order-items">{order.items}</span><strong>{money(order.total)}</strong><span className="order-actions"><StatusBadge status={order.status}/>{order.status==='Recebido'&&<button className="small-outline" onClick={()=>updateOrder(order.id,'Em preparo')}>Iniciar preparo</button>}{order.status==='Em preparo'&&<button className="small-outline" onClick={()=>updateOrder(order.id,'Pronto')}>Marcar pronto</button>}{order.status==='Pronto'&&<button className="small-outline" onClick={()=>updateOrder(order.id,'Entregue')}>Registrar entrega</button>}{!['Cancelado','Entregue'].includes(order.status)&&<button className="small-outline danger" onClick={()=>updateOrder(order.id,'Cancelado')}>Cancelar</button>}</span></div>)}</div>
   <div className="table-foot"><span>O valor do pedido não significa recebimento. A confirmação financeira é separada.</span></div>
  </section>
  <section className="panel future-feature-card"><div className="future-feature-icon"><MonitorSmartphone size={20}/></div><div><span className="eyebrow muted-eyebrow">POSSIBILIDADE DE PERSONALIZAÇÃO</span><h3>Acesso operacional para garçons pelo celular</h3><p>Um perfil individual poderia identificar o atendimento/mesa, lançar itens e encaminhar o pedido à administração. Esta expansão ainda não está desenvolvida no P16.</p><strong className="future-status">Ideia futura · não incluída na versão atual</strong></div></section>
 </div>;
}
function PromotionsPreview({promotions,setPromotions}){
 const [filter,setFilter]=useState('Todas');
 const visible=promotions.filter(item=>filter==='Todas'||item.status===filter);
 return <div className="promotions-preview"><div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Promoções e combos</strong><p>Recurso administrativo existente no P15; exemplos fictícios nesta prévia.</p></div><span className="sample-tag">EXEMPLO</span></div>
  <div className="module-toolbar"><label className="select-filter"><Filter size={15}/><select value={filter} onChange={event=>setFilter(event.target.value)}><option>Todas</option><option>Ativa</option><option>Programada</option><option>Pausada</option></select></label><button className="primary-button" onClick={()=>setPromotions(prev=>[...prev,{id:Date.now(),name:'Oferta demonstrativa',kind:'Serviço',services:['Serviço de exemplo'],regular:50,promo:40,validity:'Período configurável',status:'Programada'}])}><Plus size={16}/> Adicionar exemplo</button></div>
  <div className="promotion-preview-grid">{visible.map(item=><article className="panel promotion-preview-card" key={item.id}><div className="promotion-preview-top"><span className="promotion-kind-chip">{item.kind}</span><span className="promotion-status-chip">{item.status}</span></div><h3>{item.name}</h3><p>{item.services.join(' + ')}</p><div className="promotion-preview-price"><s>{money(item.regular)}</s><strong>{money(item.promo)}</strong></div><small>{item.validity}</small><button className="small-outline" onClick={()=>setPromotions(prev=>prev.map(promo=>promo.id===item.id?{...promo,status:promo.status==='Ativa'?'Pausada':'Ativa'}:promo))}>{item.status==='Ativa'?'Pausar exemplo':'Ativar exemplo'}</button></article>)}</div>
  <p className="booking-availability-note">A prévia representa a configuração administrativa de ofertas; nenhuma informação é gravada no P15 original.</p>
 </div>;
}

function OrderRows({orders}) { return <div className="simple-order-list">{orders.map(o=><div className="simple-order-row" key={o.id}><span className="order-mini-icon"><ShoppingBag size={16}/></span><span><strong>Pedido #{o.code}</strong><small>{o.items}</small></span><span className="order-list-right"><strong>{money(o.total)}</strong><StatusBadge status={o.status}/></span></div>)}</div>; }
function Modal({title,onClose,children}) { return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal-card"><div className="modal-heading"><div><span className="eyebrow muted-eyebrow">MODO DEMONSTRAÇÃO</span><h2>{title}</h2></div><button className="icon-quiet" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>{children}</section></div>; }



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
