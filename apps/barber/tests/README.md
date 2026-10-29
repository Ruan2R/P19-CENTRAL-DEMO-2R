# Testes P15

Executar `npm test` (usa `node:test`).

**Estado na Etapa 13: 46 testes aprovados, 0 falhas.**

**Etapa 14: 47 testes aprovados, 0 falhas**, incluindo teste de remoção da pausa semanal por meio da API administrativa.

Cobertura: grade de início a cada 30 minutos e duração real; expediente, pausas e bloqueios; disponibilidade e conflitos; agendamento agrupado/atômico; persistência JSON local; autenticação e autorização; agenda, status e confirmação manual do WhatsApp; cadastros e configuração operacional; clientes e histórico; finanças e contas a pagar; idempotência e proteção dos lançamentos; promoções individuais/combos, conflitos de validade, preço congelado e recebimento sem receita automática.

Os três testes em `booking-e2e.test.mjs` conectam os handlers público e administrativo para percorrer fluxos completos em armazenamento isolado: reserva de combo até recebimento, conflito sem gravação parcial e atribuição automática de profissional.

Pendências: integração do adaptador com uma instância MySQL real; matriz completa de navegador/responsividade (incluindo 320, 360, 393 e 430 px, tablet e desktop); revisão final de segurança e homologação.
