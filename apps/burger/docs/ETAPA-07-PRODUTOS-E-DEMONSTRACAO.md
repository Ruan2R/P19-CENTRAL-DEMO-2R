# Etapa 07 — produtos e dados de demonstração

## Objetivo

Deixar o catálogo simples para o funcionamento da Adega do Copão e fornecer dados fictícios para testar os fluxos financeiros e de pedidos.

## Tipos do MVP

1. `resale`: mercadoria pronta para revenda, com custo unitário, preço de venda, quantidade e mínimo de reposição.
2. `prepared`: produto preparado sob demanda, com preço de venda e custo estimado unitário, sem contagem de estoque do produto final.

Não foram implementados ingredientes, ficha técnica ou consumo automático por receita. Isso evita um controle de estoque mais complexo antes de confirmar que o estabelecimento precisa dele.

## Exemplos fictícios de catálogo

| Produto | Tipo | Custo de exemplo | Venda de exemplo | Estoque inicial | Observação |
|---|---|---:|---:|---:|---|
| Refrigerante lata 350 ml | Revenda | R$ 2,40 | R$ 5,00 | 48 un. | Controla quantidade |
| Água mineral 500 ml | Revenda | R$ 1,10 | R$ 3,00 | 36 un. | Controla quantidade |
| Cerveja lata 350 ml | Revenda | R$ 3,50 | R$ 6,00 | 48 un. | Controla quantidade |
| X-Burguer | Preparado | R$ 8,50 (estimado) | R$ 20,00 | Não se aplica | Sem estoque do lanche pronto |
| X-Bacon | Preparado | R$ 11,00 (estimado) | R$ 26,00 | Não se aplica | Sem estoque do lanche pronto |
| Batata frita pequena | Preparado | R$ 3,50 (estimado) | R$ 10,00 | Não se aplica | Sem estoque do item pronto |
| Copão tradicional | Preparado | R$ 10,50 (estimado) | R$ 25,00 | Não se aplica | Estimativa manual; sem ficha de receita |
| Drink vodka com energético | Preparado | R$ 9,00 (estimado) | R$ 22,00 | Não se aplica | Estimativa manual; sem ficha de receita |

Todos os valores são apenas ilustrativos e precisam ser confirmados pelo estabelecimento antes de qualquer uso comercial.

## Dados de demonstração

`npm run demo:seed` chama `POST /api/admin/demo-seed`. A carga usa uma versão identificada para não inserir novamente os mesmos exemplos ao executar o script uma segunda vez. Ela acrescenta dados à base atual; por isso, faça backup de `data/local-db.json` antes de executar. O seed cria lançamentos financeiros e exemplos de contas/pedidos independentes do estoque inicial, para demonstrar cada módulo. Não atribuir cada movimentação financeira automaticamente a cada produto demonstrativo.

## Regras de caixa

O resumo de entradas menos saídas é fluxo de caixa registrado (recebimentos menos pagamentos), não lucro líquido. A margem de catálogo é simplesmente preço de venda menos custo cadastrado; para preparados, esse custo é estimado manualmente. Não descontar automaticamente o custo estimado como saída de caixa a cada venda, pois isso pode duplicar a compra de mercadorias/insumos já registrada.

Nesta etapa, pedidos não decrementam quantidades de revenda nem geram entrada de caixa automaticamente. Definir o instante de baixa (entrega), tratamento de cancelamentos e confirmação de pagamento numa fase seguinte e validar com testes antes de habilitar.
