# P19 — Plano inicial de integração

## Objetivo

Reunir a experiência de apresentação da 2R Informática em uma central, mantendo os acessos segmentados por pacote comercial. O catálogo não deve mostrar valores de venda: a tabela comercial é referência de planejamento, não conteúdo da aplicação.

## Fontes de funcionalidades

- **P18-SISTEMA-ANA** — referência principal para Beauty: agendamentos, clientes, serviços, configurações, administração e financeiro.
- **P15-SISTEMA-BARBEARIA** — referência para barbearia: agendamento público, profissionais, serviços, horários, bloqueios, agenda e administração.
- **P16-SISTEMA-ADEGA-DO-COPAO** — referência para pedidos/estoque/financeiro: pedidos, catálogo de produtos, estoque e controles relacionados. Revisar os dois fluxos de acesso já existentes no P16 para entender quais conceitos devem ser preservados.
- **P12-LANDING-PAGE-2R e landing pages de segmento** — referências visuais para o módulo público, conforme os componentes/códigos disponíveis.

## Estratégia recomendada

1. Auditar os arquivos, dependências e fluxos atuais de P15, P16 e P18; registrar quais funcionalidades estão completas e testadas.
2. Escolher um núcleo técnico comum para a central sem conectar os bancos de produção existentes.
3. Levar cada módulo para uma camada de funcionalidades compartilhada quando fizer sentido, evitando manter três cópias divergentes.
4. Representar os 13 acessos em uma configuração única (`id`, descrição, segmento e lista de módulos liberados).
5. Garantir que cada perfil apresente somente os módulos previstos para o pacote.
6. Criar dados fictícios/seeds por segmento e uma forma de restaurar a demonstração.
7. Validar responsividade mobile, typecheck/build e os testes dos fluxos integrados.
8. Antes de publicar, revisar acesso à central, desativar integrações com efeitos reais e não reutilizar credenciais, tokens ou bancos de produção.

## Estado atual

A primeira versão implementa o catálogo responsivo de acessos, descrições, atalhos de usuário, senha padrão informativa, navegação por módulos e telas de demonstração com dados fictícios em memória. Ainda não incorpora o código-fonte completo dos módulos originais.
