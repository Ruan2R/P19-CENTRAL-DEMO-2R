# P15-SISTEMA-BARBEARIA — Planejamento técnico inicial

**Status:** Etapa 8 — núcleo público, administração modular, clientes/histórico, financeiro manual, recebíveis e promoções/combos em desenvolvimento local; build completo, integração MySQL e publicação ainda pendentes  
**Produto:** sistema web de agendamento e administração para Boss67 Barbearia, Sidrolândia-MS  
**Projeto novo:** `P15-SISTEMA-BARBEARIA`  
**Referências:** P13 (produto, UX e regras existentes) + P14 (arquitetura, segurança, persistência, testes e publicação)

---

## 1. Direção do produto

O P15 será um sistema independente. Não terá landing page de marketing. A entrada pública deve conduzir diretamente ao agendamento; a área administrativa será separada e protegida.

O visual deve preservar a identidade oficial da Boss67: preto/quase preto predominante, amarelo/dourado para destaque, branco para textos e uso da logo oficial. Prioridade de design: mobile-first, clareza, poucos passos, feedback objetivo e ausência de excesso de elementos decorativos.

Dados de negócio recebidos no briefing — precisam ser reconfirmados pela barbearia antes da publicação:

- Endereço: Rua Lúcia de Souza Mello, 480, Centro, Sidrolândia-MS, CEP 79170-000.
- WhatsApp: (67) 99811-4192.
- Instagram: https://www.instagram.com/boss67barbearia/
- Serviços/preços/durações iniciais: Corte R$ 50 / 30 min; Barba R$ 40 / 30 min; Barba e Pigmentação R$ 65 / 45 min; Corte e Barba R$ 85 / 60 min; Low Fade ou Navalhado R$ 60 / 60 min; Pézinho R$ 20 / 15 min; Sobrancelha R$ 20 / 15 min.
- Profissionais iniciais: Felipe e Vitória.
- Horários iniciais: domingo fechado; segunda 13h30–20h; terça a sexta 9h–20h; sábado 9h–17h.

Serviços, preço, duração, profissionais, horários e dados comerciais não devem ser hardcoded em componentes do frontend. Eles precisam ser configuráveis na área administrativa ou no banco.

## 2. Fontes técnicas e o que aproveitar

### P13 — principal referência de produto e UX

Repositório: https://github.com/Ruan2R/P13-AGENDAMENTO-BARBEARIA

Padrões úteis identificados:

- fluxo progressivo de agendamento;
- seleção, edição e remoção de múltiplos procedimentos;
- escolha de profissional específico ou “Sem preferência”;
- consulta de horários;
- confirmação em lote;
- agrupamento dos procedimentos no painel administrativo;
- gestão de serviços, profissionais, horários e bloqueios;
- abertura do WhatsApp com mensagem preparada e geração de arquivo `.ics`.

Pontos que não devem ser copiados sem revisão:

- grade de disponibilidade atual em passos de 30 minutos;
- ausência de entidade própria para clientes e de entidade própria para o atendimento agrupado;
- ausência de snapshots completos de preço/nome/duração dos serviços no histórico;
- regras de negócio e rotas concentradas em arquivos grandes;
- ausência de scripts de testes automatizados declarados no `package.json` do P13;
- reforçar segurança de produção, controle de abuso e validação de origem.

### P14 — principal referência de arquitetura e operação

Repositório: https://github.com/Ruan2R/P14-SISTEMA-DANY (repositório privado do proprietário do projeto).

Padrões úteis identificados no código:

- React + TypeScript + Vite;
- servidor Node.js com módulos ES e API REST na mesma origem;
- separação de regras de domínio, camada HTTP, autenticação e armazenamento;
- adaptador local de desenvolvimento e armazenamento MySQL na produção;
- schema inicial SQL e migrações incrementais;
- autenticação por ID, hash de senha, cookie `HttpOnly`, checagem de origem e limitação de tentativas;
- testes automatizados com `node:test`, scripts de typecheck e build;
- checklist de deploy, verificação de variáveis e procedimento de seed/backups.

Limites conhecidos do P14 que também precisam ser tratados como decisões explícitas:

- o gerenciador de revogação de sessões está em memória e foi documentado para uma única instância; se houver múltiplas instâncias, será preciso usar sessões compartilhadas;
- o limitador usa o IP observado pelo processo e exige validação correta do proxy da hospedagem;
- conectar ao MySQL não cria automaticamente schema ou migrações;
- JSON local não deve ser considerado equivalente ao banco relacional nem usado como persistência de produção.

Não reaproveitar dados, serviços, marca, credenciais, hashes, tokens, chaves, `.env.local`, regras financeiras, sinal/Pix ou políticas exclusivas do negócio da Danielly.

## 3. Arquitetura recomendada

Recomendação para a primeira versão:

- **Frontend:** React + TypeScript + Vite.
- **Servidor/API:** Node.js com módulos ES; API REST `/api/*` e arquivos de frontend servidos na mesma origem.
- **Produção:** MySQL, usando `mysql2/promise` e variáveis de ambiente; schema e migrações versionados.
- **Desenvolvimento local:** manter uma camada de armazenamento substituível inspirada no P14. O adaptador local serve para desenvolver e testar fluxos, nunca como banco de produção. Regras críticas de concorrência precisam ter testes próprios e verificação de integração com MySQL antes do lançamento.
- **Autenticação inicial:** aproveitar o padrão de configuração segura de contas administrativas do P14 (ID + senha, hash `scrypt`, segredo de sessão fora do bundle e cookies seguros). Não construir gerenciamento de usuários completo no MVP. Confirmar antes da produção se a operação será de instância única ou se serão necessárias sessões compartilhadas.
- **UI:** não adicionar uma landing page. Uma área pública de agendamento direta e uma área administrativa protegida.

A arquitetura permanece de uma única instalação para a Boss67, sem multiempresa/SaaS nesta fase.

### Hospedagem

A Hostinger é a opção de referência porque foi usada no P14, mas a publicação do P15 só pode ser planejada após verificar o plano ativo e o ambiente disponível no hPanel. A documentação da Hostinger consultada em 13/10/2026 informa suporte a apps Node.js em planos Business/Cloud e documenta conexão a MySQL por variáveis de ambiente:

- https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/

Não presumir que qualquer plano de hospedagem estática/PHP permite manter um processo Node.js ativo. Não publicar nem alterar configuração de hospedagem sem autorização.

## 4. Fluxos principais

### Cliente

1. Abrir a área de agendamento.
2. Escolher um procedimento.
3. Escolher o profissional ou “Sem preferência”.
4. Adicionar outros procedimentos se necessário; editar/remover antes da confirmação.
5. Escolher a data e depois um horário disponível para cada procedimento.
6. Informar nome e WhatsApp, sem login de cliente.
7. Revisar os serviços, profissionais, horários, duração e preços individuais/total.
8. Confirmar pelo site.
9. Ver a confirmação e as opções de adicionar ao calendário ou falar com a Boss67.

### Atendimento com vários procedimentos

Todos os procedimentos escolhidos no mesmo pedido pertencem a um único atendimento (`booking_group`). A criação deverá ser atômica: ou todos os itens são gravados, ou nenhum. Validar todos os horários novamente no backend na confirmação, porque a disponibilidade mostrada na interface pode ter mudado.

Regras obrigatórias do backend:

- data não pode estar no passado;
- respeitar horário de funcionamento, dia fechado e bloqueios;
- respeitar a duração total de cada serviço;
- impedir conflito com outros atendimentos do mesmo profissional;
- impedir sobreposição entre procedimentos do próprio atendimento;
- validar que todos os itens são da mesma data;
- resolver “Sem preferência” para um profissional real disponível no servidor;
- rejeitar a operação inteira se qualquer item estiver indisponível;
- preservar os dados históricos do serviço no momento da reserva.

**Regra definida pelo proprietário: a grade oferece novos inícios em passos de 30 minutos, ancorados ao horário de abertura do dia. A duração real do serviço controla o fim do compromisso e nunca é arredondada. Exemplo: atendimento às 13:00 com duração de 45 minutos termina às 13:45; 13:30 conflita e o próximo horário padrão possível é 14:00. Todos os procedimentos do mesmo atendimento também devem usar a grade de 30 minutos e não podem se sobrepor. O exemplo anterior das 17:45 fica substituído por esta regra.

Para proteger a criação concorrente no MySQL, considerar uma transação com bloqueio coordenador (padrão `booking_mutex` do P14) em todo caminho de criação/edição de reserva. É simples e adequado para uma única barbearia de baixo volume; deve ser testado com requisições concorrentes. Todos os caminhos que alteram a agenda precisam seguir a mesma regra de lock.

### WhatsApp

- A confirmação do cliente acontece exclusivamente no site.
- Após a confirmação, o cliente pode iniciar conversa geral com a barbearia; isso não deve ser segunda etapa de confirmação.
- A área administrativa abre o WhatsApp com uma mensagem pré-preenchida, curta, sem emojis e com primeiro nome do cliente, data, procedimentos, profissionais, horários e total.
- Abrir o WhatsApp não comprova que a mensagem foi enviada. Como o briefing pede visibilidade de confirmação por WhatsApp, a UI deve permitir ao administrador marcar manualmente o envio após enviar a mensagem. Guardar horário dessa marcação e o usuário administrativo, se disponível. Não declarar que uma mensagem foi entregue automaticamente.

## 5. Área administrativa do MVP

**Implementado:**
- login/logout, sessão assinada, cookie `HttpOnly`, checagem de origem e limite de tentativas;
- agenda por data, filtros, indicadores e atendimentos agrupados;
- cancelamento/conclusão e registro manual de confirmação via WhatsApp;
- cadastro/edição/ativação de serviços e profissionais;
- edição do horário semanal com pausa opcional;
- bloqueio de um profissional por intervalo e bloqueio geral por intervalo/dia inteiro;
- validação de que bloqueios não conflitem com atendimentos confirmados;
- telas responsivas mobile-first para essas configurações.

**Implementado na versão atual:**
- diretório pesquisável de clientes, cadastro manual, normalização de WhatsApp e histórico de atendimentos/faltas;
- financeiro com resumo mensal, entradas/saídas, contas a pagar no mesmo módulo, recebíveis e registro manual de recebimento;
- promoções para serviço individual e combos de 2–6 serviços, com validade, preço e desconto congelados no atendimento;
- tabs de administração com navegação responsiva baseada no P14, preservando a identidade Boss67.

**Pendências:** revisão visual dos novos módulos em 320/393 px e desktop, typecheck/build completo, teste integrado com MySQL, revisão final de segurança e backup/restauração. Não há integração bancária nem múltiplas unidades nesta fase.

## 6. Modelo inicial do banco

### `customers`

- `id` UUID;
- `name`;
- `phone_normalized` único, somente dígitos com padrão nacional consistente;
- `created_at`, `updated_at`.

O cliente não precisa criar conta. Ao reservar, o backend identifica o cliente pelo telefone normalizado e atualiza o nome de forma controlada, evitando registros duplicados. Dados de clientes nunca serão expostos por endpoints públicos.

### `services`

- `id`, `slug`, `name`;
- `duration_minutes`;
- `price_cents`;
- `active`, `sort_order`;
- timestamps.

### `professionals`

- `id`, `name`, `role`;
- `avatar_url` opcional para uso futuro;
- `active`, `sort_order`;
- timestamps.

### `business_hours`

- `weekday` (0–6), `enabled`;
- `start_time`, `end_time`;
- `break_start`, `break_end` opcionais;
- timestamp de atualização.

### `date_blocks` e `professional_blocks`

`date_blocks` permite fechar toda a barbearia ou um intervalo em uma data específica. `professional_blocks` representa ausência/bloqueio de um profissional, com data, início, fim/momento de término e motivo opcional.

### `booking_groups`

- `id` UUID;
- `public_code` curto para referência ao cliente, sem permitir acesso aos dados privados apenas por adivinhação;
- `customer_id`;
- `booking_date` na data local do negócio;
- `status` para o atendimento inteiro;
- `total_price_cents` congelado;
- `whatsapp_confirmation_marked_at` e `whatsapp_confirmation_marked_by` opcionais;
- `created_at`, `updated_at`, `cancelled_at`, `completed_at` opcionais.

### `booking_items`

- `id`, `booking_group_id`;
- referência ao serviço e ao profissional;
- snapshots de `service_name`, `price_cents` e `duration_minutes` no momento da reserva;
- `starts_at` e `ends_at` armazenados consistentemente em UTC;
- índices para pesquisa por data, grupo, profissional e período;
- chaves estrangeiras e restrições adequadas.

O atendimento e os itens devem ser gravados na mesma transação. O estado do grupo é a fonte principal no MVP; não oferecer cancelamento parcial de um item. Esse modelo evita que cada procedimento apareça como atendimento independente no painel.

### Administradores

Para o MVP, a proposta é configurar IDs e hashes de contas administrativas por variáveis seguras, como no padrão do P14, sem uma tela de cadastro de administradores. A autenticação e os segredos não devem ir para o frontend, repositório, ZIP ou logs. Se for necessária gestão de usuários/permissões dentro do painel, isso vira uma decisão de escopo e requer uma tabela própria e uma UI administrativa.

## 7. Estrutura de pastas proposta

```text
P15-SISTEMA-BARBEARIA/
├── public/
│   └── assets/branding/       # logo oficial, favicon e assets aprovados
├── src/
│   ├── app/                   # router e composição da aplicação
│   ├── components/            # componentes compartilhados
│   ├── pages/                 # BookingPage, AdminLoginPage, AdminPage
│   ├── features/
│   │   ├── booking/           # fluxo e componentes do agendamento
│   │   └── admin/             # agenda, serviços, profissionais, clientes
│   ├── lib/                   # API client, telefone, datas e formatação
│   ├── types.ts
│   └── styles.css
├── server/
│   ├── index.mjs              # servidor e roteamento HTTP
│   ├── routes/                # rotas públicas e administrativas
│   ├── domain/                # agenda, validação e regras de negócio
│   ├── auth.mjs
│   ├── http-security.mjs
│   └── storage/               # interface, local e MySQL
├── database/
│   ├── schema.mysql.sql
│   └── migrations/
├── scripts/                   # configuração de admin e utilitários seguros
├── tests/                     # domínio, auth, segurança e armazenamento
├── docs/                      # decisões e checklist de deploy
├── .env.example
├── .gitignore
├── package.json
├── tsconfig*.json
├── vite.config.ts
└── README.md
```

O layout é uma proposta inicial; os nomes finais podem mudar conforme a implementação, mantendo as responsabilidades separadas.

## 8. API inicial proposta

### Pública

- `GET /api/health` — health check sem detalhes sensíveis;
- `GET /api/public/services`;
- `GET /api/public/professionals`;
- `GET /api/public/promotions`;
- `GET /api/public/availability?date=AAAA-MM-DD&serviceId=...&professionalId=...`;
- `POST /api/public/booking-groups` — cria o atendimento completo de forma atômica.

A resposta pública de confirmação deve trazer apenas os dados necessários para a tela de sucesso e para o arquivo `.ics`.

### Administrativa

**Implementados na primeira fundação:**
- `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`;
- `GET /api/admin/agenda?date=...&professionalId=...&status=...`;
- `PATCH /api/admin/booking-groups/:id/status`;
- `POST /api/admin/booking-groups/:id/whatsapp-confirmation` para registrar manualmente que a mensagem foi enviada.

Login e logout validam origem e sessão; agenda e ações sobre atendimento exigem sessão.

**Endpoints administrativos adicionais implementados:** clientes/histórico; cadastro, edição e ativação de serviços/profissionais; horário semanal e bloqueios; promoções; financeiro, contas a pagar e registro manual de recebimento de um atendimento. Não expor clientes, telefones ou dados administrativos pelos endpoints públicos.

## 9. Segurança, persistência e deploy

Requisitos de projeto:

- validar entradas no frontend e no backend;
- tratar preço, duração, profissional e horário como dados não confiáveis quando enviados pelo cliente;
- consultas SQL parametrizadas;
- senhas com hash forte e comparações seguras;
- cookie de sessão `HttpOnly`, `SameSite`, `Secure` em produção;
- checagem de origem nas operações mutáveis e estratégia CSRF compatível;
- rate limit em login e criação pública de reservas, com validação correta do IP atrás de proxy;
- cabeçalhos de segurança, limites de payload, timeouts e mensagens de erro sem stack trace;
- `Cache-Control: no-store` para respostas sensíveis;
- secrets somente no ambiente de servidor;
- schema e migrações aplicados explicitamente, sem assumir que uma conexão cria tabelas;
- backup automático do MySQL e teste de restauração antes de uso real;
- nunca misturar banco local, seed de demonstração e registros reais;
- controle de acesso administrativo antes de qualquer endpoint admin;
- endpoints administrativos e de login com `noindex` e sem dados sensíveis em HTML público.

O MVP é uma única instalação e uma instância Node.js. Não depender de arquivos locais graváveis na hospedagem como base de dados. A compatibilidade exata do plano Hostinger, a versão Node.js, as variáveis, o banco, os comandos de build/start e o domínio final devem ser verificados no painel antes de publicar.

## 10. Testes obrigatórios

Criar testes automatizados com `node:test` desde as primeiras etapas. Mínimos:

1. disponibilidade respeita horários da barbearia e duração;
2. bloqueios do negócio e do profissional removem horários;
3. horário passado e data inválida são rejeitados;
4. grade de inícios de 30 minutos, duração real dos serviços de 15/30/45/60 min e limite de fechamento;
5. “Sem preferência” resolve para um profissional disponível no servidor;
6. não permite conflito com agendamentos existentes;
7. procedimentos do mesmo grupo não se sobrepõem e têm uma data comum;
8. reserva com múltiplos itens é atômica: se um item falhar, nenhum é salvo;
9. requisições simultâneas ao mesmo intervalo não produzem dupla reserva;
10. alterações futuras no catálogo não alteram preço/duração/nome históricos;
11. cancelamento do grupo atualiza o atendimento inteiro;
12. autenticação, expiração de sessão, logout, origem inválida e rate limit;
13. endpoints públicos não retornam dados privados de clientes;
14. responsividade e fluxo completo do cliente em viewport móvel e desktop.

Antes da publicação, rodar e registrar o resultado real de `npm test`, `npm run typecheck` e `npm run build`. Teste local não equivale a teste de produção; fazer smoke tests em homologação e produção com dados claramente identificados como teste.

## 11. Ordem de implementação e estado

### Etapa 1 — fundação técnica (implementada)

- scaffold independente P15 com React/TypeScript/Vite + Node API;
- estrutura de domínio, seed local, schema MySQL e documentação;
- testes automatizados da grade de 30 minutos.

### Etapa 2 — núcleo do agendamento público (implementado para desenvolvimento local)

- catálogo inicial de serviços e profissionais servido pela API;
- seleção de múltiplos procedimentos e escolha de profissional para cada um;
- consulta de disponibilidade considerando funcionamento, duração, bloqueios e reservas existentes;
- grade de início a cada 30 minutos, sem arredondar a duração real;
- dados do cliente sem conta obrigatória, revisão, confirmação e código do atendimento;
- atendimento agrupado com snapshots de preço/duração/nome;
- persistência JSON local e adaptador MySQL preparados.

### Etapa 3 — núcleo administrativo e Etapa 4 — operação (implementadas para desenvolvimento local)

- login/logout, cookie `HttpOnly`, sessão assinada, expiração, revogação no logout e limite de tentativas;
- painel de visão geral, agenda diária agrupada e ações para cancelar/concluir atendimentos e registrar manualmente envio do WhatsApp;
- CRUD de serviços e profissionais, horários semanais com pausa e bloqueios individuais/gerais;
- prevenção de bloqueios conflitantes com atendimentos confirmados.

### Etapa 5 — estrutura administrativa inspirada no P14 (implementada no código)

- consulta do código P14 (`AdminPage.tsx`, `AdminShell`, navegação modular e estilos responsivos);
- Visão geral como entrada, breadcrumb, atalhos e navegação por módulos;
- identidade preta/amarela preservada, grade de três colunas no mobile e sidebar em telas maiores.

### Etapa 6 — Clientes e Financeiro (implementada no código; build ainda pendente)

- diretório de clientes com busca por nome/WhatsApp, cadastro manual, edição de nome e histórico agrupado;
- API administrativa de clientes e histórico, usando o WhatsApp normalizado para evitar duplicatas;
- financeiro manual com filtro mensal, entradas/saídas, resultado e contas a pagar;
- marcar uma conta como paga cria uma única saída vinculada, protegida contra exclusão manual;
- não há associação automática entre reserva/conclusão e receita, nem integração bancária;
- schema inicial e migração MySQL para `financial_entries` e `payables`.

### Etapa 7 — aprofundamento da experiência P14 em Agendamentos (implementada no código; build ainda pendente)

- filtros “Próximos”, “Confirmação pendente” e “Todos”, busca por cliente/WhatsApp/código/serviço e opção de imprimir;
- cartões agrupados por atendimento e ações de WhatsApp e mudança de status;
- “Confirmação pendente” significa que o envio via WhatsApp ainda não foi marcado manualmente; não indica que o site tenha deixado a reserva sem confirmação.

### Etapa 8 — polimento mobile, recebíveis e promoções/combos (implementada no código; build ainda pendente)

- A agenda usa um único botão de ícone do WhatsApp com mensagem pré-formatada e legenda que orienta abrir/enviar/registrar manualmente a confirmação.
- Campos de horário refinados para o iPhone 16 (393 px), com rótulos e inputs organizados em duas colunas que não extrapolam o cartão.
- Financeiro reúne formulário de conta a pagar e diretório de contas no mesmo bloco.
- Atendimentos confirmados entram em “Valores a receber” ao término do último procedimento; status “Concluído” torna-os elegíveis de imediato. A aba atualiza a lista a cada 30 segundos enquanto aberta, mas receita só é lançada quando o administrador confirma o recebimento.
- Promoções individuais e combos de 2–6 serviços são validados no backend. Preços/nomes promocionais ficam congelados em cada item reservado; campanhas ativas não podem disputar o mesmo serviço em intervalos de datas sobrepostos.
- Migração MySQL criada para campanhas/snapshots/recebimentos; ainda não testada com uma instância real.

## 12. Validação e pendências

- `npm test`: **43 testes aprovados**, abrangendo disponibilidade, conflitos, atomicidade, autenticação, cadastros, clientes/histórico, financeiro, recebíveis, promoções individuais/combos e preços congelados.
- A sintaxe/transpilação isolada das três telas React alteradas foi validada com TypeScript (`transpileModule`).
- `npm run typecheck` foi tentado, mas não concluiu porque React, React Router e os tipos do Node não estão instalados neste ambiente. `npm install` expirou repetidamente. Portanto, o typecheck completo e `npm run build` precisam ser executados na máquina de desenvolvimento após uma instalação bem-sucedida.
- O adaptador MySQL está preparado, mas precisa de teste contra uma instância real/dedicada com schema e migração aplicados.
- Ainda faltam revisar visualmente os módulos de financeiro e promoções em 320/393 px e desktop, executar testes de browser automatizados, validar cenários concorrentes com MySQL real e concluir a revisão de segurança/privacidade, backup e restauração.
- `NODE_ENV=production` permanece bloqueado nesta etapa.

## 13. Princípio de trabalho

Antes de mudanças grandes, explicar o objetivo, os arquivos afetados e o impacto. Implementar em pequenos lotes, preservar os repositórios P13 e P14, não alterar repositórios diretamente sem autorização e registrar quais testes foram realmente executados. Nenhuma credencial, migração de produção, deploy ou operação destrutiva deve ocorrer sem autorização explícita.

## Estado atual — versão 0.8.0

O núcleo público e a administração estão em desenvolvimento local. A administração inclui Visão geral, Agendamentos no padrão do P14, Clientes/histórico, Serviços, Profissionais, Horários, Bloqueios, Financeiro com recebíveis e Promoções individuais/combos. A suíte Node tem 43 testes aprovados nesta versão; a sintaxe/transpilação de nove arquivos TypeScript/TSX foi validada sem diagnóstico. No Financeiro, valores a receber, contas cadastradas e movimentações começam recolhidos, e Resultado do mês ocupa a largura integral abaixo dos quatro indicadores. Os cards de promoções tiveram sua hierarquia visual refinada. O typecheck/build completo e o teste integrado MySQL permanecem pendentes, pois as dependências não puderam ser instaladas neste ambiente. A publicação está bloqueada. Nenhuma alteração foi feita nos repositórios P13 ou P14 e nada foi publicado no GitHub.


## Atualização de interface 0.8.0

- No Financeiro, os quatro indicadores (entradas, saídas, valores a receber e contas a pagar) aparecem primeiro; o Resultado do mês ocupa a linha inteira abaixo.
- A lista de valores a receber, a lista de contas cadastradas e o histórico de movimentações começam recolhidos e só expandem mediante ação do usuário. Os formulários de movimentação e de conta também permanecem fechados até solicitação.
- A lista de promoções recebeu hierarquia visual de estado, tipo, validade, economia e comparação de preço normal/promocional, com ajustes para iPhone 16 e telas estreitas.
