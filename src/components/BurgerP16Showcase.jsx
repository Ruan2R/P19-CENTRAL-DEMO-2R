import { useMemo, useState } from 'react';
import '../burger-p16-faithful.css';
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Bell, Boxes, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardList, CreditCard, Filter, LayoutDashboard, Package, Plus, RefreshCw,
  Search, ShieldCheck, ShoppingBag, StopCircle, PlayCircle, Trash2, TrendingDown, TrendingUp,
  Wallet, X, LogOut, Store
} from 'lucide-react';

const todayKey = (offset = 0) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const monthKey = () => todayKey(0).slice(0, 7);
const cash = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
const dateText = (value) => value ? new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(value + 'T12:00:00')) : '—';
const shortTime = () => new Intl.DateTimeFormat('pt-BR', { hour:'2-digit', minute:'2-digit' }).format(new Date());
const stockTypes = {
  purchase: 'Entrada por compra', return: 'Devolução / retorno', adjustment_in: 'Ajuste de entrada',
  sale: 'Venda avulsa', adjustment_out: 'Ajuste de saída', waste: 'Perda / desperdício', order_consumption: 'Saída por pedido'
};
const stockGroups = {
  resale: { label:'Produtos para revenda', description:'Itens comprados prontos, com quantidade e estoque mínimo controlados.' },
  prepared: { label:'Preparados na hora', description:'Itens produzidos no momento da venda. Possuem custo estimado, mas não têm estoque próprio.' }
};
const paymentOptions = ['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado', 'Outro'];
const initialProducts = [
  {id:'prod1',name:'Refrigerante lata 350 ml',category:'Bebidas',kind:'resale',sellable:true,stockTracked:true,costCents:320,priceCents:600,stock:21,minimum:8,unit:'un'},
  {id:'prod2',name:'Água mineral 500 ml',category:'Bebidas',kind:'resale',sellable:true,stockTracked:true,costCents:150,priceCents:350,stock:36,minimum:10,unit:'un'},
  {id:'prod3',name:'Cerveja long neck',category:'Bebidas',kind:'resale',sellable:true,stockTracked:true,costCents:580,priceCents:1000,stock:12,minimum:6,unit:'un'},
  {id:'prod4',name:'Hambúrguer artesanal',category:'Lanches',kind:'prepared',sellable:true,stockTracked:false,costCents:850,priceCents:2000,stock:0,minimum:0,unit:'porcao'},
  {id:'prod5',name:'Batata frita',category:'Porções',kind:'prepared',sellable:true,stockTracked:false,costCents:420,priceCents:1200,stock:0,minimum:0,unit:'porcao'}
];
const initialOrders = [
  {id:'ord1',number:1,sessionNumber:1,customer:'Balcão',items:[{productId:'prod4',quantity:2},{productId:'prod1',quantity:1}],totalCents:4600,status:'Em preparo',paymentStatus:'unpaid',paymentMethod:'',paymentDate:'',createdAt:'19:12',businessDate:todayKey(0),stockReserved:true},
  {id:'ord2',number:2,sessionNumber:1,customer:'Cliente do balcão',items:[{productId:'prod5',quantity:1},{productId:'prod2',quantity:2}],totalCents:1900,status:'Pronto',paymentStatus:'paid',paymentMethod:'Pix',paymentDate:todayKey(0),createdAt:'19:25',businessDate:todayKey(0),stockReserved:false},
  {id:'ord3',number:3,sessionNumber:1,customer:'Balcão',items:[{productId:'prod3',quantity:3}],totalCents:3000,status:'Recebido',paymentStatus:'unpaid',paymentMethod:'',paymentDate:'',createdAt:'19:40',businessDate:todayKey(0),stockReserved:true}
];
const initialEntries = [
  {id:'entry1',direction:'income',description:'Vendas de balcão',category:'Vendas',amountCents:125000,movementDate:todayKey(0),paymentMethod:'Pix',sourceType:'manual'},
  {id:'entry2',direction:'expense',description:'Compra de bebidas',category:'Estoque',amountCents:48000,movementDate:todayKey(-1),paymentMethod:'Cartão',sourceType:'manual'}
];
const initialPayables = [
  {id:'pay1',description:'Fornecedor de bebidas',category:'Estoque',amountCents:280000,dueDate:todayKey(4),status:'pending'},
  {id:'pay2',description:'Aluguel',category:'Estrutura',amountCents:120000,dueDate:todayKey(-2),status:'pending'}
];
const initialReceivables = [
  {id:'rec1',description:'Pedido #001',counterparty:'Balcão',amountCents:4600,dueDate:todayKey(0),status:'pending',orderId:'ord1',orderNumber:1},
  {id:'rec3',description:'Pedido #003',counterparty:'Balcão',amountCents:3000,dueDate:todayKey(0),status:'pending',orderId:'ord3',orderNumber:3}
];
const initialStockMovements = [
  {id:'sm1',productId:'prod1',type:'purchase',quantity:12,before:10,after:22,reason:'Compra do fornecedor',movementDate:todayKey(-2),sourceType:'manual'},
  {id:'sm2',productId:'prod1',type:'order_consumption',quantity:-1,before:22,after:21,reason:'Pedido #001',movementDate:todayKey(0),sourceType:'order'},
  {id:'sm3',productId:'prod3',type:'order_consumption',quantity:-3,before:15,after:12,reason:'Pedido #003',movementDate:todayKey(0),sourceType:'order'}
];
function P16Card({ children, className = '' }) { return <section className={'panel ' + className}>{children}</section>; }
function P16Title({ eyebrow, title, action }) { return <div className="panel-heading"><div>{eyebrow&&<div className="section-kicker">{eyebrow}</div>}<h3>{title}</h3></div>{action}</div>; }
function P16Count({ children }) { return <span className="order-result-count">{children}</span>; }
function P16Button({ children, onClick, outline = false, disabled = false, type = 'button' }) { return <button type={type} disabled={disabled} className={outline ? 'outline-button' : 'primary-button'} onClick={onClick}>{children}</button>; }
function dueInfo(date) {
  if (!date) return {label:'Sem vencimento',tone:'normal'};
  if (date < todayKey(0)) return {label:'Vencida',tone:'overdue'};
  if (date === todayKey(0)) return {label:'Vence hoje',tone:'today'};
  if (date <= todayKey(7)) return {label:'Vence em breve',tone:'soon'};
  return {label:'Em dia',tone:'normal'};
}
function productQuantity(product, quantity) {
  const value = Number(quantity);
  return Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits:3 }) : '0';
}

export default function BurgerP16Showcase({ module, notify = () => {}, onNavigate = () => {}, onExit = () => {}, availableModules = [] }) {
  const [products,setProducts] = useState(initialProducts);
  const [orders,setOrders] = useState(initialOrders);
  const [entries,setEntries] = useState(initialEntries);
  const [payables,setPayables] = useState(initialPayables);
  const [receivables,setReceivables] = useState(initialReceivables);
  const [stockMovements,setStockMovements] = useState(initialStockMovements);
  const [sessionOpen,setSessionOpen] = useState(true);
  const [sessionNumber,setSessionNumber] = useState(1);
  const [nextOrderNumber,setNextOrderNumber] = useState(4);
  const [sessionStartedAt,setSessionStartedAt] = useState('19:00');
  const [financeTab,setFinanceTab] = useState('overview');
  const [selectedMonth,setSelectedMonth] = useState(monthKey());
  const [orderSearch,setOrderSearch] = useState('');
  const [orderScope,setOrderScope] = useState('session');
  const [orderForm,setOrderForm] = useState(false);
  const [orderCustomer,setOrderCustomer] = useState('Balcão');
  const [draftItems,setDraftItems] = useState([{id:1,productId:'',quantity:'1'}]);
  const [paymentOrderId,setPaymentOrderId] = useState('');
  const [paymentDate,setPaymentDate] = useState(todayKey(0));
  const [paymentMethod,setPaymentMethod] = useState('Pix');
  const [entrySearch,setEntrySearch] = useState('');
  const [entryFilter,setEntryFilter] = useState('all');
  const [entryForm,setEntryForm] = useState(false);
  const [entryDirection,setEntryDirection] = useState('income');
  const [entryDescription,setEntryDescription] = useState('');
  const [entryCategory,setEntryCategory] = useState('Geral');
  const [entryAmount,setEntryAmount] = useState('');
  const [entryDate,setEntryDate] = useState(todayKey(0));
  const [entryMethod,setEntryMethod] = useState('Pix');
  const [payableForm,setPayableForm] = useState(false);
  const [payableDescription,setPayableDescription] = useState('');
  const [payableCategory,setPayableCategory] = useState('Geral');
  const [payableAmount,setPayableAmount] = useState('');
  const [payableDate,setPayableDate] = useState(todayKey(7));
  const [receivableForm,setReceivableForm] = useState(false);
  const [receivableDescription,setReceivableDescription] = useState('');
  const [receivableSource,setReceivableSource] = useState('');
  const [receivableAmount,setReceivableAmount] = useState('');
  const [receivableDate,setReceivableDate] = useState(todayKey(7));
  const [productForm,setProductForm] = useState(false);
  const [productKind,setProductKind] = useState('resale');
  const [productSearch,setProductSearch] = useState('');
  const [stockProductId,setStockProductId] = useState('');
  const [stockType,setStockType] = useState('purchase');
  const [stockQuantity,setStockQuantity] = useState('1');
  const [stockReason,setStockReason] = useState('');
  const [stockDate,setStockDate] = useState(todayKey(0));
  const [stockFilter,setStockFilter] = useState('all');
  const [stockSearch,setStockSearch] = useState('');
  const [stockHistoryExpanded,setStockHistoryExpanded] = useState(false);
  const [reportPeriod,setReportPeriod] = useState('day');
  const [reportDate,setReportDate] = useState(todayKey(0));

  const currentMonthEntries = entries.filter((entry)=>entry.movementDate.startsWith(selectedMonth));
  const monthIncome = currentMonthEntries.filter((entry)=>entry.direction==='income').reduce((sum,item)=>sum+item.amountCents,0);
  const monthExpenses = currentMonthEntries.filter((entry)=>entry.direction==='expense').reduce((sum,item)=>sum+item.amountCents,0);
  const openPayables = payables.filter((item)=>item.status==='pending');
  const openReceivables = receivables.filter((item)=>item.status==='pending');
  const pendingPayablesTotal = openPayables.reduce((sum,item)=>sum+item.amountCents,0);
  const pendingReceivablesTotal = openReceivables.reduce((sum,item)=>sum+item.amountCents,0);
  const currentSessionOrders = orders.filter((order)=>order.sessionNumber===sessionNumber);
  const activeOrders = currentSessionOrders.filter((order)=>['Recebido','Em preparo','Pronto'].includes(order.status));
  const shownOrders = (orderScope==='all'?orders:currentSessionOrders).filter((order)=>(String(order.number)+' '+order.customer+' '+order.items.map((line)=>products.find((p)=>p.id===line.productId)?.name||'Produto').join(' ')+' '+order.status+' '+order.paymentStatus).toLowerCase().includes(orderSearch.toLowerCase()));
  const filteredEntries = currentMonthEntries.filter((entry)=>{
    const text=(entry.description+' '+entry.category+' '+entry.paymentMethod).toLowerCase();
    return (!entrySearch||text.includes(entrySearch.toLowerCase()))&&(entryFilter==='all'||entry.direction===entryFilter);
  });
  const selectedStockProduct = products.find((product)=>product.id===stockProductId);
  const filteredStock = stockMovements.filter((movement)=>{
    const product=products.find((item)=>item.id===movement.productId);
    const search=(product?.name||movement.productName||'').toLowerCase().includes(stockSearch.toLowerCase())||movement.reason.toLowerCase().includes(stockSearch.toLowerCase());
    const typeMatches=stockFilter==='all'||(stockFilter==='inbound'&&['purchase','return','adjustment_in'].includes(movement.type))||(stockFilter==='outbound'&&['sale','order_consumption','adjustment_out'].includes(movement.type))||(stockFilter==='waste'&&movement.type==='waste');
    return search&&typeMatches;
  }).sort((a,b)=>b.movementDate.localeCompare(a.movementDate));

  function addCashEntry(item) {
    setEntries((current)=>[item,...current]);
  }
  function goFinance(tab) {
    setFinanceTab(tab);
    if(module!=='finance') onNavigate('finance');
  }
  function addStockHistory(product,type,quantity,reason,date,sourceType='manual',sourceId='') {
    setStockMovements((current)=>[{id:'sm'+Date.now()+Math.random(),productId:product.id,type,quantity,before:product.stock,after:product.stock+quantity,reason,movementDate:date,sourceType,sourceId},...current]);
  }
  function startSession() {
    const next=sessionNumber+1;
    setSessionNumber(next);
    setNextOrderNumber(1);
    setSessionStartedAt(shortTime());
    setSessionOpen(true);
    setOrderScope('session');
    notify('Atendimento iniciado. A numeração dos pedidos começou em 001.');
  }
  function closeSession() {
    if(activeOrders.length) { notify('Finalize ou cancele os '+activeOrders.length+' pedidos em andamento antes de encerrar.'); return; }
    setSessionOpen(false);
    setOrderForm(false);
    notify('Atendimento encerrado. Novos pedidos estão bloqueados até abrir outro atendimento.');
  }
  function openNewOrder() {
    if(!sessionOpen) { notify('Inicie o atendimento antes de registrar pedidos.'); return; }
    if(!products.some((product)=>product.sellable)) { notify('Cadastre pelo menos um produto antes de criar um pedido.'); return; }
    setOrderCustomer('Balcão');
    setDraftItems([{id:Date.now(),productId:'',quantity:'1'}]);
    setOrderForm(true);
  }
  function changeDraftLine(id,patch) {
    setDraftItems((rows)=>rows.map((row)=>row.id===id?{...row,...patch}:row));
  }
  function createOrder(event) {
    event.preventDefault();
    if(!sessionOpen) { notify('Inicie o atendimento antes de registrar pedidos.'); return; }
    const sellable=products.filter((product)=>product.sellable);
    const rows=draftItems.map((row)=>({...row,product:sellable.find((product)=>product.id===row.productId),qty:Number(row.quantity)}));
    if(!rows.length||rows.some((row)=>!row.product||!Number.isFinite(row.qty)||row.qty<=0||(['un','porcao'].includes(row.product.unit)&&!Number.isInteger(row.qty)))) {
      notify('Confira o produto e a quantidade de cada item. Unidade e porção exigem quantidade inteira.'); return;
    }
    const stockTotals=new Map();
    rows.forEach((row)=>{if(row.product.stockTracked)stockTotals.set(row.product.id,(stockTotals.get(row.product.id)||0)+row.qty);});
    for(const [productId,quantity] of stockTotals) {
      const product=products.find((item)=>item.id===productId);
      if(product&&product.stock<quantity) { notify('Estoque insuficiente para '+product.name+'.'); return; }
    }
    const totalCents=rows.reduce((sum,row)=>sum+Math.round(row.product.priceCents*row.qty),0);
    const orderId='ord'+Date.now();
    const order={id:orderId,number:nextOrderNumber,sessionNumber,customer:orderCustomer.trim()||'Balcão',items:rows.map((row)=>({productId:row.product.id,quantity:row.qty})),totalCents,status:'Recebido',paymentStatus:'unpaid',paymentMethod:'',paymentDate:'',createdAt:shortTime(),businessDate:todayKey(0),stockReserved:rows.some((row)=>row.product.stockTracked)};
    for(const [productId,quantity] of stockTotals) {
      const product=products.find((item)=>item.id===productId);
      if(product) addStockHistory(product,'order_consumption',-quantity,'Pedido #'+String(nextOrderNumber).padStart(3,'0'),todayKey(0),'order',orderId);
    }
    setProducts((current)=>current.map((product)=>{
      const quantity=stockTotals.get(product.id)||0;
      return quantity&&product.stockTracked?{...product,stock:product.stock-quantity}:product;
    }));
    setOrders((current)=>[order,...current]);
    setReceivables((current)=>[{id:'rec'+Date.now(),description:'Pedido #'+String(nextOrderNumber).padStart(3,'0'),counterparty:order.customer,amountCents:totalCents,dueDate:todayKey(0),status:'pending',orderId,orderNumber:nextOrderNumber},...current]);
    setNextOrderNumber((value)=>value+1);
    setOrderForm(false);
    notify('Pedido #'+String(order.number).padStart(3,'0')+' registrado. A baixa de estoque foi aplicada aos produtos controlados.');
  }
  function moveOrderStatus(order,nextStatus) {
    const allowed={Recebido:'Em preparo','Em preparo':'Pronto',Pronto:'Entregue'};
    if(allowed[order.status]!==nextStatus)return;
    setOrders((current)=>current.map((item)=>item.id===order.id?{...item,status:nextStatus}:item));
    notify('Pedido #'+String(order.number).padStart(3,'0')+' atualizado para '+nextStatus.toLowerCase()+'.');
  }
  function cancelOrder(order) {
    if(order.paymentStatus==='paid') { notify('Pedido pago não pode ser cancelado sem um fluxo de estorno.'); return; }
    if(['Entregue','Cancelado'].includes(order.status))return;
    order.items.forEach((line)=>{
      const product=products.find((item)=>item.id===line.productId);
      if(product&&product.stockTracked) addStockHistory(product,'return',line.quantity,'Devolução do pedido #'+String(order.number).padStart(3,'0'),todayKey(0),'order-cancel',order.id);
    });
    setProducts((current)=>current.map((product)=>{
      const line=order.items.find((item)=>item.productId===product.id);
      return line&&product.stockTracked?{...product,stock:product.stock+line.quantity}:product;
    }));
    setOrders((current)=>current.map((item)=>item.id===order.id?{...item,status:'Cancelado',stockReserved:false}:item));
    setReceivables((current)=>current.map((item)=>item.orderId===order.id?{...item,status:'cancelled'}:item));
    notify('Pedido cancelado. Os itens controlados foram devolvidos ao estoque.');
  }
  function openPayment(order) {
    if(order.paymentStatus==='paid')return;
    setPaymentOrderId(order.id);
    setPaymentDate(todayKey(0));
    setPaymentMethod('Pix');
  }
  function registerOrderPayment(event,order) {
    event.preventDefault();
    if(!paymentDate)return;
    if(order.paymentStatus==='paid') { notify('Este pedido já foi pago; nenhuma entrada duplicada será criada.'); return; }
    const payment={id:'entry'+Date.now(),direction:'income',description:'Pedido #'+String(order.number).padStart(3,'0'),category:'Pedidos',amountCents:order.totalCents,movementDate:paymentDate,paymentMethod,sourceType:'order_payment'};
    addCashEntry(payment);
    setOrders((current)=>current.map((item)=>item.id===order.id?{...item,paymentStatus:'paid',paymentMethod,paymentDate}:item));
    setReceivables((current)=>current.map((item)=>item.orderId===order.id?{...item,status:'received'}:item));
    setPaymentOrderId('');
    notify('Pagamento do pedido #'+String(order.number).padStart(3,'0')+' registrado no caixa.');
  }
  function registerEntry(event) {
    event.preventDefault();
    const cents=Math.round(Number(entryAmount.replace(',','.'))*100);
    if(!entryDescription.trim()||cents<=0)return;
    addCashEntry({id:'entry'+Date.now(),direction:entryDirection,description:entryDescription.trim(),category:entryCategory.trim()||'Geral',amountCents:cents,movementDate:entryDate,paymentMethod:entryMethod,sourceType:'manual'});
    setEntryDescription('');setEntryAmount('');setEntryForm(false);
    notify('Movimentação salva na demonstração.');
  }
  function createPayable(event) {
    event.preventDefault();
    const cents=Math.round(Number(payableAmount.replace(',','.'))*100);
    if(!payableDescription.trim()||cents<=0)return;
    setPayables((current)=>[{id:'pay'+Date.now(),description:payableDescription.trim(),category:payableCategory.trim()||'Geral',amountCents:cents,dueDate:payableDate,status:'pending'},...current]);
    setPayableDescription('');setPayableAmount('');setPayableForm(false);
    notify('Conta a pagar cadastrada.');
  }
  function payPayable(payable) {
    if(payable.status==='paid')return;
    setPayables((current)=>current.map((item)=>item.id===payable.id?{...item,status:'paid'}:item));
    addCashEntry({id:'entry'+Date.now(),direction:'expense',description:payable.description,category:payable.category,amountCents:payable.amountCents,movementDate:todayKey(0),paymentMethod:'Não informado',sourceType:'payable_payment'});
    notify('Pagamento registrado; a saída foi lançada no caixa.');
  }
  function createReceivable(event) {
    event.preventDefault();
    const cents=Math.round(Number(receivableAmount.replace(',','.'))*100);
    if(!receivableDescription.trim()||cents<=0)return;
    setReceivables((current)=>[{id:'rec'+Date.now(),description:receivableDescription.trim(),counterparty:receivableSource.trim()||'Não informado',amountCents:cents,dueDate:receivableDate,status:'pending'},...current]);
    setReceivableDescription('');setReceivableAmount('');setReceivableForm(false);
    notify('Valor a receber cadastrado.');
  }
  function receiveManual(receivable) {
    if(receivable.orderId) {notify('O recebimento deste pedido é gerenciado na área de Pedidos.');return;}
    if(receivable.status!=='pending')return;
    setReceivables((current)=>current.map((item)=>item.id===receivable.id?{...item,status:'received'}:item));
    addCashEntry({id:'entry'+Date.now(),direction:'income',description:receivable.description,category:'Recebimentos',amountCents:receivable.amountCents,movementDate:todayKey(0),paymentMethod:'Pix',sourceType:'receivable'});
    notify('Recebimento confirmado e lançado no caixa.');
  }
  function addProduct(event) {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const name=String(data.get('name')||'').trim(), category=String(data.get('category')||'Geral');
    const kind=String(data.get('kind')||productKind), cost=Number(data.get('cost')), price=Number(data.get('price'));
    const tracked=kind==='resale',stock=tracked?Number(data.get('stock')):0,minimum=tracked?Number(data.get('minimum')):0;
    if(!name||!Number.isFinite(cost)||cost<0||!Number.isFinite(price)||price<=0||stock<0||minimum<0)return;
    if(products.some((item)=>item.name.trim().toLowerCase()===name.toLowerCase())){notify('Já existe um produto com esse nome no catálogo.');return;}
    const product={id:'prod'+Date.now(),name,category,kind,sellable:true,stockTracked:tracked,costCents:Math.round(cost*100),priceCents:Math.round(price*100),stock,minimum,unit:String(data.get('unit')||'un')};
    setProducts((current)=>[...current,product]);
    if(tracked&&stock>0)setStockMovements((current)=>[{id:'sm'+Date.now(),productId:product.id,type:'purchase',quantity:stock,before:0,after:stock,reason:'Estoque inicial do cadastro',movementDate:todayKey(0),sourceType:'manual'},...current]);
    setProductForm(false);setProductKind('resale');
    notify(kind==='prepared'?'Preparado cadastrado sem estoque próprio.':'Produto cadastrado com histórico de estoque inicial.');
  }
  function beginStockMovement(product) {
    setStockProductId(product.id);setStockType('purchase');setStockQuantity('1');setStockReason('');setStockDate(todayKey(0));
  }
  function saveStockMovement(event) {
    event.preventDefault();
    if(!selectedStockProduct)return;
    const quantity=Number(stockQuantity);
    if(!Number.isFinite(quantity)||quantity<=0||(['un','porcao'].includes(selectedStockProduct.unit)&&!Number.isInteger(quantity))) {notify('Informe uma quantidade válida para a unidade selecionada.');return;}
    if(stockReason.trim().length<5){notify('Descreva o motivo com pelo menos 5 caracteres.');return;}
    const inbound=['purchase','return','adjustment_in'].includes(stockType);
    const direction=inbound?quantity:-quantity;
    if(selectedStockProduct.stock+direction<0){notify('A movimentação não pode deixar o estoque negativo.');return;}
    const label=stockTypes[stockType];
    setProducts((current)=>current.map((product)=>product.id===selectedStockProduct.id?{...product,stock:product.stock+direction}:product));
    addStockHistory(selectedStockProduct,stockType,direction,stockReason.trim(),stockDate);
    if(stockType==='sale')notify('Venda avulsa: estoque atualizado. O recebimento deve ser registrado separadamente no Financeiro.');
    else notify(label+' registrada no histórico.');
    setStockProductId('');
  }
  function reportOrders() {
    return orders.filter((order)=>reportPeriod==='day'
      ? order.businessDate===reportDate
      : order.businessDate?.startsWith(reportDate.slice(0,7)));
  }
  const reportList=reportOrders();
  const reportActive=reportList.filter((order)=>order.status!=='Cancelado');
  const reportCancelled=reportList.filter((order)=>order.status==='Cancelado');
  const reportPending=reportList.filter((order)=>order.paymentStatus!=='paid'&&order.status!=='Cancelado').reduce((sum,order)=>sum+order.totalCents,0);
  const reportSold=reportActive.reduce((sum,order)=>sum+order.totalCents,0);
  const visibleMovements=stockHistoryExpanded?filteredStock:filteredStock.slice(0,8);
  const unitOptions=[['un','Unidade'],['kg','Quilograma (kg)'],['g','Grama (g)'],['l','Litro (L)'],['ml','Mililitro (ml)'],['porcao','Porção']];

  const currentFinanceLabel = ({overview:'Resumo',financial:'Financeiro',transactions:'Movimentações',payables:'Contas a pagar',receivables:'Contas a receber',inventory:'Produtos e estoque'})[financeTab] || 'Financeiro';
  return <div className="p16-faithful-scope">
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="2R Burger — gestão do estabelecimento">
          <div className="brand-mark"><span>2R</span><i /></div>
          <div className="brand-copy"><strong>2R <b>BURGER</b></strong><span>GESTÃO DO ESTABELECIMENTO</span></div>
        </div>
        <div className="sidebar-caption">MENU PRINCIPAL</div>
        {availableModules.includes('finance') && <button type="button" className={'nav-item ' + (module==='finance'?'active':'')} onClick={()=>onNavigate('finance')}>
          <Wallet size={18}/><span>Financeiro</span><span className="nav-active-dot"/>
        </button>}
        {availableModules.includes('orders') && <button type="button" className={'nav-item ' + (module==='orders'?'active':'')} onClick={()=>onNavigate('orders')}>
          <ClipboardList size={18}/><span>Pedidos</span><span className="nav-active-dot"/>
        </button>}
        {availableModules.includes('site') && <button type="button" className="nav-item" onClick={()=>onNavigate('site')}>
          <Store size={18}/><span>Landing page</span>
        </button>}
        <div className="sidebar-bottom">
          <div className="local-state"><span className="local-dot"/><span>Ambiente de demonstração</span></div>
          <div className="user-chip">
            <div className="user-avatar">2R</div>
            <div className="user-meta"><strong>2R Informática</strong><span>Dados fictícios e temporários</span></div>
            <button type="button" className="icon-button logout-button" aria-label="Sair da demonstração" title="Voltar às modalidades" onClick={onExit}><LogOut size={17}/></button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>2R Burger</span><span className="crumb-separator">/</span><strong>{module==='orders'?'Pedidos':currentFinanceLabel}</strong></div>
          <div className="topbar-right">
            <span className="date-chip"><CalendarDays size={15}/>{dateText(todayKey(0))}</span>
            <span className="icon-button notification-button" title="Prévia sem notificações"><Bell size={18}/></span>
          </div>
        </header>
        {module==='orders'?<OrdersModule/>:<FinanceModule/>}
        <footer className="app-footer"><span>2R BURGER</span><span>Prévia visual · Dados fictícios e temporários</span></footer>
      </main>
    </div>
  </div>;

  function FinanceOverview() {
    const attention=[...openPayables,...openReceivables].filter((item)=>dueInfo(item.dueDate).tone!=='normal');
    const methodTotals=Object.fromEntries(paymentOptions.map((method)=>[method,currentMonthEntries.filter((item)=>item.paymentMethod===method).reduce((sum,item)=>sum+(item.direction==='income'?item.amountCents:-item.amountCents),0)]));
    const methodCounts=Object.fromEntries(paymentOptions.map((method)=>[method,currentMonthEntries.filter((item)=>item.paymentMethod===method).length]));
    return <>
      <div className="metrics-grid summary-metrics-grid">
        <Metric label="Resultado do período" value={cash(monthIncome-monthExpenses)} detail="Entradas recebidas menos saídas pagas" tone="gold"/>
        <Metric label="Entradas recebidas" value={cash(monthIncome)} detail={currentMonthEntries.filter(e=>e.direction==='income').length+' recebimentos no mês'} tone="green"/>
        <Metric label="Saídas pagas" value={cash(monthExpenses)} detail={currentMonthEntries.filter(e=>e.direction==='expense').length+' pagamentos no mês'} tone="red"/>
      </div>
      <div className="overview-grid summary-overview-grid">
        <P16Card className="transactions-panel">
          <P16Title eyebrow="CAIXA" title="Últimas movimentações" action={<button className="text-button" onClick={()=>setFinanceTab('transactions')}>Ver todas <ArrowUpRight size={15}/></button>}/>
          <MovementList items={currentMonthEntries.slice(0,5)}/>
        </P16Card>
        <P16Card className="action-panel">
          <P16Title eyebrow="ACESSO RÁPIDO" title="Ações rápidas"/>
          <button className="quick-action" onClick={()=>{setFinanceTab('transactions');setEntryForm(true)}}>
            <span className="quick-icon income-bg"><Plus size={17}/></span><span><strong>Nova movimentação</strong><small>Registrar entrada ou saída</small></span><ArrowUpRight size={16}/>
          </button>
          <button className="quick-action" onClick={()=>{setFinanceTab('payables');setPayableForm(true)}}>
            <span className="quick-icon payable-bg"><CalendarDays size={17}/></span><span><strong>Adicionar conta a pagar</strong><small>Registrar um vencimento</small></span><ArrowUpRight size={16}/>
          </button>
          <button className="quick-action" onClick={()=>{setFinanceTab('receivables');setReceivableForm(true)}}>
            <span className="quick-icon income-bg"><ArrowDownLeft size={17}/></span><span><strong>Adicionar valor a receber</strong><small>Controlar um recebimento futuro</small></span><ArrowUpRight size={16}/>
          </button>
          <button className="quick-action" onClick={()=>{setFinanceTab('inventory');setProductForm(true)}}>
            <span className="quick-icon stock-bg"><Package size={17}/></span><span><strong>Cadastrar produto</strong><small>Adicionar ao catálogo</small></span><ArrowUpRight size={16}/>
          </button>
        </P16Card>
      </div>
      {attention.length>0&&<P16Card className="finance-attention-panel">
        <P16Title eyebrow="ACOMPANHAMENTO" title="Atenção aos vencimentos" action={<span className="order-result-count">{attention.length} itens</span>}/>
        <div className="due-attention-grid">{attention.slice(0,4).map((item)=>{const due=dueInfo(item.dueDate);return <div className={'attention-item '+due.tone} key={item.id}><strong>{cash(item.amountCents)}</strong><span>{item.description}</span><small>{due.label} · {dateText(item.dueDate)}</small></div>;})}</div>
      </P16Card>}
      <P16Card className="payment-method-panel">
        <P16Title eyebrow="ANÁLISE DO CAIXA" title="Movimentações por forma de pagamento"/>
        {currentMonthEntries.length ? <div className="payment-method-list">{paymentOptions.filter(method=>methodCounts[method]>0).map(method=><article className="payment-method-row" key={method}>
          <div className="payment-method-name"><strong>{method}</strong><span>{methodCounts[method]} {methodCounts[method]===1?'movimentação':'movimentações'}</span></div>
          <div className="payment-method-value income-text"><span>Resultado líquido</span><strong>{cash(methodTotals[method])}</strong></div>
        </article>)}</div> : <div className="empty-state">Ainda não há movimentações para comparar por forma de pagamento.</div>}
      </P16Card>
      <p className="table-footnote">Resultado do período significa entradas de caixa menos saídas pagas; não representa lucro líquido. Contas pendentes não entram no caixa efetivado.</p>
    </>;
  }

  function FinanceModule() {
    const tabs=[['overview','Resumo'],['financial','Financeiro'],['transactions','Movimentações'],['payables','Contas a pagar'],['receivables','Contas a receber'],['inventory','Produtos e estoque']];
    const descriptions={overview:'Consulte rapidamente o caixa e acesse as tarefas mais usadas.',financial:'Veja o caixa do período, contas pendentes e movimentações.',transactions:'Consulte e registre entradas e saídas efetivas do caixa.',payables:'Organize vencimentos e registre pagamentos.',receivables:'Acompanhe valores pendentes e registre recebimentos.',inventory:'Cadastre produtos e controle cada movimentação de estoque.'};
    return <section className="page-content">
      <div className="page-heading-row">
        <div><div className="section-kicker">{financeTab==='overview'?'CONTROLE FINANCEIRO':'GESTÃO DO ESTABELECIMENTO'}</div><h1>{tabs.find(t=>t[0]===financeTab)?.[1]||'Financeiro'}</h1><p>{descriptions[financeTab]}</p></div>
        <label className="outline-button month-button month-picker-wrap"><CalendarDays size={16}/><span>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(selectedMonth+'-15T12:00:00'))}</span><input className="month-picker-input" aria-label="Filtrar mês financeiro" type="month" value={selectedMonth} onChange={event=>{if(event.target.value)setSelectedMonth(event.target.value)}}/><ChevronDown size={15}/></label>
      </div>
      <div className="finance-tabs" role="tablist" aria-label="Módulos financeiros">
        {tabs.map(([key,label])=><button type="button" key={key} className={'finance-tab '+(financeTab===key?'active':'')} role="tab" aria-selected={financeTab===key} onClick={()=>setFinanceTab(key)}>{label}</button>)}
      </div>
      {financeTab==='overview'&&<FinanceOverview/>}
      {financeTab==='financial'&&<FinancialView/>}
      {financeTab==='transactions'&&<TransactionsView/>}
      {financeTab==='payables'&&<PayablesView/>}
      {financeTab==='receivables'&&<ReceivablesView/>}
      {financeTab==='inventory'&&<InventoryView/>}
    </section>;
  }
  function FinancialView() {
    const result=monthIncome-monthExpenses;
    const overduePayables=openPayables.filter(x=>dueInfo(x.dueDate).tone==='overdue');
    const overdueReceivables=openReceivables.filter(x=>dueInfo(x.dueDate).tone==='overdue');
    const todayCount=[...openPayables,...openReceivables].filter(x=>dueInfo(x.dueDate).tone==='today').length;
    const soonCount=[...openPayables,...openReceivables].filter(x=>dueInfo(x.dueDate).tone==='soon').length;
    const expenseRows=Object.entries(currentMonthEntries.filter(x=>x.direction==='expense').reduce((acc,item)=>{acc[item.category]=(acc[item.category]||0)+item.amountCents;return acc;},{})).map(([label,value])=>({label,amount:value}));
    const incomeRows=Object.entries(currentMonthEntries.filter(x=>x.direction==='income').reduce((acc,item)=>{acc[item.category]=(acc[item.category]||0)+item.amountCents;return acc;},{})).map(([label,value])=>({label,amount:value}));
    const methodTotals=Object.fromEntries(paymentOptions.map(method=>[method,currentMonthEntries.filter(item=>item.paymentMethod===method).reduce((sum,item)=>sum+(item.direction==='income'?item.amountCents:-item.amountCents),0)]));
    const methodCounts=Object.fromEntries(paymentOptions.map(method=>[method,currentMonthEntries.filter(item=>item.paymentMethod===method).length]));
    return <>
      <P16Card className="cash-equation-panel finance-period-panel">
        <div className="cash-equation-heading"><h3>Resultado de {new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(selectedMonth+'-15T12:00:00'))}</h3><span>Valores efetivados</span></div>
        <div className="cash-equation">
          <div><span>Entradas recebidas</span><strong>{cash(monthIncome)}</strong></div><b aria-hidden="true">−</b>
          <div><span>Saídas pagas</span><strong>{cash(monthExpenses)}</strong></div><b aria-hidden="true">=</b>
          <div className="cash-equation-result"><span>Resultado do período</span><strong className={result>=0?'positive':'negative'}>{cash(result)}</strong></div>
        </div>
        <p className="cash-equation-note">Resultado = entradas recebidas menos saídas pagas no mês selecionado. Contas pendentes ficam separadas; este valor não representa o saldo total disponível nem o lucro líquido.</p>
      </P16Card>
      {(overduePayables.length>0||overdueReceivables.length>0||todayCount>0||soonCount>0)&&<P16Card className="finance-attention-panel">
        <div className="panel-heading"><div><h3><AlertTriangle size={16}/> Atenção aos vencimentos</h3><p>Contas que podem exigir uma ação</p></div></div>
        <div className="due-attention-grid">
          <div className={'attention-item '+(overduePayables.length+overdueReceivables.length?'overdue':'')}><strong>{overduePayables.length+overdueReceivables.length}</strong><span>Vencidas</span><small>{cash(overduePayables.reduce((sum,item)=>sum+item.amountCents,0))} a pagar · {cash(overdueReceivables.reduce((sum,item)=>sum+item.amountCents,0))} a receber</small></div>
          <div className={'attention-item '+(todayCount?'today':'')}><strong>{todayCount}</strong><span>Vencem hoje</span><small>Contas a pagar e valores a receber</small></div>
          <div className={'attention-item '+(soonCount?'soon':'')}><strong>{soonCount}</strong><span>Próximos 7 dias</span><small>Vencimentos futuros próximos</small></div>
        </div>
      </P16Card>}
      <div className="financial-obligations-grid">
        <P16Card>
          <div className="panel-heading"><div><h3>Contas a pagar</h3><p>{openPayables.length} pendentes</p></div><strong className="obligation-total expense-text">{cash(pendingPayablesTotal)}</strong></div>
          {openPayables.length?<div className="financial-obligation-list">{openPayables.slice(0,4).map(item=>{const due=dueInfo(item.dueDate);return <div className="financial-obligation-row" key={item.id}><span><strong>{item.description}</strong><small>{item.category} · Vence em {dateText(item.dueDate)}</small><em className={'due-chip '+due.tone}>{due.label}</em></span><b className="expense-text">{cash(item.amountCents)}</b></div>;})}</div>:<div className="empty-state financial-obligation-empty">Nenhuma conta pendente.</div>}
          <button type="button" className="secondary-full-button" onClick={()=>setFinanceTab('payables')}>Ver contas a pagar <ArrowUpRight size={15}/></button>
        </P16Card>
        <P16Card>
          <div className="panel-heading"><div><h3>Valores a receber</h3><p>{openReceivables.length} pendentes</p></div><strong className="obligation-total income-text">{cash(pendingReceivablesTotal)}</strong></div>
          {openReceivables.length?<div className="financial-obligation-list">{openReceivables.slice(0,4).map(item=>{const due=dueInfo(item.dueDate);return <div className="financial-obligation-row" key={item.id}><span><strong>{item.description}</strong><small>{item.counterparty+' · Previsto para '+dateText(item.dueDate)}</small><em className={'due-chip '+due.tone}>{due.label}</em></span><b className="income-text">{cash(item.amountCents)}</b></div>;})}</div>:<div className="empty-state financial-obligation-empty">Nenhum valor pendente de recebimento.</div>}
          <button type="button" className="secondary-full-button" onClick={()=>setFinanceTab('receivables')}>Ver valores a receber <ArrowUpRight size={15}/></button>
        </P16Card>
      </div>
      <div className="finance-analysis-grid">
        <P16Card className="category-breakdown-panel"><div className="panel-heading"><div><h3>Entradas por categoria</h3><p>Categorias que mais contribuíram com os recebimentos deste mês.</p></div></div><CategoryRows rows={incomeRows} tone="income"/></P16Card>
        <P16Card className="category-breakdown-panel"><div className="panel-heading"><div><h3>Saídas por categoria</h3><p>Veja em que tipos de despesa o dinheiro foi usado.</p></div></div><CategoryRows rows={expenseRows} tone="expense"/></P16Card>
      </div>
      <P16Card className="payment-method-panel">
        <div className="panel-heading"><div><h3>Movimentações por forma de pagamento</h3><p>Valores efetivamente recebidos e pagos no período selecionado.</p></div></div>
        {currentMonthEntries.length?<div className="payment-method-list">{paymentOptions.filter(method=>methodCounts[method]>0).map(method=><article className="payment-method-row" key={method}><div className="payment-method-name"><strong>{method}</strong><span>{methodCounts[method]} {methodCounts[method]===1?'movimentação':'movimentações'}</span></div><div className="payment-method-value income-text"><span>Resultado líquido</span><strong>{cash(methodTotals[method])}</strong></div></article>)}</div>:<div className="empty-state">Ainda não há movimentações para comparar por forma de pagamento.</div>}
      </P16Card>
      <P16Card className="financial-recent-panel">
        <div className="panel-heading"><div><h3>Movimentações do período</h3><p>Recebimentos e pagamentos já registrados no caixa</p></div><button type="button" className="text-button" onClick={()=>setFinanceTab('transactions')}>Abrir todas <ArrowUpRight size={15}/></button></div>
        <MovementList items={currentMonthEntries.slice(0,8)}/>
      </P16Card>
    </>;
  }

  function TransactionsView() {
    return <P16Card className="table-panel">
      <div className="table-toolbar">
        <div className="filter-control"><Search size={17}/><input value={entrySearch} onChange={e=>setEntrySearch(e.target.value)} placeholder="Buscar movimentação..."/></div>
        <select aria-label="Filtrar movimentações" value={entryFilter} onChange={e=>setEntryFilter(e.target.value)}><option value="all">Todas as movimentações</option><option value="income">Somente entradas</option><option value="expense">Somente saídas</option></select>
        <button type="button" className="primary-button" onClick={()=>setEntryForm(v=>!v)}><Plus size={17}/> Nova movimentação</button>
      </div>
      {entryForm&&<form className="inline-form four-fields" onSubmit={registerEntry}>
        <label>Descrição<input value={entryDescription} onChange={e=>setEntryDescription(e.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: venda no balcão"/></label>
        <label>Tipo<select value={entryDirection} onChange={e=>setEntryDirection(e.target.value)}><option value="income">Entrada</option><option value="expense">Saída</option></select></label>
        <label>Categoria<input value={entryCategory} onChange={e=>setEntryCategory(e.target.value)}/></label>
        <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={entryAmount} onChange={e=>setEntryAmount(e.target.value)} required/></label>
        <label>Data<input type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)} required/></label>
        <label>Forma de pagamento<select value={entryMethod} onChange={e=>setEntryMethod(e.target.value)}>{paymentOptions.map(x=><option key={x}>{x}</option>)}</select></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={()=>setEntryForm(false)}>Cancelar</button><button type="submit" className="primary-button">Salvar lançamento</button></div>
      </form>}
      <MovementList items={filteredEntries}/>
    </P16Card>;
  }

  function PayablesView() {
    const pending=openPayables;
    return <P16Card className="table-panel">
      <div className="table-toolbar"><div><h3>Contas cadastradas</h3><p>{pending.length} pendentes · {cash(pendingPayablesTotal)} em aberto</p></div><button type="button" className="primary-button" onClick={()=>setPayableForm(v=>!v)}><Plus size={17}/> Nova conta</button></div>
      {payableForm&&<form className="inline-form four-fields" onSubmit={createPayable}>
        <label>Descrição<input value={payableDescription} onChange={e=>setPayableDescription(e.target.value)} minLength={2} required placeholder="Ex.: fornecedor de bebidas"/></label>
        <label>Categoria<input value={payableCategory} onChange={e=>setPayableCategory(e.target.value)}/></label>
        <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={payableAmount} onChange={e=>setPayableAmount(e.target.value)} required/></label>
        <label>Vencimento<input type="date" value={payableDate} onChange={e=>setPayableDate(e.target.value)} required/></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={()=>setPayableForm(false)}>Cancelar</button><button type="submit" className="primary-button">Salvar conta</button></div>
      </form>}
      <div className="data-table-wrap desktop-record-table"><table className="data-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {payables.map(item=>{const due=dueInfo(item.dueDate);return <tr key={item.id}><td><strong>{item.description}</strong></td><td>{item.category}</td><td>{dateText(item.dueDate)}</td><td className="amount-cell">{cash(item.amountCents)}</td><td><span className={'status-pill '+(item.status==='paid'?'done':'pending')}>{item.status==='paid'?'Paga':due.label}</span></td><td><div className="record-actions">{item.status==='pending'?<><button type="button" className="small-action" onClick={()=>payPayable(item)}><Check size={14}/> Marcar paga</button><button type="button" className="small-action danger-action" onClick={()=>setPayables(xs=>xs.filter(x=>x.id!==item.id))}><Trash2 size={14}/> Excluir</button></>:<small>Histórico preservado</small>}</div></td></tr>;})}
      </tbody></table></div>
      <div className="record-cards-mobile">{payables.map(item=>{const due=dueInfo(item.dueDate);return <article className="record-card" key={item.id}><div className="record-card-heading"><div><strong>{item.description}</strong><span>{item.category} · {dateText(item.dueDate)}</span></div><span className={'status-pill '+(item.status==='paid'?'done':'pending')}>{item.status==='paid'?'Paga':due.label}</span></div><strong>{cash(item.amountCents)}</strong>{item.status==='pending'&&<div className="record-actions"><button className="small-action" onClick={()=>payPayable(item)}>Marcar paga</button><button className="small-action danger-action" onClick={()=>setPayables(xs=>xs.filter(x=>x.id!==item.id))}>Excluir</button></div>}</article>;})}</div>
      {!payables.length&&<div className="empty-state">Nenhuma conta cadastrada.</div>}
    </P16Card>;
  }

  function ReceivablesView() {
    return <P16Card className="table-panel">
      <div className="table-toolbar"><div><h3>Valores cadastrados</h3><p>{openReceivables.length} pendentes · {cash(pendingReceivablesTotal)} em aberto</p></div><button type="button" className="primary-button" onClick={()=>setReceivableForm(v=>!v)}><Plus size={17}/> Novo valor a receber</button></div>
      {receivableForm&&<form className="inline-form four-fields" onSubmit={createReceivable}>
        <label>Descrição<input value={receivableDescription} onChange={e=>setReceivableDescription(e.target.value)} minLength={2} required placeholder="Ex.: venda a prazo"/></label>
        <label>Cliente / origem<input value={receivableSource} onChange={e=>setReceivableSource(e.target.value)} placeholder="Ex.: balcão"/></label>
        <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={receivableAmount} onChange={e=>setReceivableAmount(e.target.value)} required/></label>
        <label>Vencimento previsto<input type="date" value={receivableDate} onChange={e=>setReceivableDate(e.target.value)} required/></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={()=>setReceivableForm(false)}>Cancelar</button><button type="submit" className="primary-button">Salvar valor</button></div>
      </form>}
      <div className="data-table-wrap desktop-record-table"><table className="data-table"><thead><tr><th>Descrição</th><th>Cliente / origem</th><th>Previsão</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {receivables.map(item=>{const due=dueInfo(item.dueDate);return <tr key={item.id}><td><strong>{item.description}</strong></td><td>{item.counterparty}</td><td>{dateText(item.dueDate)}</td><td className="amount-cell">{cash(item.amountCents)}</td><td><span className={'status-pill '+(item.status==='received'?'done':item.status==='cancelled'?'cancelled':'pending')}>{item.status==='received'?'Recebido':item.status==='cancelled'?'Cancelado':due.label}</span></td><td><div className="record-actions">{item.orderId?<small>Pagamento gerenciado em Pedidos</small>:item.status==='pending'?<><button type="button" className="small-action" onClick={()=>receiveManual(item)}><Check size={14}/> Confirmar</button><button type="button" className="small-action danger-action" onClick={()=>setReceivables(xs=>xs.filter(x=>x.id!==item.id))}><Trash2 size={14}/> Excluir</button></>:<small>Histórico preservado</small>}</div></td></tr>;})}
      </tbody></table></div>
      <div className="record-cards-mobile">{receivables.map(item=>{const due=dueInfo(item.dueDate);return <article className="record-card" key={item.id}><div className="record-card-heading"><div><strong>{item.description}</strong><span>{item.counterparty} · {dateText(item.dueDate)}</span></div><span className={'status-pill '+(item.status==='received'?'done':item.status==='cancelled'?'cancelled':'pending')}>{item.status==='received'?'Recebido':item.status==='cancelled'?'Cancelado':due.label}</span></div><strong>{cash(item.amountCents)}</strong>{item.orderId?<small>Pagamento gerenciado em Pedidos</small>:item.status==='pending'&&<div className="record-actions"><button className="small-action" onClick={()=>receiveManual(item)}>Confirmar recebimento</button><button className="small-action danger-action" onClick={()=>setReceivables(xs=>xs.filter(x=>x.id!==item.id))}>Excluir</button></div>}</article>;})}</div>
      <p className="table-footnote">Valores vinculados aos pedidos são recebidos exclusivamente na área Pedidos. O status do preparo não altera o status do pagamento.</p>
    </P16Card>;
  }

  function InventoryView() {
    const resale=products.filter(p=>p.sellable&&p.kind==='resale'&&p.name.toLowerCase().includes(productSearch.toLowerCase()));
    const prepared=products.filter(p=>p.sellable&&p.kind==='prepared'&&p.name.toLowerCase().includes(productSearch.toLowerCase()));
    return <div className="inventory-view">
      <P16Card className="inventory-catalog-panel">
        <div className="table-toolbar"><div><h3>Produtos e estoque</h3><p>Cadastre produtos e acompanhe quantidades, custos e margens.</p></div><button type="button" className="primary-button" onClick={()=>setProductForm(v=>!v)}><Plus size={17}/> Novo produto</button></div>
        <label className="stock-history-search"><Search size={16}/><input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Buscar produto..."/></label>
        {productForm&&<form className="inline-form four-fields" onSubmit={addProduct}>
          <label>Nome do item<input name="name" minLength="2" required placeholder="Ex.: Refrigerante lata 350 ml"/></label>
          <label>Categoria<input name="category" required defaultValue="Geral"/></label>
          <label>Tipo de item<select name="kind" value={productKind} onChange={e=>setProductKind(e.target.value)}><option value="resale">Revenda — produto comprado pronto</option><option value="prepared">Preparado na hora</option></select></label>
          <label>{productKind==='prepared'?'Custo estimado por unidade (R$)':'Custo de compra por unidade (R$)'}<input name="cost" type="number" min="0" step="0.01" required/></label>
          <label>Preço de venda (R$)<input name="price" type="number" min="0.01" step="0.01" required/></label>
          {productKind==='resale'&&<><label>Quantidade inicial<input name="stock" type="number" min="0" step="0.001" required/></label><label>Estoque mínimo<input name="minimum" type="number" min="0" step="0.001" required/></label></>}
          <label>Unidade<select name="unit" defaultValue={productKind==='prepared'?'porcao':'un'}>{unitOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <p className="product-kind-note form-wide-label">{productKind==='resale'?'Produto comprado pronto e vendido como está; quantidade e estoque mínimo são controlados.':'Preparado na hora. O custo é estimado e não existe estoque próprio do produto final.'}</p>
          <div className="form-actions"><button type="button" className="outline-button" onClick={()=>{setProductForm(false);setProductKind('resale')}}>Cancelar</button><button type="submit" className="primary-button">Salvar item</button></div>
        </form>}
        {selectedStockProduct&&<form className="inline-form four-fields stock-movement-form" onSubmit={saveStockMovement}>
          <div className="form-wide-label stock-movement-form-heading"><div><strong>Movimentar estoque: {selectedStockProduct.name}</strong><span>Saldo atual: {productQuantity(selectedStockProduct,selectedStockProduct.stock)} {selectedStockProduct.unit}</span></div><button type="button" className="icon-button" aria-label="Fechar movimentação" onClick={()=>setStockProductId('')}><X size={16}/></button></div>
          <label>Tipo de movimento<select value={stockType} onChange={e=>setStockType(e.target.value)}>{[['purchase','Entrada por compra'],['return','Devolução / retorno ao estoque'],['adjustment_in','Ajuste positivo de inventário'],['sale','Venda avulsa (fora de Pedidos)'],['adjustment_out','Ajuste negativo de inventário'],['waste','Perda / descarte']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Quantidade ({selectedStockProduct.unit})<input type="number" min={['un','porcao'].includes(selectedStockProduct.unit)?1:.001} step={['un','porcao'].includes(selectedStockProduct.unit)?1:.001} value={stockQuantity} onChange={e=>setStockQuantity(e.target.value)} required/></label>
          <label>Data da movimentação<input type="date" value={stockDate} onChange={e=>setStockDate(e.target.value)} required/></label>
          <label>Motivo / referência<input minLength="5" maxLength="160" value={stockReason} onChange={e=>setStockReason(e.target.value)} placeholder="Ex.: compra fornecedor / perda / contagem física" required/></label>
          <p className="form-wide-label">Saídas não podem deixar o estoque negativo. Venda avulsa não registra receita no caixa.</p>
          <div className="form-actions"><button type="button" className="outline-button" onClick={()=>setStockProductId('')}>Cancelar</button><button type="submit" className="primary-button">Registrar movimento</button></div>
        </form>}
        <div className="product-groups">
          <ProductGroup title="Produtos de revenda" description="Comprados prontos; têm quantidade em estoque." products={resale} onMove={beginStockMovement} onRemove={p=>setProducts(xs=>xs.map(x=>x.id===p.id?{...x,sellable:false,archived:true}:x))}/>
          <ProductGroup title="Preparados na hora" description="Lanches e drinks; o custo é estimado e não há estoque do produto final." products={prepared} onMove={beginStockMovement} onRemove={p=>setProducts(xs=>xs.map(x=>x.id===p.id?{...x,sellable:false,archived:true}:x))}/>
        </div>
      </P16Card>
      <P16Card className="stock-history-panel">
        <div className="panel-heading stock-history-heading"><div><h3>Histórico de estoque</h3><p>Entradas, saídas, perdas e baixas automáticas dos pedidos.</p></div><span className="stock-history-count">{filteredStock.length} movimentos</span></div>
        <div className="stock-history-controls">
          <label className="stock-history-search"><Search size={16}/><input value={stockSearch} onChange={e=>setStockSearch(e.target.value)} placeholder="Buscar produto ou motivo..."/></label>
          <label className="stock-history-filter"><span>Tipo</span><select value={stockFilter} onChange={e=>setStockFilter(e.target.value)}><option value="all">Todas</option><option value="inbound">Entradas</option><option value="outbound">Saídas</option><option value="waste">Perdas</option></select></label>
        </div>
        {filteredStock.length?<div className="stock-history-list">{visibleMovements.map(movement=>{
          const product=products.find(item=>item.id===movement.productId);
          const delta=movement.after-movement.before;
          return <article className="stock-history-entry" key={movement.id}>
            <span className={'stock-history-icon '+(delta>=0?'is-increase':'is-decrease')}><Package size={17}/></span>
            <div className="stock-history-main"><div className="stock-history-title"><strong>{product?.name||'Produto fora do catálogo'}</strong><span className={'stock-history-kind '+(delta>=0?'is-increase':'is-decrease')}>{stockTypes[movement.type]}</span></div><p>{movement.reason}</p><div className="stock-history-meta"><span>{dateText(movement.movementDate)}</span><span>Saldo: {productQuantity({unit:'un'},movement.before)} → {productQuantity({unit:'un'},movement.after)} {product?.unit||'un'}</span></div></div>
            <strong className={'stock-history-delta '+(delta>=0?'positive':'negative')}>{delta>0?'+':'−'}{productQuantity({unit:'un'},Math.abs(delta))} {product?.unit||'un'}</strong>
          </article>;
        })}</div>:<div className="empty-state stock-history-empty">Ainda não há movimentações de estoque registradas.</div>}
        {filteredStock.length>8&&<button type="button" className="text-button stock-history-toggle" onClick={()=>setStockHistoryExpanded(v=>!v)}>{stockHistoryExpanded?'Mostrar menos':'Ver todos os resultados ('+filteredStock.length+')'} <ChevronDown size={15}/></button>}
      </P16Card>
    </div>;
  }
  function OrdersModule() {
    const sessionOrders=orders.filter(order=>order.sessionNumber===sessionNumber);
    const active=sessionOrders.filter(order=>['Recebido','Em preparo','Pronto'].includes(order.status));
    const done=sessionOrders.filter(order=>order.status==='Entregue').length;
    const ready=sessionOrders.filter(order=>order.status==='Pronto').length;
    const orderItemsText=order=>order.items.map(line=>{
      const product=products.find(item=>item.id===line.productId);
      return productQuantity(product||{unit:'un'},line.quantity)+'x '+(product?.name||'Produto');
    }).join(', ');
    return <section className="page-content">
      <div className="page-heading-row orders-page-heading">
        <div><div className="section-kicker">OPERAÇÃO DO ESTABELECIMENTO</div><h1>Pedidos</h1><p>Organize o preparo e acompanhe as retiradas durante o expediente.</p></div>
        <div className="orders-session-actions">
          {sessionOpen?<button type="button" className="outline-button session-close-button" onClick={closeSession}><StopCircle size={17}/> Encerrar atendimento</button>:<button type="button" className="primary-button session-start-button" onClick={startSession}><PlayCircle size={17}/> Iniciar atendimento</button>}
        </div>
      </div>
      <div className={'order-session-banner '+(sessionOpen?'is-open':'is-closed')}>
        <span className="order-session-icon">{sessionOpen?<CheckCircle2 size={19}/>:<ShieldCheck size={19}/>}</span>
        <div className="order-session-copy">
          <strong>{sessionOpen?'Atendimento aberto':'Atendimento encerrado'}</strong>
          <span>{sessionOpen?'Iniciado às '+sessionStartedAt+' · '+dateText(todayKey(0)):'Novos pedidos estão bloqueados. Inicie o atendimento quando a loja abrir.'}</span>
          {sessionOpen&&active.length>0&&<small>{active.length} pedido(s) ainda precisam ser entregues ou cancelados para permitir o encerramento.</small>}
        </div>
        {sessionOpen&&<div className="order-session-next"><span>PRÓXIMO PEDIDO</span><strong>#{String(nextOrderNumber).padStart(3,'0')}</strong></div>}
      </div>
      <div className="order-section-label"><span>RESUMO DO ATENDIMENTO</span><small>{sessionOrders.length} {sessionOrders.length===1?'pedido registrado':'pedidos registrados'}</small></div>
      <div className="metrics-grid order-metrics">
        <Metric label="Pedidos pendentes" value={String(active.length).padStart(2,'0')} detail="Em preparo ou aguardando retirada" tone="gold"/>
        <Metric label="Prontos para retirada" value={String(ready).padStart(2,'0')} detail="Aguardando cliente" tone="blue"/>
        <Metric label="Entregues" value={String(done).padStart(2,'0')} detail="Concluídos neste atendimento" tone="green"/>
      </div>
      <section className="panel order-board">
        <div className="table-toolbar order-board-toolbar">
          <div className="order-board-heading-copy">
            <div className="order-board-title-row"><h3>{orderScope==='all'?'Histórico de pedidos':sessionOpen?'Pedidos do atendimento':'Pedidos do último atendimento'}</h3><span className="order-result-count">{shownOrders.length} {shownOrders.length===1?'pedido':'pedidos'}</span></div>
            <p>Acompanhe o preparo, a retirada e o pagamento de cada pedido.</p>
            <div className="order-scope-switch">
              <button type="button" className={orderScope==='session'?'active':''} onClick={()=>setOrderScope('session')}>{sessionOpen?'Atendimento atual':'Último atendimento'}</button>
              <button type="button" className={orderScope==='all'?'active':''} onClick={()=>setOrderScope('all')}>Todo o histórico</button>
            </div>
          </div>
          <div className="order-board-toolbar-actions">
            {sessionOpen&&<button type="button" className="primary-button order-new-button" onClick={openNewOrder}><Plus size={17}/> Novo pedido</button>}
            <div className="filter-control"><Search size={17}/><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Buscar número ou cliente..."/></div>
          </div>
        </div>
        {orderForm&&sessionOpen&&<form className="panel order-form" onSubmit={createOrder}>
          <div className="panel-heading"><div><h3>Novo pedido</h3><p>Adicione todos os produtos antes de registrar.</p></div><button type="button" className="icon-button" aria-label="Fechar formulário" onClick={()=>setOrderForm(false)}><X size={17}/></button></div>
          <div className="order-form-grid">
            <label className="order-customer-field">Identificação / cliente<input value={orderCustomer} onChange={e=>setOrderCustomer(e.target.value)} placeholder="Ex.: Balcão"/></label>
            <section className="order-items-section" aria-label="Itens do pedido">
              <div className="order-items-heading"><div><h4>Produtos deste pedido</h4><span>{draftItems.length} {draftItems.length===1?'produto':'produtos'} · adicione todos antes de registrar</span></div></div>
              {draftItems.map((row,index)=>{
                const product=products.find(item=>item.id===row.productId);
                const lineTotal=product?Math.round(product.priceCents*Number(row.quantity||0)):0;
                return <div className="order-item-row" key={row.id}>
                  <label className="order-item-product">Produto {index+1}<select value={row.productId} onChange={e=>changeDraftLine(row.id,{productId:e.target.value})} required><option value="">Selecione um produto</option>{products.filter(item=>item.sellable).map(item=><option key={item.id} value={item.id}>{item.name} — {cash(item.priceCents)}</option>)}</select></label>
                  <label className="order-item-quantity">Quantidade<input type="number" min={product&&['un','porcao'].includes(product.unit)?1:.001} step={product&&['un','porcao'].includes(product.unit)?1:.001} value={row.quantity} onChange={e=>changeDraftLine(row.id,{quantity:e.target.value})} required/></label>
                  <div className={'order-item-subtotal '+(product?'':'is-empty')}><span>Subtotal</span><strong>{product?cash(lineTotal):'—'}</strong><small>{product?.name||'Escolha um produto'}</small></div>
                  <button type="button" className="order-item-remove" aria-label={'Remover item '+(index+1)} disabled={draftItems.length===1} onClick={()=>setDraftItems(rows=>rows.filter(item=>item.id!==row.id))}><Trash2 size={16}/></button>
                </div>;
              })}
              <button type="button" className="primary-button order-add-item" onClick={()=>setDraftItems(rows=>[...rows,{id:Date.now(),productId:'',quantity:'1'}])}><Plus size={16}/> Adicionar outro produto ao pedido</button>
            </section>
            <div className="order-order-total"><span>Total do pedido</span><strong>{cash(draftItems.reduce((sum,row)=>sum+(products.find(item=>item.id===row.productId)?.priceCents||0)*Number(row.quantity||0),0))}</strong></div>
          </div>
          <div className="form-actions"><button type="button" className="outline-button" onClick={()=>setOrderForm(false)}>Cancelar</button><button type="submit" className="primary-button">Registrar pedido</button></div>
        </form>}
        {shownOrders.length===0?<div className="empty-state order-empty-state"><span className="order-empty-icon"><ClipboardList size={22}/></span><strong>{orderSearch.trim()?'Nenhum pedido encontrado':sessionOpen&&orderScope==='session'?'Nenhum pedido neste atendimento ainda':'Não há pedidos para exibir'}</strong><p>{orderSearch.trim()?'Tente outro número ou nome de cliente.':sessionOpen&&orderScope==='session'?'Registre o primeiro pedido deste expediente para começar a acompanhar o preparo e a retirada.':'Quando houver pedidos neste período, eles aparecerão aqui.'}</p>{!orderSearch.trim()&&sessionOpen&&orderScope==='session'&&<button type="button" className="outline-button" onClick={openNewOrder}><Plus size={15}/> Criar primeiro pedido</button>}</div>:<div className="order-list">{shownOrders.map(order=><OrderCard key={order.id} order={order} itemsText={orderItemsText(order)}/>)}</div>}
      </section>
      <OrderReport/>
      <div className="integration-note"><Bell size={18}/><div><strong>Operação demonstrativa</strong><p>Os pedidos são lançados pela equipe nesta área interna. Não existe cardápio público, mapa de mesas ou login específico para garçons nesta demonstração.</p></div></div>
    </section>;
  }

  function OrderCard({order,itemsText}) {
    const statusNext={Recebido:'Em preparo','Em preparo':'Pronto',Pronto:'Entregue'};
    const canOperate=sessionOpen&&order.sessionNumber===sessionNumber&&!['Entregue','Cancelado'].includes(order.status);
    const paymentLabel=order.paymentStatus==='paid'?'Pago · '+order.paymentMethod:order.status==='Cancelado'?'Cancelado sem pagamento':'Pagamento pendente';
    return <article className="order-card">
      <div className="order-number"><span>PEDIDO</span><strong>#{String(order.number).padStart(3,'0')}</strong><small>{order.createdAt} · {dateText(order.businessDate)}</small></div>
      <div className="order-description">
        <strong>{order.customer}</strong><p>{itemsText}</p>
        <div className="order-meta-row"><span className="order-total">{cash(order.totalCents)}</span>
          <span className={'order-payment-state '+(order.paymentStatus==='paid'?'is-paid':'is-pending')}><i aria-hidden="true"/>{paymentLabel}</span>
        </div>
      </div>
      <div className="order-status-actions">
        <div className="order-status-stack"><span className={'status-pill '+(order.status==='Pronto'?'ready':order.status==='Entregue'?'done':order.status==='Cancelado'?'cancelled':'pending')}>{order.status}</span></div>
        {(canOperate&&statusNext[order.status]||(order.paymentStatus!=='paid'&&order.status==='Entregue'))&&<div className={'order-action-buttons '+(order.paymentStatus!=='paid'?'has-two-actions':'')}>
          {canOperate&&statusNext[order.status]&&<button type="button" className={'small-action order-operational-action '+(order.status==='Em preparo'?'ready-action':'')} onClick={()=>moveOrderStatus(order,statusNext[order.status])}>{order.status==='Recebido'?'Iniciar preparo':order.status==='Em preparo'?'Marcar pronto':'Confirmar retirada'} <ArrowUpRight size={14}/></button>}
          {canOperate&&order.paymentStatus!=='paid'&&<button type="button" className="small-action danger-action order-cancel-action" onClick={()=>cancelOrder(order)}><X size={14}/> Cancelar pedido</button>}
          {order.paymentStatus!=='paid'&&order.status!=='Cancelado'&&<button type="button" className="small-action order-payment-inline-action" onClick={()=>openPayment(order)}><CreditCard size={14}/> Registrar pagamento</button>}
        </div>}
      </div>
      {paymentOrderId===order.id&&<form className="order-payment-form" onSubmit={event=>registerOrderPayment(event,order)}>
        <div className="order-payment-heading"><strong>Pagamento do pedido #{String(order.number).padStart(3,'0')}</strong><span>Valor integral: {cash(order.totalCents)}</span></div>
        <label>Data do pagamento<input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required/></label>
        <label>Forma de pagamento<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{paymentOptions.map(method=><option key={method}>{method}</option>)}</select></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={()=>setPaymentOrderId('')}>Cancelar</button><button type="submit" className="primary-button"><Check size={14}/> Confirmar pagamento</button></div>
      </form>}
    </article>;
  }

  function OrderReport() {
    const items=reportList;
    const dayGroups=Object.values(items.reduce((acc,order)=>{const key=order.businessDate;acc[key]=acc[key]||{date:key,orders:0,cancelled:0,sold:0,pending:0};acc[key].orders+=1;if(order.status==='Cancelado')acc[key].cancelled+=1;else{acc[key].sold+=order.totalCents;if(order.paymentStatus!=='paid')acc[key].pending+=order.totalCents;}return acc;},{})).sort((a,b)=>a.date.localeCompare(b.date));
    const formattedPeriod=reportPeriod==='day'?dateText(reportDate):new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(reportDate.slice(0,7)+'-15T12:00:00'));
    return <section className="panel orders-report-panel orders-report-panel-order-only">
      <div className="panel-heading orders-report-heading"><div><div className="section-kicker">ACOMPANHAMENTO OPERACIONAL</div><h3><BarChart3 size={18}/> Relatório de pedidos</h3><p>Pedidos agrupados pela data em que foram criados. Os valores de pagamento são vinculados a esses pedidos.</p></div><div className="orders-report-period"><button type="button" className={reportPeriod==='day'?'active':''} onClick={()=>setReportPeriod('day')}>Diário</button><button type="button" className={reportPeriod==='month'?'active':''} onClick={()=>setReportPeriod('month')}>Mensal</button></div></div>
      <div className="orders-report-controls"><label>{reportPeriod==='day'?'Dia dos pedidos':'Mês dos pedidos'}<input aria-label={reportPeriod==='day'?'Dia dos pedidos':'Mês dos pedidos'} type={reportPeriod==='day'?'date':'month'} value={reportPeriod==='day'?reportDate:reportDate.slice(0,7)} onChange={e=>setReportDate(reportPeriod==='day'?e.target.value:e.target.value+'-15')}/></label><span>{formattedPeriod}</span></div>
      <div className="order-report-summary">
        <div className="order-report-summary-heading"><span className="order-report-eyebrow">{reportPeriod==='day'?'RESUMO DO DIA':'RESUMO DO MÊS'}</span><p>Pedidos criados em {formattedPeriod}.</p></div>
        <div className="order-report-key-values order-report-key-values-simple">
          <div className="order-report-summary-count"><span>Pedidos registrados</span><strong>{items.length}</strong><small>{items.filter(x=>x.status==='Entregue').length} entregues · {items.filter(x=>x.status==='Cancelado').length} cancelados</small></div>
          <div><span>Total vendido</span><strong>{cash(reportSold)}</strong><small>Pedidos não cancelados</small></div>
          <div className="order-report-value-pending"><span>Falta receber</span><strong>{cash(reportPending)}</strong><small>Valor dos pedidos ainda não pagos</small></div>
        </div>
      </div>
      {reportPeriod==='month'&&<section className="order-report-breakdown order-report-breakdown-month">
        <div className="order-report-breakdown-heading"><h4>Pedidos por dia</h4></div>
        <div className="orders-report-table-wrap"><table className="orders-report-table"><thead><tr><th>Dia</th><th>Pedidos</th><th>Cancelados</th><th>Total vendido</th><th>Falta receber</th></tr></thead><tbody>{dayGroups.length?dayGroups.map(day=><tr key={day.date}><td>{dateText(day.date)}</td><td>{day.orders}</td><td>{day.cancelled}</td><td>{cash(day.sold)}</td><td>{cash(day.pending)}</td></tr>):<tr><td colSpan={5}>Nenhum pedido criado neste mês.</td></tr>}</tbody></table></div>
        <div className="order-report-days-mobile">{dayGroups.length?dayGroups.map(day=><article className="order-report-day-card" key={'mobile-'+day.date}><div className="order-report-day-card-heading"><strong>{dateText(day.date)}</strong><span>{day.orders} pedidos</span></div><div className="order-report-day-card-stats"><div><span>Cancelados</span><strong>{day.cancelled}</strong></div><div><span>Total vendido</span><strong>{cash(day.sold)}</strong></div><div><span>Falta receber</span><strong>{cash(day.pending)}</strong></div></div></article>):<div className="order-report-days-empty">Nenhum pedido criado neste mês.</div>}</div>
      </section>}
    </section>;
  }
}
function ProductGroup({title,description,products,onMove,onRemove}) {
  const [expanded,setExpanded]=useState(false);
  return <section className={'product-group '+(expanded?'is-expanded':'is-collapsed')}>
    <div className="product-group-heading">
      <div><h4>{title}</h4><p>{description}</p></div>
      <button type="button" className="product-group-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
        <span>{products.length} {products.length===1?'item':'itens'}</span><ChevronDown size={17}/>
      </button>
    </div>
    {expanded&&(products.length===0?<div className="product-group-empty">Nenhum produto nesta categoria.</div>:<>
      <div className="data-table-wrap desktop-record-table">
        <table className="data-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Margem estimada</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>{products.map(product=><tr key={product.id}>
            <td><div className="table-product"><span className="product-avatar"><Package size={16}/></span><strong>{product.name}</strong></div></td>
            <td>{product.category}</td><td>{cash(product.costCents)}</td><td className="amount-cell">{cash(product.priceCents)}</td>
            <td className={product.priceCents>=product.costCents?'positive':'negative'}>{cash(product.priceCents-product.costCents)}</td>
            <td>{product.stockTracked?productQuantity(product,product.stock)+' '+product.unit:'Sem estoque próprio'}</td>
            <td><span className={'status-pill '+(product.kind==='prepared'?'done':product.stock<=product.minimum?'pending':'done')}>{product.kind==='prepared'?'Feito na hora':product.stock<=product.minimum?'Repor estoque':'Disponível'}</span></td>
            <td><div className="record-actions">{product.stockTracked&&<button type="button" className="small-action" onClick={()=>onMove(product)}><Package size={14}/> Movimentar</button>}<button type="button" className="small-action danger-action" onClick={()=>onRemove(product)}><Trash2 size={14}/> Arquivar</button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="product-cards-mobile">{products.map(product=><article className="product-card-mobile" key={product.id}>
        <div className="product-card-top"><span className="product-avatar"><Package size={17}/></span><div><strong>{product.name}</strong><span>{product.category}</span></div><span className={'status-pill '+(product.kind==='prepared'?'done':product.stock<=product.minimum?'pending':'done')}>{product.kind==='prepared'?'Preparado':product.stock<=product.minimum?'Repor':'Disponível'}</span></div>
        <div className="product-card-values"><div><span>{product.kind==='prepared'?'Custo estimado':'Custo unitário'}</span><strong>{cash(product.costCents)}</strong></div><div><span>Preço de venda</span><strong>{cash(product.priceCents)}</strong></div><div><span>Margem estimada</span><strong className={product.priceCents>=product.costCents?'positive':'negative'}>{cash(product.priceCents-product.costCents)}</strong></div></div>
        <div className="product-card-stock"><span>{product.stockTracked?'Estoque atual':'Controle de estoque'}</span><strong>{product.stockTracked?productQuantity(product,product.stock)+' '+product.unit+' · mínimo '+product.minimum:'Não se aplica — feito na hora'}</strong></div>
        <div className="record-actions">{product.stockTracked&&<button type="button" className="small-action" onClick={()=>onMove(product)}><Package size={14}/> Movimentar estoque</button>}<button type="button" className="small-action danger-action" onClick={()=>onRemove(product)}><Trash2 size={14}/> Arquivar</button></div>
      </article>)}</div>
    </>)}
  </section>;
}
function Metric({label,value,detail,tone='blue'}) {
  const icon=tone==='gold'?<TrendingUp size={17}/>:tone==='green'?<ArrowDownLeft size={17}/>:tone==='red'?<ArrowUpRight size={17}/>:<Package size={17}/>;
  return <article className={'metric-card '+(tone==='gold'?'prominent':'')}>
    <div className="metric-top"><span>{label}</span><span className={'metric-icon '+tone}>{icon}</span></div>
    <strong className="metric-value">{value}</strong><div className="metric-detail">{detail}</div>
  </article>;
}
function MovementList({items}) {
  return items.length?<div className="movement-list">{items.map(item=><div className="movement-row" key={item.id}>
    <span className={'movement-icon '+item.direction}>{item.direction==='income'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span>
    <div className="movement-info"><strong>{item.description}</strong><span>{item.category} · {dateText(item.movementDate)} · {item.paymentMethod}</span></div>
    <strong className={'movement-amount '+item.direction}>{item.direction==='income'?'+':'−'} {cash(item.amountCents)}</strong>
  </div>)}</div>:<div className="empty-state">Nenhuma movimentação encontrada para este período.</div>;
}
function CategoryRows({rows,tone='income'}) {
  const total=rows.reduce((sum,item)=>sum+item.amount,0);
  return rows.length?<div className="category-breakdown-list">{rows.map(row=>{
    const percent=total?row.amount/total*100:0;
    return <div className="category-breakdown-row" key={row.label}>
      <div className="category-breakdown-heading"><strong>{row.label}</strong><span>{Math.round(percent)}% · {cash(row.amount)}</span></div>
      <div className="category-breakdown-track"><span className={tone} style={{width:percent+'%'}}/></div>
    </div>;
  })}</div>:<div className="empty-state">Sem movimentações cadastradas.</div>;
}
