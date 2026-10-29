# P18 — primeiro acesso administrativo e validação

## Criar os acessos

No terminal do projeto, execute:

```bash
npm run admin:setup
```

Crie IDs distintos para o proprietário e para Ana. As senhas precisam ter pelo menos 12 caracteres, ser diferentes entre si e não devem ser compartilhadas no chat. O assistente grava os hashes em `.env.local`; esse arquivo é local, ignorado pelo Git e nunca deve ser enviado em ZIP nem commitado.

Depois, inicie o projeto com `npm run dev` e abra `http://localhost:5173/admin`. Use o ID e a senha da Ana para validar o acesso dela. Se o servidor já estava em execução quando as credenciais foram configuradas, reinicie-o.

## Cadastrar serviços e horários

1. Em **Serviços**, crie um serviço com nome, categoria, duração e preço. O sinal é opcional; deixe em 0% se a Ana não for cobrar sinal. O serviço precisa estar ativo para aparecer na agenda pública.
2. Em **Horários**, habilite somente os dias em que Ana atenderá. Preencha abertura, fechamento e, quando houver, o intervalo; salve as alterações.
3. Atualize o painel e confirme que serviço e horário continuam salvos. Saia e entre novamente para validar a sessão.
4. Remova o serviço usado no teste e deixe os dias desativados até Ana decidir sua agenda real.

A configuração inicial sem serviços e com todos os dias desativados é intencional: impede que a agenda pareça disponível antes de os dados comerciais serem confirmados. Não divulgue o link de agendamento enquanto não houver serviços ativos, horários reais e textos aprovados.

## Preparação da Hostinger

- Crie uma **nova aplicação Node.js** para o repositório `Ruan2R/P18-SISTEMA-ANA`, branch `main`. Não reutilize nem reimplante a aplicação do P14.
- Use Node.js 22.x, instalação `npm ci`, build `npm run build` e start `npm start`. Não publique apenas `dist` como site estático: o processo Node também atende `/api/*`.
- Crie um banco MySQL dedicado ao P18, execute `database/schema.mysql.sql` somente no banco novo e configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `DB_CONNECTION_LIMIT`.
- Configure `NODE_ENV=production`, `ADMIN_USERS_JSON`, `AUTH_SECRET` e `TURNSTILE_SECRET_KEY` nas variáveis seguras da hospedagem. A `VITE_TURNSTILE_SITE_KEY` precisa estar disponível durante o build. Não coloque segredos em variáveis `VITE_*`.
- Execute `npm run admin:setup` localmente e copie para o painel de hospedagem somente os valores necessários de `ADMIN_USERS_JSON` e `AUTH_SECRET`; nunca copie o `.env.local` inteiro.
- Antes de liberar clientes, teste login/logout, uma reserva completa no MySQL, disponibilidade por horário, Turnstile, fluxo de sinal/saldo, privacidade dos endpoints e backup/restauração.

## Estado de validação

A validação de API do P18 foi executada em ambiente de teste isolado: login da conta Ana, sessão protegida, início sem serviços/horários habilitados, criação de serviço com preço, gravação de horário, persistência e revogação da sessão após logout passaram. Isso não substitui o teste da interface no navegador nem o deploy real na Hostinger.
