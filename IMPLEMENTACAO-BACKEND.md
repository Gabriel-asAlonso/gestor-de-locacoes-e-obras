# Implementação do backend — fundação

> Atualização da etapa seguinte: a interface de autenticação já foi conectada e a limitação de revogação em memória descrita neste relatório histórico foi corrigida com `0003_revogacao_sessoes`. O estado vigente, testes e bloqueios de módulos estão em [INTEGRACAO-MODULOS.md](INTEGRACAO-MODULOS.md).

Data: 14/09/2026. Etapa: fundação da API (config, banco, migrations, autenticação, usuários, perfis, permissões, erros). **Não** implementa os módulos de negócio (obras, despesas, cobranças, etc.) — apenas a base sobre a qual eles serão construídos.

Referências preservadas: `MAPEAMENTO-FUNCIONAL-E-DADOS-MOCKADOS.md`, `MODELAGEM-BANCO-DE-DADOS-PARA-VALIDACAO.md`, `IMPLEMENTACAO-BANCO-DE-DADOS.md`, `CONTRATO-DA-API-PARA-VALIDACAO.md`.

## 1. Tecnologia escolhida (registrada antes da implementação)

**Tecnologia escolhida:** Node.js com TypeScript executado nativamente pelo runtime (type stripping), sem etapa de transpilação para rodar — o mesmo padrão já usado pela camada `db/` e pelos scripts existentes.

**Framework:** [Hono](https://hono.dev) 4.x + `@hono/node-server` (adaptador HTTP para Node).

**ORM:** Drizzle ORM 0.45.2 — reutilizando **integralmente** a camada `db/` já implementada e validada (schema, migrations, transação auditada, precisão fixa em centavos).

**Banco:** SQLite local via `node:sqlite` (a instalação já criada em `IMPLEMENTACAO-BANCO-DE-DADOS.md`).

**Autenticação:** JWT (HS256) via `hono/jwt` — access token + refresh token com rotação; hash de senha com `scrypt` (`node:crypto`), sem dependência nativa.

**Validação:** Zod 4.x (DTOs por rota).

**Motivo da escolha:**

1. **Integração com o ecossistema atual sem introduzir stack nova.** `hono`, `@hono/node-server`, `zod` e `drizzle-orm` **já estão presentes** no `node_modules` do projeto — fazem parte do ecossistema Cloudflare/vinext do front-end React (`app/`). Nenhuma stack estranha é adicionada; o pedido "não introduza outra stack sem necessidade" é respeitado.
2. **O banco é `node:sqlite`, uma API do Node.** Logo o backend precisa rodar em Node. Hono roda nativamente em Node (`@hono/node-server`) e, se o projeto migrar para Cloudflare D1 (decisão D01), o mesmo framework roda no runtime Workers — a escolha não fecha portas.
3. **Reaproveita a fundação de dados já validada.** A camada `db/` já entrega transação com autoria/auditoria, imutabilidade de movimentos, migrations versionadas com checksum e exclusão RESTRICT. O backend usa essa camada como está, sem remodelar o banco.
4. **Maturidade e manutenção.** Hono, Drizzle e Zod são bibliotecas maduras, TypeScript-first, amplamente adotadas. Hono traz middlewares prontos e testados para JWT, CORS, secure-headers e body-limit.
5. **Organização e segurança.** Hono não impõe um framework de DI pesado; permite arquitetura modular por pastas (config/database/common/auth/users/roles/permissions/modules), com middlewares centralizados de autenticação, autorização, validação e erros.

## 2. Divergências e adaptações registradas (nenhuma alteração silenciosa)

Conforme a regra "não faça alterações silenciosas", as incompatibilidades entre o pedido genérico e as decisões já tomadas nas etapas anteriores estão registradas aqui. **Nenhuma delas altera o banco/modelagem.**

### Divergências encontradas na modelagem

A camada ORM **não foi remodelada**: o backend usa o schema Drizzle existente (`db/schema.ts`), que já representa fielmente tabelas, PKs, FKs, nullable, índices, enums (`db/domains.ts`), timestamps e constraints (conforme a auditoria estrutural em `IMPLEMENTACAO-BANCO-DE-DADOS.md`). Não foram encontradas divergências que exigissem alterar entidades. Notas:

- **E35 `obra_compromissos`** permanece intencionalmente não criada (condicionada a D15). Sem impacto na fundação.
- **E01 `usuarios`** já contém exatamente os campos necessários para autenticação: `nome`, `email` (único por `lower(trim())`), `senha_hash` (nullable), `perfil_codigo` (enum), `ativo` (default `false`, com CHECK exigindo perfil quando ativo). Nenhum campo novo foi inventado.
- **`soft delete`** não é global: existe só onde a modelagem previu (`ativo`, `removida_em`, `substituida_em`, estados de ciclo de vida). Não foi adicionado `deleted_at` genérico.

### Adaptações de configuração e arquitetura

1. **Banco é arquivo, não cliente-servidor.** O roteiro sugere `DATABASE_HOST/PORT/NAME/USER/PASSWORD`. O banco escolhido/implementado é **SQLite local** (`node:sqlite`), um arquivo — não há host, porta, usuário ou senha de servidor. O backend usa **`DATABASE_PATH`**, exatamente como `db/local.ts`. As variáveis de servidor SQL não se aplicam e são documentadas como tal no `.env.example`. **Impacto:** nenhum; apenas nomes de variáveis diferentes por causa do banco já escolhido.
2. **Sem `synchronize: true`.** Drizzle não sincroniza schema automaticamente. Toda alteração estrutural passa por migrations SQL versionadas com checksum (`db/migrations.ts`), já existentes. O item "não usar synchronize em produção" já é atendido pela arquitetura.
3. **Perfis e permissões: política em código, não tabelas (D02).** A modelagem aprovou explicitamente **não** criar `perfis/permissoes/usuario_perfil/perfil_permissao` nesta fase (seção 10 da modelagem). A estratégia mínima é: `usuarios.perfil_codigo` (enum hoje com o único valor `administrador`) + uma **matriz de permissões versionada na aplicação**. O backend implementa perfis/permissões como catálogo em código (`roles/`, `permissions/`), verificado no servidor a cada operação. A estrutura foi desenhada para migrar para tabelas no futuro **se** D02 exigir múltiplos perfis editáveis — o que seria uma nova decisão + migration, não uma adição silenciosa agora.
4. **Revogação de sessão (atualizada em 14/09/2026).** Refresh continua como JWT assinado com segredo próprio e rotação, mas a revogação deixou de ser uma denylist em memória: `0003_revogacao_sessoes` adicionou a tabela técnica `__auth_revocations`, contendo somente JTI/SID e expiração. A inserção única é o consumo atômico do refresh e impede duas sucessoras concorrentes. O SID identifica toda a família, o logout a encerra e a revogação sobrevive ao reinício do processo quando as instâncias compartilham o mesmo SQLite. A mudança e seus limites estão documentados em `INTEGRACAO-MODULOS.md`.
5. **Backend é um processo Node separado do worker Cloudflare do front.** `node:sqlite` não existe no runtime Cloudflare Workers, então o backend roda como processo Node próprio (Hono + `@hono/node-server`) servindo `/api`, com o SQLite local — exatamente a "futura API local Node" prevista em `IMPLEMENTACAO-BANCO-DE-DADOS.md`. Migrar para D1 é D01 e exige adaptar o acesso transacional; fora do escopo desta fase.
6. **Runtime de execução.** O projeto exige **Node.js >= 24.15.0** (onde `node:sqlite` é estável e o TypeScript roda nativamente, sem flags) — coerente com os scripts `db:*` existentes. O ambiente de verificação desta sessão tinha Node 22.20.0; a verificação local foi feita com `--experimental-sqlite --experimental-strip-types`. Os scripts oficiais permanecem sem flags (alvo Node 24), como os `db:*`.
7. **`hono`/`@hono/node-server` ausentes do `package-lock` restaurado.** Estão presentes em `node_modules` (via ecossistema), mas não constavam como dependências diretas. Foram **declarados** em `package.json` e o `package-lock.json` foi atualizado (`npm install --package-lock-only`); uma instalação limpa em Node 24 os resolve.
8. **Alvo do TypeScript nas configs de typecheck.** A remoção do Angular restaurou um `tsconfig.json` (React) com `target: ES2017`, abaixo do que a camada `db/` exige (usa literais `BigInt`, que precisam de `target >= ES2020`). Corrigido definindo `target: ES2022` **apenas** em `tsconfig.db.json` e `tsconfig.server.json` (configs especializadas de typecheck) — o `tsconfig.json` do front React não foi alterado. Além disso, o `node_modules` atual contém um TypeScript `6.0.3` (herdado do scaffold Angular) que reporta esse erro de forma incorreta mesmo com o `target` correto; o `package-lock` do React fixa `5.9.3`, sob o qual `api:typecheck` e `db:typecheck` passam sem erros (verificado nesta sessão). Uma instalação limpa alinha o TypeScript em 5.9.3.

## 3. Estrutura criada

Backend modular em `server/`, reutilizando `db/` como fundação de dados. Cada pasta tem uma responsabilidade única; nenhuma lógica gigante em controllers ou services genéricos.

```text
server/
  index.ts                    Entrada: startup fail-fast (config → ping do banco → schema pronto), serve, shutdown gracioso
  app.ts                      Monta o app Hono (middlewares globais + rotas + tratamento central de erros)
  config/
    env.ts                    Configuração validada por Zod; segredos sem default; falha clara na inicialização
  common/
    errors.ts                 Classes de erro reutilizáveis (Validation/Unauthorized/Forbidden/NotFound/Conflict/BusinessRule/TooManyRequests/Internal)
    error-handler.ts          onError central → envelope padrão; esconde detalhes internos em produção
    http.ts                   Helpers de resposta (ok/created/collection/noContent) e corpo de erro
    validation.ts             readJson/readQuery/readParams com schemas Zod (rejeita antes das regras)
    zod.ts                    Converte issues do Zod em details do erro
    logger.ts                 Log estruturado em JSON, com redação de segredos
    request-logger.ts         requestId + log por requisição (sem corpo/headers/tokens)
    security.ts               CORS por ambiente, secure headers, limite de payload, rate limit
    types.ts                  AppEnv (contexto Hono tipado)
  database/
    connection.ts             withRead / withTransaction sobre db/, pingDatabase, assertSchemaReady
  auth/
    password.ts               Hash/verify de senha com scrypt (centralizado)
    tokens.ts                 JWT access + refresh (sign/verify), store de revogação
    auth.middleware.ts        requireAuth (guard de autenticação)
    auth.service.ts           login / refresh / logout
    auth.routes.ts            /api/auth/{login,refresh,logout,me}
    dto.ts                    Schemas de login/refresh/logout
  users/
    users.service.ts          create/find/list via transação auditada
    users.mapper.ts           Views seguras (sem senha_hash)
    users.routes.ts           /api/users (protegido por autenticação + permissão)
    dto.ts                    Schemas de criação/id
  roles/
    roles.ts                  Política perfil → permissões (em código, D02 mínimo)
  permissions/
    permissions.ts            Catálogo de permissões (recurso:acao)
    authorize.middleware.ts   requirePermission (guard de autorização)
  health/
    health.routes.ts          GET /health (app + banco)
  modules/
    index.ts                  Registro para módulos de negócio futuros (vazio nesta fase)

scripts/create-admin.mjs      Admin inicial dirigido por variáveis de ambiente (sem senha no código)
tsconfig.server.json          Typecheck do backend
tests/server/*.test.mjs       Testes da infraestrutura (auth, users, erros, banco, rate limit)
```

## 4. Como executar

**Requisitos**

- Node.js **>= 24.15.0** (onde `node:sqlite` é estável e o TypeScript roda nativamente). npm 10+.
- Banco SQLite embutido via `node:sqlite` — **sem servidor de banco** para instalar.
- Em Node 22.x é possível rodar acrescentando as flags `--experimental-sqlite --experimental-strip-types` aos comandos `node` (os scripts oficiais são para Node 24, sem flags — como os `db:*`).

**Instalação**

```bash
npm ci      # ou: npm install
```

**Configuração**

```bash
cp .env.example .env
# Edite .env: defina JWT_SECRET e JWT_REFRESH_SECRET (>= 32 caracteres, diferentes),
# APP_PORT, CORS_ORIGINS (obrigatório em produção), etc. Nunca versione .env.
```

**Banco (a partir do zero)**

```bash
npm run db:migrate        # aplica as migrations e cria todo o schema
npm run db:seed           # opcional: categorias estruturais de despesa
ADMIN_EMAIL=admin@exemplo.com ADMIN_PASSWORD='senha-forte-1234' npm run db:create-admin
```

**Inicialização**

```bash
npm run api:dev           # desenvolvimento (com --watch)
npm run api:start         # produção
```

O backend falha de forma clara e controlada se: alguma variável crítica estiver ausente/invalida; o banco estiver inacessível; ou as migrations não tiverem sido aplicadas.

**Testes**

```bash
npm run api:test          # testes da infraestrutura do backend (auth, users, erros, banco, rate limit)
npm run test:db           # testes da camada de banco existente
```

**Build / typecheck**

```bash
npm run api:typecheck     # tsc -p tsconfig.server.json (Node roda TS nativamente; não há transpilação para executar)
```

## 5. Testes executados

Executados nesta sessão com Node 22.20.0 + `--experimental-sqlite --experimental-strip-types` (o ambiente não dispunha de Node 24; os scripts oficiais são para Node 24). Cada arquivo de teste roda em processo isolado com um banco SQLite temporário migrado do zero.

| Suíte | Resultado | Cobre |
| --- | --- | --- |
| `tests/server/auth.test.mjs` | **12/12** | login válido; senha inválida; usuário inexistente; usuário inativo (403); payload inválido (400); endpoint protegido sem token (401); token válido; token inválido; token expirado; refresh com rotação/revogação; logout revoga token; política de autorização |
| `tests/server/users.test.mjs` | **8/8** | criação (201); senha só como hash scrypt, nunca em texto/retorno; e-mail duplicado (409); duplicidade case-insensitive; sem autenticação (401); id inexistente (404); campos controlados rejeitados (strict); envelope de listagem |
| `tests/server/errors.test.mjs` | **10/10** | 400/401/403/404/409/422/429 no envelope único; 500 sem vazar detalhes internos; rota inexistente (404); formato uniforme |
| `tests/server/database.test.mjs` | **3/3** | banco vazio falha claramente; migrations criam 37 tabelas do zero; conexão e schema prontos |
| `tests/server/ratelimit.test.mjs` | **1/1** | `/auth/login` limita tentativas abusivas (429) |
| **Backend (api:test)** | **34/34** | — |
| `tests/database.test.mjs` (test:db) | **25/25** | camada de banco existente permanece íntegra |

Verificações adicionais:

- **Typecheck** `tsconfig.server.json` e `tsconfig.db.json`: **0 erros** sob o TypeScript fixado (5.9.3). (Sob o TypeScript 6.0.3 obsoleto do `node_modules` atual há falso-positivo de `BigInt`; ver divergência 8.)
- **Inicialização real ponta a ponta** (Node + `@hono/node-server`, porta 3099, banco temporário): `db:migrate` (3 migrations, schema do zero) → `db:create-admin` → servidor no ar → `GET /health` = `{"status":"ok","db":"up"}` → `POST /api/auth/login` devolveu token/refresh/expiresAt + usuário sem `senha_hash` + permissões → `GET /api/auth/me` com token → `GET /api/users` sem token = **401** → `GET /api/users` com token = `{ "data": [...] }` sem `senha_hash`.
- **Lock**: `hono`, `@hono/node-server` e `zod` declarados em `package.json` e presentes no `package-lock.json`.

## 6. Resumo de entrega

**Stack:** Node.js + TypeScript (nativo) · framework **Hono** (+ `@hono/node-server`) · ORM **Drizzle** (camada `db/` existente) · banco **SQLite** (`node:sqlite`) · autenticação **JWT** (access + refresh) com hash **scrypt** · validação **Zod**.

**Estrutura:** `server/` modular (config, database, common, auth, users, roles, permissions, health, modules) — ver seção 3. Responsabilidades separadas; middlewares centralizados; sem services genéricos gigantes.

**Banco:** conexão e transação auditada reutilizadas de `db/` (uma conexão por unidade de trabalho, escrita com autoria/auditoria, imutabilidade de movimentos). Migrations SQL versionadas com checksum (`db:migrate`); banco criado do zero validado; **sem** `synchronize`. Entidades usadas nesta fase: `usuarios` (E01) e `auditoria_eventos` (E38, automático) — nenhuma nova entidade criada.

**Autenticação:** `POST /api/auth/login` localiza o usuário, valida a senha (scrypt, comparação em tempo constante), verifica acesso (ativo + perfil suportado), emite access token (curto) e refresh token (longo, rotacionado a cada uso), e devolve apenas dados seguros. `POST /api/auth/refresh` rotaciona e revoga o refresh anterior. `POST /api/auth/logout` revoga o token atual. `GET /api/auth/me` devolve usuário + permissões, sem senha/hash/tokens. Guard central `requireAuth` protege rotas privadas (recarrega o usuário do banco a cada requisição).

**Perfis e permissões:** estratégia mínima aprovada (D02): `usuarios.perfil_codigo` (hoje só `administrador`) + matriz de permissões versionada em código (`roles/`, `permissions/`), verificada no servidor por `requirePermission`. Sem tabelas de RBAC (decisão preservada). Preparado para expandir por módulo e, se necessário no futuro, migrar para o banco.

**Segurança:** senha sempre com hash scrypt (nunca em texto, retorno ou log); segredos fora do código (validados na inicialização); autorização no servidor (não depende do front esconder botões); `.strict()` nos DTOs (bloqueia campos extras/controlados pelo sistema); CORS por ambiente (produção sem default permissivo); secure headers; limite de payload; rate limit em `/auth/login` e `/auth/refresh`; logs estruturados com redação de segredos; erros internos não vazam em produção.

**Tratamento de erros:** envelope único `{ "error": { "code", "message", "details?" }, "requestId?" }`, categorizado (400 VALIDACAO, 401 NAO_AUTENTICADO, 403 SEM_PERMISSAO, 404 NAO_ENCONTRADO, 409 CONFLITO, 422 REGRA_NEGOCIO, 429 MUITAS_TENTATIVAS, 500 ERRO_INTERNO) via classes reutilizáveis e um handler central.

**Testes executados:** 34/34 (backend) + 25/25 (banco) + typecheck limpo + boot ponta a ponta — ver seção 5.

**Arquivos criados/alterados:** criados `server/**` (25 arquivos), `scripts/create-admin.mjs`, `tsconfig.server.json`, `tests/server/*.test.mjs` (6 arquivos), `IMPLEMENTACAO-BACKEND.md`; alterados `package.json` (deps + scripts), `package-lock.json`, `.env.example`, `tsconfig.db.json` (target).

**Pendências (registradas, não bloqueiam a fundação):**

- **Escala de sessão:** a revogação agora é durável no arquivo SQLite e compartilhada por processos que usam esse arquivo. Uma implantação distribuída com bancos independentes ainda exigirá store compartilhado; isso depende da decisão D01 de arquitetura/multitenancy.
- **Runtime de verificação:** o ambiente desta sessão tinha Node 22.20.0; a validação usou flags experimentais. A execução oficial requer Node >= 24.15.0.
- **Instalação limpa:** o `node_modules` atual ainda reflete o scaffold Angular anterior (inclui TypeScript 6.0.3). Um `npm ci` em Node 24 alinha as dependências (TypeScript 5.9.3, backend, sem Angular).
- **Múltiplos perfis/permissões editáveis pelo produto:** dependem de D02; só então as tabelas de RBAC seriam modeladas.
- **CORS de produção:** `CORS_ORIGINS` deve ser configurado explicitamente no deploy.
