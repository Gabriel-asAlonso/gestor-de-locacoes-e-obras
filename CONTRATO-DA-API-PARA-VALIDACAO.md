# Contrato da API — Locações e Obras

Data: 14/09/2026. Versão: proposta de contrato 1.0. Situação: aguardando validação de negócio.

Referências: `MAPEAMENTO-FUNCIONAL-E-DADOS-MOCKADOS.md`, `MODELAGEM-BANCO-DE-DADOS-PARA-VALIDACAO.md` e `IMPLEMENTACAO-BANCO-DE-DADOS.md`.

## 1. Objetivo, escopo e limites

Este documento define **o contrato da API** que substituirá os dados mockados do front-end, sem implementar nada. Não há controllers, services, repositories, endpoints, autenticação ou middlewares nesta etapa. O objetivo é planejar rotas, verbos, parâmetros, corpos, respostas, erros, permissões e operações de negócio, para que a implementação posterior seja organizada e a troca dos mocks seja segura.

O contrato deriva das três fontes já validadas/documentadas:

- **Mapeamento funcional:** telas, ações, filtros, fluxos e regras do produto. A interface que consumirá esta API é o front-end **React** em `app/` (`app/page.tsx` e componentes irmãos) — direção única do projeto. As três fontes de referência descrevem o mesmo domínio; a versão React pode expor alguns campos, filtros e diálogos a mais, a confirmar contra `app/` na implementação.
- **Modelagem de dados:** 38 entidades (E01–E38), chaves, FKs, movimentos, históricos e as decisões pendentes D01–D20.
- **Implementação do banco:** 37 entidades criadas em SQLite/Drizzle, precisão fixa (centavos), auditoria transacional, imutabilidade de movimentos e exclusão RESTRICT.

### 1.1 Legenda (mantida das etapas anteriores)

- **E — evidenciado:** endpoint/dado que substitui diretamente uma origem ou ação existente no front-end.
- **S — sugestão:** endpoint/estrutura proposta para persistência, integridade ou consumo eficiente; precisa de validação.
- **Dxx — decisão de negócio pendente:** a rota/contrato apresentado é a hipótese; a decisão numerada (seção 10 da modelagem) pode alterá-lo. Um endpoint marcado `Dxx` não deve ser implementado antes da decisão correspondente.

“Obrigatório” nas tabelas de corpo é a obrigatoriedade proposta para a API. Toda regra financeira, de integridade e de imutabilidade citada aqui já está descrita na modelagem/implementação; este documento apenas expõe como a API a respeita.

### 1.2 Princípios que o contrato preserva

1. **Identidade por UUID.** O `:id` de rota é sempre o UUID. Códigos legíveis (`CAR-001`, `COB-0087`, `ATV-001`) são atributos de apresentação, **gerados pelo servidor** sob transação, nunca recebidos do cliente e nunca usados como chave de rota.
2. **Saldos e totais não existem como dado gravável.** Total faturado, recebido, saldo, quitação, ocupação, custo de equipe, progresso calculado, “vencido/próximo” etc. são **derivados na consulta**. A API os **retorna** em leituras, mas **nunca os aceita** no corpo de escrita.
3. **Movimentos são imutáveis.** Recebimentos, pagamentos, integralizações e ajustes não têm `PATCH`/`DELETE`. Correção é **estorno integral** (novo registro com `motivo`), exposto como ação específica.
4. **Autoria vem do token, não do corpo.** `created_by`/`updated_by`/`autor` são preenchidos pelo servidor com o usuário autenticado. O cliente não os envia.
5. **Datas fixas dos mocks não são default.** A base `2026-08-12` (Locações) e `2026-08-24` (Obras) é ficcional (D19). Datas de negócio são obrigatórias quando exigidas; instantes de auditoria vêm do relógio do servidor.
6. **A API representa o domínio, não a tela.** Rotas são recursos (`/api/cobrancas`), não nomes de telas (`/api/livro-de-cobrancas`). Modais e cards viram operações/consultas sobre recursos.
7. **Nada de tabelas/rotas para artefatos de UI.** Não há endpoint para “dashboard”, “card”, “toast”, “gráfico” como entidade; dashboards e gráficos são **consultas de leitura** sobre as fontes reais (seção 8).

---

## 2. Convenções gerais da API

### 2.1 Base, versão e formato

- Prefixo único: **`/api`**. Versionamento maior por caminho quando necessário: `/api/v1` (proposta S; iniciar em v1).
- `Content-Type: application/json; charset=utf-8` em requisições e respostas com corpo. Exceção: exportações binárias (XLSX) devolvem `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (seção 9).
- Datas de negócio: `YYYY-MM-DD` (DATE, sem fuso). Competência: `YYYY-MM-01` na API, apresentada como `MM/AAAA` pelo front. Instantes de auditoria: UTC canônico `YYYY-MM-DDTHH:mm:ss.sssZ`.
- **Dinheiro e percentuais são strings decimais** com casas fixas: `"1234.56"` (BRL, 2 casas), `"60.00"` (percentual, 2 casas), `"12.50"` (área/quantidade, 2 casas). Nunca `number` em ponto flutuante, nunca notação exponencial. Isso espelha `db/fixed-point.ts`, que rejeita `number`/exponencial/mais de duas casas.

### 2.2 Padrão de rotas

```text
GET    /api/recursos            # listar (filtrável, ordenável, pesquisável; paginação opcional)
GET    /api/recursos/:id        # detalhar por UUID
POST   /api/recursos            # criar
PATCH  /api/recursos/:id        # editar (parcial) — só onde a entidade é editável
DELETE /api/recursos/:id        # excluir/inativar — só onde permitido (ver 2.10 e seção 4)
POST   /api/recursos/:id/acao   # operação de negócio específica (seção 5)
```

- Substantivos no **plural**, `kebab`/`snake` consistente (usa-se plural em português: `carteiras`, `imoveis`, `unidades`, `locatarios`, `contratos`, `cobrancas`, `recebimentos`, `negociacoes`, `despesas`, `fornecedores`, `categorias-despesa`, `contas-financeiras`, `profissionais`, `socios`, `obras`, `documentos`).
- Sub-recursos aninhados **apenas** quando a identidade do filho é escopada pelo pai (seção 7): `/api/obras/:obraId/atividades`, `/api/aportes/:aporteId/cotas`.
- Proibido: verbos na URL (`/getContratos`, `/createContrato`), nomes de tela, ou expressar filtro no caminho quando um query param resolve.

### 2.3 Envelope de resposta

**Recurso único** — objeto direto do recurso:

```json
{ "id": "uuid", "codigo": "CAR-001", "nome": "…", "createdAt": "2026-09-14T12:00:00.000Z" }
```

**Coleção** — por padrão devolve o **conjunto filtrado completo** (o front React não pagina hoje), sempre dentro de `data`:

```json
{ "data": [ { "id": "uuid" } ] }
```

**Paginação é opcional.** O bloco `pagination` aparece **somente quando** o cliente envia `page`/`limit` (ver 2.5). Manter `data` como envelope único (em vez de um array cru) garante que ligar a paginação depois **não quebra o contrato** de quem já consome a lista:

```json
{
  "data": [ { "id": "uuid" } ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

**Erro** — formato único em toda a API:

```json
{
  "error": {
    "code": "REGRA_NEGOCIO",
    "message": "Descrição legível do problema.",
    "details": [ { "field": "valor", "rule": "excede_saldo", "message": "…" } ]
  }
}
```

`details` é opcional e usado principalmente em `400`/`422` para apontar campos/regras. `code` é um símbolo estável (não o texto), para o front reagir sem depender da mensagem.

### 2.4 Autenticação, autorização e autoria (D02)

- Toda rota, exceto `POST /api/auth/login`, `POST /api/auth/refresh` e `POST /api/auth/register`, exige autenticação. Proposta S: **Bearer token** (`Authorization: Bearer <token>`) emitido no login; sessão/refresh conforme D02. Sem status ativo ou perfil suportado, a resposta é `403`.
- O servidor deriva o **ator** do token e o aplica em `created_by`/`updated_by`/`autor_usuario_id`. O cliente **não pode** enviar esses campos (ver 2.10).
- Autorização por ação é verificada **no backend** em cada operação; possuir perfil apenas na UI não é proteção (seção 11). Enquanto D02 não define a matriz, o contrato assume um único perfil `administrador` com acesso total, sem autoelevação.
- **Idempotência de escrita (S):** `POST` de movimentos/criações aceita header opcional `Idempotency-Key: <uuid>`. Repetir a mesma chave com o mesmo payload devolve o mesmo resultado; payload diferente com a mesma chave → `409`. Não há tabela de domínio para isso (conforme modelagem 2.3).

### 2.5 Listagem: ordenação, pesquisa, filtros e paginação opcional

Todo `GET` de coleção aceita o conjunto abaixo. **O front React não pagina, não ordena por cabeçalho e não tem “limpar” unificado** (mapeamento 19). Por isso a listagem devolve, **por padrão, o conjunto filtrado completo**, e `page`/`limit` ficam disponíveis como **capacidade opcional** (**S**), sem obrigar o cliente a paginar. Nenhuma tela precisa de paginação hoje; o parâmetro existe só para não travar a evolução futura.

| Parâmetro | Tipo | Default | Regra |
| --- | --- | --- | --- |
| `page` | inteiro ≥ 1 | — (sem paginação) | **Opcional.** Omitir `page` e `limit` retorna tudo. Se enviado, exige `limit` |
| `limit` | inteiro 1–200 | — (todos os itens) | **Opcional.** Itens por página quando a paginação é usada; acima de 200 → `400` |
| `sortBy` | enum por recurso | definido por recurso | Só nomes na allowlist do recurso; nome fora da lista → `400` |
| `sortOrder` | `asc`\|`desc` | `desc` | — |
| `search` | texto | — | Pesquisa textual nos campos declarados do recurso (2.8) |

- **Sem `page`/`limit`:** a resposta é `{ "data": [...] }` com o conjunto inteiro (após filtros/pesquisa/ordenação). **Com** `page`/`limit`: acrescenta o bloco `pagination` (2.3).
- **Ordenação estável:** todo `sortBy` recebe desempate implícito por `id`/`codigo`, para ordenação determinística (e paginação consistente, quando usada). O backend **nunca** aceita nome de coluna arbitrário.
- **Filtros:** parâmetros adicionais por recurso, listados na seção 6. Só são suportados os filtros com utilidade evidente no front atual; filtros “por precaução” não entram (instrução 8 do pedido).
- **Pesquisa (2.8):** `search` faz *match* “contém”, ignorando acento e caixa, **sobre os campos declarados de cada recurso** (mesma semântica das telas). Um único `search` por recurso — não se criam nomes diferentes por módulo.

### 2.6 Categorias de campo no corpo

Cada tabela de corpo classifica os campos:

- **Obrigatório:** deve vir na criação; ausência → `400`.
- **Opcional:** pode vir ou ser omitido; ausência = `null`/default do servidor, nunca string vazia forjada.
- **Condicional:** obrigatório apenas quando outra condição vale (ex.: `motivo_estorno` só em estorno; `categoriaId` só em despesa de operação).
- **Proibido (server-controlled):** o cliente **não pode** enviar; se enviar, é ignorado ou rejeitado (`400`, configurável). Inclui: `id`, `codigo`, `createdAt/By`, `updatedAt/By`, qualquer **saldo/total/status derivado**, `ativo` (muda só por ação de inativar), datas/autores de auditoria.

### 2.7 Erros padronizados

| HTTP | `code` sugerido | Quando |
| --- | --- | --- |
| `400` | `VALIDACAO` | Corpo/params malformados, campo obrigatório ausente, tipo inválido, `sortBy` fora da allowlist, `limit` fora do intervalo |
| `401` | `NAO_AUTENTICADO` | Token ausente/expirado |
| `403` | `SEM_PERMISSAO` | Autenticado, mas perfil não autoriza a ação (D02) |
| `404` | `NAO_ENCONTRADO` | UUID inexistente ou fora do escopo do pai (sub-recurso) |
| `409` | `CONFLITO` | Duplicidade de chave de negócio (ex.: cobrança por contrato/competência), `Idempotency-Key` divergente, edição concorrente (versão desatualizada) |
| `422` | `REGRA_NEGOCIO` | Invariante de domínio violada (ex.: alocação excede saldo, participação > 100%, concluir obra sem 100%, estornar estorno) |
| `500` | `ERRO_INTERNO` | Falha não prevista; a transação é revertida |

`422` é reservado para **regra de negócio** (a operação é sintaticamente válida mas o domínio a recusa); `400` é para **forma**. Essa separação é intencional para o front distinguir “corrija o campo” de “essa ação não é permitida agora”.

### 2.8 Catálogo de enums (códigos estáveis)

Enums são **códigos estáveis sem acento** no transporte; o rótulo em português é responsabilidade do front (modelagem 2.1/5.3). Não há endpoint que “gere” a tela; os códigos abaixo são o contrato. Mapa código → rótulo atual do front entre parênteses.

- **contrato.estado** (S/D04): `rascunho`, `ativo`, `encerrado`, `cancelado`. *(hoje o front só rotula “Ativo”.)*
- **cobranca.status derivado** (não gravado): `vencida`, `proxima`, `em_aberto`, `parcial`, `negociada`, `recebida`.
- **despesa.status derivado** (não gravado): `vencido`, `pendente`, `pago`.
- **despesa.origem** (S/D08): `operacao`, `contratacao_obra`.
- **quitacao (item/despesa/cota/parcela, derivado):** `pendente`, `parcial`, `quitado`.
- **obra.estado**: `planejada`, `em_andamento`, `pausada`, `concluida`, `cancelada`.
- **obra.prioridade**: `baixa`, `media`, `alta`, `urgente`.
- **obra.risco_informado**: `dentro_prazo`, `atencao`, `em_atraso` *(concluída é projeção do estado, não risco)*.
- **obra.tipo_intervencao**: `obra`, `reforma`, `reparo`, `manutencao`, `emergencia`.
- **atividade.etapa**: `preparacao`, `execucao`, `entrega`.
- **atividade.estado**: `nao_iniciada`, `em_andamento`, `bloqueada`, `concluida`.
- **alocacao.modalidade**: `horas`, `diarias`.
- **contratacao.tipo_fornecimento**: `servico`, `produto`, `material`.
- **diario.tipo**: `atualizacao`, `ocorrencia`, `pendencia`, `arquivo`.
- **pendencia.severidade**: `informativa`, `atencao`, `critica` *(substitui `danger/warning/info`)*.
- **financeiro_obra.kind (projeção):** `aporte`, `ajuste`.
- **locatario.tipo_pessoa**: `PF`, `PJ`.
- **forma_pagamento (prevista/efetiva)**: `boleto`, `pix`, `transferencia`.
- **negociacao.motivo** (4 opções normalizadas — D07): valores atuais mapeados para códigos estáveis; “outro” não abre complemento hoje.
- **documento.estado** (S/D16): `referenciado`, `disponivel`, `retirado`.
- **movimento.natureza (derivada):** `original`, `estorno`.

---

## 3. Índice de recursos e rastreabilidade tela → API

### 3.1 Recursos e quais verbos existem

`C` criar, `R` ler (lista/detalhe), `U` editar, `X` excluir/inativar, `A` ações de negócio. “—” = não existe no fluxo atual (não criar CRUD só porque a tabela existe — instrução 5).

| Recurso | Entidade | C | R | U | X | A | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/auth` | E01 | — | R(sessão) | — | — | login/logout/refresh | D02 |
| `/api/usuarios` | E01 | C | R | U | X(inativar) | ativar/inativar | D02; hoje só admin visual |
| `/api/carteiras` | E02 | C | R | U | — | — | Sem exclusão no front |
| `/api/imoveis` | E03 | C | R | U | — | — | — |
| `/api/unidades` | E04 | C | R | U | — | — | Ocupação D03 |
| `/api/imobiliarias` | E05 | C | R | U(S) | — | — | Front só cria; editar é S |
| `/api/locatarios` | E06 | C | R | U | — | — | — |
| `/api/contratos` | E11/E12/E13 | C | R | U(rascunho) | — | encerrar/cancelar/ativar, gerar-cobranca | D04 |
| `/api/cobrancas` | E14/E15 | C | R | — | — | — | Emissão imutável |
| `/api/recebimentos` | E16/E17 | C | R | — | — | estornar | Movimento |
| `/api/negociacoes` | E18/E19 | C | R | — | — | substituir | Versões imutáveis |
| `/api/despesas` | E20/E21 | C | R | U(antes de pagar) | — | registrar-pagamento, reabrir, estornar-pagamento | D08/D09 |
| `/api/fornecedores` | E07 | C | R | U | X(inativar) | — | Cadastro único D08 |
| `/api/categorias-despesa` | E09 | C(S) | R | U(S) | X(inativar) | — | Catálogo |
| `/api/contas-financeiras` | E10 | C(S) | R | U(S) | X(inativar) | — | D12 |
| `/api/profissionais` | E08 | C | R | U | X(inativar) | — | D11 |
| `/api/socios` | E27 | C | R | U | X(inativar) | — | Cadastro global D13 |
| `/api/obras` | E22 | C | R | U | — | atualizar-progresso, mudar-estado | — |
| `/api/obras/:id/atividades` | E23 | C | R | — | — | concluir, bloquear, reprogramar | — |
| `/api/obras/:id/equipe` | E24/E25 | C | R | — | X(remover lógico) | — | — |
| `/api/obras/:id/contratacoes` | E07/E20/E21/E26 | C | R | — | — | registrar-pagamento, estornar-pagamento | D08 |
| `/api/obras/:id/participacoes` | E27/E28 | C | R | — | X(encerrar vigência) | — | D13 |
| `/api/obras/:id/aportes` | E29/E30/E31 | C | R | — | — | registrar-pagamento (cota), estornar | D13 |
| `/api/obras/:id/ajustes-caixa` | E32 | C | R | — | — | estornar | Movimento |
| `/api/obras/:id/diario` | E33 | C | R | — | — | — | Append-only |
| `/api/obras/:id/pendencias` | E34 | C | R | U | — | resolver | D14 |
| `/api/obras/:id/compromissos` | E35 | C? | R | U? | X? | — | **Só se D15** aprovar agenda |
| `/api/documentos` | E36/E37 | C | R | — | — | disponibilizar, retirar, vincular, desvincular | D16 |
| `/api/auditoria` | E38 | — | R | — | — | — | Append-only, só leitura |

### 3.2 Consultas derivadas (sem CRUD, só leitura)

| Recurso de leitura | Substitui no front | Seção |
| --- | --- | --- |
| `/api/dashboards/locacoes` | Painel `/inicio` (indicadores + gráficos ocupação/pulso) | 8.1 |
| `/api/dashboards/obras` | Painel `/obras/inicio` (indicadores + prioridades + compromissos) | 8.2 |
| `/api/obras/:id/resumo` | Aba Resumo do detalhe da obra | 8.3 |
| `/api/obras/:id/financeiro` | Aba Financeiro (projeção de aportes/ajustes/pagamentos) | 8.3 |
| `/api/relatorios/alugueis` (XLSX) | Modal “Relação de aluguéis” | 9 |
| `/api/meta/*` | Contadores de menu, opções de apoio | 10 |

### 3.3 Rastreabilidade completa (cada mock tem origem)

Cada fonte de mock listada no mapeamento (seção 1 daquele doc) recebe um endpoint. Resumo:

- `demo-data.ts` (carteiras, imóveis, unidades, locatários, imobiliárias, contratos, cobranças, despesas) → recursos 4.3–4.12.
- `works.data.ts` (obras, alertas/prioridades, compromissos) → 4.18, 8.2.
- `work-details.data.ts` (cronograma, equipe, fornecedores, sócios, aporte, financeiro, diário, pendências) → 4.19–4.25, 8.3.
- `app-store.service.ts` (acordos, recebimentos, detalhes de obra) → 4.10, 4.11, 4.19+.
- Constantes de componentes (usuário/perfil, opções de select, valores default) → 4.1/4.2 (usuário) e seção 10 (enums/apoio).

---

## 4. Contrato por recurso

Para evitar repetição, cada recurso lista: **finalidade**, **endpoints**, **corpo/campos** (com categoria), **query params específicos**, **forma da resposta** (lista vs detalhe), **erros de negócio específicos** e **permissões**. Os erros comuns (`400/401/403/404/500`) e os params de listagem (`page/limit/sortBy/sortOrder/search`) da seção 2 valem para todos e não são repetidos.

> Convenção de leitura das respostas: a **lista** retorna a forma “resumo” do recurso; o **detalhe** retorna a forma “completa”, incluindo o que a seção 7 define como embutido. Campos derivados aparecem só em leitura.

### 4.1 Autenticação e sessão — `/api/auth` (D02)

Finalidade: autenticar e encerrar sessão. Substitui o login simulado (650 ms) e o booleano em memória.

| Método | Rota | Finalidade |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticar e emitir token |
| `POST` | `/api/auth/register` | Solicitar acesso; cria usuário pendente, sem perfil e sem sessão |
| `POST` | `/api/auth/logout` | Encerrar a sessão atual |
| `POST` | `/api/auth/refresh` | Renovar token (S, se sessão com refresh) |
| `GET` | `/api/auth/me` | Dados do usuário autenticado e permissões efetivas |

Corpo de `login`:

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `email` | Obrigatório | e-mail | Validação de formato; normalizado (lower/trim) |
| `senha` | Obrigatório | string | **Nunca** logada/auditada; hash conforme D02 |

Resposta `login`/`me`:

```json
{
  "token": "…",
  "expiresAt": "2026-09-14T18:00:00.000Z",
  "usuario": { "id": "uuid", "nome": "…", "email": "…", "perfilCodigo": "administrador", "status": "ativo", "ativo": true },
  "permissoes": ["cobrancas:ler", "cobrancas:criar", "..."]
}
```

O cadastro público aceita estritamente `{ nome, email, senha }`, devolve `201` com `{ id, nome, email, status: "pendente", createdAt }` e nunca emite tokens. Campos administrativos, perfil, permissões, status e autoria são rejeitados. E-mail repetido devolve `409`.

Erros específicos: `401 NAO_AUTENTICADO` (credencial inválida — **sem** distinguir e-mail de senha), `403 SEM_PERMISSAO` (cadastro pendente/rejeitado/inativo ou perfil não suportado). **Regra:** qualquer e-mail sintaticamente válido **não** autentica mais (fim da simulação); exige credencial real e status ativo (D02).

### 4.2 Usuários — `/api/usuarios` (E01, D02)

Finalidade: identidade de acesso e autoria. Hoje só existe “Augusto Lima · Administrador” fixo. **Todo o recurso depende de D02** e não deve ser implementado antes dela.

Endpoints: CRUD padrão + `POST /api/usuarios/:id/ativar` e `POST /api/usuarios/:id/inativar`.

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `nome` | Obrigatório | string(200) | Apresentação |
| `email` | Obrigatório | e-mail | Único normalizado; `409` se duplicado |
| `perfilCodigo` | Condicional (para acesso) | enum | Só códigos suportados; default nenhum |
| `senha` | Condicional (D02) | string | Só se D02 escolher senha local; nunca retornada |
| `ativo` | Proibido | — | Muda só por ativar/inativar; default `false` |

Proibidos: `id`, `senhaHash`, `createdBy`, timestamps. Erros: `409` e-mail duplicado; `422` inativar usuário com autoria não apaga (RESTRICT) — inativação apenas revoga acesso.

### 4.3 Carteiras — `/api/carteiras` (E02)

Finalidade: organizar titularidade patrimonial. Telas: Carteiras (lista, drawer, modal criar/editar). Ações do front: nova, editar, ver detalhe. **Sem exclusão** (não existe no front).

Endpoints: `GET /`, `GET /:id`, `POST /`, `PATCH /:id`.

Corpo (criar/editar):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `nome` | Obrigatório | string(200) | — |
| `titularNome` | Obrigatório | string(200) | `holder` |
| `titularDocumento` | Obrigatório | string(32) | Normalização D18; **não** único em carteira |
| `gestorDescricao` | Opcional | string(200) | `manager`; texto livre, não FK |
| `descricao` | Opcional | texto | — |
| `observacoes` | Opcional | texto | — |

Proibidos: `properties`, `units` (contadores) — **removidos**; a contagem é derivada e volta no detalhe (seção 7). `id`, `codigo`, auditoria.

Detalhe retorna, além dos campos: `codigo`, `quantidadeImoveis`, `quantidadeUnidades`, `ocupacao` (derivados). Pesquisa (`search`): nome, titular, documento. Sem filtros. `sortBy`: `nome`, `createdAt` (S).

### 4.4 Imóveis — `/api/imoveis` (E03)

Finalidade: ativo físico. Telas: Imóveis (grid, drawer, modal). Ações: novo, editar, detalhe, filtrar por carteira.

Endpoints: `GET /`, `GET /:id`, `POST /`, `PATCH /:id`.

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `carteiraId` | Obrigatório | UUID | FK carteiras; `404` se inexistente/inativa |
| `nome` | Obrigatório | string(200) | — |
| `endereco` | Obrigatório | string(500) | Campo livre único (não inferir logradouro/número) |
| `tipo` | Opcional | enum | `edificio_comercial` default; opções da UI |
| `cep` | Opcional | string(16) | D18 |
| `cidade` | Opcional | string(120) | — |
| `uf` | Opcional | char(2) | Maiúsculas |
| `observacoes` | Opcional | texto | — |

Campos do modelo sem uso na tela (`street`, `number`, `district`, `municipalRegistration`, `registryNumber`, `registryOffice`, `manager`, `imagem_capa_caminho`): **não** entram no contrato inicial (D17/D18); expansão explícita depois. Proibidos: `units`, `id`, `codigo`, auditoria.

Query específica: `carteiraId` (filtro por carteira — E). Pesquisa: nome, endereço, carteira (nome). Detalhe retorna `unidadesTotal`, `unidadesOcupadas`, `unidadesDisponiveis`, `ocupacao` (derivados).

### 4.5 Unidades — `/api/unidades` (E04, D03)

Finalidade: espaço locável. Telas: Unidades (grid, drawer, modal). Ações: nova, editar, detalhe, filtrar por situação e imóvel.

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `imovelId` | Obrigatório | UUID | FK imóveis; `carteira` é derivada do imóvel (não enviar) |
| `nome` | Obrigatório | string(200) | Único por imóvel (D18); `409` se duplicado |
| `area` | Obrigatório | decimal string | `area_privativa`; `>= 0`, zero aceito |
| `ocupadaInformada` | Opcional | boolean | `occupied`; default `false`. **Fonte da ocupação é D03** |
| `tipo` | Opcional | enum | `sala_comercial` default |
| `observacoes` | Opcional | texto | — |

Proibidos: `portfolio` (derivado), `id`, `codigo`, auditoria. `code/block/floor/totalArea/municipalRegistration` fora do contrato inicial (D11/D18).

Query específica: `imovelId`; `ocupada` (`true`/`false`, mapeia “Ocupadas/Disponíveis”). Pesquisa: nome, imóvel, carteira. Detalhe: `contratoVigente` (derivado — primeiro contrato ativo por imóvel+nome enquanto D03/D04 não normalizam; ver seção 7).

### 4.6 Imobiliárias — `/api/imobiliarias` (E05)

Finalidade: parceiro responsável. Telas: hub e cadastro em Locatários. Front só **cria** (editar/excluir é S).

Endpoints: `GET /`, `GET /:id`, `POST /`, `PATCH /:id` (S).

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `razaoSocial` | Obrigatório | string(200) | `name` |
| `documento` | Obrigatório | string(32) | CNPJ; unicidade proposta D18 |
| `creci` | Obrigatório | string(40) | Sem unicidade global |
| `contatoNome` | Obrigatório | string(200) | — |
| `nomeFantasia` | Opcional | string(200) | — |
| `telefone` | Opcional | string(32) | — |
| `email` | Opcional | e-mail | Contato, não único |

Detalhe: `quantidadeLocatarios` (derivado). Pesquisa: razão social, fantasia, documento.

### 4.7 Locatários — `/api/locatarios` (E06)

Finalidade: parte locatária PF/PJ. Telas: Locatários (grid, hub, drawer, modal). Ações: novo, editar, filtrar por vínculo/imobiliária.

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `tipoPessoa` | Obrigatório | enum `PF`\|`PJ` | Default `PJ` |
| `nome` | Obrigatório | string(200) | Razão social/nome |
| `documento` | Obrigatório | string(32) | Único por tipo+documento normalizado (D18) → `409` |
| `nomeFantasia` | Opcional | string(200) | Participa da pesquisa |
| `contatoNome` | Opcional | string(200) | — |
| `telefone` | Opcional | string(32) | — |
| `email` | Opcional | e-mail | Não único |
| `imobiliariaId` | Opcional | UUID | FK imobiliárias; `null` = “sem imobiliária” |
| `observacoes` | Opcional | texto | — |

Proibidos: `contracts` (contador — derivado), `id`, `codigo`, auditoria. `preferredChannel/billingAddress/municipalRegistration` fora do contrato inicial (D18).

Query específica: `imobiliariaId`; `semImobiliaria=true`; `comContrato=true|false` (deriva de existência de contrato — E; a política de “com contrato” = vigência real é D04). Pesquisa: nome, documento, fantasia. Detalhe: `contratos` (resumo — ver 7), `quantidadeContratos` (derivado). **Renomear** locatário: a API resolve por FK; nomes em contratos/cobranças são atributos históricos/derivados, não propagação manual.

### 4.8 Contratos — `/api/contratos` (E11 + E12 unidades + E13 encargos, D04/D05)

Finalidade: pactuar locação e condições geradoras de cobrança. Telas: Contratos (grid, drawer, modal “Novo contrato”), botão “gerar cobrança”. Front hoje **só cria** e visualiza; **não edita**. O contrato inclui **unidades** e **encargos** como composição — geridos junto ao contrato, não como CRUD solto (seção 7).

Endpoints:

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/api/contratos` | Listar |
| `GET` | `/api/contratos/:id` | Detalhar (com unidades + encargos embutidos) |
| `POST` | `/api/contratos` | Criar (em `rascunho` por padrão; ativar é ação) |
| `PATCH` | `/api/contratos/:id` | Editar **somente em rascunho** (S/D04) |
| `POST` | `/api/contratos/:id/ativar` | rascunho → ativo (valida composição) |
| `POST` | `/api/contratos/:id/encerrar` | ativo → encerrado (auditado) |
| `POST` | `/api/contratos/:id/cancelar` | ativo/rascunho → cancelado (auditado) |
| `POST` | `/api/contratos/:id/cobrancas` | **Gerar cobrança** a partir do contrato (ver 4.9) |

Corpo (criar):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `imovelId` | Obrigatório | UUID | FK; um imóvel por contrato |
| `locatarioId` | Obrigatório | UUID | FK |
| `unidadeIds` | Obrigatório | UUID[] | **IDs reais** de unidades (fim do texto livre); todas do mesmo imóvel → `422` senão |
| `inicio` | Obrigatório | date | — |
| `terminoPrevisto` | Obrigatório | date | `>= inicio` senão `400`/`422` |
| `aluguelMensal` | Obrigatório | decimal string | `>= 0` (exigir `> 0` é D05) |
| `diaVencimento` | Obrigatório | int 1..31 | Default 10 |
| `encargos` | Opcional | objeto[] | Regras de encargo (abaixo); default `Aluguel + Condomínio` só se o negócio confirmar |
| `indiceReajuste` | Opcional | string(40) | `IPCA` default; texto, sem cálculo |
| `mesReajuste` | Opcional | int 1..12 | D05 |
| `formaPagamentoPrevista` | Opcional | enum | Preferência |
| `observacoes` | Opcional | texto | — |
| `estado` | Proibido | — | Nasce `rascunho`; muda por ação |
| `period`/`adjustment` | Proibido | — | Derivados de exibição |

`encargos[]` (E13): `{ ordem, nome, natureza: 'aluguel'|'encargo', valorBase? }`. `valorBase` **NULL** significa “ainda a definir antes de emitir” (não buscar preço em mock). No máximo uma regra de natureza `aluguel` por contrato (D05); regra `aluguel` não carrega `valorBase` (vem de `aluguelMensal`).

Campos modelados sem uso (garantia, multa, juros, assinatura, `paymentReference`, `firstChargeRule`, `documentName`, `occupancyDate`, `purpose`): fora do contrato inicial (D03/D05/D16).

Query específica: `carteiraId`, `imovelId`, `locatarioId`, `unidadeId`, `estado`. Pesquisa: código, locatário, imóvel, unidades. Erros: `409` (regras de vigência/exclusividade se D03/D04 exigirem), `422` (unidade de outro imóvel; ativar sem ao menos uma unidade; editar fora de rascunho). Efeitos colaterais atuais (ocupar unidades, incrementar contador) deixam de existir como escrita manual: ocupação é D03; contador é derivado.

### 4.9 Cobranças e itens — `/api/cobrancas` (E14/E15, D06)

Finalidade: obrigação de recebimento de um contrato/competência. Telas: livro de cobranças, drawer de composição/saldos, modal “Nova cobrança”. **Emissão imutável** — sem `PATCH`/`DELETE`. Itens são embutidos (emitidos atomicamente).

Endpoints: `GET /api/cobrancas`, `GET /api/cobrancas/:id`, `POST /api/cobrancas` (ou o atalho `POST /api/contratos/:id/cobrancas`).

Corpo (criar):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `contratoId` | Obrigatório | UUID | FK; contrato deve estar `ativo` (D04) |
| `competencia` | Obrigatório | date `YYYY-MM-01` | CHECK dia=1; **único por contrato/competência** (D06) → `409` |
| `itens` | Obrigatório | objeto[] | Ao menos um; composição emitida (abaixo) |
| `formaPagamentoPrevista` | Opcional | enum | Default `boleto` |
| `observacoes` | Opcional | texto | — |
| `portfolio/property/units/tenant` | Proibido | — | Derivados do contrato (não copiar) |
| `status` | Proibido | — | Derivado |

`itens[]` (E15): `{ ordem, nome, natureza: 'aluguel'|'encargo', vencimento (date), valor (decimal string >= 0), contratoEncargoId? (UUID), referencia? }`. **Snapshots imutáveis**: nome/natureza/valor/vencimento são fotografados na emissão; mudar o contrato depois não os altera. `contratoEncargoId`, se informado, deve pertencer ao contrato da cobrança.

**Geração assistida (S):** para reproduzir a tela “Nova cobrança” que monta itens a partir do contrato, a API pode oferecer `GET /api/contratos/:id/cobrancas/previa?competencia=YYYY-MM` que **calcula e devolve os itens candidatos** (aluguel + encargos com valor conhecido, vencimentos pela regra/dia), **sem gravar**. O cliente revisa e envia no `POST`. Valores desconhecidos voltam como `null` e **bloqueiam** a emissão até serem definidos (D05).

Detalhe retorna, além dos itens: `total`, `recebido`, `saldoOperacional`, `statusDerivado`, `negociacaoVigente?` (resumo), `recebimentos` (resumo) — todos derivados (seção 7). Query: `contratoId`, `carteiraId`, `status` (derivado — filtra por projeção), `competencia`, `locatarioId`, `imovelId`. Pesquisa: código da cobrança, código do contrato, locatário, imóvel. Erros: `409` duplicidade contrato/competência; `422` sem itens, item com valor indefinido, competência inválida.

### 4.10 Recebimentos — `/api/recebimentos` (E16/E17)

Finalidade: registrar dinheiro recebido de uma cobrança, com alocação. Tela: modal “Registrar recebimento”. **Movimento imutável**: sem `PATCH`/`DELETE`; correção é estorno.

Endpoints: `GET /api/recebimentos`, `GET /api/recebimentos/:id`, `POST /api/recebimentos`, `POST /api/recebimentos/:id/estornar`.

Corpo (criar):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `cobrancaId` | Obrigatório | UUID | Um recebimento paga **uma** cobrança |
| `dataRecebimento` | Obrigatório | date | **Sem** default de agosto (D19) |
| `valor` | Obrigatório | decimal string | `> 0`; **não pode superar o saldo operacional** → `422` |
| `alocacoes` | Obrigatório | objeto[] | Soma **exata** = `valor` (senão `422`) |
| `formaPagamento` | Opcional | enum | Pix/transferência/boleto |
| `contaFinanceiraId` | Opcional (D12) | UUID | FK contas |
| `referencia` | Opcional | string(250) | — |
| `creditDate/discount/interest/thirdPartyPayer/proofName/note` | Proibido/adiado | — | Zerados/iguais hoje; entram só com D09/D12/D16 |

`alocacoes[]` (E17): cada linha aponta para **um** alvo — `{ cobrancaItemId, valor }` **ou** `{ negociacaoParcelaId, valor }` (XOR). O alvo deve pertencer à cobrança; nenhum alvo pode receber acima do seu saldo. Com acordo vigente, as alocações vão às **parcelas**; sem acordo, aos **itens** (D07). **Prévia (S):** `GET /api/cobrancas/:id/recebimentos/previa?valor=…` devolve a distribuição sugerida por vencimento (corrigindo a divergência atual “ordem do array vs vencimento”, mapeamento 9), que o cliente pode ajustar.

`estornar` (corpo `{ motivo }` obrigatório): cria o estorno integral que reverte **exatamente** a composição original; não redistribui por saldos novos; não se estorna um estorno nem se duplica reversão (`422`); estorno que invalida a base de um acordo posterior é bloqueado (`422`, D09).

Query: `cobrancaId`, `contaFinanceiraId`, `dataInicio`/`dataFim`. Detalhe: alocações embutidas + `estornoDeId?`/`estornadoPorId?`.

### 4.11 Negociações — `/api/negociacoes` (E18/E19, D07)

Finalidade: preservar termos de cada acordo e as parcelas. Tela: modal “Negociar saldo”. **Versões imutáveis**; substituir encerra a vigência da anterior sem apagá-la.

Endpoints: `GET /api/negociacoes`, `GET /api/negociacoes/:id`, `POST /api/negociacoes` (nova/renegociação), `POST /api/negociacoes/:id/substituir`.

Corpo (criar):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `cobrancaId` | Obrigatório | UUID | Acordo cobre **um** saldo integral de uma cobrança (D07) |
| `desconto` | Obrigatório | decimal string | `0 <= desconto <= saldoBase`; default `"0.00"` |
| `acrescimo` | Obrigatório | decimal string | `>= 0`; default `"0.00"` |
| `entradaPrevista` | Obrigatório | decimal string | `>= 0` e `< totalNegociado` |
| `quantidadeParcelas` | Obrigatório | int 1..24 | Sem contar a entrada |
| `primeiroVencimento` | Obrigatório | date | Data do 1º pagamento parcelado |
| `dataAcordo` | Obrigatório | date | Data real do acordo (≠ createdAt) |
| `motivo` | Obrigatório | enum | 4 opções; “outro” sem complemento hoje |
| `saldoBase` | Proibido | — | **Servidor** fotografa o saldo remanescente sob bloqueio |
| `negotiatedTotal/financedAmount/schedule` | Proibido | — | Derivados; parcelas geradas atomicamente pelo servidor |

Regras (D07, já na modelagem 6.3): `totalNegociado = saldoBase − desconto + acrescimo`; entrada vira **parcela 0** quando `> 0` (com vencimento definido); parcelas 1..N somam `totalNegociado − entrada`; centavos divididos preservando o total; datas mensais ajustadas a meses curtos. Salvar acordo **não** recebe dinheiro. Resposta inclui `parcelas[]` geradas, `totalNegociado`, `totalFinanciado` (derivados). `substituir` usa apenas o saldo remanescente da versão anterior como nova base, preservando pagamentos e a cadeia (sem ciclos). Erros: `422` (entrada ≥ total, desconto > saldo, parcela impossível de ≥ 1 centavo), `409` (já existe versão vigente sendo alterada concorrentemente).

### 4.12 Despesas e pagamentos — `/api/despesas` (E20/E21, D08/D09)

Finalidade: obrigação a pagar a um fornecedor (operação **e**, via D08, contratação de obra). Telas: livro de despesas, drawer, modal “Nova despesa”, ações registrar pagamento/reabrir. Edição do cadastro **antes de qualquer pagamento**; depois, valores monetários travam.

Endpoints:

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET/POST` | `/api/despesas` | Listar/criar (origem `operacao`) |
| `GET/PATCH` | `/api/despesas/:id` | Detalhar/editar (edição limitada após pagamento) |
| `POST` | `/api/despesas/:id/pagamentos` | **Registrar pagamento** (parcial ou total) |
| `POST` | `/api/despesas/:id/pagamentos/:pagId/estornar` | Estornar pagamento (reabre saldo) |

> A criação de despesa **de obra** (origem `contratacao_obra`) acontece por `/api/obras/:id/contratacoes` (4.21), que cria despesa + especialização atomicamente. `POST /api/despesas` cria apenas origem `operacao`.

Corpo (criar operação):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `fornecedorId` | Obrigatório | UUID | FK fornecedores (cadastro único D08) |
| `descricao` | Obrigatório | string(500) | — |
| `categoriaId` | Obrigatório (operação) | UUID | FK categorias; obra não informa categoria |
| `valor` | Obrigatório | decimal string | `>= 0` operação |
| `vencimento` | Obrigatório | date | Substitui `dueIso` |
| `formaPagamentoPrevista` | Opcional | enum | Preferência |
| `contaFinanceiraPrevistaId` | Opcional | UUID | FK contas (D12) |
| `observacoes` | Opcional | texto | — |
| `origem` | Proibido | — | `operacao` fixo neste endpoint |
| `status/paidDate` | Proibido | — | Derivados de pagamentos |

`registrar-pagamento` (E21): `{ dataPagamento (date, obrigatória — sem default fixo), valor (>0, soma líquida ≤ obrigação senão 422), formaPagamento?, contaFinanceiraId?, observacoes? }`. **Parcialidade**: suportada pelo modelo; habilitar na tela de Locações é D08 (a UI atual quita o total). `estornar` exige `{ motivo }` e reabre o saldo (reabertura = reverter a baixa, não apagar data — D09).

Query: `status` (derivado: vencido/pendente/pago), `categoriaId`, `fornecedorId`, `origem`, `obraId` (para as de contratação), `dataInicio`/`dataFim`. Pesquisa: código, fornecedor, descrição. Ordenação default reproduz o front: `status` (vencido→pendente→pago) e depois `vencimento` asc. **Telecom**: a categoria já existe nos dados; o catálogo (4.14) inclui o valor antes de restringir o formulário (mapeamento 11.1).

### 4.13 Fornecedores — `/api/fornecedores` (E07, D08)

Finalidade: identificar o credor (empresa/pessoa), separado da contratação. **Cadastro único** compartilhado por Despesas e Obras (unificação S/D08). Telas: despesas e “Cadastrar fornecedor” de obra.

Endpoints: CRUD + `inativar`. Corpo: `{ nome (obrigatório, string 200) }` — **único dado de credor confirmado** (não exigir CNPJ/banco/endereço inexistentes). Não fundir credores por nome automaticamente. RESTRICT se usado. Query/pesquisa: `nome`. O código `FOR-001` dos mocks **não** é PK aqui; ele descreve a **contratação local** e migra para E26 (4.21).

### 4.14 Categorias de despesa — `/api/categorias-despesa` (E09)

Finalidade: padronizar categorias pesquisáveis. Catálogo inicial: Condomínio, Manutenção, Seguros, **Telecom**, Tributos, Utilidades, Outros (já semeadas no banco). Endpoints: `GET /` (principal), `GET /:id`; `POST`/`PATCH`/`inativar` são **S** (não há tela de administração hoje). Corpo (S): `{ codigo, nome }`. Não apagar categoria usada (só inativar).

### 4.15 Contas financeiras — `/api/contas-financeiras` (E10, D12)

Finalidade: identificar a conta que recebe/paga, substituindo nomes livres (“Banco Operacional”, “Conta de Recebíveis”, “Caixa administrativo”). Endpoints: `GET /`, `GET /:id`; `POST/PATCH/inativar` **S**. Corpo (S): `{ nome (string 150) }`. Nenhum default seleciona uma conta do mock. Obrigatoriedade em movimentos é D12.

### 4.16 Profissionais — `/api/profissionais` (E08, D11)

Finalidade: identificar responsáveis e pessoas alocadas **sem exigir login**. Substitui os quatro nomes fixos de responsável e os nomes livres de equipe/atividade. Endpoints: CRUD + `inativar`. Corpo: `{ nome (obrigatório) }`. Função/quantidade/tarifa pertencem à alocação (4.20), não ao cadastro. Sem FK obrigatória para usuários.

### 4.17 Sócios — `/api/socios` (E27, D13)

Finalidade: cadastro global de pessoa/empresa participante, reutilizável entre obras (substitui a recriação por obra). Endpoints: CRUD + `inativar`. Corpo: `{ nome (obrigatório) }`. Sem CPF/CNPJ nem fusão por nome (D13). A participação/percentual vive na obra (4.22), não aqui.

### 4.18 Obras — `/api/obras` (E22)

Finalidade: raiz operacional. Telas: painel, “Todas as obras”, cadastro/edição (3 etapas), detalhe. A mesma criação/edição atende o wizard de 3 passos (Identificação, Planejamento, Orçamento) — o contrato é único; as “etapas” são só apresentação.

Endpoints:

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET/POST` | `/api/obras` | Listar/criar |
| `GET/PATCH` | `/api/obras/:id` | Detalhar/editar |
| `POST` | `/api/obras/:id/progresso` | Atualizar progresso (+ próxima atividade) |
| `POST` | `/api/obras/:id/estado` | Transição de estado (planejada↔em_andamento↔pausada; concluir; cancelar) |

Corpo (criar/editar):

| Campo | Categoria | Tipo | Observação |
| --- | --- | --- | --- |
| `titulo` | Obrigatório | string(200) | — |
| `imovelId` | Obrigatório | UUID | FK imóveis |
| `responsavelProfissionalId` | Obrigatório | UUID | FK profissionais (substitui nome fixo) |
| `descricao` | Obrigatório (novos) | texto | Não inventar em mocks antigos |
| `inicioPrevisto` | Obrigatório | date | — |
| `terminoPrevisto` | Obrigatório | date | `>= inicio` senão `422` |
| `orcamento` | Obrigatório | decimal string | `>= 0` |
| `unidadeId` | Opcional | UUID | FK; deve pertencer ao imóvel (`422` senão) |
| `tipoIntervencao` | Opcional | enum | `obra` default |
| `prioridade` | Opcional | enum | `media` default |
| `estado` | Opcional | enum | `planejada` default; transições por ação |
| `riscoInformado` | Opcional | enum | `dentro_prazo` default |
| `progressoPercentual` | Opcional | decimal string 0..100 | Default `"0.00"` |
| `reserva` | Opcional | decimal string | `>= 0` |
| `realizadoInformado` | Opcional | decimal string | `>= 0`; fonte definitiva D10 |
| `proximaAtividadeDescricao` | Opcional | string(500) | Texto livre |
| `observacoes` | Opcional | texto | — |
| `spent/projectedCashBalance` | Proibido | — | Derivados (D10) |
| `unit` (texto livre) | Proibido | — | Substituído por `unidadeId` |

`progresso`: `{ progressoPercentual (0..100), proximaAtividadeDescricao? }`. `estado`: `{ estado, motivo? }` — **concluir exige progresso 100** (`422` senão, regra `estado != concluida OR progresso = 100`); transições fora do permitido → `422` (D04). Query: `responsavelProfissionalId`, `estado`, `riscoInformado`, `imovelId`. Pesquisa: código, título, imóvel, responsável. **Prioridades/compromissos** do painel **não** são campos da obra — são consultas (8.2). Detalhe retorna resumo financeiro derivado (7/8.3).

### 4.19 Obras — Atividades — `/api/obras/:obraId/atividades` (E23)

Aninhado (código `ATV` é local à obra). Telas: Planejamento; modais adicionar/bloquear/reprogramar; concluir. Sem `DELETE` (o front não exclui).

Endpoints: `GET`, `GET /:id`, `POST`, `POST /:id/concluir`, `POST /:id/bloquear`, `POST /:id/reprogramar`.

Corpo (criar): `{ etapa? (default execucao), titulo (obrig), responsavelProfissionalId (obrig, FK), inicio (obrig, date), termino (obrig, date >= inicio), estado? (default nao_iniciada) }`. Ações:

- `concluir`: sem corpo. Remove bloqueio; **recalcula** o progresso da obra pela proporção de concluídas e define a próxima; gera entrada de diário. Efeitos são do servidor (não enviar progresso).
- `bloquear`: `{ motivo }` obrigatório (`422` sem motivo); gera diário.
- `reprogramar`: `{ novoInicio?, novoTermino, justificativa }`; `termino >= inicio` (`422`); registra antes/depois em auditoria/diário.

`estado` da atividade é derivado das ações (não `PATCH` livre). Erros: `422` (bloquear sem motivo, reprogramar com fim < início).

### 4.20 Obras — Equipe — `/api/obras/:obraId/equipe` (E24/E25)

Aninhado. Tela: aba Equipe, modal “Alocar profissional”. Ações: alocar, remover (lógico).

Endpoints: `GET`, `POST`, `DELETE /:id` (remoção **lógica** `removida_em`, auditada — não apaga histórico/custo).

Corpo (criar): `{ profissionalId (obrig, FK), funcao (obrig), modalidade? (horas default), quantidade (obrig, > 0), valorUnitario? (>= 0, zero aceito), inicio?/termino? (default = período da obra), atividadeIds? (E25) }`. **Custo é derivado** (`quantidade × valorUnitario`), nunca enviado. Não impor `UNIQUE(obra, profissional)` (mesmo profissional em funções distintas). Remoção não gera pagamento/despesa. Erros: `422` quantidade ≤ 0.

### 4.21 Obras — Contratações e pagamentos — `/api/obras/:obraId/contratacoes` (E07/E20/E21/E26, D08)

Aninhado. Telas: aba Fornecedores, modais “Cadastrar fornecedor” e “Registrar pagamento do fornecedor”. **Unificação D08:** criar uma contratação cria, atomicamente, a **despesa** (`origem=contratacao_obra`) + a especialização **obra_contratacoes** + vínculo ao **fornecedor** (criando o fornecedor global se novo). Sem duplicar valor/fornecedor/pagamento.

Endpoints: `GET`, `GET /:id`, `POST`, `POST /:id/pagamentos`, `POST /:id/pagamentos/:pagId/estornar`.

Corpo (criar): `{ fornecedorId (ou fornecedorNome para criar novo — S), tipoFornecimento? (servico default), descricao (obrig — objeto contratado), valorContratado (obrig, > 0), dataContratacao (obrig, date), vencimento (obrig, date), observacoes? }`. `pagamentos` reutiliza o mecanismo de 4.12 (`pagamentos_despesa`): `{ dataPagamento, valor (>0, ≤ saldo → 422), observacoes?, documento? }`. **Status/pago/saldo derivados**. Pagamentos **não** somam automaticamente a `spent`/caixa (D10). O `documents[]` (comprovante) é só nome hoje → vira vínculo documental referenciado (4.27, D16). Query: `status`, `fornecedorId`.

### 4.22 Obras — Participações e aportes — `/api/obras/:obraId/participacoes` e `/aportes` (E27/E28/E29/E30/E31, D13)

Telas: aba Sócios, modais cadastrar sócio, registrar aporte, registrar pagamento do sócio.

**Participações** (`/api/obras/:obraId/participacoes`, E28):

- `GET` (quadro societário corrente/histórico), `POST` (incluir/alterar participação de um sócio), `DELETE /:id` (encerrar vigência).
- Corpo `POST`: `{ socioId (FK global — 4.17), percentual (decimal 0<..<=100) }`. Soma corrente **não pode exceder 100** (`422`); mudança de percentual **encerra a versão** e cria outra atomicamente (não reescreve versão referenciada por cota). Sócio com cota histórica não pode ser removido fisicamente (RESTRICT) — só encerra vigência.

**Aportes** (`/api/obras/:obraId/aportes`, E29/E30):

- `GET`, `GET /:id`, `POST` (solicitar). Corpo: `{ descricao (obrig), valorSolicitado (obrig, > 0), dataSolicitacao (obrig, date) }`.
- **Pré-condição (`422`):** participação total exatamente **100,00**. A criação **gera todas as cotas** atomicamente, ratear pelo quadro corrente, ordem de rateio fixada, valores em centavos preservando o total (D13; o resíduo vai por maiores restos, não “o último absorve” cru). `cotas[]` voltam na resposta com `valorDevido` (snapshot imutável). Solicitação **não** é entrada de caixa.

**Pagamentos de cota** (`/api/obras/:obraId/aportes/:aporteId/cotas/:cotaId/pagamentos`, E31):

- `POST` `{ dataPagamento, valor (>0, soma líquida ≤ cota → 422), observacoes? }`; `POST /:pagId/estornar` `{ motivo }`. É a **única** origem da “entrada financeira de aporte”; a aba Financeiro **projeta** esta linha (não grava segunda vez).

### 4.23 Obras — Ajustes de caixa — `/api/obras/:obraId/ajustes-caixa` (E32)

Tela: modal “Realizar ajuste de caixa”. Movimento assinado. Endpoints: `GET`, `POST`, `POST /:id/estornar`. Corpo: `{ dataMovimento (obrig), descricao (obrig), valorAssinado (obrig, ≠ 0 — positivo entra, negativo sai) }`. Estorno tem sinal oposto. Ajuste **não** é custo de fornecedor nem muda orçamento.

### 4.24 Obras — Diário — `/api/obras/:obraId/diario` (E33)

Tela: aba Diário, modal “Registrar no diário”, arquivos recentes. **Append-only**: `GET`, `GET /:id`, `POST`. Sem `PATCH`/`DELETE` (retificação = nova entrada). Corpo: `{ tipo? (atualizacao default), titulo (obrig), descricao (obrig), ocorridoEm? (default = instante do servidor — **não** hora fixa), files? (nomes → vínculos referenciados, D16) }`. **Autor** vem do usuário autenticado (não o responsável da obra). Entradas automáticas (concluir atividade, pagar fornecedor, aporte, ajuste, progresso) são geradas pelo servidor nessas ações e podem referenciar um evento de auditoria. Query: `tipo`, `dataInicio`/`dataFim`.

### 4.25 Obras — Pendências — `/api/obras/:obraId/pendencias` (E34, D14)

Tela: Resumo, contadores. Endpoints: `GET`, `POST`, `PATCH /:id`, `POST /:id/resolver`. Corpo (criar): `{ titulo (obrig), descricao (obrig), severidade? (informativa default) }`. `resolver`: sem corpo — grava `resolvidaEm` + `resolvidaPor` (do token); **não apaga** a pendência (fim do “remover ao resolver”). `resolvidaEm`/`resolvidaPor` são proibidos no corpo. Alertas de vencimento calculados **não** viram pendência automaticamente (D14).

### 4.26 Obras — Compromissos — `/api/obras/:obraId/compromissos` (E35, **D15**)

**Todo o recurso é condicional a D15.** Só existe se “Próximos compromissos” forem eventos independentes; se forem projeções de atividades/pagamentos, **não há recurso** — vira consulta (8.2). Enquanto D15 não decidir, expor apenas a **leitura projetada** no painel de obras. Se aprovado como agenda: CRUD com `{ data, titulo, descricao }`.

### 4.27 Documentos — `/api/documentos` (E36/E37, **D16**)

Finalidade: metadados/versões de arquivo e vínculos tipados. Hoje os anexos são **só nomes** (sem binário/URL). O contrato inicial trabalha em estado `referenciado`; upload real é D16.

Endpoints: `GET /:id`, `POST` (registrar referência), `POST /:id/disponibilizar` (após ingestão verificada — D16), `POST /:id/retirar`, `POST /:id/vinculos` (vincular a um alvo), `DELETE /:id/vinculos/:vinculoId` (desvincular provisório — política D16).

Corpo (criar referência): `{ nomeOriginal (obrig) }`. Disponibilização real (D16, fluxo S): `POST /api/documentos` retorna, quando o upload for aprovado, uma **URL pré-assinada** para envio direto ao storage; `disponibilizar` confirma `mime`, `tamanho`, `chaveArmazenamento`, `hash`. **Nada de arquivo falso** para nomes de mock. Vínculo (E37): `{ documentoId, alvo: exatamente um de (despesaId | pagamentoDespesaId | diarioId) }` (XOR, `422` senão). Alvos novos (imóvel, contrato, recibo) só após D16.

### 4.28 Auditoria — `/api/auditoria` (E38)

**Somente leitura**, append-only. `GET /api/auditoria?entidade=&registroId=&atorId=&operacao=&dataInicio=&dataFim=`. Retorna eventos com `antes/depois` (só atributos alterados), ator/contexto, operação, motivo. **Nunca** expõe `senha_hash`/token/binário (já filtrado no banco). Sem `POST`/`PATCH`/`DELETE` pela API de usuário.

---

## 5. Operações específicas de negócio (consolidado)

Ações que **não** são um `PATCH` genérico, porque carregam regra própria (instrução 6). Todas são `POST /recurso/:id/acao`, transacionais e auditadas.

| Ação | Rota | Condições | Recebe | Efeito | Erros | Permissão |
| --- | --- | --- | --- | --- | --- | --- |
| Ativar contrato | `/api/contratos/:id/ativar` | Estado `rascunho`, ≥1 unidade, composição válida | — | rascunho→ativo; congela imóvel/locatário/unidades | 422 sem unidade/estado | contratos:ativar |
| Encerrar contrato | `/api/contratos/:id/encerrar` | Estado `ativo` | `{ encerradoEm, motivo? }` | ativo→encerrado (não apaga cobranças) | 422 estado | contratos:encerrar |
| Cancelar contrato | `/api/contratos/:id/cancelar` | rascunho/ativo | `{ motivo }` | →cancelado, auditado, sem cascata financeira | 422 estado | contratos:cancelar |
| Gerar cobrança | `/api/contratos/:id/cobrancas` | Contrato ativo; competência livre | itens (4.9) | Emite cobrança+itens imutáveis | 409 duplicidade; 422 item indefinido | cobrancas:criar |
| Estornar recebimento | `/api/recebimentos/:id/estornar` | Movimento original, não estornado | `{ motivo }` | Reversão integral; bloqueia se invalida acordo posterior | 422 estornar estorno/quebra acordo | recebimentos:estornar (D09) |
| Substituir acordo | `/api/negociacoes/:id/substituir` | Versão vigente | termos novos | Encerra versão, cria sucessora, base=saldo remanescente | 422 termos; 409 concorrência | negociacoes:substituir |
| Registrar pagamento despesa | `/api/despesas/:id/pagamentos` | Saldo > 0 | pagamento (4.12) | Baixa parcial/total; status derivado | 422 excede saldo | despesas:pagar |
| Estornar pagamento | `/api/despesas/:id/pagamentos/:pid/estornar` | Pagamento original | `{ motivo }` | Reabre saldo (reverte baixa) | 422 estornar estorno | despesas:estornar (D09) |
| Reabrir despesa | (efeito do estorno acima) | Após estorno | — | Status volta a pendente/vencido por consulta | — | — |
| Atualizar progresso obra | `/api/obras/:id/progresso` | — | `{ progresso, proximaAtividade? }` | Grava progresso informado | 422 fora de 0..100 | obras:editar |
| Mudar estado obra | `/api/obras/:id/estado` | Transição válida | `{ estado, motivo? }` | Concluir exige 100% | 422 transição/progresso | obras:editar |
| Concluir/bloquear/reprogramar atividade | `/api/obras/:id/atividades/:aid/{concluir,bloquear,reprogramar}` | Estados válidos | ver 4.19 | Recalcula progresso/diário | 422 motivo/data | obras:planejar |
| Encerrar participação | `DELETE /api/obras/:id/participacoes/:pid` | Sem sobreposição; cota preserva versão | — | Fecha vigência | 422 remover com cota | obras:socios |
| Registrar aporte | `/api/obras/:id/aportes` | Participação = 100% | ver 4.22 | Gera cotas atomicamente | 422 soma ≠ 100 | obras:aportes |
| Pagar cota | `.../cotas/:cid/pagamentos` | Saldo da cota > 0 | pagamento | Integralização | 422 excede cota | obras:aportes |
| Estornar aporte/ajuste | `.../estornar` | Movimento original | `{ motivo }` | Reversão de sinal oposto | 422 | obras:financeiro (D09) |
| Ajuste de caixa | `/api/obras/:id/ajustes-caixa` | Valor ≠ 0 | ver 4.23 | Entrada/saída assinada | 422 valor zero | obras:financeiro |
| Resolver pendência | `/api/obras/:id/pendencias/:pid/resolver` | Pendência aberta | — | Grava data/ator | — | obras:pendencias |
| Disponibilizar/retirar documento | `/api/documentos/:id/{disponibilizar,retirar}` | Estado coerente | ver 4.27 | Transição de estado documental | 422 estado; 400 metadados | documentos:gerir (D16) |

**Nenhuma ação de aprovação/reprovação é criada** — não há evidência dela no front (mapeamento 23). Se D02/D09 exigirem alçadas, elas entram em revisão própria, não por inferência aqui.

---

## 6. Listagens: filtros, pesquisa e ordenação por recurso

Derivado da matriz do front (mapeamento 19). Só filtros com utilidade atual. Por padrão retornam o conjunto completo; `page/limit` são opcionais (2.5). `search` = “contém”, sem acento/caixa.

| Recurso | `search` (campos) | Filtros (query) | `sortBy` permitido (allowlist) |
| --- | --- | --- | --- |
| carteiras | nome, titular, documento | — | `nome`, `codigo`, `createdAt` |
| imoveis | nome, endereço, carteira | `carteiraId` | `nome`, `codigo`, `createdAt` |
| unidades | nome, imóvel, carteira | `imovelId`, `ocupada` | `nome`, `codigo`, `area` |
| imobiliarias | razão social, fantasia, documento | — | `razaoSocial`, `codigo` |
| locatarios | nome, documento, fantasia | `imobiliariaId`, `semImobiliaria`, `comContrato` | `nome`, `codigo` |
| contratos | código, locatário, imóvel, unidades | `carteiraId`, `imovelId`, `locatarioId`, `unidadeId`, `estado` | `codigo`, `inicio`, `createdAt` |
| cobrancas | código, contrato, locatário, imóvel | `contratoId`, `carteiraId`, `status`, `competencia`, `locatarioId`, `imovelId` | `competencia`, `codigo`, `createdAt` |
| recebimentos | código, cobrança | `cobrancaId`, `contaFinanceiraId`, `dataInicio`, `dataFim` | `dataRecebimento`, `codigo` |
| negociacoes | cobrança | `cobrancaId`, `vigente` | `dataAcordo`, `versao` |
| despesas | código, fornecedor, descrição | `status`, `categoriaId`, `fornecedorId`, `origem`, `obraId`, `dataInicio`, `dataFim` | `status`+`vencimento` (default do front), `vencimento`, `valor` |
| fornecedores | nome | `ativo` | `nome` |
| profissionais | nome | `ativo` | `nome` |
| socios | nome | `ativo` | `nome` |
| obras | código, título, imóvel, responsável | `responsavelProfissionalId`, `estado`, `riscoInformado`, `imovelId` | `titulo`, `codigo`, `inicioPrevisto`, `updatedAt` |
| obras/:id/atividades | título | `estado`, `etapa` | `termino`, `codigo` |
| obras/:id/equipe | nome, função | `ativo` (não removida) | `codigo` |
| obras/:id/contratacoes | fornecedor, descrição | `status` | `dataContratacao`, `vencimento` |
| obras/:id/aportes | descrição | — | `dataSolicitacao`, `codigo` |
| obras/:id/ajustes-caixa | descrição | `dataInicio`, `dataFim` | `dataMovimento` |
| obras/:id/diario | título, descrição | `tipo`, `dataInicio`, `dataFim` | `ocorridoEm` |
| obras/:id/pendencias | título, descrição | `severidade`, `resolvida` | `createdAt`, `severidade` |
| auditoria | — | `entidade`, `registroId`, `atorId`, `operacao`, `dataInicio`, `dataFim` | `ocorridoEm` |

**Regra:** `sortBy` fora da allowlist do recurso → `400`. O backend nunca aceita nome de coluna arbitrário. Filtros temporais (`dataInicio/dataFim`) são intervalos inclusivos sobre a data de negócio relevante do recurso. `status`/`vigente`/`resolvida`/`comContrato` filtram por **projeção derivada** (a API calcula, não há coluna).

---

## 7. Relacionamentos: aninhado vs. query param, e o que o detalhe embute

### 7.1 Regra escolhida (evitar duplicidade — instrução 11)

- **Recursos globais (Locações + cadastros):** relação por **query param plano**. Ex.: `GET /api/cobrancas?contratoId=…`, `GET /api/despesas?fornecedorId=…`, `GET /api/unidades?imovelId=…`. **Não** se cria `GET /api/contratos/:id/cobrancas` como duplicata (exceto o **atalho de ação** `POST /api/contratos/:id/cobrancas`, que gera — não lista).
- **Sub-recursos de obra:** **aninhados**, porque a identidade do filho é escopada pela obra (código `ATV`/`EQP`/`FOR`/`APT`/`DIA`/`PEN` se repete entre obras). Ex.: `/api/obras/:obraId/atividades`. Acessar por UUID global também funciona onde fizer sentido, mas a rota canônica é aninhada.
- **Composição embutida (sem endpoint próprio):** `contrato_unidades` e `contrato_encargos` são geridos **dentro** do contrato; `cobranca_itens` dentro da cobrança; `recebimento_alocacoes` dentro do recebimento; `negociacao_parcelas` dentro da negociação; `aporte_cotas` dentro do aporte. Não têm CRUD solto (são emitidos/alterados atomicamente com o pai).

### 7.2 O que cada detalhe retorna (nem só IDs, nem a árvore inteira — instrução 12)

| Detalhe | Embute (resumo) | **Não** embute (buscar à parte) |
| --- | --- | --- |
| Carteira | contagens (imóveis/unidades), ocupação | lista de imóveis/contratos |
| Imóvel | carteira (id+nome), contagens/ocupação de unidades | lista de unidades, contratos, obras |
| Unidade | imóvel+carteira (id+nome), `contratoVigente` (id+código) | histórico de contratos |
| Locatário | imobiliária (id+nome), contratos (id, código, imóvel, aluguel, vencimento — resumo), contagem | cobranças |
| Contrato | imóvel, locatário, unidades (id+nome), encargos (composição), receita/ticket derivados | cobranças (query), documentos |
| Cobrança | itens (composição), total/recebido/saldo/status, negociação vigente (resumo), recebimentos (resumo) | histórico de auditoria |
| Recebimento | alocações (com alvo tipado), estorno (se houver) | — |
| Negociação | parcelas, totais derivados, versão anterior (id) | recebimentos por parcela (query) |
| Despesa | fornecedor (id+nome), categoria, pagamentos (resumo), total pago/saldo/status | documentos |
| Obra | imóvel/unidade/responsável (id+nome), resumo financeiro derivado, contadores de sub-abas | listas completas de cada aba (endpoints próprios) |
| Aporte | cotas (com sócio, valor devido, pago/saldo derivados) | pagamentos individuais (sob a cota) |

Derivados (contagens, saldos, ocupação, totais, status, ticket) aparecem **só em leitura**; nunca no corpo de escrita (princípio 2). O objetivo é a tela de detalhe fazer **uma** requisição para o essencial, e requisições separadas (paginadas só se necessário) para as listas grandes.

---

## 8. Dashboards, indicadores e gráficos (consultas derivadas)

Sem tabela/rota de “dashboard”; são leituras calculadas das fontes reais. Documenta-se indicadores, filtros, período, cálculo e origem. **Fidelidade:** o painel atual usa período fixo `AGOSTO · 2026` e datas congeladas; a API calcula do relógio/valores reais (D19) e aceita período por filtro (D20 define abrangência final).

### 8.1 `GET /api/dashboards/locacoes` (painel `/inicio`)

Query: `competencia?` (default: mês corrente — não “agosto/2026”), `carteiraId?` (D20 define se o painel filtra por carteira).

Retorna indicadores (todos derivados, string decimal): `faturado` (SUM itens emitidos no escopo), `recebido` (alocações originais − estornos), `saldoEmAberto` (base original **ou** acordo vigente, nunca somados), `despesasAPagar` (despesas origem `operacao` não pagas), `resultadoOperacionalPrevisto` (saldo a receber − despesas em aberto), `cobrancasVencidas` (contagem + valor), contagens (`carteiras`, `imoveis`, `contratos`, `unidades`), `aluguelMensal` (SUM aluguel por vigência D04), ocupação (`ocupadas`, `disponiveis`, `percentual`).

**Gráficos** (dados numéricos, o desenho é do front): `ocupacao` (ocupadas/disponíveis) e `pulsoOperacional` (composição do resultado). Retornados como séries simples:

```json
{ "graficos": { "ocupacao": { "ocupadas": 9, "disponiveis": 5 },
                 "pulso": [ { "chave": "recebido", "valor": "…" }, { "chave": "aReceber", "valor": "…" }, { "chave": "despesas", "valor": "…" } ] } }
```

Origem/limite: consolida cadastros + contratos + cobranças/baixas/acordos + despesas de `operacao`. **Não** inclui aportes/fornecedores de Obras (escopo D20). “Imóvel em destaque” do mock é estático — se mantido, vira campo opcional derivado (ex.: imóvel de maior ocupação) ou é removido (não fabricar).

### 8.2 `GET /api/dashboards/obras` (painel `/obras/inicio`)

Query: `responsavelProfissionalId?`, `estado?`. **Correção vs. mock:** as métricas gerais passam a **respeitar os filtros** (hoje não respeitam).

Retorna: `ativas` (estado ≠ concluida/cancelada), `atrasadas`/`emAtencao` (risco atenção/em_atraso), `orcamentoTotal`, `realizadoTotal`, `saldoProjetadoConsolidado` (SUM de orçamento − realizado − reserva, D10), `usoOrcamento` (realizado/orçamento). Mais:

- `obraEmDestaque`: primeira em andamento (ou primeira filtrada) — derivado, não campo fixo.
- `prioridades`: **consulta** de obrigações/atividades com prazo/saldo em atraso (substitui `workAttentionRecords` fixo). Cada item: `{ obraId, tipo, titulo, descricao, severidade, data }`.
- `compromissos`: **projeção** de atividades/pagamentos próximos (substitui `workCommitments` fixo) **enquanto D15** não decidir agenda independente. Se D15 aprovar agenda, passa a ler E35.

### 8.3 `GET /api/obras/:id/resumo` e `/financeiro`

- `resumo`: indicadores da aba Resumo (próxima atividade, progresso, contadores de equipe/pendências, risco), tudo derivado.
- `financeiro`: **projeção unificada** (D10) — uma linha por `aporte_pagamento` (kind `aporte`), por `ajuste_caixa` (kind `ajuste`), e (D08/D10) por `pagamento` de contratação. **Não** copia lançamentos; cada linha traz `origemTipo` + `origemId` inequívocos. Enquanto D10 não aprova a leitura unificada, o endpoint pode filtrar só aportes/ajustes (como a aba atual) e expor as três leituras separadas: `orcamentoDisponivel`, `custoPrevistoEquipe`, `fluxoLiquidoRegistrado` (nunca somando gasto manual a pagamentos).

Query dos financeiros: `dataInicio/dataFim`, `kind`.

---

## 9. Relatórios e exportações

### `GET /api/relatorios/alugueis` (XLSX — modal “Relação de aluguéis”)

Query: `competencia` (obrig, `YYYY-MM`), `carteiraId?` (todas ou uma). Produz o mesmo artefato XLSX atual (planilhas por aluguel emitido, ordenado por carteira, imóvel, unidades, locatário, contrato). Resposta: `200` com `Content-Type` XLSX e `Content-Disposition: attachment; filename="relacao-alugueis-AAAA-MM.xlsx"`. Erros: `400` competência inválida; `404` carteira inexistente; `422` nenhuma cobrança elegível.

**Base de inclusão é D20:** hoje inclui itens `Aluguel` de qualquer status, cruzando por nome. Com FKs, o cruzamento é por ID; a regra de inclusão (por emissão vs. por caixa; incluir canceladas/acordos/encargos) precisa ser definida antes de considerar o relatório final. Rateio de desconto/juros por natureza é D20 e **não** deve ser inventado por proporcionalidade automática.

Padrão para futuros relatórios: `GET /api/relatorios/<nome>?<filtros>`, sempre por consulta, sem tabela de relatório.

---

## 10. Dados auxiliares para formulários

O front usa selects fixos e listas de apoio. Não se cria tabela para selects (modelagem). Fontes de apoio:

- **Enums** (tipos de imóvel/unidade, formas de pagamento, estados, prioridades, etc.): **constantes do cliente**, usando os códigos da seção 2.8. Se o negócio quiser servi-los, `GET /api/meta/enums` (S) devolve `{ enum: [ { codigo, rotulo } ] }` — mas não é requisito.
- **Lookups de cadastro** (para preencher selects de carteira/imóvel/unidade/locatário/fornecedor/profissional/sócio/categoria/conta): usam os próprios `GET /api/<recurso>?limit=…&fields=id,nome,codigo` — parâmetro opcional `fields` (S) devolve forma enxuta para popular combos sem trafegar o objeto inteiro. Ex.: `GET /api/imoveis?carteiraId=…&fields=id,nome` alimenta o select de imóveis já filtrado pela carteira (corrigindo a lacuna do front, em que o filtro não restringe formulários dependentes).
- **Contadores do menu** (badges de quantidade por entidade): `GET /api/meta/contadores` (S) devolve `{ carteiras: n, imoveis: n, … , obras: n }` em uma chamada, em vez de listar tudo só para contar.

---

## 11. Permissões por endpoint (D02)

Enquanto D02 não define a matriz, o contrato usa um **perfil `administrador` com acesso total** e uma nomenclatura de permissão `recurso:acao` para cada operação (ex.: `cobrancas:criar`, `recebimentos:estornar`, `obras:aportes`). O backend **verifica cada operação**; UI não protege. Regras:

- Leitura vs. escrita separadas (`:ler`, `:criar`, `:editar`, `:inativar`, mais ações específicas `:estornar`, `:ativar`, etc.).
- Ações financeiras sensíveis (estorno, ajuste de caixa, negociação, pagamento) são permissões distintas das de cadastro — pré-fiadas para quando D02/D09 definirem alçadas.
- Sem múltiplos perfis, escopo por carteira/obra ou administração de permissões pelo produto, **não** se modelam `perfis/permissoes/usuario_perfil/perfil_permissao` (modelagem 10). Se aprovados, entram em revisão própria. Nenhum usuário novo recebe `administrador` por default.

`GET /api/auth/me` devolve `permissoes[]` efetivas para o front esconder o que a pessoa não pode fazer (conveniência; a checagem real é no backend).

---

## 12. Como o contrato respeita as inconsistências dos mocks

Alinhado à seção 11 da modelagem — o contrato **não** perpetua os defeitos:

- Vínculos por nome → **FKs por UUID**; nomes viram atributos de apresentação. Renomear não quebra nada.
- Contadores gravados (`properties/units/contracts`) → **removidos**; contagem é derivada.
- Recebimentos “fantasma” (itens com `received` sem movimento) → a API **não** fabrica recebimentos; carga real exige comprovante/conciliação (D09/D19).
- Alocação por índice do array → **`cobrancaItemId`/`negociacaoParcelaId`**; distribuição por vencimento com desempate estável.
- Entrada de acordo não recebida → **parcela 0** prevista; só um recebimento alocado a ela reduz saldo (D07).
- Pagar/reabrir despesa que sobrescreve data → **pagamento + estorno** imutáveis (E21/R).
- Fornecedor duplicado entre Despesas e Obras → **cadastro único** (D08) + contratação especializada.
- Aporte contado duas vezes (WorkFinancialEntry) → financeiro é **projeção** de `aporte_pagamentos`.
- Diário com autor/hora fixos → **autor = usuário do token**, instante do servidor.
- Nomes de arquivo sem binário → documento **referenciado**, sem mime/tamanho/chave fabricados (D16).
- Datas fixas de agosto → **proibidas como default** (D19).

---

## 13. Decisões pendentes que travam partes do contrato

Endpoints marcados abaixo **não** devem ser implementados antes da decisão. Os demais podem ser planejados/implementados em ondas (modelagem 14; mapeamento 27).

| Decisão | Trava | O que muda no contrato |
| --- | --- | --- |
| D01 banco/multitenancy | Todo o contrato | Se houver isolamento por empresa, entra `empresaId`/escopo em quase todas as rotas, unicidades e filtros. Base atual: instalação única |
| D02 auth/perfis | `/api/auth`, `/api/usuarios`, seção 11 | Formato de token, senha vs. provedor externo, matriz de permissões, se surgem recursos de perfis/permissões |
| D03 ocupação | `unidades.ocupada`, filtro `ocupada`, ocupação em dashboards | Ocupação pode deixar de ser campo e virar cálculo por vigência; muda `POST/PATCH` de unidade e o efeito de criar contrato |
| D04 ciclos | contrato `ativar/encerrar/cancelar`, `estado`, contadores por vigência | Define transições válidas, término efetivo, exclusividade de unidade |
| D05 encargos/valores | itens de cobrança, `previa`, `contrato_encargos` | Fonte/vigência de valores e vencimentos, obrigatoriedade antes de emitir |
| D06 emissão | `UNIQUE(contrato, competencia)`, cobrança | Complemento/cancelamento/reemissão exigem número/tipo/versão e reveem a unicidade |
| D07 acordos | negociações/parcelas/alocação | Vencimento da entrada, renegociação parcial, consolidar várias cobranças |
| D08 fornecedores | despesas ⇄ obras, contratações, pagamentos | Unificação; várias faturas por contratação mudariam 1:1 → 1:N; pagamento em lote |
| D09 estornos | todas as ações `estornar`, reabrir | Quem estorna, aprovação, estorno parcial (mudaria `UNIQUE(estorno_de_id)`) |
| D10 caixa da obra | `/obras/:id/financeiro`, saldo projetado | Fonte de realizado/caixa; leitura unificada vs. separada |
| D11 execução | profissionais, atividades, equipe, `unidadeId` da obra | Vínculo profissional-usuário, restrições de calendário, ações de cronograma |
| D12 contas/formas | `contaFinanceiraId` em recebimentos/pagamentos | Pode tornar conta obrigatória, incluir `dataCredito`/pagador terceiro |
| D13 sócios | `/socios`, participações, aportes, rateio | Identidade global, vigência, algoritmo de centavos, cancelamento de aporte |
| D14 pendências | `resolver`, relação alerta↔pendência | O que “resolver” significa, reabertura, histórico de reconhecimento |
| D15 compromissos | `/obras/:id/compromissos` inteiro | Recurso existe **só** se for agenda independente; senão vira consulta |
| D16 documentos | `/api/documentos`, upload, alvos | Telas com anexo, retenção, storage, categorias, URL pré-assinada |
| D17 histórico cadastral | detalhe/relatórios | Se relatório reproduz nome/endereço da emissão (snapshot na emissão) |
| D18 unicidades | `409` de documento/nome de unidade | Escopo de unicidade, máscaras, normalização |
| D19 datas/fuso | defaults de data, status temporal, dashboards | Fim das datas de agosto; fuso de apresentação; carga |
| D20 relatórios/dashboards | seções 8 e 9 | Por emissão vs. caixa, inclusão de canceladas/acordos/encargos, filtros de competência/carteira/obra |

---

## 14. Cobertura do pedido

| Item solicitado | Onde foi atendido |
| --- | --- |
| 1. Mapear endpoints necessários (não só CRUD) | Seções 3.1–3.3 (índice/rastreabilidade) + 4 + 5 |
| 2. Organizar por recurso | Seção 4 (recursos de domínio, não telas) |
| 3. Padrão de rotas | Seção 2.2 |
| 4. Contrato de cada endpoint (método, rota, finalidade, params, body, resposta, erros) | Seção 4 + convenções 2.3–2.7 |
| 5. CRUD por entidade (só onde faz sentido) | Seção 3.1 (matriz C/R/U/X/A) + seção 4 |
| 6. Operações específicas de negócio | Seção 5 (consolidado) + ações em cada recurso |
| 7. Listagens (conjunto completo por padrão; paginação opcional) | Seções 2.3, 2.5 |
| 8. Filtros (apenas os úteis) | Seções 2.5, 6 |
| 9. Pesquisa (campos por recurso) | Seções 2.5, 6 |
| 10. Ordenação (allowlist) | Seções 2.5, 6 |
| 11. Relacionamentos (aninhado vs. query, sem duplicar) | Seção 7.1 |
| 12. Dados relacionados no detalhe (equilíbrio) | Seção 7.2 |
| 13. Dashboards/indicadores | Seção 8 |
| 14. Gráficos | Seções 8.1–8.2 (séries numéricas, sem entidade de gráfico) |
| Extra: relatórios/exportação | Seção 9 |
| Extra: dados auxiliares | Seção 10 |
| Extra: permissões | Seção 11 |
| Extra: inconsistências dos mocks | Seção 12 |
| Extra: decisões que travam o contrato | Seção 13 |

Esta é documentação de contrato. Não foram criados endpoints, controllers, services, repositories, autenticação ou código de aplicação. A implementação futura deve seguir a ordem por ondas da modelagem (seção 14) e do mapeamento (seção 27), resolvendo primeiro D01/D02 e as decisões financeiras/relacionais que alteram chaves e escopo antes de expor as rotas afetadas.
