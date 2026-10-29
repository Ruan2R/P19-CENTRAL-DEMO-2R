# Etapa 08 — Usabilidade e exclusões seguras

## Objetivos

1. Agrupar o catálogo por finalidade: revenda ou preparo na hora.
2. Melhorar leitura e interação em telas estreitas sem piorar a experiência desktop.
3. Explicar explicitamente os valores do caixa.
4. Adicionar remoção de registros que ainda não geraram efeitos financeiros e preservar eventos históricos já concluídos.

## Regras técnicas de exclusão

### Contas a pagar

`DELETE /api/admin/finance/payables/:id` permite excluir somente contas pendentes. Se a conta estiver paga ou possuir `expenseEntryId`, responde HTTP 409 e mantém os dados financeiros intactos.

### Valores a receber

`DELETE /api/admin/finance/receivables/:id` permite excluir somente valores pendentes. Se já recebido ou com `incomeEntryId`, responde HTTP 409 e mantém o histórico.

### Produtos

`DELETE /api/admin/products/:id` remove definitivamente o produto quando não há movimentações de estoque nem pedidos que o referenciem. Se houver histórico, marca `active = false` e a listagem de catálogo deixa de retornar o produto. Isso evita quebrar referências existentes. O backend mantém os dados históricos.

Todas as mutações são registradas na auditoria local. O fluxo continua sendo apenas para desenvolvimento local; ainda falta autenticação de servidor antes de qualquer uso com dados reais.

## Interpretação financeira

O saldo mostrado é o fluxo de caixa registrado no mês: entradas efetivamente recebidas menos saídas efetivamente pagas. Contas a pagar e valores a receber pendentes são mostrados separadamente. A margem do catálogo é uma estimativa unitária e não substitui cálculo de lucro líquido.

## Testes acrescentados

- Excluir conta pendente sem criar movimentação de caixa.
- Impedir exclusão de conta paga.
- Excluir valor a receber pendente e impedir exclusão depois de recebido.
- Excluir produto sem referências e arquivar produto com histórico.
