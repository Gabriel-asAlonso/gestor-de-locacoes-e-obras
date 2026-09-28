# Mapeamento funcional e de dados mockados

## 1. Escopo e critério do levantamento

Este documento retrata a aplicação executável atual sem propor nem implementar API, banco de dados ou services reais.

- A aplicação ativa é a versão Angular iniciada por `src/main.ts`, configurada em `angular.json` e roteada por `src/app/app.routes.ts`.
- A pasta `app/` contém uma implementação React/Vinext anterior. Ela não participa do build Angular atual. Seus mocks e utilitários duplicados foram registrados na seção de arquitetura e pendências, mas não foram tratados como telas ativas.
- `db/schema.ts` está intencionalmente vazio. `db/index.ts`, `worker/index.ts`, os artefatos Drizzle e o exemplo D1 não são usados pelo fluxo Angular atual.
- Todos os dados funcionais ativos residem em sinais Angular do `AppStore`. As alterações duram somente enquanto a aplicação permanece carregada; recarregar a página restaura os mocks.
- As datas de referência funcionais estão congeladas em `2026-08-12` para Locações e `2026-08-24` para Obras. Portanto, “vencido”, “próximo”, “hoje” e textos semelhantes não representam o relógio real.
- Não foram encontrados endpoints, chamadas HTTP, persistência local, integração bancária, envio de e-mail, upload remoto ou autorização baseada em perfil.

### Rotas ativas

| Rota | Tela | Proteção |
| --- | --- | --- |
| `/login` | Acesso | Pública |
| `/inicio` | Visão geral de Locações | `authGuard` |
| `/carteiras` | Carteiras | `authGuard` |
| `/imoveis` | Imóveis | `authGuard` |
| `/unidades` | Unidades | `authGuard` |
| `/locatarios` | Locatários e imobiliárias | `authGuard` |
| `/contratos` | Contratos | `authGuard` |
| `/cobrancas` | Cobranças, recebimentos, acordos e relatório | `authGuard` |
| `/despesas` | Despesas | `authGuard` |
| `/obras/inicio` | Painel de obras | `authGuard` |
| `/obras` | Todas as obras | `authGuard` |
| `/obras/nova` | Nova obra | `authGuard` |
| `/obras/:id/editar` | Editar obra | `authGuard` |
| `/obras/:id` | Detalhe operacional da obra | `authGuard` |

### Fontes dos mocks ativos

| Fonte | Conteúdo |
| --- | --- |
| `src/app/core/data/demo-data.ts` | 2 carteiras, 8 imóveis, 14 unidades, 5 locatários, 3 imobiliárias, 4 contratos, 5 cobranças, 6 despesas, imagens e listas de opções |
| `src/app/core/data/works.data.ts` | 8 obras, 5 alertas/prioridades e 5 compromissos |
| `src/app/core/data/work-details.data.ts` | Gerador de cronograma, equipe, fornecedores, sócios, aporte, financeiro, diário e pendências para cada obra existente |
| `src/app/core/services/app-store.service.ts` | Cópia em memória dos mocks, acordos e recebimentos inicialmente vazios e detalhes de obra materializados sob demanda |
| Componentes | Usuário, credenciais, datas, textos, opções de select e valores padrão fixos |

---

## 2. Acesso e navegação compartilhada

### Telas

- Login.
- Shell autenticado com seletor dos módulos “Locações” e “Obras”, menu lateral, breadcrumb, estado de conexão e conta do usuário.

### Funcionalidades

- Validar presença/formato básico de e-mail e presença da senha.
- Simular autenticação após 650 ms.
- Redirecionar para a URL originalmente solicitada ou para `/inicio`.
- Alternar módulos, recolher/abrir o menu e sair.
- Detectar eventos `online` e `offline` do navegador.

### Ações disponíveis

- Entrar, sair, trocar de módulo, navegar e abrir/fechar o menu.
- Não existem recuperação de senha, troca de senha, cadastro de usuário, MFA ou gerenciamento de perfil.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| E-mail | texto/e-mail | Sim | Padrão fixo `gestor@atlas.com.br` | Valida `required` e formato de e-mail; o valor não é conferido contra usuário real |
| Senha | texto secreto | Sim | Padrão fixo `gestor123` | Só valida presença |
| Autenticado | booleano | N/A | Sinal em memória | Inicializa `false`; não há token nem sessão persistida |
| Nome exibido | texto | N/A | Fixo `Augusto Lima` | Não vem do login |
| Perfil exibido | texto | N/A | Fixo `Administrador` | Apenas visual |
| Conectividade | booleano | N/A | `navigator.onLine` | Não confirma disponibilidade de API |
| Contadores do menu | número | N/A | Tamanho dos arrays do `AppStore` | Atualizam com cadastros em memória |

### Relacionamentos

- O guard relaciona o estado booleano de autenticação a todas as rotas internas.
- O shell consome os contadores das entidades de Locações e Obras.

### Filtros e paginação

- Não aplicável.

### Regras de negócio

- Formulário inválido não autentica.
- Qualquer e-mail sintaticamente válido e qualquer senha não vazia autenticam.
- O logout remove apenas o booleano autenticado; os dados alterados no `AppStore` continuam na sessão carregada.
- Situação atual: autenticação simulada; autorização não implementada.

### Perfis e permissões

- Existe somente a legenda visual “Administrador”.
- Não há entidade de usuário, lista de perfis, matriz de permissões, restrição por tela ou ação, nem validação no código além do `authGuard` booleano.

### Dependências com outros módulos

- É a porta de entrada para todos os módulos.

### Pendências encontradas

- Credenciais e identidade estão fixas e desconectadas.
- Não existe sessão persistente nem validação de retorno seguro além da navegação interna do Angular.
- O indicador “Dados atualizados/Sincronizado” é inferido só da conectividade do navegador.
- Regra de perfis e permissões ainda não definida.

---

## 3. Locações — Visão geral

### Telas

- Painel executivo em `/inicio`.

### Funcionalidades

- Consolidar faturamento, recebimentos, saldo em aberto, despesas a pagar e resultado operacional previsto.
- Exibir cobranças vencidas, ocupação, contas pendentes, carteiras, contratos, unidades disponíveis e aluguel mensal.
- Exibir imóvel em destaque e gráficos circulares de ocupação e pulso operacional.
- Navegar pelos cards para contratos, cobranças, despesas, carteiras, imóveis e unidades.

### Ações disponíveis

- Somente consulta e navegação. Não há edição direta, filtro ou exportação.

### Dados utilizados

| Campo/indicador | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| Período do painel | texto | N/A | Fixo `AGOSTO · 2026` | Não acompanha data ou filtro |
| Faturado | moeda | N/A | Soma de todos os itens das cobranças | Inclui qualquer status |
| Recebido | moeda | N/A | Soma do campo `received` dos itens | Não lê lançamentos bancários |
| Saldo em aberto | moeda | N/A | Saldo original ou saldo negociado | Usa acordos/recebimentos em memória |
| Despesas a pagar | moeda | N/A | Soma de despesas diferentes de `Pago` | Sem recorte de competência |
| Resultado operacional previsto | moeda | N/A | Saldo em aberto menos despesas a pagar | Não é fluxo de caixa realizado |
| Cobranças vencidas | número/moeda | N/A | Cobranças com status `Vencida` | Status pode estar congelado |
| Carteiras/imóveis/contratos/unidades | número | N/A | Contagem dos arrays | Não há escopo por usuário |
| Aluguel mensal | moeda | N/A | Soma de `rent` dos contratos | Todos são apresentados como ativos |
| Ocupadas/disponíveis/ocupação | número/% | N/A | `Unit.occupied` | Não é recalculado pelo período |
| Imóvel em destaque | imagem/texto | N/A | Dados fixos do Centro Empresarial Nexo | Texto não é derivado integralmente do store |

### Relacionamentos

- Agrega Carteiras, Imóveis, Unidades, Contratos, Cobranças, Acordos, Recebimentos e Despesas.

### Filtros e paginação

- Não existem filtros, ordenação ou paginação.

### Regras de negócio

- `resultado = saldo operacional das cobranças - despesas não pagas`.
- `ocupação = unidades ocupadas / total de unidades`, arredondada para inteiro.
- `aluguel mensal = soma do aluguel de todos os contratos`.
- Situação atual: implementadas sobre dados em memória, sem período contábil real.

### Perfis e permissões

- Qualquer usuário autenticado visualiza tudo.

### Dependências com outros módulos

- Deve ser implementado depois das fontes transacionais que consolida.

### Pendências encontradas

- Período e imóvel em destaque são estáticos.
- “Contratos ativos” não é calculado por vigência ou status; todo contrato conta.
- Mistura valores de todas as competências.
- Resultado previsto não considera aportes, fornecedores ou ajustes do módulo Obras.

---

## 4. Carteiras

### Telas

- Listagem tabular de carteiras.
- Drawer de detalhes.
- Modal compartilhado para criar e editar carteira.

### Funcionalidades

- Consultar, pesquisar, cadastrar, editar e visualizar detalhes.
- Exibir quantidade de imóveis/unidades e ocupação consolidada.

### Ações disponíveis

- Nova carteira, editar, abrir/fechar detalhes.
- Excluir, importar, exportar e ordenar não existem.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('CAR')` | Ex.: `CAR-001` |
| `name` | texto | Sim | Mock/formulário | Chave textual usada por imóveis/unidades/contratos/cobranças |
| `holder` | texto | Sim | Mock/formulário | Titular |
| `document` | texto | Sim | Mock/formulário | Sem máscara ou validação CPF/CNPJ ativa |
| `properties` | número | Não editável | Mock ou zero em novo registro | Pode prevalecer sobre a contagem calculada |
| `units` | número | Não editável | Mock ou zero em novo registro | Pode prevalecer sobre a contagem calculada |
| `manager` | texto | Não | Formulário | Drawer usa `Núcleo Patrimonial` como fallback |
| `description` | texto longo | Não | Formulário | Não aparece na listagem/drawer |
| `notes` | texto longo | Não | Formulário | Não aparece na listagem/drawer |

Validações: somente presença de nome, titular e documento. Limites de caracteres e unicidade: regra ainda não definida.

### Relacionamentos

- Carteira 1:N Imóveis, localizada por igualdade de nome.
- Carteira 1:N Unidades, Contratos e Cobranças, também por nome.
- Para manter o vínculo atual são necessários o `name` da carteira e os campos textuais correspondentes nos registros dependentes.

### Filtros e paginação

- Pesquisa por nome da carteira, titular ou documento; ignora acentos e maiúsculas/minúsculas.
- Sem filtros adicionais, ordenação ou paginação.
- Rodapé informa `filtrados de total`.

### Regras de negócio

- Contagens no drawer são recalculadas pelos vínculos textuais.
- Na tabela, `properties`/`units` mockados diferentes de zero prevalecem; só zero aciona a contagem calculada.
- Situação atual: cadastro/edição implementados apenas na memória.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- É cadastro-base para Imóveis, Contratos, Cobranças e relatórios.

### Pendências encontradas

- Renomear uma carteira não propaga o novo nome aos registros dependentes.
- Contadores armazenados podem divergir dos relacionamentos calculados.
- Não há validação de documento, duplicidade ou exclusão com integridade referencial.

---

## 5. Imóveis

### Telas

- Grid visual de imóveis.
- Drawer de detalhes.
- Modal compartilhado para criar e editar imóvel.

### Funcionalidades

- Consultar, pesquisar, filtrar por carteira, cadastrar, editar e visualizar detalhes.
- Calcular disponibilidade e ocupação por imóvel.

### Ações disponíveis

- Novo imóvel, editar, abrir/fechar detalhes.
- Não há exclusão, importação, exportação ou navegação direta para as unidades do imóvel.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('IMO')` | Também seleciona a imagem estática |
| `portfolio` | seleção/texto | Sim | Carteiras do store | Vínculo por nome |
| `name` | texto | Sim | Mock/formulário | Chave textual para unidades, contratos, cobranças e obras |
| `address` | texto | Sim | Mock/formulário | Endereço inteiro em um único campo |
| `units` | número | Não editável | Mock ou zero | Pode divergir da contagem real |
| `propertyType` | seleção | Não | Padrão `Edifício comercial` | Opções: edifício, centro comercial, complexo logístico, outro |
| `cep` | texto | Não | Formulário | Sem máscara/validação |
| `city` | texto | Não | Formulário | — |
| `state` | texto | Não | Formulário | `maxlength=2`; sem normalização |
| `notes` | texto longo | Não | Formulário | Não exibido no detalhe |
| Imagem | caminho de asset | N/A | Mapa fixo por `id` | Novo imóvel recebe imagem fallback do IMO-001 |
| Disponibilidade/ocupação | número/% | N/A | Unidades ligadas pelo nome do imóvel | Calculado na tela |

Campos presentes no modelo, mas sem uso na tela Angular: `street`, `number`, `complement`, `district`, `municipalRegistration`, `registryNumber`, `registryOffice`, `manager`.

### Relacionamentos

- Imóvel N:1 Carteira.
- Imóvel 1:N Unidades.
- Imóvel 1:N Contratos e Cobranças.
- Imóvel 1:N Obras; Obra pode ainda apontar para uma unidade textual opcional.
- Imóvel 1:1 imagem mockada por ID, com fallback.

### Filtros e paginação

- Pesquisa por nome, endereço ou carteira.
- Filtro único por carteira, combinável com a pesquisa.
- Sem limpar filtros dedicado, ordenação ou paginação.

### Regras de negócio

- Ocupação do imóvel é a proporção de unidades com `occupied=true`.
- Disponibilidade é a quantidade de unidades com `occupied=false`.
- Situação atual: cálculo implementado; vínculos e edição somente em memória.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende de Carteiras.
- Alimenta Unidades, Contratos, Cobranças, Obras, dashboards e relatório contábil.

### Pendências encontradas

- Renomear imóvel não atualiza unidades, contratos, cobranças ou obras.
- O filtro de carteira não restringe opções em outros formulários dependentes.
- Não há imagem cadastrável, documentos, matrícula, inscrição municipal ou endereço estruturado na interface ativa.
- O utilitário de documentos locais existe, mas não está conectado a esta tela Angular.

---

## 6. Unidades

### Telas

- Grid de unidades.
- Drawer de detalhes.
- Modal compartilhado para criar e editar unidade.

### Funcionalidades

- Consultar, pesquisar, filtrar por situação e imóvel, cadastrar, editar e visualizar detalhes.
- Identificar contrato aparente de unidade ocupada.

### Ações disponíveis

- Nova unidade, editar, abrir/fechar detalhes.
- Não há exclusão, importação, exportação ou criação de contrato diretamente pelo card.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('UNI')` | Ex.: `UNI-001` |
| `property` | seleção/texto | Sim | Imóveis do store | Vínculo por nome |
| `portfolio` | texto somente leitura | Derivado | Carteira do imóvel selecionado | Sincroniza apenas no evento de mudança do imóvel |
| `name` | texto | Sim | Mock/formulário | Ex.: Sala 101 |
| `area` | número em m² | Sim | Mock/formulário | Mínimo visual 0; zero é aceito |
| `occupied` | booleano | Não | Mock/checkbox | Pode ser alterado manualmente; contrato novo também força `true` |
| `unitType` | seleção | Não | Padrão `Sala comercial` | Sala, loja, galpão, módulo ou outro |
| `notes` | texto longo | Não | Formulário | Não aparece no detalhe |
| Contrato exibido | texto | N/A | Primeiro contrato que combine imóvel e nome da unidade | Fallback `Vínculo ativo` |
| Imagem | caminho | N/A | Imagem do imóvel | Fallback fixo |

Campos presentes no modelo, mas sem uso na tela: `code`, `block`, `floor`, `totalArea`, `municipalRegistration`.

### Relacionamentos

- Unidade N:1 Imóvel e N:1 Carteira, ambos por nome.
- Contrato contém uma lista de nomes de unidades; uma unidade pode ser encontrada em vários contratos porque não há restrição temporal/de exclusividade.
- Obra pode referenciar unidade por texto livre.

### Filtros e paginação

- Pesquisa por nome da unidade, imóvel ou carteira.
- Filtro por `Ocupadas`/`Disponíveis` e por imóvel, combináveis.
- Sem limpar filtros dedicado, ordenação ou paginação.

### Regras de negócio

- Ao criar contrato, as unidades reconhecidas por imóvel + nome são marcadas ocupadas.
- A tela considera `occupied` como verdade operacional, independentemente da vigência do contrato.
- Situação atual: implementada em memória, sem integridade de vínculo.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende de Imóveis/Carteiras.
- Alimenta Contratos, Dashboard de Locações e vínculo opcional de Obras.

### Pendências encontradas

- Não há validação que impeça unidade já ocupada em novo contrato.
- O formulário de contrato recebe unidades como texto livre, não como seleção destas entidades.
- Não existe desocupação automática por encerramento/cancelamento de contrato.
- `occupied` pode divergir dos contratos cadastrados.

---

## 7. Locatários e imobiliárias

### Telas

- Grid de relacionamento de locatários.
- Hub de imobiliárias responsáveis.
- Drawer de detalhe do locatário.
- Modal compartilhado de novo/editar locatário.
- Modal próprio “Nova imobiliária”.

### Funcionalidades

- Consultar, pesquisar, filtrar e cadastrar/editar locatários.
- Cadastrar imobiliárias e filtrar locatários pelo parceiro responsável.
- Exibir primeiro contrato encontrado, imóvel, unidades, aluguel e vencimento.

### Ações disponíveis

- Novo locatário, editar cadastro, visualizar relação, nova imobiliária, alternar filtro por imobiliária e por existência de contrato.
- Não há edição/exclusão de imobiliária, exclusão de locatário ou criação direta de contrato.

### Dados utilizados — locatário

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('LOC')` | Numeração considera o maior número existente |
| `type` | enum `PF`/`PJ` | Sim | Padrão `PJ` | Não altera validação do documento |
| `name` | texto | Sim | Mock/formulário | Usado como chave nos contratos/cobranças |
| `document` | texto | Sim | Mock/formulário | Sem máscara, CPF/CNPJ, unicidade ou coerência com tipo |
| `contracts` | número | Não editável | Mock; zero no novo cadastro | Incrementado ao criar contrato |
| `tradeName` | texto | Não | Formulário | Participa da pesquisa |
| `contactName` | texto | Não | Formulário | Não exibido na listagem/drawer |
| `phone` | texto | Não | Formulário | Exibido se não houver e-mail |
| `email` | e-mail | Não | Formulário | Sem validação Angular explícita |
| `responsibleAgencyId` | seleção/ID | Não | Imobiliárias do store | Pode ser “Sem imobiliária” |
| `notes` | texto longo | Não | Formulário | Não exibido |

Campos presentes no modelo, mas sem uso na tela: `preferredChannel`, `billingAddress`, `municipalRegistration`.

### Dados utilizados — imobiliária

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('IMB')` | — |
| `name` | texto | Sim | Mock/formulário | Razão social |
| `tradeName` | texto | Não | Mock/formulário | Nome preferido no card |
| `document` | texto | Sim | Mock/formulário | Rotulado CNPJ, sem validação/máscara |
| `creci` | texto | Sim | Mock/formulário | Sem formato validado |
| `contactName` | texto | Sim | Mock/formulário | — |
| `phone` | texto | Não | Mock/formulário | — |
| `email` | e-mail | Não | Mock/formulário | — |
| `notes` | texto longo | Não | Modelo/mock possível | Não existe no modal ativo |

### Relacionamentos

- Imobiliária 1:N Locatários por `responsibleAgencyId`.
- Locatário 1:N Contratos pelo nome textual e pelo contador `contracts`.
- Locatário 1:N Cobranças por nome textual.
- A listagem mostra somente o primeiro contrato encontrado para cada locatário.

### Filtros e paginação

- Pesquisa por nome, documento ou nome fantasia.
- Filtro por com contrato/sem contrato.
- Filtro por uma imobiliária ou por ausência de imobiliária; combinável com os demais.
- Cards-resumo “Com contrato” e “Sem contrato” também aplicam filtro.
- Sem limpar todos os filtros dedicado, ordenação ou paginação.

### Regras de negócio

- `com contrato` significa `contracts > 0`, não vigência real.
- Renomear locatário propaga o nome aos contratos e cobranças existentes.
- Criar contrato incrementa o contador do locatário encontrado.
- Situação atual: implementada em memória; sem validação documental.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Imobiliárias alimentam o cadastro/filtro de Locatários.
- Locatários alimentam Contratos, Cobranças e relatório contábil.

### Pendências encontradas

- Contador de contratos é armazenado e pode divergir da coleção real.
- O card ignora contratos adicionais após o primeiro.
- CPF/CNPJ e e-mail possuem utilitários/modelos, mas a validação não está conectada ao formulário Angular.
- Não há regras de duplicidade, inativação ou troca histórica de imobiliária.

---

## 8. Contratos

### Telas

- Grid de contratos.
- Drawer de detalhes.
- Modal compartilhado “Novo contrato”. Não existe edição ativa de contrato.

### Funcionalidades

- Consultar, pesquisar, filtrar, cadastrar e visualizar contrato.
- Gerar cobrança a partir do drawer, já com o contrato selecionado.
- Exibir receita mensal, unidades vinculadas e ticket médio.

### Ações disponíveis

- Novo contrato, visualizar detalhe e gerar cobrança.
- Editar, encerrar, renovar, cancelar, excluir, anexar contrato e alterar status não existem.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('CTR')` | Apenas novos registros; sem edição |
| `portfolio` | seleção/texto | Sim | Carteiras do store | Não restringe os imóveis exibidos |
| `property` | seleção/texto | Sim | Todos os imóveis | Não é validado contra a carteira escolhida |
| `units` | lista de textos | Sim | Campo separado por vírgulas | Não é seleção de unidades e aceita nomes inexistentes |
| `tenant` | seleção/texto | Sim | Locatários do store | Vínculo persistido por nome |
| `period` | texto derivado | Derivado | Datas de início/fim formatadas | Sem validação de ordem |
| `rent` | moeda | Sim | Formulário | Mínimo visual 0; zero é aceito |
| `due` | inteiro/dia | Sim | Padrão 10 | `min=1`, `max=31` na entrada |
| `adjustment` | texto derivado | Derivado | Mês extraído da data inicial | Não usa o índice informado |
| `charges` | lista de textos | Não | Padrão `Aluguel, Condomínio` | Gera itens futuros |
| `startIso` | data | Sim | Formulário | — |
| `endIso` | data | Sim | Formulário | — |
| `adjustmentIndex` | texto | Não | Padrão `IPCA` | Sem cálculo de reajuste |
| `paymentMethod` | texto | Não visível | Controle compartilhado com padrão boleto | Gravado sem campo específico na etapa de contrato |
| `notes` | texto longo | Não | Formulário | Não aparece no drawer |

Campos modelados, mas sem uso no formulário/lista: `chargeRules`, `occupancyDate`, `purpose`, `paymentReference`, `adjustmentPeriod`, `lateFee`, `monthlyInterest`, `deliveryChannel`, `guaranteeType`, `guaranteeDetails`, `signatureDate`, `firstChargeRule`, `documentName`.

### Relacionamentos

- Contrato N:1 Carteira, Imóvel e Locatário.
- Contrato N:M Unidades no formato de array de nomes; funcionalmente aparenta uma ou mais unidades por contrato.
- Contrato 1:N Cobranças.
- A criação atualiza `Unit.occupied` para unidades reconhecidas e incrementa `Tenant.contracts`.

### Filtros e paginação

- Pesquisa por ID, locatário, imóvel ou unidades.
- Filtro por carteira, combinável.
- Sem limpar filtros dedicado, ordenação ou paginação.

### Regras de negócio

- Receita mensal total = soma de `rent`.
- Ticket médio = receita total / quantidade de contratos.
- Todos os contratos são rotulados visualmente como `Ativo`; não existe campo de status.
- Situação atual: criação e vínculos colaterais simulados em memória.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende de Carteiras, Imóveis, Unidades e Locatários.
- Alimenta ocupação, receita, Cobranças e relatório contábil.

### Pendências encontradas

- Não há validação de vigência, sobreposição, disponibilidade da unidade ou coerência carteira → imóvel → unidade.
- Nomes inválidos de unidade são gravados no contrato sem atualizar nenhuma unidade.
- Não há status/ciclo de vida contratual; “ativo” é apenas visual.
- Regras completas de encargos, reajuste, multa, juros, garantia e referência de pagamento estão modeladas, mas não implementadas na tela ativa.
- Forma de pagamento pode ser gravada por valor padrão invisível.

---

## 9. Cobranças, recebimentos, negociações e relatório contábil

### Telas

- Livro/listagem de cobranças.
- Drawer de composição e saldos.
- Modal compartilhado “Nova cobrança”.
- Modal “Registrar recebimento”.
- Modal “Negociar saldo”.
- Modal “Relação de aluguéis” para exportação XLSX.

### Funcionalidades

- Consultar, pesquisar e filtrar cobranças.
- Gerar itens de cobrança a partir do contrato.
- Registrar recebimento com alocação automática.
- Negociar saldo com desconto, acréscimo, entrada e parcelas.
- Calcular prévia, cronograma e status.
- Exportar relatório contábil de aluguéis em XLSX.

### Ações disponíveis

- Nova cobrança, abrir detalhe, registrar recebimento, negociar, gerar/baixar XLSX e limpar filtros.
- Não há edição/exclusão/cancelamento de cobrança, estorno de recebimento, baixa por arquivo, importação bancária, envio ao locatário ou conciliação.

### Dados utilizados — cobrança e itens

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('COB', size 4)` | — |
| `contract` | seleção/ID | Sim | Contratos do store | Origina os demais vínculos |
| `portfolio` | texto | Derivado | Contrato | Nome textual |
| `property` | texto | Derivado | Contrato | Nome textual |
| `units` | lista de textos | Derivado | Contrato | — |
| `tenant` | texto | Derivado | Contrato | — |
| `competence` | mês/ano | Sim | Padrão `2026-08` | Persistido como `MM/AAAA` |
| `status` | enum | Derivado/mutável | Vencimento, recebimento ou negociação | `Vencida`, `Próxima`, `Em aberto`, `Parcial`, `Negociada`, `Recebida` |
| `paymentMethod` | seleção | Não | Boleto/Pix/transferência | Sem processamento financeiro |
| `notes` | texto longo | Não | Formulário | Não exibido |
| `items[].name` | texto | Derivado | Encargos/regras do contrato | Item `Aluguel` recebe o aluguel contratual |
| `items[].dueDate` | texto formatado | Derivado | Competência + dia/regra | — |
| `items[].dueDateIso` | data | Derivado | Competência + dia/regra | Base do status |
| `items[].amount` | moeda | Derivado | Aluguel, regra ou cobrança mock anterior | Encargos sem valor anterior podem virar zero |
| `items[].received` | moeda | Mutável | Mock/recebimentos | Limitado ao valor original do item |
| `items[].reference` | texto | Não | Gerador | Sempre vazio na interface ativa |
| `items[].supportDocumentName` | texto | Não | Modelo | Não utilizado na interface ativa |

### Dados utilizados — recebimento

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('REC')` | — |
| `chargeId` | ID | Derivado | Cobrança aberta | — |
| `receiptDate` | data | Sim | Padrão `2026-08-12` | — |
| `creditDate` | data | Derivado | Igual à data de recebimento | Não há campo separado |
| `amount` | moeda | Sim | Formulário | > 0 e não pode superar saldo operacional |
| `paymentMethod` | seleção | Não | Pix/transferência/boleto | Padrão Pix |
| `financialAccount` | texto | Não | Padrão `Conta de Recebíveis` | Campo livre |
| `reference` | texto | Não | Formulário | — |
| `allocations[]` | item/valor | Derivado | Prévia automática | Distribuição em ordem do array |
| `discount`, `interest` | moeda | Não visível | Fixos em zero | — |
| `thirdPartyPayer`, `proofName`, `note` | texto | Não visível | Fixos vazios | — |

### Dados utilizados — negociação

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `originalBalance` | moeda | Derivado | Saldo atual | Deve ser positivo |
| `discount` | moeda | Condicional | Padrão 0 | Não negativo e não maior que saldo |
| `surcharge` | moeda | Condicional | Padrão 0 | Não negativo |
| `downPayment` | moeda | Condicional | Padrão 0 | Deve deixar valor financiado positivo |
| `installmentCount` | inteiro | Sim | Padrão 3 | Entre 1 e 24 |
| `firstDueDate` | data | Sim | Padrão `2026-09-12` | Não anterior a `2026-08-12` |
| `reason` | seleção | Não | Quatro opções | “Outro” não abre complemento |
| `negotiatedTotal` | moeda | Derivado | saldo - desconto + acréscimo | Calculado em centavos |
| `financedAmount` | moeda | Derivado | total negociado - entrada | Base das parcelas |
| `schedule[]` | parcela/data/valor | Derivado | Quantidade, data e valor financiado | Vencimentos mensais com ajuste ao fim do mês |
| `paymentMethod` | texto | Não visível | Fixo `Boleto bancário` | — |
| `createdAt`, `updatedAt` | data/hora | Derivado | Fixo `2026-08-12T12:00:00Z` | — |
| `notes` | texto | Não visível | Vazio | — |

Campos modelados, mas não usados no modal ativo: `otherReason`, `downPaymentDueDate`, `contactName`, `contactChannel`, detalhamento de multa/juros/correção, `agreementDocumentName`.

### Dados utilizados — relatório XLSX

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| Competência | mês | Sim | Padrão `2026-08` | Convertida para `MM/AAAA` |
| Escopo de carteira | seleção | Sim | Todas ou uma carteira | — |
| Locatário/documento/tipo | texto | Derivado | Locatários ligados por nome | PF vira CPF; demais viram CNPJ |
| Imóvel/endereço/unidades | texto/lista | Derivado | Imóveis/cobrança ligados por nome | — |
| Valor do aluguel | moeda | Derivado | Primeiro item chamado `Aluguel` | Outros itens são excluídos |
| Total | moeda/fórmula | Derivado | Soma das linhas | Arquivo cria `Plan1`, `Plan2`, `Plan3` |

### Relacionamentos

- Contrato 1:N Cobranças.
- Cobrança 1:N Itens e 1:N Recebimentos.
- Cobrança 0:1 Negociação no store atual.
- Recebimento 1:N Alocações; cada alocação aponta para o índice do item, não para ID próprio.
- Relatório cruza cobrança com carteira, imóvel e locatário por nome.

### Filtros e paginação

- Pesquisa por ID da cobrança, ID do contrato, locatário ou imóvel.
- Filtro por status e carteira, combináveis.
- Cards vencidas/próximas/negociadas alternam o filtro de status.
- Botão “Limpar” zera pesquisa, status e carteira.
- Sem ordenação configurável e sem paginação.

### Regras de negócio

- Total = soma dos itens; recebido = soma de `received`; saldo = total - recebido.
- Com acordo, saldo operacional = total negociado - recebimentos posteriores ao momento do acordo.
- Recebimento é distribuído sequencialmente pelos itens com saldo e muda status para `Recebida` quando quitado; caso contrário, `Parcial`.
- Nova cobrança usa a data-base `2026-08-12`: vencimento anterior é `Vencida`; até sete dias é `Próxima`; depois é `Em aberto`.
- Dia acima do último dia do mês é reduzido ao último dia; “Mês vencido” desloca um mês, mas essa opção não está exposta no contrato ativo.
- Cronograma de negociação divide centavos sem perder o total e ajusta datas mensais para meses curtos.
- Relatório aceita competência válida, carteira existente e somente cobranças com item positivo chamado `Aluguel`; ordena por carteira, imóvel, unidades, locatário e contrato.
- Situação atual: cálculos implementados e cobertos por testes unitários; persistência, cobrança real e conciliação são simuladas.

### Perfis e permissões

- Qualquer usuário autenticado pode gerar cobrança, registrar baixa, negociar e exportar.

### Dependências com outros módulos

- Depende de Contratos, Carteiras, Imóveis, Unidades e Locatários.
- Alimenta o Dashboard de Locações e o relatório contábil.

### Pendências encontradas

- Não há bloqueio de cobrança duplicada para o mesmo contrato/competência.
- Valores de encargos podem vir de `INITIAL_CHARGES`, não do estado corrente, e podem ser zero.
- A interface afirma alocação por vencimento, mas o algoritmo segue a ordem do array de itens.
- A entrada da negociação reduz o valor financiado, mas não é registrada como recebimento e não reduz o saldo operacional mostrado; regra inconsistente.
- Acréscimos acima do saldo original não possuem item de cobrança/alocação próprio.
- “Outro” no motivo não coleta descrição complementar.
- Recebimentos não possuem estorno, comprovante, pagador terceiro ou data de crédito editáveis, embora o modelo preveja parte desses dados.
- O relatório inclui cobranças de qualquer status e depende de vínculos por nome; regra contábil de inclusão ainda não definida.

---

## 10. Despesas

### Telas

- Livro/listagem de despesas.
- Drawer de detalhes.
- Modal compartilhado “Nova despesa”.

### Funcionalidades

- Consultar, pesquisar, filtrar, cadastrar, registrar pagamento e reabrir despesa.
- Exibir compromissos em aberto, percentual quitado e totais por status.

### Ações disponíveis

- Nova despesa, abrir detalhe, registrar pagamento/reabrir, filtrar e limpar filtros.
- Não há edição do cadastro, exclusão, aprovação/reprovação, pagamento parcial, parcelamento, importação, exportação ou anexo ativo.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('PAG', size 4)` | — |
| `supplier` | texto | Sim | Mock/formulário | Não usa cadastro central de fornecedor |
| `description` | texto | Sim | Mock/formulário | — |
| `category` | seleção/texto | Sim | Mock/formulário | Condomínio, Manutenção, Seguros, Tributos, Utilidades, Outros |
| `amount` | moeda | Sim | Mock/formulário | Mínimo visual 0; zero é aceito |
| `dueDate` | texto formatado | Derivado | `dueIso` | — |
| `dueIso` | data | Sim | Formulário | Comparada à data-base fixa |
| `paidDate` | texto/nulo | Mutável | Mock ou `12 ago 2026` | Sem campo de data no ato da baixa |
| `status` | enum | Derivado/mutável | `Vencido`, `Pendente`, `Pago` | — |
| `paymentMethod` | seleção | Não | Boleto/Pix/transferência | Não aparece no detalhe |
| `financialAccount` | texto | Não | Padrão `Banco Operacional` | Não aparece no detalhe |
| `notes` | texto longo | Não | Formulário | Não aparece no detalhe |

Campos modelados, mas sem uso ativo: `allocationType`, `allocationId`, `competence`, `issueDate`, `documentType`, `documentNumber`, `plannedDate`, `entryType`, `recurrence`, `attachmentName`.

### Relacionamentos

- Não há relacionamento funcional com Carteira, Imóvel, Unidade, Contrato, Obra ou fornecedor do módulo Obras.
- Os campos de alocação existem no modelo, mas não são preenchidos.

### Filtros e paginação

- Pesquisa por fornecedor, descrição ou ID.
- Filtro por status e categoria, combináveis.
- Cards Vencidas/Pendentes/Pagas aplicam status.
- Botão “Limpar filtros” zera os três critérios.
- Ordenação automática: `Vencido`, `Pendente`, `Pago`; dentro do status, vencimento crescente.
- Sem ordenação escolhida pelo usuário ou paginação.

### Regras de negócio

- Nova despesa com vencimento anterior a `2026-08-12` nasce `Vencido`; demais nascem `Pendente`.
- Registrar pagamento muda status para `Pago` e grava a data fixa `12 ago 2026`.
- Reabrir recalcula entre `Vencido` e `Pendente` usando a mesma data fixa.
- Percentual quitado = valor pago / (valor pago + valor em aberto).
- Situação atual: implementada em memória, sem pagamento financeiro real.

### Perfis e permissões

- Qualquer usuário autenticado pode cadastrar e alterar status financeiro.

### Dependências com outros módulos

- Alimenta o Dashboard de Locações.
- Hoje é independente dos cadastros patrimoniais e do financeiro de Obras.

### Pendências encontradas

- A categoria `Telecom` existe nos mocks e aparece no filtro dinâmico, mas não pode ser escolhida no modal de nova despesa.
- Não há data/valor de baixa, pagamento parcial, comprovante ou histórico.
- Não há origem definida para fornecedor, alocação, competência e documentos.
- Despesas de obras e pagamentos de fornecedores não convergem com este módulo.

---

## 11. Obras — Painel e listagem

### Telas

- Painel de obras em `/obras/inicio`.
- Listagem “Todas as obras” em `/obras`.

### Funcionalidades

- Consolidar obras ativas, atrasadas, orçamento, realizado e saldo projetado.
- Exibir obra em destaque, prioridades do dia, obras acompanhadas e próximos compromissos.
- Pesquisar/filtrar obras e navegar para detalhe, edição ou criação.

### Ações disponíveis

- Nova obra, abrir obra, editar obra, filtrar, limpar filtros no painel e consultar prioridades/compromissos.
- Não há exclusão, exportação, importação ou paginação.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | Mock/`nextRecordId('OBR')` | — |
| `title` | texto | Sim no cadastro | Mock/formulário | — |
| `property` | seleção/texto | Sim | Imóveis do store | Vínculo por nome |
| `unit` | texto | Não | Mock/campo livre | Não valida unidade do imóvel |
| `manager` | seleção/texto | Sim | Quatro nomes fixos | — |
| `status` | enum | Não marcado | Mock/formulário | Planejada, em andamento, pausada, concluída; modelo aceita cancelada |
| `priority` | enum | Não marcado | Mock/formulário | Baixa, média, alta, urgente |
| `risk` | enum | Não marcado | Mock/formulário | Dentro do prazo, atenção, em atraso, concluída |
| `progress` | número/% | Não marcado | Mock/formulário | 0–100 no HTML |
| `startDateIso` | data | Sim | Mock/formulário | — |
| `endDateIso`, `endLabel` | data/texto | Sim/derivado | Mock/formulário | — |
| `updatedAtIso`, `lastUpdateLabel` | data-hora/texto | Derivado | Mock/relógio + texto fixo | Novas edições usam “Atualizada agora” |
| `budget` | moeda | Sim | Mock/formulário | ≥ 0 |
| `spent` | moeda | Não | Mock/formulário | ≥ 0 visualmente |
| `reserve` | moeda | Não | Formulário | ≥ 0 visualmente |
| `projectedCashBalance` | moeda | Derivado | orçamento - realizado - reserva | Não acompanha detalhe financeiro |
| `nextActivity` | texto | Não | Mock/formulário | Fallback `Definir próxima atividade` |
| `interventionType` | enum | Não | Formulário | Obra, reforma, reparo, manutenção, emergência |
| `description`, `notes` | texto longo | Descrição sim; notas não | Formulário | — |
| `attachments`, `team` | listas | Não | Modelo | Não usados diretamente no cadastro ativo |
| Alertas/prioridades | objetos fixos | N/A | `workAttentionRecords` | Não derivados das alterações |
| Compromissos | objetos fixos | N/A | `workCommitments` | Não derivados das atividades |

### Relacionamentos

- Obra N:1 Imóvel por nome.
- Obra N:1 Unidade opcional por texto livre.
- Alertas e compromissos N:1 Obra por `workId`.
- Custos resumidos vêm dos campos da própria obra, não necessariamente das subentidades do detalhe.

### Filtros e paginação

- Painel: filtro por responsável e situação; botão limpar; destaque = primeira obra em andamento ou primeira filtrada; lista limitada visualmente às cinco primeiras.
- Prioridades: apenas as quatro primeiras; são filtradas pela presença da obra no conjunto filtrado.
- Compromissos: todos os cinco mocks, sem respeitar filtros.
- Listagem: pesquisa por ID, título, imóvel ou responsável; filtros por situação e risco.
- Sem filtro por período/prioridade/imóvel na versão Angular ativa, sem ordenação configurável e sem paginação.

### Regras de negócio

- Ativa = status diferente de `Concluída` e `Cancelada`.
- Em atenção = risco `Atenção` ou `Em atraso`.
- Uso do orçamento = realizado / orçamento.
- Saldo projetado consolidado = soma de `projectedCashBalance`.
- Situação atual: indicadores calculados; alertas e compromissos apenas simulados.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende de Imóveis e, conceitualmente, Unidades.
- Alimenta detalhe, cronograma, equipe, fornecedores, sócios, financeiro e diário.

### Pendências encontradas

- A data “Segunda-feira, 24 de agosto” é fixa.
- Alertas/compromissos não são criados, removidos ou reprogramados quando a obra muda.
- Métricas gerais do painel não respeitam os filtros de responsável/situação.
- `status`, `risk` e `progress` podem ser gravados em combinações incompatíveis.
- A versão React inativa possui filtros/ordenação adicionais não migrados para a versão Angular.

---

## 12. Obras — Cadastro e edição

### Telas

- Formulário de três etapas: Identificação, Planejamento e Orçamento.
- A mesma tela atende criação e edição.

### Funcionalidades

- Criar/editar obra, avançar/voltar etapas e revisar um resumo antes de salvar.

### Ações disponíveis

- Continuar, voltar, cancelar, salvar/criar.
- Não há exclusão, duplicação, aprovação ou anexos.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Validação/padrão |
| --- | --- | --- | --- | --- |
| Título | texto | Sim | Formulário | — |
| Imóvel | seleção | Sim | Imóveis do store | — |
| Unidade | texto | Não | Formulário | Campo livre |
| Tipo de intervenção | seleção | Não | Formulário | `Obra` |
| Prioridade | seleção | Não | Formulário | `Média` |
| Descrição | texto longo | Sim | Formulário | — |
| Responsável | seleção | Sim | Quatro nomes fixos | — |
| Situação | seleção | Não | Formulário | `Planejada` |
| Início | data | Sim | Formulário | Sem comparação com fim |
| Conclusão prevista | data | Sim | Formulário | Sem comparação com início |
| Risco | seleção | Não | Formulário | `Dentro do prazo` |
| Progresso | número | Não | Formulário | `min=0`, `max=100`; padrão 0 |
| Próxima atividade | texto | Não | Formulário | Fallback definido ao salvar |
| Orçamento previsto | moeda | Sim | Formulário | `Validators.min(0)` |
| Reserva | moeda | Não | Formulário | `min=0` visual |
| Valor realizado | moeda | Não | Formulário | `min=0` visual |
| Observações | texto longo | Não | Formulário | — |

Limites de caracteres, anexos e validações cruzadas: regra ainda não definida.

### Relacionamentos

- Seleciona Imóvel; Unidade não é derivada nem validada.
- Ao criar uma nova obra, o detalhe começa vazio.
- Para obra mock existente, o detalhe é gerado sob demanda com base no registro principal.

### Filtros e paginação

- Não aplicável.

### Regras de negócio

- Saldo projetado inicial = orçamento - realizado - reserva.
- Edição preserva o ID e substitui o registro principal.
- O usuário pode avançar etapas sem validar; toda a validação ocorre somente ao salvar na etapa 3.
- Situação atual: implementada em memória.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende de Imóveis; deveria depender de Unidades de forma estruturada.
- Cria a raiz para todos os registros do detalhe de Obras.

### Pendências encontradas

- Não há validação `fim >= início`.
- Responsáveis são nomes fixos sem cadastro de usuários/profissionais.
- Editar orçamento/realizado/reserva recalcula o saldo principal, mas lançamentos no detalhe não fazem o caminho inverso.
- Nova obra começa sem cronograma, equipe, fornecedores, sócios, financeiro, diário ou pendências.

---

## 13. Obras — Detalhe, planejamento e pendências

### Telas

- Cabeçalho e aba Resumo.
- Aba Planejamento.
- Modais: atualizar progresso, adicionar atividade, bloquear e reprogramar atividade.

### Funcionalidades

- Consultar resumo, indicadores, próxima atividade, pendências e equipe resumida.
- Atualizar progresso/status, resolver pendência, cadastrar/concluir/bloquear/reprogramar atividade.
- Toda alteração relevante adiciona registro ao diário.

### Ações disponíveis

- Atualizar progresso, editar obra, trocar abas, abrir financeiro/cronograma/equipe, registrar diário, resolver pendência, adicionar/concluir/bloquear/reprogramar atividade.
- Não há edição/exclusão de atividade.

### Dados utilizados

| Entidade/campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| Atividade `id` | texto | Gerado | `nextRecordId('ATV')` | — |
| `stage` | enum | Não | Preparação/Execução/Entrega | Padrão Execução |
| `title` | texto | Sim | Mock/formulário | — |
| `manager` | texto | Sim | Mock/formulário | Campo livre |
| `startDateIso` | data | Sim na lógica | Mock/formulário | Não marcado com `*` |
| `endDateIso` | data | Sim na lógica | Mock/formulário | Fim não pode preceder início |
| `status` | enum | Derivado/mutável | Mock/ações | Não iniciada, em andamento, bloqueada, concluída |
| `blockedReason` | texto | Sim ao bloquear | Formulário | Exibido no planejamento |
| Pendência `id/title/description/tone` | texto/enum | N/A | Gerador mock | `danger`, `warning`, `info` |
| Progresso atualizado | número | Marcado obrigatório | Formulário | Limitado programaticamente a 0–100 |
| Situação atualizada | enum | Não | Formulário | Inclui Cancelada |
| Próxima atividade | texto | Não | Formulário | Mantém valor anterior se vazio |

### Relacionamentos

- Obra 1:N Atividades e 1:N Pendências.
- Atividade pode aparecer em `activityIds` das alocações de equipe mockadas.
- Ações de atividade geram entradas de Diário.

### Filtros e paginação

- Sem busca, filtro, ordenação ou paginação dentro das abas.

### Regras de negócio

- Concluir atividade remove bloqueio, recalcula progresso pela proporção de atividades concluídas e define como próxima a primeira não concluída.
- Marcar a obra como concluída força progresso 100 e risco `Concluída`.
- Bloqueio exige motivo; reprogramação exige data e justificativa e impede fim anterior ao início da atividade.
- Resolver pendência simplesmente remove o item da memória.
- Situação atual: regras implementadas em memória; pendências iniciais são geradas por risco/fornecedor/próxima atividade.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende da obra principal e alimenta Diário/indicadores.

### Pendências encontradas

- Reprogramar atividade não altera a conclusão prevista nem o risco da obra.
- Concluir todas as atividades não conclui automaticamente a obra.
- Alterar progresso manualmente não atualiza estados das atividades.
- Resolver pendência não registra motivo, usuário ou data e não resolve a causa associada.
- `activityIds` da equipe não possui interface de manutenção.

---

## 14. Obras — Equipe

### Telas

- Aba Equipe.
- Modal “Alocar profissional”.

### Funcionalidades

- Listar alocações, calcular custo previsto, adicionar e remover profissional.

### Ações disponíveis

- Alocar e remover.
- Não há editar, confirmar remoção, cadastro mestre de profissional, apontamento real de horas/diárias ou aprovação.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('EQP')` | — |
| `name` | texto | Sim | Mock/formulário | Campo livre |
| `role` | texto | Sim | Mock/formulário | Campo livre |
| `startDateIso`, `endDateIso` | data | Derivado | Período integral da obra | Não editáveis no modal |
| `workMode` | enum | Não | Horas/Diárias | Padrão Horas |
| `quantity` | número | Sim | Formulário | > 0; entrada `min=0.5`, passo 0.5 |
| `unitRate` | moeda | Não explicitamente | Campo “Valor unitário” | Zero é aceito |
| `activityIds` | lista de IDs | Não | Mock; vazio em nova alocação | Sem UI |
| Custo | moeda | Derivado | quantidade × valor unitário | Apenas previsto |

### Relacionamentos

- Obra 1:N Alocações de equipe.
- Alocação N:M Atividades por `activityIds` no modelo, sem manutenção ativa.

### Filtros e paginação

- Não existem.

### Regras de negócio

- Custo total = soma de quantidade × valor unitário.
- Situação atual: implementada em memória; sem apropriação ao realizado.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Alimenta Resumo e Financeiro da obra.

### Pendências encontradas

- Remoção é imediata e sem confirmação.
- Custos de equipe não geram lançamento financeiro nem atualizam `spent`.
- Período e atividades vinculadas não são configuráveis no modal ativo.

---

## 15. Obras — Fornecedores e pagamentos

### Telas

- Aba Fornecedores.
- Modal “Cadastrar fornecedor”.
- Modal “Registrar pagamento do fornecedor”.

### Funcionalidades

- Cadastrar fornecedor/contratação, consultar contratado/pago/saldo/status e registrar pagamentos com observação e nome de comprovante.

### Ações disponíveis

- Novo fornecedor e registrar pagamento enquanto houver saldo.
- Não há editar/excluir fornecedor, estornar pagamento, cadastro central, upload real, aprovação ou vínculo com Despesas.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('FOR')` | Local à obra |
| `name` | texto | Sim | Mock/formulário | — |
| `supplyType` | enum | Não | Serviço/Produto/Material | Padrão Serviço |
| `description` | texto | Sim | Mock/formulário | Objeto contratado |
| `contractedAmount` | moeda | Sim | Mock/formulário | > 0 |
| `paidAmount` | moeda | Derivado/mutável | Mock/pagamentos | Limitado ao contratado |
| `status` | enum | Derivado | Valores e vencimento | Pendente, parcialmente pago, quitado, vencido |
| `contractDateIso` | data | Derivado | Fixo `2026-08-24` para novo | — |
| `dueDateIso` | data | Não marcado | Formulário/fim da obra | Define vencido se ainda não houve pagamento |
| `lastPaymentDateIso` | data | Derivado | Último pagamento | — |
| `notes` | texto | Não | Mock | Sem campo no cadastro ativo |
| `documents[]` | nomes | Não | Mock/nome do comprovante | Não são arquivos persistidos |
| `payments[].id` | texto | Gerado | `nextRecordId('PAG-FOR')` | — |
| `payments[].amount` | moeda | Sim | Formulário | > 0 e ≤ saldo |
| `payments[].dateIso` | data | Sim | Formulário | — |
| `payments[].note` | texto | Não | Formulário | — |
| `payments[].document` | nome de arquivo | Não | Formulário | Campo textual |

### Relacionamentos

- Obra 1:N Fornecedores/contratações.
- Fornecedor 1:N Pagamentos e N nomes de documentos.
- Pagamento gera registro no Diário, mas não gera `WorkFinancialEntry`.

### Filtros e paginação

- Não existem.

### Regras de negócio

- Quitado se pago ≥ contratado; parcialmente pago se pago > 0; sem pagamento e vencimento anterior a `2026-08-24` vira vencido; caso contrário pendente.
- Pagamento não pode superar o saldo.
- Situação atual: implementada em memória.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Alimenta Resumo/Financeiro/Pendências da obra somente por indicadores locais e mock inicial.

### Pendências encontradas

- Pagamento parcial sempre muda para `Parcialmente pago`, mesmo depois do vencimento.
- Pagamentos não atualizam valor realizado, saldo projetado, lista financeira nem módulo Despesas.
- Comprovante é apenas um nome; não há upload/download.
- O conceito de fornecedor está duplicado entre Despesas e Obras.

---

## 16. Obras — Sócios e aportes

### Telas

- Aba Sócios.
- Modal “Cadastrar sócio”.
- Modal “Registrar aporte”.
- Modal “Registrar pagamento do sócio”.

### Funcionalidades

- Distribuir participação, cadastrar sócios, solicitar aporte, ratear por participação, registrar integralizações e calcular totais por sócio/aporte.

### Ações disponíveis

- Adicionar/remover sócio, solicitar aporte e registrar pagamento.
- Botão “Histórico nos aportes” existe desabilitado.
- Não há edição de sócio/participação, estorno, documento, aprovação ou cadastro global.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| Sócio `id` | texto | Gerado | `nextPartnerRecordId('SOC')` | Local à obra |
| `name` | texto | Sim | Mock/formulário | — |
| `participationPercent` | percentual | Sim | Mock/formulário | > 0; total não pode exceder 100% |
| Aporte `id` | texto | Gerado | `nextRecordId('APT')` | — |
| `dateIso` | data | Não marcado | Padrão `2026-08-24` | — |
| `description` | texto | Sim | Formulário | — |
| `amount` | moeda | Sim | Formulário | > 0 |
| `shares[].partnerId/name/percent` | ID/texto/% | Derivado | Sócios no momento do aporte | Preserva fotografia histórica |
| `shares[].amountDue` | moeda | Derivado | Valor × participação | Último sócio absorve centavos |
| `payments[].id` | texto | Gerado | `nextPartnerRecordId('PAG-APT')` | — |
| `payments[].amount` | moeda | Sim | Formulário | > 0 e ≤ saldo da cota |
| `payments[].dateIso` | data | Sim | Formulário | — |
| `payments[].note` | texto | Não | Formulário | — |

### Relacionamentos

- Obra 1:N Sócios e 1:N Aportes.
- Aporte N:M Sócios por cotas (`shares`).
- Cota 1:N Pagamentos.
- Pagamento do sócio 1:1 novo lançamento financeiro e 1:1 registro de diário.

### Filtros e paginação

- Não existem.

### Regras de negócio

- Total de participação é arredondado a duas casas.
- Novo sócio não pode levar o total acima de 100%.
- Aporte só pode ser aberto quando a participação é exatamente 100%; a função também valida tolerância de 0,001.
- Rateio é proporcional e o último sócio absorve diferença de centavos.
- Sócio com qualquer cota histórica não pode ser removido.
- Pagamento não pode ultrapassar o saldo individual; gera entrada financeira positiva.
- Situação atual: cálculos implementados e cobertos por testes unitários; persistência simulada.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Depende de Obra.
- Pagamentos alimentam Financeiro e Diário da obra.

### Pendências encontradas

- Participação não pode ser editada; não há vigência/histórico societário fora da fotografia do aporte.
- Sócios são recriados por obra; não há cadastro de pessoas/empresas compartilhado.
- Não há comprovante, estorno, aprovação ou conciliação de aporte.
- O botão de histórico não possui ação.

---

## 17. Obras — Financeiro

### Telas

- Aba Financeiro.
- Modal “Realizar ajuste de caixa”.

### Funcionalidades

- Exibir orçamento, aportes recebidos, fornecedores pagos e equipe prevista.
- Listar entradas financeiras de aporte e ajustes manuais.
- Registrar ajuste positivo ou negativo.

### Ações disponíveis

- Ajustar caixa.
- Não há editar/excluir/estornar, filtrar, exportar, conciliar ou aprovar.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('FIN')` | — |
| `kind` | enum | Derivado | `Aporte` ou `Ajuste` | — |
| `description` | texto | Sim no ajuste | Aporte/formulário | — |
| `party` | texto | Derivado | Sócio ou `Caixa administrativo` | — |
| `amount` | moeda com sinal | Sim | Pagamento/aporte ou ajuste | Ajuste deve ser diferente de zero |
| `dateIso` | data | Sim | Pagamento/formulário | — |
| `status` | enum | Derivado | Sempre `Registrado` | Sem outros estados |
| `sourceId` | ID | Condicional | ID do aporte | Ausente em ajuste manual |

### Relacionamentos

- Entrada financeira N:1 Obra.
- Entrada de aporte aponta opcionalmente para o Aporte por `sourceId`.
- Métricas leem fornecedores/equipe, mas essas entidades não geram entradas financeiras equivalentes.

### Filtros e paginação

- Não existem.

### Regras de negócio

- Ajuste exige data, descrição e valor finito diferente de zero.
- Entrada é sempre considerada registrada.
- Situação atual: registro em memória; não existe livro-caixa conciliado.

### Perfis e permissões

- Qualquer usuário autenticado pode criar ajuste positivo ou negativo.

### Dependências com outros módulos

- Depende de Obra, Sócios/Aportes, Equipe e Fornecedores.

### Pendências encontradas

- Lista financeira não inclui pagamentos de fornecedores nem custos de equipe.
- Ajustes e aportes não recalculam `spent` ou `projectedCashBalance` da obra.
- Não existe saldo de caixa derivado dos lançamentos; os quatro indicadores vêm de fontes distintas.
- Regra de sinal/contabilização, competência, conta, centro de custo e aprovação ainda não definida.

---

## 18. Obras — Diário e arquivos

### Telas

- Aba Diário.
- Modal “Registrar no diário”.
- Lista lateral de arquivos recentes.

### Funcionalidades

- Exibir linha do tempo e registrar atualização, ocorrência, pendência ou arquivo.
- Inserir automaticamente eventos de atividades, fornecedores, sócios, aportes, caixa e progresso.

### Ações disponíveis

- Novo registro e consulta da linha do tempo.
- Não há editar/excluir, busca, filtro, download ou upload real.

### Dados utilizados

| Campo | Tipo aparente | Obrigatório | Origem atual | Observação |
| --- | --- | --- | --- | --- |
| `id` | texto | Gerado | `nextRecordId('DIA')` | — |
| `kind` | enum | Não | Atualização/Ocorrência/Pendência/Arquivo | Padrão Atualização |
| `title` | texto | Sim | Mock/formulário/ação | — |
| `description` | texto longo | Sim | Mock/formulário/ação | — |
| `author` | texto | Derivado | Responsável da obra | Não usa usuário logado |
| `dateIso` | data-hora | Derivado | Fixo `2026-08-24T12:00:00` para novos | — |
| `progress` | número | Derivado | Progresso da obra | Fotografia do momento |
| `files[]` | lista de nomes | Não | Texto separado por vírgulas | Sem binário/URL |

### Relacionamentos

- Obra 1:N Entradas do Diário.
- Diversas ações operacionais geram entrada automaticamente.
- Arquivos recentes são os oito primeiros nomes encontrados ao percorrer o diário atual.

### Filtros e paginação

- Não existem.

### Regras de negócio

- Registro manual exige título e descrição.
- Autor sempre é o responsável da obra, não quem realizou a ação.
- Situação atual: linha do tempo simulada em memória; anexos são apenas nomes.

### Perfis e permissões

- Sem diferenças por perfil.

### Dependências com outros módulos

- Recebe eventos de Planejamento, Fornecedores, Sócios, Financeiro e atualização de obra.

### Pendências encontradas

- Data/hora e autor são fixos/derivados incorretamente para auditoria real.
- Não há armazenamento, tipo, tamanho, URL, categoria, versão ou permissão de arquivo.
- O utilitário de documentos locais aceita PDF, Word, Excel e imagens até 10 MB, mas está órfão na aplicação Angular.

---

## 19. Matriz consolidada de filtros, ordenação e paginação

| Tela/listagem | Pesquisa | Filtros | Ordenação | Paginação | Limpar | Situação |
| --- | --- | --- | --- | --- | --- | --- |
| Carteiras | carteira, titular, documento | — | ordem do array | Não | apagando busca | Lógica ativa |
| Imóveis | imóvel, endereço, carteira | carteira | ordem do array | Não | manual | Lógica ativa |
| Unidades | unidade, imóvel, carteira | ocupação, imóvel | ordem do array | Não | manual | Lógica ativa |
| Locatários | nome, documento, fantasia | vínculo, imobiliária/sem imobiliária | ordem do array | Não | manual | Lógica ativa |
| Contratos | ID, locatário, imóvel, unidade | carteira | ordem do array | Não | manual | Lógica ativa |
| Cobranças | ID, contrato, locatário, imóvel | status, carteira | ordem do array | Não | botão | Lógica ativa |
| Despesas | ID, fornecedor, descrição | status, categoria | status e vencimento | Não | botão | Lógica ativa |
| Painel de obras | — | responsável, situação | ordem do array; fatias 1/4/5 | Não | botão | Filtro ativo; alertas parcialmente estáticos |
| Todas as obras | ID, título, imóvel, responsável | situação, risco | ordem do array | Não | manual | Lógica ativa |
| Abas da obra | — | — | ordem do array | Não | — | Não implementado |

Nenhuma tela possui quantidade por página, navegação de páginas, carregamento incremental ou ordenação por cabeçalho.

---

## 20. Relacionamentos funcionais consolidados

| Origem | Relacionada | Tipo aparente | Onde é usada | Informação necessária hoje |
| --- | --- | --- | --- | --- |
| Carteira | Imóvel | 1:N | cadastro, filtros, contadores, relatório | nome da carteira |
| Carteira | Unidade | 1:N indireto | contadores/dashboard | nome da carteira |
| Imóvel | Unidade | 1:N | disponibilidade/ocupação | nome do imóvel |
| Imobiliária | Locatário | 1:N | filtro e card | `responsibleAgencyId` |
| Locatário | Contrato | 1:N | relacionamento/receita | nome do locatário + contador |
| Carteira/Imóvel/Unidade/Locatário | Contrato | N:1/N:M | criação e detalhe | nomes textuais; unidades em array |
| Contrato | Cobrança | 1:N | geração e consulta | ID do contrato e cópia dos nomes |
| Cobrança | Item | 1:N | total, saldo, baixa, relatório | posição do item no array |
| Cobrança | Recebimento | 1:N | baixa e saldo | `chargeId` |
| Recebimento | Item | N:M por alocação | apropriação | índice do item + valor |
| Cobrança | Negociação | 0:1 | saldo/status/parcelas | `chargeId` |
| Imóvel/Unidade | Obra | 1:N | cadastro e imagens | nomes textuais |
| Obra | Atividade | 1:N | planejamento/progresso | ID implícito pelo detalhe |
| Obra | Equipe | 1:N | custos | ID implícito pelo detalhe |
| Equipe | Atividade | N:M modelado | mocks | `activityIds`; sem UI |
| Obra | Fornecedor | 1:N | contratação/pagamentos | ID implícito pelo detalhe |
| Fornecedor | Pagamento | 1:N | saldo/status | coleção aninhada |
| Obra | Sócio | 1:N | participação | coleção aninhada |
| Aporte | Sócio | N:M | rateio | cotas históricas |
| Cota de aporte | Pagamento | 1:N | integralização | coleção aninhada |
| Pagamento de aporte | Financeiro | 1:1 | fluxo | `sourceId` do aporte |
| Obra | Diário/Pendência | 1:N | auditoria/atenção | coleção aninhada |

O principal risco técnico é que muitos vínculos usam nomes mutáveis. Para o backend, a identidade deve ser definida antes da migração, preservando os nomes apenas como atributos de apresentação.

---

## 21. Regras de negócio consolidadas

| Regra | Onde é utilizada | Dados envolvidos | Situação atual |
| --- | --- | --- | --- |
| Ocupação = ocupadas / total | Dashboard, Carteiras, Imóveis, Unidades | `Unit.occupied` | Implementada, mas o estado pode divergir dos contratos |
| Criar contrato ocupa unidades e incrementa locatário | Contratos | imóvel, nomes de unidades, locatário | Implementada parcialmente; sem vigência/exclusividade |
| Geração de cobrança por contrato/competência | Cobranças | aluguel, encargos, vencimento | Implementada com fallback em mocks |
| Status temporal da cobrança | Cobranças | vencimento e `2026-08-12` | Implementada com data congelada |
| Baixa e alocação de recebimento | Cobranças | saldo de itens, valor recebido | Implementada; ordem declarada diverge do algoritmo |
| Negociação e parcelamento | Cobranças | saldo, desconto, acréscimo, entrada, parcelas | Implementada parcialmente; entrada não afeta saldo mostrado |
| Relatório contábil de aluguel | Cobranças | competência, carteira e item Aluguel | Implementada e testada |
| Status/pagamento de despesa | Despesas | vencimento, status e `2026-08-12` | Implementada de forma simplificada |
| Saldo projetado da obra | Cadastro/Resumo | orçamento - realizado - reserva | Implementada no registro principal; não sincroniza com detalhe |
| Progresso por atividades concluídas | Planejamento | atividades concluídas / total | Implementada quando se conclui atividade |
| Status de fornecedor | Fornecedores | contratado, pago, vencimento e `2026-08-24` | Implementada de forma simplificada |
| Participações devem totalizar 100% | Sócios/Aportes | percentuais | Implementada e testada |
| Rateio proporcional com ajuste de centavos | Aportes | valor e percentuais | Implementada e testada |
| Bloqueio de remoção de sócio com aporte | Sócios | cotas históricas | Implementada |
| Registro automático no diário | Detalhe de obra | ação, responsável, data fixa | Implementada parcialmente |
| Alertas/prioridades/compromissos | Painel de obras | arrays fixos | Apenas simulada |
| Autenticação e perfil | Acesso | campos do formulário/booleano | Apenas simulada; permissão ausente |

---

## 22. Dados compartilhados entre telas

- `Portfolio.name`: Imóveis, Unidades, Contratos, Cobranças, relatórios e filtros.
- `Property.name`: Unidades, Contratos, Cobranças, Obras, imagens e relatório.
- `Unit.name`: Contratos, Cobranças e exibição opcional de Obras.
- `Tenant.name`: Contratos, Cobranças, Dashboard e relatório.
- `responsibleAgencyId`: Hub/filtro de Locatários.
- `Contract.id`: Cobranças e drawer de unidade.
- `Charge.items/received/status`: Dashboard, listagem, drawer, recebimentos, negociações e relatório.
- `Expense.amount/status`: Dashboard e Despesas.
- `WorkRecord`: Painel, listagem, formulário, detalhe e gerador de subdados.
- Participações/aportes/pagamentos: abas Sócios e Financeiro.
- Atividades, fornecedores e ações: Resumo, suas abas e Diário.

---

## 23. Funcionalidades apenas simuladas ou ausentes

### Simuladas com lógica local

- Login e logout.
- Cadastros/edições suportados pelo `AppStore`.
- Geração de IDs.
- Ocupação de unidade ao criar contrato.
- Geração de cobrança e mudança de status.
- Recebimentos, negociação, parcelamento e XLSX.
- Pagamentos/reabertura de despesas.
- Gestão operacional e financeira de obras.
- Toasts e estado offline.

### Apenas visuais ou estáticas

- Usuário/perfil “Augusto Lima · Administrador”.
- Datas de atualização, período do dashboard e “hoje”.
- Imóvel em destaque.
- Prioridades e compromissos de Obras.
- Status “Ativo” de todos os contratos.
- “Histórico nos aportes” desabilitado.
- Nomes de comprovantes/arquivos sem arquivo persistido.

### Não encontradas na aplicação ativa

- Aprovação/reprovação.
- Importação de dados.
- Exclusão de entidades principais.
- Paginação.
- Ordenação configurável pelo usuário.
- API, banco, cache persistente, logs/auditoria confiável.
- Upload/download real de documentos.
- Conciliação bancária, emissão/envio de cobrança ou integração de pagamento.
- Perfis e permissões reais.

---

## 24. Pendências encontradas

1. As datas-base fixas de agosto de 2026 já não correspondem ao relógio real e afetam vencimentos, status, diários e dashboards.
2. Todo o estado é volátil; recarregar restaura os mocks.
3. O schema de banco está vazio e o adaptador D1 não está conectado ao Angular.
4. Autenticação aceita qualquer credencial formalmente válida; usuário e papel são fixos.
5. Não há autorização por módulo ou ação.
6. Vínculos por nomes mutáveis criam risco de quebra após renomear carteira/imóvel/locatário.
7. Só a renomeação de locatário propaga para contratos e cobranças; carteira e imóvel não propagam.
8. Contadores armazenados (`properties`, `units`, `contracts`) convivem com contagens calculadas e podem divergir.
9. Não há exclusão nem política de integridade/cascata para entidades principais.
10. Contrato não tem status, edição, encerramento, cancelamento ou renovação.
11. Contrato não valida a cadeia carteira → imóvel → unidade nem disponibilidade/vigência.
12. Encargos contratuais não possuem fonte completa de valores; geração consulta inclusive o array mock inicial.
13. Cobranças duplicadas por contrato/competência são permitidas.
14. Entrada de negociação não é tratada como baixa e o saldo apresentado não a desconta.
15. Alocação de recebimento segue ordem do array, embora a interface declare ordem de vencimento.
16. Relatório contábil não define regra por status e cruza entidades por nomes.
17. Despesas não possuem alocação patrimonial/obra, histórico financeiro, comprovante ou pagamento parcial.
18. Categoria `Telecom` existe nos dados, mas não no modal de nova despesa.
19. Fornecedores de Despesas e de Obras são conceitos separados e sem cadastro mestre.
20. Pagamentos de fornecedor/custos de equipe não atualizam realizado, saldo ou lançamentos financeiros da obra.
21. Aportes/ajustes financeiros não atualizam saldo projetado da obra.
22. Alertas, prioridades e compromissos de Obras são estáticos e não reagem às operações.
23. Progresso, atividades, status e risco da obra podem divergir.
24. Reprogramação de atividade não atualiza prazo/risco da obra.
25. Novas obras começam com detalhe vazio, enquanto as obras mockadas recebem detalhe sintético.
26. Diário usa responsável da obra como autor e horário fixo, inadequado para auditoria.
27. Anexos ativos são somente nomes de arquivos. O gerenciador/validador de arquivos está fora da aplicação Angular.
28. Diversos campos já existem nos modelos, mas não são capturados nem exibidos; a regra funcional ainda não está definida.
29. Não há paginação em nenhuma listagem.
30. A pasta React/Vinext `app/` duplica e diverge da aplicação Angular, inclusive com formulários/filtros mais amplos e documentos; precisa ser oficialmente arquivada ou ter seu papel definido antes do backend.

---

## 25. Perfis e permissões consolidados

| Conceito | Situação atual |
| --- | --- |
| Administrador | Existe apenas como texto fixo no shell |
| Gestor/financeiro/operador/visualizador | Não existem como perfis funcionais |
| Controle de acesso por tela | Não existe; todas as telas internas compartilham o mesmo guard |
| Controle por ação | Não existe |
| Usuário responsável por alteração | Não registrado |
| Auditoria | Diário de obra parcial e simulado; demais módulos sem trilha |

Regra ainda não definida: quais perfis podem consultar, cadastrar, editar, baixar, negociar, ajustar caixa, exportar ou remover dados.

---

## 26. Visão consolidada solicitada

### 1. Todos os módulos encontrados

1. Acesso e navegação compartilhada.
2. Locações — Visão geral.
3. Carteiras.
4. Imóveis.
5. Unidades.
6. Locatários e imobiliárias.
7. Contratos.
8. Cobranças, itens, recebimentos, negociações e relatório contábil.
9. Despesas.
10. Obras — Painel e listagem.
11. Obras — Cadastro e edição.
12. Obras — Resumo, planejamento e pendências.
13. Obras — Equipe.
14. Obras — Fornecedores e pagamentos.
15. Obras — Sócios e aportes.
16. Obras — Financeiro.
17. Obras — Diário e arquivos.

### 2. Principais entidades de negócio

- Usuário/perfil, ainda apenas simulados.
- Carteira, Imóvel e Unidade.
- Imobiliária e Locatário.
- Contrato e regra de cobrança.
- Cobrança, item de cobrança, recebimento, alocação, negociação e parcela.
- Despesa.
- Obra, atividade, pendência e compromisso.
- Alocação de equipe/profissional.
- Fornecedor de obra, pagamento e documento.
- Sócio, participação, aporte, cota e pagamento de aporte.
- Lançamento financeiro.
- Registro de diário e arquivo.

### 3. Relações entre módulos

- Cadastros patrimoniais sustentam Contratos e Obras.
- Imobiliárias organizam Locatários; Locatários e Unidades compõem Contratos.
- Contratos geram Cobranças; Cobranças recebem baixas, negociações e originam o relatório.
- Cobranças, Contratos, Unidades e Despesas alimentam o Dashboard de Locações.
- Obras agregam planejamento, equipe, fornecedores, sócios, aportes, financeiro, pendências e diário.
- O financeiro de Obras e Despesas ainda não se relacionam.

### 4. Regras mais importantes

- Ocupação de unidades e vínculo criado pelo contrato.
- Geração e status de cobrança por competência/vencimento.
- Alocação de recebimentos e quitação.
- Negociação, cálculo em centavos e parcelamento mensal.
- Status e baixa de despesas.
- Saldo projetado e progresso de obra.
- Status e limite de pagamento de fornecedores.
- Participação total de 100%, rateio e integralização de aportes.
- Registro de ações operacionais no diário.

### 5. Dados compartilhados

- Nomes de carteira, imóvel, unidade e locatário são repetidos entre registros e telas.
- Contrato, cobrança e itens compartilham aluguel, vencimento, competência e encargos.
- Status/saldos de cobrança e despesa abastecem o dashboard.
- O registro principal da obra abastece painel, listagem, detalhe e gerador de mocks.
- Atividades, equipe, fornecedores, sócios, aportes e diário compartilham o contexto da obra.

### 6. Pontos que precisam de definição

- Identidade por ID, status e ciclos de vida das entidades.
- Perfis/permissões e autoria das operações.
- Fonte de data/hora, competência e regras de vencimento.
- Integridade carteira → imóvel → unidade → contrato.
- Encargos, reajustes, entrada de acordo, conciliação e estornos.
- Alocação de despesas e unificação de fornecedores/financeiro.
- Documentos reais e política de armazenamento.
- Sincronização entre financeiro detalhado e totais da obra.

### 7. Funcionalidades atualmente apenas simuladas

- Autenticação, todos os cadastros e todas as alterações de estado.
- Recebimentos, negociações, pagamentos, aportes e ajustes de caixa.
- Alertas, compromissos, usuário/perfil e anexos.
- Persistência inteira do sistema; apenas o download XLSX produz um artefato real no navegador.

### 8. Ordem futura resumida

1. Decisões de domínio, IDs, datas, arquivos e auditoria.
2. Identidade e autorização.
3. Carteiras, Imóveis, Unidades, Imobiliárias e Locatários.
4. Contratos.
5. Cobranças, recebimentos e negociações.
6. Despesas e financeiro comum.
7. Obras e suas subentidades.
8. Documentos, dashboards, alertas, relatórios e integrações.

A ordem detalhada está na próxima seção.

---

## 27. Sugestão de ordem futura de implementação do backend

Esta ordem é apenas de planejamento e considera as dependências encontradas.

1. **Decisões de domínio e infraestrutura**: IDs estáveis, enums/status, política de datas/fuso, moeda/arredondamento, auditoria, arquivos, exclusão/inativação e tratamento da pasta legada.
2. **Identidade e autorização**: usuários, autenticação, sessão, perfis e permissões por ação.
3. **Cadastros patrimoniais base**: Carteiras → Imóveis → Unidades, já com endereços e integridade referencial.
4. **Cadastros de relacionamento**: Imobiliárias e Locatários; decidir cadastro mestre de pessoas/empresas, fornecedores e profissionais.
5. **Contratos**: vigência, status, unidades, regras de cobrança, reajustes, garantias, documentos e eventos de ocupação/desocupação.
6. **Cobranças e itens**: competência, prevenção de duplicidade, regras de vencimento/encargos e máquina de status.
7. **Recebimentos e negociações**: alocações com IDs, entrada, parcelas, estorno, comprovantes, contas financeiras e conciliação.
8. **Despesas**: alocação patrimonial/obra, fornecedor, competência, aprovação, pagamentos parciais, documentos e integração financeira.
9. **Obras — núcleo operacional**: obra, cronograma, atividades, dependências, equipe e responsáveis, usando Imóvel/Unidade/Usuário reais.
10. **Obras — contratos e capital**: fornecedores/pagamentos, sócios/participações/aportes, lançamentos e saldo de caixa unificado.
11. **Documentos e diário/auditoria**: armazenamento real, metadados, vínculo por entidade, autor/data confiáveis e permissões.
12. **Consultas derivadas**: alertas, compromissos, indicadores e dashboards calculados a partir das fontes reais.
13. **Relatórios/exportações e integrações**: XLSX contábil validado, importações, bancos e demais integrações externas.

### Corte mínimo sugerido para a primeira API funcional

- Autenticação/autorização básica.
- Carteira, Imóvel, Unidade, Imobiliária e Locatário.
- Contrato com IDs relacionais e status.
- Cobrança/itens com competência e unicidade.
- Leitura das listas e detalhes sem mocks.

Recebimentos, negociação, despesas avançadas e Obras podem entrar nas ondas seguintes, evitando construir regras financeiras sobre relacionamentos ainda textuais.

---

## 28. Código legado/inativo e artefatos técnicos

### Implementação React/Vinext inativa

- `app/page.tsx` mantém outra aplicação completa baseada em estado React local, com os mesmos domínios principais e mocks duplicados.
- `app/works-mocks.ts` e `app/work-detail-mocks.ts` duplicam os registros e o gerador de detalhes de Obras.
- `app/accounting-report*.ts`, `app/charge-negotiation.ts`, `app/local-documents.ts` e `app/work-partners-model.ts` duplicam utilitários que hoje têm versões ativas em `src/app/core/utils`.
- `app/document-manager.tsx` e `app/file-field.tsx` implementam seleção/visualização local de documentos. Essa funcionalidade não foi ligada à versão Angular.
- `app/work-suppliers.tsx` e `app/work-partners.tsx` contêm componentes React separados e mais ricos, mas não são renderizados pela aplicação Angular.
- A versão React contém campos, filtros e diálogos adicionais. Eles não foram classificados como funcionalidades atuais porque `package.json`, `angular.json`, `src/main.ts` e os testes de rotas apontam para o Angular como runtime oficial.
- `app/page.tsx` e `app/globals.css` já tinham alterações locais antes deste levantamento; não foram modificados.

### Banco, worker e exemplos

- `db/schema.ts` exporta schema vazio.
- `db/index.ts` oferece `getDb()` para D1/Drizzle, mas nenhum código Angular o chama.
- `worker/index.ts`, `next.config.ts`, `vite.config.ts`, `drizzle/` e `examples/d1/` pertencem ao starter/fluxo Vinext anterior ou a exemplos opcionais.
- Não há migration de entidades do domínio atual.

### Utilitário de documentos órfão

- `src/app/core/utils/local-documents.ts` define limite de 10 MB, extensões PDF/DOC/DOCX/XLS/XLSX/JPG/JPEG/PNG, detecção de duplicidade e seis categorias documentais.
- Os testes desse utilitário passam, mas nenhuma página Angular o importa. Portanto, trata-se de capacidade técnica não disponível ao usuário atual.

### Risco para a próxima etapa

- Antes de implementar API, deve-se escolher uma única fonte oficial e remover ou arquivar a duplicação somente em uma etapa autorizada futura. Caso contrário, existe risco de implementar contratos de dados diferentes para duas interfaces divergentes.

---

## 29. Verificação do levantamento

- Foram inspecionados rotas, páginas Angular, componentes compartilhados, modelos, mocks, store, utilitários financeiros, regras de documentos, schema/worker e testes.
- Nenhum código da aplicação foi alterado.
- A suíte unitária foi executada sem build: 21 de 22 testes passaram. O único erro foi o teste de HTML renderizado, porque ele espera `dist/index.html`, enquanto o diretório existente não contém esse arquivo. Regras de relatório, negociação, documentos, sócios e rotas passaram.
- Já existiam alterações locais do usuário em `app/page.tsx` e `app/globals.css`; elas foram preservadas e não fazem parte deste levantamento funcional ativo.
