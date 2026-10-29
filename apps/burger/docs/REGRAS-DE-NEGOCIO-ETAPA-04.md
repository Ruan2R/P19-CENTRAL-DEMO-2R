# P16 — Regras de negócio iniciais (Etapa 04)

Estas são as regras técnicas iniciais para orientar o backend. Elas não conectam a interface ao banco ainda e não substituem a confirmação dos processos reais com a Adega do Copão.

## Dinheiro e caixa

- Valores monetários são armazenados e calculados em centavos inteiros (`amount_cents`, `cost_cents`, `price_cents`). Não usar ponto flutuante para somar valores financeiros.
- Entrada e saída no fluxo de caixa significam dinheiro efetivamente recebido ou pago, conforme a data da movimentação.
- Contas a pagar e a receber pendentes ficam em indicadores separados; não entram no caixa realizado até serem pagas/recebidas.
- Ao pagar uma conta a pagar, a operação futura do backend deverá, em uma única transação, marcar a conta como paga e criar uma única saída vinculada à conta. Uma repetição da solicitação não pode criar segunda saída.
- Ao receber um valor, a operação futura deverá marcar o recebível como recebido e criar uma única entrada vinculada. O mesmo princípio vale para pagamento de pedido.
- “Resultado do período” nesta base significa **entradas de caixa menos saídas de caixa**. Não deve ser chamado de lucro líquido. Margem bruta por produto é apenas preço menos custo direto unitário e não considera despesas fixas, impostos, perdas ou outros custos.
- Resumos mensais filtram pelas datas das movimentações financeiras. O critério de competência contábil não está implementado; precisa ser confirmado caso o estabelecimento necessite desse tipo de relatório.

## Produtos e estoque

- O cadastro guarda custo unitário, preço de venda, unidade, estoque atual e estoque mínimo.
- Quantidades são representadas internamente em milésimos de unidade (`1000` = `1,000`) para suportar unidade, peso ou volume fracionário sem somar quantidades com erros de ponto flutuante.
- Toda alteração de estoque deve gerar histórico: compra/entrada, venda/consumo de pedido, ajuste, devolução ou perda.
- Uma movimentação não pode deixar o estoque negativo. Ajustes precisam indicar a razão e o usuário responsável quando forem implementados.
- Movimentações vinculadas à mesma origem devem ser idempotentes: repetir uma chamada não pode baixar o estoque duas vezes.
- **Pendente de decisão comercial:** definir o momento de baixa para itens de pedidos (ao receber, ao iniciar preparo, ao pagar ou ao entregar), como tratar cancelamentos depois da baixa e se ingredientes/receitas serão controlados ou apenas produtos vendidos diretamente. Não automatizar a baixa do pedido antes dessa decisão.
- **Pendente de decisão comercial:** definir se o custo apresentado será o custo da última compra ou custo médio. O esquema inicial registra snapshots de custo no item do pedido para preservar histórico.

## Pedidos

- Pedidos são lançados manualmente pela equipe do estabelecimento; esta versão não prevê pedido público nem área de cliente.
- Estados iniciais: `received` (Recebido) → `preparing` (Em preparo) → `ready` (Pronto) → `delivered` (Entregue). Cancelamento é permitido antes da entrega.
- Não é permitido pular estados ou alterar um pedido entregue/cancelado para um estado anterior.
- O estado de preparo e o estado financeiro do pedido são independentes. “Pronto” não quer dizer “pago” e não gera automaticamente uma entrada de caixa.
- O número chamado no painel deve derivar de um identificador persistido e único por data/turno conforme decisão futura; não usar apenas contador mantido no navegador.
- A integração física de chamada depende de conhecer marca/modelo, conectividade e protocolo do painel escolhido. Até lá, só se pode simular o evento.

## Acesso e auditoria

- Os perfis demonstrativos atuais (`admin`, `admin02`) são apenas para a interface local e não são credenciais de segurança.
- No backend, as credenciais devem ser configuradas no servidor; armazenar somente hashes seguros de senha, proteger sessão via cookie `HttpOnly`, aplicar limite de tentativas, verificar origem e validar autorização no servidor para cada módulo/rota.
- Usuário com perfil financeiro não pode acessar rotas de pedidos mesmo que tente abrir o endpoint diretamente.
- Ações sensíveis (pagamento, recebimento, ajuste de estoque, cancelamento e transições de pedido) devem gerar registros de auditoria.
