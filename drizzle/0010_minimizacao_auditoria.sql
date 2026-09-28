DROP TRIGGER auditoria_eventos_immutable;
--> statement-breakpoint
DROP TRIGGER auditoria_eventos_context_update;
--> statement-breakpoint
UPDATE auditoria_eventos
SET event_code='AUDIT_LEGACY', categoria='audit', origem='legacy'
WHERE request_id IS NULL AND event_code IS NULL AND categoria IS NULL AND modulo IS NULL AND origem IS NULL;
--> statement-breakpoint
CREATE TRIGGER auditoria_eventos_context_update BEFORE UPDATE ON auditoria_eventos
WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1)
BEGIN SELECT RAISE(ABORT, 'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER auditoria_eventos_immutable BEFORE UPDATE ON auditoria_eventos
WHEN NOT (
 NEW.id IS OLD.id AND NEW.ocorrido_em IS OLD.ocorrido_em AND NEW.ator_usuario_id IS OLD.ator_usuario_id
 AND NEW.contexto_ator IS OLD.contexto_ator AND NEW.entidade IS OLD.entidade AND NEW.registro_id IS OLD.registro_id
 AND NEW.chave_composta IS OLD.chave_composta AND NEW.operacao IS OLD.operacao AND NEW.motivo IS OLD.motivo
 AND OLD.request_id IS NULL AND OLD.event_code IS NULL AND OLD.categoria IS NULL AND OLD.modulo IS NULL AND OLD.origem IS NULL
 AND NEW.request_id IS (SELECT request_id FROM __write_context WHERE id=1)
 AND NEW.event_code IS (SELECT event_code FROM __write_context WHERE id=1)
 AND NEW.categoria IS (SELECT categoria FROM __write_context WHERE id=1)
 AND NEW.modulo IS (SELECT modulo FROM __write_context WHERE id=1)
 AND NEW.origem IS (SELECT origem FROM __write_context WHERE id=1)
)
BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
