# Auditoria visual completa — Locações, Recebíveis e Obras

**Data da auditoria:** 8 de setembro de 2026  
**Escopo:** sistema completo, incluindo telas preenchidas, formulários, drawers, modais, gráficos, tabelas e estados previstos na interface.  
**Viewports avaliados:** desktop (1440 × 957), tablet (768 × 1024) e celular (390 × 844).

> A auditoria foi realizada sem alterações no código do produto.

## Resumo executivo

O sistema já transmite uma imagem profissional, organizada e claramente superior à de um painel administrativo genérico. A identidade é consistente, os dashboards têm boa presença e o uso de fotografias imobiliárias cria uma assinatura visual memorável.

Para uma apresentação controlada em desktop ou tablet, o produto já causaria uma boa primeira impressão em um cliente importante.

Ainda não considero, porém, que todo o sistema esteja no mesmo nível premium. Os principais pontos que denunciam acabamento incompleto são:

- textos de 8–11 px em muitos componentes;
- foco nativo aparecendo como um retângulo preto sobre títulos de modais e drawers;
- overflow horizontal até em desktop na tabela de fornecedores;
- abas do detalhe da obra cortadas em tablet e celular;
- textos truncados em indicadores;
- campos nativos de upload em inglês;
- excesso de variações locais de cores, raios e estilos;
- alguns fluxos densos demais para um único modal;
- responsividade que faz os elementos caberem, mas nem sempre preserva contexto e orientação.

Não identifiquei uma falha visual isolada que exija classificação “Crítica”. Existem, contudo, problemas de prioridade alta que deveriam ser corrigidos antes da apresentação.

---

# Avaliação por tela

## 1. Login

**Avaliação geral**

É uma das telas mais fortes do sistema. Tem personalidade, composição editorial e aparência de produto bem pensado. Não parece um template pronto nem uma interface gerada automaticamente.

**Pontos positivos**

- Fotografia bem escolhida, com ótimo tratamento de contraste.
- Headline forte e memorável.
- Separação clara entre narrativa do produto e acesso.
- Formulário limpo, com botão principal evidente.
- Excelente adaptação para tablet e celular.
- Uso equilibrado de azul, branco e fundo escuro.
- Bom espaço negativo e sensação premium.

**Problemas encontrados**

- Alguns textos institucionais e de segurança são pequenos demais.
- No celular, desaparece praticamente todo o lockup textual da marca; resta apenas o símbolo “L · R”.
- As credenciais preenchidas tornam a tela ligeiramente mais demonstrativa do que institucional.
- Informações como versão e aviso de dados fictícios têm contraste muito discreto.

**Melhorias recomendadas**

- **Média:** elevar textos auxiliares para pelo menos 11–12 px e reforçar levemente o contraste.
- **Baixa:** manter uma assinatura compacta “Locações & Recebíveis” no cabeçalho móvel.
- **Baixa:** em ambiente demonstrativo, considerar “Entrar na demonstração” em vez de simular uma autenticação convencional.

**Impacto esperado**

Maior legibilidade e melhor reconhecimento da marca no celular, preservando a excelente composição atual.

## 2. Sidebar, navegação e cabeçalhos

**Avaliação geral**

A navegação é sóbria, corporativa e coerente com o restante do produto. O seletor entre Locações e Obras funciona bem como elemento de arquitetura da informação.

**Pontos positivos**

- Boa diferenciação entre módulo, grupo e página.
- Item ativo fácil de localizar.
- Ícones Lucide coerentes e com peso visual semelhante.
- Agrupamentos fazem sentido para o domínio.
- Sidebar clara combina bem com o canvas cinza.
- Topbar discreta e sem competir com o conteúdo.

**Problemas encontrados**

- O lockup da marca fica apertado e parcialmente truncado na largura atual.
- Acordeões escondem destinos mesmo havendo relativamente poucas páginas.
- O topo ocupa bastante largura apenas para breadcrumb e aviso demonstrativo.
- No celular, o botão de menu é claro, mas a navegação perde toda a identidade visual até ser aberta.
- Alguns ícones e textos secundários têm contraste baixo.

**Melhorias recomendadas**

- **Média:** revisar largura e composição do lockup para que nome e módulo nunca pareçam espremidos.
- **Média:** avaliar deixar os itens do grupo ativo sempre expostos no desktop.
- **Baixa:** enriquecer o breadcrumb com a área real, por exemplo “Locação / Cobranças”.
- **Baixa:** utilizar o espaço da topbar para contexto útil, sem transformar a barra em um segundo cabeçalho.

**Impacto esperado**

Navegação mais imediata, melhor reconhecimento de localização e menos aparência de estrutura excessivamente compactada.

## 3. Visão geral — Locações

**Avaliação geral**

Dashboard executivo visualmente forte, com hierarquia clara e boa leitura inicial. O bloco escuro de projeção dá presença à tela e comunica maturidade.

**Pontos positivos**

- O resultado mensal é percebido imediatamente.
- Boa diferenciação entre previsto, realizado e despesas.
- “Central de prioridades” aparece cedo e orienta ação.
- Uso consistente de verde, vermelho, azul e laranja.
- Excelente reorganização no tablet e no celular.
- Os cards possuem função real; não são apenas decoração.
- A tela equilibra patrimônio e financeiro.

**Problemas encontrados**

- A página é longa: aproximadamente 2.250 px no desktop.
- Ocupação, unidades disponíveis e situação financeira reaparecem em vários blocos.
- Muitos microtextos ficam difíceis de ler durante uma apresentação projetada.
- O gráfico de barras não apresenta valores diretamente nas barras.
- Não há evidência visual de tooltip ou interação nos gráficos.
- A rosca de cinco cobranças ocupa bastante espaço para comunicar apenas quatro contagens.
- Alguns componentes repetem o mesmo padrão “eyebrow + título + card + métrica”, dando leve aparência modular demais.

**Melhorias recomendadas**

- **Alta:** aumentar a legibilidade das legendas, escalas e descrições dos gráficos.
- **Média:** adicionar tooltip e valor acessível nas barras.
- **Média:** substituir a rosca por barra segmentada ou lista comparativa se não houver análise proporcional relevante.
- **Média:** remover um dos indicadores redundantes de ocupação.
- **Baixa:** reduzir a repetição de cabeçalhos editoriais em seções consecutivas.

**Impacto esperado**

Leitura executiva mais rápida, menos rolagem e gráficos mais úteis, não apenas visualmente agradáveis.

## 4. Carteiras

**Avaliação geral**

Tela elegante e bem resolvida. A galeria de imagens cria uma apresentação de portfólio mais sofisticada do que uma listagem administrativa comum.

**Pontos positivos**

- Ótimo resumo consolidado.
- Cards grandes valorizam o patrimônio.
- Imagens dão personalidade e credibilidade.
- Alternância Cards/Tabela é uma boa decisão.
- Ocupação e composição da carteira estão bem agrupadas.
- Ações principais são evidentes.

**Problemas encontrados**

- A visualização em tabela usa cabeçalho azul muito saturado comparado ao restante da interface.
- Os cards são altos para carteiras com poucos dados.
- Micro-rótulos em caixa-alta são numerosos.
- A tabela deixa grande área vazia quando há poucos registros.

**Melhorias recomendadas**

- **Média:** usar cabeçalho de tabela neutro ou azul mais escuro e menos saturado.
- **Média:** oferecer densidade compacta para bases maiores.
- **Baixa:** reduzir a quantidade de micro-rótulos e manter apenas os que realmente organizam a leitura.

**Impacto esperado**

Maior coerência com as outras tabelas e melhor escalabilidade sem perder a apresentação visual das carteiras.

## 5. Imóveis

**Avaliação geral**

Uma das melhores listagens do Módulo 1. É visual, organizada e fácil de escanear.

**Pontos positivos**

- Fotografias contextualizam cada empreendimento.
- Cards têm proporções consistentes.
- Endereço, carteira e ocupação seguem boa hierarquia.
- Badges de disponibilidade são claros.
- A grade aproveita bem o desktop.
- Barras de ocupação complementam os percentuais.

**Problemas encontrados**

- Ausência de ordenação visível por ocupação, nome ou disponibilidade.
- Rótulos secundários são pequenos.
- Em bases extensas, a grade exigirá muita rolagem.
- Os cards repetem bastante estrutura visual.

**Melhorias recomendadas**

- **Média:** adicionar ordenação e opção de visualização compacta.
- **Média:** prever paginação ou carregamento progressivo.
- **Baixa:** aumentar o tamanho de endereço e metadados essenciais.

**Impacto esperado**

Preserva a força visual atual e melhora a eficiência quando a carteira crescer.

## 6. Unidades

**Avaliação geral**

Visualmente consistente, mas mais densa do que a tela de imóveis. A grade de quatro colunas funciona no desktop amplo, embora aproxime o limite de legibilidade.

**Pontos positivos**

- Situação da unidade é identificada rapidamente.
- Imóvel, área e carteira estão bem agrupados.
- Cards têm altura e alinhamento consistentes.
- “Ver detalhes” e “Editar” estão disponíveis sem menus ocultos.
- Bom uso das imagens dos respectivos imóveis.

**Problemas encontrados**

- Quatro colunas deixam títulos, metadados e ações pequenos.
- “Ver detalhes” e “Editar” competem visualmente em todos os cards.
- A repetição da mesma fotografia entre unidades do mesmo imóvel reduz distinção.
- O grid tende a ficar cansativo com muitas unidades.

**Melhorias recomendadas**

- **Média:** limitar a três colunas em notebooks e manter quatro apenas em telas realmente largas.
- **Média:** considerar um modo tabela/lista para uso operacional.
- **Baixa:** reduzir o destaque de “Editar”, deixando “Ver detalhes” como ação principal.

**Impacto esperado**

Maior conforto visual e redução da sensação de catálogo excessivamente fragmentado.

## 7. Locatários

**Avaliação geral**

A tela comunica bem o relacionamento entre locatário, imobiliária, contrato, unidade e situação financeira. É funcionalmente rica e visualmente organizada.

**Pontos positivos**

- Bom resumo financeiro no topo.
- Imobiliária responsável ganha contexto sem dominar a tela.
- Pendências são fáceis de reconhecer.
- Cards com dois locatários por linha aproveitam bem o espaço.
- Relações cadastrais estão explicitadas de forma profissional.

**Problemas encontrados**

- A densidade interna dos cards é alta.
- Há excesso de rótulos em caixa-alta e fonte muito pequena.
- Vermelho aparece em avatar, badge, contrato e saldo no mesmo card, aumentando a intensidade do alerta.
- A seção de imobiliárias cria uma terceira camada antes da listagem principal.

**Melhorias recomendadas**

- **Alta:** elevar o tamanho dos dados essenciais e reduzir microtipografia.
- **Média:** concentrar o vermelho em status e valor problemático, mantendo o avatar neutro.
- **Média:** recolher informações menos importantes ou oferecer visualização em tabela.
- **Baixa:** simplificar o hub de imobiliárias quando não houver ação necessária.

**Impacto esperado**

Cards mais fáceis de escanear e alertas mais precisos, sem sobrecarregar visualmente relacionamentos com pendências.

## 8. Contratos

**Avaliação geral**

Tela coerente e bem estruturada. Os cards resumem corretamente vínculo, aluguel, vencimento e vigência.

**Pontos positivos**

- Boa diferenciação cromática em relação às outras áreas.
- Unidades vinculadas aparecem como tags legíveis.
- Valores e datas têm destaque adequado.
- O CTA “Ver detalhes” está bem posicionado.
- Cards mantêm alinhamento mesmo com quantidades diferentes de unidades.

**Problemas encontrados**

- A tela privilegia a apresentação cadastral, mas comunica pouco sobre contratos próximos do vencimento.
- Cards são altos e podem gerar rolagem excessiva em bases grandes.
- Datas de início e término têm peso visual semelhante, mesmo quando o término é mais relevante.
- Falta uma alternativa compacta.

**Melhorias recomendadas**

- **Média:** destacar contratos próximos de vencer ou que exigem renovação.
- **Média:** oferecer modo tabela.
- **Baixa:** dar maior peso ao término e reduzir o destaque da data inicial.

**Impacto esperado**

Transforma a tela de cadastro em uma visão mais operacional, sem perder clareza.

## 9. Cobranças

**Avaliação geral**

É uma das telas financeiras mais maduras. O formato de ledger é claro, profissional e orientado por risco.

**Pontos positivos**

- Saldo em acompanhamento recebe o destaque correto.
- Cores de vencida, parcial, próxima e recebida são consistentes.
- Filtros estão bem posicionados.
- A barra lateral colorida facilita a varredura das linhas.
- Total previsto e saldo atual são comparáveis.
- Exportação tem hierarquia secundária adequada.

**Problemas encontrados**

- Muitos dados usam 8–10 px.
- As linhas são densas e perdem legibilidade em projeção.
- Indicadores superiores e filtro de situação representam conceitos parcialmente duplicados.
- Ações dependem muito da seta discreta no fim da linha.
- O drawer dá maior destaque ao código `COB-0084` do que ao locatário.
- O título focado no drawer recebe contorno preto nativo e visualmente inadequado.

**Melhorias recomendadas**

- **Alta:** remover o foco nativo dos títulos e aplicar um padrão de foco visual próprio.
- **Alta:** elevar fontes dos dados principais das linhas.
- **Média:** usar o locatário ou a finalidade como título do drawer, mantendo o código no eyebrow.
- **Média:** tornar “Ver detalhes” textual em desktop ou reforçar a affordance da linha.
- **Baixa:** decidir se os indicadores são filtros ou somente resumo, evitando duplicidade.

**Impacto esperado**

Maior confiança em uma área financeiramente sensível e melhor leitura durante demonstrações.

## 10. Despesas

**Avaliação geral**

Muito bem resolvida. Os estados financeiros são compreendidos rapidamente e a ordenação “Mais urgentes” demonstra boa preocupação operacional.

**Pontos positivos**

- Excelente destaque para total a pagar, atraso, pago e próximos vencimentos.
- Cores semânticas são utilizadas com moderação.
- Linha inteira fácil de escanear.
- Filtros e ordenação estão completos.
- Despesas vencidas ganham prioridade sem tornar a tela agressiva.

**Problemas encontrados**

- O bloco principal marrom foge ligeiramente da identidade azul/verde dominante.
- A listagem ainda depende de microtipografia.
- A estrutura horizontal pode ficar apertada em notebook.
- Não há paginação visível para bases maiores.
- A semelhança com Cobranças é positiva, mas os comportamentos clicáveis precisam permanecer idênticos.

**Melhorias recomendadas**

- **Média:** revisar o marrom para um tom mais conectado ao sistema de cores.
- **Média:** preparar quebra responsiva das linhas por prioridade de informação.
- **Média:** prever paginação ou carregamento progressivo.
- **Baixa:** padronizar integralmente comportamento de abertura com Cobranças.

**Impacto esperado**

Mais consistência entre as áreas financeiras e maior segurança de uso em resoluções intermediárias.

## 11. Visão geral — Obras

**Avaliação geral**

É a tela mais marcante do sistema. A obra em destaque, a fotografia e a central de prioridades criam uma primeira impressão realmente premium.

**Pontos positivos**

- Forte elemento visual memorável.
- Excelente equilíbrio entre fotografia e informação.
- Prioridades aparecem na primeira tela.
- CTA principal bem definido.
- Filtros têm posição e densidade adequadas.
- Responsável, progresso, prazo e pagamento são compreendidos rapidamente.
- O módulo possui identidade própria sem parecer outro produto.

**Problemas encontrados**

- A fotografia ocupa grande parte da primeira dobra.
- Indicadores consolidados ficam abaixo da área inicialmente visível.
- A imagem pode dominar excessivamente quando não houver uma obra realmente relevante para destaque.
- Pequenos textos sobre a foto exigem atenção ao contraste em todas as imagens futuras.

**Melhorias recomendadas**

- **Média:** manter critérios claros para escolher a obra em destaque.
- **Média:** garantir overlay de contraste adaptável às fotografias cadastradas.
- **Baixa:** antecipar um ou dois indicadores críticos, caso o cliente priorize números executivos.

**Impacto esperado**

Preserva o maior diferencial visual do sistema e evita que fotografias futuras prejudiquem a leitura.

## 12. Lista de obras

**Avaliação geral**

Tela organizada e completa. O resumo superior, filtros e cards operacionais constroem uma boa sequência de leitura.

**Pontos positivos**

- Indicadores de situação bem distribuídos.
- Busca e filtros têm boa hierarquia.
- Cards de obra apresentam contexto suficiente sem exigir abertura imediata.
- Capa, prioridade, prazo e progresso funcionam bem juntos.
- Ação “Abrir obra” é inequivocamente principal.

**Problemas encontrados**

- Cada obra ocupa bastante altura.
- Muitas informações e badges competem no mesmo card.
- Em bases extensas, a tela ficará longa.
- “Editar” e “Abrir obra” ainda disputam atenção.
- Falta uma visualização compacta ou tabela.

**Melhorias recomendadas**

- **Média:** oferecer modo compacto para gestão diária.
- **Média:** reduzir o peso de “Editar”.
- **Média:** paginar ou virtualizar bases maiores.
- **Baixa:** mostrar apenas a próxima atividade e esconder metadados secundários em expansão.

**Impacto esperado**

Aumenta a quantidade de obras comparáveis por tela e melhora a velocidade de decisão.

## 13. Nova obra

**Avaliação geral**

É o formulário mais bem resolvido do sistema. O stepper, a divisão em etapas e a prévia lateral tornam um cadastro complexo mais agradável.

**Pontos positivos**

- Etapas são claras e contextualizadas.
- Boa separação entre dados, responsáveis e valores.
- Prévia lateral reduz incerteza.
- Imagem do imóvel adiciona contexto real.
- Campos obrigatórios e opcionais são diferenciados.
- Excelente adaptação visual do formulário.

**Problemas encontrados**

- Em desktop, o avanço da etapa pode ficar abaixo da primeira dobra.
- Alguns textos explicativos são pequenos.
- O painel lateral adiciona bastante informação em uma etapa já densa.
- Confirmações de descarte usam diálogo nativo do navegador, visualmente desconectado.

**Melhorias recomendadas**

- **Alta:** manter ação “Continuar” em rodapé fixo da área útil.
- **Média:** substituir confirmações nativas por modal do design system.
- **Média:** aumentar textos explicativos essenciais.
- **Baixa:** permitir recolher a prévia lateral em notebooks.

**Impacto esperado**

Fluxo mais contínuo, menor chance de o usuário procurar a próxima ação e maior consistência visual.

## 14. Detalhe da obra — estrutura geral

**Avaliação geral**

Tela rica e visualmente forte. A combinação de capa, status, métricas, abas e conteúdo contextual dá sensação de produto maduro.

**Pontos positivos**

- Excelente cabeçalho contextual.
- Métricas principais bem organizadas.
- Navegação por áreas reduz uma página potencialmente enorme.
- Fotos, status e progresso criam boa presença.
- Ações principais estão agrupadas corretamente.
- Conteúdo mantém coerência entre as abas.

**Problemas encontrados**

- Existem sete abas em uma faixa horizontal.
- No tablet e celular, as abas são cortadas e não há indicação de que é possível arrastar.
- No celular, a aba ativa pode ficar completamente fora da área visível.
- “Registrar atualização” vira apenas um ícone `+`, perdendo significado visual.
- No resumo, o cabeçalho escuro da próxima atividade apresentou texto claro sobre fundo claro durante a renderização.
- Algumas seções usam cards dentro de cards, elevando a fragmentação.

**Melhorias recomendadas**

- **Alta:** fazer a aba ativa rolar automaticamente para a área visível.
- **Alta:** adicionar gradiente lateral, seta ou outro sinal de continuidade na faixa de abas.
- **Alta:** corrigir o estado de renderização/contraste do card de próxima atividade.
- **Média:** manter um rótulo curto como “Atualizar” no botão móvel.
- **Média:** agrupar abas em “Execução”, “Pessoas”, “Financeiro” e “Registros” no celular.

**Impacto esperado**

Melhor orientação em telas pequenas e eliminação de uma das poucas falhas visuais claramente perceptíveis no conteúdo principal.

## 15. Planejamento da obra

**Avaliação geral**

O cronograma é legível e orientado por etapas. Estados bloqueados, concluídos e em andamento são reconhecidos sem depender apenas da cor.

**Pontos positivos**

- Divisão Preparação/Execução/Entrega funciona bem.
- Período, responsável e estado têm boa organização.
- Bloqueios recebem tratamento visual adequado.
- Ações estão próximas da atividade correspondente.

**Problemas encontrados**

- Em algumas larguras, Concluir, Bloquear e Reprogramar ficam muito comprimidos.
- A densidade horizontal é alta.
- Datas podem desaparecer na adaptação responsiva.
- As linhas não comunicam claramente dependências entre atividades.

**Melhorias recomendadas**

- **Alta:** mover ações secundárias para menu contextual nas larguras intermediárias.
- **Média:** preservar datas por expansão, mesmo quando omitidas da linha.
- **Baixa:** considerar uma pequena timeline ou dependência visual apenas se houver relações reais entre atividades.

**Impacto esperado**

Menos competição entre ações e melhor leitura de cronograma em notebook e tablet.

## 16. Equipe da obra

**Avaliação geral**

Tela limpa e muito clara. É uma das abas mais equilibradas.

**Pontos positivos**

- Avatar, papel, período, apontamento e custo seguem ótima hierarquia.
- Alinhamentos são consistentes.
- Custo total aparece no cabeçalho.
- Ação de remoção tem peso visual adequado.

**Problemas encontrados**

- Remoção é representada apenas por ícone.
- Nomes repetidos com funções diferentes podem exigir diferenciação mais forte.
- Alguns metadados ainda usam fonte pequena.

**Melhorias recomendadas**

- **Média:** reforçar função/cargo quando a mesma pessoa possuir várias alocações.
- **Baixa:** tooltip visual para remoção no desktop.
- **Baixa:** aumentar levemente metadados de apontamento.

**Impacto esperado**

Maior segurança operacional sem alterar a composição, que já funciona bem.

## 17. Fornecedores da obra

**Avaliação geral**

Boa estrutura de métricas e excelente clareza financeira, mas apresenta o problema responsivo mais evidente do desktop.

**Pontos positivos**

- Contratado, pago e pendente são facilmente comparáveis.
- Pesquisa e filtro estão bem posicionados.
- Status de pagamento é claro.
- Nomes e fornecimentos possuem boa hierarquia.

**Problemas encontrados**

- A tabela gera scrollbar horizontal mesmo em desktop de 1440 px.
- A coluna de ações fica parcialmente fora da área visível.
- Linhas têm muitas colunas e textos longos.
- A necessidade de rolar horizontalmente reduz a percepção de produto premium.

**Melhorias recomendadas**

- **Alta:** eliminar o overflow em desktop, reduzindo ou agrupando colunas.
- **Alta:** manter fornecedor, pendente, status e ação sempre visíveis.
- **Média:** mover detalhes de documentos para expansão ou drawer.
- **Média:** transformar a tabela em cards operacionais no celular.

**Impacto esperado**

Remove uma falha visual objetiva e melhora significativamente a confiança no módulo financeiro da obra.

## 18. Sócios da obra

**Avaliação geral**

A visualização da distribuição é informativa e sofisticada. Os anéis percentuais ajudam a diferenciar as participações.

**Pontos positivos**

- Participação total e pendências são entendidas rapidamente.
- Sócios possuem boa diferenciação visual.
- Valores investidos e pendentes são comparáveis.
- O histórico financeiro complementa a distribuição atual.

**Problemas encontrados**

- Texto do card “Total aportado” aparece truncado.
- Há muitos blocos horizontais em sequência.
- Três cards, resumo, confirmação de distribuição e tabela disputam atenção.
- Botões de edição e exclusão ocupam bastante espaço em cada card.

**Melhorias recomendadas**

- **Alta:** impedir truncamento de descrições nos indicadores.
- **Média:** reduzir o número de faixas informativas antes da lista de sócios.
- **Média:** mover exclusão para menu secundário.
- **Baixa:** simplificar o card de distribuição completa quando estiver em 100%.

**Impacto esperado**

Menos fragmentação e leitura mais direta da situação societária.

## 19. Financeiro da obra

**Avaliação geral**

Tela objetiva e profissional. É menos visual que as outras abas, mas adequada ao conteúdo.

**Pontos positivos**

- Custos, aportes e caixa são comparáveis.
- Caixa negativo recebe destaque correto.
- Histórico de entradas é limpo.
- Ações principais aparecem no cabeçalho.

**Problemas encontrados**

- A tela termina com bastante espaço vazio quando existem poucos registros.
- O caixa negativo não está acompanhado por uma orientação visual de resolução.
- Alguns textos explicativos são pequenos.

**Melhorias recomendadas**

- **Média:** incluir ação contextual próxima ao caixa negativo.
- **Baixa:** aumentar texto auxiliar.
- **Baixa:** usar o espaço livre para projeção de compromissos somente se houver dados relevantes.

**Impacto esperado**

Transforma o indicador negativo em informação acionável, sem adicionar decoração vazia.

## 20. Diário e arquivos

**Avaliação geral**

A timeline é apropriada e fácil de acompanhar. O painel lateral de arquivos complementa bem o histórico.

**Pontos positivos**

- Ordem cronológica evidente.
- Tipos de registro são diferenciados.
- Arquivos permanecem ligados à atualização correspondente.
- Separação entre timeline e referências gerais funciona bem.

**Problemas encontrados**

- No celular, o usuário pode não perceber imediatamente que os arquivos gerais continuam abaixo.
- Datas, horários, tipo, progresso e autor usam microtipografia.
- A faixa de abas pode deixar a aba ativa invisível.

**Melhorias recomendadas**

- **Alta:** corrigir a navegação horizontal das abas.
- **Média:** aumentar metadados principais da timeline.
- **Baixa:** incluir contagem de arquivos no título da seção móvel.

**Impacto esperado**

Melhor continuidade da leitura e maior clareza do histórico em telas pequenas.

## 21. Modais, drawers e formulários auxiliares

**Avaliação geral**

A estrutura é madura: cabeçalho, corpo rolável e rodapé fixo estão bem resolvidos. O problema está em alguns detalhes capazes de quebrar a impressão de acabamento.

**Pontos positivos**

- Larguras adequadas.
- Overlays, sombras e cantos têm boa presença.
- Botões principais e secundários são claros.
- Rodapés fixos funcionam bem.
- Formulários móveis permanecem utilizáveis.
- Drawers acomodam corretamente grande quantidade de dados.

**Problemas encontrados**

- Títulos recebem foco automático com contorno preto nativo.
- Upload do modal de atualização aparece como “Choose Files / No file chosen”.
- Modais abertos dentro do detalhe da obra ficam limitados ao workspace; a sidebar não recebe o mesmo bloqueio visual do restante da tela.
- O modal de recebimento é longo e cognitivamente denso.
- No drawer de cobrança, o código interno é o título dominante.
- Formulários cadastrais são fragmentados em muitos cards dentro do próprio modal.
- Nem todos os formulários longos parecem proteger alterações contra fechamento acidental.

**Melhorias recomendadas**

- **Alta:** criar estilo específico para títulos focados ou focar o container sem outline visual.
- **Alta:** substituir todos os uploads nativos por componente localizado.
- **Alta:** garantir que qualquer modal cubra e torne inerte todo o viewport, incluindo a sidebar.
- **Alta:** dividir recebimento em “Dados” e “Revisão da distribuição”.
- **Média:** reduzir cards internos, usando divisões e títulos de seção mais leves.
- **Média:** padronizar proteção de descarte em formulários alterados.
- **Média:** substituir confirmações nativas por modal do produto.

**Impacto esperado**

Essa é a intervenção que mais elimina sinais de protótipo e aproxima o sistema de um produto corporativo finalizado.

---

# Estados da interface

A cobertura de estados é um ponto forte. O sistema possui:

- skeleton de carregamento;
- erro de sistema;
- aviso de conexão;
- conteúdo preservado durante offline;
- estados vazios completos e compactos;
- mensagens de erro por campo;
- banners de erro;
- loading em botões;
- estados disabled;
- toast de sucesso;
- confirmação para ações importantes;
- suporte a redução de movimento.

**Problemas gerais**

- O skeleton é genérico e não representa a anatomia específica de cada página.
- Alguns estados vazios são visualmente mais elaborados do que necessário.
- Confirmações nativas quebram a identidade.
- Textos de erro e ajuda voltam ao problema da microtipografia.

**Prioridade: Média**

Criar skeletons por família de tela, padronizar confirmações e aumentar mensagens essenciais.

---

# Principais problemas visuais do sistema

1. Microtipografia excessiva, principalmente entre 8 e 11 px.
2. Foco nativo inadequado em títulos de diálogos.
3. Overflow horizontal em tabelas densas.
4. Navegação por abas deficiente em tablet e celular.
5. Textos truncados em indicadores.
6. Uploads nativos e não localizados.
7. Fluxos longos dentro de um único modal.
8. Grande quantidade de cores, raios e estilos locais fora dos tokens principais.
9. Repetição de cards e cabeçalhos editoriais.
10. Ausência de modos compactos para bases maiores.
11. Algumas ações viram ícones sem contexto no celular.
12. Gráficos visualmente bons, mas com pouca exploração e detalhamento.

# Pontos fortes

- Identidade visual reconhecível.
- Excelente aplicação de fotografias.
- Hierarquia de títulos consistente.
- Boa paleta semântica.
- Status não dependem somente de cor.
- Dashboards com foco executivo.
- Ótima tela de login.
- Módulo de Obras visualmente marcante.
- Bons formulários estruturados.
- Drawers completos e organizados.
- Tablet tratado como layout próprio, não apenas desktop reduzido.
- Estados de sistema abrangentes.
- Microinterações e redução de movimento já contempladas.
- Não há aparência dominante de template pronto ou de interface gerada por IA.

# Top 10 melhorias

1. **Alta — Corrigir foco visual nos títulos de modais e drawers.**
2. **Alta — Eliminar overflow da tabela de fornecedores.**
3. **Alta — Redesenhar a navegação móvel das abas do detalhe da obra.**
4. **Alta — Aumentar microtextos essenciais em todo o sistema.**
5. **Alta — Localizar e padronizar todos os componentes de upload.**
6. **Alta — Fazer modais internos cobrirem também a sidebar e todo o viewport.**
7. **Alta — Transformar o recebimento em fluxo de dados + revisão.**
8. **Média — Consolidar cores, raios, bordas e sombras em tokens reais.**
9. **Média — Melhorar gráficos com labels, tooltips e comparação temporal.**
10. **Média — Criar visualizações compactas para unidades, contratos, locatários e obras.**

# Telas prioritárias

1. Fornecedores da obra.
2. Detalhe da obra em tablet e celular.
3. Modais e drawers de todos os módulos.
4. Cobranças e fluxo de recebimento.
5. Sócios da obra.
6. Locatários.
7. Gráficos da Visão geral.
8. Listagens em bases extensas.

# Inconsistências globais

- Tamanhos de fonte variam demais abaixo da escala tipográfica declarada.
- Existem muitas variações locais de azul, verde, roxo, vermelho e superfícies.
- Raios de 6, 7, 8, 9, 10, 11, 12, 13, 14 e outros aparecem em componentes semelhantes.
- O padrão de foco não alcança títulos focados programaticamente.
- Algumas telas usam tabelas; outras, cards; outras, linhas de ledger, sem uma política clara por densidade.
- Algumas ações móveis preservam texto; outras viram somente ícone.
- Confirmações usam tanto componentes próprios quanto diálogos nativos.
- A importância do identificador técnico muda entre drawers e telas.
- Há excesso de caixa-alta em micro-rótulos.
- O comportamento responsivo das abas difere da boa qualidade obtida nos dashboards.

# Avaliação final

| Critério | Nota |
|---|---:|
| Identidade visual | 8,7 |
| Profissionalismo | 8,5 |
| Organização | 8,6 |
| Consistência | 8,1 |
| Usabilidade | 8,1 |
| Gráficos | 7,5 |
| Tabelas | 7,8 |
| Formulários | 8,3 |
| Modais | 7,6 |
| Responsividade | 8,0 |
| Percepção de produto premium | 8,3 |

**Nota geral: 8,3/10**

## Veredito

Sim: apresentado hoje em desktop ou tablet, seguindo um roteiro controlado, o sistema pareceria maduro, profissional e de alto valor.

Ele não precisa de redesign. A direção visual deve ser preservada.

Para alcançar nível realmente premium em toda a experiência, falta uma rodada concentrada de acabamento: corrigir microtipografia, foco, uploads, overflows, abas móveis e densidade dos fluxos financeiros. Esses ajustes são menores que uma reformulação, mas têm impacto desproporcional na percepção de qualidade diante de um cliente exigente.
