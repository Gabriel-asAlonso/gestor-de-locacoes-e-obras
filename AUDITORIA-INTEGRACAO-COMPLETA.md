# Auditoria completa de integração — API e banco de dados

Data da auditoria: 14/09/2026  
Escopo: aplicação React/Vinext ativa, API Hono, SQLite/Drizzle, migrations, artefato Sites e fluxos executados no navegador.  
Regra aplicada: uma tela só é considerada integrada quando o fluxo completo **Interface → serviço → API → backend → banco → resposta → atualização da interface** foi comprovado e sobreviveu ao reload.

## 1. Resumo executivo

**Conclusão:** não. O sistema ainda não abandonou os mocks. A autenticação é a única funcionalidade de produto integrada de ponta a ponta. Todos os módulos de negócio continuam alimentados e alterados por dados mantidos no navegador.

| Resultado | Quantidade |
| --- | ---: |
| Superfícies funcionais auditadas | **50** |
| 🟢 Totalmente integradas | **1** |
| 🟡 Parcialmente integradas | **0** |
| 🔴 Não integradas | **49** |
| ⚪ Sem necessidade de backend | **0** |

O total considera 19 páginas/subpáginas/abas e 31 formulários, modais, drawers e diálogos ligados a ações de negócio. Elementos puramente estruturais do shell, como recolher o menu, não foram inflados como telas independentes.

### Evidências decisivas

- A busca global encontrou chamadas HTTP no front-end somente em `app/services/api-client.ts`, restritas a login, refresh, sessão atual e logout.
- `server/modules/index.ts` declara explicitamente que não existem módulos de negócio registrados.
- Carteiras, imóveis, unidades, locatários, imobiliárias, contratos, cobranças, despesas e obras são inicializados por arrays TypeScript em `app/page.tsx` e `app/works-mocks.ts`.
- Todas as escritas de negócio atualizam `useState`; não existe chamada HTTP dentro dos handlers de cadastro, edição, baixa, negociação, pagamento ou alteração de status.
- No teste real, uma carteira foi criada na interface, apareceu imediatamente e desapareceu após recarregar a página.
- Com a API desligada, todo o dashboard e as listagens continuaram exibindo dados completos. Ainda foi possível criar outra carteira e receber mensagem de sucesso.
- Após reload com a API desligada, apenas a autenticação falhou de forma controlada. Isso demonstra que a sessão depende da API, mas os dados de negócio não.
- O banco local real está estruturalmente íntegro, porém contém **0 usuários** e **0 registros** em todas as tabelas de negócio, enquanto a interface mostra dezenas de registros.

### Estado técnico validado

| Verificação | Resultado | Interpretação |
| --- | --- | --- |
| Testes automatizados | **96/96 passaram** | Cobrem banco, autenticação, usuários e utilitários locais; não existem testes de API dos módulos de negócio porque esses endpoints não existem. |
| Typecheck front/backend/banco | **Aprovado** | Sem erros de TypeScript. |
| Build Vinext direto | **Aprovado** | Artefato Worker gerado; aviso de chunk de cliente acima de 500 kB. |
| Lint | **0 erros, 13 avisos** | 10 usos de `<img>`, 1 ref de effect, 1 função não usada e 1 parâmetro do registrador vazio. |
| Banco local | **Íntegro, 37 tabelas de domínio, 0 violações** | Estrutura pronta, mas sem dados operacionais. |
| Comando oficial `npm run build` no Windows | **Falhou** | O script depende de Bash (`bash scripts/build-verified.sh`); o build direto com Node/Vinext passa. |
| Inicialização da API atual | **Falhou de forma esperada** | Não existe `.env`; faltam `JWT_SECRET` e `JWT_REFRESH_SECRET`. |
| Artefato Sites | **Incompleto como sistema** | O Worker publica o front, mas não contém a API Node/SQLite e o manifest tem `d1: null`. |

## 2. Mapa real da aplicação

O build possui apenas a rota física `/`. Os nomes `/inicio`, `/carteiras`, `/obras/:id` presentes em documentação anterior são rotas conceituais da implementação Angular removida. Na aplicação React atual, a navegação ocorre por `activeModule` e `page` em memória. Consequências:

- a URL não representa a tela atual;
- não há deep link para módulos ou detalhes;
- um reload volta à Visão geral depois de restaurar a sessão;
- a proteção de autenticação envolve a aplicação inteira, não rotas independentes.

### 2.1 Páginas, subpáginas e abas

| # | Módulo | Superfície | Origem real | Status |
| ---: | --- | --- | --- | --- |
| 1 | Acesso | Login e recuperação de sessão | `usuarios`/`__auth_revocations` → Hono → `authService` | 🟢 |
| 2 | Locações | Visão geral | Arrays de cobranças, despesas, unidades, imóveis e contratos; totais calculados no front | 🔴 |
| 3 | Estrutura | Carteiras | Array `portfolios` + estado React | 🔴 |
| 4 | Estrutura | Imóveis | Array `properties` + estado React | 🔴 |
| 5 | Estrutura | Unidades | Array `units` + estado React | 🔴 |
| 6 | Estrutura | Locatários e imobiliárias | Arrays `tenants`/`realEstateAgencies` + estado React | 🔴 |
| 7 | Locação | Contratos | Array `contracts` + estado React | 🔴 |
| 8 | Locação | Cobranças | Array `charges`, recebimentos e negociações em memória | 🔴 |
| 9 | Financeiro | Despesas | Array `expenses` + estado React | 🔴 |
| 10 | Obras | Visão geral de Obras | `workRecords`, `workAttentionRecords`, `workCommitments` | 🔴 |
| 11 | Obras | Listagem de Obras | `workRecords` + filtros/ordenação locais | 🔴 |
| 12 | Obras | Nova/Editar obra | Formulário grava em `workRecordState` | 🔴 |
| 13 | Obra | Detalhe — Resumo | `createWorkDetailMock()` + cálculos locais | 🔴 |
| 14 | Obra | Detalhe — Planejamento | Atividades mockadas e mutadas no componente | 🔴 |
| 15 | Obra | Detalhe — Equipe | Alocações mockadas e mutadas no componente | 🔴 |
| 16 | Obra | Detalhe — Fornecedores | Contratações/pagamentos mockados e locais | 🔴 |
| 17 | Obra | Detalhe — Sócios | Sócios, aportes, cotas e pagamentos locais | 🔴 |
| 18 | Obra | Detalhe — Financeiro | Projeção sobre lançamentos locais | 🔴 |
| 19 | Obra | Detalhe — Diário e arquivos | Diário e nomes de arquivos mockados/locais | 🔴 |

### 2.2 Formulários, drawers, modais e diálogos

| # | Superfície | Ação observada | Persistência real | Status |
| ---: | --- | --- | --- | --- |
| 20 | Carteira — criar/editar | Adiciona ou substitui item no array React | Não | 🔴 |
| 21 | Imóvel — criar/editar | Adiciona ou substitui item; documentos ficam em memória | Não | 🔴 |
| 22 | Unidade — criar/editar | Adiciona ou substitui item; documentos ficam em memória | Não | 🔴 |
| 23 | Locatário — criar/editar | Atualiza locatário e nomes copiados em contratos/cobranças | Não | 🔴 |
| 24 | Imobiliária — criar | `setTimeout(450)` e append no array | Não | 🔴 |
| 25 | Contrato — criar | Cria contrato, marca unidades e incrementa locatário localmente | Não | 🔴 |
| 26 | Cobrança — criar | Gera itens e status a partir dos mocks | Não | 🔴 |
| 27 | Despesa — criar | Cria item e status usando data congelada | Não | 🔴 |
| 28 | Drawer de Imóvel | Consulta relações por nome e documentos locais | Não | 🔴 |
| 29 | Drawer de Unidade | Consulta contrato por nome da unidade | Não | 🔴 |
| 30 | Drawer de Locatário | Consolida contratos/cobranças por nome | Não | 🔴 |
| 31 | Drawer de Contrato | Consulta cobranças no array e abre criação local | Não | 🔴 |
| 32 | Drawer de Cobrança | Exibe itens, acordo e baixas em memória | Não | 🔴 |
| 33 | Drawer de Despesa | Altera status/data no array React | Não | 🔴 |
| 34 | Registrar recebimento | Distribui valor entre itens e altera status localmente | Não | 🔴 |
| 35 | Negociar cobrança | Calcula parcelas e grava acordo em objeto React | Não | 🔴 |
| 36 | Exportar relatório de aluguéis | Gera XLSX no navegador a partir dos mocks | Não | 🔴 |
| 37 | Registrar atualização da obra | Adiciona diário e altera obra em memória | Não | 🔴 |
| 38 | Adicionar atividade | Inclui atividade no estado do detalhe | Não | 🔴 |
| 39 | Bloquear atividade | Altera atividade, cria diário e pendência local | Não | 🔴 |
| 40 | Reprogramar atividade | Altera prazo e cria diário local | Não | 🔴 |
| 41 | Adicionar pessoa à equipe | Inclui alocação e recalcula custo local | Não | 🔴 |
| 42 | Adicionar fornecedor | Cria contratação local à obra | Não | 🔴 |
| 43 | Drawer de fornecedor | Exibe contratação e pagamentos locais | Não | 🔴 |
| 44 | Pagamento de fornecedor | Incrementa pago e cria lançamento local | Não | 🔴 |
| 45 | Sócio — criar/editar/remover | Muta participação; confirmação é apenas visual | Não | 🔴 |
| 46 | Solicitar aporte | Rateia em centavos sobre sócios em memória | Não | 🔴 |
| 47 | Drawer de aporte | Exibe cotas e pagamentos locais | Não | 🔴 |
| 48 | Pagamento de aporte | Acrescenta pagamento e lançamento financeiro local | Não | 🔴 |
| 49 | Ajuste de caixa | Adiciona lançamento assinado em memória | Não | 🔴 |
| 50 | Diálogo de confirmação | Confirma descarte/remoção, mas a ação subjacente é local | Não | 🔴 |

## 3. Matriz completa de integração

Legenda: **Real** = Banco → API → front; **Local** = estado do navegador; **Mock** = registro simulado; **Calc. front** = derivação no navegador; **—** = não aplicável.

| Módulo / tela | Consulta | Cadastro / ação | Edição | Exclusão | Filtros | API | Banco | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Login/sessão | Real | Login/logout reais | Refresh real | Revogação real | — | `/api/auth/*` | `usuarios`, revogações | 🟢 |
| Locações — Visão geral | Mock + Calc. front | Navegação local | — | — | Sem filtro temporal real | Não | Não | 🔴 |
| Carteiras | Mock | Local | Local | Ausente | Front | Não | Não | 🔴 |
| Imóveis | Mock | Local | Local | Ausente | Front | Não | Não | 🔴 |
| Unidades | Mock | Local | Local | Ausente | Front | Não | Não | 🔴 |
| Locatários | Mock | Local | Local | Ausente | Front | Não | Não | 🔴 |
| Imobiliárias | Mock | Local | Ausente | Ausente | Front | Não | Não | 🔴 |
| Contratos | Mock | Local | Ausente | Ausente | Front | Não | Não | 🔴 |
| Cobranças | Mock | Local | Via acordo/baixa local | Ausente | Front | Não | Não | 🔴 |
| Recebimentos | Mock/estado vazio | Local | Ausente | Estorno ausente | — | Não | Não | 🔴 |
| Negociações | Estado vazio | Local | Substituição local | Ausente | — | Não | Não | 🔴 |
| Relatório de aluguéis | Mock + Calc. front | XLSX local | — | — | Front | Não | Não | 🔴 |
| Despesas | Mock | Local | Status local | Ausente | Front | Não | Não | 🔴 |
| Obras — Visão geral | Mock + Calc. front | Navegação local | — | — | Front | Não | Não | 🔴 |
| Obras — Listagem | Mock | Local | Local | Ausente | Front | Não | Não | 🔴 |
| Obra — Resumo | Mock + Calc. front | Atualização local | Local | — | — | Não | Não | 🔴 |
| Obra — Planejamento | Mock | Atividade local | Bloquear/concluir/reprogramar local | Ausente | Ausente | Não | Não | 🔴 |
| Obra — Equipe | Mock | Alocação local | Ausente | Remoção local | Ausente | Não | Não | 🔴 |
| Obra — Fornecedores | Mock | Contratação/pagamento local | Ausente | Ausente | Front | Não | Não | 🔴 |
| Obra — Sócios/aportes | Mock | Sócio/aporte/pagamento local | Participação local | Remoção local | — | Não | Não | 🔴 |
| Obra — Financeiro | Mock + Calc. front | Ajuste local | — | Estorno ausente | Front | Não | Não | 🔴 |
| Obra — Diário/arquivos | Mock | Atualização local | — | Ausente | — | Não | Não | 🔴 |
| Documentos cadastrais | Estado vazio/local | `File` + `blob:` local | Coleção local | Remoção local | — | Não | Não | 🔴 |

As 23 linhas acima consolidam as 50 superfícies detalhadas no inventário; nenhuma superfície vermelha possui fluxo parcial até o banco.

### 3.1 Detalhamento das superfícies com problema

As superfícies relacionadas na mesma linha compartilham a mesma lacuna de integração e o mesmo conjunto de arquivos. Não há linha amarela: em todos os casos abaixo, tanto a leitura quanto a gravação do domínio ficam no navegador.

| Tela / superfícies | Arquivo(s) principal(is) | Situação atual | O que falta integrar | Endpoint(s) necessário(s) | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Locações — Visão geral | `app/page.tsx` | Indicadores, gráficos e alertas derivados dos arrays mockados | Consultas agregadas por carteira, competência e status | `GET /api/dashboard/locacoes` | Crítica |
| Carteiras — lista, detalhe e assistente | `app/page.tsx` | Pesquisa, seleção, criação e edição em `useState` | CRUD persistente, validação de vínculos e estatísticas reais | `GET/POST/PATCH/DELETE /api/carteiras` | Crítica |
| Imóveis — lista, detalhe, assistente e documentos | `app/page.tsx`, `app/document-manager.tsx`, `app/local-documents.ts` | Registros, imagens e anexos locais; arquivos usam URL `blob:` | CRUD, upload, metadados e remoção persistentes | `/api/imoveis`, `/api/documentos`, storage | Crítica |
| Unidades — lista, detalhe e assistente | `app/page.tsx` | Filtros, cadastro e edição no array local | CRUD, vínculo com imóvel e regras de ocupação | `GET/POST/PATCH/DELETE /api/unidades` | Crítica |
| Locatários — lista, detalhe, assistente e documentos | `app/page.tsx`, `app/document-manager.tsx`, `app/local-documents.ts` | Dados e documentos somente na sessão do navegador | CRUD, vínculos contratuais e documentos persistentes | `/api/locatarios`, `/api/documentos`, storage | Crítica |
| Imobiliárias — lista e cadastro | `app/page.tsx` | Registros iniciais hardcoded e inclusão local | CRUD e validações cadastrais | `GET/POST/PATCH/DELETE /api/imobiliarias` | Alta |
| Contratos — lista, detalhe e assistente | `app/page.tsx` | Contratos, encargos e unidades simulados | CRUD transacional, histórico, vigência e vínculos reais | `/api/contratos`, `/api/contratos/:id/unidades`, `/api/contratos/:id/encargos` | Crítica |
| Cobranças — lista, detalhe e ações | `app/page.tsx` | Cobranças e itens mockados; alterações locais | Geração, consulta, cancelamento/estorno e mudança de status persistentes | `/api/cobrancas`, `/api/cobrancas/:id/itens` | Crítica |
| Recebimento/baixa | `app/page.tsx` | Salva recebimento e alocação somente no estado React | Transação de baixa, alocação, conciliação e estorno | `POST /api/recebimentos`, `/api/recebimentos/:id/alocacoes`, `/api/recebimentos/:id/estorno` | Crítica |
| Negociação/acordo | `app/page.tsx`, `app/charge-negotiation.ts` | Cálculo e parcelas criados localmente | Transação de negociação, substituição de cobrança e geração de parcelas | `/api/negociacoes`, `/api/negociacoes/:id/parcelas` | Crítica |
| Relatório de aluguéis | `app/page.tsx`, `app/accounting-report.ts`, `app/accounting-report-export.ts` | Relatório e XLSX derivados integralmente dos mocks | Consulta contábil consolidada, período real e trilha de origem | `GET /api/relatorios/alugueis` | Alta |
| Despesas — lista, cadastro e ações | `app/page.tsx` | Cadastro e mudança de status locais; categorias hardcoded | CRUD, aprovação, pagamento/estorno e categorias reais | `/api/despesas`, `/api/despesas/:id/pagamentos`, `/api/categorias-despesa` | Crítica |
| Obras — visão geral | `app/page.tsx`, `app/works-mocks.ts` | KPIs e alertas calculados sobre oito obras simuladas | Consultas agregadas com filtros persistentes | `GET /api/dashboard/obras` | Alta |
| Obras — lista, cadastro e edição | `app/page.tsx`, `app/works-mocks.ts` | CRUD e todos os filtros no navegador | CRUD, paginação, busca, ordenação e validação de vínculos | `GET/POST/PATCH/DELETE /api/obras` | Crítica |
| Obra — resumo | `app/page.tsx`, `app/work-detail-mocks.ts` | Resumo financeiro e progresso derivados dos mocks | Consulta consolidada da obra e atualização persistente | `GET/PATCH /api/obras/:id` | Alta |
| Obra — planejamento e atividades | `app/page.tsx`, `app/work-detail-mocks.ts` | Criar, bloquear, concluir e reprogramar mutam o array local | CRUD de atividades, transições de estado e dependências | `/api/obras/:id/atividades` | Crítica |
| Obra — equipe e alocações | `app/page.tsx`, `app/work-detail-mocks.ts` | Alocação e remoção locais; equipes são opções fixas | CRUD de alocações, catálogo de profissionais/equipes e auditoria | `/api/obras/:id/equipe`, `/api/profissionais` | Alta |
| Obra — fornecedores, contratações e pagamentos | `app/work-suppliers.tsx`, `app/work-detail-mocks.ts` | Contratação e pagamento apenas incrementam valores locais | CRUD de fornecedores/contratações e pagamentos transacionais | `/api/fornecedores`, `/api/obras/:id/contratacoes`, `/api/despesas/:id/pagamentos` | Crítica |
| Obra — sócios, aportes, cotas e pagamentos | `app/work-partners.tsx`, `app/work-partners-model.ts`, `app/work-detail-mocks.ts` | Participação, rateio, aporte e pagamento ficam em memória | CRUD de sócios, cálculo persistido, cotas e pagamentos transacionais | `/api/obras/:id/socios`, `/api/obras/:id/aportes`, `/api/aportes/:id/pagamentos` | Crítica |
| Obra — financeiro e ajuste de caixa | `app/page.tsx`, `app/work-detail-mocks.ts` | Fluxo e saldo calculados no front; ajuste cria lançamento local | Razão financeiro consultável, ajuste auditável e estorno | `/api/obras/:id/financeiro`, `/api/obras/:id/ajustes-caixa` | Crítica |
| Obra — diário, pendências e arquivos | `app/page.tsx`, `app/work-detail-mocks.ts`, `app/document-manager.tsx` | Entradas mockadas e documentos voláteis | CRUD de diário/pendências e storage persistente | `/api/obras/:id/diario`, `/api/obras/:id/pendencias`, `/api/documentos` | Alta |
| Confirmações de remoção/descarte | `app/confirm-dialog.tsx` e chamadores | O diálogo funciona, mas confirma mutações somente locais | Conectar cada confirmação ao comando real, tratar conflito/erro e atualizar cache | Endpoints `DELETE`, cancelamento ou estorno do recurso correspondente | Alta |

## 4. Listagens, pesquisas, filtros, paginação e ordenação

| Tela | Pesquisa | Filtros | Ordenação | Paginação | Classificação |
| --- | --- | --- | --- | --- | --- |
| Carteiras | `filter/includes` no array | — | Ordem do array | Nenhuma | Front-end |
| Imóveis | `filter/includes` | Carteira local | Ordem do array | Nenhuma | Front-end |
| Unidades | `filter/includes` | Carteira e ocupação locais | Ordem do array | Nenhuma | Front-end |
| Locatários | `filter/includes` | Vínculo e imobiliária locais | Ordem do array | Nenhuma | Front-end |
| Contratos | `filter/includes` | Carteira local | Ordem do array | Nenhuma | Front-end |
| Cobranças | `filter/includes` | Carteira e status locais | Ordem do array | Nenhuma | Front-end |
| Despesas | `filter/includes` | Status e categoria locais | `sort()` local | Nenhuma | Front-end |
| Obras — painel | Sem pesquisa | Imóvel e período locais | Fatiamento/ordem local | Nenhuma | Front-end |
| Obras — listagem | `filter/includes` | Status, imóvel, responsável, prioridade, período e atraso locais | `sort()` local | Nenhuma | Front-end |
| Abas da obra | Ausente ou busca local no fornecedor | Sem filtros de servidor | Ordem dos arrays | Nenhuma | Front-end |

Nenhuma listagem envia `page`, `limit`, `search`, `sortBy` ou `sortOrder` à API. Os rodapés “x de y” não representam paginação; todos os registros simulados já estão carregados no navegador.

## 5. Mocks de produção restantes

| Arquivo | Dados/finalidade | Volume inicial confirmado | Endpoint que deve substituir |
| --- | --- | ---: | --- |
| `app/page.tsx` | Carteiras | 2 | `GET/POST/PATCH /api/carteiras` |
| `app/page.tsx` | Imóveis e imagens por ID | 8 | `/api/imoveis` + documentos/storage |
| `app/page.tsx` | Unidades | 14 | `/api/unidades` |
| `app/page.tsx` | Locatários | 5 | `/api/locatarios` |
| `app/page.tsx` | Imobiliárias | 3 | `/api/imobiliarias` |
| `app/page.tsx` | Contratos | 4 | `/api/contratos` |
| `app/page.tsx` | Cobranças e itens | 5 | `/api/cobrancas` |
| `app/page.tsx` | Despesas | 6 | `/api/despesas` |
| `app/works-mocks.ts` | Obras | 8 | `/api/obras` |
| `app/works-mocks.ts` | Prioridades do painel | 5 | `/api/dashboards/obras` ou consulta derivada |
| `app/works-mocks.ts` | Agenda/compromissos | 5 | Projeção de atividades/pagamentos; D15 decide recurso próprio |
| `app/work-detail-mocks.ts` | Detalhe gerado por obra | 5 atividades, 3 pessoas, 2 fornecedores, 3 sócios, 1 aporte, 3 lançamentos, 3 diários e 2 pendências por obra de referência | Endpoints filhos de `/api/obras/:id` |

Não foram encontrados JSONs de dados de demonstração em produção. As ocorrências de fixture dentro de `tests/**` são legítimas e foram excluídas da lista de problemas.

## 6. Dados hardcoded relevantes

- Datas-base `2026-08-12` e `2026-08-24` controlam vencimento, risco, cadastro, pagamentos, diário e dashboards.
- Competências `08/2026` e `2026-08` são defaults fixos de painel, cobrança, relatório e despesa.
- Totais financeiros, saldos, percentuais e séries de gráficos são calculados sobre mocks, portanto parecem dinâmicos mas não representam o banco.
- Gestores de carteira/imóvel são três nomes fixos.
- Equipe de obras contém seis profissionais fixos.
- Categorias de despesa e contas financeiras são arrays locais, embora existam tabelas próprias no banco.
- Formas de pagamento, tipos de imóvel/unidade e estados também são constantes. Estes podem permanecer como enums do cliente se o contrato mantiver códigos versionados; não são todos, por si só, defeitos.
- Imagens de imóveis são mapeadas por IDs mockados e um fallback fixo.
- IDs de negócio são gerados pelo navegador com `nextRecordId`, sem proteção contra concorrência ou duplicidade no banco.

## 7. Funcionalidades simuladas

### Estrutura e locação

- criação e edição de carteira, imóvel, unidade e locatário;
- criação de imobiliária;
- vínculo entre entidades por nome, não por UUID;
- criação de contrato, ocupação de unidade e incremento do contador do locatário;
- geração de cobrança e itens por competência;
- baixa e alocação de recebimento;
- negociação e parcelamento;
- criação e alteração de status de despesa;
- contadores do menu, cards e detalhes.

### Obras

- criação e edição de obra;
- conclusão, bloqueio e reprogramação de atividade;
- resolução de pendência;
- alocação/remoção de equipe;
- cadastro de fornecedor e pagamento;
- cadastro/edição/remoção de sócio;
- solicitação e pagamento de aporte;
- ajuste manual de caixa;
- diário e referências de arquivo;
- prioridades e agenda do dashboard.

### Documentos e relatórios

- documentos são `File` do navegador com URL `blob:`; ficam disponíveis somente durante a sessão;
- a remoção revoga a URL local, não remove um objeto persistido;
- o relatório XLSX é gerado localmente sobre cobranças mockadas; não consulta o banco nem o endpoint previsto.

### Simulação de latência

Os formulários de entidades e imobiliária usam `setTimeout(450)` antes de chamar o handler local. Outros timers de toast e checagem inicial do navegador são efeitos de interface legítimos e não foram classificados como backend simulado.

## 8. Endpoints existentes e consumo

| Método | Endpoint | Consumido pelo front | Banco | Situação |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Sim | `usuarios` | Integrado; 200/400/401/403 testados |
| `POST` | `/api/auth/refresh` | Sim | `usuarios`, `__auth_revocations` | Integrado; rotação/concorrência/restart testados |
| `GET` | `/api/auth/me` | Sim | `usuarios` | Integrado; 200/401 testados |
| `POST` | `/api/auth/logout` | Sim | `__auth_revocations` | Integrado; revogação persistente testada |
| `GET` | `/health` | Não | Consulta de conectividade | Endpoint operacional sem consumidor de UI |
| `GET` | `/api/users` | Não | `usuarios` | Administrativo necessário, mas sem tela/consumer |
| `POST` | `/api/users` | Não | `usuarios`, auditoria | Administrativo necessário, mas sem tela/consumer |
| `GET` | `/api/users/:id` | Não | `usuarios` | Administrativo necessário, mas sem tela/consumer |

Não há endpoint legado de negócio: o registrador modular está vazio. Portanto, não existe endpoint de domínio implementado e órfão; o que existe são endpoints administrativos ainda sem tela.

## 9. Funcionalidades presentes no front sem endpoint

Prioridade crítica ou alta porque a interface já permite executar as ações:

| Área | Famílias de endpoint ausentes | Prioridade |
| --- | --- | --- |
| Dashboards | `/api/dashboards/locacoes`, `/api/dashboards/obras` | Crítica |
| Carteiras | listagem, detalhe, criação e edição | Crítica |
| Imóveis | listagem, detalhe, criação, edição e relações | Crítica |
| Unidades | listagem, detalhe, criação, edição e ocupação | Crítica |
| Locatários/imobiliárias | CRUD permitido e lookups | Alta |
| Contratos | listagem, detalhe, criação e ações de ciclo | Crítica |
| Cobranças | emissão, detalhe, itens, negociação e recebimento | Crítica |
| Despesas | criação, listagem, detalhe, pagamento e estorno | Crítica |
| Obras | CRUD, resumo, atividades, equipe e pendências | Crítica |
| Fornecedores/contratações | cadastros, vínculo com obra e pagamentos | Alta |
| Sócios/aportes | cadastros, participações, rateio e pagamentos | Crítica |
| Financeiro da obra | consulta consolidada e ajuste/estorno | Crítica |
| Diário | registros, autoria real e anexos | Alta |
| Documentos | metadata, upload/storage, download e remoção | Crítica |
| Relatórios | `/api/relatorios/alugueis` sobre dados reais | Alta |
| Auxiliares | profissionais, categorias, contas e contadores | Alta |

Os corpos e estados finais desses endpoints devem respeitar as decisões D03–D20 já registradas no contrato; não é seguro inferir regras financeiras ou documentais silenciosamente.

## 10. Tabelas do banco sem utilização pela aplicação de negócio

Das 37 tabelas de domínio, somente `usuarios` e `auditoria_eventos` têm uso pela API atual. A tabela técnica `__auth_revocations` também é usada pela autenticação. As **35 tabelas de domínio restantes não possuem rota de aplicação**:

| Grupo | Tabelas sem rota/consumer |
| --- | --- |
| Cadastros | `documentos`, `carteiras`, `imobiliarias`, `fornecedores`, `profissionais`, `socios`, `categorias_despesa`, `contas_financeiras`, `imoveis`, `locatarios`, `unidades` |
| Contratos e recebíveis | `contratos`, `contrato_unidades`, `contrato_encargos`, `cobrancas`, `cobranca_itens`, `negociacoes`, `negociacao_parcelas`, `recebimentos`, `recebimento_alocacoes` |
| Despesas | `despesas`, `pagamentos_despesa` |
| Obras | `obras`, `obra_atividades`, `obra_alocacoes_equipe`, `obra_equipe_atividades`, `obra_socios`, `aportes`, `aporte_cotas`, `aporte_pagamentos`, `obra_ajustes_caixa`, `obra_diario`, `obra_pendencias`, `obra_contratacoes` |
| Documentos relacionados | `documento_vinculos` |

Estado do arquivo `.data/locacoes.sqlite` durante a auditoria:

- `usuarios`: 0;
- `categorias_despesa`: 7;
- `auditoria_eventos`: 7;
- todas as outras tabelas de domínio: 0;
- migrations aplicadas: 4;
- violações de integridade: 0.

Isso comprova que os 2 portfolios, 8 imóveis, 14 unidades, 5 locatários, 4 contratos, 5 cobranças, 6 despesas e 8 obras visíveis não vêm do banco atual.

## 11. Autenticação e permissões

### Autenticação

A autenticação está integrada:

- login valida usuário/senha no banco;
- access e refresh tokens são emitidos;
- `/auth/me` recupera a identidade;
- refresh rotaciona de forma atômica;
- logout revoga a família de sessão;
- revogação sobrevive ao reinício do backend;
- acesso sem token e token inválido/expirado retornam 401;
- usuário inativo retorna 403;
- não existe mais credencial fixa ou fallback de login no código de produção.

Limitação operacional atual: sem `.env`, a API real falha no startup por ausência dos dois segredos JWT, e o banco local não possui administrador. A implementação é funcional, mas a instalação atual ainda precisa ser configurada/provisionada para permitir login.

### Permissões

- O único perfil suportado é `administrador`, com todas as permissões.
- `/api/users` aplica autenticação e autorização no backend.
- O front recebe `permissoes[]`, porém não consulta essa lista para liberar ou bloquear botões; usa somente o perfil para mostrar o rótulo “Administrador”.
- Não é possível provar autorização dos módulos de negócio porque seus endpoints não existem.
- Hoje não há um segundo perfil funcional para executar uma matriz completa de 403 por ação.

## 12. Teste de ausência da API e persistência

Fluxo executado em banco temporário isolado, sem tocar dados de produção:

1. login real pela interface: sucesso;
2. reload: sessão restaurada via refresh + `/auth/me`;
3. criação de “Carteira Auditoria”: apareceu como `CAR-003`;
4. reload: a carteira desapareceu;
5. API desligada mantendo o front aberto: dashboards, imóveis, unidades, locatários, contratos, cobranças, despesas e obras continuaram completos;
6. ainda sem API, criação de “Carteira sem API”: a interface confirmou sucesso e mostrou o registro;
7. reload com API desligada: sessão não pôde ser restaurada e o login mostrou “Serviço indisponível. Tente novamente.”

Classificação:

- autenticação: persistência real;
- qualquer cadastro/movimentação de negócio: persistência inexistente;
- verificação de conectividade interna: `navigator.onLine`, incapaz de detectar que a API caiu;
- banner da interface informa corretamente que os módulos ainda são demonstrativos.

## 13. Problemas encontrados por criticidade

### Crítica

1. **49 de 50 superfícies não têm integração de domínio.** Toda consulta e escrita de negócio é local.
2. **A interface aceita operações financeiras sem API**, incluindo recebimento, negociação, despesa, pagamento, aporte e ajuste de caixa.
3. **O deploy Sites não representa o sistema completo.** O Worker não contém Hono/SQLite, `/api` só possui proxy no Vite de desenvolvimento e o manifest não declara D1.
4. **Documentos não são armazenados.** URLs `blob:` e objetos `File` somem ao fechar/recarregar.

### Alta

5. **Banco e interface exibem bases incompatíveis.** O banco de negócio está vazio, enquanto a interface mostra registros e valores.
6. **Relacionamentos por nomes copiados**, sujeitos a inconsistência após renomear entidades.
7. **Datas congeladas em agosto/2026** controlam regras financeiras e de prazo.
8. **Sem paginação, busca, filtro ou ordenação de servidor** em qualquer listagem.
9. **Permissões retornadas pela API não governam a interface** e não existem guards de domínio no backend.
10. **Ambiente local não está pronto para uso real:** sem `.env` e sem usuário administrador.

### Média

11. **Somente uma rota física `/`**; reload perde o contexto de navegação.
12. **Scripts oficiais de build/test/lint dependem de Bash** e falham neste ambiente Windows, embora os comandos diretos passem.
13. **Bundle de cliente acima de 500 kB**, coerente com a concentração de quase todo o sistema em `app/page.tsx` e ExcelJS no front.
14. **13 avisos de lint**, sem erro bloqueante.
15. **Chave React duplicada `Obras` observada no navegador**, no breadcrumb renderizado em `app/page.tsx`; o próprio React alerta que itens podem ser duplicados ou omitidos.

## 14. Plano de correção proposto

Nenhuma correção foi aplicada nesta auditoria.

1. **Resolver arquitetura de execução e D01:** escolher entre adaptar API/persistência para Worker+D1 ou manter Hono Node/SQLite em serviço separado com URL/CORS/deploy definidos. Não publicar somente o front.
2. **Fechar divergências de contrato e campos ativos:** decidir explicitamente quais campos atuais serão preservados, principalmente Imóveis, Unidades, Locatários, Contratos, Financeiro e Documentos.
3. **Configurar o ambiente real:** `.env`, segredos, origem permitida, admin inicial e processo único de inicialização verificável no Windows.
4. **Implementar lookups/base:** usuários administrativos, profissionais, fornecedores, sócios, categorias e contas financeiras.
5. **Integrar Carteiras → Imóveis → Unidades:** CRUD suportado, UUIDs, paginação, busca, filtros, detalhes e reload.
6. **Integrar Imobiliárias → Locatários:** vínculos por ID, selects reais e propagação sem cópias por nome.
7. **Integrar Contratos:** decisões de ocupação/ciclo/encargos; somente depois permitir ativar ou ocupar unidades.
8. **Integrar Cobranças → Recebimentos → Negociações:** movimentos imutáveis, concorrência, estorno, erros de regra e testes financeiros.
9. **Integrar Despesas e pagamentos:** fornecedores/categorias/contas reais, baixa e estorno persistentes.
10. **Integrar Obras por abas:** cadastro, planejamento, equipe, fornecedores, sócios/aportes, financeiro, pendências e diário.
11. **Definir D16 e implementar documentos:** storage durável, metadados, alvo, permissão, retenção e remoção.
12. **Substituir dashboards e relatório por consultas derivadas reais:** período/fuso D19 e regras D20.
13. **Remover os mocks controladamente, módulo a módulo:** somente após cada tela passar CRUD, falhas, permissão, reload e reinício.
14. **Executar E2E final:** navegador + API + banco reais, API indisponível, múltiplos perfis quando existirem, paginação e relações cruzadas.

## 15. Resposta final da auditoria

**Todas as telas abandonaram os mocks e funcionam com API e banco? Não.**

O estado atual é uma fundação de banco e autenticação robusta conectada a uma aplicação de demonstração visual. A interface já oferece muitos fluxos completos do ponto de vista de UX, mas quase todos são simulações em memória. A próxima etapa deve integrar os módulos progressivamente, mantendo o contrato e as decisões pendentes explícitos e exigindo persistência comprovada após reload antes de marcar qualquer tela como concluída.
