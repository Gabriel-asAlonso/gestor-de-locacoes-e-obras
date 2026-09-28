/**
 * Permission catalogue — stable `recurso:acao` codes. Business modules add their own
 * permissions here as they are built (obras:ler, despesas:pagar, ...). The foundation
 * only needs the users resource plus the auth/session basics.
 *
 * Permissions are enforced on the server for every protected action (never trusted
 * from the front-end). Master expands to this catalogue; regular grants live in SQLite.
 */
export const PERMISSIONS = {
  PAINEL_LER: 'painel:ler',
  USUARIOS_LER: 'usuarios:ler',
  USUARIOS_CRIAR: 'usuarios:criar',
  USUARIOS_EDITAR: 'usuarios:editar',
  USUARIOS_APROVAR: 'usuarios:aprovar',
  USUARIOS_REJEITAR: 'usuarios:rejeitar',
  USUARIOS_ATIVAR: 'usuarios:ativar',
  USUARIOS_INATIVAR: 'usuarios:inativar',
  PERMISSOES_LER: 'permissoes:ler',
  PERMISSOES_EDITAR: 'permissoes:editar',
  LOGS_AUDITORIA_LER: 'logs:auditoria:ler',
  LOGS_TECNICOS_LER: 'logs:tecnicos:ler',
  CARTEIRAS_LER: 'carteiras:ler',
  CARTEIRAS_CRIAR: 'carteiras:criar',
  CARTEIRAS_EDITAR: 'carteiras:editar',
  IMOVEIS_LER: 'imoveis:ler',
  IMOVEIS_CRIAR: 'imoveis:criar',
  IMOVEIS_EDITAR: 'imoveis:editar',
  UNIDADES_LER: 'unidades:ler',
  UNIDADES_CRIAR: 'unidades:criar',
  UNIDADES_EDITAR: 'unidades:editar',
  LOCATARIOS_LER: 'locatarios:ler',
  LOCATARIOS_CRIAR: 'locatarios:criar',
  LOCATARIOS_EDITAR: 'locatarios:editar',
  IMOBILIARIAS_LER: 'imobiliarias:ler',
  IMOBILIARIAS_CRIAR: 'imobiliarias:criar',
  CONTRATOS_LER: 'contratos:ler',
  CONTRATOS_CRIAR: 'contratos:criar',
  COBRANCAS_LER: 'cobrancas:ler',
  COBRANCAS_CRIAR: 'cobrancas:criar',
  RECEBIMENTOS_LER: 'recebimentos:ler',
  RECEBIMENTOS_REGISTRAR: 'recebimentos:registrar',
  RECEBIMENTOS_ESTORNAR: 'recebimentos:estornar',
  NEGOCIACOES_LER: 'negociacoes:ler',
  NEGOCIACOES_REGISTRAR: 'negociacoes:registrar',
  FORNECEDORES_LER: 'fornecedores:ler',
  FORNECEDORES_CRIAR: 'fornecedores:criar',
  CATEGORIAS_DESPESA_LER: 'categorias-despesa:ler',
  DESPESAS_LER: 'despesas:ler',
  DESPESAS_CRIAR: 'despesas:criar',
  DESPESAS_PAGAR: 'despesas:pagar',
  DESPESAS_ESTORNAR: 'despesas:estornar',
  PROFISSIONAIS_LER: 'profissionais:ler',
  PROFISSIONAIS_CRIAR: 'profissionais:criar',
  OBRAS_LER: 'obras:ler',
  OBRAS_CRIAR: 'obras:criar',
  OBRAS_EDITAR: 'obras:editar',
  SOCIOS_LER: 'socios:ler',
  SOCIOS_GERIR: 'socios:gerir',
  APORTES_LER: 'aportes:ler',
  APORTES_REGISTRAR: 'aportes:registrar',
  APORTES_PAGAR: 'aportes:pagar',
  DOCUMENTOS_LER: 'documentos:ler',
  DOCUMENTOS_GERIR: 'documentos:gerir',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every declared permission (used to expand the Master wildcard for session responses). */
export const ALL_PERMISSIONS: readonly string[] = Object.values(PERMISSIONS);
export const ALL_PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);
