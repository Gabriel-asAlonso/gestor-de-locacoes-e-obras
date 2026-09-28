# Implementação do banco de dados — Locações e Obras

Data: 14/09/2026. Referência: `MODELAGEM-BANCO-DE-DADOS-PARA-VALIDACAO.md`.

## Resultado

Banco local criado em `.data/locacoes.sqlite`, com **37 entidades de domínio, 398 colunas, 111 foreign keys e 3 migrations aplicadas**. O arquivo SQLite não é versionado. Foram inseridas somente sete categorias estruturais de despesas; nenhum usuário, imóvel, fornecedor, contrato ou movimento fictício foi carregado.

A entidade E35, `obra_compromissos`, continua **não implementada**, porque o próprio modelo condiciona sua existência à decisão D15: agenda independente ou consulta sobre cronograma/pagamentos. As outras 37 entidades do catálogo estão implementadas. As sugestões estruturais do modelo foram adotadas como base desta etapa, conforme a autorização de implementação; funcionalidades adicionais ainda pendentes não foram presumidas.

O front-end permanece com mocks. Não foram criados controllers, endpoints, autenticação, repositories de negócio ou serviços de geração de cobranças/acordos. O módulo `db/` é infraestrutura de persistência, pronto para ser usado pela futura API local Node.

## 1. Arquitetura encontrada e decisão técnica

| Item | Antes | Implementação |
| --- | --- | --- |
| Aplicação ativa | Angular em `src/`; scripts `ng serve`/`ng build` | Preservada |
| Backend em execução | Nenhum backend de negócio; Worker/Vinext remanescente do starter | Nenhum framework ou servidor HTTP adicionado |
| ORM | Configuração Drizzle presente; schema vazio; pacotes locais não declarados no manifesto | Drizzle ORM 0.45.2 e Drizzle Kit 0.31.10 declarados e travados no lockfile |
| Banco | Dialeto SQLite em `drizzle.config.ts`; D1 opcional, sem binding ativo | SQLite local com `node:sqlite`; mesmo ORM e dialeto |
| Conexão | `db/index.ts` importava `cloudflare:workers`, não disponível no Angular/Node local | Entrada de persistência local; variável `DATABASE_PATH` |
| Migrations | Journal Drizzle vazio | SQL versionado, aplicado explicitamente por runner transacional |
| Models | Apenas interfaces/mock models do front-end | Models Drizzle de persistência separados, com tipos de leitura/inserção inferidos |
| Repositories/seeds | Não existentes para o domínio | Nenhum repository de negócio; seed estritamente estrutural |
| Convenções | IDs/códigos visuais e nomes em inglês no mock; modelagem em português | Tabelas/colunas em português `snake_case`, conforme a modelagem |

**Limite de ambiente:** isto cria um banco real **local**, não provisiona um banco Cloudflare D1 remoto. O binding de hospedagem continua desativado. Os exemplos D1 e o Worker legado não são o backend ativo nem fazem parte do build Angular; seu uso futuro exige adaptar o acesso transacional à plataforma e validar compatibilidade, não simplesmente trocar a URL. O antigo helper `getDb()` do starter foi substituído pela entrada `openDatabase()`; os exemplos opcionais D1 não são pontos de integração prontos desta implementação.

O adaptador local utiliza a interface oficial `drizzle-orm/sqlite-proxy` sobre `node:sqlite`, já que a versão estável instalada do Drizzle não possui o adaptador `node-sqlite` apresentado por documentação de versões mais recentes. Não foi introduzido outro ORM ou pacote nativo de banco. A implementação do protocolo de retorno, as consultas relacionais e a conversão decimal foram verificadas pelos testes.

## 2. Ambiente e comandos

Requisito do projeto: **Node.js >= 24.15.0**. Validação realizada com **24.19.0**. O `node` originalmente no PATH desta máquina era 22.20.0; os testes/build desta etapa foram executados com o runtime 24.19.0 disponível no ambiente. Para reproduzir no terminal, confira `node --version` antes dos comandos abaixo.

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run db:check
npm run db:typecheck
npm run test:db
npm test
```

`.env.example` contém:

```dotenv
DATABASE_PATH=./.data/locacoes.sqlite
```

Sem `.env`, o mesmo caminho local é o padrão. Os comandos de banco carregam `.env` quando presente, sem sobrescrever variáveis já definidas no processo. Para outro banco de desenvolvimento:

```powershell
$env:DATABASE_PATH = './.data/desenvolvimento.sqlite'
npm run db:migrate
npm run db:seed
npm run db:check
```

SQLite é um arquivo local: host, porta, usuário e senha de servidor **não se aplicam**. Nenhuma credencial real foi gravada. Textos usam UTF-8; datas de negócio usam `YYYY-MM-DD`; instantes usam UTC canônico com milissegundos, `YYYY-MM-DDTHH:mm:ss.sssZ`. A escolha de fuso de exibição/retroatividade permanece D19.

Toda conexão ativa foreign keys, timeout de bloqueio de 5 segundos, WAL e triggers recursivos. Escritas usam `BEGIN IMMEDIATE`. Cada operação concorrente deve ter sua própria conexão; não compartilhar uma conexão entre transações simultâneas. O arquivo e sua pasta devem ser acessíveis apenas ao processo backend/administrador autorizado. `db/local.ts` e o arquivo SQLite não pertencem ao bundle do navegador.

## 3. Entidades criadas

| Entidade da modelagem | Tabela | Estratégia de histórico/exclusão |
| --- | --- | --- |
| E01 | usuarios | Inativação; autoria protegida por FK |
| E02 | carteiras | Inativação |
| E03 | imoveis | Inativação; transferência histórica protegida |
| E04 | unidades | Inativação; imóvel congelado após uso contratual |
| E05 | imobiliarias | Inativação |
| E06 | locatarios | Inativação |
| E07 | fornecedores | Inativação |
| E08 | profissionais | Inativação; não exige login |
| E09 | categorias_despesa | Inativação; catálogo estrutural |
| E10 | contas_financeiras | Inativação; nenhum saldo armazenado |
| E11 | contratos | Estados; exclusão física somente de rascunho sem dependências |
| E12 | contrato_unidades | PK composta; alteração somente em rascunho |
| E13 | contrato_encargos | Regra identificável; alteração/exclusão restrita após emissão |
| E14 | cobrancas | Emissão imutável |
| E15 | cobranca_itens | Composição e snapshots imutáveis |
| E16 | recebimentos | Movimento imutável + estorno integral |
| E17 | recebimento_alocacoes | Alocação imutável com FK tipada |
| E18 | negociacoes | Versões imutáveis; fechamento de vigência |
| E19 | negociacao_parcelas | Parcelas imutáveis; entrada prevista em número zero |
| E20 | despesas | Obrigação preservada; valor/credor protegidos após pagamento |
| E21 | pagamentos_despesa | Movimento imutável + estorno integral |
| E22 | obras | Estados; dependentes bloqueiam exclusão física |
| E23 | obra_atividades | Alterações auditadas; exclusão física bloqueada |
| E24 | obra_alocacoes_equipe | Remoção lógica em `removida_em` |
| E25 | obra_equipe_atividades | PK composta; vínculo auditado |
| E26 | obra_contratacoes | PK/FK `despesa_id`; preserva a obra de origem |
| E27 | socios | Cadastro inativável separado da participação |
| E28 | obra_socios | Versões, `inicio_vigencia`/`fim_vigencia`; sem sobrescrever percentual |
| E29 | aportes | Solicitação imutável, não entrada de caixa |
| E30 | aporte_cotas | Valor pactuado imutável por participação histórica |
| E31 | aporte_pagamentos | Integralização imutável + estorno integral |
| E32 | obra_ajustes_caixa | Ajuste assinado + reversão oposta |
| E33 | obra_diario | Append-only; retificação por nova entrada |
| E34 | obra_pendencias | Resolução com data e ator |
| E35 | **Não criada** | Condicionada a D15, sem omissão silenciosa |
| E36 | documentos | Referência/disponibilidade/retirada; novas versões |
| E37 | documento_vinculos | Vínculos históricos e FKs reais |
| E38 | auditoria_eventos | Append-only; exclui credenciais dos snapshots |

Os conjuntos P/A/U/I/R do modelo estão expandidos nos models e no SQL. Nenhum `deleted_at` foi adicionado indiscriminadamente. Todas as FKs de domínio usam **ON DELETE RESTRICT / ON UPDATE RESTRICT**; não há cascata financeira nem `SET NULL` automático. Inativação não filtra dados magicamente: futuras consultas cadastrais devem selecionar `ativo=true`, enquanto históricos continuam acessando registros inativos.

Há três tabelas **técnicas**, fora das 37 entidades: `__drizzle_migrations` (histórico/checksums), `__write_context` (contexto transitório de uma escrita) e `__transaction_end` (sentinela vazia para obrigar fechamento da transação). Elas não representam novos cadastros ou funcionalidades de negócio. Há também duas views técnicas de validação, sem saldos materializados.

## 4. Migrations

| Arquivo | Finalidade |
| --- | --- |
| `drizzle/0000_estrutura_inicial.sql` | 37 tabelas, campos, PKs, FKs, defaults, unicidades, CHECKs e índices; tabelas em ordem de dependência antes dos índices |
| `drizzle/0001_integridade_e_auditoria.sql` | Contexto transacional, sentinela, invariantes entre registros, auditoria automática, imutabilidade, proteção histórica e novos vínculos com cadastros ativos |
| `drizzle/0002_refinamentos_de_integridade.sql` | Validação proporcional do rateio sem overflow intermediário, transições contratuais/de obra, preservação da obra da contratação e proteção de autoria/segredos na auditoria |
| `drizzle/rollback/*.sql` | Reversão explícita de cada migration em ordem inversa, usada somente em banco vazio descartável |
| `drizzle/meta/_journal.json` e `0000_snapshot.json` | Journal e fotografia de schema Drizzle para futuras diferenças estruturais |

`npm run db:migrate` usa `db/migrations.ts`: abre uma transação, verifica se o histórico aplicado é um prefixo exato do journal, confere SHA-256, executa apenas migrations pendentes e registra sua aplicação. Falhas revertem DDL e histórico juntos. A abertura normal de conexão **não executa migrations nem cria schema de domínio**.

Não usar `drizzle-kit push`/schema sync em produção. Gerar mudanças futuras com `npm run db:generate`, revisar o SQL e adicionar migrations SQL explícitas para alterações de triggers/regras cruzadas. **O runner deste projeto é `db:migrate`, não `drizzle-kit migrate`**, pois o contrato de histórico inclui tag/checksum e validação própria. Não misturar runners no mesmo arquivo SQLite.

Foi encontrada uma limitação no gerador Drizzle Kit 0.31.10 para índices de expressão contendo vírgulas: ele interpretou partes de `replace(...)` como nomes de colunas. Na migration inicial, as expressões foram renderizadas do próprio AST do ORM, e o SQL foi validado em SQLite. `scripts/build-integrity-migration.mjs` registra a compilação inicial e a ordenação; **não deve ser executado para reescrever migrations já aplicadas**. Novas correções são novas migrations, como a 0002. Gerar novamente o schema no fim da validação não apontou mudanças de tabelas.

### Rollback

```powershell
# Somente para um arquivo de desenvolvimento vazio, sem seed ou dados:
$env:DATABASE_PATH = './.data/rollback-vazio.sqlite'
npm run db:migrate
npm run db:rollback
```

O comando exige modo `--empty-only` e recusa qualquer registro de domínio **ou auditoria**, incluindo o seed. Não é uma ferramenta para apagar um banco em uso. Nos testes: aplicar em memória, reverter todas as migrations, conferir ausência de tabelas/views/triggers/índices e reaplicar passou. Para produção com dados, uma reversão depende de estratégia específica de preservação/backup, fora desta etapa.

## 5. Relacionamentos e integridade

As FKs estão no schema Drizzle e nas migrations; `db/relations.ts` configura navegação das relações de negócio. Models de leitura/inserção são inferidos do schema, não interfaces independentes que possam divergir.

- Carteira 1:N imóveis; imóvel 1:N unidades/contratos/obras; locatário 1:N contratos.
- Contrato N:N unidades por `contrato_unidades`; contrato 1:N encargos e cobranças.
- Cobrança 1:N itens/recebimentos/versões de negociação; negociação 1:N parcelas.
- Recebimento 1:N alocações; cada alocação aponta a **um item ou uma parcela**, nunca ambos e nunca apenas a um ID textual sem FK.
- Fornecedor 1:N despesas; despesa 1:N pagamentos; despesa 1:0..1 contratação de obra, com PK compartilhada.
- Obra N:N profissionais por alocações com período/função/custo; alocação N:N atividades por associativa própria.
- Obra N:N sócios por versões de participação; aporte 1:N cotas; cota 1:N integralizações.
- Documento 1:N vínculos, com exatamente um alvo entre despesa, pagamento de despesa e diário; documento 1:0..1 versão seguinte.
- Movimentos possuem autorreferência de estorno única, sem apagar o original.

### Garantias por linha e índices

O banco valida campos obrigatórios, textos não vazios, limites de tamanho, UUIDs canônicos, tipos inteiros reais, datas válidas, UTC canônico, domínios de status, percentuais, valores positivos/não negativos, períodos, XOR de alvos, pares data/autor, metadados documentais e defaults.

Unicidades incluem códigos globais/locais nos escopos do modelo, e-mail de acesso por `lower(trim(...))`, documento de locatário por tipo + documento sem máscara, documento de imobiliária sem máscara, nome de unidade por imóvel, ordem de composição, parcela por acordo, cobrança por contrato/competência, referência de estorno e uma versão corrente por cobrança/participação.

Normalização SQL de nomes/e-mail usa o `lower` nativo do SQLite; não promete equivalência linguística/acento-insensível Unicode. Documento normaliza pontuação/espaços e caixa, sem impor cálculo de dígitos verificadores ou converter documentos de pessoas distintas em uma identidade única. Essas regras de cadastro permanecem D18.

Índices de leitura cobrem carteira→imóveis, imóvel/ocupação→unidades, locatário/imóvel→contratos, competência→cobranças, vencimentos de itens/despesas, datas de pagamentos, composição por pai, alocações por destino, obra/responsável/estado, cronograma, diário, participações por obra e por sócio, cotas, documentos por alvo e auditoria por registro. PKs/UNIQUE existentes não são duplicados por índices equivalentes. O banco possui 130 índices ao todo, **incluindo os automáticos de PK/UNIQUE e os técnicos**; não são 130 índices de busca adicionados arbitrariamente.

### Garantias que precisam do conjunto completo

Antes do commit, o SQLite verifica a composição completa:

- unidades/encargos/equipe pertencem aos pais corretos;
- contrato ativo tem unidade; cobrança tem item;
- recebimento está integralmente alocado à mesma cobrança;
- nenhum item, parcela, despesa ou cota é pago acima do saldo;
- estorno integral preserva valor, obrigação e composição; estornar estorno/duplicar estorno é rejeitado;
- acordo usa saldo efetivamente restante, mantém a cadeia e possui soma, quantidade e calendário de parcelas coerentes;
- nova baixa não utiliza obrigação substituída; estorno que invalida base de acordo posterior é bloqueado;
- contratação de obra e despesa especializada existem juntas;
- participações não se sobrepõem para o mesmo sócio/obra, soma corrente não supera 100% e aporte exige quadro completo;
- cotas mantêm obra, sócio único, soma exata e valor proporcional dentro do arredondamento em centavos;
- códigos de pagamentos de aporte respeitam o escopo da obra, mesmo alcançada por outras FKs.

Uma FK diferida da tabela de contexto aponta para uma sentinela que deve ficar vazia. Assim, não se consegue commitar enquanto o contexto estiver aberto. Apagar o contexto dispara as validações; se alguma falhar, a transação não pode ser concluída. Essa combinação foi testada também por SQL direto e por dois processos concorrentes, não apenas por validação no navegador.

As views verificam o estado relacional completo; não foi realizado benchmark de grande volume. A futura otimização pode restringir verificações aos agregados tocados, mas deve preservar as mesmas garantias e os testes de concorrência. Não houve implementação de um serviço de negócio disfarçado de migration.

## 6. Auditoria e uso pela futura API

O padrão de acesso fica em `db/index.ts`/`db/local.ts`. Leitura não pode escrever. Toda escrita exige `database.transaction(context, callback)` e uma conexão dedicada. Exemplo técnico de edição, sem endpoint:

```typescript
import { openDatabase } from './db/index.ts';
import { fornecedores } from './db/schema.ts';
import { eq } from 'drizzle-orm';

const database = openDatabase();
try {
  await database.transaction({ actorId: usuarioAutorizadoId }, async (db, audit) => {
    await db.update(fornecedores).set({
      nome: novoNome,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
    }).where(eq(fornecedores.id, fornecedorId));
  });
} finally {
  database.close();
}
```

Os IDs e nomes acima são parâmetros do futuro backend, não variáveis fornecidas por um usuário anônimo. Autenticar e autorizar o chamador ainda será responsabilidade da futura API. O caminho `system` existe para seed/bootstrap/importação identificada e **não deve ser aceito de payload externo**. Não há administrador padrão, senha conhecida ou login implementado.

Inserções humanas devem informar `created_by` e, quando houver U, `updated_by` com o ator da transação. Atualizações devem usar `audit.updated_at`, obtido do relógio SQLite no momento do acesso. Triggers produzem os eventos de criação/alteração/exclusão na mesma transação, preservando antes/depois, chave simples ou composta e contexto/motivo. A identidade/autor de criação não pode ser sobrescrita. Snapshots não copiam `senha_hash`; chaves de credenciais conhecidas também são recusadas em inserções explícitas de auditoria.

As FKs protegem quem foi autor, mas não substituem autenticação. Perfis permanecem um código fixo explicitamente atribuído, como no modelo; a definição de credencial e permissões é D02. `senha_hash` está presente e nullable conforme o dicionário, sem escolha de algoritmo, emissão de senha ou uso no login. Se a autenticação for externa, esse campo deve ser substituído conforme D02.

## 7. Valores financeiros e dados derivados

| Tipo lógico | Representação SQLite | Representação no model |
| --- | --- | --- |
| DECIMAL(15,2), BRL | INTEGER de centavos, até 999.999.999.999.999 | String decimal, por exemplo `"1234.56"` |
| DECIMAL(5,2), percentual | INTEGER em centésimos de ponto percentual, 0–10.000 | String decimal, por exemplo `"60.00"` |
| DECIMAL(12,2), área/quantidade | INTEGER de centésimos, limite coerente com 12 dígitos | String decimal, por exemplo `"12.50"` |
| UUID | TEXT canônico com CHECK | String UUID |
| DATE / TIMESTAMP UTC | TEXT canônico validado | String sem conversão implícita de fuso |
| BOOLEAN | INTEGER com CHECK 0/1 | Boolean do Drizzle |

`db/fixed-point.ts` usa BigInt para converter strings; rejeita `number`, notação exponencial, mais de duas casas e precisão excedida. Só converte centavos para `number` no limite do driver quando são inteiros exatamente representáveis; ao ler, rejeita inteiros inexatos. Não usa `parseFloat`, `valor * 100` em ponto flutuante ou arredondamento implícito de dinheiro. SQL direto trabalha em centavos, não em reais.

Nenhuma coluna de total pago, saldo, dívida restante, caixa, quantidade de registros ou status de vencimento foi criada. Eles serão consultas/cálculos a partir das fontes. Valores pactuados de itens/parcelas/cotas permanecem armazenados; são snapshots legítimos. `ocupada_informada`, progresso e realizado da obra permanecem armazenados porque são entradas manuais independentes no sistema atual.

Entrada de negociação é **prevista**, não recebida. A criação do acordo não insere recebimento. Solicitação de aporte também não insere dinheiro no caixa. Pagamento de fornecedor e realizado manual da obra não são somados automaticamente. Nenhum movimento financeiro foi duplicado em uma tabela genérica de lançamentos.

## 8. Seeds

`db/seed.ts` insere apenas: Condomínio, Manutenção, Seguros, Telecom, Tributos, Utilidades e Outros. São códigos de domínio necessários para classificar despesas existentes na especificação, não despesas fictícias. A execução é transacional, auditada e idempotente por código; não sobrescreve um cadastro existente.

Permanecem vazios: usuários, perfis adicionais, contas financeiras, fornecedores, profissionais, patrimônio, contratos, obras, documentos e todo o financeiro. Não se importaram os saldos inconsistentes dos mocks, não se inventaram comprovantes e não se converteram nomes demonstrativos em contas bancárias reais.

## 9. Comparação final e pendências

| Tema/modelagem | Implementado nesta etapa | Limite/decisão restante |
| --- | --- | --- |
| Catálogo E01–E38 | 37 entidades e todos os campos do dicionário correspondente | E35 aguarda D15; nenhuma outra tabela omitida |
| D01 — banco/isolamento | SQLite local, Drizzle, instalação única, precisão fixa | Sem provisionamento D1, multitenancy ou validação de ambiente remoto |
| D02 — acesso | Usuário inativo por padrão, código de perfil fixo, autoria real | Autenticação, credencial/provedor e matriz de permissões não implementados |
| D03 — ocupação | Coluna manual preservada; vínculo contratual íntegro | Exclusividade de contratos simultâneos não presumida |
| D04 — ciclos | Estados e proteções de transição de contrato/obra, sem reabertura implícita | Reaberturas/correções/aditivos exigem definição e nova implementação |
| D05 — geração | Regras, itens emitidos, ordens, valores e períodos íntegros | Não implementa geração automática, índices econômicos ou cobrança de encargos sem valor |
| D06 — emissão | UNIQUE contrato/competência | Cobranças complementares, cancelamento e reemissão precisam rever a chave |
| D07 — acordos | Uma cobrança, versões, parcelas, entrada prevista, saldo-base e recebimentos separados | Política de vencimento da entrada e consolidação de várias cobranças não presumidas; data deve ser fornecida |
| D08 — despesas/fornecedores | Base compartilhada, contratação 1:1 e pagamento de uma obrigação | Várias faturas/medições por contratação ou pagamento em lote alterariam o modelo |
| D09 — correções | Somente estorno integral, auditado, bloqueando dependências posteriores | Aprovação/permissão de estorno, reversão parcial e cancelamentos não implementados |
| D10 — obra/caixa | Campos manuais preservados, movimentos separados | Sem fórmula que confunda realizado manual, custo previsto e caixa |
| D11 — execução | FKs de profissionais, cronograma e equipe; períodos locais válidos | Responsável não exige login; não impõe prazo interno à obra; ações futuras não viraram serviços |
| D12 — contas | Contas opcionais onde previstas; nenhum default fictício | Obrigatoriedade bancária, data de crédito independente e terceiros permanecem pendentes |
| D13 — participação/rateio | Cadastro global, versões, soma, cotas históricas e proteção proporcional exata | Algoritmo de escolha dos centavos residuais, retroatividade e saída com dívida ficam para definição/API; o banco rejeita rateio inválido |
| D14 — pendências | Resolução preservada com data/ator | Não transforma atraso calculado em pendência automaticamente |
| D15 — agenda | Não criada | Definir se é cadastro independente ou projeção |
| D16 — arquivos | Metadados, versões e três alvos com FKs | Sem upload, storage remoto, política de retenção ou novos módulos documentais |
| D17 — histórico cadastral | Auditoria, snapshots financeiros e proteção de vínculos contratuais | Relatório documental reproduzindo todos os nomes/endereço da emissão ainda depende de decisão |
| D18 — cadastros | Unicidades propostas e normalização básica implementadas | Validação de documentos e equivalência Unicode completa não presumidas |
| D19 — datas | DATE de negócio e timestamps UTC reais | Fuso visual, retroatividade e eventuais importações serão explícitos |
| D20 — relatórios | Fontes financeiras normalizadas, sem caches duplicados | Sem consultas finais de relatórios/KPIs por emissão ou caixa nesta etapa |
| Sequências de códigos | UUID gerado pelo banco, códigos com escopo e UNIQUE | Código legível deve ser fornecido na inserção; futura API o atribuirá sob transação. Não foi criado serviço de numeração fora do escopo |
| Auditoria técnica | Automática e transacional, com duas estruturas técnicas transitórias | Adaptação física além do catálogo, justificada para garantir commits íntegros no SQLite |

Diferenças físicas não são remoção de informação: DECIMAL virou inteiro escalado conforme a alternativa expressamente prevista na seção 2.1 do modelo; UUID/data/hora viraram textos validados; SMALLINT usa INTEGER validado; enums usam TEXT + CHECK. Defaults condicionais como usuário autenticado, próximo código/versão e nome pactuado são fornecidos pela escrita transacional, não dados fictícios inseridos pelo banco.

## 10. Verificação executada

- **25 testes de banco passaram:** criação a partir de arquivo/memória vazios; aplicação repetida; rollback vazio e reaplicação; recusa de rollback com dados; comparação do dicionário/ORM/SQLite; CRUD; leitura relacional; campos obrigatórios, unicidade, FK, CHECK, datas e tipos; inativação; auditoria; pagamentos parciais, estornos, alocação exata e excesso; negociação e substituição; sócios/rateio; anexos; transições; duas escritas concorrentes reais em workers separados.
- **22 testes existentes passaram**, inclusive relatório XLSX, negociação, rateio, documentos, rotas e HTML compilado.
- **Build Angular de produção passou**; aproximadamente 2,01 MB de bundle inicial, dentro do orçamento configurado.
- **Typechecks de banco e aplicação passaram**.
- **Banco local:** `integrity_check=ok`, nenhuma FK inválida ou violação das views de integridade; sete categorias e seus sete eventos de auditoria, sem dados fictícios.
- Auditoria estrutural comparou as 37 tabelas com o catálogo, campos, tipos físicos, nullable, existência de defaults, PKs, todas as FKs/ações, CHECKs e índices declarados. A entidade condicional E35 foi tratada explicitamente, não ignorada.

O build precisou de permissão ampliada de leitura do ambiente Windows para o compilador resolver os caminhos locais; não houve alteração de código da interface para contornar isso. Não se iniciou backend HTTP porque ele não existe nesta etapa e sua criação foi expressamente excluída do pedido. A inicialização da camada de persistência foi exercitada pelo CLI e pelos testes.

### Referências técnicas

O comportamento do driver e das transações foi confrontado com a versão instalada e com as fontes primárias: [Node.js — SQLite](https://nodejs.org/api/sqlite.html), [Drizzle — SQLite proxy](https://orm.drizzle.team/docs/connect-drizzle-proxy) e [Drizzle — transações](https://orm.drizzle.team/docs/transactions). A fonte funcional continua sendo o repositório/modelagem, não exemplos genéricos dessas bibliotecas.
