# Migrações do P15

O schema inicial fica em `database/schema.mysql.sql`. O catálogo inicial revisável fica em `database/seed.initial.mysql.sql`.

Os dois arquivos devem ser revisados e executados manualmente em uma base MySQL dedicada ao P15 depois de confirmar serviços, preços, profissionais e horários com a Boss67. Nenhum deles é executado automaticamente ao iniciar o servidor.

Migrações incrementais devem usar nomes ordenáveis, por exemplo `20261013_add_booking_item_notes.sql`, e precisam ser revisadas e testadas em uma base descartável antes de aplicar em qualquer ambiente com dados.

## 20261014_finance_admin.sql

Cria as tabelas `financial_entries` e `payables` para a aba Financeiro. Antes de usar MySQL no P15, aplique a migração em uma base dedicada depois de gerar backup. O cadastro de clientes usa a tabela `customers` já prevista no schema inicial. Não há integração bancária: lançamentos de entrada são registrados manualmente e marcar uma conta como paga gera exatamente uma saída vinculada a essa conta.


## 20261014_promotions-and-booking-receipts.sql

Adiciona campanhas de serviço/combos, snapshots de preço promocional por procedimento e o tipo de receita `booking_receipt`. Em uma base existente, faça backup antes de executar. A migração de financeiro (`20261014_finance_admin.sql`) precisa estar aplicada antes, porque cria `financial_entries`. Em banco novo, use o schema completo em vez de reaplicar migrações que criam as mesmas colunas/tabelas.

Promoções ativas não podem sobrepor datas para o mesmo serviço, inclusive quando esse serviço faz parte de um combo. Os preços usados em reservas já criadas permanecem congelados no histórico. Recebimentos de atendimentos são entradas protegidas contra duplicidade e só são gravados após confirmação manual do pagamento.
