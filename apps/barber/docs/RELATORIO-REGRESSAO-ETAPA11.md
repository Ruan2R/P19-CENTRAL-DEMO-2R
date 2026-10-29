# P15-SISTEMA-BARBEARIA — Relatório de regressão (Etapa 11)

**Data:** 14/10/2026  
**Versão funcional examinada:** 0.9.0  
**Resultado geral:** núcleo e APIs locais aprovados; build de frontend e produção permanecem bloqueados por validações pendentes.

## 1. Testes automatizados

Comando executado:

```bash
npm test
```

**Resultado: 43 testes aprovados, 0 falhas.**

Cobertura exercitada pela suíte atual:

- autenticação local, hash de senha, sessão e logout;
- proteção das rotas administrativas;
- cadastros e validações de serviços, profissionais, horários e bloqueios;
- cadastro/pesquisa/histórico de clientes;
- entradas, contas a pagar e proteção contra lançamentos duplicados;
- filtros e agrupamento da agenda;
- grade de horários a cada 30 minutos, duração real, conflitos e confirmação atômica;
- promoções individuais e combos, preço histórico, validação de campanhas e recebimento manual.

## 2. Verificações de sintaxe

- `node --check` para todos os arquivos `.mjs` em `server/` e `tests/`: passou.
- Transpilação sintática de 9 arquivos `.ts`/`.tsx` usando o TypeScript global disponível no ambiente: passou sem diagnóstico de sintaxe.
- A transpilação sintática não substitui o typecheck completo da aplicação.

## 3. Smoke test HTTP local

Servidor iniciado em porta temporária (`3181`) usando armazenamento JSON local.

| Verificação | Resultado observado |
|---|---|
| `GET /api/health` | `200 OK` |
| `GET /api/public/services` | `200 OK` |
| `GET /api/public/professionals` | `200 OK` |
| `GET /api/public/promotions` | `200 OK` |
| `GET /api/admin/finance` sem sessão | `401 Unauthorized` |
| Login com `Origin` externo | `403 Forbidden` |
| Login local válido | `200 OK` |
| Agenda, atendimentos, clientes, promoções, financeiro e configuração com sessão | `200 OK` |
| Logout | `200 OK` |
| Rota administrativa depois do logout | `401 Unauthorized` |
| Início com `NODE_ENV=production` | processo encerrou com bloqueio explícito |

A solicitação `GET /` não pôde renderizar o frontend neste ambiente porque `vite` não estava instalado; respondeu `500` com “Não foi possível iniciar o frontend”. Isso é consistente com a ausência de dependências no ambiente de teste e impede declarar o build local concluído nesta rodada.

## 4. Bloqueios para release

### 4.1 Dependências e lockfile

O ZIP atual não inclui `package-lock.json`. `npm ci` falha porque exige um lockfile. A tentativa de `npm install --no-audit --no-fund` expirou neste ambiente; o cache npm estava vazio.

**Ação em ambiente de desenvolvimento com acesso ao registry:**

```bash
npm install
npm run typecheck
npm run build
npm test
```

Depois de validar, conservar o `package-lock.json` gerado no projeto e no próximo pacote. Não declarar sucesso do build antes que esses comandos terminem sem erros.

### 4.2 MySQL

O adaptador e o schema/migrações foram revisados estaticamente, mas não houve conexão a uma instância MySQL real. Antes de produção, testar em base descartável:

- aplicação do schema inicial;
- aplicação incremental de migrações na ordem documentada;
- criação concorrente de reservas e rollback quando houver conflito;
- gravação de combos/preços congelados;
- idempotência de recebimentos e pagamento de contas;
- backup e restauração da base.

### 4.3 Segurança e publicação

- `NODE_ENV=production` continua bloqueado intencionalmente.
- Ainda é necessária uma revisão final de proxy/rate limit, origem/CSRF, cabeçalhos, variáveis de ambiente, credenciais administrativas reais e política de backups.
- Testes de código não substituem validação visual e funcional em navegador. O usuário já validou visualmente os módulos no viewport de referência do iPhone 16 (393 × 852); a matriz adicional inclui 320, 360 e 430 px, tablet e desktop.
- Nenhuma publicação ou alteração em repositórios GitHub foi feita durante esta rodada.

## 5. Conclusão

A camada de regras de negócio e as rotas locais passaram pelos testes atuais. O P15 **não está pronto para produção** enquanto o build/typecheck completo, o lockfile, a integração MySQL e a revisão final de segurança não estiverem aprovados.
