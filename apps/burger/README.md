# P16 — Sistema Adega do Copão

Sistema interno para apoiar a operação da Adega do Copão, com controle financeiro, catálogo e movimentação de estoque e, opcionalmente, gestão de pedidos.

## O que está incluído

- **Financeiro:** resumo de entradas e saídas efetivadas, movimentações, contas a pagar e valores a receber.
- **Produtos e estoque:** catálogo separado entre produtos de revenda e itens preparados na hora, níveis mínimos, movimentações manuais e histórico auditável.
- **Pedidos (módulo em avaliação):** ciclo de atendimento, vários produtos por pedido, numeração por expediente, baixa de estoque e integração do pagamento com o financeiro. Produtos cadastrados como unidade/porção exigem quantidade inteira tanto em pedidos quanto nas movimentações manuais; medidas como kg e litro permitem frações. A regra é aplicada no backend, além da interface. A opção Venda avulsa registra somente a baixa do estoque; a entrada de dinheiro deve ser lançada separadamente no Financeiro quando aplicável.
- **Relatórios de pedidos:** resumo diário ou mensal dos pedidos pela data de criação; o Financeiro continua sendo a referência para entradas e saídas pela data efetiva do movimento.
- **Interface responsiva:** foco em desktop, com ajustes específicos para uso em celular.

## Requisitos

- Node.js **22.12 ou superior**
- npm incluído com o Node.js

Verifique a versão:

```bash
node --version
npm --version
```

## Instalação e execução local

Na pasta raiz do repositório:

```bash
npm ci
```

Abra dois terminais na pasta do projeto.

Terminal 1 — API local:

```bash
npm run api
```

Terminal 2 — interface React/Vite:

```bash
npm run dev
```

Abra o endereço `http://127.0.0.1:5173`. A porta é fixa por compatibilidade com a API local; se estiver ocupada, libere-a antes de iniciar o Vite em vez de usar automaticamente outra porta.

## Verificações antes de sincronizar alterações

Execute estes comandos na raiz do projeto:

```bash
npm test
npm run typecheck
npm run build
```

O repositório também executa essas verificações automaticamente no GitHub Actions quando há push para `main` ou abertura/atualização de pull request. A execução online passa a ser a confirmação final para testes, tipagem e build.

## Persistência e dados

A API grava os dados operacionais em `data/local-db.json`. Esse arquivo é ignorado pelo Git e não deve ser substituído por arquivos de etapas incrementais. Antes de mudanças manuais ou atualizações maiores, faça uma cópia de segurança.

O comando `npm run demo:seed` adiciona exemplos fictícios de demonstração pela API local. Use-o conscientemente, pois os registros são gravados no banco local e não são descartados automaticamente.

## Estado atual e limites importantes

- O projeto continua em **desenvolvimento local**.
- O login existente é demonstrativo e não substitui autenticação real no servidor.
- A API é limitada a `127.0.0.1`/`localhost` e recusa iniciar quando `NODE_ENV=production`.
- Não exponha a API à rede nem use dados financeiros reais até que autenticação, autorização no backend, estratégia de implantação, backup e recuperação tenham sido deliberadamente implementados e validados.
- A decisão final sobre manter o módulo de Pedidos ainda pode ser tomada separadamente; por enquanto, ele permanece no projeto.

## Regra de fechamento do atendimento

O fechamento do expediente deve verificar apenas pedidos ativos vinculados ao expediente aberto. Registros antigos/legados sem `sessionId` permanecem no histórico e não podem bloquear indefinidamente o fechamento de novos expedientes. Os pedidos do expediente atual em preparação ou prontos continuam bloqueando o encerramento.

## Fluxo de trabalho

- Faça alterações incrementais e revise o diff antes de sincronizar.
- Preserve `data/local-db.json` e dados operacionais.
- Não introduza dependências sem necessidade.
- Priorize clareza, consistência entre frontend e API, integridade financeira/estoque e acessibilidade no celular.
