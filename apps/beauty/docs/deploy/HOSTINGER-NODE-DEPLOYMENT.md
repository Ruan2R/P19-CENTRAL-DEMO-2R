# P18 — Preparação e publicação na Hostinger

**Estado:** guia de implantação. A aplicação só deve receber tráfego real depois de concluir os testes finais desta lista. Não coloque segredos no GitHub nem compartilhe o arquivo `.env.local`.

## 1. Confirmar o plano e criar a aplicação Node.js

1. No hPanel, confirme que o plano permite criar uma **Node.js Web App**. A nomenclatura dos planos pode variar; não presuma que uma hospedagem antiga/ilimitada inclui o recurso só pelo nome do plano.
2. Use a integração com o repositório privado `Ruan2R/P18-SISTEMA-ANA`, branch `main`.
3. Se o assistente pedir o tipo de projeto e não detectar o runtime, escolha **Other**. O P18 usa um servidor HTTP Node.js próprio com o frontend Vite compilado; não é apenas um site estático.
4. Selecione Node.js 22 LTS.
5. Use os comandos do projeto:
   - Instalação inicial de dependências: `npm ci`
   - Build: `npm run build` (o ciclo `prebuild` executa `npm install --include=dev` antes da compilação)
   - Inicialização: `npm start`
   - Pasta de arquivos compilados, se solicitada: `dist`
   - Arquivo de entrada, se exigido pelo assistente: `server/index.mjs`
6. O `prebuild` foi incluído como proteção para o erro `tsc: command not found` observado no deploy do P17: garante as dependências de desenvolvimento durante a compilação sem movê-las para `dependencies`. Confira nos logs que a etapa executou com sucesso.
7. Não publique somente a pasta `dist` como site estático. O processo Node também serve a API `/api/*` e é necessário para login, agendamento e banco de dados.

O servidor escuta a porta fornecida pela variável `PORT` e valida sua faixa antes de iniciar. Não defina uma porta fixa diferente da que a plataforma fornece. O endpoint público `GET /api/health` verifica o acesso ao MySQL em produção e retorna HTTP 503 se o banco não estiver acessível. A aplicação atual foi desenhada para um processo Node por instância e não usa WebSockets nem workers persistentes.

### Estado observado no hPanel em 23/10/2026

- O plano exibido é **Unlimited** e o painel mostra **1/5** aplicações Node.js utilizadas. A documentação atual da Hostinger lista suporte a Node.js Web Apps em planos Business/Unlimited e limita esse grupo a cinco aplicações Node.js; os limites de processo e recursos são compartilhados no plano. Confirme os números novamente no painel antes de planejar escala.
- A aplicação já existente, `lavender-elephant-526438.hostingersite.com`, está conectada ao repositório **`P14-SISTEMA-DANY`**, branch `main`. Ela não é o P18.
- **Não usar “Reimplantar” na aplicação existente para publicar o P18.** Isso continuaria implantando o repositório P14 e poderia substituir o site errado. Criar uma segunda Web App Node.js no mesmo plano, sem desconectar nem alterar a aplicação P14.
- Fluxo observado na interface: **Sites → + Criar site → Web app Node.js**. Na nova aplicação, selecionar o repositório privado `Ruan2R/P18-SISTEMA-ANA` e branch `main`.
- Configuração de referência compatível com o repositório P18: framework `Other` se a Hostinger pedir classificação, Node.js `22.x`, diretório raiz `/`, instalação `npm ci`, build `npm run build`, start `npm start`. Se o painel oferecer um campo de diretório de saída estática, não configure o projeto como site estático: o processo Node precisa atender também `/api/*`.
- A integração com GitHub pode implantar automaticamente após novos pushes. Verifique o repositório, branch e commit exibidos na página da nova aplicação antes de confirmar o deploy.

## 2. Criar o banco MySQL antes de liberar a agenda

1. Crie um banco MySQL dedicado ao P18 e um usuário dedicado, com acesso somente a esse banco. Guarde nome, usuário e senha em local seguro.
2. Abra o phpMyAdmin e execute o arquivo `database/schema.mysql.sql` no banco novo, vazio. Não execute esse schema sobre outro banco com dados existentes.
3. O schema cria as tabelas, inicializa os sete dias como desativados e cria uma linha de políticas com textos provisórios; não cadastra serviços. Como o P18 começa intencionalmente sem serviços nem horários ativos, não importe dados de demonstração. A importação de seed é opcional e só deve ocorrer se você preparar e revisar dados reais da Ana no JSON local.
4. No seu PC, sincronize o projeto e confirme que os testes e o build passam:
   ```bash
   npm ci
   npm test
   npm run typecheck
   npm run build
   ```
5. **Somente se você já configurou dados reais da Ana no JSON local e deseja transferi-los**, inspecione o seed que será levado à produção:
   ```bash
   npm run db:make-production-seed -- --check-only
   npm run db:make-production-seed
   ```
   O segundo comando cria `data/production-seed.json` e não modifica `data/local-db.json`. Confira os contadores: o seed deve preservar somente serviços, horários e políticas e deixar clientes, promoções, bloqueios, agendamentos, lançamentos financeiros e contas a pagar vazios. Confira também os preços e a configuração antes de importar.
6. **Somente para a importação opcional de seed**, permita temporariamente o acesso remoto ao MySQL para **o IP público atual da sua conexão**, na seção Remote MySQL da Hostinger. Use o hostname externo mostrado no painel como `DB_HOST` somente durante a importação. Não use `127.0.0.1` para a conexão remota feita do seu PC. Se a Ana ainda não confirmou serviços/horários e o P18 deve continuar vazio, pule as etapas 5–8.
7. Com o banco de produção corretamente apontado em `.env.local` local, rode primeiro o dry-run:
   ```bash
   npm run db:import-local-json -- --dry-run --file data/production-seed.json
   ```
   Confira que o destino está vazio e os contadores correspondem ao seed. Só então execute:
   ```bash
   npm run db:import-local-json -- --apply --file data/production-seed.json
   ```
8. Remova a permissão de acesso remoto temporário no hPanel e retire as credenciais remotas do `.env.local`. Não deixe esse arquivo apontando para o banco de produção durante o desenvolvimento.
9. Confirme no phpMyAdmin as contagens. Antes de a Ana configurar os dados, zero serviços, sete dias desativados, uma linha de políticas provisórias e zero clientes/agendamentos/financeiro são o estado esperado.

**Importante:** o importador é para a carga inicial em um banco exclusivo/vazio, não para sincronizar o ambiente local com a produção. Ele registra o hash do arquivo importado na tabela de controle legada `p14_local_json_imports`; mantenha esse nome de tabela como está para compatibilidade com o código atual.

## 3. Preparar as variáveis da aplicação

Configure as variáveis no painel da Node.js Web App, não em arquivos comitados no Git. Valores sem segredos podem ficar em `.env.example`, mas não copie valores secretos para esse arquivo.

Obrigatórias no runtime de produção:

- `NODE_ENV=production`
- `DB_HOST` usando o hostname MySQL exibido no hPanel para esta aplicação; não presuma que `127.0.0.1` é o valor correto.
- `DB_PORT=3306`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD` com os dados do banco da mesma hospedagem
- `DB_CONNECTION_LIMIT=5`
- `ADMIN_USERS_JSON`
- `AUTH_SECRET` com pelo menos 32 caracteres
- `TURNSTILE_SECRET_KEY`

Obrigatória durante o build:

- `VITE_TURNSTILE_SITE_KEY`

Opcional, somente quando a Ana confirmar os dados do Pix:

- `VITE_PIX_KEY`
- `VITE_PIX_HOLDER`
- `VITE_PIX_QR_IMAGE_URL`

### Gerar os acessos administrativos

No seu ambiente local, execute `npm run admin:setup` em um terminal interativo. Crie senhas diferentes e fortes para a conta do proprietário e para a conta da Ana. O script grava hashes de senha e um `AUTH_SECRET` em `.env.local`.

Copie manualmente apenas os valores de `ADMIN_USERS_JSON` e `AUTH_SECRET` para os campos correspondentes do hPanel. **Não envie o arquivo `.env.local` inteiro para o GitHub ou para um ZIP**: ele pode conter outras configurações locais e segredos. Não compartilhe senhas, hashes ou chaves no chat.

### Configurar o Turnstile

1. No Cloudflare Turnstile, crie um widget de produção e permita somente o domínio público final (incluindo `www` apenas se for usado).
2. Cadastre a Site Key em `VITE_TURNSTILE_SITE_KEY` no ambiente de build.
3. Cadastre a Secret Key em `TURNSTILE_SECRET_KEY` no runtime Node, sem prefixo `VITE_`.
4. Faça um novo deploy depois de alterar qualquer variável `VITE_*`, pois ela é incorporada no frontend durante o build. As variáveis de runtime exigem que a aplicação seja reiniciada/reimplantada conforme o painel.

## 4. Fazer o deploy pelo GitHub

1. Confira que a branch `main` está no commit que você quer publicar e que o workflow do GitHub Actions passou.
2. Conecte o repositório privado e a branch `main` no painel da Hostinger.
3. Configure as variáveis de ambiente antes do build, principalmente `VITE_TURNSTILE_SITE_KEY`.
4. Faça o deploy e confira os logs de instalação, build e inicialização.
5. Confirme que a aplicação fica em estado Running e que o endereço provisório abre a tela de agendamento.
6. Antes de divulgar, conecte o domínio final e aguarde o HTTPS/certificado ativo. Confirme que o cookie de sessão usa `Secure` em produção.

## 5. Checklist de validação antes de abrir ao público

- O build usa dependências instaladas por `npm ci`; não há instalação secundária automática dentro de `npm run build`.

- [ ] `/agendar` abre e carrega os serviços e políticas do MySQL.
- [ ] Horários reais de funcionamento foram configurados e conferidos no painel; o seed local pode conter os dias desativados.
- [ ] Preços, durações, percentuais de sinal e promoções foram confirmados com a Ana.
- [ ] Login de cada administrador funciona; logout invalida a sessão e rotas administrativas sem login são bloqueadas.
- [ ] Criar uma reserva de teste guarda os dados no MySQL e respeita o fuso `America/Campo_Grande`.
- [ ] O backend rejeita reserva pública sem token Turnstile válido.
- [ ] Testar o fluxo de sinal, confirmação, cancelamento, conclusão, saldo e financeiro.
- [ ] Nenhuma rota pública retorna dados privados de clientes ou dados financeiros.
- [ ] Validar o IP remoto visto pelo rate limit atrás do proxy da Hostinger; não confiar em `X-Forwarded-For` sem confirmar a infraestrutura/proxy confiável.
- [ ] Fazer backup do banco e testar a restauração antes de abrir a agenda.
- [ ] Remover os dados usados nos testes de produção antes da divulgação.
- [ ] A Ana aprovou os textos, políticas, serviços, preços e informações de contato.

## Limites conhecidos

- A sessão e o rate limit ficam na memória de um processo. Não escale para múltiplas instâncias sem trocar por mecanismos compartilhados.
- O app depende do servidor Node em execução; publicar apenas os arquivos estáticos não basta.
- Um check verde no CI não substitui a validação no ambiente real da Hostinger/MySQL.
- Não configure integrações bancárias nem dados de Pix até a Ana fornecer e confirmar as informações.
