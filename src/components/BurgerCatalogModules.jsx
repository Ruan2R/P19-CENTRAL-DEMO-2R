import { useMemo, useState } from 'react';
import { Boxes, CheckCircle2, ChevronDown, Package, Plus, RefreshCw, Search, TrendingDown, TrendingUp } from 'lucide-react';

const UNIT_LABELS = { un: 'un.', kg: 'kg', g: 'g', l: 'L', ml: 'ml', porcao: 'porção' };
const MOVEMENT_LABELS = {
  initial: 'Estoque inicial', purchase: 'Entrada por compra', return: 'Devolução / retorno',
  adjustment_in: 'Ajuste positivo', sale: 'Venda avulsa', order_consumption: 'Baixa por pedido',
  order_return: 'Devolução de pedido cancelado', adjustment_out: 'Ajuste negativo', waste: 'Perda / descarte'
};
const INBOUND = new Set(['purchase', 'return', 'adjustment_in']);
const OUTBOUND = new Set(['sale', 'order_consumption', 'adjustment_out', 'waste']);
function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function quantity(value, unit) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: ['kg', 'g', 'l', 'ml'].includes(unit) ? 3 : 0 });
}
function wholeUnit(unit) { return ['un', 'porcao'].includes(unit); }
function movementDateIso(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value;
  if (value === 'Ontem') {
    const date = new Date(localDate() + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  return localDate();
}

function BurgerProductGroup({ title, description, items }) {
    const [expanded, setExpanded] = useState(true);
    return <section className="burger-product-group">
      <div className="burger-product-group-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}><span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span><ChevronDown size={17}/></button>
      </div>
      {expanded && (items.length ? <div className="burger-product-grid">{items.map(item => {
        const margin = Number(item.price) - Number(item.cost);
        const low = item.stockTracked && Number(item.stock) <= Number(item.minimum);
        return <article className="burger-product-card" key={item.id}>
          <div className="burger-product-card-top"><span className="burger-product-icon"><Package size={17}/></span><span className={'burger-product-type ' + item.kind}>{item.kind === 'prepared' ? 'Preparado na hora' : 'Revenda'}</span></div>
          <h4>{item.name}</h4><p>{item.category}</p>
          <div className="burger-product-prices">
            <div><span>{item.kind === 'prepared' ? 'Custo estimado' : 'Custo de compra'}</span><strong>{money(item.cost)}</strong></div>
            <div><span>Preço de venda</span><strong>{money(item.price)}</strong></div>
          </div>
          <div className="burger-product-margin"><span>Margem estimada por item</span><strong className={margin >= 0 ? 'positive' : 'negative'}>{money(margin)}</strong></div>
          <div className="burger-product-stock"><span>{item.stockTracked ? 'Estoque atual' : 'Controle de estoque'}</span><strong>{item.stockTracked ? quantity(item.stock, item.unit) + ' ' + (UNIT_LABELS[item.unit] || item.unit) + ' · mínimo ' + quantity(item.minimum, item.unit) : 'Não se aplica — preparado sob pedido'}</strong></div>
          {item.stockTracked && <span className={'burger-stock-status ' + (low ? 'low' : 'ok')}>{low ? 'Atenção: repor estoque' : 'Estoque disponível'}</span>}
          <button className="burger-product-archive" type="button" onClick={() => archiveProduct(item)}>Remover do catálogo</button>
        </article>;
      })}</div> : <div className="burger-product-empty">Nenhum item cadastrado nesta categoria.</div>)}
    </section>;
}

export function BurgerProductsModule({ products, setProducts, setStockMovements, orders = [], notify }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hambúrgueres');
  const [kind, setKind] = useState('prepared');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minimum, setMinimum] = useState('0');
  const [unit, setUnit] = useState('porcao');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => products.filter(item => item.active !== false && [item.name, item.category, item.kind].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [products, search]);
  const resale = visible.filter(item => item.kind === 'resale');
  const prepared = visible.filter(item => item.kind === 'prepared');
  const tracked = products.filter(item => item.active !== false && item.stockTracked);
  const pendingReplenishment = tracked.filter(item => Number(item.stock) <= Number(item.minimum)).length;

  function closeForm() {
    setShowForm(false); setName(''); setCost(''); setPrice(''); setStock(''); setMinimum('0');
  }
  function addProduct(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const numericCost = Number(String(cost).replace(',', '.'));
    const numericPrice = Number(String(price).replace(',', '.'));
    const numericStock = Number(String(stock).replace(',', '.'));
    const numericMinimum = Number(String(minimum).replace(',', '.'));
    if (products.some(item => item.active !== false && item.name.trim().toLocaleLowerCase('pt-BR') === cleanName.toLocaleLowerCase('pt-BR'))) {
      notify('Já existe um produto com esse nome no catálogo.');
      return;
    }
    if (cleanName.length < 2 || !category.trim() || !Number.isFinite(numericCost) || numericCost < 0 || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      notify('Confira nome, categoria, custo e preço de venda.');
      return;
    }
    if (kind === 'resale' && (!Number.isFinite(numericStock) || numericStock < 0 || !Number.isFinite(numericMinimum) || numericMinimum < 0)) {
      notify('Informe uma quantidade inicial e um estoque mínimo válidos.');
      return;
    }
    if (kind === 'resale' && wholeUnit(unit) && (!Number.isInteger(numericStock) || !Number.isInteger(numericMinimum))) {
      notify('Produtos por unidade ou por porção precisam de quantidades inteiras.');
      return;
    }
    const id = Date.now();
    setProducts(previous => [...previous, {
      id, name: cleanName, category: category.trim(), kind, sellable: true,
      stockTracked: kind === 'resale', cost: Math.round(numericCost * 100) / 100,
      price: Math.round(numericPrice * 100) / 100,
      stock: kind === 'resale' ? numericStock : null,
      minimum: kind === 'resale' ? numericMinimum : 0,
      unit
    }]);
    if (kind === 'resale' && setStockMovements) {
      setStockMovements(previous => [{
        id: 'initial-' + id, productId: id, productName: cleanName, type: 'initial',
        quantity: numericStock, unit, date: localDate(), reason: 'Saldo informado no cadastro inicial',
        before: 0, after: numericStock
      }, ...previous]);
    }
    closeForm();
    notify(kind === 'prepared' ? 'Produto preparado cadastrado sem estoque próprio.' : 'Produto de revenda cadastrado com estoque inicial.');
  }
  function archiveProduct(item) {
    const linked = orders.some(order => (order.productItems || []).some(line => String(line.productId) === String(item.id)));
    if (linked) {
      notify('Este item aparece no histórico de pedidos e será mantido para preservar os registros.');
      return;
    }
    setProducts(previous => previous.map(product => product.id === item.id ? { ...product, active: false } : product));
    notify('Produto removido do catálogo ativo. O histórico de estoque foi preservado.');
  }

  return <div className="burger-catalog-module">
    <div className="burger-catalog-intro"><span className="burger-catalog-icon"><Package size={20}/></span><div><strong>Produtos e formação de preço</strong><p>Cadastre itens de revenda ou produtos preparados na hora. O custo estimado ajuda a visualizar a margem por unidade.</p></div></div>
    <div className="burger-catalog-metrics">
      <article><span>Produtos ativos</span><strong>{products.filter(item => item.active !== false).length.toString().padStart(2, '0')}</strong><small>Itens no catálogo</small></article>
      <article><span>Revenda com estoque</span><strong>{tracked.length.toString().padStart(2, '0')}</strong><small>Quantidade controlada</small></article>
      <article><span>Preparados na hora</span><strong>{products.filter(item => item.active !== false && item.kind === 'prepared').length.toString().padStart(2, '0')}</strong><small>Sem estoque do produto final</small></article>
      <article className={pendingReplenishment ? 'attention' : ''}><span>Precisam de reposição</span><strong>{pendingReplenishment.toString().padStart(2, '0')}</strong><small>Igual ou abaixo do mínimo</small></article>
    </div>
    <section className="panel burger-catalog-panel">
      <div className="panel-heading burger-catalog-heading"><div><span className="eyebrow muted-eyebrow">CATÁLOGO INTERNO</span><h3>Produtos cadastrados</h3><p>Os produtos de revenda mantêm saldo. Preparados na hora usam custo estimado, sem quantidade própria.</p></div><button className="primary-button" type="button" onClick={() => setShowForm(value => !value)}><Plus size={16}/>{showForm ? 'Fechar cadastro' : 'Novo produto'}</button></div>
      {showForm && <form className="burger-product-form" onSubmit={addProduct}>
        <label>Nome do item<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} placeholder="Ex.: Refrigerante lata 350 ml" required/></label>
        <label>Categoria<input value={category} onChange={event => setCategory(event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Bebidas, hambúrgueres" required/></label>
        <label>Tipo de item<select value={kind} onChange={event => { setKind(event.target.value); setUnit(event.target.value === 'prepared' ? 'porcao' : 'un'); }}><option value="resale">Revenda — comprado pronto</option><option value="prepared">Preparado na hora</option></select></label>
        <label>{kind === 'prepared' ? 'Custo estimado por unidade (R$)' : 'Custo de compra por unidade (R$)'}<input type="number" min="0" step="0.01" value={cost} onChange={event => setCost(event.target.value)} placeholder="0,00" required/></label>
        <label>Preço de venda (R$)<input type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0,00" required/></label>
        {kind === 'resale' && <>
          <label>Quantidade inicial<input type="number" min="0" step={wholeUnit(unit) ? '1' : '0.001'} value={stock} onChange={event => setStock(event.target.value)} placeholder="0" required/></label>
          <label>Estoque mínimo<input type="number" min="0" step={wholeUnit(unit) ? '1' : '0.001'} value={minimum} onChange={event => setMinimum(event.target.value)} placeholder="0" required/></label>
        </>}
        <label>Unidade<select value={unit} onChange={event => setUnit(event.target.value)}><option value="un">Unidade</option><option value="kg">Quilograma (kg)</option><option value="g">Grama (g)</option><option value="l">Litro (L)</option><option value="ml">Mililitro (ml)</option><option value="porcao">Porção</option></select></label>
        <div className="burger-product-form-note"><CheckCircle2 size={16}/><span>{kind === 'resale' ? 'Produtos comprados prontos são controlados por quantidade. A baixa acontece em pedidos e vendas avulsas.' : 'Produtos preparados na hora não mantêm saldo do produto final. O custo informado é uma estimativa para comparar com o preço de venda.'}</span></div>
        <div className="burger-product-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button type="submit" className="primary-button">Salvar produto</button></div>
      </form>}
      <label className="burger-product-search"><Search size={16}/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto ou categoria..."/></label>
      <BurgerProductGroup key="resale" title="Produtos de revenda" description="Itens comprados prontos e vendidos como estão, com estoque mínimo." items={resale}/>
      <BurgerProductGroup key="prepared" title="Preparados na hora" description="Lanches, porções e combos. O estoque do produto final não é controlado." items={prepared}/>
      <p className="burger-catalog-note">Dados fictícios · alterações ficam apenas nesta demonstração e reiniciam ao recarregar.</p>
    </section>
  </div>;
}

export function BurgerInventoryModule({ products, setProducts, stockMovements, setStockMovements, notify, resetInventory }) {
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState('purchase');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementDate, setMovementDate] = useState(localDate());
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const trackedProducts = products.filter(item => item.active !== false && item.stockTracked);
  const selected = trackedProducts.find(item => String(item.id) === String(productId));
  const numericQuantity = Number(String(movementQuantity).replace(',', '.'));
  const inbound = INBOUND.has(movementType);
  const outbound = OUTBOUND.has(movementType);
  const invalidWhole = Boolean(selected && wholeUnit(selected.unit) && !Number.isInteger(numericQuantity));
  const insufficient = Boolean(selected && outbound && Number.isFinite(numericQuantity) && numericQuantity > Number(selected.stock));
  const projected = selected && Number.isFinite(numericQuantity) && numericQuantity > 0 ? Number(selected.stock) + (inbound ? numericQuantity : -numericQuantity) : null;

  function addStockMovement(event) {
    event.preventDefault();
    if (!selected) return notify('Selecione um produto com estoque controlado.');
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return notify('Informe uma quantidade válida.');
    if (invalidWhole) return notify('Este produto exige uma quantidade inteira.');
    if (insufficient) return notify('A saída é maior que o estoque disponível.');
    if (reason.trim().length < 5) return notify('Descreva o motivo com pelo menos 5 caracteres.');
    if (!movementDate) return notify('Informe a data da movimentação.');
    const before = Number(selected.stock);
    const after = Number(projected.toFixed(3));
    setProducts(previous => previous.map(item => item.id === selected.id ? { ...item, stock: after } : item));
    setStockMovements(previous => [{
      id: Date.now(), productId: selected.id, productName: selected.name, type: movementType,
      quantity: numericQuantity, unit: selected.unit, date: movementDate, reason: reason.trim(),
      before, after
    }, ...previous]);
    setMovementQuantity('');
    setReason('');
    notify('Movimentação registrada no histórico demonstrativo.');
  }

  const filteredHistory = useMemo(() => stockMovements.filter(item => {
    const text = [item.productName, item.reason, MOVEMENT_LABELS[item.type]].join(' ').toLocaleLowerCase('pt-BR');
    const byText = text.includes(search.toLocaleLowerCase('pt-BR'));
    const byType = historyFilter === 'all' || (historyFilter === 'inbound' ? INBOUND.has(item.type) || item.type === 'initial' : historyFilter === 'outbound' ? OUTBOUND.has(item.type) : item.type === 'waste');
    return byText && byType;
  }).slice().sort((a, b) => movementDateIso(b.date).localeCompare(movementDateIso(a.date))), [stockMovements, search, historyFilter]);

  return <div className="burger-inventory-module">
    <div className="burger-catalog-intro"><span className="burger-catalog-icon"><Boxes size={20}/></span><div><strong>Controle de estoque</strong><p>Acompanhe o saldo de produtos de revenda, registre entradas, saídas, perdas e confira o histórico de cada movimentação.</p></div></div>
    <div className="burger-inventory-metrics">
      <article><span>Itens controlados</span><strong>{trackedProducts.length.toString().padStart(2, '0')}</strong><small>Produtos com saldo</small></article>
      <article><span>Produtos com saldo</span><strong>{trackedProducts.filter(item => Number(item.stock) > 0).length.toString().padStart(2, '0')}</strong><small>Itens com quantidade positiva</small></article>
      <article className="attention"><span>Precisam de reposição</span><strong>{trackedProducts.filter(item => Number(item.stock) <= Number(item.minimum)).length.toString().padStart(2, '0')}</strong><small>No mínimo ou abaixo</small></article>
    </div>
    <section className="panel burger-inventory-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">POSIÇÃO ATUAL</span><h3>Produtos com estoque</h3><p>Os pedidos baixam automaticamente os produtos controlados; itens preparados na hora não mantêm saldo próprio.</p></div><button className="secondary-button" type="button" onClick={resetInventory}><RefreshCw size={15}/> Restaurar dados do Burger</button></div>
      {trackedProducts.length ? <div className="burger-stock-list">{trackedProducts.map(item => {
        const low = Number(item.stock) <= Number(item.minimum);
        return <article key={item.id} className="burger-stock-row"><span className="burger-stock-product-icon"><Package size={17}/></span><div><strong>{item.name}</strong><small>{item.category} · Mínimo {quantity(item.minimum, item.unit)} {UNIT_LABELS[item.unit] || item.unit}</small></div><strong className={low ? 'low' : ''}>{quantity(item.stock, item.unit)} {UNIT_LABELS[item.unit] || item.unit}</strong><span className={'burger-stock-status ' + (low ? 'low' : 'ok')}>{low ? 'Repor' : 'Disponível'}</span></article>;
      })}</div> : <div className="burger-product-empty">Nenhum produto de revenda com estoque controlado. Cadastre um produto na aba Produtos.</div>}
    </section>
    <section className="panel burger-inventory-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">MOVIMENTAÇÃO MANUAL</span><h3>Registrar entrada ou saída</h3><p>Use para compras, devoluções, vendas fora de Pedidos, ajustes e perdas.</p></div></div>
      <form className="burger-stock-form" onSubmit={addStockMovement}>
        <label>Produto<select value={productId} onChange={event => setProductId(event.target.value)} required><option value="">Selecione um produto</option>{trackedProducts.map(item => <option key={item.id} value={item.id}>{item.name} · saldo {quantity(item.stock, item.unit)} {UNIT_LABELS[item.unit] || item.unit}</option>)}</select></label>
        <label>Tipo de movimento<select value={movementType} onChange={event => setMovementType(event.target.value)}><option value="purchase">Entrada por compra</option><option value="return">Devolução / retorno ao estoque</option><option value="adjustment_in">Ajuste positivo de inventário</option><option value="sale">Venda avulsa (fora de Pedidos)</option><option value="adjustment_out">Ajuste negativo de inventário</option><option value="waste">Perda / descarte</option></select></label>
        <label>Quantidade<input type="number" min={selected && wholeUnit(selected.unit) ? 1 : 0.001} step={selected && wholeUnit(selected.unit) ? 1 : 0.001} value={movementQuantity} onChange={event => setMovementQuantity(event.target.value)} required placeholder={selected && wholeUnit(selected.unit) ? 'Ex.: 3' : 'Ex.: 1,5'}/></label>
        <label>Data da movimentação<input type="date" value={movementDate} onChange={event => setMovementDate(event.target.value)} required/></label>
        <label className="wide">Motivo / referência<input value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={160} required placeholder={movementType === 'purchase' ? 'Ex.: Compra de bebidas do fornecedor' : movementType === 'waste' ? 'Ex.: Produto vencido descartado' : 'Ex.: Conferência de estoque / pedido fora do sistema'}/></label>
        <div className={'burger-stock-preview ' + (insufficient ? 'warning' : '')}>
          <div><span>Saldo atual</span><strong>{selected ? quantity(selected.stock, selected.unit) + ' ' + (UNIT_LABELS[selected.unit] || selected.unit) : 'Selecione um produto'}</strong></div>
          <span className="arrow">→</span>
          <div><span>Saldo após o movimento</span><strong>{projected === null || !selected || !movementQuantity ? 'Informe a quantidade' : insufficient ? 'Saldo insuficiente' : quantity(projected, selected.unit) + ' ' + (UNIT_LABELS[selected.unit] || selected.unit)}</strong></div>
        </div>
        {insufficient && <p className="burger-stock-error" role="alert">A retirada é maior que o saldo disponível.</p>}
        {invalidWhole && <p className="burger-stock-error" role="alert">Este produto exige uma quantidade inteira.</p>}
        <div className="burger-stock-actions"><button type="submit" className="primary-button" disabled={!selected || !movementQuantity || insufficient || invalidWhole}>Registrar movimentação</button><button type="button" className="secondary-button" onClick={() => { setProductId(''); setMovementQuantity(''); setReason(''); }}>Limpar</button></div>
      </form>
    </section>
    <section className="panel burger-inventory-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">RASTREABILIDADE</span><h3>Histórico de estoque</h3><p>Inclui cadastros iniciais, movimentos manuais e baixas/retornos vinculados a pedidos.</p></div><span className="count-chip">{filteredHistory.length}</span></div>
      <div className="burger-stock-history-tools"><label><Search size={16}/><input value={search} onChange={event => { setSearch(event.target.value); setShowAllHistory(false); }} placeholder="Buscar produto ou motivo..."/></label><select value={historyFilter} onChange={event => { setHistoryFilter(event.target.value); setShowAllHistory(false); }}><option value="all">Todas</option><option value="inbound">Entradas</option><option value="outbound">Saídas</option><option value="waste">Perdas</option></select></div>
      {filteredHistory.length ? <div className="burger-stock-history">{(showAllHistory ? filteredHistory : filteredHistory.slice(0, 8)).map(item => {
        const increase = Number(item.after) >= Number(item.before);
        return <article key={item.id}><span className={'movement-icon ' + (increase ? 'income' : 'expense')}>{increase ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}</span><div><strong>{item.productName}</strong><small>{MOVEMENT_LABELS[item.type] || 'Movimentação'} · {item.date}</small><p>{item.reason}</p><span>Saldo: {quantity(item.before, item.unit)} → {quantity(item.after, item.unit)} {UNIT_LABELS[item.unit] || item.unit}</span></div><strong className={increase ? 'positive' : 'negative'}>{increase ? '+' : '−'}{quantity(item.quantity, item.unit)} {UNIT_LABELS[item.unit] || item.unit}</strong></article>;
      })}</div> : <div className="burger-product-empty">Nenhuma movimentação encontrada para os filtros selecionados.</div>}
      {filteredHistory.length > 8 && <button type="button" className="burger-stock-history-toggle" onClick={() => setShowAllHistory(value => !value)}>{showAllHistory ? 'Mostrar menos' : 'Ver todos os movimentos (' + filteredHistory.length + ')'}<ChevronDown size={15}/></button>}
    </section>
    <p className="burger-catalog-note">Venda avulsa reduz somente o estoque e não registra recebimento no Financeiro. Use Pedidos para registrar as vendas que devem gerar um valor a receber.</p>
  </div>;
}
