# Etapa 18 — Estado visual e elegibilidade das promoções

## Problemas tratados

A tela de serviços continuava exibindo preço riscado, preço promocional e nome da campanha em serviços que já haviam sido desmarcados. Isso dava a impressão de que a oferta continuava selecionada.

A lista de ofertas também precisava depender de campanhas realmente elegíveis para novos agendamentos, e não apenas de uma flag ativa.

## Alterações

- Os cartões de serviço não selecionados exibem somente o preço normal.
- O preço promocional e o nome da promoção aparecem como aplicados apenas para um serviço selecionado quando `promotionalPricing` confirma a elegibilidade com base na seleção e na data.
- A lista de ofertas só inclui campanhas ativas que cruzem a janela entre hoje e 60 dias, com serviços existentes/ativos, cardinalidade correta para oferta individual ou combo e preço promocional válido.
- A seção já existente continua condicionada a `spotlightPromotions.length > 0`; logo, desaparece se não houver campanhas elegíveis.

## Regras de preço mantidas

O backend permanece como autoridade do valor final. Os descontos válidos continuam dependendo dos serviços selecionados e da data reservada. Esta alteração corrige a representação visual de serviços desmarcados, sem criar opção de ignorar descontos que realmente se aplicam à reserva.

## Verificações neste ambiente

- `npm test`: 47 testes aprovados, 0 falhas.
- Transpilação sintática do TSX: validada separadamente.
- `npm run typecheck`/build não puderam ser concluídos neste ambiente porque as dependências React/React Router e as definições de tipos do Node não estão disponíveis integralmente. Executar os comandos na máquina de desenvolvimento após a aplicação do ZIP.
