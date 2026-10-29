# P16 — API local e persistência JSON (Etapa 05)

## Limites desta etapa

A API foi construída para desenvolvimento local e usa `data/local-db.json`. Ela não implementa autenticação/sessão administrativa; por isso, escuta apenas em `127.0.0.1`, recusa origens web que não sejam as origens locais esperadas e não inicia quando `NODE_ENV=production`. Esses controles são barreiras de desenvolvimento, não uma arquitetura de segurança de produção. Não exponha a porta 3001 nem use dados reais.

A interface React ainda não está ligada à API. A integração dos formulários e carregamentos é uma etapa posterior.

## Inicialização

Na raiz do projeto:

```bash
node server/index.mjs
```

Por padrão, a API fica em `http://127.0.0.1:3001`. É possível mudar a porta com `P16_API_PORT`; a vinculação de host permanece local. O frontend Vite continua rodando separadamente com `npm run dev`.

## Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| GET | `/api/health` | Saúde, tipo de armazenamento e contagem de dados |
| GET | `/api/admin/dashboard?month=AAAA-MM` | Resumo de caixa, pendências, lançamentos recentes e estoque baixo |
| GET | `/api/admin/products` | Lista produtos com estoque, margem bruta unitária e alerta de estoque mínimo |
| POST | `/api/admin/products` | Cadastra produto e registra estoque inicial no histórico |
| PATCH | `/api/admin/products/:id` | Atualiza dados do produto sem alterar estoque |
| GET | `/api/admin/stock-movements?productId=...` | Consulta histórico do estoque |
| POST | `/api/admin/stock-movements` | Entrada, saída, devolução, perda ou ajuste do estoque |
| GET | `/api/admin/finance/entries?month=AAAA-MM` | Lista entradas/saídas efetivas de caixa |
| POST | `/api/admin/finance/entries` | Registra lançamento manual de caixa |
| GET | `/api/admin/finance/payables` | Lista contas a pagar |
| POST | `/api/admin/finance/payables` | Cadastra conta a pagar pendente |
| POST | `/api/admin/finance/payables/:id/pay` | Paga conta e cria uma única saída de caixa |
| GET | `/api/admin/finance/receivables` | Lista valores a receber |
| POST | `/api/admin/finance/receivables` | Cadastra valor a receber pendente |
| POST | `/api/admin/finance/receivables/:id/receive` | Recebe valor e cria uma única entrada de caixa |
| GET | `/api/admin/orders` | Lista pedidos internos |
| POST | `/api/admin/orders` | Cria pedido e congela nome/custo/preço dos itens |
| PATCH | `/api/admin/orders/:id/status` | Avança status conforme as transições permitidas |

Os identificadores são UUIDs criados no backend. As rotas usam centavos inteiros nos campos monetários; não envie strings como `"R$ 12,50"` para campos `amountCents`, `priceCents` ou `costCents`.

## Exemplos rápidos (Git Bash)

Saúde:

```bash
curl http://127.0.0.1:3001/api/health
```

Cadastrar produto de demonstração:

```bash
curl -X POST http://127.0.0.1:3001/api/admin/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Refrigerante lata","category":"Bebida","unit":"un","costCents":320,"priceCents":700,"stockQuantity":12,"stockMinimum":4}'
```

Registrar entrada manual:

```bash
curl -X POST http://127.0.0.1:3001/api/admin/finance/entries \
  -H 'Content-Type: application/json' \
  -d '{"direction":"income","description":"Venda balcão","category":"Vendas","amountCents":1250,"movementDate":"2026-10-15","paymentMethod":"Pix"}'
```

## Transações/idempotência da versão local

- Cada mutação opera sobre uma cópia do estado, serializa as gravações dentro do processo, grava arquivo temporário e renomeia ao concluir.
- Pagar conta ou receber valor registra a movimentação de caixa e atualiza a obrigação dentro da mesma transação de escrita local. Repetições da mesma ação são idempotentes.
- A fila protege operações deste único processo. Não é um bloqueio multi-processo nem substitui as transações e constraints MySQL para produção.
- Os registros de auditoria nesta etapa identificam o ator como `local-development`; isso deverá ser substituído pelo ID da sessão autenticada antes de uso real.

## Estoque e pedidos

O cadastro inicial gera movimento de abertura. Ajustes de estoque exigem motivo e criam histórico. Pedidos usam preço/custo lidos do catálogo no servidor, ignorando valores monetários enviados pelo cliente. O status do pedido não reduz estoque e não gera recebimento automaticamente, pois ainda é preciso confirmar com o estabelecimento a política de consumo/baixa e cancelamento.

## Testes

```bash
node --test tests/*.test.mjs
node --check server/index.mjs
node --check server/api.mjs
node --check server/json-store.mjs
```

A suíte desta etapa foi executada no ambiente de preparação: 29 testes passaram (10 testes de API/persistência e 19 testes de domínio).
