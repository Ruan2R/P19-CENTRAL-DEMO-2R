# P19 — Central de Demonstrações 2R

Primeira versão da central comercial da 2R Informática. A aplicação organiza os acessos de demonstração por segmento e pacote, mantém uma breve descrição para identificar cada oferta e abre uma experiência demonstrativa com módulos de acordo com o perfil selecionado.

> **Estado desta versão:** hub funcional + telas demonstrativas independentes. Os módulos internos usam dados fictícios em memória. A integração dos códigos originais completos dos projetos P15, P16 e P18 é a próxima fase; esta versão não deve ser apresentada como se já reunisse toda a lógica real desses três sistemas.

## Requisitos

- Node.js `22.12` ou superior
- npm

## Executar localmente

```bash
npm install
npm run dev
```

Abra o endereço local informado pelo Vite. Para validar o pacote de produção:

```bash
npm run build
npm run preview
```

## Acessos de demonstração

Todos os perfis usam a senha compartilhada `2Rdemo26`. Na tela inicial, os cartões abrem diretamente o ambiente escolhido e exibem o usuário correspondente.

| # | Acesso | Usuário | O que demonstra |
|---:|---|---|---|
| 1 | 2R Landing Pages | `landing` | Modelos de landing page Beauty, Barber e Burger, com seletor de modelo. |
| 2 | 2R Beauty Agenda | `beauty.agenda` | Agendamentos e administração básica da agenda. |
| 3 | 2R Beauty Financeiro | `beauty.financeiro` | Módulo financeiro demonstrativo. |
| 4 | 2R Beauty Web + Agenda | `beauty.siteagenda` | Landing page e agendamentos. |
| 5 | 2R Beauty Gestão | `beauty.agenda.financeiro` | Agendamentos, clientes, serviços e financeiro, sem landing page. |
| 6 | 2R Beauty Completo | `beauty.completo` | Landing page, agendamentos, administração e financeiro. |
| 7 | 2R Barber Agenda | `barber.agenda` | Agendamentos e administração básica para barbearia. |
| 8 | 2R Barber Web + Agenda | `barber.siteagenda` | Landing page e agendamentos para barbearia. |
| 9 | 2R Barber Gestão | `barber.agenda.financeiro` | Agendamentos, administração e financeiro. |
| 10 | 2R Barber Completo | `barber.completo` | Landing page, agendamentos e gestão completa. |
| 11 | 2R Burger Pedidos | `burger.pedidos` | Pedidos e operação com produtos/estoque demonstrativos. |
| 12 | 2R Burger Gestão | `burger.gestao` | Financeiro, produtos e estoque. |
| 13 | 2R Burger Completo | `burger.completo` | Landing page, pedidos, produtos, estoque e financeiro. |

## Diretórios

- `src/App.jsx`: catálogo de acessos, navegação e telas demonstrativas.
- `src/styles.css`: identidade visual responsiva da central e dos módulos.
- `docs/ACESSOS-DEMONSTRACAO.md`: lista rápida de usuários, senha e descrição de cada perfil.
- `docs/PLANO-INTEGRACAO.md`: mapa inicial para incorporar os sistemas já existentes sem conectar seus bancos de produção.

## Observações importantes

- Este projeto não possui autenticação real nem banco de dados nesta etapa. Os cartões são atalhos locais de demonstração, não uma barreira de segurança.
- As telas de agendamentos, financeiro, pedidos e estoque usam dados fictícios. Alterações permanecem apenas no estado da página e podem ser restauradas/descartadas atualizando-a.
- Não estão configurados envios de WhatsApp, pagamentos, notificações, bancos externos ou integrações de produção.
- Não utilizar a senha de demonstração em contas reais. Antes de qualquer publicação, revisar a forma de acesso e definir se a central será pública, protegida ou usada somente localmente.
