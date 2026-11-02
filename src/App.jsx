import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, CircleDollarSign, ClipboardList, Clock3, CreditCard, DoorClosed, Eye, Filter, Grid2X2, LayoutDashboard, Menu, Package, PawPrint, Plus, Scissors, Search, Settings2, ShoppingBag, Sparkles, Store, Tag, Truck, Utensils, Wrench, Users, Wallet, X, Boxes, TrendingUp, MonitorSmartphone, LockKeyhole, LogOut, ArrowUpRight, MoreHorizontal, CheckCircle2, CircleHelp, Code2, Instagram, Linkedin, ShieldCheck, Star
} from 'lucide-react';
import SiteModuleView from './components/SiteModule.jsx';
import BookingTimeWheelPicker from './components/BookingTimeWheelPicker.jsx';
import EnhancedAppointmentsModule from './components/EnhancedAppointmentsModule.jsx';
import EnhancedClientsModule from './components/EnhancedClientsModule.jsx';
import EnhancedFinanceModule from './components/EnhancedFinanceModule.jsx';
import BurgerOrdersModule from './components/BurgerOrdersModule.jsx';
import { BurgerProductsModule, BurgerInventoryModule } from './components/BurgerCatalogModules.jsx';
import { ModuleBrief, ScreenGuide } from './components/ContextualGuide.jsx';

const publicAsset = (filename) => `${import.meta.env.BASE_URL}${filename}`;
const INSTAGRAM_URL = 'https://www.instagram.com/2r.ruanrodrigues/';
const CUSTOM_WHATSAPP_URL = 'https://wa.me/5567998042465?text=Ol%C3%A1%2C%20Ruan!%20Conheci%20o%20portf%C3%B3lio%20da%202R%20e%20gostaria%20de%20conversar%20sobre%20uma%20aplica%C3%A7%C3%A3o%20personalizada%20para%20meu%20neg%C3%B3cio.';

const DEMOS = [
  { id:'landing', name:'2R Landing Pages', segment:'Vitrine', title:'Landing pages', description:'Apresente os três modelos de página e alterne entre Beauty, Barber e Burger sem trocar de página de demonstração.', modules:['site'], highlight:'Modelos de apresentação', color:'blue', icon:'site' },
  { id:'beauty.agenda', name:'2R Beauty Agenda', segment:'Beauty', title:'Agendamentos e administração básica', description:'Agendamento público para clientes, agenda do dia, serviços e cadastros fictícios para apresentar a rotina de uma profissional.', modules:['overview','booking','appointments','clients','services','servicePromotions','blocks','policies'], color:'rose', icon:'beauty' },
  { id:'beauty.financeiro', name:'2R Beauty Financeiro', segment:'Beauty', title:'Financeiro', description:'Demonstração isolada de receitas, despesas, movimentações e resumo do período.', modules:['finance'], color:'rose', icon:'finance' },
  { id:'beauty.siteagenda', name:'2R Beauty Web + Agenda', segment:'Beauty', title:'Landing page + agendamentos', description:'Página pública para apresentar serviços e um fluxo de agendamento demonstrativo.', modules:['site','booking','appointments','clients','services','servicePromotions','blocks','policies'], color:'rose', icon:'site' },
  { id:'beauty.agenda.financeiro', name:'2R Beauty Gestão', segment:'Beauty', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda administrativa, clientes, serviços e financeiro; sem landing page de marketing neste pacote.', modules:['overview','booking','appointments','clients','services','servicePromotions','blocks','policies','finance'], color:'rose', icon:'finance' },
  { id:'beauty.completo', name:'2R Beauty Completo', segment:'Beauty', title:'Solução completa Beauty', description:'Experiência completa com landing page, agendamentos, gestão administrativa e financeiro.', modules:['site','overview','booking','appointments','clients','services','servicePromotions','blocks','policies','finance'], color:'rose', icon:'sparkles' },
  { id:'barber.agenda', name:'2R Barber Agenda', segment:'Barber', title:'Agendamentos e administração', description:'Agendamento público para clientes, agenda administrativa, procedimentos, profissionais, promoções e gestão básica de uma barbearia.', modules:['overview','booking','appointments','clients','services','servicePromotions','blocks','policies'], color:'amber', icon:'barber' },
  { id:'barber.siteagenda', name:'2R Barber Web + Agenda', segment:'Barber', title:'Landing page + agendamentos', description:'Página de apresentação da barbearia integrada ao exemplo de agendamentos.', modules:['site','booking','appointments','clients','services','servicePromotions','blocks','policies'], color:'amber', icon:'site' },
  { id:'barber.agenda.financeiro', name:'2R Barber Gestão', segment:'Barber', title:'Agendamentos + gestão + financeiro', description:'Agendamento público, agenda, serviços, clientes e financeiro para demonstrar uma gestão mais completa.', modules:['overview','booking','appointments','clients','services','servicePromotions','blocks','policies','finance'], color:'amber', icon:'finance' },
  { id:'barber.completo', name:'2R Barber Completo', segment:'Barber', title:'Solução completa Barber', description:'Landing page, agendamentos e administração completa com dados de demonstração.', modules:['site','overview','booking','appointments','clients','services','servicePromotions','blocks','policies','finance'], color:'amber', icon:'sparkles' },
  { id:'burger.pedidos', name:'2R Burger Pedidos', segment:'Burger', title:'Pedidos e operação', description:'Operação interna de atendimento, lançamento de pedidos, acompanhamento do preparo e controle de estoque.', modules:['overview','orders','products','inventory'], color:'orange', icon:'orders' },
  { id:'burger.gestao', name:'2R Burger Gestão', segment:'Burger', title:'Financeiro, produtos e estoque', description:'Controle demonstrativo de produtos, estoque e movimentações financeiras.', modules:['overview','finance','products','inventory'], color:'orange', icon:'inventory' },
  { id:'burger.gestao.pedidos', name:'2R Burger Gestão + Pedidos', segment:'Burger', title:'Pedidos, gestão e financeiro', description:'Pedidos, produtos, estoque e financeiro reunidos em uma só modalidade, sem landing page.', modules:['overview','orders','products','inventory','finance'], color:'orange', icon:'sparkles' },
  { id:'burger.completo', name:'2R Burger Completo', segment:'Burger', title:'Solução completa Burger', description:'Landing page, operação interna de pedidos, produtos, estoque e financeiro reunidos em uma demonstração.', modules:['site','overview','orders','products','inventory','finance'], color:'orange', icon:'sparkles' },
];

const MODULES = {
  site: { label:'Landing page', icon:Store, description:'Página estratégica para apresentar um negócio e direcionar contatos' },
  overview: { label:'Visão geral', icon:LayoutDashboard, description:'Resumo da operação' },
  booking: { label:'Agendamento público', icon:CalendarDays, description:'Página do cliente para escolher serviço e horário' },
  appointments: { label:'Agendamentos', icon:CalendarDays, description:'Agenda e atendimentos' },
  servicePromotions: { label:'Promoções', icon:Tag, description:'Ofertas, combos e preços promocionais de serviços' },
  blocks: { label:'Bloqueios', icon:DoorClosed, description:'Folgas, compromissos e períodos indisponíveis na agenda' },
  policies: { label:'Políticas', icon:ShieldCheck, description:'Orientações sobre atrasos, cancelamentos, acompanhantes e faltas' },
  clients: { label:'Clientes', icon:Users, description:'Base de clientes fictícios' },
  services: { label:'Serviços', icon:Scissors, description:'Procedimentos e duração' },
  finance: { label:'Financeiro', icon:Wallet, description:'Receitas, despesas e saldo' },
  orders: { label:'Pedidos', icon:ClipboardList, description:'Acompanhamento dos pedidos' },
  products: { label:'Produtos', icon:Package, description:'Catálogo demonstrativo' },
  inventory: { label:'Estoque', icon:Boxes, description:'Entradas e quantidades' },
};

const INITIAL_DEMO_POLICIES = {
  latenessTolerance: 10,
  cancellationNotice: 24,
  companionPolicy: 'O espaço de atendimento é reservado para a pessoa agendada. Consulte a profissional antes de levar acompanhantes.',
  noShowPolicy: 'Em caso de imprevisto, avise com antecedência. Regras de sinal e faltas devem ser confirmadas diretamente com o estabelecimento.',
  showLateness: false,
  showCancellation: false,
  showCompanion: false,
  showNoShow: false,
};

function dateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function seedBlocksForSegment(segment) {
  return segment === 'Barber'
    ? [
        {id:8101,date:dateAfterDays(2),start:'13:00',end:'14:30',scope:'professional',professional:'Profissional 1',reason:'Compromisso pessoal'},
        {id:8102,date:dateAfterDays(5),start:'',end:'',scope:'business',professional:'',reason:'Manutenção do espaço'}
      ]
    : [
        {id:8201,date:dateAfterDays(3),start:'12:00',end:'14:00',scope:'business',professional:'',reason:'Compromisso pessoal'},
        {id:8202,date:dateAfterDays(7),start:'',end:'',scope:'business',professional:'',reason:'Pausa programada'}
      ];
}

const INITIAL_APPOINTMENTS = [
  { id:1, client:'Mariana Costa', contact:'(67) 99999-0001', service:'Maquiagem social', time:'09:00', date:'Hoje', status:'Confirmado', price:160 },
  { id:2, client:'Camila Oliveira', contact:'(67) 99999-0002', service:'Design de sobrancelhas', time:'10:30', date:'Hoje', status:'Confirmado', price:40 },
  { id:3, client:'Juliana Martins', contact:'(67) 99999-0003', service:'Lash lifting', time:'13:00', date:'Hoje', status:'Aguardando', price:150 },
  { id:4, client:'Bianca Souza', contact:'(67) 99999-0004', service:'Design de sobrancelhas', time:'15:00', date:'Hoje', status:'Confirmado', price:40 },
];
const INITIAL_PRODUCTS = [
  { id:1, name:'Smash clássico', category:'Hambúrgueres', kind:'prepared', sellable:true, stockTracked:false, cost:12, price:29.90, stock:null, minimum:0, unit:'porcao' },
  { id:2, name:'Combo Brasa', category:'Combos', kind:'prepared', sellable:true, stockTracked:false, cost:16, price:39.90, stock:null, minimum:0, unit:'porcao' },
  { id:3, name:'Smash duplo', category:'Hambúrgueres', kind:'prepared', sellable:true, stockTracked:false, cost:15, price:36.90, stock:null, minimum:0, unit:'porcao' },
  { id:4, name:'Batata crocante', category:'Acompanhamentos', kind:'prepared', sellable:true, stockTracked:false, cost:4, price:14.90, stock:null, minimum:0, unit:'porcao' },
  { id:5, name:'Refrigerante lata', category:'Bebidas', kind:'resale', sellable:true, stockTracked:true, cost:3.20, price:6.00, stock:34, minimum:12, unit:'un' },
  { id:6, name:'Água mineral', category:'Bebidas', kind:'resale', sellable:true, stockTracked:true, cost:1.10, price:4.00, stock:24, minimum:8, unit:'un' },
];
const INITIAL_ORDERS = [
  { id:101, code:'001', sessionId:'historico-demo-1', date:'Hoje', customer:'Cliente demonstrativo 01', items:'2x Smash clássico, 1x Batata crocante', productItems:[{productId:1,name:'Smash clássico',quantity:2,unit:'porcao',unitPrice:29.90,stockTracked:false},{productId:4,name:'Batata crocante',quantity:1,unit:'porcao',unitPrice:14.90,stockTracked:false}], total:74.70, status:'Entregue', payment:'Pendente' },
  { id:102, code:'002', sessionId:'historico-demo-1', date:'Hoje', customer:'Cliente demonstrativo 02', items:'1x Combo Brasa', productItems:[{productId:2,name:'Combo Brasa',quantity:1,unit:'porcao',unitPrice:39.90,stockTracked:false}], total:39.90, status:'Entregue', payment:'Pendente' },
  { id:103, code:'003', sessionId:'historico-demo-1', date:'Ontem', customer:'Cliente demonstrativo 03', items:'1x Smash duplo, 2x Refrigerante lata', productItems:[{productId:3,name:'Smash duplo',quantity:1,unit:'porcao',unitPrice:36.90,stockTracked:false},{productId:5,name:'Refrigerante lata',quantity:2,unit:'un',unitPrice:6,stockTracked:true}], total:48.90, status:'Entregue', payment:'Recebido', paymentMethod:'Pix', paymentDate:'Ontem' },
];
const INITIAL_STOCK_MOVEMENTS = [
  { id:401, productId:5, productName:'Refrigerante lata', type:'initial', quantity:36, unit:'un', date:'Hoje', reason:'Estoque inicial demonstrativo', before:0, after:36 },
  { id:402, productId:6, productName:'Água mineral', type:'initial', quantity:24, unit:'un', date:'Hoje', reason:'Estoque inicial demonstrativo', before:0, after:24 },
  { id:403, productId:5, productName:'Refrigerante lata', type:'order_consumption', quantity:2, unit:'un', date:'Ontem', reason:'Baixa automática do pedido #003', before:36, after:34 },
];
const INITIAL_TRANSACTIONS = [
  { id:1, description:'Atendimentos do dia', category:'Receita', date:'Hoje', value:890 },
  { id:2, description:'Compra de materiais', category:'Despesa', date:'Ontem', value:145 },
  { id:3, description:'Serviços realizados', category:'Receita', date:'Ontem', value:540 },
  { id:4, description:'Reposição de produtos', category:'Despesa', date:'27 out.', value:220 },
];
const INITIAL_PAYABLES = [
  { id: 501, description: 'Reposição de materiais', category: 'Materiais', amount: 185, dueDate: '2026-11-05', status: 'Em aberto' },
  { id: 502, description: 'Assinatura de ferramentas', category: 'Serviços', amount: 79.90, dueDate: '2026-11-10', status: 'Em aberto' },
  { id: 503, description: 'Compra de produtos', category: 'Estoque', amount: 132.50, dueDate: '2026-10-28', status: 'Paga', paidAt: '2026-10-28' },
];
const INITIAL_RECEIVABLES = [
  { id: 601, client: 'Mariana Costa', service: 'Maquiagem social', date: 'Hoje', total: 160, received: 40, balance: 120 },
  { id: 602, client: 'Camila Oliveira', service: 'Design de sobrancelhas', date: 'Ontem', total: 40, received: 0, balance: 40 },
];
const BURGER_PAYABLES = [
  { id: 551, description: 'Fornecedor de carnes e insumos', category: 'Insumos', amount: 480, dueDate: '2026-11-05', status: 'Em aberto' },
  { id: 552, description: 'Embalagens e descartáveis', category: 'Operação', amount: 126.50, dueDate: '2026-11-07', status: 'Em aberto' },
  { id: 553, description: 'Reposição de bebidas', category: 'Estoque', amount: 198.90, dueDate: '2026-10-30', status: 'Paga', paidAt: '2026-10-30' },
];
function burgerReceivablesFromOrders(orderList) {
  return orderList.filter(order => order.payment === 'Pendente' && order.status !== 'Cancelado').map(order => ({
    id:'order-' + order.id, orderId:order.id, orderNumber:order.code, client:order.customer,
    service:'Pedido #' + order.code, date:order.date || 'Hoje', total:order.total,
    received:0, balance:order.total, status:'Pendente', cancelled:false
  }));
}

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
  { id:21, client:'Lucas Mendes', contact:'(67) 99999-0101', service:'Corte degradê', time:'09:00', date:'Hoje', status:'Confirmado', price:55, professional:'Profissional 1' },
  { id:22, client:'Pedro Henrique', contact:'(67) 99999-0102', service:'Barba completa', time:'10:00', date:'Hoje', status:'Confirmado', price:35, professional:'Profissional 2' },
  { id:23, client:'André Costa', contact:'(67) 99999-0103', service:'Corte + barba', time:'11:30', date:'Hoje', status:'Aguardando', price:80, professional:'Profissional 1' },
  { id:24, client:'Rafael Martins', contact:'(67) 99999-0104', service:'Corte degradê', time:'14:00', date:'Hoje', status:'Confirmado', price:55, professional:'Profissional 1' },
];
const BARBER_TRANSACTIONS = [
  { id:21, description:'Cortes e serviços do dia', category:'Receita', date:'Hoje', value:620 },
  { id:22, description:'Compra de produtos de barbearia', category:'Despesa', date:'Ontem', value:180 },
  { id:23, description:'Atendimentos de sábado', category:'Receita', date:'25 out.', value:840 },
  { id:24, description:'Materiais de consumo', category:'Despesa', date:'24 out.', value:95 },
];
const BURGER_TRANSACTIONS = [
  { id:31, description:'Pedidos do salão e balcão', category:'Receita', detailCategory:'Pedidos presenciais', date:'Hoje', value:684.50, paymentMethod:'Pix' },
  { id:32, description:'Compra de ingredientes', category:'Despesa', detailCategory:'Insumos', date:'Ontem', value:246.80, paymentMethod:'Cartão' },
  { id:33, description:'Pedidos delivery', category:'Receita', detailCategory:'Delivery', date:'Ontem', value:428.90, paymentMethod:'Dinheiro' },
  { id:34, description:'Embalagens e descartáveis', category:'Despesa', detailCategory:'Operação', date:'27 out.', value:86.40, paymentMethod:'Pix' },
  { id:'order-payment-103', sourceId:103, source:'Pedido', description:'Pedido #003 · Cliente demonstrativo 03', category:'Receita', detailCategory:'Vendas de pedidos', date:'Ontem', value:48.90, paymentMethod:'Pix' },
  { id:'payable-payment-553', description:'Reposição de bebidas', category:'Despesa', detailCategory:'Estoque', date:'30 out.', value:198.90, paymentMethod:'Pix', source:'Conta a pagar' },
];
function getSeedData(segment) {
  const seed = segment === 'Barber'
    ? { appointments:BARBER_APPOINTMENTS, clients:BARBER_CLIENTS, services:BARBER_SERVICES, transactions:BARBER_TRANSACTIONS, orders:[], products:[], stockMovements:[] }
    : segment === 'Burger'
      ? { appointments:[], clients:[], services:[], transactions:BURGER_TRANSACTIONS, orders:INITIAL_ORDERS, products:INITIAL_PRODUCTS, stockMovements:INITIAL_STOCK_MOVEMENTS }
      : { appointments:INITIAL_APPOINTMENTS, clients:CLIENTS, services:SERVICES, transactions:INITIAL_TRANSACTIONS, orders:[], products:[], stockMovements:[] };
  return Object.fromEntries(Object.entries(seed).map(([key,values]) => [
    key, values.map(item => ({ ...item, ...(Array.isArray(item.productItems) ? { productItems:item.productItems.map(line => ({ ...line })) } : {}) }))
  ]));
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceOrders, setAttendanceOrders] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [policies, setPolicies] = useState(INITIAL_DEMO_POLICIES);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [payables, setPayables] = useState(INITIAL_PAYABLES);
  const [receivables, setReceivables] = useState(INITIAL_RECEIVABLES);
  const [clients, setClients] = useState(CLIENTS);
  const [services, setServices] = useState(SERVICES);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [siteSegment, setSiteSegment] = useState('Beauty');
  const [appointmentForm, setAppointmentForm] = useState({client:'',contact:'',service:'Design de sobrancelhas',date:localDateValue(),time:'16:00'});

  const visibleDemos = useMemo(() => DEMOS.filter(demo => {
    const matchesText = `${demo.name} ${demo.title} ${demo.description}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'Todos' || demo.segment === filter;
    return matchesText && matchesFilter;
  }), [search, filter]);

  const featuredDemoIds = ['beauty.agenda.financeiro', 'barber.agenda.financeiro', 'burger.gestao.pedidos'];
  const isFeaturedDemo = (demo) => featuredDemoIds.includes(demo.id);

  useEffect(() => {
    const scrollToStart = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const main = document.querySelector('.demo-main');
      if (main) main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const layout = document.querySelector('.demo-layout');
      if (layout) layout.scrollTop = 0;
    };
    window.requestAnimationFrame(scrollToStart);
  }, [activeDemo?.id, activeModule, page]);

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
    setAttendanceOpen(false);
    setAttendanceOrders([]);
    setCurrentSessionId(null);
    setStockMovements(seed.stockMovements);
    setPromotions(demo.segment === 'Beauty' ? [
      {id:1,name:'Semana da beleza',kind:'Serviço',services:['Maquiagem social'],regular:160,promo:140,validity:'05 a 15 nov. 2026',status:'Ativa'},
      {id:2,name:'Combo olhar',kind:'Combo',services:['Design de sobrancelhas','Tintura de sobrancelhas'],regular:60,promo:50,validity:'A partir de 10 nov. 2026',status:'Programada'}
    ] : [
      {id:1,name:'Combo corte + barba',kind:'Combo',services:['Corte degradê','Barba completa'],regular:90,promo:75,validity:'05 a 15 nov. 2026',status:'Ativa'},
      {id:2,name:'Acabamento especial',kind:'Serviço',services:['Acabamento'],regular:20,promo:15,validity:'A partir de 10 nov. 2026',status:'Programada'}
    ]);
    setBlocks(seedBlocksForSegment(demo.segment));
    setPolicies(INITIAL_DEMO_POLICIES);
    setProducts(seed.products);
    setTransactions(seed.transactions);
    setPayables((demo.segment === 'Burger' ? BURGER_PAYABLES : INITIAL_PAYABLES).map(item=>({...item})));
    setReceivables(demo.segment === 'Barber'
      ? [{id:611,client:'Lucas Mendes',service:'Corte degradê',date:'Hoje',total:55,received:15,balance:40,status:'Pendente'},{id:612,client:'Pedro Henrique',service:'Barba completa',date:'Ontem',total:35,received:0,balance:35,status:'Pendente'}]
      : demo.segment === 'Burger' ? burgerReceivablesFromOrders(seed.orders) : INITIAL_RECEIVABLES.map(item=>({...item,status:'Pendente'})));
    setClients(seed.clients);
    setServices(seed.services);
    setAppointmentForm({client:'',contact:'',service:seed.services[0]?.name || '',date:localDateValue(),time:'16:00'});
    setModal(null);
    setGuideOpen(window.matchMedia('(max-width: 760px)').matches);
  }
  function exitDemo() { setActiveDemo(null); setGuideOpen(false); setPage('catalog'); }
  function canUse(module) { return activeDemo?.modules.includes(module); }
  function changeModule(module) {
    setGuideOpen(false);
    if (activeDemo?.modules.includes(module)) setActiveModule(module);
  }
  function resetFinanceExamples() {
    const isBurgerDemo = activeDemo?.segment === 'Burger';
    const seedTransactions = getSeedData(activeDemo?.segment || 'Beauty').transactions;
    if (isBurgerDemo) {
      const orderPayments = orders.filter(order => order.payment === 'Recebido' && order.status !== 'Cancelado').map(order => ({
        id:'order-payment-' + order.id, sourceId:order.id, source:'Pedido',
        description:'Pedido #' + order.code + ' · ' + order.customer,
        category:'Receita', detailCategory:'Vendas de pedidos',
        date:order.paymentDate || order.date || localDateValue(),
        value:Number(order.total), paymentMethod:order.paymentMethod || 'Não informado'
      }));
      setTransactions([...orderPayments, ...seedTransactions.filter(item => item.source !== 'Pedido' || !orderPayments.some(payment => payment.sourceId === item.sourceId))]);
      setReceivables(burgerReceivablesFromOrders(orders));
    } else {
      setTransactions(seedTransactions);
      if (activeDemo?.segment === 'Barber') setReceivables([
        {id:611,client:'Lucas Mendes',service:'Corte degradê',date:'Hoje',total:55,received:15,balance:40,status:'Pendente'},
        {id:612,client:'Pedro Henrique',service:'Barba completa',date:'Ontem',total:35,received:0,balance:35,status:'Pendente'}
      ]);
      else setReceivables(INITIAL_RECEIVABLES.map(item=>({...item,status:'Pendente'})));
    }
    setPayables((isBurgerDemo ? BURGER_PAYABLES : INITIAL_PAYABLES).map(item=>({...item})));
    notify('Exemplos financeiros restaurados.');
  }
  function resetBurgerInventory() {
    const seed = getSeedData('Burger');
    setProducts(seed.products);
    setStockMovements(seed.stockMovements);
    setOrders(seed.orders);
    setAttendanceOrders([]);
    setAttendanceOpen(false);
    setCurrentSessionId(null);
    setTransactions(seed.transactions);
    setPayables(BURGER_PAYABLES.map(item=>({...item})));
    setReceivables(burgerReceivablesFromOrders(seed.orders));
    notify('Dados demonstrativos do Burger restaurados: pedidos, caixa, produtos e estoque.');
  }
  function updateAppointmentsAndFinance(updater) {
    const nextAppointments = typeof updater === 'function' ? updater(appointments) : updater;
    setAppointments(nextAppointments);
    setReceivables(previous => previous.map(receivable => {
      if (receivable.orderId) return receivable;
      const appointment = nextAppointments.find(item => item.id === receivable.id);
      if (!appointment) return receivable;
      if (['Cancelado', 'Não compareceu'].includes(appointment.status)) {
        return { ...receivable, cancelled:true, status:'Cancelado', balance:0 };
      }
      if (receivable.cancelled) {
        return {
          ...receivable, cancelled:false, status:'Pendente',
          balance:Math.max(0, Number(receivable.total || 0) - Number(receivable.received || 0))
        };
      }
      return receivable;
    }));
  }
  function resetAppointmentsExamples() {
    const currentIds = new Set(appointments.map(item => item.id));
    setAppointments(getSeedData(activeDemo?.segment || 'Beauty').appointments);
    setReceivables(previous => previous.filter(item => item.orderId || !currentIds.has(item.id)));
    notify('Exemplos de agendamentos restaurados.');
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
            <article><span>03</span><div><strong>Teste a demonstração</strong><p>Use as abas visíveis da demonstração e experimente os botões e formulários.</p></div></article>
          </div>
          <button className="mobile-guide-card" type="button" onClick={()=>setGuideOpen(true)}>
            <span className="mobile-guide-card-icon"><CircleHelp size={20}/></span>
            <span className="mobile-guide-card-copy"><strong>Está no celular? Veja como explorar.</strong><small>Um guia rápido, pensado para navegação por toque.</small></span>
            <span className="mobile-guide-card-action">Abrir guia <ArrowRight size={15}/></span>
          </button>

          {['Vitrine','Beauty','Barber','Burger'].filter(group=>filter==='Todos'||filter===group).map(group=>{
            const list=visibleDemos.filter(d=>d.segment===group).sort((a,b)=>Number(isFeaturedDemo(b))-Number(isFeaturedDemo(a)));
            if (!list.length) return null;
            return <div className="segment-group" key={group}><div className="segment-heading"><div className={`segment-icon ${group.toLowerCase()}`}>{group==='Vitrine'?<MonitorSmartphone size={18}/>:group==='Beauty'?<Sparkles size={18}/>:group==='Barber'?<Scissors size={18}/>:<ShoppingBag size={18}/>}</div><div><h3>{group==='Vitrine'?'Modelos de landing page':group==='Beauty'?'Beauty & estética':group==='Barber'?'Barbearia':'Pedidos & alimentação'}</h3><p>{group==='Vitrine'?'Demonstre diferentes estilos de página':group==='Beauty'?'Agenda, gestão e financeiro para profissionais da beleza':group==='Barber'?'Agenda e gestão para barbearias':'Pedidos, produtos, estoque e financeiro'}</p></div><span className="group-count">{list.length} {list.length===1?'modalidade':'modalidades'}</span></div>
              <div className="demo-grid">{list.map((demo,index)=><article className={`demo-card ${demo.color} ${isFeaturedDemo(demo) ? 'featured-demo-card' : ''}`} key={demo.id} style={{'--card-index':index}}><div className="demo-card-top"><div className={`demo-card-icon ${demo.color}`}><IconForDemo demo={demo}/></div><span className="demo-segment-tag">{demo.segment==='Vitrine'?'LANDING PAGE':demo.segment.toUpperCase()}</span>{isFeaturedDemo(demo)&&<span className="demo-featured-badge"><Star size={12} fill="currentColor"/> MAIS INDICADO</span>}</div><h4>{demo.name}</h4><div className="demo-card-title">{demo.title}</div><p>{demo.description}</p><div className="module-chips">{demo.modules.filter(m=>m!=='overview').slice(0,4).map(m=><span key={m}>{MODULES[m].label}</span>)}{demo.modules.filter(m=>m!=='overview').length>4&&<span>+{demo.modules.filter(m=>m!=='overview').length-4}</span>}</div>
                
                <button className="enter-demo-button" onClick={()=>enterDemo(demo)}><span>{isFeaturedDemo(demo)?'Conhecer Gestão':'Visualizar modalidade'}</span><ArrowUpRight size={17}/></button></article>)}</div>
            </div>;
          })}
          {visibleDemos.length===0&&<div className="empty-state"><Search size={28}/><strong>Nenhuma modalidade encontrada</strong><span>Tente outro nome, recurso ou segmento.</span></div>}
          <section className="custom-solutions-note" aria-labelledby="catalog-custom-title">
            <div className="custom-solutions-note-icon"><Sparkles size={22}/></div>
            <div className="custom-solutions-note-copy">
              <span>SEU SEGMENTO NÃO ESTÁ AQUI?</span>
              <h3 id="catalog-custom-title">As possibilidades vão além destas demonstrações.</h3>
              <p>Beauty, Barber e Burger são exemplos. A 2R desenvolve aplicações web personalizadas para diferentes tipos de negócio, com recursos planejados de acordo com cada operação.</p>
            </div>
            <div className="custom-solutions-note-actions">
              <a href={CUSTOM_WHATSAPP_URL} target="_blank" rel="noreferrer"><WhatsAppIcon size={16}/> Conversar sobre meu projeto</a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={16}/> Instagram da 2R</a>
            </div>
          </section>
        </section>

        <section className="access-note portfolio-demo-disclaimer"><div className="access-note-icon"><Eye size={20}/></div><div className="access-note-copy"><strong>Prévia visual, sem login e sem cadastro</strong><p>As telas usam informações fictícias. Os botões e formulários servem apenas para demonstrar os fluxos; nada é enviado a clientes ou gravado em banco de dados.</p></div></section>
      </main>
      <footer className="footer"><span>2R INFORMÁTICA · Seu parceiro em Tecnologia</span><span><span className="footer-dot"/> Dados fictícios para demonstração</span></footer>
      {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
      {guideOpen&&<ScreenGuide mode="catalog" demo={null} module="catalog" onClose={()=>setGuideOpen(false)}/>}
    </div>;
  }

  const currentModules = activeDemo.modules;
  const isBurger = activeDemo.segment === 'Burger';
  const isBarber = activeDemo.segment === 'Barber';
  const segmentLabel = isBurger ? 'Burger' : isBarber ? 'Barber' : 'Beauty';

  return <div className={`app-shell demo-app ${activeDemo.color}`}>
    <header className="topbar demo-topbar"><div className="brand-lockup"><div className="brand-mark">2R</div><div><div className="brand-name">2R INFORMÁTICA</div><div className="brand-tagline">Prévia visual de modalidades</div></div></div><div className="demo-topbar-right"><span className={`workspace-badge ${activeDemo.color}`}><span className="workspace-dot"/>{activeDemo.segment==='Vitrine'?'LANDING PAGES':activeDemo.segment.toUpperCase()}</span><button className="mobile-guide-trigger" type="button" onClick={()=>setGuideOpen(true)} aria-label="Abrir orientações desta tela" title="Orientações desta tela"><CircleHelp size={18}/></button><button className="back-hub-button" onClick={exitDemo}><ArrowLeft size={16}/><span>Voltar às modalidades</span></button></div></header>
    <div className="demo-layout">
      <aside className="sidebar"><div className="sidebar-workspace"><div className={`workspace-avatar ${activeDemo.color}`}><IconForDemo demo={activeDemo}/></div><div className="workspace-meta"><strong>{activeDemo.name}</strong><span>Prévia visual do pacote</span></div></div><div className="sidebar-section-label">NAVEGAR NA PRÉVIA</div><nav className="side-nav" aria-label="Navegação das áreas da demonstração">{currentModules.map(module=>{const item=MODULES[module];const Icon=item.icon;return <button key={module} className={`side-nav-item ${activeModule===module?'active':''}`} onClick={()=>changeModule(module)}><Icon size={18}/><span>{item.label}</span>{activeModule===module&&<span className="nav-active-mark"/>}</button>})}</nav><div className="sidebar-bottom"><div className="demo-data-note"><div><Sparkles size={15}/><strong>Modo demonstração</strong></div><p>Use as abas de navegação para alternar entre telas e experimente os botões. As alterações são temporárias e reiniciam ao recarregar.</p></div><button className="side-nav-item exit-item" onClick={exitDemo}><LogOut size={18}/><span>Voltar às modalidades</span></button></div></aside>
      <main className="demo-main">
        <div className="demo-breadcrumb"><span>Central 2R</span><ArrowRight size={13}/><span>{activeDemo.segment}</span><ArrowRight size={13}/><strong>{MODULES[activeModule]?.label || 'Demonstração'}</strong></div>
        <div className="main-title-row"><div><div className="eyebrow muted-eyebrow">{activeDemo.name.toUpperCase()}</div><h1>{activeModule==='site'?'Landing pages na prática':MODULES[activeModule]?.label || activeDemo.title}</h1><p>{activeModule==='site'?'Entenda o papel de uma página de apresentação e explore um exemplo visual.':MODULES[activeModule]?.description || activeDemo.description}</p></div><div className="main-title-actions"><span className="fake-live"><span className="pulse-dot"/> PRÉVIA INTERATIVA</span><button className="secondary-button" onClick={exitDemo}><Grid2X2 size={16}/> Catálogo</button></div></div>
        <ModuleBrief demo={activeDemo} module={activeModule} onOpenGuide={()=>setGuideOpen(true)} />
        {activeModule==='site'&&<SiteModuleView activeDemo={activeDemo} siteSegment={siteSegment} setSiteSegment={setSiteSegment} onCta={()=>{if(canUse('booking')&&siteSegment!=='Burger'){changeModule('booking');return;}if(siteSegment==='Burger'){notify('Em uma página de alimentação, este botão pode abrir o WhatsApp ou endereço da loja. Os pedidos do P16 são lançados pela equipe na área interna, não por um cardápio público.');return;}notify('O destino deste botão é definido conforme o objetivo do negócio: WhatsApp, formulário, agendamento ou outro canal de contato. Nesta prévia, nenhum envio é realizado.');}} />}
        {activeModule==='overview'&&<OverviewModule demo={activeDemo} appointments={appointments} orders={orders} products={products} transactions={transactions} changeModule={changeModule}/>} 
         {activeModule==='booking'&&<PublicBookingModule segment={segmentLabel} services={services} onBook={(payload)=>{const appointmentId=Date.now();setAppointments(prev=>[...prev,{id:appointmentId,client:payload.client,contact:payload.contact,service:payload.services.map(item=>item.name).join(' + '),time:payload.time,date:payload.date,status:'Confirmado',price:payload.total,professional:payload.professionalAssignments?.map(item=>item.service+': '+item.professional).join(' · ')}].sort((a,b)=>a.time.localeCompare(b.time)));setClients(prev=>prev.some(item=>item.name.toLowerCase()===payload.client.toLowerCase()||String(item.contact||'').replace(/\D/g,'')===String(payload.contact||'').replace(/\D/g,''))?prev:[{name:payload.client,contact:payload.contact,visits:1,last:'Hoje'},...prev]);setReceivables(prev=>[...prev,{id:appointmentId,client:payload.client,service:payload.services.map(item=>item.name).join(' + '),date:payload.date,total:payload.total,received:0,balance:payload.total}]);notify('Agendamento fictício confirmado. O cadastro do cliente foi associado automaticamente.');}} />}
         {activeModule==='orders'&&<BurgerOrdersModule attendanceOpen={attendanceOpen} setAttendanceOpen={setAttendanceOpen} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId} attendanceOrders={attendanceOrders} setAttendanceOrders={setAttendanceOrders} orders={orders} setOrders={setOrders} products={products} setProducts={setProducts} setStockMovements={setStockMovements} setTransactions={setTransactions} setReceivables={setReceivables} notify={notify} />}
        {activeModule==='appointments'&&<EnhancedAppointmentsModule appointments={appointments} setAppointments={updateAppointmentsAndFinance} openModal={()=>{setAppointmentForm({client:'',contact:'',service:services[0]?.name||'',date:localDateValue(),time:'16:00'});setModal('appointment');}} resetAppointments={resetAppointmentsExamples} />}
        {activeModule==='clients'&&<EnhancedClientsModule clients={clients} setClients={setClients} notify={notify} />}
        {activeModule==='services'&&<ServicesModule services={services} onIllustrativeAction={()=>notify('A inclusão e edição de serviços são ilustrativas nesta central. A configuração completa está disponível no sistema contratado.')} />}
        {activeModule==='finance'&&<EnhancedFinanceModule variant={isBurger?'burger':'studio'} orders={orders} transactions={transactions} setTransactions={setTransactions} payables={payables} setPayables={setPayables} receivables={receivables} setReceivables={setReceivables} resetTransactions={()=>setTransactions(getSeedData(activeDemo.segment).transactions)} resetFinance={resetFinanceExamples} notify={notify} />}
        {activeModule==='servicePromotions'&&<PromotionsPreview promotions={promotions} setPromotions={setPromotions} segment={activeDemo.segment} />}
        {activeModule==='blocks'&&<BlocksPreview segment={activeDemo.segment} blocks={blocks} setBlocks={setBlocks} notify={notify} />}
        {activeModule==='policies'&&<PoliciesPreview segment={activeDemo.segment} policies={policies} setPolicies={setPolicies} notify={notify} />}
        {activeModule==='products'&&<BurgerProductsModule products={products} setProducts={setProducts} setStockMovements={setStockMovements} orders={orders} notify={notify} />}
        {activeModule==='inventory'&&<BurgerInventoryModule products={products} setProducts={setProducts} stockMovements={stockMovements} setStockMovements={setStockMovements} notify={notify} resetInventory={resetBurgerInventory} />}
        {(activeDemo.segment !== 'Burger' || activeModule === 'overview') && AUTOMATION_NOTES[activeDemo.segment] && <section className="panel automation-panel preview-automation-panel">
          <div className="automation-heading"><div className="automation-icon"><Activity size={20}/></div><div><span className="eyebrow muted-eyebrow">COMO AS ÁREAS SE CONECTAM</span><h2>{AUTOMATION_NOTES[activeDemo.segment].title}</h2><p>Resumo ilustrativo do que esta modalidade pode reunir.</p></div></div>
          <div className="automation-points">{AUTOMATION_NOTES[activeDemo.segment].points.map((point,index)=><div className="automation-point" key={point}><span>{String(index+1).padStart(2,'0')}</span><p>{point}</p></div>)}</div>
        </section>}
        <div className="demo-footer-note"><Eye size={14}/><span>Como testar: navegue pelas abas visíveis logo abaixo do cabeçalho, abra formulários e experimente as ações. Os dados são fictícios, nada é enviado ou salvo e recarregar a página reinicia a demonstração.</span></div>
      </main>
    </div>
    {modal==='appointment'&&<Modal title="Novo agendamento de demonstração" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const phone=appointmentForm.contact.trim();const clientName=appointmentForm.client.trim()||'Cliente demonstrativo';const appointmentId=Date.now();const price=services.find(s=>s.name===appointmentForm.service)?.price||40;setAppointments(prev=>[...prev,{id:appointmentId,client:clientName,contact:phone,service:appointmentForm.service,time:appointmentForm.time,date:appointmentForm.date,status:'Aguardando',price}].sort((a,b)=>a.time.localeCompare(b.time)));setClients(prev=>prev.some(item=>item.name.toLowerCase()===clientName.toLowerCase()||(phone&&String(item.contact||'').replace(/\D/g,'')===phone.replace(/\D/g,'')))?prev:[{name:clientName,contact:phone||'Telefone não informado',visits:0,last:'Sem visitas'},...prev]);setReceivables(prev=>[...prev,{id:appointmentId,client:clientName,service:appointmentForm.service,date:appointmentForm.date,total:price,received:0,balance:price,status:'Pendente'}]);setModal(null);notify('Agendamento lançado. O cadastro do cliente e o valor a receber foram atualizados.');}}><label>Nome do cliente<input value={appointmentForm.client} onChange={e=>setAppointmentForm({...appointmentForm,client:e.target.value})} placeholder="Ex.: Ana Martins" required/></label><label>Telefone / WhatsApp<input type="tel" inputMode="tel" value={appointmentForm.contact} onChange={e=>setAppointmentForm({...appointmentForm,contact:e.target.value})} placeholder="(67) 99999-9999"/></label><p className="appointment-auto-customer-hint"><BadgeCheck size={14}/> Cliente lançado por aqui e ainda sem cadastro? Ao salvar, um cadastro demonstrativo será criado automaticamente e ficará disponível na aba Clientes.</p><div className="form-grid"><label>Serviço<select value={appointmentForm.service} onChange={e=>setAppointmentForm({...appointmentForm,service:e.target.value})}>{services.map(s=><option key={s.name}>{s.name}</option>)}</select></label><label>Data<input type="date" value={appointmentForm.date} onChange={e=>setAppointmentForm({...appointmentForm,date:e.target.value})} min={localDateValue()}/></label></div><label>Horário<input type="time" value={appointmentForm.time} onChange={e=>setAppointmentForm({...appointmentForm,time:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="primary-button"><Plus size={16}/> Adicionar agendamento</button></div></form></Modal>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    {guideOpen&&<ScreenGuide mode="demo" demo={activeDemo} module={activeModule} onClose={()=>setGuideOpen(false)}/>}
  </div>;
}


function MetricCard({label,value,delta,icon:Icon,kind='blue',footnote}) { return <div className="metric-card"><div className={`metric-icon ${kind}`}><Icon size={19}/></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><div className="metric-foot"><span className={delta?.startsWith('-')?'negative':'positive'}>{delta}</span>{footnote&&<span>{footnote}</span>}</div></div>; }
function OverviewModule({demo,appointments,orders,products,transactions,changeModule}) {
  const burger=demo.segment==='Burger';
  const hasOrders=demo.modules.includes('orders');
  const inMoney=transactions.filter(t=>t.category==='Receita').reduce((s,t)=>s+t.value,0);
  const outMoney=transactions.filter(t=>t.category==='Despesa').reduce((s,t)=>s+t.value,0);
  const revenue=hasOrders?orders.filter(o=>o.payment==='Recebido'&&o.status!=='Cancelado').reduce((s,o)=>s+o.total,0):inMoney;
  const waiting=hasOrders?orders.filter(o=>o.status==='Novo').length:appointments.filter(a=>a.status==='Aguardando').length;
  const quickModules=demo.modules.filter(m=>m!=='overview');
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
        <MetricCard label="Itens com estoque" value={products.filter(p=>p.stockTracked).length.toString().padStart(2,'0')} delta="Controlados" icon={Boxes} kind="purple" footnote="produtos"/>
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
function AppointmentRows({appointments,full=false,onStatusChange}) {
  return <div className={`data-table ${full?'full-table':''}`}><div className="table-head appt-head"><span>Horário</span><span>Cliente</span><span>Serviço</span><span>Status</span>{full&&<span>Ação</span>}</div>
    {appointments.map(a=><div className="table-row appt-head" key={a.id}><span className="time-cell"><Clock3 size={14}/>{a.time}</span><span className="client-cell"><span className="table-avatar">{a.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><span><strong>{a.client}</strong><small>{a.date}</small></span></span><span className="service-cell">{a.service}</span><span><StatusBadge status={a.status}/></span>
      {full&&<span className="appt-row-actions">{a.status==='Aguardando'&&<button className="small-outline" onClick={()=>onStatusChange?.(a.id,'Confirmado')}>Confirmar</button>}{a.status==='Confirmado'&&<button className="small-outline" onClick={()=>onStatusChange?.(a.id,'Concluído')}>Concluir</button>}{!['Cancelado','Concluído'].includes(a.status)&&<button className="small-outline danger" onClick={()=>onStatusChange?.(a.id,'Cancelado')}>Cancelar</button>}{['Cancelado','Concluído'].includes(a.status)&&<span className="muted-text">Encerrado</span>}</span>}
    </div>)}
  </div>;
}
function StatusBadge({status}) { let cls=status==='Confirmado'||status==='Pronto'||status==='Concluído'?'status-green':status==='Aguardando'||status==='Em preparo'?'status-amber':status==='Cancelado'?'status-red':'status-blue';return <span className={`status-badge ${cls}`}><span/>{status}</span>; }
function ProductTable({products}) {
  return <div className="data-table">
    <div className="table-head product-head"><span>Produto</span><span>Tipo</span><span>Estoque</span><span>Preço</span></div>
    {products.filter(item=>item.active!==false).slice(0,5).map(item=><div className="table-row product-head" key={item.id}>
      <span className="product-name"><span className="product-thumb"><Package size={17}/></span><strong>{item.name}</strong></span>
      <span><span className={'category-pill ' + (item.stockTracked?'in-stock':'made-to-order')}>{item.kind==='prepared'?'Preparado na hora':'Revenda'}</span></span>
      <span>{item.stockTracked?Number(item.stock).toLocaleString('pt-BR')+' '+item.unit:'Sob pedido'}</span>
      <span>{money(item.price)}</span>
    </div>)}
  </div>;
}
function ServicesModule({services,onIllustrativeAction}) {
  return <>
    <div className="module-toolbar services-demo-toolbar"><div><span className="muted-text">Catálogo demonstrativo de procedimentos e valores.</span></div><button type="button" className="primary-button" onClick={onIllustrativeAction}><Plus size={15}/> Adicionar serviço</button></div>
    <div className="service-card-grid">{services.map((s,i)=><article className="service-card" key={s.name}><div className={`service-number n${i+1}`}>{String(i+1).padStart(2,'0')}</div><div className="service-category">{s.type}</div><h3>{s.name}</h3><div className="service-detail"><Clock3 size={14}/>{s.duration}</div><div className="service-price">{money(s.price)}</div><div className="service-enabled"><span/>Disponível no exemplo</div></article>)}</div>
    <div className="service-helper"><Settings2 size={18}/><div><strong>Catálogo demonstrativo</strong><p>Os cartões representam os serviços cadastrados. O botão “Adicionar serviço” é ilustrativo nesta central e informa como funciona a personalização no sistema contratado.</p></div></div>
  </>;
}
function PublicBookingModule({segment,services,onBook}) {
  const [form,setForm] = useState({client:'',contact:'',services:services[0]?.name?[services[0].name]:[],date:localDateValue(),time:'10:00',professionalByService:{}});
  const [completed,setCompleted] = useState(false);
  const selectedServices = services.filter(service=>form.services.includes(service.name));
  const total = selectedServices.reduce((sum,service)=>sum+service.price,0);
  const totalDuration = selectedServices.map(service=>service.duration).join(' + ');
  const timeSlots = segment==='Barber' ? Array.from({length:20},(_,index)=>`${String(9+Math.floor(index/2)).padStart(2,'0')}:${String((index%2)*30).padStart(2,'0')}`) : Array.from({length:540},(_,index)=>`${String(8+Math.floor(index/60)).padStart(2,'0')}:${String(index%60).padStart(2,'0')}`);
  const hourOptions = Array.from({length:9},(_,index)=>String(index+8).padStart(2,'0'));
  const minuteOptions = Array.from({length:60},(_,index)=>String(index).padStart(2,'0'));
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
          <BookingTimeWheelPicker slots={timeSlots} value={form.time} onChange={(time)=>setForm(prev=>({...prev,time}))} id="public-booking-time" />
          <p className="booking-availability-note">{segment==='Barber'?'Grade demonstrativa em intervalos de 30 minutos. A disponibilidade real considera duração, profissional e bloqueios.':'Role as colunas de hora e minuto para encontrar o horário. Nesta prévia, as opções são ilustrativas.'}</p>
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

function PromotionsPreview({promotions,setPromotions}){
 const [filter,setFilter]=useState('Todas');
 const visible=promotions.filter(item=>filter==='Todas'||item.status===filter);
 return <div className="promotions-preview"><div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Promoções e combos</strong><p>Área administrativa disponível nas modalidades Beauty e Barber. Os cadastros abaixo são fictícios e servem para explorar o fluxo.</p></div><span className="sample-tag">EXEMPLO</span></div>
  <div className="module-toolbar"><label className="select-filter"><Filter size={15}/><select value={filter} onChange={event=>setFilter(event.target.value)}><option>Todas</option><option>Ativa</option><option>Programada</option><option>Pausada</option></select></label><button className="primary-button" onClick={()=>setPromotions(prev=>[...prev,{id:Date.now(),name:'Oferta demonstrativa',kind:'Serviço',services:['Serviço de exemplo'],regular:50,promo:40,validity:'Período configurável',status:'Programada'}])}><Plus size={16}/> Adicionar exemplo</button></div>
  <div className="promotion-preview-grid">{visible.map(item=><article className="panel promotion-preview-card" key={item.id}><div className="promotion-preview-top"><span className="promotion-kind-chip">{item.kind}</span><span className="promotion-status-chip">{item.status}</span></div><h3>{item.name}</h3><p>{item.services.join(' + ')}</p><div className="promotion-preview-price"><s>{money(item.regular)}</s><strong>{money(item.promo)}</strong></div><small>{item.validity}</small><button className="small-outline" onClick={()=>setPromotions(prev=>prev.map(promo=>promo.id===item.id?{...promo,status:promo.status==='Ativa'?'Pausada':'Ativa'}:promo))}>{item.status==='Ativa'?'Pausar exemplo':'Ativar exemplo'}</button></article>)}</div>
  <p className="booking-availability-note">A prévia representa a configuração administrativa de ofertas para Beauty e Barber; nenhuma informação é enviada ou gravada em um sistema real.</p>
 </div>;
}


function BlocksPreview({segment,blocks,setBlocks,notify}) {
  const isBarber = segment === 'Barber';
  const [date,setDate] = useState(dateAfterDays(1));
  const [scope,setScope] = useState(isBarber ? 'professional' : 'business');
  const [professional,setProfessional] = useState('Profissional 1');
  const [allDay,setAllDay] = useState(false);
  const [start,setStart] = useState(isBarber ? '13:00' : '');
  const [end,setEnd] = useState(isBarber ? '14:00' : '');
  const [reason,setReason] = useState('');

  function createBlock(event) {
    event.preventDefault();
    if ((start && !end) || (!start && end) || (start && end && start >= end)) {
      notify('Confira os horários: informe início e fim válidos.');
      return;
    }
    if (isBarber && scope === 'professional' && (!start || !end)) {
      notify('Para bloquear um profissional, informe o início e o fim.');
      return;
    }
    if (isBarber && scope === 'business' && !allDay && (!start || !end)) {
      notify('Informe o horário ou marque o bloqueio do dia inteiro.');
      return;
    }

    const block = {
      id: Date.now(),
      date,
      start: isBarber && scope === 'business' && allDay ? '' : start,
      end: isBarber && scope === 'business' && allDay ? '' : end,
      scope: isBarber ? scope : 'business',
      professional: isBarber && scope === 'professional' ? professional : '',
      reason: reason.trim()
    };
    setBlocks(current => [...current,block].sort((a,b)=>a.date.localeCompare(b.date)));
    setDate(dateAfterDays(1));
    setStart(isBarber ? '13:00' : '');
    setEnd(isBarber ? '14:00' : '');
    setReason('');
    setAllDay(false);
    notify('Bloqueio demonstrativo adicionado à agenda.');
  }

  function removeBlock(id) {
    setBlocks(current=>current.filter(item=>item.id!==id));
    notify('Bloqueio demonstrativo removido.');
  }

  function formatBlockDate(value) {
    return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'short'}).format(new Date(value+'T12:00:00'));
  }

  function blockTarget(block) {
    if (!isBarber) return 'Agenda completa';
    return block.scope === 'business' ? 'Toda a barbearia' : (block.professional || 'Profissional');
  }

  return <div className="preview-management-module">
    <div className="welcome-strip">
      <div className="welcome-icon"><DoorClosed size={19}/></div>
      <div><strong>Bloqueios da agenda</strong><p>{isBarber ? 'Reserve períodos para um profissional específico ou para toda a barbearia.' : 'Cadastre folgas, compromissos e pausas fora do funcionamento habitual.'}</p></div>
      <span className="sample-tag">EXEMPLO</span>
    </div>

    <div className="preview-management-grid">
      <section className="panel preview-management-card">
        <div className="panel-heading"><div><h3>Novo bloqueio</h3><p>Defina quando a agenda ficará indisponível.</p></div><span className="preview-management-mark"><Plus size={18}/></span></div>
        <form className="preview-management-form" onSubmit={createBlock}>
          <label>Data<input type="date" value={date} min={localDateValue()} onChange={event=>setDate(event.target.value)} required/></label>

          {isBarber && <label>Aplicar a<select value={scope} onChange={event=>{setScope(event.target.value);setAllDay(false);if(event.target.value==='professional'){setStart('13:00');setEnd('14:00');}}}><option value="professional">Um profissional</option><option value="business">Toda a barbearia</option></select></label>}
          {isBarber && scope==='professional' && <label>Profissional<select value={professional} onChange={event=>setProfessional(event.target.value)}><option>Profissional 1</option><option>Profissional 2</option></select></label>}
          {isBarber && scope==='business' && <label className="preview-management-check"><input type="checkbox" checked={allDay} onChange={event=>setAllDay(event.target.checked)}/> Bloquear o dia inteiro</label>}

          {!(isBarber && scope==='business' && allDay) && <div className="preview-management-time-grid">
            <label>Início {isBarber ? '' : '(opcional)'}<input type="time" value={start} onChange={event=>setStart(event.target.value)} required={isBarber}/></label>
            <label>Fim {isBarber ? '' : '(opcional)'}<input type="time" value={end} onChange={event=>setEnd(event.target.value)} required={isBarber}/></label>
          </div>}
          <label>Motivo ou observação<input value={reason} maxLength={160} onChange={event=>setReason(event.target.value)} placeholder="Ex.: compromisso, manutenção..."/></label>
          <button className="primary-button" type="submit"><Plus size={16}/> Criar bloqueio</button>
        </form>
        <p className="preview-management-note">Na demonstração, o bloqueio é fictício e não altera a disponibilidade de agendamentos reais.</p>
      </section>

      <section className="panel preview-management-card">
        <div className="panel-heading"><div><h3>Próximos bloqueios</h3><p>Indisponibilidades cadastradas nesta prévia.</p></div><span className="count-chip">{blocks.length}</span></div>
        {blocks.length ? <div className="preview-block-list">
          {blocks.map(block=><article className="preview-block-row" key={block.id}>
            <div className="preview-block-date"><strong>{new Date(block.date+'T12:00:00').getDate()}</strong><span>{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(block.date+'T12:00:00'))}</span></div>
            <div className="preview-block-copy"><strong>{formatBlockDate(block.date)}</strong><span>{block.start && block.end ? `${block.start} – ${block.end}` : 'Dia inteiro'}</span><small>{blockTarget(block)}{block.reason ? ` · ${block.reason}` : ''}</small></div>
            <button type="button" className="preview-management-remove" onClick={()=>removeBlock(block.id)} aria-label="Remover bloqueio"><X size={16}/></button>
          </article>)}
        </div> : <div className="preview-management-empty"><CalendarDays size={24}/><strong>Nenhum bloqueio cadastrado</strong><p>Quando precisar reservar um período, cadastre ao lado.</p></div>}
      </section>
    </div>
  </div>;
}

function PoliciesPreview({segment,policies,setPolicies,notify}) {
  const isBarber = segment === 'Barber';
  const noun = isBarber ? 'barbearia' : 'estúdio';
  function patchPolicy(patch) {
    setPolicies(current=>({...current,...patch}));
  }
  return <div className="preview-management-module">
    <div className="welcome-strip">
      <div className="welcome-icon"><ShieldCheck size={19}/></div>
      <div><strong>Orientações para clientes</strong><p>Escolha quais regras devem aparecer antes da confirmação do agendamento.</p></div>
      <span className="sample-tag">EXEMPLO</span>
    </div>

    <section className="panel preview-policy-card">
      <div className="panel-heading"><div><h3>Políticas da {noun}</h3><p>Ative apenas as orientações que deseja apresentar ao cliente.</p></div><span className="preview-management-mark"><ShieldCheck size={19}/></span></div>
      <div className="preview-policy-options">
        <label className="preview-policy-toggle"><input type="checkbox" checked={policies.showLateness} onChange={event=>patchPolicy({showLateness:event.target.checked})}/><span><strong>Mostrar tolerância a atrasos</strong><small>Informa o prazo permitido para chegar após o horário marcado.</small></span></label>
        <label className="preview-policy-toggle"><input type="checkbox" checked={policies.showCancellation} onChange={event=>patchPolicy({showCancellation:event.target.checked})}/><span><strong>Mostrar prazo de cancelamento</strong><small>Orienta com quantas horas de antecedência o cliente deve avisar.</small></span></label>
        <label className="preview-policy-toggle"><input type="checkbox" checked={policies.showCompanion} onChange={event=>patchPolicy({showCompanion:event.target.checked})}/><span><strong>Mostrar aviso sobre acompanhantes</strong><small>Explica as regras para acompanhantes e crianças no espaço.</small></span></label>
        <label className="preview-policy-toggle"><input type="checkbox" checked={policies.showNoShow} onChange={event=>patchPolicy({showNoShow:event.target.checked})}/><span><strong>Mostrar política de faltas e sinal</strong><small>Apresenta orientações sobre faltas, cancelamentos e valores antecipados.</small></span></label>
      </div>

      {policies.showLateness && <label className="preview-policy-field">Tolerância de atraso (minutos)<input type="number" min="0" max="60" value={policies.latenessTolerance} onChange={event=>patchPolicy({latenessTolerance:Math.min(60,Math.max(0,Number(event.target.value||0)))})}/></label>}
      {policies.showCancellation && <label className="preview-policy-field">Prazo para avisar (horas)<input type="number" min="0" max="168" value={policies.cancellationNotice} onChange={event=>patchPolicy({cancellationNotice:Math.min(168,Math.max(0,Number(event.target.value||0)))})}/></label>}
      {policies.showCompanion && <label className="preview-policy-field">Acompanhantes e crianças<textarea rows={4} maxLength={700} value={policies.companionPolicy} onChange={event=>patchPolicy({companionPolicy:event.target.value})}/></label>}
      {policies.showNoShow && <label className="preview-policy-field">Faltas e sinal pago<textarea rows={4} maxLength={700} value={policies.noShowPolicy} onChange={event=>patchPolicy({noShowPolicy:event.target.value})}/></label>}

      <div className="preview-policy-footer"><span><ShieldCheck size={16}/> As regras ativas apareceriam na etapa de confirmação do agendamento.</span><button type="button" className="primary-button" onClick={()=>notify('Orientações demonstrativas atualizadas.')}>Salvar orientações <Check size={16}/></button></div>
    </section>
    <p className="preview-management-note">As opções e os textos são fictícios nesta central. Nenhuma regra é publicada em uma agenda real.</p>
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
          <img src={publicAsset('2r-logo.png')} alt="" />
          <span><strong>2R INFORMÁTICA</strong><small>Seu parceiro em Tecnologia</small></span>
        </a>
        <button className="portfolio-menu-toggle" type="button" onClick={() => setMobileMenuOpen(v => !v)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}>
          {mobileMenuOpen ? <X size={21}/> : <Menu size={21}/>}
        </button>
        <nav className={'portfolio-nav' + (mobileMenuOpen ? ' is-open' : '')} aria-label="Navegação principal">
          <a href="#solucoes" onClick={closeMenu}>Soluções</a>
          <a href="#projetos" onClick={closeMenu}>Projetos</a>
          <a href="#personalizadas" onClick={closeMenu}>Sob medida</a>
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
              <img className="portfolio-profile-photo" src={publicAsset('ruan-profile.webp')} alt="Ruan Rodrigues, da 2R Informática" fetchPriority="high"/>
              <div className="portfolio-photo-overlay">
                <div className="portfolio-photo-logo"><img src={publicAsset('2r-logo.png')} alt=""/></div>
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

      <section className="portfolio-section portfolio-custom-section" id="personalizadas">
        <div className="portfolio-container">
          <div className="portfolio-section-heading portfolio-custom-heading">
            <div>
              <span className="portfolio-section-kicker">APLICAÇÕES PERSONALIZADAS</span>
              <h2>Seu negócio tem seu jeito. Sua aplicação também.</h2>
              <p>Os projetos Beauty, Barber e Burger são apenas exemplos. Cada aplicação é planejada do zero e personalizada conforme a rotina, os processos e os objetivos de cada cliente.</p>
            </div>
            <span className="portfolio-custom-heading-badge"><Sparkles size={15}/> Feita para sua operação</span>
          </div>

          <div className="portfolio-custom-grid">
            <article className="portfolio-custom-card">
              <span className="portfolio-custom-card-icon"><PawPrint size={21}/></span>
              <div><h3>Pet shops e cuidados animais</h3><p>Agenda de banho e tosa, cadastro de pets, histórico, serviços e relacionamento com clientes.</p></div>
            </article>
            <article className="portfolio-custom-card">
              <span className="portfolio-custom-card-icon"><Scissors size={21}/></span>
              <div><h3>Salões, cabelo e unhas</h3><p>Agendamentos, profissionais, procedimentos, pacotes, clientes e controle financeiro.</p></div>
            </article>
            <article className="portfolio-custom-card">
              <span className="portfolio-custom-card-icon"><Store size={21}/></span>
              <div><h3>Lojas e comércio</h3><p>Produtos, vendas, clientes, estoque, caixa e acompanhamento da operação.</p></div>
            </article>
            <article className="portfolio-custom-card">
              <span className="portfolio-custom-card-icon"><Utensils size={21}/></span>
              <div><h3>Alimentação e delivery</h3><p>Pedidos, cardápio, produtos, estoque e organização dos atendimentos.</p></div>
            </article>
            <article className="portfolio-custom-card">
              <span className="portfolio-custom-card-icon"><Wrench size={21}/></span>
              <div><h3>Assistências e prestação de serviços</h3><p>Ordens de serviço, orçamentos, etapas de execução e histórico dos clientes.</p></div>
            </article>
            <article className="portfolio-custom-card">
              <span className="portfolio-custom-card-icon"><Truck size={21}/></span>
              <div><h3>Distribuidoras e fornecedores</h3><p>Catálogo, pedidos, clientes, controle de estoque e acompanhamento de entregas.</p></div>
            </article>
          </div>

          <div className="portfolio-custom-bottom">
            <div><strong>Não encontrou seu segmento?</strong><p>Essas são apenas algumas possibilidades. Podemos conversar sobre a rotina do seu negócio e planejar uma solução específica para ele.</p></div>
            <div className="portfolio-custom-actions">
              <a className="portfolio-button portfolio-button-primary" href={CUSTOM_WHATSAPP_URL} target="_blank" rel="noreferrer"><WhatsAppIcon size={18}/> Conversar sobre meu projeto <ArrowUpRight size={16}/></a>
              <a className="portfolio-button portfolio-button-light" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={17}/> @2r.ruanrodrigues <ArrowUpRight size={15}/></a>
            </div>
          </div>
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
          <div className="portfolio-about-mark"><img src={publicAsset('2r-logo.png')} alt="Logotipo da 2R Informática"/></div>
          <div><span className="portfolio-section-kicker">SOBRE A 2R INFORMÁTICA</span><h2>Tecnologia próxima, prática e feita para pessoas.</h2><p>Minha experiência une suporte técnico, redes, infraestrutura e desenvolvimento de aplicações web. Isso ajuda a enxergar tanto a parte técnica quanto o uso real das ferramentas no dia a dia do negócio.</p><p>O objetivo é construir soluções fáceis de entender, com funcionalidades úteis e espaço para evoluir conforme a necessidade.</p></div>
          <div className="portfolio-about-quote"><span>“</span><strong>Seu parceiro em Tecnologia.</strong><small>2R Informática</small></div>
        </div>
      </section>

      <section className="portfolio-contact-section" id="contato">
        <div className="portfolio-container portfolio-contact-layout">
          <div><span className="portfolio-section-kicker">VAMOS TIRAR A IDEIA DO PAPEL?</span><h2>Tem uma necessidade?<br/><span>Vamos pensar na solução.</span></h2><p>Converse comigo sobre uma aplicação web, uma melhoria de processo ou uma demanda de tecnologia para seu negócio.</p></div>
          <div className="portfolio-contact-actions">
            <a className="portfolio-button portfolio-button-primary portfolio-whatsapp-button" href="https://wa.me/5567998042465?text=Ol%C3%A1%2C%20Ruan!%20Encontrei%20seu%20portf%C3%B3lio%20e%20gostaria%20de%20conversar." target="_blank" rel="noreferrer" aria-label="Conversar com Ruan pelo WhatsApp no número (67) 99804-2465"><WhatsAppIcon size={19}/> Chamar no WhatsApp <span className="portfolio-whatsapp-number">(67) 99804-2465</span><ArrowUpRight size={16}/></a>
            <a className="portfolio-button portfolio-button-secondary" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={17}/> Instagram <span>@2r.ruanrodrigues</span><ArrowUpRight size={16}/></a>
            <a className="portfolio-button portfolio-button-secondary" href="https://www.linkedin.com/in/ruanrodrigues2r/" target="_blank" rel="noreferrer"><Linkedin size={17}/> Perfil profissional <ArrowUpRight size={16}/></a>
          </div>
        </div>
      </section>
    </main>

    <footer className="portfolio-footer">
      <div className="portfolio-container portfolio-footer-inner">
        <a className="portfolio-brand portfolio-footer-brand" href="#inicio"><img src={publicAsset('2r-logo.png')} alt=""/><span><strong>2R INFORMÁTICA</strong><small>Seu parceiro em Tecnologia</small></span></a>
        <span>© {new Date().getFullYear()} 2R Informática. Tecnologia com propósito.</span>
        <button onClick={onOpenCatalog}>Ver modalidades de aplicações <ArrowUpRight size={15}/></button>
      </div>
    </footer>
  </div>;
}
