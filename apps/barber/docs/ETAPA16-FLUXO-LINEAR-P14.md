# P15 — Etapa 16: fluxo linear de agendamento

## Objetivo

Reduzir o esforço mental no agendamento público, tomando o P14 como referência de clareza e preenchimento vertical em uma página, mantendo a seleção de múltiplos procedimentos e regras próprias do P15.

## Alterações

- Serviços, profissionais, data/horários e dados do cliente aparecem em sequência em um único painel. Os blocos seguintes surgem quando há informação suficiente para usá-los; não existe mais a navegação por cinco telas distintas.
- As ofertas permanecem no topo. O botão **Agendar com esta oferta** adiciona os serviços necessários e ajusta a data selecionada para o início válido da campanha.
- Quando uma oferta estiver escolhida, a data mínima/máxima do calendário fica limitada ao período de promoção dentro da janela de reserva de até 60 dias. O cliente pode desbloquear outras datas, entendendo que isso pode retirar o desconto.
- O seletor de serviços mostra o preço promocional aplicado ao item quando houver, inclusive a parcela calculada de um combo.
- Depois da escolha de todos os horários, o mesmo painel mostra resumo, nome e WhatsApp, e o cliente confirma sem abrir uma tela de revisão separada.
- Se o cliente remover um procedimento que fazia parte da oferta selecionada, a restrição de datas é removida e a interface avisa que o desconto pode deixar de valer.

## Preservado

- A seleção de múltiplos procedimentos e “Sem preferência”.
- A grade de início a cada 30 minutos e duração real, sem sobreposição.
- As regras de disponibilidade e os preços calculados/validados pelo servidor.
- A atomicidade da reserva e a tela de confirmação com código.
- O catálogo e o painel administrativo; nenhuma alteração foi feita no P13, P14 ou diretamente no GitHub.

## Verificações realizadas neste ambiente

- `npm test`: **47 aprovados, 0 falhas**.
- Transpilação sintática TypeScript/TSX: sem diagnósticos.
- `node --check` nos arquivos `.mjs` em `server/` e `tests/`: passou.
- `npm install` expirou por limite de execução neste ambiente. O `npm run typecheck` completo e o `npm run build` não foram confirmados nesta etapa; executá-los na máquina de desenvolvimento.

## Roteiro manual

1. Selecionar uma promoção individual e confirmar que seu serviço é automaticamente selecionado.
2. Selecionar um combo e confirmar que os procedimentos incluídos são adicionados sem duplicar serviços já escolhidos.
3. Conferir que a data inicial é ajustada e que o calendário não permite escolher datas fora da validade selecionada.
4. Escolher uma data sem horários livres, mudar para outra data dentro da validade e validar os slots disponíveis.
5. Remover um procedimento incluído na oferta e confirmar que o calendário volta a aceitar outras datas e que a interface avisa sobre a condição promocional.
6. Reservar sem promoção para confirmar que o fluxo linear também funciona.
7. Conferir layout em 320, 393 e 430 px, tablet e desktop.
8. Executar `npm test`, `npm run typecheck` e `npm run build` após mesclar.
