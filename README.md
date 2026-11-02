# P19 — Portfólio 2R Informática

O P19 é o portfólio digital da **2R Informática — Seu parceiro em Tecnologia**. A proposta é apresentar as modalidades de aplicações oferecidas e permitir que o visitante visualize prévias ilustrativas de cada pacote.

## Como funciona

1. O visitante conhece a 2R Informática e as áreas de atuação.
2. Escolhe um segmento: Landing Pages, Beauty, Barber ou Burger.
3. Compara as modalidades disponíveis naquele segmento.
4. Abre uma prévia visual do pacote escolhido e navega somente pelos módulos incluídos.

**Não existe login, senha, cadastro ou acesso aos sistemas originais.** Cada modalidade abre uma representação visual no próprio portfólio.

## Modalidades disponíveis

| Segmento | Modalidade |
|---|---|
| Landing pages | 2R Landing Pages |
| Beauty | Agendamentos e administração básica |
| Beauty | Financeiro |
| Beauty | Landing page + agendamentos |
| Beauty | Agendamentos + gestão + financeiro |
| Beauty | Solução completa |
| Barber | Agendamentos e administração |
| Barber | Landing page + agendamentos |
| Barber | Agendamentos + gestão + financeiro |
| Barber | Solução completa |
| Burger | 2R Burger Pedidos | Pedidos e operação |
| Burger | 2R Burger Gestão | Financeiro, produtos e estoque |
| Burger | 2R Burger Gestão + Pedidos | Pedidos, gestão, financeiro, produtos e estoque |
| Burger | 2R Burger Completo | Landing page, pedidos e gestão completa |

As modalidades são combinações comerciais de recursos para apresentação. A seleção de um pacote não abre um sistema real nem exige credenciais.

## Prévia visual

O projeto reaproveita referências de layout e fluxo dos projetos P15 (Barber), P16 (Burger) e P18 (Beauty). As cópias-fonte estão guardadas em `apps/barber`, `apps/burger` e `apps/beauty` como referência de desenvolvimento; **não são iniciadas nem consultadas pelo portfólio em execução**.

As prévias atuais são front-end:
- dados ilustrativos definidos no próprio código;
- interações locais para mostrar agendamentos, pedidos, produtos, estoque e financeiro;
- alterações mantidas apenas em memória durante a navegação;
- recarregar ou fechar a página restaura os dados de exemplo;
- nenhum banco, API, servidor dos projetos originais, envio de WhatsApp ou integração externa é usado.

Essas telas servem para demonstrar como uma solução pode ser organizada. Não são uma reprodução funcional completa dos produtos de origem.

## Requisitos

- Node.js 22.12 ou superior
- npm

## Executar localmente

Na primeira execução, dentro da pasta do repositório:

```bash
npm ci
npm run dev
```

Abra:

`http://127.0.0.1:5173`

Nas próximas execuções, basta:

```bash
npm run dev
```

O comando inicia **somente a interface do portfólio**. Não precisa levantar APIs nem abrir vários terminais.

Para gerar os arquivos de publicação:

```bash
npm run build
```

A saída fica em `dist/` e pode ser publicada como site estático. Na Hostinger, basta configurar a publicação dos arquivos gerados, sem implantar P15, P16 ou P18 como serviços.

## Publicação atual

A versão pública é publicada pelo GitHub Pages:

[https://ruan2r.github.io/P19-CENTRAL-DEMO-2R/](https://ruan2r.github.io/P19-CENTRAL-DEMO-2R/)

O fluxo do GitHub Actions executa a compilação e publica a versão estática quando há atualização na branch `main`. O build gera os arquivos em `dist/`.

## Responsividade e orientação

A interface possui estilos para desktop, tablet e celular. Cada módulo apresenta um resumo da função e um guia passo a passo; no celular, o menu lateral e o botão de ajuda tornam as funções localizáveis sem depender de uma apresentação ao vivo.

A revisão visual deve priorizar leitura dos cards, espaçamento, menus e formulários em telas estreitas, além de manter a rolagem horizontal limitada a componentes que precisam dela, como navegação por abas.

## Auditoria de manutenção

- Componentes duplicados que não eram mais renderizados foram removidos da aplicação principal.
- As cópias de referência dos projetos P15/P16/P18 permanecem no repositório, sem participar do runtime do portfólio.
- Os fluxos demonstrativos do Burger conectam pedidos, recebíveis, caixa e estoque; o relatório de pedidos permanece separado das entradas efetivamente recebidas.

**Importante:** o P19 é um portfólio de apresentação. Não usar formulários ou dados de demonstração como cadastro ou operação de um negócio real.
