# Auditoria de UI/UX — Locações e Recebíveis

**Data da auditoria:** 13 de agosto de 2026  
**Escopo:** Login, oito áreas funcionais, filtros, tabelas, drawers, formulários e fluxos de recebimento.  
**Viewports avaliados:** Desktop (1440×900), notebook (1024×768) e celular (390×844).

> A auditoria foi realizada sem alterações no código do produto.

## Avaliação geral

### UI: 7,1/10

A base visual é boa: paleta coerente, hierarquia clara, status fáceis de reconhecer, cards financeiros bem organizados e consistência razoável entre tabelas, formulários e drawers. O sistema já parece mais cuidado que um protótipo genérico.

A nota cai principalmente por tipografia excessivamente pequena, contrastes insuficientes em textos secundários, tabelas muito rígidas e alguns elementos visuais de baixa maturidade, especialmente ícones, ações compactas e comportamento responsivo.

### UX: 5,5/10

A arquitetura da informação é compreensível e os principais conceitos do negócio estão bem representados. Busca, filtros, detalhamento de cobranças e distribuição de recebimentos têm uma boa base.

Entretanto, existem problemas capazes de gerar erro operacional: “Editar” abre cadastros vazios, cobranças criadas a partir de contratos perdem o contexto, seleções dependentes podem ficar incompatíveis, o recebimento começa como quitação total e as principais ações desaparecem no celular. Acessibilidade dos diálogos e navegação diária também precisam de correção.

## Problemas sistêmicos

### G-01 — Ações primárias no celular

**Prioridade: Crítica**

- **Local:** Cabeçalho de Pendências, Carteiras, Imóveis, Unidades, Locatários, Contratos e Cobranças.
- **Problema atual:** A regra responsiva oculta completamente botões como “Nova cobrança”, “Nova carteira” e “Novo contrato”.
- **Impacto:** No celular, o usuário consegue consultar, mas não iniciar essas tarefas. É uma quebra funcional, não apenas visual.
- **Recomendação:** Manter a ação visível abaixo da descrição da página, com largura total e altura mínima de 44 px. Em páginas longas, considerar rodapé de ação fixo, sem encobrir conteúdo.

### G-02 — Tabelas não adaptadas a notebook e celular

**Prioridade: Alta**

- **Local:** Todas as listagens, sobretudo Cobranças, Contratos e Contas a Pagar.
- **Problema atual:** As tabelas mantêm largura mínima de 1.000–1.035 px. No celular, ficam dentro de aproximadamente 337 px úteis; em 1024 px a tabela financeira também ultrapassa a área disponível.
- **Impacto:** Colunas importantes, como valor, status e ação, ficam fora da tela. O usuário precisa descobrir e operar rolagem horizontal extensa, perdendo o contexto da linha.
- **Recomendação:** Abaixo de 760 px, converter cada linha em item compacto contendo identificação, entidade, valor, vencimento/status e ação “Ver detalhes”. Entre 761 e 1100 px, reduzir colunas secundárias, permitir expansão da linha e manter identificação e ação visíveis.









## Auditoria tela por tela

### 1. Login

A tela está bem resolvida em desktop e celular. A separação entre marca e formulário é clara, a hierarquia funciona e o comportamento responsivo é adequado.


### 2. Pendências

A tela oferece a melhor visão operacional do sistema. Os indicadores de vencidas, próximas e parciais são legíveis, e o saldo recebe o destaque correto.





### 4. Imóveis

A hierarquia imóvel → carteira → endereço → unidades é clara. O filtro por carteira é útil e bem posicionado.


### 5. Unidades

A separação entre ocupada e disponível está visualmente c

#### UNI-02 — Área aceita texto livre

**Prioridade: Média**

- **Elemento:** Campo “Área privativa”.
- **Problema:** O valor é digitado como texto, incluindo unidade.
- **Impacto:** Permite formatos inconsistentes e dificulta ordenação, filtros ou relatórios.
- **Recomendação:** Usar campo numérico decimal com sufixo visual “m²”, armazenando apenas o número.

### 6. Locatários

A alternância PF/PJ atualiza corretamente os rótulos, e a tabela apresenta apenas os dados essenciais.




### 7. Contratos

A tabela consegue resumir bem imóvel, unidades, locatário, vigência e condição financeira. O drawer também apresenta os dados em ordem lógica.













































































### 8. Cobranças

A tabela e o drawer apresentam composição, total, recebido e saldo com boa clareza. A distribuição por item é um bom modelo para baixas parciais.








### 9. Despesas / Contas a Pagar

É uma das telas visualmente mais fortes. Vencidas, próximas e pagas são diferenciadas sem depender somente da cor, e a tabela prioriza corretamente vencimento e valor.



#### DES-04 — Nota interna aparece como conteúdo de produto

**Prioridade: Média**

- **Elemento:** Aviso “A forma de pagamento não foi incluída porque esse campo não está definido na documentação aprovada.”
- **Problema:** Expõe justificativa de escopo/documentação ao usuário final.
- **Impacto:** Reforça aparência de protótipo ou interface gerada para demonstração.
- **Recomendação:** Remover da interface final. Se a ausência precisar ser comunicada, usar “Forma de pagamento não informada” apenas no detalhe da conta.

## Consolidação do backlog

### Prioridade alta

Corrigir primeiro:

1. Restaurar todas as ações primárias no celular.
2. Fazer “Editar” carregar o registro correto em Carteiras, Imóveis, Unidades e Locatários.
3. Sincronizar carteira, imóvel e unidades no contrato.
4. Remover unidade pré-selecionada no novo contrato.
5. Preservar o contrato ao criar cobrança pelo drawer.
6. Regenerar composição e valores quando o contrato da cobrança mudar.
7. Redesenhar o recebimento para não começar como quitação total.
8. Impedir recebimentos de valor zero.
9. Implementar validações de cobrança vazia e competência duplicada.
10. Corrigir foco, `Esc`, confinamento e camadas dos diálogos.
11. Adaptar tabelas para celular e notebook.
12. Aumentar legibilidade e corrigir contrastes insuficientes.

### Melhorias recomendadas

Mudanças que elevarão bastante a qualidade:

1. Manter sidebar expandida em desktop e persistir preferência.
2. Transformar indicadores de Pendências em filtros acionáveis.
3. Fazer indicadores acompanharem os filtros ou explicitar seu escopo.
4. Criar máscaras e validações para CPF/CNPJ, valores e área.
5. Manter rodapé fixo nos formulários longos.
6. Disponibilizar caminho de edição ou política de imutabilidade para contratos.
7. Adicionar ordenação operacional em Contas a Pagar.
8. Criar estados padronizados de loading, erro, vazio e sucesso.
9. Garantir alvos interativos de 44×44 px.
10. Consolidar tokens e estados no Design System.
11. Remover mensagens internas de documentação da interface final.

### Polimento

Detalhes para uma experiência mais premium:

1. Trocar “Bem-vinda” por uma saudação neutra.
2. Padronizar a linguagem dos botões de fechamento.
3. Revisar os ícones desenhados em CSS, que têm pesos e geometrias diferentes.
4. Adicionar `prefers-reduced-motion` para spinner, expansão da sidebar, drawer e modal.
5. Reduzir o uso de microtextos em caixa-alta, mantendo-os apenas onde realmente ajudam na hierarquia.

## Direção recomendada

O produto tem uma fundação visual competente. A próxima etapa deve priorizar correção operacional, responsividade e acessibilidade antes de qualquer reformulação estética ampla.
