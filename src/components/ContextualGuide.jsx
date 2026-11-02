import { ArrowRight, Boxes, CalendarDays, ClipboardList, Eye, LayoutDashboard, Package, Scissors, Sparkles, Store, Users, Wallet, X, BadgeCheck, CircleHelp } from 'lucide-react';

const MODULE_GUIDES = {
  site: {
    title: 'Uma página completa, não só uma lista de serviços',
    summary: 'A landing page apresenta a marca em uma sequência: proposta, história, serviços, detalhes, resultados, confiança, localização e um próximo passo claro.',
    steps: [
      'Navegue pelo menu da própria página para ver cada seção.',
      'Explore os serviços e os blocos de detalhes para perceber como a página explica cada opção.',
      'Confira galeria, depoimentos, localização, redes sociais e a chamada final.'
    ]
  },
  overview: {
    title: 'O painel reúne um resumo da operação',
    summary: 'Aqui você encontra os principais indicadores, a atividade em destaque e atalhos para as áreas incluídas no pacote.',
    steps: [
      'Comece pelos indicadores na parte superior para entender o cenário.',
      'Confira a lista resumida de agendamentos, pedidos ou estoque.',
      'Use os atalhos para abrir a área que deseja explorar em detalhes.'
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
    summary: 'O Financeiro é dividido em Resumo, Entradas, Saídas, Valores a receber e Contas a pagar, com resultado mensal e atualização demonstrativa dos totais.',
    steps: [
      'No Resumo, confira entradas, saídas, resultado do mês, valores a receber e contas a pagar.',
      'Abra Entradas ou Saídas para consultar e registrar movimentações; em Valores a receber, confirme o recebimento de um atendimento.',
      'Em Contas a pagar, cadastre uma conta e marque como paga para registrar a saída automaticamente.'
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
  orders: {
    title: 'Pedidos e operação do atendimento',
    summary: 'O fluxo começa com um atendimento aberto. A equipe lança os itens, acompanha o preparo e consulta o resumo dos pedidos.',
    steps: [
      'Confira se o atendimento está iniciado; sem ele, o lançamento fica bloqueado.',
      'Toque em “Lançar pedido”, escolha quantidades e registre.',
      'Avance o status do pedido e confira o reflexo demonstrativo no estoque.'
    ]
  },
  products: {
    title: 'Catálogo de produtos',
    summary: 'O catálogo diferencia produtos com quantidade controlada dos itens preparados sob demanda. Também reúne preços e categorias.',
    steps: [
      'Observe a categoria de cada item.',
      'Compare produtos com estoque e produtos produzidos sob pedido.',
      'Abra Estoque para simular a movimentação de quantidades.'
    ]
  },
  inventory: {
    title: 'Posição e movimentação de estoque',
    summary: 'Esta tela mostra a quantidade disponível dos produtos controlados e diferencia os itens produzidos somente após o pedido.',
    steps: [
      'Confira a quantidade atual de cada item.',
      'Use os controles de entrada e retirada para simular uma movimentação.',
      'Restaure os exemplos para retornar aos números iniciais.'
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
      'Use o menu para avançar para outra área do pacote.'
    ]
  };

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
        'Abra Pedidos pelo menu para experimentar a operação interna.'
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
      'Abra os módulos pelo menu e leia a orientação de cada tela antes de testar o fluxo.'
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
