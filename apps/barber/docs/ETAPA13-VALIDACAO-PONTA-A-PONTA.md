# P15-SISTEMA-BARBEARIA — Etapa 13
## Validação ponta a ponta

**Data:** 14/10/2026  
**Base:** versão 0.9.0 / Etapa 12 (correção TypeScript)  
**Escopo:** somente testes automatizados e documentação; nenhuma alteração em P13, P14 ou no repositório GitHub.

## Resultado

- `npm test`: **46 aprovados, 0 falhas** (43 testes existentes + 3 novos testes ponta a ponta).
- `node --check` em todos os `.mjs` de `server/` e `tests/`: passou.
- `npm run typecheck` e `npm run build`: confirmados pelo responsável na máquina de desenvolvimento após a Etapa 12. Não foram repetidos nesta etapa, pois só foram adicionados testes `.mjs` e atualizada documentação.

## Novos cenários

### 1. Reserva promocional até o recebimento

Percorre as rotas públicas de serviços, profissionais, promoções e disponibilidade; cria uma promoção de combo; registra um atendimento com dois procedimentos; verifica preço promocional congelado e remoção dos horários da disponibilidade; confere o atendimento na agenda administrativa e no histórico do cliente; impede recebimento antes da conclusão; registra manualmente a confirmação via WhatsApp; conclui o atendimento; registra o recebimento via Pix e comprova que a repetição não duplica a entrada financeira.

### 2. Conflito sem gravação parcial

Um dos horários de um atendimento agrupado já está ocupado. A rota pública deve responder `409 SLOT_TAKEN`, manter apenas a reserva que já existia e deixar disponível o horário do primeiro procedimento da tentativa recusada.

### 3. “Sem preferência”

A consulta de disponibilidade retorna um profissional concreto para um horário e o agendamento sem preferência é salvo com o mesmo profissional atribuído.

## Procedimento recomendado na máquina local

Depois de aplicar o ZIP incremental na pasta existente, preservando `package-lock.json`, `.env` e `data/local-db.json`, executar:

```bash
npm test
npm run typecheck
npm run build
```

Em seguida, testar manualmente o fluxo público em celular e desktop e conferir os dados na administração. O armazenamento JSON local é usado nos testes; esta etapa **não valida** transações nem concorrência do adaptador MySQL real. O P15 continua em desenvolvimento e não deve ser liberado para produção antes da integração MySQL, revisão de segurança e homologação.
