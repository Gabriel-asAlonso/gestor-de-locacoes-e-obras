# Modelagem de dados para validação — Locações e Obras

Data: 14/09/2026. Versão: proposta lógica 1.0. Situação: aguardando validação de negócio.

## 1. Objetivo, evidência e limites

Esta proposta transforma o mapeamento anterior em um modelo relacional, com campos, chaves, integridade, movimentos, históricos e consultas derivadas. É documentação: não cria tabelas, migrations, API ou alterações na aplicação.

A referência funcional é o Angular em `src/`, conforme o levantamento anterior. O React/Vinext em `app/` e os campos de interfaces sem uso ativo são referências secundárias, não requisitos automaticamente aprovados. A configuração D1 existente não determina a escolha do banco desta proposta.

Legenda usada em todo o documento:

- **E — evidenciado:** informação ou comportamento encontrado no fluxo atual. Isso não significa que a implementação atual seja correta ou persistente.
- **S — Sugestão de modelagem:** solução proposta para persistência, integridade ou rastreabilidade. Precisa ser validada; não é regra existente.
- **Dxx — Decisão de negócio pendente:** questão numerada na seção 10. A solução apresentada é a hipótese escolhida para tornar o modelo revisável; a aprovação pode alterar campos e relações.

Tipos, tamanhos máximos, índices, FKs, padrões de auditoria e regras de exclusão são propostas técnicas **S**, mesmo quando o campo que representam é **E**. “Obrigatório” nas tabelas significa a obrigatoriedade sugerida para o banco; as divergências em relação ao frontend estão declaradas.

### Escolhas centrais da proposta

1. Usar UUID como identidade estável; preservar códigos como `CAR-001` apenas para consulta/apresentação.
2. Usar relações explícitas para unidades de contrato, itens, parcelas, alocações, sócios e anexos.
3. Registrar cada entrada/saída de dinheiro; calcular saldos a partir dos movimentos válidos.
4. Guardar percentuais e valores pactuados como fotografias históricas quando sua mudança futura não pode alterar um registro antigo.
5. Propor um único cadastro de fornecedores e uma base de despesas/pagamentos compartilhada, com contratação de obra como especialização 1:1. Essa unificação é **S/D08**, não existe hoje.
6. Manter progresso, risco e realizado informados da obra enquanto forem entradas manuais reais da interface. Não os substituir silenciosamente por cálculos de outra natureza.
7. Não criar tabelas para dashboards, cards, gráficos, toasts, selects fixos, alertas calculáveis ou o XLSX.

## 2. Padrões de campos e integridade

### 2.1 Tipos lógicos e banco ainda não escolhido

| Informação | Tipo lógico sugerido | Convenção |
| --- | --- | --- |
| Identidade | UUID | Gerado uma vez para o registro; nunca CPF, CNPJ ou nome |
| Código de apresentação | VARCHAR(32) | Sequencial por entidade ou por obra, com escopo declarado |
| Nome | VARCHAR(200) | Não vazio após trim; não é único por padrão |
| Descrição curta | VARCHAR(500) | Limite proposto, inexistente em vários formulários atuais |
| Observação/descrição longa | TEXT | Sem transportar HTML executável |
| Dinheiro | DECIMAL(15,2) | BRL; arredondamento explícito em centavos; nunca FLOAT |
| Percentual | DECIMAL(5,2) | 0,00 a 100,00; limite inferior depende da entidade |
| Quantidade/área | DECIMAL(12,2) | Aceita áreas e frações de hora/diária |
| Dia de vencimento | SMALLINT | 1 a 31 |
| Data de negócio | DATE | Sem horário; não converter vencimento em timestamp |
| Competência | DATE | Primeiro dia do mês; apresentação `MM/AAAA` |
| Instante | TIMESTAMP com fuso/UTC | Auditoria e eventos; apresentação no fuso de operação, a validar em D19 |
| Estado/domínio pequeno | VARCHAR + CHECK | Códigos estáveis sem acentos; rótulos traduzidos pela aplicação |
| Arquivo | BIGINT + VARCHAR | Tamanho e chave de objeto; conteúdo fora da linha relacional |
| Snapshot de auditoria | JSON | Apenas diferenças/histórico técnico; não listas financeiras ou FKs |

São tipos lógicos, não DDL executável. Se o banco escolhido não garantir decimal fixo, dinheiro deve ser representado fisicamente por inteiro de centavos e percentuais por inteiro de centésimos de ponto percentual. Não basta declarar `DECIMAL` em um mecanismo sem essa garantia. A escolha e o suporte a índices parciais, exclusão temporal e transações são D01.

Os valores monetários atuais são BRL. Propõe-se moeda única por aplicação, sem coluna `moeda` repetida em todas as linhas e sem tabela de câmbio. Multimoeda não é requisito confirmado. No futuro, mudaria os documentos financeiros e suas regras de agregação.

### 2.2 Campos comuns, incluídos por referência no dicionário

Cada entidade abaixo declara quais conjuntos recebe. Esses conjuntos fazem parte dos campos da entidade, não são novas tabelas.

**P — identidade:**

| Campo | Tipo | Obrigatório | Único | Padrão | Observação |
| --- | --- | --- | --- | --- | --- |
| id | UUID | Sim | PK | UUID gerado | Imutável |

**A — autoria de criação, para registros permanentes:**

| Campo | Tipo | Obrigatório | Único | Padrão | Observação |
| --- | --- | --- | --- | --- | --- |
| created_at | TIMESTAMP UTC | Sim | Não | Instante do servidor | Data real de entrada no banco |
| created_by | UUID | Condicional | Não | Usuário autenticado | FK → usuarios.id, RESTRICT; NULL somente bootstrap/importação/processo identificado em auditoria |

**U — alteração, somente para entidades editáveis:**

| Campo | Tipo | Obrigatório | Único | Padrão | Observação |
| --- | --- | --- | --- | --- | --- |
| updated_at | TIMESTAMP UTC | Sim | Não | Instante de criação | Atualizado pelo servidor |
| updated_by | UUID | Condicional | Não | Ator da criação | FK → usuarios.id, RESTRICT; mesmas exceções de A |

**I — inativação de cadastro:**

| Campo | Tipo | Obrigatório | Único | Padrão | Observação |
| --- | --- | --- | --- | --- | --- |
| ativo | BOOLEAN | Sim | Não | true | S: novos vínculos vedados após inativação; histórico continua legível |

**R — reversão de movimentos, Sugestão de modelagem D09:**

| Campo | Tipo | Obrigatório | Único | Padrão | Observação |
| --- | --- | --- | --- | --- | --- |
| estorno_de_id | UUID | Não | Sim quando preenchido | NULL | FK à PK da própria tabela, RESTRICT; no máximo um estorno integral por original |
| motivo_estorno | TEXT | Se estorno | Não | NULL | Obrigatório para a reversão; nulo no movimento original |

Os registros de estorno são novas linhas, com identidade e código próprios quando houver código. O original não é apagado ou sobrescrito. Em recebimentos e pagamentos, o valor é sempre positivo; a natureza original/estorno determina o sinal na consulta. Em ajustes de caixa, o valor já é assinado, e a reversão tem sinal contrário. Não adicionar `deleted_at` a movimentos para simular estorno. A validação de não exceder saldo disponível aplica-se às novas baixas originais; estornos são validados contra o movimento original e suas alocações, além das dependências posteriores, não contra o saldo já quitado.

Todos os campos opcionais usam NULL para ausência, não textos vazios, datas fictícias nem valores zero para “desconhecido”. Nenhum dado histórico recebe automaticamente a identidade/data do usuário atual como se fosse a autoria original.

### 2.3 Chaves, códigos e escopos

- Padrão: PK `id UUID`. Exceções explícitas: `contrato_unidades` e `obra_equipe_atividades` têm PK composta; `obra_contratacoes` tem PK/FK `despesa_id`.
- Códigos globais: carteiras, imóveis, unidades, imobiliárias, locatários, contratos, cobranças, obras e despesas da operação.
- Códigos por obra: atividades, alocações, contratações, aportes, diário, pendências e compromissos. `ATV-001` pode existir em duas obras diferentes.
- Identificadores `FOR-001` dos mocks identificam a contratação local, não uma empresa global. Não serão usados como PK de `fornecedores`.
- Nomes não são únicos. Documento de titular não é único em carteiras: um titular pode aparecer em várias delas; isso não prova que todas sejam a mesma carteira.
- Para locatário/imobiliária, unicidade documental é proposta em D18, não algo validado pelo frontend. E-mail de contato não é único. E-mail de acesso normalizado é único por instalação no cenário D01.
- Códigos novos devem ser gerados atomicamente no banco/serviço transacional, não por `maior número + 1` lido fora de transação. Sequência pode ter lacunas.
- Não foram encontrados IDs de bancos, ERP ou fornecedores externos. Não se adicionam colunas de integração sem fonte.
- Chaves de uma operação de gravação devem ser reutilizadas em tentativas da mesma operação; colisão com payload diferente é erro. Detalhes de idempotência da futura API não exigem uma tabela de domínio agora.

### 2.4 O que o banco consegue garantir

- **NOT NULL/CHECK/UNIQUE/FK:** presença, limites por linha, pertencimento básico, duplicidade e integridade de referência.
- **Transação com bloqueio/isolamento adequado:** somas de pagamentos, soma de participações, igualdade de rateio, sobreposição entre contratos e consistência entre entidades. Um `CHECK` comum de uma linha não resolve somas entre linhas nem concorrência.
- **Trigger/constraint diferida, se suportada, ou serviço transacional com escrita restrita:** garantias cruzadas detalhadas na seção 7. Regras críticas não podem depender da validação do navegador.
- **Data corrente:** status vencido/próximo é projeção de consulta. Não usar um CHECK dependente de “hoje” para persistir status que envelhece sem nova escrita.

## 3. Lista completa de entidades propostas

O catálogo contém 39 entidades: cadastros, vínculos, movimentos e históricos. E35 é alternativa condicionada à decisão sobre agenda, não criação obrigatória. E39 formaliza o vínculo documental com imóveis aprovado durante a integração das telas patrimoniais. S nas demais identifica extração/normalização de informações existentes ou suporte técnico proposto.

| ID | Entidade | Classe | Origem/condição |
| --- | --- | --- | --- |
| E01 | usuarios | Cadastro | S: identidade real para login/autoria; D02 |
| E02 | carteiras | Cadastro | E |
| E03 | imoveis | Cadastro | E |
| E04 | unidades | Cadastro | E; ocupação D03 |
| E05 | imobiliarias | Cadastro | E |
| E06 | locatarios | Cadastro | E |
| E07 | fornecedores | Cadastro compartilhado | S/D08: extrai nomes hoje soltos |
| E08 | profissionais | Cadastro | S/D11: identifica responsáveis/equipe |
| E09 | categorias_despesa | Domínio cadastral | S: categorias usadas nos formulários/filtros |
| E10 | contas_financeiras | Cadastro | S/D12: substitui nomes livres de conta |
| E11 | contratos | Registro contratual | E; ciclo de vida S/D04 |
| E12 | contrato_unidades | Associativa N:N | E: lista de unidades do contrato |
| E13 | contrato_encargos | Regra contratual | E: encargos; fonte de valor D05 |
| E14 | cobrancas | Transacional | E; unicidade D06 |
| E15 | cobranca_itens | Composição transacional | E |
| E16 | recebimentos | Movimento | E; reversão S/D09 |
| E17 | recebimento_alocacoes | Associativa com valor | E; destino de acordo S/D07 |
| E18 | negociacoes | Histórico contratual financeiro | E; versões S/D07 |
| E19 | negociacao_parcelas | Composição histórica | E; entrada como parcela S/D07 |
| E20 | despesas | Obrigação a pagar | E + unificação S/D08 |
| E21 | pagamentos_despesa | Movimento | E em fornecedores; generalização S/D08 |
| E22 | obras | Registro operacional | E |
| E23 | obra_atividades | Operacional | E |
| E24 | obra_alocacoes_equipe | Associativa com período/custo | E |
| E25 | obra_equipe_atividades | Associativa N:N | E no mock; manutenção não existe na tela |
| E26 | obra_contratacoes | Especialização 1:1 de despesa | S/D08: normaliza WorkSupplier |
| E27 | socios | Cadastro | S/D13: identidade compartilhável |
| E28 | obra_socios | Associativa temporal N:N | E para vínculo; histórico S/D13 |
| E29 | aportes | Solicitação de capital | E |
| E30 | aporte_cotas | Associativa com rateio histórico | E |
| E31 | aporte_pagamentos | Movimento | E |
| E32 | obra_ajustes_caixa | Movimento | E |
| E33 | obra_diario | Histórico operacional | E |
| E34 | obra_pendencias | Operacional com resolução | E; histórico de resolução S/D14 |
| E35 | obra_compromissos | Agenda, condicionada | S/D15: só se compromissos forem eventos independentes |
| E36 | documentos | Metadados/versões de arquivo | S/D16: hoje predominam nomes sem conteúdo |
| E37 | documento_vinculos | Associativa com alvo tipado | S/D16 |
| E38 | auditoria_eventos | Histórico técnico | S: autoria/mudanças necessárias para rastreabilidade |
| E39 | documento_imovel_vinculos | Associativa documento–imóvel por tópico | Integração aprovada das telas de imóveis |
| E40 | usuario_permissoes | Associativa de autorização | Fase 4: concessões explícitas por usuário |

## 4. Dicionário de entidades por módulo

Cada item abaixo contém finalidade, telas, campos específicos, PK/FKs, relações, integridade e referências às decisões. Os conjuntos comuns P/A/U/I/R definidos na seção 2 são campos efetivos dessas entidades.

### E01 — usuarios

Finalidade: identidade de acesso e autoria. Módulo transversal. Telas: login e identificação no shell; consumida por auditoria/diário. **S/D02:** atualmente só existe um administrador visual.

Campos comuns: P, A, U. O campo de ativação tem padrão específico abaixo.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| nome | VARCHAR(200) | Sim | Não | — | Nome de apresentação |
| email | VARCHAR(254) | Sim | Sim, normalizado | — | Identidade de login; não usar como PK |
| senha_hash | VARCHAR(255) | Condicional | Não | NULL | S: somente se D02 escolher senha local; nunca gravar a senha exibida no mock |
| perfil_codigo | VARCHAR(32) | Para acesso | Não | NULL | S: único código observado é administrador; não conceder esse perfil automaticamente |
| papel_codigo | VARCHAR(20) | Sim | Não | usuario | master ou usuario; fonte de verdade da função estrutural |
| autorizacao_versao | INTEGER | Sim | Não | 1 | Incrementada ao alterar permissões/status para invalidar tokens antigos |
| status | VARCHAR(20) | Sim | Não | pendente | pendente, ativo, rejeitado ou inativo; fonte de verdade do ciclo de acesso |
| ativo | BOOLEAN | Sim | Não | false | Compatibilidade transitória: true somente quando status=ativo; acesso ativo exige perfil |

PK: id. Relações: usuário 1:N registros criados/editados; 1:N diário/auditoria; 1:N permissões recebidas e concedidas. Integridade: e-mail não vazio e único após normalização; papel não pode conter código não suportado; `status=ativo` se e somente se `ativo=true`, e esse estado exige perfil de compatibilidade. Autorreferências de autoria são nulas no bootstrap documentado. Status pendente, rejeitado ou inativo bloqueia novas operações sem apagar autoria. Se autenticação externa for escolhida, substituir `senha_hash` por identificador verificado do provedor; não criar ambos sem necessidade.

### E40 — usuario_permissoes

Finalidade: armazenar as concessões explícitas dos usuários regulares. O papel Master não recebe linhas nesta tabela: sua expansão para o catálogo completo é uma política estrutural auditável no backend.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| usuario_id | UUID | Sim | PK composta | — | FK → usuarios.id, RESTRICT; conta que recebe a permissão |
| permissao_codigo | VARCHAR(100) | Sim | PK composta | — | Código estável recurso:ação validado contra o catálogo do backend |
| concedida_em | TIMESTAMP UTC | Sim | Não | Agora | Instante imutável da concessão |
| concedida_por | UUID | Sim | Não | — | FK → usuarios.id, RESTRICT; deve coincidir com o ator da transação |

PK: (`usuario_id`, `permissao_codigo`). Relações: usuário 1:N concessões recebidas; concedente 1:N concessões realizadas. Integridade: escrita exige contexto de auditoria, concessões são imutáveis (revogar e inserir novamente) e cada inclusão/remoção gera evento de auditoria com chave composta.

### E02 — carteiras

Finalidade: organizar titularidade patrimonial. Telas: Carteiras, filtros de Imóveis/Contratos/Cobranças, dashboard e relatório. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência CAR | Código de negócio |
| nome | VARCHAR(200) | Sim | Não | — | name |
| titular_nome | VARCHAR(200) | Sim | Não | — | holder; não há cadastro de titular separado |
| titular_documento | VARCHAR(32) | Sim | Não | — | document; normalização D18 |
| gestor_descricao | VARCHAR(200) | Não | Não | NULL | manager aceita também equipe/departamento; não presumir FK de usuário |
| descricao | TEXT | Não | Não | NULL | description |
| observacoes | TEXT | Não | Não | NULL | notes |

Relações: carteira 1:N imóveis; demais relações são alcançadas por imóvel/contrato. Sem colunas de contagem. RESTRICT se referenciada; inativar preserva histórico. Transferência de imóvel entre carteiras e titularidade histórica dependem de D17.

### E03 — imoveis

Finalidade: ativo físico. Telas: Imóveis, Unidades, Contratos, Obras, dashboard e relatório. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência IMO | — |
| carteira_id | UUID | Sim | Não | — | FK → carteiras.id |
| nome | VARCHAR(200) | Sim | Não | — | Nome do imóvel |
| endereco | VARCHAR(500) | Sim | Não | — | Campo livre existente; não inferir logradouro/número |
| tipo | VARCHAR(40) | Não | Não | edificio_comercial | Domínio das opções ativas; rótulo separado |
| cep | VARCHAR(16) | Não | Não | NULL | Formato/normalização a validar em D18 |
| cidade | VARCHAR(120) | Não | Não | NULL | — |
| uf | CHAR(2) | Não | Não | NULL | Maiúsculas, se presente |
| imagem_capa_caminho | VARCHAR(512) | Não | Não | NULL | Caminho do asset existente; fallback visual não é dado do imóvel |
| observacoes | TEXT | Não | Não | NULL | — |

Relações: N:1 carteira; 1:N unidades, contratos e obras. RESTRICT; bloquear troca de carteira quando houver contratos emitidos até D17 definir a transferência. Nome pode mudar sem quebrar FKs. Foto futura enviada pelo usuário pertence à estratégia documental D16; a coluna acima representa somente os assets atuais, sem simular upload.

### E04 — unidades

Finalidade: espaço locável. Telas: Unidades, Imóveis, Contratos, dashboard e vínculo opcional de Obra. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência UNI | ID de negócio global |
| imovel_id | UUID | Sim | Não | — | FK → imoveis.id |
| nome | VARCHAR(200) | Sim | Proposto por imóvel | — | D18: UNIQUE(imovel_id, nome normalizado) |
| tipo | VARCHAR(40) | Não | Não | sala_comercial | Opções da interface ativa |
| area_privativa | DECIMAL(12,2) | Sim | Não | — | E: zero é aceito; CHECK >= 0 |
| ocupada_informada | BOOLEAN | Sim | Não | false | E: checkbox independente; política de fonte em D03 |
| observacoes | TEXT | Não | Não | NULL | — |

Relações: N:1 imóvel; N:N contratos por E12; 1:N obras que selecionam esta unidade. `carteira_id` é obtido pelo imóvel. Não mudar imóvel após uso contratual. RESTRICT para dependências. A ocupação não é declarada derivada enquanto o produto permite informá-la sem contrato; D03 pode eliminar a coluna e passar a calculá-la somente por vigência.

### E05 — imobiliarias

Finalidade: parceiro responsável pelo relacionamento locatício. Telas: hub e cadastro de Locatários. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência IMB | — |
| razao_social | VARCHAR(200) | Sim | Não | — | name |
| nome_fantasia | VARCHAR(200) | Não | Não | NULL | tradeName |
| documento | VARCHAR(32) | Sim | Proposto, D18 | — | CNPJ na interface; não PK |
| creci | VARCHAR(40) | Sim | Não | — | Não impor unicidade global sem região/tipo definidos |
| contato_nome | VARCHAR(200) | Sim | Não | — | Não exige novo cadastro de contato |
| telefone | VARCHAR(32) | Não | Não | NULL | — |
| email | VARCHAR(254) | Não | Não | NULL | E-mail de contato compartilhável |

Relação: imobiliária 1:N locatários; `locatarios.imobiliaria_id` opcional. Exclusão RESTRICT quando usada; inativação mantém vínculo. Histórico de troca do parceiro é capturado pela auditoria, sem criar entidade de comissão ou repasse inexistente.

### E06 — locatarios

Finalidade: parte locatária PF/PJ. Telas: Locatários, Contratos, Cobranças e relatório. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência LOC | — |
| tipo_pessoa | VARCHAR(2) | Sim | Não | PJ | CHECK IN(PF,PJ) |
| nome | VARCHAR(200) | Sim | Não | — | Nome/razão social |
| documento | VARCHAR(32) | Sim | Proposto, D18 | — | Unicidade por tipo + representação normalizada |
| nome_fantasia | VARCHAR(200) | Não | Não | NULL | Não exigir PJ silenciosamente; D18 |
| contato_nome | VARCHAR(200) | Não | Não | NULL | — |
| telefone | VARCHAR(32) | Não | Não | NULL | — |
| email | VARCHAR(254) | Não | Não | NULL | Não único |
| imobiliaria_id | UUID | Não | Não | NULL | FK → imobiliarias.id |
| observacoes | TEXT | Não | Não | NULL | — |

Relações: N:1 imobiliária opcional; 1:N contratos; cobranças alcançadas pelo contrato. Não persistir contador de contratos. Inativar não cancela contratos; RESTRICT impede apagar a parte contratual. Nomes/documentos históricos em relatórios são D17.

### E07 — fornecedores

**Sugestão de modelagem D08.** Finalidade: identificar o credor, separando empresa/pessoa da contratação. Telas: Despesas e Fornecedores de Obras. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| nome | VARCHAR(200) | Sim | Não | — | Único dado cadastral de credor confirmado no fluxo |

Relação: fornecedor 1:N despesas, incluindo as de contratação de obra. Não exigir CNPJ, banco, endereço ou inscrição inexistentes no cadastro atual. Não fundir dois credores automaticamente por nome. RESTRICT se usado. O código FOR dos mocks passa para E26, onde seu escopo real é a obra.

### E08 — profissionais

**Sugestão de modelagem D11.** Finalidade: identificar responsáveis e pessoas alocadas sem exigir conta de acesso. Telas: cadastro/detalhe de Obra, Planejamento, Equipe e Diário legado. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| nome | VARCHAR(200) | Sim | Não | — | Nomes atuais de responsáveis/profissionais |

Relações: profissional 1:N obras sob responsabilidade, atividades e alocações. Função, quantidade e tarifa pertencem à alocação, não ao cadastro. Nenhuma FK obrigatória para `usuarios`: ser engenheiro/responsável não prova ter login. Vincular identidade de usuário a profissional é decisão futura, sem tabela adicional nesta proposta.

### E09 — categorias_despesa

Finalidade: padronizar categorias pesquisáveis. Telas: Despesas. **S:** catálogo inicial controlado, sem pressupor tela de administração. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(40) | Sim | Sim | — | Identidade estável do domínio |
| nome | VARCHAR(100) | Sim | Sim, normalizado | — | Categoria legível |

Relação: categoria 1:N despesas. Catálogo mínimo: Condomínio, Manutenção, Seguros, Telecom, Tributos, Utilidades e Outros, considerando formulário e registros existentes. “Serviços profissionais” existe só em constante não utilizada: inclusão depende de D18. Não apagar categoria utilizada, somente inativar. Não classificar automaticamente serviço de obra em categoria que nunca foi informada.

### E10 — contas_financeiras

**Sugestão de modelagem D12.** Finalidade: identificar a conta que recebe/paga, substituindo nomes livres. Telas: recebimento e nova despesa. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| nome | VARCHAR(150) | Sim | Proposto por instalação | — | Banco Operacional, Conta de Recebíveis, Caixa administrativo são nomes atuais |

Relações: conta 1:N recebimentos, pagamentos e preferências de despesa. Não criar bancos/agência/número/saldo inicial sem requisito. Os movimentos de obra não capturam conta atualmente: sua futura obrigatoriedade é D12. Nenhum default seleciona uma conta do mock no banco.

### E11 — contratos

Finalidade: pactuar locação, período e condições geradoras de cobranças. Telas: Contratos, Locatários, Unidades, Cobranças. Campos comuns: P, A, U.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência CTR | — |
| imovel_id | UUID | Sim | Não | — | FK → imoveis.id; um imóvel por contrato é o fluxo atual |
| locatario_id | UUID | Sim | Não | — | FK → locatarios.id |
| inicio | DATE | Sim | Não | — | startIso ou período do mock conferido |
| termino_previsto | DATE | Sim | Não | — | endIso; CHECK >= inicio |
| aluguel_mensal | DECIMAL(15,2) | Sim | Não | — | CHECK >= 0; exigir > 0 é D05 |
| dia_vencimento | SMALLINT | Sim | Não | 10 | CHECK 1..31 |
| indice_reajuste | VARCHAR(40) | Não | Não | IPCA | Texto informado, não cálculo de índice |
| mes_reajuste | SMALLINT | Não | Não | NULL | E: adjustment dos mocks; 1..12; D05 decide derivação exclusiva do início |
| forma_pagamento_prevista | VARCHAR(30) | Não | Não | NULL | Boleto/Pix/transferência; mock tem default invisível, a confirmar |
| observacoes | TEXT | Não | Não | NULL | — |
| estado | VARCHAR(20) | Sim | Não | rascunho | S/D04: rascunho, ativo, encerrado, cancelado |
| encerrado_em | DATE | Se encerrado | Não | NULL | S/D04: término efetivo, independente do previsto |

Relações: contrato N:1 imóvel/locatário; N:N unidades por E12; 1:N encargos e cobranças. Carteira vem do imóvel. Sem lista de unidades nem período formatado em coluna. S: após ativação, imóvel, locatário e unidades ficam imutáveis; correção/aditivo e transferência de carteira dependem de D04/D17. Sem excluir contrato emitido; cancelamento é estado auditado, não cascata financeira.

### E12 — contrato_unidades

Finalidade: vínculo de várias unidades no mesmo contrato. Telas: contrato, cards de unidades/locatários e cobranças. Campos comuns: A. PK composta, sem `id` extra.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| contrato_id | UUID | Sim | Com unidade_id | — | PK/FK → contratos.id |
| unidade_id | UUID | Sim | Com contrato_id | — | PK/FK → unidades.id |

Relação N:N ao longo do tempo. PK(contrato_id, unidade_id) evita repetição. Todas as unidades devem pertencer ao imóvel do contrato; essa igualdade entre tabelas exige garantia transacional/trigger. A exclusividade de contratos simultâneos é D03, não um UNIQUE simples em unidade_id. Remover vínculo somente em rascunho e sem dependentes; demais casos RESTRICT.

### E13 — contrato_encargos

Finalidade: transformar a lista de encargos em regras identificáveis de geração. Telas: Contrato e Nova cobrança. Campos comuns: P, A, U.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| contrato_id | UUID | Sim | Não | — | FK → contratos.id |
| ordem | SMALLINT | Sim | Por contrato | — | CHECK > 0 |
| nome | VARCHAR(100) | Sim | Não | — | Aluguel, IPTU, Condomínio, Água etc. |
| natureza | VARCHAR(20) | Sim | Não | — | S: aluguel ou encargo; evita relatório dependente da grafia |
| valor_base | DECIMAL(15,2) | Não | Não | NULL | S/D05: só valor conhecido de encargo; aluguel vem do contrato |

Relações: contrato 1:N encargos; encargo 1:N itens emitidos. UNIQUE(contrato_id, ordem); valor não negativo se preenchido; natureza aluguel exige valor_base nulo para não duplicar aluguel. Propõe-se no máximo uma regra de aluguel por contrato, D05. NULL significa que o valor ainda precisa ser definido antes de gerar a cobrança; não buscar preço em um array mock. Responsabilidade, recorrência e comprovante obrigatório existem em tipo inativo, detalhados como extensão pendente na seção 11.

### E14 — cobrancas

Finalidade: obrigação de recebimento de um contrato/competência. Telas: Cobranças, detalhe, recebimentos, negociações, relatório e dashboard. Campos comuns: P, A. Emissão permanente; não recebe U por padrão.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência COB | — |
| contrato_id | UUID | Sim | Com competencia, proposto | — | FK → contratos.id |
| competencia | DATE | Sim | Com contrato_id, proposto | — | CHECK dia = 1; D06 |
| forma_pagamento_prevista | VARCHAR(30) | Não | Não | boleto | Preferência, não comprova recebimento |
| observacoes | TEXT | Não | Não | NULL | — |

Relações: N:1 contrato; 1:N itens, recebimentos e negociações históricas. Unidade, imóvel, carteira e locatário são obtidos via contrato; não copiados como FKs/textos independentes. Proposta D06: uma cobrança normal por contrato/competência; complementos, cancelamento e reemissão exigem rever essa unicidade antes do DDL. Total/recebido/status de quitação/vencimento são derivados. Não apagar cobrança com itens emitidos ou movimentos.

### E15 — cobranca_itens

Finalidade: valores exigidos e vencimentos individuais. Telas: composição, alocação e relatório. Campos comuns: P, A.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| cobranca_id | UUID | Sim | Não | — | FK → cobrancas.id |
| contrato_encargo_id | UUID | Não | Não | NULL | FK → contrato_encargos.id; origem conhecida, não inventada |
| ordem | SMALLINT | Sim | Por cobrança | — | CHECK > 0; ordem estável independente do índice do frontend |
| nome_emissao | VARCHAR(100) | Sim | Não | — | E: nome histórico do item |
| natureza | VARCHAR(20) | Sim | Não | — | S: aluguel/encargo, congelada na emissão |
| vencimento | DATE | Sim | Não | — | Data por item; mocks têm datas diferentes no mesmo contrato |
| valor | DECIMAL(15,2) | Sim | Não | — | E: valor pode ser zero; CHECK >= 0; política D05 |
| referencia | VARCHAR(250) | Não | Não | NULL | Campo hoje vazio |

Relações: cobrança 1:N itens; item 1:N alocações. UNIQUE(cobranca_id, ordem). Regra de origem, se presente, deve ser do contrato da cobrança. Nome, natureza, valor e vencimento emitidos são snapshots legítimos, não atualizações automáticas quando o contrato muda. Recebido/saldo não são colunas. Itens referenciados não podem ser apagados/reordenados para alterar sua identidade.

### E16 — recebimentos

Finalidade: registrar dinheiro recebido para uma cobrança. Telas: baixa, saldos e dashboard. Campos comuns: P, A, R.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência REC | — |
| cobranca_id | UUID | Sim | Não | — | FK → cobrancas.id; um recebimento não atende várias cobranças no fluxo atual |
| data_recebimento | DATE | Sim | Não | — | Data de negócio informada |
| valor | DECIMAL(15,2) | Sim | Não | — | CHECK > 0 |
| forma_pagamento | VARCHAR(30) | Não | Não | NULL | Pix, transferencia, boleto; default de UI não é confirmação bancária |
| conta_financeira_id | UUID | Não, D12 | Não | NULL | FK → contas_financeiras.id |
| referencia | VARCHAR(250) | Não | Não | NULL | Referência/observação curta atual |

Relações: N:1 cobrança/conta; 1:N alocações; 0:1 estorno integral. Data de crédito hoje é sempre igual à de recebimento: não criar segunda coluna até D12 aprovar datas independentes. Desconto/juros de recebimento estão sempre em zero e não integram esta primeira entidade. S: valor da baixa deve ser totalmente alocado na mesma transação. Proibição de superar saldo e reversões estão nas seções 6–7.

### E17 — recebimento_alocacoes

Finalidade: associar valor recebido a um item original OU a uma parcela de acordo. Telas: prévia/baixa, composição e saldo. Campos comuns: P, A. O destino de acordo é **S/D07** para solucionar a divergência atual entre juros/descontos e itens originais.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| recebimento_id | UUID | Sim | Por destino | — | FK → recebimentos.id |
| cobranca_item_id | UUID | Condicional | Por recebimento | NULL | FK → cobranca_itens.id |
| negociacao_parcela_id | UUID | Condicional | Por recebimento | NULL | FK → negociacao_parcelas.id |
| valor | DECIMAL(15,2) | Sim | Não | — | CHECK > 0 |

CHECK exatamente um dos dois destinos preenchido. UNIQUE(recebimento_id, cobranca_item_id) quando item não nulo; equivalente para parcela. O alvo deve pertencer à cobrança do recebimento. A soma das alocações deve ser exatamente o valor recebido; alvo não pode receber mais que seu saldo. Não criar `entidade_tipo/entidade_id` sem FK. A mesma parcela pode receber vários recebimentos; um recebimento pode repartir valor por vários itens/parcelas da mesma cobrança.

### E18 — negociacoes

Finalidade: preservar os termos de cada acordo financeiro. Telas: Negociar saldo e resumo de acordo. Campos comuns: P, A; termos são imutáveis após assinatura/registro. Substituição encerra vigência sem apagar a versão anterior (**S/D07**).

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| cobranca_id | UUID | Sim | Com versao | — | FK → cobrancas.id |
| versao | INTEGER | Sim | Por cobrança | Próxima versão | CHECK > 0; geração sob bloqueio |
| negociacao_anterior_id | UUID | Não | Sim se preenchido | NULL | FK → negociacoes.id; cadeia sem bifurcação |
| saldo_base | DECIMAL(15,2) | Sim | Não | — | Snapshot do saldo na contratação; > 0 |
| desconto | DECIMAL(15,2) | Sim | Não | 0 | 0 <= desconto <= saldo_base |
| acrescimo | DECIMAL(15,2) | Sim | Não | 0 | >= 0 |
| entrada_prevista | DECIMAL(15,2) | Sim | Não | 0 | >= 0 e < total negociado |
| quantidade_parcelas | SMALLINT | Sim | Não | 3 | 1..24, sem contar a entrada |
| primeiro_vencimento | DATE | Sim | Não | — | Data do primeiro pagamento parcelado |
| data_acordo | DATE | Sim | Não | — | Data real do acordo, distinta de created_at |
| motivo | VARCHAR(40) | Sim | Não | inadimplencia_temporaria | Quatro opções atuais normalizadas |
| forma_pagamento_prevista | VARCHAR(30) | Não | Não | boleto | Valor atualmente fixo |
| substituida_em | TIMESTAMP UTC | Não | Não | NULL | S: encerra a versão governante sem apagar histórico |

Relações: cobrança 1:N negociações históricas, no máximo uma não substituída; negociação 1:N parcelas; autorelação anterior/sucessora 1:0..1. UNIQUE(cobranca_id, versao) e unicidade condicionada de cobranca_id onde substituida_em é nula. A sucessora deve pertencer à mesma cobrança; sem ciclos. `total_negociado = saldo_base - desconto + acrescimo`; não armazenar esse total ou `financiado` duplicadamente. Não usar `priorReceiptAmount` como saldo cache: recebimentos apontam explicitamente ao acordo/item. Estorno anterior que altere a base de um acordo é bloqueado até tratamento da cadeia, D09.

### E19 — negociacao_parcelas

Finalidade: agenda imutável de obrigações do acordo. Telas: prévia de parcelas e saldo do acordo. Campos comuns: P, A.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| negociacao_id | UUID | Sim | Com numero | — | FK → negociacoes.id |
| numero | SMALLINT | Sim | Por negociação | — | 0 = entrada; 1..24 = parcelas, S/D07 |
| vencimento | DATE | Sim | Não | — | Para entrada, data precisa ser definida em D07 |
| valor | DECIMAL(15,2) | Sim | Não | — | CHECK > 0; não gerar parcela de valor zero |

Relações: N:1 negociação; 1:N alocações. UNIQUE(negociacao_id, numero). Criar número 0 apenas se entrada_prevista > 0. Soma das parcelas 1..N = total negociado - entrada; soma com número 0 = total negociado. Quantidade deve permitir pelo menos um centavo em cada parcela; essa proteção é S pois o helper atual permite parcelas zero com valores muito pequenos. Datas mensais mantêm o dia original, limitado ao último dia do mês. Entrada prevista não é entrada recebida.

### E20 — despesas

Finalidade: obrigação a pagar a um fornecedor. Telas: Despesas; Fornecedores/Financeiro da obra mediante **Sugestão de modelagem D08**. Campos comuns: P, A, U; alterações materiais são bloqueadas após pagamento.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Para operação | Sim se preenchido | Sequência PAG para operação | Contratação de obra tem seu próprio código local em E26 |
| fornecedor_id | UUID | Sim | Não | — | FK → fornecedores.id |
| origem | VARCHAR(25) | Sim | Não | operacao | CHECK operacao/contratacao_obra; S/D08 |
| categoria_id | UUID | Se origem operacao | Não | NULL | FK → categorias_despesa.id; obra não informa categoria atualmente |
| descricao | VARCHAR(500) | Sim | Não | — | Descrição da despesa ou objeto contratado da obra |
| valor | DECIMAL(15,2) | Sim | Não | — | >= 0 em operação; > 0 em contratação de obra |
| vencimento | DATE | Sim | Não | — | Substitui dueIso/dueDate |
| forma_pagamento_prevista | VARCHAR(30) | Não | Não | NULL | Preferência informada ao cadastrar |
| conta_financeira_prevista_id | UUID | Não | Não | NULL | FK → contas_financeiras.id |
| observacoes | TEXT | Não | Não | NULL | Observações de despesa/contratação |

Relações: N:1 fornecedor/categoria/conta; 1:N pagamentos; 1:0..1 especialização obra_contratacoes. CHECK: operação exige categoria e código; contratação exige valor positivo. Consistência obrigatória entre origem e existência da especialização garantida na transação/trigger, não por um CHECK local isolado. Nenhum `pago`, `data_pagamento` ou `saldo` cache. S: não reduzir valor abaixo do liquidado; primeira versão bloqueia alterações monetárias após qualquer movimento. Exclusão de transação emitida é bloqueada; correções dependem de D09.

**Limite de D08:** esta proposta representa uma contratação atual de obra como uma obrigação com um vencimento e vários pagamentos, exatamente o formato encontrado. Contrato de fornecedor com várias faturas/medições exigiria separar contratação de despesa em 1:N, antes de implementar. Não simular faturas ou parcelamento que a tela não coleta.

### E21 — pagamentos_despesa

Finalidade: cada pagamento efetivamente registrado contra uma despesa/contratação. Telas: baixa de Despesas, pagamento de fornecedor e financeiro da obra. Campos comuns: P, A, R.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| despesa_id | UUID | Sim | Não | — | FK → despesas.id |
| codigo | VARCHAR(32) | Não | Por despesa, se presente | NULL | Preserva PAG-FOR local, quando houver |
| data_pagamento | DATE | Sim | Não | — | Data efetiva informada; nunca default fixo de agosto |
| valor | DECIMAL(15,2) | Sim | Não | — | CHECK > 0 |
| forma_pagamento | VARCHAR(30) | Não, D12 | Não | NULL | Não confundir com a forma prevista da despesa |
| conta_financeira_id | UUID | Não, D12 | Não | NULL | FK → contas_financeiras.id |
| observacoes | TEXT | Não | Não | NULL | note de pagamento de fornecedor |

Relações: pagamento N:1 despesa; documento pode ser vinculado por E37. Vários pagamentos por despesa suportam a parcialidade já existente em fornecedores. Para Despesas de Locações, a ação atual pode continuar quitando o saldo inteiro; habilitar parcialidade na tela é D08. Um pagamento não quita várias despesas nesta proposta. Baixa e estorno são transações auditáveis, sem apagar datas anteriores. UNIQUE(despesa_id, codigo) quando código presente.

### E22 — obras

Finalidade: raiz operacional da intervenção. Telas: Painel, Todas as obras, cadastro/edição e todas as abas de detalhe. Campos comuns: P, A, U.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| codigo | VARCHAR(32) | Sim | Sim | Sequência OBR | — |
| titulo | VARCHAR(200) | Sim | Não | — | title |
| imovel_id | UUID | Sim | Não | — | FK → imoveis.id |
| unidade_id | UUID | Não | Não | NULL | FK → unidades.id; substituir texto livre é S/D11 |
| responsavel_profissional_id | UUID | Sim | Não | — | FK → profissionais.id; não pressupõe usuário |
| tipo_intervencao | VARCHAR(25) | Sim | Não | obra | obra/reforma/reparo/manutencao/emergencia |
| descricao | TEXT | Sim para novos | Não | — | Mocks antigos não contêm descrição: não inventar na migração |
| prioridade | VARCHAR(15) | Sim | Não | media | baixa/media/alta/urgente |
| estado | VARCHAR(20) | Sim | Não | planejada | planejada/em_andamento/pausada/concluida/cancelada |
| risco_informado | VARCHAR(20) | Sim | Não | dentro_prazo | dentro_prazo/atencao/em_atraso; concluída é projeção do estado |
| progresso_percentual | DECIMAL(5,2) | Sim | Não | 0 | 0..100; E: manual ou atualizado ao concluir atividade |
| inicio_previsto | DATE | Sim | Não | — | — |
| termino_previsto | DATE | Sim | Não | — | S: CHECK >= inicio_previsto |
| orcamento | DECIMAL(15,2) | Sim | Não | 0 | >= 0 |
| reserva | DECIMAL(15,2) | Sim | Não | 0 | >= 0; não é movimentação de caixa |
| realizado_informado | DECIMAL(15,2) | Sim | Não | 0 | E: valor manual independente; fonte definitiva D10 |
| proxima_atividade_descricao | VARCHAR(500) | Não | Não | NULL | E: texto manual atual, não presumir ID de atividade |
| observacoes | TEXT | Não | Não | NULL | — |

Relações: N:1 imóvel, unidade opcional e responsável; 1:N atividades, alocações, contratações, participações, aportes, ajustes, diário e pendências. Unidade deve pertencer ao imóvel. CHECK estado concluida implica progresso=100; inverso não obrigatório, pois a interface admite 100 sem concluir. Risco de prazo calculado deve ser separado de risco informado, D10. Saldo projetado não é coluna. Excluir fisicamente é vedado após qualquer subregistro histórico/financeiro; cancelamento não apaga as obrigações.

### E23 — obra_atividades

Finalidade: cronograma executável e seus bloqueios. Telas: Planejamento, Resumo e Diário. Campos comuns: P, A, U.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência ATV local | — |
| etapa | VARCHAR(20) | Sim | Não | execucao | preparacao/execucao/entrega |
| titulo | VARCHAR(200) | Sim | Não | — | — |
| responsavel_profissional_id | UUID | Sim | Não | — | FK → profissionais.id; S para substituir nome livre |
| inicio | DATE | Sim | Não | — | — |
| termino | DATE | Sim | Não | — | CHECK termino >= inicio |
| estado | VARCHAR(20) | Sim | Não | nao_iniciada | nao_iniciada/em_andamento/bloqueada/concluida |
| motivo_bloqueio | TEXT | Se bloqueada | Não | NULL | CHECK condicional |

Relações: N:1 obra/profissional; N:N alocações via E25. UNIQUE(obra_id, codigo). Motivo ao sair do bloqueio permanece em auditoria/diário, mesmo removido do estado atual. Reprogramação registra antes/depois e justificativa; não criar dependência entre atividades sem requisito. Prazo dentro da obra é D11: não impor essa restrição silenciosamente aos mocks inconsistentes.

### E24 — obra_alocacoes_equipe

Finalidade: vínculo de profissional à obra, com função, período e custo previsto. Telas: Equipe, Resumo e Financeiro. Campos comuns: P, A, U.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| profissional_id | UUID | Sim | Não | — | FK → profissionais.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência EQP local | — |
| funcao | VARCHAR(150) | Sim | Não | — | role da alocação |
| inicio | DATE | Sim | Não | — | Hoje herda a data da obra |
| termino | DATE | Sim | Não | — | CHECK >= inicio |
| modalidade | VARCHAR(10) | Sim | Não | horas | horas/diarias |
| quantidade | DECIMAL(12,2) | Sim | Não | 1 | > 0; múltiplo de 0,5 é somente sugestão de UI, D11 |
| valor_unitario | DECIMAL(15,2) | Sim | Não | 0 | >= 0; zero é permitido no código |
| removida_em | TIMESTAMP UTC | Não | Não | NULL | S: remoção lógica para preservar custo/vínculo anterior |

Relações: N:1 obra e profissional; N:N atividades. UNIQUE(obra_id, codigo). Não impor UNIQUE(obra_id, profissional_id): o mesmo profissional pode ter funções/períodos distintos, e os mocks podem repetir o responsável. Custo é quantidade × tarifa, não coluna armazenada. Remoção é auditada; não gera pagamento nem despesa automaticamente.

### E25 — obra_equipe_atividades

Finalidade: substituir o array `activityIds` por vínculos íntegros. Telas: contexto de Equipe/Planejamento, ainda sem manutenção ativa. Campos comuns: A. PK composta.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| alocacao_id | UUID | Sim | Com atividade_id | — | PK/FK → obra_alocacoes_equipe.id |
| atividade_id | UUID | Sim | Com alocacao_id | — | PK/FK → obra_atividades.id |

Relação N:N. Os dois alvos devem pertencer à mesma obra. PK elimina duplicidade; verificação da obra requer transação/trigger. Remoção de associação antes de uso é física e auditada; os alvos ficam preservados. Não existe tabela adicional de etapas, pois são três valores fixos sem atributos próprios.

### E26 — obra_contratacoes

**Sugestão de modelagem D08.** Finalidade: atributos de obra de uma obrigação a fornecedor. Telas: Fornecedores, resumo e financeiro de Obra. Campos comuns: nenhum; identidade e autoria herdadas de despesas pela relação 1:1.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| despesa_id | UUID | Sim | PK | ID da despesa base | PK/FK → despesas.id |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência FOR local | Código que hoje parece ser do fornecedor |
| tipo_fornecimento | VARCHAR(15) | Sim | Não | servico | servico/produto/material |
| data_contratacao | DATE | Sim | Não | — | contractDateIso |

Relações: despesa 1:0..1 contratação; obra 1:N contratações; obra N:N fornecedores por despesas/contratações, permitindo mais de uma contratação do mesmo credor. Nome vem de fornecedor; objeto, valor contratado, vencimento e observações vêm de despesas; pago/histórico vêm de pagamentos_despesa. Não duplicar esses campos. UNIQUE(obra_id, codigo). Especialização criada junto à despesa em transação, sem cascata para pagamentos. Se D08 exigir várias faturas por contratação, este 1:1 deve ser substituído antes da implementação.

### E27 — socios

**Sugestão de modelagem D13.** Finalidade: identificar a pessoa/empresa participante em diferentes obras. Telas: Sócios. Campos comuns: P, A, U, I.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| nome | VARCHAR(200) | Sim | Não | — | Único atributo de pessoa/empresa confirmado |

Relação: N:N obras por participações temporais E28. Não exigir CPF/CNPJ nem fundir com locatário/usuário pelo nome. O código SOC mockado é local à obra; sua migração usa contexto de obra, não unicidade global. D13 decide cadastro global e identificação suficiente para reconhecer o mesmo sócio; até isso ser validado não há deduplicação automática.

### E28 — obra_socios

Finalidade: participação de um sócio em uma obra durante uma vigência. Telas: Sócios e rateio de Aportes. **E:** vínculo/percentual; **S/D13:** versões temporais. Campos comuns: P, A; percentual de versão utilizada é imutável.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Com socio_id e inicio_vigencia | — | FK → obras.id |
| socio_id | UUID | Sim | Com obra_id e inicio_vigencia | — | FK → socios.id |
| percentual | DECIMAL(5,2) | Sim | Não | — | CHECK > 0 AND <= 100 |
| inicio_vigencia | TIMESTAMP UTC | Sim | Por obra/sócio | Instante da inclusão | S: não inventar início histórico na carga dos mocks |
| fim_vigencia | TIMESTAMP UTC | Não | Não | NULL | S: intervalo [início, fim); fim > início |

Relação N:N com atributo de participação. UNIQUE(obra_id, socio_id, inicio_vigencia), unicidade por obra/sócio onde fim_vigencia é nulo e proteção contra sobreposição de intervalos fechados. Soma corrente pode ser menor que 100 enquanto se cadastra; não pode superar 100. Aporte exige soma exatamente 100,00. Mudança de percentual encerra versão e cria outra em transação; cotas antigas continuam apontando à versão original. Remoção física de versão referenciada por cota é RESTRICT. Encerrar participação com aportes pendentes e reentrada são D13, não permissões automáticas.

### E29 — aportes

Finalidade: solicitação de capital a ser rateada entre os sócios. Telas: Sócios/Aportes, Financeiro e Diário. Campos comuns: P, A.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência APT local | — |
| data_solicitacao | DATE | Sim | Não | — | DateIso, sem default histórico |
| descricao | VARCHAR(500) | Sim | Não | — | — |
| valor_solicitado | DECIMAL(15,2) | Sim | Não | — | CHECK > 0 |

Relações: obra 1:N aportes; aporte 1:N cotas. UNIQUE(obra_id, codigo). Solicitação não é entrada de caixa. Criação exige participações completas e gera todas as cotas numa transação. Imutável após emissão; correções/cancelamento de solicitação são D13. Na primeira versão, ratear pelas participações correntes no instante de criação; permitir competência societária retroativa exige decisão explícita.

### E30 — aporte_cotas

Finalidade: obrigação de cada participação no aporte e seu valor arredondado pactuado. Telas: pagamento de sócio, resumos por sócio/aporte. Campos comuns: P, A.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| aporte_id | UUID | Sim | Com obra_socio_id | — | FK → aportes.id |
| obra_socio_id | UUID | Sim | Com aporte_id | — | FK → obra_socios.id, versão histórica da participação |
| ordem_rateio | SMALLINT | Sim | Por aporte | — | > 0; estabiliza quem recebe ajuste residual |
| nome_socio_pactuado | VARCHAR(200) | Sim | Não | Nome na emissão | E: partnerName no snapshot atual; histórico de nomes D17 |
| valor_devido | DECIMAL(15,2) | Sim | Não | — | >= 0; uma cota pode arredondar a zero em aporte muito pequeno |

Relação N:N aportes/participações com atributos próprios. UNIQUE(aporte_id, obra_socio_id) e UNIQUE(aporte_id, ordem_rateio); todos da mesma obra; no máximo uma versão do mesmo sócio por aporte, verificação transacional. Percentual é obtido da versão imutável E28, não de uma coluna corrente no sócio. Soma de cotas = valor solicitado. Valor devido é snapshot contratual arredondado e deve ser armazenado. Pago/saldo não são colunas.

### E31 — aporte_pagamentos

Finalidade: integralização efetiva, parcial ou total, de uma cota. Telas: pagamento de sócio, Sócios e Financeiro. Campos comuns: P, A, R.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| cota_id | UUID | Sim | Não | — | FK → aporte_cotas.id |
| codigo | VARCHAR(32) | Não | Por obra na origem | NULL | PAG-APT dos mocks; integridade de escopo na seção 7 |
| data_pagamento | DATE | Sim | Não | — | — |
| valor | DECIMAL(15,2) | Sim | Não | — | CHECK > 0 |
| observacoes | TEXT | Não | Não | NULL | note |

Relações: cota 1:N pagamentos; pagamento 0:1 estorno. Não repetir obra, sócio, aporte, nome ou participação: obtidos pelas FKs. Proibir soma líquida acima da cota. “Lançamento de aporte” do financeiro será projeção desta mesma linha, não uma segunda tabela gravada com o mesmo dinheiro. Código local não substitui PK; pode ser gerado de forma única por obra mediante bloqueio, mas essa unicidade que atravessa FKs não é um UNIQUE local. Conta financeira não é capturada hoje; adição é D12, não dado confirmado.

### E32 — obra_ajustes_caixa

Finalidade: ajuste manual assinado já oferecido na aba Financeiro. Telas: Financeiro e Diário. Campos comuns: P, A, R.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Não | Por obra se presente | NULL | FIN de ajuste; IDs de projeções de aporte não competem com este código |
| data_movimento | DATE | Sim | Não | — | — |
| descricao | VARCHAR(500) | Sim | Não | — | Justificativa do ajuste |
| valor_assinado | DECIMAL(15,2) | Sim | Não | — | CHECK <> 0; positivo entra, negativo sai |

Relação: obra 1:N ajustes. Texto fixo “Caixa administrativo” é rótulo da operação, não prova de uma conta bancária; não criar FK por inferência. Estorno aponta para original da mesma obra, com valor exatamente oposto. Ajuste não é custo de fornecedor nem alteração do orçamento. Fechamento de caixa e saldo inicial são D10.

### E33 — obra_diario

Finalidade: histórico legível do que ocorreu na obra. Telas: Diário, arquivos recentes e ações que escrevem no diário. Campos comuns: P, A; não U, registros já publicados são preservados.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência DIA local | — |
| tipo | VARCHAR(20) | Sim | Não | atualizacao | atualizacao/ocorrencia/pendencia/arquivo |
| titulo | VARCHAR(200) | Sim | Não | — | — |
| descricao | TEXT | Sim | Não | — | — |
| ocorrido_em | TIMESTAMP UTC | Sim para novos | Não | Instante da ação | Data real do evento; timezone dos mocks requer D19 |
| autor_usuario_id | UUID | Para novas ações humanas | Não | Usuário da sessão | FK → usuarios.id; S para autoria correta |
| autor_legado_nome | VARCHAR(200) | Só em legado sem identidade | Não | NULL | Preserva o autor textual sem fingir que é um usuário identificado |
| progresso_registrado | DECIMAL(5,2) | Não | Não | NULL | E: snapshot 0..100 |
| auditoria_evento_id | UUID | Não | Por obra/evento se presente | NULL | FK → auditoria_eventos.id; S para associar evento automático sem duplicar |

Relações: obra 1:N registros; usuário 1:N registros; N:N documentos via E37. CHECK exige ao menos autor_usuario_id, autor_legado_nome ou auditoria_evento_id. Para ações humanas novas, exigir autor_usuario_id; autor_legado_nome atende somente importação sem identidade conhecida. Se ambos estiverem ausentes, a transação deve verificar que auditoria_evento_id identifica um evento automático com contexto de sistema, sem usar o responsável da obra como se fosse executor. Essa classificação depende da linha de auditoria e não é um CHECK local. UNIQUE(obra_id, auditoria_evento_id) quando preenchido. Retificações são novas entradas, não sobrescrita; não apagar registros usados por arquivos/auditoria.

### E34 — obra_pendencias

Finalidade: decisões/pendências que podem ser resolvidas individualmente. Telas: Resumo e contadores da obra. Campos comuns: P, A, U. **S/D14:** preservar resolução em vez de remover linha.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência PEN local | — |
| titulo | VARCHAR(200) | Sim | Não | — | — |
| descricao | TEXT | Sim | Não | — | — |
| severidade | VARCHAR(15) | Sim | Não | informativa | informativa/atencao/critica; substitui tom CSS |
| resolvida_em | TIMESTAMP UTC | Não | Não | NULL | NULL = aberta; não precisa de status duplicado |
| resolvida_por | UUID | Se resolvida | Não | NULL | FK → usuarios.id |

Relação: obra 1:N pendências. UNIQUE(obra_id, codigo), campos de resolução ambos nulos ou ambos preenchidos. Alertas de vencimento calculados não são automaticamente uma nova pendência armazenada: D14 define quando o usuário deve poder reconhecer/tratar um alerta. Não adicionar FKs opcionais para toda possível causa sem conhecer esse fluxo.

### E35 — obra_compromissos — alternativa condicionada

**Sugestão de modelagem D15.** Finalidade: preservar compromissos independentes do cronograma se essa interpretação for aprovada. Tela: Próximos compromissos no Painel de obras. Hoje são cinco objetos fixos, sem cadastro. Campos comuns: P, A, U.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| obra_id | UUID | Sim | Não | — | FK → obras.id |
| codigo | VARCHAR(32) | Sim | Por obra | Sequência COM local | — |
| data | DATE | Sim | Não | — | dateIso do mock |
| titulo | VARCHAR(200) | Sim | Não | — | — |
| descricao | VARCHAR(500) | Sim | Não | — | Horas hoje podem estar apenas no texto; não extrair como fato confirmado |

Relação: obra 1:N compromissos. UNIQUE(obra_id, codigo). Dia, mês e rótulo de prazo são calculados. Se D15 concluir que são apenas projeções de atividades/pagamentos, eliminar esta entidade inteira e definir essas consultas; não manter agenda e cronograma duplicados para o mesmo evento. Conclusão/cancelamento de compromisso não foram definidos.

### E36 — documentos

**Sugestão de modelagem D16.** Finalidade: metadados de arquivos e referências documentais sem conteúdo. Telas: comprovante de fornecedor e Diário; categorias patrimoniais permanecem extensão pendente. Campos comuns: P, A. Novas versões são novos registros.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| nome_original | VARCHAR(255) | Sim | Não | — | Único dado disponível nos anexos mockados |
| estado | VARCHAR(20) | Sim | Não | referenciado | referenciado/disponivel/retirado |
| mime_type | VARCHAR(127) | Se disponível | Não | NULL | Verificado no upload futuro; não inferir só do nome |
| tamanho_bytes | BIGINT | Se disponível | Não | NULL | CHECK > 0 quando conhecido |
| chave_armazenamento | VARCHAR(512) | Se disponível | Sim se presente | NULL | Chave durável do objeto; não URL assinada temporária |
| hash_sha256 | CHAR(64) | Não | Não | NULL | S: integridade do conteúdo; arquivos iguais podem ter vínculos distintos |
| versao_anterior_id | UUID | Não | Sim se presente | NULL | FK → documentos.id; S: cadeia de substituição, sem ciclos |
| retirado_em | TIMESTAMP UTC | Se retirado | Não | NULL | S: retirada lógica, não descarte automático do arquivo |
| retirado_por | UUID | Se retirado | Não | NULL | FK → usuarios.id |

Relações: documento N:N registros por E37; autorelação de versão 1:0..1 sucessora. Constraints de estado: disponível exige conteúdo/metadados; referenciado não pode fingir upload disponível; retirado exige autor/data. Nome não é único, e nome+tamanho não garante identidade global. Limite atual do utilitário órfão é 10 MB e extensões PDF/DOC/DOCX/XLS/XLSX/JPG/JPEG/PNG; aplicação dessas regras no produto é D16. Não gerar arquivos falsos para os nomes dos mocks.

### E37 — documento_vinculos

Finalidade: relacionar documentos com alvos conhecidos, mantendo FKs reais. Campos comuns: P, A. **S/D16:** estrutura central para os dois fluxos ativos que hoje exibem nomes: despesas/contratações, pagamentos e diário.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| documento_id | UUID | Sim | Por alvo | — | FK → documentos.id |
| despesa_id | UUID | Condicional | Por documento | NULL | FK → despesas.id; inclui contratação de obra |
| pagamento_despesa_id | UUID | Condicional | Por documento | NULL | FK → pagamentos_despesa.id |
| diario_id | UUID | Condicional | Por documento | NULL | FK → obra_diario.id |

CHECK exatamente um alvo não nulo. UNIQUE(documento_id, cada alvo) nos respectivos valores não nulos. A mesma evidência pode constar no pagamento e no diário, sem duplicar conteúdo. Todos ON DELETE RESTRICT; retirar documento mantém referências históricas. Sem associação genérica textual sem FK. Imóveis, unidades, contratos, recibos de locação e acordos não têm upload ativo no Angular: novos alvos e categorias só entram após D16. Se a abrangência crescer muito, preferir tabelas de vínculo específicas em vez de dezenas de colunas opcionais.

### E39 — documento_imovel_vinculos

Finalidade: vincular documentos persistidos aos imóveis sem ampliar a associativa financeira E37 com alvos opcionais. Campos comuns: P, A. Criada durante a integração das telas React de imóveis, nas quais o upload por tópico é funcionalidade ativa.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| documento_id | UUID | Sim | Por imóvel | — | FK → documentos.id |
| imovel_id | UUID | Sim | Por documento | — | FK → imoveis.id |
| topico | VARCHAR(64) | Sim | Não | — | Código estável de `REGISTRY_DOCUMENT_TOPICS` |

UNIQUE(documento_id, imovel_id). Índice `(imovel_id, topico, documento_id)` atende a carga do drawer e do formulário. Todos os relacionamentos usam `RESTRICT`; retirar um documento mantém o vínculo histórico.

### E38 — auditoria_eventos

**Sugestão de modelagem.** Finalidade: registrar alterações, ator, contexto e motivo sem apagar a história. Módulo transversal; não implica uma nova tela de auditoria. Campos comuns: P; abaixo estão todos os demais campos.

| Campo | Tipo sugerido | Obrigatório | Único | Padrão | Observação/FK |
| --- | --- | --- | --- | --- | --- |
| ocorrido_em | TIMESTAMP UTC | Sim | Não | Instante do servidor | — |
| ator_usuario_id | UUID | Para ação humana | Não | NULL | FK → usuarios.id, RESTRICT |
| contexto_ator | VARCHAR(100) | Sem usuário | Não | NULL | Bootstrap, importação identificada ou processo de sistema |
| entidade | VARCHAR(64) | Sim | Não | — | Nome lógico da entidade do evento |
| registro_id | UUID | Para PK simples | Não | NULL | Referência histórica, não FK polimórfica |
| chave_composta | JSON | Para PK composta | Não | NULL | Ex.: contrato_id + unidade_id, estrutura validada |
| operacao | VARCHAR(40) | Sim | Não | — | Inclusão, alteração, inativação, transição, estorno etc. |
| motivo | TEXT | Quando exigido pela ação | Não | NULL | Bloqueio, reprogramação, estorno, retificação |
| antes | JSON | Não | Não | NULL | Somente atributos alterados permitidos |
| depois | JSON | Não | Não | NULL | Resultado/snapshot da alteração |

CHECK exatamente uma identificação de registro simples/composta. Exigir ator ou contexto, nunca omissão silenciosa. Uso de alvo histórico sem FK é intencional aqui: o log deve sobreviver a uma exclusão física autorizada; não deve ser usado como vínculo operacional. Não registrar senha, hash de senha, token ou arquivo binário nos snapshots. Registros são append-only; permissões do banco devem vedar edição/exclusão pelo usuário normal. Diário operacional pode apontar a um evento por FK, mas não substitui este histórico transversal.

## 5. Relacionamentos, associativas e estados

### 5.1 Relações operacionais consolidadas

Cardinalidades abaixo são do pai para o filho. `1:N` permite zero filhos, salvo exigência mínima declarada na integridade. Obrigatoriedade indica se o filho deve conter a FK. Todos os vínculos operacionais usam RESTRICT ao excluir o pai, salvo exceção expressa na seção 8; atualização de UUID é proibida.

| Origem → destino | Relação | FK no destino | Obrigatória | Comportamento |
| --- | --- | --- | --- | --- |
| Carteira → Imóvel | 1:N | imoveis.carteira_id | Sim | Sem lista/contagem de imóveis na carteira |
| Imóvel → Unidade | 1:N | unidades.imovel_id | Sim | Carteira da unidade é derivada |
| Imóvel → Documento_Imóvel | 1:N | documento_imovel_vinculos.imovel_id | Sim | Documentos persistidos e classificados por tópico |
| Documento → Documento_Imóvel | 1:N | documento_imovel_vinculos.documento_id | Sim | Conteúdo único pode manter vínculo tipado com imóvel |
| Imobiliária → Locatário | 1:N | locatarios.imobiliaria_id | Não | “Sem imobiliária” = NULL |
| Imóvel → Contrato | 1:N | contratos.imovel_id | Sim | Um imóvel por contrato |
| Locatário → Contrato | 1:N | contratos.locatario_id | Sim | Parte contratual identificada |
| Contrato → Contrato_Unidade | 1:N | contrato_unidades.contrato_id | Sim | Contrato ativo exige ao menos uma unidade, S/D04 |
| Unidade → Contrato_Unidade | 1:N | contrato_unidades.unidade_id | Sim | N:N histórico entre contrato/unidade |
| Contrato → Encargo | 1:N | contrato_encargos.contrato_id | Sim | Regra pertence a um contrato |
| Contrato → Cobrança | 1:N | cobrancas.contrato_id | Sim | Unicidade por competência proposta D06 |
| Cobrança → Item | 1:N | cobranca_itens.cobranca_id | Sim | Emissão deve conter ao menos um item |
| Encargo → Item | 1:N | cobranca_itens.contrato_encargo_id | Não | Se conhecida, origem é do mesmo contrato |
| Cobrança → Recebimento | 1:N | recebimentos.cobranca_id | Sim | Um recebimento não paga várias cobranças |
| Conta → Recebimento | 1:N | recebimentos.conta_financeira_id | Não, D12 | Não inventar conta para movimentos antigos |
| Recebimento → Alocação | 1:N | recebimento_alocacoes.recebimento_id | Sim | Total alocado = valor recebido |
| Item → Alocação | 1:N | recebimento_alocacoes.cobranca_item_id | XOR | Preenchida apenas no destino original |
| Parcela → Alocação | 1:N | recebimento_alocacoes.negociacao_parcela_id | XOR | Preenchida apenas no destino de acordo |
| Cobrança → Negociação | 1:N histórico | negociacoes.cobranca_id | Sim | Uma versão governante; anteriores preservadas |
| Negociação anterior → sucessora | 1:0..1 | negociacoes.negociacao_anterior_id | Não | Mesma cobrança, sem ciclos, S/D07 |
| Negociação → Parcela | 1:N | negociacao_parcelas.negociacao_id | Sim | Entrada e parcelas somam o pactuado |
| Fornecedor → Despesa | 1:N | despesas.fornecedor_id | Sim | Um credor por obrigação |
| Categoria → Despesa | 1:N | despesas.categoria_id | Condicional | Obrigatória em despesa da operação |
| Conta → Despesa prevista | 1:N | despesas.conta_financeira_prevista_id | Não | Preferência, não movimento |
| Despesa → Pagamento | 1:N | pagamentos_despesa.despesa_id | Sim | Somente pagamentos líquidos afetam saldo |
| Conta → Pagamento | 1:N | pagamentos_despesa.conta_financeira_id | Não, D12 | Conta efetiva pode diferir da prevista |
| Despesa → Contratação de obra | 1:0..1 | obra_contratacoes.despesa_id, também PK | Sim na especialização | Sem duplicar valor/fornecedor/pagamento; D08 |
| Imóvel → Obra | 1:N | obras.imovel_id | Sim | Contexto patrimonial |
| Unidade → Obra | 1:N | obras.unidade_id | Não | Unidade deve pertencer ao imóvel selecionado |
| Profissional → Obra | 1:N | obras.responsavel_profissional_id | Sim | Responsável técnico não é necessariamente usuário |
| Obra → Atividade | 1:N | obra_atividades.obra_id | Sim | Independente da posição no array |
| Profissional → Atividade | 1:N | obra_atividades.responsavel_profissional_id | Sim | Campo livre atual passa a cadastro, D11 |
| Obra → Alocação | 1:N | obra_alocacoes_equipe.obra_id | Sim | Período/função/custo no vínculo |
| Profissional → Alocação | 1:N | obra_alocacoes_equipe.profissional_id | Sim | Pode ter várias alocações |
| Alocação → Equipe_Atividade | 1:N | obra_equipe_atividades.alocacao_id | Sim | Mesma obra do outro alvo |
| Atividade → Equipe_Atividade | 1:N | obra_equipe_atividades.atividade_id | Sim | N:N de atividades/alocações |
| Obra → Contratação | 1:N | obra_contratacoes.obra_id | Sim | Obra N:N fornecedor por contratações |
| Obra → Participação | 1:N | obra_socios.obra_id | Sim | Um conjunto de versões societárias |
| Sócio → Participação | 1:N | obra_socios.socio_id | Sim | N:N sócios/obras, S/D13 |
| Obra → Aporte | 1:N | aportes.obra_id | Sim | Capital solicitado |
| Aporte → Cota | 1:N | aporte_cotas.aporte_id | Sim | Soma exata do aporte |
| Participação histórica → Cota | 1:N | aporte_cotas.obra_socio_id | Sim | Congela versão, não depende do percentual futuro |
| Cota → Pagamento de aporte | 1:N | aporte_pagamentos.cota_id | Sim | Capital efetivamente recebido |
| Obra → Ajuste de caixa | 1:N | obra_ajustes_caixa.obra_id | Sim | Ajuste assinado |
| Obra → Diário | 1:N | obra_diario.obra_id | Sim | Não apaga o diário ao cancelar obra |
| Usuário → Diário | 1:N | obra_diario.autor_usuario_id | Condicional | Ator humano; fallback legado identificado |
| Evento de auditoria → Diário | 1:N | obra_diario.auditoria_evento_id | Não | No máximo uma entrada por evento/obra |
| Obra → Pendência | 1:N | obra_pendencias.obra_id | Sim | Resolução preservada |
| Usuário → Resolução | 1:N | obra_pendencias.resolvida_por | Se resolvida | Autoria da resolução |
| Obra → Compromisso | 1:N | obra_compromissos.obra_id | Sim | Toda a entidade depende de D15 |
| Documento → Vínculo | 1:N | documento_vinculos.documento_id | Sim | Conteúdo pode ser compartilhado |
| Despesa → Vínculo documental | 1:N | documento_vinculos.despesa_id | XOR | Um dos três tipos de alvo |
| Pagamento → Vínculo documental | 1:N | documento_vinculos.pagamento_despesa_id | XOR | Um dos três tipos de alvo |
| Diário → Vínculo documental | 1:N | documento_vinculos.diario_id | XOR | Um dos três tipos de alvo |
| Documento anterior → nova versão | 1:0..1 | documentos.versao_anterior_id | Não | Sem sobrescrever o objeto antigo |
| Usuário → Retirada documental | 1:N | documentos.retirado_por | Se retirado | Vínculos históricos continuam |
| Usuário → Evento de auditoria | 1:N | auditoria_eventos.ator_usuario_id | Condicional | Processo sem humano usa contexto_ator |
| Usuário → autoria/edição | 1:N | created_by/updated_by nos conjuntos A/U | Condicional | Todos os alvos explicitados nos conjuntos comuns |
| Movimento original → estorno | 1:0..1 | estorno_de_id em E16/E21/E31/E32 | Não | FK à mesma tabela, UNIQUE não nulo |

### 5.2 Por que as associativas existem

| Associativa | N:N representado | Atributo do vínculo | PK/controle |
| --- | --- | --- | --- |
| contrato_unidades | Contrato ↔ Unidade | Vínculo contratual, sem valor unitário definido | PK composta |
| recebimento_alocacoes | Recebimento ↔ Item/Parcela | Valor aplicado | UUID + unicidade por destino tipado |
| obra_alocacoes_equipe | Obra ↔ Profissional | Função, período, modalidade, quantidade, tarifa | UUID; múltiplas alocações permitidas |
| obra_equipe_atividades | Alocação ↔ Atividade | Associação operacional | PK composta |
| obra_contratacoes + despesas | Obra ↔ Fornecedor | Objeto, tipo, data, vencimento, obrigação | PK/FK 1:1 da especialização |
| obra_socios | Obra ↔ Sócio | Percentual e intervalo de vigência | UUID por versão |
| aporte_cotas | Aporte ↔ Participação | Ordem e valor devido pactuado | UUID; versão histórica e rateio |
| documento_vinculos | Documento ↔ Registro suportado | Uso do documento | UUID + XOR de FKs |

### 5.3 Estados armazenados e calculados

Estados fixos usam códigos VARCHAR com CHECK, evitando um ENUM físico dependente de fornecedor e uma tabela para cada conjunto de poucas opções. Categorias/contas são cadastros pois têm identidade, relações e podem ser inativadas.

| Entidade/conceito | Valores sugeridos | Persistência | Fonte e limite |
| --- | --- | --- | --- |
| Cadastros com conjunto I | ativo/inativo | BOOLEAN ativo | S: inativação em vez de apagar |
| Contrato | rascunho, ativo, encerrado, cancelado | contratos.estado | S/D04; hoje só há rótulo Ativo |
| Quitação de cobrança/despesa/cota/parcela | pendente, parcial, quitado | Calculada | E: nomes atuais variam; normalização S |
| Prazo | vencido, hoje, proximo, futuro | Calculado por data/saldo | Janela de 7 dias existe em Locações; não presumir mesma janela na agenda |
| Acordo vigente | vigente/substituido | Derivado de substituida_em | S/D07; quitação calculada separadamente |
| Obra | planejada, em_andamento, pausada, concluida, cancelada | obras.estado | E; limites de transição S/D04 |
| Risco informado | dentro_prazo, atencao, em_atraso | obras.risco_informado | E; concluída é estado, não risco independente |
| Atividade | nao_iniciada, em_andamento, bloqueada, concluida | obra_atividades.estado | E |
| Pendência | aberta/resolvida | Derivada de resolvida_em | S: não duplicar timestamp + booleano + estado |
| Documento | referenciado, disponivel, retirado | documentos.estado | S/D16 |
| Movimento | original/estorno | Derivada de estorno_de_id | S/D09; efetivo líquido é consulta |
| Compromisso | atrasado, hoje, proximo | Calculado | Regra de conclusão ainda não existe; D15 |

O frontend pode continuar mostrando “Recebida”, “Pago” e “Quitado” conforme o gênero/entidade. A regra interna de quitação é a mesma. Atraso e parcialidade são dimensões diferentes: pagamento parcial não deve apagar a informação de vencimento. Uma cobrança pode estar negociada, parcialmente liquidada e com uma parcela vencida ao mesmo tempo; não comprimir todas as informações num único enum.

### 5.4 Transições e comandos

| Entidade | Comportamento atual | Proposta de transição/garantia | Situação |
| --- | --- | --- | --- |
| Cadastro | Criar/editar, em geral sem exclusão | ativo ↔ inativo; inativar não apaga nem cancela filhos | S, validar reativação/novos vínculos em D04 |
| Contrato | Todo registro aparece ativo | rascunho → ativo após validação; ativo → encerrado/cancelado somente por ação auditada; não voltar automaticamente | S/D04; datas/obrigações pendentes governam autorização futura |
| Cobrança | Geração; recebimento altera status | Saldo positivo → parcial/quitado por movimento; relógio muda prazo sem UPDATE; acordo muda a base exigível | E + normalização S/D07 |
| Negociação | Um objeto pode sobrescrever outro | Registrar termos e parcelas atomicamente; substituir versão, preservando pagamentos e a anterior | S/D07 |
| Despesa | Pagar tudo; reabrir apaga data | Registro de pagamento; reabertura por estorno integral identificável; saldo calculado | S/D09 |
| Obra | Campo permite escolher qualquer status; concluída força 100% no modal | Planejada → em_andamento/pausada/cancelada; em_andamento ↔ pausada; concluir exige 100%; reabrir concluída/cancelada depende de D04 | S; não alegar que todas essas restrições existem hoje |
| Atividade | Qualquer não concluída pode concluir; bloquear não concluída; reprogramar inclusive concluída | Preservar concluir de não iniciada/em andamento/bloqueada; bloquear exige motivo; início explícito/desbloqueio/reabertura são D11 | E com lacunas identificadas |
| Participação | Criar e remover se sem cotas; não editar | Encerrar versão e criar nova para mudança; nunca reescrever uma versão referenciada | S/D13 |
| Pagamento | Inserir, sem estorno | Original imutável → nova linha de estorno; não estornar estorno nem duplicar reversão | S/D09 |
| Pendência | Remover ao resolver | Registrar resolução e ator; reabertura ainda pendente | S/D14 |
| Documento | Nomes sem conteúdo | referenciado → disponivel após ingestão verificada; disponivel → retirado por ato auditado; versão nova não sobrescreve antiga | S/D16 |

Não há evidência de aprovação/reprovação. Esta proposta não cria estado aprovado/reprovado nem tabelas de aprovadores/alçadas. Caso sejam exigidos, D02/D09 devem definir quem aprova, quando, e se o evento antecede o efeito financeiro.

## 6. Valores financeiros, cálculos e fonte única

### 6.1 Valores armazenados e sua origem

Todos os valores desta tabela são BRL e DECIMAL(15,2), salvo quantidade/percentual explicitados. Somente documentos emitidos e movimentos efetivos alteram obrigações e caixa.

| Informação | Fonte/entidade | Natureza | Armazenar? | Justificativa |
| --- | --- | --- | --- | --- |
| Aluguel mensal | contratos.aluguel_mensal | Valor total mensal do contrato, inclusive várias unidades | Sim | Entrada contratual, não rateio por unidade inexistente |
| Valor-base de encargo | contrato_encargos.valor_base | Valor de regra, não obrigação emitida | Se conhecido | NULL não é zero; fonte em D05 |
| Valor emitido por item | cobranca_itens.valor | Total do item | Sim | Snapshot da obrigação; não reprecificar pelo contrato atual |
| Recebimento | recebimentos.valor | Dinheiro efetivo bruto | Sim | Movimento individual |
| Valor alocado | recebimento_alocacoes.valor | Parte do recebimento destinada ao alvo | Sim | Associação monetária; soma deve reconciliar com recebimento |
| Saldo-base do acordo | negociacoes.saldo_base | Obrigação remanescente pactuada no instante | Sim | Snapshot histórico, não saldo corrente cache |
| Desconto/acréscimo/entrada prevista | negociacoes | Termos do acordo | Sim | Não são dinheiro recebido |
| Parcela | negociacao_parcelas.valor | Obrigação por vencimento | Sim | Agenda pactuada e arredondada |
| Despesa/contratação de obra | despesas.valor | Total da obrigação ao fornecedor | Sim, uma única vez | E26 não repete valor contratado |
| Pagamento de despesa | pagamentos_despesa.valor | Dinheiro efetivo | Sim | Mesmo mecanismo para fornecedor de obra |
| Orçamento/reserva | obras | Limite/planejamento | Sim | Não somar automaticamente ao caixa |
| Realizado informado | obras.realizado_informado | Informação manual do usuário | Sim enquanto D10 pendente | Não há origem transacional consistente no estado atual |
| Tarifa de profissional | obra_alocacoes_equipe.valor_unitario | Valor por hora/diária | Sim | E: tarifa varia por alocação |
| Quantidade | obra_alocacoes_equipe.quantidade | Horas/diárias, DECIMAL(12,2) | Sim | Custo previsto, não pagamento |
| Participação | obra_socios.percentual | Percentual, DECIMAL(5,2) | Sim por vigência | Não atributo global do sócio |
| Capital solicitado | aportes.valor_solicitado | Total do aporte | Sim | Solicitação, não recebimento |
| Valor da cota | aporte_cotas.valor_devido | Obrigação individual arredondada | Sim | Rateio congelado, fecha o total do aporte |
| Integralização | aporte_pagamentos.valor | Dinheiro recebido de uma cota | Sim | Uma única origem para a entrada financeira |
| Ajuste | obra_ajustes_caixa.valor_assinado | Entrada/saída manual | Sim | Pode ser negativo; não é reclassificação automática de despesas |

Arredondar dinheiro para centavos em cada documento de negócio conforme regra explícita, nunca após conversões repetidas para ponto flutuante. Multiplicação quantidade × tarifa deve usar precisão intermediária maior e conferir estouro antes de converter para DECIMAL(15,2). Percentuais usam duas casas, coerentes com a interface atual; 100% exatos equivalem a 10.000 centésimos de ponto percentual.

### 6.2 Dados derivados: onde calcular

| Dado mostrado hoje | Classificação futura | Fonte/regra | Coluna removida/evitada |
| --- | --- | --- | --- |
| Imóveis/unidades por carteira | Agregado em consulta | COUNT pelas FKs | Portfolio.properties/units |
| Unidades por imóvel | Agregado em consulta | COUNT(unidades) | Property.units |
| Contratos por locatário | Agregado em consulta | COUNT com política de vigência/estado D04 | Tenant.contracts |
| Ocupação % | Agregado/backend | Ocupadas ÷ total; fonte de ocupada em D03 | Percentual cache |
| Total faturado | Agregado/backend | SUM dos itens emitidos no escopo | Charge.total |
| Recebido no item | Agregado/backend | Alocações originais menos estornos | ChargeItem.received |
| Saldo operacional da cobrança | Backend | Base original OU acordo vigente, nunca ambos somados | Charge.balance |
| Vencida/próxima | Backend na consulta | Vencimento de obrigação com saldo vs data da consulta | Status temporal persistido |
| Total negociado | Backend | saldo_base - desconto + acrescimo | negotiatedTotal |
| Total financiado | Backend | total negociado - entrada_prevista | financedAmount |
| Total pago/saldo de despesa | Agregado/backend | SUM líquida de pagamentos; valor - pago | paidAmount/paidDate como estado único |
| Último pagamento | Agregado | Última data de original não estornado | lastPaymentDateIso |
| Receita contratada/ticket médio | Agregado | SUM/AVG de aluguel conforme vigência D04 | Indicadores armazenados |
| Resultado previsto Locações | Backend | Saldo a receber - despesas em aberto; escopo/período D20 | Resultado cache |
| Custo da equipe | Backend/agregado | Quantidade × tarifa de alocações não removidas | Custo total armazenado |
| Saldo de orçamento de obra | Backend | Orçamento - realizado_informado - reserva, enquanto D10 | projectedCashBalance |
| Consumo do orçamento | Backend | Realizado ÷ orçamento; se zero, resultado não aplicável | Percentual cache |
| Participação total | Agregado | SUM das versões correntes | distributed |
| Investido/pendente por sócio | Agregado | Cotas e pagamentos de todas as obras/escopo | partner.invested/pending |
| Total integralizado | Agregado | SUM líquida de aporte_pagamentos | contributionPaid |
| Financeiro da obra: linhas de aporte | Projeção em consulta | Uma linha para cada aporte_pagamento | Cópia WorkFinancialEntry kind=Aporte |
| Progresso calculado do cronograma | Backend | Concluídas ÷ total; zero/sem atividades deve ser explicitado | Cache duplicado do cronograma |
| Progresso informado da obra | Armazenado | Campo manual ou comando de concluir atividade atualiza | Não remover silenciosamente; D10 |
| Risco informado | Armazenado | Avaliação do usuário | Não confundir com atraso de data |
| Próxima atividade informada | Armazenado | Texto atual do usuário/ação | Vínculo automático futuro em D11 |
| Última atualização | Backend a partir de eventos | MAX de alterações operacionais relevantes | lastUpdateLabel fixo |
| Datas por extenso, BRL, iniciais e cor | Frontend | Formatação de dados canônicos | Strings “12 ago 2026”, “AL”, tons CSS |
| Alertas de vencimento/atraso | Backend em consulta | Obrigações/atividades com saldo ou prazo em atraso | workAttentionRecords fixo |
| Pendências reconhecidas/resolvidas | Armazenado | E34 se requerem resolução independente | Não equiparar com todos os alertas |
| XLSX | Artefato gerado | Consulta de itens de aluguel por competência/carteira | Não precisa de tabela de relatório |

Propostas de métricas não devem copiar `Math.max(1, denominador)` como regra financeira: em orçamento/quantidade zero, apresentar zero apenas quando fizer sentido ou “não aplicável”. Definição da apresentação é D20. Campos de snapshot imutável não são caches de saldo e podem ser armazenados sem o risco de envelhecer.

### 6.3 Recebimentos e negociação sem duplicar dívida

**Sugestão de modelagem D07.** O acordo cobre o saldo remanescente inteiro de uma cobrança, como no modal atual; negociação de itens selecionados ou de várias cobranças exigiria outro vínculo de composição e não integra esta proposta.

1. Sem acordo: obrigação exigível = soma dos itens - alocações líquidas nos itens.
2. Ao registrar acordo: bloquear a cobrança, calcular saldo remanescente e gravá-lo em saldo_base; registrar termos e parcelas atomicamente.
3. Após o acordo: obrigação exigível = soma das parcelas da versão governante - alocações líquidas nessas parcelas. O saldo original remanescente fica substituído para cobrança, não é contado junto.
4. Pagamentos anteriores continuam nos itens/versões onde ocorreram e continuam no caixa histórico. Não recebem nova alocação apenas porque surgiu um acordo.
5. Entrada prevista vira parcela 0 quando > 0. Só um recebimento efetivo alocado a ela reduz o saldo exigível. Não presumir que a assinatura do acordo recebeu essa entrada.
6. Substituição de acordo usa somente saldo remanescente da versão anterior como nova base. A versão anterior deixa de ser exigível, mas mantém termos e recebimentos para consulta. A operação bloqueia toda a cadeia contra concorrência.
7. Acréscimos/descontos fazem parte dos valores das novas obrigações. Não forçar pagamentos do acordo de volta nos itens originais nem registrar desconto como caixa.

Exemplo revisável: saldo-base R$ 1.000,00, desconto R$ 100,00 e acréscimo R$ 50,00 → obrigação negociada R$ 950,00. Entrada prevista R$ 200,00 + três parcelas de R$ 250,00. Antes de receber, o saldo é R$ 950,00. Ao receber R$ 200,00 na parcela 0, saldo R$ 750,00. Não somar os R$ 1.000,00 originais; não registrar duas vezes os R$ 200,00.

Esclarecimento sobre o levantamento anterior: não descontar uma entrada que é apenas prevista é coerente. A lacuna atual é não identificar seu vencimento/recebimento e sua ligação com o acordo. A modelagem não toma a diferença entre “financiado” e “saldo a receber” como erro por si só.

O relatório atual é de valores de aluguel emitidos, não de caixa. Ratear desconto/juros de acordo entre aluguel/IPTU/condomínio para relatório de recebimentos é D20. Essa nova dimensão não está definida e não deve ser inventada usando proporcionalidade automática.

### 6.4 Obras: orçamento, caixa e realizado

As três leituras abaixo são diferentes e precisam continuar identificadas enquanto D10 estiver pendente:

- **Orçamento disponível:** orçamento - reserva - realizado informado, reproduzindo a intenção do cadastro atual.
- **Custo previsto da equipe:** quantidade × tarifa. Não é dinheiro já pago.
- **Fluxo líquido registrado:** aportes efetivamente recebidos + ajustes assinados - pagamentos de despesas de obra. Reversões têm sinal contrário. Esta terceira leitura é S/D08/D10 e não deve ser apresentada como saldo bancário sem saldo inicial/abrangência definidos.

Exemplo: orçamento de R$ 10.000,00, reserva de R$ 1.000,00 e realizado informado de R$ 3.000,00 → disponibilidade orçamentária de R$ 6.000,00. Aportes recebidos de R$ 5.000,00 e fornecedores pagos de R$ 2.000,00 → fluxo líquido de R$ 3.000,00. Os R$ 3.000,00 informados podem conter os mesmos R$ 2.000,00 pagos: somá-los seria incorreto. A equipe prevista não reduz caixa sem movimento real.

Não criar `lancamentos_financeiros` como segunda fonte de cada pagamento de aporte/fornecedor. Uma consulta une E31, E21 por E26 e E32, com referência inequívoca ao tipo de movimento e UUID de origem. A aba atual pode manter filtro somente de aportes/ajustes até D10 aprovar a leitura unificada. Uma contabilidade de partidas dobradas seria outro requisito, não uma extensão implícita deste livro operacional.

### 6.5 Rateio societário

Fluxo evidenciado: completar 100%, solicitar aporte, calcular cotas e receber parcelas individuais.

- Validar cada percentual > 0 e <= 100; validar soma exata de 100,00 no momento da solicitação.
- Fixar a ordem de rateio e as versões de participação utilizadas.
- Calcular cotas em centavos; preservar valores emitidos.
- O algoritmo atual arredonda cada sócio exceto o último, que absorve o residual. Com 100 sócios a 1% e aporte R$ 0,50, isso pode produzir residual negativo: é uma lacuna, não uma regra a replicar.
- **Sugestão de modelagem D13:** repartir pelos maiores restos em centavos, com desempate estável pela ordem_rateio, garantindo cotas não negativas e soma exata. Alternativamente, negócio pode definir aporte mínimo/limite de sócios; nenhuma alternativa está aprovada.
- Até a decisão, emissão deve bloquear rateio inválido em vez de gravar cota negativa ou total divergente. Cota zero pode existir como participação histórica sem habilitar pagamento nela.

## 7. Constraints, validações cruzadas e concorrência

### 7.1 Garantias declarativas

| Regra | Entidades | Garantia de banco proposta |
| --- | --- | --- |
| Identidade estável | Todas | PK UUID ou PK composta declarada |
| Código sem colisão | Entidades com código | UNIQUE global ou (obra_id, codigo), conforme dicionário |
| E-mail de acesso único | usuarios | UNIQUE sobre representação normalizada; D01/D02 |
| Documento sem cadastro duplicado | locatarios, imobiliarias | UNIQUE condicionado à decisão D18; não em carteiras |
| Vínculo repetido | contrato_unidades, obra_equipe_atividades | PK composta |
| Uma emissão por contrato/mês | cobrancas | UNIQUE(contrato_id, competencia), S/D06 |
| Competência canônica | cobrancas | CHECK dia do mês = 1 |
| Ordem de composição | Encargos, itens, cotas, parcelas | UNIQUE no pai + ordem/número |
| Valor válido | Itens, despesas, recebimentos, pagamentos, aportes, cotas | CHECK >= 0 ou > 0 conforme campo; sem FLOAT |
| Desconto/entrada coerentes | negociacoes | CHECKs usando saldo_base, desconto, acrescimo e entrada na própria linha |
| Participação/progresso válidos | obra_socios, obras, diario | CHECK percentual no intervalo definido |
| Período válido | Contratos, obra, atividade, equipe, participação | CHECK fim >= início; vigência temporal exclusiva exige fim > início |
| Obra concluída | obras | CHECK estado != concluida OR progresso=100 |
| Bloqueio com motivo | obra_atividades | CHECK estado != bloqueada OR motivo não vazio |
| Quitação de origem certa | recebimento_alocacoes | CHECK XOR dos destinos + FKs |
| Documento vinculado a alvo real | documento_vinculos | CHECK XOR dos três alvos + FKs |
| Um estorno integral | Movimentos R | UNIQUE(estorno_de_id) não nulo, FK própria, CHECK id != estorno_de_id |
| Versões sem bifurcação | negociacoes, documentos | UNIQUE da referência anterior; ausência de ciclos precisa validação cruzada |
| Uma versão corrente | negociacoes, obra_socios | UNIQUE condicionado à vigência aberta, quando mecanismo suportar |
| Resolução com autoria | obra_pendencias | CHECK par resolvida_em/resolvida_por |
| Documento disponível com conteúdo | documentos | CHECK estado/metadados/chave |
| Autoria de evento | auditoria_eventos | CHECK ator ou contexto + XOR identificação simples/composta |

CHECK deve lidar explicitamente com NULL. Campo opcional não deve passar uma validação importante por avaliação SQL desconhecida; combinar NOT NULL e condicionais no DDL futuro. A escolha de mecanismo equivalente em bancos sem índice parcial faz parte de D01.

### 7.2 Invariantes que envolvem mais de uma linha

| Invariante | Escopo a bloquear/conferir na transação | Resultado exigido |
| --- | --- | --- |
| Unidades do mesmo imóvel do contrato | Contrato + unidades inseridas | FK existente e todos os imovel_id iguais |
| Exclusividade de ocupação, se aprovada | Unidade + contratos relevantes | Nenhuma vigência incompatível sobreposta; não basta verificar antes sem bloqueio |
| Unidade escolhida na obra | Obra + unidade | Mesmo imóvel |
| Origem do encargo emitido | Cobrança/contrato + regra | Regra pertence ao contrato correto |
| Cobrança emitida íntegra | Cobrança + conjunto completo de itens | Ao menos um item, nenhuma regra de valor obrigatória indefinida |
| Baixa integralmente alocada | Cobrança + recebimento + alvos + alocações | Soma exata = valor; nenhum alvo excedido; mesma cobrança |
| Baixa em acordo válido | Cobrança + negociação governante | Não aceitar novos pagamentos em versão substituída nem em itens originais substituídos |
| Emissão/substituição de acordo | Cobrança + versões + parcelas | Saldo-base atual; soma e quantidade exatas; uma versão vigente; sem cadeia cíclica |
| Pagamento concorrente | Despesa ou cota + movimentos | Soma líquida de pagamentos <= obrigação após ambas as operações |
| Estorno correto | Original + estorno + alocações/dependentes | Mesmo titular/obrigação, mesmo valor e natureza inversa; original não pode ser um estorno |
| Estorno de recebimento alocado | Recebimento original + todas as alocações | Reverter exatamente a composição original; não redistribuir o valor segundo saldos novos |
| Estorno anterior a acordo | Cobrança + cadeia de acordos | Bloquear até revalidar/desfazer dependências; não alterar silenciosamente saldo_base emitido |
| Despesa especializada | Despesa + obra_contratacoes | Origem contratacao_obra tem exatamente uma especialização; operacao não tem |
| Equipe em atividade da obra | Alocação + atividade | Mesmo obra_id; associação não pode atravessar obras |
| Participações | Obra + versões dos sócios | Sem sobreposição por sócio; total corrente <= 100; troca feita atomicamente |
| Aporte e cotas | Obra + participações + aporte + cotas | Total de participação 100; mesma obra; um sócio por aporte; soma de cotas igual ao aporte |
| Geração de código local de pagamento de aporte | Obra alcançada por cota/aporte | Código local sem colisão, ou omitir código; UUID continua suficiente |
| Versionamento documental | Cadeia anterior + novo documento | Sem ciclos ou ligação do arquivo como sua própria versão |
| Alteração com histórico | Registro de negócio + auditoria/diário quando exigido | Commit conjunto; sem operação financeira sem rastro |

O desenho físico deve escolher bloqueios, isolamento, triggers ou procedimentos que preservem esses invariantes mesmo com duas requisições simultâneas. Política de acesso ao banco deve impedir escritas paralelas por caminhos que pulem essas garantias. Não afirmar que um UNIQUE parcial sozinho mantém 100% das participações ou impede pagamento excedente.

## 8. Exclusão, inativação e históricos

### 8.1 Estratégia por grupo

| Entidades | Estratégia proposta | Efeito nas relações |
| --- | --- | --- |
| Usuarios | Inativar; não apagar usuário com autoria | FKs de autoria RESTRICT; revogar acesso |
| Carteiras, imóveis, unidades, imobiliárias, locatários | ativo=false | Histórico permanece; novos vínculos precisam de cadastro ativo |
| Fornecedores, profissionais, sócios, categorias, contas | ativo=false | Não apagar após uso |
| Contratos | Estado encerrado/cancelado, D04 | Não remover cobranças/unidades históricas |
| Contrato_unidades/encargos | Remoção física só enquanto contrato é rascunho sem uso | Fora disso, preservar e RESTRICT |
| Cobranças, itens, acordos e parcelas emitidos | Sem exclusão física | Correção por procedimento/versionamento aprovado; cancelamento D06/D07 |
| Despesas/contratações | Sem apagar obrigações com histórico | Caso de cadastro errado sem uso deve ser definido em D09 |
| Recebimentos, pagamentos, integralizações, ajustes | Originais imutáveis + estornos novos | Sem deleted_at; cálculo líquido considera o inverso |
| Obras | Cancelar ou, futuramente, arquivar | Não apagar cronograma/financeiro/diário em cascata |
| Atividades | Sem exclusão física após uso | Tela atual sequer oferece excluir; eventual cancelamento é D11 |
| Alocações de equipe | removida_em com auditoria | Mantém histórico; excluída dos custos correntes, não reescreve períodos antigos |
| Equipe_Atividades | Remoção do vínculo com auditoria quando autorizada | Não apaga alocação nem atividade |
| Participações | Fechar vigência; versões referenciadas preservadas | Reentrada e pendências dependem de D13 |
| Aportes/cotas | Preservar solicitação/obrigação emitida | Sem apagar pagamentos; cancelamento D13 |
| Diário/auditoria | Append-only | Retificação por novo evento |
| Pendências | Resolução por data/ator | Resolução não apaga a causa financeira |
| Compromissos | Decisão D15 | Não presumir exclusão de cronograma a partir da agenda |
| Documentos | Retirada lógica/versão nova | Binário e metadados têm retenção D16; nada de cascata física automática |
| Documento_vinculos | Preservar vínculo usado por transação | Desvinculação de anexo provisório depende da política D16 |

Não há `SET NULL` automático nas FKs operacionais ou de autoria: apagar a origem faria perder o contexto; inativação é suficiente. Opcionalidade de uma FK significa “pode não ter sido informado”, não “apagar seu pai transforma automaticamente o vínculo em ausente”.

`CASCADE` não é padrão nesta proposta. Poderá ser limitado a componentes de um rascunho comprovadamente não emitido, mediante rotina controlada; não se recomenda `ON DELETE CASCADE` global que também funcionaria após emissão. Documentos, pagamentos, cotas e auditoria sempre precisam ser preservados.

### 8.2 Históricos necessários e como são mantidos

| Informação que muda | História proposta | Por que não sobrescrever |
| --- | --- | --- |
| Nome, contato, carteira ou cadastro | auditoria_eventos com antes/depois | Autoria e mudanças cadastrais |
| Estado de contrato/obra/atividade | Campo corrente + evento auditado | Consulta rápida sem perder transições |
| Bloqueio/reprogramação | Evento com motivo e datas antigas/novas; diário correspondente | Justificativa operacional |
| Recebimentos e pagamentos | Linhas originais e estornos com FKs | Datas, montantes e relações comprováveis |
| Negociação | Nova versão; parcelas da versão permanecem | Acordo anterior e pagamentos não desaparecem |
| Participação societária | obra_socios por vigência | Percentual futuro não altera a obrigação passada |
| Aporte/cota | Documento e rateio imutáveis + pagamentos separados | “Investido” é soma de movimentos, não edição de um número |
| Ajuste de caixa | Movimento próprio com sinal + eventual reversão | Distingue correção manual de custo/orçamento |
| Documento | Novo documento com referência à versão anterior | Não trocar conteúdo mantendo aparência de prova antiga |
| Diário | Novas entradas/retificações | Texto publicado continua rastreável |
| Resolução de pendência | Data/ator e evento | “Resolver” não remove evidência |

Dados financeiros e relacionais não ficam somente em JSON de auditoria: permanecem em entidades próprias com FKs. JSON serve para o histórico de mudanças que não precisam de tabelas genéricas de detalhe para cada coluna.

## 9. Índices recomendados pelas consultas existentes

PK e UNIQUE já geram os índices correspondentes no desenho físico usual; não criar uma segunda cópia idêntica. FKs com volume de consulta/validação justificam índices, preferencialmente cobertos pelo primeiro campo de um composto. O plano final depende do banco e de medições, D01.

| Consulta/ação | Índice proposto | Justificativa/limite |
| --- | --- | --- |
| Login | UNIQUE usuarios(email normalizado) | Igualdade de identidade |
| Imóveis por carteira | imoveis(carteira_id, id) | Filtro e navegação |
| Unidades de imóvel/ocupação | unidades(imovel_id, ocupada_informada, id) | Filtro combinado atual; revisar se D03 mudar fonte |
| Locatários por imobiliária | locatarios(imobiliaria_id, id) | Hub/filtro, inclusive ausência conforme mecanismo |
| Contratos do locatário | contratos(locatario_id, estado, inicio) | Card, contagem e vigência |
| Contratos do imóvel | contratos(imovel_id, estado, inicio) | Vínculo patrimonial |
| Contratos da unidade | contrato_unidades(unidade_id, contrato_id) | Direção inversa não coberta pela PK iniciada em contrato_id |
| Encargos do contrato | UNIQUE(contrato_id, ordem) | Já cobre leitura no pai |
| Cobranças do contrato/mês | UNIQUE(contrato_id, competencia), se D06 aprovado | Evita duplicidade e atende detalhe do contrato |
| Relatório mensal | cobrancas(competencia, contrato_id) | A ordem inversa do UNIQUE atende filtro só por mês |
| Itens/vencimentos da cobrança | cobranca_itens(cobranca_id, vencimento, id) | Alocação determinística por vencimento/ID |
| Recebimentos da cobrança | recebimentos(cobranca_id, data_recebimento, id) | Histórico e saldo |
| Alocações por destino | recebimento_alocacoes(cobranca_item_id, recebimento_id); equivalente por parcela, só não nulos | Soma líquida por obrigação; UNIQUE por recebimento não cobre a direção inversa |
| Negociações/parcelas | UNIQUE(cobranca_id, versao); UNIQUE(negociacao_id, numero) | Versões e composição |
| Despesas por categoria/vencimento | despesas(categoria_id, vencimento, id) | Categoria + ordenação temporal |
| Despesas por fornecedor | despesas(fornecedor_id, vencimento, id) | Consulta de credor |
| Vencimentos gerais de despesas | despesas(vencimento, id), condicionado a volume | Não indexar “Vencido” que é calculado |
| Pagamentos da despesa | pagamentos_despesa(despesa_id, data_pagamento, id) | Saldo e histórico |
| Obras por responsável/situação | obras(responsavel_profissional_id, estado, id) | Painel filtrado |
| Obras por situação/risco | obras(estado, risco_informado, id), se justificar plano | Listagem; evitar índices isolados de baixa seletividade |
| Obras do imóvel | obras(imovel_id, id) | Relação com patrimônio |
| Atividades da obra | obra_atividades(obra_id, termino, id) | Cronograma; UNIQUE local também atende busca por código |
| Equipe/contratações/diário/pendências | Índices começando por obra_id | UNIQUE(obra_id,codigo) cobre várias leituras no pai |
| Diário cronológico | obra_diario(obra_id, ocorrido_em, id) | Timeline e arquivos recentes |
| Agenda, se D15 aprovada | obra_compromissos(data, obra_id, id) | Próximos compromissos |
| Atividades por alocação e vice-versa | PK(alocacao_id,atividade_id) + índice inverso | Navegação N:N |
| Participações em uma obra | obra_socios(obra_id, fim_vigencia, inicio_vigencia) | Quadro societário corrente/histórico |
| Obras de um sócio | obra_socios(socio_id, obra_id, inicio_vigencia) | Identidade compartilhada, D13 |
| Cotas/pagamentos | UNIQUE(aporte_id,obra_socio_id); aporte_cotas(obra_socio_id,aporte_id); aporte_pagamentos(cota_id,data_pagamento,id) | Totais por aporte, participação e histórico |
| Ajustes | obra_ajustes_caixa(obra_id, data_movimento, id) | Fluxo financeiro |
| Anexos | Índice (cada alvo não nulo, documento_id) | Listar documentos por registro; avaliar contra os UNIQUE equivalentes |
| Auditoria de um registro | auditoria_eventos(entidade, registro_id, ocorrido_em, id) | Inspeção histórica direcionada; chave composta tem consulta específica |

Para pesquisa “contém”, sem acentos e sem diferença de caixa, um B-tree simples em nome não garante eficiência. Começar com a semântica definida e volume medido; avaliar índice de texto/expressão ou mecanismo de busca compatível com o banco. Não sugerir índice em cada coluna da string concatenada atual. Documento normalizado favorece busca exata; mascaramento é apresentação. Busca prefixada/por trechos deve ser definida antes da otimização.

Ordenação futura deve adicionar desempate por UUID/código para paginação estável. Nenhuma tabela de paginação, filtros salvos ou dashboard é necessária; a UI atual não oferece essas entidades.

## 10. Decisões de negócio pendentes

As recomendações abaixo tornam a proposta concreta. Não são requisitos aprovados. Decisões que alteram chaves, origem de saldo ou alcance de acesso devem ser resolvidas antes de implementar as entidades afetadas; os demais módulos independentes podem ser planejados normalmente.

| ID | Questão e evidência atual | Hipótese/Sugestão de modelagem para validar | Impacto da decisão |
| --- | --- | --- | --- |
| D01 | Qual banco será usado? É uma instalação única ou haverá empresas/clientes isolados? Só há um store global e um starter D1 não conectado | Modelo lógico para uma instalação única; não adicionar empresa_id/tenant_id sem requisito. Escolher armazenamento decimal, UTC e garantias transacionais do banco | Multitenancy muda quase todas as unicidades, FKs e consultas; o mecanismo altera representação de UUID/decimal e constraints temporais |
| D02 | Como autenticar e quem pode fazer cada ação? Só existe Administrador visual | Usuário real; um perfil fixo administrador explicitamente atribuído como ponto inicial, sem autoelevação. Escolher credencial local ou provedor; negar acesso sem perfil suportado | Pode dispensar senha_hash ou exigir identidade externa; múltiplos perfis editáveis podem demandar perfis/permissoes/associativas que hoje não se justificam |
| D03 | Unidade ocupada sem contrato é válida? Pode haver contratos sobrepostos? O checkbox é editável e há unidades ocupadas sem contrato no mock | Preservar ocupada_informada enquanto houver ocupação manual. Se a fonte for contrato, remover esse campo após reconciliar dados e calcular por período/estado. Propor não sobrepor locações exclusivas da mesma unidade | Define se ocupação é dado ou consulta, bloqueios temporais e eventual necessidade de registros de ocupação não contratual |
| D04 | Quais ciclos e retrocessos são permitidos em contrato/obra/cadastro? O contrato não tem ciclo real; obra permite seleção livre | Estados propostos na seção 5; ativação validada; cancelamento/encerramento auditados; não extinguir obrigação financeira junto com o cadastro | Afeta campos de término efetivo, permissões, exclusividade de unidade e política de reversão |
| D05 | Qual a fonte e vigência de valores/vencimentos de encargos? Pode aluguel/item ser zero? Referência é mês a vencer ou vencido? Reajuste é mês independente do início? | Valor não definido permanece NULL e bloqueia emissão. Item emitido guarda seu próprio vencimento. Manter aluguel >= 0 por fidelidade até decidir > 0. Não derivar preços das cobranças mockadas nem aplicar índice automaticamente | Pode acrescentar regras de vencimento por encargo, histórico de tarifa/reajuste e referências mensais; define geração correta e campos obrigatórios |
| D06 | Uma competência permite complemento, cancelamento/reemissão ou mais de uma cobrança por contrato? Hoje não se impede duplicidade | Proposta inicial: uma cobrança normal por contrato/mês, com UNIQUE. Cobrança emitida imutável. Complementos e cancelamentos ficam fora até definição | Se houver complementos, mudar a chave de negócio e modelar número/tipo/versão antes da migration; não contornar UNIQUE silenciosamente |
| D07 | Entrada é prevista ou recebida ao salvar acordo? Qual vencimento? É permitido renegociar parcialmente, vários itens ou várias cobranças? | Salvar acordo não recebe dinheiro. Entrada como parcela 0 com data obrigatória quando positiva; acordo cobre um saldo integral de uma cobrança. Versões preservadas e baixas alocadas nas parcelas | Muda composição de parcelas, apropriação e quitação; acordos que consolidam dívidas exigem associação adicional não incluída no catálogo |
| D08 | Fornecedores/contas a pagar de Obras e Despesas serão compartilhados? Uma contratação gera uma ou várias faturas? Pagamento pode quitar várias despesas? | Cadastro único de fornecedor; uma obrigação por contratação atual, especializada 1:1, com vários pagamentos. Pagamento atende uma despesa. Na UI de Locações, parcialidade só se aprovada | Aprovar a unificação valida E07/E20/E21/E26; múltiplas faturas mudam 1:1 para contratação 1:N despesas; liquidação em lote exige pagamento + alocações, não prevista aqui |
| D09 | Quem pode estornar/reabrir, corrigir valor ou cancelar documento? Precisa aprovação? Pode estorno ser parcial ou ocorrer após negociação? | Movimentos imutáveis, apenas estorno integral com motivo e FK única ao original; bloquear inversões que invalidem acordos posteriores; reabertura de despesa pela reversão da baixa correspondente | Define permissões, transações e eventual aprovação. Se estorno parcial for necessário, UNIQUE(estorno_de_id) e composição precisam mudar |
| D10 | “Realizado”, “saldo projetado” e “caixa” da obra representam o quê? Equipe é custo previsto ou liquidado? Progresso é manual ou calculado? | Preservar realizado/progresso informados; calcular orçamento disponível separadamente do fluxo líquido. Não somar gasto manual a pagamentos nem descontar equipe prevista do caixa | Pode substituir realizado_informado por fonte de custos apropriados ou exigir movimentos de abertura; evita duplicidade financeira e conflito de progresso |
| D11 | Responsável precisa ter login? Unidade da obra deve existir? Alocação/atividade podem ultrapassar período da obra? Haverá início/desbloqueio/edição de atividade? | Profissional separado de usuário; unidade opcional porém FK válida quando informada; exigir fim >= início. Outras restrições de calendário/vínculo dependem de resposta | Define cadastros, FKs, validação temporal, eventual vínculo profissional-usuário e ações de cronograma |
| D12 | Toda baixa exige conta/forma? Data de crédito difere da de recebimento? Há pagador terceiro? Aportes precisam de conta? | Contas por identidade; nenhum nome default vira informação comprovada. Manter data única enquanto iguais; pagamentos de obra não recebem conta fictícia | Pode tornar FKs obrigatórias, incluir data_credito/pagador e mudar a apuração de caixa por conta |
| D13 | Um sócio pode integrar várias obras? Participações mudam/reentram? Qual vigência rege aporte retroativo? Rateio pode ter centavos insuficientes? | Cadastro compartilhável, participações por versão, cotas imutáveis; usar quadro corrente ao emitir. Recomenda-se maiores restos para centavos; saída com saldo pendente exige política | Define identidade, intervalos, algoritmo, cancelamento de aporte e regras de fechamento do quadro societário |
| D14 | Resolver alerta significa reconhecer, eliminar causa ou concluir uma tarefa? Pode reabrir pendência? | E34 guarda apenas itens que requerem tratamento/resolução; atraso calculado continua aparecendo enquanto existir dívida/prazo. Resolver item não paga dívida | Pode dispensar armazenar alguns mocks, ou exigir associação com a causa e histórico de reconhecimento/reativação |
| D15 | Compromissos são eventos independentes ou projeções de atividades/pagamentos? Há horário e conclusão? | E35 é opção somente para agenda independente; caso contrário usar consulta e eliminar a entidade | Evita duplicar cronograma/agenda; define DATE vs data-hora e o significado de “atrasado” |
| D16 | Quais telas poderão anexar, versionar, retirar e compartilhar arquivos? Qual retenção e armazenamento? As seis categorias do utilitário órfão entram no produto? | Documento central + três alvos de FK tipados encontrados no fluxo de nomes; novos módulos documentais são extensões explícitas. Sem conteúdo, manter referência indisponível | Define targets, categorias, limite de tamanho, metadados, acesso e retirada física; não prometer os arquivos dos mocks |
| D17 | Relatório histórico precisa reproduzir nome/endereço/titular da emissão? Imóvel pode trocar de carteira? Contrato pode trocar parte/unidades? | FKs resolvem identidade. Proposta base mantém apresentação cadastral corrente, como hoje; congela partes/vínculos de contrato emitido. Se exigir aparência histórica, acrescentar snapshot documental na emissão ou versões cadastrais | Afeta titularidade temporal e colunas históricas; auditoria sozinha não equivale a um relatório histórico pronto |
| D18 | Documentos/nome de unidade devem ser únicos em qual escopo? Quais máscaras/tipos são aceitos? Quais opções inativas devem entrar? | Não unicidade de nomes de pessoas; e-mail de contato compartilhável; propor documento único no próprio cadastro de locatários/imobiliárias e nome de unidade por imóvel, sujeitos à validação | Define constraints de unicidade, normalização e dados a reconciliar; não impor unicidade de documento entre papéis diferentes sem cadastro único de pessoas |
| D19 | Qual fuso/data de negócio, retroatividade e limites de pagamento? O que fazer com datas fixas e sem fuso dos mocks? | Datas DATE para competência/vencimento; instantes UTC para autoria. Não usar agosto de 2026 como default. Valores sem proveniência não viram eventos reais | Afeta conversões, comparação temporal e carga. Datas fictícias não podem gerar histórico verdadeiro por inferência |
| D20 | Relatório é por emissão ou caixa? Inclui canceladas, acordo e encargos? Dashboards filtram competência/carteira/obra? | Manter XLSX de aluguel emitido enquanto essa for a finalidade; qualquer rateio de desconto/juros por natureza precisa regra própria. Dashboard Locações considera origem operacao até aprovar abrangência comum | Define consultas/agregações, tratamento dos acordos, fontes do resultado e risco de contar despesas de obra em dois painéis |

### Permissões proporcionais ao que existe

Não há necessidade comprovada de cinco tabelas de RBAC neste momento. A hipótese mínima E01 possui um código de perfil atribuído e uma política de ações versionada na aplicação. O backend verificará a permissão em cada operação; possuir perfil só na UI não é proteção.

Se forem aprovados poucos perfis fixos, códigos adicionais e uma matriz fixa de ações podem ser suficientes. Se houver múltiplos perfis por usuário, concessões editáveis, escopo por carteira/obra ou administração de permissões pelo produto, modelar `perfis`, `permissoes`, `usuario_perfil` e `perfil_permissao` na revisão correspondente. Essas entidades não pertencem ao catálogo aprovado por inferência, e nenhum usuário novo recebe administrador como default.

## 11. Inconsistências dos mocks, campos inativos e carga futura

### 11.1 Divergências que precisam de reconciliação

| Evidência atual | Consequência para a modelagem | Tratamento proposto, sem executar carga |
| --- | --- | --- |
| Nomes de carteira/imóvel/locatário e arrays de nomes de unidade fazem o vínculo | Não há identidade referencial confiável | Mapear cada ocorrência para UUID, conferir ambiguidade e bloquear referências não resolvidas |
| IDs de atividades/fornecedores/sócios/aportes se repetem por obra | Código local não pode ser PK global | Chave de conciliação de origem inclui obra + tipo + código; novos UUIDs únicos |
| 8 unidades marcadas ocupadas e apenas 5 unidades associadas aos contratos dos mocks | Ocupação não pode ser inferida por contrato sem decisão | Galpão B, Sala 301 e Loja 11 aparecem ocupadas sem contrato correspondente; resolver D03 |
| Contadores de carteira/imóvel/locatário são armazenados separadamente | Podem divergir após mutação | Remover contadores na persistência e agregar; não migrá-los como fonte |
| Cobranças já têm R$ 5.585,00 em itens recebidos, mas `receipts` inicia vazio | Não há data/conta/autoria/alocação de movimentos reais para esse dinheiro | Não fabricar recebimentos. Dados são demonstrativos; se usados como cenário de teste, documentar abertura sintética separadamente. Carga real exige comprovantes/conciliação D09/D19 |
| CTR-009 lista IPTU; COB-0087 tem Aluguel e Água | A lista de encargos não prova valor ou emissão de todos os itens | D05 define ausência/valor/regra, não criar IPTU fictício |
| Encargos de nova cobrança podem usar valores de INITIAL_CHARGES | Fonte de preço é um registro demonstrativo | Substituir por regra definida; ausência permanece NULL antes da emissão |
| COB-0084 competência 07/2026 vence em agosto, embora a geração sem paymentReference use o mês a vencer | Não há referência mensal uniforme | Definir referência por contrato/regra em D05, preservar vencimento histórico do item |
| Obrigatoriedade/formatos pouco validados nos cadastros | Constraints novas podem rejeitar os mocks | Validar nomes, documentos, datas e unicidade antes de importar; não relaxar integridade para acomodar dados inventados |
| Estado “Ativo” do contrato não possui coluna nem vigência real calculada | Não é histórico de ativação | D04; datas de início não equivalem a created_at ou evento de assinatura |
| Negociação só ocupa uma entrada por cobrança; salvar sobrescreve | Perde versões e pode comprometer histórico | Versão imutável, cadeia e alocações por parcela; E18/E19/E17 |
| Alocação segue o array, embora a UI diga vencimento | Resultado depende da posição mutável | Ordenar por vencimento e desempate estável, validando D07, usar item_id em vez de itemIndex |
| Pagar/reabrir despesa sobrescreve data fixa ou NULL | Perde movimento anterior | E21/R, não converter alternância de status em exclusão de registro financeiro |
| Telecom existe no registro, não no modal atual | Domínio do formulário diverge do dado | Catálogo precisa incluir o valor já usado antes de restringir entradas |
| `FOR-001` contém fornecedor, objeto, preço, vencimento e pagamentos | Um objeto reúne cadastro e contratação | E07 cadastro; E20 obrigação; E26 atributos de obra; E21 movimentos, sob D08 |
| OBR-001: orçamento 185.000, realizado 128.400, saldo mock 31.600 e reserva não informada | Saldo mock pressupõe diferença de 25.000 sem campo de origem | Não inferir reserva financeira real. Reconciliar D10; 185.000 - 128.400 - 0 é 56.600, não 31.600 |
| Equipe, fornecedores e aportes do detalhe são gerados com percentuais fixos do orçamento/progresso | Fórmulas criam cenários, não regras do negócio | Não gerar automaticamente aportes de 72%, fornecedores em 62/38% ou pagamentos por progresso em produção |
| Datas de atividades/equipe do gerador podem ficar fora da obra ou ter fim antes do início | Aplicar constraints expõe datas inconsistentes | Não converter datas sintéticas em cronograma real sem revisão |
| Um mesmo nome de profissional pode aparecer em duas funções na obra | Deduplicação de alocações apagaria função/custo | Identificar profissional e manter alocações distintas; não UNIQUE(obra, profissional) |
| Pagamento de aporte também gera cópia em WorkFinancialEntry | Mesma entrada pode ser somada duas vezes | A lista financeira passa a projeção de E31; importar uma única fonte efetiva |
| Pagamento de fornecedor não atualiza obra.spent nem saldo | Fontes financeiras são independentes | D10; não somar gasto manual aos movimentos até definir apropriação |
| Diário usa autor responsável da obra e hora fixa | Não comprova autoria real | Preservar autor legado como texto; autoria nova usa sessão e instante confiáveis |
| Fornecedor parcialmente pago pode estar Vencido no gerador, mas nova baixa muda para Parcialmente pago | Um enum mistura prazo e quitação | Projeções separadas de saldo e prazo |
| Sócios atuais totalizam 100% e o botão adicionar fica desabilitado | Isso não define política de substituição/vigência | D13; não derivar modelo de autorização do botão |
| Nomes de arquivos sem binário/URL | Não há documento disponível para baixar | Estado referenciado, sem chave/mime/tamanho fabricados |
| React/Vinext contém campos e ações além do Angular atual | Duas fontes de requisitos divergentes | Confirmar runtime de referência; não importar os dois conjuntos como duas bases reais |

Os valores de contagem e exemplos acima vêm dos mocks atuais e não são indicadores de uma operação real. A aplicação futura deve começar com cadastros verificados ou dados demonstrativos claramente segregados; converter os mocks em transações reais não está autorizado nem recomendado nesta etapa.

### 11.2 Campos declarados no código sem regra funcional ativa

Os grupos abaixo não entram automaticamente no dicionário. Mostram rastreabilidade e o ponto em que uma extensão precisaria ser validada.

| Origem | Campos existentes porém sem uso completo | Destino/decisão |
| --- | --- | --- |
| Property | street, number, complement, district, municipalRegistration, registryNumber, registryOffice, manager | Endereço estruturado e registro imobiliário: D17/D18; hoje endereco livre é a fonte |
| Unit | code, block, floor, totalArea, municipalRegistration | Código locativo diferente de UNI, bloco/piso/área total: D11/D18; não duplicar nome e código sem regra |
| Tenant | preferredChannel, billingAddress, municipalRegistration | Extensões cadastrais dependem de D18 |
| RealEstateAgency | notes | Observação modelada mas ausente no modal; inclusão não obrigatória |
| Contract | occupancyDate, purpose, paymentReference, adjustmentPeriod, lateFee, monthlyInterest, deliveryChannel, guaranteeType, guaranteeDetails, signatureDate, firstChargeRule, documentName | D03/D05/D16; não criar garantia, assinatura ou penalidade financeira sem regra |
| ContractChargeRule | responsibility, calculation, dueRule, recurrence, proofRequired | Regras futuras de encargo D05, não tabela genérica de regras em JSON |
| Charge | inclusionType | Cobrança complementar/normal D06 |
| ChargeItem/ChargeDraftItem | supportDocumentName, reference atualmente vazio | Referência textual é opcional; evidência documental por item depende de D16 |
| Receipt | creditDate espelhada, discount/interest zero, thirdPartyPayer/proofName/note vazios | D09/D12/D16; não inventar descontos/pagadores na carga |
| ChargeNegotiation | otherReason, downPaymentDueDate, contactName, contactChannel, surchargeBreakdown, agreementDocumentName, notes vazio | D07/D16; vencimento da entrada explicitamente proposto em parcela 0; outros campos aguardam uso/regra |
| Expense | allocationType/allocationId, competence, issueDate, documentType/documentNumber, plannedDate, entryType, recurrence, attachmentName | D08/D12/D16; uma alocação patrimonial genérica sem FK não é importada para o modelo |
| WorkRecord | team/attachments no registro principal | Equipe pertence a E24 e documentos a E36/E37 conforme alcance aprovado; não guardar listas no registro principal |
| LocalDocument | File, objectUrl, extension, typeLabel | File/objectUrl são estado do navegador; extensão/rótulo derivam de nome/MIME; E36 guarda chave durável e metadados verificados |
| REGISTRY_DOCUMENT_TOPICS | Seis categorias de contratos, documentação, fotos, vistoria, manutenção e locação | Utilitário não utilizado no Angular; D16 determina alcance antes de ampliar E37 |
| Constantes de selects | Tipos de imóvel/unidade e formas de pagamento adicionais; lista maior de equipe | Somente opções usadas entram no domínio inicial; diferença é inventariada e validada em D11/D18 |

### 11.3 Plano de conciliação da migração futura

1. Confirmar fonte oficial e separar mocks de dados operacionais reais.
2. Gerar um mapa de identificadores antigos por entidade e escopo da obra; não normalizar pelo nome sem revisão.
3. Resolver a cadeia carteira → imóvel → unidade → contrato → cobrança e todas as FKs antes de inserir movimentos.
4. Validar datas/documentos/domínios e resolver conflitos de ocupação, duplicidade, valores desconhecidos e códigos locais.
5. Não inferir data/conta de recebimentos a partir de totais recebidos. Solicitar fonte ou classificar como saldo de abertura sob modelo aprovado, D09/D10/D19.
6. Reconhecer a duplicação de aportes no financeiro e reconciliar saldo/realizado/reserva das obras.
7. Migrar nomes de arquivos como referências, nunca como uploads concluídos.
8. Conferir totais por obrigação, cota, acordo e obra e produzir relatório de diferenças antes de substituir mocks.

Essas são etapas de planejamento. Não foi criado script de importação ou schema de staging; sua necessidade depende da origem dos dados reais.

## 12. Revisão de normalização e simplicidade

### Problemas eliminados pela proposta

- Nomes deixam de ser FKs: cadastros podem ser renomeados sem romper referências.
- Arrays de unidades, encargos, itens, parcelas, pagamentos, participações e arquivos passam a relações com identidade.
- Carteira/imóvel/locatário não são copiados em cada cobrança como vínculos independentes.
- Valor contratado não é repetido em despesa e contratação; o 1:1 E26 especializa E20, condicionado a D08.
- Fornecedor é separado de objeto/valor da contratação, sem criar cadastro universal de pessoas com atributos não confirmados.
- Função, tarifa e período pertencem à alocação, não ao profissional.
- Participação pertence à obra e à vigência, não ao sócio global.
- Investido, recebido, pendente, saldo e contagens são consultas sobre eventos, não números atualizados em várias tabelas.
- Aporte financeiro não é gravado duas vezes.
- Documentos têm vínculos tipados; auditoria genérica sem FK é uma exceção histórica justificada.
- Não há tabela de `Dashboard`, `ResumoObra`, `Indicador`, `Status` por módulo, `Modal`, `Gráfico` ou `RelatórioXLSX`.

### Redundâncias intencionais ou decisões ainda abertas

| Caso | Por que está no desenho | Condição de controle |
| --- | --- | --- |
| Código + UUID | Identidade técnica e referência humana são papéis distintos | Código nunca é FK nem MAX+1 inseguro |
| Nome/natureza/valor do item emitido vs regra atual | Documento financeiro é uma fotografia | Item emitido imutável; origem opcional e íntegra |
| Cabeçalho de recebimento + valores alocados | Dinheiro e sua destinação têm cardinalidades diferentes | Igualdade das somas na mesma transação |
| Saldo-base e termos de acordo vs parcelas | Termos pactuados e agenda têm finalidades distintas | Agenda deve reconciliar exatamente com termos |
| Valor do aporte + cotas | Solicitação total e obrigações individuais | Soma exata; cotas arredondadas imutáveis |
| Nome pactuado na cota | Snapshot já existente no mock | Não depende de renomear o cadastro |
| Estado corrente + auditoria | Consulta simples e preservação histórica | Atualizar ambos atomicamente |
| Ocupação/progresso/realizado informados | Atualmente são entradas manuais, não simples caches | D03/D10 definem eventual substituição por derivação |
| Conta/forma prevista vs efetiva | Intenção de pagar não comprova pagamento | Não copiar default como fato confirmado |

A proposta não acrescenta cadastros de bancos, centros de custo, planos contábeis, aprovações, orçamento por etapa, estoque, medições, sessões ou permissões editáveis apenas por serem comuns em outros sistemas. E35 pode ser removida integralmente conforme D15. Se E26 deixar de ser 1:1 por decisão de faturas múltiplas, normalizar para contratação própria e obrigações filhas na próxima revisão.

## 13. Mapa geral de relacionamentos

As setas indicam dependência/vínculo, não exclusão em cascata. Partes marcadas D dependem de validação.

```text
USUÁRIOS ── autoria ──> CADASTROS / MOVIMENTOS / AUDITORIA / DIÁRIO

CARTEIRAS 1 ── N IMÓVEIS 1 ── N UNIDADES
                       │             │
                       ├── N CONTRATOS ── N:N via CONTRATO_UNIDADES ──┘
                       │        │
IMOBILIÁRIAS 1 ── N LOCATÁRIOS ─┘
                                ├── N CONTRATO_ENCARGOS
                                └── N COBRANÇAS
                                          ├── N COBRANCA_ITENS ──────────┐
                                          ├── N NEGOCIAÇÕES              │
                                          │        └── N PARCELAS ──────┤
                                          └── N RECEBIMENTOS            │
                                                   └── N ALOCAÇÕES ─────┘
                                                    (um alvo por linha)

FORNECEDORES 1 ── N DESPESAS 1 ── N PAGAMENTOS_DESPESA
                        │
CATEGORIAS ──────────────┤
CONTAS ── previstas/efetivas nas obrigações/movimentos que as informam
                        │
                        └── 0..1 OBRA_CONTRATACOES ── N:1 OBRAS [D08]

IMÓVEIS / UNIDADES ──> OBRAS
PROFISSIONAIS ── responsável ──> OBRAS / ATIVIDADES
OBRAS 1 ── N ATIVIDADES
      ├── N ALOCAÇÕES_EQUIPE ── N:1 PROFISSIONAIS
      │             └── N:N via EQUIPE_ATIVIDADES ── ATIVIDADES
      ├── N OBRA_SOCIOS (versões) ── N:1 SOCIOS [D13]
      ├── N APORTES
      │        └── N COTAS ── N:1 versão de OBRA_SOCIOS
      │                └── N APORTE_PAGAMENTOS
      ├── N AJUSTES_CAIXA
      ├── N DIÁRIO
      ├── N PENDÊNCIAS
      └── N COMPROMISSOS [apenas se D15 confirmar agenda independente]

DOCUMENTOS 1 ── N DOCUMENTO_VINCULOS ──> DESPESA OU PAGAMENTO OU DIÁRIO
DOCUMENTO ── 0..1 versão seguinte ──> DOCUMENTO [D16]
MOVIMENTO ── 0..1 estorno ──> MOVIMENTO da mesma entidade [D09]
```

Leituras resultantes, sem novas tabelas:

- Dashboard de Locações: cadastros + contratos + cobranças/baixas/acordos + despesas da operação, com escopo D20.
- Dashboard de Obras: obras + execução + obrigações + capital, segundo fontes financeiras D10.
- Financeiro da obra: projeção de integralizações, pagamentos de despesa por contratação e ajustes; sem copiar lançamentos.
- Relatório de aluguel: cobranças/itens classificados como aluguel + contrato/patrimônio/locatário; D17/D20 definem reprodução histórica e base de inclusão.

## 14. Ordem recomendada para criação futura das entidades

Esta ordem respeita FKs; não representa autorização para executar migrations. Não confundir ordem técnica de criação com ativação de funcionalidades ainda pendentes.

| Onda | Entidades | Dependências/condições |
| --- | --- | --- |
| 0 | Nenhuma tabela de domínio | Validar D01/D02 e decisões financeiras/relacionais que alteram o esquema |
| 1 | E01 usuarios; E40 usuario_permissoes após o bootstrap Master | Autorreferências de autoria e concessões auditadas; bootstrap identificado |
| 2 | E38 auditoria_eventos; E36 documentos | Dependem de usuários; versões documentais têm FK própria; D16 para arquivos |
| 3 | E02 carteiras; E05 imobiliarias; E07 fornecedores; E08 profissionais; E09 categorias_despesa; E10 contas_financeiras; E27 socios | Cadastros independentes entre si após usuários; validar D08/D11/D12/D13 |
| 4 | E03 imoveis; E06 locatarios | Carteiras e imobiliárias |
| 5 | E04 unidades | Imóveis |
| 6 | E11 contratos; E22 obras | Imóvel, locatário, unidade opcional e profissionais; D03/D04/D11 |
| 7 | E12 contrato_unidades; E13 contrato_encargos; E23 obra_atividades; E24 obra_alocacoes_equipe; E28 obra_socios | Contratos/unidades e obras/profissionais/sócios |
| 8 | E14 cobrancas; E20 despesas; E25 obra_equipe_atividades; E29 aportes; E32 obra_ajustes_caixa; E33 obra_diario; E34 obra_pendencias; E35 obra_compromissos se aprovado | Pais criados; D05/D06/D08/D10/D13/D14/D15 |
| 9 | E15 cobranca_itens; E18 negociacoes; E16 recebimentos; E21 pagamentos_despesa; E26 obra_contratacoes; E30 aporte_cotas | Cobranças, despesas, aportes e participações; D07/D09 |
| 10 | E19 negociacao_parcelas; E31 aporte_pagamentos; E37 documento_vinculos | Negociações, cotas, despesas/pagamentos/diário/documentos |
| 11 | E17 recebimento_alocacoes | Recebimentos, itens e parcelas |
| 12 | Índices/garantias cruzadas e consultas | Regras atômicas completas antes de habilitar escrita; projeções e relatórios após fontes conciliadas |

Despesas e obras possuem dependência circular apenas no sentido funcional de especialização: fisicamente `despesas` não aponta para `obra_contratacoes`, então ambas podem ser criadas nessa ordem. A garantia de existência da especialização ao gravar origem de obra é implementada depois que as duas tabelas existem, com transação/trigger apropriados.

## 15. Cobertura da entrega e validação documental

| Item solicitado | Onde foi atendido |
| --- | --- |
| 1. Lista completa de entidades | Seção 3, E01–E40 (E35 condicionada e não criada) |
| 2. Campos de cada entidade | Seção 4 + conjuntos comuns explícitos da seção 2.2 |
| 3. Tipos de dados | Seções 2.1 e 4 |
| 4. Primary keys | Seção 2.3 e dicionário; duas compostas e uma PK/FK compartilhada |
| 5. Foreign keys | Coluna de observação do dicionário + seção 5.1 |
| 6. Relações 1:1, 1:N e N:N | Seções 5.1 e 13 |
| 7. Associativas | Seção 5.2 |
| 8. Constraints | Dicionário + seção 7, distinguindo garantias locais de transacionais |
| 9. Índices | Seção 9, vinculada aos filtros/consultas |
| 10. Exclusão | Seção 8.1 |
| 11. Dados calculados sem persistência | Seção 6.2 |
| 12. Históricos | Seção 8.2 e entidades E18/E28/E33/E36/E38 |
| 13. Movimentações | E16/E17/E21/E31/E32 + regras de saldo/reversão |
| 14. Decisões pendentes | Seção 10, D01–D20 |
| 15. Inconsistências dos mocks | Seção 11.1 |
| 16. Mapa de relacionamentos | Seção 13 |
| 17. Ordem de criação | Seção 14 |

A revisão de modelagem passou a incluir as concessões de autorização da Fase 4. A conferência estrutural cobre 39 tabelas implementadas (E35 permanece condicionada), incluindo autoria, auditoria e invalidação de sessões após mudanças de acesso.

### Referências do repositório

- [Mapeamento funcional anterior](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/MAPEAMENTO-FUNCIONAL-E-DADOS-MOCKADOS.md).
- [Modelos de Locações](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/models/domain.models.ts) e [dados iniciais](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/data/demo-data.ts).
- [Store e mutações atuais](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/services/app-store.service.ts).
- [Formulários cadastrais ativos](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/shared/components/entity-modal.component.ts).
- [Cobranças, recebimentos e acordos](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/features/rentals/charges.page.ts), [cálculo de negociação](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/utils/charge-negotiation.ts) e [regras do relatório](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/utils/accounting-report.ts).
- [Obras](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/data/works.data.ts), [detalhes e gerador de mocks](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/data/work-details.data.ts) e [ações de obra](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/features/works/work-detail.page.ts).
- [Rateio societário](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/utils/work-partners.ts) e [utilitário documental ainda sem integração às telas](C:/Users/augus/OneDrive/Documentos/projetos/locacoes-recebiveis-modulo-1-instalacao/locacoes-recebiveis-modulo-1/src/app/core/utils/local-documents.ts).
