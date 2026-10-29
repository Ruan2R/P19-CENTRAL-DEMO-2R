# P18 v0.3.3 — Validação adicional do runtime

- Adicionado `npm run check:server` para verificar a sintaxe dos módulos Node.js e scripts de importação/seeds.
- O workflow de CI executa a checagem de sintaxe além dos testes, TypeScript e build.
- Ajustada a ordem do encerramento gracioso: o servidor deixa de aceitar conexões, o middleware Vite é fechado e as conexões ativas são drenadas antes do encerramento do pool MySQL.
