# P19 — Executar a demonstração completa

O P19 usa uma central comercial e as cópias locais dos três produtos originais:

- **Beauty:** cópia do P18, incluindo página pública de agendamento e administração.
- **Barber:** cópia do P15, incluindo agendamento, profissionais, promoções e administração.
- **Burger:** cópia do P16, incluindo o modo financeiro e o modo completo de pedidos/estoque.

## Primeira execução

Requisitos: Node.js 22.12+ e npm.

Na raiz do repositório:

```bash
npm run setup:demo
npm run dev
```

Abra a central em `http://127.0.0.1:5173`. Escolha um dos 13 acessos e use os links para abrir a experiência pública ou a administração original do produto.

Na próxima execução basta `npm run dev`, até que as dependências sejam alteradas.

## Serviços locais usados

| Serviço | Endereço local |
|---|---|
| Central P19 | `http://127.0.0.1:5173` |
| Barber — P15 | `http://127.0.0.1:3015` |
| Beauty — P18 | `http://127.0.0.1:3018` |
| Burger — interface P16 | `http://127.0.0.1:5176` |
| Burger — API P16 | `http://127.0.0.1:3016` |

O inicializador compila as quatro interfaces, sobe as APIs locais, carrega os dados de exemplo do P16 e encerra todos os processos quando você pressiona Ctrl+C. Não é necessário iniciar vários terminais manualmente.

## Dados e segurança do modo de apresentação

- As cópias locais usam um arquivo separado `data/p19-demo-db.json` dentro de cada aplicação. Não abrem os bancos dos projetos/clientes originais.
- Os cadastros iniciais são fictícios. As alterações ficam apenas nos arquivos locais de demonstração e não são enviadas a clientes reais.
- Links de WhatsApp externos ficam desativados no P19. As mensagens de demonstração podem ser preparadas/copiadas, sem enviar mensagens.
- Os acessos usam a senha de demonstração `2Rdemo26`. Não a reutilize em sistemas reais.
- A aplicação foi preparada para uso local; não publique estas cópias nem exponha as APIs à rede.

## Validação manual recomendada

1. Abra um agendamento no Beauty, confirme-o e verifique o resultado na agenda administrativa.
2. No Barber, selecione serviços/profissionais, consulte horários e confira a reserva no painel.
3. No Burger, acompanhe um pedido, os movimentos de estoque, recebimentos e relatórios pelo sistema original.

## Build e testes individuais

```bash
npm run build:demo
npm --prefix apps/barber test
npm --prefix apps/beauty test
npm --prefix apps/burger test
```
