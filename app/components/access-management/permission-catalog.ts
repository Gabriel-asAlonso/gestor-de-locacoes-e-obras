import type { PermissionGroup } from './access-management.types';

/** Presentation catalogue kept in sync with the server's stable permission codes. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'painel', label: 'Painel', description: 'Entrada e visão consolidada do sistema.', permissions: [
      { code: 'painel:ler', label: 'Visualizar painel', description: 'Acessar as visões gerais dos módulos autorizados.' },
    ],
  },
  {
    id: 'patrimonio', label: 'Patrimônio', description: 'Carteiras, imóveis e unidades.', permissions: [
      { code: 'carteiras:ler', label: 'Visualizar carteiras', description: 'Consultar carteiras e seus indicadores.' },
      { code: 'carteiras:criar', label: 'Criar carteiras', description: 'Cadastrar novas carteiras.' },
      { code: 'carteiras:editar', label: 'Editar carteiras', description: 'Atualizar cadastros existentes.' },
      { code: 'imoveis:ler', label: 'Visualizar imóveis', description: 'Consultar imóveis e seus detalhes.' },
      { code: 'imoveis:criar', label: 'Criar imóveis', description: 'Cadastrar imóveis.' },
      { code: 'imoveis:editar', label: 'Editar imóveis', description: 'Atualizar imóveis existentes.' },
      { code: 'unidades:ler', label: 'Visualizar unidades', description: 'Consultar ocupação e unidades.' },
      { code: 'unidades:criar', label: 'Criar unidades', description: 'Cadastrar unidades.' },
      { code: 'unidades:editar', label: 'Editar unidades', description: 'Atualizar unidades existentes.' },
    ],
  },
  {
    id: 'locacao', label: 'Relacionamentos e locação', description: 'Locatários, imobiliárias e contratos.', permissions: [
      { code: 'locatarios:ler', label: 'Visualizar locatários', description: 'Consultar locatários e vínculos.' },
      { code: 'locatarios:criar', label: 'Criar locatários', description: 'Cadastrar locatários.' },
      { code: 'locatarios:editar', label: 'Editar locatários', description: 'Atualizar cadastros de locatários.' },
      { code: 'imobiliarias:ler', label: 'Visualizar imobiliárias', description: 'Consultar imobiliárias vinculadas.' },
      { code: 'imobiliarias:criar', label: 'Criar imobiliárias', description: 'Cadastrar imobiliárias.' },
      { code: 'contratos:ler', label: 'Visualizar contratos', description: 'Consultar contratos e composição.' },
      { code: 'contratos:criar', label: 'Criar contratos', description: 'Cadastrar contratos de locação.' },
    ],
  },
  {
    id: 'recebiveis', label: 'Recebíveis', description: 'Cobranças, recebimentos e negociações.', permissions: [
      { code: 'cobrancas:ler', label: 'Visualizar cobranças', description: 'Consultar cobranças e saldos.' },
      { code: 'cobrancas:criar', label: 'Criar cobranças', description: 'Emitir novas cobranças.' },
      { code: 'recebimentos:ler', label: 'Visualizar recebimentos', description: 'Consultar histórico de recebimentos.' },
      { code: 'recebimentos:registrar', label: 'Registrar recebimentos', description: 'Dar baixa em cobranças.' },
      { code: 'recebimentos:estornar', label: 'Estornar recebimentos', description: 'Reverter recebimentos registrados.' },
      { code: 'negociacoes:ler', label: 'Visualizar negociações', description: 'Consultar acordos e parcelas.' },
      { code: 'negociacoes:registrar', label: 'Registrar negociações', description: 'Criar e substituir acordos.' },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', description: 'Despesas, pagamentos e fornecedores.', permissions: [
      { code: 'despesas:ler', label: 'Visualizar despesas', description: 'Consultar obrigações financeiras.' },
      { code: 'despesas:criar', label: 'Criar despesas', description: 'Cadastrar despesas e contratações.' },
      { code: 'despesas:pagar', label: 'Registrar pagamentos', description: 'Dar baixa em despesas.' },
      { code: 'despesas:estornar', label: 'Estornar pagamentos', description: 'Reverter pagamentos registrados.' },
      { code: 'fornecedores:ler', label: 'Visualizar fornecedores', description: 'Consultar fornecedores.' },
      { code: 'fornecedores:criar', label: 'Criar fornecedores', description: 'Cadastrar fornecedores.' },
      { code: 'categorias-despesa:ler', label: 'Visualizar categorias', description: 'Consultar categorias de despesa.' },
    ],
  },
  {
    id: 'obras', label: 'Obras', description: 'Execução, equipe, sócios, aportes e documentos.', permissions: [
      { code: 'obras:ler', label: 'Visualizar obras', description: 'Consultar painéis e detalhes das obras.' },
      { code: 'obras:criar', label: 'Criar obras', description: 'Cadastrar novas obras.' },
      { code: 'obras:editar', label: 'Gerenciar execução', description: 'Editar obras, atividades, equipe, diário e caixa.' },
      { code: 'profissionais:ler', label: 'Visualizar profissionais', description: 'Consultar profissionais da execução.' },
      { code: 'profissionais:criar', label: 'Criar profissionais', description: 'Cadastrar profissionais.' },
      { code: 'socios:ler', label: 'Visualizar sócios', description: 'Consultar participações.' },
      { code: 'socios:gerir', label: 'Gerenciar sócios', description: 'Adicionar, editar e retirar participações.' },
      { code: 'aportes:ler', label: 'Visualizar aportes', description: 'Consultar aportes e cotas.' },
      { code: 'aportes:registrar', label: 'Registrar aportes', description: 'Criar solicitações de aporte.' },
      { code: 'aportes:pagar', label: 'Registrar pagamento de cotas', description: 'Dar baixa nas cotas dos aportes.' },
      { code: 'documentos:ler', label: 'Visualizar documentos', description: 'Consultar documentos vinculados.' },
      { code: 'documentos:gerir', label: 'Gerenciar documentos', description: 'Adicionar e retirar documentos.' },
    ],
  },
  {
    id: 'administracao', label: 'Administração', description: 'Usuários, solicitações e delegação de acessos.', permissions: [
      { code: 'usuarios:ler', label: 'Visualizar usuários', description: 'Acessar a lista e os dados das contas.' },
      { code: 'usuarios:criar', label: 'Criar usuários', description: 'Cadastrar contas administrativamente.' },
      { code: 'usuarios:editar', label: 'Editar usuários', description: 'Atualizar dados de contas.' },
      { code: 'usuarios:inativar', label: 'Inativar usuários', description: 'Bloquear o acesso sem apagar o histórico.' },
      { code: 'usuarios:aprovar', label: 'Aprovar solicitações', description: 'Aprovar novos cadastros e definir seus acessos iniciais.' },
      { code: 'usuarios:rejeitar', label: 'Rejeitar solicitações', description: 'Rejeitar novos cadastros.' },
      { code: 'usuarios:ativar', label: 'Reativar usuários', description: 'Restabelecer contas que foram inativadas.' },
      { code: 'permissoes:ler', label: 'Visualizar permissões', description: 'Consultar os acessos de cada usuário.' },
      { code: 'permissoes:editar', label: 'Administrar permissões', description: 'Conceder e remover acessos delegáveis.' },
      { code: 'logs:auditoria:ler', label: 'Consultar auditoria', description: 'Consultar ações e alterações registradas no sistema.' },
      { code: 'logs:tecnicos:ler', label: 'Consultar logs técnicos', description: 'Acessar diagnósticos internos; recomendado somente para Master e suporte técnico.' },
    ],
  },
];

export const AVAILABLE_PERMISSION_CODES = PERMISSION_GROUPS.flatMap(group => group.permissions)
  .map(permission => permission.code);
