DROP TRIGGER usuario_permissoes_context_insert;
DROP TRIGGER usuario_permissoes_author_insert;
DROP TRIGGER usuario_permissoes_immutable;
DROP TRIGGER usuario_permissoes_context_delete;
DROP TRIGGER usuario_permissoes_audit_insert;
DROP TRIGGER usuario_permissoes_audit_delete;
DROP TABLE usuario_permissoes;

DROP TRIGGER usuarios_audit_insert;
DROP TRIGGER usuarios_audit_update;
DROP TRIGGER usuarios_audit_delete;

CREATE TRIGGER usuarios_audit_insert AFTER INSERT ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',NEW.id,'insert',motivo,NULL,
    json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'updated_at',NEW.updated_at,'updated_by',NEW.updated_by,'nome',NEW.nome,'email',NEW.email,'perfil_codigo',NEW.perfil_codigo,'status',NEW.status,'ativo',NEW.ativo)
  FROM __write_context WHERE id=1;
  UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','usuarios','id',NEW.id)) WHERE id=1;
END;

CREATE TRIGGER usuarios_audit_update AFTER UPDATE ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',NEW.id,'update',motivo,
    json_object('id',OLD.id,'created_at',OLD.created_at,'created_by',OLD.created_by,'updated_at',OLD.updated_at,'updated_by',OLD.updated_by,'nome',OLD.nome,'email',OLD.email,'perfil_codigo',OLD.perfil_codigo,'status',OLD.status,'ativo',OLD.ativo),
    json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'updated_at',NEW.updated_at,'updated_by',NEW.updated_by,'nome',NEW.nome,'email',NEW.email,'perfil_codigo',NEW.perfil_codigo,'status',NEW.status,'ativo',NEW.ativo)
  FROM __write_context WHERE id=1;
END;

CREATE TRIGGER usuarios_audit_delete AFTER DELETE ON usuarios BEGIN
  INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois)
  SELECT ator_usuario_id,contexto_ator,'usuarios',OLD.id,'delete',motivo,
    json_object('id',OLD.id,'created_at',OLD.created_at,'created_by',OLD.created_by,'updated_at',OLD.updated_at,'updated_by',OLD.updated_by,'nome',OLD.nome,'email',OLD.email,'perfil_codigo',OLD.perfil_codigo,'status',OLD.status,'ativo',OLD.ativo),NULL
  FROM __write_context WHERE id=1;
END;

ALTER TABLE usuarios DROP COLUMN autorizacao_versao;
ALTER TABLE usuarios DROP COLUMN papel_codigo;
