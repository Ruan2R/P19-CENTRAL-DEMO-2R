# P16 — Etapa 06: integração da interface

A interface React chama a API por caminhos relativos `/api/...`. O servidor de desenvolvimento Vite encaminha esses caminhos para `http://127.0.0.1:3001`; isso evita depender de CORS entre as portas durante o desenvolvimento.

## Dados carregados

Ao entrar no protótipo, o frontend consulta saúde da API, dashboard mensal, produtos, movimentações de caixa do mês, contas a pagar, valores a receber e pedidos.

## Operações conectadas

- Criar lançamento manual de caixa.
- Criar produto e registrar estoque inicial.
- Registrar entrada/saída/ajuste/perda de estoque, com motivo obrigatório.
- Criar conta a pagar e registrar pagamento de forma idempotente via API.
- Criar valor a receber e registrar recebimento de forma idempotente via API.
- Criar pedido com itens/preços/custos snapshots no servidor e avançar status permitido.

Valores enviados são centavos inteiros nos campos monetários. A API verifica o catálogo e define o preço do pedido do lado do servidor.

## Segurança / limites

Esta etapa NÃO adiciona login real. Credenciais demonstrativas só controlam a interface e não autorizam nem bloqueiam chamadas ao backend. A API continua explicitamente restrita a desenvolvimento local. Antes de produção serão necessários usuários e sessões de servidor, senhas com hash forte, autorização por módulo/usuário, proteção CSRF/origem apropriada, revisão de rate limits/headers, banco adequado e testes de segurança.

Pedidos não baixam estoque nem criam entrada de caixa automaticamente. Recebimentos e pagamentos são ações explícitas separadas. A integração de painel de chamadas depende do equipamento físico.
