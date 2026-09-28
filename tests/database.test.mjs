import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { eq, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { openSqlite, openDatabase } from '../db/local.ts';
import { migrate, rollbackEmpty, migrationFiles } from '../db/migrations.ts';
import { seed } from '../db/seed.ts';
import { toHundredths, fromHundredths } from '../db/fixed-point.ts';
import * as s from '../db/schema.ts';

const system={system:'teste-integridade'};
const fail=(fn,pattern)=>assert.rejects(fn,error=>{let text='';for(let e=error;e;e=e.cause)text+=e.message+'\n';assert.match(text,pattern);return true;});
const add=async(db,table,values)=>(await db.insert(table).values(values).returning())[0];
async function fixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'locacoes-db-test-'));
  const path=join(directory,'test.sqlite');
  const raw=openSqlite(path); migrate(raw); raw.close();
  const database=openDatabase(path);
  t.after(()=>{
    database.close();
    const target=resolve(directory);
    assert.equal(dirname(target),resolve(tmpdir()));
    assert.ok(basename(target).startsWith('locacoes-db-test-'));
    rmSync(target,{recursive:true,force:true});
  });
  return {database,path};
}
async function base(database) {
  return database.transaction(system,async(db,audit)=>{
    const carteira=await add(db,s.carteiras,{codigo:'CAR-T',nome:'Carteira de teste',titular_nome:'Titular de teste',titular_documento:'123'});
    const imovel=await add(db,s.imoveis,{codigo:'IMO-T',carteira_id:carteira.id,nome:'Imóvel de teste',endereco:'Endereço de teste'});
    const unidade=await add(db,s.unidades,{codigo:'UNI-T',imovel_id:imovel.id,nome:'Unidade de teste',area_privativa:'12.50'});
    const locatario=await add(db,s.locatarios,{codigo:'LOC-T',nome:'Locatário de teste',documento:'12.345.678/0001-00'});
    const profissional=await add(db,s.profissionais,{nome:'Profissional de teste'});
    const fornecedor=await add(db,s.fornecedores,{nome:'Fornecedor de teste'});
    const categoria=await add(db,s.categorias_despesa,{codigo:'teste',nome:'Categoria de teste'});
    const contrato=await add(db,s.contratos,{codigo:'CTR-T',imovel_id:imovel.id,locatario_id:locatario.id,inicio:'2026-01-01',termino_previsto:'2027-01-01',aluguel_mensal:'1000.00'});
    await db.insert(s.contrato_unidades).values({contrato_id:contrato.id,unidade_id:unidade.id});
    await db.update(s.contratos).set({estado:'ativo',updated_at:audit.updated_at,updated_by:audit.updated_by}).where(eq(s.contratos.id,contrato.id));
    const obra=await add(db,s.obras,{codigo:'OBR-T',titulo:'Obra de teste',imovel_id:imovel.id,unidade_id:unidade.id,responsavel_profissional_id:profissional.id,descricao:'Descrição de teste',inicio_previsto:'2026-01-01',termino_previsto:'2026-12-31',orcamento:'10000.00'});
    const despesa=await add(db,s.despesas,{codigo:'DES-T',fornecedor_id:fornecedor.id,categoria_id:categoria.id,descricao:'Despesa de teste',valor:'100.00',vencimento:'2026-09-30'});
    const cobranca=await add(db,s.cobrancas,{codigo:'COB-T',contrato_id:contrato.id,competencia:'2026-09-01'});
    const item=await add(db,s.cobranca_itens,{cobranca_id:cobranca.id,ordem:1,nome_emissao:'Aluguel',natureza:'aluguel',vencimento:'2026-09-10',valor:'1000.00'});
    return {carteira,imovel,unidade,locatario,profissional,fornecedor,categoria,contrato,obra,despesa,cobranca,item};
  });
}
async function receive(database,b,valor='20.00',extra={}) {
  return database.transaction(system,async db=>{
    const receipt=await add(db,s.recebimentos,{codigo:randomUUID().slice(0,20),cobranca_id:b.cobranca.id,data_recebimento:'2026-09-14',valor,...extra});
    await db.insert(s.recebimento_alocacoes).values({recebimento_id:receipt.id,cobranca_item_id:b.item.id,valor});
    return receipt;
  });
}
async function partners(database,b) {
  return database.transaction(system,async db=>{
    const a=await add(db,s.socios,{nome:'Sócio teste A'}),c=await add(db,s.socios,{nome:'Sócio teste B'});
    const pa=await add(db,s.obra_socios,{obra_id:b.obra.id,socio_id:a.id,percentual:'60.00'}),pc=await add(db,s.obra_socios,{obra_id:b.obra.id,socio_id:c.id,percentual:'40.00'});
    const aporte=await add(db,s.aportes,{obra_id:b.obra.id,codigo:'APT-T',data_solicitacao:'2026-09-14',descricao:'Aporte de teste',valor_solicitado:'100.00'});
    const ca=await add(db,s.aporte_cotas,{aporte_id:aporte.id,obra_socio_id:pa.id,ordem_rateio:1,nome_socio_pactuado:a.nome,valor_devido:'60.00'});
    const cc=await add(db,s.aporte_cotas,{aporte_id:aporte.id,obra_socio_id:pc.id,ordem_rateio:2,nome_socio_pactuado:c.nome,valor_devido:'40.00'});
    return {pa,pc,aporte,ca,cc};
  });
}
async function agreement(database,b) {
  return database.transaction(system,async db=>{
    const n=await add(db,s.negociacoes,{cobranca_id:b.cobranca.id,versao:1,saldo_base:'1000.00',desconto:'100.00',acrescimo:'50.00',entrada_prevista:'200.00',quantidade_parcelas:3,primeiro_vencimento:'2026-09-30',data_acordo:'2026-09-14'});
    const parcels=[];
    for(const [numero,vencimento,valor] of [[0,'2026-09-14','200.00'],[1,'2026-09-30','250.00'],[2,'2026-10-30','250.00'],[3,'2026-11-30','250.00']]) parcels.push(await add(db,s.negociacao_parcelas,{negociacao_id:n.id,numero,vencimento,valor}));
    return {n,parcels};
  });
}

test('migrations from zero, idempotence, referential integrity and empty rollback',()=>{
  const raw=openSqlite(':memory:');
  try {
    assert.equal(migrate(raw).length,migrationFiles().length);
    assert.deepEqual(migrate(raw),[]);
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(raw.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    rollbackEmpty(raw);
    assert.equal(raw.prepare("SELECT count(*) n FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'").get().n,0);
    assert.equal(migrate(raw).length,migrationFiles().length);
  } finally {raw.close();}
});
test('all modeled tables, columns, PKs, FKs, nullability, checks and indexes match the ORM',()=>{
  const raw=openSqlite(':memory:'); migrate(raw);
  try {
    const model=readFileSync(new URL('../MODELAGEM-BANCO-DE-DADOS-PARA-VALIDACAO.md',import.meta.url),'utf8');
    const entityNames=[...model.matchAll(/^### E\d{2} — ([a-z_]+)/gm)].map(m=>m[1]).filter(n=>n!=='obra_compromissos');
    assert.deepEqual(Object.keys(s.tables).sort(),entityNames.sort());
    for(const [name,table] of Object.entries(s.tables)) {
      const config=getTableConfig(table),columns=raw.prepare(`PRAGMA table_info("${name}")`).all();
      assert.deepEqual(columns.map(c=>c.name).sort(),config.columns.map(c=>c.name).sort(),name);
      for(const col of config.columns) {
        const physical=columns.find(c=>c.name===col.name);
        assert.equal(Boolean(physical.notnull),col.notNull,`${name}.${col.name} nullable`);
        assert.equal(physical.type.toLowerCase(),col.getSQLType().toLowerCase(),`${name}.${col.name} type`);
        assert.equal(physical.dflt_value!=null,col.hasDefault,`${name}.${col.name} default`);
      }
      const expectedPk=config.columns.filter(c=>c.primary).map(c=>c.name).concat(config.primaryKeys.flatMap(k=>k.columns.map(c=>c.name)));
      assert.deepEqual(columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name),expectedPk,`${name} PK`);
      const physicalFks=raw.prepare(`PRAGMA foreign_key_list("${name}")`).all();
      assert.equal(physicalFks.length,config.foreignKeys.length,name);
      for(const fk of config.foreignKeys) {
        const ref=fk.reference(),p=physicalFks.find(p=>p.from===ref.columns[0].name);
        assert.equal(p.table,getTableConfig(ref.foreignTable).name);assert.equal(p.to,ref.foreignColumns[0].name);assert.equal(p.on_delete,'RESTRICT');assert.equal(p.on_update,'RESTRICT');
      }
      const ddl=raw.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").get(name).sql;
      for(const check of config.checks) assert.ok(ddl.includes(`"${check.name}"`),`${name} CHECK ${check.name}`);
      const indexes=raw.prepare(`PRAGMA index_list("${name}")`).all();
      for(const index of config.indexes) assert.ok(indexes.some(i=>i.name===index.config.name&&Boolean(i.unique)===index.config.unique),`${name} INDEX ${index.config.name}`);
      // Verify every modeled field, not just agreement between two implementation files.
      const section=model.slice(model.indexOf(`— ${name}\n`)).split(/^### /m)[0];
      const fields=[...section.matchAll(/^\| ([a-z][a-z0-9_]*) \|/gm)].map(m=>m[1]);
      for(const field of fields) assert.ok(columns.some(c=>c.name===field),`${name}.${field} from model`);
    }
  } finally {raw.close();}
});
test('exact fixed-point mapping rejects floating inputs and excess precision',()=>{
  assert.equal(toHundredths('9999999999999.99'),999999999999999n);
  assert.equal(fromHundredths(999999999999999n),'9999999999999.99');
  assert.equal(fromHundredths(toHundredths('-0.01')),'-0.01');
  for(const value of [0.1, '0.001','1e2','NaN','10000000000000.00']) assert.throws(()=>toHundredths(value));
  assert.throws(()=>fromHundredths(Number.MAX_SAFE_INTEGER+1));
});
test('structural seed is idempotent, creates seven categories and no fake accounts/users/money',async t=>{
  const {database,path}=await fixture(t);
  assert.equal(await seed(path),7);assert.equal(await seed(path),0);
  assert.equal((await database.read.select().from(s.categorias_despesa)).length,7);
  for(const table of [s.usuarios,s.imoveis,s.contas_financeiras,s.recebimentos,s.pagamentos_despesa,s.aportes]) assert.equal((await database.read.select().from(table)).length,0);
  assert.equal((await database.read.select().from(s.auditoria_eventos)).length,7);
});
test('ORM CRUD, inferred relations and exact money round trip',async t=>{
  const {database}=await fixture(t),b=await base(database);
  const result=await database.read.query.carteiras.findFirst({with:{imoveis:{with:{unidades:true}}}});
  assert.equal(result.imoveis[0].unidades[0].area_privativa,'12.50');
  assert.equal((await database.read.select().from(s.despesas))[0].valor,'100.00');
  await database.transaction(system,async(db,a)=>{await db.update(s.fornecedores).set({nome:'Nome alterado',updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.fornecedores.id,b.fornecedor.id));});
  const events=await database.read.select().from(s.auditoria_eventos).where(eq(s.auditoria_eventos.registro_id,b.fornecedor.id));
  assert.equal(events.at(-1).antes.nome,'Fornecedor de teste');assert.equal(events.at(-1).depois.nome,'Nome alterado');
});
test('writes outside transaction rejected by ORM and by SQL triggers',async t=>{
  const {database,path}=await fixture(t);
  await fail(()=>database.read.insert(s.fornecedores).values({nome:'Inválido'}),/Escrita exige/);
  const raw=openSqlite(path);try{assert.throws(()=>raw.exec("INSERT INTO fornecedores(nome) VALUES('Invalido')"),/Escrita exige/);}finally{raw.close();}
});
test('SQL cannot commit an open write context or bypass aggregate validation',async t=>{
  const {path}=await fixture(t),raw=openSqlite(path);
  try {
    raw.exec("BEGIN; INSERT INTO __write_context(id,contexto_ator) VALUES(1,'teste'); INSERT INTO fornecedores(nome) VALUES('Fornecedor teste');");
    assert.throws(()=>raw.exec('COMMIT'),/FOREIGN KEY/);
    raw.exec('ROLLBACK');
    assert.throws(()=>raw.exec('INSERT INTO __transaction_end VALUES(1)'),/Sentinela/);
  } finally{raw.close();}
});
test('required fields, normalized unique codes/email/documents and valid dates',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await fail(()=>database.transaction(system,db=>db.insert(s.fornecedores).values({nome:'   '})),/CHECK/);
  await fail(()=>database.transaction(system,db=>db.insert(s.carteiras).values({codigo:b.carteira.codigo,nome:'Dup',titular_nome:'Teste',titular_documento:'12'})),/UNIQUE/);
  await fail(()=>database.transaction(system,db=>db.insert(s.locatarios).values({codigo:'LOC-D',nome:'Duplicado',documento:'12345678000100'})),/UNIQUE/);
  await database.transaction(system,db=>db.insert(s.usuarios).values({nome:'Teste',email:'Conta@exemplo.test'}));
  await fail(()=>database.transaction(system,db=>db.insert(s.usuarios).values({nome:'Outro',email:' conta@exemplo.test '})),/UNIQUE/);
  await fail(()=>database.transaction(system,db=>db.insert(s.despesas).values({codigo:'INVALID',fornecedor_id:b.fornecedor.id,categoria_id:b.categoria.id,descricao:'Data inválida',valor:'1.00',vencimento:'2026-02-30'})),/CHECK/);
  await fail(()=>database.transaction(system,db=>db.insert(s.imoveis).values({codigo:'INVALID',carteira_id:b.carteira.id,nome:'Falta endereço'})),/NOT NULL/);
});
test('UUID, enums, signed money and quantity scale enforced by SQLite',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await fail(()=>database.transaction(system,db=>db.insert(s.fornecedores).values({id:'not-uuid',nome:'Teste'})),/CHECK/);
  await fail(()=>database.transaction(system,db=>db.insert(s.usuarios).values({nome:'Teste',email:'x@test.test',perfil_codigo:'root'})),/CHECK/);
  await fail(()=>database.transaction(system,db=>db.run(sql`INSERT INTO obra_ajustes_caixa(obra_id,data_movimento,descricao,valor_assinado) VALUES(${b.obra.id},'2026-09-14','Teste',1.25)`)),/CHECK/);
  await fail(()=>database.transaction(system,db=>db.insert(s.obra_ajustes_caixa).values({obra_id:b.obra.id,data_movimento:'2026-09-14',descricao:'Teste',valor_assinado:'0.00'})),/CHECK/);
});
test('foreign keys, RESTRICT and soft deletion preserve dependencies',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await fail(()=>database.transaction(system,db=>db.insert(s.imoveis).values({codigo:'ERR',carteira_id:randomUUID(),nome:'Teste',endereco:'Teste'})),/FOREIGN KEY/);
  await fail(()=>database.transaction(system,db=>db.delete(s.fornecedores).where(eq(s.fornecedores.id,b.fornecedor.id))),/FOREIGN KEY/);
  await database.transaction(system,async(db,a)=>{await db.update(s.fornecedores).set({ativo:false,updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.fornecedores.id,b.fornecedor.id));});
  assert.equal((await database.read.select().from(s.despesas)).length,1);
  await fail(()=>database.transaction(system,db=>db.insert(s.despesas).values({codigo:'BAD',fornecedor_id:b.fornecedor.id,categoria_id:b.categoria.id,descricao:'Teste',valor:'1.00',vencimento:'2026-10-01'})),/cadastro ativo/);
});
test('cross-property unit, empty charges and incomplete work specialization are atomic failures',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await fail(()=>database.transaction(system,async db=>{const other=await add(db,s.imoveis,{codigo:'IMO-2',carteira_id:b.carteira.id,nome:'Outro',endereco:'Outro'});await db.insert(s.obras).values({codigo:'BAD',titulo:'Teste',imovel_id:other.id,unidade_id:b.unidade.id,responsavel_profissional_id:b.profissional.id,descricao:'Teste',inicio_previsto:'2026-01-01',termino_previsto:'2026-12-01'});}),/obra_unidade_imovel/);
  await fail(()=>database.transaction(system,db=>db.insert(s.cobrancas).values({codigo:'COB-2',contrato_id:b.contrato.id,competencia:'2026-10-01'})),/cobranca_sem_item/);
  await fail(()=>database.transaction(system,db=>db.insert(s.despesas).values({fornecedor_id:b.fornecedor.id,origem:'contratacao_obra',descricao:'Teste',valor:'10.00',vencimento:'2026-10-01'})),/despesa_especializacao/);
  assert.equal((await database.read.select().from(s.imoveis)).length,1);
});
test('partial expense payments, full reversal, overpayment and immutable history',async t=>{
  const {database}=await fixture(t),b=await base(database);
  const p=await database.transaction(system,db=>add(db,s.pagamentos_despesa,{despesa_id:b.despesa.id,data_pagamento:'2026-09-14',valor:'60.00'}));
  await fail(()=>database.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-15',valor:'40.01'})),/despesa_sobrepaga/);
  await fail(()=>database.transaction(system,db=>db.update(s.pagamentos_despesa).set({valor:'1.00'}).where(eq(s.pagamentos_despesa.id,p.id))),/imutavel/);
  await fail(()=>database.transaction(system,db=>db.delete(s.pagamentos_despesa).where(eq(s.pagamentos_despesa.id,p.id))),/Exclusao/);
  await fail(()=>database.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-16',valor:'59.99',estorno_de_id:p.id,motivo_estorno:'Teste'})),/estorno/);
  await database.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-16',valor:'60.00',estorno_de_id:p.id,motivo_estorno:'Teste'}));
  await fail(()=>database.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-16',valor:'60.00',estorno_de_id:p.id,motivo_estorno:'Teste'})),/UNIQUE/);
  await database.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-17',valor:'100.00'}));
});
test('receipts must allocate exactly, preserve destinations and reject overpayment',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await fail(()=>database.transaction(system,db=>db.insert(s.recebimentos).values({codigo:'BAD',cobranca_id:b.cobranca.id,data_recebimento:'2026-09-14',valor:'10.00'})),/alocacao_integral/);
  await fail(()=>receive(database,b,'1000.01'),/item_sobrepago/);
  const receipt=await receive(database,b,'1000.00');
  const reverse=await receive(database,b,'1000.00',{estorno_de_id:receipt.id,motivo_estorno:'Teste'});
  assert.ok(reverse.id);
  await fail(()=>database.transaction(system,db=>db.insert(s.recebimento_alocacoes).values({recebimento_id:receipt.id,cobranca_item_id:b.item.id,valor:'1.00'})),/Composicao/);
});
test('negotiation preserves planned down payment, installment schedule and old obligations',async t=>{
  const {database}=await fixture(t),b=await base(database),{n,parcels}=await agreement(database,b);
  assert.equal((await database.read.select().from(s.recebimentos)).length,0);
  assert.equal(parcels.reduce((total,p)=>total+toHundredths(p.valor),0n),95000n);
  await fail(()=>receive(database,b,'1.00'),/obrigacao vigente/);
  await database.transaction(system,async db=>{
    const r=await add(db,s.recebimentos,{codigo:'REC-ENT',cobranca_id:b.cobranca.id,data_recebimento:'2026-09-14',valor:'200.00'});
    await db.insert(s.recebimento_alocacoes).values({recebimento_id:r.id,negociacao_parcela_id:parcels[0].id,valor:'200.00'});
  });
  await fail(()=>database.transaction(system,db=>db.update(s.negociacoes).set({desconto:'200.00'}).where(eq(s.negociacoes.id,n.id))),/imutaveis|Versao fechada/);
});
test('societary rateio, partial funding and immutable participation versions',async t=>{
  const {database}=await fixture(t),b=await base(database),p=await partners(database,b);
  await database.transaction(system,db=>db.insert(s.aporte_pagamentos).values({cota_id:p.ca.id,data_pagamento:'2026-09-14',valor:'20.00'}));
  await fail(()=>database.transaction(system,db=>db.insert(s.aporte_pagamentos).values({cota_id:p.ca.id,data_pagamento:'2026-09-14',valor:'40.01'})),/cota_sobrepaga/);
  await fail(()=>database.transaction(system,db=>db.update(s.obra_socios).set({percentual:'50.00'}).where(eq(s.obra_socios.id,p.pa.id))),/imutaveis|Versao fechada/);
  await fail(()=>database.transaction(system,async db=>{const person=await add(db,s.socios,{nome:'Teste'});await db.insert(s.obra_socios).values({obra_id:b.obra.id,socio_id:person.id,percentual:'1.00'});}),/participacao_total/);
  await fail(()=>database.transaction(system,async db=>{const a=await add(db,s.aportes,{obra_id:b.obra.id,codigo:'ERR',data_solicitacao:'2026-09-14',descricao:'Teste',valor_solicitado:'10.00'});await db.insert(s.aporte_cotas).values({aporte_id:a.id,obra_socio_id:p.pa.id,ordem_rateio:1,nome_socio_pactuado:'Teste',valor_devido:'10.00'});}),/aporte_rateio|percentual pactuado/);
});
test('documents require typed FK target and content before availability',async t=>{
  const {database}=await fixture(t),b=await base(database);
  const document=await database.transaction(system,db=>add(db,s.documentos,{nome_original:'referencia.pdf'}));
  await fail(()=>database.transaction(system,db=>db.insert(s.documentos).values({nome_original:'Inexistente.pdf',estado:'disponivel'})),/CHECK/);
  await fail(()=>database.transaction(system,db=>db.insert(s.documento_vinculos).values({documento_id:document.id})),/CHECK/);
  await database.transaction(system,db=>db.insert(s.documento_vinculos).values({documento_id:document.id,despesa_id:b.despesa.id}));
  await fail(()=>database.transaction(system,db=>db.delete(s.documentos).where(eq(s.documentos.id,document.id))),/Exclusao/);
});
test('audit is append-only, excludes credentials, rolls back with the original write',async t=>{
  const {database}=await fixture(t);
  const user=await database.transaction(system,db=>add(db,s.usuarios,{nome:'Teste',email:'test@example.test',senha_hash:'hash-apenas-para-teste'}));
  const events=await database.read.select().from(s.auditoria_eventos);
  assert.equal('senha_hash' in events[0].depois,false);
  await fail(()=>database.transaction(system,db=>db.delete(s.auditoria_eventos)),/Exclusao/);
  await fail(()=>database.transaction(system,async db=>{await db.insert(s.fornecedores).values({nome:'Será revertido'});throw new Error('reverter');}),/reverter/);
  assert.equal((await database.read.select().from(s.auditoria_eventos)).length,1);
  await fail(()=>database.transaction({actorId:user.id},db=>db.insert(s.fornecedores).values({nome:'Inválido'})),/Ator inativo/);
});
test('rollback refuses seeded or populated database',async t=>{
  const {path}=await fixture(t);await seed(path);
  const raw=openSqlite(path);try{assert.throws(()=>rollbackEmpty(raw),/contem dados/);assert.equal(raw.prepare('SELECT count(*) n FROM categorias_despesa').get().n,7);}finally{raw.close();}
});
test('separate connections preserve the balance after a preceding commit',async t=>{
  const {database,path}=await fixture(t),b=await base(database);
  const second=openDatabase(path);
  try{
    await database.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-14',valor:'70.00'}));
    await fail(()=>second.transaction(system,db=>db.insert(s.pagamentos_despesa).values({despesa_id:b.despesa.id,data_pagamento:'2026-09-14',valor:'40.00'})),/despesa_sobrepaga/);
  }finally{second.close();}
});

test('two simultaneous writers cannot overpay the same expense',async t=>{
  const {database,path}=await fixture(t),b=await base(database);
  const workers=[0,1].map(()=>new Worker(new URL('./helpers/database-payment-worker.mjs',import.meta.url),{workerData:{path,despesaId:b.despesa.id}}));
  try {
    await Promise.all(workers.map(w=>once(w,'message')));
    const pending=workers.map(w=>once(w,'message'));
    workers.forEach(w=>w.postMessage('go'));
    const results=(await Promise.all(pending)).map(r=>r[0]);
    assert.equal(results.filter(r=>r.ok).length,1);
    assert.match(results.find(r=>!r.ok).message,/despesa_sobrepaga/);
    assert.equal((await database.read.select().from(s.pagamentos_despesa)).length,1);
  } finally {await Promise.all(workers.map(w=>w.terminate()));}
});
test('renegotiation uses the actual remaining balance and retains prior versions',async t=>{
  const {database}=await fixture(t),b=await base(database),{n,parcels}=await agreement(database,b);
  const paid=await database.transaction(system,async db=>{
    const r=await add(db,s.recebimentos,{codigo:'REC-N',cobranca_id:b.cobranca.id,data_recebimento:'2026-09-14',valor:'200.00'});
    await db.insert(s.recebimento_alocacoes).values({recebimento_id:r.id,negociacao_parcela_id:parcels[0].id,valor:'200.00'});return r;
  });
  await database.transaction(system,async(db,a)=>{
    await db.update(s.negociacoes).set({substituida_em:a.updated_at}).where(eq(s.negociacoes.id,n.id));
    const next=await add(db,s.negociacoes,{cobranca_id:b.cobranca.id,versao:2,negociacao_anterior_id:n.id,saldo_base:'750.00',quantidade_parcelas:1,primeiro_vencimento:'2026-10-15',data_acordo:'2026-09-15'});
    await db.insert(s.negociacao_parcelas).values({negociacao_id:next.id,numero:1,vencimento:'2026-10-15',valor:'750.00'});
  });
  assert.equal((await database.read.select().from(s.negociacoes)).length,2);
  assert.equal((await database.read.select().from(s.negociacao_parcelas)).length,5);
  await fail(()=>database.transaction(system,db=>db.insert(s.recebimentos).values({codigo:'REV-N',cobranca_id:b.cobranca.id,data_recebimento:'2026-09-16',valor:'200.00',estorno_de_id:paid.id,motivo_estorno:'Teste'})),/base de acordo posterior/);
});
test('cotas cannot silently change the agreed proportions despite a matching total',async t=>{
  const {database}=await fixture(t),b=await base(database),p=await partners(database,b);
  await fail(()=>database.transaction(system,async db=>{
    const a=await add(db,s.aportes,{obra_id:b.obra.id,codigo:'APT-BAD',data_solicitacao:'2026-09-14',descricao:'Teste',valor_solicitado:'100.00'});
    await db.insert(s.aporte_cotas).values([
      {aporte_id:a.id,obra_socio_id:p.pa.id,ordem_rateio:1,nome_socio_pactuado:'Teste A',valor_devido:'0.00'},
      {aporte_id:a.id,obra_socio_id:p.pc.id,ordem_rateio:2,nome_socio_pactuado:'Teste B',valor_devido:'100.00'},
    ]);
  }),/percentual pactuado/);
});
test('human writes use the same actor in common fields and immutable audit',async t=>{
  const {database}=await fixture(t);
  const actor=await database.transaction(system,db=>add(db,s.usuarios,{nome:'Administrador teste',email:'admin@example.test',perfil_codigo:'administrador',status:'ativo',ativo:true}));
  await database.transaction({actorId:actor.id},async(db,a)=>{await db.insert(s.fornecedores).values({nome:'Fornecedor teste',created_by:a.created_by,updated_by:a.updated_by});});
  const event=(await database.read.select().from(s.auditoria_eventos).where(eq(s.auditoria_eventos.entidade,'fornecedores')))[0];
  assert.equal(event.ator_usuario_id,actor.id);assert.equal(event.contexto_ator,null);
  await fail(()=>database.transaction({actorId:actor.id},db=>db.insert(s.fornecedores).values({nome:'Autoria omitida'})),/Autoria/);
});
test('closed contracts and completed works do not reopen implicitly',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await database.transaction(system,async(db,a)=>{await db.update(s.contratos).set({estado:'encerrado',encerrado_em:'2026-09-14',updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.contratos.id,b.contrato.id));});
  await fail(()=>database.transaction(system,(db,a)=>db.update(s.contratos).set({estado:'ativo',encerrado_em:null,updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.contratos.id,b.contrato.id))),/Transicao/);
  await database.transaction(system,async(db,a)=>{await db.update(s.obras).set({estado:'em_andamento',updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.obras.id,b.obra.id));await db.update(s.obras).set({estado:'concluida',progresso_percentual:'100.00',updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.obras.id,b.obra.id));});
  await fail(()=>database.transaction(system,(db,a)=>db.update(s.obras).set({estado:'em_andamento',updated_at:a.updated_at,updated_by:a.updated_by}).where(eq(s.obras.id,b.obra.id))),/Transicao/);
  assert.equal((await database.read.select().from(s.cobrancas)).length,1);
});
test('nullable required pairs, UUID composition and wrong receipt target are rejected',async t=>{
  const {database}=await fixture(t),b=await base(database);
  await fail(()=>database.transaction(system,db=>db.insert(s.obra_pendencias).values({obra_id:b.obra.id,codigo:'PEN-BAD',titulo:'Teste',descricao:'Teste',resolvida_em:'2026-09-14T00:00:00.000Z'})),/CHECK/);
  const other=await database.transaction(system,async db=>{const c=await add(db,s.cobrancas,{codigo:'COB-OUTRA',contrato_id:b.contrato.id,competencia:'2026-10-01'});return add(db,s.cobranca_itens,{cobranca_id:c.id,ordem:1,nome_emissao:'Teste',natureza:'encargo',valor:'20.00',vencimento:'2026-10-10'});});
  await fail(()=>database.transaction(system,async db=>{const r=await add(db,s.recebimentos,{codigo:'REC-BAD',cobranca_id:b.cobranca.id,data_recebimento:'2026-09-14',valor:'20.00'});await db.insert(s.recebimento_alocacoes).values({recebimento_id:r.id,cobranca_item_id:other.id,valor:'20.00'});}),/alocacao_mesma_cobranca/);
});
