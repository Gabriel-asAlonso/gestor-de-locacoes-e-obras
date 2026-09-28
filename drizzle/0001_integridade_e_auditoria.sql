CREATE TABLE __transaction_end (id INTEGER PRIMARY KEY CHECK(id=1));
--> statement-breakpoint
CREATE TRIGGER __transaction_end_never_insert BEFORE INSERT ON __transaction_end BEGIN SELECT RAISE(ABORT, 'Sentinela transacional deve permanecer vazia'); END;
--> statement-breakpoint
CREATE TABLE __write_context (
 id INTEGER PRIMARY KEY CHECK(id=1), ator_usuario_id TEXT REFERENCES usuarios(id) ON DELETE RESTRICT,
 contexto_ator TEXT, motivo TEXT, iniciado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 novos_registros TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(novos_registros) AND json_type(novos_registros)='array'),
 encerramento_obrigatorio INTEGER NOT NULL DEFAULT 1 CHECK(encerramento_obrigatorio=1)
 REFERENCES __transaction_end(id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(ator_usuario_id IS NOT NULL OR (contexto_ator IS NOT NULL AND length(trim(contexto_ator)) BETWEEN 1 AND 100))
);
--> statement-breakpoint
CREATE TRIGGER __context_actor BEFORE INSERT ON __write_context WHEN NEW.ator_usuario_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM usuarios WHERE id=NEW.ator_usuario_id AND ativo=1 AND perfil_codigo='administrador') BEGIN SELECT RAISE(ABORT, 'Ator inativo ou sem perfil suportado'); END;
--> statement-breakpoint
CREATE TRIGGER __context_identity BEFORE UPDATE ON __write_context WHEN NEW.id!=OLD.id OR NEW.ator_usuario_id IS NOT OLD.ator_usuario_id OR NEW.contexto_ator IS NOT OLD.contexto_ator OR NEW.motivo IS NOT OLD.motivo OR NEW.iniciado_em IS NOT OLD.iniciado_em OR NEW.encerramento_obrigatorio IS NOT OLD.encerramento_obrigatorio BEGIN SELECT RAISE(ABORT, 'Contexto de autoria imutavel na transacao'); END;
--> statement-breakpoint
CREATE VIEW __integrity_violations AS SELECT 'contrato_unidade_imovel' AS regra WHERE EXISTS(SELECT 1 FROM contrato_unidades x JOIN contratos c ON c.id=x.contrato_id JOIN unidades u ON u.id=x.unidade_id WHERE c.imovel_id!=u.imovel_id)
UNION ALL
SELECT 'contrato_ativo_sem_unidade' AS regra WHERE EXISTS(SELECT 1 FROM contratos c WHERE estado='ativo' AND NOT EXISTS(SELECT 1 FROM contrato_unidades x WHERE x.contrato_id=c.id))
UNION ALL
SELECT 'obra_unidade_imovel' AS regra WHERE EXISTS(SELECT 1 FROM obras o JOIN unidades u ON u.id=o.unidade_id WHERE o.imovel_id!=u.imovel_id)
UNION ALL
SELECT 'encargo_contrato' AS regra WHERE EXISTS(SELECT 1 FROM cobranca_itens i JOIN cobrancas c ON c.id=i.cobranca_id JOIN contrato_encargos e ON e.id=i.contrato_encargo_id WHERE c.contrato_id!=e.contrato_id)
UNION ALL
SELECT 'cobranca_sem_item' AS regra WHERE EXISTS(SELECT 1 FROM cobrancas c WHERE NOT EXISTS(SELECT 1 FROM cobranca_itens i WHERE i.cobranca_id=c.id))
UNION ALL
SELECT 'alocacao_integral' AS regra WHERE EXISTS(SELECT 1 FROM recebimentos r WHERE r.valor!=COALESCE((SELECT SUM(a.valor) FROM recebimento_alocacoes a WHERE a.recebimento_id=r.id),0))
UNION ALL
SELECT 'alocacao_mesma_cobranca' AS regra WHERE EXISTS(SELECT 1 FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id LEFT JOIN cobranca_itens i ON i.id=a.cobranca_item_id LEFT JOIN negociacao_parcelas p ON p.id=a.negociacao_parcela_id LEFT JOIN negociacoes n ON n.id=p.negociacao_id WHERE COALESCE(i.cobranca_id,n.cobranca_id)!=r.cobranca_id)
UNION ALL
SELECT 'item_sobrepago' AS regra WHERE EXISTS(SELECT 1 FROM cobranca_itens i WHERE COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id WHERE a.cobranca_item_id=i.id),0) NOT BETWEEN 0 AND i.valor)
UNION ALL
SELECT 'parcela_sobrepaga' AS regra WHERE EXISTS(SELECT 1 FROM negociacao_parcelas p WHERE COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id WHERE a.negociacao_parcela_id=p.id),0) NOT BETWEEN 0 AND p.valor)
UNION ALL
SELECT 'despesa_sobrepaga' AS regra WHERE EXISTS(SELECT 1 FROM despesas d WHERE COALESCE((SELECT SUM(CASE WHEN estorno_de_id IS NULL THEN valor ELSE -valor END) FROM pagamentos_despesa p WHERE p.despesa_id=d.id),0) NOT BETWEEN 0 AND d.valor)
UNION ALL
SELECT 'cota_sobrepaga' AS regra WHERE EXISTS(SELECT 1 FROM aporte_cotas c WHERE COALESCE((SELECT SUM(CASE WHEN estorno_de_id IS NULL THEN valor ELSE -valor END) FROM aporte_pagamentos p WHERE p.cota_id=c.id),0) NOT BETWEEN 0 AND c.valor_devido)
UNION ALL
SELECT 'despesa_especializacao' AS regra WHERE EXISTS(SELECT 1 FROM despesas d WHERE (d.origem='contratacao_obra') != EXISTS(SELECT 1 FROM obra_contratacoes c WHERE c.despesa_id=d.id))
UNION ALL
SELECT 'equipe_atividade_obra' AS regra WHERE EXISTS(SELECT 1 FROM obra_equipe_atividades x JOIN obra_alocacoes_equipe e ON e.id=x.alocacao_id JOIN obra_atividades a ON a.id=x.atividade_id WHERE e.obra_id!=a.obra_id)
UNION ALL
SELECT 'participacao_sobreposta' AS regra WHERE EXISTS(SELECT 1 FROM obra_socios a JOIN obra_socios b ON a.obra_id=b.obra_id AND a.socio_id=b.socio_id AND a.id<b.id WHERE a.inicio_vigencia<COALESCE(b.fim_vigencia,'9999') AND b.inicio_vigencia<COALESCE(a.fim_vigencia,'9999'))
UNION ALL
SELECT 'participacao_total' AS regra WHERE EXISTS(SELECT obra_id FROM obra_socios WHERE fim_vigencia IS NULL GROUP BY obra_id HAVING SUM(percentual)>10000)
UNION ALL
SELECT 'cota_mesma_obra' AS regra WHERE EXISTS(SELECT 1 FROM aporte_cotas c JOIN aportes a ON a.id=c.aporte_id JOIN obra_socios s ON s.id=c.obra_socio_id WHERE a.obra_id!=s.obra_id)
UNION ALL
SELECT 'cota_socio_repetido' AS regra WHERE EXISTS(SELECT c.aporte_id,s.socio_id FROM aporte_cotas c JOIN obra_socios s ON s.id=c.obra_socio_id GROUP BY c.aporte_id,s.socio_id HAVING COUNT(*)>1)
UNION ALL
SELECT 'aporte_rateio' AS regra WHERE EXISTS(SELECT 1 FROM aportes a WHERE a.valor_solicitado!=COALESCE((SELECT SUM(valor_devido) FROM aporte_cotas c WHERE c.aporte_id=a.id),0) OR 10000!=COALESCE((SELECT SUM(s.percentual) FROM aporte_cotas c JOIN obra_socios s ON s.id=c.obra_socio_id WHERE c.aporte_id=a.id),0))
UNION ALL
SELECT 'pagamento_aporte_codigo' AS regra WHERE EXISTS(SELECT a.obra_id,p.codigo FROM aporte_pagamentos p JOIN aporte_cotas c ON c.id=p.cota_id JOIN aportes a ON a.id=c.aporte_id WHERE p.codigo IS NOT NULL GROUP BY a.obra_id,p.codigo HAVING COUNT(*)>1)
UNION ALL
SELECT 'negociacao_cadeia' AS regra WHERE EXISTS(SELECT 1 FROM negociacoes n LEFT JOIN negociacoes p ON p.id=n.negociacao_anterior_id WHERE (n.negociacao_anterior_id IS NULL AND n.versao!=1) OR (n.negociacao_anterior_id IS NOT NULL AND (p.cobranca_id!=n.cobranca_id OR p.versao+1!=n.versao OR p.substituida_em IS NULL)) OR (n.substituida_em IS NOT NULL AND NOT EXISTS(SELECT 1 FROM negociacoes s WHERE s.negociacao_anterior_id=n.id)))
UNION ALL
SELECT 'negociacao_parcelas' AS regra WHERE EXISTS(SELECT 1 FROM negociacoes n WHERE n.quantidade_parcelas!=(SELECT COUNT(*) FROM negociacao_parcelas p WHERE p.negociacao_id=n.id AND numero>0) OR n.quantidade_parcelas!=COALESCE((SELECT MAX(numero) FROM negociacao_parcelas p WHERE p.negociacao_id=n.id),0) OR n.saldo_base-n.desconto+n.acrescimo!=COALESCE((SELECT SUM(valor) FROM negociacao_parcelas p WHERE p.negociacao_id=n.id),0) OR n.entrada_prevista!=COALESCE((SELECT valor FROM negociacao_parcelas p WHERE p.negociacao_id=n.id AND numero=0),0))
UNION ALL
SELECT 'parcelas_calendario' AS regra WHERE EXISTS(SELECT 1 FROM negociacao_parcelas p JOIN negociacoes n ON n.id=p.negociacao_id WHERE p.numero>0 AND p.vencimento!=date(n.primeiro_vencimento,'start of month',printf('+%d months',p.numero-1),printf('+%d days',MIN(CAST(strftime('%d',n.primeiro_vencimento) AS INTEGER),CAST(strftime('%d',date(n.primeiro_vencimento,'start of month',printf('+%d months',p.numero),'-1 day')) AS INTEGER))-1)))
UNION ALL
SELECT 'documento_ciclo' AS regra WHERE EXISTS(WITH RECURSIVE cadeia(raiz,id,caminho,ciclo) AS (SELECT id,versao_anterior_id,','||id||',',0 FROM documentos WHERE versao_anterior_id IS NOT NULL UNION ALL SELECT c.raiz,d.versao_anterior_id,c.caminho||d.id||',',instr(c.caminho,','||d.id||',')>0 FROM cadeia c JOIN documentos d ON d.id=c.id WHERE c.ciclo=0) SELECT 1 FROM cadeia WHERE ciclo=1)
UNION ALL
SELECT 'diario_automatico_autor' AS regra WHERE EXISTS(SELECT 1 FROM obra_diario d LEFT JOIN auditoria_eventos a ON a.id=d.auditoria_evento_id WHERE d.autor_usuario_id IS NULL AND d.autor_legado_nome IS NULL AND (a.id IS NULL OR a.ator_usuario_id IS NOT NULL OR a.contexto_ator IS NULL))
UNION ALL
SELECT 'recebimentos_estorno' AS regra WHERE EXISTS(SELECT 1 FROM recebimentos r JOIN recebimentos o ON o.id=r.estorno_de_id WHERE o.estorno_de_id IS NOT NULL OR r.cobranca_id!=o.cobranca_id OR r.valor!=o.valor)
UNION ALL
SELECT 'pagamentos_despesa_estorno' AS regra WHERE EXISTS(SELECT 1 FROM pagamentos_despesa r JOIN pagamentos_despesa o ON o.id=r.estorno_de_id WHERE o.estorno_de_id IS NOT NULL OR r.despesa_id!=o.despesa_id OR r.valor!=o.valor)
UNION ALL
SELECT 'aporte_pagamentos_estorno' AS regra WHERE EXISTS(SELECT 1 FROM aporte_pagamentos r JOIN aporte_pagamentos o ON o.id=r.estorno_de_id WHERE o.estorno_de_id IS NOT NULL OR r.cota_id!=o.cota_id OR r.valor!=o.valor)
UNION ALL
SELECT 'obra_ajustes_caixa_estorno' AS regra WHERE EXISTS(SELECT 1 FROM obra_ajustes_caixa r JOIN obra_ajustes_caixa o ON o.id=r.estorno_de_id WHERE o.estorno_de_id IS NOT NULL OR r.obra_id!=o.obra_id OR r.valor_assinado!=-o.valor_assinado)
UNION ALL
SELECT 'estorno_alocacoes' AS regra WHERE EXISTS(SELECT 1 FROM recebimentos r JOIN recebimento_alocacoes a ON a.recebimento_id=r.id WHERE r.estorno_de_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM recebimento_alocacoes o WHERE o.recebimento_id=r.estorno_de_id AND o.cobranca_item_id IS a.cobranca_item_id AND o.negociacao_parcela_id IS a.negociacao_parcela_id AND o.valor=a.valor));
--> statement-breakpoint
CREATE TRIGGER __validate_transaction BEFORE DELETE ON __write_context WHEN EXISTS(SELECT 1 FROM __integrity_violations) BEGIN SELECT RAISE(ABORT, 'Integridade transacional: ' || (SELECT regra FROM __integrity_violations LIMIT 1)); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_context_insert" BEFORE INSERT ON "usuarios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_author_insert" BEFORE INSERT ON "usuarios" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_audit_insert" AFTER INSERT ON "usuarios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'usuarios',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'nome',NEW."nome",'email',NEW."email",'perfil_codigo',NEW."perfil_codigo",'ativo',NEW."ativo") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','usuarios','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_context_update" BEFORE UPDATE ON "usuarios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_identity" BEFORE UPDATE ON "usuarios" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_author_update" BEFORE UPDATE ON "usuarios" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_updated_at" BEFORE UPDATE ON "usuarios" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_audit_update" AFTER UPDATE ON "usuarios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'usuarios',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'nome',OLD."nome",'email',OLD."email",'perfil_codigo',OLD."perfil_codigo",'ativo',OLD."ativo"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'nome',NEW."nome",'email',NEW."email",'perfil_codigo',NEW."perfil_codigo",'ativo',NEW."ativo") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_context_delete" BEFORE DELETE ON "usuarios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "usuarios_audit_delete" AFTER DELETE ON "usuarios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'usuarios',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'nome',OLD."nome",'email',OLD."email",'perfil_codigo',OLD."perfil_codigo",'ativo',OLD."ativo"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "auditoria_eventos_context_insert" BEFORE INSERT ON "auditoria_eventos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "auditoria_eventos_context_update" BEFORE UPDATE ON "auditoria_eventos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "auditoria_eventos_immutable" BEFORE UPDATE ON "auditoria_eventos" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "auditoria_eventos_context_delete" BEFORE DELETE ON "auditoria_eventos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "auditoria_eventos_preserve" BEFORE DELETE ON "auditoria_eventos" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_context_insert" BEFORE INSERT ON "documentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_author_insert" BEFORE INSERT ON "documentos" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_audit_insert" AFTER INSERT ON "documentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'documentos',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'nome_original',NEW."nome_original",'estado',NEW."estado",'mime_type',NEW."mime_type",'tamanho_bytes',NEW."tamanho_bytes",'chave_armazenamento',NEW."chave_armazenamento",'hash_sha256',NEW."hash_sha256",'versao_anterior_id',NEW."versao_anterior_id",'retirado_em',NEW."retirado_em",'retirado_por',NEW."retirado_por") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','documentos','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "documentos_context_update" BEFORE UPDATE ON "documentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_identity" BEFORE UPDATE ON "documentos" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_audit_update" AFTER UPDATE ON "documentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'documentos',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'nome_original',OLD."nome_original",'estado',OLD."estado",'mime_type',OLD."mime_type",'tamanho_bytes',OLD."tamanho_bytes",'chave_armazenamento',OLD."chave_armazenamento",'hash_sha256',OLD."hash_sha256",'versao_anterior_id',OLD."versao_anterior_id",'retirado_em',OLD."retirado_em",'retirado_por',OLD."retirado_por"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'nome_original',NEW."nome_original",'estado',NEW."estado",'mime_type',NEW."mime_type",'tamanho_bytes',NEW."tamanho_bytes",'chave_armazenamento',NEW."chave_armazenamento",'hash_sha256',NEW."hash_sha256",'versao_anterior_id',NEW."versao_anterior_id",'retirado_em',NEW."retirado_em",'retirado_por',NEW."retirado_por") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "documentos_context_delete" BEFORE DELETE ON "documentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_preserve" BEFORE DELETE ON "documentos" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_audit_delete" AFTER DELETE ON "documentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'documentos',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'nome_original',OLD."nome_original",'estado',OLD."estado",'mime_type',OLD."mime_type",'tamanho_bytes',OLD."tamanho_bytes",'chave_armazenamento',OLD."chave_armazenamento",'hash_sha256',OLD."hash_sha256",'versao_anterior_id',OLD."versao_anterior_id",'retirado_em',OLD."retirado_em",'retirado_por',OLD."retirado_por"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "documentos_retirado_por_active_insert" BEFORE INSERT ON "documentos" WHEN NEW."retirado_por" IS NOT NULL AND EXISTS(SELECT 1 FROM "usuarios" WHERE id=NEW."retirado_por" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "documentos_retirado_por_active_update" BEFORE UPDATE ON "documentos" WHEN NEW."retirado_por" IS NOT OLD."retirado_por" AND NEW."retirado_por" IS NOT NULL AND EXISTS(SELECT 1 FROM "usuarios" WHERE id=NEW."retirado_por" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_context_insert" BEFORE INSERT ON "carteiras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_author_insert" BEFORE INSERT ON "carteiras" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_audit_insert" AFTER INSERT ON "carteiras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'carteiras',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'nome',NEW."nome",'titular_nome',NEW."titular_nome",'titular_documento',NEW."titular_documento",'gestor_descricao',NEW."gestor_descricao",'descricao',NEW."descricao",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','carteiras','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_context_update" BEFORE UPDATE ON "carteiras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_identity" BEFORE UPDATE ON "carteiras" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_author_update" BEFORE UPDATE ON "carteiras" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_updated_at" BEFORE UPDATE ON "carteiras" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_audit_update" AFTER UPDATE ON "carteiras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'carteiras',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'nome',OLD."nome",'titular_nome',OLD."titular_nome",'titular_documento',OLD."titular_documento",'gestor_descricao',OLD."gestor_descricao",'descricao',OLD."descricao",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'nome',NEW."nome",'titular_nome',NEW."titular_nome",'titular_documento',NEW."titular_documento",'gestor_descricao',NEW."gestor_descricao",'descricao',NEW."descricao",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_context_delete" BEFORE DELETE ON "carteiras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "carteiras_audit_delete" AFTER DELETE ON "carteiras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'carteiras',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'nome',OLD."nome",'titular_nome',OLD."titular_nome",'titular_documento',OLD."titular_documento",'gestor_descricao',OLD."gestor_descricao",'descricao',OLD."descricao",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_context_insert" BEFORE INSERT ON "imobiliarias" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_author_insert" BEFORE INSERT ON "imobiliarias" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_audit_insert" AFTER INSERT ON "imobiliarias" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'imobiliarias',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'razao_social',NEW."razao_social",'nome_fantasia',NEW."nome_fantasia",'documento',NEW."documento",'creci',NEW."creci",'contato_nome',NEW."contato_nome",'telefone',NEW."telefone",'email',NEW."email") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','imobiliarias','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_context_update" BEFORE UPDATE ON "imobiliarias" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_identity" BEFORE UPDATE ON "imobiliarias" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_author_update" BEFORE UPDATE ON "imobiliarias" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_updated_at" BEFORE UPDATE ON "imobiliarias" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_audit_update" AFTER UPDATE ON "imobiliarias" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'imobiliarias',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'razao_social',OLD."razao_social",'nome_fantasia',OLD."nome_fantasia",'documento',OLD."documento",'creci',OLD."creci",'contato_nome',OLD."contato_nome",'telefone',OLD."telefone",'email',OLD."email"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'razao_social',NEW."razao_social",'nome_fantasia',NEW."nome_fantasia",'documento',NEW."documento",'creci',NEW."creci",'contato_nome',NEW."contato_nome",'telefone',NEW."telefone",'email',NEW."email") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_context_delete" BEFORE DELETE ON "imobiliarias" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "imobiliarias_audit_delete" AFTER DELETE ON "imobiliarias" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'imobiliarias',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'razao_social',OLD."razao_social",'nome_fantasia',OLD."nome_fantasia",'documento',OLD."documento",'creci',OLD."creci",'contato_nome',OLD."contato_nome",'telefone',OLD."telefone",'email',OLD."email"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_context_insert" BEFORE INSERT ON "fornecedores" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_author_insert" BEFORE INSERT ON "fornecedores" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_audit_insert" AFTER INSERT ON "fornecedores" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'fornecedores',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','fornecedores','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_context_update" BEFORE UPDATE ON "fornecedores" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_identity" BEFORE UPDATE ON "fornecedores" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_author_update" BEFORE UPDATE ON "fornecedores" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_updated_at" BEFORE UPDATE ON "fornecedores" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_audit_update" AFTER UPDATE ON "fornecedores" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'fornecedores',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_context_delete" BEFORE DELETE ON "fornecedores" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "fornecedores_audit_delete" AFTER DELETE ON "fornecedores" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'fornecedores',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_context_insert" BEFORE INSERT ON "profissionais" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_author_insert" BEFORE INSERT ON "profissionais" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_audit_insert" AFTER INSERT ON "profissionais" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'profissionais',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','profissionais','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_context_update" BEFORE UPDATE ON "profissionais" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_identity" BEFORE UPDATE ON "profissionais" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_author_update" BEFORE UPDATE ON "profissionais" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_updated_at" BEFORE UPDATE ON "profissionais" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_audit_update" AFTER UPDATE ON "profissionais" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'profissionais',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_context_delete" BEFORE DELETE ON "profissionais" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "profissionais_audit_delete" AFTER DELETE ON "profissionais" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'profissionais',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "socios_context_insert" BEFORE INSERT ON "socios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_author_insert" BEFORE INSERT ON "socios" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_audit_insert" AFTER INSERT ON "socios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'socios',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','socios','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "socios_context_update" BEFORE UPDATE ON "socios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_identity" BEFORE UPDATE ON "socios" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_author_update" BEFORE UPDATE ON "socios" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_updated_at" BEFORE UPDATE ON "socios" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_audit_update" AFTER UPDATE ON "socios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'socios',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "socios_context_delete" BEFORE DELETE ON "socios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "socios_audit_delete" AFTER DELETE ON "socios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'socios',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_context_insert" BEFORE INSERT ON "categorias_despesa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_author_insert" BEFORE INSERT ON "categorias_despesa" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_audit_insert" AFTER INSERT ON "categorias_despesa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'categorias_despesa',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','categorias_despesa','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_context_update" BEFORE UPDATE ON "categorias_despesa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_identity" BEFORE UPDATE ON "categorias_despesa" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_author_update" BEFORE UPDATE ON "categorias_despesa" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_updated_at" BEFORE UPDATE ON "categorias_despesa" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_audit_update" AFTER UPDATE ON "categorias_despesa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'categorias_despesa',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'nome',OLD."nome"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_context_delete" BEFORE DELETE ON "categorias_despesa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "categorias_despesa_audit_delete" AFTER DELETE ON "categorias_despesa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'categorias_despesa',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'nome',OLD."nome"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_context_insert" BEFORE INSERT ON "contas_financeiras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_author_insert" BEFORE INSERT ON "contas_financeiras" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_audit_insert" AFTER INSERT ON "contas_financeiras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contas_financeiras',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','contas_financeiras','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_context_update" BEFORE UPDATE ON "contas_financeiras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_identity" BEFORE UPDATE ON "contas_financeiras" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_author_update" BEFORE UPDATE ON "contas_financeiras" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_updated_at" BEFORE UPDATE ON "contas_financeiras" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_audit_update" AFTER UPDATE ON "contas_financeiras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contas_financeiras',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'nome',NEW."nome") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_context_delete" BEFORE DELETE ON "contas_financeiras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contas_financeiras_audit_delete" AFTER DELETE ON "contas_financeiras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contas_financeiras',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'nome',OLD."nome"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_context_insert" BEFORE INSERT ON "imoveis" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_author_insert" BEFORE INSERT ON "imoveis" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_audit_insert" AFTER INSERT ON "imoveis" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'imoveis',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'carteira_id',NEW."carteira_id",'nome',NEW."nome",'endereco',NEW."endereco",'tipo',NEW."tipo",'cep',NEW."cep",'cidade',NEW."cidade",'uf',NEW."uf",'imagem_capa_caminho',NEW."imagem_capa_caminho",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','imoveis','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_context_update" BEFORE UPDATE ON "imoveis" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_identity" BEFORE UPDATE ON "imoveis" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_author_update" BEFORE UPDATE ON "imoveis" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_updated_at" BEFORE UPDATE ON "imoveis" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_audit_update" AFTER UPDATE ON "imoveis" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'imoveis',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'carteira_id',OLD."carteira_id",'nome',OLD."nome",'endereco',OLD."endereco",'tipo',OLD."tipo",'cep',OLD."cep",'cidade',OLD."cidade",'uf',OLD."uf",'imagem_capa_caminho',OLD."imagem_capa_caminho",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'carteira_id',NEW."carteira_id",'nome',NEW."nome",'endereco',NEW."endereco",'tipo',NEW."tipo",'cep',NEW."cep",'cidade',NEW."cidade",'uf',NEW."uf",'imagem_capa_caminho',NEW."imagem_capa_caminho",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_context_delete" BEFORE DELETE ON "imoveis" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_audit_delete" AFTER DELETE ON "imoveis" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'imoveis',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'carteira_id',OLD."carteira_id",'nome',OLD."nome",'endereco',OLD."endereco",'tipo',OLD."tipo",'cep',OLD."cep",'cidade',OLD."cidade",'uf',OLD."uf",'imagem_capa_caminho',OLD."imagem_capa_caminho",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_carteira_id_active_insert" BEFORE INSERT ON "imoveis" WHEN NEW."carteira_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "carteiras" WHERE id=NEW."carteira_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "imoveis_carteira_id_active_update" BEFORE UPDATE ON "imoveis" WHEN NEW."carteira_id" IS NOT OLD."carteira_id" AND NEW."carteira_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "carteiras" WHERE id=NEW."carteira_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_context_insert" BEFORE INSERT ON "locatarios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_author_insert" BEFORE INSERT ON "locatarios" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_audit_insert" AFTER INSERT ON "locatarios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'locatarios',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'tipo_pessoa',NEW."tipo_pessoa",'nome',NEW."nome",'documento',NEW."documento",'nome_fantasia',NEW."nome_fantasia",'contato_nome',NEW."contato_nome",'telefone',NEW."telefone",'email',NEW."email",'imobiliaria_id',NEW."imobiliaria_id",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','locatarios','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_context_update" BEFORE UPDATE ON "locatarios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_identity" BEFORE UPDATE ON "locatarios" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_author_update" BEFORE UPDATE ON "locatarios" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_updated_at" BEFORE UPDATE ON "locatarios" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_audit_update" AFTER UPDATE ON "locatarios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'locatarios',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'tipo_pessoa',OLD."tipo_pessoa",'nome',OLD."nome",'documento',OLD."documento",'nome_fantasia',OLD."nome_fantasia",'contato_nome',OLD."contato_nome",'telefone',OLD."telefone",'email',OLD."email",'imobiliaria_id',OLD."imobiliaria_id",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'tipo_pessoa',NEW."tipo_pessoa",'nome',NEW."nome",'documento',NEW."documento",'nome_fantasia',NEW."nome_fantasia",'contato_nome',NEW."contato_nome",'telefone',NEW."telefone",'email',NEW."email",'imobiliaria_id',NEW."imobiliaria_id",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_context_delete" BEFORE DELETE ON "locatarios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_audit_delete" AFTER DELETE ON "locatarios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'locatarios',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'tipo_pessoa',OLD."tipo_pessoa",'nome',OLD."nome",'documento',OLD."documento",'nome_fantasia',OLD."nome_fantasia",'contato_nome',OLD."contato_nome",'telefone',OLD."telefone",'email',OLD."email",'imobiliaria_id',OLD."imobiliaria_id",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_imobiliaria_id_active_insert" BEFORE INSERT ON "locatarios" WHEN NEW."imobiliaria_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imobiliarias" WHERE id=NEW."imobiliaria_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "locatarios_imobiliaria_id_active_update" BEFORE UPDATE ON "locatarios" WHEN NEW."imobiliaria_id" IS NOT OLD."imobiliaria_id" AND NEW."imobiliaria_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imobiliarias" WHERE id=NEW."imobiliaria_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_context_insert" BEFORE INSERT ON "unidades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_author_insert" BEFORE INSERT ON "unidades" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_audit_insert" AFTER INSERT ON "unidades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'unidades',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'imovel_id',NEW."imovel_id",'nome',NEW."nome",'tipo',NEW."tipo",'area_privativa',NEW."area_privativa",'ocupada_informada',NEW."ocupada_informada",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','unidades','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "unidades_context_update" BEFORE UPDATE ON "unidades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_identity" BEFORE UPDATE ON "unidades" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_author_update" BEFORE UPDATE ON "unidades" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_updated_at" BEFORE UPDATE ON "unidades" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_audit_update" AFTER UPDATE ON "unidades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'unidades',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'imovel_id',OLD."imovel_id",'nome',OLD."nome",'tipo',OLD."tipo",'area_privativa',OLD."area_privativa",'ocupada_informada',OLD."ocupada_informada",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'ativo',NEW."ativo",'codigo',NEW."codigo",'imovel_id',NEW."imovel_id",'nome',NEW."nome",'tipo',NEW."tipo",'area_privativa',NEW."area_privativa",'ocupada_informada',NEW."ocupada_informada",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "unidades_context_delete" BEFORE DELETE ON "unidades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_audit_delete" AFTER DELETE ON "unidades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'unidades',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'ativo',OLD."ativo",'codigo',OLD."codigo",'imovel_id',OLD."imovel_id",'nome',OLD."nome",'tipo',OLD."tipo",'area_privativa',OLD."area_privativa",'ocupada_informada',OLD."ocupada_informada",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "unidades_imovel_id_active_insert" BEFORE INSERT ON "unidades" WHEN NEW."imovel_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imoveis" WHERE id=NEW."imovel_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "unidades_imovel_id_active_update" BEFORE UPDATE ON "unidades" WHEN NEW."imovel_id" IS NOT OLD."imovel_id" AND NEW."imovel_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imoveis" WHERE id=NEW."imovel_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_context_insert" BEFORE INSERT ON "contratos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_author_insert" BEFORE INSERT ON "contratos" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_audit_insert" AFTER INSERT ON "contratos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contratos',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'codigo',NEW."codigo",'imovel_id',NEW."imovel_id",'locatario_id',NEW."locatario_id",'inicio',NEW."inicio",'termino_previsto',NEW."termino_previsto",'aluguel_mensal',NEW."aluguel_mensal",'dia_vencimento',NEW."dia_vencimento",'indice_reajuste',NEW."indice_reajuste",'mes_reajuste',NEW."mes_reajuste",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'observacoes',NEW."observacoes",'estado',NEW."estado",'encerrado_em',NEW."encerrado_em") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','contratos','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "contratos_context_update" BEFORE UPDATE ON "contratos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_identity" BEFORE UPDATE ON "contratos" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_author_update" BEFORE UPDATE ON "contratos" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_updated_at" BEFORE UPDATE ON "contratos" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_audit_update" AFTER UPDATE ON "contratos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contratos',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'codigo',OLD."codigo",'imovel_id',OLD."imovel_id",'locatario_id',OLD."locatario_id",'inicio',OLD."inicio",'termino_previsto',OLD."termino_previsto",'aluguel_mensal',OLD."aluguel_mensal",'dia_vencimento',OLD."dia_vencimento",'indice_reajuste',OLD."indice_reajuste",'mes_reajuste',OLD."mes_reajuste",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'observacoes',OLD."observacoes",'estado',OLD."estado",'encerrado_em',OLD."encerrado_em"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'codigo',NEW."codigo",'imovel_id',NEW."imovel_id",'locatario_id',NEW."locatario_id",'inicio',NEW."inicio",'termino_previsto',NEW."termino_previsto",'aluguel_mensal',NEW."aluguel_mensal",'dia_vencimento',NEW."dia_vencimento",'indice_reajuste',NEW."indice_reajuste",'mes_reajuste',NEW."mes_reajuste",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'observacoes',NEW."observacoes",'estado',NEW."estado",'encerrado_em',NEW."encerrado_em") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contratos_context_delete" BEFORE DELETE ON "contratos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_audit_delete" AFTER DELETE ON "contratos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contratos',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'codigo',OLD."codigo",'imovel_id',OLD."imovel_id",'locatario_id',OLD."locatario_id",'inicio',OLD."inicio",'termino_previsto',OLD."termino_previsto",'aluguel_mensal',OLD."aluguel_mensal",'dia_vencimento',OLD."dia_vencimento",'indice_reajuste',OLD."indice_reajuste",'mes_reajuste',OLD."mes_reajuste",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'observacoes',OLD."observacoes",'estado',OLD."estado",'encerrado_em',OLD."encerrado_em"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contratos_imovel_id_active_insert" BEFORE INSERT ON "contratos" WHEN NEW."imovel_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imoveis" WHERE id=NEW."imovel_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_imovel_id_active_update" BEFORE UPDATE ON "contratos" WHEN NEW."imovel_id" IS NOT OLD."imovel_id" AND NEW."imovel_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imoveis" WHERE id=NEW."imovel_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_locatario_id_active_insert" BEFORE INSERT ON "contratos" WHEN NEW."locatario_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "locatarios" WHERE id=NEW."locatario_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_locatario_id_active_update" BEFORE UPDATE ON "contratos" WHEN NEW."locatario_id" IS NOT OLD."locatario_id" AND NEW."locatario_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "locatarios" WHERE id=NEW."locatario_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_context_insert" BEFORE INSERT ON "obras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_author_insert" BEFORE INSERT ON "obras" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_audit_insert" AFTER INSERT ON "obras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obras',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'codigo',NEW."codigo",'titulo',NEW."titulo",'imovel_id',NEW."imovel_id",'unidade_id',NEW."unidade_id",'responsavel_profissional_id',NEW."responsavel_profissional_id",'tipo_intervencao',NEW."tipo_intervencao",'descricao',NEW."descricao",'prioridade',NEW."prioridade",'estado',NEW."estado",'risco_informado',NEW."risco_informado",'progresso_percentual',NEW."progresso_percentual",'inicio_previsto',NEW."inicio_previsto",'termino_previsto',NEW."termino_previsto",'orcamento',NEW."orcamento",'reserva',NEW."reserva",'realizado_informado',NEW."realizado_informado",'proxima_atividade_descricao',NEW."proxima_atividade_descricao",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obras','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obras_context_update" BEFORE UPDATE ON "obras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_identity" BEFORE UPDATE ON "obras" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_author_update" BEFORE UPDATE ON "obras" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_updated_at" BEFORE UPDATE ON "obras" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_audit_update" AFTER UPDATE ON "obras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obras',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'codigo',OLD."codigo",'titulo',OLD."titulo",'imovel_id',OLD."imovel_id",'unidade_id',OLD."unidade_id",'responsavel_profissional_id',OLD."responsavel_profissional_id",'tipo_intervencao',OLD."tipo_intervencao",'descricao',OLD."descricao",'prioridade',OLD."prioridade",'estado',OLD."estado",'risco_informado',OLD."risco_informado",'progresso_percentual',OLD."progresso_percentual",'inicio_previsto',OLD."inicio_previsto",'termino_previsto',OLD."termino_previsto",'orcamento',OLD."orcamento",'reserva',OLD."reserva",'realizado_informado',OLD."realizado_informado",'proxima_atividade_descricao',OLD."proxima_atividade_descricao",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'codigo',NEW."codigo",'titulo',NEW."titulo",'imovel_id',NEW."imovel_id",'unidade_id',NEW."unidade_id",'responsavel_profissional_id',NEW."responsavel_profissional_id",'tipo_intervencao',NEW."tipo_intervencao",'descricao',NEW."descricao",'prioridade',NEW."prioridade",'estado',NEW."estado",'risco_informado',NEW."risco_informado",'progresso_percentual',NEW."progresso_percentual",'inicio_previsto',NEW."inicio_previsto",'termino_previsto',NEW."termino_previsto",'orcamento',NEW."orcamento",'reserva',NEW."reserva",'realizado_informado',NEW."realizado_informado",'proxima_atividade_descricao',NEW."proxima_atividade_descricao",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obras_context_delete" BEFORE DELETE ON "obras" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_audit_delete" AFTER DELETE ON "obras" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obras',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'codigo',OLD."codigo",'titulo',OLD."titulo",'imovel_id',OLD."imovel_id",'unidade_id',OLD."unidade_id",'responsavel_profissional_id',OLD."responsavel_profissional_id",'tipo_intervencao',OLD."tipo_intervencao",'descricao',OLD."descricao",'prioridade',OLD."prioridade",'estado',OLD."estado",'risco_informado',OLD."risco_informado",'progresso_percentual',OLD."progresso_percentual",'inicio_previsto',OLD."inicio_previsto",'termino_previsto',OLD."termino_previsto",'orcamento',OLD."orcamento",'reserva',OLD."reserva",'realizado_informado',OLD."realizado_informado",'proxima_atividade_descricao',OLD."proxima_atividade_descricao",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obras_imovel_id_active_insert" BEFORE INSERT ON "obras" WHEN NEW."imovel_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imoveis" WHERE id=NEW."imovel_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_imovel_id_active_update" BEFORE UPDATE ON "obras" WHEN NEW."imovel_id" IS NOT OLD."imovel_id" AND NEW."imovel_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "imoveis" WHERE id=NEW."imovel_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_unidade_id_active_insert" BEFORE INSERT ON "obras" WHEN NEW."unidade_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "unidades" WHERE id=NEW."unidade_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_unidade_id_active_update" BEFORE UPDATE ON "obras" WHEN NEW."unidade_id" IS NOT OLD."unidade_id" AND NEW."unidade_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "unidades" WHERE id=NEW."unidade_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_responsavel_profissional_id_active_insert" BEFORE INSERT ON "obras" WHEN NEW."responsavel_profissional_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "profissionais" WHERE id=NEW."responsavel_profissional_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obras_responsavel_profissional_id_active_update" BEFORE UPDATE ON "obras" WHEN NEW."responsavel_profissional_id" IS NOT OLD."responsavel_profissional_id" AND NEW."responsavel_profissional_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "profissionais" WHERE id=NEW."responsavel_profissional_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_context_insert" BEFORE INSERT ON "contrato_unidades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_author_insert" BEFORE INSERT ON "contrato_unidades" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_audit_insert" AFTER INSERT ON "contrato_unidades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contrato_unidades',json_object('contrato_id',NEW."contrato_id",'unidade_id',NEW."unidade_id"),'insert',motivo,NULL,json_object('created_at',NEW."created_at",'created_by',NEW."created_by",'contrato_id',NEW."contrato_id",'unidade_id',NEW."unidade_id") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','contrato_unidades','id',json_object('contrato_id',NEW."contrato_id",'unidade_id',NEW."unidade_id"))) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_context_update" BEFORE UPDATE ON "contrato_unidades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_identity" BEFORE UPDATE ON "contrato_unidades" WHEN NEW."contrato_id" IS NOT OLD."contrato_id" OR NEW."unidade_id" IS NOT OLD."unidade_id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_audit_update" AFTER UPDATE ON "contrato_unidades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contrato_unidades',json_object('contrato_id',NEW."contrato_id",'unidade_id',NEW."unidade_id"),'update',motivo,json_object('created_at',OLD."created_at",'created_by',OLD."created_by",'contrato_id',OLD."contrato_id",'unidade_id',OLD."unidade_id"),json_object('created_at',NEW."created_at",'created_by',NEW."created_by",'contrato_id',NEW."contrato_id",'unidade_id',NEW."unidade_id") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_context_delete" BEFORE DELETE ON "contrato_unidades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_audit_delete" AFTER DELETE ON "contrato_unidades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contrato_unidades',json_object('contrato_id',OLD."contrato_id",'unidade_id',OLD."unidade_id"),'delete',motivo,json_object('created_at',OLD."created_at",'created_by',OLD."created_by",'contrato_id',OLD."contrato_id",'unidade_id',OLD."unidade_id"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_unidade_id_active_insert" BEFORE INSERT ON "contrato_unidades" WHEN NEW."unidade_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "unidades" WHERE id=NEW."unidade_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_unidade_id_active_update" BEFORE UPDATE ON "contrato_unidades" WHEN NEW."unidade_id" IS NOT OLD."unidade_id" AND NEW."unidade_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "unidades" WHERE id=NEW."unidade_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_context_insert" BEFORE INSERT ON "contrato_encargos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_author_insert" BEFORE INSERT ON "contrato_encargos" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_audit_insert" AFTER INSERT ON "contrato_encargos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contrato_encargos',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'contrato_id',NEW."contrato_id",'ordem',NEW."ordem",'nome',NEW."nome",'natureza',NEW."natureza",'valor_base',NEW."valor_base") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','contrato_encargos','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_context_update" BEFORE UPDATE ON "contrato_encargos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_identity" BEFORE UPDATE ON "contrato_encargos" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_author_update" BEFORE UPDATE ON "contrato_encargos" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_updated_at" BEFORE UPDATE ON "contrato_encargos" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_audit_update" AFTER UPDATE ON "contrato_encargos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contrato_encargos',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'contrato_id',OLD."contrato_id",'ordem',OLD."ordem",'nome',OLD."nome",'natureza',OLD."natureza",'valor_base',OLD."valor_base"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'contrato_id',NEW."contrato_id",'ordem',NEW."ordem",'nome',NEW."nome",'natureza',NEW."natureza",'valor_base',NEW."valor_base") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_context_delete" BEFORE DELETE ON "contrato_encargos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_encargos_audit_delete" AFTER DELETE ON "contrato_encargos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'contrato_encargos',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'contrato_id',OLD."contrato_id",'ordem',OLD."ordem",'nome',OLD."nome",'natureza',OLD."natureza",'valor_base',OLD."valor_base"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_context_insert" BEFORE INSERT ON "obra_atividades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_author_insert" BEFORE INSERT ON "obra_atividades" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_audit_insert" AFTER INSERT ON "obra_atividades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_atividades',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'etapa',NEW."etapa",'titulo',NEW."titulo",'responsavel_profissional_id',NEW."responsavel_profissional_id",'inicio',NEW."inicio",'termino',NEW."termino",'estado',NEW."estado",'motivo_bloqueio',NEW."motivo_bloqueio") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_atividades','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_context_update" BEFORE UPDATE ON "obra_atividades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_identity" BEFORE UPDATE ON "obra_atividades" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_author_update" BEFORE UPDATE ON "obra_atividades" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_updated_at" BEFORE UPDATE ON "obra_atividades" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_audit_update" AFTER UPDATE ON "obra_atividades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_atividades',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'etapa',OLD."etapa",'titulo',OLD."titulo",'responsavel_profissional_id',OLD."responsavel_profissional_id",'inicio',OLD."inicio",'termino',OLD."termino",'estado',OLD."estado",'motivo_bloqueio',OLD."motivo_bloqueio"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'etapa',NEW."etapa",'titulo',NEW."titulo",'responsavel_profissional_id',NEW."responsavel_profissional_id",'inicio',NEW."inicio",'termino',NEW."termino",'estado',NEW."estado",'motivo_bloqueio',NEW."motivo_bloqueio") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_context_delete" BEFORE DELETE ON "obra_atividades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_preserve" BEFORE DELETE ON "obra_atividades" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_audit_delete" AFTER DELETE ON "obra_atividades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_atividades',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'etapa',OLD."etapa",'titulo',OLD."titulo",'responsavel_profissional_id',OLD."responsavel_profissional_id",'inicio',OLD."inicio",'termino',OLD."termino",'estado',OLD."estado",'motivo_bloqueio',OLD."motivo_bloqueio"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_responsavel_profissional_id_active_insert" BEFORE INSERT ON "obra_atividades" WHEN NEW."responsavel_profissional_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "profissionais" WHERE id=NEW."responsavel_profissional_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_atividades_responsavel_profissional_id_active_update" BEFORE UPDATE ON "obra_atividades" WHEN NEW."responsavel_profissional_id" IS NOT OLD."responsavel_profissional_id" AND NEW."responsavel_profissional_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "profissionais" WHERE id=NEW."responsavel_profissional_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_context_insert" BEFORE INSERT ON "obra_alocacoes_equipe" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_author_insert" BEFORE INSERT ON "obra_alocacoes_equipe" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_audit_insert" AFTER INSERT ON "obra_alocacoes_equipe" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_alocacoes_equipe',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'obra_id',NEW."obra_id",'profissional_id',NEW."profissional_id",'codigo',NEW."codigo",'funcao',NEW."funcao",'inicio',NEW."inicio",'termino',NEW."termino",'modalidade',NEW."modalidade",'quantidade',NEW."quantidade",'valor_unitario',NEW."valor_unitario",'removida_em',NEW."removida_em") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_alocacoes_equipe','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_context_update" BEFORE UPDATE ON "obra_alocacoes_equipe" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_identity" BEFORE UPDATE ON "obra_alocacoes_equipe" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_author_update" BEFORE UPDATE ON "obra_alocacoes_equipe" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_updated_at" BEFORE UPDATE ON "obra_alocacoes_equipe" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_audit_update" AFTER UPDATE ON "obra_alocacoes_equipe" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_alocacoes_equipe',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'obra_id',OLD."obra_id",'profissional_id',OLD."profissional_id",'codigo',OLD."codigo",'funcao',OLD."funcao",'inicio',OLD."inicio",'termino',OLD."termino",'modalidade',OLD."modalidade",'quantidade',OLD."quantidade",'valor_unitario',OLD."valor_unitario",'removida_em',OLD."removida_em"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'obra_id',NEW."obra_id",'profissional_id',NEW."profissional_id",'codigo',NEW."codigo",'funcao',NEW."funcao",'inicio',NEW."inicio",'termino',NEW."termino",'modalidade',NEW."modalidade",'quantidade',NEW."quantidade",'valor_unitario',NEW."valor_unitario",'removida_em',NEW."removida_em") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_context_delete" BEFORE DELETE ON "obra_alocacoes_equipe" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_preserve" BEFORE DELETE ON "obra_alocacoes_equipe" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_audit_delete" AFTER DELETE ON "obra_alocacoes_equipe" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_alocacoes_equipe',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'obra_id',OLD."obra_id",'profissional_id',OLD."profissional_id",'codigo',OLD."codigo",'funcao',OLD."funcao",'inicio',OLD."inicio",'termino',OLD."termino",'modalidade',OLD."modalidade",'quantidade',OLD."quantidade",'valor_unitario',OLD."valor_unitario",'removida_em',OLD."removida_em"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_profissional_id_active_insert" BEFORE INSERT ON "obra_alocacoes_equipe" WHEN NEW."profissional_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "profissionais" WHERE id=NEW."profissional_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_alocacoes_equipe_profissional_id_active_update" BEFORE UPDATE ON "obra_alocacoes_equipe" WHEN NEW."profissional_id" IS NOT OLD."profissional_id" AND NEW."profissional_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "profissionais" WHERE id=NEW."profissional_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_context_insert" BEFORE INSERT ON "obra_socios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_author_insert" BEFORE INSERT ON "obra_socios" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_audit_insert" AFTER INSERT ON "obra_socios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_socios',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'obra_id',NEW."obra_id",'socio_id',NEW."socio_id",'percentual',NEW."percentual",'inicio_vigencia',NEW."inicio_vigencia",'fim_vigencia',NEW."fim_vigencia") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_socios','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_context_update" BEFORE UPDATE ON "obra_socios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_identity" BEFORE UPDATE ON "obra_socios" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_audit_update" AFTER UPDATE ON "obra_socios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_socios',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'obra_id',OLD."obra_id",'socio_id',OLD."socio_id",'percentual',OLD."percentual",'inicio_vigencia',OLD."inicio_vigencia",'fim_vigencia',OLD."fim_vigencia"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'obra_id',NEW."obra_id",'socio_id',NEW."socio_id",'percentual',NEW."percentual",'inicio_vigencia',NEW."inicio_vigencia",'fim_vigencia',NEW."fim_vigencia") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_context_delete" BEFORE DELETE ON "obra_socios" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_preserve" BEFORE DELETE ON "obra_socios" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_audit_delete" AFTER DELETE ON "obra_socios" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_socios',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'obra_id',OLD."obra_id",'socio_id',OLD."socio_id",'percentual',OLD."percentual",'inicio_vigencia',OLD."inicio_vigencia",'fim_vigencia',OLD."fim_vigencia"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_socio_id_active_insert" BEFORE INSERT ON "obra_socios" WHEN NEW."socio_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "socios" WHERE id=NEW."socio_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_socio_id_active_update" BEFORE UPDATE ON "obra_socios" WHEN NEW."socio_id" IS NOT OLD."socio_id" AND NEW."socio_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "socios" WHERE id=NEW."socio_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_context_insert" BEFORE INSERT ON "cobrancas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_author_insert" BEFORE INSERT ON "cobrancas" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_audit_insert" AFTER INSERT ON "cobrancas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'cobrancas',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'codigo',NEW."codigo",'contrato_id',NEW."contrato_id",'competencia',NEW."competencia",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','cobrancas','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_context_update" BEFORE UPDATE ON "cobrancas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_immutable" BEFORE UPDATE ON "cobrancas" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_audit_update" AFTER UPDATE ON "cobrancas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'cobrancas',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'codigo',OLD."codigo",'contrato_id',OLD."contrato_id",'competencia',OLD."competencia",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'codigo',NEW."codigo",'contrato_id',NEW."contrato_id",'competencia',NEW."competencia",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_context_delete" BEFORE DELETE ON "cobrancas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_preserve" BEFORE DELETE ON "cobrancas" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "cobrancas_audit_delete" AFTER DELETE ON "cobrancas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'cobrancas',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'codigo',OLD."codigo",'contrato_id',OLD."contrato_id",'competencia',OLD."competencia",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "despesas_context_insert" BEFORE INSERT ON "despesas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_author_insert" BEFORE INSERT ON "despesas" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_audit_insert" AFTER INSERT ON "despesas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'despesas',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'codigo',NEW."codigo",'fornecedor_id',NEW."fornecedor_id",'origem',NEW."origem",'categoria_id',NEW."categoria_id",'descricao',NEW."descricao",'valor',NEW."valor",'vencimento',NEW."vencimento",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'conta_financeira_prevista_id',NEW."conta_financeira_prevista_id",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','despesas','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "despesas_context_update" BEFORE UPDATE ON "despesas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_identity" BEFORE UPDATE ON "despesas" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_author_update" BEFORE UPDATE ON "despesas" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_updated_at" BEFORE UPDATE ON "despesas" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_audit_update" AFTER UPDATE ON "despesas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'despesas',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'codigo',OLD."codigo",'fornecedor_id',OLD."fornecedor_id",'origem',OLD."origem",'categoria_id',OLD."categoria_id",'descricao',OLD."descricao",'valor',OLD."valor",'vencimento',OLD."vencimento",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'conta_financeira_prevista_id',OLD."conta_financeira_prevista_id",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'codigo',NEW."codigo",'fornecedor_id',NEW."fornecedor_id",'origem',NEW."origem",'categoria_id',NEW."categoria_id",'descricao',NEW."descricao",'valor',NEW."valor",'vencimento',NEW."vencimento",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'conta_financeira_prevista_id',NEW."conta_financeira_prevista_id",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "despesas_context_delete" BEFORE DELETE ON "despesas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_preserve" BEFORE DELETE ON "despesas" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_audit_delete" AFTER DELETE ON "despesas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'despesas',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'codigo',OLD."codigo",'fornecedor_id',OLD."fornecedor_id",'origem',OLD."origem",'categoria_id',OLD."categoria_id",'descricao',OLD."descricao",'valor',OLD."valor",'vencimento',OLD."vencimento",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'conta_financeira_prevista_id',OLD."conta_financeira_prevista_id",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "despesas_fornecedor_id_active_insert" BEFORE INSERT ON "despesas" WHEN NEW."fornecedor_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "fornecedores" WHERE id=NEW."fornecedor_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_fornecedor_id_active_update" BEFORE UPDATE ON "despesas" WHEN NEW."fornecedor_id" IS NOT OLD."fornecedor_id" AND NEW."fornecedor_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "fornecedores" WHERE id=NEW."fornecedor_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_categoria_id_active_insert" BEFORE INSERT ON "despesas" WHEN NEW."categoria_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "categorias_despesa" WHERE id=NEW."categoria_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_categoria_id_active_update" BEFORE UPDATE ON "despesas" WHEN NEW."categoria_id" IS NOT OLD."categoria_id" AND NEW."categoria_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "categorias_despesa" WHERE id=NEW."categoria_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_conta_financeira_prevista_id_active_insert" BEFORE INSERT ON "despesas" WHEN NEW."conta_financeira_prevista_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "contas_financeiras" WHERE id=NEW."conta_financeira_prevista_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "despesas_conta_financeira_prevista_id_active_update" BEFORE UPDATE ON "despesas" WHEN NEW."conta_financeira_prevista_id" IS NOT OLD."conta_financeira_prevista_id" AND NEW."conta_financeira_prevista_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "contas_financeiras" WHERE id=NEW."conta_financeira_prevista_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_context_insert" BEFORE INSERT ON "obra_equipe_atividades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_author_insert" BEFORE INSERT ON "obra_equipe_atividades" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_audit_insert" AFTER INSERT ON "obra_equipe_atividades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_equipe_atividades',json_object('alocacao_id',NEW."alocacao_id",'atividade_id',NEW."atividade_id"),'insert',motivo,NULL,json_object('created_at',NEW."created_at",'created_by',NEW."created_by",'alocacao_id',NEW."alocacao_id",'atividade_id',NEW."atividade_id") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_equipe_atividades','id',json_object('alocacao_id',NEW."alocacao_id",'atividade_id',NEW."atividade_id"))) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_context_update" BEFORE UPDATE ON "obra_equipe_atividades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_identity" BEFORE UPDATE ON "obra_equipe_atividades" WHEN NEW."alocacao_id" IS NOT OLD."alocacao_id" OR NEW."atividade_id" IS NOT OLD."atividade_id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_audit_update" AFTER UPDATE ON "obra_equipe_atividades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_equipe_atividades',json_object('alocacao_id',NEW."alocacao_id",'atividade_id',NEW."atividade_id"),'update',motivo,json_object('created_at',OLD."created_at",'created_by',OLD."created_by",'alocacao_id',OLD."alocacao_id",'atividade_id',OLD."atividade_id"),json_object('created_at',NEW."created_at",'created_by',NEW."created_by",'alocacao_id',NEW."alocacao_id",'atividade_id',NEW."atividade_id") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_context_delete" BEFORE DELETE ON "obra_equipe_atividades" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_equipe_atividades_audit_delete" AFTER DELETE ON "obra_equipe_atividades" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_equipe_atividades',json_object('alocacao_id',OLD."alocacao_id",'atividade_id',OLD."atividade_id"),'delete',motivo,json_object('created_at',OLD."created_at",'created_by',OLD."created_by",'alocacao_id',OLD."alocacao_id",'atividade_id',OLD."atividade_id"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "aportes_context_insert" BEFORE INSERT ON "aportes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aportes_author_insert" BEFORE INSERT ON "aportes" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "aportes_audit_insert" AFTER INSERT ON "aportes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aportes',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'data_solicitacao',NEW."data_solicitacao",'descricao',NEW."descricao",'valor_solicitado',NEW."valor_solicitado") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','aportes','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "aportes_context_update" BEFORE UPDATE ON "aportes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aportes_immutable" BEFORE UPDATE ON "aportes" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "aportes_audit_update" AFTER UPDATE ON "aportes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aportes',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'data_solicitacao',OLD."data_solicitacao",'descricao',OLD."descricao",'valor_solicitado',OLD."valor_solicitado"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'data_solicitacao',NEW."data_solicitacao",'descricao',NEW."descricao",'valor_solicitado',NEW."valor_solicitado") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "aportes_context_delete" BEFORE DELETE ON "aportes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aportes_preserve" BEFORE DELETE ON "aportes" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "aportes_audit_delete" AFTER DELETE ON "aportes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aportes',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'data_solicitacao',OLD."data_solicitacao",'descricao',OLD."descricao",'valor_solicitado',OLD."valor_solicitado"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_context_insert" BEFORE INSERT ON "obra_ajustes_caixa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_author_insert" BEFORE INSERT ON "obra_ajustes_caixa" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_audit_insert" AFTER INSERT ON "obra_ajustes_caixa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_ajustes_caixa',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'data_movimento',NEW."data_movimento",'descricao',NEW."descricao",'valor_assinado',NEW."valor_assinado") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_ajustes_caixa','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_context_update" BEFORE UPDATE ON "obra_ajustes_caixa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_immutable" BEFORE UPDATE ON "obra_ajustes_caixa" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_audit_update" AFTER UPDATE ON "obra_ajustes_caixa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_ajustes_caixa',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'data_movimento',OLD."data_movimento",'descricao',OLD."descricao",'valor_assinado',OLD."valor_assinado"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'data_movimento',NEW."data_movimento",'descricao',NEW."descricao",'valor_assinado',NEW."valor_assinado") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_context_delete" BEFORE DELETE ON "obra_ajustes_caixa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_preserve" BEFORE DELETE ON "obra_ajustes_caixa" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_ajustes_caixa_audit_delete" AFTER DELETE ON "obra_ajustes_caixa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_ajustes_caixa',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'data_movimento',OLD."data_movimento",'descricao',OLD."descricao",'valor_assinado',OLD."valor_assinado"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_context_insert" BEFORE INSERT ON "obra_diario" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_author_insert" BEFORE INSERT ON "obra_diario" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_audit_insert" AFTER INSERT ON "obra_diario" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_diario',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'tipo',NEW."tipo",'titulo',NEW."titulo",'descricao',NEW."descricao",'ocorrido_em',NEW."ocorrido_em",'autor_usuario_id',NEW."autor_usuario_id",'autor_legado_nome',NEW."autor_legado_nome",'progresso_registrado',NEW."progresso_registrado",'auditoria_evento_id',NEW."auditoria_evento_id") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_diario','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_context_update" BEFORE UPDATE ON "obra_diario" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_immutable" BEFORE UPDATE ON "obra_diario" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_audit_update" AFTER UPDATE ON "obra_diario" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_diario',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'tipo',OLD."tipo",'titulo',OLD."titulo",'descricao',OLD."descricao",'ocorrido_em',OLD."ocorrido_em",'autor_usuario_id',OLD."autor_usuario_id",'autor_legado_nome',OLD."autor_legado_nome",'progresso_registrado',OLD."progresso_registrado",'auditoria_evento_id',OLD."auditoria_evento_id"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'tipo',NEW."tipo",'titulo',NEW."titulo",'descricao',NEW."descricao",'ocorrido_em',NEW."ocorrido_em",'autor_usuario_id',NEW."autor_usuario_id",'autor_legado_nome',NEW."autor_legado_nome",'progresso_registrado',NEW."progresso_registrado",'auditoria_evento_id',NEW."auditoria_evento_id") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_context_delete" BEFORE DELETE ON "obra_diario" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_preserve" BEFORE DELETE ON "obra_diario" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_audit_delete" AFTER DELETE ON "obra_diario" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_diario',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'tipo',OLD."tipo",'titulo',OLD."titulo",'descricao',OLD."descricao",'ocorrido_em',OLD."ocorrido_em",'autor_usuario_id',OLD."autor_usuario_id",'autor_legado_nome',OLD."autor_legado_nome",'progresso_registrado',OLD."progresso_registrado",'auditoria_evento_id',OLD."auditoria_evento_id"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_autor_usuario_id_active_insert" BEFORE INSERT ON "obra_diario" WHEN NEW."autor_usuario_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "usuarios" WHERE id=NEW."autor_usuario_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_diario_autor_usuario_id_active_update" BEFORE UPDATE ON "obra_diario" WHEN NEW."autor_usuario_id" IS NOT OLD."autor_usuario_id" AND NEW."autor_usuario_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "usuarios" WHERE id=NEW."autor_usuario_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_context_insert" BEFORE INSERT ON "obra_pendencias" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_author_insert" BEFORE INSERT ON "obra_pendencias" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_audit_insert" AFTER INSERT ON "obra_pendencias" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_pendencias',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'titulo',NEW."titulo",'descricao',NEW."descricao",'severidade',NEW."severidade",'resolvida_em',NEW."resolvida_em",'resolvida_por',NEW."resolvida_por") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_pendencias','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_context_update" BEFORE UPDATE ON "obra_pendencias" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_identity" BEFORE UPDATE ON "obra_pendencias" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_author_update" BEFORE UPDATE ON "obra_pendencias" WHEN NEW.updated_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_updated_at" BEFORE UPDATE ON "obra_pendencias" WHEN NEW.updated_at<OLD.updated_at OR NEW.updated_at<(SELECT iniciado_em FROM __write_context) BEGIN SELECT RAISE(ABORT, 'updated_at deve registrar o instante da alteracao'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_audit_update" AFTER UPDATE ON "obra_pendencias" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_pendencias',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'titulo',OLD."titulo",'descricao',OLD."descricao",'severidade',OLD."severidade",'resolvida_em',OLD."resolvida_em",'resolvida_por',OLD."resolvida_por"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'updated_at',NEW."updated_at",'updated_by',NEW."updated_by",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'titulo',NEW."titulo",'descricao',NEW."descricao",'severidade',NEW."severidade",'resolvida_em',NEW."resolvida_em",'resolvida_por',NEW."resolvida_por") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_context_delete" BEFORE DELETE ON "obra_pendencias" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_preserve" BEFORE DELETE ON "obra_pendencias" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_audit_delete" AFTER DELETE ON "obra_pendencias" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_pendencias',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'updated_at',OLD."updated_at",'updated_by',OLD."updated_by",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'titulo',OLD."titulo",'descricao',OLD."descricao",'severidade',OLD."severidade",'resolvida_em',OLD."resolvida_em",'resolvida_por',OLD."resolvida_por"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_resolvida_por_active_insert" BEFORE INSERT ON "obra_pendencias" WHEN NEW."resolvida_por" IS NOT NULL AND EXISTS(SELECT 1 FROM "usuarios" WHERE id=NEW."resolvida_por" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_pendencias_resolvida_por_active_update" BEFORE UPDATE ON "obra_pendencias" WHEN NEW."resolvida_por" IS NOT OLD."resolvida_por" AND NEW."resolvida_por" IS NOT NULL AND EXISTS(SELECT 1 FROM "usuarios" WHERE id=NEW."resolvida_por" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_context_insert" BEFORE INSERT ON "cobranca_itens" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_author_insert" BEFORE INSERT ON "cobranca_itens" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_audit_insert" AFTER INSERT ON "cobranca_itens" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'cobranca_itens',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'cobranca_id',NEW."cobranca_id",'contrato_encargo_id',NEW."contrato_encargo_id",'ordem',NEW."ordem",'nome_emissao',NEW."nome_emissao",'natureza',NEW."natureza",'vencimento',NEW."vencimento",'valor',NEW."valor",'referencia',NEW."referencia") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','cobranca_itens','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_context_update" BEFORE UPDATE ON "cobranca_itens" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_immutable" BEFORE UPDATE ON "cobranca_itens" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_audit_update" AFTER UPDATE ON "cobranca_itens" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'cobranca_itens',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'cobranca_id',OLD."cobranca_id",'contrato_encargo_id',OLD."contrato_encargo_id",'ordem',OLD."ordem",'nome_emissao',OLD."nome_emissao",'natureza',OLD."natureza",'vencimento',OLD."vencimento",'valor',OLD."valor",'referencia',OLD."referencia"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'cobranca_id',NEW."cobranca_id",'contrato_encargo_id',NEW."contrato_encargo_id",'ordem',NEW."ordem",'nome_emissao',NEW."nome_emissao",'natureza',NEW."natureza",'vencimento',NEW."vencimento",'valor',NEW."valor",'referencia',NEW."referencia") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_context_delete" BEFORE DELETE ON "cobranca_itens" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_preserve" BEFORE DELETE ON "cobranca_itens" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_audit_delete" AFTER DELETE ON "cobranca_itens" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'cobranca_itens',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'cobranca_id',OLD."cobranca_id",'contrato_encargo_id',OLD."contrato_encargo_id",'ordem',OLD."ordem",'nome_emissao',OLD."nome_emissao",'natureza',OLD."natureza",'vencimento',OLD."vencimento",'valor',OLD."valor",'referencia',OLD."referencia"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_context_insert" BEFORE INSERT ON "negociacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_author_insert" BEFORE INSERT ON "negociacoes" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_audit_insert" AFTER INSERT ON "negociacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'negociacoes',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'cobranca_id',NEW."cobranca_id",'versao',NEW."versao",'negociacao_anterior_id',NEW."negociacao_anterior_id",'saldo_base',NEW."saldo_base",'desconto',NEW."desconto",'acrescimo',NEW."acrescimo",'entrada_prevista',NEW."entrada_prevista",'quantidade_parcelas',NEW."quantidade_parcelas",'primeiro_vencimento',NEW."primeiro_vencimento",'data_acordo',NEW."data_acordo",'motivo',NEW."motivo",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'substituida_em',NEW."substituida_em") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','negociacoes','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_context_update" BEFORE UPDATE ON "negociacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_identity" BEFORE UPDATE ON "negociacoes" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_audit_update" AFTER UPDATE ON "negociacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'negociacoes',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'cobranca_id',OLD."cobranca_id",'versao',OLD."versao",'negociacao_anterior_id',OLD."negociacao_anterior_id",'saldo_base',OLD."saldo_base",'desconto',OLD."desconto",'acrescimo',OLD."acrescimo",'entrada_prevista',OLD."entrada_prevista",'quantidade_parcelas',OLD."quantidade_parcelas",'primeiro_vencimento',OLD."primeiro_vencimento",'data_acordo',OLD."data_acordo",'motivo',OLD."motivo",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'substituida_em',OLD."substituida_em"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'cobranca_id',NEW."cobranca_id",'versao',NEW."versao",'negociacao_anterior_id',NEW."negociacao_anterior_id",'saldo_base',NEW."saldo_base",'desconto',NEW."desconto",'acrescimo',NEW."acrescimo",'entrada_prevista',NEW."entrada_prevista",'quantidade_parcelas',NEW."quantidade_parcelas",'primeiro_vencimento',NEW."primeiro_vencimento",'data_acordo',NEW."data_acordo",'motivo',NEW."motivo",'forma_pagamento_prevista',NEW."forma_pagamento_prevista",'substituida_em',NEW."substituida_em") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_context_delete" BEFORE DELETE ON "negociacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_preserve" BEFORE DELETE ON "negociacoes" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_audit_delete" AFTER DELETE ON "negociacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'negociacoes',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'cobranca_id',OLD."cobranca_id",'versao',OLD."versao",'negociacao_anterior_id',OLD."negociacao_anterior_id",'saldo_base',OLD."saldo_base",'desconto',OLD."desconto",'acrescimo',OLD."acrescimo",'entrada_prevista',OLD."entrada_prevista",'quantidade_parcelas',OLD."quantidade_parcelas",'primeiro_vencimento',OLD."primeiro_vencimento",'data_acordo',OLD."data_acordo",'motivo',OLD."motivo",'forma_pagamento_prevista',OLD."forma_pagamento_prevista",'substituida_em',OLD."substituida_em"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_context_insert" BEFORE INSERT ON "recebimentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_author_insert" BEFORE INSERT ON "recebimentos" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_audit_insert" AFTER INSERT ON "recebimentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'recebimentos',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'codigo',NEW."codigo",'cobranca_id',NEW."cobranca_id",'data_recebimento',NEW."data_recebimento",'valor',NEW."valor",'forma_pagamento',NEW."forma_pagamento",'conta_financeira_id',NEW."conta_financeira_id",'referencia',NEW."referencia") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','recebimentos','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_context_update" BEFORE UPDATE ON "recebimentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_immutable" BEFORE UPDATE ON "recebimentos" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_audit_update" AFTER UPDATE ON "recebimentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'recebimentos',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'codigo',OLD."codigo",'cobranca_id',OLD."cobranca_id",'data_recebimento',OLD."data_recebimento",'valor',OLD."valor",'forma_pagamento',OLD."forma_pagamento",'conta_financeira_id',OLD."conta_financeira_id",'referencia',OLD."referencia"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'codigo',NEW."codigo",'cobranca_id',NEW."cobranca_id",'data_recebimento',NEW."data_recebimento",'valor',NEW."valor",'forma_pagamento',NEW."forma_pagamento",'conta_financeira_id',NEW."conta_financeira_id",'referencia',NEW."referencia") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_context_delete" BEFORE DELETE ON "recebimentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_preserve" BEFORE DELETE ON "recebimentos" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_audit_delete" AFTER DELETE ON "recebimentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'recebimentos',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'codigo',OLD."codigo",'cobranca_id',OLD."cobranca_id",'data_recebimento',OLD."data_recebimento",'valor',OLD."valor",'forma_pagamento',OLD."forma_pagamento",'conta_financeira_id',OLD."conta_financeira_id",'referencia',OLD."referencia"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_conta_financeira_id_active_insert" BEFORE INSERT ON "recebimentos" WHEN NEW."conta_financeira_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "contas_financeiras" WHERE id=NEW."conta_financeira_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimentos_conta_financeira_id_active_update" BEFORE UPDATE ON "recebimentos" WHEN NEW."conta_financeira_id" IS NOT OLD."conta_financeira_id" AND NEW."conta_financeira_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "contas_financeiras" WHERE id=NEW."conta_financeira_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_context_insert" BEFORE INSERT ON "pagamentos_despesa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_author_insert" BEFORE INSERT ON "pagamentos_despesa" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_audit_insert" AFTER INSERT ON "pagamentos_despesa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'pagamentos_despesa',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'despesa_id',NEW."despesa_id",'codigo',NEW."codigo",'data_pagamento',NEW."data_pagamento",'valor',NEW."valor",'forma_pagamento',NEW."forma_pagamento",'conta_financeira_id',NEW."conta_financeira_id",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','pagamentos_despesa','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_context_update" BEFORE UPDATE ON "pagamentos_despesa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_immutable" BEFORE UPDATE ON "pagamentos_despesa" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_audit_update" AFTER UPDATE ON "pagamentos_despesa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'pagamentos_despesa',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'despesa_id',OLD."despesa_id",'codigo',OLD."codigo",'data_pagamento',OLD."data_pagamento",'valor',OLD."valor",'forma_pagamento',OLD."forma_pagamento",'conta_financeira_id',OLD."conta_financeira_id",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'despesa_id',NEW."despesa_id",'codigo',NEW."codigo",'data_pagamento',NEW."data_pagamento",'valor',NEW."valor",'forma_pagamento',NEW."forma_pagamento",'conta_financeira_id',NEW."conta_financeira_id",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_context_delete" BEFORE DELETE ON "pagamentos_despesa" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_preserve" BEFORE DELETE ON "pagamentos_despesa" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_audit_delete" AFTER DELETE ON "pagamentos_despesa" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'pagamentos_despesa',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'despesa_id',OLD."despesa_id",'codigo',OLD."codigo",'data_pagamento',OLD."data_pagamento",'valor',OLD."valor",'forma_pagamento',OLD."forma_pagamento",'conta_financeira_id',OLD."conta_financeira_id",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_conta_financeira_id_active_insert" BEFORE INSERT ON "pagamentos_despesa" WHEN NEW."conta_financeira_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "contas_financeiras" WHERE id=NEW."conta_financeira_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "pagamentos_despesa_conta_financeira_id_active_update" BEFORE UPDATE ON "pagamentos_despesa" WHEN NEW."conta_financeira_id" IS NOT OLD."conta_financeira_id" AND NEW."conta_financeira_id" IS NOT NULL AND EXISTS(SELECT 1 FROM "contas_financeiras" WHERE id=NEW."conta_financeira_id" AND ativo=0) BEGIN SELECT RAISE(ABORT, 'Novo vinculo exige cadastro ativo'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_context_insert" BEFORE INSERT ON "obra_contratacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_audit_insert" AFTER INSERT ON "obra_contratacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_contratacoes',NEW."despesa_id",'insert',motivo,NULL,json_object('despesa_id',NEW."despesa_id",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'tipo_fornecimento',NEW."tipo_fornecimento",'data_contratacao',NEW."data_contratacao") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','obra_contratacoes','id',NEW."despesa_id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_context_update" BEFORE UPDATE ON "obra_contratacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_identity" BEFORE UPDATE ON "obra_contratacoes" WHEN NEW."despesa_id" IS NOT OLD."despesa_id" BEGIN SELECT RAISE(ABORT, 'Identidade e autoria de criacao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_audit_update" AFTER UPDATE ON "obra_contratacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_contratacoes',NEW."despesa_id",'update',motivo,json_object('despesa_id',OLD."despesa_id",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'tipo_fornecimento',OLD."tipo_fornecimento",'data_contratacao',OLD."data_contratacao"),json_object('despesa_id',NEW."despesa_id",'obra_id',NEW."obra_id",'codigo',NEW."codigo",'tipo_fornecimento',NEW."tipo_fornecimento",'data_contratacao',NEW."data_contratacao") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_context_delete" BEFORE DELETE ON "obra_contratacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_preserve" BEFORE DELETE ON "obra_contratacoes" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_contratacoes_audit_delete" AFTER DELETE ON "obra_contratacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'obra_contratacoes',OLD."despesa_id",'delete',motivo,json_object('despesa_id',OLD."despesa_id",'obra_id',OLD."obra_id",'codigo',OLD."codigo",'tipo_fornecimento',OLD."tipo_fornecimento",'data_contratacao',OLD."data_contratacao"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_context_insert" BEFORE INSERT ON "aporte_cotas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_author_insert" BEFORE INSERT ON "aporte_cotas" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_audit_insert" AFTER INSERT ON "aporte_cotas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aporte_cotas',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'aporte_id',NEW."aporte_id",'obra_socio_id',NEW."obra_socio_id",'ordem_rateio',NEW."ordem_rateio",'nome_socio_pactuado',NEW."nome_socio_pactuado",'valor_devido',NEW."valor_devido") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','aporte_cotas','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_context_update" BEFORE UPDATE ON "aporte_cotas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_immutable" BEFORE UPDATE ON "aporte_cotas" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_audit_update" AFTER UPDATE ON "aporte_cotas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aporte_cotas',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'aporte_id',OLD."aporte_id",'obra_socio_id',OLD."obra_socio_id",'ordem_rateio',OLD."ordem_rateio",'nome_socio_pactuado',OLD."nome_socio_pactuado",'valor_devido',OLD."valor_devido"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'aporte_id',NEW."aporte_id",'obra_socio_id',NEW."obra_socio_id",'ordem_rateio',NEW."ordem_rateio",'nome_socio_pactuado',NEW."nome_socio_pactuado",'valor_devido',NEW."valor_devido") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_context_delete" BEFORE DELETE ON "aporte_cotas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_preserve" BEFORE DELETE ON "aporte_cotas" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_audit_delete" AFTER DELETE ON "aporte_cotas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aporte_cotas',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'aporte_id',OLD."aporte_id",'obra_socio_id',OLD."obra_socio_id",'ordem_rateio',OLD."ordem_rateio",'nome_socio_pactuado',OLD."nome_socio_pactuado",'valor_devido',OLD."valor_devido"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_context_insert" BEFORE INSERT ON "negociacao_parcelas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_author_insert" BEFORE INSERT ON "negociacao_parcelas" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_audit_insert" AFTER INSERT ON "negociacao_parcelas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'negociacao_parcelas',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'negociacao_id',NEW."negociacao_id",'numero',NEW."numero",'vencimento',NEW."vencimento",'valor',NEW."valor") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','negociacao_parcelas','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_context_update" BEFORE UPDATE ON "negociacao_parcelas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_immutable" BEFORE UPDATE ON "negociacao_parcelas" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_audit_update" AFTER UPDATE ON "negociacao_parcelas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'negociacao_parcelas',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'negociacao_id',OLD."negociacao_id",'numero',OLD."numero",'vencimento',OLD."vencimento",'valor',OLD."valor"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'negociacao_id',NEW."negociacao_id",'numero',NEW."numero",'vencimento',NEW."vencimento",'valor',NEW."valor") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_context_delete" BEFORE DELETE ON "negociacao_parcelas" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_preserve" BEFORE DELETE ON "negociacao_parcelas" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_audit_delete" AFTER DELETE ON "negociacao_parcelas" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'negociacao_parcelas',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'negociacao_id',OLD."negociacao_id",'numero',OLD."numero",'vencimento',OLD."vencimento",'valor',OLD."valor"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_context_insert" BEFORE INSERT ON "aporte_pagamentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_author_insert" BEFORE INSERT ON "aporte_pagamentos" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_audit_insert" AFTER INSERT ON "aporte_pagamentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aporte_pagamentos',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'cota_id',NEW."cota_id",'codigo',NEW."codigo",'data_pagamento',NEW."data_pagamento",'valor',NEW."valor",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','aporte_pagamentos','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_context_update" BEFORE UPDATE ON "aporte_pagamentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_immutable" BEFORE UPDATE ON "aporte_pagamentos" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_audit_update" AFTER UPDATE ON "aporte_pagamentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aporte_pagamentos',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'cota_id',OLD."cota_id",'codigo',OLD."codigo",'data_pagamento',OLD."data_pagamento",'valor',OLD."valor",'observacoes',OLD."observacoes"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'estorno_de_id',NEW."estorno_de_id",'motivo_estorno',NEW."motivo_estorno",'cota_id',NEW."cota_id",'codigo',NEW."codigo",'data_pagamento',NEW."data_pagamento",'valor',NEW."valor",'observacoes',NEW."observacoes") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_context_delete" BEFORE DELETE ON "aporte_pagamentos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_preserve" BEFORE DELETE ON "aporte_pagamentos" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_pagamentos_audit_delete" AFTER DELETE ON "aporte_pagamentos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'aporte_pagamentos',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'estorno_de_id',OLD."estorno_de_id",'motivo_estorno',OLD."motivo_estorno",'cota_id',OLD."cota_id",'codigo',OLD."codigo",'data_pagamento',OLD."data_pagamento",'valor',OLD."valor",'observacoes',OLD."observacoes"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_context_insert" BEFORE INSERT ON "documento_vinculos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_author_insert" BEFORE INSERT ON "documento_vinculos" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_audit_insert" AFTER INSERT ON "documento_vinculos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'documento_vinculos',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'documento_id',NEW."documento_id",'despesa_id',NEW."despesa_id",'pagamento_despesa_id',NEW."pagamento_despesa_id",'diario_id',NEW."diario_id") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','documento_vinculos','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_context_update" BEFORE UPDATE ON "documento_vinculos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_immutable" BEFORE UPDATE ON "documento_vinculos" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_audit_update" AFTER UPDATE ON "documento_vinculos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'documento_vinculos',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'documento_id',OLD."documento_id",'despesa_id',OLD."despesa_id",'pagamento_despesa_id',OLD."pagamento_despesa_id",'diario_id',OLD."diario_id"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'documento_id',NEW."documento_id",'despesa_id',NEW."despesa_id",'pagamento_despesa_id',NEW."pagamento_despesa_id",'diario_id',NEW."diario_id") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_context_delete" BEFORE DELETE ON "documento_vinculos" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_preserve" BEFORE DELETE ON "documento_vinculos" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_vinculos_audit_delete" AFTER DELETE ON "documento_vinculos" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'documento_vinculos',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'documento_id',OLD."documento_id",'despesa_id',OLD."despesa_id",'pagamento_despesa_id',OLD."pagamento_despesa_id",'diario_id',OLD."diario_id"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_context_insert" BEFORE INSERT ON "recebimento_alocacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_author_insert" BEFORE INSERT ON "recebimento_alocacoes" WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_audit_insert" AFTER INSERT ON "recebimento_alocacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'recebimento_alocacoes',NEW."id",'insert',motivo,NULL,json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'recebimento_id',NEW."recebimento_id",'cobranca_item_id',NEW."cobranca_item_id",'negociacao_parcela_id',NEW."negociacao_parcela_id",'valor',NEW."valor") FROM __write_context WHERE id=1;
      UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','recebimento_alocacoes','id',NEW."id")) WHERE id=1;
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_context_update" BEFORE UPDATE ON "recebimento_alocacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_immutable" BEFORE UPDATE ON "recebimento_alocacoes" BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_audit_update" AFTER UPDATE ON "recebimento_alocacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'recebimento_alocacoes',NEW."id",'update',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'recebimento_id',OLD."recebimento_id",'cobranca_item_id',OLD."cobranca_item_id",'negociacao_parcela_id',OLD."negociacao_parcela_id",'valor',OLD."valor"),json_object('id',NEW."id",'created_at',NEW."created_at",'created_by',NEW."created_by",'recebimento_id',NEW."recebimento_id",'cobranca_item_id',NEW."cobranca_item_id",'negociacao_parcela_id',NEW."negociacao_parcela_id",'valor',NEW."valor") FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_context_delete" BEFORE DELETE ON "recebimento_alocacoes" WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_preserve" BEFORE DELETE ON "recebimento_alocacoes" BEGIN SELECT RAISE(ABORT, 'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_audit_delete" AFTER DELETE ON "recebimento_alocacoes" BEGIN
      INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
      SELECT ator_usuario_id,contexto_ator,'recebimento_alocacoes',OLD."id",'delete',motivo,json_object('id',OLD."id",'created_at',OLD."created_at",'created_by',OLD."created_by",'recebimento_id',OLD."recebimento_id",'cobranca_item_id',OLD."cobranca_item_id",'negociacao_parcela_id',OLD."negociacao_parcela_id",'valor',OLD."valor"),NULL FROM __write_context WHERE id=1;
      
      END;
--> statement-breakpoint
CREATE TRIGGER "cobranca_itens_emissao_atomica" BEFORE INSERT ON "cobranca_itens" WHEN NOT EXISTS (SELECT 1 FROM __write_context, json_each(novos_registros) j WHERE json_extract(j.value,'$.tabela')='cobrancas' AND json_extract(j.value,'$.id')=NEW.cobranca_id) BEGIN SELECT RAISE(ABORT, 'Composicao deve ser emitida junto ao registro principal'); END;
--> statement-breakpoint
CREATE TRIGGER "recebimento_alocacoes_emissao_atomica" BEFORE INSERT ON "recebimento_alocacoes" WHEN NOT EXISTS (SELECT 1 FROM __write_context, json_each(novos_registros) j WHERE json_extract(j.value,'$.tabela')='recebimentos' AND json_extract(j.value,'$.id')=NEW.recebimento_id) BEGIN SELECT RAISE(ABORT, 'Composicao deve ser emitida junto ao registro principal'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_parcelas_emissao_atomica" BEFORE INSERT ON "negociacao_parcelas" WHEN NOT EXISTS (SELECT 1 FROM __write_context, json_each(novos_registros) j WHERE json_extract(j.value,'$.tabela')='negociacoes' AND json_extract(j.value,'$.id')=NEW.negociacao_id) BEGIN SELECT RAISE(ABORT, 'Composicao deve ser emitida junto ao registro principal'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_cotas_emissao_atomica" BEFORE INSERT ON "aporte_cotas" WHEN NOT EXISTS (SELECT 1 FROM __write_context, json_each(novos_registros) j WHERE json_extract(j.value,'$.tabela')='aportes' AND json_extract(j.value,'$.id')=NEW.aporte_id) BEGIN SELECT RAISE(ABORT, 'Composicao deve ser emitida junto ao registro principal'); END;
--> statement-breakpoint
CREATE TRIGGER "contratacao_emissao" BEFORE INSERT ON "obra_contratacoes" WHEN NOT EXISTS (SELECT 1 FROM __write_context, json_each(novos_registros) j WHERE json_extract(j.value,'$.tabela')='despesas' AND json_extract(j.value,'$.id')=NEW.despesa_id) BEGIN SELECT RAISE(ABORT, 'Contratacao deve ser criada com a despesa'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_partes" BEFORE UPDATE ON "contratos" WHEN OLD.estado!='rascunho' AND (NEW.imovel_id!=OLD.imovel_id OR NEW.locatario_id!=OLD.locatario_id OR NEW.estado='rascunho') BEGIN SELECT RAISE(ABORT, 'Partes de contrato emitido imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contratos_historico_delete" BEFORE DELETE ON "contratos" WHEN OLD.estado!='rascunho' BEGIN SELECT RAISE(ABORT, 'Somente rascunho pode ser removido'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_rascunho_INSERT" BEFORE INSERT ON "contrato_unidades" WHEN EXISTS(SELECT 1 FROM contratos WHERE id=NEW.contrato_id AND estado!='rascunho') BEGIN SELECT RAISE(ABORT, 'Unidades de contrato emitido imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_rascunho_UPDATE" BEFORE UPDATE ON "contrato_unidades" WHEN EXISTS(SELECT 1 FROM contratos WHERE id=NEW.contrato_id AND estado!='rascunho') BEGIN SELECT RAISE(ABORT, 'Unidades de contrato emitido imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "contrato_unidades_rascunho_DELETE" BEFORE DELETE ON "contrato_unidades" WHEN EXISTS(SELECT 1 FROM contratos WHERE id=OLD.contrato_id AND estado!='rascunho') BEGIN SELECT RAISE(ABORT, 'Unidades de contrato emitido imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "encargos_rascunho_UPDATE" BEFORE UPDATE ON "contrato_encargos" WHEN EXISTS(SELECT 1 FROM contratos WHERE id=OLD.contrato_id AND estado!='rascunho') BEGIN SELECT RAISE(ABORT, 'Encargo de contrato emitido requer aditivo futuro'); END;
--> statement-breakpoint
CREATE TRIGGER "encargos_rascunho_DELETE" BEFORE DELETE ON "contrato_encargos" WHEN EXISTS(SELECT 1 FROM contratos WHERE id=OLD.contrato_id AND estado!='rascunho') BEGIN SELECT RAISE(ABORT, 'Encargo de contrato emitido requer aditivo futuro'); END;
--> statement-breakpoint
CREATE TRIGGER "imovel_carteira_historica" BEFORE UPDATE ON "imoveis" WHEN NEW.carteira_id!=OLD.carteira_id AND EXISTS(SELECT 1 FROM contratos WHERE imovel_id=OLD.id AND estado!='rascunho') BEGIN SELECT RAISE(ABORT, 'Transferencia de carteira depende de D17'); END;
--> statement-breakpoint
CREATE TRIGGER "unidade_imovel_historico" BEFORE UPDATE ON "unidades" WHEN NEW.imovel_id!=OLD.imovel_id AND EXISTS(SELECT 1 FROM contrato_unidades WHERE unidade_id=OLD.id) BEGIN SELECT RAISE(ABORT, 'Unidade utilizada nao pode mudar de imovel'); END;
--> statement-breakpoint
CREATE TRIGGER "despesa_valor_pago" BEFORE UPDATE ON "despesas" WHEN (NEW.valor!=OLD.valor OR NEW.fornecedor_id!=OLD.fornecedor_id OR NEW.origem!=OLD.origem) AND EXISTS(SELECT 1 FROM pagamentos_despesa WHERE despesa_id=OLD.id) BEGIN SELECT RAISE(ABORT, 'Obrigacao com pagamento nao pode mudar de valor ou credor'); END;
--> statement-breakpoint
CREATE TRIGGER "despesa_origem" BEFORE UPDATE ON "despesas" WHEN NEW.origem!=OLD.origem BEGIN SELECT RAISE(ABORT, 'Origem da obrigacao imutavel'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_versao_imutavel" BEFORE UPDATE ON "negociacoes" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."cobranca_id" IS NOT OLD."cobranca_id" OR NEW."versao" IS NOT OLD."versao" OR NEW."negociacao_anterior_id" IS NOT OLD."negociacao_anterior_id" OR NEW."saldo_base" IS NOT OLD."saldo_base" OR NEW."desconto" IS NOT OLD."desconto" OR NEW."acrescimo" IS NOT OLD."acrescimo" OR NEW."entrada_prevista" IS NOT OLD."entrada_prevista" OR NEW."quantidade_parcelas" IS NOT OLD."quantidade_parcelas" OR NEW."primeiro_vencimento" IS NOT OLD."primeiro_vencimento" OR NEW."data_acordo" IS NOT OLD."data_acordo" OR NEW."motivo" IS NOT OLD."motivo" OR NEW."forma_pagamento_prevista" IS NOT OLD."forma_pagamento_prevista" BEGIN SELECT RAISE(ABORT, 'Termos de versao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacoes_fechamento_unico" BEFORE UPDATE ON "negociacoes" WHEN OLD.substituida_em IS NOT NULL OR NEW.substituida_em IS NULL BEGIN SELECT RAISE(ABORT, 'Versao fechada nao pode reabrir'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_versao_imutavel" BEFORE UPDATE ON "obra_socios" WHEN NEW."id" IS NOT OLD."id" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."obra_id" IS NOT OLD."obra_id" OR NEW."socio_id" IS NOT OLD."socio_id" OR NEW."percentual" IS NOT OLD."percentual" OR NEW."inicio_vigencia" IS NOT OLD."inicio_vigencia" BEGIN SELECT RAISE(ABORT, 'Termos de versao imutaveis'); END;
--> statement-breakpoint
CREATE TRIGGER "obra_socios_fechamento_unico" BEFORE UPDATE ON "obra_socios" WHEN OLD.fim_vigencia IS NOT NULL OR NEW.fim_vigencia IS NULL BEGIN SELECT RAISE(ABORT, 'Versao fechada nao pode reabrir'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_metadados_publicados" BEFORE UPDATE ON "documentos" WHEN NEW.versao_anterior_id IS NOT OLD.versao_anterior_id OR NEW.nome_original!=OLD.nome_original OR (OLD.estado!='referenciado' AND (NEW.mime_type IS NOT OLD.mime_type OR NEW.tamanho_bytes IS NOT OLD.tamanho_bytes OR NEW.chave_armazenamento IS NOT OLD.chave_armazenamento OR NEW.hash_sha256 IS NOT OLD.hash_sha256)) OR OLD.estado='retirado' OR (OLD.estado='disponivel' AND NEW.estado='referenciado') BEGIN SELECT RAISE(ABORT, 'Documento publicado exige nova versao'); END;
--> statement-breakpoint
CREATE TRIGGER "documento_versao_existente" BEFORE INSERT ON "documentos" WHEN NEW.versao_anterior_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documentos WHERE id=NEW.versao_anterior_id) BEGIN SELECT RAISE(ABORT, 'Versao anterior deve existir'); END;
--> statement-breakpoint
CREATE TRIGGER "alocacao_vigente" BEFORE INSERT ON "recebimento_alocacoes" WHEN (SELECT estorno_de_id FROM recebimentos WHERE id=NEW.recebimento_id) IS NULL AND ((NEW.cobranca_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM negociacoes n JOIN cobranca_itens i ON i.cobranca_id=n.cobranca_id WHERE i.id=NEW.cobranca_item_id)) OR (NEW.negociacao_parcela_id IS NOT NULL AND EXISTS(SELECT 1 FROM negociacao_parcelas p JOIN negociacoes n ON n.id=p.negociacao_id WHERE p.id=NEW.negociacao_parcela_id AND n.substituida_em IS NOT NULL))) BEGIN SELECT RAISE(ABORT, 'Pagamento exige obrigacao vigente'); END;
--> statement-breakpoint
CREATE TRIGGER "estorno_pre_acordo" BEFORE INSERT ON "recebimentos" WHEN NEW.estorno_de_id IS NOT NULL AND EXISTS(SELECT 1 FROM recebimento_alocacoes a LEFT JOIN negociacao_parcelas p ON p.id=a.negociacao_parcela_id JOIN negociacoes n ON n.cobranca_id=NEW.cobranca_id WHERE a.recebimento_id=NEW.estorno_de_id AND (a.cobranca_item_id IS NOT NULL OR n.negociacao_anterior_id=p.negociacao_id)) BEGIN SELECT RAISE(ABORT, 'Estorno afetaria base de acordo posterior: D09'); END;
--> statement-breakpoint
CREATE TRIGGER "negociacao_base" BEFORE INSERT ON "negociacoes" WHEN NEW.saldo_base != CASE WHEN NEW.negociacao_anterior_id IS NULL THEN COALESCE((SELECT SUM(valor) FROM cobranca_itens WHERE cobranca_id=NEW.cobranca_id),0)-COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id WHERE r.cobranca_id=NEW.cobranca_id AND a.cobranca_item_id IS NOT NULL),0) ELSE COALESCE((SELECT SUM(valor) FROM negociacao_parcelas WHERE negociacao_id=NEW.negociacao_anterior_id),0)-COALESCE((SELECT SUM(CASE WHEN r.estorno_de_id IS NULL THEN a.valor ELSE -a.valor END) FROM recebimento_alocacoes a JOIN recebimentos r ON r.id=a.recebimento_id JOIN negociacao_parcelas p ON p.id=a.negociacao_parcela_id WHERE p.negociacao_id=NEW.negociacao_anterior_id),0) END BEGIN SELECT RAISE(ABORT, 'Saldo-base da negociacao diverge da obrigacao vigente'); END;
--> statement-breakpoint
CREATE TRIGGER "aporte_quadro_completo" BEFORE INSERT ON "aportes" WHEN 10000!=COALESCE((SELECT SUM(percentual) FROM obra_socios WHERE obra_id=NEW.obra_id AND fim_vigencia IS NULL),0) BEGIN SELECT RAISE(ABORT, 'Aporte exige participacoes correntes de 100 por cento'); END;
--> statement-breakpoint
CREATE TRIGGER "cota_versao_corrente" BEFORE INSERT ON "aporte_cotas" WHEN EXISTS(SELECT 1 FROM obra_socios WHERE id=NEW.obra_socio_id AND fim_vigencia IS NOT NULL) BEGIN SELECT RAISE(ABORT, 'Cota nova deve usar a participacao corrente'); END;
