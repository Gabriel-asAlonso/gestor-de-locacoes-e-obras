# Locações e Recebíveis — Módulo 1 ("Sistema Karina")

Gestão de locações, contratos, cobranças, recebimentos e despesas (Módulo 1), com um módulo de obras em andamento.
Front React servido por vinext (Next sobre Vite/Cloudflare Worker) + API Hono com SQLite local.

## Stack
- **Front (`app/`):** React 19 via vinext 0.0.x (API de Next 16), Tailwind 4, lucide-react. Cliente HTTP em `app/services/api-client.ts`.
- **API (`server/`):** Hono + `@hono/node-server`, validação com zod, JWT (access + refresh), permissões por perfil.
- **Banco (`db/`, `drizzle/`):** SQLite via `node:sqlite` + Drizzle ORM. Migrations em `drizzle/` (com `drizzle/rollback/`).
- Node.js >= 24.15.0 (`engines`) (a confirmar: a máquina tem Node 22.20).

## Estrutura
- `app/`: páginas, componentes (`components/`), serviços de API (`services/`) e utilitários de domínio (`charge-negotiation.ts`, `accounting-report*.ts`...). Os arquivos `*-mocks.ts` são dados demonstrativos ainda não migrados para a API.
- `server/`: um módulo por domínio (`auth`, `contracts`, `charges`, `expenses`, `agencies`, `documents`, `permissions`...) com `*.routes.ts`, `*.service.ts` e `dto.ts`; infraestrutura comum em `server/common/`; env validado em `server/config/env.ts`.
- `db/`: `schema.ts`, `relations.ts`, `domains.ts`, `migrations.ts`, `seed.ts`, `local.ts`.
- `tests/`: `node:test` (`*.test.mjs`); `tests/server/`, `tests/client/`, `tests/helpers/`.
- `scripts/`: wrappers de build/install do ChatGPT Sites (só Linux) e `db.mjs`/`create-admin.mjs`.
- Muitos `.md` na raiz (auditorias, contrato da API, modelagem): documentação de referência.

## Comandos (raiz)
- `npm ci` · `npx vinext build` · `npm run dev` (front, http://localhost:5173, faz proxy de `/api` para 127.0.0.1:3001)
- API: `npm run api:dev` (exige `.env` com `JWT_SECRET`/`JWT_REFRESH_SECRET` de 32+ caracteres)
- Testes: `npm run api:test`, `npm run test:client`, `npm run test:db` e os de `tests/*.test.mjs` (os de HTML exigem build).
- Typecheck: `npm run typecheck:frontend`, `npm run api:typecheck`, `npm run db:typecheck`. Lint: `npx eslint . --ignore-pattern dist --ignore-pattern .next`.
- No Windows, **não** use `npm run build`, `npm run lint` nem `npm run install:ci`: são wrappers bash/Linux do Sites.

## Convenções
- Domínio e mensagens em português (`contratos`, `locatarios`, `carteiras`); nomes de arquivos/funções da API em inglês (`contracts.service.ts`, `listContracts`).
- Rotas Hono finas: `requireAuth` + `requirePermission(PERMISSIONS.X)`, entrada validada com `readJson/readQuery/readParams` + schema zod de `dto.ts`, resposta com `ok()`/`created()`.
- Services usam `withRead`/`withTransaction` de `server/database/connection.ts` e passam `WriteContext` (`actorId`) para auditoria.
- Erros de negócio com classes de `server/common/errors.ts` (`NotFoundError`, `BusinessRuleError`...).
- Valores monetários como string decimal com 2 casas (`db/fixed-point.ts`); datas `AAAA-MM-DD`.
- Imports TS com extensão `.ts` (`allowImportingTsExtensions`); o Node roda TypeScript direto.
- Mudança de schema: editar `db/schema.ts` → `npm run db:generate` → criar o rollback correspondente em `drizzle/rollback/` (a confirmar se o rollback é manual).

## Pontos de atenção
- **Proibido:** `git push sites` (publica no ChatGPT Sites), `npm run db:migrate`, `db:seed`, `db:rollback`, `db:create-admin` (atingem o SQLite da aplicação em `.data/`).
- Testes criam banco e env próprios em temp (`tests/server/setup.mjs`); nunca aponte testes para `.data/`.
- Nunca ler nem versionar `.env`; `.data/` (banco e uploads) é local e ignorado.
- Remoto `origin` = GitHub; remoto `sites` = hospedagem do ChatGPT Sites.
- `tests/access-management.test.mjs` e `tests/registration-validation.test.mjs` não estão em nenhum script (a confirmar se devem rodar).
