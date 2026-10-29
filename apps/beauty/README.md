# P18 — Sistema Ana Amaral

Cópia independente do projeto P17-SISTEMA-FER, preparada como base técnica para o sistema da Ana Amaral — Lash Designer.

## Identidade
- Marca: Ana Amaral — Lash Designer
- Slogan: Olhar que realça a sua beleza
- Paleta: branco, cinza claro, cinza médio, grafite e prata acetinada
- WhatsApp informado: +55 67 9858-0350 (link: https://wa.me/556798580350)

## Desenvolvimento
1. Instale Node.js 22 LTS.
2. Execute `npm ci`.
3. Copie `.env.example` para `.env.local` quando necessário.
4. Execute `npm test`.
5. Execute `npm run typecheck`.
6. Execute `npm run build`.
7. Execute `npm run dev` para iniciar o servidor local.

## Primeiro acesso administrativo
1. Em um terminal interativo, execute `npm run admin:setup`.
2. Crie duas contas com IDs distintos e senhas fortes diferentes (mínimo de 12 caracteres). Os IDs sugeridos são `RUAN-2R` e `ANA-001`; a Ana deve usar o ID que você configurar para ela.
3. Inicie com `npm run dev` e abra `http://localhost:5173/admin`. Entre usando o ID e a senha configurados.
4. Na aba **Serviços**, cadastre nome, categoria, duração, preço e se haverá sinal. Na aba **Horários**, ative os dias em que atenderá, defina abertura/fechamento e os intervalos e salve.
5. Saia do painel e entre de novo para confirmar que os dados persistem. No ambiente local, as informações ficam em `data/local-db.json`, somente neste computador.

O P18 começa intencionalmente sem serviços e com todos os dias desativados. Enquanto a Ana não cadastrar ao menos um serviço ativo e configurar horários, a agenda pública não deve ser divulgada para receber reservas.

## Inicialização sem dados de demonstração
- O ambiente local novo começa sem serviços cadastrados e com todos os dias da agenda desativados. A Ana pode cadastrar serviços e configurar dias/horários pela área administrativa quando decidir começar.
- Se o arquivo local tiver apenas o catálogo de exemplo do P17, sem reservas, clientes ou movimentações, a inicialização do P18 remove automaticamente esses exemplos. Qualquer serviço editado ou histórico existente é preservado.
- A flag `P18_TEST_FIXTURES=true` é usada somente pelos testes automatizados para carregar procedimentos fictícios. Não a configure no ambiente real.

## Importante
- O código de agendamento, painel administrativo, API, autenticação, testes e estrutura de banco foram reaproveitados do P17.
- Dados locais, credenciais, histórico, `.git`, `node_modules` e build compilado do P17 não foram copiados.
- Serviços, preços, horários, políticas, Pix e credenciais reais da Ana podem ser cadastrados depois pela área administrativa; antes de divulgar a agenda ao público, confirme e teste essas configurações.
- O número informado foi aplicado como link de WhatsApp, mas o restante das mensagens e regras comerciais será revisado junto com a Ana.
- O banco MySQL de produção deve ser exclusivo do P18; não apontar para o banco da Fer.

## SEO e organização de assets
- A página pública possui título e descrição próprios, além de metadados Open Graph e Twitter para compartilhamento.
- A rota administrativa ajusta o título e a descrição e recebe `noindex, nofollow`, evitando que a área restrita seja apresentada como página de agendamento nos resultados de busca.
- O favicon usa um SVG leve. O endereço canônico e a imagem absoluta de compartilhamento devem ser definidos somente quando o domínio público oficial for escolhido; não usar `localhost` nesses metadados.
- Assets de referência e imagens antigas sem uso no runtime foram removidos. Os assets transparentes usados atualmente pela marca foram preservados.

## Preparação para hospedagem (v0.3.3)
- A instalação base usa `npm ci` e respeita o `package-lock.json`. O script `prebuild` executa `npm install --include=dev` antes da compilação para garantir Vite, TypeScript e ferramentas de build mesmo se o ambiente de hospedagem omitir `devDependencies` na instalação inicial. Não mova essas ferramentas para `dependencies` nem remova esse `prebuild` sem revalidar o deploy.
- O servidor Node escuta a porta `PORT` fornecida pelo ambiente (padrão local: 5173) e valida a faixa antes de iniciar.
- Em produção, `GET /api/health` verifica a conexão MySQL e retorna somente `{ "ok": true }` (HTTP 200) ou `{ "ok": false }` (HTTP 503), sem vazar detalhes da conexão.
- Assets inexistentes em `/assets/*` e o favicon ausente retornam HTTP 404; o shell HTML inicial de `/admin` recebe `noindex, nofollow` antes de JavaScript executar.
- O GitHub Actions executa `check:server`, testes, typecheck e build a cada push na `main` e em pull requests.
- O projeto ainda não foi implantado: banco, chaves Turnstile, domínio e variáveis de produção devem ser configurados e testados no procedimento de hospedagem.


## Recursos de agendamento v0.4.0
- Agendamento público e manual com múltiplos procedimentos, soma de preço e duração, snapshot dos procedimentos e validação de disponibilidade no servidor.
- O próximo atendimento pode começar exatamente no minuto de término do anterior, desde que não haja sobreposição, intervalo, bloqueio ou restrição do expediente.
- Seletor de hora/minuto reutilizado do P17 e adaptado à identidade visual prata/grafite da Ana.
- Cadastro manual com autocomplete de clientes existentes e opção de lançamento sem telefone; o agendamento público continua exigindo telefone válido.
- Importação de contatos em vCard (.vcf), usando somente nome e telefone, com prévia, deduplicação e relatório de registros inválidos.
- Os filtros avançados, preenchimentos e demais funções administrativas do P18 foram preservados. Nenhum serviço, preço, horário, política ou dado da Fernanda foi copiado.
- Para banco MySQL P18 já inicializado com o schema anterior, aplicar uma vez a migração `database/migrations/20261029_allow_empty_phone_for_admin_appointments.sql` após backup verificado. Em banco novo, utilizar o schema atualizado. Não executar essa migração em outro banco nem durante o desenvolvimento local.
