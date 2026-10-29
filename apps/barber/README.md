# P15-SISTEMA-BARBEARIA

Sistema web de agendamento e gestão da Boss67 Barbearia, em Sidrolândia-MS.

**Versão de desenvolvimento:** `0.9.0` — administração modular, agenda, clientes, financeiro e promoções com foco mobile-first e interface simplificada. **Não liberar para produção.**

## Referências técnicas

- **P13 — Agendamento Barbearia:** principal referência de produto, fluxo público e regras de agendamento: https://github.com/Ruan2R/P13-AGENDAMENTO-BARBEARIA
- **P14 — Sistema Dany:** referência de arquitetura, separação de regras de domínio, segurança, persistência, testes, navegação administrativa, lista de agendamentos, clientes e controle financeiro: https://github.com/Ruan2R/P14-SISTEMA-DANY

O P15 é independente. P13 e P14 são apenas referências; seus repositórios não são dependências de execução e não foram alterados.

## Funcionalidades

### Área pública

- Catálogo inicial com sete serviços e profissionais carregados pela API.
- Seleção de múltiplos procedimentos e escolha de profissional por procedimento ou “Sem preferência”.
- Consulta de disponibilidade real e confirmação de todo o atendimento de forma atômica.
- Grade com inícios a cada 30 minutos; a duração real não é arredondada. Por exemplo, um serviço de 45 minutos às 13:00 bloqueia 13:30 e permite o próximo início padrão às 14:00.
- Dados do cliente por nome e WhatsApp, sem criar conta, com resumo do atendimento e código de confirmação.
- Fluxo público linear em uma única página, inspirado na praticidade do P14: serviços, preferências, data/horários e dados aparecem em sequência, sem exigir navegação por várias telas.
- Promoções selecionáveis no topo: escolher uma oferta adiciona automaticamente seus procedimentos, ajusta a data inicial e limita o calendário à validade da campanha. Os horários daquela data aparecem logo abaixo; o preço promocional segue validado pelo backend.
- Layout mobile-first, com atenção específica ao preenchimento sequencial no celular.

### Área administrativa

- **Visão geral** como entrada, navegação por módulos, barra superior e atalhos; a estrutura segue padrões de navegação responsiva do P14, preservando a paleta preta/amarela da Boss67.
- **Agendamentos:** filtros “Próximos”, “Confirmação pendente” e “Todos”, busca por nome/WhatsApp/serviço/código, lista de atendimentos agrupados, impressão, ações do WhatsApp e atualização de status.
- **Clientes:** diretório pesquisável por nome ou WhatsApp, cadastro manual para clientes presenciais, edição de nome e histórico de atendimentos/faltas.
- **Serviços e profissionais:** cadastro, edição e ativação/desativação, preservando referências históricas.
- **Horários e bloqueios:** funcionamento semanal com pausa, bloqueios da barbearia ou de um profissional e verificação de conflitos.
- **Financeiro:** filtro por mês, quatro indicadores em cartões e “Resultado do mês” em um cartão de largura integral na linha abaixo; valores a receber, lista de contas e movimentações iniciam recolhidos e podem ser expandidos pelo usuário. Formulários de nova movimentação e nova conta também iniciam recolhidos.
- **Valores a receber:** um atendimento confirmado aparece quando termina o último procedimento; marcar como concluído torna-o elegível imediatamente. A lista atualiza a cada 30 segundos enquanto a aba Financeiro estiver aberta. A receita só entra no caixa depois da confirmação manual do recebimento.
- **Promoções:** desconto para um único serviço ou combo de 2 a 6 serviços, com período de validade, preço especial, pausa/ativação, filtros e proteção contra promoções ativas conflitantes para o mesmo serviço. Os preços promocionais são recalculados no backend e congelados nos procedimentos do atendimento.
- **Autenticação:** sessão assinada, cookie `HttpOnly`, `SameSite=Lax`, expiração, revogação no logout, limite de tentativas e verificação de origem nas mutações.
- WhatsApp é aberto com mensagem pré-preenchida; marcar “mensagem enviada” é um registro manual e não prova entrega da mensagem.

**Financeiro sem integração bancária:** uma reserva, confirmação ou conclusão não gera receita automaticamente. Só registre entrada depois que o valor tiver sido recebido. Marcar conta a pagar como paga registra uma única saída associada àquela conta.

## Tecnologias

- React + TypeScript + Vite
- Node.js com módulos ES e API REST na mesma origem
- JSON local para desenvolvimento
- Adaptador MySQL via `mysql2/promise` preparado para produção, ainda sem teste integrado com servidor MySQL real
- Testes automatizados com `node:test`

## Instalação e execução local

Requisitos: Node.js 22.12 ou superior e npm.

```bash
npm install
npm test
npm run dev
```

Acesse `http://localhost:3000`; `/admin` abre a administração.

**Credencial de demonstração apenas local:** ID `ADMIN`, senha `boss67demo`. Nunca reutilize em produção. O servidor recusa `NODE_ENV=production` nesta etapa.

O banco de desenvolvimento fica em `data/local-db.json`, somente neste computador. Preserve-o para manter os dados locais. O `.env` também não deve ser enviado ao Git.

## API pública

```text
GET  /api/health
GET  /api/public/services
GET  /api/public/professionals
GET  /api/public/promotions
GET  /api/public/availability?date=AAAA-MM-DD&serviceId=...&professionalId=...
POST /api/public/booking-groups
```

## API administrativa adicionada

As rotas administrativas exigem sessão autenticada.

```text
GET    /api/admin/agenda?date=AAAA-MM-DD&professionalId=all&status=all
GET    /api/admin/booking-groups?filter=upcoming|pending|all
GET    /api/admin/customers?search=...
POST   /api/admin/customers
GET    /api/admin/customers/:id/history
PATCH  /api/admin/customers/:id
GET    /api/admin/promotions
POST   /api/admin/promotions
PATCH  /api/admin/promotions/:id
GET    /api/admin/finance?month=AAAA-MM
POST   /api/admin/finance/booking-groups/:id/receipt
POST   /api/admin/finance/entries
DELETE /api/admin/finance/entries/:id
POST   /api/admin/finance/payables
POST   /api/admin/finance/payables/:id/paid
DELETE /api/admin/finance/payables/:id
```

As rotas anteriores de serviços, profissionais, horários, bloqueios, status dos atendimentos e marcação manual de confirmação via WhatsApp continuam disponíveis.

## Banco MySQL

O schema inicial fica em `database/schema.mysql.sql`; o seed inicial revisável, em `database/seed.initial.mysql.sql`. Ambos precisam ser aplicados manualmente numa base exclusiva após revisar dados e horários com a Boss67. O schema inicial inclui `financial_entries`, `payables`, `promotions` e `promotion_services`, e já inclui `booking_receipt` no tipo de lançamento e o snapshot promocional por procedimento. Se o banco foi criado a partir de uma versão anterior do schema, faça backup e aplique, na ordem, `database/migrations/20261014_finance_admin.sql` (se ainda não estiver aplicada) e `database/migrations/20261014_promotions-and-booking-receipts.sql`. Não aplique migrações incrementais sobre uma base recém-criada com o schema completo, pois as colunas/tabelas já existirão.

A camada MySQL foi preparada, mas **não foi testada contra uma instância MySQL real**. Validar permissões mínimas, concorrência, transações e restauração de backup antes de produção. Nenhum schema/seed é aplicado automaticamente.

## Regressão técnica — Etapa 11

Na rodada de 14/10/2026, os **43 testes automatizados passaram**. Os módulos `.mjs` passaram em `node --check`, os arquivos TypeScript/TSX passaram por transpilação sintática, e o smoke test HTTP confirmou as rotas públicas e o fluxo de autenticação/proteção. O bloqueio de `NODE_ENV=production` segue intencional. Consulte `docs/RELATORIO-REGRESSAO-ETAPA11.md` para os resultados históricos.

## Correção de TypeScript — Etapa 12

O carregamento da agenda administrativa foi corrigido para usar somente a resposta realmente retornada pela API, e as declarações não utilizadas foram removidas. O responsável pelo desenvolvimento confirmou localmente que **`npm run typecheck` e `npm run build` passaram** após essa correção. O `package-lock.json` está versionado: preserve-o ao aplicar pacotes incrementais e use `npm ci` quando quiser reinstalar exatamente as dependências travadas.

## Testes e validações — Etapa 13

Comandos de validação:

```bash
npm test
npm run typecheck
npm run build
```

A suíte Node foi ampliada de 43 para **46 testes aprovados, sem falhas**. Os três novos cenários ponta a ponta exercitam: (1) catálogo/disponibilidade, reserva de combo promocional, aparecimento no painel e histórico do cliente, registro manual de WhatsApp, conclusão e recebimento idempotente; (2) conflito de reserva sem gravação parcial; e (3) resolução de “Sem preferência” para um profissional real disponível. `node --check` também passou para os arquivos `.mjs` em `server/` e `tests/`.

O typecheck e o build Vite foram confirmados pelo responsável na máquina de desenvolvimento após a Etapa 12. Como a Etapa 13 altera apenas testes e documentação, eles não foram repetidos neste ambiente; execute os três comandos acima depois de aplicar as alterações. Ainda faltam o teste integrado contra MySQL real e a regressão automatizada/visual completa em navegador.

## Melhorias de usabilidade — Etapa 14

- A área de funcionamento semanal agora tem o controle **Remover intervalo**, que limpa início e fim da pausa juntos; depois, é preciso salvar o dia para persistir a mudança.
- Remover um bloqueio da agenda atualiza a lista imediatamente depois da confirmação da API.
- A tela inicial pública apresenta as promoções vigentes e as que começam dentro da janela de agendamento de 60 dias, com serviços incluídos, preços, economia e validade.
- A suíte automatizada passou de **46 para 47 testes aprovados**. O novo teste verifica a remoção do intervalo semanal via API.
- A Etapa 14 ainda requer o `typecheck` e o build após a aplicação dos arquivos, além da conferência visual manual das novas áreas.

## Atualização visual 0.8.0

- O cartão “Resultado do mês” fica abaixo dos outros quatro indicadores e ocupa toda a largura da grade no mobile e desktop.
- Valores a receber, contas cadastradas e movimentações ficam recolhidos ao abrir o Financeiro; formulários de lançamentos e contas continuam sob demanda. Depois de registrar um recebimento/saída ou cadastrar uma conta, a lista relevante abre para facilitar a conferência.
- Cards de promoções ganharam hierarquia visual de tipo/status, validade, economia, preço normal e preço promocional, com ajustes específicos abaixo de 380 px.

## Pendências antes da produção

- Manter a configuração e rotação de credenciais administrativas exclusivamente no servidor.
- Validar CSRF/origem, rate limit atrás do proxy, limites de payload e cabeçalhos de segurança.
- Executar migração/schema em MySQL dedicado e testar concorrência/backup/restauração.
- Confirmar catálogo, profissionais, horários e dados comerciais com a Boss67.
- Validar responsividade em 320, 360, 393 e 430 px, tablet e desktop.
- Fazer revisão de privacidade, logs, mensagens de erro e smoke test em homologação.

Mobile-first é requisito permanente. P13 e P14 permanecem intactos; nenhuma publicação no GitHub foi feita.


## Atualização visual 0.9.0

- A aba Promoções usa um único seletor de status, sem botões distribuídos em duas linhas no mobile.
- A explicação de combos fica recolhida por padrão e abre sob demanda.
- Cards de ofertas foram simplificados: tipo/status, serviços, validade/economia e uma linha compacta de preço normal versus promocional.
- Removida informação duplicada no cabeçalho; a contagem fica no catálogo de ofertas.
- Financeiro permanece conforme validado na versão 0.8.0.

## Usabilidade das promoções — Etapa 15

- As ofertas na primeira tela agora são acionáveis: **Adicionar combo** seleciona todos os procedimentos do combo; **Adicionar oferta** seleciona o serviço promocional.
- Ao escolher uma oferta, os serviços correspondentes são destacados na lista de serviços e a página rola até essa lista. O cliente pode ajustar a seleção normalmente.
- A oferta indica quantos serviços já estão selecionados e desativa a ação quando todos já estão no atendimento, evitando duplicações. Combos parcialmente selecionados oferecem a ação **Completar combo**.
- O texto explica que o preço promocional depende da data do atendimento. A validade da campanha aparece no cartão, incluindo o intervalo completo para campanhas futuras.
- A lógica de preços promocionais e a validação no backend permanecem inalteradas.

### Validação da Etapa 15

Após mesclar o ZIP incremental, executar `npm test`, `npm run typecheck` e `npm run build`. Testar manualmente o botão de adicionar oferta, completar combo parcialmente selecionado, remover um serviço e confirmar o desconto em uma data válida.



## Usabilidade do agendamento — Etapa 16

- O fluxo público deixou de esconder cada parte atrás de um botão “Continuar”. Os blocos de serviços, profissionais, data/horários e dados formam uma página vertical, seguindo a praticidade do formulário público do P14 sem copiar sua arquitetura.
- Ao escolher **Agendar com esta oferta**, os procedimentos incluídos são selecionados automaticamente. A tela leva o cliente até a seleção para que veja os serviços adicionados, seus preços e a duração.
- A data é ajustada para o primeiro dia válido dentro da janela de agendamento (hoje até 60 dias). Enquanto a oferta estiver selecionada, o campo de data restringe a escolha ao período da campanha e informa como liberar outras datas caso o cliente abra mão da condição promocional.
- Os preços promocionais de serviços selecionados exibem o nome da campanha e o valor calculado; o resumo dos horários mostra o total e a economia quando aplicável.
- A etapa final reúne o resumo da reserva e os campos de nome/WhatsApp, permitindo confirmar sem ir para uma tela de revisão separada.

### Validação da Etapa 16

`npm test`: **47 testes aprovados, 0 falhas**. A sintaxe TSX de `BookingPage.tsx` foi verificada sem diagnósticos e `node --check` passou para os arquivos `.mjs` do servidor e testes. A instalação de dependências expirou neste ambiente; por isso, o `typecheck` integral e o build Vite precisam ser repetidos na máquina de desenvolvimento após mesclar o ZIP.

Teste manual prioritário: selecionar uma oferta vigente e uma futura; conferir se os procedimentos foram adicionados, a data inicial foi ajustada, o calendário respeita a validade, os horários carregam e o valor da oferta permanece correto antes da confirmação. Repetir o fluxo manual de serviços sem promoção e conferir as resoluções de 320, 393 e 430 px, além de desktop.
