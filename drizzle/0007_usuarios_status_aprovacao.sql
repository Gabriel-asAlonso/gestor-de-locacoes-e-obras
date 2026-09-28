ALTER TABLE usuarios ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente'
  CONSTRAINT "usuarios_status_text" CHECK(typeof(status)='text' AND length(trim(status))>0)
  CONSTRAINT "usuarios_status_domain" CHECK(status IN ('pendente','ativo','rejeitado','inativo'))
  -- The cross-column invariant is enforced by the two triggers below; this named
  -- column constraint keeps the schema contract discoverable during additive migration.
  CONSTRAINT "usuarios_status_ativo" CHECK(status IN ('pendente','ativo','rejeitado','inativo'));
--> statement-breakpoint
DROP TRIGGER usuarios_audit_insert;
--> statement-breakpoint
DROP TRIGGER usuarios_audit_update;
--> statement-breakpoint
DROP TRIGGER usuarios_audit_delete;
--> statement-breakpoint
CREATE TRIGGER usuarios_status_insert BEFORE INSERT ON usuarios
WHEN (NEW.status='ativo' AND (NEW.ativo!=1 OR NEW.perfil_codigo IS NULL))
  OR (NEW.status!='ativo' AND NEW.ativo!=0)
BEGIN SELECT RAISE(ABORT, 'Status, atividade e perfil do usuario sao incompatíveis'); END;
--> statement-breakpoint
CREATE TRIGGER usuarios_status_update BEFORE UPDATE ON usuarios
WHEN (NEW.status='ativo' AND (NEW.ativo!=1 OR NEW.perfil_codigo IS NULL))
  OR (NEW.status!='ativo' AND NEW.ativo!=0)
BEGIN SELECT RAISE(ABORT, 'Status, atividade e perfil do usuario sao incompatíveis'); END;
--> statement-breakpoint
CREATE TRIGGER usuarios_audit_insert AFTER INSERT ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',NEW.id,'insert',motivo,NULL,
    json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'updated_at',NEW.updated_at,'updated_by',NEW.updated_by,'nome',NEW.nome,'email',NEW.email,'perfil_codigo',NEW.perfil_codigo,'status',NEW.status,'ativo',NEW.ativo)
  FROM __write_context WHERE id=1;
  UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','usuarios','id',NEW.id)) WHERE id=1;
END;
--> statement-breakpoint
CREATE TRIGGER usuarios_audit_update AFTER UPDATE ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',NEW.id,'update',motivo,
    json_object('id',OLD.id,'created_at',OLD.created_at,'created_by',OLD.created_by,'updated_at',OLD.updated_at,'updated_by',OLD.updated_by,'nome',OLD.nome,'email',OLD.email,'perfil_codigo',OLD.perfil_codigo,'status',OLD.status,'ativo',OLD.ativo),
    json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'updated_at',NEW.updated_at,'updated_by',NEW.updated_by,'nome',NEW.nome,'email',NEW.email,'perfil_codigo',NEW.perfil_codigo,'status',NEW.status,'ativo',NEW.ativo)
  FROM __write_context WHERE id=1;
END;
--> statement-breakpoint
CREATE TRIGGER usuarios_audit_delete AFTER DELETE ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',OLD.id,'delete',motivo,
    json_object('id',OLD.id,'created_at',OLD.created_at,'created_by',OLD.created_by,'updated_at',OLD.updated_at,'updated_by',OLD.updated_by,'nome',OLD.nome,'email',OLD.email,'perfil_codigo',OLD.perfil_codigo,'status',OLD.status,'ativo',OLD.ativo),NULL
  FROM __write_context WHERE id=1;
END;
--> statement-breakpoint
INSERT INTO __write_context(id,contexto_ator,motivo)
VALUES(1,'migration:usuarios-status:v1','Classificacao inicial do status de acesso');
--> statement-breakpoint
UPDATE usuarios
SET status=CASE WHEN ativo=1 THEN 'ativo' ELSE 'inativo' END,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    updated_by=NULL;
--> statement-breakpoint
DELETE FROM __write_context WHERE id=1;
