# P16 — Modelo de dados inicial (Etapa 04)

O schema `database/schema.mysql.sql` é uma proposta versionada para revisão. **Não execute em uma base com dados reais ainda**: falta confirmar algumas regras comerciais, implementar o backend e validar o schema na versão MySQL do ambiente de hospedagem.

## Entidades

| Entidade | Objetivo |
|---|---|
| `admin_users` | Contas internas, login ID, hash de senha, perfil e status ativo. |
| `admin_sessions` | Sessões com hash do token, validade e revogação. |
| `products` | Catálogo, custo/preço unitário, unidade, estoque atual e mínimo. |
| `stock_movements` | Livro-razão do estoque: compras, vendas, consumo, ajustes, perdas e devoluções. |
| `financial_entries` | Entradas e saídas efetivamente recebidas/pagas, com data e vínculo de origem. |
| `payables` | Contas a pagar, vencimento e ligação única à saída criada quando paga. |
| `receivables` | Valores a receber, vencimento e ligação única à entrada criada quando recebida. |
| `orders` | Pedido interno, número, estado operacional e total registrado. |
| `order_items` | Itens do pedido com snapshots de nome, custo e preço para preservar histórico. |
| `order_payments` | Recebimentos associados a pedidos, permitindo mais de um pagamento parcial. |
| `audit_logs` | Histórico de ações administrativas importantes. |

## Convenções

- Sufixo `_cents`: valor em centavos inteiros. Exemplo: `R$ 12,34` = `1234`.
- Sufixo `_milli`: quantidade em milésimos. `1000` = `1,000` unidade/base unitária.
- Datas de negócio são `DATE`; horários de auditoria/sessão são `DATETIME` em UTC, a converter no backend.
- UUID textual (`CHAR(36)`) para identificadores e índices nas consultas comuns.
- `source_type` + `source_id` conecta lançamentos e movimentos ao evento que os originou, permitindo deduplicação. O backend também deve controlar a idempotência em transações, não depender só da interface.
- Linhas históricas preservam snapshot do nome/preço/custo mesmo se o cadastro do produto mudar depois.

## Transações obrigatórias no backend

1. **Pagar conta:** bloquear/validar conta pendente, criar saída vinculada, marcar a conta como paga e registrar auditoria na mesma transação SQL.
2. **Receber valor:** bloquear/validar recebível pendente, criar entrada vinculada, marcar como recebido e registrar auditoria na mesma transação.
3. **Registrar pedido:** validar e congelar itens e valores, criar cabeçalho/itens e registrar auditoria numa transação.
4. **Alterar estoque:** bloquear produto, verificar saldo, gravar movimento, atualizar saldo e auditar numa transação.
5. **Concluir pagamento de pedido:** criar pagamento/entrada e recalcular estado financeiro sem confundir com o estado de preparo.

A aplicação precisa usar transações e constraints do banco como última proteção contra cliques duplos, concorrência e repetição de requisições.
