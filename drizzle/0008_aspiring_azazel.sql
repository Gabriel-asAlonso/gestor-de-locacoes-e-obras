ALTER TABLE usuarios ADD COLUMN papel_codigo TEXT NOT NULL DEFAULT 'usuario'
  CONSTRAINT "usuarios_papel_codigo_text" CHECK(typeof(papel_codigo)='text' AND length(trim(papel_codigo))>0)
  CONSTRAINT "usuarios_papel_codigo_domain" CHECK(papel_codigo IN ('master','usuario'));
--> statement-breakpoint
ALTER TABLE usuarios ADD COLUMN autorizacao_versao INTEGER NOT NULL DEFAULT 1
  CONSTRAINT "usuarios_autorizacao_versao_integer" CHECK(typeof(autorizacao_versao)='integer')
  CONSTRAINT "usuarios_autorizacao_versao" CHECK(autorizacao_versao>=1);
--> statement-breakpoint
INSERT INTO __write_context(id,contexto_ator,motivo)
VALUES(1,'migration:autorizacao-v1','Conversao dos administradores existentes para o papel master');
--> statement-breakpoint
UPDATE usuarios
SET papel_codigo=CASE WHEN perfil_codigo='administrador' THEN 'master' ELSE 'usuario' END,
    autorizacao_versao=autorizacao_versao+1,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    updated_by=NULL;
--> statement-breakpoint
DELETE FROM __write_context WHERE id=1;
--> statement-breakpoint
CREATE TABLE `usuario_permissoes` (
	`usuario_id` text(36) NOT NULL,
	`permissao_codigo` text(100) NOT NULL,
	`concedida_em` text(24) DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`concedida_por` text(36) NOT NULL,
	PRIMARY KEY(`usuario_id`, `permissao_codigo`),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`concedida_por`) REFERENCES `usuarios`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "usuario_permissoes_usuario_id_text" CHECK(typeof(`usuario_id`)='text' AND length(trim(`usuario_id`))>0),
	CONSTRAINT "usuario_permissoes_usuario_id_length" CHECK(length(`usuario_id`)<=36),
	CONSTRAINT "usuario_permissoes_usuario_id_uuid" CHECK(length(`usuario_id`)=36 AND substr(`usuario_id`,9,1)='-' AND substr(`usuario_id`,14,1)='-' AND substr(`usuario_id`,19,1)='-' AND substr(`usuario_id`,24,1)='-' AND length(replace(`usuario_id`,'-',''))=32 AND replace(`usuario_id`,'-','') NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "usuario_permissoes_permissao_codigo_text" CHECK(typeof(`permissao_codigo`)='text' AND length(trim(`permissao_codigo`))>0),
	CONSTRAINT "usuario_permissoes_permissao_codigo_length" CHECK(length(`permissao_codigo`)<=100),
	CONSTRAINT "usuario_permissoes_concedida_em_text" CHECK(typeof(`concedida_em`)='text' AND length(trim(`concedida_em`))>0),
	CONSTRAINT "usuario_permissoes_concedida_em_length" CHECK(length(`concedida_em`)<=24),
	CONSTRAINT "usuario_permissoes_concedida_em_utc" CHECK(length(`concedida_em`)=24 AND strftime('%Y-%m-%dT%H:%M:%fZ',`concedida_em`,'+0 days')=`concedida_em`),
	CONSTRAINT "usuario_permissoes_concedida_por_text" CHECK(typeof(`concedida_por`)='text' AND length(trim(`concedida_por`))>0),
	CONSTRAINT "usuario_permissoes_concedida_por_length" CHECK(length(`concedida_por`)<=36),
	CONSTRAINT "usuario_permissoes_concedida_por_uuid" CHECK(length(`concedida_por`)=36 AND substr(`concedida_por`,9,1)='-' AND substr(`concedida_por`,14,1)='-' AND substr(`concedida_por`,19,1)='-' AND substr(`concedida_por`,24,1)='-' AND length(replace(`concedida_por`,'-',''))=32 AND replace(`concedida_por`,'-','') NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE INDEX `usuario_permissoes_codigo_idx` ON `usuario_permissoes` (`permissao_codigo`);
--> statement-breakpoint
CREATE TRIGGER usuario_permissoes_context_insert BEFORE INSERT ON usuario_permissoes
WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1)
BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER usuario_permissoes_author_insert BEFORE INSERT ON usuario_permissoes
WHEN NEW.concedida_por IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1)
BEGIN SELECT RAISE(ABORT, 'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER usuario_permissoes_immutable BEFORE UPDATE ON usuario_permissoes
BEGIN SELECT RAISE(ABORT, 'Concessao imutavel; revogue e conceda novamente'); END;
--> statement-breakpoint
CREATE TRIGGER usuario_permissoes_context_delete BEFORE DELETE ON usuario_permissoes
WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1)
BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER usuario_permissoes_audit_insert AFTER INSERT ON usuario_permissoes BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuario_permissoes',json_object('usuario_id',NEW.usuario_id,'permissao_codigo',NEW.permissao_codigo),'grant',motivo,NULL,
    json_object('usuario_id',NEW.usuario_id,'permissao_codigo',NEW.permissao_codigo,'concedida_em',NEW.concedida_em,'concedida_por',NEW.concedida_por)
  FROM __write_context WHERE id=1;
END;
--> statement-breakpoint
CREATE TRIGGER usuario_permissoes_audit_delete AFTER DELETE ON usuario_permissoes BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,chave_composta,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuario_permissoes',json_object('usuario_id',OLD.usuario_id,'permissao_codigo',OLD.permissao_codigo),'revoke',motivo,
    json_object('usuario_id',OLD.usuario_id,'permissao_codigo',OLD.permissao_codigo,'concedida_em',OLD.concedida_em,'concedida_por',OLD.concedida_por),NULL
  FROM __write_context WHERE id=1;
END;
--> statement-breakpoint
DROP TRIGGER usuarios_audit_insert;
--> statement-breakpoint
DROP TRIGGER usuarios_audit_update;
--> statement-breakpoint
DROP TRIGGER usuarios_audit_delete;
--> statement-breakpoint
CREATE TRIGGER usuarios_audit_insert AFTER INSERT ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',NEW.id,'insert',motivo,NULL,
    json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'updated_at',NEW.updated_at,'updated_by',NEW.updated_by,'nome',NEW.nome,'email',NEW.email,'perfil_codigo',NEW.perfil_codigo,'papel_codigo',NEW.papel_codigo,'autorizacao_versao',NEW.autorizacao_versao,'status',NEW.status,'ativo',NEW.ativo)
  FROM __write_context WHERE id=1;
  UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','usuarios','id',NEW.id)) WHERE id=1;
END;
--> statement-breakpoint
CREATE TRIGGER usuarios_audit_update AFTER UPDATE ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',NEW.id,'update',motivo,
    json_object('id',OLD.id,'created_at',OLD.created_at,'created_by',OLD.created_by,'updated_at',OLD.updated_at,'updated_by',OLD.updated_by,'nome',OLD.nome,'email',OLD.email,'perfil_codigo',OLD.perfil_codigo,'papel_codigo',OLD.papel_codigo,'autorizacao_versao',OLD.autorizacao_versao,'status',OLD.status,'ativo',OLD.ativo),
    json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'updated_at',NEW.updated_at,'updated_by',NEW.updated_by,'nome',NEW.nome,'email',NEW.email,'perfil_codigo',NEW.perfil_codigo,'papel_codigo',NEW.papel_codigo,'autorizacao_versao',NEW.autorizacao_versao,'status',NEW.status,'ativo',NEW.ativo)
  FROM __write_context WHERE id=1;
END;
--> statement-breakpoint
CREATE TRIGGER usuarios_audit_delete AFTER DELETE ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',OLD.id,'delete',motivo,
    json_object('id',OLD.id,'created_at',OLD.created_at,'created_by',OLD.created_by,'updated_at',OLD.updated_at,'updated_by',OLD.updated_by,'nome',OLD.nome,'email',OLD.email,'perfil_codigo',OLD.perfil_codigo,'papel_codigo',OLD.papel_codigo,'autorizacao_versao',OLD.autorizacao_versao,'status',OLD.status,'ativo',OLD.ativo),NULL
  FROM __write_context WHERE id=1;
END;
--> statement-breakpoint
PRAGMA optimize;
