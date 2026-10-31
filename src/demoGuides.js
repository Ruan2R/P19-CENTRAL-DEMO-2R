const MODULE_GUIDES = {
  site: {
    title: 'Comece conhecendo a apresentação do negócio',
    description: 'Esta é a página que o visitante vê primeiro. Ela apresenta a marca, explica o que o negócio oferece e conduz a pessoa para o próximo passo, como entrar em contato ou agendar.',
    tip: 'Observe o conteúdo, os destaques e o botão principal. Nesta prévia, textos, preços e ações são ilustrativos.',
  },
  overview: {
    title: 'Visão geral: entenda a operação em poucos segundos',
    description: 'Este painel reúne indicadores e atalhos para as áreas mais importantes. É o ponto de partida para entender o que está acontecendo antes de abrir cada detalhe.',
    tip: 'Use os atalhos para continuar a demonstração ou abra as áreas pelo menu lateral.',
  },
  booking: {
    title: 'Agendamento público: experimente como o cliente reserva',
    description: 'Simule a escolha de serviços, data, horário e dados de contato. A tela demonstra a experiência de reserva antes de a informação chegar à área administrativa.',
    tip: segment => segment === 'Barber'
      ? 'No Barber, você pode combinar procedimentos e escolher a preferência de profissional para cada um.'
      : 'No Beauty, confira a seleção de serviços, duração, horários e orientações antes da confirmação.',
  },
  appointments: {
    title: 'Agendamentos: acompanhe a rotina de atendimento',
    description: 'Aqui a equipe consulta os horários, identifica cada cliente e acompanha a situação dos atendimentos. Os filtros ajudam a localizar rapidamente o que precisa de atenção.',
    tip: 'Experimente os filtros e abra um registro para conhecer as ações disponíveis.',
  },
  clients: {
    title: 'Clientes: consulte o histórico e os dados cadastrados',
    description: 'Esta área centraliza os clientes que aparecem nos atendimentos, facilitando a consulta de informações e do histórico de relacionamento.',
    tip: 'Os contatos desta demonstração são fictícios.',
  },
  services: {
    title: 'Serviços: veja o que o negócio oferece',
    description: 'O catálogo reúne os serviços ou procedimentos, com informações como preço, duração e disponibilidade. Ele serve de base para o agendamento e para a organização da operação.',
    tip: 'Observe como preço e duração ajudam a compor o agendamento.',
  },
  professionals: {
    title: 'Profissionais: conheça a equipe e suas responsabilidades',
    description: 'A equipe pode ser organizada por profissional, função e disponibilidade. Essas informações ajudam a distribuir os atendimentos e a consultar a agenda de cada pessoa.',
    tip: 'No exemplo, os profissionais e seus dados são demonstrativos.',
  },
  promotions: {
    title: 'Promoções: explore ofertas e combinações',
    description: 'Esta área apresenta promoções individuais e combos, com preço e período de validade. Ela ajuda a visualizar como ofertas podem ser organizadas sem misturar as regras com a agenda.',
    tip: 'Confira os estados das ofertas e os detalhes de cada condição.',
  },
  hours: {
    title: 'Horários: configure quando o negócio atende',
    description: 'A configuração de funcionamento define os dias, horários de abertura e encerramento e eventuais intervalos. A disponibilidade apresentada ao cliente depende dessas regras.',
    tip: 'Observe como dias desativados e intervalos interferem na agenda.',
  },
  blocks: {
    title: 'Bloqueios: reserve períodos indisponíveis',
    description: 'Use esta área para representar folgas, compromissos e outros períodos em que não devem ser aceitos novos agendamentos.',
    tip: 'Confira o alcance de cada bloqueio e como ele afeta a disponibilidade.',
  },
  policies: {
    title: 'Políticas: alinhe as regras antes da reserva',
    description: 'As políticas exibem orientações importantes para o cliente antes da confirmação, como sinal, cancelamento, atraso e condições do atendimento.',
    tip: 'Leia as orientações como se estivesse fazendo uma reserva pela primeira vez.',
  },
  finance: {
    title: 'Financeiro: acompanhe entradas, saídas e pendências',
    description: 'A área financeira organiza os valores recebidos e pagos, as movimentações e os compromissos futuros. Ela ajuda a entender o resultado do período sem misturar valores pendentes com o caixa efetivado.',
    tip: 'Os números são fictícios e servem apenas para demonstrar a organização financeira.',
  },
  orders: {
    title: 'Pedidos: acompanhe a operação de ponta a ponta',
    description: 'Esta área é interna da equipe. Inicie o atendimento, registre um pedido, acompanhe o preparo e a retirada e registre o pagamento separadamente do status operacional.',
    tip: 'No Burger, a baixa de estoque acontece ao registrar o pedido; o pagamento é confirmado em uma etapa própria.',
  },
};

export function getModuleGuide(module, segment = 'Beauty') {
  const guide = MODULE_GUIDES[module] || {
    title: 'Explore esta área da demonstração',
    description: 'Confira as informações e experimente as ações disponíveis. Os dados são fictícios e as alterações são temporárias.',
    tip: 'Use o menu para navegar entre as áreas incluídas neste pacote.',
  };
  return {
    title: guide.title,
    description: guide.description,
    tip: typeof guide.tip === 'function' ? guide.tip(segment) : guide.tip,
  };
}

export const BURGER_FINANCE_GUIDES = {
  overview: {
    title: 'Resumo: tenha uma visão rápida do caixa',
    description: 'Confira o resultado do período, entradas recebidas, saídas pagas e as movimentações mais recentes. Os atalhos levam diretamente às tarefas financeiras.',
    tip: 'Contas pendentes aparecem separadas e não entram no resultado do caixa efetivado.',
  },
  financial: {
    title: 'Financeiro: entenda o resultado e os compromissos',
    description: 'Veja entradas menos saídas no período, acompanhe contas pendentes e compare os valores por categoria e forma de pagamento.',
    tip: 'Resultado do período não é sinônimo de lucro líquido nem de saldo bancário.',
  },
  transactions: {
    title: 'Movimentações: registre o que realmente entrou ou saiu',
    description: 'Consulte e lance entradas e saídas efetivas, com categoria, data e forma de pagamento. Use a busca e os filtros para localizar registros.',
    tip: 'O pagamento de um pedido confirmado também aparece no caixa, sem duplicar o valor.',
  },
  payables: {
    title: 'Contas a pagar: organize os vencimentos',
    description: 'Cadastre compromissos futuros e marque cada conta como paga quando o pagamento acontecer. A confirmação gera uma saída no caixa.',
    tip: 'Uma conta pendente ainda não deve ser tratada como dinheiro que já saiu.',
  },
  receivables: {
    title: 'Contas a receber: acompanhe valores futuros',
    description: 'Registre valores que ainda serão recebidos e confirme a entrada quando o pagamento acontecer. Recebimentos vinculados a pedidos são tratados na área de Pedidos.',
    tip: 'O status do pedido e o status do pagamento são controles diferentes.',
  },
  inventory: {
    title: 'Produtos e estoque: controle o catálogo e as quantidades',
    description: 'Separe produtos de revenda dos itens preparados na hora, confira custos e preços e registre entradas, saídas, perdas e ajustes.',
    tip: 'Produtos preparados na hora têm custo estimado, mas não mantêm estoque do produto final.',
  },
};
