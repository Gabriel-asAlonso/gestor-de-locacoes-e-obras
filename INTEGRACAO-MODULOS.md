# Integração progressiva — acompanhamento

## Divergências antes da implementação

Revisão em 14/09/2026 do React/Vinext ativo (`app/page.tsx` e componentes de Obras), mocks, `db/schema.ts`, migrations, backend Hono e `CONTRATO-DA-API-PARA-VALIDACAO.md`. As exclusões do antigo Angular e demais alterações preexistentes foram preservadas.

| Área | Divergência comprovada | Tratamento / decisão necessária |
| --- | --- | --- |
| Autenticação | `Home.login` aceita qualquer credencial após 650 ms; sair muda apenas um booleano. Hono já oferece login, refresh, me e logout. | Integrar os quatro endpoints, mantendo o desenho do login. Não criar credenciais reais de demonstração. |
| Sessões | Denylist em memória perde revogações no restart; refresh pode ser consumido simultaneamente; logout responde antes de revogar o refresh. | Correção técnica nesta etapa: migration adicional `__auth_revocations`, consumo único atômico, logout aguardado. Sem guardar senha ou token bruto na tabela. |
| Ambiente | Front Vinext/Cloudflare e backend Node/SQLite são processos distintos. Não existe encaminhamento local de `/api`. | URL pública central; proxy de desenvolvimento para o Hono. Produção requer encaminhamento da API Node — publicar somente o Worker não publica o backend SQLite. |
| Paginação | Contrato §§2.5/6 prevê conjunto completo por padrão; pedido atual exige paginação no servidor. | Pedido atual prevalece: módulos futuros usarão `page=1`, `limit=20` por padrão, limite máximo validado; sem paginar arrays inteiros no cliente. |
| Identidade | Front usa códigos `CAR/IMO/UNI` como IDs e relacionamentos por nome. Banco usa UUID e código separado. | DTOs com UUID para vínculos; adaptar rótulos, nunca tentar relacionar nomes ou fabricar IDs. |
| Carteiras | `portfolioOwnerType` não é coluna; gestor é select de nomes fixos, mas contrato oferece `gestorDescricao` textual. Cards mostram nomes/fotos/listas de imóveis; contrato de carteira só embute contagens, não os imóveis. Indicadores globais não podem ser calculados sobre uma página. | Tipo de titular é auxiliar da máscara. Gestor textual pode seguir o contrato, sem transformar nomes fictícios em catálogo. Cards dependem também de consulta real paginada de imóveis; não cruzar carteira real com imóvel mock. Consolidado requer projeção apropriada, não soma de páginas. |
| Imóveis | Formulário ativo pede logradouro, número, complemento, bairro, inscrição/IPTU, matrícula, cartório e gestor. API exclui esses campos; banco guarda endereço composto, cidade/UF/CEP e observações. | **Bloqueio funcional:** juntar endereço perde estrutura de edição; omitir dados registrais perde informação. Aprovar extensão explícita de modelagem/contrato ou redução explícita do formulário. Não serializar campos em observações. |
| Unidades | Código digitado, bloco, andar, área total e inscrição não existem como atributos equivalentes no contrato/banco; código técnico é do servidor. Ocupação tem decisão D03 pendente. | Aprovar campos e distinguir identificador comercial de código técnico. Não deduzir ocupação por nomes de contratos. |
| Locatários / imobiliárias | Canal preferido, endereço de cobrança, inscrição municipal e observações de imobiliária aparecem no front mas não nos DTOs/tabelas correspondentes. | Necessária revisão explícita para preservar formulário e edição. |
| Contratos / encargos | Front usa finalidade, ocupação, garantia, multa, juros, periodicidade, regra da primeira cobrança, envio e comprovante. API os classifica fora do contrato inicial. Composição é mais rica que E13. | D03–D05/D16 precisam resolver fonte, vigência, regras e campos. Não emitir cobranças com valores inventados. |
| Cobranças / acordos | Front permite tipo de emissão excepcional e negociação mais detalhada; banco exige uma cobrança por contrato/competência e contrato adia D06/D07. | Não simular reemissão como nova cobrança nem registrar entrada de acordo como dinheiro recebido. |
| Recebimentos / despesas | Data de crédito, descontos/juros, pagador terceiro, competência, alocação, recorrência/parcelamento e comprovantes excedem DTOs atuais. | D08/D09/D12/D16. Pagamento/estorno devem ser movimentos imutáveis, não mudança de status em array. |
| Obras | Equipe, sócios, fornecedores e dinheiro são recriados por obra nos mocks; calendário e pendências têm regras condicionais. | FKs para cadastros globais, composição transacional, sem dupla contagem de aporte. D10–D15 continuam explícitas no contrato. E35 não existe no banco por decisão pendente. |
| Documentos | Componentes atuais carregam arquivos locais, incluindo imóveis/unidades/locatários/contratos; E37 só permite despesa/pagamento/diário. Contrato descreve referências de nomes e adia storage. | **Bloqueio:** aprovar alvos e armazenamento/retenção antes de upload real. Não alegar que `blob:` local é persistência. |
| Usuários / permissões | Backend implementa `/api/users`; planejamento usa `/api/usuarios`. Único perfil permitido é administrador; não há tela de gestão de usuários nem matriz editável. | Preservar rotas existentes; não inventar telas/perfis. Front usa permissões efetivas de `/auth/me`. |
| Dashboards / relatórios | Datas de agosto/2026, contadores, imagens em destaque e cálculos são demonstrativos. D20 ainda define inclusão e fonte dos totais. | Última onda, com agregações reais; não misturar com módulos integrados. Não converter todo valor monetário para float no transporte. |

## Ordem apresentada antes do código

1. Autenticação na interface e camada HTTP central.
2. Carteiras.
3. Imóveis e Unidades (dependência também dos cards de Carteiras).
4. Imobiliárias e Locatários.
5. Fornecedores, categorias, contas, profissionais e sócios.
6. Contratos e sua composição.
7. Cobranças, negociações, recebimentos e estornos.
8. Despesas e pagamentos.
9. Obras, atividades, equipe, contratações, participações, aportes, caixa, diário e pendências.
10. Documentos nos módulos correspondentes após decisão de storage/alvos.
11. Indicadores, dashboards e relatórios.

Cada onda exige API/banco real, validação, permissões, front, testes e persistência antes de avançar. Onde o contrato exige decisão, a etapa não será declarada concluída nem receberá regra presumida. Não há autorização para apagar campos ativos ou ampliar o modelo de negócio silenciosamente.

## Controle de mocks durante a transição

Autenticação deve ser real em todas as telas. Enquanto os módulos de negócio não forem integrados, o contexto da tela deve continuar identificando os dados como demonstrativos e nenhuma operação desses módulos deve ser apresentada como persistida. Mocks não devem ser importados no cliente HTTP nem usados como fallback de erro da API.

## Segurança da sessão

Mantido o contrato Bearer existente: access token somente em memória e refresh token no `sessionStorage` da aba (não em `localStorage`), com rotação, recuperação por refresh e revalidação por `/auth/me`. Isso não substitui prevenção de XSS: scripts da mesma origem podem acessar `sessionStorage`; HTTPS e controle de scripts são requisitos de produção. Migrar para cookie HttpOnly exige revisão explícita do contrato/CORS/CSRF.

A tabela técnica de revogação guarda apenas JTI e expiração; não é cadastro de perfil nem nova entidade financeira. Revogações sobrevivem a reinício e são compartilhadas por processos que usam o mesmo arquivo SQLite. Cada refresh só pode ser consumido uma vez. Sem ambiente multiempresa ou cluster de bancos independentes.

Correção adicional de ciclo de sessão: JWTs passam a carregar `sid` e prazo absoluto de sessão. Logout revoga a família inteira, inclusive access tokens anteriores e tokens de um refresh concorrente. `JWT_REFRESH_EXPIRES_IN` passa a ser o prazo máximo desde o login (7 dias por padrão), não uma prorrogação ilimitada. Tokens emitidos antes dessa mudança exigem novo login. O formato externo dos quatro endpoints é preservado.

## Execução e evidências

### Autenticação — concluída na aplicação local

**Backend:** mantidos `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` e `GET /api/auth/me`. A API exige usuário ativo, usa as permissões efetivas, retorna `Cache-Control: no-store`, valida corpos estritos, gira refresh uma única vez e revoga toda a sessão no logout. JTI/SID são persistidos na tabela técnica `__auth_revocations`; não há token, e-mail ou senha nela.

**Front-end:** `SessionGate` substitui o `setTimeout` que autenticava qualquer pessoa. `ApiClient` centraliza URL, Bearer, timeout, normalização segura de erros, refresh concorrente em voo único e uma repetição após 401. Access token fica em memória; refresh na sessão da aba. O formulário não contém credenciais padrão. Nome/perfil exibidos vêm da API. Sair espera a confirmação do backend; se estiver offline, remove a sessão local e avisa que a revogação não foi confirmada.

**Banco:** migration `0003_revogacao_sessoes` aplicada ao banco local existente e validada. Usuários continuam na entidade E01; nenhum usuário fictício foi inserido na base da aplicação. Tokens anteriores à migration não são aceitos porque não possuem SID/prazo absoluto.

**Testes:** 96/96 testes automatizados passaram, incluindo 25 do banco, 40 do backend (6 novos de ciclo de sessão), 10 novos do cliente HTTP e 21 utilitários/front existentes. O fluxo HTTP real foi testado em processos separados antes/depois de reinício. Typecheck de front, backend e banco passou. Build Vinext passou e o artefato contém manifest válido e `default.fetch`. O wrapper Bash de validação não executa neste Windows; sua verificação equivalente foi executada diretamente com Node. Lint das áreas alteradas passou sem erros. A base completa ainda tem 13 avisos preexistentes (principalmente `<img>`) fora desta integração.

**E2E visual:** em banco descartável: senha incorreta → erro da API; usuário inativo → bloqueio; administrador ativo → workspace com identidade real; reload → sessão recuperada; logout + reload → volta ao login; backend indisponível → mensagem segura. Login também inspecionado em 390×844 sem quebra de layout.

**Mocks removidos:** apenas a função simulada de login e seus valores de credencial fixos. Os mocks de domínio permanecem, deliberadamente, e são identificados na UI como demonstrativos. Não existe fallback de mock no cliente da API.

**Pendência de hospedagem:** o build do front é um Worker, mas a API atual depende de Node `node:sqlite` e do arquivo local. Sites executa Cloudflare Workers/D1 e não hospeda esse processo SQLite. Publicar agora entregaria autenticação quebrada; a estratégia deve ser decidida entre adaptar a persistência/API para D1/Worker ou hospedar a API Node externamente e configurar `NEXT_PUBLIC_API_URL`/CORS. O Site existente não foi redeployado com uma versão incompleta.

### Próximo módulo — bloqueado antes de Carteiras

Carteiras não pode cumprir o critério de conclusão isoladamente sem decidir a forma dos cards: a tela usa fotos e nomes de imóveis reais, enquanto o contrato da carteira exclui essa lista e Imóveis ainda não foi integrado. Em seguida, Imóveis exige escolher o destino dos campos estruturados e registrais ausentes (logradouro, número, complemento, bairro, inscrição, matrícula, cartório e gestor). Avançar agora obrigaria a descartar dados, escondê-los em `observacoes`, criar N+1 ou ampliar banco/contrato sem aprovação — exatamente as alterações silenciosas proibidas pelo pedido.

---

## Grupo 2 — Unidades e Locatários — concluído

Decisão de campos adotada: a mesma aprovada e aplicada em Imóveis (migration `0004`) — **estender o schema** para preservar os formulários ativos, em vez de descartar campos ou escondê-los em observações.

### Telas trabalhadas

1. **Unidades** (lista) — origem real via API.
2. **Unidade — criar/editar** (modal) — persistência real.
3. **Drawer de Unidade** — passa a exibir o registro real da lista (detalhe dedicado/documentos permanecem para o Grupo 3/D16).
4. **Locatários e imobiliárias** (lista + hub de imobiliárias) — origem real via API.
5. **Locatário — criar/editar** (modal) — persistência real, com vínculo à imobiliária.

### Integrações realizadas

- **Banco (migration `0005_brief_violations`):** adicionadas colunas para preservar os formulários — `unidades`: `codigo_comercial`, `bloco`, `andar`, `area_total`, `inscricao_municipal`; `locatarios`: `canal_preferido`, `endereco_cobranca`, `inscricao_municipal`. Feita por `ALTER TABLE ADD COLUMN` **escrita à mão** porque o `drizzle-kit generate` reconstrói tabelas com índice de expressão (unidades/locatarios), perdendo os triggers de auditoria/imutabilidade e emitindo SQL de índice inválido (bug já registrado em `IMPLEMENTACAO-BANCO`). Snapshot/journal do drizzle mantidos; rollback próprio criado.
- **Backend (Hono + Drizzle):** módulos `server/units`, `server/tenants` (CRUD sem exclusão física) e `server/agencies` (somente leitura — criação de imobiliária é do Grupo 3). Rotas `GET/POST /api/unidades`, `GET/PATCH /api/unidades/:id`, idem `/api/locatarios`, e `GET /api/imobiliarias(/:id)`. Reutilizam a transação auditada de `db/`, `nextCode`, `rethrowConflict`; validação Zod estrita; paginação/ordenação/busca no servidor disponíveis. Novas permissões `unidades:*`, `locatarios:*`, `imobiliarias:ler` no perfil administrador.
- **Front (`app/services/registry.service.ts` + `app/page.tsx`):** DTOs, mapeadores e payloads para unidade/locatário/imobiliária; `loadRegistryData` passou a carregar unidades, locatários e imobiliárias reais; `saveForm` grava unidade/locatário via API (com estados de loading/erro no formulário) e mantém a propagação demonstrativa a contratos/cobranças (ainda mocks). Select de imobiliária resolve código→UUID no payload (mesmo padrão de Imóveis com carteira). Layout, cards, filtros e wizard preservados.

### Testes executados

- **Backend:** `tests/server/registry-grupo2.test.mjs` (9 casos: criação, campos preservados, decimal inválido→400, nome duplicado→409, sem auth→401, edição, leitura de imobiliárias, locatário com imobiliária, documento duplicado→409, persistência/filtro). Suíte completa do servidor: **49/49**. Cliente HTTP: **10/10**. Banco: **25/25** (inclui “estrutura ORM ↔ migrations”, que valida as novas colunas, e “migrations do zero”).
- **Typecheck:** front (`tsconfig.frontend.json`) **0 erros**; backend (`tsconfig.server.json`) **0 erros** sob o TypeScript fixado 5.9.3.
- **E2E HTTP:** servidor no ar (Node + `@hono/node-server`) → migrate → create-admin → login → criar carteira/imóvel/unidade → **`GET /api/unidades` em requisição nova (reload)** retorna a unidade persistida com `carteiraNome`/`imovelNome` corretos → criar locatário (201) → `GET /api/imobiliarias` (200).

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Tipos de unidade divergentes** — o formulário oferece 7 tipos (inclui “Quiosque” e “Depósito”), mas o enum aprovado (`db/domains.ts`) tem 5. Tela: Unidade — criar/editar. Causa: enum do modelo menor que as opções da UI. Impacto: “Quiosque”/“Depósito” são persistidos como `outro` e reexibidos como “Outro” após recarregar. Correção aplicada: mapeamento explícito extras→`outro` no payload (sem quebrar o banco); **estender o enum é decisão de modelo** e fica pendente. Registrado, não silencioso.
- **Typecheck do front estava quebrado antes deste grupo** — o Grupo 1 (parcial) aliou `Portfolio`/`Property` aos records do serviço mas deixou os saves locais sem `databaseId`, e `PortfolioFilter` referenciava um `portfolios` inexistente (o `PortfolioOptionsContext` fora criado mas nunca provido). Como `PortfolioFilter` é dependência da tela de Unidades, corrigi: provi o `PortfolioOptionsContext` com `portfolioRecords` e completei os objetos demonstrativos com `databaseId`/`portfolioDatabaseId`/`occupiedUnits`. **Comportamento demonstrativo de Carteiras/Imóveis/Imobiliárias (escrita) não foi alterado** — a integração de escrita deles permanece fora do Grupo 2.

### Mocks removidos

- `units`, `tenants` e `realEstateAgencies` (arrays demonstrativos em `app/page.tsx`) e as ramificações locais de gravação de unidade/locatário em `saveForm`. Contratos/cobranças/despesas/obras permanecem mockados (grupos seguintes).

### Pendências do grupo

- **Imobiliária — criar/editar** (Grupo 3): o modal “Nova imobiliária” continua demonstrativo (grava em memória, sem `databaseId` real). Leitura de imobiliárias já é real.
- **Drawer de Unidade/Locatário — detalhe rico e documentos** (Grupo 3/D16): anexos de unidade/locatário seguem locais; storage/alvos de documento dependem de D16.
- **Enum de tipos de unidade** (decisão de modelo): incluir “Quiosque”/“Depósito” exigiria migration de CHECK.
- **Filtro “com contrato”** em Locatários usa contratos ainda mockados (Grupo 3/4); o restante (busca, imobiliária, sem-imobiliária) é real.

### Status

🟢 Grupo totalmente integrado (Unidades e Locatários com API/banco reais, ponta a ponta e persistente). Itens acima são de grupos posteriores, não regressões deste.

---

## Grupo 3 — Imobiliárias e Contratos — concluído

Decisão de campos: mesma dos grupos anteriores — **estender o schema** para preservar os formulários ativos (os campos do contrato exibidos no drawer seriam perdidos sem isso). Preserva-se o dado; a **aplicação** desses termos (geração de cobrança, multa/juros, reajuste, ciclo de vida) permanece adiada a D04/D05/D06.

### Telas trabalhadas

1. **Imobiliária — criar** (modal “Nova imobiliária”) — persistência real.
2. **Drawer de Locatário** — passa a listar os contratos reais do locatário (o drawer já lia `contracts` por nome; agora são reais).
3. **Contratos** (lista) — origem real via API.
4. **Contrato — criar** (modal 3 etapas) — persistência real com unidades (E12) e composição de encargos (E13).
5. **Drawer de Contrato** — exibe o contrato real (vínculos, período, composição e termos preservados). “Criar cobrança” permanece demonstrativo (Grupo 4).

### Integrações realizadas

- **Banco (migration `0006_oval_norman_osborn`):** 13 colunas adicionadas a `contratos` para preservar os campos do formulário exibidos no drawer — `finalidade`, `data_ocupacao`, `data_assinatura`, `referencia_pagamento`, `periodicidade_reajuste_meses`, `multa_atraso_percentual`, `juros_mensal_percentual`, `canal_envio`, `garantia_tipo`, `garantia_detalhe`, `regra_primeira_cobranca`, `forma_pagamento_texto`, `nome_documento`. Escrita **à mão** por `ALTER TABLE ADD COLUMN` (o `drizzle-kit generate` reconstruiria a tabela por causa dos CHECKs, perdendo os triggers de auditoria/imutabilidade). Snapshot/journal do drizzle mantidos; rollback próprio. `contrato_encargos` **não** foi estendido: o drawer só exibe nomes, então persiste-se o modelo aprovado E13 (nome/natureza/valor_base) e os metadados de regra (responsabilidade/cálculo/vencimento/recorrência/comprovante) ficam adiados a D05.
- **Backend (Hono + Drizzle):** módulo `server/contracts` (lista/detalhe/criação com composição) e `POST /api/imobiliarias` (criação, no módulo `agencies`). A criação de contrato é **transacional**: insere como `rascunho`, grava unidades + encargos (o banco só permite compor enquanto rascunho) e então **transiciona para `ativo`** (a trigger `contrato_transicao` valida a ativação). Validações prévias: imóvel/locatário ativos e **todas as unidades pertencentes ao imóvel** (422 caso contrário). Novas permissões `contratos:ler/criar` e `imobiliarias:criar`.
- **Front (`registry.service` + `page.tsx`):** DTO/mapeador/payload de contrato (resolve nome/código → UUID para imóvel, locatário e unidades; mapeia mês↔número e forma de pagamento verbatim; reconstrói `chargeRules` para o modal de cobrança do Grupo 4 seguir funcionando). `loadRegistryData` carrega contratos reais; `saveForm` grava contrato e imobiliária via API com loading/erro no formulário. Mock de contratos removido. Layout/cards/drawer/wizard preservados.

### Testes executados

- **Backend:** `tests/server/registry-grupo3.test.mjs` (7 casos: imobiliária criar/duplicado; contrato criar com unidades+encargos+campos preservados; unidade de outro imóvel→422; sem unidades→400; lista/filtra por locatário; sem auth→401). Suíte completa do servidor **56/56**; cliente **10/10**; banco **25/25** (inclui migrations-do-zero e “estrutura ORM ↔ migrations”, que validam as 13 colunas novas).
- **Typecheck:** front e backend **0 erros** (TypeScript fixado 5.9.3).
- **E2E HTTP:** servidor no ar → login → `POST /api/imobiliarias` (201) → criar carteira/imóvel/unidade/locatário → `POST /api/contratos` = `CTR-001` (`estado: ativo`, 1 unidade, 2 encargos, `multa 2.00`) → **`GET /api/contratos` em requisição nova (reload)** retorna o contrato persistido.

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Composição só é mutável em rascunho** — a primeira versão inseria o contrato já como `ativo` e a trigger `contrato_transicao`/imutabilidade recusava adicionar unidades (“Unidades de contrato emitido imutáveis”). Tela: Contrato — criar. Causa: ordem de estados do modelo. Correção aplicada: inserir `rascunho` → compor → transicionar para `ativo`, tudo na mesma transação. ✔ resolvido.
- **Enums menores que a UI** — forma de pagamento (UI: Boleto/Pix/Transferência/Débito automático/Outra; enum: 3): o valor exibido é preservado verbatim em `forma_pagamento_texto`, e `forma_pagamento_prevista` recebe o código só quando corresponde. Sem perda visível. Registrado.
- **Ocupação de unidade não é mais inferida do contrato** — o mock marcava a unidade como ocupada ao criar contrato; isso foi removido porque ocupação é decisão **D03** pendente (o modelo proíbe inferir ocupação por contrato). Mudança de comportamento intencional e registrada.

### Mocks removidos

- Array `contracts` (`app/page.tsx`) e a ramificação local de gravação de contrato em `saveForm` (que construía o contrato, marcava unidades ocupadas e incrementava o contador do locatário). A criação local de imobiliária foi substituída por chamada real. Cobranças/despesas/obras permanecem demonstrativas.

### Pendências do grupo

- **Geração de cobrança** a partir do contrato (“Criar cobrança”) permanece demonstrativa — depende de D05/D06 e é do Grupo 4.
- **Aplicação** dos termos preservados (multa/juros, reajuste, regra da primeira cobrança, referência de pagamento) — armazenados, mas sem lógica de negócio (D05/D06).
- **Metadados de regra de encargo** (responsabilidade/cálculo/vencimento/recorrência/comprovante) não persistidos (D05); o drawer não os exibe, então não há perda visível.
- **Edição/encerramento/cancelamento de contrato** — não existem na UI; o modelo já suporta as transições (D04) quando forem adicionadas.
- **Imobiliária:** `notes` do formulário não tem coluna no modelo (não persistido); editar/inativar imobiliária ficam para etapa futura.

### Status

🟢 Grupo totalmente integrado (Imobiliárias-criar, Contratos-lista/criar/detalhe e Drawer de Locatário com API/banco reais e persistentes). As pendências acima dependem de decisões (D03/D04/D05/D06) ou pertencem ao Grupo 4 — não são regressões.

## Grupo 4 — Cobranças e Recebimentos — concluído

Decisão de campos: **não** houve extensão de schema — o modelo aprovado (E14–E19) já suportava emissão de itens, recebimentos com alocação e negociações com parcelas. Nenhuma cobrança é emitida com valor inventado: o cliente monta os itens a partir do contrato e **revisa/edita** os valores no modal antes do `POST` (o bloqueio D05 vale só para geração automática de valores desconhecidos, que **não** foi implementada). Todos os valores derivados (total, recebido, saldo operacional, status, parcelas) são calculados **no servidor** e nunca gravados.

### Telas trabalhadas

1. **Cobranças** (lista) — origem real via API, com status/saldo derivados.
2. **Cobrança — criar** (modal “Nova cobrança”) — emissão real de `cobranca` + `cobranca_itens` (snapshot imutável), única por contrato/competência.
3. **Drawer de Cobrança** — exibe composição, saldos por item, acordo vigente e histórico de recebimentos reais.
4. **Registrar recebimento** — cria `recebimento` + `recebimento_alocacoes` (alocação por item; distribuição às parcelas quando há acordo vigente).
5. **Negociar cobrança** — cria `negociacao` + `negociacao_parcelas` (entrada = parcela 0; parcelas 1..N com calendário e centavos derivados). “Editar negociação” = **substituição** versionada.

### Integrações realizadas

- **Backend (Hono + Drizzle):** três módulos novos — `server/charges` (cobranças + itens), `server/receipts` (recebimentos + alocações + estorno) e `server/negotiations` (negociações + parcelas). Um módulo compartilhado `server/charges/derive.ts` calcula o estado derivado de qualquer cobrança (itens com recebido, total, recebido líquido, saldo operacional, status, acordo vigente, recebimentos) em um número fixo de queries — usado pelos três serviços para que todos concordem com a mesma verdade. Escritas reutilizam a **transação auditada** de `db/` (`withTransaction`), `nextCode`, `rethrowConflict`; validação Zod estrita; paginação/ordenação/busca no servidor. Rotas: `GET/POST /api/cobrancas`, `GET /api/cobrancas/:id`; `GET/POST /api/recebimentos`, `GET /api/recebimentos/:id`, `POST /api/recebimentos/:id/estornar`; `GET/POST /api/negociacoes`, `GET /api/negociacoes/:id`, `POST /api/negociacoes/:id/substituir`. Novas permissões `cobrancas:ler/criar`, `recebimentos:ler/registrar/estornar`, `negociacoes:ler/registrar`.
- **Regras de negócio aplicadas antes das triggers** (para devolver 4xx limpos, não erro de constraint cru): emissão exige contrato **ativo** (D04) e `contratoEncargoId` — quando informado — pertencente ao contrato; recebimento não pode superar o **saldo operacional**, soma das alocações == valor, e cada alvo (item/parcela) não recebe acima do seu saldo; negociação valida desconto ≤ saldo, entrada < total negociado e cada parcela ≥ 1 centavo, com **um único acordo vigente** por cobrança (segundo acordo → 409; alteração → `substituir`). As triggers de agregado do banco (`cobranca_sem_item`, `alocacao_integral`, `parcela/item_sobrepago`, `negociacao_parcelas`, `parcelas_calendario`) permanecem como rede de segurança no commit.
- **Calendário das parcelas espelha a trigger `parcelas_calendario` e o front** (`buildNegotiationSchedule`): `server/negotiations/schedule.ts` reproduz exatamente o vencimento mensal “mesmo dia, ajustado a meses curtos” e a divisão de centavos (parcelas iniciais absorvem a sobra). Um teste com `2027-01-31` confirma `31/01 → 28/02` sem o commit abortar.
- **Front (`registry.service` + `page.tsx`):** DTOs/mapeadores/payloads de cobrança, recebimento e negociação. `mapCharge` reconstrói o `Charge` (mantendo `databaseId` + `id`=código; itens com `databaseId`/`natureza`), e carrega `openParcels` do acordo vigente para alocar recebimentos. `loadRegistryData` carrega cobranças reais e popula `negotiationsByCharge`/`receiptsByCharge`. `saveForm` (ramo `charge`), `saveReceipt` e `saveNegotiation` agora chamam a API e aplicam o **bundle** derivado devolvido pelo servidor (a cobrança inteira é relida após recebimento/negociação). `Charge`/`ChargeItem` passaram a ser aliases dos records do serviço (padrão dos grupos anteriores). Layout/drawer/wizards preservados.

### Testes executados

- **Backend:** `tests/server/registry-grupo4.test.mjs` (14 casos: cobrança criar com total/saldo derivados; competência duplicada→409; sem itens→400; competência que não é dia 01→400; recebimento parcial reflete saldo/status `Parcial`; valor acima do saldo→422; soma das alocações≠valor→422; quitação integral→`Recebida` + estorno reverte + duplo estorno→422; negociação com entrada=parcela 0 e parcelas derivadas; entrada≥total→422; acordo duplicado→409 e `substituir`→versão 2; calendário de mês curto/clamp; contrato inexistente→404; sem auth→401). Suíte completa do servidor **70/70**; cliente + `charge-negotiation` **14/14**; banco **25/25**.
- **Typecheck:** front e backend **0 erros** (TypeScript fixado 5.9.3).
- **E2E HTTP:** servidor real no ar (`server/index.ts`) → `/api/cobrancas` sem token = 401 → login → `/api/cobrancas|recebimentos|negociacoes` autenticados = 200 → criar carteira/imóvel/unidade/locatário/contrato → `POST /api/cobrancas` = `COB-0001` (`total 3000.00`, `saldo 3000.00`, `status Vencida`).

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Recebimento em cobrança negociada** — o drawer oferece “Registrar recebimento” mesmo com acordo vigente, mas o modal aloca por **item**, enquanto o banco exige que, havendo acordo, o dinheiro liquide as **parcelas** (D07). Correção: quando a cobrança carrega `openParcels`, o `registry.service` distribui o valor entre as parcelas em aberto por ordem de vencimento (a distribuição “por vencimento” endossada pelo contrato §4.10); sem acordo, aloca por item. O servidor valida estritamente o modo. UI de recebimento por parcela dedicada fica para etapa futura.
- **Base da negociação e “editar” = substituir** — a `saldoBase` é fotografada pelo servidor como **o valor ainda devido na cobrança** (`total − recebido líquido`), coerente com o saldo exibido ao usuário; “Editar negociação” mapeia para `POST /:id/substituir` (nova versão imutável, encerra a vigência anterior). Renegociação parcial do saldo remanescente de um acordo e consolidação de várias cobranças **não** são presumidas (D07).

### Divergências registradas (campos coletados na UI, ainda não persistidos)

- **Recebimento:** `dataCrédito`, `desconto`, `juros`, `pagador terceiro`, `comprovante`, `observação` e `conta financeira` são **Proibido/adiado** hoje (contrato §4.10 → D09/D12/D16). O `valor` enviado é o **principal alocado**; os campos seguem visíveis no modal, sem perda de layout.
- **Negociação:** os 4 motivos da UI mapeiam para os 4 códigos do domínio (“Readequação de fluxo” e “Acordo comercial” convergem em `renegociacao_comercial`); o texto livre de “Outro”, contato/canal, quebra de acréscimo (multa/juros/correção) e documento do acordo **não** têm coluna e não são persistidos. `dataAcordo` é preenchida com a data corrente (fato, não regra presumida). Forma de pagamento “Débito automático” não está no enum → `null`.
- **Cobrança:** `tipo de emissão excepcional` (`inclusionType`) não tem destino no modelo — reemissão/complementar/cancelamento dependem de D06 e **não** são simulados; a unicidade contrato/competência é enforçada (409). `natureza` de cada item é derivada pelo nome (“Aluguel” → `aluguel`, demais → `encargo`), mesmo critério do contrato; os itens **não** são vinculados a `contrato_encargos` (evita presumir o mapeamento).

### Mocks removidos

- Array `charges` (`app/page.tsx`), a ramificação local de criação de cobrança em `saveForm`, e as versões locais de `saveReceipt`/`saveNegotiation` (que atualizavam itens/recebimentos/negociações em memória). `chargeStatusFromItems` foi removido (o status passa a vir derivado do servidor). Despesas e obras permanecem demonstrativas (Grupos 5+).

### Pendências do grupo

- **Geração assistida de itens** (`GET /api/contratos/:id/cobrancas/previa`) não implementada — o cliente monta os candidatos localmente a partir do contrato e o usuário revisa (D05).
- **Recebimento com ajustes** (desconto/juros/crédito/pagador/comprovante) e **seleção de conta financeira** — D09/D12/D16.
- **Estorno pela UI** — o backend suporta `POST /api/recebimentos/:id/estornar`, mas o drawer ainda não expõe o botão; entra quando a tela de estorno for desenhada.
- **Recebimento por parcela** (acordo vigente) com UI dedicada — hoje distribuído por vencimento no serviço.

### Status

🟢 Grupo totalmente integrado (Cobranças-lista/criar, Drawer de Cobrança, Registrar recebimento e Negociar cobrança com API/banco reais, valores derivados no servidor e imutabilidade/auditoria preservadas). As pendências e divergências acima dependem de decisões (D05/D06/D07/D09/D12/D16) — não são regressões.

## Grupo 5 — Despesas e pagamentos — concluído

Decisão de campos: **sem** extensão de schema — o modelo aprovado (E20/E21 + fornecedores E07 + categorias E09) já suportava tudo. Nenhum valor inventado: fornecedor e categoria são resolvidos a partir do que o usuário digitou/selecionou. Status, saldo, valor pago e data de pagamento são **derivados no servidor** a partir dos pagamentos imutáveis, nunca gravados.

Escopo: este grupo fecha o **fluxo de Despesas** do Módulo 1. **Relatório contábil** (ReportExportModal) e **Painel/Visão geral** (DashboardPage) seguem demonstrativos — são a “última onda” de agregações, dependente de **D20** (inclusão e fonte dos totais), e o próprio contrato pede para “não misturar com módulos integrados”.

### Telas trabalhadas

1. **Despesas** (lista) — origem real via API, com status/saldo derivados e ordenação crítico→pago.
2. **Despesa — criar** (modal “Nova despesa”) — cria `despesa` (origem `operacao`); resolve fornecedor (buscar-ou-criar por nome) e categoria (rótulo → id); baixa imediata quando marcada “já paga”.
3. **Drawer de Despesa** — exibe valor, categoria, agenda de vencimento/pagamento e situação real.
4. **Registrar pagamento** (ação do drawer “Pago”) — cria `pagamento_despesa` (quita o saldo).
5. **Reabrir** (drawer Pago→pendente) — estorna os pagamentos (reabre o saldo, não apaga a baixa).

### Integrações realizadas

- **Backend (Hono + Drizzle):** três módulos novos — `server/suppliers` (fornecedores: lista/criar/detalhe), `server/expense-categories` (categorias: somente leitura do catálogo semeado) e `server/expenses` (despesas + pagamentos + estorno). O serviço de despesas calcula o estado derivado (pago líquido, saldo, status vencido/pendente/pago, data da última baixa efetiva, lista de pagamentos) em um número fixo de queries; escritas reutilizam a transação auditada de `db/`. Rotas: `GET/POST /api/fornecedores`, `GET /api/fornecedores/:id`; `GET /api/categorias-despesa`; `GET/POST /api/despesas`, `GET /api/despesas/:id`, `POST /api/despesas/:id/pagamentos`, `POST /api/despesas/:id/pagamentos/:pagId/estornar`. Novas permissões `fornecedores:ler/criar`, `categorias-despesa:ler`, `despesas:ler/criar/pagar/estornar`.
- **Regras aplicadas antes das triggers:** criação exige fornecedor **ativo** e categoria **ativa** (404 caso contrário); pagamento não pode superar o saldo em aberto (422); estorno espelha o pagamento original e bloqueia estornar-um-estorno / duplo-estorno (422). A trigger de agregado `despesa_sobrepaga` do banco permanece como rede de segurança no commit.
- **Front (`registry.service` + `page.tsx`):** DTOs/mapeadores/serviços de fornecedor, categoria e despesa. `mapExpense` reconstrói o `Expense` (mantendo `databaseId` + `id`=código, `balance` para a baixa total e `openPaymentIds` para reabrir). `loadRegistryData` carrega despesas, fornecedores e categorias reais. `saveForm` (ramo `expense`) resolve fornecedor (reaproveita por nome exato ou cria) e categoria (rótulo→id) e, se “já paga”, registra a baixa total logo após criar. O `ExpenseDrawer` chama `payExpense`/`reopenExpense`. `Expense` passou a ser alias do record do serviço; o datalist de fornecedor usa a lista real. Layout/tabela/drawer/wizard preservados.

### Testes executados

- **Backend:** `tests/server/registry-grupo5.test.mjs` (11 casos: catálogo de categorias; fornecedor criar; despesa criar com código/saldo/status derivados; fornecedor/categoria inexistentes→404; pagamento parcial reduz saldo; quitação integral→`Pago` com data; pagamento acima do saldo→422; estorno reabre + duplo estorno→422; ordenação crítico→pago; sem auth→401). Suíte completa do servidor **81/81**; cliente + `charge-negotiation` **14/14**; banco **25/25**.
- **Typecheck:** front e backend **0 erros** (TypeScript fixado 5.9.3).
- **E2E HTTP:** servidor real no ar (`server/index.ts`) com banco migrado **+ semeado** → `GET /api/categorias-despesa` 200 (catálogo), `GET /api/despesas` sem token 401 → criar fornecedor + `POST /api/despesas` = `PAG-0001` (`saldo 780.00`, status `Vencido`, fornecedor/categoria resolvidos) → `POST /:id/pagamentos` total → status `Pago`, `saldo 0.00`, `dataPagamento` registrada.

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Catálogo de categorias não está nas migrations** — é semeado por `db/seed.ts` (função `seed()`, executada por `npm run db:seed`). O harness de teste só migra, então o teste do Grupo 5 chama `seed()` explicitamente. Em produção, `db:seed` deve rodar após `db:migrate` (passo operacional).
- **Fornecedor por nome livre (datalist)** — o campo “Fornecedor / beneficiário” é texto com autocompletar. O front resolve por nome exato (reaproveita o fornecedor existente) ou cria um novo (§4.13 “não fundir por semelhança”). Reuso só em correspondência exata; digitar um nome novo cria um cadastro.
- **Situação derivada vs. seletor manual** — o drawer permite escolher Pendente/Vencido/Pago, mas Pendente/Vencido são **derivados do vencimento**: só “Pago” (registra baixa) e sair de “Pago” (estorna) têm efeito real; alternar Pendente↔Vencido é no-op (avisado ao usuário).

### Divergências registradas (campos coletados na UI, ainda não persistidos)

- **Despesa:** `competência`, `tipo de lançamento`/`recorrência`, `alocação`, `documento/anexo` e `data de emissão` seguem visíveis no modal/drawer mas **não** têm coluna no modelo (D08/D09/D16). “Serviços profissionais” (rótulo da UI) não está no catálogo semeado → mapeado para **Outros**. `Conta financeira` (rótulos locais) é **D12** → enviado `null`; forma de pagamento “Débito automático”/“Dinheiro” não estão no enum → `null`.
- **Pagamento:** a UI quita o **total** (parcialidade no modelo, habilitar na tela é D08). Data/valor/forma são enviados; conta financeira é D12 → `null`.

### Mocks removidos

- Array `expenses` (`app/page.tsx`) e a ramificação local de criação de despesa em `saveForm` (que montava o registro e inferia status por data-demo). A ação de status do `ExpenseDrawer` passou de mutação local para `payExpense`/`reopenExpense` reais. O datalist de fornecedor deixou de derivar dos mocks e usa a lista real. Obras permanecem demonstrativas (Grupos 6+).

### Pendências do grupo

- **Relatório contábil e Painel/Visão geral** — agregações reais dependem de **D20** (o que entra e a fonte dos totais); permanecem demonstrativos por ora, como “última onda” do Módulo 1.
- **Editar despesa** (`PATCH /api/despesas/:id`, com trava de valores após pagamento) — não há tela de edição de despesa hoje; fica para quando a UI existir.
- **Pagamento parcial pela UI** e **seleção de conta financeira** — D08/D12.
- **Estorno de pagamento pela UI** existe só como “reabrir” (Pago→pendente); estorno granular por pagamento entra com uma tela dedicada.

### Status

🟢 Grupo totalmente integrado (Despesas-lista/criar, Drawer de Despesa, Registrar pagamento e Reabrir com API/banco reais, status/saldo derivados no servidor e pagamentos imutáveis/auditados). Fecha o fluxo de Despesas do Módulo 1; relatório/painel (D20) e as demais divergências dependem de decisões pendentes — não são regressões.

## Grupo 6 — Obras: raiz operacional — concluído

Início do **Módulo 2 (Obras)**. Este grupo integra a **raiz da obra** (E22) e o cadastro de **profissionais** (E08). As abas do detalhe (equipe, fornecedores, sócios, aportes, financeiro, diário, atividades) e o painel de obras seguem demonstrativos — são os Grupos 7–10. Decisão de campos: **sem** extensão de schema (o modelo E22 já cobre o formulário).

### Telas trabalhadas

1. **Obras** (lista “Todas as obras”) — origem real via API, com estado/progresso/prazo reais.
2. **Nova obra / Editar** (wizard de 3 etapas) — cria (`POST /obras`) e edita cadastro (`PATCH /obras/:id`); resolve imóvel/unidade e **responsável (buscar-ou-criar profissional por nome)**.
3. **Detalhe da obra — cabeçalho e resumo** — exibe os dados reais da obra (vínculos, prazo, orçamento, progresso, situação).
4. **Situação da obra** (menu “Mais ações”: iniciar/pausar/retomar/concluir/cancelar) — transições reais via `POST /obras/:id/estado`.
5. **Registrar atualização** (progresso + próxima atividade) — `POST /obras/:id/progresso` real.

### Integrações realizadas

- **Backend (Hono + Drizzle):** dois módulos novos — `server/professionals` (E08: lista/criar/detalhe; único dado é o nome) e `server/works` (E22). Rotas: `GET/POST /api/profissionais`, `GET /api/profissionais/:id`; `GET/POST /api/obras`, `GET/PATCH /api/obras/:id`, `POST /api/obras/:id/progresso`, `POST /api/obras/:id/estado`. Escritas reutilizam a transação auditada de `db/`. Novas permissões `profissionais:ler/criar`, `obras:ler/criar/editar`.
- **Regras aplicadas antes das triggers:** criar/editar valida imóvel e profissional ativos e **unidade pertencente ao imóvel** (404/422); término ≥ início (400); transições de estado seguem o mapa permitido D04 (planejada↔em_andamento↔pausada; concluir; cancelar) — transição inválida → 422; **concluir marca 100%** (a CHECK `obras_conclusao` do banco exige progresso=100); progresso em obra concluída/cancelada → 422.
- **Front (`registry.service` + `page.tsx`):** DTO/mapeador/serviços de profissional e obra. `mapWork` traduz os enums (estado/prioridade/intervenção/risco) para os rótulos da UI e deriva `spent = realizadoInformado` e `saldoProjetado = orçamento + reserva − realizado` — **valores informados, não fabricados** a partir de sub-recursos ainda mockados (D10). `loadRegistryData` carrega obras e profissionais reais. `saveWork` cria/edita via API (responsável buscar-ou-criar); no detalhe, o menu de situação chama `transitionWorkState` e o modal de atualização chama `updateWorkProgress`. `WorkRecord` ganhou `databaseId`. As abas do detalhe continuam alimentadas por `createWorkDetailMock` (Grupos 7–10). Layout/wizard/detalhe preservados.

### Testes executados

- **Backend:** `tests/server/registry-grupo6.test.mjs` (12 casos: profissional criar; obra criar com vínculos e estado planejada; sem descrição→400; término<início→400; unidade de outro imóvel→422; profissional inexistente→404; PATCH edita cadastro; progresso atualiza percentual/próxima; transição planejada→concluida direta→422; iniciar+concluir fecha 100% e trava progresso; lista filtra por estado; sem auth→401). Suíte completa do servidor **93/93**; cliente + `charge-negotiation` + `work-partners` **19/19**; banco **25/25**.
- **Typecheck:** front e backend **0 erros** (TypeScript fixado 5.9.3).
- **E2E HTTP:** servidor real no ar (`server/index.ts`) → `/api/obras` sem token 401, `/api/profissionais` 200 → criar carteira/imóvel/profissional + `POST /api/obras` = `OBR-001` (estado `planejada`, responsável/imóvel resolvidos, `orçamento 185000.00`) → `/estado` em_andamento → `/progresso` = `68.00` com próxima atividade.

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Responsável por nome livre** — o select “Responsável principal” usa nomes fixos (WORK_TEAM_OPTIONS). O front resolve por nome exato (reaproveita) ou cria o profissional (§4.16), como fornecedores.
- **Situação editada no formulário de edição** — o wizard de edição tem um seletor de situação; ao salvar, o cadastro vai por `PATCH` e, se a situação mudou, tenta a transição por `/estado`. Transição não permitida por ali é avisada (“use as ações da obra”), sem perder o cadastro.
- **Descrição obrigatória** — o modelo exige `descricao` não-vazia para obras novas (§4.18); o payload valida isso (o campo do formulário era opcional). Pequeno aperto de UX, alinhado ao contrato.

### Divergências registradas

- **spent / saldo projetado (D10):** exibidos a partir do **realizado informado** (campo real) e do orçamento/reserva; o custo definitivo vindo de contratações/aportes é dos Grupos 8–9 e depende de D10. Não há fabricação a partir dos mocks das abas.
- **Abas do detalhe** (equipe/fornecedores/sócios/aportes/financeiro/diário/atividades) e **painel de obras** (atenção/compromissos = consultas 8.2) seguem demonstrativos — Grupos 7–10. `completeActivity`/bloquear/reprogramar e os cadastros de aba continuam locais.
- **Anexos/equipe do formulário:** os anexos e a “equipe adicional” do wizard não são persistidos no Grupo 6 (equipe é E24/Grupo 8; documentos são D16). O **responsável** é persistido.

### Mocks removidos

- Array `workRecords` (`app/works-mocks.ts`) deixou de inicializar o estado — as obras vêm da API. `saveWork`/`transição`/`progresso` deixaram de mutar só o estado local e chamam a API. Os mocks de **abas** (`createWorkDetailMock`) permanecem propositalmente até os Grupos 7–10.

### Pendências do grupo (Grupos 7–10)

- **Atividades / Planejamento** (E23) — Grupo 7.
- **Equipe** (E24/E25) e **Fornecedores/contratações + pagamentos** (E26/D08) — Grupo 8.
- **Sócios/participações + aportes + ajustes de caixa** (E27–E32/D13) — Grupo 9.
- **Diário** (E33) + documentos (D16) + **painel de obras** e agregações financeiras reais (D10) — Grupo 10.

### Status

🟢 Grupo totalmente integrado (Obras-lista, cadastro criar/editar, detalhe-cabeçalho/resumo, transições de estado e atualização de progresso com API/banco reais e auditados; profissionais reais). Abre o Módulo 2; as abas do detalhe e o painel dependem dos Grupos 7–10 e de D10/D13/D16 — não são regressões.

## Grupo 7 — Obras / Atividades (Planejamento) — concluído

Primeira **aba do detalhe** integrada: o **Planejamento** (E23, atividades aninhadas em `/api/obras/:obraId/atividades`). O estado da atividade é **derivado das ações** (concluir/bloquear/reprogramar), sem `PATCH` livre; **concluir recalcula o progresso da obra** no servidor. Sem extensão de schema. As demais abas (equipe/fornecedores/sócios/aportes/financeiro/diário) seguem demonstrativas (Grupos 8–10).

### Telas trabalhadas

1. **Planejamento** (aba do detalhe da obra) — cronograma real por etapa (Preparação/Execução/Entrega), origem via API.
2. **Nova atividade** (modal) — cria atividade real (`POST …/atividades`), resolvendo o responsável (buscar-ou-criar profissional).
3. **Concluir atividade** — `POST …/:id/concluir`: marca concluída, remove bloqueio, **recalcula o progresso da obra** e define a próxima atividade (efeitos do servidor).
4. **Bloquear atividade** (modal) — `POST …/:id/bloquear` com motivo obrigatório.
5. **Reprogramar atividade** (modal) — `POST …/:id/reprogramar` com novo término + justificativa.

### Integrações realizadas

- **Backend (Hono + Drizzle):** módulo `server/work-activities`, montado em `/api/obras/:obraId/atividades` (código `ATV` local à obra). Rotas: `GET /`, `POST /`, `POST /:id/concluir`, `POST /:id/bloquear`, `POST /:id/reprogramar`. Cada mutação devolve um **bundle** `{ atividades, obra }` (lista completa + obra atualizada) para o front sincronizar tudo numa resposta. Escritas reutilizam a transação auditada de `db/`. Reusa as permissões `obras:ler/editar`.
- **Regras aplicadas:** criar valida obra e responsável ativos; término ≥ início (400); concluir remove bloqueio e recalcula a obra (progresso = proporção de concluídas; próxima = primeira não concluída) — **pula obras terminais** (protege a CHECK `obras_conclusao` de 100%); bloquear exige motivo (400) e barra atividade já concluída (422); reprogramar valida término ≥ início (422); ação sobre atividade de outra obra → 404 (o alvo é validado por `obra_id`).
- **Front (`registry.service` + `page.tsx`):** DTO/mapeador de atividade (enum etapa↔rótulo, estado↔situação) e um `ActivityBundle` `{ activities, work }`. No `WorkDetailPage`, o estado `activities` deixou de vir de `createWorkDetailMock` e é **carregado da API** (`useEffect` por `obraId`); `completeActivity` e os modais de nova/bloquear/reprogramar chamam a API e atualizam a lista + a obra (progresso). `WorkActivity` ganhou `databaseId`; a página passa `professionals` ao detalhe para resolver o responsável. Layout do Planejamento preservado.

### Testes executados

- **Backend:** `tests/server/registry-grupo7.test.mjs` (7 casos: criar com código local/estado inicial; término<início→400; concluir recalcula progresso (50%) e define próxima; bloquear sem motivo→400 e com motivo grava; reprogramar valida datas (422) e altera término; concluir atividade de outra obra→404; lista sem auth→401). Suíte completa do servidor **100/100**; cliente + `charge-negotiation` + `work-partners` **19/19**; banco **25/25**.
- **Typecheck:** front e backend **0 erros** (TypeScript fixado 5.9.3).
- **E2E HTTP:** servidor real no ar → `/atividades` sem token 401 → criar obra + A1/A2 → `POST …/A1/concluir` = obra `progressoPercentual` **50.00** e `proximaAtividadeDescricao` **A2**, A1 `concluida`.

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Responsável da atividade por nome** — o select usa nomes fixos (WORK_TEAM_OPTIONS); resolvido por buscar-ou-criar profissional, como na obra.
- **Progresso: manual (Grupo 6) × derivado (Grupo 7)** — a obra aceita progresso manual (`/progresso`) e, quando há atividades, `concluir` recalcula pela proporção. Coexistem por design (contrato §4.18/§4.19); em obra concluída/cancelada o recálculo é ignorado para não violar a CHECK de 100%.

### Divergências registradas

- **Diário automático adiado:** o contrato prevê que concluir/bloquear/reprogramar **gerem entrada de diário**. A trilha de **auditoria** é automática (triggers), mas a geração explícita da entrada de `obra_diario` fica para o **Grupo 10** (quando o Diário for integrado). Os appends de diário/pendências no front seguem locais (mock) até lá.
- **Reprogramar** expõe só o **novo término** na UI (o início não muda); o endpoint aceita `novoInicio` opcional para uso futuro.

### Mocks removidos

- No `WorkDetailPage`, o estado `activities` deixou de ser inicializado por `createWorkDetailMock` — vem da API. As ações de atividade deixaram de mutar só o estado local. As demais abas continuam via `createWorkDetailMock` (Grupos 8–10).

### Pendências do grupo (Grupos 8–10)

- **Equipe** (E24/E25) e **Fornecedores/contratações + pagamentos** (E26/D08) — Grupo 8.
- **Sócios/participações + aportes + ajustes de caixa** (E27–E32/D13) — Grupo 9.
- **Diário** (E33, inclui as entradas automáticas das ações de atividade) + documentos (D16) + **painel de obras** e agregações financeiras reais (D10) — Grupo 10.

### Status

🟢 Grupo totalmente integrado (Planejamento: lista de atividades, nova atividade, concluir/bloquear/reprogramar com API/banco reais e auditados; concluir recalcula o progresso da obra no servidor). Segunda entrega do Módulo 2; as demais abas e o painel dependem dos Grupos 8–10 e de D10/D13/D16 — não são regressões.

## Grupo 8 — Obras / Equipe e Fornecedores (contratações) — concluído

Duas abas do detalhe: **Equipe** (E24/E25) e **Fornecedores** (contratações E26, unificação **D08**). Sem extensão de schema. Custo de equipe é **derivado** (quantidade × valorUnitário). Uma contratação é, atomicamente, uma **despesa de obra** (`origem=contratacao_obra`) + a especialização `obra_contratacoes` + o vínculo ao **fornecedor** (criando o global se novo) — sem duplicar valor/fornecedor/pagamento.

### Telas trabalhadas

1. **Equipe** (aba) — alocações reais por obra (custo derivado quantidade × valorUnitário).
2. **Alocar profissional** (modal) — cria alocação real (`POST …/equipe`), responsável buscar-ou-criar.
3. **Remover da equipe** — `DELETE …/equipe/:id` (remoção **lógica** `removida_em`, auditada; não gera pagamento/despesa).
4. **Fornecedores** (aba) — contratações reais com pago/saldo/status derivados.
5. **Adicionar fornecedor** + **Registrar pagamento** — `POST …/contratacoes` (D08) e `POST …/contratacoes/:id/pagamentos` (reusa o mecanismo de `pagamentos_despesa`).

### Integrações realizadas

- **Backend (Hono + Drizzle):** dois módulos novos, aninhados. `server/work-team` em `/api/obras/:obraId/equipe` (`GET`, `POST`, `DELETE /:id` lógico). `server/work-contracts` em `/api/obras/:obraId/contratacoes` (`GET`, `POST`, `POST /:id/pagamentos`, `POST /:id/pagamentos/:pagId/estornar`) — **reutiliza** `loadPaymentStates`/`registerPayment`/`reversePayment` de `server/expenses` (contratação = despesa; o id da contratação é o `despesa_id`). A criação de contratação insere despesa (origem=contratacao_obra, sem categoria) + `obra_contratacoes` numa transação (a regra `despesa_especializacao` valida no commit). Novas permissões reaproveitam `obras:ler/editar` (equipe) e `despesas:criar/pagar/estornar` (contratações).
- **Regras aplicadas:** alocar valida obra/profissional ativos, período (término ≥ início) e atividades vinculadas pertencentes à obra; quantidade > 0 (400); remover é lógico e barra dupla remoção (422). Contratação valida obra e fornecedor, valor > 0; pagamento não supera o saldo (422); status do fornecedor derivado (Quitado/Vencido/Parcialmente pago/Pendente). **Contratações não aparecem no livro de Despesas** (que filtra `origem='operacao'`).
- **Front (`registry.service` + `page.tsx` + `work-suppliers.tsx`):** mapeadores de alocação e contratação (enum modalidade/fornecimento ↔ rótulos; custo/pago derivados). `WorkTeamAllocation` e `WorkSupplier` ganharam `databaseId`. No `WorkDetailPage`, equipe e fornecedores são **carregados da API** (mesmo `useEffect` das atividades); o modal “Alocar” e “Remover da equipe” chamam a API; o `WorkSuppliersPanel` recebe callbacks opcionais `onCreateContract`/`onRegisterPayment` que persistem via API e substituem a lista. Layout das abas preservado.

### Testes executados

- **Backend:** `tests/server/registry-grupo8.test.mjs` (9 casos: alocar sem custo no envio; quantidade zero→400; remoção lógica sai da lista; contratação cria despesa+especialização+fornecedor e deriva saldo; contratação **não** aparece no livro de despesas; pagamento parcial→Parcialmente pago; pagamento acima do saldo→422; reutiliza fornecedor por nome exato; sem auth→401). Suíte completa do servidor **109/109**; cliente + `charge-negotiation` + `work-partners` **19/19**; banco **25/25**.
- **Typecheck:** front e backend **0 erros** (TypeScript fixado 5.9.3).
- **E2E HTTP:** servidor real no ar → `/equipe` sem token 401 → alocar `EQP-001` (quant 160.00) → contratar `OC-001` (Elétrica Norte, saldo 48000.00, Pendente) → pagar 20000 → `Parcialmente pago` (saldo 28000.00) → **livro de despesas = 0** (contratação não polui).

### Resultado dos testes

✅ Todos os testes concluídos com sucesso.

### Problemas encontrados

- **Reuso de fornecedor por nome** — “Adicionar fornecedor” envia o nome; o servidor reaproveita o fornecedor ativo com nome exato ou cria um novo (D08), sem fundir por semelhança.
- **Custo da obra na lista/painel** — `workCostsById` (lista/dashboard) ainda soma custos de `createWorkDetailMock` para obras **não abertas**; ao abrir a obra, equipe e contratações reais substituem a fonte. A agregação real por todas as obras é do **Grupo 10** (painel + D10). O detalhe (abas Equipe/Fornecedores) já mostra dados reais.

### Divergências registradas

- **Documentos/comprovantes** de contratação e pagamento (nomes de arquivo) seguem **não persistidos** (D16). A aba Financeiro e o Diário permanecem mockados (Grupos 9–10); os pagamentos **não** somam automaticamente a `spent`/caixa (D10).
- **Vínculo alocação↔atividades** (E25) é suportado pelo backend (`atividadeIds`), mas o modal atual não o coleta — fica para quando a UI expuser.

### Mocks removidos

- No `WorkDetailPage`, `team` e a lista de fornecedores deixam de vir de `createWorkDetailMock` e são carregados da API; as ações de equipe e do painel de fornecedores persistem via API. Abas Sócios/Financeiro/Diário seguem mock (Grupos 9–10).

### Pendências do grupo (Grupos 9–10)

- **Sócios/participações + aportes + ajustes de caixa** (E27–E32/D13) — Grupo 9.
- **Diário** (E33) + documentos (D16) + **painel de obras** e agregações financeiras reais / caixa (D10) — Grupo 10.

### Status

🟢 Grupo totalmente integrado (Equipe: alocar/remover; Fornecedores: contratar/pagar, com API/banco reais e auditados; contratação unifica despesa+especialização+fornecedor via D08 e não polui o livro de despesas). Terceira entrega do Módulo 2; Sócios/Financeiro/Diário e o painel dependem dos Grupos 9–10 e de D10/D13/D16 — não são regressões.

## Grupo 10 — Painel, Financeiro, Diário e confirmações — integração executada

### Telas trabalhadas

1. **Visão geral de Obras** — custos consolidados, prioridades e agenda.
2. **Financeiro da obra** — custos comprometidos, caixa e movimentos por obra.
3. **Ajuste de caixa** — modal de inclusão e confirmação de estorno.
4. **Diário e arquivos** — lista, novo registro, anexo real e download.
5. **Resumo / pendências e confirmações** — resolução de pendências, transições de situação e diário automático das ações de atividade/fornecedor.

### Integrações realizadas

- `GET /api/obras/financeiro-resumo` e `GET /api/obras/:obraId/financeiro`: projeção das alocações ativas, contratações/pagamentos, pagamentos de cotas de aporte e ajustes assinados. Não há tabela duplicada de lançamentos. O caixa usa **aportes pagos líquidos + ajustes líquidos − pagamentos de fornecedor líquidos**; equipe é custo comprometido, não saída paga. O painel/lista de obras não usam mais custos inventados para obras ainda não abertas.
- `/api/obras/:obraId/financeiro/ajustes-caixa`: listagem, inclusão e estorno por lançamento oposto, com histórico preservado, validação, permissão e auditoria. O ajuste e sua entrada de diário são gravados na mesma transação.
- `/api/obras/:obraId/diario` e `/pendencias`: leitura real, registros append-only, progresso e próxima atividade atualizados na mesma transação, criação de pendência e resolução lógica. Autor e instante vêm do servidor. Transições da obra, concluir/bloquear/reprogramar atividade e pagamento/estorno de fornecedor passam a criar entrada de diário no backend.
- Anexo do diário recebe os **bytes** do arquivo, grava metadados/storage e `documento_vinculos` tipado; nova consulta e download autenticado retornam o arquivo. Se um upload falhar após o registro do diário ser gravado, a interface informa a persistência parcial e permite adicionar o arquivo ao registro existente, sem induzir o usuário a duplicar a entrada.
- `GET /api/obras/painel` projeta atenção e agenda de atividades/pendências reais. A agenda é leitura de atividades enquanto D15 não autoriza entidade independente. Data e filtros do painel não usam mais agosto/2026 fixo.
- No front, `registryService` existente recebeu os DTOs e métodos; `WorkDetailPage` carrega financeiro/diário/pendências por `obraId`, mostra loading/erro, envia ações pela API e recarrega os dados. Mudanças em caixa propagam ao resumo e à lista/painel.

### Testes executados

- `tests/server/registry-grupo10.test.mjs`: **7/7** (consulta vazia, custo versus pagamento, ajuste/reload/estorno, diário/progresso/pendência, upload e download dos bytes, painel projetado, validação/autenticação).
- Suíte completa da API: **116/116**; cliente: **10/10**; banco/migrations: **25/25**; testes renderizados e de domínio: **21/21**. Typecheck front/API e `db:check` passaram.
- Build e lint equivalentes executados diretamente pelos binários Windows de `vinext`/`eslint`: **passaram**. Os scripts `npm run build`/`npm run lint` invocam `bash`, indisponível neste Windows; a falha desses invólucros não é um erro de código.
- Prévia local isolada (SQLite temporário) respondeu HTML 200; pelo proxy do front, login, consulta de obra/painel/financeiro e inclusão de ajuste foram confirmados. Nova consulta devolveu **R$ 12,50** e o diário exibiu a entrada automática.
- **Não foi possível executar clique/reload visual no navegador:** a ferramenta de navegação retornou nenhum navegador disponível. A persistência após nova consulta foi validada por HTTP e banco de testes, não pela interface visual.

### Resultado dos testes

⚠️ Testes concluídos com problemas de cobertura: verificações técnicas e HTTP passaram; falta a validação de navegação visual solicitada.

### Problemas encontrados

- **Visão geral/Financeiro:** custos e movimentos vinham de `createWorkDetailMock`; caixa também subtraía custo de equipe sem pagamento correspondente. Correção: projeção real e distinção entre custo comprometido e saída paga.
- **Diário/Ajuste/pendências:** ações alteravam arrays locais, usavam data/autor fictícios e guardavam somente nomes dos anexos. Correção: API, transações auditadas, soft resolution e arquivos reais; o servidor gera entradas automáticas sem duplicação no front.
- **Confirmações:** atualizar situação e recarregar diário em paralelo poderia consultar o histórico antes do commit. Correção: aguardar o resultado da transição; falha de recarga posterior não é apresentada como falha da gravação nem induz repetição do movimento.
- **Dependência externa ao grupo:** neste checkout não há rotas/mapeadores do Grupo 9 para sócios, participações e aportes; a aba Sócios ainda opera localmente. Correção de segurança de leitura: pagamentos demonstrativos não são misturados ao caixa real. A integração precisa ser trazida/confirmada antes de qualquer auditoria final como sistema completo.

### Mocks removidos

- `workAttentionRecords` e `workCommitments` fixos; seed de financeiro/diário/pendências e os respectivos dados inventados em `createWorkDetailMock`.
- Lançamentos locais `FIN`, entradas locais `DIA` com horário fixo, resolução por filtro de array e nomes sem bytes no **Diário**.
- Permanecem, deliberadamente, os mocks de **Sócios/aportes (Grupo 9)**; não foram apagados antecipadamente.

### Pendências do grupo

- Validação visual do fluxo completo em navegador quando um browser controlável estiver disponível.
- Decisão D10 sobre saldo inicial, pagamento de mão de obra e reconciliação com `realizadoInformado`: esses dados não são modelados como movimentos pagos. O critério conservador acima é explícito e não inventa dinheiro.
- Confirmar/trazer o Grupo 9 e depois testar aportes pagos e estornados end-to-end. Anexos de **contratação/pagamento de fornecedor** ainda são nomes no painel anterior (D16 fora das cinco telas trabalhadas aqui).

### Status

🟡 Grupo parcialmente integrado/validado: as cinco telas usam API e banco nas operações implementadas e os testes disponíveis passaram, mas a validação visual e as dependências D10/Grupo 9 impedem classificá-lo como completamente encerrado ou afirmar “nenhum mock de produção” no sistema.
