/** One-time compiler for migration 0001. Never run against an applied migration.
 * SQL is checked in, reviewed and checksum-verified by the runner; runtime does not generate schema.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { Column, is } from 'drizzle-orm';
import { tables } from '../db/schema.ts';
const q = value => `"${value.replaceAll('"','""')}"`;
const configs = Object.values(tables).map(getTableConfig);
const byName = Object.fromEntries(configs.map(c => [c.name,c]));
const statements = [];
const emit = sql => statements.push(sql.trim());
const stop = message => `SELECT RAISE(ABORT, '${message}');`;
const context = '(SELECT ator_usuario_id FROM __write_context WHERE id=1)';
const isNew = (table, id) => `EXISTS (SELECT 1 FROM __write_context, json_each(novos_registros) j WHERE json_extract(j.value,'$.tabela')='${table}' AND json_extract(j.value,'$.id')=${id})`;

emit(`CREATE TABLE __transaction_end (id INTEGER PRIMARY KEY CHECK(id=1));`);
emit(`CREATE TRIGGER __transaction_end_never_insert BEFORE INSERT ON __transaction_end BEGIN ${stop('Sentinela transacional deve permanecer vazia')} END;`);
emit(`CREATE TABLE __write_context (
 id INTEGER PRIMARY KEY CHECK(id=1), ator_usuario_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
 contexto_ator TEXT, motivo TEXT, iniciado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 novos_registros TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(novos_registros) AND json_type(novos_registros)='array'),
 encerramento_obrigatorio INTEGER NOT NULL DEFAULT 1 CHECK(encerramento_obrigatorio=1)
 REFERENCES __transaction_end(id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(ator_usuario_id IS NOT NULL OR (contexto_ator IS NOT NULL AND length(trim(contexto_ator)) BETWEEN 1 AND 100))
);`);
emit(`CREATE TRIGGER __context_actor BEFORE INSERT ON __write_context WHEN NEW.ator_usuario_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM usuarios WHERE id=NEW.ator_usuario_id AND ativo=1 AND perfil_codigo='administrador') BEGIN ${stop('Ator inativo ou sem perfil suportado')} END;`);
emit(`CREATE TRIGGER __context_identity BEFORE UPDATE ON __write_context WHEN NEW.id!=OLD.id OR NEW.ator_usuario_id IS NOT OLD.ator_usuario_id OR NEW.contexto_ator IS NOT OLD.contexto_ator OR NEW.motivo IS NOT OLD.motivo OR NEW.iniciado_em IS NOT OLD.iniciado_em OR NEW.encerramento_obrigatorio IS NOT OLD.encerramento_obrigatorio BEGIN ${stop('Contexto de autoria imutavel na transacao')} END;`);

const invariants = [
 ['contrato_unidade_imovel', `SELECT 1 FROM contrato_unidades x JOIN contratos c ON c.id=x.contrato_id JOIN unidades u ON u.id=x.unidade_id WHERE c.imovel_id!=u.imovel_id`],
 ['contrato_ativo_sem_unidade', `SELECT 1 FROM contratos c WHERE estado='ativo' AND NOT EXISTS(SELECT 1 FROM contrato_unidades x WHERE x.contrato_id=c.id)`],
 ['obra_unidade_imovel', `SELECT 1 FROM obras o JOIN unidades u ON u.id=o.unidade_id WHERE o.imovel_id!=u.imovel_id`],
 ['encargo_contrato', `SELECT 1 FROM cobranca_itens i JOIN cobrancas c ON c.id=i.cobranca_id JOIN contrato_encargos e ON e.id=i.contrato_encargo_id WHERE c.contrato_id!=e.contrato_id`],
 ['cobranca_sem_item', `SELECT 1 FROM cobrancas c WHERE NOT EXISTS(SELECT 1 FROM cobranca_itens i WHERE i.cobranca_id=c.id)`],
 ['alocacao_integral', `SELECT 1 FROM recebimentos r WHERE r.valor!=COALESCE((SELECT SUM(a.valor) FROM recebimento_alocacoes a WHERE a.recebimento_id=r.id),0)`],
 ['alocacao_mesma_cobranca', `SELECT 1 FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id LEFT JOIN cobranca_itens i ON i.id=a.cobranca_item_id LEFT JOIN negociacao_parcelas p ON p.id=a.negociacao_parcela_id LEFT JOIN negociacoes n ON n.id=p.negociacao_id WHERE COALESCE(i.cobranca_id,n.cobranca_id)!=r.cobranca_id`],
 ['item_sobrepago', `SELECT 1 FROM cobranca_itens i WHERE COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id WHERE a.cobranca_item_id=i.id),0) NOT BETWEEN 0 AND i.valor`],
 ['parcela_sobrepaga', `SELECT 1 FROM negociacao_parcelas p WHERE COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id WHERE a.negociacao_parcela_id=p.id),0) NOT BETWEEN 0 AND p.valor`],
 ['despesa_sobrepaga', `SELECT 1 FROM despesas d WHERE COALESCE((SELECT SUM(CASE WHEN estorno_de_id IS NULL THEN valor ELSE -valor END) FROM pagamentos_despesa p WHERE p.despesa_id=d.id),0) NOT BETWEEN 0 AND d.valor`],
 ['cota_sobrepaga', `SELECT 1 FROM aporte_cotas c WHERE COALESCE((SELECT SUM(CASE WHEN estorno_de_id IS NULL THEN valor ELSE -valor END) FROM aporte_pagamentos p WHERE p.cota_id=c.id),0) NOT BETWEEN 0 AND c.valor_devido`],
 ['despesa_especializacao', `SELECT 1 FROM despesas d WHERE (d.origem='contratacao_obra') != EXISTS(SELECT 1 FROM obra_contratacoes c WHERE c.despesa_id=d.id)`],
 ['equipe_atividade_obra', `SELECT 1 FROM obra_equipe_atividades x JOIN obra_alocacoes_equipe e ON e.id=x.alocacao_id JOIN obra_atividades a ON a.id=x.atividade_id WHERE e.obra_id!=a.obra_id`],
 ['participacao_sobreposta', `SELECT 1 FROM obra_socios a JOIN obra_socios b ON a.obra_id=b.obra_id AND a.socio_id=b.socio_id AND a.id<b.id WHERE a.inicio_vigencia<COALESCE(b.fim_vigencia,'9999') AND b.inicio_vigencia<COALESCE(a.fim_vigencia,'9999')`],
 ['participacao_total', `SELECT obra_id FROM obra_socios WHERE fim_vigencia IS NULL GROUP BY obra_id HAVING SUM(percentual)>10000`],
 ['cota_mesma_obra', `SELECT 1 FROM aporte_cotas c JOIN aportes a ON a.id=c.aporte_id JOIN obra_socios s ON s.id=c.obra_socio_id WHERE a.obra_id!=s.obra_id`],
 ['cota_socio_repetido', `SELECT c.aporte_id,s.socio_id FROM aporte_cotas c JOIN obra_socios s ON s.id=c.obra_socio_id GROUP BY c.aporte_id,s.socio_id HAVING COUNT(*)>1`],
 ['aporte_rateio', `SELECT 1 FROM aportes a WHERE a.valor_solicitado!=COALESCE((SELECT SUM(valor_devido) FROM aporte_cotas c WHERE c.aporte_id=a.id),0) OR 10000!=COALESCE((SELECT SUM(s.percentual) FROM aporte_cotas c JOIN obra_socios s ON s.id=c.obra_socio_id WHERE c.aporte_id=a.id),0)`],
 ['pagamento_aporte_codigo', `SELECT a.obra_id,p.codigo FROM aporte_pagamentos p JOIN aporte_cotas c ON c.id=p.cota_id JOIN aportes a ON a.id=c.aporte_id WHERE p.codigo IS NOT NULL GROUP BY a.obra_id,p.codigo HAVING COUNT(*)>1`],
 ['negociacao_cadeia', `SELECT 1 FROM negociacoes n LEFT JOIN negociacoes p ON p.id=n.negociacao_anterior_id WHERE (n.negociacao_anterior_id IS NULL AND n.versao!=1) OR (n.negociacao_anterior_id IS NOT NULL AND (p.cobranca_id!=n.cobranca_id OR p.versao+1!=n.versao OR p.substituida_em IS NULL)) OR (n.substituida_em IS NOT NULL AND NOT EXISTS(SELECT 1 FROM negociacoes s WHERE s.negociacao_anterior_id=n.id))`],
 ['negociacao_parcelas', `SELECT 1 FROM negociacoes n WHERE n.quantidade_parcelas!=(SELECT COUNT(*) FROM negociacao_parcelas p WHERE p.negociacao_id=n.id AND numero>0) OR n.quantidade_parcelas!=COALESCE((SELECT MAX(numero) FROM negociacao_parcelas p WHERE p.negociacao_id=n.id),0) OR n.saldo_base-n.desconto+n.acrescimo!=COALESCE((SELECT SUM(valor) FROM negociacao_parcelas p WHERE p.negociacao_id=n.id),0) OR n.entrada_prevista!=COALESCE((SELECT valor FROM negociacao_parcelas p WHERE p.negociacao_id=n.id AND numero=0),0)`],
 ['parcelas_calendario', `SELECT 1 FROM negociacao_parcelas p JOIN negociacoes n ON n.id=p.negociacao_id WHERE p.numero>0 AND p.vencimento!=date(n.primeiro_vencimento,'start of month',printf('+%d months',p.numero-1),printf('+%d days',MIN(CAST(strftime('%d',n.primeiro_vencimento) AS INTEGER),CAST(strftime('%d',date(n.primeiro_vencimento,'start of month',printf('+%d months',p.numero),'-1 day')) AS INTEGER))-1))`],
 ['documento_ciclo', `WITH RECURSIVE cadeia(raiz,id,caminho,ciclo) AS (SELECT id,versao_anterior_id,','||id||',',0 FROM documentos WHERE versao_anterior_id IS NOT NULL UNION ALL SELECT c.raiz,d.versao_anterior_id,c.caminho||d.id||',',instr(c.caminho,','||d.id||',')>0 FROM cadeia c JOIN documentos d ON d.id=c.id WHERE c.ciclo=0) SELECT 1 FROM cadeia WHERE ciclo=1`],
 ['diario_automatico_autor', `SELECT 1 FROM obra_diario d LEFT JOIN auditoria_eventos a ON a.id=d.auditoria_evento_id WHERE d.autor_usuario_id IS NULL AND d.autor_legado_nome IS NULL AND (a.id IS NULL OR a.ator_usuario_id IS NOT NULL OR a.contexto_ator IS NULL)`],
];
for (const [table,parent,value] of [['recebimentos','cobranca_id','valor'],['pagamentos_despesa','despesa_id','valor'],['aporte_pagamentos','cota_id','valor'],['obra_ajustes_caixa','obra_id','valor_assinado']]) {
  invariants.push([`${table}_estorno`, `SELECT 1 FROM ${table} r JOIN ${table} o ON o.id=r.estorno_de_id WHERE o.estorno_de_id IS NOT NULL OR r.${parent}!=o.${parent} OR r.${value}!=${table==='obra_ajustes_caixa'?'-':''}o.${value}`]);
}
invariants.push(['estorno_alocacoes', `SELECT 1 FROM recebimentos r JOIN recebimento_alocacoes a ON a.recebimento_id=r.id WHERE r.estorno_de_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM recebimento_alocacoes o WHERE o.recebimento_id=r.estorno_de_id AND o.cobranca_item_id IS a.cobranca_item_id AND o.negociacao_parcela_id IS a.negociacao_parcela_id AND o.valor=a.valor)`]);
emit(`CREATE VIEW __integrity_violations AS ${invariants.map(([name,query])=>`SELECT '${name}' AS regra WHERE EXISTS(${query})`).join('\nUNION ALL\n')};`);
emit(`CREATE TRIGGER __validate_transaction BEFORE DELETE ON __write_context WHEN EXISTS(SELECT 1 FROM __integrity_violations) BEGIN SELECT RAISE(ABORT, 'Integridade transacional: ' || (SELECT regra FROM __integrity_violations LIMIT 1)); END;`);

const immutable = new Set(['auditoria_eventos','cobrancas','cobranca_itens','recebimentos','recebimento_alocacoes','negociacao_parcelas','pagamentos_despesa','aportes','aporte_cotas','aporte_pagamentos','obra_ajustes_caixa','obra_diario','documento_vinculos']);
const noDelete = new Set([...immutable,'negociacoes','documentos','despesas','obra_contratacoes','obra_atividades','obra_pendencias','obra_alocacoes_equipe','obra_socios']);
for (const c of configs) {
  const columns=c.columns.map(x=>x.name);
  const pk=c.columns.filter(x=>x.primary).map(x=>x.name).concat(c.primaryKeys.flatMap(x=>x.columns.map(y=>y.name)));
  const simple=pk.length===1;
  const key=prefix=>simple?`${prefix}.${q(pk[0])}`:`json_object(${pk.map(n=>`'${n}',${prefix}.${q(n)}`).join(',')})`;
  const snapshot=prefix=>`json_object(${columns.filter(n=>n!=='senha_hash').map(n=>`'${n}',${prefix}.${q(n)}`).join(',')})`;
  for (const operation of ['INSERT','UPDATE','DELETE']) {
    emit(`CREATE TRIGGER ${q(`${c.name}_context_${operation.toLowerCase()}`)} BEFORE ${operation} ON ${q(c.name)} WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN ${stop('Escrita exige transacao com contexto de auditoria')} END;`);
    if (operation==='UPDATE') {
      if (immutable.has(c.name)) emit(`CREATE TRIGGER ${q(`${c.name}_immutable`)} BEFORE UPDATE ON ${q(c.name)} BEGIN ${stop('Registro imutavel; use estorno ou nova versao')} END;`);
      else {
        emit(`CREATE TRIGGER ${q(`${c.name}_identity`)} BEFORE UPDATE ON ${q(c.name)} WHEN ${[...pk,...columns.filter(n=>['created_at','created_by'].includes(n))].map(n=>`NEW.${q(n)} IS NOT OLD.${q(n)}`).join(' OR ')} BEGIN ${stop('Identidade e autoria de criacao imutaveis')} END;`);
      }
    }
    if (operation==='DELETE' && noDelete.has(c.name)) emit(`CREATE TRIGGER ${q(`${c.name}_preserve`)} BEFORE DELETE ON ${q(c.name)} BEGIN ${stop('Exclusao fisica vedada; preserve historico')} END;`);
    if (c.name==='auditoria_eventos') continue;
    const prefix=operation==='DELETE'?'OLD':'NEW';
    const authorColumn=operation==='INSERT'?'created_by':operation==='UPDATE'?'updated_by':null;
    if(authorColumn && columns.includes(authorColumn)) emit(`CREATE TRIGGER ${q(`${c.name}_author_${operation.toLowerCase()}`)} BEFORE ${operation} ON ${q(c.name)} WHEN NEW.${authorColumn} IS NOT ${context} BEGIN ${stop('Autoria deve corresponder ao contexto da transacao')} END;`);
    if(operation==='UPDATE' && columns.includes('updated_at')) emit(`CREATE TRIGGER ${q(`${c.name}_updated_at`)} BEFORE UPDATE ON ${q(c.name)} WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN ${stop('updated_at deve registrar o instante da alteracao')} END;`);
    emit(`CREATE TRIGGER ${q(`${c.name}_audit_${operation.toLowerCase()}`)} AFTER ${operation} ON ${q(c.name)} BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,${simple?'registro_id':'chave_composta'},operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'${c.name}',${key(prefix)},'${operation.toLowerCase()}',motivo,${operation==='INSERT'?'NULL':snapshot('OLD')},${operation==='DELETE'?'NULL':snapshot('NEW')} FROM __write_context WHERE id=1;
      ${operation==='INSERT'?`UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','${c.name}','id',${key('NEW')})) WHERE id=1;`:''}
      END;`);
  }
  // Guard new references to inactive masters, without invalidating historical references on other updates.
  for(const reference of c.foreignKeys){
    const ref=reference.reference();
    const target=getTableConfig(ref.foreignTable);
    if(!target.columns.some(x=>x.name==='ativo')) continue;
    const column=ref.columns[0].name;
    if(['created_by','updated_by','ator_usuario_id'].includes(column)) continue;
    for(const op of ['INSERT','UPDATE']) emit(`CREATE TRIGGER ${q(`${c.name}_${column}_active_${op.toLowerCase()}`)} BEFORE ${op} ON ${q(c.name)} WHEN ${op==='UPDATE'?`NEW.${q(column)} IS NOT OLD.${q(column)} AND `:''}NEW.${q(column)} IS NOT NULL AND EXISTS(SELECT 1 FROM ${q(target.name)} WHERE id=NEW.${q(column)} AND ativo=0) BEGIN ${stop('Novo vinculo exige cadastro ativo')} END;`);
  }
}

const guard=(name,table,event,condition,message)=>emit(`CREATE TRIGGER ${q(name)} BEFORE ${event} ON ${q(table)} WHEN ${condition} BEGIN ${stop(message)} END;`);
for(const [child,parent,column] of [['cobranca_itens','cobrancas','cobranca_id'],['recebimento_alocacoes','recebimentos','recebimento_id'],['negociacao_parcelas','negociacoes','negociacao_id'],['aporte_cotas','aportes','aporte_id']]) guard(`${child}_emissao_atomica`,child,'INSERT',`NOT ${isNew(parent,`NEW.${column}`)}`,'Composicao deve ser emitida junto ao registro principal');
guard('contratacao_emissao','obra_contratacoes','INSERT',`NOT ${isNew('despesas','NEW.despesa_id')}`,'Contratacao deve ser criada com a despesa');
guard('contratos_partes','contratos','UPDATE',`OLD.estado!='rascunho' AND (NEW.imovel_id!=OLD.imovel_id OR NEW.locatario_id!=OLD.locatario_id OR NEW.estado='rascunho')`,'Partes de contrato emitido imutaveis');
guard('contratos_historico_delete','contratos','DELETE',`OLD.estado!='rascunho'`,'Somente rascunho pode ser removido');
for(const op of ['INSERT','UPDATE','DELETE']) guard(`contrato_unidades_rascunho_${op}`,'contrato_unidades',op,`EXISTS(SELECT 1 FROM contratos WHERE id=${op==='DELETE'?'OLD':'NEW'}.contrato_id AND estado!='rascunho')`,'Unidades de contrato emitido imutaveis');
for(const op of ['UPDATE','DELETE']) guard(`encargos_rascunho_${op}`,'contrato_encargos',op,`EXISTS(SELECT 1 FROM contratos WHERE id=OLD.contrato_id AND estado!='rascunho')`,'Encargo de contrato emitido requer aditivo futuro');
guard('imovel_carteira_historica','imoveis','UPDATE',`NEW.carteira_id!=OLD.carteira_id AND EXISTS(SELECT 1 FROM contratos WHERE imovel_id=OLD.id AND estado!='rascunho')`,'Transferencia de carteira depende de D17');
guard('unidade_imovel_historico','unidades','UPDATE',`NEW.imovel_id!=OLD.imovel_id AND EXISTS(SELECT 1 FROM contrato_unidades WHERE unidade_id=OLD.id)`,'Unidade utilizada nao pode mudar de imovel');
guard('despesa_valor_pago','despesas','UPDATE',`(NEW.valor!=OLD.valor OR NEW.fornecedor_id!=OLD.fornecedor_id OR NEW.origem!=OLD.origem) AND EXISTS(SELECT 1 FROM pagamentos_despesa WHERE despesa_id=OLD.id)`,'Obrigacao com pagamento nao pode mudar de valor ou credor');
guard('despesa_origem','despesas','UPDATE',`NEW.origem!=OLD.origem`,'Origem da obrigacao imutavel');
for(const [name,allowed] of [['negociacoes',['substituida_em']],['obra_socios',['fim_vigencia']]]) {
 const all=byName[name].columns.map(x=>x.name).filter(x=>!allowed.includes(x));
 guard(`${name}_versao_imutavel`,name,'UPDATE',all.map(x=>`NEW.${q(x)} IS NOT OLD.${q(x)}`).join(' OR '),'Termos de versao imutaveis');
 guard(`${name}_fechamento_unico`,name,'UPDATE',`OLD.${allowed[0]} IS NOT NULL OR NEW.${allowed[0]} IS NULL`,'Versao fechada nao pode reabrir');
}
guard('documento_metadados_publicados','documentos','UPDATE',`NEW.versao_anterior_id IS NOT OLD.versao_anterior_id OR NEW.nome_original!=OLD.nome_original OR (OLD.estado!='referenciado' AND (${['mime_type','tamanho_bytes','chave_armazenamento','hash_sha256'].map(x=>`NEW.${x} IS NOT OLD.${x}`).join(' OR ')})) OR OLD.estado='retirado' OR (OLD.estado='disponivel' AND NEW.estado='referenciado')`,'Documento publicado exige nova versao');
guard('documento_versao_existente','documentos','INSERT',`NEW.versao_anterior_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documentos WHERE id=NEW.versao_anterior_id)`,'Versao anterior deve existir');
guard('alocacao_vigente','recebimento_alocacoes','INSERT',`(SELECT estorno_de_id FROM recebimentos WHERE id=NEW.recebimento_id) IS NULL AND ((NEW.cobranca_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM negociacoes n JOIN cobranca_itens i ON i.cobranca_id=n.cobranca_id WHERE i.id=NEW.cobranca_item_id)) OR (NEW.negociacao_parcela_id IS NOT NULL AND EXISTS(SELECT 1 FROM negociacao_parcelas p JOIN negociacoes n ON n.id=p.negociacao_id WHERE p.id=NEW.negociacao_parcela_id AND n.substituida_em IS NOT NULL)))`,'Pagamento exige obrigacao vigente');
guard('estorno_pre_acordo','recebimentos','INSERT',`NEW.estorno_de_id IS NOT NULL AND EXISTS(SELECT 1 FROM recebimento_alocacoes a LEFT JOIN negociacao_parcelas p ON p.id=a.negociacao_parcela_id JOIN negociacoes n ON n.cobranca_id=NEW.cobranca_id WHERE a.recebimento_id=NEW.estorno_de_id AND (a.cobranca_item_id IS NOT NULL OR n.negociacao_anterior_id=p.negociacao_id))`,'Estorno afetaria base de acordo posterior: D09');
guard('negociacao_base','negociacoes','INSERT',`NEW.saldo_base != CASE WHEN NEW.negociacao_anterior_id IS NULL THEN COALESCE((SELECT SUM(valor) FROM cobranca_itens WHERE cobranca_id=NEW.cobranca_id),0)-COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id WHERE r.cobranca_id=NEW.cobranca_id AND a.cobranca_item_id IS NOT NULL),0) ELSE COALESCE((SELECT SUM(valor) FROM negociacao_parcelas WHERE negociacao_id=NEW.negociacao_anterior_id),0)-COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id JOIN negociacao_parcelas p ON p.id=a.negociacao_parcela_id WHERE p.negociacao_id=NEW.negociacao_anterior_id),0) END`,'Saldo-base da negociacao diverge da obrigacao vigente');
guard('aporte_quadro_completo','aportes','INSERT',`10000!=COALESCE((SELECT SUM(percentual) FROM obra_socios WHERE obra_id=NEW.obra_id AND fim_vigencia IS NULL),0)`,'Aporte exige participacoes correntes de 100 por cento');
guard('cota_versao_corrente','aporte_cotas','INSERT',`EXISTS(SELECT 1 FROM obra_socios WHERE id=NEW.obra_socio_id AND fim_vigencia IS NOT NULL)`,'Cota nova deve usar a participacao corrente');

writeFileSync(new URL('../drizzle/0001_integridade_e_auditoria.sql',import.meta.url),statements.join('\n--> statement-breakpoint\n')+'\n');
// Order the initial generated DDL by the dependency order in schema.ts, then indexes.
const initialUrl=new URL('../drizzle/0000_estrutura_inicial.sql',import.meta.url);
const initial=readFileSync(initialUrl,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
// Drizzle Kit 0.31.x misquotes comma-containing SQLite expression indexes. Render those from the ORM AST.
const dialect=new SQLiteSyncDialect();
const render=expression=>{
 const query=dialect.sqlToQuery(expression);
 if(query.params.length) throw new Error('Index/check expressions must not contain bound parameters');
 return query.sql.replace(/"[a-z_]+"\./g,'');
};
for(const c of configs) for(const index of c.indexes) {
 const config=index.config;
 const position=initial.findIndex(s=>s.startsWith(`CREATE ${config.unique?'UNIQUE ':''}INDEX \`${config.name}\``)||s.startsWith(`CREATE ${config.unique?'UNIQUE ':''}INDEX "${config.name}"`));
 if(position<0) throw new Error(`Index missing: ${config.name}`);
 initial[position]=`CREATE ${config.unique?'UNIQUE ':''}INDEX ${q(config.name)} ON ${q(c.name)} (${config.columns.map(col=>is(col,Column)?q(col.name):render(col)).join(', ')})${config.where?` WHERE ${render(config.where)}`:''};`;
}
const creates=initial.filter(s=>s.startsWith('CREATE TABLE'));
const ordered=configs.map(c=>creates.find(s=>s.startsWith(`CREATE TABLE \`${c.name}\``)));
if(ordered.some(s=>!s)||ordered.length!==creates.length) throw new Error('Initial migration table inventory mismatch');
writeFileSync(initialUrl,[...ordered,...initial.filter(s=>!s.startsWith('CREATE TABLE'))].join('\n--> statement-breakpoint\n')+'\n');
const journalUrl=new URL('../drizzle/meta/_journal.json',import.meta.url);
const journal=JSON.parse(readFileSync(journalUrl,'utf8'));
if(!journal.entries.some(e=>e.tag==='0001_integridade_e_auditoria')) journal.entries.push({idx:1,version:'6',when:journal.entries[0].when+1,tag:'0001_integridade_e_auditoria',breakpoints:true});
writeFileSync(journalUrl,JSON.stringify(journal,null,2)+'\n');
mkdirSync(new URL('../drizzle/rollback/',import.meta.url),{recursive:true});
const triggerNames=statements.flatMap(s=>{ const match=s.match(/^CREATE TRIGGER ("[^"]+"|\S+)/); return match?[match[1]]:[]; });
writeFileSync(new URL('../drizzle/rollback/0001_integridade_e_auditoria.sql',import.meta.url),[...triggerNames.map(n=>`DROP TRIGGER ${n};`),'DROP VIEW __integrity_violations;','DROP TABLE __write_context;','DROP TABLE __transaction_end;'].join('\n')+'\n');
writeFileSync(new URL('../drizzle/rollback/0000_estrutura_inicial.sql',import.meta.url),[...configs].reverse().map(c=>`DROP TABLE ${q(c.name)};`).join('\n')+'\n');
console.log(`${configs.length} domain tables; ${statements.length} integrity/audit statements compiled.`);
