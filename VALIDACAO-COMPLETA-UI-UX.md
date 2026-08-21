# Validação completa de telas, fluxos e lógica

**Sistema:** Locações e Recebíveis — Módulo 1  
**Data da validação:** 14 de agosto de 2026  
**Escopo:** login, visão geral, oito áreas funcionais, filtros, tabelas, detalhes, formulários, cadastros, contratos, cobranças, recebimentos e contas a pagar.  
**Viewports avaliados:** desktop (1440 × 900), notebook (1024 × 768) e celular (390 × 844).

> A validação foi realizada sem alterações no código do produto.

## Resumo executivo

A base visual é consistente, mas a versão atual ainda não está segura nem simples o suficiente para uso operacional. Os maiores problemas não são estéticos: estão na persistência, integridade dos vínculos, recebimentos, geração de cobranças e responsividade.

## Pontos positivos

- A hierarquia visual e o padrão geral de tabelas, formulários e detalhes são coerentes.
- A composição da cobrança e a distribuição por item são fáceis de visualizar.
- A edição de carteira, imóvel, unidade e locatário carrega os dados existentes.
- A validação de CPF/CNPJ dos locatários está bem implementada.
- Existem estados de carregamento, erro, vazio, offline e sucesso.
- O sistema impede selecionar unidades já ocupadas ao criar contrato.

## Problemas de prioridade alta

| Tela/Fluxo | Problema | Impacto | Sugestão | Prioridade |
|---|---|---|---|---|
| Contratos, cobranças e recebimentos | As ações exibem sucesso, mas não atualizam os dados. O contrato não aparece na lista, a cobrança não é criada e o recebimento não altera saldo, histórico ou status. | O usuário acredita que concluiu uma operação inexistente. | Só apresentar sucesso depois de atualizar e confirmar o registro. Implementar estado e persistência transacional. | Alta |
| Cadastros em geral | Carteiras, imóveis, unidades e locatários existem apenas na memória e desaparecem ao recarregar. | Perda de trabalho e ausência de confiabilidade. | Persistir os dados antes de considerar esses fluxos prontos para operação. | Alta |
| Registrar recebimento | O modal começa preenchido com todo o saldo, deixando “Saldo após esta baixa: R$ 0,00”. | Um clique apressado pode quitar integralmente uma cobrança parcial. | Começar com “Valor recebido” vazio e distribuir somente depois que o total for informado. | Alta |
| Registrar recebimento | É possível confirmar uma baixa de R$ 0,00; o sistema mostra mensagem de sucesso. | Produz uma operação sem efeito e um histórico enganoso. | Exigir valor maior que zero e não superior ao saldo. | Alta |
| Registrar recebimento | O usuário precisa editar diretamente cada item, sem informar primeiro o total efetivamente recebido. | Aumenta o esforço e o risco de soma incorreta. | Usar “Valor recebido” como entrada principal e oferecer distribuição automática, com revisão. | Alta |
| Contrato → Criar cobrança | Ao partir do contrato CTR-018, o formulário abriu selecionando CTR-014 e valores de outro contrato. | Pode gerar cobrança para o locatário e contrato errados. | Fixar ou pré-selecionar o contrato de origem e carregar seus itens e valores. | Alta |
| Nova cobrança | Trocar o contrato não recalcula itens, valores nem vencimentos. | A composição pode continuar pertencendo ao contrato anterior. | Regenerar os itens ao trocar o contrato, preservando alterações apenas mediante confirmação. | Alta |
| Nova cobrança | É possível remover todos os itens e salvar uma cobrança de R$ 0,00. | Permite cobrança vazia e sem significado financeiro. | Exigir ao menos um item válido e total positivo. | Alta |
| Nova cobrança | Não existe verificação de duplicidade por contrato e mês de referência. | O mesmo aluguel pode ser cobrado duas vezes. | Criar unicidade por contrato + competência, com tratamento explícito de exceções. | Alta |
| Geração mensal | O contrato já conhece aluguel, vencimento e itens, mas cada cobrança precisa ser montada manualmente. | Repete trabalho todos os meses e transfere decisões ao usuário. | Gerar automaticamente as cobranças do mês ou oferecer “Gerar cobranças do mês” com revisão de exceções. | Alta |
| Novo contrato | O formulário aceitou término anterior ao início, aluguel zero e vencimento no dia 31. | Permite contratos incoerentes e vencimentos problemáticos. | Validar período, valor e regra de vencimento; usar último dia útil ou último dia do mês quando necessário. | Alta |
| Contrato ativo | A interface diz que é preciso encerrar o contrato, mas não oferece “Encerrar contrato”. | O usuário recebe uma instrução impossível de executar. | Disponibilizar encerramento ou aditivo no próprio detalhe, preservando o histórico. | Alta |
| Edição de vínculos | É possível mover imóvel de carteira ou unidade ocupada de imóvel sem atualizar contratos, cobranças e demais referências. | Cria relações contraditórias e dados órfãos. | Usar IDs nos vínculos e operações transacionais; bloquear mudanças incompatíveis ou propagá-las com segurança. | Alta |
| Contadores e filtros | Após criar um imóvel, a carteira continuou mostrando zero imóveis. A carteira nova também não apareceu nos filtros. | Indicadores e filtros passam a divergir dos cadastros reais. | Calcular contadores a partir dos vínculos e gerar filtros a partir do estado atual. | Alta |
| Novos cadastros | Novos registros utilizam referências fixas como `CAR-DEMO-003` e `IMO-DEMO-005`. | Cadastros repetidos podem receber o mesmo identificador. | Gerar IDs únicos no armazenamento. | Alta |
| Nova unidade | O usuário pode marcar uma unidade nova como “Ocupada” sem contrato. | A ocupação deixa de representar contratos ativos. | Remover “Status inicial”; a unidade deve nascer disponível e a ocupação ser calculada pelos contratos. | Alta |
| Celular | “Nova carteira”, “Novo imóvel”, “Nova unidade”, “Novo locatário”, “Novo contrato” e “Nova cobrança” ficam ocultos. | No celular, o usuário consegue consultar, mas não iniciar as tarefas principais. | Manter a ação abaixo do título ou em um rodapé de ação fixo. | Alta |
| Tabelas responsivas | No celular, uma tabela de aproximadamente 1.031 px cabe em 333 px. Em notebook, Contas a Pagar ocupa cerca de 1.159 px em 877 px. | Valor, status e ação ficam fora da tela e exigem rolagem horizontal extensa. | Transformar linhas em cards no celular e ocultar colunas secundárias no notebook. | Alta |
| Datas e status | A lógica usa 12/08/2026 como “hoje”; durante a auditoria, em 14/08/2026, a conta de 12/08 ainda aparecia como “Vence hoje”. Formulários também usam datas fixas. | Prazos e prioridades podem estar incorretos. | Calcular datas no fuso da operação ou exibir claramente “Posição em 12/08/2026” em todas as telas demonstrativas. | Alta |
| Contas a pagar | Uma conta vencida informa que “precisa de acompanhamento”, mas o único botão é fechar. | O fluxo termina justamente quando o usuário precisa agir. | Se a tela for operacional, incluir “Registrar pagamento”. Se for somente consulta, mudar título e descrição para deixar isso explícito. | Alta |
| Visão geral | As prioridades financeiras aparecem somente depois de toda a parte patrimonial; no celular começam por volta de 2.665 px. | O que exige ação imediata fica a mais de três telas de distância. | Mostrar “O que precisa de atenção hoje” no início da página. | Alta |
| Offline | Ao ficar offline, o sistema esconde os dados e mostra erro, embora o aviso diga que eles podem apenas estar desatualizados. | Impede a consulta e transmite mensagens contraditórias. | Manter o último conteúdo visível em modo somente leitura e bloquear apenas ações de gravação. | Alta |

## Problemas de prioridade média

| Tela/Fluxo | Problema | Impacto | Sugestão | Prioridade |
|---|---|---|---|---|
| Navegação desktop | A barra começa recolhida e usa grupos expansíveis mesmo com apenas oito páginas. Cada troca exige abrir um grupo e escolher a página. | Acrescenta cliques recorrentes e exige memorizar ícones. | Manter as opções visíveis no desktop e reservar o acordeão para celular. | Média |
| Visão geral | “Ocupação”, “Unidades disponíveis” e “Ocupação por carteira” repetem a mesma informação. | Ocupa a primeira tela sem acrescentar uma nova decisão. | Manter a ocupação consolidada e o detalhamento por carteira; remover o card redundante. | Média |
| Visão geral | Gráfico, rosca, seis indicadores e quatro painéis competem com a lista de prioridades. | A tela informa muito, mas orienta pouco sobre a próxima ação. | Priorizar tarefas e depois o resumo financeiro; mover análises históricas para uma visão secundária. | Média |
| Cobranças | A tabela mostra “Próxima”, mas não mostra o vencimento principal. | O usuário precisa abrir a cobrança para descobrir quando vence. | Substituir informação secundária por “Próximo vencimento” ou “Vencimento mais antigo”. | Média |
| Cobranças | “Competência”, “baixa manual” e “cobrança composta” são termos pouco didáticos. | Usuários não financeiros podem não compreender a ação. | Usar “Mês de referência”, “Registrar recebimento” e “Detalhes da cobrança”. | Média |
| Cobranças | Os cards de status filtram a tabela, mas existe também um filtro de situação logo abaixo. | Há duas formas concorrentes de executar a mesma ação. | Manter os cards como atalhos e remover o select no desktop, ou deixar os cards somente informativos. | Média |
| Contas a pagar | Os indicadores permanecem globais após aplicar filtros. | O usuário pode interpretar o total como pertencente às linhas filtradas. | Atualizar os indicadores conforme o filtro ou marcar explicitamente “Total geral”. | Média |
| Contas a pagar | Os cards se parecem com os cards clicáveis de Cobranças, mas não filtram. | Comportamentos visualmente semelhantes produzem resultados diferentes. | Tornar todos acionáveis ou diferenciar claramente indicadores de filtros. | Média |
| Filtros | O estado vazio orienta “limpe os filtros”, mas não oferece o comando. | O usuário precisa desfazer busca e selects manualmente. | Adicionar “Limpar filtros” quando houver algum filtro ativo. | Média |
| Contas a pagar | Não há ordenação; a ordem depende do cadastro. | Com muitos registros, identificar o próximo vencimento será trabalhoso. | Usar “Mais urgentes” como padrão e permitir ordenar por vencimento, valor e fornecedor. | Média |
| Formulários | Clicar fora, fechar ou pressionar Esc descarta os dados preenchidos sem aviso. | Pode causar perda de trabalho em contratos e cobranças longas. | Confirmar o descarte apenas quando o formulário estiver alterado. | Média |
| Carteira | O documento do titular não possui máscara, detecção CPF/CNPJ ou validação. | Aceita documentos incompletos, inválidos e inconsistentes. | Detectar pelo número de dígitos, aplicar máscara e validar como no cadastro de locatários. | Média |
| Locatário | O campo “Tipo” usa apenas “PJ” e “PF”. | Exige que o usuário conheça as siglas. | Mostrar “Pessoa jurídica (PJ)” e “Pessoa física (PF)”. | Média |
| Formulário de contrato | O mês de reajuste começa em janeiro e precisa ser informado separadamente. | O usuário decide algo que normalmente deriva da data inicial. | Preencher automaticamente pelo mês de início, permitindo alteração. | Média |
| Listagens | Cobranças usam a linha inteira clicável e acessível por teclado; contratos e despesas usam outra combinação. | O comportamento de abrir detalhes muda entre as telas. | Padronizar: linha acessível + ação explícita “Ver detalhes”, ou somente ação explícita. | Média |
| Fechamento de detalhes | Alguns detalhes usam “Fechar”, outros “Fechar detalhes”; em Despesas o fechamento recebe estilo de ação principal. | Ações secundárias competem visualmente com ações operacionais. | Padronizar “Fechar” como ação secundária. | Média |
| Login demonstrativo | E-mail e senha vêm preenchidos e qualquer combinação válida no HTML permite entrar. | Acrescenta uma falsa etapa de autenticação. | Na demonstração, usar “Entrar na demonstração”; na produção, autenticação real sem credenciais públicas. | Média |
| Estados de carregamento | Toda navegação adiciona artificialmente cerca de 450 ms de carregamento, mesmo com dados locais. | Faz o sistema parecer mais lento e interrompe a orientação. | Exibir carregamento somente quando existir uma requisição real. | Média |
| Ciclo de vida dos cadastros | Não existe arquivamento ou inativação de carteiras, imóveis, unidades e locatários. | Registros obsoletos tendem a poluir filtros e listagens. | Preferir “Arquivar” ou “Inativar” à exclusão física, com bloqueios por vínculo ativo. | Média |
| Legibilidade | Textos de apoio, filtros e dados secundários usam 12 px de forma predominante. | Reduz a leitura rápida, especialmente para usuários menos familiarizados ou com baixa visão. | Usar 14 px como base para conteúdo e reservar 12 px para metadados realmente secundários. | Média |

## Problemas de prioridade baixa

| Tela/Fluxo | Problema | Impacto | Sugestão | Prioridade |
|---|---|---|---|---|
| Contas a pagar | A nota cita “documentação aprovada”. | Expõe justificativa interna e reforça a aparência de protótipo. | Remover; mostrar “Forma de pagamento não informada” apenas quando necessário. | Baixa |
| Rodapés das tabelas | Textos como “Base demonstrativa”, “PF e PJ”, “Inclusão e baixa manuais” e “Valores demonstrativos” agregam pouco. | Aumentam o ruído visual. | Manter somente contagem, paginação e informações acionáveis. | Baixa |
| Ambiente demonstrativo | “Dados fictícios” aparece repetidamente no login, topo e barra lateral. | Consome espaço sem aumentar a compreensão. | Manter um aviso persistente no topo e remover as repetições. | Baixa |
| Breadcrumb | “Módulo 1 / Página” repete o título e não mostra a seção real. | Ajuda pouco o usuário a entender a localização. | Usar “Financeiro / Contas a pagar” ou remover quando não houver profundidade. | Baixa |
| Botões de fechar | Alguns modais têm como nome acessível apenas “×”. | Prejudica leitores de tela e a consistência. | Usar `aria-label="Fechar"` em todos. | Baixa |
| Movimento reduzido | A preferência de redução de movimento cobre skeletons, mas não drawer, modal, spinner e expansão da barra lateral. | Pode incomodar usuários sensíveis a animações. | Aplicar `prefers-reduced-motion` a todas as transições não essenciais. | Baixa |
| Detalhe de despesa | Status e vencimento são repetidos no topo, painel de valor e lista de detalhes. | Aumenta a extensão sem trazer nova informação. | Exibir cada informação uma vez, mantendo atraso e valor em destaque. | Baixa |

## Mudanças que mais fariam diferença

1. Fazer contrato, cobrança e recebimento realmente atualizarem e persistirem os dados, sem mensagens de sucesso fictícias.
2. Redesenhar o recebimento: valor vazio, maior que zero, distribuição assistida e confirmação do resultado.
3. Gerar cobranças a partir do contrato, preservando contexto, itens, valores e vencimentos e impedindo duplicidades.
4. Garantir a integridade dos vínculos usando IDs, contadores derivados e atualizações transacionais.
5. Restaurar as ações no celular e substituir tabelas largas por listas responsivas orientadas a tarefa.
6. Calcular datas e status dinamicamente no fuso correto.
7. Colocar vencidos, pagamentos parciais e próximas ações no início da Visão geral.
8. Completar o ciclo do contrato com validações, encerramento ou aditivo e regras de sobreposição.
9. Definir claramente se Contas a Pagar é consulta ou operação; se for operação, permitir registrar pagamento.
10. Simplificar a navegação desktop, a linguagem financeira e os filtros duplicados.
11. Proteger formulários alterados contra fechamento acidental e manter a consulta disponível offline.
12. Remover textos internos, repetições e microinformações que não ajudam o usuário a decidir ou agir.

## Direção recomendada

A recomendação é corrigir primeiro a integridade e a segurança operacional, depois a responsividade e a redução de passos. A base visual atual pode ser preservada; não há necessidade de uma reformulação estética ampla.
