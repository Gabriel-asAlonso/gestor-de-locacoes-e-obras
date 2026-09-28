ALTER TABLE auditoria_eventos ADD COLUMN request_id TEXT(64);
--> statement-breakpoint
ALTER TABLE auditoria_eventos ADD COLUMN event_code TEXT(100);
--> statement-breakpoint
ALTER TABLE auditoria_eventos ADD COLUMN categoria TEXT(40);
--> statement-breakpoint
ALTER TABLE auditoria_eventos ADD COLUMN modulo TEXT(64);
--> statement-breakpoint
ALTER TABLE auditoria_eventos ADD COLUMN origem TEXT(40);
--> statement-breakpoint
CREATE INDEX auditoria_request_idx ON auditoria_eventos(request_id);
--> statement-breakpoint
CREATE INDEX auditoria_evento_data_idx ON auditoria_eventos(event_code,ocorrido_em,id);
--> statement-breakpoint
CREATE TRIGGER auditoria_metadata_insert BEFORE INSERT ON auditoria_eventos WHEN
 (NEW.request_id IS NOT NULL AND (typeof(NEW.request_id)!='text' OR length(trim(NEW.request_id)) NOT BETWEEN 1 AND 64))
 OR (NEW.event_code IS NOT NULL AND (typeof(NEW.event_code)!='text' OR length(trim(NEW.event_code)) NOT BETWEEN 1 AND 100))
 OR (NEW.categoria IS NOT NULL AND (typeof(NEW.categoria)!='text' OR length(trim(NEW.categoria)) NOT BETWEEN 1 AND 40))
 OR (NEW.modulo IS NOT NULL AND (typeof(NEW.modulo)!='text' OR length(trim(NEW.modulo)) NOT BETWEEN 1 AND 64))
 OR (NEW.origem IS NOT NULL AND (typeof(NEW.origem)!='text' OR length(trim(NEW.origem)) NOT BETWEEN 1 AND 40))
 BEGIN SELECT RAISE(ABORT,'Metadados de auditoria invalidos'); END;
--> statement-breakpoint
CREATE TRIGGER auditoria_metadata_update BEFORE UPDATE ON auditoria_eventos WHEN
 (NEW.request_id IS NOT NULL AND (typeof(NEW.request_id)!='text' OR length(trim(NEW.request_id)) NOT BETWEEN 1 AND 64))
 OR (NEW.event_code IS NOT NULL AND (typeof(NEW.event_code)!='text' OR length(trim(NEW.event_code)) NOT BETWEEN 1 AND 100))
 OR (NEW.categoria IS NOT NULL AND (typeof(NEW.categoria)!='text' OR length(trim(NEW.categoria)) NOT BETWEEN 1 AND 40))
 OR (NEW.modulo IS NOT NULL AND (typeof(NEW.modulo)!='text' OR length(trim(NEW.modulo)) NOT BETWEEN 1 AND 64))
 OR (NEW.origem IS NOT NULL AND (typeof(NEW.origem)!='text' OR length(trim(NEW.origem)) NOT BETWEEN 1 AND 40))
 BEGIN SELECT RAISE(ABORT,'Metadados de auditoria invalidos'); END;
--> statement-breakpoint
ALTER TABLE __write_context ADD COLUMN request_id TEXT;
--> statement-breakpoint
ALTER TABLE __write_context ADD COLUMN event_code TEXT;
--> statement-breakpoint
ALTER TABLE __write_context ADD COLUMN categoria TEXT;
--> statement-breakpoint
ALTER TABLE __write_context ADD COLUMN modulo TEXT;
--> statement-breakpoint
ALTER TABLE __write_context ADD COLUMN origem TEXT;
--> statement-breakpoint
DROP TRIGGER __context_identity;
--> statement-breakpoint
CREATE TRIGGER __context_identity BEFORE UPDATE ON __write_context
WHEN NEW.id!=OLD.id OR NEW.ator_usuario_id IS NOT OLD.ator_usuario_id OR NEW.contexto_ator IS NOT OLD.contexto_ator
 OR NEW.motivo IS NOT OLD.motivo OR NEW.iniciado_em IS NOT OLD.iniciado_em OR NEW.encerramento_obrigatorio IS NOT OLD.encerramento_obrigatorio
 OR NEW.request_id IS NOT OLD.request_id OR NEW.event_code IS NOT OLD.event_code OR NEW.categoria IS NOT OLD.categoria
 OR NEW.modulo IS NOT OLD.modulo OR NEW.origem IS NOT OLD.origem
BEGIN SELECT RAISE(ABORT, 'Contexto de autoria imutavel na transacao'); END;
--> statement-breakpoint
DROP TRIGGER auditoria_eventos_immutable;
--> statement-breakpoint
CREATE TRIGGER auditoria_eventos_immutable BEFORE UPDATE ON auditoria_eventos
WHEN NOT (
 NEW.id IS OLD.id AND NEW.ocorrido_em IS OLD.ocorrido_em AND NEW.ator_usuario_id IS OLD.ator_usuario_id
 AND NEW.contexto_ator IS OLD.contexto_ator AND NEW.entidade IS OLD.entidade AND NEW.registro_id IS OLD.registro_id
 AND NEW.chave_composta IS OLD.chave_composta AND NEW.operacao IS OLD.operacao AND NEW.motivo IS OLD.motivo
 AND NEW.antes IS OLD.antes AND NEW.depois IS OLD.depois
 AND OLD.request_id IS NULL AND OLD.event_code IS NULL AND OLD.categoria IS NULL AND OLD.modulo IS NULL AND OLD.origem IS NULL
 AND NEW.request_id IS (SELECT request_id FROM __write_context WHERE id=1)
 AND NEW.event_code IS (SELECT event_code FROM __write_context WHERE id=1)
 AND NEW.categoria IS (SELECT categoria FROM __write_context WHERE id=1)
 AND NEW.modulo IS (SELECT modulo FROM __write_context WHERE id=1)
 AND NEW.origem IS (SELECT origem FROM __write_context WHERE id=1)
)
BEGIN SELECT RAISE(ABORT, 'Registro imutavel; use estorno ou nova versao'); END;
