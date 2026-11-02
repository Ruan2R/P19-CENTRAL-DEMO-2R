import { useMemo, useState } from 'react';
import {
  BadgeCheck, CheckCircle2, CreditCard, ClipboardList, PlayCircle, Plus, Search, StopCircle, X
} from 'lucide-react';

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Não informado'];
const STATUS_FLOW = ['Recebido', 'Em preparo', 'Pronto', 'Entregue'];
function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function quantityText(value, unit) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: ['kg', 'g', 'l', 'ml'].includes(unit) ? 3 : 0 }) + ' ' + unit;
}

export default function BurgerOrdersModule({
  attendanceOpen, setAttendanceOpen, currentSessionId, setCurrentSessionId,
  attendanceOrders, setAttendanceOrders, orders, setOrders,
  products, setProducts, setStockMovements, setTransactions,
  setReceivables, notify
}) {
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState('Balcão');
  const [quantities, setQuantities] = useState({});
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');
  const [paymentOrderId, setPaymentOrderId] = useState(null);
  const [paymentDate, setPaymentDate] = useState(localDate());
  const [paymentMethod, setPaymentMethod] = useState('Pix');

  const catalog = products.filter(item => item.active !== false && item.sellable !== false);
  const selected = catalog.filter(item => Number(quantities[item.id] || 0) > 0);
  const total = selected.reduce((sum, item) => sum + Number(item.price) * Number(quantities[item.id]), 0);
  const activeOrders = attendanceOrders.filter(order => !['Entregue', 'Cancelado'].includes(order.status));
  const unpaidOrders = attendanceOrders.filter(order => order.payment === 'Pendente' && order.status !== 'Cancelado');
  const nextCode = String(attendanceOrders.length + 1).padStart(3, '0');
  const displayedOrders = scope === 'session' ? attendanceOrders : orders;
  const filtered = useMemo(() => displayedOrders.filter(order => {
    const text = [order.code, order.customer, order.items, order.status, order.payment].join(' ').toLocaleLowerCase('pt-BR');
    return (filter === 'Todos' || order.status === filter) && text.includes(search.toLocaleLowerCase('pt-BR'));
  }), [displayedOrders, filter, search]);
  const currentTotal = attendanceOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  function resetDraft() {
    setCustomer('Balcão');
    setQuantities({});
    setShowForm(false);
  }
  function changeQuantity(product, delta) {
    const current = Number(quantities[product.id] || 0);
    const next = Math.max(0, current + delta);
    setQuantities(previous => ({ ...previous, [product.id]: next }));
  }
  function startSession() {
    if (attendanceOpen) return notify('Já existe um atendimento aberto nesta demonstração.');
    const sessionId = Date.now();
    setCurrentSessionId(sessionId);
    setAttendanceOrders([]);
    setAttendanceOpen(true);
    setScope('session');
    notify('Atendimento iniciado. A numeração dos pedidos começou em 001.');
  }
  function closeSession() {
    if (!attendanceOpen) return;
    if (activeOrders.length) return notify('Finalize ou cancele todos os pedidos em andamento antes de encerrar.');
    const stillUnpaid = attendanceOrders.filter(order => order.payment === 'Pendente' && order.status === 'Entregue').length;
    if (!window.confirm('Deseja encerrar o atendimento?' + (stillUnpaid ? '\n' + stillUnpaid + ' pedido(s) entregue(s) ainda não recebido(s) continuarão em Valores a receber.' : ''))) return;
    setAttendanceOpen(false);
    setShowForm(false);
    setScope('session');
    notify('Atendimento encerrado. Pedidos entregues sem pagamento permanecem em Valores a receber.');
  }
  function createOrder(event) {
    event.preventDefault();
    if (!attendanceOpen) return notify('Inicie o atendimento antes de lançar pedidos.');
    if (!selected.length) return notify('Adicione pelo menos um produto ao pedido.');
    for (const item of selected) {
      const amount = Number(quantities[item.id]);
      if (!Number.isFinite(amount) || amount <= 0) return notify('Confira a quantidade de cada produto.');
      if (['un', 'porcao'].includes(item.unit) && !Number.isInteger(amount)) return notify(item.name + ': informe uma quantidade inteira.');
      if (item.stockTracked && Number(item.stock) < amount) return notify('Estoque insuficiente para ' + item.name + '.');
    }

    const id = Date.now();
    const code = nextCode;
    const orderItems = selected.map(item => ({
      productId: item.id, name: item.name, quantity: Number(quantities[item.id]),
      unit: item.unit, unitPrice: Number(item.price), stockTracked: Boolean(item.stockTracked)
    }));
    const order = {
      id, code, sessionId: currentSessionId, customer: customer.trim() || 'Balcão',
      productItems: orderItems,
      items: orderItems.map(item => Number(item.quantity).toLocaleString('pt-BR') + 'x ' + item.name).join(', '),
      total: Math.round(total * 100) / 100, status: 'Recebido', payment: 'Pendente',
      paymentMethod: null, paymentDate: null, date: localDate()
    };

    const decrements = orderItems.filter(item => item.stockTracked);
    setProducts(previous => previous.map(product => {
      const used = decrements.filter(item => String(item.productId) === String(product.id)).reduce((sum, item) => sum + item.quantity, 0);
      return used ? { ...product, stock: Number((Number(product.stock) - used).toFixed(3)) } : product;
    }));
    setStockMovements(previous => [
      ...decrements.map(item => {
        const product = products.find(candidate => String(candidate.id) === String(item.productId));
        const before = Number(product?.stock || 0);
        return {
          id: String(id) + '-' + item.productId, productId: item.productId, productName: item.name,
          type: 'order_consumption', quantity: item.quantity, unit: item.unit, date: localDate(),
          reason: 'Baixa automática do pedido #' + code, before, after: Number((before - item.quantity).toFixed(3))
        };
      }),
      ...previous
    ]);
    setAttendanceOrders(previous => [...previous, order]);
    setOrders(previous => [...previous, order]);
    setReceivables(previous => [{
      id: 'order-' + id, orderId: id, orderNumber: code, client: order.customer,
      service: 'Pedido #' + code, date: order.date, total: order.total,
      received: 0, balance: order.total, status: 'Pendente', cancelled: false
    }, ...previous]);
    resetDraft();
    notify('Pedido #' + code + ' registrado. Itens de revenda tiveram baixa automática; o pagamento ficou pendente.');
  }
  function updateOrder(id, status) {
    const current = attendanceOrders.find(order => order.id === id) || orders.find(order => order.id === id);
    if (!current) return;
    const allowed = {
      Recebido: ['Em preparo', 'Cancelado'],
      'Em preparo': ['Pronto', 'Cancelado'],
      Pronto: ['Entregue', 'Cancelado'],
      Entregue: [],
      Cancelado: []
    };
    if (!allowed[current.status]?.includes(status)) return notify('Esta mudança de etapa não está disponível.');
    if (status === 'Cancelado') {
      if (current.payment === 'Recebido') return notify('Pedidos pagos não podem ser cancelados sem um fluxo de estorno.');
      const returns = (current.productItems || []).filter(item => item.stockTracked);
      setProducts(previous => previous.map(product => {
        const returned = returns.filter(item => String(item.productId) === String(product.id)).reduce((sum, item) => sum + item.quantity, 0);
        return returned ? { ...product, stock: Number((Number(product.stock) + returned).toFixed(3)) } : product;
      }));
      setStockMovements(previous => [
        ...returns.map(item => {
          const product = products.find(candidate => String(candidate.id) === String(item.productId));
          const before = Number(product?.stock || 0);
          return {
            id: String(current.id) + '-return-' + item.productId, productId: item.productId, productName: item.name,
            type: 'order_return', quantity: item.quantity, unit: item.unit, date: localDate(),
            reason: 'Devolução automática do pedido #' + current.code + ' cancelado',
            before, after: Number((before + item.quantity).toFixed(3))
          };
        }),
        ...previous
      ]);
      setReceivables(previous => previous.map(item => item.orderId === id
        ? { ...item, cancelled: true, status: 'Cancelado', balance: 0 } : item));
    }
    const updated = { ...current, status };
    setAttendanceOrders(previous => previous.map(order => order.id === id ? updated : order));
    setOrders(previous => previous.map(order => order.id === id ? updated : order));
    notify(status === 'Cancelado' ? 'Pedido #' + current.code + ' cancelado. O estoque reservado foi devolvido.' : 'Pedido #' + current.code + ' atualizado para ' + status.toLocaleLowerCase('pt-BR') + '.');
  }
  function registerPayment(order) {
    if (order.payment === 'Recebido') return notify('Este pedido já está recebido; nenhuma entrada duplicada foi criada.');
    if (order.status === 'Cancelado') return notify('Pedidos cancelados não podem ser recebidos.');
    if (!paymentDate) return notify('Informe a data do recebimento.');
    const updated = { ...order, payment: 'Recebido', paymentMethod, paymentDate };
    setAttendanceOrders(previous => previous.map(item => item.id === order.id ? updated : item));
    setOrders(previous => previous.map(item => item.id === order.id ? updated : item));
    setTransactions(previous => previous.some(item => item.id === 'order-payment-' + order.id) ? previous : [{
      id: 'order-payment-' + order.id, description: 'Pedido #' + order.code + ' · ' + order.customer,
      category: 'Receita', detailCategory: 'Vendas de pedidos', date: paymentDate,
      value: Number(order.total), paymentMethod, source: 'Pedido', sourceId: order.id
    }, ...previous]);
    setReceivables(previous => previous.map(item => item.orderId === order.id
      ? { ...item, received: Number(order.total), balance: 0, status: 'Recebido', paymentMethod, receivedDate: paymentDate } : item));
    setPaymentOrderId(null);
    notify('Recebimento do pedido #' + order.code + ' registrado no Financeiro.');
  }

  const ordersToShow = filtered.slice().sort((a, b) => Number(a.code) - Number(b.code));
  return <div className="burger-operations">
    <section className="panel attendance-control-card">
      <div><span className="public-kicker">OPERAÇÃO · P16</span><h2>{attendanceOpen ? 'Atendimento em andamento' : 'Atendimento encerrado'}</h2>
      <p>{attendanceOpen ? 'Pedidos são lançados e acompanhados dentro deste atendimento.' : 'Inicie um atendimento para liberar novos lançamentos. O histórico continua disponível.'}</p></div>
      {attendanceOpen ? <button className="secondary-button" onClick={closeSession}><StopCircle size={16}/> Encerrar atendimento</button> : <button className="primary-button" onClick={startSession}><PlayCircle size={16}/> Iniciar atendimento</button>}
      {attendanceOpen && <div className="attendance-open-meta"><span><strong>{attendanceOrders.length}</strong> pedidos no atendimento</span><span><strong>{activeOrders.length}</strong> em andamento</span><span><strong>{unpaidOrders.length}</strong> sem recebimento</span><span>Próximo pedido <strong>#{nextCode}</strong></span></div>}
    </section>
    <div className="orders-intro"><div className="orders-intro-icon"><ClipboardList size={20}/></div><div><strong>Pedidos internos</strong><p>A equipe lança os pedidos por aqui. O cliente não envia pedidos por um cardápio público nesta modalidade.</p></div><span className="sample-tag"><BadgeCheck size={14}/> EXEMPLO</span></div>
    <div className="burger-orders-toolbar">
      <div className="burger-order-scope"><button type="button" className={scope === 'session' ? 'active' : ''} onClick={() => setScope('session')}>{attendanceOpen ? 'Atendimento atual' : 'Último atendimento'}</button><button type="button" className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Todo o histórico</button></div>
      {attendanceOpen && <button className="primary-button" type="button" onClick={() => { setCustomer('Balcão'); setQuantities({}); setShowForm(value => !value); }}><Plus size={16}/>{showForm ? 'Fechar pedido' : 'Lançar pedido'}</button>}
    </div>
    {showForm && attendanceOpen && <section className="panel new-internal-order">
      <div className="panel-heading"><div><h3>Novo pedido interno</h3><p>Selecione os produtos e quantidades. Itens de revenda reduzem o estoque ao registrar.</p></div><strong className="order-code">#{nextCode}</strong></div>
      <form onSubmit={createOrder}>
        <label>Cliente / identificação<input value={customer} onChange={event => setCustomer(event.target.value)} placeholder="Ex.: Balcão, mesa 03 ou delivery"/></label>
        <div className="internal-order-product-grid">{catalog.map(item => {
          const tracked = item.stockTracked;
          const qty = Number(quantities[item.id] || 0);
          const unavailable = tracked && Number(item.stock) <= 0;
          return <article className="internal-order-product" key={item.id}>
            <div><strong>{item.name}</strong><small>{money(item.price)} · {item.kind === 'prepared' ? 'Preparado na hora' : quantityText(item.stock, item.unit) + ' disponíveis'}</small></div>
            <div className="menu-quantity"><button type="button" disabled={!qty} onClick={() => changeQuantity(item, -1)}>−</button><span>{qty}</span><button type="button" disabled={unavailable} onClick={() => changeQuantity(item, 1)}>+</button></div>
          </article>;
        })}</div>
        <div className="internal-order-footer"><span>Total do pedido<strong>{money(total)}</strong></span><button className="primary-button" type="submit" disabled={!selected.length}>Registrar pedido #{nextCode}</button></div>
      </form>
    </section>}
    <div className="order-summary-grid"><div><span>Pedidos nesta sessão</span><strong>{attendanceOrders.length.toString().padStart(2, '0')}</strong></div><div><span>Em andamento</span><strong>{activeOrders.length.toString().padStart(2, '0')}</strong></div><div><span>Sem recebimento</span><strong>{unpaidOrders.length.toString().padStart(2, '0')}</strong></div><div><span>Total registrado</span><strong>{money(currentTotal)}</strong></div></div>
    <section className="panel table-panel burger-orders-list">
      <div className="panel-heading"><div><h3>{scope === 'all' ? 'Histórico de pedidos' : attendanceOpen ? 'Pedidos do atendimento atual' : 'Pedidos do último atendimento'}</h3><p>O recebimento é confirmado separadamente da entrega. Pedidos cancelados não contam como venda.</p></div><span className="count-chip">{ordersToShow.length}</span></div>
      <div className="burger-orders-filters"><label><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar número ou cliente..."/></label><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todos</option><option>Recebido</option><option>Em preparo</option><option>Pronto</option><option>Entregue</option><option>Cancelado</option></select></div>
      {ordersToShow.length ? <div className="burger-order-cards">{ordersToShow.map(order => <article className="burger-order-card" key={order.id}>
        <div className="burger-order-card-heading"><span className="order-code">#{order.code}</span><span className="burger-order-date">{order.date || 'Data não informada'}</span><span className={'status-badge ' + (order.status === 'Entregue' ? 'status-green' : order.status === 'Cancelado' ? 'status-red' : 'status-amber')}>{order.status}</span></div>
        <div className="burger-order-customer"><strong>{order.customer}</strong><span>{order.items}</span></div>
        <div className="burger-order-values"><div><span>Total</span><strong>{money(order.total)}</strong></div><div><span>Pagamento</span><strong className={order.payment === 'Recebido' ? 'positive' : 'negative'}>{order.payment === 'Recebido' ? 'Recebido · ' + (order.paymentMethod || 'forma não informada') : order.status === 'Cancelado' ? 'Cancelado' : 'Pendente'}</strong></div></div>
        {order.status !== 'Entregue' && order.status !== 'Cancelado' && <div className="burger-order-actions">
          {STATUS_FLOW.indexOf(order.status) < STATUS_FLOW.length - 1 && <button type="button" className="small-outline" onClick={() => updateOrder(order.id, STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1])}>{order.status === 'Recebido' ? 'Iniciar preparo' : order.status === 'Em preparo' ? 'Marcar pronto' : 'Registrar entrega'}</button>}
          {order.payment !== 'Recebido' && <button type="button" className="small-outline danger" onClick={() => updateOrder(order.id, 'Cancelado')}><X size={13}/> Cancelar</button>}
        </div>}
        {order.payment === 'Pendente' && order.status !== 'Cancelado' && <div className="burger-payment-section">
          {paymentOrderId === order.id ? <form onSubmit={event => { event.preventDefault(); registerPayment(order); }}>
            <div className="burger-payment-form-heading"><strong>Registrar recebimento</strong><span>{money(order.total)}</span></div>
            <label>Data do recebimento<input type="date" value={paymentDate} onChange={event => setPaymentDate(event.target.value)} required/></label>
            <label>Forma de pagamento<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>{PAYMENT_METHODS.map(value => <option key={value}>{value}</option>)}</select></label>
            <div><button className="secondary-button" type="button" onClick={() => setPaymentOrderId(null)}>Cancelar</button><button className="primary-button" type="submit"><CheckCircle2 size={15}/> Confirmar recebimento</button></div>
          </form> : <button type="button" className="burger-register-payment" onClick={() => { setPaymentOrderId(order.id); setPaymentDate(localDate()); setPaymentMethod('Pix'); }}><CreditCard size={15}/> Registrar pagamento</button>}
        </div>}
      </article>)}</div> : <div className="empty-table"><ClipboardList size={25}/><strong>Nenhum pedido encontrado</strong><span>{scope === 'session' && attendanceOpen ? 'Registre o primeiro pedido deste atendimento.' : 'Inicie um novo atendimento ou consulte todo o histórico.'}</span>{scope === 'session' && attendanceOpen && <button className="secondary-button" type="button" onClick={() => setShowForm(true)}><Plus size={15}/> Criar primeiro pedido</button>}</div>}
      <div className="table-foot"><span>Dados fictícios · pedidos, recebimentos e estoque ficam somente nesta demonstração.</span></div>
    </section>
  </div>;
}
