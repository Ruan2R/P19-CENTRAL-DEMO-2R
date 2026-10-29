# P18 — checklist de publicação (Hostinger + MySQL)

Este checklist é um roteiro de preparação. **Não significa que a aplicação já foi publicada ou certificada**. Marque cada etapa somente depois de executar e verificar o resultado.

## Decisões da arquitetura

- Aplicação web e API no mesmo serviço Node.js e mesma origem.
- MySQL da Hostinger como banco de produção.
- `data/local-db.json` permanece apenas no ambiente local/testes.
- O Supabase não faz parte das dependências do runtime atual do P18; o sistema usa JSON local para desenvolvimento ou MySQL na preparação de produção.
- Uma instância da aplicação para um único negócio. Não compartilhar a mesma base entre negócios distintos.

## Antes de contratar

- [ ] Plano explicitamente compatível com aplicação Node.js persistente, não somente hospedagem PHP/estática.
- [ ] Node.js compatível com a versão recomendada pelo projeto (Node 22 LTS, ou versão LTS suportada pela Hostinger).
- [ ] MySQL/MariaDB disponível e acessível pela aplicação.
- [ ] Comandos de build e start personalizáveis; app pode escutar a variável `PORT` fornecida pela plataforma.
- [ ] Variáveis de ambiente de servidor persistem após redeploy/restart.
- [ ] Um único processo/instância atende o app. O gerenciador de sessões nesta versão é por processo; múltiplas instâncias exigem sessões compartilhadas persistentes.
- [ ] Conferir valor total antecipado, prazo contratado e valor de renovação no carrinho antes de pagar.

## Preparação local

- [ ] Fazer backup de `data/local-db.json` fora do projeto.
- [ ] `npm test` passa.
- [ ] `npm run typecheck` passa.
- [ ] `npm run build` passa no Windows.
- [ ] Executar `npm run admin:setup` em terminal interativo e criar IDs/senhas exclusivos para o proprietário e para Ana; não versionar nem enviar `.env.local`.
- [ ] Entrar em `/admin`, criar um serviço de teste, salvar um horário de funcionamento, atualizar a página e confirmar que ambos persistiram. Depois, apagar o serviço de teste e deixar os horários desativados até Ana confirmar a agenda real.
- [ ] Sair do painel e confirmar que a sessão antiga perde acesso; fazer login novamente.
- [ ] `npm run db:check-local-json` passa.
- [ ] Se já houver serviços, horários ou políticas reais da Ana configurados localmente e aprovados por ela, revisar uma cópia limpa usando `npm run db:make-production-seed -- --check-only` e só então gerar `data/production-seed.json` com `npm run db:make-production-seed`.
- [ ] Não importar seed enquanto o P18 deve permanecer sem serviços e horários ativos; o schema do MySQL já inicializa os sete dias desativados e uma linha de políticas provisórias.
- [ ] Se houver seed autorizado, conferir que clientes, bloqueios, promoções, agendamentos, lançamentos financeiros e contas a pagar estão zerados. Não levar dados de teste do P17.
- [ ] Manter o `data/local-db.json` original intacto para referência e testes; nunca reutilizá-lo como arquivo de produção.

## Banco MySQL dedicado

- [ ] Criar um banco exclusivo para o P18 e um usuário dedicado com privilégios somente nesse banco.
- [ ] Definir senha forte, aleatória e exclusiva; não reutilizar credenciais de outras aplicações.
- [ ] Executar `database/schema.mysql.sql` uma vez no banco novo.
- [ ] Configurar temporariamente as credenciais MySQL localmente em `.env.local` (arquivo já ignorado pelo Git). Não enviar esse arquivo no ZIP/repositório.
- [ ] Somente se houver um seed aprovado: fazer dry-run contra o banco vazio usando `npm run db:import-local-json -- --dry-run --file data/production-seed.json`.
- [ ] Conferir os contadores do dry-run e comparar com o seed; não prosseguir se houver diferença ou erro.
- [ ] Só após conferir o alvo, executar a primeira carga com `npm run db:import-local-json -- --apply --file data/production-seed.json`. Caso não haja seed aprovado, pular essa importação.
- [ ] Rodar uma consulta de contagens no banco e comparar serviços, horários e políticas. Confirmar que clientes/agendamentos/financeiro começam vazios.
- [ ] Manter backup da base antes de qualquer reimportação; o importador é para carga inicial e **não** é sincronização contínua.

## Variáveis de ambiente da aplicação

Configurar pelo painel seguro da hospedagem, não no Git:

- `NODE_ENV=production`
- `HOST=0.0.0.0` (somente se compatível com o runtime da Hostinger)
- `PORT` conforme fornecido/solicitado pela plataforma
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`
- `ADMIN_USERS_JSON` e `AUTH_SECRET` gerados por `npm run admin:setup` em terminal seguro
- `TURNSTILE_SECRET_KEY` (secreta, somente no servidor)
- `VITE_TURNSTILE_SITE_KEY` (pública, necessária no build frontend)

`ADMIN_USERS_JSON`, `AUTH_SECRET`, `DB_PASSWORD` e `TURNSTILE_SECRET_KEY` nunca devem usar prefixo `VITE_`, entrar no bundle do frontend ou ser commitados. O gerador de acesso grava configuração localmente em `.env.local`; use os valores necessários para configurar o painel da hospedagem, sem enviar `.env.local` inteiro.

A `VITE_TURNSTILE_SITE_KEY` é incorporada ao frontend no build. Defini-la apenas depois do build não altera o bundle; configure-a no ambiente de build e gere `dist` novamente quando necessário. Configure o domínio final também no painel do Turnstile.

## Build e start da hospedagem

Instalação de dependências: `npm ci`. Comando de build: `npm run build`; o `prebuild` automaticamente executa `npm install --include=dev` para garantir Vite/TypeScript caso a instalação inicial omita dependências de desenvolvimento. Confira essa etapa nos logs do deploy.

Comando de start: `npm start`.

O servidor serve `dist` e `/api/*` pela mesma aplicação. Não publicar `dist` como site estático isolado: a API Node.js e o banco também são necessários.

## Requisitos para liberar tráfego real

- [ ] HTTPS ativo e domínio correto; confirmar cookie de sessão `Secure`.
- [ ] `GET /api/health` retorna HTTP 200 com `{ "ok": true }` e consegue consultar o MySQL; se o banco estiver indisponível, o endpoint retorna HTTP 503 sem expor detalhes.
- [ ] Login com os IDs individuais; testar logout e acesso negado após logout.
- [ ] Turnstile funcional no domínio publicado, sem expor a chave secreta.
- [ ] Testar criação de reserva, prevenção de horários sobrepostos e fuso `America/Campo_Grande`.
- [ ] Testar promoção, preço congelado na reserva, sinal, saldo e cancelamento em ambiente de produção antes de abrir ao público.
- [ ] Conferir que nenhum endpoint público retorna telefone, notas internas, lista de clientes ou dados financeiros.
- [ ] Validar o IP real visto pela aplicação atrás do proxy Hostinger antes de liberar o rate limit. Não confiar cegamente em `X-Forwarded-For`; aceitar cabeçalhos encaminhados somente conforme documentação do proxy confiável.
- [ ] Confirmar que a CSP não bloqueia o Turnstile, as fontes ou recursos usados pelo site.
- [ ] Configurar backups automáticos e fazer pelo menos um teste de restauração antes de abrir para clientes.
- [ ] Ter canal de contato, política de privacidade e textos finais aprovados pela Ana.
- [ ] Remover/desativar todas as reservas, clientes e lançamentos de teste antes de abrir a agenda.

## Limites conhecidos a resolver/confirmar na hospedagem

- O rate limiter atual usa `request.socket.remoteAddress`. Atrás de proxy reverso, esse endereço pode ser o proxy compartilhado; a origem real deve ser validada na Hostinger antes de produção.
- O gerenciador de sessões da atualização `session-manager.mjs` é intencionalmente por processo: logout revoga imediatamente o token naquele processo e restart invalida as sessões anteriores. Não implantar múltiplas instâncias/replicas sem substituir por sessão compartilhada persistente.
- Testes locais e build não substituem teste em produção, revisão de permissões do MySQL nem teste de restauração de backup.
