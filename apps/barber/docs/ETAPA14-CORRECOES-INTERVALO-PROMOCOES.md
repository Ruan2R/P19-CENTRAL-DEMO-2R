# P15 — Etapa 14: correções de intervalo e visibilidade das promoções

## 1. Remover pausa do funcionamento semanal

- Adicionado o controle **Remover intervalo** ao lado da identificação da pausa.
- O controle limpa início e fim juntos, evitando deixar apenas um dos campos preenchido (combinação recusada pela validação de horário).
- Depois de limpar os campos, é necessário clicar em **Salvar [dia]** para persistir a alteração.
- Na lista de bloqueios específicos por data, o item removido também sai imediatamente da lista após a API confirmar a remoção.
- O backend continua exigindo que os dois valores estejam preenchidos juntos ou ambos vazios.

## 2. Promoções visíveis logo na primeira tela

- Adicionada a seção **Promoções da Boss67** na etapa inicial, antes da escolha de serviços.
- Exibe ofertas ativas que estão vigentes ou começarão dentro da janela de agendamento de 60 dias.
- Cada oferta mostra o tipo, nome, serviços incluídos, preço normal, preço promocional, economia e validade/início.
- Promoções expiradas, inativas ou ligadas a serviços inativos são omitidas.
- O preço final continua sendo aplicado conforme a data escolhida para o atendimento e validado no backend.
- Layout adaptado para celular: cards empilhados em larguras estreitas e em duas colunas em telas maiores.

## Validação

Executar na raiz do projeto:

```bash
npm test
npm run typecheck
npm run build
```

## Teste manual após aplicar

1. Em **Horários**, configure pausa para um dia e salve.
2. Clique em **Remover intervalo**; confirme que os dois campos ficam vazios.
3. Clique em **Salvar [dia]**, atualize a tela e confirme que os dois campos seguem vazios e o período volta a permitir reservas.
4. Em **Bloqueios**, crie um bloqueio de teste, remova-o e confirme que ele some da lista; atualize a tela para conferir que não retornou.
5. Crie uma promoção vigente e uma futura (dentro dos próximos 60 dias). Ambas devem aparecer na tela inicial pública antes de escolher a data; a futura deve indicar quando começa.
6. Escolha uma data válida para cada oferta e confira se o preço promocional é aplicado apenas durante a validade.
7. Confirme em celular estreito (320 px), 393 px e desktop que não há cortes nem rolagem horizontal.
