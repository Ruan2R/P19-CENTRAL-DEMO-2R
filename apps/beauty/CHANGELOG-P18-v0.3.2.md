# P18 v0.3.2 — Preparação do projeto para hospedagem

- Removido o script `prebuild` que executava `npm install` durante `npm run build`; a instalação fica explícita e reprodutível com `npm ci`.
- Servidor valida a variável `PORT` antes de iniciar e usa o mesmo valor na escuta e nos logs.
- `GET /api/health` testa `SELECT 1` no MySQL em produção; responde somente com estado genérico HTTP 200/503, sem expor detalhes internos.
- Arquivos estáticos inexistentes em `/assets/*` e `/favicon.svg` retornam 404 em vez de responder com o HTML da aplicação.
- O favicon e assets de marca não recebem cache imutável de um ano; cache longo é reservado aos bundles sob `/assets/*` gerados com hash.
- Requisições HEAD não enviam corpo e o encerramento por SIGINT/SIGTERM aguarda conexões ativas antes de fechar Vite/MySQL.
- A resposta HTML inicial de `/admin` recebe título, descrição e `noindex, nofollow` antes de JavaScript executar.
- Atualizados os comentários do schema e as mensagens da ferramenta de seed para identificar o P18, não o projeto-fonte P17.
- Adicionado workflow do GitHub Actions para instalar com `npm ci`, executar testes, TypeScript e build em Node.js 22.
- Nenhum segredo ou domínio fictício foi adicionado ao repositório.
