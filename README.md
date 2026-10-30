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
| Burger | Pedidos e operação |
| Burger | Financeiro, produtos e estoque |
| Burger | Solução completa |

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

## Responsividade

A interface tem estilos próprios para desktop, tablet e celular. As revisões devem validar:
- navegação e apresentação em telas grandes;
- cards e prévias em resoluções intermediárias;
- menus, formulários e tabelas em celulares;
- leitura clara das modalidades e dos recursos incluídos.

A responsividade será refinada por etapas com testes visuais em dispositivos e larguras diferentes.

## Próximos refinamentos

- Revisar visualmente os componentes desktop e mobile.
- Conferir anonimização dos dados demonstrativos, especialmente nomes de profissionais do Barber.
- Ajustar cores e identidade visual das prévias de cada segmento.
- Melhorar a clareza dos recursos incluídos em cada modalidade.
- Publicar a versão estática na Hostinger depois da validação visual.

**Importante:** o P19 é um portfólio de apresentação. Não usar formulários ou dados de demonstração como cadastro ou operação de um negócio real.
