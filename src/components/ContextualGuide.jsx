import { ArrowRight, Boxes, CalendarDays, ClipboardList, Eye, LayoutDashboard, Package, Scissors, Sparkles, Store, Users, Wallet, X, CircleHelp } from 'lucide-react';

const MODULE_GUIDES = {
  site: {
    title: 'Uma página completa, não só uma lista de serviços',
    summary: 'A landing page apresenta a marca em uma sequência: proposta, história, serviços, detalhes, resultados, confiança, localização e um próximo passo claro.',
    steps: [
      'Use os links de navegação da própria página para visitar cada seção.',
      'Explore os serviços e os blocos de detalhes para perceber como a página explica cada opção.',
      'Confira galeria, depoimentos, localização, redes sociais e a chamada final.'
    ]
  },
  overview: {
    title: 'O painel reúne um resumo da operação',
    summary: 'Aqui você encontra os principais indicadores, a atividade em destaque e atalhos para as áreas incluídas no pacote. No celular, as abas ficam visíveis logo abaixo do cabeçalho; no desktop, a navegação permanece na lateral.',
    steps: [
      'Comece pelos indicadores na parte superior para entender o cenário.',
      'Confira a lista resumida de agendamentos, pedidos ou estoque.',
      'No celular, escolha diretamente uma das abas visíveis logo abaixo do cabeçalho. No desktop, use a navegação lateral ou os atalhos do painel para abrir os módulos incluídos.'
    ]
  },
  booking: {
    title: 'Fluxo de agendamento do cliente',
    summary: 'O cliente escolhe procedimentos, define data e horário e preenche os dados para concluir a simulação.',
    steps: [
      'Selecione um ou mais serviços para montar o atendimento.',
      'Escolha a data e use as duas rodas para selecionar hora e minuto.',
      'Preencha nome e contato fictícios e confirme; depois confira o registro na agenda administrativa.'
    ]
  },
  appointments: {
    title: 'Agenda e acompanhamento dos atendimentos',
    summary: 'Esta tela concentra horários, clientes, serviços e status. Você pode pesquisar por nome, telefone ou procedimento, alternar Próximos/Pendentes/Todos e filtrar situação e período.',
    steps: [
      'Pesquise por nome, telefone ou procedimento e use Próximos, Pendentes ou Todos.',
      'Abra Filtros para separar por situação e período, inclusive intervalo personalizado.',
      'Em Novo agendamento, informe nome e telefone. Se o cliente ainda não existir, o cadastro demonstrativo é criado automaticamente.'
    ]
  },
  clients: {
    title: 'Cadastro e histórico de clientes',
    summary: 'A lista reúne contatos fictícios, permite adicionar clientes manualmente e importar contatos de um arquivo vCard (.vcf), além de pesquisar por nome ou telefone.',
    steps: [
      'Use a busca para localizar por nome ou telefone.',
      'Adicione um cliente manualmente ou importe contatos de um arquivo .vcf; duplicados são ignorados na prévia.',
      'Compare contato, quantidade de atendimentos e última visita.'
    ]
  },
  services: {
    title: 'Catálogo de serviços e procedimentos',
    summary: 'Cada cartão apresenta categoria, nome, duração e valor. É a referência do que pode ser escolhido no fluxo de agendamento.',
    steps: [
      'Compare as categorias e os procedimentos disponíveis.',
      'Observe a duração e o valor de cada serviço.',
      'O botão Adicionar serviço é ilustrativo nesta central; a configuração completa fica no sistema contratado.'
    ]
  },
  finance: {
    title: 'Resumo e movimentações financeiras',
    summary: 'No Beauty e no Barber, o financeiro segue a organização do P18: indicadores do mês, valores a receber, registro de entradas/saídas, contas a pagar e histórico de caixa.',
    steps: [
      'Confira os cinco indicadores no início: entradas, saídas, resultado do mês, valores a receber e contas a pagar.',
      'Em Valores a receber, abra a lista para conferir o saldo de cada atendimento e registre quando o pagamento realmente entrar.',
      'Use Registrar movimentação para lançar entradas ou saídas manuais. Em Contas a pagar, cadastre a despesa e marque como paga para gerar a saída no histórico.'
    ]
  },
  servicePromotions: {
    title: 'Promoções e combinações de serviços',
    summary: 'Esta área demonstra como ofertas individuais e combos podem ser organizados por tipo e status.',
    steps: [
      'Filtre ofertas ativas, programadas ou pausadas.',
      'Abra um cartão para conferir serviços e valores demonstrativos.',
      'Ative, pause ou adicione um exemplo para testar a interação.'
    ]
  },
  blocks: {
    title: 'Bloqueios e indisponibilidades da agenda',
    summary: 'Use esta área para reservar períodos em que não haverá atendimento. No Barber, o bloqueio pode valer para um profissional ou para toda a barbearia; no Beauty, ele vale para a agenda da profissional.',
    steps: [
      'Escolha a data em que a agenda ficará indisponível.',
      'No Barber, selecione um profissional ou toda a barbearia. No Beauty, o bloqueio se aplica à agenda completa.',
      'Informe início e fim para reservar apenas um período ou deixe os horários vazios no Beauty para bloquear o dia inteiro. Depois, confira e remova os exemplos na lista.'
    ]
  },
  policies: {
    title: 'Políticas e orientações para clientes',
    summary: 'Defina quais avisos serão apresentados antes da confirmação do agendamento, como tolerância a atrasos, prazo de cancelamento, acompanhantes e faltas.',
    steps: [
      'Ative somente as orientações que devem aparecer para o cliente.',
      'Quando uma opção estiver ativa, ajuste o prazo ou o texto correspondente.',
      'Salve as orientações para atualizar a prévia. Os dados são demonstrativos e não são publicados em uma agenda real.'
    ]
  },
  orders: {
    title: 'Pedidos e operação do atendimento',
    summary: 'O fluxo segue o P16: abra um atendimento, lance os produtos, acompanhe o preparo, registre a entrega e confirme o recebimento. Pedidos e financeiro compartilham os valores pendentes.',
    steps: [
      'Clique em Iniciar atendimento. Cada atendimento reinicia a numeração de pedidos em 001.',
      'Use Lançar pedido, identifique balcão/mesa/delivery, adicione produtos e quantidades e registre. Produtos de revenda têm baixa automática no estoque; preparados na hora não controlam saldo próprio.',
      'Avance Recebido → Em preparo → Pronto → Entregue. Depois use Registrar pagamento para informar data e forma de recebimento; o valor entra no Financeiro e o pendente é baixado.',
      'Pedidos ainda em preparo ou prontos impedem encerrar o atendimento. Pedido entregue sem pagamento pode permanecer em Valores a receber; o encerramento não apaga esse saldo.',
      'Ao cancelar um pedido não pago, a baixa de estoque dos itens controlados é devolvida. Pedido pago não pode ser cancelado nesta prévia.'
    ]
  },
  products: {
    title: 'Catálogo de produtos',
    summary: 'O catálogo segue a separação do P16: produtos de revenda, com custo/preço e quantidade controlada, e preparados na hora, com custo estimado e sem saldo do produto final.',
    steps: [
      'Compare Produtos de revenda com Preparados na hora. O primeiro grupo mantém estoque; o segundo não controla quantidade do produto final.',
      'Use Novo produto para informar nome, categoria, tipo, custo, preço e, para revenda, quantidade inicial e estoque mínimo.',
      'Confira a margem estimada por item e o aviso de reposição. O cadastro é demonstrativo e duplicidades de nome são bloqueadas.',
      'Produtos já utilizados em pedidos são preservados para não quebrar o histórico.'
    ]
  },
  inventory: {
    title: 'Posição e movimentação de estoque',
    summary: 'A tela registra entradas e saídas de produtos de revenda e mantém o histórico. Pedidos fazem a baixa automaticamente; a movimentação manual serve para compras, devoluções, ajustes, perdas e vendas avulsas.',
    steps: [
      'Confira o saldo atual e o estoque mínimo de cada produto controlado. Itens preparados na hora não aparecem nesta lista.',
      'Selecione um produto, o tipo de movimento, a quantidade, a data e descreva o motivo. A prévia mostra o saldo antes e depois.',
      'Saídas maiores que o saldo são bloqueadas; unidades e porções exigem números inteiros. Kg e litros aceitam frações.',
      'Consulte o Histórico de estoque para localizar cadastros iniciais, compras, saídas manuais e baixas/devoluções de pedidos.',
      'Venda avulsa movimenta somente o estoque; ela não cria entrada financeira. Para uma venda com pedido e pagamento, use a área Pedidos.'
    ]
  }
};

function guideFor(demo, module) {
  const base = MODULE_GUIDES[module] || {
    title: 'Explore este módulo',
    summary: 'Esta área reúne informações e ações demonstrativas relacionadas ao pacote selecionado.',
    steps: [
      'Observe os dados apresentados na tela.',
      'Experimente filtros, botões e formulários disponíveis.',
      'Selecione outra aba de navegação para avançar para uma área diferente do pacote.'
    ]
  };

  if (module === 'finance' && demo && demo.segment === 'Burger') {
    return {
      title: 'Financeiro da operação Burger',
      summary: 'A visão segue o P16: resultado, entradas, saídas, contas a pagar, valores a receber, categorias, formas de pagamento e relatório de pedidos. Quando o valor vier de um pedido, a confirmação é feita na aba Pedidos para não duplicar o lançamento.',
      steps: [
        'No Resumo, confira o resultado, as entradas/saídas do mês e as ações rápidas. Em Financeiro, veja as contas pendentes, vencimentos, categorias e formas de pagamento.',
        'Movimentações registra entradas/saídas efetivas; Contas a pagar gera uma saída quando marcada como paga. Valores a receber permite cadastrar e acompanhar valores manuais.',
        'Valores vinculados a pedidos aparecem em Contas a receber e no Relatório de pedidos, mas o pagamento deve ser confirmado na aba Pedidos. Assim o caixa e o saldo pendente são atualizados juntos.'
      ]
    };
  }

  if (module === 'booking' && demo && demo.segment === 'Barber') {
    return {
      title: 'Agendamento com escolha de profissional',
      summary: 'O cliente seleciona os procedimentos, define um profissional para cada serviço e escolhe um horário em intervalos demonstrativos de 30 minutos.',
      steps: [
        'Selecione os procedimentos que farão parte do atendimento.',
        'Escolha a data, depois o profissional por procedimento e a hora/minuto na roda.',
        'Preencha os dados fictícios, confirme e confira o registro na agenda administrativa.'
      ]
    };
  }

  if (module === 'booking' && demo && demo.segment === 'Burger') {
    return {
      title: 'Contato e direcionamento da página',
      summary: 'Neste pacote Burger, o fluxo de pedidos é interno. A landing page apresenta a marca e direciona o visitante para o canal de contato.',
      steps: [
        'Conheça os destaques da página e as informações da marca.',
        'Use a chamada principal para entender o destino de contato demonstrativo.',
        'Selecione a aba Pedidos para experimentar a operação interna.'
      ]
    };
  }

  if (module === 'overview' && demo && demo.segment === 'Burger') {
    return {
      title: 'Visão geral da operação Burger',
      summary: 'O painel reúne pedidos recentes ou posição do estoque, além de indicadores de operação, produtos e movimentações do pacote.',
      steps: [
        'Confira os indicadores no início da tela.',
        'Veja o resumo de pedidos ou produtos apresentado no painel.',
        'Use os atalhos para abrir Pedidos, Produtos, Estoque ou Financeiro.'
      ]
    };
  }

  return base;
}

function iconFor(module) {
  const icons = {
    site: Store,
    overview: LayoutDashboard,
    booking: CalendarDays,
    appointments: CalendarDays,
    clients: Users,
    services: Scissors,
    finance: Wallet,
    orders: ClipboardList,
    products: Package,
    inventory: Boxes,
    servicePromotions: Sparkles
  };
  return icons[module] || CircleHelp;
}

export function ModuleBrief({ demo, module, onOpenGuide }) {
  const guide = guideFor(demo, module);
  const Icon = iconFor(module);

  return (
    <section className="module-brief" aria-label="Orientações desta tela">
      <span className="module-brief-icon"><Icon size={19}/></span>
      <div className="module-brief-copy">
        <span>ORIENTAÇÃO DESTA TELA</span>
        <strong>{guide.title}</strong>
        <p>{guide.summary}</p>
      </div>
      <button type="button" onClick={onOpenGuide}>Ver passo a passo <ArrowRight size={15}/></button>
    </section>
  );
}

export function ScreenGuide({ mode, demo, module, onClose }) {
  const isCatalog = mode === 'catalog';
  const guide = isCatalog ? {
    title: 'Como explorar as soluções 2R',
    summary: 'Comece pelo pacote recomendado de Gestão em cada segmento e navegue pela demonstração como se estivesse usando o sistema.',
    steps: [
      'Escolha o segmento nos filtros do catálogo.',
      'Comece pelo cartão “Mais indicado” para conhecer a solução de Gestão.',
      'Escolha um dos módulos pelas abas de navegação da demonstração e leia a orientação de cada tela antes de testar o fluxo.'
    ]
  } : guideFor(demo, module);

  return (
    <div className="screen-guide-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="screen-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="screen-guide-title">
        <div className="screen-guide-grabber" aria-hidden="true"/>
        <header className="screen-guide-header">
          <div>
            <span>GUIA DA DEMONSTRAÇÃO</span>
            <h2 id="screen-guide-title">{guide.title}</h2>
            <p>{guide.summary}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar orientações"><X size={19}/></button>
        </header>
        <ol className="screen-guide-steps">
          {guide.steps.map((step, index) => (
            <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>
          ))}
        </ol>
        <div className="screen-guide-note"><Eye size={16}/><p>Os dados são fictícios. Ações e formulários servem para demonstrar o fluxo e não enviam informações para clientes.</p></div>
        <footer><button type="button" onClick={onClose}>Entendi, continuar <ArrowRight size={16}/></button></footer>
      </section>
    </div>
  );
}
