import { getTableName, sql } from 'drizzle-orm';
import { check, customType, index, integer, primaryKey, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { domains } from './domains.ts';
import { fromHundredths, toHundredths } from './fixed-point.ts';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const uuidDefault = sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random() % 4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;
const id = () => text('id', { length: 36 }).primaryKey().notNull().default(uuidDefault);
const str = (name: string, length = 200) => text(name, { length });
const date = (name: string) => text(name, { length: 10 });
const instant = (name: string) => text(name, { length: 24 });
const bool = (name: string) => integer(name, { mode: 'boolean' });
const code = () => str('codigo', 32).notNull();
const decimal = customType<{ data: string; driverData: number }>({
  dataType: () => 'integer',
  toDriver: (value) => Number(toHundredths(value)),
  fromDriver: fromHundredths,
});
const fk = (name: string, target: () => AnySQLiteColumn) => str(name, 36).references(target, { onDelete: 'restrict', onUpdate: 'restrict' });
const audit = () => ({ created_at: instant('created_at').notNull().default(now), created_by: fk('created_by', (): AnySQLiteColumn => usuarios.id) });
const editable = () => ({ ...audit(), updated_at: instant('updated_at').notNull().default(now), updated_by: fk('updated_by', (): AnySQLiteColumn => usuarios.id) });
const master = () => ({ id: id(), ...editable(), ativo: bool('ativo').notNull().default(true) });
const reversal = (target: () => AnySQLiteColumn) => ({ estorno_de_id: fk('estorno_de_id', target).unique(), motivo_estorno: text('motivo_estorno') });
const nonnegative = (name: string) => decimal(name).notNull().default(sql`0`);
const domain = <T extends readonly [string, ...string[]]>(name: string, values: T) => text(name, { enum: values });

/** SQLite does not enforce VARCHAR length, decimal scale, dates or boolean types by declaration. */
function checks(t: Record<string, AnySQLiteColumn>) {
  const tableName = getTableName(Object.values(t)[0]!.table);
  const constraints = Object.values(t).flatMap((c) => {
    const result = [];
    const length = (c as AnySQLiteColumn & { length?: number }).length;
    const name = `${tableName}_${c.name}`;
    // Columns added to the append-only audit table are protected by migration
    // triggers because SQLite cannot add named CHECK constraints with ALTER TABLE.
    const auditMetadata = tableName === 'auditoria_eventos' && ['request_id','event_code','categoria','modulo','origem'].includes(c.name);
    if (c.dataType === 'string' && !auditMetadata) result.push(check(`${name}_text`, sql`${c} IS NULL OR (typeof(${c}) = 'text' AND length(trim(${c})) > 0)`));
    if (length && !auditMetadata) result.push(check(`${name}_length`, sql`${c} IS NULL OR length(${c}) <= ${sql.raw(String(length))}`));
    if (length === 36 && (c.name === 'id' || c.name.endsWith('_id') || c.name.endsWith('_by') || c.name.endsWith('_por'))) {
      result.push(check(`${name}_uuid`, sql`${c} IS NULL OR (length(${c}) = 36 AND substr(${c},9,1) = '-' AND substr(${c},14,1) = '-' AND substr(${c},19,1) = '-' AND substr(${c},24,1) = '-' AND length(replace(${c},'-','')) = 32 AND replace(${c},'-','') NOT GLOB '*[^0-9a-f]*')`));
    }
    if (length === 10) result.push(check(`${name}_date`, sql`${c} IS NULL OR (length(${c})=10 AND ${c} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(${c}, '+0 days') IS NOT NULL AND date(${c}, '+0 days') = ${c})`));
    if (length === 24) result.push(check(`${name}_utc`, sql`${c} IS NULL OR (length(${c})=24 AND strftime('%Y-%m-%dT%H:%M:%fZ', ${c}, '+0 days') IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', ${c}, '+0 days') = ${c})`));
    if (c.enumValues?.length) result.push(check(`${name}_domain`, sql`${c} IS NULL OR ${c} IN (${sql.join(c.enumValues.map(v => sql.raw(`'${v}'`)), sql`, `)})`));
    if (c.dataType === 'number' || c.dataType === 'boolean' || c.dataType === 'custom') result.push(check(`${name}_integer`, sql`${c} IS NULL OR typeof(${c}) = 'integer'`));
    if (c.dataType === 'boolean') result.push(check(`${name}_bool`, sql`${c} IN (0,1)`));
    if (c.dataType === 'custom') {
      const max = ['percentual', 'progresso_percentual', 'progresso_registrado', 'multa_atraso_percentual', 'juros_mensal_percentual'].includes(c.name) ? '10000' : ['quantidade','area_privativa','area_total'].includes(c.name) ? '999999999999' : '999999999999999';
      const min = c.name === 'valor_assinado' ? `-${max}` : '0';
      result.push(check(`${name}_range`, sql`${c} IS NULL OR ${c} BETWEEN ${sql.raw(min)} AND ${sql.raw(max)}`));
    }
    if (c.dataType === 'json') result.push(check(`${name}_json`, sql`${c} IS NULL OR (json_valid(${c}) AND json_type(${c}) = 'object')`));
    return result;
  });
  if (t['estorno_de_id']) constraints.push(check(`${tableName}_estorno_motivo`, sql`(${t['estorno_de_id']} IS NULL AND ${t['motivo_estorno']} IS NULL) OR (${t['estorno_de_id']} IS NOT NULL AND ${t['estorno_de_id']} != ${t['id']} AND ${t['motivo_estorno']} IS NOT NULL)`));
  return constraints;
}

export const usuarios = sqliteTable('usuarios', {
  id: id(), ...editable(), nome: str('nome').notNull(), email: str('email',254).notNull(), senha_hash: str('senha_hash',255),
  perfil_codigo: domain('perfil_codigo', domains.perfil), papel_codigo: domain('papel_codigo', domains.papelUsuario).notNull().default('usuario'),
  autorizacao_versao: integer('autorizacao_versao').notNull().default(1), status: domain('status', domains.usuarioStatus).notNull().default('pendente'), ativo: bool('ativo').notNull().default(false),
}, t => [...checks(t), uniqueIndex('usuarios_email_uq').on(sql`lower(trim(${t.email}))`),
  check('usuarios_status_ativo', sql`(${t.status}='ativo' AND ${t.ativo}=1) OR (${t.status}!='ativo' AND ${t.ativo}=0)`),
  check('usuarios_ativo_perfil',sql`${t.status}!='ativo' OR ${t.perfil_codigo} IS NOT NULL`),
  check('usuarios_autorizacao_versao',sql`${t.autorizacao_versao} >= 1`)]);

export const usuario_permissoes = sqliteTable('usuario_permissoes', {
  usuario_id: fk('usuario_id', () => usuarios.id).notNull(),
  permissao_codigo: str('permissao_codigo', 100).notNull(),
  concedida_em: instant('concedida_em').notNull().default(now),
  concedida_por: fk('concedida_por', () => usuarios.id).notNull(),
}, t => [...checks(t), primaryKey({ columns: [t.usuario_id, t.permissao_codigo] }), index('usuario_permissoes_codigo_idx').on(t.permissao_codigo)]);

export const auditoria_eventos = sqliteTable('auditoria_eventos', {
  id: id(), ocorrido_em: instant('ocorrido_em').notNull().default(now), ator_usuario_id: fk('ator_usuario_id', () => usuarios.id), contexto_ator: str('contexto_ator',100),
  entidade: str('entidade',64).notNull(), registro_id: str('registro_id',36), chave_composta: text('chave_composta',{mode:'json'}).$type<Record<string,string>>(),
  operacao: str('operacao',40).notNull(), motivo: text('motivo'), antes: text('antes',{mode:'json'}).$type<Record<string,unknown>>(), depois: text('depois',{mode:'json'}).$type<Record<string,unknown>>(),
  request_id: str('request_id',64), event_code: str('event_code',100), categoria: str('categoria',40), modulo: str('modulo',64), origem: str('origem',40),
}, t => [...checks(t), check('auditoria_ator',sql`${t.ator_usuario_id} IS NOT NULL OR ${t.contexto_ator} IS NOT NULL`), check('auditoria_alvo',sql`(${t.registro_id} IS NOT NULL) + (${t.chave_composta} IS NOT NULL) = 1`), index('auditoria_registro_idx').on(t.entidade,t.registro_id,t.ocorrido_em,t.id), index('auditoria_ator_idx').on(t.ator_usuario_id), index('auditoria_request_idx').on(t.request_id), index('auditoria_evento_data_idx').on(t.event_code,t.ocorrido_em,t.id)]);

export const documentos = sqliteTable('documentos', {
  id: id(), ...audit(), nome_original: str('nome_original',255).notNull(), estado: domain('estado',domains.documento).notNull().default('referenciado'), mime_type: str('mime_type',127), tamanho_bytes: integer('tamanho_bytes'),
  chave_armazenamento: str('chave_armazenamento',512).unique(), hash_sha256: str('hash_sha256',64), versao_anterior_id: fk('versao_anterior_id',():AnySQLiteColumn=>documentos.id).unique(),
  retirado_em: instant('retirado_em'), retirado_por: fk('retirado_por',()=>usuarios.id),
}, t => [...checks(t), check('documentos_tamanho',sql`${t.tamanho_bytes} IS NULL OR ${t.tamanho_bytes} BETWEEN 1 AND 9007199254740991`),
  check('documentos_hash',sql`${t.hash_sha256} IS NULL OR (length(${t.hash_sha256})=64 AND ${t.hash_sha256} NOT GLOB '*[^0-9a-f]*')`),
  check('documentos_conteudo',sql`${t.estado} != 'disponivel' OR (${t.mime_type} IS NOT NULL AND ${t.tamanho_bytes} IS NOT NULL AND ${t.chave_armazenamento} IS NOT NULL)`),
  check('documentos_referencia',sql`${t.estado} != 'referenciado' OR (${t.mime_type} IS NULL AND ${t.tamanho_bytes} IS NULL AND ${t.chave_armazenamento} IS NULL AND ${t.hash_sha256} IS NULL)`),
  check('documentos_retirada',sql`(${t.estado}='retirado' AND ${t.retirado_em} IS NOT NULL AND ${t.retirado_por} IS NOT NULL) OR (${t.estado}!='retirado' AND ${t.retirado_em} IS NULL AND ${t.retirado_por} IS NULL)`),
  check('documentos_versao_propria',sql`${t.versao_anterior_id} IS NULL OR ${t.versao_anterior_id} != ${t.id}`), index('documentos_retirado_por_idx').on(t.retirado_por)]);

export const carteiras = sqliteTable('carteiras', {
  ...master(), codigo: code().unique(), nome: str('nome').notNull(), titular_nome: str('titular_nome').notNull(), titular_documento: str('titular_documento',32).notNull(),
  gestor_descricao: str('gestor_descricao'), descricao: text('descricao'), observacoes: text('observacoes'),
}, checks);
export const imobiliarias = sqliteTable('imobiliarias', {
  ...master(), codigo: code().unique(), razao_social: str('razao_social').notNull(), nome_fantasia: str('nome_fantasia'), documento: str('documento',32).notNull(),
  creci: str('creci',40).notNull(), contato_nome: str('contato_nome').notNull(), telefone: str('telefone',32), email: str('email',254), observacoes: text('observacoes'),
}, t=>[...checks(t),uniqueIndex('imobiliarias_documento_uq').on(sql`upper(replace(replace(replace(replace(${t.documento},'.',''),'/',''),'-',''),' ',''))`)]);
export const fornecedores = sqliteTable('fornecedores', {...master(), nome:str('nome').notNull()}, checks);
export const profissionais = sqliteTable('profissionais', {...master(), nome:str('nome').notNull()}, checks);
export const socios = sqliteTable('socios', {...master(), nome:str('nome').notNull()}, checks);
export const categorias_despesa = sqliteTable('categorias_despesa', {...master(),codigo:str('codigo',40).notNull().unique(),nome:str('nome',100).notNull()},t=>[...checks(t),uniqueIndex('categorias_nome_uq').on(sql`lower(trim(${t.nome}))`)]);
export const contas_financeiras = sqliteTable('contas_financeiras', {...master(),nome:str('nome',150).notNull()},t=>[...checks(t),uniqueIndex('contas_nome_uq').on(sql`lower(trim(${t.nome}))`)]);

export const imoveis = sqliteTable('imoveis', {
  ...master(), codigo:code().unique(), carteira_id:fk('carteira_id',()=>carteiras.id).notNull(), nome:str('nome').notNull(), endereco:str('endereco',500).notNull(),
  tipo:domain('tipo',domains.imovel).default('edificio_comercial'),cep:str('cep',16),logradouro:str('logradouro',200),numero:str('numero',40),complemento:str('complemento',120),bairro:str('bairro',120),cidade:str('cidade',120),uf:str('uf',2),
  inscricao_municipal:str('inscricao_municipal',80),matricula:str('matricula',80),cartorio_registro:str('cartorio_registro',200),gestor_descricao:str('gestor_descricao'),imagem_capa_caminho:str('imagem_capa_caminho',512),observacoes:text('observacoes'),
}, t=>[...checks(t),check('imoveis_uf',sql`${t.uf} IS NULL OR ${t.uf} GLOB '[A-Z][A-Z]'`),index('imoveis_carteira_idx').on(t.carteira_id,t.id)]);
export const locatarios = sqliteTable('locatarios', {
  ...master(),codigo:code().unique(),tipo_pessoa:domain('tipo_pessoa',domains.pessoa).notNull().default('PJ'),nome:str('nome').notNull(),documento:str('documento',32).notNull(),nome_fantasia:str('nome_fantasia'),
  contato_nome:str('contato_nome'),telefone:str('telefone',32),email:str('email',254),imobiliaria_id:fk('imobiliaria_id',()=>imobiliarias.id),
  canal_preferido:str('canal_preferido',40),endereco_cobranca:str('endereco_cobranca',500),inscricao_municipal:str('inscricao_municipal',80),observacoes:text('observacoes'),
},t=>[...checks(t),uniqueIndex('locatarios_documento_uq').on(t.tipo_pessoa,sql`upper(replace(replace(replace(replace(${t.documento},'.',''),'/',''),'-',''),' ',''))`),index('locatarios_imobiliaria_idx').on(t.imobiliaria_id,t.id)]);
export const unidades = sqliteTable('unidades', {
  ...master(),codigo:code().unique(),imovel_id:fk('imovel_id',()=>imoveis.id).notNull(),nome:str('nome').notNull(),tipo:domain('tipo',domains.unidade).default('sala_comercial'),
  area_privativa:decimal('area_privativa').notNull(),ocupada_informada:bool('ocupada_informada').notNull().default(false),
  codigo_comercial:str('codigo_comercial',40),bloco:str('bloco',120),andar:str('andar',60),area_total:decimal('area_total'),inscricao_municipal:str('inscricao_municipal',80),observacoes:text('observacoes'),
},t=>[...checks(t),uniqueIndex('unidades_nome_imovel_uq').on(t.imovel_id,sql`lower(trim(${t.nome}))`),index('unidades_ocupacao_idx').on(t.imovel_id,t.ocupada_informada,t.id)]);
export const contratos = sqliteTable('contratos', {
  id:id(),...editable(),codigo:code().unique(),imovel_id:fk('imovel_id',()=>imoveis.id).notNull(),locatario_id:fk('locatario_id',()=>locatarios.id).notNull(),inicio:date('inicio').notNull(),termino_previsto:date('termino_previsto').notNull(),
  aluguel_mensal:decimal('aluguel_mensal').notNull(),dia_vencimento:integer('dia_vencimento').notNull().default(10),indice_reajuste:str('indice_reajuste',40).default('IPCA'),mes_reajuste:integer('mes_reajuste'),
  forma_pagamento_prevista:domain('forma_pagamento_prevista',domains.pagamento),observacoes:text('observacoes'),estado:domain('estado',domains.contrato).notNull().default('rascunho'),encerrado_em:date('encerrado_em'),
  finalidade:str('finalidade',40),data_ocupacao:date('data_ocupacao'),data_assinatura:date('data_assinatura'),referencia_pagamento:str('referencia_pagamento',40),periodicidade_reajuste_meses:integer('periodicidade_reajuste_meses'),
  multa_atraso_percentual:decimal('multa_atraso_percentual'),juros_mensal_percentual:decimal('juros_mensal_percentual'),canal_envio:str('canal_envio',40),garantia_tipo:str('garantia_tipo',60),garantia_detalhe:text('garantia_detalhe'),
  regra_primeira_cobranca:str('regra_primeira_cobranca',60),forma_pagamento_texto:str('forma_pagamento_texto',40),nome_documento:str('nome_documento',255),
},t=>[...checks(t),check('contratos_periodo',sql`${t.termino_previsto} >= ${t.inicio}`),check('contratos_dia',sql`${t.dia_vencimento} BETWEEN 1 AND 31`),check('contratos_mes',sql`${t.mes_reajuste} IS NULL OR ${t.mes_reajuste} BETWEEN 1 AND 12`),
  check('contratos_encerramento',sql`(${t.estado}='encerrado' AND ${t.encerrado_em} IS NOT NULL AND ${t.encerrado_em}>=${t.inicio}) OR (${t.estado}!='encerrado' AND ${t.encerrado_em} IS NULL)`),
  index('contratos_locatario_idx').on(t.locatario_id,t.estado,t.inicio),index('contratos_imovel_idx').on(t.imovel_id,t.estado,t.inicio)]);
export const obras = sqliteTable('obras', {
  id:id(),...editable(),codigo:code().unique(),titulo:str('titulo').notNull(),imovel_id:fk('imovel_id',()=>imoveis.id).notNull(),unidade_id:fk('unidade_id',()=>unidades.id),responsavel_profissional_id:fk('responsavel_profissional_id',()=>profissionais.id).notNull(),
  tipo_intervencao:domain('tipo_intervencao',domains.intervencao).notNull().default('obra'),descricao:text('descricao').notNull(),prioridade:domain('prioridade',domains.prioridade).notNull().default('media'),estado:domain('estado',domains.obra).notNull().default('planejada'),
  risco_informado:domain('risco_informado',domains.risco).notNull().default('dentro_prazo'),progresso_percentual:nonnegative('progresso_percentual'),inicio_previsto:date('inicio_previsto').notNull(),termino_previsto:date('termino_previsto').notNull(),
  orcamento:nonnegative('orcamento'),reserva:nonnegative('reserva'),realizado_informado:nonnegative('realizado_informado'),proxima_atividade_descricao:str('proxima_atividade_descricao',500),observacoes:text('observacoes'),
},t=>[...checks(t),check('obras_periodo',sql`${t.termino_previsto}>=${t.inicio_previsto}`),check('obras_conclusao',sql`${t.estado}!='concluida' OR ${t.progresso_percentual}=10000`),index('obras_responsavel_idx').on(t.responsavel_profissional_id,t.estado,t.id),index('obras_estado_risco_idx').on(t.estado,t.risco_informado,t.id),index('obras_imovel_idx').on(t.imovel_id,t.id),index('obras_unidade_idx').on(t.unidade_id)]);
export const contrato_unidades = sqliteTable('contrato_unidades', {
  ...audit(),contrato_id:fk('contrato_id',()=>contratos.id).notNull(),unidade_id:fk('unidade_id',()=>unidades.id).notNull(),
},t=>[...checks(t),primaryKey({columns:[t.contrato_id,t.unidade_id]}),index('contrato_unidades_inverso_idx').on(t.unidade_id,t.contrato_id)]);
export const contrato_encargos = sqliteTable('contrato_encargos', {
  id:id(),...editable(),contrato_id:fk('contrato_id',()=>contratos.id).notNull(),ordem:integer('ordem').notNull(),nome:str('nome',100).notNull(),natureza:domain('natureza',domains.natureza).notNull(),valor_base:decimal('valor_base'),
},t=>[...checks(t),uniqueIndex('contrato_encargos_ordem_uq').on(t.contrato_id,t.ordem),uniqueIndex('contrato_encargos_aluguel_uq').on(t.contrato_id).where(sql`${t.natureza}='aluguel'`),check('contrato_encargos_ordem',sql`${t.ordem}>0`),check('contrato_encargos_aluguel_base',sql`${t.natureza}!='aluguel' OR ${t.valor_base} IS NULL`)]);
export const obra_atividades = sqliteTable('obra_atividades', {
  id:id(),...editable(),obra_id:fk('obra_id',()=>obras.id).notNull(),codigo:code(),etapa:domain('etapa',domains.etapa).notNull().default('execucao'),titulo:str('titulo').notNull(),responsavel_profissional_id:fk('responsavel_profissional_id',()=>profissionais.id).notNull(),
  inicio:date('inicio').notNull(),termino:date('termino').notNull(),estado:domain('estado',domains.atividade).notNull().default('nao_iniciada'),motivo_bloqueio:text('motivo_bloqueio'),
},t=>[...checks(t),uniqueIndex('obra_atividades_codigo_uq').on(t.obra_id,t.codigo),index('obra_atividades_prazo_idx').on(t.obra_id,t.termino,t.id),index('obra_atividades_responsavel_idx').on(t.responsavel_profissional_id),check('obra_atividades_periodo',sql`${t.termino}>=${t.inicio}`),check('obra_atividades_bloqueio',sql`${t.estado}!='bloqueada' OR ${t.motivo_bloqueio} IS NOT NULL`)]);
export const obra_alocacoes_equipe = sqliteTable('obra_alocacoes_equipe', {
  id:id(),...editable(),obra_id:fk('obra_id',()=>obras.id).notNull(),profissional_id:fk('profissional_id',()=>profissionais.id).notNull(),codigo:code(),funcao:str('funcao',150).notNull(),inicio:date('inicio').notNull(),termino:date('termino').notNull(),
  modalidade:domain('modalidade',domains.modalidade).notNull().default('horas'),quantidade:decimal('quantidade').notNull().default(sql`100`),valor_unitario:nonnegative('valor_unitario'),removida_em:instant('removida_em'),
},t=>[...checks(t),uniqueIndex('obra_equipe_codigo_uq').on(t.obra_id,t.codigo),index('obra_equipe_profissional_idx').on(t.profissional_id),check('obra_equipe_periodo',sql`${t.termino}>=${t.inicio}`),check('obra_equipe_quantidade',sql`${t.quantidade}>0`)]);
export const obra_socios = sqliteTable('obra_socios', {
  id:id(),...audit(),obra_id:fk('obra_id',()=>obras.id).notNull(),socio_id:fk('socio_id',()=>socios.id).notNull(),percentual:decimal('percentual').notNull(),inicio_vigencia:instant('inicio_vigencia').notNull().default(now),fim_vigencia:instant('fim_vigencia'),
},t=>[...checks(t),uniqueIndex('obra_socios_versao_uq').on(t.obra_id,t.socio_id,t.inicio_vigencia),uniqueIndex('obra_socios_corrente_uq').on(t.obra_id,t.socio_id).where(sql`${t.fim_vigencia} IS NULL`),index('obra_socios_vigencia_idx').on(t.obra_id,t.fim_vigencia,t.inicio_vigencia),index('obra_socios_socio_idx').on(t.socio_id,t.obra_id,t.inicio_vigencia),check('obra_socios_percentual',sql`${t.percentual}>0`),check('obra_socios_intervalo',sql`${t.fim_vigencia} IS NULL OR ${t.fim_vigencia}>${t.inicio_vigencia}`)]);
export const cobrancas = sqliteTable('cobrancas', {
  id:id(),...audit(),codigo:code().unique(),contrato_id:fk('contrato_id',()=>contratos.id).notNull(),competencia:date('competencia').notNull(),forma_pagamento_prevista:domain('forma_pagamento_prevista',domains.pagamento).default('boleto'),observacoes:text('observacoes'),
},t=>[...checks(t),uniqueIndex('cobrancas_competencia_uq').on(t.contrato_id,t.competencia),index('cobrancas_mes_idx').on(t.competencia,t.contrato_id),check('cobrancas_primeiro_dia',sql`substr(${t.competencia},9,2)='01'`)]);
export const despesas = sqliteTable('despesas', {
  id:id(),...editable(),codigo:str('codigo',32).unique(),fornecedor_id:fk('fornecedor_id',()=>fornecedores.id).notNull(),origem:domain('origem',domains.despesaOrigem).notNull().default('operacao'),categoria_id:fk('categoria_id',()=>categorias_despesa.id),
  descricao:str('descricao',500).notNull(),valor:decimal('valor').notNull(),competencia:str('competencia',7),vencimento:date('vencimento').notNull(),previsao_pagamento:date('previsao_pagamento'),
  alocacao_tipo:str('alocacao_tipo',40),alocacao_referencia:str('alocacao_referencia',100),tipo_lancamento:str('tipo_lancamento',40),recorrencia:str('recorrencia',100),
  tipo_documento:str('tipo_documento',40),numero_documento:str('numero_documento',100),data_emissao:date('data_emissao'),anexo_nome:str('anexo_nome',255),
  forma_pagamento_prevista:domain('forma_pagamento_prevista',domains.pagamento),conta_financeira_prevista_id:fk('conta_financeira_prevista_id',()=>contas_financeiras.id),conta_descricao_prevista:str('conta_descricao_prevista'),observacoes:text('observacoes'),
},t=>[...checks(t),check('despesas_operacao',sql`${t.origem}!='operacao' OR (${t.codigo} IS NOT NULL AND ${t.categoria_id} IS NOT NULL)`),check('despesas_contratacao_valor',sql`${t.origem}!='contratacao_obra' OR ${t.valor}>0`),index('despesas_categoria_idx').on(t.categoria_id,t.vencimento,t.id),index('despesas_fornecedor_idx').on(t.fornecedor_id,t.vencimento,t.id),index('despesas_vencimento_idx').on(t.vencimento,t.id),index('despesas_conta_idx').on(t.conta_financeira_prevista_id)]);
export const obra_equipe_atividades = sqliteTable('obra_equipe_atividades', {
  ...audit(),alocacao_id:fk('alocacao_id',()=>obra_alocacoes_equipe.id).notNull(),atividade_id:fk('atividade_id',()=>obra_atividades.id).notNull(),
},t=>[...checks(t),primaryKey({columns:[t.alocacao_id,t.atividade_id]}),index('equipe_atividades_inverso_idx').on(t.atividade_id,t.alocacao_id)]);
export const aportes = sqliteTable('aportes', {
  id:id(),...audit(),obra_id:fk('obra_id',()=>obras.id).notNull(),codigo:code(),data_solicitacao:date('data_solicitacao').notNull(),descricao:str('descricao',500).notNull(),valor_solicitado:decimal('valor_solicitado').notNull(),
},t=>[...checks(t),uniqueIndex('aportes_codigo_uq').on(t.obra_id,t.codigo),check('aportes_valor',sql`${t.valor_solicitado}>0`)]);
export const obra_ajustes_caixa = sqliteTable('obra_ajustes_caixa', {
  id:id(),...audit(),...reversal(():AnySQLiteColumn=>obra_ajustes_caixa.id),obra_id:fk('obra_id',()=>obras.id).notNull(),codigo:str('codigo',32),data_movimento:date('data_movimento').notNull(),descricao:str('descricao',500).notNull(),valor_assinado:decimal('valor_assinado').notNull(),
},t=>[...checks(t),uniqueIndex('ajustes_codigo_uq').on(t.obra_id,t.codigo),index('ajustes_data_idx').on(t.obra_id,t.data_movimento,t.id),check('ajustes_nao_zero',sql`${t.valor_assinado}!=0`)]);
export const obra_diario = sqliteTable('obra_diario', {
  id:id(),...audit(),obra_id:fk('obra_id',()=>obras.id).notNull(),codigo:code(),tipo:domain('tipo',domains.diario).notNull().default('atualizacao'),titulo:str('titulo').notNull(),descricao:text('descricao').notNull(),ocorrido_em:instant('ocorrido_em').notNull().default(now),
  autor_usuario_id:fk('autor_usuario_id',()=>usuarios.id),autor_legado_nome:str('autor_legado_nome'),progresso_registrado:decimal('progresso_registrado'),auditoria_evento_id:fk('auditoria_evento_id',()=>auditoria_eventos.id),
},t=>[...checks(t),uniqueIndex('diario_codigo_uq').on(t.obra_id,t.codigo),uniqueIndex('diario_evento_uq').on(t.obra_id,t.auditoria_evento_id),index('diario_data_idx').on(t.obra_id,t.ocorrido_em,t.id),index('diario_autor_idx').on(t.autor_usuario_id),index('diario_evento_idx').on(t.auditoria_evento_id),check('diario_autoria',sql`${t.autor_usuario_id} IS NOT NULL OR ${t.autor_legado_nome} IS NOT NULL OR ${t.auditoria_evento_id} IS NOT NULL`)]);
export const obra_pendencias = sqliteTable('obra_pendencias', {
  id:id(),...editable(),obra_id:fk('obra_id',()=>obras.id).notNull(),codigo:code(),titulo:str('titulo').notNull(),descricao:text('descricao').notNull(),severidade:domain('severidade',domains.severidade).notNull().default('informativa'),resolvida_em:instant('resolvida_em'),resolvida_por:fk('resolvida_por',()=>usuarios.id),
},t=>[...checks(t),uniqueIndex('pendencias_codigo_uq').on(t.obra_id,t.codigo),index('pendencias_resolvida_por_idx').on(t.resolvida_por),check('pendencias_resolucao',sql`(${t.resolvida_em} IS NULL)=(${t.resolvida_por} IS NULL)`)]);
// E35 obra_compromissos is deliberately not created: the approved model conditions it on D15.
export const cobranca_itens = sqliteTable('cobranca_itens', {
  id:id(),...audit(),cobranca_id:fk('cobranca_id',()=>cobrancas.id).notNull(),contrato_encargo_id:fk('contrato_encargo_id',()=>contrato_encargos.id),ordem:integer('ordem').notNull(),nome_emissao:str('nome_emissao',100).notNull(),natureza:domain('natureza',domains.natureza).notNull(),vencimento:date('vencimento').notNull(),valor:decimal('valor').notNull(),referencia:str('referencia',250),
},t=>[...checks(t),uniqueIndex('itens_ordem_uq').on(t.cobranca_id,t.ordem),index('itens_vencimento_idx').on(t.cobranca_id,t.vencimento,t.id),index('itens_encargo_idx').on(t.contrato_encargo_id),check('itens_ordem',sql`${t.ordem}>0`)]);
export const negociacoes = sqliteTable('negociacoes', {
  id:id(),...audit(),cobranca_id:fk('cobranca_id',()=>cobrancas.id).notNull(),versao:integer('versao').notNull(),negociacao_anterior_id:fk('negociacao_anterior_id',():AnySQLiteColumn=>negociacoes.id).unique(),saldo_base:decimal('saldo_base').notNull(),
  desconto:nonnegative('desconto'),acrescimo:nonnegative('acrescimo'),entrada_prevista:nonnegative('entrada_prevista'),quantidade_parcelas:integer('quantidade_parcelas').notNull().default(3),primeiro_vencimento:date('primeiro_vencimento').notNull(),data_acordo:date('data_acordo').notNull(),
  motivo:domain('motivo',domains.negociacaoMotivo).notNull().default('inadimplencia_temporaria'),motivo_outro:text('motivo_outro'),forma_pagamento_prevista:domain('forma_pagamento_prevista',domains.pagamento).default('boleto'),
  multa:nonnegative('multa'),juros:nonnegative('juros'),correcao:nonnegative('correcao'),contato_nome:str('contato_nome'),contato_canal:str('contato_canal',40),documento_nome:str('documento_nome',255),observacoes:text('observacoes'),substituida_em:instant('substituida_em'),
},t=>[...checks(t),uniqueIndex('negociacoes_versao_uq').on(t.cobranca_id,t.versao),uniqueIndex('negociacoes_vigente_uq').on(t.cobranca_id).where(sql`${t.substituida_em} IS NULL`),
  check('negociacoes_termos',sql`${t.versao}>0 AND ${t.saldo_base}>0 AND ${t.desconto}<=${t.saldo_base} AND ${t.entrada_prevista}<${t.saldo_base}-${t.desconto}+${t.acrescimo} AND ${t.saldo_base}-${t.desconto}+${t.acrescimo}<=999999999999999 AND ${t.quantidade_parcelas} BETWEEN 1 AND 24 AND ${t.saldo_base}-${t.desconto}+${t.acrescimo}-${t.entrada_prevista}>=${t.quantidade_parcelas}`),check('negociacoes_nao_propria',sql`${t.negociacao_anterior_id} IS NULL OR ${t.negociacao_anterior_id}!=${t.id}`)]);
export const recebimentos = sqliteTable('recebimentos', {
  id:id(),...audit(),...reversal(():AnySQLiteColumn=>recebimentos.id),codigo:code().unique(),cobranca_id:fk('cobranca_id',()=>cobrancas.id).notNull(),data_recebimento:date('data_recebimento').notNull(),data_credito:date('data_credito'),valor:decimal('valor').notNull(),valor_recebido:nonnegative('valor_recebido'),desconto:nonnegative('desconto'),acrescimo:nonnegative('acrescimo'),forma_pagamento:domain('forma_pagamento',domains.pagamento),conta_financeira_id:fk('conta_financeira_id',()=>contas_financeiras.id),conta_descricao:str('conta_descricao'),referencia:str('referencia',250),pagador_descricao:str('pagador_descricao'),comprovante_nome:str('comprovante_nome',255),observacoes:text('observacoes'),
},t=>[...checks(t),check('recebimentos_valor',sql`${t.valor}>0`),index('recebimentos_cobranca_idx').on(t.cobranca_id,t.data_recebimento,t.id),index('recebimentos_conta_idx').on(t.conta_financeira_id)]);
export const pagamentos_despesa = sqliteTable('pagamentos_despesa', {
  id:id(),...audit(),...reversal(():AnySQLiteColumn=>pagamentos_despesa.id),despesa_id:fk('despesa_id',()=>despesas.id).notNull(),codigo:str('codigo',32),data_pagamento:date('data_pagamento').notNull(),valor:decimal('valor').notNull(),forma_pagamento:domain('forma_pagamento',domains.pagamento),conta_financeira_id:fk('conta_financeira_id',()=>contas_financeiras.id),observacoes:text('observacoes'),
},t=>[...checks(t),check('pagamentos_despesa_valor',sql`${t.valor}>0`),uniqueIndex('pagamentos_codigo_uq').on(t.despesa_id,t.codigo),index('pagamentos_despesa_data_idx').on(t.despesa_id,t.data_pagamento,t.id),index('pagamentos_conta_idx').on(t.conta_financeira_id)]);
export const obra_contratacoes = sqliteTable('obra_contratacoes', {
  despesa_id:fk('despesa_id',()=>despesas.id).primaryKey().notNull(),obra_id:fk('obra_id',()=>obras.id).notNull(),codigo:code(),tipo_fornecimento:domain('tipo_fornecimento',domains.fornecimento).notNull().default('servico'),data_contratacao:date('data_contratacao').notNull(),
},t=>[...checks(t),uniqueIndex('obra_contratacoes_codigo_uq').on(t.obra_id,t.codigo)]);
export const aporte_cotas = sqliteTable('aporte_cotas', {
  id:id(),...audit(),aporte_id:fk('aporte_id',()=>aportes.id).notNull(),obra_socio_id:fk('obra_socio_id',()=>obra_socios.id).notNull(),ordem_rateio:integer('ordem_rateio').notNull(),nome_socio_pactuado:str('nome_socio_pactuado').notNull(),valor_devido:decimal('valor_devido').notNull(),
},t=>[...checks(t),uniqueIndex('cotas_participacao_uq').on(t.aporte_id,t.obra_socio_id),uniqueIndex('cotas_ordem_uq').on(t.aporte_id,t.ordem_rateio),index('cotas_participacao_idx').on(t.obra_socio_id,t.aporte_id),check('cotas_ordem',sql`${t.ordem_rateio}>0`)]);
export const negociacao_parcelas = sqliteTable('negociacao_parcelas', {
  id:id(),...audit(),negociacao_id:fk('negociacao_id',()=>negociacoes.id).notNull(),numero:integer('numero').notNull(),vencimento:date('vencimento').notNull(),valor:decimal('valor').notNull(),
},t=>[...checks(t),uniqueIndex('parcelas_numero_uq').on(t.negociacao_id,t.numero),check('parcelas_numero',sql`${t.numero} BETWEEN 0 AND 24`),check('parcelas_valor',sql`${t.valor}>0`)]);
export const aporte_pagamentos = sqliteTable('aporte_pagamentos', {
  id:id(),...audit(),...reversal(():AnySQLiteColumn=>aporte_pagamentos.id),cota_id:fk('cota_id',()=>aporte_cotas.id).notNull(),codigo:str('codigo',32),data_pagamento:date('data_pagamento').notNull(),valor:decimal('valor').notNull(),observacoes:text('observacoes'),
},t=>[...checks(t),check('aporte_pagamentos_valor',sql`${t.valor}>0`),index('aporte_pagamentos_cota_idx').on(t.cota_id,t.data_pagamento,t.id),index('aporte_pagamentos_codigo_idx').on(t.codigo).where(sql`${t.codigo} IS NOT NULL`)]);
export const documento_vinculos = sqliteTable('documento_vinculos', {
  id:id(),...audit(),documento_id:fk('documento_id',()=>documentos.id).notNull(),despesa_id:fk('despesa_id',()=>despesas.id),pagamento_despesa_id:fk('pagamento_despesa_id',()=>pagamentos_despesa.id),diario_id:fk('diario_id',()=>obra_diario.id),
},t=>[...checks(t),check('documento_vinculos_alvo',sql`(${t.despesa_id} IS NOT NULL)+(${t.pagamento_despesa_id} IS NOT NULL)+(${t.diario_id} IS NOT NULL)=1`),
  uniqueIndex('documento_despesa_uq').on(t.documento_id,t.despesa_id),uniqueIndex('documento_pagamento_uq').on(t.documento_id,t.pagamento_despesa_id),uniqueIndex('documento_diario_uq').on(t.documento_id,t.diario_id),
  index('documentos_por_despesa_idx').on(t.despesa_id,t.documento_id).where(sql`${t.despesa_id} IS NOT NULL`),index('documentos_por_pagamento_idx').on(t.pagamento_despesa_id,t.documento_id).where(sql`${t.pagamento_despesa_id} IS NOT NULL`),index('documentos_por_diario_idx').on(t.diario_id,t.documento_id).where(sql`${t.diario_id} IS NOT NULL`)]);
export const documento_imovel_vinculos = sqliteTable('documento_imovel_vinculos', {
  id:id(),...audit(),documento_id:fk('documento_id',()=>documentos.id).notNull(),imovel_id:fk('imovel_id',()=>imoveis.id).notNull(),topico:str('topico',64).notNull(),
},t=>[...checks(t),uniqueIndex('documento_imovel_uq').on(t.documento_id,t.imovel_id),index('documentos_por_imovel_idx').on(t.imovel_id,t.topico,t.documento_id)]);
export const recebimento_alocacoes = sqliteTable('recebimento_alocacoes', {
  id:id(),...audit(),recebimento_id:fk('recebimento_id',()=>recebimentos.id).notNull(),cobranca_item_id:fk('cobranca_item_id',()=>cobranca_itens.id),negociacao_parcela_id:fk('negociacao_parcela_id',()=>negociacao_parcelas.id),valor:decimal('valor').notNull(),
},t=>[...checks(t),check('recebimento_alocacoes_alvo',sql`(${t.cobranca_item_id} IS NOT NULL)+(${t.negociacao_parcela_id} IS NOT NULL)=1`),check('recebimento_alocacoes_valor',sql`${t.valor}>0`),
  uniqueIndex('alocacoes_recebimento_item_uq').on(t.recebimento_id,t.cobranca_item_id),uniqueIndex('alocacoes_recebimento_parcela_uq').on(t.recebimento_id,t.negociacao_parcela_id),
  index('alocacoes_por_item_idx').on(t.cobranca_item_id,t.recebimento_id).where(sql`${t.cobranca_item_id} IS NOT NULL`),index('alocacoes_por_parcela_idx').on(t.negociacao_parcela_id,t.recebimento_id).where(sql`${t.negociacao_parcela_id} IS NOT NULL`)]);

export const tables = { usuarios, usuario_permissoes, auditoria_eventos, documentos, carteiras, imobiliarias, fornecedores, profissionais, socios, categorias_despesa, contas_financeiras, imoveis, locatarios, unidades, contratos, obras, contrato_unidades, contrato_encargos, obra_atividades, obra_alocacoes_equipe, obra_socios, cobrancas, despesas, obra_equipe_atividades, aportes, obra_ajustes_caixa, obra_diario, obra_pendencias, cobranca_itens, negociacoes, recebimentos, pagamentos_despesa, obra_contratacoes, aporte_cotas, negociacao_parcelas, aporte_pagamentos, documento_vinculos, documento_imovel_vinculos, recebimento_alocacoes };
export type EntityName = keyof typeof tables;
export type EntityModels = { [K in EntityName]: typeof tables[K]['$inferSelect'] };
export type EntityInserts = { [K in EntityName]: typeof tables[K]['$inferInsert'] };
