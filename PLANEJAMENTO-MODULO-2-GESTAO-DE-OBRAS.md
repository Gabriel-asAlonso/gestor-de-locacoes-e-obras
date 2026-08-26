# Planejamento simplificado do Módulo 2 - Gestão de Obras

## 1. Direção adotada

Este planejamento considera as seguintes decisões:

- o sistema deve ser fácil de entender e rápido de operar;
- esta fase é uma demonstração com dados mockados;
- não haverá banco de dados, API ou persistência real neste momento;
- alterações feitas durante o uso podem existir apenas na sessão e voltar ao estado inicial ao atualizar a página;
- não haverá integração bancária;
- o fluxo de caixa será apenas uma visão operacional da obra;
- funcionários serão acompanhados por função, alocação e atividades, sem recursos de RH ou folha de pagamento;
- o Módulo 2 deve seguir a identidade visual e os componentes já usados no Módulo 1.

## 2. Princípios para facilitar o uso

### 2.1 Menu curto

O módulo terá somente cinco opções principais no menu:

1. Visão geral
2. Obras
3. Cronograma
4. Equipe
5. Financeiro

Cadastro e detalhe de obra serão acessados a partir de **Obras**. Orçamentos, Gastos e Caixa serão abas de **Financeiro**, evitando três itens separados no menu.

### 2.2 Uma ação principal por tela

Cada página deve ter uma ação principal facilmente reconhecível:

- Visão geral: **Nova obra**;
- Obras: **Nova obra**;
- Cronograma: **Adicionar atividade**;
- Equipe: **Adicionar pessoa**;
- Financeiro: ação de acordo com a aba ativa.

Ações secundárias devem aparecer somente quando forem úteis ao contexto.

### 2.3 Linguagem simples

Preferir:

- **Mês de referência** em vez de competência;
- **Valor previsto** em vez de valor provisionado;
- **Valor gasto** em vez de realizado financeiro;
- **Responsável** em vez de recurso alocado;
- **Em atraso** em vez de desvio negativo de cronograma;
- **Registrar pagamento** somente quando houver um registro manual de pagamento na demonstração.

### 2.4 Informação progressiva

A listagem deve mostrar apenas o necessário para escolher uma obra. Informações extensas ficam no detalhe. Formulários devem ser divididos em passos curtos e os filtros menos usados devem ficar em **Mais filtros**.

### 2.5 Comportamentos previsíveis

- linhas e cartões abrem o detalhe;
- o botão principal fica sempre no mesmo lugar;
- situações usam texto, cor e ícone, nunca apenas cor;
- filtros têm botão **Limpar filtros**;
- formulários avisam antes de descartar alterações;
- mensagens da demonstração dizem **Atualizado nesta sessão**, sem sugerir que houve gravação definitiva;
- no celular, tabelas viram cartões e as ações principais permanecem visíveis.

## 3. Navegação simplificada

```text
Módulo 2 - Gestão de Obras
├── 01. Visão geral
├── 02. Obras
│   ├── 03. Nova obra / Editar obra
│   └── 04. Detalhe da obra
├── 05. Cronograma
├── 06. Equipe
└── 07. Financeiro
    ├── Orçamentos
    ├── Gastos
    └── Caixa
```

## 4. Ordem numérica para desenvolvimento

| Ordem | Página | Rota sugerida | Entrada no menu |
|---|---|---|---|
| 01 | Visão geral | `/obras` | Sim |
| 02 | Obras | `/obras/lista` | Sim |
| 03 | Nova obra / Editar obra | `/obras/nova` e `/obras/[id]/editar` | Não, acessada por Obras |
| 04 | Detalhe da obra | `/obras/[id]` | Não, acessada por Obras |
| 05 | Cronograma | `/obras/cronograma` | Sim |
| 06 | Equipe | `/obras/equipe` | Sim |
| 07 | Financeiro | `/obras/financeiro` | Sim |

As páginas devem ser construídas e validadas nessa ordem. A página seguinte só precisa começar depois que estrutura, conteúdo e interações principais da página atual estiverem aprovados.

---

# Página 01 - Visão geral

## Objetivo

Mostrar rapidamente o que está acontecendo e o que exige atenção. A página deve ajudar o usuário a decidir a próxima ação, sem funcionar como um painel excessivamente analítico.

## Funções

1. Filtrar por imóvel e período.
2. Mostrar quatro indicadores:
   - obras em andamento;
   - obras em atraso;
   - total gasto;
   - saldo projetado das obras.
3. Mostrar **O que precisa de atenção**:
   - atividade atrasada;
   - obra sem atualização recente;
   - orçamento aguardando escolha;
   - gasto acima do previsto;
   - pagamento manual próximo do vencimento.
4. Mostrar as obras em andamento com:
   - nome;
   - imóvel;
   - responsável;
   - progresso;
   - prazo final;
   - situação.
5. Mostrar os próximos compromissos do cronograma.
6. Abrir uma obra ao clicar na linha ou no cartão.
7. Criar uma obra pelo botão **Nova obra**.

## Organização visual

1. Título e botão Nova obra.
2. Filtros simples.
3. Bloco O que precisa de atenção.
4. Quatro indicadores.
5. Obras em andamento.
6. Próximas datas.

As pendências devem aparecer antes dos indicadores para priorizar o trabalho, especialmente no celular.

## Decisões de simplicidade

- usar somente quatro indicadores;
- não incluir gráficos complexos na primeira versão;
- não repetir a mesma informação em mais de um bloco;
- exibir no máximo cinco pendências, com opção **Ver todas**;
- mostrar filtros avançados somente quando solicitados.

## Critério de conclusão da página

A página estará pronta quando o usuário conseguir identificar uma obra atrasada, abrir seu detalhe e iniciar uma nova obra sem precisar procurar essas ações no menu.

---

# Página 02 - Obras

## Objetivo

Ser o ponto principal de consulta de obras, reformas, reparos e manutenções.

## Funções

1. Pesquisar por código, nome da obra ou imóvel.
2. Filtrar inicialmente por:
   - situação;
   - imóvel;
   - responsável.
3. Disponibilizar em **Mais filtros**:
   - tipo de intervenção;
   - prioridade;
   - período;
   - somente obras atrasadas.
4. Ordenar por:
   - maior prioridade;
   - prazo mais próximo;
   - atualização mais recente.
5. Exibir em cada obra:
   - código;
   - nome;
   - imóvel;
   - responsável;
   - progresso;
   - prazo;
   - gasto atual;
   - situação.
6. Abrir o detalhe ao clicar na obra.
7. Criar uma obra.
8. Editar os dados básicos.
9. Pausar, retomar, concluir ou cancelar por meio do detalhe.
10. Limpar todos os filtros com um único botão.

## Organização visual

- cabeçalho com título e Nova obra;
- busca e três filtros principais;
- contador de resultados;
- lista no desktop;
- cartões no celular;
- paginação apenas quando a quantidade mockada justificar.

## Decisões de simplicidade

- não oferecer quadro Kanban nesta primeira versão;
- tornar a linha inteira clicável e manter a ação explícita **Abrir**;
- mostrar apenas colunas essenciais;
- usar situações padronizadas: Planejada, Em andamento, Pausada, Concluída e Cancelada;
- mostrar **Em atraso** como um alerta adicional, não como uma situação concorrente.

## Critério de conclusão da página

A página estará pronta quando o usuário conseguir localizar qualquer obra usando busca ou filtros, abrir o detalhe e iniciar um novo cadastro.

---

# Página 03 - Nova obra / Editar obra

## Objetivo

Permitir o cadastro de uma obra sem apresentar um formulário longo e intimidador.

## Estrutura em três passos

### Passo 1 - Dados da obra

- tipo: obra, reforma, reparo, manutenção ou emergência;
- nome da obra;
- imóvel;
- unidade opcional;
- descrição curta;
- prioridade.

### Passo 2 - Responsáveis e prazo

- responsável principal;
- pessoas iniciais da equipe, opcional;
- início previsto;
- término previsto;
- situação inicial: Planejada ou Em andamento.

### Passo 3 - Valores e observações

- valor previsto;
- reserva opcional;
- observações;
- fotos ou arquivos demonstrativos opcionais;
- revisão dos dados antes de concluir.

## Funções

1. Avançar e voltar entre os passos sem perder dados da sessão.
2. Mostrar o progresso do formulário: 1 de 3, 2 de 3 e 3 de 3.
3. Preencher valores iniciais simples e permitir edição.
4. Validar campos obrigatórios ao sair do passo.
5. Impedir término anterior ao início.
6. Garantir que a unidade pertença ao imóvel escolhido.
7. Cancelar com confirmação somente se houver alterações.
8. Salvar no estado mockado da sessão.
9. Mostrar **Obra adicionada à demonstração** ou **Obra atualizada nesta sessão**.
10. Abrir o detalhe após a criação.

## Decisões de simplicidade

- no máximo seis campos visíveis por passo;
- campos opcionais identificados claramente;
- imóvel escolhido filtra automaticamente as unidades;
- responsável principal aparece antes da equipe adicional;
- etapas, orçamentos e gastos serão adicionados depois, dentro do detalhe;
- não exigir o preenchimento completo para demonstrar o fluxo.

## Critério de conclusão da página

A página estará pronta quando uma pessoa conseguir cadastrar uma obra mockada nos três passos, visualizar mensagens de validação claras e chegar ao detalhe da nova obra.

---

# Página 04 - Detalhe da obra

## Objetivo

Concentrar tudo o que pertence a uma obra sem obrigar o usuário a navegar por várias páginas.

## Cabeçalho da obra

- nome e código;
- imóvel e unidade;
- situação;
- prioridade;
- responsável;
- progresso;
- prazo final;
- valor previsto e gasto;
- ação principal **Registrar atualização**;
- ações secundárias em menu: editar, pausar, retomar, concluir e cancelar.

## Abas

### Aba 1 - Resumo

1. Mostrar progresso e prazo.
2. Mostrar próxima atividade.
3. Mostrar responsável e equipe principal.
4. Mostrar previsto, gasto e saldo.
5. Mostrar pendências.
6. Mostrar as últimas atualizações.
7. Oferecer atalhos para adicionar atividade, gasto ou orçamento.

### Aba 2 - Planejamento

1. Criar etapas.
2. Criar atividades dentro das etapas.
3. Informar responsável, início, término e situação.
4. Marcar atividade como concluída.
5. Bloquear atividade e informar motivo.
6. Reprogramar data com justificativa.
7. Calcular o progresso da obra pelas atividades.

Situações das atividades: Não iniciada, Em andamento, Bloqueada e Concluída.

### Aba 3 - Equipe

1. Visualizar pessoas alocadas.
2. Adicionar ou remover alocação na sessão.
3. Informar função na obra.
4. Informar período de participação.
5. Relacionar a pessoa às atividades.
6. Registrar horas ou diárias mockadas, quando necessário.
7. Mostrar custo estimado da mão de obra.

### Aba 4 - Financeiro

1. Mostrar resumo de orçamentos, gastos e caixa da obra.
2. Adicionar orçamento.
3. Selecionar orçamento.
4. Adicionar gasto.
5. Marcar pagamento manual como realizado.
6. Registrar aporte ou ajuste manual no caixa.
7. Abrir a página Financeiro já filtrada por esta obra.

### Aba 5 - Diário e arquivos

1. Registrar atualização de andamento.
2. Informar ocorrência ou pendência.
3. Adicionar observação.
4. Adicionar fotos ou arquivos mockados.
5. Exibir histórico cronológico.
6. Não sobrescrever atualizações anteriores durante a sessão.

## Decisões de simplicidade

- usar somente cinco abas;
- manter o cabeçalho da obra visível durante a navegação entre abas;
- mostrar no Resumo somente informações que ajudam na próxima decisão;
- usar atalhos contextuais em vez de repetir o menu completo;
- agrupar diário e arquivos, pois ambos registram a evolução da obra;
- agrupar orçamentos, gastos e caixa no mesmo contexto financeiro.

## Critério de conclusão da página

A página estará pronta quando o usuário conseguir entender a situação da obra, atualizar seu andamento e acessar planejamento, equipe e financeiro sem voltar ao menu principal.

---

# Página 05 - Cronograma

## Objetivo

Reunir datas e atividades de todas as obras em uma visão simples.

## Funções

1. Alternar entre:
   - agenda por data;
   - calendário mensal.
2. Filtrar por obra, responsável e situação.
3. Mostrar atividades:
   - atrasadas;
   - para hoje;
   - próximas;
   - concluídas;
   - bloqueadas.
4. Abrir a atividade e sua obra.
5. Adicionar atividade escolhendo a obra.
6. Concluir atividade.
7. Reprogramar atividade com justificativa.
8. Mostrar legenda simples de situações.

## Decisões de simplicidade

- começar com agenda e calendário, sem Gantt;
- usar agenda vertical no celular;
- abrir edição em painel lateral, sem retirar o usuário do cronograma;
- destacar atraso com texto e ícone;
- limitar os filtros iniciais a obra, responsável e situação.

## Critério de conclusão da página

A página estará pronta quando o usuário conseguir descobrir o que está atrasado, o que acontece hoje e o que vem a seguir.

---

# Página 06 - Equipe

## Objetivo

Acompanhar funcionários e prestadores envolvidos nas obras, sem criar um módulo de RH.

## Funções

1. Listar pessoas ativas.
2. Pesquisar por nome ou função.
3. Filtrar por obra, tipo e situação.
4. Mostrar:
   - nome;
   - funcionário ou prestador;
   - função;
   - obras atuais;
   - atividades em andamento;
   - atividades atrasadas;
   - contato.
5. Adicionar pessoa mockada.
6. Editar dados básicos na sessão.
7. Alocar em uma obra.
8. Informar função e período da alocação.
9. Abrir uma obra relacionada.
10. Inativar pessoa sem apagar o histórico da sessão.

## Dados mínimos da pessoa

- nome;
- tipo: funcionário ou prestador;
- função ou especialidade;
- telefone ou e-mail;
- custo de referência opcional por hora ou diária;
- situação: ativa ou inativa;
- observação opcional.

## Fora desta página

- folha de pagamento;
- benefícios;
- férias;
- controle de ponto legal;
- documentos pessoais sensíveis;
- recrutamento.

## Decisões de simplicidade

- usar cadastro curto em painel lateral;
- mostrar o detalhe da pessoa sem sair da página;
- não exigir custo para cadastrar uma pessoa;
- destacar somente atividades atrasadas e alocações atuais;
- usar os termos Funcionário e Prestador, evitando siglas.

## Critério de conclusão da página

A página estará pronta quando o usuário conseguir identificar quem trabalha em cada obra e quais pessoas possuem atividades atrasadas.

---

# Página 07 - Financeiro

## Objetivo

Reunir orçamentos, gastos e fluxo de caixa em uma única página, sem integração bancária e sem contabilidade avançada.

## Filtros compartilhados

- obra;
- imóvel;
- período.

Os filtros permanecem ativos ao trocar de aba.

## Aba 1 - Orçamentos

### Funções

1. Listar cotações de todas as obras.
2. Filtrar por situação e fornecedor/prestador.
3. Adicionar orçamento mockado.
4. Informar obra, etapa opcional, descrição, fornecedor, valor, recebimento e validade.
5. Comparar propostas do mesmo serviço.
6. Selecionar uma proposta.
7. Registrar o motivo da escolha.
8. Anexar nome de arquivo demonstrativo.
9. Sugerir a criação de um gasto previsto, sem criar pagamento automaticamente.

Situações: Solicitado, Recebido, Selecionado, Rejeitado e Expirado.

## Aba 2 - Gastos

### Funções

1. Mostrar valor previsto, gasto e saldo.
2. Listar gastos por obra, categoria e data.
3. Adicionar gasto mockado.
4. Informar descrição, obra, categoria, fornecedor, valor, data e situação.
5. Marcar como previsto, pendente ou pago.
6. Anexar nome de comprovante demonstrativo.
7. Destacar gastos acima do previsto.
8. Abrir a obra relacionada.

## Aba 3 - Caixa

### Funções

1. Mostrar:
   - saldo inicial;
   - entradas;
   - saídas;
   - saldo atual;
   - saldo projetado.
2. Exibir previsto x realizado por mês.
3. Listar movimentos em ordem de data.
4. Registrar manualmente:
   - aporte;
   - reembolso;
   - ajuste;
   - saída vinculada a gasto.
5. Diferenciar movimento previsto de movimento realizado.
6. Filtrar por tipo e situação.

## Regras financeiras simples

1. Orçamento não é pagamento.
2. Gasto pendente entra na projeção, mas não reduz o saldo realizado.
3. Somente movimento marcado como realizado altera o saldo atual.
4. Um gasto pago deve gerar no máximo uma saída de caixa na sessão.
5. Não haverá conta bancária, conciliação, importação ou integração externa.
6. Todos os valores serão demonstrativos e reiniciados ao recarregar a aplicação.

## Decisões de simplicidade

- usar uma página com três abas, evitando três itens no menu;
- manter os mesmos filtros durante a troca de abas;
- explicar Previsto e Realizado em textos curtos;
- não exibir termos contábeis avançados;
- usar confirmação apenas ao marcar pagamento ou substituir orçamento selecionado;
- não incluir gráficos complexos; uma comparação mensal simples é suficiente.

## Critério de conclusão da página

A página estará pronta quando o usuário conseguir comparar um orçamento, registrar um gasto e entender o saldo projetado de uma obra sem interpretar isso como integração bancária.

---

## 5. Dados mockados

Os dados devem ficar em arquivos próprios, separados dos componentes visuais. Sugestão:

```text
app/data/works-mocks.ts
app/data/team-mocks.ts
app/data/budget-mocks.ts
app/data/expense-mocks.ts
app/data/cash-mocks.ts
```

### Comportamento esperado

- os dados iniciais são carregados ao abrir a demonstração;
- inclusões e alterações atualizam o estado React durante a sessão;
- navegar entre páginas não apaga as alterações da sessão;
- atualizar o navegador restaura os dados iniciais;
- nenhum botão depende de servidor, banco ou API;
- documentos podem usar apenas nome, tipo, tamanho e URL temporária local;
- mensagens devem deixar claro que a operação pertence à demonstração.

### Quantidade inicial recomendada

- 8 obras em diferentes situações;
- 5 imóveis já existentes no Módulo 1;
- 10 pessoas entre funcionários e prestadores;
- 20 atividades;
- 8 grupos de orçamento com propostas comparáveis;
- 18 gastos;
- 15 movimentos de caixa;
- atualizações e pendências suficientes para preencher a Visão geral.

## 6. Estados obrigatórios

Mesmo com dados mockados, cada página deve demonstrar:

- carregamento curto apenas quando necessário para a apresentação;
- conteúdo normal;
- lista vazia;
- nenhum resultado para filtros;
- erro demonstrativo recuperável;
- sucesso na sessão;
- formulário com erro de validação;
- confirmação antes de descartar alterações;
- versão responsiva para celular.

## 7. Recursos fora desta fase

- banco de dados e persistência definitiva;
- APIs e backend real;
- integração bancária;
- conciliação bancária;
- emissão fiscal;
- compras e estoque;
- folha de pagamento e RH;
- relatórios gerenciais e exportações;
- permissões granulares e auditoria;
- alertas automáticos externos.

## 8. Sequência de trabalho

1. Construir e validar Página 01 - Visão geral.
2. Construir e validar Página 02 - Obras.
3. Construir e validar Página 03 - Nova obra / Editar obra.
4. Construir e validar Página 04 - Detalhe da obra.
5. Construir e validar Página 05 - Cronograma.
6. Construir e validar Página 06 - Equipe.
7. Construir e validar Página 07 - Financeiro.
8. Fazer uma revisão final de navegação, linguagem, responsividade e consistência entre todas as páginas.

A primeira página a ser detalhada visualmente e implementada deve ser **Página 01 - Visão geral**.
