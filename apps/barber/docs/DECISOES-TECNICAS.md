# P15 — decisões técnicas

## Estado em 14/10/2026 — versão 0.9.0 (desenvolvimento)

- Projeto independente: `P15-SISTEMA-BARBEARIA`.
- P13 é a referência principal de produto, fluxo público e regras de agendamento.
- P14 é a referência para a arquitetura por módulos, navegação administrativa, agendamentos, clientes, financeiro, segurança, persistência e testes.
- Frontend: React + TypeScript + Vite. Backend: Node.js com módulos ES e API REST na mesma origem.
- Desenvolvimento local: `data/local-db.json`. Produção prevista: MySQL gerenciado, ainda sem teste integrado em uma instância real.
- A administração inclui Visão geral, Agendamentos, Clientes, Serviços, Profissionais, Horários, Bloqueios, Financeiro e Promoções.
- Prioridade permanente: mobile-first; viewport de referência iPhone 16 em 393 px, com conferência adicional em 320 px.
- O build/typecheck completo ainda não foi validado nesta máquina; `npm install` expirou. A publicação permanece bloqueada.

## Grade oficial de horários

- Novos inícios são ofertados a cada 30 minutos, ancorados ao horário de abertura configurado naquele dia.
- A duração real fica em minutos e nunca é arredondada. Exemplo: serviço de 45 minutos às 13:00 termina às 13:45; 13:30 conflita e 14:00 é o próximo início padrão.
- Disponibilidade respeita expediente, pausas, bloqueios e atendimentos existentes. Os procedimentos do mesmo atendimento não podem se sobrepor, mesmo quando escolhidos profissionais diferentes.
- A disponibilidade é recalculada no backend durante a confirmação; “Sem preferência” é atribuído a um profissional realmente disponível.

## Agendamentos e WhatsApp

- Todos os procedimentos de um mesmo pedido formam um único `booking_group`; a confirmação deve gravar todos os itens ou nenhum.
- Nome, preço promocional e duração dos procedimentos são congelados como snapshots para preservar o histórico.
- A confirmação do site registra o atendimento no sistema; não significa que a mensagem do WhatsApp foi enviada. Na agenda existe um único botão de ícone do WhatsApp, que abre a mensagem pronta e, num segundo toque após o envio manual, registra a confirmação enviada.
- Filtro “Confirmação pendente” significa que o envio manual de WhatsApp não foi registrado, não que a reserva ainda aguarde confirmação pelo site.

## Financeiro

- Não existe integração bancária. Agendamento, confirmação ou conclusão não devem criar automaticamente uma receita de caixa.
- Um atendimento confirmado passa a aparecer em “Valores a receber” depois que o último procedimento termina; marcá-lo como concluído torna-o elegível imediatamente. Enquanto a aba Financeiro estiver aberta, a lista é atualizada a cada 30 segundos.
- A entrada real só é criada quando o administrador confirma manualmente que o pagamento foi recebido; cada atendimento gera no máximo um lançamento de recebimento.
- Marcar uma conta a pagar como paga registra uma única saída vinculada, protegida contra duplicidade/exclusão manual.

## Promoções

- A administração permite criar promoções para um serviço individual ou combos de 2 a 6 serviços, com nome, preço promocional e período de validade.
- O preço promocional precisa ser menor que a soma dos preços normais. Campanhas ativas com datas sobrepostas não podem compartilhar serviço, inclusive quando esse serviço faz parte de um combo.
- O frontend apenas apresenta os preços; o backend valida/aplica o desconto e registra os valores e nomes promocionais nos snapshots do atendimento. Alterações no catálogo não modificam reservas antigas.

## Persistência e publicação

- O armazenamento local serializa as mutações e serve para desenvolvimento/testes. O adaptador MySQL usa transações para a criação do atendimento e foi preparado, mas ainda deve ser testado com um MySQL real.
- Schema e migrações não são aplicados automaticamente. Para uma base existente, gerar backup e aplicar as migrações na ordem documentada em `database/migrations/README.md`; uma base nova deve usar `database/schema.mysql.sql`.
- `NODE_ENV=production` permanece bloqueado. Antes de produção: executar build/typecheck, testar o adaptador MySQL, revisar origem/CSRF/rate limit atrás do proxy, criar contas reais, testar backups/restauração e confirmar catálogo/horários com a Boss67.
- O P13 e o P14 não foram alterados; seus repositórios não são dependências de execução.


## Ajustes de interface — versão 0.8.0

- O cartão Resultado do mês aparece por último e usa a largura integral da grade; os quatro indicadores financeiros ficam antes dele em duas colunas no mobile.
- Valores a receber, contas cadastradas e movimentações começam recolhidos; formulários e listas abrem somente após ação explícita. Após um lançamento ou cadastro bem-sucedido, a área relevante abre para facilitar conferência.
- Os cards de promoções apresentam melhor hierarquia visual por status, com blocos para validade, economia, preço regular e preço promocional.
- Referência de validação visual: iPhone 16, viewport de 393 px; ainda deve ser repetida após instalação de dependências e build completo.


## Regressão técnica — 14/10/2026

- A suíte Node.js terminou com **43/43 testes aprovados**.
- Todos os arquivos `.mjs` de `server/` e `tests/` passaram em `node --check`.
- Os 9 arquivos TypeScript/TSX foram transpilados com a API do TypeScript global sem diagnóstico de sintaxe. Isso não substitui typecheck nem build completo.
- Smoke test HTTP local: `/api/health`, serviços, profissionais e promoções responderam `200`; APIs administrativas responderam `401` sem sessão; login com origem externa respondeu `403`; login local válido respondeu `200`; áreas administrativas responderam `200` autenticado; após logout, a API protegida voltou a responder `401`.
- `NODE_ENV=production` encerra o processo com mensagem explícita de bloqueio, conforme o estado atual do projeto.
- **Build/typecheck completos não aprovados:** `node_modules` não está disponível e a instalação de dependências expirou. A rota `/` respondeu `500` no smoke test porque o pacote `vite` não estava instalado neste ambiente. Não interpretar isso como falha visual no ambiente do desenvolvedor, onde a aplicação já foi aberta; trata-se de validação de build ainda pendente aqui.
- **Bloqueio de empacotamento identificado:** não há `package-lock.json` no pacote. Por isso `npm ci` falha imediatamente e a instalação reproduzível ainda não está configurada. Num ambiente com acesso ao registry, executar `npm install` para gerar o lockfile, validar `npm run typecheck` e `npm run build`, e preservar o lockfile no próximo pacote.
- **MySQL ainda sem teste integrado.** Esquema, transações e migrações foram revisados estaticamente, mas precisam de uma base descartável para confirmar compatibilidade real, concorrência, rollback, índices e restauração.
- A publicação permanece bloqueada; nenhum repositório GitHub foi alterado.
