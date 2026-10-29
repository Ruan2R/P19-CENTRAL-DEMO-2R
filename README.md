# P19 — Central de Demonstrações 2R

P19 é uma central comercial local para apresentar as soluções da 2R Informática. O catálogo mantém 13 perfis de demonstração e um lembrete comercial sobre a automação de cada segmento; ao abrir um pacote, você acessa as **cópias dos aplicativos originais**.

## Produtos incluídos

- **Beauty:** cópia do P18 com agendamento público, múltiplos procedimentos, disponibilidade, cadastro de clientes, configurações, promoções e financeiro.
- **Barber:** cópia do P15 com agendamento público, serviços/profissionais, horários, bloqueios, promoções/combos e financeiro.
- **Burger:** cópia do P16 com os dois perfis nativos para financeiro/estoque ou operação completa de pedidos.
- **Landing pages:** uma vitrine fictícia para ilustrar opções visuais por segmento. A prioridade comercial são os aplicativos operacionais acima.

Os códigos-fonte originais dos projetos estão copiados em `apps/barber`, `apps/beauty` e `apps/burger`. O P19 não altera os repositórios de origem. Só foram adaptados os pontos necessários para identidade fictícia, credenciais de demonstração, dados locais isolados e bloqueio de ações externas.

## Requisitos

- Node.js **22.12 ou superior**
- npm

## Primeira execução

Na raiz do repositório, execute:

```bash
npm run setup:demo
npm run dev
```

O comando `setup:demo` instala as dependências do hub e das três cópias. O comando `dev` compila todos os aplicativos, inicia as APIs locais, carrega dados fictícios do Burger e abre todos os serviços. **Não é necessário abrir vários terminais.**

Abra a central em `http://127.0.0.1:5173`. Pressione Ctrl+C no terminal para encerrar tudo.

Se você já instalou as dependências, basta:

```bash
npm run dev
```

## Portas locais

| Aplicação | Endereço |
|---|---|
| Central P19 | `http://127.0.0.1:5173` |
| Barber / P15 | `http://127.0.0.1:3015` |
| Beauty / P18 | `http://127.0.0.1:3018` |
| Burger / P16 — interface | `http://127.0.0.1:5176` |
| Burger / P16 — API | `http://127.0.0.1:3016` |

## Acessos comerciais

Todos os pacotes usam a senha fictícia `2Rdemo26`. O catálogo mantém as descrições curtas para você saber o que cada acesso demonstra. As credenciais nativas do aplicativo aparecem ao entrar no cartão do pacote.

| # | Acesso | Usuário na central | O que demonstra |
|---:|---|---|---|
| 1 | 2R Landing Pages | `landing` | Vitrine de modelos Beauty, Barber e Burger. |
| 2 | 2R Beauty Agenda | `beauty.agenda` | Área pública de agendamento + administração de agenda. |
| 3 | 2R Beauty Financeiro | `beauty.financeiro` | Visão financeira do produto original. |
| 4 | 2R Beauty Web + Agenda | `beauty.siteagenda` | Vitrine de apresentação + agendamento público. |
| 5 | 2R Beauty Gestão | `beauty.agenda.financeiro` | Agenda, clientes, serviços, configurações e financeiro. |
| 6 | 2R Beauty Completo | `beauty.completo` | Vitrine + toda a administração do P18. |
| 7 | 2R Barber Agenda | `barber.agenda` | Área pública e gestão essencial da agenda. |
| 8 | 2R Barber Web + Agenda | `barber.siteagenda` | Vitrine + agendamento público da barbearia. |
| 9 | 2R Barber Gestão | `barber.agenda.financeiro` | Agenda e gestão do P15, incluindo financeiro. |
| 10 | 2R Barber Completo | `barber.completo` | Vitrine + gestão completa do P15. |
| 11 | 2R Burger Pedidos | `burger.pedidos` | Perfil nativo completo: pedidos, estoque e controles relacionados. |
| 12 | 2R Burger Gestão | `burger.gestao` | Perfil financeiro/estoque do P16. |
| 13 | 2R Burger Completo | `burger.completo` | Perfil completo do P16 com todas as abas nativas. |

## Dados fictícios e isolamento

- As cópias locais usam `data/p19-demo-db.json` dentro da respectiva aplicação. Esse arquivo é separado dos dados locais e bancos de produção dos projetos de origem.
- No modo P19, o backend ignora variáveis de conexão de banco para forçar armazenamento local.
- Beauty e Barber recebem serviços, horários, clientes, agendamentos e lançamentos fictícios. Burger usa o seed de demonstração que acompanha o P16.
- O fluxo mantém as regras originais: disponibilidade, validação de horário, status, relatórios e integrações internas entre pedidos/estoque/financeiro.
- Links de WhatsApp que poderiam enviar mensagem externa ficam desativados nas cópias locais do P19. Alterações e confirmações de demonstração não contatam clientes reais.
- Os dados persistem nos arquivos locais até serem removidos manualmente ou substituídos pela reinicialização deliberada da base demo. Não use esses arquivos para dados de clientes.

## Automação — lembretes para a apresentação

A tela de lançamento de cada pacote tem um breve roteiro. Exemplos do que destacar:

- **Beauty:** a disponibilidade é verificada antes da reserva; o mesmo atendimento aparece na agenda, no cliente e nas rotinas de recebimento/financeiro conforme o status.
- **Barber:** disponibilidade considera serviço, duração e profissional; combos/promoções seguem regras do P15; o atendimento é acompanhado pela área administrativa.
- **Burger:** o ciclo do pedido atualiza status e estoque; recebimentos e relatórios seguem as regras do P16. Explique que registrar um pagamento manual é diferente de dar baixa no estoque.

## Validação

```bash
npm run build:demo
npm --prefix apps/barber test
npm --prefix apps/beauty test
npm --prefix apps/burger test
```

Veja também [o guia local](docs/P19-DEMO-LOCAL.md).

**Importante:** esta é uma plataforma de demonstração local, não um ambiente de produção. Não a publique nem a exponha à rede; todas as credenciais são deliberadamente simples e destinadas apenas à apresentação.
