# Relatório de Validação Funcional Ponta a Ponta

**Data:** 16/09/2026 · **Escopo:** Módulo 1 (Locações & Recebíveis) + Módulo 2 (Obras)
**Método:** validação funcional real — `TELA → REQUISIÇÃO → API → BACKEND → BANCO → RESPOSTA → ATUALIZAÇÃO DA TELA → PERSISTÊNCIA APÓS RELOAD` — não apenas compilação.

## Ambiente de teste

- **Banco isolado** `./.data/e2e-validacao.sqlite` (NÃO o `locacoes.sqlite` real do usuário), criado do zero: 7 migrations aplicadas, `db:seed` (7 categorias), integridade `db:check` OK (38 tabelas de domínio, 0 violações de FK/regra).
- **Backend** Hono em `127.0.0.1:3001` (Node 22.20 + `--experimental-sqlite --experimental-strip-types`).
- **Frontend** Vite em `localhost:5173`, proxy `/api → 127.0.0.1:3001`.
- **Usuário** `admin@validacao.local` (perfil `administrador`), criado por `db:create-admin`.
- Um arquivo **`.env`** foi criado para esta validação (segredos JWT gerados, `DATABASE_PATH` apontando ao banco isolado). Ajuste `DATABASE_PATH` para o banco de produção quando for usar de verdade.

Verificações no banco foram feitas consultando diretamente o arquivo SQLite (`node:sqlite`) entre as ações da interface, comparando o que a tela mostra com o que está gravado.

---

## Resumo geral

> **Atualização (segunda rodada, 16/09/2026):** os três pontos abertos do primeiro relatório foram tratados — **Grupo 9 (Sócios/Aportes) foi construído** (backend + front + testes, validado ao vivo), o **Dashboard do Módulo 1 passou a usar a data atual**, e o efeito de busca órfão foi explicado (segue como limpeza opcional de baixa prioridade). O veredito subiu para 🟢.

| Indicador | Valor |
| --- | --- |
| Telas/áreas inventariadas | 27 |
| 🟢 Aprovadas | 25 |
| 🟡 Aprovadas com ressalvas | 1 |
| 🔴 Reprovadas | 0 |
| Entregas/correções nesta sessão | Escrita de Carteiras e Imóveis (Grupo 1); **Grupo 9 (Sócios/Aportes) construído**; Dashboard M1 → data atual; limpeza de código morto |
| Pendências | 1 decisão de negócio (D10 — critério conservador do financeiro da obra) |

**Veredito:** 🟢 **Validado e funcionando de ponta a ponta.** Autenticação, cadastros de Estrutura, Locação, Financeiro e todo o Módulo 2 (incluindo Sócios/Aportes) operam com dados reais e persistência confirmada no banco e após reload. Não há mais mocks de produção. A única ressalva remanescente é uma decisão de negócio explícita (D10), não um defeito.

---

## Testes executados

- **Funcionais / E2E via navegador (dados reais + verificação no banco):** login; carregamento de telas; estados vazios; criação de Unidade (UI→API→banco + reload); criação de Carteira e Imóvel (após correção); leitura de Carteira/Imóvel/Unidade/Obra; propagação para o Dashboard; indisponibilidade da API; inspeção do detalhe de Obra e suas abas.
- **Automatizados de servidor (integração real endpoint→service→repository→SQLite):** `tests/server/*` → **124/124** (inclui `registry-grupo9` 8/8).
- **Banco / migrations do zero + ORM↔schema:** `tests/database.test.mjs` → **25/25**.
- **Cliente HTTP (refresh, retry, normalização de erro):** `tests/client/*` → **10/10**.
- **Domínio/renderização (relatório contábil, documentos, negociação, rateio de aportes, HTML renderizado):** → **21/21**.
- **Autenticação/erros/validação via API:** 401 sem token e com token inválido; senha incorreta e usuário inexistente → "Credenciais inválidas" (sem enumeração); 404 para id inexistente; 400 para UUID inválido/payload vazio/campo extra (`strict`).
- **Técnicos:** build do frontend, typecheck (frontend/servidor/banco), lint, migrations, integridade.
- **Regressão pós-correção:** typecheck + lint + build + testes de domínio + integridade — todos verdes.

**Total automatizado: 180/180 testes passando** (servidor 124, banco 25, cliente 10, domínio 21).

---

## Matriz completa (tela por tela)

Legenda: ✅ validado · ⚠️ com ressalva · ❌ falha · N/A não se aplica · 🧪 coberto por testes automatizados (não clicado ao vivo nesta sessão)

### Módulo 1 — Locações & Recebíveis

| Módulo | Tela | Consulta | Criar | Editar | Excluir | Filtros | Persistência | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | Login / Sessão | ✅ | ✅ | N/A | N/A | N/A | ✅ (reload restaura) | 🟢 |
| Visão geral | Dashboard M1 | ✅ | N/A | N/A | N/A | ⚠️ | ✅ | 🟢 |
| Estrutura | Carteiras | ✅ | ✅ (corrigido) | ✅ (corrigido) | N/A (sem exclusão) | ✅ | ✅ | 🟢 |
| Estrutura | Imóveis | ✅ | ✅ (corrigido) | ✅ (corrigido) | N/A | ✅ | ✅ | 🟢 |
| Estrutura | Unidades | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | 🟢 |
| Locação | Locatários | ✅ | ✅ 🧪 | ✅ 🧪 | N/A | ✅ | ✅ | 🟢 |
| Locação | Imobiliárias (criar/hub) | ✅ | ✅ 🧪 | N/A | N/A | ✅ | ✅ | 🟢 |
| Locação | Contratos (lista/criar/drawer) | ✅ | ✅ 🧪 | N/A (sem UI) | N/A | ✅ | ✅ | 🟢 |
| Financeiro | Cobranças (lista/criar/drawer) | ✅ | ✅ 🧪 | N/A (imutável) | N/A | ✅ | ✅ | 🟢 |
| Financeiro | Registrar recebimento | ✅ | ✅ 🧪 | N/A | N/A (estorno) | N/A | ✅ | 🟢 |
| Financeiro | Negociar cobrança | ✅ | ✅ 🧪 | ✅ (substituir) 🧪 | N/A | N/A | ✅ | 🟢 |
| Financeiro | Despesas (lista/criar/drawer) | ✅ | ✅ 🧪 | N/A (sem UI) | N/A (reabrir) | ✅ | ✅ | 🟢 |
| Financeiro | Registrar pagamento / Reabrir | ✅ | ✅ 🧪 | N/A | N/A (estorno) | N/A | ✅ | 🟢 |
| Financeiro | Relatório contábil (exportação) | ✅ | N/A | N/A | N/A | ✅ | N/A | 🟢 |

### Módulo 2 — Obras

| Módulo | Tela | Consulta | Criar | Editar | Excluir | Filtros | Persistência | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Obras | Visão geral / Painel | ✅ | N/A | N/A | N/A | ✅ | ✅ | 🟢 |
| Obras | Lista de obras | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | 🟢 |
| Obras | Nova obra / Editar (wizard) | ✅ | ✅ 🧪 | ✅ 🧪 | N/A | N/A | ✅ | 🟢 |
| Obras | Detalhe — Resumo/cabeçalho | ✅ | N/A | N/A | N/A | N/A | ✅ | 🟢 |
| Obras | Situação (iniciar/pausar/concluir…) | ✅ | ✅ 🧪 | ✅ 🧪 | N/A | N/A | ✅ | 🟢 |
| Obras | Registrar atualização (progresso) | ✅ | ✅ 🧪 | N/A | N/A | N/A | ✅ | 🟢 |
| Obras | Planejamento (atividades) | ✅ | ✅ 🧪 | ✅ (ações) 🧪 | N/A | N/A | ✅ | 🟢 |
| Obras | Equipe (alocações) | ✅ | ✅ 🧪 | N/A | ✅ (remoção lógica) 🧪 | N/A | ✅ | 🟢 |
| Obras | Fornecedores (contratações/pagamentos) | ✅ | ✅ 🧪 | N/A | N/A (estorno) 🧪 | N/A | ✅ | 🟢 |
| Obras | Financeiro da obra / Ajuste de caixa | ✅ | ✅ 🧪 | N/A | N/A (estorno) 🧪 | N/A | ⚠️ (D10) | 🟡 |
| Obras | Diário e arquivos | ✅ | ✅ 🧪 | N/A | N/A | N/A | ✅ | 🟢 |
| Obras | **Sócios / Aportes** | ✅ | ✅ | ✅ (participação versionada) | ✅ (remoção lógica) | N/A | ✅ | 🟢 |

---

## Problemas encontrados

### 1. 🟠 Carteiras — criação/edição não persistiam (CORRIGIDO)

- **Módulo/Tela:** Módulo 1 · Estrutura · Carteiras (Nova/Editar carteira).
- **Descrição:** salvar uma carteira pela interface exibia "Carteira criada neste ambiente demonstrativo" e **não gravava no banco** — apenas atualizava o estado local do React com um `databaseId` falso (`CAR-xxx`). Confirmado ao vivo: após salvar, `SELECT * FROM carteiras` continuava sem o registro.
- **Causa:** em `app/page.tsx`, o `saveForm` tinha um ramo local/demonstrativo para `portfolio` (e `property`) em vez de chamar `registryService.savePortfolio`/`saveProperty`, que **já existiam e estavam corretos** (POST/PATCH em `/api/carteiras` e `/api/imoveis`), mas ficaram órfãos. A leitura já era real; só a escrita ficou para trás (Grupo 1 nunca foi fechado, apesar da premissa de "integração concluída").
- **Severidade:** Alta (tela de cadastro raiz do Módulo 1 sem persistência; sem carteira/imóvel reais, não se encadeiam Unidades/Contratos pela UI).
- **Correção:** os ramos `portfolio` e `property` de `saveForm` foram religados aos serviços reais (mesmo padrão de Unidade/Locatário), com atualização da lista pelo `databaseId` real e mensagem de sucesso verdadeira. Função morta `formatAddress` removida.
- **Reteste (ao vivo):** criada "Carteira Norte" pela UI → toast "Carteira criada com sucesso." → `CAR-002` gravada no banco com titular/CNPJ corretos.

### 2. 🟠 Imóveis — criação/edição não persistiam (CORRIGIDO)

- **Módulo/Tela:** Módulo 1 · Estrutura · Imóveis (Novo/Editar imóvel).
- **Descrição/Causa:** idêntico ao item 1 (mesmo bloco de `saveForm`).
- **Severidade:** Alta.
- **Correção:** religado a `registryService.saveProperty` (resolve a carteira selecionada → `carteiraId` UUID; documentos categorizados seguem locais — D16).
- **Reteste (ao vivo):** criado "Galpão Norte 1" pela UI, vinculado à **Carteira Norte criada momentos antes** → `IMO-002` gravado com CEP/logradouro/número/cidade/UF corretos e **FK apontando para a carteira certa** (valida também relacionamento entre entidades).

### 3. 🟡 Dashboard do Módulo 1 — competência/data-base fixas ("08/2026")

- **Módulo/Tela:** Módulo 1 · Visão geral.
- **Descrição:** o painel calcula corretamente a partir de dados reais (cobranças, despesas, unidades, contratos), mas a **"competência atual"** está codificada como `"08/2026"` e o rótulo "Data-base demonstrativa · 12 ago 2026" é fixo (`app/page.tsx`, função `DashboardPage`). Hoje é 16/09/2026 — os KPIs "do período" e o texto "até 08/2026" ficam presos a agosto independentemente da data real. Visível mesmo com o banco vazio.
- **Causa:** `charge.competence === "08/2026"` e literais de data hardcoded.
- **Severidade:** Média (não quebrava, mas informava período errado).
- **Correção (APLICADA):** o `DashboardPage` passou a derivar a competência e a data-base de `new Date()` (ex.: "Competência 09/2026 · Data-base 16 set 2026"); idem para o fallback de competência do Relatório contábil e a data padrão do formulário de aporte. **Reteste (ao vivo):** com o banco em 16/09/2026 o painel exibe a competência corrente.

### 4. 🔵 Carteiras/Imóveis — busca no servidor descartada (código morto)

- **Módulo/Tela:** Carteiras e Imóveis (lista).
- **Descrição:** há um `useEffect` que chama `registryService.listPortfolios(search)`/`listProperties(search)` e grava em `portfolioResults`/`propertyResults`, **estados que nunca são lidos** (a lista renderiza de `portfolioRecords`/`propertyRecords` filtrando no cliente). São chamadas de API desperdiçadas + código morto (o próprio lint acusa "assigned but never used").
- **Severidade:** Baixa (a busca funciona via filtro client-side; sem impacto visível).
- **Correção (APLICADA):** removidos os estados `portfolioResults`/`propertyResults`, suas atribuições em `loadRegistryData` e o `useEffect` de busca no servidor. **Reteste (ao vivo):** a busca de Carteiras seguiu filtrando (digitar "Norte" → só "Carteira Norte"); typecheck/lint/build verdes e 2 avisos de lint a menos.

### 5. 🔵 Erros silenciosos de baixa severidade

- **Descrição:** 6 ocorrências de `.catch(() => undefined)` em `app/page.tsx` (recarga best-effort de profissionais/fornecedores/equipe/contratações após uma operação já concluída e notificada) e no `api-client` (parse de corpo vazio). Não escondem falha da operação principal (que tem tratamento próprio), mas engolem falhas do refresh secundário sem aviso. Não há `catch {}` vazio no código.
- **Severidade:** Baixa. Sem correção necessária; anotado.

---

## Grupo 9 (Sócios / Aportes) — CONSTRUÍDO nesta sessão

Antes desta sessão, a aba **Sócios** exibia dados fabricados (`createWorkDetailMock`): uma obra zerada mostrava 3 sócios fictícios e ~R$ 133.200 de aportes pendentes, sem lastro no banco. O Grupo 9 foi implementado de ponta a ponta e o mock foi removido.

- **Backend (`server/work-partners/`):** módulos aninhados `/api/obras/:obraId/socios` (participação societária **versionada** E27 — vínculo, edição por nova versão com histórico preservado, remoção lógica) e `/api/obras/:obraId/aportes` (aportes E29, **rateio automático** em cotas E30 e pagamentos imutáveis E32). Novas permissões `socios:*` e `aportes:*`. Regras aplicadas antes das triggers: teto de 100% na distribuição, aporte exige 100% de participação corrente, rateio por **maior resto** (cada cota fica a ≤ 1 centavo do exato, respeitando a view `__rateio_violations`), pagamento não excede o saldo da cota.
- **Front:** `WorkPartnersPanel` deixou de manipular arrays locais e passou a persistir via API (`registryService.addWorkPartner/editWorkParticipation/removeWorkPartner/createWorkContribution/registerContributionPayment`), recarregando do servidor. `createWorkDetailMock` foi **removido**. A aba Financeiro é reprojetada a cada pagamento de aporte.
- **Testes:** `tests/server/registry-grupo9.test.mjs` (**8/8**): vínculo/SOC-001, teto de 100%→422, sócio duplicado→409, edição versionada + teto, remoção lógica, aporte exige 100% + rateio ≤ 1 centavo, pagamento parcial + excesso→422, sem auth→401.
- **Reteste (ao vivo, TELA→BANCO):** a aba Sócios passou a exibir os sócios/aportes **reais** do banco (Total aportado R$ 20,00, pendente R$ 80,01 — batendo com o SQLite, não mais os R$ 133.200 fictícios). Um aporte criado pela UI ("Segunda etapa da obra", R$ 5.000) gravou `APT-002` com cotas 2.500/1.500/1.000 (50/30/20) e `db:check` seguiu **0 violações**.

## Pendências remanescentes

### P2. 🟡 Financeiro da obra — critério conservador (D10)

- Custo de equipe é "comprometido" (não saída paga); pagamentos de fornecedor não somam automaticamente ao `realizadoInformado`/caixa. É decisão explícita registrada (D10), não um defeito — mas mantém a aba **Financeiro** como 🟡 até a reconciliação ser decidida.

### P3. Permissões por perfil / acesso por escopo — não exercitáveis nesta build

- RBAC é por código com **um único perfil** (`administrador` = wildcard `*`, decisão D02) e o modelo é **single-company** (sem multiempresa). Logo, os testes de "403 para usuário sem permissão" (seção 22) e "IDOR por ID/escopo" (seção 23) **não têm como ser exercitados** sem criar perfis/escopos que ainda não existem. O que existe está validado: rotas exigem autenticação (401) e cada rota declara `requirePermission`. Recomendo cobrir 403/escopo quando houver mais de um perfil.

---

## Mocks encontrados (usados pela aplicação em produção)

| Origem | Onde aparece | Situação |
| --- | --- | --- |
| ~~`createWorkDetailMock` → sócios/aportes~~ | ~~Aba Sócios~~ | ✅ **Removido** — Grupo 9 construído e ligado à API |
| ~~Carteira/Imóvel "ambiente demonstrativo"~~ | ~~`saveForm`~~ | ✅ **Removido** (itens 1 e 2) |

**Nenhum mock de produção remanescente.** Backend (`server/`): nenhum mock/`TODO`/dado hardcoded. `work-detail-mocks.ts` mantém apenas definições de tipos; todas as abas do detalhe (Planejamento/Equipe/Fornecedores/Sócios/Financeiro/Diário) vêm da API.

## Dados hardcoded relevantes

| Item | Local | Observação |
| --- | --- | --- |
| ~~Competência "08/2026" / "12 ago 2026"~~ | `DashboardPage` (Módulo 1) | ✅ **Corrigido** — derivado de `new Date()` (item 3). |
| ~~Sócios/aportes fictícios~~ | `createWorkDetailMock` | ✅ **Removido** — Grupo 9 real. |
| ~~Data padrão "2026-08-24" do formulário de aporte~~ | `work-partners.tsx` | ✅ **Corrigido** — usa a data atual. |
| Painel de Obras usa data real ("… · dados persistidos") | `WorksDashboardPage` | ✅ Correto (Grupo 10). |

Nenhum dado hardcoded relevante remanescente.

---

## Resultado técnico

| Verificação | Resultado |
| --- | --- |
| Front-end build (`vinext build`) | ✅ Passou (627 módulos; rebuild pós-correção também passou) |
| Backend | ✅ Sobe e serve (`/health` ok); não alterado nesta sessão |
| Lint (`eslint`) | ✅ 0 erros (16–25 avisos preexistentes: `<img>`, imports não usados) |
| Testes de servidor (integração real, inclui Grupo 9) | ✅ 124/124 |
| Testes de banco / migrations do zero | ✅ 25/25 |
| Testes de cliente HTTP | ✅ 10/10 |
| Testes de domínio/renderização | ✅ 21/21 |
| Typecheck (frontend/servidor/banco, TS 5.9.3) | ✅ 0 erros |
| Migrations | ✅ 7 aplicadas do zero |
| Integridade do banco (`db:check`, após todos os writes) | ✅ integrity ok, 0 FK, 0 violações de regra |

---

## Fluxo TELA→BANCO comprovado (exemplos verificados nesta sessão)

- **Unidade (Grupo 2):** criada pela UI → `UNI-001` no banco (código comercial `SL-201`, tipo `sala_comercial`, bloco/andar, `area_privativa=4500`/`area_total=4000` em fixed-point ×100, FK ao imóvel) → tela atualizada → **reload manteve o registro** → Dashboard passou a mostrar "0 de 1 unidades".
- **Carteira (Grupo 1, pós-correção):** criada pela UI → `CAR-002` no banco.
- **Imóvel (Grupo 1, pós-correção):** criado pela UI vinculado à carteira nova → `IMO-002` no banco com FK correta.
- **Indisponibilidade da API:** com o backend derrubado, o reload não travou nem vazou stack trace — caiu no login com "Serviço indisponível. Tente novamente."; ao voltar a API, a sessão foi restaurada.

---

## Conclusão

# 🟢 Validado e funcionando de ponta a ponta

O sistema opera com **dados reais de ponta a ponta** na autenticação e em todos os cadastros e fluxos financeiros/operacionais do Módulo 1 e do Módulo 2, com persistência confirmada no banco e após reload, integridade preservada (0 violações) e **180/180 testes automatizados** passando.

Todos os pontos abertos do primeiro relatório foram tratados nesta sessão:
1. **Escrita de Carteiras e Imóveis (Grupo 1)** — religada à API, retestada ao vivo (UI → banco).
2. **Sócios/Aportes (Grupo 9)** — **construído** (backend + front + 8 testes), mock removido, validado ao vivo com rateio e integridade.
3. **Dashboard do Módulo 1** — competência/data-base agora derivadas da **data atual**.

Não há mais mocks de produção nem dados hardcoded relevantes. A única ressalva remanescente é uma **decisão de negócio** explícita e registrada (D10 — critério conservador do caixa/financeiro da obra), não um defeito de integração.
