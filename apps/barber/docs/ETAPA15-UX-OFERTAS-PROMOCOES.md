# P15 — Etapa 15: experiência de escolha de ofertas

## Objetivo

Tornar a promoção uma ação clara, e não apenas uma informação visual no início do agendamento. O cliente deve entender que pode adicionar a oferta inteira e ver os procedimentos selecionados na lista de serviços.

## Alterações na interface

- O cabeçalho passou a orientar o cliente a **escolher uma oferta**.
- A descrição explica em linguagem direta: adicionar a oferta inclui os serviços no atendimento; o desconto depende de escolher uma data dentro da validade.
- Cada cartão tem um botão explícito: **Adicionar combo** ou **Adicionar oferta**.
- Ao acionar o botão, os serviços ainda não selecionados são adicionados sem duplicar os já presentes. A tela rola até a lista de serviços e mostra as seleções destacadas.
- Um combo parcialmente selecionado permite **Completar combo (x/y)**. Quando todos os serviços já estão selecionados, o botão muda para **Adicionado** e fica desabilitado.
- A mensagem de retorno informa que os serviços foram adicionados e que o desconto é aplicado após escolher uma data válida.
- As datas da promoção ficam mais explícitas; campanhas futuras mostram início e fim.
- O layout foi compactado para reduzir o espaço vertical dos cartões no celular.

## Regras que continuam valendo

- A promoção não altera nem contorna disponibilidade de profissionais/horários.
- O sistema segue selecionando uma oferta com base na data do atendimento, e o backend mantém a autoridade sobre o preço final.
- O cliente pode remover procedimentos na lista. Se remover parte de um combo, o preço especial só volta a ser aplicável quando todos os serviços exigidos pelo combo estiverem presentes e a data estiver dentro da validade.
- Nenhuma alteração foi feita diretamente no GitHub.

## Verificação após aplicar

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. Em tela estreita, pressione **Adicionar combo** e confirme que os serviços do combo ficam selecionados na lista abaixo.
5. Selecione apenas um serviço de um combo e pressione **Completar combo**; o serviço que faltava deve ser adicionado sem duplicar o primeiro.
6. Pressione **Adicionar oferta** em uma promoção individual e confirme que o serviço fica selecionado.
7. Retire um serviço, confira que o cartão permite completar a oferta novamente e veja que o desconto não é mantido se os requisitos da promoção não estiverem satisfeitos.
8. Escolha uma data dentro do período; confirme os preços na seleção e revisão. Fora do período, a promoção não deve ser aplicada.
9. Teste em 320 px, 393 px e desktop; não deve surgir rolagem horizontal ou texto cortado.
