# P19 — Portfólio 2R Informática

**Versão:** 1.0.0  
**Marca:** 2R Informática — Seu parceiro em Tecnologia  
**Objetivo:** apresentar modalidades de aplicações web e permitir que potenciais clientes explorem prévias interativas.

## Experiência do visitante

1. Conhece a 2R Informática e os serviços oferecidos.
2. Explora os segmentos Landing Pages, Beauty, Barber e Burger.
3. Compara modalidades e abre uma demonstração do pacote.
4. Navega pelas áreas disponíveis naquele pacote e consulta o guia contextual.
5. Entra em contato com a 2R para conversar sobre uma solução.

As demonstrações não exigem login ou cadastro. Os dados são fictícios, as interações acontecem localmente no navegador e nada é enviado ou salvo em um banco de dados.

## Segmentos e demonstrações

- **Landing Pages:** exemplos de páginas de apresentação.
- **Beauty:** agendamentos, clientes, serviços, promoções, bloqueios, políticas e financeiro, conforme a modalidade.
- **Barber:** agendamentos, profissionais, clientes, serviços, promoções, bloqueios, políticas e financeiro, conforme a modalidade.
- **Burger:** pedidos, produtos, estoque e financeiro, conforme a modalidade.
- **Aplicações sob medida:** exemplos de segmentos e contato para planejar soluções personalizadas.

As modalidades são combinações comerciais de recursos para apresentação. A demonstração não é uma reprodução funcional completa dos sistemas de origem nem um ambiente de operação real.

## Navegação e responsividade

- No celular, as áreas da demonstração ficam visíveis em abas logo abaixo do cabeçalho.
- No desktop, a navegação permanece na barra lateral.
- Beauty, Barber e Burger mostram somente os módulos que pertencem à modalidade selecionada.
- O guia contextual acompanha os módulos disponíveis e explica como explorar cada tela.
- Layout, tipografia e componentes foram revisados para telas móveis e desktop.

## Referências de desenvolvimento

O projeto reaproveita decisões e fluxos visuais dos projetos P15 (Barber), P16 (Burger) e P18 (Beauty). As cópias-fonte ficam em `apps/barber`, `apps/burger` e `apps/beauty` apenas como referência. Elas não são iniciadas nem consultadas pelo portfólio em execução.

## Executar localmente

**Requisito:** Node.js 22.12 ou superior e npm.

Na primeira execução:

```bash
npm ci
npm run dev
```

Acesse `http://127.0.0.1:5173`.

Para gerar a versão estática:

```bash
npm run build
```

Os arquivos de publicação são gerados em `dist/`.

Para conferir os metadados e arquivos essenciais de SEO após o build:

```bash
npm run check:seo
```

## Publicação

A versão pública é disponibilizada pelo GitHub Pages:

[https://ruan2r.github.io/P19-CENTRAL-DEMO-2R/](https://ruan2r.github.io/P19-CENTRAL-DEMO-2R/)

O GitHub Actions executa a instalação, compilação e verificação dos arquivos de SEO. O fluxo de publicação utiliza o conteúdo compilado pelo Vite em `dist/`.

## SEO e indexação

- Título e descrição em português do Brasil.
- URL canônica para a página principal.
- Open Graph e Twitter Card para compartilhamento.
- Favicon SVG e ícone para dispositivos Apple.
- Dados estruturados `Organization` e `WebSite`.
- `sitemap.xml` com a URL canônica da página pública.
- `robots.txt` mantido no repositório como referência para uma futura publicação na raiz de um domínio próprio.
- Checagem automatizada dos metadados e arquivos gerados no fluxo de build.

**Limite atual do GitHub Pages:** este projeto é servido em um subdiretório de `ruan2r.github.io`. O arquivo `robots.txt` só tem efeito quando publicado na raiz do host; um arquivo dentro do subdiretório do projeto não controla o rastreamento do host. Ao adotar um domínio próprio ou uma publicação na raiz, o arquivo poderá ser disponibilizado no endereço correto. O sitemap deste projeto continua disponível no caminho do próprio projeto e pode ser informado no Google Search Console.

O portfólio é uma aplicação de página única. As abas e módulos das demonstrações não têm URLs públicas individuais; o sitemap lista apenas a página principal.

## Limites da demonstração

- Não há autenticação, banco de dados ou API de produção no P19.
- Alterações nos exemplos ficam apenas em memória e são reiniciadas ao recarregar a página.
- Nenhum agendamento, pedido, pagamento ou mensagem de WhatsApp é realmente enviado.
- As informações de demonstração não devem ser usadas para gerir uma operação real.

## Fechamento da V1

A V1 prioriza apresentar os segmentos existentes, facilitar a exploração dos módulos em celular e desktop e encaminhar o visitante para o contato comercial. Novos segmentos ou funcionalidades extensas ficam para versões futuras, após validação comercial.
