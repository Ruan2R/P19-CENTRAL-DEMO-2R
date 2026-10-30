import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, Boxes, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardList, CreditCard, Filter, LayoutDashboard, Package, Plus, RefreshCw,
  Search, ShieldCheck, ShoppingBag, StopCircle, PlayCircle, Trash2, TrendingDown, TrendingUp,
  Wallet, X
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
function P16Card({ children, className = '' }) { return <section className={'p16-card ' + className}>{children}</section>; }
function P16Title({ eyebrow, title, action }) { return <div className="p16-card-title"><div><span>{eyebrow}</span><h3>{title}</h3></div>{action}</div>; }
function P16Field({ label, children }) { return <label className="p16-field"><span>{label}</span>{children}</label>; }
function P16Count({ children }) { return <span className="p16-count">{children}</span>; }
function P16Button({ children, onClick, outline = false, disabled = false, type = 'button' }) { return <button type={type} disabled={disabled} className={'p16-button ' + (outline ? 'outline' : 'primary')} onClick={onClick}>{children}</button>; }
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

export default function BurgerP16Showcase({ module, notify = () => {}, onNavigate = () => {} }) {
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

  return <div className="p16-showcase">
    {module==='orders'?<OrdersModule/>:module==='overview'?<FinanceOverview/>:<FinanceModule/>}
  </div>;

  function FinanceOverview() {
    const monthResult=monthIncome-monthExpenses;
    const attention=[...openPayables,...openReceivables].filter((item)=>dueInfo(item.dueDate).tone!=='normal');
    const methodTotals=Object.fromEntries(paymentOptions.map((method)=>[method,currentMonthEntries.filter((item)=>item.paymentMethod===method).reduce((sum,item)=>sum+(item.direction==='income'?item.amountCents:-item.amountCents),0)]));
    return <div className="p16-view">
      <div className="p16-page-heading"><div><span>CONTROLE NA PALMA DA MÃO</span><h2>Resumo.</h2><p>Consulte rapidamente o caixa e acesse as tarefas mais usadas.</p></div><P16Field label="Mês de referência"><input type="month" value={selectedMonth} onChange={(event)=>setSelectedMonth(event.target.value)}/></P16Field></div>
      <div className="p16-metrics"><Metric label="Resultado do período" value={cash(monthResult)} detail="Entradas recebidas menos saídas pagas" tone="gold"/><Metric label="Entradas recebidas" value={cash(monthIncome)} detail={currentMonthEntries.filter(e=>e.direction==='income').length+' recebimentos'} tone="green"/><Metric label="Saídas pagas" value={cash(monthExpenses)} detail={currentMonthEntries.filter(e=>e.direction==='expense').length+' pagamentos'} tone="red"/></div>
      <div className="p16-dashboard-grid">
        <P16Card><P16Title eyebrow="CAIXA" title="Últimas movimentações" action={<button className="p16-link-button" onClick={()=>setFinanceTab('transactions')}>Ver todas <ArrowRight size={14}/></button>}/><MovementList items={currentMonthEntries.slice(0,5)}/></P16Card>
        <P16Card><P16Title eyebrow="ACESSO RÁPIDO" title="Ações rápidas"/><div className="p16-quick-actions">
          <button onClick={()=>{goFinance('transactions');setEntryForm(true)}}><span><Plus size={16}/></span><div><strong>Nova movimentação</strong><small>Registrar entrada ou saída</small></div><ArrowRight size={14}/></button>
          <button onClick={()=>{goFinance('payables');setPayableForm(true)}}><span><CalendarDays size={16}/></span><div><strong>Adicionar conta a pagar</strong><small>Registrar um vencimento</small></div><ArrowRight size={14}/></button>
          <button onClick={()=>{goFinance('receivables');setReceivableForm(true)}}><span><ArrowDownLeft size={16}/></span><div><strong>Adicionar valor a receber</strong><small>Controlar recebimento futuro</small></div><ArrowRight size={14}/></button>
          <button onClick={()=>{goFinance('inventory');setProductForm(true)}}><span><Package size={16}/></span><div><strong>Cadastrar produto</strong><small>Adicionar ao catálogo</small></div><ArrowRight size={14}/></button>
        </div></P16Card>
      </div>
      {attention.length>0&&<P16Card><P16Title eyebrow="ACOMPANHAMENTO" title="Atenção aos vencimentos" action={<span className="p16-warning-count">{attention.length} itens</span>}/><div className="p16-attention-list">{attention.slice(0,5).map((item)=>{const info=dueInfo(item.dueDate);return <div key={item.id}><strong>{item.description||'Conta'}</strong><span>{cash(item.amountCents)}</span><em className={info.tone}>{info.label}</em></div>})}</div></P16Card>}
      <P16Card><P16Title eyebrow="ANÁLISE" title="Movimentações por forma de pagamento"/><div className="p16-method-grid">{paymentOptions.map((method)=><div key={method}><span>{method}</span><strong>{cash(methodTotals[method])}</strong></div>)}</div></P16Card>
      <p className="p16-note"><ShieldCheck size={14}/> Resultado do período significa entradas de caixa menos saídas pagas; não representa lucro líquido. Contas pendentes não entram no caixa efetivado.</p>
    </div>;
  }
  function FinanceModule() {
    const tabs=[['financial','Financeiro'],['transactions','Movimentações'],['payables','Contas a pagar'],['receivables','Contas a receber'],['inventory','Produtos e estoque']];
    return <div className="p16-view">
      <div className="p16-page-heading"><div><span>GESTÃO DO ESTABELECIMENTO</span><h2>{tabs.find(t=>t[0]===financeTab)?.[1]||'Financeiro'}.</h2><p>Controle de caixa, obrigações, produtos e histórico de estoque.</p></div><P16Field label="Mês de referência"><input type="month" value={selectedMonth} onChange={(event)=>setSelectedMonth(event.target.value)}/></P16Field></div>
      <div className="p16-finance-tabs">{[['overview','Resumo'],...tabs].map(([key,label])=><button key={key} className={financeTab===key?'active':''} onClick={()=>setFinanceTab(key)}>{label}</button>)}</div>
      {financeTab==='overview'&&<FinanceOverview/>}
      {financeTab==='financial'&&<FinancialView/>}
      {financeTab==='transactions'&&<TransactionsView/>}
      {financeTab==='payables'&&<PayablesView/>}
      {financeTab==='receivables'&&<ReceivablesView/>}
      {financeTab==='inventory'&&<InventoryView/>}
    </div>;
  }
  function FinancialView() {
    const result=monthIncome-monthExpenses;
    const overduePayables=openPayables.filter(x=>dueInfo(x.dueDate).tone==='overdue');
    const overdueReceivables=openReceivables.filter(x=>dueInfo(x.dueDate).tone==='overdue');
    const todayCount=[...openPayables,...openReceivables].filter(x=>dueInfo(x.dueDate).tone==='today').length;
    const soonCount=[...openPayables,...openReceivables].filter(x=>dueInfo(x.dueDate).tone==='soon').length;
    const expensesByCategory=Object.values(currentMonthEntries.filter(x=>x.direction==='expense').reduce((acc,item)=>{acc[item.category]=(acc[item.category]||0)+item.amountCents;return acc;},{}));
    const expenseRows=Object.entries(currentMonthEntries.filter(x=>x.direction==='expense').reduce((acc,item)=>{acc[item.category]=(acc[item.category]||0)+item.amountCents;return acc;},{})).map(([label,value])=>({label,amount:value}));
    const incomeRows=Object.entries(currentMonthEntries.filter(x=>x.direction==='income').reduce((acc,item)=>{acc[item.category]=(acc[item.category]||0)+item.amountCents;return acc;},{})).map(([label,value])=>({label,amount:value}));
    return <>
      <P16Card className="p16-cash-equation"><div className="p16-cash-heading"><div><span>RESULTADO FINANCEIRO NO PERÍODO</span><h3>Resultado de {selectedMonth.split('-').reverse().join('/')}</h3></div><em>Valores efetivados</em></div><div className="p16-equation"><div><small>Entradas recebidas</small><strong>{cash(monthIncome)}</strong></div><b>−</b><div><small>Saídas pagas</small><strong>{cash(monthExpenses)}</strong></div><b>=</b><div className="result"><small>Resultado do período</small><strong>{cash(result)}</strong></div></div><p>Resultado = entradas recebidas menos saídas pagas. Contas pendentes ficam separadas; este valor não representa saldo total disponível nem lucro líquido.</p></P16Card>
      {(overduePayables.length||overdueReceivables.length||todayCount||soonCount)>0&&<P16Card><P16Title eyebrow="ACOMPANHAMENTO" title="Atenção aos vencimentos"/><div className="p16-attention-grid"><div className="overdue"><strong>{overduePayables.length+overdueReceivables.length}</strong><span>Vencidas</span><small>{cash(overduePayables.reduce((s,x)=>s+x.amountCents,0))} a pagar · {cash(overdueReceivables.reduce((s,x)=>s+x.amountCents,0))} a receber</small></div><div><strong>{todayCount}</strong><span>Vencem hoje</span><small>Contas a pagar e valores a receber</small></div><div><strong>{soonCount}</strong><span>Próximos 7 dias</span><small>Vencimentos futuros</small></div></div></P16Card>}
      <div className="p16-two-columns">
        <P16Card><P16Title eyebrow="OBRIGAÇÕES" title="Contas a pagar" action={<P16Count>{openPayables.length} pendentes</P16Count>}/><strong className="p16-obligation-total">{cash(pendingPayablesTotal)}</strong>{openPayables.slice(0,4).map(x=><div className="p16-obligation-row" key={x.id}><span>{x.description}<small>{x.category} · {dateText(x.dueDate)}</small></span><b>{cash(x.amountCents)}</b></div>)}<P16Button outline onClick={()=>setFinanceTab('payables')}>Ver contas a pagar <ArrowRight size={14}/></P16Button></P16Card>
        <P16Card><P16Title eyebrow="OBRIGAÇÕES" title="Valores a receber" action={<P16Count>{openReceivables.length} pendentes</P16Count>}/><strong className="p16-obligation-total">{cash(pendingReceivablesTotal)}</strong>{openReceivables.slice(0,4).map(x=><div className="p16-obligation-row" key={x.id}><span>{x.description}<small>{x.counterparty} · {dateText(x.dueDate)}</small></span><b>{cash(x.amountCents)}</b></div>)}<P16Button outline onClick={()=>setFinanceTab('receivables')}>Ver valores a receber <ArrowRight size={14}/></P16Button></P16Card>
      </div>
      <div className="p16-two-columns"><P16Card><P16Title eyebrow="CATEGORIAS" title="Origem das entradas"/><CategoryRows rows={incomeRows}/></P16Card><P16Card><P16Title eyebrow="CATEGORIAS" title="Destino das saídas"/><CategoryRows rows={expenseRows}/></P16Card></div>
      <P16Card><P16Title eyebrow="CAIXA" title="Movimentações do período" action={<button className="p16-link-button" onClick={()=>setFinanceTab('transactions')}>Abrir todas <ArrowRight size={14}/></button>}/><MovementList items={currentMonthEntries.slice(0,6)}/></P16Card>
    </>;
  }
  function TransactionsView() {
    return <P16Card><P16Title eyebrow="CAIXA REALIZADO" title="Movimentações" action={<P16Button onClick={()=>setEntryForm(v=>!v)}><Plus size={15}/> Nova movimentação</P16Button>}/><div className="p16-toolbar"><label className="p16-search"><Search size={16}/><input value={entrySearch} onChange={e=>setEntrySearch(e.target.value)} placeholder="Buscar movimentação..."/></label><select value={entryFilter} onChange={e=>setEntryFilter(e.target.value)}><option value="all">Todas as movimentações</option><option value="income">Somente entradas</option><option value="expense">Somente saídas</option></select></div>{entryForm&&<form className="p16-form" onSubmit={registerEntry}><P16Field label="Descrição"><input value={entryDescription} onChange={e=>setEntryDescription(e.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: venda no balcão"/></P16Field><div className="p16-form-grid"><P16Field label="Tipo"><select value={entryDirection} onChange={e=>setEntryDirection(e.target.value)}><option value="income">Entrada</option><option value="expense">Saída</option></select></P16Field><P16Field label="Categoria"><input value={entryCategory} onChange={e=>setEntryCategory(e.target.value)}/></P16Field><P16Field label="Valor (R$)"><input type="number" min="0.01" step="0.01" value={entryAmount} onChange={e=>setEntryAmount(e.target.value)} required/></P16Field><P16Field label="Data"><input type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)} required/></P16Field><P16Field label="Forma de pagamento"><select value={entryMethod} onChange={e=>setEntryMethod(e.target.value)}>{paymentOptions.map(x=><option key={x}>{x}</option>)}</select></P16Field></div><div className="p16-form-actions"><P16Button outline onClick={()=>setEntryForm(false)}>Cancelar</P16Button><P16Button type="submit">Salvar lançamento</P16Button></div></form>}<MovementList items={filteredEntries}/></P16Card>;
  }
  function PayablesView() {
    return <P16Card><P16Title eyebrow="ORGANIZAÇÃO" title="Contas a pagar" action={<P16Button onClick={()=>setPayableForm(v=>!v)}><Plus size={15}/> Nova conta</P16Button>}/>{payableForm&&<form className="p16-form" onSubmit={createPayable}><div className="p16-form-grid"><P16Field label="Descrição"><input value={payableDescription} onChange={e=>setPayableDescription(e.target.value)} minLength={2} required placeholder="Ex.: fornecedor de bebidas"/></P16Field><P16Field label="Categoria"><input value={payableCategory} onChange={e=>setPayableCategory(e.target.value)}/></P16Field><P16Field label="Valor (R$)"><input type="number" min="0.01" step="0.01" value={payableAmount} onChange={e=>setPayableAmount(e.target.value)} required/></P16Field><P16Field label="Vencimento"><input type="date" value={payableDate} onChange={e=>setPayableDate(e.target.value)} required/></P16Field></div><div className="p16-form-actions"><P16Button outline onClick={()=>setPayableForm(false)}>Cancelar</P16Button><P16Button type="submit">Salvar conta</P16Button></div></form>}<div className="p16-record-list">{payables.map(item=>{const due=dueInfo(item.dueDate);return <article key={item.id}><div><strong>{item.description}</strong><small>{item.category} · Vencimento {dateText(item.dueDate)}</small><em className={item.status==='paid'?'paid':due.tone}>{item.status==='paid'?'Paga':due.label}</em></div><b>{cash(item.amountCents)}</b><div className="p16-record-actions">{item.status==='pending'?<><button onClick={()=>payPayable(item)}><Check size={13}/> Marcar paga</button><button className="danger" onClick={()=>setPayables(xs=>xs.filter(x=>x.id!==item.id))}><Trash2 size={13}/> Excluir</button></>:<small>Histórico preservado</small>}</div></article>;})}</div></P16Card>;
  }
  function ReceivablesView() {
    return <P16Card><P16Title eyebrow="VALORES FUTUROS" title="Contas a receber" action={<P16Button onClick={()=>setReceivableForm(v=>!v)}><Plus size={15}/> Novo valor a receber</P16Button>}/>{receivableForm&&<form className="p16-form" onSubmit={createReceivable}><div className="p16-form-grid"><P16Field label="Descrição"><input value={receivableDescription} onChange={e=>setReceivableDescription(e.target.value)} minLength={2} required placeholder="Ex.: venda a prazo"/></P16Field><P16Field label="Cliente / origem"><input value={receivableSource} onChange={e=>setReceivableSource(e.target.value)} placeholder="Ex.: balcão"/></P16Field><P16Field label="Valor (R$)"><input type="number" min="0.01" step="0.01" value={receivableAmount} onChange={e=>setReceivableAmount(e.target.value)} required/></P16Field><P16Field label="Vencimento previsto"><input type="date" value={receivableDate} onChange={e=>setReceivableDate(e.target.value)} required/></P16Field></div><div className="p16-form-actions"><P16Button outline onClick={()=>setReceivableForm(false)}>Cancelar</P16Button><P16Button type="submit">Salvar valor</P16Button></div></form>}<div className="p16-record-list">{receivables.map(item=>{const due=dueInfo(item.dueDate);return <article key={item.id}><div><strong>{item.description}</strong><small>{item.counterparty} · Data prevista {dateText(item.dueDate)}</small><em className={item.status==='received'?'paid':item.status==='cancelled'?'cancelled':due.tone}>{item.status==='received'?'Recebido':item.status==='cancelled'?'Cancelado':due.label}</em></div><b>{cash(item.amountCents)}</b><div className="p16-record-actions">{item.orderId?<small>Pagamento gerenciado em Pedidos</small>:item.status==='pending'?<><button onClick={()=>receiveManual(item)}><Check size={13}/> Confirmar recebimento</button><button className="danger" onClick={()=>setReceivables(xs=>xs.filter(x=>x.id!==item.id))}><Trash2 size={13}/> Excluir</button></>:<small>Histórico preservado</small>}</div></article>;})}</div><p className="p16-note">Recebíveis vinculados a pedidos são pagos somente na área Pedidos. O estado do preparo não altera o estado do pagamento.</p></P16Card>;
  }
  function InventoryView() {
    const resale=products.filter(p=>p.sellable&&p.kind==='resale'&&p.name.toLowerCase().includes(productSearch.toLowerCase()));
    const prepared=products.filter(p=>p.sellable&&p.kind==='prepared'&&p.name.toLowerCase().includes(productSearch.toLowerCase()));
    return <div className="p16-inventory-view">
      <P16Card><P16Title eyebrow="CATÁLOGO" title="Produtos e estoque" action={<P16Button onClick={()=>setProductForm(v=>!v)}><Plus size={15}/> Novo produto</P16Button>}/><label className="p16-search"><Search size={16}/><input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Buscar produto..."/></label>{productForm&&<form className="p16-form" onSubmit={addProduct}><div className="p16-form-grid"><P16Field label="Nome do item"><input name="name" minLength="2" required placeholder="Ex.: Refrigerante lata 350 ml"/></P16Field><P16Field label="Categoria"><input name="category" required defaultValue="Geral"/></P16Field><P16Field label="Tipo de item"><select name="kind" value={productKind} onChange={e=>setProductKind(e.target.value)}><option value="resale">Revenda — produto comprado pronto</option><option value="prepared">Preparado na hora</option></select></P16Field><P16Field label={productKind==='prepared'?'Custo estimado por unidade (R$)':'Custo de compra por unidade (R$)'}><input name="cost" type="number" min="0" step="0.01" required/></P16Field><P16Field label="Preço de venda (R$)"><input name="price" type="number" min="0.01" step="0.01" required/></P16Field>{productKind==='resale'&&<><P16Field label="Quantidade inicial"><input name="stock" type="number" min="0" step="0.001" required/></P16Field><P16Field label="Estoque mínimo"><input name="minimum" type="number" min="0" step="0.001" required/></P16Field></>}<P16Field label="Unidade"><select name="unit" defaultValue={productKind==='prepared'?'porcao':'un'}>{unitOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></P16Field></div><p className="p16-note">{productKind==='resale'?'Produto comprado pronto. A quantidade e o estoque mínimo são controlados.':'Preparado na hora. Informa custo estimado e preço de venda, sem estoque próprio de unidades ou ingredientes.'}</p><div className="p16-form-actions"><P16Button outline onClick={()=>setProductForm(false)}>Cancelar</P16Button><P16Button type="submit">Salvar item</P16Button></div></form>}
      <ProductGroup title="Produtos para revenda" description={stockGroups.resale.description} products={resale} onMove={beginStockMovement} onRemove={(p)=>setProducts(xs=>xs.map(x=>x.id===p.id?{...x,sellable:false,archived:true}:x))}/>
      <ProductGroup title="Preparados na hora" description={stockGroups.prepared.description} products={prepared} onMove={beginStockMovement} onRemove={(p)=>setProducts(xs=>xs.map(x=>x.id===p.id?{...x,sellable:false,archived:true}:x))}/>
      {selectedStockProduct&&<form className="p16-form p16-stock-form" onSubmit={saveStockMovement}><P16Title eyebrow="MOVIMENTAÇÃO" title={'Movimentar estoque: '+selectedStockProduct.name} action={<button className="p16-icon-button" type="button" onClick={()=>setStockProductId('')}><X size={15}/></button>}/><div className="p16-form-grid"><P16Field label="Tipo de movimento"><select value={stockType} onChange={e=>setStockType(e.target.value)}>{[['purchase','Entrada por compra'],['return','Devolução / retorno'],['adjustment_in','Ajuste de entrada'],['sale','Venda avulsa (fora de Pedidos)'],['adjustment_out','Ajuste de saída'],['waste','Perda / descarte']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></P16Field><P16Field label={'Quantidade ('+selectedStockProduct.unit+')'}><input type="number" min={['un','porcao'].includes(selectedStockProduct.unit)?1:.001} step={['un','porcao'].includes(selectedStockProduct.unit)?1:.001} value={stockQuantity} onChange={e=>setStockQuantity(e.target.value)} required/></P16Field><P16Field label="Data da movimentação"><input type="date" value={stockDate} onChange={e=>setStockDate(e.target.value)} required/></P16Field><P16Field label="Motivo / referência"><input minLength="5" maxLength="160" value={stockReason} onChange={e=>setStockReason(e.target.value)} placeholder="Ex.: compra fornecedor / perda / contagem física" required/></P16Field></div><p className="p16-note">Saldo atual: {productQuantity(selectedStockProduct,selectedStockProduct.stock)} {selectedStockProduct.unit}. Ajustes e saídas não podem deixar o estoque negativo. Venda avulsa não registra receita no caixa.</p><div className="p16-form-actions"><P16Button outline onClick={()=>setStockProductId('')}>Cancelar</P16Button><P16Button type="submit">Registrar movimento</P16Button></div></form>}
      </P16Card>
      <P16Card><P16Title eyebrow="HISTÓRICO DE ESTOQUE" title="Entradas, saídas e perdas" action={<P16Count>{filteredStock.length}</P16Count>}/><div className="p16-toolbar"><label className="p16-search"><Search size={15}/><input value={stockSearch} onChange={e=>setStockSearch(e.target.value)} placeholder="Buscar produto ou motivo..."/></label><select value={stockFilter} onChange={e=>setStockFilter(e.target.value)}><option value="all">Todas</option><option value="inbound">Entradas</option><option value="outbound">Saídas</option><option value="waste">Perdas</option></select></div><div className="p16-stock-history">{visibleMovements.map(movement=><article key={movement.id}><span className={movement.quantity>0?'in':'out'}><Package size={16}/></span><div><strong>{products.find(p=>p.id===movement.productId)?.name||'Produto fora do catálogo'}</strong><small>{stockTypes[movement.type]} · {movement.reason}</small><em>{dateText(movement.movementDate)} · Saldo: {productQuantity({unit:'un'},movement.before)} → {productQuantity({unit:'un'},movement.after)}</em></div><b className={movement.quantity>0?'positive':'negative'}>{movement.quantity>0?'+':'−'}{productQuantity({unit:'un'},Math.abs(movement.quantity))}</b></article>)}</div>{filteredStock.length>8&&<button className="p16-link-button" onClick={()=>setStockHistoryExpanded(v=>!v)}>{stockHistoryExpanded?'Mostrar menos':'Ver todos os resultados ('+filteredStock.length+')'} <ChevronDown size={14}/></button>}</P16Card>
    </div>;
  }
  function OrdersModule() {
    const sessionOrders=orders.filter(order=>order.sessionNumber===sessionNumber);
    const active=sessionOrders.filter(order=>['Recebido','Em preparo','Pronto'].includes(order.status));
    return <div className="p16-view">
      <div className="p16-page-heading"><div><span>OPERAÇÃO DO ESTABELECIMENTO</span><h2>Pedidos.</h2><p>Organize o preparo e acompanhe as retiradas durante o expediente. Os pedidos são lançados pela equipe, na área interna.</p></div>{sessionOpen?<P16Button outline onClick={closeSession}><StopCircle size={15}/> Encerrar atendimento</P16Button>:<P16Button onClick={startSession}><PlayCircle size={15}/> Iniciar atendimento</P16Button>}</div>
      <div className={'p16-session-banner '+(sessionOpen?'open':'closed')}><span>{sessionOpen?<CheckCircle2 size={18}/>:<ShieldCheck size={18}/>}</span><div><strong>{sessionOpen?'Atendimento aberto':'Atendimento encerrado'}</strong><small>{sessionOpen?'Iniciado às '+sessionStartedAt+' · '+dateText(todayKey(0)):'Novos pedidos e mudanças operacionais estão bloqueados até iniciar um novo atendimento.'}</small>{sessionOpen&&active.length>0&&<em>{active.length} pedido(s) ainda precisam ser entregues ou cancelados para permitir o encerramento.</em>}</div>{sessionOpen&&<div className="p16-next-order"><small>PRÓXIMO PEDIDO</small><strong>#{String(nextOrderNumber).padStart(3,'0')}</strong></div>}</div>
      <P16Card><P16Title eyebrow="ACOMPANHAMENTO" title="Fluxo de pedidos" action={<P16Count>{shownOrders.length}</P16Count>}/><div className="p16-orders-toolbar"><label className="p16-search"><Search size={16}/><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Buscar número, cliente ou produto..."/></label><div className="p16-orders-scope"><button className={orderScope==='session'?'active':''} onClick={()=>setOrderScope('session')}>Atendimento atual</button><button className={orderScope==='all'?'active':''} onClick={()=>setOrderScope('all')}>Histórico completo</button></div>{sessionOpen&&<P16Button onClick={openNewOrder}><Plus size={15}/> Novo pedido</P16Button>}</div>
      {orderForm&&<form className="p16-form p16-order-form" onSubmit={createOrder}><P16Title eyebrow="LANÇAMENTO INTERNO" title="Novo pedido" action={<button type="button" className="p16-icon-button" onClick={()=>setOrderForm(false)}><X size={16}/></button>}/><P16Field label="Cliente / origem"><input value={orderCustomer} onChange={e=>setOrderCustomer(e.target.value)} placeholder="Balcão"/></P16Field><p className="p16-note">Identifique o cliente ou a origem do pedido. Esta operação não utiliza cardápio público nem cadastro de mesas.</p><div className="p16-order-lines">{draftItems.map((row,index)=>{const product=products.find(p=>p.id===row.productId);return <div className="p16-order-line" key={row.id}><P16Field label={'Produto '+(index+1)}><select value={row.productId} onChange={e=>changeDraftLine(row.id,{productId:e.target.value})}><option value="">Selecione um produto</option>{products.filter(p=>p.sellable).map(p=><option key={p.id} value={p.id}>{p.name} · {cash(p.priceCents)}</option>)}</select></P16Field><P16Field label={'Quantidade '+(product?'('+product.unit+')':'')}><input type="number" min={product&&['un','porcao'].includes(product.unit)?1:.001} step={product&&['un','porcao'].includes(product.unit)?1:.001} value={row.quantity} onChange={e=>changeDraftLine(row.id,{quantity:e.target.value})}/></P16Field><button className="p16-icon-button danger" type="button" disabled={draftItems.length===1} onClick={()=>setDraftItems(rows=>rows.filter(item=>item.id!==row.id))}><Trash2 size={14}/></button><small>{product?'Estoque: '+(product.stockTracked?productQuantity(product,product.stock)+' '+product.unit:'Não se aplica — preparado na hora'):'Selecione um item para consultar o saldo.'}</small></div>;})}</div><P16Button outline onClick={()=>setDraftItems(rows=>[...rows,{id:Date.now(),productId:'',quantity:'1'}])}><Plus size={14}/> Adicionar produto</P16Button><div className="p16-order-total"><span>Total do pedido</span><strong>{cash(draftItems.reduce((sum,row)=>sum+(products.find(p=>p.id===row.productId)?.priceCents||0)*Number(row.quantity||0),0))}</strong></div><div className="p16-form-actions"><P16Button outline onClick={()=>setOrderForm(false)}>Cancelar</P16Button><P16Button type="submit">Registrar pedido</P16Button></div></form>}
      <div className="p16-order-list">{shownOrders.length?shownOrders.map(order=><OrderCard key={order.id} order={order}/>):<div className="p16-empty"><ClipboardList size={24}/><strong>Nenhum pedido encontrado</strong><p>Quando houver lançamentos, eles aparecerão aqui.</p></div>}</div>
      </P16Card>
      <OrderReport/>
      <p className="p16-note"><ShieldCheck size={14}/> Pedidos são lançados pela equipe. Não existe cardápio público, envio de pedido pelo cliente, mapa de mesas ou login específico para garçons nesta versão do P16.</p>
    </div>;
  }
  function OrderCard({order}) {
    const statusNext={Recebido:'Em preparo','Em preparo':'Pronto',Pronto:'Entregue'};
    return <article className="p16-order-card"><div className="p16-order-number"><small>PEDIDO</small><strong>#{String(order.number).padStart(3,'0')}</strong><span>{order.createdAt} · {dateText(order.businessDate)}</span></div><div className="p16-order-body"><div className="p16-order-head"><strong>{order.customer}</strong><span className={'p16-order-status '+order.status.toLowerCase().replace(' ','-')}>{order.status}</span></div><div className="p16-order-items">{order.items.map((line,index)=>{const product=products.find(p=>p.id===line.productId);return <span key={line.productId+'-'+index}>{productQuantity(product||{unit:'un'},line.quantity)}x {product?.name||'Produto'}</span>;})}</div><div className="p16-order-value"><strong>{cash(order.totalCents)}</strong><span className={order.paymentStatus==='paid'?'paid':'pending'}>{order.paymentStatus==='paid'?'Pago · '+order.paymentMethod:'Pagamento pendente'}</span></div><div className="p16-order-actions">{statusNext[order.status]&&<P16Button outline onClick={()=>moveOrderStatus(order,statusNext[order.status])}>{order.status==='Recebido'?'Iniciar preparo':order.status==='Em preparo'?'Marcar pronto':'Confirmar retirada'} <ArrowRight size={13}/></P16Button>}{order.paymentStatus!=='paid'&&order.status!=='Cancelado'&&<P16Button outline onClick={()=>openPayment(order)}><CreditCard size={14}/> Registrar pagamento</P16Button>}{order.paymentStatus!=='paid'&&['Entregue','Cancelado'].includes(order.status)===false&&<button className="p16-danger-link" onClick={()=>cancelOrder(order)}><X size={13}/> Cancelar pedido</button>}</div>{paymentOrderId===order.id&&<form className="p16-payment-form" onSubmit={(event)=>registerOrderPayment(event,order)}><strong>Pagamento do pedido #{String(order.number).padStart(3,'0')}</strong><div className="p16-form-grid"><P16Field label="Data do pagamento"><input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required/></P16Field><P16Field label="Forma de pagamento"><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{paymentOptions.map(x=><option key={x}>{x}</option>)}</select></P16Field></div><div className="p16-form-actions"><P16Button outline onClick={()=>setPaymentOrderId('')}>Cancelar</P16Button><P16Button type="submit"><Check size={14}/> Confirmar pagamento</P16Button></div></form>}</div></article>;
  }
  function OrderReport() {
    const items=reportList;
    const dayGroups=Object.values(items.reduce((acc,order)=>{const key=order.businessDate;acc[key]=acc[key]||{date:key,orders:0,cancelled:0,sold:0,pending:0};acc[key].orders+=1;if(order.status==='Cancelado')acc[key].cancelled+=1;else {acc[key].sold+=order.totalCents;if(order.paymentStatus!=='paid')acc[key].pending+=order.totalCents;}return acc;},{})).sort((a,b)=>a.date.localeCompare(b.date));
    return <P16Card><P16Title eyebrow="ACOMPANHAMENTO OPERACIONAL" title="Relatório de pedidos"/><p className="p16-note">Relatório separado do caixa. Considera a data em que cada pedido foi criado.</p><div className="p16-report-controls"><div className="p16-orders-scope"><button className={reportPeriod==='day'?'active':''} onClick={()=>setReportPeriod('day')}>Diário</button><button className={reportPeriod==='month'?'active':''} onClick={()=>setReportPeriod('month')}>Mensal</button></div><P16Field label={reportPeriod==='day'?'Dia dos pedidos':'Mês dos pedidos'}><input type={reportPeriod==='day'?'date':'month'} value={reportPeriod==='day'?reportDate:reportDate.slice(0,7)} onChange={e=>setReportDate(reportPeriod==='day'?e.target.value:e.target.value+'-15')}/></P16Field></div><div className="p16-report-metrics"><div><small>Pedidos registrados</small><strong>{items.length}</strong><span>{items.filter(x=>x.status==='Entregue').length} entregues · {items.filter(x=>x.status==='Cancelado').length} cancelados</span></div><div><small>Total vendido</small><strong>{cash(reportSold)}</strong><span>Pedidos não cancelados</span></div><div><small>Falta receber</small><strong>{cash(reportPending)}</strong><span>Pedidos ainda não pagos</span></div></div>{reportPeriod==='month'&&<div className="p16-report-days">{dayGroups.length?dayGroups.map(day=><article key={day.date}><strong>{dateText(day.date)}</strong><span>{day.orders} pedidos · {day.cancelled} cancelados</span><b>{cash(day.sold)}</b><small>Falta receber: {cash(day.pending)}</small></article>):<p>Nenhum pedido criado no mês selecionado.</p>}</div>}</P16Card>;
  }
}
function ProductGroup({title,description,products,onMove,onRemove}) {
  const [expanded,setExpanded]=useState(false);
  return <section className="p16-product-group"><button className="p16-product-group-heading" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}><span><strong>{title}</strong><small>{description}</small></span><em>{products.length} itens</em><ChevronDown size={16}/></button>{expanded&&<div className="p16-products-table">{products.length?products.map(product=><article key={product.id}><div><strong>{product.name}</strong><small>{product.category} · {product.kind==='prepared'?'Preparado na hora':'Revenda'}</small></div><div><small>Custo</small><strong>{cash(product.costCents)}</strong></div><div><small>Venda</small><strong>{cash(product.priceCents)}</strong></div><div><small>Margem estimada</small><strong className={product.priceCents>=product.costCents?'positive':'negative'}>{cash(product.priceCents-product.costCents)}</strong></div><div><small>Estoque</small><strong>{product.stockTracked?productQuantity(product,product.stock)+' '+product.unit:'Sem estoque próprio'}</strong></div><div><small>Status</small><em>{product.kind==='prepared'?'Feito na hora':product.stock<=product.minimum?'Repor estoque':'Disponível'}</em></div><div className="p16-product-actions">{product.stockTracked&&<button onClick={()=>onMove(product)}><Package size={13}/> Movimentar</button>}<button className="danger" onClick={()=>onRemove(product)}><Trash2 size={13}/> Arquivar</button></div></article>):<p className="p16-empty">Nenhum produto nesta categoria.</p>}</div>}</section>;
}
function Metric({label,value,detail,tone}) { return <article className={'p16-metric '+tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function MovementList({items}) { return <div className="p16-movement-list">{items.length?items.map(item=><article key={item.id}><span className={item.direction==='income'?'income':'expense'}>{item.direction==='income'?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</span><div><strong>{item.description}</strong><small>{item.category} · {dateText(item.movementDate)} · {item.paymentMethod}</small></div><b className={item.direction}>{item.direction==='income'?'+':'−'} {cash(item.amountCents)}</b></article>):<p className="p16-empty">Nenhuma movimentação neste período.</p>}</div>; }
function CategoryRows({rows}) { const total=rows.reduce((sum,item)=>sum+item.amount,0);return <div className="p16-category-list">{rows.length?rows.map(row=><div key={row.label}><span><strong>{row.label}</strong><small>{total?Math.round(row.amount/total*100):0}% · {cash(row.amount)}</small></span><i><b style={{width:(total?row.amount/total*100:0)+'%'}}/></i></div>):<p className="p16-empty">Sem movimentações cadastradas.</p>}</div>; }
