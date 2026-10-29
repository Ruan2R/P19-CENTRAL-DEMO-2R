# Portfólio 2R Informática — P19

O P19 é o portfólio digital da 2R Informática e a central que organiza as demonstrações interativas dos sistemas. A página inicial apresenta o trabalho, mostra os projetos principais e direciona o visitante para as demonstrações com poucos cliques.

## O que o visitante encontra

- **Apresentação:** quem está por trás da 2R Informática e o lema “Seu parceiro em Tecnologia”.
- **Acesso rápido às soluções:** aplicações web, agendamento/atendimento, gestão financeira, pedidos, estoque, suporte e infraestrutura.
- **Projetos em destaque:** 2R Beauty, 2R Barber e 2R Burger com botões para entrar nas respectivas demonstrações.
- **Contato:** e-mail e perfil profissional.
- **Catálogo técnico:** os 13 pacotes demonstrativos continuam disponíveis através do botão no rodapé; esse catálogo também tem atalho para voltar ao portfólio.

O layout foi estruturado para desktop e celular com pontos de quebra específicos, navegação móvel e ações de toque. O próximo ciclo de refinamento deve incluir testes visuais em navegadores e tamanhos de tela reais.

## Projetos demonstrativos

- **Beauty:** cópia do P18 com agendamento público, múltiplos procedimentos, disponibilidade, cadastro de clientes, configurações, promoções e financeiro.
- **Barber:** cópia do P15 com agendamento público, serviços/profissionais, horários, bloqueios, promoções/combos e financeiro.
- **Burger:** cópia do P16 com operação de pedidos, produtos, estoque e controles financeiros.
- **Landing pages:** a central técnica ainda contém uma vitrine fictícia para ilustrar páginas por segmento.

Os códigos-fonte dos produtos originais estão copiados em `apps/barber`, `apps/beauty` e `apps/burger`. O P19 não altera os repositórios de origem. As adaptações se concentram na identidade fictícia, acessos demonstrativos, dados locais isolados e bloqueio de ações externas. Há refinamentos ainda planejados, incluindo anonimização completa dos dados de Barber e uma rodada dedicada de revisão de layouts desktop nos três produtos.

## Requisitos

- Node.js **22.12 ou superior**
- npm

## Executar localmente

Na raiz do repositório:

```bash
npm run setup:demo
npm run dev
```

O comando `setup:demo` instala as dependências do portfólio e das três cópias. O comando `dev` compila os aplicativos, inicia as APIs locais, prepara dados fictícios do Burger e levanta todos os serviços. Não é necessário abrir vários terminais.

Abra o portfólio em `http://127.0.0.1:5173`. Pressione Ctrl+C no terminal para encerrar os serviços. Se as dependências já estiverem instaladas, basta executar `npm run dev`.

## Portas locais

| Aplicação | Endereço local |
|---|---|
| Portfólio + catálogo técnico | `http://127.0.0.1:5173` |
| Barber / P15 (site + API) | `http://127.0.0.1:3015` |
| Beauty / P18 (site + API) | `http://127.0.0.1:3018` |
| Burger / P16 (interface) | `http://127.0.0.1:5176` |
| Burger / P16 (API) | `http://127.0.0.1:3016` |

## Publicação futura

O portfólio ainda **não está publicado**. Para publicar, será necessário conferir os limites do plano Hostinger, preparar a implantação das três APIs/interfaces e configurar as URLs públicas usadas pelos botões de demonstração. Não basta publicar somente a página estática, porque os sistemas dependem dos seus servidores e armazenamento.

As URLs podem ser configuradas no ambiente de build do portfólio:

- `VITE_DEMO_BEAUTY_URL`: endereço público base do P18 (site e API).
- `VITE_DEMO_BARBER_URL`: endereço público base do P15 (site e API).
- `VITE_DEMO_BURGER_URL`: endereço público da interface do P16; a API do Burger também deve estar implantada e configurada no próprio front-end.

O arquivo `.env.example` mostra as variáveis usadas para essa configuração. O front-end atual do Burger consulta a API pela mesma origem em `/api`; na publicação, essa rota precisa ser encaminhada ao servidor da API por um proxy reverso ou o cliente precisa ser adaptado para a URL pública da API. Os valores `127.0.0.1` presentes no código são apenas os padrões para desenvolvimento local; não devem ser usados numa publicação pública.

## Acessos do catálogo técnico

Todos os pacotes demonstrativos usam a senha fictícia `2Rdemo26`. O catálogo técnico continua contendo 13 perfis:

| # | Acesso | Usuário na central | O que demonstra |
|---:|---|---|---|
| 1 | 2R Landing Pages | `landing` | Vitrine dos modelos Beauty, Barber e Burger. |
| 2 | 2R Beauty Agenda | `beauty.agenda` | Agendamento e administração de agenda. |
| 3 | 2R Beauty Financeiro | `beauty.financeiro` | Visão financeira do Beauty. |
| 4 | 2R Beauty Web + Agenda | `beauty.siteagenda` | Vitrine + agendamento. |
| 5 | 2R Beauty Gestão | `beauty.agenda.financeiro` | Agenda, clientes, serviços e financeiro. |
| 6 | 2R Beauty Completo | `beauty.completo` | Vitrine + administração completa do P18. |
| 7 | 2R Barber Agenda | `barber.agenda` | Agendamento e gestão essencial. |
| 8 | 2R Barber Web + Agenda | `barber.siteagenda` | Vitrine + agendamento do Barber. |
| 9 | 2R Barber Gestão | `barber.agenda.financeiro` | Gestão e financeiro do P15. |
| 10 | 2R Barber Completo | `barber.completo` | Vitrine + administração completa do P15. |
| 11 | 2R Burger Pedidos | `burger.pedidos` | Pedidos, estoque e controles relacionados. |
| 12 | 2R Burger Gestão | `burger.gestao` | Financeiro e estoque do P16. |
| 13 | 2R Burger Completo | `burger.completo` | Fluxo completo do P16. |

## Dados fictícios e isolamento

- As cópias locais usam arquivos como `data/p19-demo-db.json`, separados dos dados locais e bancos de produção dos projetos originais.
- No modo P19, as variáveis de conexão de banco são esvaziadas para forçar o armazenamento local.
- Beauty e Barber recebem cadastros, horários, agendamentos e lançamentos fictícios. Burger usa o script de seed de demonstração do P16.
- Os fluxos e regras de negócio originais são preservados sempre que possível.
- Links de WhatsApp que poderiam enviar mensagens externas ficam desativados nas cópias locais do P19.
- Não use arquivos de demonstração com dados de clientes.

## Lembretes de apresentação

- **Beauty:** mostrar disponibilidade antes da reserva e depois localizar o atendimento na agenda administrativa.
- **Barber:** mostrar como serviço, duração e profissional interferem na disponibilidade.
- **Burger:** mostrar o ciclo do pedido, as movimentações de estoque e os relatórios financeiros, destacando quais ações ocorrem automaticamente e quais dependem de registrar o pagamento.

## Validação

```bash
npm run build:demo
npm --prefix apps/barber test
npm --prefix apps/beauty test
npm --prefix apps/burger test
node scripts/test-demo-runtime.mjs
```

Consulte também o [guia local](docs/P19-DEMO-LOCAL.md).

**Importante:** a execução atual é destinada a demonstrações locais. Antes da publicação, serão necessárias a implantação dos serviços, URLs públicas, validações de segurança e uma rodada de testes completos em desktop e celular.
