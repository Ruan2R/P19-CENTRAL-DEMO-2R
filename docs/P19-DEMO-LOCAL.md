# P19 — Executar o portfólio localmente

O P19 é uma apresentação comercial da 2R Informática. Ele não inicia nem depende dos servidores P15, P16 ou P18.

## Primeira execução

Requisitos: Node.js 22.12+ e npm.

Na raiz do repositório:

```bash
npm ci
npm run dev
```

Acesse `http://127.0.0.1:5173`.

Nas próximas execuções, basta `npm run dev`.

## O que roda

Apenas o front-end Vite/React do P19. Não são iniciados:
- API ou banco de dados;
- servidor de agendamento Barber/Beauty;
- servidor de pedidos Burger;
- autenticação ou painel administrativo dos projetos originais.

As pastas `apps/barber`, `apps/beauty` e `apps/burger` ficam no repositório apenas como referências de layout e regras usadas na criação das prévias.

## Como são as prévias

- Escolha o segmento e uma das 13 modalidades.
- O portfólio abre a representação visual daquele pacote.
- O menu lateral mostra somente as áreas incluídas na modalidade.
- Formulários e botões alteram exemplos em memória para ilustrar os fluxos.
- Ao atualizar ou fechar a página, as alterações temporárias são descartadas.
- Não existem logins, senhas, gravação em banco, integrações ou mensagens externas.

## Publicação estática

Gere a pasta de publicação com:

```bash
npm run build
```

Publique o conteúdo de `dist/` na hospedagem estática da Hostinger. A central não precisa de Node.js em execução no servidor nem de implantar os projetos originais. Antes de publicar, valide links, imagens e responsividade na versão de produção.

## Testes

A verificação de build usada no GitHub Actions executa:

```bash
npm ci
npm run build
```
