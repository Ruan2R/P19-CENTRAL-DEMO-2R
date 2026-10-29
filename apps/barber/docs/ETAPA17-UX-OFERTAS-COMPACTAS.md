# P15 — Etapa 17: Ofertas compactas e integradas

## Decisão de UX

O feedback da regressão manual identificou que o bloco promocional da Etapa 16 dominava a primeira dobra, repetia instruções e criava dois caminhos concorrentes (escolher uma oferta ou montar o atendimento). A Etapa 17 integra as promoções ao módulo de escolha dos serviços, inspirado na praticidade do P14.

## Alterações

- As promoções começam recolhidas em uma linha compacta com contagem e ação “Ver ofertas”.
- Ao expandir, o cliente consegue comparar serviços, valor original, preço promocional, economia e validade.
- “Usar oferta” e “Adicionar combo” selecionam os serviços relacionados sem pesquisa manual.
- A oferta recolhe depois da seleção e a página leva o cliente até os procedimentos adicionados.
- O destaque amarelo principal continua reservado à ação de confirmar o atendimento; os botões promocionais usam tratamento mais discreto.
- O texto inicial e a instrução da seção de serviços foram simplificados para reduzir mensagens repetidas.

## Regras preservadas

- Regras de negócio e rotas do backend não foram alteradas.
- O cálculo e a confirmação de preços promocionais continuam sendo feitos no backend.
- A escolha de uma promoção continua limitando o calendário ao período válido, dentro do horizonte de agendamento.
- O usuário pode remover um serviço e a interface avisa que o desconto pode deixar de valer.

## Validação pendente na máquina de desenvolvimento

```bash
npm test
npm run typecheck
npm run build
```

Em seguida, conferir a primeira dobra no viewport de 393 px e no de 320 px: a linha de ofertas deve ser compacta; ao abrir, os cartões precisam manter validade e preço legíveis, sem rolagem horizontal. Confirmar também o uso de oferta, seleção de serviços manual e reserva sem promoção.
